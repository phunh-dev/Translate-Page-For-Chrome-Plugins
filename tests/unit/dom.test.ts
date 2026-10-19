import { PageTranslator } from '@/core/dom/page-translator';
import { applyInPlace, parseTranslation, renderBilingual, restoreInPlace, tokenize } from '@/core/dom/renderer';
import { collectSegments } from '@/core/dom/segmenter';
import type { PageState, TranslateRequest } from '@/core/types';

function setBody(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}

describe('segmenter', () => {
  it('turns block runs into placeholder segments and skips code/notranslate', () => {
    const body = setBody(`
      <h1>Title</h1>
      <p>Click <a href="/x">this <b>link</b></a> to continue &amp; enjoy.</p>
      <pre>const x = 1;</pre>
      <p>Run <code>npm i</code> now</p>
      <p class="notranslate">Brand Name</p>
      <div>Intro text<p>Nested paragraph</p>tail</div>
      <p>12345 !!!</p>
    `);
    const sources = collectSegments(body).map((s) => s.source);
    expect(sources).toEqual([
      'Title',
      'Click <x0>this <x1>link</x1></x0> to continue &amp; enjoy.',
      'Run <x0/> now',
      'Intro text',
      'Nested paragraph',
      'tail',
    ]);
  });

  it('records text-bearing slots and owners', () => {
    const body = setBody('<p>Hello <a href="#">big <b>world</b></a>!</p>');
    const [segment] = collectSegments(body);
    expect(segment?.textSlots).toEqual(new Set([0, 1]));
    expect(segment?.textNodes.map((n) => segment.ownerOf.get(n))).toEqual([-1, 0, 1, -1]);
  });
});

describe('renderer', () => {
  it('tokenizes placeholders', () => {
    expect(tokenize('a<x0>b</x0><x1/>')).toEqual([
      { type: 'text', value: 'a' },
      { type: 'open', index: 0 },
      { type: 'text', value: 'b' },
      { type: 'close', index: 0 },
      { type: 'self', index: 1 },
    ]);
  });

  it('rejects broken structure', () => {
    const body = setBody('<p>Hello <a href="#">world</a>!</p>');
    const [segment] = collectSegments(body);
    if (!segment) throw new Error('no segment');
    expect(parseTranslation('Xin chào <x0>thế giới</x0>!', segment)).not.toBeNull();
    expect(parseTranslation('Xin chào thế giới!', segment)).toBeNull(); // link text dropped
    expect(parseTranslation('<x0>a</x1>', segment)).toBeNull();
    expect(parseTranslation('<x5>a</x5>', segment)).toBeNull();
  });

  it('replaces text in place without touching elements, and restores', () => {
    const body = setBody('<p>Click <a href="/x" id="link">here</a> to continue.</p>');
    const link = body.querySelector('#link');
    const [segment] = collectSegments(body);
    if (!segment) throw new Error('no segment');
    expect(applyInPlace(segment, 'Nhấp <x0>vào đây</x0> để tiếp tục.')).toBe(true);
    expect(body.querySelector('p')?.textContent).toBe('Nhấp vào đây để tiếp tục.');
    expect(body.querySelector('#link')).toBe(link); // same element instance
    expect(link?.getAttribute('href')).toBe('/x');
    restoreInPlace(segment);
    expect(body.querySelector('p')?.textContent).toBe('Click here to continue.');
  });

  it('keeps all text when the translator reorders around elements', () => {
    const body = setBody('<p>Hello <b>big</b> world</p>');
    const [segment] = collectSegments(body);
    if (!segment) throw new Error('no segment');
    expect(applyInPlace(segment, '<x0>Lớn</x0> xin chào thế giới')).toBe(true);
    expect(body.querySelector('p')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('xin chào thế giới Lớn');
  });

  it('renders bilingual translations with cloned inline elements', () => {
    const body = setBody('<p>Read the <a href="/docs">docs</a> please.</p>');
    const [segment] = collectSegments(body);
    if (!segment) throw new Error('no segment');
    const el = renderBilingual(segment, 'Hãy đọc <x0>tài liệu</x0>.');
    expect(el?.getAttribute('data-tpc')).toBe('bilingual');
    expect(el?.querySelector('a')?.getAttribute('href')).toBe('/docs');
    expect(body.querySelector('p')?.textContent).toContain('Read the docs please.');
    expect(body.querySelector('p')?.textContent).toContain('Hãy đọc tài liệu.');
  });
});

describe('PageTranslator', () => {
  beforeAll(() => {
    // happy-dom has no layout: report everything as intersecting immediately.
    class ImmediateIO {
      constructor(private readonly cb: IntersectionObserverCallback) {}
      observe(target: Element) {
        queueMicrotask(() => this.cb([{ isIntersecting: true, target } as IntersectionObserverEntry], this as never));
      }
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('IntersectionObserver', ImmediateIO);
  });

  const fakeTranslate = vi.fn(async (req: TranslateRequest) => ({
    texts: req.texts.map((t) => (req.format === 'text' ? `VI ${t}` : t.replace(/([A-Za-z]+)/g, (w) => w.toUpperCase()))),
    provider: 'google',
  }));

  const settle = () => new Promise((resolve) => setTimeout(resolve, 400));

  it('translates the page, follows dynamic content and restores everything', async () => {
    const body = setBody('<h1>Hello world</h1><p>Some <i>nice</i> text</p><div id="feed"></div>');
    document.title = 'My page';
    const states: PageState[] = [];
    const translator = new PageTranslator({ translate: fakeTranslate, onState: (s) => states.push(s) });

    expect(translator.start({ to: 'vi', style: 'general', mode: 'replace' }).status).toBe('translating');
    await settle();
    expect(body.querySelector('h1')?.textContent).toBe('HELLO WORLD');
    expect(body.querySelector('p')?.textContent).toBe('SOME NICE TEXT');
    expect(document.title).toBe('VI My page');
    expect(translator.getState()).toMatchObject({ status: 'translated', provider: 'google' });

    const item = document.createElement('p');
    item.textContent = 'Fresh item';
    body.querySelector('#feed')?.append(item);
    await settle();
    expect(item.textContent).toBe('FRESH ITEM');

    translator.restore();
    expect(body.querySelector('h1')?.textContent).toBe('Hello world');
    expect(body.querySelector('p')?.textContent).toBe('Some nice text');
    expect(item.textContent).toBe('Fresh item');
    expect(document.title).toBe('My page');
    // Never reported as finished while work is outstanding.
    expect(states[0]?.status).toBe('translating');
    expect(states.filter((s) => s.status === 'translated' && s.done < s.total)).toEqual([]);
    expect(states.at(-1)?.status).toBe('idle');
  });

  it('translates titles set by single-page-app navigations', async () => {
    setBody('<p>Body text here</p>');
    document.title = 'First page';
    const translator = new PageTranslator({ translate: fakeTranslate });
    translator.start({ to: 'vi', style: 'general', mode: 'replace' });
    await settle();
    expect(document.title).toBe('VI First page');
    document.title = 'Second page';
    await settle();
    expect(document.title).toBe('VI Second page');
    translator.restore();
    expect(document.title).toBe('Second page');
  });

  it('switches to bilingual mode and removes inserted nodes on restore', async () => {
    const body = setBody('<p>This paragraph is long enough to be shown bilingually.</p><button>OK go</button>');
    const translator = new PageTranslator({ translate: fakeTranslate });
    translator.start({ to: 'vi', style: 'general', mode: 'bilingual' });
    await settle();
    expect(body.querySelectorAll('[data-tpc="bilingual"]').length).toBe(1);
    expect(body.querySelector('p')?.textContent).toContain('This paragraph');
    expect(body.querySelector('button')?.textContent).toBe('OK GO'); // short UI text is replaced in place
    translator.restore();
    expect(body.querySelectorAll('[data-tpc]').length).toBe(0);
    expect(body.querySelector('button')?.textContent).toBe('OK go');
  });

  it('falls back to per-text-node translation when placeholders break', async () => {
    const body = setBody('<p>Hello <b>bold</b> end</p>');
    const translate = vi.fn(async (req: TranslateRequest) => ({
      // Drop placeholders on multi-node segments; plain segments come back uppercased.
      texts: req.texts.map((t) => (t.includes('<x') ? 'broken' : t.toUpperCase())),
      provider: 'google',
    }));
    const translator = new PageTranslator({ translate });
    translator.start({ to: 'vi', style: 'general', mode: 'replace' });
    await settle();
    expect(body.querySelector('p')?.textContent).toBe('HELLO BOLD END');
    expect(body.querySelector('b')?.textContent).toBe('BOLD');
  });
});
