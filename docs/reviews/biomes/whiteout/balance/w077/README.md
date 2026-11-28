# W-077: a credible Yeti, measured (round 3)

**Runner:** `tests/sim/tension.measure.test.ts`, the same seven players as `../tension/`.
- **Base driver:** the skilled autopilot; on Whiteout, the weather reader (informed2NoLee). The drivers are identical between every candidate.
- **Courses:** Classic plus six fresh held-out Custom seeds (T4H-01…06), Sprint and Standard, Normal and Hard. Also Classic Endless (encounters 1–3) and Endurance.
- **Per run:** the gap every 2 s (`traj`), the minimum gap, and the seconds spent within 110 / 45 / 25 / 13 m.
- **Summary tool:** `python3 -I tools/tension_summary.py <a.jsonl> [<b.jsonl>]`.

These are model drivers, not human playtesters.

## The problem, measured (`baseline.jsonl`, `526785a`)
- **Alpine:** a competent skier outruns the Yeti's shipped pace on the steep runs (20–28 m/s against 16.5 m/s). His distance-based catch-up then holds him 115–170 m behind.
  - A crash 20 s in costs about 50 m from there, which still leaves him beyond 45 m (gap trajectories in the jsonl).
  - Normal Standard: the late crash's median minimum gap is 51 m, and the sloppy (competent) run's is 48 m.
  - Fjord grades the same players (late crash 31 m, competent 21 m).
- **Whiteout Standard Normal on the held-out seeds:** graded like Fjord. Competent 40 m, crash 16 m, late crash 30 m, poor route 4/7 caught.
  - The earlier W-077 note for Whiteout came from the default course alone, so it is withdrawn.
- **Whiteout's 320 m fair opening (W-056) is not the cause.** Without it (`O1_whiteout_no_opening.jsonl`):
  - Standard is unchanged.
  - Sprint is barely harsher: the competent run's minimum gap falls from 20.5 to 7.5 m, and the clean reader is caught once in 7.
  - The opening stays.

## Candidates (Alpine; isolated; the same seeds and drivers)
| Experiment | What | Result | Verdict |
|---|---|---|---|
| B1 pace 1.05 | every Alpine encounter's speedMul × 1.05 | small; Standard late crash still 51 m | too weak |
| **B2 pace 1.10** | × 1.10 | Sprint graded like Fjord; Standard crash 22 m (MOVE range, all recover); late crash 46 m | **chosen** |
| B4 pace 1.12 | × 1.12 | Standard late crash 40 m; Sprint early crash caught 5/7 | no gain on Standard for more harm on Sprint |
| B3 pace 1.15 | × 1.15 | Standard late crash 33 m; but Sprint early crash caught 6/7 (Fjord 3/7), and the default course's one-crash and Endless claims fail | too harsh: one mistake stops being recoverable |
| A1 slopes × 0.9 | gentler generated Alpine terrain | Sprint crash 4/7, Standard barely moves (late crash 51 m) | the course alone doesn't do it, and it reshapes every Alpine course |
| A2 slopes × 0.8 | gentler still | Sprint competent caught 3/7, Hard skilled caught 2/7, Standard late crash 44 m | rewrites Alpine's character for a weak Standard effect |
| C1 pace 1.10 + slopes × 0.9 | both | like B3 | no better than pace alone |
| C presentation | distant calls, CLOSING (amber/red), landing cues | report the real gap only; cannot make a mistake cost anything | kept, already shipped (`../tension/`) |

## Chosen: a fixed pace for Alpine (`terrain.encounterPace = 1.10`)
- **Set when each encounter is created** (`profile.ts`): deterministic and the same in every chase. It does not depend on the gap.
- **Unchanged:** the Yeti's rules, his catch-up, the Hard modifier and the slow-start rules.
- **Fjord and Whiteout are pinned at 1.** `deriveBiome` would otherwise inherit Alpine's value.
- **Endless:** its escalation above 1 keeps its shipped schedule, with the pace as its floor. Encounters run ×1.10, ×1.10, ×1.10, ×1.15, ×1.20 instead of ×1.00…×1.20.
- **Why not more:** at 1.15 a single early crash on Sprint is caught 6 times in 7 (Fjord: 3). The owner asked for graded risk with a chance to recover, not guaranteed death.
- **Remaining gap:** a crash 20 s into an Alpine Standard chase still rarely brings the Yeti inside 45 m (median 46 m). On Alpine Standard the risk comes from a sloppy run, an early crash or a poor line.


### Alpine, Normal: before → after (caught · median min gap · median s < 45 m · median s < 25 m)

| Player | Sprint before | Sprint after | Standard before | Standard after |
|---|---|---|---|---|
| skilled | 0/7 · 50 m · 0 s · 0 s | 0/7 · 50 m · 0 s · 0 s | 0/7 · 51 m · 0 s · 0 s | 0/7 · 51 m · 0 s · 0 s |
| competent | 0/7 · 43 m · 2 s · 0 s | 3/7 · 43 m · 2 s · 0 s | 1/7 · 48 m · 0 s · 0 s | 2/7 · 39 m · 3 s · 0 s |
| cautious | 7/7 · 3 m · 11 s · 5 s | 7/7 · 3 m · 8 s · 3 s | 7/7 · 3 m · 10 s · 5 s | 7/7 · 3 m · 8 s · 3 s |
| crash | 1/7 · 22 m · 25 s · 15 s | 4/7 · 3 m · 10 s · 5 s | 0/7 · 36 m · 7 s · 0 s | 0/7 · 22 m · 16 s · 4 s |
| lateCrash | 2/7 · 46 m · 2 s · 0 s | 3/7 · 20 m · 5 s · 2 s | 0/7 · 51 m · 0 s · 0 s | 0/7 · 46 m · 2 s · 0 s |
| poorRoute | 5/7 · 3 m · 6 s · 2 s | 7/7 · 3 m · 16 s · 6 s | 4/7 · 3 m · 4 s · 1 s | 6/7 · 3 m · 19 s · 2 s |
| slowArrival | 0/7 · 28 m · 4 s · 0 s | 0/7 · 28 m · 4 s · 0 s | 0/7 · 30 m · 4 s · 0 s | 0/7 · 30 m · 4 s · 0 s |

### Alpine, Hard: before → after (caught · median min gap · median s < 45 m · median s < 25 m)

| Player | Sprint before | Sprint after | Standard before | Standard after |
|---|---|---|---|---|
| skilled | 0/7 · 50 m · 0 s · 0 s | 1/7 · 34 m · 8 s · 0 s | 0/7 · 46 m · 2 s · 0 s | 1/7 · 46 m · 2 s · 0 s |
| competent | 4/7 · 3 m · 11 s · 4 s | 4/7 · 3 m · 13 s · 5 s | 3/7 · 39 m · 3 s · 0 s | 3/7 · 28 m · 5 s · 0 s |
| cautious | 7/7 · 3 m · 9 s · 4 s | 7/7 · 3 m · 7 s · 3 s | 7/7 · 3 m · 8 s · 4 s | 7/7 · 3 m · 6 s · 3 s |
| crash | 6/7 · 3 m · 10 s · 5 s | 7/7 · 3 m · 5 s · 3 s | 0/7 · 22 m · 18 s · 6 s | 6/7 · 3 m · 7 s · 4 s |
| lateCrash | 4/7 · 3 m · 4 s · 2 s | 4/7 · 3 m · 6 s · 2 s | 1/7 · 39 m · 10 s · 0 s | 5/7 · 3 m · 16 s · 8 s |
| poorRoute | 7/7 · 3 m · 23 s · 7 s | 7/7 · 3 m · 16 s · 8 s | 6/7 · 3 m · 10 s · 2 s | 7/7 · 3 m · 20 s · 10 s |
| slowArrival | 0/7 · 23 m · 11 s · 1 s | 2/7 · 23 m · 28 s · 5 s | 0/7 · 21 m · 5 s · 1 s | 2/7 · 21 m · 10 s · 1 s |

### Fjord (unchanged; reference): Normal | Hard

| Player | Sprint Normal | Standard Normal | Sprint Hard | Standard Hard |
|---|---|---|---|---|
| skilled | 0/7 · 45 m · 0 s · 0 s | 0/7 · 45 m · 0 s · 0 s | 1/7 · 26 m · 11 s · 0 s | 3/7 · 17 m · 14 s · 4 s |
| competent | 1/7 · 41 m · 2 s · 0 s | 3/7 · 21 m · 14 s · 5 s | 5/7 · 3 m · 11 s · 4 s | 7/7 · 3 m · 32 s · 9 s |
| cautious | 7/7 · 3 m · 10 s · 4 s | 7/7 · 3 m · 10 s · 4 s | 7/7 · 3 m · 9 s · 3 s | 7/7 · 3 m · 8 s · 3 s |
| crash | 3/7 · 4 m · 20 s · 8 s | 2/7 · 16 m · 21 s · 12 s | 7/7 · 3 m · 6 s · 4 s | 6/7 · 3 m · 8 s · 5 s |
| lateCrash | 2/7 · 26 m · 9 s · 0 s | 3/7 · 31 m · 8 s · 0 s | 5/7 · 3 m · 6 s · 3 s | 5/7 · 3 m · 9 s · 4 s |
| poorRoute | 6/7 · 3 m · 8 s · 3 s | 3/7 · 15 m · 4 s · 1 s | 7/7 · 3 m · 15 s · 7 s | 7/7 · 3 m · 33 s · 11 s |
| slowArrival | 0/7 · 27 m · 7 s · 0 s | 0/7 · 28 m · 5 s · 0 s | 2/7 · 20 m · 23 s · 2 s | 4/7 · 3 m · 37 s · 5 s |

### Whiteout (unchanged; reference): Normal | Hard

| Player | Sprint Normal | Standard Normal | Sprint Hard | Standard Hard |
|---|---|---|---|---|
| skilled | 0/7 · 44 m · 1 s · 0 s | 0/7 · 43 m · 1 s · 0 s | 5/7 · 3 m · 8 s · 3 s | 2/7 · 43 m · 3 s · 0 s |
| competent | 2/7 · 20 m · 10 s · 6 s | 1/7 · 40 m · 2 s · 0 s | 5/7 · 3 m · 14 s · 7 s | 5/7 · 3 m · 25 s · 8 s |
| cautious | 7/7 · 3 m · 10 s · 5 s | 7/7 · 3 m · 11 s · 5 s | 7/7 · 3 m · 8 s · 4 s | 7/7 · 3 m · 9 s · 4 s |
| crash | 4/7 · 3 m · 16 s · 8 s | 2/7 · 16 m · 13 s · 6 s | 6/7 · 3 m · 7 s · 4 s | 6/7 · 3 m · 6 s · 4 s |
| lateCrash | 4/7 · 3 m · 4 s · 2 s | 2/7 · 30 m · 11 s · 0 s | 6/7 · 3 m · 5 s · 2 s | 5/7 · 3 m · 7 s · 3 s |
| poorRoute | 6/7 · 3 m · 10 s · 5 s | 4/7 · 3 m · 10 s · 3 s | 7/7 · 3 m · 8 s · 4 s | 7/7 · 3 m · 26 s · 3 s |
| slowArrival | 1/7 · 25 m · 5 s · 0 s | 0/7 · 28 m · 8 s · 0 s | 6/7 · 3 m · 26 s · 6 s | 3/7 · 7 m · 33 s · 2 s |

### Alpine Endless (encounters 1–3) and Endurance, Classic, Normal: outcome · min gap (before → after)

| Course | Player | Alpine before | Alpine after | Fjord | Whiteout |
|---|---|---|---|---|---|
| endless #1 | competent | escaped 49 m | escaped 49 m | escaped 15 m | escaped 49 m |
| endless #1 | crash | escaped 45 m | escaped 31 m | escaped 17 m | escaped 27 m |
| endless #1 | lateCrash | escaped 53 m | escaped 53 m | escaped 41 m | escaped 51 m |
| endless #1 | skilled | escaped 53 m | escaped 53 m | escaped 43 m | escaped 51 m |
| endless #2 | competent | escaped 47 m | escaped 47 m | caught -1 m | caught -1 m |
| endless #2 | crash | escaped 52 m | escaped 52 m | escaped 40 m | escaped 49 m |
| endless #2 | lateCrash | escaped 52 m | escaped 52 m | escaped 40 m | escaped 49 m |
| endless #2 | skilled | escaped 52 m | escaped 52 m | escaped 40 m | escaped 49 m |
| endless #3 | competent | escaped 49 m | escaped 49 m | caught -1 m | caught -1 m |
| endless #3 | crash | escaped 52 m | escaped 52 m | escaped 45 m | escaped 42 m |
| endless #3 | lateCrash | escaped 52 m | escaped 52 m | escaped 45 m | escaped 42 m |
| endless #3 | skilled | escaped 52 m | escaped 52 m | escaped 43 m | escaped 45 m |
| endurance | competent | escaped 35 m | escaped 35 m | escaped 45 m | escaped 32 m |
| endurance | crash | escaped 33 m | escaped 20 m | escaped 21 m | escaped 22 m |
| endurance | lateCrash | escaped 42 m | escaped 42 m | escaped 51 m | escaped 37 m |
| endurance | skilled | escaped 42 m | escaped 42 m | escaped 51 m | escaped 37 m |

## Side effects, measured
- **Default Alpine course (`game.test`):** the skilled skier still wins after one crash or two. An intermediate skier's crash 40 s in on seed 42, which shipped as a win, is now caught.
- **Endless seed 99:** the skilled autopilot now loses the second encounter (×1.10, was ×1.05). Seeds 7 and 1234 still run 25 km.
- **The terrain-contact regression runs divide the pace out.** They pin the terrain, not the chase.
- **W-056 (Whiteout) is unaffected.** Whiteout's pace is 1, and its balance rows are identical (`../w056/at_404ed88/`).
