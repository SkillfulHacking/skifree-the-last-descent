// Whiteout audio probe (round-1 evidence): plays a real Whiteout run in the production build with
// sound on, taps the master output with an AnalyserNode and logs, every second, the output level
// (RMS / peak, linear), the number of sources started, and the storm state (front phase/strength,
// nearest blizzard phase) from the ?debug state. Answers: does the storm get audibly louder, do
// blizzard cues fire, does anything clip (peak ≥ 1) or go silent / NaN, are there audio errors.
//
//   npx vite preview --port 4471 &   node tools/audio_probe.mjs <out.json> [seconds=150] [seed=WO-R1]
//
// Software rendering (SwiftShader) runs the game slowly; audio runs in real time. Levels are the
// Web Audio graph's own output, not a speaker measurement.
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [out = join(tmpdir(), 'audio_probe.json'), secs = '150', seed = 'WO-R1'] = process.argv.slice(2);
const base = process.env.BASE ?? 'http://127.0.0.1:4471';
const b = await chromium.launch({ executablePath: process.env.PW_CHROME ?? '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 640, height: 360 } });
const errors = [];
p.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 300)));
await p.addInitScript((s) => {
  localStorage.setItem('skifree-tld.settings.v1', JSON.stringify({ quality: 'low', biome: 'whiteout', course: 'custom', courseLength: 'sprint', difficulty: 'normal', showTutorial: false, seenPoleHint: true, ...s }));
  const tap = { an: null, starts: 0 };
  window.__audioTap = tap;
  const conn = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dst, ...rest) {
    if (dst instanceof AudioDestinationNode) {
      if (!tap.an) {
        tap.an = this.context.createAnalyser();
        tap.an.fftSize = 2048;
        conn.call(tap.an, dst);
      }
      return conn.call(this, tap.an, ...rest);
    }
    return conn.call(this, dst, ...rest);
  };
  const st = AudioScheduledSourceNode.prototype.start;
  AudioScheduledSourceNode.prototype.start = function (...a) {
    tap.starts++;
    return st.apply(this, a);
  };
}, {});
await p.goto(`${base}/?debug`);
await p.waitForFunction(() => window.__ready === true, null, { timeout: 900_000, polling: 1000 });
const courseId = await p.evaluate((sd) => window.__skifree.setCourse('custom', 'sprint', { difficulty: 'normal', biome: 'whiteout', custom: sd }), seed);
await p.evaluate(() => window.__skifree.startRun(true));
await p.evaluate(() => { window.__skifree.autopilot('skilled'); window.__skifree.toChase(); });
// software rendering runs the game at ~0.1x real time, so the weather is set on the run's physics
// clock (as in play, everything follows that clock): a clear window, then the middle of a storm
const tStorm = await p.evaluate(() => { const k = window.__skifree; for (let t = 30; t < 900; t += 1) { const f = k.front(t); if (f.phase === 'storm') return t + 6; } return null; });
const segs = [['clear', 8], ['storm', tStorm]];
const per = Math.max(10, Math.floor(Number(secs) / segs.length));
const rows = [];
for (let i = 0; i < per * segs.length; i++) {
  if (i % per === 0) { const [name, t] = segs[i / per]; if (t != null) await p.evaluate((tt) => window.__skifree.setTime(tt), t); console.log('segment', name, t); }
  await p.waitForTimeout(1000);
  const r = await p.evaluate(() => {
    const tap = window.__audioTap;
    let rms = null, peak = null, nan = false;
    if (tap.an) {
      const a = new Float32Array(tap.an.fftSize);
      tap.an.getFloatTimeDomainData(a);
      let s = 0, pk = 0;
      for (const v of a) { if (!Number.isFinite(v)) nan = true; s += v * v; pk = Math.max(pk, Math.abs(v)); }
      rms = Math.sqrt(s / a.length);
      peak = pk;
    }
    const k = window.__skifree;
    const s = k.state().session;
    const f = s ? k.front(s.time ?? 0) : null;
    return { ctx: tap.an?.context.state ?? null, rms, peak, nan, starts: tap.starts, phase: s?.phase ?? null, t: s?.time ?? null, z: s?.z ?? null, front: f ? { phase: f.phase, s: f.s } : null };
  });
  rows.push(r);
  if (i % 10 === 0) console.log(JSON.stringify(r));
  r.segment = segs[Math.floor(i / per)][0];
}
const summary = {
  courseId, seed, errors,
  ctxState: rows.at(-1)?.ctx,
  maxPeak: Math.max(...rows.map((r) => r.peak ?? 0)),
  anyNaN: rows.some((r) => r.nan),
  rmsClear: avg(rows.filter((r) => r.segment === 'clear').map((r) => r.rms)),
  rmsStorm: avg(rows.filter((r) => r.segment === 'storm').map((r) => r.rms)),
  peakClear: Math.max(...rows.filter((r) => r.segment === 'clear').map((r) => r.peak ?? 0)),
  peakStorm: Math.max(...rows.filter((r) => r.segment === 'storm').map((r) => r.peak ?? 0)),
  tStorm,
  sourcesStarted: rows.at(-1)?.starts,
};
function avg(a) { const v = a.filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; }
writeFileSync(out, JSON.stringify({ summary, rows }, null, 1));
console.log(JSON.stringify(summary));
await b.close();
