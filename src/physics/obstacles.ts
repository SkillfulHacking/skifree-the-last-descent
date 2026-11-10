/**
 * Deterministic, streamed obstacle placement + spatial hash for collision queries.
 *
 * Obstacles are generated in 256 m bands along the course, each from its own seed, so any region
 * can be (re)built independently and in any order with identical results. Bands far behind the
 * skier are released (bounded memory for long and Endless courses). The primary route lane is
 * guaranteed clear of solid obstacles.
 */
import { Rng, clamp, fbm, hash2, smoothstep } from '../core/rng';
import type { Mountain } from '../world/course';

export type ObstacleKind = 'tree' | 'rock' | 'boulder' | 'log' | 'stump';

export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  x: number;
  z: number;
  /** ground height at base */
  y: number;
  /** solid core radius (trunk, rock body). */
  r: number;
  /** soft outer radius (branches) — only trees. */
  softR: number;
  /** height of the solid part above ground (can be jumped over if lower than the skier's clearance). */
  height: number;
  /** yaw for rendering variety / log direction */
  rot: number;
  scale: number;
  variant: number;
  /** For logs: half length along rot direction. */
  halfLen: number;
  /** True if near enough the playable corridor to matter for collision. */
  collidable: boolean;
}

/** Half-width of the guaranteed-clear primary lane around routeX. */
export const LANE_HALF = 6;
/** coastal locations: extra clearance (m) between a rock's edge and the obstacle-free lane */
const EDGE_CLEAR = 1.0;
export const BAND = 256;
const CELL = 6.5;
const X_MIN = -560;
const X_MAX = 560;

export class SpatialHash {
  private cells = new Map<number, number[]>();
  constructor(private cell: number) {}
  private key(ix: number, iz: number) {
    // iz can be large on long courses: fold into a safe integer key
    return ix + 4096 + (iz + 1_000_000) * 8192;
  }
  private span(o: Obstacle): [number, number, number, number] {
    const reach = Math.max(o.softR, o.r, o.halfLen);
    return [Math.floor((o.x - reach) / this.cell), Math.floor((o.x + reach) / this.cell), Math.floor((o.z - reach) / this.cell), Math.floor((o.z + reach) / this.cell)];
  }
  insert(o: Obstacle) {
    const [x0, x1, z0, z1] = this.span(o);
    for (let ix = x0; ix <= x1; ix++)
      for (let iz = z0; iz <= z1; iz++) {
        const k = this.key(ix, iz);
        let arr = this.cells.get(k);
        if (!arr) this.cells.set(k, (arr = []));
        arr.push(o.id);
      }
  }
  remove(o: Obstacle) {
    const [x0, x1, z0, z1] = this.span(o);
    for (let ix = x0; ix <= x1; ix++)
      for (let iz = z0; iz <= z1; iz++) {
        const k = this.key(ix, iz);
        const arr = this.cells.get(k);
        if (!arr) continue;
        const i = arr.indexOf(o.id);
        if (i >= 0) arr.splice(i, 1);
        if (!arr.length) this.cells.delete(k);
      }
  }
  /** Ids of obstacles whose cells overlap the query circle (deduplicated). */
  query(x: number, z: number, radius: number, out: number[]): number[] {
    out.length = 0;
    const x0 = Math.floor((x - radius) / this.cell);
    const x1 = Math.floor((x + radius) / this.cell);
    const z0 = Math.floor((z - radius) / this.cell);
    const z1 = Math.floor((z + radius) / this.cell);
    for (let ix = x0; ix <= x1; ix++)
      for (let iz = z0; iz <= z1; iz++) {
        const arr = this.cells.get(this.key(ix, iz));
        if (!arr) continue;
        for (const id of arr) if (!out.includes(id)) out.push(id);
      }
    return out;
  }
  get cellCount() {
    return this.cells.size;
  }
}

/** Distance from point to the route lane centre. */
export function laneDistance(m: Mountain, x: number, z: number): number {
  return Math.abs(x - m.routeX(z));
}

export type BandListener = (band: number, obstacles: readonly Obstacle[], added: boolean) => void;

export class ObstacleField {
  readonly grid = new SpatialHash(8);
  private bands = new Map<number, Obstacle[]>();
  private byId = new Map<number, Obstacle>();
  private listeners: BandListener[] = [];

  constructor(
    readonly mountain: Mountain,
    readonly seed: number,
  ) {}

  get(id: number): Obstacle | undefined {
    return this.byId.get(id);
  }

  /** Called whenever a band is generated or released (vegetation instancing follows this). */
  onBand(l: BandListener) {
    this.listeners.push(l);
    for (const [b, list] of this.bands) l(b, list, true);
  }

  /** Make sure every band overlapping [z0, z1] exists. */
  ensure(z0: number, z1: number) {
    const b0 = Math.floor(z0 / BAND);
    const b1 = Math.floor(z1 / BAND);
    for (let b = b0; b <= b1; b++) if (!this.bands.has(b)) this.addBand(b);
  }

  /** Release bands entirely outside [keep0, keep1]. */
  release(keep0: number, keep1: number) {
    for (const [b, list] of this.bands) {
      const z0 = b * BAND;
      if (z0 + BAND >= keep0 && z0 <= keep1) continue;
      for (const o of list) {
        if (o.collidable) this.grid.remove(o);
        this.byId.delete(o.id);
      }
      this.bands.delete(b);
      for (const l of this.listeners) l(b, list, false);
    }
  }

  get bandCount() {
    return this.bands.size;
  }
  get obstacleCount() {
    return this.byId.size;
  }

  /** Every currently loaded obstacle (in band order). */
  *all(): Generator<Obstacle> {
    const keys = [...this.bands.keys()].sort((a, b) => a - b);
    for (const k of keys) yield* this.bands.get(k)!;
  }

  /** Obstacles in loaded bands overlapping [z0, z1]. */
  *inRange(z0: number, z1: number): Generator<Obstacle> {
    for (let b = Math.floor(z0 / BAND); b <= Math.floor(z1 / BAND); b++) {
      const list = this.bands.get(b);
      if (list) for (const o of list) if (o.z >= z0 && o.z <= z1) yield o;
    }
  }

  private addBand(b: number) {
    const list = generateBand(this.mountain, this.seed, b);
    this.bands.set(b, list);
    for (const o of list) {
      this.byId.set(o.id, o);
      if (o.collidable) this.grid.insert(o);
    }
    for (const l of this.listeners) l(b, list, true);
  }
}

/** Deterministic obstacle generation for one band. */
export function generateBand(m: Mountain, seed: number, band: number): Obstacle[] {
  const P = m.profile;
  // location mix (alpine: all 1 / no weights, i.e. the original placement, draw for draw)
  const B = m.biome;
  const kTrees = B.trees.density;
  const kRocks = B.obstacles.rocks;
  const kLogs = B.obstacles.logs;
  const kStumps = B.obstacles.stumps;
  const speciesW = B.trees.speciesWeights;
  const rng = new Rng((seed ^ 0x0b57ac1e ^ Math.imul(band + 7919, 0x85ebca6b)) >>> 0);
  const list: Obstacle[] = [];
  const zA = band * BAND;
  const zB = zA + BAND;
  // generation never goes further up than the summit massif
  if (zB < -260) return list;
  const finishZ = P.finishZ;
  const cps = P.checkpoints(zA - 200, zB + 200);
  const kickers = P.kickersNear(zA - 40, zB + 40, []);
  const caves = P.encounters(zA - 60, zB + 60).map((e) => ({ x: e.anchor.centerX + e.anchor.side * e.anchor.d, z: e.anchor.z, side: e.anchor.side, d: e.anchor.d }));
  const hasAlt = P.altRoutes(zA - 10, zB + 10).length > 0;
  const coast = m.coast;
  const lookouts = coast ? coast.lookouts(zA - 70, zB + 70) : [];
  const nearKicker = (x: number, z: number) => kickers.some((k) => z > k.z - k.run - 18 && z < k.z + 26 && Math.abs(x - (m.centerX(k.z) + k.d)) < k.width * 0.5 + 6);
  let local = 0;
  const add = (o: Omit<Obstacle, 'id' | 'collidable' | 'y'>) => {
    const y = m.heightAt(o.x, o.z);
    const ad = Math.abs(o.x - m.centerX(o.z));
    list.push({ ...o, id: band * 65536 + local++, y, collidable: ad < m.halfWidth(o.z) + 60 });
  };

  for (let gz = Math.max(zA, -260); gz < zB; gz += CELL) {
    // per-row seed so a band's layout does not depend on generation order
    for (let gx = X_MIN; gx < X_MAX; gx += CELL) {
      const x = gx + rng.range(0.1, 0.9) * CELL;
      const z = gz + rng.range(0.1, 0.9) * CELL;
      const roll = rng.float();
      const roll2 = rng.float();
      if (z >= zB) continue;
      const cx = m.centerX(z);
      const w = m.halfWidth(z);
      const d = x - cx;
      const ad = Math.abs(d);
      const lane = Math.abs(x - m.routeX(z));
      if (lane < LANE_HALF + 1.5) continue; // primary route stays clear
      const alt = hasAlt ? P.altRouteX(z) : null;
      if (alt !== null && Math.abs(x - alt) < LANE_HALF + 1.0) continue; // alternate lines too
      if (Number.isFinite(finishZ) && z > finishZ - 60 && ad < 140) continue; // finish chute & resort
      if (cps.some((c) => Math.abs(z - c) < 120 && ad < 110)) continue; // Endless checkpoint lodges
      if (z < 40 && z > -60 && ad < 40) continue; // start platform
      if (caves.some((c) => Math.hypot(x - c.x, z - c.z) < 26)) continue; // cave mouth
      if (nearKicker(x, z)) continue;
      if (caves.some((c) => d * c.side > c.d - 16 && Math.abs(z - c.z) < 40)) continue; // keep cave clearing open
      // coast: nothing on the cornice, the cliff or in the water; viewpoints stay clear
      if (coast && (coast.beyondRim(x, z) > -5 || lookouts.some((l) => Math.hypot(x - l.x, z - l.z) < 13))) continue;
      // …and the swerve from the line to a chase viewpoint beside it stays clear
      if (lookouts.some((l) => l.chase && z > l.z - 60 && z < l.z + 30 && x > l.x - 5 && x < m.routeX(z))) continue;

      // altitude/biome tree line: open alpine where the profile says so, forests elsewhere
      const treeLine = P.treeLine(z);
      const forest = P.forest(z);
      const forestNoise = fbm(x / 90, z / 90, seed + 31, 3); // clumping
      const onPiste = ad < w * 0.92;
      let treeDensity: number;
      if (onPiste) {
        // islands of trees on the piste, more in mid/lower mountain
        treeDensity = 0.022 * treeLine + 0.12 * smoothstep(0.35, 0.6, forestNoise) * treeLine * smoothstep(w * 0.35, w * 0.9, ad);
        treeDensity *= 0.5 + 0.5 * forest;
      } else {
        treeDensity = (0.28 + 0.55 * smoothstep(-0.2, 0.4, forestNoise)) * (0.25 + 0.75 * treeLine) * (0.55 + 0.45 * Math.min(forest, 1.6));
        // thinning high up the valley walls (scree/cliffs)
        treeDensity *= 1 - smoothstep(w + 160, w + 330, ad);
        // avalanche paths: treeless chutes running down the valley walls
        const chute = smoothstep(0.86, 0.95, 0.5 + 0.5 * Math.sin(z / 95 + Math.sign(d) * 1.3 + Math.sin(z / 330) * 2));
        treeDensity *= 1 - chute * smoothstep(w + 15, w + 50, ad);
      }
      if (lane < LANE_HALF + 6) treeDensity *= 0.35;
      treeDensity *= kTrees;

      // no forests on cliffs: trees thin out on steep ground and are gone above ~45° (only
      // sampled for candidates that would otherwise grow, so it costs little)
      if (roll < treeDensity && !onPiste) {
        const gx2 = m.heightAt(x + 2, z) - m.heightAt(x - 2, z);
        const gz2 = m.heightAt(x, z + 2) - m.heightAt(x, z - 2);
        const steep = Math.hypot(gx2, gz2) / 4; // tan(slope)
        treeDensity *= 1 - smoothstep(0.55, 1.0, steep);
      }
      if (roll < treeDensity) {
        // size/age variety: saplings, mature trees and old giants (clumped by noise)
        const age = hash2(Math.floor(x * 3), Math.floor(z * 3), seed + 77);
        const scale = (age < 0.18 ? rng.range(0.45, 0.7) : age > 0.9 ? rng.range(1.35, 1.7) : rng.range(0.75, 1.3)) * (onPiste ? 0.9 : 1);
        const height = 9 * scale + rng.range(-1, 2);
        add({ kind: 'tree', x, z, r: 0.32 * scale, softR: 1.9 * scale, height, rot: rng.range(0, Math.PI * 2), scale, variant: speciesW ? pickSpecies(rng.float(), speciesW) : rng.int(0, 2), halfLen: 0 });
        continue;
      }
      const rb = P.rockBias(z);
      const rockDensity = (onPiste ? 0.012 + 0.02 * smoothstep(w * 0.5, w * 0.9, ad) : 0.05 + 0.08 * smoothstep(w + 20, w + 120, ad)) * clamp(rb, 0.3, 3) * kRocks;
      if (roll2 < rockDensity) {
        const big = rng.chance(onPiste ? 0.25 : 0.55);
        const scale = big ? rng.range(1.4, 2.6) : rng.range(0.35, 0.8);
        const rr = big ? 0.9 * scale : 0.75 * scale;
        // a coast (round 3, B N4): the rock's edge, not only its centre, keeps clear of the lane, so
        // the way round a scoured-rock patch on the line never runs into a boulder
        if (coast && lane - rr < LANE_HALF + 1.5 + EDGE_CLEAR) continue;
        add({ kind: big ? 'boulder' : 'rock', x, z, r: big ? 0.9 * scale : 0.75 * scale, softR: 0, height: big ? 1.1 * scale : 0.55 * scale, rot: rng.range(0, Math.PI * 2), scale, variant: rng.int(0, 3), halfLen: 0 });
        continue;
      }
      if (onPiste && z > 300 && rng.chance(0.0035 * kLogs)) {
        // fallen log across the slope (never reaching into the lane)
        const rot = Math.PI / 2 + rng.range(-0.5, 0.5);
        const halfLen = rng.range(2.2, 3.5);
        const ex = Math.abs(Math.cos(rot)) * halfLen;
        if (lane - ex < LANE_HALF + 0.5) continue;
        add({ kind: 'log', x, z, r: 0.28, softR: 0, height: 0.55, rot, scale: 1, variant: 0, halfLen });
      } else if (rng.chance(0.004 * kStumps) && !onPiste) {
        add({ kind: 'stump', x, z, r: 0.35, softR: 0, height: 0.5, rot: 0, scale: 1, variant: 0, halfLen: 0 });
      }
    }
  }
  return list;
}

/**
 * Tree species slot (0..2) from one uniform draw u in [0,1) and relative weights (consumes the
 * same single draw as the unweighted `rng.int(0, 2)`, so the rest of the stream is unaffected).
 */
export function pickSpecies(u: number, w: readonly [number, number, number]): number {
  const a = Math.max(0, w[0]);
  const b = Math.max(0, w[1]);
  const c = Math.max(0, w[2]);
  const sum = a + b + c;
  if (!(sum > 0)) return Math.floor(u * 3);
  const t = u * sum;
  return t < a ? 0 : t < a + b ? 1 : 2;
}

/** Build a field and load the whole of a (short) course — convenience for tests and Sprint. */
export function generateObstacles(m: Mountain, seed: number, z0 = -260, z1?: number): ObstacleField {
  const f = new ObstacleField(m, seed);
  const end = z1 ?? (Number.isFinite(m.finishZ) ? m.finishZ + 420 : 3420);
  f.ensure(z0, end);
  return f;
}

/** Clearance check helper used by tests: min distance from lane centre to any solid obstacle. */
export function laneClearance(field: ObstacleField, z0: number, z1: number): number {
  field.ensure(z0, z1);
  const m = field.mountain;
  let best = Infinity;
  for (const o of field.inRange(z0, z1)) {
    let dist: number;
    if (o.kind === 'log') {
      const ex = Math.abs(Math.cos(o.rot)) * o.halfLen;
      dist = laneDistance(m, o.x, o.z) - ex - o.r;
    } else dist = laneDistance(m, o.x, o.z) - o.r;
    best = Math.min(best, dist);
  }
  return clamp(best, -1e9, 1e9);
}
