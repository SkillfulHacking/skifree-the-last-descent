/**
 * "whiteout-ridge" scenery: the illuminated trail markers.
 *
 * Marker poles stand along the racing line (alternating sides, just outside the obstacle-free lane)
 * every MARKER.step metres, each topped by a lamp. The racing line's lamps are amber; the exposed
 * fast alternate lines are marked with blue lamps. The lamps are drawn without fog and glow brighter
 * as a storm closes in, so the way down stays readable in a whiteout (they pulse slowly in sequence
 * down the hill, which also shows the direction of the line). Streamed per 256 m chunk, bounded on
 * any course length.
 */
import * as THREE from 'three';
import { registerScenery, type SceneryContext, type SceneryFrame, type SceneryView } from '../../../presentation/scenery';
import type { Mountain } from '../../../course';
import { LANE_HALF } from '../../../../physics/obstacles';
import { StormSky } from './sky';
import { BlowingSnow } from './blowingSnow';
import { ValleyCloudSea } from './cloudSea';
import { RidgeRocks } from './ridgeRocks';
import { ROCK_ORIGIN } from '../../../art/rockMaterial';
import { A11Y } from '../../../../core/a11y';
import { weatherFx } from '../../../look/weatherFx';
import { buildCorniceGeometry, corniceMaterial, corniceSamples, wandGeometry, wandSpots } from './cornice';
import { buildRimSpindrift, rimSpindriftMaterial } from './rimSpindrift';

export const MARKER = {
  step: 28,
  /** lateral offset from the racing line (m) */
  side: LANE_HALF + 2.2,
  pole: 2.6,
  /** lamp size (m, attenuated) */
  lamp: 1.5,
} as const;

const CHUNK = 256;
const BEHIND = 1;
const AHEAD = 4;

export interface MarkerSpot {
  x: number;
  y: number;
  z: number;
  alt: boolean;
}

/** the marker positions in [z0, z1) (pure: tests check they stay on the snow, beside the line) */
export function markerSpots(m: Mountain, z0: number, z1: number): MarkerSpot[] {
  const out: MarkerSpot[] = [];
  const end = Number.isFinite(m.finishZ) ? m.finishZ - 30 : Infinity;
  for (let z = Math.ceil(z0 / MARKER.step) * MARKER.step; z < z1 && z < end; z += MARKER.step) {
    if (z < 60) continue;
    const k = Math.round(z / MARKER.step);
    const side = k % 2 === 0 ? 1 : -1;
    const x = m.routeX(z) + side * MARKER.side;
    out.push({ x, y: m.heightAt(x, z), z, alt: false });
  }
  // the fast alternate lines: blue lamps on alternate sides of each line, every other step
  for (const a of m.altsNear(z0, z1)) {
    for (let z = Math.ceil(Math.max(a.z0 + 40, z0) / (MARKER.step * 2)) * MARKER.step * 2; z < Math.min(a.z1 - 40, z1); z += MARKER.step * 2) {
      const ax = m.profile.altX(a, z);
      const side = Math.round(z / MARKER.step / 2) % 2 === 0 ? 1 : -1;
      const x = ax + side * 4.5;
      out.push({ x, y: m.heightAt(x, z), z, alt: true });
    }
  }
  return out;
}

interface Chunk {
  /** (round 5) spindrift veils off the lip */
  veils: THREE.Mesh | null;
  group: THREE.Group;
  poles: THREE.InstancedMesh;
  lamps: THREE.Points;
  lampMat: THREE.PointsMaterial;
  phase: Float32Array;
  geo: THREE.BufferGeometry;
  /** the corniced rim and its wands (terrain.ridge) */
  cornice: THREE.Mesh | null;
  wands: THREE.InstancedMesh | null;
  /** (round 6) the steady red lights on the rim wands */
  rimLamps: THREE.Points | null;
}

/** the lamps' shared clock (their pulse runs along the line: aPhase = z) */
const LAMP_TIME = { value: 0 };
/**
 * (W-088, round 5 E4-5) 1 while "Reduce flashes & pulsing" is on: the trail-marker lamps burn steady at
 * their mean brightness instead of pulsing. Exported for the test.
 */
export const LAMP_CALM = { value: 0 };
/** (round 6) the rim spindrift plumes: off (read as light shafts / sprites in two blind reads) */
export const RIM_SPINDRIFT_ON = false;
/** (round 6, W-065) steady red rim lights: on every `every`-th wand, `height` m up, `size` m across */
export const RIM_LAMPS = { on: true, every: 1, height: 3.5, size: 3.2 };
let lampTex: THREE.Texture | null = null;
function lampTexture(): THREE.Texture {
  if (lampTex) return lampTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,255,255,0.95)');
  grd.addColorStop(0.42, 'rgba(255,255,255,0.32)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  lampTex = new THREE.CanvasTexture(c);
  lampTex.colorSpace = THREE.SRGBColorSpace;
  return lampTex;
}

export class WhiteoutScenery implements SceneryView {
  readonly group = new THREE.Group();
  private chunks = new Map<number, Chunk>();
  private poleGeo: THREE.BufferGeometry;
  private poleMat: THREE.MeshStandardMaterial;
  private wandMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, emissive: new THREE.Color(0.3, 0.22, 0.0), emissiveIntensity: 0.35 });
  private m: Mountain;
  private rimLampMat: THREE.PointsMaterial;
  private sky = new StormSky();
  private snow: BlowingSnow;
  private rocks: RidgeRocks;
  /** (W-065) the cloud deck in the valley below the ridge */
  private cloudSea: ValleyCloudSea;
  private win: [number, number] = [0, -1];
  private camR = new THREE.Vector3();

  private snowMat: THREE.Material | null;
  constructor(ctx: SceneryContext) {
    this.m = ctx.mountain;
    this.snowMat = ctx.terrainMaterial ?? null;
    this.rimLampMat = new THREE.PointsMaterial({ size: RIM_LAMPS.size, map: lampTexture(), color: new THREE.Color(1.0, 0.1, 0.06), transparent: true, depthWrite: false, fog: false, sizeAttenuation: true });
    this.group.name = 'whiteout-scenery';
    this.snow = new BlowingSnow(ctx.quality);
    this.rocks = new RidgeRocks(ctx.mountain, ctx.quality);
    this.cloudSea = new ValleyCloudSea(ctx.mountain, ctx.biome.atmosphere.fogColor as [number, number, number]);
    this.group.add(this.sky.group, this.snow.mesh, this.rocks.group, this.cloudSea.mesh);
    // a slim pole with reflective orange/black bands (vertex colours)
    const g = new THREE.CylinderGeometry(0.045, 0.06, MARKER.pole, 6, 8);
    g.translate(0, MARKER.pole / 2, 0);
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const col: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const band = Math.floor((y / MARKER.pole) * 8) % 2 === 0;
      if (band) col.push(0.95, 0.38, 0.05);
      else col.push(0.06, 0.06, 0.07);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.poleGeo = g;
    this.poleMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.1, emissive: new THREE.Color(0.25, 0.08, 0.0), emissiveIntensity: 0.4 });
  }

  stream(z: number): void {
    const c0 = Math.floor(z / CHUNK) - BEHIND;
    const c1 = Math.floor(z / CHUNK) + AHEAD;
    for (const [k, ch] of this.chunks) if (k < c0 || k > c1) this.drop(k, ch);
    for (let k = Math.max(0, c0); k <= c1; k++) if (!this.chunks.has(k)) this.build(k);
    this.win = [c0, c1];
    this.rocks.stream(c0, c1);
  }

  loadAssets(): Promise<void> {
    return this.rocks.loadScans();
  }

  flush(): void {}

  private build(k: number) {
    const spots = markerSpots(this.m, k * CHUNK, (k + 1) * CHUNK);
    const group = new THREE.Group();
    const poles = new THREE.InstancedMesh(this.poleGeo, this.poleMat, Math.max(1, spots.length));
    poles.count = spots.length;
    const M = new THREE.Matrix4();
    const lp = new Float32Array(spots.length * 3);
    const lc = new Float32Array(spots.length * 3);
    const phase = new Float32Array(spots.length);
    spots.forEach((s, i) => {
      M.makeTranslation(s.x, s.y - 0.2, s.z);
      poles.setMatrixAt(i, M);
      lp[i * 3] = s.x;
      lp[i * 3 + 1] = s.y + MARKER.pole - 0.05;
      lp[i * 3 + 2] = s.z;
      // (round 3, R2 A 8) a deep amber drawn over the fog, not added to it (additive amber on a bright
      // whiteout saturates to white)
      const c = s.alt ? [0.3, 0.6, 1.0] : [1.0, 0.48, 0.06];
      lc.set(c, i * 3);
      phase[i] = s.z;
    });
    poles.instanceMatrix.needsUpdate = true;
    poles.castShadow = false;
    poles.frustumCulled = false;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(lc, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    // lamps: not fogged (they are the way through the whiteout); each pulses on its own phase, so the
    // pulse runs down the hill along the line (round 3, R2 A 8: one shared sin made them blink together)
    const lampMat = new THREE.PointsMaterial({ size: MARKER.lamp, map: lampTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.NormalBlending, fog: false, sizeAttenuation: true });
    lampMat.onBeforeCompile = (sh) => {
      sh.uniforms.uLampT = LAMP_TIME;
      sh.uniforms.uLampCalm = LAMP_CALM;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uLampT;\nuniform float uLampCalm;\nattribute float aPhase;\nvarying float vPulse;')
        .replace('#include <color_vertex>', '#include <color_vertex>\n  vPulse = mix(pow(0.5 + 0.5 * sin(uLampT * 2.4 - aPhase * 0.045), 3.0), 0.31, uLampCalm);')
        .replace('gl_PointSize = size;', 'gl_PointSize = size * (0.82 + 0.4 * vPulse);');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vPulse;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= 0.7 + 0.5 * vPulse;');
    };
    const lamps = new THREE.Points(geo, lampMat);
    lamps.frustumCulled = false;
    group.add(poles, lamps);
    // the corniced rim (a little overlap between chunks so the strip has no seams)
    let cornice: THREE.Mesh | null = null;
    const cs = corniceSamples(this.m, k * CHUNK - 3, (k + 1) * CHUNK + 3);
    const cg = buildCorniceGeometry(this.m, cs);
    // (round 5, W-065) spindrift pouring off the lip into the drop (presentation only, beyond the lip)
    // (round 6: two blind reads took the plumes for light shafts, steam or sprites) off
    const veils = RIM_SPINDRIFT_ON ? buildRimSpindrift(this.m, cs.filter((s) => s.z >= k * CHUNK && s.z < (k + 1) * CHUNK)) : null;
    if (veils) group.add(veils);
    if (cg) {
      cornice = new THREE.Mesh(cg, this.snowMat ?? corniceMaterial());
      cornice.receiveShadow = true;
      cornice.castShadow = false;
      group.add(cornice);
    }
    let wands: THREE.InstancedMesh | null = null;
    let rimLamps: THREE.Points | null = null;
    const ws = wandSpots(this.m, k * CHUNK, (k + 1) * CHUNK);
    if (ws.length) {
      wands = new THREE.InstancedMesh(wandGeometry(), this.wandMat, ws.length);
      ws.forEach((w, i) => {
        // crossed pairs, like a ski area's closed-edge marking
        M.makeRotationZ(((i % 2 ? 1 : -1) * 14 * Math.PI) / 180).setPosition(w.x, w.y - 0.25, w.z);
        wands!.setMatrixAt(i, M);
      });
      wands.instanceMatrix.needsUpdate = true;
      group.add(wands);
      // (round 6, W-065 storm: the wands wash out to specks in a whiteout) a steady red light on each
      // wand (RIM_LAMPS), drawn over the fog like the trail lamps: in a storm the drop's edge is a row of red
      // lights on the left, the way down a row of amber ones. Steady (never pulsing: Reduce flashes)
      if (RIM_LAMPS.on) {
        const lit = ws.filter((_, i) => i % RIM_LAMPS.every === 0);
        const rp = new Float32Array(lit.length * 3);
        lit.forEach((w, i) => rp.set([w.x, w.y + RIM_LAMPS.height, w.z], i * 3));
        const rg = new THREE.BufferGeometry();
        rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
        rimLamps = new THREE.Points(rg, this.rimLampMat);
        rimLamps.frustumCulled = false;
        group.add(rimLamps);
      }
    }
    this.group.add(group);
    this.chunks.set(k, { group, poles, lamps, lampMat, phase, geo, cornice, wands, veils, rimLamps });
  }

  private drop(k: number, ch: Chunk) {
    this.group.remove(ch.group);
    ch.poles.dispose();
    ch.geo.dispose();
    ch.lampMat.dispose();
    ch.cornice?.geometry.dispose();
    ch.veils?.geometry.dispose();
    ch.wands?.dispose();
    ch.rimLamps?.geometry.dispose();
    this.chunks.delete(k);
  }

  update(dt: number, time: number, f: SceneryFrame): void {
    if (this.probes) this.probes.visible = false;
    this.sky.update(dt, time, f);
    this.cloudSea.update(time, f);
    LAMP_TIME.value = time;
    // the veils smoke harder the stronger the wind (always a little: the ridge is never still)
    const vm = rimSpindriftMaterial();
    vm.uniforms.uTime!.value = time;
    // (round 6, W-103 / review E5-4) "Reduce weather effects" thins the rim spindrift like the other weather
    vm.uniforms.uK!.value = (0.55 + 0.35 * Math.min(1, f.storm ?? 0)) * weatherFx.scale;
    LAMP_CALM.value = A11Y.reduceFlashes ? 1 : 0;
    ROCK_ORIGIN.value.copy(f.origin);
    // (a scan that arrived since the last stream: place the rocks of the live chunks)
    this.rocks.stream(this.win[0], this.win[1]);
    // (render space: the scene is drawn shifted by −origin)
    this.snow.update(this.camR.copy(f.camPos).sub(f.origin), f.windX ?? 0, f.windZ ?? 0, f.storm ?? 0, f.clock ?? time);
    // brighter and larger as the storm closes in (they matter most then)
    const s = f.storm ?? 0;
    for (const ch of this.chunks.values()) {
      ch.lampMat.size = MARKER.lamp * (1 + 0.9 * s);
      ch.lampMat.opacity = 0.75 + 0.25 * s;
    }
    // (round 4, W-065) the rim wands' flags carry through the storm: in a whiteout they are what marks
    // the edge (the drop itself is hidden), so they glow brighter as it closes in, like the lamps
    this.wandMat.emissiveIntensity = 0.35 + 1.1 * s;
  }

  warmup(): void {
    // the storm dome and wall, the cloud sea and the blowing snow: shown for the load-time compile,
    // restored by the next update (W-086)
    this.group.traverse((o) => (o.visible = true));
    // (round 6, W-105) and one of each streamed kind that may not exist yet at the start: the rock and
    // spire materials (instanced), the trail lamps' and the rim lights' point sprites, the wands
    if (!this.probes) {
      this.probes = new THREE.Group();
      this.probes.name = 'warmup-probes';
      const dot = new THREE.BufferGeometry();
      dot.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
      dot.setAttribute('color', new THREE.BufferAttribute(new Float32Array([1, 1, 1]), 3));
      dot.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(1), 1));
      this.probeGeos.push(dot);
      const wand = new THREE.InstancedMesh(wandGeometry(), this.wandMat, 1);
      wand.setMatrixAt(0, new THREE.Matrix4());
      this.probeGeos.push(wand.geometry);
      this.probes.add(...this.rocks.warmupProbes(), new THREE.Points(dot, this.rimLampMat), wand);
      for (const o of this.probes.children) o.frustumCulled = false;
      this.group.add(this.probes);
    }
    this.probes.visible = true;
  }
  private probes: THREE.Group | null = null;
  private probeGeos: THREE.BufferGeometry[] = [];

  stats(): Record<string, number> {
    let n = 0;
    for (const c of this.chunks.values()) n += c.poles.count;
    return { chunks: this.chunks.size, markers: n, snowGrains: this.snow.count, ridgeRocks: this.rocks.count() };
  }

  dispose(): void {
    for (const [k, ch] of this.chunks) this.drop(k, ch);
    this.cloudSea.dispose();
    this.poleGeo.dispose();
    this.poleMat.dispose();
    this.wandMat.dispose();
    this.rimLampMat.dispose();
    for (const g of this.probeGeos) g.dispose();
    this.sky.dispose();
    this.snow.dispose();
    this.rocks.dispose();
  }
}

export const WHITEOUT_SCENERY = registerScenery({ id: 'whiteout-ridge', build: (ctx) => new WhiteoutScenery(ctx) });
