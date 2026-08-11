import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8')
);
const openReader = manifest.contributes.commands.find(
  command => command.command === 'readingExtension.openReader'
);
const editorTitleEntry = manifest.contributes.menus['editor/title'].find(
  item => item.command === 'readingExtension.openReader'
);

assert.ok(openReader, 'Open Reader command must be contributed.');
assert.equal(manifest.displayName, 'Inleaf Reader');
assert.equal(openReader.title, 'Inleaf Reader: Open Paper Reader');
assert.equal(manifest.contributes.configuration.title, 'Inleaf Reader');
assert.deepEqual(openReader.icon, {
  light: 'assets/reading-extension-toolbar-light.svg',
  dark: 'assets/reading-extension-toolbar-dark.svg'
});

for (const iconPath of Object.values(openReader.icon)) {
  const icon = await readFile(new URL(`../${iconPath}`, import.meta.url), 'utf8');
  assert.match(icon, /<svg\b/);
  assert.match(icon, /stroke-width="2\.[1-9]/);
}

assert.ok(editorTitleEntry, 'Open Reader command must remain in the editor title menu.');
assert.match(editorTitleEntry.when, /resourceExtname == \.pdf/);

console.log('Open Reader branded toolbar icon contract passed.');
