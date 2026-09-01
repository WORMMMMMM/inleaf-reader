export const CAPABILITY_IDS = ['annotations', 'wordbook', 'translation'] as const;

export type CapabilityId = typeof CAPABILITY_IDS[number];
export type ReaderSurface = 'closed' | 'workspace' | 'settings';
export type CapabilityReadiness = 'ready' | 'needsSetup' | 'unavailable' | 'error';

export interface ReaderCapabilityManifest {
  id: CapabilityId;
  title: string;
  description: string;
  defaultEnabled: boolean;
  defaultPanelVisibility: boolean;
  order: number;
  contributions: {
    panel: boolean;
    inlineActions: boolean;
    settings: boolean;
    persistence: boolean;
  };
}

export interface CapabilityPreference {
  enabled?: boolean;
  showInPanel?: boolean;
  order?: number;
}

export type CapabilityPreferenceMap = Partial<Record<CapabilityId, CapabilityPreference>>;

export interface CapabilityDescriptor extends ReaderCapabilityManifest {
  enabled: boolean;
  showInPanel: boolean;
  readiness: CapabilityReadiness;
  readinessMessage?: string;
}

export const READER_CAPABILITIES: readonly ReaderCapabilityManifest[] = [
  {
    id: 'annotations',
    title: 'Annotations',
    description: 'Highlight, underline, edit, and export notes beside the text.',
    defaultEnabled: true,
    defaultPanelVisibility: true,
    order: 10,
    contributions: { panel: true, inlineActions: true, settings: false, persistence: true }
  },
  {
    id: 'wordbook',
    title: 'Wordbook',
    description: 'Capture words and dictionary details in a portable sidecar.',
    defaultEnabled: true,
    defaultPanelVisibility: true,
    order: 20,
    contributions: { panel: true, inlineActions: true, settings: false, persistence: true }
  },
  {
    id: 'translation',
    title: 'Translation',
    description: 'Translate selections with a local or user-configured provider.',
    defaultEnabled: true,
    defaultPanelVisibility: true,
    order: 30,
    contributions: { panel: true, inlineActions: true, settings: true, persistence: false }
  }
] as const;

export function isCapabilityId(value: unknown): value is CapabilityId {
  return typeof value === 'string' && CAPABILITY_IDS.some(id => id === value);
}

export function resolveCapabilityDescriptors(
  rawPreferences: unknown,
  readiness: Partial<Record<CapabilityId, Pick<CapabilityDescriptor, 'readiness' | 'readinessMessage'>>> = {}
): CapabilityDescriptor[] {
  const preferences = parseCapabilityPreferences(rawPreferences);
  return READER_CAPABILITIES.map(manifest => {
    const preference = preferences[manifest.id];
    return {
      ...manifest,
      enabled: preference?.enabled ?? manifest.defaultEnabled,
      showInPanel: preference?.showInPanel ?? manifest.defaultPanelVisibility,
      order: preference?.order ?? manifest.order,
      readiness: readiness[manifest.id]?.readiness ?? 'ready',
      ...(readiness[manifest.id]?.readinessMessage
        ? { readinessMessage: readiness[manifest.id]?.readinessMessage }
        : {})
    };
  }).sort((left, right) => left.order - right.order || left.title.localeCompare(right.title));
}

export function parseCapabilityPreferences(value: unknown): CapabilityPreferenceMap {
  if (!isRecord(value)) {
    return {};
  }
  const result: CapabilityPreferenceMap = {};
  for (const id of CAPABILITY_IDS) {
    const input = value[id];
    if (!isRecord(input)) {
      continue;
    }
    const preference: CapabilityPreference = {};
    if (typeof input.enabled === 'boolean') {
      preference.enabled = input.enabled;
    }
    if (typeof input.showInPanel === 'boolean') {
      preference.showInPanel = input.showInPanel;
    }
    if (typeof input.order === 'number' && Number.isFinite(input.order)) {
      preference.order = input.order;
    }
    result[id] = preference;
  }
  return result;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
