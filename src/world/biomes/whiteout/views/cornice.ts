/**
 * Whiteout Ridge: the corniced rim of the ridge (terrain.ridge, drop side).
 *
 * An authored swept mesh along `Mountain.ridgeRimX(z)`: the bank rises to a wind-built crest and
 * curls out over the flank in an overhanging lip (the cornice), with a shaded blue-grey underside.
 * The inner edge is buried in the snow and the crest follows the terrain under it, so it never floats;
 * past the rim the lip hangs over the flank like a real cornice (the terrain falls away beneath it).
 * Its size varies along the ridge and it breaks off in places (wind-scoured, a rock band instead).
 *
 * Physics: the mesh is visual. The ridge's out-of-bounds rule (capabilities/environment.ts,
 * RIDGE_GUARD) returns a skier who goes over the rim, and the cue is this edge plus a line of
 * black-and-yellow rim wands set back from it (how real ski areas mark a cliff), so the edge is never
 * hidden: the wands stand out in fog and the lip's dark underside shows where the snow ends.
 */
import * as THREE from 'three';
import { clamp, fbm, hash2, smoothstep } from '../../../../core/rng';
import type { Mountain } from '../../../course';

export const CORNICE = {
  /** sample spacing along the rim (m) */
  step: 3,
  /** crest height above the bank (m), min/max */
  height: [0.9, 2.3] as const,
  /** overhang beyond the rim (m), min/max */
  overhang: [1.8, 4.8] as const,
  /** rim wands: spacing (m) and how far in from the rim they stand (m) */
  wandStep: 36,
  wandIn: 6,
  wandH: 1.9,
} as const;

export interface CorniceSample {
  /** rim point */
  x: number;
  y: number;
  z: number;
  /** 0 = no cornice here (a break), 1 = full */
  k: number;
  h: number;
  ov: number;
}

/** the ridge's drop side (+1/−1), or 0 without a ridge */
export function dropSide(m: Mountain): number {
  return m.biome.terrain.ridge?.dropSide ?? 0;
}

/** cornice samples in [z0, z1) (pure; tests check they sit on the terrain and stay off the piste) */
export function corniceSamples(m: Mountain, z0: number, z1: number): CorniceSample[] {
  const out: CorniceSample[] = [];
  if (!dropSide(m)) return out;
  const end = Number.isFinite(m.finishZ) ? m.finishZ - 260 : Infinity;
  const s = m.seed;
  for (let z = Math.ceil(z0 / CORNICE.step) * CORNICE.step; z < z1; z += CORNICE.step) {
    if (z < 40 || z > end) continue;
    const x = m.ridgeRimX(z);
    // breaks: wind-scoured stretches and rock bands (soft edges)
    const n = 0.5 + 0.5 * fbm(z / 180, 2.3, s + 61, 2);
    let k = smoothstep(0.36, 0.46, n);
    // none where a cave's rock or the start/finish structures are near the rim
    for (const c of m.cavesNear(z - 140, z + 140)) if (Math.abs(z - c.z) < 140 && Math.sign(c.side) === dropSide(m)) k = 0;
    k *= smoothstep(40, 90, z) * (1 - smoothstep(end - 60, end, z));
    const v = 0.5 + 0.5 * fbm(z / 40, 7.1, s + 62, 2);
    const h = CORNICE.height[0] + (CORNICE.height[1] - CORNICE.height[0]) * v;
    const ov = CORNICE.overhang[0] + (CORNICE.overhang[1] - CORNICE.overhang[0]) * clamp(v * 1.1 + 0.15 * (hash2(Math.round(z), 3, s) - 0.5), 0, 1);
    out.push({ x, y: m.heightAt(x, z), z, k, h, ov });
  }
  return out;
}

/** wand spots: every CORNICE.wandStep m, CORNICE.wandIn m inside the rim */
export function wandSpots(m: Mountain, z0: number, z1: number): { x: number; y: number; z: number }[] {
  const out: { x: number; y: number; z: number }[] = [];
  const side = dropSide(m);
  if (!side) return out;
  const end = Number.isFinite(m.finishZ) ? m.finishZ - 200 : Infinity;
  for (let z = Math.ceil(z0 / CORNICE.wandStep) * CORNICE.wandStep; z < z1 && z < end; z += CORNICE.wandStep) {
    if (z < 60) continue;
    const x = m.ridgeRimX(z) - side * CORNICE.wandIn;
    out.push({ x, y: m.heightAt(x, z), z });
  }
  return out;
}

/**
 * The cornice mesh for samples (one strip per unbroken run). Profile across the rim (u outward from
 * the rim, metres; heights): the bank rising from under the snow (u = −10) to the crest at u ≈ 0,
 * the lip curling out to u = ov, and the underside tucking back into the flank below the rim.
 */
export function buildCorniceGeometry(m: Mountain, samples: CorniceSample[]): THREE.BufferGeometry | null {
  const side = dropSide(m);
  if (!side || samples.length < 2) return null;
  // (u, dv, shade): dv relative to the terrain for u ≤ 0, to the rim height beyond it
  const P: [number, number, number][] = [
    [-10, -0.45, 1],
    [-6.5, 0.18, 1],
    [-3.5, 0.62, 1],
    [-1.2, 0.92, 1],
    [0.0, 1.0, 1],
    [0.55, 0.93, 0.96], // the crest rolls over
    [0.9, 0.62, 0.86], // the lip's face
    [0.82, 0.3, 0.74], // the curl
    [0.55, -0.15, 0.66], // underside
    [0.2, -0.75, 0.62],
  ];
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const top = new THREE.Color(0.95, 0.97, 1.0);
  const under = new THREE.Color(0.58, 0.67, 0.8);
  const c = new THREE.Color();
  let run = -1;
  let prevOk = false;
  for (let i = 0; i < samples.length; i++) {
    const S = samples[i]!;
    const ok = S.k > 0.02;
    if (!ok) {
      prevOk = false;
      continue;
    }
    const base = pos.length / 3;
    for (const [u0, dv, sh] of P) {
      // the lip tapers to nothing at the ends of a run (k)
      const u = u0 <= 0 ? u0 : u0 * S.ov * S.k;
      const x = S.x + side * u;
      let y: number;
      if (u0 <= 0) y = m.heightAt(x, S.z) + dv * S.h * (u0 < -9 ? 1 : S.k);
      else y = S.y + dv * S.h * S.k;
      // never above the crest line nor through the flank where the lip tucks under
      if (u0 > 0 && dv < 0) y = Math.min(y, m.heightAt(x, S.z) - 0.25);
      pos.push(x, y, S.z);
      c.copy(under).lerp(top, sh * sh);
      col.push(c.r, c.g, c.b);
    }
    if (prevOk && run >= 0) {
      const a = base - P.length;
      for (let j = 0; j < P.length - 1; j++) {
        const p0 = a + j, p1 = a + j + 1, q0 = base + j, q1 = base + j + 1;
        if (side > 0) idx.push(p0, q0, p1, p1, q0, q1);
        else idx.push(p0, p1, q0, p1, q1, q0);
      }
    }
    run = base;
    prevOk = true;
  }
  if (!idx.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  // wind-packed snow for the terrain shader (the cornice is drawn with the terrain's own snow material:
  // with a plain lit material it read as pale styrofoam slabs beside the snow it grows out of)
  const surf = new Float32Array(pos.length);
  for (let i = 0; i < pos.length / 3; i++) surf[i * 3 + 1] = 0.6;
  g.setAttribute('aSurf', new THREE.BufferAttribute(surf, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

let corniceMat: THREE.MeshStandardMaterial | null = null;
export function corniceMaterial(): THREE.MeshStandardMaterial {
  if (!corniceMat) corniceMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  return corniceMat;
}

let wandGeo: THREE.BufferGeometry | null = null;
/** a bamboo-style rim wand: yellow with black bands, a small red flag */
export function wandGeometry(): THREE.BufferGeometry {
  if (wandGeo) return wandGeo;
  const g = new THREE.CylinderGeometry(0.03, 0.04, CORNICE.wandH, 5, 6);
  g.translate(0, CORNICE.wandH / 2, 0);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const col: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const band = Math.floor((pos.getY(i) / CORNICE.wandH) * 6) % 2 === 0;
    if (band) col.push(0.98, 0.78, 0.05);
    else col.push(0.05, 0.05, 0.05);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  wandGeo = g;
  return g;
}
