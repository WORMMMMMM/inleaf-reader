import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import { copyFile, mkdir, mkdtemp, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

class FileSystemError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

class Uri {
  constructor(fsPath) {
    this.fsPath = fsPath;
  }
  static file(value) {
    return new Uri(value);
  }
  static joinPath(base, ...parts) {
    return new Uri(path.join(base.fsPath, ...parts));
  }
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
      copy: (source, destination, options) => copyFile(
        source.fsPath,
        destination.fsPath,
        options?.overwrite ? 0 : 1
      ),
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
  const { ReaderStorage } = require('../out/readerStorage.js');
  const directory = await mkdtemp(path.join(os.tmpdir(), 'reading-extension-storage-'));
  const pdfPath = path.join(directory, 'paper.pdf');
  await writeFile(pdfPath, Buffer.from('%PDF test'));
  const values = new Map();
  const memento = {
    get(key, fallback) { return values.has(key) ? values.get(key) : fallback; },
    async update(key, value) { values.set(key, value); }
  };
  const storage = new ReaderStorage(Uri.file(pdfPath), memento);

  await Promise.all(Array.from({ length: 12 }, (_, index) => storage.addAnnotation({
    page: 1,
    selectedText: `selection-${index}`,
    note: '',
    color: '#ffd654',
    kind: 'highlight'
  })));

  const sidecar = path.join(directory, '.reading-extension', 'paper.pdf.annotations.json');
  const annotations = JSON.parse(await readFile(sidecar, 'utf8'));
  assert.equal(annotations.length, 12, 'serialized concurrent writes must retain every annotation');
  assert.ok((await stat(`${sidecar}.bak`)).size > 0, 'a previous valid JSON backup should be retained');

  await writeFile(sidecar, '{broken json');
  const reopened = new ReaderStorage(Uri.file(pdfPath), memento);
  await assert.rejects(() => reopened.readAnnotations(), /Could not read reader data/);

  console.log('reader storage regression passed.');
} finally {
  Module._load = originalLoad;
}
