import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { getLanguageName, LANGUAGES } from '@/core/languages';
import { t, uiLocale } from '@/utils/i18n';
import { Icon } from './Icon';

interface LanguagePickerProps {
  value: string;
  onChange: (code: string) => void;
  recent?: string[];
  id?: string;
}

interface Option {
  code: string;
  name: string;
  english: string;
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function LanguagePicker({ value, onChange, recent = [], id }: LanguagePickerProps) {
  const locale = uiLocale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const options = useMemo<Option[]>(
    () =>
      LANGUAGES.map(([code, english]) => ({ code, english, name: getLanguageName(code, locale) })).sort((a, b) =>
        a.name.localeCompare(b.name, locale),
      ),
    [locale],
  );

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) {
      const recentOptions = recent.flatMap((code) => options.filter((o) => o.code === code));
      return { recent: recentOptions, all: options };
    }
    const match = options.filter(
      (o) => normalize(o.name).includes(q) || normalize(o.english).includes(q) || o.code.toLowerCase().startsWith(q),
    );
    return { recent: [] as Option[], all: match };
  }, [query, options, recent]);

  const flat = [...visible.recent, ...visible.all];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (code: string) => {
    onChange(code);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const option = flat[active];
      if (option) choose(option.code);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const renderOption = (option: Option, index: number) => (
    <div
      key={`${index}-${option.code}`}
      data-index={index}
      role="option"
      id={`tpc-lang-${index}`}
      tabIndex={-1}
      aria-selected={option.code === value}
      class={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm ${
        index === active ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200' : ''
      }`}
      onMouseEnter={() => setActive(index)}
      onMouseDown={(e) => {
        e.preventDefault();
        choose(option.code);
      }}
    >
      <span class="truncate">
        {option.name}
        {option.name !== option.english && <span class="ml-1.5 text-xs text-ink-400">{option.english}</span>}
      </span>
      {option.code === value && <Icon name="check" size={14} class="shrink-0 text-brand-600 dark:text-brand-300" />}
    </div>
  );

  return (
    <div class="relative" ref={rootRef}>
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        class="flex w-full items-center justify-between gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 text-left text-sm font-medium shadow-sm transition hover:border-brand-300 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none dark:border-ink-700 dark:bg-ink-850 dark:hover:border-brand-500"
        onClick={() => {
          setOpen(!open);
          setActive(
            Math.max(
              0,
              flat.findIndex((o) => o.code === value),
            ),
          );
        }}
      >
        <span class="truncate">{getLanguageName(value, locale)}</span>
        <Icon name="chevron" size={14} class="shrink-0 text-ink-400" />
      </button>
      {open && (
        <div class="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-ink-200 bg-white shadow-xl dark:border-ink-700 dark:bg-ink-850">
          <div class="flex items-center gap-2 border-b border-ink-100 px-3 dark:border-ink-700">
            <Icon name="search" size={14} class="text-ink-400" />
            <input
              // biome-ignore lint/a11y/noAutofocus: the search box is the purpose of opening the picker
              autoFocus
              value={query}
              placeholder={t('searchLanguage')}
              aria-label={t('searchLanguage')}
              aria-controls="tpc-lang-list"
              aria-activedescendant={`tpc-lang-${active}`}
              class="w-full bg-transparent py-2 text-sm outline-none placeholder:text-ink-400"
              onInput={(e) => {
                setQuery((e.currentTarget as HTMLInputElement).value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
            />
          </div>
          <div ref={listRef} role="listbox" id="tpc-lang-list" class="scrollbar-thin max-h-60 overflow-y-auto p-1">
            {visible.recent.length > 0 && (
              <div class="px-2.5 pt-1 pb-0.5 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">{t('recentLanguages')}</div>
            )}
            {visible.recent.map((o, i) => renderOption(o, i))}
            {visible.recent.length > 0 && (
              <div class="px-2.5 pt-2 pb-0.5 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">{t('allLanguages')}</div>
            )}
            {visible.all.map((o, i) => renderOption(o, i + visible.recent.length))}
            {flat.length === 0 && <div class="px-2.5 py-3 text-center text-sm text-ink-400">{t('noResults')}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
