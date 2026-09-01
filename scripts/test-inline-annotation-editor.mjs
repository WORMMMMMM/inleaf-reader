import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [mainSource, pdfViewSource, annotationWidgetsSource, generatedBundle] = await Promise.all([
  readFile(new URL('../webview/src/main.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../webview/src/components/PdfDocumentView.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../webview/src/components/AnnotationWidgets.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../media/reader-app.js', import.meta.url), 'utf8')
]);
const source = `${mainSource}\n${pdfViewSource}\n${annotationWidgetsSource}`;

assert.match(source, /const \[sidebarVisible, setSidebarVisible\] = useState\(false\)/);
assert.doesNotMatch(source, /setSidebarVisible\(true\)/);
assert.match(source, /function InlineAnnotationActions/);
assert.match(source, /function InlineAnnotationEditor/);
assert.match(source, /onOpen\(annotation, highlight\.position\)/);
assert.match(source, /onOpen=\{openAnnotationActions\}/);
assert.match(source, /onEdit=\{\(\) => editAnnotation\(annotation, tipPosition\)\}/);
assert.match(
  source,
  /<button onClick=\{onEdit\}>Edit<\/button>\s*<button className="danger-button" onClick=\{onDelete\}>Delete<\/button>/
);
assert.match(source, /utils\.setTip\(/);
assert.doesNotMatch(pdfViewSource, /\bonStyleChange=/);
assert.doesNotMatch(pdfViewSource, /\bonDelete=/);
assert.doesNotMatch(pdfViewSource, /\bcopyText=/);
assert.match(source, /Original text/);
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
