import { useState } from 'preact/hooks';
import { Icon } from '@/components/Icon';
import { t } from '@/utils/i18n';
import type { Settings } from '@/utils/settings';
import { Button, inputClass, Section } from './ui';

/** Accepts "example.com", "https://example.com/path" or "*.example.com"-style input. */
export function toHostname(input: string): string | undefined {
  const value = input.trim().toLowerCase();
  if (!value) return undefined;
  try {
    return new URL(value.includes('://') ? value : `https://${value}`).hostname || undefined;
  } catch {
    return undefined;
  }
}

function SiteList({
  title,
  sites,
  onChange,
  placeholder,
}: {
  title: string;
  sites: string[];
  onChange: (sites: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState('');
  const add = () => {
    const host = toHostname(input);
    if (!host) return;
    onChange([...sites.filter((s) => s !== host), host]);
    setInput('');
  };
  return (
    <div class="rounded-xl border border-ink-100 p-4 dark:border-ink-800">
      <h3 class="mb-3 text-sm font-semibold">{title}</h3>
      <form
        class="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          class={inputClass}
          placeholder={placeholder}
          value={input}
          aria-label={title}
          onInput={(e) => setInput((e.currentTarget as HTMLInputElement).value)}
        />
        <Button type="submit" title={t('add')}>
          <Icon name="plus" />
        </Button>
      </form>
      {sites.length === 0 ? (
        <p class="text-xs text-ink-500 dark:text-ink-400">{t('noSites')}</p>
      ) : (
        <ul class="flex flex-wrap gap-1.5">
          {sites.map((site) => (
            <li key={site} class="inline-flex items-center gap-1 rounded-full bg-ink-100 py-1 pr-1 pl-3 text-xs dark:bg-ink-800">
              {site}
              <button
                type="button"
                title={t('delete')}
                aria-label={`${t('delete')} ${site}`}
                class="rounded-full p-0.5 text-ink-500 hover:bg-ink-200 hover:text-ink-900 dark:hover:bg-ink-700 dark:hover:text-white"
                onClick={() => onChange(sites.filter((s) => s !== site))}
              >
                <Icon name="close" size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Sites({ settings, update }: { settings: Settings; update: (patch: Partial<Settings>) => void }) {
  return (
    <Section id="sites" icon="globe" title={t('sectionSites')} description={t('sectionSitesDesc')}>
      <div class="grid gap-3 md:grid-cols-2">
        <SiteList
          title={t('alwaysTranslate')}
          placeholder="news.example.com"
          sites={settings.alwaysTranslate}
          onChange={(sites) =>
            update({ alwaysTranslate: sites, neverTranslate: settings.neverTranslate.filter((s) => !sites.includes(s)) })
          }
        />
        <SiteList
          title={t('neverTranslate')}
          placeholder="bank.example.com"
          sites={settings.neverTranslate}
          onChange={(sites) =>
            update({ neverTranslate: sites, alwaysTranslate: settings.alwaysTranslate.filter((s) => !sites.includes(s)) })
          }
        />
      </div>
    </Section>
  );
}
