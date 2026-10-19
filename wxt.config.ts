import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  imports: false,
  manifestVersion: 3,
  vite: () => ({
    plugins: [preact(), tailwindcss()],
    build: { target: 'chrome116' },
  }),
  manifest: {
    name: '__MSG_extName__',
    short_name: '__MSG_extShortName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    minimum_chrome_version: '116',
    // A content script on <all_urls> already implies the "read and change all your
    // data on all websites" warning, so <all_urls> host access adds no new prompt and
    // lets the background inject the on-demand translator scripts and reach any
    // translation endpoint (Google, Bing, Gemini, user-configured OpenAI-compatible).
    host_permissions: ['<all_urls>'],
    permissions: ['storage', 'activeTab', 'scripting', 'contextMenus', 'offscreen'],
    commands: {
      'translate-page': {
        suggested_key: { default: 'Alt+A' },
        description: '__MSG_cmdTranslatePage__',
      },
      'translate-selection': {
        suggested_key: { default: 'Alt+T' },
        description: '__MSG_cmdTranslateSelection__',
      },
    },
  },
});
