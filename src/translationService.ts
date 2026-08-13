import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ArgosTranslationDaemon } from './argosTranslationDaemon';
import { EcdictClient } from './ecdictClient';
import { INLEAF_IDS } from './identity';
import type { WordRecord } from './readerStorage';
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
    const provider = config.get<string>('translationProvider') || 'argos';
    return {
      mode: provider === 'deepseek' ? 'deepseek' : 'local',
      provider,
      hasDeepSeekApiKey: !!(await this.secrets.get(INLEAF_IDS.secrets.deepSeekApiKey)),
      dictionaryReady: fs.existsSync(this.extensionPath('scripts', 'ecdict_compact.json.gz')),
      argosPythonFound: fs.existsSync(this.argosPythonPath(config))
    };
  }

  async translate(text: string): Promise<TranslationResult> {
    const trimmed = text.trim();
    if (!trimmed) {
      return { error: 'Select or paste text before translating.' };
    }

    const config = vscode.workspace.getConfiguration(INLEAF_IDS.configuration);
    const provider = config.get<string>('translationProvider') || 'argos';

    if (isSingleEnglishWord(trimmed)) {
      try {
        const dictionaryResult = await this.lookupWordDetails(trimmed);
        if (dictionaryResult.wordDetails) {
          return dictionaryResult;
        }
      } catch {
        // A missing dictionary must not disable the configured sentence provider.
      }
    }

    if (provider === 'deepseek') {
      return this.captureProviderError(() => this.translateWithDeepSeek(trimmed));
    }

    if (provider === 'argos') {
      try {
        return await this.translateWithDaemon(trimmed);
      } catch (error) {
        if (config.get<boolean>('translationFallbackToLibreTranslate') === false) {
          const detail = error instanceof Error ? error.message : String(error);
          return {
            error: `Local Argos translation failed: ${detail} Run “Inleaf Reader: Diagnose Translation Setup” for details.`
          };
        }
      }
    }

    return this.captureProviderError(() => this.translateWithLibreTranslate(trimmed));
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

  private async translateWithDaemon(text: string): Promise<TranslationResult> {
    const config = vscode.workspace.getConfiguration(INLEAF_IDS.configuration);
    const source = normalizeArgosLanguage(config.get<string>('translationSource') || 'auto', 'en');
    const target = normalizeArgosLanguage(config.get<string>('translationTarget') || 'zh', 'zh');
    const result = await this.argos.request<TranslationResult>({ text, source, target, mode: 'translate' });
    if (result.error) {
      throw new Error(result.error);
    }
    return result;
  }

  private async translateWithDeepSeek(text: string) {
    const apiKey = await this.secrets.get(INLEAF_IDS.secrets.deepSeekApiKey);
    if (!apiKey) {
      throw new Error('DeepSeek API key is not configured. Run “Inleaf Reader: Set DeepSeek API Key”.');
    }
    const config = vscode.workspace.getConfiguration(INLEAF_IDS.configuration);
    const model = config.get<string>('deepSeekModel') || 'deepseek-v4-flash';
    const target = describeTargetLanguage(config.get<string>('translationTarget') || 'zh');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: `You are a professional academic translator. Translate the user's text into ${target}. Preserve formulas, citations, terminology, paragraph structure, and proper nouns accurately. Return only the translation, without commentary or quotation marks.`
            },
            { role: 'user', content: text }
          ],
          thinking: { type: 'disabled' },
          max_tokens: 4096,
          stream: false
        }),
        signal: controller.signal
      });
      const responseText = await response.text();
      let data: { choices?: { message?: { content?: string | null } }[]; error?: { message?: string } } = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error(response.ok ? 'DeepSeek returned an invalid response.' : `DeepSeek returned HTTP ${response.status}.`);
      }
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('DeepSeek rejected the API key. Run “Inleaf Reader: Set DeepSeek API Key” with a valid key.');
        }
        throw new Error(data.error?.message?.trim() || `DeepSeek returned HTTP ${response.status}.`);
      }
      const translatedText = data.choices?.[0]?.message?.content?.trim();
      if (!translatedText) {
        throw new Error('DeepSeek response did not include translated text.');
      }
      return translatedText;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('DeepSeek translation timed out.');
      }
      if (error instanceof TypeError) {
        throw new Error('Could not reach the DeepSeek API. Check your network connection.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async translateWithLibreTranslate(text: string) {
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
        signal: controller.signal
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
