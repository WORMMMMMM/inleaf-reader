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
  InlineAnnotationActions,
  InlineAnnotationEditor,
  SelectionToolbar,
  SelectionToolbarContext,
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
import type { IncomingMessage, WorkspaceTab } from './messages';
import {
  extractSelectedPdfText,
  filterNonBodyRects,
  markPageSelectionRegions,
  selectedPageElements,
  selectionStartsInNonBodyText
} from './pdfSelection';
import { readerConfig, setActiveDocumentId, vscode } from './vscodeApi';
import type { AnnotationKind, AnnotationRecord, ReaderStatePayload, WordDetails } from './types';
import {
  resolveCapabilityDescriptors,
  type CapabilityDescriptor,
  type CapabilityId,
  type CapabilityPreference,
  type ReaderSurface
} from '../../src/capabilities/contracts';
import type { TranslationSettingKey, TranslationSettingValue } from '../../src/capabilities/translation/protocol';
import { useAnnotationsCapability } from './capabilities/annotations/useAnnotationsCapability';
import { useWordbookCapability } from './capabilities/wordbook/useWordbookCapability';
import { useTranslationCapability } from './capabilities/translation/useTranslationCapability';
import { OverviewPanel } from './capabilities/OverviewPanel';
import { SettingsView } from './capabilities/SettingsView';
import { ReaderSideSurface, type WorkspacePanelContribution } from './capabilities/ReaderSideSurface';
import {
  buildCapabilityPanelContributions,
  capabilityEnabled,
  routeCapabilityEvent,
  visibleCapabilityPanels
} from './capabilities/registry';

const defaultState: ReaderStatePayload = {
  progress: { updatedAt: new Date(0).toISOString() },
  paperName: readerConfig.paperName
};

function App() {
  const [state, setState] = useState<ReaderStatePayload>(defaultState);
  const annotationsCapability = useAnnotationsCapability();
  const wordbookCapability = useWordbookCapability();
  const translationCapability = useTranslationCapability();
  const [selectedText, setSelectedText] = useState('');
  const [capabilityDescriptors, setCapabilityDescriptors] = useState<CapabilityDescriptor[]>(
    () => resolveCapabilityDescriptors(undefined)
  );
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
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>('overview');
  const [surface, setSurface] = useState<ReaderSurface>('closed');
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
  const settingsReturnSurfaceRef = useRef<ReaderSurface>('closed');
  const capabilityDescriptorsRef = useRef(capabilityDescriptors);
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
    capabilityDescriptorsRef.current = capabilityDescriptors;
  }, [capabilityDescriptors]);

  useEffect(() => {
    vscode.postMessage({ type: 'ready' });
  }, []);

  useEffect(() => {
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
        annotationsCapability.reset();
        wordbookCapability.reset();
        translationCapability.clearResult();
        clearAnnotationDraft();
      }
      if (message.type === 'stateError') {
        setStatus(message.payload.message);
      }
      if (message.type === 'capabilitySettings') {
        setCapabilityDescriptors(message.payload.capabilities);
      }
      if (message.type === 'capabilityEvent') {
        if (message.event === 'error' && isMessagePayload(message.payload)) {
          setStatus(message.payload.message);
          return;
        }
        const outcome = routeCapabilityEvent(message, {
          annotations: annotationsCapability.handleEvent,
          wordbook: wordbookCapability.handleEvent,
          translation: (event, payload) => translationCapability.handleEvent(
            event,
            payload,
            selectionRef.current.selectedText.trim()
          )
        });
        if (outcome.status) {
          setStatus(outcome.status);
        }
        if (
          outcome.activatePanel &&
          capabilityEnabled(capabilityDescriptorsRef.current, outcome.activatePanel)
        ) {
          setActiveWorkspaceTab(outcome.activatePanel);
        }
      }
      if (message.type === 'clipboardResult') {
        setStatus(message.payload.error || message.payload.message || 'Done.');
      }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [
    annotationsCapability.handleEvent,
    annotationsCapability.reset,
    flushReadingProgress,
    translationCapability.clearResult,
    translationCapability.handleEvent,
    wordbookCapability.handleEvent,
    wordbookCapability.reset
  ]);

  useEffect(() => {
    if (!state.progress?.page || !pageTotal) {
      return;
    }
    const timer = window.setTimeout(() => goToPage(state.progress.page || 1, false), 250);
    return () => window.clearTimeout(timer);
  }, [pageTotal, state.progress?.page]);

  const highlights = useMemo(
    () => capabilityEnabled(capabilityDescriptors, 'annotations')
      ? annotationsCapability.annotations.map(annotationToHighlight).filter(Boolean) as ReaderHighlight[]
      : [],
    [annotationsCapability.annotations, capabilityDescriptors]
  );

  const filteredAnnotations = useMemo(() => {
    return filterAnnotations(annotationsCapability.annotations, {
      query: annotationQuery,
      tags: tagQuery,
      color: colorFilter,
      kind: kindFilter,
      sort: sortMode
    });
  }, [annotationQuery, annotationsCapability.annotations, colorFilter, kindFilter, sortMode, tagQuery]);

  const visiblePanels = useMemo(
    () => visibleCapabilityPanels(capabilityDescriptors),
    [capabilityDescriptors]
  );

  useEffect(() => {
    if (
      activeWorkspaceTab !== 'overview' &&
      !visiblePanels.some(panel => panel.id === activeWorkspaceTab)
    ) {
      setActiveWorkspaceTab('overview');
    }
  }, [activeWorkspaceTab, visiblePanels]);

  useEffect(() => {
    if (!capabilityEnabled(capabilityDescriptors, 'annotations')) {
      closeAnnotationTip();
      highlighterRef.current?.removeGhostHighlight();
    }
  }, [capabilityDescriptors]);

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
    translationCapability.clearResult();
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
            postCapabilityRequest('annotations', 'update', { id: annotation.id, patch });
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
    postCapabilityRequest('annotations', 'delete', { id: annotation.id });
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
    postCapabilityRequest('annotations', 'restore', lastDeleted);
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
    translationCapability.start(text);
    if (visibleCapabilityPanels(capabilityDescriptors).some(item => item.id === 'translation')) {
      setActiveWorkspaceTab('translation');
    }
    postCapabilityRequest('translation', 'translate', { text });
  }, [capabilityDescriptors, translationCapability.start]);

  const saveSelectionWord = useCallback((details: WordDetails) => {
    const s = selectionRef.current;
    const selected = s.selectedText.trim();
    if (!selected || details.word !== selected) {
      setStatus('Select a word before saving it.');
      return;
    }
    postCapabilityRequest('wordbook', 'save', {
        word: details.word,
        translation: summarizeWordDetails(details),
        phonetic: details.phonetic,
        definitions: details.definitions,
        sentence: selected,
        note: '',
        page: s.currentPage
    });
    highlighterRef.current?.removeGhostHighlight();
    if (visibleCapabilityPanels(capabilityDescriptors).some(item => item.id === 'wordbook')) {
      setActiveWorkspaceTab('wordbook');
    }
    setStatus('Word saved.');
  }, [capabilityDescriptors]);

  const selectionToolbarContextValue = useMemo<SelectionToolbarContextValue>(() => ({
    selectedText,
    translationSourceText: translationCapability.sourceText,
    translationText: translationCapability.output,
    wordDetails: translationCapability.wordDetails,
    annotationsEnabled: capabilityEnabled(capabilityDescriptors, 'annotations'),
    translationEnabled: capabilityEnabled(capabilityDescriptors, 'translation'),
    wordbookEnabled: capabilityEnabled(capabilityDescriptors, 'wordbook'),
    onHighlight: quickHighlight,
    onUnderline: quickUnderline,
    onSaveNote: saveSelectionNote,
    onTranslate: translateSelection,
    onSaveWord: saveSelectionWord
  }), [
    capabilityDescriptors,
    quickHighlight,
    quickUnderline,
    saveSelectionNote,
    saveSelectionWord,
    selectedText,
    translateSelection,
    translationCapability.output,
    translationCapability.sourceText,
    translationCapability.wordDetails
  ]);

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
            title={surface === 'workspace' ? 'Hide panel' : 'Show panel'}
            aria-label={surface === 'workspace' ? 'Hide panel' : 'Show panel'}
            aria-expanded={surface === 'workspace'}
            aria-pressed={surface === 'workspace'}
            onClick={() => setSurface(current => current === 'workspace' ? 'closed' : 'workspace')}
          >
            {surface === 'workspace' ? 'Hide panel' : 'Show panel'}
          </button>
          <button
            className="settings-toggle secondary-button"
            title="Open Inleaf Reader settings"
            aria-label="Open Inleaf Reader settings"
            aria-pressed={surface === 'settings'}
            onClick={() => {
              if (surface === 'settings') {
                setSurface(settingsReturnSurfaceRef.current);
                return;
              }
              settingsReturnSurfaceRef.current = surface === 'workspace' ? 'workspace' : 'closed';
              setSurface('settings');
            }}
          >
            ⚙ Settings
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

  function closeSurface() {
    if (surface === 'settings' && settingsReturnSurfaceRef.current === 'workspace') {
      setSurface('workspace');
      return;
    }
    setSurface('closed');
  }

  function updateCapability(capabilityId: CapabilityId, patch: CapabilityPreference) {
    vscode.postMessage({ type: 'updateCapabilityPreference', payload: { capabilityId, patch } });
  }

  function moveCapability(capabilityId: CapabilityId, direction: -1 | 1) {
    const index = capabilityDescriptors.findIndex(item => item.id === capabilityId);
    const neighbor = capabilityDescriptors[index + direction];
    if (!neighbor) {
      return;
    }
    updateCapability(capabilityId, { order: neighbor.order + direction });
  }

  function updateTranslationSetting(key: TranslationSettingKey, value: TranslationSettingValue) {
    postCapabilityRequest('translation', 'updateSetting', { key, value });
  }

  const workspacePanels: WorkspacePanelContribution[] = [
    {
      id: 'overview',
      title: 'Overview',
      content: (
        <OverviewPanel
          currentPage={currentPage}
          pageTotal={pageTotal}
          annotationCount={annotationsCapability.annotations.length}
          wordCount={wordbookCapability.words.length}
          status={status}
          selectedText={selectedText}
        />
      )
    },
    ...buildCapabilityPanelContributions(capabilityDescriptors, {
      annotations: {
        annotations: filteredAnnotations,
        total: annotationsCapability.annotations.length,
        activeId,
        query: annotationQuery,
        tagQuery,
        colorFilter,
        kindFilter,
        sortMode,
        canUndo: !!lastDeleted,
        onQuery: setAnnotationQuery,
        onTagQuery: setTagQuery,
        onColorFilter: setColorFilter,
        onKindFilter: setKindFilter,
        onSortMode: setSortMode,
        onFocus: focusAnnotation,
        onEdit: editAnnotation,
        onCopy: annotation => postCapabilityRequest('annotations', 'copyMarkdown', { id: annotation.id }),
        onDelete: deleteAnnotation,
        onUndo: restoreLastDeleted,
        onExportMarkdown: () => postCapabilityRequest('annotations', 'exportMarkdown'),
        onExportPdf: () => postCapabilityRequest('annotations', 'exportPdf')
      },
      wordbook: {
        words: wordbookCapability.words,
        onDelete: id => postCapabilityRequest('wordbook', 'delete', { id })
      },
      translation: {
        selectedText,
        output: translationCapability.output,
        wordDetails: translationCapability.wordDetails
      }
    })
  ];

  const settingsView = (
    <SettingsView
      capabilities={capabilityDescriptors}
      translation={translationCapability.settings}
      onCapabilityChange={updateCapability}
      onMove={moveCapability}
      onTranslationSetting={updateTranslationSetting}
      onConfigureDeepSeek={() => postCapabilityRequest('translation', 'configureDeepSeek')}
      onDiagnoseTranslation={() => postCapabilityRequest('translation', 'diagnose')}
    />
  );

  return (
    <main className={`shell${surface === 'closed' ? ' sidebar-hidden' : ''}`}>
      {readerView}
      <ReaderSideSurface
        surface={surface}
        title={paperName || state.paperName || readerConfig.paperName}
        activePanel={activeWorkspaceTab}
        panels={workspacePanels}
        settings={settingsView}
        onActivePanel={setActiveWorkspaceTab}
        onClose={closeSurface}
      />
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
  postCapabilityRequest('annotations', 'save', payload);
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

function postCapabilityRequest(capabilityId: CapabilityId, action: string, payload?: unknown) {
  vscode.postMessage({ type: 'capabilityRequest', capabilityId, action, payload });
}

function isMessagePayload(value: unknown): value is { message: string } {
  return typeof value === 'object' && value !== null && 'message' in value && typeof value.message === 'string';
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
