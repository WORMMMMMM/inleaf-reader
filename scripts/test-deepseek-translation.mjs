import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  return request === 'vscode' ? {} : originalLoad.call(this, request, parent, isMain);
};

try {
  const require = createRequire(import.meta.url);
  const { requestDeepSeekTranslation } = require('../out/translationService.js');
  let captured;
  const translated = await requestDeepSeekTranslation({
    apiKey: 'test-secret-not-a-real-key',
    model: 'deepseek-v4-flash',
    target: 'Simplified Chinese',
    text: 'A tactile sensor measures contact.',
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return response(200, { choices: [{ message: { content: '触觉传感器测量接触。' } }] });
    }
  });
  assert.equal(translated, '触觉传感器测量接触。');
  assert.equal(captured.url, 'https://api.deepseek.com/chat/completions');
  assert.match(captured.init.headers.Authorization, /^Bearer test-secret/);
  const requestBody = JSON.parse(captured.init.body);
  assert.equal(requestBody.model, 'deepseek-v4-flash');
  assert.equal(requestBody.thinking.type, 'disabled');
  assert.ok(!captured.init.body.includes('test-secret-not-a-real-key'));

  await assert.rejects(() => requestDeepSeekTranslation({
    apiKey: 'invalid', model: 'deepseek-v4-pro', target: 'Chinese', text: 'text',
    fetchImpl: async () => response(401, { error: { message: 'invalid key' } })
  }), /rejected the API key/);
  await assert.rejects(() => requestDeepSeekTranslation({
    apiKey: 'quota', model: 'deepseek-v4-pro', target: 'Chinese', text: 'text',
    fetchImpl: async () => response(429, { error: { message: 'rate limited' } })
  }), /rate limit or quota/);
  await assert.rejects(() => requestDeepSeekTranslation({
    apiKey: 'server', model: 'deepseek-v4-pro', target: 'Chinese', text: 'text',
    fetchImpl: async () => response(503, { error: { message: 'unavailable' } })
  }), /temporarily unavailable/);
  await assert.rejects(() => requestDeepSeekTranslation({
    apiKey: 'network', model: 'deepseek-v4-pro', target: 'Chinese', text: 'text',
    fetchImpl: async () => { throw new TypeError('offline'); }
  }), /Could not reach/);

  const cancel = new AbortController();
  cancel.abort();
  await assert.rejects(() => requestDeepSeekTranslation({
    apiKey: 'cancel', model: 'deepseek-v4-pro', target: 'Chinese', text: 'text', signal: cancel.signal,
    fetchImpl: abortingFetch
  }), /canceled/);
  await assert.rejects(() => requestDeepSeekTranslation({
    apiKey: 'timeout', model: 'deepseek-v4-pro', target: 'Chinese', text: 'text', timeoutMs: 5,
    fetchImpl: abortingFetch
  }), /timed out/);

  console.log('DeepSeek translation contract tests passed.');
} finally {
  Module._load = originalLoad;
}

function response(status, value) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(value)
  };
}

function abortingFetch(_url, init) {
  return new Promise((_, reject) => {
    const rejectAbort = () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    };
    if (init.signal.aborted) rejectAbort();
    else init.signal.addEventListener('abort', rejectAbort, { once: true });
  });
}
