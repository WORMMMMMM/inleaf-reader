import assert from 'node:assert/strict';
import path from 'node:path';
import {
  developmentHostArguments,
  launcherCandidates,
  vscodeCliCandidates
} from './start-dev.mjs';

const root = path.resolve('.');
assert.deepEqual(developmentHostArguments(root), [
  '--new-window',
  `--extensionDevelopmentPath=${root}`,
  root
]);

const mac = launcherCandidates('darwin', { HOME: '/tmp/inleaf-user' });
assert.equal(mac[0].command, 'code');
assert.equal(mac.at(-1).command, 'open');
assert.ok(mac.every(candidate => candidate.args.some(argument => argument.includes('--extensionDevelopmentPath='))));

const windows = launcherCandidates('win32', { LOCALAPPDATA: 'C:\\Users\\inleaf\\AppData\\Local' });
assert.equal(windows[0].command, 'code.cmd');
assert.ok(windows.some(candidate => candidate.command.endsWith('code.cmd')));

const linux = launcherCandidates('linux', {});
assert.equal(linux[0].command, 'code');
assert.ok(linux.some(candidate => candidate.command === '/usr/bin/code'));
assert.ok(vscodeCliCandidates('darwin', { HOME: '/tmp/inleaf-user' })
  .includes('/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code'));

console.log('One-command development launcher tests passed.');
