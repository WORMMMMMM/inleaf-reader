import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [readerMessages, researchMessages, panel, main, vscodeApi, manifest] = await Promise.all([
  readFile('src/readerMessages.ts', 'utf8'),
  readFile('src/researchMessages.ts', 'utf8'),
  readFile('src/paperReaderPanel.ts', 'utf8'),
  readFile('webview/src/main.tsx', 'utf8'),
  readFile('webview/src/vscodeApi.ts', 'utf8'),
  readFile('package.json', 'utf8').then(JSON.parse)
]);

assert.match(readerMessages, /\) & \{ documentId: string \}/, 'all Webview requests must carry documentId');
assert.match(panel, /message\.documentId !== this\.documentId/, 'the host must reject stale document sessions');
assert.match(panel, /const researchStorage = this\.researchStorage/, 'long research actions must capture their originating document storage');
assert.match(panel, /type: 'stateError'[\s\S]*showErrorMessage/, 'handler failures must reach the Webview and VS Code');
assert.match(main, /message\.payload\.requestId !== translationRequestRef\.current/, 'translation results need request-level stale protection');
assert.match(main, /message\.payload\.sourceText !== selectionRef\.current\.selectedText\.trim\(\)/, 'translation results need source-text stale protection');
assert.match(vscodeApi, /documentId: activeDocumentId/, 'the Webview bridge must attach the active document session');
assert.doesNotMatch(
  main.match(/const beginTranslation[\s\S]*?\n  \}, \[\]\);/)?.[0] || '',
  /setSidebarVisible\(true\)/,
  'translation must not open the side panel automatically'
);
for (const command of [
  'inleafReader.chooseLibraryRoot',
  'inleafReader.rebuildLibrary',
  'inleafReader.configureCodexMcp',
  'inleafReader.removeCodexMcp'
]) {
  assert.ok(manifest.contributes.commands.some(entry => entry.command === command), `${command} must be contributed`);
}
assert.match(researchMessages, /analyzeRepositoryWithCodex/, 'repository analysis needs a typed Webview request');
assert.match(main, /type: 'analyzeRepositoryWithCodex'/, 'the repository panel must expose explicit Codex analysis');
assert.match(readerMessages, /type: 'openQuickStart'/, 'the reader toolbar needs a typed Quick Start request');
assert.match(main, /className="activity-rail"[\s\S]*type: 'openQuickStart'/, 'the activity rail must expose Quick Start without the command palette');
for (const destination of ['研究', '仓库', '文库', '对比', '设置']) {
  assert.match(main, new RegExp(`<small>${destination}<\\/small>`), `${destination} must stay discoverable in the activity rail`);
}
for (const glyph of ['阅', '记', '研', '仓', '库', '比', '设']) {
  assert.match(main, new RegExp(`<span className="activity-glyph">${glyph}<\\/span>`), `${glyph} must be present as a Chinese rail glyph`);
}

console.log('Research message and stale-session contracts passed.');
