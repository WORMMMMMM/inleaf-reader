#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { vscodeCliCandidates } from './start-dev.mjs';

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const manifest = JSON.parse(await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'));
  const vsixPath = path.join(repositoryRoot, `${manifest.name}-${manifest.version}.vsix`);
  await access(vsixPath);

  const failures = [];
  for (const command of vscodeCliCandidates()) {
    if (command.includes(path.sep)) {
      try {
        await access(command);
      } catch {
        continue;
      }
    }
    try {
      const result = await execFileAsync(command, [
        '--install-extension',
        vsixPath,
        '--force'
      ], {
        cwd: repositoryRoot,
        timeout: 60_000,
        maxBuffer: 4 * 1024 * 1024
      });
      process.stdout.write(result.stdout || result.stderr || 'Inleaf Reader installed.\n');
      process.stdout.write(
        'Reload each open VS Code window once. After that, open any PDF and click the Inleaf book icon.\n'
      );
      return;
    } catch (error) {
      failures.push(`${command}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(
    'Could not find a working VS Code command-line launcher.\n' + failures.join('\n')
  );
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
