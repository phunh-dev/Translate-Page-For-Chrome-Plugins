import { decodeEntities, escapeHtml, hashString, stripPlaceholders } from '@/core/html';

describe('html helpers', () => {
  it('escapes only markup-significant characters', () => {
    expect(escapeHtml('a < b && c > d "q"')).toBe('a &lt; b &amp;&amp; c &gt; d "q"');
  });

  it('decodes named and numeric entities', () => {
    expect(decodeEntities('Tom &amp; Jerry &#39;s &#x1F600; &nbsp;&hellip;')).toBe("Tom & Jerry 's 😀  …");
    expect(decodeEntities('&unknown; stays')).toBe('&unknown; stays');
  });

  it('strips placeholders and decodes', () => {
    expect(stripPlaceholders('Click <x0>here</x0> &amp; <x1/>go')).toBe('Click here & go');
  });

  it('hashes deterministically', () => {
    expect(hashString('hello')).toBe(hashString('hello'));
    expect(hashString('hello')).not.toBe(hashString('hellp'));
  });
});
