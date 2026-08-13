import type { Highlight, ScaledPosition } from 'react-pdf-highlighter-plus';
import type { AnnotationKind, AnnotationRecord, AnnotationRect, WordDetails } from './types';

export type ReaderHighlight = Highlight & { annotation?: AnnotationRecord };
export type AnnotationSortMode = 'position' | 'created' | 'updated';

export interface AnnotationFilters {
  query: string;
  tags: string;
  color: string;
  kind: string;
  sort: AnnotationSortMode;
}

export interface SelectionDraft {
  selectedText: string;
  selectionPosition?: ScaledPosition;
  currentPage: number;
}

export interface NewAnnotationOptions {
  color: string;
  kind: AnnotationKind;
  note?: string;
}

export function annotationToHighlight(annotation: AnnotationRecord): ReaderHighlight | undefined {
  const position = annotation.highlighterPosition || rectsToHighlighterPosition(annotation.rects);
  if (!position) {
    return undefined;
  }
  return {
    id: annotation.id,
    type: annotation.selectedText ? 'text' : 'area',
    content: { text: annotation.selectedText || annotation.note },
    position,
    annotation
  };
}

export function highlighterPositionToRects(position: ScaledPosition): AnnotationRect[] {
  const rects = position.rects.length ? position.rects : [position.boundingRect];
  return rects.map(rect => ({
    page: rect.pageNumber,
    x: safeRatio(rect.x1, rect.width),
    y: safeRatio(rect.y1, rect.height),
    width: safeRatio(rect.x2 - rect.x1, rect.width),
    height: safeRatio(rect.y2 - rect.y1, rect.height)
  }));
}

export function rectsToHighlighterPosition(rects?: AnnotationRect[]): ScaledPosition | undefined {
  if (!rects?.length) {
    return undefined;
  }
  const scaledRects = rects.map(rect => ({
    x1: rect.x,
    y1: rect.y,
    x2: rect.x + rect.width,
    y2: rect.y + rect.height,
    width: 1,
    height: 1,
    pageNumber: rect.page
  }));
  const firstPage = scaledRects[0].pageNumber;
  const samePageRects = scaledRects.filter(rect => rect.pageNumber === firstPage);
  return {
    boundingRect: {
      x1: Math.min(...samePageRects.map(rect => rect.x1)),
      y1: Math.min(...samePageRects.map(rect => rect.y1)),
      x2: Math.max(...samePageRects.map(rect => rect.x2)),
      y2: Math.max(...samePageRects.map(rect => rect.y2)),
      width: 1,
      height: 1,
      pageNumber: firstPage
    },
    rects: samePageRects
  };
}

export function filterAnnotations(
  annotations: AnnotationRecord[],
  filters: AnnotationFilters
) {
  const query = filters.query.trim().toLowerCase();
  const tagNeedles = normalizeTags(filters.tags);
  return [...annotations]
    .filter(annotation => {
      const searchableText = [
        annotation.selectedText,
        annotation.note,
        annotation.contextBefore,
        annotation.contextAfter,
        ...(annotation.tags || [])
      ].join(' ').toLowerCase();
      return (!query || searchableText.includes(query))
        && (!tagNeedles.length || tagNeedles.every(tag => (annotation.tags || []).includes(tag)))
        && (!filters.color || (annotation.color || '#ffd654') === filters.color)
        && (!filters.kind || (annotation.kind || 'highlight') === filters.kind);
    })
    .sort((left, right) => compareAnnotations(left, right, filters.sort));
}

export function buildAnnotationPayload(selection: SelectionDraft, options: NewAnnotationOptions) {
  const note = options.note?.trim() || '';
  if (!selection.selectedText.trim() || (options.note !== undefined && !note)) {
    return undefined;
  }
  return {
    page: selection.selectionPosition?.boundingRect.pageNumber || selection.currentPage,
    selectedText: selection.selectedText,
    note,
    tags: [] as string[],
    color: options.color,
    kind: options.kind,
    highlighterPosition: selection.selectionPosition,
    rects: selection.selectionPosition
      ? highlighterPositionToRects(selection.selectionPosition)
      : undefined
  };
}

export function normalizeTags(value: string | string[]) {
  const raw = Array.isArray(value) ? value : value.split(/[,\s#]+/);
  return [...new Set(raw.map(tag => tag.trim().replace(/^#/, '').toLowerCase()).filter(Boolean))];
}

export function summarizeWordDetails(details: WordDetails) {
  const translations = details.definitions
    .map(definition => definition.translation || definition.meaning)
    .map(value => value.trim())
    .filter(Boolean);
  return [...new Set(translations)].slice(0, 4).join('; ');
}

function compareAnnotations(
  left: AnnotationRecord,
  right: AnnotationRecord,
  sort: AnnotationSortMode
) {
  if (sort === 'created') return dateValue(right.createdAt) - dateValue(left.createdAt);
  if (sort === 'updated') return dateValue(right.updatedAt) - dateValue(left.updatedAt);
  const leftPosition = annotationPosition(left);
  const rightPosition = annotationPosition(right);
  return leftPosition.page - rightPosition.page
    || leftPosition.y - rightPosition.y
    || leftPosition.x - rightPosition.x
    || dateValue(left.createdAt) - dateValue(right.createdAt);
}

function annotationPosition(annotation: AnnotationRecord) {
  const rect = annotation.rects?.[0];
  const highlighterRect = annotation.highlighterPosition?.boundingRect;
  return {
    page: rect?.page || highlighterRect?.pageNumber || annotation.page || Number.MAX_SAFE_INTEGER,
    y: rect?.y ?? (highlighterRect ? safeRatio(highlighterRect.y1, highlighterRect.height) : Number.MAX_SAFE_INTEGER),
    x: rect?.x ?? (highlighterRect ? safeRatio(highlighterRect.x1, highlighterRect.width) : Number.MAX_SAFE_INTEGER)
  };
}

function dateValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function safeRatio(value: number, total: number) {
  return total ? value / total : 0;
}
