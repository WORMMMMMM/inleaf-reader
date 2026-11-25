import { useCallback, useState } from 'react';
import type { WordRecord } from '../../types';

export function useWordbookCapability() {
  const [words, setWords] = useState<WordRecord[]>([]);

  const handleEvent = useCallback((event: string, payload: unknown) => {
    if (!isRecord(payload)) {
      return {};
    }
    if (event === 'state' && Array.isArray(payload.words)) {
      setWords(payload.words as WordRecord[]);
      return {};
    }
    if (event === 'result' && typeof payload.message === 'string') {
      return { status: payload.message };
    }
    return {};
  }, []);

  const reset = useCallback(() => {
    setWords([]);
  }, []);

  return { words, handleEvent, reset };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
