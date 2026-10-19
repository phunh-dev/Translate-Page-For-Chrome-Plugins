# Store listing & release checklist

## Short description (≤ 132 chars)

- **EN**: Translate whole pages or selected text into 240+ languages for free, with domain styles (tech, medical, news, food…).
- **VI**: Dịch toàn trang hoặc đoạn văn bôi đen sang hơn 240 ngôn ngữ, miễn phí, có phong cách theo lĩnh vực.

## Detailed description (EN)

Translate Page is a free translator for every Chromium browser.

• Translate the whole page with one click, `Alt+A` or the right-click menu. Choose to replace the text, or show the translation under the original (bilingual mode). Content loaded later (feeds, single-page apps) is translated too. Switch back to the original instantly.
• Select any text to get a translation card. From the card you can change the language or style, copy the result, or listen to it.
• 249 languages, with automatic source detection.
• 15 translation styles: Technology, Engineering, Science, Medical, Legal, Finance, Journalism, Food, Magazine, Academic, Marketing, Gaming, Literature, Casual. You can also write your own.
• Free by default: no account and no key needed. For translation styles, use Chrome's on-device AI or add a free Gemini / Groq / OpenRouter key, or a local Ollama model.
• Lightweight: only a 3 KB script runs on each page until you translate.
• Private: no servers, no analytics. Text goes only to the translation engine you use.

## Single purpose (Chrome Web Store)

Translate web page content and selected text into the user's chosen language.

## Permission justifications

- **Host permission `<all_urls>`, `scripting`**: the user can translate any page they visit. Translating needs the page text and replaces it with the translation. The selection button runs on all pages.
- **`activeTab`**: translate the current tab from the toolbar button or a keyboard shortcut.
- **`storage`**: save preferences, optional API keys (local only) and the translation cache.
- **`contextMenus`**: the "Translate selection" and "Translate this page" menu items.
- **`offscreen`**: host Chrome's built-in on-device AI models, which aren't available in the service worker.
- **Remote code**: none. All code is bundled; the extension only exchanges JSON or text with translation APIs.

## Data usage disclosure

Collects "Website content" only when the user requests a translation, and only to provide that feature. Not sold, not used for unrelated purposes. Privacy policy: see `PRIVACY.md` (publish it at a public URL before submitting).

## Release checklist

1. Bump `version` in `package.json`.
2. Run `pnpm check` and `pnpm test:e2e` (Chromium), then `E2E_CHANNEL=msedge pnpm test:e2e`.
3. Run a manual smoke test on Brave, Opera, Vivaldi and Cốc Cốc: load `.output/chrome-mv3` unpacked, then translate a page, translate a selection, try bilingual mode and restore.
4. Run `pnpm zip` and upload `.output/translate-page-for-chromium-<version>-chrome.zip` to:
   - Chrome Web Store (also used by Brave, Vivaldi, Arc, Cốc Cốc)
   - Microsoft Edge Add-ons
   - Opera Add-ons (or users install from the Chrome Web Store)
5. Screenshots: 1280×800, popup + translated page + selection card, light and dark.
