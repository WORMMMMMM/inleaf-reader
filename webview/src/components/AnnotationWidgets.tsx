import React, { useEffect, useRef, useState } from 'react';
import { normalizeTags } from '../annotationModel';
import {
  getReaderActions,
  type ReaderActionContext,
  type ReaderActionId,
  type ReaderActionOptions
} from '../readerActions';
import type { AnnotationKind, AnnotationRecord, WordDetails, WordRecord } from '../types';
import { AskCodexActions } from './AskCodexActions';

export interface SelectionToolbarContextValue {
  selectedText: string;
  translationSourceText: string;
  translationText: string;
  wordDetails?: WordDetails;
  actionContext: ReaderActionContext;
  onInvoke(actionId: ReaderActionId, options?: ReaderActionOptions): void;
  onCancelTranslation(): void;
  onSaveWord(details: WordDetails): void;
}

export const SelectionToolbarContext = React.createContext<SelectionToolbarContextValue | undefined>(undefined);

export const colorOptions = [
  { label: '黄色', value: '#ffd654' },
  { label: '蓝色', value: '#8fd3ff' },
  { label: '绿色', value: '#a6e99f' },
  { label: '红色', value: '#ffaaa5' },
  { label: '紫色', value: '#d7b8ff' }
];

export function AnnotationItem({
  annotation,
  active,
  onFocus,
  onEdit,
  onCopy,
  onResearch,
  onDelete
}: {
  annotation: AnnotationRecord;
  active: boolean;
  onFocus(): void;
  onEdit(): void;
  onCopy(): void;
  onResearch(): void;
  onDelete(): void;
}) {
  return (
    <article className={`item annotation-item${active ? ' active-item' : ''}`} onClick={onFocus}>
      <strong>第 {annotation.page || annotation.highlighterPosition?.boundingRect.pageNumber || '-'} 页</strong>
      <p>{shorten(annotation.selectedText || annotation.note || '页面笔记', 220)}</p>
      {annotation.note ? <p className="note">{shorten(annotation.note, 180)}</p> : null}
      {annotation.tags?.length ? <div className="annotation-tags">{annotation.tags.map(tag => <span key={tag}>#{tag}</span>)}</div> : null}
      <div className="annotation-actions">
        <button onClick={stopThen(onFocus)}>跳转</button>
        <button onClick={stopThen(onEdit)}>编辑</button>
        <button onClick={stopThen(onCopy)}>复制 MD</button>
        <button onClick={stopThen(onResearch)}>作为证据</button>
        <button onClick={stopThen(onDelete)}>删除</button>
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
      <span>{highlights} 条高亮</span>
      <span>{underlines} 条下划线</span>
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
        <button className="danger-button" onClick={onDelete}>删除</button>
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
      <div className="annotation-inline-title">编辑标注</div>
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
          高亮
        </button>
        <button
          className={draftKind === 'underline' ? 'active-command' : ''}
          onClick={() => setDraftKind('underline')}
        >
          下划线
        </button>
      </div>
      <label>
        原文
        <textarea
          rows={2}
          value={draftText}
          onChange={event => setDraftText(event.target.value)}
          placeholder="PDF 中选中的文本"
        />
      </label>
      <label>
        笔记
        <textarea
          ref={noteInputRef}
          rows={3}
          value={draftNote}
          onChange={event => setDraftNote(event.target.value)}
          placeholder="写下笔记……"
        />
      </label>
      <label>
        标签
        <input
          value={draftTags}
          onChange={event => setDraftTags(event.target.value)}
          placeholder="方法、问题、待办"
        />
      </label>
      <div className="selection-note-actions">
        <button onClick={onCancel}>取消</button>
        <button onClick={save} disabled={!canSave}>保存</button>
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
      <button onClick={onEdit}>编辑</button>
      <button className="danger-button" onClick={onDelete}>删除</button>
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
    actionContext,
    onInvoke,
    onCancelTranslation,
    onSaveWord
  } = context;
  const [selColor, setSelColor] = useState('#ffd654');
  const [activeEditor, setActiveEditor] = useState<'note' | 'translation' | 'codex' | undefined>();
  const [compactActions, setCompactActions] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [noteText, setNoteText] = useState('');
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setActiveEditor(undefined);
    setNoteText('');
    setShowMore(false);
  }, [selectedText]);

  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    const update = () => setCompactActions(toolbar.clientWidth < 300);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, []);

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
    onInvoke('inleafReader.action.note', { note: trimmed, color: selColor });
    setNoteText('');
    setActiveEditor(undefined);
  }

  function translate() {
    setActiveEditor('translation');
    onInvoke('inleafReader.action.translate');
  }

  const actions = getReaderActions(actionContext, 'selection-primary');
  const compactPrimaryIds = new Set<ReaderActionId>([
    'inleafReader.action.highlight',
    'inleafReader.action.note',
    'inleafReader.action.translate'
  ]);
  const visibleActions = compactActions
    ? actions.filter(action => compactPrimaryIds.has(action.definition.id))
    : actions;
  const moreActions = compactActions
    ? actions.filter(action => !compactPrimaryIds.has(action.definition.id))
    : [];

  function actionButton({ definition, available, disabledReason }: typeof actions[number]) {
    return (
      <button
        key={definition.id}
        className={definition.editor && activeEditor === definition.editor ? 'active-command' : ''}
        disabled={!available}
        title={disabledReason || definition.label}
        onClick={() => {
          if (definition.id === 'inleafReader.action.highlight' || definition.id === 'inleafReader.action.underline') {
            onInvoke(definition.id, { color: selColor });
          } else if (definition.id === 'inleafReader.action.note') {
            setActiveEditor(activeEditor === 'note' ? undefined : 'note');
          } else if (definition.id === 'inleafReader.action.translate') {
            translate();
          } else if (definition.id === 'inleafReader.action.askCodex') {
            setActiveEditor(activeEditor === 'codex' ? undefined : 'codex');
          }
          setShowMore(false);
        }}
      >
        {definition.label}
      </button>
    );
  }

  const hasCurrentResult = translationSourceText === selectedText.trim();
  const isLoading = hasCurrentResult && translationText === '正在翻译……';
  const currentWordDetails = hasCurrentResult ? wordDetails : undefined;
  const currentTranslation = hasCurrentResult ? translationText : '';

  return (
    <div
      ref={toolbarRef}
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
        {visibleActions.map(actionButton)}
        {moreActions.length ? (
          <button className={showMore ? 'active-command' : ''} onClick={() => setShowMore(value => !value)}>更多</button>
        ) : null}
      </div>
      {showMore ? <div className="selection-toolbar-row selection-more-actions">{moreActions.map(actionButton)}</div> : null}
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
            placeholder="写下笔记……"
            rows={3}
          />
          <div className="selection-note-actions">
            <button onClick={() => setActiveEditor(undefined)}>取消</button>
            <button onClick={saveNote} disabled={!noteText.trim()}>保存</button>
          </div>
        </div>
      ) : null}
      {activeEditor === 'translation' ? (
        <div className="selection-translation-result">
          {isLoading ? (
            <div className="selection-result-status">
              正在查询…… <button onClick={onCancelTranslation}>取消</button>
            </div>
          ) : null}
          {!isLoading && currentWordDetails ? (
            <>
              <WordDetailsBlock details={currentWordDetails} />
              <div className="selection-note-actions">
                <button onClick={() => onSaveWord(currentWordDetails)}>保存到生词本</button>
                <button onClick={() => setActiveEditor(undefined)}>关闭</button>
              </div>
            </>
          ) : null}
          {!isLoading && !currentWordDetails && currentTranslation ? (
            <>
              <p className="selection-translation-text">{currentTranslation}</p>
              <div className="selection-note-actions">
                <button onClick={() => setActiveEditor(undefined)}>关闭</button>
              </div>
            </>
          ) : null}
          {!isLoading && !currentWordDetails && !currentTranslation ? (
            <div className="selection-result-status">暂无结果。</div>
          ) : null}
        </div>
      ) : null}
      {activeEditor === 'codex' ? (
        <AskCodexActions
          onAsk={question => {
            onInvoke('inleafReader.action.askCodex', { question });
            setActiveEditor(undefined);
          }}
          onClose={() => setActiveEditor(undefined)}
        />
      ) : null}
    </div>
  );
}

export function annotationStatus(shown: number, total: number) {
  if (!total) {
    return '0 条标注';
  }
  return shown === total ? `${total} 条标注` : `显示 ${shown} / ${total} 条标注`;
}
function shorten(value: string, max: number) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized;
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
