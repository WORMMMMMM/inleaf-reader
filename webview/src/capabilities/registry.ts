import React from 'react';
import { READER_CAPABILITIES, type CapabilityDescriptor, type CapabilityId } from '../../../src/capabilities/contracts';
import type { CapabilityEventEnvelope } from '../../../src/capabilities/protocol';
import { AnnotationsPanel, type AnnotationsPanelProps } from './annotations/AnnotationsPanel';
import { TranslationPanel } from './translation/TranslationPanel';
import { WordbookPanel } from './wordbook/WordbookPanel';
import type { WordDetails, WordRecord } from '../types';
import type { WorkspacePanelContribution } from './ReaderSideSurface';

export interface CapabilityPanelModels {
  annotations: AnnotationsPanelProps;
  wordbook: { words: WordRecord[]; onDelete(id: string): void };
  translation: { selectedText: string; output: string; wordDetails?: WordDetails };
}

const capabilityPanelDefinitions = [
  {
    id: 'annotations' as const,
    render: (models: CapabilityPanelModels) => React.createElement(AnnotationsPanel, models.annotations)
  },
  {
    id: 'wordbook' as const,
    render: (models: CapabilityPanelModels) => React.createElement(WordbookPanel, models.wordbook)
  },
  {
    id: 'translation' as const,
    render: (models: CapabilityPanelModels) => React.createElement(TranslationPanel, models.translation)
  }
] satisfies readonly { id: CapabilityId; render(models: CapabilityPanelModels): React.ReactNode }[];

export function visibleCapabilityPanels(descriptors: CapabilityDescriptor[]) {
  const byId = new Map(descriptors.map(descriptor => [descriptor.id, descriptor]));
  return capabilityPanelDefinitions
    .map(definition => byId.get(definition.id))
    .filter((descriptor): descriptor is CapabilityDescriptor => (
      !!descriptor && descriptor.enabled && descriptor.showInPanel
    ))
    .sort((left, right) => left.order - right.order);
}

export function buildCapabilityPanelContributions(
  descriptors: CapabilityDescriptor[],
  models: CapabilityPanelModels
): WorkspacePanelContribution[] {
  const visible = new Map(visibleCapabilityPanels(descriptors).map(descriptor => [descriptor.id, descriptor]));
  const panels: WorkspacePanelContribution[] = [];
  for (const definition of capabilityPanelDefinitions) {
    const descriptor = visible.get(definition.id);
    if (descriptor) {
      panels.push({
        id: descriptor.id,
        title: descriptor.title,
        content: definition.render(models)
      });
    }
  }
  return panels.sort((left, right) => (
    (visible.get(left.id as CapabilityId)?.order ?? 0) -
    (visible.get(right.id as CapabilityId)?.order ?? 0)
  ));
}

export function capabilityEnabled(descriptors: CapabilityDescriptor[], id: CapabilityId) {
  return descriptors.find(descriptor => descriptor.id === id)?.enabled ?? true;
}

export interface CapabilityEventOutcome {
  status?: string;
  activatePanel?: CapabilityId;
}

export type CapabilityEventHandlers = Partial<Record<
  CapabilityId,
  (event: string, payload: unknown) => CapabilityEventOutcome
>>;

export function routeCapabilityEvent(
  message: CapabilityEventEnvelope,
  handlers: CapabilityEventHandlers
): CapabilityEventOutcome {
  return handlers[message.capabilityId]?.(message.event, message.payload) ?? {};
}
