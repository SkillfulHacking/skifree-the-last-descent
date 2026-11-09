/**
 * Biomes (locations): registry defaults, course-code plumbing, and that the built-in alpine biome
 * reproduces the pre-biome mountain exactly while another biome's knobs really change it.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { ALPINE, BIOMES, DEFAULT_BIOME, biomeByCode, deriveBiome, getBiome, glslVec3, hasBiome, listBiomes, registerBiome, unregisterBiome, type Biome } from '../../src/world/biome';
import { buildMountain, courseId, courseLabel, makeCourse, parseCourseId, worldSeed, type CourseConfig } from '../../src/game/CourseConfig';
import { Mountain } from '../../src/world/course';
import { ObstacleField, pickSpecies } from '../../src/physics/obstacles';
import { loadSettings, saveSettings, type KV } from '../../src/core/settings';

/**
 * heightAt(centerX(z) + dx, z) captured from the game BEFORE biomes existed (commit ee720dc), for
 * z in Z and dx in DX. The alpine biome must reproduce these bit for bit.
 */
const Z = [-200, 0, 150, 420, 900, 1500, 2300, 2950, 3100, 5000, 8000, 9900];
const DX = [-300, 0, 60];
const GOLDEN: Record<'classic' | 'daily' | 'seedEnd', number[]> = {
  classic: [254.876093589707, 56.604715355514365, 63.201676607036674, 185.28190771016727, -0.2505709218080841, 5.032748466666566, 158.55661318721428, -26.713715372782456, -18.92911545889802, 77.38797122562298, -89.75860597627693, -85.71134144028156, -70.2854219776294, -263.01737347377764, -255.8252504586635, -204.33511798050387, -441.8298826225197, -435.83978744106446, -476.08688288361606, -767.7171974553403, -759.1518603871854, -703.7932140038408, -946.0236636640881, -939.5358014423017, -738.0181101541336, -956.6776225915316, -954.8384510599153, -822.0368327814356, -976.0585417054995, -974.174669740386, -867.0414735724979, -997.7917240932921, -995.9271859402912, -792.618109130295, -1011.2348848851252, -1009.3081949798392],
  daily: [230.23617121818467, 56.69359604707468, 62.806435335580375, 167.05004841988298, 0, 6.564849089463437, 130.06275888782892, -24.555826962787986, -17.56350027115772, 73.40996105846496, -76.15046503346181, -69.61506713329595, 64.71817561926035, -167.76504200018414, -156.52024909392824, -225.7001921539498, -366.6326164984372, -361.0721336549708, -443.7088962994615, -641.1261447719613, -635.8895459972056, -507.9815501732401, -783.3441452584268, -767.7117054585503, -591.5217998683376, -851.4350579904107, -838.4190327105501, -1202.5677933913803, -1466.5645186882243, -1454.3859476232833, -2241.496983476803, -2462.7976386461587, -2454.88913502545, -2854.3537151500027, -3055.481179194151, -3047.565630617897],
  seedEnd: [246.4371822757167, 56.644717935275416, 60.87030974094296, 215.4878516044202, 0, 4.4307661818173045, 190.99051739427802, -26.28695351990091, -20.95908791515095, 141.67994255448588, -87.98381622770152, -81.40932946846394, 36.35129963831131, -202.27050439042858, -186.94242793959089, -205.97048113015722, -329.23315723518755, -323.10141243016443, -360.6021883221804, -580.0140776803659, -574.1485084956184, -545.2416359543244, -847.0836495768923, -844.3241318634258, -606.0032939208229, -899.1621356054293, -899.7948326887343, -1289.1736644519394, -1498.933157728599, -1493.3289274623312, -2173.750938834322, -2422.1911773071793, -2408.615125312101, -2770.1429473430135, -2997.7328070033673, -2982.6698095640804],
};
const GOLDEN_COURSES: Record<keyof typeof GOLDEN, () => CourseConfig> = {
  classic: () => makeCourse('classic', 'sprint'),
  daily: () => makeCourse('daily', 'standard', { date: '2026-11-07' }),
  seedEnd: () => makeCourse('custom', 'endless', { customText: '777' }),
};

function samples(m: Mountain): number[] {
  const out: number[] = [];
  for (const z of Z) for (const dx of DX) out.push(m.heightAt(m.centerX(z) + dx, z));
  return out;
}

/** a test-only location with different terrain knobs, palette and obstacle mix */
const TEST_BIOME: Biome = deriveBiome(ALPINE, {
  id: 'test-dunes',
  code: 'TDUNE',
  name: 'Test Dunes',
  description: 'test only',
  terrain: { slopeScale: 0.8, widthScale: 1.3, swingScale: 0.6, wallHeight: 120, wallRelief: 20, undulation: 12, segmentWeights: { basin: 3, powder: 2, alpine: 1 } },
  trees: { density: 0.3, speciesWeights: [0, 1, 0] },
  obstacles: { rocks: 2, logs: 0, stumps: 0 },
  lighting: { sunIntensity: 3 },
});

function mem(): KV {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

afterEach(() => unregisterBiome(TEST_BIOME.id));

describe('biome registry', () => {
  it('alpine is the single built-in default', () => {
    expect(DEFAULT_BIOME).toBe('alpine');
    expect(listBiomes().map((b) => b.id)).toEqual(['alpine']);
    expect(BIOMES.size).toBe(1);
    expect(getBiome()).toBe(ALPINE);
    expect(getBiome('alpine')).toBe(ALPINE);
    expect(getBiome('nowhere')).toBe(ALPINE); // unknown ids fall back to the default
    expect(hasBiome('alpine')).toBe(true);
    expect(hasBiome('nowhere')).toBe(false);
    expect(biomeByCode('alp')).toBe(ALPINE);
    expect(ALPINE.trees.species).toHaveLength(3);
  });

  it('registers, validates and unregisters additional biomes', () => {
    registerBiome(TEST_BIOME);
    expect(listBiomes().map((b) => b.id)).toEqual(['alpine', 'test-dunes']);
    expect(getBiome('test-dunes')).toBe(TEST_BIOME);
    expect(biomeByCode('tdune')).toBe(TEST_BIOME);
    expect(() => registerBiome({ ...TEST_BIOME, id: 'Bad Id' })).toThrow();
    expect(() => registerBiome({ ...TEST_BIOME, id: 'other', code: 'x' })).toThrow();
    expect(() => registerBiome({ ...TEST_BIOME, id: 'other', code: 'TDUNE' })).toThrow(); // code taken
    expect(() => registerBiome({ ...ALPINE })).toThrow(); // the default cannot be replaced
    unregisterBiome('test-dunes');
    unregisterBiome('alpine'); // no-op
    expect(listBiomes().map((b) => b.id)).toEqual(['alpine']);
  });

  it('deriveBiome deep-copies and overrides per section', () => {
    expect(TEST_BIOME.terrain.wallHeight).toBe(120);
    expect(TEST_BIOME.terrain.detail).toBe(ALPINE.terrain.detail); // untouched fields inherited
    expect(TEST_BIOME.lighting.sunColor).toEqual(ALPINE.lighting.sunColor);
    expect(TEST_BIOME.lighting.sunColor).not.toBe(ALPINE.lighting.sunColor); // copied, not shared
    expect(ALPINE.terrain.wallHeight).toBe(330);
  });

  it('glsl literals always carry a decimal point', () => {
    expect(glslVec3([1, 0.86, 0.7])).toBe('vec3(1.0, 0.86, 0.7)');
  });

  it('weighted species picks consume one draw and respect zero weights', () => {
    for (let u = 0; u < 1; u += 0.01) expect(pickSpecies(u, [0, 1, 0])).toBe(1);
    expect(pickSpecies(0.1, [1, 1, 1])).toBe(0);
    expect(pickSpecies(0.99, [1, 1, 1])).toBe(2);
    expect(pickSpecies(0.5, [0, 0, 0])).toBe(1); // degenerate: even mix
  });
});

describe('course codes with locations', () => {
  it('existing codes are byte-identical and still parse to the default biome', () => {
    for (const code of ['DAILY-2026-11-07-STD-H', 'CLASSIC-SPR', 'CLASSIC-END-R', 'SEED-777-INF', 'DAILY-2026-11-01-EXP']) {
      const c = parseCourseId(code)!;
      expect(c).not.toBeNull();
      expect(c.biome).toBe('alpine');
      expect(courseId(c)).toBe(code);
    }
    expect(courseId(makeCourse('daily', 'standard', { date: '2026-11-07', difficulty: 'hard' }))).toBe('DAILY-2026-11-07-STD-H');
    expect(courseId(makeCourse('classic', 'sprint', { biome: 'alpine' }))).toBe('CLASSIC-SPR');
    // an explicit default tag is accepted and normalised away
    expect(courseId(parseCourseId('CLASSIC-SPR@ALP')!)).toBe('CLASSIC-SPR');
    expect(courseLabel(makeCourse('classic', 'sprint'))).toBe('The Last Descent · Sprint · 3 km');
  });

  it('a non-default biome round-trips through its code', () => {
    registerBiome(TEST_BIOME);
    const cases = [makeCourse('daily', 'standard', { date: '2026-11-07', difficulty: 'hard', biome: 'test-dunes' }), makeCourse('classic', 'sprint', { biome: 'test-dunes' }), makeCourse('custom', 'endless', { customText: '777', biome: 'test-dunes' })];
    expect(cases.map(courseId)).toEqual(['DAILY-2026-11-07-STD-H@TDUNE', 'CLASSIC-SPR@TDUNE', 'SEED-777-INF@TDUNE']);
    for (const c of cases) {
      const back = parseCourseId(courseId(c).toLowerCase())!;
      expect(back).toEqual(c);
      expect(courseId(back)).toBe(courseId(c));
    }
    expect(courseLabel(cases[1]!)).toContain('Test Dunes');
  });

  it('unknown location tags are rejected; unknown biome ids fall back to the default', () => {
    expect(parseCourseId('CLASSIC-SPR@NOPE')).toBeNull();
    expect(parseCourseId('CLASSIC-SPR@')).toBeNull();
    expect(makeCourse('classic', 'sprint', { biome: 'unregistered' }).biome).toBe('alpine');
  });

  it('seeds: unchanged for the default biome, biome-specific otherwise', () => {
    registerBiome(TEST_BIOME);
    const a = makeCourse('daily', 'standard', { date: '2026-11-07' });
    const t = makeCourse('daily', 'standard', { date: '2026-11-07', biome: 'test-dunes' });
    expect(worldSeed(a)).toBe(a.seed);
    expect(t.seed).toBe(a.seed); // the course's own seed (and code) is the same...
    expect(worldSeed(t)).not.toBe(a.seed); // ...but the world is generated from a different one
    expect(buildMountain(t).seed).toBe(worldSeed(t));
  });

  it('settings persist the location and repair unknown ones', () => {
    registerBiome(TEST_BIOME);
    const kv = mem();
    const s = loadSettings(kv);
    expect(s.biome).toBe('alpine');
    s.biome = 'test-dunes';
    saveSettings(s, kv);
    expect(loadSettings(kv).biome).toBe('test-dunes');
    kv.setItem('skifree-tld.settings.v1', JSON.stringify({ biome: 'atlantis' }));
    expect(loadSettings(kv).biome).toBe('alpine');
  });
});

describe('mountains per biome', () => {
  it('alpine reproduces the pre-biome terrain bit for bit', () => {
    for (const k of Object.keys(GOLDEN) as Array<keyof typeof GOLDEN>) {
      expect(samples(buildMountain(GOLDEN_COURSES[k]()))).toEqual(GOLDEN[k]);
    }
    // the plain constructors default to alpine too
    expect(samples(new Mountain())).toEqual(GOLDEN.classic);
    expect(new Mountain().biome).toBe(ALPINE);
  });

  it('a test biome with different terrain knobs builds a different mountain (same profile code path)', () => {
    registerBiome(TEST_BIOME);
    const c = GOLDEN_COURSES.daily();
    // same seed, only the knobs differ: isolates the biome's terrain parameters from the seed mix
    const alp = Mountain.generated(c.seed, 10000);
    const dun = Mountain.generated(c.seed, 10000, TEST_BIOME);
    expect(samples(alp)).toEqual(GOLDEN.daily);
    let dh = 0;
    let dw = 0;
    for (let z = 1500; z < 9000; z += 100) {
      dh += Math.abs(alp.heightAt(alp.centerX(z) + 200, z) - dun.heightAt(dun.centerX(z) + 200, z));
      dw += dun.halfWidth(z) - alp.halfWidth(z);
    }
    expect(dh / 75).toBeGreaterThan(5); // lower, smoother valley walls
    expect(dw / 75).toBeGreaterThan(3); // wider pistes
    // segment mix follows the weights
    const types = (dun.profile as unknown as { segmentList: Array<{ type: string }> }).segmentList.map((s) => s.type);
    const regular = types.filter((t) => !['summit', 'encounter', 'checkpoint', 'finish'].includes(t));
    expect(regular.every((t) => ['basin', 'powder', 'alpine'].includes(t))).toBe(true);
    // and the full course (with the biome's own seed) differs again, deterministically
    const full = buildMountain(makeCourse('daily', 'standard', { date: '2026-11-07', biome: 'test-dunes' }));
    expect(samples(full)).not.toEqual(GOLDEN.daily);
    expect(samples(full)).toEqual(samples(buildMountain(makeCourse('daily', 'standard', { date: '2026-11-07', biome: 'test-dunes' }))));
  });

  it("the biome's obstacle mix and species weights drive placement", () => {
    // same terrain as alpine, only the mix differs
    const mix = deriveBiome(ALPINE, { id: 'test-mix', code: 'TMIX', name: 'Test Mix', trees: { density: 0.3, speciesWeights: [0, 1, 0] }, obstacles: { rocks: 2, logs: 0, stumps: 0 } });
    const c = GOLDEN_COURSES.daily();
    const count = (m: Mountain) => {
      const f = new ObstacleField(m, c.seed);
      f.ensure(400, 2400);
      const n: Record<string, number> = { tree: 0, rock: 0, boulder: 0, log: 0, stump: 0 };
      const variants = new Set<number>();
      for (const o of f.all()) {
        n[o.kind]!++;
        if (o.kind === 'tree') variants.add(o.variant);
      }
      return { n, variants };
    };
    const a = count(Mountain.generated(c.seed, 10000));
    const t = count(Mountain.generated(c.seed, 10000, mix));
    expect(a.variants.size).toBe(3);
    expect([...t.variants]).toEqual([1]);
    expect(t.n.tree!).toBeLessThan(a.n.tree! * 0.6);
    expect(t.n.rock! + t.n.boulder!).toBeGreaterThan((a.n.rock! + a.n.boulder!) * 1.4);
    expect(t.n.log! + t.n.stump!).toBe(0);
    expect(a.n.log! + a.n.stump!).toBeGreaterThan(0);
  });
});
