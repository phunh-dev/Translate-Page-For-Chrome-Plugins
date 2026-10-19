import { getLanguageName, isSameLanguage, isSupportedLanguage, LANGUAGES, normalizeLanguage, toBcp47 } from '@/core/languages';
import { toBingCode } from '@/core/providers/bing';

describe('languages', () => {
  it('ships the full Google target list', () => {
    expect(LANGUAGES.length).toBeGreaterThan(200);
    expect(isSupportedLanguage('vi')).toBe(true);
    expect(isSupportedLanguage('zh-CN')).toBe(true);
  });

  it('normalizes browser locales to supported codes', () => {
    expect(normalizeLanguage('en-US')).toBe('en');
    expect(normalizeLanguage('vi')).toBe('vi');
    expect(normalizeLanguage('zh-TW')).toBe('zh-TW');
    expect(normalizeLanguage('zh-Hant-HK')).toBe('zh-TW');
    expect(normalizeLanguage('zh')).toBe('zh-CN');
    expect(normalizeLanguage('he')).toBe('iw');
    expect(normalizeLanguage('pt_PT')).toBe('pt-PT');
    expect(normalizeLanguage('xx-YY')).toBeUndefined();
  });

  it('compares languages loosely but keeps Chinese variants apart', () => {
    expect(isSameLanguage('en-GB', 'en')).toBe(true);
    expect(isSameLanguage('zh-CN', 'zh-TW')).toBe(false);
    expect(isSameLanguage('auto', 'en')).toBe(false);
  });

  it('maps codes for other engines', () => {
    expect(toBcp47('iw')).toBe('he');
    expect(toBcp47('zh-TW')).toBe('zh-Hant');
    expect(toBingCode('zh-CN')).toBe('zh-Hans');
    expect(toBingCode('auto')).toBe('auto-detect');
    expect(toBingCode('no')).toBe('nb');
  });

  it('localizes names with Intl and falls back to English', () => {
    expect(getLanguageName('ja', 'en')).toBe('Japanese');
    expect(getLanguageName('ja', 'vi').toLowerCase()).toContain('nhật');
    expect(getLanguageName('bm-Nkoo', 'en')).toMatch(/Bambara|N'Ko|NKo/i);
  });
});
