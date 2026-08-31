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
