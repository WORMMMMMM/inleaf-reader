import * as vscode from 'vscode';
import { INLEAF_IDS } from '../../identity';
import type { WordRecord } from '../../readerDataTypes';
import {
  requireDeepSeekModel,
  requireTranslationProvider
} from '../../translationContract';
import { TranslationService } from '../../translationService';
import type { TranslationSettings } from '../../translationTypes';
import type { CapabilityReadiness } from '../contracts';
import type { CapabilityHostContext, HostCapability } from '../hostTypes';
import {
  decodeTranslationRequest,
  type TranslationSettingKey,
  type TranslationSettingValue
} from './protocol';

export class TranslationHostCapability implements HostCapability, vscode.Disposable {
  readonly id = 'translation' as const;
  private readonly service: TranslationService;
  private activeRequest?: { documentId: string; requestId: string; controller: AbortController };
  private settings?: TranslationSettings;

  constructor(extensionUri: vscode.Uri, private readonly secrets: vscode.SecretStorage) {
    this.service = new TranslationService(extensionUri, secrets);
  }

  async postInitialState(context: CapabilityHostContext) {
    this.settings = await this.service.getSettings();
    await context.postEvent(this.id, 'settings', this.settings);
  }

  affectsConfiguration(event: vscode.ConfigurationChangeEvent) {
    return Object.values(TRANSLATION_CONFIGURATION).some(key =>
      event.affectsConfiguration(`${INLEAF_IDS.configuration}.${key}`));
  }

  async refreshSettings(context: CapabilityHostContext) {
    this.cancelPending();
    await this.postInitialState(context);
  }

  async handle(action: string, payload: unknown, context: CapabilityHostContext) {
    const request = decodeTranslationRequest(action, payload);
    switch (request.action) {
      case 'translate': {
        if (this.activeRequest?.documentId === context.documentId &&
            this.activeRequest.requestId === request.payload.requestId) return;
        this.cancelPending();
        const active = { documentId: context.documentId, requestId: request.payload.requestId,
          controller: new AbortController() };
        this.activeRequest = active;
        const sourceText = request.payload.text.trim();
        try {
          const result = await this.service.translate(sourceText, active.controller.signal);
          if (this.activeRequest === active && !active.controller.signal.aborted) {
            await context.postEvent(this.id, 'result', { sourceText, requestId: active.requestId, ...result });
          }
        } catch (error) {
          if (!active.controller.signal.aborted) {
            if (this.activeRequest === active) {
              await context.postEvent(this.id, 'result', { sourceText, requestId: active.requestId,
                error: error instanceof Error ? error.message : String(error) });
            }
            throw error;
          }
        } finally {
          if (this.activeRequest === active) this.activeRequest = undefined;
        }
        return;
      }
      case 'cancel':
        if (this.activeRequest?.documentId === context.documentId &&
            this.activeRequest.requestId === request.payload.requestId) this.cancelPending();
        return;
      case 'updateSetting':
        await this.updateSetting(request.payload.key, request.payload.value);
        return;
      case 'configureDeepSeek':
        await vscode.commands.executeCommand(INLEAF_IDS.commands.setDeepSeekApiKey);
        return;
      case 'diagnose':
        await vscode.commands.executeCommand(INLEAF_IDS.commands.diagnoseTranslation);
        await this.postInitialState(context);
    }
  }

  enrichWord(input: Omit<WordRecord, 'id' | 'createdAt' | 'updatedAt'>) {
    return this.service.enrichWord(input);
  }

  async readiness(): Promise<{ readiness: CapabilityReadiness; readinessMessage?: string }> {
    const settings = this.settings ??= await this.service.getSettings();
    if (settings.provider === 'deepseek' && !settings.hasDeepSeekApiKey) {
      return { readiness: 'needsSetup', readinessMessage: 'DeepSeek API key is not configured.' };
    }
    if (settings.provider === 'argos' && !settings.argosPythonFound) {
      return {
        readiness: 'needsSetup',
        readinessMessage: 'Dictionary lookup is available, but Argos sentence translation needs setup.'
      };
    }
    return { readiness: 'ready' };
  }

  dispose() {
    this.cancelPending();
    this.service.dispose();
  }

  cancelPending() {
    this.activeRequest?.controller.abort();
    this.activeRequest = undefined;
  }

  private async updateSetting(key: TranslationSettingKey, value: TranslationSettingValue) {
    const config = vscode.workspace.getConfiguration(INLEAF_IDS.configuration);
    const configurationKey = settingConfigurationKey(key);
    let normalized: string | boolean = value;
    if (key === 'provider') {
      normalized = requireTranslationProvider(value);
      if (normalized === 'deepseek' && !(await this.secrets.get(INLEAF_IDS.secrets.deepSeekApiKey))) {
        await vscode.commands.executeCommand(INLEAF_IDS.commands.setDeepSeekApiKey);
        if (!(await this.secrets.get(INLEAF_IDS.secrets.deepSeekApiKey))) {
          return;
        }
      }
    } else if (key === 'deepSeekModel') {
      normalized = requireDeepSeekModel(value);
    } else if (key === 'fallbackToLibreTranslate') {
      if (typeof value !== 'boolean') {
        throw new Error('Translation fallback must be a boolean.');
      }
    } else if (typeof value !== 'string') {
      throw new Error(`Translation setting ${key} must be text.`);
    }
    await config.update(configurationKey, normalized, vscode.ConfigurationTarget.Global);
  }
}

const TRANSLATION_CONFIGURATION: Record<TranslationSettingKey, string> = {
  provider: 'translationProvider',
  deepSeekModel: 'deepSeekModel',
  libreTranslateEndpoint: 'libreTranslateEndpoint',
  argosPythonPath: 'argosPythonPath',
  fallbackToLibreTranslate: 'translationFallbackToLibreTranslate',
  source: 'translationSource',
  target: 'translationTarget'
};

function settingConfigurationKey(key: TranslationSettingKey) {
  return TRANSLATION_CONFIGURATION[key];
}
