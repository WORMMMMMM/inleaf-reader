import * as vscode from 'vscode';
import { INLEAF_IDS } from '../identity';
import {
  isCapabilityId,
  parseCapabilityPreferences,
  resolveCapabilityDescriptors,
  type CapabilityDescriptor,
  type CapabilityId,
  type CapabilityPreference
} from './contracts';

const CONFIGURATION_KEY = 'capabilities';

export class CapabilityPreferenceService {
  private updates: Promise<void> = Promise.resolve();
  getDescriptors(
    readiness?: Parameters<typeof resolveCapabilityDescriptors>[1]
  ): CapabilityDescriptor[] {
    return resolveCapabilityDescriptors(this.configuration().get(CONFIGURATION_KEY), readiness);
  }

  update(capabilityId: CapabilityId, patch: CapabilityPreference) {
    const next = this.updates.then(() => this.applyUpdate(capabilityId, patch));
    this.updates = next.catch(() => undefined);
    return next;
  }

  private async applyUpdate(capabilityId: CapabilityId, patch: CapabilityPreference) {
    if (!isCapabilityId(capabilityId)) {
      throw new Error(`Unknown reader capability: ${String(capabilityId)}`);
    }
    const current = parseCapabilityPreferences(this.configuration().get(CONFIGURATION_KEY));
    await this.configuration().update(
      CONFIGURATION_KEY,
      {
        ...current,
        [capabilityId]: {
          ...current[capabilityId],
          ...sanitizePatch(patch)
        }
      },
      vscode.ConfigurationTarget.Global
    );
  }

  private configuration() {
    return vscode.workspace.getConfiguration(INLEAF_IDS.configuration);
  }
}

function sanitizePatch(patch: CapabilityPreference): CapabilityPreference {
  return {
    ...(typeof patch.enabled === 'boolean' ? { enabled: patch.enabled } : {}),
    ...(typeof patch.showInPanel === 'boolean' ? { showInPanel: patch.showInPanel } : {}),
    ...(typeof patch.order === 'number' && Number.isFinite(patch.order) ? { order: patch.order } : {})
  };
}
