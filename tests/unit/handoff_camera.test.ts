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
import { CAVE_GATHER_AT, CAVE_LEAP_AT, CAVE_TURN_AT } from '../../src/cinematic/caveHandoff';
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
  const skierHead = P.clone().add(new THREE.Vector3(0, 1.5, 0));
  const leapCam = P.clone().addScaledVector(toCave, -3.6).add(new THREE.Vector3(0, 1.35, 1.3));
  const yetiLook = sp.pos.clone().add(new THREE.Vector3(0, 1.6, 0)).lerp(skierHead, 0.34);
  const turnFrom = pose(leapCam.clone().add(new THREE.Vector3(0, 0.1, 0)), yetiLook, 45);
  // the gameplay camera (GameSession.gameplayPose = the snap finishCave does)
  const cam = new THREE.PerspectiveCamera(64, 16 / 9, 0.1, 5000);
  const fc = new FollowCamera(cam, m, f);
  fc.snap(tg);
  const forward = pose(cam.position, fc.lookTarget, cam.fov);
  return { m, f, e, tg, sp, turnFrom, forward, pivot: P.clone().add(new THREE.Vector3(0, 1.2, 0)), fc, cam };
}

describe('W-076 decision 1: the hand-off camera faces the run', () => {
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
        // the skier in frame all along
        const toSkier = tg.pos.clone().add(new THREE.Vector3(0, 1, 0)).sub(p.pos).normalize();
        expect(deg(d.angleTo(toSkier)), `skier off frame at ${i}/${n}`).toBeLessThan(32);
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
