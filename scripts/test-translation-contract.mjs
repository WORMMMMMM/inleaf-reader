import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const {
  requireDeepSeekModel,
  requireTranslationProvider
} = await import('../out/translationContract.js');

assert.equal(requireTranslationProvider(undefined), 'argos');
assert.equal(requireTranslationProvider('libretranslate'), 'libretranslate');
assert.throws(
  () => requireTranslationProvider('unexpected-network-provider'),
  /Unsupported translation provider/
);
assert.equal(requireDeepSeekModel(undefined), 'deepseek-v4-flash');
assert.throws(() => requireDeepSeekModel('unknown-model'), /Unsupported DeepSeek model/);

const [panelSource, webviewSource] = await Promise.all([
  readFile(new URL('../src/paperReaderPanel.ts', import.meta.url), 'utf8'),
  readFile(new URL('../webview/src/main.tsx', import.meta.url), 'utf8')
]);
assert.match(panelSource, /function serializeForInlineScript/);
assert.match(panelSource, /JSON\.stringify\(value\)\.replace\(\/<\/g, '\\\\u003c'\)/);
assert.match(webviewSource, /type: 'setTranslationProvider'/);
assert.match(webviewSource, /<option value="argos">/);
assert.match(webviewSource, /<option value="libretranslate">/);
assert.match(webviewSource, /<option value="deepseek">/);

console.log('Translation provider contract passed.');
