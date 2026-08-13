/** Stable runtime identifiers mirrored by the extension manifest. */
export const INLEAF_IDS = {
  configuration: 'inleafReader',
  webviewType: 'inleafReader.reader',
  walkthrough: 'inleafReader.gettingStarted',
  commands: {
    openReader: 'inleafReader.openReader',
    setDeepSeekApiKey: 'inleafReader.setDeepSeekApiKey',
    clearDeepSeekApiKey: 'inleafReader.clearDeepSeekApiKey',
    diagnoseTranslation: 'inleafReader.diagnoseTranslation'
  },
  globalState: {
    onboardingShown: 'inleafReader.onboardingShown',
    pdfLocationIndex: 'inleafReader.pdfLocationIndex.v1'
  },
  secrets: {
    deepSeekApiKey: 'inleafReader.deepSeekApiKey'
  },
  sidecarDirectory: '.inleaf-reader',
  pdfFingerprintNamespace: 'inleaf-reader-pdf-sample-v1\0'
} as const;
