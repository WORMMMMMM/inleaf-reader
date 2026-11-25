import React from 'react';
import { WordDetailsBlock } from '../../components/AnnotationWidgets';
import { useI18n } from '../../i18nContext';
import type { WordDetails } from '../../types';

export function TranslationPanel({
  selectedText,
  output,
  wordDetails
}: {
  selectedText: string;
  output: string;
  wordDetails?: WordDetails;
}) {
  const { t } = useI18n();
  return (
    <section className="side-tab-panel">
      <section className="tool-block">
        <h2>{t('translationSelectionTitle')}</h2>
        {selectedText.trim()
          ? <p className="selection-preview">{selectedText}</p>
          : <div className="empty compact-empty">{t('translationSelectionEmpty')}</div>}
      </section>
      <section className="tool-block">
        <h2>{t('translationResultTitle')}</h2>
        {wordDetails ? <WordDetailsBlock details={wordDetails} /> : null}
        {!wordDetails && output.trim() ? <p className="translation-preview">{output}</p> : null}
        {!wordDetails && !output.trim() ? <div className="empty compact-empty">{t('translationResultEmpty')}</div> : null}
      </section>
    </section>
  );
}
