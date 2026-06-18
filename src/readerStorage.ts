import * as path from 'path';
import * as vscode from 'vscode';
import { applyAnnotationsToPdf, formatAnnotationsMarkdown } from './annotationExports';
import { AnnotationRecord } from './annotationTypes';
import { advanceWordReview, createInitialWordReview } from './wordReview';

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

export class ReaderStorage {
  private readonly storageDir: vscode.Uri;
  private readonly baseName: string;

  constructor(private readonly pdfUri: vscode.Uri) {
    this.baseName = path.basename(pdfUri.fsPath);
    this.storageDir = vscode.Uri.file(path.join(path.dirname(pdfUri.fsPath), '.reading-extension'));
  }

  async ensureStorageDir() {
    await vscode.workspace.fs.createDirectory(this.storageDir);
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
    await this.ensureStorageDir();
    await vscode.workspace.fs.writeFile(uri, exportedBytes);
    return uri;
  }

  async addWord(input: Omit<WordRecord, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString();
    const words = await this.readWords();
    words.unshift({
      ...input,
      id: cryptoRandomId(),
      review: input.review ?? createInitialWordReview(),
      createdAt: now,
      updatedAt: now
    });
    await this.writeJson(this.fileUri('wordbook'), words);
  }

  async updateWordReview(id: string, remembered: boolean) {
    const words = await this.readWords();
    const word = words.find(item => item.id === id);
    if (!word) {
      return;
    }

    const now = new Date();

    word.review = advanceWordReview(word.review, remembered, now);
    word.updatedAt = now.toISOString();

    await this.writeJson(this.fileUri('wordbook'), words);
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
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      return JSON.parse(Buffer.from(bytes).toString('utf8')) as T;
    } catch {
      return fallback;
    }
  }

  private async writeJson(uri: vscode.Uri, value: unknown) {
    await this.ensureStorageDir();
    const bytes = Buffer.from(JSON.stringify(value, null, 2), 'utf8');
    await vscode.workspace.fs.writeFile(uri, bytes);
  }

  private async writeText(uri: vscode.Uri, value: string) {
    await this.ensureStorageDir();
    await vscode.workspace.fs.writeFile(uri, Buffer.from(value, 'utf8'));
  }

}

function cryptoRandomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
