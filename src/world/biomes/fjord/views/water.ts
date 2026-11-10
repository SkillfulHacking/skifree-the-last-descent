/**
 * Fjord water: one level surface per fjord arm (Coast reaches) near the camera, plus the open sea
 * beyond a finite course's harbour.
 *
 * Each surface is a large camera-following quad at its arm's level; fragments outside the arm's
 * [z0, z1) are discarded (the headland ridges between arms always stand above both levels, so the
 * cut edges are hidden under rock). At most SEA_SLOTS arms are drawn: 1–4 draw calls, 2 triangles
 * each. The same reaches are handed to the terrain shader (uSea) for its wet shore band and surf.
 *
 * Shading: cold, dark fjord water; Fresnel reflection of an analytic sky (zenith → the fog colour
 * at the horizon); wind-driven ripples (four scrolling noise octaves → normal); a low-sun glitter
 * path; and the shared aerial perspective so it fades exactly like the terrain.
 */
import * as THREE from 'three';
import type { Coast, Reach } from '../../../coast';
import { ATMOSPHERE_GLSL, addAtmosphereUniforms } from '../../../look/atmosphere';
import { SEA_SLOTS, type TerrainUniforms } from '../../../snowMaterial';

const HALF = 16000;

function waterMaterial(sunDir: THREE.Vector3, sky: THREE.Color, quality: string): THREE.ShaderMaterial {
  const uniforms: Record<string, THREE.IUniform> = {
    uZ0: { value: 0 },
    uZ1: { value: 0 },
    uOrigin: { value: new THREE.Vector3() },
    uTime: { value: 0 },
    uSun: { value: sunDir },
    uSky: { value: sky },
    uDetail: { value: quality === 'low' ? 0 : 1 },
  };
  addAtmosphereUniforms(uniforms);
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: /* glsl */ `
uniform float uZ0;
uniform float uZ1;
uniform vec3 uOrigin;
uniform float uTime;
uniform vec3 uSun;
uniform vec3 uSky;
uniform float uDetail;
varying vec3 vW;
${ATMOSPHERE_GLSL}
// value noise whose lattice hash repeats every 256 cells: precise at any world coordinate, no seams
float wv_h(vec2 i) { i = mod(i, 256.0); return fract(sin(dot(i, vec2(12.9898, 78.233))) * 43758.5453); }
float wv_n(vec2 q) {
  vec2 i = floor(q), f = fract(q); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(wv_h(i), wv_h(i + vec2(1, 0)), u.x), mix(wv_h(i + vec2(0, 1)), wv_h(i + vec2(1, 1)), u.x), u.y);
}
// ripple height field: big slow swell + wind ripples running inland (+x) with the breeze
float sf_wave(vec2 p, float t, float nearK) {
  float h = 0.0;
  // round 2 (art review D10): close to the camera, fine cat's-paw ripples carry the surface (the
  // big swell alone smeared into blotches at the bathing pier)
  if (nearK > 0.0) h += nearK * uDetail * (0.014 * wv_n(p * 1.1 + vec2(t * 0.9, t * 0.2)) + 0.006 * wv_n(p * 2.9 - vec2(t * 1.6, -t * 0.4)));
  h += 0.55 * wv_n(p * 0.012 + vec2(t * 0.020, t * 0.006));
  h += 0.28 * wv_n(p * 0.035 + vec2(t * 0.055, -t * 0.012));
  h += 0.12 * wv_n(p * 0.11 + vec2(t * 0.16, t * 0.03)) * uDetail;
  h += 0.05 * wv_n(p * 0.37 + vec2(t * 0.42, -t * 0.09)) * uDetail;
  return h;
}
void main() {
  vec3 P = vW + uOrigin; // absolute world position
  if (P.z < uZ0 || P.z >= uZ1) discard;
  vec3 rel = vW - cameraPosition;
  float d = length(rel);
  vec3 V = -rel / d;
  // ripple normal (finite differences), flattened with distance so the far water doesn't alias
  vec2 p = P.xz;
  float nearK = 1.0 - smoothstep(60.0, 400.0, d);
  float e = mix(0.14, 1.5, smoothstep(20.0, 220.0, d)) + d * 0.004;
  float h0 = sf_wave(p, uTime, nearK);
  float hx = sf_wave(p + vec2(e, 0.0), uTime, nearK);
  float hz = sf_wave(p + vec2(0.0, e), uTime, nearK);
  float amp = 2.6 * (1.0 - smoothstep(800.0, 9000.0, d) * 0.85) * mix(0.32, 1.0, smoothstep(30.0, 320.0, d));
  vec3 N = normalize(vec3(-(hx - h0) * amp / e * 6.0, 1.0, -(hz - h0) * amp / e * 6.0));
  float cosT = max(dot(N, V), 0.0);
  float F = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
  vec3 R = reflect(-V, N);
  // analytic sky: deep cold blue overhead, the fog colour at the horizon (matches the haze)
  float ry = max(R.y, 0.0);
  vec3 skyCol = mix(sf_fogColor(R) * 1.02, uSky * 0.85, pow(ry, 0.55));
  // fjord water: very dark teal-blue, a little lighter in the ripple troughs facing the sky
  vec3 deep = vec3(0.010, 0.034, 0.052);
  vec3 body = mix(deep, vec3(0.02, 0.07, 0.09), 0.35 * (h0 - 0.4));
  vec3 col = mix(body, skyCol, F * 0.92);
  // low-sun glitter path + a soft sheen
  float sd = max(dot(R, uSun), 0.0);
  col += vec3(1.0, 0.86, 0.66) * (pow(sd, 900.0) * 18.0 + pow(sd, 90.0) * 0.55 + pow(sd, 12.0) * 0.06);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor.rgb = sf_atmosphere(gl_FragColor.rgb, vW);
}`,
    fog: false,
  });
}

export class FjordWater {
  readonly group = new THREE.Group();
  private slots: Array<{ mesh: THREE.Mesh; mat: THREE.ShaderMaterial; reach: Reach | null }> = [];
  private geo = new THREE.PlaneGeometry(2 * HALF, 2 * HALF, 1, 1).rotateX(-Math.PI / 2);

  constructor(
    private coast: Coast,
    private terrain: TerrainUniforms,
    sunDir: THREE.Vector3,
    skyColor: THREE.Color,
    quality: string,
  ) {
    this.group.name = 'FjordWater';
    for (let i = 0; i < SEA_SLOTS; i++) {
      const mat = waterMaterial(sunDir, skyColor, quality);
      const mesh = new THREE.Mesh(this.geo, mat);
      mesh.frustumCulled = false;
      mesh.visible = false;
      mesh.renderOrder = -1;
      this.group.add(mesh);
      this.slots.push({ mesh, mat, reach: null });
    }
  }

  /** the reaches drawn now (tests/debug) */
  get active(): Reach[] {
    return this.slots.filter((s) => s.reach).map((s) => s.reach!);
  }

  update(time: number, camPos: THREE.Vector3, origin: THREE.Vector3) {
    // arms in view: behind the camera a little, far ahead (the terrain far field reaches ~10–14 km)
    const list = this.coast.reaches(camPos.z - 4500, camPos.z + 14000);
    list.sort((a, b) => dist(a, camPos.z) - dist(b, camPos.z));
    const sea = this.terrain.uSea?.value;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i]!;
      const r = list[i] ?? null;
      s.reach = r;
      s.mesh.visible = !!r;
      if (sea) sea[i]!.set(r ? r.z0 : 1, r ? (Number.isFinite(r.z1) ? r.z1 : 1e9) : 0, r ? r.level : -1e9);
      if (!r) continue;
      s.mesh.position.set(camPos.x, r.level, camPos.z);
      s.mesh.updateMatrix();
      const u = s.mat.uniforms;
      u['uZ0']!.value = r.z0;
      u['uZ1']!.value = Number.isFinite(r.z1) ? r.z1 : 1e9;
      u['uTime']!.value = time;
      (u['uOrigin']!.value as THREE.Vector3).copy(origin);
    }
  }

  dispose() {
    this.geo.dispose();
    for (const s of this.slots) s.mat.dispose();
    this.group.removeFromParent();
  }
}

function dist(r: Reach, z: number): number {
  return z < r.z0 ? r.z0 - z : z > r.z1 ? z - r.z1 : 0;
}
