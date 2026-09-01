import { useCallback, useState } from 'react';
import type { TranslationSettings } from '../../../../src/translationTypes';
import type { WordDetails } from '../../types';

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

  const handleEvent = useCallback((event: string, payload: unknown, expectedSourceText: string) => {
    if (!isRecord(payload)) {
      return {};
    }
    if (event === 'settings') {
      setSettings(payload as unknown as TranslationSettings);
      return {};
    }
    if (event === 'result' && typeof payload.sourceText === 'string') {
      if (payload.sourceText !== expectedSourceText) {
        return {};
      }
      setSourceText(payload.sourceText);
      setOutput(typeof payload.error === 'string'
        ? payload.error
        : typeof payload.translatedText === 'string' ? payload.translatedText : '');
      setWordDetails(isRecord(payload.wordDetails) ? payload.wordDetails as unknown as WordDetails : undefined);
      return { activatePanel: 'translation' as const };
    }
    return {};
  }, []);

  const start = useCallback((text: string) => {
    setSourceText(text);
    setOutput('Translating...');
    setWordDetails(undefined);
  }, []);

  const clearResult = useCallback(() => {
    setSourceText('');
    setOutput('');
    setWordDetails(undefined);
  }, []);

  return { settings, sourceText, output, wordDetails, handleEvent, start, clearResult };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
