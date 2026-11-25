import type * as vscode from 'vscode';
import type { WordRecord } from '../../readerDataTypes';
import type { ReaderStorage } from '../../readerStorage';

export interface WordbookCapabilityStorage {
  read(): Promise<WordRecord[]>;
  add(input: Omit<WordRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<WordRecord[]>;
  update(id: string, patch: { note?: string; sentence?: string }): Promise<WordRecord[]>;
  delete(id: string): Promise<WordRecord[]>;
  exportMarkdown(): Promise<vscode.Uri>;
  exportCsv(): Promise<vscode.Uri>;
}

export function wordbookStorage(storage: ReaderStorage): WordbookCapabilityStorage {
  return {
    read: () => storage.readWords(),
    add: input => storage.addWord(input),
    update: (id, patch) => storage.updateWord(id, patch),
    delete: id => storage.deleteWord(id),
    exportMarkdown: () => storage.exportWordbookMarkdown(),
    exportCsv: () => storage.exportWordbookCsv()
  };
}
