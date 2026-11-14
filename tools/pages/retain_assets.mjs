#!/usr/bin/env node
// Keep earlier builds' hashed assets on GitHub Pages for a while after each deploy.
//
// Pages serves index.html with `Cache-Control: max-age=600`, and every deploy replaces the whole
// site. A browser (or an intermediate cache) holding the previous index.html therefore asked for the
// previous build's hashed bundle — which the new deploy had just deleted — and showed a blank page
// for up to ten minutes. This script runs in the deploy job between `npm run build` and the artifact
// upload. It copies into dist/assets every asset the live site serves now (found by crawling the live
// index.html and, recursively, every JS/CSS file it references) and every asset listed in the live
// site's asset-history.json that is still within the retention window. Then it writes a new
// dist/asset-history.json, so files survive as many deploys as the window allows.
//
// Hashed names are content-addressed: a file already in dist is never overwritten. Nothing is ever
// fetched from anywhere but the live site itself.
//
//   node tools/pages/retain_assets.mjs <liveBaseUrl> <distDir> [retentionDays=14]
//   (liveBaseUrl ends with a slash, e.g. https://example.github.io/repo/; file:// works for tests)
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [base, dist, daysArg = '14'] = process.argv.slice(2);
if (!base || !dist) {
  console.error('usage: retain_assets.mjs <liveBaseUrl> <distDir> [retentionDays=14]');
  process.exit(2);
}
const RETAIN_MS = Number(daysArg) * 86_400_000;
const now = new Date();
const HISTORY = 'asset-history.json';
/** a hashed asset name as Vite emits it: name-XXXXXXXX.ext */
const HASHED = /[A-Za-z0-9_][A-Za-z0-9_.-]*-[A-Za-z0-9_-]{8}\.[a-z0-9]{2,5}/g;

async function get(path) {
  const url = new URL(path, base);
  if (url.protocol === 'file:') {
    try {
      return { ok: true, buf: readFileSync(url) };
    } catch {
      return { ok: false, status: 404 };
    }
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
      if (r.status === 404) return { ok: false, status: 404 };
      if (r.ok) return { ok: true, buf: Buffer.from(await r.arrayBuffer()) };
    } catch {
      /* retry */
    }
    await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
  }
  return { ok: false, status: 0 };
}

const distAssets = join(dist, 'assets');
mkdirSync(distAssets, { recursive: true });
const own = new Set(readdirSync(distAssets));

// 1. what the live site serves now
const live = new Set();
const index = await get('index.html');
if (!index.ok) {
  console.log(`retain: no live index.html (${index.status}) — first deploy or site down; nothing carried over`);
} else {
  const queue = [];
  for (const m of index.buf.toString('utf8').matchAll(/assets\/([^"'?#\s)]+)/g)) queue.push(m[1]);
  const seen = new Set();
  while (queue.length) {
    const name = queue.shift();
    if (seen.has(name)) continue;
    seen.add(name);
    const r = await get(`assets/${name}`);
    if (!r.ok) continue;
    live.add(name);
    if (!own.has(name)) {
      writeFileSync(join(distAssets, name), r.buf);
    }
    if (/\.(js|css|mjs)$/.test(name)) for (const m of r.buf.toString('utf8').matchAll(HASHED)) if (!seen.has(m[0])) queue.push(m[0]);
  }
}

// 2. older files the live site still carries, within the window
const hist = await get(HISTORY);
let prev = {};
if (hist.ok) {
  try {
    prev = JSON.parse(hist.buf.toString('utf8')).files ?? {};
  } catch {
    prev = {};
  }
}
const files = {};
let carried = 0;
let dropped = 0;
for (const [name, e] of Object.entries(prev)) {
  if (own.has(name) || live.has(name)) continue;
  const lastLive = new Date(e.lastLive ?? e.firstSeen ?? 0);
  if (now - lastLive > RETAIN_MS) {
    dropped++;
    continue;
  }
  const r = await get(`assets/${name}`);
  if (!r.ok) continue;
  writeFileSync(join(distAssets, name), r.buf);
  files[name] = { firstSeen: e.firstSeen ?? lastLive.toISOString(), lastLive: lastLive.toISOString(), retained: true };
  carried++;
}
// files that were live until this deploy: their window starts now
for (const name of live) {
  if (own.has(name)) continue;
  files[name] = { firstSeen: prev[name]?.firstSeen ?? now.toISOString(), lastLive: now.toISOString(), retained: true };
}
// this build's own files
for (const name of own) files[name] = { firstSeen: prev[name]?.firstSeen ?? now.toISOString(), lastLive: now.toISOString() };

writeFileSync(join(dist, HISTORY), JSON.stringify({ version: 1, generated: now.toISOString(), retentionDays: Number(daysArg), files }, null, 1));
const retained = Object.values(files).filter((f) => f.retained).length;
console.log(`retain: ${own.size} own, ${[...live].filter((n) => !own.has(n)).length} from the live build, ${carried} older within ${daysArg} d, ${dropped} expired; ${retained} retained files in dist/assets`);
if (!existsSync(join(dist, 'index.html'))) process.exit(1);
