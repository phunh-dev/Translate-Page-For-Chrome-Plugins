import { useState } from 'preact/hooks';
import { Icon } from '@/components/Icon';
import { styleName } from '@/components/StylePicker';
import { STYLE_PRESETS, type TranslationStyle } from '@/core/styles/presets';
import { t } from '@/utils/i18n';
import type { Settings } from '@/utils/settings';
import { Button, Field, inputClass, Section } from './ui';

interface StylesProps {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

const EMPTY = { icon: '✍️', name: '', prompt: '' };

export function Styles({ settings, update }: StylesProps) {
  const [draft, setDraft] = useState<{ id?: string; icon: string; name: string; prompt: string }>(EMPTY);
  const [expanded, setExpanded] = useState<string>();

  const save = () => {
    const name = draft.name.trim();
    const prompt = draft.prompt.trim();
    if (!name || !prompt) return;
    const style: TranslationStyle = {
      id: draft.id ?? `custom-${Date.now().toString(36)}`,
      icon: draft.icon.trim() || '✍️',
      name,
      prompt,
      custom: true,
    };
    const others = settings.customStyles.filter((s) => s.id !== style.id);
    update({ customStyles: draft.id ? settings.customStyles.map((s) => (s.id === style.id ? style : s)) : [...others, style] });
    setDraft(EMPTY);
  };

  const remove = (id: string) => {
    update({
      customStyles: settings.customStyles.filter((s) => s.id !== id),
      style: settings.style === id ? 'general' : settings.style,
    });
  };

  return (
    <Section id="styles" icon="palette" title={t('sectionStyles')} description={t('sectionStylesDesc')}>
      <div class="grid gap-2 sm:grid-cols-2">
        {STYLE_PRESETS.map((style) => (
          <button
            key={style.id}
            type="button"
            onClick={() => setExpanded(expanded === style.id ? undefined : style.id)}
            class="rounded-xl border border-ink-100 p-3 text-left transition hover:border-brand-300 dark:border-ink-800 dark:hover:border-brand-500"
          >
            <span class="flex items-center gap-2 text-sm font-medium">
              <span aria-hidden="true">{style.icon}</span>
              {styleName(style)}
            </span>
            <span class={`mt-1 block text-xs text-ink-500 dark:text-ink-400 ${expanded === style.id ? '' : 'line-clamp-2'}`}>
              {style.prompt || t('styleGeneralDesc')}
            </span>
          </button>
        ))}
      </div>

      <div>
        <h3 class="mb-2 text-sm font-semibold">{t('customStyles')}</h3>
        {settings.customStyles.length === 0 && <p class="mb-3 text-xs text-ink-500 dark:text-ink-400">{t('noCustomStyles')}</p>}
        <ul class="mb-3 space-y-2">
          {settings.customStyles.map((style) => (
            <li key={style.id} class="flex items-start gap-3 rounded-xl border border-ink-100 p-3 dark:border-ink-800">
              <span class="text-lg" aria-hidden="true">
                {style.icon}
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium">{style.name}</p>
                <p class="line-clamp-2 text-xs text-ink-500 dark:text-ink-400">{style.prompt}</p>
              </div>
              <Button
                variant="ghost"
                title={t('edit')}
                onClick={() => setDraft({ id: style.id, icon: style.icon, name: style.name ?? '', prompt: style.prompt })}
              >
                <Icon name="edit" />
              </Button>
              <Button variant="ghost" title={t('delete')} onClick={() => remove(style.id)}>
                <Icon name="trash" />
              </Button>
            </li>
          ))}
        </ul>

        <form
          class="space-y-3 rounded-xl bg-ink-50 p-4 dark:bg-ink-900"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div class="grid grid-cols-[4.5rem_1fr] gap-3">
            <Field label={t('icon')} htmlFor="style-icon">
              <input
                id="style-icon"
                class={`${inputClass} text-center`}
                maxLength={4}
                value={draft.icon}
                onInput={(e) => setDraft({ ...draft, icon: (e.currentTarget as HTMLInputElement).value })}
              />
            </Field>
            <Field label={t('styleNameLabel')} htmlFor="style-name">
              <input
                id="style-name"
                class={inputClass}
                placeholder={t('styleNamePlaceholder')}
                value={draft.name}
                onInput={(e) => setDraft({ ...draft, name: (e.currentTarget as HTMLInputElement).value })}
              />
            </Field>
          </div>
          <Field label={t('stylePromptLabel')} hint={t('stylePromptHint')} htmlFor="style-prompt">
            <textarea
              id="style-prompt"
              rows={3}
              class={inputClass}
              placeholder={t('stylePromptPlaceholder')}
              value={draft.prompt}
              onInput={(e) => setDraft({ ...draft, prompt: (e.currentTarget as HTMLTextAreaElement).value })}
            />
          </Field>
          <div class="flex gap-2">
            <Button type="submit" variant="primary" disabled={!draft.name.trim() || !draft.prompt.trim()}>
              <Icon name={draft.id ? 'check' : 'plus'} />
              {draft.id ? t('saveStyle') : t('addStyle')}
            </Button>
            {draft.id && <Button onClick={() => setDraft(EMPTY)}>{t('cancel')}</Button>}
          </div>
        </form>
      </div>
    </Section>
  );
}
