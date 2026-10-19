import { browser } from 'wxt/browser';
import type { AiStatus } from '@/core/ai-host';
import type { PageStartOptions, PageState, TranslateRequest, TranslateResponse } from '@/core/types';

/** Messages handled by the background service worker, with their reply types. */
export interface BackgroundProtocol {
  translate: { req: TranslateRequest; res: TranslateResponse };
  /** Popup → start/restore/query the page translator of a tab. */
  'page:start': { req: { tabId: number; options?: Partial<PageStartOptions> }; res: PageState };
  'page:restore': { req: { tabId: number }; res: PageState };
  'page:state': { req: { tabId: number }; res: PageState };
  /** Content loader → a site rule says this page should be translated automatically. */
  'page:auto': { req: { lang?: string }; res: PageState };
  /** Content loader → inject the selection card into the sender's frame. */
  'selection:inject': { req: Record<string, never>; res: boolean };
  'ai:status': { req: { force?: boolean }; res: AiStatus };
  'cache:clear': { req: Record<string, never>; res: boolean };
  'options:open': { req: Record<string, never>; res: boolean };
}

export type BackgroundType = keyof BackgroundProtocol;
export type BackgroundMessage = {
  [K in BackgroundType]: { type: K } & BackgroundProtocol[K]['req'];
}[BackgroundType];

export type Reply<T> = { ok: true; data: T } | { ok: false; error: string };

export async function sendToBackground<K extends BackgroundType>(
  type: K,
  payload: BackgroundProtocol[K]['req'],
): Promise<BackgroundProtocol[K]['res']> {
  const reply = (await browser.runtime.sendMessage({ type, ...payload })) as Reply<BackgroundProtocol[K]['res']> | undefined;
  if (!reply) throw new Error('No response from background');
  if (!reply.ok) throw new Error(reply.error);
  return reply.data;
}

/** Messages the background sends to content scripts in a tab. */
export type TabMessage =
  | { type: 'page:ping' }
  | { type: 'page:start'; options: PageStartOptions }
  | { type: 'page:restore' }
  | { type: 'page:state' }
  | { type: 'selection:open'; text?: string };

/** Broadcast by the page translator so an open popup can show live progress. */
export interface ProgressBroadcast {
  type: 'page:progress';
  state: PageState;
}
