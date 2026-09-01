import * as vscode from 'vscode';
import { formatAnnotationMarkdownSnippet } from '../../annotationExports';
import type { CapabilityHostContext, HostCapability } from '../hostTypes';
import { decodeAnnotationRequest } from './protocol';
import { annotationStorage } from './storage';

export class AnnotationHostCapability implements HostCapability {
  readonly id = 'annotations' as const;

  async postInitialState(context: CapabilityHostContext) {
    await this.postState(context, await annotationStorage(context.storage).read());
  }

  async handle(action: string, payload: unknown, context: CapabilityHostContext) {
    const request = decodeAnnotationRequest(action, payload);
    const storage = annotationStorage(context.storage);
    switch (request.action) {
      case 'save':
        await this.postState(context, await storage.add(request.payload));
        return;
      case 'update':
        await this.postState(context, await storage.update(request.payload.id, request.payload.patch));
        return;
      case 'delete':
        await this.postState(context, await storage.delete(request.payload.id));
        return;
      case 'restore':
        await this.postState(context, await storage.restore(request.payload));
        await context.postEvent(this.id, 'result', { message: 'Annotation restored.' });
        return;
      case 'copyMarkdown': {
        const annotations = await storage.read();
        const annotation = annotations.find(item => item.id === request.payload.id);
        if (!annotation) {
          throw new Error('Annotation not found.');
        }
        await vscode.env.clipboard.writeText(formatAnnotationMarkdownSnippet(annotation));
        await context.postEvent(this.id, 'result', { message: 'Annotation Markdown copied.' });
        vscode.window.showInformationMessage('Annotation Markdown copied.');
        return;
      }
      case 'exportMarkdown': {
        const uri = await storage.exportMarkdown();
        await context.postEvent(this.id, 'result', { message: `Exported: ${uri.fsPath}`, path: uri.fsPath });
        vscode.window.showInformationMessage(`Annotations exported: ${uri.fsPath}`);
        return;
      }
      case 'exportPdf': {
        const uri = await storage.exportPdf();
        await context.postEvent(this.id, 'result', { message: `Exported: ${uri.fsPath}`, path: uri.fsPath });
        vscode.window.showInformationMessage(`Annotated PDF exported: ${uri.fsPath}`);
      }
    }
  }

  private async postState(
    context: CapabilityHostContext,
    annotations: Awaited<ReturnType<ReturnType<typeof annotationStorage>['read']>>
  ) {
    await context.postEvent(this.id, 'state', { annotations });
  }
}
