#!/usr/bin/env node
// CI check: the built site loads its assets under the GitHub Pages base path.
//
//   node tools/pages/check_dist.mjs [distDir=dist] [basePath=/skifree-the-last-descent/]
//
// Serves distDir at basePath (a sub-path, like Pages), then crawls from index.html: every asset the
// HTML names, and every hashed file referenced from the JS/CSS it loads, must answer 200 at the
// URL the browser would resolve (relative to the page or the module). Each file is then checked:
//   .webp  decoded in full (sharp) — real image, expected size
//   .skm   SKM1 header and lengths consistent (the game's decoder contract)
//   .js    parses as a module (node --check)
//   .css   non-empty
// and every art file whose source is in tools/assets/manifest.json must be byte-identical to the
// committed, licence-checked file. Exit code 1 on any problem. No network access needed.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const [distArg = 'dist', BASE = '/skifree-the-last-descent/'] = process.argv.slice(2);
const dist = resolve(distArg);
const manifest = JSON.parse(readFileSync(join(ROOT, 'tools/assets/manifest.json'), 'utf8'));
const bySourceName = new Map(manifest.outputs.map((o) => [o.path.split('/').pop(), o]));
const sharp = createRequire(import.meta.url)('sharp');

const server = createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!u.startsWith(BASE)) return void res.writeHead(404).end();
  const rel = u.slice(BASE.length) || 'index.html';
  const file = normalize(join(dist, rel));
  if (!file.startsWith(dist) || !existsSync(file)) return void res.writeHead(404).end();
  res.writeHead(200).end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const problems = [];
const checked = new Map();
const HASHED = /[A-Za-z0-9_][A-Za-z0-9_.-]*-[A-Za-z0-9_-]{8}\.[a-z0-9]{2,5}/g;
const tmp = mkdtempSync(join(tmpdir(), 'distcheck-'));

async function check(url, from) {
  if (checked.has(url)) return;
  checked.set(url, 'pending');
  const r = await fetch(url);
  if (r.status !== 200) {
    problems.push(`HTTP ${r.status}: ${url.replace(origin, '')} (referenced from ${from})`);
    checked.set(url, 'missing');
    return;
  }
  const buf = Buffer.from(await r.arrayBuffer());
  const name = url.split('/').pop();
  const ext = extname(name);
  try {
    if (ext === '.webp') {
      const { info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
      if (info.width < 64 || info.height < 64) throw new Error(`tiny image ${info.width}×${info.height}`);
    } else if (ext === '.skm') {
      const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      if (dv.getUint32(0, true) !== 0x314d4b53) throw new Error('bad SKM1 magic');
      const vc = dv.getUint32(4, true);
      const ic = dv.getUint32(8, true);
      const want = 36 + vc * 6 + (vc < 65536 ? 2 : 4) * ic;
      if (vc < 3 || ic % 3 || buf.length < want) throw new Error(`SKM lengths inconsistent (vc ${vc}, ic ${ic}, ${buf.length} B < ${want} B)`);
    } else if (ext === '.js') {
      const f = join(tmp, name.replace(/\.js$/, '.mjs'));
      writeFileSync(f, buf);
      execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    } else if (ext === '.css') {
      if (buf.length < 10) throw new Error('empty stylesheet');
    }
  } catch (e) {
    problems.push(`${name}: does not load — ${String(e.message ?? e).split('\n')[0]}`);
  }
  // art from the manifest must be the committed, licence-checked bytes
  const src = name.replace(/-[A-Za-z0-9_-]{8}(\.[a-z0-9]+)$/, '$1');
  const o = bySourceName.get(src);
  if (o && createHash('sha256').update(buf).digest('hex') !== o.sha256) problems.push(`${name}: differs from ${o.path} in the asset manifest`);
  if (!o && (ext === '.webp' || ext === '.skm')) problems.push(`${name}: bundled art not in tools/assets/manifest.json`);
  checked.set(url, 'ok');
  if (ext === '.js' || ext === '.css') {
    const text = buf.toString('utf8');
    const refs = new Set([...text.matchAll(HASHED)].map((m) => m[0]).filter((n) => n !== name));
    for (const n of refs) {
      // Vite resolves `new URL("x", import.meta.url)` and CSS url() relative to the referencing file
      const u = new URL(n, url).href;
      const exists = existsSync(join(dirname(join(dist, new URL(url).pathname.slice(BASE.length))), n));
      if (exists || /\.(webp|skm|js|css|png|jpg|json|bin|wasm)$/.test(n)) await check(u, name);
    }
  }
}

const indexUrl = `${origin}${BASE}`;
const idx = await fetch(indexUrl);
if (idx.status !== 200) problems.push(`index.html: HTTP ${idx.status}`);
else {
  const html = await idx.text();
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((h) => !/^(data:|https?:|#)/.test(h));
  if (!refs.some((h) => /\.js$/.test(h))) problems.push('index.html names no script');
  for (const h of refs) await check(new URL(h, indexUrl).href, 'index.html');
}
server.close();
rmSync(tmp, { recursive: true, force: true });

const ok = [...checked.values()].filter((v) => v === 'ok').length;
if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`);
  console.error(`dist check FAILED: ${problems.length} problem(s), ${ok} file(s) OK, base ${BASE}`);
  process.exit(1);
}
console.log(`dist check OK: ${ok} files load under ${BASE} (${[...checked.keys()].map((u) => u.split('/').pop()).join(', ')})`);
