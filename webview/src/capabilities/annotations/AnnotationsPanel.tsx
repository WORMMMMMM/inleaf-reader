import React, { useEffect, useRef, useState } from 'react';
import {
  AnnotationItem,
  AnnotationSummary,
  annotationStatus,
  colorOptions
} from '../../components/AnnotationWidgets';
import { IconChevronDown, IconDownload, IconFilter, IconUndo } from '../../components/Icons';
import { useI18n } from '../../i18nContext';
import type { AnnotationSortMode } from '../../annotationModel';
import type { AnnotationRecord } from '../../types';

export interface AnnotationsPanelProps {
  annotations: AnnotationRecord[];
  total: number;
  activeId?: string;
  query: string;
  tagQuery: string;
  colorFilter: string;
  kindFilter: string;
  sortMode: AnnotationSortMode;
  undoCount: number;
  onQuery(value: string): void;
  onTagQuery(value: string): void;
  onColorFilter(value: string): void;
  onKindFilter(value: string): void;
  onSortMode(value: AnnotationSortMode): void;
  onFocus(annotation: AnnotationRecord): void;
  onEdit(annotation: AnnotationRecord): void;
  onCopy(annotation: AnnotationRecord): void;
  onDelete(annotation: AnnotationRecord): void;
  onUndo(): void;
  onExportMarkdown(): void;
  onExportPdf(): void;
  onOrganizeNotes(): void;
}

export function AnnotationsPanel(props: AnnotationsPanelProps) {
  const { t } = useI18n();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const hasActiveFilter = Boolean(props.tagQuery.trim() || props.colorFilter || props.kindFilter || props.sortMode !== 'position');

  useEffect(() => {
    if (!exportOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutside, true);
    return () => document.removeEventListener('pointerdown', closeOnOutside, true);
  }, [exportOpen]);

  function handleTagClick(tag: string) {
    props.onTagQuery(props.tagQuery.trim().toLowerCase() === tag.toLowerCase() ? '' : tag);
    setFiltersOpen(true);
  }

  return (
    <section className="side-tab-panel list-block">
      <div className="panel-section-head">
        <h2>{t('savedAnnotations')}</h2>
        <div className="export-dropdown" ref={exportMenuRef}>
          <button
            className="secondary-button compact-action-button"
            aria-expanded={exportOpen}
            onClick={() => setExportOpen(current => !current)}
          >
            <IconDownload size={13} />
            <span>{t('exportMenuLabel')}</span>
            <IconChevronDown size={12} />
          </button>
          {exportOpen ? (
            <div className="dropdown-menu" role="menu">
              <button
                role="menuitem"
                onClick={() => { setExportOpen(false); props.onOrganizeNotes(); }}
              >
                {t('organizeNotes')}
              </button>
              <button
                role="menuitem"
                onClick={() => { setExportOpen(false); props.onExportMarkdown(); }}
              >
                {t('exportMarkdown')}
              </button>
              <button
                role="menuitem"
                onClick={() => { setExportOpen(false); props.onExportPdf(); }}
              >
                {t('exportPdf')}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="panel-search-row">
        <input
          type="search"
          className="compact-input"
          value={props.query}
          onChange={event => props.onQuery(event.target.value)}
          placeholder={t('searchAnnotationsPlaceholder')}
        />
        <button
          className={`secondary-button filter-toggle-button${filtersOpen ? ' active' : ''}`}
          title={t('filterToggle')}
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen(current => !current)}
        >
          <IconFilter size={13} />
          {hasActiveFilter ? <span className="filter-dot" aria-hidden="true" /> : null}
        </button>
      </div>

      {filtersOpen ? (
        <div className="filter-drawer">
          <div className="color-filter-row" role="group" aria-label={t('allColors')}>
            <button
              className={`color-filter-all${!props.colorFilter ? ' active' : ''}`}
              onClick={() => props.onColorFilter('')}
            >
              {t('allColors')}
            </button>
            {colorOptions.map(option => (
              <button
                key={option.value}
                className={`swatch${props.colorFilter === option.value ? ' active' : ''}`}
                style={{ background: option.value }}
                title={t(option.labelKey)}
                aria-label={t(option.labelKey)}
                onClick={() => props.onColorFilter(props.colorFilter === option.value ? '' : option.value)}
              />
            ))}
          </div>
          <div className="filter-two-col">
            <select value={props.kindFilter} onChange={event => props.onKindFilter(event.target.value)}>
              <option value="">{t('allStyles')}</option>
              <option value="highlight">{t('styleHighlight')}</option>
              <option value="underline">{t('styleUnderline')}</option>
            </select>
            <select value={props.sortMode} onChange={event => props.onSortMode(event.target.value as AnnotationSortMode)}>
              <option value="position">{t('sortPaperOrder')}</option>
              <option value="created">{t('sortNewest')}</option>
              <option value="updated">{t('sortRecentEdit')}</option>
            </select>
          </div>
          <input
            type="search"
            className="compact-input"
            value={props.tagQuery}
            onChange={event => props.onTagQuery(event.target.value)}
            placeholder={t('filterTagPlaceholder')}
          />
        </div>
      ) : null}

      {props.undoCount > 0 ? (
        <button className="undo-button" onClick={props.onUndo}>
          <IconUndo size={13} />
          <span>{t('undoDelete')}{props.undoCount > 1 ? ` (${props.undoCount})` : ''}</span>
        </button>
      ) : null}

      <div className="status-row">
        <span className="status-line">{annotationStatus(props.annotations.length, props.total, t)}</span>
      </div>
      <AnnotationSummary annotations={props.annotations} onTagClick={handleTagClick} />

      <div className="list">
        {props.annotations.length ? props.annotations.map(annotation => (
          <AnnotationItem
            key={annotation.id}
            annotation={annotation}
            active={annotation.id === props.activeId}
            onFocus={() => props.onFocus(annotation)}
            onEdit={() => props.onEdit(annotation)}
            onCopy={() => props.onCopy(annotation)}
            onDelete={() => props.onDelete(annotation)}
            onTagClick={handleTagClick}
          />
        )) : (
          <div className="empty compact-empty">
            {props.total > 0 ? t('noAnnotationsMatched') : t('noAnnotationsYet')}
          </div>
        )}
      </div>
    </section>
  );
}
