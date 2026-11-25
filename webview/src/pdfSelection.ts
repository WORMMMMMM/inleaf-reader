import type { ScaledPosition } from 'react-pdf-highlighter-plus';

const PAGE_VERTICAL_MARGIN_SELECTION_RATIO = 0.08;
const PAGE_HORIZONTAL_MARGIN_SELECTION_RATIO = 0.04;
const FIGURE_CAPTION_PATTERN = /^(?:figure|fig\.|图)\s*\d+/i;
const CJK_CHAR_RE = /[\u2e80-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/;
const SENTENCE_END_RE = /[.!?。！？\n]/;

interface NormalizedPageRegion {
  top: number;
  bottom: number;
}

export interface SelectionContextExtract {
  contextBefore: string;
  contextAfter: string;
  sentence: string;
}

/**
 * Joins PDF text-layer fragments without inserting spurious spaces inside CJK
 * text, while preserving spaces between Latin words and healing hyphenated line
 * breaks (e.g. "trans-" + "former" -> "transformer").
 */
export function joinPdfTextPieces(pieces: string[]): string {
  let result = '';
  for (const raw of pieces) {
    const piece = raw.replace(/\s+/g, ' ').trim();
    if (!piece) continue;
    if (!result) {
      result = piece;
      continue;
    }
    const prevLast = result.charAt(result.length - 1);
    const nextFirst = piece.charAt(0);
    if (/[a-zA-Z]-$/.test(result) && /^[a-zA-Z]/.test(piece)) {
      result = result.slice(0, -1) + piece;
    } else if (
      CJK_CHAR_RE.test(prevLast)
      || CJK_CHAR_RE.test(nextFirst)
      || /^[,.;:!?)\]}>%'"”’、。，；：！？》）】]/.test(nextFirst)
      || /[(\[{<'"“‘《（【]$/.test(prevLast)
    ) {
      result += piece;
    } else {
      result += ` ${piece}`;
    }
  }
  return result.trim();
}

/** Lazily classifies page-margin and figure text before a selection is read. */
export function markPageSelectionRegions(pageElement: HTMLElement) {
  const textLayer = pageElement.querySelector<HTMLElement>('.textLayer');
  if (!textLayer || textLayer.dataset.readerSelectionRegionsMarked === 'true') return;
  if (!textLayer.querySelector('.endOfContent')) return;
  const pageRect = pageElement.getBoundingClientRect();
  if (!pageRect.width || !pageRect.height) return;

  const topBoundary = pageRect.top + pageRect.height * PAGE_VERTICAL_MARGIN_SELECTION_RATIO;
  const bottomBoundary = pageRect.bottom - pageRect.height * PAGE_VERTICAL_MARGIN_SELECTION_RATIO;
  const leftBoundary = pageRect.left + pageRect.width * PAGE_HORIZONTAL_MARGIN_SELECTION_RATIO;
  const rightBoundary = pageRect.right - pageRect.width * PAGE_HORIZONTAL_MARGIN_SELECTION_RATIO;
  const textSpans = textLayer.querySelectorAll<HTMLElement>('span');
  if (!textSpans.length) return;

  for (const span of textSpans) {
    if (span.querySelector('span') || !span.textContent?.trim()) continue;
    const rect = span.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    span.classList.toggle(
      'reader-margin-text',
      rect.width > 0 && rect.height > 0 && (
        centerY < topBoundary || centerY > bottomBoundary
        || centerX < leftBoundary || centerX > rightBoundary
      )
    );
  }

  const figureRegions = detectFigureRegions(pageElement, textSpans);
  for (const span of textSpans) {
    const rect = span.getBoundingClientRect();
    const centerY = safeRatio(rect.top + rect.height / 2 - pageRect.top, pageRect.height);
    span.classList.toggle(
      'reader-figure-text',
      figureRegions.some(region => centerY >= region.top && centerY <= region.bottom)
    );
  }
  pageElement.dataset.readerFigureRegions = JSON.stringify(figureRegions);
  textLayer.dataset.readerSelectionRegionsMarked = 'true';
}

export function selectionStartsInNonBodyText(selection: Selection | null) {
  const anchorElement = nodeElement(selection?.anchorNode);
  return !!anchorElement?.closest('.reader-margin-text, .reader-figure-text');
}

export function extractSelectedPdfText(selection: Selection | null, includeNonBodyText: boolean) {
  if (!selection || selection.isCollapsed || !selection.rangeCount) return '';
  const range = selection.getRangeAt(0);
  const selectionDocument = range.commonAncestorContainer.ownerDocument || window.document;
  const pieces: string[] = [];
  for (const pageElement of selectedPageElements(range)) {
    markPageSelectionRegions(pageElement);
    const textLayer = pageElement.querySelector('.textLayer');
    if (!textLayer) continue;
    const walker = selectionDocument.createTreeWalker(textLayer, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.textContent || !rangeIntersectsNode(range, node)) {
          return NodeFilter.FILTER_REJECT;
        }
        const element = nodeElement(node);
        if (!includeNonBodyText && element?.closest('.reader-margin-text, .reader-figure-text')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let node = walker.nextNode();
    while (node) {
      const text = selectedTextFromNode(range, node);
      if (text) pieces.push(text);
      node = walker.nextNode();
    }
  }
  return joinPdfTextPieces(pieces);
}

/**
 * Extracts surrounding context and the enclosing sentence around the active
 * selection so annotations carry contextBefore/contextAfter and saved words
 * capture their real source sentence.
 */
export function extractSelectionContext(
  selection: Selection | null,
  includeNonBodyText: boolean,
  selectedText: string,
  maxContextChars = 140
): SelectionContextExtract {
  if (!selection || selection.isCollapsed || !selection.rangeCount) {
    return { contextBefore: '', contextAfter: '', sentence: selectedText };
  }
  const range = selection.getRangeAt(0);
  const pages = selectedPageElements(range);
  if (!pages.length) {
    return { contextBefore: '', contextAfter: '', sentence: selectedText };
  }
  const selectionDocument = range.commonAncestorContainer.ownerDocument || window.document;
  const beforePieces: string[] = [];
  const afterPieces: string[] = [];
  let phase: 'before' | 'inside' | 'after' = 'before';

  for (const pageElement of pages) {
    const textLayer = pageElement.querySelector('.textLayer');
    if (!textLayer) continue;
    const walker = selectionDocument.createTreeWalker(textLayer, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
        const element = nodeElement(node);
        if (!includeNonBodyText && element?.closest('.reader-margin-text, .reader-figure-text')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let node = walker.nextNode();
    while (node) {
      const value = node.textContent || '';
      const intersects = rangeIntersectsNode(range, node);
      if (intersects) {
        if (range.startContainer === node && range.startOffset > 0) {
          beforePieces.push(value.slice(0, range.startOffset));
        }
        phase = 'inside';
        if (range.endContainer === node && range.endOffset < value.length) {
          afterPieces.push(value.slice(range.endOffset));
          phase = 'after';
        }
      } else if (phase === 'before') {
        beforePieces.push(value);
      } else {
        phase = 'after';
        afterPieces.push(value);
      }
      node = walker.nextNode();
    }
  }

  return buildSelectionContextFromParts(
    joinPdfTextPieces(beforePieces),
    selectedText,
    joinPdfTextPieces(afterPieces),
    maxContextChars
  );
}

export function buildSelectionContextFromParts(
  fullBefore: string,
  selectedText: string,
  fullAfter: string,
  maxContextChars = 140
): SelectionContextExtract {
  const before = trimStartContext(fullBefore, maxContextChars);
  const after = trimEndContext(fullAfter, maxContextChars);
  const sentenceBefore = extractSentencePrefix(fullBefore, 180);
  const sentenceAfter = extractSentenceSuffix(fullAfter, 180);
  const sentence = joinPdfTextPieces([sentenceBefore, selectedText, sentenceAfter]);
  return {
    contextBefore: before,
    contextAfter: after,
    sentence: sentence || selectedText
  };
}

function trimStartContext(text: string, maxChars: number) {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  const slice = trimmed.slice(trimmed.length - maxChars);
  const firstSpace = slice.indexOf(' ');
  if (firstSpace > 0 && firstSpace < 24 && !CJK_CHAR_RE.test(slice[0])) {
    return slice.slice(firstSpace + 1).trim();
  }
  return slice.trim();
}

function trimEndContext(text: string, maxChars: number) {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  const slice = trimmed.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > maxChars - 24 && lastSpace > 0 && !CJK_CHAR_RE.test(slice[slice.length - 1])) {
    return slice.slice(0, lastSpace).trim();
  }
  return slice.trim();
}

function extractSentencePrefix(fullBefore: string, maxChars: number) {
  const tail = fullBefore.slice(Math.max(0, fullBefore.length - maxChars));
  let boundary = -1;
  for (let index = tail.length - 1; index >= 0; index -= 1) {
    if (SENTENCE_END_RE.test(tail[index])) {
      boundary = index;
      break;
    }
  }
  return (boundary >= 0 ? tail.slice(boundary + 1) : tail).trim();
}

function extractSentenceSuffix(fullAfter: string, maxChars: number) {
  const head = fullAfter.slice(0, maxChars);
  for (let index = 0; index < head.length; index += 1) {
    if (SENTENCE_END_RE.test(head[index])) {
      return head.slice(0, index + 1).trim();
    }
  }
  return head.trim();
}

export function filterNonBodyRects(position: ScaledPosition): ScaledPosition {
  const filteredRects = position.rects.filter(rect => !isPageMarginRect(rect) && !isFigureRect(rect));
  if (!filteredRects.length) return position;
  const firstPage = Math.min(...filteredRects.map(rect => rect.pageNumber));
  const firstPageRects = filteredRects.filter(rect => rect.pageNumber === firstPage);
  return {
    ...position,
    boundingRect: {
      x1: Math.min(...firstPageRects.map(rect => rect.x1)),
      y1: Math.min(...firstPageRects.map(rect => rect.y1)),
      x2: Math.max(...firstPageRects.map(rect => rect.x2)),
      y2: Math.max(...firstPageRects.map(rect => rect.y2)),
      width: firstPageRects[0].width,
      height: firstPageRects[0].height,
      pageNumber: firstPage
    },
    rects: filteredRects
  };
}

function detectFigureRegions(pageElement: HTMLElement, textSpans: NodeListOf<HTMLElement>) {
  const pageRect = pageElement.getBoundingClientRect();
  const lines = groupTextSpansIntoLines(textSpans, pageRect);
  const regions: NormalizedPageRegion[] = [];
  for (let captionIndex = 0; captionIndex < lines.length; captionIndex += 1) {
    const captionLine = lines[captionIndex];
    if (!FIGURE_CAPTION_PATTERN.test(captionLine.text)) continue;
    const linesAbove = lines.slice(0, captionIndex);
    const medianHeight = median(lines.map(line => line.height)) || 0.015;
    const minimumGap = Math.max(medianHeight * 2.5, 0.025);
    let regionTop = captionLine.top;
    for (let index = 1; index < linesAbove.length; index += 1) {
      const gap = linesAbove[index].top - linesAbove[index - 1].bottom;
      if (gap >= minimumGap) {
        regionTop = (linesAbove[index - 1].bottom + linesAbove[index].top) / 2;
        break;
      }
    }
    let regionBottom = captionLine.bottom;
    for (let index = captionIndex + 1; index < lines.length; index += 1) {
      const nextLine = lines[index];
      if (nextLine.top - regionBottom > medianHeight * 1.8) break;
      regionBottom = nextLine.bottom;
    }
    regions.push({ top: Math.max(0, regionTop), bottom: Math.min(1, regionBottom) });
  }
  return regions;
}

function groupTextSpansIntoLines(textSpans: NodeListOf<HTMLElement>, pageRect: DOMRect) {
  const items = Array.from(textSpans)
    .filter(span => !span.querySelector('span') && !span.classList.contains('reader-margin-text') && !!span.textContent?.trim())
    .map(span => {
      const rect = span.getBoundingClientRect();
      return {
        text: span.textContent!.trim(),
        left: safeRatio(rect.left - pageRect.left, pageRect.width),
        top: safeRatio(rect.top - pageRect.top, pageRect.height),
        bottom: safeRatio(rect.bottom - pageRect.top, pageRect.height),
        height: safeRatio(rect.height, pageRect.height)
      };
    })
    .filter(item => item.height > 0)
    .sort((left, right) => left.top - right.top || left.left - right.left);
  const lines: Array<{
    text: string;
    top: number;
    bottom: number;
    height: number;
    items: typeof items;
  }> = [];
  for (const item of items) {
    let line: typeof lines[number] | undefined;
    for (let index = lines.length - 1; index >= Math.max(0, lines.length - 8); index -= 1) {
      const candidate = lines[index];
      if (Math.abs((candidate.top + candidate.bottom) / 2 - (item.top + item.bottom) / 2)
        < Math.max(candidate.height, item.height) * 0.65) {
        line = candidate;
        break;
      }
    }
    if (line) {
      line.items.push(item);
      line.top = Math.min(line.top, item.top);
      line.bottom = Math.max(line.bottom, item.bottom);
      line.height = Math.max(line.height, item.height);
    } else {
      lines.push({ text: '', top: item.top, bottom: item.bottom, height: item.height, items: [item] });
    }
  }
  return lines.map(line => ({
    text: joinPdfTextPieces(line.items.sort((left, right) => left.left - right.left).map(item => item.text)),
    top: line.top,
    bottom: line.bottom,
    height: line.height
  })).sort((left, right) => left.top - right.top);
}

export function selectedPageElements(range: Range) {
  const startPage = nodeElement(range.startContainer)?.closest<HTMLElement>('.page');
  const endPage = nodeElement(range.endContainer)?.closest<HTMLElement>('.page');
  if (!startPage && !endPage) return [] as HTMLElement[];
  if (!startPage || !endPage || startPage === endPage) return [startPage || endPage!];
  const viewer = startPage.closest('.PdfHighlighter');
  if (!viewer || viewer !== endPage.closest('.PdfHighlighter')) return [startPage, endPage];
  const pages = Array.from(viewer.querySelectorAll<HTMLElement>('.page'));
  const startIndex = pages.indexOf(startPage);
  const endIndex = pages.indexOf(endPage);
  if (startIndex < 0 || endIndex < 0) return [startPage, endPage];
  return pages.slice(Math.min(startIndex, endIndex), Math.max(startIndex, endIndex) + 1);
}

function rangeIntersectsNode(range: Range, node: Node) {
  try {
    return range.intersectsNode(node);
  } catch {
    return false;
  }
}

function selectedTextFromNode(range: Range, node: Node) {
  const value = node.textContent || '';
  const start = range.startContainer === node ? range.startOffset : 0;
  const end = range.endContainer === node ? range.endOffset : value.length;
  return value.slice(start, end);
}

function nodeElement(node: Node | null | undefined): Element | null {
  if (!node) return null;
  return node instanceof Element ? node : node.parentElement;
}

function isPageMarginRect(rect: ScaledPosition['rects'][number]) {
  const centerX = safeRatio(rect.x1 + rect.x2, rect.width * 2);
  const centerY = safeRatio(rect.y1 + rect.y2, rect.height * 2);
  return centerY < PAGE_VERTICAL_MARGIN_SELECTION_RATIO
    || centerY > 1 - PAGE_VERTICAL_MARGIN_SELECTION_RATIO
    || centerX < PAGE_HORIZONTAL_MARGIN_SELECTION_RATIO
    || centerX > 1 - PAGE_HORIZONTAL_MARGIN_SELECTION_RATIO;
}

function isFigureRect(rect: ScaledPosition['rects'][number]) {
  const pageElement = document.querySelector<HTMLElement>(
    `.PdfHighlighter .page[data-page-number="${rect.pageNumber}"]`
  );
  if (!pageElement?.dataset.readerFigureRegions) return false;
  try {
    const regions = JSON.parse(pageElement.dataset.readerFigureRegions) as NormalizedPageRegion[];
    const centerY = safeRatio(rect.y1 + rect.y2, rect.height * 2);
    return regions.some(region => centerY >= region.top && centerY <= region.bottom);
  } catch {
    return false;
  }
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function safeRatio(value: number, total: number) {
  return total ? value / total : 0;
}
