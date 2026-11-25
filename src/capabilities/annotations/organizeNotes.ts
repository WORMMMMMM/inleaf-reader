import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import { createTranslator, resolveLocale } from '../../i18n';
import { createReadingNotes, parsePageRanges, selectNotes, type ReadingNoteSource } from '../../readingNotes';
import type { AnnotationCapabilityStorage } from './storage';

export async function organizeNotes(storage: AnnotationCapabilityStorage) {
  const t = createTranslator(resolveLocale(vscode.env?.language));
  const currentPdfOption = t('wizardCurrentPdf');
  const scope = await vscode.window.showQuickPick(
    [currentPdfOption, t('wizardChoosePdfs')],
    { title: t('wizardScopeTitle') }
  );
  if (!scope) return;
  const files = scope === currentPdfOption ? [undefined] : await vscode.window.showOpenDialog({
    canSelectMany: true, filters: { PDF: ['pdf'] }, openLabel: t('wizardSelectPdfLabel')
  });
  if (!files?.length) return;
  const sources: ReadingNoteSource[] = [];
  for (const file of files) {
    const source = await storage.readNotesSource(file);
    const pages = await vscode.window.showInputBox({
      title: t('wizardPagesTitle', { fileName: source.fileName }),
      prompt: t('wizardPagesPrompt', { count: source.annotations.length }),
      placeHolder: '1-5, 8, 12-15',
      validateInput: value => {
        try { parsePageRanges(value); return undefined; } catch (error) { return String(error); }
      }
    });
    if (pages === undefined) return;
    sources.push({ ...source, pageRanges: parsePageRanges(pages) });
  }
  const tagInput = await vscode.window.showInputBox({
    title: t('wizardTagTitle'),
    prompt: t('wizardTagPrompt')
  });
  if (tagInput === undefined) return;
  const tags = tagInput.split(/[,，]/).map(tag => tag.trim().replace(/^#/, '')).filter(Boolean);
  const notesOnlyOption = t('wizardFilterNotesOnly');
  const filter = await vscode.window.showQuickPick(
    [t('wizardFilterAll'), notesOnlyOption],
    { title: t('wizardFilterTitle') }
  );
  if (!filter) return;
  const notesOnly = filter === notesOnlyOption;
  for (const source of sources) source.annotations = selectNotes(source.annotations, source.pageRanges, tags, notesOnly);
  const count = sources.reduce((sum, source) => sum + source.annotations.length, 0);
  if (!count) { vscode.window.showInformationMessage(t('wizardNoMatch')); return; }
  const mode = await vscode.window.showQuickPick(
    [t('wizardModeFaithful'), t('wizardModeThematic'), t('wizardModeShare')],
    { title: t('wizardModeTitle', { files: sources.length, count }) }
  );
  if (!mode) return;
  const folder = await vscode.window.showOpenDialog({
    canSelectFolders: true, canSelectFiles: false, canSelectMany: false, openLabel: t('wizardDestLabel')
  });
  if (!folder?.[0]) return;
  const destination = vscode.Uri.joinPath(folder[0], `inleaf-notes-${Date.now()}-${randomUUID().slice(0, 8)}`);
  const result = createReadingNotes(sources, mode, tags, notesOnly);
  await vscode.workspace.fs.createDirectory(destination);
  for (const [name, text] of [['notes.json', result.json], ['notes.md', result.markdown], ['整理说明.md', result.instructions]]) {
    await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(destination, name), Buffer.from(text, 'utf8'));
  }
  await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(vscode.Uri.joinPath(destination, 'notes.md')));
  vscode.window.showInformationMessage(t('wizardDone', { count }));
  return destination;
}
