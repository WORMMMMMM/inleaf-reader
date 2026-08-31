import * as path from 'path';
import * as vscode from 'vscode';
import { applyAnnotationsToPdf, formatAnnotationsMarkdown } from './annotationExports';
import { AnnotationRecord } from './annotationTypes';
import type { ProgressRecord, WordRecord } from './readerDataTypes';
import { INLEAF_IDS } from './identity';
import {
  addLocationToIndex,
  createPdfLocation,
  fingerprintPdf,
  getSidecarPaths,
  PdfLocation,
  PdfLocationIndex,
  PDF_LOCATION_INDEX_KEY,
  SIDECAR_KINDS
} from './pdfIdentity';
import {
  decodeAnnotations,
  decodeProgress,
  decodeWords,
  DecodedSidecar,
  encodeAnnotations,
  encodeProgress,
  encodeWords
} from './sidecarSchemas';

export type { AnnotationKind, AnnotationRecord, AnnotationRect } from './annotationTypes';
export type { ProgressRecord, WordDefinition, WordRecord, WordReview } from './readerDataTypes';

export interface StoragePreparationResult {
  recoveredFrom?: string;
  recoveredFiles: number;
}

export interface DataRecoveryNotice {
  backupPath: string;
  corruptPath: string;
  restoredPath: string;
}

// Read-only migration source for data written before the Inleaf identity change.
const LEGACY_SIDECAR_DIRECTORY = '.reading-extension';

export class ReaderStorage {
  private readonly storageDir: vscode.Uri;
  private readonly baseName: string;
  private readonly location: PdfLocation;
  private preparation?: Promise<StoragePreparationResult>;
  private annotationsCache?: Promise<AnnotationRecord[]>;
  private wordsCache?: Promise<WordRecord[]>;
  private progressCache?: Promise<ProgressRecord>;
  private mutationQueue: Promise<void> = Promise.resolve();
  private dataRecoveryNotices: DataRecoveryNotice[] = [];

  constructor(
    private readonly pdfUri: vscode.Uri,
    private readonly globalState: vscode.Memento
  ) {
    this.baseName = path.basename(pdfUri.fsPath);
    this.storageDir = vscode.Uri.file(path.join(path.dirname(pdfUri.fsPath), INLEAF_IDS.sidecarDirectory));
    this.location = createPdfLocation(pdfUri.fsPath);
  }

  prepare() {
    this.preparation ??= this.prepareInternal();
    return this.preparation;
  }

  async readAnnotations(): Promise<AnnotationRecord[]> {
    await this.mutationQueue;
    return this.loadAnnotations();
  }

  async readWords(): Promise<WordRecord[]> {
    await this.mutationQueue;
    return this.loadWords();
  }

  async readProgress(): Promise<ProgressRecord> {
    await this.mutationQueue;
    return this.loadProgress();
  }

  consumeDataRecoveryNotices() {
    return this.dataRecoveryNotices.splice(0);
  }

  async addAnnotation(input: Omit<AnnotationRecord, 'id' | 'createdAt' | 'updatedAt'>) {
    return this.enqueueMutation(async () => {
      this.annotationsCache = undefined;
      const now = new Date().toISOString();
      const annotations = await this.loadAnnotations();
      const updated = [{
        ...input,
        color: input.color ?? '#ffd654',
        kind: input.kind ?? 'highlight',
        id: cryptoRandomId(),
        createdAt: now,
        updatedAt: now
      }, ...annotations];
      await this.writeJson(this.fileUri('annotations'), encodeAnnotations(updated));
      this.annotationsCache = Promise.resolve(updated);
      return updated;
    });
  }

  async updateAnnotation(
    id: string,
    patch: Partial<Omit<AnnotationRecord, 'id' | 'createdAt' | 'updatedAt'>>
  ) {
    return this.enqueueMutation(async () => {
      this.annotationsCache = undefined;
      const annotations = await this.loadAnnotations();
      const updated = annotations.map(annotation => annotation.id === id
        ? { ...annotation, ...patch, updatedAt: new Date().toISOString() }
        : annotation);
      if (updated.every((annotation, index) => annotation === annotations[index])) {
        return annotations;
      }
      await this.writeJson(this.fileUri('annotations'), encodeAnnotations(updated));
      this.annotationsCache = Promise.resolve(updated);
      return updated;
    });
  }

  async deleteAnnotation(id: string) {
    return this.enqueueMutation(async () => {
      this.annotationsCache = undefined;
      const annotations = await this.loadAnnotations();
      const updated = annotations.filter(item => item.id !== id);
      await this.writeJson(this.fileUri('annotations'), encodeAnnotations(updated));
      this.annotationsCache = Promise.resolve(updated);
      return updated;
    });
  }

  async restoreAnnotation(record: AnnotationRecord) {
    return this.enqueueMutation(async () => {
      this.annotationsCache = undefined;
      const annotations = await this.loadAnnotations();
      if (annotations.some(item => item.id === record.id)) {
        return annotations;
      }
      const updated = [record, ...annotations];
      await this.writeJson(this.fileUri('annotations'), encodeAnnotations(updated));
      this.annotationsCache = Promise.resolve(updated);
      return updated;
    });
  }

  async exportAnnotationsMarkdown() {
    const annotations = await this.readAnnotations();
    const markdown = formatAnnotationsMarkdown(this.baseName, annotations);
    const uri = this.fileUri('annotations.md');
    await this.writeText(uri, markdown);
    return uri;
  }

  async exportAnnotatedPdf() {
    const [pdfBytes, annotations] = await Promise.all([
      vscode.workspace.fs.readFile(this.pdfUri),
      this.readAnnotations()
    ]);
    const exportedBytes = await applyAnnotationsToPdf(pdfBytes, annotations);
    const uri = this.fileUri('annotated.pdf');
    await this.prepare();
    await vscode.workspace.fs.writeFile(uri, exportedBytes);
    return uri;
  }

  async addWord(input: Omit<WordRecord, 'id' | 'createdAt' | 'updatedAt'>) {
    return this.enqueueMutation(async () => {
      this.wordsCache = undefined;
      const now = new Date().toISOString();
      const words = await this.loadWords();
      const updated = [{
        ...input,
        id: cryptoRandomId(),
        createdAt: now,
        updatedAt: now
      }, ...words];
      await this.writeJson(this.fileUri('wordbook'), encodeWords(updated));
      this.wordsCache = Promise.resolve(updated);
      return updated;
    });
  }

  async deleteWord(id: string) {
    return this.enqueueMutation(async () => {
      this.wordsCache = undefined;
      const words = await this.loadWords();
      const updated = words.filter(item => item.id !== id);
      await this.writeJson(this.fileUri('wordbook'), encodeWords(updated));
      this.wordsCache = Promise.resolve(updated);
      return updated;
    });
  }

  async saveProgress(progress: ProgressRecord) {
    return this.enqueueMutation(async () => {
      this.progressCache = undefined;
      const updated = { ...progress, updatedAt: new Date().toISOString() };
      await this.writeJson(this.fileUri('progress'), encodeProgress(updated));
      this.progressCache = Promise.resolve(updated);
      return updated;
    });
  }

  private loadAnnotations() {
    this.annotationsCache ??= this.readSidecar(
      this.fileUri('annotations'),
      [],
      decodeAnnotations,
      encodeAnnotations
    ).catch(error => {
      this.annotationsCache = undefined;
      throw error;
    });
    return this.annotationsCache;
  }

  private loadWords() {
    this.wordsCache ??= this.readSidecar(
      this.fileUri('wordbook'),
      [],
      decodeWords,
      encodeWords
    ).catch(error => {
      this.wordsCache = undefined;
      throw error;
    });
    return this.wordsCache;
  }

  private loadProgress() {
    this.progressCache ??= this.readSidecar(
      this.fileUri('progress'),
      { updatedAt: new Date(0).toISOString() },
      decodeProgress,
      encodeProgress
    ).catch(error => {
      this.progressCache = undefined;
      throw error;
    });
    return this.progressCache;
  }

  private enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.mutationQueue.then(operation, operation);
    this.mutationQueue = next.then(() => undefined, () => undefined);
    return next;
  }

  private fileUri(kind: 'annotations' | 'annotations.md' | 'annotated.pdf' | 'wordbook' | 'progress') {
    const extension = kind === 'annotations.md' ? 'md' : kind === 'annotated.pdf' ? 'pdf' : 'json';
    const stem = kind === 'annotations.md' ? 'annotations' : kind === 'annotated.pdf' ? 'annotated' : kind;
    return vscode.Uri.joinPath(this.storageDir, `${this.baseName}.${stem}.${extension}`);
  }

  private async readSidecar<T>(
    uri: vscode.Uri,
    fallback: T,
    decode: (input: unknown) => DecodedSidecar<T>,
    encode: (value: T) => unknown
  ): Promise<T> {
    await this.prepare();
    try {
      const decoded = decode(await this.readJsonValue(uri));
      if (decoded.migrated) {
        await this.writeJson(uri, encode(decoded.value));
      }
      return decoded.value;
    } catch (error) {
      if (isFileNotFound(error)) {
        return fallback;
      }
      return this.recoverSidecar(uri, decode, encode, error);
    }
  }

  private async recoverSidecar<T>(
    uri: vscode.Uri,
    decode: (input: unknown) => DecodedSidecar<T>,
    encode: (value: T) => unknown,
    primaryError: unknown
  ) {
    const backupUri = vscode.Uri.file(`${uri.fsPath}.bak`);
    try {
      const backup = decode(await this.readJsonValue(backupUri));
      const corruptUri = vscode.Uri.file(`${uri.fsPath}.corrupt-${recoveryTimestamp()}`);
      await vscode.workspace.fs.rename(uri, corruptUri, { overwrite: false });
      await this.writeJson(uri, encode(backup.value), false);
      this.dataRecoveryNotices.push({
        backupPath: backupUri.fsPath,
        corruptPath: corruptUri.fsPath,
        restoredPath: uri.fsPath
      });
      return backup.value;
    } catch (backupError) {
      const primaryDetail = errorMessage(primaryError);
      const backupDetail = errorMessage(backupError);
      throw new Error(
        `Could not read reader data at ${uri.fsPath}: ${primaryDetail} ` +
        `Recovery from ${backupUri.fsPath} also failed: ${backupDetail}`
      );
    }
  }

  private async readJsonValue(uri: vscode.Uri) {
    const bytes = await vscode.workspace.fs.readFile(uri);
    return JSON.parse(Buffer.from(bytes).toString('utf8')) as unknown;
  }

  private async writeJson(uri: vscode.Uri, value: unknown, keepBackup = true) {
    await this.prepare();
    const bytes = Buffer.from(JSON.stringify(value, null, 2), 'utf8');
    const temporaryUri = vscode.Uri.file(`${uri.fsPath}.tmp-${cryptoRandomId()}`);
    try {
      await vscode.workspace.fs.writeFile(temporaryUri, bytes);
      if (keepBackup && await uriExists(uri)) {
        await vscode.workspace.fs.copy(uri, vscode.Uri.file(`${uri.fsPath}.bak`), { overwrite: true });
      }
      await vscode.workspace.fs.rename(temporaryUri, uri, { overwrite: true });
    } catch (error) {
      try {
        await vscode.workspace.fs.delete(temporaryUri);
      } catch {
        // The temporary file may not have been created.
      }
      throw error;
    }
  }

  private async writeText(uri: vscode.Uri, value: string) {
    await this.prepare();
    await vscode.workspace.fs.writeFile(uri, Buffer.from(value, 'utf8'));
  }

  private async prepareInternal(): Promise<StoragePreparationResult> {
    await vscode.workspace.fs.createDirectory(this.storageDir);

    const legacyLocation: PdfLocation = {
      pdfPath: this.location.pdfPath,
      storageDir: path.join(path.dirname(this.pdfUri.fsPath), LEGACY_SIDECAR_DIRECTORY),
      baseName: this.baseName,
      updatedAt: new Date(0).toISOString()
    };
    let recoveredFiles = await this.copyMissingSidecars(legacyLocation);
    let recoveredFrom = recoveredFiles > 0 ? legacyLocation.storageDir : undefined;

    let fingerprint: string;
    try {
      fingerprint = await fingerprintPdf(this.pdfUri.fsPath);
    } catch {
      return { recoveredFrom, recoveredFiles };
    }

    const index = this.globalState.get<PdfLocationIndex>(PDF_LOCATION_INDEX_KEY, {});
    const candidates = (index[fingerprint] ?? [])
      .filter(candidate => path.resolve(candidate.pdfPath) !== this.location.pdfPath)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    for (const candidate of candidates) {
      const copied = await this.copyMissingSidecars(candidate);
      if (copied > 0) {
        recoveredFrom ??= candidate.pdfPath;
        recoveredFiles += copied;
      }
    }

    await this.globalState.update(
      PDF_LOCATION_INDEX_KEY,
      addLocationToIndex(index, fingerprint, this.location)
    );
    return { recoveredFrom, recoveredFiles };
  }

  private async copyMissingSidecars(sourceLocation: PdfLocation) {
    const destinationPaths = getSidecarPaths(this.location);
    const possibleSources = [
      sourceLocation,
      {
        ...sourceLocation,
        storageDir: this.location.storageDir
      }
    ].filter(
      (candidate, index, locations) =>
        locations.findIndex(
          location =>
            location.storageDir === candidate.storageDir &&
            location.baseName === candidate.baseName
        ) === index
    );
    let copied = 0;

    for (const sourceLocationCandidate of possibleSources) {
      const sourcePaths = getSidecarPaths(sourceLocationCandidate);
      for (const kind of SIDECAR_KINDS) {
        const source = vscode.Uri.file(sourcePaths[kind]);
        const destination = vscode.Uri.file(destinationPaths[kind]);
        if (!(await uriExists(source)) || (await uriExists(destination))) {
          continue;
        }

        try {
          await vscode.workspace.fs.copy(source, destination, { overwrite: false });
          copied += 1;
        } catch (error) {
          if (!(await uriExists(destination))) {
            throw error;
          }
        }
      }
    }

    return copied;
  }
}

async function uriExists(uri: vscode.Uri) {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

function cryptoRandomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isFileNotFound(error: unknown) {
  return error instanceof vscode.FileSystemError && error.code === 'FileNotFound';
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function recoveryTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}
