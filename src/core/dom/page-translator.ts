import { stripPlaceholders } from '../html';
import type { PageStartOptions, PageState, TranslateRequest, TranslateResponse } from '../types';
import { applyInPlace, renderBilingual, restoreInPlace } from './renderer';
import { collectSegments, type Segment, splitIntoTextSegments, translatedText } from './segmenter';
import { blockAncestor, isInsideExcluded, OWN_ATTR } from './walker';

export interface PageTranslatorDeps {
  translate(request: TranslateRequest): Promise<TranslateResponse>;
  onState?(state: PageState): void;
  document?: Document;
}

const BATCH_SEGMENTS = 40;
const BATCH_CHARS = 5000;
const MAX_INFLIGHT = 3;
const VIEWPORT_MARGIN = '600px 0px';
const MUTATION_DEBOUNCE_MS = 250;
/** Stop re-translating a block that the page keeps rewriting (e.g. live counters). */
const MAX_RETRANSLATIONS = 8;
const RETRANSLATION_WINDOW_MS = 10_000;

const MUTATION_OPTIONS: MutationObserverInit = { childList: true, subtree: true, characterData: true };

export class PageTranslator {
  private state: PageState = { status: 'idle', done: 0, total: 0 };
  private options?: PageStartOptions;
  private readonly segments = new Set<Segment>();
  private readonly byTarget = new Map<Element, Set<Segment>>();
  private queue: Segment[] = [];
  private inflight = 0;
  private flushTimer?: ReturnType<typeof setTimeout>;
  private dirtyTimer?: ReturnType<typeof setTimeout>;
  private readonly dirty = new Set<Element>();
  private readonly churn = new WeakMap<Element, { count: number; since: number }>();
  private readonly observedRoots = new Set<Node>();
  private io?: IntersectionObserver;
  private mo?: MutationObserver;
  /** Watches <title> so SPA navigations get their new title translated. */
  private titleObserver?: MutationObserver;
  /** Incremented on every start/restore so replies for an old run are dropped. */
  private generation = 0;
  /** True until the IntersectionObserver has reported the initial visibility of segments. */
  private awaitingVisibility = false;
  private title?: { original: string; translated: string };
  private readonly doc: Document;

  constructor(private readonly deps: PageTranslatorDeps) {
    this.doc = deps.document ?? document;
  }

  getState(): PageState {
    return { ...this.state };
  }

  start(options: PageStartOptions): PageState {
    const o = this.options;
    if (o && this.state.status !== 'idle' && o.to === options.to && o.style === options.style && o.mode === options.mode) {
      return this.getState();
    }
    if (this.state.status !== 'idle') this.restore(false);

    this.generation += 1;
    this.options = options;
    this.state = { status: 'translating', target: options.to, style: options.style, mode: options.mode, done: 0, total: 0 };

    const body = this.doc.body;
    if (!body) return this.getState();
    this.io = new IntersectionObserver((entries) => this.onIntersect(entries), { rootMargin: VIEWPORT_MARGIN });
    this.mo = new MutationObserver((records) => this.onMutations(records));
    this.mo.observe(body, MUTATION_OPTIONS);
    this.observedRoots.add(body);

    this.addSegments(collectSegments(body));
    this.awaitingVisibility = this.segments.size > 0;
    void this.translateTitle();
    const titleEl = this.doc.querySelector('title');
    if (titleEl) {
      this.titleObserver = new MutationObserver(() => {
        if (this.doc.title !== this.title?.translated) void this.translateTitle();
      });
      this.titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }
    this.updateStatus();
    return this.getState();
  }

  restore(emit = true): PageState {
    this.generation += 1;
    this.io?.disconnect();
    this.mo?.disconnect();
    this.titleObserver?.disconnect();
    this.titleObserver = undefined;
    this.io = undefined;
    this.mo = undefined;
    clearTimeout(this.flushTimer);
    clearTimeout(this.dirtyTimer);
    this.flushTimer = undefined;
    this.dirtyTimer = undefined;
    this.queue = [];
    this.dirty.clear();
    this.awaitingVisibility = false;
    for (const segment of this.segments) this.revert(segment);
    this.segments.clear();
    this.byTarget.clear();
    this.observedRoots.clear();
    if (this.title && this.doc.title === this.title.translated) this.doc.title = this.title.original;
    this.title = undefined;
    this.options = undefined;
    this.state = { status: 'idle', done: 0, total: 0 };
    if (emit) this.emit();
    return this.getState();
  }

  // --- discovery -------------------------------------------------------------------------

  private addSegments(list: Segment[]): void {
    for (const segment of list) {
      this.segments.add(segment);
      const target = this.observeTarget(segment.container);
      let set = this.byTarget.get(target);
      if (!set) {
        set = new Set();
        this.byTarget.set(target, set);
      }
      set.add(segment);
      this.io?.observe(target);

      const root = segment.nodes[0]?.getRootNode();
      if (root instanceof ShadowRoot && !this.observedRoots.has(root)) {
        this.observedRoots.add(root);
        this.mo?.observe(root, MUTATION_OPTIONS);
      }
    }
  }

  /** `display: contents` boxes never intersect; observe their parent instead. */
  private observeTarget(el: Element): Element {
    let target = el;
    const view = this.doc.defaultView;
    while (target.parentElement && view?.getComputedStyle(target).display === 'contents') target = target.parentElement;
    return target;
  }

  private onIntersect(entries: IntersectionObserverEntry[]): void {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      this.io?.unobserve(entry.target);
      const set = this.byTarget.get(entry.target);
      if (!set) continue;
      for (const segment of set) if (segment.status === 'pending') this.enqueue(segment);
    }
    if (this.awaitingVisibility) {
      this.awaitingVisibility = false;
      this.updateStatus();
    }
  }

  private enqueue(segment: Segment): void {
    segment.status = 'queued';
    this.queue.push(segment);
    this.state.total += 1;
    this.flushTimer ??= setTimeout(() => {
      this.flushTimer = undefined;
      this.flush();
    }, 30);
  }

  // --- translation -----------------------------------------------------------------------

  private flush(): void {
    while (this.inflight < MAX_INFLIGHT && this.queue.length > 0) {
      const batch: Segment[] = [];
      let chars = 0;
      while (this.queue.length > 0 && batch.length < BATCH_SEGMENTS) {
        const next = this.queue[0] as Segment;
        if (batch.length > 0 && chars + next.source.length > BATCH_CHARS) break;
        this.queue.shift();
        if (!next.nodes[0]?.isConnected || !this.segments.has(next)) {
          this.state.total -= 1;
          continue;
        }
        batch.push(next);
        chars += next.source.length;
      }
      if (batch.length === 0) continue;
      this.inflight += 1;
      void this.send(batch).finally(() => {
        this.inflight -= 1;
        this.flush();
        this.updateStatus();
      });
    }
    this.updateStatus();
  }

  private async send(batch: Segment[]): Promise<void> {
    const options = this.options;
    if (!options) return;
    const generation = this.generation;
    try {
      const response = await this.deps.translate({
        texts: batch.map((s) => s.source),
        from: 'auto',
        to: options.to,
        style: options.style,
        format: 'html',
      });
      if (generation !== this.generation) return;
      if (response.provider !== 'cache') this.state.provider = response.provider;
      if (response.styleFallback) this.state.styleFallback = true;
      batch.forEach((segment, i) => {
        this.apply(segment, response.texts[i] ?? '');
      });
      this.state.error = undefined;
    } catch (error) {
      if (generation !== this.generation) return;
      for (const segment of batch) segment.status = 'failed';
      this.state.done += batch.length;
      this.state.error = error instanceof Error ? error.message : String(error);
    }
  }

  private apply(segment: Segment, translated: string): void {
    if (!this.segments.has(segment)) return;
    // Mutations caused by these writes are ignored by onMutations (translatedText / OWN_ATTR checks).
    let ok: boolean;
    if (this.options?.mode === 'bilingual' && bilingualEligible(segment)) {
      segment.bilingual = renderBilingual(segment, translated) ?? undefined;
      ok = segment.bilingual !== undefined;
    } else {
      ok = applyInPlace(segment, translated);
    }
    this.state.done += 1;
    if (ok) {
      segment.status = 'done';
      return;
    }
    // Placeholders came back broken: retry text node by text node.
    this.removeSegment(segment);
    const parts = splitIntoTextSegments(segment);
    this.addSegments(parts);
    for (const part of parts) this.enqueue(part);
  }

  private async translateTitle(): Promise<void> {
    const options = this.options;
    const original = this.doc.title.trim();
    if (!options || !original) return;
    const generation = this.generation;
    try {
      const response = await this.deps.translate({ texts: [original], from: 'auto', to: options.to, style: options.style, format: 'text' });
      const translated = response.texts[0];
      if (generation !== this.generation || !translated || this.doc.title.trim() !== original) return;
      this.doc.title = translated;
      // Read back: the browser normalizes whitespace in document.title.
      this.title = { original, translated: this.doc.title };
    } catch {
      // The title is cosmetic; body translation reports errors.
    }
  }

  private updateStatus(): void {
    if (this.state.status === 'idle') return;
    const busy = this.queue.length > 0 || this.inflight > 0 || this.flushTimer !== undefined || this.awaitingVisibility;
    if (busy) this.state.status = 'translating';
    else if (this.state.error && this.state.done > 0 && this.countDone() === 0) this.state.status = 'error';
    else this.state.status = 'translated';
    this.emit();
  }

  private countDone(): number {
    let done = 0;
    for (const segment of this.segments) if (segment.status === 'done') done += 1;
    return done;
  }

  private emit(): void {
    this.deps.onState?.(this.getState());
  }

  // --- restore / removal -----------------------------------------------------------------

  private revert(segment: Segment): void {
    if (segment.bilingual) {
      segment.bilingual.remove();
      segment.bilingual = undefined;
    }
    restoreInPlace(segment);
  }

  private removeSegment(segment: Segment): void {
    this.segments.delete(segment);
    for (const [target, set] of this.byTarget) {
      if (set.delete(segment) && set.size === 0) {
        this.byTarget.delete(target);
        this.io?.unobserve(target);
      }
    }
  }

  // --- dynamic content -------------------------------------------------------------------

  private onMutations(records: MutationRecord[]): void {
    for (const record of records) {
      if (record.type === 'characterData') {
        const node = record.target as Text;
        if (translatedText.get(node) === node.data) continue;
        if (!node.data.trim() || isInsideExcluded(node)) continue;
        this.markDirty(node);
      } else {
        for (const added of Array.from(record.addedNodes)) {
          if (added instanceof Element && added.hasAttribute(OWN_ATTR)) continue;
          if (added.nodeType === Node.TEXT_NODE && !added.textContent?.trim()) continue;
          if (added.nodeType !== Node.TEXT_NODE && !(added instanceof Element)) continue;
          if (isInsideExcluded(added)) continue;
          this.markDirty(added);
        }
      }
    }
    if (this.dirty.size > 0) {
      clearTimeout(this.dirtyTimer);
      this.dirtyTimer = setTimeout(() => this.processDirty(), MUTATION_DEBOUNCE_MS);
    }
  }

  private markDirty(node: Node): void {
    const block = blockAncestor(node);
    if (block) this.dirty.add(block);
  }

  private processDirty(): void {
    this.dirtyTimer = undefined;
    const blocks = Array.from(this.dirty).filter((b) => b.isConnected);
    this.dirty.clear();
    // Keep only outermost blocks.
    const roots = blocks.filter((b) => !blocks.some((other) => other !== b && other.contains(b)));
    const now = Date.now();
    for (const root of roots) {
      const churn = this.churn.get(root);
      if (churn && now - churn.since < RETRANSLATION_WINDOW_MS) {
        churn.count += 1;
        if (churn.count > MAX_RETRANSLATIONS) continue;
      } else {
        this.churn.set(root, { count: 1, since: now });
      }
      for (const segment of Array.from(this.segments)) {
        if (root === segment.container || root.contains(segment.container) || segment.nodes.some((n) => root.contains(n))) {
          if (segment.bilingual) {
            segment.bilingual.remove();
            segment.bilingual = undefined;
          }
          this.removeSegment(segment);
        }
      }
      // Re-collect from original text (sourceOf); unchanged parts are served from cache.
      this.addSegments(collectSegments(root));
    }
  }
}

function bilingualEligible(segment: Segment): boolean {
  if (segment.container.closest('button,nav,select,[role="button"],[role="menu"],[role="menubar"],[role="tab"],[role="navigation"]')) {
    return false;
  }
  const text = stripPlaceholders(segment.source).trim();
  if (/[぀-ヿ㐀-鿿가-힯]/.test(text)) return text.length >= 8;
  return text.length >= 20 && text.split(/\s+/).length >= 3;
}
