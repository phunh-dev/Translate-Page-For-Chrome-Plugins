# Privacy Policy – Translate Page

_Last updated: 2026-10-19_

Translate Page ("the extension") translates web pages and selected text. This page explains what data it handles. **The extension has no servers of its own, no analytics and no tracking.**

## What is sent, to whom, and when

Text leaves your browser **only when you ask for a translation**: you click "Translate this page", use the translate button, context menu or shortcut, or you set a site to "always translate". It is sent only to the engine handling that request:

| Engine | When it is used | Receives |
|---|---|---|
| Google Translate (`translate.googleapis.com`) | Default for the "General" style | Text to translate, target language |
| Microsoft Bing (`www.bing.com`) | Fallback, or if you choose it | Text to translate, target language |
| Google Gemini API (`generativelanguage.googleapis.com`) | Only if you add your own API key, for translation styles | Text to translate, target language, style instructions, your API key |
| Your OpenAI-compatible endpoint | Only if you configure one | Text to translate, target language, style instructions, your API key |
| Chrome built-in AI | If available on your device | Nothing leaves the device |

Each of these services processes the data under its own privacy policy.

## What is stored on your device

- **Settings** (target language, style, display mode, site lists, custom styles) are kept in `chrome.storage.sync`. If you are signed in, your browser syncs them to your own account.
- **API keys** are kept in `chrome.storage.local` only. They are never synced and never sent anywhere except the matching engine.
- **Translation cache**: translated segments are stored in the extension's IndexedDB for 7 days, so the same text isn't translated twice. You can clear it under *Settings → Privacy & data*.

## Permissions

- `storage`: save settings, keys and the cache.
- `activeTab`, `scripting`, host access `<all_urls>`: read and replace page text when you translate, show the selection button, and reach the translation engines.
- `contextMenus`: the right-click menu items.
- `offscreen`: run Chrome's on-device AI models, which aren't available to service workers.

The extension does not read form contents, passwords, or editable fields. Content marked `translate="no"` or `notranslate` is skipped.

## Contact

Please open an issue in the project repository.
