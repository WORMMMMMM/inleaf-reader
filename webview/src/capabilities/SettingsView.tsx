import React, { useEffect, useState } from 'react';
import type { CapabilityDescriptor, CapabilityId, CapabilityPreference } from '../../../src/capabilities/contracts';
import type { TranslationSettingKey, TranslationSettingValue } from '../../../src/capabilities/translation/protocol';
import type { TranslationSettings } from '../../../src/translationTypes';

export function SettingsView({
  capabilities,
  translation,
  onCapabilityChange,
  onMove,
  onTranslationSetting,
  onConfigureDeepSeek,
  onDiagnoseTranslation
}: {
  capabilities: CapabilityDescriptor[];
  translation: TranslationSettings;
  onCapabilityChange(id: CapabilityId, patch: CapabilityPreference): void;
  onMove(id: CapabilityId, direction: -1 | 1): void;
  onTranslationSetting(key: TranslationSettingKey, value: TranslationSettingValue): void;
  onConfigureDeepSeek(): void;
  onDiagnoseTranslation(): void;
}) {
  return (
    <div className="settings-view">
      <section className="settings-section">
        <h2>Reading capabilities</h2>
        <p className="settings-help">Choose which actions are available and which views appear in the reading workspace. Disabling a capability never deletes its data.</p>
        <div className="capability-list">
          {capabilities.map((capability, index) => (
            <article className="capability-card" key={capability.id}>
              <div className="capability-card-heading">
                <div>
                  <h3>{capability.title}</h3>
                  <p>{capability.description}</p>
                </div>
                <span className={`capability-readiness ${capability.readiness}`}>{readinessLabel(capability.readiness)}</span>
              </div>
              {capability.readinessMessage ? <p className="capability-readiness-message">{capability.readinessMessage}</p> : null}
              <label className="toggle-row">
                <input type="checkbox" checked={capability.enabled} onChange={event => onCapabilityChange(capability.id, { enabled: event.target.checked })} />
                <span>Enable capability</span>
              </label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={capability.showInPanel}
                  disabled={!capability.enabled || !capability.contributions.panel}
                  onChange={event => onCapabilityChange(capability.id, { showInPanel: event.target.checked })}
                />
                <span>Show in panel</span>
              </label>
              <div className="capability-order" aria-label={`${capability.title} panel order`}>
                <button className="secondary-button" disabled={index === 0} onClick={() => onMove(capability.id, -1)}>Move up</button>
                <button className="secondary-button" disabled={index === capabilities.length - 1} onClick={() => onMove(capability.id, 1)}>Move down</button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <TranslationSettingsForm
        settings={translation}
        onSetting={onTranslationSetting}
        onConfigureDeepSeek={onConfigureDeepSeek}
        onDiagnose={onDiagnoseTranslation}
      />
    </div>
  );
}

function TranslationSettingsForm({
  settings,
  onSetting,
  onConfigureDeepSeek,
  onDiagnose
}: {
  settings: TranslationSettings;
  onSetting(key: TranslationSettingKey, value: TranslationSettingValue): void;
  onConfigureDeepSeek(): void;
  onDiagnose(): void;
}) {
  return (
    <section className="settings-section">
      <h2>Translation</h2>
      <SettingSelect label="Provider" value={settings.provider} onChange={value => onSetting('provider', value)}>
        <option value="argos">Argos Translate (local)</option>
        <option value="libretranslate">LibreTranslate</option>
        <option value="deepseek">DeepSeek</option>
      </SettingSelect>
      {settings.provider === 'deepseek' ? (
        <>
          <SettingSelect label="DeepSeek model" value={settings.deepSeekModel} onChange={value => onSetting('deepSeekModel', value)}>
            <option value="deepseek-v4-flash">deepseek-v4-flash</option>
            <option value="deepseek-v4-pro">deepseek-v4-pro</option>
          </SettingSelect>
          <div className={`provider-status ${settings.hasDeepSeekApiKey ? 'ready' : 'missing'}`}>
            {settings.hasDeepSeekApiKey ? 'DeepSeek API key is configured.' : 'DeepSeek API key is required.'}
          </div>
          <button className="secondary-button" onClick={onConfigureDeepSeek}>{settings.hasDeepSeekApiKey ? 'Replace API Key' : 'Set API Key'}</button>
        </>
      ) : null}
      <SettingText label="Source language" value={settings.source} onCommit={value => onSetting('source', value)} />
      <SettingText label="Target language" value={settings.target} onCommit={value => onSetting('target', value)} />
      {settings.provider === 'libretranslate' ? (
        <SettingText label="LibreTranslate endpoint" value={settings.libreTranslateEndpoint} onCommit={value => onSetting('libreTranslateEndpoint', value)} />
      ) : null}
      {settings.provider === 'argos' ? (
        <>
          <SettingText label="Argos Python path" value={settings.argosPythonPath} placeholder="Use the bundled .venv-translate path" onCommit={value => onSetting('argosPythonPath', value)} />
          <label className="toggle-row">
            <input type="checkbox" checked={settings.fallbackToLibreTranslate} onChange={event => onSetting('fallbackToLibreTranslate', event.target.checked)} />
            <span>Fall back to LibreTranslate when Argos fails</span>
          </label>
          <div className={`provider-status ${settings.argosPythonFound ? 'ready' : 'missing'}`}>
            {settings.argosPythonFound ? 'Argos Python was found.' : 'Argos is not configured for sentence translation.'}
          </div>
        </>
      ) : null}
      <div className={`provider-status ${settings.dictionaryReady ? 'ready' : 'missing'}`}>
        {settings.dictionaryReady ? 'Offline dictionary is ready.' : 'Offline dictionary is missing.'}
      </div>
      <button className="secondary-button" onClick={onDiagnose}>Diagnose translation setup</button>
    </section>
  );
}

function SettingSelect({ label, value, onChange, children }: { label: string; value: string; onChange(value: string): void; children: React.ReactNode }) {
  return <label className="setting-field"><span>{label}</span><select value={value} onChange={event => onChange(event.target.value)}>{children}</select></label>;
}

function SettingText({ label, value, placeholder, onCommit }: { label: string; value: string; placeholder?: string; onCommit(value: string): void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="setting-field">
      <span>{label}</span>
      <input
        value={draft}
        placeholder={placeholder}
        onChange={event => setDraft(event.target.value)}
        onBlur={() => draft !== value && onCommit(draft)}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

function readinessLabel(readiness: CapabilityDescriptor['readiness']) {
  return readiness === 'needsSetup' ? 'Needs setup' : readiness[0].toUpperCase() + readiness.slice(1);
}
