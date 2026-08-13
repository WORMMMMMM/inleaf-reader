import type { AnnotationRecord, ReaderStatePayload, WordDetails, WordRecord } from './types';

export type SidebarTab = 'overview' | 'annotations' | 'wordbook' | 'translation';
export type TranslationMode = 'local' | 'deepseek';

/** Messages sent by the extension host to the reader Webview. */
export type IncomingMessage = (
  | { type: 'state'; payload: ReaderStatePayload }
  | { type: 'statePatch'; payload: { annotations?: AnnotationRecord[]; words?: WordRecord[] } }
  | { type: 'navigateTo'; payload: { pdfUrl: string; paperName: string; documentId: string } }
  | {
      type: 'translationResult';
      payload: { sourceText: string; translatedText?: string; wordDetails?: WordDetails; error?: string };
    }
  | {
      type: 'translationSettings';
      payload: {
        mode: TranslationMode;
        provider: string;
        hasDeepSeekApiKey: boolean;
        dictionaryReady: boolean;
        argosPythonFound: boolean;
      };
    }
  | { type: 'exportResult'; payload: { path?: string; error?: string } }
  | { type: 'clipboardResult'; payload: { message?: string; error?: string } }
  | { type: 'annotationActionResult'; payload: { message?: string; error?: string } }
  | { type: 'stateError'; payload: { message: string } }
) & { documentId?: string };
