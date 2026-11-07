/**
 * Pooled CPU-simulated particle system (one draw call): ski spray, powder clouds, landing bursts,
 * crash explosions, falling snow from branches/rocks, breath vapour, Yeti footstep puffs, hot-tub steam.
 */
import * as THREE from 'three';

export interface Emit {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spread: number; // random velocity magnitude
  size: number;
  life: number;
  count: number;
  gravity?: number; // multiplier (0 = floats)
  drag?: number;
  grow?: number; // size growth per second (relative)
  alpha?: number;
  color?: number; // brightness 0..1 (snow white ~0.95, breath ~0.85)
}

export class Particles {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private size: Float32Array;
  private grow: Float32Array;
  private grav: Float32Array;
  private drag: Float32Array;
  private alpha: Float32Array;
  private baseAlpha: Float32Array;
  private col: Float32Array;
  private sizeAttr: Float32Array;
  private head = 0;
  private alive = 0;
  readonly capacity: number;
  private geo: THREE.BufferGeometry;

  constructor(capacity: number, pixelRatio: number) {
    this.capacity = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.grow = new Float32Array(capacity);
    this.grav = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.baseAlpha = new Float32Array(capacity);
    this.col = new Float32Array(capacity);
    this.sizeAttr = new Float32Array(capacity);
    for (let i = 0; i < capacity; i++) this.pos[i * 3 + 1] = -1e5;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizeAttr, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aCol', new THREE.BufferAttribute(this.col, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: pixelRatio * 600 }, fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aSize; attribute float aAlpha; attribute float aCol;
        uniform float uScale;
        varying float vA; varying float vC; varying float vFog;
        void main(){
          if (aAlpha <= 0.001) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; vC = 0.0; vFog = 0.0; return; }
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(aSize * uScale / max(-mv.z, 0.1), 0.0, 256.0);
          vA = aAlpha; vC = aCol; vFog = -mv.z;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 fogColor; uniform float fogDensity;
        varying float vA; varying float vC; varying float vFog;
        void main(){
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d);
          float a = smoothstep(0.5, 0.0, r);
          a *= a * vA;
          if (!(a >= 0.004)) discard;
          vec3 c = vec3(vC) * vec3(0.95, 0.97, 1.0);
          float f = 1.0 - exp(-fogDensity*fogDensity*vFog*vFog);
          gl_FragColor = vec4(mix(c, fogColor, f), a);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  setFog(color: THREE.Color, density: number) {
    const m = this.points.material as THREE.ShaderMaterial;
    (m.uniforms.fogColor!.value as THREE.Color).copy(color);
    m.uniforms.fogDensity!.value = density;
  }

  setPixelRatio(pr: number, height: number) {
    (this.points.material as THREE.ShaderMaterial).uniforms.uScale!.value = pr * height * 0.9;
  }

  emit(e: Emit) {
    for (let n = 0; n < e.count; n++) {
      const i = this.head;
      this.head = (this.head + 1) % this.capacity;
      const s = e.spread;
      this.pos[i * 3] = e.x + (Math.random() - 0.5) * 0.3;
      this.pos[i * 3 + 1] = e.y + Math.random() * 0.1;
      this.pos[i * 3 + 2] = e.z + (Math.random() - 0.5) * 0.3;
      this.vel[i * 3] = e.vx + (Math.random() - 0.5) * 2 * s;
      this.vel[i * 3 + 1] = e.vy + Math.random() * s;
      this.vel[i * 3 + 2] = e.vz + (Math.random() - 0.5) * 2 * s;
      const life = e.life * (0.6 + Math.random() * 0.8);
      this.life[i] = life;
      this.maxLife[i] = life;
      this.size[i] = e.size * (0.6 + Math.random() * 0.8);
      this.grow[i] = e.grow ?? 0.6;
      this.grav[i] = e.gravity ?? 1;
      this.drag[i] = e.drag ?? 1.5;
      this.baseAlpha[i] = e.alpha ?? 0.8;
      this.col[i] = e.color ?? 0.95;
    }
  }

  update(dt: number) {
    let alive = 0;
    const g = 9.81;
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i]! <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      alive++;
      const l = (this.life[i] = this.life[i]! - dt);
      if (l <= 0) {
        this.alpha[i] = 0;
        this.pos[i * 3 + 1] = -1e5;
        continue;
      }
      const dr = Math.exp(-this.drag[i]! * dt);
      this.vel[i * 3] = this.vel[i * 3]! * dr;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1]! * dr - g * this.grav[i]! * dt;
      this.vel[i * 3 + 2] = this.vel[i * 3 + 2]! * dr;
      this.pos[i * 3] = this.pos[i * 3]! + this.vel[i * 3]! * dt;
      this.pos[i * 3 + 1] = this.pos[i * 3 + 1]! + this.vel[i * 3 + 1]! * dt;
      this.pos[i * 3 + 2] = this.pos[i * 3 + 2]! + this.vel[i * 3 + 2]! * dt;
      const t = 1 - l / this.maxLife[i]!;
      this.size[i] = this.size[i]! * (1 + this.grow[i]! * dt);
      this.sizeAttr[i] = this.size[i]!;
      // fade in quickly, fade out smoothly
      this.alpha[i] = this.baseAlpha[i]! * Math.min(1, t * 8) * (1 - t) * (1 - t * 0.3);
    }
    this.alive = alive;
    (this.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('aAlpha') as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('aCol') as THREE.BufferAttribute).needsUpdate = true;
  }

  get aliveCount() {
    return this.alive;
  }

  clear() {
    this.life.fill(0);
    this.alpha.fill(0);
  }

  dispose() {
    this.geo.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
