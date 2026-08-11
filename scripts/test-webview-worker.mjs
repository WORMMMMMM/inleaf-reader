import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [webviewSource, panelSource, generatedBundle] = await Promise.all([
  readFile(new URL('../webview/src/main.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/paperReaderPanel.ts', import.meta.url), 'utf8'),
  readFile(new URL('../media/reader-app.js', import.meta.url), 'utf8')
]);

assert.match(webviewSource, /createPdfWorkerBlobUrl\(readerConfig\.pdfWorkerUrl\)/);
assert.match(webviewSource, /URL\.createObjectURL\(new Blob/);
assert.match(webviewSource, /workerSrc=\{pdfWorkerSrc\}/);
assert.doesNotMatch(webviewSource, /workerSrc=\{readerConfig\.pdfWorkerUrl\}/);
assert.match(panelSource, /script-src[^"]*blob:/);
assert.match(panelSource, /worker-src blob: data:/);
assert.match(generatedBundle, /Starting PDF worker/);
assert.match(generatedBundle, /createObjectURL/);

console.log('Webview PDF worker contract passed.');
