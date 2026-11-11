/**
 * Terrain contact: steep faces are walls, ground following never creates energy, and the legitimate
 * jumps (kickers, rollers, cliff drops, pops) behave as before.
 *
 * Regression for Reviewer B (Fjord round 3) defect 2: skiing into a cave's cliff wall snapped the
 * skier up the face and launched them (15 → 60 m/s in one tick, 8.5 s of air, 84 m above ground);
 * 123 of 1,080 Alpine cave approaches flew > 3 s.
 */
import { describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { DIFFICULTY, buildMountain, makeCourse, worldSeed } from '../../src/game/CourseConfig';
import { simulateCourse, worldFor } from '../../src/game/simulate';
import { autopilotInput, type AutopilotStyle } from '../../src/debug/autopilot';
import { ObstacleField } from '../../src/physics/obstacles';
import { Mountain } from '../../src/world/course';
import { GRAVITY, NO_INPUT, PHYS_DT, SkierPhysics, TERRAIN_CONTACT, type SkierEvent, type SkierInput } from '../../src/physics/SkierPhysics';
import { BiomeEnvironment } from '../../src/world/capabilities/environment';
import type { Kicker } from '../../src/world/profile';
import { clamp, wrapAngle } from '../../src/core/rng';

const DEG = Math.PI / 180;
const energy = (p: SkierPhysics) => 0.5 * p.s.vel.lengthSq() + GRAVITY * p.s.pos.y;

/** 5° slope down +z; at x > wallX a rock face rises `steep` m per m up to `height` m. */
class Cliff extends Mountain {
  constructor(
    readonly wallX = 0,
    private steep = 10,
    private height = 20,
  ) {
    super(1);
  }
  override heightAt(x: number, z: number) {
    return -Math.tan(5 * DEG) * z + clamp((x - this.wallX) * this.steep, 0, this.height);
  }
  override surfaceWeights() {
    return { ice: 0, powder: 0, groomed: 1 };
  }
}

/** Flat run-in, then a smooth quarter-pipe that steepens to `maxDeg` (below the wall threshold). */
class QuarterPipe extends Mountain {
  constructor(private maxDeg: number) {
    super(1);
  }
  override heightAt(_x: number, z: number) {
    // slope rises linearly from 0 to tan(maxDeg) over 8 m starting at z = 20, then constant
    const k = Math.tan(this.maxDeg * DEG);
    const u = clamp(z - 20, 0, 1e9);
    return u < 8 ? (k * u * u) / 16 : 4 * k + k * (u - 8);
  }
  override surfaceWeights() {
    return { ice: 0, powder: 0, groomed: 1 };
  }
}

/** Gentle slope with a one-step 0.2 m ledge (a near-vertical riser) at z = 20, then a short drop. */
class Ledge extends Mountain {
  constructor() {
    super(1);
  }
  override heightAt(_x: number, z: number) {
    const base = -0.1 * z;
    if (z < 20) return base;
    if (z < 20.15) return base + ((z - 20) / 0.15) * 0.2;
    if (z < 21) return base + 0.2;
    return base + 0.2 - Math.min(1.5, (z - 21) * 1.2);
  }
  override surfaceWeights() {
    return { ice: 0, powder: 0, groomed: 1 };
  }
}

/** The synthetic kicker of physics.test.ts. */
class Kick extends Mountain {
  constructor(private lip: number) {
    super(1);
  }
  override heightAt(_x: number, z: number) {
    const base = -0.3 * z;
    const u = z - this.lip;
    if (u > -10 && u <= 0) return base + 1.6 * ((u + 10) / 10) ** 2;
    if (u > 0 && u < 3) return base + 1.6 * (1 - u / 3);
    return base;
  }
  override surfaceWeights() {
    return { ice: 0, powder: 0, groomed: 1 };
  }
}

interface Probe {
  /** fastest upward speed while airborne (a launch), m/s */
  maxVy: number;
  maxAbove: number;
  maxAir: number;
  /** largest gain of mechanical energy in one grounded (non-takeoff) step, J/kg */
  maxStepGain: number;
  /** largest gain in a takeoff step, as a fraction of the tolerance it is allowed */
  maxTakeoffGain: number;
  /** highest total mechanical energy reached above the start, J/kg (while not crashed) */
  maxAboveStart: number;
  events: SkierEvent[];
}

function probe(p: SkierPhysics, seconds: number, input: (i: number) => SkierInput = () => NO_INPUT, onStep?: (ev: SkierEvent[], velXBefore: number) => void): Probe {
  const m = (p as unknown as { mountain: Mountain }).mountain;
  const r: Probe = { maxVy: 0, maxAbove: 0, maxAir: 0, maxStepGain: -Infinity, maxTakeoffGain: 0, maxAboveStart: -Infinity, events: [] };
  const E0 = energy(p);
  for (let i = 0; i < seconds / PHYS_DT; i++) {
    const s = p.s;
    const wasGrounded = s.grounded && !s.crashed;
    const e0 = energy(p);
    const sp = s.speed;
    const vx = s.vel.x;
    p.step(input(i));
    const ev = p.drainEvents();
    onStep?.(ev, vx);
    r.events.push(...ev);
    const de = energy(p) - e0;
    if (wasGrounded && !s.crashed) {
      if (ev.some((e) => e.type === 'takeoff')) r.maxTakeoffGain = Math.max(r.maxTakeoffGain, de / (TERRAIN_CONTACT.takeoffTolJ + TERRAIN_CONTACT.takeoffTolFrac * 0.5 * sp * sp));
      else r.maxStepGain = Math.max(r.maxStepGain, de);
    }
    if (!s.crashed) r.maxAboveStart = Math.max(r.maxAboveStart, energy(p) - E0);
    if (!s.grounded) r.maxVy = Math.max(r.maxVy, s.vel.y);
    r.maxAbove = Math.max(r.maxAbove, s.pos.y - m.heightAt(s.pos.x, s.pos.z));
    r.maxAir = Math.max(r.maxAir, s.grounded ? 0 : s.airTime);
  }
  return r;
}

const crashes = (r: Probe) => r.events.filter((e): e is Extract<SkierEvent, { type: 'crash' }> => e.type === 'crash').map((e) => e.reason);

describe('steep terrain is a wall, not a launch ramp', () => {
  it('skiing straight into a cliff face at speed never launches the skier (was 15 → 60 m/s up)', () => {
    for (const v of [15, 25, 38]) {
      const m = new Cliff();
      const p = new SkierPhysics(m, null);
      p.reset(-6, 0, 90 * DEG, v);
      const r = probe(p, 4);
      expect(r.maxVy).toBeLessThan(2);
      expect(r.maxAbove).toBeLessThan(0.3);
      expect(r.maxAir).toBeLessThan(0.2);
      expect(crashes(r)).toEqual(['hit the cliff']);
      // never climbed the face
      expect(p.s.pos.x).toBeLessThan(m.wallX + 0.05);
    }
  });

  it('collision response grades with the speed into the face: slide, bounce, crash', () => {
    const at = (v: number, deg: number) => {
      const p = new SkierPhysics(new Cliff(), null);
      p.reset(-1.5, 0, (90 - deg) * DEG, v); // deg = angle from straight into the wall
      const r = probe(p, 0.6);
      const hit = r.events.find((e) => e.type === 'impact');
      return { p, r, hit, vn: v * Math.cos(deg * DEG) };
    };
    // glancing (normal speed < 3.5 m/s): slides along the face, keeps most of its speed, no crash
    const glance = at(20, 85);
    expect(crashes(glance.r)).toEqual([]);
    expect(glance.p.s.speed).toBeGreaterThan(17);
    expect(glance.p.s.pos.x).toBeLessThan(0.05);
    // heavy (3.5–9 m/s into the face): bounces off, loses speed, no crash
    const heavy = at(12, 60);
    expect(heavy.vn).toBeGreaterThan(TERRAIN_CONTACT.wallHeavy);
    expect(heavy.vn).toBeLessThan(TERRAIN_CONTACT.wallCrash);
    expect(heavy.hit).toMatchObject({ type: 'impact', kind: 'rock-heavy' });
    expect(crashes(heavy.r)).toEqual([]);
    expect(heavy.p.s.speed).toBeLessThan(0.8 * 12);
    expect(heavy.p.s.pos.x).toBeLessThan(0.05);
    // head-on fast: crash, most speed gone
    const fast = at(20, 10);
    expect(crashes(fast.r)).toEqual(['hit the cliff']);
    expect(fast.p.s.speed).toBeLessThan(8);
  });

  it('is stable for every approach angle 0–80° and speed 2–45 m/s: no launch, no climbing, no energy created', () => {
    let worstVy = -Infinity;
    let worstAbove = 0;
    let worstStep = -Infinity;
    let worstRun = -Infinity;
    let contacts = 0;
    let worstLabel = '';
    for (let deg = 0; deg <= 80; deg += 5) {
      for (const v of [2, 4, 7, 10, 15, 20, 26, 32, 38, 45]) {
        for (const steep of [2, 5, 10, 40]) {
          const m = new Cliff(0, steep, 20);
          const p = new SkierPhysics(m, null);
          p.reset(-4, 0, (90 - deg) * DEG, v);
          // speed into the face (its normal is −x) on the step it first hit it hard enough to notice
          let vn = -1;
          let vAlong = 0;
          const r = probe(
            p,
            3,
            () => ({ ...NO_INPUT, recover: p.s.crashTime > 1.2 }),
            (ev, vx) => {
              if (vn < 0 && ev.some((e) => e.type === 'impact' || e.type === 'crash')) {
                vn = vx;
                vAlong = Math.abs(p.s.vel.z);
              }
            },
          );
          worstVy = Math.max(worstVy, r.maxVy);
          if (r.maxAbove > worstAbove) worstLabel = `${deg}° ${v} m/s on 1:${steep}`;
          worstAbove = Math.max(worstAbove, r.maxAbove);
          worstStep = Math.max(worstStep, r.maxStepGain);
          worstRun = Math.max(worstRun, r.maxAboveStart);
          const label = `${deg}° ${v} m/s on 1:${steep} (vn ${vn.toFixed(2)})`;
          // (the face's own normal leans 5° down the fall line, so speed along it shifts vn a little)
          const margin = 0.6 + 0.1 * vAlong;
          if (vn > TERRAIN_CONTACT.wallCrash + margin) expect(crashes(r), label).toContain('hit the cliff');
          if (vn < TERRAIN_CONTACT.wallCrash - margin) expect(crashes(r), label).not.toContain('hit the cliff');
          if (vn >= 0) contacts++;
          // whatever happened, the skier is still at the foot of the face
          expect(p.s.pos.y - m.heightAt(p.s.pos.x, p.s.pos.z), label).toBeLessThan(0.3);
          expect(m.heightAt(p.s.pos.x, p.s.pos.z) - m.heightAt(-4, p.s.pos.z), label).toBeLessThan(0.6);
        }
      }
    }
    expect(contacts).toBeGreaterThan(300); // of 680: the rest only brushed the face (no event) or stopped short
    expect(worstVy).toBeLessThan(2);
    expect(worstAbove, worstLabel).toBeLessThan(0.3);
    expect(worstStep).toBeLessThan(GRAVITY * TERRAIN_CONTACT.snapExcessTol + 0.05);
    expect(worstRun).toBeLessThan(0.3);
  });

  it('a mid-air skier flying into a face is stopped by it (not teleported onto it) and falls beside it', () => {
    for (const v of [6, 20]) {
      const m = new Cliff(0, 10, 30);
      const p = new SkierPhysics(m, null);
      p.reset(-5, 0, 90 * DEG, v);
      p.s.pos.y += 4; // flying 4 m above the snow toward the face
      p.s.vel.set(v, 0, 0);
      p.s.grounded = false;
      const r = probe(p, 3, () => ({ ...NO_INPUT, recover: p.s.crashTime > 1.2 }));
      expect(p.s.pos.x).toBeLessThan(0.05);
      expect(r.maxVy).toBeLessThan(0.5);
      expect(r.maxAboveStart).toBeLessThan(0.3);
      expect(p.s.pos.y - m.heightAt(p.s.pos.x, p.s.pos.z)).toBeLessThan(0.05); // back on the snow
      if (v >= TERRAIN_CONTACT.wallCrash) expect(crashes(r)).toContain('hit the cliff');
      else expect(crashes(r)).toEqual([]);
    }
  });

  it('a tumbling (crashed) skier stops against a face instead of sliding up it', () => {
    const m = new Cliff(0, 10, 20);
    const p = new SkierPhysics(m, null);
    p.reset(-1, 0, 90 * DEG, 12);
    p.forceCrash();
    p.drainEvents();
    probe(p, 1);
    expect(p.s.pos.x).toBeLessThan(0.05);
    expect(m.heightAt(p.s.pos.x, p.s.pos.z) - m.heightAt(-1, p.s.pos.z)).toBeLessThan(0.05);
  });

  it('a one-step ledge is a bump, not a launch ramp, and creates no energy', () => {
    for (const v of [10, 20, 30]) {
      const p = new SkierPhysics(new Ledge(), null);
      p.reset(0, 0, 0, v);
      const r = probe(p, 2.5);
      // the old code launched off the riser's secant (≈ 53°) and created energy: vy 10.8 / 14.7 /
      // 10.7 m/s at 10 / 20 / 30 m/s. Now a hop (the riser's 0.2 m still has to go somewhere).
      expect(r.maxVy).toBeLessThan(0.5 * v);
      expect(r.maxStepGain).toBeLessThan(GRAVITY * TERRAIN_CONTACT.snapExcessTol + 0.05);
      expect(r.maxTakeoffGain).toBeLessThanOrEqual(1 + 1e-9);
      expect(r.maxAboveStart).toBeLessThan(0.3);
    }
  });

  it('a smooth quarter-pipe below the wall angle is still ridden, with energy conserved', () => {
    for (const deg of [30, 45]) {
      for (const v of [10, 20]) {
        const p = new SkierPhysics(new QuarterPipe(deg), null);
        p.reset(0, 0, 0, v);
        const y0 = p.s.pos.y;
        let peak = -Infinity;
        const r = probe(p, 5, () => {
          peak = Math.max(peak, p.s.pos.y);
          return NO_INPUT;
        });
        // climbs as high as before the fix (≈ half the ideal height: friction, drag, compressions) …
        expect(peak - y0, `${deg}° ${v}`).toBeCloseTo(({ '30,10': 2.362, '30,20': 10.054, '45,10': 2.483, '45,20': 10.857 } as Record<string, number>)[`${deg},${v}`]!, 2);
        // … but never higher than its kinetic energy allows
        expect(peak - y0, `${deg}° ${v}`).toBeLessThanOrEqual((v * v) / (2 * GRAVITY) + 0.05);
        expect(r.maxStepGain).toBeLessThan(GRAVITY * TERRAIN_CONTACT.snapExcessTol + 0.05);
        expect(crashes(r)).toEqual([]);
      }
    }
  });
});

describe('cave walls on real Alpine courses (Reviewer B r3 sweep, reduced)', () => {
  it('approaches toward the cave side never fly > 2 s or gain energy', () => {
    let runs = 0;
    let maxAir = 0;
    let maxVy = -Infinity;
    let maxAboveStart = -Infinity;
    let maxStep = -Infinity;
    let maxTk = 0;
    let wallCrashes = 0;
    for (const sd of ['B3F1', 'B3F5']) {
      const c0 = makeCourse('custom', 'sprint', { customText: sd });
      const m = buildMountain(c0);
      const ws = worldSeed(c0);
      for (const e of m.profile.encounters(-Infinity, m.finishZ)) {
        for (const dz0 of [-110, -80]) {
          for (const v0 of [12, 22, 32]) {
            for (const ang of [0.4, 0.8, 1.1]) {
              const z0 = e.caveZ + dz0;
              const p = new SkierPhysics(m, null, () => [], new BiomeEnvironment(m, ws));
              p.reset(m.routeX(z0) + 4, z0, ang, v0);
              const r = probe(p, 9, () => {
                const s = p.s;
                return { ...NO_INPUT, steer: clamp(-wrapAngle(ang - s.heading) * 3, -1, 1), tuck: s.speed > 7 ? 1 : 0, recover: s.crashTime > 1.4 };
              });
              runs++;
              maxAir = Math.max(maxAir, r.maxAir);
              maxVy = Math.max(maxVy, r.maxVy);
              maxAboveStart = Math.max(maxAboveStart, r.maxAboveStart);
              maxStep = Math.max(maxStep, r.maxStepGain);
              maxTk = Math.max(maxTk, r.maxTakeoffGain);
              wallCrashes += crashes(r).filter((c) => c === 'hit the cliff').length;
            }
          }
        }
      }
    }
    expect(runs).toBeGreaterThan(30);
    // before the fix this set flew up to 5.8 s with vy 91 m/s
    expect(maxAir).toBeLessThan(2);
    expect(maxVy).toBeLessThan(15);
    expect(maxAboveStart).toBeLessThan(0.3);
    expect(maxStep).toBeLessThan(GRAVITY * TERRAIN_CONTACT.snapExcessTol + 0.05);
    expect(maxTk).toBeLessThanOrEqual(1 + 1e-9);
    expect(wallCrashes).toBeGreaterThan(0); // the walls are walls
  });
});

describe('legitimate jumps are unchanged (values recorded before the fix)', () => {
  function jumps(p: SkierPhysics, seconds: number, input: () => SkierInput = () => NO_INPUT) {
    const out: Array<{ air: number; dist: number }> = [];
    let x0 = 0;
    let z0 = 0;
    for (let i = 0; i < seconds / PHYS_DT; i++) {
      p.step(input());
      for (const e of p.drainEvents()) {
        if (e.type === 'takeoff') {
          x0 = p.s.pos.x;
          z0 = p.s.pos.z;
        }
        if (e.type === 'land') out.push({ air: e.airTime, dist: Math.hypot(p.s.pos.x - x0, p.s.pos.z - z0) });
      }
    }
    return out;
  }
  it('synthetic kicker: airtime identical, distance within 0.1 %', () => {
    const before: Record<number, [number, number]> = { 8: [0.9417, 8.472], 12: [1.05, 11.656], 16: [1.1583, 14.991], 20: [1.3, 19.771], 25: [1.4667, 26.107], 30: [1.6583, 33.907] };
    for (const [v, [air, dist]] of Object.entries(before)) {
      const p = new SkierPhysics(new Kick(20), null);
      p.reset(0, 0, 0, Number(v));
      const j = jumps(p, 4);
      expect(j).toHaveLength(1);
      expect(j[0]!.air).toBeCloseTo(air, 3);
      expect(Math.abs(j[0]!.dist / dist - 1)).toBeLessThan(0.001);
    }
  });

  it('Alpine course kickers, rolled and popped, and roller pops match the pre-fix values', () => {
    const m = buildMountain(makeCourse('custom', 'sprint', { customText: 'EC1' }));
    const ks: Kicker[] = [];
    m.profile.kickersNear(0, m.finishZ, ks);
    const k = ks.find((q) => Math.round(q.z) === 105)!;
    expect(k).toBeTruthy();
    const ride = (v: number, pop: boolean) => {
      const z0 = k.z - Math.max(k.run, 12) - 6;
      const p = new SkierPhysics(m, null);
      p.reset(m.centerX(z0) + k.d, z0, 0, v);
      let popped = false;
      return jumps(p, 3.5, () => {
        const s = p.s;
        const err = wrapAngle(Math.atan2(m.centerX(s.pos.z + 10) + k.d - s.pos.x, 10) - s.heading);
        const i: SkierInput = { ...NO_INPUT, steer: clamp(-err * 3, -1, 1), tuck: 1 };
        if (pop && !popped && s.grounded) {
          if (k.z - s.pos.z > 0.6) i.pop = true;
          else popped = true;
        }
        return i;
      });
    };
    const want: Array<[number, boolean, number, number]> = [
      [16, false, 0.725, 10.392],
      [16, true, 1.4833, 21.177],
      [28, false, 0.9833, 23.626],
      [28, true, 1.725, 40.496],
    ];
    for (const [v, pop, air, dist] of want) {
      const j = ride(v, pop);
      expect(j).toHaveLength(1);
      expect(j[0]!.air).toBeCloseTo(air, 3);
      expect(j[0]!.dist).toBeCloseTo(dist, 2);
    }
    // rollers with pops on the crests (EC1 sprint, roller zone at z 1860)
    const p = new SkierPhysics(m, null);
    p.reset(m.routeX(1860), 1860, 0, 18);
    let t = 0;
    const j = jumps(p, 12, () => {
      t += PHYS_DT;
      const s = p.s;
      const err = wrapAngle(Math.atan2(m.routeX(s.pos.z + 15) - s.pos.x, 15) - s.heading);
      return { ...NO_INPUT, steer: clamp(-err * 3, -1, 1), tuck: 1, pop: Math.sin(t * 3) > 0.6, recover: s.crashTime > 1.4 };
    });
    expect(j.map((q) => +q.air.toFixed(4))).toEqual([1.0417, 0.8583, 1.0083, 1.2083, 1.8417]);
    expect(j.map((q) => +q.dist.toFixed(3))).toEqual([18.577, 16.422, 20.572, 25.233, 38.864]);
  });
});

describe('normal Alpine runs are bit-identical to before the fix', () => {
  // Every grounded/airborne step of these runs hashed (x, y, z, vy); values recorded on pass4 @303fa00
  // before the terrain-contact change. The wall/energy rules only act on terrain no normal run reaches.
  const f64 = new Float64Array(1);
  const u32 = new Uint32Array(f64.buffer);
  const mix = (h: number, x: number) => {
    f64[0] = x;
    h = Math.imul(h ^ u32[0]!, 0x9e3779b1) >>> 0;
    return Math.imul(h ^ u32[1]!, 0x85ebca6b) >>> 0;
  };
  const cases: Array<[string, AutopilotStyle, string, number]> = [
    ['EC1', 'skilled', '35375fc6', 149.108],
    ['EC1', 'average', 'cb29719a', 64.817],
    ['classic', 'skilled', 'e414dde2', 156.992],
  ];
  for (const [seed, style, hash, time] of cases) {
    it(`${seed} ${style}`, () => {
      let m: Mountain;
      let f: ObstacleField;
      if (seed === 'classic') ({ m, f } = worldFor());
      else {
        const c = makeCourse('custom', 'sprint', { customText: seed, difficulty: 'normal' });
        m = buildMountain(c);
        f = new ObstacleField(m, worldSeed(c));
      }
      let h = 0x811c9dc5;
      const res = simulateCourse(
        m,
        f,
        (s, t) => {
          h = mix(mix(mix(mix(h, s.pos.x), s.pos.y), s.pos.z), s.vel.y);
          return autopilotInput(m, s, style, t);
        },
        { streaming: seed !== 'classic', yetiSpeed: DIFFICULTY.normal.yetiSpeed, maxTime: 900 },
      );
      expect(+res.time.toFixed(3)).toBe(time);
      expect(h.toString(16)).toBe(hash);
    });
  }
});
