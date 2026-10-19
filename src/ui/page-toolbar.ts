import { getLanguageName } from '@/core/languages';
import type { PageState } from '@/core/types';
import { providerLabel, t, uiLocale } from '@/utils/i18n';
import { createShadowHost, h, ICONS, icon, logo } from './dom';
import barCss from './page-toolbar.css?inline';
import themeCss from './theme.css?inline';

export interface PageToolbarActions {
  toggleOriginal(): void;
  toggleBilingual(): void;
}

/** Floating pill showing page-translation progress, with quick toggles. */
export class PageToolbar {
  private host?: HTMLElement;
  private bar?: HTMLElement;
  private compactTimer?: ReturnType<typeof setTimeout>;
  private dismissed = false;

  constructor(private readonly actions: PageToolbarActions) {}

  show(): void {
    this.dismissed = false;
  }

  update(state: PageState): void {
    if (this.dismissed) return;
    if (!this.host?.isConnected) this.mount();
    const bar = this.bar as HTMLElement;
    const locale = uiLocale();

    let status: string;
    let sub = '';
    let warn = false;
    if (state.status === 'translating') {
      const percent = state.total > 0 ? Math.round((state.done / state.total) * 100) : 0;
      status = t('statusTranslating', [String(percent)]);
      sub = state.target ? getLanguageName(state.target, locale) : '';
    } else if (state.status === 'translated') {
      status = t('statusTranslated', [state.target ? getLanguageName(state.target, locale) : '']);
      sub = state.provider ? t('viaProvider', [providerLabel(state.provider)]) : '';
      if (state.styleFallback) {
        sub = t('styleFallbackShort');
        warn = true;
      }
      if (state.error) {
        sub = t('partialError');
        warn = true;
      }
    } else if (state.status === 'error') {
      status = t('statusError');
      sub = state.error ?? '';
      warn = true;
    } else {
      status = t('statusOriginal');
    }

    const translatedView = state.status === 'translating' || state.status === 'translated';
    const eye = h(
      'button',
      {
        class: 'icon-btn',
        title: translatedView ? t('showOriginal') : t('showTranslation'),
        'aria-label': translatedView ? t('showOriginal') : t('showTranslation'),
        onclick: () => this.actions.toggleOriginal(),
      },
      icon(translatedView ? ICONS.eye : ICONS.translate),
    );
    const bilingual = h(
      'button',
      {
        class: `icon-btn${state.mode === 'bilingual' ? ' active' : ''}`,
        title: t('bilingualMode'),
        'aria-label': t('bilingualMode'),
        'aria-pressed': state.mode === 'bilingual' ? 'true' : 'false',
        disabled: !translatedView,
        onclick: () => this.actions.toggleBilingual(),
      },
      icon(ICONS.columns),
    );
    const close = h(
      'button',
      { class: 'icon-btn', title: t('hideToolbar'), 'aria-label': t('hideToolbar'), onclick: () => this.dismiss() },
      icon(ICONS.close),
    );
    const progress = h('div', { class: 'progress' });
    progress.style.transform = `scaleX(${state.status === 'translating' && state.total > 0 ? state.done / state.total : 0})`;

    bar.replaceChildren(
      state.status === 'translating' ? h('div', { class: 'spinner', role: 'progressbar', 'aria-label': status }) : logo(20),
      h(
        'div',
        { class: 'text', role: 'status', 'aria-live': 'polite' },
        h('span', { class: 'status' }, status),
        sub && h('span', { class: `sub${warn ? ' warn' : ''}`, title: sub }, sub),
      ),
      eye,
      bilingual,
      close,
      progress,
    );

    // Shrink to an icon a few seconds after finishing; hover expands it again.
    clearTimeout(this.compactTimer);
    bar.classList.remove('compact');
    if (state.status === 'translated' && !warn) {
      this.compactTimer = setTimeout(() => bar.classList.add('compact'), 4000);
    }
  }

  dismiss(): void {
    this.dismissed = true;
    clearTimeout(this.compactTimer);
    this.host?.remove();
    this.host = undefined;
  }

  private mount(): void {
    const { host, root } = createShadowHost('tpc-page-toolbar', `${themeCss}\n${barCss}`);
    this.host = host;
    this.bar = h('div', { class: 'bar' });
    root.append(this.bar);
  }
}
