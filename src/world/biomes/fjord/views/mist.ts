/**
 * Sea mist: occasional low banks of haze lying on the fjord water, drifting slowly inland. Camera-
 * facing soft sprites (one InstancedMesh, one draw call), placed deterministically per fjord arm
 * (only some arms have mist), rebuilt when the set of arms near the skier changes. They fade out
 * as the camera approaches (no hard intersections up close) and take the shared aerial
 * perspective, so far banks melt into the haze.
 */
import * as THREE from 'three';
import { Rng } from '../../../../core/rng';
import type { Coast } from '../../../coast';
import type { Mountain } from '../../../course';
import { ATMOSPHERE_GLSL, addAtmosphereUniforms } from '../../../look/atmosphere';

const MAX = 48;

export class SeaMist {
  readonly mesh: THREE.InstancedMesh;
  private mat: THREE.ShaderMaterial;
  private key = '';
  count = 0;

  constructor(
    private coast: Coast,
    private m: Mountain,
    sunDir: THREE.Vector3,
    quality: string,
  ) {
    const uniforms: Record<string, THREE.IUniform> = { uTime: { value: 0 }, uSun: { value: sunDir }, uStrength: { value: quality === 'low' ? 0.6 : 1 } };
    addAtmosphereUniforms(uniforms);
    this.mat = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
attribute vec4 aMist; // size, alpha, seed, stretch
varying vec2 vUv;
varying vec3 vW;
varying float vA;
varying float vSeed;
uniform float uTime;
void main() {
  vec3 c = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  c.x += sin(uTime * 0.03 + aMist.z * 6.0) * 25.0 + uTime * 0.6;
  vec3 toCam = normalize(cameraPosition - c);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 w = c + right * position.x * aMist.x * aMist.w + up * position.y * aMist.x * 0.32;
  vW = w;
  vUv = uv;
  float d = length(cameraPosition - c);
  vA = aMist.y * smoothstep(aMist.x * 0.6, aMist.x * 1.6, d);
  vSeed = aMist.z;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`,
      fragmentShader: /* glsl */ `
uniform float uTime;
uniform vec3 uSun;
uniform float uStrength;
varying vec2 vUv;
varying vec3 vW;
varying float vA;
varying float vSeed;
${ATMOSPHERE_GLSL}
float mh(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
float mn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(mh(i), mh(i+vec2(1,0)), u.x), mix(mh(i+vec2(0,1)), mh(i+vec2(1,1)), u.x), u.y); }
void main() {
  vec2 q = vUv * 2.0 - 1.0;
  float r = length(q * vec2(1.0, 1.25));
  float n = 0.6 * mn(vUv * 4.0 + vec2(uTime * 0.01 + vSeed * 9.0, vSeed)) + 0.4 * mn(vUv * 9.0 - vec2(uTime * 0.02, 0.0));
  float a = (1.0 - smoothstep(0.25, 1.0, r + 0.25 * (n - 0.5))) * smoothstep(-1.0, -0.55, q.y);
  a *= vA * uStrength;
  if (a < 0.003) discard;
  vec3 v = normalize(vW - cameraPosition);
  vec3 col = mix(uFogColor * 1.05, uSunHaze, 0.25 * pow(max(dot(v, uSun), 0.0), 3.0));
  gl_FragColor = vec4(col, a);
}`,
    });
    const geo = new THREE.PlaneGeometry(2, 2);
    geo.setAttribute('aMist', new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4));
    this.mesh = new THREE.InstancedMesh(geo, this.mat, MAX);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }

  stream(z: number) {
    const reaches = this.coast.reaches(z - 2500, z + 9000);
    const key = reaches.map((r) => r.index).join(',');
    if (key === this.key) return;
    this.key = key;
    const attr = this.mesh.geometry.getAttribute('aMist') as THREE.InstancedBufferAttribute;
    const M = new THREE.Matrix4();
    let n = 0;
    for (const r of reaches) {
      const rng = new Rng((this.m.seed ^ Math.imul(r.index + 7, 0x51ed270b)) >>> 0);
      // "occasional": some arms are clear
      if (rng.float() < 0.3) continue;
      const z0 = Math.max(r.z0 + 300, -1800);
      const z1 = Number.isFinite(r.z1) ? r.z1 - 300 : z0 + 5000;
      const banks = 2 + rng.int(0, 2);
      for (let b = 0; b < banks && n < MAX; b++) {
        const bz = z0 + rng.float() * Math.max(1, z1 - z0);
        const bx = this.coast.rimX(bz) - rng.range(700, 1900);
        for (let k = 0; k < 4 && n < MAX; k++) {
          M.makeTranslation(bx + rng.range(-260, 260), r.level + rng.range(10, 45), bz + rng.range(-300, 300));
          this.mesh.setMatrixAt(n, M);
          attr.setXYZW(n, rng.range(140, 320), rng.range(0.12, 0.26), rng.float(), rng.range(1.6, 3.0));
          n++;
        }
      }
    }
    this.count = n;
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    attr.needsUpdate = true;
  }

  update(time: number, _cam: THREE.Vector3) {
    this.mat.uniforms['uTime']!.value = time;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
    this.mesh.dispose();
  }
}
