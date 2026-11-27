/**
 * Whiteout Ridge: the sea of cloud in the valley below the ridge (W-065).
 *
 * Diagnosis (round 3, gameplay-camera captures and terrain sections): from the racing line, 40+ m from
 * the rim with the camera 2–3 m above the snow, the flank below the rim can never be seen — the line of
 * sight over the rim falls only 1–3°, and everything past it is the far valley side kilometres away,
 * which the haze turns the same white as the snow beside the piste. So the drop read as more snowfield.
 *
 * A cloud deck lying in the valley, `DROP` m below the line, fills exactly that band — between the rim's
 * skyline and the distant ranges — with a soft, darker-than-snow, slowly drifting layer: the classic
 * view from a high ridge, and a depth cue the eye cannot read as ground. It is visual only, on the drop
 * side past the rim (nothing there can be reached: the rim guard), follows the camera along the course,
 * fades into the haze with distance, and thins out as a storm closes in (in a storm the view is gone).
 */
import * as THREE from 'three';
import type { Mountain } from '../../../course';
import type { SceneryFrame } from '../../../presentation/scenery';

export const CLOUD_SEA = {
  /** the deck's height below the racing line (m): the valley floor is ~520 m below the rim */
  drop: 330,
  /** how far past the rim the deck starts (m): it meets the flank in the gulf below */
  from: 260,
  /** size across × along the course (m) */
  across: 16000,
  along: 16000,
  /** (round 6 art prototype A) no deck at all */
  hidden: false as boolean,
};

const VERT = /* glsl */ `
varying vec3 vW;
uniform vec3 uOrigin;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz + uOrigin;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
varying vec3 vW;
uniform vec3 uCam;
uniform vec3 uHaze;
uniform float uTime;
uniform float uOpacity;
uniform float uRimX;
uniform float uSide;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int k = 0; k < 4; k++) { s += a * n(p); p *= 2.03; a *= 0.5; } return s; }
// (Round 5, W-096 / review D4-3: four 4-octave fbm per pixel) two octaves for the detail terms
float fbm2(vec2 p) { return 0.667 * n(p) + 0.333 * n(p * 2.03 + 11.0); }
void main() {
  // (Round 6, W-065 blind reads: the deck read as "a frozen sea", "rippled water", lying level with the
  // horizon) a sea of cloud: big soft billows (larger scale, no fine ripple term), sunlit tops brighter
  // than the snow with soft blue shadows on their lee sides, the dark valley floor showing only through
  // a few gaps; it thins out with distance so it does not run flat to the horizon
  vec2 p = vW.xz / 2400.0 + vec2(uTime * 0.003, uTime * 0.001);
  float c = fbm(p);
  float lit = fbm2(p * 1.7 + vec2(0.06, 0.02)) - fbm2(p * 1.7);
  vec3 floorC = mix(vec3(0.10, 0.14, 0.18), vec3(0.20, 0.25, 0.30), smoothstep(0.3, 0.7, fbm2(p * 6.0)));
  vec3 shadeC = vec3(0.62, 0.68, 0.78);
  vec3 topC = vec3(0.97, 0.96, 0.93);
  vec3 cloud = mix(shadeC, topC, clamp(0.55 + lit * 4.0, 0.0, 1.0));
  // gaps: where the billows thin out the floor shows (about a fifth of the deck)
  vec3 col = mix(floorC, cloud, smoothstep(0.36, 0.48, c));
  float d = length(vW.xz - uCam.xz);
  col = mix(col, uHaze, 0.8 * (1.0 - exp(-d * 0.0002)));
  // a soft edge where it meets the flank, and a ragged one; and it thins out far away
  float e = (vW.x - uRimX) * uSide;
  float a = uOpacity * smoothstep(${CLOUD_SEA.from.toFixed(1)}, ${(CLOUD_SEA.from + 500).toFixed(1)}, e + (c - 0.5) * 300.0) * (1.0 - smoothstep(3500.0, 6500.0, d));
  gl_FragColor = vec4(col, a);
}`;

export class ValleyCloudSea {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private side: 1 | -1;

  constructor(
    private m: Mountain,
    haze: [number, number, number],
  ) {
    this.side = m.biome.terrain.ridge?.dropSide ?? 1;
    const g = new THREE.PlaneGeometry(CLOUD_SEA.across, CLOUD_SEA.along, 1, 1);
    g.rotateX(-Math.PI / 2);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      fog: false,
      uniforms: {
        uOrigin: { value: new THREE.Vector3() },
        uCam: { value: new THREE.Vector3() },
        uHaze: { value: new THREE.Color(...haze) },
        uTime: { value: 0 },
        uOpacity: { value: 1 },
        uRimX: { value: 0 },
        uSide: { value: this.side },
      },
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.name = 'whiteout-cloud-sea';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
  }

  update(time: number, f: SceneryFrame) {
    const m = this.m;
    const z = f.camPos.z;
    const rim = m.ridgeRimX(z);
    if (!Number.isFinite(rim)) {
      this.mesh.visible = false;
      return;
    }
    const y = m.heightAt(m.routeX(z), z) - CLOUD_SEA.drop;
    const cx = rim + this.side * (CLOUD_SEA.across / 2);
    // render space (the scene is drawn shifted by −origin), a little ahead of the camera
    this.mesh.position.set(cx - f.origin.x, y - f.origin.y, z + CLOUD_SEA.along * 0.3 - f.origin.z);
    const u = this.mat.uniforms;
    (u.uOrigin!.value as THREE.Vector3).copy(f.origin);
    (u.uCam!.value as THREE.Vector3).copy(f.camPos);
    u.uTime!.value = time;
    u.uRimX!.value = rim;
    // a storm closes the view: the deck is gone in a full storm
    const s = f.storm ?? 0;
    u.uOpacity!.value = 1 - THREE.MathUtils.smoothstep(s, 0.35, 0.8);
    this.mesh.visible = u.uOpacity!.value > 0.01 && !CLOUD_SEA.hidden;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
