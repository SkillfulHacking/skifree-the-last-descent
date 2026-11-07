// node tools/probe.mjs <url> [seconds]  — logs console + polls window.__skifree.state()
import { chromium } from '@playwright/test';
const [url, secs = '60'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
p.on('console', (m) => console.log('[console.' + m.type() + ']', m.text().slice(0, 300)));
p.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 500)));
const t0 = Date.now();
await p.goto(url);
for (let i = 0; i < +secs; i += 5) {
  await new Promise((r) => setTimeout(r, 5000));
  try {
    const s = await Promise.race([p.evaluate(() => ({ ready: window.__ready === true, st: window.__skifree?.state?.(), perf: window.__skifree?.perf?.() })), new Promise((r) => setTimeout(() => r('EVAL TIMEOUT'), 8000))]);
    console.log(((Date.now() - t0) / 1000).toFixed(0) + 's', JSON.stringify(s).slice(0, 400));
  } catch (e) { console.log('eval error', String(e).slice(0, 200)); }
}
await b.close();
