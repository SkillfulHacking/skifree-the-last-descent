// Round 3 (W-076): the watched cave cinematic's hand-off into the chase, frame by frame — the last
// second of the cinematic and the chase's first 1.6 s (the camera's swing back to third person while
// the Yeti leaps), every 0.2 s, HUD on, for each location's Classic Sprint. Production build,
// SwiftShader. manifest.json records the session state of every frame.
//   node tools/handoff_strip.mjs <outDir> [WxH=960x540] [biomes=alpine,fjord,whiteout]
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const [outDir = '/tmp/handoff', size = '960x540', list = 'alpine,fjord,whiteout'] = process.argv.slice(2);
const base = process.env.BASE ?? 'http://127.0.0.1:4471';
const [W, H] = size.split('x').map(Number);
mkdirSync(outDir, { recursive: true });
const sha = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim() + (execSync('git status --porcelain --untracked-files=no -- src').toString().trim() ? '+dirty' : ''); } catch { return 'unknown'; } })();
const manifest = { sha, viewport: size, renderer: 'SwiftShader (software)', date: new Date().toISOString(), frames: [], errors: [] };
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME ?? '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const biome of list.split(',')) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => manifest.errors.push(`${biome}: ${String(e).slice(0, 300)}`));
  await page.addInitScript((b) => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.setItem('skifree-tld.settings.v1', JSON.stringify({ quality: 'high', biome: b, course: 'classic', courseLength: 'sprint', difficulty: 'normal', showTutorial: false, seenPoleHint: true })); } }, biome);
  await page.goto(`${base}/?debug`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 900_000, polling: 1000 });
  await page.evaluate(async () => { const k = window.__skifree; await k.startRun(true); k.hold(true); k.autopilot('skilled'); k.advance(200); k.autopilot(null); });
  await page.evaluate(() => { const k = window.__skifree; while (k.state().session.phase === 'caveCinematic' && k.state().session.cinematicTime < 13.6) k.frames(1, 1 / 30); });
  for (let i = 0; i < 22; i++) {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const s = await page.evaluate(() => window.__skifree.state().session);
    const name = `${biome}_${String(i).padStart(2, '0')}`;
    await page.screenshot({ path: `${outDir}/${name}.png`, timeout: 1_200_000 });
    manifest.frames.push({ name, biome, phase: s.phase, cinematicTime: s.cinematicTime, chaseTime: s.chaseTime, yetiPos: s.yetiPos, yetiRoot: s.yetiRoot, yetiAirborne: s.yetiAirborne, yetiVisible: s.yetiVisible, yetiMode: s.yetiMode, z: s.z, cam: await page.evaluate(() => window.__skifree.cameraPose()) });
    writeFileSync(`${outDir}/manifest.json`, JSON.stringify(manifest, null, 2));
    console.log(name, s.phase, s.cinematicTime.toFixed(2), s.chaseTime?.toFixed?.(2));
    await page.evaluate(() => window.__skifree.frames(6, 1 / 30)); // 0.2 s
  }
  await page.close();
}
await browser.close();
