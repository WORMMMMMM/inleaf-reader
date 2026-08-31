/** Stable runtime identifiers mirrored by the extension manifest. */
export const INLEAF_IDS = {
  configuration: 'inleafReader',
  webviewType: 'inleafReader.reader',
  walkthrough: 'inleafReader.gettingStarted',
  commands: {
    quickStart: 'inleafReader.quickStart',
    openReader: 'inleafReader.openReader',
    setDeepSeekApiKey: 'inleafReader.setDeepSeekApiKey',
    clearDeepSeekApiKey: 'inleafReader.clearDeepSeekApiKey',
    diagnoseTranslation: 'inleafReader.diagnoseTranslation',
    chooseLibraryRoot: 'inleafReader.chooseLibraryRoot',
    rebuildLibrary: 'inleafReader.rebuildLibrary',
    configureCodexMcp: 'inleafReader.configureCodexMcp',
    removeCodexMcp: 'inleafReader.removeCodexMcp'
  },
  globalState: {
    onboardingShown: 'inleafReader.onboardingShown',
    pdfLocationIndex: 'inleafReader.pdfLocationIndex.v1',
    libraryRoots: 'inleafReader.libraryRoots.v1',
    codexSessions: 'inleafReader.codexSessions.v1'
  },
  secrets: {
    deepSeekApiKey: 'inleafReader.deepSeekApiKey'
  },
  sidecarDirectory: '.inleaf-reader',
  pdfFingerprintNamespace: 'inleaf-reader-pdf-sample-v1\0'
} as const;
