/**
 * Generates the PWA icons and favicon without any image dependencies.
 *
 * Run from the repo root:
 *   node scripts/generate-icons.mjs
 *
 * The artwork is a white speech bubble with three dots on the brand blue
 * background. It stays inside the maskable safe zone, so the same drawing works
 * for both `any` and `maskable` icons.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = join(ROOT, 'public');

const BACKGROUND = [30, 64, 175, 255]; // --color-primary #1e40af
const FOREGROUND = [255, 255, 255, 255];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowLength = width * 4 + 1;
  const raw = Buffer.alloc(rowLength * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * rowLength] = 0; // filter: none
    rgba.copy(raw, y * rowLength + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function insideRoundedRect(x, y, x0, y0, x1, y1, radius) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;

  const nearestX = Math.min(Math.max(x, x0 + radius), x1 - radius);
  const nearestY = Math.min(Math.max(y, y0 + radius), y1 - radius);
  const dx = x - nearestX;
  const dy = y - nearestY;

  return dx * dx + dy * dy <= radius * radius;
}

function insideTriangle(px, py, [ax, ay], [bx, by], [cx, cy]) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);

  const hasNegative = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPositive = d1 > 0 || d2 > 0 || d3 > 0;

  return !(hasNegative && hasPositive);
}

function insideCircle(x, y, cx, cy, radius) {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

/** Draws the icon at a normalized 0..1 coordinate. */
function sample(nx, ny) {
  const bubble = insideRoundedRect(nx, ny, 0.22, 0.26, 0.78, 0.62, 0.09);
  const tail = insideTriangle(nx, ny, [0.29, 0.6], [0.27, 0.75], [0.45, 0.6]);

  if (bubble || tail) {
    const dots = [
      [0.385, 0.44],
      [0.5, 0.44],
      [0.615, 0.44],
    ];

    if (dots.some(([cx, cy]) => insideCircle(nx, ny, cx, cy, 0.042))) {
      return BACKGROUND;
    }

    return FOREGROUND;
  }

  return BACKGROUND;
}

function renderIcon(size) {
  const supersampling = 4;
  const rgba = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < supersampling; sy += 1) {
        for (let sx = 0; sx < supersampling; sx += 1) {
          const nx = (x + (sx + 0.5) / supersampling) / size;
          const ny = (y + (sy + 0.5) / supersampling) / size;
          const [cr, cg, cb, ca] = sample(nx, ny);
          r += cr;
          g += cg;
          b += cb;
          a += ca;
        }
      }

      const samples = supersampling * supersampling;
      const offset = (y * size + x) * 4;
      rgba[offset] = Math.round(r / samples);
      rgba[offset + 1] = Math.round(g / samples);
      rgba[offset + 2] = Math.round(b / samples);
      rgba[offset + 3] = Math.round(a / samples);
    }
  }

  return encodePng(size, size, rgba);
}

/** ICO files may embed a PNG directly (supported by all modern browsers). */
function encodeIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count

  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size; // width
  entry[1] = size >= 256 ? 0 : size; // height
  entry[2] = 0; // palette
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32BE(png.length, 8);
  entry.writeUInt32BE(header.length + entry.length, 12);

  return Buffer.concat([header, entry, png]);
}

mkdirSync(PUBLIC_DIR, { recursive: true });

const outputs = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
];

for (const [name, size] of outputs) {
  writeFileSync(join(PUBLIC_DIR, name), renderIcon(size));
  console.log(`wrote public/${name} (${size}x${size})`);
}

const favicon = encodeIco(renderIcon(32), 32);
writeFileSync(join(PUBLIC_DIR, 'favicon.ico'), favicon);
console.log('wrote public/favicon.ico (32x32)');
