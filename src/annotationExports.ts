import { PDFArray, PDFDocument, PDFHexString, PDFName, PDFPage, PDFString, rgb } from 'pdf-lib';
import { AnnotationRecord } from './annotationTypes';

export function formatAnnotationsMarkdown(
  baseName: string,
  annotations: AnnotationRecord[],
  exportedAt = new Date()
) {
  const lines = [
    `# Annotations for ${baseName}`,
    '',
    `Exported at ${exportedAt.toISOString()}`,
    ''
  ];

  if (!annotations.length) {
    lines.push('No annotations saved yet.', '');
    return lines.join('\n');
  }

  for (const annotation of sortAnnotationsByDocumentPosition(annotations)) {
    lines.push(...formatAnnotationMarkdownBlock(annotation, '##'));
    lines.push('');
  }

  return lines.join('\n');
}

export function formatAnnotationMarkdownSnippet(annotation: AnnotationRecord) {
  return formatAnnotationMarkdownBlock(annotation, '###').join('\n');
}

export function sortAnnotationsByDocumentPosition(annotations: AnnotationRecord[]) {
  return [...annotations].sort(compareAnnotationsByDocumentPosition);
}

export async function applyAnnotationsToPdf(
  pdfBytes: Uint8Array,
  annotations: AnnotationRecord[]
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes);
  const pages = pdf.getPages();

  for (const annotation of annotations) {
    const color = hexToRgb(annotation.color ?? '#ffd654');
    for (const rect of getAnnotationRects(annotation)) {
      const page = pages[rect.page - 1];
      if (!page) {
        continue;
      }

      const { width, height } = page.getSize();
      const x = rect.x * width;
      const y = (1 - rect.y - rect.height) * height;
      const rectWidth = rect.width * width;
      const rectHeight = rect.height * height;

      if ((annotation.kind ?? 'highlight') === 'underline') {
        page.drawRectangle({
          x,
          y: y + Math.max(1, rectHeight * 0.08),
          width: rectWidth,
          height: Math.max(1.25, rectHeight * 0.08),
          color: rgb(color.r, color.g, color.b),
          opacity: 0.9,
          borderOpacity: 0
        });
      } else {
        page.drawRectangle({
          x,
          y,
          width: rectWidth,
          height: rectHeight,
          color: rgb(color.r, color.g, color.b),
          opacity: 0.35,
          borderOpacity: 0
        });
      }
    }

    if (hasNativeCommentDetails(annotation)) {
      addNativeTextAnnotation(pdf, pages, annotation, color);
    }
  }

  return pdf.save();
}

function addNativeTextAnnotation(
  pdf: PDFDocument,
  pages: PDFPage[],
  annotation: AnnotationRecord,
  color: { r: number; g: number; b: number }
) {
  const firstRect = getAnnotationRects(annotation)[0];
  const pageIndex = firstRect ? firstRect.page - 1 : (annotation.page ?? 1) - 1;
  const page = pages[pageIndex];
  if (!page) {
    return;
  }

  const { width, height } = page.getSize();
  const iconSize = 18;
  const x = firstRect ? firstRect.x * width : width - 42;
  const y = firstRect ? (1 - firstRect.y) * height + 4 : height - 42;
  const iconRect = [
    clampNumber(x, 0, width - iconSize),
    clampNumber(y, 0, height - iconSize),
    clampNumber(x + iconSize, iconSize, width),
    clampNumber(y + iconSize, iconSize, height)
  ];
  const tags = normalizeTags(annotation.tags);
  const context = formatAnnotationContext(annotation);
  const contents = [
    annotation.note,
    annotation.selectedText ? `\n\nSelected text:\n${annotation.selectedText}` : '',
    context ? `\n\nContext:\n${context}` : '',
    tags.length ? `\n\nTags: ${tags.join(', ')}` : ''
  ].join('');
  const modifiedAt = parseDateOrNow(annotation.updatedAt || annotation.createdAt);
  const annot = pdf.context.obj({
    Type: PDFName.of('Annot'),
    Subtype: PDFName.of('Text'),
    Rect: iconRect,
    Contents: PDFHexString.fromText(contents),
    T: PDFHexString.fromText('Inleaf Reader'),
    Name: PDFName.of('Comment'),
    C: [color.r, color.g, color.b],
    M: PDFString.fromDate(modifiedAt),
    Open: false,
    F: 4
  });
  const annotRef = pdf.context.register(annot);
  const annots = page.node.Annots() ?? (pdf.context.obj([]) as PDFArray);

  if (!page.node.Annots()) {
    page.node.set(PDFName.of('Annots'), annots);
  }

  annots.push(annotRef);
}

function parseDateOrNow(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) {
    return { r: 1, g: 0.84, b: 0.33 };
  }

  return {
    r: parseInt(normalized.slice(0, 2), 16) / 255,
    g: parseInt(normalized.slice(2, 4), 16) / 255,
    b: parseInt(normalized.slice(4, 6), 16) / 255
  };
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function compareAnnotationsByDocumentPosition(a: AnnotationRecord, b: AnnotationRecord) {
  const aPosition = getAnnotationPosition(a);
  const bPosition = getAnnotationPosition(b);

  if (aPosition.page !== bPosition.page) {
    return aPosition.page - bPosition.page;
  }
  if (aPosition.y !== bPosition.y) {
    return aPosition.y - bPosition.y;
  }
  if (aPosition.x !== bPosition.x) {
    return aPosition.x - bPosition.x;
  }

  return dateValue(a.createdAt) - dateValue(b.createdAt);
}

function getAnnotationPosition(annotation: AnnotationRecord) {
  const firstRect = getAnnotationRects(annotation)[0];
  return {
    page: firstRect?.page ?? annotation.page ?? Number.MAX_SAFE_INTEGER,
    y: firstRect?.y ?? Number.MAX_SAFE_INTEGER,
    x: firstRect?.x ?? Number.MAX_SAFE_INTEGER
  };
}

function getAnnotationRects(annotation: AnnotationRecord) {
  if (annotation.rects?.length) {
    return annotation.rects;
  }

  const position = annotation.highlighterPosition;
  if (!position) {
    return [];
  }

  const rects = position.rects.length ? position.rects : [position.boundingRect];
  return rects.map(rect => ({
    page: rect.pageNumber,
    x: safeRatio(rect.x1, rect.width),
    y: safeRatio(rect.y1, rect.height),
    width: safeRatio(rect.x2 - rect.x1, rect.width),
    height: safeRatio(rect.y2 - rect.y1, rect.height)
  }));
}

function safeRatio(value: number, total: number) {
  return total ? value / total : 0;
}

function dateValue(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeTags(value: unknown) {
  const rawTags = Array.isArray(value) ? value : String(value ?? '').split(/[,\s#]+/);
  const tags = rawTags
    .map(tag => String(tag).trim().replace(/^#/, '').toLowerCase())
    .filter(Boolean);
  return [...new Set(tags)];
}

function formatAnnotationMarkdownBlock(annotation: AnnotationRecord, headingPrefix: '##' | '###') {
  const tags = normalizeTags(annotation.tags);
  const context = formatAnnotationContext(annotation);
  const lines = [
    `${headingPrefix} ${annotation.page ? `Page ${annotation.page}` : 'Annotation'} (${annotation.kind ?? 'highlight'}, ${annotation.color ?? '#ffd654'})`,
    ''
  ];

  if (annotation.selectedText) {
    lines.push('> ' + annotation.selectedText.replace(/\n/g, '\n> '));
    lines.push('');
  }
  if (annotation.note) {
    lines.push(annotation.note);
    lines.push('');
  }
  if (context) {
    lines.push(`Context: ${context}`);
    lines.push('');
  }
  if (tags.length) {
    lines.push(`- Tags: ${tags.join(', ')}`);
  }
  lines.push(`- Created: ${annotation.createdAt}`);
  lines.push(`- Updated: ${annotation.updatedAt}`);

  return lines;
}

function hasNativeCommentDetails(annotation: AnnotationRecord) {
  return Boolean(
    annotation.note ||
    normalizeTags(annotation.tags).length ||
    annotation.contextBefore ||
    annotation.contextAfter
  );
}

function formatAnnotationContext(annotation: AnnotationRecord) {
  const before = normalizeWhitespace(annotation.contextBefore || '');
  const selectedText = normalizeWhitespace(annotation.selectedText || '');
  const after = normalizeWhitespace(annotation.contextAfter || '');
  if (!before && !after) {
    return '';
  }

  return [before ? `...${before}` : '', selectedText ? `[${selectedText}]` : '[selection]', after ? `${after}...` : '']
    .filter(Boolean)
    .join(' ');
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}
