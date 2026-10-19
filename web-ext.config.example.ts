// Copy to web-ext.config.ts (git-ignored) to pick the browser `pnpm dev` launches.
// Branded Google Chrome 137+ ignores --load-extension, so point dev mode at Chromium,
// Chrome for Testing, Edge, Brave… or load .output/chrome-mv3-dev manually.
import { defineWebExtConfig } from 'wxt';

export default defineWebExtConfig({
  binaries: {
    chrome: 'C:\\Program Files\\Chromium\\Application\\chrome.exe',
    edge: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  },
  startUrls: ['https://en.wikipedia.org/wiki/Machine_translation'],
});
