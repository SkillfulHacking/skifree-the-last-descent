/**
 * Procedural geometry for the skier. Everything is generated in code; geometries are cached
 * per quality preset and shared between SkierModel instances (ref-counted).
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { QualityPreset } from '../../core/types';
import { BIND, BONE, DIM, armBones, legBones, sideSign } from './rig';
import { grid, hring, loft, normalizeAttrs, skinOf, type Ring, type SkinW } from './loft';
import { clamp, lerp, sampleKeys, smoothstep, sgnPow } from './math';

interface Detail {
  torsoSeg: number;
  torsoRings: number;
  limbSeg: number;
  armRings: number;
  legRings: number;
  headSeg: number;
  headRings: number;
  bootSeg: number;
  bootRings: number;
  skiSeg: number;
  skiRings: number;
  poleSeg: number;
  sphereSeg: number;
  cheap?: boolean;
}

const DETAIL: Record<QualityPreset, Detail> = {
  low: { torsoSeg: 9, torsoRings: 10, limbSeg: 7, armRings: 8, legRings: 9, headSeg: 11, headRings: 5, bootSeg: 7, bootRings: 7, skiSeg: 6, skiRings: 13, poleSeg: 4, sphereSeg: 5, cheap: true },
  medium: { torsoSeg: 16, torsoRings: 28, limbSeg: 11, armRings: 18, legRings: 18, headSeg: 18, headRings: 8, bootSeg: 10, bootRings: 11, skiSeg: 10, skiRings: 22, poleSeg: 6, sphereSeg: 6 },
  high: { torsoSeg: 22, torsoRings: 34, limbSeg: 14, armRings: 22, legRings: 22, headSeg: 22, headRings: 10, bootSeg: 12, bootRings: 12, skiSeg: 12, skiRings: 28, poleSeg: 8, sphereSeg: 7 },
  ultra: { torsoSeg: 28, torsoRings: 44, limbSeg: 18, armRings: 30, legRings: 30, headSeg: 28, headRings: 13, bootSeg: 16, bootRings: 16, skiSeg: 12, skiRings: 36, poleSeg: 10, sphereSeg: 8 },
};

export interface SkierGeometry {
  /** skinned, jacket material: torso + collar + sleeves */
  jacket: THREE.BufferGeometry;
  /** skinned, stripe material */
  stripe: THREE.BufferGeometry;
  /** skinned, pants material: pelvis + legs */
  pants: THREE.BufferGeometry;
  /** skinned, gaiter material */
  gaiter: THREE.BufferGeometry;
  // rigid, head-local
  headFill: THREE.BufferGeometry;
  helmet: THREE.BufferGeometry;
  helmetDark: THREE.BufferGeometry;
  goggleFrame: THREE.BufferGeometry;
  lens: THREE.BufferGeometry;
  strap: THREE.BufferGeometry;
  // joints
  kneeFill: THREE.BufferGeometry;
  elbowFill: THREE.BufferGeometry;
  // per side [left, right]
  glove: [THREE.BufferGeometry, THREE.BufferGeometry];
  bootShell: [THREE.BufferGeometry, THREE.BufferGeometry];
  bootCuff: [THREE.BufferGeometry, THREE.BufferGeometry];
  bootMetal: [THREE.BufferGeometry, THREE.BufferGeometry];
  bootCuffMetal: [THREE.BufferGeometry, THREE.BufferGeometry];
  bootDark: THREE.BufferGeometry;
  binding: THREE.BufferGeometry;
  bindingAccent: THREE.BufferGeometry;
  ski: THREE.BufferGeometry;
  poleGrip: THREE.BufferGeometry;
  poleShaft: THREE.BufferGeometry;
  skiTexture: THREE.Texture;
  envTexture: THREE.Texture;
  triangles: number;
  all: THREE.BufferGeometry[];
}

const V = (x = 0, y = 0, z = 0): THREE.Vector3 => new THREE.Vector3(x, y, z);
let CHEAP = false;
/** Rounded box, or a plain box on the cheapest preset. */
function rbox(w: number, h: number, d: number, seg: number, r: number): THREE.BufferGeometry {
  return CHEAP ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, seg, r);
}
const tmpS: number[] = [];

// ---------------------------------------------------------------------------------------------
// skin weight functions (bind space)

function torsoSkin(p: THREE.Vector3): SkinW {
  const y = p.y;
  const ps = smoothstep(BIND.pelvis + 0.04, BIND.spine + 0.05, y);
  const sc = smoothstep(BIND.spine + 0.1, BIND.chest + 0.06, y);
  const cn = smoothstep(BIND.neck - 0.03, BIND.neck + 0.06, y);
  const chest = ps * sc * (1 - cn);
  const share = smoothstep(0.1, 0.19, Math.abs(p.x)) * smoothstep(BIND.shoulderY - 0.08, BIND.shoulderY + 0.01, y) * 0.55;
  // front of the hem rides on the thighs so flexed legs don't punch through it
  const sRel = y - BIND.pelvis;
  const fl = (1 - smoothstep(-0.13, 0.02, sRel)) * smoothstep(-0.02, 0.09, p.z) * smoothstep(0.0, 0.07, Math.abs(p.x)) * 0.45;
  return skinOf([
    [BONE.pelvis, (1 - ps) * (1 - fl)],
    [p.x >= 0 ? BONE.thighL : BONE.thighR, (1 - ps) * fl],
    [BONE.spine, ps * (1 - sc)],
    [BONE.chest, chest * (1 - share)],
    [p.x >= 0 ? BONE.clavL : BONE.clavR, chest * share],
    [BONE.neck, ps * sc * cn],
  ]);
}

// ---------------------------------------------------------------------------------------------
// jacket

const QUILT_PERIOD = 0.105;
function puff(s: number, period: number, phase: number): number {
  const f = (((s - phase) / period) % 1 + 1) % 1;
  return Math.pow(Math.sin(Math.PI * f), 0.55);
}

const TORSO_KEYS: readonly (readonly number[])[] = [
  // s (rel pelvis), halfWidth, halfDepth, zc, superellipse n
  [-0.17, 0.207, 0.152, -0.012, 2.6],
  [-0.1, 0.205, 0.151, -0.01, 2.6],
  [0.0, 0.199, 0.147, -0.006, 2.6],
  [0.1, 0.195, 0.144, 0.0, 2.6],
  [0.2, 0.197, 0.146, 0.004, 2.7],
  [0.3, 0.201, 0.147, 0.006, 2.8],
  [0.38, 0.204, 0.141, 0.002, 2.8],
  [0.425, 0.196, 0.129, -0.006, 2.6],
  [0.465, 0.163, 0.111, -0.01, 2.4],
  [0.495, 0.11, 0.089, -0.006, 2.2],
  [0.515, 0.09, 0.079, -0.004, 2.0],
];

function torsoRing(s: number): Ring {
  const k = sampleKeys(TORSO_KEYS, s, tmpS);
  return hring(0, BIND.pelvis + s, k[2], k[0], k[1], k[3]);
}

function buildTorso(D: Detail, quilt: boolean, inflate = 1, s0 = -0.17, s1 = 0.515, lip = true): THREE.BufferGeometry {
  const rings: Ring[] = [];
  const N = Math.max(4, Math.round((D.torsoRings * (s1 - s0)) / 0.685));
  if (lip) {
    const r = torsoRing(s0);
    rings.push({ ...r, c: r.c.clone().setY(r.c.y + 0.025), a: r.a * 0.9, b: r.b * 0.9 });
  }
  for (let i = 0; i < N; i++) {
    const r = torsoRing(s0 + ((s1 - s0) * i) / (N - 1));
    r.a *= inflate;
    r.b *= inflate;
    rings.push(r);
  }
  const sOf = (i: number): number => rings[i].c.y - BIND.pelvis;
  const quiltAmt = (s: number): number => (quilt ? 1 - smoothstep(0.36, 0.44, s) : 0) * (s > -0.15 ? 1 : 0);
  return loft(rings, {
    segs: D.torsoSeg,
    radial: (_t, i) => {
      const s = sOf(i);
      return 1 + 0.06 * quiltAmt(s) * (puff(s, QUILT_PERIOD, -0.14) - 0.65);
    },
    shade: (p, i, t) => {
      const s = sOf(i);
      let sh = 1;
      const q = quiltAmt(s);
      if (q > 0) sh *= lerp(1, 0.6 + 0.4 * puff(s, QUILT_PERIOD, -0.14), q);
      // side seams / under-arm occlusion
      const side = Math.abs(Math.cos(t));
      sh *= 1 - 0.18 * smoothstep(0.85, 1, side) * smoothstep(0.2, 0.4, s) * (1 - smoothstep(0.42, 0.48, s));
      // hem band
      sh *= 1 - 0.22 * (1 - smoothstep(-0.17, -0.14, s));
      void p;
      return sh;
    },
    skin: torsoSkin,
  });
}

const SLEEVE_KEYS: readonly (readonly number[])[] = [
  // d (below shoulder joint), halfX, halfZ
  [-0.03, 0.03, 0.03],
  [-0.018, 0.05, 0.05],
  [0.01, 0.064, 0.064],
  [0.05, 0.068, 0.067],
  [0.13, 0.066, 0.064],
  [0.24, 0.06, 0.058],
  [0.29, 0.058, 0.057],
  [0.36, 0.057, 0.055],
  [0.47, 0.053, 0.051],
  [0.55, 0.049, 0.047],
  [0.57, 0.046, 0.044],
];

function sleeveSkin(side: number, d: number): SkinW {
  const b = armBones(side);
  const up = smoothstep(-0.06, 0.03, d);
  const fore = smoothstep(DIM.UPPER_ARM - 0.06, DIM.UPPER_ARM + 0.06, d);
  return skinOf([
    [b.clav, 1 - up],
    [b.upper, up * (1 - fore)],
    [b.fore, up * fore],
  ]);
}

function buildSleeve(D: Detail, side: number, quilt: boolean, d0 = -0.03, d1 = 0.57, inflate = 1, cap = true): THREE.BufferGeometry {
  const s = sideSign(side);
  const N = Math.max(4, Math.round((D.armRings * (d1 - d0)) / 0.6));
  const rings: Ring[] = [];
  for (let i = 0; i < N; i++) {
    const d = d0 + ((d1 - d0) * i) / (N - 1);
    const k = sampleKeys(SLEEVE_KEYS, d, tmpS);
    rings.push(hring(s * BIND.shoulderX, BIND.shoulderY - d, BIND.shoulderZ, k[0] * inflate, k[1] * inflate, 2));
  }
  const dOf = (i: number): number => BIND.shoulderY - rings[i].c.y;
  const qa = (d: number): number => (quilt ? smoothstep(0.02, 0.06, d) * (1 - smoothstep(0.5, 0.54, d)) : 0);
  return loft(rings, {
    segs: D.limbSeg,
    capStart: cap ? 0.004 : null,
    radial: (_t, i) => {
      const d = dOf(i);
      return 1 + 0.04 * qa(d) * (puff(d, 0.072, 0.02) - 0.65);
    },
    shade: (_p, i) => {
      const d = dOf(i);
      return lerp(1, 0.76 + 0.24 * puff(d, 0.072, 0.02), qa(d)) * (1 - 0.25 * smoothstep(0.53, 0.57, d));
    },
    skin: (p) => sleeveSkin(side, BIND.shoulderY - p.y),
  });
}

const COLLAR_KEYS: readonly (readonly number[])[] = [
  [1.455, 0.092, 0.086, -0.004],
  [1.5, 0.088, 0.084, 0.002],
  [1.55, 0.085, 0.084, 0.008],
  [1.588, 0.083, 0.083, 0.01],
];
const collarRing = (y: number): Ring => {
  const k = sampleKeys(COLLAR_KEYS, y, tmpS);
  return hring(0, y, k[2], k[0], k[1], 2);
};
const collarSkin = (p: THREE.Vector3): SkinW => {
  const n = smoothstep(1.47, 1.6, p.y) * 0.75;
  return skinOf([
    [BONE.chest, 1 - n],
    [BONE.neck, n],
  ]);
};

/** Raised strip glued onto a lofted surface around theta = pi/2 (centre front). */
function frontStrip(
  ringAt: (s: number) => Ring,
  s0: number,
  s1: number,
  rows: number,
  halfWidth: number,
  lift: number,
  radial: (s: number) => number,
  skin: (p: THREE.Vector3) => SkinW,
): THREE.BufferGeometry {
  return grid({
    rows,
    cols: 4,
    closed: false,
    pos: (i, j, out) => {
      const sv = lerp(s0, s1, i / (rows - 1));
      const r = ringAt(sv);
      const m = radial(sv);
      const x = lerp(-halfWidth, halfWidth, j / 3);
      const e = 2 / r.n;
      const th = Math.acos(clamp(sgnPow(x / (r.a * m), 1 / e), -1, 1));
      const edge = j === 0 || j === 3 ? 0 : 1;
      const k = m + (lift * (0.5 + 0.5 * edge)) / r.b;
      out
        .copy(r.c)
        .addScaledVector(r.u, r.a * sgnPow(Math.cos(th), e) * k)
        .addScaledVector(r.v, r.b * sgnPow(Math.sin(th), e) * k);
    },
    inside: (i, out) => {
      out.copy(ringAt(lerp(s0, s1, i / (rows - 1))).c);
    },
    shade: (_p, _i, j) => (j === 1 || j === 2 ? 0.75 : 1),
    skin,
  });
}

function buildPlacket(D: Detail, quilt: boolean): THREE.BufferGeometry {
  const rows = Math.max(4, Math.round(D.torsoRings * 1.3));
  const qa = (sv: number): number => (quilt ? 1 - smoothstep(0.36, 0.44, sv) : 0) * (sv > -0.15 ? 1 : 0);
  const torso = frontStrip(
    torsoRing,
    -0.168,
    0.5,
    rows,
    0.009,
    0.0055,
    (sv) => 1 + 0.06 * qa(sv) * (puff(sv, QUILT_PERIOD, -0.14) - 0.65) + 0.004,
    torsoSkin,
  );
  const collar = frontStrip(collarRing, 1.47, 1.585, 4, 0.008, 0.003, () => 1.0, collarSkin);
  return mergeSkinned([torso, collar]);
}

function buildCollar(D: Detail): THREE.BufferGeometry {
  const rings: Ring[] = COLLAR_KEYS.map((k) => collarRing(k[0]));
  rings.push(hring(0, 1.578, 0.01, 0.074, 0.074, 2));
  return loft(rings, {
    segs: D.torsoSeg,
    shade: (p) => (p.y > 1.582 ? 0.8 : 1),
    skin: collarSkin,
  });
}

// ---------------------------------------------------------------------------------------------
// pants

const LEG_KEYS: readonly (readonly number[])[] = [
  // d (below hip joint), halfX, halfZ, zc
  [-0.075, 0.06, 0.065, 0.0],
  [-0.04, 0.085, 0.092, 0.0],
  [0.0, 0.092, 0.099, 0.0],
  [0.1, 0.089, 0.096, 0.008],
  [0.24, 0.08, 0.086, 0.01],
  [0.37, 0.069, 0.073, 0.008],
  [0.44, 0.066, 0.071, 0.013],
  [0.52, 0.064, 0.067, -0.002],
  [0.6, 0.066, 0.071, -0.009],
  [0.68, 0.072, 0.079, -0.006],
  [0.745, 0.078, 0.087, -0.004],
  [0.765, 0.075, 0.084, -0.004],
];

function legSkin(side: number, d: number): SkinW {
  const b = legBones(side);
  const th = smoothstep(-0.07, 0.04, d);
  const sh = smoothstep(DIM.THIGH - 0.07, DIM.THIGH + 0.06, d);
  return skinOf([
    [BONE.pelvis, 1 - th],
    [b.thigh, th * (1 - sh)],
    [b.shin, th * sh],
  ]);
}

function buildLeg(D: Detail, side: number): THREE.BufferGeometry {
  const s = sideSign(side);
  const d0 = -0.075;
  const d1 = 0.765;
  const N = D.legRings;
  const rings: Ring[] = [];
  for (let i = 0; i < N; i++) {
    const d = d0 + ((d1 - d0) * i) / (N - 1);
    const k = sampleKeys(LEG_KEYS, d, tmpS);
    rings.push(hring(s * DIM.HIP_X, BIND.hipY - d, k[2], k[0], k[1], 2));
  }
  // inner hem lip
  rings.push(hring(s * DIM.HIP_X, BIND.hipY - 0.745, -0.004, 0.066, 0.074, 2));
  return loft(rings, {
    segs: D.limbSeg,
    capStart: 0.02,
    shade: (p, _i, t) => {
      const d = BIND.hipY - p.y;
      let sh = 1;
      // knee articulation darts (front)
      const front = Math.max(0, Math.sin(t));
      sh *= 1 - 0.16 * front * Math.exp(-Math.pow((d - 0.405) / 0.018, 2)) - 0.12 * front * Math.exp(-Math.pow((d - 0.485) / 0.018, 2));
      // hem / gaiter band
      sh *= 1 - 0.3 * smoothstep(0.715, 0.75, d);
      // inner thigh occlusion
      const inner = Math.max(0, -s * Math.cos(t));
      sh *= 1 - 0.2 * inner * (1 - smoothstep(0.0, 0.2, d));
      return sh;
    },
    skin: (p) => legSkin(side, BIND.hipY - p.y),
  });
}

function buildPantsPelvis(D: Detail): THREE.BufferGeometry {
  const keys: readonly (readonly number[])[] = [
    [0.1, 0.166, 0.122, -0.008],
    [0.02, 0.176, 0.13, -0.012],
    [-0.06, 0.181, 0.134, -0.018],
    [-0.12, 0.171, 0.126, -0.016],
    [-0.17, 0.14, 0.108, -0.01],
    [-0.2, 0.09, 0.075, -0.004],
  ];
  const N = Math.max(5, Math.round(D.legRings * 0.4));
  const rings: Ring[] = [];
  for (let i = 0; i < N; i++) {
    const s = 0.1 - (0.3 * i) / (N - 1);
    const k = sampleKeys(keys, s, tmpS);
    rings.push(hring(0, BIND.pelvis + s, k[2], k[0], k[1], 2.3));
  }
  return loft(rings, {
    segs: D.torsoSeg,
    capEnd: 0.02,
    shade: (p) => 1 - 0.25 * smoothstep(BIND.pelvis - 0.12, BIND.pelvis - 0.2, p.y),
    skin: (p) => {
      const k = smoothstep(BIND.pelvis - 0.06, BIND.pelvis - 0.18, p.y) * smoothstep(0.0, 0.09, Math.abs(p.x)) * 0.6;
      const th = p.x >= 0 ? BONE.thighL : BONE.thighR;
      return skinOf([
        [BONE.pelvis, 1 - k],
        [th, k],
      ]);
    },
  });
}

// ---------------------------------------------------------------------------------------------
// head

const HC = V(DIM.HEAD_CX, DIM.HEAD_CY, DIM.HEAD_CZ);
const H_RX = 0.114;
const H_RY = 0.124;
const H_RZF = 0.13;
const H_RZB = 0.138;

function helmetPoint(theta: number, phi: number, inflate: number, out: THREE.Vector3): THREE.Vector3 {
  const rz = lerp(H_RZB, H_RZF, (1 + Math.cos(theta)) / 2);
  const cp = Math.cos(phi);
  // slight squareness on the sides gives a modern shell silhouette
  const st = sgnPow(Math.sin(theta), 0.85);
  return out.set(
    HC.x + (H_RX + inflate) * cp * st,
    HC.y + (H_RY + inflate) * Math.sin(phi),
    HC.z - 0.006 + (rz + inflate) * cp * Math.cos(theta),
  );
}
function helmetPhiMin(theta: number): number {
  const f = (1 + Math.cos(theta)) / 2;
  return lerp(-0.5, 0.25, smoothstep(0.62, 0.97, f));
}

function buildHelmet(D: Detail): THREE.BufferGeometry {
  const K = D.headRings;
  const phiTop = Math.PI / 2 - 0.16;
  const rows = K + 2;
  return grid({
    rows,
    cols: D.headSeg,
    closed: true,
    pos: (i, j, out) => {
      const th = (Math.PI * 2 * j) / D.headSeg;
      const pm = helmetPhiMin(th);
      if (i === 0) {
        helmetPoint(th, pm + 0.16, -0.016, out);
      } else if (i === 1) {
        helmetPoint(th, pm, -0.003, out);
        out.y -= 0.003;
      } else {
        const k = (i - 2) / (K - 1);
        const ph = lerp(pm, phiTop, Math.pow(k, 0.85));
        helmetPoint(th, ph, 0, out);
      }
    },
    inside: (_i, out) => {
      out.copy(HC);
    },
    capEnd: V(HC.x, HC.y + H_RY * 1.0, HC.z - 0.006),
    shade: (_p, i) => (i === 0 ? 0.35 : i === 1 ? 0.8 : 1),
  });
}

function buildHelmetDark(D: Detail): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const vents: [number, number, number, number][] = [
    // theta centre, half-width (rad), phi0, phi1
    [0, 0.07, 0.6, 1.12],
    [-0.36, 0.065, 0.55, 1.05],
    [0.36, 0.065, 0.55, 1.05],
    [Math.PI - 0.32, 0.07, 0.12, 0.62],
    [Math.PI + 0.32, 0.07, 0.12, 0.62],
    [Math.PI, 0.06, 0.2, 0.75],
  ];
  const rows = D.headRings >= 12 ? 6 : 3;
  for (const [tc, hw, p0, p1] of vents) {
    parts.push(
      grid({
        rows,
        cols: 3,
        closed: false,
        pos: (i, j, out) => {
          const ph = lerp(p0, p1, i / (rows - 1));
          // taper the slot ends so they read as rounded vents
          const taper = Math.sqrt(Math.max(0.15, 1 - Math.pow((2 * i) / (rows - 1) - 1, 2)));
          const th = tc + hw * taper * (j - 1) / Math.max(0.3, Math.cos(ph));
          helmetPoint(th, ph, 0.0016, out);
        },
        inside: (_i, out) => {
          out.copy(HC);
        },
      }),
    );
  }
  // rear fit dial
  const dial = new THREE.CylinderGeometry(0.017, 0.017, 0.012, Math.max(8, D.poleSeg + 2));
  const n = helmetPoint(Math.PI, -0.34, 0, V()).sub(HC).normalize();
  const p = helmetPoint(Math.PI, -0.34, 0.003, V());
  dial.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), n));
  dial.translate(p.x, p.y, p.z);
  parts.push(dial.toNonIndexed());
  // brim trim line above goggles (front)
  parts.push(
    grid({
      rows: 2,
      cols: Math.round(D.headSeg * 0.45),
      closed: false,
      pos: (i, j, out) => {
        const cols = Math.round(D.headSeg * 0.45);
        const th = lerp(-1.25, 1.25, j / (cols - 1));
        const pm = helmetPhiMin(th);
        helmetPoint(th, pm + 0.03 + i * 0.07, 0.0012, out);
      },
      inside: (_i, out) => {
        out.copy(HC);
      },
    }),
  );
  return mergeAll(parts);
}

const G_RX = 0.107;
const G_RZ = 0.124;
const gogglePath = (th: number, out: THREE.Vector3, extra = 0): THREE.Vector3 =>
  out.set(HC.x + (G_RX + extra) * Math.sin(th), HC.y, HC.z + (G_RZ + extra) * Math.cos(th));
const noseNotch = (th: number): number => Math.exp(-Math.pow(th / 0.24, 2));

function buildGoggleFrame(D: Detail): THREE.BufferGeometry {
  const N = Math.max(8, Math.round(D.headSeg * 0.9));
  const rings: Ring[] = [];
  const t0 = -1.3;
  const t1 = 1.3;
  for (let i = 0; i < N; i++) {
    const th = lerp(t0, t1, i / (N - 1));
    const c = gogglePath(th, V());
    const nn = noseNotch(th);
    c.y += 0.0085 * nn;
    const u = V(Math.sin(th) / G_RX, 0, Math.cos(th) / G_RZ).normalize();
    const endT = smoothstep(1.15, 1.3, Math.abs(th));
    rings.push({ c, u, v: V(0, 1, 0), a: 0.012, b: (0.036 - 0.0085 * nn) * (1 - 0.35 * endT), n: 4 });
  }
  return loft(rings, { segs: D.limbSeg >= 16 ? 12 : D.cheap ? 6 : 8, capStart: 0.002, capEnd: 0.002 });
}

function buildLens(D: Detail): THREE.BufferGeometry {
  const cols = Math.max(10, Math.round(D.headSeg * 0.9));
  const rows = D.headSeg >= 24 ? 7 : 4;
  return grid({
    rows,
    cols,
    closed: false,
    pos: (i, j, out) => {
      const th = lerp(-1.17, 1.17, j / (cols - 1));
      const h = lerp(-1, 1, i / (rows - 1));
      const nn = noseNotch(th);
      const bul = 0.0045 * (1 - h * h) * Math.cos(th * 0.8);
      gogglePath(th, out, 0.0118 + bul);
      out.y += h * (0.0285 - 0.0085 * nn) + 0.0085 * nn;
    },
    inside: (_i, out) => {
      out.copy(HC);
    },
  });
}

function buildStrap(D: Detail): THREE.BufferGeometry {
  const N = Math.max(8, Math.round(D.headSeg * 0.8));
  const rings: Ring[] = [];
  const t0 = 1.15;
  const t1 = Math.PI * 2 - 1.15;
  const hp = V();
  for (let i = 0; i < N; i++) {
    const th = lerp(t0, t1, i / (N - 1));
    const thn = Math.atan2(Math.sin(th), Math.cos(th));
    const g = gogglePath(th, V(), 0.002);
    helmetPoint(th, 0, 0.0035, hp);
    const k = smoothstep(1.15, 1.55, Math.abs(thn));
    const c = g.lerp(hp, k);
    c.y = HC.y + 0.002;
    const u = V(c.x - HC.x, 0, c.z - HC.z).normalize();
    rings.push({ c, u, v: V(0, 1, 0), a: 0.0028, b: 0.021, n: 6 });
  }
  return loft(rings, {
    segs: D.cheap ? 4 : 8,
    capStart: 0,
    capEnd: 0,
    shade: (p) => {
      // woven pattern: two bright bands
      const rel = p.y - HC.y;
      return Math.abs(rel) > 0.013 ? 0.55 : 1;
    },
  });
}

function buildGaiter(D: Detail): THREE.BufferGeometry {
  const keys: readonly (readonly number[])[] = [
    [1.455, 0.066, 0.066, 0.0],
    [1.53, 0.06, 0.062, 0.004],
    [1.58, 0.064, 0.072, 0.014],
    [1.625, 0.071, 0.083, 0.024],
    [1.665, 0.074, 0.088, 0.028],
    [1.7, 0.072, 0.083, 0.024],
  ];
  const N = Math.max(5, Math.round(D.headRings * 0.9));
  const rings: Ring[] = [];
  for (let i = 0; i < N; i++) {
    const y = lerp(1.455, 1.7, i / (N - 1));
    const k = sampleKeys(keys, y, tmpS);
    rings.push(hring(0, y, k[2], k[0], k[1], 2));
  }
  return loft(rings, {
    segs: Math.max(10, D.headSeg - 6),
    shade: (p, _i, t) => {
      // knit ribbing texture via subtle vertical bands
      const rib = D.headSeg >= 24 ? 0.93 + 0.07 * Math.cos(t * 16) : 1;
      return rib * (p.y > 1.69 ? 0.8 : 1);
    },
    skin: (p) => {
      const h = smoothstep(1.56, 1.64, p.y);
      const c = 1 - smoothstep(1.46, 1.53, p.y);
      return skinOf([
        [BONE.chest, c],
        [BONE.neck, (1 - c) * (1 - h)],
        [BONE.head, (1 - c) * h],
      ]);
    },
  });
}

// ---------------------------------------------------------------------------------------------
// hands

function buildGlove(D: Detail, side: number): THREE.BufferGeometry {
  const s = sideSign(side);
  const seg = Math.max(8, D.limbSeg);
  const fistKeys: readonly (readonly number[])[] = [
    [0.0, 0.034, 0.043, 0.0],
    [0.03, 0.041, 0.051, 0.004],
    [0.065, 0.045, 0.055, 0.006],
    [0.097, 0.041, 0.051, 0.005],
    [0.12, 0.028, 0.038, 0.002],
  ];
  const nF = Math.max(5, Math.round(D.armRings * 0.3));
  const fr: Ring[] = [];
  for (let i = 0; i < nF; i++) {
    const d = (0.12 * i) / (nF - 1);
    const k = sampleKeys(fistKeys, d, tmpS);
    fr.push(hring(s * k[2], -d, 0, k[0], k[1], 2.4));
  }
  const fist = loft(fr, {
    segs: seg,
    capEnd: 0.012,
    shade: (_p, _i, t) => {
      // knuckle side lighter (padded), palm side darker leather
      const lat = s * Math.cos(t);
      return lat > 0.3 ? 1 : 0.72;
    },
  });
  const thumb = new THREE.CapsuleGeometry(0.0145, 0.036, 2, Math.max(6, Math.round(seg * 0.6)));
  thumb.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), V(0, -0.35, 1).normalize()));
  thumb.translate(-s * 0.03, -0.05, 0.042);
  const cuffKeys: readonly (readonly number[])[] = [
    [-0.01, 0.049, 0.054],
    [0.035, 0.052, 0.057],
    [0.07, 0.056, 0.06],
    [0.08, 0.054, 0.058],
  ];
  const cr: Ring[] = [];
  const nC = Math.max(3, Math.round(D.armRings * 0.18));
  for (let i = 0; i < nC; i++) {
    const y = lerp(-0.01, 0.08, i / (nC - 1));
    const k = sampleKeys(cuffKeys, y, tmpS);
    cr.push(hring(0, y, -0.002, k[0], k[1], 2));
  }
  cr.push(hring(0, 0.07, -0.002, 0.048, 0.053, 2));
  const cuff = loft(cr, { segs: seg, shade: (p) => (p.y > 0.055 ? 0.55 : 0.9) });
  return mergeAll([fist, thumb, cuff]);
}

// ---------------------------------------------------------------------------------------------
// boots, bindings, skis

const SOLE_Y = -0.1;
function buildBootShell(D: Detail, side: number): { shell: THREE.BufferGeometry; metal: THREE.BufferGeometry } {
  const s = sideSign(side);
  const keys: readonly (readonly number[])[] = [
    // z, halfWidth, topY
    [-0.098, 0.022, -0.02],
    [-0.088, 0.043, 0.055],
    [-0.06, 0.05, 0.075],
    [0.0, 0.054, 0.07],
    [0.06, 0.057, 0.048],
    [0.12, 0.058, 0.022],
    [0.18, 0.054, -0.01],
    [0.215, 0.046, -0.03],
    [0.236, 0.024, -0.05],
  ];
  const N = D.bootRings;
  const rings: Ring[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const z = lerp(-0.098, 0.236, 0.5 - 0.5 * Math.cos(Math.PI * t));
    const k = sampleKeys(keys, z, tmpS);
    const hb = (k[1] - SOLE_Y) / 2;
    rings.push({ c: V(0, SOLE_Y + hb, z), u: V(1, 0, 0), v: V(0, 1, 0), a: k[0], b: hb, n: 3.2 });
  }
  const shell = loft(rings, {
    segs: D.bootSeg,
    capStart: 0.004,
    capEnd: 0.004,
    shade: (p) => (p.y < SOLE_Y + 0.012 ? 0.55 : 1),
  });
  // shell buckles (on the lateral side of the instep)
  const metal: THREE.BufferGeometry[] = [];
  const addBuckle = (z: number, theta: number): void => {
    const k = sampleKeys(keys, z, tmpS);
    const hb = (k[1] - SOLE_Y) / 2;
    const cy = SOLE_Y + hb;
    const e = 2 / 3.2;
    const cu = sgnPow(Math.cos(theta), e);
    const sv = sgnPow(Math.sin(theta), e);
    const p = V(k[0] * cu, cy + hb * sv, z);
    const n = V(cu / k[0], sv / hb, 0).normalize();
    const tng = V(-n.y, n.x, 0);
    const b = rbox(0.036, 0.008, 0.017, 1, 0.003);
    const m = new THREE.Matrix4().makeBasis(tng, n, V(0, 0, 1));
    b.applyMatrix4(m);
    b.translate(p.x + n.x * 0.003, p.y + n.y * 0.003, p.z);
    metal.push(b);
  };
  addBuckle(0.035, Math.PI / 2 - s * 0.55);
  addBuckle(0.105, Math.PI / 2 - s * 0.6);
  return { shell, metal: mergeAll(metal) };
}

function buildBootCuff(D: Detail, side: number): { cuff: THREE.BufferGeometry; metal: THREE.BufferGeometry } {
  const s = sideSign(side);
  const keys: readonly (readonly number[])[] = [
    // y (ankle-relative), halfX, halfZ, zc
    [-0.07, 0.054, 0.07, -0.004],
    [0.0, 0.06, 0.075, -0.006],
    [0.08, 0.063, 0.073, -0.007],
    [0.16, 0.064, 0.072, -0.008],
    [0.205, 0.066, 0.074, -0.008],
    [0.215, 0.06, 0.068, -0.008],
  ];
  const N = Math.max(4, Math.round(D.bootRings * 0.6));
  const rings: Ring[] = [];
  for (let i = 0; i < N; i++) {
    const y = lerp(-0.07, 0.215, i / (N - 1));
    const k = sampleKeys(keys, y, tmpS);
    rings.push(hring(0, y, k[2], k[0], k[1], 2.4));
  }
  const cuff = loft(rings, {
    segs: D.bootSeg,
    capStart: 0.0,
    shade: (p, _i, t) => {
      // overlap flap line on the front-lateral side
      const flap = Math.exp(-Math.pow((t - (Math.PI / 2 - s * 0.35)) / 0.08, 2));
      return (1 - 0.35 * flap) * (p.y > 0.2 ? 0.6 : 1);
    },
  });
  const metal: THREE.BufferGeometry[] = [];
  for (const y of [0.035, 0.115]) {
    const k = sampleKeys(keys, y, tmpS);
    const th = Math.PI / 2 - s * 0.75;
    const p = V(k[0] * Math.cos(th), y, k[2] + k[1] * Math.sin(th));
    const n = V(Math.cos(th) / k[0], 0, Math.sin(th) / k[1]).normalize();
    const tng = V(-n.z, 0, n.x);
    const b = rbox(0.038, 0.017, 0.008, 1, 0.003);
    b.applyMatrix4(new THREE.Matrix4().makeBasis(tng, V(0, 1, 0), n));
    b.translate(p.x + n.x * 0.004, p.y, p.z + n.z * 0.004);
    metal.push(b);
  }
  // hinge rivets at the ankle pivot (both sides)
  for (const sx of [1, -1]) {
    const r = new THREE.CylinderGeometry(0.011, 0.011, 0.006, Math.max(6, D.bootSeg));
    r.rotateZ(Math.PI / 2);
    r.translate(sx * 0.061, 0.0, -0.006);
    metal.push(r);
  }
  return { cuff, metal: mergeAll(metal) };
}

function buildBootDark(): THREE.BufferGeometry {
  // rubber sole with toe and heel lugs (binding interface)
  const sole = rbox(0.1, 0.014, 0.33, 1, 0.006);
  sole.translate(0, SOLE_Y - 0.006, 0.069);
  const toe = rbox(0.07, 0.016, 0.03, 1, 0.004);
  toe.translate(0, SOLE_Y + 0.008, 0.235);
  const heel = rbox(0.075, 0.018, 0.03, 1, 0.004);
  heel.translate(0, SOLE_Y + 0.01, -0.1);
  return mergeAll([sole, toe, heel]);
}

const SKI_TOP_Y = -DIM.ANKLE_H + 0.017;
function buildBinding(): { body: THREE.BufferGeometry; accent: THREE.BufferGeometry } {
  const plate = rbox(0.072, 0.012, 0.46, 1, 0.004);
  plate.translate(0, SKI_TOP_Y + 0.006, 0.06);
  const toe = rbox(0.078, 0.042, 0.075, 1, 0.012);
  toe.translate(0, SKI_TOP_Y + 0.02, 0.275);
  const toeWing = rbox(0.086, 0.016, 0.03, 1, 0.005);
  toeWing.translate(0, SKI_TOP_Y + 0.036, 0.245);
  const heel = rbox(0.08, 0.06, 0.1, 1, 0.014);
  heel.translate(0, SKI_TOP_Y + 0.028, -0.155);
  const brakeL = rbox(0.006, 0.006, 0.11, 1, 0.002);
  brakeL.translate(0.047, SKI_TOP_Y + 0.006, -0.08);
  const brakeR = brakeL.clone();
  brakeR.translate(-0.094, 0, 0);
  const lever = rbox(0.052, 0.012, 0.1, 1, 0.005);
  lever.applyMatrix4(new THREE.Matrix4().makeRotationX(0.32));
  lever.translate(0, SKI_TOP_Y + 0.058, -0.17);
  const toeCap = rbox(0.05, 0.012, 0.045, 1, 0.005);
  toeCap.translate(0, SKI_TOP_Y + 0.043, 0.285);
  return { body: mergeAll([plate, toe, toeWing, heel, brakeL, brakeR]), accent: mergeAll([lever, toeCap]) };
}

/** Ski in foot-local space: base at y = -ANKLE_H, tip toward +Z. */
function buildSki(D: Detail): THREE.BufferGeometry {
  const half = DIM.SKI_HALF;
  const width = (z: number): number => {
    if (z >= 0) {
      if (z <= 0.66) return 0.08 + 0.042 * Math.pow(z / 0.66, 2);
      const k = (z - 0.66) / (half - 0.66);
      return 0.122 * Math.sqrt(Math.max(0.004, 1 - k * k));
    }
    const zz = -z;
    if (zz <= 0.72) return 0.08 + 0.03 * Math.pow(zz / 0.72, 2);
    const k = (zz - 0.72) / (half - 0.72);
    return 0.11 * Math.pow(Math.max(0.004, 1 - Math.pow(k, 4)), 0.5);
  };
  const thick = (z: number): number => 0.006 + 0.011 * Math.pow(Math.max(0, 1 - (z / half) ** 2), 1.3);
  const baseY = (z: number): number => {
    if (z > 0.58) return Math.pow((z - 0.58) / 0.27, 2) * 0.08;
    if (z < -0.7) return Math.pow((-z - 0.7) / 0.15, 2) * 0.026;
    return 0;
  };
  const N = D.skiRings;
  const rings: Ring[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    // cluster rings at the tip/tail where curvature lives
    const z = -half + 2 * half * (t < 0.5 ? 0.5 * Math.pow(2 * t, 1.25) : 1 - 0.5 * Math.pow(2 - 2 * t, 1.25));
    const zc = clamp(z, -half + 0.002, half - 0.002);
    const y = baseY(zc);
    const dy = (baseY(zc + 0.002) - baseY(zc - 0.002)) / 0.004;
    const nrm = V(0, 1, -dy).normalize();
    const th = thick(zc);
    const c = V(0, y, zc).addScaledVector(nrm, th / 2);
    rings.push({ c, u: V(1, 0, 0), v: nrm, a: width(zc) / 2, b: th / 2, n: 7 });
  }
  const g = loft(rings, { segs: D.skiSeg, seam: true, capStart: 0, capEnd: 0 });
  // uv: u = around (top centred at 0.25), v = along the length
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let k = 0; k < uv.count; k++) uv.setY(k, (p.getZ(k) + half) / (2 * half));
  g.translate(0, -DIM.ANKLE_H, DIM.SKI_MOUNT_Z);
  return g;
}

function makeSkiTexture(): THREE.Texture {
  if (typeof document === 'undefined') {
    const t = new THREE.DataTexture(new Uint8Array([30, 40, 60, 255]), 1, 1);
    t.needsUpdate = true;
    return t;
  }
  const W = 128;
  const H = 1024;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d') as CanvasRenderingContext2D;
  // v=0 (tail) at canvas bottom (flipY)
  const U = (u: number): number => u * W;
  // sidewalls
  g.fillStyle = '#b9bec6';
  g.fillRect(0, 0, W, H);
  // base: black p-tex with steel edges
  g.fillStyle = '#121316';
  g.fillRect(U(0.6), 0, U(0.3), H);
  g.fillStyle = '#8d939c';
  g.fillRect(U(0.585), 0, U(0.02), H);
  g.fillRect(U(0.895), 0, U(0.02), H);
  // topsheet
  const x0 = U(0.1);
  const x1 = U(0.4);
  const grad = g.createLinearGradient(0, H, 0, 0);
  grad.addColorStop(0, '#11151f');
  grad.addColorStop(0.45, '#1b2740');
  grad.addColorStop(0.7, '#11151f');
  grad.addColorStop(1, '#0e1118');
  g.fillStyle = grad;
  g.fillRect(x0, 0, x1 - x0, H);
  // bold chevrons near the tip
  g.fillStyle = '#ff7a1a';
  for (let k = 0; k < 3; k++) {
    const yy = H * (0.1 + k * 0.045);
    g.beginPath();
    g.moveTo(x0, yy + 22);
    g.lineTo((x0 + x1) / 2, yy);
    g.lineTo(x1, yy + 22);
    g.lineTo(x1, yy + 34);
    g.lineTo((x0 + x1) / 2, yy + 12);
    g.lineTo(x0, yy + 34);
    g.closePath();
    g.fill();
  }
  // tip colour block
  g.fillStyle = '#ff7a1a';
  g.fillRect(x0, 0, x1 - x0, H * 0.06);
  // edge pinstripes
  g.fillStyle = '#e9edf2';
  g.fillRect(x0 + 2, 0, 2, H);
  g.fillRect(x1 - 4, 0, 2, H);
  // wordmark running lengthwise
  g.save();
  g.translate((x0 + x1) / 2, H * 0.5);
  g.rotate(-Math.PI / 2);
  g.fillStyle = '#f2f4f7';
  g.font = 'bold 26px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('SKIFREE', 0, 0);
  g.restore();
  // tail protector
  g.fillStyle = '#2a2d33';
  g.fillRect(x0, H * 0.975, x1 - x0, H * 0.025);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function makeEnvTexture(): THREE.Texture {
  const W = 64;
  const H = 32;
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1); // 0 = top row
    const el = (0.5 - v) * Math.PI; // elevation
    let r: number;
    let gg: number;
    let b: number;
    if (el > 0) {
      const k = Math.pow(Math.sin(el), 0.6);
      r = lerp(235, 90, k);
      gg = lerp(242, 150, k);
      b = lerp(250, 230, k);
    } else {
      const k = Math.pow(-Math.sin(el), 0.5);
      r = lerp(225, 170, k);
      gg = lerp(230, 178, k);
      b = lerp(238, 190, k);
    }
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      // a bright "sun" lobe
      const sx = (x / W - 0.3) * 6;
      const sy = (v - 0.3) * 8;
      const sun = Math.exp(-(sx * sx + sy * sy)) * 60;
      data[o] = clamp(r + sun, 0, 255);
      data[o + 1] = clamp(gg + sun, 0, 255);
      data[o + 2] = clamp(b + sun * 0.8, 0, 255);
      data[o + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, W, H);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.flipY = true;
  t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------------------------------------
// poles

function buildPole(D: Detail): { grip: THREE.BufferGeometry; shaft: THREE.BufferGeometry } {
  const seg = D.poleSeg + 3;
  const gp = [
    [0.0, 0.098],
    [0.014, 0.1],
    [0.021, 0.092],
    [0.02, 0.07],
    [0.0165, 0.045],
    [0.018, 0.015],
    [0.0175, -0.02],
    [0.016, -0.05],
    [0.0135, -0.075],
    [0.0105, -0.082],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const grip = new THREE.LatheGeometry(gp, seg);
  const L = DIM.POLE_LEN;
  // basket (dish)
  const bp = [
    [0.008, -L + 0.095],
    [0.016, -L + 0.093],
    [0.046, -L + 0.084],
    [0.05, -L + 0.08],
    [0.046, -L + 0.078],
    [0.016, -L + 0.086],
    [0.008, -L + 0.086],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const basket = new THREE.LatheGeometry(D.cheap ? [bp[0], bp[3], bp[6]] : bp, Math.max(6, seg + 1));
  const tip = new THREE.ConeGeometry(0.0065, 0.03, Math.max(5, D.poleSeg));
  tip.rotateX(Math.PI);
  tip.translate(0, -L + 0.015, 0);
  const shaft = new THREE.CylinderGeometry(0.0095, 0.0065, L - 0.07, Math.max(5, D.poleSeg), 1, true);
  shaft.translate(0, -0.07 - (L - 0.07) / 2 + 0.0, 0);
  return { grip: mergeAll([grip, basket, tip]), shaft: mergeAll([shaft]) };
}

// ---------------------------------------------------------------------------------------------

function mergeAll(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const norm = parts.map((p) => {
    const g = p;
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    return normalizeAttrs(g);
  });
  const m = mergeGeometries(norm, false);
  if (!m) throw new Error('SkierModel: geometry merge failed');
  for (const p of parts) p.dispose();
  return m;
}

function mergeSkinned(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const m = mergeGeometries(parts, false);
  if (!m) throw new Error('SkierModel: skinned geometry merge failed');
  for (const p of parts) p.dispose();
  return m;
}

function triCount(g: THREE.BufferGeometry): number {
  return g.index ? g.index.count / 3 : g.getAttribute('position').count / 3;
}

function buildAll(q: QualityPreset): SkierGeometry {
  const D = DETAIL[q];
  CHEAP = !!D.cheap;
  const quilt = q !== 'low';
  const jacket = mergeSkinned([
    buildTorso(D, quilt),
    buildCollar(D),
    buildSleeve(D, 0, quilt),
    buildSleeve(D, 1, quilt),
  ]);
  const stripeRings = Math.max(3, Math.round(D.torsoRings * 0.1));
  const stripeD: Detail = { ...D, torsoRings: Math.round((stripeRings * 0.685) / 0.055), armRings: Math.round((stripeRings * 0.618) / 0.045) };
  const stripe = mergeSkinned([
    buildTorso(stripeD, quilt, 1.012, 0.265, 0.32, false),
    buildSleeve(stripeD, 0, quilt, 0.085, 0.13, 1.03, false),
    buildSleeve(stripeD, 1, quilt, 0.085, 0.13, 1.03, false),
  ]);
  const pants = mergeSkinned([buildPantsPelvis(D), buildLeg(D, 0), buildLeg(D, 1), buildPlacket(D, quilt)]);
  const gaiter = buildGaiter(D);

  const headFill = new THREE.SphereGeometry(1, D.sphereSeg + 2, D.sphereSeg);
  headFill.scale(0.08, 0.1, 0.095);
  headFill.translate(HC.x, HC.y - 0.005, HC.z);
  normalizeAttrs(headFill);

  const kneeFill = normalizeAttrs(new THREE.SphereGeometry(0.064, D.sphereSeg + 2, D.sphereSeg));
  const elbowFill = normalizeAttrs(new THREE.SphereGeometry(0.054, D.sphereSeg + 2, D.sphereSeg));

  const bootL = buildBootShell(D, 0);
  const bootR = buildBootShell(D, 1);
  const cuffL = buildBootCuff(D, 0);
  const cuffR = buildBootCuff(D, 1);
  const bind = buildBinding();
  const pole = buildPole(D);

  const geo: SkierGeometry = {
    jacket,
    stripe,
    pants,
    gaiter,
    headFill,
    helmet: buildHelmet(D),
    helmetDark: buildHelmetDark(D),
    goggleFrame: buildGoggleFrame(D),
    lens: buildLens(D),
    strap: buildStrap(D),
    kneeFill,
    elbowFill,
    glove: [buildGlove(D, 0), buildGlove(D, 1)],
    bootShell: [bootL.shell, bootR.shell],
    bootCuff: [cuffL.cuff, cuffR.cuff],
    bootMetal: [bootL.metal, bootR.metal],
    bootCuffMetal: [cuffL.metal, cuffR.metal],
    bootDark: buildBootDark(),
    binding: bind.body,
    bindingAccent: bind.accent,
    ski: buildSki(D),
    poleGrip: pole.grip,
    poleShaft: pole.shaft,
    skiTexture: makeSkiTexture(),
    envTexture: makeEnvTexture(),
    triangles: 0,
    all: [],
  };
  geo.all = [
    geo.jacket,
    geo.stripe,
    geo.pants,
    geo.gaiter,
    geo.headFill,
    geo.helmet,
    geo.helmetDark,
    geo.goggleFrame,
    geo.lens,
    geo.strap,
    geo.kneeFill,
    geo.elbowFill,
    ...geo.glove,
    ...geo.bootShell,
    ...geo.bootCuff,
    ...geo.bootMetal,
    ...geo.bootCuffMetal,
    geo.bootDark,
    geo.binding,
    geo.bindingAccent,
    geo.ski,
    geo.poleGrip,
    geo.poleShaft,
  ];
  // count rendered triangles: per-side and doubled parts
  const doubled = new Set<THREE.BufferGeometry>([geo.kneeFill, geo.elbowFill, geo.bootDark, geo.binding, geo.bindingAccent, geo.ski, geo.poleGrip, geo.poleShaft]);
  geo.triangles = geo.all.reduce((s, g) => s + triCount(g) * (doubled.has(g) ? 2 : 1), 0);
  return geo;
}

const cache = new Map<QualityPreset, { geo: SkierGeometry; refs: number }>();

export function acquireSkierGeometry(q: QualityPreset): SkierGeometry {
  let e = cache.get(q);
  if (!e) {
    e = { geo: buildAll(q), refs: 0 };
    cache.set(q, e);
  }
  e.refs++;
  return e.geo;
}

export function releaseSkierGeometry(q: QualityPreset): void {
  const e = cache.get(q);
  if (!e) return;
  e.refs--;
  if (e.refs <= 0) {
    for (const g of e.geo.all) g.dispose();
    e.geo.skiTexture.dispose();
    e.geo.envTexture.dispose();
    cache.delete(q);
  }
}
