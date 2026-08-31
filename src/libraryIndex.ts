import { readdir, readFile, stat } from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { AtomicJsonFile } from './atomicJsonFile';
import { INLEAF_IDS } from './identity';
import { fingerprintPdf } from './pdfIdentity';
import {
  createDefaultResearchProfile,
  normalizeResearchProfile,
  researchProfileTags,
  type LibraryIndexData,
  type LibraryPaper
} from './researchTypes';

const INDEX_FILE = path.join(INLEAF_IDS.sidecarDirectory, 'library.index.json');

export class LibraryIndexService {
  constructor(private readonly globalState: vscode.Memento) {}

  roots() {
    return this.globalState.get<string[]>(INLEAF_IDS.globalState.libraryRoots, []);
  }

  rootForPdf(pdfPath: string) {
    const resolvedPdf = path.resolve(pdfPath);
    return this.roots()
      .map(root => path.resolve(root))
      .filter(root => resolvedPdf === root || resolvedPdf.startsWith(`${root}${path.sep}`))
      .sort((left, right) => right.length - left.length)[0];
  }

  async addRoot(rootPath: string) {
    const resolved = path.resolve(rootPath);
    const roots = [resolved, ...this.roots().filter(root => path.resolve(root) !== resolved)];
    await this.globalState.update(INLEAF_IDS.globalState.libraryRoots, roots);
    return roots;
  }

  async removeRoot(rootPath: string) {
    const resolved = path.resolve(rootPath);
    const roots = this.roots().filter(root => path.resolve(root) !== resolved);
    await this.globalState.update(INLEAF_IDS.globalState.libraryRoots, roots);
    return roots;
  }

  async readAll(): Promise<LibraryIndexData[]> {
    return Promise.all(this.roots().map(async root => {
      try {
        return await this.readRoot(root);
      } catch (error) {
        return {
          ...emptyLibraryIndex(root),
          warnings: [
            `Library index could not be read and should be rebuilt: ${error instanceof Error ? error.message : String(error)}`
          ]
        };
      }
    }));
  }

  async readRoot(rootPath: string): Promise<LibraryIndexData> {
    const resolvedRoot = path.resolve(rootPath);
    return this.indexFile(resolvedRoot).read();
  }

  async rebuildRoot(rootPath: string): Promise<LibraryIndexData> {
    const resolvedRoot = path.resolve(rootPath);
    const rootStat = await stat(resolvedRoot);
    if (!rootStat.isDirectory()) {
      throw new Error(`Library root is not a directory: ${resolvedRoot}`);
    }
    const pdfPaths = await findPdfFiles(resolvedRoot);
    const warnings: string[] = [];
    const papers = await mapWithConcurrency(pdfPaths, 4, async pdfPath => {
      try {
        return await buildLibraryPaper(pdfPath, warnings);
      } catch (error) {
        warnings.push(`${pdfPath}: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
      }
    });
    const uniqueByFingerprint = new Map<string, LibraryPaper>();
    for (const paper of papers.filter((paper): paper is LibraryPaper => !!paper)) {
      const current = uniqueByFingerprint.get(paper.fingerprint);
      if (!current) {
        uniqueByFingerprint.set(paper.fingerprint, paper);
        continue;
      }
      const preferred = await preferLibraryPaper(current, paper);
      const duplicate = preferred.pdfPath === current.pdfPath ? paper : current;
      uniqueByFingerprint.set(paper.fingerprint, preferred);
      warnings.push(`Duplicate PDF bytes skipped: ${duplicate.pdfPath}`);
    }
    const index: LibraryIndexData = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      rootPath: resolvedRoot,
      papers: [...uniqueByFingerprint.values()].sort(compareLibraryPapers),
      warnings
    };
    return this.indexFile(resolvedRoot).write(index);
  }

  private indexFile(rootPath: string) {
    const uri = vscode.Uri.file(path.join(rootPath, INDEX_FILE));
    return new AtomicJsonFile<LibraryIndexData>(
      uri,
      () => emptyLibraryIndex(rootPath),
      (value, fallback) => normalizeLibraryIndex(value, fallback)
    );
  }
}

export async function findPdfFiles(rootPath: string): Promise<string[]> {
  const results: string[] = [];
  const pending = [path.resolve(rootPath)];
  while (pending.length) {
    const directory = pending.pop()!;
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name === INLEAF_IDS.sidecarDirectory || entry.name === '.git' || entry.name === 'node_modules') {
        continue;
      }
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        pending.push(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
        results.push(fullPath);
      }
    }
  }
  return results.sort();
}

export function searchLibrary(
  indexes: LibraryIndexData[],
  query: string,
  requiredTags: string[] = []
): LibraryPaper[] {
  const needle = query.trim().toLowerCase();
  const tags = requiredTags.map(tag => tag.trim().toLowerCase()).filter(Boolean);
  return indexes
    .flatMap(index => index.papers)
    .filter(paper => {
      const searchable = `${paper.title} ${paper.year || ''} ${paper.tags.join(' ')}`.toLowerCase();
      return (!needle || searchable.includes(needle))
        && tags.every(tag => paper.tags.includes(tag));
    })
    .sort(compareLibraryPapers);
}

async function buildLibraryPaper(pdfPath: string, warnings: string[]): Promise<LibraryPaper> {
  const fingerprint = await fingerprintPdf(pdfPath);
  const researchPath = path.join(
    path.dirname(pdfPath),
    INLEAF_IDS.sidecarDirectory,
    `${path.basename(pdfPath)}.research.json`
  );
  const fallback = createDefaultResearchProfile(fingerprint, pdfPath);
  let profile = fallback;
  try {
    const bytes = await readFile(researchPath);
    profile = normalizeResearchProfile(JSON.parse(bytes.toString('utf8')), fallback);
    if (profile.paperFingerprint && profile.paperFingerprint !== fingerprint) {
      warnings.push(`${researchPath}: fingerprint mismatch; profile fields were ignored.`);
      profile = fallback;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      warnings.push(`${researchPath}: could not read research profile.`);
    }
  }
  const fileStat = await stat(pdfPath);
  return {
    fingerprint,
    pdfPath,
    researchPath,
    title: profile.bibliography.title || path.basename(pdfPath),
    year: profile.bibliography.year,
    tags: researchProfileTags(profile),
    repositoryCount: profile.artifacts.filter(artifact =>
      artifact.type === 'github' || artifact.type === 'git_repository'
    ).length,
    updatedAt: profile.updatedAt || fileStat.mtime.toISOString()
  };
}

async function preferLibraryPaper(left: LibraryPaper, right: LibraryPaper) {
  const [leftResearch, rightResearch] = await Promise.all([
    fileExists(left.researchPath),
    fileExists(right.researchPath)
  ]);
  if (leftResearch !== rightResearch) {
    return rightResearch ? right : left;
  }
  return right.updatedAt.localeCompare(left.updatedAt) > 0 ? right : left;
}

async function fileExists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function emptyLibraryIndex(rootPath: string): LibraryIndexData {
  return {
    schemaVersion: 1,
    generatedAt: new Date(0).toISOString(),
    rootPath: path.resolve(rootPath),
    papers: [],
    warnings: []
  };
}

function normalizeLibraryIndex(value: unknown, fallback: LibraryIndexData): LibraryIndexData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const raw = value as Partial<LibraryIndexData>;
  return {
    schemaVersion: 1,
    generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : fallback.generatedAt,
    rootPath: typeof raw.rootPath === 'string' ? path.resolve(raw.rootPath) : fallback.rootPath,
    papers: Array.isArray(raw.papers) ? raw.papers.filter(isLibraryPaper) : [],
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings.filter((warning): warning is string => typeof warning === 'string')
      : []
  };
}

function isLibraryPaper(value: unknown): value is LibraryPaper {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const raw = value as Partial<LibraryPaper>;
  return typeof raw.fingerprint === 'string'
    && typeof raw.pdfPath === 'string'
    && typeof raw.researchPath === 'string'
    && typeof raw.title === 'string'
    && (typeof raw.year === 'number' || raw.year === null)
    && Array.isArray(raw.tags)
    && typeof raw.repositoryCount === 'number'
    && typeof raw.updatedAt === 'string';
}

function compareLibraryPapers(left: LibraryPaper, right: LibraryPaper) {
  return (right.year || 0) - (left.year || 0) || left.title.localeCompare(right.title);
}

async function mapWithConcurrency<Input, Output>(
  inputs: Input[],
  limit: number,
  operation: (input: Input) => Promise<Output>
) {
  const outputs = new Array<Output>(inputs.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < inputs.length) {
      const index = nextIndex++;
      outputs[index] = await operation(inputs[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, inputs.length) }, worker));
  return outputs;
}
