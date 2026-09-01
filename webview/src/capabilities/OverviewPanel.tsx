import React from 'react';

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
  return (
    <section className="side-tab-panel">
      <div className="overview-grid">
        <Metric label="Page" value={`${currentPage} / ${pageTotal || '-'}`} />
        <Metric label="Annotations" value={annotationCount} />
        <Metric label="Words" value={wordCount} />
      </div>
      <section className="tool-block">
        <h2>Status</h2>
        <div className="empty compact-empty">{status}</div>
      </section>
      <section className="tool-block">
        <h2>Current selection</h2>
        {selectedText.trim()
          ? <p className="selection-preview">{shorten(selectedText, 260)}</p>
          : <div className="empty compact-empty">Select text in the PDF to act on it.</div>}
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
