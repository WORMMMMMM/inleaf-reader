import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [mainSource, pdfViewSource, annotationWidgetsSource, generatedBundle] = await Promise.all([
  readFile(new URL('../webview/src/main.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../webview/src/components/PdfDocumentView.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../webview/src/components/AnnotationWidgets.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../media/reader-app.js', import.meta.url), 'utf8')
]);
const source = `${mainSource}\n${pdfViewSource}\n${annotationWidgetsSource}`;

assert.match(source, /const \[surface, setSurface\] = useState<ReaderSurface>\('closed'\)/);
assert.doesNotMatch(source, /onSave=\{patch => \{[^}]*setSurface/s);
assert.match(source, /function InlineAnnotationActions/);
assert.match(source, /function InlineAnnotationEditor/);
assert.match(source, /onOpen\(annotation, highlight\.position\)/);
assert.match(pdfViewSource, /selection && !selection\.isCollapsed/);
assert.match(pdfViewSource, /event\.detail > 1/);
assert.match(pdfViewSource, /data-reader-annotation-id/);
const styles = await readFile(new URL('../webview/src/styles.css', import.meta.url), 'utf8');
const selectionLayer = Number(styles.match(/--reader-selection-layer:\s*(\d+)/)?.[1]);
const inlineUiLayer = Number(styles.match(/--reader-inline-ui-layer:\s*(\d+)/)?.[1]);
assert.ok(inlineUiLayer > selectionLayer, 'inline editors must paint above selection shading');
assert.match(styles, /\.pdf-host \.PdfHighlighter__tip-container\s*\{\s*z-index: var\(--reader-inline-ui-layer\)/);
assert.match(styles, /\.reader-selection-shade\s*\{[^}]*z-index: var\(--reader-selection-layer\)/);
assert.match(styles, /\.pdf-host \.TextHighlight--scrolledTo \.TextHighlight__part\s*\{\s*box-shadow: none;/);
assert.match(mainSource, /window\.setTimeout\(\(\) => setLocatedAnnotation\(undefined\), 1200\)/);
assert.match(mainSource, /return \(\) => window\.clearTimeout\(timer\)/);
assert.match(mainSource, /function clearAnnotationDraft\(\) \{\s*setLocatedAnnotation\(undefined\)/);
assert.match(mainSource, /function focusAnnotation\(annotation: AnnotationRecord\) \{\s*setLocatedAnnotation\(\{ id: annotation\.id \}\)/);
assert.doesNotMatch(styles, /\.pdf-host \.textLayer > span,/);
assert.match(styles, /\.reader-selection-shade\s*\{[^}]*pointer-events: none;/);
assert.match(styles, /\.pdf-host \.reader-selection-preview \*\s*\{\s*pointer-events: none !important;/);
assert.match(pdfViewSource, /textSelectionColor=\{TEXT_SELECTION_COLOR\}/);
const ghostRendering = pdfViewSource.slice(pdfViewSource.indexOf('if (!annotation) {'), pdfViewSource.indexOf('const hasTooltip'));
assert.doesNotMatch(ghostRendering, /#ffd654/);
assert.match(ghostRendering, /className="reader-selection-preview"/);
assert.match(ghostRendering, /highlightColor=\{TEXT_SELECTION_COLOR\}/);
assert.match(source, /onOpen=\{openAnnotationActions\}/);
assert.match(pdfViewSource, /document\.addEventListener\('pointermove', handleMove, true\)/);
assert.match(pdfViewSource, /utils\.isEditInProgress\(\) \|\| utils\.isSelectionInProgress\(\)/);
assert.match(pdfViewSource, /ownedTip && utils\?\.getTip\(\) === ownedTip/);
assert.match(pdfViewSource, /utils\.getTip\(\) && utils\.getTip\(\) !== ownedTip/);
assert.match(pdfViewSource, /document\.removeEventListener\('pointermove', handleMove, true\)/);
assert.match(source, /onEdit=\{\(\) => editAnnotation\(annotation, tipPosition\)\}/);
assert.match(
  source,
  /<button onClick=\{onEdit\}>Edit<\/button>\s*<button className="danger-button" onClick=\{onDelete\}>Delete<\/button>/
);
assert.match(source, /utils\.setTip\(/);
assert.match(source, /function handleOutsidePointerDown\(event: PointerEvent\)/);
assert.match(source, /target\.closest\('\.PdfHighlighter__tip-container, \.selection-toolbar'\)/);
assert.match(source, /document\.addEventListener\('pointerdown', handleOutsidePointerDown, true\)/);
assert.match(source, /document\.removeEventListener\('pointerdown', handleOutsidePointerDown, true\)/);
assert.match(
  source,
  /const dismissInlineContext = useCallback\(\(\) => \{[\s\S]*?setTip\(null\);[\s\S]*?removeGhostHighlight\(\);[\s\S]*?clearAnnotationDraft\(\);/
);
assert.match(source, /postCapabilityRequest\('annotations', 'update'/);
assert.doesNotMatch(pdfViewSource, /\bonStyleChange=/);
assert.doesNotMatch(pdfViewSource, /\bonDelete=/);
assert.doesNotMatch(pdfViewSource, /\bcopyText=/);
assert.match(source, /Original text/);
assert.match(
  annotationWidgetsSource,
  /event\.key !== 'Enter' \|\| event\.shiftKey \|\| event\.nativeEvent\.isComposing/
);
assert.equal((annotationWidgetsSource.match(/saveNoteOnEnter\(event, /g) || []).length, 2);
assert.match(
  source,
  /<button onClick=\{onCancel\}>Cancel<\/button>\s*<button onClick=\{save\} disabled=\{!canSave\}>Save<\/button>/
);
assert.match(
  source,
  /<button onClick=\{\(\) => setActiveEditor\(undefined\)\}>Cancel<\/button>\s*<button onClick=\{saveNote\} disabled=\{!noteText\.trim\(\)\}>Save<\/button>/
);
assert.doesNotMatch(source, /Changes autosave while this panel is open/);
assert.match(generatedBundle, /Starting PDF worker/);
assert.match(generatedBundle, /annotation-inline-actions/);
assert.match(generatedBundle, /Edit annotation/);
assert.doesNotMatch(generatedBundle, /Changes autosave while this panel is open/);

console.log('Inline annotation editor contract passed.');
