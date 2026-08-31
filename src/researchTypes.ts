import * as path from 'path';
import type { AnnotationRect } from './annotationTypes';

export interface EvidenceLocator {
  schemaVersion: 1;
  documentFingerprint: string;
  annotationId?: string;
  page: number;
  rects?: AnnotationRect[];
  quote: string;
  contextBefore?: string;
  contextAfter?: string;
}

export type EvidenceFocusTarget =
  | { kind: 'annotation'; annotationId: string; page: number; locator: EvidenceLocator }
  | { kind: 'geometry'; page: number; rects: AnnotationRect[]; locator: EvidenceLocator }
  | { kind: 'quote'; page: number; locator: EvidenceLocator }
  | { kind: 'sourceMissing'; page: number; reason: string; locator: EvidenceLocator }
  | { kind: 'wrongDocument'; reason: string; locator: EvidenceLocator };

export interface PaperBibliography {
  title: string;
  authors: string[];
  year: number | null;
  venue: string;
  doi: string;
  arxivId: string;
  projectUrl: string;
}

export interface PaperClassification {
  areas: string[];
  tasks: string[];
  methods: string[];
  robots: string[];
  endEffectors: string[];
  sensors: string[];
  dataSources: string[];
  environments: string[];
  evaluationTypes: string[];
  custom: Record<string, string[]>;
}

export type ResearchFactStatus = 'suggested' | 'confirmed' | 'rejected' | 'unknown';

export interface ResearchFact {
  id: string;
  field: string;
  value: string;
  status: ResearchFactStatus;
  source: {
    type: 'paper' | 'repository' | 'user';
    section?: string;
    locator?: EvidenceLocator;
    repository?: RepositoryEvidence;
  };
  extractedBy?: {
    kind: 'rule' | 'provider' | 'user';
    name: string;
    model?: string;
    capturedAt: string;
  };
  confidence?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RepositoryEvidence {
  url: string;
  commit: string;
  path?: string;
  line?: number;
  capturedAt: string;
}

export type ResearchArtifactType =
  | 'github'
  | 'git_repository'
  | 'dataset'
  | 'model_weights'
  | 'project_page'
  | 'supplementary_material';

export interface ResearchArtifact {
  id: string;
  type: ResearchArtifactType;
  url: string;
  relationship: string;
  verification: {
    status: ResearchFactStatus;
    sourceType: 'paper' | 'user' | 'repository';
    page?: number;
    locator?: EvidenceLocator;
  };
  localCheckout?: {
    path: string;
    commit: string;
    branch?: string;
    dirty: boolean | null;
    capturedAt: string;
  };
  license: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchRelation {
  id: string;
  from: { type: 'fact' | 'annotation' | 'artifact' | 'note'; id: string };
  to: { type: 'fact' | 'annotation' | 'artifact' | 'note'; id: string };
  type: 'supportedBy' | 'derivedFrom' | 'discusses' | 'contradicts' | 'relatedTo';
  createdAt: string;
}

export interface ResearchProfile {
  schemaVersion: 1;
  paperFingerprint: string;
  bibliography: PaperBibliography;
  classification: PaperClassification;
  artifacts: ResearchArtifact[];
  facts: ResearchFact[];
  relations: ResearchRelation[];
  updatedAt: string;
}

export type SourceOutcome = 'ok' | 'empty' | 'error' | 'notQueried';

export interface FieldProvenance {
  source: string;
  sourceRecordId?: string;
  fetchedAt: string;
  outcome: SourceOutcome;
}

export interface LibraryPaper {
  fingerprint: string;
  pdfPath: string;
  researchPath: string;
  title: string;
  year: number | null;
  tags: string[];
  repositoryCount: number;
  updatedAt: string;
}

export interface LibraryIndexData {
  schemaVersion: 1;
  generatedAt: string;
  rootPath: string;
  papers: LibraryPaper[];
  warnings: string[];
}

export type ComparisonCellStatus = 'evidenced' | 'inferred' | 'conflicting' | 'unknown';

export type ComparisonEvidenceRef =
  | { type: 'fact'; paperFingerprint: string; factId: string; locator?: EvidenceLocator }
  | { type: 'locator'; paperFingerprint: string; locator: EvidenceLocator }
  | { type: 'repository'; paperFingerprint: string; repository: RepositoryEvidence };

export interface ComparisonCell {
  paperFingerprint: string;
  dimensionId: string;
  status: ComparisonCellStatus;
  value: string;
  evidenceRefs: ComparisonEvidenceRef[];
  sourceMissing?: boolean;
  stale?: boolean;
}

export interface ComparisonDimension {
  id: string;
  label: string;
  factFields: string[];
}

export interface PaperComparison {
  schemaVersion: 1;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  papers: Array<Pick<LibraryPaper, 'fingerprint' | 'pdfPath' | 'title' | 'year'>>;
  dimensions: ComparisonDimension[];
  cells: ComparisonCell[];
}

export const CLASSIFICATION_FIELDS = [
  'areas',
  'tasks',
  'methods',
  'robots',
  'endEffectors',
  'sensors',
  'dataSources',
  'environments',
  'evaluationTypes'
] as const satisfies readonly (keyof Omit<PaperClassification, 'custom'>)[];

export type ClassificationField = typeof CLASSIFICATION_FIELDS[number];

export function createEmptyClassification(): PaperClassification {
  return {
    areas: [],
    tasks: [],
    methods: [],
    robots: [],
    endEffectors: [],
    sensors: [],
    dataSources: [],
    environments: [],
    evaluationTypes: [],
    custom: {}
  };
}

export function inferBibliographyFromFilename(pdfPath: string): PaperBibliography {
  const stem = path.basename(pdfPath).replace(/\.pdf$/i, '');
  const yearMatch = stem.match(/^(19|20)\d{2}(?:[_ -]+|$)/);
  const titleStem = yearMatch ? stem.slice(yearMatch[0].length) : stem;
  return {
    title: titleStem.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim(),
    authors: [],
    year: yearMatch ? Number(yearMatch[0].slice(0, 4)) : null,
    venue: '',
    doi: '',
    arxivId: '',
    projectUrl: ''
  };
}

export function createDefaultResearchProfile(
  paperFingerprint: string,
  pdfPath: string,
  updatedAt = new Date().toISOString()
): ResearchProfile {
  return {
    schemaVersion: 1,
    paperFingerprint,
    bibliography: inferBibliographyFromFilename(pdfPath),
    classification: createEmptyClassification(),
    artifacts: [],
    facts: [],
    relations: [],
    updatedAt
  };
}

export function normalizeStringList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return [...new Set(values
    .filter((value): value is string => typeof value === 'string')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean))];
}

export function normalizeResearchProfile(
  value: unknown,
  fallback: ResearchProfile
): ResearchProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback;
  }
  const raw = value as Partial<ResearchProfile>;
  const rawBibliography = raw.bibliography && typeof raw.bibliography === 'object'
    ? raw.bibliography as Partial<PaperBibliography>
    : {};
  const rawClassification = raw.classification && typeof raw.classification === 'object'
    ? raw.classification as Partial<PaperClassification>
    : {};
  const classification = createEmptyClassification();
  for (const field of CLASSIFICATION_FIELDS) {
    classification[field] = normalizeStringList(rawClassification[field]);
  }
  const custom: Record<string, string[]> = {};
  if (rawClassification.custom && typeof rawClassification.custom === 'object') {
    for (const [key, values] of Object.entries(rawClassification.custom)) {
      const normalized = normalizeStringList(values);
      if (key.trim() && normalized.length) {
        custom[key.trim()] = normalized;
      }
    }
  }
  classification.custom = custom;

  return {
    ...fallback,
    ...raw,
    schemaVersion: 1,
    paperFingerprint: typeof raw.paperFingerprint === 'string' && raw.paperFingerprint
      ? raw.paperFingerprint
      : fallback.paperFingerprint,
    bibliography: {
      ...fallback.bibliography,
      ...rawBibliography,
      title: stringValue(rawBibliography.title, fallback.bibliography.title),
      authors: normalizeStringArrayPreservingCase(rawBibliography.authors),
      year: typeof rawBibliography.year === 'number' ? rawBibliography.year : fallback.bibliography.year,
      venue: stringValue(rawBibliography.venue),
      doi: stringValue(rawBibliography.doi),
      arxivId: stringValue(rawBibliography.arxivId),
      projectUrl: stringValue(rawBibliography.projectUrl)
    },
    classification,
    artifacts: Array.isArray(raw.artifacts) ? raw.artifacts : [],
    facts: Array.isArray(raw.facts) ? raw.facts : [],
    relations: Array.isArray(raw.relations) ? raw.relations : [],
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : fallback.updatedAt
  };
}

export function researchProfileTags(profile: ResearchProfile): string[] {
  const tags = CLASSIFICATION_FIELDS.flatMap(field => profile.classification[field]);
  for (const values of Object.values(profile.classification.custom)) {
    tags.push(...values);
  }
  for (const fact of profile.facts) {
    if (fact.status === 'confirmed' && fact.value.trim()) {
      tags.push(fact.value.trim().toLowerCase());
    }
  }
  return [...new Set(tags)].sort();
}

function normalizeStringArrayPreservingCase(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return [...new Set(values
    .filter((value): value is string => typeof value === 'string')
    .map(value => value.trim())
    .filter(Boolean))];
}

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}
