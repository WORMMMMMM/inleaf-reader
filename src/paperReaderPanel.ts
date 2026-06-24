import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import * as vscode from 'vscode';
import { formatAnnotationMarkdownSnippet } from './annotationExports';
import {
  AnnotationRecord,
  ProgressRecord,
  ReaderStorage,
  WordRecord
} from './readerStorage';

export interface WordDetails {
  word: string;
  phonetic?: string;
  definitions: { pos: string; meaning: string; translation?: string }[];
}

type ReaderMessage =
  | { type: 'ready' }
  | { type: 'saveAnnotation'; payload: Omit<AnnotationRecord, 'id' | 'createdAt' | 'updatedAt'> }
  | {
      type: 'updateAnnotation';
      payload: {
        id: string;
        patch: Partial<Omit<AnnotationRecord, 'id' | 'createdAt' | 'updatedAt'>>;
      };
    }
  | { type: 'deleteAnnotation'; payload: { id: string } }
  | { type: 'restoreAnnotation'; payload: AnnotationRecord }
  | { type: 'copyAnnotationMarkdown'; payload: { id: string } }
  | { type: 'copySelection'; payload: { text: string } }
  | { type: 'exportAnnotations' }
  | { type: 'exportAnnotatedPdf' }
  | { type: 'saveWord'; payload: Omit<WordRecord, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'deleteWord'; payload: { id: string } }
  | { type: 'saveProgress'; payload: ProgressRecord }
  | { type: 'setTranslationMode'; payload: { mode: 'local' | 'deepseek' } }
  | { type: 'configureDeepSeek' }
  | { type: 'translate'; payload: { text: string } };

export class PaperReaderPanel {
  static readonly deepSeekApiKeySecret = 'readingExtension.deepSeekApiKey';
  private static currentPanel: PaperReaderPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private storage: ReaderStorage;
  private disposables: vscode.Disposable[] = [];
  private translationDaemon: cp.ChildProcess | undefined;
  private daemonReady = false;
  private daemonPending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private daemonRequestId = 0;
  private daemonBuffer = '';
  private readonly recoveryNotifications = new WeakSet<ReaderStorage>();

  static createOrShow(
    extensionUri: vscode.Uri,
    secrets: vscode.SecretStorage,
    globalState: vscode.Memento,
    pdfUri: vscode.Uri
  ) {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (PaperReaderPanel.currentPanel) {
      PaperReaderPanel.currentPanel.panel.reveal(column);
      PaperReaderPanel.currentPanel.navigateTo(pdfUri);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'readingExtension.reader',
      `Reader: ${path.basename(pdfUri.fsPath)}`,
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: getLocalResourceRoots(extensionUri, pdfUri)
      }
    );

    PaperReaderPanel.currentPanel = new PaperReaderPanel(
      panel,
      extensionUri,
      secrets,
      globalState,
      pdfUri
    );
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    private readonly secrets: vscode.SecretStorage,
    private readonly globalState: vscode.Memento,
    private pdfUri: vscode.Uri
  ) {
    this.panel = panel;
    this.storage = new ReaderStorage(pdfUri, globalState);
    this.panel.webview.html = this.getHtml();
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (message: ReaderMessage) => this.handleMessage(message),
      null,
      this.disposables
    );
    vscode.workspace.onDidChangeConfiguration(
      event => {
        if (event.affectsConfiguration('readingExtension.translationProvider')) {
          void this.postTranslationSettings();
        }
      },
      null,
      this.disposables
    );
  }

  private async navigateTo(pdfUri: vscode.Uri) {
    this.pdfUri = pdfUri;
    const storage = new ReaderStorage(pdfUri, this.globalState);
    this.storage = storage;
    this.panel.title = `Reader: ${path.basename(pdfUri.fsPath)}`;
    this.panel.webview.options = {
      ...this.panel.webview.options,
      localResourceRoots: getLocalResourceRoots(this.extensionUri, pdfUri)
    };
    await this.prepareStorage(storage);
    if (storage !== this.storage) {
      return;
    }
    const pdfWebviewUri = this.panel.webview.asWebviewUri(pdfUri);
    await this.panel.webview.postMessage({
      type: 'navigateTo',
      payload: {
        pdfUrl: pdfWebviewUri.toString(),
        paperName: path.basename(pdfUri.fsPath)
      }
    });
    await this.postState();
  }

  private async handleMessage(message: ReaderMessage) {
    try {
      await this.dispatchMessage(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.panel.webview.postMessage({
        type: 'stateError',
        payload: { message }
      });
      vscode.window.showErrorMessage(message);
    }
  }

  private async dispatchMessage(message: ReaderMessage) {
    switch (message.type) {
      case 'ready':
        await this.postState();
        break;
      case 'saveAnnotation':
        await this.storage.addAnnotation(message.payload);
        await this.postState();
        break;
      case 'updateAnnotation':
        await this.storage.updateAnnotation(message.payload.id, message.payload.patch);
        await this.postState();
        break;
      case 'deleteAnnotation':
        await this.storage.deleteAnnotation(message.payload.id);
        await this.postState();
        break;
      case 'restoreAnnotation':
        await this.storage.restoreAnnotation(message.payload);
        await this.postState();
        await this.postAnnotationActionResult('Annotation restored.');
        break;
      case 'copyAnnotationMarkdown':
        await this.copyAnnotationMarkdown(message.payload.id);
        break;
      case 'copySelection':
        await vscode.env.clipboard.writeText(message.payload.text);
        await this.panel.webview.postMessage({
          type: 'clipboardResult',
          payload: { message: 'Selected text copied.' }
        });
        break;
      case 'exportAnnotations':
        await this.exportAnnotations();
        break;
      case 'exportAnnotatedPdf':
        await this.exportAnnotatedPdf();
        break;
      case 'saveWord':
        await this.saveWord(message.payload);
        await this.postState();
        break;
      case 'deleteWord':
        await this.storage.deleteWord(message.payload.id);
        await this.postState();
        break;
      case 'saveProgress':
        await this.storage.saveProgress(message.payload);
        break;
      case 'setTranslationMode':
        await this.setTranslationMode(message.payload.mode);
        break;
      case 'configureDeepSeek':
        await vscode.commands.executeCommand('readingExtension.setDeepSeekApiKey');
        await this.postTranslationSettings();
        break;
      case 'translate':
        await this.translate(message.payload.text);
        break;
    }
  }

  private async postState() {
    const storage = this.storage;
    const pdfUri = this.pdfUri;
    await this.prepareStorage(storage);
    if (storage !== this.storage) {
      return;
    }
    const [annotations, words, progress] = await Promise.all([
      storage.readAnnotations(),
      storage.readWords(),
      storage.readProgress()
    ]);
    if (storage !== this.storage) {
      return;
    }

    await this.panel.webview.postMessage({
      type: 'state',
      payload: {
        annotations,
        words,
        progress,
        paperName: path.basename(pdfUri.fsPath)
      }
    });
    await this.postTranslationSettings();
  }

  private async prepareStorage(storage: ReaderStorage) {
    const result = await storage.prepare();
    if (!result.recoveredFrom || this.recoveryNotifications.has(storage)) {
      return;
    }

    this.recoveryNotifications.add(storage);
    vscode.window.showInformationMessage(
      `Recovered ${result.recoveredFiles} reader data file${result.recoveredFiles === 1 ? '' : 's'} from the PDF's previous location.`
    );
  }

  private async setTranslationMode(mode: 'local' | 'deepseek') {
    if (mode === 'deepseek' && !(await this.secrets.get(PaperReaderPanel.deepSeekApiKeySecret))) {
      await vscode.commands.executeCommand('readingExtension.setDeepSeekApiKey');
      if (!(await this.secrets.get(PaperReaderPanel.deepSeekApiKeySecret))) {
        await this.postTranslationSettings();
        return;
      }
    } else {
      await vscode.workspace
        .getConfiguration('readingExtension')
        .update('translationProvider', mode === 'deepseek' ? 'deepseek' : 'argos', vscode.ConfigurationTarget.Global);
    }
    await this.postTranslationSettings();
  }

  private async postTranslationSettings() {
    const provider = vscode.workspace
      .getConfiguration('readingExtension')
      .get<string>('translationProvider') || 'argos';
    await this.panel.webview.postMessage({
      type: 'translationSettings',
      payload: {
        mode: provider === 'deepseek' ? 'deepseek' : 'local',
        hasDeepSeekApiKey: !!(await this.secrets.get(PaperReaderPanel.deepSeekApiKeySecret))
      }
    });
  }

  private async saveWord(input: Omit<WordRecord, 'id' | 'createdAt' | 'updatedAt'>) {
    const word = input.word.trim();
    if (!word) {
      throw new Error('No word provided.');
    }

    let enriched = { ...input, word };
    if (this.isSingleWord(word)) {
      try {
        const result = await this.lookupWordDetails(word);
        if (result.wordDetails) {
          enriched = {
            ...enriched,
            phonetic: input.phonetic || result.wordDetails.phonetic,
            definitions: input.definitions || result.wordDetails.definitions,
            translation: input.translation || compactWordTranslation(result.wordDetails) || result.translatedText
          };
        } else if (!input.translation && result.translatedText) {
          enriched.translation = result.translatedText;
        }
      } catch {
        // Word saving should still work even if local dictionary lookup fails.
      }
    }

    await this.storage.addWord(enriched);
  }

  private async translate(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      await this.postTranslationResult('', '', undefined, 'Select or paste text before translating.');
      return;
    }

    try {
      const result = await this.translateWithLocalProvider(trimmed);
      await this.postTranslationResult(
        trimmed,
        result.translatedText,
        result.wordDetails,
        result.error
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.postTranslationResult(trimmed, '', undefined, message);
    }
  }

  private async translateWithLocalProvider(text: string): Promise<{
    translatedText?: string;
    wordDetails?: WordDetails;
    error?: string;
  }> {
    const config = vscode.workspace.getConfiguration('readingExtension');
    const provider = config.get<string>('translationProvider') || 'argos';

    if (provider === 'deepseek') {
      if (this.isSingleWord(text)) {
        try {
          const dictionaryResult = await this.lookupWordDetails(text);
          if (dictionaryResult.wordDetails) {
            return dictionaryResult;
          }
        } catch {
          // DeepSeek remains available when the optional local dictionary cannot start.
        }
      }
      try {
        const translatedText = await this.translateWithDeepSeek(text);
        return { translatedText };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { error: message };
      }
    }

    if (provider === 'argos') {
      try {
        return await this.translateWithDaemon(text);
      } catch {
        if (config.get<boolean>('translationFallbackToLibreTranslate') === false) {
          throw new Error('Local translation failed and fallback is disabled.');
        }
      }
    }

    try {
      const translatedText = await this.translateWithLibreTranslate(text);
      return { translatedText };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { error: message };
    }
  }

  private isSingleWord(text: string) {
    const trimmed = text.trim();
    // Single word: no spaces, no sentence-ending punctuation
    return /^[a-zA-Z'-]+$/.test(trimmed) && trimmed.length > 1;
  }

  private async translateWithDaemon(text: string): Promise<{
    translatedText?: string;
    wordDetails?: WordDetails;
  }> {
    const config = vscode.workspace.getConfiguration('readingExtension');
    const source = normalizeArgosLanguage(config.get<string>('translationSource') || 'auto', 'en');
    const target = normalizeArgosLanguage(config.get<string>('translationTarget') || 'zh', 'zh');
    const mode = this.isSingleWord(text) ? 'dict' : 'translate';

    await this.ensureDaemon();
    const result = await this.daemonRequest<{
      translatedText?: string;
      wordDetails?: WordDetails;
      error?: string;
    }>({ text, source, target, mode });

    if (result.error) {
      throw new Error(result.error);
    }

    return result;
  }

  private async lookupWordDetails(text: string): Promise<{
    translatedText?: string;
    wordDetails?: WordDetails;
  }> {
    const config = vscode.workspace.getConfiguration('readingExtension');
    const source = normalizeArgosLanguage(config.get<string>('translationSource') || 'auto', 'en');
    const target = normalizeArgosLanguage(config.get<string>('translationTarget') || 'zh', 'zh');

    await this.ensureDaemon();
    const result = await this.daemonRequest<{
      translatedText?: string;
      wordDetails?: WordDetails;
      error?: string;
    }>({ text, source, target, mode: 'dict' });

    if (result.error) {
      throw new Error(result.error);
    }

    return result;
  }

  private async ensureDaemon() {
    if (this.translationDaemon && this.daemonReady) {
      return;
    }

    // Kill stale daemon if it exists but isn't ready
    if (this.translationDaemon) {
      this.killDaemon();
    }

    const config = vscode.workspace.getConfiguration('readingExtension');
    const configuredPython = config.get<string>('argosPythonPath')?.trim();
    const pythonPath = configuredPython || path.join(this.extensionUri.fsPath, '.venv-translate', 'bin', 'python');
    const daemonPath = path.join(this.extensionUri.fsPath, 'scripts', 'argos_translate_daemon.py');

    if (!fs.existsSync(pythonPath)) {
      throw new Error(`Argos Python not found at ${pythonPath}.`);
    }
    if (!fs.existsSync(daemonPath)) {
      throw new Error(`Daemon script not found at ${daemonPath}.`);
    }

    this.translationDaemon = cp.spawn(pythonPath, [daemonPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stderr = '';
    this.translationDaemon.stderr?.on('data', chunk => {
      stderr += chunk.toString();
    });

    this.translationDaemon.on('error', () => {
      this.daemonReady = false;
    });

    this.translationDaemon.on('close', () => {
      this.daemonReady = false;
      // Reject all pending requests
      for (const { reject } of this.daemonPending.values()) {
        reject(new Error('Translation daemon exited unexpectedly.'));
      }
      this.daemonPending.clear();
    });

    // Accumulate stdout and dispatch responses
    this.daemonBuffer = '';
    this.translationDaemon.stdout?.on('data', chunk => {
      this.daemonBuffer += chunk.toString();
      const lines = this.daemonBuffer.split('\n');
      // Keep the last (potentially incomplete) line in the buffer
      this.daemonBuffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line.trim());
          if (parsed.ready) {
            this.daemonReady = true;
            continue;
          }
          // Resolve the oldest pending request
          const next = this.daemonPending.entries().next();
          if (next.done) continue;
          const [id, pending] = next.value;
          if (pending && id !== undefined) {
            this.daemonPending.delete(id);
            pending.resolve(parsed);
          }
        } catch {
          // Ignore non-JSON lines (e.g. stray stderr mixed in)
        }
      }
    });

    // Wait for ready signal
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.killDaemon();
        reject(new Error('Translation daemon failed to start within 60 seconds.'));
      }, 60000);

      const checkReady = () => {
        if (this.daemonReady) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };
      checkReady();
    });
  }

  private daemonRequest<T>(payload: object): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = ++this.daemonRequestId;
      const wrappedResolver = (value: unknown) => {
        clearTimeout(timeout);
        resolve(value as T);
      };
      const wrappedRejecter = (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      };
      this.daemonPending.set(id, {
        resolve: wrappedResolver,
        reject: wrappedRejecter
      });

      const timeout = setTimeout(() => {
        this.daemonPending.delete(id);
        this.killDaemon();
        reject(new Error('Translation daemon request timed out.'));
      }, 30000);

      this.translationDaemon?.stdin?.write(JSON.stringify(payload) + '\n');
    });
  }

  private killDaemon() {
    if (this.translationDaemon) {
      this.translationDaemon.kill();
      this.translationDaemon = undefined;
    }
    this.daemonReady = false;
    this.daemonBuffer = '';
    for (const { reject } of this.daemonPending.values()) {
      reject(new Error('Translation daemon was killed.'));
    }
    this.daemonPending.clear();
  }

  private postTranslationResult(
    sourceText: string,
    translatedText?: string,
    wordDetails?: WordDetails,
    error?: string
  ) {
    return this.panel.webview.postMessage({
      type: 'translationResult',
      payload: { sourceText, translatedText, wordDetails, error }
    });
  }

  private async translateWithDeepSeek(text: string) {
    const apiKey = await this.secrets.get(PaperReaderPanel.deepSeekApiKeySecret);
    if (!apiKey) {
      throw new Error('DeepSeek API key is not configured. Run “Reading Extension: Set DeepSeek API Key”.');
    }

    const config = vscode.workspace.getConfiguration('readingExtension');
    const model = config.get<string>('deepSeekModel') || 'deepseek-v4-flash';
    const target = describeTargetLanguage(config.get<string>('translationTarget') || 'zh');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: `You are a professional academic translator. Translate the user's text into ${target}. Preserve formulas, citations, terminology, paragraph structure, and proper nouns accurately. Return only the translation, without commentary or quotation marks.`
            },
            {
              role: 'user',
              content: text
            }
          ],
          thinking: { type: 'disabled' },
          max_tokens: 4096,
          stream: false
        }),
        signal: controller.signal
      });

      const responseText = await response.text();
      let data: {
        choices?: { message?: { content?: string | null } }[];
        error?: { message?: string };
      } = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        if (!response.ok) {
          throw new Error(`DeepSeek returned HTTP ${response.status}.`);
        }
        throw new Error('DeepSeek returned an invalid response.');
      }

      if (!response.ok) {
        const detail = data.error?.message?.trim();
        if (response.status === 401) {
          throw new Error('DeepSeek rejected the API key. Run “Reading Extension: Set DeepSeek API Key” with a valid key.');
        }
        throw new Error(detail || `DeepSeek returned HTTP ${response.status}.`);
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
    const config = vscode.workspace.getConfiguration('readingExtension');
    const endpoint = config.get<string>('libreTranslateEndpoint') || 'http://localhost:5000/translate';
    const source = config.get<string>('translationSource') || 'auto';
    const target = config.get<string>('translationTarget') || 'zh';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, source, target, format: 'text' }),
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
        throw new Error('Could not reach LibreTranslate. Start the local server or change readingExtension.libreTranslateEndpoint.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async exportAnnotations() {
    try {
      const uri = await this.storage.exportAnnotationsMarkdown();
      await this.panel.webview.postMessage({
        type: 'exportResult',
        payload: {
          path: uri.fsPath
        }
      });
      vscode.window.showInformationMessage(`Annotations exported: ${uri.fsPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.panel.webview.postMessage({
        type: 'exportResult',
        payload: {
          error: message
        }
      });
    }
  }

  private async copyAnnotationMarkdown(id: string) {
    try {
      const annotations = await this.storage.readAnnotations();
      const annotation = annotations.find(item => item.id === id);
      if (!annotation) {
        throw new Error('Annotation not found.');
      }

      await vscode.env.clipboard.writeText(formatAnnotationMarkdownSnippet(annotation));
      await this.panel.webview.postMessage({
        type: 'clipboardResult',
        payload: {
          message: 'Annotation Markdown copied.'
        }
      });
      vscode.window.showInformationMessage('Annotation Markdown copied.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.panel.webview.postMessage({
        type: 'clipboardResult',
        payload: {
          error: message
        }
      });
    }
  }

  private async postAnnotationActionResult(message: string, error?: string) {
    await this.panel.webview.postMessage({
      type: 'annotationActionResult',
      payload: {
        message,
        error
      }
    });
  }

  private async exportAnnotatedPdf() {
    try {
      const uri = await this.storage.exportAnnotatedPdf();
      await this.panel.webview.postMessage({
        type: 'exportResult',
        payload: {
          path: uri.fsPath
        }
      });
      vscode.window.showInformationMessage(`Annotated PDF exported: ${uri.fsPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.panel.webview.postMessage({
        type: 'exportResult',
        payload: {
          error: message
        }
      });
    }
  }

  private getHtml(): string {
    const webview = this.panel.webview;
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'reader-app.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'reader-app.css')
    );
    const pdfWebviewUri = webview.asWebviewUri(this.pdfUri);
    const cMapUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'pdfjs-dist', 'cmaps')
    );
    const standardFontDataUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'pdfjs-dist', 'standard_fonts')
    );
    const config = vscode.workspace.getConfiguration('readingExtension');
    const nonce = getNonce();
    const readerConfig = JSON.stringify({
      pdfUrl: pdfWebviewUri.toString(),
      paperName: path.basename(this.pdfUri.fsPath),
      translationProvider: config.get<string>('translationProvider') || 'argos',
      translationSource: config.get<string>('translationSource') || 'auto',
      translationTarget: config.get<string>('translationTarget') || 'zh',
      pdfCMapUrl: ensureTrailingSlash(cMapUri.toString()),
      pdfStandardFontDataUrl: ensureTrailingSlash(standardFontDataUri.toString())
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src ${webview.cspSource}; img-src ${webview.cspSource} data:; font-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}' ${webview.cspSource}; worker-src ${webview.cspSource} blob: data:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
  <title>Reading Extension</title>
</head>
<body>
  <main id="startupStatus" class="startup-state">
    <h1>Starting reader...</h1>
    <p>Loading the Webview script.</p>
  </main>
  <div id="root"></div>
  <script nonce="${nonce}">
    const showStartupError = error => {
      if (document.body.classList.contains('reader-mounted')) {
        return;
      }
      const status = document.getElementById('startupStatus');
      if (status) {
        status.className = 'startup-state startup-error';
        status.innerHTML = '<h1>Reader failed to start</h1><pre></pre>';
        status.querySelector('pre').textContent = error;
      }
    };
    window.process = window.process || { env: {} };
    window.process.env = {
      ...window.process.env,
      NODE_ENV: 'production',
      DRAGGABLE_DEBUG: ''
    };
    window.readerConfig = ${readerConfig};
    window.addEventListener('error', event => {
      showStartupError(event.message || String(event.error || 'Unknown Webview error'));
    });
    window.addEventListener('unhandledrejection', event => {
      showStartupError(event.reason instanceof Error ? event.reason.message : String(event.reason || 'Unhandled promise rejection'));
    });
  </script>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private dispose() {
    this.killDaemon();
    PaperReaderPanel.currentPanel = undefined;
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      disposable?.dispose();
    }
  }
}

function getNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

function getLocalResourceRoots(extensionUri: vscode.Uri, pdfUri: vscode.Uri) {
  return [
    extensionUri,
    vscode.Uri.file(path.dirname(pdfUri.fsPath))
  ];
}

function ensureTrailingSlash(value: string) {
  return value.endsWith('/') ? value : `${value}/`;
}

function normalizeArgosLanguage(value: string, fallback: string) {
  const normalized = value.toLowerCase();
  if (normalized === 'auto') {
    return fallback;
  }
  if (normalized === 'zh-cn' || normalized === 'zh_hans' || normalized === 'zh-hans') {
    return 'zh';
  }
  if (normalized === 'zh-tw' || normalized === 'zh_hant' || normalized === 'zh-hant') {
    return 'zt';
  }
  return normalized;
}

function describeTargetLanguage(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === 'zh' || normalized === 'zh-cn' || normalized === 'zh-hans' || normalized === 'zh_hans') {
    return 'Simplified Chinese';
  }
  if (normalized === 'zh-tw' || normalized === 'zh-hant' || normalized === 'zh_hant' || normalized === 'zt') {
    return 'Traditional Chinese';
  }
  return value;
}

function compactWordTranslation(details: WordDetails) {
  const translations = details.definitions
    .map(item => item.translation || (containsCjk(item.meaning) ? item.meaning : ''))
    .map(item => item.trim())
    .filter(Boolean);
  return [...new Set(translations)].slice(0, 3).join('; ');
}

function containsCjk(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

function runProcess(command: string, args: string[], stdin: string, timeoutMs: number) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = cp.spawn(command, args, {
      cwd: path.dirname(command),
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('Local translation timed out.'));
    }, timeoutMs);

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });
    child.on('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', code => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(stderr || stdout || `Local translation exited with code ${code}.`));
    });

    child.stdin.end(stdin);
  });
}
