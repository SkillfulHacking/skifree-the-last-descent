# W-034 — Whiteout balance re-measured on the corrected hazard engine

**Engine:** `pass5-whiteout` at `0f04659`, with production `main` `e30cd33` merged in (PR #11: hazard physics through the whole reach, one pass report). Measured 2026-11-17.

**Harness (committed):** `tests/sim/balance.ts` and `tests/sim/balance.measure.test.ts`, run as `npx vitest run --config vitest.sim.config.ts`. It is not part of the unit suite. Raw data, one JSON object per run, is in this folder; every row has its exact `courseId`, for example `SEED-2163721839-SPR@WHITE`.

**Driver:** `tests/sim/whiteoutDriver.ts`, the skilled path follower with a 0.25 s reaction lag and obstacle avoidance. **Policies differ only in the three weather decisions:**
- **line:** the sheltered main line in storms, or the exposed fast line;
- **drifts:** steer for the gap in a drift row, or plough through;
- **blizzard:** stand up out of the tuck while a cell blows, or keep tucking.

On Alpine and Fjord those decisions have nothing to act on. That's checked: informed and blind give bit-identical runs there. So "blind" is the same driver on the same terms in every location.

Fresh seeds `W034-01`…`W034-24` (Sprint) and `W034-01`…`W034-12` (Standard).

**What this does not measure:** visibility. The driver sees the line through any fog, so the human cost of low visibility, and the value of braking before a whiteout, is not measured. Human playtesting is still needed.

## Superseded results (kept for comparison) — INVALIDATED
W-014/W-015 reported Normal Sprint: informed 10/12, blind 8/12; Hard: 3/16.
- Those were measured with the branch's flawed hazard-pass skip. A blizzard cell stopped acting 60 m from its centre once reported, although it acts to 84 m.
- **Rerunning those same seeds (WD1–12) on the corrected engine gives the same 10/12 vs 8/12** (`oldseeds_rerun.jsonl`). The engine fix barely moved these outcomes. The "informed is better" conclusion came from a small, favourable seed set, not from the engine.

## 1. Wins by location and difficulty (same driver, weather-blind)

| | Relaxed Sprint | Normal Sprint | Hard Sprint | Relaxed Standard | Normal Standard | Hard Standard |
|---|---|---|---|---|---|---|
| Alpine | 24/24 | 24/24 | 12/24 | 12/12 | 12/12 | 2/12 |
| Fjord | 24/24 | 23/24 | 8/24 | 12/12 | 12/12 | 0/12 |
| **Whiteout** | 24/24 | **15/24** | 6/24 | 12/12 | **6/12** | 0/12 |
| Whiteout, informed | 22/24 | 14/24 | 4/24 | 12/12 | 4/12 | 0/12 |

**Yeti gap at 10 / 20 / 30 s into each chase (Sprint, median):**

| | Relaxed | Normal | Hard |
|---|---|---|---|
| Alpine | 103 / 130 / 132 | 98 / 124 / 127 | 87 / 107 / 115 |
| Fjord | 101 / 125 / 131 | 82 / 97 / 103 | 71 / 68 / 69 |
| Whiteout | 91 / 110 / 121 | **75 / 77 / 84** (stalls) | **66 / 52 / 38** (closes) |

Mean speed on Normal Sprint: Alpine 20.4, Fjord 18.3, Whiteout 16.5 m/s. Whiteout Relaxed is a gentle step; **Normal is a large step over Fjord** (Sprint 15/24 vs 23/24; Standard 6/12 vs 12/12).

## 2. Do the weather decisions reward good play? — mostly NOT (new defect W-035)
Paired by seed (Sprint, vs blind; win flips are wins gained / lost):

| Decision alone | Normal wins | Relaxed wins | Time when both win |
|---|---|---|---|
| Sheltered line in storms | **17/24** (+4 / −2) | 24/24 | ±0.0 s |
| Stand up in a blizzard | 16/24 (+1 / 0) | 24/24 | ±0.1 s; knocks 0.92 → 0.29 per run |
| Steer for drift gaps | **12/24** (0 / −3) | **22/24** (0 / −2) | Relaxed +2.8 s (slower) |
| Steer for drift gaps, competent reader | 13/24 (+1 / −3) | 20/24 (0 / −4) | Relaxed +1.6 s (slower) |
| All three (informed) | 14/24 (+2 / −3) | 22/24 | −0.6 s |
| Exposed vs sheltered route (others informed) | 14 vs 14 (4 / 4) | 22 vs 22 | — |

The "competent reader" sees the row earlier (40 m plus 2 s of travel), crosses gradually and keeps the tuck through gentle corrections.

On Normal Sprint, informed play wins 14/24 and blind play 15/24, but informed keeps a larger safety margin (median minimum gap 31 m vs 17 m). **Avoiding drifts loses, even for a competent reader:**
- 60% of rows cover the racing line with the gap 12–22 m to the side (`DRIFT.onLine`, the gap placement in `hazards.ts`);
- the detour costs more than the drift's drag.

Blizzard stance and route choice barely matter. Reading the weather is therefore close to a non-decision, and drift avoidance is an anti-decision.

## 3. Where Whiteout's difficulty comes from — mostly unavoidable taxes
Ablation, weather-blind driver, Normal Sprint, 24 seeds (`scratch/ablate.test.ts`, in-memory only):

| Mechanism removed | Wins | Mean speed (m/s) |
|---|---|---|
| none (baseline) | 15/24 | 16.5 |
| airborne wind and gust balance | 15/24 | 16.5 (no effect) |
| exposure side-slip and skid drag | 19/24 | 17.3 |
| headwind | 20/24 | 17.7 |
| blizzards | 18/24 | 16.8 |
| drifts* | 21/24 | 17.5 |
| drift and blizzard effects (also removes skid drag) | 23/24 | 18.3 |
| **all weather (terrain and Yeti only)** | **24/24** | 19.7 |

\* removing a hazard kind also changes where the other kind is placed, so the per-kind figures are approximate.

The ridge terrain is as fair as Alpine (24/24). The difficulty comes from headwind, exposure slip and drift drag, which the player cannot meaningfully avoid by reading the weather.

**Verdict on "unfair or more satisfying".** Not unfair in the sense of unavoidable deaths:
- the corrected blizzards act for about 6 s per cell;
- the trailing zone the old engine cut off is 11–13% of that, about 0.7 s per cell with about 0.35 m of slip;
- blizzards do not slow the skier (speed inside a cell is at or above the run average).

But it is **not satisfying as designed**. The Normal step over Fjord comes from flat costs rather than decisions, so a good weather reader is barely better off than a blind one. This is a gameplay defect (W-035, major) for the round-1 physics and gameplay reviewer.
- **Candidate directions** (not applied): drift gaps that are reachable without a costly detour; a larger reward for the storm line; headwind and slip that respond to stance or line rather than being flat.
- **Constraints:** do not lower the weather wholesale to raise win rates; do not change Yeti speed.

## 4. Hard
Hard Sprint: Whiteout 6/24 blind, 4/24 informed, against Alpine 12/24 and Fjord 8/24. The gap closes from 66 to 38 m over 30 s of chase. Snowball-driven catches dominate, as before (`snowballHits` in the data). In the knock probe, informed play did no better than blind.

## Files
| File | Contents |
|---|---|
| `whiteout_sprint.s*.jsonl` | 24 seeds × 3 difficulties × 7 policies |
| `whiteout_sprint_early.jsonl` | the competent drift reader |
| `whiteout_standard.s*.jsonl` | 12 seeds × 3 difficulties × 4 policies |
| `compare_*.s*.jsonl` | Alpine and Fjord, same seeds, lengths and difficulties |
| `oldseeds_rerun.jsonl` | the invalidated WD1–12 set on the corrected engine |
