#!/usr/bin/env node
// End-to-end check of cache-safe deploys with two real builds.
//
//   node tools/pages/test_retention.mjs <distOld> <distNew>
//
// 1. "deploy" the old build: retain_assets against an empty site, publish to site1/
// 2. "deploy" the new build: retain_assets against site1 (served over HTTP), publish to site2/
// 3. serve site2 under a Pages-like base path (/repo/) and open, in headless Chrome:
//    a) the OLD index.html — what a browser that cached it before the deploy still has
//    b) the NEW index.html
//    Both must load their bundle and reach the main menu with no failed request and no page error.
// 4. control: the same old index.html against the new build WITHOUT retention must fail (404 on its
//    bundle) — proving the test exercises the defect.
import { chromium } from '@playwright/test';
import { cpSync, mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const [oldDist, newDist] = process.argv.slice(2);
if (!oldDist || !newDist) {
  console.error('usage: test_retention.mjs <distOld> <distNew>');
  process.exit(2);
}
const HERE = new URL('.', import.meta.url).pathname;
const BASE = '/skifree-the-last-descent/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.skm': 'application/octet-stream' };

/** a tiny static host with Pages' URL shape; `override` serves a different index.html */
function serve(root, override) {
  const s = createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (!u.startsWith(BASE)) return void res.writeHead(404).end();
    let rel = u.slice(BASE.length) || 'index.html';
    if (rel.endsWith('/')) rel += 'index.html';
    const file = normalize(join(root, rel));
    if (!file.startsWith(normalize(root))) return void res.writeHead(403).end();
    if (rel === 'index.html' && override) return void res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'max-age=600' }).end(override);
    if (!existsSync(file)) return void res.writeHead(404).end('not found');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'max-age=600' }).end(readFileSync(file));
  });
  return new Promise((r) => s.listen(0, '127.0.0.1', () => r({ s, url: `http://127.0.0.1:${s.address().port}${BASE}` })));
}

const work = mkdtempSync(join(tmpdir(), 'retain-'));
const site1 = join(work, 'site1');
const site2 = join(work, 'site2');
cpSync(oldDist, site1, { recursive: true });
cpSync(newDist, site2, { recursive: true });
// (async: the 'live' site is served from this very process)
const retain = async (live, dist) => (await promisify(execFile)(process.execPath, [join(HERE, 'retain_assets.mjs'), live, dist, '14'], { encoding: 'utf8' })).stdout.trim();

console.log('deploy 1:', await retain(`file://${join(work, 'empty')}/`, site1));
const h1 = await serve(site1);
console.log('deploy 2:', await retain(h1.url, site2));
h1.s.close();

const oldIndex = readFileSync(join(oldDist, 'index.html'), 'utf8');
const b = await chromium.launch({ executablePath: process.env.PW_CHROME ?? '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function open(label, root, override, expectOk) {
  const h = await serve(root, override);
  const page = await b.newPage({ viewport: { width: 640, height: 360 } });
  const failed = [];
  const errors = [];
  let blank;
  const blankP = new Promise((r) => (blank = r));
  page.on('response', (r) => {
    if (r.status() < 400) return;
    failed.push(`${r.status()} ${r.url().replace(h.url, '')}`);
    // a missing entry bundle is a blank screen for good: no need to wait out the timeout
    if (/\.(js|css)$/.test(r.url())) blank();
  });
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  await page.goto(h.url);
  let menu = false;
  try {
    menu = await Promise.race([page.waitForSelector('.menu-row', { timeout: 600_000 }).then(() => true), blankP.then(() => false)]);
  } catch {
    /* blank screen */
  }
  const bundle = await page.evaluate(() => [...document.scripts].map((s) => s.src.split('/').pop()).join(','));
  await page.close();
  h.s.close();
  const ok = menu && failed.length === 0 && errors.length === 0;
  console.log(`${ok === expectOk ? 'PASS' : 'FAIL'} ${label}: bundle ${bundle}; menu ${menu}; failed ${JSON.stringify(failed)}; errors ${JSON.stringify(errors)}`);
  return ok === expectOk;
}

const results = [
  await open('old cached index.html after the new deploy (retained assets)', site2, oldIndex, true),
  await open('new index.html after the new deploy', site2, null, true),
  await open('control: old index.html against the new build without retention', newDist, oldIndex, false),
];
await b.close();
rmSync(work, { recursive: true, force: true });
if (results.every(Boolean)) console.log('retention test: all checks passed');
else {
  console.log('retention test: FAILED');
  process.exit(1);
}
