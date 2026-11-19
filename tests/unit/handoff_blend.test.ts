/**
 * W-076 review C (C1, C6, C7): the watched cave hand-off's camera. The follow camera's own look-back
 * view holds the skier in the foreground and the leaping Yeti behind them until the landing (+0.35 s),
 * then turns to the run at no more than ~3° per frame (60 fps), ending exactly on the normal follow
 * camera; the first 0.5 s ease out of the cinematic's last shot with no jump.
 * (Earlier versions: a quaternion slerp onto itself kept the shot's direction and snapped at the end;
 * then a straight-line aim blend whip-panned ~105–127° just before the landing.)
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import '../../src/world/biomes';
import { buildMountain, makeCourse, worldSeed } from '../../src/game/CourseConfig';
import { ObstacleField } from '../../src/physics/obstacles';
import { FollowCamera } from '../../src/camera/FollowCamera';
import { HANDOFF_CAM, lookBackAt, releaseHandoffOnInput, shotBlend, type HandoffBlend } from '../../src/camera/handoffBlend';
import { YetiAI } from '../../src/yeti/YetiAI';
import { yetiSpawnAfterCinematic } from '../../src/yeti/spawn';
import { startCanonicalChase } from '../../src/cinematic/caveHandoff';
import { PHYS_DT } from '../../src/physics/SkierPhysics';

const deg = (r: number) => (r * 180) / Math.PI;

function scenario(biome: 'alpine' | 'fjord' | 'whiteout') {
  const c = makeCourse('classic', 'sprint', { biome });
  const m = buildMountain(c);
  const f = new ObstacleField(m, worldSeed(c));
  const e = m.profile.encounters(0, 1e6)[0]!;
  const mk = () => {
    const cam = new THREE.PerspectiveCamera(64, 16 / 9, 0.1, 5000);
    return { cam, fc: new FollowCamera(cam, m, f) };
  };
  const target = (t: number) => {
    const z = e.triggerZ + 1 + 16 * t;
    const x = m.routeX(z);
    const x2 = m.routeX(z + 1);
    const hd = Math.atan2(x2 - x, 1);
    return { pos: new THREE.Vector3(x, m.heightAt(x, z), z), vel: new THREE.Vector3(Math.sin(hd) * 16, 0, Math.cos(hd) * 16), heading: hd, grounded: true, crashed: false, speed: 16 };
  };
  // the Yeti: the canonical start, flown by the AI (its leap and landing, as in play)
  const ai = new YetiAI(m, f);
  const sp = yetiSpawnAfterCinematic(m, e.anchor);
  startCanonicalChase(ai, sp, (x, z) => m.heightAt(x, z));
  let simT = 0;
  const yetiAt = (t: number) => {
    while (simT < t) {
      const tg = target(simT);
      ai.update(PHYS_DT, { pos: tg.pos, vel: tg.vel, airborne: false });
      simT += PHYS_DT;
    }
    return ai;
  };
  // the cinematic's last shot (CaveCinematic leapCam): behind the skier's position on the line to the
  // cave, aimed at the Yeti on the ledge (lerped a third of the way to the skier's head)
  const P = target(0).pos;
  const toCave = new THREE.Vector3(sp.pos.x - P.x, 0, sp.pos.z - P.z).normalize();
  const shotPos = P.clone().addScaledVector(toCave, -3.6).add(new THREE.Vector3(0, 1.35, 1.3));
  const shotLook = sp.pos.clone().add(new THREE.Vector3(0, 1.6, 0)).lerp(P.clone().add(new THREE.Vector3(0, 1.5, 0)), 0.34);
  f.ensure(e.triggerZ - 300, e.triggerZ + 300);
  return { mk, target, yetiAt, shotPos, shotLook, f };
}

describe('cave hand-off camera', () => {
  it('the look-back schedule: held until the landing + 0.35 s, released by a smoothstep over HANDOFF_CAM.release s, then over', () => {
    const B: HandoffBlend = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: 46, t: 1.0, landedAt: null };
    expect(lookBackAt(B)).toBe(1);
    B.landedAt = 2.0;
    B.t = 2.0 + HANDOFF_CAM.landHold - 1e-6;
    expect(lookBackAt(B)).toBe(1);
    let prev = 1;
    let maxStep = 0;
    for (B.t = 2.0 + HANDOFF_CAM.landHold; ; B.t += 1 / 60) {
      const v = lookBackAt(B);
      if (v === null) break;
      maxStep = Math.max(maxStep, prev - v);
      prev = v;
    }
    // 180° of look-back: the largest frame step in degrees of turn
    expect(maxStep * 180).toBeLessThan(3.1);
  });

  for (const biome of ['alpine', 'fjord', 'whiteout'] as const)
    it(`${biome}: the skier stays in frame, the view looks back up at the leap until the landing, and turns ≤ 3.6°/frame (the ease out of the shot included) to end on the follow camera`, () => {
      const { mk, target, yetiAt, shotPos, shotLook, f } = scenario(biome);
      const A = mk(); // the hand-off camera
      const N = mk(); // a follow camera with no hand-off (the reference it must end on)
      const B: HandoffBlend = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: 46, t: 0, landedAt: null };
      // the shot, then (as GameSession.finishCave) the follow camera starts already looking back at
      // the Yeti before it is snapped
      B.pos.copy(shotPos);
      B.quat.setFromRotationMatrix(new THREE.Matrix4().lookAt(shotPos, shotLook, new THREE.Vector3(0, 1, 0)));
      const yeti = yetiAt(0);
      A.fc.lookBackOverride = 1;
      A.fc.lookBackAim = yeti.pos;
      A.fc.snap(target(0));
      N.fc.snap(target(0));
      const dt = 1 / 60;
      let prevDir: THREE.Vector3 | null = null;
      let maxTurn = 0;
      let landing = Infinity;
      let done = false;
      for (let i = 0; i < 60 * 8 && !done; i++) {
        B.t = i * dt;
        yetiAt(B.t);
        if (!yeti.airborne && B.landedAt === null) {
          B.landedAt = B.t;
          landing = B.t;
        }
        A.fc.lookBackOverride = lookBackAt(B);
        const tg = target(B.t);
        A.fc.update(dt, tg);
        N.fc.update(dt, tg);
        shotBlend(A.cam, B);
        A.cam.updateMatrixWorld();
        const d = A.cam.getWorldDirection(new THREE.Vector3());
        if (i === 0) {
          // no jump out of the shot
          expect(A.cam.position.distanceTo(B.pos)).toBeLessThan(1e-6);
        }
        // every frame, the ease out of the shot included (review C, C8)
        if (prevDir) maxTurn = Math.max(maxTurn, deg(d.angleTo(prevDir)));
        prevDir = d;
        // the skier is in front of the camera all along (in frame)
        const toSkier = tg.pos.clone().add(new THREE.Vector3(0, 1, 0)).sub(A.cam.position).normalize();
        if (B.t > HANDOFF_CAM.shot) expect(deg(d.angleTo(toSkier))).toBeLessThan(40);
        // until the landing the view faces back up the hill (the leap is behind the skier)
        if (B.t > HANDOFF_CAM.shot && B.t < landing + HANDOFF_CAM.landHold) expect(d.z).toBeLessThan(-0.3);
        // (review C, C11) no tree crown on the line from the camera to the Yeti, from 0.6 s to the touchdown
        if (B.t > 0.6 && B.t <= landing) {
          const ids: number[] = [];
          const a = A.cam.position;
          const b = yeti.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
          f.grid.query((a.x + b.x) / 2, (a.z + b.z) / 2, a.distanceTo(b) / 2 + 4, ids);
          for (const id of ids) {
            const o = f.get(id)!;
            if (o.kind !== 'tree') continue;
            const dx = b.x - a.x;
            const dz = b.z - a.z;
            const u = Math.max(0, Math.min(1, ((o.x - a.x) * dx + (o.z - a.z) * dz) / (dx * dx + dz * dz)));
            const off = Math.hypot(a.x + dx * u - o.x, a.z + dz * u - o.z);
            const lineY = a.y + (b.y - a.y) * u;
            expect(off < o.softR + 0.5 && lineY < o.y + o.height + 3, `a tree at ${o.x.toFixed(1)}, ${o.z.toFixed(1)} hides the Yeti at ${B.t.toFixed(2)} s`).toBe(false);
          }
        }
        // the touchdown in view: within the horizontal half-angle of view, with a margin (48° at 16:9 / fov 64)
        if (Math.abs(B.t - landing) < 1e-9) {
          const toYeti = yeti.pos.clone().add(new THREE.Vector3(0, 1.5, 0)).sub(A.cam.position).normalize();
          // and clear of the top HUD band (the Yeti bar, the finish panel): within ±18° vertically of centre
          expect(deg(d.angleTo(toYeti)), 'the Yeti at touchdown').toBeLessThan(30);
          expect(Math.abs(deg(Math.asin(toYeti.y) - Math.asin(d.y))), 'the Yeti at touchdown, vertically').toBeLessThan(18);
        }
        if (A.fc.lookBackOverride === null && B.t > landing) {
          A.fc.lookBackAim = null;
          done = true;
        }
      }
      expect(done).toBe(true);
      expect(maxTurn).toBeLessThan(3.6);
      // and it settles into the plain follow camera (its own smoothing converges within a second)
      for (let i = 0; i < 60; i++) {
        A.fc.update(dt, target(B.t + i * dt));
        N.fc.update(dt, target(B.t + i * dt));
      }
      expect(deg(A.cam.getWorldDirection(new THREE.Vector3()).angleTo(N.cam.getWorldDirection(new THREE.Vector3())))).toBeLessThan(1);
    });

  it('the player ends the look-back: steering starts the turn to the run at once; it never lasts past 3 s without a landing (reviews E N1, F N1)', () => {
    const B: HandoffBlend = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: 46, t: 0.8, landedAt: null };
    releaseHandoffOnInput(B, false);
    expect(lookBackAt(B)).toBe(1);
    releaseHandoffOnInput(B, true);
    // the release begins now: just under 1 this frame, done HANDOFF_CAM.release s later
    expect(lookBackAt(B)!).toBeLessThanOrEqual(1);
    B.t += HANDOFF_CAM.release + 1e-6;
    expect(lookBackAt(B)).toBeNull();
    const C: HandoffBlend = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: 46, t: 3.01, landedAt: null };
    releaseHandoffOnInput(C, false);
    expect(C.landedAt).not.toBeNull();
    // already releasing: acting again does not restart it
    const at = C.landedAt;
    C.t += 0.5;
    releaseHandoffOnInput(C, true);
    expect(C.landedAt).toBe(at);
  });
});
