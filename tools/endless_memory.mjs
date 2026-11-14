// node tools/endless_memory.mjs <baseUrl> <out.json> [km=120] [biome=alpine]
// Long Endless session: travels down the mountain in 1 km steps (teleport + rendered frames so the
// world streams), skipping cave cinematics, and records GPU resource counts and JS heap per km.
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const [base, out, kmArg = '120', biome = 'alpine'] = process.argv.slice(2);
const KM = Number(kmArg);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--expose-gc', '--enable-precise-memory-info'] });
const p = await b.newPage({ viewport: { width: 640, height: 360 } });
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));
await p.addInitScript((biome) => localStorage.setItem('skifree-tld.settings.v1', JSON.stringify({ quality: 'medium', biome, course: 'classic', courseLength: 'endless' })), biome);
await p.goto(base + '/?debug');
await p.waitForFunction(() => window.__ready === true, null, { timeout: 600000, polling: 1000 });
await p.evaluate(() => window.__skifree.startRun(true));
const rows = [];
for (let k = 1; k <= KM; k++) {
  const r = await p.evaluate(async (z) => {
    const s = window.__skifree;
    s.teleport(z, 22);
    for (let i = 0; i < 4; i++) {
      s.frames(3);
      if (s.state().session.phase === 'caveCinematic') s.skipCave();
      await new Promise((r) => requestAnimationFrame(() => r()));
    }
    s.gc();
    const st = s.state().session;
    const pf = s.perf();
    return { km: z / 1000, phase: st.phase, checkpoints: st.checkpoints, geometries: pf.geometries, textures: pf.textures, heapMB: s.heap() ? +(s.heap() / 1048576).toFixed(1) : null, bands: st.bands, vegBands: st.vegBands, chunks: st.chunks, caves: st.caves, origin: st.origin, outcome: st.outcome };
  }, k * 1000);
  rows.push(r);
  console.log(JSON.stringify(r));
  if (r.outcome !== 'none') break;
}
writeFileSync(out, JSON.stringify({ rows, errors }, null, 1));
await b.close();
