import type { DeepSeekModel, TranslationProvider } from './translationContract';

export interface WordDetails {
  word: string;
  phonetic?: string;
  definitions: { pos: string; meaning: string; translation?: string }[];
}

export interface TranslationResult {
  translatedText?: string;
  wordDetails?: WordDetails;
  error?: string;
}

export interface TranslationSettings {
  provider: TranslationProvider;
  deepSeekModel: DeepSeekModel;
  libreTranslateEndpoint: string;
  argosPythonPath: string;
  fallbackToLibreTranslate: boolean;
  source: string;
  target: string;
  hasDeepSeekApiKey: boolean;
  dictionaryReady: boolean;
  argosPythonFound: boolean;
}
