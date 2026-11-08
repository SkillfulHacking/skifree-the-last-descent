/**
 * Hard mode: the Yeti hurls snowballs during the chase.
 *
 * Pure simulation (no rendering), shared by the game and the headless balance runs.
 *  - Throws only while chasing, at mid range (the Yeti has to be behind and in sight).
 *  - Each throw is aimed at where the skier will be when it lands (their current velocity, with
 *    some spread), mostly in front of them, so the landing zone is a threat that can be read.
 *  - The landing zone is known from the moment of the throw: the game marks it on the snow, and a
 *    skier who changes line in the flight time (about 1.6–2.3 s) avoids it.
 *  - A direct hit staggers the skier hard (big speed loss, wobble), a near miss costs a little.
 *    Neither is an instant crash: the Yeti closing in is the punishment.
 */
import { Rng } from '../core/rng';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Snowball {
  readonly id: number;
  /** launch point */
  readonly from: Vec3;
  /** landing point (on the snow) */
  readonly to: Vec3;
  /** seconds since launch */
  t: number;
  /** flight time */
  readonly flight: number;
  /** arc apex height above the straight line */
  readonly arc: number;
}

export type SnowballEvent = { type: 'throw'; ball: Snowball } | { type: 'land'; ball: Snowball; hit: 'direct' | 'near' | 'miss'; distance: number };

export const SNOWBALL = {
  /** gap (along the course) at which the Yeti throws */
  minGap: 25,
  maxGap: 150,
  /** seconds of chase before the first throw */
  firstDelay: 3.5,
  cooldown: [4.5, 7.5] as [number, number],
  flight: [1.6, 2.3] as [number, number],
  /** radius of the marked zone (m): inside it is a direct hit */
  hitRadius: 2.2,
  /** near miss radius */
  nearRadius: 4.0,
  /** speed kept after a direct hit / near miss */
  directKeep: 0.45,
  nearKeep: 0.97,
  /** launch height above the Yeti's feet */
  launchY: 3.4,
} as const;

/** position of a ball at its current time (parabolic arc) */
export function ballPosition(b: Snowball, out: Vec3): Vec3 {
  const u = Math.min(1, b.t / b.flight);
  out.x = b.from.x + (b.to.x - b.from.x) * u;
  out.z = b.from.z + (b.to.z - b.from.z) * u;
  out.y = b.from.y + (b.to.y - b.from.y) * u + 4 * b.arc * u * (1 - u);
  return out;
}

export class SnowballBarrage {
  readonly balls: Snowball[] = [];
  private cool: number = SNOWBALL.firstDelay;
  private nextId = 1;
  private rng: Rng;
  hits = 0;
  nearMisses = 0;
  throws = 0;

  constructor(
    seed: number,
    private readonly groundY: (x: number, z: number) => number,
    private readonly inPiste: (x: number, z: number) => number = (x) => x,
  ) {
    this.rng = new Rng((seed ^ 0x5b0a11) >>> 0);
  }

  /** a new chase starts: first throw after a short grace period */
  reset() {
    this.balls.length = 0;
    this.cool = SNOWBALL.firstDelay;
  }

  /**
   * Advance by dt. `yeti` is the Yeti's feet, `skier` its position/velocity. `canThrow` gates new
   * throws (chase in progress, Yeti on the ground). Returns the events of this step.
   */
  update(dt: number, yeti: Vec3, skier: { pos: Vec3; vel: Vec3 }, canThrow: boolean, out: SnowballEvent[] = []): SnowballEvent[] {
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i]!;
      b.t += dt;
      if (b.t >= b.flight) {
        this.balls.splice(i, 1);
        const d = Math.hypot(skier.pos.x - b.to.x, skier.pos.z - b.to.z);
        const hit = d < SNOWBALL.hitRadius ? 'direct' : d < SNOWBALL.nearRadius ? 'near' : 'miss';
        if (hit === 'direct') this.hits++;
        else if (hit === 'near') this.nearMisses++;
        out.push({ type: 'land', ball: b, hit, distance: d });
      }
    }
    this.cool -= dt;
    const gap = skier.pos.z - yeti.z;
    if (canThrow && this.cool <= 0 && gap > SNOWBALL.minGap && gap < SNOWBALL.maxGap) {
      const r = this.rng;
      this.cool = r.range(SNOWBALL.cooldown[0], SNOWBALL.cooldown[1]);
      const flight = r.range(SNOWBALL.flight[0], SNOWBALL.flight[1]);
      // aim: where the skier will be, plus spread — mostly ahead, sometimes right on target
      const vx = skier.vel.x;
      const vz = skier.vel.z;
      const sp = Math.hypot(vx, vz) || 1;
      const lead = r.range(0.85, 1.05);
      const ahead = r.chance(0.35) ? 0 : r.range(2, 9);
      const side = r.range(-3, 3);
      let tx = skier.pos.x + vx * flight * lead + (vx / sp) * ahead + (vz / sp) * side;
      const tz = skier.pos.z + vz * flight * lead + (vz / sp) * ahead - (vx / sp) * side;
      tx = this.inPiste(tx, tz);
      const to = { x: tx, y: this.groundY(tx, tz), z: tz };
      const from = { x: yeti.x, y: yeti.y + SNOWBALL.launchY, z: yeti.z + 0.8 };
      const dist = Math.hypot(to.x - from.x, to.z - from.z);
      const ball: Snowball = { id: this.nextId++, from, to, t: 0, flight, arc: 6 + dist * 0.12 };
      this.balls.push(ball);
      this.throws++;
      out.push({ type: 'throw', ball });
    }
    return out;
  }
}

/** keep a landing point on the piste (the Yeti aims at the run, not the trees) */
export function clampToPiste(m: { centerX(z: number): number; halfWidth(z: number): number }, x: number, z: number): number {
  const c = m.centerX(z);
  const w = Math.max(4, m.halfWidth(z) - 4);
  return Math.min(c + w, Math.max(c - w, x));
}
