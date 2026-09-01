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
import { PdfDocumentView } from './components/PdfDocumentView';
import {
  annotationToHighlight,
  buildAnnotationPayload,
  filterAnnotations,
  rectsToHighlighterPosition,
  summarizeWordDetails,
  type AnnotationSortMode,
  type ReaderHighlight
} from './annotationModel';
import type { IncomingMessage, SidebarTab, TranslationProvider } from './messages';
import {
  extractSelectedPdfText,
  filterNonBodyRects,
  markPageSelectionRegions,
  selectedPageElements,
  selectionStartsInNonBodyText
} from './pdfSelection';
import { readerConfig, setActiveDocumentId, vscode } from './vscodeApi';
import type { AnnotationKind, AnnotationRecord, ReaderStatePayload, WordDetails } from './types';

const defaultState: ReaderStatePayload = {
  annotations: [],
  words: [],
  progress: { updatedAt: new Date(0).toISOString() },
  paperName: readerConfig.paperName
};

function App() {
  const [state, setState] = useState<ReaderStatePayload>(defaultState);
  const [selectedText, setSelectedText] = useState('');
  const [translationOutput, setTranslationOutput] = useState('');
  const [wordDetails, setWordDetails] = useState<WordDetails | undefined>();
  const [translationSourceText, setTranslationSourceText] = useState('');
  const [translationProvider, setTranslationProvider] = useState<TranslationProvider>(readerConfig.translationProvider);
  const [deepSeekModel, setDeepSeekModel] = useState('deepseek-v4-flash');
  const [hasDeepSeekApiKey, setHasDeepSeekApiKey] = useState(false);
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
  const [status, setStatus] = useState('Loading PDF...');
  const [activeId, setActiveId] = useState<string | undefined>();
  const [lastDeleted, setLastDeleted] = useState<AnnotationRecord | undefined>();
  const [pdfUrl, setPdfUrl] = useState(readerConfig.pdfUrl);
  const [pdfWorkerSrc, setPdfWorkerSrc] = useState<string | undefined>();
  const [pdfWorkerError, setPdfWorkerError] = useState<string | undefined>();
  const [paperName, setPaperName] = useState(readerConfig.paperName);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('overview');
  const [sidebarVisible, setSidebarVisible] = useState(false);
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
  const selectionRef = useRef({ selectedText: '', selectionPosition: undefined as ScaledPosition | undefined, currentPage: 1 });
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
      setStatus('PDF loaded.');
    }
  }, []);

  useEffect(() => {
    vscode.postMessage({ type: 'ready' });
    const listener = (event: MessageEvent<IncomingMessage>) => {
      const message = event.data;
      if (message.type !== 'navigateTo' && message.documentId !== documentIdRef.current) {
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
          words: message.payload.words ?? current.words
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
        setState(defaultState);
        setCurrentPage(1);
        setPageTotal(0);
        setStatus('Loading PDF...');
        documentReadyRef.current = false;
        setLastDeleted(undefined);
        clearAnnotationDraft();
      }
      if (message.type === 'stateError') {
        setStatus(message.payload.message);
      }
      if (message.type === 'translationResult') {
        if (message.payload.sourceText !== selectionRef.current.selectedText.trim()) {
          return;
        }
        setTranslationSourceText(message.payload.sourceText);
        setTranslationOutput(message.payload.error || message.payload.translatedText || '');
        setWordDetails(message.payload.wordDetails);
        setActiveSidebarTab('translation');
      }
      if (message.type === 'translationSettings') {
        setTranslationProvider(message.payload.provider);
        setDeepSeekModel(message.payload.deepSeekModel);
        setHasDeepSeekApiKey(message.payload.hasDeepSeekApiKey);
        setDictionaryReady(message.payload.dictionaryReady);
        setArgosPythonFound(message.payload.argosPythonFound);
      }
      if (message.type === 'exportResult') {
        setStatus(message.payload.error ? `Export failed: ${message.payload.error}` : `Exported: ${message.payload.path}`);
      }
      if (message.type === 'clipboardResult' || message.type === 'annotationActionResult') {
        setStatus(message.payload.error || message.payload.message || 'Done.');
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
    setStatus('Selection captured.');
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
      setStatus('This annotation cannot be opened inline because its position is unavailable.');
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
            setStatus('Annotation saved.');
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
    setStatus('Annotation deleted. Use undo to restore it.');
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
  }

  const quickHighlight = useCallback((color: string) => {
    const s = selectionRef.current;
    if (!doSaveAnnotation(s, { color, kind: 'highlight' })) {
      setStatus('Select text before highlighting.');
      return;
    }
    clearAnnotationDraft();
    highlighterRef.current?.removeGhostHighlight();
    setStatus('Annotation saved.');
  }, []);

  const quickUnderline = useCallback((color: string) => {
    const s = selectionRef.current;
    if (!doSaveAnnotation(s, { color, kind: 'underline' })) {
      setStatus('Select text before highlighting.');
      return;
    }
    clearAnnotationDraft();
    highlighterRef.current?.removeGhostHighlight();
    setStatus('Annotation saved.');
  }, []);

  const saveSelectionNote = useCallback((noteText: string, noteColor: string) => {
    const s = selectionRef.current;
    if (!s.selectedText.trim()) {
      setStatus('Select text before adding a note.');
      return;
    }
    if (!doSaveAnnotation(s, { color: noteColor, kind: 'highlight', note: noteText })) {
      setStatus('Add note text before saving.');
      return;
    }
    clearAnnotationDraft();
    highlighterRef.current?.removeGhostHighlight();
    setStatus('Note saved.');
  }, []);

  const translateSelection = useCallback(() => {
    const s = selectionRef.current;
    const text = s.selectedText.trim();
    if (!text) {
      setStatus('Select text before translating.');
      return;
    }
    setSelectedText(text);
    setCurrentPage(s.currentPage);
    setTranslationSourceText(text);
    setTranslationOutput('Translating...');
    setWordDetails(undefined);
    setActiveSidebarTab('translation');
    vscode.postMessage({ type: 'translate', payload: { text } });
  }, []);

  const saveSelectionWord = useCallback((details: WordDetails) => {
    const s = selectionRef.current;
    const selected = s.selectedText.trim();
    if (!selected || details.word !== selected) {
      setStatus('Select a word before saving it.');
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
    setStatus('Word saved.');
  }, []);

  const selectionToolbarContextValue = useMemo<SelectionToolbarContextValue>(() => ({
    selectedText,
    translationSourceText,
    translationText: translationOutput,
    wordDetails,
    onHighlight: quickHighlight,
    onUnderline: quickUnderline,
    onSaveNote: saveSelectionNote,
    onTranslate: translateSelection,
    onSaveWord: saveSelectionWord
  }), [quickHighlight, quickUnderline, saveSelectionNote, saveSelectionWord, selectedText, translateSelection, translationOutput, translationSourceText, wordDetails]);

  const selectionTip = useMemo(() => <SelectionToolbar />, []);

  /*
   * react-pdf-highlighter-plus stores the selectionTip React element at mouseup.
   * Context keeps that cached element connected to the latest selection/result.
   */
  const readerView = (
    <SelectionToolbarContext.Provider value={selectionToolbarContextValue}>
      <section className="reader">
        <div className="reader-toolbar">
          <button title="Previous page" onClick={() => goToPage(currentPage - 1)}>Prev</button>
          <label className="page-jump">
            <span>Page</span>
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
          <button title="Next page" onClick={() => goToPage(currentPage + 1)}>Next</button>
          <button title="Zoom out" onClick={() => zoomByFactor(0.85)}>-</button>
          <span ref={zoomLabelRef} className="zoom-value">{zoomLabel(zoom)}</span>
          <button title="Zoom in" onClick={() => zoomByFactor(1.15)}>+</button>
          <button title="Fit page width" onClick={() => applyZoom('page-width')}>Fit</button>
          <button
            className="sidebar-toggle"
            title={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
            aria-label={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
            aria-expanded={sidebarVisible}
            onClick={() => setSidebarVisible(visible => !visible)}
          >
            {sidebarVisible ? 'Hide panel' : 'Show panel'}
          </button>
          <span className="reader-status">{status}</span>
        </div>
        <div className="pdf-host">
          {pdfWorkerError ? (
            <div className="loading error">Could not start PDF worker: {pdfWorkerError}</div>
          ) : pdfWorkerSrc ? (
            <PdfLoader
              key={pdfUrl}
              document={pdfDocumentSource}
              workerSrc={pdfWorkerSrc}
              beforeLoad={progress => <div className="loading">Loading PDF {progress.loaded ? `${Math.round(progress.loaded / 1024)} KB` : ''}</div>}
              errorMessage={error => <div className="loading error">Could not load PDF: {error.message}</div>}
              onError={error => {
                if (!isExpectedPdfCancellation(error)) {
                  setStatus(`Could not load PDF: ${error.message}`);
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
                  onDocumentReady={handleDocumentReady}
                  onOpen={openAnnotationActions}
                  onPageChange={handleVisiblePageChange}
                  onPinchZoom={handlePinchZoom}
                  onSelection={handleSelection}
                  utilsRef={handleHighlighterUtils}
                />
              )}
            </PdfLoader>
          ) : (
            <div className="loading">Starting PDF worker...</div>
          )}
        </div>
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

  function goToPage(page: number, saveProgress = true) {
    const nextPage = Math.min(Math.max(page, 1), pageTotal || page || 1);
    setCurrentPage(nextPage);
    highlighterRef.current?.getViewer()?.scrollPageIntoView({ pageNumber: nextPage });
    if (!saveProgress) {
      return;
    }
    saveReadingProgress(nextPage);
  }

  return (
    <main className={`shell${sidebarVisible ? '' : ' sidebar-hidden'}`}>
      {readerView}
      <aside className="side-panel" aria-hidden={!sidebarVisible}>
        <header className="side-panel-header">
          <div>
            <p className="eyebrow">Inleaf Reader</p>
            <h1>{paperName || state.paperName || readerConfig.paperName}</h1>
          </div>
          <button
            className="side-panel-close secondary-button"
            title="Hide sidebar"
            aria-label="Hide sidebar"
            onClick={() => setSidebarVisible(false)}
          >
            ×
          </button>
        </header>

        <nav className="side-tabs" aria-label="Reader panels">
          <button className={activeSidebarTab === 'overview' ? 'active-tab' : ''} onClick={() => setActiveSidebarTab('overview')}>Overview</button>
          <button className={activeSidebarTab === 'annotations' ? 'active-tab' : ''} onClick={() => setActiveSidebarTab('annotations')}>Annotations</button>
          <button className={activeSidebarTab === 'wordbook' ? 'active-tab' : ''} onClick={() => setActiveSidebarTab('wordbook')}>Wordbook</button>
          <button className={activeSidebarTab === 'translation' ? 'active-tab' : ''} onClick={() => setActiveSidebarTab('translation')}>Translation</button>
        </nav>

        {activeSidebarTab === 'overview' ? (
          <section className="side-tab-panel">
            <div className="overview-grid">
              <div className="metric-card">
                <span>Page</span>
                <strong>{currentPage} / {pageTotal || '-'}</strong>
              </div>
              <div className="metric-card">
                <span>Annotations</span>
                <strong>{state.annotations.length}</strong>
              </div>
              <div className="metric-card">
                <span>Words</span>
                <strong>{state.words.length}</strong>
              </div>
            </div>
            <section className="tool-block">
              <h2>Translation</h2>
              <dl className="meta-list">
                <div>
                  <dt>Provider</dt>
                  <dd>{translationProvider === 'deepseek' ? 'DeepSeek AI' : translationProvider === 'libretranslate' ? 'LibreTranslate' : 'Local Argos'}</dd>
                </div>
                <div>
                  <dt>Languages</dt>
                  <dd>{readerConfig.translationSource || 'auto'} {'->'} {readerConfig.translationTarget || 'zh'}</dd>
                </div>
              </dl>
            </section>
            <section className="tool-block">
              <h2>Status</h2>
              <div className="empty compact-empty">{status}</div>
            </section>
            <section className="tool-block">
              <h2>Current selection</h2>
              {selectedText.trim() ? <p className="selection-preview">{shorten(selectedText, 260)}</p> : <div className="empty compact-empty">Select text in the PDF to act on it.</div>}
            </section>
          </section>
        ) : null}

        {activeSidebarTab === 'annotations' ? (
          <section className="side-tab-panel list-block">
            <section className="tool-block">
              <h2>Saved Annotations</h2>
              <input type="search" value={annotationQuery} onChange={event => setAnnotationQuery(event.target.value)} placeholder="Search annotations" />
              <input type="search" value={tagQuery} onChange={event => setTagQuery(event.target.value)} placeholder="Filter by tag" />
              <select value={colorFilter} onChange={event => setColorFilter(event.target.value)}>
                <option value="">All colors</option>
                {colorOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <select value={kindFilter} onChange={event => setKindFilter(event.target.value)}>
                <option value="">All styles</option>
                <option value="highlight">Highlight</option>
                <option value="underline">Underline</option>
              </select>
              <select value={sortMode} onChange={event => setSortMode(event.target.value as AnnotationSortMode)}>
                <option value="position">Sort by paper order</option>
                <option value="created">Sort by newest</option>
                <option value="updated">Sort by recently edited</option>
              </select>
              <div className="actions">
                <button onClick={() => vscode.postMessage({ type: 'exportAnnotations' })}>Export Markdown</button>
                <button onClick={() => vscode.postMessage({ type: 'exportAnnotatedPdf' })}>Export PDF</button>
              </div>
              {lastDeleted ? <button className="undo-button" onClick={restoreLastDeleted}>Undo delete</button> : null}
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
                    onDelete={() => deleteAnnotation(annotation)}
                  />
                )) : <div className="empty">No annotations saved yet.</div>}
              </div>
            </section>
          </section>
        ) : null}

        {activeSidebarTab === 'wordbook' ? (
          <section className="side-tab-panel list-block">
            <section className="tool-block">
              <h2>Saved Words ({state.words.length})</h2>
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
              ) : <div className="empty">No words saved yet.</div>}
            </section>
          </section>
        ) : null}

        {activeSidebarTab === 'translation' ? (
          <section className="side-tab-panel">
            <section className="tool-block">
              <h2>Translation Mode</h2>
              <label htmlFor="translationProvider">Choose how selected text is translated</label>
              <select
                id="translationProvider"
                value={translationProvider}
                onChange={event => {
                  const provider = event.target.value as TranslationProvider;
                  vscode.postMessage({ type: 'setTranslationProvider', payload: { provider } });
                }}
              >
                <option value="argos">Argos Translate (local)</option>
                <option value="libretranslate">LibreTranslate (configured endpoint)</option>
                <option value="deepseek">DeepSeek ({deepSeekModel})</option>
              </select>
              {translationProvider === 'deepseek' ? (
                <>
                  <div className={`provider-status ${hasDeepSeekApiKey ? 'ready' : 'missing'}`}>
                    {hasDeepSeekApiKey ? 'DeepSeek API Key is configured.' : 'DeepSeek API Key is required.'}
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => vscode.postMessage({ type: 'configureDeepSeek' })}
                  >
                    {hasDeepSeekApiKey ? 'Replace API Key' : 'Set API Key'}
                  </button>
                </>
              ) : (
                <>
                  <div className={`provider-status ${dictionaryReady ? 'ready' : 'missing'}`}>
                    {dictionaryReady ? 'Offline dictionary is ready.' : 'Offline dictionary is missing.'}
                  </div>
                  {translationProvider === 'argos' ? (
                    <div className={`provider-status ${argosPythonFound ? 'ready' : 'missing'}`}>
                      {argosPythonFound ? 'Argos Python was found.' : 'Argos is not configured for sentence translation.'}
                    </div>
                  ) : null}
                  <button className="secondary-button" onClick={() => vscode.postMessage({ type: 'diagnoseTranslation' })}>
                    Diagnose translation setup
                  </button>
                </>
              )}
            </section>
            <section className="tool-block">
              <h2>Current Selection</h2>
              {selectedText.trim() ? <p className="selection-preview">{selectedText}</p> : <div className="empty compact-empty">Select text in the PDF, then use Translate in the selection toolbar.</div>}
            </section>
            <section className="tool-block">
              <h2>Result</h2>
              {wordDetails ? <WordDetailsBlock details={wordDetails} /> : null}
              {!wordDetails && translationOutput.trim() ? <p className="translation-preview">{translationOutput}</p> : null}
              {!wordDetails && !translationOutput.trim() ? <div className="empty compact-empty">No translation yet.</div> : null}
            </section>
          </section>
        ) : null}
      </aside>
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
      setError(event.message || String(event.error || 'Unknown Webview error'));
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isIgnorableWebviewError(event.reason)) {
        event.preventDefault();
        return;
      }
      setError(event.reason instanceof Error ? event.reason.message : String(event.reason || 'Unhandled promise rejection'));
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
        <h1>Reader failed to start</h1>
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
    throw new Error(`Worker resource request failed with HTTP ${response.status}.`);
  }
  const source = await response.arrayBuffer();
  return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
}

createRoot(document.getElementById('root')!).render(<Bootstrap />);
