import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({
  entryPoints: ['src/quickStart.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node'
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`;
const { buildQuickStartOptions } = await import(moduleUrl);

const firstRun = buildQuickStartOptions({
  activePaperName: 'robot-paper.pdf',
  libraryRootCount: 0,
  hasDeepSeekKey: false
});
assert.deepEqual(firstRun.map(option => option.action), [
  'openPaper',
  'chooseLibraryRoot',
  'setupCodex',
  'configureDeepSeek',
  'openGuide'
]);
assert.match(firstRun[0].description, /robot-paper\.pdf/);
assert.match(firstRun.find(option => option.action === 'setupCodex').detail, /MCP.*可选/);
assert.match(firstRun.find(option => option.action === 'configureDeepSeek').description, /安全保存/);

const configured = buildQuickStartOptions({
  libraryRootCount: 2,
  hasDeepSeekKey: true
});
assert.ok(configured.some(option => option.action === 'rebuildLibrary'));
assert.match(configured.find(option => option.action === 'chooseLibraryRoot').description, /2 个文库目录/);
assert.match(configured.find(option => option.action === 'configureDeepSeek').description, /已配置/);

console.log('Quick Start menu tests passed.');
