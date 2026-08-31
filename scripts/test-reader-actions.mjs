import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({
  entryPoints: ['webview/src/readerActions.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser'
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`;
const { getReaderActions, invokeReaderAction, readerActionRegistry } = await import(moduleUrl);

assert.deepEqual(
  getReaderActions({ selectedText: 'evidence', codexAvailable: true, locator: locator() }, 'selection-primary')
    .map(entry => entry.definition.id),
  [
    'inleafReader.action.highlight',
    'inleafReader.action.underline',
    'inleafReader.action.note',
    'inleafReader.action.translate',
    'inleafReader.action.askCodex'
  ]
);
assert.equal(new Set(readerActionRegistry.map(action => action.id)).size, readerActionRegistry.length);

const emptyContext = { selectedText: '', codexAvailable: false };
for (const action of getReaderActions(emptyContext, 'selection-primary')) {
  assert.equal(action.available, false);
  assert.ok(action.disabledReason);
}

const codexUnavailable = invokeReaderAction(
  'inleafReader.action.askCodex',
  { selectedText: 'evidence', codexAvailable: false, locator: locator() },
  { question: 'Explain' }
);
assert.match(codexUnavailable.error, /Codex CLI/);

assert.deepEqual(
  invokeReaderAction(
    'inleafReader.action.highlight',
    { selectedText: 'evidence', codexAvailable: false },
    { color: '#123456' }
  ).payload,
  { type: 'saveAnnotation', kind: 'highlight', color: '#123456' }
);
assert.equal(
  invokeReaderAction(
    'inleafReader.action.note',
    { selectedText: 'evidence', codexAvailable: false },
    { note: '   ' }
  ).error,
  '此操作还需要更多输入。'
);
assert.equal(
  invokeReaderAction(
    'inleafReader.action.askCodex',
    { selectedText: 'evidence', codexAvailable: true, locator: locator() },
    { question: 'Explain the claim.' }
  ).payload.type,
  'askCodex'
);

console.log('Reader Action Registry tests passed.');

function locator() {
  return {
    schemaVersion: 1,
    documentFingerprint: 'fingerprint',
    page: 2,
    quote: 'evidence'
  };
}
