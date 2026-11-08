/**
 * The cave formation as a signed distance field (negative = rock), sampled on a regular grid.
 *
 * A band of stratified rock cropping out at the foot of the hillside: a near-vertical face (bedding-plane
 * ledges, vertical joints, erosion noise, an overhanging brow over the mouth) whose height tapers out
 * under the snow to either side, and whose top steps back up the slope in a few benches before it is
 * buried by the hillside (the heightfield). Minus the chamber: a noisy, asymmetric, leaning superellipse
 * tube along the shared chamber path, with talus fillets where the walls meet the floor and a slumped
 * block on one side of the mouth.
 *
 * Evaluation is split into per-column terms (everything that depends only on x/z, computed once) and the
 * per-sample terms; a coarse pass decides where the exact field is needed (a narrow band around the
 * surface), everywhere else the coarse field is interpolated.
 */
import { gnoise, smoothstep } from '../../core/rng';
import {
  type CaveAnchor,
  BED,
  FORM_V0,
  FORM_V1,
  bandHeight,
  bankOffset,
  chamberCeiling,
  chamberHalfWidth,
  chamberQuery,
  faceBase,
  floorLiftRaw,
  hillBase,
  hillRise,
  pitRim,
  STEP_IN,
  type ChamberHit,
} from '../caveTerrain';
import { noise3, smax } from './noise';
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
  readonly cTop: Float32Array; // rock top above B (benches stepping up the hillside)
  readonly cFace: Float32Array; // face base line (uc) + joints
  readonly cH: Float32Array; // exposed face height above B
  readonly cLean: Float32Array; // face lean (uc per metre of height)
  readonly cPh: Float32Array; // strata phase
  readonly cFloor: Float32Array; // floor height above B (chamber)
  readonly cS: Float32Array;
  readonly cL: Float32Array;
  readonly cDist: Float32Array;
  readonly cHw: Float32Array;
  readonly cCeil: Float32Array;
  readonly cBrow: Float32Array;
  readonly cLid: Float32Array; // 1 on the roof over the chamber (smooth top: it lies just above the snow)
  readonly cLo: Float32Array;
  readonly cHi: Float32Array;

  private p: FieldParams;

  constructor(p: FieldParams) {
    this.p = p;
    const a = (this.a = p.anchor);
    this.seed = p.seed;
    const cell = (this.cell = p.cell);
    this.mx = a.centerX + a.side * (a.d + 2);
    const uMin = -11, uMax = 32, vMin = FORM_V0, vMax = FORM_V1;
    const xa = this.mx + a.side * uMin, xb = this.mx + a.side * uMax;
    this.x0 = Math.min(xa, xb);
    this.z0 = a.z + vMin;
    this.nx = Math.ceil(Math.abs(xb - xa) / cell) + 1;
    this.nz = Math.ceil((vMax - vMin) / cell) + 1;
    const nc = this.nx * this.nz;
    const F = () => new Float32Array(nc);
    this.cU = F(); this.cV = F(); this.cUc = F(); this.cB = F(); this.cTop = F(); this.cFace = F(); this.cH = F(); this.cLean = F(); this.cPh = F();
    this.cFloor = F(); this.cS = F(); this.cL = F(); this.cDist = F(); this.cHw = F(); this.cCeil = F(); this.cBrow = F(); this.cLid = F();
    this.cLo = F(); this.cHi = F();
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
      const v = z - a.z;
      // per-row (lateral) terms
      const H = bandHeight(v, sd);
      const fb = faceBase(v, sd);
      const lean = 0.07 + 0.09 * gnoise(v * 0.045, 5.3, sd + 46) + 0.05 * gnoise(v * 0.16, 2.9, sd + 47);
      const env = smoothstep(0.4, 3.5, H); // the band exists here
      const ph = 0.45 * gnoise(v * 0.05, 0.7, sd + 62) + 0.15 * gnoise(v * 0.17, 3.7, sd + 63);
      for (let ix = 0; ix < this.nx; ix++) {
        const x = this.x0 + ix * cell;
        const ci = ix + iz * this.nx;
        const u = (x - this.mx) * a.side;
        const uc = (x - cx) * a.side - (a.d + 2);
        const B = p.hRaw(x, z) + bankOffset(uc);
        // vertical joints: two sets of narrow recessed grooves
        const j1 = 1 - Math.abs(gnoise(v * 0.16 + uc * 0.05, 1.7, sd + 41)) * 3.2;
        const j2 = 1 - Math.abs(gnoise(v * 0.29 - uc * 0.04, 6.3, sd + 43)) * 4.0;
        const joints = (0.9 * Math.max(0, j1) ** 2 + 0.5 * Math.max(0, j2) ** 2) * (0.4 + 0.6 * smoothstep(-0.3, 0.5, gnoise(v * 0.05, 9.1, sd + 45)));
        // --- the rock top: benches stepping up the hillside behind the face. The hillside (heightfield)
        // rises g above the band top; the rock follows it as a staircase of beds whose risers stand a
        // little proud of the snow and whose treads are buried, fading out higher up the slope.
        const t = uc - fb;
        const g = hillRise(t, v, sd);
        const pn = ph + 0.25 * gnoise(uc * 0.08, v * 0.08, sd + 64);
        const q = g / BED + pn;
        const stair = BED * (Math.floor(q) + smoothstep(0.72, 1.0, q - Math.floor(q)) - pn);
        const fadeUp = smoothstep(3, 12, t);
        // risers come and go along the slope (not continuous ribbons)
        const keep = smoothstep(-0.15, 0.25, gnoise(v * 0.07, q * 0.6, sd + 35));
        const crag = 1.3 * Math.max(0, gnoise(v * 0.09 + 0.3, t * 0.1, sd + 33)) * (1 - smoothstep(8, 18, t));
        const amp = (0.9 + 0.35 * gnoise(v * 0.11, t * 0.11, sd + 34)) * (1 - fadeUp) * (0.35 + 0.65 * keep) - 1.2 * fadeUp + crag;
        const Hb = hillBase(t, v, H);
        let top = Hb + stair + env * amp - (1 - env) * 1.4;
        // the roof over the chamber: the heightfield drops into a pit around the chamber (hidden in its
        // walls), so the rock above it must reach just above the hillside and cover the pit
        const hillY = Hb * smoothstep(STEP_IN, STEP_IN + 3, t) + g;
        let lidK = 0;
        if (u > -16 && u < 27 && v > -11 && v < 26 && t > 0.5) {
          chamberQuery(u, v, hit);
          const cd = hit.dist - chamberHalfWidth(hit.s);
          const rim = pitRim(hillY);
          const lid = 1 - smoothstep(rim + 1.6, rim + 3.6, cd + 0.8 * gnoise(u * 0.15, v * 0.15, sd + 36));
          if (lid > 0) {
            const lt = hillY + 0.75 + 0.35 * gnoise(u * 0.2, v * 0.2, sd + 37) - 3.0 * (1 - lid);
            if (lt > top) {
              top = lt;
              lidK = lid;
            }
          }
        }
        this.cTop[ci] = top;
        this.cLid[ci] = lidK;
        this.cH[ci] = H;
        this.cLean[ci] = Math.max(-0.04, lean);
        // --- the chamber (only near it)
        let ceil = 0, hw = 1, s = 99, l = 99, dist = 99;
        if (u > -16 && u < 27 && v > -11 && v < 26) {
          chamberQuery(u, v, hit);
          s = hit.s;
          l = hit.l;
          dist = hit.dist;
          const asym = 1 - smoothstep(2, 6, s);
          hw = chamberHalfWidth(s) * (1 + 0.14 * Math.sign(l) * asym);
          hw *= 1 + 0.07 * gnoise(s * 0.35, l > 0 ? 3 : 9, sd + 51);
          const ln = Math.max(-1.2, Math.min(1.2, l / hw));
          ceil =
            chamberCeiling(s) +
            1.3 * ln * (1 - smoothstep(2, 7, s)) +
            0.8 * gnoise(ln * 1.6 + 0.3, s * 0.25, sd + 55) * (1 - smoothstep(3, 8, s)) +
            1.4 * Math.exp(-(((l + 1.6) / 0.6) ** 2)) * (1 - smoothstep(0.5, 4.5, s)) +
            0.35 * gnoise(s * 0.4, ln * 1.3, sd + 53);
        }
        this.cU[ci] = u; this.cV[ci] = v; this.cUc[ci] = uc; this.cB[ci] = B;
        this.cFace[ci] = fb + joints;
        this.cPh[ci] = 0.09 * v + 0.04 * uc + 0.3 * gnoise(v * 0.05, uc * 0.05, sd + 61);
        this.cFloor[ci] = floorLiftRaw(u, v, uc, s > 50 ? 0 : s);
        this.cS[ci] = s; this.cL[ci] = l; this.cDist[ci] = dist; this.cHw[ci] = hw; this.cCeil[ci] = ceil;
        this.cBrow[ci] = (1 - smoothstep(5.5, 9.5, Math.abs(v - 0.4))) * (0.75 + 0.35 * gnoise(v * 0.35, 2.2, sd + 71));
        const lo = Math.max(B - 2.5, p.ground(x, z) - 0.8);
        // no rock above the bench tops (nor anywhere the band has gone)
        const hi = B + Math.max(this.cTop[ci]! + 2.5, H > 0 ? 3 : -1, dist < 12 ? 10 : -1);
        this.cLo[ci] = lo; this.cHi[ci] = Math.max(lo, hi);
        yMin = Math.min(yMin, lo);
        yMax = Math.max(yMax, this.cHi[ci]!);
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
    const v = this.cV[ci]!, uc = this.cUc[ci]!;
    const Yr = y - this.cB[ci]!;
    const floorRel = this.cFloor[ci]!;
    const H = this.cH[ci]!;
    // --- front face with strata
    const wi = Math.max(0, Math.min(510, (Yr + 16) * 8));
    const wf = wi - Math.floor(wi);
    const wob = this.wob[Math.floor(wi)]! * (1 - wf) + this.wob[Math.floor(wi) + 1]! * wf;
    const L = (Yr + wob) / BED + this.cPh[ci]!;
    const band = Math.floor(L);
    const t = L - band;
    // band offsets blend across the parting so the field stays continuous; the parting itself is a groove
    const sb = smoothstep(0.02, 0.2, t);
    const row = Math.floor(ci / this.nx) * RockField.NB;
    const bi = Math.max(1, Math.min(RockField.NB - 1, band + 8));
    const bandOff = this.bandTab[row + bi - 1]! * (1 - sb) + this.bandTab[row + bi]! * sb;
    const qb = band - 1 + sb;
    const gd = 0.25 + 0.15 * (1 + Math.sin(qb * 2.7 + v * 0.15));
    const rec = gd * (1 - smoothstep(0, 0.13, t)) + gd * smoothstep(0.93, 1, t);
    const mt = floorRel + 5.4;
    const brow = -2.8 * this.cBrow[ci]! * smoothstep(mt - 0.6, mt + 1.4, Yr) * (1 - smoothstep(mt + 3.2, mt + 6.5, Yr));
    const n1 = noise3(x * 0.27, y * 0.27, z * 0.27, sd + 91);
    const n2 = noise3(x * 0.55 + 3.1, y * 0.55, z * 0.55, sd + 92);
    const ero = 0.6 * n1 + 0.75 * (0.3 - Math.abs(n2)); // rounded masses with sharp creases
    // a near-vertical face, leaning back a little (varying along the band), its top edge weathered back
    const round = 1.3 * smoothstep(H - 2.5, H + 1.2, Yr) ** 2;
    const uFace = this.cFace[ci]! + this.cLean[ci]! * Math.max(0, Yr) + round + bandOff + rec + brow + ero;
    const fFace = (uFace - uc) * 0.75;
    const fTop = (Yr - this.cTop[ci]! - 0.8 * ero * (1 - 0.85 * this.cLid[ci]!)) * 0.85;
    let r = smax(fFace, fTop, 1.4);
    // --- the chamber
    const hw0 = this.cHw[ci]!;
    const dist = this.cDist[ci]!;
    if (dist < hw0 + 3.5) {
      const Yf = Yr - floorRel;
      const s = this.cS[ci]!;
      const C = this.cCeil[ci]!;
      const lsig = this.cL[ci]!;
      const yb = 1.0;
      const cb = 0.85 * smoothstep(-2.6, -0.6, s) - 0.05;
      const mw = 1 - smoothstep(2, 9, s); // mouth weight
      // the bore leans (~8°) toward -l near the mouth, and a slumped block narrows the -l side low down
      const lw = lsig + 0.15 * mw * Math.max(0, Yf - yb);
      const slump = 0.9 * (1 - smoothstep(1.2, 2.6, Yf)) * smoothstep(-2.5, -0.5, -lsig) * (1 - smoothstep(1, 5, s)) * smoothstep(-3, -0.5, s);
      const hw = hw0 - slump;
      const dl = Math.abs(lw);
      let dch: number;
      if (Yf < yb) {
        const k = Math.max(0, Math.min(1, 1 - Yf / yb));
        const talus = (0.45 + 0.5 * noise3(x * 0.5, 0.3, z * 0.5, sd + 97) * 0.5 + 0.25) * k * k * smoothstep(-1, 1.5, s);
        dch = Math.max(dl - (hw - talus), -cb - Yf);
      } else {
        // (the dead end tapers to nothing: keep the vertical semi-axis positive or the carve explodes)
        const cy = Math.max(0.35, C - yb);
        const ea = dl / Math.max(0.3, hw), eb = (Yf - yb) / cy;
        const ex = 2.4 - 0.35 * mw; // rounder (less box-like) near the mouth
        const rr = Math.pow(Math.pow(ea, ex) + Math.pow(Math.abs(eb), ex), 1 / ex);
        dch = (rr - 1) * Math.max(0.3, Math.min(hw, cy));
        // lobes and notches around the opening (breakdown along joints and beds)
        if (mw > 0) {
          dch += 1.0 * mw * noise3(Math.atan2(Yf - yb, lsig) * 1.4, s * 0.25, 2.5, sd + 57);
          dch += 0.45 * mw * noise3(x * 0.9, y * 0.9, z * 0.9, sd + 58);
        }
      }
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
