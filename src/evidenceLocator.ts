import type { AnnotationRecord, AnnotationRect } from './annotationTypes';
import type { EvidenceFocusTarget, EvidenceLocator } from './researchTypes';

export interface SelectionEvidence {
  page: number;
  rects?: AnnotationRect[];
  quote: string;
  contextBefore?: string;
  contextAfter?: string;
}

export function locatorFromSelection(
  documentFingerprint: string,
  selection: SelectionEvidence
): EvidenceLocator {
  return normalizeLocator({
    schemaVersion: 1,
    documentFingerprint,
    page: selection.page,
    rects: selection.rects,
    quote: selection.quote,
    contextBefore: selection.contextBefore,
    contextAfter: selection.contextAfter
  });
}

export function locatorFromAnnotation(
  documentFingerprint: string,
  annotation: AnnotationRecord
): EvidenceLocator {
  const page = annotation.page
    || annotation.rects?.[0]?.page
    || annotation.highlighterPosition?.boundingRect.pageNumber
    || 1;
  return normalizeLocator({
    schemaVersion: 1,
    documentFingerprint,
    annotationId: annotation.id,
    page,
    rects: annotation.rects,
    quote: annotation.selectedText,
    contextBefore: annotation.contextBefore,
    contextAfter: annotation.contextAfter
  });
}

export function resolveEvidenceLocator(
  locator: EvidenceLocator,
  currentDocumentFingerprint: string,
  annotations: AnnotationRecord[]
): EvidenceFocusTarget {
  const normalized = normalizeLocator(locator);
  if (normalized.documentFingerprint !== currentDocumentFingerprint) {
    return {
      kind: 'wrongDocument',
      reason: '此证据属于另一份 PDF。',
      locator: normalized
    };
  }

  if (normalized.annotationId) {
    const annotation = annotations.find(item => item.id === normalized.annotationId);
    if (annotation) {
      return {
        kind: 'annotation',
        annotationId: annotation.id,
        page: annotation.page || normalized.page,
        locator: normalized
      };
    }
  }

  if (normalized.rects?.length) {
    return {
      kind: 'geometry',
      page: normalized.page,
      rects: normalized.rects,
      locator: normalized
    };
  }

  if (normalized.quote) {
    return { kind: 'quote', page: normalized.page, locator: normalized };
  }

  return {
    kind: 'sourceMissing',
    page: normalized.page,
    reason: normalized.annotationId
      ? '来源标注已删除，且没有可用的引用文本或几何位置作为回退。'
      : '此证据不包含可用的标注、几何位置或引用文本。',
    locator: normalized
  };
}

export function normalizeLocator(locator: EvidenceLocator): EvidenceLocator {
  const page = Number.isFinite(locator.page) && locator.page > 0 ? Math.floor(locator.page) : 1;
  const rects = locator.rects
    ?.filter(rect => validRect(rect))
    .map(rect => ({
      page: Number.isFinite(rect.page) && rect.page > 0 ? Math.floor(rect.page) : page,
      x: clamp(rect.x),
      y: clamp(rect.y),
      width: clamp(rect.width),
      height: clamp(rect.height)
    }));
  return {
    schemaVersion: 1,
    documentFingerprint: locator.documentFingerprint.trim(),
    annotationId: locator.annotationId?.trim() || undefined,
    page,
    rects: rects?.length ? rects : undefined,
    quote: normalizeText(locator.quote),
    contextBefore: normalizeOptionalText(locator.contextBefore),
    contextAfter: normalizeOptionalText(locator.contextAfter)
  };
}

function validRect(rect: AnnotationRect) {
  return rect && [rect.page, rect.x, rect.y, rect.width, rect.height].every(Number.isFinite);
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

function normalizeOptionalText(value?: string) {
  const normalized = normalizeText(value || '');
  return normalized || undefined;
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}
