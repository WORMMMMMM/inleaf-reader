import React from 'react';
import { useI18n } from '../i18nContext';

export function OverviewPanel({
  currentPage,
  pageTotal,
  annotationCount,
  wordCount,
  status,
  selectedText
}: {
  currentPage: number;
  pageTotal: number;
  annotationCount: number;
  wordCount: number;
  status: string;
  selectedText: string;
}) {
  const { t } = useI18n();
  const isMac = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
  const progressPercent = pageTotal > 0
    ? `${Math.min(100, Math.max(0, Math.round((currentPage / pageTotal) * 100)))}%`
    : '—';

  return (
    <section className="side-tab-panel">
      <div className="overview-grid">
        <Metric label={t('metricPage')} value={`${currentPage} / ${pageTotal || '-'}`} />
        <Metric label={t('metricProgress')} value={progressPercent} />
        <Metric label={t('metricAnnotations')} value={annotationCount} />
        <Metric label={t('metricWords')} value={wordCount} />
      </div>

      <section className="tool-block">
        <h2>{t('sectionStatus')}</h2>
        <div className="empty compact-empty">{status}</div>
      </section>

      <section className="tool-block">
        <h2>{t('sectionSelection')}</h2>
        {selectedText.trim()
          ? <p className="selection-preview">{shorten(selectedText, 260)}</p>
          : <div className="empty compact-empty">{t('selectToAct')}</div>}
      </section>

      <section className="tool-block">
        <h2>{t('sectionTips')}</h2>
        <ul className="tips-list">
          <li><kbd>{isMac ? '⌘ F' : 'Ctrl F'}</kbd><span>{t('tipSearch')}</span></li>
          <li><kbd>{isMac ? `⌥ + ${t('dragAction')}` : `Alt + ${t('dragAction')}`}</kbd><span>{t('tipArea')}</span></li>
          <li><kbd>1 – 5</kbd><span>{t('tipQuickHighlight')}</span></li>
          <li><kbd>AI</kbd><span>{t('tipCopyAi')}</span></li>
        </ul>
      </section>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="metric-card"><span>{label}</span><strong>{value}</strong></div>;
}

function shorten(value: string, max: number) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized;
}
