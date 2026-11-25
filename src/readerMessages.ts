import type { ProgressRecord } from './readerDataTypes';
import type { CapabilityRequestEnvelope, UpdateCapabilityPreferenceMessage } from './capabilities/protocol';

export interface ActiveReadingContextPayload {
  page: number;
  pageTotal: number;
  selectedText?: string;
  contextBefore?: string;
  contextAfter?: string;
}

/** Core messages sent from the reader Webview to the extension host. */
export type ReaderMessage =
  | ({ type: 'ready' } & { documentId: string })
  | ({ type: 'saveProgress'; payload: ProgressRecord } & { documentId: string })
  | ({ type: 'copySelection'; payload: { text: string; message?: string } } & { documentId: string })
  | ({ type: 'syncReadingContext'; payload: ActiveReadingContextPayload } & { documentId: string })
  | ({ type: 'updateReaderPreference'; payload: { key: 'syncAiContext'; value: boolean } } & { documentId: string })
  | CapabilityRequestEnvelope
  | UpdateCapabilityPreferenceMessage;
