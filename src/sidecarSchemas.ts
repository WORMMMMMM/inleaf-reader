import type { AnnotationRecord, AnnotationRect, PdfHighlighterScaledRect } from './annotationTypes';
import type { ProgressRecord, WordDefinition, WordRecord, WordReview } from './readerDataTypes';

export const SIDECAR_SCHEMA_VERSION = 1;

export interface DecodedSidecar<T> {
  value: T;
  migrated: boolean;
}

export function decodeAnnotations(input: unknown): DecodedSidecar<AnnotationRecord[]> {
  const { records, migrated } = unwrapCollection(input, 'annotations');
  return {
    value: records.map((record, index) => parseAnnotation(record, `annotations[${index}]`)),
    migrated
  };
}

export function encodeAnnotations(annotations: AnnotationRecord[]) {
  return { schemaVersion: SIDECAR_SCHEMA_VERSION, annotations };
}

export function decodeWords(input: unknown): DecodedSidecar<WordRecord[]> {
  const { records, migrated } = unwrapCollection(input, 'words');
  return {
    value: records.map((record, index) => parseWord(record, `words[${index}]`)),
    migrated
  };
}

export function encodeWords(words: WordRecord[]) {
  return { schemaVersion: SIDECAR_SCHEMA_VERSION, words };
}

export function decodeProgress(input: unknown): DecodedSidecar<ProgressRecord> {
  if (isObject(input) && input.schemaVersion === SIDECAR_SCHEMA_VERSION) {
    return { value: parseProgress(input.progress, 'progress'), migrated: false };
  }
  return { value: parseProgress(input, 'progress'), migrated: true };
}

export function encodeProgress(progress: ProgressRecord) {
  return { schemaVersion: SIDECAR_SCHEMA_VERSION, progress };
}

function unwrapCollection(input: unknown, field: 'annotations' | 'words') {
  if (Array.isArray(input)) {
    return { records: input, migrated: true };
  }
  if (
    isObject(input) &&
    input.schemaVersion === SIDECAR_SCHEMA_VERSION &&
    Array.isArray(input[field])
  ) {
    return { records: input[field], migrated: false };
  }
  throw invalid(field, `expected a legacy array or a schemaVersion ${SIDECAR_SCHEMA_VERSION} document`);
}

function parseAnnotation(input: unknown, location: string): AnnotationRecord {
  const record = requireObject(input, location);
  const result: AnnotationRecord = {
    id: requireNonEmptyString(record.id, `${location}.id`),
    selectedText: requireString(record.selectedText, `${location}.selectedText`),
    note: optionalString(record.note, `${location}.note`) ?? '',
    createdAt: requireTimestamp(record.createdAt, `${location}.createdAt`),
    updatedAt: requireTimestamp(record.updatedAt, `${location}.updatedAt`)
  };
  assignOptional(result, 'page', optionalPositiveNumber(record.page, `${location}.page`));
  assignOptional(result, 'color', optionalString(record.color, `${location}.color`));
  assignOptional(result, 'contextBefore', optionalString(record.contextBefore, `${location}.contextBefore`));
  assignOptional(result, 'contextAfter', optionalString(record.contextAfter, `${location}.contextAfter`));

  if (record.kind !== undefined) {
    if (record.kind !== 'highlight' && record.kind !== 'underline') {
      throw invalid(`${location}.kind`, 'expected highlight or underline');
    }
    result.kind = record.kind;
  }
  if (record.tags !== undefined) {
    if (!Array.isArray(record.tags) || record.tags.some(tag => typeof tag !== 'string')) {
      throw invalid(`${location}.tags`, 'expected an array of strings');
    }
    result.tags = record.tags;
  }
  if (record.rects !== undefined) {
    if (!Array.isArray(record.rects)) {
      throw invalid(`${location}.rects`, 'expected an array');
    }
    result.rects = record.rects.map((rect, index) => parseAnnotationRect(rect, `${location}.rects[${index}]`));
  }
  if (record.highlighterPosition !== undefined) {
    const position = requireObject(record.highlighterPosition, `${location}.highlighterPosition`);
    if (!Array.isArray(position.rects)) {
      throw invalid(`${location}.highlighterPosition.rects`, 'expected an array');
    }
    result.highlighterPosition = {
      boundingRect: parseScaledRect(position.boundingRect, `${location}.highlighterPosition.boundingRect`),
      rects: position.rects.map((rect, index) => parseScaledRect(
        rect,
        `${location}.highlighterPosition.rects[${index}]`
      )),
      ...(position.usePdfCoordinates === undefined
        ? {}
        : { usePdfCoordinates: requireBoolean(position.usePdfCoordinates, `${location}.highlighterPosition.usePdfCoordinates`) })
    };
  }
  return result;
}

function parseWord(input: unknown, location: string): WordRecord {
  const record = requireObject(input, location);
  const result: WordRecord = {
    id: requireNonEmptyString(record.id, `${location}.id`),
    word: requireNonEmptyString(record.word, `${location}.word`),
    createdAt: requireTimestamp(record.createdAt, `${location}.createdAt`),
    updatedAt: requireTimestamp(record.updatedAt, `${location}.updatedAt`)
  };
  assignOptional(result, 'translation', optionalString(record.translation, `${location}.translation`));
  assignOptional(result, 'phonetic', optionalString(record.phonetic, `${location}.phonetic`));
  assignOptional(result, 'sentence', optionalString(record.sentence, `${location}.sentence`));
  assignOptional(result, 'note', optionalString(record.note, `${location}.note`));
  assignOptional(result, 'page', optionalPositiveNumber(record.page, `${location}.page`));

  if (record.definitions !== undefined) {
    if (!Array.isArray(record.definitions)) {
      throw invalid(`${location}.definitions`, 'expected an array');
    }
    result.definitions = record.definitions.map((definition, index) => parseDefinition(
      definition,
      `${location}.definitions[${index}]`
    ));
  }
  if (record.review !== undefined) {
    result.review = parseReview(record.review, `${location}.review`);
  }
  return result;
}

function parseDefinition(input: unknown, location: string): WordDefinition {
  const definition = requireObject(input, location);
  return {
    pos: requireString(definition.pos, `${location}.pos`),
    meaning: requireString(definition.meaning, `${location}.meaning`),
    ...(definition.translation === undefined
      ? {}
      : { translation: requireString(definition.translation, `${location}.translation`) })
  };
}

function parseReview(input: unknown, location: string): WordReview {
  const review = requireObject(input, location);
  return {
    level: requireNonNegativeNumber(review.level, `${location}.level`),
    nextReviewAt: requireTimestamp(review.nextReviewAt, `${location}.nextReviewAt`),
    ...(review.lastReviewedAt === undefined
      ? {}
      : { lastReviewedAt: requireTimestamp(review.lastReviewedAt, `${location}.lastReviewedAt`) })
  };
}

function parseProgress(input: unknown, location: string): ProgressRecord {
  const progress = requireObject(input, location);
  return {
    ...(progress.page === undefined ? {} : { page: optionalPositiveNumber(progress.page, `${location}.page`) }),
    updatedAt: requireTimestamp(progress.updatedAt, `${location}.updatedAt`)
  };
}

function parseAnnotationRect(input: unknown, location: string): AnnotationRect {
  const rect = requireObject(input, location);
  return {
    page: requirePositiveNumber(rect.page, `${location}.page`),
    x: requireFiniteNumber(rect.x, `${location}.x`),
    y: requireFiniteNumber(rect.y, `${location}.y`),
    width: requireNonNegativeNumber(rect.width, `${location}.width`),
    height: requireNonNegativeNumber(rect.height, `${location}.height`)
  };
}

function parseScaledRect(input: unknown, location: string): PdfHighlighterScaledRect {
  const rect = requireObject(input, location);
  return {
    x1: requireFiniteNumber(rect.x1, `${location}.x1`),
    y1: requireFiniteNumber(rect.y1, `${location}.y1`),
    x2: requireFiniteNumber(rect.x2, `${location}.x2`),
    y2: requireFiniteNumber(rect.y2, `${location}.y2`),
    width: requireNonNegativeNumber(rect.width, `${location}.width`),
    height: requireNonNegativeNumber(rect.height, `${location}.height`),
    pageNumber: requirePositiveNumber(rect.pageNumber, `${location}.pageNumber`)
  };
}

function assignOptional<T extends object, K extends keyof T>(target: T, key: K, value: T[K] | undefined) {
  if (value !== undefined) {
    target[key] = value;
  }
}

function requireObject(value: unknown, location: string): Record<string, unknown> {
  if (!isObject(value)) {
    throw invalid(location, 'expected an object');
  }
  return value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, location: string) {
  if (typeof value !== 'string') {
    throw invalid(location, 'expected a string');
  }
  return value;
}

function requireNonEmptyString(value: unknown, location: string) {
  const string = requireString(value, location);
  if (!string.trim()) {
    throw invalid(location, 'must not be empty');
  }
  return string;
}

function optionalString(value: unknown, location: string) {
  return value === undefined ? undefined : requireString(value, location);
}

function requireTimestamp(value: unknown, location: string) {
  const timestamp = requireString(value, location);
  if (Number.isNaN(Date.parse(timestamp))) {
    throw invalid(location, 'expected an ISO-compatible timestamp');
  }
  return timestamp;
}

function requireFiniteNumber(value: unknown, location: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw invalid(location, 'expected a finite number');
  }
  return value;
}

function requireNonNegativeNumber(value: unknown, location: string) {
  const number = requireFiniteNumber(value, location);
  if (number < 0) {
    throw invalid(location, 'must be non-negative');
  }
  return number;
}

function requirePositiveNumber(value: unknown, location: string) {
  const number = requireFiniteNumber(value, location);
  if (number < 1) {
    throw invalid(location, 'must be at least 1');
  }
  return number;
}

function optionalPositiveNumber(value: unknown, location: string) {
  return value === undefined ? undefined : requirePositiveNumber(value, location);
}

function requireBoolean(value: unknown, location: string) {
  if (typeof value !== 'boolean') {
    throw invalid(location, 'expected a boolean');
  }
  return value;
}

function invalid(location: string, expectation: string) {
  return new Error(`Invalid reader data at ${location}: ${expectation}.`);
}
