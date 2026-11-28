// W-104 (round-5 review C5-1, F5-4, C4-4, C5-3, C5-4): the welcome beat frames the arriving skier, the
// lantern hangs from the hand, the doorway is lit, the beam has soft edges, the spot swells (no pop).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import '../../src/world/biomes';
import { buildMountain, makeCourse } from '../../src/game/CourseConfig';
import { rescueLayout } from '../../src/world/biomes/whiteout/views/rescue';
import { welcomePoses } from '../../src/world/biomes/whiteout/views/rescueVictory';

type Fs = { readFileSync(p: string, e: string): string };
const src = async (p: string) => ((await import('node:fs' as string)) as Fs).readFileSync(p, 'utf8');

describe('W-104 victory staging', () => {
  const m = buildMountain(makeCourse('classic', 'sprint', { biome: 'whiteout' }));
  const L = rescueLayout(m, { x: m.routeX(m.finishZ), z: m.finishZ });
  const across = new THREE.Vector3(L.faces.z, 0, -L.faces.x);

  it("the skier's mark is at the porch, not 8 m out", () => {
    const d = Math.hypot(L.stop.x - L.door.x, L.stop.z - L.door.z);
    expect(d).toBeLessThan(5);
    expect(d).toBeGreaterThan(4); // clear of the deck (1.8 m) and the akja
  });

  it('the welcome shot sees the skier on his mark, above the letterbox, with the door beyond', () => {
    for (const p of [welcomePoses(L.door, L.faces, across).from, welcomePoses(L.door, L.faces, across).to]) {
      const cam = new THREE.PerspectiveCamera(p.fov, 16 / 9, 0.1, 500);
      cam.position.copy(p.pos);
      cam.lookAt(p.look);
      cam.updateMatrixWorld();
      // the skier stands on the mark (snow at y≈0 here: the layout is flat xz, so use relative heights)
      for (const h of [0.2, 1.0, 1.7]) {
        const v = new THREE.Vector3(L.stop.x, h, L.stop.z).project(cam);
        expect(Math.abs(v.x), `skier x at ${h} m`).toBeLessThan(0.9);
        // inside the frame between the letterbox bars (each ~11 % of the height: |y| < 0.78)
        expect(Math.abs(v.y), `skier y at ${h} m`).toBeLessThan(0.78);
        expect(v.z).toBeLessThan(1);
      }
      const door = new THREE.Vector3(L.door.x, 1.2, L.door.z).project(cam);
      expect(Math.abs(door.x)).toBeLessThan(0.9);
      // the camera is further out than the skier: he is between the lens and the door
      const camOut = new THREE.Vector3().subVectors(p.pos, L.door).setY(0).dot(L.faces);
      expect(camOut).toBeGreaterThan(Math.hypot(L.stop.x - L.door.x, L.stop.z - L.door.z) + 5);
    }
  });

  it('the lantern hangs from the fist by its bail, kept plumb', async () => {
    const trophy = await src('src/cinematic/victory/trophy.ts');
    expect(trophy).toMatch(/userData\['hangFrom'\]/);
    expect(await src('src/world/biomes/whiteout/views/rescue.ts')).toMatch(/lantern\.userData\['hangFrom'\] = 0\.7/);
  });

  it('the doorway is a lit interior (not tone-mapped), the beam edges are soft, the spot swells', async () => {
    const r = await src('src/world/biomes/whiteout/views/rescue.ts');
    expect(r).toMatch(/doorwayMaterial\(\)/);
    expect(r).toMatch(/toneMapped: false/);
    expect(r).toMatch(/\* face \* face;/);
    expect(r).not.toMatch(/this\.search\.intensity = this\.searchTarget \? 1400 : 220;/);
  });

  it('a session dispose clears the searchlight gloom (review D5-4)', async () => {
    expect(await src('src/game/GameSession.ts')).toMatch(/setGloom\(0\)/);
  });
});
