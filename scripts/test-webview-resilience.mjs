import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, pdfViewSource, styles] = await Promise.all([
  readFile(new URL('../webview/src/main.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../webview/src/components/PdfDocumentView.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../webview/src/styles.css', import.meta.url), 'utf8')
]);

assert.match(source, /function isResizeObserverLoopWarning/);
assert.match(source, /ResizeObserver loop \(\?:limit exceeded\|completed with undelivered notifications\)\\\.\?/);
assert.match(source, /if \(isIgnorableWebviewError\(event\.error \|\| event\.message\)\)/);
assert.match(source, /event\.preventDefault\(\);\s*return;/);

assert.match(source, /const zoomFrameRef = useRef<number \| undefined>/);
assert.match(source, /const pendingZoomScaleRef = useRef<number \| undefined>/);
assert.match(source, /zoomFrameRef\.current = window\.requestAnimationFrame/);
assert.match(source, /const baseScale = pendingZoomScaleRef\.current \?\?/);
assert.doesNotMatch(source, /horizontalViewportAnchor|restoreHorizontalZoomAnchor/);

assert.match(pdfViewSource, /const horizontalCenterFrameRef = useRef<number \| undefined>/);
assert.match(pdfViewSource, /const pendingHighlightLayersRef = useRef\(new Set<HTMLElement>\(\)\)/);
assert.match(pdfViewSource, /horizontalCenterFrameRef\.current = window\.requestAnimationFrame/);
assert.match(pdfViewSource, /function centerCurrentPageHorizontally/);
assert.match(pdfViewSource, /viewer\.getPageView\(viewer\.currentPageNumber - 1\)\?\.div/);
assert.match(
  pdfViewSource,
  /pageRect\.left - containerRect\.left \+ pageRect\.width \/ 2/
);
assert.match(pdfViewSource, /container\.scrollLeft \+ pageCenterInViewport - container\.clientWidth \/ 2/);
assert.match(pdfViewSource, /pendingHighlightLayersRef\.current\.delete\(layer\)/);
assert.match(pdfViewSource, /pendingHighlightLayersRef\.current\.size === 0/);
assert.doesNotMatch(
  pdfViewSource,
  /container\.scrollLeft = Math\.max\(0, \(container\.scrollWidth - container\.clientWidth\) \/ 2\)/
);

assert.match(styles, /\.pdf-host \.pdfViewer \{\s*width: 100%;\s*min-width: 100%;/);
assert.match(styles, /\.pdf-host \.pdfViewer \.page \{\s*margin-inline: auto;/);

// The actual PDF scroll container owns the rail, so dragging uses PDF.js's
// existing scroll/page events instead of a second navigation state machine.
const scrollContainerStyles = styles.match(/\.pdf-host \.PdfHighlighter \{([^}]+)\}/)[1];
// VS Code supplies body padding. Without resetting it, a viewport-wide shell
// clips the PDF scrollbar when the side panel is closed.
assert.match(styles, /body \{[^}]*padding: 0;/);
assert.match(styles, /\.shell \{[^}]*width: 100%;/);
assert.doesNotMatch(styles, /\.shell \{[^}]*width: 100vw;/);
assert.match(styles, /\.reader \{[^}]*grid-template-columns: minmax\(0, 1fr\);/);
assert.match(scrollContainerStyles, /overflow-y: scroll;/);
assert.match(scrollContainerStyles, /scrollbar-gutter: stable;/);
assert.match(scrollContainerStyles, /scrollbar-width: auto;/);
assert.match(styles, /\.pdf-host \.PdfHighlighter::\-webkit-scrollbar \{\s*width: 14px;/);
assert.match(styles, /min-height: 36px;/);

console.log('Webview resize, rapid-zoom, and centering resilience contract passed.');
