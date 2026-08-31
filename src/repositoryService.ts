import { execFile } from 'child_process';
import { readdir, stat } from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';
import type { ResearchArtifact } from './researchTypes';

const execFileAsync = promisify(execFile);

export class RepositoryService {
  validateUrl(value: string) {
    return normalizeRepositoryUrl(value);
  }

  async snapshot(localPath: string): Promise<NonNullable<ResearchArtifact['localCheckout']> & { license: string }> {
    const resolved = path.resolve(localPath);
    const fileStat = await stat(resolved);
    if (!fileStat.isDirectory()) {
      throw new Error('Repository checkout must be a directory.');
    }
    const [commit, branch, statusOutput] = await Promise.all([
      git(resolved, ['rev-parse', 'HEAD']),
      git(resolved, ['branch', '--show-current']),
      git(resolved, ['status', '--porcelain=v1', '--untracked-files=normal'])
    ]);
    return {
      path: resolved,
      commit: commit.trim(),
      branch: branch.trim() || undefined,
      dirty: !!statusOutput.trim(),
      capturedAt: new Date().toISOString(),
      license: await detectLicense(resolved)
    };
  }

  async clone(url: string, targetPath: string) {
    const normalizedUrl = normalizeRepositoryUrl(url);
    const resolvedTarget = path.resolve(targetPath);
    await validateCloneTarget(resolvedTarget);
    await execFileAsync('git', ['clone', '--', normalizedUrl, resolvedTarget], {
      timeout: 10 * 60 * 1000,
      maxBuffer: 4 * 1024 * 1024
    });
    return this.snapshot(resolvedTarget);
  }
}

export function normalizeRepositoryUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Enter a repository URL.');
  if (/^[\w.-]+@[\w.-]+:[\w./-]+(?:\.git)?$/.test(trimmed)) {
    return trimmed;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Repository URL is invalid.');
  }
  if (!['https:', 'http:', 'ssh:', 'git:'].includes(parsed.protocol)) {
    throw new Error('Repository URL must use HTTPS, HTTP, SSH, or Git.');
  }
  if (!parsed.hostname) throw new Error('Repository URL must include a host.');
  parsed.username = '';
  parsed.password = '';
  parsed.hash = '';
  parsed.search = '';
  return parsed.toString().replace(/\/$/, '');
}

async function git(cwd: string, args: string[]) {
  try {
    const { stdout } = await execFileAsync('git', ['-C', cwd, ...args], {
      timeout: 15000,
      maxBuffer: 2 * 1024 * 1024
    });
    return stdout;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not inspect repository at ${cwd}: ${detail}`);
  }
}

async function detectLicense(root: string) {
  const candidates = (await readdir(root))
    .filter(name => /^licen[cs]e(?:\.|$)|^copying(?:\.|$)/i.test(name))
    .sort();
  return candidates[0] || '';
}

async function validateCloneTarget(targetPath: string) {
  const parsed = path.parse(targetPath);
  if (targetPath === parsed.root) {
    throw new Error('A filesystem root cannot be used as a clone target.');
  }
  try {
    const targetStat = await stat(targetPath);
    if (!targetStat.isDirectory()) {
      throw new Error('Clone target exists and is not a directory.');
    }
    const entries = await readdir(targetPath);
    if (entries.length) {
      throw new Error('Clone target already exists and is not empty.');
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error;
  }
}
