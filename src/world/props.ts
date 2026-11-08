/**
 * Procedural prop geometry: snow-laden pines (detailed + far LOD), rocks, logs, stumps.
 * All geometry is merged per variant with baked vertex colours; instanced by Vegetation.
 */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rng, gnoise } from '../core/rng';
import { ATMOSPHERE_GLSL, addAtmosphereUniforms } from './look/atmosphere';
import { GLSL_NOISE_BL } from './snowMaterial';

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
 * One branch tier ("skirt") of a conifer: a closed, drooping, lobed umbrella around the trunk.
 * Upper surface: inner collar → snow-pillow ring → lobed rim (branch tips droop, notches lift);
 * underside: rim → back to the trunk lower down (dark, so depth reads without a visible core).
 * The lobes (branches) have individual lengths, angles and snow loads, so no two tiers or trees
 * are radially symmetric.
 */
function addSkirt(
  tb: TreeBuilder,
  soft: number[],
  center: THREE.Vector3,
  L: number,
  drop: number,
  lobes: number,
  rot: number,
  needle: THREE.Color,
  snowLoad: number,
  rng: Rng,
  segPerLobe: number,
  underside: boolean,
) {
  const S = lobes * segPerLobe;
  const lobeLen: number[] = [];
  const lobeSnow: number[] = [];
  const lobeAng: number[] = [];
  for (let i = 0; i < lobes; i++) {
    // ragged branches: mostly full length, some short (wind-broken), a few long
    const r = rng.float();
    lobeLen.push(r < 0.15 ? rng.range(0.55, 0.75) : rng.range(0.85, 1.12));
    lobeSnow.push(snowLoad * rng.range(0.55, 1.1));
    lobeAng.push(rng.range(-0.28, 0.28));
  }
  const inner: number[] = [];
  const mid: number[] = [];
  const rim: number[] = [];
  const under: number[] = [];
  const p = new THREE.Vector3();
  const c = new THREE.Color();
  const yTop = center.y;
  for (let s = 0; s < S; s++) {
    const u = s / segPerLobe; // lobe coordinate
    const li = Math.round(u) % lobes;
    const d = Math.abs(u - Math.round(u)); // 0 at a tip, 0.5 at a notch
    const shape = Math.pow(Math.cos(Math.PI * d), 2);
    const a = rot + ((s + lobeAng[li]! * segPerLobe * (1 - 2 * d)) / S) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const len = lobeLen[li]!;
    const r = L * (0.5 + 0.5 * shape) * len;
    const sn = lobeSnow[li]!;
    const tipDrop = drop * (0.55 + 0.45 * shape) * (0.85 + 0.3 * len - 0.15) + rng.range(-0.05, 0.05) * drop;
    // inner collar (hugs the trunk)
    p.set(center.x + ca * 0.12, yTop + 0.04 * L, center.z + sa * 0.12);
    inner.push(tb.vert(p, c.copy(needle).multiplyScalar(0.62), sn * 0.5));
    soft.push(1);
    // snow pillow ring: convex upper surface carries the load
    const rm = r * 0.52;
    p.set(center.x + ca * rm, yTop - tipDrop * 0.22 + 0.06 * L * sn, center.z + sa * rm);
    mid.push(tb.vert(p, c.copy(needle).multiplyScalar(0.85 + 0.15 * shape + rng.range(-0.06, 0.06)), Math.min(1, sn * (1.0 + 0.25 * shape))));
    soft.push(1);
    // rim: tips droop, notches lift a little
    p.set(center.x + ca * r, yTop - tipDrop, center.z + sa * r);
    rim.push(tb.vert(p, c.copy(needle).multiplyScalar(1.05 + 0.2 * shape + rng.range(-0.08, 0.08)), sn * (0.25 + 0.2 * (1 - shape))));
    soft.push(1);
    if (underside) {
      const ru = 0.18 + r * 0.12;
      p.set(center.x + ca * ru, yTop - tipDrop * 0.75, center.z + sa * ru);
      under.push(tb.vert(p, c.copy(needle).multiplyScalar(0.42), 0));
      soft.push(0.6);
    }
  }
  const out = new THREE.Vector3();
  for (let s = 0; s < S; s++) {
    const s1 = (s + 1) % S;
    const a = rot + ((s + 0.5) / S) * Math.PI * 2;
    out.set(Math.cos(a), 0.8, Math.sin(a));
    tb.quad(inner[s]!, inner[s1]!, mid[s1]!, mid[s]!, out);
    out.set(Math.cos(a), 0.35, Math.sin(a));
    tb.quad(mid[s]!, mid[s1]!, rim[s1]!, rim[s]!, out);
    if (underside) {
      out.set(Math.cos(a) * 0.3, -1, Math.sin(a) * 0.3);
      tb.quad(rim[s]!, rim[s1]!, under[s1]!, under[s]!, out);
    }
  }
}

/**
 * Soft ("volumetric") foliage normals: blend each foliage vertex's geometric normal with the
 * normal of the crown's cone envelope, so tiers shade as one smooth soft mass instead of facets.
 */
function softenNormals(g: THREE.BufferGeometry, soft: number[], H: number, baseR: number) {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const nor = g.getAttribute('normal') as THREE.BufferAttribute;
  const n = new THREE.Vector3();
  const e = new THREE.Vector3();
  const k = baseR / H;
  for (let i = 0; i < pos.count; i++) {
    const w = soft[i] ?? 0;
    if (w <= 0) continue;
    n.fromBufferAttribute(nor, i);
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z) || 1;
    e.set(x / r, k * 1.6 + 0.25, z / r).normalize();
    // the underside keeps more of its own (downward) normal
    const t = n.y < -0.2 ? 0.35 * w : 0.62 * w;
    n.multiplyScalar(1 - t).addScaledVector(e, t).normalize();
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  nor.needsUpdate = true;
}

/**
 * A conifer. `detailed` = near LOD: a trunk plus 8–10 closed, drooping, lobed branch tiers with
 * per-branch length/angle/snow variation and soft envelope normals (no flat facets), topped by a
 * thin leader with two small droop tufts. Otherwise a cheap far LOD (lobed drooping cones with the
 * same soft normals). Colours carry needle/bark albedo; `aSnow` carries snow propensity
 * (composited per instance and per pixel in the foliage shader).
 */
export function pineGeometry(variant: number, detailed: boolean): THREE.BufferGeometry {
  const sh = SHAPES[((variant % SHAPES.length) + SHAPES.length) % SHAPES.length]!;
  const rng = new Rng(9001 + variant * 77 + (detailed ? 0 : 5));
  const tb = new TreeBuilder();
  const soft: number[] = [];
  const H = sh.height;
  const leanDir = rng.range(0, Math.PI * 2);
  const lean = (y: number) => {
    const k = Math.pow(y / H, 2.2) * sh.lean * H;
    return new THREE.Vector3(Math.cos(leanDir) * k, 0, Math.sin(leanDir) * k);
  };
  const crown0 = H * sh.crownBase;
  const pad = () => {
    while (soft.length < tb.pos.length / 3) soft.push(0);
  };
  if (detailed) {
    addTrunk(tb, H * 0.9, 0.27, 7, [0, 0.06, 0.3, 1], rng, lean);
    pad();
    const nT = sh.whorls;
    let rot = rng.range(0, Math.PI * 2);
    const top = H * 0.86;
    for (let k = 0; k < nT; k++) {
      const f = k / (nT - 1);
      const y = crown0 + (top - crown0) * Math.pow(f, 0.9) + rng.range(-0.12, 0.12) * (1 - f);
      const env = Math.pow(1 - f, 0.92) * (1 - 0.1 * Math.pow(1 - f, 4));
      const L = Math.max(0.35, sh.baseR * env * rng.range(0.9, 1.08) + 0.22);
      const dy = (top - crown0) / (nT - 1);
      const droop = THREE.MathUtils.lerp(sh.droop0, sh.droop1, f);
      // each tier's rim falls below the next tier's collar: no core shows between tiers
      const drop = Math.max(dy * rng.range(1.05, 1.3), L * (0.32 + droop * 0.9));
      const lobes = Math.max(3, Math.round(THREE.MathUtils.lerp(sh.maxBranches + 1, 3.4, f) + rng.range(-0.6, 0.6)));
      rot += rng.range(1.9, 2.9);
      const snowLoad = rng.range(0.6, 1.0) * (0.85 + 0.15 * (1 - f));
      addSkirt(tb, soft, lean(y).setY(y), L, drop, lobes, rot, sh.needle, snowLoad, rng, f < 0.5 ? 3 : 2, f < 0.6);
    }
    // natural top: two small droop tufts round a thin, slightly bent leader
    for (let t = 0; t < 2; t++) {
      const y = top + (H - top) * (0.3 + 0.32 * t);
      addSkirt(tb, soft, lean(y).setY(y), 0.42 - 0.12 * t, 0.42, 3, rng.range(0, 6.28), sh.needle, 0.7, rng, 2, false);
    }
    {
      const p = new THREE.Vector3();
      const ring: number[] = [];
      const y0 = top;
      const c = new THREE.Color().copy(sh.needle).multiplyScalar(1.1);
      for (let s = 0; s < 4; s++) {
        const a = (s / 4) * Math.PI * 2;
        p.set(Math.cos(a) * 0.09, y0, Math.sin(a) * 0.09).add(lean(y0));
        ring.push(tb.vert(p, c, 0.3));
      }
      const bend = new THREE.Vector3(rng.range(-0.15, 0.15), 0, rng.range(-0.15, 0.15));
      const tip = tb.vert(p.set(0, H * 1.05, 0).add(lean(H)).add(bend), c, 0.1);
      const out = new THREE.Vector3();
      for (let s = 0; s < 4; s++) {
        const a = ((s + 0.5) / 4) * Math.PI * 2;
        tb.tri(ring[s]!, ring[(s + 1) % 4]!, tip, out.set(Math.cos(a), 0.2, Math.sin(a)));
      }
      pad();
    }
  } else {
    // far LOD: 3-sided trunk stub + 3 lobed drooping cones (tips droop, notches lift)
    addTrunk(tb, crown0 + 1.2, 0.3, 3, [0, 1], rng, lean);
    pad();
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
      const apex = tb.vert(p.set(0, yTop, 0).add(lean(yTop)), c.copy(sh.needle).multiplyScalar(1.0), 0.55);
      soft.push(1);
      rot += rng.range(0.4, 1.0);
      const rim: number[] = [];
      for (let i = 0; i < nb * 2; i++) {
        const tip = i % 2 === 0;
        const a = rot + (i / (nb * 2)) * Math.PI * 2 + (tip ? rng.range(-0.15, 0.15) : 0);
        const rr = tip ? r * rng.range(0.88, 1.1) : r * 0.7;
        const dy = tip ? -r * THREE.MathUtils.lerp(sh.droop0, sh.droop1, f) * 0.55 : r * 0.08;
        p.set(Math.cos(a) * rr, yb + dy, Math.sin(a) * rr).add(lean(yb));
        rim.push(tb.vert(p, c.copy(sh.needle).multiplyScalar(tip ? 1.1 : 0.8), tip ? 0.2 : 0.5));
        soft.push(1);
      }
      for (let i = 0; i < rim.length; i++) {
        const a = rot + ((i + 0.5) / rim.length) * Math.PI * 2;
        tb.tri(rim[i]!, rim[(i + 1) % rim.length]!, apex, out.set(Math.cos(a), 0.5, Math.sin(a)));
      }
    }
  }
  pad();
  const g = tb.build();
  softenNormals(g, soft, H, sh.baseR);
  return g;
}

/**
 * A rock, unit size (~1 m radius). Variants differ in character, not just noise seed:
 * 0 rounded boulder, 1 blocky (cleaved by a few planes), 2 flat slab, 3 tall split block,
 * 4 low weathered dome, 5 angular wedge. Welded vertices → smooth (stylised-soft) shading.
 * `opts.snow` = 0 bakes bare rock (the rock shader then adds snow by world normal).
 */
export function rockGeometry(variant: number, detailed: boolean, opts: { flatten?: number; snow?: number; detail?: number } = {}): THREE.BufferGeometry {
  const kind = ((variant % 6) + 6) % 6;
  const flatten = opts.flatten ?? [0.62, 0.7, 0.4, 0.95, 0.45, 0.75][kind]!;
  const snowAmt = opts.snow ?? 1;
  const ico = new THREE.IcosahedronGeometry(1, opts.detail ?? (detailed ? 2 : 1));
  ico.deleteAttribute('uv');
  ico.deleteAttribute('normal');
  // weld vertices so displacement stays watertight and normals are smooth
  const g = mergeVertices(ico);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const rng = new Rng(4711 + variant * 31);
  // cleavage planes (fractured faces) for the blocky kinds
  const planes: Array<{ n: THREE.Vector3; d: number }> = [];
  const nPlanes = [0, 4, 2, 5, 0, 3][kind]!;
  for (let i = 0; i < nPlanes; i++) {
    const n = new THREE.Vector3(rng.range(-1, 1), rng.range(-0.4, 0.9), rng.range(-1, 1)).normalize();
    planes.push({ n, d: rng.range(0.55, 0.8) });
  }
  const stretch = new THREE.Vector3([1, 1.1, 1.35, 0.8, 1.2, 1.3][kind]!, 1, [1, 0.9, 1.1, 0.85, 1.15, 0.8][kind]!);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = gnoise(v.x * 1.3 + variant * 3, v.z * 1.3 + v.y, 41 + variant) * 0.3 + gnoise(v.x * 3.5, v.y * 3.5 + v.z, 42 + variant) * 0.1 + gnoise(v.x * 8, v.y * 8 + v.z * 2, 43) * 0.035;
    v.multiplyScalar(1 + n);
    for (const pl of planes) {
      const dd = v.dot(pl.n) - pl.d;
      if (dd > 0) v.addScaledVector(pl.n, -dd * 0.92);
    }
    v.multiply(stretch);
    v.y *= flatten;
    if (v.y < -0.1) v.y = -0.1 + (v.y + 0.1) * 0.3;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  return colorize(g, (p, n) => {
    const s = 0.5 + 0.5 * gnoise(p.x * 3, p.y * 6 + p.z * 3, 7 + variant) * (0.7 + 0.3 * gnoise(p.x * 11, p.z * 11, 3));
    // darker, damp underside / base
    const base = 0.75 + 0.25 * THREE.MathUtils.smoothstep(p.y, -0.1, 0.25);
    const rock = new THREE.Color(0.27 * s * base, 0.26 * s * base, 0.25 * s * base);
    if (snowAmt <= 0) return rock;
    const snow = THREE.MathUtils.smoothstep(n.y + 0.2 * gnoise(p.x * 5, p.z * 5, 9), 0.45 + (1 - snowAmt) * 0.4, 0.75 + (1 - snowAmt) * 0.2) * snowAmt;
    return rock.lerp(SNOW, snow);
  });
}

/**
 * Rock material: bare-rock vertex colours, tinted per instance towards the terrain's strata tones
 * (cool grey / warm grey-brown / dark), with lichen/weathering detail and a snow cap computed from
 * the *world* normal (so tilted instances still hold snow on top), with a noisy band-limited edge.
 */
export function createRockMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    addAtmosphereUniforms(shader.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRW;\nvarying vec3 vRN;\nvarying vec3 vRTint;\nvarying float vRSnow;\nvarying vec3 vRP;')
      .replace(
        '#include <fog_vertex>',
        `#include <fog_vertex>
  {
    vec4 sw = vec4(transformed, 1.0);
    vec3 sn = objectNormal;
#ifdef USE_INSTANCING
    sw = instanceMatrix * sw;
    sn = mat3(instanceMatrix) * sn;
    vec3 ip = instanceMatrix[3].xyz;
#else
    vec3 ip = vec3(0.0);
#endif
    vRW = (modelMatrix * sw).xyz;
    vRN = normalize(mat3(modelMatrix) * sn);
    float h1 = fract(sin(dot(mod(ip.xz, 4096.0), vec2(12.9898, 78.233))) * 43758.5453);
    float h2 = fract(h1 * 23.17 + 0.31);
    vec3 cool = vec3(0.95, 0.97, 1.02), warm = vec3(1.18, 1.06, 0.92), dark = vec3(0.62, 0.62, 0.66);
    vRTint = (h1 < 0.45 ? mix(cool, warm, h1 / 0.45) : mix(warm, dark, (h1 - 0.45) / 0.55)) * (0.85 + 0.3 * h2);
    vRSnow = fract(h1 * 7.13 + 0.5);
    vRP = transformed + vec3(h1 * 31.0, 0.0, h2 * 17.0);
  }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vRW;
varying vec3 vRN;
varying vec3 vRTint;
varying float vRSnow;
varying vec3 vRP;
${ATMOSPHERE_GLSL}
${GLSL_NOISE_BL}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec3 q = vRP * 1.6;
  float fp = max(max(fwidth(q.x), fwidth(q.y)), fwidth(q.z));
  float w1 = 0.5 * sf_fbmBL(q.xz + q.y * 0.7, fp) + 0.5 * sf_fbmBL(q.zy * vec2(1.0, 2.2) + 9.0, fp * 2.2);
  vec3 rc = diffuseColor.rgb * vRTint * (0.72 + 0.56 * w1);
  // lichen / weathering stains on the rock
  rc = mix(rc, rc * vec3(1.08, 1.1, 0.85), smoothstep(0.6, 0.8, w1) * 0.5);
  vec3 wn = normalize(vRN);
  float lim = mix(0.32, 0.62, vRSnow);
  float s = smoothstep(lim - 0.08, lim + 0.08, wn.y + 0.35 * (w1 - 0.5));
  diffuseColor.rgb = mix(rc, vec3(0.88, 0.9, 0.94) * (0.93 + 0.07 * w1), s);
}`,
      )
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb = sf_atmosphere(gl_FragColor.rgb, vRW);');
  };
  mat.customProgramCacheKey = () => 'rock-v1';
  return mat;
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
 * `aSnow` (snow propensity baked per vertex) is thresholded per tree — and broken up per pixel by
 * needle-clump noise, so snow edges are irregular rather than following polygon edges. The same
 * clump noise darkens the gaps between needle clusters (band-limited: it fades to its mean when
 * sub-pixel, so distant trees never shimmer). Optional gentle wind sway, height-weighted.
 */
export function createFoliageMaterial(uTime: { value: number }, sway: boolean): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    addAtmosphereUniforms(shader.uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vAtmW;
varying vec3 vTreeP;
varying float vSnowP;
varying float vSnowThr;
${ATMOSPHERE_GLSL}
${GLSL_NOISE_BL}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  // needle clumps (two projections of band-limited value noise in tree space, ~0.35 m cells)
  vec3 q = vTreeP * 2.8;
  float fp = max(max(fwidth(q.x), fwidth(q.y)), fwidth(q.z));
  float cl = 0.5 * sf_vnBL(q.xy, fp) + 0.5 * sf_vnBL(q.zy + 17.0, fp);
  float cl2 = sf_vnBL(q.xz * 2.3 + q.y * 1.7, fp * 2.3);
  float clump = 0.65 * cl + 0.35 * cl2;
  diffuseColor.rgb *= 0.74 + 0.52 * clump;
  float sn = smoothstep(vSnowThr, vSnowThr + 0.16, vSnowP + 0.32 * (clump - 0.5));
  vec3 snowC = vec3(0.86, 0.89, 0.94) * (0.88 + 0.12 * vSnowP) * (0.94 + 0.1 * cl2);
  diffuseColor.rgb = mix(diffuseColor.rgb, snowC, sn);
}`,
      )
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb = sf_atmosphere(gl_FragColor.rgb, vAtmW);');
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aSnow;\nvarying vec3 vAtmW;\nvarying vec3 vTreeP;\nvarying float vSnowP;\nvarying float vSnowThr;')
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
    vColor.rgb *= tint;
    vSnowThr = mix(0.12, 0.62, h3);
    vSnowP = aSnow;
    vTreeP = position + vec3(h1 * 37.0, 0.0, h2 * 23.0);
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
  mat.customProgramCacheKey = () => (sway ? 'foliage-v3-sway' : 'foliage-v3');
  return mat;
}
