// W-031 diagnostic: the Whiteout storm-cave leap beat. Deterministic frames at fixed cinematic times,
// each with the render transform dumped (renderProbe) and the shared-atmosphere debug views
// (atmoDebug: 0 beauty, 1 no fog, 2 fog amount, 3 distance heatmap, 4 height factor,
// 5 world-position bands, 6 sf_atmosphere surfaces in magenta, 7 optical-depth terms).
//   node tools/w031_probe.mjs <outDir> [WxH=640x360] [seed=WO-DEV2] [length=sprint] [biome=whiteout]
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
/** luminance spread / mean of a capture (white-out frames: stdev 5–15, mean ≈ 188) */
const lum = async (f) => { const s = (await sharp(f).greyscale().stats()).channels[0]; return { stdev: +s.stdev.toFixed(1), mean: +s.mean.toFixed(1) }; };

const [outDir = join(tmpdir(), 'w031'), size = '640x360', seed = 'WO-DEV2', length = 'sprint', biome = 'whiteout'] = process.argv.slice(2);
const TIMES = (process.env.TIMES ?? '13.7,14.5,14.6,15.0,15.8,16.9').split(',').map(Number);
const MODES_ALL = (process.env.MODES ?? '0,1,2,3,6').split(',').map(Number);
const MODES_KEY = [4, 5, 7];
const [W, H] = size.split('x').map(Number);
mkdirSync(outDir, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
await page.addInitScript((s) => {
  if (!sessionStorage.getItem('p')) {
    sessionStorage.setItem('p', '1');
    localStorage.setItem('skifree-tld.settings.v1', JSON.stringify(s));
  }
}, { quality: 'high', biome, course: 'custom', customText: seed, courseLength: length, difficulty: 'normal', rearView: false, showTutorial: false, seenPoleHint: true });
await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:4471'}/?debug`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 900_000, polling: 1000 });
const ev = (fn, a) => page.evaluate(fn, a);
const frames = (pred, n) => ev(([p, m]) => { const f = (0, eval)(p); for (let i = 0; i < m; i++) { const s = window.__skifree.state().session; if (s && f(s)) return true; window.__skifree.frames(1, 1 / 30); } return false; }, [pred, n]);
const RUNS = Number(process.env.RUNS ?? 1);
let courseId = null;
for (let run = 0; run < RUNS; run++) {
await ev(() => { window.__skifree.hold(false); window.__skifree.freeCam(null); window.__skifree.toMenu(); });
await page.waitForTimeout(1500);
// SEED=default keeps the stored custom seed (the course the earlier evidence actually used: W-032)
courseId = await ev(([l, b, sd]) => window.__skifree.setCourse('custom', l, { difficulty: 'normal', biome: b, ...(sd === 'default' ? {} : { custom: sd }) }), [length, biome, seed]);
log('courseId', courseId);
await ev(() => window.__skifree.startRun(true));
await page.waitForTimeout(2500);
await ev(() => { const k = window.__skifree; k.seenCave(false); k.hold(true); k.hud(false); });
}
if (process.env.AUTOP) await ev(() => window.__skifree.autopilot('skilled'));
const ENC = Number(process.env.ENC ?? 0);
const encs = await ev(() => { const m = window.__skifree.world().mountain; return m.profile.encounters(0, Number.isFinite(m.finishZ) ? m.finishZ : 30000); });
log('encounters', JSON.stringify(encs.map((e) => e.triggerZ)), 'using', ENC);
const enc = encs[ENC];
// later encounters: ski to just before the trigger (teleport; the earlier encounters are skipped by the chase rule)
await ev((z) => window.__skifree.teleport(z + 0.5, 16), enc.triggerZ);
log('cinematic started', await frames('(s) => s.phase === "caveCinematic"', 900));
const report = { seed, courseId, length, biome, size, frames: [] };
for (const t of TIMES) {
  await frames(`(s) => s.cinematicTime >= ${t}`, 2000);
  if (process.env.SETTLE) await page.waitForTimeout(Number(process.env.SETTLE));
  const probe = await ev(() => window.__skifree.renderProbe(['terrain-chunk', 'cave-rock', 'cave-icicles', 'whiteout-storm-cave']));
  const s = await ev(() => window.__skifree.state().session);
  const entry = { t: s.cinematicTime, phase: s.phase, probe, shots: [] };
  entry.perf = await ev(() => window.__skifree.perf());
  entry.terrain = await ev((p) => window.__skifree.terrainProbe(p[0], p[2]), probe.camAbs);
  const modes = t === 15.0 ? [...MODES_ALL, ...MODES_KEY] : MODES_ALL;
  for (const mode of modes) {
    await ev((m) => window.__skifree.atmoDebug(m), mode);
    await ev(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
    const f = `${outDir}/t${t.toFixed(1)}_m${mode}.png`;
    await page.screenshot({ path: f, timeout: 1_200_000 });
    entry.shots.push(f);
    if (mode === 0) entry.lum = await lum(f);
  }
  await ev(() => window.__skifree.atmoDebug(0));
  // interventions on the same frozen frame (held: the game does not rewrite the uniform unless the storm changes)
  for (const step of (process.env.STEPS ?? '').split(',').filter(Boolean)) {
    const [kind, arg, val] = step.split(':');
    if (kind === 'set') entry[`set_${arg}`] = await ev(([k, v]) => window.__skifree.atmoSet(k, Number(v)), [arg, val]);
    if (kind === 'hide') entry[`hide_${arg}`] = await ev((n) => window.__skifree.setVisible(n, false), arg);
    if (kind === 'nocull') entry.nocull = await ev(() => window.__skifree.noCull());
    if (kind === 'veil') entry[`veil_${arg}`] = await ev((n) => window.__skifree.hideVeil(Number(n)), arg);
    await ev(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
    const f = `${outDir}/t${t.toFixed(1)}_${kind}_${arg}.png`;
    await page.screenshot({ path: f, timeout: 1_200_000 });
    entry.shots.push(f);
    entry[`probe_after_${kind}_${arg}`] = await ev(() => { const p = window.__skifree.renderProbe([]); return { uFogFalloff: p.uFogFalloff, uFogExp: p.uFogExp }; });
  }
  report.frames.push(entry);
  writeFileSync(`${outDir}/probe.json`, JSON.stringify({ ...report, errors }, null, 2));
  log('t', t, 'cam', probe.camAbs.map((v) => v.toFixed(1)).join(','), 'origin', probe.origin.join(','), 'agrees', probe.matrixAgrees);
}
// the hand-over into the chase
if (process.env.CHASE) {
  const ok = await frames('(s) => s.phase === "chase"', 900);
  await frames('(s) => false', 45);
  const f = `${outDir}/chase.png`;
  await ev(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
  await page.screenshot({ path: f, timeout: 1_200_000 });
  const p = await ev(() => window.__skifree.renderProbe([]));
  report.chase = { ok, lum: await lum(f), origin: p.origin, snow: p.snow, falloff: p.uFogFalloff };
  writeFileSync(`${outDir}/probe.json`, JSON.stringify({ ...report, errors }, null, 2));
}
report.summary = report.frames.map((e) => ({ t: +e.t.toFixed(2), lum: e.lum, origin: e.probe.origin, flake: e.probe.snow?.size, sunBase: e.probe.snow?.sunBase }));
writeFileSync(`${outDir}/probe.json`, JSON.stringify({ ...report, errors }, null, 2));
log('summary', JSON.stringify(report.summary), 'chase', JSON.stringify(report.chase ?? null));
log('done; errors', errors.length);
await browser.close();
