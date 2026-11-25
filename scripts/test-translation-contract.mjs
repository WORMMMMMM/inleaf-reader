import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const {
  isLocalOpenAiEndpoint,
  requireDeepSeekModel,
  requireTranslationProvider,
  resolveOpenAiChatUrl
} = await import('../out/translationContract.js');
const { EN_MESSAGES } = await import('../out/i18n.js');

assert.equal(requireTranslationProvider(undefined), 'argos');
assert.equal(requireTranslationProvider('libretranslate'), 'libretranslate');
assert.equal(requireTranslationProvider('openai'), 'openai');
assert.throws(
  () => requireTranslationProvider('unexpected-network-provider'),
  /Unsupported translation provider/
);
assert.equal(requireDeepSeekModel(undefined), 'deepseek-v4-flash');
assert.equal(requireDeepSeekModel('deepseek-chat'), 'deepseek-chat');
assert.throws(() => requireDeepSeekModel('unknown-model'), /Unsupported DeepSeek model/);
assert.equal(resolveOpenAiChatUrl('https://api.openai.com/v1'), 'https://api.openai.com/v1/chat/completions');
assert.equal(resolveOpenAiChatUrl('http://localhost:11434/v1/'), 'http://localhost:11434/v1/chat/completions');
assert.equal(isLocalOpenAiEndpoint('http://localhost:11434/v1'), true);
assert.equal(isLocalOpenAiEndpoint('https://api.openai.com/v1'), false);

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
assert.match(settingsSource, /<option value="openai">/);
assert.match(settingsSource, /deepSeekKeyConfigured/);
assert.match(EN_MESSAGES.deepSeekKeyConfigured, /DeepSeek API key is configured/);

console.log('Translation provider contract passed.');
