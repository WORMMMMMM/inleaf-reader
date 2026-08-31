import { randomUUID } from 'crypto';
import * as path from 'path';
import * as vscode from 'vscode';
import { AtomicJsonFile } from './atomicJsonFile';
import type { AnnotationRecord } from './annotationTypes';
import {
  type ComparisonCell,
  type ComparisonDimension,
  type LibraryPaper,
  type PaperComparison,
  type ResearchFact,
  type ResearchProfile
} from './researchTypes';

export const DEFAULT_COMPARISON_DIMENSIONS: ComparisonDimension[] = [
  { id: 'research-question', label: '研究问题与任务', factFields: ['research.problem', 'classification.tasks'] },
  { id: 'assumptions', label: '假设与适用范围', factFields: ['assumptions', 'limitations'] },
  { id: 'embodiment', label: '机器人、末端执行器与传感器', factFields: ['classification.robots', 'classification.endEffectors', 'classification.sensors'] },
  { id: 'method', label: '输入、模型与控制输出', factFields: ['classification.methods', 'method.inputs', 'method.model', 'method.outputs'] },
  { id: 'data', label: '训练与评估数据', factFields: ['classification.dataSources', 'data'] },
  { id: 'evaluation', label: '数据集、基线、指标与规模', factFields: ['evaluation', 'classification.evaluationTypes'] },
  { id: 'evidence-boundary', label: '仿真、台架与真实机器人证据', factFields: ['evidence', 'classification.evaluationTypes'] },
  { id: 'failures', label: '消融与失败案例', factFields: ['ablation', 'failure', 'limitations'] },
  { id: 'artifacts', label: '代码、数据、权重与许可证', factFields: ['artifacts', 'license'] },
  { id: 'reproduction', label: '复现要求与已知限制', factFields: ['reproduction', 'limitations'] }
];

export interface ComparisonPaperInput {
  paper: LibraryPaper;
  profile: ResearchProfile;
  annotations?: AnnotationRecord[];
}

export class ComparisonService {
  build(
    inputs: ComparisonPaperInput[],
    dimensions = DEFAULT_COMPARISON_DIMENSIONS,
    title = `论文比较（${inputs.length} 篇）`
  ): PaperComparison {
    const now = new Date().toISOString();
    return {
      schemaVersion: 1,
      id: randomUUID(),
      title,
      createdAt: now,
      updatedAt: now,
      papers: inputs.map(({ paper }) => ({
        fingerprint: paper.fingerprint,
        pdfPath: paper.pdfPath,
        title: paper.title,
        year: paper.year
      })),
      dimensions,
      cells: inputs.flatMap(input => dimensions.map(dimension => buildCell(input, dimension)))
    };
  }

  async save(rootPath: string, comparison: PaperComparison) {
    const directory = path.join(rootPath, '.inleaf-reader', 'comparisons');
    const jsonUri = vscode.Uri.file(path.join(directory, `${comparison.id}.json`));
    const markdownUri = vscode.Uri.file(path.join(directory, `${comparison.id}.md`));
    const jsonFile = new AtomicJsonFile(jsonUri, () => comparison);
    await jsonFile.write(comparison);
    await vscode.workspace.fs.writeFile(markdownUri, Buffer.from(formatComparisonMarkdown(comparison), 'utf8'));
    return { jsonUri, markdownUri };
  }
}

export function buildCell(
  input: ComparisonPaperInput,
  dimension: ComparisonDimension
): ComparisonCell {
  const facts = input.profile.facts.filter(fact =>
    fact.status === 'confirmed' && matchesDimension(fact, dimension)
  );
  const evidenceFacts = facts.filter(fact => fact.source.locator || fact.source.repository?.commit);
  if (!evidenceFacts.length) {
    return {
      paperFingerprint: input.paper.fingerprint,
      dimensionId: dimension.id,
      status: 'unknown',
      value: 'unknown',
      evidenceRefs: []
    };
  }
  const values = [...new Set(evidenceFacts.map(fact => fact.value.trim()).filter(Boolean))];
  const sourceMissing = input.annotations !== undefined && evidenceFacts.some(fact => {
    const annotationId = fact.source.locator?.annotationId;
    return !!annotationId && !input.annotations!.some(annotation => annotation.id === annotationId);
  });
  return {
    paperFingerprint: input.paper.fingerprint,
    dimensionId: dimension.id,
    status: hasExplicitConflict(evidenceFacts) ? 'conflicting' : 'evidenced',
    value: values.join('; '),
    evidenceRefs: evidenceFacts.map(fact => fact.source.repository?.commit
      ? {
          type: 'repository' as const,
          paperFingerprint: input.paper.fingerprint,
          repository: fact.source.repository
        }
      : {
          type: 'fact' as const,
          paperFingerprint: input.paper.fingerprint,
          factId: fact.id,
          locator: fact.source.locator
        }),
    sourceMissing: sourceMissing || undefined
  };
}

export function formatComparisonMarkdown(comparison: PaperComparison) {
  const paperByFingerprint = new Map(comparison.papers.map(paper => [paper.fingerprint, paper]));
  const lines = [
    `# ${escapeMarkdown(comparison.title)}`,
    '',
    `Generated: ${comparison.updatedAt}`,
    ''
  ];
  for (const dimension of comparison.dimensions) {
    lines.push(`## ${escapeMarkdown(dimension.label)}`, '');
    for (const cell of comparison.cells.filter(cell => cell.dimensionId === dimension.id)) {
      const paper = paperByFingerprint.get(cell.paperFingerprint);
      lines.push(`### ${escapeMarkdown(paper?.title || cell.paperFingerprint)}`);
      lines.push(`- Status: ${cell.status}`);
      lines.push(`- Value: ${escapeMarkdown(cell.value)}`);
      if (cell.sourceMissing) lines.push('- Source state: sourceMissing');
      if (!cell.evidenceRefs.length) {
        lines.push('- Evidence: unknown');
      } else {
        lines.push('- Evidence:');
        for (const ref of cell.evidenceRefs) {
          if (ref.type === 'repository') {
            lines.push(`  - Repository: ${ref.repository.url} @ ${ref.repository.commit}${ref.repository.path ? ` (${ref.repository.path})` : ''}`);
          } else {
            const locator = ref.type === 'fact' ? ref.locator : ref.locator;
            lines.push(locator
              ? `  - PDF: ${paper?.pdfPath || ''}; page ${locator.page}; annotation ${locator.annotationId || 'none'}; quote: ${escapeMarkdown(locator.quote)}`
              : `  - Fact: ${ref.type === 'fact' ? ref.factId : 'locator missing'}`);
          }
        }
      }
      lines.push('');
    }
  }
  return `${lines.join('\n')}\n`;
}

function matchesDimension(fact: ResearchFact, dimension: ComparisonDimension) {
  const normalized = fact.field.trim().toLowerCase();
  return dimension.factFields.some(field => {
    const candidate = field.toLowerCase();
    return normalized === candidate || normalized.startsWith(`${candidate}.`);
  });
}

function hasExplicitConflict(facts: ResearchFact[]) {
  return facts.some(fact => fact.source.type === 'user' && /^conflict:/i.test(fact.value));
}

function escapeMarkdown(value: string) {
  return value.replace(/([\\`*_{}\[\]<>])/g, '\\$1').replace(/\r?\n/g, ' ');
}
