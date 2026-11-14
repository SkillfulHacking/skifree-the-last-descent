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
/**
 * frames until a predicate on the session state holds (deterministic 1/30 s steps). With
 * `finishTick`, the finish environment is animated on the same clock (the held harness does not
 * run App's per-frame finish update, so guests, the plunge, boats and the trophy presenter would
 * otherwise stand still in the victory captures).
 */
async function framesUntil(pred, max = 900, finishTick = false) {
  return ev(
    ([src, max, tick]) => {
      const f = new Function('s', `return (${src})(s);`);
      const w = window.__skifree.world?.();
      const fin = tick && w ? w.resort : null;
      window.__evT = window.__evT ?? 0;
      for (let i = 0; i < max; i++) {
        const s = window.__skifree.state().session;
        if (f(s)) return { ok: true, i, s };
        window.__skifree.frames(1);
        if (fin) {
          window.__evT += 1 / 30;
          fin.update(1 / 30, window.__evT, { cheer: 1, lookAt: null, welcome: 1 });
        }
      }
      return { ok: false, s: window.__skifree.state().session };
    },
    [pred.toString(), max, finishTick],
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
/** let the frame after a camera move run (it re-LODs the cliff segments for the new viewpoint), then
 *  finish the queued scenery builds at once — on a GPU they complete within ~1 s of streaming, but
 *  SwiftShader's 5–7 s frames would otherwise leave the old LOD on screen (round 8: the "pinstripe"
 *  in 06 was the skier-side finest LOD seen from 1.3 km) */
const settle = async (ms = 2500) => {
  await ev(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  // (the debug free camera is applied after the world update, so the scenery LODs for the chase
  // camera near the skier: hand it the real viewpoint first — gameplay and cinematic cameras are set
  // before the update and need none of this)
  await ev(() => {
    const w = window.__skifree.world?.();
    if (!w?.scenery) return;
    w.scenery.update(0, 0, { focus: window.__skifree.camera.position, camPos: window.__skifree.camera.position, origin: w.origin });
    w.scenery.flush?.();
  });
  // and let the terrain finish streaming for the new viewpoint (a GPU frame loop gets there in well
  // under a second; SwiftShader frames take seconds each) — terrain detail at a cave notch included
  await ev(() => { const s = window.__skifree.state().session; const t = window.__skifree.world?.()?.terrain; if (s && t?.flushAround) t.flushAround(s.x, s.z); });
  await page.waitForTimeout(ms);
};
/** terrain/vegetation around z built at full detail (teleport flushes them) */
const goTo = (z, speed = 0) => ev(([z, v]) => window.__skifree.teleport(z, v), [z, speed]);
const geo = () =>
  ev(() => {
    const m = window.__skifree.world().mountain;
    const L = Number.isFinite(m.finishZ) ? m.finishZ : 10000;
    const enc = m.profile.encounters(0, L)[0];
    return { L, finite: Number.isFinite(m.finishZ), caveZ: enc.caveZ, trigger: enc.triggerZ, coast: !!m.coast };
  });

// diagnostic: which object draws given pixels of the long-distance frame (PROBE="x,y;x,y" in 0..1)
async function probe(tag) {
  const pts = (process.env.PROBE ?? '0.5,0.5').split(';').map((s) => s.split(',').map(Number));
  const res = await ev((pts) => {
    const api = window.__skifree;
    const cam = api.camera;
    let scene = cam; while (scene.parent) scene = scene.parent;
    if (scene === cam) scene = api.world?.()?.scene ?? scene;
    const THREE_ = cam.constructor;
    const out = [];
    const rc = new (window.__THREE?.Raycaster ?? Object)();
    if (!rc.setFromCamera) return 'no raycaster';
    for (const [x, y] of pts) {
      rc.setFromCamera({ x: x * 2 - 1, y: 1 - y * 2 }, cam);
      const vis = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; }; const hits = rc.intersectObject(scene, true).filter((h) => vis(h.object)).slice(0, 3);
      out.push({ x, y, hits: hits.map((h) => { const chain = []; let o = h.object; while (o && chain.length < 5) { chain.push(o.name || o.type); o = o.parent; } return { d: Math.round(h.distance), chain: chain.join('<'), mat: h.object.material?.name || h.object.material?.type, ud: JSON.stringify(h.object.material?.userData ?? {}).slice(0, 80), key: (h.object.material?.customProgramCacheKey?.() ?? '').slice(0, 90), geo: h.object.geometry?.type + ':' + (h.object.geometry?.getAttribute?.('position')?.count ?? 0), inst: !!h.object.isInstancedMesh, p: h.point.toArray().map(Math.round) }; }) });
    }
    return out;
  }, pts);
  const segs = await ev(() => { const c = window.__skifree.world()?.scenery?.cliffs; if (!c) return null; const cam = window.__skifree.camera.position; return { cam: cam.toArray().map(Math.round), focus: c ? null : null, jobs: c.jobs.length, segs: [...c.segs].map(([i, s]) => ({ i, lod: s.lod, v: s.mesh.geometry.getAttribute('position').count, name: s.mesh.name })) }; });
  writeFileSync(`${outDir}/probe-${tag}.json`, JSON.stringify({ res, segs }, null, 1));
}


// 1) menu with the Location row focused
if (want('menu')) {
  await ev(() => window.__skifree.menuFocus('Location') || window.__skifree.menuFocus('Start'));
  await settle(3000);
  await shot('01_menu', 'Main menu, Location row focused; the location preview runs behind the menu');
}
if (want('menuprobe')) await probe('menu');
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
      // round 3 (A N7): aim at the scoured-rock view actually streamed near here (the merged build
      // moved the hazards; the round-2 camera kept the stale pose), from above and behind, so the
      // patch, its ribs and the line beside it are in frame
      // the views actually streamed (scene objects named 'scoured-rock'): aim at the nearest one
      const live = await P(`(w) => { const out = []; w.scene.traverse((o) => { if (o.name === 'scoured-rock' && o.visible) { const sk = o.children[0]; if (!sk || !sk.geometry) return; sk.geometry.computeBoundingSphere(); const c = sk.geometry.boundingSphere.center.clone().applyMatrix4(sk.matrixWorld); out.push({ x: c.x, z: c.z, r: sk.geometry.boundingSphere.radius }); } }); out.sort((a, b) => Math.abs(a.z - ${rock.z}) - Math.abs(b.z - ${rock.z})); return out[0] ?? null; }`);
      const R = live ? { ...live, id: rock.id } : rock;
      await P(`(w, m) => { const hx = ${R.x}, hz = ${R.z}; const hy = m.heightAt(hx, hz); const cx = hx + 12, cz = hz - 24; window.__skifree.freeCam([cx, Math.max(m.heightAt(cx, cz), hy) + 9, cz], [hx, hy + 0.5, hz + 3], 48); }`);
      await settle(3000);
      await shot('04b_hazard_rock', `scoured-rock (streamed view at x ${Math.round(R.x)}, z ${Math.round(R.z)}): exposed rock beside the racing line`);
      if (biome === 'fjord') {
        await P(`(w, m) => { const hx = ${R.x}, hz = ${R.z}; const hy = m.heightAt(hx, hz); const cx = hx + 40, cz = hz - 95; window.__skifree.freeCam([cx, Math.max(m.heightAt(cx, cz), hy) + 22, cz], [hx, hy, hz + 10], 46); }`);
        await settle(3000);
        await shot('04c_hazard_rock_mid', 'scoured-rock from ~100 m (mid-distance readability)');
      }
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
  await P(`(w, m, c) => { const z = ${z}; const xr = c ? c.rimX(z) : m.centerX(z) - m.halfWidth(z) - 20; const y = m.heightAt(xr + 6, z); window.__skifree.freeCam([xr + 11, y + 1.7, z - 14], [xr - 4, y - 4, z + 26], 62); }`);
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

if (want('probe')) await probe('long');

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
    if (want('cprobe')) await probe('cave');
    if (biome === 'fjord') {
      // the sea cave from inside its mouth: the basalt portal framing the run and the fjord beyond
      await P(`(w) => { const c = w.cave; const o = c.outward; const i = Math.min(c.exitPath.length - 1, Math.round((14 - 4.5) / 0.75)); const q = c.exitPath[i]; window.__skifree.freeCam([q.x, q.y + 1.6, q.z], [c.mouth.x + o.x * 60, c.mouth.y - 14, c.mouth.z + o.z * 60], 62); }`);
      await settle(3000);
      await shot('07b_yeti_cave_outlook', 'Fjord: the sea cave from inside its mouth, looking out past the basalt portal (the mouth faces inland, toward the piste)');
    }
    await ev(() => { window.__skifree.freeCam(null); window.__skifree.hud(true); });
  }
  await ev(() => { window.__skifree.hold(true); window.__skifree.toCave(); });
  await framesUntil(`(s) => s.phase === 'caveCinematic'`, 600);
  if (want('cinematic')) {
    if (biome === 'fjord') {
      // the Fjord cave beats: gulls scattering off the basalt portal on the rumble
      await framesUntil(`(s) => s.cinematicTime >= 2.95`, 600);
      await settle(1500);
      await shot('08c_yeti_cinematic_gulls', 'Cave cinematic, t≈2.95 s (Fjord: gulls burst off the basalt portal on the rumble)');
    }
    await framesUntil(`(s) => s.cinematicTime >= 9.5`, 600);
    await settle(1500);
    await shot('08_yeti_cinematic', biome === 'fjord' ? 'Cave cinematic, t≈9.5 s (Fjord: the emergence seen from inside the sea cave, the Yeti against the fjord)' : 'Cave cinematic, t≈9.5 s (emergence)');
    if (biome === 'fjord') {
      await framesUntil(`(s) => s.cinematicTime >= 11.65`, 600);
      await settle(1500);
      await shot('08d_yeti_cinematic_roar', 'Cave cinematic, t≈11.65 s (Fjord: the roar blows spray and sea smoke out of the mouth; the lintel icicles drop and shatter)');
    }
    await framesUntil(biome === "fjord" ? `(s) => s.cinematicTime >= 15.0` : `(s) => s.cinematicTime >= 14.6`, 400);
    await settle(1500);
    await shot('08b_yeti_cinematic', biome === 'fjord' ? 'Cave cinematic, t≈15.0 s (Fjord: the leap from the ledge, down onto the skier)' : 'Cave cinematic, t≈14.6 s');
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

// 9d) Fjord: the ordinary chase camera where the run passes closest to the cliff rim (the sea in
// the gameplay view)
if (biome === 'fjord' && want('pursuit')) {
  await ev(() => { window.__skifree.hold(false); window.__skifree.freeCam(null); window.__skifree.toChase(); window.__skifree.autopilot(null); });
  const zr = await P(`(w, m, c) => { let best = 600, bd = Infinity; for (let z = 500; z < ${G.L} - 500; z += 20) { const d = m.routeX(z) - c.rimX(z); if (d < bd) { bd = d; best = z; } } return { z: best, d: bd }; }`);
  await goTo(zr.z - 140, 20);
  await ev(() => { window.__skifree.hold(true); window.__skifree.hud(true); window.__skifree.autopilot('skilled'); window.__skifree.placeYeti(90); });
  await framesUntil(`(s) => s.z >= ${zr.z - 20} || s.phase !== 'chase'`, 400);
  await settle(1500);
  await shot('09d_pursuit_rim', `Ordinary chase camera where the run passes closest to the rim (z≈${zr.z}, ${Math.round(zr.d)} m from the cliff edge)`);
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
  // throws need a gap above SNOWBALL.minGap (25 m): place the Yeti just outside it so the throw
  // happens close behind the skier (readable in the rear view) without the Yeti catching up first
  await ev(() => window.__skifree.placeYeti(34));
  const r = await framesUntil(`(s) => s.phase !== 'chase' || (s.yetiThrowT !== null && s.yetiThrowT > 0.55 && s.yetiDistance < 45)`, 1500);
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
    // the beats to capture: the shared three (trophy, celebration, closing shot), at the times of
    // this location's script; Fjord (round 2) has its own beat sheet and a few extra beats
    const beats =
      biome === 'fjord'
        ? [
            [2.2, '11d_victory_quay', 'Victory: onto the quay (low tracking shot down the street to the water)'],
            [4.7, '11e_victory_racks', 'Victory: the Yeti arrives at the stockfish rack on the quay'],
            [6.05, '11f_victory_gag', 'Victory: the Yeti turns to us and bites the dried cod'],
            [6.75, '11f2_victory_gag_face', 'Victory: the gag (his face), the harbour behind'],
            [8.9, '11g_victory_present', 'Victory: the harbourmaster presents the trophy in both hands (over the shoulder)'],
            [10.9, '11_victory_trophy', 'Victory: the trophy caught and held up (reverse angle)'],
            [13.5, '11b_victory_celebration', 'Victory: apres on the pier (tub, bonfire, sauna), the bather sprinting for the edge'],
            [14.4, '11j_victory_plunge', 'Victory: the cannonball (tucked, at the top of its arc)'],
            [15.05, '11h_victory_splash', 'Victory: the crown splash'],
            [20.0, '11i_victory_reveal_mid', 'Victory: the reveal, mid-move'],
            [24.8, '11c_victory_reveal', 'Victory: the closing reveal, settled (the start beacon, the title)'],
          ]
        : [
            [9.6, '11_victory_trophy', 'Victory: trophy hand-off'],
            [13.4, '11b_victory_celebration', 'Victory: the celebration beat'],
            [19.5, '11c_victory_reveal', 'Victory: the closing reveal'],
          ];
    const onlyBeats = process.env.BEATS ? process.env.BEATS.split(',') : null;
    for (const [t, name, note] of beats) {
      await framesUntil(`(s) => s.cinematicTime >= ${t}`, 900, biome !== 'alpine');
      if (onlyBeats && !onlyBeats.includes(name)) continue;
      await settle(1500);
      await shot(name, note);
    }
  }
}

// ---- round 4 additions (Fjord): wind gate (gust + lull), gap jump, viewpoint, cornice relocation
// cue, and an Expedition water arm with the rear view
if (biome === 'fjord' && (want('gate') || want('gap') || want('viewpoint') || want('cornice'))) {
  await ev(() => { window.__skifree.hold(false); window.__skifree.freeCam(null); window.__skifree.toMenu(); });
  await settle(1500);
  await ev(([m, l, b]) => window.__skifree.setCourse(m, l, { difficulty: 'normal', biome: b }), [mode, length, biome]);
  await ev(() => window.__skifree.startRun(true));
  await settle(2000);
  await ev(() => { window.__skifree.hold(true); window.__skifree.toChase(); window.__skifree.autopilot(null); });
  if (want('gate')) {
    const gates = await P(`(w, m) => { for (let z = 300; z < ${G.L} - 300; z += 150) w.environment.stream(z); const out = []; for (const h of w.environment.hazards.all()) if (h.kind === 'sea-gust' && h.params && h.params.gate) out.push({ id: h.id, g: h.params.gate }); out.sort((a, b) => a.g.z - b.g.z); return out; }`);
    log('gates', gates.length);
    const gt = gates[Math.min(gates.length - 1, 1)];
    if (gt) {
      const g = gt.g;
      await goTo(g.z - 150, 0);
      await ev(() => { window.__skifree.hold(true); window.__skifree.hud(false); });
      const pose = `(w, m) => { const g = ${JSON.stringify(g)}; const cz = g.z - 32, cx = m.routeX(cz) + 7; window.__skifree.freeCam([cx, m.heightAt(cx, cz) + 14, cz], [g.x - 3, m.heightAt(g.x, g.z + 6) - 1, g.z + 6], 56); }`;
      const r1 = await framesUntil(`(s) => (window.__skifree.hazards('sea-gust').find((h) => h.id === ${gt.id}) || {}).phase === 'active'`, 900);
      await framesUntil(`(s) => false`, 20);
      await P(pose);
      await settle(3000);
      await shot('12_wind_gate_gust', `Wind gate (id ${gt.id}) in the gust (${r1.ok ? 'active' : 'phase not reached'}): windsock flying, spindrift funnelled through the notch (sea side, frame right); drifted lee behind the rib (frame left)`);
      const r2 = await framesUntil(`(s) => (window.__skifree.hazards('sea-gust').find((h) => h.id === ${gt.id}) || {}).phase === 'dormant'`, 900);
      await framesUntil(`(s) => false`, 30);
      await P(pose);
      await settle(2500);
      await shot('12b_wind_gate_lull', `The same wind gate in the lull (${r2.ok ? 'dormant' : 'phase not reached'}): windsock limp, the notch is free`);
    }
  }
  if (want('gap')) {
    await ev(() => window.__skifree.freeCam(null));
    const gaps = await P(`(w) => window.__skifree.hazards('gap-marker')`);
    const all = gaps.length ? gaps : await P(`(w, m) => { for (let z = 300; z < ${G.L} - 300; z += 150) w.environment.stream(z); return window.__skifree.hazards('gap-marker'); }`);
    const gp = all[Math.floor(all.length / 2)];
    if (gp) {
      await goTo(gp.z - 120, 0);
      await ev(() => { window.__skifree.hold(true); window.__skifree.hud(false); });
      await P(`(w, m) => { const h = ${JSON.stringify(gp)}; const cx = h.x + 22, cz = h.z - 18; window.__skifree.freeCam([cx, m.heightAt(cx, cz) + 7, cz], [h.x - 4, m.heightAt(h.x, h.z) - 1.5, h.z + 6], 54); }`);
      await settle(3000);
      await shot('13_gap_jump', `Gap jump (gap-marker id ${gp.id}): the gully across the spine and its marker poles`);
    } else log('no gap marker on this course');
  }
  if (want('viewpoint')) {
    await ev(() => window.__skifree.freeCam(null));
    const co = await ev(() => window.__skifree.coast(0, 100000));
    // the viewpoint farthest from any cave (a sea cave's hill rises between some run-in viewpoints and the sea)
    const caveZs = await P(`(w, m) => m.profile.encounters(-Infinity, ${G.L}).map((e) => e.caveZ)`);
    const lk = [...co.lookouts].sort((a, b) => Math.min(...caveZs.map((z) => Math.abs(b.z - z))) - Math.min(...caveZs.map((z) => Math.abs(a.z - z))))[0];
    if (lk) {
      await goTo(lk.z - 100, 0);
      await ev(() => { window.__skifree.hold(true); window.__skifree.hud(false); });
      await P(`(w, m, c) => { const l = ${JSON.stringify(lk)}; const y = m.heightAt(l.x, l.z); const cx = l.x + 16, cz = l.z - 14; window.__skifree.freeCam([cx, Math.max(m.heightAt(cx, cz), y) + 6, cz], [l.x - 500, y - 70, l.z + 220], 58); }`);
      await settle(3000);
      await shot('14_viewpoint', `Scenic viewpoint at z≈${Math.round(lk.z)} (${lk.chase ? 'chase stretch' : 'free stretch'}): the platform and the view over the fjord`);
      if (want('vprobe')) await probe('viewpoint');
    }
  }
  if (want('cornice')) {
    await ev(() => window.__skifree.freeCam(null));
    const zc = Math.round(G.L * 0.45);
    await P(`(w, m, c) => { const z = ${zc}; window.__skifree.teleport(z, 7, c.rimX(z) + 5, -Math.PI / 2 + 0.25); }`);
    await ev(() => { window.__skifree.hold(true); window.__skifree.hud(true); window.__skifree.autopilot(null); });
    const r = await framesUntil(`(s) => Math.abs(s.x - window.__skifree.world().mountain.routeX(s.z)) < 4`, 600);
    await framesUntil(`(s) => false`, 8);
    await settle(2000);
    await shot('15_cornice_relocation', `Cornice relocation cue: the skier sent over the rim at z≈${zc} is put back on the piste (${r.ok ? 'relocated' : 'not relocated within 20 s'}) with the title and caption`);
  }
}
if (biome === 'fjord' && want('arm')) {
  await ev(() => { window.__skifree.hold(false); window.__skifree.freeCam(null); window.__skifree.toMenu(); });
  await settle(1500);
  await ev((b) => window.__skifree.setCourse('classic', 'expedition', { difficulty: 'normal', biome: b }), biome);
  await ev(() => window.__skifree.startRun(true));
  await settle(3000);
  await ev(() => { window.__skifree.hold(true); window.__skifree.skipCave?.(); window.__skifree.toChase(); window.__skifree.hud(true); });
  const co = await ev(() => window.__skifree.coast(0, 100000));
  // an arm inside the first chase (between the first cave's trigger and the first refuge), so the
  // teleport triggers no encounter
  const span = await P(`(w, m) => { const e = m.profile.encounters(-Infinity, m.finishZ)[0]; const cp = m.profile.checkpoints(e.triggerZ, m.finishZ)[0] ?? m.finishZ; return [e.triggerZ, cp]; }`);
  const arms = co.reaches.filter((r) => r.z1 !== null && (r.z0 + r.z1) / 2 > span[0] + 400 && (r.z0 + r.z1) / 2 < span[1] - 400);
  const arm = arms[0] ?? co.reaches.find((r) => r.z1 !== null && r.z1 > span[0] + 800) ?? co.reaches[1];
  // where the run passes closest to the rim along that arm (the water in the gameplay view)
  const za = await P(`(w, m, c) => { const a = Math.max(${arm.z0} + 300, ${span[0]} + 400), b = Math.min(${arm.z1 ?? arm.z0 + 3000} - 300, ${span[1]} - 400); let best = Math.round((a + b) / 2), bd = Infinity; for (let z = a; z < b; z += 20) { const d = m.routeX(z) - c.rimX(z); if (d < bd) { bd = d; best = z; } } return best - 120; }`);
  await goTo(za, 22);
  await ev(() => { if (window.__skifree.state().session?.phase === 'caveCinematic') window.__skifree.skipCave(); });
  await ev(() => { window.__skifree.hold(true); window.__skifree.autopilot('skilled'); window.__skifree.hud(true); });
  await framesUntil(`(s) => s.phase === 'chase'`, 300);
  await framesUntil(`(s) => false`, 60);
  await ev(() => window.__skifree.placeYeti(16));
  await framesUntil(`(s) => false`, 25);
  await settle(2000);
  await shot('16_expedition_arm', `Expedition: ordinary chase gameplay beside fjord arm ${arm.index} (z ${Math.round(arm.z0)}–${Math.round(arm.z1 ?? 0)}), rear view showing the Yeti`);
}

manifest.seconds = Math.round((Date.now() - t0) / 1000);
writeFileSync(`${outDir}/manifest${only === 'all' ? '' : '-' + only.replace(/,/g, '_')}.json`, JSON.stringify(manifest, null, 2));
log('done', manifest.shots.length, 'shots,', manifest.errors.length, 'errors');
await browser.close();
