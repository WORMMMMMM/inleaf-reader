import * as path from 'path';
import * as vscode from 'vscode';
import { applyAnnotationsToPdf, formatAnnotationsMarkdown } from './annotationExports';
import { AnnotationRecord } from './annotationTypes';
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

export type { AnnotationKind, AnnotationRecord, AnnotationRect } from './annotationTypes';

export interface WordRecord {
  id: string;
  word: string;
  translation?: string;
  phonetic?: string;
  definitions?: WordDefinition[];
  sentence?: string;
  note?: string;
  page?: number;
  review?: WordReview;
  createdAt: string;
  updatedAt: string;
}

export interface WordReview {
  level: number;
  nextReviewAt: string;
  lastReviewedAt?: string;
}

export interface WordDefinition {
  pos: string;
  meaning: string;
  translation?: string;
}

export interface ProgressRecord {
  page?: number;
  updatedAt: string;
}

export interface StoragePreparationResult {
  recoveredFrom?: string;
  recoveredFiles: number;
}

export class ReaderStorage {
  private readonly storageDir: vscode.Uri;
  private readonly baseName: string;
  private readonly location: PdfLocation;
  private preparation?: Promise<StoragePreparationResult>;
  private annotationsCache?: Promise<AnnotationRecord[]>;
  private wordsCache?: Promise<WordRecord[]>;
  private progressCache?: Promise<ProgressRecord>;
  private mutationQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly pdfUri: vscode.Uri,
    private readonly globalState: vscode.Memento
  ) {
    this.baseName = path.basename(pdfUri.fsPath);
    this.storageDir = vscode.Uri.file(path.join(path.dirname(pdfUri.fsPath), '.reading-extension'));
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
      await this.writeJson(this.fileUri('annotations'), updated);
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
      await this.writeJson(this.fileUri('annotations'), updated);
      this.annotationsCache = Promise.resolve(updated);
      return updated;
    });
  }

  async deleteAnnotation(id: string) {
    return this.enqueueMutation(async () => {
      this.annotationsCache = undefined;
      const annotations = await this.loadAnnotations();
      const updated = annotations.filter(item => item.id !== id);
      await this.writeJson(this.fileUri('annotations'), updated);
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
      await this.writeJson(this.fileUri('annotations'), updated);
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
      await this.writeJson(this.fileUri('wordbook'), updated);
      this.wordsCache = Promise.resolve(updated);
      return updated;
    });
  }

  async deleteWord(id: string) {
    return this.enqueueMutation(async () => {
      this.wordsCache = undefined;
      const words = await this.loadWords();
      const updated = words.filter(item => item.id !== id);
      await this.writeJson(this.fileUri('wordbook'), updated);
      this.wordsCache = Promise.resolve(updated);
      return updated;
    });
  }

  async saveProgress(progress: ProgressRecord) {
    return this.enqueueMutation(async () => {
      this.progressCache = undefined;
      const updated = { ...progress, updatedAt: new Date().toISOString() };
      await this.writeJson(this.fileUri('progress'), updated, false);
      this.progressCache = Promise.resolve(updated);
      return updated;
    });
  }

  private loadAnnotations() {
    this.annotationsCache ??= this.readJson<AnnotationRecord[]>(this.fileUri('annotations'), []).catch(error => {
      this.annotationsCache = undefined;
      throw error;
    });
    return this.annotationsCache;
  }

  private loadWords() {
    this.wordsCache ??= this.readJson<WordRecord[]>(this.fileUri('wordbook'), []).catch(error => {
      this.wordsCache = undefined;
      throw error;
    });
    return this.wordsCache;
  }

  private loadProgress() {
    this.progressCache ??= this.readJson<ProgressRecord>(this.fileUri('progress'), {
      updatedAt: new Date(0).toISOString()
    }).catch(error => {
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

  private async readJson<T>(uri: vscode.Uri, fallback: T): Promise<T> {
    await this.prepare();
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      return JSON.parse(Buffer.from(bytes).toString('utf8')) as T;
    } catch (error) {
      if (isFileNotFound(error)) {
        return fallback;
      }
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Could not read reader data at ${uri.fsPath}: ${detail}. ` +
        `The previous valid version may be available at ${uri.fsPath}.bak.`
      );
    }
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

    let fingerprint: string;
    try {
      fingerprint = await fingerprintPdf(this.pdfUri.fsPath);
    } catch {
      return { recoveredFiles: 0 };
    }

    const index = this.globalState.get<PdfLocationIndex>(PDF_LOCATION_INDEX_KEY, {});
    const candidates = (index[fingerprint] ?? [])
      .filter(candidate => path.resolve(candidate.pdfPath) !== this.location.pdfPath)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    let recoveredFrom: string | undefined;
    let recoveredFiles = 0;
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
