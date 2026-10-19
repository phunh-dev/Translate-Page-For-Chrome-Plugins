import { decodeEntities, escapeHtml } from '../html';
import { isInlineAtomic, isInlineFlow, isSkipped } from './walker';

/** Original and translated values of text nodes this extension has rewritten. */
export const originalText = new WeakMap<Text, string>();
export const translatedText = new WeakMap<Text, string>();

/** Source text of a node, ignoring a translation we wrote into it. */
export function sourceOf(node: Text): string {
  const translated = translatedText.get(node);
  if (translated !== undefined && translated === node.data) return originalText.get(node) ?? node.data;
  return node.data;
}

export interface Segment {
  id: number;
  /** Block element containing the run; observed for visibility. */
  container: Element;
  /** Top-level nodes of the run (text nodes and inline elements). */
  nodes: Node[];
  /** Serialized source: HTML-escaped text with `<xN>…</xN>` / `<xN/>` placeholders. */
  source: string;
  /** Every text node of the run in document order. */
  textNodes: Text[];
  /** Placeholder index of the element directly containing each text node (-1 = run root). */
  ownerOf: Map<Text, number>;
  /** Placeholder index → element. */
  slots: Map<number, Element>;
  /** Placeholder indices whose subtree contains text. */
  textSlots: Set<number>;
  status: 'pending' | 'queued' | 'done' | 'failed';
  /** Bilingual mode: the inserted translation element. */
  bilingual?: HTMLElement;
}

/** Segments longer than this are split per text node to keep requests reasonable. */
const MAX_SEGMENT_CHARS = 3500;
const LETTER = /\p{L}/u;

let nextId = 1;

export function collapseWhitespace(text: string): string {
  return text.replace(/[\t\n\f\r ]+/g, ' ');
}

/** Walks `root` and returns translatable segments in document order. */
export function collectSegments(root: Node): Segment[] {
  const out: Segment[] = [];
  if (root instanceof Element) {
    if (isSkipped(root)) return out;
    walkContainer(root, out);
    if (root.shadowRoot) walkContainer(root.shadowRoot, out);
  } else if (root instanceof DocumentFragment || root instanceof Document) {
    walkContainer(root, out);
  } else if (root instanceof Text && root.parentElement) {
    pushRun(root.parentElement, [root], out);
  }
  return out;
}

function walkContainer(container: ParentNode, out: Segment[]): void {
  const hostElement = container instanceof ShadowRoot ? container.host : container instanceof Element ? container : null;
  let run: Node[] = [];
  const flush = () => {
    if (run.length > 0 && hostElement) pushRun(hostElement, run, out);
    run = [];
  };

  for (const child of Array.from(container.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      run.push(child);
    } else if (child instanceof Element) {
      if (isSkipped(child)) {
        if (isInlineAtomic(child)) run.push(child);
        else flush();
      } else if (isInlineFlow(child)) {
        run.push(child);
        if (child.shadowRoot) walkContainer(child.shadowRoot, out);
      } else {
        flush();
        walkContainer(child, out);
        if (child.shadowRoot) walkContainer(child.shadowRoot, out);
      }
    }
    // Comments and processing instructions don't break the run.
  }
  flush();
}

interface Serialized {
  source: string;
  textNodes: Text[];
  ownerOf: Map<Text, number>;
  slots: Map<number, Element>;
  textSlots: Set<number>;
}

export function serializeRun(nodes: readonly Node[]): Serialized {
  const textNodes: Text[] = [];
  const ownerOf = new Map<Text, number>();
  const slots = new Map<number, Element>();
  const textSlots = new Set<number>();
  let next = 0;
  let source = '';

  const visit = (node: Node, owner: number, ancestors: number[]) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node as Text;
      const value = sourceOf(text);
      textNodes.push(text);
      ownerOf.set(text, owner);
      source += escapeHtml(collapseWhitespace(value));
      if (value.trim()) for (const a of ancestors) textSlots.add(a);
      return;
    }
    if (!(node instanceof Element)) return;
    const index = next++;
    slots.set(index, node);
    if (isSkipped(node) || isInlineAtomic(node) || !node.hasChildNodes()) {
      source += `<x${index}/>`;
      return;
    }
    source += `<x${index}>`;
    for (const child of Array.from(node.childNodes)) visit(child, index, [...ancestors, index]);
    source += `</x${index}>`;
  };

  for (const node of nodes) visit(node, -1, []);
  return { source: source.trim(), textNodes, ownerOf, slots, textSlots };
}

function hasLetters(serialized: string): boolean {
  return LETTER.test(decodeEntities(serialized.replace(/<\/?x\d+\/?>/g, '')));
}

function pushRun(container: Element, nodes: Node[], out: Segment[]): void {
  const serialized = serializeRun(nodes);
  if (!hasLetters(serialized.source)) return;
  if (serialized.source.length <= MAX_SEGMENT_CHARS) {
    out.push({ id: nextId++, container, nodes, ...serialized, status: 'pending' });
    return;
  }
  // Too long: translate each text node on its own (structure can't break this way).
  for (const text of serialized.textNodes) {
    const single = serializeRun([text]);
    if (hasLetters(single.source)) out.push({ id: nextId++, container, nodes: [text], ...single, status: 'pending' });
  }
}

/** Plain-text fallback segments, one per text node, for when a placeholder reply is unusable. */
export function splitIntoTextSegments(segment: Segment): Segment[] {
  return segment.textNodes.flatMap((text) => {
    const single = serializeRun([text]);
    return hasLetters(single.source)
      ? [{ id: nextId++, container: segment.container, nodes: [text], ...single, status: 'pending' as const }]
      : [];
  });
}
