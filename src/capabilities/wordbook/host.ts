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
    if (request.action === 'save') {
      await this.postState(context, await storage.add(await this.enrichWord(request.payload)));
      return;
    }
    await this.postState(context, await storage.delete(request.payload.id));
  }

  private async postState(
    context: CapabilityHostContext,
    words: Awaited<ReturnType<ReturnType<typeof wordbookStorage>['read']>>
  ) {
    await context.postEvent(this.id, 'state', { words });
  }
}
