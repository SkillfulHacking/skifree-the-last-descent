# Whiteout Ridge, round 3: Review B (Physics and Gameplay, Difficulty and Fairness)

- **Reviewer:** B. I gate category 3 (Skiing and hazard mechanics) and category 4 (Difficulty and fairness).
- **What I am:** a model reviewer, **not a human playtester**. I did not play in real time. Every judgement about feel comes from code, headless simulation and the committed browser logs. Where this limits a judgement, I say so.
- **Build:** frozen candidate `46ed200` (branch `pass5-whiteout`). I checked that `git diff 46ed200 HEAD -- src tests` is empty, so later commits only add documents.
- **Method:**
  - I read the code and re-ran measurements myself.
  - Scratch work is in `/tmp/revB3/` (probes in `sim/`, results in `*.json` and `*.jsonl`). It includes an archive of the pre-W-065/W-077 tree `526785a` (`/tmp/revB3/old/`) for A/B runs.
  - I ran no Playwright and no browser.
- **Number labels:** **[B]** marks a number I produced. **[dev]** marks a developer number, re-derived unless I say otherwise.

## Verdict: **FAIL** (cat. 3 = 7, cat. 4 = 7; the target is 9). W-076 focused verdict: **PASS**

This round fixed most of what I asked for in round 2:
- The default course is won on Normal.
- Blizzard warnings come in time (in the real game).
- A clipped jump no longer pays.
- Reading the weather pays on held-out seeds.

Two things stop the gate:
- **This round's W-065 terrain change adds a launch crease at the drop-side piste edge (B3-1).** It triples crashes for a skier who strays past the edge and steers back.
- **The Hard setting has two unresolved fairness problems (B3-3, B3-4):**
  - W-077 took Alpine's Hard Standard to 0/12 without measuring it.
  - Whiteout's default course on Hard Sprint is lost by every policy, including a flawless reader.

| # | Category | R2 | R3 | One-line justification |
|---|---|---|---|---|
| 1 | Visual art direction | 7 (lc) | 7 (lc) | Not reviewed. No frames judged. |
| 2 | Environmental uniqueness | 7 (lc) | 7 (lc) | Not reviewed. |
| **3** | **Skiing and hazard mechanics** | **7** | **7** | Gains: drift gaps pay, the storm line pays, clip cost and hop fixed, warnings timely. Against: a new edge crease launches and crashes skiers (B3-1); the blizzard stance pays nothing (B3-5); the caption's push direction is wrong 13% of the time (B3-6); F9 comments unchanged. |
| **4** | **Difficulty and fairness** | **6** | **7** | W-056 fixed and reproduced exactly; Normal ladder sensible; reader +6/−0 on both held-out sets. But Classic Hard Sprint is lost by every policy (B3-4), and W-077 made Hard Standard 0/12 on Alpine too, unmeasured (B3-3). |
| 5 | Cinematics | 7 (lc) | 8 (lc) | Only the hand-off was examined: one canonical start, verified (W-076). |
| 6 | Performance and stability | 7 (lc) | 8 (lc) | About 600 headless runs, all deterministic. Every published row I re-ran reproduces exactly. No soft-locks. |
| 7 | Accessibility and controls | 6 (lc) | 7 (lc) | 100% of blind blizzard knocks get a warning event at least 4.3 s ahead in the game (B3-7). But the caption's push direction is wrong in 13% of cell cycles (B3-6). |
| 8 | Overall player experience | 7 (lc) | 7 (lc) | Normal is fair and reading pays. Hard on the default course is a guaranteed loss. |

## W-076 focused verdict: **PASS**

Question: on this build, does watching or skipping the cave cinematic give a gameplay advantage? Are the presence cues presentation only?

- **One code path.**
  - `CaveCinematic.finish()` (`src/cinematic/CaveCinematic.ts:324-350`) always calls `startCanonicalChase()` (`caveHandoff.ts:54-59`). That puts the Yeti on the spawn point, leaping, with zero speed and the usual `startDelay` (`YetiAI.ts:121-133`).
  - A skip (`GameSession.ts:295-299`) calls `tl.skip()`. That marks the remaining events fired **without running them** (`Timeline.ts:80-84`). The same frame's `tl.done` then runs the same `finishCave()` (`:777-799`).
  - Watched to the end, the timeline reaches `CAVE_LEAP_AT` = 15.8 s (`tl.duration` is forced at `CaveCinematic.ts:240`) and runs the same `finishCave()`.
  - Both paths set `handoffFrame`, so the physics accumulator is zeroed (`GameSession.ts:313-316`).
- **No state accumulates during the cinematic.**
  - Skier physics is frozen: `RunState.simulating` is false in `caveCinematic` (`RunState.ts:71-74`), and `mapInput` passes no input while not controllable (`GameSession.ts:446-452`).
  - The weather and hazard clock is the physics clock: `env.clock = q.t = s.time` (`environment.ts:193`, `SkierPhysics.ts:427`). So the front's state is the same whether the cinematic lasted 1 s or 15.8 s.
  - The cinematic's own code touches no physics or AI state except at `finish()`. A grep for `st.phys`, `st.yetiAI` and `st.run` in `CaveCinematic.ts`, `stormCave.ts` and `seaCaveCinematic.ts` finds only `yetiManual` and the final `startCanonicalChase`.
  - The Whiteout squall is a `weatherOverride`, presentation only (`World.ts:424-435, 584-600`). Its hand-back always starts from the squall level at `CAVE_LEAP_AT` (`stormCave.ts:225-232`), watched or skipped.
  - The skip-only extras are camera trauma (`consumeTrauma(100)`) and a music mode. Both are presentation.
- **Presence cues are presentation only.**
  - `ChasePresence` (`yeti/presence.ts`) only reads the gap.
  - Its outputs go to `audio.playYetiGrowl`, a caption on the Yeti line (written only when that line is empty, `GameSession.ts:1278-1282`) and `Hud.yetiClosing` (`Hud.ts:390`).
  - Nothing in `simulate.ts`, `YetiAI` or physics references it (grep).
  - It is re-created in `finishCave()` for both paths (`:788`).
- **Real-path evidence:** `round-3/candidate/e2e/cave_skip.txt`, 6/6 on a dist built from `46ed200`.
  - The spec (`tests/e2e/cave_skip.spec.ts:186-217`) compares skier position, speed and velocity, and Yeti position, velocity, speed, airborne, delay and heading.
  - The comparison is at the hand-off frame **and 2 s into the chase**, tolerance 1e-3, against the watched run.
  - Skips covered: Escape at 1 s, Start at 9 s, during the swing, and just before the leap.
  - Configurations covered: Alpine, Fjord and Whiteout; Normal and Hard; slow arrival; Reduce Camera Motion.
- **Unit tests:** I re-ran `tests/unit/cave_handoff.test.ts` and `presence.test.ts` (54/54 across five files). They pass.
- **Caveat on the evidence:** the model-level checks are tautological for the shipped path.
  - The `GAME` hand-off in `cave_handoff.test.ts` ignores `leftAt`, and so does the canonical branch of `skipHandoff.measure.test.ts`.
  - They prove the contract of `startCanonicalChase`, not the game path.
  - The game path is proven by the e2e test and the code reading above. That is enough for PASS.
- **Residue (not a watch/skip asymmetry):**
  - `startChase` and `standDown` do not reset `lungeCooldown` or `lungeTimer` (`YetiAI.ts:111-133`). An Endless encounter can begin with up to 3.2 s of lunge cooldown left over from the previous chase. It is deterministic and identical watched or skipped.
  - The "carries no state over" test (`cave_handoff.test.ts:115-133`) does not check these two fields. See B3-9.

## Round 2 → round 3 (my round-2 findings)

| R2 | Status | Evidence on `46ed200` |
|---|---|---|
| N1 blizzard alerts consumed 150–233 m out | **Fixed (W-058)** | Phase recorded only in alert range (`environment.ts:366-374`). **[B]** 43 blind knocks, Normal Sprint, W3H+W2H, with game-like hazard streaming: **43/43 warned ≥ 3 s ahead (min 4.28 s, median 6.1 s)**, none unwarned. Without streaming the sim shows 79% (34/43), which is a measurement artefact (B3-7). |
| N2 Classic Sprint lost / Normal Standard cliff | **Fixed on Normal (W-056)** | **[B]** re-ran `CLASSIC` ×{sprint, standard} ×{normal, hard} ×{blind, reader, driftsOnly}: all 12 rows identical to `at_404ed88/classic.jsonl`. Sprint Normal: reader 44.5 m, blind 40.7 m. Standard Normal: reader 50.6 m, blind caught. Held-out Normal Standard reader 12/12 and 10/12 [dev, re-tabulated]. **Hard: not fixed** (B3-4). |
| N3 two weather costs without a paying mitigation | **Partly fixed** | Paired against blind, W3H Normal Sprint **[B]**: drifts +5/−0 (4.9 s); storm line (`linesOnly`) **+4/−0**; lee alone +1/−0 (3.5 s faster when both win); **blizzard stance +0/−0 (0.0 s)** (B3-5). The caption no longer sends players to the lee (W-057, `GameSession.ts:1251-1255`): verified. |
| N4 clipped jump cheaper than ploughing | **Fixed (W-060)** | `clipKeep` 0.6 (`hazards.ts:45`). Full runs: `hopTimed` +0/−1 and +0/−2 against blind, `hopSpam` +0/−2 and +0/−3 (Normal Sprint, W3H and W2H, `at_404ed88`). A clip is captioned. |
| N5 opposite-side gaps | Accepted (W-061) | Agreed: non-blocking. The reader still wins 24/24 on both Sprint sets. |
| N6 skier inside the mound, flags untaught | Partly (W-062) | Teaching is in the front caption. The visual sink remains (not checked in frames). |
| N7 comments/documents | **Not fixed** | `hazards.ts:12` ("more on exposed ground") and `:13` ("It never knocks or crashes by itself") are still false. `environment.ts:241` ("upright skier") is still there. New document errors: B3-9. |

## Findings

### B3-1 (Major, cat. 3, new this round): the W-065 roll-down puts a launch crease on the drop-side piste edge

**What changed:**
- With `ridge.rollDown`, the valley cross-section holds its edge value past the piste edge on the drop side (`course.ts:343-344`).
- The bank then falls 2 m to the rim (`course.ts:290`).
- Before, the ground kept rising past the edge (`0.0016·w·|d|` plus a 1.5 m lip): a catching berm.
- Now the piste's own cross-section rises to the edge (slope `0.0032·w`, about 0.14) and then turns flat and downhill. **That is a convex break exactly at the edge.**

**What stays the same:**
- **[B] Piste and racing-line heights are bit-identical** (6 courses, every 10 m, 81 points across the piste: maximum difference 0).
- So the racing line itself is untouched, as claimed.

**Lateral slope break across the drop edge [B]** (`/tmp/revB3/terr.py`, inside slope minus outside slope, 6 courses):

| Build | Median | 90th percentile | Maximum |
|---|---|---|---|
| Old | 0.068 (3.9°) | 0.168 (9.5°) | 0.335 |
| New | **0.245 (13.8°)** | 0.393 (21.4°) | 0.603 |

**Edge probe [B]** (`/tmp/revB3/sim/edgeprobe.tmpl`, old tree `526785a` against `46ed200`):
- Setup: 1,422 cases. The skier starts 2 m inside the drop edge at 18 m/s, tucked, heading 8°, 15° or 25° toward the drop, then steers back after 0.4 s or 0.8 s.
- Positions: Classic Sprint, W3H-06 Standard and W3H-01 Sprint, every 60 m.
- No obstacles: terrain and hazards only.

| How far past the edge the skier got | Cases | Crashed, old | Crashed, new |
|---|---|---|---|
| never past it | 311 | 5 | 5 |
| 0–1 m | 195 | 3 | **28** |
| 1–3 m | 338 | 37 | **105** |
| 3–6 m | 301 | 45 | **164** |
| 6–10 m | 175 | 32 | **104** |
| ≥ 10 m | 102 | 32 | **75** |
| **total** | 1,422 | **154 (10.8%)** | **481 (33.8%)** |

- Almost all crashes are "sideways landing", 2–6 m back **on** the piste. Relocations over the cornice: 2 old, 6 new.
- **Trace, Classic z 1000, 8°, 0.4 s:**
  - The skier gets only 0.24 m past the edge.
  - On the way back he takes off at the edge (b = −0.03 m) and is airborne for 0.87 s. The held steer spins him, and he lands 140° off his track: crash.
  - On the old terrain the same input stays grounded and carves back.
  - With half steer he gets **two unexpected hops** (out and back) and lands 40° off line, scored as a trick.

**Why the simulations miss it:**
- **[B]** Across 96 balance runs (W3H Normal Sprint: blind, reader, driftsOnly, hopSpam), the driver never comes within 5 m of the drop edge (closest −5.7 m).
- So W-056 cannot see this crease. A human who strays, is gusted toward the drop, or skis over to look at the newly visible drop (the very thing W-065 invites) will meet it.

**Player impact:**
- A short excursion that used to be harmless now crashes 1 time in 7 (0–1 m) and 1 time in 2 (3–6 m).
- In a chase, a crash is often a catch.

**Fix:**
- Make the edge C¹ (no slope discontinuity).
  - Continue the piste's cross-section tangent for the first 3–5 m past the edge: `cross = 0.0016·w·(2|d| − w)` for `e < e0`.
  - Then start the roll-down from that slope, e.g. `lip = −rollDown·smoothstep(e0, rim, e)` blended from the tangent.
  - Or roll down over the full rim distance with a quadratic that starts at the edge's slope.
- Regression tests:
  - The lateral slope break across the drop edge is no larger than the old bank's (median ≤ 0.07, maximum ≤ 0.34).
  - Port the edge probe: a skier re-entering from the bank at ≤ 20 m/s stays grounded, and the crash count is ≤ the old terrain's.
- Re-check that the racing line stays bit-identical.

### B3-2 (Minor, engineering): W-065 also re-rolls the on-piste obstacle layout; the stated cause of the two outcome flips is wrong

**Mechanism:**
- `obstacles.ts:266` makes **one rng stream per 256 m band**.
- Off-piste tree candidates are thinned by terrain steepness (`:353-358`), and only accepted trees draw further numbers.
- So when the off-piste terrain changes, acceptance changes, and every later draw in the band shifts, including on-piste obstacles. The code comment at `:301` ("per-row seed") does not match the code.

**On-piste obstacles changed by W-065 [B]** (`/tmp/revB3/sim/obs.tmpl`):

| Course | Removed / added | Total on piste |
|---|---|---|
| Classic Sprint | 14 / 18 | 338 |
| Classic Standard | 64 / 69 | 1,034 |
| W3H-06 Standard | 105 / 113 | 933 |
| W3H-11 Standard | 139 / 122 | 1,174 |
| W3H-01 Sprint | 13 / 15 | 279 |
| W2H-05 Sprint | 0 / 0 | 293 |

**The commit message (`6182a6f`) is wrong:**
- It says the two `driftsOnly` Standard runs that are now caught "leave the piste on the drop side".
- **[B]** Traced: W3H-06 hits a tree and W3H-11 hits a boulder. The skier is at least 6.6 m and 28.8 m **inside** the drop edge for the whole run.
- They are layout changes, not drop-side excursions.
- "829 of 833 rows identical" is also off. **[B]** I count 824/833 identical in outcome, time and minimum gap. Two flip, and Hard reader W3H-02 is caught at 429 s instead of 172 s.

**Player impact:**
- None directly: it is another random layout, and the reader's results hold.
- But any off-piste art or terrain tweak silently re-rolls the piste and invalidates seeded tests and balance baselines.

**Fix:**
- Draw a fixed number of rng values per cell whether or not the candidate is accepted, or seed each cell by hash.
- Add a test: changing terrain only beyond the piste edge leaves on-piste obstacles identical.

### B3-3 (Major, cat. 4, cross-location): W-077's effect on Hard was not measured; Alpine Hard Standard is now 0/12

**The judgement asked for:**
- **Graded risk on Normal:** yes. Alpine Normal Sprint is now graded like Fjord.
  - competent 3/7 caught; one early crash 4/7; poor line 7/7; clean 0/7.
  - Standard crash minimum gap 22 m, all recover. [dev, re-tabulated with `tools/tension_summary.py`]
- **Rubber-banding:** none added. The pace is a fixed factor applied when the encounter is created (`profile.ts:386, 717-719`) and does not depend on the gap. The pre-existing distance-based catch-up (`YetiAI.ts:237`) is untouched.
- **Fjord and Whiteout unaffected:** verified.
  - `encounterPace: 1` is pinned in both (`fjord/biome.ts:188`, `whiteout/biome.ts:115`).
  - **[B]** 0 of 448 Fjord and Whiteout tension rows differ between `baseline.jsonl` and `after_404ed88.jsonl`; 215/224 Alpine rows do.
  - Only the debug test biome inherits Alpine's 1.10.

**What was not checked: Hard.**

**[B] Full Alpine courses, skilled autopilot, W3H-01…12** (same harness, old tree `526785a` against `46ed200`, `/tmp/revB3/ladder_*.jsonl`):

| Alpine Hard | before W-077 | after |
|---|---|---|
| Sprint | 9/12 | **6/12** |
| Standard | 3/12 | **0/12** |

- **Hard Standard full runs now [B]:** Alpine 0/12, Fjord 1/12, Whiteout reader 0/12. No location's Hard Standard can be won by the measured skilled driver.
- First chase [dev], Alpine Hard: skilled caught 0/7 → 1/7 at both lengths; Standard crash 0/7 → 6/7, late crash 1/7 → 5/7; slow arrival 0/7 → 2/7.
- **"Slow-start rules unchanged" is true of the code, not the effect.** The slow-start cap is `(v0 + 3 + 1.1 t) × speedMul` (`YetiAI.ts:243`), so on Alpine it is 10% less generous.

**Smallest effective option: not shown.**
- The README rejects ×1.05 because Standard late crash stays at 51 m. ×1.10 also fails that test (46 m: the README's own "remaining gap").
- Meanwhile ×1.05 (B1) gives the same Normal Sprint early-crash grading (4/7), with Hard skilled 0/7 on both lengths and Hard Standard crash 2/7 instead of 6/7.
- So 1.10 was chosen on a criterion it does not meet, and its Hard cost was not weighed.

**Player impact:** Alpine, the entry location, lost its only winnable Hard Standard seeds for a skilled driver. A Hard-mode player can no longer be expected to finish a Standard run anywhere (driver result; humans may do better).

**Fix (pick one, then record the owner's acceptance):**
1. Apply `encounterPace` on Relaxed and Normal only.
2. Cap the Alpine Hard product (`e.speedMul × 1.07`) near its old value (about 1.07–1.12).
3. Re-measure B1 (1.05) and B2 (1.10) on full-course Hard Sprint and Standard (12+ held-out seeds) and add those rows to `balance/w077/README.md`.

Whichever is chosen, add the full-course Hard ladder to the W-077 evidence.

### B3-4 (Major, cat. 4): the default course on Hard Sprint is lost by every policy, including a flawless reader

**[B] Reproduced exactly on `46ed200`.** `CLASSIC-SPR@WHITE`, Hard:

| Policy | Caught at (course time) |
|---|---|
| blind | 76.1 s |
| reader | 77.3 s |
| driftsOnly | 82.7 s |

- `at_404ed88/classic.jsonl` adds `informed2` (81.9 s) and `blizzOnly` (82.7 s): all caught, all about 1,050–1,200 m into the course.
- **The reader has 0 snowball hits, 0 knocks and 0 crashes.**
  - Its gap falls 77.6 → 56.5 → 23.6 m at 10, 20 and 30 s into the chase.
  - Its mean speed is 15.1 m/s, against the Hard Yeti's 16.5 × 1.07 = 17.7 m/s.
- Nothing in the reader's repertoire can win it.
- Alpine and Fjord Classic Hard Sprint are escaped by the skilled driver (25.8 m and 16.5 m) [dev tension rows].
- On held-out seeds the Whiteout reader wins Hard Sprint 9/24 (W3H and W2H) [dev]. **[B]** With game-like hazard streaming, 10/24 on W3H. So Hard is winnable elsewhere; it is the default course that is closed.

**Player impact:**
- The first Hard run most players try in Whiteout cannot be won by skill (within the model's repertoire: I cannot rule out a better human line).
- A loss that no decision can change is the same fairness failure W-056 fixed for Normal.

**Fix:** a general, pace-neutral rule, in the spirit of W-056.
- Hard's extra danger should come from snowballs and from decisions that can be read. It should not come from a Yeti pace that a storm-slowed skier on the right line cannot hold.
- Examples:
  - Make the headwind lower for a skier on the storm line or standing up in a front, on all difficulties.
  - Or lengthen the fair opening on Hard.
- **Target:**
  - Classic Hard Sprint won by the reader (with dodging) with a gap ≥ 5 m.
  - Held-out Hard Sprint reader ≥ 9/24, blind ≤ 3/24.
  - Normal rows unchanged.
- If the owner prefers Hard to stay like this, record it as an accepted known issue.

### B3-5 (Minor, cat. 3): the blizzard stance is now worth nothing in outcomes, and tracker W-059 is out of date

**[B]** Paired against blind on `at_404ed88`:

| Set | blizzOnly wins vs blind | Time when both win | Knocks |
|---|---|---|---|
| Normal Sprint (W3H, W2H) | +0/−0, +0/−0 | −0.0 s | fall about 4× |
| Normal Standard (W3H, W2H) | +0/−1, +0/−1 | −0.6 s | fall about 4× |

- Hard (W3H, **[B]** with streaming): +0/−0.
- Tracker W-059's "+1/+3 wins alone" dates from before the W-056 rule moved the cells off the rows.
- The caption still says "stand up out of the tuck" (`GameSession.ts:872`). That is not a losing move like the round-2 lee, but it is not a winning one: it is comfort (fewer staggers).
- **Value of reading the weather today [B]** (W3H Normal Sprint, paired against blind):

  | Decision | Wins vs blind | Time when both win |
  |---|---|---|
  | drifts | +5/−0 | 4.9 s |
  | storm line | +4/−0 | |
  | lee alone | +1/−0 | 3.5 s |
  | stance | +0/−0 | |
  | full reader | +6/−0 | 5.5 s |

- The lee added to the reader is still slightly negative over all sets (W-055: −1, −1, −3, +1, +1, −3).

**Fix:** make the knock cost more than standing up (round-2 N3 direction: a cheaper upright drag while the cell blows, or a knock that keeps less than 0.58 of speed). Otherwise, restate W-059 honestly: the stance is a safety and comfort choice with no measured win effect.

### B3-6 (Minor, cat. 3/7): the caption's push direction can be wrong

- In a front (front strength above 0.3), a cell pushes the front's way at the moment of the effect (`blizzardPushDir`, `hazards.ts:225-236`).
- The caption computes the direction once, at the telegraph or first-active event time (`GameSession.ts:869-872`).
- **[B]** Over all 727 cell cycles on W3H-01…24 Sprint, in **97 (13%)** the push during the active phase differs, at some moment, from the direction at the telegraph (`/tmp/revB3/sim/pushdir.measure.test.ts`).

**Player impact:** "it pushes you left", then a push to the right.

**Fix:** latch the cell's push direction at telegraph start (physics and caption then agree by construction), or caption the active-phase direction, which is deterministic and can be forecast.

### B3-7 (Minor, measurement): the headless sim does not stream hazard bands ahead

- `simulate.ts:120-124` streams obstacles but never calls `environment.stream(z)`.
- So hazard bands are generated only at `q.z ± 1` (`environment.ts:329`), whereas the game ensures `z + 400` m and views out to 1,100 m (`World.ts:186-199`).
- Consequence: rows and cells in the next 256 m band are invisible to the driver, and untracked by the alert logic, until the skier crosses into that band.

**[B] Measured with a one-line wrapper that calls `env.stream(z)` each step:**
- Outcomes barely move: W3H Sprint Normal is identical (reader 24/24, blind 18/24, driftsOnly 23/24); Hard reader 10/24 against 9/24. The published balance conclusions stand.
- Warning leads change a lot: 79% → **100%** of blind knocks warned ≥ 3 s ahead.
- So W-058 meets my round-2 bar in the game, and part of my own round-2 N1 count was this artefact.

**Fix:** call `env?.stream(s.pos.z)` in `simulateCourse` when `streaming` is set.

### B3-8 (Minor, cat. 4): the W-056 cell rule thins the blizzards by about 30%, and the README does not say so

- When no clear spot exists, a cell is dropped (`hazards.ts:303-310`, `if (best === null) return out`).
- **[B]** Blind, Normal Sprint, 48 runs (W2H + W3H), round 3 before the rule against `at_404ed88`:

  | Measure | Before the rule | After |
  |---|---|---|
  | cells met per run | 3.10 | 2.25 |
  | time under a blizzard | 20.7 s | 14.6 s |
  | knocks per run | 1.44 | 1.06 |
  | blind wins | 29/48 | 36/48 |

- The fronts are untouched, so "the storm still blows" is true. But a weather hazard is about 30% rarer.
- The owner asked for no wholesale weakening of the weather. This is a side effect, not a decision.

**Fix:** state it in `balance/w056/README.md`, or move a blocked cell to the next band instead of dropping it, and re-measure.

### B3-9 (Minor, documentation and test gaps)

- **Wrong claims:**
  - "829 of 833 rows identical" (it is 824).
  - The two flips "leave the piste on the drop side" (they do not; see B3-2).
  - W-077 README: Whiteout balance rows "are identical" (9 differ through B3-2).
  - W-059 "+1/+3 wins" (stale; see B3-5).
- **F9 comments still false after three rounds:** `hazards.ts:12-13`, `environment.ts:241`.
- **`seaCaveCinematic.ts:266`** says the cinematic ends at 14.6 s; `CAVE_LEAP_AT` is 15.8 s.
- **`cave_handoff.test.ts`** "carries no state over" omits `lungeCooldown` and `lungeTimer`, which `startChase` does not reset.
- **`obstacles.ts:301`** "per-row seed" contradicts the per-band rng at `:266`.

## What I verified and how

**Code read:**
- `git diff b70a793 46ed200 -- src`, in particular:
  - `whiteout/hazards.ts` (W-056 rules, push direction, clip)
  - `course.ts` (W-065)
  - `profile.ts`, `biome.ts`, `fjord/biome.ts`, `whiteout/biome.ts` (W-077)
  - `environment.ts` (W-058)
  - `hazards/field.ts`, `hazard.ts`
- The W-076 path: `caveHandoff.ts`, `CaveCinematic.ts`, `Timeline.ts`, `GameSession.ts`, `RunState.ts`, `YetiAI.ts`, `presence.ts`, `stormCave.ts`, `World.ts`, `Hud.ts`.

**Unit tests:** `npx vitest run` on `cave_handoff`, `presence`, `w056_weather_rules`, `whiteout_ridge` and `whiteout_r2`: **54/54 pass**.

**Reproductions, exact:**

| Rows re-run | Source | Mismatches |
|---|---|---|
| CLASSIC 12 rows | `classic.jsonl` | 0 |
| W3H Normal Sprint, 96 rows (blind, reader, driftsOnly, hopSpam) | `at_404ed88/w3h_sprint.jsonl` | 0 |
| W3H-06 and W3H-11 driftsOnly Standard | outcomes and times | 0 |

**My runs [B]** (all in `/tmp/revB3/`):
- `terr_*.json`: terrain cross-sections, old against new.
- `obs_*.json`: on-piste obstacles, old against new.
- `ep_*.json`: edge probe, 1,422 cases × 2 trees.
- `tr_*.txt`: traces.
- `edge_w3h.jsonl`: drop-edge distance in 96 balance runs.
- `ladder_af.jsonl`, `ladder_alpine_old.jsonl`: Alpine and Fjord full-course ladder, Normal and Hard; Alpine Hard before W-077.
- `lines.jsonl`: `linesOnly` and `leeOnly`, W3H Sprint.
- `w3h_stream.jsonl`: balance with game-like hazard streaming, Normal and Hard, 4 policies.
- `leads*.json`: blizzard warning leads, with and without streaming.
- `pushdir.json`: push direction at telegraph against the active phase.
- Re-tabulated the developer jsonl for W-056 (pairings, cell counts) and W-077 (`tools/tension_summary.py`, baseline-vs-after diff per location).

**Not verified:**
- Anything visual: the drift-mound sink, cloud deck, spires.
- Real-time feel.
- GPU.
- Whether a human finds lines the driver does not (B3-4).

## What would raise my scores to 9

**Category 3:**
- B3-1 fixed with the regression tests described.
- B3-5: the stance pays (at least +2 net wins or at least 2 s on both held-out Normal Sprint sets, no net loss), or the tracker and README state that it does not.
- B3-6 fixed.
- F9 comments corrected.

**Category 4:**
- B3-4: Classic Hard Sprint won by the reader with a gap ≥ 5 m, or explicitly accepted by the owner as a known issue.
- B3-3: a measured full-course Hard ladder for the chosen Alpine pace, with an explicit owner decision on Hard Standard being 0/12 across locations.
- B3-8 stated or corrected.
- B3-7 fixed in `simulate.ts`, so warning-lead gates measure the game.
