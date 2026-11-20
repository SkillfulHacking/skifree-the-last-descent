/**
 * HazardField: deterministic, streamed hazard placement (the hazard twin of ObstacleField).
 *
 * Hazards are generated per 256 m band (the obstacle BAND), each band from its own seed per kind,
 * so any band can be built, released and rebuilt in any order with identical results. Listeners
 * (the three.js HazardLayer, tests) are told when a band's instances appear and disappear, which
 * is how views are created and disposed with the streamed chunks.
 *
 * The field enforces the course-wide reservations itself (start platform, finish chute/resort,
 * refuges, cave mouths and clearings, and — for dangerous kinds — the primary route lane), so a
 * kind's placement function cannot accidentally put a hazard somewhere unfair.
 */
import { Rng } from '../../core/rng';
import type { Mountain } from '../course';
import { BAND, LANE_HALF, setObstacleClearings, type ClearZone } from '../../physics/obstacles';
import { capabilitiesOf } from '../capabilities/index';
import { getHazardKind } from './hazard';
import { keepsLaneClear, type HazardInstance, type HazardKind, type HazardPlacementContext } from './hazard';

export type HazardBandListener = (band: number, hazards: readonly HazardInstance[], added: boolean) => void;

/** Ids per band (instance id = band * BAND_ID + local) */
const BAND_ID = 4096;
/** largest footprint radius (m) a hazard may have (keeps `near` queries bounded) */
export const MAX_HAZARD_R = 60;

/**
 * True where hazards may never go. Mirrors the obstacle exclusions in generateBand
 * (src/physics/obstacles.ts) with the hazard's radius added.
 */
export function hazardReserved(m: Mountain, x: number, z: number, r: number): boolean {
  const P = m.profile;
  const ad = Math.abs(x - m.centerX(z));
  const fz = P.finishZ;
  if (Number.isFinite(fz) && z + r > fz - 120 && ad - r < 160) return true; // finish approach, chute & finish area
  if (z - r < 60) return true; // summit, start platform & run-in (also keeps the menu view clean)
  if (P.checkpoints(z - 160, z + 160).some((c) => Math.abs(z - c) < 140 + r && ad - r < 120)) return true; // refuges
  for (const e of P.encounters(z - 120, z + 120)) {
    const a = e.anchor;
    const cx = a.centerX + a.side * a.d;
    if (Math.hypot(x - cx, z - a.z) < 34 + r) return true; // cave mouth
    if ((x - a.centerX) * a.side > a.d - 22 - r && Math.abs(z - a.z) < 50 + r) return true; // cave clearing
  }
  return false;
}

export function generateHazardBand(m: Mountain, seed: number, kinds: readonly HazardKind[], density: number, band: number, only?: string): HazardInstance[] {
  const list: HazardInstance[] = [];
  const z0 = band * BAND;
  const z1 = z0 + BAND;
  if (z1 < -260 || density <= 0 || kinds.length === 0) return list;
  const fz = m.finishZ;
  if (Number.isFinite(fz) && z0 > fz + 400) return list;
  let local = 0;
  kinds.forEach((k, ki) => {
    const rng = new Rng((seed ^ 0x4a2a7d1b ^ Math.imul(band + 6151, 0x9e3779b1) ^ Math.imul(ki + 1, 0x85ebca6b) ^ hashId(k.id)) >>> 0);
    const ctx: HazardPlacementContext = {
      mountain: m,
      seed,
      band,
      z0,
      z1,
      rng,
      density,
      laneDistance: (x, z) => Math.abs(x - m.routeX(z)),
      reserved: (x, z, r) => hazardReserved(m, x, z, r),
      neighbours: (id) => {
        if (only !== undefined || !kinds.some((kk) => kk.id === id)) return [];
        const out: HazardInstance[] = [];
        for (let b = band - 1; b <= band + 1; b++) out.push(...generateHazardBand(m, seed, kinds, density, b, id));
        return out;
      },
    };
    // `only`: just this kind's spots (its rng seed depends on its index in `kinds`, so the list is kept
    // whole); their ids are not the run's ids — neighbours are read for positions and params only
    if (only !== undefined && k.id !== only) return;
    const lane = keepsLaneClear(k);
    for (const s of k.place(ctx)) {
      if (!(s.z >= z0 && s.z < z1) || !Number.isFinite(s.x) || !(s.r > 0) || s.r > MAX_HAZARD_R) continue;
      if (hazardReserved(m, s.x, s.z, s.r)) continue;
      if (lane && Math.abs(s.x - m.routeX(s.z)) - s.r < LANE_HALF) continue;
      if (local >= BAND_ID) break;
      list.push({ id: band * BAND_ID + local++, kind: k.id, band, x: s.x, z: s.z, y: m.heightAt(s.x, s.z), r: s.r, rot: s.rot ?? 0, seed: (Math.imul(band * BAND_ID + local, 0x2c1b3c6d) ^ seed) >>> 0, params: s.params });
    }
  });
  return list;
}

function hashId(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

export class HazardField {
  private bands = new Map<number, HazardInstance[]>();
  private listeners = new Set<HazardBandListener>();
  /** cumulative counters (streaming checks) */
  readonly stats = { bandsBuilt: 0, bandsReleased: 0, created: 0, disposed: 0 };

  constructor(
    readonly mountain: Mountain,
    readonly seed: number,
    readonly kinds: readonly HazardKind[],
    readonly density = 1,
  ) {}

  /** Nothing to place: streaming is a no-op (Alpine). */
  get empty(): boolean {
    return this.kinds.length === 0 || this.density <= 0;
  }

  /** Subscribe to band add/remove; existing bands are replayed. Returns an unsubscribe function. */
  onBand(l: HazardBandListener): () => void {
    this.listeners.add(l);
    for (const [b, list] of this.bands) l(b, list, true);
    return () => this.listeners.delete(l);
  }

  ensure(z0: number, z1: number): void {
    if (this.empty) return;
    const b0 = Math.floor(z0 / BAND);
    const b1 = Math.floor(z1 / BAND);
    for (let b = b0; b <= b1; b++) if (!this.bands.has(b)) this.addBand(b);
  }

  /** Release bands entirely outside [keep0, keep1]. */
  release(keep0: number, keep1: number): void {
    for (const [b, list] of this.bands) {
      const z0 = b * BAND;
      if (z0 + BAND >= keep0 && z0 <= keep1) continue;
      this.bands.delete(b);
      this.stats.bandsReleased++;
      this.stats.disposed += list.length;
      for (const l of this.listeners) l(b, list, false);
    }
  }

  /** Release everything (dispose). */
  clear(): void {
    this.release(Infinity, -Infinity);
  }

  get bandCount(): number {
    return this.bands.size;
  }

  get count(): number {
    let n = 0;
    for (const l of this.bands.values()) n += l.length;
    return n;
  }

  hasBand(b: number): boolean {
    return this.bands.has(b);
  }

  *all(): Generator<HazardInstance> {
    for (const k of [...this.bands.keys()].sort((a, b) => a - b)) yield* this.bands.get(k)!;
  }

  *inRange(z0: number, z1: number): Generator<HazardInstance> {
    for (let b = Math.floor(z0 / BAND); b <= Math.floor(z1 / BAND); b++) {
      const list = this.bands.get(b);
      if (list) for (const h of list) if (h.z >= z0 && h.z <= z1) yield h;
    }
  }

  /** Instances whose footprint + `pad` reaches (x, z). Writes into `out`. */
  near(x: number, z: number, pad: number, out: HazardInstance[]): HazardInstance[] {
    out.length = 0;
    for (let b = Math.floor((z - pad - 64) / BAND); b <= Math.floor((z + pad + 64) / BAND); b++) {
      const list = this.bands.get(b);
      if (!list) continue;
      for (const h of list) {
        const reach = h.r + pad;
        if (Math.abs(h.z - z) > reach || Math.abs(h.x - x) > reach) continue;
        out.push(h);
      }
    }
    return out;
  }

  /**
   * Instances that [z0, z1] would hold, without streaming anything in (loaded bands are reused;
   * others are generated and dropped). For load-time warm-up and tests.
   */
  peek(z0: number, z1: number): HazardInstance[] {
    const out: HazardInstance[] = [];
    if (this.empty) return out;
    for (let b = Math.floor(z0 / BAND); b <= Math.floor(z1 / BAND); b++) {
      const list = this.bands.get(b) ?? generateHazardBand(this.mountain, this.seed, this.kinds, this.density, b);
      for (const h of list) if (h.z >= z0 && h.z <= z1) out.push(h);
    }
    return out;
  }

  private addBand(b: number) {
    const list = generateHazardBand(this.mountain, this.seed, this.kinds, this.density, b);
    this.bands.set(b, list);
    this.stats.bandsBuilt++;
    this.stats.created += list.length;
    for (const l of this.listeners) l(b, list, true);
  }
}

/**
 * The ground a location's hazards keep clear of obstacles between z0 and z1 (HazardKind.clearZones):
 * the same bands, seed and kinds the run's HazardField generates (BiomeEnvironment uses the course
 * seed for both), so the rock the skier meets and the gap the drift row shows always agree. Cached
 * per mountain and band (pure).
 */
const zoneCache = new WeakMap<Mountain, Map<string, readonly ClearZone[]>>();
/**
 * The weather's clear zones (Whiteout's lee shoulders), cached per mountain and band like the hazard
 * zones (round 3, R2 D N-3: recomputed on every band, ~1,600 heightAt calls each, 3–24 ms slices)
 */
const weatherZoneCache = new WeakMap<Mountain, Map<number, readonly ClearZone[]>>();
function weatherClearZones(m: Mountain, fn: ((m: Mountain, z0: number, z1: number) => readonly ClearZone[]) | undefined, z0: number, z1: number): ClearZone[] {
  if (!fn) return [];
  let cache = weatherZoneCache.get(m);
  if (!cache) weatherZoneCache.set(m, (cache = new Map()));
  const out: ClearZone[] = [];
  for (let b = Math.floor(z0 / BAND); b <= Math.floor(z1 / BAND); b++) {
    let zs = cache.get(b);
    if (!zs) cache.set(b, (zs = fn(m, b * BAND, (b + 1) * BAND)));
    for (const c of zs) if (c.z + c.hz > z0 && c.z - c.hz < z1) out.push(c);
  }
  return out;
}
export function hazardClearZones(m: Mountain, seed: number, z0: number, z1: number): readonly ClearZone[] {
  const caps = capabilitiesOf(m.biome);
  const weather = weatherClearZones(m, caps.weather.clearZones, z0, z1);
  if (caps.hazards.kinds.length === 0 || caps.hazards.density <= 0) return weather;
  const kinds = caps.hazards.kinds.map(getHazardKind);
  if (!kinds.some((k) => k.clearZones)) return weather;
  let cache = zoneCache.get(m);
  if (!cache) zoneCache.set(m, (cache = new Map()));
  const out: ClearZone[] = [...weather];
  for (let b = Math.floor(z0 / BAND); b <= Math.floor(z1 / BAND); b++) {
    const key = `${seed}:${b}`;
    let zs = cache.get(key);
    if (!zs) {
      const list: ClearZone[] = [];
      for (const h of generateHazardBand(m, seed, kinds, caps.hazards.density, b)) {
        const k = kinds.find((kk) => kk.id === h.kind);
        if (k?.clearZones) for (const c of k.clearZones(h)) list.push(c);
      }
      cache.set(key, (zs = list));
    }
    for (const c of zs) if (c.z + c.hz > z0 && c.z - c.hz < z1) out.push(c);
  }
  return out;
}
setObstacleClearings(hazardClearZones);
