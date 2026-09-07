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

const SAME_LINE_CENTER_TOLERANCE = 0.55;
const MAX_INLINE_GAP_IN_LINE_HEIGHTS = 1.5;
const MIN_INLINE_GAP_RATIO = 0.002;

/**
 * PDF text layers often split one visual line into several neighboring spans.
 * Coalesce only nearby spans on the same line so a saved selection reads as one
 * continuous highlight without bridging columns or unrelated text.
 */
export function coalesceTextHighlightPosition(position: ScaledPosition): ScaledPosition {
  if (position.usePdfCoordinates || position.rects.length < 2) {
    return position;
  }

  const lines: Array<Array<ScaledPosition['rects'][number]>> = [];
  for (const rect of [...position.rects].sort(compareScaledRects)) {
    let line: Array<ScaledPosition['rects'][number]> | undefined;
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      if (sameVisualLine(lines[index][0], rect)) {
        line = lines[index];
        break;
      }
    }
    if (line) {
      line.push(rect);
    } else {
      lines.push([rect]);
    }
  }

  const rects = lines.flatMap(line => {
    const merged: ScaledPosition['rects'] = [];
    for (const rect of line.sort(compareScaledRectsHorizontally)) {
      const previous = merged.at(-1);
      if (!previous || !hasNearbyHorizontalGap(previous, rect)) {
        merged.push({ ...rect });
        continue;
      }
      previous.x1 = Math.min(previous.x1, rect.x1);
      previous.y1 = Math.min(previous.y1, rect.y1);
      previous.x2 = Math.max(previous.x2, rect.x2);
      previous.y2 = Math.max(previous.y2, rect.y2);
    }
    return merged;
  });

  if (rects.length === position.rects.length) {
    return position;
  }

  return {
    ...position,
    boundingRect: boundingRectFromRects(rects, position.boundingRect),
    rects
  };
}

export function annotationToHighlight(annotation: AnnotationRecord): ReaderHighlight | undefined {
  const storedPosition = annotation.highlighterPosition || rectsToHighlighterPosition(annotation.rects);
  if (!storedPosition) {
    return undefined;
  }
  const position = coalesceTextHighlightPosition(storedPosition);
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
  const selectionPosition = selection.selectionPosition
    ? coalesceTextHighlightPosition(selection.selectionPosition)
    : undefined;
  return {
    page: selectionPosition?.boundingRect.pageNumber || selection.currentPage,
    selectedText: selection.selectedText,
    note,
    tags: [] as string[],
    color: options.color,
    kind: options.kind,
    highlighterPosition: selectionPosition,
    rects: selectionPosition
      ? highlighterPositionToRects(selectionPosition)
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

function compareScaledRects(left: ScaledPosition['rects'][number], right: ScaledPosition['rects'][number]) {
  return left.pageNumber - right.pageNumber
    || rectCenterY(left) - rectCenterY(right)
    || compareScaledRectsHorizontally(left, right);
}

function compareScaledRectsHorizontally(
  left: ScaledPosition['rects'][number],
  right: ScaledPosition['rects'][number]
) {
  return safeRatio(left.x1, left.width) - safeRatio(right.x1, right.width);
}

function sameVisualLine(
  left: ScaledPosition['rects'][number],
  right: ScaledPosition['rects'][number]
) {
  if (left.pageNumber !== right.pageNumber) return false;
  const leftHeight = safeRatio(left.y2 - left.y1, left.height);
  const rightHeight = safeRatio(right.y2 - right.y1, right.height);
  const lineHeight = Math.max(leftHeight, rightHeight);
  return Math.abs(rectCenterY(left) - rectCenterY(right))
    <= lineHeight * SAME_LINE_CENTER_TOLERANCE;
}

function hasNearbyHorizontalGap(
  left: ScaledPosition['rects'][number],
  right: ScaledPosition['rects'][number]
) {
  const leftHeight = safeRatio(left.y2 - left.y1, left.height);
  const rightHeight = safeRatio(right.y2 - right.y1, right.height);
  const lineHeight = Math.max(leftHeight, rightHeight);
  const horizontalGap = safeRatio(right.x1, right.width) - safeRatio(left.x2, left.width);
  return horizontalGap <= Math.max(MIN_INLINE_GAP_RATIO, lineHeight * MAX_INLINE_GAP_IN_LINE_HEIGHTS);
}

function rectCenterY(rect: ScaledPosition['rects'][number]) {
  return safeRatio(rect.y1 + rect.y2, rect.height * 2);
}

function boundingRectFromRects(
  rects: ScaledPosition['rects'],
  fallback: ScaledPosition['boundingRect']
) {
  const firstPage = Math.min(...rects.map(rect => rect.pageNumber));
  const pageRects = rects.filter(rect => rect.pageNumber === firstPage);
  const reference = pageRects[0];
  if (!reference) return fallback;
  return {
    x1: Math.min(...pageRects.map(rect => rect.x1)),
    y1: Math.min(...pageRects.map(rect => rect.y1)),
    x2: Math.max(...pageRects.map(rect => rect.x2)),
    y2: Math.max(...pageRects.map(rect => rect.y2)),
    width: reference.width,
    height: reference.height,
    pageNumber: firstPage
  };
}
