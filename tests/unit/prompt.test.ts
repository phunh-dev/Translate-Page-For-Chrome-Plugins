import { findStyle, isLiteralStyle, STYLE_PRESETS } from '@/core/styles/presets';
import { buildSystemPrompt, parseModelArray } from '@/core/styles/prompt';

describe('style presets', () => {
  it('covers the requested domains', () => {
    const ids = STYLE_PRESETS.map((s) => s.id);
    for (const id of ['technology', 'engineering', 'science', 'medical', 'journalism', 'food', 'magazine']) {
      expect(ids).toContain(id);
    }
  });

  it('treats general/empty as literal', () => {
    expect(isLiteralStyle('general')).toBe(true);
    expect(isLiteralStyle(undefined)).toBe(true);
    expect(isLiteralStyle('medical')).toBe(false);
  });

  it('finds custom styles and falls back to general', () => {
    const custom = [{ id: 'custom-1', name: 'Crypto', icon: '🪙', prompt: 'crypto' }];
    expect(findStyle('custom-1', custom).name).toBe('Crypto');
    expect(findStyle('missing').id).toBe('general');
  });
});

describe('prompt builder', () => {
  it('includes target language, style guide and placeholder rules', () => {
    const prompt = buildSystemPrompt({ from: 'auto', to: 'vi', style: findStyle('medical'), format: 'html' });
    expect(prompt).toContain('Vietnamese (vi)');
    expect(prompt).toContain('medicine');
    expect(prompt).toContain('<x0>');
  });
});

describe('parseModelArray', () => {
  it('accepts bare arrays, wrapped objects and fenced replies', () => {
    expect(parseModelArray('["a","b"]', 2)).toEqual(['a', 'b']);
    expect(parseModelArray('{"translations":["a"]}', 1)).toEqual(['a']);
    expect(parseModelArray('Here you go:\n```json\n["x", "y"]\n```', 2)).toEqual(['x', 'y']);
  });

  it('rejects a wrong item count', () => {
    expect(() => parseModelArray('["a"]', 2)).toThrow();
  });
});
