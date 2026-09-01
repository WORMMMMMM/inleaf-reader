import type { WordRecord } from '../../readerDataTypes';
import type { ReaderStorage } from '../../readerStorage';

export interface WordbookCapabilityStorage {
  read(): Promise<WordRecord[]>;
  add(input: Omit<WordRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<WordRecord[]>;
  delete(id: string): Promise<WordRecord[]>;
}

export function wordbookStorage(storage: ReaderStorage): WordbookCapabilityStorage {
  return {
    read: () => storage.readWords(),
    add: input => storage.addWord(input),
    delete: id => storage.deleteWord(id)
  };
}
