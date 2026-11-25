import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  PdfLoader,
  scaledPositionToViewport,
  type PdfHighlighterUtils,
  type PdfScaleValue,
  type PdfSelection,
  type ViewportPosition
} from 'react-pdf-highlighter-plus';
import 'pdfjs-dist/web/pdf_viewer.css';
import 'react-pdf-highlighter-plus/style/style.css';
import './styles.css';
import { createTranslator, resolveLocale } from '../../src/i18n';
import { I18nContext } from './i18nContext';
import {
  colorOptions,
  InlineAnnotationActions,
  InlineAnnotationEditor,
  SelectionToolbar,
  SelectionToolbarContext,
  type SelectionToolbarContextValue
} from './components/AnnotationWidgets';
import {
  IconArea,
  IconChevronLeft,
  IconChevronRight,
  IconFitWidth,
  IconListTree,
  IconMinus,
  IconMoon,
  IconPanelRight,
  IconPlus,
  IconSearch,
  IconSettings,
  IconSun,
  IconWarmPaper
} from './components/Icons';
import { OutlinePanel } from './components/OutlinePanel';
import { PdfDocumentView } from './components/PdfDocumentView';
import { SearchBar } from './components/SearchBar';
import {
  annotationToHighlight,
  buildAnnotationPayload,
  coalesceTextHighlightPosition,
  collectFrequentTags,
  filterAnnotations,
  formatAiSelectionCitation,
  rectsToHighlighterPosition,
  summarizeWordDetails,
  type AnnotationSortMode,
  type ReaderHighlight,
  type SelectionDraft
} from './annotationModel';
import type { IncomingMessage, WorkspaceTab } from './messages';
import { extractPdfOutline, type PdfOutlineDocument, type PdfOutlineNode } from './pdfOutline';
import { PdfTextSearchCache, type PdfSearchMatch, type SearchablePdfDocument } from './pdfSearch';
import {
  extractSelectedPdfText,
  extractSelectionContext,
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

type PaperAppearance = 'original' | 'sepia' | 'dark';

interface PersistedUiState {
  panelWidth?: number;
  appearance?: PaperAppearance;
}

const DEFAULT_PANEL_WIDTH = 340;
const MIN_PANEL_WIDTH = 276;
const MAX_PANEL_WIDTH = 560;
const MAX_UNDO_STACK = 20;

const defaultState: ReaderStatePayload = {
  progress: { updatedAt: new Date(0).toISOString() },
  paperName: readerConfig.paperName
};

function readPersistedUiState(): PersistedUiState {
  try {
    const raw = vscode.getState();
    if (raw && typeof raw === 'object') {
      return raw as PersistedUiState;
    }
  } catch {
    // Ignore storage read issues.
  }
  return {};
}

function writePersistedUiState(patch: PersistedUiState) {
  try {
    vscode.setState({ ...readPersistedUiState(), ...patch });
  } catch {
    // Ignore storage write issues.
  }
}

function App() {
  const isMac = useMemo(
    () => typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent),
    []
  );
  const locale = useMemo(() => resolveLocale(readerConfig.locale), []);
  const t = useMemo(() => createTranslator(locale), [locale]);
  const i18nValue = useMemo(() => ({ locale, t }), [locale, t]);

  const initialUi = useMemo(() => readPersistedUiState(), []);
  const [panelWidth, setPanelWidth] = useState<number>(() => clampPanelWidth(initialUi.panelWidth ?? DEFAULT_PANEL_WIDTH));
  const [appearance, setAppearance] = useState<PaperAppearance>(() => (
    initialUi.appearance === 'sepia' || initialUi.appearance === 'dark' ? initialUi.appearance : 'original'
  ));
  const [syncAiContext, setSyncAiContext] = useState<boolean>(readerConfig.syncAiContext ?? true);

  const [state, setState] = useState<ReaderStatePayload>(defaultState);
  const annotationsCapability = useAnnotationsCapability();
  const wordbookCapability = useWordbookCapability();
  const translationCapability = useTranslationCapability();
  const [selectedText, setSelectedText] = useState('');
  const [isAreaSelection, setIsAreaSelection] = useState(false);
  const [areaSelectMode, setAreaSelectMode] = useState(false);
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
  const [status, setStatus] = useState(() => t('statusLoadingPdf'));
  const [activeId, setActiveId] = useState<string | undefined>();
  const [locatedAnnotation, setLocatedAnnotation] = useState<{ id: string }>();
  useEffect(() => {
    if (!locatedAnnotation) return;
    const timer = window.setTimeout(() => setLocatedAnnotation(undefined), 1200);
    return () => window.clearTimeout(timer);
  }, [locatedAnnotation]);
  const [deletedStack, setDeletedStack] = useState<AnnotationRecord[]>([]);
  const [pdfUrl, setPdfUrl] = useState(readerConfig.pdfUrl);
  const [pdfWorkerSrc, setPdfWorkerSrc] = useState<string | undefined>();
  const [pdfWorkerError, setPdfWorkerError] = useState<string | undefined>();
  const [paperName, setPaperName] = useState(readerConfig.paperName);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>('overview');
  const [surface, setSurface] = useState<ReaderSurface>('closed');

  const [outlineItems, setOutlineItems] = useState<PdfOutlineNode[]>([]);
  const [outlineLoading, setOutlineLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<PdfSearchMatch[]>([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const [searching, setSearching] = useState(false);

  const highlighterRef = useRef<PdfHighlighterUtils | null>(null);
  const pdfDocRef = useRef<(SearchablePdfDocument & PdfOutlineDocument) | null>(null);
  const searchCacheRef = useRef(new PdfTextSearchCache());
  const progressDebounceRef = useRef<number | undefined>(undefined);
  const pendingProgressRef = useRef<number | undefined>(undefined);
  const contextSyncDebounceRef = useRef<number | undefined>(undefined);
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
  const pageTotalRef = useRef(0);
  const currentPageRef = useRef(1);
  const syncAiContextRef = useRef(syncAiContext);
  const paperNameRef = useRef(paperName);
  const selectionRef = useRef<SelectionDraft>({
    selectedText: '',
    selectionPosition: undefined,
    currentPage: 1
  });

  pageTotalRef.current = pageTotal;
  currentPageRef.current = currentPage;
  syncAiContextRef.current = syncAiContext;
  paperNameRef.current = paperName;

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

  const scheduleAiContextSync = useCallback((page: number, draft?: SelectionDraft) => {
    if (!syncAiContextRef.current) return;
    window.clearTimeout(contextSyncDebounceRef.current);
    contextSyncDebounceRef.current = window.setTimeout(() => {
      vscode.postMessage({
        type: 'syncReadingContext',
        payload: {
          page,
          pageTotal: pageTotalRef.current,
          selectedText: draft?.selectedText || '',
          contextBefore: draft?.contextBefore || '',
          contextAfter: draft?.contextAfter || ''
        }
      });
    }, 450);
  }, []);

  const saveReadingProgress = useCallback((page: number) => {
    pendingProgressRef.current = page;
    window.clearTimeout(progressDebounceRef.current);
    progressDebounceRef.current = window.setTimeout(() => {
      vscode.postMessage({ type: 'saveProgress', payload: { page } });
      pendingProgressRef.current = undefined;
    }, 350);
    scheduleAiContextSync(page, selectionRef.current);
  }, [scheduleAiContextSync]);

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
      zoomLabelRef.current.textContent = zoomLabel(nextScale, t('fitShort'));
    }
    window.clearTimeout(zoomCommitRef.current);
    zoomCommitRef.current = window.setTimeout(() => {
      setZoom(nextScale);
    }, 140);
  }, [t]);

  const handlePinchZoom = useCallback((deltaY: number) => {
    const exponent = Math.min(Math.max(-deltaY * 0.01, -0.25), 0.25);
    zoomByFactor(Math.exp(exponent), true);
  }, [zoomByFactor]);

  const cycleAppearance = useCallback(() => {
    setAppearance(current => {
      const next: PaperAppearance = current === 'original' ? 'sepia' : current === 'sepia' ? 'dark' : 'original';
      writePersistedUiState({ appearance: next });
      return next;
    });
  }, []);

  const handleStartPanelResize = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = panelWidth;
    document.body.classList.add('panel-resizing');

    const handleMove = (moveEvent: PointerEvent) => {
      const next = clampPanelWidth(startWidth + (startX - moveEvent.clientX));
      setPanelWidth(next);
    };
    const handleUp = (upEvent: PointerEvent) => {
      document.body.classList.remove('panel-resizing');
      const finalWidth = clampPanelWidth(startWidth + (startX - upEvent.clientX));
      setPanelWidth(finalWidth);
      writePersistedUiState({ panelWidth: finalWidth });
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [panelWidth]);

  useEffect(() => {
    document.body.classList.add('reader-mounted');
    return () => {
      flushReadingProgress();
      window.clearTimeout(contextSyncDebounceRef.current);
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

  const handleDocumentReady = useCallback((numPages: number) => {
    setPageTotal(numPages);
    if (!documentReadyRef.current) {
      documentReadyRef.current = true;
      setStatus(t('statusPdfLoaded'));
    }
  }, [t]);

  const handlePdfDocumentReady = useCallback((doc: unknown) => {
    const typed = doc as (SearchablePdfDocument & PdfOutlineDocument) | null;
    if (!typed || pdfDocRef.current === typed) {
      return;
    }
    pdfDocRef.current = typed;
    searchCacheRef.current.clear();
    setOutlineLoading(true);
    extractPdfOutline(typed).then(items => {
      if (pdfDocRef.current === typed) {
        setOutlineItems(items);
        setOutlineLoading(false);
      }
    }).catch(() => {
      if (pdfDocRef.current === typed) {
        setOutlineItems([]);
        setOutlineLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!searchOpen) {
      setSearchMatches([]);
      setSearchIndex(0);
      setSearching(false);
      return;
    }
    const query = searchQuery.trim();
    const doc = pdfDocRef.current;
    if (!query || !doc) {
      setSearchMatches([]);
      setSearchIndex(0);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      searchCacheRef.current.search(doc, query, () => cancelled).then(matches => {
        if (cancelled) return;
        setSearchMatches(matches);
        setSearchIndex(0);
        setSearching(false);
        if (matches.length > 0) {
          goToPage(matches[0].pageNumber, false);
        }
      }).catch(() => {
        if (!cancelled) setSearching(false);
      });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchOpen, searchQuery]);

  const activeSearchMatch = useMemo(() => {
    if (!searchOpen || !searchQuery.trim() || !searchMatches.length) {
      return undefined;
    }
    const bounded = ((searchIndex % searchMatches.length) + searchMatches.length) % searchMatches.length;
    return searchMatches[bounded];
  }, [searchIndex, searchMatches, searchOpen, searchQuery]);

  const stepSearchMatch = useCallback((delta: number) => {
    if (!searchMatches.length) return;
    const next = ((searchIndex + delta) % searchMatches.length + searchMatches.length) % searchMatches.length;
    setSearchIndex(next);
    goToPage(searchMatches[next].pageNumber, false);
  }, [searchIndex, searchMatches]);

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
      if (message.type === 'readerPreferences') {
        setSyncAiContext(message.payload.syncAiContext);
      }
      if (message.type === 'navigateTo') {
        flushReadingProgress();
        translationCapability.clearResult();
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
        setStatus(t('statusLoadingPdf'));
        documentReadyRef.current = false;
        pdfDocRef.current = null;
        searchCacheRef.current.clear();
        setOutlineItems([]);
        setSearchOpen(false);
        setSearchQuery('');
        setSearchMatches([]);
        setAreaSelectMode(false);
        setDeletedStack([]);
        annotationsCapability.reset();
        wordbookCapability.reset();
        clearAnnotationDraft();
      }
      if (message.type === 'stateError') {
        setStatus(message.payload.message);
      }
      if (message.type === 'capabilitySettings') {
        setCapabilityDescriptors(message.payload.capabilities);
        if (!capabilityEnabled(message.payload.capabilities, 'translation')) translationCapability.clearResult();
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
        setStatus(message.payload.error || message.payload.message || t('statusDone'));
      }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [
    annotationsCapability.handleEvent,
    annotationsCapability.reset,
    flushReadingProgress,
    t,
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

  const frequentTags = useMemo(
    () => collectFrequentTags(annotationsCapability.annotations, 6),
    [annotationsCapability.annotations]
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
      activeWorkspaceTab !== 'contents' &&
      !visiblePanels.some(panel => panel.id === activeWorkspaceTab)
    ) {
      setActiveWorkspaceTab('overview');
    }
  }, [activeWorkspaceTab, visiblePanels]);

  useEffect(() => {
    if (!capabilityEnabled(capabilityDescriptors, 'annotations')) {
      setAreaSelectMode(false);
      closeAnnotationTip();
      highlighterRef.current?.removeGhostHighlight();
    }
  }, [capabilityDescriptors]);

  function handleSelection(selection: PdfSelection) {
    const ghost = selection.makeGhostHighlight();
    const isArea = ghost.type === 'area';
    if (isArea) {
      setSelectedText('');
      setIsAreaSelection(true);
      const page = ghost.position.boundingRect.pageNumber;
      setCurrentPage(page);
      translationCapability.clearResult();
      const draft: SelectionDraft = {
        selectedText: '',
        selectionPosition: ghost.position,
        currentPage: page,
        isArea: true
      };
      selectionRef.current = draft;
      setStatus(t('statusSelectionCaptured'));
      return;
    }

    const nativeSelection = window.getSelection();
    if (nativeSelection?.rangeCount) {
      selectedPageElements(nativeSelection.getRangeAt(0)).forEach(markPageSelectionRegions);
    }
    const startsInNonBodyText = selectionStartsInNonBodyText(nativeSelection);
    const cleanText = extractSelectedPdfText(nativeSelection, startsInNonBodyText);
    const filteredPosition = startsInNonBodyText
      ? ghost.position
      : filterNonBodyRects(ghost.position);
    const cleanPosition = coalesceTextHighlightPosition(filteredPosition);
    const text = cleanText || ghost.content.text || '';
    const extracted = extractSelectionContext(nativeSelection, startsInNonBodyText, text);
    ghost.content.text = text;
    ghost.position = cleanPosition;
    setSelectedText(text);
    setIsAreaSelection(false);
    setCurrentPage(cleanPosition.boundingRect.pageNumber);
    translationCapability.clearResult();
    const draft: SelectionDraft = {
      selectedText: text,
      selectionPosition: cleanPosition,
      currentPage: cleanPosition.boundingRect.pageNumber,
      contextBefore: extracted.contextBefore,
      contextAfter: extracted.contextAfter,
      sentence: extracted.sentence,
      isArea: false
    };
    selectionRef.current = draft;
    scheduleAiContextSync(cleanPosition.boundingRect.pageNumber, draft);
    setStatus(t('statusSelectionCaptured'));
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
      setStatus(t('statusPositionUnavailable'));
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
          frequentTags={frequentTags}
          onCancel={closeAnnotationTip}
          onSave={patch => {
            postCapabilityRequest('annotations', 'update', { id: annotation.id, patch });
            setStatus(t('statusAnnotationSaved'));
            closeAnnotationTip();
          }}
        />
      )
    });
    window.requestAnimationFrame(() => utils.updateTipPosition());
  }

  function deleteAnnotation(annotation: AnnotationRecord) {
    setDeletedStack(stack => [annotation, ...stack].slice(0, MAX_UNDO_STACK));
    postCapabilityRequest('annotations', 'delete', { id: annotation.id });
    if (activeId === annotation.id) {
      closeAnnotationTip();
    }
    setStatus(t('statusAnnotationDeleted'));
  }

  function closeAnnotationTip() {
    const utils = highlighterRef.current;
    utils?.setTip(null);
    utils?.toggleEditInProgress(false);
    setActiveId(undefined);
  }

  const restoreLastDeleted = useCallback(() => {
    setDeletedStack(stack => {
      const [latest, ...rest] = stack;
      if (!latest) return stack;
      postCapabilityRequest('annotations', 'restore', latest);
      setStatus(t('statusAnnotationRestored'));
      return rest;
    });
  }, [t]);

  function clearAnnotationDraft() {
    setLocatedAnnotation(undefined);
    setSelectedText('');
    setIsAreaSelection(false);
    setActiveId(undefined);
    selectionRef.current = { selectedText: '', selectionPosition: undefined, currentPage: 1 };
  }

  const dismissInlineContext = useCallback(() => {
    const utils = highlighterRef.current;
    utils?.setTip(null);
    utils?.removeGhostHighlight();
    utils?.toggleEditInProgress(false);
    clearAnnotationDraft();
    translationCapability.clearResult();
  }, [translationCapability.clearResult]);

  useEffect(() => {
    function handleOutsidePointerDown(event: PointerEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || target.closest('.PdfHighlighter__tip-container, .selection-toolbar, .pdf-search-bar')) {
        return;
      }
      dismissInlineContext();
    }

    document.addEventListener('pointerdown', handleOutsidePointerDown, true);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
  }, [dismissInlineContext]);

  const quickHighlight = useCallback((color: string) => {
    const s = selectionRef.current;
    if (!doSaveAnnotation(s, { color, kind: 'highlight' })) {
      setStatus(t('statusSelectBeforeHighlight'));
      return;
    }
    clearAnnotationDraft();
    setAreaSelectMode(false);
    highlighterRef.current?.removeGhostHighlight();
    highlighterRef.current?.setTip(null);
    setStatus(t('statusAnnotationSaved'));
  }, [t]);

  const quickUnderline = useCallback((color: string) => {
    const s = selectionRef.current;
    if (!doSaveAnnotation(s, { color, kind: 'underline' })) {
      setStatus(t('statusSelectBeforeHighlight'));
      return;
    }
    clearAnnotationDraft();
    setAreaSelectMode(false);
    highlighterRef.current?.removeGhostHighlight();
    highlighterRef.current?.setTip(null);
    setStatus(t('statusAnnotationSaved'));
  }, [t]);

  const saveSelectionNote = useCallback((noteText: string, noteColor: string, tags?: string[]) => {
    const s = selectionRef.current;
    if (!s.selectedText.trim() && !s.isArea) {
      setStatus(t('statusSelectBeforeNote'));
      return;
    }
    if (!doSaveAnnotation(s, { color: noteColor, kind: 'highlight', note: noteText, tags })) {
      setStatus(t('statusAddNoteBeforeSave'));
      return;
    }
    clearAnnotationDraft();
    setAreaSelectMode(false);
    highlighterRef.current?.removeGhostHighlight();
    highlighterRef.current?.setTip(null);
    setStatus(t('statusNoteSaved'));
  }, [t]);

  const translateSelection = useCallback(() => {
    const s = selectionRef.current;
    const text = s.selectedText.trim();
    if (!text) {
      setStatus(t('statusSelectBeforeTranslate'));
      return;
    }
    setSelectedText(text);
    setCurrentPage(s.currentPage);
    translationCapability.start(text);
    if (visibleCapabilityPanels(capabilityDescriptors).some(item => item.id === 'translation')) {
      setActiveWorkspaceTab('translation');
    }
  }, [capabilityDescriptors, t, translationCapability.start]);

  const saveSelectionWord = useCallback((details: WordDetails) => {
    const s = selectionRef.current;
    const selected = s.selectedText.trim();
    if (!selected || details.word !== selected) {
      setStatus(t('statusSelectWordBeforeSave'));
      return;
    }
    postCapabilityRequest('wordbook', 'save', {
      word: details.word,
      translation: summarizeWordDetails(details),
      phonetic: details.phonetic,
      definitions: details.definitions,
      sentence: s.sentence?.trim() || selected,
      note: '',
      page: s.currentPage
    });
    highlighterRef.current?.removeGhostHighlight();
    if (visibleCapabilityPanels(capabilityDescriptors).some(item => item.id === 'wordbook')) {
      setActiveWorkspaceTab('wordbook');
    }
    setStatus(t('statusWordSaved'));
  }, [capabilityDescriptors, t]);

  const copySelectionForAi = useCallback(() => {
    const s = selectionRef.current;
    const text = s.selectedText.trim();
    if (!text) return;
    const formatted = formatAiSelectionCitation({
      paperName: paperNameRef.current || readerConfig.paperName,
      page: s.currentPage || currentPageRef.current,
      selectedText: text,
      contextBefore: s.contextBefore,
      contextAfter: s.contextAfter
    });
    vscode.postMessage({
      type: 'copySelection',
      payload: { text: formatted, message: t('statusCopiedForAi') }
    });
  }, [t]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      const activeElement = document.activeElement;
      const inEditable = activeElement instanceof HTMLElement
        && !!activeElement.closest('input, textarea, select, [contenteditable="true"]');

      if (mod && key === 'f') {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }

      if (mod && key === 'c' && !inEditable) {
        const text = selectionRef.current.selectedText.trim();
        if (!text) return;
        event.preventDefault();
        vscode.postMessage({ type: 'copySelection', payload: { text, message: t('statusCopiedSelection') } });
        return;
      }

      if (inEditable) {
        return;
      }

      if (mod && key === 'z' && !event.shiftKey) {
        if (deletedStack.length > 0) {
          event.preventDefault();
          restoreLastDeleted();
        }
        return;
      }

      if (mod && (event.key === '=' || event.key === '+')) {
        event.preventDefault();
        zoomByFactor(1.15);
        return;
      }
      if (mod && event.key === '-') {
        event.preventDefault();
        zoomByFactor(0.85);
        return;
      }
      if (mod && event.key === '0') {
        event.preventDefault();
        applyZoom('page-width');
        return;
      }

      if (event.key === 'Escape') {
        if (searchOpen) {
          event.preventDefault();
          setSearchOpen(false);
          return;
        }
        if (highlighterRef.current?.getTip() || selectionRef.current.selectedText) {
          event.preventDefault();
          dismissInlineContext();
          return;
        }
        if (areaSelectMode) {
          event.preventDefault();
          setAreaSelectMode(false);
          return;
        }
        if (surface !== 'closed') {
          event.preventDefault();
          closeSurface();
        }
        return;
      }

      if (!mod && !event.altKey && /^[1-5]$/.test(event.key)
        && (selectionRef.current.selectedText.trim() || selectionRef.current.isArea)
        && capabilityEnabled(capabilityDescriptorsRef.current, 'annotations')) {
        const color = colorOptions[Number(event.key) - 1]?.value;
        if (color) {
          event.preventDefault();
          quickHighlight(color);
        }
        return;
      }

      if (!mod && !event.altKey && !selectionRef.current.selectedText.trim()) {
        if (event.key === 'ArrowRight' || event.key === 'PageDown' || key === 'j') {
          event.preventDefault();
          goToPage(currentPageRef.current + 1);
        } else if (event.key === 'ArrowLeft' || event.key === 'PageUp' || key === 'k') {
          event.preventDefault();
          goToPage(currentPageRef.current - 1);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [
    applyZoom,
    areaSelectMode,
    deletedStack.length,
    dismissInlineContext,
    quickHighlight,
    restoreLastDeleted,
    searchOpen,
    surface,
    t,
    zoomByFactor
  ]);

  const selectionToolbarContextValue = useMemo<SelectionToolbarContextValue>(() => ({
    selectedText,
    isAreaSelection,
    translationSourceText: translationCapability.sourceText,
    translationText: translationCapability.output,
    wordDetails: translationCapability.wordDetails,
    frequentTags,
    annotationsEnabled: capabilityEnabled(capabilityDescriptors, 'annotations'),
    translationEnabled: capabilityEnabled(capabilityDescriptors, 'translation'),
    wordbookEnabled: capabilityEnabled(capabilityDescriptors, 'wordbook'),
    onHighlight: quickHighlight,
    onUnderline: quickUnderline,
    onSaveNote: saveSelectionNote,
    onTranslate: translateSelection,
    onSaveWord: saveSelectionWord,
    onCopyForAi: copySelectionForAi
  }), [
    capabilityDescriptors,
    copySelectionForAi,
    frequentTags,
    isAreaSelection,
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

  const appearanceTitle = appearance === 'sepia'
    ? t('paperSepia')
    : appearance === 'dark'
      ? t('paperDark')
      : t('paperOriginal');

  function openContentsTab() {
    setActiveWorkspaceTab('contents');
    setSurface('workspace');
  }

  /*
   * react-pdf-highlighter-plus stores the selectionTip React element at mouseup.
   * Context keeps that cached element connected to the latest selection/result.
   */
  const readerView = (
    <SelectionToolbarContext.Provider value={selectionToolbarContextValue}>
      <section className="reader">
        <div className="reader-toolbar">
          <div className="toolbar-group">
            <button
              className="icon-button"
              title={t('prevPage')}
              aria-label={t('prevPage')}
              disabled={currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
            >
              <IconChevronLeft size={15} />
            </button>
            <label className="page-jump">
              <input
                type="number"
                min={1}
                max={pageTotal || undefined}
                value={currentPage}
                aria-label={t('pageLabel')}
                onChange={event => setCurrentPage(Number(event.target.value) || 1)}
                onBlur={() => goToPage(currentPage)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    goToPage(currentPage);
                  }
                }}
              />
              <span className="page-total">/ {pageTotal || '-'}</span>
            </label>
            <button
              className="icon-button"
              title={t('nextPage')}
              aria-label={t('nextPage')}
              disabled={pageTotal > 0 && currentPage >= pageTotal}
              onClick={() => goToPage(currentPage + 1)}
            >
              <IconChevronRight size={15} />
            </button>
          </div>

          <span className="toolbar-divider" aria-hidden="true" />

          <div className="toolbar-group">
            <button
              className="icon-button"
              title={t('zoomOut')}
              aria-label={t('zoomOut')}
              onClick={() => zoomByFactor(0.85)}
            >
              <IconMinus size={14} />
            </button>
            <span ref={zoomLabelRef} className="zoom-value">{zoomLabel(zoom, t('fitShort'))}</span>
            <button
              className="icon-button"
              title={t('zoomIn')}
              aria-label={t('zoomIn')}
              onClick={() => zoomByFactor(1.15)}
            >
              <IconPlus size={14} />
            </button>
            <button
              className={`icon-button${zoom === 'page-width' ? ' active-tool' : ''}`}
              title={t('fitWidth')}
              aria-label={t('fitWidth')}
              onClick={() => applyZoom('page-width')}
            >
              <IconFitWidth size={15} />
            </button>
          </div>

          <span className="toolbar-divider" aria-hidden="true" />

          <div className="toolbar-group">
            <button
              className={`icon-button${searchOpen ? ' active-tool' : ''}`}
              title={`${t('findInPdf')} (${isMac ? '⌘F' : 'Ctrl+F'})`}
              aria-label={t('findInPdf')}
              aria-pressed={searchOpen}
              onClick={() => setSearchOpen(current => !current)}
            >
              <IconSearch size={14} />
            </button>
            {capabilityEnabled(capabilityDescriptors, 'annotations') ? (
              <button
                className={`icon-button${areaSelectMode ? ' active-tool' : ''}`}
                title={`${t('areaSelectTool')} (${isMac ? '⌥' : 'Alt'} + ${t('dragAction')})`}
                aria-label={t('areaSelectTool')}
                aria-pressed={areaSelectMode}
                onClick={() => setAreaSelectMode(current => !current)}
              >
                <IconArea size={15} />
              </button>
            ) : null}
            <button
              className={`icon-button${surface === 'workspace' && activeWorkspaceTab === 'contents' ? ' active-tool' : ''}`}
              title={t('openContents')}
              aria-label={t('openContents')}
              onClick={openContentsTab}
            >
              <IconListTree size={15} />
            </button>
            <button
              className={`icon-button${appearance !== 'original' ? ' active-tool' : ''}`}
              title={`${t('paperAppearance')}: ${appearanceTitle}`}
              aria-label={`${t('paperAppearance')}: ${appearanceTitle}`}
              onClick={cycleAppearance}
            >
              {appearance === 'sepia'
                ? <IconWarmPaper size={15} />
                : appearance === 'dark'
                  ? <IconMoon size={14} />
                  : <IconSun size={15} />}
            </button>
          </div>

          <span className="reader-status" title={status}>{status}</span>

          <div className="toolbar-group toolbar-right">
            <button
              className={`toolbar-label-button sidebar-toggle${surface === 'workspace' ? ' active-tool' : ''}`}
              title={surface === 'workspace' ? t('hidePanelTitle') : t('showPanelTitle')}
              aria-label={surface === 'workspace' ? t('hidePanelTitle') : t('showPanelTitle')}
              aria-expanded={surface === 'workspace'}
              aria-pressed={surface === 'workspace'}
              onClick={() => setSurface(current => current === 'workspace' ? 'closed' : 'workspace')}
            >
              <IconPanelRight size={15} />
              <span>{surface === 'workspace' ? t('hidePanel') : t('showPanel')}</span>
            </button>
            <button
              className={`toolbar-label-button settings-toggle${surface === 'settings' ? ' active-tool' : ''}`}
              title={t('openSettingsTitle')}
              aria-label={t('openSettingsTitle')}
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
              <IconSettings size={15} />
              <span>{t('settings')}</span>
            </button>
          </div>
        </div>

        <div className={`pdf-host paper-${appearance}${areaSelectMode ? ' area-select-mode' : ''}`}>
          <SearchBar
            open={searchOpen}
            query={searchQuery}
            searching={searching}
            matchCount={searchMatches.length}
            activeIndex={searchIndex}
            onQueryChange={setSearchQuery}
            onPrev={() => stepSearchMatch(-1)}
            onNext={() => stepSearchMatch(1)}
            onClose={() => setSearchOpen(false)}
          />
          {pdfWorkerError ? (
            <div className="loading error">{t('statusWorkerError')} {pdfWorkerError}</div>
          ) : pdfWorkerSrc ? (
            <PdfLoader
              key={pdfUrl}
              document={pdfDocumentSource}
              workerSrc={pdfWorkerSrc}
              beforeLoad={progress => (
                <div className="loading">
                  {t('statusLoadingPdf')} {progress.loaded ? `${Math.round(progress.loaded / 1024)} KB` : ''}
                </div>
              )}
              errorMessage={error => <div className="loading error">{t('statusPdfLoadError')} {error.message}</div>}
              onError={error => {
                if (!isExpectedPdfCancellation(error)) {
                  setStatus(`${t('statusPdfLoadError')} ${error.message}`);
                }
              }}
            >
              {pdfDocument => (
                <PdfDocumentView
                  activeId={activeId}
                  locatedId={locatedAnnotation?.id}
                  highlights={highlights}
                  pdfDocument={pdfDocument}
                  selectionTip={selectionTip}
                  zoom={zoom}
                  areaSelectMode={areaSelectMode}
                  searchQuery={searchOpen ? searchQuery : ''}
                  activeSearchMatch={activeSearchMatch}
                  onDocumentReady={handleDocumentReady}
                  onPdfDocumentReady={handlePdfDocumentReady}
                  onOpen={openAnnotationActions}
                  onPageChange={handleVisiblePageChange}
                  onPinchZoom={handlePinchZoom}
                  onSelection={handleSelection}
                  utilsRef={handleHighlighterUtils}
                />
              )}
            </PdfLoader>
          ) : (
            <div className="loading">{t('statusStartingWorker')}</div>
          )}
        </div>
      </section>
    </SelectionToolbarContext.Provider>
  );

  function focusAnnotation(annotation: AnnotationRecord) {
    setLocatedAnnotation({ id: annotation.id });
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

  function updateSyncAiContext(enabled: boolean) {
    setSyncAiContext(enabled);
    vscode.postMessage({ type: 'updateReaderPreference', payload: { key: 'syncAiContext', value: enabled } });
  }

  const workspacePanels: WorkspacePanelContribution[] = [
    {
      id: 'overview',
      title: t('tabOverview'),
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
    {
      id: 'contents',
      title: t('tabContents'),
      content: (
        <OutlinePanel
          items={outlineItems}
          loading={outlineLoading}
          currentPage={currentPage}
          onSelectPage={page => goToPage(page)}
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
        undoCount: deletedStack.length,
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
        onExportPdf: () => postCapabilityRequest('annotations', 'exportPdf'),
        onOrganizeNotes: () => postCapabilityRequest('annotations', 'organizeNotes')
      },
      wordbook: {
        words: wordbookCapability.words,
        onDelete: id => postCapabilityRequest('wordbook', 'delete', { id }),
        onUpdateNote: (id, note) => postCapabilityRequest('wordbook', 'update', { id, patch: { note } }),
        onJumpPage: page => goToPage(page),
        onExportMarkdown: () => postCapabilityRequest('wordbook', 'exportMarkdown'),
        onExportCsv: () => postCapabilityRequest('wordbook', 'exportCsv')
      },
      translation: {
        selectedText,
        output: translationCapability.output,
        wordDetails: translationCapability.wordDetails
      }
    }, t)
  ];

  const settingsView = (
    <SettingsView
      capabilities={capabilityDescriptors}
      translation={translationCapability.settings}
      syncAiContext={syncAiContext}
      onCapabilityChange={updateCapability}
      onMove={moveCapability}
      onTranslationSetting={updateTranslationSetting}
      onConfigureDeepSeek={() => postCapabilityRequest('translation', 'configureDeepSeek')}
      onConfigureOpenAi={() => postCapabilityRequest('translation', 'configureOpenAi')}
      onDiagnoseTranslation={() => postCapabilityRequest('translation', 'diagnose')}
      onSyncAiContextChange={updateSyncAiContext}
    />
  );

  return (
    <I18nContext.Provider value={i18nValue}>
      <main
        className={`shell${surface === 'closed' ? ' sidebar-hidden' : ''}`}
        style={{ '--side-panel-width': `${panelWidth}px` } as React.CSSProperties}
      >
        {readerView}
        <ReaderSideSurface
          surface={surface}
          title={paperName || state.paperName || readerConfig.paperName}
          activePanel={activeWorkspaceTab}
          panels={workspacePanels}
          settings={settingsView}
          onActivePanel={setActiveWorkspaceTab}
          onClose={closeSurface}
          onStartResize={handleStartPanelResize}
        />
      </main>
    </I18nContext.Provider>
  );
}

function doSaveAnnotation(
  saveState: SelectionDraft,
  opts: { color: string; kind: AnnotationKind; note?: string; tags?: string[] }
) {
  const payload = buildAnnotationPayload(saveState, opts);
  if (!payload) {
    return false;
  }
  postCapabilityRequest('annotations', 'save', payload);
  return true;
}

function clampZoom(value: number) {
  return Math.min(Math.max(value, 0.5), 3.0);
}

function clampPanelWidth(value: number) {
  return Math.min(Math.max(Math.round(value), MIN_PANEL_WIDTH), MAX_PANEL_WIDTH);
}

function zoomLabel(value: PdfScaleValue, fitText = 'Fit') {
  if (typeof value === 'number') {
    return `${Math.round(value * 100)}%`;
  }
  if (value === 'page-width') {
    return fitText;
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
