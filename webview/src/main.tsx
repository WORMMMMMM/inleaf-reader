import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { WorkerMessageHandler } from 'pdfjs-dist/build/pdf.worker.min.mjs';
import {
  AreaHighlight,
  MonitoredHighlightContainer,
  PdfHighlighter,
  PdfLoader,
  TextHighlight,
  useHighlightContainerContext,
  type Highlight,
  type PdfHighlighterUtils,
  type PdfScaleValue,
  type PdfSelection,
  type ScaledPosition,
  type Tip
} from 'react-pdf-highlighter-plus';
import 'pdfjs-dist/web/pdf_viewer.css';
import 'react-pdf-highlighter-plus/style/style.css';
import './styles.css';
import { readerConfig, vscode } from './vscodeApi';
import type { AnnotationKind, AnnotationRecord, AnnotationRect, ReaderStatePayload, WordDetails, WordRecord } from './types';

type PdfjsGlobal = typeof globalThis & {
  pdfjsWorker?: { WorkerMessageHandler: unknown };
};

(globalThis as PdfjsGlobal).pdfjsWorker = { WorkerMessageHandler };

type ReaderHighlight = Highlight & {
  annotation?: AnnotationRecord;
};

type PdfPageChangingEvent = {
  pageNumber?: number;
};

type PdfEventBus = {
  on(eventName: 'pagechanging', listener: (event: PdfPageChangingEvent) => void): void;
  off(eventName: 'pagechanging', listener: (event: PdfPageChangingEvent) => void): void;
};

type SidebarTab = 'overview' | 'annotations' | 'wordbook' | 'translation';

interface SelectionToolbarContextValue {
  selectedText: string;
  translationSourceText: string;
  translationText: string;
  wordDetails?: WordDetails;
  onHighlight(color: string): void;
  onUnderline(color: string): void;
  onSaveNote(note: string, color: string): void;
  onTranslate(): void;
  onCopyPrompt(): void;
  onSaveWord(details: WordDetails): void;
}

const SelectionToolbarContext = React.createContext<SelectionToolbarContextValue | undefined>(undefined);

type IncomingMessage =
  | { type: 'state'; payload: ReaderStatePayload }
  | { type: 'navigateTo'; payload: { pdfUrl: string; paperName: string } }
  | { type: 'translationResult'; payload: { sourceText: string; translatedText?: string; wordDetails?: WordDetails; error?: string } }
  | { type: 'exportResult'; payload: { path?: string; error?: string } }
  | { type: 'clipboardResult'; payload: { message?: string; error?: string } }
  | { type: 'annotationActionResult'; payload: { message?: string; error?: string } }
  | { type: 'stateError'; payload: { message: string } };

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
  const [selectionPosition, setSelectionPosition] = useState<ScaledPosition | undefined>();
  const [note, setNote] = useState('');
  const [tags, setTags] = useState('');
  const [color, setColor] = useState('#ffd654');
  const [kind, setKind] = useState<AnnotationKind>('highlight');
  const [editingId, setEditingId] = useState<string | undefined>();
  const [translationOutput, setTranslationOutput] = useState('');
  const [wordDetails, setWordDetails] = useState<WordDetails | undefined>();
  const [translationSourceText, setTranslationSourceText] = useState('');
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
  const [paperName, setPaperName] = useState(readerConfig.paperName);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('overview');
  const highlighterRef = useRef<PdfHighlighterUtils | null>(null);
  const editDebounceRef = useRef<number | undefined>(undefined);
  const progressDebounceRef = useRef<number | undefined>(undefined);
  const documentReadyRef = useRef(false);
  const selectionRef = useRef({ selectedText: '', selectionPosition: undefined as ScaledPosition | undefined, currentPage: 1 });

  const saveReadingProgress = useCallback((page: number) => {
    window.clearTimeout(progressDebounceRef.current);
    progressDebounceRef.current = window.setTimeout(() => {
      vscode.postMessage({ type: 'saveProgress', payload: { page } });
    }, 350);
  }, []);

  const handleVisiblePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    saveReadingProgress(page);
  }, [saveReadingProgress]);

  const handleHighlighterUtils = useCallback((utils: PdfHighlighterUtils) => {
    highlighterRef.current = utils;
  }, []);

  useEffect(() => {
    document.body.classList.add('reader-mounted');
    return () => {
      window.clearTimeout(progressDebounceRef.current);
      document.body.classList.remove('reader-mounted');
    };
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
      if (message.type === 'state') {
        setState(message.payload);
        if (message.payload.progress?.page) {
          setCurrentPage(message.payload.progress.page);
        }
      }
      if (message.type === 'navigateTo') {
        window.clearTimeout(progressDebounceRef.current);
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
      if (message.type === 'exportResult') {
        setStatus(message.payload.error ? `Export failed: ${message.payload.error}` : `Exported: ${message.payload.path}`);
      }
      if (message.type === 'clipboardResult' || message.type === 'annotationActionResult') {
        setStatus(message.payload.error || message.payload.message || 'Done.');
      }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);

  useEffect(() => {
    if (!state.progress?.page || !pageTotal) {
      return;
    }
    const timer = window.setTimeout(() => goToPage(state.progress.page || 1, false), 250);
    return () => window.clearTimeout(timer);
  }, [pageTotal, state.progress?.page]);

  useEffect(() => {
    if (!editingId) {
      return;
    }
    window.clearTimeout(editDebounceRef.current);
    editDebounceRef.current = window.setTimeout(() => {
      const page = selectionPosition?.boundingRect.pageNumber || currentPage;
      vscode.postMessage({
        type: 'updateAnnotation',
        payload: {
          id: editingId,
          patch: {
            page,
            selectedText,
            note,
            tags: normalizeTags(tags),
            color,
            kind,
            highlighterPosition: selectionPosition,
            rects: selectionPosition ? highlighterPositionToRects(selectionPosition) : undefined
          }
        }
      });
      setStatus('Annotation autosaved.');
    }, 550);
    return () => window.clearTimeout(editDebounceRef.current);
  }, [color, currentPage, editingId, kind, note, selectedText, selectionPosition, tags]);

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

  const dueWords = useMemo(() => {
    const now = Date.now();
    return state.words.filter(item => Date.parse(item.review?.nextReviewAt || item.createdAt) <= now);
  }, [state.words]);

  function handleSelection(selection: PdfSelection) {
    const ghost = selection.makeGhostHighlight();
    const text = ghost.content.text || '';
    setSelectedText(text);
    setSelectionPosition(ghost.position);
    setCurrentPage(ghost.position.boundingRect.pageNumber);
    setTranslationSourceText('');
    setTranslationOutput('');
    setWordDetails(undefined);
    selectionRef.current = {
      selectedText: text,
      selectionPosition: ghost.position,
      currentPage: ghost.position.boundingRect.pageNumber
    };
    setStatus('Selection captured.');
  }

  function saveAnnotation() {
    const pos = selectionPosition;
    const page = pos?.boundingRect.pageNumber || currentPage;
    const payload = {
      page,
      selectedText,
      note,
      tags: normalizeTags(tags),
      color,
      kind,
      highlighterPosition: pos,
      rects: pos ? highlighterPositionToRects(pos) : undefined
    };
    if (!payload.selectedText.trim() && !payload.note.trim()) {
      setStatus('Add selected text or a note before saving.');
      return;
    }
    if (editingId) {
      vscode.postMessage({ type: 'updateAnnotation', payload: { id: editingId, patch: payload } });
      setStatus('Annotation saved.');
    } else {
      vscode.postMessage({ type: 'saveAnnotation', payload });
      setStatus('Annotation saved automatically.');
    }
    clearAnnotationDraft();
    highlighterRef.current?.removeGhostHighlight();
  }

  function editAnnotation(annotation: AnnotationRecord) {
    setEditingId(annotation.id);
    setActiveId(annotation.id);
    setSelectedText(annotation.selectedText || '');
    setNote(annotation.note || '');
    setTags((annotation.tags || []).join(', '));
    setColor(annotation.color || '#ffd654');
    setKind(annotation.kind || 'highlight');
    setSelectionPosition(annotation.highlighterPosition || rectsToHighlighterPosition(annotation.rects));
    setCurrentPage(annotation.page || annotation.highlighterPosition?.boundingRect.pageNumber || 1);
    focusAnnotation(annotation);
  }

  function deleteAnnotation(annotation: AnnotationRecord) {
    setLastDeleted(annotation);
    vscode.postMessage({ type: 'deleteAnnotation', payload: { id: annotation.id } });
    if (editingId === annotation.id) {
      clearAnnotationDraft();
    }
    setStatus('Annotation deleted. Use undo to restore it.');
  }

  function restoreLastDeleted() {
    if (!lastDeleted) {
      return;
    }
    vscode.postMessage({ type: 'restoreAnnotation', payload: lastDeleted });
    setLastDeleted(undefined);
  }

  function clearAnnotationDraft() {
    window.clearTimeout(editDebounceRef.current);
    setEditingId(undefined);
    setSelectedText('');
    setSelectionPosition(undefined);
    setNote('');
    setTags('');
    setColor('#ffd654');
    setKind('highlight');
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

  const copySelectionPrompt = useCallback(() => {
    const s = selectionRef.current;
    const text = s.selectedText.trim();
    if (!text) {
      setStatus('Select text before copying a prompt.');
      return;
    }
    vscode.postMessage({ type: 'copyPrompt', payload: { text } });
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
    onCopyPrompt: copySelectionPrompt,
    onSaveWord: saveSelectionWord
  }), [copySelectionPrompt, quickHighlight, quickUnderline, saveSelectionNote, saveSelectionWord, selectedText, translateSelection, translationOutput, translationSourceText, wordDetails]);

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
          <button title="Zoom out" onClick={() => setZoom(value => clampZoom(typeof value === 'number' ? value - 0.15 : 0.85))}>-</button>
          <span className="zoom-value">{zoomLabel(zoom)}</span>
          <button title="Zoom in" onClick={() => setZoom(value => clampZoom(typeof value === 'number' ? value + 0.15 : 1.15))}>+</button>
          <button title="Fit full page" onClick={() => setZoom('page-fit')}>Fit</button>
          <button title="Fit page width" onClick={() => setZoom('page-width')}>Width</button>
          <span className="reader-status">{status}</span>
        </div>
        <div className="pdf-host">
          <PdfLoader
            document={pdfUrl}
            beforeLoad={progress => <div className="loading">Loading PDF {progress.loaded ? `${Math.round(progress.loaded / 1024)} KB` : ''}</div>}
            errorMessage={error => <div className="loading error">Could not load PDF: {error.message}</div>}
            onError={error => setStatus(`Could not load PDF: ${error.message}`)}
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
                onSelection={handleSelection}
                onStyleChange={handleStyleChange}
                utilsRef={handleHighlighterUtils}
              />
            )}
          </PdfLoader>
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
    <main className="shell">
      {readerView}
      <aside className="side-panel">
        <header>
          <p className="eyebrow">Reading Extension</p>
          <h1>{paperName || state.paperName || readerConfig.paperName}</h1>
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
              <div className="metric-card">
                <span>Due</span>
                <strong>{dueWords.length}</strong>
              </div>
            </div>
            <section className="tool-block">
              <h2>Translation</h2>
              <dl className="meta-list">
                <div>
                  <dt>Provider</dt>
                  <dd>{readerConfig.translationProvider || 'argos'}</dd>
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
            {editingId ? (
              <section className="tool-block edit-panel">
                <h2>Editing Annotation</h2>
                <div className="edit-status">Changes autosave while this panel is open.</div>
                <label htmlFor="annotationColor">Highlight color</label>
                <select id="annotationColor" value={color} onChange={event => setColor(event.target.value)}>
                  {colorOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <label htmlFor="annotationKind">Annotation style</label>
                <select id="annotationKind" value={kind} onChange={event => setKind(event.target.value as AnnotationKind)}>
                  <option value="highlight">Highlight</option>
                  <option value="underline">Underline</option>
                </select>
                <label htmlFor="annotationTags">Tags</label>
                <input id="annotationTags" value={tags} onChange={event => setTags(event.target.value)} placeholder="method, question, todo" />
                <textarea rows={4} value={note} onChange={event => setNote(event.target.value)} placeholder="Your annotation" />
                <div className="actions">
                  <button onClick={saveAnnotation}>Save now</button>
                  <button className="secondary-button" onClick={clearAnnotationDraft}>Cancel edit</button>
                </div>
              </section>
            ) : null}

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
              <h2>Due Today</h2>
              {dueWords.length ? dueWords.map(item => (
                <WordItem key={item.id} word={item} showReview />
              )) : <div className="empty">No words due today.</div>}
            </section>
            <section className="tool-block">
              <h2>Saved Words</h2>
              {state.words.length ? (
                <div className="list">
                  {state.words.map(item => <WordItem key={item.id} word={item} />)}
                </div>
              ) : <div className="empty">No words saved yet.</div>}
            </section>
          </section>
        ) : null}

        {activeSidebarTab === 'translation' ? (
          <section className="side-tab-panel">
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
  onOpen(annotation: AnnotationRecord): void;
  onPageChange(page: number): void;
  onSelection(selection: PdfSelection): void;
  onStyleChange(annotation: AnnotationRecord, color: string, kind: AnnotationKind): void;
  utilsRef(utils: PdfHighlighterUtils): void;
}) {
  const eventBusRef = useRef<PdfEventBus | null>(null);

  useEffect(() => {
    onDocumentReady(pdfDocument.numPages);
  }, [onDocumentReady, pdfDocument.numPages]);

  const handlePageChanging = useCallback((event: PdfPageChangingEvent) => {
    if (typeof event.pageNumber === 'number') {
      onPageChange(event.pageNumber);
    }
  }, [onPageChange]);

  const captureUtils = useCallback((utils: PdfHighlighterUtils) => {
    const nextEventBus = utils.getEventBus() as PdfEventBus | null;
    if (eventBusRef.current !== nextEventBus) {
      eventBusRef.current?.off('pagechanging', handlePageChanging);
      nextEventBus?.on('pagechanging', handlePageChanging);
      eventBusRef.current = nextEventBus;
    }
    utilsRef(utils);
  }, [handlePageChanging, utilsRef]);

  useEffect(() => () => {
    eventBusRef.current?.off('pagechanging', handlePageChanging);
    eventBusRef.current = null;
  }, [handlePageChanging]);

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
  onOpen(annotation: AnnotationRecord): void;
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
        onClick={() => onOpen(annotation)}
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

function WordItem({ word, showReview = false }: { word: WordRecord; showReview?: boolean }) {
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
      {showReview ? (
        <div className="annotation-actions">
          <button onClick={() => vscode.postMessage({ type: 'reviewWord', payload: { id: word.id, remembered: true } })}>Remembered</button>
          <button onClick={() => vscode.postMessage({ type: 'reviewWord', payload: { id: word.id, remembered: false } })}>Again</button>
        </div>
      ) : null}
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
    onCopyPrompt,
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
        <button onClick={onCopyPrompt}>Prompt</button>
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
            <button onClick={saveNote} disabled={!noteText.trim()}>Save</button>
            <button onClick={() => setActiveEditor(undefined)}>Cancel</button>
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
      setError(event.message || String(event.error || 'Unknown Webview error'));
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
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

createRoot(document.getElementById('root')!).render(<Bootstrap />);
