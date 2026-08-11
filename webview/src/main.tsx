import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AreaHighlight,
  MonitoredHighlightContainer,
  PdfHighlighter,
  PdfLoader,
  TextHighlight,
  scaledPositionToViewport,
  useHighlightContainerContext,
  type Highlight,
  type PdfHighlighterUtils,
  type PdfScaleValue,
  type PdfSelection,
  type ScaledPosition,
  type Tip,
  type ViewportPosition
} from 'react-pdf-highlighter-plus';
import 'pdfjs-dist/web/pdf_viewer.css';
import 'react-pdf-highlighter-plus/style/style.css';
import './styles.css';
import { readerConfig, setActiveDocumentId, vscode } from './vscodeApi';
import type { AnnotationKind, AnnotationRecord, AnnotationRect, ReaderStatePayload, WordDetails, WordRecord } from './types';

type ReaderHighlight = Highlight & {
  annotation?: AnnotationRecord;
};

type PdfPageChangingEvent = {
  pageNumber?: number;
};

type PdfScaleChangingEvent = {
  scale?: number;
};

type PdfLayerRenderedEvent = {
  pageNumber?: number;
};

type PdfEventBus = {
  on(eventName: string, listener: (event: any) => void): void;
  off(eventName: string, listener: (event: any) => void): void;
};

type PdfViewerInstance = {
  container: HTMLDivElement;
  currentScale: number;
  currentScaleValue: string;
  getPageView(index: number): { div?: HTMLElement } | undefined;
};

const PAGE_VERTICAL_MARGIN_SELECTION_RATIO = 0.08;
const PAGE_HORIZONTAL_MARGIN_SELECTION_RATIO = 0.04;
const FIGURE_CAPTION_PATTERN = /^(?:figure|fig\.)\s*\d+/i;

interface NormalizedPageRegion {
  top: number;
  bottom: number;
}

type SidebarTab = 'overview' | 'annotations' | 'wordbook' | 'translation';
type TranslationMode = 'local' | 'deepseek';

interface SelectionToolbarContextValue {
  selectedText: string;
  translationSourceText: string;
  translationText: string;
  wordDetails?: WordDetails;
  onHighlight(color: string): void;
  onUnderline(color: string): void;
  onSaveNote(note: string, color: string): void;
  onTranslate(): void;
  onSaveWord(details: WordDetails): void;
}

const SelectionToolbarContext = React.createContext<SelectionToolbarContextValue | undefined>(undefined);

type IncomingMessage = (
  | { type: 'state'; payload: ReaderStatePayload }
  | { type: 'statePatch'; payload: { annotations?: AnnotationRecord[]; words?: WordRecord[] } }
  | { type: 'navigateTo'; payload: { pdfUrl: string; paperName: string; documentId: string } }
  | { type: 'translationResult'; payload: { sourceText: string; translatedText?: string; wordDetails?: WordDetails; error?: string } }
  | { type: 'translationSettings'; payload: { mode: TranslationMode; provider: string; hasDeepSeekApiKey: boolean; dictionaryReady: boolean; argosPythonFound: boolean } }
  | { type: 'exportResult'; payload: { path?: string; error?: string } }
  | { type: 'clipboardResult'; payload: { message?: string; error?: string } }
  | { type: 'annotationActionResult'; payload: { message?: string; error?: string } }
  | { type: 'stateError'; payload: { message: string } }
) & { documentId?: string };

const colorOptions = [
  { label: 'Yellow', value: '#ffd654' },
  { label: 'Blue', value: '#8fd3ff' },
  { label: 'Green', value: '#a6e99f' },
  { label: 'Red', value: '#ffaaa5' },
  { label: 'Purple', value: '#d7b8ff' }
];

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
  const [translationMode, setTranslationMode] = useState<TranslationMode>(
    readerConfig.translationProvider === 'deepseek' ? 'deepseek' : 'local'
  );
  const [hasDeepSeekApiKey, setHasDeepSeekApiKey] = useState(false);
  const [translationProvider, setTranslationProvider] = useState(readerConfig.translationProvider || 'argos');
  const [dictionaryReady, setDictionaryReady] = useState(false);
  const [argosPythonFound, setArgosPythonFound] = useState(false);
  const [annotationQuery, setAnnotationQuery] = useState('');
  const [tagQuery, setTagQuery] = useState('');
  const [colorFilter, setColorFilter] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [sortMode, setSortMode] = useState('position');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageTotal, setPageTotal] = useState(0);
  const [zoom, setZoom] = useState<PdfScaleValue>('page-fit');
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
    window.clearTimeout(zoomCommitRef.current);
    setZoom(value);
    const viewer = highlighterRef.current?.getViewer();
    if (viewer) {
      viewer.currentScaleValue = value.toString();
    }
  }, []);

  const zoomByFactor = useCallback((factor: number, deferStateCommit = false) => {
    const viewer = highlighterRef.current?.getViewer();
    const baseScale = viewer?.currentScale || 1;
    const nextScale = clampZoom(baseScale * factor);
    if (viewer) {
      viewer.currentScale = nextScale;
    }
    if (!deferStateCommit) {
      window.clearTimeout(zoomCommitRef.current);
      setZoom(nextScale);
      return;
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
      window.clearTimeout(zoomCommitRef.current);
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
        setTranslationMode(message.payload.mode);
        setTranslationProvider(message.payload.provider);
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
    const query = annotationQuery.trim().toLowerCase();
    const tagNeedles = normalizeTags(tagQuery);
    return [...state.annotations]
      .filter(annotation => {
        const haystack = [
          annotation.selectedText,
          annotation.note,
          annotation.contextBefore,
          annotation.contextAfter,
          ...(annotation.tags || [])
        ].join(' ').toLowerCase();
        if (query && !haystack.includes(query)) {
          return false;
        }
        if (tagNeedles.length && !tagNeedles.every(tag => (annotation.tags || []).includes(tag))) {
          return false;
        }
        if (colorFilter && (annotation.color || '#ffd654') !== colorFilter) {
          return false;
        }
        if (kindFilter && (annotation.kind || 'highlight') !== kindFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => compareAnnotations(a, b, sortMode));
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

  function editAnnotation(annotation: AnnotationRecord, viewportPosition?: ViewportPosition) {
    const utils = highlighterRef.current;
    const viewer = utils?.getViewer();
    const storedPosition = annotation.highlighterPosition || rectsToHighlighterPosition(annotation.rects);
    const tipPosition = viewportPosition || (
      storedPosition && viewer
        ? scaledPositionToViewport(storedPosition, viewer)
        : undefined
    );
    if (!utils || !tipPosition) {
      setStatus('This annotation cannot be edited inline because its position is unavailable.');
      return;
    }
    setActiveId(annotation.id);
    focusAnnotation(annotation);
    utils.toggleEditInProgress(true);
    utils.setTip({
      position: tipPosition,
      content: (
        <InlineAnnotationEditor
          annotation={annotation}
          onCancel={closeInlineAnnotationEditor}
          onSave={patch => {
            vscode.postMessage({ type: 'updateAnnotation', payload: { id: annotation.id, patch } });
            setStatus('Annotation saved.');
            closeInlineAnnotationEditor();
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
      closeInlineAnnotationEditor();
    }
    setStatus('Annotation deleted. Use undo to restore it.');
  }

  function closeInlineAnnotationEditor() {
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
          <button title="Fit full page" onClick={() => applyZoom('page-fit')}>Fit</button>
          <button title="Fit page width" onClick={() => applyZoom('page-width')}>Width</button>
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
                  onDelete={deleteAnnotation}
                  onDocumentReady={handleDocumentReady}
                  onOpen={editAnnotation}
                  onPageChange={handleVisiblePageChange}
                  onPinchZoom={handlePinchZoom}
                  onSelection={handleSelection}
                  onStyleChange={handleStyleChange}
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
              <select value={sortMode} onChange={event => setSortMode(event.target.value)}>
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
              <label htmlFor="translationMode">Choose how selected text is translated</label>
              <select
                id="translationMode"
                value={translationMode}
                onChange={event => {
                  const mode = event.target.value as TranslationMode;
                  vscode.postMessage({ type: 'setTranslationMode', payload: { mode } });
                }}
              >
                <option value="local">Offline dictionary + local translation</option>
                <option value="deepseek">AI translation (DeepSeek V4 Flash)</option>
              </select>
              {translationMode === 'deepseek' ? (
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

function PdfDocumentView({
  activeId,
  highlights,
  pdfDocument,
  selectionTip,
  zoom,
  onDelete,
  onDocumentReady,
  onOpen,
  onPageChange,
  onPinchZoom,
  onSelection,
  onStyleChange,
  utilsRef
}: {
  activeId?: string;
  highlights: ReaderHighlight[];
  pdfDocument: { numPages: number };
  selectionTip?: React.ReactNode;
  zoom: PdfScaleValue;
  onDelete(annotation: AnnotationRecord): void;
  onDocumentReady(numPages: number): void;
  onOpen(annotation: AnnotationRecord, position?: ViewportPosition): void;
  onPageChange(page: number): void;
  onPinchZoom(deltaY: number): void;
  onSelection(selection: PdfSelection): void;
  onStyleChange(annotation: AnnotationRecord, color: string, kind: AnnotationKind): void;
  utilsRef(utils: PdfHighlighterUtils): void;
}) {
  const eventBusRef = useRef<PdfEventBus | null>(null);
  const viewerContainerRef = useRef<HTMLDivElement | null>(null);
  const pdfViewerRef = useRef<PdfViewerInstance | null>(null);
  const renderedHighlightScaleRef = useRef<number | undefined>(undefined);
  const highlightSyncFrameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    onDocumentReady(pdfDocument.numPages);
  }, [onDocumentReady, pdfDocument.numPages]);

  const handlePageChanging = useCallback((event: PdfPageChangingEvent) => {
    if (typeof event.pageNumber === 'number') {
      onPageChange(event.pageNumber);
    }
  }, [onPageChange]);

  const handleScaleChanging = useCallback((event: PdfScaleChangingEvent) => {
    const viewer = pdfViewerRef.current;
    const nextScale = event.scale;
    if (!viewer || typeof nextScale !== 'number') {
      return;
    }
    const renderedScale = renderedHighlightScaleRef.current || viewer.currentScale || nextScale;
    viewerContainerRef.current?.classList.add('pdf-scale-in-progress');
    for (const layer of getHighlightLayers(viewerContainerRef.current)) {
      const layerScale = Number(layer.dataset.renderedScale) || renderedScale;
      layer.style.transformOrigin = '0 0';
      layer.style.transform = `scale(${nextScale / layerScale})`;
    }
  }, []);

  const handleLayerRendered = useCallback((event: PdfLayerRenderedEvent) => {
    const viewer = pdfViewerRef.current;
    if (!viewer || typeof event.pageNumber !== 'number') {
      return;
    }
    if (!viewerContainerRef.current?.classList.contains('pdf-scale-in-progress')) {
      return;
    }
    window.cancelAnimationFrame(highlightSyncFrameRef.current || 0);
    highlightSyncFrameRef.current = window.requestAnimationFrame(() => {
      const pageView = viewer.getPageView(event.pageNumber! - 1);
      const pageElement = pageView?.div as HTMLElement | undefined;
      for (const layer of getHighlightLayers(pageElement || null)) {
        layer.style.transform = '';
        layer.style.transformOrigin = '';
        layer.dataset.renderedScale = String(viewer.currentScale);
      }
      renderedHighlightScaleRef.current = viewer.currentScale;
      viewerContainerRef.current?.classList.remove('pdf-scale-in-progress');
    });
  }, []);

  const handleWheel = useCallback((event: WheelEvent) => {
    if (!event.ctrlKey) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onPinchZoom(event.deltaY);
  }, [onPinchZoom]);

  const handlePointerDown = useCallback((event: PointerEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    const pageElement = target?.closest<HTMLElement>('.page');
    if (pageElement) {
      markPageSelectionRegions(pageElement);
    }
    viewerContainerRef.current?.classList.toggle(
      'allow-non-body-text-selection',
      !!target?.closest('.reader-margin-text, .reader-figure-text')
    );
  }, []);

  const captureUtils = useCallback((utils: PdfHighlighterUtils) => {
    const nextEventBus = utils.getEventBus() as PdfEventBus | null;
    if (eventBusRef.current !== nextEventBus) {
      eventBusRef.current?.off('pagechanging', handlePageChanging);
      eventBusRef.current?.off('scalechanging', handleScaleChanging);
      eventBusRef.current?.off('textlayerrendered', handleLayerRendered);
      eventBusRef.current?.off('pagerendered', handleLayerRendered);
      nextEventBus?.on('pagechanging', handlePageChanging);
      nextEventBus?.on('scalechanging', handleScaleChanging);
      nextEventBus?.on('textlayerrendered', handleLayerRendered);
      nextEventBus?.on('pagerendered', handleLayerRendered);
      eventBusRef.current = nextEventBus;
    }
    const nextViewer = utils.getViewer() as PdfViewerInstance | null;
    pdfViewerRef.current = nextViewer;
    const nextViewerContainer = nextViewer?.container || null;
    if (viewerContainerRef.current !== nextViewerContainer) {
      viewerContainerRef.current?.removeEventListener('wheel', handleWheel);
      viewerContainerRef.current?.removeEventListener('pointerdown', handlePointerDown, true);
      nextViewerContainer?.addEventListener('wheel', handleWheel, { passive: false });
      nextViewerContainer?.addEventListener('pointerdown', handlePointerDown, true);
      viewerContainerRef.current = nextViewerContainer;
      renderedHighlightScaleRef.current = nextViewer?.currentScale;
    }
    utilsRef(utils);
  }, [handlePageChanging, handlePointerDown, handleWheel, utilsRef]);

  useEffect(() => () => {
    eventBusRef.current?.off('pagechanging', handlePageChanging);
    eventBusRef.current?.off('scalechanging', handleScaleChanging);
    eventBusRef.current?.off('textlayerrendered', handleLayerRendered);
    eventBusRef.current?.off('pagerendered', handleLayerRendered);
    eventBusRef.current = null;
    viewerContainerRef.current?.removeEventListener('wheel', handleWheel);
    viewerContainerRef.current?.removeEventListener('pointerdown', handlePointerDown, true);
    viewerContainerRef.current = null;
    pdfViewerRef.current = null;
    window.cancelAnimationFrame(highlightSyncFrameRef.current || 0);
  }, [handleLayerRendered, handlePageChanging, handlePointerDown, handleScaleChanging, handleWheel]);

  return (
    <PdfHighlighter
      pdfDocument={pdfDocument as never}
      highlights={highlights}
      onSelection={onSelection}
      selectionTip={selectionTip}
      enableAreaSelection={event => event.altKey}
      pdfScaleValue={zoom}
      textSelectionColor="rgba(64, 141, 255, 0.28)"
      utilsRef={captureUtils}
      style={{ height: '100%' }}
    >
      <HighlightContainer
        activeId={activeId}
        onDelete={onDelete}
        onOpen={onOpen}
        onStyleChange={onStyleChange}
      />
    </PdfHighlighter>
  );
}

function HighlightContainer({
  activeId,
  onOpen,
  onStyleChange,
  onDelete
}: {
  activeId?: string;
  onOpen(annotation: AnnotationRecord, position?: ViewportPosition): void;
  onStyleChange(annotation: AnnotationRecord, color: string, kind: AnnotationKind): void;
  onDelete(annotation: AnnotationRecord): void;
}) {
  const { highlight, isScrolledTo, highlightBindings } = useHighlightContainerContext<ReaderHighlight>();
  const annotation = highlight.annotation;
  const activeClass = annotation?.id === activeId ? ' active-highlight' : '';

  if (!annotation) {
    if (highlight.type === 'area') {
      return (
        <AreaHighlight
          highlight={highlight}
          isScrolledTo={isScrolledTo}
          bounds={highlightBindings.textLayer}
          highlightColor="#ffd654"
        />
      );
    }

    return (
      <TextHighlight
        highlight={highlight}
        isScrolledTo={isScrolledTo}
        highlightColor="#ffd654"
        copyText={highlight.content?.text}
      />
    );
  }

  const hasTooltip = !!(annotation.note || annotation.tags?.length);
  const highlightTip: Tip | undefined = hasTooltip
    ? { position: highlight.position, content: <HighlightTooltip annotation={annotation} /> }
    : undefined;

  const areaHighlight = highlight.type === 'area' ? (
    <AreaHighlight
      highlight={highlight}
      isScrolledTo={isScrolledTo}
      bounds={highlightBindings.textLayer}
      highlightColor={annotation.color || '#ffd654'}
      onDelete={() => onDelete(annotation)}
    />
  ) : null;

  const textHighlight = highlight.type !== 'area' ? (
    <span className={activeClass}>
      <TextHighlight
        highlight={highlight}
        isScrolledTo={isScrolledTo}
        highlightColor={annotation.color || '#ffd654'}
        highlightStyle={(annotation.kind || 'highlight') === 'underline' ? 'underline' : 'highlight'}
        copyText={annotation.selectedText}
        onClick={() => onOpen(annotation, highlight.position)}
        onDelete={() => onDelete(annotation)}
        onStyleChange={style => {
          onStyleChange(
            annotation,
            style.highlightColor || annotation.color || '#ffd654',
            style.highlightStyle === 'underline' ? 'underline' : 'highlight'
          );
        }}
      />
    </span>
  ) : null;

  if (highlightTip) {
    return (
      <MonitoredHighlightContainer highlightTip={highlightTip}>
        {areaHighlight || textHighlight}
      </MonitoredHighlightContainer>
    );
  }

  return areaHighlight || textHighlight;
}

function AnnotationItem({
  annotation,
  active,
  onFocus,
  onEdit,
  onCopy,
  onDelete
}: {
  annotation: AnnotationRecord;
  active: boolean;
  onFocus(): void;
  onEdit(): void;
  onCopy(): void;
  onDelete(): void;
}) {
  return (
    <article className={`item annotation-item${active ? ' active-item' : ''}`} onClick={onFocus}>
      <strong>Page {annotation.page || annotation.highlighterPosition?.boundingRect.pageNumber || '-'}</strong>
      <p>{shorten(annotation.selectedText || annotation.note || 'Page note', 220)}</p>
      {annotation.note ? <p className="note">{shorten(annotation.note, 180)}</p> : null}
      {annotation.tags?.length ? <div className="annotation-tags">{annotation.tags.map(tag => <span key={tag}>#{tag}</span>)}</div> : null}
      <div className="annotation-actions">
        <button onClick={stopThen(onFocus)}>Jump</button>
        <button onClick={stopThen(onEdit)}>Edit</button>
        <button onClick={stopThen(onCopy)}>Copy MD</button>
        <button onClick={stopThen(onDelete)}>Delete</button>
      </div>
    </article>
  );
}

function AnnotationSummary({ annotations }: { annotations: AnnotationRecord[] }) {
  if (!annotations.length) {
    return null;
  }
  const highlights = annotations.filter(item => (item.kind || 'highlight') === 'highlight').length;
  const underlines = annotations.filter(item => item.kind === 'underline').length;
  const tagCount = new Map<string, number>();
  annotations.forEach(item => (item.tags || []).forEach(tag => tagCount.set(tag, (tagCount.get(tag) || 0) + 1)));
  const topTags = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  return (
    <div className="annotation-summary">
      <span>{highlights} highlights</span>
      <span>{underlines} underlines</span>
      {topTags.map(([tag, count]) => <span key={tag}>#{tag} {count}</span>)}
    </div>
  );
}

function WordItem({ word, onDelete }: { word: WordRecord; onDelete(): void }) {
  return (
    <article className="item">
      <strong>{word.word}</strong>
      {word.phonetic ? <span className="phonetic compact-phonetic">{word.phonetic}</span> : null}
      {word.translation ? <p>{word.translation}</p> : null}
      {word.definitions?.length ? (
        <ul className="word-definition-list">
          {word.definitions.slice(0, 4).map((definition, index) => (
            <li key={`${definition.pos}-${index}`}>
              {definition.pos ? <span className="pos">{definition.pos}</span> : null}
              <span>{definition.translation || definition.meaning}</span>
              {definition.translation && definition.meaning ? <small>{definition.meaning}</small> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {word.note ? <p className="note">{word.note}</p> : null}
      <div className="annotation-actions">
        <button className="danger-button" onClick={onDelete}>Delete</button>
      </div>
    </article>
  );
}

function annotationToHighlight(annotation: AnnotationRecord): ReaderHighlight | undefined {
  const position = annotation.highlighterPosition || rectsToHighlighterPosition(annotation.rects);
  if (!position) {
    return undefined;
  }
  return {
    id: annotation.id,
    type: annotation.selectedText ? 'text' : 'area',
    content: { text: annotation.selectedText || annotation.note },
    position,
    annotation
  };
}

function highlighterPositionToRects(position: ScaledPosition): AnnotationRect[] {
  const rects = position.rects.length ? position.rects : [position.boundingRect];
  return rects.map(rect => ({
    page: rect.pageNumber,
    x: safeRatio(rect.x1, rect.width),
    y: safeRatio(rect.y1, rect.height),
    width: safeRatio(rect.x2 - rect.x1, rect.width),
    height: safeRatio(rect.y2 - rect.y1, rect.height)
  }));
}

function markPageSelectionRegions(pageElement: HTMLElement) {
  const textLayer = pageElement.querySelector<HTMLElement>('.textLayer');
  if (!textLayer || textLayer.dataset.readerSelectionRegionsMarked === 'true') {
    return;
  }
  if (!textLayer.querySelector('.endOfContent')) {
    return;
  }
  const pageRect = pageElement.getBoundingClientRect();
  if (!pageRect.width || !pageRect.height) {
    return;
  }
  const topBoundary = pageRect.top + pageRect.height * PAGE_VERTICAL_MARGIN_SELECTION_RATIO;
  const bottomBoundary = pageRect.bottom - pageRect.height * PAGE_VERTICAL_MARGIN_SELECTION_RATIO;
  const leftBoundary = pageRect.left + pageRect.width * PAGE_HORIZONTAL_MARGIN_SELECTION_RATIO;
  const rightBoundary = pageRect.right - pageRect.width * PAGE_HORIZONTAL_MARGIN_SELECTION_RATIO;
  const textSpans = textLayer.querySelectorAll<HTMLElement>('span');
  if (!textSpans.length) {
    return;
  }

  for (const span of textSpans) {
    if (span.querySelector('span') || !span.textContent?.trim()) {
      continue;
    }
    const rect = span.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    span.classList.toggle(
      'reader-margin-text',
      rect.width > 0 &&
        rect.height > 0 &&
        (
          centerY < topBoundary ||
          centerY > bottomBoundary ||
          centerX < leftBoundary ||
          centerX > rightBoundary
      )
    );
  }
  const figureRegions = detectFigureRegions(pageElement, textSpans);
  for (const span of textSpans) {
    const rect = span.getBoundingClientRect();
    const centerY = safeRatio(rect.top + rect.height / 2 - pageRect.top, pageRect.height);
    span.classList.toggle(
      'reader-figure-text',
      figureRegions.some(region => centerY >= region.top && centerY <= region.bottom)
    );
  }
  pageElement.dataset.readerFigureRegions = JSON.stringify(figureRegions);
  textLayer.dataset.readerSelectionRegionsMarked = 'true';
}

function selectionStartsInNonBodyText(selection: Selection | null) {
  const anchorElement = nodeElement(selection?.anchorNode);
  return !!anchorElement?.closest('.reader-margin-text, .reader-figure-text');
}

function extractSelectedPdfText(selection: Selection | null, includeNonBodyText: boolean) {
  if (!selection || selection.isCollapsed || !selection.rangeCount) {
    return '';
  }
  const range = selection.getRangeAt(0);
  const selectionDocument = range.commonAncestorContainer.ownerDocument || window.document;
  const pieces: string[] = [];
  for (const pageElement of selectedPageElements(range)) {
    markPageSelectionRegions(pageElement);
    const textLayer = pageElement.querySelector('.textLayer');
    if (!textLayer) {
      continue;
    }
    const walker = selectionDocument.createTreeWalker(
      textLayer,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.textContent || !rangeIntersectsNode(range, node)) {
            return NodeFilter.FILTER_REJECT;
          }
          const element = nodeElement(node);
          if (
            !includeNonBodyText &&
            element?.closest('.reader-margin-text, .reader-figure-text')
          ) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    let node = walker.nextNode();
    while (node) {
      const text = selectedTextFromNode(range, node);
      if (text) {
        pieces.push(text);
      }
      node = walker.nextNode();
    }
  }
  return pieces.join(' ').replace(/\s+/g, ' ').trim();
}

function detectFigureRegions(
  pageElement: HTMLElement,
  textSpans: NodeListOf<HTMLElement>
): NormalizedPageRegion[] {
  const pageRect = pageElement.getBoundingClientRect();
  const lines = groupTextSpansIntoLines(textSpans, pageRect);
  const regions: NormalizedPageRegion[] = [];

  for (let captionIndex = 0; captionIndex < lines.length; captionIndex += 1) {
    const captionLine = lines[captionIndex];
    if (!FIGURE_CAPTION_PATTERN.test(captionLine.text)) {
      continue;
    }

    const linesAbove = lines.slice(0, captionIndex);
    const medianHeight = median(lines.map(line => line.height)) || 0.015;
    const minimumGap = Math.max(medianHeight * 2.5, 0.025);
    let regionTop = captionLine.top;

    for (let index = 1; index < linesAbove.length; index += 1) {
      const gap = linesAbove[index].top - linesAbove[index - 1].bottom;
      if (gap >= minimumGap) {
        regionTop = (linesAbove[index - 1].bottom + linesAbove[index].top) / 2;
        break;
      }
    }

    let regionBottom = captionLine.bottom;
    for (let index = captionIndex + 1; index < lines.length; index += 1) {
      const nextLine = lines[index];
      if (nextLine.top - regionBottom > medianHeight * 1.8) {
        break;
      }
      regionBottom = nextLine.bottom;
    }

    regions.push({
      top: Math.max(0, regionTop),
      bottom: Math.min(1, regionBottom)
    });
  }

  return regions;
}

function groupTextSpansIntoLines(
  textSpans: NodeListOf<HTMLElement>,
  pageRect: DOMRect
) {
  const items = Array.from(textSpans)
    .filter(
      span =>
        !span.querySelector('span') &&
        !span.classList.contains('reader-margin-text') &&
        !!span.textContent?.trim()
    )
    .map(span => {
      const rect = span.getBoundingClientRect();
      return {
        text: span.textContent!.trim(),
        left: safeRatio(rect.left - pageRect.left, pageRect.width),
        top: safeRatio(rect.top - pageRect.top, pageRect.height),
        bottom: safeRatio(rect.bottom - pageRect.top, pageRect.height),
        height: safeRatio(rect.height, pageRect.height)
      };
    })
    .filter(item => item.height > 0)
    .sort((left, right) => left.top - right.top || left.left - right.left);
  const lines: Array<{
    text: string;
    top: number;
    bottom: number;
    height: number;
    items: typeof items;
  }> = [];

  for (const item of items) {
    let line: typeof lines[number] | undefined;
    for (let index = lines.length - 1; index >= Math.max(0, lines.length - 8); index -= 1) {
      const candidate = lines[index];
      if (
        Math.abs((candidate.top + candidate.bottom) / 2 - (item.top + item.bottom) / 2) <
        Math.max(candidate.height, item.height) * 0.65
      ) {
        line = candidate;
        break;
      }
    }
    if (line) {
      line.items.push(item);
      line.top = Math.min(line.top, item.top);
      line.bottom = Math.max(line.bottom, item.bottom);
      line.height = Math.max(line.height, item.height);
      continue;
    }
    lines.push({
      text: '',
      top: item.top,
      bottom: item.bottom,
      height: item.height,
      items: [item]
    });
  }

  return lines
    .map(line => ({
      text: line.items
        .sort((left, right) => left.left - right.left)
        .map(item => item.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
      top: line.top,
      bottom: line.bottom,
      height: line.height
    }))
    .sort((left, right) => left.top - right.top);
}

function median(values: number[]) {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function selectedPageElements(range: Range) {
  const startPage = nodeElement(range.startContainer)?.closest<HTMLElement>('.page');
  const endPage = nodeElement(range.endContainer)?.closest<HTMLElement>('.page');
  if (!startPage && !endPage) {
    return [] as HTMLElement[];
  }
  if (!startPage || !endPage || startPage === endPage) {
    return [startPage || endPage!];
  }
  const viewer = startPage.closest('.PdfHighlighter');
  if (!viewer || viewer !== endPage.closest('.PdfHighlighter')) {
    return [startPage, endPage];
  }
  const pages = Array.from(viewer.querySelectorAll<HTMLElement>('.page'));
  const startIndex = pages.indexOf(startPage);
  const endIndex = pages.indexOf(endPage);
  if (startIndex < 0 || endIndex < 0) {
    return [startPage, endPage];
  }
  return pages.slice(Math.min(startIndex, endIndex), Math.max(startIndex, endIndex) + 1);
}

function rangeIntersectsNode(range: Range, node: Node) {
  try {
    return range.intersectsNode(node);
  } catch {
    return false;
  }
}

function selectedTextFromNode(range: Range, node: Node) {
  const value = node.textContent || '';
  let start = 0;
  let end = value.length;
  if (range.startContainer === node) {
    start = range.startOffset;
  }
  if (range.endContainer === node) {
    end = range.endOffset;
  }
  return value.slice(start, end);
}

function nodeElement(node: Node | null | undefined): Element | null {
  if (!node) {
    return null;
  }
  return node instanceof Element ? node : node.parentElement;
}

function filterNonBodyRects(position: ScaledPosition): ScaledPosition {
  const filteredRects = position.rects.filter(
    rect => !isPageMarginRect(rect) && !isFigureRect(rect)
  );
  if (!filteredRects.length) {
    return position;
  }
  const firstPage = Math.min(...filteredRects.map(rect => rect.pageNumber));
  const firstPageRects = filteredRects.filter(rect => rect.pageNumber === firstPage);
  return {
    ...position,
    boundingRect: {
      x1: Math.min(...firstPageRects.map(rect => rect.x1)),
      y1: Math.min(...firstPageRects.map(rect => rect.y1)),
      x2: Math.max(...firstPageRects.map(rect => rect.x2)),
      y2: Math.max(...firstPageRects.map(rect => rect.y2)),
      width: firstPageRects[0].width,
      height: firstPageRects[0].height,
      pageNumber: firstPage
    },
    rects: filteredRects
  };
}

function isPageMarginRect(rect: ScaledPosition['rects'][number]) {
  const centerX = safeRatio(rect.x1 + rect.x2, rect.width * 2);
  const centerY = safeRatio(rect.y1 + rect.y2, rect.height * 2);
  return (
    centerY < PAGE_VERTICAL_MARGIN_SELECTION_RATIO ||
    centerY > 1 - PAGE_VERTICAL_MARGIN_SELECTION_RATIO ||
    centerX < PAGE_HORIZONTAL_MARGIN_SELECTION_RATIO ||
    centerX > 1 - PAGE_HORIZONTAL_MARGIN_SELECTION_RATIO
  );
}

function isFigureRect(rect: ScaledPosition['rects'][number]) {
  const pageElement = document.querySelector<HTMLElement>(
    `.PdfHighlighter .page[data-page-number="${rect.pageNumber}"]`
  );
  if (!pageElement?.dataset.readerFigureRegions) {
    return false;
  }
  let regions: NormalizedPageRegion[];
  try {
    regions = JSON.parse(pageElement.dataset.readerFigureRegions) as NormalizedPageRegion[];
  } catch {
    return false;
  }
  const centerY = safeRatio(rect.y1 + rect.y2, rect.height * 2);
  return regions.some(region => centerY >= region.top && centerY <= region.bottom);
}

function rectsToHighlighterPosition(rects?: AnnotationRect[]): ScaledPosition | undefined {
  if (!rects?.length) {
    return undefined;
  }
  const scaledRects = rects.map(rect => ({
    x1: rect.x,
    y1: rect.y,
    x2: rect.x + rect.width,
    y2: rect.y + rect.height,
    width: 1,
    height: 1,
    pageNumber: rect.page
  }));
  const firstPage = scaledRects[0].pageNumber;
  const samePageRects = scaledRects.filter(rect => rect.pageNumber === firstPage);
  return {
    boundingRect: {
      x1: Math.min(...samePageRects.map(rect => rect.x1)),
      y1: Math.min(...samePageRects.map(rect => rect.y1)),
      x2: Math.max(...samePageRects.map(rect => rect.x2)),
      y2: Math.max(...samePageRects.map(rect => rect.y2)),
      width: 1,
      height: 1,
      pageNumber: firstPage
    },
    rects: samePageRects
  };
}

function compareAnnotations(a: AnnotationRecord, b: AnnotationRecord, mode: string) {
  if (mode === 'created') {
    return dateValue(b.createdAt) - dateValue(a.createdAt);
  }
  if (mode === 'updated') {
    return dateValue(b.updatedAt) - dateValue(a.updatedAt);
  }
  const aPos = annotationPosition(a);
  const bPos = annotationPosition(b);
  return aPos.page - bPos.page || aPos.y - bPos.y || aPos.x - bPos.x || dateValue(a.createdAt) - dateValue(b.createdAt);
}

function annotationPosition(annotation: AnnotationRecord) {
  const rect = annotation.rects?.[0];
  const highlighterRect = annotation.highlighterPosition?.boundingRect;
  return {
    page: rect?.page || highlighterRect?.pageNumber || annotation.page || Number.MAX_SAFE_INTEGER,
    y: rect?.y ?? (highlighterRect ? safeRatio(highlighterRect.y1, highlighterRect.height) : Number.MAX_SAFE_INTEGER),
    x: rect?.x ?? (highlighterRect ? safeRatio(highlighterRect.x1, highlighterRect.width) : Number.MAX_SAFE_INTEGER)
  };
}

function normalizeTags(value: string | string[]) {
  const raw = Array.isArray(value) ? value : value.split(/[,\s#]+/);
  return [...new Set(raw.map(tag => tag.trim().replace(/^#/, '').toLowerCase()).filter(Boolean))];
}

function doSaveAnnotation(
  saveState: { selectedText: string; selectionPosition?: ScaledPosition; currentPage: number },
  opts: { color: string; kind: AnnotationKind; note?: string }
) {
  const trimmedNote = opts.note?.trim() || '';
  const page = saveState.selectionPosition?.boundingRect.pageNumber || saveState.currentPage;
  const payload = {
    page,
    selectedText: saveState.selectedText,
    note: trimmedNote,
    tags: [] as string[],
    color: opts.color,
    kind: opts.kind,
    highlighterPosition: saveState.selectionPosition,
    rects: saveState.selectionPosition ? highlighterPositionToRects(saveState.selectionPosition) : undefined
  };
  if (!payload.selectedText.trim() || (opts.note !== undefined && !trimmedNote)) {
    return false;
  }
  vscode.postMessage({ type: 'saveAnnotation', payload });
  return true;
}

function InlineAnnotationEditor({
  annotation,
  onCancel,
  onSave
}: {
  annotation: AnnotationRecord;
  onCancel(): void;
  onSave(patch: {
    selectedText: string;
    note: string;
    tags: string[];
    color: string;
    kind: AnnotationKind;
  }): void;
}) {
  const [draftText, setDraftText] = useState(annotation.selectedText || '');
  const [draftNote, setDraftNote] = useState(annotation.note || '');
  const [draftTags, setDraftTags] = useState((annotation.tags || []).join(', '));
  const [draftColor, setDraftColor] = useState(annotation.color || '#ffd654');
  const [draftKind, setDraftKind] = useState<AnnotationKind>(annotation.kind || 'highlight');
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);
  const canSave = !!(draftText.trim() || draftNote.trim());

  useEffect(() => {
    noteInputRef.current?.focus();
  }, []);

  function save() {
    if (!canSave) {
      noteInputRef.current?.focus();
      return;
    }
    onSave({
      selectedText: draftText.trim(),
      note: draftNote.trim(),
      tags: normalizeTags(draftTags),
      color: draftColor,
      kind: draftKind
    });
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      save();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <div
      className="selection-toolbar annotation-inline-editor"
      onClick={event => event.stopPropagation()}
      onKeyDown={handleKeyDown}
      onMouseDown={event => event.stopPropagation()}
      onPointerDown={event => event.stopPropagation()}
    >
      <div className="annotation-inline-title">Edit annotation</div>
      <div className="selection-toolbar-row">
        {colorOptions.map(option => (
          <button
            key={option.value}
            className={`swatch${draftColor === option.value ? ' active' : ''}`}
            style={{ background: option.value }}
            title={option.label}
            onClick={() => setDraftColor(option.value)}
          />
        ))}
        <button
          className={draftKind === 'highlight' ? 'active-command' : ''}
          onClick={() => setDraftKind('highlight')}
        >
          HL
        </button>
        <button
          className={draftKind === 'underline' ? 'active-command' : ''}
          onClick={() => setDraftKind('underline')}
        >
          UL
        </button>
      </div>
      <label>
        Original text
        <textarea
          rows={2}
          value={draftText}
          onChange={event => setDraftText(event.target.value)}
          placeholder="Selected PDF text"
        />
      </label>
      <label>
        Note
        <textarea
          ref={noteInputRef}
          rows={3}
          value={draftNote}
          onChange={event => setDraftNote(event.target.value)}
          placeholder="Write a note..."
        />
      </label>
      <label>
        Tags
        <input
          value={draftTags}
          onChange={event => setDraftTags(event.target.value)}
          placeholder="method, question, todo"
        />
      </label>
      <div className="selection-note-actions">
        <button onClick={onCancel}>Cancel</button>
        <button onClick={save} disabled={!canSave}>Save</button>
      </div>
    </div>
  );
}

function SelectionToolbar() {
  const context = React.useContext(SelectionToolbarContext);
  if (!context) {
    return null;
  }
  const {
    selectedText,
    translationSourceText,
    translationText,
    wordDetails,
    onHighlight,
    onUnderline,
    onSaveNote,
    onTranslate,
    onSaveWord
  } = context;
  const [selColor, setSelColor] = useState('#ffd654');
  const [activeEditor, setActiveEditor] = useState<'note' | 'translation' | undefined>();
  const [noteText, setNoteText] = useState('');
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setActiveEditor(undefined);
    setNoteText('');
  }, [selectedText]);

  useEffect(() => {
    if (activeEditor === 'note') {
      noteInputRef.current?.focus();
    }
  }, [activeEditor]);

  function saveNote() {
    const trimmed = noteText.trim();
    if (!trimmed) {
      noteInputRef.current?.focus();
      return;
    }
    onSaveNote(trimmed, selColor);
    setNoteText('');
    setActiveEditor(undefined);
  }

  function translate() {
    setActiveEditor('translation');
    onTranslate();
  }

  const hasCurrentResult = translationSourceText === selectedText.trim();
  const isLoading = hasCurrentResult && translationText === 'Translating...';
  const currentWordDetails = hasCurrentResult ? wordDetails : undefined;
  const currentTranslation = hasCurrentResult ? translationText : '';

  return (
    <div
      className="selection-toolbar"
      onClick={event => event.stopPropagation()}
      onMouseDown={event => event.stopPropagation()}
      onPointerDown={event => event.stopPropagation()}
    >
      <div className="selection-toolbar-row">
        {colorOptions.map(c => (
          <button
            key={c.value}
            className={`swatch${selColor === c.value ? ' active' : ''}`}
            style={{ background: c.value }}
            title={c.label}
            onClick={() => setSelColor(c.value)}
          />
        ))}
        <button onClick={() => onHighlight(selColor)}>HL</button>
        <button onClick={() => onUnderline(selColor)}>UL</button>
        <button className={activeEditor === 'note' ? 'active-command' : ''} onClick={() => setActiveEditor(activeEditor === 'note' ? undefined : 'note')}>Note</button>
        <button className={activeEditor === 'translation' ? 'active-command' : ''} onClick={translate}>Translate</button>
      </div>
      {activeEditor === 'note' ? (
        <div className="selection-note-editor">
          <textarea
            ref={noteInputRef}
            value={noteText}
            onChange={event => setNoteText(event.target.value)}
            onKeyDown={event => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                saveNote();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                setActiveEditor(undefined);
              }
            }}
            placeholder="Write a note..."
            rows={3}
          />
          <div className="selection-note-actions">
            <button onClick={() => setActiveEditor(undefined)}>Cancel</button>
            <button onClick={saveNote} disabled={!noteText.trim()}>Save</button>
          </div>
        </div>
      ) : null}
      {activeEditor === 'translation' ? (
        <div className="selection-translation-result">
          {isLoading ? <div className="selection-result-status">Looking up...</div> : null}
          {!isLoading && currentWordDetails ? (
            <>
              <WordDetailsBlock details={currentWordDetails} />
              <div className="selection-note-actions">
                <button onClick={() => onSaveWord(currentWordDetails)}>Save to Wordbook</button>
                <button onClick={() => setActiveEditor(undefined)}>Close</button>
              </div>
            </>
          ) : null}
          {!isLoading && !currentWordDetails && currentTranslation ? (
            <>
              <p className="selection-translation-text">{currentTranslation}</p>
              <div className="selection-note-actions">
                <button onClick={() => setActiveEditor(undefined)}>Close</button>
              </div>
            </>
          ) : null}
          {!isLoading && !currentWordDetails && !currentTranslation ? (
            <div className="selection-result-status">No result yet.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function HighlightTooltip({ annotation }: { annotation: AnnotationRecord }) {
  if (!annotation.note && !annotation.tags?.length) return null;
  return (
    <div className="highlight-tooltip">
      {annotation.note ? <p>{annotation.note}</p> : null}
      {annotation.tags?.length ? (
        <div className="annotation-tags">
          {annotation.tags.map(tag => <span key={tag}>#{tag}</span>)}
        </div>
      ) : null}
    </div>
  );
}

function annotationStatus(shown: number, total: number) {
  if (!total) {
    return '0 annotations';
  }
  return shown === total ? `${total} annotation${total === 1 ? '' : 's'}` : `${shown} of ${total} annotations`;
}

function clampZoom(value: number) {
  return Math.min(Math.max(value, 0.5), 2.4);
}

function zoomLabel(value: PdfScaleValue) {
  if (typeof value === 'number') {
    return `${Math.round(value * 100)}%`;
  }
  if (value === 'page-fit') {
    return 'Fit';
  }
  if (value === 'page-width') {
    return 'Width';
  }
  if (value === 'page-actual') {
    return '100%';
  }
  return value;
}

function safeRatio(value: number, total: number) {
  return total ? value / total : 0;
}

function dateValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function shorten(value: string, max: number) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized;
}

function summarizeWordDetails(details: WordDetails) {
  const translations = details.definitions
    .map(definition => definition.translation || definition.meaning)
    .map(value => value.trim())
    .filter(Boolean);
  return [...new Set(translations)].slice(0, 4).join('; ');
}

function stopThen(callback: () => void) {
  return (event: React.MouseEvent) => {
    event.stopPropagation();
    callback();
  };
}

function WordDetailsBlock({ details }: { details: WordDetails }) {
  if (!details.definitions.length) return null;
  const uniqueDefs = details.definitions.filter(
    (d, i, arr) => arr.findIndex(x => x.pos === d.pos && x.meaning === d.meaning) === i
  );
  return (
    <div className="word-details">
      <h3>{details.word}</h3>
      {details.phonetic ? <span className="phonetic">{details.phonetic}</span> : null}
      <ul>
        {uniqueDefs.map((d, i) => (
          <li key={i}>
            {d.pos ? <span className="pos">{d.pos}</span> : null}
            <span>{d.translation || d.meaning}</span>
            {d.translation && d.meaning ? <small>{d.meaning}</small> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Bootstrap() {
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (isExpectedPdfCancellation(event.error || event.message)) {
        event.preventDefault();
        return;
      }
      setError(event.message || String(event.error || 'Unknown Webview error'));
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isExpectedPdfCancellation(event.reason)) {
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

function isExpectedPdfCancellation(reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason || '');
  return /worker was (?:terminated|destroyed)/i.test(message)
    || /loading aborted/i.test(message);
}

async function createPdfWorkerBlobUrl(resourceUrl: string) {
  const response = await fetch(resourceUrl);
  if (!response.ok) {
    throw new Error(`Worker resource request failed with HTTP ${response.status}.`);
  }
  const source = await response.arrayBuffer();
  return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
}

function getHighlightLayers(root: ParentNode | null) {
  if (!root) {
    return [] as HTMLElement[];
  }
  return Array.from(root.querySelectorAll<HTMLElement>(
    '.PdfHighlighter__highlight-layer, .PdfHighlighter__note-layer, .PdfHighlighter__config-layer'
  ));
}

createRoot(document.getElementById('root')!).render(<Bootstrap />);
