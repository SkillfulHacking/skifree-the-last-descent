/**
 * Hazard capability: environmental hazards as data + pure logic (no three.js).
 *
 * A HazardKind describes one kind of hazard (a steam vent, a crevasse, a snowdrift, a fog bank):
 *  - placement: where instances go, deterministically, given the course and a seeded RNG per
 *    256 m band (the same bands as obstacles, so hazards stream exactly like obstacles);
 *  - timing: dormant → telegraph → active → recovery (or static, always active);
 *  - effect rules: what touching it does (surface modifiers, a knock, a crash, wind, visibility);
 *  - presentation references: a view factory id (src/world/presentation/hazardViews.ts, three.js)
 *    and audio cue ids. The pure logic never imports the view.
 *
 * Kinds are registered globally by id (registerHazardKind) and selected per biome by id
 * (biome.capabilities.hazards.kinds). Placement is done by HazardField (field.ts); evaluation
 * against the skier by BiomeEnvironment (../capabilities/environment.ts).
 */
import type { Rng } from '../../core/rng';
import type { Mountain } from '../course';
import type { SurfaceModifiers } from '../capabilities/surface';

export type HazardPhase = 'dormant' | 'telegraph' | 'active' | 'recovery';

export interface HazardPhaseState {
  phase: HazardPhase;
  /** 0..1 progress through the current phase */
  u: number;
}

/**
 * When a hazard is dangerous.
 * - static: always active (a snowdrift, an exposed rock band, a crevasse);
 * - periodic: a fixed cycle; each instance gets its own phase offset from its seed (vents).
 */
export type HazardTiming =
  | { kind: 'static' }
  | { kind: 'periodic'; dormant: number; telegraph: number; active: number; recovery: number };

/** Minimum warning (s) for a periodic hazard that can knock or crash the skier (fairness). */
export const MIN_TELEGRAPH_S = 0.8;

/** Where a kind wants an instance. `r` is the footprint radius (m) used for contact. */
export interface HazardSpot<P = unknown> {
  x: number;
  z: number;
  r: number;
  rot?: number;
  params: P;
}

export interface HazardInstance<P = unknown> {
  /** unique while loaded: band * 4096 + local index (stable for a given course) */
  readonly id: number;
  readonly kind: string;
  readonly band: number;
  readonly x: number;
  readonly z: number;
  /** ground height at (x, z) */
  readonly y: number;
  readonly r: number;
  readonly rot: number;
  /** per-instance seed (phase offset, view variation) */
  readonly seed: number;
  readonly params: P;
}

export interface HazardPlacementContext {
  readonly mountain: Mountain;
  readonly seed: number;
  readonly band: number;
  /** band extent [z0, z1) — spots outside are dropped */
  readonly z0: number;
  readonly z1: number;
  /** deterministic per (course seed, band, kind) */
  readonly rng: Rng;
  /** biome hazard density × (1 = the kind's own default amount) */
  readonly density: number;
  /** distance from the primary route line at z */
  laneDistance(x: number, z: number): number;
  /** true where nothing may be placed (start, finish, refuges, cave mouths and clearings) */
  reserved(x: number, z: number, r: number): boolean;
}

/** The skier relative to one instance, for effect rules. */
export interface HazardContact {
  /** skier minus hazard centre (m) and the distance */
  dx: number;
  dz: number;
  dist: number;
  /** dist < instance.r */
  inside: boolean;
  speed: number;
  grounded: boolean;
  /** skier height above the ground at the hazard (0 when grounded) */
  heightAbove: number;
  /** physics time (s) */
  t: number;
  /** × effect strength for the game difficulty (HazardSetup.intensity; 1 when not set) */
  intensity?: number;
  /** how far the skier is tucked, 0..1 (undefined when the caller does not know) */
  tuck?: number;
}

/** What touching a hazard does this step (everything optional; null = nothing). */
export interface HazardEffect {
  /** folded into the surface modifiers (multiply / add dragAdd) */
  surface?: Partial<SurfaceModifiers>;
  /** keep `keep` of horizontal speed and wobble (like a snowball hit). Fired once per contact. */
  knock?: { keep: number; wobble: number };
  /** crash the skier. Fired once per contact. */
  crash?: { reason: string; intensity: number };
  /** extra wind (m/s) at the skier, e.g. a vent's updraft or a funnelled gust (airborne coupling) */
  windX?: number;
  windZ?: number;
  /**
   * Side-slip a gust forces on a GROUNDED skier (m/s, world axes; +X is the skier's left when
   * facing downhill): the snow surface is blown out from under the skis, so the skier slides that
   * way without gaining or losing speed. How much of it takes hold depends on the edge (more when
   * tucked or drifting, less when the skis bite: SkierPhysics). Counter it by steering against it.
   * Keep |slip| ≤ 4.
   */
  slipX?: number;
  slipZ?: number;
  /**
   * Horizontal push on an AIRBORNE skier (m/s², world axes), applied directly (not through the
   * weather's airborne coupling): a gust funnelled over a jump that carries a skier a few metres
   * sideways before they land. Keep |push| ≤ 8.
   */
  airPushX?: number;
  /** × fog density for the renderer (steam, fog bank) */
  visibility?: number;
}

export type HazardSeverity = 'cosmetic' | 'slow' | 'knock' | 'crash';

export interface HazardAudio {
  /** played when the telegraph phase starts near the skier */
  telegraph?: string;
  /** played when the active phase starts near the skier */
  active?: string;
  /** played on a knock/crash */
  hit?: string;
  /** looped while the skier is near */
  ambient?: string;
}

export interface HazardKind<P = unknown> {
  /** stable lowercase id [a-z0-9-] */
  readonly id: string;
  readonly label: string;
  /** the worst thing it can do (drives fairness validation) */
  readonly severity: HazardSeverity;
  readonly timing: HazardTiming;
  /** effect rules are evaluated within r + reach (m) of an instance (0 = footprint only) */
  readonly reach: number;
  /** solid/dangerous kinds keep the primary lane clear (default: true unless severity is cosmetic/slow) */
  readonly keepLaneClear?: boolean;
  place(ctx: HazardPlacementContext): Array<HazardSpot<P>>;
  effect(h: HazardInstance<P>, phase: HazardPhaseState, c: HazardContact): HazardEffect | null;
  readonly audio?: HazardAudio;
  /** view factory id (presentation/hazardViews.ts); required unless cosmetic-and-invisible */
  readonly view?: string;
}

export function keepsLaneClear(k: HazardKind): boolean {
  return k.keepLaneClear ?? (k.severity === 'knock' || k.severity === 'crash');
}

/** Phase of a periodic cycle at time t (offset 0..1 of the cycle, from the instance seed). */
export function periodicPhase(t: number, offset: number, T: Extract<HazardTiming, { kind: 'periodic' }>): HazardPhaseState {
  const period = T.dormant + T.telegraph + T.active + T.recovery;
  let x = (t / period + offset) % 1;
  if (x < 0) x += 1;
  let s = x * period;
  if (s < T.dormant) return { phase: 'dormant', u: T.dormant > 0 ? s / T.dormant : 1 };
  s -= T.dormant;
  if (s < T.telegraph) return { phase: 'telegraph', u: s / T.telegraph };
  s -= T.telegraph;
  if (s < T.active) return { phase: 'active', u: s / T.active };
  s -= T.active;
  return { phase: 'recovery', u: T.recovery > 0 ? Math.min(1, s / T.recovery) : 1 };
}

const STATIC_ACTIVE: HazardPhaseState = Object.freeze({ phase: 'active', u: 0 }) as HazardPhaseState;

/** Phase of an instance at physics time t. */
export function hazardPhase(k: HazardKind, h: HazardInstance, t: number): HazardPhaseState {
  if (k.timing.kind === 'static') return STATIC_ACTIVE;
  return periodicPhase(t, (h.seed % 10007) / 10007, k.timing);
}

// =============================================================================================
// Registry
// =============================================================================================
const kinds = new Map<string, HazardKind>();

/** Problems with a kind definition (empty = fine). */
export function validateHazardKind(k: HazardKind): string[] {
  const out: string[] = [];
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(k.id)) out.push(`hazard id "${k.id}" must be lowercase [a-z0-9-]`);
  if (!k.label) out.push(`hazard "${k.id}" needs a label`);
  if (!(k.reach >= 0 && k.reach <= 200)) out.push(`hazard "${k.id}" reach ${k.reach} outside [0, 200]`);
  const T = k.timing;
  if (T.kind === 'periodic') {
    if (![T.dormant, T.telegraph, T.active, T.recovery].every((v) => Number.isFinite(v) && v >= 0) || T.dormant + T.telegraph + T.active + T.recovery <= 0) out.push(`hazard "${k.id}" has an invalid cycle`);
    if ((k.severity === 'knock' || k.severity === 'crash') && T.telegraph < MIN_TELEGRAPH_S) out.push(`hazard "${k.id}" can ${k.severity} the skier but telegraphs for only ${T.telegraph}s (min ${MIN_TELEGRAPH_S}s)`);
  }
  if (k.severity !== 'cosmetic') {
    if (!k.view) out.push(`hazard "${k.id}" (${k.severity}) needs a view (players must see it)`);
    if (!k.audio || !Object.values(k.audio).some(Boolean)) out.push(`hazard "${k.id}" (${k.severity}) needs at least one audio cue`);
    if (k.timing.kind === 'periodic' && (k.severity === 'knock' || k.severity === 'crash') && !k.audio?.telegraph) out.push(`hazard "${k.id}" needs a telegraph audio cue`);
  }
  return out;
}

/** Register a hazard kind (module load time, before biomes that use it). Throws if invalid. */
export function registerHazardKind<P>(k: HazardKind<P>): HazardKind<P> {
  const errs = validateHazardKind(k as HazardKind);
  if (errs.length) throw new Error(errs.join('; '));
  const prev = kinds.get(k.id);
  if (prev && prev !== (k as HazardKind)) throw new Error(`hazard kind "${k.id}" is already registered`);
  kinds.set(k.id, k as HazardKind);
  return k;
}

/** Remove a kind (tests). */
export function unregisterHazardKind(id: string): void {
  kinds.delete(id);
}

export function hasHazardKind(id: string): boolean {
  return kinds.has(id);
}

export function getHazardKind(id: string): HazardKind {
  const k = kinds.get(id);
  if (!k) throw new Error(`unknown hazard kind "${id}"`);
  return k;
}

export function listHazardKinds(): HazardKind[] {
  return [...kinds.values()];
}
