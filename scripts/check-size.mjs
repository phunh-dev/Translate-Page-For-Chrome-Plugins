// Enforces the bundle-size budgets from the plan (gzip sizes of the built extension).
// Usage: pnpm build && node scripts/check-size.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const OUT = join(process.cwd(), '.output', 'chrome-mv3');
const KB = 1024;

const gz = (file) => gzipSync(readFileSync(join(OUT, file))).length;

/** JS/CSS referenced by an HTML page (scripts, stylesheets, modulepreloads). */
function pageAssets(html) {
  const source = readFileSync(join(OUT, html), 'utf8');
  return [...new Set([...source.matchAll(/(?:src|href)="\/?([^"]+\.(?:js|css))"/g)].map((m) => m[1]))];
}

const budgets = [
  { name: 'content loader (every page)', files: ['content-scripts/content.js'], limit: 10 * KB },
  { name: 'page translator (on demand)', files: ['content-scripts/page-translator.js'], limit: 30 * KB },
  { name: 'selection card (on demand)', files: ['content-scripts/selection-ui.js'], limit: 30 * KB },
  { name: 'popup', files: pageAssets('popup.html'), limit: 50 * KB },
  { name: 'background', files: ['background.js'], limit: 40 * KB },
];

let failed = false;
for (const { name, files, limit } of budgets) {
  const size = files.reduce((sum, f) => sum + gz(f), 0);
  const ok = size <= limit;
  failed ||= !ok;
  console.log(`${ok ? '✔' : '✖'} ${name.padEnd(30)} ${(size / KB).toFixed(1).padStart(6)} KB gz / ${limit / KB} KB`);
}
if (failed) {
  console.error('Bundle size budget exceeded.');
  process.exit(1);
}
