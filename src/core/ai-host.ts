// Runs wherever Chrome's built-in AI globals exist (offscreen document, options page, or
// the service worker on browsers that expose them there). Everything is feature-detected:
// other Chromium browsers simply report "unavailable".
import { toBcp47 } from './languages';
import { parseModelArray } from './styles/prompt';
import { withTimeout } from './timeout';
import type { LangCode } from './types';

export type AiAvailability = AIAvailability | 'unsupported';

/** Availability checks are local and fast when they work at all. */
const CHECK_MS = 3000;
/** Creating a session for an already-downloaded model. */
const CREATE_MS = 30_000;
/** One translation batch on-device. */
const PROMPT_MS = 90_000;

export interface AiStatus {
  prompt: AiAvailability;
  translator: AiAvailability;
}

function api() {
  const g = globalThis as {
    Translator?: AITranslatorStatic;
    LanguageDetector?: AILanguageDetectorStatic;
    LanguageModel?: AILanguageModelStatic;
  };
  return { translator: g.Translator, detector: g.LanguageDetector, model: g.LanguageModel };
}

export function hasBuiltInAi(): boolean {
  const { translator, model } = api();
  return Boolean(translator || model);
}

export async function aiStatus(): Promise<AiStatus> {
  const { translator, model } = api();
  const safe = async (fn: () => Promise<AIAvailability>): Promise<AiAvailability> => {
    try {
      return await withTimeout(fn(), CHECK_MS, 'AI availability');
    } catch {
      return 'unavailable';
    }
  };
  const [prompt, translatorStatus] = await Promise.all([
    model ? safe(() => model.availability()) : ('unsupported' as const),
    translator ? safe(() => translator.availability({ sourceLanguage: 'en', targetLanguage: 'es' })) : ('unsupported' as const),
  ]);
  return { prompt, translator: translatorStatus };
}

// --- Prompt API (styled translation) ---------------------------------------------------

const sessions = new Map<string, Promise<AILanguageModel>>();

async function baseSession(systemPrompt: string, to: LangCode): Promise<AILanguageModel> {
  const model = api().model;
  if (!model) throw new Error('Prompt API unavailable');
  const key = `${to}\n${systemPrompt}`;
  let session = sessions.get(key);
  if (!session) {
    session = withTimeout(
      model.create({
        initialPrompts: [{ role: 'system', content: systemPrompt }],
        expectedInputs: [{ type: 'text' }],
        expectedOutputs: [{ type: 'text', languages: [toBcp47(to)] }],
      }),
      CREATE_MS,
      'Prompt API session',
    );
    session.catch(() => sessions.delete(key));
    // Keep a handful of warm sessions; each holds model context memory.
    if (sessions.size >= 4) {
      const oldest = sessions.keys().next().value as string;
      sessions
        .get(oldest)
        ?.then((s) => s.destroy())
        .catch(() => undefined);
      sessions.delete(oldest);
    }
    sessions.set(key, session);
  }
  return session;
}

export async function aiPromptTranslate(texts: string[], systemPrompt: string, to: LangCode): Promise<string[]> {
  const base = await baseSession(systemPrompt, to);
  // Clone so earlier batches don't accumulate in the context window.
  const session = await withTimeout(base.clone(), CREATE_MS, 'Prompt API clone');
  try {
    const reply = await withTimeout(
      session.prompt(JSON.stringify(texts), {
        responseConstraint: { type: 'array', items: { type: 'string' }, minItems: texts.length, maxItems: texts.length },
      }),
      PROMPT_MS,
      'Prompt API',
    );
    return parseModelArray(reply, texts.length);
  } finally {
    session.destroy();
  }
}

// --- Translator API (offline literal fallback) ------------------------------------------

const translators = new Map<string, Promise<AITranslator>>();

async function detectLanguage(text: string): Promise<string | undefined> {
  const detector = api().detector;
  if (!detector || (await withTimeout(detector.availability(), CHECK_MS, 'LanguageDetector')) !== 'available') return undefined;
  const instance = await withTimeout(detector.create(), CREATE_MS, 'LanguageDetector');
  try {
    return (await withTimeout(instance.detect(text), CHECK_MS, 'LanguageDetector'))[0]?.detectedLanguage;
  } finally {
    instance.destroy();
  }
}

export async function aiTranslatorTranslate(
  texts: string[],
  from: LangCode,
  to: LangCode,
): Promise<{ texts: string[]; detected?: string }> {
  const translatorApi = api().translator;
  if (!translatorApi) throw new Error('Translator API unavailable');
  const source = from === 'auto' ? await detectLanguage(texts.join('\n').slice(0, 2000)) : toBcp47(from);
  if (!source) throw new Error('Could not detect the source language on-device');
  const options = { sourceLanguage: source, targetLanguage: toBcp47(to) };
  const key = `${options.sourceLanguage}>${options.targetLanguage}`;
  let translator = translators.get(key);
  if (!translator) {
    if ((await withTimeout(translatorApi.availability(options), CHECK_MS, 'Translator availability')) !== 'available') {
      throw new Error(`On-device model for ${key} is not downloaded`);
    }
    translator = withTimeout(translatorApi.create(options), CREATE_MS, 'Translator');
    translator.catch(() => translators.delete(key));
    translators.set(key, translator);
  }
  const instance = await translator;
  const out: string[] = [];
  for (const text of texts) out.push(await withTimeout(instance.translate(text), PROMPT_MS, 'Translator'));
  return { texts: out, detected: source };
}

/**
 * Triggers model downloads (Prompt API model + English → `to` translator pack). Must run
 * from a page with user activation, i.e. the options page.
 */
export async function aiDownload(to: LangCode, onProgress?: (ratio: number) => void): Promise<AiStatus> {
  const { model, translator } = api();
  const monitor = (m: AIDownloadMonitor) => m.addEventListener('downloadprogress', (e) => onProgress?.(e.loaded));
  if (model) {
    const session = await model.create({ monitor, expectedOutputs: [{ type: 'text', languages: [toBcp47(to)] }] });
    session.destroy();
  }
  if (translator && toBcp47(to) !== 'en') {
    const instance = await translator.create({ sourceLanguage: 'en', targetLanguage: toBcp47(to), monitor });
    instance.destroy();
  }
  return aiStatus();
}
