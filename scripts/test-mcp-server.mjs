import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';

const root = await mkdtemp(path.join(os.tmpdir(), 'inleaf-mcp-'));
const pdfPath = path.join(root, 'paper.pdf');
const sidecars = path.join(root, '.inleaf-reader');
await mkdir(sidecars, { recursive: true });
await writeFile(pdfPath, '%PDF test');
await writeFile(path.join(sidecars, 'current-session.json'), JSON.stringify({
  schemaVersion: 1,
  updatedAt: new Date().toISOString(),
  pdfPath,
  fingerprint: 'fingerprint',
  currentPage: 4,
  selection: { schemaVersion: 1, documentFingerprint: 'fingerprint', page: 4, quote: 'evidence' }
}));
await writeFile(path.join(sidecars, 'paper.pdf.annotations.json'), JSON.stringify([{ id: 'a1', selectedText: 'evidence' }]));
await writeFile(path.join(sidecars, 'paper.pdf.research.json'), JSON.stringify({ artifacts: [{ type: 'github', url: 'https://github.com/example/repo' }] }));
await writeFile(path.join(sidecars, 'library.index.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  warnings: [],
  papers: [{ title: 'Tactile Paper', year: 2026, tags: ['tactile'], pdfPath }]
}));

const child = spawn(process.execPath, ['scripts/inleaf_mcp_server.mjs', '--root', root], {
  cwd: process.cwd(),
  stdio: ['pipe', 'pipe', 'pipe']
});
const pending = new Map();
createInterface({ input: child.stdout, crlfDelay: Infinity }).on('line', line => {
  const response = JSON.parse(line);
  pending.get(response.id)?.(response);
  pending.delete(response.id);
});
let nextId = 1;
function request(method, params) {
  const id = nextId++;
  const promise = new Promise(resolve => pending.set(id, resolve));
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  return promise;
}

try {
  const initialized = await request('initialize', { protocolVersion: '2025-06-18' });
  assert.equal(initialized.result.serverInfo.name, 'inleaf-reader');
  const listed = await request('tools/list');
  assert.ok(listed.result.tools.some(tool => tool.name === 'search_library'));
  const current = await request('tools/call', { name: 'get_current_paper', arguments: {} });
  assert.equal(current.result.structuredContent.currentPage, 4);
  const annotations = await request('tools/call', { name: 'list_annotations', arguments: {} });
  assert.equal(annotations.result.structuredContent[0].id, 'a1');
  const search = await request('tools/call', { name: 'search_library', arguments: { query: 'tactile', tags: ['tactile'] } });
  assert.equal(search.result.structuredContent.papers.length, 1);
  const outside = await request('tools/call', { name: 'list_annotations', arguments: { pdfPath: '/etc/hosts' } });
  assert.match(outside.error.message, /outside|not a PDF/);
  console.log('Read-only Inleaf MCP server tests passed.');
} finally {
  child.kill('SIGTERM');
}
