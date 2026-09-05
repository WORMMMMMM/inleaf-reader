import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);

// Run the actual modules with controlled I/O and scheduling, not copies of their algorithms.
function loadSource(file, mocks = {}, globals = {}) {
  const filename = new URL(`../${file}`, import.meta.url);
  const localRequire = createRequire(filename);
  const exports = {};
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React, esModuleInterop: true }
  }).outputText;
  vm.runInNewContext(code, {
    exports, require: id => id in mocks ? mocks[id] : localRequire(id),
    AbortController, AbortSignal, Error, TypeError, setTimeout, clearTimeout, console, ...globals
  }, { filename: filename.pathname });
  return exports;
}

const identity = require('../out/identity.js');
const contracts = require('../out/capabilities/contracts.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

// Two user edits read the latest configuration when each queued write begins.
let stored = {};
let failNextWrite = false;
let writeCount = 0;
const configuration = {
  get: key => key === 'capabilities' ? stored : undefined,
  update: async (_key, value) => {
    writeCount++;
    await tick();
    if (failNextWrite) { failNextWrite = false; throw new Error('write failed'); }
    stored = value;
  }
};
const vscode = { workspace: { getConfiguration: () => configuration }, ConfigurationTarget: { Global: 1 } };
const { CapabilityPreferenceService } = loadSource('src/capabilities/preferences.ts', {
  vscode, '../identity': identity, './contracts': contracts
});
const preferences = new CapabilityPreferenceService();
await Promise.all([
  preferences.update('annotations', { enabled: false }),
  preferences.update('wordbook', { showInPanel: false })
]);
assert.equal(stored.annotations.enabled, false);
assert.equal(stored.wordbook.showInPanel, false);
failNextWrite = true;
await assert.rejects(preferences.update('translation', { enabled: false }), /write failed/);
await preferences.update('translation', { order: 4 });
assert.equal(stored.translation.order, 4, 'failed writes must not poison the queue');
assert.equal(writeCount, 4);

// Invalid word inputs fail before storage; valid input round-trips without protected fields.
const { decodeWordbookRequest } = require('../out/capabilities/wordbook/protocol.js');
const { decodeWords, encodeWords } = require('../out/sidecarSchemas.js');
for (const patch of [{ page: -1 }, { definitions: 'bad' }, { definitions: [{ pos: 1, meaning: 'bad' }] },
  { translation: 123 }, { review: { level: -1, nextReviewAt: 'bad' } }]) {
  assert.throws(() => decodeWordbookRequest('save', { word: 'algorithm', ...patch }));
}
const word = decodeWordbookRequest('save', { word: 'algorithm', page: 2, id: 'injected',
  createdAt: 'injected', unexpected: true, definitions: [{ pos: 'n', meaning: 'method' }] }).payload;
assert.equal('id' in word, false);
assert.equal('createdAt' in word, false);
assert.equal('unexpected' in word, false);
const timestamp = new Date().toISOString();
assert.equal(decodeWords(encodeWords([{ ...word, id: 'real', createdAt: timestamp, updatedAt: timestamp }])).value[0].word, 'algorithm');

// Exercise PdfDocumentView through the event bus with a deterministic frame scheduler.
let frameId = 0;
const frames = new Map();
const cleanup = [];
const react = {
  useRef: value => ({ current: value }), useCallback: fn => fn,
  useEffect: fn => { const dispose = fn(); if (dispose) cleanup.push(dispose); },
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } })
};
const { PdfDocumentView } = loadSource('webview/src/components/PdfDocumentView.tsx', {
  react, 'react-pdf-highlighter-plus': { PdfHighlighter: 'highlighter' },
  '../pdfSelection': { markPageSelectionRegions() {} }
}, { window: {
  requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId; },
  cancelAnimationFrame: id => frames.delete(id)
} });
const classNames = new Set();
const layers = [1, 2].map(() => ({ style: {}, dataset: {} }));
const pages = layers.map(layer => ({ querySelectorAll: () => [layer] }));
const container = {
  querySelectorAll: () => layers, addEventListener() {}, removeEventListener() {},
  classList: {
    contains: key => classNames.has(key), remove: key => classNames.delete(key),
    toggle: (key, enabled) => enabled ? classNames.add(key) : classNames.delete(key)
  }
};
const handlers = new Map();
const eventBus = { on: (key, fn) => handlers.set(key, fn), off: key => handlers.delete(key) };
const viewer = { container, currentScale: 1, currentPageNumber: 0,
  getPageView: index => pages[index] ? { div: pages[index] } : undefined };
const tree = PdfDocumentView({ pdfDocument: { numPages: 2 }, highlights: [], zoom: 1,
  onDocumentReady() {}, onPageChange() {}, onPinchZoom() {}, onSelection() {}, utilsRef() {}, onOpen() {} });
tree.props.utilsRef({ getEventBus: () => eventBus, getViewer: () => viewer });
const flushFrames = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); };
viewer.currentScale = 0.8;
handlers.get('scalechanging')({ scale: 0.8 });
handlers.get('pagerendered')({ pageNumber: 1 });
handlers.get('textlayerrendered')({ pageNumber: 2 });
flushFrames();
assert.ok(layers.every(layer => layer.style.transform === ''));
assert.equal(classNames.has('pdf-scale-in-progress'), false);
viewer.currentScale = 0.6;
handlers.get('scalechanging')({ scale: 0.6 });
handlers.get('pagerendered')({ pageNumber: 1 });
viewer.currentScale = 0.5;
handlers.get('scalechanging')({ scale: 0.5 });
handlers.get('pagerendered')({ pageNumber: 1 });
handlers.get('pagerendered')({ pageNumber: 2 });
flushFrames();
assert.ok(layers.every(layer => layer.dataset.renderedScale === '0.5'));
cleanup.forEach(dispose => dispose());
assert.equal(frames.size, 0);

// The real translation hook rejects stale results even when the source text is identical.
const state = [];
const messages = [];
let sequence = 0;
const hookReact = { useRef: react.useRef, useCallback: react.useCallback,
  useState: value => { const index = state.length; state.push(value); return [value, next => { state[index] = next; }]; } };
const { useTranslationCapability } = loadSource('webview/src/capabilities/translation/useTranslationCapability.ts', {
  react: hookReact, '../../vscodeApi': { vscode: { postMessage: message => messages.push(message) } }
}, { crypto: { randomUUID: () => `request-${++sequence}` } });
const hook = useTranslationCapability();
hook.start('same sentence');
hook.start('same sentence');
assert.equal(messages.filter(message => message.action === 'translate').length, 1);
const firstId = messages[0].payload.requestId;
hook.clearResult();
hook.start('same sentence');
const secondId = messages.at(-1).payload.requestId;
hook.handleEvent('result', { sourceText: 'same sentence', requestId: secondId, translatedText: 'new' }, 'same sentence');
hook.handleEvent('result', { sourceText: 'same sentence', requestId: firstId, translatedText: 'old' }, 'same sentence');
assert.equal(state[2], 'new');
hook.clearResult();
hook.handleEvent('result', { sourceText: 'same sentence', requestId: secondId, translatedText: 'late' }, 'same sentence');
assert.equal(state[2], '');

// Host cancellation, result identity, and targeted configuration publication.
const requests = [];
let settingsReads = 0;
class TranslationService {
  async getSettings() { settingsReads++; return { provider: 'deepseek', hasDeepSeekApiKey: true }; }
  translate(text, signal) { const result = deferred(); requests.push({ text, signal, ...result }); return result.promise; }
  enrichWord(input) { return Promise.resolve(input); }
  dispose() {}
}
const { TranslationHostCapability } = loadSource('src/capabilities/translation/host.ts', {
  vscode, '../../identity': identity, '../../translationContract': require('../out/translationContract.js'),
  '../../translationService': { TranslationService }, './protocol': require('../out/capabilities/translation/protocol.js')
});
const events = [];
const context = { documentId: 'doc-1', storage: {}, postEvent: async (...args) => { events.push(args); return true; } };
const host = new TranslationHostCapability({}, {});
const first = host.handle('translate', { text: 'same', requestId: '1' }, context);
const second = host.handle('translate', { text: 'same', requestId: '2' }, context);
assert.equal(requests[0].signal.aborted, true);
requests[1].resolve({ translatedText: 'new' }); await second;
requests[0].resolve({ translatedText: 'old' }); await first;
assert.equal(events.length, 1);
assert.equal(events[0][2].requestId, '2');
const active = host.handle('translate', { text: 'next', requestId: '3' }, context);
await host.handle('cancel', { requestId: '2' }, context);
assert.equal(requests[2].signal.aborted, false, 'a stale cancel cannot cancel the latest request');
host.cancelPending();
requests[2].resolve({ translatedText: 'ignored' }); await active;
assert.equal(events.length, 1);

const failed = host.handle('translate', { text: 'failure', requestId: '4' }, context);
const failureCheck = assert.rejects(failed, /provider failed/);
requests[3].reject(new Error('provider failed')); await failureCheck;
assert.equal(events.at(-1)[2].requestId, '4');
assert.equal(events.at(-1)[2].error, 'provider failed');

let annotationReads = 0, wordReads = 0;
class AnnotationHostCapability { id = 'annotations'; async postInitialState() { annotationReads++; } }
class WordbookHostCapability { id = 'wordbook'; async postInitialState() { wordReads++; } }
const { HostCapabilityRegistry } = loadSource('src/capabilities/hostRegistry.ts', {
  vscode, '../identity': identity,
  './annotations/host': { AnnotationHostCapability }, './wordbook/host': { WordbookHostCapability },
  './translation/host': { TranslationHostCapability }
});
const registry = new HostCapabilityRegistry({}, {});
await registry.postInitialState(context);
const changed = key => ({ affectsConfiguration: candidate => candidate === key });
const readsBefore = settingsReads;
await registry.configurationChanged(changed('inleafReader.translationTarget'), context);
await registry.readiness();
assert.equal(settingsReads, readsBefore + 1);
assert.equal(annotationReads, 1);
assert.equal(wordReads, 1);
await registry.configurationChanged(changed('inleafReader.capabilities'), context);
await registry.readiness();
assert.equal(settingsReads, readsBefore + 1, 'layout changes must not re-read translation settings');
assert.equal(annotationReads, 1);
assert.equal(wordReads, 1);
const { PaperReaderPanel } = loadSource('src/paperReaderPanel.ts', {
  vscode, './identity': identity, './readerStorage': {}, './capabilities/hostRegistry': {},
  './capabilities/preferences': {}
});
let preferenceUpdates = 0;
const panel = Object.create(PaperReaderPanel.prototype);
panel.capabilityPreferences = { update: async () => { preferenceUpdates++; } };
panel.postCapabilitySettings = () => { throw new Error('duplicate refresh'); };
panel.capabilities = { postInitialState: () => { throw new Error('bulk refresh'); } };
await panel.dispatchMessage({ type: 'updateCapabilityPreference', documentId: 'doc-1',
  payload: { capabilityId: 'wordbook', patch: { showInPanel: false } } });
assert.equal(preferenceUpdates, 1);

// Cancelled Argos work must not start after waiting in the local request queue.
const { ArgosTranslationDaemon } = require('../out/argosTranslationDaemon.js');
const daemon = new ArgosTranslationDaemon(() => '', '');
let starts = 0;
const started = deferred();
daemon.ensureReady = async () => { starts++; await started.promise; };
const controller1 = new AbortController(), controller2 = new AbortController();
const result1 = daemon.request({}, controller1.signal);
const result2 = daemon.request({}, controller2.signal);
const checked1 = assert.rejects(result1, /abort/i), checked2 = assert.rejects(result2, /abort/i);
await tick();
controller1.abort(); controller2.abort(); started.resolve();
await Promise.all([checked1, checked2]);
assert.equal(starts, 1);

// Cancellation reaches the network fetch rather than merely hiding its result.
let fetchSignal;
const networkConfiguration = { get: key => ({ translationProvider: 'deepseek', deepSeekModel: 'deepseek-v4-flash', translationTarget: 'zh' })[key] };
const { TranslationService: NetworkService } = loadSource('src/translationService.ts', {
  vscode: { workspace: { getConfiguration: () => networkConfiguration } },
  './identity': identity, './translationContract': require('../out/translationContract.js'),
  './argosTranslationDaemon': { ArgosTranslationDaemon: class { dispose() {} } },
  './ecdictClient': { EcdictClient: class { dispose() {} } }
}, { fetch: (_url, options) => new Promise((_resolve, reject) => {
  fetchSignal = options.signal;
  options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
}) });
const networkService = new NetworkService({ fsPath: '/tmp' }, { get: async () => 'test-key' });
const networkCancel = new AbortController();
const networkResult = networkService.translate('two words', networkCancel.signal);
await tick();
assert.ok(fetchSignal);
networkCancel.abort(); await networkResult;
assert.equal(fetchSignal.aborted, true);
networkService.dispose();

console.log('Reader concurrency behavior tests passed: settings, word validation, multi-page zoom, translation identity/cancellation, and targeted refresh.');
