import type { ReaderStatePayload } from './types';
import type { CapabilityDescriptor, CapabilityId } from '../../src/capabilities/contracts';
import type { CapabilityEventEnvelope } from '../../src/capabilities/protocol';

export type WorkspaceTab = 'overview' | CapabilityId;

/** Messages sent by the extension host to the reader Webview. */
type CoreIncomingMessage = (
  | { type: 'state'; payload: ReaderStatePayload }
  | { type: 'navigateTo'; payload: { pdfUrl: string; paperName: string; documentId: string } }
  | { type: 'capabilitySettings'; payload: { capabilities: CapabilityDescriptor[] } }
  | { type: 'clipboardResult'; payload: { message?: string; error?: string } }
  | { type: 'stateError'; payload: { message: string } }
) & { documentId: string };

export type IncomingMessage = CoreIncomingMessage | CapabilityEventEnvelope;

export type DocumentIncomingMessage = Exclude<IncomingMessage, { type: 'navigateTo' }> & {
  documentId: string;
};
