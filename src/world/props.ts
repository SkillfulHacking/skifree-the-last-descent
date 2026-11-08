/**
 * Procedural prop geometry: snow-laden pines (detailed + far LOD), rocks, logs, stumps.
 * All geometry is merged per variant with baked vertex colours; instanced by Vegetation.
 */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rng, gnoise } from '../core/rng';
import { ATMOSPHERE_GLSL, addAtmosphereUniforms } from './look/atmosphere';

function colorize(g: THREE.BufferGeometry, fn: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  // indexed input keeps smooth shared normals; non-indexed stays faceted
  const ng = g;
  ng.computeVertexNormals();
  const pos = ng.getAttribute('position') as THREE.BufferAttribute;
  const nor = ng.getAttribute('normal') as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    const c = fn(p, n);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (ng.hasAttribute('uv')) ng.deleteAttribute('uv');
  return ng;
}

const SNOW = new THREE.Color(0.88, 0.9, 0.94);

/**
 * Small indexed-mesh builder used by the conifers: per-vertex colour (needle/bark albedo) plus a
 * scalar snow-propensity attribute `aSnow` that the foliage shader turns into per-instance snow
 * cover. Quads are oriented automatically against an outward hint so winding is always correct.
 */
class TreeBuilder {
  pos: number[] = [];
  col: number[] = [];
  snow: number[] = [];
  idx: number[] = [];
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private c = new THREE.Vector3();
  vert(p: THREE.Vector3, c: THREE.Color, s: number): number {
    this.pos.push(p.x, p.y, p.z);
    this.col.push(c.r, c.g, c.b);
    this.snow.push(s);
    return this.pos.length / 3 - 1;
  }
  private P(i: number, out: THREE.Vector3) {
    return out.set(this.pos[i * 3]!, this.pos[i * 3 + 1]!, this.pos[i * 3 + 2]!);
  }
  /** triangle, flipped if its normal points against `out` */
  tri(i: number, j: number, k: number, out: THREE.Vector3) {
    const a = this.P(i, this.a);
    const b = this.P(j, this.b).sub(a);
    const c = this.P(k, this.c).sub(a);
    if (b.cross(c).dot(out) < 0) this.idx.push(i, k, j);
    else this.idx.push(i, j, k);
  }
  quad(i: number, j: number, k: number, l: number, out: THREE.Vector3) {
    this.tri(i, j, k, out);
    this.tri(i, k, l, out);
  }
  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aSnow', new THREE.Float32BufferAttribute(this.snow, 1));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

interface TreeShape {
  height: number;
  /** fraction of the height that is bare trunk */
  crownBase: number;
  baseR: number;
  whorls: number;
  maxBranches: number;
  /** branch droop at the bottom / top of the crown (fraction of branch length at the tip) */
  droop0: number;
  droop1: number;
  /** probability that a branch is missing (old, wind-thinned trees) */
  gap: number;
  needle: THREE.Color;
  /** crooked / wind-bent leader */
  lean: number;
}

const SHAPES: TreeShape[] = [
  // Norway-spruce type: narrow spire, strongly drooping skirts
  { height: 10.4, crownBase: 0.1, baseR: 2.2, whorls: 10, maxBranches: 6, droop0: 0.62, droop1: 0.12, gap: 0.06, needle: new THREE.Color(0.035, 0.1, 0.065), lean: 0.05 },
  // fir type: fuller, flatter tiers, bluer needles
  { height: 9.6, crownBase: 0.13, baseR: 2.5, whorls: 9, maxBranches: 6, droop0: 0.34, droop1: 0.06, gap: 0.04, needle: new THREE.Color(0.03, 0.095, 0.08), lean: 0.03 },
  // old, tall, wind-thinned spruce: long bare trunk, ragged gaps, crooked top
  { height: 12.0, crownBase: 0.24, baseR: 2.25, whorls: 9, maxBranches: 5, droop0: 0.55, droop1: 0.1, gap: 0.2, needle: new THREE.Color(0.04, 0.095, 0.06), lean: 0.12 },
];

const BARK = new THREE.Color(0.17, 0.12, 0.09);
const _up = new THREE.Vector3(0, 1, 0);

function addTrunk(tb: TreeBuilder, h: number, r0: number, sides: number, rings: number[], rng: Rng, lean: (y: number) => THREE.Vector3) {
  // rings: list of heights (fraction of h); radius tapers, flare at the root
  const ids: number[][] = [];
  const p = new THREE.Vector3();
  const c = new THREE.Color();
  for (const f of rings) {
    const y = f * h;
    const r = r0 * (1 - 0.82 * f) * (1 + 0.55 * Math.pow(Math.max(0, 1 - y / 0.6), 2));
    const off = lean(y);
    const row: number[] = [];
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2 + rng.range(-0.08, 0.08);
      const rr = r * (1 + 0.08 * Math.sin(a * 3 + f * 9));
      p.set(Math.cos(a) * rr + off.x, y, Math.sin(a) * rr + off.z);
      const v = 0.7 + 0.3 * gnoise(a * 2, y * 2.5, 31);
      c.copy(BARK).multiplyScalar(v * (y < 0.4 ? 0.8 : 1));
      row.push(tb.vert(p, c, 0));
    }
    ids.push(row);
  }
  const out = new THREE.Vector3();
  for (let i = 0; i + 1 < ids.length; i++) {
    const A = ids[i]!;
    const B = ids[i + 1]!;
    for (let s = 0; s < sides; s++) {
      const s1 = (s + 1) % sides;
      const a = (s + 0.5) / sides * Math.PI * 2;
      out.set(Math.cos(a), 0, Math.sin(a));
      tb.quad(A[s]!, A[s1]!, B[s1]!, B[s]!, out);
    }
  }
}

/**
 * One branch spray: a drooping, tapering frond with a tent-shaped cross-section (upper faces carry
 * snow, the underside stays dark), a lobed outline and a pointed tip.
 */
function addFrond(
  tb: TreeBuilder,
  A: THREE.Vector3,
  ang: number,
  L: number,
  W: number,
  H: number,
  lift: number,
  droop: number,
  segs: number,
  needle: THREE.Color,
  snowLoad: number,
  ph: number,
) {
  const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
  const side = new THREE.Vector3(-Math.sin(ang), 0, Math.cos(ang));
  const C = new THREE.Vector3();
  const p = new THREE.Vector3();
  const col = new THREE.Color();
  const rings: number[][] = [];
  const centers: THREE.Vector3[] = [];
  // tips curl up a little after drooping (spruce "J" shape)
  const yAt = (t: number) => L * (lift * t - droop * t * t + 0.18 * droop * t * t * t);
  for (let i = 0; i < segs; i++) {
    const t = i / segs;
    C.copy(A).addScaledVector(dir, L * t);
    C.y += yAt(t);
    centers.push(C.clone());
    const w = W * (0.3 + 0.7 * Math.sin(Math.PI * Math.min(1, 0.12 + t * 1.05))) * (1 + 0.2 * Math.sin(t * 9 + ph));
    const h = H * (1 - 0.55 * t);
    const ao = 0.5 + 0.5 * t; // dark near the trunk
    const tipLight = 1 + 0.35 * t * t;
    const sAmt = snowLoad * THREE.MathUtils.smoothstep(t, 0.02, 0.45) * (0.75 + 0.25 * Math.sin(ph * 3 + t * 7));
    const hang = 0.32 * h + 0.42 * w;
    // T (ridge, carries the snow pillow), R, B (underside), L
    p.copy(C).addScaledVector(_up, 0.5 * h + 0.05 * L * sAmt);
    const iT = tb.vert(p, col.copy(needle).multiplyScalar(ao * tipLight * 1.1), Math.min(1, sAmt * 1.05));
    p.copy(C).addScaledVector(side, w).addScaledVector(_up, -hang);
    const iR = tb.vert(p, col.copy(needle).multiplyScalar(ao * tipLight * (0.95 + 0.1 * Math.sin(ph + t * 5))), sAmt * 0.55);
    p.copy(C).addScaledVector(_up, -0.5 * h);
    const iB = tb.vert(p, col.copy(needle).multiplyScalar(ao * 0.55), 0);
    p.copy(C).addScaledVector(side, -w).addScaledVector(_up, -hang);
    const iL = tb.vert(p, col.copy(needle).multiplyScalar(ao * tipLight * (0.95 + 0.1 * Math.cos(ph + t * 4))), sAmt * 0.55);
    rings.push([iT, iR, iB, iL]);
  }
  const tipC = new THREE.Vector3().copy(A).addScaledVector(dir, L);
  tipC.y += yAt(1);
  const iTip = tb.vert(tipC, col.copy(needle).multiplyScalar(1.35), snowLoad * 0.35);
  const out = new THREE.Vector3();
  const fc = new THREE.Vector3();
  const faceOut = (ia: number, ib: number, ci: THREE.Vector3) => {
    fc.set((tb.pos[ia * 3]! + tb.pos[ib * 3]!) / 2, (tb.pos[ia * 3 + 1]! + tb.pos[ib * 3 + 1]!) / 2, (tb.pos[ia * 3 + 2]! + tb.pos[ib * 3 + 2]!) / 2);
    return out.subVectors(fc, ci);
  };
  for (let i = 0; i + 1 < rings.length; i++) {
    const a = rings[i]!;
    const b = rings[i + 1]!;
    for (let k = 0; k < 4; k++) {
      const k1 = (k + 1) % 4;
      tb.quad(a[k]!, a[k1]!, b[k1]!, b[k]!, faceOut(a[k]!, a[k1]!, centers[i]!));
    }
  }
  const last = rings[rings.length - 1]!;
  const lc = centers[centers.length - 1]!;
  for (let k = 0; k < 4; k++) {
    const k1 = (k + 1) % 4;
    const o = faceOut(last[k]!, last[k1]!, lc).clone().normalize().addScaledVector(dir, 0.3);
    tb.tri(last[k]!, last[k1]!, iTip, o);
  }
}

/**
 * A conifer. `detailed` = near LOD (individual drooping branch sprays in whorls round a visible
 * trunk, snow pillows on the upper surfaces); otherwise a very cheap far LOD (lobed, drooping star
 * tiers). Colours carry needle/bark albedo; `aSnow` carries snow propensity (composited per
 * instance in the foliage shader).
 */
export function pineGeometry(variant: number, detailed: boolean): THREE.BufferGeometry {
  const sh = SHAPES[((variant % SHAPES.length) + SHAPES.length) % SHAPES.length]!;
  const rng = new Rng(9001 + variant * 77 + (detailed ? 0 : 5));
  const tb = new TreeBuilder();
  const H = sh.height;
  const leanDir = rng.range(0, Math.PI * 2);
  const lean = (y: number) => {
    const k = Math.pow(y / H, 2.2) * sh.lean * H;
    return new THREE.Vector3(Math.cos(leanDir) * k, 0, Math.sin(leanDir) * k);
  };
  const crown0 = H * sh.crownBase;
  if (detailed) {
    addTrunk(tb, H * 0.93, 0.27, 7, [0, 0.06, 0.3, 1], rng, lean);
    // dark inner crown core: fills the gaps between sprays so the tree reads dense
    {
      const sides = 7;
      const y0 = crown0 + 0.4;
      const ring: number[] = [];
      const p = new THREE.Vector3();
      const c = new THREE.Color().copy(sh.needle).multiplyScalar(0.3);
      for (let s = 0; s < sides; s++) {
        const a = (s / sides) * Math.PI * 2;
        p.set(Math.cos(a) * sh.baseR * 0.42, y0, Math.sin(a) * sh.baseR * 0.42);
        ring.push(tb.vert(p, c, 0));
      }
      const top = tb.vert(p.set(0, H * 0.9, 0).add(lean(H * 0.9)), c, 0);
      const out = new THREE.Vector3();
      for (let s = 0; s < sides; s++) {
        const a = ((s + 0.5) / sides) * Math.PI * 2;
        tb.tri(ring[s]!, ring[(s + 1) % sides]!, top, out.set(Math.cos(a), 0.4, Math.sin(a)));
      }
    }
    const nW = sh.whorls;
    let rot = rng.range(0, Math.PI * 2);
    for (let k = 0; k < nW; k++) {
      const f = k / (nW - 1);
      const y = crown0 + (H * 0.94 - crown0) * Math.pow(f, 0.92) + rng.range(-0.22, 0.22);
      const nB = Math.max(3, Math.round(THREE.MathUtils.lerp(sh.maxBranches, 3.2, f) + rng.range(-0.7, 0.7)));
      // conical envelope, slightly convex low down, narrow spire at the top
      const env = Math.pow(1 - f, 0.95) * (1 - 0.12 * Math.pow(1 - f, 4));
      rot += rng.range(1.9, 2.9); // ~golden-angle offsets: no visible tiers
      const droop = THREE.MathUtils.lerp(sh.droop0, sh.droop1, f);
      const lift = THREE.MathUtils.lerp(0.12, 0.32, f);
      const segs = f < 0.5 ? 3 : 2;
      for (let b = 0; b < nB; b++) {
        if (k < nW - 2 && rng.chance(sh.gap)) continue;
        const ang = rot + (b / nB) * Math.PI * 2 + rng.range(-0.3, 0.3) * ((Math.PI * 2) / nB);
        const L = Math.max(0.45, sh.baseR * env * rng.range(0.78, 1.12) + 0.25);
        const A = lean(y).add(new THREE.Vector3(Math.cos(ang) * 0.12, y, Math.sin(ang) * 0.12));
        const W = L * rng.range(0.4, 0.5) + 0.1;
        const Ht = Math.max(0.2, L * 0.26);
        const snowLoad = rng.range(0.75, 1.0) * (0.85 + 0.15 * (1 - f));
        addFrond(tb, A, ang, L, W, Ht, lift, droop * rng.range(0.8, 1.2), segs, sh.needle, snowLoad, rng.range(0, 6.28));
      }
    }
    // leader shoot
    {
      const p = new THREE.Vector3();
      const ring: number[] = [];
      const y0 = H * 0.9;
      const c = new THREE.Color().copy(sh.needle).multiplyScalar(1.2);
      for (let s = 0; s < 5; s++) {
        const a = (s / 5) * Math.PI * 2;
        p.set(Math.cos(a) * 0.32, y0, Math.sin(a) * 0.32).add(lean(y0));
        ring.push(tb.vert(p, c, 0.6));
      }
      const top = tb.vert(p.set(0, H * 1.04, 0).add(lean(H)), c, 0.2);
      const out = new THREE.Vector3();
      for (let s = 0; s < 5; s++) {
        const a = ((s + 0.5) / 5) * Math.PI * 2;
        tb.tri(ring[s]!, ring[(s + 1) % 5]!, top, out.set(Math.cos(a), 0.3, Math.sin(a)));
      }
    }
  } else {
    // far LOD: 3-sided trunk stub + 3 lobed star tiers (drooping tips, raised notches)
    addTrunk(tb, crown0 + 1.2, 0.3, 3, [0, 1], rng, lean);
    const tiers = 3;
    const nb = 5 + (variant % 2);
    let rot = rng.range(0, 6.28);
    const p = new THREE.Vector3();
    const c = new THREE.Color();
    const out = new THREE.Vector3();
    for (let t = 0; t < tiers; t++) {
      const f = t / tiers;
      const yb = crown0 + 0.2 + (H - crown0) * f * 0.86;
      const r = sh.baseR * (1 - f * 0.78) * rng.range(0.92, 1.06);
      const yTop = t === tiers - 1 ? H * 1.03 : yb + (H - crown0) * 0.5;
      const apex = tb.vert(p.set(0, yTop, 0).add(lean(yTop)), c.copy(sh.needle).multiplyScalar(1.1), 0.55);
      rot += rng.range(0.4, 1.0);
      const rim: number[] = [];
      for (let i = 0; i < nb * 2; i++) {
        const tip = i % 2 === 0;
        const a = rot + (i / (nb * 2)) * Math.PI * 2 + (tip ? rng.range(-0.15, 0.15) : 0);
        const rr = tip ? r * rng.range(0.92, 1.08) : r * 0.58;
        const dy = tip ? -r * THREE.MathUtils.lerp(sh.droop0, sh.droop1, f) * 0.55 : r * 0.12;
        p.set(Math.cos(a) * rr, yb + dy, Math.sin(a) * rr).add(lean(yb));
        rim.push(tb.vert(p, c.copy(sh.needle).multiplyScalar(tip ? 1.15 : 0.7), tip ? 0.15 : 0.45));
      }
      for (let i = 0; i < rim.length; i++) {
        const a = rot + ((i + 0.5) / rim.length) * Math.PI * 2;
        tb.tri(rim[i]!, rim[(i + 1) % rim.length]!, apex, out.set(Math.cos(a), 0.5, Math.sin(a)));
      }
    }
  }
  return tb.build();
}

/** A craggy rock with snow on top. Unit size (~1 m radius). */
export function rockGeometry(variant: number, detailed: boolean, opts: { flatten?: number; snow?: number; detail?: number } = {}): THREE.BufferGeometry {
  const flatten = opts.flatten ?? 0.62;
  const snowAmt = opts.snow ?? 1;
  const ico = new THREE.IcosahedronGeometry(1, opts.detail ?? (detailed ? 2 : 1));
  ico.deleteAttribute('uv');
  ico.deleteAttribute('normal');
  // weld vertices so displacement stays watertight and normals are smooth
  const g = mergeVertices(ico);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = gnoise(v.x * 1.3 + variant * 3, v.z * 1.3 + v.y, 41 + variant) * 0.32 + gnoise(v.x * 3.5, v.y * 3.5 + v.z, 42) * 0.12 + gnoise(v.x * 8, v.y * 8 + v.z * 2, 43) * 0.04;
    v.multiplyScalar(1 + n);
    // facets
    v.y *= flatten;
    if (v.y < -0.1) v.y = -0.1 + (v.y + 0.1) * 0.3;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  return colorize(g, (p, n) => {
    const s = 0.5 + 0.5 * gnoise(p.x * 3, p.y * 6 + p.z * 3, 7 + variant) * (0.7 + 0.3 * gnoise(p.x * 11, p.z * 11, 3));
    const rock = new THREE.Color(0.26 * s, 0.25 * s, 0.24 * s);
    const snow = THREE.MathUtils.smoothstep(n.y + 0.2 * gnoise(p.x * 5, p.z * 5, 9), 0.45 + (1 - snowAmt) * 0.4, 0.75 + (1 - snowAmt) * 0.2) * snowAmt;
    return rock.lerp(SNOW, snow);
  });
}

export function logGeometry(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.28, 0.3, 1, 9, 4);
  g.rotateX(Math.PI / 2); // along Z (length 1, scaled by instance)
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    pos.setX(i, pos.getX(i) * (1 + 0.08 * Math.sin(z * 9)));
  }
  g.translate(0, 0.26, 0);
  return colorize(g, (p, n) => {
    const v = 0.7 + 0.3 * gnoise(p.z * 6, p.x * 8, 3);
    const bark = new THREE.Color(0.22 * v, 0.15 * v, 0.1 * v);
    return bark.lerp(SNOW, THREE.MathUtils.smoothstep(n.y, 0.55, 0.85));
  });
}

export function stumpGeometry(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.3, 0.38, 0.55, 9, 1);
  g.translate(0, 0.27, 0);
  return colorize(g, (_p, n) => (n.y > 0.8 ? SNOW.clone() : new THREE.Color(0.2, 0.14, 0.1)));
}

/** A storytelling prop: a snapped pine (broken trunk + fallen top). */
export function brokenTreeGeometry(): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.2, 0.3, 2.2, 7);
  trunk.translate(0, 1.1, 0);
  // splintered top
  const spl = new THREE.ConeGeometry(0.22, 0.6, 6, 1);
  spl.translate(0.03, 2.45, 0);
  const top = bakeSnow(pineGeometry(0, false), 0.4);
  top.rotateZ(Math.PI / 2 - 0.15);
  top.translate(0.3, 0.3, 0);
  const parts = [
    colorize(trunk, () => new THREE.Color(0.2, 0.14, 0.1)),
    colorize(spl, () => new THREE.Color(0.75, 0.62, 0.45)),
    top.toNonIndexed(),
  ];
  for (const g of parts) g.deleteAttribute('normal');
  const m = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)), false);
  if (!m) throw new Error('merge failed');
  m.computeVertexNormals();
  return m;
}

/** Bake the snow-propensity attribute into the vertex colours (for plain, non-foliage materials). */
function bakeSnow(g: THREE.BufferGeometry, threshold: number): THREE.BufferGeometry {
  const col = g.getAttribute('color') as THREE.BufferAttribute;
  const sn = g.getAttribute('aSnow') as THREE.BufferAttribute;
  const c = new THREE.Color();
  for (let i = 0; i < col.count; i++) {
    c.fromBufferAttribute(col, i).lerp(SNOW, THREE.MathUtils.smoothstep(sn.getX(i), threshold, threshold + 0.2));
    col.setXYZ(i, c.r, c.g, c.b);
  }
  g.deleteAttribute('aSnow');
  return g;
}

/**
 * Shared vegetation material. Per instance (hashed from the instance's absolute position, so it is
 * stable across floating-origin shifts) it varies the needle tint and how much snow the tree holds:
 * `aSnow` (snow propensity baked per vertex) is thresholded per tree, so some trees are freshly
 * loaded and others wind-stripped. Optional gentle wind sway, height-weighted.
 */
export function createFoliageMaterial(uTime: { value: number }, sway: boolean): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    addAtmosphereUniforms(shader.uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vAtmW;\n${ATMOSPHERE_GLSL}`)
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb = sf_atmosphere(gl_FragColor.rgb, vAtmW);');
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aSnow;\nvarying vec3 vAtmW;')
      .replace(
        '#include <fog_vertex>',
        `#include <fog_vertex>
  {
    vec4 sw = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
    sw = instanceMatrix * sw;
#endif
    vAtmW = (modelMatrix * sw).xyz;
  }`,
      )
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
#ifdef USE_INSTANCING
  vec3 ip = instanceMatrix[3].xyz;
#else
  vec3 ip = vec3(0.0);
#endif
  {
    float h1 = fract(sin(dot(mod(ip.xz, 4096.0), vec2(12.9898, 78.233))) * 43758.5453);
    float h2 = fract(h1 * 17.31 + 0.137);
    float h3 = fract(h1 * 31.7 + 0.71);
    // needle tint: blue-green fir .. olive spruce, darker/lighter individuals
    vec3 tint = mix(vec3(0.82, 1.0, 1.08), vec3(1.18, 1.06, 0.82), h1) * (0.75 + 0.5 * h2);
    float thr = mix(0.12, 0.62, h3);
    float sn = smoothstep(thr, thr + 0.18, aSnow);
    vColor.rgb = mix(vColor.rgb * tint, vec3(0.86, 0.89, 0.94) * (0.9 + 0.1 * aSnow), sn);
  }`,
      );
    if (sway)
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
  {
#ifdef USE_INSTANCING
  vec3 iq = instanceMatrix[3].xyz;
#else
  vec3 iq = vec3(0.0);
#endif
  float hgt = max(0.0, position.y - 1.5);
  float w = sin(uTime * 1.3 + iq.x * 0.05 + iq.z * 0.07) * 0.5 + sin(uTime * 2.7 + iq.z * 0.13) * 0.25;
  transformed.x += hgt * hgt * 0.0025 * w;
  transformed.z += hgt * hgt * 0.0015 * w;
  }`,
      );
  };
  mat.customProgramCacheKey = () => (sway ? 'foliage-v2-sway' : 'foliage-v2');
  return mat;
}
