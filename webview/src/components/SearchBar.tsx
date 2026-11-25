import React, { useEffect, useRef } from 'react';
import { useI18n } from '../i18nContext';
import { IconChevronDown, IconChevronUp, IconClose, IconSearch } from './Icons';

export function SearchBar({
  open,
  query,
  searching,
  matchCount,
  activeIndex,
  onQueryChange,
  onPrev,
  onNext,
  onClose
}: {
  open: boolean;
  query: string;
  searching: boolean;
  matchCount: number;
  activeIndex: number;
  onQueryChange(value: string): void;
  onPrev(): void;
  onNext(): void;
  onClose(): void;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const counterLabel = !query.trim()
    ? ''
    : searching
      ? t('searchIndexing')
      : matchCount > 0
        ? `${activeIndex + 1} / ${matchCount}`
        : t('searchNoMatches');

  return (
    <div
      className="pdf-search-bar"
      role="search"
      onPointerDown={event => event.stopPropagation()}
    >
      <IconSearch size={14} className="search-icon" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        placeholder={t('searchPlaceholder')}
        onChange={event => onQueryChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            if (event.shiftKey) {
              onPrev();
            } else {
              onNext();
            }
          } else if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
          }
        }}
      />
      {counterLabel ? (
        <span className={`search-counter${!searching && query.trim() && matchCount === 0 ? ' empty-match' : ''}`}>
          {counterLabel}
        </span>
      ) : null}
      <button
        className="icon-button"
        title={t('searchPrev')}
        aria-label={t('searchPrev')}
        disabled={matchCount === 0}
        onClick={onPrev}
      >
        <IconChevronUp size={14} />
      </button>
      <button
        className="icon-button"
        title={t('searchNext')}
        aria-label={t('searchNext')}
        disabled={matchCount === 0}
        onClick={onNext}
      >
        <IconChevronDown size={14} />
      </button>
      <button
        className="icon-button"
        title={t('searchClose')}
        aria-label={t('searchClose')}
        onClick={onClose}
      >
        <IconClose size={14} />
      </button>
    </div>
  );
}
