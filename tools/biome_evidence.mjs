// Biome evidence capture (production brief §9): drives the production build through the ?debug
// harness and saves the 11 required shots for one location, plus a Hard-mode snowball throw during
// ordinary chase gameplay and a few extra beats.
//
//   npm run build && npx vite preview --port 4471 &
//   node tools/biome_evidence.mjs <biome> <mode:length> <outDir> [WxH=1920x1080] [baseUrl=http://127.0.0.1:4471] [shots=all|menu,summit,…]
//   e.g. node tools/biome_evidence.mjs fjord classic:sprint docs/reviews/biomes/fjord/round-1
//
// Shots (file names): 01_menu, 02_summit, 03_mid_mountain, 04_signature_hazard(+04b), 05_material,
// 06_long_distance, 07_yeti_cave, 08_yeti_cinematic, 09_pursuit, 09b_hard_snowball, 10_finish,
// 11_victory_trophy, 11b_victory_celebration, 11c_victory_reveal. A manifest.json records the
// build SHA, viewport, course code, camera poses and the page errors seen (expected: none).
// Rendering is software (SwiftShader): a 1920×1080 frame takes 1–4 minutes.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const [biome = 'fjord', course = 'classic:sprint', outDir = `docs/reviews/biomes/${biome}/round-1`, size = '1920x1080', base = 'http://127.0.0.1:4471', only = 'all'] = process.argv.slice(2);
const [W, H] = size.split('x').map(Number);
const [mode, length] = course.split(':');
const want = (k) => only === 'all' || only.split(',').includes(k);
mkdirSync(outDir, { recursive: true });
const sha = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim() + (execSync('git status --porcelain --untracked-files=no').toString().trim() ? '+dirty' : '');
  } catch {
    return 'unknown';
  }
})();
const manifest = { biome, course, viewport: size, sha, date: new Date().toISOString(), shots: [], errors: [] };
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME ?? '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', (e) => manifest.errors.push(String(e).slice(0, 400)));
page.on('console', (m) => m.type() === 'error' && manifest.errors.push(m.text().slice(0, 400)));
await page.addInitScript((s) => {
  if (!sessionStorage.getItem('evidence')) {
    sessionStorage.setItem('evidence', '1');
    localStorage.setItem('skifree-tld.settings.v1', JSON.stringify(s));
  }
}, { quality: 'high', biome, course: mode, courseLength: length, difficulty: 'normal', rearView: true, showTutorial: false });
await page.goto(`${base}/?debug`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 900_000, polling: 1000 });

const ev = (fn, arg) => page.evaluate(fn, arg);
async function shot(name, note) {
  await ev(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/${name}.png`, timeout: 1_200_000 });
  const st = await ev(() => ({ cam: window.__skifree.cameraPose(), s: window.__skifree.state().session, course: window.__skifree.state().course }));
  manifest.shots.push({ name, note, camera: st.cam, phase: st.s?.phase ?? 'menu', z: st.s?.z ?? null, cinematicTime: st.s?.cinematicTime ?? null, course: st.course?.id });
  log('shot', name);
}
/** frames until a predicate on the session state holds (deterministic 1/30 s steps) */
async function framesUntil(pred, max = 900) {
  return ev(
    ([src, max]) => {
      const f = new Function('s', `return (${src})(s);`);
      for (let i = 0; i < max; i++) {
        const s = window.__skifree.state().session;
        if (f(s)) return { ok: true, i, s };
        window.__skifree.frames(1);
      }
      return { ok: false, s: window.__skifree.state().session };
    },
    [pred.toString(), max],
  );
}
const freeCam = (pos, look, fov = 50) => ev(([p, l, f]) => window.__skifree.freeCam(p, l, f), [pos, look, fov]);
/** never put a camera under the snow: keep it ≥ 2.5 m above the terrain around it */
await page.evaluate(() => {
  const api = window.__skifree;
  const raw = api.freeCam;
  api.freeCam = (p, l, f) => {
    const w = api.world?.();
    if (p && w) {
      const m = w.mountain;
      let g = -Infinity;
      for (const [dx, dz] of [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]]) g = Math.max(g, m.heightAt(p[0] + dx, p[2] + dz));
      p = [p[0], Math.max(p[1], g + 2.5), p[2]];
    }
    return raw(p, l, f);
  };
});
const settle = (ms = 2500) => page.waitForTimeout(ms);
/** terrain/vegetation around z built at full detail (teleport flushes them) */
const goTo = (z, speed = 0) => ev(([z, v]) => window.__skifree.teleport(z, v), [z, speed]);
const geo = () =>
  ev(() => {
    const m = window.__skifree.world().mountain;
    const L = Number.isFinite(m.finishZ) ? m.finishZ : 10000;
    const enc = m.profile.encounters(0, L)[0];
    return { L, finite: Number.isFinite(m.finishZ), caveZ: enc.caveZ, trigger: enc.triggerZ, coast: !!m.coast };
  });

// 1) menu with the Location row focused
if (want('menu')) {
  await ev(() => window.__skifree.menuFocus('Location') || window.__skifree.menuFocus('Start'));
  await settle(3000);
  await shot('01_menu', 'Main menu, Location row focused; the location preview runs behind the menu');
}
await ev(() => window.__skifree.startRun(true));
await settle(1500);
const G = await geo();
log('course', JSON.stringify(G));
const P = (fnSrc) => ev(new Function(`const w = window.__skifree.world(); const m = w.mountain; const c = m.coast; return (${fnSrc})(w, m, c);`));

// 2) summit: the start gate, the run ahead and the view beyond
if (want('summit')) {
  await ev(() => { window.__skifree.hold(true); window.__skifree.hud(false); });
  // high above the start gate, looking down the run; on a coast, over the rim into the fjord
  await P(`(w, m, c) => { const x = m.routeX(0), y = m.heightAt(x, 0); const xr = c ? c.rimX(200) : x - 160; window.__skifree.freeCam([x + 40, y + 62, -70], [xr - 260, y - 330, 1050], 56); }`);
  await settle(3500);
  await shot('02_summit', 'Summit: start gate and the descent ahead');
}

// past the first cave without its cinematic (that has its own shots below)
await ev(() => { window.__skifree.hold(false); window.__skifree.freeCam(null); window.__skifree.toChase(); window.__skifree.autopilot(null); });

// 3) mid-mountain
if (want('mid')) {
  const z = Math.round(G.finite ? Math.min(G.L * 0.5, G.L - 900) : 3000);
  await goTo(z, 0);
  await ev(() => { window.__skifree.hold(true); window.__skifree.hud(false); });
  await P(`(w, m) => { const z = ${z}; const x = m.routeX(z), y = m.heightAt(x, z); window.__skifree.freeCam([x + 60, m.heightAt(x + 60, z - 150) + 30, z - 150], [x - 170, y - 80, z + 240], 52); }`);
  await settle(3500);
  await shot('03_mid_mountain', `Mid-mountain at z=${z}`);
}

// 4) signature hazard (telegraph → active), else a jump
if (want('hazard')) {
  await ev(() => { window.__skifree.hold(false); window.__skifree.freeCam(null); });
  const kinds = await ev(() => [...new Set(window.__skifree.hazards().map((h) => h.kind))]);
  const all = await P(`(w, m) => { const L = ${G.L}; const out = []; for (let z = 400; z < L - 500; z += 200) { w.environment.stream(z); } return window.__skifree.hazards(); }`);
  const sig = all.find((h) => h.kind === 'sea-gust') ?? all[0];
  if (sig) {
    await goTo(sig.z - 160, 0);
    await ev(() => window.__skifree.hold(true));
    const r = await framesUntil(`(s) => (window.__skifree.hazards('${sig.kind}').find((h) => h.id === ${sig.id}) || {}).phase === 'active'`, 600);
    await framesUntil(`(s) => false`, 18);
    log('hazard', sig.kind, JSON.stringify(r.ok));
    await ev(() => window.__skifree.hud(false));
    await P(`(w, m) => { const h = { x: ${sig.x}, y: ${sig.y}, z: ${sig.z} }; const cx = h.x + 16, cz = h.z - 30; window.__skifree.freeCam([cx, m.heightAt(cx, cz) + 3.2, cz], [h.x - 8, h.y + 3.5, h.z + 4], 50); }`);
    await settle(3000);
    await shot('04_signature_hazard', `${sig.kind} (id ${sig.id}) in its active phase; kinds near: ${kinds.join(',')}`);
    const rock = all.find((h) => h.kind === 'scoured-rock');
    if (rock) {
      await ev(() => window.__skifree.freeCam(null));
      await goTo(rock.z - 120, 0);
      await ev(() => window.__skifree.hold(true));
      await P(`(w, m) => { const cx = ${rock.x} + 14, cz = ${rock.z} - 26; window.__skifree.freeCam([cx, m.heightAt(cx, cz) + 7, cz], [${rock.x}, ${rock.y}, ${rock.z} + 2], 50); }`);
      await settle(3000);
      await shot('04b_hazard_rock', 'scoured-rock: exposed rock beside the racing line');
    }
  } else {
    const k = await P(`(w, m) => { const ks = m.profile.kickersNear(500, ${G.L} - 400, []); const k = ks[Math.floor(ks.length / 2)]; return { z: k.z, x: m.centerX(k.z) + k.d, y: m.heightAt(m.centerX(k.z) + k.d, k.z) }; }`);
    await goTo(k.z - 150, 0);
    await ev(() => { window.__skifree.hold(true); window.__skifree.hud(false); });
    await freeCam([k.x + 18, k.y + 6, k.z - 30], [k.x, k.y + 1, k.z + 6], 48);
    await settle(3000);
    await shot('04_signature_hazard', 'no hazard kinds in this location: a kicker (the signature feature)');
  }
}

// 5) terrain material close-up (the cliff rim / cornice on a coast; the piste edge otherwise)
if (want('material')) {
  await ev(() => { window.__skifree.hold(false); window.__skifree.freeCam(null); });
  const z = Math.round(G.finite ? G.L * 0.36 : 2400);
  await goTo(z, 0);
  await ev(() => { window.__skifree.hold(true); window.__skifree.hud(false); });
  await P(`(w, m, c) => { const z = ${z}; const xr = c ? c.rimX(z) : m.centerX(z) - m.halfWidth(z) - 20; const y = m.heightAt(xr + 6, z); window.__skifree.freeCam([xr + 7, y + 3.0, z - 16], [xr - 26, y - 34, z + 26], 60); }`);
  await settle(3500);
  await shot('05_material', `Terrain material close-up at the rim, z=${z}`);
}

// 6) long-distance composition
if (want('long')) {
  const z = Math.round(G.finite ? G.L * 0.3 : 2000);
  await ev(() => { window.__skifree.hold(false); window.__skifree.freeCam(null); });
  await goTo(z, 0);
  await ev(() => { window.__skifree.hold(true); window.__skifree.hud(false); });
  await P(`(w, m, c) => { const z = ${z}; const lv = c ? c.seaLevelAt(z) : m.heightAt(m.routeX(z), z) - 300; const x = m.routeX(z); window.__skifree.freeCam([x - 1500, lv + 340, z - 1300], [x + 150, m.heightAt(x, z + 900) - 60, z + 1300], 55); }`);
  await settle(4000);
  await shot('06_long_distance', 'Long-distance composition across the valley / fjord');
}

// 7) the Yeti cave (before the cinematic) and 8) the cinematic
if (want('cave') || want('cinematic') || want('pursuit')) {
  await ev(() => { window.__skifree.freeCam(null); window.__skifree.hold(false); window.__skifree.toMenu(); });
  await settle(1500);
  await ev(() => window.__skifree.startRun(true));
  await settle(1500);
  await ev(() => { window.__skifree.seenCave(false); });
  if (want('cave')) {
    await goTo(G.trigger - 75, 0);
    await ev(() => { window.__skifree.hold(true); window.__skifree.hud(false); });
    await P(`(w) => { const c = w.cave; const o = c.outward; const p = [c.mouth.x + o.x * 26 + o.z * 9, c.mouth.y + 7, c.mouth.z + o.z * 26 - o.x * 9 - 8]; window.__skifree.freeCam(p, [c.mouth.x, c.mouth.y + 3, c.mouth.z], 50); }`);
    await settle(3500);
    await shot('07_yeti_cave', 'The Yeti cave with the location dressing, before the encounter');
    await ev(() => { window.__skifree.freeCam(null); window.__skifree.hud(true); });
  }
  await ev(() => { window.__skifree.hold(true); window.__skifree.toCave(); });
  await framesUntil(`(s) => s.phase === 'caveCinematic'`, 600);
  if (want('cinematic')) {
    await framesUntil(`(s) => s.cinematicTime >= 9.5`, 600);
    await settle(1500);
    await shot('08_yeti_cinematic', 'Cave cinematic, t≈9.5 s (emergence)');
    await framesUntil(`(s) => s.cinematicTime >= 14.6`, 400);
    await settle(1500);
    await shot('08b_yeti_cinematic', 'Cave cinematic, t≈14.6 s');
  }
  // 9) pursuit with the rear view
  if (want('pursuit')) {
    await framesUntil(`(s) => s.phase === 'chase'`, 900);
    await ev(() => { window.__skifree.autopilot('skilled'); window.__skifree.hud(true); });
    await framesUntil(`(s) => false`, 150);
    await ev(() => window.__skifree.placeYeti(18));
    await framesUntil(`(s) => false`, 40);
    await settle(1500);
    await shot('09_pursuit', 'Ordinary chase gameplay, normal follow camera, rear view showing the Yeti');
  }
}

// 9b) Hard: a snowball throw during ordinary chase gameplay
if (want('snowball')) {
  await ev(() => { window.__skifree.hold(false); window.__skifree.toMenu(); });
  await settle(1500);
  await ev(([m, l, b]) => window.__skifree.setCourse(m, l, { difficulty: 'hard', biome: b }), [mode, length, biome]);
  await ev(() => window.__skifree.startRun(true));
  await settle(3000);
  await ev(() => { window.__skifree.hold(true); window.__skifree.toChase(); window.__skifree.autopilot('skilled'); });
  await framesUntil(`(s) => s.phase === 'chase'`, 600);
  await framesUntil(`(s) => false`, 60);
  await ev(() => window.__skifree.placeYeti(24));
  const r = await framesUntil(`(s) => s.yetiThrowT !== null && s.yetiThrowT > 0.55 && s.yetiDistance < 40`, 1500);
  log('throw', JSON.stringify(r.ok), r.s?.yetiThrowT);
  await settle(1500);
  await shot('09b_hard_snowball', 'Hard: the Yeti winds up / releases a snowball during ordinary chase gameplay (rear view + landing marker)');
  await framesUntil(`(s) => false`, 12);
  await settle(800);
  await shot('09c_hard_snowball_marker', 'Hard: snowball in flight, landing marker on the snow');
  await ev(() => { window.__skifree.hold(false); window.__skifree.toMenu(); });
  await settle(1500);
  await ev(([m, l, b]) => window.__skifree.setCourse(m, l, { difficulty: 'normal', biome: b }), [mode, length, biome]);
  await ev(() => window.__skifree.startRun(true));
  await settle(3000);
}

// 10) the finish environment and 11) the victory
if (G.finite && (want('finish') || want('victory'))) {
  await ev(() => { window.__skifree.hold(false); window.__skifree.freeCam(null); window.__skifree.toChase(); window.__skifree.autopilot(null); });
  if (want('finish')) {
    await goTo(G.L - 260, 0);
    await ev(() => { window.__skifree.hold(true); window.__skifree.hud(false); });
    await P(`(w, m) => { const L = m.finishZ; const x = m.routeX(L); const y = m.heightAt(x, L); window.__skifree.freeCam([x - 46, y + 30, L - 70], [x + 16, y - 4, L + 150], 56); }`);
    await settle(4000);
    await shot('10_finish', 'Finish environment from above the run-out');
    await P(`(w, m) => { const L = m.finishZ; const x = m.routeX(L); const y = m.heightAt(x, L); window.__skifree.freeCam([x + 8, y + 3.2, L + 18], [x - 6, y + 2, L + 190], 58); }`);
    await settle(3000);
    await shot('10b_finish_ground', 'Finish environment at eye level');
  }
  if (want('victory')) {
    await ev(() => { window.__skifree.freeCam(null); window.__skifree.hud(true); window.__skifree.hold(true); });
    await goTo(G.L - 50, 22);
    await ev(() => { window.__skifree.autopilot('skilled'); window.__skifree.placeYeti(45); });
    await framesUntil(`(s) => s.phase === 'victory' || s.outcome === 'victory'`, 600);
    await framesUntil(`(s) => s.cinematicTime >= 9.6`, 600);
    await settle(1500);
    await shot('11_victory_trophy', 'Victory: trophy hand-off');
    await framesUntil(`(s) => s.cinematicTime >= 13.4`, 300);
    await settle(1500);
    await shot('11b_victory_celebration', 'Victory: the celebration beat');
    await framesUntil(`(s) => s.cinematicTime >= 19.5`, 400);
    await settle(1500);
    await shot('11c_victory_reveal', 'Victory: the closing reveal');
  }
}

manifest.seconds = Math.round((Date.now() - t0) / 1000);
writeFileSync(`${outDir}/manifest${only === 'all' ? '' : '-' + only.replace(/,/g, '_')}.json`, JSON.stringify(manifest, null, 2));
log('done', manifest.shots.length, 'shots,', manifest.errors.length, 'errors');
await browser.close();
