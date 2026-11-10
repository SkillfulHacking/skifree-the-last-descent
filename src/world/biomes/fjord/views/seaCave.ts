/**
 * "fjord-sea-cave" dressing around the shared Yeti cave (the geometry contract is untouched):
 * hexagonal basalt columns stepping up either side of the mouth like a sea cave on the coast, a
 * curtain of icicles along the brow, and the Yeti's beachcombing hoard — a torn fishing net hung
 * with orange floats, a staved-in rowing boat half sunk in the snow, lobster pots and fish bones.
 * Nothing is placed on the exit path or the ledge, so the Yeti's emergence and grounding are
 * exactly as everywhere else. Animated: the icicles drip-glint; the net sways in the sea breeze.
 */
import * as THREE from 'three';
import type { CaveDressing, CaveDressingContext } from '../../../presentation/cave';
import { Batch, Rand, mat } from '../../../resort/util';
import { fishingBoat, kitMaterials } from './buildings';

export function dressSeaCave(c: CaveDressingContext): CaveDressing {
  const { cave, mountain: m } = c;
  const hi = c.quality === 'high' || c.quality === 'ultra';
  const group = new THREE.Group();
  group.name = 'FjordSeaCave';
  const rnd = new Rand(31337 + Math.round(c.anchor.z));
  const K = kitMaterials();
  const basalt = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x4a4a4a, roughness: 0.7, metalness: 0.05, flatShading: true });
  const ice = new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, roughness: 0.08, transmission: 0.0, transparent: true, opacity: 0.85, emissive: 0x16304a, emissiveIntensity: 0.25 });
  const net = new THREE.MeshStandardMaterial({ color: 0x3f5f4a, roughness: 0.9, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  const M: Record<string, THREE.Material> = { ...K, basalt, ice };
  const b = new Batch();
  const out = cave.outward.clone().setY(0).normalize();
  const tan = new THREE.Vector3(out.z, 0, -out.x);
  const mouth = cave.mouth;
  const clearOfPath = (x: number, z: number, r: number) => cave.exitPath.every((p) => Math.hypot(p.x - x, p.z - z) > r + 4.5) && Math.hypot(cave.ledge.x - x, cave.ledge.z - z) > r + 5;

  // basalt column clusters either side of the mouth: hexagonal packing, stepped heights, near-black
  for (const s of [-1, 1]) {
    const rows = hi ? 5 : 4;
    for (let r = 0; r < rows; r++)
      for (let k = 0; k < 7; k++) {
        const R = 0.95;
        const along = 6.2 + k * R * 1.73 + (r % 2) * R * 0.87 + rnd.range(-0.05, 0.05);
        const back = -6 + r * R * 1.5;
        const x = mouth.x + tan.x * s * along - out.x * back;
        const z = mouth.z + tan.z * s * along - out.z * back;
        if (!clearOfPath(x, z, R) || rnd.next() < 0.12) continue;
        const y = m.heightAt(x, z);
        // tallest against the wall, stepping down toward the piste like a giant's staircase
        const h = Math.max(0.8, (11 - k * 1.3 - (rows - 1 - r) * 1.2) * rnd.range(0.75, 1.05));
        const tone = 0.032 + rnd.range(0, 0.03);
        const tilt = 0.06 * s;
        b.add('basalt', new THREE.CylinderGeometry(R * 0.98, R, h, 6), mat(x, y + h / 2 - 0.6, z, rnd.range(-0.03, 0.03), Math.PI / 6 + Math.atan2(tan.x, tan.z), tilt), new THREE.Color(tone, tone * 1.05, tone * 1.15));
        b.add('snow', new THREE.CylinderGeometry(R * 0.99, R * 0.99, 0.2, 6), mat(x + Math.sin(tilt) * h * 0.5, y + h - 0.5, z, 0, Math.PI / 6 + Math.atan2(tan.x, tan.z), tilt), 0xffffff);
      }
    // a few broken drums lying in the snow
    for (let i = 0; i < 3; i++) {
      const along = rnd.range(7, 16);
      const back = rnd.range(-14, -8);
      const x = mouth.x + tan.x * s * along - out.x * back;
      const z = mouth.z + tan.z * s * along - out.z * back;
      if (!clearOfPath(x, z, 1.5)) continue;
      b.add('basalt', new THREE.CylinderGeometry(0.9, 0.9, rnd.range(1.2, 2.2), 6).rotateZ(Math.PI / 2), mat(x, m.heightAt(x, z) + 0.45, z, 0, rnd.range(0, 6), 0), new THREE.Color(0.045, 0.048, 0.055));
    }
  }
  // icicle curtain along the brow
  const lip = cave.lipTop;
  const nI = hi ? 34 : 18;
  for (let i = 0; i < nI; i++) {
    const t = (i / (nI - 1) - 0.5) * 9.5;
    const x = lip.x + tan.x * t + out.x * 0.6;
    const z = lip.z + tan.z * t + out.z * 0.6;
    const len = rnd.range(0.5, 2.6) * (1 - Math.abs(t) / 7);
    if (len < 0.25) continue;
    b.add('ice', new THREE.ConeGeometry(rnd.range(0.07, 0.16), len, 5).rotateX(Math.PI), mat(x, lip.y - 1.4 - len / 2 + rnd.range(-0.3, 0.3), z), 0xffffff);
  }
  // the hoard: a staved-in rowing boat, lobster pots, floats, bones
  const hoard = (along: number, back: number) => {
    const x = mouth.x + tan.x * along - out.x * back;
    const z = mouth.z + tan.z * along - out.z * back;
    return new THREE.Vector3(x, m.heightAt(x, z), z);
  };
  const boatP = hoard(-9, -9);
  if (clearOfPath(boatP.x, boatP.z, 3)) fishingBoat(b, boatP.x, boatP.y - 0.9, boatP.z, Math.atan2(tan.x, tan.z) + 0.4, { len: 6, hull: 0x2d4c78, stripe: 0xf2efe7, cabin: 0x6b4e36 });
  for (let i = 0; i < 4; i++) {
    const p = hoard(8 + i * 1.3, -8 - rnd.range(0, 3));
    if (!clearOfPath(p.x, p.z, 1)) continue;
    b.add('paint', new THREE.CylinderGeometry(0.45, 0.5, 0.7, 8, 1, true).rotateZ(Math.PI / 2), mat(p.x, p.y + 0.3, p.z, 0, rnd.range(0, 3), 0), 0x6b4e36);
  }
  for (let i = 0; i < 7; i++) {
    const p = hoard(rnd.range(-12, 12), -rnd.range(6, 14));
    if (!clearOfPath(p.x, p.z, 0.4)) continue;
    b.add('paint', new THREE.SphereGeometry(0.28, 8, 6), mat(p.x, p.y + 0.15, p.z), i % 2 ? 0xe86a1e : 0xf2efe7);
  }
  for (let i = 0; i < 5; i++) {
    const p = hoard(rnd.range(-6, 6), -rnd.range(4, 9));
    if (!clearOfPath(p.x, p.z, 0.4)) continue;
    // fish skeleton: a spine with ribs
    const yaw = rnd.range(0, 6.28);
    b.add('paint', new THREE.CylinderGeometry(0.02, 0.02, 0.9, 4).rotateZ(Math.PI / 2), mat(p.x, p.y + 0.05, p.z, 0, yaw, 0), 0xe8e2d0);
    for (let k = -3; k <= 3; k++) b.add('paint', new THREE.CylinderGeometry(0.01, 0.01, 0.3, 3), mat(p.x + Math.cos(yaw) * k * 0.1, p.y + 0.05, p.z - Math.sin(yaw) * k * 0.1, Math.PI / 2, yaw, 0), 0xe8e2d0);
  }
  for (const me of b.build(M, { cast: true, receive: true })) group.add(me);

  // a torn net hung between two columns (swaying)
  const netG = new THREE.PlaneGeometry(4.5, 3, 14, 10);
  const base = new Float32Array((netG.attributes.position as THREE.BufferAttribute).array);
  const netMesh = new THREE.Mesh(netG, net);
  const np = hoard(-7.5, -2);
  netMesh.position.set(np.x, np.y + 2.6, np.z);
  netMesh.rotation.y = Math.atan2(out.x, out.z);
  if (clearOfPath(np.x, np.z, 2)) group.add(netMesh);
  const tex = netTexture();
  net.map = tex;
  net.alphaTest = 0.4;

  return {
    group,
    update(_dt, time) {
      const P = netG.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < P.count; i++) {
        const x = base[i * 3]!;
        const y = base[i * 3 + 1]!;
        const sag = (1.5 - y) * 0.15;
        P.setZ(i, Math.sin(time * 1.4 + x * 1.3) * 0.12 * (1.5 - y) + sag * Math.sin(x * 0.7));
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
      group.removeFromParent();
    },
  };
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
  // a torn hole
  g.clearRect(70, 40, 34, 30);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 2);
  return t;
}
