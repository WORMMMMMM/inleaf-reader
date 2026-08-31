import type { AnnotationRecord } from './annotationTypes';
import type { ProgressRecord, WordRecord } from './readerStorage';
import type { ResearchReaderMessage } from './researchMessages';

export type TranslationMode = 'local' | 'deepseek';

/** Messages sent from the reader Webview to the extension host. */
export type ReaderMessage = (
  | ResearchReaderMessage
  | { type: 'ready' }
  | { type: 'openQuickStart' }
  | { type: 'saveAnnotation'; payload: Omit<AnnotationRecord, 'id' | 'createdAt' | 'updatedAt'> }
  | {
      type: 'updateAnnotation';
      payload: {
        id: string;
        patch: Partial<Omit<AnnotationRecord, 'id' | 'createdAt' | 'updatedAt'>>;
      };
    }
  | { type: 'deleteAnnotation'; payload: { id: string } }
  | { type: 'restoreAnnotation'; payload: AnnotationRecord }
  | { type: 'copyAnnotationMarkdown'; payload: { id: string } }
  | { type: 'copySelection'; payload: { text: string } }
  | { type: 'exportAnnotations' }
  | { type: 'exportAnnotatedPdf' }
  | { type: 'saveWord'; payload: Omit<WordRecord, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'deleteWord'; payload: { id: string } }
  | { type: 'saveProgress'; payload: ProgressRecord }
  | { type: 'setTranslationMode'; payload: { mode: TranslationMode } }
  | { type: 'setDeepSeekModel'; payload: { model: 'deepseek-v4-flash' | 'deepseek-v4-pro' } }
  | { type: 'configureDeepSeek' }
  | { type: 'diagnoseTranslation' }
  | { type: 'translate'; payload: { text: string; requestId: string } }
  | { type: 'cancelTranslation'; payload: { requestId: string } }
) & { documentId: string };
