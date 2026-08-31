import type { DeepSeekModel, TranslationProvider } from '../../src/translationContract';
import type {
  AnnotationRecord,
  EvidenceFocusTarget,
  LibraryIndexData,
  PaperComparison,
  ReaderStatePayload,
  ResearchProfile,
  WordDetails,
  WordRecord
} from './types';

export type SidebarTab = 'overview' | 'annotations' | 'wordbook' | 'translation' | 'research' | 'repositories';
export type { DeepSeekModel, TranslationProvider } from '../../src/translationContract';

/** Messages sent by the extension host to the reader Webview. */
export type IncomingMessage = (
  | { type: 'state'; payload: ReaderStatePayload }
  | {
      type: 'statePatch';
      payload: {
        annotations?: AnnotationRecord[];
        words?: WordRecord[];
        research?: ResearchProfile;
        libraries?: LibraryIndexData[];
        comparison?: PaperComparison;
        codex?: { available: boolean; version?: string; error?: string };
      };
    }
  | { type: 'navigateTo'; payload: { pdfUrl: string; paperName: string; documentId: string } }
  | {
      type: 'translationResult';
      payload: { requestId: string; sourceText: string; translatedText?: string; wordDetails?: WordDetails; error?: string };
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
  | { type: 'codexResult'; payload: { message?: string; contextPath?: string; error?: string } }
  | { type: 'focusEvidence'; payload: EvidenceFocusTarget }
  | { type: 'libraryResult'; payload: { indexes: LibraryIndexData[]; message?: string } }
  | { type: 'comparisonResult'; payload: { comparison: PaperComparison; message?: string } }
  | { type: 'stateError'; payload: { message: string } }
) & { documentId: string };
