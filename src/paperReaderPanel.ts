import * as path from 'path';
import * as vscode from 'vscode';
import { INLEAF_IDS } from './identity';
import type { ReaderMessage } from './readerMessages';
import { ReaderStorage } from './readerStorage';
import { HostCapabilityRegistry } from './capabilities/hostRegistry';
import { CapabilityPreferenceService } from './capabilities/preferences';
import type { CapabilityId } from './capabilities/contracts';

export class PaperReaderPanel {
  private static currentPanel: PaperReaderPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private storage: ReaderStorage;
  private documentId = getNonce();
  private readonly storageSessions = new Map<string, ReaderStorage>();
  private disposables: vscode.Disposable[] = [];
  private readonly recoveryNotifications = new WeakSet<ReaderStorage>();
  private readonly capabilities: HostCapabilityRegistry;
  private readonly capabilityPreferences = new CapabilityPreferenceService();

  static createOrShow(
    extensionUri: vscode.Uri,
    secrets: vscode.SecretStorage,
    globalState: vscode.Memento,
    pdfUri: vscode.Uri
  ) {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (PaperReaderPanel.currentPanel) {
      const current = PaperReaderPanel.currentPanel;
      const sourceDocumentId = current.documentId;
      current.panel.reveal(column);
      void current.navigateTo(pdfUri).catch(error => {
        current.reportError(error, sourceDocumentId);
      });
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      INLEAF_IDS.webviewType,
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
    this.capabilities = new HostCapabilityRegistry(extensionUri, secrets);
    this.storage = new ReaderStorage(pdfUri, globalState);
    this.storageSessions.set(this.documentId, this.storage);
    this.panel.webview.html = this.getHtml();
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (message: ReaderMessage) => this.handleMessage(message),
      null,
      this.disposables
    );
    vscode.workspace.onDidChangeConfiguration(
      event => {
        if (event.affectsConfiguration(INLEAF_IDS.configuration)) {
          void this.postCapabilitySettings();
          void this.capabilities.postInitialState(this.capabilityContext());
        }
      },
      null,
      this.disposables
    );
  }

  private async navigateTo(pdfUri: vscode.Uri) {
    const previous = {
      documentId: this.documentId,
      pdfUri: this.pdfUri,
      storage: this.storage,
      title: this.panel.title,
      options: this.panel.webview.options
    };
    const documentId = getNonce();
    this.documentId = documentId;
    this.pdfUri = pdfUri;
    const storage = new ReaderStorage(pdfUri, this.globalState);
    this.storage = storage;
    this.storageSessions.set(documentId, storage);
    while (this.storageSessions.size > 2) {
      const oldest = this.storageSessions.keys().next().value as string | undefined;
      if (oldest) {
        this.storageSessions.delete(oldest);
      }
    }
    this.panel.title = `Reader: ${path.basename(pdfUri.fsPath)}`;
    this.panel.webview.options = {
      ...this.panel.webview.options,
      localResourceRoots: getLocalResourceRoots(this.extensionUri, pdfUri)
    };
    try {
      await this.prepareStorage(storage);
    } catch (error) {
      if (this.documentId === documentId) {
        this.documentId = previous.documentId;
        this.pdfUri = previous.pdfUri;
        this.storage = previous.storage;
        this.panel.title = previous.title;
        this.panel.webview.options = previous.options;
        this.storageSessions.delete(documentId);
      }
      throw error;
    }
    if (storage !== this.storage) {
      return;
    }
    const pdfWebviewUri = this.panel.webview.asWebviewUri(pdfUri);
    await this.panel.webview.postMessage({
      type: 'navigateTo',
      documentId,
      payload: {
        pdfUrl: pdfWebviewUri.toString(),
        paperName: path.basename(pdfUri.fsPath),
        documentId
      }
    });
    await this.postState();
  }

  private async handleMessage(message: ReaderMessage) {
    try {
      if (message.documentId !== this.documentId) {
        if (message.type === 'saveProgress') {
          await this.storageSessions.get(message.documentId)?.saveProgress(message.payload);
        }
        return;
      }
      await this.dispatchMessage(message);
    } catch (error) {
      if (message.type === 'capabilityRequest') {
        await this.postCapabilityEvent(
          message.capabilityId,
          'error',
          { message: error instanceof Error ? error.message : String(error) },
          message.documentId
        );
      }
      await this.reportError(error, message.documentId);
    }
  }

  private async dispatchMessage(message: ReaderMessage) {
    const storage = this.storage;
    const documentId = message.documentId;
    switch (message.type) {
      case 'ready':
        await this.postState();
        break;
      case 'copySelection':
        await vscode.env.clipboard.writeText(message.payload.text);
        await this.panel.webview.postMessage({
          type: 'clipboardResult',
          documentId,
          payload: { message: 'Selected text copied.' }
        });
        break;
      case 'saveProgress':
        await storage.saveProgress(message.payload);
        break;
      case 'updateCapabilityPreference':
        await this.capabilityPreferences.update(message.payload.capabilityId, message.payload.patch);
        await this.postCapabilitySettings();
        await this.capabilities.postInitialState(this.capabilityContext());
        break;
      case 'capabilityRequest':
        await this.capabilities.handle(
          message.capabilityId,
          message.action,
          message.payload,
          this.capabilityContext()
        );
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
    const progress = await storage.readProgress();
    if (storage !== this.storage) {
      return;
    }

    await this.panel.webview.postMessage({
      type: 'state',
      documentId: this.documentId,
      payload: {
        progress,
        paperName: path.basename(pdfUri.fsPath)
      }
    });
    for (const notice of storage.consumeDataRecoveryNotices()) {
      vscode.window.showWarningMessage(
        `Recovered invalid reader data from ${notice.backupPath}. ` +
        `The unreadable file was preserved at ${notice.corruptPath}.`
      );
    }
    await Promise.all([
      this.postCapabilitySettings(),
      this.capabilities.postInitialState(this.capabilityContext())
    ]);
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

  private async postCapabilitySettings() {
    await this.panel.webview.postMessage({
      type: 'capabilitySettings',
      documentId: this.documentId,
      payload: {
        capabilities: this.capabilityPreferences.getDescriptors(await this.capabilities.readiness())
      }
    });
  }

  private capabilityContext() {
    const documentId = this.documentId;
    const storage = this.storage;
    return {
      documentId,
      storage,
      postEvent: (capabilityId: CapabilityId, event: string, payload?: unknown) => (
        this.postCapabilityEvent(capabilityId, event, payload, documentId)
      )
    };
  }

  private postCapabilityEvent(
    capabilityId: CapabilityId,
    event: string,
    payload: unknown,
    documentId: string
  ) {
    if (documentId !== this.documentId) {
      return Promise.resolve(false);
    }
    return this.panel.webview.postMessage({
      type: 'capabilityEvent',
      documentId,
      capabilityId,
      event,
      payload
    });
  }

  private async reportError(error: unknown, documentId = this.documentId) {
    const message = error instanceof Error ? error.message : String(error);
    await this.panel.webview.postMessage({
      type: 'stateError',
      documentId,
      payload: { message }
    });
    vscode.window.showErrorMessage(message);
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
    const pdfWorkerUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'pdfjs-dist', 'pdf.worker.min.mjs')
    );
    const nonce = getNonce();
    const readerConfig = serializeForInlineScript({
      documentId: this.documentId,
      pdfUrl: pdfWebviewUri.toString(),
      paperName: path.basename(this.pdfUri.fsPath),
      pdfWorkerUrl: pdfWorkerUri.toString(),
      pdfCMapUrl: ensureTrailingSlash(cMapUri.toString()),
      pdfStandardFontDataUrl: ensureTrailingSlash(standardFontDataUri.toString())
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src ${webview.cspSource}; img-src ${webview.cspSource} data:; font-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}' ${webview.cspSource} blob:; worker-src blob: data:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
  <title>Inleaf Reader</title>
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
    this.capabilities.dispose();
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

function serializeForInlineScript(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
