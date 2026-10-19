import { browser } from 'wxt/browser';

/** Localized string from `_locales/<lang>/messages.json`; falls back to the key. */
export function t(key: string, substitutions?: string | string[]): string {
  try {
    return browser.i18n.getMessage(key as never, substitutions) || key;
  } catch {
    return key;
  }
}

export function uiLocale(): string {
  try {
    return browser.i18n.getUILanguage();
  } catch {
    return 'en';
  }
}

export const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  bing: 'Microsoft Bing',
  gemini: 'Gemini',
  openai: 'OpenAI-compatible',
  'chrome-ai': 'Chrome AI',
  'chrome-translator': 'Chrome on-device',
  cache: 'Cache',
};

export function providerLabel(id: string | undefined): string {
  return id ? (PROVIDER_LABELS[id] ?? id) : '';
}
