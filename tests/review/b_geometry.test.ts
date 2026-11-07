// Reviewer B (internal) probes: route quality across many seeds, determinism, memory growth.
import { describe, expect, it } from 'vitest';
import { Mountain } from '../../src/world/course';
import { GeneratedProfile } from '../../src/world/profile';
import { LANE_HALF, ObstacleField, generateBand, laneClearance } from '../../src/physics/obstacles';

const LENS = [3000, 10000, 20000, 50000];
const SEEDS = Array.from({ length: 30 }, (_, i) => (i * 7919 + 13) >>> 0);

function routeScan(m: Mountain, z0: number, z1: number, step = 4) {
  const kick = [...m.profile.kickersNear(z0 - 100, z1 + 100, [])];
  const inKick = (z: number) => kick.some((k) => z > k.z - k.run - 4 && z < k.z + 8);
  let worstStep = { v: -Infinity, z: 0 };
  let worstRise20 = { v: -Infinity, z: 0 };
  let outside = { n: 0, z: NaN, worst: -Infinity };
  const hs: number[] = [];
  const zs: number[] = [];
  for (let z = z0; z <= z1; z += step) {
    const x = m.routeX(z);
    const h = m.heightAt(x, z);
    hs.push(h); zs.push(z);
    const margin = Math.abs(x - m.centerX(z)) + LANE_HALF - m.halfWidth(z);
    if (margin > 0) { outside.n++; if (margin > outside.worst) { outside.worst = margin; outside.z = z; } }
    if (!Number.isFinite(h)) throw new Error(`non-finite h at ${z}`);
  }
  const w = Math.round(20 / step);
  for (let i = 1; i < hs.length; i++) {
    if (inKick(zs[i]!)) continue;
    const d = hs[i]! - hs[i - 1]!;
    if (d > worstStep.v) worstStep = { v: d, z: zs[i]! };
    if (i >= w && !inKick(zs[i - w]!)) {
      const r = hs[i]! - hs[i - w]!;
      if (r > worstRise20.v) worstRise20 = { v: r, z: zs[i]! };
    }
  }
  return { worstStep, worstRise20, outside };
}

describe('B: route skiability across many seeds', () => {
  it('30 seeds x 4 finite lengths + Endless 30 km', () => {
    const fails: string[] = [];
    let globalRise = -Infinity;
    const t0 = performance.now();
    for (const L of [...LENS, Infinity]) {
      for (const seed of SEEDS) {
        const m = Mountain.generated(seed, L);
        const end = Number.isFinite(L) ? L : 30000;
        const r = routeScan(m, 0, end, 4);
        globalRise = Math.max(globalRise, r.worstRise20.v);
        if (r.worstRise20.v > 0.5) fails.push(`L=${L} seed=${seed} sustained uphill ${r.worstRise20.v.toFixed(2)} m over 20 m ending z=${r.worstRise20.z}`);
        if (r.outside.n > 0) fails.push(`L=${L} seed=${seed} route lane outside piste at ${r.outside.n} samples, worst ${r.outside.worst.toFixed(1)} m at z=${r.outside.z}`);
      }
    }
    console.log(`route scan ${(performance.now() - t0) / 1000}s; worst 20m rise ${globalRise.toFixed(2)}; issues=${fails.length}`);
    console.log(fails.slice(0, 40).join('\n'));
    expect(true).toBe(true);
  });

  it('lane clearance in sampled windows on 12 seeds x 50 km', () => {
    const bad: string[] = [];
    let worst = Infinity;
    for (const seed of SEEDS.slice(0, 12)) {
      const m = Mountain.generated(seed, 50000);
      const f = new ObstacleField(m, seed);
      for (const z of [400, 6000, 17000, 33000, 45000, 49400]) {
        const c = laneClearance(f, z, z + 512);
        worst = Math.min(worst, c);
        if (c < 4.5) bad.push(`seed=${seed} window ${z}: clearance ${c.toFixed(2)}`);
        f.release(Infinity, Infinity);
      }
    }
    console.log(`lane worst ${worst.toFixed(2)}; bad: ${bad.join('; ')}`);
    expect(bad).toEqual([]);
  });

  it('segment types differ geometrically (measured, seed-averaged)', () => {
    const acc = new Map<string, { n: number; slope: number; width: number; mog: number; forest: number; tree: number }>();
    for (const seed of SEEDS.slice(0, 10)) {
      const m = Mountain.generated(seed, 50000);
      const p = m.profile as GeneratedProfile;
      for (const s of p.segmentList) {
        if (!Number.isFinite(s.z1)) continue;
        const zm = (s.z0 + s.z1) / 2;
        const a = acc.get(s.type) ?? { n: 0, slope: 0, width: 0, mog: 0, forest: 0, tree: 0 };
        a.n++; a.slope += p.slopeDeg(zm); a.width += p.halfWidth(zm) * 2; a.mog += p.mogulZone(zm); a.forest += p.forest(zm); a.tree += p.treeLine(zm);
        acc.set(s.type, a);
      }
    }
    for (const [t, a] of acc) console.log(`${t.padEnd(10)} n=${a.n} slope=${(a.slope / a.n).toFixed(1)} width=${(a.width / a.n).toFixed(0)} mogul=${(a.mog / a.n).toFixed(2)} forest=${(a.forest / a.n).toFixed(2)}`);
  });
});

describe('B: determinism vs generation order', () => {
  it('one-shot ensure vs incremental ensure vs far-first queries give identical courses', () => {
    for (const L of [50000, Infinity]) {
      const a = new GeneratedProfile(4242, L); a.ensure(120000);
      const b = new GeneratedProfile(4242, L); for (let z = 0; z <= 120000; z += 333) b.ensure(z);
      expect(b.segmentList.length).toBe(a.segmentList.length);
      for (let i = 0; i < a.segmentList.length; i++) expect(b.segmentList[i]).toEqual(a.segmentList[i]);
      const ma = new Mountain(a, 4242);
      const mb = new Mountain(b, 4242);
      for (let z = 0; z < Math.min(119000, Number.isFinite(L) ? L + 500 : 119000); z += 97.3) {
        const x = ma.routeX(z) + 7.1;
        expect(mb.heightAt(x, z)).toBe(ma.heightAt(x, z));
      }
    }
  });

  it('obstacle bands are identical whether generated far-first or in order', () => {
    const m1 = Mountain.generated(777, Infinity);
    const far = generateBand(m1, 777, 150); // far band first on a fresh profile
    const m2 = Mountain.generated(777, Infinity);
    for (let b = 0; b < 150; b += 1) m2.profile.ensure(b * 256);
    const inOrder = generateBand(m2, 777, 150);
    expect(inOrder.length).toBe(far.length);
    for (let i = 0; i < far.length; i++) expect(inOrder[i]).toEqual(far[i]);
  });

  it('tail values before the next segment exists: routeX at zDone-1 stable after further generation?', () => {
    const p = new GeneratedProfile(31337, Infinity);
    const seg = p.segmentList[p.segmentList.length - 1]!;
    const zq = seg.z1 - 1;
    const before = [p.routeX(zq), p.halfWidth(zq), p.slopeDeg(zq), p.baseHeight(zq)];
    p.ensure(seg.z1 + 5000);
    const after = [p.routeX(zq), p.halfWidth(zq), p.slopeDeg(zq), p.baseHeight(zq)];
    console.log('tail before', before, 'after', after);
  });
});

describe('B: Endless growth', () => {
  it('profile state after 1000 km and per-band cost growth', () => {
    const m = Mountain.generated(99, Infinity);
    const p = m.profile as GeneratedProfile & Record<string, unknown>;
    let t = performance.now();
    generateBand(m, 99, 40); generateBand(m, 99, 41);
    const early = performance.now() - t;
    p.ensure(1_000_000);
    const counts = Object.fromEntries(['kick', 'cliffs', 'segs', 'enc', 'sight', 'cps', 'alts'].map((k) => [k, (p[k] as unknown[]).length]));
    const keys = (p['slope'] as { zs: number[] }).zs.length;
    t = performance.now();
    generateBand(m, 99, 3900); generateBand(m, 99, 3901);
    const late = performance.now() - t;
    t = performance.now();
    for (let i = 0; i < 20000; i++) m.heightAt(m.routeX(999000 + i), 999000 + i);
    const hLate = performance.now() - t;
    t = performance.now();
    for (let i = 0; i < 20000; i++) m.heightAt(m.routeX(10000 + i), 10000 + i);
    const hEarly = performance.now() - t;
    const enc = m.profile.encounters(990000, 1000000);
    console.log({ counts, slopeKeys: keys, bandMsEarly: early / 2, bandMsAt1000km: late / 2, heightAt20kEarlyMs: hEarly, heightAt20kAt1000kmMs: hLate, speedMulAt1000km: enc[0]?.speedMul, hAt1000km: m.heightAt(m.routeX(1e6), 1e6) });
  });
});
