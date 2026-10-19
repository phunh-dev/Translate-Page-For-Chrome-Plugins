import { useCallback, useEffect, useState } from 'preact/hooks';
import { browser } from 'wxt/browser';
import { Icon, Logo } from '@/components/Icon';
import { LanguagePicker } from '@/components/LanguagePicker';
import { StylePicker } from '@/components/StylePicker';
import { Toggle } from '@/components/Toggle';
import { isLiteralStyle } from '@/core/styles/presets';
import type { PageStartOptions, PageState } from '@/core/types';
import { providerLabel, t } from '@/utils/i18n';
import { type ProgressBroadcast, sendToBackground } from '@/utils/messaging';
import { getSettings, type Settings, updateSettings, withRecentLang } from '@/utils/settings';

interface ActiveTab {
  id: number;
  hostname: string;
  translatable: boolean;
}

const IDLE: PageState = { status: 'idle', done: 0, total: 0 };

async function findTab(): Promise<ActiveTab | undefined> {
  // ?tabId= lets automated tests drive the popup for a specific tab.
  const param = new URLSearchParams(location.search).get('tabId');
  const tab = param ? await browser.tabs.get(Number(param)) : (await browser.tabs.query({ active: true, currentWindow: true }))[0];
  if (tab?.id === undefined) return undefined;
  let hostname = '';
  let translatable = false;
  try {
    const url = new URL(tab.url ?? '');
    hostname = url.hostname;
    translatable = ['http:', 'https:', 'file:'].includes(url.protocol);
  } catch {
    // no URL access
  }
  return { id: tab.id, hostname, translatable };
}

export function App() {
  const [settings, setSettings] = useState<Settings>();
  const [tab, setTab] = useState<ActiveTab>();
  const [page, setPage] = useState<PageState>(IDLE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      const [s, activeTab] = await Promise.all([getSettings(), findTab()]);
      setSettings(s);
      setTab(activeTab);
      if (activeTab?.translatable) {
        setPage(await sendToBackground('page:state', { tabId: activeTab.id }).catch(() => IDLE));
      }
    })();
  }, []);

  useEffect(() => {
    const listener = (message: unknown, sender: { tab?: { id?: number } }) => {
      const msg = message as ProgressBroadcast;
      if (msg?.type === 'page:progress' && sender.tab?.id === tab?.id) setPage(msg.state);
      return false;
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, [tab?.id]);

  const run = useCallback(async (action: () => Promise<PageState>) => {
    setBusy(true);
    setError('');
    try {
      setPage(await action());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  const translatePage = (override?: Partial<PageStartOptions>) => {
    if (!tab) return;
    void run(() => sendToBackground('page:start', { tabId: tab.id, options: override }));
  };

  const restorePage = () => {
    if (!tab) return;
    void run(() => sendToBackground('page:restore', { tabId: tab.id }));
  };

  const active = page.status === 'translating' || page.status === 'translated';

  const change = async (patch: Partial<Settings>, retranslate: boolean) => {
    const next = await updateSettings(patch);
    setSettings(next);
    if (retranslate && active) translatePage({ to: next.targetLang, style: next.style, mode: next.displayMode });
  };

  if (!settings) {
    return <div class="h-[420px] w-[380px]" />;
  }

  const alwaysOn = tab ? settings.alwaysTranslate.includes(tab.hostname) : false;
  const percent = page.total > 0 ? Math.round((page.done / page.total) * 100) : 0;

  return (
    <div class="w-[380px] p-4">
      <header class="mb-4 flex items-center gap-2.5">
        <Logo size={30} />
        <div class="min-w-0 flex-1">
          <h1 class="text-[15px] leading-tight font-semibold">{t('extShortName')}</h1>
          <p class="truncate text-xs text-ink-500 dark:text-ink-400">{tab?.hostname || t('extTagline')}</p>
        </div>
        <button
          type="button"
          title={t('openSettings')}
          aria-label={t('openSettings')}
          class="rounded-lg p-2 text-ink-500 transition hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-white"
          onClick={() => {
            void browser.runtime.openOptionsPage();
            window.close();
          }}
        >
          <Icon name="settings" size={18} />
        </button>
      </header>

      <section class="space-y-3">
        <div>
          <label for="target-lang" class="mb-1.5 block text-xs font-semibold text-ink-600 dark:text-ink-300">
            {t('translateTo')}
          </label>
          <LanguagePicker
            id="target-lang"
            value={settings.targetLang}
            recent={settings.recentLangs}
            onChange={(code) => void change({ targetLang: code, recentLangs: withRecentLang(settings.recentLangs, code) }, true)}
          />
        </div>

        <div>
          <span class="mb-1.5 block text-xs font-semibold text-ink-600 dark:text-ink-300">{t('translationStyle')}</span>
          <StylePicker value={settings.style} customStyles={settings.customStyles} onChange={(id) => void change({ style: id }, true)} />
        </div>

        {tab?.translatable ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => (active ? restorePage() : translatePage())}
            class={`relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60 dark:focus-visible:ring-offset-ink-900 ${
              active
                ? 'border border-ink-200 bg-white text-ink-800 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-850 dark:text-ink-100 dark:hover:bg-ink-800'
                : 'bg-gradient-to-r from-brand-600 to-purple-600 text-white hover:from-brand-700 hover:to-purple-700'
            }`}
          >
            <Icon name={active ? 'eye' : 'translate'} size={16} />
            {page.status === 'translating' ? t('translatingPercent', [String(percent)]) : active ? t('showOriginal') : t('translatePage')}
            {page.status === 'translating' && (
              <span class="absolute bottom-0 left-0 h-0.5 bg-brand-500 transition-all" style={{ width: `${percent}%` }} />
            )}
          </button>
        ) : (
          <p class="rounded-xl bg-ink-50 px-3 py-2.5 text-center text-xs text-ink-500 dark:bg-ink-850 dark:text-ink-400">
            {t('cannotTranslatePage')}
          </p>
        )}

        {(error || page.error || page.styleFallback || (page.status === 'translated' && page.provider)) && (
          <div class="space-y-1 text-xs">
            {error && <p class="text-red-600 dark:text-red-400">{error}</p>}
            {page.error && !error && <p class="text-red-600 dark:text-red-400">{page.error}</p>}
            {page.styleFallback && !isLiteralStyle(settings.style) && (
              <p class="rounded-lg bg-brand-50 px-2.5 py-2 text-ink-700 dark:bg-brand-900/30 dark:text-ink-200">
                {t('styleNeedsAi')}{' '}
                <button
                  type="button"
                  class="font-semibold text-brand-700 underline dark:text-brand-300"
                  onClick={() => void browser.runtime.openOptionsPage()}
                >
                  {t('setupAi')}
                </button>
              </p>
            )}
            {page.status === 'translated' && page.provider && !page.error && (
              <p class="text-ink-500 dark:text-ink-400">{t('viaProvider', [providerLabel(page.provider)])}</p>
            )}
          </div>
        )}

        <div class="divide-y divide-ink-100 rounded-xl border border-ink-100 px-3 dark:divide-ink-800 dark:border-ink-800">
          <Toggle
            checked={settings.displayMode === 'bilingual'}
            label={t('bilingualMode')}
            description={t('bilingualModeDesc')}
            onChange={(on) => void change({ displayMode: on ? 'bilingual' : 'replace' }, true)}
          />
          {tab?.translatable && tab.hostname && (
            <Toggle
              checked={alwaysOn}
              label={t('alwaysTranslateSite', [tab.hostname])}
              onChange={(on) =>
                void change(
                  {
                    alwaysTranslate: on
                      ? [...settings.alwaysTranslate.filter((h) => h !== tab.hostname), tab.hostname]
                      : settings.alwaysTranslate.filter((h) => h !== tab.hostname),
                    neverTranslate: settings.neverTranslate.filter((h) => h !== tab.hostname),
                  },
                  false,
                )
              }
            />
          )}
        </div>
      </section>

      <footer class="mt-3 flex items-center justify-center gap-3 text-[11px] text-ink-400">
        <span>
          <kbd class="rounded border border-ink-200 px-1 font-sans dark:border-ink-700">Alt+A</kbd> {t('shortcutPage')}
        </span>
        <span>
          <kbd class="rounded border border-ink-200 px-1 font-sans dark:border-ink-700">Alt+T</kbd> {t('shortcutSelection')}
        </span>
      </footer>
    </div>
  );
}
