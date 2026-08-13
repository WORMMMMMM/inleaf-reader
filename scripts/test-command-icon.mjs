import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8')
);
const openReader = manifest.contributes.commands.find(
  command => command.command === 'inleafReader.openReader'
);
const editorTitleEntry = manifest.contributes.menus['editor/title'].find(
  item => item.command === 'inleafReader.openReader'
);

assert.ok(openReader, 'Open Reader command must be contributed.');
assert.equal(`${manifest.publisher}.${manifest.name}`, 'ziming.inleaf-reader');
assert.equal(manifest.displayName, 'Inleaf Reader');
assert.ok(
  manifest.contributes.commands.every(command => command.command.startsWith('inleafReader.')),
  'Every command must use the Inleaf Reader namespace.'
);
assert.ok(
  Object.keys(manifest.contributes.configuration.properties)
    .every(setting => setting.startsWith('inleafReader.')),
  'Every setting must use the Inleaf Reader namespace.'
);
assert.equal(openReader.title, 'Inleaf Reader: Open Paper Reader');
assert.equal(manifest.contributes.configuration.title, 'Inleaf Reader');
assert.deepEqual(openReader.icon, {
  light: 'assets/inleaf-reader-toolbar-light.svg',
  dark: 'assets/inleaf-reader-toolbar-dark.svg'
});

for (const iconPath of Object.values(openReader.icon)) {
  const icon = await readFile(new URL(`../${iconPath}`, import.meta.url), 'utf8');
  assert.match(icon, /<svg\b/);
  assert.match(icon, /stroke-width="2\.[1-9]/);
}

assert.ok(editorTitleEntry, 'Open Reader command must remain in the editor title menu.');
assert.match(editorTitleEntry.when, /resourceExtname == \.pdf/);

console.log('Open Reader branded toolbar icon contract passed.');
