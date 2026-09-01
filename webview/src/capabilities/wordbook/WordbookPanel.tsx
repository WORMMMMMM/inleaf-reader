import React from 'react';
import { WordItem } from '../../components/AnnotationWidgets';
import type { WordRecord } from '../../types';

export function WordbookPanel({ words, onDelete }: { words: WordRecord[]; onDelete(id: string): void }) {
  return (
    <section className="side-tab-panel list-block">
      <section className="tool-block">
        <h2>Saved Words ({words.length})</h2>
        {words.length ? (
          <div className="list">
            {words.map(item => <WordItem key={item.id} word={item} onDelete={() => onDelete(item.id)} />)}
          </div>
        ) : <div className="empty">No words saved yet.</div>}
      </section>
    </section>
  );
}
