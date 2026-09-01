import { useCallback, useState } from 'react';
import type { WordRecord } from '../../types';

export function useWordbookCapability() {
  const [words, setWords] = useState<WordRecord[]>([]);

  const handleEvent = useCallback((event: string, payload: unknown) => {
    if (event !== 'state' || !isRecord(payload) || !Array.isArray(payload.words)) {
      return {};
    }
    setWords(payload.words as WordRecord[]);
    return {};
  }, []);

  const reset = useCallback(() => setWords([]), []);
  return { words, handleEvent, reset };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
