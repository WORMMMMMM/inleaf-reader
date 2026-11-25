export interface PdfOutlineNode {
  id: string;
  title: string;
  pageNumber?: number;
  items: PdfOutlineNode[];
}

interface RawOutlineItem {
  title?: string;
  dest?: string | unknown[] | null;
  items?: RawOutlineItem[];
}

export interface PdfOutlineDocument {
  getOutline(): Promise<RawOutlineItem[] | null>;
  getDestination(id: string): Promise<unknown[] | null>;
  getPageIndex(ref: unknown): Promise<number>;
}

export async function extractPdfOutline(pdfDocument: PdfOutlineDocument): Promise<PdfOutlineNode[]> {
  try {
    const raw = await pdfDocument.getOutline();
    if (!raw?.length) {
      return [];
    }
    return await mapOutlineItems(pdfDocument, raw, 'outline');
  } catch {
    return [];
  }
}

async function mapOutlineItems(
  pdfDocument: PdfOutlineDocument,
  items: RawOutlineItem[],
  prefix: string
): Promise<PdfOutlineNode[]> {
  const nodes: PdfOutlineNode[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const id = `${prefix}-${index}`;
    const title = (item.title || '').replace(/\s+/g, ' ').trim();
    const pageNumber = await resolveDestinationPage(pdfDocument, item.dest);
    const children = item.items?.length
      ? await mapOutlineItems(pdfDocument, item.items, id)
      : [];
    if (title || children.length) {
      nodes.push({
        id,
        title: title || '(Untitled)',
        pageNumber,
        items: children
      });
    }
  }
  return nodes;
}

async function resolveDestinationPage(
  pdfDocument: PdfOutlineDocument,
  dest: RawOutlineItem['dest']
): Promise<number | undefined> {
  if (!dest) return undefined;
  try {
    const resolved = typeof dest === 'string'
      ? await pdfDocument.getDestination(dest)
      : dest;
    if (!Array.isArray(resolved) || resolved.length === 0) {
      return undefined;
    }
    const target = resolved[0];
    if (typeof target === 'number' && Number.isFinite(target)) {
      return target + 1;
    }
    if (target && typeof target === 'object') {
      const pageIndex = await pdfDocument.getPageIndex(target);
      return Number.isFinite(pageIndex) ? pageIndex + 1 : undefined;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function findActiveOutlineId(nodes: PdfOutlineNode[], currentPage: number): string | undefined {
  let activeId: string | undefined;
  let activePage = -1;
  const walk = (list: PdfOutlineNode[]) => {
    for (const node of list) {
      if (node.pageNumber !== undefined && node.pageNumber <= currentPage && node.pageNumber >= activePage) {
        activePage = node.pageNumber;
        activeId = node.id;
      }
      if (node.items.length) {
        walk(node.items);
      }
    }
  };
  walk(nodes);
  return activeId;
}
