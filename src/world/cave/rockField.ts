/**
 * The cave formation as a signed distance field (negative = rock), sampled on a regular grid.
 *
 * One continuous body: a stratified front face (bedding-plane ledges, vertical joints, erosion noise) with
 * an overhanging brow, a rounded top that sinks into the plateau behind, a rock shelf under the mouth
 * ledge, a few half-buried rock-fall blocks fused into the cliff base, minus the chamber (a noisy
 * superellipse tube along the shared chamber path, with talus fillets where the walls meet the floor).
 *
 * Evaluation is split into per-column terms (everything that depends only on x/z, computed once) and the
 * per-sample terms; a coarse pass decides where the exact field is needed (a narrow band around the
 * surface), everywhere else the coarse field is interpolated.
 */
import { gnoise, smoothstep } from '../../core/rng';
import {
  type CaveAnchor,
  FORM,
  bankOffset,
  chamberCeiling,
  chamberHalfWidth,
  chamberQuery,
  cliffHeight,
  faceBase,
  formBand,
  cliffSurfaceUc,
  cliffRun,
  floorLiftRaw,
  type ChamberHit,
} from '../caveTerrain';
import { noise3, smax, smin } from './noise';
import { NEVER, type Tick } from './budget';

export interface FieldParams {
  anchor: CaveAnchor;
  seed: number;
  cell: number;
  centerX: (z: number) => number;
  /** natural terrain height (before the cave), smooth */
  hRaw: (x: number, z: number) => number;
  /** visible terrain height; everything more than 0.8 m below it is treated as solid (never visible) */
  ground: (x: number, z: number) => number;
}

/** Half-buried rock-fall blocks at the cliff base: (u, v, y above bank, radii u/y/v). */
const BLOCKS: ReadonlyArray<readonly [number, number, number, number, number, number]> = [
  [-3.2, -10.5, -0.9, 2.3, 1.7, 2.7],
  [-5.2, -14.0, -0.9, 1.5, 1.1, 1.8],
  [-2.6, 11.0, -0.7, 2.1, 1.6, 2.3],
  [-4.6, 14.5, -0.9, 1.8, 1.3, 2.1],
  [-6.4, 18.5, -0.5, 1.5, 1.1, 1.6],
];

export class RockField {
  readonly a: CaveAnchor;
  readonly seed: number;
  readonly cell: number;
  readonly x0: number;
  y0 = 0;
  readonly z0: number;
  readonly nx: number;
  ny = 0;
  readonly nz: number;
  data = new Float32Array(0);
  /** world X of the frame origin */
  readonly mx: number;
  evals = 0;
  private wob = new Float32Array(512); // strata wobble, indexed by (Yr + 16) * 8
  private bandTab = new Float32Array(0); // band offset per (column z-row, band index + 8)
  private static readonly NB = 40;

  // per-column terms (index = ix + iz * nx)
  readonly cU: Float32Array;
  readonly cV: Float32Array;
  readonly cUc: Float32Array;
  readonly cB: Float32Array; // absolute base (h + bank)
  readonly cTop: Float32Array; // top surface above B
  readonly cFace: Float32Array; // face base + joints
  readonly cPh: Float32Array; // strata phase
  readonly cBand: Float32Array; // strata band key (lateral coordinate)
  readonly cFloor: Float32Array; // floor height above B (chamber)
  readonly cS: Float32Array;
  readonly cL: Float32Array;
  readonly cDist: Float32Array;
  readonly cHw: Float32Array;
  readonly cCeil: Float32Array;
  readonly cBrow: Float32Array;
  readonly cSlab: Float32Array; // slab lateral term
  readonly cLo: Float32Array;
  readonly cHc: Float32Array;
  readonly cW: Float32Array; // 0 core … 1 merged into the terrain cliff
  readonly cRun: Float32Array;
  readonly cHi: Float32Array;

  private p: FieldParams;

  constructor(p: FieldParams) {
    this.p = p;
    const a = (this.a = p.anchor);
    this.seed = p.seed;
    const cell = (this.cell = p.cell);
    this.mx = a.centerX + a.side * (a.d + 2);
    const uMin = -12, uMax = 31, vMin = -42, vMax = 44;
    const xa = this.mx + a.side * uMin, xb = this.mx + a.side * uMax;
    this.x0 = Math.min(xa, xb);
    this.z0 = a.z + vMin;
    this.nx = Math.ceil(Math.abs(xb - xa) / cell) + 1;
    this.nz = Math.ceil((vMax - vMin) / cell) + 1;
    const nc = this.nx * this.nz;
    const F = () => new Float32Array(nc);
    this.cU = F(); this.cV = F(); this.cUc = F(); this.cB = F(); this.cTop = F(); this.cFace = F(); this.cPh = F(); this.cBand = F();
    this.cFloor = F(); this.cS = F(); this.cL = F(); this.cDist = F(); this.cHw = F(); this.cCeil = F(); this.cBrow = F(); this.cSlab = F();
    this.cLo = F(); this.cHi = F(); this.cHc = F(); this.cW = F(); this.cRun = F();
  }

  private *columns(tk: Tick): Generator<void, void, void> {
    const p = this.p;
    const a = this.a;
    const cell = this.cell;
    let yMin = Infinity, yMax = -Infinity;
    const hit: ChamberHit = { s: 0, l: 0, dist: 0 };
    const sd = p.seed;
    for (let iz = 0; iz < this.nz; iz++) {
      if (tk.over()) {
        yield;
        tk.reset();
      }
      const z = this.z0 + iz * cell;
      const cx = p.centerX(z);
      for (let ix = 0; ix < this.nx; ix++) {
        const x = this.x0 + ix * cell;
        const ci = ix + iz * this.nx;
        const u = (x - this.mx) * a.side, v = z - a.z;
        const uc = (x - cx) * a.side - (a.d + 2);
        const B = p.hRaw(x, z) + bankOffset(uc);
        const av = Math.abs(v - FORM.vc);
        const Hc = cliffHeight(x, z, v, sd);
        const wb = formBand(v);
        const crag = 3.2 * Math.max(0, gnoise(v * 0.045 + 0.3, u * 0.03, sd + 33)) ** 1.5 + 1.6 * Math.max(0, gnoise(v * 0.11, u * 0.08, sd + 34));
        const top = Hc + (0.9 + crag * (1 - smoothstep(6, 26, uc)) + 1.0 * Math.max(0, gnoise(u * 0.07, v * 0.07, sd + 31)) + 0.5 * gnoise(u * 0.2, v * 0.2, sd + 32)) * (1 - wb) - 5.5 * smoothstep(FORM.uBack - 9, FORM.uBack - 1, uc) - 9 * smoothstep(FORM.core0 - 2, FORM.core1 + 4, av);
        // vertical joints: two sets of narrow recessed grooves
        const j1 = 1 - Math.abs(gnoise(v * 0.16 + uc * 0.05, 1.7, sd + 41)) * 3.2;
        const j2 = 1 - Math.abs(gnoise(v * 0.29 - uc * 0.04, 6.3, sd + 43)) * 4.0;
        const joints = (0.9 * Math.max(0, j1) ** 2 + 0.5 * Math.max(0, j2) ** 2) * (0.4 + 0.6 * smoothstep(-0.3, 0.5, gnoise(v * 0.05, 9.1, sd + 45)));
        chamberQuery(u, v, hit);
        const s = hit.s;
        const asym = 1 - smoothstep(2, 6, s);
        let hw = chamberHalfWidth(s) * (1 + 0.14 * Math.sign(hit.l) * asym);
        hw *= 1 + 0.07 * gnoise(s * 0.35, hit.l > 0 ? 3 : 9, sd + 51);
        const ln = Math.max(-1.2, Math.min(1.2, hit.l / hw));
        const ceil =
          chamberCeiling(s) +
          1.3 * ln * (1 - smoothstep(2, 7, s)) +
          0.8 * gnoise(ln * 1.6 + 0.3, s * 0.25, sd + 55) * (1 - smoothstep(3, 8, s)) +
          1.4 * Math.exp(-(((hit.l + 1.6) / 0.6) ** 2)) * (1 - smoothstep(0.5, 4.5, s)) +
          0.35 * gnoise(s * 0.4, ln * 1.3, sd + 53);
        this.cHc[ci] = Hc;
        this.cW[ci] = formBand(v);
        this.cRun[ci] = cliffRun(v);
        this.cU[ci] = u; this.cV[ci] = v; this.cUc[ci] = uc; this.cB[ci] = B; this.cTop[ci] = top;
        this.cFace[ci] = faceBase(v, sd) + joints;
        this.cPh[ci] = 0.09 * v + 0.04 * uc + 0.3 * gnoise(v * 0.05, uc * 0.05, sd + 61);
        this.cBand[ci] = v * 0.07;
        this.cFloor[ci] = floorLiftRaw(u, v, uc, s);
        this.cS[ci] = s; this.cL[ci] = hit.l; this.cDist[ci] = hit.dist; this.cHw[ci] = hw; this.cCeil[ci] = ceil;
        this.cBrow[ci] = (1 - smoothstep(5.5, 9.5, Math.abs(v - 0.4))) * (0.75 + 0.35 * gnoise(v * 0.35, 2.2, sd + 71));
        this.cSlab[ci] = (Math.abs(v - 0.6) - 4.4 - 0.8 * gnoise(u * 0.4, v * 0.3, sd + 73)) * 0.8;
        {
          // on the flanks the rock top follows the (gentler) terrain slope, proud at first, then under it
          const run = cliffRun(v);
          const Ht = Hc * smoothstep(-4, -4 + run, uc);
          const tb = smoothstep(0, 0.5, wb);
          const sinkTop = 0.5 - 2.8 * smoothstep(0.5, 1, wb);
          this.cTop[ci] = top + (Math.min(top, Ht + sinkTop) - top) * tb;
        }
        const lo = Math.max(B - 2.5, p.ground(x, z) - 0.8);
        const hi = B + Math.max(this.cTop[ci]!, 8) + 3.0;
        this.cLo[ci] = lo; this.cHi[ci] = hi;
        yMin = Math.min(yMin, lo);
        yMax = Math.max(yMax, hi);
      }
    }
    this.y0 = Math.floor(yMin / cell) * cell - cell;
    this.ny = Math.ceil((yMax - this.y0) / cell) + 2;
    this.data = new Float32Array(this.nx * this.ny * this.nz);
    for (let i = 0; i < this.wob.length; i++) this.wob[i] = 1.1 * noise3((i / 8 - 16) * 0.21, 0.37, 1.5, sd + 83);
    this.bandTab = new Float32Array(this.nz * RockField.NB);
    for (let iz = 0; iz < this.nz; iz++) {
      const v = this.z0 + iz * cell - a.z;
      for (let b = 0; b < RockField.NB; b++) this.bandTab[iz * RockField.NB + b] = 0.55 * noise3(b - 8, v * 0.07, 0.5, sd + 81);
    }
    }

  /** Exact field at column ci, world (x, y, z). */
  evalAt(ci: number, x: number, y: number, z: number): number {
    this.evals++;
    const sd = this.seed;
    const u = this.cU[ci]!, v = this.cV[ci]!, uc = this.cUc[ci]!;
    const Yr = y - this.cB[ci]!;
    const floorRel = this.cFloor[ci]!;
    // --- front face with strata
    const wi = Math.max(0, Math.min(510, (Yr + 16) * 8));
    const wf = wi - Math.floor(wi);
    const wob = this.wob[Math.floor(wi)]! * (1 - wf) + this.wob[Math.floor(wi) + 1]! * wf;
    const L = (Yr + wob) / 2.3 + this.cPh[ci]!;
    const band = Math.floor(L);
    const t = L - band;
    // band offsets blend across the parting so the field stays continuous; the parting itself is a groove
    const sb = smoothstep(0.02, 0.2, t);
    const row = Math.floor(ci / this.nx) * RockField.NB;
    const bi = Math.max(1, Math.min(RockField.NB - 1, band + 8));
    const bandOff = this.bandTab[row + bi - 1]! * (1 - sb) + this.bandTab[row + bi]! * sb;
    const qb = band - 1 + sb;
    const gd = 0.25 + 0.3 * Math.abs(this.bandTab[row + bi]!) * 0.0 + 0.15 * (1 + Math.sin(qb * 2.7 + v * 0.15));
    const rec = gd * (1 - smoothstep(0, 0.13, t)) + gd * smoothstep(0.93, 1, t);
    const mt = floorRel + 5.4;
    const brow = -2.8 * this.cBrow[ci]! * smoothstep(mt - 0.6, mt + 1.4, Yr) * (1 - smoothstep(mt + 3.2, mt + 6.5, Yr));
    const n1 = noise3(x * 0.27, y * 0.27, z * 0.27, sd + 91);
    const n2 = noise3(x * 0.55 + 3.1, y * 0.55, z * 0.55, sd + 92);
    const ero = 0.6 * n1 + 0.75 * (0.3 - Math.abs(n2)); // rounded masses with sharp creases
    // the classic cliff profile, cut back by a near-vertical lower wall (the mouth sits in it)
    const S = cliffSurfaceUc(Yr, this.cHc[ci]!);
    const base = smax(S, this.cFace[ci]! + 0.08 * Yr, 1.5);
    let uFace = base + bandOff + rec + brow + ero;
    const w = this.cW[ci]!;
    if (w > 0) {
      // toward the sides the face lies down onto the classic terrain cliff, then slips behind it
      // proud of the terrain at first, then sinking under it along an irregular line
      const ww = w + 0.15 * n1;
      const sink = -0.8 * (1 - smoothstep(0.1, 0.6, ww)) + 2.4 * smoothstep(0.6, 1, ww);
      const fl = cliffSurfaceUc(Yr, this.cHc[ci]!, this.cRun[ci]!) + sink + 0.3 * ero * (1 - w);
      uFace += (fl - uFace) * smoothstep(0.15, 0.55, w);
    }
    const fFace = (uFace - uc) * 0.75;
    const fTop = (Yr - this.cTop[ci]! - 0.8 * ero) * 0.9;
    let r = smax(fFace, fTop, 1.6);
    // --- rock-fall blocks fused into the cliff base
    for (let i = 0; i < BLOCKS.length; i++) {
      const b = BLOCKS[i]!;
      const pu = u - b[0], py = Yr - b[2], pv = v - b[1];
      if (pu * pu + py * py + pv * pv > 4 * (b[3] * b[3] + b[4] * b[4] + b[5] * b[5])) continue;
      // half-buried, irregular rock-fall block
      const du = pu / b[3], dy = py / b[4], dv = pv / b[5];
      const fb = (Math.sqrt(du * du + dy * dy + dv * dv) - 1) * Math.min(b[3], b[4], b[5]) + 0.5 * ero + 0.3 * n2;
      r = smin(r, fb, 1.0);
    }
    // --- the chamber
    const hw = this.cHw[ci]!;
    const dist = this.cDist[ci]!;
    if (dist < hw + 3.5) {
      const Yf = Yr - floorRel;
      const l = Math.abs(this.cL[ci]!);
      const s = this.cS[ci]!;
      const C = this.cCeil[ci]!;
      const yb = 1.0;
      const cb = 0.85 * smoothstep(-2.6, -0.6, s) - 0.05;
      let dch: number;
      if (Yf < yb) {
        const k = Math.max(0, Math.min(1, 1 - Yf / yb));
        const talus = (0.45 + 0.5 * noise3(x * 0.5, 0.3, z * 0.5, sd + 97) * 0.5 + 0.25) * k * k * smoothstep(-1, 1.5, s);
        dch = Math.max(dist - (hw - talus), -cb - Yf);
      } else {
        const ea = dist / hw, eb = (Yf - yb) / (C - yb);
        const ex = 2.4 + 0.5 * (1 - smoothstep(1, 7, s));
        const rr = Math.pow(Math.pow(ea, ex) + Math.pow(Math.abs(eb), ex), 1 / ex);
        dch = (rr - 1) * Math.min(hw, C - yb);
        // lobes and notches around the opening (breakdown along joints and beds)
        const mw = 1 - smoothstep(2, 9, s);
        if (mw > 0) dch += 1.0 * mw * noise3(Math.atan2(Yf - yb, this.cL[ci]!) * 1.4, s * 0.25, 2.5, sd + 57);
      }
      void l;
      dch += 0.34 * noise3(x * 0.45, y * 0.45, z * 0.45, sd + 98);
      r = smax(r, -dch, 0.7);
    }
    return r;
  }

  /** Fill the grid: coarse exact pass, then exact samples in a narrow band around the surface. */
  build(): void {
    const g = this.buildSteps(NEVER);
    while (!g.next().done);
  }

  *buildSteps(tk: Tick, band = 1.8, stride = 3): Generator<void, void, void> {
    yield* this.columns(tk);
    const { nx, ny, nz, cell, data } = this;
    const cnx = Math.ceil((nx - 1) / stride) + 1, cny = Math.ceil((ny - 1) / stride) + 1, cnz = Math.ceil((nz - 1) / stride) + 1;
    const coarse = new Float32Array(cnx * cny * cnz);
    const sampleNode = (ix: number, iy: number, iz: number): number => {
      const ci = ix + iz * nx;
      const y = this.y0 + iy * cell;
      if (y < this.cLo[ci]!) return -5;
      if (y > this.cHi[ci]!) return 5;
      return this.evalAt(ci, this.x0 + ix * cell, y, this.z0 + iz * cell);
    };
    for (let k = 0; k < cnz; k++) {
      const iz = Math.min(nz - 1, k * stride);
      for (let j = 0; j < cny; j++) {
        const iy = Math.min(ny - 1, j * stride);
        for (let i = 0; i < cnx; i++) {
          coarse[i + cnx * (j + cny * k)] = sampleNode(Math.min(nx - 1, i * stride), iy, iz);
          if (tk()) {
            yield;
            tk.reset();
          }
        }
      }
    }
    const sxy = nx * ny;
    // 1) every node gets the sign of its coarse block; blocks near the surface are flagged for exact samples
    const exact = new Uint8Array(nx * ny * nz);
    for (let k = 0; k < cnz - 1; k++) {
      if (tk.over()) {
        yield;
        tk.reset();
      }
      for (let j = 0; j < cny - 1; j++) {
        for (let i = 0; i < cnx - 1; i++) {
          let mn = Infinity, mx = -Infinity;
          for (let c = 0; c < 8; c++) {
            const val = coarse[i + (c & 1) + cnx * (j + ((c >> 1) & 1) + cny * (k + ((c >> 2) & 1)))]!;
            if (val < mn) mn = val;
            if (val > mx) mx = val;
          }
          const near = mn < band && mx > -band;
          const fill = mx < 0 ? -band : band; // a uniform block keeps its sign
          const ix0 = i * stride, ix1 = Math.min(nx - 1, (i + 1) * stride);
          const iy0 = j * stride, iy1 = Math.min(ny - 1, (j + 1) * stride);
          const iz0 = k * stride, iz1 = Math.min(nz - 1, (k + 1) * stride);
          for (let iz = iz0; iz <= iz1; iz++) {
            for (let iy = iy0; iy <= iy1; iy++) {
              const row = nx * iy + sxy * iz;
              if (near) exact.fill(1, row + ix0, row + ix1 + 1);
              else for (let ix = ix0; ix <= ix1; ix++) if (!exact[row + ix]) data[row + ix] = fill;
            }
          }
        }
      }
    }
    // 2) exact samples where flagged
    for (let iz = 0; iz < nz; iz++) {
      if (tk.over()) {
        yield;
        tk.reset();
      }
      const z = this.z0 + iz * cell;
      for (let ix = 0; ix < nx; ix++) {
        const ci = ix + iz * nx;
        const lo = this.cLo[ci]!, hi = this.cHi[ci]!;
        const x = this.x0 + ix * cell;
        for (let iy = 0; iy < ny; iy++) {
          const idx = ix + nx * iy + sxy * iz;
          const y = this.y0 + iy * cell;
          if (y < lo) data[idx] = -5;
          else if (y > hi) data[idx] = 5;
          else if (exact[idx]) {
            data[idx] = this.evalAt(ci, x, y, z);
            if (tk()) {
              yield;
              tk.reset();
            }
          }
        }
      }
    }
  }

  /** Trilinear sample of the grid (outside the grid: +5, i.e. air). */
  sample(x: number, y: number, z: number): number {
    const { nx, ny, nz, cell, data } = this;
    const fx = (x - this.x0) / cell, fy = (y - this.y0) / cell, fz = (z - this.z0) / cell;
    if (fx < 0 || fy < 0 || fz < 0 || fx >= nx - 1 || fy >= ny - 1 || fz >= nz - 1) return 5;
    const ix = Math.floor(fx), iy = Math.floor(fy), iz = Math.floor(fz);
    const tx = fx - ix, ty = fy - iy, tz = fz - iz;
    const sxy = nx * ny;
    const i0 = ix + nx * iy + sxy * iz;
    const d = data;
    const a = d[i0]! + (d[i0 + 1]! - d[i0]!) * tx;
    const b = d[i0 + nx]! + (d[i0 + nx + 1]! - d[i0 + nx]!) * tx;
    const c = d[i0 + sxy]! + (d[i0 + sxy + 1]! - d[i0 + sxy]!) * tx;
    const e = d[i0 + sxy + nx]! + (d[i0 + sxy + nx + 1]! - d[i0 + sxy + nx]!) * tx;
    const f0 = a + (b - a) * ty, f1 = c + (e - c) * ty;
    return f0 + (f1 - f0) * tz;
  }
}
