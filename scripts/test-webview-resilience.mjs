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
assert.match(pdfViewSource, /horizontalCenterFrameRef\.current = window\.requestAnimationFrame/);
assert.match(pdfViewSource, /function centerCurrentPageHorizontally/);
assert.match(pdfViewSource, /viewer\.getPageView\(viewer\.currentPageNumber - 1\)\?\.div/);
assert.match(
  pdfViewSource,
  /pageRect\.left - containerRect\.left \+ pageRect\.width \/ 2/
);
assert.match(pdfViewSource, /container\.scrollLeft \+ pageCenterInViewport - container\.clientWidth \/ 2/);
assert.doesNotMatch(
  pdfViewSource,
  /container\.scrollLeft = Math\.max\(0, \(container\.scrollWidth - container\.clientWidth\) \/ 2\)/
);

assert.match(styles, /\.pdf-host \.pdfViewer \{\s*width: 100%;\s*min-width: 100%;/);
assert.match(styles, /\.pdf-host \.pdfViewer \.page \{\s*margin-inline: auto;/);

console.log('Webview resize, rapid-zoom, and centering resilience contract passed.');
