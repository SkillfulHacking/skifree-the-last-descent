/**
 * Round 5 (W-098, review E4-3): Reduce Camera Motion reaches every cinematic timeline — a moving shot
 * becomes a held view of its end framing (a cut) and the handheld drift stops, read live.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Timeline, pose } from '../../src/cinematic/Timeline';

const cam = () => new THREE.PerspectiveCamera(50, 1, 0.1, 1000);

describe('Timeline calm (Reduce Camera Motion)', () => {
  const build = () => {
    const tl = new Timeline();
    tl.shot({ start: 0, end: 4, from: () => pose(new THREE.Vector3(0, 10, 0), new THREE.Vector3(0, 0, 10), 60), to: () => pose(new THREE.Vector3(20, 2, 0), new THREE.Vector3(20, 0, 10), 40), handheld: 0.5 });
    return tl;
  };

  it('moves along the shot normally', () => {
    const tl = build();
    const c = cam();
    tl.time = 1;
    tl.apply(c);
    const p1 = c.position.clone();
    tl.time = 3;
    tl.apply(c);
    expect(c.position.distanceTo(p1)).toBeGreaterThan(5);
  });

  it('with calm on, holds the end framing for the whole shot, without handheld drift', () => {
    const tl = build();
    let calm = true;
    tl.calm = () => calm;
    const c = cam();
    const seen: THREE.Vector3[] = [];
    for (const t of [0.1, 1, 2.2, 3.9]) {
      tl.time = t;
      tl.apply(c);
      seen.push(c.position.clone());
      expect(c.fov).toBeCloseTo(40, 6);
    }
    for (const p of seen) expect(p.distanceTo(new THREE.Vector3(20, 2, 0))).toBeLessThan(1e-9);
    // read live: switched off mid-shot, the move resumes
    calm = false;
    tl.time = 1;
    tl.apply(c);
    expect(c.position.distanceTo(new THREE.Vector3(20, 2, 0))).toBeGreaterThan(5);
  });
});
