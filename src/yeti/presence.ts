/**
 * The Yeti's presence in the chase — presentation only (W-076, owner's decision 3: "prioritize
 * presentation and fair gameplay conditions before changing pursuit physics"). Nothing here touches the
 * AI, its speed or its start: it reads the gap and says when to tell the player about it.
 *
 * Measured (balance/tension/): a clean skier on Alpine or Fjord leaves the Yeti beyond the rear-view
 * inset's range (110 m) for most of the chase, where nothing reported him; and the gap could shrink for
 * seconds with only a number on the HUD to say so.
 * - `call`: while he is out of sight (beyond CALL_BEYOND m), a distant call every 9–14 s (seeded), the
 *   first no sooner than CALL_FIRST s into the chase — he is still coming;
 * - `closing`: the gap has shrunk by more than CLOSING_RATE m/s over the last CLOSING_WINDOW s while he
 *   is within CLOSING_WITHIN m — the player is losing ground (held for at least 1 s, so it reads).
 */
export const PRESENCE = {
  callBeyond: 110,
  callFirst: 6,
  callEvery: [9, 14] as const,
  closingRate: 1.5,
  closingWindow: 2,
  // (round 4, W-085 / review F8: CLOSING showed 21.5 s on a clean run) within 60 m, where the gap is the
  // player's to lose: beyond it the Yeti's catch-up pressure (YETI.catchUpGap) closes in by design
  closingWithin: 60,
  closingHold: 1,
} as const;

export interface PresenceCue {
  /** play a distant call from the Yeti this frame */
  call: boolean;
  /** the player is losing ground */
  closing: boolean;
}

export class ChasePresence {
  private t = 0;
  private nextCall = 0;
  private hist: Array<{ t: number; gap: number }> = [];
  private closingUntil = -1;
  private n = 0;

  constructor(private seed = 1) {
    this.reset();
  }

  reset() {
    this.t = 0;
    this.hist = [];
    this.closingUntil = -1;
    this.n = 0;
    this.nextCall = PRESENCE.callFirst;
  }

  /** a deterministic 0..1 per call (no Math.random: the same run gives the same calls) */
  private jitter(): number {
    const x = Math.sin((this.seed + 1) * 12.9898 + ++this.n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  /** advance by dt with the current gap (m; airborne leap included); the cues for this frame */
  update(dt: number, gap: number): PresenceCue {
    this.t += dt;
    const out: PresenceCue = { call: false, closing: false };
    if (!Number.isFinite(gap)) return out;
    // the distant call: only while he is out of sight
    if (gap > PRESENCE.callBeyond) {
      if (this.t >= this.nextCall) {
        out.call = true;
        const [a, b] = PRESENCE.callEvery;
        this.nextCall = this.t + a + (b - a) * this.jitter();
      }
    } else this.nextCall = Math.max(this.nextCall, this.t + PRESENCE.callEvery[0]);
    // losing ground
    this.hist.push({ t: this.t, gap });
    while (this.hist.length > 2 && this.hist[0]!.t < this.t - PRESENCE.closingWindow) this.hist.shift();
    const h0 = this.hist[0]!;
    const span = this.t - h0.t;
    if (span >= PRESENCE.closingWindow * 0.9 && gap < PRESENCE.closingWithin && (h0.gap - gap) / span > PRESENCE.closingRate) this.closingUntil = this.t + PRESENCE.closingHold;
    out.closing = this.t < this.closingUntil;
    return out;
  }
}
