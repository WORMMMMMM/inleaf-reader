import type { WordRecord } from '../../readerDataTypes';
import { decodeWordInput } from '../../sidecarSchemas';
import { isRecord } from '../contracts';

export type WordbookCapabilityRequest =
  | { action: 'save'; payload: Omit<WordRecord, 'id' | 'createdAt' | 'updatedAt'> }
  | { action: 'update'; payload: { id: string; patch: { note?: string; sentence?: string } } }
  | { action: 'delete'; payload: { id: string } }
  | { action: 'exportMarkdown'; payload?: undefined }
  | { action: 'exportCsv'; payload?: undefined };

export type WordbookCapabilityEvent =
  | { event: 'state'; payload: { words: WordRecord[] } }
  | { event: 'result'; payload: { message?: string; path?: string } };

export function decodeWordbookRequest(action: string, payload: unknown): WordbookCapabilityRequest {
  if (action === 'exportMarkdown' || action === 'exportCsv') {
    return { action };
  }
  if (!isRecord(payload)) {
    throw new Error(`Invalid wordbook ${action} payload.`);
  }
  if (action === 'save') {
    if (typeof payload.word !== 'string' || !payload.word.trim()) {
      throw new Error('A word is required before it can be saved.');
    }
    return { action, payload: decodeWordInput(payload) };
  }
  if (action === 'update') {
    if (typeof payload.id !== 'string' || !payload.id.trim()) {
      throw new Error('A word id is required before it can be updated.');
    }
    if (!isRecord(payload.patch)) {
      throw new Error('Invalid wordbook update patch.');
    }
    const patch: { note?: string; sentence?: string } = {};
    if (payload.patch.note !== undefined) {
      if (typeof payload.patch.note !== 'string') {
        throw new Error('Word note must be text.');
      }
      patch.note = payload.patch.note;
    }
    if (payload.patch.sentence !== undefined) {
      if (typeof payload.patch.sentence !== 'string') {
        throw new Error('Word sentence must be text.');
      }
      patch.sentence = payload.patch.sentence;
    }
    return { action, payload: { id: payload.id, patch } };
  }
  if (action === 'delete') {
    if (typeof payload.id !== 'string' || !payload.id.trim()) {
      throw new Error('A word id is required before it can be deleted.');
    }
    return { action, payload: { id: payload.id } };
  }
  throw new Error(`Unsupported wordbook action: ${action}`);
}
