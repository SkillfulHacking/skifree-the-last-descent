// Whiteout Ridge evidence capture (Pass 5 full production, brief §10–11): real browser renders of the
// production build (SwiftShader — software rendering; no GPU timing) through the ?debug harness.
//
//   npm run build && npx vite preview --port 4471 &
//   node tools/whiteout_evidence.mjs <outDir> [WxH=1920x1080] [seed=WO-R1] [shots=all|weather,vista,cave,chase,hard,victory] [length=sprint]
//
// Weather phases are reached by setting the run's physics clock (debug setTime): the fronts, the
// storm wall, the cloud deck, the fog and the wind all follow that clock, exactly as in play.
// manifest.json records the build SHA, viewport, course, every shot's time/phase/camera and page errors.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const [outDir = 'docs/reviews/biomes/whiteout/round-1', size = '1920x1080', seed = 'WO-R1', only = 'all', length = 'sprint'] = process.argv.slice(2);
const base = process.env.BASE ?? 'http://127.0.0.1:4471';
const [W, H] = size.split('x').map(Number);
const want = (k) => only === 'all' || only.split(',').includes(k);
mkdirSync(outDir, { recursive: true });
const sha = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim() + (execSync('git status --porcelain --untracked-files=no -- src').toString().trim() ? '+dirty' : '');
  } catch {
    return 'unknown';
  }
})();
const manifest = { biome: 'whiteout', seed, length, viewport: size, sha, renderer: 'SwiftShader (software)', date: new Date().toISOString(), shots: [], errors: [] };
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME ?? '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', (e) => manifest.errors.push(String(e).slice(0, 400)));
page.on('console', (m) => m.type() === 'error' && manifest.errors.push(m.text().slice(0, 400)));
const settings = (difficulty) => ({ quality: 'high', biome: 'whiteout', course: 'custom', courseLength: length, difficulty, rearView: true, showTutorial: false, seenPoleHint: true });
await page.addInitScript((s) => {
  if (!sessionStorage.getItem('evidence')) {
    sessionStorage.setItem('evidence', '1');
    localStorage.setItem('skifree-tld.settings.v1', JSON.stringify(s));
  }
}, settings('normal'));
await page.goto(`${base}/?debug`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 900_000, polling: 1000 });

const ev = (fn, arg) => page.evaluate(fn, arg);
/** evaluate `(w, m, k) => …` source with the world, mountain and debug API */
const P = (src) => page.evaluate((s) => { const k = window.__skifree; const w = k.world(); return (0, eval)(s)(w, w.mountain, k); }, src);
const settle = (ms) => page.waitForTimeout(ms);
async function shot(name, note) {
  await ev(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
  await settle(400);
  await page.screenshot({ path: `${outDir}/${name}.png`, timeout: 1_200_000 });
  const st = await ev(() => ({ cam: window.__skifree.cameraPose(), s: window.__skifree.state().session }));
  const f = st.s ? await ev((t) => window.__skifree.front(t), st.s.time ?? 0) : null;
  manifest.shots.push({ name, note, camera: st.cam, phase: st.s?.phase ?? 'menu', z: st.s?.z ?? null, time: st.s?.time ?? null, front: f, cinematicTime: st.s?.cinematicTime ?? null });
  writeFileSync(`${outDir}/manifest.json`, JSON.stringify(manifest, null, 2));
  log('shot', name, f ? `${f.phase} s=${f.s.toFixed(2)}` : '');
}
/** step deterministic frames until a predicate on the session state holds */
async function framesUntil(pred, max, dt = 1 / 30) {
  return ev(([p, n, d]) => {
    const f = (0, eval)(p);
    for (let i = 0; i < n; i++) {
      const s = window.__skifree.state().session;
      if (s && f(s)) return { ok: true, i };
      window.__skifree.frames(1, d);
    }
    return { ok: false, i: n };
  }, [pred, max, dt]);
}
/** the first time ≥ from (s) where the front is in `phase` with `left` (s) to go, or `into` s into it */
async function findPhase(phase, from, into = null, left = null) {
  return ev(([ph, t0, inn, lft]) => {
    for (let t = t0; t < t0 + 1200; t += 0.25) {
      const f = window.__skifree.front(t);
      if (!f || f.phase !== ph) continue;
      if (lft !== null && Math.abs(f.left - lft) > 0.2) continue;
      if (inn !== null) {
        const g = window.__skifree.front(t - inn);
        if (!g || g.phase !== ph) continue;
        const h = window.__skifree.front(t - inn - 0.25);
        if (h && h.phase === ph) continue;
      }
      return t;
    }
    return null;
  }, [phase, from, into, left]);
}

async function startRun(difficulty) {
  await ev(() => { window.__skifree.hold(false); window.__skifree.freeCam(null); window.__skifree.toMenu(); });
  await settle(1500);
  await ev(([l, d, sd]) => window.__skifree.setCourse('custom', l, { difficulty: d, biome: 'whiteout', customText: sd }), [length, difficulty, seed]);
  await ev(() => window.__skifree.startRun(true));
  await settle(2500);
  await ev(() => window.__skifree.hold(true));
}
const G = await (async () => {
  await startRun('normal');
  const g = await P(`(w, m) => ({ L: m.finishZ, cave: m.profile.encounters(0, m.finishZ)[0] ?? null, rimSide: m.biome.terrain.ridge.dropSide })`);
  log('course', JSON.stringify(g));
  manifest.course = g;
  return g;
})();

/** put the skier at z skiing (autopilot), clock at t, and run a few frames so the weather settles */
async function skiAt(z, t, speed = 16) {
  await ev(([zz, sp]) => { window.__skifree.hold(true); window.__skifree.freeCam(null); window.__skifree.teleport(zz, sp); window.__skifree.autopilot('skilled'); window.__skifree.placeYeti(260); }, [z, speed]);
  await ev((tt) => window.__skifree.setTime(tt), t);
  await framesUntil('(s) => false', 45);
  await ev(() => window.__skifree.placeYeti(260));
}

// ---- weather phases from the normal third-person camera (HUD on)
if (want('weather')) {
  await ev(() => window.__skifree.hud(true));
  // past the encounter (teleporting over its trigger would start the cave cinematic): the chase is
  // on, the Yeti held 260 m back so the weather shots are not chase shots
  await ev(() => window.__skifree.toChase());
  await framesUntil('(s) => s.phase === "chase"', 300);
  await framesUntil('(s) => false', 240); // the RUN. banner clears
  const z = Math.min((G.cave?.triggerZ ?? 0) + 120, G.L * 0.4);
  await skiAt(z, 8);
  await shot('01_clear_window', 'Third-person, clear window (start): broken cloud deck, cloud shadows on the snow, the ridge in sun');
  const tb = await findPhase('build', 20);
  if (tb !== null) {
    await skiAt(z + 200, tb - 24);
    await shot('02_wall_far', `Third-person, ${24} s before a front: the storm wall on the windward horizon`);
    await skiAt(z + 260, tb - 9);
    await shot('03_wall_near', '9 s before the front: the wall crossing the ridges, the deck thickening and lowering, spindrift rising');
    await skiAt(z + 320, tb + 5);
    await shot('04_build', 'Building (5 s in): the wall over the course, wind and blowing snow up, light flattening');
  }
  const ts = await findPhase('storm', 20, 14);
  if (ts !== null) {
    await skiAt(z + 400, ts);
    await shot('05_storm', 'Storm (14 s in): visibility ~80 m, driving snow streaks, trail-marker lamps and rim wands the way through');
  }
  const te = await findPhase('ease', 20, 5);
  if (te !== null) {
    await skiAt(z + 480, te);
    await shot('06_easing', 'Easing (5 s in): the trailing edge tearing open');
    await skiAt(z + 520, te + 9);
    await shot('07_clearing', 'Clearing (~2 s after the storm): sun back through the gaps, cloud shadows breaking up over the ridge');
  }
}

// ---- vistas (free camera; clear window)
if (want('vista')) {
  await ev(() => window.__skifree.hud(false));
  await ev(() => window.__skifree.toChase());
  await framesUntil('(s) => s.phase === "chase"', 300);
  const zr = Math.round(G.L * 0.55);
  await skiAt(zr, 6, 0);
  await ev(() => window.__skifree.autopilot(null));
  // the corniced rim: from just inside it, along the edge, the flank falling away
  // (from the inside the raised lip hides the drop: the cornice is framed from just off the edge,
  // looking back along the rim — the overhang, its break-offs, the wands behind it on the piste side)
  await P(`(w, m, k) => { const z = ${zr}; const s = m.biome.terrain.ridge.dropSide; const rx = m.ridgeRimX(z); const cz = z - 45; const rxc = m.ridgeRimX(cz); const cx = rxc + s * 12; const ry = m.heightAt(rx, z); k.freeCam([cx, Math.max(m.heightAt(cx, cz), m.heightAt(rxc, cz)) + 3, cz], [rx, ry + 0.5, z + 20], 58); }`);
  await settle(2500);
  await shot('08_cornice_edge', 'The corniced rim (drop side), from just off the edge: the lip curling over the flank, rim wands set back from it');
  await P(`(w, m, k) => { const z = ${zr} + 60; const s = m.biome.terrain.ridge.dropSide; const rx = m.ridgeRimX(z); const cx = rx + s * 8, cz = z; k.freeCam([cx, Math.max(m.heightAt(cx, cz), m.heightAt(rx, cz)) + 6, cz], [rx + s * 900, m.heightAt(rx, z) - 420, z + 380], 60); }`);
  await settle(2500);
  await shot('09_valley_view', 'Over the edge: the flank falling ~500 m into the valley, far ranges across it');
  await P(`(w, m, k) => { const z = ${zr} + 120; const s = m.biome.terrain.ridge.dropSide; const cx = m.routeX(z) + s * 12, cz = z - 30; const tx = m.profile.centerX(z) - s * (m.profile.halfWidth(z) + 140); k.freeCam([cx, m.heightAt(cx, cz) + 2.6, cz], [tx, m.heightAt(tx, z + 40) + 20, z + 40], 58); }`);
  await settle(2500);
  await shot('10_crest', 'Across the piste to the crest side: the rocky crest and its tors, sky behind it');
  await P(`(w, m, k) => { const z = ${zr}; const cz = z - 160; const cx = m.routeX(cz); k.freeCam([cx, m.heightAt(cx, cz) + 45, cz], [m.routeX(z + 250), m.heightAt(m.routeX(z + 250), z + 250) - 20, z + 250], 62); }`);
  await settle(2500);
  await shot('11_ridge_overview', 'The ridge from above the piste: the course along the top, the drop on one side, the crest on the other');
}

// ---- the cave encounter (squall, emergence, roar burst, leap)
if (want('cave') && G.cave) {
  // a fresh run: an earlier section may already have started the chase (the encounter is then over)
  await startRun('normal');
  await ev(() => { window.__skifree.freeCam(null); window.__skifree.hud(false); window.__skifree.autopilot('skilled'); });
  // the run is held (frozen) between shots: put the skier just over the trigger, which starts the encounter
  await ev((tz) => window.__skifree.teleport(tz + 0.5, 16), G.cave.triggerZ);
  const r = await framesUntil('(s) => s.phase === "caveCinematic"', 900);
  log('cinematic', r.ok);
  for (const [t, name, note] of [
    [3.0, '12_cave_mouth', 'Cave encounter 3 s: the rimed mouth, snow curtain off the brow'],
    [8.6, '13_cave_emerge', 'Emergence (8.6 s): the squall rolling in, spindrift across the mouth'],
    [11.3, '14_cave_roar', 'The roar (11.3 s): snow blasted off the brow'],
    [15.2, '15_cave_leap', 'The leap (15.2 s)'],
  ]) {
    await framesUntil(`(s) => s.cinematicTime >= ${t}`, 900);
    await settle(1200);
    await shot(name, note);
  }
}

// ---- the chase in a storm: third-person with the rear view, and the Yeti's silhouette
if (want('chase')) {
  await ev(() => { window.__skifree.freeCam(null); window.__skifree.hud(true); window.__skifree.autopilot('skilled'); window.__skifree.toChase(); });
  const ts = await findPhase('storm', 40, 10);
  if (ts !== null) await ev((tt) => window.__skifree.setTime(tt), ts);
  const r = await framesUntil('(s) => s.yetiDistance < 34 && s.yetiDistance > 18', 900);
  log('gap', r.ok);
  await shot('16_storm_chase', 'Chase in a storm (third-person): the Yeti 18–34 m behind, rear view, distance bar, captions');
  await ev(() => window.__skifree.hud(false));
  await ev(() => {
    const k = window.__skifree;
    const s = k.state().session;
    const yp = s.yetiPos;
    k.freeCam([s.x + 1.2, s.y + 2.2, s.z - 3], [yp[0], yp[1] + 1.6, yp[2]], 50);
  });
  await settle(2000);
  await shot('17_yeti_silhouette', 'Looking back from the skier in the storm: the Yeti silhouette in the snow');
}

// ---- Hard: a snowball landing marker in fog
if (want('hard')) {
  await startRun('hard');
  await ev(() => { window.__skifree.hud(true); window.__skifree.autopilot('skilled'); window.__skifree.toChase(); });
  const ts = await findPhase('storm', 40, 8);
  if (ts !== null) await ev((tt) => window.__skifree.setTime(tt), ts);
  const r = await framesUntil('(s) => !!s.snowballMarker', 3000);
  log('throw', r.ok);
  await framesUntil('(s) => false', 8);
  await shot('18_hard_snowball_fog', `Hard, in a storm: a snowball's landing ring drawn over the fog (${r.ok ? 'marker up' : 'no throw seen'})`);
}

// ---- the rescue station and the victory (each beat frame-accurate on the cinematic clock)
if (want('victory')) {
  await startRun('normal');
  await ev(() => { window.__skifree.hud(false); window.__skifree.autopilot('skilled'); });
  await ev((L) => window.__skifree.teleport(L - 260, 16), G.L);
  // the arrival in a storm
  const ts = await findPhase('storm', 30, 6);
  if (ts !== null) await ev((tt) => window.__skifree.setTime(tt), ts);
  await framesUntil('(s) => s.z > ' + (G.L - 120), 900);
  await shot('19_station_approach', 'Approaching the rescue station through the storm (gameplay camera)');
  const r = await framesUntil('(s) => s.phase === "victory" || s.phase === "finish"', 1200);
  log('finish', r.ok);
  const beats = [
    [1.8, '20_v_arrive', 'Victory 1.8 s: into the light — porch light, beacon, searchlight beam, rescuers waving'],
    [5.0, '21_v_welcome', 'Victory 5.0 s: safety and welcome — door open, warm light on the snow'],
    [7.9, '22_v_lantern', 'Victory 7.9 s: THE LANTERN BEAT — the storm lantern raised in the doorway (frame-accurate)'],
    [10.4, '23_v_yeti_light', 'Victory 10.4 s: the Yeti at the edge of the light, the searchlight on him'],
    [12.0, '24_v_yeti_flinch', 'Victory 12.0 s: he flinches from the light and backs into the storm'],
    [15.0, '25_v_break', 'Victory 15.0 s: the storm breaking over the station'],
    [19.3, '26_v_reveal', 'Victory 19.3 s: the ridge revealed behind the station'],
  ];
  const onlyBeats = process.env.BEATS ? process.env.BEATS.split(',') : null;
  for (const [t, name, note] of beats) {
    await framesUntil(`(s) => s.cinematicTime >= ${t}`, 900);
    if (onlyBeats && !onlyBeats.includes(name)) continue;
    await settle(1200);
    await shot(name, note);
  }
}

writeFileSync(`${outDir}/manifest.json`, JSON.stringify(manifest, null, 2));
log('done; page errors:', manifest.errors.length);
await browser.close();
