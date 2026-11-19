// Round 3 (R2 A N1): measure the storm horizon from the gameplay camera — the sky/dome value just
// above the horizon against the fogged ground just below it — at full storm. Writes PNGs and a JSON
// with the horizon row (projected) and the mean colours of bands above/below it.
//   node tools/storm_horizon_probe.mjs <outDir> [seed=WO-R2] [variants=current]
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const [outDir = '/tmp/probe', seed = 'WO-R2'] = process.argv.slice(2);
const base = process.env.BASE ?? 'http://127.0.0.1:4471';
mkdirSync(outDir, { recursive: true });
const W = 960, H = 540;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME ?? '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
await page.addInitScript((s) => { if (!sessionStorage.getItem('p')) { sessionStorage.setItem('p', '1'); localStorage.setItem('skifree-tld.settings.v1', JSON.stringify(s)); } }, { quality: 'high', biome: 'whiteout', course: 'custom', courseLength: 'sprint', difficulty: 'normal', showTutorial: false, seenPoleHint: true });
await page.goto(`${base}/?debug`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 900_000, polling: 1000 });
const ev = (fn, a) => page.evaluate(fn, a);
await ev((sd) => window.__skifree.setCourse('custom', 'sprint', { difficulty: 'normal', biome: 'whiteout', custom: sd }), seed);
await ev(() => window.__skifree.startRun(true));
await page.waitForTimeout(2500);
await ev(() => window.__skifree.hold(true));
await ev(() => window.__skifree.toChase());
await ev(() => { for (let i = 0; i < 400; i++) window.__skifree.frames(1, 1 / 30); });
// the strongest storm in the first 300 s
const t = await ev(() => { let best = 0, bt = 0; for (let t = 20; t < 300; t += 0.5) { const f = window.__skifree.front(t); if (f && f.s > best) { best = f.s; bt = t; } } return bt; });
const out = { seed, t, errors, shots: [] };
const VARIANTS = JSON.parse(process.env.VARIANTS ?? '[[1,1,1]]');
await ev(([zz]) => { window.__skifree.teleport(zz, 16); window.__skifree.autopilot('skilled'); window.__skifree.placeYeti(260); }, [900]);
await ev((tt) => window.__skifree.setTime(tt), t);
await ev(() => { for (let i = 0; i < 60; i++) window.__skifree.frames(1, 1 / 30); window.__skifree.hud(false); });
for (const [i, v] of VARIANTS.entries()) {
  // hold the run, tint the dome (× fog colour) and its opacity, render
  await ev((vv) => { window.__skifree.frames(1, 1 / 30); const e = window.__skifree.world().env; const d = e.stormDome; d.material.color.copy(e.fog.color).multiply({ r: vv[0], g: vv[1], b: vv[2] }); if (vv[3] !== undefined) d.material.opacity = vv[3]; window.__skifree.hold(true); }, v);
  await page.waitForTimeout(3000);
  const file = `${outDir}/v${i}.png`;
  await page.screenshot({ path: file, timeout: 1_200_000 });
  out.shots.push({ v, file });
  console.log('shot', file, JSON.stringify(v));
}
writeFileSync(`${outDir}/probe.json`, JSON.stringify(out, null, 2));
await browser.close();
process.exit(0);

for (const z of [900, 1500]) {
  await ev(([zz]) => { window.__skifree.teleport(zz, 16); window.__skifree.autopilot('skilled'); window.__skifree.placeYeti(260); }, [z]);
  await ev((tt) => window.__skifree.setTime(tt), t);
  await ev(() => { for (let i = 0; i < 60; i++) window.__skifree.frames(1, 1 / 30); window.__skifree.settleWeather?.(); window.__skifree.hud(false); });
  for (const v of ['current', 'nodome']) {
    await ev((vv) => { const e = window.__skifree.world().env; window.__skifree.frames(1, 1 / 30); if (e.stormDome) e.stormDome.visible = vv !== 'nodome'; }, v);
    await ev(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForTimeout(400);
    const file = `${outDir}/z${z}_${v}.png`;
    await page.screenshot({ path: file, timeout: 1_200_000 });
    const info = await ev(() => { const w = window.__skifree.world(); const e = w.env; return { storm: e.storm, fog: e.fog.color.toArray(), density: e.fog.density, dome: e.stormDome ? { op: e.stormDome.material.opacity, col: e.stormDome.material.color.toArray(), vis: e.stormDome.visible } : null, cam: window.__skifree.cameraPose() }; });
    out.shots.push({ z, variant: v, file, info });
    console.log('shot', file, JSON.stringify(info));
  }
}
writeFileSync(`${outDir}/probe.json`, JSON.stringify(out, null, 2));
await browser.close();
