/**
 * Hazard-reading autopilot for headless balance tests: the same path follower as the 'skilled'
 * autopilot (src/debug/autopilot.ts), plus what a player who reads the Fjord would do:
 *  - goes round scoured rock that lies on the line (the short way round, inside the piste);
 *  - at a wind gate (round 4) picks a side of the outcrop by a wind policy (see `WindPolicy`);
 *  - takes off upwind of a kicker when its squall will blow while it is in the air;
 *  - takes alternate lines (ridgeline spines, gap jumps) when they are there.
 * It only uses information the game shows (hazard positions and the windsock's phase); the 'read'
 * policy also knows the squall cycle (a player who has learnt it), 'cue' only sees the windsock now.
 */
import { clamp, wrapAngle } from '../../src/core/rng';
import type { Mountain } from '../../src/world/course';
import type { SkierInput, SkierState } from '../../src/physics/SkierPhysics';
import type { BiomeEnvironment } from '../../src/world/capabilities/environment';
import { getHazardKind, hazardPhase, type HazardInstance, type HazardKind } from '../../src/world/hazards/hazard';
import { GATE, type GustParams } from '../../src/world/biomes/fjord/hazards';

/**
 * How the driver treats the wind:
 *  - read:   at each gate, predicts (from the known cycle) whether the gust will blow while it is
 *            in the notch → lee if so, notch otherwise; takes off upwind of a live jump squall;
 *  - cue:    a player without the cycle in their head: at the decision point (~1.5–2 s before the
 *            notch) takes the lee if the windsock is lifting or flying, the notch if it hangs limp;
 *  - ignore: wind-blind: the short way past the outcrop (the notch), no jump adjustment;
 *  - wrong:  the opposite of `read` (lee in the lull, notch in the gust; upwind take-off only in calm);
 *  - lee:    always the lee (and always an upwind take-off): the cautious fixed policy;
 *  - notch:  always the notch, holding upwind through a gust (round 3's counter) — the bold fixed policy.
 */
export type WindPolicy = 'read' | 'cue' | 'ignore' | 'wrong' | 'lee' | 'notch';

export interface ReaderOptions {
  /** go round rock on the line */
  rocks?: boolean;
  /** read the wind (true = 'read', false = 'ignore'); `wind` overrides */
  squalls?: boolean;
  wind?: WindPolicy;
  /** stand up out of the tuck inside a blowing squall */
  standUp?: boolean;
  /** take alternate lines */
  alts?: boolean;
  /** 'read': take the lee when the predicted mean gust weight in the notch exceeds this */
  threshold?: number;
  /** count the gate decisions here (tests, harness) */
  log?: Array<{ z: number; lee: boolean; gust: number }>;
}

const near: HazardInstance[] = [];
const smooth = (a: number, b: number, x: number) => {
  const u = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};
const gustW = (k: HazardKind, h: HazardInstance, t: number) => {
  const ph = hazardPhase(k, h, t);
  if (ph.phase === 'active') return Math.sin(Math.PI * Math.min(1, 0.15 + ph.u * 0.85));
  if (ph.phase === 'telegraph') return 0.25 * ph.u;
  if (ph.phase === 'recovery') return 0.3 * (1 - ph.u);
  return 0;
};
/** the decision point: this far before the outcrop's centre the driver commits to a side */
export const GATE_DECIDE = 70;

export function readerDriver(m: Mountain, env: BiomeEnvironment | null, o: ReaderOptions = { rocks: true, squalls: true, alts: true }) {
  const wind: WindPolicy = o.wind ?? (o.squalls === false ? 'ignore' : 'read');
  const theta = o.threshold ?? 0.3;
  const decided = new Map<number, boolean>();
  return (s: SkierState, t: number): SkierInput => {
    const speed = s.speed;
    const look = 7 + speed * 0.55;
    const tz = s.pos.z + look;
    const lineX = (z: number) => {
      if (o.alts) {
        const a = m.profile.altRouteX(z);
        if (a !== null) return a;
      }
      return m.routeX(z);
    };
    let tx = lineX(tz);
    let standUp = false;
    if (env) {
      env.hazards.ensure(s.pos.z - 1, s.pos.z + 120);
      env.hazards.near(s.pos.x, s.pos.z + 60, 90, near);
      const gates: Array<{ x: number; z: number }> = [];
      for (const h of near) {
        const G = h.kind === 'sea-gust' ? (h.params as GustParams).gate : undefined;
        if (G) gates.push(G);
      }
      for (const h of near) {
        if (h.kind === 'scoured-rock' && o.rocks) {
          if (h.z < s.pos.z - h.r - 2) continue;
          // a wind gate's outcrop: the gate branch below picks the side
          if (gates.some((g) => (Math.abs(g.x - h.x) < 0.01 && Math.abs(g.z - h.z) < 0.01) || Math.abs(g.z + GATE.rib - h.z) < 0.01)) continue;
          const lx = lineX(h.z);
          const clear = h.r + 1.6;
          if (Math.abs(lx - h.x) >= clear) continue;
          const a = h.x - clear;
          const b = h.x + clear;
          const w = m.halfWidth(h.z) - 2;
          const c = m.centerX(h.z);
          const ok = (x: number) => Math.abs(x - c) < w;
          const go = ok(a) && (!ok(b) || Math.abs(a - lx) <= Math.abs(b - lx)) ? a : b;
          // ease onto the way round early and back after it (a smooth line keeps the tuck)
          const wgt = smooth(h.z - h.r - 75, h.z - h.r - 20, tz) * (1 - smooth(h.z + h.r + 2, h.z + h.r + 30, tz));
          tx += (go - lx) * wgt;
        } else if (h.kind === 'sea-gust' && (h.params as GustParams).gate) {
          const G = (h.params as GustParams).gate!;
          if (!o.rocks && wind === 'ignore') continue;
          if (s.pos.z > G.z + G.r + 30 || tz < G.z - G.r - 60) continue;
          const k = getHazardKind(h.kind);
          let lee = decided.get(h.id);
          if (lee === undefined && s.pos.z >= G.z - GATE_DECIDE) {
            const v = Math.max(5, speed);
            const t0 = t + Math.max(0, (G.z - GATE.before - s.pos.z) / v);
            const t1 = t + Math.max(0, (G.z + G.r + GATE.after - s.pos.z) / v);
            let sum = 0;
            let n = 0;
            for (let u = t0; u <= t1 + 1e-6; u += 0.1, n++) sum += gustW(k, h, u);
            const gust = n ? sum / n : 0;
            const ph = hazardPhase(k, h, t).phase;
            const cue = ph === 'telegraph' || ph === 'active';
            lee = wind === 'read' ? gust > theta : wind === 'wrong' ? gust <= theta : wind === 'cue' ? cue : wind === 'lee';
            decided.set(h.id, lee);
            o.log?.push({ z: G.z, lee, gust });
          }
          if (lee === undefined) lee = wind === 'lee';
          const lx = lineX(G.z);
          let go = lee ? G.x + G.r + 1.5 : G.x - G.r - 1.5;
          // the bold fixed policy holds upwind (seaward) through a gust, within the obstacle-free lane
          if (!lee && wind === 'notch' && gustW(k, h, t) > 0.2) go = Math.max(m.routeX(G.z) - 7.2, G.x - G.r - 3.5);
          const wgt = smooth(G.z - G.r - 45, G.z - G.r - 12, tz) * (1 - smooth(G.z + G.r + 4, G.z + G.r + 25, tz));
          tx += (go - lx) * wgt;
          // in the notch while it blows: brace (stand up, edges set) — the bold policy always does
          const inside = s.pos.z > G.z - GATE.before - 8 && s.pos.z < G.z + G.r + GATE.after && s.pos.x < G.x;
          if ((o.standUp || (wind === 'notch' && !lee)) && inside && gustW(k, h, t + 0.3) > 0.3) standUp = true;
        } else if (h.kind === 'sea-gust' && ((h.params as GustParams).push ?? 0) > 0) {
          if (wind === 'ignore' || wind === 'notch') continue;
          // a squall over a jump: if it will blow while I am in the air, take off upwind (sea side)
          // of the kicker's centre so the gust carries me back over the landing instead of onto rock
          const lip = h.z - 7;
          if (s.pos.z > lip + 2 || tz < lip - 70) continue;
          const k = getHazardKind(h.kind);
          const tl = t + Math.max(0, (lip - s.pos.z) / Math.max(5, speed));
          let live = false;
          if (wind === 'cue') {
            const ph = hazardPhase(k, h, t).phase;
            live = ph === 'telegraph' || ph === 'active';
          } else for (let u = tl - 0.25; u <= tl + 1.0 && !live; u += 0.25) live = hazardPhase(k, h, u).phase === 'active';
          if (wind === 'wrong') live = !live;
          if (wind === 'lee') live = true;
          if (!live) continue;
          tx -= 2.8 * smooth(lip - 70, lip - 25, tz) * (1 - smooth(lip + 8, lip + 30, tz));
        } else if (h.kind === 'sea-gust' && (h.params as GustParams).slip && wind !== 'ignore') {
          // a plain squall lane (none are placed since round 4; kept for older layouts)
          if (s.pos.z > h.z + h.r + 4 || tz < h.z - h.r - 60) continue;
          const k = getHazardKind(h.kind);
          const t0 = t + Math.max(0, (h.z - h.r - s.pos.z) / Math.max(5, speed));
          const t1 = t + Math.max(0, (h.z + h.r - s.pos.z) / Math.max(5, speed));
          let live = false;
          for (let u = t0; u <= t1 + 1e-6 && !live; u += 0.25) live = hazardPhase(k, h, u).phase === 'active';
          if (!live) continue;
          tx -= 3.5 * smooth(h.z - h.r - 60, h.z - h.r - 15, tz) * (1 - smooth(h.z + h.r - 5, h.z + h.r + 15, tz));
        }
      }
    }
    const desired = Math.atan2(tx - s.pos.x, tz - s.pos.z);
    const err = wrapAngle(desired - s.heading);
    const steer = clamp(-err * 3.2, -1, 1);
    return { steer, tuck: !standUp && Math.abs(err) < 0.16 ? 1 : 0, brake: 0, drift: false, pop: false, recover: s.crashTime > 1.4 };
  };
}
