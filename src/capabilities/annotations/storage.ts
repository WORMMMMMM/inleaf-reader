import type { AnnotationRecord } from '../../annotationTypes';
import type { ReaderStorage } from '../../readerStorage';

export interface AnnotationCapabilityStorage {
  read(): Promise<AnnotationRecord[]>;
  add(input: Omit<AnnotationRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<AnnotationRecord[]>;
  update(
    id: string,
    patch: Partial<Omit<AnnotationRecord, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<AnnotationRecord[]>;
  delete(id: string): Promise<AnnotationRecord[]>;
  restore(record: AnnotationRecord): Promise<AnnotationRecord[]>;
  exportMarkdown(): Promise<{ fsPath: string }>;
  exportPdf(): Promise<{ fsPath: string }>;
}

export function annotationStorage(storage: ReaderStorage): AnnotationCapabilityStorage {
  return {
    read: () => storage.readAnnotations(),
    add: input => storage.addAnnotation(input),
    update: (id, patch) => storage.updateAnnotation(id, patch),
    delete: id => storage.deleteAnnotation(id),
    restore: record => storage.restoreAnnotation(record),
    exportMarkdown: () => storage.exportAnnotationsMarkdown(),
    exportPdf: () => storage.exportAnnotatedPdf()
  };
}
