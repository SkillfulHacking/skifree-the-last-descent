/**
 * BiomeEnvironment: a location's gameplay environment for one course — the surface model, the
 * weather model and the streamed hazard field — composed into the single PhysicsEnvironment hook
 * that SkierPhysics calls every fixed step. Pure (no three.js): the same object drives the game
 * (World owns it and streams it with the obstacles), headless simulations and unit tests.
 *
 * Gameplay moments are reported through `listen()` as typed EnvironmentEvents, so a gameplay
 * event bus (achievements, stats, audio cues) can subscribe without the environment knowing about
 * it. Alpine produces surface-change events only (it has no hazards and calm physics).
 */
import type { SurfaceType } from '../../core/types';
import type { Mountain } from '../course';
import type { EnvQuery, EnvSample, PhysicsEnvironment } from '../../physics/environment';
import { capabilitiesOf, type BiomeCapabilities } from './index';
import { combineSurface, resetSurface, type SurfaceQuery, type SurfaceWeights } from './surface';
import { makeWeatherSample, type WeatherSample } from './weather';
import { HazardField } from '../hazards/field';
import { getHazardKind, hazardPhase, type HazardContact, type HazardInstance, type HazardKind, type HazardPhase } from '../hazards/hazard';

export type EnvironmentEvent =
  /** the skier's surface changed (grounded only). Fires on Alpine too. */
  | { type: 'surface-change'; from: SurfaceType; to: SurfaceType; x: number; z: number; t: number }
  /** a nearby periodic hazard started warning (play `cue`, flash the marker) */
  | { type: 'hazard-telegraph'; hazard: HazardInstance; kind: string; cue: string | null; t: number }
  /** a nearby periodic hazard became dangerous */
  | { type: 'hazard-active'; hazard: HazardInstance; kind: string; cue: string | null; t: number }
  /** the skier entered / left a hazard's footprint */
  | { type: 'hazard-enter'; hazard: HazardInstance; kind: string; phase: HazardPhase; t: number }
  | { type: 'hazard-exit'; hazard: HazardInstance; kind: string; t: number }
  /** the hazard knocked or crashed the skier */
  | { type: 'hazard-hit'; hazard: HazardInstance; kind: string; effect: 'knock' | 'crash'; cue: string | null; t: number }
  /**
   * The skier went past a hazard they came close to (within `closest` m of its footprint edge).
   * `hit` false = survived it — the natural source of a HazardSurvived gameplay event.
   */
  | { type: 'hazard-passed'; hazard: HazardInstance; kind: string; hit: boolean; entered: boolean; closest: number; t: number };

export type EnvironmentListener = (e: EnvironmentEvent) => void;

/** how far ahead (m) a periodic hazard's telegraph/active transitions are reported */
export const HAZARD_ALERT_RANGE = 150;
/** how close (m, from the footprint edge) the skier must come for a 'hazard-passed' report */
export const HAZARD_PASS_RANGE = 25;

interface Track {
  h: HazardInstance;
  k: HazardKind;
  phase: HazardPhase | null;
  inside: boolean;
  entered: boolean;
  hit: boolean;
  /** knock/crash already applied during the current contact */
  struck: boolean;
  closest: number;
}

export class BiomeEnvironment implements PhysicsEnvironment {
  readonly caps: BiomeCapabilities;
  readonly hazards: HazardField;
  readonly kinds: readonly HazardKind[];
  /** true when sampling can never change physics (Alpine): identity surface, calm, no hazards */
  readonly physicsIdentity: boolean;
  /** physics time of the last sample (hazard views and weather visuals follow this clock) */
  clock = 0;
  private listeners = new Set<EnvironmentListener>();
  private tracks = new Map<number, Track>();
  private near: HazardInstance[] = [];
  private lastSurface: SurfaceType | null = null;
  private w = makeWeatherSample();
  private sq: SurfaceQuery & { kind: SurfaceType; x: number; z: number; cached: SurfaceWeights | null };

  constructor(
    readonly mountain: Mountain,
    readonly seed: number,
  ) {
    this.caps = capabilitiesOf(mountain.biome);
    this.kinds = this.caps.hazards.kinds.map(getHazardKind);
    this.hazards = new HazardField(mountain, seed, this.kinds, this.caps.hazards.density);
    const cpl = this.caps.weather.coupling;
    this.physicsIdentity = !!this.caps.surface.identity && cpl.airborne === 0 && cpl.balance === 0 && this.hazards.empty;
    const m = mountain;
    const sq = {
      biomeId: m.biome.id,
      mountain: m,
      x: 0,
      z: 0,
      kind: 'snow' as SurfaceType,
      cached: null as SurfaceWeights | null,
      weights(): SurfaceWeights {
        return (sq.cached ??= m.surfaceWeights(sq.x, sq.z));
      },
    };
    this.sq = sq;
  }

  /** Subscribe to gameplay moments. Returns an unsubscribe function. */
  listen(fn: EnvironmentListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: EnvironmentEvent) {
    for (const l of this.listeners) l(e);
  }

  /** Physics-critical streaming window (World calls this with the obstacle window). */
  stream(z: number): void {
    this.hazards.ensure(z - 80, z + 400);
  }

  release(keep0: number, keep1: number): void {
    this.hazards.release(keep0, keep1);
  }

  /** Weather at a point/time (renderer, audio, tests). */
  weatherAt(x: number, z: number, t: number, out: WeatherSample = makeWeatherSample()): WeatherSample {
    return this.caps.weather.sample(x, z, t, this.seed, out);
  }

  reset(): void {
    this.clock = 0;
    this.tracks.clear();
    this.lastSurface = null;
  }

  sample(q: EnvQuery, out: EnvSample): void {
    this.clock = q.t;
    // surface-change events (cheap; only computed with listeners)
    if (this.listeners.size && q.grounded && !q.crashed) {
      if (this.lastSurface !== null && this.lastSurface !== q.surface) this.emit({ type: 'surface-change', from: this.lastSurface, to: q.surface, x: q.x, z: q.z, t: q.t });
      this.lastSurface = q.surface;
    }
    out.knock = null;
    out.crash = null;
    if (this.physicsIdentity) {
      // Alpine: leave the sample at identity (it never changes from makeEnvSample)
      return;
    }
    const caps = this.caps;
    const S = out.surface;
    // 1) surface
    if (caps.surface.identity) resetSurface(S);
    else {
      const sq = this.sq;
      sq.x = q.x;
      sq.z = q.z;
      sq.kind = q.surface;
      sq.cached = null;
      caps.surface.modifiers(sq, S);
    }
    // 2) weather coupling
    const cpl = caps.weather.coupling;
    let wx = 0;
    let wz = 0;
    let gust = 0;
    if (cpl.airborne !== 0 || cpl.balance !== 0) {
      const w = caps.weather.sample(q.x, q.z, q.t, this.seed, this.w);
      wx = w.windX;
      wz = w.windZ;
      gust = w.gust;
    }
    // 3) hazards
    if (!this.hazards.empty) {
      const hw = this.sampleHazards(q, out);
      wx += hw[0];
      wz += hw[1];
    }
    out.airAccelX = q.grounded ? 0 : cpl.airborne * wx;
    out.airAccelZ = q.grounded ? 0 : cpl.airborne * wz;
    out.balance = q.grounded ? cpl.balance * gust : 0;
  }

  private hw: [number, number] = [0, 0];

  private sampleHazards(q: EnvQuery, out: EnvSample): [number, number] {
    const hw = this.hw;
    hw[0] = 0;
    hw[1] = 0;
    // physics-critical band must exist even if the caller did not stream (simulations)
    this.hazards.ensure(q.z - 1, q.z + 1);
    const near = this.hazards.near(q.x, q.z + HAZARD_ALERT_RANGE * 0.5, HAZARD_ALERT_RANGE * 0.5 + HAZARD_PASS_RANGE, this.near);
    const contact: HazardContact = { dx: 0, dz: 0, dist: 0, inside: false, speed: q.speed, grounded: q.grounded, heightAbove: 0, t: q.t };
    for (const h of near) {
      let tr = this.tracks.get(h.id);
      const k = tr?.k ?? getHazardKind(h.kind);
      const dx = q.x - h.x;
      const dz = q.z - h.z;
      const dist = Math.hypot(dx, dz);
      const ph = hazardPhase(k, h, q.t);
      if (!tr) {
        tr = { h, k, phase: null, inside: false, entered: false, hit: false, struck: false, closest: Infinity };
        this.tracks.set(h.id, tr);
      }
      // telegraph / active transitions ahead of the skier
      if (k.timing.kind === 'periodic' && tr.phase !== ph.phase && h.z > q.z - h.r && h.z - q.z < HAZARD_ALERT_RANGE) {
        if (ph.phase === 'telegraph') this.emit({ type: 'hazard-telegraph', hazard: h, kind: k.id, cue: k.audio?.telegraph ?? null, t: q.t });
        else if (ph.phase === 'active') this.emit({ type: 'hazard-active', hazard: h, kind: k.id, cue: k.audio?.active ?? null, t: q.t });
      }
      tr.phase = ph.phase;
      tr.closest = Math.min(tr.closest, dist - h.r);
      const inside = dist < h.r;
      if (inside !== tr.inside) {
        tr.inside = inside;
        if (inside) {
          tr.entered = true;
          this.emit({ type: 'hazard-enter', hazard: h, kind: k.id, phase: ph.phase, t: q.t });
        } else {
          tr.struck = false;
          this.emit({ type: 'hazard-exit', hazard: h, kind: k.id, t: q.t });
        }
      }
      if (dist > h.r + k.reach || q.crashed) continue;
      contact.dx = dx;
      contact.dz = dz;
      contact.dist = dist;
      contact.inside = inside;
      contact.heightAbove = q.grounded ? 0 : Math.max(0, q.y - h.y);
      const e = k.effect(h, ph, contact);
      if (!e) continue;
      if (e.surface) combineSurface(out.surface, e.surface);
      if (e.windX) hw[0] += e.windX;
      if (e.windZ) hw[1] += e.windZ;
      if (!tr.struck && (e.crash || e.knock)) {
        tr.struck = true;
        tr.hit = true;
        if (e.crash && !out.crash) out.crash = e.crash;
        else if (e.knock && !out.knock) out.knock = e.knock;
        this.emit({ type: 'hazard-hit', hazard: h, kind: k.id, effect: e.crash ? 'crash' : 'knock', cue: k.audio?.hit ?? null, t: q.t });
      }
    }
    // hazards left behind: report and forget
    for (const [id, tr] of this.tracks) {
      const h = tr.h;
      if (q.z <= h.z + h.r + 2 && this.hazards.hasBand(h.band)) continue;
      if (tr.closest <= HAZARD_PASS_RANGE) this.emit({ type: 'hazard-passed', hazard: h, kind: tr.k.id, hit: tr.hit, entered: tr.entered, closest: Math.max(0, tr.closest), t: q.t });
      this.tracks.delete(id);
    }
    return hw;
  }

  /** Visibility multiplier from hazards near (x, z) at time t (steam, fog banks) — renderer. */
  hazardVisibility(x: number, z: number, t: number): number {
    if (this.hazards.empty) return 1;
    let v = 1;
    const contact: HazardContact = { dx: 0, dz: 0, dist: 0, inside: false, speed: 0, grounded: true, heightAbove: 0, t };
    for (const h of this.hazards.near(x, z, 60, [])) {
      const k = getHazardKind(h.kind);
      contact.dx = x - h.x;
      contact.dz = z - h.z;
      contact.dist = Math.hypot(contact.dx, contact.dz);
      contact.inside = contact.dist < h.r;
      if (contact.dist > h.r + k.reach) continue;
      const e = k.effect(h, hazardPhase(k, h, t), contact);
      if (e?.visibility) v *= e.visibility;
    }
    return v;
  }

  dispose(): void {
    this.hazards.clear();
    this.listeners.clear();
    this.tracks.clear();
  }
}
