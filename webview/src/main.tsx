import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  PdfLoader,
  scaledPositionToViewport,
  type PdfHighlighterUtils,
  type PdfScaleValue,
  type PdfSelection,
  type ScaledPosition,
  type ViewportPosition
} from 'react-pdf-highlighter-plus';
import 'pdfjs-dist/web/pdf_viewer.css';
import 'react-pdf-highlighter-plus/style/style.css';
import './styles.css';
import {
  AnnotationItem,
  AnnotationSummary,
  InlineAnnotationActions,
  InlineAnnotationEditor,
  SelectionToolbar,
  SelectionToolbarContext,
  WordDetailsBlock,
  WordItem,
  annotationStatus,
  colorOptions,
  type SelectionToolbarContextValue
} from './components/AnnotationWidgets';
import { ComparisonView } from './components/ComparisonView';
import { LibraryView } from './components/LibraryView';
import { PdfDocumentView } from './components/PdfDocumentView';
import { RepositoryPanel } from './components/RepositoryPanel';
import { ResearchPanel } from './components/ResearchPanel';
import {
  annotationToHighlight,
  buildAnnotationPayload,
  filterAnnotations,
  rectsToHighlighterPosition,
  summarizeWordDetails,
  type AnnotationSortMode,
  type ReaderHighlight
} from './annotationModel';
import { annotationToEvidenceLocator, selectionToEvidenceLocator } from './evidenceLocator';
import type { IncomingMessage, SidebarTab, TranslationMode } from './messages';
import {
  extractSelectedPdfText,
  filterNonBodyRects,
  markPageSelectionRegions,
  selectedPageElements,
  selectionStartsInNonBodyText
} from './pdfSelection';
import {
  invokeReaderAction,
  type ReaderActionId,
  type ReaderActionOptions
} from './readerActions';
import { readerConfig, setActiveDocumentId, vscode } from './vscodeApi';
import type {
  AnnotationKind,
  AnnotationRecord,
  EvidenceFocusTarget,
  LibraryPaper,
  ReaderStatePayload,
  WordDetails
} from './types';

const defaultState = createDefaultState(readerConfig.paperName);

const sidebarTabLabels: Record<SidebarTab, string> = {
  overview: '概览',
  annotations: '标注',
  wordbook: '生词本',
  translation: '翻译',
  research: '研究',
  repositories: '代码仓库'
};

function App() {
  const [state, setState] = useState<ReaderStatePayload>(defaultState);
  const [selectedText, setSelectedText] = useState('');
  const [translationOutput, setTranslationOutput] = useState('');
  const [wordDetails, setWordDetails] = useState<WordDetails | undefined>();
  const [translationSourceText, setTranslationSourceText] = useState('');
  const [translationMode, setTranslationMode] = useState<TranslationMode>(
    readerConfig.translationProvider === 'deepseek' ? 'deepseek' : 'local'
  );
  const [hasDeepSeekApiKey, setHasDeepSeekApiKey] = useState(false);
  const [translationProvider, setTranslationProvider] = useState(readerConfig.translationProvider || 'argos');
  const [deepSeekModel, setDeepSeekModel] = useState<'deepseek-v4-flash' | 'deepseek-v4-pro'>('deepseek-v4-flash');
  const [dictionaryReady, setDictionaryReady] = useState(false);
  const [argosPythonFound, setArgosPythonFound] = useState(false);
  const [annotationQuery, setAnnotationQuery] = useState('');
  const [tagQuery, setTagQuery] = useState('');
  const [colorFilter, setColorFilter] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [sortMode, setSortMode] = useState<AnnotationSortMode>('position');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageTotal, setPageTotal] = useState(0);
  const [zoom, setZoom] = useState<PdfScaleValue>('page-width');
  const [status, setStatus] = useState('正在载入 PDF……');
  const [activeId, setActiveId] = useState<string | undefined>();
  const [lastDeleted, setLastDeleted] = useState<AnnotationRecord | undefined>();
  const [pdfUrl, setPdfUrl] = useState(readerConfig.pdfUrl);
  const [pdfWorkerSrc, setPdfWorkerSrc] = useState<string | undefined>();
  const [pdfWorkerError, setPdfWorkerError] = useState<string | undefined>();
  const [paperName, setPaperName] = useState(readerConfig.paperName);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('overview');
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<'reader' | 'library' | 'comparison'>('reader');
  const [researchSourceLocator, setResearchSourceLocator] = useState<ReturnType<typeof annotationToEvidenceLocator> | undefined>();
  const highlighterRef = useRef<PdfHighlighterUtils | null>(null);
  const progressDebounceRef = useRef<number | undefined>(undefined);
  const pendingProgressRef = useRef<number | undefined>(undefined);
  const pageIndicatorTimerRef = useRef<number | undefined>(undefined);
  const pendingVisiblePageRef = useRef<number | undefined>(undefined);
  const zoomFrameRef = useRef<number | undefined>(undefined);
  const pendingZoomScaleRef = useRef<number | undefined>(undefined);
  const zoomCommitRef = useRef<number | undefined>(undefined);
  const zoomLabelRef = useRef<HTMLSpanElement | null>(null);
  const documentReadyRef = useRef(false);
  const documentIdRef = useRef(readerConfig.documentId);
  const translationRequestRef = useRef<string | undefined>(undefined);
  const annotationsRef = useRef<AnnotationRecord[]>([]);
  const selectionRef = useRef({ selectedText: '', selectionPosition: undefined as ScaledPosition | undefined, currentPage: 1 });
  annotationsRef.current = state.annotations;
  const pdfDocumentSource = useMemo(() => ({
    url: pdfUrl,
    cMapUrl: readerConfig.pdfCMapUrl,
    cMapPacked: true,
    standardFontDataUrl: readerConfig.pdfStandardFontDataUrl,
    useWorkerFetch: false,
    disableStream: true,
    disableAutoFetch: true,
    rangeChunkSize: 1024 * 1024,
    canvasMaxAreaInBytes: 64 * 1024 * 1024,
    enableHWA: true,
    disableFontFace: true,
    useSystemFonts: false
  }), [pdfUrl]);

  const saveReadingProgress = useCallback((page: number) => {
    pendingProgressRef.current = page;
    window.clearTimeout(progressDebounceRef.current);
    progressDebounceRef.current = window.setTimeout(() => {
      vscode.postMessage({ type: 'saveProgress', payload: { page } });
      pendingProgressRef.current = undefined;
    }, 350);
  }, []);

  const flushReadingProgress = useCallback(() => {
    window.clearTimeout(progressDebounceRef.current);
    if (pendingProgressRef.current !== undefined) {
      vscode.postMessage({ type: 'saveProgress', payload: { page: pendingProgressRef.current } });
      pendingProgressRef.current = undefined;
    }
  }, []);

  const handleVisiblePageChange = useCallback((page: number) => {
    saveReadingProgress(page);
    pendingVisiblePageRef.current = page;
    if (pageIndicatorTimerRef.current !== undefined) {
      return;
    }
    pageIndicatorTimerRef.current = window.setTimeout(() => {
      pageIndicatorTimerRef.current = undefined;
      if (pendingVisiblePageRef.current !== undefined) {
        setCurrentPage(pendingVisiblePageRef.current);
        pendingVisiblePageRef.current = undefined;
      }
    }, 80);
  }, [saveReadingProgress]);

  const handleHighlighterUtils = useCallback((utils: PdfHighlighterUtils) => {
    highlighterRef.current = utils;
  }, []);

  const applyZoom = useCallback((value: PdfScaleValue) => {
    window.cancelAnimationFrame(zoomFrameRef.current || 0);
    zoomFrameRef.current = undefined;
    pendingZoomScaleRef.current = undefined;
    window.clearTimeout(zoomCommitRef.current);
    setZoom(value);
    const viewer = highlighterRef.current?.getViewer();
    if (viewer) {
      viewer.currentScaleValue = value.toString();
    }
  }, []);

  const zoomByFactor = useCallback((factor: number, deferStateCommit = false) => {
    const viewer = highlighterRef.current?.getViewer();
    const baseScale = pendingZoomScaleRef.current ?? viewer?.currentScale ?? 1;
    const nextScale = clampZoom(baseScale * factor);
    if (!deferStateCommit) {
      window.cancelAnimationFrame(zoomFrameRef.current || 0);
      zoomFrameRef.current = undefined;
      pendingZoomScaleRef.current = undefined;
      if (viewer) {
        viewer.currentScale = nextScale;
      }
      window.clearTimeout(zoomCommitRef.current);
      setZoom(nextScale);
      return;
    }

    pendingZoomScaleRef.current = nextScale;
    if (viewer && zoomFrameRef.current === undefined) {
      zoomFrameRef.current = window.requestAnimationFrame(() => {
        zoomFrameRef.current = undefined;
        const pendingScale = pendingZoomScaleRef.current;
        pendingZoomScaleRef.current = undefined;
        const currentViewer = highlighterRef.current?.getViewer();
        if (currentViewer && pendingScale !== undefined) {
          currentViewer.currentScale = pendingScale;
        }
      });
    }
    if (zoomLabelRef.current) {
      zoomLabelRef.current.textContent = zoomLabel(nextScale);
    }
    window.clearTimeout(zoomCommitRef.current);
    zoomCommitRef.current = window.setTimeout(() => {
      setZoom(nextScale);
    }, 140);
  }, []);

  const handlePinchZoom = useCallback((deltaY: number) => {
    const exponent = Math.min(Math.max(-deltaY * 0.01, -0.25), 0.25);
    zoomByFactor(Math.exp(exponent), true);
  }, [zoomByFactor]);

  useEffect(() => {
    document.body.classList.add('reader-mounted');
    return () => {
      flushReadingProgress();
      window.clearTimeout(pageIndicatorTimerRef.current);
      window.cancelAnimationFrame(zoomFrameRef.current || 0);
      window.clearTimeout(zoomCommitRef.current);
      zoomFrameRef.current = undefined;
      pendingZoomScaleRef.current = undefined;
      document.body.classList.remove('reader-mounted');
    };
  }, [flushReadingProgress]);

  useEffect(() => {
    let disposed = false;
    let workerBlobUrl: string | undefined;

    createPdfWorkerBlobUrl(readerConfig.pdfWorkerUrl)
      .then(url => {
        if (disposed) {
          URL.revokeObjectURL(url);
          return;
        }
        workerBlobUrl = url;
        setPdfWorkerSrc(url);
      })
      .catch(error => {
        if (!disposed) {
          setPdfWorkerError(error instanceof Error ? error.message : String(error));
        }
      });

    return () => {
      disposed = true;
      if (workerBlobUrl) {
        URL.revokeObjectURL(workerBlobUrl);
      }
    };
  }, []);

  useEffect(() => {
    const copyCapturedSelection = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'c') {
        return;
      }
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLElement &&
        activeElement.closest('input, textarea, [contenteditable="true"]')
      ) {
        return;
      }
      const text = selectionRef.current.selectedText.trim();
      if (!text) {
        return;
      }
      event.preventDefault();
      vscode.postMessage({ type: 'copySelection', payload: { text } });
    };
    window.addEventListener('keydown', copyCapturedSelection, true);
    return () => window.removeEventListener('keydown', copyCapturedSelection, true);
  }, []);

  const handleDocumentReady = useCallback((numPages: number) => {
    setPageTotal(numPages);
    if (!documentReadyRef.current) {
      documentReadyRef.current = true;
      setStatus('PDF 已载入。');
    }
  }, []);

  const handleStyleChange = useCallback((annotation: AnnotationRecord, nextColor: string, nextKind: AnnotationKind) => {
    vscode.postMessage({
      type: 'updateAnnotation',
      payload: { id: annotation.id, patch: { color: nextColor, kind: nextKind } }
    });
  }, []);

  useEffect(() => {
    vscode.postMessage({ type: 'ready' });
    const listener = (event: MessageEvent<IncomingMessage>) => {
      const message = event.data;
      if (message.type !== 'navigateTo' && message.documentId && message.documentId !== documentIdRef.current) {
        return;
      }
      if (message.type === 'state') {
        setState(message.payload);
        if (message.payload.progress?.page) {
          setCurrentPage(message.payload.progress.page);
        }
      }
      if (message.type === 'statePatch') {
        setState(current => ({
          ...current,
          annotations: message.payload.annotations ?? current.annotations,
          words: message.payload.words ?? current.words,
          research: message.payload.research ?? current.research,
          libraries: message.payload.libraries ?? current.libraries,
          comparison: message.payload.comparison ?? current.comparison,
          codex: message.payload.codex ?? current.codex
        }));
      }
      if (message.type === 'navigateTo') {
        flushReadingProgress();
        window.clearTimeout(pageIndicatorTimerRef.current);
        pageIndicatorTimerRef.current = undefined;
        pendingVisiblePageRef.current = undefined;
        documentIdRef.current = message.payload.documentId;
        setActiveDocumentId(message.payload.documentId);
        setPdfUrl(message.payload.pdfUrl);
        setPaperName(message.payload.paperName);
        setState(createDefaultState(message.payload.paperName));
        setCurrentPage(1);
        setPageTotal(0);
        setStatus('正在载入 PDF……');
        documentReadyRef.current = false;
        setLastDeleted(undefined);
        clearAnnotationDraft();
        setResearchSourceLocator(undefined);
        setWorkspaceView('reader');
      }
      if (message.type === 'stateError') {
        setStatus(message.payload.message);
      }
      if (message.type === 'translationResult') {
        if (message.payload.requestId !== translationRequestRef.current) {
          return;
        }
        translationRequestRef.current = undefined;
        if (message.payload.sourceText !== selectionRef.current.selectedText.trim()) {
          return;
        }
        setTranslationSourceText(message.payload.sourceText);
        setTranslationOutput(message.payload.error || message.payload.translatedText || '');
        setWordDetails(message.payload.wordDetails);
        setActiveSidebarTab('translation');
      }
      if (message.type === 'translationSettings') {
        setTranslationMode(message.payload.mode);
        setTranslationProvider(message.payload.provider);
        setDeepSeekModel(message.payload.deepSeekModel);
        setHasDeepSeekApiKey(message.payload.hasDeepSeekApiKey);
        setDictionaryReady(message.payload.dictionaryReady);
        setArgosPythonFound(message.payload.argosPythonFound);
      }
      if (message.type === 'exportResult') {
        setStatus(message.payload.error ? `导出失败：${message.payload.error}` : `已导出：${message.payload.path}`);
      }
      if (message.type === 'clipboardResult' || message.type === 'annotationActionResult') {
        setStatus(message.payload.error || message.payload.message || '操作完成。');
      }
      if (message.type === 'codexResult') {
        setStatus(message.payload.error || message.payload.message || 'Codex 上下文已准备好。');
      }
      if (message.type === 'libraryResult') {
        setState(current => ({ ...current, libraries: message.payload.indexes }));
        setStatus(message.payload.message || '论文文库已更新。');
        setWorkspaceView('library');
      }
      if (message.type === 'comparisonResult') {
        setState(current => ({ ...current, comparison: message.payload.comparison }));
        setStatus(message.payload.message || '跨论文比较已准备好。');
        setWorkspaceView('comparison');
      }
      if (message.type === 'focusEvidence') {
        focusEvidenceTarget(message.payload);
      }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [flushReadingProgress]);

  useEffect(() => {
    if (!state.progress?.page || !pageTotal) {
      return;
    }
    const timer = window.setTimeout(() => goToPage(state.progress.page || 1, false), 250);
    return () => window.clearTimeout(timer);
  }, [pageTotal, state.progress?.page]);

  const highlights = useMemo(
    () => state.annotations.map(annotationToHighlight).filter(Boolean) as ReaderHighlight[],
    [state.annotations]
  );

  const filteredAnnotations = useMemo(() => {
    return filterAnnotations(state.annotations, {
      query: annotationQuery,
      tags: tagQuery,
      color: colorFilter,
      kind: kindFilter,
      sort: sortMode
    });
  }, [annotationQuery, colorFilter, kindFilter, sortMode, state.annotations, tagQuery]);

  function handleSelection(selection: PdfSelection) {
    const nativeSelection = window.getSelection();
    if (nativeSelection?.rangeCount) {
      selectedPageElements(nativeSelection.getRangeAt(0)).forEach(markPageSelectionRegions);
    }
    const startsInNonBodyText = selectionStartsInNonBodyText(nativeSelection);
    const cleanText = extractSelectedPdfText(nativeSelection, startsInNonBodyText);
    const ghost = selection.makeGhostHighlight();
    const cleanPosition = startsInNonBodyText
      ? ghost.position
      : filterNonBodyRects(ghost.position);
    const text = cleanText || ghost.content.text || '';
    ghost.content.text = text;
    ghost.position = cleanPosition;
    setSelectedText(text);
    setCurrentPage(cleanPosition.boundingRect.pageNumber);
    setTranslationSourceText('');
    setTranslationOutput('');
    setWordDetails(undefined);
    selectionRef.current = {
      selectedText: text,
      selectionPosition: cleanPosition,
      currentPage: cleanPosition.boundingRect.pageNumber
    };
    vscode.postMessage({
      type: 'setCurrentSelection',
      payload: {
        locator: selectionToEvidenceLocator(state.paperFingerprint, selectionRef.current),
        currentPage: cleanPosition.boundingRect.pageNumber
      }
    });
    setStatus('已捕获选区。');
  }

  function resolveAnnotationTipPosition(
    annotation: AnnotationRecord,
    viewportPosition?: ViewportPosition
  ) {
    const utils = highlighterRef.current;
    const viewer = utils?.getViewer();
    const storedPosition = annotation.highlighterPosition || rectsToHighlighterPosition(annotation.rects);
    const tipPosition = viewportPosition || (
      storedPosition && viewer
        ? scaledPositionToViewport(storedPosition, viewer)
        : undefined
    );
    if (!utils || !tipPosition) {
      setStatus('此标注缺少位置信息，无法在原文旁打开。');
      return undefined;
    }
    return { tipPosition, utils };
  }

  function openAnnotationActions(annotation: AnnotationRecord, viewportPosition?: ViewportPosition) {
    const resolved = resolveAnnotationTipPosition(annotation, viewportPosition);
    if (!resolved) {
      return;
    }
    const { tipPosition, utils } = resolved;
    setActiveId(annotation.id);
    utils.toggleEditInProgress(true);
    utils.setTip({
      position: tipPosition,
      content: (
        <InlineAnnotationActions
          onEdit={() => editAnnotation(annotation, tipPosition)}
          onDelete={() => {
            deleteAnnotation(annotation);
            closeAnnotationTip();
          }}
        />
      )
    });
    window.requestAnimationFrame(() => utils.updateTipPosition());
  }

  function editAnnotation(annotation: AnnotationRecord, viewportPosition?: ViewportPosition) {
    const resolved = resolveAnnotationTipPosition(annotation, viewportPosition);
    if (!resolved) {
      return;
    }
    const { tipPosition, utils } = resolved;
    setActiveId(annotation.id);
    focusAnnotation(annotation);
    utils.toggleEditInProgress(true);
    utils.setTip({
      position: tipPosition,
      content: (
        <InlineAnnotationEditor
          annotation={annotation}
          onCancel={closeAnnotationTip}
          onSave={patch => {
            vscode.postMessage({ type: 'updateAnnotation', payload: { id: annotation.id, patch } });
            setStatus('标注已保存。');
            closeAnnotationTip();
          }}
        />
      )
    });
    window.requestAnimationFrame(() => utils.updateTipPosition());
  }

  function deleteAnnotation(annotation: AnnotationRecord) {
    setLastDeleted(annotation);
    vscode.postMessage({ type: 'deleteAnnotation', payload: { id: annotation.id } });
    if (activeId === annotation.id) {
      closeAnnotationTip();
    }
    setStatus('标注已删除，可使用“撤销删除”恢复。');
  }

  function closeAnnotationTip() {
    const utils = highlighterRef.current;
    utils?.setTip(null);
    utils?.toggleEditInProgress(false);
    setActiveId(undefined);
  }

  function restoreLastDeleted() {
    if (!lastDeleted) {
      return;
    }
    vscode.postMessage({ type: 'restoreAnnotation', payload: lastDeleted });
    setLastDeleted(undefined);
  }

  function clearAnnotationDraft() {
    setSelectedText('');
    setActiveId(undefined);
    selectionRef.current = { selectedText: '', selectionPosition: undefined, currentPage: 1 };
    vscode.postMessage({ type: 'setCurrentSelection', payload: { currentPage } });
  }

  const beginTranslation = useCallback((text: string) => {
    const previousRequestId = translationRequestRef.current;
    if (previousRequestId) {
      vscode.postMessage({ type: 'cancelTranslation', payload: { requestId: previousRequestId } });
    }
    const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    translationRequestRef.current = requestId;
    const s = selectionRef.current;
    setSelectedText(text);
    setCurrentPage(s.currentPage);
    setTranslationSourceText(text);
    setTranslationOutput('正在翻译……');
    setWordDetails(undefined);
    setActiveSidebarTab('translation');
    vscode.postMessage({ type: 'translate', payload: { text, requestId } });
  }, []);

  const cancelTranslation = useCallback(() => {
    const requestId = translationRequestRef.current;
    if (!requestId) return;
    vscode.postMessage({ type: 'cancelTranslation', payload: { requestId } });
    translationRequestRef.current = undefined;
    setTranslationOutput('翻译已取消。');
  }, []);

  const actionContext = useMemo(() => ({
    selectedText,
    locator: selectionToEvidenceLocator(state.paperFingerprint, selectionRef.current),
    codexAvailable: state.codex.available
  }), [selectedText, state.codex.available, state.paperFingerprint]);

  const handleReaderAction = useCallback((id: ReaderActionId, options?: ReaderActionOptions) => {
    const currentContext = {
      selectedText: selectionRef.current.selectedText,
      locator: selectionToEvidenceLocator(state.paperFingerprint, selectionRef.current),
      codexAvailable: state.codex.available
    };
    const result = invokeReaderAction(id, currentContext, options);
    if ('error' in result) {
      setStatus(result.error || '此操作当前不可用。');
      return;
    }
    const payload = result.payload;
    if (payload.type === 'saveAnnotation') {
      if (!doSaveAnnotation(selectionRef.current, {
        color: payload.color,
        kind: payload.kind,
        note: payload.note
      })) {
        setStatus('无法从当前选区创建标注。');
        return;
      }
      clearAnnotationDraft();
      highlighterRef.current?.removeGhostHighlight();
      setStatus(payload.note ? '笔记已保存。' : '标注已保存。');
      return;
    }
    if (payload.type === 'translate') {
      beginTranslation(payload.text);
      return;
    }
    vscode.postMessage({
      type: 'askCodex',
      payload: {
        question: payload.question,
        locator: payload.locator,
        currentPage: selectionRef.current.currentPage
      }
    });
    setStatus('正在准备 Codex 上下文……');
  }, [beginTranslation, state.codex.available, state.paperFingerprint]);

  const saveSelectionWord = useCallback((details: WordDetails) => {
    const s = selectionRef.current;
    const selected = s.selectedText.trim();
    if (!selected || details.word !== selected) {
      setStatus('请先选择一个单词。');
      return;
    }
    vscode.postMessage({
      type: 'saveWord',
      payload: {
        word: details.word,
        translation: summarizeWordDetails(details),
        phonetic: details.phonetic,
        definitions: details.definitions,
        sentence: selected,
        note: '',
        page: s.currentPage
      }
    });
    highlighterRef.current?.removeGhostHighlight();
    setActiveSidebarTab('wordbook');
    setStatus('单词已保存到生词本。');
  }, []);

  const selectionToolbarContextValue = useMemo<SelectionToolbarContextValue>(() => ({
    selectedText,
    translationSourceText,
    translationText: translationOutput,
    wordDetails,
    actionContext,
    onInvoke: handleReaderAction,
    onCancelTranslation: cancelTranslation,
    onSaveWord: saveSelectionWord
  }), [actionContext, cancelTranslation, handleReaderAction, saveSelectionWord, selectedText, translationOutput, translationSourceText, wordDetails]);

  const selectionTip = useMemo(() => <SelectionToolbar />, []);
  const libraryPaperCount = state.libraries.reduce((total, index) => total + index.papers.length, 0);
  const repositoryCount = state.research.artifacts.filter(artifact =>
    artifact.type === 'github' || artifact.type === 'git_repository'
  ).length;
  const currentPaperName = paperName || state.paperName || readerConfig.paperName;

  /*
   * react-pdf-highlighter-plus stores the selectionTip React element at mouseup.
   * Context keeps that cached element connected to the latest selection/result.
   */
  const readerView = (
    <SelectionToolbarContext.Provider value={selectionToolbarContextValue}>
      <section className="reader">
        <div className="reader-chrome">
          <div className="reader-titlebar">
            <div className="reader-identity">
              <span className="reader-kicker">INLEAF / 论文</span>
              <strong title={currentPaperName}>{currentPaperName}</strong>
            </div>
            <div className="reader-health" aria-label="阅读器集成状态">
              <span className="health-pill health-local"><i />本地侧车</span>
              <span className={`health-pill ${state.codex.available ? 'health-ready' : 'health-muted'}`}>
                <i />Codex {state.codex.available ? '已就绪' : '未连接'}
              </span>
              <span className="health-pill health-muted"><i />{libraryPaperCount} 篇论文</span>
            </div>
          </div>
          <div className="reader-toolbar">
            <div className="toolbar-cluster toolbar-pages">
              <button className="tool-icon" title="上一页" aria-label="上一页" onClick={() => goToPage(currentPage - 1)}>‹</button>
              <label className="page-jump">
                <span>页码</span>
                <input
                  type="number"
                  min={1}
                  max={pageTotal || undefined}
                  value={currentPage}
                  onChange={event => setCurrentPage(Number(event.target.value) || 1)}
                  onBlur={() => goToPage(currentPage)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      goToPage(currentPage);
                    }
                  }}
                />
                <span>/ {pageTotal || '-'}</span>
              </label>
              <button className="tool-icon" title="下一页" aria-label="下一页" onClick={() => goToPage(currentPage + 1)}>›</button>
            </div>
            <div className="toolbar-cluster toolbar-zoom">
              <button className="tool-icon" title="缩小" aria-label="缩小" onClick={() => zoomByFactor(0.85)}>−</button>
              <span ref={zoomLabelRef} className="zoom-value">{zoomLabel(zoom)}</span>
              <button className="tool-icon" title="放大" aria-label="放大" onClick={() => zoomByFactor(1.15)}>+</button>
              <button className="tool-text" title="适合页面宽度" onClick={() => applyZoom('page-width')}>适合宽度</button>
            </div>
            <span className="reader-status" title={status}>{status}</span>
            <button
              className="tool-text inspector-toggle"
              title={sidebarVisible ? '隐藏论文检查器' : '显示论文概览'}
              aria-label={sidebarVisible ? '隐藏论文检查器' : '显示论文概览'}
              aria-expanded={sidebarVisible}
              onClick={() => {
                setWorkspaceView('reader');
                setActiveSidebarTab('overview');
                setSidebarVisible(visible => !visible);
              }}
            >
              {sidebarVisible ? '隐藏检查器' : '论文详情'}
            </button>
          </div>
        </div>
        <div className="pdf-host">
          {pdfWorkerError ? (
            <div className="loading error">无法启动 PDF 工作线程：{pdfWorkerError}</div>
          ) : pdfWorkerSrc ? (
            <PdfLoader
              key={pdfUrl}
              document={pdfDocumentSource}
              workerSrc={pdfWorkerSrc}
              beforeLoad={progress => <div className="loading">正在载入 PDF {progress.loaded ? `${Math.round(progress.loaded / 1024)} KB` : ''}</div>}
              errorMessage={error => <div className="loading error">无法载入 PDF：{error.message}</div>}
              onError={error => {
                if (!isExpectedPdfCancellation(error)) {
                  setStatus(`无法载入 PDF：${error.message}`);
                }
              }}
            >
              {pdfDocument => (
                <PdfDocumentView
                  activeId={activeId}
                  highlights={highlights}
                  pdfDocument={pdfDocument}
                  selectionTip={selectionTip}
                  zoom={zoom}
                  onDelete={deleteAnnotation}
                  onDocumentReady={handleDocumentReady}
                  onOpen={openAnnotationActions}
                  onPageChange={handleVisiblePageChange}
                  onPinchZoom={handlePinchZoom}
                  onSelection={handleSelection}
                  onStyleChange={handleStyleChange}
                  utilsRef={handleHighlighterUtils}
                />
              )}
            </PdfLoader>
          ) : (
            <div className="loading">正在启动 PDF 工作线程……</div>
          )}
        </div>
        <footer className="reader-statusbar">
          <span><i className="status-dot status-dot-local" />本地数据</span>
          <span>{state.annotations.length} 条标注</span>
          <span>{state.words.length} 个生词</span>
          <span>{repositoryCount} 个仓库</span>
          <span className="statusbar-spacer" />
          <span>{state.paperFingerprint ? `PDF ${state.paperFingerprint.slice(0, 8)}` : '正在识别 PDF'}</span>
          <span>第 {currentPage} 页</span>
        </footer>
      </section>
    </SelectionToolbarContext.Provider>
  );

  function focusAnnotation(annotation: AnnotationRecord) {
    setActiveId(annotation.id);
    const highlight = annotationToHighlight(annotation);
    if (highlight) {
      highlighterRef.current?.scrollToHighlight(highlight);
      return;
    }
    goToPage(annotation.page || 1);
  }

  function focusEvidenceTarget(target: EvidenceFocusTarget) {
    setWorkspaceView('reader');
    if (target.kind === 'wrongDocument' || target.kind === 'sourceMissing') {
      setStatus(target.reason);
      return;
    }
    if (target.kind === 'annotation') {
      const annotation = annotationsRef.current.find(item => item.id === target.annotationId);
      if (annotation) {
        focusAnnotation(annotation);
        setStatus(`已打开第 ${target.page} 页的证据标注。`);
        return;
      }
    }
    if (target.kind === 'geometry') {
      const position = rectsToHighlighterPosition(target.rects);
      if (position) {
        highlighterRef.current?.scrollToHighlight({
          id: `evidence-${target.locator.documentFingerprint}-${target.page}`,
          type: 'text',
          content: { text: target.locator.quote },
          position
        } as ReaderHighlight);
        setStatus(`已打开第 ${target.page} 页的证据位置。`);
        return;
      }
    }
    goToPage(target.page, false);
    setStatus(`已打开第 ${target.page} 页，请人工确认引用证据。`);
  }

  function goToPage(page: number, saveProgress = true) {
    const nextPage = Math.min(Math.max(page, 1), pageTotal || page || 1);
    setCurrentPage(nextPage);
    highlighterRef.current?.getViewer()?.scrollPageIntoView({ pageNumber: nextPage });
    if (!saveProgress) {
      return;
    }
    saveReadingProgress(nextPage);
  }

  function openInspector(tab: SidebarTab) {
    setWorkspaceView('reader');
    setActiveSidebarTab(tab);
    setSidebarVisible(true);
  }

  return (
    <main className={`shell${sidebarVisible ? '' : ' sidebar-hidden'}`}>
      <nav className="activity-rail" aria-label="Inleaf 阅读工作台">
        <div className="activity-brand" title="Inleaf Reader"><span>叶</span></div>
        <button
          className={workspaceView === 'reader' && !sidebarVisible ? 'active-activity' : ''}
          onClick={() => {
            setWorkspaceView('reader');
            setSidebarVisible(false);
          }}
          aria-label="阅读"
          title="阅读"
        ><span className="activity-glyph">阅</span><small>阅读</small></button>
        <button
          className={sidebarVisible && activeSidebarTab === 'annotations' ? 'active-activity' : ''}
          onClick={() => openInspector('annotations')}
          aria-label="标注"
          title="标注"
        ><span className="activity-glyph">记</span><small>标注</small><b>{state.annotations.length || ''}</b></button>
        <button
          className={sidebarVisible && activeSidebarTab === 'research' ? 'active-activity' : ''}
          onClick={() => openInspector('research')}
          aria-label="论文研究档案"
          title="论文研究档案"
        ><span className="activity-glyph">研</span><small>研究</small></button>
        <button
          className={sidebarVisible && activeSidebarTab === 'repositories' ? 'active-activity' : ''}
          onClick={() => openInspector('repositories')}
          aria-label="代码仓库"
          title="代码仓库"
        ><span className="activity-glyph">仓</span><small>仓库</small><b>{repositoryCount || ''}</b></button>
        <button
          className={workspaceView === 'library' ? 'active-activity' : ''}
          onClick={() => setWorkspaceView('library')}
          aria-label="论文文库"
          title="论文文库"
        ><span className="activity-glyph">库</span><small>文库</small><b>{libraryPaperCount || ''}</b></button>
        <button
          className={workspaceView === 'comparison' ? 'active-activity' : ''}
          onClick={() => state.comparison ? setWorkspaceView('comparison') : setStatus('请先在论文文库中创建比较。')}
          aria-label="跨论文比较"
          title={state.comparison ? '跨论文比较' : '请先在论文文库中创建比较'}
        ><span className="activity-glyph">比</span><small>对比</small></button>
        <div className="activity-spacer" />
        <button
          onClick={() => vscode.postMessage({ type: 'openQuickStart' })}
          aria-label="设置"
          title="打开 Inleaf 快速设置"
        ><span className="activity-glyph">设</span><small>设置</small></button>
      </nav>
      {readerView}
      <aside className="side-panel" aria-hidden={!sidebarVisible}>
        <header className="side-panel-header">
          <div>
            <p className="eyebrow">论文检查器 / {sidebarTabLabels[activeSidebarTab]}</p>
            <h1>{currentPaperName}</h1>
          </div>
          <button
            className="side-panel-close secondary-button"
            title="隐藏侧栏"
            aria-label="隐藏侧栏"
            onClick={() => setSidebarVisible(false)}
          >
            ×
          </button>
        </header>

        <nav className="side-tabs" aria-label="阅读器面板">
          <button className={activeSidebarTab === 'overview' ? 'active-tab' : ''} onClick={() => setActiveSidebarTab('overview')}>概览</button>
          <button className={activeSidebarTab === 'annotations' ? 'active-tab' : ''} onClick={() => setActiveSidebarTab('annotations')}>标注</button>
          <button className={activeSidebarTab === 'wordbook' ? 'active-tab' : ''} onClick={() => setActiveSidebarTab('wordbook')}>生词本</button>
          <button className={activeSidebarTab === 'translation' ? 'active-tab' : ''} onClick={() => setActiveSidebarTab('translation')}>翻译</button>
          <button className={activeSidebarTab === 'research' ? 'active-tab' : ''} onClick={() => setActiveSidebarTab('research')}>研究</button>
          <button className={activeSidebarTab === 'repositories' ? 'active-tab' : ''} onClick={() => setActiveSidebarTab('repositories')}>仓库</button>
        </nav>

        {activeSidebarTab === 'overview' ? (
          <section className="side-tab-panel">
            <div className="overview-grid">
              <div className="metric-card">
                <span>页码</span>
                <strong>{currentPage} / {pageTotal || '-'}</strong>
              </div>
              <div className="metric-card">
                <span>标注</span>
                <strong>{state.annotations.length}</strong>
              </div>
              <div className="metric-card">
                <span>生词</span>
                <strong>{state.words.length}</strong>
              </div>
              <div className="metric-card">
                <span>研究事实</span>
                <strong>{state.research.facts.length}</strong>
              </div>
              <div className="metric-card">
                <span>代码仓库</span>
                <strong>{repositoryCount}</strong>
              </div>
              <div className="metric-card">
                <span>文库论文</span>
                <strong>{libraryPaperCount}</strong>
              </div>
            </div>
            <section className="tool-block">
              <h2>翻译</h2>
              <dl className="meta-list">
                <div>
                  <dt>提供商</dt>
                  <dd>{translationProvider === 'deepseek' ? 'DeepSeek AI' : translationProvider === 'libretranslate' ? 'LibreTranslate' : '本地 Argos'}</dd>
                </div>
                <div>
                  <dt>语言</dt>
                  <dd>{readerConfig.translationSource === 'auto' ? '自动识别' : readerConfig.translationSource} {'→'} {readerConfig.translationTarget || 'zh'}</dd>
                </div>
              </dl>
            </section>
            <section className="tool-block">
              <h2>状态</h2>
              <div className="empty compact-empty">{status}</div>
            </section>
            <section className="tool-block">
              <h2>当前选区</h2>
              {selectedText.trim() ? <p className="selection-preview">{shorten(selectedText, 260)}</p> : <div className="empty compact-empty">请在 PDF 中选择文本后使用相关操作。</div>}
            </section>
          </section>
        ) : null}

        {activeSidebarTab === 'annotations' ? (
          <section className="side-tab-panel list-block">
            <section className="tool-block">
              <h2>已保存标注</h2>
              <input type="search" value={annotationQuery} onChange={event => setAnnotationQuery(event.target.value)} placeholder="搜索标注" />
              <input type="search" value={tagQuery} onChange={event => setTagQuery(event.target.value)} placeholder="按标签筛选" />
              <select value={colorFilter} onChange={event => setColorFilter(event.target.value)}>
                <option value="">全部颜色</option>
                {colorOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <select value={kindFilter} onChange={event => setKindFilter(event.target.value)}>
                <option value="">全部样式</option>
                <option value="highlight">高亮</option>
                <option value="underline">下划线</option>
              </select>
              <select value={sortMode} onChange={event => setSortMode(event.target.value as AnnotationSortMode)}>
                <option value="position">按论文顺序</option>
                <option value="created">按最新创建</option>
                <option value="updated">按最近编辑</option>
              </select>
              <div className="actions">
                <button onClick={() => vscode.postMessage({ type: 'exportAnnotations' })}>导出 Markdown</button>
                <button onClick={() => vscode.postMessage({ type: 'exportAnnotatedPdf' })}>导出 PDF</button>
              </div>
              {lastDeleted ? <button className="undo-button" onClick={restoreLastDeleted}>撤销删除</button> : null}
              <div className="status-line">{annotationStatus(filteredAnnotations.length, state.annotations.length)}</div>
              <AnnotationSummary annotations={filteredAnnotations} />
              <div className="list">
                {filteredAnnotations.length ? filteredAnnotations.map(annotation => (
                  <AnnotationItem
                    key={annotation.id}
                    annotation={annotation}
                    active={annotation.id === activeId}
                    onFocus={() => focusAnnotation(annotation)}
                    onEdit={() => editAnnotation(annotation)}
                    onCopy={() => vscode.postMessage({ type: 'copyAnnotationMarkdown', payload: { id: annotation.id } })}
                    onResearch={() => {
                      setResearchSourceLocator(annotationToEvidenceLocator(state.paperFingerprint, annotation));
                      setActiveSidebarTab('research');
                    }}
                    onDelete={() => deleteAnnotation(annotation)}
                  />
                )) : <div className="empty">尚未保存标注。</div>}
              </div>
            </section>
          </section>
        ) : null}

        {activeSidebarTab === 'wordbook' ? (
          <section className="side-tab-panel list-block">
            <section className="tool-block">
              <h2>已保存生词（{state.words.length}）</h2>
              {state.words.length ? (
                <div className="list">
                  {state.words.map(item => (
                    <WordItem
                      key={item.id}
                      word={item}
                      onDelete={() => vscode.postMessage({ type: 'deleteWord', payload: { id: item.id } })}
                    />
                  ))}
                </div>
              ) : <div className="empty">尚未保存生词。</div>}
            </section>
          </section>
        ) : null}

        {activeSidebarTab === 'translation' ? (
          <section className="side-tab-panel">
            <section className="tool-block">
              <h2>翻译模式</h2>
              <label htmlFor="translationMode">选择如何翻译当前文本</label>
              <select
                id="translationMode"
                value={translationMode}
                onChange={event => {
                  const mode = event.target.value as TranslationMode;
                  vscode.postMessage({ type: 'setTranslationMode', payload: { mode } });
                }}
              >
                <option value="local">离线词典 + 本地翻译</option>
                <option value="deepseek">AI 翻译（DeepSeek）</option>
              </select>
              {translationMode === 'deepseek' ? (
                <>
                  <label htmlFor="deepSeekModel">DeepSeek 模型</label>
                  <select
                    id="deepSeekModel"
                    value={deepSeekModel}
                    onChange={event => vscode.postMessage({
                      type: 'setDeepSeekModel',
                      payload: { model: event.target.value as 'deepseek-v4-flash' | 'deepseek-v4-pro' }
                    })}
                  >
                    <option value="deepseek-v4-flash">DeepSeek V4 Flash</option>
                    <option value="deepseek-v4-pro">DeepSeek V4 Pro</option>
                  </select>
                  <div className={`provider-status ${hasDeepSeekApiKey ? 'ready' : 'missing'}`}>
                    {hasDeepSeekApiKey ? 'DeepSeek API Key 已配置。' : '需要配置 DeepSeek API Key。'}
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => vscode.postMessage({ type: 'configureDeepSeek' })}
                  >
                    {hasDeepSeekApiKey ? '更换 API Key' : '设置 API Key'}
                  </button>
                </>
              ) : (
                <>
                  <div className={`provider-status ${dictionaryReady ? 'ready' : 'missing'}`}>
                    {dictionaryReady ? '离线词典已就绪。' : '未找到离线词典。'}
                  </div>
                  {translationProvider === 'argos' ? (
                    <div className={`provider-status ${argosPythonFound ? 'ready' : 'missing'}`}>
                      {argosPythonFound ? '已找到 Argos Python。' : '尚未配置用于句子翻译的 Argos。'}
                    </div>
                  ) : null}
                  <button className="secondary-button" onClick={() => vscode.postMessage({ type: 'diagnoseTranslation' })}>
                    诊断翻译配置
                  </button>
                </>
              )}
            </section>
            <section className="tool-block">
              <h2>当前选区</h2>
              {selectedText.trim() ? <p className="selection-preview">{selectedText}</p> : <div className="empty compact-empty">请在 PDF 中选择文本，然后在选区工具条中点击“翻译”。</div>}
            </section>
            <section className="tool-block">
              <h2>翻译结果</h2>
              {wordDetails ? <WordDetailsBlock details={wordDetails} /> : null}
              {!wordDetails && translationOutput.trim() ? <p className="translation-preview">{translationOutput}</p> : null}
              {!wordDetails && !translationOutput.trim() ? <div className="empty compact-empty">暂无翻译结果。</div> : null}
            </section>
          </section>
        ) : null}

        {activeSidebarTab === 'research' ? (
          <ResearchPanel
            profile={state.research}
            annotations={state.annotations}
            currentLocator={researchSourceLocator || actionContext.locator}
            onSaveProfile={payload => vscode.postMessage({ type: 'updateResearchProfile', payload })}
            onAddFact={payload => vscode.postMessage({ type: 'addResearchFact', payload })}
            onSetFactStatus={(id, factStatus) => vscode.postMessage({
              type: 'setResearchFactStatus',
              payload: { id, status: factStatus }
            })}
            onFocusEvidence={locator => vscode.postMessage({ type: 'focusEvidence', payload: { locator } })}
          />
        ) : null}

        {activeSidebarTab === 'repositories' ? (
          <RepositoryPanel
            profile={state.research}
            onAdd={(url, relationship) => vscode.postMessage({ type: 'addRepositoryArtifact', payload: { url, relationship } })}
            onClone={id => vscode.postMessage({ type: 'cloneRepositoryArtifact', payload: { id } })}
            onChooseCheckout={id => vscode.postMessage({ type: 'chooseRepositoryCheckout', payload: { id } })}
            onRefresh={id => vscode.postMessage({ type: 'refreshRepositoryArtifact', payload: { id } })}
            onAnalyze={id => {
              vscode.postMessage({ type: 'analyzeRepositoryWithCodex', payload: { id } });
              setStatus('正在准备仓库分析上下文……');
            }}
            onDelete={id => vscode.postMessage({ type: 'deleteRepositoryArtifact', payload: { id } })}
          />
        ) : null}
      </aside>

      {workspaceView === 'library' ? (
        <LibraryView
          indexes={state.libraries}
          onClose={() => setWorkspaceView('reader')}
          onChooseRoot={() => vscode.postMessage({ type: 'chooseLibraryRoot' })}
          onRefresh={rootPath => vscode.postMessage({ type: 'rebuildLibrary', payload: { rootPath } })}
          onCompare={(papers: LibraryPaper[]) => vscode.postMessage({
            type: 'createComparison',
            payload: { fingerprints: papers.map(paper => paper.fingerprint) }
          })}
        />
      ) : null}

      {workspaceView === 'comparison' && state.comparison ? (
        <ComparisonView
          comparison={state.comparison}
          onBack={() => setWorkspaceView('library')}
          onClose={() => setWorkspaceView('reader')}
          onExport={() => vscode.postMessage({ type: 'exportComparison', payload: { comparisonId: state.comparison!.id } })}
          onAnalyze={() => vscode.postMessage({ type: 'analyzeComparisonWithCodex', payload: { comparisonId: state.comparison!.id } })}
          onFocusEvidence={locator => vscode.postMessage({ type: 'focusEvidence', payload: { locator } })}
        />
      ) : null}
    </main>
  );
}

function doSaveAnnotation(
  saveState: { selectedText: string; selectionPosition?: ScaledPosition; currentPage: number },
  opts: { color: string; kind: AnnotationKind; note?: string }
) {
  const payload = buildAnnotationPayload(saveState, opts);
  if (!payload) {
    return false;
  }
  vscode.postMessage({ type: 'saveAnnotation', payload });
  return true;
}

function createDefaultState(paperName: string): ReaderStatePayload {
  return {
    annotations: [],
    words: [],
    progress: { updatedAt: new Date(0).toISOString() },
    paperName,
    paperFingerprint: '',
    research: {
      schemaVersion: 1,
      paperFingerprint: '',
      bibliography: {
        title: paperName.replace(/\.pdf$/i, ''),
        authors: [],
        year: null,
        venue: '',
        doi: '',
        arxivId: '',
        projectUrl: ''
      },
      classification: {
        areas: [],
        tasks: [],
        methods: [],
        robots: [],
        endEffectors: [],
        sensors: [],
        dataSources: [],
        environments: [],
        evaluationTypes: [],
        custom: {}
      },
      artifacts: [],
      facts: [],
      relations: [],
      updatedAt: new Date(0).toISOString()
    },
    codex: { available: false },
    libraries: []
  };
}

function clampZoom(value: number) {
  return Math.min(Math.max(value, 0.5), 2.4);
}

function zoomLabel(value: PdfScaleValue) {
  if (typeof value === 'number') {
    return `${Math.round(value * 100)}%`;
  }
  if (value === 'page-width') {
    return 'Fit';
  }
  if (value === 'page-actual') {
    return '100%';
  }
  return value;
}

function shorten(value: string, max: number) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized;
}

function Bootstrap() {
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (isIgnorableWebviewError(event.error || event.message)) {
        event.preventDefault();
        return;
      }
      setError(event.message || String(event.error || '未知 Webview 错误'));
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isIgnorableWebviewError(event.reason)) {
        event.preventDefault();
        return;
      }
      setError(event.reason instanceof Error ? event.reason.message : String(event.reason || '未处理的异步错误'));
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  if (error) {
    return (
      <main className="fatal-error">
        <h1>阅读器启动失败</h1>
        <pre>{error}</pre>
      </main>
    );
  }

  return <App />;
}

function isIgnorableWebviewError(reason: unknown) {
  return isExpectedPdfCancellation(reason) || isResizeObserverLoopWarning(reason);
}

function isExpectedPdfCancellation(reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason || '');
  return /worker was (?:terminated|destroyed)/i.test(message)
    || /loading aborted/i.test(message);
}

function isResizeObserverLoopWarning(reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason || '');
  return /^ResizeObserver loop (?:limit exceeded|completed with undelivered notifications)\.?$/i.test(message.trim());
}

async function createPdfWorkerBlobUrl(resourceUrl: string) {
  const response = await fetch(resourceUrl);
  if (!response.ok) {
    throw new Error(`工作线程资源请求失败，HTTP 状态码 ${response.status}。`);
  }
  const source = await response.arrayBuffer();
  return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
}

createRoot(document.getElementById('root')!).render(<Bootstrap />);
