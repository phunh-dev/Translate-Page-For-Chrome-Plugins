import { getLanguageName } from '../languages';
import type { LangCode, TextFormat } from '../types';
import type { TranslationStyle } from './presets';

export interface PromptInput {
  from: LangCode;
  to: LangCode;
  style: TranslationStyle;
  format: TextFormat;
}

export function buildSystemPrompt({ from, to, style, format }: PromptInput): string {
  const target = `${getLanguageName(to, 'en')} (${to})`;
  const source = from === 'auto' ? 'the source language (detect it)' : `${getLanguageName(from, 'en')} (${from})`;
  const rules = [
    'Return ONLY a JSON array of strings: exactly one translated string per input segment, same count, same order. No commentary, no code fences.',
    format === 'html'
      ? 'Segments contain placeholder tags such as <x0>…</x0> and <x3/>. Keep every placeholder exactly as written (same number), wrapped around the words that correspond to the original wrapped words. Keep HTML entities like &amp; and &lt; escaped.'
      : 'Preserve line breaks.',
    'Do not translate URLs, e-mail addresses, code, file paths, hashtags or @mentions.',
    'If a segment is already in the target language or has nothing to translate, return it unchanged.',
    'Use the punctuation, number and quotation conventions of the target language.',
  ];
  return [
    `You are an expert native-level translator. Translate every segment from ${source} into ${target}.`,
    style.prompt ? `Style guide: ${style.prompt}` : 'Produce an accurate, natural translation.',
    'Rules:',
    ...rules.map((rule, i) => `${i + 1}. ${rule}`),
  ].join('\n');
}

export function buildUserPrompt(texts: readonly string[]): string {
  return JSON.stringify(texts);
}

/**
 * Extracts the translated array from an LLM reply. Accepts a bare JSON array, an object
 * wrapping one (`{"translations": [...]}`), or either inside code fences / prose.
 */
export function parseModelArray(reply: string, expected: number): string[] {
  const candidates: string[] = [reply.trim()];
  const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) candidates.push(fenced[1].trim());
  const first = reply.indexOf('[');
  const last = reply.lastIndexOf(']');
  if (first !== -1 && last > first) candidates.push(reply.slice(first, last + 1));

  for (const candidate of candidates) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      continue;
    }
    const array = Array.isArray(parsed) ? parsed : findArray(parsed);
    if (array && array.length === expected && array.every((item) => typeof item === 'string')) {
      return array as string[];
    }
  }
  throw new Error(`Model reply did not contain a JSON array of ${expected} strings`);
}

function findArray(value: unknown): unknown[] | undefined {
  if (value && typeof value === 'object') {
    for (const inner of Object.values(value)) {
      if (Array.isArray(inner)) return inner;
    }
  }
  return undefined;
}
