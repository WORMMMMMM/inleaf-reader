import type { DeepSeekModel, TranslationProvider } from '../../translationContract';
import type { TranslationResult, TranslationSettings } from '../../translationTypes';
import { isRecord } from '../contracts';

export type TranslationSettingKey =
  | 'provider'
  | 'deepSeekModel'
  | 'libreTranslateEndpoint'
  | 'argosPythonPath'
  | 'fallbackToLibreTranslate'
  | 'source'
  | 'target';

export type TranslationSettingValue = TranslationProvider | DeepSeekModel | string | boolean;

export type TranslationCapabilityRequest =
  | { action: 'translate'; payload: { text: string; requestId: string } }
  | { action: 'cancel'; payload: { requestId: string } }
  | { action: 'updateSetting'; payload: { key: TranslationSettingKey; value: TranslationSettingValue } }
  | { action: 'configureDeepSeek'; payload?: undefined }
  | { action: 'diagnose'; payload?: undefined };

export type TranslationCapabilityEvent =
  | { event: 'settings'; payload: TranslationSettings }
  | { event: 'result'; payload: { sourceText: string; requestId: string } & TranslationResult };

const SETTING_KEYS: TranslationSettingKey[] = [
  'provider',
  'deepSeekModel',
  'libreTranslateEndpoint',
  'argosPythonPath',
  'fallbackToLibreTranslate',
  'source',
  'target'
];

export function decodeTranslationRequest(action: string, payload: unknown): TranslationCapabilityRequest {
  if (action === 'configureDeepSeek' || action === 'diagnose') {
    return { action };
  }
  if (!isRecord(payload)) {
    throw new Error(`Invalid translation ${action} payload.`);
  }
  if ((action === 'translate' || action === 'cancel') &&
      (typeof payload.requestId !== 'string' || !payload.requestId.trim())) {
    throw new Error('A translation request id is required.');
  }
  if (action === 'cancel') return { action, payload: { requestId: payload.requestId as string } };
  if (action === 'translate') {
    if (typeof payload.text !== 'string' || !payload.text.trim()) {
      throw new Error('Select text before translating.');
    }
    return { action, payload: { text: payload.text, requestId: payload.requestId as string } };
  }
  if (action === 'updateSetting') {
    if (!SETTING_KEYS.some(key => key === payload.key)) {
      throw new Error(`Unknown translation setting: ${String(payload.key)}`);
    }
    if (typeof payload.value !== 'string' && typeof payload.value !== 'boolean') {
      throw new Error('Invalid translation setting value.');
    }
    return {
      action,
      payload: {
        key: payload.key as TranslationSettingKey,
        value: payload.value
      }
    };
  }
  throw new Error(`Unsupported translation action: ${action}`);
}
