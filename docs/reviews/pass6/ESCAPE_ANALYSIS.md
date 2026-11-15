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

## Round 3, after the second reviews

The round-2 reviewers (model-based, isolated, not human playtesters) re-ran the chase on fresh seeds
(2026-08-05/11/19, 2026-12-02/09/24/30 and custom words) and found three problems with round 2. Two of the
round-2 claims above were wrong as written:
- **"Bit-identical at speed" held only without a fall.** The early-fall restart also applied to chases begun at
  speed, so a fall in the first ~7 s cost almost nothing there: Fjord Hard, fall at 2 s, 2/8 caught where the
  old Yeti caught 8/8.
- **"Monotonic in every row" failed on fresh seeds.** The linear 2.5 s roar delay gave a standstill more lead
  than a 3–6 m/s start (Fjord Normal median gap at 10 s: 65.6 m at 0 m/s, 61.3 m at 3 m/s).
- **The EC1 "prefix" check proved nothing about the chase.** It hashes only the skier's steps, which never
  depend on the Yeti before a capture.

Changes:
- **The early-fall restart applies only to a chase that began below 11 m/s.** A fall counts by when it
  begins (inside the first 10 s), not by when the skier gets up.
- **Roar delay 1.6 s × (1 − (v / 11)²)**, flat near a standstill, in place of 2.5 s × (1 − v / 11).
- **EC1 check.** With the slow-start rules switched off, the EC1 average run is the old run exactly (hash
  `cb29719a`, caught at 64.817 s). With them on it is caught at 65.683 s (`a95c4ba9`).

Evidence (`data/r3_*.jsonl.gz`; 8 fresh courses: 2026-08-05, 2026-08-19, 2026-12-02, 2026-12-09, 2026-12-24,
KETTLE, MARMOT, HOTWAX; Sprint):

**Delay setting.** `r3_delay_linear` and `r3_delay_sweep` cover 1,632 runs. Whatever the setting, the closest
call (median minimum gap) rises with the start speed and does not depend on the delay, and no setting caught
anyone on Normal. Hard caught 1–2 of 8 at every start speed, the same as chases skied in at 12 m/s. Median
gap at 10 s, `straight` driver, with the chosen 1.6 s curve:

| Start speed (m/s) | 0 | 2 | 4 | 6 | 9 | 12 |
|---|---|---|---|---|---|---|
| Fjord Normal | 58.0 | 59.2 | 60.8 | 64.8 | 72.7 | 73.8 |
| Alpine Normal | 52.4 | 55.5 | 58.8 | 65.0 | 75.2 | 80.1 |
| Fjord Hard | 48.2 | 49.1 | 51.5 | 55.9 | 65.3 | 62.8 |

Seed by seed, the gap at 10 s never falls by more than 0.1 m as the start speed rises from 0 to 9 m/s, across
256 pairs. Above 9 m/s the Hard rows can dip a few metres where the slow-start rules fade out.
`yeti_escape.test.ts` now allows 2 m (was 4 m).

**Falls.** `r3_falls` has 960 runs: one fall at 2, 4, 7 or 9.5 s, or none. Each run is played twice, against
the current Yeti and against the pre-Pass 6 Yeti. Caught out of 8, current (pre-Pass 6 in brackets):

| | no fall | 2 s | 4 s | 7 s | 9.5 s |
|---|---|---|---|---|---|
| Fjord Normal, skied in | 0 (0) | 3 (3) | 3 (3) | 3 (3) | 3 (3) |
| Fjord Normal, standstill | 0 (4) | 0 (8) | 1 (8) | 1 (8) | 1 (8) |
| Fjord Hard, skied in | 1 (1) | 8 (8) | 8 (8) | 8 (8) | 5 (5) |
| Fjord Hard, standstill | 2 (6) | 3 (8) | 3 (8) | 3 (8) | 4 (8) |
| Alpine Normal, skied in | 0 (0) | 0 (0) | 0 (0) | 3 (3) | 4 (4) |
| Alpine Normal, standstill | 0 (5) | 0 (8) | 0 (8) | 0 (8) | 0 (8) |
| Alpine Hard, skied in | 1 (1) | 4 (4) | 3 (3) | 6 (6) | 4 (4) |
| Alpine Hard, standstill | 1 (8) | 2 (8) | 2 (8) | 2 (8) | 3 (8) |

- **Chases skied in, falls included, are identical to the pre-Pass 6 Yeti:** 160 of 160 runs have the same
  gaps and outcome (slowest entry 13.35 m/s). `yeti_escape.test.ts` checks this with falls at 2 and 3 s.
- **A fall still costs ground in a slow start.** The gap at 10 s drops from 58 m to 27–37 m on the Fjord
  (Normal).
- **An honest asymmetry.** One fall in the first few seconds is forgiven more after a slow start than in a
  chase begun at speed. That is because the fast-chase penalty is the original game's, deliberately left
  alone: the brief asked for the smallest correction. Stopping before the cave never pays: without a fall the
  slow start is behind at 10 s in every row, and a planned fall is not a strategy.
- **The Yeti stays threatening.** The closest call from a standstill is a median 23–25 m on Normal. A late
  fall, or Hard, still loses runs.

**Poles.** Holding the button can no longer be beaten by tapping it. A stroke that starts within 0.3 s of the
last one gets no head start. Before this change, a one-frame release between strokes gave +22 % speed on
the flat over 10 s (reviewer's measurement). `pole_push.test.ts` now checks that no release pattern and no
tapping rhythm beats holding, with or without the tuck.

**Remaining known minor issue.** On ice, holding tuck and poles together is about 0.2 m/s slower at 10 s
than tuck alone: the technique choice compares only the mean push and ignores what standing up costs.

## Round 4, after the third reviews

The round-3 reviewers (model-based, isolated, not human playtesters) used other fresh seeds: 2026-07-03,
07-14 and 07-22, 2027-01-06, 01-17 and 01-28, GLOGG and TOBOGGAN. They confirmed the following:
- The delay curve gives a gap at 10 s that rises with the start speed (never more than 0.1 m down across
  128 seed pairs).
- Chases skied in match the pre-Pass 6 Yeti: 96 of 96, falls included.
- The EC1 check now proves what it claims.
- QA and animation pass.

They also found two things wrong. Round 3 claimed both were impossible:
- **Tuck + tapping still beat holding.** With the tuck held, the skate pushes during the gap, and the next
  stroke still got its head start: +4.6 % distance in 10 s on the flat. The round-3 test could not catch
  this. It looked for the moment a stroke ended, but a held button starts the next stroke in the same physics
  step, so every "release" case was really holding. The round-3 sentence saying the test checks "with or
  without the tuck" was false.
- **The 11 m/s threshold worked as free fall insurance.** One fall at 3 s, Alpine Normal, start speed
  10.9 m/s against 11.1 m/s: 0/8 caught against 4/8. On Fjord Hard, stopping before the cave beat entering
  fast for a player who falls early more than about 1 time in 3. Round 3 said "stopping before the cave never
  pays"; that held for the gap but not for outcomes.

Changes:
- **Poles.** A stroke gets the first-stroke head start only when there has been no stroke and no skate push
  in the last 0.3 s. The test now presses again only after k idle steps (k = 1…90), and also uses fixed tap
  rhythms. It runs with and without the tuck, on the flat from rest and at 3 m/s, and on the upper course. It
  requires every pattern to be no better than the best of hold+tuck, tuck alone and hold alone. It was
  checked to fail without the fix (38.1 m against 36.5 m).
- **Yeti.** The early-fall restart, its 10 s window and its 11 m/s threshold are gone. One continuous rule
  replaces them: while the skier is down, the slow-start cap's clock runs at half rate (`syncDownRate` 0.5).
  In a chase begun at speed the cap is above the Yeti's own pace, so nothing changes there, and the effect
  fades out by itself between slow and fast starts.

Evidence (`data/r4_fall_rate.jsonl.gz`, 1,152 runs): 6 of the reviewers' fresh courses, Fjord and Alpine,
Normal and Hard, Sprint, the `straight` driver. One fall at 2, 5 or 9 s, or none. The rate while down is
0 (cap clock paused), 0.5 or 1 (no allowance).

Caught out of 6, for rates 0 | 0.5 | 1; the median gap at 10 s at rate 0.5 is in brackets:

| Start | no fall | fall 2 s | fall 5 s | fall 9 s |
|---|---|---|---|---|
| Alpine Normal, skied in | 0 (98) | 0 (16) | 1 (38) | 2 (92) |
| Alpine Normal, 0 m/s | 0 (45) | 1·3·5 (4) | 4·4·6 (2) | 5·5·6 (40) |
| Alpine Normal, 10.9 m/s | 0 (77) | 4 (0) | 4 (17) | 2 (71) |
| Fjord Normal, skied in | 1 (80) | 6 (7) | 6 (30) | 5 (76) |
| Fjord Normal, 0 m/s | 0 (50) | 1·3·6 (9) | 5·6·6 (9) | 6 (45) |
| Fjord Hard, skied in | 2 (74) | 6 (0) | 6 (24) | 6 (69) |
| Fjord Hard, 0 m/s | 4 (44) | 5·6·6 (6) | 6 (5) | 6 (39) |
| Alpine Hard, skied in | 0 (91) | 5 (0) | 4 (32) | 3 (85) |
| Alpine Hard, 0 m/s | 0 (39) | 3·4·5 (2) | 4·6·6 (0) | 6 (34) |

What it shows:
- **No reason to enter slowly.** At rate 0.5, a fall soon after a slow start is caught about as often as the
  same fall in a chase skied in (16 of 24 against 17 of 24 at 2 s), and more often for later falls (22–23 of
  24 against 16–17). Without a fall, a slow start is never ahead.
- **Not certain capture either.** Alpine Normal, a standstill and a fall at 2 s: 3 of 6 caught. Round 1 had
  12 of 12, the critic's original complaint.
- **No step.** A start at 10.9 m/s behaves like a chase skied in. `yeti_escape.test.ts` checks this: 10.9 and
  11.1 m/s are caught within one of each other, and the gap at 5 s is within 3 m. It checks it in aggregate,
  because one chase is chaotic and a few cm/s at the start can flip it.
- **Falls are expensive in general.** An early fall loses most chases on the Fjord whichever way the skier
  came in. That is the original game's behaviour and is unchanged for chases skied in.
- **Chases skied in** are still identical to the pre-Pass 6 Yeti, falls included (`yeti_escape.test.ts`, falls
  at 2, 3 and 9 s).

Clean runs are unchanged by this round: the delay curve and the cap are as in round 3. A clean slow start
escapes Normal; Hard still catches some.

## Round 5, after the fourth review

The round-4 reviewers (model-based, isolated) used new fresh courses: 2027-02-09, 2027-03-17, SNOWCAT and
FIRNLINE. They confirmed that chases skied in match the pre-Pass 6 Yeti (24 of 24, falls included), that a
clean slow start escapes on Normal (4 of 4 for `straight`, `poles` and `skilled`), and that there is no step
at 11 m/s.

They also found that two more claims from round 4 were false. This is the third round in a row with a false
"never" claim, because each fix was tested only on the case that had been reported:
- **Poles: "tuck + tapping never beats holding" was false above 7 m/s.** Coasting in the tuck through a gap
  of 0.3 s or more is almost free there, and the next stroke still got its head start: +1.2 % on ice,
  +0.3 % on snow. The test covered only snow, from 0 or 3 m/s.
- **Yeti: "no reason to enter slowly" was false against the 3–11 m/s band.** Round 4 compared a standstill
  only with chases skied in. After a fall at 2 s, a standstill entry was caught 1 of 4 times against 16 of 20
  for entries at 3–11 m/s. The cause was the half-rate clock while the skier is down: the inversion grows as
  the allowance grows.

Changes:
- **Poles.** The first-stroke head start applies only from near a standstill (below 1.5 m/s), which is what
  it was for. The test is now the reviewer's whole family:
  - flat, 1°, 9° and 13° × snow, ice and powder × 0, 3, 7, 10 and 14 m/s × tuck on or off;
  - for each, every idle-k press pattern and three tap rhythms;
  - each compared with the best of hold+tuck, tuck alone and hold alone.

  The worst pattern must be under +0.3 %. That margin is for alternating skate and poles at rest, which mixes
  two techniques and was accepted by the review. The test was checked to fail with the old head start
  (+0.77 %, ice, 9.5°, 10 m/s).
- **Yeti.** There is no allowance for a fall any more. The restart, the window and the slower clock are all
  gone. The slow-start help is now only a function of the start speed and time: the cap and the roar delay.
  A fall costs what it costs any chase that has not built a lead yet.

Evidence (`data/r5_fall_band.jsonl.gz`, 672 runs): 8 fresh courses (2027-02-09, 2027-02-21, 2027-03-04,
2027-03-17, SNOWCAT, FIRNLINE, PINECONE, SLUSHY), Fjord and Alpine, Normal, the `straight` driver. Caught
out of 16:

| Start speed (m/s) | 0 | 2 | 4 | 6 | 9 | 10.9 | skied in |
|---|---|---|---|---|---|---|---|
| no fall | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| fall at 2 s, half-rate clock (round 4) | 5 | 10 | 12 | 14 | 13 | 13 | 5 |
| fall at 2 s, no allowance (round 5) | 12 | 15 | 15 | 16 | 13 | 13 | 5 |
| fall at 4 s, half-rate clock (round 4) | 12 | 14 | 14 | 14 | 10 | 10 | 2 |
| fall at 4 s, no allowance (round 5) | 15 | 15 | 16 | 14 | 10 | 10 | 2 |

What it shows:
- **Clean runs are unchanged.** Every start speed escapes Normal without a fall.
- **An early fall is roughly as costly from a standstill as from any start below 11 m/s.** This is how the
  original game already treats an entry at 9–11 m/s: 13 of 16 caught, with no slow-start rules involved. Only
  chases skied in fast have the lead to survive it.
- **A small residual remains, and it is stated rather than hidden.** The slow-start help itself still leaves a
  standstill slightly better off after a fall: 12 of 16 caught against 13–16 of 16 here, and 14 of 16 against
  16 of 16 on the test's seeds. Stopping before the cave therefore buys a 1-in-8 chance at most, and only for a
  player who then falls within seconds. Without a fall it only costs gap. `yeti_escape.test.ts` asserts this
  bound: a standstill is caught at least 75 % of the time and is never better than a faster start by more
  than 2 in 16. Under the round-4 rule this was 5/16 against 14/16.
- **Round 1's complaint** that one fall right after a slow start meant certain capture is answered by
  measurement, not by an exception. That fall is now about as fatal as the same fall after a 9–11 m/s entry
  in the unchanged original game. It is not a slow-start penalty.

## Round 6, after the fifth review: what is and is not guaranteed

The round-5 reviewers searched the classes, not single instances. For physics they used a random search plus
hill-climbing over input sequences on synthetic slopes from −4° to 15°, on snow, ice, powder and packed,
at 0–16 m/s. For the Yeti they ran about 500 chases on new courses, across start speeds 0–13 m/s and fall
times 0–15 s. They confirmed:
- Chases skied in are bit-identical to the pre-Pass 6 Yeti, falls included (16 of 16).
- Clean slow starts escape Normal: 0 of 64 caught for `straight`, 48 of 48 escaped for `poles`, `skilled`
  and `intermediate`, and 2 of 2 escaped at Standard length.
- There is no step at 11 m/s.
- Stopping before the cave does not pay in outcomes, averaged over fall times.

Two documented bounds were still broader than what had been tested.

**1. A fall during the extended roar was free.** A standstill entry that fell in the first 0.5–1.5 s was
caught 11 of 24 times, against 24 of 24 at 11.1 m/s. The Yeti was still standing.
- **Fix:** the extra roar is cancelled as soon as the skier goes down (`YetiAI.extraDelay`). It is meant for
  a skier getting going.
- **Measured** (`data/r6_falls_band.jsonl.gz`, 672 runs): 8 new courses (2026-06-05, 2027-05-12,
  2027-06-02, 2027-06-19, BERGSCHRUND, SASTRUGI, MOGUL, FONDUE), Fjord and Alpine Normal. Caught out of 16:

| Fall at | 0 m/s | 2 | 4 | 7 | 10.9 | 11.1 | skied in |
|---|---|---|---|---|---|---|---|
| 0.5 s | 12 | 16 | 16 | 16 | 16 | 16 | 6 |
| 1 s | 14 | 16 | 16 | 16 | 16 | 15 | 6 |
| 1.5 s | 16 | 16 | 16 | 16 | 16 | 15 | 5 |
| 3 s | 16 | 16 | 16 | 16 | 13 | 13 | 5 |
| 6 s | 16 | 16 | 15 | 12 | 10 | 10 | 7 |
| 12 s | 12 | 10 | 10 | 7 | 6 | 6 | 3 |
| **all** | **86** | 90 | 89 | 83 | 77 | 75 | 32 |

- **What is guaranteed.** Over all fall times, a standstill is caught at least as often as a start at 7 m/s
  or more. From a fall at 1.5 s on, a standstill is never better off than a faster start.
- **What is not.** A standstill keeps an edge only for a fall within about 1 s of the start, from the lower
  pace cap: 12–14 of 16 caught, against 15–16 of 16. A skier at a standstill hardly ever falls in that
  second, and buying that edge costs a much smaller lead for every later mistake.
- `yeti_escape.test.ts` checks these bounds (falls at 0.5, 1, 3, 6 and 12 s × starts at 0, 4, 7, 10.9 and
  11.1 m/s).

**2. "No input pattern beats holding" was too broad.** What the pole changes guarantee, and test, is about
the button.
- **Guaranteed and tested** (`pole_push.test.ts`): no timing of the pole button beats the best of hold+tuck,
  tuck alone and hold alone by more than 0.3 %. That covers presses after k idle steps (the skate pushing or
  the tuck coasting in the gap) and tap rhythms, on flat, 1°, 9° and 13° slopes × snow, ice and powder × 0,
  3, 7, 10 and 14 m/s × tuck on or off. The reviewers' search found nothing on non-powder surfaces either.
- **Head start.** It now fades from full at a standstill to none at 2.5 m/s. This avoids the latency step
  the reviewers measured at 1.5 m/s (0.11 s to 0.28 s to the first push), and it shrinks the residual they
  found just under the old cut-off.
- **Not a button-timing exploit, and not changed: switching technique by hand.** With tuck and poles held
  together, the game picks skate or poles by their mean push. A player who switches by hand at a better
  speed can do up to about 2 % better over 6 s near the crossover; that is about 0.4 m. The automatic choice
  ignores the tuck's lower drag and a stroke's dead time. This is a small skill margin, not stacking: the two
  never push at once. It is noted in `KNOWN_ISSUES.md`.
- **Pre-existing, not pole-related: popping in rhythm in deep powder.** It beats skiing by 10–15 %, with or
  without poles. This is a powder-drag and airtime issue that predates Pass 6. It is noted in
  `KNOWN_ISSUES.md` for a later pass.
