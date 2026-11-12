# Fjord Coast, Round 4 (release decision): Reviewer B (Physics and Gameplay)

## 1. Header

- **Reviewer:** B, Physics and Gameplay Engineer.
- **Nature of review:** model-based reviewer (same model family as the developers; not external). I am not a human playtester.
- **Build:** `8d19542` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`). HEAD was verified at `8d19542` with no tracked changes under `src/` or `tests/` while I worked.
- **Date:** 2026-11-12.

### Method

- **Code review.** I read the full `aba21bc → 8d19542` diff of:
  - `src/physics/SkierPhysics.ts` (TERRAIN_CONTACT, `isWall`, `wallHit`, `groundFollow`, `sampleNormal`);
  - `capabilities/environment.ts` (CORNICE_STALL) and `fjord/biome.ts` (directional cornice, intensities);
  - `fjord/hazards.ts` (wind gates, squall spells, knock, JUMP_ROCK_INSET);
  - `tests/sim/readerDriver.ts`, `course.ts` and `obstacles.ts`.
- **Headless runs.** All runs were mine, under `scratch/review-b-r4/` (own `vitest.config.ts`), on **fresh seeds** that the developers never used: `B4S*`, `B4D*`, `B4E*`, `B4X*`, `B4C*`, `B4K*`, `B4G*`, `B4J*` and `B4A*`. They ran sequentially. Raw data is in `scratch/review-b-r4/out/`.
  - **Balance:** 548 full-course runs (Sprint 10 seeds, Standard 6, Endurance 4, Expedition 1), plus 60 Sprint runs with the environment off.
  - **Engine A/B:** the aba21bc `SkierPhysics.ts`, copied to `scratch/review-b-r4/oldphys/` with only its import paths changed, against the candidate's, on identical terrain and inputs.
  - **Probes:**
    - 2,880 cave/cliff-wall approaches, in both engines;
    - 2,640 wall approaches followed by recovery attempts, and 1,920 more with obstacles;
    - 990 cornice approaches with 5 recovery policies each;
    - 1,628 legitimate jump cases;
    - 1,296 squall-kicker jumps and 14 gaps.
- **Unit tests.** `npx vitest run tests/unit/terrain_contact.test.ts tests/unit/fjord_gameplay.test.ts` gives 27/27 passing. I did not re-run the full suite, `tsc`, Playwright or any build.
- **Screenshots viewed (candidate, 1920×1080):** `04_signature_hazard`, `04b_hazard_rock`, `04c_hazard_rock_mid`, `07_yeti_cave` and `09_pursuit`.
  - When I started, only `01`–`04c` existed. Shots `05`–`09` appeared during my work (another job was still rendering), and I looked only at the ones listed.
  - I did not see any shot of a skier choosing a side of a wind gate from the player camera, of a stall relocation, or of a skier at a cave-mouth wall.
- **Developer documents** (`REMEDIATION_wind_perf.md`, `DEFECTS.md`, `RECOVERY.md`) were treated as claims only.
- **Missing brief section:** the completion brief file (`8dc283d1-attachment.txt`, 410 lines) ends in the middle of §9 and contains **no §10**. For the gate in §7 of this report I therefore use the completion brief's own §3 release wording ("No infinite vertical launch, invisible friction trap, or unrecoverable position may remain") and this brief's definition of Critical.

---

## 2. Verdict: **FAIL** against the 9/10 target

The developers fixed the three things I asked for in round 3, and I verified each on unseen seeds:

- **The cliff and cave launch is gone in both locations.**
  - Over 2,880 cave-side approaches: 0 runs with more than 3 s of air (the old engine had 344), and a maximum vertical speed of 14 m/s (old engine: 118 m/s).
  - Legitimate jumps are unchanged. In 1,628 kicker, cliff-band, roller and pop cases, 1,615 are bit-identical and 13 differ by 3 mm or less, with no change in any outcome.
- **The cornice no longer traps anyone.** In 1,630 recovery attempts from a stop in the band, 0 were stuck. Skating inland gets out by itself 96 % of the time, and an idle skier is put back after about 3 s.
- **The wind is now a decision.** On Normal Sprint, reading the gates beats ignoring them by 2.4 s, beats choosing wrongly by 4.3 s and beats always taking the lee by 1.9 s, on 10 of 10 fresh seeds. The decision survives on Relaxed.

**What fails the round: the wall fix replaced the launch with a trap.**

- When a skier stops at the foot of a cave mouth's wall, the new rule ("blocked: stay put this step", `SkierPhysics.ts:474–480`) can leave them in a pocket that skating cannot climb out of.
- In some states the skier is **frozen in place with a non-zero velocity**.
- An exhaustive escape search (16 headings, with and without pops, 48 s each) found **no way out** in 3 of the 6 cases I searched: 1 Fjord and 2 Alpine.
- Across every seed I tried, about 2.3–2.7 % of deliberate cave-side approaches end where three reasonable recovery strategies fail. This is true in both locations, and with or without obstacles.
- Every case is at the first cave, before its trigger (`RunState.ts:101`, z ≥ triggerZ). So no Yeti ever comes, no relocation rule covers the spot (in the Fjord the cornice guard is 0 near caves), and the run is soft-locked.
- The old engine got every one of these cases back to the line, either by launching (the round-3 bug) or by climbing.
- This is exactly the "unrecoverable position" that completion-brief §3 says may not remain. It is engine-wide, so it also affects the shipped Alpine.

**Second: the ladder is now right everywhere on Normal, but the step is steep at the edges.**

- On Hard Standard, Alpine wins 4/6 for both my hazard-blind competent driver and my perfect wind reader. The Fjord wins **0/6 and 2/6**.
- On Normal Expedition, the hazard-blind competent driver finishes the Fjord with a 6 m minimum Yeti gap, against Alpine's 45 m.
- That leaves little room for locations rated 3/5 to 5/5. The developers' Hard Standard result (reader 6/6) does not reproduce on my seeds.

## 3. Scores (physics/gameplay point of view)

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | 7 (low confidence) | Only 04, 04b, 04c, 07 and 09 were viewed. The windsock, spindrift and lee drift ripples are a readable telegraph (04b, 04c). The gate outcrops are low, flat dark slabs that read more as a patch than as a rib with two sides. The cave mouth's hexagonal basalt columns look like kit pieces (07). Reviewer A owns this category. |
| Environmental uniqueness | 8.5 | Wind gates (5–8 per Sprint, 21–29 per Standard), gust spells, a tuck-or-brace knock, jump squalls, spines, gaps and the cornice make the Fjord play measurably unlike Alpine. Gaps are still stake-free at racing speed, and the jump crosswind barely moves landings into the rock (defects 4 and 5). |
| Skiing and hazard mechanics | 6.5 | The launch fix, jump identity, cornice recovery and wind gates are all good work, verified independently. But the new wall rule creates a soft-lock and a frozen-velocity state at cave mouths, engine-wide (defect 1, Critical). That caps this category regardless of the rest. |
| Difficulty and fairness | 7 | No inversions on Normal at any length. The Fjord is +2.5 % (reader) to +7 % (blind) on Sprint and about +5 % to +10.5 % on longer lengths, with 0 hazard-caused crashes in 548 runs. Hard Standard and Normal Expedition step too steeply for 2/5 (defect 2). The cave-mouth trap is also a fairness failure. |
| Cinematics | 7 (very low confidence) | Only 07 and 09 viewed. The pursuit framing in 09 is readable, with a clear Yeti distance bar. Reviewer C owns this category. |
| Performance and stability | 7 (low confidence) | Headless simulations cost the same in both locations (Sprint about 0.5–2.5 s per run on a contended CPU), and there were no runaway energies. The only energy gain left is at takeoff, capped by design at +0.45 m/s. The soft-lock is a stability failure. Not GPU-measured. |
| Accessibility and controls | 7.5 (low confidence) | No secret controls are needed at the cornice now, and the 2.4 s telegraph and per-squall captions help. A trapped skier at a cave mouth has no control-based way out at all. A stall at the rim always costs a "crash" (defect 6). |
| Overall player experience | 7 | The Fjord is a fair, distinctive second location whose wind finally asks a question. But any player who explores toward the first cave can soft-lock the run, in Alpine too, and Hard is close to a wall for non-perfect play. |

## 4. Defects

### Defect 1. **Critical: the wall fix creates an unrecoverable trap (and a frozen-velocity state) at cave-mouth walls, in both Alpine and Fjord. This is a regression from PR #6.**

**Evidence (all my scripts, fresh seeds `B4C1`–`B4C6`):**

| Probe | Location | Result |
|---|---|---|
| `walls.test.ts` + `pinsweep.test.ts`: 1,440 cave-side approaches per location per engine (3 lengths, every cave, 3 distances, speeds 8–40 m/s, 0.4–1.4 rad toward the cave side, tucked, 9 s), then recovery attempts | Fjord | 135/1,440 not back within 12 m of the line after 20 s of steering to it. 33 of them failed all three recovery strategies for 45 s each (turn back uphill then to the line; turn away from the wall then to the line; to the line with repeated pops). |
| Same | Alpine | 119/1,440 not back after 20 s; 35 failed all three strategies. |
| Same probe with the old engine | Both | **0** not back (they launched or climbed out). |
| `pinsweep2.log`: seeds B4C2–B4C6 again | Fjord / Alpine | 27/1,200 and 29/1,200 failed all three strategies. Every seed is affected. |
| `pinsweepobs.log`: with the real ObstacleField | Fjord / Alpine | 26/960 and 25/960 failed all three strategies. Obstacles do not change the picture. |
| `pinsearch.test.ts`: exhaustive search, 16 headings × with and without pops × 48 s, on 6 failed cases | Both | **0/32 escapes** for Fjord B4C1 Standard cave 0 (dz0 −140, 40 m/s, 0.4 rad), Alpine B4C1 Standard cave 0 (−60, 28, 0.8) and Alpine B4C1 Endurance cave 0 (−100, 18, 0.4). The other three cases escape only by heading back uphill-diagonal for 8 s (3–7 of 32 tries). |

Where the trapped skiers stop:
- Fjord: −53 to −72 m from the line. Alpine: +40 to +77 m.
- Along the course they are between 3 m before the cave and 14 m after it, every time before the trigger (z-cave +22).
- `RunState.ts:101` fires the encounter only when z ≥ triggerZ, so no Yeti arrives.
- The Fjord cornice stall rescue does not reach them (beyondRim about −56 m, guard 0 in cave zones).
- Nothing else relocates a skier. GameSession has no general stuck rule.

**The frozen state** (`trace.test.ts`, Fjord B4C1 Sprint cave 0, −60 m, 28 m/s, 0.8 rad):
- From t = 2.5 s the skier sits at exactly x −75.94, z 268.08 with a velocity of 0.31 m/s and wobble pinned at 0.40, and stays there forever.
- Every step, `isWall` fires on the try, `wallHit` removes the component into the face, the retry fires again, and the code returns "still against the face: stay put" (`SkierPhysics.ts:474–480`).
- 16 of 1,440 Fjord and 29 of 1,440 Alpine approaches hit this state during a plain steer back to the line.

`pinold.test.ts` compares the engines on 5 trap cases. The old engine gets every one back to the line in 6.8–16.3 s. In one Alpine case it does so with only 1.0 s of air, so the new rule also blocks climbs that were never launches.

**How a player reaches it:** ski about 50 m off the line toward the first cave and come to rest in its mouth. This is the obvious thing to do to look at a cave the game is foreshadowing, and in the Fjord it is also the way to the sea view.

**Brief:** completion brief §3: "No infinite vertical launch, invisible friction trap, or unrecoverable position may remain."

**Fix:**
1. **An engine-wide stall backstop**, like CORNICE_STALL. Trigger it when the skier is grounded, not crashed, slower than about 1 m/s (or has had no net displacement) for more than 4 s, and either touched a wall in the last 2 s or is outside the piste half-width. Then relocate to `routeX(z − 6)` with a "back on the piste" cue, and without a crash event.
2. **In `groundFollow`'s retry,** when the second attempt also meets a face (an inside corner), slide along the tangent shared by both face normals, or let the step go away from the face. Never return a zero displacement with a non-zero velocity.
3. **Shape cave-mouth floors** so they drain toward the piste at no more than the skate limit (about 7°), with no closed pocket.
4. **A unit test:** from a grid of rest points within 40 m of each cave mouth, "skate toward the line" either reaches the line in 20 s or a relocation fires. Add my `pinsweep` approaches as a seeded regression set.

### Defect 2. **Major: the Alpine → Fjord step is too steep on Hard (Standard and Endurance) and for hazard-blind play on long Normal runs**

**Evidence:** `out/bal-*.jsonl`, fresh seeds.

| Length / difficulty | Driver | Alpine | Fjord |
|---|---|---|---|
| Standard Hard (6 seeds) | Reader (perfect wind reading) | 4/6 wins, gap 33.6 m | **2/6**, gap 15.3 m |
| | Cue (windsock-now) | (4/6) | **1/6** |
| | Skilled (hazard-blind) | 4/6 | **0/6** |
| | Intermediate | 2/6 | **0/6** |
| Sprint Hard (10 seeds) | Skilled | 7/10 | **5/10** |
| | Intermediate | 3/10 | **0/10** |
| Endurance Hard (4 seeds) | Skilled | 1/4 | **0/4** |
| Expedition Normal (1 seed) | Skilled | 2,358.6 s, gap 44.8 m | 2,608.4 s (+10.6 %), **minimum gap 6.2 m** |

- The developers report Hard Standard reader **6/6** for Fjord against 5/6 for Alpine, and skilled 3/6 against 6/6 (`REMEDIATION_wind_perf.md`). My reader result does not reproduce theirs.
- Pooling both data sets, the hazard-blind skilled driver wins Hard Standard **3/12 in the Fjord against 10/12 in Alpine**.
- On Normal, everything is a sensible ladder. Paired Fjord − Alpine:

| Length | Reader | Skilled |
|---|---|---|
| Sprint | +3.9 s (+2.5 %) | +10.8 s (+7.0 %) |
| Standard | +22.9 s (+4.9 %) | +49.6 s (+10.5 %) |
| Endurance | +47.6 s (+5.0 %) | +93.1 s (+9.7 %) |

- Normal wins are 100 % for every competent driver at every length except Expedition.
- **Cause:** Hard intensity went from 1.0 to 1.2 (`fjord/biome.ts:226`). Gates now sit on the racing line, so a hazard-blind skier rides over 5–8 rock ribs per Sprint and about 48 per Endurance, and each tucked notch pass in a gust costs 9 % × 1.2 of speed.
- With the environment off, Fjord terrain is at parity with Alpine (paired difference −0.0 s for the reader), so the whole step is the environment.
- **Why it matters:** a 2/5 location in which a skilled, hazard-blind player who wins Hard Standard two times in three in Alpine never wins leaves little room for 3/5–5/5 on Hard.
- **Fix:**
  - Hard intensity 1.0–1.1, or scale intensity down on Standard and longer (for example ×0.85 beyond Sprint).
  - Or cap the per-refuge-leg environmental cost.
- **Test to add:** a pooled ≥ 20-seed assertion that on Hard Standard and Endurance the Fjord skilled-driver win rate is at least about 0.5 × Alpine's and the reader's at least about 0.8 × Alpine's.

### Defect 3. **Minor: Relaxed is barely softer than Normal on longer lengths, and a weak driver does much worse than in Alpine**

- Relaxed reader, Fjord against Alpine:

| Length | Relaxed | Normal |
|---|---|---|
| Sprint | +1.6 % | +2.5 % |
| Standard | +4.1 % | +4.9 % |

- The never-tucking `average` bot on Relaxed Sprint wins Alpine 4/10, Fjord **0/10**, and Fjord with the environment off 2/10.
- The developers report 6/16 against 4/16 for the same comparison. Pooled, that is Fjord 6/26 against Alpine 8/26, so the sample is small and the bot is crude.
- The mechanics are still there on Relaxed: reading the gates is worth 1.37 s per Sprint against ignoring them.
- **Fix:** watch it after tuning defect 2. Consider Relaxed 0.4 on Standard and longer, and a pooled 20-seed check for weak drivers.

### Defect 4. **Minor: the jump-squall landing rock is still barely tied to the gust (round-3 defect 7 not fixed by measurement)**

**Evidence:** `probes.test.ts P=A`, 6 Standard seeds `B4A*` × 6 phases, 432 squall-kicker jumps per difficulty.

| Difficulty | Landed in the landing rock: wind | Calm |
|---|---:|---:|
| Normal | 85 | **78** |
| Hard | 85 | 78 |

- Landing drift on Normal: median 0.46 m, p90 2.3 m. Round 3 was 118 against 90 out of 510.
- Moving `JUMP_ROCK_INSET` from 2.5 to 4 m (`hazards.ts:104`) puts the rock's inner edge only about 1 m onshore of a straight landing, because `x − r = 4 − 0.45 r` with r = 6–7.5. A calm takeoff still lands in it about 18 % of the time.
- **Fix:** an inner edge of at least 2.5 m onshore, using `x = lipX + Δroute + 2.5 + r`. Then assert that calm landings in the rock are below 3 %.

### Defect 5. **Minor: gaps still have no stake at racing speed, and slow drop-ins crash (F-015, open)**

**Evidence:** `gap.test.ts`, 14 gaps on 5 fresh Standard seeds.

| Lip speed | Dropped into the gully | Crashes |
|---|---:|---:|
| ≤ 10 m/s | 25/28 | 5 |
| 12 m/s | 1/14 | 0 |
| ≥ 14 m/s | **0/70** | 0 |

- This is unchanged from round 3. The tracker accepts it for the preview, and I agree it is Minor.

### Defect 6. **Minor: the cornice stall backstop punishes a deliberate stop**

- `CORNICE_STALL = { zone: 18, speed: 1, time: 3 }` (`environment.ts:55`).
- **Evidence:** `cornice.test.ts`. A player who simply stops within 18 m of the crest to look at the view is relocated after about 2.9 s in 293 of 326 idle cases. The relocation goes through `relocate()` → `crash(…, 0.6)` (`SkierPhysics.ts:1004`), which resets the style multiplier and plays the crash feedback.
- In a location whose brief says players should "want to slow down", standing at the edge for 3 s should not count as a crash.
- **Fix:**
  - No crash or multiplier reset for 'stuck in the cornice' relocations;
  - about 6 s when stationary and not moving seaward;
  - or a short "you're bogging down" prompt before the relocation.

### Defect 7. **Minor: the decision a human can actually read is worth little against the safe fixed policy**

- On Normal Sprint, the realistic `cue` policy (windsock now) is +1.42 s behind `read`, against +1.94 s for always taking the lee. So reading the windsock beats "always lee" by only about 0.5 s per Sprint (Relaxed 0.46 s; Standard about 2.6 s per course, from the cue and lee rows in the Standard table).
- The full value (1.9–2.4 s) needs a player who has memorised the 14.9 s cycle and projects it 2–3 s ahead.
- The brief's "best player gains a measurable advantage" is met. The everyday reading decision is thin.
- **Fix:** make the time to the next gust visible at the decision point, for example streamer length or a gust front travelling across the water, or raise the lee cost slightly so that blindly playing safe costs more.

### Defect 8. **Minor (documentation): stale intensity comment**

- `fjord/biome.ts:224` says "Relaxed 0.6"; the value on line 226 is 0.5.
- BIOMES.md now documents the coupling correctly.

### Defect 9. **Minor (evidence): no player-camera shot of a gate decision**

- 04, 04b and 04c are free cameras with no skier on the gate.
- From them I cannot judge whether a player at 25 m/s can tell which side is the notch and which is the lee, or whether the outcrops read as a rib rather than a dark patch.
- **Fix:** add a chase-camera shot about 60 m before a gate, both in a lull and in a gust.

## 5. What works

- **The launch is gone.** Over 2,880 approaches: 0 runs with more than 3 s of air (the old engine had 344), a maximum vertical speed of 14 m/s (old: 118) and a maximum height of 6 m (old: 107 m).
- **Energy stays bounded.** The only steps that gain more than 3 J/kg are takeoffs (106 of them), and they are bounded by the documented takeoff tolerance (at most +0.45 m/s).
- **Walls behave like walls.** 92 "hit the cliff" crashes, graded like boulder contacts.
- **Legitimate jumps are untouched.** The A/B gives 1,615 of 1,628 identical, the rest within 3 mm, and the same 2,068 takeoffs and 54 crashes. No balance run hit a cliff.
- **The cornice is fixed properly.** Heading-dependent resistance means skating inland always works: 313 of 326 got out by themselves, the rest were relocated, and 0 were stuck. The stall rule is a real backstop: idle skiers are relocated after 2.9 s (maximum 12.7 s).
- **Wind gates are a real decision**, measured on 10/10 fresh seeds:

| Normal Sprint | Behind `read` |
|---|---:|
| Ignore | +2.4 s |
| Wrong choice | +4.3 s |
| Always lee | +1.9 s |

  - Standard Normal: ignore +8.4 s.
  - On Hard the spell-length cycle, telegraph, knock and brace give a speed-versus-stability trade.
  - A Sprint has 5–8 gates, a Standard 21–29.
- **Relaxed keeps the mechanic:** ignore +1.37 s and wrong choice +2.72 s per Sprint.
- **The Yeti is not involved.** Yeti speed is still per game difficulty only (`CourseConfig.ts:24–27`), and per encounter it is independent of location.
- **The Normal ladder is sensible at every length** (defect 2 table), and there is no hazard-caused crash in 548 runs (1 "hard landing" from a bot on a jump).

## 6. Status of round-3 defects and tracker items (my own verification)

| Item | Status | My evidence |
|---|---|---|
| r3 #1 / F-002: cornice dead zone | **Fixed** | `cornice.test.ts`: 990 approaches, 326 stopped in the band, × 5 policies; **0 stuck**. Inland skate: 313 out on their own, 11 stall-relocated. Idle: 293 relocated. "Stuck" in my downhill-tuck and flail runs means still in the band but moving, or at rest just outside the zone; skating inland frees all of them. |
| r3 #2 / F-001: cliff/cave wall launch | **Fixed (launch), but regressed into a trap** | Launches are 0/2,880. The trap is defect 1 (Critical). The tracker's "CLAIMED" cannot become "FIXED". |
| r3 #3 / F-018: Relaxed intensity 0.25 | **Fixed** | 0.5. Relaxed Sprint: Fjord slower than Alpine for every competent driver (+1.4 % to +2.4 %), and reading still worth 1.4 s. Hard is now 1.2, see defect 2. |
| r3 #4: thin Sprint ladder on Normal | **Fixed (mean); per seed still noisy** | Reader +2.5 %, skilled +7.0 %, intermediate +5.9 %. Per seed, the Fjord is slower on only 6/10 seeds for the reader (9/10 for skilled): course variance (−10 to +12 s) still exceeds the reader's environment cost (+3.85 s). |
| r3 #5 / F-015: gap stake, slow crashes | **Not fixed** (tracker: open, accepted) | Defect 5. |
| r3 #6: steep Hard Endurance step | **Not fixed; worse at Standard** | Defect 2. |
| r3 #7: jump landing rock barely tied to the gust | **Not fixed** (developers claim fixed) | Calm 78/432 against wind 85/432 (defect 4). |
| r3 #8: stale comment and undocumented coupling | **Partial** | BIOMES.md fixed; the comment is still wrong (defect 8). |
| F-006: squall is a time tax, not a decision | **Fixed** | §5; defect 7 is the residual. |
| F-017: squall caption throttled per kind | Not verified (Reviewer E's area) | — |
| F-020: browser suite | Not re-run (forbidden) | — |

## 7. Public-preview gate (my area)

The attached completion brief has no §10. I use §3's release wording and this brief's Critical definition.

| Gate item | Status | Evidence |
|---|---|---|
| No infinite vertical launch | **Met** | 0/2,880 approaches with more than 3 s of air; maximum vertical speed 14 m/s. |
| No invisible friction trap (cornice) | **Met** | 0 stuck in 1,630 recovery attempts; no secret controls needed. |
| **No unrecoverable position** | **NOT MET** | Defect 1: cave-mouth wall pockets on every seed in both locations, with exhaustive escape search returning 0/32 in 3 cases, all before the trigger. |
| Legitimate jumps, rollers, pops and landings unaffected | **Met** | A/B: 1,628 cases, no outcome change. |
| Wind as a meaningful, readable, deterministic choice | **Met** (the readable margin is thin: defect 7) | §5. |
| Fjord between Alpine and the future 3/5 at every length and difficulty; Relaxed keeps the mechanic; Yeti not faster | **Partial** | Normal: met at every length. Relaxed keeps the mechanic: met. Yeti: met. Hard Standard and Endurance, and Normal Expedition for blind play, step too steeply (defect 2). |
| Hazards fair, no unavoidable punishment | **Met** for the hazards (0 hazard crashes in 548 runs); **not met** overall because of defect 1. | — |

**Gate: NOT MET**, because of defect 1. Fixing it needs only an engine-level stall backstop and a retry slide, plus a regression test. My `scratch/review-b-r4/pinsweep.test.ts` is ready to be adopted as that test.

## Reproduction

Run from `/home/claude/sf-fjord`. Output goes to `scratch/review-b-r4/out/`.

```
C=scratch/review-b-r4/vitest.config.ts
OUT=scratch/review-b-r4/out/bal-sprint.jsonl LENS=sprint SEEDS=B4S01,...,B4S10 DIFFS=relaxed,normal,hard DRIVERS=read,cue,ignore,wrong,lee,skilled,intermediate,average npx vitest run --config $C scratch/review-b-r4/balance.test.ts
#   (standard B4D01–06, endurance B4E01–04, expedition B4X01, ENV=off BIOMES=fjord for the env-off set)
node scratch/review-b-r4/table.mjs scratch/review-b-r4/out/bal-sprint.jsonl
npx vitest run --config $C scratch/review-b-r4/{jumpsab,walls,egain,cornice,pinned,pinsweep,pinsweepobs,pinsearch,pinold,trace,gap}.test.ts --disableConsoleIntercept
P=A NSEEDS=6 npx vitest run --config $C scratch/review-b-r4/probes.test.ts --disableConsoleIntercept
```
