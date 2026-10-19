// Lightweight loader injected into every page. It only watches for text selection and
// auto-translate rules; the selection card and page translator are injected on demand.
import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowHost, h, LOGO_GLYPH } from '@/ui/dom';
import type { SelectionCard } from '@/ui/selection-card';
import type { TabMessage } from '@/utils/messaging';

interface LoaderSettings {
  selectionIcon?: boolean;
  alwaysTranslate?: string[];
}

declare global {
  // Shared with selection-ui.content.ts (same isolated world).
  var __tpcSelectionCard: SelectionCard | undefined;
  var __tpcLoader: boolean | undefined;
}

const BUTTON_CSS = `
.btn{position:fixed;width:30px;height:30px;border-radius:9px;border:0;padding:0;cursor:pointer;
background:linear-gradient(135deg,#4f46e5,#9333ea);box-shadow:0 4px 14px rgba(79,70,229,.45),0 1px 3px rgba(0,0,0,.2);
display:flex;align-items:center;justify-content:center;animation:pop .12s ease-out;transition:transform .12s}
.btn:hover{transform:scale(1.08)}.btn:focus-visible{outline:2px solid #fff;outline-offset:2px}
@keyframes pop{from{opacity:0;transform:scale(.7)}}
`;

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  runAt: 'document_idle',
  main() {
    if (globalThis.__tpcLoader) return;
    globalThis.__tpcLoader = true;

    let settings: LoaderSettings = {};
    let button: { host: HTMLElement; el: HTMLButtonElement } | undefined;
    let pending: { text: string; rect: DOMRect } | undefined;

    const readSettings = async () => {
      try {
        const stored = await browser.storage.sync.get('settings');
        settings = (stored.settings as LoaderSettings | undefined) ?? {};
      } catch {
        settings = {};
      }
    };

    browser.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.settings) settings = (changes.settings.newValue as LoaderSettings | undefined) ?? {};
    });

    // --- selection button ------------------------------------------------------------

    const hideButton = () => {
      button?.host.remove();
      button = undefined;
    };

    const currentSelection = (): { text: string; rect: DOMRect } | undefined => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? '';
      if (!selection || !text || selection.rangeCount === 0) return undefined;
      return { text, rect: selection.getRangeAt(selection.rangeCount - 1).getBoundingClientRect() };
    };

    const openCard = async (text: string, rect?: DOMRect): Promise<boolean> => {
      hideButton();
      if (!globalThis.__tpcSelectionCard) {
        await browser.runtime.sendMessage({ type: 'selection:inject' });
      }
      const card = globalThis.__tpcSelectionCard;
      if (!card) return false;
      await card.open({ text, rect: rect && { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } });
      return true;
    };

    const showButton = (x: number, y: number) => {
      hideButton();
      const svgNs = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNs, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('width', '20');
      svg.setAttribute('height', '20');
      for (const d of LOGO_GLYPH) {
        const path = document.createElementNS(svgNs, 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#fff');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        svg.append(path);
      }
      const label = browser.i18n.getMessage('menuTranslateSelection') || 'Translate';
      const el = h('button', { class: 'btn', title: label, 'aria-label': label }, svg);
      el.style.left = `${Math.min(x + 8, innerWidth - 40)}px`;
      el.style.top = `${Math.min(y + 10, innerHeight - 40)}px`;
      el.addEventListener('mousedown', (e) => e.preventDefault()); // keep the selection
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = pending;
        if (target) void openCard(target.text, target.rect);
      });
      const { host, root } = createShadowHost('tpc-selection-button', BUTTON_CSS);
      root.append(el);
      button = { host, el };
    };

    const isOwnUi = (e: Event) => e.composedPath().some((n) => n instanceof Element && n.hasAttribute('data-tpc'));

    document.addEventListener(
      'mouseup',
      (e) => {
        if (e.button !== 0 || isOwnUi(e) || settings.selectionIcon === false) return;
        // Let the browser finalize the selection first.
        setTimeout(() => {
          const selection = currentSelection();
          if (!selection || selection.text.length > 5000) return;
          pending = selection;
          showButton(e.clientX, e.clientY);
        }, 10);
      },
      true,
    );
    document.addEventListener('mousedown', (e) => !isOwnUi(e) && hideButton(), true);
    document.addEventListener('keydown', () => hideButton(), true);
    window.addEventListener('scroll', () => hideButton(), { passive: true, capture: true });

    // --- messages from the background ------------------------------------------------

    browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      const msg = message as TabMessage;
      if (msg.type !== 'selection:open') return false;
      const selection = currentSelection();
      const text = selection?.text || msg.text?.trim();
      // Only the frame that owns the selection answers when the shortcut is broadcast.
      if (!text || (!selection && !msg.text)) return false;
      openCard(text, selection?.rect).then(sendResponse, () => sendResponse(false));
      return true;
    });

    // --- auto-translate rule (top frame only) ----------------------------------------

    void readSettings().then(async () => {
      if (window !== window.top) return;
      if (!settings.alwaysTranslate?.includes(location.hostname)) return;
      let lang = document.documentElement.lang || undefined;
      if (!lang) {
        // Local CLD detection, no network.
        const sample = (document.body?.textContent ?? '').replace(/\s+/g, ' ').slice(0, 2000);
        const detected = await browser.i18n.detectLanguage(sample).catch(() => undefined);
        const best = detected?.languages?.[0];
        if (detected?.isReliable && best) lang = best.language;
      }
      void browser.runtime.sendMessage({ type: 'page:auto', lang }).catch(() => undefined);
    });
  },
});
