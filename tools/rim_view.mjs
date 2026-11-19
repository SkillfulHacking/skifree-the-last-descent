// W-065 evidence: the gameplay camera on Whiteout's rim stretches (the racing line 14 m off the ridge
// rim). For each course, finds the stretches (where the rim is within 16 m of the line), skis into the
// middle of each one on the racing line with the autopilot, and captures the follow camera with the HUD,
// in a clear window and in a storm. Production build, SwiftShader. manifest.json records the commit,
// the camera and the rim distance.
//   BASE=http://127.0.0.1:4472 node tools/rim_view.mjs <outDir> [WxH=960x540] [courses=classic:sprint,classic:standard]
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const [outDir = '/tmp/rim', size = '960x540', list = 'classic:sprint,classic:standard'] = process.argv.slice(2);
const base = process.env.BASE ?? 'http://127.0.0.1:4471';
const [W, H] = size.split('x').map(Number);
mkdirSync(outDir, { recursive: true });
const sha = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim() + (execSync('git status --porcelain --untracked-files=no -- src').toString().trim() ? '+dirty' : ''); } catch { return 'unknown'; } })();
const manifest = { sha, viewport: size, renderer: 'SwiftShader (software)', quality: process.env.Q ?? 'high', date: new Date().toISOString(), frames: [], errors: [] };
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME ?? '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const item of list.split(',')) {
  const [mode, len, key] = item.split(':');
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => manifest.errors.push(`${item}: ${String(e).slice(0, 300)}`));
  await page.addInitScript(([m, l, k, q]) => {
    if (!sessionStorage.getItem('s')) {
      sessionStorage.setItem('s', '1');
      localStorage.setItem('skifree-tld.settings.v1', JSON.stringify({ quality: q, biome: 'whiteout', course: m, courseLength: l, ...(k ? { customText: k } : {}), difficulty: 'normal', showTutorial: false, seenPoleHint: true }));
    }
  }, [mode, len, key ?? null, process.env.Q ?? 'high']);
  await page.goto(`${base}/?debug`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 900_000, polling: 1000 });
  await page.evaluate(async () => { const k = window.__skifree; await k.startRun(true); k.hold(true); });
  const stretches = await page.evaluate(() => {
    const m = window.__skifree.world().mountain;
    const out = [];
    let cur = null;
    for (let z = 100; z < Math.min(m.finishZ - 150, 10000); z += 5) {
      const d = m.ridgeRimX(z) - m.routeX(z);
      if (d <= 16) { if (!cur) cur = [z, z]; cur[1] = z; } else if (cur) { out.push(cur); cur = null; }
    }
    if (cur) out.push(cur);
    return out;
  });
  manifest.frames.push({ course: item, stretches });
  for (const [i, [z0, z1]] of stretches.slice(0, Number(process.env.MAX ?? 2)).entries()) {
    for (const wx of ['clear', 'storm']) {
      const zc = (z0 + z1) / 2;
      // a clear window or a storm at the time we arrive (the weather runs on the physics clock)
      const t = await page.evaluate((w) => {
        const k = window.__skifree;
        for (let t = 30; t < 900; t += 1) {
          const f = k.front(t);
          if (!f) return 30;
          if (w === 'clear' ? f.phase === 'clear' && f.left > 8 : f.phase === 'storm' && f.s > 0.85 && f.left > 8) return t;
        }
        return 30;
      }, wx);
      await page.evaluate(([z, tt]) => {
        const k = window.__skifree;
        const m = k.world().mountain;
        const go = () => {
          k.setTime(tt - 3);
          k.teleport(z - 50, 18, m.routeX(z - 50), Math.atan2(m.routeX(z - 49) - m.routeX(z - 50), 1));
          k.settleWeather();
          k.autopilot('skilled');
          k.frames(90, 1 / 30);
        };
        go();
        // a cave trigger on the way: let its cinematic play (the first viewing cannot be skipped), then
        // come back — the frame is then taken in the chase, as a player skis it
        if (k.state().session.phase === 'caveCinematic') {
          for (let i = 0; i < 900 && k.state().session.phase === 'caveCinematic'; i++) k.frames(1, 1 / 30);
          go();
        }
        k.autopilot(null);
      }, [zc, t]);
      const name = `${item.replace(/:/g, '_')}_${i}_${wx}`;
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      await page.screenshot({ path: `${outDir}/${name}.png`, timeout: 1_200_000 });
      const st = await page.evaluate(() => {
        const k = window.__skifree;
        const s = k.state().session;
        const m = k.world().mountain;
        return { z: s.z, x: s.x, speed: s.speed, rimFromSkier: m.ridgeRimX(s.z) - s.x, rimFromLine: m.ridgeRimX(s.z) - m.routeX(s.z), cam: k.cameraPose(), front: k.front(s.time ?? 0) };
      });
      manifest.frames.push({ name, stretch: [z0, z1], weather: wx, ...st });
      writeFileSync(`${outDir}/manifest.json`, JSON.stringify(manifest, null, 2));
      console.log(name, JSON.stringify({ z: st.z, rimFromSkier: st.rimFromSkier }));
    }
  }
  await page.close();
}
await browser.close();
