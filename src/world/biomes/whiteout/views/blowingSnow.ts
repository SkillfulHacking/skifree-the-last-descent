/**
 * Whiteout Ridge: wind-driven snow streaks and low spindrift (GPU only).
 *
 * Instanced quads, each a snow grain moving with the wind (plus its own fall speed and jitter). The
 * position is wrapped into a box around the camera in the vertex shader (no per-frame CPU work), and
 * each quad is stretched along its screen-space motion so fast-blowing snow reads as streaks, more so
 * the stronger the wind. A share of the grains travel low (spindrift skating over the snow). Density
 * follows the storm: a few grains in a clear window, a driving blizzard inside a front.
 *
 * Counts per quality preset are bounded (stats → BlowingSnow.count).
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../../../core/types';

export const BLOWING = {
  count: { low: 1400, medium: 3200, high: 6000, ultra: 9000 } as Record<QualityPreset, number>,
  /** box around the camera (m): half-width XZ, height above/below */
  half: 34,
  up: 22,
  down: 9,
  /** share of grains in the low (spindrift) band */
  low: 0.35,
  /** streak length: seconds of motion */
  streak: 0.045,
} as const;

const VS = /* glsl */ `
attribute vec4 aSeed; // xyz in 0..1 (start position in the box), w: per-grain speed factor
uniform float uTime;
uniform vec3 uCam;
uniform vec3 uWind;
uniform float uHalf;
uniform float uUp;
uniform float uDown;
uniform float uLowShare;
uniform float uDensity;
uniform float uStreak;
uniform float uSize;
varying float vA;
varying vec2 vQ;
void main() {
  float k = aSeed.w;
  bool lowBand = fract(k * 7.31) < uLowShare;
  // fall + wind (low grains skate along the surface with the wind, barely falling)
  vec3 vel = vec3(uWind.x * (0.75 + 0.5 * k), lowBand ? -0.15 : -(0.8 + 1.1 * k), uWind.z * (0.75 + 0.5 * k) + 0.6);
  vel.x += sin(uTime * (1.3 + k) + k * 40.0) * (0.4 + 0.08 * length(uWind.xz));
  float H = uUp + uDown;
  vec3 box = vec3(2.0 * uHalf, lowBand ? 3.2 : H, 2.0 * uHalf);
  vec3 base = aSeed.xyz * box + vel * uTime;
  vec3 rel = mod(base - (uCam - vec3(uHalf, lowBand ? uDown : uDown, uHalf)), box);
  vec3 p = uCam - vec3(uHalf, uDown, uHalf) + rel;
  if (lowBand) p.y = uCam.y - uDown + rel.y * 0.5 + 0.2;
  // only some grains show in fair weather
  float on = step(fract(k * 13.7), uDensity);
  vA = on * smoothstep(0.0, 0.15, rel.x / box.x) * smoothstep(1.0, 0.85, rel.x / box.x) * smoothstep(0.0, 0.15, rel.z / box.z) * smoothstep(1.0, 0.85, rel.z / box.z);
  // stretch along the screen-space motion
  vec4 c0 = viewMatrix * vec4(p, 1.0);
  vec4 c1 = viewMatrix * vec4(p - vel * uStreak, 1.0);
  vec4 s0 = projectionMatrix * c0;
  vec4 s1 = projectionMatrix * c1;
  vec2 d = s1.xy / max(s1.w, 1e-3) - s0.xy / max(s0.w, 1e-3);
  float len = length(d);
  vec2 dir = len > 1e-5 ? d / len : vec2(0.0, 1.0);
  vec2 side = vec2(-dir.y, dir.x);
  float w = uSize / max(-c0.z, 0.5);
  vQ = position.xy;
  vec2 off = side * position.x * w + dir * (position.y * 0.5 + 0.5) * (len + w);
  gl_Position = s0 + vec4(off * s0.w, 0.0, 0.0);
  if (c0.z > -0.3) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;

const FS = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vA;
varying vec2 vQ;
void main() {
  float r = 1.0 - smoothstep(0.4, 1.0, abs(vQ.x));
  float e = smoothstep(-1.0, -0.6, vQ.y) * smoothstep(1.0, 0.4, vQ.y);
  float a = r * e * vA * uOpacity;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
}`;

export class BlowingSnow {
  readonly mesh: THREE.Mesh;
  readonly count: number;
  private u: Record<string, THREE.IUniform>;

  constructor(quality: QualityPreset) {
    const n = BLOWING.count[quality] ?? BLOWING.count.medium;
    this.count = n;
    const quad = new THREE.PlaneGeometry(2, 2);
    const g = new THREE.InstancedBufferGeometry();
    g.index = quad.index;
    g.setAttribute('position', quad.getAttribute('position'));
    const seed = new Float32Array(n * 4);
    // deterministic layout (a hash, not Math.random: identical captures)
    for (let i = 0; i < n; i++) {
      const h = (j: number) => {
        const x = Math.sin((i + 1) * 12.9898 + j * 78.233) * 43758.5453;
        return x - Math.floor(x);
      };
      seed.set([h(1), h(2), h(3), h(4)], i * 4);
    }
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
    g.instanceCount = n;
    this.u = {
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector3() },
      uWind: { value: new THREE.Vector3() },
      uHalf: { value: BLOWING.half },
      uUp: { value: BLOWING.up },
      uDown: { value: BLOWING.down },
      uLowShare: { value: BLOWING.low },
      uDensity: { value: 0.1 },
      uStreak: { value: BLOWING.streak },
      uSize: { value: 0.035 },
      uColor: { value: new THREE.Color(0.96, 0.97, 1.0) },
      uOpacity: { value: 0.8 },
    };
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, fog: false }));
    this.mesh.name = 'whiteout-blowing-snow';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
  }

  /** camera (render space), wind (m/s), storm 0..1, time (s) */
  update(cam: THREE.Vector3, windX: number, windZ: number, storm: number, time: number) {
    const U = this.u;
    U.uTime!.value = time % 3600;
    (U.uCam!.value as THREE.Vector3).copy(cam);
    (U.uWind!.value as THREE.Vector3).set(windX, 0, windZ);
    U.uDensity!.value = 0.08 + 0.92 * Math.min(1, storm * 1.15);
    U.uOpacity!.value = 0.45 + 0.4 * storm;
    this.mesh.visible = U.uDensity!.value > 0.02 && !this.mesh.userData.debugHidden;
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
