import { getLanguageName, isRtl, LANGUAGES, toBcp47 } from '@/core/languages';
import { allStyles, isLiteralStyle } from '@/core/styles/presets';
import type { TranslateResponse } from '@/core/types';
import { providerLabel, t, uiLocale } from '@/utils/i18n';
import { sendToBackground } from '@/utils/messaging';
import { getSettings, type Settings, updateSettings, withRecentLang } from '@/utils/settings';
import { createShadowHost, h, ICONS, icon, logo } from './dom';
import cardCss from './selection-card.css?inline';
import themeCss from './theme.css?inline';

export interface AnchorRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface SelectionCardOptions {
  text: string;
  rect?: AnchorRect;
}

const MAX_CHARS = 5000;

export class SelectionCard {
  private host?: HTMLElement;
  private root?: ShadowRoot;
  private card?: HTMLElement;
  private text = '';
  private rect?: AnchorRect;
  private settings?: Settings;
  private result = '';
  private request = 0;
  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.close();
  };
  private readonly onPointerDown = (e: Event) => {
    if (this.host && !e.composedPath().includes(this.host)) this.close();
  };

  async open({ text, rect }: SelectionCardOptions): Promise<void> {
    this.text = text.trim().slice(0, MAX_CHARS);
    if (!this.text) return;
    this.rect = rect;
    this.settings = await getSettings();
    this.render();
    void this.translate();
  }

  close(): void {
    this.request += 1;
    document.removeEventListener('keydown', this.onKeyDown, true);
    document.removeEventListener('mousedown', this.onPointerDown, true);
    this.host?.remove();
    this.host = undefined;
    this.root = undefined;
    this.card = undefined;
    speechSynthesis?.cancel();
  }

  private render(): void {
    if (!this.host?.isConnected) {
      const { host, root } = createShadowHost('tpc-selection-card', `${themeCss}\n${cardCss}`);
      this.host = host;
      this.root = root;
      document.addEventListener('keydown', this.onKeyDown, true);
      document.addEventListener('mousedown', this.onPointerDown, true);
    }
    const settings = this.settings as Settings;
    const locale = uiLocale();

    const targetSelect = h('select', { 'aria-label': t('targetLanguage'), title: t('targetLanguage') });
    const recent = settings.recentLangs.filter((code) => code !== settings.targetLang);
    const addOption = (parent: HTMLElement, code: string) =>
      parent.append(h('option', { value: code, selected: code === settings.targetLang }, getLanguageName(code, locale)));
    if (recent.length > 0) {
      const group = h('optgroup', { label: t('recentLanguages') });
      for (const code of recent) addOption(group, code);
      targetSelect.append(group);
    }
    const sorted = [...LANGUAGES]
      .map(([code]) => code)
      .sort((a, b) => getLanguageName(a, locale).localeCompare(getLanguageName(b, locale), locale));
    const all = h('optgroup', { label: t('allLanguages') });
    for (const code of sorted) addOption(all, code);
    targetSelect.append(all);
    targetSelect.value = settings.targetLang;
    targetSelect.addEventListener('change', () => void this.changeSettings({ targetLang: targetSelect.value }));

    const styleSelect = h('select', { 'aria-label': t('translationStyle'), title: t('translationStyle') });
    for (const style of allStyles(settings.customStyles)) {
      styleSelect.append(
        h(
          'option',
          { value: style.id, selected: style.id === settings.style },
          `${style.icon} ${style.name ?? t(style.labelKey ?? style.id)}`,
        ),
      );
    }
    styleSelect.addEventListener('change', () => void this.changeSettings({ style: styleSelect.value }));

    const copyButton = h('button', { class: 'icon-btn', title: t('copy'), 'aria-label': t('copy') }, icon(ICONS.copy));
    copyButton.addEventListener('click', async () => {
      if (!this.result) return;
      await navigator.clipboard.writeText(this.result).catch(() => undefined);
      copyButton.replaceChildren(icon(ICONS.check));
      setTimeout(() => copyButton.replaceChildren(icon(ICONS.copy)), 1200);
    });
    const speakButton = h('button', { class: 'icon-btn', title: t('speak'), 'aria-label': t('speak') }, icon(ICONS.speak));
    speakButton.addEventListener('click', () => this.speak());

    const card = h(
      'div',
      { class: 'card', role: 'dialog', 'aria-label': t('extName') },
      h(
        'div',
        { class: 'header' },
        logo(18),
        h(
          'div',
          { class: 'langs' },
          h('span', { class: 'source', 'data-source': '' }, t('detecting')),
          icon(ICONS.arrow, 12),
          targetSelect,
        ),
        h(
          'button',
          {
            class: 'icon-btn',
            title: t('openSettings'),
            'aria-label': t('openSettings'),
            onclick: () => void sendToBackground('options:open', {}),
          },
          icon(ICONS.settings),
        ),
        h('button', { class: 'icon-btn', title: t('close'), 'aria-label': t('close'), onclick: () => this.close() }, icon(ICONS.close)),
      ),
      h('div', { class: 'body' }, h('p', { class: 'original' }, this.text), h('div', { 'data-output': '' })),
      h('div', { class: 'footer' }, h('span', { class: 'badge', 'data-badge': '' }), styleSelect, copyButton, speakButton),
    );
    this.card?.remove();
    this.card = card;
    this.root?.append(card);
    this.position();
  }

  private position(): void {
    const card = this.card;
    if (!card) return;
    const margin = 8;
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    const rect = this.rect ?? { left: innerWidth / 2 - width / 2, right: innerWidth / 2, top: 80, bottom: 80 };
    let top = rect.bottom + margin;
    if (top + height > innerHeight - margin && rect.top - height - margin > margin) top = rect.top - height - margin;
    top = Math.max(margin, Math.min(top, innerHeight - height - margin));
    const left = Math.max(margin, Math.min(rect.left, innerWidth - width - margin));
    card.style.top = `${top}px`;
    card.style.left = `${left}px`;
  }

  private async changeSettings(patch: Partial<Settings>): Promise<void> {
    const current = this.settings as Settings;
    const next = { ...patch };
    if (patch.targetLang) next.recentLangs = withRecentLang(current.recentLangs, patch.targetLang);
    this.settings = await updateSettings(next);
    void this.translate();
  }

  private output(): HTMLElement | null | undefined {
    return this.card?.querySelector<HTMLElement>('[data-output]');
  }

  private async translate(): Promise<void> {
    const settings = this.settings as Settings;
    const id = ++this.request;
    this.result = '';
    this.output()?.replaceChildren(h('div', { class: 'skeleton', 'aria-busy': 'true' }, h('span'), h('span'), h('span')));
    this.setBadge('');
    this.position();
    let response: TranslateResponse;
    try {
      response = await sendToBackground('translate', {
        texts: [this.text],
        from: 'auto',
        to: settings.targetLang,
        style: settings.style,
        format: 'text',
      });
    } catch (error) {
      if (id !== this.request) return;
      const retry = h(
        'button',
        { class: 'icon-btn', title: t('retry'), 'aria-label': t('retry'), onclick: () => void this.translate() },
        icon(ICONS.retry),
      );
      this.output()?.replaceChildren(h('p', { class: 'error' }, `${t('translationFailed')} ${(error as Error).message}`), retry);
      return;
    }
    if (id !== this.request) return;
    this.result = response.texts[0] ?? '';
    const resultEl = h(
      'p',
      { class: 'result', lang: toBcp47(settings.targetLang), dir: isRtl(settings.targetLang) ? 'rtl' : 'auto' },
      this.result,
    );
    const nodes: Node[] = [resultEl];
    if (response.styleFallback && !isLiteralStyle(settings.style)) {
      nodes.push(
        h(
          'div',
          { class: 'hint' },
          `${t('styleNeedsAi')} `,
          h('a', { onclick: () => void sendToBackground('options:open', {}) }, t('setupAi')),
        ),
      );
    }
    this.output()?.replaceChildren(...nodes);
    const source = this.card?.querySelector('[data-source]');
    if (source) source.textContent = response.detected ? getLanguageName(response.detected, uiLocale()) : t('autoDetect');
    this.setBadge(providerLabel(response.provider));
    this.position();
  }

  private setBadge(text: string): void {
    const badge = this.card?.querySelector('[data-badge]');
    if (badge) badge.textContent = text;
  }

  private speak(): void {
    if (!this.result || typeof speechSynthesis === 'undefined') return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(this.result);
    utterance.lang = toBcp47((this.settings as Settings).targetLang);
    speechSynthesis.speak(utterance);
  }
}
