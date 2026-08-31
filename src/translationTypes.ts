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
  deepSeekModel: 'deepseek-v4-flash' | 'deepseek-v4-pro';
  hasDeepSeekApiKey: boolean;
  dictionaryReady: boolean;
  argosPythonFound: boolean;
}
