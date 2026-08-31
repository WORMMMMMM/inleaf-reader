import * as path from 'path';
import * as vscode from 'vscode';
import { formatAnnotationMarkdownSnippet } from './annotationExports';
import { CodexBridge } from './codexBridge';
import { ComparisonService } from './comparisonService';
import { resolveEvidenceLocator } from './evidenceLocator';
import { INLEAF_IDS } from './identity';
import { LibraryIndexService } from './libraryIndex';
import { McpBridge } from './mcpBridge';
import type { ReaderMessage, TranslationMode } from './readerMessages';
import {
  AnnotationRecord,
  ReaderStorage,
  WordRecord
} from './readerStorage';
import { RepositoryService } from './repositoryService';
import { ResearchStorage } from './researchStorage';
import {
  createDefaultResearchProfile,
  type EvidenceLocator,
  type PaperComparison,
  type ResearchArtifact
} from './researchTypes';
import { TranslationService } from './translationService';

export class PaperReaderPanel {
  private static currentPanel: PaperReaderPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private storage: ReaderStorage;
  private researchStorage: ResearchStorage;
  private documentId = getNonce();
  private readonly storageSessions = new Map<string, ReaderStorage>();
  private readonly researchSessions = new Map<string, ResearchStorage>();
  private disposables: vscode.Disposable[] = [];
  private readonly recoveryNotifications = new WeakSet<ReaderStorage>();
  private readonly translation: TranslationService;
  private readonly codex: CodexBridge;
  private readonly library: LibraryIndexService;
  private readonly repository = new RepositoryService();
  private readonly comparisons = new ComparisonService();
  private readonly mcp: McpBridge;
  private readonly translationRequests = new Map<string, { requestId: string; controller: AbortController }>();
  private currentComparison?: PaperComparison;
  private currentSelection?: EvidenceLocator;

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
      INLEAF_IDS.webviewType,
      `阅读器：${path.basename(pdfUri.fsPath)}`,
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
    this.translation = new TranslationService(extensionUri, secrets);
    this.codex = new CodexBridge(globalState);
    this.library = new LibraryIndexService(globalState);
    this.mcp = new McpBridge(extensionUri);
    this.storage = new ReaderStorage(pdfUri, globalState);
    this.researchStorage = new ResearchStorage(pdfUri);
    this.storageSessions.set(this.documentId, this.storage);
    this.researchSessions.set(this.documentId, this.researchStorage);
    this.panel.webview.html = this.getHtml();
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (message: ReaderMessage) => this.handleMessage(message),
      null,
      this.disposables
    );
    vscode.workspace.onDidChangeConfiguration(
      event => {
        if (
          event.affectsConfiguration(`${INLEAF_IDS.configuration}.translationProvider`)
          || event.affectsConfiguration(`${INLEAF_IDS.configuration}.deepSeekModel`)
        ) {
          void this.postTranslationSettings();
        }
        if (event.affectsConfiguration(`${INLEAF_IDS.configuration}.codexCliPath`)) {
          void this.codex.getStatus(true).then(codex => this.postStatePatch({ codex }, this.documentId));
        }
      },
      null,
      this.disposables
    );
  }

  private async navigateTo(pdfUri: vscode.Uri) {
    const documentId = getNonce();
    this.documentId = documentId;
    this.pdfUri = pdfUri;
    this.currentSelection = undefined;
    this.currentComparison = undefined;
    for (const request of this.translationRequests.values()) request.controller.abort();
    this.translationRequests.clear();
    const storage = new ReaderStorage(pdfUri, this.globalState);
    const researchStorage = new ResearchStorage(pdfUri);
    this.storage = storage;
    this.researchStorage = researchStorage;
    this.storageSessions.set(documentId, storage);
    this.researchSessions.set(documentId, researchStorage);
    while (this.storageSessions.size > 2) {
      const oldest = this.storageSessions.keys().next().value as string | undefined;
      if (oldest) {
        this.storageSessions.delete(oldest);
        this.researchSessions.delete(oldest);
      }
    }
    this.panel.title = `阅读器：${path.basename(pdfUri.fsPath)}`;
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
      const message = error instanceof Error ? error.message : String(error);
      await this.panel.webview.postMessage({
        type: 'stateError',
        documentId: this.documentId,
        payload: { message }
      });
      vscode.window.showErrorMessage(message);
    }
  }

  private async dispatchMessage(message: ReaderMessage) {
    const storage = this.storage;
    const researchStorage = this.researchStorage;
    const pdfUri = this.pdfUri;
    const documentId = message.documentId;
    switch (message.type) {
      case 'ready':
        await this.postState();
        break;
      case 'openQuickStart':
        await vscode.commands.executeCommand(INLEAF_IDS.commands.quickStart, this.pdfUri);
        break;
      case 'saveAnnotation':
        await this.postStatePatch({ annotations: await storage.addAnnotation(message.payload) }, documentId);
        break;
      case 'updateAnnotation':
        await this.postStatePatch({
          annotations: await storage.updateAnnotation(message.payload.id, message.payload.patch)
        }, documentId);
        break;
      case 'deleteAnnotation':
        await this.postStatePatch({ annotations: await storage.deleteAnnotation(message.payload.id) }, documentId);
        break;
      case 'restoreAnnotation':
        await this.postStatePatch({ annotations: await storage.restoreAnnotation(message.payload) }, documentId);
        await this.postAnnotationActionResult('标注已恢复。');
        break;
      case 'copyAnnotationMarkdown':
        await this.copyAnnotationMarkdown(message.payload.id);
        break;
      case 'copySelection':
        await vscode.env.clipboard.writeText(message.payload.text);
        await this.panel.webview.postMessage({
          type: 'clipboardResult',
          payload: { message: '所选文本已复制。' }
        });
        break;
      case 'exportAnnotations':
        await this.exportAnnotations();
        break;
      case 'exportAnnotatedPdf':
        await this.exportAnnotatedPdf();
        break;
      case 'saveWord':
        await this.postStatePatch({ words: await this.saveWord(storage, message.payload) }, documentId);
        break;
      case 'deleteWord':
        await this.postStatePatch({ words: await storage.deleteWord(message.payload.id) }, documentId);
        break;
      case 'saveProgress':
        await storage.saveProgress(message.payload);
        await this.publishMcpSession(message.payload.page || 1);
        break;
      case 'setTranslationMode':
        await this.setTranslationMode(message.payload.mode);
        break;
      case 'setDeepSeekModel':
        await vscode.workspace
          .getConfiguration(INLEAF_IDS.configuration)
          .update('deepSeekModel', message.payload.model, vscode.ConfigurationTarget.Global);
        await this.postTranslationSettings();
        break;
      case 'configureDeepSeek':
        await vscode.commands.executeCommand(INLEAF_IDS.commands.setDeepSeekApiKey);
        await this.postTranslationSettings();
        break;
      case 'diagnoseTranslation':
        await vscode.commands.executeCommand(INLEAF_IDS.commands.diagnoseTranslation);
        await this.postTranslationSettings();
        break;
      case 'translate':
        await this.translate(message.payload.text, documentId, message.payload.requestId);
        break;
      case 'cancelTranslation':
        this.cancelTranslation(documentId, message.payload.requestId);
        break;
      case 'updateResearchProfile':
        await this.postResearch(await researchStorage.updateProfile(message.payload), documentId);
        break;
      case 'addResearchFact':
        await this.addResearchFact(message.payload, documentId, researchStorage);
        break;
      case 'setResearchFactStatus':
        await this.postResearch(
          await researchStorage.setFactStatus(message.payload.id, message.payload.status),
          documentId
        );
        break;
      case 'addRepositoryArtifact':
        await this.addRepositoryArtifact(
          message.payload.url,
          message.payload.relationship,
          documentId,
          researchStorage
        );
        break;
      case 'deleteRepositoryArtifact':
        await this.postResearch(await researchStorage.deleteArtifact(message.payload.id), documentId);
        break;
      case 'chooseRepositoryCheckout':
        await this.chooseRepositoryCheckout(message.payload.id, documentId, researchStorage);
        break;
      case 'refreshRepositoryArtifact':
        await this.refreshRepositoryArtifact(message.payload.id, documentId, researchStorage);
        break;
      case 'cloneRepositoryArtifact':
        await this.cloneRepositoryArtifact(message.payload.id, documentId, researchStorage);
        break;
      case 'analyzeRepositoryWithCodex':
        await this.analyzeRepositoryWithCodex(
          message.payload.id,
          documentId,
          researchStorage,
          pdfUri
        );
        break;
      case 'askCodex':
        await this.askCodex(
          message.payload.question,
          message.payload.locator,
          message.payload.currentPage,
          documentId,
          storage,
          researchStorage,
          pdfUri
        );
        break;
      case 'focusEvidence':
        await this.focusEvidence(message.payload.locator);
        break;
      case 'setCurrentSelection':
        this.currentSelection = message.payload.locator;
        await this.publishMcpSession(message.payload.currentPage);
        break;
      case 'chooseLibraryRoot':
        await this.chooseLibraryRoot(documentId);
        break;
      case 'rebuildLibrary':
        await this.rebuildLibrary(message.payload.rootPath, documentId);
        break;
      case 'createComparison':
        await this.createComparison(message.payload.fingerprints, documentId);
        break;
      case 'exportComparison':
        await this.exportComparison(message.payload.comparisonId);
        break;
      case 'analyzeComparisonWithCodex':
        await this.analyzeComparisonWithCodex(message.payload.comparisonId, documentId);
        break;
      case 'configureCodexMcp':
        await vscode.commands.executeCommand(INLEAF_IDS.commands.configureCodexMcp);
        break;
      case 'removeCodexMcp':
        await vscode.commands.executeCommand(INLEAF_IDS.commands.removeCodexMcp);
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
    const [annotations, words, progress, research, codex, libraries] = await Promise.all([
      storage.readAnnotations(),
      storage.readWords(),
      storage.readProgress(),
      this.readResearchWithFallback(),
      this.codex.getStatus(),
      this.library.readAll()
    ]);
    if (storage !== this.storage) {
      return;
    }

    await this.panel.webview.postMessage({
      type: 'state',
      documentId: this.documentId,
      payload: {
        annotations,
        words,
        progress,
        paperName: path.basename(pdfUri.fsPath),
        paperFingerprint: research.paperFingerprint,
        research,
        codex,
        libraries,
        comparison: this.currentComparison
      }
    });
    await this.postTranslationSettings();
    await this.publishMcpSession(progress.page || 1);
  }

  private async postStatePatch(
    payload: {
      annotations?: AnnotationRecord[];
      words?: WordRecord[];
      research?: Awaited<ReturnType<ResearchStorage['readProfile']>>;
      libraries?: Awaited<ReturnType<LibraryIndexService['readAll']>>;
      comparison?: PaperComparison;
      codex?: Awaited<ReturnType<CodexBridge['getStatus']>>;
    },
    documentId: string
  ) {
    if (documentId !== this.documentId) {
      return;
    }
    await this.panel.webview.postMessage({ type: 'statePatch', documentId, payload });
  }

  private async prepareStorage(storage: ReaderStorage) {
    const result = await storage.prepare();
    if (!result.recoveredFrom || this.recoveryNotifications.has(storage)) {
      return;
    }

    this.recoveryNotifications.add(storage);
    vscode.window.showInformationMessage(
      `已从 PDF 的原位置恢复 ${result.recoveredFiles} 个阅读数据文件。`
    );
  }

  private async setTranslationMode(mode: TranslationMode) {
    if (mode === 'deepseek' && !(await this.secrets.get(INLEAF_IDS.secrets.deepSeekApiKey))) {
      await vscode.commands.executeCommand(INLEAF_IDS.commands.setDeepSeekApiKey);
      if (!(await this.secrets.get(INLEAF_IDS.secrets.deepSeekApiKey))) {
        await this.postTranslationSettings();
        return;
      }
    } else {
      await vscode.workspace
        .getConfiguration(INLEAF_IDS.configuration)
        .update('translationProvider', mode === 'deepseek' ? 'deepseek' : 'argos', vscode.ConfigurationTarget.Global);
    }
    await this.postTranslationSettings();
  }

  private async postTranslationSettings() {
    await this.panel.webview.postMessage({
      type: 'translationSettings',
      documentId: this.documentId,
      payload: await this.translation.getSettings()
    });
  }

  private async saveWord(
    storage: ReaderStorage,
    input: Omit<WordRecord, 'id' | 'createdAt' | 'updatedAt'>
  ) {
    return storage.addWord(await this.translation.enrichWord(input));
  }

  private async translate(text: string, documentId: string, requestId: string) {
    const trimmed = text.trim();
    this.translationRequests.get(documentId)?.controller.abort();
    const controller = new AbortController();
    this.translationRequests.set(documentId, { requestId, controller });
    const result = await this.translation.translate(trimmed, controller.signal);
    const active = this.translationRequests.get(documentId);
    if (!active || active.requestId !== requestId || documentId !== this.documentId) {
      return;
    }
    this.translationRequests.delete(documentId);
    await this.panel.webview.postMessage({
      type: 'translationResult',
      documentId,
      payload: { requestId, sourceText: trimmed, ...result }
    });
    if (result.error && result.error !== 'Translation canceled.') {
      vscode.window.showErrorMessage(result.error);
    }
  }

  private cancelTranslation(documentId: string, requestId: string) {
    const active = this.translationRequests.get(documentId);
    if (active?.requestId === requestId) {
      active.controller.abort();
      this.translationRequests.delete(documentId);
    }
  }

  private async postResearch(
    research: Awaited<ReturnType<ResearchStorage['readProfile']>>,
    documentId: string
  ) {
    await this.postStatePatch({ research }, documentId);
  }

  private async readResearchWithFallback() {
    try {
      return await this.researchStorage.readProfile();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const fingerprint = await this.researchStorage.fingerprint();
      await this.panel.webview.postMessage({
        type: 'stateError',
        documentId: this.documentId,
        payload: { message }
      });
      vscode.window.showErrorMessage(message);
      return createDefaultResearchProfile(fingerprint, this.pdfUri.fsPath);
    }
  }

  private async addResearchFact(
    payload: {
      field: string;
      value: string;
      status: 'suggested' | 'confirmed';
      locator?: EvidenceLocator;
    },
    documentId: string,
    researchStorage: ResearchStorage
  ) {
    const field = payload.field.trim();
    const value = payload.value.trim();
    if (!field || !value) throw new Error('研究事实必须同时包含字段和内容。');
    if (payload.status === 'confirmed' && !payload.locator) {
      throw new Error('确认论文事实前，需要提供当前选区中的证据。');
    }
    if (payload.locator) await this.assertCurrentLocator(payload.locator, researchStorage);
    const now = new Date().toISOString();
    let research = await researchStorage.addFact({
      field,
      value,
      status: payload.status,
      source: payload.locator
        ? { type: 'paper', locator: payload.locator }
        : { type: 'user' },
      extractedBy: {
        kind: 'user',
        name: 'Inleaf Reader',
        capturedAt: now
      }
    });
    const createdFact = research.facts[0];
    if (createdFact && payload.locator?.annotationId) {
      research = await researchStorage.addRelation({
        from: { type: 'fact', id: createdFact.id },
        to: { type: 'annotation', id: payload.locator.annotationId },
        type: 'supportedBy'
      });
    }
    await this.postResearch(research, documentId);
  }

  private async addRepositoryArtifact(
    url: string,
    relationship: string,
    documentId: string,
    researchStorage: ResearchStorage
  ) {
    const normalizedUrl = this.repository.validateUrl(url);
    const parsedHost = /^https?:/i.test(normalizedUrl) ? new URL(normalizedUrl).hostname : '';
    const input: Omit<ResearchArtifact, 'id' | 'createdAt' | 'updatedAt'> = {
      type: parsedHost.toLowerCase() === 'github.com' ? 'github' : 'git_repository',
      url: normalizedUrl,
      relationship: relationship.trim() || 'related work',
      verification: { status: 'confirmed', sourceType: 'user' },
      license: '',
      notes: ''
    };
    await this.postResearch(await researchStorage.addArtifact(input), documentId);
  }

  private async chooseRepositoryCheckout(
    id: string,
    documentId: string,
    researchStorage: ResearchStorage
  ) {
    const profile = await researchStorage.readProfile();
    const artifact = requireArtifact(profile.artifacts, id);
    const picked = await vscode.window.showOpenDialog({
      title: `为 ${artifact.url} 选择本地仓库`,
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false
    });
    if (!picked?.[0]) return;
    if (documentId !== this.documentId) return;
    const snapshot = await this.repository.snapshot(picked[0].fsPath);
    await this.postResearch(await researchStorage.updateArtifact(id, {
      localCheckout: withoutLicense(snapshot),
      license: snapshot.license
    }), documentId);
  }

  private async refreshRepositoryArtifact(
    id: string,
    documentId: string,
    researchStorage: ResearchStorage
  ) {
    const profile = await researchStorage.readProfile();
    const artifact = requireArtifact(profile.artifacts, id);
    if (!artifact.localCheckout?.path) throw new Error('刷新快照前，请先选择本地仓库。');
    const snapshot = await this.repository.snapshot(artifact.localCheckout.path);
    await this.postResearch(await researchStorage.updateArtifact(id, {
      localCheckout: withoutLicense(snapshot),
      license: snapshot.license
    }), documentId);
  }

  private async cloneRepositoryArtifact(
    id: string,
    documentId: string,
    researchStorage: ResearchStorage
  ) {
    const profile = await researchStorage.readProfile();
    const artifact = requireArtifact(profile.artifacts, id);
    const parent = await vscode.window.showOpenDialog({
      title: '选择克隆仓库的父文件夹',
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false
    });
    if (!parent?.[0]) return;
    const targetPath = path.join(parent[0].fsPath, repositoryDirectoryName(artifact.url));
    const confirmation = await vscode.window.showWarningMessage(
      `是否将 ${artifact.url} 克隆到 ${targetPath}？`,
      { modal: true },
      '克隆'
    );
    if (confirmation !== '克隆') return;
    if (documentId !== this.documentId) return;
    const snapshot = await this.repository.clone(artifact.url, targetPath);
    await this.postResearch(await researchStorage.updateArtifact(id, {
      localCheckout: withoutLicense(snapshot),
      license: snapshot.license
    }), documentId);
  }

  private async askCodex(
    question: string,
    locator: EvidenceLocator,
    currentPage: number,
    documentId: string,
    storage: ReaderStorage,
    researchStorage: ResearchStorage,
    pdfUri: vscode.Uri
  ) {
    await this.assertCurrentLocator(locator, researchStorage);
    const [profile, annotations] = await Promise.all([
      researchStorage.readProfile(),
      storage.readAnnotations()
    ]);
    if (documentId !== this.documentId) return;
    const contextPath = await this.codex.ask({
      pdfPath: pdfUri.fsPath,
      fingerprint: profile.paperFingerprint,
      currentPage,
      locator,
      question: question.trim(),
      profile,
      annotations
    });
    if (documentId !== this.documentId) return;
    await this.panel.webview.postMessage({
      type: 'codexResult',
      documentId,
      payload: { message: 'Codex 已载入当前论文上下文。', contextPath }
    });
  }

  private async analyzeRepositoryWithCodex(
    id: string,
    documentId: string,
    researchStorage: ResearchStorage,
    pdfUri: vscode.Uri
  ) {
    const profile = await researchStorage.readProfile();
    const artifact = requireArtifact(profile.artifacts, id);
    if (!artifact.localCheckout?.path) {
      throw new Error('使用 Codex 分析仓库前，请先选择或克隆本地仓库。');
    }
    const snapshot = await this.repository.snapshot(artifact.localCheckout.path);
    if (documentId !== this.documentId) return;
    const updatedProfile = await researchStorage.updateArtifact(id, {
      localCheckout: withoutLicense(snapshot),
      license: snapshot.license
    });
    const updatedArtifact = requireArtifact(updatedProfile.artifacts, id);
    await this.postResearch(updatedProfile, documentId);
    const contextPath = await this.codex.analyzeRepository({
      pdfPath: pdfUri.fsPath,
      fingerprint: updatedProfile.paperFingerprint,
      profile: updatedProfile,
      artifact: updatedArtifact
    });
    if (documentId !== this.documentId) return;
    await this.panel.webview.postMessage({
      type: 'codexResult',
      documentId,
      payload: { message: 'Codex 已载入论文和仓库快照。', contextPath }
    });
  }

  private async focusEvidence(locator: EvidenceLocator) {
    let fingerprint = await this.researchStorage.fingerprint();
    if (locator.documentFingerprint !== fingerprint) {
      const indexes = await this.library.readAll();
      const paper = indexes.flatMap(index => index.papers)
        .find(candidate => candidate.fingerprint === locator.documentFingerprint);
      if (!paper) throw new Error('配置的文库索引中没有找到该证据所属的 PDF。');
      await this.navigateTo(vscode.Uri.file(paper.pdfPath));
      fingerprint = await this.researchStorage.fingerprint();
    }
    const annotations = await this.storage.readAnnotations();
    const target = resolveEvidenceLocator(locator, fingerprint, annotations);
    await this.panel.webview.postMessage({
      type: 'focusEvidence',
      documentId: this.documentId,
      payload: target
    });
    if (target.kind === 'sourceMissing' || target.kind === 'wrongDocument') {
      vscode.window.showWarningMessage(target.reason);
    }
  }

  private async chooseLibraryRoot(documentId: string) {
    const picked = await vscode.window.showOpenDialog({
      title: '选择 Inleaf 论文文库目录',
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false
    });
    if (!picked?.[0]) return;
    await this.library.addRoot(picked[0].fsPath);
    await this.rebuildLibrary(picked[0].fsPath, documentId);
  }

  private async rebuildLibrary(rootPath: string, documentId: string) {
    const index = await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Inleaf Reader：正在索引论文文库',
      cancellable: false
    }, () => this.library.rebuildRoot(rootPath));
    const indexes = await this.library.readAll();
    if (documentId !== this.documentId) return;
    await this.postStatePatch({ libraries: indexes }, documentId);
    await this.panel.webview.postMessage({
      type: 'libraryResult',
      documentId,
      payload: { indexes, message: `已索引 ${index.papers.length} 篇论文。` }
    });
    if (index.warnings.length) {
      vscode.window.showWarningMessage(`论文文库索引完成，但有 ${index.warnings.length} 条警告。`);
    }
  }

  private async createComparison(fingerprints: string[], documentId: string) {
    const selected = [...new Set(fingerprints)].filter(Boolean);
    if (selected.length < 2) throw new Error('请至少选择两篇论文进行比较。');
    const indexes = await this.library.readAll();
    const papers = indexes.flatMap(index => index.papers)
      .filter(paper => selected.includes(paper.fingerprint));
    if (papers.length !== selected.length) throw new Error('当前文库索引中缺少一篇或多篇所选论文。');
    const inputs = await Promise.all(papers.map(async paper => {
      const pdfUri = vscode.Uri.file(paper.pdfPath);
      return {
        paper,
        profile: await new ResearchStorage(pdfUri).readProfile(),
        annotations: await readAnnotationsSidecar(pdfUri)
      };
    }));
    const comparison = this.comparisons.build(inputs);
    const root = this.library.rootForPdf(papers[0].pdfPath);
    if (!root) throw new Error('保存比较结果需要已配置的文库目录。');
    await this.comparisons.save(root, comparison);
    this.currentComparison = comparison;
    if (documentId !== this.documentId) return;
    await this.postStatePatch({ comparison }, documentId);
    await this.panel.webview.postMessage({
      type: 'comparisonResult',
      documentId,
      payload: { comparison, message: '已根据可定位证据建立跨论文比较。' }
    });
  }

  private async exportComparison(comparisonId: string) {
    const comparison = this.requireCurrentComparison(comparisonId);
    const root = this.library.rootForPdf(comparison.papers[0]?.pdfPath || '');
    if (!root) throw new Error('保存比较结果需要已配置的文库目录。');
    const output = await this.comparisons.save(root, comparison);
    vscode.window.showInformationMessage(`比较结果已导出：${output.markdownUri.fsPath}`);
  }

  private async analyzeComparisonWithCodex(comparisonId: string, documentId: string) {
    const comparison = this.requireCurrentComparison(comparisonId);
    const root = this.library.rootForPdf(comparison.papers[0]?.pdfPath || '');
    if (!root) throw new Error('分析比较结果需要已配置的文库目录。');
    const contextPath = await this.codex.analyzeComparison(root, comparison);
    if (documentId !== this.documentId) return;
    await this.panel.webview.postMessage({
      type: 'codexResult',
      documentId,
      payload: { message: 'Codex 已载入跨论文比较上下文。', contextPath }
    });
  }

  private requireCurrentComparison(id: string) {
    if (!this.currentComparison || this.currentComparison.id !== id) {
      throw new Error('请求的比较当前未激活，请从论文文库重新建立。');
    }
    return this.currentComparison;
  }

  private async publishMcpSession(currentPage: number) {
    const root = this.library.rootForPdf(this.pdfUri.fsPath);
    if (!root) return;
    await this.mcp.writeCurrentSession(root, {
      pdfPath: this.pdfUri.fsPath,
      fingerprint: await this.researchStorage.fingerprint(),
      currentPage,
      selection: this.currentSelection
    });
  }

  private async assertCurrentLocator(locator: EvidenceLocator, researchStorage = this.researchStorage) {
    const fingerprint = await researchStorage.fingerprint();
    if (locator.documentFingerprint !== fingerprint) {
      throw new Error('所选证据属于已过期或不同的 PDF 会话。');
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
      vscode.window.showInformationMessage(`标注已导出：${uri.fsPath}`);
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
        throw new Error('未找到该标注。');
      }

      await vscode.env.clipboard.writeText(formatAnnotationMarkdownSnippet(annotation));
      await this.panel.webview.postMessage({
        type: 'clipboardResult',
        payload: {
          message: '标注 Markdown 已复制。'
        }
      });
      vscode.window.showInformationMessage('标注 Markdown 已复制。');
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
      vscode.window.showInformationMessage(`带标注 PDF 已导出：${uri.fsPath}`);
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
    const pdfWorkerUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'pdfjs-dist', 'pdf.worker.min.mjs')
    );
    const config = vscode.workspace.getConfiguration(INLEAF_IDS.configuration);
    const nonce = getNonce();
    const readerConfig = JSON.stringify({
      documentId: this.documentId,
      pdfUrl: pdfWebviewUri.toString(),
      paperName: path.basename(this.pdfUri.fsPath),
      translationProvider: config.get<string>('translationProvider') || 'argos',
      translationSource: config.get<string>('translationSource') || 'auto',
      translationTarget: config.get<string>('translationTarget') || 'zh',
      pdfWorkerUrl: pdfWorkerUri.toString(),
      pdfCMapUrl: ensureTrailingSlash(cMapUri.toString()),
      pdfStandardFontDataUrl: ensureTrailingSlash(standardFontDataUri.toString())
    });

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src ${webview.cspSource}; img-src ${webview.cspSource} data:; font-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}' ${webview.cspSource} blob:; worker-src blob: data:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
  <title>Inleaf Reader</title>
</head>
<body>
  <main id="startupStatus" class="startup-state">
    <h1>正在启动阅读器……</h1>
    <p>正在载入 Webview 脚本。</p>
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
        status.innerHTML = '<h1>阅读器启动失败</h1><pre></pre>';
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
      showStartupError(event.message || String(event.error || '未知 Webview 错误'));
    });
    window.addEventListener('unhandledrejection', event => {
      showStartupError(event.reason instanceof Error ? event.reason.message : String(event.reason || '未处理的异步错误'));
    });
  </script>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private dispose() {
    for (const request of this.translationRequests.values()) request.controller.abort();
    this.translation.dispose();
    this.codex.dispose();
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

function requireArtifact(artifacts: ResearchArtifact[], id: string) {
  const artifact = artifacts.find(candidate => candidate.id === id);
  if (!artifact) throw new Error('未找到该仓库工件。');
  return artifact;
}

function withoutLicense(
  snapshot: NonNullable<ResearchArtifact['localCheckout']> & { license: string }
): NonNullable<ResearchArtifact['localCheckout']> {
  const { license: _license, ...checkout } = snapshot;
  return checkout;
}

function repositoryDirectoryName(url: string) {
  const withoutQuery = url.split(/[?#]/, 1)[0].replace(/[\\/]+$/, '').replace(/\.git$/i, '');
  const candidate = withoutQuery.split(/[\\/:]/).filter(Boolean).pop() || 'repository';
  return candidate.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 100) || 'repository';
}

async function readAnnotationsSidecar(pdfUri: vscode.Uri): Promise<AnnotationRecord[]> {
  const uri = vscode.Uri.file(path.join(
    path.dirname(pdfUri.fsPath),
    INLEAF_IDS.sidecarDirectory,
    `${path.basename(pdfUri.fsPath)}.annotations.json`
  ));
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    const value = JSON.parse(Buffer.from(bytes).toString('utf8')) as unknown;
    if (!Array.isArray(value)) throw new Error('标注侧车文件必须包含 JSON 数组。');
    return value as AnnotationRecord[];
  } catch (error) {
    if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') return [];
    throw error;
  }
}
