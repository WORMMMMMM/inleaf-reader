import { useCallback, useEffect, useRef } from 'react';

/** Schedule only completed PDF selections; manual actions take precedence. */
export function useAutomaticTranslation(selectedText: string, enabled: boolean, translate: () => void) {
  const text = selectedText.trim();
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const translateRef = useRef(translate);
  translateRef.current = translate;

  const cancelScheduled = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
  }, []);

  useEffect(() => {
    cancelScheduled();
    if (enabled && text) {
      timer.current = setTimeout(() => {
        timer.current = undefined;
        translateRef.current();
      }, 350);
    }
    return cancelScheduled;
  }, [text, enabled, cancelScheduled]);

  return cancelScheduled;
}
