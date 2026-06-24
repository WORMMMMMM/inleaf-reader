export interface ReaderConfig {
  pdfUrl: string;
  paperName: string;
  translationProvider?: string;
  translationSource?: string;
  translationTarget?: string;
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

export const vscode = window.acquireVsCodeApi();
export const readerConfig = window.readerConfig;
