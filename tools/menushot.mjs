// node tools/menushot.mjs <url> <outPrefix> <WxH,...> — main-menu screenshots + overflow metrics
import { chromium } from '@playwright/test';
const [url, out, sizes] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const s of sizes.split(',')) {
  const [w, h] = s.split('x').map(Number);
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto(url);
  await p.waitForFunction(() => window.__ready === true, null, { timeout: 240000, polling: 1000 });
  await p.waitForTimeout(1500);
  const m = await p.evaluate(() => {
    const panel = document.querySelector('.menu-panel');
    const title = document.querySelector('.menu-title');
    const r = title.getBoundingClientRect();
    const rows = [...document.querySelectorAll('.menu-row')].map((e) => { const q = e.getBoundingClientRect(); return [Math.round(q.top), Math.round(q.bottom)]; });
    return { panelScroll: panel.scrollHeight - panel.clientHeight, docOverflowX: document.documentElement.scrollWidth - innerWidth, titleTop: Math.round(r.top), titleBottom: Math.round(r.bottom), titleLeft: Math.round(r.left), viewport: [innerWidth, innerHeight], rows };
  });
  console.log(s, JSON.stringify(m));
  await p.screenshot({ path: `${out}_${s}.png`, timeout: 240000 });
  await p.close();
}
await b.close();
