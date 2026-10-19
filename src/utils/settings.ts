import { browser } from 'wxt/browser';
import { storage } from 'wxt/utils/storage';
import { normalizeLanguage } from '@/core/languages';
import { GENERAL_STYLE_ID, type TranslationStyle } from '@/core/styles/presets';
import type { DisplayMode, LangCode } from '@/core/types';

export type StandardEngine = 'google' | 'bing';
export type AiEngine = 'auto' | 'chrome' | 'gemini' | 'openai';

export interface Settings {
  targetLang: LangCode;
  style: string;
  displayMode: DisplayMode;
  standardEngine: StandardEngine;
  aiEngine: AiEngine;
  /** Show the floating translate button after selecting text. */
  selectionIcon: boolean;
  /** Don't translate pages that are already in the target language. */
  skipSameLanguage: boolean;
  alwaysTranslate: string[];
  neverTranslate: string[];
  customStyles: TranslationStyle[];
  recentLangs: LangCode[];
  geminiModel: string;
  openaiBaseUrl: string;
  openaiModel: string;
}

/** API keys stay in local storage so they are never synced to the user's Google account. */
export interface Secrets {
  geminiKey: string;
  openaiKey: string;
}

export const DEFAULT_GEMINI_MODEL = 'gemini-flash-lite-latest';

export function defaultSettings(uiLanguage?: string): Settings {
  return {
    targetLang: normalizeLanguage(uiLanguage) ?? 'en',
    style: GENERAL_STYLE_ID,
    displayMode: 'replace',
    standardEngine: 'google',
    aiEngine: 'auto',
    selectionIcon: true,
    skipSameLanguage: true,
    alwaysTranslate: [],
    neverTranslate: [],
    customStyles: [],
    recentLangs: [],
    geminiModel: DEFAULT_GEMINI_MODEL,
    openaiBaseUrl: '',
    openaiModel: '',
  };
}

function uiLanguage(): string | undefined {
  try {
    return browser.i18n.getUILanguage();
  } catch {
    return undefined;
  }
}

const settingsItem = storage.defineItem<Partial<Settings>>('sync:settings', { fallback: {} });
const secretsItem = storage.defineItem<Partial<Secrets>>('local:secrets', { fallback: {} });

export async function getSettings(): Promise<Settings> {
  // Merge over defaults so settings saved by older versions pick up new fields.
  return { ...defaultSettings(uiLanguage()), ...(await settingsItem.getValue()) };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await settingsItem.setValue(next);
  return next;
}

export function watchSettings(callback: (settings: Settings) => void): () => void {
  return settingsItem.watch((value) => callback({ ...defaultSettings(uiLanguage()), ...value }));
}

export async function getSecrets(): Promise<Secrets> {
  return { geminiKey: '', openaiKey: '', ...(await secretsItem.getValue()) };
}

export async function updateSecrets(patch: Partial<Secrets>): Promise<Secrets> {
  const next = { ...(await getSecrets()), ...patch };
  await secretsItem.setValue(next);
  return next;
}

/** Pushes `lang` to the front of the recent list (max 5). */
export function withRecentLang(recent: readonly LangCode[], lang: LangCode): LangCode[] {
  return [lang, ...recent.filter((l) => l !== lang)].slice(0, 5);
}

export function siteRule(settings: Settings, hostname: string): 'always' | 'never' | undefined {
  if (settings.neverTranslate.includes(hostname)) return 'never';
  if (settings.alwaysTranslate.includes(hostname)) return 'always';
  return undefined;
}
