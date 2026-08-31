import React, { useEffect, useRef, useState } from 'react';

const intents = [
  ['解释', '请结合论文上下文解释这段内容。'],
  ['批判分析', '请批判性分析这段内容，并区分有证据支持的局限与推断。'],
  ['联系我的研究', '请将这段内容与我的当前研究联系起来，并严格区分证据与推断。']
] as const;

export function AskCodexActions({ onAsk, onClose }: { onAsk(question: string): void; onClose(): void }) {
  const [question, setQuestion] = useState('');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => inputRef.current?.focus(), []);

  function submit() {
    if (!question.trim()) return;
    onAsk(question.trim());
  }

  return (
    <div className="ask-codex-editor">
      <div className="ask-codex-intents">
        {intents.map(([label, prompt]) => (
          <button key={label} onClick={() => onAsk(prompt)}>{label}</button>
        ))}
      </div>
      <textarea
        ref={inputRef}
        rows={3}
        value={question}
        onChange={event => setQuestion(event.target.value)}
        onKeyDown={event => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            submit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
          }
        }}
        placeholder="围绕这段证据输入问题……"
      />
      <div className="selection-note-actions">
        <button onClick={onClose}>取消</button>
        <button onClick={submit} disabled={!question.trim()}>询问 Codex</button>
      </div>
    </div>
  );
}
