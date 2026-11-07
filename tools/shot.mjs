// Usage: node tools/shot.mjs <url> <out.png> [waitMs=4000] [width=1280] [height=720]
// Renders a page in headless Chrome (SwiftShader WebGL2) and saves a screenshot.
// Waits until window.__ready === true (if the page sets it) or waitMs elapses.
import { chromium } from '@playwright/test';
const [url, out, waitMs = '4000', w = '1280', h = '720'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
p.on('pageerror', (e) => errors.push(String(e)));
await p.goto(url);
try { await p.waitForFunction(() => window.__ready === true, null, { timeout: +waitMs, polling: 1000 }); } catch {}
await p.waitForTimeout(500);
await p.screenshot({ path: out, timeout: 120000 });
if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n')); else console.log('ok ' + out);
await b.close();
