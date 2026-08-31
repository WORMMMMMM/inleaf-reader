import type { AnnotationRecord, ReaderStatePayload, WordDetails, WordRecord } from './types';
import type { DeepSeekModel, TranslationProvider } from '../../src/translationContract';

export type SidebarTab = 'overview' | 'annotations' | 'wordbook' | 'translation';
export type { TranslationProvider } from '../../src/translationContract';

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
        provider: TranslationProvider;
        deepSeekModel: DeepSeekModel;
        hasDeepSeekApiKey: boolean;
        dictionaryReady: boolean;
        argosPythonFound: boolean;
      };
    }
  | { type: 'exportResult'; payload: { path?: string; error?: string } }
  | { type: 'clipboardResult'; payload: { message?: string; error?: string } }
  | { type: 'annotationActionResult'; payload: { message?: string; error?: string } }
  | { type: 'stateError'; payload: { message: string } }
) & { documentId: string };
