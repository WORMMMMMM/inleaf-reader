import React, { useMemo, useState } from 'react';
import { WordItem } from '../../components/AnnotationWidgets';
import { IconDownload } from '../../components/Icons';
import { useI18n } from '../../i18nContext';
import type { WordRecord } from '../../types';

export interface WordbookPanelProps {
  words: WordRecord[];
  onDelete(id: string): void;
  onUpdateNote(id: string, note: string): void;
  onJumpPage(page: number): void;
  onExportMarkdown(): void;
  onExportCsv(): void;
}

export function WordbookPanel({
  words,
  onDelete,
  onUpdateNote,
  onJumpPage,
  onExportMarkdown,
  onExportCsv
}: WordbookPanelProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return words;
    return words.filter(item => [
      item.word,
      item.phonetic,
      item.translation,
      item.sentence,
      item.note,
      ...(item.definitions || []).map(def => `${def.pos} ${def.meaning} ${def.translation || ''}`)
    ].join(' ').toLowerCase().includes(needle));
  }, [query, words]);

  return (
    <section className="side-tab-panel list-block">
      <div className="panel-section-head">
        <h2>{t('savedWords')} ({words.length})</h2>
        {words.length > 0 ? (
          <div className="compact-header-actions">
            <button
              className="secondary-button compact-action-button"
              title={t('exportWordbookMd')}
              onClick={onExportMarkdown}
            >
              <IconDownload size={12} />
              <span>MD</span>
            </button>
            <button
              className="secondary-button compact-action-button"
              title={t('exportWordbookCsv')}
              onClick={onExportCsv}
            >
              <IconDownload size={12} />
              <span>CSV</span>
            </button>
          </div>
        ) : null}
      </div>

      {words.length > 0 ? (
        <input
          type="search"
          className="compact-input"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder={t('searchWordsPlaceholder')}
        />
      ) : null}

      {filtered.length ? (
        <div className="list">
          {filtered.map(item => (
            <WordItem
              key={item.id}
              word={item}
              onDelete={() => onDelete(item.id)}
              onJumpPage={onJumpPage}
              onUpdateNote={note => onUpdateNote(item.id, note)}
            />
          ))}
        </div>
      ) : (
        <div className="empty compact-empty">
          {words.length > 0 ? t('noWordsMatched') : t('noWordsYet')}
        </div>
      )}
    </section>
  );
}
