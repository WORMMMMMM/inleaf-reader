import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import {
  copyFile,
  link,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

class FileSystemError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

class Uri {
  constructor(fsPath) { this.fsPath = fsPath; }
  static file(value) { return new Uri(value); }
  static joinPath(base, ...parts) { return new Uri(path.join(base.fsPath, ...parts)); }
}

async function withFileError(operation) {
  try {
    return await operation();
  } catch (error) {
    if (error?.code === 'ENOENT') throw new FileSystemError(error.message, 'FileNotFound');
    throw error;
  }
}

const vscodeMock = {
  Uri,
  FileSystemError,
  workspace: {
    fs: {
      createDirectory: uri => mkdir(uri.fsPath, { recursive: true }),
      readFile: uri => withFileError(() => readFile(uri.fsPath)),
      writeFile: (uri, bytes) => writeFile(uri.fsPath, bytes),
      copy: (source, destination) => copyFile(source.fsPath, destination.fsPath),
      rename: async (source, destination, options) => {
        if (options?.overwrite) {
          try { await unlink(destination.fsPath); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
        }
        await rename(source.fsPath, destination.fsPath);
      },
      delete: uri => unlink(uri.fsPath),
      stat: uri => withFileError(() => stat(uri.fsPath))
    }
  }
};

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  return request === 'vscode' ? vscodeMock : originalLoad.call(this, request, parent, isMain);
};

try {
  const require = createRequire(import.meta.url);
  const { ResearchStorage } = require('../out/researchStorage.js');
  const { LibraryIndexService } = require('../out/libraryIndex.js');
  const { ComparisonService } = require('../out/comparisonService.js');
  const { resolveEvidenceLocator } = require('../out/evidenceLocator.js');

  const libraryRoot = await mkdtemp(path.join(os.tmpdir(), 'inleaf-reference-library-'));
  const corpusRoot = process.env.INLEAF_TEST_REFERENCE_ROOT
    || '/Users/newtides/Documents/面向机器人操作的主动物理感知/references';
  const corpusNames = await topLevelPdfNames(corpusRoot);
  const sourceNames = corpusNames.length ? corpusNames : ['2024_Tactile_Test_Paper.pdf', '2025_Active_Perception_Test_Paper.pdf', '2026_Robot_Learning_Test_Paper.pdf'];

  for (const [index, name] of sourceNames.entries()) {
    const destination = path.join(libraryRoot, name);
    if (corpusNames.length) {
      const source = path.join(corpusRoot, name);
      try {
        await link(source, destination);
      } catch {
        await copyFile(source, destination);
      }
    } else {
      await writeFile(destination, Buffer.from(`%PDF-1.4\nsynthetic inleaf paper ${index}\n%%EOF\n`));
    }
  }

  const mementoValues = new Map();
  const memento = {
    get(key, fallback) { return mementoValues.has(key) ? mementoValues.get(key) : fallback; },
    async update(key, value) { mementoValues.set(key, value); }
  };
  const library = new LibraryIndexService(memento);
  await library.addRoot(libraryRoot);
  let index = await library.rebuildRoot(libraryRoot);
  assert.ok(index.papers.length >= Math.min(3, sourceNames.length), 'the reference corpus should produce a multi-paper index');
  assert.ok(index.papers.every(paper => paper.pdfPath.startsWith(libraryRoot)), 'the test must never index-write into the authoritative corpus');

  const selectedPapers = index.papers.slice(0, 3);
  const inputs = [];
  for (const [paperIndex, paper] of selectedPapers.entries()) {
    const storage = new ResearchStorage(Uri.file(paper.pdfPath));
    await storage.updateProfile({
      classification: {
        areas: ['active perception'],
        tasks: paperIndex % 2 ? ['grasping'] : ['in-hand manipulation'],
        sensors: ['tactile']
      }
    });
    const locator = {
      schemaVersion: 1,
      documentFingerprint: paper.fingerprint,
      annotationId: `annotation-${paperIndex}`,
      page: paperIndex + 1,
      rects: [{ page: paperIndex + 1, x: 0.1, y: 0.2, width: 0.3, height: 0.04 }],
      quote: `Located evidence ${paperIndex}`
    };
    await storage.addFact({
      field: 'classification.tasks',
      value: paperIndex % 2 ? 'grasping' : 'in-hand manipulation',
      status: 'confirmed',
      source: { type: 'paper', locator },
      extractedBy: { kind: 'user', name: 'test', capturedAt: new Date().toISOString() }
    });
    if (paperIndex === 0) {
      await Promise.all(Array.from({ length: 8 }, (_, concurrentIndex) => storage.addFact({
        field: 'test.concurrent',
        value: `value-${concurrentIndex}`,
        status: 'suggested',
        source: { type: 'user' },
        extractedBy: { kind: 'rule', name: 'concurrency-test', capturedAt: new Date().toISOString() }
      })));
      await storage.addArtifact({
        type: 'github',
        url: 'https://github.com/example/reference-implementation',
        relationship: 'community reproduction',
        verification: { status: 'confirmed', sourceType: 'user' },
        license: '',
        notes: ''
      });
      const profile = await storage.readProfile();
      assert.equal(profile.facts.filter(fact => fact.field === 'test.concurrent').length, 8);
      assert.ok((await stat(`${storage.uri.fsPath}.bak`)).size > 0, 'research mutations should retain a backup');
    }
    inputs.push({ paper, profile: await storage.readProfile() });
  }

  index = await library.rebuildRoot(libraryRoot);
  assert.ok(index.papers.some(paper => paper.tags.includes('tactile')));
  assert.equal(index.papers.find(paper => paper.fingerprint === selectedPapers[0].fingerprint)?.repositoryCount, 1);

  const comparisonService = new ComparisonService();
  const comparison = comparisonService.build(inputs, [
    { id: 'task', label: 'Task', factFields: ['classification.tasks'] },
    { id: 'failure', label: 'Failure evidence', factFields: ['failure'] }
  ], 'Reference corpus comparison');
  assert.equal(comparison.cells.filter(cell => cell.dimensionId === 'task' && cell.status === 'evidenced').length, inputs.length);
  assert.equal(comparison.cells.filter(cell => cell.dimensionId === 'failure' && cell.status === 'unknown').length, inputs.length);
  assert.ok(comparison.cells.filter(cell => cell.status !== 'unknown').every(cell => cell.evidenceRefs.length > 0));
  const output = await comparisonService.save(libraryRoot, comparison);
  const markdown = await readFile(output.markdownUri.fsPath, 'utf8');
  assert.match(markdown, /Reference corpus comparison/);
  assert.match(markdown, /page 1/);

  const firstLocator = inputs[0].profile.facts.find(fact => fact.field === 'classification.tasks').source.locator;
  const annotation = {
    id: firstLocator.annotationId,
    page: firstLocator.page,
    rects: firstLocator.rects,
    selectedText: firstLocator.quote,
    note: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  assert.equal(resolveEvidenceLocator(firstLocator, firstLocator.documentFingerprint, [annotation]).kind, 'annotation');
  assert.equal(resolveEvidenceLocator(firstLocator, firstLocator.documentFingerprint, []).kind, 'geometry');
  assert.equal(resolveEvidenceLocator(firstLocator, 'another-fingerprint', []).kind, 'wrongDocument');

  const sidecars = await readdir(path.join(libraryRoot, '.inleaf-reader'));
  assert.ok(sidecars.includes('library.index.json'));
  assert.ok(!path.resolve(libraryRoot).startsWith(path.resolve(corpusRoot) + path.sep));
  console.log(`research workspace reference-corpus tests passed (${corpusNames.length || 'synthetic'} source PDFs).`);
} finally {
  Module._load = originalLoad;
}

async function topLevelPdfNames(root) {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries.filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')).map(entry => entry.name).sort();
  } catch {
    return [];
  }
}
