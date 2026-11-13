/**
 * The coastal reveal before a cave emergence that no station frames with the sea (seaFraming.ts
 * coastalReveal, used by seaCaveCinematic.ts): wherever it is used, the camera is out over open water
 * (never inside the terrain) at both ends of the move and the frame holds ≥ 10 % open water; it exists
 * for most non-Sprint caves (C r6 #1, C r7 #1).
 */
import '../support/domStub';
import { expect, it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, makeCourse, type LengthMode } from '../../src/game/CourseConfig';
import { Cave } from '../../src/world/Cave';
import { coastalReveal } from '../../src/world/biomes/fjord/views/seaFraming';

it('coastal reveal: clear of the terrain, ≥ 10 % water, on most Standard/Endurance caves', () => {
  let n = 0;
  let ok = 0;
  const cases: Array<[LengthMode, string]> = [['standard', ''], ['endurance', ''], ['standard', 'C4G'], ['standard', 'C4K'], ['endurance', 'C4J'], ['endurance', 'E7X1'], ['endurance', 'E7X9']];
  for (const [len, sd] of cases) {
    const m = buildMountain(makeCourse(sd ? 'custom' : 'classic', len, { biome: 'fjord', customText: sd || undefined }));
    for (const e of m.profile.encounters(-Infinity, m.profile.finishZ)) {
      const cave = new Cave(m, e.anchor, 'low');
      const r = coastalReveal(m, cave.mouth);
      n++;
      if (r) {
        ok++;
        const water = m.coast!.seaLevelAt(cave.mouth.z);
        for (const c of [r.sea0, r.sea1]) expect(m.heightAt(c.x, c.z), `${len} ${sd} ${e.anchor.z}`).toBeLessThan(water - 2);
        expect(r.water).toBeGreaterThanOrEqual(0.1);
      }
      cave.dispose();
    }
  }
  expect(ok / n).toBeGreaterThanOrEqual(0.7);
});
