import React, { useState } from 'react';
import type { ResearchProfile } from '../types';

const relationshipOptions = [
  { value: 'official implementation', label: '官方实现' },
  { value: 'dataset', label: '数据集' },
  { value: 'community reproduction', label: '社区复现' },
  { value: 'related work', label: '相关工作' }
];

function relationshipLabel(value: string) {
  return relationshipOptions.find(option => option.value === value)?.label || value;
}

export function RepositoryPanel({
  profile,
  onAdd,
  onClone,
  onChooseCheckout,
  onRefresh,
  onAnalyze,
  onDelete
}: {
  profile: ResearchProfile;
  onAdd(url: string, relationship: string): void;
  onClone(id: string): void;
  onChooseCheckout(id: string): void;
  onRefresh(id: string): void;
  onAnalyze(id: string): void;
  onDelete(id: string): void;
}) {
  const [url, setUrl] = useState('');
  const [relationship, setRelationship] = useState('official implementation');
  const repositories = profile.artifacts.filter(artifact =>
    artifact.type === 'github' || artifact.type === 'git_repository'
  );

  return (
    <section className="side-tab-panel repository-panel">
      <section className="tool-block">
        <h2>关联代码仓库</h2>
        <label>仓库地址<input value={url} onChange={event => setUrl(event.target.value)} placeholder="https://github.com/org/repo" /></label>
        <label>
          与论文的关系
          <select value={relationship} onChange={event => setRelationship(event.target.value)}>
            {relationshipOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <button
          disabled={!url.trim()}
          onClick={() => {
            onAdd(url.trim(), relationship);
            setUrl('');
          }}
        >
          添加已确认链接
        </button>
      </section>

      <section className="tool-block">
        <h2>代码仓库（{repositories.length}）</h2>
        <div className="list">
          {repositories.length ? repositories.map(artifact => (
            <article className="item repository-item" key={artifact.id}>
              <strong>{relationshipLabel(artifact.relationship)}</strong>
              <p className="repository-url">{artifact.url}</p>
              {artifact.localCheckout ? (
                <dl className="meta-list">
                  <div><dt>提交</dt><dd>{artifact.localCheckout.commit || '未知'}</dd></div>
                  <div><dt>分支</dt><dd>{artifact.localCheckout.branch || '游离 / 未知'}</dd></div>
                  <div><dt>工作区</dt><dd>{artifact.localCheckout.dirty ? '有未提交修改' : '干净'}</dd></div>
                  <div><dt>许可证</dt><dd>{artifact.license || '未找到'}</dd></div>
                </dl>
              ) : <div className="empty compact-empty">暂无本地提交快照。</div>}
              <div className="annotation-actions">
                <button onClick={() => onChooseCheckout(artifact.id)}>选择本地仓库</button>
                <button onClick={() => onClone(artifact.id)}>克隆……</button>
                {artifact.localCheckout ? (
                  <>
                    <button onClick={() => onRefresh(artifact.id)}>刷新快照</button>
                    <button onClick={() => onAnalyze(artifact.id)}>使用 Codex 分析</button>
                  </>
                ) : null}
                <button className="danger-button" onClick={() => onDelete(artifact.id)}>移除链接</button>
              </div>
            </article>
          )) : <div className="empty">尚未关联代码仓库。</div>}
        </div>
      </section>
    </section>
  );
}
