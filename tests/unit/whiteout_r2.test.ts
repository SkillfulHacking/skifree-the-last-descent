/**
 * Round 2 (W-035 / W-045): the weather's costs can be managed by good play, and the drift-hop
 * exploit is gone.
 *  - a drift's physics follows its drawn mound (crest, flanks, the visible gap);
 *  - a jump that clears the snow crosses it untouched, one that does not is caught in it (knocked);
 *  - the gap and the line into it are kept free of obstacles; the lee shoulders too;
 *  - ploughing at full speed brakes hard but never stops the skier dead, and a bogged-down skier can
 *    always wade out (no soft-lock);
 *  - the lee shoulder in a front takes the wind down; the open crest lines do not.
 */
import { describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, makeCourse, worldSeed } from '../../src/game/CourseConfig';
import { BiomeEnvironment } from '../../src/world/capabilities/environment';
import { ObstacleField } from '../../src/physics/obstacles';
import { DRIFT, WIND_DRIFT, driftDepth, driftShape, type DriftParams } from '../../src/world/biomes/whiteout/hazards';
import { frontAt, leeLaneAt, LEE, whiteoutExposure } from '../../src/world/biomes/whiteout/storm';
import type { HazardInstance, HazardContact } from '../../src/world/hazards/hazard';
import { hazardClearZones } from '../../src/world/hazards/field';

const world = (seed: string) => {
  const c = makeCourse('custom', 'sprint', { biome: 'whiteout', customText: seed, difficulty: 'normal' });
  const m = buildMountain(c);
  const ws = worldSeed(c);
  const env = new BiomeEnvironment(m, ws, { difficulty: 'normal' });
  env.hazards.ensure(0, 3000);
  const drifts = env.hazards.peek(0, 3000).filter((h) => h.kind === 'wind-drift') as HazardInstance<DriftParams>[];
  return { m, ws, env, drifts };
};
const contact = (o: Partial<HazardContact>): HazardContact => ({ dx: 0, dz: 0, dist: 0, inside: true, speed: 17, grounded: true, heightAbove: 0, t: 0, intensity: 0.8, tuck: 1, clearance: 0, ...o });

describe('Whiteout round 2: drifts', () => {
  const { m, ws, drifts } = world('W2T-01');
  it('every row marks a clear gap that no drawn mound covers, kept free of obstacles with the line into it', () => {
    const rows = drifts.filter((h) => h.params.lead);
    expect(rows.length).toBeGreaterThan(3);
    const field = new ObstacleField(m, ws);
    field.ensure(0, 3000);
    const ids: number[] = [];
    for (const lead of rows) {
      const p = lead.params;
      const mates = drifts.filter((h) => h.params.row === p.row && h.params.rowZ === p.rowZ);
      // the drawn mounds stay out of the gap (depth 0 across it)
      for (let x = p.gapX! - p.gapHalf! + 0.5; x <= p.gapX! + p.gapHalf! - 0.5; x += 0.5)
        for (const h of mates) expect(driftDepth(h, x - h.x, p.rowZ! - h.z), `row ${p.rowZ} x ${x}`).toBe(0);
      // no rock or tree in the gap or on the line into it
      for (let z = p.rowZ! - 60; z <= p.rowZ! + 20; z += 4) {
        field.grid.query(p.gapX!, z, p.gapHalf!, ids);
        for (const id of ids) {
          const o = field.get(id)!;
          expect(Math.abs(o.x - p.gapX!) > p.gapHalf! + 0.9 || Math.abs(o.z - z) > 2.1, `obstacle in gap at ${o.x.toFixed(1)},${o.z.toFixed(1)}`).toBe(true);
        }
      }
    }
    expect(hazardClearZones(m, ws, 0, 3000).length).toBeGreaterThan(rows.length);
  });
  it('a jump that clears the snow crosses untouched; one that does not is caught in it', () => {
    const h = drifts.find((d) => d.params.lead)!;
    const { H } = driftShape(h);
    const crest = { dx: -0.35 * h.r * 0.75 * Math.sin(h.rot), dz: 0.35 * h.r * 0.75 * Math.cos(h.rot) };
    const d = driftDepth(h, crest.dx, crest.dz);
    expect(d).toBeGreaterThan(H * 0.8);
    const ph = { phase: 'active', u: 0 } as never;
    expect(WIND_DRIFT.effect(h, ph, contact({ ...crest, grounded: false, clearance: d + 0.4 }))).toBeNull();
    const e = WIND_DRIFT.effect(h, ph, contact({ ...crest, grounded: false, clearance: d * 0.5 }));
    expect(e?.knock?.keep).toBeCloseTo(DRIFT.clipKeep, 5);
  });
  it('ploughing brakes hard but never like a wall, and a bogged-down skier can wade out', () => {
    const h = drifts.find((d) => d.params.lead)!;
    const ph = { phase: 'active', u: 0 } as never;
    // at the crest (the deepest snow)
    const cz = 0.35 * h.r * 0.75;
    const at = (speed: number) => WIND_DRIFT.effect(h, ph, contact({ speed, dx: -cz * Math.sin(h.rot), dz: cz * Math.cos(h.rot) }))!.surface!;
    const dec = (v: number) => at(v).dragAdd! * v * v;
    // the drag deceleration stops growing above vCap
    expect(dec(30)).toBeCloseTo(dec(DRIFT.vCap), 6);
    expect(dec(12)).toBeLessThan(dec(DRIFT.vCap));
    // at a wading pace the extra friction is gone
    expect(at(1).friction).toBeCloseTo(1, 6);
    expect(at(17).friction).toBeGreaterThan(2.5);
  });
});

describe('Whiteout round 2: the lee shoulder', () => {
  const { m, ws } = world('W2T-02');
  it('in a front, the downwind shoulder takes up to half the wind away; outside a front nothing changes', () => {
    let t = 30;
    while (frontAt(t, ws).phase !== 'storm' || frontAt(t, ws).s < 0.9) t += 0.5;
    const f = frontAt(t, ws);
    let checked = 0;
    for (let z = 300; z < 2800 && checked < 12; z += 37) {
      // (where an open crest line crosses the shoulder, the crest's full exposure wins)
      if (!leeLaneAt(m, z, f.dir) || m.altLane(m.routeX(z), z) > 0 || m.altLane(m.routeX(z) + f.dir * LEE.lane, z) > 0) continue;
      const rx = m.routeX(z);
      const line = whiteoutExposure(m, rx, z, t, ws);
      const lee = whiteoutExposure(m, rx + f.dir * LEE.lane, z, t, ws);
      const windward = whiteoutExposure(m, rx - f.dir * LEE.lane, z, t, ws);
      expect(lee).toBeLessThan(line * (1 - 0.4 * f.s));
      expect(windward).toBeCloseTo(line, 6);
      // the ground's own openness (snow surface, hazard placement) ignores the weather
      expect(whiteoutExposure(m, rx + f.dir * LEE.lane, z)).toBeCloseTo(whiteoutExposure(m, rx - f.dir * LEE.lane, z), 6);
      checked++;
    }
    expect(checked).toBeGreaterThan(4);
    let calm = 30;
    while (frontAt(calm, ws).s > 0) calm += 0.5;
    const z = 1200;
    expect(whiteoutExposure(m, m.routeX(z) + LEE.lane, z, calm, ws)).toBeCloseTo(whiteoutExposure(m, m.routeX(z) + LEE.lane, z), 9);
  });
});

describe('round 3 (R2 D N-3): the weather clear zones are cached per band', () => {
  it('a second request for the same ground does not recompute the lee zones', async () => {
    const { WHITEOUT_WEATHER } = await import('../../src/world/biomes/whiteout/storm');
    const { hazardClearZones } = await import('../../src/world/hazards/field');
    const { buildMountain, makeCourse, worldSeed } = await import('../../src/game/CourseConfig');
    const c = makeCourse('custom', 'sprint', { biome: 'whiteout', customText: 'R3-CACHE' });
    const m = buildMountain(c);
    const orig = WHITEOUT_WEATHER.clearZones!;
    let calls = 0;
    (WHITEOUT_WEATHER as { clearZones: typeof orig }).clearZones = (mm, a, b) => (calls++, orig(mm, a, b));
    try {
      const a = hazardClearZones(m, worldSeed(c), 900, 1500);
      const n = calls;
      const b = hazardClearZones(m, worldSeed(c), 900, 1500);
      expect(n).toBeGreaterThan(0);
      expect(calls).toBe(n);
      expect(b).toEqual(a);
    } finally {
      (WHITEOUT_WEATHER as { clearZones: typeof orig }).clearZones = orig;
    }
  });
});

describe('round 3 (R2 E N1): a blizzard cell pushes the way the front blows', () => {
  it('inside a front the push follows the front (the HUD arrow and the wind audio); in the clear, the cell', async () => {
    const { BLIZZARD_CELL } = await import('../../src/world/biomes/whiteout/hazards');
    const { frontAt } = await import('../../src/world/biomes/whiteout/storm');
    // (W-081) decided per gust over its telegraph + active window: tests/unit/w081_blizzard_dir.test.ts
    const seed = 913;
    // and the effect itself uses it: a grounded skier in the cell slips toward the front's side
    const t = (() => { for (let tt = 30; tt < 900; tt += 0.5) if (frontAt(tt, seed).s > 0.8) return tt; return -1; })();
    const f = frontAt(t, seed);
    const h = { x: 0, z: 0, r: 58, params: { dir: -f.dir } } as never;
    const e = BLIZZARD_CELL.effect(h, { phase: 'active', u: 0.5 } as never, { dx: 0, dz: 0, dist: 0, inside: true, speed: 15, grounded: true, heightAbove: 0, t, intensity: 0.8, seed, tuck: 0 } as never);
    expect(Math.sign(e!.slipX!)).toBe(f.dir);
  });
});
