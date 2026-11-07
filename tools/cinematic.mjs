// node tools/cinematic.mjs <baseUrl> <outDir> [course=classic:sprint] [WxH=1920x1080]
// Plays the cave cinematic deterministically (30 fps fixed steps), screenshots the required beats
// and records an independent per-frame grounding report (sole probes vs. the visible floor).
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const [base, outDir, course = 'classic:sprint', size = '1920x1080'] = process.argv.slice(2);
const [W, H] = size.split('x').map(Number);
mkdirSync(outDir, { recursive: true });
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: W, height: H } });
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await p.addInitScript(() => localStorage.setItem('skifree-tld.settings.v1', JSON.stringify({ quality: 'high' })));
await p.goto(base + '/?debug');
await p.waitForFunction(() => window.__ready === true, null, { timeout: 600000, polling: 1000 });
const [mode, len] = course.split(':');
await p.evaluate(([m, l]) => window.__skifree.setCourse(m, l), [mode, len]);
await p.evaluate(() => window.__skifree.startRun(true));
await p.evaluate(() => { window.__skifree.seenCave(false); window.__skifree.hold(true); window.__skifree.toCave(); });
// step until the cinematic starts
await p.evaluate(() => { for (let i = 0; i < 400 && window.__skifree.state().session.phase !== 'caveCinematic'; i++) window.__skifree.frames(1); });
const beats = [0.1, 3.8, 5.4, 6.6, 7.9, 9.5, 11.0, 14.6, 15.8];
const report = [];
for (const T of beats) {
  const rows = await p.evaluate((T) => {
    const out = [];
    for (let i = 0; i < 2000; i++) {
      const s = window.__skifree.state().session;
      if (s.phase !== 'caveCinematic' || s.cinematicTime >= T) break;
      window.__skifree.frames(1);
      out.push(window.__skifree.yetiGround());
    }
    return out;
  }, T);
  report.push(...rows);
  // render one frame at this time for the screenshot
  // the render loop keeps drawing while the simulation is held: wait for a couple of frames
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const g = await p.evaluate(() => window.__skifree.yetiGround());
  console.log(`t=${T}`, JSON.stringify(g));
  await p.screenshot({ path: `${outDir}/cine_t${String(T).replace('.', '_')}.png`, timeout: 600000 });
}
const vis = report.filter((r) => r && r.visible && r.mode !== 'leap');
const minL = Math.min(...vis.map((r) => r.left));
const minR = Math.min(...vis.map((r) => r.right));
const worst = vis.reduce((a, r) => (Math.min(r.left, r.right) < Math.min(a.left, a.right) ? r : a), vis[0]);
const minRoof = Math.min(...vis.map((r) => r.roofClearance));
const summary = { frames: report.length, visibleFrames: vis.length, minSoleClearanceLeft: minL, minSoleClearanceRight: minR, worstFrame: worst, minRoofClearanceAtRoot: minRoof, maxRootAboveFloor: Math.max(...vis.map((r) => r.rootAboveFloor)), minRootAboveFloor: Math.min(...vis.map((r) => r.rootAboveFloor)), errors };
console.log('SUMMARY', JSON.stringify(summary));
writeFileSync(`${outDir}/grounding_report.json`, JSON.stringify({ summary, frames: report }, null, 1));
await b.close();
