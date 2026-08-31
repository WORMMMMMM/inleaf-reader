export const TRANSLATION_PROVIDERS = ['argos', 'libretranslate', 'deepseek'] as const;
export type TranslationProvider = typeof TRANSLATION_PROVIDERS[number];

export const DEEPSEEK_MODELS = ['deepseek-v4-flash', 'deepseek-v4-pro'] as const;
export type DeepSeekModel = typeof DEEPSEEK_MODELS[number];

export function isTranslationProvider(value: unknown): value is TranslationProvider {
  return TRANSLATION_PROVIDERS.some(provider => provider === value);
}

export function requireTranslationProvider(value: unknown): TranslationProvider {
  const provider = value === undefined ? 'argos' : value;
  if (!isTranslationProvider(provider)) {
    throw new Error(
      `Unsupported translation provider “${String(provider)}”. ` +
      `Choose one of: ${TRANSLATION_PROVIDERS.join(', ')}.`
    );
  }
  return provider;
}

export function requireDeepSeekModel(value: unknown): DeepSeekModel {
  const model = value === undefined ? 'deepseek-v4-flash' : value;
  if (!isDeepSeekModel(model)) {
    throw new Error(
      `Unsupported DeepSeek model “${String(model)}”. ` +
      `Choose one of: ${DEEPSEEK_MODELS.join(', ')}.`
    );
  }
  return model;
}

function isDeepSeekModel(value: unknown): value is DeepSeekModel {
  return DEEPSEEK_MODELS.some(model => model === value);
}
