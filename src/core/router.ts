import type { AiEngine, Secrets, Settings, StandardEngine } from '@/utils/settings';
import { makeBatches } from './batcher';
import { cacheKey, type TranslationCache } from './cache';
import { hashString } from './html';
import { normalizeLanguage } from './languages';
import { type ProviderContext, ProviderError, type ProviderRequest, type TranslationProvider } from './providers/types';
import { Cooldowns, Limiter } from './rate-limit';
import { findStyle, GENERAL_STYLE_ID, isLiteralStyle, STYLE_PRESETS, type TranslationStyle } from './styles/presets';
import { withTimeout } from './timeout';
import type { TranslateRequest, TranslateResponse } from './types';

export interface RouterDeps {
  providers: readonly TranslationProvider[];
  cache: TranslationCache;
  getSettings: () => Promise<Settings>;
  getSecrets: () => Promise<Secrets>;
  cooldowns?: Cooldowns;
  /** Max time a provider may take to report whether it is usable. */
  availabilityTimeoutMs?: number;
}

const AI_ORDER = ['chrome-ai', 'gemini', 'openai'];
const AVAILABILITY_TIMEOUT_MS = 12_000;

export function standardChain(engine: StandardEngine): string[] {
  return engine === 'bing' ? ['bing', 'google', 'chrome-translator'] : ['google', 'bing', 'chrome-translator'];
}

export function aiChain(engine: AiEngine): string[] {
  if (engine === 'auto') return AI_ORDER;
  return [engine === 'chrome' ? 'chrome-ai' : engine, ...AI_ORDER.filter((id) => id !== (engine === 'chrome' ? 'chrome-ai' : engine))];
}

export function styleKey(style: TranslationStyle): string {
  return style.id === GENERAL_STYLE_ID ? GENERAL_STYLE_ID : `${style.id}:${hashString(style.prompt)}`;
}

interface Attempt {
  /** index → translated text */
  done: Map<number, string>;
  detected: string[];
  error?: unknown;
}

export class TranslationRouter {
  private readonly limiters = new Map<string, Limiter>();
  private readonly cooldowns: Cooldowns;
  private readonly byId: Map<string, TranslationProvider>;

  constructor(private readonly deps: RouterDeps) {
    this.cooldowns = deps.cooldowns ?? new Cooldowns();
    this.byId = new Map(deps.providers.map((p) => [p.id, p]));
  }

  async translate(request: TranslateRequest, signal?: AbortSignal): Promise<TranslateResponse> {
    const [settings, secrets] = await Promise.all([this.deps.getSettings(), this.deps.getSecrets()]);
    const ctx: ProviderContext = { settings, secrets, signal };
    const texts = request.texts;
    const results: (string | undefined)[] = texts.map((text) => (text.trim() ? undefined : text));
    const detected: string[] = [];
    const used = new Map<string, number>();
    let lastError: unknown;

    const wantStyle = !isLiteralStyle(request.style);
    const style = wantStyle ? findStyle(request.style, settings.customStyles) : (STYLE_PRESETS[0] as TranslationStyle);
    const literal = STYLE_PRESETS[0] as TranslationStyle;

    const fill = async (chain: string[], useStyle: TranslationStyle) => {
      const key = styleKey(useStyle);
      const keyFor = (i: number) => cacheKey({ ...request, styleKey: key, text: texts[i] as string });
      const missingNow = () => results.flatMap((r, i) => (r === undefined ? [i] : []));

      let missing = missingNow();
      if (missing.length === 0) return;
      const cached = await this.deps.cache.getMany(missing.map(keyFor));
      missing.forEach((i, j) => {
        if (cached[j] !== undefined) results[i] = cached[j];
      });
      if (cached.some((value) => value !== undefined)) used.set('cache', (used.get('cache') ?? 0) + 1);

      for (const id of chain) {
        missing = missingNow();
        if (missing.length === 0) return;
        const provider = this.byId.get(id);
        if (!provider || this.cooldowns.isCoolingDown(id)) continue;
        if (useStyle.id !== GENERAL_STYLE_ID && provider.kind !== 'ai') continue;
        try {
          // A provider that can't even answer whether it's usable is treated as unusable.
          if (
            !(await withTimeout(
              Promise.resolve(provider.isAvailable(ctx)),
              this.deps.availabilityTimeoutMs ?? AVAILABILITY_TIMEOUT_MS,
              provider.label,
            ))
          )
            continue;
        } catch {
          continue;
        }
        const request_: ProviderRequest = { from: request.from, to: request.to, format: request.format, style: useStyle };
        const attempt = await this.runProvider(provider, missing, texts, request_, ctx);
        if (attempt.error) lastError = attempt.error;
        if (attempt.done.size > 0) {
          used.set(id, (used.get(id) ?? 0) + attempt.done.size);
          detected.push(...attempt.detected);
          const pairs: [string, string][] = [];
          for (const [i, text] of attempt.done) {
            results[i] = text;
            pairs.push([keyFor(i), text]);
          }
          await this.deps.cache.setMany(pairs);
        }
      }
    };

    if (wantStyle) await fill(aiChain(settings.aiEngine), style);
    const missingBeforeLiteral = results.some((r) => r === undefined);
    await fill(standardChain(settings.standardEngine), literal);

    if (results.some((r) => r === undefined)) {
      throw lastError instanceof Error ? lastError : new Error('Translation failed');
    }

    return {
      texts: results as string[],
      provider: mostUsed(used) ?? 'cache',
      detected: mostFrequent(detected.map((d) => normalizeLanguage(d) ?? d)),
      styleFallback: wantStyle && missingBeforeLiteral ? true : undefined,
    };
  }

  private limiter(provider: TranslationProvider): Limiter {
    let limiter = this.limiters.get(provider.id);
    if (!limiter) {
      limiter = new Limiter(provider.concurrency, provider.minIntervalMs);
      this.limiters.set(provider.id, limiter);
    }
    return limiter;
  }

  private async runProvider(
    provider: TranslationProvider,
    indices: number[],
    texts: readonly string[],
    request: ProviderRequest,
    ctx: ProviderContext,
  ): Promise<Attempt> {
    const attempt: Attempt = { done: new Map(), detected: [] };
    const lengths = texts.map((t) => t.length);

    const runBatch = async (batch: number[], depth: number): Promise<void> => {
      if (this.cooldowns.isCoolingDown(provider.id)) return;
      try {
        const result = await this.limiter(provider).schedule(() =>
          provider.translate(
            batch.map((i) => texts[i] as string),
            request,
            ctx,
          ),
        );
        if (result.texts.length !== batch.length) {
          throw new ProviderError(`${provider.label} returned ${result.texts.length}/${batch.length} items`, undefined, undefined, true);
        }
        batch.forEach((index, j) => {
          attempt.done.set(index, result.texts[j] as string);
        });
        if (result.detected) attempt.detected.push(...result.detected);
      } catch (error) {
        attempt.error = error;
        if (error instanceof ProviderError && error.isRateLimit) {
          this.cooldowns.mark(provider.id, error.retryAfterMs ?? 60_000);
          return;
        }
        // LLMs sometimes merge/split segments in large batches: retry in halves.
        if (error instanceof ProviderError && error.malformed && batch.length > 1 && depth < 3) {
          const mid = Math.ceil(batch.length / 2);
          await Promise.all([runBatch(batch.slice(0, mid), depth + 1), runBatch(batch.slice(mid), depth + 1)]);
        }
      }
    };

    const batches = makeBatches(lengths, indices, provider.maxBatchChars, provider.maxBatchItems);
    await Promise.all(batches.map((batch) => runBatch(batch, 0)));
    return attempt;
  }
}

function mostUsed(used: Map<string, number>): string | undefined {
  let best: string | undefined;
  let max = 0;
  for (const [id, count] of used) {
    if (id !== 'cache' && count > max) {
      best = id;
      max = count;
    }
  }
  return best ?? (used.has('cache') ? 'cache' : undefined);
}

function mostFrequent(values: string[]): string | undefined {
  const counts = new Map<string, number>();
  let best: string | undefined;
  let max = 0;
  for (const value of values) {
    const count = (counts.get(value) ?? 0) + 1;
    counts.set(value, count);
    if (count > max) {
      best = value;
      max = count;
    }
  }
  return best;
}
