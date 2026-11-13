// Production-build frame cost (CPU, main thread): drives the built bundle (vite preview) in Chrome
// down an Endless run with the skilled autopilot and times every simulated frame — session, physics,
// Yeti, hazards, World.update (all streaming under the shipped 6 ms budget) — as the browser's V8
// runs it. The ?debug harness only starts the run and steps frames; nothing is re-implemented.
//
//   node tools/prod_frames.mjs <baseUrl> <biome> <out.json> [km=12] [renderEvery=240]
//
// NOT measured: GPU work, draw submission cost, uploads and shader compiles inside renderer.render
// (the machine renders with SwiftShader, a software rasteriser; its timings say nothing about a GPU).
// A frame is rendered every `renderEvery` steps so resources are uploaded and the scene stays live;
// those render calls are timed separately and reported as software-renderer numbers only.
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const [base = 'http://127.0.0.1:4471', biome = 'fjord', out = `/tmp/prod_frames_${biome}.json`, kmArg = '12', reArg = '240'] = process.argv.slice(2);
const KM = Number(kmArg);
const RENDER_EVERY = Number(reArg);
const b = await chromium.launch({ executablePath: process.env.PW_CHROME ?? '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--expose-gc'] });
const p = await b.newPage({ viewport: { width: 640, height: 360 } });
const errors = [];
p.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 300)));
await p.addInitScript((biome) => {
  if (!sessionStorage.getItem('pf')) {
    sessionStorage.setItem('pf', '1');
    localStorage.setItem('skifree-tld.settings.v1', JSON.stringify({ quality: 'high', biome, course: 'classic', courseLength: 'endless', difficulty: 'relaxed', showTutorial: false }));
  }
}, biome);
await p.goto(base + '/?debug');
await p.waitForFunction(() => window.__ready === true, null, { timeout: 900_000, polling: 1000 });
await p.evaluate(() => window.__skifree.startRun(true));
await p.waitForTimeout(1500);
const t0 = Date.now();
const res = await p.evaluate(
  async ([KM, RE]) => {
    const s = window.__skifree;
    s.hud?.(false);
    s.autopilot('skilled');
    const step = [];
    const render = [];
    let restarts = 0;
    let lastZ = 0;
    let i = 0;
    const z = () => s.state().session.z ?? 0;
    while (true) {
      const st = s.state().session;
      if (st.phase === 'caveCinematic') s.skipCave();
      if (st.outcome && st.outcome !== 'none') {
        // caught or crashed out: carry on from where the run ended (the stream is what is measured)
        restarts++;
        const zz = st.z ?? lastZ;
        s.startRun(true);
        s.autopilot('skilled');
        s.teleport(zz, 22);
      }
      const a = performance.now();
      s.frames(1, 1 / 60);
      step.push(performance.now() - a);
      lastZ = z();
      if (lastZ >= KM * 1000) break;
      if (++i % RE === 0) {
        const r0 = performance.now();
        await new Promise((r) => requestAnimationFrame(() => r()));
        render.push(performance.now() - r0);
      }
      if (i > KM * 1000 * 6) break; // safety: < ~10 m/s average
    }
    return { step, render, restarts, z: lastZ, heapMB: s.heap?.() ? s.heap() / 1048576 : null, perf: s.perf() };
  },
  [KM, RENDER_EVERY],
);
const st = [...res.step].sort((a, c) => a - c);
const q = (f) => +st[Math.min(st.length - 1, Math.floor(f * st.length))].toFixed(2);
const summary = {
  biome,
  km: +(res.z / 1000).toFixed(2),
  frames: st.length,
  median: q(0.5),
  p95: q(0.95),
  p99: q(0.99),
  max: +st[st.length - 1].toFixed(2),
  over8: st.filter((x) => x > 8).length,
  over16: st.filter((x) => x > 16).length,
  over33: st.filter((x) => x > 33).length,
  restarts: res.restarts,
  softwareRenderMs: { n: res.render.length, median: res.render.length ? +res.render.sort((a, c) => a - c)[Math.floor(res.render.length / 2)].toFixed(0) : null },
  heapMB: res.heapMB && +res.heapMB.toFixed(1),
  renderer: res.perf,
  errors,
  seconds: Math.round((Date.now() - t0) / 1000),
};
writeFileSync(out, JSON.stringify({ summary, step: res.step.map((x) => +x.toFixed(2)) }));
console.log(JSON.stringify(summary));
await b.close();
