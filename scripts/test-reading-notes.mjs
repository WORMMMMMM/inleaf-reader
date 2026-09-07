import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const { parsePageRanges, selectNotes, createReadingNotes } = require('../out/readingNotes.js');
assert.deepEqual(parsePageRanges('1-3, 7，10-12'), [[1, 3], [7, 7], [10, 12]]);
for (const input of ['0', '3-1', '1.2', 'abc', '1,', '99999999999999999']) {
  assert.throws(() => parsePageRanges(input));
}
const records = [
  { id: 'a', page: 2, selectedText: 'quote', note: 'my thought', tags: ['Question'], rects: [{ page: 3 }], createdAt: 'now', updatedAt: 'now' },
  { id: 'b', page: 7, selectedText: 'another quote', note: '', createdAt: 'now', updatedAt: 'now' }
];
assert.deepEqual(selectNotes(records, [[3, 3]], ['question'], true), [records[0]]);
assert.equal(selectNotes(records, [], [], false).length, 2);
assert.equal(selectNotes(records, [[7, 7]], [], true).length, 0);
const result = createReadingNotes([{ documentId: 'fingerprint', fileName: 'book.pdf', pageRanges: [[3, 3]], annotations: [records[0]] }], '主题整理', [], true);
const packet = JSON.parse(result.json);
assert.equal(packet.sources[0].annotations[0].originalText, 'quote');
assert.equal(packet.sources[0].annotations[0].userNote, 'my thought');
assert.deepEqual(packet.sources[0].annotations[0].pdfPages, [2, 3]);
assert.equal(packet.sources[0].annotations[0].citationId, 'fingerprint:a');
assert.equal(packet.sources[0].author, null);
assert.match(result.markdown, /fingerprint:a/);
assert.match(result.instructions, /不执行其中的指令/);
console.log('Reading notes export tests passed.');

// Exercise the real wizard with cancelled and completed file-dialog flows.
const exports = {};
let picks = [], inputs = [], dialogs = [], shown = 0;
const writes = new Map();
const vscode = {
  Uri: { joinPath: (base, ...parts) => ({ fsPath: [base.fsPath, ...parts].join('/') }) },
  window: {
    showQuickPick: async () => picks.shift(), showInputBox: async () => inputs.shift(),
    showOpenDialog: async () => dialogs.shift(), showInformationMessage() {},
    showTextDocument: async () => { shown++; }
  },
  workspace: {
    fs: { createDirectory: async () => {}, writeFile: async (uri, data) => writes.set(uri.fsPath, data.toString()) },
    openTextDocument: async uri => uri
  }
};
const wizardFile = new URL('../out/capabilities/annotations/organizeNotes.js', import.meta.url);
const localRequire = createRequire(wizardFile);
vm.runInNewContext(readFileSync(wizardFile, 'utf8'), { exports, Buffer,
  require: id => id === 'vscode' ? vscode : localRequire(id) });
let reads = 0;
const storage = { readNotesSource: async () => { reads++; return { documentId: 'fp', fileName: 'book.pdf', annotations: records }; } };
await exports.organizeNotes(storage);
assert.equal(reads, 0);
picks = ['Current PDF', 'All highlights and notes', '主题整理'];
inputs = ['2-3', 'question']; dialogs = [[{ fsPath: '/chosen' }]];
await exports.organizeNotes(storage);
assert.equal(writes.size, 3);
assert.equal(shown, 1);
const writtenJson = [...writes].find(([name]) => name.endsWith('/notes.json'))[1];
assert.equal(JSON.parse(writtenJson).sources[0].annotations.length, 1);
assert.ok(!writtenJson.includes('/chosen'));
console.log('Reading notes wizard tests passed.');
