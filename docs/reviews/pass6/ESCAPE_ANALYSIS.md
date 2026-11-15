# Pass 6: Yeti escape after a cave, with and without pole pushing

Harness: `tests/sim/escape.ts`. It runs the headless game (`simulateCourse`, the same physics and Yeti AI as the
browser build) to 1.2 km past the first cave. Each run records:
- the skier's speed at the chase start;
- the grade of the next 400 m: the profile grade (mean and minimum) and the effective grade along the racing line;
- the Yeti's distance when he lands;
- his actual ground speed (mean and maximum);
- the gap and the skier's speed at 0, 5, 10, 15, 20 and 30 s;
- the outcome and the capture time.

Raw rows are in `data/*.jsonl.gz`. Model reviewers and simulated drivers are not human playtesters.

## Sample

- 60 Daily Mountains (2026-09-16 … 2026-11-14) and 20 Custom seeds (`SEED01`…`SEED20`).
- Alpine and Fjord; Sprint and Standard; Relaxed, Normal and Hard.
- Whiteout is tested separately on its branch.

Drivers:

| Driver | What it does |
|---|---|
| `skilled` | Game autopilot; tucks on straights. |
| `intermediate` | Steers like a player; tucks less and checks speed. |
| `straight` | Follows the line, always tucked. Below 7 m/s the old skate assist engages. |
| `gravity` | Follows the line, tucked only above 7 m/s, so there is no skate assist. This is what the slope alone gives. |
| `poles` | As `straight`, but holds the Recover button below 40 km/h, and lets go once after getting up. |

## What the pursuit really does

The 16.5 m/s base speed is not the chase speed. Measured over all runs:

| Measure | Value |
|---|---|
| Yeti mean ground speed (median) | 19.0 m/s |
| Yeti peak | 28.3 m/s, while lunging |
| Yeti's distance when he lands | median 47.6 m, minimum 35.2 m |

The Yeti's speed comes from:
- the 4 s warm-up from 55 % of his pace;
- the gentle-ground cap (13 + 0.5 × slope);
- catch-up pressure beyond 60 m (+9 m/s, and +7 beyond 105 m);
- lunges inside 13 m.

**Terrain after a cave.** Every generated course uses the same shelf:
- 8° at the cave −50 m;
- 9° at +15 m;
- 18° at +55 m;
- 19° at +130 m.

The profile minimum over the first 400 m is 8.2–10.6° on every sampled course. The effective grade along the line is 11.7–21.1°, with a median of 16.8°. There are no flat post-cave profiles; the shallow part is the first ~60 m.

**Skied at speed.** The autopilots reach the trigger at a median 15.9 m/s (minimum 12.2 m/s) and escape:

| Drivers | Normal | Hard |
|---|---|---|
| Alpine, all three | 0 caught of 37–80 per group | 2–7 caught, late (40–60 s) |
| Fjord Sprint | 2 of 80 caught, at ~54 s (the headwind's long-chase wear) | 33–40 of 80 caught |

## The trap: a slow start

A player who comes into the cave slowly, because they stopped, braked or turned at the cave, starts the chase
with almost no speed. On the 8–9° shelf the skier gains about 1.3 m/s², while the Yeti starts at about 9 m/s and
rises to about 17 m/s within 4 s.

Old AI, 2 m/s at the chase start, Sprint, 40 courses (`data/escape_slow_start_old_ai.jsonl.gz`):

| | gravity | straight (old skate) | poles |
|---|---|---|---|
| Alpine Relaxed | 21/37 caught, median 6.4 s | 0/40 | 0/40 |
| Alpine Normal | **29/37 caught, median 6.3 s** | 5/40, 9.7 s | 0/40 |
| Alpine Hard | 32/37, 6.3 s | 21/40, 7.8 s | 10/40 |
| Fjord Normal | **35/38, 6.5 s** | 21/40, 9.7 s | 15/40, 21 s |
| Fjord Hard | 38/38 | 36/40 | 29/40 |

Being caught 6 s into the chase, with the gap closing from ~45 m at 7–8 m/s, is a low-speed trap: neither skill
nor reaction time can get out of it. The terrain itself is fine: the same skier starting at 6 m/s is never
caught on Alpine Normal.

## The fix: the chase start in step with the skier

The smallest correction is a cap on the Yeti's own pace for the first seconds: the skier's speed at the chase
start + 3 m/s + 1.1 m/s per second (`YETI.syncMargin`, `syncAccel`).
- The catch-up pressure is untouched.
- The cap is above his pace whenever the skier starts at more than about 14 m/s, so every chase skied at speed
  is **bit-identical** (round 1: all 225 as-skied `gravity` chases compared were unchanged; `yeti_escape.test.ts`).
- No terrain, course code or record changes.
- The Yeti is not slower anywhere else.

New AI, the same 40 courses (`data/escape_slow_start_new_ai.jsonl.gz`). Old → new caught:

| 2 m/s start | gravity | straight | poles |
|---|---|---|---|
| Alpine Relaxed | 21 → 0 | 0 → 0 | 0 → 0 |
| Alpine Normal | **29 → 0** | **5 → 0** | 0 → 0 |
| Alpine Hard | 32 → 10 | 21 → 5 | 10 → 4 |
| Fjord Relaxed | 25 → 4 | 4 → 0 | 1 → 0 |
| Fjord Normal | **35 → 15** | **21 → 9** | 15 → 8 |
| Fjord Hard | 38 → 26 | 36 → 23 | 29 → 20 |

| 6 m/s start | gravity | straight | poles |
|---|---|---|---|
| Alpine Normal | 0 → 0 | 0 → 0 | 0 → 0 |
| Alpine Hard | 9 → 6 | 9 → 5 | 4 → 3 |
| Fjord Normal | 8 → 8 | 9 → 9 | 6 → 6 |
| Fjord Hard | 23 → 24 | 23 → 23 | 23 → 21 |

**Gap and speed trajectories, not just win rates** (round 1 data). Medians at 5 and 10 s, 2 m/s start, Normal:

| | gap at 5 s | gap at 10 s | skier speed at 5 s | skier speed at 10 s |
|---|---|---|---|---|
| Alpine `gravity`, old AI | 17.0 m | caught | 9.6 m/s | — |
| Alpine `gravity`, new AI | 20.8 m | 22.4 m | 9.6 m/s | 18.6 m/s |
| Alpine `straight`, new AI | 26.8 m | 36.1 m | | |
| Alpine `poles`, new AI | 29.7 m | 44.4 m | 12.8 m/s | 20.3 m/s |
| Fjord `poles` | 29.2 m | 38.2 m | | |

The Yeti stays close at first, and the gap only opens once the skier is moving. Poles give a modest edge: about
3 m more than tucking at 5 s and about 8 m more at 10 s. Most of the fairness fix comes from the Yeti's start
cap, not from the poles. The review rightly pointed out that the first version of this document overstated
the poles' share.

**What remains (round 1):**
- Fjord Normal after a 2 m/s start: tucking is still caught in 9 of 40, at a median 33 s. The independent
  review showed that these are caused by the slow start, not by wear alone. On the same seeds, the as-skied run
  escapes while the slow start is caught 30–45 s in, because the gap never grows past the Yeti's catch-up
  threshold. On Fjord a slow start still costs a clean skier the run on about a quarter of courses. This is a
  real, remaining unfairness, and round 2 addresses part of it (below).
- An upright skier who never tucks (`gravity`) is caught on 15 of 38 Fjord courses at about 11 s.
- Hard stays hard.
- Pole pushing is a helpful skill, not a requirement: tucking alone escapes every Alpine Normal course.

## Pole pushing and the chase

- **Skied at speed, the poles change nothing.** Above 40 km/h the `poles` driver tucks, and above 55 km/h the
  poles give nothing. As-skied Normal: 0 caught on Alpine, 0 on Fjord, against 0 and 1 for `straight`.
- **Hard as skied:** Alpine 1 caught with poles against 2 tucking; Fjord 18 against 19.
- Tuck and poles never stack: holding both is exactly poling (`pole_push.test.ts`).

## Round 2, after the independent reviews

The physics, gameplay, hostile-critic, QA and animation reviewers are model-based and isolated; they are not
human playtesters. They found three things wrong with round 1:
- a slow start on the Fjord still lost the run;
- one fall right after a slow start meant certain capture (Alpine Normal 12/12);
- the result was not monotonic in the start speed.

Changes (`YETI` in `src/yeti/YetiAI.ts`):
- **Early fall.** Within the first 10 s, the cap's clock stops while the skier is down and restarts from
  their speed when they are back up. The Yeti keeps coming meanwhile, so the fall still costs ground.
- **Slow-start delay.** The Yeti stands and roars up to 2.5 s longer before his first stride: 2.5 s for a
  standstill, linearly less, and none from 11 m/s (40 km/h).
- **Escalation.** The cap scales with `speedMul`, so escalated Endless Yetis are unaffected at speed.

I also tried a "pace-matching" variant, holding the Yeti to the skier's best speed + 1 m/s. It was worse: the
gap at 10 s halved. It was rejected (`data/escape_r2_rejected_pace_match.jsonl.gz`).

The same 30 courses (20 Daily, 10 Custom), Sprint. Each cell is round-1 caught → round-2 caught, with the
median gap at 10 s in brackets (`data/escape_r1_cap_only.jsonl.gz` → `data/escape_r2_final.jsonl.gz`). The
start speed is in m/s; "as" means skied into the cave.

| | 0 | 2 | 4 | 6 | 8 | as |
|---|---|---|---|---|---|---|
| Alpine Normal `gravity` | 13→0 (4→30) | 0→0 (18→44) | 0→0 (28→53) | 0→0 (40→61) | 0→0 (54→70) | 0→0 (96) |
| Alpine Normal `straight` | 0→0 (34→58) | 0→0 | 0→0 | 0→0 | 0→0 (54→70) | 0→0 (97) |
| Alpine Normal `poles` | 0→0 (43→67) | 0→0 | 0→0 | 0→0 | 0→0 (61→77) | 0→0 (98) |
| Alpine Hard `straight` | 7→1 | 9→1 | 11→2 | 6→1 | 3→1 | 1→1 |
| Fjord Normal `gravity` | 20→9 | 13→8 | 9→5 | 6→4 | 6→3 | 1→1 |
| Fjord Normal `straight` | 9→3 (31→53) | 8→3 | 8→3 | 7→3 | 5→2 | 1→1 (82) |
| Fjord Normal `poles` | 6→3 (39→62) | 8→2 | 7→2 | 6→2 | 5→2 | 0→0 (81) |
| Fjord Hard `straight` | 18→15 | 18→15 | 17→17 | 19→17 | 18→15 | 14→14 |

What the table shows:
- **Monotonic.** The gap at 10 s now grows with the start speed in every row.
  `yeti_escape.test.ts` checks this seed by seed, within 4 m: terrain and lunges add noise. The test also
  checks that a slow start always stays behind a chase begun at speed.
- **No sandbagging.** Entering slowly never beats entering fast. The median gap at 10 s is 53–62 m from a
  standstill against 81–98 m skied in.
- **One fall 3 s into a slow start** (`data/escape_r2_crash3.jsonl.gz`):
  - Alpine Normal: 0/15 caught, for both `straight` and `poles` (was 12/12 in the critic's run).
  - Fjord Normal: 2–3/15 caught, against 3–4/15 for the same fall in a chase begun at speed.
- **Fjord Normal.** A slow start still costs a clean, tucking skier the run on about 10 % of courses (3 of 30),
  against 1 of 30 skied in. Hard stays hard.
- **Chases begun at speed** (median entry 15.9 m/s, minimum seen 12.2 m/s, above the 11 m/s threshold) are
  bit-identical: all 114 as-skied runs that overlap the round-0 data (old AI, the `gravity` driver) have identical gaps, minimum gap and outcome. `terrain_contact.test.ts` holds the reference runs: the one
  run that starts its chase slowly (`EC1 average`, never tucks) has the same skier steps up to the old
  capture time and is caught 0.66 s later.
- **Poles.** A helpful skill: from a standstill they add 9 m of gap at 10 s over tucking, and win 1 more
  Fjord course. They are not required: tucking alone escapes every Alpine Normal course.
