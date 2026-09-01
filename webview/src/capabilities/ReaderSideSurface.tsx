import React from 'react';
import type { ReaderSurface } from '../../../src/capabilities/contracts';
import type { WorkspaceTab } from '../messages';

export interface WorkspacePanelContribution {
  id: WorkspaceTab;
  title: string;
  content: React.ReactNode;
}

export function ReaderSideSurface({
  surface,
  title,
  activePanel,
  panels,
  settings,
  onActivePanel,
  onClose
}: {
  surface: ReaderSurface;
  title: string;
  activePanel: WorkspaceTab;
  panels: WorkspacePanelContribution[];
  settings: React.ReactNode;
  onActivePanel(id: WorkspaceTab): void;
  onClose(): void;
}) {
  return (
    <aside className="side-panel" aria-hidden={surface === 'closed'}>
      <header className="side-panel-header">
        <div>
          <p className="eyebrow">Inleaf Reader</p>
          <h1>{surface === 'settings' ? 'Settings' : title}</h1>
        </div>
        <button className="side-panel-close secondary-button" title="Close" aria-label="Close" onClick={onClose}>×</button>
      </header>

      {surface === 'settings' ? settings : (
        <>
          <nav className="side-tabs" aria-label="Reader panels">
            {panels.map(panel => (
              <button
                key={panel.id}
                className={activePanel === panel.id ? 'active-tab' : ''}
                onClick={() => onActivePanel(panel.id)}
              >
                {panel.title}
              </button>
            ))}
          </nav>
          {panels.find(panel => panel.id === activePanel)?.content}
        </>
      )}
    </aside>
  );
}
