// Classification of DOM nodes for page translation.

/** Never translated, never descended into. */
const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'TEXTAREA',
  'INPUT',
  'SELECT',
  'OPTION',
  'PRE',
  'CODE',
  'KBD',
  'SAMP',
  'VAR',
  'SVG',
  'MATH',
  'CANVAS',
  'VIDEO',
  'AUDIO',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'IMG',
  'PICTURE',
  'HEAD',
  'TITLE',
  'META',
  'LINK',
  'BR',
  'HR',
  'WBR',
]);

/** Phrasing elements that flow inside a sentence and become `<xN>` placeholders. */
const INLINE_TAGS = new Set([
  'A',
  'ABBR',
  'B',
  'BDI',
  'BDO',
  'BIG',
  'CITE',
  'DATA',
  'DEL',
  'DFN',
  'EM',
  'FONT',
  'I',
  'INS',
  'LABEL',
  'MARK',
  'Q',
  'RUBY',
  'RB',
  'RP',
  'RT',
  'S',
  'SMALL',
  'SPAN',
  'STRIKE',
  'STRONG',
  'SUB',
  'SUP',
  'TIME',
  'TT',
  'U',
  'NOBR',
]);

/** Skipped elements that may still sit inside a sentence; kept in place as `<xN/>`. */
const INLINE_ATOMIC_TAGS = new Set([
  'CODE',
  'KBD',
  'SAMP',
  'VAR',
  'IMG',
  'PICTURE',
  'BR',
  'WBR',
  'SVG',
  'MATH',
  'INPUT',
  'SELECT',
  'TEXTAREA',
]);

const BLOCK_DESCENDANT_SELECTOR =
  'address,article,aside,blockquote,details,dialog,dd,div,dl,dt,fieldset,figcaption,figure,footer,form,h1,h2,h3,h4,h5,h6,header,hgroup,hr,li,main,nav,ol,p,pre,section,table,ul,button';

/** Marks nodes created by this extension; they are ignored by the walker and observer. */
export const OWN_ATTR = 'data-tpc';

const EXCLUDE_SELECTOR = `[translate="no"],.notranslate,[${OWN_ATTR}],script,style,pre,code,textarea,svg,math,[contenteditable=""],[contenteditable="true"],[contenteditable="plaintext-only"]`;

function tagOf(el: Element): string {
  return el.tagName.toUpperCase();
}

/** Element (and its subtree) must not be translated. */
export function isSkipped(el: Element): boolean {
  if (SKIP_TAGS.has(tagOf(el))) return true;
  if (el.hasAttribute(OWN_ATTR)) return true;
  if (el.getAttribute('translate') === 'no' || el.classList.contains('notranslate')) return true;
  return (el as HTMLElement).isContentEditable === true;
}

export function isInlineAtomic(el: Element): boolean {
  return INLINE_ATOMIC_TAGS.has(tagOf(el)) || (isSkipped(el) && INLINE_TAGS.has(tagOf(el)));
}

const inlineCache = new WeakMap<Element, boolean>();

/** Element flows inline within a sentence (and contains no block-level descendants). */
export function isInlineFlow(el: Element): boolean {
  let inline = inlineCache.get(el);
  if (inline === undefined) {
    inline = INLINE_TAGS.has(tagOf(el)) && el.querySelector(BLOCK_DESCENDANT_SELECTOR) === null;
    inlineCache.set(el, inline);
  }
  return inline;
}

/** True when `node` lives inside an excluded subtree (used for nodes added by mutations). */
export function isInsideExcluded(node: Node): boolean {
  const el = node instanceof Element ? node : node.parentElement;
  if (!el) return false;
  if (el.closest(EXCLUDE_SELECTOR)) return true;
  return (el as HTMLElement).isContentEditable === true;
}

/** Nearest ancestor (or self) that starts a new text block. */
export function blockAncestor(node: Node): Element | null {
  let el: Element | null = node instanceof Element ? node : node.parentElement;
  while (el && isInlineFlow(el)) el = el.parentElement;
  return el;
}
