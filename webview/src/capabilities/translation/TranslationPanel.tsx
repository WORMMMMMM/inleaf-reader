import React from 'react';
import { WordDetailsBlock } from '../../components/AnnotationWidgets';
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
  return (
    <section className="side-tab-panel">
      <section className="tool-block">
        <h2>Current Selection</h2>
        {selectedText.trim()
          ? <p className="selection-preview">{selectedText}</p>
          : <div className="empty compact-empty">Select text in the PDF, then use Translate in the selection toolbar.</div>}
      </section>
      <section className="tool-block">
        <h2>Result</h2>
        {wordDetails ? <WordDetailsBlock details={wordDetails} /> : null}
        {!wordDetails && output.trim() ? <p className="translation-preview">{output}</p> : null}
        {!wordDetails && !output.trim() ? <div className="empty compact-empty">No translation yet.</div> : null}
      </section>
    </section>
  );
}
