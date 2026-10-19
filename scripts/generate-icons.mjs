// Rasterizes the logo (same geometry as LOGO_GLYPH in src/ui/dom.ts) into PNG icons
// without native dependencies: tiny path flattener + supersampled coverage + zlib PNG.
// Usage: node scripts/generate-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const GLYPH = [
  'M5 17.5 8.6 7.5l3.6 10',
  'M6.3 14h4.6',
  'M13.5 8.5h6',
  'M16.5 7v1.5',
  'M18.3 8.5c-.6 3-2.3 5.6-4.8 7',
  'M15 11c1 2 2.6 3.6 4.5 4.5',
];
const FROM = [0x4f, 0x46, 0xe5];
const TO = [0x93, 0x33, 0xea];
const SIZES = [16, 32, 48, 128];

/** Parses M/L/H/V/C (absolute + relative) into polylines in the 24×24 viewBox. */
function flatten(d) {
  const tokens = d.match(/[MLHVCmlhvc]|-?(?:\d+\.?\d*|\.\d+)/g) ?? [];
  const lines = [];
  let current = [];
  let x = 0;
  let y = 0;
  let cmd = 'M';
  let i = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    switch (cmd.toUpperCase()) {
      case 'M': {
        const nx = num() + (rel ? x : 0);
        const ny = num() + (rel ? y : 0);
        if (current.length > 1) lines.push(current);
        current = [[nx, ny]];
        x = nx;
        y = ny;
        cmd = rel ? 'l' : 'L'; // implicit lineto
        break;
      }
      case 'L': {
        x = num() + (rel ? x : 0);
        y = num() + (rel ? y : 0);
        current.push([x, y]);
        break;
      }
      case 'H':
        x = num() + (rel ? x : 0);
        current.push([x, y]);
        break;
      case 'V':
        y = num() + (rel ? y : 0);
        current.push([x, y]);
        break;
      case 'C': {
        const [x1, y1, x2, y2, ex, ey] = [num(), num(), num(), num(), num(), num()].map((v, k) => v + (rel ? (k % 2 === 0 ? x : y) : 0));
        for (let s = 1; s <= 16; s++) {
          const t = s / 16;
          const u = 1 - t;
          current.push([
            u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * ex,
            u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * ey,
          ]);
        }
        x = ex;
        y = ey;
        break;
      }
      default:
        throw new Error(`Unsupported command ${cmd}`);
    }
  }
  if (current.length > 1) lines.push(current);
  return lines;
}

function segDistance(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function insideRoundedRect(x, y, size, r) {
  const cx = Math.min(Math.max(x, r), size - r);
  const cy = Math.min(Math.max(y, r), size - r);
  return Math.hypot(x - cx, y - cy) <= r;
}

function render(size) {
  const scale = size / 24;
  const polylines = GLYPH.flatMap(flatten);
  // Thicker strokes at small sizes keep the glyph legible.
  const stroke = (size <= 16 ? 2.4 : size <= 32 ? 2.1 : 1.8) / 2;
  const radius = 6 * scale;
  const ss = 4;
  const pixels = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bg = 0;
      let fg = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = px + (sx + 0.5) / ss;
          const y = py + (sy + 0.5) / ss;
          if (!insideRoundedRect(x, y, size, radius)) continue;
          bg++;
          const gx = x / scale;
          const gy = y / scale;
          let hit = false;
          for (const line of polylines) {
            for (let k = 1; k < line.length && !hit; k++) hit = segDistance(gx, gy, line[k - 1], line[k]) <= stroke;
            if (hit) break;
          }
          if (hit) fg++;
        }
      }
      const total = ss * ss;
      const t = (px + py) / (2 * size);
      const base = FROM.map((c, k) => c + (TO[k] - c) * t);
      const f = bg === 0 ? 0 : fg / bg;
      const o = (py * size + px) * 4;
      pixels[o] = Math.round(base[0] + (255 - base[0]) * f);
      pixels[o + 1] = Math.round(base[1] + (255 - base[1]) * f);
      pixels[o + 2] = Math.round(base[2] + (255 - base[2]) * f);
      pixels[o + 3] = Math.round((bg / total) * 255);
    }
  }
  return encodePng(size, size, pixels);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icon');
mkdirSync(outDir, { recursive: true });
for (const size of SIZES) {
  writeFileSync(join(outDir, `${size}.png`), render(size));
}
console.log(`Wrote ${SIZES.map((s) => `${s}.png`).join(', ')} to public/icon`);
