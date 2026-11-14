/**
 * One streaming budget per frame, shared by every streaming consumer (round 4, Reviewer D r3 defect
 * 1). World.update opens it (`begin(ms)`) and hands it out in priority order; the time-sliced
 * builders (cave and dressing slices, scenery chunks, terrain rows, hazard views) yield as soon as
 * the frame's budget is spent, not only when their own slice budget is. Outside a frame (loading,
 * teleports, tests) the deadline is +∞ and every builder keeps its own slice budget, as before.
 */
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export const frameBudget = {
  /** performance.now() after which the frame's streaming work should stop (+∞ outside a frame) */
  deadline: Infinity,
  begin(ms: number): void {
    this.deadline = now() + ms;
  },
  end(): void {
    this.deadline = Infinity;
  },
  /** ms left in the frame's budget (may be negative; +∞ outside a frame) */
  remaining(): number {
    return this.deadline === Infinity ? Infinity : this.deadline - now();
  },
  spent(): boolean {
    return this.deadline !== Infinity && now() >= this.deadline;
  },
};
