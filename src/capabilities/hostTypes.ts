import type { ReaderStorage } from '../readerStorage';
import type { CapabilityId } from './contracts';

export interface CapabilityHostContext {
  documentId: string;
  storage: ReaderStorage;
  postEvent(capabilityId: CapabilityId, event: string, payload?: unknown): Thenable<boolean>;
}

export interface HostCapability {
  readonly id: CapabilityId;
  postInitialState(context: CapabilityHostContext): Promise<void>;
  handle(action: string, payload: unknown, context: CapabilityHostContext): Promise<void>;
}
