import type { AnnotationRecord } from '../../annotationTypes';
import { decodeAnnotations } from '../../sidecarSchemas';
import { isRecord } from '../contracts';

export type AnnotationCapabilityRequest =
  | { action: 'save'; payload: Omit<AnnotationRecord, 'id' | 'createdAt' | 'updatedAt'> }
  | {
      action: 'update';
      payload: {
        id: string;
        patch: Partial<Omit<AnnotationRecord, 'id' | 'createdAt' | 'updatedAt'>>;
      };
    }
  | { action: 'delete'; payload: { id: string } }
  | { action: 'restore'; payload: AnnotationRecord }
  | { action: 'copyMarkdown'; payload: { id: string } }
  | { action: 'exportMarkdown'; payload?: undefined }
  | { action: 'exportPdf'; payload?: undefined };

export type AnnotationCapabilityEvent =
  | { event: 'state'; payload: { annotations: AnnotationRecord[] } }
  | { event: 'result'; payload: { message?: string; path?: string } };

export function decodeAnnotationRequest(action: string, payload: unknown): AnnotationCapabilityRequest {
  switch (action) {
    case 'save':
      return { action, payload: requireAnnotationDraft(payload) };
    case 'update': {
      const value = requireRecord(payload, 'annotation update');
      return {
        action,
        payload: {
          id: requireString(value.id, 'annotation id'),
          patch: sanitizeAnnotationInput(requireRecord(value.patch, 'annotation patch'))
        }
      };
    }
    case 'delete':
    case 'copyMarkdown': {
      const value = requireRecord(payload, action);
      return { action, payload: { id: requireString(value.id, 'annotation id') } };
    }
    case 'restore':
      return { action, payload: parseAnnotationRecord(payload) };
    case 'exportMarkdown':
    case 'exportPdf':
      return { action };
    default:
      throw new Error(`Unsupported annotation action: ${action}`);
  }
}

function requireAnnotationDraft(value: unknown) {
  const record = requireRecord(value, 'annotation');
  requireString(record.selectedText, 'selected text');
  if (typeof record.note !== 'string') {
    throw new Error('Invalid annotation note.');
  }
  return sanitizeAnnotationInput(record) as Extract<AnnotationCapabilityRequest, { action: 'save' }>['payload'];
}

const MUTABLE_ANNOTATION_FIELDS = [
  'page',
  'rects',
  'highlighterPosition',
  'color',
  'kind',
  'tags',
  'contextBefore',
  'contextAfter',
  'selectedText',
  'note'
] as const;

function sanitizeAnnotationInput(record: Record<string, unknown>) {
  const timestamp = new Date(0).toISOString();
  const parsed = decodeAnnotations({
    schemaVersion: 1,
    annotations: [{
      ...record,
      id: 'capability-validation',
      selectedText: record.selectedText ?? '',
      note: record.note ?? '',
      createdAt: timestamp,
      updatedAt: timestamp
    }]
  }).value[0];
  return Object.fromEntries(
    MUTABLE_ANNOTATION_FIELDS
      .filter(field => Object.prototype.hasOwnProperty.call(record, field))
      .map(field => [field, parsed[field]])
  ) as Partial<Omit<AnnotationRecord, 'id' | 'createdAt' | 'updatedAt'>>;
}

function parseAnnotationRecord(value: unknown) {
  return decodeAnnotations({ schemaVersion: 1, annotations: [value] }).value[0];
}

function requireRecord(value: unknown, label: string) {
  if (!isRecord(value)) {
    throw new Error(`Invalid ${label} payload.`);
  }
  return value;
}

function requireString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid ${label}.`);
  }
  return value;
}
