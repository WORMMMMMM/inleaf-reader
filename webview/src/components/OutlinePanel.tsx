import React, { useMemo, useState } from 'react';
import { useI18n } from '../i18nContext';
import { findActiveOutlineId, type PdfOutlineNode } from '../pdfOutline';
import { IconChevronDown, IconChevronRight } from './Icons';

export function OutlinePanel({
  items,
  loading,
  currentPage,
  onSelectPage
}: {
  items: PdfOutlineNode[];
  loading: boolean;
  currentPage: number;
  onSelectPage(page: number): void;
}) {
  const { t } = useI18n();
  const [filter, setFilter] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const activeId = useMemo(() => findActiveOutlineId(items, currentPage), [items, currentPage]);
  const filtered = useMemo(() => filterOutlineTree(items, filter.trim().toLowerCase()), [items, filter]);

  function toggleNode(id: string) {
    setCollapsed(current => ({ ...current, [id]: !current[id] }));
  }

  return (
    <section className="side-tab-panel outline-panel">
      <div className="panel-section-head">
        <h2>{t('outlineTitle')}</h2>
      </div>
      {items.length > 0 ? (
        <input
          type="search"
          className="compact-input"
          value={filter}
          placeholder={t('outlineFilterPlaceholder')}
          onChange={event => setFilter(event.target.value)}
        />
      ) : null}
      {loading ? (
        <div className="empty compact-empty">{t('outlineLoading')}</div>
      ) : !items.length ? (
        <div className="empty compact-empty">{t('outlineEmpty')}</div>
      ) : !filtered.length ? (
        <div className="empty compact-empty">{t('outlineNoMatch')}</div>
      ) : (
        <ul className="outline-tree" role="tree">
          {filtered.map(node => (
            <OutlineBranch
              key={node.id}
              node={node}
              depth={0}
              activeId={activeId}
              collapsed={collapsed}
              forceExpand={!!filter.trim()}
              onToggle={toggleNode}
              onSelectPage={onSelectPage}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function OutlineBranch({
  node,
  depth,
  activeId,
  collapsed,
  forceExpand,
  onToggle,
  onSelectPage
}: {
  node: PdfOutlineNode;
  depth: number;
  activeId?: string;
  collapsed: Record<string, boolean>;
  forceExpand: boolean;
  onToggle(id: string): void;
  onSelectPage(page: number): void;
}) {
  const hasChildren = node.items.length > 0;
  const isCollapsed = !forceExpand && !!collapsed[node.id];
  const isActive = node.id === activeId;

  return (
    <li className="outline-branch" role="treeitem" aria-expanded={hasChildren ? !isCollapsed : undefined}>
      <div
        className={`outline-row${isActive ? ' active' : ''}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {hasChildren ? (
          <button
            className="outline-caret icon-button"
            onClick={() => onToggle(node.id)}
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? <IconChevronRight size={12} /> : <IconChevronDown size={12} />}
          </button>
        ) : (
          <span className="outline-caret-spacer" />
        )}
        <button
          className="outline-link"
          disabled={node.pageNumber === undefined}
          onClick={() => {
            if (node.pageNumber !== undefined) {
              onSelectPage(node.pageNumber);
            }
          }}
        >
          <span className="outline-title">{node.title}</span>
          {node.pageNumber !== undefined ? (
            <span className="outline-page">{node.pageNumber}</span>
          ) : null}
        </button>
      </div>
      {hasChildren && !isCollapsed ? (
        <ul className="outline-tree">
          {node.items.map(child => (
            <OutlineBranch
              key={child.id}
              node={child}
              depth={depth + 1}
              activeId={activeId}
              collapsed={collapsed}
              forceExpand={forceExpand}
              onToggle={onToggle}
              onSelectPage={onSelectPage}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function filterOutlineTree(nodes: PdfOutlineNode[], query: string): PdfOutlineNode[] {
  if (!query) return nodes;
  const result: PdfOutlineNode[] = [];
  for (const node of nodes) {
    const childMatches = filterOutlineTree(node.items, query);
    if (node.title.toLowerCase().includes(query) || childMatches.length) {
      result.push({ ...node, items: childMatches });
    }
  }
  return result;
}
