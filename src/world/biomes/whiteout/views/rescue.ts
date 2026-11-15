/**
 * "whiteout-rescue" finish: the mountain-rescue station at the foot of the ridge.
 *
 * A red timber hut with a white cross, its door and windows lit warm (the one warm colour in a grey
 * world: you aim for it through the storm), a radio mast with a red beacon lamp that shows through
 * the fog, a windsock, a parked snowcat and a rescue sled, a row of marker poles leading to the door,
 * and the trophy — a brass storm lantern on a stone plinth beside the door.
 */
import * as THREE from 'three';
import type { CircleCollider, FinishBuildContext, FinishEnvironment, FinishState } from '../../../presentation/finish';

const C = {
  hutW: 9,
  hutD: 7,
  wall: 3.2,
  roof: 2.4,
  /** the hut stands this far below the finish line, to the side of the run-out */
  ahead: 34,
  side: 14,
} as const;

function signTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f4f1ea';
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#c41a12';
  g.fillRect(24, 24, 80, 80);
  g.fillStyle = '#f4f1ea';
  g.fillRect(54, 34, 20, 60);
  g.fillRect(34, 54, 60, 20);
  g.fillStyle = '#1b1b1f';
  g.font = 'bold 44px sans-serif';
  g.textBaseline = 'middle';
  g.fillText('MOUNTAIN RESCUE', 124, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

let glowTex: THREE.Texture | null = null;
function glow(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.25, 'rgba(255,255,255,0.7)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

export class RescueStation implements FinishEnvironment {
  readonly group = new THREE.Group();
  readonly trophy: THREE.Object3D;
  readonly finishZ: number;
  /** the hut's door (world), the warm light the skier aims for */
  readonly door = new THREE.Vector3();
  /** the hut's centre on the ground and the direction its door faces (unit, xz) */
  readonly hut = new THREE.Vector3();
  readonly faces = new THREE.Vector3();
  readonly beaconPos = new THREE.Vector3();
  private stop = new THREE.Vector3();
  private yetiPt = new THREE.Vector3();
  private podium = new THREE.Vector3();
  private cols: CircleCollider[] = [];
  private disposables: Array<{ dispose(): void }> = [];
  private beacon: THREE.Sprite;
  private doorLight: THREE.PointLight;
  private windsock: THREE.Mesh;
  private smoke: THREE.Points;
  private smokeBase = new THREE.Vector3();
  private doorLeaf: THREE.Mesh;
  /** 0..1: how far the door is open (the victory opens it) */
  doorOpen = 0;

  constructor(ctx: FinishBuildContext) {
    const H = ctx.heightAt;
    const F = ctx.finishCenter;
    this.finishZ = F.z;
    this.group.name = 'rescue-station';
    const m = ctx.mountain;
    // the run-out bends toward the hut: it stands to the side of the line, below the finish
    const z = F.z + C.ahead;
    const side = m.routeX(F.z) >= m.centerX(F.z) ? -1 : 1;
    const x = m.routeX(z) + side * C.side;
    // level pad: the lowest corner, the walls sunk into the snow on the uphill side
    // on its high corner, the low side on a stone foundation (never buried in the slope)
    let maxY = -Infinity;
    let minY = Infinity;
    for (const [dx, dz] of [[-C.hutW / 2, -C.hutD / 2], [C.hutW / 2, -C.hutD / 2], [-C.hutW / 2, C.hutD / 2], [C.hutW / 2, C.hutD / 2]] as const) {
      const hy = H(x + dx, z + dz);
      maxY = Math.max(maxY, hy);
      minY = Math.min(minY, hy);
    }
    const y0 = maxY - 0.25;
    const footing = y0 - minY + 0.8;
    this.hut.set(x, y0, z);
    // the door faces back up toward the arriving skier (toward the finish line)
    this.faces.set(F.x - x, 0, F.z - z).normalize();
    const yaw = Math.atan2(this.faces.x, this.faces.z);
    const hut = new THREE.Group();
    hut.position.set(x, y0, z);
    hut.rotation.y = yaw;
    this.group.add(hut);
    const mk = <T extends THREE.Material>(mat: T): T => {
      this.disposables.push(mat);
      return mat;
    };
    const geo = <T extends THREE.BufferGeometry>(g: T): T => {
      this.disposables.push(g);
      return g;
    };
    const red = mk(new THREE.MeshStandardMaterial({ color: 0xa3221a, roughness: 0.75 }));
    const white = mk(new THREE.MeshStandardMaterial({ color: 0xf0ede6, roughness: 0.7 }));
    const roofM = mk(new THREE.MeshStandardMaterial({ color: 0x2c2f35, roughness: 0.6, metalness: 0.3 }));
    const snowM = mk(new THREE.MeshStandardMaterial({ color: 0xf6f8fc, roughness: 0.85 }));
    // unlit: the lit door and windows must glow through the storm whatever the exposure
    const warm = mk(new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.66, 0.28) }));
    const dark = mk(new THREE.MeshStandardMaterial({ color: 0x1d1f24, roughness: 0.8 }));
    const steel = mk(new THREE.MeshStandardMaterial({ color: 0x8b9099, roughness: 0.4, metalness: 0.7 }));
    const yellow = mk(new THREE.MeshStandardMaterial({ color: 0xe8b416, roughness: 0.55 }));
    const add = (g: THREE.BufferGeometry, mat: THREE.Material, px: number, py: number, pz: number, parent: THREE.Object3D = hut, cast = true) => {
      const mesh = new THREE.Mesh(geo(g), mat);
      mesh.position.set(px, py, pz);
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    // walls (a plinth course in white), a gable roof with a snow load
    add(new THREE.BoxGeometry(C.hutW, C.wall, C.hutD), red, 0, C.wall / 2 + 0.6, 0);
    add(new THREE.BoxGeometry(C.hutW + 0.2, 0.7 + footing, C.hutD + 0.2), mk(new THREE.MeshStandardMaterial({ color: 0x6b6e74, roughness: 0.95 })), 0, 0.35 - footing / 2, 0);
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-C.hutW / 2 - 0.6, 0);
    roofShape.lineTo(0, C.roof);
    roofShape.lineTo(C.hutW / 2 + 0.6, 0);
    roofShape.lineTo(-C.hutW / 2 - 0.6, 0);
    const roofG = new THREE.ExtrudeGeometry(roofShape, { depth: C.hutD + 1.2, bevelEnabled: false });
    roofG.translate(0, 0, -(C.hutD + 1.2) / 2);
    add(roofG, roofM, 0, C.wall + 0.6, 0);
    const snowG = new THREE.ExtrudeGeometry(roofShape, { depth: C.hutD + 1.3, bevelEnabled: false });
    snowG.translate(0, 0, -(C.hutD + 1.3) / 2);
    const snowCap = add(snowG, snowM, 0, C.wall + 0.75, 0);
    snowCap.scale.set(0.98, 0.9, 1);
    // white cross on each gable end (the door side and the back)
    for (const s of [1, -1]) {
      add(new THREE.BoxGeometry(0.5, 1.6, 0.06), white, 0, C.wall - 0.2, s * (C.hutD / 2 + 0.03));
      add(new THREE.BoxGeometry(1.6, 0.5, 0.06), white, 0, C.wall - 0.2, s * (C.hutD / 2 + 0.03));
    }
    // the door (warm light behind it) and lit windows; a porch light
    const doorFrame = add(new THREE.BoxGeometry(1.5, 2.3, 0.1), warm, -2.4, 0.6 + 1.15, C.hutD / 2 + 0.02, hut, false);
    doorFrame.name = 'door-light';
    const leafG = new THREE.BoxGeometry(1.4, 2.2, 0.08);
    leafG.translate(0.7, 0, 0);
    this.doorLeaf = add(leafG, dark, -2.4 - 0.7, 0.6 + 1.12, C.hutD / 2 + 0.08);
    for (const wx of [1.4, 3.2]) add(new THREE.BoxGeometry(1.1, 0.9, 0.08), warm, wx, 2.5, C.hutD / 2 + 0.02, hut, false);
    for (const wz of [-1.5, 1.5]) add(new THREE.BoxGeometry(0.08, 0.9, 1.1), warm, C.hutW / 2 + 0.02, 2.5, wz, hut, false);
    // the sign over the door
    const signTex = signTexture();
    this.disposables.push(signTex);
    const signM = mk(new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.6 }));
    add(new THREE.PlaneGeometry(4.4, 1.1), signM, 0.6, C.wall + 0.05, C.hutD / 2 + 0.07, hut, false);
    // chimney + smoke
    add(new THREE.BoxGeometry(0.7, 1.8, 0.7), dark, 2.6, C.wall + 0.6 + C.roof * 0.55, -1.2);
    this.smokeBase.set(2.6, C.wall + 0.6 + C.roof * 0.55 + 1.0, -1.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(this.hut);
    const sp = new Float32Array(40 * 3);
    const sg = geo(new THREE.BufferGeometry());
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const smokeM = mk(new THREE.PointsMaterial({ size: 1.6, map: glow(), color: 0xd8dade, transparent: true, opacity: 0.35, depthWrite: false }));
    this.smoke = new THREE.Points(sg, smokeM);
    this.smoke.frustumCulled = false;
    this.group.add(this.smoke);
    // the porch light: a warm point light that reaches the snow in front of the door
    this.doorLight = new THREE.PointLight(0xffb060, 18, 22, 1.6);
    this.doorLight.position.set(-2.4, 3.0, C.hutD / 2 + 1.2);
    hut.add(this.doorLight);
    this.door.set(-2.4, 0.6, C.hutD / 2 + 0.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(this.hut);
    // the radio mast (lattice suggested by a slim box) with its red beacon, and a windsock
    const mastLocal = new THREE.Vector3(-C.hutW / 2 - 2.2, 0, -1.5);
    add(new THREE.BoxGeometry(0.28, 13, 0.28), steel, mastLocal.x, 6.5, mastLocal.z);
    for (let k = 1; k <= 4; k++) add(new THREE.BoxGeometry(1.0, 0.06, 0.06), steel, mastLocal.x, k * 3, mastLocal.z, hut, false);
    this.beaconPos.set(mastLocal.x, 13.3, mastLocal.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(this.hut);
    const bm = mk(new THREE.SpriteMaterial({ map: glow(), color: 0xff2a14, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.beacon = new THREE.Sprite(bm);
    this.beacon.position.copy(this.beaconPos);
    this.beacon.scale.setScalar(3);
    this.group.add(this.beacon);
    const sockG = new THREE.ConeGeometry(0.35, 2.2, 10, 1, true);
    sockG.rotateZ(Math.PI / 2);
    sockG.translate(1.1, 0, 0);
    const sockM = mk(new THREE.MeshStandardMaterial({ color: 0xff6a10, roughness: 0.7, side: THREE.DoubleSide }));
    this.windsock = add(sockG, sockM, mastLocal.x, 11.5, mastLocal.z);
    // the snowcat (body, cab, tracks, blade) parked beside the hut, and the rescue sled
    const cat = new THREE.Group();
    cat.position.set(C.hutW / 2 + 4.5, 0.4, 1.0);
    cat.rotation.y = 0.35;
    hut.add(cat);
    add(new THREE.BoxGeometry(2.6, 1.2, 4.6), red, 0, 1.2, 0, cat);
    add(new THREE.BoxGeometry(2.3, 1.2, 2.0), red, 0, 2.3, -0.5, cat);
    add(new THREE.BoxGeometry(2.2, 0.9, 1.9), mk(new THREE.MeshStandardMaterial({ color: 0x9fb4c8, roughness: 0.1, metalness: 0.2 })), 0, 2.35, -0.48, cat, false);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.9, 0.9, 5.2), dark, s * 1.5, 0.45, 0, cat);
    add(new THREE.BoxGeometry(3.6, 1.0, 0.25), yellow, 0, 0.7, 2.75, cat);
    const sled = add(new THREE.BoxGeometry(0.8, 0.35, 2.4), mk(new THREE.MeshStandardMaterial({ color: 0xd8361e, roughness: 0.5 })), -C.hutW / 2 + 1.0, 0.75, C.hutD / 2 + 2.2);
    sled.rotation.y = 0.5;
    // the trophy: a brass storm lantern (held part first) on a stone plinth beside the door
    const tro = new THREE.Group();
    tro.name = 'Trophy';
    const brass = mk(new THREE.MeshStandardMaterial({ color: 0xd8a040, metalness: 1, roughness: 0.28 }));
    const lantern = new THREE.Group();
    add(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 16), brass, 0, 0.04, 0, lantern);
    add(new THREE.CylinderGeometry(0.13, 0.13, 0.34, 16), mk(new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: new THREE.Color(1, 0.7, 0.3), emissiveIntensity: 2.5, transparent: true, opacity: 0.9 })), 0, 0.25, 0, lantern, false);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      add(new THREE.BoxGeometry(0.02, 0.36, 0.02), brass, Math.cos(a) * 0.15, 0.25, Math.sin(a) * 0.15, lantern);
    }
    add(new THREE.ConeGeometry(0.19, 0.16, 16), brass, 0, 0.5, 0, lantern);
    add(new THREE.TorusGeometry(0.08, 0.012, 6, 16), brass, 0, 0.62, 0, lantern);
    lantern.position.y = 0.0;
    tro.add(lantern);
    const plinth = new THREE.Group();
    add(new THREE.BoxGeometry(0.6, 1.1, 0.6), mk(new THREE.MeshStandardMaterial({ color: 0x55585e, roughness: 0.9 })), 0, -0.55, 0, plinth);
    tro.add(plinth);
    const podiumLocal = new THREE.Vector3(-0.6, 0.6 + 1.1, C.hutD / 2 + 1.4);
    this.podium.copy(podiumLocal).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(this.hut);
    this.podium.y = Math.max(this.podium.y, H(this.podium.x, this.podium.z) + 1.1);
    tro.position.copy(this.podium);
    this.trophy = tro;
    this.group.add(tro);
    // marker poles leading from the finish line to the door
    const pole = geo(new THREE.CylinderGeometry(0.05, 0.06, 2.4, 6));
    const poleM = mk(new THREE.MeshStandardMaterial({ color: 0xf06010, roughness: 0.5 }));
    for (let k = 1; k <= 3; k++) {
      const p = new THREE.Vector3().lerpVectors(new THREE.Vector3(F.x, 0, F.z), this.door, k / 4);
      for (const s of [-1, 1]) {
        const px = p.x + s * 7 * this.faces.z;
        const pz = p.z - s * 7 * this.faces.x;
        const mesh = new THREE.Mesh(pole, poleM);
        mesh.position.set(px, H(px, pz) + 1.1, pz);
        this.group.add(mesh);
      }
    }
    // stop in front of the door; the Yeti halts up the slope, at the edge of the light
    this.stop.copy(this.door).addScaledVector(this.faces, 7);
    this.stop.y = H(this.stop.x, this.stop.z);
    const across = new THREE.Vector3(this.faces.z, 0, -this.faces.x);
    this.yetiPt.copy(this.door).addScaledVector(this.faces, 30).addScaledVector(across, -side * 12);
    this.yetiPt.y = H(this.yetiPt.x, this.yetiPt.z);
    // colliders: the hut (two circles), the mast, the snowcat
    const toW = (lx: number, lz: number) => new THREE.Vector3(lx, 0, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(this.hut);
    for (const lx of [-2.3, 2.3]) {
      const p = toW(lx, 0);
      this.cols.push({ x: p.x, z: p.z, r: 3.6 });
    }
    const mp = toW(mastLocal.x, mastLocal.z);
    this.cols.push({ x: mp.x, z: mp.z, r: 0.6 });
    const cp = toW(C.hutW / 2 + 4.5, 1.0);
    this.cols.push({ x: cp.x, z: cp.z, r: 2.6 });
  }

  update(dt: number, time: number, _state: FinishState): void {
    // the beacon flashes (1 Hz), the windsock swings, the chimney smokes, the door swings open on cue
    const f = 0.5 + 0.5 * Math.sin(time * Math.PI * 2);
    this.beacon.material.opacity = 0.35 + 0.65 * f * f;
    this.beacon.scale.setScalar(2.4 + 1.6 * f);
    this.windsock.rotation.y = 0.5 * Math.sin(time * 0.7) + 0.2 * Math.sin(time * 2.9);
    this.windsock.rotation.z = -0.15 + 0.08 * Math.sin(time * 3.7);
    this.doorLeaf.rotation.y = -1.6 * this.doorOpen;
    this.doorLight.intensity = 18 + 22 * this.doorOpen;
    const p = (this.smoke.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
    for (let i = 0; i < 40; i++) {
      const life = (time * 0.18 + i / 40) % 1;
      p[i * 3] = this.smokeBase.x + life * 6 + Math.sin(i * 3.1 + time) * 0.4 * life;
      p[i * 3 + 1] = this.smokeBase.y + life * 7;
      p[i * 3 + 2] = this.smokeBase.z + Math.cos(i * 1.7) * life * 1.5;
    }
    this.smoke.geometry.getAttribute('position').needsUpdate = true;
    void dt;
  }
  getStopPoint(t: THREE.Vector3) {
    return t.copy(this.stop);
  }
  getYetiStopPoint(t: THREE.Vector3) {
    return t.copy(this.yetiPt);
  }
  getPodiumTop(t: THREE.Vector3) {
    return t.copy(this.podium);
  }
  getCelebrationFocus(t: THREE.Vector3) {
    return t.copy(this.door);
  }
  colliders(): CircleCollider[] {
    return this.cols;
  }
  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.group.removeFromParent();
  }
}
