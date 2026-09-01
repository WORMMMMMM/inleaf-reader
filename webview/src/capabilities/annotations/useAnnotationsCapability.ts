import { useCallback, useState } from 'react';
import type { AnnotationRecord } from '../../types';

export function useAnnotationsCapability() {
  const [annotations, setAnnotations] = useState<AnnotationRecord[]>([]);

  const handleEvent = useCallback((event: string, payload: unknown) => {
    if (!isRecord(payload)) {
      return {};
    }
    if (event === 'state' && Array.isArray(payload.annotations)) {
      setAnnotations(payload.annotations as AnnotationRecord[]);
    }
    return {
      ...(event === 'result' && typeof payload.message === 'string'
        ? { status: payload.message }
        : {})
    };
  }, []);

  const reset = useCallback(() => setAnnotations([]), []);
  return { annotations, handleEvent, reset };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
