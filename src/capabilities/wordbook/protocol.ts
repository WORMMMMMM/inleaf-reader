import type { WordRecord } from '../../readerDataTypes';
import { isRecord } from '../contracts';

export type WordbookCapabilityRequest =
  | { action: 'save'; payload: Omit<WordRecord, 'id' | 'createdAt' | 'updatedAt'> }
  | { action: 'delete'; payload: { id: string } };

export type WordbookCapabilityEvent = {
  event: 'state';
  payload: { words: WordRecord[] };
};

export function decodeWordbookRequest(action: string, payload: unknown): WordbookCapabilityRequest {
  if (!isRecord(payload)) {
    throw new Error(`Invalid wordbook ${action} payload.`);
  }
  if (action === 'save') {
    if (typeof payload.word !== 'string' || !payload.word.trim()) {
      throw new Error('A word is required before it can be saved.');
    }
    return { action, payload: payload as unknown as Extract<WordbookCapabilityRequest, { action: 'save' }>['payload'] };
  }
  if (action === 'delete') {
    if (typeof payload.id !== 'string' || !payload.id.trim()) {
      throw new Error('A word id is required before it can be deleted.');
    }
    return { action, payload: { id: payload.id } };
  }
  throw new Error(`Unsupported wordbook action: ${action}`);
}
