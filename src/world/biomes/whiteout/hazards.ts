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
import { registerHazardKind, type HazardEffect, type HazardKind, type HazardSpot } from '../../hazards/hazard';
import { skiableAcross, whiteoutExposure } from './storm';

export const DRIFT = {
  /**
   * extra drag and × friction where the snow is deepest (on Normal), falling with the local depth of
   * the mound (W-035: the physics follows the drawn mound, crest and flanks, not a circle round it)
   */
  // (W-014: ploughing through a drift must cost clearly more than taking the gap — deep wind-loaded
  // snow, not a speed bump. W-035, measured per row from the same approach — tests/sim/driftRow:
  // at 0.07 ploughing a 2 m drift kept 90% of the speed and beat a clean line through the gap; at
  // 0.22 / 4 it keeps ~65% and a competent line through the gap gains 0.3–0.6 s and ~2.5 m/s)
  drag: 0.22,
  friction: 4,
  /**
   * a jump that does not clear the snow (clearance below the local depth + `clipMargin`) catches the
   * skis in the drift: knocked (keep `clipKeep` of the speed), then deep snow on landing
   */
  clipMargin: 0.15,
  /** above this speed (m/s) the plough's drag stops growing (no wall-like stop at full speed) */
  vCap: 18,
  /** the extra friction fades out below this speed band (m/s): wading out of a drift */
  wade: [1.5, 5] as const,
  clipKeep: 0.72,
  /** rows per 256 m band on exposed ground (× density) */
  rowChance: 1,
  /** share of rows that drift over the racing line (the gap is off to one side) */
  onLine: 0.6,
  /**
   * the clear gap's half-width (m): the drawn mounds, crest to tail, stay this far from its centre;
   * the obstacle field keeps it and the line into it clear (clearZones)
   */
  gapHalf: 6.5,
} as const;

export interface DriftParams {
  /** ridge orientation (rad) and length scale (× r) for the view */
  len: number;
  /** which row (for the view's variation) */
  row: number;
  /** the row's clear gap: its centre and half-width, the row's z and the racing line's x there */
  gapX?: number;
  gapHalf?: number;
  rowZ?: number;
  lineX?: number;
  /** the first mound of its row carries the row's clear zones */
  lead?: boolean;
}

/** a drawn mound's shape: half-length along the row, half-depth across it, crest height (m) */
export function driftShape(h: { r: number; seed: number; params: DriftParams }) {
  return { L: h.r * h.params.len, W: h.r * 0.75, H: 1.7 + 0.5 * ((h.seed % 97) / 97) };
}

/**
 * The drawn height (m) of a drift mound over the ground at local coordinates (lx along the row, lz
 * across it, from the centre; +lz downhill = the lee): a long windward ramp, the crest at 0.35 of the
 * half-depth, a steep lee face (the view builds its mesh from the same profile).
 */
export function driftProfile(L: number, W: number, H: number, lx: number, lz: number): number {
  const u = lx / L;
  const v = lz / W;
  if (u <= -1 || u >= 1 || v <= -1 || v >= 1) return 0;
  const across = v < 0.35 ? Math.pow(Math.max(0, (v + 1) / 1.35), 1.6) : Math.max(0, 1 - Math.pow((v - 0.35) / 0.65, 0.7));
  const along = Math.pow(Math.max(0, 1 - u * u), 0.8);
  return H * across * along;
}

/** depth (m) of drift `h` at world offset (dx, dz) from its centre */
export function driftDepth(h: { r: number; rot: number; seed: number; params: DriftParams }, dx: number, dz: number): number {
  const { L, W, H } = driftShape(h);
  const c = Math.cos(h.rot);
  const s = Math.sin(h.rot);
  return driftProfile(L, W, H, dx * c + dz * s, -dx * s + dz * c);
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
  // the drawn mound reaches len × r along the row (len ≤ 2.1, r ≤ 9): beyond the instance radius
  reach: 11,
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
      // (round 2) the way over to the gap and through it must be smooth snow (no terrain step on the
      // line into it — B F8): checked across at the row and on the approach, and along the gap
      const ok = (x: number) => [z, z - 30, z - 60].every((zz) => skiableAcross(m, m.routeX(zz), x, zz)) && skiableAcross(m, x, x, z - 20, 40);
      if (!ok(gapX)) {
        const other = clamp(rx - side * Math.abs(gapX - rx), cx - hw + 8, cx + hw - 8);
        gapX = Math.abs(other - rx) >= 12 && ok(other) ? other : rx;
      }
    }
    const gapHalf = DRIFT.gapHalf;
    // mounds of r 6–9 m along the row, skipping the gap: the whole drawn mound (len × r each way)
    // stays clear of it, so the gap that is seen is the gap that is skied (W-035)
    const row = ctx.band;
    let lead = true;
    for (let x = cx - hw + 5; x <= cx + hw - 5; ) {
      const r = ctx.rng.range(6, 9);
      const mx = x + r;
      const zj = ctx.rng.range(-3, 3);
      const rot = ctx.rng.range(-0.25, 0.25);
      const len = ctx.rng.range(1.5, 2.1);
      if (Math.abs(mx - gapX) - r * len * 0.92 > gapHalf && !ctx.reserved(mx, z, r)) {
        out.push({ x: mx, z: z + zj, r, rot, params: { len, row, gapX, gapHalf, rowZ: z, lineX: rx, lead } });
        lead = false;
      }
      x += 2 * r * ctx.rng.range(0.82, 0.95);
    }
    return out;
  },
  /**
   * The row's gap and the ground between it and the racing line stay free of rock and trees (W-035:
   * on round 1 the gap route met boulders the racing line did not): the gap from 60 m before the row
   * to 35 m after it, and the whole strip between the line and the gap over the approach and the
   * way back (a player bends over early or late, and rejoins the line after the row).
   */
  clearZones(h) {
    const p = h.params;
    if (!p.lead || p.gapX === undefined || p.rowZ === undefined || p.lineX === undefined) return [];
    const gh = (p.gapHalf ?? DRIFT.gapHalf) + 1;
    const zones: Array<{ x: number; z: number; hx: number; hz: number }> = [{ x: p.gapX, z: p.rowZ - 12, hx: gh, hz: 48 }];
    if (Math.abs(p.gapX - p.lineX) > 1) {
      const x0 = Math.min(p.gapX, p.lineX) - 3;
      const x1 = Math.max(p.gapX, p.lineX) + 3;
      zones.push({ x: (x0 + x1) / 2, z: p.rowZ - 22, hx: (x1 - x0) / 2, hz: 68 });
    }
    return zones;
  },
  effect(h, _ph, c) {
    const depth = driftDepth(h, c.dx, c.dz);
    if (depth <= 0.02) return null;
    const I = c.intensity ?? 1;
    if (!c.grounded) {
      // a jump that clears the drift crosses it untouched; one that does not, catches the skis in it
      if ((c.clearance ?? c.heightAbove) >= depth + DRIFT.clipMargin) return null;
      return { knock: { keep: 1 - (1 - DRIFT.clipKeep) * Math.min(1, I / 0.8), wobble: 0.6 * I } };
    }
    const k = Math.min(1, depth / driftShape(h).H) * I;
    // (round 2) the drag grows with v² up to DRIFT.vCap and no further: deep snow brakes hard, it
    // does not stop a 90 km/h skier dead like a wall; and the friction eases off at a wading pace, so
    // a skier who has bogged down can always pole or step out (never a soft-lock)
    const v = c.speed;
    const capK = v > DRIFT.vCap ? (DRIFT.vCap / v) ** 2 : 1;
    const wade = smoothstep(DRIFT.wade[0], DRIFT.wade[1], v);
    return { surface: { dragAdd: DRIFT.drag * k * capK, friction: 1 + (DRIFT.friction - 1) * k * wade } };
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
      if (w > BLIZZARD.knockAt && (c.tuck ?? 0) > 0.5 && c.speed > BLIZZARD.knockSpeed) e.knock = { keep: 1 - (1 - BLIZZARD.knockKeep) * Math.min(1, I / 0.8), wobble: 0.7 * I };
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
