// W-065 evidence: the gameplay camera on Whiteout's rim stretches (the racing line 14 m off the ridge
// rim). For each course, finds the stretches (where the rim is within 16 m of the line), skis into the
// middle of each one on the racing line with the autopilot, and captures the follow camera with the HUD,
// in a clear window and in a storm. Production build, SwiftShader. manifest.json records the commit,
// the camera and the rim distance.
//   BASE=http://127.0.0.1:4472 node tools/rim_view.mjs <outDir> [WxH=960x540] [courses=classic:sprint,classic:standard]
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { servedBuild } from './lib/build_info.mjs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [outDir = join(tmpdir(), 'rim'), size = '960x540', list = 'classic:sprint,classic:standard'] = process.argv.slice(2);
const base = process.env.BASE ?? 'http://127.0.0.1:4471';
const [W, H] = size.split('x').map(Number);
mkdirSync(outDir, { recursive: true });
const build = await servedBuild(base);
const sha = build.sha;
const manifest = { sha, build, viewport: size, renderer: 'SwiftShader (software)', quality: process.env.Q ?? 'high', date: new Date().toISOString(), frames: [], errors: [] };
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
  const stretches = process.env.ZAT ? process.env.ZAT.split(',').map((z) => [Number(z) - 40, Number(z) + 40]) : await page.evaluate(() => {
    const m = window.__skifree.world().mountain;
    const out = [];
    let cur = null;
    for (let z = 100; z < Math.min(m.finishZ - 150, 10000); z += 5) {
      const d = m.ridgeRimX(z) - m.routeX(z);
      if (d <= 16) { if (!cur) cur = [z, z]; cur[1] = z; } else if (cur) { out.push(cur); cur = null; }
    }
    if (cur) out.push(cur);
    if (out.length) return out;
    // (W-065 diagnosis, no rim stretches) the places where the rim comes nearest the line: local
    // minima of the distance, at least 300 m apart, nearest first
    const mins = [];
    for (let z = 300; z < Math.min(m.finishZ - 200, 10000); z += 10) {
      const d = (q) => m.ridgeRimX(q) - m.routeX(q);
      if (d(z) <= d(z - 10) && d(z) <= d(z + 10)) mins.push([d(z), z]);
    }
    mins.sort((a, b) => a[0] - b[0]);
    const pick = [];
    for (const [, z] of mins) if (pick.every((q) => Math.abs(q - z) > 300)) pick.push(z);
    return pick.slice(0, 4).map((z) => [z - 40, z + 40]);
  });
  manifest.frames.push({ course: item, stretches });
  for (const [i, [z0, z1]] of stretches.slice(0, Number(process.env.MAX ?? 2)).entries()) {
    for (const wx of (process.env.WX ?? 'clear,storm').split(',')) {
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
          // (the clock after the teleport: a teleport restarts the run's weather from its own clock)
          k.teleport(z - 50, 18, m.routeX(z - 50), Math.atan2(m.routeX(z - 49) - m.routeX(z - 50), 1));
          k.setTime(tt - 3);
          k.settleWeather();
          k.autopilot('skilled');
          if (k.placeYeti) k.placeYeti(260);
          k.frames(90, 1 / 30);
          if (k.placeYeti) k.placeYeti(260);
        };
        go();
        // a cave trigger on the way: let its cinematic play (the first viewing cannot be skipped), then
        // come back — the frame is then taken in the chase, as a player skis it
        if (k.state().session.phase === 'caveCinematic') {
          for (let i = 0; i < 900 && k.state().session.phase === 'caveCinematic'; i++) k.frames(1, 1 / 30);
          go();
        }
        k.autopilot(null);
        // (round 4: the "white puff over the skier" in every rim capture was this tool's, not the game's —
        // 90 scripted frames pile the run's spray into one cloud that the live game never shows; clear it
        // and let a second of ordinary spray form before the frame)
        k.world().particles?.clear?.();
        k.autopilot('skilled');
        k.frames(20, 1 / 30);
        k.autopilot(null);
      }, [zc, t]);
      if (process.env.PROBE) {
        // (debugging a capture) what transparent point/sprite layers lie near the skier, optionally hidden
        const found = await page.evaluate((hide) => {
          const k = window.__skifree;
          const sc = k.world().scene;
          const s = k.state().session;
          const out = [];
          sc.traverse((o) => {
            if (!(o.isPoints || o.isSprite)) return;
            const pos = o.geometry?.getAttribute?.('position');
            let near = 0;
            if (pos) for (let j = 0; j < pos.count; j++) { const dx = pos.getX(j) + o.position.x, dz = pos.getZ(j) + o.position.z; if (Math.hypot(dx - s.x, dz - s.z) < 25) near++; }
            const tag = (o.name || o.parent?.name || o.type) + '|' + (o.material?.type ?? '') + '|' + (o.material?.size ?? '') ;
            const extra = [];
            const sz = o.geometry?.getAttribute?.('aSize'), al = o.geometry?.getAttribute?.('aAlpha'), cl = o.geometry?.getAttribute?.('aCol');
            if (pos && sz && al) for (let j = 0; j < pos.count; j++) { const dx = pos.getX(j) + o.position.x, dz = pos.getZ(j) + o.position.z, dy = pos.getY(j) + o.position.y; if (al.getX(j) > 0.01 && Math.hypot(dx - s.x, dz - s.z) < 25) extra.push([+(dx - s.x).toFixed(1), +(dy - s.y).toFixed(1), +(dz - s.z).toFixed(1), +sz.getX(j).toFixed(2), +al.getX(j).toFixed(2), cl ? +cl.getX(j).toFixed(2) : null]); }
            out.push({ tag, near, n: pos?.count ?? 0, parts: extra.slice(0, 50) });
            if (hide && (hide === 'all' || tag.includes(hide))) o.visible = false;
          });
          return out.filter((f) => f.near > 0);
        }, process.env.PROBE === '1' ? '' : process.env.PROBE);
        process.stdout.write(`probe ${JSON.stringify(found)}\n`);
      }
      const name = `${item.replace(/:/g, '_')}_${i}_${wx}`;
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      await page.screenshot({ path: `${outDir}/${name}.png`, timeout: 1_200_000 });
      const st = await page.evaluate(() => {
        const k = window.__skifree;
        const s = k.state().session;
        const m = k.world().mountain;
        // where the rim 60 m ahead lands on screen (NDC; |x|,|y| < 1 = in view)
        const za = s.z + 60;
        const P = { x: m.ridgeRimX(za), y: m.heightAt(m.ridgeRimX(za), za), z: za };
        const c = k.cameraPose();
        return { z: s.z, x: s.x, speed: s.speed, rimFromSkier: m.ridgeRimX(s.z) - s.x, rimFromLine: m.ridgeRimX(s.z) - m.routeX(s.z), rimAheadNdc: k.projectToScreen ? k.projectToScreen(P) : null, cam: c, front: k.front(k.state().session.time ?? 0) };
      });
      manifest.frames.push({ name, stretch: [z0, z1], weather: wx, ...st });
      writeFileSync(`${outDir}/manifest.json`, JSON.stringify(manifest, null, 2));
      console.log(name, JSON.stringify({ z: st.z, rimFromSkier: st.rimFromSkier }));
    }
  }
  await page.close();
}
await browser.close();
