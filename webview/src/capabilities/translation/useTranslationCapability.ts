import { useCallback, useRef, useState } from 'react';
import type { TranslationSettings } from '../../../../src/translationTypes';
import type { WordDetails } from '../../types';
import { vscode } from '../../vscodeApi';

const defaultSettings: TranslationSettings = {
  provider: 'argos',
  deepSeekModel: 'deepseek-v4-flash',
  libreTranslateEndpoint: 'http://localhost:5000/translate',
  argosPythonPath: '',
  fallbackToLibreTranslate: false,
  source: 'auto',
  target: 'zh',
  hasDeepSeekApiKey: false,
  dictionaryReady: false,
  argosPythonFound: false
};

export function useTranslationCapability() {
  const [settings, setSettings] = useState<TranslationSettings>(defaultSettings);
  const [sourceText, setSourceText] = useState('');
  const [output, setOutput] = useState('');
  const [wordDetails, setWordDetails] = useState<WordDetails | undefined>();
  const pending = useRef<{ requestId: string; text: string }>();

  const cancel = useCallback(() => {
    if (pending.current) {
      vscode.postMessage({ type: 'capabilityRequest', capabilityId: 'translation', action: 'cancel',
        payload: { requestId: pending.current.requestId } });
      pending.current = undefined;
    }
  }, []);

  const handleEvent = useCallback((event: string, payload: unknown, expectedSourceText: string) => {
    if (!isRecord(payload)) {
      return {};
    }
    if (event === 'settings') {
      cancel();
      setSourceText('');
      setOutput('');
      setWordDetails(undefined);
      setSettings(payload as unknown as TranslationSettings);
      return {};
    }
    if (event === 'result' && typeof payload.sourceText === 'string') {
      if (!pending.current || payload.sourceText !== expectedSourceText || payload.requestId !== pending.current.requestId) {
        return {};
      }
      pending.current = undefined;
      setSourceText(payload.sourceText);
      setOutput(typeof payload.error === 'string'
        ? payload.error
        : typeof payload.translatedText === 'string' ? payload.translatedText : '');
      setWordDetails(isRecord(payload.wordDetails) ? payload.wordDetails as unknown as WordDetails : undefined);
      return { activatePanel: 'translation' as const };
    }
    return {};
  }, [cancel]);

  const start = useCallback((text: string) => {
    if (pending.current?.text === text) return;
    cancel();
    const requestId = crypto.randomUUID();
    pending.current = { requestId, text };
    setSourceText(text);
    setOutput('Translating...');
    setWordDetails(undefined);
    vscode.postMessage({ type: 'capabilityRequest', capabilityId: 'translation', action: 'translate',
      payload: { text, requestId } });
  }, [cancel]);

  const clearResult = useCallback(() => {
    cancel();
    setSourceText('');
    setOutput('');
    setWordDetails(undefined);
  }, [cancel]);

  return { settings, sourceText, output, wordDetails, handleEvent, start, clearResult };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
