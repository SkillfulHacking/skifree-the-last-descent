/**
 * Deterministic obstacle placement + spatial hash for collision queries.
 * Pure logic (no rendering). The primary route lane is guaranteed clear of solid obstacles.
 */
import { Rng, clamp, fbm, smoothstep } from '../core/rng';
import { COURSE, Mountain, centerX, halfWidth, routeX, CAVE_D } from '../world/course';

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

export interface ObstacleField {
  list: Obstacle[];
  grid: SpatialHash;
}

export class SpatialHash {
  private cells = new Map<number, number[]>();
  constructor(private cell: number) {}
  private key(ix: number, iz: number) {
    return (ix + 4096) * 8192 + (iz + 4096);
  }
  insert(o: Obstacle) {
    const reach = Math.max(o.softR, o.r, o.halfLen);
    const x0 = Math.floor((o.x - reach) / this.cell);
    const x1 = Math.floor((o.x + reach) / this.cell);
    const z0 = Math.floor((o.z - reach) / this.cell);
    const z1 = Math.floor((o.z + reach) / this.cell);
    for (let ix = x0; ix <= x1; ix++)
      for (let iz = z0; iz <= z1; iz++) {
        const k = this.key(ix, iz);
        let arr = this.cells.get(k);
        if (!arr) this.cells.set(k, (arr = []));
        arr.push(o.id);
      }
  }
  /** Calls cb for each obstacle id whose cell overlaps the query circle (may repeat ids across cells: dedupe in caller if needed). */
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
}

/** Distance from point to the route lane centre. */
export function laneDistance(x: number, z: number): number {
  return Math.abs(x - routeX(z));
}

export function generateObstacles(m: Mountain, seed: number): ObstacleField {
  const rng = new Rng(seed ^ 0x0b57ac1e);
  const list: Obstacle[] = [];
  const kickers = m.features.kickers;
  const nearKicker = (x: number, z: number) =>
    kickers.some((k) => z > k.z - k.run - 18 && z < k.z + 26 && Math.abs(x - (centerX(k.z) + k.d)) < k.width * 0.5 + 6);
  const cave = { x: centerX(COURSE.caveZ) + CAVE_D, z: COURSE.caveZ };

  const add = (o: Omit<Obstacle, 'id' | 'collidable' | 'y'>) => {
    const id = list.length;
    const y = m.heightAt(o.x, o.z);
    const ad = Math.abs(o.x - centerX(o.z));
    list.push({ ...o, id, y, collidable: ad < halfWidth(o.z) + 60 });
  };

  const CELL = 6.5;
  const xMin = -560;
  const xMax = 560;
  const zMin = -260;
  const zMax = 3420;
  for (let gz = zMin; gz < zMax; gz += CELL) {
    for (let gx = xMin; gx < xMax; gx += CELL) {
      const x = gx + rng.range(0.1, 0.9) * CELL;
      const z = gz + rng.range(0.1, 0.9) * CELL;
      const roll = rng.float();
      const roll2 = rng.float();
      const cx = centerX(z);
      const w = halfWidth(z);
      const d = x - cx;
      const ad = Math.abs(d);
      const lane = laneDistance(x, z);
      if (lane < LANE_HALF + 1.5) continue; // primary route stays clear
      if (z > COURSE.finishZ - 60 && ad < 140) continue; // finish chute & resort handled by Resort module
      if (z < 40 && z > -60 && ad < 40) continue; // start platform
      if (Math.hypot(x - cave.x, z - cave.z) < 26) continue; // cave mouth
      if (nearKicker(x, z)) continue;
      if (d > CAVE_D - 16 && Math.abs(z - COURSE.caveZ) < 40) continue; // keep cave clearing open

      // altitude tree line: open alpine at the summit, forests lower down
      const treeLine = smoothstep(120, 520, z);
      const forestNoise = fbm(x / 90, z / 90, seed + 31, 3); // clumping
      const onPiste = ad < w * 0.92;
      let treeDensity: number;
      if (onPiste) {
        // islands of trees on the piste, more in mid/lower mountain
        treeDensity = 0.022 * treeLine + 0.12 * smoothstep(0.35, 0.6, forestNoise) * treeLine * smoothstep(w * 0.35, w * 0.9, ad);
      } else {
        treeDensity = (0.28 + 0.55 * smoothstep(-0.2, 0.4, forestNoise)) * (0.25 + 0.75 * treeLine);
        // thinning high up the valley walls (scree/cliffs)
        treeDensity *= 1 - smoothstep(w + 160, w + 330, ad);
        // avalanche paths: treeless chutes running down the valley walls
        const chute = smoothstep(0.86, 0.95, 0.5 + 0.5 * Math.sin(z / 95 + Math.sign(d) * 1.3 + Math.sin(z / 330) * 2));
        treeDensity *= 1 - chute * smoothstep(w + 15, w + 50, ad);
      }
      if (lane < LANE_HALF + 6) treeDensity *= 0.35;

      if (roll < treeDensity) {
        const scale = rng.range(0.75, 1.35) * (onPiste ? 0.9 : 1);
        const height = 9 * scale + rng.range(-1, 2);
        add({
          kind: 'tree',
          x,
          z,
          r: 0.32 * scale,
          softR: 1.9 * scale,
          height,
          rot: rng.range(0, Math.PI * 2),
          scale,
          variant: rng.int(0, 2),
          halfLen: 0,
        });
        continue;
      }
      const rockDensity = onPiste ? 0.012 + 0.02 * smoothstep(w * 0.5, w * 0.9, ad) : 0.05 + 0.08 * smoothstep(w + 20, w + 120, ad);
      if (roll2 < rockDensity) {
        const big = rng.chance(onPiste ? 0.25 : 0.55);
        const scale = big ? rng.range(1.4, 2.6) : rng.range(0.35, 0.8);
        add({
          kind: big ? 'boulder' : 'rock',
          x,
          z,
          r: big ? 0.9 * scale : 0.75 * scale,
          softR: 0,
          height: big ? 1.1 * scale : 0.55 * scale,
          rot: rng.range(0, Math.PI * 2),
          scale,
          variant: rng.int(0, 3),
          halfLen: 0,
        });
        continue;
      }
      if (onPiste && z > 300 && rng.chance(0.0035)) {
        // fallen log across the slope (half on the route side lanes)
        const rot = Math.PI / 2 + rng.range(-0.5, 0.5);
        const halfLen = rng.range(2.2, 3.5);
        // ensure the log does not reach into the lane
        const ex = Math.abs(Math.cos(rot)) * halfLen;
        if (lane - ex < LANE_HALF + 0.5) continue;
        add({ kind: 'log', x, z, r: 0.28, softR: 0, height: 0.55, rot, scale: 1, variant: 0, halfLen });
      } else if (rng.chance(0.004) && !onPiste) {
        add({ kind: 'stump', x, z, r: 0.35, softR: 0, height: 0.5, rot: 0, scale: 1, variant: 0, halfLen: 0 });
      }
    }
  }

  // Foreshadowing & storytelling props are spawned by the game layer; obstacles stay deterministic.
  const grid = new SpatialHash(8);
  for (const o of list) if (o.collidable) grid.insert(o);
  return { list, grid };
}

/** Clearance check helper used by tests: min distance from lane centre to any solid obstacle at given z range. */
export function laneClearance(field: ObstacleField, z0: number, z1: number): number {
  let best = Infinity;
  for (const o of field.list) {
    if (o.z < z0 || o.z > z1) continue;
    let dist: number;
    if (o.kind === 'log') {
      const ex = Math.abs(Math.cos(o.rot)) * o.halfLen;
      dist = laneDistance(o.x, o.z) - ex - o.r;
    } else dist = laneDistance(o.x, o.z) - o.r;
    best = Math.min(best, dist);
  }
  return clamp(best, -1e9, 1e9);
}
