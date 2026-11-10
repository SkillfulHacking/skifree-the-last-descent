/**
 * Fjord Coast hazards (pure: no three.js). Registered before the biome (see ./index.ts).
 *
 *  - sea-gust: a squall funnelled off the fjord across a jump or a cliff drop. Periodic: the
 *    spindrift streamers build up for 1.3 s (telegraph, with a rising whoosh), then the gust blows
 *    for 1.7 s. It only acts on an AIRBORNE skier (the crosswind adds to the weather's wind through
 *    the airborne coupling): grounded skiing is never pushed. A jump taken mid-gust drifts ~1–2 m
 *    downwind; wait for the lull or take the kicker on its upwind side. Never knocks or crashes.
 *  - scoured-rock: exposed, wind-scoured rock slabs and gravel with a skin of snow, beside the racing
 *    line (never on it). Skis chatter and drag across it: friction ×2.4, less edge grip. Static,
 *    visible from far away as dark ground, and it only costs speed.
 *
 * The cliff edge itself is not a hazard instance: the cornice guard along the whole rim is part of
 * the Fjord surface model (./biome.ts), so it is continuous and can never be "reserved" away.
 */
import { LANE_HALF } from '../../../physics/obstacles';
import { registerHazardKind, type HazardKind, type HazardSpot } from '../../hazards/hazard';

export interface GustParams {
  /** peak extra crosswind (m/s, +X = toward the land) */
  wind: number;
}

export interface RockParams {
  /** visual variant seed */
  v: number;
}

/** peak extra wind of a funnelled squall, m/s (acts only through the airborne coupling) */
export const SEA_GUST_WIND = 9;

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
    // over the jumps of this band (kickers and cliff drops are the "gaps" a squall matters on)
    const kicks = m.profile.kickersNear(ctx.z0, ctx.z1, []);
    for (const k of kicks) {
      if (k.z < ctx.z0 || k.z >= ctx.z1) continue;
      if (!ctx.rng.chance(0.55 * Math.min(1.5, ctx.density))) continue;
      const x = m.centerX(k.z) + k.d;
      const z = k.z + 7;
      if (ctx.reserved(x, z, 18)) continue;
      out.push({ x, z, r: 18, params: { wind: SEA_GUST_WIND * ctx.rng.range(0.8, 1.05) } });
    }
    for (const c of m.profile.cliffsNear(ctx.z0, ctx.z1, [])) {
      if (c.z < ctx.z0 || c.z >= ctx.z1 || !ctx.rng.chance(0.6)) continue;
      const x = m.centerX(c.z) + (c.dMin + c.dMax) / 2;
      const z = c.z + 6;
      if (ctx.reserved(x, z, 20)) continue;
      out.push({ x, z, r: 20, params: { wind: SEA_GUST_WIND } });
    }
    return out;
  },
  effect(h, ph, c) {
    if (c.dist > h.r + 4) return null;
    const edge = 1 - Math.max(0, (c.dist - h.r * 0.6) / (h.r * 0.4 + 4));
    if (ph.phase === 'telegraph') return { windX: h.params.wind * 0.25 * ph.u * edge };
    if (ph.phase === 'active') return { windX: h.params.wind * Math.sin(Math.PI * Math.min(1, 0.15 + ph.u * 0.85)) * edge };
    if (ph.phase === 'recovery') return { windX: h.params.wind * 0.3 * (1 - ph.u) * edge };
    return null;
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
    const out: Array<HazardSpot<RockParams>> = [];
    const n = Math.round(ctx.rng.range(0.6, 2.2) * ctx.density);
    for (let i = 0; i < n; i++) {
      const z = ctx.z0 + ctx.rng.range(0.08, 0.92) * (ctx.z1 - ctx.z0);
      const r = ctx.rng.range(5, 11);
      const side = ctx.rng.chance(0.5) ? 1 : -1;
      const w = m.halfWidth(z);
      const rx = m.routeX(z);
      // beside the racing line, never on it (fastest line stays clean), still on the piste
      const x = rx + side * (LANE_HALF + 3 + r + ctx.rng.range(0, 18));
      if (Math.abs(x - m.centerX(z)) > w - r * 0.5) continue;
      const alt = m.profile.altRouteX(z);
      if (alt !== null && Math.abs(x - alt) < LANE_HALF + r) continue;
      if (ctx.reserved(x, z, r)) continue;
      out.push({ x, z, r, rot: ctx.rng.range(0, Math.PI * 2), params: { v: ctx.rng.int(0, 7) } });
    }
    return out;
  },
  effect(_h, _ph, c) {
    if (!c.inside || !c.grounded) return null;
    // the core of the patch is the roughest
    const k = 1 - Math.max(0, c.dist / Math.max(1, _h.r) - 0.55) / 0.45;
    return { surface: { friction: 1 + 1.4 * k, grip: 1 - 0.22 * k, dragAdd: 0.0035 * k } };
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
