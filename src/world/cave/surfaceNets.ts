/**
 * Naive surface nets over a scalar grid (negative = inside). Produces a watertight, shared-vertex
 * quad mesh (split into triangles along the shorter diagonal), wound so normals point outward (toward
 * positive values).
 */
export interface NetsGrid {
  nx: number;
  ny: number;
  nz: number;
  x0: number;
  y0: number;
  z0: number;
  cell: number;
  data: Float32Array;
}

import { NEVER, type Tick } from './budget';

export interface NetsResult {
  positions: Float32Array;
  indices: Uint32Array;
}

export function surfaceNets(g: NetsGrid): NetsResult {
  const it = surfaceNetsSteps(g, NEVER);
  for (;;) {
    const r = it.next();
    if (r.done) return r.value;
  }
}

export function* surfaceNetsSteps(g: NetsGrid, tk: Tick): Generator<void, NetsResult, void> {
  const { nx, ny, nz, cell, data } = g;
  const sxy = nx * ny;
  const cnx = nx - 1, cny = ny - 1, cnz = nz - 1;
  const cellVert = new Int32Array(cnx * cny * cnz).fill(-1);
  const pos: number[] = [];
  // corner offsets
  const off = [0, 1, nx, nx + 1, sxy, sxy + 1, sxy + nx, sxy + nx + 1];
  const cxo = [0, 1, 0, 1, 0, 1, 0, 1], cyo = [0, 0, 1, 1, 0, 0, 1, 1], czo = [0, 0, 0, 0, 1, 1, 1, 1];
  const EDGES = [
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ] as const;
  const EA = EDGES.map((e) => e[0]), EB = EDGES.map((e) => e[1]);
  const v = new Float64Array(8);
  // per cell column: the y range where the sign can change
  const yLo = new Int32Array(cnx * cnz), yHi = new Int32Array(cnx * cnz);
  for (let iz = 0; iz < nz; iz++) {
    if (tk.over()) {
      yield;
      tk.reset();
    }
    for (let ix = 0; ix < nx; ix++) {
      let lo = -1, hi = -1;
      let prev = data[ix + sxy * iz]! < 0;
      for (let iy = 1; iy < ny; iy++) {
        const cur = data[ix + nx * iy + sxy * iz]! < 0;
        if (cur !== prev) {
          if (lo < 0) lo = iy - 1;
          hi = iy;
        }
        prev = cur;
      }
      // spread to the 4 cell columns touching this node column
      for (let dz = -1; dz <= 0; dz++) {
        for (let dx = -1; dx <= 0; dx++) {
          const cx = ix + dx, cz = iz + dz;
          if (cx < 0 || cz < 0 || cx >= cnx || cz >= cnz) continue;
          const k = cx + cnx * cz;
          if (lo >= 0) {
            yLo[k] = yHi[k] === 0 && yLo[k] === 0 ? lo : Math.min(yLo[k]!, lo);
            yHi[k] = Math.max(yHi[k]!, hi);
          }
        }
      }
    }
  }
  for (let iz = 0; iz < cnz; iz++) {
    if (tk.over()) {
      yield;
      tk.reset();
    }
    for (let ix = 0; ix < cnx; ix++) {
      const kc = ix + cnx * iz;
      const ya = Math.max(0, yLo[kc]! - 1), yb = Math.min(cny - 1, yHi[kc]! + 1);
      if (yHi[kc] === 0) continue;
      for (let iy = ya; iy <= yb; iy++) {
        const base = ix + nx * iy + sxy * iz;
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const val = data[base + off[c]!]!;
          v[c] = val;
          if (val < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (let ei = 0; ei < 12; ei++) {
          const a = EA[ei]!, b = EB[ei]!;
          const va = v[a]!, vb = v[b]!;
          if (va < 0 !== vb < 0) {
            const t = va / (va - vb);
            sx += cxo[a]! + (cxo[b]! - cxo[a]!) * t;
            sy += cyo[a]! + (cyo[b]! - cyo[a]!) * t;
            sz += czo[a]! + (czo[b]! - czo[a]!) * t;
            n++;
          }
        }
        cellVert[ix + cnx * (iy + cny * iz)] = pos.length / 3;
        pos.push(g.x0 + (ix + sx / n) * cell, g.y0 + (iy + sy / n) * cell, g.z0 + (iz + sz / n) * cell);
      }
    }
  }
  const idx: number[] = [];
  const P = pos;
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) {
      const t = b;
      b = d;
      d = t;
    }
    const d1 = (P[a * 3]! - P[c * 3]!) ** 2 + (P[a * 3 + 1]! - P[c * 3 + 1]!) ** 2 + (P[a * 3 + 2]! - P[c * 3 + 2]!) ** 2;
    const d2 = (P[b * 3]! - P[d * 3]!) ** 2 + (P[b * 3 + 1]! - P[d * 3 + 1]!) ** 2 + (P[b * 3 + 2]! - P[d * 3 + 2]!) ** 2;
    if (d1 <= d2) idx.push(a, b, c, a, c, d);
    else idx.push(a, b, d, b, c, d);
  };
  const cv = (ix: number, iy: number, iz: number) => (ix < 0 || iy < 0 || iz < 0 || ix >= cnx || iy >= cny || iz >= cnz ? -1 : cellVert[ix + cnx * (iy + cny * iz)]!);
  for (let iz = 0; iz < nz; iz++) {
    if (tk.over()) {
      yield;
      tk.reset();
    }
    for (let ix = 0; ix < nx; ix++) {
      const kc = Math.min(cnx - 1, ix) + cnx * Math.min(cnz - 1, iz);
      if (yHi[kc] === 0 && (ix === 0 || yHi[kc - 1] === 0) && (iz === 0 || yHi[kc - cnx] === 0) && (ix === 0 || iz === 0 || yHi[kc - cnx - 1] === 0)) continue;
      let ya = yLo[kc]!, yb = yHi[kc]!;
      for (const o of [1, cnx, cnx + 1]) {
        const k2 = kc - o;
        if (k2 >= 0 && yHi[k2]! > 0) {
          ya = yHi[kc] === 0 ? yLo[k2]! : Math.min(ya, yLo[k2]!);
          yb = Math.max(yb, yHi[k2]!);
        }
      }
      ya = Math.max(0, ya - 1);
      yb = Math.min(ny - 1, yb + 1);
      for (let iy = ya; iy <= yb; iy++) {
        const i0 = ix + nx * iy + sxy * iz;
        const in0 = data[i0]! < 0;
        // x-edge: cells sharing it vary in y,z
        if (ix < cnx && in0 !== data[i0 + 1]! < 0 && iy > 0 && iz > 0) {
          quad(cv(ix, iy - 1, iz - 1), cv(ix, iy, iz - 1), cv(ix, iy, iz), cv(ix, iy - 1, iz), !in0);
        }
        if (iy < cny && in0 !== data[i0 + nx]! < 0 && ix > 0 && iz > 0) {
          quad(cv(ix - 1, iy, iz - 1), cv(ix - 1, iy, iz), cv(ix, iy, iz), cv(ix, iy, iz - 1), !in0);
        }
        if (iz < cnz && in0 !== data[i0 + sxy]! < 0 && ix > 0 && iy > 0) {
          quad(cv(ix - 1, iy - 1, iz), cv(ix, iy - 1, iz), cv(ix, iy, iz), cv(ix - 1, iy, iz), !in0);
        }
      }
    }
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}
