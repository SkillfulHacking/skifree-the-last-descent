// node tools/menushot.mjs <url> <outPrefix> <WxH[@zoom][~uiScale],...>
// Main-menu screenshots + layout metrics (overflow, title clipping, rows inside the viewport).
import { chromium } from '@playwright/test';
const [url, out, sizes] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const spec of sizes.split(',')) {
  const m0 = /^(\d+)x(\d+)(?:@([\d.]+))?(?:~([\d.]+))?$/.exec(spec);
  const [w, h, zoom, ui] = [Number(m0[1]), Number(m0[2]), Number(m0[3] ?? 1), Number(m0[4] ?? 1)];
  const ctx = await b.newContext({ viewport: { width: Math.round(w / zoom), height: Math.round(h / zoom) }, deviceScaleFactor: zoom });
  const p = await ctx.newPage();
  if (ui !== 1) await p.addInitScript((s) => localStorage.setItem('skifree-tld.settings.v1', JSON.stringify({ uiScale: s, quality: 'low' })), ui);
  else await p.addInitScript(() => localStorage.setItem('skifree-tld.settings.v1', JSON.stringify({ quality: 'low' })));
  await p.goto(url);
  await p.waitForFunction(() => window.__ready === true, null, { timeout: 240000, polling: 1000 });
  await p.waitForTimeout(1200);
  const m = await p.evaluate(() => {
    const panel = document.querySelector('.menu-panel');
    const title = document.querySelector('.hero-title') ?? document.querySelector('.menu-title');
    const r = title.getBoundingClientRect();
    const rows = [...document.querySelectorAll('.menu-root:not(.hidden) .menu-row')].map((e) => e.getBoundingClientRect());
    const vis = rows.filter((q) => q.top >= 0 && q.bottom <= innerHeight + 0.5).length;
    return {
      panelScroll: panel.scrollHeight - panel.clientHeight,
      docOverflowX: document.documentElement.scrollWidth - innerWidth,
      docOverflowY: document.documentElement.scrollHeight - innerHeight,
      titleClipped: title.scrollWidth > title.clientWidth + 1 || r.top < 0 || r.left < 0 || r.right > innerWidth,
      title: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
      rows: rows.length,
      rowsVisible: vis,
      lastRowBottom: Math.round(Math.max(...rows.map((q) => q.bottom))),
      viewport: [innerWidth, innerHeight],
      focused: document.querySelector('.menu-row.focus .label')?.textContent ?? null,
    };
  });
  console.log(spec, JSON.stringify(m));
  await p.screenshot({ path: `${out}_${spec.replace(/[@~]/g, '_')}.png`, timeout: 240000 });
  await ctx.close();
}
await b.close();
