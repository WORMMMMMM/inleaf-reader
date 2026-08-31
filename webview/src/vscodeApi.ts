import type { TranslationProvider } from '../../src/translationContract';

export interface ReaderConfig {
  documentId: string;
  pdfUrl: string;
  paperName: string;
  translationProvider: TranslationProvider;
  translationSource?: string;
  translationTarget?: string;
  pdfWorkerUrl: string;
  pdfCMapUrl: string;
  pdfStandardFontDataUrl: string;
}

export interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare global {
  interface Window {
    acquireVsCodeApi(): VsCodeApi;
    readerConfig: ReaderConfig;
  }
}

export const readerConfig = window.readerConfig;
const rawVsCode = window.acquireVsCodeApi();
let activeDocumentId = readerConfig.documentId;

export function setActiveDocumentId(documentId: string) {
  activeDocumentId = documentId;
}

export const vscode: VsCodeApi = {
  postMessage(message: unknown) {
    rawVsCode.postMessage({ ...(message as object), documentId: activeDocumentId });
  },
  getState: () => rawVsCode.getState(),
  setState: state => rawVsCode.setState(state)
};
