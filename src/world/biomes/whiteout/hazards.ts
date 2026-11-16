/**
 * Whiteout Ridge hazards (pure):
 *
 *  - `wind-drift` (static, slow): wind-loaded snowdrifts lying across the exposed slopes — heavy,
 *    deep snow that bogs the skis down (drag, friction). They come in rows across the piste with a
 *    gap; sometimes the gap is on the racing line, sometimes the line is drifted over and the gap is
 *    off to one side: a route choice that is visible from far off (smooth white mounds with plumes
 *    of spindrift streaming off their crests, ./views).
 *  - `blizzard` (periodic): a localized blizzard cell that sweeps across the piste on the exposed
 *    stretches. Telegraph (5 s): the wall of blowing snow is seen and heard coming in from upwind;
 *    active (9 s): the visibility collapses inside it, the crosswind side-slips a grounded skier
 *    (more on exposed ground, less when edging) and carries an airborne one; it then blows through.
 *    It never knocks or crashes by itself. The choice: slow down / wait for it to pass, take the
 *    sheltered line, or ski through it blind and fight the slip.
 *
 * Both scale with the game difficulty's hazard intensity; the Yeti is never touched.
 */
import { clamp, smoothstep } from '../../../core/rng';
import { LANE_HALF } from '../../../physics/obstacles';
import { registerHazardKind, type HazardEffect, type HazardKind, type HazardSpot } from '../../hazards/hazard';
import { whiteoutExposure } from './storm';

export const DRIFT = {
  /** extra drag and × friction at a drift's core (on Normal) */
  // (W-014: ploughing through a drift must cost clearly more than taking the gap — deep wind-loaded
  // snow, not a speed bump)
  drag: 0.07,
  friction: 2.7,
  /** rows per 256 m band on exposed ground (× density) */
  rowChance: 1,
  /** share of rows that drift over the racing line (the gap is off to one side) */
  onLine: 0.6,
} as const;

export interface DriftParams {
  /** ridge orientation (rad) and length scale (× r) for the view */
  len: number;
  /** which row (for the view's variation) */
  row: number;
}

export const BLIZZARD_TIMING = { dormant: 15, telegraph: 5, active: 9, recovery: 4 } as const;

export const BLIZZARD = {
  r: 58,
  reach: 26,
  /** grounded side-slip (m/s) at full strength on fully exposed ground */
  slip: 2.1,
  /** airborne push (m/s²) */
  push: 4.5,
  /** the gust knock (W-014): cell strength, skier speed (m/s) and the share of speed kept */
  knockAt: 0.7,
  knockSpeed: 17,
  knockKeep: 0.58,
  /** extra fog inside the active cell (× the weather's) */
  fog: 4.2,
  /** one cell per this many metres of exposed course, on average */
  spacing: 520,
} as const;

export interface BlizzardParams {
  /** +1 / −1: blows toward +X (the skier's left) or −X */
  dir: number;
}

/** the share of a blizzard cell's strength at this phase (0..1) */
export function blizzardStrength(phase: string, u: number): number {
  if (phase === 'telegraph') return 0.3 * u * u;
  if (phase === 'active') return Math.min(1, 0.3 + 2.2 * u) * (1 - 0.25 * smoothstep(0.7, 1, u));
  if (phase === 'recovery') return 0.75 * (1 - u);
  return 0;
}

const exposedAt = (ctx: { mountain: Parameters<typeof whiteoutExposure>[0] }, z: number) => whiteoutExposure(ctx.mountain, ctx.mountain.routeX(z), z);

export const WIND_DRIFT: HazardKind<DriftParams> = {
  id: 'wind-drift',
  label: 'Wind drift',
  severity: 'slow',
  timing: { kind: 'static' },
  reach: 0,
  keepLaneClear: false,
  place(ctx) {
    const m = ctx.mountain;
    const out: Array<HazardSpot<DriftParams>> = [];
    const zMid = (ctx.z0 + ctx.z1) / 2;
    if (exposedAt(ctx, zMid) < 0.6) return out;
    if (!ctx.rng.chance(Math.min(1, DRIFT.rowChance * ctx.density))) return out;
    const z = ctx.z0 + ctx.rng.range(0.15, 0.85) * (ctx.z1 - ctx.z0);
    const hw = m.halfWidth(z);
    const cx = m.centerX(z);
    const rx = m.routeX(z);
    const onLine = ctx.rng.chance(DRIFT.onLine);
    // the gap: on the line, or ~16–22 m to the side where the piste has room
    let gapX = rx;
    if (onLine) {
      const side = rx - cx > 0 ? -1 : 1;
      gapX = clamp(rx + side * ctx.rng.range(16, 22), cx - hw + 8, cx + hw - 8);
      if (Math.abs(gapX - rx) < 12) gapX = rx + side * 12;
    }
    const gapHalf = LANE_HALF * 0.8;
    // mounds of r 6–9 m along the row, skipping the gap
    const row = ctx.band;
    for (let x = cx - hw + 5; x <= cx + hw - 5; ) {
      const r = ctx.rng.range(6, 9);
      const mx = x + r;
      if (Math.abs(mx - gapX) > gapHalf + r * 0.8 && !ctx.reserved(mx, z, r)) out.push({ x: mx, z: z + ctx.rng.range(-3, 3), r, rot: ctx.rng.range(-0.25, 0.25), params: { len: ctx.rng.range(1.5, 2.1), row } });
      x += 2 * r * ctx.rng.range(0.82, 0.95);
    }
    return out;
  },
  effect(h, _ph, c) {
    if (!c.inside || !c.grounded) return null;
    const I = c.intensity ?? 1;
    const k = smoothstep(1, 0.25, c.dist / Math.max(1, h.r)) * I;
    if (k <= 0) return null;
    return { surface: { dragAdd: DRIFT.drag * k, friction: 1 + (DRIFT.friction - 1) * k } };
  },
  audio: { ambient: 'drift-plough' },
  view: 'wind-drift',
};

export const BLIZZARD_CELL: HazardKind<BlizzardParams> = {
  id: 'blizzard',
  label: 'Blizzard',
  // (W-014) it can knock a tucked skier off balance; never a crash, and the lane need not be clear
  severity: 'knock',
  timing: { kind: 'periodic', ...BLIZZARD_TIMING },
  reach: BLIZZARD.reach,
  keepLaneClear: false,
  place(ctx) {
    const out: Array<HazardSpot<BlizzardParams>> = [];
    const len = ctx.z1 - ctx.z0;
    const zMid = (ctx.z0 + ctx.z1) / 2;
    if (exposedAt(ctx, zMid) < 0.7) return out;
    if (!ctx.rng.chance(Math.min(1, (len / BLIZZARD.spacing) * 1.6 * ctx.density))) return out;
    const z = ctx.z0 + ctx.rng.range(0.2, 0.8) * len;
    const x = ctx.mountain.routeX(z);
    if (ctx.reserved(x, z, 30)) return out;
    out.push({ x, z, r: BLIZZARD.r, params: { dir: ctx.rng.chance(0.5) ? 1 : -1 } });
    return out;
  },
  effect(h, ph, c) {
    const w0 = blizzardStrength(ph.phase, ph.u);
    if (w0 <= 0) return null;
    const edge = 1 - smoothstep(h.r * 0.55, h.r + BLIZZARD.reach, c.dist);
    const w = w0 * edge;
    if (w <= 0.01) return null;
    const I = c.intensity ?? 1;
    const e: HazardEffect = { visibility: 1 + (BLIZZARD.fog - 1) * w };
    const dir = h.params.dir;
    if (c.grounded) {
      e.slipX = dir * Math.min(4, BLIZZARD.slip * w * I);
      // (W-014) a skier still tucked and fast when the cell blows at full strength is knocked off
      // balance by the gust (once per cell); standing up or checking speed rides it out
      if (w > BLIZZARD.knockAt && (c.tuck ?? 0) > 0.5 && c.speed > BLIZZARD.knockSpeed) e.knock = { keep: BLIZZARD.knockKeep, wobble: 0.7 * I };
    }
    else e.airPushX = dir * Math.min(8, BLIZZARD.push * w * I);
    e.windX = dir * 9 * w;
    return e;
  },
  audio: { telegraph: 'blizzard-build', active: 'blizzard-roar', hit: 'blizzard-roar' },
  view: 'blizzard',
};

let registered = false;
/** Register the Whiteout hazard kinds (idempotent). */
export function registerWhiteoutHazards(): void {
  if (registered) return;
  registered = true;
  registerHazardKind(WIND_DRIFT);
  registerHazardKind(BLIZZARD_CELL);
}
