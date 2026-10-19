import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test, type Worker } from '@playwright/test';
import type { browser } from 'wxt/browser';

// `chrome` exists inside the evaluate() callbacks, which run in the extension.
declare const chrome: typeof browser;

// These tests use the real free translation endpoints, so they need network access.
const EXTENSION = resolve('.output/chrome-mv3');
const FIXTURE = readFileSync(resolve('tests/fixtures/article.html'));

let server: Server;
let baseUrl: string;
let context: BrowserContext;
let closeBrowser: () => Promise<void>;
let worker: Worker;
let extensionId: string;

async function launch(): Promise<{ context: BrowserContext; close: () => Promise<void> }> {
  const cdpUrl = process.env.E2E_CDP_URL;
  if (cdpUrl) {
    // A browser started by hand with --load-extension and --remote-debugging-port, for forks
    // whose UI breaks under Playwright's launch flags (Vivaldi).
    const browser = await chromium.connectOverCDP(cdpUrl);
    return { context: browser.contexts()[0] as BrowserContext, close: () => browser.close() };
  }
  const ctx = await chromium.launchPersistentContext('', {
    // E2E_CHANNEL=msedge runs the suite against Microsoft Edge; E2E_EXECUTABLE=<path> against any
    // other Chromium browser (Brave, Opera, Cốc Cốc…).
    ...(process.env.E2E_EXECUTABLE ? { executablePath: process.env.E2E_EXECUTABLE } : { channel: process.env.E2E_CHANNEL ?? 'chromium' }),
    headless: true,
    locale: 'en-US',
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
  });
  return { context: ctx, close: () => ctx.close() };
}

/** Our service worker; browsers like Vivaldi run their own extension workers too. */
async function findWorker(ctx: BrowserContext): Promise<Worker> {
  for (let attempt = 0; attempt < 20; attempt++) {
    for (const candidate of ctx.serviceWorkers()) {
      const ours = await candidate.evaluate(() => 'translate-page' in (chrome.runtime.getManifest().commands ?? {})).catch(() => false);
      if (ours) return candidate;
    }
    await ctx.waitForEvent('serviceworker', { timeout: 1000 }).catch(() => undefined);
  }
  throw new Error('Extension service worker not found');
}

test.beforeAll(async () => {
  server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(FIXTURE);
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;

  ({ context, close: closeBrowser } = await launch());
  worker = await findWorker(context);
  extensionId = new URL(worker.url()).host;

  // Deterministic settings: translate into Vietnamese, literal style.
  await worker.evaluate(() =>
    chrome.storage.sync.set({ settings: { targetLang: 'vi', style: 'general', displayMode: 'replace', selectionIcon: true } }),
  );
});

test.afterAll(async () => {
  await closeBrowser?.();
  server?.close();
});

async function patchSettings(patch: Record<string, unknown>): Promise<void> {
  await worker.evaluate(async (patch) => {
    const { settings } = await chrome.storage.sync.get('settings');
    await chrome.storage.sync.set({ settings: { ...(settings as object), ...patch } });
  }, patch);
}

async function openFixture(): Promise<{ page: Page; tabId: number }> {
  const page = await context.newPage();
  await page.goto(baseUrl);
  const tabId = await worker.evaluate(async (url) => (await chrome.tabs.query({ url }))[0]?.id ?? -1, baseUrl);
  return { page, tabId };
}

async function openPopup(tabId: number): Promise<Page> {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html?tabId=${tabId}`);
  return popup;
}

test('popup translates the page and restores the original', async () => {
  const { page, tabId } = await openFixture();
  const popup = await openPopup(tabId);
  await popup.getByRole('button', { name: 'Translate this page' }).click();

  await expect(page.locator('#title')).not.toHaveText('Good morning, world', { timeout: 20_000 });
  await expect(page.locator('#title')).toHaveText(/chào/i);
  // The link element survives with its href; code and notranslate are untouched.
  await expect(page.locator('#link')).toHaveAttribute('href', 'https://example.com/');
  await expect(page.locator('#link')).not.toHaveText('many doors');
  await expect(page.locator('#code code')).toHaveText('npm install');
  await expect(page.locator('#brand')).toHaveText('Translate Page');
  await expect(page).not.toHaveTitle('The quick brown fox');
  await expect(page.locator('tpc-page-toolbar')).toBeAttached();

  // Dynamic content is picked up.
  await page.evaluate(() => {
    const p = document.createElement('p');
    p.id = 'dynamic';
    p.textContent = 'Thank you very much';
    document.getElementById('feed')?.append(p);
  });
  await expect(page.locator('#dynamic')).not.toHaveText('Thank you very much', { timeout: 20_000 });

  await popup.reload();
  await popup.getByRole('button', { name: 'Show original' }).click();
  await expect(page.locator('#title')).toHaveText('Good morning, world');
  await expect(page.locator('#intro')).toHaveText('Learning a new language opens many doors for your career.');
  await expect(page.locator('#dynamic')).toHaveText('Thank you very much');
  await popup.close();
  await page.close();
});

test('bilingual mode shows translation under the original', async () => {
  await patchSettings({ displayMode: 'bilingual' });
  const { page, tabId } = await openFixture();
  const popup = await openPopup(tabId);
  await popup.getByRole('button', { name: 'Translate this page' }).click();
  const translation = page.locator('#intro [data-tpc="bilingual"]');
  await expect(translation).toBeAttached({ timeout: 20_000 });
  await expect(page.locator('#intro')).toContainText('Learning a new language');
  await expect(translation.locator('a')).toHaveAttribute('href', 'https://example.com/');
  await patchSettings({ displayMode: 'replace' });
  await popup.close();
  await page.close();
});

test('selecting text shows the button and the translation card', async () => {
  const { page } = await openFixture();
  const target = page.locator('#selectable');
  const box = await target.boundingBox();
  if (!box) throw new Error('no box');
  // Drag-select the sentence.
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();

  const button = page.locator('tpc-selection-button button');
  await expect(button).toBeVisible();
  await button.click();

  const card = page.locator('tpc-selection-card .card');
  await expect(card).toBeVisible();
  await expect(card.locator('.result')).toHaveText(/thời tiết/i, { timeout: 20_000 });
  await expect(card.locator('[data-badge]')).not.toBeEmpty();

  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
  await page.close();
});

test('shortcut/context-menu path opens the card, and styles without AI fall back with a hint', async () => {
  await patchSettings({ style: 'medical', aiEngine: 'gemini' });
  const { page, tabId } = await openFixture();
  // Same message the background sends for the context menu item / Alt+T.
  await worker.evaluate(
    async ({ tabId }) => chrome.tabs.sendMessage(tabId, { type: 'selection:open', text: 'Take two tablets after meals.' }, { frameId: 0 }),
    { tabId },
  );
  const card = page.locator('tpc-selection-card .card');
  await expect(card.locator('.result')).not.toBeEmpty({ timeout: 20_000 });
  await expect(card.locator('.hint')).toBeVisible();
  await patchSettings({ style: 'general', aiEngine: 'auto' });
  await page.close();
});

test('background reports on-device AI status through the offscreen document', async () => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  const reply = await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'ai:status', force: true }));
  expect(reply.ok).toBe(true);
  expect(Object.keys(reply.data).sort()).toEqual(['prompt', 'translator']);
  await popup.close();
});

test('options page renders all sections', async () => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  for (const heading of ['General', 'Translation engines', 'Translation styles', 'Sites', 'Keyboard shortcuts', 'Privacy & data']) {
    await expect(options.getByRole('heading', { name: heading })).toBeVisible();
  }
  await options
    .getByRole('radio', { name: /Medical/ })
    .first()
    .click();
  await expect
    .poll(() =>
      worker.evaluate(async () => ((await chrome.storage.sync.get('settings')).settings as { style?: string } | undefined)?.style),
    )
    .toBe('medical');
  await options.close();
});
