/**
 * Ski tracks: two ring-buffered ribbons that follow the ski tails, lifted slightly above the snow,
 * broken while airborne. Rendered as a soft shaded groove (darker edges, lighter compressed centre).
 */
import * as THREE from 'three';

const SEG = 900; // segments per ribbon

class Ribbon {
  readonly mesh: THREE.Mesh;
  private pos: Float32Array;
  private alpha: Float32Array;
  private uvs: Float32Array;
  private head = 0;
  private last = new THREE.Vector3(1e9, 0, 0);
  private hasLast = false;
  private geo: THREE.BufferGeometry;

  constructor(mat: THREE.Material, private width: number) {
    this.pos = new Float32Array(SEG * 4 * 3);
    this.alpha = new Float32Array(SEG * 4);
    this.uvs = new Float32Array(SEG * 4 * 2);
    const idx = new Uint32Array(SEG * 6);
    for (let s = 0; s < SEG; s++) {
      const b = s * 4;
      idx.set([b, b + 2, b + 1, b + 1, b + 2, b + 3], s * 6);
      this.uvs.set([0, 0, 1, 0, 0, 1, 1, 1], s * 8);
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(this.uvs, 2));
    this.geo.setIndex(new THREE.BufferAttribute(idx, 1));
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  /** Add a point. `on` false breaks the ribbon (airborne). depth 0..1 = how deep the groove looks. */
  add(p: THREE.Vector3, right: THREE.Vector3, on: boolean, depth: number) {
    if (!on) {
      this.hasLast = false;
      return;
    }
    if (this.hasLast && p.distanceToSquared(this.last) < 0.35 * 0.35) return;
    if (this.hasLast && p.distanceToSquared(this.last) > 9) this.hasLast = false;
    if (this.hasLast) {
      const s = this.head;
      this.head = (this.head + 1) % SEG;
      const w = this.width * (0.8 + depth * 0.6);
      const o = s * 12;
      const lift = 0.025;
      // quad from last → p
      this.pos[o] = this.last.x - right.x * w;
      this.pos[o + 1] = this.last.y + lift;
      this.pos[o + 2] = this.last.z - right.z * w;
      this.pos[o + 3] = this.last.x + right.x * w;
      this.pos[o + 4] = this.last.y + lift;
      this.pos[o + 5] = this.last.z + right.z * w;
      this.pos[o + 6] = p.x - right.x * w;
      this.pos[o + 7] = p.y + lift;
      this.pos[o + 8] = p.z - right.z * w;
      this.pos[o + 9] = p.x + right.x * w;
      this.pos[o + 10] = p.y + lift;
      this.pos[o + 11] = p.z + right.z * w;
      const a = 0.25 + 0.55 * depth;
      this.alpha.fill(a, s * 4, s * 4 + 4);
      (this.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (this.geo.getAttribute('aAlpha') as THREE.BufferAttribute).needsUpdate = true;
    }
    this.last.copy(p);
    this.hasLast = true;
  }

  clear() {
    this.alpha.fill(0);
    this.pos.fill(0);
    this.hasLast = false;
    (this.geo.getAttribute('aAlpha') as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose() {
    this.geo.dispose();
  }
}

export class SkiTracks {
  readonly group = new THREE.Group();
  private left: Ribbon;
  private right: Ribbon;
  private mat: THREE.ShaderMaterial;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      uniforms: { fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aAlpha; varying float vA; varying vec2 vUv; varying float vD;
        void main(){ vA = aAlpha; vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.0); vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: /* glsl */ `
        uniform vec3 fogColor; uniform float fogDensity;
        varying float vA; varying vec2 vUv; varying float vD;
        void main(){
          float x = abs(vUv.x - 0.5) * 2.0;
          // groove: shaded walls, compressed (slightly shiny) base
          float wall = smoothstep(0.35, 0.85, x) * (1.0 - smoothstep(0.85, 1.0, x));
          vec3 c = mix(vec3(0.70, 0.76, 0.86), vec3(0.52, 0.60, 0.74), wall);
          float a = vA * (1.0 - smoothstep(0.9, 1.0, x)) * (1.0 - smoothstep(60.0, 160.0, vD));
          float f = 1.0 - exp(-fogDensity*fogDensity*vD*vD);
          gl_FragColor = vec4(mix(c, fogColor, f), a * 0.55);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.left = new Ribbon(this.mat, 0.07);
    this.right = new Ribbon(this.mat, 0.07);
    this.group.add(this.left.mesh, this.right.mesh);
  }

  setFog(color: THREE.Color, density: number) {
    (this.mat.uniforms.fogColor!.value as THREE.Color).copy(color);
    this.mat.uniforms.fogDensity!.value = density;
  }

  add(l: THREE.Vector3, r: THREE.Vector3, rightDir: THREE.Vector3, grounded: boolean, depth: number) {
    this.left.add(l, rightDir, grounded, depth);
    this.right.add(r, rightDir, grounded, depth);
  }

  clear() {
    this.left.clear();
    this.right.clear();
  }

  dispose() {
    this.left.dispose();
    this.right.dispose();
    this.mat.dispose();
  }
}
