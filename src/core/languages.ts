import type { LangCode } from './types';

/**
 * Target languages supported by the default engine (Google), as `[code, English name]`.
 * Localized display names come from `Intl.DisplayNames` at runtime; the English name is
 * only a fallback for codes the browser has no name for.
 * Generated from https://translate.googleapis.com/translate_a/l?client=gtx&hl=en
 */
export const LANGUAGES: ReadonlyArray<readonly [LangCode, string]> = [
  ['ab', 'Abkhaz'],
  ['ace', 'Acehnese'],
  ['ach', 'Acholi'],
  ['aa', 'Afar'],
  ['af', 'Afrikaans'],
  ['sq', 'Albanian'],
  ['alz', 'Alur'],
  ['am', 'Amharic'],
  ['ar', 'Arabic'],
  ['hy', 'Armenian'],
  ['as', 'Assamese'],
  ['av', 'Avar'],
  ['awa', 'Awadhi'],
  ['ay', 'Aymara'],
  ['az', 'Azerbaijani'],
  ['ban', 'Balinese'],
  ['bal', 'Baluchi'],
  ['bm', 'Bambara'],
  ['bci', 'Baoulé'],
  ['ba', 'Bashkir'],
  ['eu', 'Basque'],
  ['btx', 'Batak Karo'],
  ['bts', 'Batak Simalungun'],
  ['bbc', 'Batak Toba'],
  ['be', 'Belarusian'],
  ['bem', 'Bemba'],
  ['bn', 'Bengali'],
  ['bew', 'Betawi'],
  ['bho', 'Bhojpuri'],
  ['bik', 'Bikol'],
  ['bs', 'Bosnian'],
  ['br', 'Breton'],
  ['bg', 'Bulgarian'],
  ['bua', 'Buryat'],
  ['yue', 'Cantonese'],
  ['ca', 'Catalan'],
  ['ceb', 'Cebuano'],
  ['ch', 'Chamorro'],
  ['ce', 'Chechen'],
  ['ny', 'Chichewa'],
  ['zh-CN', 'Chinese (Simplified)'],
  ['zh-TW', 'Chinese (Traditional)'],
  ['chk', 'Chuukese'],
  ['cv', 'Chuvash'],
  ['co', 'Corsican'],
  ['crh', 'Crimean Tatar (Cyrillic)'],
  ['crh-Latn', 'Crimean Tatar (Latin)'],
  ['hr', 'Croatian'],
  ['cs', 'Czech'],
  ['da', 'Danish'],
  ['fa-AF', 'Dari'],
  ['dv', 'Dhivehi'],
  ['din', 'Dinka'],
  ['doi', 'Dogri'],
  ['dov', 'Dombe'],
  ['nl', 'Dutch'],
  ['dyu', 'Dyula'],
  ['dz', 'Dzongkha'],
  ['en', 'English'],
  ['eo', 'Esperanto'],
  ['et', 'Estonian'],
  ['ee', 'Ewe'],
  ['fo', 'Faroese'],
  ['fj', 'Fijian'],
  ['tl', 'Filipino'],
  ['fi', 'Finnish'],
  ['fon', 'Fon'],
  ['fr', 'French'],
  ['fr-CA', 'French (Canada)'],
  ['fy', 'Frisian'],
  ['fur', 'Friulian'],
  ['ff', 'Fulani'],
  ['gaa', 'Ga'],
  ['gl', 'Galician'],
  ['ka', 'Georgian'],
  ['de', 'German'],
  ['el', 'Greek'],
  ['gn', 'Guarani'],
  ['gu', 'Gujarati'],
  ['ht', 'Haitian Creole'],
  ['cnh', 'Hakha Chin'],
  ['ha', 'Hausa'],
  ['haw', 'Hawaiian'],
  ['iw', 'Hebrew'],
  ['hil', 'Hiligaynon'],
  ['hi', 'Hindi'],
  ['hmn', 'Hmong'],
  ['hu', 'Hungarian'],
  ['hrx', 'Hunsrik'],
  ['iba', 'Iban'],
  ['is', 'Icelandic'],
  ['ig', 'Igbo'],
  ['ilo', 'Ilocano'],
  ['id', 'Indonesian'],
  ['iu-Latn', 'Inuktut (Latin)'],
  ['iu', 'Inuktut (Syllabics)'],
  ['ga', 'Irish'],
  ['it', 'Italian'],
  ['jam', 'Jamaican Patois'],
  ['ja', 'Japanese'],
  ['jw', 'Javanese'],
  ['kac', 'Jingpo'],
  ['kl', 'Kalaallisut'],
  ['kn', 'Kannada'],
  ['kr', 'Kanuri'],
  ['pam', 'Kapampangan'],
  ['kk', 'Kazakh'],
  ['kha', 'Khasi'],
  ['km', 'Khmer'],
  ['cgg', 'Kiga'],
  ['kg', 'Kikongo'],
  ['rw', 'Kinyarwanda'],
  ['ktu', 'Kituba'],
  ['trp', 'Kokborok'],
  ['kv', 'Komi'],
  ['gom', 'Konkani'],
  ['ko', 'Korean'],
  ['kri', 'Krio'],
  ['ku', 'Kurdish (Kurmanji)'],
  ['ckb', 'Kurdish (Sorani)'],
  ['ky', 'Kyrgyz'],
  ['lo', 'Lao'],
  ['ltg', 'Latgalian'],
  ['la', 'Latin'],
  ['lv', 'Latvian'],
  ['lij', 'Ligurian'],
  ['li', 'Limburgish'],
  ['ln', 'Lingala'],
  ['lt', 'Lithuanian'],
  ['lmo', 'Lombard'],
  ['lg', 'Luganda'],
  ['luo', 'Luo'],
  ['lb', 'Luxembourgish'],
  ['mk', 'Macedonian'],
  ['mad', 'Madurese'],
  ['mai', 'Maithili'],
  ['mak', 'Makassar'],
  ['mg', 'Malagasy'],
  ['ms', 'Malay'],
  ['ms-Arab', 'Malay (Jawi)'],
  ['ml', 'Malayalam'],
  ['mt', 'Maltese'],
  ['mam', 'Mam'],
  ['gv', 'Manx'],
  ['mi', 'Maori'],
  ['mr', 'Marathi'],
  ['mh', 'Marshallese'],
  ['mwr', 'Marwadi'],
  ['mfe', 'Mauritian Creole'],
  ['chm', 'Meadow Mari'],
  ['mni-Mtei', 'Meiteilon (Manipuri)'],
  ['min', 'Minang'],
  ['lus', 'Mizo'],
  ['mn', 'Mongolian'],
  ['my', 'Myanmar (Burmese)'],
  ['nhe', 'Nahuatl (Eastern Huasteca)'],
  ['ndc-ZW', 'Ndau'],
  ['nr', 'Ndebele (South)'],
  ['new', 'Nepalbhasa (Newari)'],
  ['ne', 'Nepali'],
  ['bm-Nkoo', 'NKo'],
  ['no', 'Norwegian'],
  ['nus', 'Nuer'],
  ['oc', 'Occitan'],
  ['or', 'Odia (Oriya)'],
  ['om', 'Oromo'],
  ['os', 'Ossetian'],
  ['pag', 'Pangasinan'],
  ['pap', 'Papiamento'],
  ['ps', 'Pashto'],
  ['fa', 'Persian'],
  ['pl', 'Polish'],
  ['pt', 'Portuguese (Brazil)'],
  ['pt-PT', 'Portuguese (Portugal)'],
  ['pa', 'Punjabi (Gurmukhi)'],
  ['pa-Arab', 'Punjabi (Shahmukhi)'],
  ['qu', 'Quechua'],
  ['kek', 'Qʼeqchiʼ'],
  ['rom', 'Romani'],
  ['ro', 'Romanian'],
  ['rn', 'Rundi'],
  ['ru', 'Russian'],
  ['se', 'Sami (North)'],
  ['sm', 'Samoan'],
  ['sg', 'Sango'],
  ['sa', 'Sanskrit'],
  ['sat-Latn', 'Santali (Latin)'],
  ['sat', 'Santali (Ol Chiki)'],
  ['gd', 'Scots Gaelic'],
  ['nso', 'Sepedi'],
  ['sr', 'Serbian'],
  ['st', 'Sesotho'],
  ['crs', 'Seychellois Creole'],
  ['shn', 'Shan'],
  ['sn', 'Shona'],
  ['scn', 'Sicilian'],
  ['szl', 'Silesian'],
  ['sd', 'Sindhi'],
  ['si', 'Sinhala'],
  ['sk', 'Slovak'],
  ['sl', 'Slovenian'],
  ['so', 'Somali'],
  ['es', 'Spanish'],
  ['su', 'Sundanese'],
  ['sus', 'Susu'],
  ['sw', 'Swahili'],
  ['ss', 'Swati'],
  ['sv', 'Swedish'],
  ['ty', 'Tahitian'],
  ['tg', 'Tajik'],
  ['ber-Latn', 'Tamazight'],
  ['ber', 'Tamazight (Tifinagh)'],
  ['ta', 'Tamil'],
  ['tt', 'Tatar'],
  ['te', 'Telugu'],
  ['tet', 'Tetum'],
  ['th', 'Thai'],
  ['bo', 'Tibetan'],
  ['ti', 'Tigrinya'],
  ['tiv', 'Tiv'],
  ['tpi', 'Tok Pisin'],
  ['to', 'Tongan'],
  ['lua', 'Tshiluba'],
  ['ts', 'Tsonga'],
  ['tn', 'Tswana'],
  ['tcy', 'Tulu'],
  ['tum', 'Tumbuka'],
  ['tr', 'Turkish'],
  ['tk', 'Turkmen'],
  ['tyv', 'Tuvan'],
  ['ak', 'Twi'],
  ['udm', 'Udmurt'],
  ['uk', 'Ukrainian'],
  ['ur', 'Urdu'],
  ['ug', 'Uyghur'],
  ['uz', 'Uzbek'],
  ['ve', 'Venda'],
  ['vec', 'Venetian'],
  ['vi', 'Vietnamese'],
  ['war', 'Waray'],
  ['cy', 'Welsh'],
  ['wo', 'Wolof'],
  ['xh', 'Xhosa'],
  ['sah', 'Yakut'],
  ['yi', 'Yiddish'],
  ['yo', 'Yoruba'],
  ['yua', 'Yucatec Maya'],
  ['zap', 'Zapotec'],
  ['zu', 'Zulu'],
];

const ENGLISH_NAMES = new Map(LANGUAGES);

export function isSupportedLanguage(code: LangCode): boolean {
  return ENGLISH_NAMES.has(code);
}

/** Google codes that differ from the BCP-47 tags `Intl` and on-device models understand. */
const TO_BCP47: Record<string, string> = {
  iw: 'he',
  jw: 'jv',
  'zh-CN': 'zh-Hans',
  'zh-TW': 'zh-Hant',
  'mni-Mtei': 'mni',
};

export function toBcp47(code: LangCode): string {
  return TO_BCP47[code] ?? code;
}

const displayNameCache = new Map<string, Intl.DisplayNames | null>();

function displayNames(uiLocale: string): Intl.DisplayNames | null {
  let names = displayNameCache.get(uiLocale);
  if (names === undefined) {
    try {
      names = new Intl.DisplayNames([uiLocale, 'en'], { type: 'language', fallback: 'none' });
    } catch {
      names = null;
    }
    displayNameCache.set(uiLocale, names);
  }
  return names;
}

/** Language name in the UI locale, e.g. `getLanguageName('ja', 'vi')` → "Tiếng Nhật". */
export function getLanguageName(code: LangCode, uiLocale = 'en'): string {
  const english = ENGLISH_NAMES.get(code);
  const localized = displayNames(uiLocale)?.of(toBcp47(code));
  if (localized && localized !== toBcp47(code)) return capitalize(localized, uiLocale);
  return english ?? code;
}

function capitalize(text: string, locale: string): string {
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

/** Maps a browser/UI locale ("en-US", "vi", "zh-TW", "he") to a supported target code. */
export function normalizeLanguage(locale: string | undefined | null): LangCode | undefined {
  if (!locale) return undefined;
  const tag = locale.replace('_', '-');
  if (isSupportedLanguage(tag)) return tag;
  const lower = tag.toLowerCase();
  if (lower.startsWith('zh')) {
    return /-(tw|hk|mo|hant)/.test(lower) ? 'zh-TW' : 'zh-CN';
  }
  if (lower === 'pt-pt') return 'pt-PT';
  if (lower === 'fr-ca') return 'fr-CA';
  const base = lower.split('-')[0] ?? '';
  const aliases: Record<string, string> = { he: 'iw', jv: 'jw', nb: 'no', nn: 'no', fil: 'tl', mni: 'mni-Mtei' };
  const mapped = aliases[base] ?? base;
  return isSupportedLanguage(mapped) ? mapped : undefined;
}

/** True when two codes denote the same language for "skip already-translated page" checks. */
export function isSameLanguage(a: LangCode | undefined, b: LangCode | undefined): boolean {
  if (!a || !b || a === 'auto' || b === 'auto') return false;
  const na = normalizeLanguage(a);
  const nb = normalizeLanguage(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // zh-CN vs zh-TW are different targets, but pt vs pt-PT / fr vs fr-CA are close enough.
  if (na.startsWith('zh') || nb.startsWith('zh')) return false;
  return na.split('-')[0] === nb.split('-')[0];
}

const RTL = new Set(['ar', 'iw', 'fa', 'fa-AF', 'ur', 'ps', 'sd', 'ug', 'yi', 'dv', 'ckb', 'pa-Arab', 'ms-Arab']);

export function isRtl(code: LangCode): boolean {
  return RTL.has(code);
}
