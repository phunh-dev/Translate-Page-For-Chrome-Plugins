import { decodeEntities, stripPlaceholders } from '../html';
import { collapseWhitespace, originalText, type Segment, sourceOf, translatedText } from './segmenter';
import { OWN_ATTR } from './walker';

export type Token =
  | { type: 'text'; value: string }
  | { type: 'open'; index: number }
  | { type: 'close'; index: number }
  | { type: 'self'; index: number };

const TAG = /<(\/?)\s*x(\d+)\s*(\/?)\s*>/gi;

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  for (const match of input.matchAll(TAG)) {
    const at = match.index ?? 0;
    if (at > last) tokens.push({ type: 'text', value: input.slice(last, at) });
    const index = Number(match[2]);
    tokens.push(match[1] ? { type: 'close', index } : match[3] ? { type: 'self', index } : { type: 'open', index });
    last = at + match[0].length;
  }
  if (last < input.length) tokens.push({ type: 'text', value: input.slice(last) });
  return tokens;
}

/** Translated text chunks grouped by the placeholder that directly contains them. */
export type ChunksByOwner = Map<number, string[]>;

/**
 * Validates a translated string against the segment structure. Returns null when the
 * placeholders are unbalanced, unknown, duplicated, or a text-bearing element vanished.
 */
export function parseTranslation(translated: string, segment: Pick<Segment, 'slots' | 'textSlots'>): ChunksByOwner | null {
  const chunks: ChunksByOwner = new Map([[-1, []]]);
  const lastWasText = new Map<number, boolean>();
  const seen = new Set<number>();
  const stack: number[] = [-1];

  for (const token of tokenize(translated)) {
    const top = stack[stack.length - 1] as number;
    switch (token.type) {
      case 'text': {
        let list = chunks.get(top);
        if (!list) {
          list = [];
          chunks.set(top, list);
        }
        if (lastWasText.get(top)) list[list.length - 1] += token.value;
        else list.push(token.value);
        lastWasText.set(top, true);
        break;
      }
      case 'open':
        if (!segment.slots.has(token.index) || seen.has(token.index)) return null;
        seen.add(token.index);
        lastWasText.set(top, false);
        stack.push(token.index);
        break;
      case 'close':
        if (top !== token.index) return null;
        stack.pop();
        break;
      case 'self':
        if (!segment.slots.has(token.index)) return null;
        seen.add(token.index);
        lastWasText.set(top, false);
        break;
    }
  }
  if (stack.length !== 1) return null;
  for (const index of segment.textSlots) if (!seen.has(index)) return null;
  return chunks;
}

function writeText(node: Text, chunk: string): void {
  const source = sourceOf(node);
  originalText.set(node, source);
  const core = collapseWhitespace(decodeEntities(chunk)).trim();
  // Keep the original's edge whitespace so words don't glue to neighbouring elements.
  const lead = /^\s/.test(source) ? ' ' : '';
  const trail = /\s$/.test(source) ? ' ' : '';
  let value: string;
  if (!source.trim()) value = core ? ` ${core} ` : source;
  else value = core ? lead + core + trail : lead || trail;
  if (node.data !== value) node.data = value;
  translatedText.set(node, node.data);
}

/**
 * Replace mode. Only `nodeValue`s change — elements are never moved or recreated — so
 * frameworks like React that hold references to the DOM keep working.
 */
export function applyInPlace(segment: Segment, translated: string): boolean {
  const chunks = parseTranslation(translated, segment);
  if (!chunks) return false;
  const byOwner = new Map<number, Text[]>();
  for (const node of segment.textNodes) {
    const owner = segment.ownerOf.get(node) ?? -1;
    const list = byOwner.get(owner);
    if (list) list.push(node);
    else byOwner.set(owner, [node]);
  }
  for (const [owner, nodes] of byOwner) {
    const pieces = chunks.get(owner) ?? [];
    if (pieces.length === nodes.length) {
      nodes.forEach((node, i) => {
        writeText(node, pieces[i] as string);
      });
    } else {
      // Translator reordered/merged text around child elements: keep all text in the first node.
      const joined = pieces
        .map((p) => p.trim())
        .filter(Boolean)
        .join(' ');
      nodes.forEach((node, i) => {
        writeText(node, i === 0 ? joined : '');
      });
    }
  }
  return true;
}

export function restoreInPlace(segment: Segment): void {
  for (const node of segment.textNodes) {
    const translated = translatedText.get(node);
    const original = originalText.get(node);
    if (translated !== undefined && original !== undefined && node.data === translated) node.data = original;
    translatedText.delete(node);
    originalText.delete(node);
  }
}

/** Bilingual mode: inserts the translation right after the original run. */
export function renderBilingual(segment: Segment, translated: string): HTMLElement | null {
  const last = segment.nodes[segment.nodes.length - 1];
  const parent = last?.parentNode;
  if (!last || !parent) return null;
  const doc = parent.ownerDocument ?? document;
  const wrapper = doc.createElement('font');
  wrapper.setAttribute(OWN_ATTR, 'bilingual');
  // CSSOM writes work even under strict style-src CSPs (unlike inline style attributes in markup).
  wrapper.style.display = 'block';
  wrapper.style.marginTop = '0.25em';
  wrapper.style.opacity = '0.9';

  const chunks = parseTranslation(translated, segment);
  if (chunks) {
    const stack: Node[] = [wrapper];
    for (const token of tokenize(translated)) {
      const top = stack[stack.length - 1] as Node;
      if (token.type === 'text') {
        top.appendChild(doc.createTextNode(collapseWhitespace(decodeEntities(token.value))));
      } else if (token.type === 'open') {
        const clone = (segment.slots.get(token.index) as Element).cloneNode(false) as Element;
        clone.removeAttribute('id');
        top.appendChild(clone);
        stack.push(clone);
      } else if (token.type === 'close') {
        stack.pop();
      } else if (segment.slots.get(token.index)?.tagName === 'BR') {
        top.appendChild(doc.createElement('br'));
      }
    }
  } else {
    wrapper.textContent = collapseWhitespace(stripPlaceholders(translated)).trim();
  }
  parent.insertBefore(wrapper, last.nextSibling);
  return wrapper;
}
