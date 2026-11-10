/**
 * Fjord Coast hazards (pure: no three.js). Registered before the biome (see ./index.ts).
 *
 * Every Fjord hazard asks the skier for a decision they can read in advance, and none of them can
 * knock the skier down or push them toward the sea:
 *
 *  - sea-gust: a squall funnelled off the fjord. Periodic: the windsock and spindrift build up for
 *    1.3 s (telegraph, with a rising whoosh and a caption), then the gust blows for 1.7 s.
 *    · Squall lanes: on exposed stretches of the racing line (ridgelines and cliffside runs most
 *      often, forest rarely) the gust also pushes a GROUNDED skier onshore (+X, away from the cliff)
 *      and loosens the edges a little. A skier who lets it carry them drifts ~4–5 m off the line —
 *      onto the scoured rock that lies downwind of every lane (see below). Hold an edge into the
 *      wind (steer toward the sea side), start the lane upwind, or time it for the lull.
 *    · Squalls over jumps and cliff drops push an AIRBORNE skier through the weather's airborne
 *      coupling (a few metres of drift on a big jump); wait for the lull or take off upwind.
 *  - scoured-rock: exposed, wind-scoured rock slabs and gravel with a skin of snow. Static, dark,
 *    visible from far away. Skis chatter and drag across it (it only ever costs speed, ~2–3 m/s
 *    through the core at racing speed). Three placements, all on the piste:
 *    · downwind of each squall lane (where a skier the gust carries off the line ends up);
 *    · across the racing line now and then: the fastest line clips the patch, and a clear way
 *      round it always stays inside the obstacle-free lane on the other side (choose: the shorter
 *      line over rock, or the few metres round it);
 *    · beside the line (scenery that matters only if you wander).
 *
 * The cliff edge itself is not a hazard instance: the cornice guard along the whole rim is part of
 * the Fjord surface model (./biome.ts), so it is continuous and can never be "reserved" away.
 */
import { Rng } from '../../../core/rng';
import { BAND, LANE_HALF } from '../../../physics/obstacles';
import type { CliffBand, Kicker, SegmentType } from '../../profile';
import { registerHazardKind, type HazardKind, type HazardPlacementContext, type HazardSpot } from '../../hazards/hazard';

export interface GustParams {
  /** peak extra crosswind (m/s, +X = onshore, toward the land), airborne coupling */
  wind: number;
  /** peak side-slip of a grounded skier (m/s, +X), 0 over jumps/drops */
  slip: number;
}

export interface RockParams {
  /** visual variant seed */
  v: number;
}

/** peak extra wind of a funnelled squall, m/s (acts on an airborne skier through the coupling) */
export const SEA_GUST_WIND = 9;
/** Scoured-rock cost at the core of a patch (× friction − 1, extra v² drag); mutable for tuning tests. */
export const ROCK = { friction: 5, drag: 0.012 };

/** Squall-lane tuning (mutable for tuning tests). */
export const SQUALL = {
  /** peak onshore side-slip of a grounded skier, m/s (× the edge factor, SkierPhysics SLIP_EDGE) */
  slip: 3,
};
/** footprint radius of a squall lane (it spans the piste around the racing line) */
export const SQUALL_LANE_R = 22;
/** squall lanes sit this far seaward of the racing line (the gust comes off the sea) */
const LANE_SEAWARD = 4;
/**
 * The rough core of the scoured rock downwind of a lane starts this far onshore of the racing line
 * (its thin outer edge comes within ~1 m of the line): a skier the gust carries 3–4 m lands in it.
 */
export const LEE_ROCK_INSET = 3;
/** the windsock pole stands at h.x − 0.6 r − 1.5 (views/hazardViews.ts); keep it off the lines */
const POLE_CLEAR = 4.5;

/** How exposed each segment type is to squalls off the sea (chance of a lane per 256 m band). */
const EXPOSURE: Partial<Record<SegmentType, number>> = {
  ridgeline: 0.85,
  cliffside: 0.7,
  highspeed: 0.55,
  alpine: 0.5,
  basin: 0.45,
  powder: 0.4,
  moguls: 0.3,
  beginner: 0.3,
  chute: 0.15,
  forest: 0.12,
  summit: 0,
  encounter: 0,
  checkpoint: 0,
  finish: 0,
};

export interface SquallLane {
  x: number;
  z: number;
  r: number;
  wind: number;
  slip: number;
}

const kTmp: Kicker[] = [];
const cTmp: CliffBand[] = [];

function poleClear(ctx: HazardPlacementContext, x: number, z: number, r: number): boolean {
  const m = ctx.mountain;
  const px = x - 0.6 * r - 1.5;
  const pz = z - 8;
  if (Math.abs(px - m.routeX(pz)) < POLE_CLEAR) return false;
  const alt = m.profile.altRouteX(pz);
  return alt === null || Math.abs(px - alt) >= POLE_CLEAR + 3;
}

/**
 * The squall lanes of one band (at most one): deterministic from (course seed, band) alone, so the
 * rock kind can place its lee patches against them without depending on the gust kind's RNG.
 */
export function squallLanes(ctx: HazardPlacementContext): SquallLane[] {
  const m = ctx.mountain;
  const P = m.profile;
  const rng = new Rng((ctx.seed ^ 0x5a11a1e5 ^ Math.imul(ctx.band + 911, 0x9e3779b1)) >>> 0);
  const z = ctx.z0 + rng.range(0.15, 0.85) * BAND;
  const roll = rng.float();
  const wind = SEA_GUST_WIND * rng.range(0.8, 1.0);
  const slip = SQUALL.slip * rng.range(0.9, 1.05);
  const exposure = Math.min(0.95, (EXPOSURE[P.segmentAt(z)] ?? 0.35) * 1.3 * Math.min(1.5, ctx.density));
  if (roll >= exposure) return [];
  // jumps and drops have their own (airborne) squalls; keep lanes off their run-ups and landings
  if (P.kickersNear(z - 45, z + 40, kTmp).length || P.cliffsNear(z - 40, z + 60, cTmp).length) return [];
  // not where an alternate line leaves or joins (the lee rock would sit on it)
  const alt = P.altRouteX(z);
  if (alt !== null) return [];
  const r = SQUALL_LANE_R;
  const x = m.routeX(z) - LANE_SEAWARD;
  if (ctx.reserved(x, z, r + 30)) return [];
  if (!poleClear(ctx, x, z, r)) return [];
  return [{ x, z, r, wind, slip }];
}

export const SEA_GUST: HazardKind<GustParams> = {
  id: 'sea-gust',
  label: 'Sea squall',
  severity: 'slow',
  timing: { kind: 'periodic', dormant: 3.6, telegraph: 1.3, active: 1.7, recovery: 0.9 },
  reach: 4,
  keepLaneClear: false,
  place(ctx) {
    const m = ctx.mountain;
    const out: Array<HazardSpot<GustParams>> = [];
    for (const L of squallLanes(ctx)) out.push({ x: L.x, z: L.z, r: L.r, params: { wind: L.wind, slip: L.slip } });
    // over the jumps of this band (kickers and cliff drops are the "gaps" a squall matters on)
    const kicks = m.profile.kickersNear(ctx.z0, ctx.z1, kTmp);
    for (const k of kicks) {
      if (k.z < ctx.z0 || k.z >= ctx.z1) continue;
      if (!ctx.rng.chance(0.55 * Math.min(1.5, ctx.density))) continue;
      const x = m.centerX(k.z) + k.d;
      const z = k.z + 7;
      if (ctx.reserved(x, z, 18) || !poleClear(ctx, x, z, 18)) continue;
      out.push({ x, z, r: 18, params: { wind: SEA_GUST_WIND * ctx.rng.range(0.8, 1.05), slip: 0 } });
    }
    for (const c of m.profile.cliffsNear(ctx.z0, ctx.z1, cTmp)) {
      if (c.z < ctx.z0 || c.z >= ctx.z1 || !ctx.rng.chance(0.6)) continue;
      const x = m.centerX(c.z) + (c.dMin + c.dMax) / 2;
      const z = c.z + 6;
      if (ctx.reserved(x, z, 20) || !poleClear(ctx, x, z, 20)) continue;
      out.push({ x, z, r: 20, params: { wind: SEA_GUST_WIND, slip: 0 } });
    }
    return out;
  },
  effect(h, ph, c) {
    if (c.dist > h.r + 4) return null;
    const edge = 1 - Math.max(0, (c.dist - h.r * 0.6) / (h.r * 0.4 + 4));
    let w: number;
    if (ph.phase === 'telegraph') w = 0.25 * ph.u;
    else if (ph.phase === 'active') w = Math.sin(Math.PI * Math.min(1, 0.15 + ph.u * 0.85));
    else if (ph.phase === 'recovery') w = 0.3 * (1 - ph.u);
    else return null;
    w *= edge;
    if (w <= 0) return null;
    if (!c.grounded || h.params.slip <= 0) return { windX: h.params.wind * w };
    return { windX: h.params.wind * w, slipX: h.params.slip * w };
  },
  audio: { telegraph: 'gust-build', active: 'gust-blow' },
  view: 'sea-gust',
};

export const SCOURED_ROCK: HazardKind<RockParams> = {
  id: 'scoured-rock',
  label: 'Wind-scoured rock',
  severity: 'slow',
  timing: { kind: 'static' },
  reach: 0,
  keepLaneClear: false,
  place(ctx) {
    const m = ctx.mountain;
    const P = m.profile;
    const out: Array<HazardSpot<RockParams>> = [];
    const onPiste = (x: number, z: number, r: number) => Math.abs(x - m.centerX(z)) <= m.halfWidth(z) - r * 0.5;
    const clearOfAlt = (x: number, z: number, r: number) => {
      const alt = P.altRouteX(z);
      return alt === null || Math.abs(x - alt) >= LANE_HALF + r;
    };
    // 1) the lee of each squall lane: where a skier the gust carries off the line ends up
    for (const L of squallLanes(ctx)) {
      const r = ctx.rng.range(5, 7);
      const z = L.z + ctx.rng.range(12, 22);
      const x = m.routeX(z) + LEE_ROCK_INSET + 0.55 * r;
      if (z >= ctx.z1 || !onPiste(x, z, r) || !clearOfAlt(x, z, r) || ctx.reserved(x, z, r)) continue;
      out.push({ x, z, r, rot: ctx.rng.range(0, Math.PI * 2), params: { v: ctx.rng.int(0, 7) } });
    }
    // 2) across the racing line now and then: the fast line clips the patch's core; the way round
    //    on the other side stays inside the obstacle-free lane (LANE_HALF + 1.5)
    //    (on a ridgeline with a spine, the piste is scoured to rock: always one, the spine is clean)
    const zMid = (ctx.z0 + ctx.z1) / 2;
    const ridge = P.segmentAt(zMid) === 'ridgeline' && P.altRoutes(zMid, zMid).some((a) => a.bow !== undefined);
    if (ctx.rng.chance((ridge ? 1 : 0.55) * Math.min(1.5, ctx.density))) {
      const z = ctx.z0 + ctx.rng.range(0.1, 0.9) * (ctx.z1 - ctx.z0);
      const r = ctx.rng.range(6.5, 8);
      const side = ctx.rng.chance(0.5) ? 1 : -1;
      // the line crosses the patch 0.45 r from its centre (the rough core); the far edge stays
      // ≥ LANE_HALF + 1.5 − 0.55 r ≈ 3 m inside the obstacle-free lane on the other side
      const x = m.routeX(z) + side * 0.45 * r;
      const lanes = [-1, 0, 1].flatMap((d) => squallLanes({ ...ctx, band: ctx.band + d, z0: ctx.z0 + d * BAND, z1: ctx.z1 + d * BAND }));
      const quiet = !P.kickersNear(z - 60, z + 40, kTmp).length && !P.cliffsNear(z - 40, z + 60, cTmp).length && !lanes.some((L) => Math.abs(L.z - z) < 70);
      if (quiet && onPiste(x, z, r) && clearOfAlt(x, z, r) && !ctx.reserved(x, z, r + 20)) out.push({ x, z, r, rot: ctx.rng.range(0, Math.PI * 2), params: { v: ctx.rng.int(0, 7) } });
    }
    // 3) beside the line (only matters if you wander)
    const n = Math.round(ctx.rng.range(0.3, 1.6) * ctx.density);
    for (let i = 0; i < n; i++) {
      const z = ctx.z0 + ctx.rng.range(0.08, 0.92) * (ctx.z1 - ctx.z0);
      const r = ctx.rng.range(5, 11);
      const side = ctx.rng.chance(0.5) ? 1 : -1;
      const x = m.routeX(z) + side * (LANE_HALF + 3 + r + ctx.rng.range(0, 18));
      if (!onPiste(x, z, r) || !clearOfAlt(x, z, r) || ctx.reserved(x, z, r)) continue;
      out.push({ x, z, r, rot: ctx.rng.range(0, Math.PI * 2), params: { v: ctx.rng.int(0, 7) } });
    }
    return out;
  },
  effect(h, _ph, c) {
    if (!c.inside || !c.grounded) return null;
    // the core of the patch is the roughest
    const k = 1 - Math.max(0, c.dist / Math.max(1, h.r) - 0.55) / 0.45;
    return { surface: { friction: 1 + ROCK.friction * k, grip: 1 - 0.25 * k, dragAdd: ROCK.drag * k } };
  },
  audio: { ambient: 'rock-scrape', hit: 'rock-scrape' },
  view: 'scoured-rock',
};

let registered = false;
/** Register the Fjord hazard kinds (idempotent). */
export function registerFjordHazards(): void {
  if (registered) return;
  registered = true;
  registerHazardKind(SEA_GUST);
  registerHazardKind(SCOURED_ROCK);
}
