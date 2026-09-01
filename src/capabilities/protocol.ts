import type { CapabilityId, CapabilityPreference } from './contracts';

export interface CapabilityRequestEnvelope {
  type: 'capabilityRequest';
  documentId: string;
  capabilityId: CapabilityId;
  action: string;
  payload?: unknown;
}

export interface CapabilityEventEnvelope {
  type: 'capabilityEvent';
  documentId: string;
  capabilityId: CapabilityId;
  event: string;
  payload?: unknown;
}

export interface UpdateCapabilityPreferenceMessage {
  type: 'updateCapabilityPreference';
  documentId: string;
  payload: {
    capabilityId: CapabilityId;
    patch: CapabilityPreference;
  };
}
