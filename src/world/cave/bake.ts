/**
 * Baked lighting terms for the cave: sky visibility (how much of the sky a point sees — this is what
 * makes the chamber genuinely dark and keeps snow out of it) and short-range ambient occlusion (crevices,
 * strata undercuts, the contact with the ground). Occluders: the rock field and the terrain heightfield.
 */
import type { RockField } from './rockField';
import { NEVER, type Tick } from './budget';

export interface Ground {
  /** visible ground height (terrain) */
  at(x: number, z: number): number;
}

/** Cosine-ish distributed directions over the upper hemisphere (elevation ≥ ~4°). */
function skyDirs(n: number): Float32Array {
  const out = new Float32Array(n * 3);
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 0.07 + 0.93 * Math.sqrt((i + 0.5) / n); // biased toward the zenith (cosine weighting)
    const r = Math.sqrt(1 - y * y);
    const a = i * ga;
    out[i * 3] = Math.cos(a) * r;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = Math.sin(a) * r;
  }
  return out;
}

export class VisibilityGrid {
  readonly x0: number;
  readonly y0: number;
  readonly z0: number;
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
  readonly cell: number;
  /** visibility in 0..1, or -1 where the node is inside rock / not computed */
  readonly vis: Float32Array;

  constructor(
    private f: RockField,
    private ground: Ground,
    cell: number,
    private rays: number,
    private skip?: (z: number) => boolean,
    sync = true,
  ) {
    this.cell = cell;
    this.x0 = f.x0;
    this.y0 = f.y0;
    this.z0 = f.z0;
    this.nx = Math.ceil(((f.nx - 1) * f.cell) / cell) + 1;
    this.ny = Math.ceil(((f.ny - 1) * f.cell) / cell) + 1;
    this.nz = Math.ceil(((f.nz - 1) * f.cell) / cell) + 1;
    this.vis = new Float32Array(this.nx * this.ny * this.nz).fill(-1);
    if (sync) {
      const g = this.compute(NEVER);
      while (!g.next().done);
    }
  }

  *compute(tk: Tick): Generator<void, void, void> {
    const f = this.f, ground = this.ground, rays = this.rays, skip = this.skip, cell = this.cell;
    const dirs = skyDirs(rays);
    const top = f.y0 + (f.ny - 1) * f.cell;
    for (let iz = 0; iz < this.nz; iz++) {
      const z = this.z0 + iz * cell;
      for (let ix = 0; ix < this.nx; ix++) {
        const x = this.x0 + ix * cell;
        const gy = ground.at(x, z);
        for (let iy = 0; iy < this.ny; iy++) {
          const y = this.y0 + iy * cell;
          if (y < gy - 0.5) continue;
          if (tk.over()) {
            yield;
            tk.reset();
          }
          const d0 = f.sample(x, y, z);
          if (d0 < -0.3 || d0 > 3.2) continue; // inside rock, or far from any rock (filled below)
          if (skip && skip(z)) continue;
          let sum = 0, wsum = 0;
          for (let r = 0; r < rays; r++) {
            const dx = dirs[r * 3]!, dy = dirs[r * 3 + 1]!, dz = dirs[r * 3 + 2]!;
            let t = 0.35;
            let free = 1;
            while (t < 45) {
              const px = x + dx * t, py = y + dy * t, pz = z + dz * t;
              if (py > top) break;
              const dd = f.sample(px, py, pz);
              if (dd < 0.05) {
                free = 0;
                break;
              }
              if (py < ground.at(px, pz)) {
                free = 0;
                break;
              }
              t += Math.max(0.35, dd * 0.8);
            }
            sum += free * dy;
            wsum += dy;
          }
          this.vis[ix + this.nx * (iy + this.ny * iz)] = sum / wsum;
        }
      }
    }
  }

  /** Weighted trilinear lookup ignoring uncomputed nodes; far from rock defaults to open sky. */
  at(x: number, y: number, z: number): number {
    const fx = (x - this.x0) / this.cell, fy = (y - this.y0) / this.cell, fz = (z - this.z0) / this.cell;
    if (fx < 0 || fy < 0 || fz < 0 || fx >= this.nx - 1 || fy >= this.ny - 1 || fz >= this.nz - 1) return 1;
    const ix = Math.floor(fx), iy = Math.floor(fy), iz = Math.floor(fz);
    const tx = fx - ix, ty = fy - iy, tz = fz - iz;
    let s = 0, w = 0;
    for (let c = 0; c < 8; c++) {
      const ox = c & 1, oy = (c >> 1) & 1, oz = (c >> 2) & 1;
      const val = this.vis[ix + ox + this.nx * (iy + oy + this.ny * (iz + oz))]!;
      if (val < 0) continue;
      const wt = (ox ? tx : 1 - tx) * (oy ? ty : 1 - ty) * (oz ? tz : 1 - tz) + 1e-4;
      s += val * wt;
      w += wt;
    }
    if (w <= 0) {
      // no computed neighbour: far from rock → open (unless inside the rock field)
      return this.f.sample(x, y, z) > 2 ? 0.85 : 0;
    }
    return s / w;
  }
}

/** Short-range AO along the normal against rock and ground (1 = open). */
export function localAO(f: RockField, ground: Ground, x: number, y: number, z: number, nx: number, ny: number, nz: number): number {
  let occ = 0;
  let w = 0.5;
  for (const d of [0.35, 0.8, 1.5, 2.6]) {
    const px = x + nx * d, py = y + ny * d, pz = z + nz * d;
    const dd = Math.min(f.sample(px, py, pz) / 0.8, py - ground.at(px, pz));
    occ += w * Math.max(0, (d - dd) / d);
    w *= 0.6;
  }
  return Math.max(0, Math.min(1, 1 - occ * 0.9));
}
