/**
 * Hard mode: the Yeti hurls snowballs during the chase.
 *
 * Pure simulation (no rendering), shared by the game and the headless balance runs.
 *  - Throws only while chasing, at mid range (the Yeti has to be behind and in sight).
 *  - Each throw is aimed at where the skier will be when it lands (their current velocity, with
 *    some spread), mostly in front of them, so the landing zone is a threat that can be read.
 *  - The landing zone is known from the moment of the throw: the game marks it on the snow, and a
 *    skier who changes line in the flight time (about 1.6–2.3 s) avoids it.
 *  - A throw starts with a wind-up (the Yeti scoops the ball and draws its arm back); the ball
 *    leaves the hand, and the landing zone is fixed, at the release.
 *  - The ball is dangerous for the last moments of its fall and the splash just after it: a skier
 *    who is inside the zone at any point in that window is hit, so cutting through the circle as it
 *    comes down is a hit, not just being in it at the exact instant of impact.
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
  /** closest the skier came to the zone centre inside the danger window */
  minD: number;
  landed: boolean;
}

export type SnowballEvent =
  | { type: 'windup' }
  | { type: 'throw'; ball: Snowball }
  | { type: 'land'; ball: Snowball }
  | { type: 'hit'; ball: Snowball; hit: 'direct' | 'near' | 'miss'; distance: number };

export const SNOWBALL = {
  /** gap (along the course) at which the Yeti throws */
  minGap: 25,
  maxGap: 150,
  /** seconds of chase before the first throw */
  firstDelay: 3.5,
  cooldown: [5.5, 9] as [number, number],
  flight: [1.6, 2.3] as [number, number],
  /** radius of the marked zone (m): inside it is a direct hit */
  hitRadius: 2.2,
  /** near miss radius */
  nearRadius: 4.0,
  /** speed kept after a direct hit / near miss */
  directKeep: 0.55,
  nearKeep: 0.97,
  /** wobble from a direct hit / a near miss */
  directWobble: 1,
  nearWobble: 0.15,
  /** launch height above the Yeti's feet (headless; the game launches from the hand) */
  launchY: 3.0,
  /** wind-up before the release (s) */
  windup: 0.42,
  /** the ball is dangerous for this long before it lands… */
  dangerBefore: 0.45,
  /** …and the splash for this long after */
  dangerAfter: 0.15,
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
  /** time left in a wind-up, or -1 */
  private winding = -1;
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
    this.winding = -1;
  }

  /** a throw is being wound up */
  get windingUp(): boolean {
    return this.winding >= 0;
  }

  /**
   * Advance by dt. `yeti` is the Yeti's feet, `skier` its position/velocity. `canThrow` gates new
   * throws (chase in progress, Yeti on the ground). Returns the events of this step.
   */
  update(
    dt: number,
    yeti: Vec3,
    skier: { pos: Vec3; vel: Vec3 },
    canThrow: boolean,
    out: SnowballEvent[] = [],
    /** where the ball leaves the hand (the game passes the Yeti's hand); default: above the Yeti */
    launch?: Vec3,
  ): SnowballEvent[] {
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i]!;
      b.t += dt;
      if (b.t >= b.flight - SNOWBALL.dangerBefore) b.minD = Math.min(b.minD, Math.hypot(skier.pos.x - b.to.x, skier.pos.z - b.to.z));
      if (!b.landed && b.t >= b.flight) {
        b.landed = true;
        out.push({ type: 'land', ball: b });
      }
      if (b.t >= b.flight + SNOWBALL.dangerAfter) {
        this.balls.splice(i, 1);
        const d = b.minD;
        const hit = d < SNOWBALL.hitRadius ? 'direct' : d < SNOWBALL.nearRadius ? 'near' : 'miss';
        if (hit === 'direct') this.hits++;
        else if (hit === 'near') this.nearMisses++;
        out.push({ type: 'hit', ball: b, hit, distance: d });
      }
    }
    this.cool -= dt;
    const gap = skier.pos.z - yeti.z;
    if (this.winding >= 0) {
      this.winding -= dt;
      if (this.winding < 0) this.release(yeti, skier, launch, out);
    } else if (canThrow && this.cool <= 0 && gap > SNOWBALL.minGap && gap < SNOWBALL.maxGap) {
      this.cool = this.rng.range(SNOWBALL.cooldown[0], SNOWBALL.cooldown[1]);
      this.winding = SNOWBALL.windup;
      out.push({ type: 'windup' });
    }
    return out;
  }

  private release(yeti: Vec3, skier: { pos: Vec3; vel: Vec3 }, launch: Vec3 | undefined, out: SnowballEvent[]) {
    {
      const r = this.rng;
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
      const from = launch ? { x: launch.x, y: launch.y, z: launch.z } : { x: yeti.x, y: yeti.y + SNOWBALL.launchY, z: yeti.z + 0.8 };
      const dist = Math.hypot(to.x - from.x, to.z - from.z);
      const ball: Snowball = { id: this.nextId++, from, to, t: 0, flight, arc: 6 + dist * 0.12, minD: Infinity, landed: false };
      this.balls.push(ball);
      this.throws++;
      out.push({ type: 'throw', ball });
    }
  }
}

/**
 * keep a landing point on the piste (the Yeti aims at the run, not the trees); on a coast, also on
 * the land side of the cliff rim (which can run inside the piste's half-width on the sea side), so
 * no landing marker is drawn on the cornice or over the drop
 */
export function clampToPiste(m: { centerX(z: number): number; halfWidth(z: number): number; coast?: { rimX(z: number): number } | null }, x: number, z: number): number {
  const c = m.centerX(z);
  const w = Math.max(4, m.halfWidth(z) - 4);
  let lo = c - w;
  const hi = c + w;
  if (m.coast) lo = Math.min(hi, Math.max(lo, m.coast.rimX(z) + 10));
  return Math.min(hi, Math.max(lo, x));
}
