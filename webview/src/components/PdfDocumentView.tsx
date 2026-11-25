import React, { useCallback, useEffect, useRef } from 'react';
import {
  AreaHighlight,
  MonitoredHighlightContainer,
  PdfHighlighter,
  TextHighlight,
  scaledPositionToViewport,
  useHighlightContainerContext,
  type PdfHighlighterUtils,
  type PdfScaleValue,
  type PdfSelection,
  type Tip,
  type ViewportPosition
} from 'react-pdf-highlighter-plus';
import type { ReaderHighlight } from '../annotationModel';
import { computePageSearchRects } from '../pdfSearch';
import { markPageSelectionRegions } from '../pdfSelection';
import { trackSelectionShade } from '../selectionShade';
import type { AnnotationRecord } from '../types';

type PdfPageChangingEvent = { pageNumber?: number };
// Native and retained text selections share one overlay (selectionShade.ts).
const TEXT_SELECTION_COLOR = 'transparent';
type PdfScaleChangingEvent = { scale?: number };
type PdfLayerRenderedEvent = { pageNumber?: number };
type PdfEventMap = {
  pagechanging: PdfPageChangingEvent;
  scalechanging: PdfScaleChangingEvent;
  textlayerrendered: PdfLayerRenderedEvent;
  pagerendered: PdfLayerRenderedEvent;
};
type PdfEventBus = {
  on<EventName extends keyof PdfEventMap>(
    eventName: EventName,
    listener: (event: PdfEventMap[EventName]) => void
  ): void;
  off<EventName extends keyof PdfEventMap>(
    eventName: EventName,
    listener: (event: PdfEventMap[EventName]) => void
  ): void;
};
type PdfViewerInstance = {
  container: HTMLDivElement;
  currentPageNumber: number;
  currentScale: number;
  currentScaleValue: string;
  getPageView(index: number): { div?: HTMLElement } | undefined;
};

export function PdfDocumentView({
  activeId,
  locatedId,
  highlights,
  pdfDocument,
  selectionTip,
  zoom,
  areaSelectMode,
  searchQuery,
  activeSearchMatch,
  onDocumentReady,
  onPdfDocumentReady,
  onOpen,
  onPageChange,
  onPinchZoom,
  onSelection,
  utilsRef
}: {
  activeId?: string;
  locatedId?: string;
  highlights: ReaderHighlight[];
  pdfDocument: { numPages: number };
  selectionTip?: React.ReactNode;
  zoom: PdfScaleValue;
  areaSelectMode?: boolean;
  searchQuery?: string;
  activeSearchMatch?: { pageNumber: number; occurrenceOnPage: number };
  onDocumentReady(numPages: number): void;
  onPdfDocumentReady?(pdfDocument: unknown): void;
  onOpen(annotation: AnnotationRecord, position?: ViewportPosition): void;
  onPageChange(page: number): void;
  onPinchZoom(deltaY: number): void;
  onSelection(selection: PdfSelection): void;
  utilsRef(utils: PdfHighlighterUtils): void;
}) {
  const eventBusRef = useRef<PdfEventBus | null>(null);
  const viewerContainerRef = useRef<HTMLDivElement | null>(null);
  const pdfViewerRef = useRef<PdfViewerInstance | null>(null);
  const highlightSyncFrameRef = useRef<number | undefined>(undefined);
  const horizontalCenterFrameRef = useRef<number | undefined>(undefined);
  const pendingHighlightLayersRef = useRef(new Set<HTMLElement>());
  const renderedPagesRef = useRef(new Set<number>());
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const highlighterUtilsRef = useRef<PdfHighlighterUtils | null>(null);
  const searchStateRef = useRef({ query: searchQuery || '', activeMatch: activeSearchMatch });
  searchStateRef.current = { query: searchQuery || '', activeMatch: activeSearchMatch };

  const paintSearchHighlightsForPage = useCallback((pageElement: HTMLElement | null | undefined, pageNumber: number) => {
    if (!pageElement || typeof document === 'undefined' || !document.createElement) return;
    pageElement.querySelectorAll('.reader-search-layer').forEach(node => node.remove());
    const { query, activeMatch } = searchStateRef.current;
    if (!query.trim()) return;
    const activeOcc = activeMatch?.pageNumber === pageNumber ? activeMatch.occurrenceOnPage : undefined;
    const rects = computePageSearchRects(pageElement, query, activeOcc);
    if (!rects.length) return;
    const layer = document.createElement('div');
    layer.className = 'reader-search-layer';
    layer.setAttribute('aria-hidden', 'true');
    for (const rect of rects) {
      const mark = document.createElement('div');
      mark.className = rect.active ? 'reader-search-hit active' : 'reader-search-hit';
      mark.style.left = `${rect.left}px`;
      mark.style.top = `${rect.top}px`;
      mark.style.width = `${rect.width}px`;
      mark.style.height = `${rect.height}px`;
      layer.appendChild(mark);
    }
    pageElement.appendChild(layer);
  }, []);

  const repaintAllSearchHighlights = useCallback(() => {
    const container = viewerContainerRef.current;
    if (!container || typeof container.querySelectorAll !== 'function') return;
    const pageElements = container.querySelectorAll<HTMLElement>('.page[data-page-number]');
    for (const pageElement of pageElements) {
      const pageNumber = Number(pageElement.dataset?.pageNumber);
      if (Number.isFinite(pageNumber) && pageNumber > 0) {
        paintSearchHighlightsForPage(pageElement, pageNumber);
      }
    }
  }, [paintSearchHighlightsForPage]);

  useEffect(() => {
    onDocumentReady(pdfDocument.numPages);
    onPdfDocumentReady?.(pdfDocument);
  }, [onDocumentReady, onPdfDocumentReady, pdfDocument]);

  useEffect(() => trackSelectionShade(() => viewerContainerRef.current), [pdfDocument]);

  useEffect(() => {
    repaintAllSearchHighlights();
  }, [activeSearchMatch, repaintAllSearchHighlights, searchQuery]);

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
    window.cancelAnimationFrame(highlightSyncFrameRef.current || 0);
    highlightSyncFrameRef.current = undefined;
    renderedPagesRef.current.clear();
    const layers = getHighlightLayers(viewerContainerRef.current);
    pendingHighlightLayersRef.current = new Set(layers);
    viewerContainerRef.current?.classList.toggle('pdf-scale-in-progress', layers.length > 0);
    for (const layer of layers) {
      // PDF.js and the highlighter already update their own geometry. Scaling
      // this layer as well can double-scale newly rendered highlight positions.
      layer.style.transformOrigin = '';
      layer.style.transform = '';
    }
    window.cancelAnimationFrame(horizontalCenterFrameRef.current || 0);
    horizontalCenterFrameRef.current = window.requestAnimationFrame(() => {
      horizontalCenterFrameRef.current = undefined;
      const currentViewer = pdfViewerRef.current;
      if (!currentViewer) {
        return;
      }
      centerCurrentPageHorizontally(currentViewer);
    });
  }, []);

  const handleLayerRendered = useCallback((event: PdfLayerRenderedEvent) => {
    const viewer = pdfViewerRef.current;
    if (!viewer || typeof event.pageNumber !== 'number') {
      return;
    }
    if (searchStateRef.current.query.trim()) {
      const renderedPage = viewer.getPageView(event.pageNumber - 1)?.div;
      paintSearchHighlightsForPage(renderedPage, event.pageNumber);
    }
    if (!viewerContainerRef.current?.classList.contains('pdf-scale-in-progress')) {
      return;
    }
    renderedPagesRef.current.add(event.pageNumber);
    if (highlightSyncFrameRef.current !== undefined) return;
    highlightSyncFrameRef.current = window.requestAnimationFrame(() => {
      highlightSyncFrameRef.current = undefined;
      for (const pageNumber of renderedPagesRef.current) {
        const pageElement = viewer.getPageView(pageNumber - 1)?.div;
        for (const layer of getHighlightLayers(pageElement || null)) {
          layer.style.transform = '';
          layer.style.transformOrigin = '';
          layer.dataset.renderedScale = String(viewer.currentScale);
          pendingHighlightLayersRef.current.delete(layer);
        }
      }
      renderedPagesRef.current.clear();
      if (pendingHighlightLayersRef.current.size === 0) {
        viewerContainerRef.current?.classList.remove('pdf-scale-in-progress');
      }
    });
  }, [paintSearchHighlightsForPage]);

  const handleWheel = useCallback((event: WheelEvent) => {
    if (!event.ctrlKey) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onPinchZoom(event.deltaY);
  }, [onPinchZoom]);

  const handlePointerDown = useCallback((event: PointerEvent) => {
    pointerStartRef.current = event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
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

  const handleTextHighlightClick = useCallback((event: MouseEvent) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    const selection = window.getSelection();
    if (!start || event.button !== 0 || event.detail > 1 || event.altKey ||
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4 ||
      (selection && !selection.isCollapsed)) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !viewerContainerRef.current?.contains(target)) return;
    if (target?.closest('.PdfHighlighter__tip-container, a, button, input, textarea')) return;
    const page = target?.closest('.page');
    if (!page) return;
    // Paint stays pointer-transparent; hit-test only a click, never a scroll or drag.
    for (const part of page.querySelectorAll<HTMLElement>('[data-reader-annotation-id] .TextHighlight__part, [data-reader-annotation-id] .AreaHighlight__part')) {
      const rect = part.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom) continue;
      const id = part.closest<HTMLElement>('[data-reader-annotation-id]')?.dataset.readerAnnotationId;
      const annotation = highlights.find(item => item.annotation?.id === id)?.annotation;
      if (annotation) onOpen(annotation);
      return;
    }
  }, [highlights, onOpen]);

  useEffect(() => {
    document.addEventListener('click', handleTextHighlightClick, true);
    return () => document.removeEventListener('click', handleTextHighlightClick, true);
  }, [handleTextHighlightClick, pdfDocument]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ownedTip: Tip | null = null;
    const cancelPending = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    };
    const dismissHover = () => {
      cancelPending();
      const utils = highlighterUtilsRef.current;
      // A click may have replaced our preview with an editor. Never close it.
      if (ownedTip && utils?.getTip() === ownedTip) utils.setTip(null);
      ownedTip = null;
    };
    const handleMove = (event: PointerEvent) => {
      cancelPending();
      const target = event.target instanceof Element ? event.target : null;
      const utils = highlighterUtilsRef.current;
      if (target?.closest('.PdfHighlighter__tip-container')) return;
      if (!target || event.buttons || event.pointerType === 'touch' ||
        !viewerContainerRef.current?.contains(target) || !utils ||
        utils.isEditInProgress() || utils.isSelectionInProgress()) {
        dismissHover();
        return;
      }
      const page = target.closest('.page');
      if (!page) { dismissHover(); return; }
      const { clientX: x, clientY: y } = event;
      // Hit-test only after the pointer settles, not on every move/scroll.
      timer = setTimeout(() => {
        timer = undefined;
        if (utils.isEditInProgress() || utils.isSelectionInProgress()) return;
        const nativeSelection = window.getSelection();
        if (nativeSelection && !nativeSelection.isCollapsed) return;
        const hit = Array.from(page.querySelectorAll<HTMLElement>(
          '[data-reader-annotation-id] .TextHighlight__part'
        )).find(part => {
          const rect = part.getBoundingClientRect();
          return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        });
        const id = hit?.closest<HTMLElement>('[data-reader-annotation-id]')?.dataset.readerAnnotationId;
        const highlight = highlights.find(item => item.annotation?.id === id);
        const annotation = highlight?.annotation;
        if (!highlight || !annotation || !(annotation.note || annotation.tags?.length)) {
          dismissHover();
          return;
        }
        if (utils.getTip() && utils.getTip() !== ownedTip) return;
        const viewer = utils.getViewer();
        if (!viewer) return;
        ownedTip = {
          position: scaledPositionToViewport(highlight.position, viewer),
          content: <HighlightTooltip annotation={annotation} />
        };
        utils.setTip(ownedTip);
      }, 200);
    };
    document.addEventListener('pointermove', handleMove, true);
    document.addEventListener('pointerdown', dismissHover, true);
    document.addEventListener('scroll', dismissHover, true);
    document.addEventListener('pointerleave', dismissHover);
    return () => {
      dismissHover();
      document.removeEventListener('pointermove', handleMove, true);
      document.removeEventListener('pointerdown', dismissHover, true);
      document.removeEventListener('scroll', dismissHover, true);
      document.removeEventListener('pointerleave', dismissHover);
    };
  }, [highlights, pdfDocument]);

  const captureUtils = useCallback((utils: PdfHighlighterUtils) => {
    highlighterUtilsRef.current = utils;
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
    }
    utilsRef(utils);
  }, [handleLayerRendered, handlePageChanging, handlePointerDown, handleScaleChanging, handleWheel, utilsRef]);

  useEffect(() => () => {
    eventBusRef.current?.off('pagechanging', handlePageChanging);
    eventBusRef.current?.off('scalechanging', handleScaleChanging);
    eventBusRef.current?.off('textlayerrendered', handleLayerRendered);
    eventBusRef.current?.off('pagerendered', handleLayerRendered);
    eventBusRef.current = null;
    viewerContainerRef.current?.removeEventListener('wheel', handleWheel);
    viewerContainerRef.current?.removeEventListener('pointerdown', handlePointerDown, true);
    for (const layer of pendingHighlightLayersRef.current) {
      layer.style.transform = '';
      layer.style.transformOrigin = '';
    }
    pendingHighlightLayersRef.current.clear();
    renderedPagesRef.current.clear();
    viewerContainerRef.current = null;
    pdfViewerRef.current = null;
    window.cancelAnimationFrame(highlightSyncFrameRef.current || 0);
    window.cancelAnimationFrame(horizontalCenterFrameRef.current || 0);
  }, [handleLayerRendered, handlePageChanging, handlePointerDown, handleScaleChanging, handleWheel]);

  const enableAreaSelection = useCallback(
    (event: MouseEvent) => Boolean(areaSelectMode) || event.altKey,
    [areaSelectMode]
  );

  return (
    <PdfHighlighter
      pdfDocument={pdfDocument as never}
      highlights={highlights}
      onSelection={onSelection}
      selectionTip={selectionTip}
      enableAreaSelection={enableAreaSelection}
      pdfScaleValue={zoom}
      textSelectionColor={TEXT_SELECTION_COLOR}
      utilsRef={captureUtils}
      style={{ height: '100%' }}
    >
      <HighlightContainer
        activeId={activeId}
        locatedId={locatedId}
        onOpen={onOpen}
      />
    </PdfHighlighter>
  );
}

function centerCurrentPageHorizontally(viewer: PdfViewerInstance) {
  const pageElement = viewer.getPageView(viewer.currentPageNumber - 1)?.div;
  if (!pageElement) {
    return;
  }

  const { container } = viewer;
  const containerRect = container.getBoundingClientRect();
  const pageRect = pageElement.getBoundingClientRect();
  const pageCenterInViewport = pageRect.left - containerRect.left + pageRect.width / 2;
  const centeredScrollLeft = container.scrollLeft + pageCenterInViewport - container.clientWidth / 2;
  const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
  container.scrollLeft = Math.min(maxScrollLeft, Math.max(0, centeredScrollLeft));
}

function HighlightContainer({
  activeId,
  locatedId,
  onOpen
}: {
  activeId?: string;
  locatedId?: string;
  onOpen(annotation: AnnotationRecord, position?: ViewportPosition): void;
}) {
  const { highlight, isScrolledTo, highlightBindings } = useHighlightContainerContext<ReaderHighlight>();
  const annotation = highlight.annotation;
  const activeClass = annotation?.id === activeId ? ' active-highlight' : '';
  const locatedClass = annotation?.id === locatedId ? ' located-highlight' : '';

  if (!annotation) {
    if (highlight.type === 'area') {
      return (
        <AreaHighlight
          highlight={highlight}
          isScrolledTo={isScrolledTo}
          bounds={highlightBindings.textLayer}
          highlightColor={TEXT_SELECTION_COLOR}
        />
      );
    }

    return (
      <div className="reader-selection-preview">
        <TextHighlight
          highlight={highlight}
          isScrolledTo={isScrolledTo}
          highlightColor={TEXT_SELECTION_COLOR}
        />
      </div>
    );
  }

  const hasTooltip = !!(annotation.note || annotation.tags?.length);
  const highlightTip: Tip | undefined = hasTooltip
    ? { position: highlight.position, content: <HighlightTooltip annotation={annotation} /> }
    : undefined;

  const areaHighlight = highlight.type === 'area' ? (
    <span className={`reader-area-highlight${activeClass}${locatedClass}`} data-reader-annotation-id={annotation.id}>
      <AreaHighlight
        highlight={highlight}
        isScrolledTo={isScrolledTo}
        bounds={highlightBindings.textLayer}
        highlightColor={annotation.color || '#ffd654'}
      />
    </span>
  ) : null;

  const kindClass = (annotation.kind || 'highlight') === 'underline'
    ? ' reader-kind-underline'
    : ' reader-kind-highlight';
  const textHighlight = highlight.type !== 'area' ? (
    <span className={`reader-text-highlight${kindClass}${activeClass}${locatedClass}`} data-reader-annotation-id={annotation.id}>
      <TextHighlight
        highlight={highlight}
        isScrolledTo={isScrolledTo}
        highlightColor={annotation.color || '#ffd654'}
        highlightStyle={(annotation.kind || 'highlight') === 'underline' ? 'underline' : 'highlight'}
        onClick={() => onOpen(annotation, highlight.position)}
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

function HighlightTooltip({ annotation }: { annotation: AnnotationRecord }) {
  if (!annotation.note && !annotation.tags?.length) return null;
  return (
    <div className="highlight-tooltip">
      {annotation.note ? <p>{annotation.note}</p> : null}
      {annotation.tags?.length ? (
        <div className="annotation-tags">
          {annotation.tags.map(tag => <span key={tag} className="tag-chip static">#{tag}</span>)}
        </div>
      ) : null}
    </div>
  );
}

function getHighlightLayers(root: ParentNode | null) {
  if (!root) return [] as HTMLElement[];
  return Array.from(root.querySelectorAll<HTMLElement>(
    '.PdfHighlighter__highlight-layer, .PdfHighlighter__note-layer, .PdfHighlighter__config-layer'
  ));
}
