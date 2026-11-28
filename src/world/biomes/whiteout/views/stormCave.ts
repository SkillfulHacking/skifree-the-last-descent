/**
 * Whiteout Ridge: the storm-beaten Yeti cave ("whiteout-storm-cave").
 *
 * The shared cave geometry, grounding and cinematic are untouched (presentation contract,
 * presentation/cave.ts). What Whiteout adds:
 *  - the rock: dark frost-shattered granite, feathery rime grown out toward the wind on the faces
 *    around the mouth, a glaze of clear ice and frozen drips on the steep faces (the cave rock
 *    material's `uRime`, no loose meshes that could float);
 *  - snow spilling off the brow in thin sheets, blown sideways (a particle curtain along the brow);
 *  - spindrift skating across the mouth at boot height;
 *  - (round 2, W-044: round 1 read as Alpine's cave re-tinted) the storm's own architecture over the
 *    mouth — a wind cornice curling over the brow (a lip of wind-packed snow overhanging the mouth),
 *    hoar-rime feathers grown off its underside into the wind, a drift banked against the windward
 *    jamb, and a sheet of spindrift pouring off the cornice in the wind; all presentation, built
 *    against the cave's own anchor points (no collision, no shared geometry touched);
 *  - in the encounter: a squall rolls in as the Yeti stirs — the light flattens, the snow thickens and
 *    the wind tears across the mouth as he emerges (7.9 s), his roar (11.05 s) blasts a cloud of snow
 *    off the brow, and after the leap the squall moves off and the weather is handed back to the
 *    model over 7 s (World.releaseWeather), so the chase starts in whatever the front is doing.
 */
import * as THREE from 'three';
import { CAVE_LEAP_AT } from '../../../../cinematic/caveHandoff';
import type { CaveCinematicContext, CaveCinematicExtras, CaveDressing, CaveDressingContext } from '../../../presentation/cave';
import { makeFlakeTexture } from '../../../Environment';
import { smoothstep } from '../../../../core/rng';

export const STORM_CAVE = {
  /** brow curtain grains, mouth spindrift grains */
  curtain: 420,
  skate: 300,
  /** the wind cornice over the mouth: length along the brow, overhang, thickness (m) */
  cornice: { len: 15, overhang: 1.6, thick: 0.9 },
  /** the squall in the encounter: ramps in (s), peak weather */
  squall: { t0: 5.2, t1: 9.0, lullT: [12.2, 14.4] as const, lull: 0.7, end: 17.2, release: 7, visibility: 5.2, snowfall: 2.0, storm: 0.62, wind: 9.5 },
  roar: 11.05,
} as const;

interface Grain {
  p: THREE.Vector3;
  v: THREE.Vector3;
  life: number;
  age: number;
}

/** small CPU particle cloud (a few hundred grains), recycled by `spawn` */
/** deterministic grain RNG (identical captures) */
let rs = 0x2f6e2b1;
const rnd = () => {
  rs = (rs * 1664525 + 1013904223) >>> 0;
  return rs / 4294967296;
};

class Grains {
  readonly points: THREE.Points;
  private g: Grain[] = [];
  private pos: Float32Array;
  private mat: THREE.PointsMaterial;
  constructor(
    n: number,
    size: number,
    private spawn: (out: Grain, burst: boolean) => void,
  ) {
    this.pos = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.PointsMaterial({ size, map: makeFlakeTexture(), transparent: true, opacity: 0.85, depthWrite: false, color: 0xf4f8ff, sizeAttenuation: true });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    for (let i = 0; i < n; i++) {
      const gr: Grain = { p: new THREE.Vector3(), v: new THREE.Vector3(), life: 1, age: 0 };
      spawn(gr, false);
      gr.age = rnd() * gr.life;
      this.g.push(gr);
    }
  }
  /** intensity scales how many grains show (the rest are parked out of sight) */
  update(dt: number, intensity: number, burst = 0) {
    const n = this.g.length;
    const show = Math.floor(n * Math.min(1, intensity));
    for (let i = 0; i < n; i++) {
      const gr = this.g[i]!;
      gr.age += dt;
      if (gr.age >= gr.life || (burst > 0 && i < n * burst && gr.age > 0.1)) {
        this.spawn(gr, burst > 0 && i < n * burst);
        gr.age = 0;
      }
      gr.p.addScaledVector(gr.v, dt);
      // (round 3, R2 D N-4) written in place: no array per grain per frame
      const P = this.pos;
      if (i < show) {
        P[i * 3] = gr.p.x;
        P[i * 3 + 1] = gr.p.y;
        P[i * 3 + 2] = gr.p.z;
      } else {
        P[i * 3] = 0;
        P[i * 3 + 1] = -1e5;
        P[i * 3 + 2] = 0;
      }
    }
    (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }
  dispose() {
    this.points.geometry.dispose();
    this.mat.map?.dispose();
    this.mat.dispose();
  }
}

export function dressStormCave(ctx: CaveDressingContext): CaveDressing {
  const g = dressStormCaveSteps(ctx);
  for (;;) {
    const r = g.next();
    if (r.done) return r.value;
  }
}

/** the dressing in slices (CavePresentation.dressSteps): World yields a frame at each pause */
export function* dressStormCaveSteps(ctx: CaveDressingContext): Generator<void, CaveDressing, void> {
  rs = 0x2f6e2b1 ^ Math.round(ctx.anchor.z);
  const cave = ctx.cave;
  const group = new THREE.Group();
  group.name = 'whiteout-storm-cave';
  // rime on the shared rock (material uniform; geometry untouched)
  const rock = cave.group.getObjectByName('cave-rock') as THREE.Mesh | undefined;
  const U = (rock?.material as THREE.Material | undefined)?.userData?.caveUniforms as { uRime: { value: number }; uRimeDir: { value: THREE.Vector3 } } | undefined;
  if (U) {
    U.uRime.value = 1;
    // the faces looking out over the piste and up into the weather carry the rime
    U.uRimeDir.value.copy(cave.outward).setY(0.35).normalize();
  }
  const O = cave.outward.clone();
  const brow = cave.lipTop.clone();
  const mouth = cave.mouth.clone();
  let wind = 4;
  // brow curtain: snow sloughing off the brow, falling in sheets past the mouth
  const curtain = new Grains(STORM_CAVE.curtain, 0.22, (gr, burst) => {
    gr.p.set(brow.x + O.x * (0.2 + rnd() * 0.8), brow.y - 0.2 - rnd() * 0.4, brow.z + (rnd() - 0.5) * 11);
    gr.v.set(O.x * (0.4 + rnd() * (burst ? 7 : 0.8)), burst ? 1.5 + rnd() * 3.5 : -(1.6 + rnd() * 1.6), (rnd() - 0.5) * 0.6 + wind * 0.35);
    gr.life = burst ? 2.6 : 2.4 + rnd() * 1.6;
  });
  // spindrift skating across the mouth at boot height
  const skate = new Grains(STORM_CAVE.skate, 0.1, (gr) => {
    const v = (rnd() - 0.5) * 18;
    gr.p.set(mouth.x + O.x * (1.5 + rnd() * 7), mouth.y + 0.1 + rnd() * 1.2, mouth.z + v - 9);
    gr.v.set(O.x * (rnd() - 0.5) * 1.5, (rnd() - 0.3) * 0.5, 4 + wind * (0.7 + rnd() * 0.6));
    gr.life = 2 + rnd() * 1.5;
  });
  group.add(curtain.points, skate.points);
  // (round 5, review D4-5) World.disposeCave abandons a half-built dressing (job.return): what was built
  // so far is released here, as Fjord's dressSeaCaveSteps does
  let built!: StormArchitecture;
  let done = false;
  try {
    yield;
    built = yield* buildStormArchitectureSteps(cave.lipTop, cave.mouth, O, rock ?? null);
    done = true;
  } finally {
    if (!done) {
      if (U) U.uRime.value = 0;
      curtain.dispose();
      skate.dispose();
    }
  }
  group.add(built.group);
  let burst = 0;
  const dressing: CaveDressing & { setWind(w: number): void; roar(): void } = {
    group,
    update(dt) {
      const d = Math.min(dt, 0.1);
      built.update(d, wind);
      curtain.update(d, 0.35 + 0.65 * smoothstep(3, 10, wind), burst);
      skate.update(d, 0.25 + 0.75 * smoothstep(3, 10, wind));
      burst = Math.max(0, burst - d * 2.5);
    },
    setWind(w) {
      wind = w;
    },
    roar() {
      burst = 0.9;
    },
    dispose() {
      if (U) U.uRime.value = 0;
      curtain.dispose();
      skate.dispose();
      built.dispose();
    },
  };
  return dressing;
}

/** the encounter's squall (layered on the shared cinematic: no shot changes) */
export function stormCaveCinematic(c: CaveCinematicContext): CaveCinematicExtras {
  const st = c.st;
  const S = STORM_CAVE.squall;
  const world = st.world;
  const base = { ...world.weather };
  const dressing = [...world.caveDressings()].find((d) => (d as { setWind?: unknown }).setWind) as ({ setWind(w: number): void; roar(): void } & CaveDressing) | undefined;
  let roared = false;
  let squalled = false;
  let released = false;
  const dir = Math.sign(base.windX || 1);
  // the squall peaks through the emergence and the roar, then the gust blows through so the leap
  // (past the skier's shoulder) reads — at full squall the Yeti vanished (dev8 15)
  const squallAt = (t: number) => smoothstep(S.t0, S.t1, t) * (1 - S.lull * smoothstep(S.lullT[0], S.lullT[1], t));
  const overrideAt = (k: number) => {
    const vT = Math.max(base.visibility, S.visibility);
    const sfT = Math.max(base.snowfall, S.snowfall);
    const stT = Math.max(base.storm ?? 0, S.storm);
    const wT = Math.max(Math.abs(base.windX), S.wind);
    return {
      visibility: base.visibility + (vT - base.visibility) * k,
      snowfall: base.snowfall + (sfT - base.snowfall) * k,
      storm: (base.storm ?? 0) + (stT - (base.storm ?? 0)) * k,
      windX: base.windX + (dir * wT - base.windX) * k,
    };
  };
  return {
    update(_dt, t) {
      if (released) return;
      const k = squallAt(t);
      // (round 2, C-8) the squall only ever thickens the weather: an encounter that begins inside a
      // front keeps its storm (round 1 blended toward fixed values, so it cleared)
      const vT = Math.max(base.visibility, S.visibility);
      const sfT = Math.max(base.snowfall, S.snowfall);
      const stT = Math.max(base.storm ?? 0, S.storm);
      const wT = Math.max(Math.abs(base.windX), S.wind);
      world.weatherOverride = {
        visibility: base.visibility + (vT - base.visibility) * k,
        snowfall: base.snowfall + (sfT - base.snowfall) * k,
        storm: (base.storm ?? 0) + (stT - (base.storm ?? 0)) * k,
        windX: base.windX + (dir * wT - base.windX) * k,
      };
      dressing?.setWind(Math.abs(base.windX) + (wT - Math.abs(base.windX)) * k);
      if (!squalled && t >= S.t0) {
        squalled = true;
        // (W-044) heard: the squall comes howling over the brow
        st.audio.playCue('blizzard-build', c.cave.lipTop.clone().addScaledVector(c.cave.outward, 4));
      }
      if (!roared && t >= STORM_CAVE.roar) {
        roared = true;
        dressing?.roar();
      }
      if (t >= S.end) {
        released = true;
        world.releaseWeather(S.release);
      }
    },
    dispose() {
      // (W-076 review B, B2) the chase opens in the same weather watched or skipped at any moment: the
      // hand-back always starts from the squall as it stands at the hand-off (CAVE_LEAP_AT), not from
      // wherever the cinematic was left
      if (!released) {
        world.weatherOverride = overrideAt(squallAt(Math.min(S.end, CAVE_LEAP_AT)));
        world.releaseWeather(S.release);
      }
    },
  };
}

/**
 * (round 2, W-044) The storm's architecture over the mouth: a wind cornice curling over the brow,
 * rime feathers off its underside pointing into the wind, a drift banked against the windward jamb,
 * and a sheet of spindrift pouring off the cornice edge. Presentation only (no collision); everything
 * hangs off the cave's own anchors: `lip` (top of the brow), `mouth` (the entrance, at ground level),
 * `out` (the outward normal).
 */
/**
 * The rock's triangles (world space) whose bounds touch the band the cornice columns' rays sweep:
 * within `halfLen` along the brow of `lip`, 0–16 m out from it, ±1.5 m of height `y`.
 */
export function browTriangles(rock: THREE.Mesh, lip: THREE.Vector3, along: THREE.Vector3, out: THREE.Vector3, y: number, halfLen: number): Float32Array {
  const g = rock.geometry;
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const idx = g.getIndex();
  const e = rock.matrixWorld.elements;
  // every vertex once: world position, and its place along the brow / out from it
  const nv = pos.count;
  const W = new Float32Array(nv * 3);
  const A = new Float32Array(nv);
  const O = new Float32Array(nv);
  for (let i = 0; i < nv; i++) {
    const x = pos.getX(i), yy = pos.getY(i), z = pos.getZ(i);
    const wx = e[0]! * x + e[4]! * yy + e[8]! * z + e[12]!;
    const wy = e[1]! * x + e[5]! * yy + e[9]! * z + e[13]!;
    const wz = e[2]! * x + e[6]! * yy + e[10]! * z + e[14]!;
    W[i * 3] = wx;
    W[i * 3 + 1] = wy;
    W[i * 3 + 2] = wz;
    const dx = wx - lip.x, dy = wy - lip.y, dz = wz - lip.z;
    A[i] = dx * along.x + dy * along.y + dz * along.z;
    O[i] = dx * out.x + dy * out.y + dz * out.z;
  }
  const n = idx ? idx.count / 3 : nv / 3;
  const res: number[] = [];
  for (let t = 0; t < n; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3;
    const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    if (Math.max(A[i0]!, A[i1]!, A[i2]!) < -halfLen || Math.min(A[i0]!, A[i1]!, A[i2]!) > halfLen) continue;
    if (Math.max(O[i0]!, O[i1]!, O[i2]!) < -10 || Math.min(O[i0]!, O[i1]!, O[i2]!) > 10) continue;
    const y0 = W[i0 * 3 + 1]!, y1 = W[i1 * 3 + 1]!, y2 = W[i2 * 3 + 1]!;
    if (Math.max(y0, y1, y2) < y - 1.5 || Math.min(y0, y1, y2) > y + 1.5) continue;
    for (const k of [i0, i1, i2]) res.push(W[k * 3]!, W[k * 3 + 1]!, W[k * 3 + 2]!);
  }
  return new Float32Array(res);
}

/**
 * The cornice's root points: column i at `a = (i/nu − 0.5)·len` along the brow. A column whose ray
 * misses takes its own position along the brow at the depth of the nearest hit column (before or
 * after it); with no hit at all, the lip line itself.
 */
export function corniceRoots(nu: number, len: number, lip: THREE.Vector3, along: THREE.Vector3, rootAt: (a: number) => THREE.Vector3 | null): THREE.Vector3[] {
  const base: THREE.Vector3[] = [];
  const hits: Array<THREE.Vector3 | null> = [];
  for (let i = 0; i <= nu; i++) {
    const a = (i / nu - 0.5) * len;
    base.push(lip.clone().addScaledVector(along, a));
    hits.push(rootAt(a));
  }
  return hits.map((h, i) => {
    if (h) return h;
    let best = -1;
    for (let d = 1; d <= nu && best < 0; d++) {
      if (i - d >= 0 && hits[i - d]) best = i - d;
      else if (i + d <= nu && hits[i + d]) best = i + d;
    }
    if (best < 0) return base[i]!.clone();
    const depth = hits[best]!.clone().sub(base[best]!);
    // the hit's offset from its own brow point, applied at this column's brow point
    return base[i]!.clone().add(depth.sub(along.clone().multiplyScalar(depth.dot(along))));
  });
}

/** nearest hit distance (≤ far) of a ray against a flat triangle list, or null (Möller–Trumbore) */
export function rayTris(o: THREE.Vector3, dir: THREE.Vector3, tris: Float32Array, far: number): number | null {
  let best: number | null = null;
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Vector3(), s0 = new THREE.Vector3(), a = new THREE.Vector3();
  for (let i = 0; i < tris.length; i += 9) {
    a.set(tris[i]!, tris[i + 1]!, tris[i + 2]!);
    e1.set(tris[i + 3]! - a.x, tris[i + 4]! - a.y, tris[i + 5]! - a.z);
    e2.set(tris[i + 6]! - a.x, tris[i + 7]! - a.y, tris[i + 8]! - a.z);
    p.crossVectors(dir, e2);
    const det = e1.dot(p);
    if (Math.abs(det) < 1e-9) continue;
    const inv = 1 / det;
    s0.subVectors(o, a);
    const u = s0.dot(p) * inv;
    if (u < 0 || u > 1) continue;
    q.crossVectors(s0, e1);
    const w = dir.dot(q) * inv;
    if (w < 0 || u + w > 1) continue;
    const t = e2.dot(q) * inv;
    if (t > 0 && t <= far && (best === null || t < best)) best = t;
  }
  return best;
}

/** (round 4, W-086 / review D3-1) the architecture built in slices: a pause after the brow's triangles are
 * gathered, after the roots, the cornice, the feathers and the bank (round 3: one ~22 ms frame) */
interface StormArchitecture {
  group: THREE.Group;
  update(dt: number, wind: number): void;
  dispose(): void;
}

function* buildStormArchitectureSteps(lip: THREE.Vector3, mouth: THREE.Vector3, out: THREE.Vector3, rock: THREE.Mesh | null): Generator<void, StormArchitecture, void> {
  const disposables: Array<{ dispose(): void }> = [];
  let done = false;
  try {
    const a = yield* buildStormArchitecture(lip, mouth, out, rock, disposables);
    done = true;
    return a;
  } finally {
    // (round 5, review D4-5) abandoned mid-build: release every material, geometry and texture made so far
    if (!done) for (const d of disposables) d.dispose();
  }
}

function* buildStormArchitecture(lip: THREE.Vector3, mouth: THREE.Vector3, out: THREE.Vector3, rock: THREE.Mesh | null, disposables: Array<{ dispose(): void }>): Generator<void, StormArchitecture, void> {
  const C = STORM_CAVE.cornice;
  const group = new THREE.Group();
  group.name = 'storm-cave-architecture';
  // every mesh's geometry under the group, whenever it was added (an abandoned build included)
  disposables.push({ dispose: () => group.traverse((o) => (o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry.dispose()) });
  const along = new THREE.Vector3(out.z, 0, -out.x).normalize();
  const snow = new THREE.MeshStandardMaterial({ color: 0xf2f6fc, roughness: 0.88, metalness: 0 });
  const rime = new THREE.MeshStandardMaterial({ color: 0xdfeaf6, roughness: 0.55, metalness: 0, emissive: new THREE.Color(0.05, 0.08, 0.12) });
  disposables.push(snow, rime);
  // the cornice: a lofted lip along the brow — a curling overhang (a quarter-round section that
  // reaches out over the mouth and droops at its edge), thickest at the middle, tapering at the ends
  const nu = 28;
  const nv = 7;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  // each column roots on the rock itself, just above the opening: a ray in from outside finds the
  // face (round-2 check: rooted on the anchor point alone, the lip floated in front of a bulging brow)
  // (round 3, R2 D N-2: 29 Raycaster calls against the 41.5k-triangle cave rock cost 75–120 ms, a
  // hitch when a cave is dressed mid-run in Endless) the rock's triangles near the brow are gathered
  // once, then each column's ray is tested against those few only
  rock?.updateWorldMatrix(true, false);
  const rayY = mouth.y + 0.58 * (lip.y - mouth.y);
  const tris = rock ? browTriangles(rock, lip, along, out, rayY, C.len / 2 + 1) : new Float32Array(0);
  yield;
  const rootAt = (a: number): THREE.Vector3 | null => {
    if (!rock) return lip.clone().addScaledVector(along, a);
    // (just over the opening: ~55% of the way from the floor to the brow anchor — round-2 check,
    // the anchor itself is high on the face)
    const o = lip.clone().addScaledVector(along, a).addScaledVector(out, 8);
    o.y = rayY;
    const t = rayTris(o, out.clone().negate(), tris, 16);
    return t === null ? null : o.addScaledVector(out, -t).addScaledVector(out, -0.15);
  };
  // (Gitar, round 3) a column whose ray misses keeps its own place along the brow and borrows only
  // the depth (along `out`) of the nearest hit — never another column's point (degenerate strips)
  const roots = corniceRoots(nu, C.len, lip, along, rootAt);
  yield;
  for (let i = 0; i <= nu; i++) {
    const u = i / nu;
    const a = (u - 0.5) * C.len;
    const taper = Math.pow(Math.sin(Math.PI * u), 0.6);
    const wob = 0.12 * Math.sin(a * 1.7) + 0.08 * Math.sin(a * 3.9 + 1.3);
    for (let j = 0; j <= nv; j++) {
      const v = j / nv; // 0 = on the rock (back), 1 = the drooping edge
      const th = v * Math.PI * 0.75;
      // (round 3, R2 A N3: it read as a smooth slab) a scalloped, wind-sculpted lip: the edge bulges
      // and dips irregularly, and sags lower between the bulges
      const sc = Math.abs(Math.sin(a * 1.9 + 0.7)) * 0.6 + 0.4 * Math.abs(Math.sin(a * 4.3 + 2.1));
      const reach = (C.overhang * taper + 0.3) * Math.sin(th) * (1 + wob) * (1 + 0.28 * (sc - 0.5) * v * v);
      const rise = C.thick * taper * (0.55 * Math.cos(th) + 0.35) - 0.45 * v * v * taper - 0.22 * (1 - sc) * v * v * v;
      const p = roots[i]!.clone().addScaledVector(out, reach).add(new THREE.Vector3(0, rise + 0.05, 0));
      pos.push(p.x, p.y, p.z);
      // the underside and the drooping lip in shadow-blue, the crown bright
      const k = 1 - 0.3 * smoothstep(0.45, 1, v);
      col.push(0.95 * k, 0.97 * k, 1.0 * (0.94 + 0.06 * k));
    }
  }
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nv; j++) {
      const k = i * (nv + 1) + j;
      idx.push(k, k + nv + 1, k + 1, k + 1, k + nv + 1, k + nv + 2);
    }
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  cg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  cg.setIndex(idx);
  cg.computeVertexNormals();
  const corniceM = new THREE.MeshStandardMaterial({ color: 0xf2f6fc, roughness: 0.88, metalness: 0, vertexColors: true, side: THREE.DoubleSide });
  disposables.push(corniceM);
  const cornice = new THREE.Mesh(cg, corniceM);
  cornice.castShadow = true;
  cornice.name = 'storm-cave-cornice';
  group.add(cornice);
  yield;
  disposables.push(cg);
  // the cornice's drooping edge (the last row), where the feathers grow and the spindrift pours off
  const edge = (u: number) => {
    const i = Math.round(u * nu);
    const k = (i * (nv + 1) + nv) * 3;
    return new THREE.Vector3(pos[k]!, pos[k + 1]!, pos[k + 2]!);
  };
  // rime feathers: flattened, irregular blades grown off the underside of the edge into the wind,
  // in clusters (round 3, R2 A N3: 46 evenly spaced four-sided cones read as bunting)
  const feather = new THREE.ConeGeometry(0.09, 1, 3);
  feather.translate(0, 0.5, 0);
  feather.scale(1, 1, 0.22);
  disposables.push(feather);
  const hash = (n: number) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const clusters = 8;
  const count = 54;
  const fm = new THREE.InstancedMesh(feather, rime, count);
  const q = new THREE.Quaternion();
  const q2 = new THREE.Quaternion();
  const m4 = new THREE.Matrix4();
  const up = new THREE.Vector3(0, 1, 0);
  for (let n = 0; n < count; n++) {
    const c = n % clusters;
    const cu = 0.1 + 0.8 * hash(c + 3.3);
    const u = Math.min(0.95, Math.max(0.05, cu + (hash(n * 1.7) - 0.5) * 0.09));
    const p = edge(u).add(new THREE.Vector3(0, -0.1 - 0.3 * hash(n * 2.9), 0));
    // each blade points out into the wind, fanned a little up/down and sideways
    const dirV = out.clone().addScaledVector(along, (hash(n * 5.1) - 0.5) * 0.9).add(new THREE.Vector3(0, -0.35 + 0.5 * hash(n * 3.7), 0)).normalize();
    q.setFromUnitVectors(up, dirV);
    q2.setFromAxisAngle(up, hash(n * 7.3) * Math.PI);
    q.multiply(q2);
    const len = (0.2 + 0.75 * Math.pow(hash(n * 9.1), 1.6)) * (0.5 + 0.5 * Math.sin(Math.PI * u));
    m4.compose(p, q, new THREE.Vector3(1 + 2 * len, len, 1 + 2 * len));
    fm.setMatrixAt(n, m4);
  }
  fm.instanceMatrix.needsUpdate = true;
  fm.name = 'storm-cave-rime';
  // (round 3, R2 D N-4) its instance buffer is released with the dressing
  disposables.push(fm);
  group.add(fm);
  yield;
  // a drift banked against the windward jamb (half-buried: it never floats on a slope)
  const bank = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), snow);
  bank.scale.set(4.2, 1.6, 2.6);
  bank.position.copy(mouth).addScaledVector(along, -6.2).addScaledVector(out, 1.4).add(new THREE.Vector3(0, -0.45, 0));
  bank.lookAt(bank.position.clone().add(along));
  bank.name = 'storm-cave-drift-bank';
  group.add(bank);
  yield;
  disposables.push(bank.geometry);
  // the spindrift sheet off the cornice edge: a ribbon of falling snow streaks blown sideways
  // (round 3, R2 A N3: a regular grid of vertical dashes read as "digital rain") wisps at hashed
  // places, slanted downwind, soft-ended, of every length and weight; the sheet's own edges fade
  // (alphaMap, not repeated) so it never shows as a rectangle against the rock
  // (round 4, W-086 / review D3-1) both textures are module singletons: they are the same for every cave,
  // and drawing the wisps (1,260 gradient strokes) took 3–7 ms of the dressing frame each time
  // (round 5, review D4-6) this cave's own view of the shared image: each live cave scrolls its own offset
  const sheetTex = spindriftSheetTexture().clone();
  disposables.push(sheetTex);
  const sheetFade = spindriftSheetFade();
  const sheetM = new THREE.MeshBasicMaterial({ map: sheetTex, alphaMap: sheetFade, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  disposables.push(sheetM);
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(C.len * 0.8, 3.2), sheetM);
  const mid = edge(0.5);
  sheet.position.copy(mid).add(new THREE.Vector3(0, -1.7, 0)).addScaledVector(out, 0.25);
  sheet.lookAt(sheet.position.clone().add(out));
  sheet.name = 'storm-cave-spindrift-sheet';
  sheet.renderOrder = 7;
  group.add(sheet);
  disposables.push(sheet.geometry);
  return {
    group,
    update(dt: number, wind: number) {
      // the snow pours faster and slants harder the stronger the wind
      // (along the wisps' slant: they fall and drift downwind together)
      const v = dt * (0.35 + 0.08 * wind);
      sheetTex.offset.y += v;
      sheetTex.offset.x += v * 0.45;
      sheetM.opacity = 0.25 + 0.45 * smoothstep(3, 10, wind);
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

/** the spindrift sheet's wisps (shared by every storm cave; never disposed) */
const sheetHash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
let sheetTexS: THREE.CanvasTexture | null = null;
function spindriftSheetTexture(): THREE.CanvasTexture {
  if (sheetTexS) return sheetTexS;
  sheetTexS = (() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const g = c.getContext('2d');
    if (g) {
      g.clearRect(0, 0, 256, 256);
      g.lineCap = 'round';
      for (let k = 0; k < 140; k++) {
        const x = sheetHash(k * 1.31) * 256;
        const y = sheetHash(k * 2.77) * 256;
        const len = 14 + 60 * Math.pow(sheetHash(k * 4.13), 2);
        const slant = 0.35 + 0.3 * sheetHash(k * 5.9);
        const a = 0.12 + 0.4 * Math.pow(sheetHash(k * 6.7), 1.5);
        const gr = g.createLinearGradient(x, y, x - slant * len, y + len);
        gr.addColorStop(0, 'rgba(255,255,255,0)');
        gr.addColorStop(0.35, `rgba(255,255,255,${a})`);
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.strokeStyle = gr;
        g.lineWidth = 0.8 + 2.2 * sheetHash(k * 8.3);
        for (const ox of [-256, 0, 256])
          for (const oy of [-256, 0, 256]) {
            g.beginPath();
            g.moveTo(x + ox, y + oy);
            g.lineTo(x + ox - slant * len, y + oy + len);
            g.stroke();
          }
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2.3, 1.15);
    return t;
  })();
  return sheetTexS;
}
let sheetFadeS: THREE.CanvasTexture | null = null;
function spindriftSheetFade(): THREE.CanvasTexture {
  if (sheetFadeS) return sheetFadeS;
  sheetFadeS = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    if (g) {
      const img = g.createImageData(64, 64);
      for (let y = 0; y < 64; y++)
        for (let x = 0; x < 64; x++) {
          const ex = Math.min(x, 63 - x) / 18;
          const ey = Math.min(y, 63 - y) / 22;
          const v = Math.round(255 * Math.min(1, ex) * Math.min(1, ey) * (0.75 + 0.25 * sheetHash(x * 0.37 + y * 1.91)));
          const o = (y * 64 + x) * 4;
          img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
          img.data[o + 3] = 255;
        }
      g.putImageData(img, 0, 0);
    }
    return new THREE.CanvasTexture(c);
  })();
  return sheetFadeS;
}
