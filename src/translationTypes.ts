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
  mode: 'local' | 'deepseek';
  provider: string;
  hasDeepSeekApiKey: boolean;
  dictionaryReady: boolean;
  argosPythonFound: boolean;
}
