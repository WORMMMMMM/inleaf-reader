#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function developmentHostArguments(root = repositoryRoot) {
  return [
    '--new-window',
    `--extensionDevelopmentPath=${root}`,
    root
  ];
}

export function vscodeCliCandidates(platform = process.platform, environment = process.env) {
  if (platform === 'darwin') {
    return [
      'code',
      '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code',
      path.join(
        environment.USERPROFILE || environment.HOME || os.homedir(),
        'Applications/Visual Studio Code.app/Contents/Resources/app/bin/code'
      )
    ];
  }
  if (platform === 'win32') {
    const localAppData = environment.LOCALAPPDATA;
    return [
      'code.cmd',
      ...(localAppData
        ? [path.join(localAppData, 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd')]
        : [])
    ];
  }
  return [
    'code',
    '/usr/bin/code',
    '/usr/local/bin/code'
  ];
}

export function launcherCandidates(platform = process.platform, environment = process.env) {
  const arguments_ = developmentHostArguments();
  const candidates = vscodeCliCandidates(platform, environment)
    .map(command => ({ command, args: arguments_ }));
  if (platform === 'darwin') {
    candidates.push({
      command: 'open',
      args: ['-na', 'Visual Studio Code', '--args', ...arguments_]
    });
  }
  return candidates;
}

async function main() {
  if (process.argv.includes('--dry-run')) {
    process.stdout.write(`${JSON.stringify(launcherCandidates(), null, 2)}\n`);
    return;
  }

  const errors = [];
  for (const candidate of launcherCandidates()) {
    if (candidate.command.includes(path.sep)) {
      try {
        await access(candidate.command);
      } catch {
        continue;
      }
    }
    try {
      await launch(candidate.command, candidate.args);
      process.stdout.write(
        `Inleaf Reader development host is opening.\n` +
        `After code changes, run Developer: Reload Window in that new window.\n`
      );
      return;
    } catch (error) {
      errors.push(`${candidate.command}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(
    'Could not find the VS Code launcher. Install the `code` shell command from VS Code, then run npm run dev again.\n' +
    errors.join('\n')
  );
}

function launch(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repositoryRoot,
      detached: true,
      stdio: 'ignore',
      windowsHide: false
    });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
