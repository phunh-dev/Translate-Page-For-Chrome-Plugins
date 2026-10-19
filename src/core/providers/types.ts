import type { Secrets, Settings } from '@/utils/settings';
import type { TranslationStyle } from '../styles/presets';
import type { LangCode, TextFormat } from '../types';

export interface ProviderRequest {
  from: LangCode;
  to: LangCode;
  format: TextFormat;
  style: TranslationStyle;
}

export interface ProviderContext {
  settings: Settings;
  secrets: Secrets;
  signal?: AbortSignal;
}

export interface ProviderResult {
  texts: string[];
  /** Detected source language(s), one per text or a single value for the batch. */
  detected?: LangCode[];
}

export interface TranslationProvider {
  id: string;
  /** Display name shown in the UI ("Google", "Gemini"…). */
  label: string;
  /** `ai` providers honour translation styles; `standard` ones translate literally. */
  kind: 'standard' | 'ai';
  maxBatchChars: number;
  maxBatchItems: number;
  /** Requests allowed in flight at once. */
  concurrency: number;
  /** Minimum delay between request starts, to stay under free-tier rate limits. */
  minIntervalMs?: number;
  isAvailable(ctx: ProviderContext): Promise<boolean> | boolean;
  translate(texts: string[], request: ProviderRequest, ctx: ProviderContext): Promise<ProviderResult>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** Set for rate-limit errors: how long the provider should be skipped. */
    readonly retryAfterMs?: number,
    /** The reply was malformed (e.g. wrong array length); retrying with a smaller batch may help. */
    readonly malformed = false,
  ) {
    super(message);
    this.name = 'ProviderError';
  }

  get isRateLimit(): boolean {
    return this.status === 429 || this.retryAfterMs !== undefined;
  }
}

export async function httpError(provider: string, response: Response): Promise<ProviderError> {
  let detail = '';
  try {
    detail = (await response.text()).slice(0, 300);
  } catch {
    // body unavailable
  }
  const retryHeader = response.headers.get('retry-after');
  const retrySeconds = retryHeader ? Number(retryHeader) : Number.NaN;
  const retryAfterMs = response.status === 429 ? (Number.isFinite(retrySeconds) ? retrySeconds * 1000 : 60_000) : undefined;
  return new ProviderError(`${provider} HTTP ${response.status}${detail ? `: ${detail}` : ''}`, response.status, retryAfterMs);
}
