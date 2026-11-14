// Offline texture baker for the Fjord art pipeline (round 4 experiment).
//
// Bakes tileable 1024² rock material sets from original procedural code (no third-party art), so
// the runtime gets photographic-scale detail (fracture blocks, foliation, vesicles, lichen, cavity
// AO and a matching normal map) without paying for it per pixel every frame.
//
//   npm i --no-save sharp          (or point SHARP_FROM at a directory that has it installed)
//   node tools/artbake/bake.mjs [outDir=src/world/art/textures] [size=1024]
//
// Output per set <name>:
//   <name>_albedo.webp  sRGB colour in RGB, cavity AO in A
//   <name>_nhr.webp     linear: normal X, normal Y (tangent space, OpenGL +Y), height, roughness
// Every texture is periodic in both axes (all noise lives on a torus), so it tiles seamlessly.
// Deterministic: fixed seeds, no Math.random.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(process.env.SHARP_FROM ? resolve(process.env.SHARP_FROM, 'x.js') : import.meta.url);
const sharp = require('sharp');

const [outDir = 'src/world/art/textures', sizeArg = '1024'] = process.argv.slice(2);
const N = Number(sizeArg);
mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------------------------------------
// periodic noise
function ihash(x, y, s) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const mod = (a, p) => ((a % p) + p) % p;
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** periodic Perlin gradient noise, period p (integer lattice cells), result ≈ [-1, 1] */
function perlin(x, y, p, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const g = (ix, iy, dx, dy) => {
    const a = ihash(mod(ix, p), mod(iy, p), s) * Math.PI * 2;
    return Math.cos(a) * dx + Math.sin(a) * dy;
  };
  const u = fade(xf), v = fade(yf);
  return 1.41 * lerp(lerp(g(xi, yi, xf, yf), g(xi + 1, yi, xf - 1, yf), u), lerp(g(xi, yi + 1, xf, yf - 1), g(xi + 1, yi + 1, xf - 1, yf - 1), u), v);
}
/** periodic fbm over the unit torus: u, v in [0,1), base period p cells */
function fbm(u, v, p, oct, s, gain = 0.5) {
  let a = 1, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += a * perlin(u * p * f, v * p * f, p * f, s + i * 101);
    norm += a;
    a *= gain;
    f *= 2;
  }
  return sum / norm;
}
/** periodic Worley on the unit torus with n×n cells: F1, F2, id of the nearest feature point */
function worley(u, v, n, s, jitter = 0.85) {
  const x = u * n, y = v * n;
  const xi = Math.floor(x), yi = Math.floor(y);
  let f1 = 9, f2 = 9, id = 0, cx = 0, cy = 0;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const cxi = mod(xi + i, n), cyi = mod(yi + j, n);
      const px = xi + i + 0.5 + (ihash(cxi, cyi, s) - 0.5) * jitter;
      const py = yi + j + 0.5 + (ihash(cxi, cyi, s + 7) - 0.5) * jitter;
      const d = Math.hypot(px - x, py - y);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        id = ihash(cxi, cyi, s + 13);
        cx = px - x;
        cy = py - y;
      } else if (d < f2) f2 = d;
    }
  return { f1, f2, id, cx, cy };
}

// ---------------------------------------------------------------------------------------------
// image helpers (Float32 planes, wrap-around)
const plane = () => new Float32Array(N * N);
function boxBlur(src, r) {
  const tmp = plane(), out = plane();
  for (let y = 0; y < N; y++) {
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += src[y * N + mod(k, N)];
    for (let x = 0; x < N; x++) {
      tmp[y * N + x] = acc / (2 * r + 1);
      acc += src[y * N + mod(x + r + 1, N)] - src[y * N + mod(x - r, N)];
    }
  }
  for (let x = 0; x < N; x++) {
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += tmp[mod(k, N) * N + x];
    for (let y = 0; y < N; y++) {
      out[y * N + x] = acc / (2 * r + 1);
      acc += tmp[mod(y + r + 1, N) * N + x] - tmp[mod(y - r, N) * N + x];
    }
  }
  return out;
}
/** height (metres-ish, tile = `tileM` metres) → tangent-space normal */
function normals(H, tileM, strength) {
  const px = tileM / N;
  const nx = plane(), ny = plane();
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = (H[y * N + mod(x + 1, N)] - H[y * N + mod(x - 1, N)]) / (2 * px);
      // image rows go down; +V (OpenGL normal-map convention) goes up the image
      const dy = (H[mod(y - 1, N) * N + x] - H[mod(y + 1, N) * N + x]) / (2 * px);
      const l = Math.hypot(dx * strength, dy * strength, 1);
      nx[y * N + x] = (-dx * strength) / l;
      ny[y * N + x] = (-dy * strength) / l;
    }
  return [nx, ny];
}
const lin2srgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const to8 = (v) => Math.round(clamp(v, 0, 1) * 255);

async function write(name, planes, opts) {
  const buf = Buffer.alloc(N * N * 4);
  for (let i = 0; i < N * N; i++) for (let c = 0; c < 4; c++) buf[i * 4 + c] = to8(planes[c][i]);
  const file = resolve(outDir, `${name}.webp`);
  await sharp(buf, { raw: { width: N, height: N, channels: 4 } }).webp(opts).toFile(file);
  return file;
}

async function writeSet(name, { R, G, B, ao, H, rough, tileM, nStrength }) {
  // H in metres; normal from H
  const [nx, ny] = normals(H, tileM, nStrength);
  let hmin = Infinity, hmax = -Infinity;
  for (const v of H) {
    hmin = Math.min(hmin, v);
    hmax = Math.max(hmax, v);
  }
  const hn = plane();
  for (let i = 0; i < N * N; i++) hn[i] = (H[i] - hmin) / (hmax - hmin);
  const sr = plane(), sg = plane(), sb = plane();
  for (let i = 0; i < N * N; i++) {
    sr[i] = lin2srgb(R[i]);
    sg[i] = lin2srgb(G[i]);
    sb[i] = lin2srgb(B[i]);
  }
  const enc = (p) => p.map((v) => v * 0.5 + 0.5);
  const a = await write(`${name}_albedo`, [sr, sg, sb, ao], { quality: 86, alphaQuality: 90, effort: 6 });
  const b = await write(`${name}_nhr`, [enc(nx), enc(ny), hn, rough], { quality: 92, alphaQuality: 90, effort: 6 });
  console.log('wrote', a, b, `(height range ${(hmax - hmin).toFixed(3)} m)`);
}

// ---------------------------------------------------------------------------------------------
// GNEISS: the fjord walls — banded metamorphic rock broken by two joint sets into blocks.
// Tile = 8 m. Subtle, folded felsic lenses in a dark matrix; sub-horizontal sheeting joints at
// irregular spacing and steep cross joints that start and stop (not a Voronoi crazy-paving);
// blocks stand proud by different amounts with chipped edges; sparse lichen; mineral speckle.
/** periodic irregular partition of [0,1): n cuts with hashed spacing; returns {k, t0, t1} */
function cuts(n, s) {
  const w = [];
  let sum = 0;
  for (let k = 0; k < n; k++) {
    const x = 0.35 + ihash(k, 0, s) * 1.3;
    w.push(x);
    sum += x;
  }
  const b = [0];
  for (let k = 0; k < n; k++) b.push(b[k] + w[k] / sum);
  return b;
}
function gneiss() {
  const tileM = 8;
  const R = plane(), G = plane(), B = plane(), H = plane(), rough = plane();
  const NR = 6;
  const rowB = cuts(NR, 301);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N, i = y * N + x;
      const wu = 0.035 * fbm(u, v, 3, 4, 11);
      const wv = 0.07 * fbm(u, v, 2, 4, 23) + 0.015 * fbm(u, v, 9, 2, 25);
      // sheeting joints (rows)
      const vv = mod(v + wv, 1);
      let k = 0;
      while (k < NR - 1 && vv >= rowB[k + 1]) k++;
      const r0 = rowB[k], r1 = rowB[k + 1];
      const dRow = Math.min(vv - r0, r1 - vv);
      // cross joints in this row: 2-5, slightly inclined, some only part-way across the row
      const nc = 2 + Math.floor(ihash(k, 1, 303) * 4);
      const uu = mod(u + wu, 1);
      let dCol = 1, col = 0, best = 9;
      for (let c = 0; c < nc; c++) {
        const cu = (c + 0.15 + 0.7 * ihash(k, c + 5, 307)) / nc + 0.08 * (vv - r0) * (ihash(k, c, 309) - 0.5) * 6;
        let d = Math.abs(mod(uu - cu + 0.5, 1) - 0.5);
        if (d < best) best = d;
        // the joint dies out part-way down the row in some cases
        const reach = ihash(k, c + 9, 311);
        const along = (vv - r0) / (r1 - r0);
        if (reach < 0.3 && along > reach * 2.5 + 0.3) d = 1;
        if (d < dCol) dCol = d;
      }
      for (let c = 0; c < nc; c++) {
        const cu = (c + 0.15 + 0.7 * ihash(k, c + 5, 307)) / nc;
        if (mod(uu - cu, 1) < mod(uu - (col + 0.15 + 0.7 * ihash(k, col + 5, 307)) / nc, 1)) col = c;
      }
      const bid = ihash(k, col, 313);
      const open = 0.35 + 0.65 * smooth(-0.3, 0.5, fbm(u, v, 4, 2, 317));
      const wJ = (0.004 + 0.006 * open) * (0.8 + 0.4 * fbm(u, v, 20, 2, 319));
      const rowOpen = smooth(-0.25, 0.35, fbm(u, v * 0.2 + k * 0.37, 3, 2, 351 + k));
      const crackR = (1 - smooth(wJ * 0.4, wJ * 1.6, dRow)) * open * rowOpen;
      const crackC = (1 - smooth(wJ * 0.4, wJ * 1.6, dCol)) * open * 0.85;
      const crack = Math.max(crackR, crackC);
      // chipped edges: within ~6 cm of a joint the block surface rounds down, irregularly
      const edge = 1 - smooth(0, 0.02 + 0.015 * fbm(u, v, 30, 2, 321), Math.min(dRow / Math.max(0.05, rowOpen), dCol));
      // foliation: soft folded lenses, low contrast
      const ph = (v + wv) * 6 + 0.8 * fbm(u, v, 2, 3, 31) + 0.3 * fbm(u, v, 7, 3, 37);
      const lens = 0.5 + 0.5 * Math.sin(ph * Math.PI * 2) * (0.6 + 0.4 * fbm(u, v, 5, 2, 39));
      const felsic = smooth(0.62, 0.92, lens + 0.18 * fbm(u * 1.0, v * 1.0, 14, 3, 43));
      const grain = fbm(u, v, 24, 4, 71);
      const fine = fbm(u, v, 96, 2, 73);
      // block relief: each block stands proud by its own amount and is gently tilted
      const tiltA = bid * Math.PI * 2;
      const tilt = (Math.cos(tiltA) * (u - 0.5) + Math.sin(tiltA) * (vv - 0.5)) * 0.05;
      const blockH = (bid - 0.5) * 0.09 + tilt * (ihash(k, col, 331) - 0.3);
      const h = blockH + 0.04 * fbm(u, v, 5, 4, 79) + 0.008 * grain + 0.0025 * fine + 0.005 * felsic - 0.035 * edge - 0.05 * crack;
      H[i] = h;
      const tone = 0.82 + 0.3 * bid + 0.1 * fbm(u, v, 3, 2, 333);
      let r = 0.06, g = 0.064, b = 0.071;
      r = lerp(r, 0.15, felsic * 0.55);
      g = lerp(g, 0.145, felsic * 0.55);
      b = lerp(b, 0.135, felsic * 0.55);
      r *= tone; g *= tone; b *= tone;
      const sp = ihash(x, y, 91);
      if (sp > 0.988) { r *= 1.5; g *= 1.5; b *= 1.45; }
      else if (sp < 0.015) { r *= 0.6; g *= 0.6; b *= 0.65; }
      const m = 0.9 + 0.2 * grain;
      r *= m; g *= m; b *= m;
      // weathered (paler) block faces and rust seeping from some joints
      const pale = smooth(0.1, 0.7, fbm(u, v, 3, 3, 337)) * 0.35;
      r = lerp(r, 0.17, pale); g = lerp(g, 0.172, pale); b = lerp(b, 0.172, pale);
      const rust = (1 - smooth(0, 0.05, dRow)) * smooth(0.75, 0.95, ihash(k, 77, 339) + 0.25 * fbm(u, v, 6, 2, 341)) * 0.35 * rowOpen;
      r = lerp(r, r * 1.5 + 0.02, rust); g = lerp(g, g * 1.1 + 0.005, rust); b = lerp(b, b * 0.8, rust);
      const lich = smooth(0.5, 0.64, fbm(u, v, 10, 4, 101)) * (1 - crack);
      const orange = smooth(0.64, 0.72, fbm(u, v, 14, 3, 107)) * (1 - crack);
      r = lerp(r, 0.2, lich * 0.5); g = lerp(g, 0.215, lich * 0.5); b = lerp(b, 0.185, lich * 0.5);
      r = lerp(r, 0.36, orange * 0.55); g = lerp(g, 0.19, orange * 0.55); b = lerp(b, 0.05, orange * 0.55);
      const dk = Math.max(crack, edge * 0.25);
      r *= 1 - 0.6 * dk; g *= 1 - 0.6 * dk; b *= 1 - 0.55 * dk;
      R[i] = r; G[i] = g; B[i] = b;
      rough[i] = clamp(0.82 + 0.08 * grain - 0.06 * felsic + 0.12 * dk - 0.05 * lich, 0.5, 1);
    }
  const m1 = boxBlur(H, 6), m2 = boxBlur(H, 24);
  const ao = plane();
  for (let i = 0; i < N * N; i++) ao[i] = clamp(1 - 7 * Math.max(0, m1[i] - H[i]) - 3 * Math.max(0, m2[i] - H[i]), 0.35, 1);
  return { R, G, B, ao, H, rough, tileM, nStrength: 1.0 };
}

// ---------------------------------------------------------------------------------------------
// BASALT: sea-worn columnar basalt for the sea caves (tile = 4 m). Near-black but not black
// (weathered basalt albedo ≈ 0.06–0.1), vesicles, column joints along v (vertical when projected
// on a wall), irregular cross joints, salt rime and pale lichen.
function basalt() {
  const tileM = 4;
  const R = plane(), G = plane(), B = plane(), H = plane(), rough = plane();
  // irregular column joints across the tile (3, uneven widths) — no grid
  const colB = cuts(3, 205);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N, i = y * N + x;
      const wu = 0.03 * fbm(u, v, 2, 3, 201);
      const uu = mod(u + wu, 1);
      let ci = 0;
      while (ci < 2 && uu >= colB[ci + 1]) ci++;
      const c0 = colB[ci], c1 = colB[ci + 1];
      const cf = (uu - c0) / (c1 - c0);
      const cid = ihash(ci, 0, 203);
      const jd = Math.min(uu - c0, c1 - uu);
      const joint = (1 - smooth(0.0, 0.01, jd)) * (0.55 + 0.45 * smooth(-0.3, 0.3, fbm(u, v, 3, 2, 204)));
      const facet = Math.cos((cf - 0.5) * Math.PI) * 0.02;
      // cross joints: sparse, irregular, some only part-way across
      const sp = 2 + Math.floor(ihash(ci, 1, 207) * 3);
      const cv = (v + 0.06 * fbm(u, v, 3, 2, 209) + cid) * sp;
      const cvf = cv - Math.floor(cv);
      const part = smooth(0.2, 0.6, ihash(ci, mod(Math.floor(cv), sp), 211) + 0.3 * fbm(u, v, 5, 2, 212));
      const cross = (1 - smooth(0.0, 0.012, Math.min(cvf, 1 - cvf) / sp)) * part * 0.8;
      const W = worley(u, v, 38, 213, 0.9);
      const ves = 1 - smooth(0.06, 0.16, W.f1); // vesicle pits
      const grain = fbm(u, v, 32, 4, 217);
      const h = facet + 0.01 * grain - 0.035 * joint - 0.02 * cross - 0.006 * ves * (W.id > 0.4 ? 1 : 0) + 0.02 * fbm(u, v, 4, 3, 219);
      H[i] = h;
      let r = 0.05, g = 0.052, b = 0.058;
      const tone = 0.82 + 0.36 * cid;
      const m = (0.9 + 0.2 * grain) * tone;
      r *= m; g *= m; b *= m;
      // pale weathering rind / salt rime in streaks down the faces
      const rime = smooth(0.3, 0.7, fbm(u * 3, v * 0.6, 3, 3, 223) * 0.6 + 0.5) * smooth(0.45, 0.8, fbm(u, v, 6, 3, 227) + 0.4) * 0.6;
      r = lerp(r, 0.16, rime * 0.45); g = lerp(g, 0.165, rime * 0.45); b = lerp(b, 0.17, rime * 0.45);
      const lich = smooth(0.52, 0.66, fbm(u, v, 9, 4, 229));
      r = lerp(r, 0.14, lich * 0.5); g = lerp(g, 0.15, lich * 0.5); b = lerp(b, 0.12, lich * 0.5);
      const dk = Math.max(joint, cross * 0.8, ves * 0.5);
      r *= 1 - 0.4 * dk; g *= 1 - 0.4 * dk; b *= 1 - 0.38 * dk;
      R[i] = r; G[i] = g; B[i] = b;
      rough[i] = clamp(0.72 + 0.12 * grain + 0.15 * dk - 0.1 * rime, 0.45, 1);
    }
  const m1 = boxBlur(H, 5), m2 = boxBlur(H, 20);
  const ao = plane();
  for (let i = 0; i < N * N; i++) ao[i] = clamp(1 - 12 * Math.max(0, m1[i] - H[i]) - 5 * Math.max(0, m2[i] - H[i]), 0.3, 1);
  return { R, G, B, ao, H, rough, tileM, nStrength: 1.0 };
}

// ---------------------------------------------------------------------------------------------
// BASALT, MASSIVE (round 4 integration, review P-M2): the sea cave's rock mass around the mouth is
// not columnar — column joints only form inside a cooling flow, not on the skin of a mound. Dark,
// fine-grained lava with a weathered rind: a few irregular, non-orthogonal fractures that start and
// stop (from a warped Worley edge field, thresholded by a second noise so no cell outline closes),
// pitted vesicle patches, rough blocky relief, salt-rime streaks running down from ledges, wet
// darkening and sparse pale lichen. Tile = 6 m.
function basaltMassive() {
  const tileM = 6;
  const R = plane(), G = plane(), B = plane(), H = plane(), rough = plane();
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N, i = y * N + x;
      const wu = u + 0.085 * fbm(u, v, 3, 3, 401) + 0.02 * fbm(u, v, 11, 2, 431);
      const wv = v + 0.085 * fbm(u, v, 3, 3, 403) + 0.02 * fbm(u, v, 11, 2, 433);
      const W = worley(mod(wu, 1), mod(wv, 1), 5, 405, 0.95);
      const edge = W.f2 - W.f1;
      // fractures: only part of every cell edge is open (no closed polygons = no crazy paving)
      const openK = smooth(0.12, 0.4, fbm(u, v, 4, 3, 407) + 0.02);
      const crack = (1 - smooth(0.0, 0.035 + 0.02 * fbm(u, v, 12, 2, 409), edge)) * openK;
      // a second, finer set of hairline fractures, sparse
      const W2 = worley(mod(wu * 1.0, 1), mod(wv, 1), 13, 411, 0.9);
      const hair = (1 - smooth(0.0, 0.02, W2.f2 - W2.f1)) * smooth(0.25, 0.55, fbm(u, v, 6, 2, 413)) * 0.6;
      const grain = fbm(u, v, 40, 4, 415);
      const lump = fbm(u, v, 3, 4, 417);
      const blockH = (W.id - 0.5) * 0.03;
      const Wv = worley(u, v, 46, 419, 0.9);
      const vesK = smooth(0.1, 0.45, fbm(u, v, 5, 2, 421));
      const ves = (1 - smooth(0.05, 0.14, Wv.f1)) * vesK * (Wv.id > 0.35 ? 1 : 0);
      const h = 0.09 * lump + blockH + 0.012 * grain - 0.045 * crack - 0.015 * hair - 0.008 * ves;
      H[i] = h;
      let r = 0.058, g = 0.058, b = 0.062;
      const tone = 0.9 + 0.1 * W.id + 0.22 * fbm(u, v, 2, 3, 423);
      const m = (0.88 + 0.24 * grain) * tone;
      r *= m; g *= m; b *= m;
      // weathering rind: slightly brown-grey on exposed lumps
      const rind = smooth(0.0, 0.5, lump) * 0.5;
      r = lerp(r, 0.105, rind * 0.6); g = lerp(g, 0.098, rind * 0.6); b = lerp(b, 0.092, rind * 0.6);
      // salt rime streaks running down (along v), patchy
      const streak = smooth(0.35, 0.75, fbm(u * 4, v * 0.5, 3, 3, 425) * 0.5 + 0.5) * smooth(0.2, 0.6, fbm(u, v, 4, 2, 427) + 0.2);
      r = lerp(r, 0.17, streak * 0.35); g = lerp(g, 0.175, streak * 0.35); b = lerp(b, 0.18, streak * 0.35);
      const lich = smooth(0.55, 0.68, fbm(u, v, 8, 4, 429)) * (1 - crack);
      r = lerp(r, 0.16, lich * 0.45); g = lerp(g, 0.165, lich * 0.45); b = lerp(b, 0.13, lich * 0.45);
      const dk = Math.max(crack, hair * 0.7, ves * 0.6);
      r *= 1 - 0.55 * dk; g *= 1 - 0.55 * dk; b *= 1 - 0.5 * dk;
      R[i] = r; G[i] = g; B[i] = b;
      rough[i] = clamp(0.78 + 0.12 * grain + 0.1 * dk - 0.12 * streak, 0.45, 1);
    }
  const m1 = boxBlur(H, 6), m2 = boxBlur(H, 24);
  const ao = plane();
  for (let i = 0; i < N * N; i++) ao[i] = clamp(1 - 9 * Math.max(0, m1[i] - H[i]) - 4 * Math.max(0, m2[i] - H[i]), 0.35, 1);
  return { R, G, B, ao, H, rough, tileM, nStrength: 1.0 };
}

const t0 = Date.now();
const only = process.env.SETS ? process.env.SETS.split(',') : ['gneiss', 'basalt', 'basalt_massive'];
if (only.includes('gneiss')) await writeSet('gneiss', gneiss());
if (only.includes('basalt')) await writeSet('basalt', basalt());
if (only.includes('basalt_massive')) await writeSet('basalt_massive', basaltMassive());
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
