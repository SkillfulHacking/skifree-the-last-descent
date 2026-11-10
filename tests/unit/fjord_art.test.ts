/**
 * Fjord round-2 art/cinematic regressions (visual contracts that can be checked headless):
 *  - the sea-cave dressing keeps every prop out of the shared cave-cinematic lenses (C2);
 *  - the harbour victory beat sheet: the title lands after the reveal move, results after the hold;
 *  - the Fjord islands are clustered, not an even scatter (A D2).
 */
import { describe, expect, it, beforeAll } from 'vitest';
import * as THREE from 'three';
import { caveCameraSightlines, CAVE_CAMS } from '../../src/cinematic/CaveCinematic';
import { clearOfCaveCameras, dressSeaCave } from '../../src/world/biomes/fjord/views/seaCave';
import { HARBOUR_BEATS } from '../../src/world/biomes/fjord/views/harbourVictory';
import { PLUNGE_TIMES } from '../../src/world/biomes/fjord/views/harbour';
import '../../src/world/biomes';
import { Coast } from '../../src/world/coast';
import { buildMountain, makeCourse } from '../../src/game/CourseConfig';

/** a no-op 2D canvas so the canvas textures can be built under node */
function stubDocument() {
  const ctx = new Proxy(
    {},
    {
      get: (_t, k) => {
        if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop() {} });
        if (k === 'roundRect') return undefined;
        return () => {};
      },
      set: () => true,
    },
  );
  (globalThis as unknown as { document: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
}

function fakeCave(outX: number) {
  const mouth = new THREE.Vector3(100, 50, 400);
  const outward = new THREE.Vector3(outX, 0, 0);
  const exitPath: THREE.Vector3[] = [];
  for (let s = 14; s > -2.2; s -= 0.75) exitPath.push(mouth.clone().addScaledVector(outward, -s));
  const ledge = mouth.clone().addScaledVector(outward, 2.2);
  exitPath.push(ledge.clone());
  // a rock face standing on the mouth line (what the lintel and portal columns are seated on)
  const group = new THREE.Group();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(32, 20, 64, 40), new THREE.MeshBasicMaterial());
  face.name = 'cave-rock';
  face.rotation.y = Math.PI / 2;
  face.position.copy(mouth).add(new THREE.Vector3(0, 9, 0)).addScaledVector(outward, -0.3);
  group.add(face);
  return {
    mouth,
    outward,
    lipTop: mouth.clone().add(new THREE.Vector3(0, 8.5, 0)).addScaledVector(outward, -0.3),
    exitPath,
    ledge,
    floorHeightAt: () => 50,
    clearanceAt: () => 5,
    group,
  };
}

describe('Fjord sea cave: props keep out of the cave-cinematic cameras', () => {
  beforeAll(stubDocument);
  it('the clearance test rejects a prop on a sight line and accepts one well aside', () => {
    const cave = fakeCave(-1);
    const lines = caveCameraSightlines(cave.mouth, cave.outward, cave.lipTop);
    expect(lines.length).toBeGreaterThan(8);
    const emerge = cave.mouth.clone().addScaledVector(cave.outward, CAVE_CAMS.emerge0[0]).add(new THREE.Vector3(0, CAVE_CAMS.emerge0[1], CAVE_CAMS.emerge0[2]));
    // a column 4 m in front of the emergence camera, on its line of sight
    const onLine = emerge.clone().lerp(cave.mouth, 0.45);
    expect(clearOfCaveCameras(lines, onLine, 0.9)).toBe(false);
    expect(clearOfCaveCameras(lines, cave.mouth.clone().add(new THREE.Vector3(0, 0, 60)), 0.9)).toBe(true);
  });

  for (const outX of [-1, 1]) {
    it(`every dressing prop is clear of the lenses (cave facing ${outX < 0 ? '−X' : '+X'})`, () => {
      const cave = fakeCave(outX);
      const mountain = { heightAt: (x: number) => 50 + (x - 100) * 0.08 * -outX };
      const d = dressSeaCave({ cave: cave as never, mountain: mountain as never, anchor: { z: 400 } as never, quality: 'high', biome: {} as never });
      const props = d.group.userData['props'] as Array<{ p: THREE.Vector3; r: number; kind: string }>;
      expect(props.length).toBeGreaterThan(20);
      expect(props.some((p) => p.kind === 'column')).toBe(true);
      // the portal's lintel of column ends is built on the face, and the gulls have brow perches
      expect(props.filter((p) => p.kind === 'lintel').length).toBeGreaterThan(8);
      expect((d.group.userData['perches'] as Array<{ brow?: boolean }>).some((q) => q.brow)).toBe(true);
      const lines = caveCameraSightlines(cave.mouth, cave.outward, cave.lipTop);
      for (const p of props) expect(clearOfCaveCameras(lines, p.p, p.r), `${p.kind} at ${p.p.toArray().map((v) => v.toFixed(1))}`).toBe(true);
      // and off the Yeti's exit path / ledge (the lintel's column ends stand overhead, above the
      // mouth: they are checked for headroom instead)
      for (const p of props)
        for (const e of cave.exitPath) {
          if (p.kind === "lintel" && p.p.y - p.r > e.y + 4.5) continue;
          expect(Math.hypot(p.p.x - e.x, p.p.z - e.z)).toBeGreaterThan(p.r + 4);
        }
      d.dispose();
    });
  }
});

describe('Fjord victory: the beat sheet', () => {
  it('the beats run in order', () => {
    const B = HARBOUR_BEATS;
    const order = [B.quay, B.racks, B.present, B.toss, B.apres, B.plunge, B.splashCut, B.reveal, B.revealEnd, B.title, B.results];
    for (let i = 1; i < order.length; i++) expect(order[i]!).toBeGreaterThan(order[i - 1]!);
  });
  it('the title lands only after the reveal move has settled, and holds ≥ 1.5 s before the results', () => {
    const B = HARBOUR_BEATS;
    // round 2 named this test "the title lands after it settles" but checked title < revealEnd
    expect(B.title).toBeGreaterThanOrEqual(B.revealEnd);
    expect(B.results - B.title).toBeGreaterThanOrEqual(1.5);
    expect(B.revealEnd - B.reveal).toBeGreaterThan(4.5);
  });
  it('the plunge (run-up and flight) splashes down inside the low water shot, before the reveal', () => {
    const B = HARBOUR_BEATS;
    const splash = B.plunge + PLUNGE_TIMES.total;
    expect(B.plunge + PLUNGE_TIMES.run).toBeLessThanOrEqual(B.splashCut + 0.2);
    expect(splash).toBeGreaterThan(B.splashCut);
    expect(B.reveal - splash).toBeGreaterThan(1.2);
    expect(PLUNGE_TIMES.run).toBeGreaterThanOrEqual(0.6);
  });
});

describe('Fjord islands: a few clustered islands, not an even scatter', () => {
  it('islands cover a modest share of the fjord and come in large connected pieces', () => {
    const m = buildMountain(makeCourse('classic', 'sprint', { biome: 'fjord' }));
    const c = m.coast as Coast;
    expect(c).toBeTruthy();
    // sample the open sea beyond the harbour on a 60 m grid
    const L = c.finishZ;
    const cx = m.centerX(L);
    const W = c.seaLevel;
    let land = 0;
    let n = 0;
    let edges = 0;
    const G: boolean[][] = [];
    for (let j = 0; j < 60; j++) {
      const row: boolean[] = [];
      for (let i = 0; i < 60; i++) {
        const x = cx - 1800 + i * 60;
        const z = c.shoreZ(cx) + 1200 + j * 60;
        const isLand = m.heightAt(x, z) > W + 1;
        row.push(isLand);
        if (isLand) land++;
        n++;
      }
      G.push(row);
    }
    for (let j = 1; j < 60; j++) for (let i = 1; i < 60; i++) if (G[j]![i] !== G[j]![i - 1] || G[j]![i] !== G[j - 1]![i]) edges++;
    const share = land / n;
    expect(share).toBeGreaterThan(0.01);
    expect(share).toBeLessThan(0.25);
    // big pieces: few edges per land cell (an even speckle has ~4 edges per cell)
    expect(edges / Math.max(1, land)).toBeLessThan(1.2);
  });
});
