/**
 * Sky, sun, image-based lighting, fog and ambient falling snow.
 * Art direction: clear winter day — warm low sun, cold blue skylight in the shadows, soft haze.
 */
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import type { QualityPreset } from '../core/types';

export class Environment {
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly sky: Sky;
  readonly sunDir = new THREE.Vector3();
  private snow: THREE.Points;
  private snowVel: Float32Array;
  readonly fog: THREE.FogExp2;
  private shadowSize: number;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private baseFogDensity: number;

  constructor(
    private scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    quality: QualityPreset,
  ) {
    this.sky = new Sky();
    this.sky.scale.setScalar(45000);
    const u = this.sky.material.uniforms;
    u['turbidity']!.value = 3.2;
    u['rayleigh']!.value = 1.15;
    u['mieCoefficient']!.value = 0.004;
    u['mieDirectionalG']!.value = 0.82;
    // low winter sun, from behind-left of the descending skier so faces read well
    const elevation = 24;
    const azimuth = 205;
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    this.sunDir.setFromSphericalCoords(1, phi, theta);
    u['sunPosition']!.value.copy(this.sunDir);
    scene.add(this.sky);

    // IBL from the sky (cold blue skylight in shadows)
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const skyClone = new Sky();
    skyClone.scale.setScalar(1000);
    const cu = skyClone.material.uniforms;
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) cu[k]!.value = u[k]!.value;
    cu['sunPosition']!.value.copy(this.sunDir);
    envScene.add(skyClone);
    // white snowy ground bounce in the environment
    const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8c96a6 }));
    ground.position.y = -20;
    envScene.add(ground);
    this.envRT = pmrem.fromScene(envScene, 0.02);
    scene.environment = this.envRT.texture;
    scene.environmentIntensity = 0.3;
    pmrem.dispose();
    skyClone.material.dispose();
    skyClone.geometry.dispose();
    ground.geometry.dispose();
    (ground.material as THREE.Material).dispose();

    this.sun = new THREE.DirectionalLight(new THREE.Color(1.0, 0.86, 0.7), 4.2);
    this.sun.castShadow = true;
    const mapSize = { low: 1024, medium: 2048, high: 2048, ultra: 4096 }[quality];
    this.shadowSize = { low: 70, medium: 90, high: 110, ultra: 130 }[quality];
    this.sun.shadow.mapSize.set(mapSize, mapSize);
    const cam = this.sun.shadow.camera;
    cam.left = -this.shadowSize / 2;
    cam.right = this.shadowSize / 2;
    cam.top = this.shadowSize / 2;
    cam.bottom = -this.shadowSize / 2;
    cam.near = 1;
    cam.far = 600;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.radius = 3;
    scene.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight(new THREE.Color(0.42, 0.56, 0.95), new THREE.Color(0.6, 0.64, 0.72), 0.25);
    scene.add(this.hemi);

    this.baseFogDensity = 0.00036;
    this.fog = new THREE.FogExp2(new THREE.Color(0.72, 0.8, 0.9), this.baseFogDensity);
    scene.fog = this.fog;

    // ambient drifting snow (a box of flakes around the camera)
    const count = { low: 600, medium: 1400, high: 2400, ultra: 3600 }[quality];
    const pos = new Float32Array(count * 3);
    this.snowVel = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = Math.random() * 30;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
      this.snowVel[i] = 0.6 + Math.random() * 0.8;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const flake = new THREE.PointsMaterial({ size: 0.09, color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false, map: makeFlakeTexture(), sizeAttenuation: true });
    this.snow = new THREE.Points(g, flake);
    this.snow.frustumCulled = false;
    scene.add(this.snow);
  }

  /** Keep the shadow frustum centred on the action; snap to texels to avoid shimmering. */
  update(dt: number, focus: THREE.Vector3, camPos: THREE.Vector3, time: number, windX = 1) {
    const d = 260;
    const texel = this.shadowSize / this.sun.shadow.mapSize.x;
    const fx = Math.round(focus.x / texel) * texel;
    const fy = Math.round(focus.y / texel) * texel;
    const fz = Math.round(focus.z / texel) * texel;
    this.sun.target.position.set(fx, fy, fz);
    this.sun.position.set(fx + this.sunDir.x * d, fy + this.sunDir.y * d, fz + this.sunDir.z * d);
    this.sun.target.updateMatrixWorld();
    // the sky dome is finite (45 km): keep it centred on the viewer for any course length
    this.sky.position.copy(camPos);

    const pos = this.snow.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const n = pos.count;
    for (let i = 0; i < n; i++) {
      let x = arr[i * 3]!;
      let y = arr[i * 3 + 1]!;
      let z = arr[i * 3 + 2]!;
      y -= this.snowVel[i]! * dt;
      x += (Math.sin(time * 0.7 + i) * 0.4 + windX * 0.8) * dt;
      z += Math.cos(time * 0.5 + i * 1.3) * 0.3 * dt;
      // world-locked flakes, wrapped into a box around the camera (they stream past at speed)
      const cx = camPos.x, cy = camPos.y, cz = camPos.z;
      if (y < cy - 12) y += 30;
      if (y > cy + 18) y -= 30;
      if (x < cx - 30) x += 60;
      if (x > cx + 30) x -= 60;
      if (z < cz - 30) z += 60;
      if (z > cz + 30) z -= 60;
      arr[i * 3] = x;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = z;
    }
    pos.needsUpdate = true;
  }

  /** Scale sky/ambient light (1 = normal). Used by the cave reveal. */
  setAmbientScale(k: number) {
    this.hemi.intensity = 0.25 * k;
    this.scene.environmentIntensity = 0.3 * k;
  }

  setFogBoost(f: number) {
    this.fog.density = this.baseFogDensity * (1 + f);
  }

  dispose() {
    this.envRT?.dispose();
    this.sun.dispose(); // frees the shadow map render target
    this.snow.geometry.dispose();
    (this.snow.material as THREE.PointsMaterial).map?.dispose();
    (this.snow.material as THREE.Material).dispose();
    this.sky.geometry.dispose();
    this.sky.material.dispose();
    this.scene.remove(this.sky, this.sun, this.hemi, this.snow);
  }
}

export function makeFlakeTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
