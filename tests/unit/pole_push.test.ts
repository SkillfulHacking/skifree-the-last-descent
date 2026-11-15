/**
 * Ski-pole propulsion (Pass 6) on the Recover button: context (crashed → recover first, release
 * before pushing again), cadence, taper, no push in the air, no stacking with the skate assist or
 * with braking, and the same input from keyboard, gamepad and a remapped key.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, makeCourse } from '../../src/game/CourseConfig';
import { NO_INPUT, PHYS_DT, POLE, SkierPhysics, poleEffect, poleMean, skateMean, type SkierInput } from '../../src/physics/SkierPhysics';
import { DEFAULT_BINDINGS, Input, PAD, type PadLike } from '../../src/input/Input';
import { clamp, wrapAngle } from '../../src/core/rng';
import { polePower, POLE_PHASE } from '../../src/player/skier/pose';

const m = buildMountain(makeCourse('custom', 'sprint', { customText: 'POLE1' }));
/** level snow: the finish run-out (≈ 0.6°) */
const FLAT = m.finishZ + 400;

function skier(z = FLAT, v = 0): SkierPhysics {
  const p = new SkierPhysics(m, null);
  p.reset(m.routeX(z), z, 0, v);
  return p;
}
/** steer along the line and apply `inp` for `secs` seconds; returns the speeds sampled each step */
function run(p: SkierPhysics, inp: Partial<SkierInput> | ((i: number) => Partial<SkierInput>), secs: number): number[] {
  const out: number[] = [];
  const n = Math.round(secs / PHYS_DT);
  for (let i = 0; i < n; i++) {
    const s = p.s;
    const steer = clamp(-wrapAngle(Math.atan2(m.routeX(s.pos.z + 10) - s.pos.x, 10) - s.heading) * 3, -1, 1);
    const extra = typeof inp === 'function' ? inp(i) : inp;
    p.step({ ...NO_INPUT, steer, ...extra }, PHYS_DT);
    out.push(s.speed);
  }
  return out;
}
const last = (a: number[]) => a[a.length - 1]!;

describe('pole push: tuning', () => {
  it('matches the brief: full to 30 km/h, fading above 35, nothing from 55 km/h', () => {
    expect(POLE.full * 3.6).toBeCloseTo(30, 6);
    expect(POLE.zero * 3.6).toBeCloseTo(55, 6);
    expect(poleEffect(25 / 3.6)).toBe(1);
    expect(poleEffect(35 / 3.6)).toBeGreaterThan(0.85);
    expect(poleEffect(45 / 3.6)).toBeLessThan(0.6);
    expect(poleEffect(54 / 3.6)).toBeLessThan(0.02);
    expect(poleEffect(55 / 3.6)).toBe(0);
    expect(poleEffect(70 / 3.6)).toBe(0);
    // monotonic
    let prev = 1;
    for (let v = 0; v < 20; v += 0.1) {
      expect(poleEffect(v)).toBeLessThanOrEqual(prev + 1e-12);
      prev = poleEffect(v);
    }
    // the animation's power phase is the physics' power phase
    expect(POLE_PHASE.plant).toBe(POLE.plantAt);
    expect(POLE_PHASE.release).toBe(POLE.powerEnd);
    expect(polePower(0.1)).toBe(0);
    expect(polePower((POLE.plantAt + POLE.powerEnd) / 2)).toBeCloseTo(1, 6);
  });
});

describe('pole push: context and cadence', () => {
  it('a tap is one whole stroke; its push comes only in the power phase, and gradually', () => {
    const p = skier(FLAT, 0);
    const acc: number[] = [];
    run(p, (i) => ({ pole: i === 0 }), 0.01);
    expect(p.s.poleT).toBeGreaterThanOrEqual(0);
    expect(p.s.poleStrokes).toBe(1);
    const per = p.s.polePeriod;
    for (let i = 0; i < Math.round(2 / PHYS_DT); i++) {
      run(p, {}, PHYS_DT);
      acc.push(p.s.polePush);
    }
    expect(p.s.poleStrokes).toBe(1);
    expect(p.s.poleT).toBe(-1);
    const pushing = acc.map((a, i) => (a > 0 ? i * PHYS_DT : -1)).filter((t) => t >= 0);
    // inside the power window (plant → release) only; a stroke from rest starts with the hands
    // already part-way forward (POLE.firstStrokeAt): the push comes ~0.1 s after the press
    const start = POLE.firstStrokeAt * per;
    expect(Math.min(...pushing)).toBeGreaterThanOrEqual(POLE.plantAt * per - start - 0.02);
    expect(Math.min(...pushing)).toBeLessThan(0.16);
    expect(Math.max(...pushing)).toBeLessThanOrEqual(POLE.powerEnd * per - start + 0.02);
    // never an instantaneous jump: the largest one-step speed change is small
    expect(Math.max(...acc) * PHYS_DT).toBeLessThan(0.06);
    // one stroke from a standstill on level snow: well under 1 m/s
    expect(p.s.speed).toBeGreaterThan(0.25);
    expect(p.s.speed).toBeLessThan(1.0);
  });

  it('holding repeats strokes at the cadence, never faster', () => {
    const p = skier(FLAT, 0);
    const starts: number[] = [];
    let n = 0;
    run(p, (i) => {
      if (p.s.poleStrokes > n) {
        n = p.s.poleStrokes;
        starts.push(i * PHYS_DT);
      }
      return { pole: true };
    }, 6);
    expect(starts.length).toBeGreaterThanOrEqual(6);
    expect(starts.length).toBeLessThanOrEqual(9);
    for (let k = 1; k < starts.length; k++) expect(starts[k]! - starts[k - 1]!).toBeGreaterThanOrEqual(POLE.period[1] - 1e-6);
  });

  it('recovery has priority; a button held through the recovery pushes only after it is released and pressed again', () => {
    const p = skier(FLAT, 4);
    p.forceCrash('test');
    // hold the button the whole time: it gets the skier up (crashTime > 1) …
    let recovered = false;
    run(p, (i) => {
      const s = p.s;
      if (!s.crashed && !recovered) recovered = true;
      return { pole: true, recover: s.crashTime > 1.05 && i % 2 === 0 };
    }, 4);
    expect(recovered).toBe(true);
    expect(p.s.crashed).toBe(false);
    // … but no stroke started while down, getting up, or after it with the button still held
    expect(p.s.poleStrokes).toBe(0);
    // release, then press: a stroke
    run(p, { pole: false }, 0.1);
    run(p, { pole: true }, 0.05);
    expect(p.s.poleStrokes).toBe(1);
  });

  it('a fresh press re-arms even if the release fell between two frames (slow frame rates)', () => {
    const p = skier(FLAT, 3);
    p.forceCrash('test');
    run(p, () => ({ pole: true, recover: p.s.crashTime > 1.05 }), 3);
    expect(p.s.crashed).toBe(false);
    expect(p.s.poleStrokes).toBe(0);
    // the game saw the button held on both frames, but a new press edge came in between
    run(p, (i) => ({ pole: true, polePressed: i === 0 }), 0.1);
    expect(p.s.poleStrokes).toBe(1);
  });

  it('no stroke while crashed or getting up, even on a fresh press', () => {
    const p = skier(FLAT, 4);
    p.forceCrash('test');
    run(p, { pole: true }, 0.5);
    run(p, { pole: false }, 0.1);
    run(p, { pole: true }, 0.3);
    expect(p.s.crashed).toBe(true);
    expect(p.s.poleStrokes).toBe(0);
    p.recover();
    expect(p.s.recoverTime).toBeGreaterThan(0);
    run(p, (i) => ({ pole: i % 6 < 3 }), 0.4);
    expect(p.s.poleStrokes).toBe(0);
  });

  it('no push while airborne', () => {
    const p = skier(FLAT, 3);
    p.s.pos.y += 1.5;
    p.s.grounded = false;
    p.s.vel.y = 2;
    const v0 = Math.hypot(p.s.vel.x, p.s.vel.z);
    for (let i = 0; i < 40 && !p.s.grounded; i++) {
      p.step({ ...NO_INPUT, pole: true }, PHYS_DT);
      expect(p.s.polePush).toBe(0);
    }
    expect(p.s.poleStrokes).toBe(0);
    expect(Math.hypot(p.s.vel.x, p.s.vel.z)).toBeLessThanOrEqual(v0 + 1e-6);
  });

  it('a button held without poling (not yet released after getting up) is not "trying to move" for the pin rescue', () => {
    // off the piste on level snow, facing the piste, the button held through a crash and the get-up
    const p = new SkierPhysics(m, null);
    const x = m.routeX(FLAT) + 30;
    p.reset(x, FLAT, -Math.PI / 2, 2);
    p.forceCrash('test');
    let relocated = 0;
    for (let i = 0; i < Math.round(9 / PHYS_DT); i++) {
      p.step({ ...NO_INPUT, pole: true, recover: p.s.crashTime > 1.2 }, PHYS_DT);
      for (const e of p.drainEvents()) if (e.type === 'relocate') relocated++;
    }
    expect(p.s.poleStrokes).toBe(0);
    expect(relocated).toBe(0);
  });

  it('a stroke whose plant comes in the air is dropped (no push on landing without a plant)', () => {
    const p = skier(FLAT, 3);
    run(p, (i) => ({ pole: i === 0 }), 0.02);
    expect(p.s.poleT).toBeGreaterThanOrEqual(0);
    p.s.pos.y += 1.2;
    p.s.grounded = false;
    p.s.vel.y = 3;
    let pushed = 0;
    for (let i = 0; i < 240; i++) {
      p.step({ ...NO_INPUT }, PHYS_DT);
      if (p.s.polePush > 0) pushed++;
    }
    expect(p.s.poleT).toBe(-1);
    expect(pushed).toBe(0);
  });

  it('a planted stroke that leaves the snow for more than a hop is dropped; a tiny hop keeps it', () => {
    const plantThen = (air: number) => {
      const p = skier(FLAT, 3);
      // run until just after the plant
      let i = 0;
      while (p.s.poleT < 0 || p.s.poleT / p.s.polePeriod < POLE.plantAt + 0.01) {
        p.step({ ...NO_INPUT, pole: i++ === 0 }, PHYS_DT);
        if (i > 400) throw new Error('no plant');
      }
      p.s.grounded = false;
      p.s.airTime = 0;
      p.s.pos.y += 2;
      p.s.vel.y = 0;
      const n = Math.round(air / PHYS_DT);
      for (let k = 0; k < n; k++) p.step({ ...NO_INPUT }, PHYS_DT);
      return p.s.poleT;
    };
    expect(plantThen(0.25)).toBe(-1);
    expect(plantThen(0.05)).toBeGreaterThanOrEqual(0);
  });

  it('releasing between strokes never beats holding, with or without the tuck (physics reviews r2, r3)', () => {
    // the exploit: press again only after the poles have been idle k steps (the button is up between
    // strokes, the skate pushes meanwhile if the tuck is held) — keyed on the idle time, not on the
    // stroke ending (a held button starts the next stroke in the same step)
    const dist = (z: number, v: number, inp: (p: SkierPhysics) => Partial<SkierInput>) => {
      const p = skier(z, v);
      const z0 = p.s.pos.z;
      run(p, () => inp(p), 10);
      return p.s.pos.z - z0;
    };
    const STEEP = 200; // the upper course
    for (const [z, v] of [[FLAT, 0], [FLAT, 3], [STEEP, 0]] as const)
      for (const tuck of [0, 1]) {
        const best = Math.max(dist(z, v, () => ({ pole: true, tuck })), dist(z, v, () => ({ tuck })), dist(z, v, () => ({ pole: true })));
        for (const k of [1, 2, 4, 12, 30, 36, 37, 40, 60, 90]) {
          let idle = 0;
          const d = dist(z, v, (p) => {
            idle = p.s.poleT >= 0 ? 0 : idle + 1;
            return { pole: p.s.poleT < 0 && idle >= k, tuck };
          });
          expect(d, `z ${z} v ${v} tuck ${tuck} idle ${k}`).toBeLessThanOrEqual(best * 1.002 + 0.02);
        }
        for (const [on, per] of [[1, 62], [6, 50], [84, 96], [70, 110], [6, 12]]) {
          let i = 0;
          const r = dist(z, v, () => ({ pole: i++ % per < on, tuck }));
          expect(r, `z ${z} v ${v} tuck ${tuck} tap ${on}/${per}`).toBeLessThanOrEqual(best * 1.002 + 0.02);
        }
      }
  });

  it('a crash right after a stroke: the first stroke after getting up still gets its head start', () => {
    const p = skier(FLAT, 3);
    let i = 0;
    while (p.s.poleStrokes < 1 || p.s.poleT >= 0) {
      p.step({ ...NO_INPUT, pole: i++ < 5 }, PHYS_DT);
      if (i > 600) throw new Error('no stroke');
    }
    p.forceCrash('test');
    run(p, (k) => ({ recover: k === 150 }), 3);
    expect(p.s.crashed).toBe(false);
    run(p, () => ({}), 0.05); // released
    p.step({ ...NO_INPUT, pole: true, polePressed: true }, PHYS_DT);
    expect(p.s.poleT).toBeGreaterThan(POLE.firstStrokeAt * POLE.period[1] - 1e-9);
  });

  it('is deterministic at the fixed step', () => {
    const a = skier(FLAT, 2);
    const b = skier(FLAT, 2);
    const pattern = (i: number) => ({ pole: i % 97 < 70, tuck: i % 300 < 150 ? 1 : 0 });
    const sa = run(a, pattern, 8);
    const sb = run(b, pattern, 8);
    expect(sa).toEqual(sb);
    expect(a.s.pos.toArray()).toEqual(b.s.pos.toArray());
  });
});

describe('pole push: physics', () => {
  it('accelerates a grounded skier on level snow, gradually, toward a modest pace', () => {
    const none = run(skier(), {}, 15);
    const pole = run(skier(), { pole: true }, 15);
    expect(last(none)).toBeLessThan(0.1);
    // after 1 s: still slow; after 15 s: a jogging-to-cycling pace, below the cutoff
    expect(pole[Math.round(1 / PHYS_DT)]!).toBeLessThan(2);
    expect(last(pole)).toBeGreaterThan(5);
    expect(last(pole)).toBeLessThan(POLE.zero * 0.75);
  });

  it('each stroke gives less as the speed rises, and nothing above the cutoff', () => {
    // one stroke's speed gain at different entry speeds, against the same run without it (gentle snow)
    const gain = (v: number) => {
      const a = skier(FLAT, v);
      const b = skier(FLAT, v);
      run(a, (i) => ({ pole: i === 0 }), 1.2);
      run(b, {}, 1.2);
      return a.s.speed - b.s.speed;
    };
    const g = [2, 8, 11, 13.5, 15, 16].map(gain);
    expect(g[0]!).toBeGreaterThan(0.5);
    expect(g[1]!).toBeGreaterThan(0.5);
    expect(g[2]!).toBeLessThan(g[1]!);
    expect(g[3]!).toBeLessThan(g[2]!);
    expect(g[4]!).toBeLessThan(0.08);
    expect(g[5]!).toBeCloseTo(0, 6);
    // and above the cutoff no stroke even starts
    const p = skier(FLAT, POLE.zero + 0.5);
    run(p, { pole: true }, 0.2);
    expect(p.s.poleStrokes).toBe(0);
  });

  it('gravity may carry the skier past the cutoff; the poles never do', () => {
    // a steep pitch: gravity takes the skier well past 55 km/h with the button held
    const enc = m.profile.encounters(0, m.finishZ)[0]!;
    const z = enc.caveZ + 90; // ~18°
    const p = skier(z, 14);
    let pushedAbove = 0;
    const speeds = run(p, () => {
      if (p.s.speed > POLE.zero && p.s.polePush > 0) pushedAbove++;
      return { pole: true };
    }, 10);
    expect(Math.max(...speeds)).toBeGreaterThan(POLE.zero + 1);
    expect(pushedAbove).toBe(0);
  });

  it('makes a modest uphill possible but slow, not trivial', () => {
    // walk the finish run-out backwards (it rises the other way): a ~1–3° climb
    const p = new SkierPhysics(m, null);
    p.reset(m.routeX(FLAT), FLAT, Math.PI, 0);
    for (let i = 0; i < Math.round(10 / PHYS_DT); i++) p.step({ ...NO_INPUT, pole: true }, PHYS_DT);
    expect(p.s.speed).toBeLessThan(POLE.full);
  });

  it('pizza + poles is no exploit: the wedge eats the push', () => {
    const pole = last(run(skier(), { pole: true }, 8));
    const both = last(run(skier(), { pole: true, brake: 1 }, 8));
    expect(both).toBeLessThan(pole * 0.15 + 0.05);
  });

  it('tuck + poles never stack: one technique at a time, the better one for the speed and snow', () => {
    for (const z of [FLAT, m.profile.encounters(0, m.finishZ)[0]!.caveZ - 40]) {
      const p = skier(z);
      let both = 0;
      let skate = 0;
      let pole = 0;
      run(p, () => {
        if (p.s.skateAccel > 0 && p.s.polePush > 0) both++;
        if (p.s.skateAccel > 0) skate++;
        if (p.s.polePush > 0) pole++;
        return { pole: true, tuck: 1 };
      }, 12);
      expect(both).toBe(0);
      // from rest the skate gets going first, then the poles take over
      expect(skate).toBeGreaterThan(0);
      expect(pole).toBeGreaterThan(0);
      // the choice follows the mean push: skate below the crossover, poles above it
      const cross = [...Array(70).keys()].map((i) => i * 0.1).find((v) => poleMean(v, 1) >= skateMean(v, 1))!;
      expect(cross).toBeGreaterThan(1);
      expect(cross).toBeLessThan(4);
    }
  });

  it('holding both at speed costs (almost) nothing against tucking: near the cutoff a stroke stays crouched', () => {
    const enc = m.profile.encounters(0, m.finishZ)[0]!;
    const z = enc.caveZ + 60;
    const tuck = last(run(skier(z, 11), { tuck: 1 }, 6));
    const both = last(run(skier(z, 11), { tuck: 1, pole: true }, 6));
    expect(both).toBeGreaterThan(tuck - 0.6);
  });

  it('ice and powder bite less than packed snow', () => {
    // real places on the course with each surface under the skis; one stroke from the same speed
    const peak: Partial<Record<string, number>> = {};
    for (let z = 300; z < m.finishZ - 300 && Object.keys(peak).length < 3; z += 7)
      for (let dx = -40; dx <= 40; dx += 4) {
        const x = m.routeX(z) + dx;
        const k = m.surfaceAt(x, z);
        if (peak[k] !== undefined || (k !== 'ice' && k !== 'powder' && k !== 'packed')) continue;
        const p = new SkierPhysics(m, null);
        p.reset(x, z, 0, 3);
        let mx = 0;
        for (let i = 0; i < 90; i++) {
          p.step({ ...NO_INPUT, pole: i === 0 }, PHYS_DT);
          if (p.s.surface === k) mx = Math.max(mx, p.s.polePush);
        }
        if (mx > 0) peak[k] = mx;
      }
    expect(peak.packed).toBeGreaterThan(0);
    expect(peak.ice!).toBeLessThan(peak.packed! * 0.7);
    expect(peak.powder!).toBeLessThan(peak.packed! * 0.85);
  });
});

/** Minimal window stand-in with event dispatch. */
class FakeWindow {
  private l = new Map<string, Array<(e: unknown) => void>>();
  addEventListener(t: string, fn: (e: unknown) => void) {
    (this.l.get(t) ?? this.l.set(t, []).get(t)!).push(fn);
  }
  fire(t: string, e: object) {
    for (const fn of this.l.get(t) ?? []) fn({ preventDefault() {}, repeat: false, ...e });
  }
}
function pad(y: boolean): PadLike {
  const buttons = Array.from({ length: 17 }, () => ({ value: 0, pressed: false }));
  buttons[PAD.Y] = { value: y ? 1 : 0, pressed: y };
  return { id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)', connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons };
}
const settings = () => ({ deadzone: 0.15, steerSensitivity: 1, cameraSensitivity: 1, invertCameraX: false, invertCameraY: false, bindings: structuredClone(DEFAULT_BINDINGS) });

describe('pole push: input', () => {
  beforeEach(() => {
    (globalThis as unknown as { document: object }).document = { pointerLockElement: null };
  });

  it('keyboard R and controller Y give the same press and hold', () => {
    const w = new FakeWindow();
    const inp = new Input(settings(), w as unknown as Window);
    inp.padSource = () => [];
    w.fire('keydown', { code: 'KeyR' });
    inp.poll();
    let g = inp.gameplay(1 / 60);
    expect(g.recoverPressed).toBe(true);
    expect(g.recoverHeld).toBe(true);
    g = inp.gameplay(1 / 60);
    expect(g.recoverPressed).toBe(false);
    expect(g.recoverHeld).toBe(true);
    w.fire('keyup', { code: 'KeyR' });
    expect(inp.gameplay(1 / 60).recoverHeld).toBe(false);

    const w2 = new FakeWindow();
    const inp2 = new Input(settings(), w2 as unknown as Window);
    let held = true;
    inp2.padSource = () => [pad(held)];
    inp2.poll();
    g = inp2.gameplay(1 / 60);
    expect(g.recoverPressed).toBe(true);
    expect(g.recoverHeld).toBe(true);
    inp2.poll();
    g = inp2.gameplay(1 / 60);
    expect(g.recoverPressed).toBe(false);
    expect(g.recoverHeld).toBe(true);
    held = false;
    inp2.poll();
    expect(inp2.gameplay(1 / 60).recoverHeld).toBe(false);
  });

  it('a tap shorter than a frame still counts as held for that frame (one stroke at low frame rates)', () => {
    const w = new FakeWindow();
    const inp = new Input(settings(), w as unknown as Window);
    inp.padSource = () => [];
    w.fire('keydown', { code: 'KeyR' });
    w.fire('keyup', { code: 'KeyR' });
    inp.poll();
    const g = inp.gameplay(1 / 60);
    expect(g.recoverPressed).toBe(true);
    expect(g.recoverHeld).toBe(true);
    expect(inp.gameplay(1 / 60).recoverHeld).toBe(false);
  });

  it('a remapped Recover key drives both recovering and poling; the old key does nothing', () => {
    const w = new FakeWindow();
    const s = settings();
    s.bindings.recover = ['KeyF'];
    const inp = new Input(s, w as unknown as Window);
    inp.padSource = () => [];
    w.fire('keydown', { code: 'KeyR' });
    inp.poll();
    let g = inp.gameplay(1 / 60);
    expect(g.recoverPressed || g.recoverHeld).toBe(false);
    w.fire('keydown', { code: 'KeyF' });
    inp.poll();
    g = inp.gameplay(1 / 60);
    expect(g.recoverPressed).toBe(true);
    expect(g.recoverHeld).toBe(true);
  });
});
