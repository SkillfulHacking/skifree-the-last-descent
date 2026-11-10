/**
 * "fjord-sea-cave" dressing around the shared Yeti cave (round 2, art review D5 / cinematic 1–2,
 * critic 5/8). The cave geometry contract is untouched (terrain cut, rock shell, floor, anchors,
 * clearance bake): the Yeti's emergence and grounding are exactly as everywhere else. What changes:
 *
 *  - the cave's own rock reads as sea-worn columnar basalt, not the Alpine strata tinted: the shared
 *    rock material gets a Fjord pass (hexagonal column jointing in plan, cross-joints, near-black
 *    wet rock low down, salt/rime crust and ochre lichen higher up) — a material change only;
 *  - real basalt columns either side of the mouth: individually built hexagonal prisms with
 *    chamfered tops, cross-joints and weathering in their own shader, seated in the snow (bases
 *    sunk below the lowest ground under them) and stepping down like a giant's staircase; snow
 *    cushions sit exactly on each top;
 *  - a frozen tide pool on the cave floor at the mouth (dark green-blue sea ice with white cracks
 *    and a slushy rim, flush with the floor) and a heap of broken sea-ice plates beside the mouth;
 *  - wreckage that makes sense for a beachcombing Yeti: an overturned, staved-in clinker rowing boat
 *    on its gunwale against the columns, a broken spar, silver driftwood, lobster pots, a torn net
 *    draped over a column step (not floating), floats on a grounded line, fish bones;
 *  - an irregular icicle fringe (clusters, a few long ones, gaps), not a comb.
 *
 * Every prop keeps clear of the Yeti's exit path and ledge AND of the shared cave-cinematic camera
 * sight lines (CaveCinematic.caveCameraSightlines); placements are recorded in `userData.props`
 * so tests can check the clearance. The dressing also exposes perches (column tops) for the
 * Fjord cave-cinematic beats (./seaCaveCinematic.ts).
 */
import * as THREE from 'three';
import type { CaveDressing, CaveDressingContext } from '../../../presentation/cave';
import { Batch, Rand, mat } from '../../../resort/util';
import { kitMaterials } from './buildings';
import { caveCameraSightlines } from '../../../../cinematic/CaveCinematic';

/** distance from p to the segment ab */
function segDist(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
  const ab = b.clone().sub(a);
  const t = Math.min(1, Math.max(0, p.clone().sub(a).dot(ab) / Math.max(1e-6, ab.lengthSq())));
  return p.distanceTo(a.clone().addScaledVector(ab, t));
}

/** camera clearance used by the dressing (and its test): props stay this far outside every lens */
export const CAVE_CAM_CLEARANCE = 1.6;

/**
 * True when a prop (bounding sphere at p, radius r) is clear of every shared cave-cinematic sight
 * line: at least r + CAVE_CAM_CLEARANCE from each camera→subject segment (the part of the line
 * nearer than 14 m to the camera, where a prop would fill the frame) and r + 3 m from each camera.
 */
export function clearOfCaveCameras(lines: Array<{ cam: THREE.Vector3; look: THREE.Vector3 }>, p: THREE.Vector3, r: number): boolean {
  for (const l of lines) {
    if (p.distanceTo(l.cam) < r + 3) return false;
    const dir = l.look.clone().sub(l.cam);
    const len = Math.min(14, dir.length());
    const end = l.cam.clone().addScaledVector(dir.normalize(), len);
    // the frame widens with distance: ~0.35 m per metre at these FOVs, capped
    const along = Math.min(len, Math.max(0, p.clone().sub(l.cam).dot(dir)));
    const widen = Math.min(3, along * 0.18);
    if (segDist(p, l.cam, end) < r + CAVE_CAM_CLEARANCE + widen) return false;
  }
  return true;
}

/** basalt column material: per-column tone (vertex colour), cross-joints and weathering by height */
function basaltMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.02 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aJ;\nvarying vec3 vJ;\nvarying vec3 vBN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvJ = aJ;\nvBN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vJ;\nvarying vec3 vBN;\nfloat bs_h(float n){ return fract(sin(n) * 43758.5453); }')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  // vJ = (column seed, height above the snow, column height)
  float seed = vJ.x;
  float y = vJ.y;
  float side = 1.0 - abs(normalize(vBN).y);
  // cross-joints: irregular spacing per column (0.5–1.1 m), slightly wavy; anti-aliased (they
  // fade out once a joint is about a pixel wide, so distant columns do not sparkle)
  float sp = 0.5 + 0.6 * bs_h(seed * 3.1);
  float q = y / sp + bs_h(seed * 7.7) + 0.06 * sin(y * 3.7 + seed);
  float fq = fwidth(q);
  float d = abs(fract(q) - 0.5);
  float joint = smoothstep(0.5 - 0.06 - fq, 0.5 - fq * 0.5, d) * (1.0 - smoothstep(0.15, 0.4, fq));
  diffuseColor.rgb *= 1.0 - 0.6 * joint * side;
  // per-drum tone (each section between joints a little different), wet near-black low down
  float drum = bs_h(floor(q) * 1.31 + seed);
  diffuseColor.rgb *= mix(1.0, 0.82 + 0.36 * drum, 1.0 - smoothstep(0.15, 0.4, fq));
  float wet = 1.0 - smoothstep(0.0, 1.8, y);
  diffuseColor.rgb *= 1.0 - 0.4 * wet;
  // salt rime streaks on a few drums, ochre lichen on a few higher ones
  float rime = step(0.82, drum) * smoothstep(1.0, 2.5, y) * side;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.46, 0.5), rime * 0.3);
  float lichen = step(0.9, bs_h(floor(q) * 1.7 + floor(seed * 13.0))) * smoothstep(2.0, 4.0, y);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.36, 0.27, 0.08), lichen * 0.45);
}`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.28, 1.0 - smoothstep(0.0, 1.4, vJ.y));');
  };
  m.customProgramCacheKey = () => 'fjord-basalt-v1';
  return m;
}

/** The Fjord pass on the shared cave rock material: sea-worn columnar basalt (material only). */
function basaltCaveRock(cave: CaveDressingContext['cave']): void {
  const rock = cave.group.getObjectByName('cave-rock') as THREE.Mesh | undefined;
  const m = rock?.material as THREE.MeshStandardMaterial | undefined;
  if (!m || m.userData['fjordBasalt']) return;
  m.userData['fjordBasalt'] = true;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    sh.fragmentShader = sh.fragmentShader.replace(
      '  // --- floor: compacted rubble and grit',
      `  {
    // Fjord: columnar basalt — hexagonal joints in plan (columns ~1 m across), cross-joints along
    // them, near-black and wet low down, salt crust and lichen higher up
    vec2 hp = ap.xz / 0.95;
    vec2 hs = vec2(1.0, 1.7320508);
    vec4 hC = floor(vec4(hp, hp - vec2(0.5, 1.0)) / hs.xyxy) + 0.5;
    vec4 hh = vec4(hp - hC.xy * hs, hp - (hC.zw + 0.5) * hs);
    vec4 hc = dot(hh.xy, hh.xy) < dot(hh.zw, hh.zw) ? vec4(hh.xy, hC.xy) : vec4(hh.zw, hC.zw + 0.5);
    vec2 ha = abs(hc.xy);
    float he = 0.5 - max(dot(ha, hs * 0.5), ha.x);
    float hid = fract(sin(dot(hc.zw, vec2(12.9898, 78.233))) * 43758.5453);
    vec3 bas = vec3(0.04, 0.043, 0.05) * (0.8 + 0.4 * hid);
    float cj = abs(fract(ap.y / (0.55 + 0.5 * hid) + hid) - 0.5);
    // column joints read as vertical seams on steep faces only (on gentler surfaces a plan-view
    // hexagon grid would read as tiles)
    float colFace = smoothstep(0.55, 0.85, steep) * (1.0 - smoothstep(14.0, 45.0, cv_dist));
    bas *= 1.0 - 0.45 * (1.0 - smoothstep(0.0, 0.045, he)) * colFace - 0.3 * (1.0 - smoothstep(0.44, 0.5, 0.5 - cj)) * colFace;
    float salt = smoothstep(0.6, 0.85, cv_n3(vec3(ap.x * 0.6, ap.y * 1.4, ap.z * 0.6) + 11.0)) * steep;
    bas = mix(bas, vec3(0.5, 0.53, 0.56), salt * 0.3);
    rock = mix(rock, bas, 0.88);
  }
  // --- floor: compacted rubble and grit`,
    );
  };
  const key = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => (key ? key() : '') + '|fjord-basalt';
  m.needsUpdate = true;
}

function netTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 128, 128);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 3;
  for (let i = -128; i < 256; i += 16) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 128, 128);
    g.stroke();
    g.beginPath();
    g.moveTo(i + 128, 0);
    g.lineTo(i, 128);
    g.stroke();
  }
  g.clearRect(70, 40, 34, 30);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 2);
  return t;
}

/** sea ice: dark green-blue with white pressure cracks and trapped bubbles (shared, small) */
function iceTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grd.addColorStop(0, '#0f2a30');
  grd.addColorStop(0.7, '#1a3f47');
  grd.addColorStop(1, '#8fb0b8');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const r = new Rand(77);
  g.strokeStyle = 'rgba(235,245,250,0.75)';
  for (let i = 0; i < 14; i++) {
    g.lineWidth = r.range(0.6, 2.2);
    g.beginPath();
    let x = r.range(30, 226);
    let y = r.range(30, 226);
    g.moveTo(x, y);
    for (let k = 0; k < 7; k++) {
      x += r.range(-28, 28);
      y += r.range(-28, 28);
      g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 80; i++) {
    g.fillStyle = `rgba(230,245,250,${r.range(0.15, 0.5)})`;
    g.beginPath();
    g.arc(r.range(20, 236), r.range(20, 236), r.range(0.8, 3), 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface SeaCavePerch {
  p: THREE.Vector3;
}

export function dressSeaCave(c: CaveDressingContext): CaveDressing {
  const { cave, mountain: m } = c;
  const hi = c.quality === 'high' || c.quality === 'ultra';
  const group = new THREE.Group();
  group.name = 'FjordSeaCave';
  const rnd = new Rand(31337 + Math.round(c.anchor.z));
  const K = kitMaterials();
  const basalt = basaltMaterial();
  const ice = new THREE.MeshPhysicalMaterial({ color: 0xd8ecff, roughness: 0.06, transparent: true, opacity: 0.88, emissive: 0x16304a, emissiveIntensity: 0.22, clearcoat: 1 });
  const net = new THREE.MeshStandardMaterial({ color: 0x3f5f4a, roughness: 0.9, side: THREE.DoubleSide, alphaTest: 0.4 });
  const drift = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const iceTex = iceTexture();
  const seaIce = new THREE.MeshPhysicalMaterial({ map: iceTex, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const plates = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0 });
  const M: Record<string, THREE.Material> = { ...K, basalt, ice, drift, plates };
  const b = new Batch();
  const out = cave.outward.clone().setY(0).normalize();
  const tan = new THREE.Vector3(out.z, 0, -out.x);
  const mouth = cave.mouth;
  const lines = caveCameraSightlines(cave.mouth, cave.outward, cave.lipTop);
  const props: Array<{ p: THREE.Vector3; r: number; kind: string }> = [];
  const perches: SeaCavePerch[] = [];
  const clearOfPath = (x: number, z: number, r: number) => cave.exitPath.every((p) => Math.hypot(p.x - x, p.z - z) > r + 4.5) && Math.hypot(cave.ledge.x - x, cave.ledge.z - z) > r + 5;
  /** the full placement test: path, ledge and every cinematic lens (prop centre p, radius r) */
  const ok = (p: THREE.Vector3, r: number) => clearOfPath(p.x, p.z, r) && clearOfCaveCameras(lines, p, r);
  const place = (along: number, back: number) => {
    const x = mouth.x + tan.x * along - out.x * back;
    const z = mouth.z + tan.z * along - out.z * back;
    return new THREE.Vector3(x, m.heightAt(x, z), z);
  };
  basaltCaveRock(cave);

  // ---------------- basalt columns ----------------
  const colPos: number[] = [];
  const colCol: number[] = [];
  const colJ: number[] = [];
  const addColumn = (p: THREE.Vector3, R: number, h: number, seed: number) => {
    // seat: base sunk below the lowest ground under the footprint
    let gy = Infinity;
    for (let k = 0; k < 6; k++) gy = Math.min(gy, m.heightAt(p.x + Math.cos(k) * R, p.z + Math.sin(k) * R));
    const base = gy - 0.6;
    const topY = Math.max(p.y, gy) + h;
    const centre = new THREE.Vector3(p.x, (base + topY) / 2, p.z);
    const rad = Math.max(R, (topY - base) / 2);
    if (!ok(centre, rad)) return;
    const g = new THREE.CylinderGeometry(R * 0.985, R, topY - base, 6, 1);
    // chamfer the top rim slightly (a bevel ring)
    const P = g.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < P.count; k++) if (P.getY(k) > 0) P.setXYZ(k, P.getX(k) * 0.97, P.getY(k), P.getZ(k) * 0.97);
    // flat faces toward the neighbours along the row
    g.rotateY(Math.atan2(tan.x, tan.z));
    g.translate(p.x, (base + topY) / 2, p.z);
    const ng = g.toNonIndexed();
    g.dispose();
    ng.computeVertexNormals();
    const NP = ng.attributes.position as THREE.BufferAttribute;
    const tone = 0.03 + 0.022 * ((seed * 7.31) % 1);
    for (let k = 0; k < NP.count; k++) {
      colPos.push(NP.getX(k), NP.getY(k), NP.getZ(k));
      colCol.push(tone, tone * 1.04, tone * 1.13);
      colJ.push(seed, NP.getY(k) - gy, topY - gy);
    }
    ng.dispose();
    // snow cushion seated exactly on the top (a flattened dome of the same hexagon)
    const cap = new THREE.CylinderGeometry(R * 0.9, R * 0.95, 0.22, 6, 1);
    cap.rotateY(Math.atan2(tan.x, tan.z));
    b.add('snow', cap, mat(p.x, topY + 0.1, p.z), 0xffffff);
    b.add('snow', new THREE.SphereGeometry(R * 0.78, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.22, 1), mat(p.x, topY + 0.19, p.z), 0xffffff);
    perches.push({ p: new THREE.Vector3(p.x, topY + 0.3, p.z) });
    props.push({ p: centre, r: rad, kind: 'column' });
  };
  for (const s of [-1, 1]) {
    const rows = hi ? 5 : 4;
    for (let r = 0; r < rows; r++)
      for (let k = 0; k < 8; k++) {
        // tightly packed hexagonal prisms (flat to flat), so the mass reads as one jointed body
        const R = 0.8;
        const along = 6.4 + k * Math.sqrt(3) * R + (r % 2) * Math.sqrt(3) * R * 0.5;
        const back = -7 + r * 1.5 * R;
        const p = place(s * along, back);
        // tallest against the wall, stepping down toward the piste like a giant's staircase
        const h = Math.max(0.5, (10.5 - k * 1.05 - (rows - 1 - r) * 1.0) * rnd.range(0.82, 1.04));
        const seed = rnd.next() * 100;
        if (rnd.next() < 0.04) continue;
        addColumn(p, R, h, seed);
      }
  }
  // ---------------- the frozen tide pool on the cave floor + broken sea-ice plates ----------------
  {
    // a dense skin on the floor in front of the mouth (follows floorHeightAt; flush)
    const n = 18;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const cx = mouth.x + out.x * 0.4;
    const cz = mouth.z + out.z * 0.4;
    const RX = 2.6;
    const RZ = 1.9;
    for (let j = 0; j <= n; j++)
      for (let i = 0; i <= n; i++) {
        const u = (i / n) * 2 - 1;
        const v = (j / n) * 2 - 1;
        const rr = Math.max(Math.abs(u), Math.abs(v));
        const a = Math.atan2(v, u);
        const k = rr * (1 + 0.12 * Math.sin(a * 3 + 1) + 0.06 * Math.sin(a * 7));
        const x = cx + tan.x * Math.cos(a) * k * RX + out.x * Math.sin(a) * k * RZ;
        const z = cz + tan.z * Math.cos(a) * k * RX + out.z * Math.sin(a) * k * RZ;
        pos.push(x, cave.floorHeightAt(x, z) + 0.015, z);
        uv.push(0.5 + 0.5 * Math.cos(a) * rr, 0.5 + 0.5 * Math.sin(a) * rr);
      }
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const a0 = j * (n + 1) + i;
        idx.push(a0, a0 + n + 1, a0 + 1, a0 + 1, a0 + n + 1, a0 + n + 2);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const pool = new THREE.Mesh(g, seaIce);
    pool.receiveShadow = true;
    pool.name = 'fjord-tide-pool';
    group.add(pool);
  }
  // pressure-ridge heap of broken sea-ice plates beside the mouth (one side, clear of the lenses)
  for (const s of [1, -1]) {
    const base = place(s * 5.2, -4.5);
    if (!ok(base.clone().setY(base.y + 0.5), 1.8)) continue;
    for (let i = 0; i < 7; i++) {
      const w = rnd.range(0.7, 1.6);
      const d = rnd.range(0.5, 1.2);
      const g = new THREE.BoxGeometry(w, rnd.range(0.12, 0.22), d, 2, 1, 2);
      const P = g.attributes.position as THREE.BufferAttribute;
      for (let k = 0; k < P.count; k++) P.setXYZ(k, P.getX(k) * (1 + 0.15 * Math.sin(k * 1.7)), P.getY(k), P.getZ(k) * (1 + 0.12 * Math.cos(k * 2.3)));
      g.computeVertexNormals();
      const px = base.x + rnd.range(-1.2, 1.2);
      const pz = base.z + rnd.range(-1.0, 1.0);
      b.add('plates', g, mat(px, m.heightAt(px, pz) + 0.1 + i * 0.05, pz, rnd.range(-0.7, 0.7), rnd.range(0, 6), rnd.range(-0.6, 0.6)), (_q, nn) => new THREE.Color(nn.y > 0.7 ? 0xdbe9f2 : 0x5f97a8));
    }
    props.push({ p: base.clone().setY(base.y + 0.5), r: 1.8, kind: 'seaice' });
    break;
  }

  // ---------------- icicles: clusters, a few long ones, gaps ----------------
  const lip = cave.lipTop;
  const nI = hi ? 30 : 16;
  let tI = -5;
  for (let i = 0; i < nI && tI < 5; i++) {
    tI += rnd.next() < 0.2 ? rnd.range(0.7, 1.4) : rnd.range(0.12, 0.38);
    const x = lip.x + tan.x * tI + out.x * 0.6;
    const z = lip.z + tan.z * tI + out.z * 0.6;
    const long = rnd.next() < 0.12;
    const len = (long ? rnd.range(1.8, 3.2) : rnd.range(0.25, 1.1)) * (1 - Math.abs(tI) / 7);
    if (len < 0.2) continue;
    const r0 = (long ? 0.13 : 0.07) + rnd.range(0, 0.05);
    const p = new THREE.Vector3(x, lip.y - 1.4 - len / 2 + rnd.range(-0.25, 0.15), z);
    if (!clearOfCaveCameras(lines, p, len / 2)) continue;
    b.add('ice', new THREE.ConeGeometry(r0, len, 6).rotateX(Math.PI), mat(p.x, p.y, p.z, rnd.range(-0.06, 0.06), 0, rnd.range(-0.06, 0.06)), 0xffffff);
  }

  // ---------------- wreckage: the beachcombing hoard ----------------
  // an overturned clinker rowing boat, staved in, lying on one gunwale against the columns
  {
    const p = place(-9.5, -9);
    if (ok(p.clone().setY(p.y + 0.6), 2.8)) {
      const yaw = Math.atan2(tan.x, tan.z) + 0.5;
      const L = 4.6;
      const B = 1.5;
      // an overturned clinker hull: a half-ellipsoid shell with plank bands (tarred, faded blue
      // paint on the top strakes) and a dark staved-in patch, half-buried on its side
      const hull = new THREE.SphereGeometry(1, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      const HP = hull.attributes.position as THREE.BufferAttribute;
      for (let k = 0; k < HP.count; k++) {
        const hx = HP.getX(k);
        const hy = HP.getY(k);
        const hz2 = HP.getZ(k);
        const pinch = 1 - 0.35 * Math.pow(Math.abs(hz2), 3);
        HP.setXYZ(k, hx * (B / 2) * pinch, hy * 0.62, hz2 * (L / 2));
      }
      hull.computeVertexNormals();
      b.add('drift', hull, mat(p.x, p.y - 0.12, p.z, 0.12, yaw, 0.32), (q, nn) => {
        // plank bands by height on the hull, a dark hole on one side
        const band = Math.floor((q.y - p.y + 0.6) / 0.13);
        const t = 0.2 + 0.05 * ((band * 7) % 3);
        const c = band % 4 === 3 ? new THREE.Color(0.16, 0.24, 0.34) : new THREE.Color(t * 1.15, t, t * 0.85);
        if (nn.x > 0.5 && Math.abs(q.z - p.z) < 0.7) c.multiplyScalar(0.25);
        return c;
      });
      // keel and a broken spar
      b.add('drift', new THREE.BoxGeometry(0.12, 0.12, L * 0.95), mat(p.x, p.y + 0.5, p.z, 0.12, yaw, 0.32), new THREE.Color(0.22, 0.19, 0.16));
      b.add('drift', new THREE.CylinderGeometry(0.06, 0.08, 3.2, 6).rotateZ(Math.PI / 2), mat(p.x + tan.x * 1.5, p.y + 0.12, p.z + tan.z * 1.5, 0, yaw + 0.8, 0.05), new THREE.Color(0.55, 0.52, 0.48));
      // snow drifted into its lee
      b.add('snow', new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.9, 0.22, L * 0.42), mat(p.x + Math.cos(yaw) * 0.9, p.y - 0.04, p.z - Math.sin(yaw) * 0.9, 0, yaw, 0), 0xffffff);
      props.push({ p: p.clone().setY(p.y + 0.6), r: 2.8, kind: 'boat' });
    }
  }
  // silver driftwood logs
  for (let i = 0; i < 4; i++) {
    const p = place(rnd.range(-14, 14), rnd.range(-15, -8));
    if (!ok(p.clone().setY(p.y + 0.2), 1.8)) continue;
    const L = rnd.range(2.2, 4.2);
    const g = new THREE.CylinderGeometry(0.12, 0.2, L, 7).rotateZ(Math.PI / 2);
    b.add('drift', g, mat(p.x, p.y + 0.08, p.z, rnd.range(-0.1, 0.1), rnd.range(0, 6), 0.05), new THREE.Color(0.4, 0.37, 0.33));
    props.push({ p: p.clone().setY(p.y + 0.2), r: L / 2, kind: 'driftwood' });
  }
  // lobster pots: wooden slat cages with a net funnel end
  for (let i = 0; i < 3; i++) {
    const p = place(8.5 + i * 1.25, -9 - rnd.range(0, 2.5));
    if (!ok(p.clone().setY(p.y + 0.35), 0.9)) continue;
    const yaw = rnd.range(0, 3);
    for (let k = 0; k < 5; k++) {
      const a = (k / 4) * Math.PI;
      b.add('drift', new THREE.BoxGeometry(1.0, 0.04, 0.05), mat(p.x, p.y + 0.05 + Math.sin(a) * 0.38, p.z, 0, yaw, 0).multiply(new THREE.Matrix4().makeTranslation(0, 0, Math.cos(a) * 0.32)), new THREE.Color(0.42, 0.33, 0.24));
    }
    b.add('drift', new THREE.BoxGeometry(1.04, 0.05, 0.7), mat(p.x, p.y + 0.03, p.z, 0, yaw, 0), new THREE.Color(0.36, 0.28, 0.2));
    props.push({ p: p.clone().setY(p.y + 0.35), r: 0.7, kind: 'pot' });
  }
  // floats on a grounded line (lying on the snow, partly buried)
  {
    let prev: THREE.Vector3 | null = null;
    for (let i = 0; i < 6; i++) {
      const p = place(rnd.range(-13, -5) + i * 0.3, -rnd.range(10, 13));
      if (!ok(p.clone().setY(p.y + 0.2), 0.4)) continue;
      b.add('paint', new THREE.SphereGeometry(0.26, 10, 8), mat(p.x, p.y + 0.12, p.z), i % 2 ? 0xe86a1e : 0xf2efe7);
      if (prev) {
        const a = prev.clone().setY(prev.y + 0.05);
        const c2 = p.clone().setY(p.y + 0.05);
        b.add('drift', new THREE.TubeGeometry(new THREE.LineCurve3(a, c2), 2, 0.02, 3), undefined, new THREE.Color(0.8, 0.72, 0.55));
      }
      props.push({ p: p.clone().setY(p.y + 0.2), r: 0.3, kind: 'float' });
      prev = p;
    }
  }
  // fish bones by the mouth (the Yeti's meals)
  for (let i = 0; i < 5; i++) {
    const p = place(rnd.range(-6, 6), -rnd.range(5, 9));
    if (!ok(p.clone().setY(p.y + 0.05), 0.5)) continue;
    const yaw = rnd.range(0, 6.28);
    b.add('paint', new THREE.CylinderGeometry(0.02, 0.02, 0.9, 4).rotateZ(Math.PI / 2), mat(p.x, p.y + 0.04, p.z, 0, yaw, 0), 0xe8e2d0);
    for (let k = -3; k <= 3; k++) b.add('paint', new THREE.CylinderGeometry(0.01, 0.01, 0.3, 3), mat(p.x + Math.cos(yaw) * k * 0.1, p.y + 0.04, p.z - Math.sin(yaw) * k * 0.1, Math.PI / 2, yaw, 0), 0xe8e2d0);
    props.push({ p: p.clone().setY(p.y + 0.05), r: 0.5, kind: 'bones' });
  }

  // build columns
  if (colPos.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(colPos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colCol, 3));
    g.setAttribute('aJ', new THREE.Float32BufferAttribute(colJ, 3));
    g.computeVertexNormals();
    const cm = new THREE.Mesh(g, basalt);
    cm.castShadow = true;
    cm.receiveShadow = true;
    cm.name = 'fjord-basalt-columns';
    group.add(cm);
  }
  for (const me of b.build(M, { cast: true, receive: true })) group.add(me);
  // the drums use the basalt shader: give them the joint attribute
  group.traverse((o) => {
    const me = o as THREE.Mesh;
    if (me.isMesh && me.material === basalt && !me.geometry.getAttribute('aJ')) {
      const n = me.geometry.getAttribute('position').count;
      const j = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) j.set([k * 0.01, 0.5, 1], k * 3);
      me.geometry.setAttribute('aJ', new THREE.BufferAttribute(j, 3));
    }
  });

  // a torn net draped over the lowest column step on the left (rests on it, sways a little)
  const netG = new THREE.PlaneGeometry(3.4, 2.4, 14, 10);
  const base = new Float32Array((netG.attributes.position as THREE.BufferAttribute).array);
  const netMesh = new THREE.Mesh(netG, net);
  const tex = netTexture();
  net.map = tex;
  const perchL = perches.filter((q) => q.p.clone().sub(mouth).dot(tan) < 0).sort((a, b2) => a.p.y - b2.p.y)[0];
  if (perchL && clearOfCaveCameras(lines, perchL.p, 1.8)) {
    netMesh.position.copy(perchL.p).add(new THREE.Vector3(0, -1.1, 0)).addScaledVector(out, 0.9);
    netMesh.rotation.y = Math.atan2(out.x, out.z);
    netMesh.rotation.x = -0.25;
    group.add(netMesh);
    props.push({ p: netMesh.position.clone(), r: 1.8, kind: 'net' });
  }

  group.userData['props'] = props;
  group.userData['perches'] = perches;
  group.userData['mouth'] = mouth.clone();

  return {
    group,
    update(_dt, time) {
      if (!netMesh.parent) return;
      const P = netG.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < P.count; i++) {
        const x = base[i * 3]!;
        const y = base[i * 3 + 1]!;
        P.setZ(i, Math.sin(time * 1.2 + x * 1.3) * 0.05 * (1.2 - y) + 0.25 * Math.max(0, -y));
      }
      P.needsUpdate = true;
    },
    dispose() {
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      for (const mt of new Set(Object.values(M))) mt.dispose();
      net.dispose();
      tex.dispose();
      seaIce.dispose();
      iceTex.dispose();
      group.removeFromParent();
    },
  };
}
