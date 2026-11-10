/**
 * Fjord beats layered on the shared cave cinematic (round 2, cinematic review 1). Registered as the
 * "fjord-sea-cave" presentation's `cinematic` hook; Alpine has none, so its encounter is unchanged.
 *
 *  - gulls: a dozen herring gulls sit on the basalt column tops in the establishing shot; the
 *    rumble at 2.45 s scatters them, screaming, out over the slope (and the slough shot is re-framed
 *    a little higher and wider so they burst through it);
 *  - spray and sea smoke: on the roar a plume of freezing spray and mist bursts out of the mouth
 *    and rolls down over the ledge, and icicles shatter off the brow (shards fall and bounce);
 *  - the roar's wide shot opens a touch wider (the plume and the columns frame the Yeti).
 *
 * The extra shots reuse the shared camera stations (CAVE_CAMS), so the dressing's camera
 * clearance (seaCave.ts) covers them.
 */
import * as THREE from 'three';
import type { CaveCinematicContext, CaveCinematicExtras } from '../../../presentation/cave';
import { CAVE_CAMS } from '../../../../cinematic/CaveCinematic';
import { pose } from '../../../../cinematic/Timeline';
import type { SeaCavePerch } from './seaCave';

interface Gull {
  o: THREE.Group;
  wl: THREE.Object3D;
  wr: THREE.Object3D;
  home: THREE.Vector3;
  vel: THREE.Vector3;
  ph: number;
  t0: number;
  flying: boolean;
}

function gullMeshes(): { body: THREE.BufferGeometry; wing: THREE.BufferGeometry; mat: THREE.Material } {
  const body = new THREE.SphereGeometry(0.16, 10, 7);
  body.scale(0.8, 0.75, 2.0);
  const head = new THREE.SphereGeometry(0.1, 8, 6).translate(0, 0.08, 0.3);
  const tail = new THREE.ConeGeometry(0.08, 0.22, 5).rotateX(-Math.PI / 2).translate(0, 0.0, -0.36);
  const beak = new THREE.ConeGeometry(0.025, 0.1, 4).rotateX(Math.PI / 2).translate(0, 0.07, 0.42);
  const parts = [body, head, tail, beak];
  const cols = [0xf4f4f0, 0xf6f6f2, 0xd8dade, 0xe8c030];
  const pos: number[] = [];
  const col: number[] = [];
  parts.forEach((g, i) => {
    const n = g.index ? g.toNonIndexed() : g;
    const P = n.attributes.position as THREE.BufferAttribute;
    const c = new THREE.Color(cols[i]!);
    for (let k = 0; k < P.count; k++) {
      pos.push(P.getX(k), P.getY(k), P.getZ(k));
      col.push(c.r, c.g, c.b);
    }
  });
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  bg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  bg.computeVertexNormals();
  for (const g of parts) g.dispose();
  // a wing: pale grey, black tip, pivot at the shoulder (x = 0), spanning +x
  const wing = new THREE.BufferGeometry();
  const wp = [0, 0, 0.12, 0.55, 0, 0.05, 0.55, 0, -0.12, 0, 0, -0.1, 0.55, 0, 0.05, 0.85, 0, -0.06, 0.55, 0, -0.12];
  const wc: number[] = [];
  const grey = new THREE.Color(0xa9b0b8);
  const black = new THREE.Color(0x1a1a1c);
  for (let i = 0; i < 4; i++) wc.push(grey.r, grey.g, grey.b);
  for (let i = 0; i < 3; i++) wc.push(black.r, black.g, black.b);
  wing.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
  wing.setAttribute('color', new THREE.Float32BufferAttribute(wc, 3));
  wing.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6]);
  wing.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
  return { body: bg, wing, mat };
}

export function seaCaveCinematic(ctx: CaveCinematicContext): CaveCinematicExtras {
  const { st, cave, tl, at } = ctx;
  const M = cave.mouth.clone();
  const O = cave.outward.clone().setY(0).normalize();
  // perches: the column tops of this cave's dressing (nearest dressing group to the mouth)
  let perches: SeaCavePerch[] = [];
  let best = Infinity;
  st.world.scene.traverse((o) => {
    if (o.name !== 'FjordSeaCave') return;
    const mouth = o.userData['mouth'] as THREE.Vector3 | undefined;
    const d = mouth ? mouth.distanceTo(M) : Infinity;
    if (d < best) {
      best = d;
      perches = (o.userData['perches'] as SeaCavePerch[]) ?? [];
    }
  });
  if (best > 5) perches = [];
  const group = new THREE.Group();
  group.name = 'fjord-cave-gulls';
  st.world.scene.add(group);
  const G = gullMeshes();
  const gulls: Gull[] = [];
  const tops = [...perches].sort((a, b) => b.p.y - a.p.y);
  const n = Math.min(12, tops.length);
  for (let i = 0; i < n; i++) {
    const home = tops[(i * 5) % tops.length]!.p.clone().add(new THREE.Vector3(Math.sin(i * 2.3) * 0.3, 0.12, Math.cos(i * 1.7) * 0.3));
    const o = new THREE.Group();
    o.add(new THREE.Mesh(G.body, G.mat));
    const wl = new THREE.Group();
    const wr = new THREE.Group();
    const ml = new THREE.Mesh(G.wing, G.mat);
    const mr = new THREE.Mesh(G.wing, G.mat);
    mr.scale.x = -1;
    wl.add(ml);
    wr.add(mr);
    wl.position.set(0.1, 0.05, 0.05);
    wr.position.set(-0.1, 0.05, 0.05);
    o.add(wl, wr);
    o.position.copy(home);
    o.rotation.y = Math.atan2(O.x, O.z) + Math.sin(i * 3.1) * 1.2;
    o.scale.setScalar(1.15);
    group.add(o);
    // scatter: out from the cliff and up, each its own way
    const side = new THREE.Vector3(O.z, 0, -O.x).multiplyScalar(Math.sin(i * 1.9) * 3);
    const vel = O.clone().multiplyScalar(4 + (i % 3)).add(side).add(new THREE.Vector3(0, 3.2 + (i % 4) * 0.5, Math.cos(i) * 1.5));
    gulls.push({ o, wl, wr, home, vel, ph: i * 0.7, t0: 2.45 + (i % 5) * 0.09, flying: false });
  }
  // folded wings while perched
  for (const g of gulls) {
    g.wl.rotation.set(0, -1.35, -0.25);
    g.wr.rotation.set(0, 1.35, 0.25);
  }

  // shot overrides (later shots win over the shared ones covering the same time)
  const brow = cave.lipTop.clone();
  tl.shot({ start: 2.4, end: 3.8, from: () => pose(at(...CAVE_CAMS.slough0), brow.clone().add(new THREE.Vector3(0, 2.2, 0)), 46), to: () => pose(at(...CAVE_CAMS.slough1), brow.clone().add(new THREE.Vector3(0, 1.4, 0)), 44), handheld: 0.03 });
  tl.shot({ start: 11.0, end: 12.3, from: () => pose(at(...CAVE_CAMS.roar0), M.clone().add(new THREE.Vector3(-1.5, 3.2, 0)), 52), to: () => pose(at(...CAVE_CAMS.roar1), M.clone().add(new THREE.Vector3(-1.5, 3.4, 0)), 49) });

  tl.at(2.5, () => {
    st.audio.playCue('gull', M.clone().add(new THREE.Vector3(0, 8, 0)));
    st.hud.caption('[gulls scream and scatter]', 1.4);
  });
  tl.at(3.1, () => st.audio.playCue('gull', M.clone().add(new THREE.Vector3(4, 10, 3))));
  tl.at(11.05, () => {
    // freezing spray and sea smoke out of the mouth, rolling over the ledge
    for (let k = 0; k < 6; k++)
      st.world.particles.emit({ x: M.x + O.x * 0.5, y: M.y + 1.0 + k * 0.35, z: M.z + O.z * 0.5, vx: O.x * (6 + k), vy: 1.2 + k * 0.4, vz: O.z * (6 + k), spread: 2.2, size: 1.6, life: 2.6, count: 26, gravity: 0.15, drag: 1.1, grow: 2.2, alpha: 0.6, color: 0.97 });
    st.world.particles.emit({ x: M.x + O.x, y: M.y + 1.6, z: M.z + O.z, vx: O.x * 9, vy: 3.5, vz: O.z * 9, spread: 3, size: 0.18, life: 1.2, count: 80, gravity: 1, drag: 0.6, grow: 0.2, alpha: 0.95, color: 1 });
  });
  tl.at(11.25, () => {
    // icicles shatter off the brow
    const p = cave.lipTop;
    for (let k = 0; k < 5; k++)
      st.world.particles.emit({ x: p.x + O.x * 0.6 + (k - 2) * O.z * 1.6, y: p.y - 1.8, z: p.z + O.z * 0.6 - (k - 2) * O.x * 1.6, vx: O.x * 1.5, vy: -1, vz: O.z * 1.5, spread: 1.2, size: 0.12, life: 1.1, count: 18, gravity: 1, drag: 0.2, grow: 0, alpha: 1, color: 1 });
    st.audio.playImpact('rock-light', 0.5);
  });

  return {
    update(dt, t) {
      for (const g of gulls) {
        if (!g.flying && t >= g.t0) g.flying = true;
        if (!g.flying) {
          // perched: little head bobs
          g.o.position.y = g.home.y + 0.02 * Math.sin(t * 3 + g.ph);
          continue;
        }
        const k = t - g.t0;
        g.vel.y -= (k < 0.8 ? -1.5 : 0.6) * dt;
        g.o.position.addScaledVector(g.vel, dt);
        const v = g.vel;
        g.o.rotation.set(-Math.atan2(v.y, Math.hypot(v.x, v.z)) * 0.6, Math.atan2(v.x, v.z), 0.3 * Math.sin(t * 1.3 + g.ph));
        // fast flapping on take-off, then slower beats with glides
        const f = k < 1.2 ? 14 : 8;
        const a = (k < 1.2 ? 1.0 : 0.7) * Math.sin(t * f + g.ph);
        g.wl.rotation.set(0, 0, a);
        g.wr.rotation.set(0, 0, -a);
        if (k > 9) g.o.visible = false;
      }
    },
    dispose() {
      group.removeFromParent();
      G.body.dispose();
      G.wing.dispose();
      G.mat.dispose();
    },
  };
}
