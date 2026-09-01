import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const { READER_CAPABILITIES, resolveCapabilityDescriptors } = await import(
  '../out/capabilities/contracts.js'
);
const { decodeAnnotationRequest } = await import('../out/capabilities/annotations/protocol.js');
const { decodeTranslationRequest } = await import('../out/capabilities/translation/protocol.js');
const { decodeWordbookRequest } = await import('../out/capabilities/wordbook/protocol.js');

assert.deepEqual(READER_CAPABILITIES.map(item => item.id), [
  'annotations',
  'wordbook',
  'translation'
]);

const defaults = resolveCapabilityDescriptors(undefined);
assert.ok(defaults.every(item => item.enabled && item.showInPanel));
const customized = resolveCapabilityDescriptors({
  annotations: { enabled: false },
  translation: { showInPanel: false, order: 5 }
});
assert.equal(customized[0].id, 'translation');
assert.equal(customized.find(item => item.id === 'annotations')?.enabled, false);
assert.equal(customized.find(item => item.id === 'translation')?.showInPanel, false);

const update = decodeAnnotationRequest('update', {
  id: 'annotation-1',
  patch: { selectedText: 'corrected OCR', id: 'must-not-cross-the-boundary' }
});
assert.equal(update.payload.patch.selectedText, 'corrected OCR');
assert.equal('id' in update.payload.patch, false, 'capability decoders must remove protected fields');
assert.throws(() => decodeAnnotationRequest('delete', {}), /annotation id/);
assert.throws(() => decodeWordbookRequest('save', { word: '' }), /word is required/);
assert.throws(
  () => decodeTranslationRequest('updateSetting', { key: 'apiKey', value: 'secret' }),
  /Unknown translation setting/
);

const [mainSource, overviewSource, panelSource, messagesSource, registrySource, packageSource] = await Promise.all([
  readFile(new URL('../webview/src/main.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../webview/src/capabilities/OverviewPanel.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/paperReaderPanel.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/readerMessages.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/capabilities/hostRegistry.ts', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8')
]);

assert.match(mainSource, /'closed' \| 'workspace' \| 'settings'|ReaderSurface/);
assert.match(mainSource, /⚙ Settings/);
assert.match(mainSource, /type: 'capabilityRequest'/);
assert.match(mainSource, /type: 'updateCapabilityPreference'/);
assert.doesNotMatch(overviewSource, /Provider|Languages|translationProvider/);
assert.match(panelSource, /new HostCapabilityRegistry/);
assert.match(panelSource, /type: 'capabilityEvent'/);
assert.match(registrySource, /new AnnotationHostCapability/);
assert.match(registrySource, /new WordbookHostCapability/);
assert.match(registrySource, /new TranslationHostCapability/);
assert.doesNotMatch(messagesSource, /saveAnnotation|saveWord|setTranslationProvider/);
assert.match(packageSource, /"inleafReader\.capabilities"/);

console.log('Composable reader capability framework contract passed.');
