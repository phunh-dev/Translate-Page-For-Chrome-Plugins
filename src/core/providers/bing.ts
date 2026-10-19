import { normalizeLanguage } from '../languages';
import type { LangCode } from '../types';
import { httpError, ProviderError, type TranslationProvider } from './types';

// Microsoft Translator through the public Bing Translator web page (no API key).
const PAGE_URL = 'https://www.bing.com/translator';
const TRANSLATE_URL = 'https://www.bing.com/ttranslatev3';

interface BingSession {
  ig: string;
  iid: string;
  key: string;
  token: string;
  expiresAt: number;
  count: number;
}

let session: BingSession | undefined;
let pendingSession: Promise<BingSession> | undefined;

/** Google → Microsoft language code differences. */
const TO_BING: Record<string, string> = {
  'zh-CN': 'zh-Hans',
  'zh-TW': 'zh-Hant',
  iw: 'he',
  jw: 'jv',
  tl: 'fil',
  no: 'nb',
  hmn: 'mww',
  ku: 'kmr',
  ckb: 'ku',
  mn: 'mn-Cyrl',
  sr: 'sr-Cyrl',
  'mni-Mtei': 'mni',
  'pt-PT': 'pt-pt',
  'fr-CA': 'fr-ca',
};

export function toBingCode(code: LangCode): string {
  if (code === 'auto') return 'auto-detect';
  return TO_BING[code] ?? code;
}

function fromBingCode(code: string): LangCode {
  if (code === 'kmr') return 'ku';
  if (code === 'ku') return 'ckb';
  return normalizeLanguage(code) ?? code;
}

export function parseBingPage(html: string): Omit<BingSession, 'count'> {
  const ig = html.match(/IG:"([0-9A-F]+)"/i)?.[1];
  const iid = html.match(/data-iid="([^"]+)"/)?.[1] ?? 'translator.5023';
  const helper = html.match(/params_AbusePreventionHelper\s*=\s*\[\s*(\d+)\s*,\s*"([^"]+)"\s*,\s*(\d+)/);
  if (!ig || !helper) throw new ProviderError('Bing: could not read session token');
  const [, key = '', token = '', ttl = '3600000'] = helper;
  return { ig, iid, key, token, expiresAt: Date.now() + Math.min(Number(ttl), 3_600_000) - 60_000 };
}

async function getSession(signal?: AbortSignal, refresh = false): Promise<BingSession> {
  if (!refresh && session && session.expiresAt > Date.now()) return session;
  pendingSession ??= (async () => {
    const response = await fetch(PAGE_URL, { signal, credentials: 'omit' });
    if (!response.ok) throw await httpError('Bing', response);
    session = { ...parseBingPage(await response.text()), count: 0 };
    return session;
  })().finally(() => {
    pendingSession = undefined;
  });
  return pendingSession;
}

interface BingReply {
  translations?: { text: string }[];
  detectedLanguage?: { language: string };
}

async function translateOne(text: string, from: LangCode, to: LangCode, signal?: AbortSignal, retry = true) {
  const s = await getSession(signal);
  s.count += 1;
  const params = new URLSearchParams({ isVertical: '1', IG: s.ig, IID: `${s.iid}.${s.count}` });
  const body = new URLSearchParams({
    fromLang: toBingCode(from),
    to: toBingCode(to),
    text,
    token: s.token,
    key: s.key,
  });
  const response = await fetch(`${TRANSLATE_URL}?${params}`, { method: 'POST', body, signal, credentials: 'omit' });
  if (!response.ok) throw await httpError('Bing', response);
  const data = (await response.json()) as BingReply[] | { statusCode?: number; errorMessage?: string };
  if (!Array.isArray(data)) {
    // Expired/invalid token → refresh once.
    if (retry && (data.statusCode === 205 || data.statusCode === 400)) {
      await getSession(signal, true);
      return translateOne(text, from, to, signal, false);
    }
    const status = data.statusCode === 429 ? 429 : data.statusCode;
    throw new ProviderError(
      `Bing error ${data.statusCode ?? ''} ${data.errorMessage ?? ''}`.trim(),
      status,
      status === 429 ? 60_000 : undefined,
    );
  }
  const translated = data[0]?.translations?.[0]?.text;
  if (typeof translated !== 'string') throw new ProviderError('Unexpected Bing response', undefined, undefined, true);
  const detected = data[0]?.detectedLanguage?.language;
  return { text: translated, detected: detected ? fromBingCode(detected) : undefined };
}

export const bingProvider: TranslationProvider = {
  id: 'bing',
  label: 'Microsoft Bing',
  kind: 'standard',
  maxBatchChars: 1000,
  maxBatchItems: 1,
  concurrency: 3,
  isAvailable: () => true,

  async translate(texts, { from, to }, { signal }) {
    const results = await Promise.all(texts.map((text) => translateOne(text, from, to, signal)));
    const detected = results.flatMap((r) => (r.detected ? [r.detected] : []));
    return { texts: results.map((r) => r.text), detected: detected.length ? detected : undefined };
  },
};
