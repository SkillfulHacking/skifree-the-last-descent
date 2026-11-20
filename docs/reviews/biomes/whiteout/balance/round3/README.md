# Round 3 — weather-reading skill, re-measured (W-056, W-059, W-060, W-072, W-075)

**Build:** `pass5-whiteout` at `5c73ffe` (src as measured; the driver includes Gitar's sticky alt-line fix). Raw rows: `whiteout_{sprint,standard}_{W3H,W2H}.jsonl`, `classic.jsonl` (one JSON object per run, with its `courseId`).

**Seeds.** `W3H-01..24` (Sprint) / `W3H-01..12` (Standard): new held-out set, never used for tuning. `W2H` (round 2's held-out set) for comparison. `classic.jsonl`: each location's Classic (default) course.

**What changed since round 2 (game):** slope floor 14° (was 11°); clipped jump keeps 0.6 (was 0.72); blizzard cells blow the front's way in a storm; blizzard alerts no longer consumed beyond alert range; the front caption names the flagged gaps, not the lee. Yeti rules unchanged.

**What changed in the driver (measurement):** in a storm (front s > 0.5) it reads drift rows only within 60 m (was 110 m through any fog; round-2 storm frames lose the mounds at ~55 m); it keeps a blizzard cell until it is out of the knock zone (it used to re-tuck inside it); alternate-line membership is sticky (Gitar). It still follows the racing line through any fog; it is not a human playtester.

## Normal Sprint, paired by seed (informed = `informed2NoLee`: storm line, drift gaps, blizzard stance)

| Seeds | blind | informed | gained / lost | median min Yeti gap (blind → informed) | knocks per run |
|---|---|---|---|---|---|
| W3H (held out) | 14/24 | **24/24** | +10 / −0 | 39 → 45 m | 1.33 → 0.17 |
| W2H | 15/24 | **24/24** | +9 / −0 | 32 → 47 m | 1.54 → 0.08 |
| Round 2, W2H (for comparison) | 10/24 | 22/24 | +12 / −0 | 3 → 43 m | 1.17 → 0.79 |

## All results (wins)

| Seeds | Length | Diff | blind | informed | + lee | drifts only | blizzard stance only | timed hop | hop spam |
|---|---|---|---|---|---|---|---|---|---|
| W3H | Sprint | Relaxed | 24/24 | 24/24 | 24/24 | 24/24 | 24/24 | 24/24 | 24/24 |
| W3H | Sprint | Normal | 14/24 | 24/24 | 22/24 | 23/24 | 15/24 | 13/24 | 12/24 |
| W3H | Sprint | Hard | 0/24 | 3/24 | 8/24 | 2/24 | 0/24 | 0/24 | 0/24 |
| W3H | Standard | Relaxed | 12/12 | 12/12 | 12/12 | 12/12 | 12/12 | 12/12 | 12/12 |
| W3H | Standard | Normal | 6/12 | **12/12** | 9/12 | 8/12 | 4/12 | 2/12 | 1/12 |
| W3H | Standard | Hard | 0/12 | 0/12 | 0/12 | 0/12 | 0/12 | 0/12 | 0/12 |
| W2H | Sprint | Normal | 15/24 | 24/24 | 24/24 | 21/24 | 18/24 | 15/24 | 11/24 |
| W2H | Sprint | Hard | 1/24 | 10/24 | 5/24 | 6/24 | 1/24 | 0/24 | 0/24 |
| W2H | Standard | Normal | 4/12 | **10/12** | 11/12 | 8/12 | 4/12 | 3/12 | 1/12 |
| W2H | Standard | Hard | 0/12 | 0/12 | 0/12 | 0/12 | 0/12 | 0/12 | 0/12 |

Standard Normal paired: +6/−0 on both sets.

## Reading
- **Reading the weather pays, reproducibly, with the driver's perception limited in the storm:** Normal Sprint +10/−0 and +9/−0; Normal Standard 12/12 and 10/12 for the reader against 6/12 and 4/12 blind (round 2: 7/12 vs 1/12 — the Standard cliff is gone for the reader).
- **Jumping is not banned but no longer an exploit:** timed hops ≤ blind, hop spam < blind (a clipped jump now costs at least a plough: `driftRow.measure.test.ts`).
- **Blizzard stance:** knocks fall ~4× (1.3–1.5 → 0.3 per run); wins +3 on W2H, +1 on W3H on its own. Small, never negative.
- **The lee (+ lee column):** still not a reliable gain (W3H −2 Sprint, −3 Standard; W2H ±0 / +1). The caption no longer advises it (W-057); W-055 stays open.
- **Hard:** still steep (Sprint 3–10/24 for the reader, Standard 0/12, as Fjord's Hard Standard). The Yeti's rules are unchanged; Hard's weather equals Normal's.
- **Classic (default) course — W-056 NOT resolved.** `CLASSIC-SPR@WHITE` Normal is still caught for blind and both informed policies (~49–50 s, ~590 m): the first chase starts as the first storm peaks, and the first covering drift row (gap 19 m off the line) sits under a blizzard cell at the same spot. The result is fragile — it flipped between won and lost as obstacle placement shifted with unrelated fixes — so it needs a design rule (fair weather for the first chase, or no blizzard cell on a covering row), not tuning. Classic Standard Normal is won by both readers (gap 47 m) and lost blind. Alpine and Fjord Classic are unchanged by this round.
