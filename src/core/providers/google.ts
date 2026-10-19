import { httpError, ProviderError, type ProviderResult, type TranslationProvider } from './types';

// Free endpoint used by Google's own browser integrations; no API key required.
const ENDPOINT = 'https://translate.googleapis.com/translate_a/t';

type GoogleItem = string | [string, string?, ...unknown[]];

export const googleProvider: TranslationProvider = {
  id: 'google',
  label: 'Google',
  kind: 'standard',
  maxBatchChars: 4000,
  maxBatchItems: 100,
  concurrency: 4,
  isAvailable: () => true,

  async translate(texts, { from, to, format }, { signal }) {
    const params = new URLSearchParams({ client: 'gtx', sl: from, tl: to, format: format === 'html' ? 'html' : 'text' });
    const body = new URLSearchParams();
    for (const text of texts) body.append('q', text);

    const response = await fetch(`${ENDPOINT}?${params}`, {
      method: 'POST',
      body,
      signal,
      credentials: 'omit',
    });
    if (!response.ok) throw await httpError('Google', response);
    return parseGoogleResponse(await response.json(), texts.length);
  },
};

/**
 * With `sl=auto` every item is `[translation, detectedLang]`; with an explicit source it is a
 * bare string. A single input may come back unwrapped.
 */
export function parseGoogleResponse(data: unknown, expected: number): ProviderResult {
  const items: GoogleItem[] = typeof data === 'string' ? [data] : Array.isArray(data) ? (data as GoogleItem[]) : [];
  if (items.length !== expected) {
    throw new ProviderError(`Google returned ${items.length} items, expected ${expected}`, undefined, undefined, true);
  }
  const texts: string[] = [];
  const detected: string[] = [];
  for (const item of items) {
    if (typeof item === 'string') {
      texts.push(item);
    } else if (Array.isArray(item) && typeof item[0] === 'string') {
      texts.push(item[0]);
      if (typeof item[1] === 'string') detected.push(item[1]);
    } else {
      throw new ProviderError('Unexpected Google response shape', undefined, undefined, true);
    }
  }
  return { texts, detected: detected.length ? detected : undefined };
}
