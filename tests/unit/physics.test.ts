import { describe, expect, it } from 'vitest';
import { SkierPhysics, PHYS_DT, NO_INPUT, DRIFT_MIN_SPEED, type SkierInput, type SkierEvent } from '../../src/physics/SkierPhysics';
import { Mountain, routeX } from '../../src/world/course';
import type { Obstacle, ObstacleField } from '../../src/physics/obstacles';
import { SpatialHash } from '../../src/physics/obstacles';

/** A flat-ish synthetic slope for controlled experiments. */
class Slope extends Mountain {
  constructor(private deg: number) {
    super(1);
  }
  override heightAt(_x: number, z: number) {
    return -Math.tan((this.deg * Math.PI) / 180) * z;
  }
  override surfaceWeights() {
    return { ice: 0, powder: 0, groomed: 1 };
  }
}

/** Slope with a ramp lip at z=lip, then a steep drop. */
class Kicker extends Mountain {
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

function run(phys: SkierPhysics, input: SkierInput, seconds: number, onEvent?: (e: SkierEvent) => void) {
  const n = Math.round(seconds / PHYS_DT);
  for (let i = 0; i < n; i++) {
    phys.step(input);
    for (const e of phys.drainEvents()) onEvent?.(e);
  }
}

const inp = (o: Partial<SkierInput>): SkierInput => ({ ...NO_INPUT, ...o });

let groundY: (z: number) => number = () => 0;
function fieldWith(...obs: Array<Partial<Obstacle> & Pick<Obstacle, 'kind' | 'x' | 'z'>>): ObstacleField {
  const list: Obstacle[] = obs.map((o, id) => ({ id, y: groundY(o.z), r: 0.4, softR: 0, height: 9, rot: 0, scale: 1, variant: 0, halfLen: 0, collidable: true, ...o }));
  const grid = new SpatialHash(8);
  for (const o of list) grid.insert(o);
  return { list, grid };
}

describe('skier physics', () => {
  it('gravity accelerates the skier down a slope', () => {
    const p = new SkierPhysics(new Slope(15), null);
    p.reset(0, 0, 0, 0);
    run(p, NO_INPUT, 3);
    // a ≈ g(sinθ − μcosθ) ≈ 2.1 m/s² minus drag → ≈ 6 m/s after 3 s
    expect(p.s.speed).toBeGreaterThan(5);
    expect(p.s.speed).toBeLessThan(7.5);
    expect(p.s.pos.z).toBeGreaterThan(7);
  });

  it('pizza (brake) reduces speed under otherwise identical conditions', () => {
    const a = new SkierPhysics(new Slope(15), null);
    const b = new SkierPhysics(new Slope(15), null);
    a.reset(0, 0, 0, 15);
    b.reset(0, 0, 0, 15);
    run(a, NO_INPUT, 3);
    run(b, inp({ brake: 1 }), 3);
    expect(b.s.speed).toBeLessThan(a.s.speed - 4);
  });

  it('pizza decelerates progressively but still allows turning', () => {
    const p = new SkierPhysics(new Slope(8), null);
    p.reset(0, 0, 0, 18);
    const speeds: number[] = [];
    for (let i = 0; i < 4; i++) {
      run(p, inp({ brake: 1, steer: 0.6 }), 0.5);
      speeds.push(p.s.speed);
    }
    for (let i = 1; i < speeds.length; i++) expect(speeds[i]!).toBeLessThan(speeds[i - 1]!);
    expect(Math.abs(p.s.heading)).toBeGreaterThan(0.3);
  });

  it('tucking improves downhill performance (higher speed, more distance)', () => {
    const a = new SkierPhysics(new Slope(18), null);
    const b = new SkierPhysics(new Slope(18), null);
    a.reset(0, 0, 0, 10);
    b.reset(0, 0, 0, 10);
    run(a, NO_INPUT, 12);
    run(b, inp({ tuck: 1 }), 12);
    expect(b.s.speed).toBeGreaterThan(a.s.speed * 1.15);
    expect(b.s.pos.z).toBeGreaterThan(a.s.pos.z);
  });

  it('speed is bounded (no infinite acceleration) and depends on slope', () => {
    const steep = new SkierPhysics(new Slope(25), null);
    const gentle = new SkierPhysics(new Slope(10), null);
    steep.reset(0, 0, 0, 0);
    gentle.reset(0, 0, 0, 0);
    run(steep, inp({ tuck: 1 }), 60);
    run(gentle, inp({ tuck: 1 }), 60);
    expect(steep.s.speed).toBeLessThan(40);
    expect(gentle.s.speed).toBeLessThan(steep.s.speed - 6);
  });

  it('tuck reduces steering authority', () => {
    const a = new SkierPhysics(new Slope(12), null);
    const b = new SkierPhysics(new Slope(12), null);
    a.reset(0, 0, 0, 20);
    b.reset(0, 0, 0, 20);
    run(a, inp({ steer: 1 }), 0.5);
    run(b, inp({ steer: 1, tuck: 1 }), 0.5);
    expect(Math.abs(b.s.heading)).toBeLessThan(Math.abs(a.s.heading) * 0.85);
  });

  it('steering changes heading consistently (sign and symmetry)', () => {
    const l = new SkierPhysics(new Slope(12), null);
    const r = new SkierPhysics(new Slope(12), null);
    l.reset(0, 0, 0, 12);
    r.reset(0, 0, 0, 12);
    run(l, inp({ steer: -1 }), 0.6);
    run(r, inp({ steer: 1 }), 0.6);
    expect(l.s.heading).toBeGreaterThan(0.2);
    expect(r.s.heading).toBeLessThan(-0.2);
    expect(Math.abs(l.s.heading + r.s.heading)).toBeLessThan(1e-6);
    // the travel direction follows the skis (carving)
    expect(r.s.vel.x).toBeLessThan(0);
  });

  it('turning is speed-dependent: wider turns at high speed', () => {
    const slow = new SkierPhysics(new Slope(1), null);
    const fast = new SkierPhysics(new Slope(1), null);
    slow.reset(0, 0, 0, 6);
    fast.reset(0, 0, 0, 28);
    run(slow, inp({ steer: 1 }), 0.4);
    run(fast, inp({ steer: 1 }), 0.4);
    expect(Math.abs(fast.s.heading)).toBeLessThan(Math.abs(slow.s.heading));
  });

  it('drift only activates above the speed threshold', () => {
    const slow = new SkierPhysics(new Slope(3), null);
    slow.reset(0, 0, 0, DRIFT_MIN_SPEED - 3);
    run(slow, inp({ drift: true, steer: 1 }), 0.5);
    expect(slow.s.drifting).toBe(false);
    const fast = new SkierPhysics(new Slope(3), null);
    fast.reset(0, 0, 0, DRIFT_MIN_SPEED + 8);
    run(fast, inp({ drift: true, steer: 1 }), 0.3);
    expect(fast.s.drifting).toBe(true);
    expect(fast.s.driftAmount).toBeGreaterThan(0.5);
  });

  it('drifting loses lateral grip, turns harder and bleeds speed, then recovers to carving', () => {
    const carve = new SkierPhysics(new Slope(3), null);
    const drift = new SkierPhysics(new Slope(3), null);
    carve.reset(0, 0, 0, 22);
    drift.reset(0, 0, 0, 22);
    run(carve, inp({ steer: 1 }), 0.8);
    run(drift, inp({ steer: 1, drift: true }), 0.8);
    expect(Math.abs(drift.s.heading)).toBeGreaterThan(Math.abs(carve.s.heading));
    expect(drift.s.speed).toBeLessThan(carve.s.speed);
    // sideways slip: velocity direction lags behind ski heading
    const travel = Math.atan2(drift.s.vel.x, drift.s.vel.z);
    expect(Math.abs(travel - drift.s.heading)).toBeGreaterThan(0.15);
    expect(drift.s.speed).toBeGreaterThan(10); // momentum preserved
    run(drift, inp({}), 1.0);
    expect(drift.s.drifting).toBe(false);
    expect(drift.s.driftAmount).toBeLessThan(0.1);
  });

  it('grip never adds energy (cannot coast uphill on edges)', () => {
    const m = new Slope(-10); // uphill
    const p = new SkierPhysics(m, null);
    p.reset(0, 0, 0.6, 20);
    let e0 = 0.5 * p.s.speed ** 2 + 9.81 * p.s.pos.y;
    for (let i = 0; i < 600; i++) {
      p.step(inp({ steer: Math.sin(i / 30) }));
      const e1 = 0.5 * p.s.speed ** 2 + 9.81 * p.s.pos.y;
      expect(e1).toBeLessThanOrEqual(e0 + 1e-6);
      e0 = e1;
    }
  });

  it('terrain launches the skier: velocity-based takeoff, parabolic flight, longer at speed', () => {
    const dists: number[] = [];
    for (const v0 of [12, 22]) {
      const p = new SkierPhysics(new Kicker(30), null);
      p.reset(0, 0, 0, v0);
      let air = 0;
      let takeoffZ = 0;
      let jump = 0;
      run(p, NO_INPUT, 6, (e) => {
        if (e.type === 'takeoff' && !takeoffZ) takeoffZ = p.s.pos.z;
        if (e.type === 'land' && !jump) {
          air = e.airTime;
          jump = p.s.pos.z - takeoffZ;
        }
      });
      expect(air).toBeGreaterThan(0.15);
      dists.push(jump);
    }
    // faster approach → longer jump
    expect(dists[1]!).toBeGreaterThan(dists[0]! * 1.4);
  });

  it('gravity governs flight: vertical velocity decreases at g while airborne', () => {
    const p = new SkierPhysics(new Kicker(20), null);
    p.reset(0, 0, 0, 22);
    let prevVy: number | null = null;
    let checked = 0;
    for (let i = 0; i < 600; i++) {
      p.step(NO_INPUT);
      p.drainEvents();
      if (!p.s.grounded) {
        if (prevVy !== null) {
          const dvy = (p.s.vel.y - prevVy) / PHYS_DT;
          // gravity plus a little quadratic air drag
          expect(dvy).toBeLessThan(-7.8);
          expect(dvy).toBeGreaterThan(-11.2);
          checked++;
        }
        prevVy = p.s.vel.y;
      } else prevVy = null;
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('pop is a single grounded jump (no double jumps in the air)', () => {
    const p = new SkierPhysics(new Slope(5), null);
    p.reset(0, 0, 0, 10);
    run(p, inp({ pop: true }), 0.3);
    let pops = 0;
    p.step(inp({ pop: false }));
    for (const e of p.drainEvents()) if (e.type === 'pop') pops++;
    expect(pops).toBe(1);
    expect(p.s.grounded).toBe(false);
    // holding and releasing again mid-air does nothing
    run(p, inp({ pop: true }), 0.15, (e) => e.type === 'pop' && pops++);
    run(p, inp({ pop: false }), 0.05, (e) => e.type === 'pop' && pops++);
    expect(pops).toBe(1);
  });

  it('landing impact responds to vertical velocity (soft vs hard vs crash)', () => {
    const land = (vy: number) => {
      const p = new SkierPhysics(new Slope(0.01), null);
      p.reset(0, 0, 0, 10);
      p.s.grounded = false;
      p.s.pos.y = 0.05;
      p.s.vel.set(0, vy, 10);
      let ev: SkierEvent | null = null;
      run(p, NO_INPUT, 0.2, (e) => {
        if (e.type === 'land' && !ev) ev = e;
      });
      return { ev: ev as unknown as Extract<SkierEvent, { type: 'land' }>, crashed: p.s.crashed };
    };
    const soft = land(-3);
    const hard = land(-8.5);
    const crash = land(-14);
    expect(soft.ev.hard).toBe(false);
    expect(hard.ev.hard).toBe(true);
    expect(hard.ev.impact).toBeGreaterThan(soft.ev.impact);
    expect(soft.crashed).toBe(false);
    expect(crash.crashed).toBe(true);
  });

  it('collision impulses vary by obstacle type and impact speed', () => {
    const hit = (kind: Obstacle['kind'], speed: number, extra: Partial<Obstacle> = {}) => {
      const f = fieldWith({ kind, x: 0, z: 6, r: kind === 'rock' ? 0.4 : 0.35, height: kind === 'rock' ? 0.5 : 9, ...extra });
      const p = new SkierPhysics(new Slope(0.01), f);
      p.reset(0, 0, 0, speed);
      const events: SkierEvent[] = [];
      run(p, NO_INPUT, 1.2, (e) => events.push(e));
      return { events, s: p.s };
    };
    const treeSlow = hit('tree', 3);
    const treeFast = hit('tree', 16);
    const rock = hit('rock', 10);
    expect(treeSlow.s.crashed).toBe(false);
    expect(treeFast.s.crashed).toBe(true);
    expect(treeFast.events.some((e) => e.type === 'crash')).toBe(true);
    expect(rock.s.crashed).toBe(false);
    expect(rock.events.some((e) => e.type === 'impact' && e.kind === 'rock-light')).toBe(true);
    // never passes through a solid trunk
    expect(treeFast.s.pos.z).toBeLessThan(6);
  });

  it('pizza can stop the skier on a typical 20° pitch', () => {
    const p = new SkierPhysics(new Slope(20), null);
    p.reset(0, 0, 0, 20);
    run(p, inp({ brake: 1 }), 12);
    expect(p.s.speed).toBeLessThan(1.5);
  });

  it('drift is a real tool: tighter heading change than carving at the same speed', () => {
    const carve = new SkierPhysics(new Slope(6), null);
    const drift = new SkierPhysics(new Slope(6), null);
    carve.reset(0, 0, 0, 20);
    drift.reset(0, 0, 0, 20);
    run(carve, inp({ steer: 1 }), 0.7);
    run(drift, inp({ steer: 1, drift: true }), 0.7);
    const travel = (p: SkierPhysics) => Math.atan2(p.s.vel.x, p.s.vel.z);
    // drift changes direction of travel noticeably faster, at a moderate speed cost
    expect(Math.abs(travel(drift))).toBeGreaterThan(Math.abs(travel(carve)) * 1.15);
    expect(drift.s.speed).toBeGreaterThan(carve.s.speed * 0.65);
  });

  it('a skier is never pinned against a trunk after crashing into it', () => {
    let stuck = 0;
    for (let k = 0; k < 10; k++) {
      const f = fieldWith({ kind: 'tree', x: (k - 5) * 0.08, z: 6, r: 0.35, height: 9 });
      const p = new SkierPhysics(new Slope(18), f);
      p.reset(0, 0, 0, 14);
      run(p, NO_INPUT, 1.0);
      expect(p.s.crashed).toBe(true);
      // recover, then just let gravity (and steering away) work
      run(p, NO_INPUT, 3.0); // auto get-up (no button)
      expect(p.s.crashed).toBe(false);
      run(p, inp({ steer: k % 2 ? 0.6 : -0.6 }), 0.4);
      run(p, NO_INPUT, 3);
      if (Math.hypot(p.s.pos.x - (k - 5) * 0.08, p.s.pos.z - 6) < 2.5) stuck++;
    }
    expect(stuck).toBe(0);
  });

  it('a skier never tunnels through a trunk at very high speed', () => {
    const f = fieldWith({ kind: 'tree', x: 0, z: 20, r: 0.3, height: 9 });
    const p = new SkierPhysics(new Slope(0.01), f);
    p.reset(0, 0, 0, 45);
    run(p, NO_INPUT, 1.5);
    expect(p.s.pos.z).toBeLessThan(20);
  });

  it('a fallen log can be cleared by jumping over it', () => {
    groundY = (z) => new Slope(3).heightAt(0, z);
    const f = fieldWith({ kind: 'log', x: 0, z: 8, r: 0.28, height: 0.55, rot: Math.PI / 2, halfLen: 3 });
    const blocked = new SkierPhysics(new Slope(3), f);
    blocked.reset(0, 0, 0, 9);
    run(blocked, NO_INPUT, 1.5);
    expect(blocked.s.pos.z).toBeLessThan(8.5);
    const jumper = new SkierPhysics(new Slope(3), f);
    jumper.reset(0, 0, 0, 9);
    run(jumper, inp({ pop: true }), 0.35);
    run(jumper, NO_INPUT, 1.5);
    expect(jumper.s.pos.z).toBeGreaterThan(9);
    groundY = () => 0;
  });

  it('crash recovery: available after a delay, restores control', () => {
    const f = fieldWith({ kind: 'tree', x: 0, z: 5, r: 0.35, height: 9 });
    const p = new SkierPhysics(new Slope(6), f);
    p.reset(0, 0, 0, 16);
    run(p, NO_INPUT, 0.6);
    expect(p.s.crashed).toBe(true);
    run(p, inp({ recover: true }), 0.2);
    expect(p.s.crashed).toBe(true); // too early
    run(p, NO_INPUT, 0.9);
    run(p, inp({ recover: true }), 0.05);
    expect(p.s.crashed).toBe(false);
  });

  it('is deterministic for identical inputs', () => {
    const m = new Mountain();
    const a = new SkierPhysics(m, null);
    const b = new SkierPhysics(m, null);
    a.reset(routeX(100), 100, 0, 10);
    b.reset(routeX(100), 100, 0, 10);
    for (let i = 0; i < 1200; i++) {
      const input = inp({ steer: Math.sin(i * 0.01), tuck: i % 300 > 150 ? 1 : 0 });
      a.step(input);
      b.step(input);
    }
    expect(a.s.pos.toArray()).toEqual(b.s.pos.toArray());
  });
});
