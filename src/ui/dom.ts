// Tiny DOM helpers for in-page UI. No innerHTML anywhere: pages with Trusted Types or
// strict CSP would reject it, so everything is built with createElement.
import { OWN_ATTR } from '@/core/dom/walker';

type Attrs = Record<string, string | number | boolean | undefined | EventListener>;
type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (typeof value === 'function') el.addEventListener(name.replace(/^on/, '').toLowerCase(), value);
    else if (name === 'class') el.className = String(value);
    else el.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child);
  }
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Stroke icon (24×24 viewBox) from path data. */
export function icon(paths: readonly string[], size = 16): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

/** The extension logo: gradient tile with an "A" and a translation glyph. */
export function logo(size = 20): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  const defs = document.createElementNS(SVG_NS, 'defs');
  const gradient = document.createElementNS(SVG_NS, 'linearGradient');
  const id = `tpc-g-${Math.random().toString(36).slice(2, 8)}`;
  gradient.setAttribute('id', id);
  gradient.setAttribute('x1', '0');
  gradient.setAttribute('y1', '0');
  gradient.setAttribute('x2', '1');
  gradient.setAttribute('y2', '1');
  for (const [offset, color] of [
    ['0', '#4f46e5'],
    ['1', '#9333ea'],
  ]) {
    const stop = document.createElementNS(SVG_NS, 'stop');
    stop.setAttribute('offset', offset as string);
    stop.setAttribute('stop-color', color as string);
    gradient.append(stop);
  }
  defs.append(gradient);
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('width', '24');
  rect.setAttribute('height', '24');
  rect.setAttribute('rx', '6');
  rect.setAttribute('fill', `url(#${id})`);
  svg.append(defs, rect);
  for (const d of LOGO_GLYPH) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#fff');
    path.setAttribute('stroke-width', '1.8');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.append(path);
  }
  return svg;
}

export const LOGO_GLYPH = [
  'M5 17.5 8.6 7.5l3.6 10',
  'M6.3 14h4.6',
  'M13.5 8.5h6',
  'M16.5 7v1.5',
  'M18.3 8.5c-.6 3-2.3 5.6-4.8 7',
  'M15 11c1 2 2.6 3.6 4.5 4.5',
];

export const ICONS = {
  close: ['M18 6 6 18', 'M6 6l12 12'],
  copy: ['M9 9h11v11H9z', 'M5 15H4V4h11v1'],
  check: ['M20 6 9 17l-5-5'],
  speak: ['M11 5 6 9H2v6h4l5 4z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M19 5a10 10 0 0 1 0 14'],
  settings: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6'],
  retry: ['M21 12a9 9 0 1 1-3-6.7L21 8', 'M21 3v5h-5'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'],
  columns: ['M4 6h16', 'M4 10h10', 'M4 14h16', 'M4 18h10'],
  arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
  translate: ['M4 5h8', 'M8 3v2', 'M10.5 5c-.7 4-3 7-6.5 9', 'M6 9c1.2 2.4 3.3 4.4 6 5.5', 'M12 21l4.5-10L21 21', 'M13.5 18h6'],
} as const;

/**
 * Creates an isolated host for in-page UI: page CSS can't leak in, ours can't leak out.
 * Constructable stylesheets are used because page CSPs don't apply to them.
 */
export function createShadowHost(tag: string, css: string): { host: HTMLElement; root: ShadowRoot } {
  const host = document.createElement(tag);
  host.setAttribute(OWN_ATTR, 'ui');
  host.setAttribute('translate', 'no');
  host.style.setProperty('all', 'initial', 'important');
  host.style.setProperty('position', 'fixed', 'important');
  host.style.setProperty('top', '0', 'important');
  host.style.setProperty('left', '0', 'important');
  host.style.setProperty('width', '0', 'important');
  host.style.setProperty('height', '0', 'important');
  host.style.setProperty('z-index', '2147483647', 'important');
  const root = host.attachShadow({ mode: 'open' });
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    root.adoptedStyleSheets = [sheet];
  } catch {
    root.append(h('style', {}, css));
  }
  document.documentElement.append(host);
  return { host, root };
}
