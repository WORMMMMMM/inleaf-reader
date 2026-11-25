import React, { useEffect, useState } from 'react';
import type { CapabilityDescriptor, CapabilityId, CapabilityPreference } from '../../../src/capabilities/contracts';
import type { TranslationSettingKey, TranslationSettingValue } from '../../../src/capabilities/translation/protocol';
import { isLocalOpenAiEndpoint, OPENAI_PRESETS } from '../../../src/translationContract';
import type { TranslationSettings } from '../../../src/translationTypes';
import { useI18n } from '../i18nContext';

export function SettingsView({
  capabilities,
  translation,
  syncAiContext,
  onCapabilityChange,
  onMove,
  onTranslationSetting,
  onConfigureDeepSeek,
  onConfigureOpenAi,
  onDiagnoseTranslation,
  onSyncAiContextChange
}: {
  capabilities: CapabilityDescriptor[];
  translation: TranslationSettings;
  syncAiContext: boolean;
  onCapabilityChange(id: CapabilityId, patch: CapabilityPreference): void;
  onMove(id: CapabilityId, direction: -1 | 1): void;
  onTranslationSetting(key: TranslationSettingKey, value: TranslationSettingValue): void;
  onConfigureDeepSeek(): void;
  onConfigureOpenAi(): void;
  onDiagnoseTranslation(): void;
  onSyncAiContextChange(enabled: boolean): void;
}) {
  const { t } = useI18n();

  function capabilityTitle(capability: CapabilityDescriptor) {
    if (capability.id === 'annotations') return t('capAnnotationsTitle');
    if (capability.id === 'wordbook') return t('capWordbookTitle');
    if (capability.id === 'translation') return t('capTranslationTitle');
    return capability.title;
  }

  function capabilityDescription(capability: CapabilityDescriptor) {
    if (capability.id === 'annotations') return t('capAnnotationsDesc');
    if (capability.id === 'wordbook') return t('capWordbookDesc');
    if (capability.id === 'translation') return t('capTranslationDesc');
    return capability.description;
  }

  function readinessLabel(readiness: CapabilityDescriptor['readiness']) {
    if (readiness === 'ready') return t('readinessReady');
    if (readiness === 'needsSetup') return t('readinessNeedsSetup');
    if (readiness === 'unavailable') return t('readinessUnavailable');
    return t('readinessError');
  }

  return (
    <div className="settings-view">
      <section className="settings-section">
        <h2>{t('settingsCapabilitiesHeading')}</h2>
        <p className="settings-help">{t('settingsCapabilitiesHelp')}</p>
        <div className="capability-list">
          {capabilities.map((capability, index) => (
            <article className="capability-card" key={capability.id}>
              <div className="capability-card-heading">
                <div>
                  <h3>{capabilityTitle(capability)}</h3>
                  <p>{capabilityDescription(capability)}</p>
                </div>
                <span className={`capability-readiness ${capability.readiness}`}>
                  {readinessLabel(capability.readiness)}
                </span>
              </div>
              {capability.readinessMessage ? (
                <p className="capability-readiness-message">{capability.readinessMessage}</p>
              ) : null}
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={capability.enabled}
                  onChange={event => onCapabilityChange(capability.id, { enabled: event.target.checked })}
                />
                <span>{t('enableCapability')}</span>
              </label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={capability.enabled && capability.showInPanel}
                  disabled={!capability.enabled || !capability.contributions.panel}
                  onChange={event => onCapabilityChange(capability.id, { showInPanel: event.target.checked })}
                />
                <span>{t('showInPanel')}</span>
              </label>
              <div className="capability-order" aria-label={`${capability.title} panel order`}>
                <button className="secondary-button" disabled={index === 0} onClick={() => onMove(capability.id, -1)}>
                  {t('moveUp')}
                </button>
                <button className="secondary-button" disabled={index === capabilities.length - 1} onClick={() => onMove(capability.id, 1)}>
                  {t('moveDown')}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <TranslationSettingsForm
        settings={translation}
        onSetting={onTranslationSetting}
        onConfigureDeepSeek={onConfigureDeepSeek}
        onConfigureOpenAi={onConfigureOpenAi}
        onDiagnose={onDiagnoseTranslation}
      />

      <section className="settings-section">
        <h2>{t('settingsAiHeading')}</h2>
        <p className="settings-help">{t('settingsAiHelp')}</p>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={syncAiContext}
            onChange={event => onSyncAiContextChange(event.target.checked)}
          />
          <span>{t('syncAiContextLabel')}</span>
        </label>
      </section>
    </div>
  );
}

function TranslationSettingsForm({
  settings,
  onSetting,
  onConfigureDeepSeek,
  onConfigureOpenAi,
  onDiagnose
}: {
  settings: TranslationSettings;
  onSetting(key: TranslationSettingKey, value: TranslationSettingValue): void;
  onConfigureDeepSeek(): void;
  onConfigureOpenAi(): void;
  onDiagnose(): void;
}) {
  const { t } = useI18n();
  const isLocalOpenAi = isLocalOpenAiEndpoint(settings.openAiBaseUrl);

  return (
    <section className="settings-section">
      <h2>{t('settingsTranslationHeading')}</h2>
      <SettingSelect label={t('providerLabel')} value={settings.provider} onChange={value => onSetting('provider', value)}>
        <option value="argos">{t('providerArgos')}</option>
        <option value="libretranslate">{t('providerLibreTranslate')}</option>
        <option value="deepseek">{t('providerDeepSeek')}</option>
        <option value="openai">{t('providerOpenAi')}</option>
      </SettingSelect>

      {settings.provider === 'deepseek' ? (
        <>
          <SettingSelect label={t('deepSeekModelLabel')} value={settings.deepSeekModel} onChange={value => onSetting('deepSeekModel', value)}>
            <option value="deepseek-v4-flash">deepseek-v4-flash</option>
            <option value="deepseek-v4-pro">deepseek-v4-pro</option>
            <option value="deepseek-chat">deepseek-chat</option>
            <option value="deepseek-reasoner">deepseek-reasoner</option>
          </SettingSelect>
          <div className={`provider-status ${settings.hasDeepSeekApiKey ? 'ready' : 'missing'}`}>
            {settings.hasDeepSeekApiKey ? t('deepSeekKeyConfigured') : t('deepSeekKeyRequired')}
          </div>
          <button className="secondary-button" onClick={onConfigureDeepSeek}>
            {settings.hasDeepSeekApiKey ? t('replaceApiKey') : t('setApiKey')}
          </button>
        </>
      ) : null}

      {settings.provider === 'openai' ? (
        <>
          <div className="setting-field">
            <span>{t('openAiPresetsLabel')}</span>
            <div className="preset-row">
              {OPENAI_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  className="secondary-button preset-chip"
                  onClick={() => {
                    onSetting('openAiBaseUrl', preset.baseUrl);
                    onSetting('openAiModel', preset.model);
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <SettingText
            label={t('openAiBaseUrlLabel')}
            value={settings.openAiBaseUrl}
            placeholder="https://api.openai.com/v1"
            onCommit={value => onSetting('openAiBaseUrl', value)}
          />
          <SettingText
            label={t('openAiModelLabel')}
            value={settings.openAiModel}
            placeholder="gpt-4o-mini"
            onCommit={value => onSetting('openAiModel', value)}
          />
          <div className={`provider-status ${settings.hasOpenAiApiKey || isLocalOpenAi ? 'ready' : 'missing'}`}>
            {settings.hasOpenAiApiKey
              ? t('openAiKeyConfigured')
              : isLocalOpenAi
                ? t('openAiKeyOptionalLocal')
                : t('openAiKeyRequired')}
          </div>
          <button className="secondary-button" onClick={onConfigureOpenAi}>
            {settings.hasOpenAiApiKey ? t('replaceApiKey') : t('setApiKey')}
          </button>
        </>
      ) : null}

      <div className="setting-two-col">
        <SettingText label={t('sourceLanguageLabel')} value={settings.source} onCommit={value => onSetting('source', value)} />
        <SettingText label={t('targetLanguageLabel')} value={settings.target} onCommit={value => onSetting('target', value)} />
      </div>

      {settings.provider === 'libretranslate' ? (
        <SettingText
          label={t('libreEndpointLabel')}
          value={settings.libreTranslateEndpoint}
          onCommit={value => onSetting('libreTranslateEndpoint', value)}
        />
      ) : null}

      {settings.provider === 'argos' ? (
        <>
          <SettingText
            label={t('argosPythonPathLabel')}
            value={settings.argosPythonPath}
            placeholder={t('argosPythonPlaceholder')}
            onCommit={value => onSetting('argosPythonPath', value)}
          />
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={settings.fallbackToLibreTranslate}
              onChange={event => onSetting('fallbackToLibreTranslate', event.target.checked)}
            />
            <span>{t('fallbackLibreLabel')}</span>
          </label>
          <div className={`provider-status ${settings.argosPythonFound ? 'ready' : 'missing'}`}>
            {settings.argosPythonFound ? t('argosPythonFound') : t('argosPythonMissing')}
          </div>
        </>
      ) : null}

      <div className={`provider-status ${settings.dictionaryReady ? 'ready' : 'missing'}`}>
        {settings.dictionaryReady ? t('dictionaryReady') : t('dictionaryMissing')}
      </div>
      <button className="secondary-button" onClick={onDiagnose}>{t('diagnoseTranslation')}</button>
    </section>
  );
}

function SettingSelect({ label, value, onChange, children }: { label: string; value: string; onChange(value: string): void; children: React.ReactNode }) {
  return (
    <label className="setting-field">
      <span>{label}</span>
      <select value={value} onChange={event => onChange(event.target.value)}>{children}</select>
    </label>
  );
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
