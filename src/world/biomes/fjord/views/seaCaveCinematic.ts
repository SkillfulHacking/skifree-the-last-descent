/**
 * Fjord beats layered on the shared cave cinematic. Registered as the "fjord-sea-cave"
 * presentation's `cinematic` hook; Alpine has none, so its encounter is unchanged.
 *
 * Round 3 (C1, F3: "the shared encounter plus garnish"): the Fjord gets its own shots and beats,
 * on the shared timing and the shared Yeti choreography (grounding contract untouched):
 *  - 2.4 s gulls: herring gulls perched on the portal columns and the lintel's column ends, white
 *    on black basalt, burst off screaming on the rumble; the slough shot is re-framed tight on the
 *    brow so they read;
 *  - 7.9 s the emergence is filmed FROM INSIDE THE SEA CAVE, low behind the Yeti: he rises out of
 *    the dark mouth as a silhouette against the fjord, the islands and the far shore (when the mouth
 *    faces the sea; otherwise a high three-quarter angle);
 *  - 11.05 s the roar blows a plume of freezing spray and sea smoke out over the ledge, and the
 *    icicles under the lintel actually drop and shatter on the ice (the real icicle meshes);
 *  - 14.6 s the leap is seen from the ledge behind him, down the slope onto the skier, the sea
 *    beyond — not the shared over-the-skier angle.
 *
 * The extra shots stay inside the chamber or on the ledge (no dressing there), or reuse the shared
 * camera stations (CAVE_CAMS), so the dressing's camera clearance (seaCave.ts) covers them.
 */
import * as THREE from 'three';
import type { CaveCinematicContext, CaveCinematicExtras } from '../../../presentation/cave';
import { CAVE_CAMS } from '../../../../cinematic/CaveCinematic';
import { ease, pose } from '../../../../cinematic/Timeline';
import type { SeaCavePerch, SeaShots } from './seaCave';
import { turnedLook } from './seaFraming';

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
  const T = new THREE.Vector3(O.z, 0, -O.x);
  // perches: the portal column tops and the lintel of this cave's dressing (nearest dressing group)
  let perches: SeaCavePerch[] = [];
  let icicles: THREE.InstancedMesh | null = null;
  let seaShots: SeaShots | null = null;
  let best = Infinity;
  st.world.scene.traverse((o) => {
    if (o.name !== 'FjordSeaCave') return;
    const mouth = o.userData['mouth'] as THREE.Vector3 | undefined;
    const d = mouth ? mouth.distanceTo(M) : Infinity;
    if (d < best) {
      best = d;
      perches = (o.userData['perches'] as SeaCavePerch[]) ?? [];
      icicles = (o.getObjectByName('fjord-brow-icicles') as THREE.InstancedMesh | undefined) ?? null;
      seaShots = (o.userData['seaShots'] as SeaShots | undefined) ?? null;
    }
  });
  if (best > 5) {
    perches = [];
    icicles = null;
    seaShots = null;
  }
  const group = new THREE.Group();
  group.name = 'fjord-cave-gulls';
  st.world.scene.add(group);
  const G = gullMeshes();
  const gulls: Gull[] = [];
  // the brow perches first (in the slough shot's frame), then the highest causeway tops
  const tops = [...perches].sort((a, b) => (b.brow ? 1 : 0) - (a.brow ? 1 : 0) || b.p.y - a.p.y);
  const n = Math.min(14, tops.length);
  for (let i = 0; i < n; i++) {
    const home = tops[i]!.p.clone().add(new THREE.Vector3(Math.sin(i * 2.3) * 0.15, 0.05, Math.cos(i * 1.7) * 0.15));
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
    o.scale.setScalar(1.25);
    group.add(o);
    // scatter: out from the cliff and up, each its own way
    const side = T.clone().multiplyScalar(Math.sin(i * 1.9) * 3.5);
    const vel = O.clone().multiplyScalar(3.5 + (i % 3)).add(side).add(new THREE.Vector3(0, 2.6 + (i % 4) * 0.5, 0));
    gulls.push({ o, wl, wr, home, vel, ph: i * 0.7, t0: 2.5 + (i % 5) * 0.08, flying: false });
  }
  // folded wings while perched
  for (const g of gulls) {
    g.wl.rotation.set(0, -1.35, -0.25);
    g.wr.rotation.set(0, 1.35, 0.25);
  }

  // does the mouth look out over the sea? Only a cave on the inland side of the piste does (its
  // mouth faces −X across the piste toward the rim). Since round 4 the Fjord cuts its caves into the
  // sea side, mouth inland, so this is false for them — round 4 Phase B: the emergence and the leap
  // then take the dressing's sea-framing stations (seaFraming.ts: the frame with the most open water
  // and the Yeti in clear view) instead of losing the sea altogether.
  const coast = st.world.mountain.coast;
  const mouthToSea = coast ? Math.sign(O.x) === Math.sign(coast.rimX(M.z) - M.x) : false;
  const sea = seaShots as SeaShots | null;
  const ep = cave.exitPath;
  const pathAt = (s: number) => {
    // exitPath[i] lies at depth 14 − 0.75·i (the last one is the ledge)
    const i = THREE.MathUtils.clamp(Math.round((14 - s) / 0.75), 0, ep.length - 1);
    return ep[i]!.clone();
  };
  const yetiAt = () => st.yeti.root.position.clone();

  // --- shot overrides (later shots win over the shared ones covering the same time)
  // 2.4 s: tight on the brow, the gulls on the portal and the lintel against the black rock
  const brow = cave.lipTop.clone();
  const browLook = brow.clone().addScaledVector(O, 1.2).add(new THREE.Vector3(0, -1.2, 0));
  tl.shot({ start: 2.4, end: 3.8, from: () => pose(at(...CAVE_CAMS.slough0), browLook.clone().add(new THREE.Vector3(0, 0.6, 0)), 30), to: () => pose(at(...CAVE_CAMS.slough1), browLook.clone().add(new THREE.Vector3(0, 1.6, 0)), 34), handheld: 0.03 });
  // 7.9 s: the emergence from inside the cave
  if (mouthToSea) {
    const camIn = pathAt(3.6);
    const ceil = cave.clearanceAt(camIn.x, camIn.z);
    camIn.y += Math.min(1.25, Math.max(0.8, ceil - 1.2));
    camIn.addScaledVector(T, 0.6);
    const horizon = M.clone().addScaledVector(O, 220).setY(M.y - 40);
    tl.shot({
      start: 7.9,
      end: 11.0,
      from: () => pose(camIn, yetiAt().add(new THREE.Vector3(0, 1.5, 0)).lerp(horizon, 0.04), 56),
      to: () => pose(camIn.clone().addScaledVector(O, -0.4), yetiAt().add(new THREE.Vector3(0, 1.9, 0)).lerp(horizon, 0.06), 60),
      easing: ease.inOut,
      handheld: 0.015,
    });
  } else if (sea?.emerge) {
    // the sea lies behind the cave: from out on the snow to one side, the Yeti rising out of the
    // portal with the fjord beyond the cave's flank
    const e = sea.emerge;
    const toward = M.clone().sub(e.cam).setY(0).normalize();
    tl.shot({
      start: 7.9,
      end: 11.0,
      // (the frame turned by the station's yaw: the Yeti off-centre, the fjord on the open side)
      from: () => pose(e.cam, turnedLook(e.cam, yetiAt().add(new THREE.Vector3(0, 1.6, 0)), e.yaw), e.fov),
      to: () => pose(e.cam.clone().addScaledVector(toward, 1.2), turnedLook(e.cam.clone().addScaledVector(toward, 1.2), yetiAt().add(new THREE.Vector3(0, 1.9, 0)), e.yaw), e.fov - 2),
      easing: ease.inOut,
      handheld: 0.015,
    });
  } else {
    // no station sees the sea: a high three-quarter angle across the portal
    tl.shot({
      start: 7.9,
      end: 11.0,
      from: () => pose(M.clone().addScaledVector(O, 9).addScaledVector(T, 7).add(new THREE.Vector3(0, 5.5, 0)), yetiAt().add(new THREE.Vector3(0, 1.6, 0)), 46),
      to: () => pose(M.clone().addScaledVector(O, 8.4).addScaledVector(T, 6.2).add(new THREE.Vector3(0, 5.0, 0)), yetiAt().add(new THREE.Vector3(0, 2.0, 0)), 46),
      handheld: 0.02,
    });
  }
  // 11.0 s: the roar, opened wider for the plume and the falling icicles
  tl.shot({ start: 11.0, end: 12.3, from: () => pose(at(...CAVE_CAMS.roar0), M.clone().add(new THREE.Vector3(0, 3.6, 0)).addScaledVector(O, 1.2), 56), to: () => pose(at(...CAVE_CAMS.roar1), M.clone().add(new THREE.Vector3(0, 3.8, 0)).addScaledVector(O, 1.2), 52) });
  // 14.6 s: the leap, from the ledge behind him, down onto the skier (and the sea beyond)
  const P = st.phys.s.pos.clone();
  // (mouth facing inland: the dressing's sea-framing station, out on the slope looking back up at him)
  const ledgeCam = !mouthToSea && sea?.leap ? sea.leap.cam.clone() : cave.ledge.clone().addScaledVector(O, -2.6).addScaledVector(T, 1.4).add(new THREE.Vector3(0, 2.7, 0));
  const leapYaw = !mouthToSea && sea?.leap ? sea.leap.yaw : 0;
  const leapLook = () => turnedLook(ledgeCam, yetiAt().add(new THREE.Vector3(0, 1.6, 0)).lerp(P.clone().add(new THREE.Vector3(0, 1.0, 0)), 0.42), leapYaw);
  tl.shot({ start: 14.6, end: 16.95, from: () => pose(ledgeCam, leapLook(), 56), to: () => pose(ledgeCam.clone().add(new THREE.Vector3(0, 0.4, 0)).addScaledVector(O, 1.2), leapLook(), 60) });
  const followPos = new THREE.Vector3();
  const followLook = new THREE.Vector3();
  const followPose = () => {
    const s = st.phys.s;
    st.follow.idealPose({ pos: s.pos, vel: s.vel, heading: s.heading, grounded: s.grounded, crashed: false, speed: s.speed }, followPos, followLook);
    return pose(followPos, followLook, 64);
  };
  tl.shot({ start: 16.95, end: 18.0, from: () => pose(ledgeCam.clone().add(new THREE.Vector3(0, 0.4, 0)).addScaledVector(O, 1.2), leapLook(), 60), via: () => pose(P.clone().add(new THREE.Vector3(0, 3.2, -5)), P.clone().add(new THREE.Vector3(0, 1.2, 4)), 58), to: followPose, easing: ease.inOutCubic });

  tl.at(2.5, () => {
    st.audio.playCue('gull', M.clone().add(new THREE.Vector3(0, 8, 0)));
    st.hud.caption('[gulls scream and scatter]', 1.4);
  });
  tl.at(3.1, () => st.audio.playCue('gull', M.clone().add(new THREE.Vector3(4, 10, 3))));
  tl.at(9.0, () => {
    // his weight on the frozen tide pool: the sea ice cracks under him
    const p = yetiAt();
    st.world.particles.emit({ x: p.x, y: p.y + 0.1, z: p.z, vx: 0, vy: 1.6, vz: 0, spread: 1.2, size: 0.12, life: 0.9, count: 30, gravity: 1, drag: 0.4, grow: 0, alpha: 1, color: 0.92 });
    st.audio.playImpact('rock-light', 0.35);
  });
  tl.at(11.05, () => {
    // freezing spray and sea smoke blown out of the mouth: a low cloud rolling out over the ledge
    // and a burst of droplets (round 2's tall plume read as a shaft of light, or filled the lens)
    for (let k = 0; k < 4; k++)
      st.world.particles.emit({ x: M.x + O.x * 0.6 + T.x * (k - 1.5) * 1.2, y: M.y + 0.5 + k * 0.25, z: M.z + O.z * 0.6 + T.z * (k - 1.5) * 1.2, vx: O.x * 2.6, vy: 0.35, vz: O.z * 2.6, spread: 1.4, size: 1.5, life: 2.6, count: 10, gravity: 0.05, drag: 1.2, grow: 2.2, alpha: 0.26, color: 0.97 });
    st.world.particles.emit({ x: M.x + O.x * 0.5, y: M.y + 1.8, z: M.z + O.z * 0.5, vx: O.x * 4.5, vy: 3.6, vz: O.z * 4.5, spread: 2.4, size: 0.1, life: 1.3, count: 90, gravity: 1, drag: 0.5, grow: 0.1, alpha: 1, color: 1 });
  });
  // the icicles under the lintel let go one after another on the roar and shatter below
  const ice = icicles as THREE.InstancedMesh | null;
  const ics = (ice?.userData['icicles'] as Array<{ top: THREE.Vector3; len: number; r: number }> | undefined) ?? [];
  const falls = ics.map((ic, i) => ({ ic, t0: 11.2 + ((i * 0.37) % 1) * 0.6, y: 0, v: 0, done: false, spin: (i % 2 ? 1 : -1) * (1 + (i % 3)) }));
  const tmp = new THREE.Object3D();
  if (falls.length) tl.at(11.25, () => st.audio.playImpact('rock-light', 0.5));

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
      if (ice && falls.length) {
        let dirty = false;
        falls.forEach((f, i) => {
          if (f.done || t < f.t0) return;
          f.v += 9.81 * dt;
          f.y += f.v * dt;
          const c = f.ic.top.clone().add(new THREE.Vector3(0, -f.ic.len / 2 - f.y, 0));
          const g = st.world.mountain.heightAt(c.x, c.z);
          const fy = Math.max(g, cave.floorHeightAt(c.x, c.z));
          if (c.y - f.ic.len / 2 <= fy) {
            f.done = true;
            tmp.scale.setScalar(0);
            st.world.particles.emit({ x: c.x, y: fy + 0.1, z: c.z, vx: 0, vy: 2.2, vz: 0, spread: 0.8, size: 0.09, life: 0.8, count: 16, gravity: 1, drag: 0.3, grow: 0, alpha: 1, color: 1 });
          } else {
            tmp.position.copy(c);
            tmp.rotation.set(0, 0, Math.min(1.2, f.y * 0.15) * f.spin * 0.3);
            tmp.scale.set(f.ic.r, f.ic.len, f.ic.r);
          }
          tmp.updateMatrix();
          ice.setMatrixAt(i, tmp.matrix);
          dirty = true;
        });
        if (dirty) ice.instanceMatrix.needsUpdate = true;
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
