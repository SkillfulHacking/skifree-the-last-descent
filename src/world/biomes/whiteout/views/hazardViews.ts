/**
 * Whiteout Ridge hazard views (three.js):
 *  - `wind-drift`: a smooth wind-loaded mound draped on the snow, a sharp crest on its lee side and a
 *    plume of spindrift streaming off the crest in the wind (reads as "deep snow" from 100 m: brighter
 *    and smoother than the piste, with a shadowed lee face);
 *  - `blizzard`: a wall of driven snow. In the telegraph it is seen coming in from upwind (a dense
 *    band of streaking flakes and a pale curtain sweeping toward the line), active it fills the
 *    piste, then it blows through and thins out.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { weatherFx, WEATHER_FX_TELEGRAPH_FLOOR } from '../../../look/weatherFx';
import type { Mountain } from '../../../course';
import type { HazardInstance, HazardPhaseState } from '../../../hazards/hazard';
import { registerHazardView, type HazardView } from '../../../presentation/hazardViews';
import { makeFlakeTexture } from '../../../Environment';
import { ATMOSPHERE_GLSL, addAtmosphereUniforms, atmosphere } from '../../../look/atmosphere';
import { BLIZZARD, blizzardStrength, driftShape, type BlizzardParams, type DriftParams } from '../hazards';

const smoothstep01 = (x: number) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};
/** (round 6, W-105) blizzard curtain materials, reused (their program stays linked) */
const curtainPool: THREE.ShaderMaterial[] = [];
let shared: { drift: THREE.MeshStandardMaterial; plume: THREE.PointsMaterial; curtain: THREE.ShaderMaterial; flake: THREE.Texture } | null = null;

/**
 * W-008: a blizzard curtain is a soft sheet of driven snow — feathered on every edge, streaked along
 * the wind, thinning with distance like the fog — never a flat translucent rectangle.
 */
function curtainMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Color(0.9, 0.93, 0.97) } },
    // (Round 5, W-065 / A4-3: sheets laid along the course were seen edge-on from the chase camera — a
    // bright vertical column with a seam at the vanishing point, read as a rendering fault) each sheet is
    // an upright billboard turned to the camera about its own centre: from any view it is a soft mass of
    // driven snow, never a plane seen on edge
    vertexShader: `varying vec2 vUv; varying float vD;
      void main(){
        vUv = uv;
        vec3 c = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec2 tc = cameraPosition.xz - c.xz;
        vec2 f = length(tc) > 1e-3 ? normalize(tc) : vec2(0.0, 1.0);
        vec3 right = vec3(f.y, 0.0, -f.x);
        vec3 w = c + right * position.x + vec3(0.0, position.y, 0.0);
        vec4 mv = viewMatrix * vec4(w, 1.0);
        vD = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform float uOpacity; uniform float uTime; uniform vec3 uColor; varying vec2 vUv; varying float vD;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        float edge = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x) * smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.45, vUv.y);
        float streak = 0.55 + 0.45 * n(vec2(vUv.x * 7.0 - uTime * 0.9, vUv.y * 40.0));
        float billow = 0.6 + 0.4 * n(vec2(vUv.x * 3.0 - uTime * 0.25, vUv.y * 2.5 + 1.7));
        float near = smoothstep(2.0, 9.0, vD);
        // far sheets thin out with distance like the storm air itself (no bright wall at the horizon)
        float far = 1.0 - smoothstep(70.0, 170.0, vD);
        float a = uOpacity * edge * streak * billow * near * far;
        if (a < 0.003) discard;
        gl_FragColor = vec4(uColor, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
/**
 * Spindrift off a drift crest: the shared atmosphere (not three's scene fog, which tinted the far
 * plumes the warm horizon colour — "tan arcs" in the first renders).
 */
function plumeMaterial(flake: THREE.Texture): THREE.PointsMaterial {
  const m = new THREE.PointsMaterial({ size: 0.9, color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, map: flake, sizeAttenuation: true, fog: false });
  m.onBeforeCompile = (shader) => {
    addAtmosphereUniforms(shader.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvPW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vPW;\n${ATMOSPHERE_GLSL}`)
      .replace('#include <premultiplied_alpha_fragment>', 'gl_FragColor.rgb = sf_atmosphere(gl_FragColor.rgb, vPW);\n#include <premultiplied_alpha_fragment>');
  };
  m.customProgramCacheKey = () => 'whiteout-plume-v1';
  return m;
}

function mats() {
  if (shared) return shared;
  const flake = makeFlakeTexture();
  shared = {
    // fresh wind-loaded snow: brighter and smoother than the piste around it
    drift: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.97, 0.985, 1.0), roughness: 0.62, metalness: 0, vertexColors: true }),
    plume: plumeMaterial(flake),
    curtain: curtainMaterial(),
    flake,
  };
  return shared;
}

/**
 * A drift: an elongated wind-built mound across the fall line (gentle windward side, a sharp crest and
 * a steep lee), draped on the snow and shaded by the terrain's own snow material (W-008: with a plain
 * white material it read as a smooth grey berm), with sastrugi grooves cut along the wind and a plume
 * of spindrift off the crest.
 */
export function driftView(h: HazardInstance<DriftParams>, m: Mountain, terrainMat?: THREE.Material): HazardView {
  const M = mats();
  const obj = new THREE.Group();
  obj.name = 'wind-drift';
  // the same shape the physics reads (hazards.ts driftShape / driftProfile)
  const { L, W, H } = driftShape(h);
  const nu = 26;
  const nv = 14;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const c = Math.cos(h.rot);
  const s = Math.sin(h.rot);
  for (let j = 0; j <= nv; j++)
    for (let i = 0; i <= nu; i++) {
      const u = (i / nu) * 2 - 1; // along the drift (x)
      const v = (j / nv) * 2 - 1; // across it (z): −1 windward (uphill) … +1 lee
      const lx = u * L;
      const lz = v * W;
      const x = h.x + lx * c - lz * s;
      const z = h.z + lx * s + lz * c;
      // profile: long windward ramp, crest at v≈0.35, steep lee
      const across = v < 0.35 ? Math.pow(Math.max(0, (v + 1) / 1.35), 1.6) : Math.max(0, 1 - Math.pow((v - 0.35) / 0.65, 0.7));
      const along = Math.pow(Math.max(0, 1 - u * u), 0.8);
      // sastrugi: wind-cut grooves along the windward face, a few cm deep, wandering
      const groove = 0.07 * Math.sin(lz * 2.6 + 1.3 * Math.sin(lx * 0.35 + h.seed)) * across * (v < 0.35 ? 1 : 0.3);
      const ripple = 0.05 * Math.sin(lx * 1.7 + h.seed) * across;
      const y = H * across * along + ripple + groove;
      pos.push(x, m.heightAt(x, z) + y + 0.03, z);
      // the lee face sits in its own shadow (a touch bluer)
      const lee = v > 0.35 ? Math.min(1, (v - 0.35) * 2.2) * along : 0;
      col.push(1 - 0.3 * lee, 1 - 0.22 * lee, 1 - 0.06 * lee);
    }
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i;
      idx.push(a, a + nu + 1, a + 1, a + 1, a + nu + 1, a + nu + 2);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // fresh wind-loaded snow for the terrain shader: soft (powder) on the mound, none of the groomed look
  const surf = new Float32Array((pos.length / 3) * 3);
  for (let i = 0; i < pos.length / 3; i++) surf.set([0, 0.85, 0], i * 3);
  g.setAttribute('aSurf', new THREE.BufferAttribute(surf, 3));
  const mesh = new THREE.Mesh(g, terrainMat ?? M.drift);
  mesh.receiveShadow = true;
  obj.add(mesh);
  // spindrift off the crest
  const n = 70;
  const pp = new Float32Array(n * 3);
  const seedU = new Float32Array(n);
  const phase = new Float32Array(n);
  const jit = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    seedU[i] = (((h.seed * 31 + i * 977) % 1000) / 1000) * 2 - 1;
    // independent of u (a phase tied to the index lined the grains up into visible parabolas)
    phase[i] = (Math.sin(h.seed * 0.71 + i * 91.7) * 43758.5453) % 1;
    jit[i] = ((Math.sin(h.seed * 1.37 + i * 47.3) * 24634.6345) % 1) * 2;
  }
  // ground under each grain's crest track, sampled once (W-038): the grain slides along the crest by
  // jit·(0.6 … 2.4) m over its life, so the height is sampled at K points along that track and
  // interpolated, instead of querying the terrain for every grain every frame
  const crest0 = 0.35 * W;
  const K = 5;
  const base = new Float32Array(n * K);
  for (let i = 0; i < n; i++)
    for (let k = 0; k < K; k++) {
      const lx = seedU[i]! * L * 0.85 + jit[i]! * (0.6 + (1.8 * k) / (K - 1));
      base[i * K + k] = m.heightAt(h.x + lx * c - crest0 * s, h.z + lx * s + crest0 * c);
    }
  const groundAt = (i: number, life: number) => {
    const f = life * (K - 1);
    const k = Math.min(K - 2, Math.floor(f));
    const a = base[i * K + k]!;
    return a + (base[i * K + k + 1]! - a) * (f - k);
  };
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const plume = new THREE.Points(pg, M.plume);
  plume.frustumCulled = false;
  obj.add(plume);
  const crestZ = 0.35 * W;
  // (W-035) the row's gap is marked: an orange marker pole each side of it, on the lead mound of the
  // row, readable in a storm well beyond the fog that hides the mounds themselves (gapMarkerMaterial)
  const p = h.params;
  if (p.lead && p.gapX !== undefined && p.rowZ !== undefined) {
    for (const side of [-1, 1]) {
      const x = p.gapX + side * ((p.gapHalf ?? 6.5) + 0.6);
      const z = p.rowZ - 2;
      const pole = new THREE.Mesh(gapMarkerGeometry(), gapMarkerMaterial());
      pole.position.set(x, m.heightAt(x, z), z);
      pole.name = 'drift-gap-marker';
      obj.add(pole);
    }
  }
  return {
    object: obj,
    update(_ph: HazardPhaseState, t: number) {
      // the plume streams only when the wind is up (the surface-spindrift strength, 0..0.6)
      M.plume.opacity = 0.55 * smoothstep01(atmosphere.uDriftK.value / 0.6);
      plume.visible = M.plume.opacity > 0.02;
      if (!plume.visible) return; // nothing drawn: nothing to animate (W-038)
      for (let i = 0; i < n; i++) {
        const u = seedU[i]!;
        const life = (((t * 0.55 + Math.abs(phase[i]!)) % 1) + 1) % 1;
        const lx = u * L * 0.85 + jit[i]! * (0.6 + life * 1.8);
        const lz = crestZ + life * 6 + jit[i]! * 0.8;
        const x = h.x + lx * c - lz * s;
        const z = h.z + lx * s + lz * c;
        pp[i * 3] = x + life * 2.5;
        pp[i * 3 + 1] = groundAt(i, life) + H * Math.pow(Math.max(0, 1 - u * u), 0.8) + 0.2 + life * 1.4 - life * life * 1.6;
        pp[i * 3 + 2] = z;
      }
      (pg.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    },
    dispose() {
      g.dispose();
      pg.dispose();
    },
  };
}

let gapGeo: THREE.BufferGeometry | null = null;
/**
 * a 3 m marker pole with a 1.1 × 0.9 m panel at the top (shared): a gate panel big enough to read at
 * ~100 m in a storm at gameplay resolution (round 2 check: a slim flag was ~1 px there)
 */
function gapMarkerGeometry(): THREE.BufferGeometry {
  if (gapGeo) return gapGeo;
  const pole = new THREE.CylinderGeometry(0.09, 0.1, 3.0, 6);
  pole.translate(0, 1.5, 0);
  const flag = new THREE.BoxGeometry(1.1, 0.9, 0.05);
  flag.translate(0, 2.5, 0);
  const merged = mergeGeometries([pole.toNonIndexed(), flag.toNonIndexed()]);
  pole.dispose();
  flag.dispose();
  gapGeo = merged ?? new THREE.BufferGeometry();
  return gapGeo;
}
let gapMat: THREE.MeshBasicMaterial | null = null;
/**
 * Hi-vis orange that keeps 45% of its colour through the fog (a fluorescent marker against the
 * white): in a full storm the drift rows themselves fade out at ~60 m, the markers carry ~2× as far.
 */
export const GAP_MARKER_FOG_KEEP = 0.45;
function gapMarkerMaterial(): THREE.MeshBasicMaterial {
  if (gapMat) return gapMat;
  const m = new THREE.MeshBasicMaterial({ color: 0xff5a14 });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <fog_fragment>',
      `#ifdef USE_FOG
        #ifdef FOG_EXP2
          float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
        #else
          float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
        #endif
        gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor * ${(1 - GAP_MARKER_FOG_KEEP).toFixed(2)} );
      #endif`,
    );
  };
  m.customProgramCacheKey = () => 'drift-gap-marker';
  gapMat = m;
  return m;
}

/** A blizzard cell: streaking flakes in a box over the piste + pale curtains, driven by the cell's phase. */
function blizzardView(h: HazardInstance<BlizzardParams>, m: Mountain): HazardView {
  const M = mats();
  const obj = new THREE.Group();
  obj.name = 'blizzard';
  const dir = h.params.dir;
  const R = h.r + BLIZZARD.reach * 0.5;
  const n = 1400;
  const p = new Float32Array(n * 3);
  const base = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = ((i * 2654435761) >>> 0) / 4294967296;
    const b = ((i * 40503 + h.seed * 97) % 10007) / 10007;
    const c = ((i * 69069 + 12345) % 9973) / 9973;
    base[i * 3] = (a * 2 - 1) * R;
    base[i * 3 + 1] = b * 22;
    base[i * 3 + 2] = (c * 2 - 1) * R;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const flakeMat = new THREE.PointsMaterial({ size: 0.55, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, map: M.flake, sizeAttenuation: true });
  const pts = new THREE.Points(g, flakeMat);
  pts.frustumCulled = false;
  obj.add(pts);
  // pale curtains (vertical sheets across the fall line, swept along with the cell)
  const curtains: THREE.Mesh[] = [];
  // (round 6, W-105: disposing each blizzard's material released the program and the next blizzard re-linked
  // it mid-run) materials are pooled, not disposed
  const cm = curtainPool.pop() ?? M.curtain.clone();
  // (Round 5) camera-facing sheets scattered through the cell (see curtainMaterial): position, size
  const NS = 8;
  const slot: Array<{ dx: number; dz: number; w: number; hgt: number }> = [];
  for (let k = 0; k < NS; k++) {
    const a = ((k * 2654435761 + h.seed * 7) >>> 0) / 4294967296;
    const b = ((k * 40503 + h.seed * 131) % 10007) / 10007;
    const c = ((k * 69069 + h.seed * 17) % 9973) / 9973;
    slot.push({ dx: (a * 2 - 1) * R * 0.75, dz: (b * 2 - 1) * R * 0.75, w: R * (0.7 + 0.5 * c), hgt: 15 + 7 * b });
  }
  for (let k = 0; k < NS; k++) {
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(slot[k]!.w, slot[k]!.hgt, 1, 1), cm);
    sheet.frustumCulled = false;
    curtains.push(sheet);
    obj.add(sheet);
  }
  const ground = m.heightAt(h.x, h.z);
  return {
    object: obj,
    update(ph: HazardPhaseState, t: number) {
      const w = blizzardStrength(ph.phase, ph.u);
      // the cell's centre sweeps across the piste: from far upwind in the telegraph to over the line
      // when active, then on downwind as it blows through
      const off = ph.phase === 'telegraph' ? -dir * (1 - ph.u) * 110 : ph.phase === 'recovery' ? dir * ph.u * 70 : ph.phase === 'dormant' ? -dir * 110 : 0;
      const cx = h.x + off;
      const visible = ph.phase !== 'dormant' && w > 0.005;
      obj.visible = visible || ph.phase === 'telegraph';
      if (!obj.visible) return;
      // (Reduce Weather Effects thins the wall, never below WEATHER_FX_TELEGRAPH_FLOOR of it: the cue stays)
      flakeMat.opacity = Math.min(0.95, 0.25 + 0.9 * Math.max(w, ph.phase === 'telegraph' ? 0.35 * ph.u : 0)) * Math.max(WEATHER_FX_TELEGRAPH_FLOOR, weatherFx.scale);
      const speed = 16;
      for (let i = 0; i < n; i++) {
        let x = base[i * 3]! + dir * ((t * speed + i * 0.73) % (2 * R));
        if (x > R) x -= 2 * R;
        if (x < -R) x += 2 * R;
        const z = base[i * 3 + 2]!;
        const y = base[i * 3 + 1]! - ((t * 3.5 + i * 0.31) % 22);
        p[i * 3] = cx + x;
        p[i * 3 + 1] = ground + (y < 0 ? y + 22 : y) - 1;
        p[i * 3 + 2] = h.z + z;
      }
      (g.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      cm.uniforms.uOpacity!.value = 0.2 * Math.max(w, ph.phase === 'telegraph' ? 0.6 * ph.u : 0);
      cm.uniforms.uTime!.value = t;
      curtains.forEach((sh, k) => {
        const s = slot[k]!;
        sh.position.set(cx + s.dx + dir * ((t * 9 + k * 13) % 24) - dir * 12, ground + s.hgt * 0.42, h.z + s.dz);
      });
    },
    dispose() {
      g.dispose();
      flakeMat.dispose();
      cm.uniforms.uOpacity!.value = 0;
      curtainPool.push(cm);
      curtains.forEach((sh) => sh.geometry.dispose());
    },
  };
}

registerHazardView('wind-drift', (h, ctx) => driftView(h as HazardInstance<DriftParams>, ctx.mountain, ctx.terrainMaterial));
registerHazardView('blizzard', (h, ctx) => blizzardView(h as HazardInstance<BlizzardParams>, ctx.mountain));
