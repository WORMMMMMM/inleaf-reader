import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [manifest, localInstaller] = await Promise.all([
  readFile(new URL('../package.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('./install-local.mjs', import.meta.url), 'utf8')
]);
const openReader = manifest.contributes.commands.find(
  command => command.command === 'inleafReader.openReader'
);
const quickStart = manifest.contributes.commands.find(
  command => command.command === 'inleafReader.quickStart'
);
const editorTitleEntry = manifest.contributes.menus['editor/title'].find(
  item => item.command === 'inleafReader.openReader'
);

assert.ok(openReader, 'Open Reader command must be contributed.');
assert.ok(quickStart, 'Quick Start command must be contributed.');
assert.equal(quickStart.title, 'Inleaf Reader：快速开始');
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
assert.equal(openReader.title, 'Inleaf Reader：打开论文阅读器');
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
assert.equal(manifest.scripts['install:local'], 'npm run package:vsix && node scripts/install-local.mjs');
assert.match(localInstaller, /--install-extension/);
assert.match(localInstaller, /--force/);

console.log('Open Reader branded toolbar icon contract passed.');
