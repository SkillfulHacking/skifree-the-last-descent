# W-056 — the default course, re-measured with two general placement rules

**Rules (`c82dacf`, `src/world/biomes/whiteout/hazards.ts`)**, for every course and seed. There is no Yeti change and no Classic special case.
1. **No blizzard cell's knock zone (≈ 51 m) reaches a drift row's way through.** The way through is the flagged gap, its approach (from 60 m before the row) and rejoin (to 35 m after), and the strip between the line and the gap. A cell that would reach it moves along its band to the nearest clear spot, or is not placed. Before the rule, 123 of the 145 cells on the checked courses sat over a row's way through.
2. **Every chase opens on a fair stretch: the first 320 m past each cave trigger,** about the chase's first 20 s. No cell's knock zone reaches it, and a drift row there leaves its gap on the racing line. The storm still blows.

**Build measured:** the simulation source equals `c82dacf` (`git diff c82dacf f915a77 -- src` touches only rendering, camera, captions and the cave squall's presentation). Runner: `tests/sim/balance.measure.test.ts`; driver: `tests/sim/whiteoutDriver.ts`. These are model drivers, not human playtesters.

## The default course (Classic), `classic_c82dacf.jsonl`
| Length | Diff | blind | reader (informed2NoLee) | + lee | drifts only | blizzard only |
|---|---|---|---|---|---|---|
| Sprint | Normal | won, 40.7 m | **won, 44.5 m** | won, 44.5 | won, 44.5 | won, 40.7 |
| Sprint | Relaxed | won | won | won | won | won |
| Sprint | Hard | caught | caught | caught | caught | caught |
| Standard | Normal | caught | **won, 50.6 m** | won, 29.4 | won, 28.3 | caught |
| Standard | Relaxed | won | won | won | won | won |
| Endurance | Normal | won, 34.7 m | won, 37.0 m | won | won | won, 6.1 m |
| Hard (Standard, Endurance) | | caught | caught | caught | caught | caught |

Before the rules, round 3 at `5c73ffe`: Classic Sprint Normal was caught for every policy, at about 590 m.

## Held-out seeds, Daily courses (wins; reader vs blind paired by seed)
| Set | Length | Diff | blind | reader | + lee | drifts only | blizzard only | timed hop | hop spam | reader vs blind | median min gap | knocks/run |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| W3H | sprint | hard | 1/24 | 9/24 | 10/24 | — | — | — | — | +8/−0 | 3 → 3 m | 0.42 → 0.00 |
| W3H | sprint | normal | 18/24 | 24/24 | 23/24 | 23/24 | 18/24 | 17/24 | 16/24 | +6/−0 | 41 → 47 m | 0.92 → 0.25 |
| W3H | sprint | relaxed | 24/24 | 24/24 | 24/24 | — | — | — | — | +0/−0 | 48 → 48 m | 1.08 → 0.25 |
| W2H | sprint | hard | 1/24 | 9/24 | 6/24 | — | — | — | — | +8/−0 | 3 → 3 m | 0.42 → 0.17 |
| W2H | sprint | normal | 18/24 | 24/24 | 23/24 | 21/24 | 18/24 | 16/24 | 15/24 | +6/−0 | 38 → 47 m | 1.21 → 0.29 |
| W3H | standard | hard | 0/12 | 0/12 | 0/12 | — | — | — | — | +0/−0 | 3 → 3 m | 0.92 → 0.50 |
| W3H | standard | normal | 5/12 | 12/12 | 9/12 | 9/12 | 4/12 | 2/12 | 1/12 | +7/−0 | 3 → 39 m | 4.25 → 1.17 |
| W2H | standard | normal | 4/12 | 10/12 | 11/12 | 8/12 | 3/12 | 2/12 | 3/12 | +6/−0 | 3 → 50 m | 3.25 → 1.50 |
| DAILY | sprint | normal | 8/8 | 8/8 | — | — | — | — | — | +0/−0 | 41 → 44 m | 1.00 → 0.25 |
| DAILY | standard | normal | 6/8 | 8/8 | — | — | — | — | — | +2/−0 | 34 → 44 m | 5.50 → 1.00 |

Round 3 before the rules (`5c73ffe`, round3/README.md):
- **Normal Sprint:** blind 14/24 and 15/24, reader 24/24.
- **Normal Standard:** blind 6/12 and 4/12, reader 12/12 and 10/12.
- **Hard Sprint (reader):** 3/24 and 10/24.

## Reading
- **The default course is winnable by the weather reader with a margin:** 44.5 m on Sprint, 50.6 m on Standard (Normal). It is gated in `tests/unit/w056_weather_rules.test.ts` (the rules) and `whiteout.test.ts` (fixed seeds).
- **Reading the weather still decides outcomes:**
  - +6/−0 on both held-out Normal Sprint sets and +6/−0 and +7/−0 on Normal Standard. No seed is lost by reading.
  - Knocks per run fall by about 4×.
  - The fair openings make Normal Sprint kinder to blind play: 18/24 on both sets, against 14–15.
- **Hard Sprint:** the reader wins 9/24 on both sets (was 3/24 and 10/24); blind wins 1/24. Hard Standard is still 0/12.
- **The lee (+ lee column)** is still not a net gain (W-055).
- **Rejected attempt:** rim stretches (W-065) on top of these rules cost the reader Classic Standard and 6–9 Sprint seeds (`with_rim_6264e6d/`). They were reverted.
