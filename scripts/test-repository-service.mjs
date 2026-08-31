import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const require = createRequire(import.meta.url);
const { RepositoryService, normalizeRepositoryUrl } = require('../out/repositoryService.js');
const exec = promisify(execFile);

assert.equal(normalizeRepositoryUrl('https://github.com/example/repo/'), 'https://github.com/example/repo');
assert.ok(!normalizeRepositoryUrl('https://user:password@github.com/example/repo.git').includes('password'));
assert.throws(() => normalizeRepositoryUrl('file:///tmp/repo'), /HTTPS, HTTP, SSH, or Git/);

const directory = await mkdtemp(path.join(os.tmpdir(), 'inleaf-repository-'));
await exec('git', ['init', directory]);
await exec('git', ['-C', directory, 'config', 'user.name', 'Inleaf Test']);
await exec('git', ['-C', directory, 'config', 'user.email', 'inleaf@example.invalid']);
await writeFile(path.join(directory, 'README.md'), '# Test\n');
await writeFile(path.join(directory, 'LICENSE'), 'Test license\n');
await exec('git', ['-C', directory, 'add', 'README.md', 'LICENSE']);
await exec('git', ['-C', directory, 'commit', '-m', 'initial']);

const service = new RepositoryService();
const clean = await service.snapshot(directory);
assert.match(clean.commit, /^[0-9a-f]{40}$/);
assert.equal(clean.dirty, false);
assert.equal(clean.license, 'LICENSE');
await writeFile(path.join(directory, 'working-note.txt'), 'uncommitted\n');
const dirty = await service.snapshot(directory);
assert.equal(dirty.dirty, true);

console.log('Repository snapshot tests passed.');
