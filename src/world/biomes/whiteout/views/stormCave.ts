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
  const built = buildStormArchitecture(cave.lipTop, cave.mouth, O);
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
  return {
    update(_dt, t) {
      if (released) return;
      // the squall peaks through the emergence and the roar, then the gust blows through so the leap
      // (14.6–17 s, past the skier's shoulder) reads — at full squall the Yeti vanished (dev8 15)
      const k = smoothstep(S.t0, S.t1, t) * (1 - S.lull * smoothstep(S.lullT[0], S.lullT[1], t));
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
      if (!released) world.releaseWeather(S.release);
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
function buildStormArchitecture(lip: THREE.Vector3, mouth: THREE.Vector3, out: THREE.Vector3) {
  const C = STORM_CAVE.cornice;
  const group = new THREE.Group();
  group.name = 'storm-cave-architecture';
  const along = new THREE.Vector3(out.z, 0, -out.x).normalize();
  const disposables: Array<{ dispose(): void }> = [];
  const snow = new THREE.MeshStandardMaterial({ color: 0xf2f6fc, roughness: 0.88, metalness: 0 });
  const rime = new THREE.MeshStandardMaterial({ color: 0xdfeaf6, roughness: 0.55, metalness: 0, emissive: new THREE.Color(0.05, 0.08, 0.12) });
  disposables.push(snow, rime);
  // the cornice: a lofted lip along the brow — a curling overhang (a quarter-round section that
  // reaches out over the mouth and droops at its edge), thickest at the middle, tapering at the ends
  const nu = 28;
  const nv = 7;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= nu; i++) {
    const u = i / nu;
    const a = (u - 0.5) * C.len;
    const taper = Math.pow(Math.sin(Math.PI * u), 0.6);
    const wob = 0.12 * Math.sin(a * 1.7) + 0.08 * Math.sin(a * 3.9 + 1.3);
    for (let j = 0; j <= nv; j++) {
      const v = j / nv; // 0 = on the brow (back), 1 = the drooping edge
      const th = v * Math.PI * 0.75;
      const reach = (C.overhang * taper + 0.3) * Math.sin(th) * (1 + wob);
      const rise = C.thick * taper * (0.55 * Math.cos(th) + 0.35) - 0.45 * v * v * taper;
      const p = lip.clone().addScaledVector(along, a).addScaledVector(out, -0.4 + reach).add(new THREE.Vector3(0, rise + 0.05, 0));
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nv; j++) {
      const k = i * (nv + 1) + j;
      idx.push(k, k + nv + 1, k + 1, k + 1, k + nv + 1, k + nv + 2);
    }
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  cg.setIndex(idx);
  cg.computeVertexNormals();
  const cornice = new THREE.Mesh(cg, snow);
  cornice.material.side = THREE.DoubleSide;
  cornice.castShadow = true;
  cornice.name = 'storm-cave-cornice';
  group.add(cornice);
  disposables.push(cg);
  // the cornice's drooping edge (the last row), where the feathers grow and the spindrift pours off
  const edge = (u: number) => {
    const i = Math.round(u * nu);
    const k = (i * (nv + 1) + nv) * 3;
    return new THREE.Vector3(pos[k]!, pos[k + 1]!, pos[k + 2]!);
  };
  // rime feathers: thin blades grown off the underside of the edge into the wind (outward, a little up)
  const feather = new THREE.ConeGeometry(0.06, 1, 4);
  feather.translate(0, 0.5, 0);
  disposables.push(feather);
  const count = 46;
  const fm = new THREE.InstancedMesh(feather, rime, count);
  const q = new THREE.Quaternion();
  const m4 = new THREE.Matrix4();
  const dirV = out.clone().add(new THREE.Vector3(0, -0.15, 0)).normalize();
  q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirV);
  for (let n = 0; n < count; n++) {
    const u = 0.08 + 0.84 * ((n * 0.6180339887) % 1);
    const p = edge(u).add(new THREE.Vector3(0, -0.12 - 0.25 * ((n * 0.37) % 1), 0));
    const len = 0.25 + 0.55 * ((n * 0.7548776662) % 1) * Math.sin(Math.PI * u);
    m4.compose(p, q, new THREE.Vector3(1 + len, len, 1 + len));
    fm.setMatrixAt(n, m4);
  }
  fm.instanceMatrix.needsUpdate = true;
  fm.name = 'storm-cave-rime';
  group.add(fm);
  // a drift banked against the windward jamb (half-buried: it never floats on a slope)
  const bank = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), snow);
  bank.scale.set(4.2, 1.6, 2.6);
  bank.position.copy(mouth).addScaledVector(along, -6.2).addScaledVector(out, 1.4).add(new THREE.Vector3(0, -0.45, 0));
  bank.lookAt(bank.position.clone().add(along));
  bank.name = 'storm-cave-drift-bank';
  group.add(bank);
  disposables.push(bank.geometry);
  // the spindrift sheet off the cornice edge: a ribbon of falling snow streaks blown sideways
  const sheetTex = (() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 256;
    const g = c.getContext('2d');
    if (g) {
      g.clearRect(0, 0, 64, 256);
      for (let k = 0; k < 90; k++) {
        const x = (k * 37) % 64;
        const y = (k * 151) % 256;
        g.fillStyle = `rgba(255,255,255,${0.25 + ((k * 13) % 10) / 20})`;
        g.fillRect(x, y, 1.5, 10 + ((k * 7) % 22));
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 1);
    return t;
  })();
  const sheetM = new THREE.MeshBasicMaterial({ map: sheetTex, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  disposables.push(sheetTex, sheetM);
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
      sheetTex.offset.y += dt * (0.35 + 0.08 * wind);
      sheetTex.offset.x -= dt * 0.04 * wind;
      sheetM.opacity = 0.25 + 0.45 * smoothstep(3, 10, wind);
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
