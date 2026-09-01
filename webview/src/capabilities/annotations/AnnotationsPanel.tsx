import React from 'react';
import {
  AnnotationItem,
  AnnotationSummary,
  annotationStatus,
  colorOptions
} from '../../components/AnnotationWidgets';
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
  canUndo: boolean;
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
}

export function AnnotationsPanel(props: AnnotationsPanelProps) {
  return (
    <section className="side-tab-panel list-block">
      <section className="tool-block">
        <h2>Saved Annotations</h2>
        <input type="search" value={props.query} onChange={event => props.onQuery(event.target.value)} placeholder="Search annotations" />
        <input type="search" value={props.tagQuery} onChange={event => props.onTagQuery(event.target.value)} placeholder="Filter by tag" />
        <select value={props.colorFilter} onChange={event => props.onColorFilter(event.target.value)}>
          <option value="">All colors</option>
          {colorOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select value={props.kindFilter} onChange={event => props.onKindFilter(event.target.value)}>
          <option value="">All styles</option>
          <option value="highlight">Highlight</option>
          <option value="underline">Underline</option>
        </select>
        <select value={props.sortMode} onChange={event => props.onSortMode(event.target.value as AnnotationSortMode)}>
          <option value="position">Sort by paper order</option>
          <option value="created">Sort by newest</option>
          <option value="updated">Sort by recently edited</option>
        </select>
        <div className="actions">
          <button onClick={props.onExportMarkdown}>Export Markdown</button>
          <button onClick={props.onExportPdf}>Export PDF</button>
        </div>
        {props.canUndo ? <button className="undo-button" onClick={props.onUndo}>Undo delete</button> : null}
        <div className="status-line">{annotationStatus(props.annotations.length, props.total)}</div>
        <AnnotationSummary annotations={props.annotations} />
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
            />
          )) : <div className="empty">No annotations saved yet.</div>}
        </div>
      </section>
    </section>
  );
}
