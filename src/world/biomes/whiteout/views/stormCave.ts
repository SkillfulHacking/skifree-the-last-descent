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
 *  - in the encounter: a squall rolls in as the Yeti stirs — the light flattens, the snow thickens and
 *    the wind tears across the mouth as he emerges (7.9 s), his roar (11.05 s) blasts a cloud of snow
 *    off the brow, and after the leap the squall moves off and the weather is handed back to the
 *    model over 7 s (World.releaseWeather), so the chase starts in whatever the front is doing.
 */
import * as THREE from 'three';
import type { CaveCinematicContext, CaveCinematicExtras, CaveDressing, CaveDressingContext } from '../../../presentation/cave';
import { makeFlakeTexture } from '../../../Environment';
import { smoothstep } from '../../../../core/rng';

export const STORM_CAVE = {
  /** brow curtain grains, mouth spindrift grains */
  curtain: 260,
  skate: 220,
  /** the squall in the encounter: ramps in (s), peak weather */
  squall: { t0: 5.2, t1: 9.0, end: 17.2, release: 7, visibility: 5.2, snowfall: 2.0, storm: 0.62, wind: 9.5 },
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
      if (i < show) this.pos.set([gr.p.x, gr.p.y, gr.p.z], i * 3);
      else this.pos.set([0, -1e5, 0], i * 3);
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
  const curtain = new Grains(STORM_CAVE.curtain, 0.16, (gr, burst) => {
    gr.p.set(brow.x + O.x * (0.2 + rnd() * 0.8), brow.y - 0.2 - rnd() * 0.4, brow.z + (rnd() - 0.5) * 11);
    gr.v.set(O.x * (0.4 + rnd() * (burst ? 5 : 0.8)), burst ? 1 + rnd() * 2.5 : -(1.6 + rnd() * 1.6), (rnd() - 0.5) * 0.6 + wind * 0.35);
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
  let burst = 0;
  const dressing: CaveDressing & { setWind(w: number): void; roar(): void } = {
    group,
    update(dt) {
      const d = Math.min(dt, 0.1);
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
  let released = false;
  const dir = Math.sign(base.windX || 1);
  return {
    update(_dt, t) {
      if (released) return;
      const k = smoothstep(S.t0, S.t1, t);
      world.weatherOverride = {
        visibility: base.visibility + (S.visibility - base.visibility) * k,
        snowfall: base.snowfall + (S.snowfall - base.snowfall) * k,
        storm: (base.storm ?? 0) + (S.storm - (base.storm ?? 0)) * k,
        windX: base.windX + (dir * S.wind - base.windX) * k,
      };
      dressing?.setWind(Math.abs(base.windX) + (S.wind - Math.abs(base.windX)) * k);
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
      if (!released) world.releaseWeather(S.release);
    },
  };
}
