// Fjord cornice stress (28,840 seeded approaches; ~12 min). Run: npx vitest run --config tests/review/vitest.config.ts tests/review/fjord_cornice_stress.test.ts --disableConsoleIntercept
// Cornice dead-zone stress (seeded). Approaches toward the sea across headings / speeds / pop timings,
// incl. low-speed and stop-in-zone starts; after any stop in the guard band the bot tries an escape
// (idle, skate inland, skate straight inland, downhill tuck, wiggle). "Stuck" = neither relocated nor back
// 5 m inside the full-guard band within ESC s. Straight-at-the-cliff runs: never past the crest unrelocated.
import { it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, makeCourse, worldSeed } from '../../src/game/CourseConfig';
import { NO_INPUT, PHYS_DT, SkierPhysics, type SkierInput } from '../../src/physics/SkierPhysics';
import { BiomeEnvironment } from '../../src/world/capabilities/environment';
import { clamp } from '../../src/core/rng';
const E = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const wrap2 = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
it('cornice stress', () => {
  const seeds = (E.SEEDS ?? 'CS1,CS2,CS3,CS4,CS5,CS6,CS7,CS8,CS9,CS10').split(',');
  const ESC = Number(E.ESC ?? 10);
  const escapes = ['idle', 'inland', 'inland90', 'downhill', 'wiggle'] as const;
  const agg: Record<string, { n: number; reloc: number; stall: number; stopZone: number; stuck: number; overUnreloc: number; escT: number[]; reasons: Record<string, number> }> = {};
  const pol: Record<string, { n: number; own: number; reloc: number; progress: number; stuck: number; t: number[] }> = {};
  const ex: string[] = [];
  let total = 0;
  for (const sd of seeds) {
    const c0 = makeCourse('custom', 'standard', { biome: 'fjord', customText: sd }); const m = buildMountain(c0); const c = m.coast!; const ws = worldSeed(c0);
    let k = 0;
    for (let z0 = 400; z0 < m.finishZ - 500; z0 += 330) for (const mode of ['none', 'pop-early', 'pop-mid', 'pop-late', 'low', 'rest'] as const) {
      const speeds = mode === 'low' ? [2, 4, 6, 8] : mode === 'rest' ? [0] : [14, 22, 30, 38, 45];
      const angs = mode === 'rest' ? [-1.4, -0.7, 0, 0.7, 1.4, 2.4, 3.1] : [0.5, 0.8, 1.1, 1.4];
      for (const v0 of speeds) for (const ang of angs) {
        k++;
        const key = mode;
        const A = (agg[key] ??= { n: 0, reloc: 0, stall: 0, stopZone: 0, stuck: 0, overUnreloc: 0, escT: [], reasons: {} });
        const p = new SkierPhysics(m, null, () => [], new BiomeEnvironment(m, ws));
        // start: on the line (fast modes), close to the crest (low), or at rest inside the full-guard band (rest)
        const startB = mode === 'low' ? -10 + (k % 9) : mode === 'rest' ? -11 + (k % 13) : -0;
        const x0 = mode === 'none' || mode.startsWith('pop') ? m.routeX(z0) - 4 : c.rimX(z0) - startB;
        p.reset(x0, z0, -ang, v0);
        const popAt = mode === 'pop-early' ? 0.05 : mode === 'pop-mid' ? 0.5 : mode === 'pop-late' ? 0.95 : 2;
        let popped = popAt > 1, reloc = 0, over = false;
        const onEv = () => { for (const e of p.drainEvents()) if (e.type === 'relocate') { reloc++; A.reasons[e.reason] = (A.reasons[e.reason] ?? 0) + 1; } };
        for (let i = 0; i < 16 / PHYS_DT; i++) {
          const s = p.s; const err = wrap2(-ang - s.heading);
          if (!popped && c.guard(s.pos.x, s.pos.z) > popAt && s.grounded) { popped = true; for (let j = 0; j < 28; j++) { p.step({ ...NO_INPUT, pop: true }); onEv(); } }
          p.step(mode === 'rest' ? NO_INPUT : { ...NO_INPUT, steer: clamp(-err * 3, -1, 1), tuck: 1, recover: s.crashTime > 1.4 });
          onEv();
          if (!reloc && s.grounded && c.beyondRim(s.pos.x, s.pos.z) > 3) over = true;
          if (reloc || (i > 60 && s.grounded && !s.crashed && s.speed < 0.3)) break;
        }
        A.n++; total++;
        if (over && !reloc) A.overUnreloc++;
        if (reloc) { A.reloc++; continue; }
        const b0 = c.beyondRim(p.s.pos.x, p.s.pos.z);
        if (b0 <= -18) continue; // stopped outside the cornice stall band
        A.stopZone++;
        const esc = escapes[k % escapes.length]!;
        const P = (pol[esc] ??= { n: 0, own: 0, reloc: 0, progress: 0, stuck: 0, t: [] });
        const sx = p.s.pos.x;
        const sz = p.s.pos.z;
        P.n++;
        let t = 0, ok = false;
        while (t < ESC) {
          const s = p.s; let inp: SkierInput = { ...NO_INPUT, recover: s.crashTime > 1.4 };
          const want = esc === 'inland' ? 0.9 : esc === 'inland90' ? Math.PI / 2 : esc === 'downhill' ? 0 : esc === 'wiggle' ? Math.sin(t * 2) * 1.2 : null;
          if (want !== null) inp = { ...NO_INPUT, steer: clamp(-wrap2(want - s.heading) * 3, -1, 1), tuck: 1, recover: s.crashTime > 1.4 };
          p.step(inp); t += PHYS_DT;
          for (const e of p.drainEvents()) if (e.type === 'relocate') { reloc++; A.reasons[e.reason] = (A.reasons[e.reason] ?? 0) + 1; }
          if (reloc) { A.stall++; P.reloc++; P.t.push(t); ok = true; break; }
          if (c.beyondRim(s.pos.x, s.pos.z) < -19) { P.own++; P.t.push(t); ok = true; break; }
        }
        const b1 = c.beyondRim(p.s.pos.x, p.s.pos.z);
        // not out yet but free: 2 m further inland, out of the stall band, moving (≥ 1 m/s) or ≥ 8 m from the stop
        if (!ok && (b1 < b0 - 2 || b1 < -18 || p.s.speed >= 1 || Math.hypot(p.s.pos.x - sx, p.s.pos.z - sz) >= 8)) { P.progress++; ok = true; }
        if (ok) A.escT.push(t);
        else { A.stuck++; P.stuck++; if (ex.length < 6) ex.push(`${sd} z0 ${z0} ${mode} v${v0} a${ang} esc ${esc}: stopped b ${b0.toFixed(2)} → b ${c.beyondRim(p.s.pos.x, p.s.pos.z).toFixed(2)} v ${p.s.speed.toFixed(2)}`); }
      }
    }
  }
  const q = (xs: number[], f: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(f * s.length))]! : NaN; };
  console.log(`CN total approaches ${total}`);
  for (const [key, A] of Object.entries(agg)) console.log(`CN ${key}: n ${A.n}, relocated on approach ${A.reloc}, stopped in the cornice band ${A.stopZone} -> recovered by stall relocation ${A.stall}, STUCK ${A.stuck}; over the crest unrelocated ${A.overUnreloc}; escape time p50 ${q(A.escT, 0.5).toFixed(2)} p95 ${q(A.escT, 0.95).toFixed(2)} max ${q(A.escT, 1).toFixed(2)} s; reasons ${JSON.stringify(A.reasons)}`);
  for (const [k, P] of Object.entries(pol)) console.log(`CN escape '${k}': ${P.n} stopped in the band; skied out on their own ${P.own}, put back by the stall rule ${P.reloc}, still in the band but free (moving / on the way out) after ${ESC} s ${P.progress}, TRAPPED (slow, < 8 m moved, not put back) ${P.stuck}; time to out/relocation p50 ${q(P.t, 0.5).toFixed(2)} p95 ${q(P.t, 0.95).toFixed(2)} max ${q(P.t, 1).toFixed(2)} s`);
  console.log(`CN e.g. ${ex.join(' | ')}`);
});
