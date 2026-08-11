import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, generatedBundle] = await Promise.all([
  readFile(new URL('../webview/src/main.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../media/reader-app.js', import.meta.url), 'utf8')
]);

assert.match(source, /const \[sidebarVisible, setSidebarVisible\] = useState\(false\)/);
assert.doesNotMatch(source, /setSidebarVisible\(true\)/);
assert.match(source, /function InlineAnnotationEditor/);
assert.match(source, /onOpen\(annotation, highlight\.position\)/);
assert.match(source, /utils\.setTip\(/);
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
assert.match(generatedBundle, /Edit annotation/);
assert.doesNotMatch(generatedBundle, /Changes autosave while this panel is open/);

console.log('Inline annotation editor contract passed.');
