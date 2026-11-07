/**
 * Animated resort effects: soft particle systems (steam, chimney smoke, embers, bulb glow),
 * hot-tub water shader, fire-pit flame shader and the waving finish banner cloth.
 */
import * as THREE from 'three';
import { Rand } from './util';

const PARTICLE_VS = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
uniform float uScale;
varying float vAlpha;
varying vec3 vColor;
#include <fog_pars_vertex>
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
  vAlpha = aAlpha;
  vColor = aColor;
  #include <fog_vertex>
}
`;
const PARTICLE_FS = /* glsl */ `
uniform sampler2D uMap;
varying float vAlpha;
varying vec3 vColor;
#include <fog_pars_fragment>
void main() {
  vec4 t = texture2D(uMap, gl_PointCoord);
  gl_FragColor = vec4(vColor, t.a * vAlpha);
  if (gl_FragColor.a < 0.003) discard;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

export interface EmitterOpts {
  count: number;
  /** spawn centre (world) */
  origin: THREE.Vector3;
  /** spawn radius (xz) */
  radius: number;
  life: [number, number];
  /** rise velocity */
  rise: [number, number];
  drift: THREE.Vector3;
  size: [number, number];
  alpha: number;
  color: THREE.ColorRepresentation;
  additive?: boolean;
  /** turbulence amplitude */
  swirl?: number;
  /** colour toward end of life */
  colorEnd?: THREE.ColorRepresentation;
}

export class Particles {
  readonly points: THREE.Points;
  private o: EmitterOpts;
  private age: Float32Array;
  private life: Float32Array;
  private vel: Float32Array;
  private seedA: Float32Array;
  private pos: THREE.BufferAttribute;
  private size: THREE.BufferAttribute;
  private alpha: THREE.BufferAttribute;
  private col: THREE.BufferAttribute;
  private rnd = new Rand(7);
  private c0: THREE.Color;
  private c1: THREE.Color;
  private tmpC = new THREE.Color();
  readonly material: THREE.ShaderMaterial;

  constructor(o: EmitterOpts, map: THREE.Texture) {
    this.o = o;
    const n = o.count;
    this.age = new Float32Array(n);
    this.life = new Float32Array(n);
    this.vel = new Float32Array(n * 3);
    this.seedA = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    this.size = new THREE.BufferAttribute(new Float32Array(n), 1);
    this.alpha = new THREE.BufferAttribute(new Float32Array(n), 1);
    this.col = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    this.pos.setUsage(THREE.DynamicDrawUsage);
    this.size.setUsage(THREE.DynamicDrawUsage);
    this.alpha.setUsage(THREE.DynamicDrawUsage);
    this.col.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.pos);
    g.setAttribute('aSize', this.size);
    g.setAttribute('aAlpha', this.alpha);
    g.setAttribute('aColor', this.col);
    this.c0 = new THREE.Color(o.color);
    this.c1 = new THREE.Color(o.colorEnd ?? o.color);
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uMap: { value: map }, uScale: { value: 400 } }]),
      vertexShader: PARTICLE_VS,
      fragmentShader: PARTICLE_FS,
      transparent: true,
      depthWrite: false,
      fog: true,
      blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.material.uniforms.uMap!.value = map;
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.points.onBeforeRender = (renderer, _scene, camera) => {
      const h = renderer.getContext().drawingBufferHeight;
      const fov = (camera as THREE.PerspectiveCamera).fov ?? 50;
      this.material.uniforms.uScale!.value = h / (2 * Math.tan(((fov * Math.PI) / 180) / 2));
    };
    for (let i = 0; i < n; i++) {
      this.spawn(i);
      this.age[i] = this.rnd.next() * this.life[i]!;
      this.seedA[i] = this.rnd.next() * 100;
    }
    this.update(0, 0);
  }

  private spawn(i: number): void {
    const o = this.o;
    const a = this.rnd.next() * Math.PI * 2;
    const r = Math.sqrt(this.rnd.next()) * o.radius;
    this.pos.setXYZ(i, o.origin.x + Math.sin(a) * r, o.origin.y, o.origin.z + Math.cos(a) * r);
    this.vel[i * 3] = o.drift.x * (0.6 + this.rnd.next() * 0.8);
    this.vel[i * 3 + 1] = o.rise[0] + (o.rise[1] - o.rise[0]) * this.rnd.next();
    this.vel[i * 3 + 2] = o.drift.z * (0.6 + this.rnd.next() * 0.8);
    this.age[i] = 0;
    this.life[i] = o.life[0] + (o.life[1] - o.life[0]) * this.rnd.next();
  }

  /** advance; intensity scales alpha (e.g. fade steam in cold wind) */
  update(dt: number, time: number, intensity = 1): void {
    const o = this.o;
    const n = o.count;
    const sw = o.swirl ?? 0.2;
    const tmp = this.tmpC;
    for (let i = 0; i < n; i++) {
      this.age[i]! += dt;
      if (this.age[i]! >= this.life[i]!) this.spawn(i);
      const t = this.age[i]! / this.life[i]!;
      const s = this.seedA[i]!;
      const x = this.pos.getX(i) + (this.vel[i * 3]! + Math.sin(time * 1.3 + s) * sw) * dt;
      const y = this.pos.getY(i) + this.vel[i * 3 + 1]! * dt * (1 - t * 0.5);
      const z = this.pos.getZ(i) + (this.vel[i * 3 + 2]! + Math.cos(time * 1.1 + s * 1.7) * sw) * dt;
      this.pos.setXYZ(i, x, y, z);
      this.size.setX(i, o.size[0] + (o.size[1] - o.size[0]) * Math.sqrt(t));
      const fade = Math.min(1, t * 5) * (1 - t) * (1 - t);
      this.alpha.setX(i, fade * o.alpha * intensity);
      tmp.copy(this.c0).lerp(this.c1, t);
      this.col.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    this.pos.needsUpdate = true;
    this.size.needsUpdate = true;
    this.alpha.needsUpdate = true;
    this.col.needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}

/** Static glow sprites (additive halos) at given points, with per-point flicker. */
export class Glows {
  readonly points: THREE.Points;
  private alpha: THREE.BufferAttribute;
  private base: Float32Array;
  readonly material: THREE.ShaderMaterial;
  constructor(pts: Array<{ p: THREE.Vector3; c: number; size: number; a?: number }>, map: THREE.Texture) {
    const n = pts.length;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const col = new Float32Array(n * 3);
    this.base = new Float32Array(n);
    const c = new THREE.Color();
    pts.forEach((q, i) => {
      pos[i * 3] = q.p.x;
      pos[i * 3 + 1] = q.p.y;
      pos[i * 3 + 2] = q.p.z;
      size[i] = q.size;
      c.setHex(q.c);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
      this.base[i] = q.a ?? 0.6;
    });
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    this.alpha = new THREE.BufferAttribute(new Float32Array(this.base), 1);
    g.setAttribute('aAlpha', this.alpha);
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uMap: { value: map }, uScale: { value: 400 } }]),
      vertexShader: PARTICLE_VS,
      fragmentShader: PARTICLE_FS,
      transparent: true,
      depthWrite: false,
      fog: true,
      blending: THREE.AdditiveBlending,
    });
    this.material.uniforms.uMap!.value = map;
    this.points = new THREE.Points(g, this.material);
    this.points.renderOrder = 6;
    this.points.onBeforeRender = (renderer, _s, camera) => {
      const h = renderer.getContext().drawingBufferHeight;
      const fov = (camera as THREE.PerspectiveCamera).fov ?? 50;
      this.material.uniforms.uScale!.value = h / (2 * Math.tan(((fov * Math.PI) / 180) / 2));
    };
    g.computeBoundingSphere();
  }
  update(time: number): void {
    const n = this.base.length;
    for (let i = 0; i < n; i++) {
      const f = 0.85 + 0.15 * Math.sin(time * (2 + (i % 5)) + i * 1.7);
      this.alpha.setX(i, this.base[i]! * f);
    }
    this.alpha.needsUpdate = true;
  }
  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}

/** Glowing turquoise hot-tub water with ripples, caustics and fresnel sky reflection. */
export function waterMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color(0x046a82) },
        uShallow: { value: new THREE.Color(0x22e0d4) },
        uSky: { value: new THREE.Color(0xdcecff) },
      },
    ]),
    fog: true,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSky;
      varying vec2 vUv;
      varying vec3 vWorld;
      #include <fog_pars_fragment>
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        float t = uTime;
        // ripple normal from a few travelling waves + jet rings
        vec2 g = vec2(0.0);
        g += vec2(cos(p.x * 9.0 + t * 1.7), cos(p.y * 8.0 - t * 1.4)) * 0.25;
        g += vec2(cos((p.x + p.y) * 15.0 - t * 2.3), cos((p.x - p.y) * 13.0 + t * 2.1)) * 0.12;
        vec2 j = p - vec2(0.45, -0.35);
        float jr = length(j);
        g += normalize(j + 1e-4) * cos(jr * 40.0 - t * 6.0) * 0.25 * exp(-jr * 3.0);
        vec3 n = normalize(vec3(g * 0.18, 1.0));
        float caust = abs(sin((p.x + g.y * 0.3) * 17.0 + t) * sin((p.y + g.x * 0.3) * 15.0 - t * 0.8));
        caust = pow(1.0 - caust, 6.0);
        vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 1.1, r));
        col += vec3(0.6, 1.0, 0.95) * caust * 0.35;
        // bubbles over the jet
        float bub = (1.0 - smoothstep(0.0, 0.35, jr)) * (0.5 + 0.5 * sin(t * 13.0 + jr * 30.0));
        col += vec3(0.8, 1.0, 1.0) * bub * 0.25;
        // fresnel sky reflection
        vec3 V = normalize(cameraPosition - vWorld);
        float fr = pow(1.0 - max(dot(n, V), 0.0), 4.0);
        col = mix(col * 1.3, uSky, fr * 0.45);
        // darker at the very edge (meniscus/shadow of the staves)
        col *= mix(1.0, 0.55, smoothstep(0.85, 1.0, r));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
}

/** Additive animated flame on crossed billboards. */
export function flameMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main() {
        float y = vUv.y;
        float x = (vUv.x - 0.5) * 2.0;
        float t = uTime;
        float turb = n(vec2(x * 3.0, y * 4.0 - t * 3.5)) * 0.6 + n(vec2(x * 7.0, y * 9.0 - t * 6.0)) * 0.4;
        x += (turb - 0.5) * 0.55 * y;
        float w = (1.0 - y) * 0.85 + 0.05;
        float body = (1.0 - smoothstep(w * 0.2, w, abs(x))) * (1.0 - smoothstep(0.25, 1.0, y + (turb - 0.5) * 0.5));
        body *= smoothstep(0.0, 0.08, y);
        vec3 core = vec3(1.0, 0.92, 0.6);
        vec3 mid = vec3(1.0, 0.5, 0.12);
        vec3 tip = vec3(0.8, 0.15, 0.03);
        vec3 col = mix(core, mid, smoothstep(0.1, 0.45, y + abs(x) * 0.5));
        col = mix(col, tip, smoothstep(0.45, 0.9, y));
        gl_FragColor = vec4(col * 1.25, clamp(body * 1.3, 0.0, 0.95));
        if (gl_FragColor.a < 0.01) discard;
      }
    `,
  });
}

/** Two-sided waving banner: front shows text toward -Z (uphill), back mirrored correctly. */
export class Banner {
  readonly group = new THREE.Group();
  private geos: THREE.PlaneGeometry[] = [];
  private base: Float32Array[] = [];
  private W: number;
  private H: number;
  constructor(W: number, H: number, mat: THREE.Material) {
    this.W = W;
    this.H = H;
    for (const side of [0, 1]) {
      const g = new THREE.PlaneGeometry(W, H, 72, 6);
      this.geos.push(g);
      this.base.push(new Float32Array((g.attributes.position as THREE.BufferAttribute).array));
      const m = new THREE.Mesh(g, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      // front faces -Z (toward arriving skier) => rotate PI; back faces +Z
      m.rotation.y = side === 0 ? Math.PI : 0;
      m.position.z = side === 0 ? -0.004 : 0.004;
      this.group.add(m);
    }
    this.update(0);
  }
  update(time: number): void {
    this.geos.forEach((g, side) => {
      const P = g.attributes.position as THREE.BufferAttribute;
      const B = this.base[side]!;
      for (let i = 0; i < P.count; i++) {
        const x0 = B[i * 3]!;
        const y0 = B[i * 3 + 1]!;
        const xw = side === 0 ? -x0 : x0; // world-consistent x
        const hang = (this.H / 2 - y0) / this.H; // 0 top .. 1 bottom
        const edge = 1 - Math.pow(Math.abs(xw) / (this.W / 2), 6);
        let d = Math.sin(xw * 0.33 + time * 2.1) * 0.1 + Math.sin(xw * 0.9 - time * 3.3) * 0.035;
        d *= (0.25 + hang * 0.9) * edge;
        P.setZ(i, side === 0 ? -d : d);
        P.setY(i, y0 - Math.abs(d) * 0.2 * hang);
      }
      P.needsUpdate = true;
      g.computeVertexNormals();
    });
  }
  dispose(): void {
    for (const g of this.geos) g.dispose();
  }
}
