import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [mainSource, pdfViewSource, annotationWidgetsSource, generatedBundle] = await Promise.all([
  readFile(new URL('../webview/src/main.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../webview/src/components/PdfDocumentView.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../webview/src/components/AnnotationWidgets.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../media/reader-app.js', import.meta.url), 'utf8')
]);
const source = `${mainSource}\n${pdfViewSource}\n${annotationWidgetsSource}`;
const inlineAnnotationFlow = mainSource.match(/function openAnnotationActions[\s\S]*?function closeAnnotationTip/)?.[0] || '';

assert.match(source, /const \[sidebarVisible, setSidebarVisible\] = useState\(false\)/);
assert.doesNotMatch(inlineAnnotationFlow, /setSidebarVisible\(true\)/);
assert.match(source, /function InlineAnnotationActions/);
assert.match(source, /function InlineAnnotationEditor/);
assert.match(source, /onOpen\(annotation, highlight\.position\)/);
assert.match(source, /onOpen=\{openAnnotationActions\}/);
assert.match(source, /onEdit=\{\(\) => editAnnotation\(annotation, tipPosition\)\}/);
assert.match(
  source,
  /<button onClick=\{onEdit\}>编辑<\/button>\s*<button className="danger-button" onClick=\{onDelete\}>删除<\/button>/
);
assert.match(source, /utils\.setTip\(/);
assert.match(source, /原文/);
assert.match(
  source,
  /<button onClick=\{onCancel\}>取消<\/button>\s*<button onClick=\{save\} disabled=\{!canSave\}>保存<\/button>/
);
assert.match(
  source,
  /<button onClick=\{\(\) => setActiveEditor\(undefined\)\}>取消<\/button>\s*<button onClick=\{saveNote\} disabled=\{!noteText\.trim\(\)\}>保存<\/button>/
);
assert.doesNotMatch(source, /Changes autosave while this panel is open/);
assert.match(generatedBundle, /正在启动 PDF 工作线程/);
assert.match(generatedBundle, /annotation-inline-actions/);
assert.match(generatedBundle, /编辑标注/);
assert.doesNotMatch(generatedBundle, /Changes autosave while this panel is open/);

console.log('Inline annotation editor contract passed.');
