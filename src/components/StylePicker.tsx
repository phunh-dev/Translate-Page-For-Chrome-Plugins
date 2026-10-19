import { allStyles, type TranslationStyle } from '@/core/styles/presets';
import { t } from '@/utils/i18n';

interface StylePickerProps {
  value: string;
  onChange: (id: string) => void;
  customStyles: TranslationStyle[];
}

export function styleName(style: TranslationStyle): string {
  return style.name ?? t(style.labelKey ?? style.id);
}

export function StylePicker({ value, onChange, customStyles }: StylePickerProps) {
  return (
    <div role="radiogroup" aria-label={t('translationStyle')} class="grid grid-cols-3 gap-1.5">
      {allStyles(customStyles).map((style) => {
        const selected = style.id === value;
        return (
          // biome-ignore lint/a11y/useSemanticElements: styled chips with radio semantics; a native radio cannot be laid out this way
          <button
            key={style.id}
            type="button"
            role="radio"
            aria-checked={selected}
            title={styleName(style)}
            onClick={() => onChange(style.id)}
            class={`flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none ${
              selected
                ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-900/40 dark:text-brand-100'
                : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-850 dark:text-ink-200 dark:hover:border-brand-500'
            }`}
          >
            <span aria-hidden="true">{style.icon}</span>
            <span class="truncate">{styleName(style)}</span>
          </button>
        );
      })}
    </div>
  );
}
