import React, { useEffect, useState } from 'react';
import {
  classificationFields,
  parseList,
  relationSourceState,
  type ClassificationField
} from '../researchModel';
import type { AnnotationRecord, EvidenceLocator, ResearchProfile } from '../types';

const fieldLabels: Record<ClassificationField, string> = {
  areas: '研究领域',
  tasks: '任务',
  methods: '方法',
  robots: '机器人',
  endEffectors: '末端执行器',
  sensors: '传感器',
  dataSources: '数据来源',
  environments: '实验环境',
  evaluationTypes: '评估类型'
};

const factStatusLabels: Record<string, string> = {
  suggested: '建议',
  confirmed: '已确认',
  rejected: '已拒绝',
  unknown: '未知'
};

const entityLabels: Record<string, string> = {
  fact: '事实',
  annotation: '标注',
  artifact: '工件',
  note: '笔记'
};

const relationLabels: Record<string, string> = {
  supportedBy: '由其支持',
  derivedFrom: '来源于',
  discusses: '讨论',
  contradicts: '相矛盾',
  relatedTo: '相关'
};

export function ResearchPanel({
  profile,
  annotations,
  currentLocator,
  onSaveProfile,
  onAddFact,
  onSetFactStatus,
  onFocusEvidence
}: {
  profile: ResearchProfile;
  annotations: AnnotationRecord[];
  currentLocator?: EvidenceLocator;
  onSaveProfile(payload: {
    bibliography: Partial<ResearchProfile['bibliography']>;
    classification: Partial<ResearchProfile['classification']>;
  }): void;
  onAddFact(payload: { field: string; value: string; status: 'suggested' | 'confirmed'; locator?: EvidenceLocator }): void;
  onSetFactStatus(id: string, status: 'confirmed' | 'rejected' | 'unknown'): void;
  onFocusEvidence(locator: EvidenceLocator): void;
}) {
  const [title, setTitle] = useState(profile.bibliography.title);
  const [authors, setAuthors] = useState(profile.bibliography.authors.join(', '));
  const [year, setYear] = useState(profile.bibliography.year?.toString() || '');
  const [venue, setVenue] = useState(profile.bibliography.venue);
  const [classification, setClassification] = useState<Record<ClassificationField, string>>(
    () => classificationDraft(profile)
  );
  const [factField, setFactField] = useState('research.problem');
  const [factValue, setFactValue] = useState('');

  useEffect(() => {
    setTitle(profile.bibliography.title);
    setAuthors(profile.bibliography.authors.join(', '));
    setYear(profile.bibliography.year?.toString() || '');
    setVenue(profile.bibliography.venue);
    setClassification(classificationDraft(profile));
  }, [profile]);

  const relations = relationSourceState(profile, annotations);

  function save() {
    const parsedYear = year.trim() ? Number(year) : null;
    onSaveProfile({
      bibliography: {
        title: title.trim(),
        authors: authors.split(',').map(author => author.trim()).filter(Boolean),
        year: Number.isInteger(parsedYear) ? parsedYear : null,
        venue: venue.trim()
      },
      classification: Object.fromEntries(
        classificationFields.map(field => [field, parseList(classification[field])])
      ) as Partial<ResearchProfile['classification']>
    });
  }

  function addFact(status: 'suggested' | 'confirmed') {
    if (!factField.trim() || !factValue.trim()) return;
    onAddFact({
      field: factField.trim(),
      value: factValue.trim(),
      status,
      locator: currentLocator
    });
    setFactValue('');
  }

  return (
    <section className="side-tab-panel research-panel">
      <section className="tool-block">
        <h2>论文档案</h2>
        <label>标题<input value={title} onChange={event => setTitle(event.target.value)} /></label>
        <label>作者<input value={authors} onChange={event => setAuthors(event.target.value)} placeholder="用英文逗号分隔" /></label>
        <div className="field-row">
          <label>年份<input type="number" value={year} onChange={event => setYear(event.target.value)} /></label>
          <label>期刊 / 会议<input value={venue} onChange={event => setVenue(event.target.value)} /></label>
        </div>
        {classificationFields.map(field => (
          <label key={field}>
            {fieldLabels[field]}
            <input
              value={classification[field]}
              onChange={event => setClassification(current => ({ ...current, [field]: event.target.value }))}
              placeholder="用逗号分隔"
            />
          </label>
        ))}
        <button onClick={save}>保存论文档案</button>
        <p className="quiet-note">从文件名推测的标题和年份可以修改。手动字段只保存在本地；下方研究事实会保留明确的证据状态。</p>
      </section>

      <section className="tool-block">
        <h2>证据事实</h2>
        <label>字段<input value={factField} onChange={event => setFactField(event.target.value)} /></label>
        <label>内容<textarea rows={2} value={factValue} onChange={event => setFactValue(event.target.value)} /></label>
        <div className="actions">
          <button onClick={() => addFact('suggested')} disabled={!factValue.trim()}>添加建议</button>
          <button onClick={() => addFact('confirmed')} disabled={!factValue.trim() || !currentLocator}>由当前选区确认</button>
        </div>
        <p className="quiet-note">
          {currentLocator ? `当前选区可作为第 ${currentLocator.page} 页的证据。` : '确认有来源的事实前，请先选择论文文本。'}
        </p>
        <div className="list">
          {profile.facts.length ? profile.facts.map(fact => (
            <article className="item research-fact" key={fact.id}>
              <strong>{fact.field}</strong>
              <p>{fact.value}</p>
              <div className={`fact-status fact-${fact.status}`}>{factStatusLabels[fact.status] || fact.status}</div>
              {fact.source.locator ? (
                <button className="secondary-button" onClick={() => onFocusEvidence(fact.source.locator!)}>
                  第 {fact.source.locator.page} 页
                </button>
              ) : <span className="source-missing">没有可定位证据</span>}
              {fact.status === 'suggested' ? (
                <div className="annotation-actions">
                  <button onClick={() => onSetFactStatus(fact.id, 'confirmed')} disabled={!fact.source.locator}>确认</button>
                  <button onClick={() => onSetFactStatus(fact.id, 'rejected')}>拒绝</button>
                  <button onClick={() => onSetFactStatus(fact.id, 'unknown')}>标为未知</button>
                </div>
              ) : null}
            </article>
          )) : <div className="empty compact-empty">暂无研究事实。</div>}
        </div>
      </section>

      {relations.length ? (
        <section className="tool-block">
          <h2>关系</h2>
          {relations.map(({ relation, sourceMissing }) => (
            <div className="relation-row" key={relation.id}>
              <span>{entityLabels[relation.from.type] || relation.from.type}:{relation.from.id} {relationLabels[relation.type] || relation.type} {entityLabels[relation.to.type] || relation.to.type}:{relation.to.id}</span>
              {sourceMissing ? <strong className="source-missing">来源缺失</strong> : null}
            </div>
          ))}
        </section>
      ) : null}
    </section>
  );
}

function classificationDraft(profile: ResearchProfile) {
  return Object.fromEntries(
    classificationFields.map(field => [field, profile.classification[field].join(', ')])
  ) as Record<ClassificationField, string>;
}
