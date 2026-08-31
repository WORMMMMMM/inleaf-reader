import type {
  EvidenceLocator,
  PaperBibliography,
  PaperClassification,
  ResearchFactStatus
} from './researchTypes';

export type ResearchReaderMessage =
  | {
      type: 'updateResearchProfile';
      payload: {
        bibliography?: Partial<PaperBibliography>;
        classification?: Partial<PaperClassification>;
      };
    }
  | {
      type: 'addResearchFact';
      payload: {
        field: string;
        value: string;
        status: Extract<ResearchFactStatus, 'suggested' | 'confirmed'>;
        locator?: EvidenceLocator;
      };
    }
  | { type: 'setResearchFactStatus'; payload: { id: string; status: ResearchFactStatus } }
  | { type: 'addRepositoryArtifact'; payload: { url: string; relationship: string } }
  | { type: 'deleteRepositoryArtifact'; payload: { id: string } }
  | { type: 'chooseRepositoryCheckout'; payload: { id: string } }
  | { type: 'refreshRepositoryArtifact'; payload: { id: string } }
  | { type: 'cloneRepositoryArtifact'; payload: { id: string } }
  | { type: 'analyzeRepositoryWithCodex'; payload: { id: string } }
  | { type: 'askCodex'; payload: { question: string; locator: EvidenceLocator; currentPage: number } }
  | { type: 'analyzeComparisonWithCodex'; payload: { comparisonId: string } }
  | { type: 'focusEvidence'; payload: { locator: EvidenceLocator } }
  | { type: 'setCurrentSelection'; payload: { locator?: EvidenceLocator; currentPage: number } }
  | { type: 'chooseLibraryRoot' }
  | { type: 'rebuildLibrary'; payload: { rootPath: string } }
  | { type: 'createComparison'; payload: { fingerprints: string[] } }
  | { type: 'exportComparison'; payload: { comparisonId: string } }
  | { type: 'configureCodexMcp' }
  | { type: 'removeCodexMcp' };
