import React, { useEffect, useRef, useState } from 'react';
import { normalizeTags } from '../annotationModel';
import type { AnnotationKind, AnnotationRecord, WordDetails, WordRecord } from '../types';

export interface SelectionToolbarContextValue {
  selectedText: string;
  translationSourceText: string;
  translationText: string;
  wordDetails?: WordDetails;
  annotationsEnabled: boolean;
  translationEnabled: boolean;
  wordbookEnabled: boolean;
  onHighlight(color: string): void;
  onUnderline(color: string): void;
  onSaveNote(note: string, color: string): void;
  onTranslate(): void;
  onSaveWord(details: WordDetails): void;
}

export const SelectionToolbarContext = React.createContext<SelectionToolbarContextValue | undefined>(undefined);

export const colorOptions = [
  { label: 'Yellow', value: '#ffd654' },
  { label: 'Blue', value: '#8fd3ff' },
  { label: 'Green', value: '#a6e99f' },
  { label: 'Red', value: '#ffaaa5' },
  { label: 'Purple', value: '#d7b8ff' }
];

export function AnnotationItem({
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

export function AnnotationSummary({ annotations }: { annotations: AnnotationRecord[] }) {
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

export function WordItem({ word, onDelete }: { word: WordRecord; onDelete(): void }) {
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

export function InlineAnnotationEditor({
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
          onKeyDown={event => saveNoteOnEnter(event, save)}
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

export function InlineAnnotationActions({
  onDelete,
  onEdit
}: {
  onDelete(): void;
  onEdit(): void;
}) {
  return (
    <div
      className="selection-toolbar annotation-inline-actions"
      onClick={event => event.stopPropagation()}
      onMouseDown={event => event.stopPropagation()}
      onPointerDown={event => event.stopPropagation()}
    >
      <button onClick={onEdit}>Edit</button>
      <button className="danger-button" onClick={onDelete}>Delete</button>
    </div>
  );
}

export function SelectionToolbar() {
  const context = React.useContext(SelectionToolbarContext);
  if (!context) {
    return null;
  }
  const {
    selectedText,
    translationSourceText,
    translationText,
    wordDetails,
    annotationsEnabled,
    translationEnabled,
    wordbookEnabled,
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

  useEffect(() => {
    if (
      (activeEditor === 'note' && !annotationsEnabled) ||
      (activeEditor === 'translation' && !translationEnabled)
    ) {
      setActiveEditor(undefined);
    }
  }, [activeEditor, annotationsEnabled, translationEnabled]);

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

  if (!annotationsEnabled && !translationEnabled) {
    return null;
  }

  return (
    <div
      className="selection-toolbar"
      onClick={event => event.stopPropagation()}
      onMouseDown={event => event.stopPropagation()}
      onPointerDown={event => event.stopPropagation()}
    >
      <div className="selection-toolbar-row">
        {annotationsEnabled ? (
          <>
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
          </>
        ) : null}
        {translationEnabled ? <button className={activeEditor === 'translation' ? 'active-command' : ''} onClick={translate}>Translate</button> : null}
      </div>
      {activeEditor === 'note' ? (
        <div className="selection-note-editor">
          <textarea
            ref={noteInputRef}
            value={noteText}
            onChange={event => setNoteText(event.target.value)}
            onKeyDown={event => {
              if (saveNoteOnEnter(event, saveNote)) {
                return;
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
                {wordbookEnabled ? <button onClick={() => onSaveWord(currentWordDetails)}>Save to Wordbook</button> : null}
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

export function annotationStatus(shown: number, total: number) {
  if (!total) {
    return '0 annotations';
  }
  return shown === total ? `${total} annotation${total === 1 ? '' : 's'}` : `${shown} of ${total} annotations`;
}
function shorten(value: string, max: number) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized;
}

function saveNoteOnEnter(event: React.KeyboardEvent<HTMLTextAreaElement>, save: () => void) {
  if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
    return false;
  }
  event.preventDefault();
  save();
  return true;
}

function stopThen(callback: () => void) {
  return (event: React.MouseEvent) => {
    event.stopPropagation();
    callback();
  };
}

export function WordDetailsBlock({ details }: { details: WordDetails }) {
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
