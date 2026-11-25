import React, { useEffect, useRef, useState } from 'react';
import { isAreaAnnotation, normalizeTags } from '../annotationModel';
import { useI18n } from '../i18nContext';
import type { AnnotationKind, AnnotationRecord, WordDetails, WordRecord } from '../types';
import {
  IconArea,
  IconCopy,
  IconEdit,
  IconHighlighter,
  IconJump,
  IconNote,
  IconSparkles,
  IconTranslate,
  IconTrash,
  IconUnderline
} from './Icons';

export interface SelectionToolbarContextValue {
  selectedText: string;
  isAreaSelection?: boolean;
  translationSourceText: string;
  translationText: string;
  wordDetails?: WordDetails;
  frequentTags: string[];
  annotationsEnabled: boolean;
  translationEnabled: boolean;
  wordbookEnabled: boolean;
  onHighlight(color: string): void;
  onUnderline(color: string): void;
  onSaveNote(note: string, color: string, tags?: string[]): void;
  onTranslate(): void;
  onSaveWord(details: WordDetails): void;
  onCopyForAi(): void;
}

export const SelectionToolbarContext = React.createContext<SelectionToolbarContextValue | undefined>(undefined);

export const colorOptions = [
  { label: 'Yellow', labelKey: 'colorYellow' as const, value: '#ffd654' },
  { label: 'Blue', labelKey: 'colorBlue' as const, value: '#8fd3ff' },
  { label: 'Green', labelKey: 'colorGreen' as const, value: '#a6e99f' },
  { label: 'Red', labelKey: 'colorRed' as const, value: '#ffaaa5' },
  { label: 'Purple', labelKey: 'colorPurple' as const, value: '#d7b8ff' }
];

export function AnnotationItem({
  annotation,
  active,
  onFocus,
  onEdit,
  onCopy,
  onDelete,
  onTagClick
}: {
  annotation: AnnotationRecord;
  active: boolean;
  onFocus(): void;
  onEdit(): void;
  onCopy(): void;
  onDelete(): void;
  onTagClick?(tag: string): void;
}) {
  const { t } = useI18n();
  const page = annotation.page || annotation.highlighterPosition?.boundingRect.pageNumber;
  const color = annotation.color || '#ffd654';
  const isArea = isAreaAnnotation(annotation);
  const isUnderline = annotation.kind === 'underline';

  return (
    <article
      className={`item annotation-item${active ? ' active-item' : ''}`}
      style={{ borderLeftColor: color }}
      onClick={onFocus}
    >
      <div className="annotation-item-head">
        <div className="annotation-meta">
          <span className="page-badge">{page ? `p.${page}` : '-'}</span>
          {isArea ? (
            <span className="style-badge" title={t('areaHighlightLabel')}>
              <IconArea size={12} />
              <span>{t('areaHighlightLabel')}</span>
            </span>
          ) : isUnderline ? (
            <span className="style-badge" title={t('styleUnderline')}>
              <IconUnderline size={12} />
            </span>
          ) : null}
        </div>
        <div className="annotation-card-actions">
          <button
            className="icon-button"
            title={t('edit')}
            aria-label={t('edit')}
            onClick={stopThen(onEdit)}
          >
            <IconEdit size={13} />
          </button>
          <button
            className="icon-button"
            title={t('copyMd')}
            aria-label={t('copyMd')}
            onClick={stopThen(onCopy)}
          >
            <IconCopy size={13} />
          </button>
          <button
            className="icon-button danger-icon-button"
            title={t('delete')}
            aria-label={t('delete')}
            onClick={stopThen(onDelete)}
          >
            <IconTrash size={13} />
          </button>
        </div>
      </div>

      {!isArea && annotation.selectedText ? (
        <blockquote className="annotation-quote">
          {shorten(annotation.selectedText, 220)}
        </blockquote>
      ) : null}
      {annotation.note ? <p className="note">{shorten(annotation.note, 200)}</p> : null}
      {annotation.tags?.length ? (
        <div className="annotation-tags">
          {annotation.tags.map(tag => (
            <button
              type="button"
              key={tag}
              className="tag-chip"
              onClick={event => {
                event.stopPropagation();
                onTagClick?.(tag);
              }}
            >
              #{tag}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function AnnotationSummary({
  annotations,
  onTagClick
}: {
  annotations: AnnotationRecord[];
  onTagClick?(tag: string): void;
}) {
  const { t } = useI18n();
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
      <span>{highlights} {t('highlightsCount')}</span>
      {underlines > 0 ? <span>{underlines} {t('underlinesCount')}</span> : null}
      {topTags.map(([tag, count]) => (
        <button
          type="button"
          key={tag}
          className="tag-chip"
          onClick={() => onTagClick?.(tag)}
        >
          #{tag} {count}
        </button>
      ))}
    </div>
  );
}

export function WordItem({
  word,
  onDelete,
  onJumpPage,
  onUpdateNote
}: {
  word: WordRecord;
  onDelete(): void;
  onJumpPage?(page: number): void;
  onUpdateNote?(note: string): void;
}) {
  const { t } = useI18n();
  const [editingNote, setEditingNote] = useState(false);
  const [draftNote, setDraftNote] = useState(word.note || '');
  const hasRealSentence = Boolean(
    word.sentence
    && word.sentence.trim().toLowerCase() !== word.word.trim().toLowerCase()
  );

  useEffect(() => {
    setDraftNote(word.note || '');
  }, [word.note]);

  function saveNote() {
    onUpdateNote?.(draftNote.trim());
    setEditingNote(false);
  }

  return (
    <article className="item word-item">
      <div className="word-item-head">
        <div className="word-heading-group">
          <strong>{word.word}</strong>
          {word.phonetic ? <span className="phonetic compact-phonetic">{word.phonetic}</span> : null}
        </div>
        <div className="annotation-card-actions always-subtle">
          {word.page && onJumpPage ? (
            <button
              className="page-badge page-jump-badge"
              title={t('jumpToPage', { page: word.page })}
              onClick={() => onJumpPage(word.page!)}
            >
              <span>p.{word.page}</span>
              <IconJump size={11} />
            </button>
          ) : null}
          {onUpdateNote ? (
            <button
              className="icon-button"
              title={t('editNote')}
              aria-label={t('editNote')}
              onClick={() => setEditingNote(current => !current)}
            >
              <IconEdit size={13} />
            </button>
          ) : null}
          <button
            className="icon-button danger-icon-button"
            title={t('delete')}
            aria-label={t('delete')}
            onClick={onDelete}
          >
            <IconTrash size={13} />
          </button>
        </div>
      </div>

      {word.translation ? <p className="word-translation-summary">{word.translation}</p> : null}
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
      {hasRealSentence ? (
        <blockquote className="word-sentence">
          {highlightWordInSentence(word.sentence!, word.word)}
        </blockquote>
      ) : null}
      {editingNote ? (
        <div className="word-note-editor">
          <textarea
            rows={2}
            value={draftNote}
            placeholder={t('wordNotePlaceholder')}
            onChange={event => setDraftNote(event.target.value)}
            onKeyDown={event => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                saveNote();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                setEditingNote(false);
                setDraftNote(word.note || '');
              }
            }}
          />
          <div className="selection-note-actions">
            <button className="secondary-button" onClick={() => { setEditingNote(false); setDraftNote(word.note || ''); }}>
              {t('cancel')}
            </button>
            <button className="primary-button" onClick={saveNote}>{t('save')}</button>
          </div>
        </div>
      ) : word.note ? (
        <p className="note">{word.note}</p>
      ) : null}
    </article>
  );
}

export function InlineAnnotationEditor({
  annotation,
  frequentTags = [],
  onCancel,
  onSave
}: {
  annotation: AnnotationRecord;
  frequentTags?: string[];
  onCancel(): void;
  onSave(patch: {
    selectedText: string;
    note: string;
    tags: string[];
    color: string;
    kind: AnnotationKind;
  }): void;
}) {
  const { t } = useI18n();
  const [draftText, setDraftText] = useState(annotation.selectedText || '');
  const [draftNote, setDraftNote] = useState(annotation.note || '');
  const [draftTags, setDraftTags] = useState((annotation.tags || []).join(', '));
  const [draftColor, setDraftColor] = useState(annotation.color || '#ffd654');
  const [draftKind, setDraftKind] = useState<AnnotationKind>(annotation.kind || 'highlight');
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);
  const canSave = !!(draftText.trim() || draftNote.trim());
  const activeTags = normalizeTags(draftTags);

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

  function toggleSuggestedTag(tag: string) {
    const next = activeTags.includes(tag)
      ? activeTags.filter(item => item !== tag)
      : [...activeTags, tag];
    setDraftTags(next.join(', '));
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
      <div className="annotation-inline-title">{t('editAnnotationTitle')}</div>
      <div className="selection-toolbar-row">
        <div className="swatch-group">
          {colorOptions.map(option => (
            <button
              key={option.value}
              className={`swatch${draftColor === option.value ? ' active' : ''}`}
              style={{ background: option.value }}
              title={t(option.labelKey)}
              aria-label={t(option.labelKey)}
              onClick={() => setDraftColor(option.value)}
            />
          ))}
        </div>
        <span className="toolbar-mini-divider" />
        <button
          className={`toolbar-pill-button${draftKind === 'highlight' ? ' active-command' : ''}`}
          title={t('styleHighlight')}
          onClick={() => setDraftKind('highlight')}
        >
          <IconHighlighter size={13} />
          <span>{t('styleHighlight')}</span>
        </button>
        <button
          className={`toolbar-pill-button${draftKind === 'underline' ? ' active-command' : ''}`}
          title={t('styleUnderline')}
          onClick={() => setDraftKind('underline')}
        >
          <IconUnderline size={13} />
          <span>{t('styleUnderline')}</span>
        </button>
      </div>
      <label>
        {t('originalTextLabel')}
        <textarea
          rows={2}
          value={draftText}
          onChange={event => setDraftText(event.target.value)}
          placeholder={t('originalTextPlaceholder')}
        />
      </label>
      <label>
        {t('noteLabel')}
        <textarea
          ref={noteInputRef}
          rows={3}
          value={draftNote}
          onChange={event => setDraftNote(event.target.value)}
          onKeyDown={event => saveNoteOnEnter(event, save)}
          placeholder={t('notePlaceholder')}
        />
      </label>
      <label>
        {t('tagsLabel')}
        <input
          value={draftTags}
          onChange={event => setDraftTags(event.target.value)}
          placeholder={t('tagsPlaceholder')}
        />
      </label>
      {frequentTags.length ? (
        <div className="tag-suggestions">
          {frequentTags.map(tag => (
            <button
              type="button"
              key={tag}
              className={`tag-chip${activeTags.includes(tag) ? ' active' : ''}`}
              onClick={() => toggleSuggestedTag(tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      ) : null}
      <div className="selection-note-actions">
        <button className="secondary-button" onClick={onCancel}>{t('cancel')}</button>
        <button className="primary-button" onClick={save} disabled={!canSave}>{t('save')}</button>
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
  const { t } = useI18n();
  return (
    <div
      className="selection-toolbar annotation-inline-actions"
      onClick={event => event.stopPropagation()}
      onMouseDown={event => event.stopPropagation()}
      onPointerDown={event => event.stopPropagation()}
    >
      <button className="toolbar-pill-button" onClick={onEdit}>
        <IconEdit size={13} />
        <span>{t('edit')}</span>
      </button>
      <button className="toolbar-pill-button danger-ghost-button" onClick={onDelete}>
        <IconTrash size={13} />
        <span>{t('delete')}</span>
      </button>
    </div>
  );
}

export function SelectionToolbar() {
  const context = React.useContext(SelectionToolbarContext);
  const { t } = useI18n();
  if (!context) {
    return null;
  }
  const {
    selectedText,
    isAreaSelection,
    translationSourceText,
    translationText,
    wordDetails,
    frequentTags,
    annotationsEnabled,
    translationEnabled,
    wordbookEnabled,
    onHighlight,
    onUnderline,
    onSaveNote,
    onTranslate,
    onSaveWord,
    onCopyForAi
  } = context;
  const [selColor, setSelColor] = useState('#ffd654');
  const [activeEditor, setActiveEditor] = useState<'note' | 'translation' | undefined>();
  const [noteText, setNoteText] = useState('');
  const [noteTags, setNoteTags] = useState('');
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setActiveEditor(undefined);
    setNoteText('');
    setNoteTags('');
  }, [selectedText, isAreaSelection]);

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
    onSaveNote(trimmed, selColor, normalizeTags(noteTags));
    setNoteText('');
    setNoteTags('');
    setActiveEditor(undefined);
  }

  function translate() {
    setActiveEditor('translation');
    onTranslate();
  }

  function toggleSuggestedTag(tag: string) {
    const current = normalizeTags(noteTags);
    const next = current.includes(tag)
      ? current.filter(item => item !== tag)
      : [...current, tag];
    setNoteTags(next.join(', '));
  }

  const hasCurrentResult = translationSourceText === selectedText.trim();
  const isLoading = hasCurrentResult && translationText === 'Translating...';
  const currentWordDetails = hasCurrentResult ? wordDetails : undefined;
  const currentTranslation = hasCurrentResult ? translationText : '';
  const activeNoteTags = normalizeTags(noteTags);

  if (!annotationsEnabled && !translationEnabled && !selectedText.trim()) {
    return null;
  }

  return (
    <div
      className={`selection-toolbar${activeEditor ? ' expanded' : ''}`}
      onClick={event => event.stopPropagation()}
      onMouseDown={event => event.stopPropagation()}
      onPointerDown={event => event.stopPropagation()}
    >
      <div className="selection-toolbar-row">
        {annotationsEnabled ? (
          <>
            <div className="swatch-group">
              {colorOptions.map(c => (
                <button
                  key={c.value}
                  className={`swatch${selColor === c.value ? ' active' : ''}`}
                  style={{ background: c.value }}
                  title={`${t('highlightAction')} · ${t(c.labelKey)}`}
                  aria-label={`${t('highlightAction')} ${t(c.labelKey)}`}
                  onClick={() => {
                    setSelColor(c.value);
                    if (activeEditor !== 'note') {
                      onHighlight(c.value);
                    }
                  }}
                />
              ))}
            </div>
            {!isAreaSelection ? (
              <button
                className="toolbar-pill-button"
                title={t('underlineAction')}
                aria-label={t('underlineAction')}
                onClick={() => onUnderline(selColor)}
              >
                <IconUnderline size={13} />
              </button>
            ) : null}
            <button
              className={`toolbar-pill-button${activeEditor === 'note' ? ' active-command' : ''}`}
              title={t('noteAction')}
              onClick={() => setActiveEditor(activeEditor === 'note' ? undefined : 'note')}
            >
              <IconNote size={13} />
              <span>{t('noteAction')}</span>
            </button>
          </>
        ) : null}
        {annotationsEnabled && (translationEnabled || selectedText.trim()) ? (
          <span className="toolbar-mini-divider" />
        ) : null}
        {translationEnabled && !isAreaSelection ? (
          <button
            className={`toolbar-pill-button${activeEditor === 'translation' ? ' active-command' : ''}`}
            title={t('translateAction')}
            onClick={translate}
          >
            <IconTranslate size={13} />
            <span>{t('translateAction')}</span>
          </button>
        ) : null}
        {selectedText.trim() && !isAreaSelection ? (
          <button
            className="toolbar-pill-button"
            title={t('copyForAiAction')}
            onClick={onCopyForAi}
          >
            <IconSparkles size={13} />
            <span>{t('copyForAiAction')}</span>
          </button>
        ) : null}
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
            placeholder={t('notePlaceholder')}
            rows={3}
          />
          <input
            className="selection-tags-input"
            value={noteTags}
            onChange={event => setNoteTags(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault();
                saveNote();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                setActiveEditor(undefined);
              }
            }}
            placeholder={`${t('tagsLabel')}: ${t('tagsPlaceholder')}`}
          />
          {frequentTags.length ? (
            <div className="tag-suggestions">
              {frequentTags.map(tag => (
                <button
                  type="button"
                  key={tag}
                  className={`tag-chip${activeNoteTags.includes(tag) ? ' active' : ''}`}
                  onClick={() => toggleSuggestedTag(tag)}
                >
                  #{tag}
                </button>
              ))}
            </div>
          ) : null}
          <div className="selection-note-actions">
            <button className="secondary-button" onClick={() => setActiveEditor(undefined)}>{t('cancel')}</button>
            <button className="primary-button" onClick={saveNote} disabled={!noteText.trim()}>{t('save')}</button>
          </div>
        </div>
      ) : null}
      {activeEditor === 'translation' ? (
        <div className="selection-translation-result">
          {isLoading ? <div className="selection-result-status">{t('lookingUp')}</div> : null}
          {!isLoading && currentWordDetails ? (
            <>
              <WordDetailsBlock details={currentWordDetails} />
              <div className="selection-note-actions">
                {wordbookEnabled ? (
                  <button className="primary-button" onClick={() => onSaveWord(currentWordDetails)}>
                    {t('saveToWordbook')}
                  </button>
                ) : null}
                <button className="secondary-button" onClick={() => setActiveEditor(undefined)}>
                  {t('close')}
                </button>
              </div>
            </>
          ) : null}
          {!isLoading && !currentWordDetails && currentTranslation ? (
            <>
              <p className="selection-translation-text">{currentTranslation}</p>
              <div className="selection-note-actions">
                <button className="secondary-button" onClick={() => setActiveEditor(undefined)}>
                  {t('close')}
                </button>
              </div>
            </>
          ) : null}
          {!isLoading && !currentWordDetails && !currentTranslation ? (
            <div className="selection-result-status">{t('noTranslationResult')}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function annotationStatus(
  shown: number,
  total: number,
  t?: (key: 'annotationsCountZero' | 'annotationsCountSingular' | 'annotationsCountPlural' | 'annotationsCountFiltered', vars?: Record<string, string | number>) => string
) {
  if (t) {
    if (!total) return t('annotationsCountZero');
    if (shown === total) {
      return total === 1
        ? t('annotationsCountSingular')
        : t('annotationsCountPlural', { count: total });
    }
    return t('annotationsCountFiltered', { shown, total });
  }
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

function highlightWordInSentence(sentence: string, word: string): React.ReactNode {
  const cleanWord = word.trim();
  if (!cleanWord) return sentence;
  const escaped = cleanWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = sentence.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, index) => (
    part.toLowerCase() === cleanWord.toLowerCase()
      ? <mark key={index} className="word-sentence-mark">{part}</mark>
      : part
  ));
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
