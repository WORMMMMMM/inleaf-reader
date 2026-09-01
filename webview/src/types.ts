import type { ScaledPosition } from 'react-pdf-highlighter-plus';

export type AnnotationKind = 'highlight' | 'underline';

export interface AnnotationRecord {
  id: string;
  page?: number;
  rects?: AnnotationRect[];
  highlighterPosition?: ScaledPosition;
  color?: string;
  kind?: AnnotationKind;
  tags?: string[];
  contextBefore?: string;
  contextAfter?: string;
  selectedText: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnnotationRect {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

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

export interface ReaderStatePayload {
  progress: ProgressRecord;
  paperName: string;
}

export interface WordDetails {
  word: string;
  phonetic?: string;
  definitions: WordDefinition[];
}
