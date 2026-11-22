// Round 3 (W-076, owner's decision 1): the watched cave cinematic's hand-off into the chase, frame by
// frame — from the reaction shot (13.9 s) through the Yeti on the ledge, the swing round to the run and
// the chase's first ~3 s (the leap and landing behind the skier, the rear-view inset), every 0.27 s (N frames, STEP×1/30 s apart; Q=quality),
// HUD on, for each location's Classic Sprint. Production build, SwiftShader. manifest.json records
// the commit, the session state and the camera (position, fov, direction).
//   node tools/handoff_strip.mjs <outDir> [WxH=960x540] [biomes=alpine,fjord,whiteout]
//   DIFF=hard REDUCE=1 (Reduce Camera Motion) SKIP_AT=<s> (skip with Escape at that time; second viewing)
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [outDir = join(tmpdir(), 'handoff'), size = '960x540', list = 'alpine,fjord,whiteout'] = process.argv.slice(2);
const base = process.env.BASE ?? 'http://127.0.0.1:4471';
const [W, H] = size.split('x').map(Number);
mkdirSync(outDir, { recursive: true });
const sha = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim() + (execSync('git status --porcelain --untracked-files=no -- src').toString().trim() ? '+dirty' : ''); } catch { return 'unknown'; } })();
const DIFF = process.env.DIFF ?? 'normal';
const REDUCE = process.env.REDUCE === '1';
const SKIP_AT = process.env.SKIP_AT ? Number(process.env.SKIP_AT) : null;
const manifest = { sha, quality: process.env.Q ?? 'high', difficulty: DIFF, reduceCameraMotion: REDUCE, skipAt: SKIP_AT, viewport: size, renderer: 'SwiftShader (software)', date: new Date().toISOString(), frames: [], errors: [] };
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME ?? '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const biome of list.split(',')) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => manifest.errors.push(`${biome}: ${String(e).slice(0, 300)}`));
  await page.addInitScript(([b, d, r, q]) => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.setItem('skifree-tld.settings.v1', JSON.stringify({ quality: q, biome: b, course: 'classic', courseLength: 'sprint', difficulty: d, showTutorial: false, seenPoleHint: true, reduceCameraMotion: r })); } }, [biome, DIFF, REDUCE, process.env.Q ?? 'high']);
  await page.goto(`${base}/?debug`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 900_000, polling: 1000 });
  await page.evaluate(async () => { const k = window.__skifree; await k.startRun(true); k.hold(true); k.autopilot('skilled'); k.advance(200); k.autopilot(null); });
  if (SKIP_AT !== null) {
    // a second viewing (skippable): watch the first one through, then come back to the cave
    await page.evaluate(() => { const k = window.__skifree; while (k.state().session.phase === 'caveCinematic') k.frames(1, 1 / 30); });
    await page.evaluate(async () => { const k = window.__skifree; await k.startRun(true); k.hold(true); k.autopilot('skilled'); k.advance(200); k.autopilot(null); });
    await page.evaluate((t) => { const k = window.__skifree; while (k.state().session.cinematicTime < t) k.framesLive(1, 1 / 30); }, SKIP_AT - 0.4);
  } else await page.evaluate(() => { const k = window.__skifree; while (k.state().session.phase === 'caveCinematic' && k.state().session.cinematicTime < 14.0) k.frames(1, 1 / 30); });
  for (let i = 0; i < (SKIP_AT !== null ? 8 : Number(process.env.N ?? 16)); i++) {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const s = await page.evaluate(() => window.__skifree.state().session);
    const name = `${biome}_${String(i).padStart(2, '0')}`;
    await page.screenshot({ path: `${outDir}/${name}.png`, timeout: 1_200_000 });
    manifest.frames.push({ name, biome, phase: s.phase, cinematicTime: s.cinematicTime, chaseTime: s.chaseTime, yetiPos: s.yetiPos, yetiRoot: s.yetiRoot, yetiAirborne: s.yetiAirborne, yetiVisible: s.yetiVisible, yetiMode: s.yetiMode, z: s.z, cam: await page.evaluate(() => window.__skifree.cameraPose()) });
    writeFileSync(`${outDir}/manifest.json`, JSON.stringify(manifest, null, 2));
    console.log(name, s.phase, s.cinematicTime.toFixed(2), s.chaseTime?.toFixed?.(2));
    if (SKIP_AT !== null && s.phase === 'caveCinematic' && s.cinematicTime >= SKIP_AT - 0.25) {
      await page.keyboard.press('Escape');
      await page.evaluate(() => window.__skifree.framesLive(1, 1 / 30));
      continue;
    }
    // STEP frames of 1/30 s (default 8: 0.27 s) — stopping early on the frame the Yeti lands, so the touchdown itself is captured
    await page.evaluate((step) => {
      const k = window.__skifree;
      for (let j = 0; j < step; j++) {
        const was = k.state().session.yetiAirborne;
        k.frames(1, 1 / 30);
        const s = k.state().session;
        if (s.phase === 'chase' && was && !s.yetiAirborne) break;
      }
    }, Number(process.env.STEP ?? 8));
  }
  await page.close();
}
await browser.close();
