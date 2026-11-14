/**
 * Sea mist: occasional low banks of haze lying on the fjord water, drifting slowly inland. Camera-
 * facing soft sprites (one InstancedMesh, one draw call), placed deterministically per fjord arm
 * (only some arms have mist), rebuilt when the set of arms near the skier changes. They fade out
 * as the camera approaches (no hard intersections up close) and take the shared aerial
 * perspective, so far banks melt into the haze.
 *
 * Round 3 (tech review D, new 3): the opaque water plane cut the sprites along the waterline, a hard
 * straight seam across the fjord. Each bank now carries its arm's water level and fades by WORLD
 * HEIGHT: zero at the water surface, full a little above it, so the cut happens where the mist is
 * already transparent. Banks are lower (sea smoke lies on the water) and narrower near the wall.
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
attribute float aLvl; // water level under the bank
varying vec2 vUv;
varying vec3 vW;
varying float vA;
varying float vSeed;
varying float vLvl;
varying float vH;
uniform float uTime;
void main() {
  vec3 c = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  c.x += sin(uTime * 0.03 + aMist.z * 6.0) * 25.0 + uTime * 0.6;
  vec3 toCam = normalize(cameraPosition - c);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 w = c + right * position.x * aMist.x * aMist.w + up * position.y * aMist.x * 0.2;
  vW = w;
  vLvl = aLvl;
  vH = aMist.x * 0.2;
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
varying float vLvl;
varying float vH;
${ATMOSPHERE_GLSL}
float mh(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
float mn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(mh(i), mh(i+vec2(1,0)), u.x), mix(mh(i+vec2(0,1)), mh(i+vec2(1,1)), u.x), u.y); }
void main() {
  vec2 q = vUv * 2.0 - 1.0;
  float r = length(q * vec2(1.0, 1.25));
  float n = 0.6 * mn(vUv * 4.0 + vec2(uTime * 0.01 + vSeed * 9.0, vSeed)) + 0.4 * mn(vUv * 9.0 - vec2(uTime * 0.02, 0.0));
  float a = 1.0 - smoothstep(0.25, 1.0, r + 0.25 * (n - 0.5));
  // fade by world height above the water: nothing at the surface (where the opaque water cuts
  // the sprite), full a third of the way up; ragged so the lower edge never reads as a line
  float hb = (vW.y - vLvl) / max(1.0, vH);
  a *= smoothstep(0.0, 0.55 + 0.25 * n, hb);
  a *= vA * uStrength;
  if (a < 0.003) discard;
  vec3 v = normalize(vW - cameraPosition);
  vec3 col = mix(uFogColor * 1.05, uSunHaze, 0.25 * pow(max(dot(v, uSun), 0.0), 3.0));
  gl_FragColor = vec4(col, a);
}`,
    });
    const geo = new THREE.PlaneGeometry(2, 2);
    geo.setAttribute('aMist', new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4));
    geo.setAttribute('aLvl', new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1));
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
    const lvl = this.mesh.geometry.getAttribute('aLvl') as THREE.InstancedBufferAttribute;
    const M = new THREE.Matrix4();
    let n = 0;
    for (const r of reaches) {
      const rng = new Rng((this.m.seed ^ Math.imul(r.index + 7, 0x51ed270b)) >>> 0);
      // "occasional": some arms are clear (round 2, art review D13: never the first arm or the
      // open sea, so every course shows mist lying on the water somewhere)
      if (rng.float() < 0.3 && r.index > 0 && !r.ocean) continue;
      const z0 = Math.max(r.z0 + 300, -1800);
      const z1 = Number.isFinite(r.z1) ? r.z1 - 300 : z0 + 5000;
      const banks = 3 + rng.int(0, 2);
      for (let b = 0; b < banks && n < MAX; b++) {
        const bz = z0 + rng.float() * Math.max(1, z1 - z0);
        // some banks hug the foot of the wall (seen over the rim and from the cliff-top views)
        const hug = b % 2 === 0;
        const bx = this.coast.rimX(bz) - (hug ? rng.range(260, 520) : rng.range(700, 1900));
        for (let k = 0; k < 4 && n < MAX; k++) {
          const size = rng.range(140, 320);
          // the sprite's lower edge sits a little under the water (its faded part)
          M.makeTranslation(bx + rng.range(-220, 220), r.level + size * 0.2 * 0.8, bz + rng.range(-300, 300));
          this.mesh.setMatrixAt(n, M);
          // banks hugging the wall stay narrower (a camera-facing sprite turns into the cliff)
          attr.setXYZW(n, size, rng.range(0.22, 0.4), rng.float(), hug ? rng.range(1.1, 1.7) : rng.range(1.6, 3.0));
          lvl.setX(n, r.level);
          n++;
        }
      }
      // the open sea: a bank drifting across the harbour mouth beyond the lighthouse
      if (r.ocean && this.coast.finite) {
        const L = this.coast.finishZ;
        const cx = this.m.centerX(L);
        const sz = this.coast.shoreZ(cx);
        for (let k = 0; k < 5 && n < MAX; k++) {
          const size = rng.range(160, 280);
          M.makeTranslation(cx + rng.range(-420, 380), r.level + size * 0.2 * 0.8, sz + rng.range(420, 1100));
          this.mesh.setMatrixAt(n, M);
          attr.setXYZW(n, size, rng.range(0.22, 0.34), rng.float(), rng.range(2.0, 3.2));
          lvl.setX(n, r.level);
          n++;
        }
      }
    }
    this.count = n;
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    attr.needsUpdate = true;
    lvl.needsUpdate = true;
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
