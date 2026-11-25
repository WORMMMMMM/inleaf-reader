import { joinPdfTextPieces } from './pdfSelection';

export interface PdfSearchMatch {
  id: string;
  pageNumber: number;
  occurrenceOnPage: number;
  snippet: string;
}

export interface SearchablePdfDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<{
    getTextContent(): Promise<{ items: Array<{ str?: string }> }>;
  }>;
}

export class PdfTextSearchCache {
  private readonly pageTexts = new Map<number, string>();

  clear() {
    this.pageTexts.clear();
  }

  async search(
    pdfDocument: SearchablePdfDocument,
    query: string,
    isCancelled: () => boolean
  ): Promise<PdfSearchMatch[]> {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return [];
    }
    const matches: PdfSearchMatch[] = [];
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      if (isCancelled()) return [];
      let text = this.pageTexts.get(pageNumber);
      if (text === undefined) {
        const page = await pdfDocument.getPage(pageNumber);
        if (isCancelled()) return [];
        const content = await page.getTextContent();
        const pieces = content.items
          .map(item => (typeof item.str === 'string' ? item.str : ''))
          .filter(Boolean);
        text = joinPdfTextPieces(pieces);
        this.pageTexts.set(pageNumber, text);
      }
      const lower = text.toLowerCase();
      let startIndex = 0;
      let occurrenceOnPage = 0;
      while (startIndex < lower.length) {
        const found = lower.indexOf(needle, startIndex);
        if (found < 0) break;
        const snippetStart = Math.max(0, found - 24);
        const snippetEnd = Math.min(text.length, found + needle.length + 36);
        matches.push({
          id: `${pageNumber}:${occurrenceOnPage}`,
          pageNumber,
          occurrenceOnPage,
          snippet: text.slice(snippetStart, snippetEnd).trim()
        });
        occurrenceOnPage += 1;
        startIndex = found + Math.max(1, needle.length);
      }
    }
    return matches;
  }
}

export interface RelativeSearchRect {
  left: number;
  top: number;
  width: number;
  height: number;
  active: boolean;
}

/**
 * Computes pointer-transparent highlight rectangles on a rendered PDF page's
 * textLayer without mutating the textLayer DOM nodes.
 */
export function computePageSearchRects(
  pageElement: HTMLElement,
  query: string,
  activeOccurrenceOnPage?: number
): RelativeSearchRect[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const textLayer = pageElement.querySelector<HTMLElement>('.textLayer');
  if (!textLayer) return [];
  const pageRect = pageElement.getBoundingClientRect();
  if (!pageRect.width || !pageRect.height) return [];

  const entries: Array<{ node: Text; startOffset: number; endOffset: number; normStart: number; normEnd: number }> = [];
  let normalized = '';
  const walker = document.createTreeWalker(textLayer, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    const textNode = current as Text;
    const raw = textNode.textContent || '';
    if (raw.trim()) {
      const compact = raw.replace(/\s+/g, ' ');
      const prevLast = normalized.charAt(normalized.length - 1);
      const nextFirst = compact.trimStart().charAt(0);
      if (normalized && needsSpaceBetween(prevLast, nextFirst)) {
        normalized += ' ';
      }
      const normStart = normalized.length;
      const trimmed = compact.trim();
      const leadingSpaces = raw.length - raw.trimStart().length;
      normalized += trimmed;
      entries.push({
        node: textNode,
        startOffset: leadingSpaces,
        endOffset: Math.min(raw.length, leadingSpaces + trimmed.length),
        normStart,
        normEnd: normalized.length
      });
    }
    current = walker.nextNode();
  }

  const lower = normalized.toLowerCase();
  const rects: RelativeSearchRect[] = [];
  let searchFrom = 0;
  let occurrence = 0;
  while (searchFrom < lower.length) {
    const matchStart = lower.indexOf(needle, searchFrom);
    if (matchStart < 0) break;
    const matchEnd = matchStart + needle.length;
    const isActive = occurrence === activeOccurrenceOnPage;
    for (const entry of entries) {
      if (entry.normEnd <= matchStart) continue;
      if (entry.normStart >= matchEnd) break;
      const localStart = Math.max(0, matchStart - entry.normStart);
      const localEnd = Math.min(entry.normEnd - entry.normStart, matchEnd - entry.normStart);
      const range = document.createRange();
      const rawLen = (entry.node.textContent || '').length;
      range.setStart(entry.node, Math.min(rawLen, entry.startOffset + localStart));
      range.setEnd(entry.node, Math.min(rawLen, entry.startOffset + localEnd));
      for (const domRect of Array.from(range.getClientRects())) {
        if (domRect.width < 1 || domRect.height < 1) continue;
        rects.push({
          left: domRect.left - pageRect.left,
          top: domRect.top - pageRect.top,
          width: domRect.width,
          height: domRect.height,
          active: isActive
        });
      }
    }
    occurrence += 1;
    searchFrom = matchStart + Math.max(1, needle.length);
  }
  return rects;
}

const CJK_RE = /[\u2e80-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/;

function needsSpaceBetween(prevLast: string, nextFirst: string) {
  if (!prevLast || !nextFirst) return false;
  if (CJK_RE.test(prevLast) || CJK_RE.test(nextFirst)) return false;
  if (/^[,.;:!?)\]}>%'"”’、。，；：！？》）】]/.test(nextFirst)) return false;
  if (/[(\[{<'"“‘《（【-]$/.test(prevLast)) return false;
  return true;
}
