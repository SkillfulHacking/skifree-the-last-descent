import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, getAchievement } from '../../src/progression/achievements';
import { COSMETICS, DEFAULT_LOADOUT, emptyCosmetics, equip, grantRewards, isOwned, lockerItems, reconcileOwnership, resolveLoadout, skierLook, type CosmeticDef } from '../../src/progression/cosmetics';
import { MIGRATIONS, PROGRESS_KEY, PROGRESS_VERSION, emptySave, loadProgress, writeProgress, type KV } from '../../src/progression/save';
import { ProgressTracker } from '../../src/progression/tracker';
import { EventBus } from '../../src/game/events';

const NOW = Date.parse('2026-11-09T12:00:00Z');
class MemKV implements KV {
  m = new Map<string, string>();
  writes = 0;
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.writes++;
    this.m.set(k, v);
  }
}

describe('cosmetic definitions', () => {
  it('stable unique ids, valid unlock refs, and achievement rewards point at real items', () => {
    const ids = COSMETICS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of COSMETICS) {
      expect(c.id.startsWith(`${c.category}.`)).toBe(true);
      if (c.unlock.kind === 'achievement') expect(getAchievement(c.unlock.achievement)?.reward).toBe(c.id);
    }
    for (const a of ACHIEVEMENTS) if (a.reward) expect(ids).toContain(a.reward);
    for (const id of Object.values(DEFAULT_LOADOUT)) expect(COSMETICS.find((c) => c.id === id)?.unlock.kind).toBe('default');
  });

  it('cosmetics carry only visual parameters (no gameplay fields)', () => {
    for (const c of COSMETICS) expect(Object.keys(c.look).every((k) => k === 'color')).toBe(true);
  });
});

describe('ownership vs equipped loadout', () => {
  it('defaults are owned; achievement items only once granted', () => {
    const st = emptyCosmetics();
    expect(isOwned(st, 'jacket.summit-red')).toBe(true);
    expect(isOwned(st, 'jacket.glacier-blue')).toBe(false);
    expect(isOwned(st, 'jacket.does-not-exist')).toBe(false);
    const got = grantRewards(st, [getAchievement('not-today-yeti')!], NOW);
    expect(got.map((c) => c.id)).toEqual(['jacket.glacier-blue']);
    expect(st.owned['jacket.glacier-blue']).toEqual({ at: NOW, source: 'achievement:not-today-yeti' });
    expect(grantRewards(st, [getAchievement('not-today-yeti')!], NOW + 1)).toEqual([]); // idempotent
  });

  it('only owned, known, rig-compatible items can be equipped; equipping does not change ownership', () => {
    const st = emptyCosmetics();
    expect(equip(st, 'jacket.glacier-blue')).toBe(false);
    expect(st.equipped).toEqual({});
    grantRewards(st, [getAchievement('not-today-yeti')!], NOW);
    expect(equip(st, 'jacket.glacier-blue', 'yeti-v1')).toBe(false); // wrong rig
    expect(equip(st, 'jacket.glacier-blue')).toBe(true);
    expect(st.equipped).toEqual({ jacket: 'jacket.glacier-blue' });
    expect(Object.keys(st.owned)).toEqual(['jacket.glacier-blue']);
    expect(skierLook(st).jacketColor).toBe(0x2f6db5);
  });

  it('the resolved loadout falls back to defaults for unknown / unowned / mismatched equips', () => {
    const st = emptyCosmetics();
    expect(resolveLoadout(st).jacket!.id).toBe('jacket.summit-red');
    st.equipped['jacket'] = 'jacket.from-the-future';
    expect(resolveLoadout(st).jacket!.id).toBe('jacket.summit-red');
    st.equipped['jacket'] = 'jacket.pesto-green'; // hand-edited, not owned
    expect(resolveLoadout(st).jacket!.id).toBe('jacket.summit-red');
    const yetiCoat: CosmeticDef = { id: 'jacket.yeti-fur', category: 'jacket', name: 'Fur', description: '', rig: 'yeti-v1', unlock: { kind: 'default' }, look: { color: 1 } };
    st.equipped['jacket'] = yetiCoat.id;
    expect(resolveLoadout(st, 'skier-v1', [...COSMETICS, yetiCoat]).jacket!.id).toBe('jacket.summit-red');
    expect(skierLook(st).jacketColor).toBe(0xc8302a);
  });

  it('reconciles ownership from earned achievements (a reward added in an update)', () => {
    const st = emptyCosmetics();
    expect(reconcileOwnership(st, ['pizza-party', 'first-descent', 'unknown-id'], NOW).map((c) => c.id)).toEqual(['jacket.pesto-green']);
  });

  it('the Locker lists every jacket for the rig with owned state and the achievement that unlocks it', () => {
    const st = emptyCosmetics();
    const l = lockerItems(st, 'jacket');
    expect(l.map((i) => [i.def.id, i.owned, i.unlockedBy?.id ?? null])).toEqual([
      ['jacket.summit-red', true, null],
      ['jacket.glacier-blue', false, 'not-today-yeti'],
      ['jacket.pesto-green', false, 'pizza-party'],
    ]);
  });
});

describe('save migration v1 → v2 and cosmetics persistence', () => {
  it('current version is 2 and every older version has a migration step', () => {
    expect(PROGRESS_VERSION).toBe(2);
    for (let v = 1; v < PROGRESS_VERSION; v++) expect(MIGRATIONS[v]).toBeTypeOf('function');
  });

  it('a v1 save gains cosmetics, with rewards of already-earned achievements owned', () => {
    const kv = new MemKV();
    const v1 = {
      version: 1,
      achievements: { 'not-today-yeti': { earnedAt: NOW - 1000 }, 'first-descent': { earnedAt: NOW - 2000 }, 'retired-achievement': { earnedAt: 5 } },
      stats: { counters: { pizzaMeters: 400, yetiEscapes: 1 }, sets: {} },
    };
    kv.m.set(PROGRESS_KEY, JSON.stringify(v1));
    const r = loadProgress(kv);
    expect(r.migratedFrom).toBe(1);
    expect(r.save.version).toBe(2);
    expect(r.save.achievements).toEqual(v1.achievements); // unknown id kept
    expect(r.save.stats.counters).toEqual(v1.stats.counters);
    expect(r.save.cosmetics.owned).toEqual({ 'jacket.glacier-blue': { at: NOW - 1000, source: 'migration:not-today-yeti' } });
    expect(r.save.cosmetics.equipped).toEqual({});
    // written back as v2, and loads again without migrating
    writeProgress(kv, r.save);
    expect(JSON.parse(kv.m.get(PROGRESS_KEY)!).version).toBe(2);
    const again = loadProgress(kv);
    expect(again.migratedFrom).toBe(null);
    expect(again.save).toEqual(r.save);
  });

  it('cosmetics round-trip; unknown owned ids are preserved; junk entries are dropped', () => {
    const kv = new MemKV();
    kv.m.set(
      PROGRESS_KEY,
      JSON.stringify({
        version: 2,
        achievements: {},
        stats: { counters: {}, sets: {} },
        cosmetics: { owned: { 'jacket.glacier-blue': { at: NOW, source: 'achievement:not-today-yeti' }, 'helmet.future': { at: NOW, source: 'x' }, bad: 'yes', worse: { at: 'now' } }, equipped: { jacket: 'jacket.glacier-blue', helmet: 'helmet.future', skis: 7 } },
      }),
    );
    const s = loadProgress(kv).save;
    expect(Object.keys(s.cosmetics.owned).sort()).toEqual(['helmet.future', 'jacket.glacier-blue']);
    expect(s.cosmetics.equipped).toEqual({ jacket: 'jacket.glacier-blue', helmet: 'helmet.future' });
    expect(resolveLoadout(s.cosmetics).jacket!.id).toBe('jacket.glacier-blue');
  });

  it('an achievement reward is granted with the unlock and persisted by the tracker', () => {
    const kv = new MemKV();
    const t = new ProgressTracker(emptySave(), { write: (s) => void writeProgress(kv, s) }, ACHIEVEMENTS, () => NOW, (w, earned, now) => void grantRewards(w.cosmetics, earned, now));
    const bus = new EventBus();
    const off = t.attach(bus, () => true);
    bus.emit({ type: 'YetiEscaped', encounter: 0, via: 'refuge', chaseTime: 30, closestGap: 20 });
    off();
    expect(loadProgress(kv).save.cosmetics.owned['jacket.glacier-blue']).toBeTruthy();
    // equipping is a player choice: saved directly
    t.updateSaved((s) => void equip(s.cosmetics, 'jacket.glacier-blue'));
    expect(loadProgress(kv).save.cosmetics.equipped).toEqual({ jacket: 'jacket.glacier-blue' });
  });

  it('a debug run grants nothing persistent (reward included)', () => {
    const kv = new MemKV();
    const t = new ProgressTracker(emptySave(), { write: (s) => void writeProgress(kv, s) }, ACHIEVEMENTS, () => NOW, (w, earned, now) => void grantRewards(w.cosmetics, earned, now));
    const bus = new EventBus();
    const off = t.attach(bus, () => false);
    bus.emit({ type: 'YetiEscaped', encounter: 0, via: 'refuge', chaseTime: 30, closestGap: 20 });
    off();
    expect(kv.writes).toBe(0);
    expect(t.saved.cosmetics.owned).toEqual({});
  });
});
