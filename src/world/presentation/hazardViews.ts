/**
 * Hazard views: three.js presentation for hazard kinds, kept apart from their pure logic.
 *
 * A view factory is registered by id (the kind's `view`). HazardLayer follows the streamed
 * HazardField: when a band of hazards is generated it creates one view per instance, when the band
 * is released it disposes them, so view lifetime equals band lifetime (exactly like vegetation
 * follows obstacle bands). Every frame it passes each view its current phase (computed from the
 * PHYSICS clock, so what the player sees is what the physics does).
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../core/types';
import type { Mountain } from '../course';
import type { Biome } from '../biome';
import type { BiomeEnvironment } from '../capabilities/environment';
import { getHazardKind, hazardPhase, type HazardInstance, type HazardPhaseState } from '../hazards/hazard';

export interface HazardView {
  readonly object: THREE.Object3D;
  /** per frame: phase from the physics clock, t = physics time, dt = frame time */
  update?(phase: HazardPhaseState, t: number, dt: number): void;
  dispose(): void;
}

export interface HazardViewContext {
  mountain: Mountain;
  quality: QualityPreset;
  biome: Biome;
}

export type HazardViewFactory = (h: HazardInstance, ctx: HazardViewContext) => HazardView;

const views = new Map<string, HazardViewFactory>();

export function registerHazardView(id: string, f: HazardViewFactory): HazardViewFactory {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error(`hazard view id "${id}" must be lowercase [a-z0-9-]`);
  const prev = views.get(id);
  if (prev && prev !== f) throw new Error(`hazard view "${id}" is already registered`);
  views.set(id, f);
  return f;
}

export function unregisterHazardView(id: string): void {
  views.delete(id);
}

export function hasHazardView(id: string): boolean {
  return views.has(id);
}

/** main-thread budget (ms) per frame for building hazard views (World) */
export const HAZARD_VIEW_BUDGET_MS = 2;

/** hazard views this far (m) behind the skier are hidden and no longer animated */
export const HAZARD_VIEW_BEHIND = 150;

export class HazardLayer {
  readonly group = new THREE.Group();
  readonly stats = { created: 0, disposed: 0 };
  private live = new Map<number, { h: HazardInstance; v: HazardView }>();
  private off: () => void;

  constructor(
    private env: BiomeEnvironment,
    private ctx: HazardViewContext,
  ) {
    this.group.name = 'hazards';
    this.off = env.hazards.onBand((_b, list, added) => (added ? this.add(list) : this.remove(list)));
  }

  get liveCount(): number {
    return this.live.size;
  }

  /** instances whose views are still to be built (round 3, D1: built on a per-frame budget) */
  private pending = new Map<number, HazardInstance>();

  /** views waiting to be built */
  get pendingCount(): number {
    return this.pending.size;
  }

  private add(list: readonly HazardInstance[]) {
    for (const h of list) {
      const view = getHazardKind(h.kind).view;
      if (!view || this.live.has(h.id)) continue;
      if (!views.get(view)) throw new Error(`hazard "${h.kind}" uses unregistered view "${view}"`);
      this.pending.set(h.id, h);
    }
  }

  private build(h: HazardInstance) {
    const v = views.get(getHazardKind(h.kind).view!)!(h, this.ctx);
    this.group.add(v.object);
    this.live.set(h.id, { h, v });
    this.stats.created++;
  }

  /**
   * Build pending views for up to `ms` of main-thread time (at least one per call, nearest first).
   * Views are created ~1 km ahead (World streams hazard bands that far), so a band's views spread
   * over a few frames instead of costing one frame 10–50 ms (round 2, D1).
   */
  pump(ms: number, focusZ = -Infinity): void {
    if (!this.pending.size) return;
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const t0 = now();
    const order = [...this.pending.values()].sort((a, b) => Math.abs(a.z - focusZ) - Math.abs(b.z - focusZ));
    for (const h of order) {
      this.pending.delete(h.id);
      this.build(h);
      if (now() - t0 >= ms) break;
    }
  }

  /** Build every pending view now (loading, teleports). */
  flush(): void {
    for (const h of [...this.pending.values()]) {
      this.pending.delete(h.id);
      this.build(h);
    }
  }

  private remove(list: readonly HazardInstance[]) {
    for (const h of list) {
      this.pending.delete(h.id);
      const e = this.live.get(h.id);
      if (!e) continue;
      this.group.remove(e.v.object);
      e.v.dispose();
      this.live.delete(h.id);
      this.stats.disposed++;
    }
  }

  private warm: HazardView[] = [];
  /**
   * Shader warm-up (World.showAllForWarmup, before renderer.compile at load): one view of every
   * hazard kind of this course, shown in its active phase, so its materials are compiled with the
   * rest of the scene instead of at first sight mid-run. They are disposed on the next update().
   */
  warmup(): void {
    const seen = new Set<string>();
    for (const k of this.env.kinds) {
      if (!k.view || seen.has(k.view)) continue;
      const f = views.get(k.view);
      if (!f) continue;
      // the first real instance of the kind down the course (pure placement; nothing is kept)
      let h: HazardInstance | undefined;
      for (let z = 0; z < 12000 && !h; z += 1024) h = this.env.hazards.peek(z, z + 1024).find((q) => q.kind === k.id);
      if (!h) continue;
      seen.add(k.view);
      const v = f(h, this.ctx);
      v.update?.({ phase: 'active', u: 0.5 }, 0, 1 / 60);
      this.group.add(v.object);
      this.warm.push(v);
    }
  }

  /**
   * Animate views on the physics clock (BiomeEnvironment.clock). With `focusZ`, views more than
   * HAZARD_VIEW_BEHIND m behind it are hidden and not animated (bands are kept until z − 900).
   */
  update(dt: number, focusZ?: number): void {
    if (this.warm.length) {
      for (const v of this.warm) {
        this.group.remove(v.object);
        v.dispose();
      }
      this.warm.length = 0;
    }
    if (!this.live.size) return;
    const t = this.env.clock;
    for (const { h, v } of this.live.values()) {
      const behind = focusZ !== undefined && h.z + h.r < focusZ - HAZARD_VIEW_BEHIND;
      if (v.object.visible === behind) v.object.visible = !behind;
      if (!behind) v.update?.(hazardPhase(getHazardKind(h.kind), h, t), t, dt);
    }
  }

  dispose(): void {
    this.update(0);
    this.pending.clear();
    this.off();
    this.remove([...this.live.values()].map((e) => e.h));
    this.group.removeFromParent();
  }
}
