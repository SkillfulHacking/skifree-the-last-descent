import { frameBudget } from '../../core/frameBudget';
/** Cooperative time budget for the time-sliced cave build: `if (tk()) { yield; tk.reset(); }`. */
export interface Tick {
  /** cheap check (reads the clock every 16 calls) */
  (): boolean;
  /** check the clock now (for coarse loop bodies) */
  over(): boolean;
  reset(): void;
}

export function makeTick(budgetMs: number): Tick {
  let t0 = performance.now();
  let lim = budgetMs;
  let k = 0;
  // the slice also ends with the frame's shared streaming budget (round 4), never below 0.25 ms
  const limit = () => Math.min(budgetMs, Math.max(0.25, frameBudget.deadline - t0));
  const f = (() => {
    if ((++k & 15) !== 0) return false;
    return performance.now() - t0 > lim;
  }) as Tick;
  f.over = () => performance.now() - t0 > lim;
  f.reset = () => {
    t0 = performance.now();
    lim = limit();
    k = 0;
  };
  return f;
}

/** A tick that never asks to yield (synchronous build). */
export const NEVER: Tick = Object.assign(() => false, { over: () => false, reset() {} });
