import React from 'react';
import type { EvidenceLocator, PaperComparison } from '../types';

const comparisonStatusLabels: Record<string, string> = {
  evidenced: '有证据',
  inferred: '推断',
  conflicting: '冲突',
  unknown: '未知'
};

const comparisonDimensionLabels: Record<string, string> = {
  'research-question': '研究问题与任务',
  assumptions: '假设与适用范围',
  embodiment: '机器人、末端执行器与传感器',
  method: '输入、模型与控制输出',
  data: '训练与评估数据',
  evaluation: '数据集、基线、指标与规模',
  'evidence-boundary': '仿真、台架与真实机器人证据',
  failures: '消融与失败案例',
  artifacts: '代码、数据、权重与许可证',
  reproduction: '复现要求与已知限制'
};

export function ComparisonView({
  comparison,
  onBack,
  onClose,
  onExport,
  onAnalyze,
  onFocusEvidence
}: {
  comparison: PaperComparison;
  onBack(): void;
  onClose(): void;
  onExport(): void;
  onAnalyze(): void;
  onFocusEvidence(locator: EvidenceLocator): void;
}) {
  const statusCounts = comparison.cells.reduce<Record<string, number>>((counts, cell) => {
    counts[cell.status] = (counts[cell.status] || 0) + 1;
    return counts;
  }, {});
  const sourceMissingCount = comparison.cells.filter(cell => cell.sourceMissing).length;
  const comparisonTitle = comparison.title.replace(/^Paper comparison \((\d+)\)$/, '论文比较（$1 篇）');

  return (
    <section className="workspace-overlay comparison-workspace" role="dialog" aria-modal="true" aria-label="跨论文比较">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">研究工作区 / 跨论文比较</p>
          <h1>{comparisonTitle}</h1>
          <p className="workspace-subtitle">每个值都保留证据状态；未知与冲突单元格不会被隐藏。</p>
        </div>
        <div className="actions">
          <button className="secondary-button" onClick={onBack}>返回文库</button>
          <button className="secondary-button" onClick={onExport}>导出数据</button>
          <button onClick={onAnalyze}>使用 Codex 分析</button>
          <button className="secondary-button" onClick={onClose}>返回论文</button>
        </div>
      </header>
      <div className="comparison-summary" aria-label="比较证据概览">
        <div><span>论文</span><strong>{comparison.papers.length}</strong></div>
        <div><span>维度</span><strong>{comparison.dimensions.length}</strong></div>
        <div className="summary-evidenced"><span>有证据</span><strong>{statusCounts.evidenced || 0}</strong></div>
        <div className="summary-inferred"><span>推断</span><strong>{statusCounts.inferred || 0}</strong></div>
        <div className="summary-conflicting"><span>冲突</span><strong>{statusCounts.conflicting || 0}</strong></div>
        <div><span>未知</span><strong>{statusCounts.unknown || 0}</strong><small>{sourceMissingCount ? `${sourceMissingCount} 项来源缺失` : '来源完整'}</small></div>
      </div>
      <div className="comparison-scroll">
        <table className="comparison-table">
          <thead><tr><th>比较维度</th>{comparison.papers.map(paper => <th key={paper.fingerprint}>{paper.title}</th>)}</tr></thead>
          <tbody>
            {comparison.dimensions.map(dimension => (
              <tr key={dimension.id}>
                <th>{comparisonDimensionLabels[dimension.id] || dimension.label}</th>
                {comparison.papers.map(paper => {
                  const cell = comparison.cells.find(candidate =>
                    candidate.dimensionId === dimension.id && candidate.paperFingerprint === paper.fingerprint
                  );
                  const locator = firstLocator(cell);
                  return (
                    <td key={paper.fingerprint} className={`comparison-${cell?.status || 'unknown'}`}>
                      <span className="comparison-status">{comparisonStatusLabels[cell?.status || 'unknown']}</span>
                      {cell?.sourceMissing ? <strong className="source-missing">来源缺失</strong> : null}
                      <p>{!cell?.value || cell.value === 'unknown' ? '未知' : cell.value}</p>
                      {locator ? <button onClick={() => onFocusEvidence(locator)}>打开证据 · 第 {locator.page} 页</button> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function firstLocator(cell: PaperComparison['cells'][number] | undefined) {
  for (const ref of cell?.evidenceRefs || []) {
    if (ref.type === 'locator') return ref.locator;
    if (ref.type === 'fact' && ref.locator) return ref.locator;
  }
  return undefined;
}
