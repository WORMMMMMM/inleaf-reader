import type { ScaledPosition } from 'react-pdf-highlighter-plus';
import { highlighterPositionToRects } from './annotationModel';
import type { AnnotationRecord, EvidenceLocator } from './types';

export function selectionToEvidenceLocator(
  documentFingerprint: string,
  selection: {
    selectedText: string;
    selectionPosition?: ScaledPosition;
    currentPage: number;
    contextBefore?: string;
    contextAfter?: string;
  }
): EvidenceLocator | undefined {
  const quote = selection.selectedText.replace(/\s+/g, ' ').trim();
  if (!documentFingerprint || !quote) return undefined;
  return {
    schemaVersion: 1,
    documentFingerprint,
    page: selection.selectionPosition?.boundingRect.pageNumber || selection.currentPage,
    rects: selection.selectionPosition
      ? highlighterPositionToRects(selection.selectionPosition)
      : undefined,
    quote,
    contextBefore: cleanOptional(selection.contextBefore),
    contextAfter: cleanOptional(selection.contextAfter)
  };
}

export function annotationToEvidenceLocator(
  documentFingerprint: string,
  annotation: AnnotationRecord
): EvidenceLocator {
  return {
    schemaVersion: 1,
    documentFingerprint,
    annotationId: annotation.id,
    page: annotation.page
      || annotation.rects?.[0]?.page
      || annotation.highlighterPosition?.boundingRect.pageNumber
      || 1,
    rects: annotation.rects,
    quote: annotation.selectedText.replace(/\s+/g, ' ').trim(),
    contextBefore: cleanOptional(annotation.contextBefore),
    contextAfter: cleanOptional(annotation.contextAfter)
  };
}

function cleanOptional(value?: string) {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized || undefined;
}
