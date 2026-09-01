import type { ProgressRecord } from './readerDataTypes';
import type { CapabilityRequestEnvelope, UpdateCapabilityPreferenceMessage } from './capabilities/protocol';

/** Core messages sent from the reader Webview to the extension host. */
export type ReaderMessage =
  | ({ type: 'ready' } & { documentId: string })
  | ({ type: 'saveProgress'; payload: ProgressRecord } & { documentId: string })
  | ({ type: 'copySelection'; payload: { text: string } } & { documentId: string })
  | CapabilityRequestEnvelope
  | UpdateCapabilityPreferenceMessage;
