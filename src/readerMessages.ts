import type { AnnotationRecord } from './annotationTypes';
import type { ProgressRecord, WordRecord } from './readerDataTypes';
import type { TranslationProvider } from './translationContract';

/** Messages sent from the reader Webview to the extension host. */
export type ReaderMessage = (
  | { type: 'ready' }
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
  | { type: 'setTranslationProvider'; payload: { provider: TranslationProvider } }
  | { type: 'configureDeepSeek' }
  | { type: 'diagnoseTranslation' }
  | { type: 'translate'; payload: { text: string } }
) & { documentId: string };
