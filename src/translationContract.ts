export const TRANSLATION_PROVIDERS = ['argos', 'libretranslate', 'deepseek', 'openai'] as const;
export type TranslationProvider = typeof TRANSLATION_PROVIDERS[number];

export const DEEPSEEK_MODELS = [
  'deepseek-v4-flash',
  'deepseek-v4-pro',
  'deepseek-chat',
  'deepseek-reasoner'
] as const;
export type DeepSeekModel = typeof DEEPSEEK_MODELS[number];

export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

export const OPENAI_PRESETS = [
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { id: 'ollama', label: 'Ollama (Local)', baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5:7b' },
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' }
] as const;

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

export function resolveOpenAiChatUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return `${DEFAULT_OPENAI_BASE_URL}/chat/completions`;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('OpenAI-compatible Base URL must be a valid http(s) URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('OpenAI-compatible Base URL must start with http:// or https://.');
  }
  const normalized = trimmed.replace(/\/+$/, '');
  return normalized.endsWith('/chat/completions')
    ? normalized
    : `${normalized}/chat/completions`;
}

export function isLocalOpenAiEndpoint(baseUrl: string): boolean {
  try {
    const { hostname } = new URL(baseUrl.trim() || DEFAULT_OPENAI_BASE_URL);
    return hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname === '::1'
      || hostname === '[::1]';
  } catch {
    return false;
  }
}

function isDeepSeekModel(value: unknown): value is DeepSeekModel {
  return DEEPSEEK_MODELS.some(model => model === value);
}
