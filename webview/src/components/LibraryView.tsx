import React, { useMemo, useState } from 'react';
import type { LibraryIndexData, LibraryPaper } from '../types';

export function LibraryView({
  indexes,
  onClose,
  onChooseRoot,
  onRefresh,
  onCompare
}: {
  indexes: LibraryIndexData[];
  onClose(): void;
  onChooseRoot(): void;
  onRefresh(rootPath: string): void;
  onCompare(papers: LibraryPaper[]): void;
}) {
  const [query, setQuery] = useState('');
  const [tagQuery, setTagQuery] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const allPapers = useMemo(() => indexes.flatMap(index => index.papers), [indexes]);
  const papers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const tags = tagQuery.split(/[,\s]+/).map(tag => tag.trim().toLowerCase()).filter(Boolean);
    return allPapers.filter(paper => {
      const searchable = `${paper.title} ${paper.year || ''} ${paper.tags.join(' ')}`.toLowerCase();
      const paperTags = paper.tags.map(tag => tag.toLowerCase());
      return (!needle || searchable.includes(needle)) && tags.every(tag => paperTags.includes(tag));
    });
  }, [allPapers, query, tagQuery]);
  const selectedPapers = allPapers.filter(paper => selected[paper.fingerprint]);
  const repositoryCount = allPapers.reduce((total, paper) => total + paper.repositoryCount, 0);
  const tagCount = new Set(allPapers.flatMap(paper => paper.tags.map(tag => tag.toLowerCase()))).size;

  return (
    <section className="workspace-overlay" role="dialog" aria-modal="true" aria-label="Inleaf 论文文库">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">研究工作区 / 论文文库</p>
          <h1>论文文库</h1>
          <p className="workspace-subtitle">检索结构化侧车数据、选择论文，并开始保留证据状态的跨论文比较。</p>
        </div>
        <div className="actions"><button onClick={onChooseRoot}>添加文库目录</button><button className="secondary-button" onClick={onClose}>返回论文</button></div>
      </header>
      <div className="workspace-metrics" aria-label="文库概览">
        <div><span>已索引论文</span><strong>{allPapers.length}</strong><small>来自 {indexes.length} 个目录</small></div>
        <div><span>代码仓库</span><strong>{repositoryCount}</strong><small>已关联的研究工件</small></div>
        <div><span>分类标签</span><strong>{tagCount}</strong><small>已确认的文库词汇</small></div>
        <div><span>已选择</span><strong>{selectedPapers.length}</strong><small>{selectedPapers.length >= 2 ? '可以开始比较' : '请至少选择 2 篇论文'}</small></div>
      </div>
      <div className="library-controls">
        <label><span>搜索</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="标题、年份或标签" /></label>
        <label><span>必需标签</span><input type="search" value={tagQuery} onChange={event => setTagQuery(event.target.value)} placeholder="机器人、触觉、操作" /></label>
        <button disabled={selectedPapers.length < 2} onClick={() => onCompare(selectedPapers)}>
          比较所选论文（{selectedPapers.length}）
        </button>
      </div>
      {indexes.map(index => (
        <div className="library-root" key={index.rootPath}>
          <div><strong>{index.rootPath}</strong><span>{index.papers.length} 篇论文 · 索引于 {formatDate(index.generatedAt)}</span></div>
          <button onClick={() => onRefresh(index.rootPath)}>刷新</button>
        </div>
      ))}
      {indexes.flatMap(index => index.warnings).length ? (
        <details className="library-warnings"><summary>索引警告</summary><ul>{indexes.flatMap(index => index.warnings).map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>
      ) : null}
      <div className="library-grid">
        {papers.map(paper => (
          <label className="library-paper" key={`${paper.fingerprint}-${paper.pdfPath}`}>
            <input
              type="checkbox"
              checked={!!selected[paper.fingerprint]}
              onChange={event => setSelected(current => ({ ...current, [paper.fingerprint]: event.target.checked }))}
            />
            <span>
              <span className="library-paper-meta"><small>{paper.year || '年份未知'}</small><small>{paper.repositoryCount} 个仓库</small></span>
              <strong>{paper.title}</strong>
              <span className="library-paper-tags">
                {paper.tags.length ? paper.tags.map(tag => <small key={tag}>{tag}</small>) : <small>暂无已确认标签</small>}
              </span>
            </span>
          </label>
        ))}
        {!papers.length ? <div className="empty">请选择并索引一个论文文库目录。</div> : null}
      </div>
    </section>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) || date.valueOf() === 0 ? '尚未建立' : date.toLocaleString('zh-CN');
}
