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
  let k = 0;
  const f = (() => {
    if ((++k & 15) !== 0) return false;
    return performance.now() - t0 > budgetMs;
  }) as Tick;
  f.over = () => performance.now() - t0 > budgetMs;
  f.reset = () => {
    t0 = performance.now();
    k = 0;
  };
  return f;
}

/** A tick that never asks to yield (synchronous build). */
export const NEVER: Tick = Object.assign(() => false, { over: () => false, reset() {} });
