/**
 * Surface capability: how a location's snow / ice / ground changes the feel of the skis.
 *
 * Pure (no three.js). A SurfaceModel maps (biome, position, the existing surface kind and its
 * continuous ice/powder/groomed weights) to a set of multiplicative physics modifiers. SkierPhysics
 * applies them through its single environment hook (src/physics/environment.ts), so every biome
 * shares the same controls and only the numbers change.
 *
 * Identity contract: IDENTITY_SURFACE (all factors 1, dragAdd 0) leaves SkierPhysics' output
 * bit-identical (x * 1 === x and x + 0 === x in IEEE-754 for the finite positive values involved).
 * Alpine uses ALPINE_SURFACE, which always returns the identity (tests/unit/capabilities.test.ts).
 */
import type { SurfaceType } from '../../core/types';
import type { Mountain } from '../course';

export interface SurfaceWeights {
  ice: number;
  powder: number;
  groomed: number;
}

/**
 * Physics modifiers. Every field is a multiplier on an existing SkierPhysics quantity (1 = no
 * change) except `dragAdd`, which is added (0 = no change).
 */
export interface SurfaceModifiers {
  /** × lateral grip (edge hold); < 1 = skis wash out sideways (ice) */
  grip: number;
  /** × Coulomb snow friction (rolling/sliding resistance); < 1 = glides further (frozen lake) */
  friction: number;
  /** × turning radius (steering authority is divided by it); > 1 = wider, slower turns */
  carveRadius: number;
  /** × pizza (snowplow) braking deceleration; < 1 = longer stopping distance */
  brake: number;
  /** × drift initiation speed (DRIFT_MIN_SPEED); < 1 = drifts start sooner (slippery) */
  driftThreshold: number;
  /** × rate at which control returns after getting up from a crash; < 1 = slower recovery */
  recovery: number;
  /** + extra quadratic drag (0.5·ρ·CdA/m units, like TUNING.powderDrag): lowers top speed */
  dragAdd: number;
}

export const IDENTITY_SURFACE: Readonly<SurfaceModifiers> = Object.freeze({ grip: 1, friction: 1, carveRadius: 1, brake: 1, driftThreshold: 1, recovery: 1, dragAdd: 0 });

/** What a surface model is asked about. `weights()` is lazy (computed at most once per query). */
export interface SurfaceQuery {
  readonly biomeId: string;
  readonly x: number;
  readonly z: number;
  /** the discrete surface the terrain already reports at (x, z) (Mountain.surfaceAt) */
  readonly kind: SurfaceType;
  /** the continuous weights behind `kind` (Mountain.surfaceWeights) */
  weights(): SurfaceWeights;
  /** the course being skied (terrain features such as a coast's cornice rim); absent in synthetic tests */
  readonly mountain?: Mountain;
  /**
   * the skier's horizontal velocity (m/s) when the query comes from physics; absent for position-only
   * queries (renderer, tests). Lets a surface resist some directions of travel more than others.
   */
  readonly vx?: number;
  readonly vz?: number;
}

export interface SurfaceModel {
  readonly id: string;
  /** true when `modifiers` always returns IDENTITY_SURFACE (lets the engine skip the call) */
  readonly identity?: boolean;
  /** Write the modifiers for this query into `out` (all fields; start from resetSurface). */
  modifiers(q: SurfaceQuery, out: SurfaceModifiers): void;
}

export function resetSurface(out: SurfaceModifiers): SurfaceModifiers {
  out.grip = 1;
  out.friction = 1;
  out.carveRadius = 1;
  out.brake = 1;
  out.driftThreshold = 1;
  out.recovery = 1;
  out.dragAdd = 0;
  return out;
}

/** Fold a partial modifier set into `out` (multiply factors, add dragAdd). */
export function combineSurface(out: SurfaceModifiers, m: Partial<SurfaceModifiers>): SurfaceModifiers {
  if (m.grip !== undefined) out.grip *= m.grip;
  if (m.friction !== undefined) out.friction *= m.friction;
  if (m.carveRadius !== undefined) out.carveRadius *= m.carveRadius;
  if (m.brake !== undefined) out.brake *= m.brake;
  if (m.driftThreshold !== undefined) out.driftThreshold *= m.driftThreshold;
  if (m.recovery !== undefined) out.recovery *= m.recovery;
  if (m.dragAdd !== undefined) out.dragAdd += m.dragAdd;
  return out;
}

export function isIdentitySurface(m: SurfaceModifiers): boolean {
  return m.grip === 1 && m.friction === 1 && m.carveRadius === 1 && m.brake === 1 && m.driftThreshold === 1 && m.recovery === 1 && m.dragAdd === 0;
}

/** Sane ranges: a modifier outside them makes the controls feel broken (see docs/BIOMES.md). */
export const SURFACE_LIMITS: Readonly<Record<keyof SurfaceModifiers, readonly [number, number]>> = {
  grip: [0.1, 3],
  friction: [0.05, 6],
  carveRadius: [0.5, 3],
  brake: [0.1, 3],
  driftThreshold: [0.3, 3],
  recovery: [0.25, 4],
  dragAdd: [0, 0.05],
};

/** Problems with a modifier set (empty = fine). */
export function validateSurfaceModifiers(m: SurfaceModifiers): string[] {
  const out: string[] = [];
  for (const k of Object.keys(SURFACE_LIMITS) as Array<keyof SurfaceModifiers>) {
    const v = m[k];
    const [lo, hi] = SURFACE_LIMITS[k];
    if (!Number.isFinite(v) || v < lo || v > hi) out.push(`${k}=${v} outside [${lo}, ${hi}]`);
  }
  return out;
}

/** Alpine: the original physics, exactly. */
export const ALPINE_SURFACE: SurfaceModel = {
  id: 'alpine',
  identity: true,
  modifiers(_q, out) {
    resetSurface(out);
  },
};

/**
 * Convenience model: per-surface-kind modifiers, blended by the continuous weights so there is no
 * hard step at zone edges. `base` applies everywhere.
 *   surfaceTable('frozen', { ice: { grip: 0.6, brake: 0.5 } })
 */
export function surfaceTable(id: string, table: Partial<Record<SurfaceType, Partial<SurfaceModifiers>>>, base: Partial<SurfaceModifiers> = {}): SurfaceModel {
  const lerpInto = (out: SurfaceModifiers, m: Partial<SurfaceModifiers> | undefined, w: number) => {
    if (!m || w <= 0) return;
    // geometric blend for factors (w=0 → ×1, w=1 → ×m), linear for dragAdd
    if (m.grip !== undefined) out.grip *= m.grip ** w;
    if (m.friction !== undefined) out.friction *= m.friction ** w;
    if (m.carveRadius !== undefined) out.carveRadius *= m.carveRadius ** w;
    if (m.brake !== undefined) out.brake *= m.brake ** w;
    if (m.driftThreshold !== undefined) out.driftThreshold *= m.driftThreshold ** w;
    if (m.recovery !== undefined) out.recovery *= m.recovery ** w;
    if (m.dragAdd !== undefined) out.dragAdd += m.dragAdd * w;
  };
  return {
    id,
    modifiers(q, out) {
      resetSurface(out);
      combineSurface(out, base);
      const w = q.weights();
      const snow = Math.max(0, 1 - w.ice - w.powder - w.groomed);
      lerpInto(out, table.ice, w.ice);
      lerpInto(out, table.powder, w.powder);
      lerpInto(out, table.packed, w.groomed);
      lerpInto(out, table.snow, snow);
    },
  };
}
