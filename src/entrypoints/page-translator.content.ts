// Injected on demand into the top frame when the user translates the page.
import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { PageTranslator } from '@/core/dom/page-translator';
import type { PageStartOptions, PageState } from '@/core/types';
import { PageToolbar } from '@/ui/page-toolbar';
import { type ProgressBroadcast, sendToBackground, type TabMessage } from '@/utils/messaging';
import { updateSettings } from '@/utils/settings';

declare global {
  var __tpcPageTranslator: boolean | undefined;
}

export default defineContentScript({
  registration: 'runtime',
  main() {
    if (globalThis.__tpcPageTranslator) return;
    globalThis.__tpcPageTranslator = true;

    let lastOptions: PageStartOptions | undefined;

    const broadcast = (state: PageState) => {
      toolbar.update(state);
      const message: ProgressBroadcast = { type: 'page:progress', state };
      browser.runtime.sendMessage(message).catch(() => undefined);
    };

    const translator = new PageTranslator({
      translate: (request) => sendToBackground('translate', request),
      onState: broadcast,
    });

    const toolbar = new PageToolbar({
      toggleOriginal() {
        if (translator.getState().status === 'idle') {
          if (lastOptions) translator.start(lastOptions);
        } else {
          translator.restore();
        }
      },
      toggleBilingual() {
        if (!lastOptions) return;
        lastOptions = { ...lastOptions, mode: lastOptions.mode === 'bilingual' ? 'replace' : 'bilingual' };
        translator.start(lastOptions);
        void updateSettings({ displayMode: lastOptions.mode });
      },
    });

    browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      const msg = message as TabMessage;
      switch (msg.type) {
        case 'page:ping':
          sendResponse(true);
          return false;
        case 'page:start':
          lastOptions = msg.options;
          toolbar.show();
          sendResponse(translator.start(msg.options));
          return false;
        case 'page:restore':
          sendResponse(translator.restore());
          return false;
        case 'page:state':
          sendResponse(translator.getState());
          return false;
        default:
          return false;
      }
    });
  },
});
