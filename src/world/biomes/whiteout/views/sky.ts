/**
 * Whiteout Ridge: the moving sky — a cloud deck, the storm wall and the cloud shadows.
 *
 * Everything follows the same deterministic front timeline as the skier's weather (storm.ts
 * `frontAt` on the physics clock), so what the player sees coming is what will hit them:
 *
 *  - clear window: a high, broken deck drifting with the wind; its shadows sweep over the snow and
 *    the far valleys (shared cloud field: look/atmosphere.ts `sf_cloudDensity`);
 *  - the last ~30 s of a window: the storm wall — a dark curtain of snow-laden cloud standing on the
 *    windward horizon, crossing the ridges toward the course; the deck ahead of it thickens and
 *    lowers;
 *  - build (≈ 9 s): the wall arrives over the course (fog, wind and snow ramp up: Environment);
 *  - storm: inside the cloud (the deck closes, the shadows merge into one overcast);
 *  - ease: the wall moves off downwind and its trailing edge tears open; the low sun comes back
 *    through the gaps and the cloud shadows break up over the ridge.
 *
 * Cost: two transparent meshes with short fragment shaders (no raymarching) and two uniforms on the
 * terrain/prop shaders; no textures.
 */
import * as THREE from 'three';
import { weatherFx } from '../../../look/weatherFx';
import { clamp, smoothstep } from '../../../../core/rng';
import { atmosphere, CLOUD_NOISE_GLSL } from '../../../look/atmosphere';
import type { SceneryFrame } from '../../../presentation/scenery';
import { frontAt, type FrontState } from '../storm';

export const SKY = {
  /** cloud-deck altitude above the focus (m): clear / storm */
  deckH: [620, 170] as const,
  /** deck radius (m) */
  deckR: 9000,
  /** coverage: clear window / building / storm */
  cov: [0.32, 0.62, 0.95] as const,
  /** the storm wall: distance upwind (m) when it appears, how long before the build it does (s) */
  wallFar: 4200,
  wallLead: 32,
  wallH: 1500,
  wallW: 14000,
  /** cloud-shadow strength in a clear window */
  shadowK: 0.32,
  /** the deck drifts at this fraction of the wind (high-level wind is stronger) */
  drift: 3.2,
} as const;

/**
 * Where the storm wall stands (m upwind of the skier along the wind axis; negative = gone downwind)
 * and how visible it is, at physics time t. Pure: the presentation and the tests share it.
 */
export function stormWall(t: number, seed: number, f: FrontState = frontAt(t, seed)): { dist: number; vis: number } {
  // seconds to the end of the clear window (when the build starts) or since the storm ended
  if (f.phase === 'clear') {
    const toBuild = f.left;
    const u = clamp(1 - toBuild / SKY.wallLead, 0, 1);
    // appears far upwind, crosses the ridges toward the course, accelerating as it comes
    return { dist: SKY.wallFar * (1 - u * u * 0.84), vis: smoothstep(0, 0.25, u) };
  }
  if (f.phase === 'build') {
    // ≈ 670 m out at the start of the build, over the skier at its end
    const u = 1 - f.left / 9;
    return { dist: SKY.wallFar * 0.16 * (1 - u), vis: 1 };
  }
  if (f.phase === 'storm') return { dist: 0, vis: 0 };
  // ease: the trailing edge moves off downwind
  const u = 1 - f.left / 8;
  return { dist: -600 - 2200 * u, vis: 1 - smoothstep(0.6, 1, u) };
}

const DECK_VS = /* glsl */ `
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const DECK_FS = /* glsl */ `
uniform vec2 uOff;
uniform float uCov;
uniform vec3 uLit;
uniform vec3 uShade;
uniform vec3 uFog;
uniform float uFade;
uniform vec3 uCam;
uniform vec2 uWallN;
uniform float uWallD;
uniform float uDeckH;
varying vec3 vW;
${CLOUD_NOISE_GLSL}
void main() {
  vec2 rel = vW.xz - uCam.xz;
  // the deck thickens toward the storm wall (ahead of it the front's anvil spreads over)
  float a = dot(rel, uWallN);
  float ahead = uWallD > 1.0 ? smoothstep(uWallD + 900.0, uWallD - 600.0, a) : 0.0;
  float cov = clamp(uCov + 0.45 * ahead, 0.0, 0.98);
  float d = sf_cloudDensity(vW.xz + uOff, cov);
  float d2 = sf_cloudDensity(vW.xz + uOff + vec2(140.0, -90.0), cov);
  // self-shadowing: thicker cloud is darker underneath
  vec3 col = mix(uLit, uShade, clamp(0.35 + 0.9 * d2 - 0.3 * d, 0.0, 1.0));
  float dist = length(rel);
  // seen at a grazing angle the cloud field minifies into a hard ceiling line with stretched
  // "drips": toward the horizon the deck becomes its own average — an even overcast of the same
  // coverage, graded into the horizon haze — instead of the aliased noise
  float elev = uDeckH / max(dist, 1.0);
  float g = smoothstep(0.05, 0.32, elev);
  float mean = smoothstep(0.25, 0.95, cov);
  d = mix(mean * 0.9, d, g);
  col = mix(mix(uLit, uShade, 0.35 + 0.5 * mean), col, g);
  // and fade into the fog toward the edge of the deck (no hard deck edge)
  float h = smoothstep(${SKY.deckR.toFixed(1)}, ${(SKY.deckR * 0.35).toFixed(1)}, dist);
  col = mix(uFog, col, 0.25 + 0.75 * g * h);
  gl_FragColor = vec4(col, d * mix(0.6, 1.0, h) * uFade);
}`;

const WALL_FS = /* glsl */ `
uniform float uTime;
uniform vec3 uTop;
uniform vec3 uBase;
uniform float uVis;
uniform float uHaze;
uniform vec3 uFog;
varying vec2 vUv;
${CLOUD_NOISE_GLSL}
void main() {
  // vUv.x along the wall (0..1), vUv.y up (0..1)
  vec2 p = vec2(vUv.x * 28000.0, vUv.y * 1800.0);
  // a towering, rounded cumuliform top (low frequencies only: the higher ones aliased into spikes and
  // hanging "drips" kilometres away) that rises as the front comes on
  float top = (0.5 + 0.2 * sf_cNoise(vec2(vUv.x * 9.0, uTime * 0.015)) + 0.08 * sf_cNoise(vec2(vUv.x * 23.0, 2.0 + uTime * 0.01))) * mix(0.55, 1.0, uVis);
  float body = 1.0 - smoothstep(top - 0.22, top, vUv.y);
  // precipitation under the base: broad, soft shafts (no sub-pixel streak texture)
  float shafts = 0.85 + 0.15 * sf_cNoise(vec2(vUv.x * 70.0, vUv.y * 2.0 - uTime * 0.05));
  float billow = sf_cloudDensity(p * 0.25 + vec2(uTime * 6.0, 0.0), 0.8);
  float alpha = body * mix(0.75, 1.0, billow) * shafts;
  // soft ends along the wall
  alpha *= smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
  vec3 col = mix(uBase, uTop, smoothstep(0.0, 0.9, vUv.y) * (0.6 + 0.4 * billow));
  // aerial perspective: kilometres off, the wall is a blue-grey mass in the haze, not a dark smear
  col = mix(col, uFog, uHaze);
  gl_FragColor = vec4(col, min(1.0, alpha * uVis * 1.2));
}`;

export class StormSky {
  readonly group = new THREE.Group();
  private deck: THREE.Mesh;
  private wall: THREE.Mesh;
  private deckU: Record<string, THREE.IUniform>;
  private wallU: Record<string, THREE.IUniform>;
  private f: FrontState = { s: 0, dir: 1, phase: 'clear', left: 0, k: 0 };
  private off = new THREE.Vector2();
  private lastClock = NaN;

  constructor() {
    this.group.name = 'whiteout-sky';
    this.deckU = {
      uOff: { value: new THREE.Vector2() },
      uCov: { value: SKY.cov[0] },
      uLit: { value: new THREE.Color(0.93, 0.94, 0.97) },
      uShade: { value: new THREE.Color(0.46, 0.5, 0.58) },
      uFog: { value: new THREE.Color(0.74, 0.79, 0.86) },
      uFade: { value: 1 },
      uCam: { value: new THREE.Vector3() },
      uWallN: { value: new THREE.Vector2(-1, 0) },
      uWallD: { value: 0 },
      uDeckH: { value: SKY.deckH[0] },
    };
    const dg = new THREE.CircleGeometry(SKY.deckR, 64, 0, Math.PI * 2);
    dg.rotateX(Math.PI / 2); // face down (seen from below)
    this.deck = new THREE.Mesh(dg, new THREE.ShaderMaterial({ uniforms: this.deckU, vertexShader: DECK_VS, fragmentShader: DECK_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    this.deck.frustumCulled = false;
    this.deck.renderOrder = -1;
    this.wallU = {
      uTime: { value: 0 },
      uTop: { value: new THREE.Color(0.62, 0.66, 0.73) },
      uBase: { value: new THREE.Color(0.36, 0.4, 0.47) },
      uVis: { value: 0 },
      uHaze: { value: 0 },
      uFog: { value: new THREE.Color(0.74, 0.79, 0.86) },
    };
    const wg = new THREE.PlaneGeometry(SKY.wallW, SKY.wallH, 1, 1);
    wg.translate(0, SKY.wallH / 2 - 120, 0);
    this.wall = new THREE.Mesh(
      wg,
      new THREE.ShaderMaterial({
        uniforms: this.wallU,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: WALL_FS,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      }),
    );
    this.wall.frustumCulled = false;
    this.wall.visible = false;
    this.group.add(this.deck, this.wall);
  }

  update(_dt: number, time: number, fr: SceneryFrame) {
    const t = fr.clock ?? time;
    const seed = fr.weatherSeed ?? 0;
    const f = frontAt(t, seed, this.f);
    // a finish cinematic drives the weather itself (the storm held, then the break): follow its storm
    // (and while that weather is handed back, the blended storm the fog and snow use: W-043)
    const s = fr.override || fr.blend ? fr.storm ?? 0 : f.s;
    const o = fr.origin;
    const focus = fr.focus;
    // drift with the wind (clamped dt: no jump after a teleport or a pause)
    const wx = fr.windX ?? 0;
    const wz = fr.windZ ?? 0;
    const step = Number.isNaN(this.lastClock) ? 0 : clamp(t - this.lastClock, 0, 0.1);
    this.lastClock = t;
    this.off.x -= wx * SKY.drift * step;
    this.off.y -= (wz * SKY.drift + 3) * step;
    // coverage and altitude: the deck thickens and lowers through the build into the storm
    const pre = f.phase === 'clear' ? smoothstep(SKY.wallLead, 0, f.left) : 0;
    const cov = s > 0 ? SKY.cov[1] + (SKY.cov[2] - SKY.cov[1]) * s : SKY.cov[0] + (SKY.cov[1] - SKY.cov[0]) * 0.5 * pre;
    const deckY = focus.y + SKY.deckH[0] + (SKY.deckH[1] - SKY.deckH[0]) * Math.max(s, 0.4 * pre);
    // (scene objects live in absolute coordinates; the scene is shifted by −origin at render time,
    // so the shaders see render space: the noise offset folds the origin back in)
    this.deck.position.set(focus.x, deckY, focus.z);
    const U = this.deckU;
    (U.uOff!.value as THREE.Vector2).set(this.off.x + o.x, this.off.y + o.z);
    U.uCov!.value = cov;
    U.uDeckH!.value = deckY - focus.y;
    (U.uCam!.value as THREE.Vector3).set(focus.x - o.x, 0, focus.z - o.z);
    (U.uFog!.value as THREE.Color).copy(atmosphere.uFogColor.value);
    // inside the storm the fog is the cloud: the deck fades out (no ceiling seen through the snow)
    U.uFade!.value = 1 - smoothstep(0.55, 0.9, s);
    // the storm wall, upwind (the front blows from −dir·X toward +dir·X)
    const w = fr.override ? { dist: 0, vis: 0 } : stormWall(t, seed, f);
    const n = U.uWallN!.value as THREE.Vector2;
    n.set(-f.dir, 0);
    U.uWallD!.value = w.vis > 0 ? w.dist : 0;
    this.wall.visible = w.vis > 0.01 && Math.abs(w.dist) > 300;
    if (this.wall.visible) {
      const x = focus.x - f.dir * w.dist;
      this.wall.position.set(x, focus.y - 200, focus.z + 1500);
      this.wall.rotation.set(0, Math.PI / 2, 0);
      // (W-040) a flat plane up close shows its own outline (round 1, frame 04: a hard grey wedge
      // during the build): within ~1 km the wall hands over to the storm fog and dome, which are
      // already closing in by then
      this.wallU.uVis!.value = w.vis * smoothstep(300, 1100, Math.abs(w.dist));
      this.wallU.uHaze!.value = 0.6 * smoothstep(600, SKY.wallFar, Math.abs(w.dist));
      (this.wallU.uFog!.value as THREE.Color).copy(atmosphere.uFogColor.value);
      this.wallU.uTime!.value = t;
    }
    // cloud shadows on the terrain and props: the same field, at the deck's height (render space)
    atmosphere.uCloudK.value = SKY.shadowK * (1 - smoothstep(0.35, 0.8, s)) * (fr.override && s < 0.05 ? 0.6 : 1);
    atmosphere.uCloudOff.value.set(this.off.x + o.x, this.off.y + o.z);
    atmosphere.uCloudCov.value = cov;
    atmosphere.uCloudH.value = deckY - o.y;
    // surface spindrift: snow snakes stream over the snow once the wind is up
    const ws = Math.hypot(wx, wz);
    atmosphere.uDriftK.value = 0.6 * smoothstep(4, 11, ws) * weatherFx.scale;
    if (ws > 1e-3) atmosphere.uDriftDir.value.set(wx / ws, wz / ws);
    this.driftS += ws * 1.7 * step;
    atmosphere.uDriftS.value = this.driftS % 100000;
    atmosphere.uDriftOrigin.value.set(o.x, o.z);
  }
  private driftS = 0;

  dispose() {
    atmosphere.uCloudK.value = 0;
    atmosphere.uDriftK.value = 0;
    this.deck.geometry.dispose();
    (this.deck.material as THREE.Material).dispose();
    this.wall.geometry.dispose();
    (this.wall.material as THREE.Material).dispose();
  }
}
