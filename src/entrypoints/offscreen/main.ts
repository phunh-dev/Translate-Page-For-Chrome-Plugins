// Offscreen document hosting Chrome's built-in AI, which isn't exposed to service workers.
import { browser } from 'wxt/browser';
import { type AiHostMessage, type AiHostReply, handleAiHostMessage } from '@/core/providers/chrome-ai';

browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  const msg = message as AiHostMessage;
  if (msg?.target !== 'offscreen') return false;
  handleAiHostMessage(msg).then(
    (data) => sendResponse({ ok: true, data } satisfies AiHostReply),
    (error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) } satisfies AiHostReply),
  );
  return true;
});
