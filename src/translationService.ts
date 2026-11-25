import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ArgosTranslationDaemon } from './argosTranslationDaemon';
import { EcdictClient } from './ecdictClient';
import {
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_MODEL,
  isLocalOpenAiEndpoint,
  requireDeepSeekModel,
  requireTranslationProvider,
  resolveOpenAiChatUrl,
  TranslationProvider
} from './translationContract';
import { INLEAF_IDS } from './identity';
import type { WordRecord } from './readerDataTypes';
import type { TranslationResult, TranslationSettings, WordDetails } from './translationTypes';

/**
 * Owns every translation provider and its runtime resources.
 *
 * The reader panel only coordinates UI messages. Provider selection, dictionary
 * enrichment, network requests, and the long-lived Argos process stay behind
 * this small interface so they can evolve independently from the Webview.
 */
export class TranslationService implements vscode.Disposable {
  private readonly dictionary: EcdictClient;
  private readonly argos: ArgosTranslationDaemon;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly secrets: vscode.SecretStorage
  ) {
    this.dictionary = new EcdictClient(extensionUri);
    this.argos = new ArgosTranslationDaemon(
      () => this.argosPythonPath(vscode.workspace.getConfiguration(INLEAF_IDS.configuration)),
      this.extensionPath('scripts', 'argos_translate_daemon.py')
    );
  }

  async getSettings(): Promise<TranslationSettings> {
    const config = vscode.workspace.getConfiguration(INLEAF_IDS.configuration);
    const provider = configuredProvider(config);
    return {
      provider,
      deepSeekModel: requireDeepSeekModel(config.get('deepSeekModel')),
      openAiBaseUrl: config.get<string>('openAiBaseUrl')?.trim() || DEFAULT_OPENAI_BASE_URL,
      openAiModel: config.get<string>('openAiModel')?.trim() || DEFAULT_OPENAI_MODEL,
      libreTranslateEndpoint: config.get<string>('libreTranslateEndpoint') || 'http://localhost:5000/translate',
      argosPythonPath: config.get<string>('argosPythonPath') || '',
      fallbackToLibreTranslate: config.get<boolean>('translationFallbackToLibreTranslate') ?? false,
      source: config.get<string>('translationSource') || 'auto',
      target: config.get<string>('translationTarget') || 'zh',
      hasDeepSeekApiKey: !!(await this.secrets.get(INLEAF_IDS.secrets.deepSeekApiKey)),
      hasOpenAiApiKey: !!(await this.secrets.get(INLEAF_IDS.secrets.openAiApiKey)),
      dictionaryReady: fs.existsSync(this.extensionPath('scripts', 'ecdict', 'manifest.json')),
      argosPythonFound: fs.existsSync(this.argosPythonPath(config))
    };
  }

  async translate(text: string, signal?: AbortSignal): Promise<TranslationResult> {
    signal?.throwIfAborted();
    const trimmed = text.trim();
    if (!trimmed) {
      return { error: 'Select or paste text before translating.' };
    }

    const config = vscode.workspace.getConfiguration(INLEAF_IDS.configuration);
    const provider = configuredProvider(config);

    if (isSingleEnglishWord(trimmed)) {
      try {
        const dictionaryResult = await this.lookupWordDetails(trimmed);
        signal?.throwIfAborted();
        if (dictionaryResult.wordDetails) {
          return dictionaryResult;
        }
      } catch {
        // A missing dictionary must not disable the configured sentence provider.
      }
    }

    signal?.throwIfAborted();

    if (provider === 'deepseek') {
      return this.captureProviderError(() => this.translateWithDeepSeek(trimmed, signal));
    }

    if (provider === 'openai') {
      return this.captureProviderError(() => this.translateWithOpenAiCompatible(trimmed, signal));
    }

    if (provider === 'argos') {
      try {
        return await this.translateWithDaemon(trimmed, signal);
      } catch (error) {
        signal?.throwIfAborted();
        if (config.get<boolean>('translationFallbackToLibreTranslate') === false) {
          const detail = error instanceof Error ? error.message : String(error);
          return {
            error: `Local Argos translation failed: ${detail} Run “Inleaf Reader: Diagnose Translation Setup” for details.`
          };
        }
      }
    }

    return this.captureProviderError(() => this.translateWithLibreTranslate(trimmed, signal));
  }

  async enrichWord(
    input: Omit<WordRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Omit<WordRecord, 'id' | 'createdAt' | 'updatedAt'>> {
    const word = input.word.trim();
    if (!word) {
      throw new Error('No word provided.');
    }
    if (!isSingleEnglishWord(word)) {
      return { ...input, word };
    }

    try {
      const result = await this.lookupWordDetails(word);
      if (result.wordDetails) {
        return {
          ...input,
          word,
          phonetic: input.phonetic || result.wordDetails.phonetic,
          definitions: input.definitions || result.wordDetails.definitions,
          translation: input.translation || compactWordTranslation(result.wordDetails) || result.translatedText
        };
      }
      return {
        ...input,
        word,
        translation: input.translation || result.translatedText
      };
    } catch {
      // Saving a word is more important than optional dictionary enrichment.
      return { ...input, word };
    }
  }

  dispose() {
    this.argos.dispose();
    this.dictionary.dispose();
  }

  private async captureProviderError(
    provider: () => Promise<string>
  ): Promise<TranslationResult> {
    try {
      return { translatedText: await provider() };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async lookupWordDetails(text: string): Promise<TranslationResult> {
    const wordDetails = await this.dictionary.lookup(text);
    return {
      wordDetails,
      translatedText: wordDetails ? compactWordTranslation(wordDetails) : undefined
    };
  }

  private async translateWithDaemon(text: string, signal?: AbortSignal): Promise<TranslationResult> {
    const config = vscode.workspace.getConfiguration(INLEAF_IDS.configuration);
    const source = normalizeArgosLanguage(config.get<string>('translationSource') || 'auto', 'en');
    const target = normalizeArgosLanguage(config.get<string>('translationTarget') || 'zh', 'zh');
    const result = await this.argos.request<TranslationResult>({ text, source, target, mode: 'translate' }, signal);
    if (result.error) {
      throw new Error(result.error);
    }
    return result;
  }

  private async translateWithDeepSeek(text: string, signal?: AbortSignal) {
    const apiKey = await this.secrets.get(INLEAF_IDS.secrets.deepSeekApiKey);
    if (!apiKey) {
      throw new Error('DeepSeek API key is not configured. Run “Inleaf Reader: Set DeepSeek API Key”.');
    }
    const config = vscode.workspace.getConfiguration(INLEAF_IDS.configuration);
    const model = requireDeepSeekModel(config.get('deepSeekModel'));
    const target = describeTargetLanguage(config.get<string>('translationTarget') || 'zh');
    const extraBody = model.startsWith('deepseek-v4-') ? { thinking: { type: 'disabled' } } : {};
    return this.requestChatCompletion({
      providerLabel: 'DeepSeek',
      endpoint: 'https://api.deepseek.com/chat/completions',
      apiKey,
      model,
      target,
      text,
      extraBody,
      unauthorizedHint: 'DeepSeek rejected the API key. Run “Inleaf Reader: Set DeepSeek API Key” with a valid key.',
      signal
    });
  }

  private async translateWithOpenAiCompatible(text: string, signal?: AbortSignal) {
    const config = vscode.workspace.getConfiguration(INLEAF_IDS.configuration);
    const baseUrl = config.get<string>('openAiBaseUrl')?.trim() || DEFAULT_OPENAI_BASE_URL;
    const endpoint = resolveOpenAiChatUrl(baseUrl);
    const model = config.get<string>('openAiModel')?.trim() || DEFAULT_OPENAI_MODEL;
    const apiKey = await this.secrets.get(INLEAF_IDS.secrets.openAiApiKey);
    if (!apiKey && !isLocalOpenAiEndpoint(baseUrl)) {
      throw new Error('OpenAI-compatible API key is not configured. Run “Inleaf Reader: Set OpenAI-Compatible API Key”.');
    }
    const target = describeTargetLanguage(config.get<string>('translationTarget') || 'zh');
    return this.requestChatCompletion({
      providerLabel: 'OpenAI-compatible endpoint',
      endpoint,
      apiKey: apiKey || undefined,
      model,
      target,
      text,
      unauthorizedHint: 'The endpoint rejected the API key. Run “Inleaf Reader: Set OpenAI-Compatible API Key” with a valid key.',
      signal
    });
  }

  private async requestChatCompletion(options: {
    providerLabel: string;
    endpoint: string;
    apiKey?: string;
    model: string;
    target: string;
    text: string;
    extraBody?: Record<string, unknown>;
    unauthorizedHint: string;
    signal?: AbortSignal;
  }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options.apiKey) {
      headers.Authorization = `Bearer ${options.apiKey}`;
    }

    try {
      const response = await fetch(options.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: options.model,
          messages: [
            {
              role: 'system',
              content: `You are a professional academic translator. Translate the user's text into ${options.target}. Preserve formulas, citations, terminology, paragraph structure, and proper nouns accurately. Return only the translation, without commentary or quotation marks.`
            },
            { role: 'user', content: options.text }
          ],
          ...(options.extraBody ?? {}),
          max_tokens: 4096,
          stream: false
        }),
        signal: options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal
      });
      const responseText = await response.text();
      let data: { choices?: { message?: { content?: string | null } }[]; error?: { message?: string } } = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error(
          response.ok
            ? `${options.providerLabel} returned an invalid response.`
            : `${options.providerLabel} returned HTTP ${response.status}.`
        );
      }
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(options.unauthorizedHint);
        }
        throw new Error(data.error?.message?.trim() || `${options.providerLabel} returned HTTP ${response.status}.`);
      }
      const translatedText = data.choices?.[0]?.message?.content?.trim();
      if (!translatedText) {
        throw new Error(`${options.providerLabel} response did not include translated text.`);
      }
      return translatedText;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`${options.providerLabel} translation timed out.`);
      }
      if (error instanceof TypeError) {
        throw new Error(`Could not reach ${options.providerLabel}. Check your endpoint and network connection.`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async translateWithLibreTranslate(text: string, signal?: AbortSignal) {
    const config = vscode.workspace.getConfiguration(INLEAF_IDS.configuration);
    const endpoint = config.get<string>('libreTranslateEndpoint') || 'http://localhost:5000/translate';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          source: config.get<string>('translationSource') || 'auto',
          target: config.get<string>('translationTarget') || 'zh',
          format: 'text'
        }),
        signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
      });
      if (!response.ok) {
        throw new Error(`LibreTranslate returned HTTP ${response.status}.`);
      }
      const data = await response.json() as { translatedText?: string; error?: string };
      if (data.error) {
        throw new Error(data.error);
      }
      if (!data.translatedText) {
        throw new Error('LibreTranslate response did not include translatedText.');
      }
      return data.translatedText;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('LibreTranslate request timed out. Is the local server running?');
      }
      if (error instanceof TypeError) {
        throw new Error('Could not reach LibreTranslate. Start the local server or change inleafReader.libreTranslateEndpoint.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private argosPythonPath(config: vscode.WorkspaceConfiguration) {
    return config.get<string>('argosPythonPath')?.trim()
      || this.extensionPath('.venv-translate', 'bin', 'python');
  }

  private extensionPath(...segments: string[]) {
    return path.join(this.extensionUri.fsPath, ...segments);
  }
}

function configuredProvider(config: vscode.WorkspaceConfiguration): TranslationProvider {
  return requireTranslationProvider(config.get('translationProvider'));
}

export function isSingleEnglishWord(text: string) {
  const trimmed = text.trim();
  return /^[a-zA-Z'-]+$/.test(trimmed) && trimmed.length > 1;
}

export function normalizeArgosLanguage(value: string, fallback: string) {
  const normalized = value.toLowerCase();
  if (normalized === 'auto') return fallback;
  if (['zh-cn', 'zh_hans', 'zh-hans'].includes(normalized)) return 'zh';
  if (['zh-tw', 'zh_hant', 'zh-hant'].includes(normalized)) return 'zt';
  return normalized;
}

export function describeTargetLanguage(value: string) {
  const normalized = value.toLowerCase();
  if (['zh', 'zh-cn', 'zh-hans', 'zh_hans'].includes(normalized)) return 'Simplified Chinese';
  if (['zh-tw', 'zh-hant', 'zh_hant', 'zt'].includes(normalized)) return 'Traditional Chinese';
  return value;
}

export function compactWordTranslation(details: WordDetails) {
  const translations = details.definitions
    .map(item => item.translation || (/[\u3400-\u9fff]/.test(item.meaning) ? item.meaning : ''))
    .map(item => item.trim())
    .filter(Boolean);
  return [...new Set(translations)].slice(0, 3).join('; ');
}
