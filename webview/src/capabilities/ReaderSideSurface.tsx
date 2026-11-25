import React from 'react';
import type { ReaderSurface } from '../../../src/capabilities/contracts';
import { IconClose } from '../components/Icons';
import { useI18n } from '../i18nContext';
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
  onClose,
  onStartResize
}: {
  surface: ReaderSurface;
  title: string;
  activePanel: WorkspaceTab;
  panels: WorkspacePanelContribution[];
  settings: React.ReactNode;
  onActivePanel(id: WorkspaceTab): void;
  onClose(): void;
  onStartResize?(event: React.PointerEvent): void;
}) {
  const { t } = useI18n();
  return (
    <aside className="side-panel" aria-hidden={surface === 'closed'}>
      {onStartResize ? (
        <div
          className="panel-resizer"
          role="separator"
          aria-orientation="vertical"
          onPointerDown={onStartResize}
        />
      ) : null}
      <header className="side-panel-header">
        <div>
          <p className="eyebrow">Inleaf Reader</p>
          <h1 title={surface === 'settings' ? t('settingsTitle') : title}>
            {surface === 'settings' ? t('settingsTitle') : title}
          </h1>
        </div>
        <button
          className="side-panel-close icon-button"
          title={t('close')}
          aria-label={t('close')}
          onClick={onClose}
        >
          <IconClose size={15} />
        </button>
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
          <div className="side-panel-body">
            {panels.find(panel => panel.id === activePanel)?.content}
          </div>
        </>
      )}
    </aside>
  );
}
