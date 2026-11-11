/**
 * Fjord Coast round 3: the signature mechanic's weight, the airborne squall, the gap's stake, the
 * sea-side caves and the rim near the line, and the technical fixes that are testable without a GPU.
 */
import '../support/domStub';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import '../../src/world/biomes';
import { buildMountain, makeCourse, worldSeed, type LengthMode } from '../../src/game/CourseConfig';
import type { Mountain } from '../../src/world/course';
import { NO_INPUT, PHYS_DT, SkierPhysics } from '../../src/physics/SkierPhysics';
import { BiomeEnvironment } from '../../src/world/capabilities/environment';
import { getHazardKind, hazardPhase } from '../../src/world/hazards/hazard';
import { collectPlacements } from '../../src/world/hazards/testkit';
import { GATE, LANE_GROUP, SQUALL_TIMING, type GustParams } from '../../src/world/biomes/fjord/hazards';
import { BAND } from '../../src/physics/obstacles';
import { RIM_LINE_CLEAR, SEA_CAVE_BACK } from '../../src/world/coast';
import { yetiSpawnAfterCinematic } from '../../src/yeti/spawn';
import { Cave } from '../../src/world/Cave';
import { groundGrid, rockView } from '../../src/world/biomes/fjord/views/hazardViews';
import { CoastalShelter } from '../../src/world/biomes/fjord/views/shelter';
import { waterReaches, WATER_FAR_REAR } from '../../src/world/biomes/fjord/views/water';
import { createSnowMaterial } from '../../src/world/snowMaterial';
import { getBiome } from '../../src/world/biome';
import { clamp, wrapAngle } from '../../src/core/rng';

const course = (len: LengthMode, sd: string) => makeCourse('custom', len, { biome: 'fjord', customText: sd });
const cache = new Map<string, Mountain>();
const mtn = (len: LengthMode, sd: string) => {
  const k = `${len}:${sd}`;
  if (!cache.has(k)) cache.set(k, buildMountain(course(len, sd)));
  return cache.get(k)!;
};
const gust = getHazardKind('sea-gust');
const rock = getHazardKind('scoured-rock');
const SEEDS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'];

describe('Fjord round 3/4: wind decisions are a guaranteed part of every run', () => {
  it(`round 4: every Sprint has ≥ 3 wind gates and ≥ 7 wind decisions (gates + jump squalls); a gate in every ~1 km group of open running; each gate is a rib of two outcrops`, () => {
    for (const sd of SEEDS) {
      const m = mtn('sprint', sd);
      const ws = worldSeed(course('sprint', sd));
      const all = collectPlacements(m, ws, [gust], 1, 0, m.finishZ);
      const gates = all.filter((h) => (h.params as GustParams).gate);
      const jumps = all.filter((h) => ((h.params as GustParams).push ?? 0) > 0);
      expect(gates.length, sd).toBeGreaterThanOrEqual(3);
      expect(gates.length + jumps.length, sd).toBeGreaterThanOrEqual(7);
      const rocks = collectPlacements(m, ws, [rock], 1, 0, m.finishZ);
      for (const L of gates) {
        const G = (L.params as GustParams).gate!;
        expect(rocks.some((r) => Math.abs(r.z - G.z) < 0.01 && Math.abs(r.x - G.x) < 0.01), `${sd} gate ${G.z.toFixed(0)}`).toBe(true);
        expect(rocks.some((r) => Math.abs(r.z - G.z - GATE.rib) < 0.01), `${sd} rib ${G.z.toFixed(0)}`).toBe(true);
      }
      // full groups in open running (past the start and the first cave, before the finish run-out)
      for (let g = 2; (g + 1) * LANE_GROUP * BAND < m.finishZ - 500; g++) {
        const z0 = g * LANE_GROUP * BAND;
        const n = gates.filter((L) => (L.params as GustParams).gate!.z >= z0 && (L.params as GustParams).gate!.z < z0 + LANE_GROUP * BAND).length;
        expect(n, `${sd} group ${g}`).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe('Fjord round 3: the airborne squall carries a skier onto the landing rock', () => {
  it('taking off a squall jump while it blows carries a skier 1–7 m onshore (median ≥ 1.8 m; round 2: 0.28 m) compared with the lull', () => {
    let n = 0;
    const all: number[] = [];
    for (const sd of SEEDS.slice(0, 5)) {
      const m = mtn('standard', sd);
      const ws = worldSeed(course('standard', sd));
      const jumps = collectPlacements(m, ws, [gust], 1, 0, 6000).filter((h) => ((h.params as { push: number }).push ?? 0) > 0 && (h.params as { slip: number }).slip === 0);
      for (const h of jumps.slice(0, 2)) {
        const lip = h.z - 7;
        const k = m.profile.kickersNear(lip - 1, lip + 1, [])[0];
        if (!k) continue;
        const kx = m.centerX(k.z) + k.d;
        const drift = (blowing: boolean) => {
          let tA = 0;
          for (let t = 0.02; t < 30; t += 0.02) if (hazardPhase(gust, h, t).phase === 'active' && hazardPhase(gust, h, t - 0.02).phase !== 'active') {
            tA = t;
            break;
          }
          const p = new SkierPhysics(m, null, () => [], blowing ? new BiomeEnvironment(m, ws) : null);
          const z0 = lip - 60;
          p.reset(kx + (m.routeX(z0) - m.routeX(lip)), z0, Math.atan2(m.routeX(lip) - m.routeX(z0), 60), 21);
          p.s.time = tA + 0.3 * SQUALL_TIMING.active - 60 / 21; // round 4: take off in the body of the (longer) gust
          let x0 = NaN;
          let land = NaN;
          let air = false;
          while (p.s.pos.z < lip + 45) {
            const s = p.s;
            const look = 7 + s.speed * 0.55;
            const tz = s.pos.z + look;
            const err = wrapAngle(Math.atan2(kx + (m.routeX(tz) - m.routeX(lip)) - s.pos.x, look) - s.heading);
            p.step({ ...NO_INPUT, steer: s.grounded ? clamp(-err * 3.2, -1, 1) : 0, tuck: 1, recover: true }, PHYS_DT);
            if (!s.grounded && !air) {
              air = true;
              x0 = s.pos.x - (m.routeX(s.pos.z) - m.routeX(lip));
            }
            if (air && s.grounded && Number.isNaN(land)) land = s.pos.x - (m.routeX(s.pos.z) - m.routeX(lip)) - x0;
          }
          return land;
        };
        const on = drift(true);
        const calm = drift(false);
        if (Number.isNaN(on) || Number.isNaN(calm)) continue;
        n++;
        all.push(on - calm);
        expect(on - calm, `${sd} ${h.z.toFixed(0)}`).toBeGreaterThan(1);
        expect(on - calm).toBeLessThan(7);
      }
    }
    expect(n).toBeGreaterThanOrEqual(3);
    const med = [...all].sort((a, b) => a - b)[all.length >> 1]!;
    if ((globalThis as unknown as { process?: { env: Record<string, string> } }).process?.env.JLOG) console.log('JUMP', all.map((v) => v.toFixed(2)).join(' '));
    expect(med).toBeGreaterThan(1.8);
  });
});

describe('Fjord round 3: gap jumps have a stake', () => {
  it('a tucked racer clears the gully; a slow, upright approach drops in and loses speed — no crash, no soft-lock', () => {
    let gaps = 0;
    for (const sd of SEEDS) {
      const m = mtn('standard', sd);
      for (const g of m.profile.gapsNear!(0, m.finishZ, []).slice(0, 2)) {
        gaps++;
        const run = (v0: number, tuck: number) => {
          const p = new SkierPhysics(m, null, () => [], null);
          const zs = g.lipZ - 70;
          const ax = (z: number) => m.profile.altRouteX(z) ?? m.routeX(z);
          p.reset(ax(zs), zs, 0, v0);
          let landed = '';
          let air = false;
          let vMin = 99;
          let t = 0;
          while (p.s.pos.z < g.z + g.len + 25 && t < 30) {
            const s = p.s;
            const look = 7 + s.speed * 0.55;
            const err = wrapAngle(Math.atan2(ax(s.pos.z + look) - s.pos.x, look) - s.heading);
            p.step({ ...NO_INPUT, steer: clamp(-err * 3.2, -1, 1), tuck: tuck || s.speed < 6 ? 1 : 0, recover: true }, PHYS_DT);
            t += PHYS_DT;
            if (!s.grounded) air = true;
            else if (air && !landed) landed = s.pos.z < g.z + g.len ? 'in' : 'over';
            if (s.pos.z > g.lipZ) vMin = Math.min(vMin, s.speed);
          }
          return { landed, crashes: p.s.crashes, out: p.s.pos.z >= g.z + g.len + 25, vMin };
        };
        const fast = run(26, 1);
        expect(fast.landed, `${sd} gap ${g.z.toFixed(0)} fast`).toBe('over');
        expect(fast.crashes).toBe(0);
        const slow = run(9, 0);
        expect(slow.crashes).toBe(0);
        expect(slow.out, `${sd} gap ${g.z.toFixed(0)} slow gets out`).toBe(true);
      }
    }
    expect(gaps).toBeGreaterThanOrEqual(6);
  });

  it('Sprints have gaps too (most seeds)', () => {
    const n = SEEDS.map((sd) => mtn('sprint', sd).profile.gapsNear!(0, 3000, []).length);
    expect(n.filter((k) => k > 0).length, `${n}`).toBeGreaterThanOrEqual(4);
  });
});

describe('Fjord round 3: the rim beside the line (R1) and sea-side caves (R4)', () => {
  it('the racing line and every alternate line keep RIM_LINE_CLEAR from the crest; the rim is within 75 m of the line on most open stretches', () => {
    for (const len of ['sprint', 'standard'] as LengthMode[]) {
      let near = 0;
      let n = 0;
      for (const sd of SEEDS.slice(0, 4)) {
        const m = mtn(len, sd);
        const c = m.coast!;
        for (let z = 0; z < m.finishZ; z += 10) {
          const d = m.routeX(z) - c.rimX(z);
          expect(d, `${len} ${sd} z ${z}`).toBeGreaterThanOrEqual(RIM_LINE_CLEAR - 1e-6);
          const alt = m.profile.altRouteX(z);
          if (alt !== null) expect(c.guard(alt, z)).toBe(0);
          if (z > 600 && z < m.finishZ - 600) {
            n++;
            if (d < 75) near++;
          }
        }
      }
      expect(near / n, len).toBeGreaterThan(0.6);
    }
  });

  it('caves are cut into the sea side; the cliff runs behind their hillside; the Yeti lands on the piste; the cave builds', () => {
    for (const sd of SEEDS.slice(0, 3)) {
      const m = mtn('standard', sd);
      const c = m.coast!;
      for (const e of m.profile.encounters(-Infinity, m.finishZ)) {
        const a = e.anchor;
        expect(a.side).toBe(-1);
        const base = a.centerX - a.d;
        for (const dz of [-60, 0, 60]) expect(base - c.rimX(a.z + dz), `${sd} z ${a.z + dz}`).toBeGreaterThanOrEqual(SEA_CAVE_BACK - 1);
        const cave = new Cave(m, a, 'low');
        for (const q of [cave.mouth, cave.ledge, ...cave.exitPath]) expect(c.guard(q.x, q.z)).toBe(0);
        const sp = yetiSpawnAfterCinematic(m, a, cave.ledge);
        expect(Math.abs(sp.pos.y - cave.ledge.y)).toBeLessThan(0.01);
        // the leap lands on the piste toward the line
        expect(Math.abs(sp.leap.x - m.centerX(sp.leap.z))).toBeLessThan(m.halfWidth(sp.leap.z));
        cave.dispose();
      }
    }
  });
});

describe('Fjord round 3: tech', () => {
  it('rock views drape over a ground grid within a few cm of the snow', () => {
    const m = mtn('standard', 'Q1');
    const ws = worldSeed(course('standard', 'Q1'));
    const rocks = collectPlacements(m, ws, [rock], 1, 0, 4000).slice(0, 6);
    for (const h of rocks) {
      const H = groundGrid(m, h.x, h.z, h.r * 1.4 + 3);
      let worst = 0;
      for (let k = 0; k < 200; k++) {
        const a = k * 2.399;
        const r = h.r * 1.3 * Math.sqrt(k / 200);
        const x = h.x + Math.cos(a) * r;
        const z = h.z + Math.sin(a) * r;
        worst = Math.max(worst, Math.abs(H(x, z) - m.heightAt(x, z)));
      }
      expect(worst).toBeLessThan(0.15);
      const v = rockView(h as never, m);
      v.dispose();
    }
  });

  it('a shelter built in slices is the same as one built at once', () => {
    const m = mtn('endurance', 'Q1');
    const z = m.profile.checkpoints(0, 20000)[0]!;
    const a = new CoastalShelter(m, z, 0);
    const job = CoastalShelter.sliced(m, z, 0);
    let slices = 0;
    let r = job.next();
    while (!r.done) {
      slices++;
      r = job.next();
    }
    const b = r.value;
    expect(slices).toBeGreaterThanOrEqual(4);
    const verts = (g: THREE.Group) => {
      let n = 0;
      g.traverse((o) => {
        if (o instanceof THREE.Mesh) n += o.geometry.attributes.position.count;
      });
      return n;
    };
    expect(verts(b.group)).toBe(verts(a.group));
    a.dispose();
    b.dispose();
  });

  it('rear view: the arm behind the skier (within the rear camera range) always has water before arms beyond the far plane', () => {
    const m = mtn('expedition', 'Q1');
    for (let z = 3000; z < 48000; z += 97) {
      const drawn = waterReaches(m.coast!, z, 6);
      for (const r of m.coast!.reaches(z - WATER_FAR_REAR, z)) if (r.z1 > z - WATER_FAR_REAR) expect(drawn.some((d) => d.index === r.index), `z ${z} arm ${r.index}`).toBe(true);
    }
  });

  it('the coastal terrain shader has a lighter low-preset variant with its own program key; Alpine is untouched', () => {
    const lo = createSnowMaterial('low', getBiome('fjord')).material.customProgramCacheKey();
    const hi = createSnowMaterial('high', getBiome('fjord')).material.customProgramCacheKey();
    expect(lo).not.toBe(hi);
    expect(createSnowMaterial('low', getBiome('alpine')).material.customProgramCacheKey()).toBe(createSnowMaterial('high', getBiome('alpine')).material.customProgramCacheKey());
  });
});
