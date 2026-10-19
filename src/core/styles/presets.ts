export interface TranslationStyle {
  id: string;
  /** i18n message key for presets; custom styles carry a literal `name` instead. */
  labelKey?: string;
  name?: string;
  icon: string;
  /** Instructions appended to the translator system prompt. Empty for the literal style. */
  prompt: string;
  custom?: boolean;
}

export const GENERAL_STYLE_ID = 'general';

export const STYLE_PRESETS: readonly TranslationStyle[] = [
  {
    id: GENERAL_STYLE_ID,
    labelKey: 'styleGeneral',
    icon: '🌐',
    prompt: '',
  },
  {
    id: 'technology',
    labelKey: 'styleTechnology',
    icon: '💻',
    prompt:
      'Domain: software and information technology. Use the established technical terminology of the target language; keep API names, code identifiers, CLI commands, product names and widely used English terms (e.g. "commit", "framework", "cloud") in English when that is what practitioners write. Be precise and concise.',
  },
  {
    id: 'engineering',
    labelKey: 'styleEngineering',
    icon: '⚙️',
    prompt:
      'Domain: mechanical, electrical, civil and industrial engineering. Use standard engineering terminology and units, keep part numbers, standards (ISO, IEC, ASTM…) and formulas unchanged, and favour an exact, specification-like register.',
  },
  {
    id: 'science',
    labelKey: 'styleScience',
    icon: '🔬',
    prompt:
      'Domain: natural sciences and research papers. Use formal academic register and the accepted scientific nomenclature of the target language; keep Latin species names, chemical formulas, symbols and citations unchanged.',
  },
  {
    id: 'medical',
    labelKey: 'styleMedical',
    icon: '🩺',
    prompt:
      'Domain: medicine, pharmacy and healthcare. Use the official medical terminology of the target language (anatomy, diseases, drugs by their international non-proprietary names), preserve dosages, units and abbreviations exactly, and never simplify or omit clinical information.',
  },
  {
    id: 'legal',
    labelKey: 'styleLegal',
    icon: '⚖️',
    prompt:
      'Domain: law, contracts and regulations. Use formal legal register and the equivalent legal terms of the target jurisdiction language; keep defined terms consistent, preserve clause numbering and do not paraphrase obligations.',
  },
  {
    id: 'finance',
    labelKey: 'styleFinance',
    icon: '💹',
    prompt:
      'Domain: finance, banking, accounting and markets. Use standard financial terminology, keep tickers, currency codes and figures unchanged, and use the number formatting conventions of the target language.',
  },
  {
    id: 'journalism',
    labelKey: 'styleJournalism',
    icon: '📰',
    prompt:
      'Domain: news reporting. Write like a professional journalist of the target language: neutral, clear and factual, with short sentences; render headlines in natural headline style, keep names, quotes and attributions accurate.',
  },
  {
    id: 'food',
    labelKey: 'styleFood',
    icon: '🍳',
    prompt:
      'Domain: food, recipes and restaurants. Use natural culinary vocabulary of the target language, keep dish names that are commonly left untranslated, keep quantities and units exactly as written, and make instructions read like a well-written cookbook.',
  },
  {
    id: 'magazine',
    labelKey: 'styleMagazine',
    icon: '✨',
    prompt:
      'Domain: lifestyle, fashion, travel and entertainment magazines. Use a lively, engaging and fluent editorial voice; adapt idioms and wordplay naturally instead of translating them literally.',
  },
  {
    id: 'academic',
    labelKey: 'styleAcademic',
    icon: '🎓',
    prompt:
      'Domain: academic and educational writing. Use a formal, objective register, precise terminology and well-structured sentences; keep citations, references and technical terms intact.',
  },
  {
    id: 'marketing',
    labelKey: 'styleMarketing',
    icon: '📣',
    prompt:
      'Domain: marketing and advertising copy. Transcreate rather than translate: persuasive, catchy and natural for native readers, keeping brand names and the intended call to action.',
  },
  {
    id: 'gaming',
    labelKey: 'styleGaming',
    icon: '🎮',
    prompt:
      'Domain: video games and gaming communities. Use the vocabulary players of the target language actually use; keep game titles, character names, item names and common gaming jargon (buff, nerf, DPS…) as players write them.',
  },
  {
    id: 'literature',
    labelKey: 'styleLiterature',
    icon: '📚',
    prompt:
      "Domain: fiction and literary prose. Preserve the author's voice, tone, rhythm and imagery; render dialogue naturally and favour literary fluency over literal accuracy.",
  },
  {
    id: 'casual',
    labelKey: 'styleCasual',
    icon: '💬',
    prompt:
      'Register: casual and conversational, like social media posts or chat. Use natural everyday language, slang equivalents and contractions where a native speaker would.',
  },
];

export function isLiteralStyle(styleId: string | undefined | null): boolean {
  return !styleId || styleId === GENERAL_STYLE_ID;
}

export function findStyle(styleId: string | undefined | null, customStyles: readonly TranslationStyle[] = []): TranslationStyle {
  return (
    STYLE_PRESETS.find((s) => s.id === styleId) ?? customStyles.find((s) => s.id === styleId) ?? (STYLE_PRESETS[0] as TranslationStyle)
  );
}

export function allStyles(customStyles: readonly TranslationStyle[] = []): TranslationStyle[] {
  return [...STYLE_PRESETS, ...customStyles.map((s) => ({ ...s, custom: true }))];
}
