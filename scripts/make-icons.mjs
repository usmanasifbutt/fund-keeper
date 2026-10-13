// Draws Keeper's app icons (a rising line on deep green) and writes them as PNGs into public/.
// No dependencies: a tiny PNG encoder using Node's zlib.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [15, 61, 54];
const FG = [232, 242, 239];
const ACCENT = [92, 195, 168];
// Line points in a 0..1 box.
const LINE = [[0.2, 0.7], [0.4, 0.52], [0.56, 0.6], [0.8, 0.32]];

function draw(size, { maskable = false, rounded = true } = {}) {
  const ss = 4; // supersampling for smooth edges
  const px = new Float32Array(size * size * 3);
  const inset = maskable ? 0.12 : 0; // keep the drawing inside the maskable safe zone
  const radius = rounded && !maskable ? 0.22 : 0;
  const stroke = 0.075;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const u = (x + (sx + 0.5) / ss) / size;
          const v = (y + (sy + 0.5) / ss) / size;
          if (!inRoundedSquare(u, v, radius)) continue;
          let c = BG;
          const lu = (u - inset) / (1 - 2 * inset);
          const lv = (v - inset) / (1 - 2 * inset);
          if (distToLine(lu, lv) < stroke / 2) c = FG;
          const [ex, ey] = LINE[LINE.length - 1];
          if (Math.hypot(lu - ex, lv - ey) < stroke * 0.95) c = ACCENT;
          r += c[0]; g += c[1]; b += c[2]; a += 1;
        }
      }
      const n = ss * ss;
      const i = (y * size + x) * 3;
      px[i] = r / n; px[i + 1] = g / n; px[i + 2] = b / n;
      alpha[y * size + x] = a / n;
    }
  }
  return px;
}

let alpha;
function render(size, opts) {
  alpha = new Float32Array(size * size);
  const rgb = draw(size, opts);
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const a = alpha[y * size + x];
      const o = y * (size * 4 + 1) + 1 + x * 4;
      const i = (y * size + x) * 3;
      // un-premultiply the averaged colour
      raw[o] = a ? Math.round(rgb[i] / a) : 0;
      raw[o + 1] = a ? Math.round(rgb[i + 1] / a) : 0;
      raw[o + 2] = a ? Math.round(rgb[i + 2] / a) : 0;
      raw[o + 3] = Math.round(a * 255);
    }
  }
  return png(size, raw);
}

function inRoundedSquare(u, v, r) {
  if (!r) return true;
  const cx = Math.min(Math.max(u, r), 1 - r);
  const cy = Math.min(Math.max(v, r), 1 - r);
  return Math.hypot(u - cx, v - cy) <= r;
}

function distToLine(u, v) {
  let best = Infinity;
  for (let k = 0; k < LINE.length - 1; k++) {
    const [ax, ay] = LINE[k];
    const [bx, by] = LINE[k + 1];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(u - (ax + t * dx), v - (ay + t * dy)));
  }
  return best;
}

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public', { recursive: true });
writeFileSync('public/icon-192.png', render(192, {}));
writeFileSync('public/icon-512.png', render(512, {}));
writeFileSync('public/icon-maskable-512.png', render(512, { maskable: true }));
writeFileSync('public/apple-touch-icon.png', render(180, { rounded: false })); // iOS rounds the corners itself

const pts = LINE.map(([x, y]) => `${x * 64},${y * 64}`).join(' ');
const [ex, ey] = LINE[LINE.length - 1];
writeFileSync('public/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="rgb(${BG})"/>
<polyline points="${pts}" fill="none" stroke="rgb(${FG})" stroke-width="4.8" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="${ex * 64}" cy="${ey * 64}" r="4.6" fill="rgb(${ACCENT})"/>
</svg>
`);
console.log('Icons written to public/');
