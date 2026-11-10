/**
 * Cosmetics: data-driven item definitions, ownership (what the player has unlocked) kept apart
 * from the equipped loadout (what they wear), and rig compatibility. Purely visual: nothing here
 * is read by physics, the Yeti or scoring. No store, no currency, no monetisation.
 *
 * - `id` is stable forever ("<category>.<name>"); it is the save key.
 * - `rig` says which character rig the item fits. A future character model with another rig
 *   only shows items tagged for it; an equipped item that doesn't fit falls back to the
 *   category default (never a broken mix).
 * - `look` holds the visual parameters the category's applier understands (today: the skier
 *   jacket colour via SkierModel.setJacketColor).
 * - Ownership survives updates: owned ids are never dropped, even ids this build doesn't know.
 */
import { ACHIEVEMENTS, type AchievementDef } from './achievements';

export type CosmeticCategory = 'jacket' | 'pants' | 'helmet' | 'goggles' | 'gloves' | 'skis' | 'outfit' | 'model' | 'yeti' | 'victory-pose';
export type RigTag = 'skier-v1' | 'yeti-v1';

export type CosmeticUnlock = { kind: 'default' } | { kind: 'achievement'; achievement: string };

export interface CosmeticLook {
  /** sRGB hex */
  color?: number;
}

export interface CosmeticDef {
  id: string;
  category: CosmeticCategory;
  name: string;
  description: string;
  rig: RigTag;
  unlock: CosmeticUnlock;
  look: CosmeticLook;
  /** categories this item replaces when worn (a full outfit covers jacket + pants) */
  covers?: CosmeticCategory[];
}

export const COSMETIC_CATEGORY_LABEL: Record<CosmeticCategory, string> = {
  jacket: 'Jacket',
  pants: 'Pants',
  helmet: 'Helmet',
  goggles: 'Goggles',
  gloves: 'Gloves',
  skis: 'Skis',
  outfit: 'Outfit',
  model: 'Character',
  yeti: 'Yeti',
  'victory-pose': 'Victory pose',
};

export const COSMETICS: readonly CosmeticDef[] = [
  {
    id: 'jacket.summit-red',
    category: 'jacket',
    name: 'Summit Red',
    description: 'The original. Easy to spot from a helicopter.',
    rig: 'skier-v1',
    unlock: { kind: 'default' },
    look: { color: 0xc8302a },
  },
  {
    id: 'jacket.glacier-blue',
    category: 'jacket',
    name: 'Glacier Blue',
    description: 'Worn by those who have looked the Yeti in the eye and kept skiing.',
    rig: 'skier-v1',
    unlock: { kind: 'achievement', achievement: 'not-today-yeti' },
    look: { color: 0x2f6db5 },
  },
  {
    id: 'jacket.pesto-green',
    category: 'jacket',
    name: 'Pesto Green',
    description: 'A thousand metres of pizza earns you a topping.',
    rig: 'skier-v1',
    unlock: { kind: 'achievement', achievement: 'pizza-party' },
    look: { color: 0x4f7d2c },
  },
];

/** Categories the current rig supports, with the item worn when nothing (valid) is equipped. */
export const DEFAULT_LOADOUT: Partial<Record<CosmeticCategory, string>> = { jacket: 'jacket.summit-red' };

export interface CosmeticsState {
  /** id → when/why it was unlocked (unknown ids preserved) */
  owned: Record<string, { at: number; source: string }>;
  /** category → equipped item id (validated on use) */
  equipped: Partial<Record<string, string>>;
}

export const emptyCosmetics = (): CosmeticsState => ({ owned: {}, equipped: {} });

export function getCosmetic(id: string, defs: readonly CosmeticDef[] = COSMETICS): CosmeticDef | undefined {
  return defs.find((d) => d.id === id);
}

export function isOwned(st: CosmeticsState, id: string, defs: readonly CosmeticDef[] = COSMETICS): boolean {
  const d = getCosmetic(id, defs);
  if (!d) return false;
  return d.unlock.kind === 'default' || !!st.owned[id];
}

/** Grant the cosmetic rewards of newly earned achievements (idempotent). Returns granted defs. */
export function grantRewards(st: CosmeticsState, earned: readonly AchievementDef[], now: number, source = 'achievement', defs: readonly CosmeticDef[] = COSMETICS): CosmeticDef[] {
  const out: CosmeticDef[] = [];
  for (const a of earned) {
    if (!a.reward) continue;
    const c = getCosmetic(a.reward, defs);
    if (!c || st.owned[c.id]) continue;
    st.owned[c.id] = { at: now, source: `${source}:${a.id}` };
    out.push(c);
  }
  return out;
}

/** Make ownership consistent with earned achievements (rewards added to old achievements later). */
export function reconcileOwnership(st: CosmeticsState, earnedIds: readonly string[], now: number, achievements: readonly AchievementDef[] = ACHIEVEMENTS, defs: readonly CosmeticDef[] = COSMETICS): CosmeticDef[] {
  const earned = achievements.filter((a) => earnedIds.includes(a.id));
  return grantRewards(st, earned, now, 'reconcile', defs);
}

/** Equip an owned, known, rig-compatible item. Returns false (and changes nothing) otherwise. */
export function equip(st: CosmeticsState, id: string, rig: RigTag = 'skier-v1', defs: readonly CosmeticDef[] = COSMETICS): boolean {
  const d = getCosmetic(id, defs);
  if (!d || d.rig !== rig || !isOwned(st, id, defs)) return false;
  st.equipped[d.category] = id;
  return true;
}

/**
 * What is actually worn: per supported category, the equipped item if it is known, owned and fits
 * the rig, else the category default. Never throws, whatever the save contains.
 */
export function resolveLoadout(st: CosmeticsState, rig: RigTag = 'skier-v1', defs: readonly CosmeticDef[] = COSMETICS): Partial<Record<CosmeticCategory, CosmeticDef>> {
  const out: Partial<Record<CosmeticCategory, CosmeticDef>> = {};
  for (const [cat, defId] of Object.entries(DEFAULT_LOADOUT) as [CosmeticCategory, string][]) {
    const want = st.equipped[cat];
    const d = want ? getCosmetic(want, defs) : undefined;
    out[cat] = d && d.category === cat && d.rig === rig && isOwned(st, d.id, defs) ? d : getCosmetic(defId, defs)!;
  }
  return out;
}

/** Visual parameters for the skier model from a loadout. */
export function skierLook(st: CosmeticsState): { jacketColor: number } {
  const l = resolveLoadout(st, 'skier-v1');
  return { jacketColor: l.jacket?.look.color ?? 0xc8302a };
}

/** Items of a category for the Locker: every known item for the rig, owned first. */
export function lockerItems(st: CosmeticsState, cat: CosmeticCategory, rig: RigTag = 'skier-v1', defs: readonly CosmeticDef[] = COSMETICS) {
  return defs
    .filter((d) => d.category === cat && d.rig === rig)
    .map((d) => {
      const via = d.unlock.kind === 'achievement' ? d.unlock.achievement : null;
      return { def: d, owned: isOwned(st, d.id, defs), unlockedBy: via ? (ACHIEVEMENTS.find((a) => a.id === via) ?? null) : null };
    });
}
