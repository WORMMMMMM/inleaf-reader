import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import { createReadingNotes, parsePageRanges, selectNotes, type ReadingNoteSource } from '../../readingNotes';
import type { AnnotationCapabilityStorage } from './storage';

export async function organizeNotes(storage: AnnotationCapabilityStorage) {
  const scope = await vscode.window.showQuickPick(['Current PDF', 'Choose PDFs…'], { title: '整理阅读笔记 · 选择文件' });
  if (!scope) return;
  const files = scope === 'Current PDF' ? [undefined] : await vscode.window.showOpenDialog({
    canSelectMany: true, filters: { PDF: ['pdf'] }, openLabel: '选择阅读文件'
  });
  if (!files?.length) return;
  const sources: ReadingNoteSource[] = [];
  for (const file of files) {
    const source = await storage.readNotesSource(file);
    const pages = await vscode.window.showInputBox({
      title: `选择 PDF 页码 · ${source.fileName}`, prompt: `共 ${source.annotations.length} 条批注。留空为全部；跨页批注完整保留。`,
      placeHolder: '1-5, 8, 12-15', validateInput: value => {
        try { parsePageRanges(value); return undefined; } catch (error) { return String(error); }
      }
    });
    if (pages === undefined) return;
    sources.push({ ...source, pageRanges: parsePageRanges(pages) });
  }
  const tagInput = await vscode.window.showInputBox({ title: '标签筛选', prompt: '留空为全部；多个标签用逗号分隔，匹配任意一个即可。' });
  if (tagInput === undefined) return;
  const tags = tagInput.split(/[,，]/).map(tag => tag.trim().replace(/^#/, '')).filter(Boolean);
  const filter = await vscode.window.showQuickPick(['All highlights and notes', 'Only highlights with notes'], { title: '批注范围' });
  if (!filter) return;
  const notesOnly = filter === 'Only highlights with notes';
  for (const source of sources) source.annotations = selectNotes(source.annotations, source.pageRanges, tags, notesOnly);
  const count = sources.reduce((sum, source) => sum + source.annotations.length, 0);
  if (!count) { vscode.window.showInformationMessage('所选范围没有匹配的批注，请调整页码或标签。'); return; }
  const mode = await vscode.window.showQuickPick(['忠实摘录', '主题整理', '分享文章'], { title: `${sources.length} 个文件 · ${count} 条批注 · 选择整理方式` });
  if (!mode) return;
  const folder = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false, openLabel: '选择整理包保存位置' });
  if (!folder?.[0]) return;
  const destination = vscode.Uri.joinPath(folder[0], `inleaf-notes-${Date.now()}-${randomUUID().slice(0, 8)}`);
  const result = createReadingNotes(sources, mode, tags, notesOnly);
  await vscode.workspace.fs.createDirectory(destination);
  for (const [name, text] of [['notes.json', result.json], ['notes.md', result.markdown], ['整理说明.md', result.instructions]]) {
    await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(destination, name), Buffer.from(text, 'utf8'));
  }
  await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(vscode.Uri.joinPath(destination, 'notes.md')));
  vscode.window.showInformationMessage(`已导出 ${count} 条批注。将整个整理包交给你的 AI，按整理说明预览后写入 Notion。`);
  return destination;
}
