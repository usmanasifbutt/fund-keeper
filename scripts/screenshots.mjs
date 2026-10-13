// Captures the README/docs screenshots from the demo (#demo) using headless Chrome over the
// DevTools protocol. No dependencies: Node 22+ has fetch and WebSocket built in.
//
//   npm run build && npm run preview      (in one terminal, serves http://localhost:4173)
//   node scripts/screenshots.mjs          (in another)
//
// Set CHROME to your Chrome/Edge path if it isn't found automatically.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { resolve } from 'node:path';

const APP = process.env.APP_URL || 'http://localhost:4173/#demo';
const OUT = 'docs/images';
const PORT = 9333;
const CANDIDATES = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const chromePath = CANDIDATES.find(p => existsSync(p));
if (!chromePath) throw new Error('Chrome not found. Set CHROME=/path/to/chrome.');

const profile = resolve('.tmp/chrome-profile');
rmSync(profile, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const chrome = spawn(chromePath, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore' });

let ws;
try {
  const target = await waitFor(async () => {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    return list.find(t => t.type === 'page');
  }, 30000);
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = e => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const n = ++id;
    pending.set(n, { res, rej });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  const evaluate = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.value;
  const until = (expr, ms = 30000) => waitFor(() => evaluate(expr), ms);

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  const setScheme = value => send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value }] });
  await setScheme('light');
  await send('Page.navigate', { url: APP });
  await until(`!!document.querySelector('.strip')`);
  // Hide the demo banner so screenshots look like the real app; load the lazy chart.
  await evaluate(`document.head.insertAdjacentHTML('beforeend', '<style>.demo-banner{display:none!important}</style>'); window.scrollTo(0, document.body.scrollHeight); true`);
  await until(`!!document.querySelector('.chart-svg')`);
  await evaluate(`window.scrollTo(0, 0); true`);
  await sleep(600);

  const shot = async (name, clip) => {
    const params = { format: 'png', captureBeyondViewport: !!clip };
    if (clip) params.clip = { ...clip, scale: 1 };
    const { data } = await send('Page.captureScreenshot', params);
    writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, 'base64'));
    console.log(`  ${OUT}/${name}.png`);
  };
  const element = async (name, selector, pad = 12) => {
    const r = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
      return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }; })()`);
    await shot(name, { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: r.width + pad * 2, height: r.height + pad * 2 });
  };

  console.log('Saving screenshots:');
  await shot('home');
  await element('summary', '.summary');
  await element('funds', 'section[aria-labelledby="funds-h"]');
  await element('share-by-fund', 'section[aria-labelledby="pie-h"]');
  await element('by-category', 'section[aria-labelledby="cat-h"]');
  await element('chart', 'section[aria-labelledby="chart-h"]');

  await setScheme('dark');
  await sleep(300);
  await shot('home-dark');
  await setScheme('light');

  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Edit').click(); true`);
  await until(`!!document.querySelector('.rows')`);
  await sleep(300);
  await shot('edit-holdings');

  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Cancel').click(); true`);
  await until(`!!document.querySelector('.strip')`);
  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Backup').click(); true`);
  await until(`!!document.querySelector('.panel')`);
  await sleep(300);
  await shot('backup');
} finally {
  ws?.close();
  chrome.kill();
}

async function waitFor(fn, ms = 15000) {
  const end = Date.now() + ms;
  for (;;) {
    try { const v = await fn(); if (v) return v; } catch { /* not ready yet */ }
    if (Date.now() > end) throw new Error('Timed out waiting for the page.');
    await sleep(250);
  }
}
