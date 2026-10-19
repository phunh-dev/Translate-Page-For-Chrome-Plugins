import { browser } from 'wxt/browser';
import { type AiStatus, aiPromptTranslate, aiStatus, aiTranslatorTranslate, hasBuiltInAi } from '../ai-host';
import { buildSystemPrompt } from '../styles/prompt';
import { withTimeout } from '../timeout';
import type { LangCode } from '../types';
import { ProviderError, type TranslationProvider } from './types';

/** Messages handled by the offscreen document (see entrypoints/offscreen). */
export type AiHostMessage =
  | { target: 'offscreen'; type: 'ai:status' }
  | { target: 'offscreen'; type: 'ai:prompt'; texts: string[]; systemPrompt: string; to: LangCode }
  | { target: 'offscreen'; type: 'ai:translator'; texts: string[]; from: LangCode; to: LangCode };

export type AiHostReply = { ok: true; data: unknown } | { ok: false; error: string };

export async function handleAiHostMessage(message: AiHostMessage): Promise<unknown> {
  switch (message.type) {
    case 'ai:status':
      return aiStatus();
    case 'ai:prompt':
      return aiPromptTranslate(message.texts, message.systemPrompt, message.to);
    case 'ai:translator':
      return aiTranslatorTranslate(message.texts, message.from, message.to);
  }
}

const OFFSCREEN_PATH = '/offscreen.html';
let creatingOffscreen: Promise<void> | undefined;

async function ensureOffscreen(): Promise<boolean> {
  if (!browser.offscreen?.createDocument) return false;
  const contexts = await browser.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT' as never] });
  if (contexts.length > 0) return true;
  creatingOffscreen ??= browser.offscreen
    .createDocument({
      url: browser.runtime.getURL(OFFSCREEN_PATH),
      reasons: ['WORKERS' as never],
      justification: 'Runs the on-device translation and language models (Chrome built-in AI).',
    })
    .finally(() => {
      creatingOffscreen = undefined;
    });
  await creatingOffscreen;
  return true;
}

/** Calls the AI host in this context when the APIs exist here, otherwise in the offscreen document. */
async function callHost<T>(message: AiHostMessage): Promise<T> {
  if (hasBuiltInAi()) return (await handleAiHostMessage(message)) as T;
  if (!(await ensureOffscreen())) throw new ProviderError('Offscreen documents are not supported');
  // The offscreen host applies its own timeouts; this one covers a host that never answers.
  const reply = (await withTimeout(browser.runtime.sendMessage(message), 120_000, 'On-device AI host')) as AiHostReply | undefined;
  if (!reply) throw new ProviderError('No reply from the on-device AI host');
  if (!reply.ok) throw new ProviderError(reply.error);
  return reply.data as T;
}

let statusCache: { value: AiStatus; at: number } | undefined;

export async function getAiStatus(force = false): Promise<AiStatus> {
  if (!force && statusCache && Date.now() - statusCache.at < 60_000) return statusCache.value;
  let value: AiStatus;
  try {
    value = await withTimeout(callHost<AiStatus>({ target: 'offscreen', type: 'ai:status' }), 10_000, 'AI status');
  } catch {
    value = { prompt: 'unsupported', translator: 'unsupported' };
  }
  statusCache = { value, at: Date.now() };
  return value;
}

/** Gemini Nano through the Prompt API: free, private, honours translation styles. */
export const chromeAiProvider: TranslationProvider = {
  id: 'chrome-ai',
  label: 'Chrome AI',
  kind: 'ai',
  maxBatchChars: 2500,
  maxBatchItems: 20,
  concurrency: 1,
  isAvailable: async () => (await getAiStatus()).prompt === 'available',

  async translate(texts, request) {
    try {
      const out = await callHost<string[]>({
        target: 'offscreen',
        type: 'ai:prompt',
        texts,
        systemPrompt: buildSystemPrompt(request),
        to: request.to,
      });
      return { texts: out };
    } catch (error) {
      throw error instanceof ProviderError ? error : new ProviderError((error as Error).message, undefined, undefined, true);
    }
  },
};

/** Translator API: literal, offline last resort when the free web engines are unreachable. */
export const chromeTranslatorProvider: TranslationProvider = {
  id: 'chrome-translator',
  label: 'Chrome on-device',
  kind: 'standard',
  maxBatchChars: 4000,
  maxBatchItems: 50,
  concurrency: 1,
  isAvailable: async () => (await getAiStatus()).translator !== 'unsupported',

  async translate(texts, { from, to }) {
    const out = await callHost<{ texts: string[]; detected?: string }>({ target: 'offscreen', type: 'ai:translator', texts, from, to });
    return { texts: out.texts, detected: out.detected ? [out.detected] : undefined };
  },
};
