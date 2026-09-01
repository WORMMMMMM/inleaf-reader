import * as vscode from 'vscode';
import type { ReaderStorage } from '../readerStorage';
import type { CapabilityId } from './contracts';
import type { CapabilityHostContext, HostCapability } from './hostTypes';
import { AnnotationHostCapability } from './annotations/host';
import { TranslationHostCapability } from './translation/host';
import { WordbookHostCapability } from './wordbook/host';

export interface HostRegistryContext {
  documentId: string;
  storage: ReaderStorage;
  postEvent(capabilityId: CapabilityId, event: string, payload?: unknown): Thenable<boolean>;
}

export class HostCapabilityRegistry implements vscode.Disposable {
  private readonly translation: TranslationHostCapability;
  private readonly capabilities: Map<CapabilityId, HostCapability>;

  constructor(extensionUri: vscode.Uri, secrets: vscode.SecretStorage) {
    this.translation = new TranslationHostCapability(extensionUri, secrets);
    const registered: HostCapability[] = [
      new AnnotationHostCapability(),
      new WordbookHostCapability(input => this.translation.enrichWord(input)),
      this.translation
    ];
    this.capabilities = new Map(registered.map(capability => [capability.id, capability]));
  }

  async postInitialState(context: HostRegistryContext) {
    await Promise.all([...this.capabilities.values()].map(capability => (
      capability.postInitialState(this.context(context))
    )));
  }

  async handle(
    capabilityId: CapabilityId,
    action: string,
    payload: unknown,
    context: HostRegistryContext
  ) {
    const capability = this.capabilities.get(capabilityId);
    if (!capability) {
      throw new Error(`Unknown reader capability: ${capabilityId}`);
    }
    await capability.handle(action, payload, this.context(context));
  }

  async readiness() {
    return { translation: await this.translation.readiness() };
  }

  dispose() {
    this.translation.dispose();
  }

  private context(context: HostRegistryContext): CapabilityHostContext {
    return context;
  }
}
