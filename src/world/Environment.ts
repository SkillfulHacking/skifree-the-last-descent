/**
 * Sky, sun, image-based lighting, fog and ambient falling snow.
 * Art direction (alpine biome): clear winter day — warm low sun, cold blue skylight in the
 * shadows, soft haze. Every colour/intensity comes from the biome (src/world/biome.ts).
 */
import * as THREE from 'three';
import { weatherFx } from './look/weatherFx';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import type { QualityPreset } from '../core/types';
import { atmosphere } from './look/atmosphere';
import { DistantRanges } from './look/ranges';
import { getBiome, type Biome } from './biome';

/** the storm dome's tint over the fog colour at full storm (calibrated: see applyWeather) */
const STORM_DOME_TINT = [1.0, 1.45, 1.95] as const;
const smoothstepS = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b);

export class Environment {
  private domeTint = new THREE.Color();
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
  readonly ranges: DistantRanges;
  private hemiBase: number;
  private envBase: number;

  constructor(
    private scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    quality: QualityPreset,
    readonly biome: Biome = getBiome(),
  ) {
    const B = biome;
    const L = B.lighting;
    const A = B.atmosphere;
    this.sky = new Sky();
    this.sky.scale.setScalar(45000);
    const u = this.sky.material.uniforms;
    u['turbidity']!.value = B.sky.turbidity;
    u['rayleigh']!.value = B.sky.rayleigh;
    u['mieCoefficient']!.value = B.sky.mieCoefficient;
    u['mieDirectionalG']!.value = B.sky.mieDirectionalG;
    // alpine: low winter sun, from behind-left of the descending skier so faces read well
    const elevation = B.sky.sunElevation;
    const azimuth = B.sky.sunAzimuth;
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
    const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: L.envGround }));
    ground.position.y = -20;
    envScene.add(ground);
    this.envRT = pmrem.fromScene(envScene, 0.02);
    scene.environment = this.envRT.texture;
    this.envBase = L.envIntensity;
    scene.environmentIntensity = this.envBase;
    pmrem.dispose();
    skyClone.material.dispose();
    skyClone.geometry.dispose();
    ground.geometry.dispose();
    (ground.material as THREE.Material).dispose();

    this.sun = new THREE.DirectionalLight(new THREE.Color(...L.sunColor), L.sunIntensity);
    // the bases every weather / cinematic scaling is applied to: the location's own look, fixed for this
    // environment's life (W-031: captured lazily from the live, already-scaled values they compounded —
    // a second run's flakes grew to 3·10²⁶ m and whited out the screen)
    this.sunBase = L.sunIntensity;
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

    this.hemiBase = L.hemiIntensity;
    this.hemi = new THREE.HemisphereLight(new THREE.Color(...L.hemiSky), new THREE.Color(...L.hemiGround), this.hemiBase);
    scene.add(this.hemi);

    this.baseFogDensity = A.fogDensity;
    this.fog = new THREE.FogExp2(new THREE.Color(...A.fogColor), this.baseFogDensity);
    scene.fog = this.fog;
    atmosphere.uAtmSunDir.value.copy(this.sunDir);
    // the shared aerial-perspective model (module singletons) follows the biome too
    atmosphere.uFogColor.value.copy(this.fog.color);
    atmosphere.uFogExp.value = this.fog.density;
    atmosphere.uSunHaze.value.setRGB(...A.sunHaze);
    atmosphere.uFogLin.value = A.linear;
    atmosphere.uFogFalloff.value = A.falloff;
    this.falloffBase = A.falloff;
    this.fogClear.copy(this.fog.color);

    // distant skyline beyond the playable terrain + horizon haze (follows the viewer)
    this.ranges = new DistantRanges(this.sunDir, new THREE.Color(...L.sunColor), new THREE.Color(...B.ranges.skyColor), B.ranges);
    scene.add(this.ranges.group);

    // ambient drifting snow (a box of flakes around the camera)
    const W = B.weather;
    const count = Math.round({ low: 600, medium: 1400, high: 2400, ultra: 3600 }[quality] * W.flakeDensity);
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
    this.flakeBase = W.flakeSize;
    const flake = new THREE.PointsMaterial({ size: W.flakeSize, color: W.flakeColor, transparent: true, opacity: W.flakeOpacity, depthWrite: false, map: makeFlakeTexture(), sizeAttenuation: true });
    this.snow = new THREE.Points(g, flake);
    this.snow.frustumCulled = false;
    this.snow.name = 'env-snow';
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
    if (this.stormDome) {
      this.stormDome.position.copy(camPos);
      // just beyond where the storm's fog is saturated (≈ 2 / density), never further than 1.1 km
      this.stormDome.scale.setScalar(Math.min(1, Math.max(0.2, 2.4 / Math.max(1e-6, this.fog.density) / 1100)));
    }
    this.ranges.update(focus, camPos, dt);
    atmosphere.uFogColor.value.copy(this.fog.color);
    atmosphere.uFogExp.value = this.fog.density;

    const pos = this.snow.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const n = pos.count;
    // Reduce Weather Effects: the snow streams sideways less (motion), W-049
    const windMotion = 0.4 + 0.6 * weatherFx.scale;
    for (let i = 0; i < n; i++) {
      let x = arr[i * 3]!;
      let y = arr[i * 3 + 1]!;
      let z = arr[i * 3 + 2]!;
      y -= this.snowVel[i]! * dt;
      x += (Math.sin(time * 0.7 + i) * 0.4 + windX * 0.8 * windMotion) * dt;
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

  /** (diagnostics, W-031) the ambient snowfall and the storm bases this environment captured */
  debugSnow(cam: THREE.Vector3) {
    const m = this.snow.material as THREE.PointsMaterial;
    const a = this.snow.geometry.getAttribute('position').array as Float32Array;
    const d: number[] = [];
    let nan = 0;
    for (let i = 0; i < a.length; i += 3) {
      const v = Math.hypot(a[i]! - cam.x, a[i + 1]! - cam.y, a[i + 2]! - cam.z);
      if (Number.isFinite(v)) d.push(v);
      else nan++;
    }
    d.sort((x, y) => x - y);
    return { n: a.length / 3, nan, sun: this.sun.intensity, hemi: this.hemi.intensity, size: m.size, opacity: m.opacity, visible: this.snow.visible, flakeBase: this.flakeBase, sunBase: this.sunBase, falloffBase: this.falloffBase, storm: this.storm, snowfall: this.snowfall, dMin: d[0], d1: d[Math.floor(d.length * 0.01)], dMed: d[Math.floor(d.length / 2)], within2m: d.filter((x) => x < 2).length };
  }

  /** Scale sky/ambient light (1 = normal). Used by the cave reveal. */
  setAmbientScale(k: number) {
    this.ambientK = k;
    this.applyLight();
  }

  /** Scale the sun (1 = normal), composed with the storm's dimming. Used by the cave reveal. */
  setSunScale(k: number) {
    this.sunK = k;
    this.applyLight();
  }

  private ambientK = 1;
  private sunK = 1;
  private storm = 0;
  private readonly sunBase: number;
  private readonly fogClear = new THREE.Color();
  private readonly flakeBase: number;
  private readonly falloffBase: number;
  private stormDome: THREE.Mesh | null = null;

  /** storm (0..1) dims the sun and the sky light (Whiteout fronts); 0 leaves every light at its base */
  private applyLight() {
    const s = this.storm;
    // (W-039) inside a front the light goes flat: no sun to speak of, the sky light dimmed — the
    // whiteout's lost contrast (the trail markers and lamps stay bright: their own materials)
    this.hemi.intensity = this.hemiBase * this.ambientK * (1 - 0.3 * s);
    this.scene.environmentIntensity = this.envBase * this.ambientK * (1 - 0.45 * s);
    this.sun.intensity = this.sunBase * this.sunK * (1 - 0.92 * s);
  }

  /** Show/hide the ambient falling snow (hidden in the dark cave shots, where it reads as stars). */
  setFlakes(visible: boolean) {
    this.snow.visible = visible;
  }

  private fogBoost = 0;
  private weatherFog = 1;
  private snowfall = 1;

  setFogBoost(f: number) {
    this.fogBoost = f;
    this.fog.density = this.fogDensityFor(this.weatherFog, f);
  }

  /** the fog density for a weather visibility factor, under the biome's accessibility ceiling */
  private fogDensityFor(visibility: number, boost: number): number {
    const d = this.baseFogDensity * visibility * (1 + boost);
    const max = this.biome.atmosphere.maxFogDensity;
    return max !== undefined && boost === 0 ? Math.min(max, d) : d;
  }

  /**
   * Weather from the biome's WeatherModel (World.update, every frame): `visibility` × the base fog
   * density, `snowfall` × the base flake opacity. Alpine passes 1 and 1, which leaves both exactly
   * at their original values.
   */
  applyWeather(visibility: number, snowfall: number, storm = 0) {
    if (visibility !== this.weatherFog) {
      this.weatherFog = visibility;
      this.fog.density = this.fogDensityFor(visibility, this.fogBoost);
    }
    if (storm !== this.storm) {
      // (Pass 5, Whiteout) a front greys the air, hides the sky and the far ranges behind a dome of
      // storm cloud, thickens the driven snow and dims the sun; at 0 nothing changes
      // inside a front the fog is a uniform cloud: no thinning with height (else the slopes above the
      // camera show through the storm with a hard edge against the dome)
      atmosphere.uFogFalloff.value = this.falloffBase * (1 - storm);
      this.storm = storm;
      this.fog.color.copy(this.fogClear).lerp(STORM_GREY, 0.85 * storm);
      if (!this.stormDome && storm > 0) {
        const m = new THREE.MeshBasicMaterial({ color: this.fog.color.clone(), side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false, fog: false });
        this.stormDome = new THREE.Mesh(new THREE.SphereGeometry(1100, 24, 12), m);
        this.stormDome.renderOrder = 5;
        this.stormDome.name = 'storm-dome';
        this.stormDome.frustumCulled = false;
        this.scene.add(this.stormDome);
      }
      if (this.stormDome) {
        const m = this.stormDome.material as THREE.MeshBasicMaterial;
        // (round 3, R2 A N1) the dome must display as the fogged ground does at the horizon: the
        // same fog colour displays duller on the unlit dome than in the snow's fog under AgX, so it
        // takes a calibrated tint (tools/storm_horizon_probe.mjs, W2 storm peak: dome (188,202,214)
        // vs fogged bank (189,200,214) displayed; untinted (186,189,192)); opaque at full storm
        const k = THREE.MathUtils.smoothstep(storm, 0.2, 0.75);
        m.color.copy(this.fog.color).multiply(this.domeTint.setRGB(1 + (STORM_DOME_TINT[0] - 1) * k, 1 + (STORM_DOME_TINT[1] - 1) * k, 1 + (STORM_DOME_TINT[2] - 1) * k));
        m.opacity = Math.min(0.97, 1.15 * storm) + 0.03 * smoothstepS(0.7, 0.9, storm);
        this.stormDome.visible = storm > 0.002 && !this.stormDome.userData.debugHidden;
      }
      (this.snow.material as THREE.PointsMaterial).size = this.flakeBase * (1 + 1.3 * storm);
      this.applyLight();
    }
    if (snowfall !== this.snowfall) {
      this.snowfall = snowfall;
      const m = this.snow.material as THREE.PointsMaterial;
      m.opacity = this.biome.weather.flakeOpacity * Math.min(1, snowfall);
    }
  }

  dispose() {
    this.envRT?.dispose();
    this.sun.dispose(); // frees the shadow map render target
    this.snow.geometry.dispose();
    (this.snow.material as THREE.PointsMaterial).map?.dispose();
    (this.snow.material as THREE.Material).dispose();
    if (this.stormDome) {
      this.stormDome.geometry.dispose();
      (this.stormDome.material as THREE.Material).dispose();
      this.scene.remove(this.stormDome);
    }
    this.sky.geometry.dispose();
    this.sky.material.dispose();
    this.ranges.dispose();
    this.scene.remove(this.sky, this.sun, this.hemi, this.snow, this.ranges.group);
  }
}

/** the colour of the air inside a storm front: bright, flat, blue-grey */
const STORM_GREY = new THREE.Color(0.8, 0.83, 0.87);

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
