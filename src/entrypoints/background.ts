import { type Browser, browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { createIdbStore, pruneIdbStore, TranslationCache } from '@/core/cache';
import { isSameLanguage, normalizeLanguage } from '@/core/languages';
import { bingProvider } from '@/core/providers/bing';
import { chromeAiProvider, chromeTranslatorProvider, getAiStatus } from '@/core/providers/chrome-ai';
import { geminiProvider } from '@/core/providers/gemini';
import { googleProvider } from '@/core/providers/google';
import { openaiProvider } from '@/core/providers/openai-compatible';
import { TranslationRouter } from '@/core/router';
import type { PageStartOptions, PageState } from '@/core/types';
import { t } from '@/utils/i18n';
import type { BackgroundMessage, BackgroundProtocol, BackgroundType, Reply, TabMessage } from '@/utils/messaging';
import { getSecrets, getSettings, siteRule } from '@/utils/settings';

const PAGE_SCRIPT = '/content-scripts/page-translator.js';
const SELECTION_SCRIPT = '/content-scripts/selection-ui.js';
const LOADER_SCRIPT = '/content-scripts/content.js';

const MENU_PAGE = 'tpc-translate-page';
const MENU_SELECTION = 'tpc-translate-selection';

export default defineBackground(() => {
  const cache = new TranslationCache(5000, createIdbStore());
  const router = new TranslationRouter({
    providers: [googleProvider, bingProvider, chromeAiProvider, geminiProvider, openaiProvider, chromeTranslatorProvider],
    cache,
    getSettings,
    getSecrets,
  });

  // --- page translator in tabs -------------------------------------------------------

  async function sendToTab<T>(tabId: number, message: TabMessage, frameId?: number): Promise<T | undefined> {
    try {
      return (await browser.tabs.sendMessage(tabId, message, frameId === undefined ? undefined : { frameId })) as T;
    } catch {
      return undefined;
    }
  }

  async function ensurePageTranslator(tabId: number): Promise<void> {
    if ((await sendToTab<boolean>(tabId, { type: 'page:ping' }, 0)) === true) return;
    try {
      await browser.scripting.executeScript({ target: { tabId, frameIds: [0] }, files: [PAGE_SCRIPT] });
    } catch {
      throw new Error(t('cannotTranslatePage'));
    }
  }

  async function pageOptions(override?: Partial<PageStartOptions>): Promise<PageStartOptions> {
    const settings = await getSettings();
    return { to: settings.targetLang, style: settings.style, mode: settings.displayMode, ...override };
  }

  async function startPage(tabId: number, override?: Partial<PageStartOptions>): Promise<PageState> {
    await ensurePageTranslator(tabId);
    const state = await sendToTab<PageState>(tabId, { type: 'page:start', options: await pageOptions(override) }, 0);
    if (!state) throw new Error(t('cannotTranslatePage'));
    return state;
  }

  async function pageState(tabId: number): Promise<PageState> {
    return (await sendToTab<PageState>(tabId, { type: 'page:state' }, 0)) ?? { status: 'idle', done: 0, total: 0 };
  }

  async function restorePage(tabId: number): Promise<PageState> {
    return (await sendToTab<PageState>(tabId, { type: 'page:restore' }, 0)) ?? { status: 'idle', done: 0, total: 0 };
  }

  async function togglePage(tabId: number): Promise<void> {
    const state = await pageState(tabId);
    if (state.status === 'idle') await startPage(tabId);
    else await restorePage(tabId);
  }

  /** Asks the loader in the tab (or a specific frame) to open the selection card. */
  async function openSelection(tabId: number, text?: string, frameId?: number): Promise<void> {
    const opened = await sendToTab<boolean>(tabId, { type: 'selection:open', text }, frameId);
    if (opened !== undefined) return;
    // Tab was open before the extension was installed/updated: inject the loader first.
    try {
      await browser.scripting.executeScript({
        target: frameId === undefined ? { tabId, allFrames: true } : { tabId, frameIds: [frameId] },
        files: [LOADER_SCRIPT],
      });
      await sendToTab(tabId, { type: 'selection:open', text }, frameId);
    } catch {
      // Restricted page (browser UI, web store…): nothing we can do.
    }
  }

  // --- message handling --------------------------------------------------------------

  type Handler<K extends BackgroundType> = (
    message: Extract<BackgroundMessage, { type: K }>,
    sender: Browser.runtime.MessageSender,
  ) => Promise<BackgroundProtocol[K]['res']>;

  const handlers: { [K in BackgroundType]: Handler<K> } = {
    translate: ({ texts, from, to, style, format }) => router.translate({ texts, from, to, style, format }),
    'page:start': ({ tabId, options }) => startPage(tabId, options),
    'page:restore': ({ tabId }) => restorePage(tabId),
    'page:state': ({ tabId }) => pageState(tabId),
    'page:auto': async ({ lang }, sender) => {
      const tabId = sender.tab?.id;
      const url = sender.tab?.url ?? sender.url;
      if (tabId === undefined || !url) throw new Error('No tab');
      const settings = await getSettings();
      if (siteRule(settings, new URL(url).hostname) !== 'always') return pageState(tabId);
      if (settings.skipSameLanguage && isSameLanguage(normalizeLanguage(lang), settings.targetLang)) return pageState(tabId);
      return startPage(tabId);
    },
    'selection:inject': async (_message, sender) => {
      const tabId = sender.tab?.id;
      if (tabId === undefined) return false;
      await browser.scripting.executeScript({ target: { tabId, frameIds: [sender.frameId ?? 0] }, files: [SELECTION_SCRIPT] });
      return true;
    },
    'ai:status': ({ force }) => getAiStatus(force),
    'cache:clear': async () => {
      await cache.clear();
      return true;
    },
    'options:open': async () => {
      await browser.runtime.openOptionsPage();
      return true;
    },
  };

  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    const msg = message as { type?: string; target?: string };
    if (msg.target === 'offscreen' || !msg.type || !(msg.type in handlers)) return false;
    const handler = handlers[msg.type as BackgroundType] as Handler<BackgroundType>;
    handler(msg as BackgroundMessage, sender).then(
      (data) => sendResponse({ ok: true, data } satisfies Reply<unknown>),
      (error: unknown) =>
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) } satisfies Reply<unknown>),
    );
    return true;
  });

  // --- context menus & shortcuts -----------------------------------------------------

  function createMenus(): void {
    browser.contextMenus.removeAll(() => {
      browser.contextMenus.create({ id: MENU_SELECTION, title: t('menuTranslateSelection'), contexts: ['selection'] });
      browser.contextMenus.create({ id: MENU_PAGE, title: t('menuTranslatePage'), contexts: ['page', 'frame', 'link', 'image'] });
    });
  }

  browser.runtime.onInstalled.addListener(() => createMenus());
  browser.runtime.onStartup.addListener(() => {
    createMenus();
    void pruneIdbStore().catch(() => undefined);
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (tab?.id === undefined) return;
    if (info.menuItemId === MENU_PAGE) void togglePage(tab.id).catch(() => undefined);
    if (info.menuItemId === MENU_SELECTION) void openSelection(tab.id, info.selectionText, info.frameId);
  });

  browser.commands.onCommand.addListener((command, tab) => {
    if (tab?.id === undefined) return;
    if (command === 'translate-page') void togglePage(tab.id).catch(() => undefined);
    if (command === 'translate-selection') void openSelection(tab.id);
  });
});
