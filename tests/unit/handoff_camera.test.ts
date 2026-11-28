/**
 * W-076, owner's decision 1: control returns on the forward gameplay camera.
 *
 * The cave cinematic's last beat (CAVE_TURN_AT → CAVE_LEAP_AT) swings around the skier from the shot of
 * the Yeti on the ledge to the follow camera's own snapped pose — the pose a skip gives — so:
 * - the first controllable frame looks downhill, with the route ahead in view;
 * - the swing is continuous with the shot before it, never turns more than 3.6° in a 60 fps frame,
 *   keeps the skier in frame, stays above the snow and never passes through the skier;
 * - its last frame is exactly the gameplay camera's first (no jump at the hand-off);
 * - after the hand-off the follow camera does not look back on its own (no scripted look-back).
 * (Replaces handoff_blend.test.ts: the 3.5 s automatic look-back it tested is gone.)
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import '../../src/world/biomes';
import { buildMountain, makeCourse, worldSeed } from '../../src/game/CourseConfig';
import { ObstacleField } from '../../src/physics/obstacles';
import { FollowCamera } from '../../src/camera/FollowCamera';
import { yetiSpawnAfterCinematic } from '../../src/yeti/spawn';
import { CAVE_GATHER_AT, CAVE_LEAP_AT, CAVE_TURN_AT, LEAP_SETUP, leapSetupCamera, leapSetupLook } from '../../src/cinematic/caveHandoff';
import { orbitPose } from '../../src/cinematic/orbit';
import { Timeline, ease, pose, type CamPose } from '../../src/cinematic/Timeline';

const deg = (r: number) => (r * 180) / Math.PI;
const dirOf = (p: CamPose) => p.look.clone().sub(p.pos).normalize();

function scenario(biome: 'alpine' | 'fjord' | 'whiteout', speed: number, difficulty: 'normal' | 'hard' = 'normal') {
  const c = makeCourse('classic', 'sprint', { biome, difficulty });
  const m = buildMountain(c);
  const f = new ObstacleField(m, worldSeed(c));
  const e = m.profile.encounters(0, 1e6)[0]!;
  f.ensure(e.triggerZ - 300, e.triggerZ + 300);
  const z = e.triggerZ + 1;
  const x = m.routeX(z);
  const hd = Math.atan2(m.routeX(z + 1) - x, 1);
  const tg = { pos: new THREE.Vector3(x, m.heightAt(x, z), z), vel: new THREE.Vector3(Math.sin(hd) * speed, 0, Math.cos(hd) * speed), heading: hd, grounded: true, crashed: false, speed };
  const sp = yetiSpawnAfterCinematic(m, e.anchor);
  // CaveCinematic's leap shot: behind the skier on the line to the cave, aimed at the Yeti on the ledge
  const P = tg.pos;
  const toCave = new THREE.Vector3(sp.pos.x - P.x, 0, sp.pos.z - P.z).normalize();
  // (round 4) the game's own set-up camera (caveHandoff.leapSetupCamera: offsets and terrain lift); the
  // skier's head at LEAP_SETUP.head (the look-back pose's skull: 1.42 m bone + ~0.1 m, measured on SkierModel)
  const skierHead = P.clone().add(new THREE.Vector3(0, LEAP_SETUP.head, 0));
  const downhill = new THREE.Vector3(Math.sin(hd), 0, Math.cos(hd));
  const leapCam = leapSetupCamera(P, toCave, downhill, sp.pos.clone().add(new THREE.Vector3(0, 1.6, 0)), (xx, zz) => m.heightAt(xx, zz));
  const yetiLook = leapSetupLook(leapCam, sp.pos.clone().add(new THREE.Vector3(0, 1.6, 0)), skierHead);
  const turnFrom = pose(leapCam.clone().add(new THREE.Vector3(0, 0.1, 0)), yetiLook, LEAP_SETUP.fov);
  // the gameplay camera (GameSession.gameplayPose = the snap finishCave does)
  const cam = new THREE.PerspectiveCamera(64, 16 / 9, 0.1, 5000);
  const fc = new FollowCamera(cam, m, f);
  fc.snap(tg);
  const forward = pose(cam.position, fc.lookTarget, cam.fov);
  return { m, f, e, tg, sp, skierHead, turnFrom, forward, pivot: P.clone().add(new THREE.Vector3(0, 1.2, 0)), fc, cam };
}

function ndcOf(p: CamPose, pt: THREE.Vector3) {
  const c = new THREE.PerspectiveCamera(p.fov, 16 / 9, 0.1, 5000);
  c.position.copy(p.pos);
  c.lookAt(p.look);
  c.updateMatrixWorld();
  return pt.clone().project(c);
}

describe('W-076 decision 1: the hand-off camera faces the run', () => {
  for (const biome of ['alpine', 'fjord', 'whiteout'] as const)
    it(`${biome}: the leap set-up shot shows the skier's head and the Yeti on the ledge inside the letterbox (review C, C1)`, () => {
      const { sp, skierHead, turnFrom } = scenario(biome, 10, 'normal');
      const head = ndcOf(turnFrom, skierHead);
      const yeti = ndcOf(turnFrom, sp.pos.clone().add(new THREE.Vector3(0, 1.6, 0)));
      for (const [what, v] of [['skier', head], ['Yeti', yeti]] as const) {
        expect(Math.abs(v.y), `${what} y`).toBeLessThan(0.75);
        expect(Math.abs(v.x), `${what} x`).toBeLessThan(0.9);
        expect(v.z, `${what} in front`).toBeLessThan(1);
      }
      // (round 4, review C R3-C2) the skier's shoulders clear the bottom bar (bars: |y| > 0.78 at 540p),
      // not only the top of the head; the Yeti stands clear of the top bar
      const shoulders = ndcOf(turnFrom, skierHead.clone().add(new THREE.Vector3(0, -0.3, 0)));
      expect(shoulders.y, 'shoulders above the bottom bar').toBeGreaterThan(-0.74);
      expect(yeti.y, 'the Yeti below the top bar').toBeLessThan(0.74);
      // (round 5, review C4-3: the frames show him in a tuck — the head ~1.05 m, the waist ~0.7 m — and the
      // round-4 test measured an upright 1.5 m head) the tucked skier's head and waist clear the bottom bar
      const P = skierHead.clone().add(new THREE.Vector3(0, -LEAP_SETUP.head, 0));
      // (round 6, review C5-2: in the hand-off strips the tucked skier's legs were under the bar) and his
      // knees and boots too
      for (const [what, h] of [['tucked head', 1.05], ['waist', 0.7], ['knees', 0.35], ['boots', 0.1]] as const) {
        const v = ndcOf(turnFrom, P.clone().add(new THREE.Vector3(0, h, 0)));
        expect(v.y, `${biome}: ${what} above the bottom bar`).toBeGreaterThan(-0.7);
      }
    });

  it('orbitPose: ends exactly on both poses, takes the shorter way round, keeps its distance', () => {
    const c = new THREE.Vector3(0, 1, 0);
    const a = pose(new THREE.Vector3(5, 3, 0), new THREE.Vector3(-10, 1, 0), 45);
    const b = pose(new THREE.Vector3(0, 3, -6), new THREE.Vector3(0, 1, 15), 62);
    const p0 = orbitPose(a, b, c, 0);
    const p1 = orbitPose(a, b, c, 1);
    expect(p0.pos.distanceTo(a.pos)).toBeLessThan(1e-9);
    expect(p0.look.distanceTo(a.look)).toBeLessThan(1e-9);
    expect(p1.pos.distanceTo(b.pos)).toBeLessThan(1e-9);
    expect(p1.look.distanceTo(b.look)).toBeLessThan(1e-9);
    expect(p1.fov).toBe(62);
    // +x (az 90°) to -z (az 180°): the short way is through +x/-z, never through -x
    for (let t = 0; t <= 1; t += 0.05) {
      const p = orbitPose(a, b, c, t);
      expect(p.pos.x).toBeGreaterThan(-1e-9);
      expect(Math.hypot(p.pos.x, p.pos.z)).toBeGreaterThanOrEqual(5 - 1e-9);
    }
  });

  it('Timeline: an orbit shot is evaluated on the orbit', () => {
    const tl = new Timeline();
    const c = new THREE.Vector3(0, 1, 0);
    const a = pose(new THREE.Vector3(5, 3, 0), new THREE.Vector3(-10, 1, 0), 45);
    const b = pose(new THREE.Vector3(0, 3, -6), new THREE.Vector3(0, 1, 15), 62);
    tl.shot({ start: 0, end: 1, from: () => a, to: () => b, orbit: () => c, easing: ease.linear });
    const cam = new THREE.PerspectiveCamera();
    tl.time = 0.5;
    tl.apply(cam);
    expect(cam.position.distanceTo(orbitPose(a, b, c, 0.5).pos)).toBeLessThan(1e-9);
  });

  it('the beats: the Yeti takes his place at a cut before the turn, the turn ends the cinematic', () => {
    expect(CAVE_GATHER_AT).toBeLessThan(CAVE_TURN_AT);
    expect(CAVE_LEAP_AT - CAVE_TURN_AT).toBeGreaterThanOrEqual(0.8);
    expect(CAVE_LEAP_AT - CAVE_TURN_AT).toBeLessThanOrEqual(1.2);
  });

  const cases: Array<[biome: 'alpine' | 'fjord' | 'whiteout', speed: number, diff: 'normal' | 'hard']> = [];
  for (const b of ['alpine', 'fjord', 'whiteout'] as const) for (const s of [4, 16]) for (const d of ['normal', 'hard'] as const) cases.push([b, s, d]);
  for (const [biome, speed, diff] of cases)
    it(`${biome}, ${diff}, arriving at ${speed} m/s: the swing is smooth and lands on the forward gameplay view`, () => {
      const { m, tg, turnFrom, forward, pivot, fc, cam } = scenario(biome, speed, diff);
      const dt = 1 / 60;
      const n = Math.round((CAVE_LEAP_AT - CAVE_TURN_AT) / dt);
      let prev = dirOf(turnFrom);
      let maxTurn = 0;
      let total = 0;
      for (let i = 1; i <= n; i++) {
        const p = orbitPose(turnFrom, forward, pivot, ease.inOut(i / n));
        const d = dirOf(p);
        const step = deg(d.angleTo(prev));
        maxTurn = Math.max(maxTurn, step);
        total += step;
        prev = d;
        // the skier (body, 1 m up) inside the letterboxed frame all along (review C, C1: a cone test
        // passed a skier hidden under the bar) — the bars cover 11 vh top and bottom: |ndc y| < 0.78
        const ndc = ndcOf(p, tg.pos.clone().add(new THREE.Vector3(0, 1, 0)));
        expect(Math.abs(ndc.y), `skier under the letterbox at ${i}/${n}`).toBeLessThan(0.78);
        expect(Math.abs(ndc.x), `skier off the side at ${i}/${n}`).toBeLessThan(1);
        // above the snow, and clear of the skier
        expect(p.pos.y - m.heightAt(p.pos.x, p.pos.z), 'camera under the snow').toBeGreaterThan(0.5);
        expect(p.pos.distanceTo(pivot), 'camera through the skier').toBeGreaterThan(2.5);
      }
      expect(maxTurn, `largest frame turn (total ${total.toFixed(0)}°)`).toBeLessThan(3.6);
      // the last frame is the gameplay camera's pose
      const last = orbitPose(turnFrom, forward, pivot, 1);
      expect(last.pos.distanceTo(cam.position)).toBeLessThan(1e-6);
      expect(last.look.distanceTo(fc.lookTarget)).toBeLessThan(1e-6);
      // that view looks down the run: horizontal direction within 25° of the route's heading, pitched
      // down, and a point 30 m down the route is in frame (16:9 at fov 62–64: ±27° vertical, ±46° horizontal)
      const d = dirOf(last);
      const head = new THREE.Vector3(Math.sin(tg.heading), 0, Math.cos(tg.heading));
      expect(deg(new THREE.Vector3(d.x, 0, d.z).normalize().angleTo(head))).toBeLessThan(25);
      expect(d.y).toBeLessThan(0);
      const z30 = tg.pos.z + 30;
      const ahead = new THREE.Vector3(m.routeX(z30), m.heightAt(m.routeX(z30), z30) + 0.5, z30);
      const toAhead = ahead.sub(last.pos).normalize();
      expect(deg(d.angleTo(toAhead)), 'the route 30 m ahead in view').toBeLessThan(25);
    });

  it('(review B, B1) a look-back held into the cave does not survive the hand-off snap', () => {
    const { tg, fc, cam } = scenario('alpine', 10, 'normal');
    fc.lookBack = 1;
    for (let i = 0; i < 90; i++) fc.update(1 / 60, tg);
    expect(cam.getWorldDirection(new THREE.Vector3()).z).toBeLessThan(-0.3);
    // finishCave: the look-back is released, then the camera is snapped
    fc.lookBack = 0;
    fc.snap(tg);
    expect(cam.getWorldDirection(new THREE.Vector3()).z, 'forward on the first controllable frame').toBeGreaterThan(0.3);
  });

  it('(review C, C4) a camera orbit from before the cave is forgotten (resetOrbit at the cave start)', () => {
    const { tg, fc, cam } = scenario('alpine', 10, 'normal');
    const ref = cam.position.clone();
    fc.orbit(1.2, 0.3);
    fc.snap(tg);
    expect(cam.position.distanceTo(ref)).toBeGreaterThan(1);
    fc.resetOrbit();
    fc.snap(tg);
    expect(cam.position.distanceTo(ref)).toBeLessThan(1e-6);
  });

  it('after the hand-off the follow camera does not look back by itself; held look-back still works and is released', () => {
    const { tg, fc, cam } = scenario('alpine', 10, 'normal');
    const dt = 1 / 60;
    const fwd = () => cam.getWorldDirection(new THREE.Vector3());
    for (let i = 0; i < 240; i++) {
      fc.update(dt, tg);
      expect(fwd().z, 'facing downhill').toBeGreaterThan(0.3);
    }
    fc.lookBack = 1;
    for (let i = 0; i < 90; i++) fc.update(dt, tg);
    expect(fwd().z, 'manual look-back faces uphill').toBeLessThan(-0.3);
    fc.lookBack = 0;
    for (let i = 0; i < 90; i++) fc.update(dt, tg);
    expect(fwd().z).toBeGreaterThan(0.3);
  });
});
