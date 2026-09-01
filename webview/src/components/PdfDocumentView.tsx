import React, { useCallback, useEffect, useRef } from 'react';
import {
  AreaHighlight,
  MonitoredHighlightContainer,
  PdfHighlighter,
  TextHighlight,
  useHighlightContainerContext,
  type PdfHighlighterUtils,
  type PdfScaleValue,
  type PdfSelection,
  type Tip,
  type ViewportPosition
} from 'react-pdf-highlighter-plus';
import type { ReaderHighlight } from '../annotationModel';
import { markPageSelectionRegions } from '../pdfSelection';
import type { AnnotationRecord } from '../types';

type PdfPageChangingEvent = { pageNumber?: number };
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
  highlights,
  pdfDocument,
  selectionTip,
  zoom,
  onDocumentReady,
  onOpen,
  onPageChange,
  onPinchZoom,
  onSelection,
  utilsRef
}: {
  activeId?: string;
  highlights: ReaderHighlight[];
  pdfDocument: { numPages: number };
  selectionTip?: React.ReactNode;
  zoom: PdfScaleValue;
  onDocumentReady(numPages: number): void;
  onOpen(annotation: AnnotationRecord, position?: ViewportPosition): void;
  onPageChange(page: number): void;
  onPinchZoom(deltaY: number): void;
  onSelection(selection: PdfSelection): void;
  utilsRef(utils: PdfHighlighterUtils): void;
}) {
  const eventBusRef = useRef<PdfEventBus | null>(null);
  const viewerContainerRef = useRef<HTMLDivElement | null>(null);
  const pdfViewerRef = useRef<PdfViewerInstance | null>(null);
  const renderedHighlightScaleRef = useRef<number | undefined>(undefined);
  const highlightSyncFrameRef = useRef<number | undefined>(undefined);
  const horizontalCenterFrameRef = useRef<number | undefined>(undefined);
  const pendingHighlightLayersRef = useRef(new Set<HTMLElement>());

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
    const layers = getHighlightLayers(viewerContainerRef.current);
    pendingHighlightLayersRef.current = new Set(layers);
    viewerContainerRef.current?.classList.toggle('pdf-scale-in-progress', layers.length > 0);
    for (const layer of layers) {
      const layerScale = Number(layer.dataset.renderedScale) || renderedScale;
      layer.style.transformOrigin = '0 0';
      layer.style.transform = `scale(${nextScale / layerScale})`;
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
        pendingHighlightLayersRef.current.delete(layer);
      }
      renderedHighlightScaleRef.current = viewer.currentScale;
      if (pendingHighlightLayersRef.current.size === 0) {
        viewerContainerRef.current?.classList.remove('pdf-scale-in-progress');
      }
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
    for (const layer of pendingHighlightLayersRef.current) {
      layer.style.transform = '';
      layer.style.transformOrigin = '';
    }
    pendingHighlightLayersRef.current.clear();
    viewerContainerRef.current = null;
    pdfViewerRef.current = null;
    window.cancelAnimationFrame(highlightSyncFrameRef.current || 0);
    window.cancelAnimationFrame(horizontalCenterFrameRef.current || 0);
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
  onOpen
}: {
  activeId?: string;
  onOpen(annotation: AnnotationRecord, position?: ViewportPosition): void;
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
    />
  ) : null;

  const textHighlight = highlight.type !== 'area' ? (
    <span className={activeClass}>
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
          {annotation.tags.map(tag => <span key={tag}>#{tag}</span>)}
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
