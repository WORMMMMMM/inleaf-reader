import type { AnnotationKind, EvidenceLocator } from './types';

export type ReaderActionLocation = 'selection-primary' | 'selection-more' | 'annotation-inline';
export type ReaderActionId =
  | 'inleafReader.action.highlight'
  | 'inleafReader.action.underline'
  | 'inleafReader.action.note'
  | 'inleafReader.action.translate'
  | 'inleafReader.action.askCodex';

export interface ReaderActionContext {
  selectedText: string;
  locator?: EvidenceLocator;
  codexAvailable: boolean;
}

export interface ReaderActionOptions {
  color?: string;
  note?: string;
  question?: string;
}

export type ReaderActionPayload =
  | { type: 'saveAnnotation'; kind: AnnotationKind; color: string; note?: string }
  | { type: 'translate'; text: string }
  | { type: 'askCodex'; question: string; locator: EvidenceLocator };

export interface ReaderActionDefinition {
  id: ReaderActionId;
  location: ReaderActionLocation;
  order: number;
  label: string;
  editor?: 'note' | 'translation' | 'codex';
  isAvailable(context: ReaderActionContext): boolean;
  disabledReason(context: ReaderActionContext): string | undefined;
  buildPayload(context: ReaderActionContext, options?: ReaderActionOptions): ReaderActionPayload | undefined;
}

const hasSelection = (context: ReaderActionContext) => !!context.selectedText.trim();
const selectionReason = (context: ReaderActionContext) => hasSelection(context)
  ? undefined
  : '请先在 PDF 中选择文本。';

export const readerActionRegistry: readonly ReaderActionDefinition[] = [
  annotationAction('inleafReader.action.highlight', '高亮', 10, 'highlight'),
  annotationAction('inleafReader.action.underline', '下划线', 20, 'underline'),
  {
    id: 'inleafReader.action.note',
    location: 'selection-primary',
    order: 30,
    label: '笔记',
    editor: 'note',
    isAvailable: hasSelection,
    disabledReason: selectionReason,
    buildPayload: (context, options) => {
      const note = options?.note?.trim();
      if (!hasSelection(context) || !note) return undefined;
      return {
        type: 'saveAnnotation',
        kind: 'highlight',
        color: options?.color || '#ffd654',
        note
      };
    }
  },
  {
    id: 'inleafReader.action.translate',
    location: 'selection-primary',
    order: 40,
    label: '翻译',
    editor: 'translation',
    isAvailable: hasSelection,
    disabledReason: selectionReason,
    buildPayload: context => hasSelection(context)
      ? { type: 'translate', text: context.selectedText.trim() }
      : undefined
  },
  {
    id: 'inleafReader.action.askCodex',
    location: 'selection-primary',
    order: 50,
    label: '询问 Codex',
    editor: 'codex',
    isAvailable: context => hasSelection(context) && context.codexAvailable && !!context.locator,
    disabledReason: context => {
      if (!hasSelection(context)) return '请先在 PDF 中选择文本。';
      if (!context.locator) return '当前选区没有稳定的证据位置。';
      if (!context.codexAvailable) return 'Codex CLI 不可用，请配置 inleafReader.codexCliPath。';
      return undefined;
    },
    buildPayload: (context, options) => {
      const question = options?.question?.trim();
      if (!question || !context.locator || !hasSelection(context) || !context.codexAvailable) return undefined;
      return { type: 'askCodex', question, locator: context.locator };
    }
  }
];

export function getReaderActions(
  context: ReaderActionContext,
  location: ReaderActionLocation
) {
  return readerActionRegistry
    .filter(action => action.location === location)
    .map(action => ({
      definition: action,
      available: action.isAvailable(context),
      disabledReason: action.disabledReason(context)
    }))
    .sort((left, right) => left.definition.order - right.definition.order);
}

export function invokeReaderAction(
  id: ReaderActionId,
  context: ReaderActionContext,
  options?: ReaderActionOptions
) {
  const action = readerActionRegistry.find(candidate => candidate.id === id);
  if (!action) return { error: `未知阅读动作：${id}` } as const;
  const disabledReason = action.disabledReason(context);
  if (disabledReason) return { error: disabledReason } as const;
  const payload = action.buildPayload(context, options);
  return payload ? { payload } as const : { error: '此操作还需要更多输入。' } as const;
}

function annotationAction(
  id: Extract<ReaderActionId, 'inleafReader.action.highlight' | 'inleafReader.action.underline'>,
  label: string,
  order: number,
  kind: AnnotationKind
): ReaderActionDefinition {
  return {
    id,
    location: 'selection-primary',
    order,
    label,
    isAvailable: hasSelection,
    disabledReason: selectionReason,
    buildPayload: (context, options) => hasSelection(context)
      ? { type: 'saveAnnotation', kind, color: options?.color || '#ffd654' }
      : undefined
  };
}
