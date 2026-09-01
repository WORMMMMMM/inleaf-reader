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

const [panelSource, webviewSource, settingsSource, translationHostSource] = await Promise.all([
  readFile(new URL('../src/paperReaderPanel.ts', import.meta.url), 'utf8'),
  readFile(new URL('../webview/src/main.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../webview/src/capabilities/SettingsView.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/capabilities/translation/host.ts', import.meta.url), 'utf8')
]);
assert.match(panelSource, /function serializeForInlineScript/);
assert.match(panelSource, /JSON\.stringify\(value\)\.replace\(\/<\/g, '\\\\u003c'\)/);
assert.match(webviewSource, /postCapabilityRequest\('translation', 'updateSetting'/);
assert.match(translationHostSource, /settingConfigurationKey/);
assert.match(settingsSource, /<option value="argos">/);
assert.match(settingsSource, /<option value="libretranslate">/);
assert.match(settingsSource, /<option value="deepseek">/);
assert.match(settingsSource, /DeepSeek API key is configured/);

console.log('Translation provider contract passed.');
