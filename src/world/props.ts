/**
 * Procedural prop geometry: snow-laden pines (detailed + far LOD), rocks, logs, stumps.
 * All geometry is merged per variant with baked vertex colours; instanced by Vegetation.
 */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rng, gnoise } from '../core/rng';

function colorize(g: THREE.BufferGeometry, fn: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  // indexed input keeps smooth shared normals; non-indexed stays faceted
  const ng = g;
  ng.computeVertexNormals();
  const pos = ng.getAttribute('position') as THREE.BufferAttribute;
  const nor = ng.getAttribute('normal') as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    const c = fn(p, n);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (ng.hasAttribute('uv')) ng.deleteAttribute('uv');
  return ng;
}

const SNOW = new THREE.Color(0.88, 0.9, 0.94);

/** A spruce/pine: trunk + irregular drooping branch tiers, snow on upper surfaces. */
export function pineGeometry(variant: number, detailed: boolean): THREE.BufferGeometry {
  const rng = new Rng(9001 + variant * 77);
  const parts: THREE.BufferGeometry[] = [];
  const height = 9 + variant * 0.8;
  const trunk = new THREE.CylinderGeometry(0.12, 0.32, height * 0.95, detailed ? 6 : 4, 1);
  trunk.translate(0, (height * 0.95) / 2, 0);
  parts.push(
    colorize(trunk, (p) => {
      const v = 0.75 + 0.25 * gnoise(p.y * 3, p.x * 9, 3);
      return new THREE.Color(0.2 * v, 0.14 * v, 0.1 * v);
    }),
  );
  const tiers = detailed ? 6 + (variant % 2) : 3;
  const baseR = 2.0 + variant * 0.25;
  for (let t = 0; t < tiers; t++) {
    const f = t / (tiers - 1);
    const y0 = height * (0.16 + f * 0.72);
    const r = baseR * (1 - f * 0.82) * rng.range(0.9, 1.08);
    const h = (height / tiers) * (detailed ? 1.9 : 1.6);
    const seg = detailed ? 10 : 6;
    const cone = new THREE.ConeGeometry(r, h, seg, detailed ? 2 : 1, true);
    // irregular, drooping branch tips: displace the rim
    const pos = cone.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const ang = Math.atan2(z, x);
      const rim = (h / 2 - y) / h; // 0 top .. 1 rim
      const jag = 1 + 0.22 * Math.sin(ang * (5 + t) + t * 1.7) * rim + 0.12 * gnoise(ang * 3, t * 5.3, variant) * rim;
      pos.setXYZ(i, x * jag, y - rim * rim * 0.35 * r, z * jag);
    }
    cone.translate(0, y0 + h / 2, 0);
    parts.push(
      colorize(cone, (p, n) => {
        const up = n.y;
        const g = 0.65 + 0.35 * gnoise(p.x * 2.1, p.z * 2.1 + p.y, variant + 5);
        const needle = new THREE.Color(0.05 * g, 0.16 * g, 0.1 * g);
        // snow load on upward faces, heavier on lower/outer tiers
        const snowAmt = THREE.MathUtils.smoothstep(up + 0.25 * gnoise(p.x * 4, p.z * 4, 11), 0.25, 0.6);
        return needle.lerp(SNOW, snowAmt * 0.92);
      }),
    );
    if (detailed) {
      // a snow pillow resting on the tier
      const cap = new THREE.ConeGeometry(r * 0.78, h * 0.34, seg, 1, true);
      const cp = cap.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < cp.count; i++) {
        const ang = Math.atan2(cp.getZ(i), cp.getX(i));
        const s = 1 + 0.18 * gnoise(ang * 2.5, t * 3.1, 17);
        cp.setXYZ(i, cp.getX(i) * s, cp.getY(i), cp.getZ(i) * s);
      }
      cap.translate(0, y0 + h * 0.62, 0);
      parts.push(colorize(cap, (_p, n) => SNOW.clone().multiplyScalar(n.y > 0 ? 1 : 0.8)));
    }
  }
  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error('merge failed');
  merged.computeBoundingSphere();
  return merged;
}

/** A craggy rock with snow on top. Unit size (~1 m radius). */
export function rockGeometry(variant: number, detailed: boolean, opts: { flatten?: number; snow?: number; detail?: number } = {}): THREE.BufferGeometry {
  const flatten = opts.flatten ?? 0.62;
  const snowAmt = opts.snow ?? 1;
  const ico = new THREE.IcosahedronGeometry(1, opts.detail ?? (detailed ? 2 : 1));
  ico.deleteAttribute('uv');
  ico.deleteAttribute('normal');
  // weld vertices so displacement stays watertight and normals are smooth
  const g = mergeVertices(ico);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = gnoise(v.x * 1.3 + variant * 3, v.z * 1.3 + v.y, 41 + variant) * 0.32 + gnoise(v.x * 3.5, v.y * 3.5 + v.z, 42) * 0.12 + gnoise(v.x * 8, v.y * 8 + v.z * 2, 43) * 0.04;
    v.multiplyScalar(1 + n);
    // facets
    v.y *= flatten;
    if (v.y < -0.1) v.y = -0.1 + (v.y + 0.1) * 0.3;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  return colorize(g, (p, n) => {
    const s = 0.5 + 0.5 * gnoise(p.x * 3, p.y * 6 + p.z * 3, 7 + variant) * (0.7 + 0.3 * gnoise(p.x * 11, p.z * 11, 3));
    const rock = new THREE.Color(0.26 * s, 0.25 * s, 0.24 * s);
    const snow = THREE.MathUtils.smoothstep(n.y + 0.2 * gnoise(p.x * 5, p.z * 5, 9), 0.45 + (1 - snowAmt) * 0.4, 0.75 + (1 - snowAmt) * 0.2) * snowAmt;
    return rock.lerp(SNOW, snow);
  });
}

export function logGeometry(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.28, 0.3, 1, 9, 4);
  g.rotateX(Math.PI / 2); // along Z (length 1, scaled by instance)
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    pos.setX(i, pos.getX(i) * (1 + 0.08 * Math.sin(z * 9)));
  }
  g.translate(0, 0.26, 0);
  return colorize(g, (p, n) => {
    const v = 0.7 + 0.3 * gnoise(p.z * 6, p.x * 8, 3);
    const bark = new THREE.Color(0.22 * v, 0.15 * v, 0.1 * v);
    return bark.lerp(SNOW, THREE.MathUtils.smoothstep(n.y, 0.55, 0.85));
  });
}

export function stumpGeometry(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.3, 0.38, 0.55, 9, 1);
  g.translate(0, 0.27, 0);
  return colorize(g, (_p, n) => (n.y > 0.8 ? SNOW.clone() : new THREE.Color(0.2, 0.14, 0.1)));
}

/** A storytelling prop: a snapped pine (broken trunk + fallen top). */
export function brokenTreeGeometry(): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.2, 0.3, 2.2, 7);
  trunk.translate(0, 1.1, 0);
  // splintered top
  const spl = new THREE.ConeGeometry(0.22, 0.6, 6, 1);
  spl.translate(0.03, 2.45, 0);
  const top = pineGeometry(0, false);
  top.rotateZ(Math.PI / 2 - 0.15);
  top.translate(0.3, 0.3, 0);
  const parts = [
    colorize(trunk, () => new THREE.Color(0.2, 0.14, 0.1)),
    colorize(spl, () => new THREE.Color(0.75, 0.62, 0.45)),
    top,
  ];
  const m = mergeGeometries(parts, false);
  if (!m) throw new Error('merge failed');
  return m;
}

/** Shared vegetation material with gentle wind sway (in the vertex shader, height-weighted). */
export function createFoliageMaterial(uTime: { value: number }, sway: boolean): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  if (sway) {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 ip = instanceMatrix[3].xyz;
#else
  vec3 ip = vec3(0.0);
#endif
  float hgt = max(0.0, position.y - 1.5);
  float w = sin(uTime * 1.3 + ip.x * 0.05 + ip.z * 0.07) * 0.5 + sin(uTime * 2.7 + ip.z * 0.13) * 0.25;
  transformed.x += hgt * hgt * 0.0025 * w;
  transformed.z += hgt * hgt * 0.0015 * w;`,
        );
    };
    mat.customProgramCacheKey = () => 'foliage-sway';
  }
  return mat;
}
