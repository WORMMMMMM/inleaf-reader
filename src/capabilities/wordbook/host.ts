import * as vscode from 'vscode';
import type { WordRecord } from '../../readerDataTypes';
import type { CapabilityHostContext, HostCapability } from '../hostTypes';
import { decodeWordbookRequest } from './protocol';
import { wordbookStorage } from './storage';

export class WordbookHostCapability implements HostCapability {
  readonly id = 'wordbook' as const;

  constructor(
    private readonly enrichWord: (
      input: Omit<WordRecord, 'id' | 'createdAt' | 'updatedAt'>
    ) => Promise<Omit<WordRecord, 'id' | 'createdAt' | 'updatedAt'>>
  ) {}

  async postInitialState(context: CapabilityHostContext) {
    await this.postState(context, await wordbookStorage(context.storage).read());
  }

  async handle(action: string, payload: unknown, context: CapabilityHostContext) {
    const request = decodeWordbookRequest(action, payload);
    const storage = wordbookStorage(context.storage);
    switch (request.action) {
      case 'save':
        await this.postState(context, await storage.add(await this.enrichWord(request.payload)));
        return;
      case 'update':
        await this.postState(context, await storage.update(request.payload.id, request.payload.patch));
        await context.postEvent(this.id, 'result', { message: 'Word note updated.' });
        return;
      case 'delete':
        await this.postState(context, await storage.delete(request.payload.id));
        return;
      case 'exportMarkdown': {
        const uri = await storage.exportMarkdown();
        await context.postEvent(this.id, 'result', { message: `Exported: ${uri.fsPath}`, path: uri.fsPath });
        vscode.window.showInformationMessage(`Wordbook exported: ${uri.fsPath}`);
        return;
      }
      case 'exportCsv': {
        const uri = await storage.exportCsv();
        await context.postEvent(this.id, 'result', { message: `Exported: ${uri.fsPath}`, path: uri.fsPath });
        vscode.window.showInformationMessage(`Wordbook CSV exported: ${uri.fsPath}`);
      }
    }
  }

  private async postState(
    context: CapabilityHostContext,
    words: Awaited<ReturnType<ReturnType<typeof wordbookStorage>['read']>>
  ) {
    await context.postEvent(this.id, 'state', { words });
  }
}
