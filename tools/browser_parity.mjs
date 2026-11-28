// Round 4 (owner's decision A: "real browser-game verification and comparisons with the simulation").
// Plays a course in the production build with the game's own 'skilled' autopilot (fixed-step physics,
// the real Yeti, weather, hazards, snowballs; the cave cinematic skipped at its start) and records the
// outcome, time, minimum chase gap and the gap every 10 s. tests/sim/parity.measure.test.ts runs the
// same driver through the headless simulator for the comparison.
//   node tools/browser_parity.mjs <baseUrl> <out.json> <biome:len:diff,...>
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const [base, out, list] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: process.env.PW_CHROME ?? '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const rows = [];
for (const spec of list.split(',')) {
  const [biome, len, diff] = spec.split(':');
  const ctx = await b.newContext({ viewport: { width: 480, height: 270 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  await p.addInitScript((s) => localStorage.setItem('skifree-tld.settings.v1', JSON.stringify({ quality: 'low', biome: s.biome, course: 'classic', courseLength: s.len, difficulty: s.diff, showTutorial: false })), { biome, len, diff });
  await p.goto(base + '/?debug');
  await p.waitForFunction(() => window.__ready === true, null, { timeout: 900_000, polling: 1000 });
  await p.evaluate(() => window.__skifree.startRun(true));
  await p.evaluate(() => window.__skifree.autopilot('skilled'));
  const r = await p.evaluate(async () => {
    const s = window.__skifree;
    let minGap = Infinity, chaseT = 0, skips = 0;
    const gapAt = [];
    const st = () => s.state().session;
    for (let i = 0; i < 4000; i++) {
      s.advance(0.5);
      let x = st();
      if (x.phase === 'caveCinematic') { s.skipCave(); s.frames(2); skips++; x = st(); }
      if (x.yetiPhase === 'chase') { chaseT += 0.5; minGap = Math.min(minGap, x.yetiDistance); if (Math.abs(chaseT % 10) < 1e-6) gapAt.push(Math.round(x.yetiDistance * 10) / 10); }
      if (x.outcome && x.outcome !== 'none') return { outcome: x.outcome, phase: x.phase, z: x.z, time: x.time, minGap, gapAt, skips };
      if (i % 40 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    return { outcome: 'timeout', minGap, gapAt, skips };
  });
  const dbg = await p.evaluate(() => window.__skifree.state().session);
  rows.push({ biome, len, diff, ...r, finalZ: dbg?.z, errors });
  process.stdout.write(`${spec}: ${JSON.stringify(rows.at(-1))}\n`);
  await ctx.close();
}
writeFileSync(out, JSON.stringify(rows, null, 1));
await b.close();
