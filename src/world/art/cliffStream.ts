/**
 * The cliff kit in the game (round 4 integration): streams authored cliff segments (./cliffKit.ts)
 * along the course for the location's scenery, time-sliced on the shared per-frame streaming budget
 * (World.update → scenery.pump → here). Bounded: segments outside the window are disposed, and at
 * most `maxSegments` exist. Deterministic: a segment's geometry depends only on the coast and its
 * index and LOD, never on the order of requests.
 *
 *  - only where the Mountain's cliffKitWeight is 1 (not at the headland ridges or the harbour);
 *  - LOD by distance from the skier (4/8/16 m columns), nearest builds first;
 *  - one material per water level (the wet band and the ice line need the arm's level).
 */
import * as THREE from 'three';
import type { Mountain } from '../course';
import type { CliffModel } from './cliffModel';
import { cliffSegmentSteps } from './cliffKit';
import { ROCK_ORIGIN, createRockMaterial, disposeRockMaterial } from './rockMaterial';
import { ATMOSPHERE_GLSL, addAtmosphereUniforms } from '../look/atmosphere';

/**
 * The surf line where the cliff meets the water (review P-M5): a ribbon on the water along the
 * face's actual (displaced) waterline, white wash fading out over 3–7 m, broken by moving noise.
 */
function foamMaterial(time: { value: number }): THREE.ShaderMaterial {
  const uniforms: Record<string, THREE.IUniform> = { uTime: time, uOrigin: ROCK_ORIGIN };
  addAtmosphereUniforms(uniforms);
  return new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
    vertexShader: /* glsl */ `
attribute float aOut;
varying float vOut;
varying vec3 vW;
void main() {
  vOut = aOut;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: /* glsl */ `
uniform float uTime;
uniform vec3 uOrigin;
varying float vOut;
varying vec3 vW;
${ATMOSPHERE_GLSL}
float fm_h(vec2 i) { i = mod(i, 256.0); return fract(sin(dot(i, vec2(12.9898, 78.233))) * 43758.5453); }
float fm_n(vec2 q) { vec2 i = floor(q), f = fract(q); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(fm_h(i), fm_h(i + vec2(1, 0)), u.x), mix(fm_h(i + vec2(0, 1)), fm_h(i + vec2(1, 1)), u.x), u.y); }
void main() {
  vec3 P = vW + uOrigin;
  // the wash surges in and out along the wall; lace breaks up its outer part
  float surge = 0.5 + 0.5 * sin(uTime * 0.9 + P.z * 0.045 + 2.0 * fm_n(P.xz * 0.05));
  float reach = 0.45 + 0.55 * surge;
  float lace = fm_n(P.xz * vec2(0.55, 0.3) + vec2(uTime * 0.25, uTime * 0.1)) * 0.6 + fm_n(P.xz * 1.7 - uTime * 0.3) * 0.4;
  float a = (1.0 - smoothstep(0.0, reach, vOut)) * smoothstep(0.25 + 0.5 * vOut, 0.75, lace + 0.35 * (1.0 - vOut));
  a = max(a, 1.0 - smoothstep(0.0, 0.12, vOut)); // a solid white rim against the rock
  gl_FragColor = vec4(vec3(0.86, 0.92, 0.96), a * 0.85);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor.rgb = sf_atmosphere(gl_FragColor.rgb, vW);
}`,
    fog: false,
  });
}

function foamGeometry(foam: Float32Array, water: number): THREE.BufferGeometry | null {
  const pos: number[] = [];
  const out: number[] = [];
  const idx: number[] = [];
  const n = foam.length / 2;
  let prev = -1;
  for (let j = 0; j < n; j++) {
    const x = foam[j * 2]!;
    const z = foam[j * 2 + 1]!;
    if (!Number.isFinite(x)) {
      prev = -1;
      continue;
    }
    const w = 4.5 + 2.5 * Math.sin(z * 0.071) * Math.sin(z * 0.023 + 1.3);
    const base = pos.length / 3;
    pos.push(x + 1.2, water + 0.06, z, x - w, water + 0.06, z);
    out.push(0, 1);
    if (prev >= 0) idx.push(prev, base, prev + 1, prev + 1, base, base + 1);
    prev = base;
  }
  if (!idx.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aOut', new THREE.Float32BufferAttribute(out, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

export const CLIFF_SEG = 256;
/** LOD by distance from the skier (m): < LOD_NEAR → 0, < LOD_MID → 1, else 2 */
const LOD_NEAR = 520;
const LOD_MID = 1400;
const LOD_DS = [4, 8, 16] as const;
const LOD_DR = [3, 6, 12] as const;

interface Seg {
  mesh: THREE.Mesh;
  lod: number;
}
interface Job {
  i: number;
  lod: number;
  z0: number;
  z1: number;
  dist: number;
  gen: Generator<void, THREE.BufferGeometry, void>;
}

export class CliffStream {
  readonly group = new THREE.Group();
  private model: CliffModel;
  private segs = new Map<number, Seg>();
  private jobs: Job[] = [];
  private mats = new Map<number, THREE.MeshStandardMaterial>();
  private time = { value: 0 };
  private foamMat: THREE.ShaderMaterial | null = null;
  private deadline = Infinity;
  private readonly over = () => performance.now() > this.deadline;

  constructor(
    private m: Mountain,
    private quality: string,
    readonly maxSegments = 24,
  ) {
    if (!m.cliff) throw new Error('CliffStream needs a mountain with the cliff kit');
    this.model = m.cliff;
    this.group.name = 'cliff-kit';
  }

  /** the z-range of segment i where the kit fully applies (null: none) */
  private span(i: number): [number, number] | null {
    const za = i * CLIFF_SEG;
    let a = Infinity;
    let b = -Infinity;
    for (let z = za; z <= za + CLIFF_SEG; z += 8) {
      if (this.m.cliffKitWeight(z) >= 0.999) {
        a = Math.min(a, z);
        b = Math.max(b, z);
      }
    }
    if (!(b - a >= 24)) return null;
    return [a, b];
  }

  private material(water: number): THREE.MeshStandardMaterial {
    const key = Math.round(water * 10) / 10;
    let mt = this.mats.get(key);
    if (!mt) {
      mt = createRockMaterial({ kind: 'gneiss', vertexColors: true, water: key, snow: 1, strata: 1, tint: 0xc2cad4, hq: this.quality !== 'low', snowFrom: 0.7 });
      this.mats.set(key, mt);
    }
    return mt;
  }

  /** Want the segments covering [z0, z1] at the LOD for a skier at (fx, fz); queue what is missing. */
  want(z0: number, z1: number, fx: number, fz: number): void {
    const i0 = Math.floor(z0 / CLIFF_SEG);
    const i1 = Math.floor(z1 / CLIFF_SEG);
    for (const [i, s] of this.segs) {
      if (i >= i0 && i <= i1) continue;
      this.dropFoam(s.mesh);
      s.mesh.geometry.dispose();
      s.mesh.removeFromParent();
      this.segs.delete(i);
    }
    this.jobs = this.jobs.filter((j) => {
      if (j.i >= i0 && j.i <= i1) return true;
      j.gen.return(undefined as never);
      return false;
    });
    for (let i = i0; i <= i1; i++) {
      const sp = this.span(i);
      if (!sp) continue;
      const zm = (sp[0] + sp[1]) / 2;
      const c = this.model.column(zm);
      const dist = Math.hypot(c.xr - fx, zm - fz);
      const lod = dist < LOD_NEAR ? 0 : dist < LOD_MID ? 1 : 2;
      const cur = this.segs.get(i);
      const queued = this.jobs.find((j) => j.i === i);
      if (cur && cur.lod === lod) {
        if (queued) {
          queued.gen.return(undefined as never);
          this.jobs.splice(this.jobs.indexOf(queued), 1);
        }
        continue;
      }
      if (queued) {
        queued.dist = dist;
        if (queued.lod === lod) continue;
        queued.gen.return(undefined as never);
        this.jobs.splice(this.jobs.indexOf(queued), 1);
      }
      if (!cur && this.segs.size + this.jobs.length >= this.maxSegments) continue;
      this.jobs.push({ i, lod, z0: sp[0], z1: sp[1], dist, gen: cliffSegmentSteps(this.model, { z0: sp[0], z1: sp[1], ds: LOD_DS[lod], dr: LOD_DR[lod] }, this.over) });
    }
    // missing segments first (a coarse one already standing is better than a hole), nearest first
    this.jobs.sort((a, b) => Number(this.segs.has(a.i)) - Number(this.segs.has(b.i)) || a.dist - b.dist);
  }

  /** Advance the queued builds until `deadlineMs` (performance.now() value). */
  pump(deadlineMs: number): void {
    this.deadline = deadlineMs;
    while (this.jobs.length && performance.now() < deadlineMs) {
      const j = this.jobs[0]!;
      const r = j.gen.next();
      if (!r.done) continue;
      this.jobs.shift();
      this.install(j, r.value);
    }
    this.deadline = Infinity;
  }

  /** finish every queued build now */
  flush(): void {
    this.pump(Infinity);
  }

  private install(j: Job, geo: THREE.BufferGeometry) {
    const water = this.model.column((j.z0 + j.z1) / 2).water;
    const cur = this.segs.get(j.i);
    const foam = geo.userData['foam'] as Float32Array | undefined;
    const fg = foam ? foamGeometry(foam, water) : null;
    if (cur) {
      this.dropFoam(cur.mesh);
      cur.mesh.geometry.dispose();
      cur.mesh.geometry = geo;
      cur.mesh.material = this.material(water);
      cur.lod = j.lod;
      this.addFoam(cur.mesh, fg);
      return;
    }
    const mesh = new THREE.Mesh(geo, this.material(water));
    this.addFoam(mesh, fg);
    mesh.castShadow = this.quality !== 'low';
    mesh.receiveShadow = true;
    mesh.name = `cliff-seg-${j.i}`;
    mesh.userData['lod'] = j.lod;
    this.group.add(mesh);
    this.segs.set(j.i, { mesh, lod: j.lod });
  }

  private addFoam(seg: THREE.Mesh, g: THREE.BufferGeometry | null) {
    if (!g) return;
    this.foamMat ??= foamMaterial(this.time);
    const f = new THREE.Mesh(g, this.foamMat);
    f.name = 'cliff-foam';
    f.renderOrder = 2; // after the water (renderOrder 1)
    seg.add(f);
  }

  private dropFoam(seg: THREE.Mesh) {
    for (const ch of [...seg.children]) {
      if (ch instanceof THREE.Mesh && ch.name === 'cliff-foam') {
        ch.geometry.dispose();
        ch.removeFromParent();
      }
    }
  }

  /** animate the surf */
  update(time: number): void {
    this.time.value = time;
  }

  get pending(): number {
    return this.jobs.length;
  }
  get segments(): number {
    return this.segs.size;
  }
  get triangles(): number {
    let t = 0;
    for (const s of this.segs.values()) t += (s.mesh.geometry.index?.count ?? 0) / 3;
    return t;
  }
  /** (tests) the meshes standing now */
  meshes(): THREE.Mesh[] {
    return [...this.segs.values()].map((s) => s.mesh);
  }

  /** Floating origin: the rock material samples world space (its textures are anchored to the world). */
  setOrigin(origin: THREE.Vector3): void {
    ROCK_ORIGIN.value.copy(origin);
  }

  dispose(): void {
    for (const j of this.jobs) j.gen.return(undefined as never);
    this.jobs.length = 0;
    for (const s of this.segs.values()) {
      this.dropFoam(s.mesh);
      s.mesh.geometry.dispose();
    }
    this.segs.clear();
    this.foamMat?.dispose();
    for (const mt of this.mats.values()) disposeRockMaterial(mt);
    this.mats.clear();
    this.group.removeFromParent();
  }
}
