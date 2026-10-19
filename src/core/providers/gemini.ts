import { DEFAULT_GEMINI_MODEL } from '@/utils/settings';
import { buildSystemPrompt, buildUserPrompt, parseModelArray } from '../styles/prompt';
import { httpError, ProviderError, type TranslationProvider } from './types';

const API = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiReply {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

export const geminiProvider: TranslationProvider = {
  id: 'gemini',
  label: 'Gemini',
  kind: 'ai',
  maxBatchChars: 6000,
  maxBatchItems: 40,
  concurrency: 2,
  // Free tier allows roughly 15 requests per minute on the lite models.
  minIntervalMs: 1000,
  isAvailable: ({ secrets }) => Boolean(secrets.geminiKey),

  async translate(texts, request, { settings, secrets, signal }) {
    const model = (settings.geminiModel || DEFAULT_GEMINI_MODEL).replace(/^models\//, '');
    const response = await fetch(`${API}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': secrets.geminiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildSystemPrompt(request) }] },
        contents: [{ role: 'user', parts: [{ text: buildUserPrompt(texts) }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: { type: 'ARRAY', items: { type: 'STRING' } },
        },
      }),
    });
    if (!response.ok) throw await geminiError(response);
    const data = (await response.json()) as GeminiReply;
    const reply = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!reply) {
      throw new ProviderError(
        `Gemini returned no text (${data.promptFeedback?.blockReason ?? data.candidates?.[0]?.finishReason ?? 'empty'})`,
      );
    }
    try {
      return { texts: parseModelArray(reply, texts.length) };
    } catch (error) {
      throw new ProviderError((error as Error).message, undefined, undefined, true);
    }
  },
};

async function geminiError(response: Response): Promise<ProviderError> {
  if (response.status !== 429) return httpError('Gemini', response);
  // Quota errors carry google.rpc.RetryInfo { retryDelay: "23s" }.
  let retryAfterMs = 60_000;
  try {
    const body = (await response.json()) as { error?: { details?: { retryDelay?: string }[] } };
    const delay = body.error?.details?.find((d) => d.retryDelay)?.retryDelay;
    const seconds = delay ? Number.parseFloat(delay) : Number.NaN;
    if (Number.isFinite(seconds)) retryAfterMs = Math.max(seconds * 1000, 5000);
  } catch {
    // keep default
  }
  return new ProviderError('Gemini rate limit reached', 429, retryAfterMs);
}

/** Models the key can call with generateContent, for the options page picker. */
export async function listGeminiModels(apiKey: string): Promise<string[]> {
  const response = await fetch(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': apiKey } });
  if (!response.ok) throw await httpError('Gemini', response);
  const data = (await response.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
  return (data.models ?? [])
    .filter((m) => m.name.includes('gemini') && m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .sort();
}
