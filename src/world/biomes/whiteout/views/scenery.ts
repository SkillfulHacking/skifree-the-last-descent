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
import { RidgeRocks } from './ridgeRocks';
import { ROCK_ORIGIN } from '../../../art/rockMaterial';
import { buildCorniceGeometry, corniceMaterial, corniceSamples, wandGeometry, wandSpots } from './cornice';

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
  group: THREE.Group;
  poles: THREE.InstancedMesh;
  lamps: THREE.Points;
  lampMat: THREE.PointsMaterial;
  phase: Float32Array;
  geo: THREE.BufferGeometry;
  /** the corniced rim and its wands (terrain.ridge) */
  cornice: THREE.Mesh | null;
  wands: THREE.InstancedMesh | null;
}

/** the lamps' shared clock (their pulse runs along the line: aPhase = z) */
const LAMP_TIME = { value: 0 };
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
  private sky = new StormSky();
  private snow: BlowingSnow;
  private rocks: RidgeRocks;
  private win: [number, number] = [0, -1];
  private camR = new THREE.Vector3();

  private snowMat: THREE.Material | null;
  constructor(ctx: SceneryContext) {
    this.m = ctx.mountain;
    this.snowMat = ctx.terrainMaterial ?? null;
    this.group.name = 'whiteout-scenery';
    this.snow = new BlowingSnow(ctx.quality);
    this.rocks = new RidgeRocks(ctx.mountain, ctx.quality);
    this.group.add(this.sky.group, this.snow.mesh, this.rocks.group);
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
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uLampT;\nattribute float aPhase;\nvarying float vPulse;')
        .replace('#include <color_vertex>', '#include <color_vertex>\n  vPulse = pow(0.5 + 0.5 * sin(uLampT * 2.4 - aPhase * 0.045), 3.0);')
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
    const cg = buildCorniceGeometry(this.m, corniceSamples(this.m, k * CHUNK - 3, (k + 1) * CHUNK + 3));
    if (cg) {
      cornice = new THREE.Mesh(cg, this.snowMat ?? corniceMaterial());
      cornice.receiveShadow = true;
      cornice.castShadow = false;
      group.add(cornice);
    }
    let wands: THREE.InstancedMesh | null = null;
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
    }
    this.group.add(group);
    this.chunks.set(k, { group, poles, lamps, lampMat, phase, geo, cornice, wands });
  }

  private drop(k: number, ch: Chunk) {
    this.group.remove(ch.group);
    ch.poles.dispose();
    ch.geo.dispose();
    ch.lampMat.dispose();
    ch.cornice?.geometry.dispose();
    ch.wands?.dispose();
    this.chunks.delete(k);
  }

  update(dt: number, time: number, f: SceneryFrame): void {
    this.sky.update(dt, time, f);
    LAMP_TIME.value = time;
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
  }

  stats(): Record<string, number> {
    let n = 0;
    for (const c of this.chunks.values()) n += c.poles.count;
    return { chunks: this.chunks.size, markers: n, snowGrains: this.snow.count, ridgeRocks: this.rocks.count() };
  }

  dispose(): void {
    for (const [k, ch] of this.chunks) this.drop(k, ch);
    this.poleGeo.dispose();
    this.poleMat.dispose();
    this.wandMat.dispose();
    this.sky.dispose();
    this.snow.dispose();
    this.rocks.dispose();
  }
}

export const WHITEOUT_SCENERY = registerScenery({ id: 'whiteout-ridge', build: (ctx) => new WhiteoutScenery(ctx) });
