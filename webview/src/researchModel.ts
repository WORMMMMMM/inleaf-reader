import type { AnnotationRecord, ResearchProfile } from './types';

export const classificationFields = [
  'areas',
  'tasks',
  'methods',
  'robots',
  'endEffectors',
  'sensors',
  'dataSources',
  'environments',
  'evaluationTypes'
] as const;

export type ClassificationField = typeof classificationFields[number];

export function relationSourceState(
  profile: ResearchProfile,
  annotations: AnnotationRecord[]
) {
  const facts = new Set(profile.facts.map(fact => fact.id));
  const artifacts = new Set(profile.artifacts.map(artifact => artifact.id));
  const annotationIds = new Set(annotations.map(annotation => annotation.id));
  return profile.relations.map(relation => ({
    relation,
    sourceMissing: !entityExists(relation.from.type, relation.from.id)
      || !entityExists(relation.to.type, relation.to.id)
  }));

  function entityExists(type: string, id: string) {
    if (type === 'fact') return facts.has(id);
    if (type === 'artifact') return artifacts.has(id);
    if (type === 'annotation') return annotationIds.has(id);
    return true;
  }
}

export function parseList(value: string) {
  return [...new Set(value
    .split(/[,;\n]+/)
    .map(item => item.trim().toLowerCase())
    .filter(Boolean))];
}
