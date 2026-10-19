import { buildSystemPrompt, buildUserPrompt, parseModelArray } from '../styles/prompt';
import { httpError, ProviderError, type TranslationProvider } from './types';

/** Free or local OpenAI-compatible endpoints users can pick from in the options page. */
export const OPENAI_PRESETS = [
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    keyUrl: 'https://console.groq.com/keys',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    keyUrl: 'https://openrouter.ai/keys',
  },
  { id: 'ollama', label: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5:7b', keyUrl: '' },
  { id: 'lmstudio', label: 'LM Studio (local)', baseUrl: 'http://localhost:1234/v1', model: '', keyUrl: '' },
] as const;

interface ChatReply {
  choices?: { message?: { content?: string } }[];
}

export function chatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl.trim().replace(/\/+$/, '')}/chat/completions`;
}

export const openaiProvider: TranslationProvider = {
  id: 'openai',
  label: 'OpenAI-compatible',
  kind: 'ai',
  maxBatchChars: 6000,
  maxBatchItems: 40,
  concurrency: 2,
  minIntervalMs: 500,
  isAvailable: ({ settings }) => Boolean(settings.openaiBaseUrl && settings.openaiModel),

  async translate(texts, request, { settings, secrets, signal }) {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (secrets.openaiKey) headers.authorization = `Bearer ${secrets.openaiKey}`;
    const response = await fetch(chatCompletionsUrl(settings.openaiBaseUrl), {
      method: 'POST',
      signal,
      headers,
      body: JSON.stringify({
        model: settings.openaiModel,
        temperature: 0.2,
        messages: [
          { role: 'system', content: buildSystemPrompt(request) },
          { role: 'user', content: buildUserPrompt(texts) },
        ],
      }),
    });
    if (!response.ok) throw await httpError('OpenAI-compatible', response);
    const data = (await response.json()) as ChatReply;
    const reply = data.choices?.[0]?.message?.content ?? '';
    try {
      return { texts: parseModelArray(reply, texts.length) };
    } catch (error) {
      throw new ProviderError((error as Error).message, undefined, undefined, true);
    }
  },
};
