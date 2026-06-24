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
    return this.readJson<AnnotationRecord[]>(this.fileUri('annotations'), []);
  }

  async readWords(): Promise<WordRecord[]> {
    return this.readJson<WordRecord[]>(this.fileUri('wordbook'), []);
  }

  async readProgress(): Promise<ProgressRecord> {
    return this.readJson<ProgressRecord>(this.fileUri('progress'), {
      updatedAt: new Date(0).toISOString()
    });
  }

  async addAnnotation(input: Omit<AnnotationRecord, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString();
    const annotations = await this.readAnnotations();
    annotations.unshift({
      ...input,
      color: input.color ?? '#ffd654',
      kind: input.kind ?? 'highlight',
      id: cryptoRandomId(),
      createdAt: now,
      updatedAt: now
    });
    await this.writeJson(this.fileUri('annotations'), annotations);
  }

  async updateAnnotation(
    id: string,
    patch: Partial<Omit<AnnotationRecord, 'id' | 'createdAt' | 'updatedAt'>>
  ) {
    const annotations = await this.readAnnotations();
    const annotation = annotations.find(item => item.id === id);
    if (!annotation) {
      return;
    }

    Object.assign(annotation, patch, {
      updatedAt: new Date().toISOString()
    });
    await this.writeJson(this.fileUri('annotations'), annotations);
  }

  async deleteAnnotation(id: string) {
    const annotations = await this.readAnnotations();
    await this.writeJson(
      this.fileUri('annotations'),
      annotations.filter(item => item.id !== id)
    );
  }

  async restoreAnnotation(record: AnnotationRecord) {
    const annotations = await this.readAnnotations();
    if (annotations.some(item => item.id === record.id)) {
      return;
    }

    annotations.unshift(record);
    await this.writeJson(this.fileUri('annotations'), annotations);
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
    const now = new Date().toISOString();
    const words = await this.readWords();
    words.unshift({
      ...input,
      id: cryptoRandomId(),
      createdAt: now,
      updatedAt: now
    });
    await this.writeJson(this.fileUri('wordbook'), words);
  }

  async deleteWord(id: string) {
    const words = await this.readWords();
    await this.writeJson(
      this.fileUri('wordbook'),
      words.filter(item => item.id !== id)
    );
  }

  async saveProgress(progress: ProgressRecord) {
    await this.writeJson(this.fileUri('progress'), {
      ...progress,
      updatedAt: new Date().toISOString()
    });
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
    } catch {
      return fallback;
    }
  }

  private async writeJson(uri: vscode.Uri, value: unknown) {
    await this.prepare();
    const bytes = Buffer.from(JSON.stringify(value, null, 2), 'utf8');
    await vscode.workspace.fs.writeFile(uri, bytes);
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
