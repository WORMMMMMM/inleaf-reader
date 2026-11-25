import React from 'react';
import { createTranslator, resolveLocale, type ReaderLocale, type Translator } from '../../src/i18n';

export interface I18nContextValue {
  locale: ReaderLocale;
  t: Translator;
}

const defaultLocale = resolveLocale(
  typeof window !== 'undefined' && window.readerConfig?.locale
    ? window.readerConfig.locale
    : typeof navigator !== 'undefined'
      ? navigator.language
      : 'en'
);

export const I18nContext = React.createContext<I18nContextValue>({
  locale: defaultLocale,
  t: createTranslator(defaultLocale)
});

export function useI18n() {
  return React.useContext(I18nContext);
}
