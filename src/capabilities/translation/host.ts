import * as vscode from 'vscode';
import { INLEAF_IDS } from '../../identity';
import type { WordRecord } from '../../readerDataTypes';
import {
  requireDeepSeekModel,
  requireTranslationProvider,
  type TranslationProvider
} from '../../translationContract';
import { TranslationService } from '../../translationService';
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

  constructor(extensionUri: vscode.Uri, private readonly secrets: vscode.SecretStorage) {
    this.service = new TranslationService(extensionUri, secrets);
  }

  async postInitialState(context: CapabilityHostContext) {
    await context.postEvent(this.id, 'settings', await this.service.getSettings());
  }

  async handle(action: string, payload: unknown, context: CapabilityHostContext) {
    const request = decodeTranslationRequest(action, payload);
    switch (request.action) {
      case 'translate': {
        const sourceText = request.payload.text.trim();
        await context.postEvent(this.id, 'result', {
          sourceText,
          ...await this.service.translate(sourceText)
        });
        return;
      }
      case 'updateSetting':
        await this.updateSetting(request.payload.key, request.payload.value);
        await this.postInitialState(context);
        return;
      case 'configureDeepSeek':
        await vscode.commands.executeCommand(INLEAF_IDS.commands.setDeepSeekApiKey);
        await this.postInitialState(context);
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
    const settings = await this.service.getSettings();
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
    this.service.dispose();
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

function settingConfigurationKey(key: TranslationSettingKey) {
  const mapping: Record<TranslationSettingKey, string> = {
    provider: 'translationProvider',
    deepSeekModel: 'deepSeekModel',
    libreTranslateEndpoint: 'libreTranslateEndpoint',
    argosPythonPath: 'argosPythonPath',
    fallbackToLibreTranslate: 'translationFallbackToLibreTranslate',
    source: 'translationSource',
    target: 'translationTarget'
  };
  return mapping[key];
}
