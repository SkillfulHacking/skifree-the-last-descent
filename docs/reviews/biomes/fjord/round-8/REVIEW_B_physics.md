# Fjord Coast, Round 8: Reviewer B (Physics and Gameplay)

## 1. Header

- **Reviewer:** B, Physics and Gameplay.
- **Nature of review:** model-based reviewer (same model family as the developers; not external). I am not a human playtester.
- **Build:** `d1f642b` (branch `pass4-fjord`). HEAD was confirmed at `d1f642b` before and after the runs.
- **Date:** 2026-11-13.
- **Previous review:** round 4 (`round-4/REVIEW_B_physics.md`, build `8d19542`).

### Method

- **Code review** of the full `8d19542 → d1f642b` diff of `src/physics/SkierPhysics.ts`, `src/world/capabilities/{environment,index}.ts`, `src/world/biomes/fjord/biome.ts`, `src/game/GameSession.ts`, `src/world/course.ts` and `src/world/coast.ts`, plus `tests/unit/pin_rescue.test.ts` and `fjord_gameplay.test.ts`. I also confirmed that the Fjord hazards code (`fjord/hazards.ts`, `world/hazards/*`), the Yeti, `CourseConfig`, `simulate.ts` and `RunState.ts` have **no** changes since round 4.
- **Headless runs.** All of these were mine, under `scratch/review-b-r8/` (own `vitest.config.ts`), run one at a time, on **fresh seeds** (`B8C*`, `B8D*`, `B8E*`, `B8J*`, `B8K*`, `B8S*`, `B8T*`, `B8X*`, `B8N*`, `B8A*`, `B8F*`) plus my round-4 trap seeds `B4C1`–`B4C3`. Raw output is in `scratch/review-b-r8/out/`.
  - **Cave-mouth pin sweep** (`pin8.test.ts`): 1,920 approaches on fresh seeds, 1,440 on the round-4 trap seeds and 960 with the real `ObstacleField`. Each approach is followed by a route-steer, four escape policies (up to 90 s) and an idle check.
  - **Wall/launch sweep** (`walls.test.ts`): 1,440 approaches with an energy audit.
  - **Jump A/B** (`jumpsab.test.ts`): 1,651 kicker, cliff-band, roller and pop cases. The round-4 engine (`8d19542`, copied to `r4phys/`) is compared with the candidate on identical terrain and inputs.
  - **Cornice** (`cornice.test.ts`): 792 approaches × 5 recovery policies.
  - **False-positive probe** (`fp8.test.ts`): 2,345 rest-point cases in both locations.
  - **Cave-boulder probe** (`boulders8.test.ts`): the real `Cave` and `dressSeaCave` built headless, with 192 approaches.
  - **Balance** (`balance.test.ts`, `table.mjs`): 360 Sprint, 84 extra Normal Sprint, 144 Standard, 40 Endurance, 18 Relaxed Endurance, 4 Expedition and 12 Endless (900 s) runs.
  - **Squall-kicker probe** (`probes.test.ts P=A`): 1,530 jumps.
- **Unit tests:** `npx vitest run tests/unit/pin_rescue.test.ts tests/unit/terrain_contact.test.ts tests/unit/fjord_gameplay.test.ts` gives **31/31 passing**. I did not run the full suite, `tsc`, Playwright or any build.
- **Browser tests:** `round-8/TESTS.md` had **not appeared** when I finished, so I have not seen any browser test result on this candidate.
- **Screenshots viewed (1920×1080):** `09_pursuit`, `12_wind_gate_gust`, `12b_wind_gate_lull` and `15_cornice_relocation`.
- **Developer documents** (`round-8/DEFECTS.md`, F-021…F-042) were treated as claims only.

---

## 2. Verdict: **FAIL** against the 9/10 target (my categories: 8 and 7.5)

**The round-4 Critical is fixed, and I verified it myself.** `SkierPhysics.pinWatchdog` (`SkierPhysics.ts:1012–1034`) and the zero-velocity stop in the wall retry (`:494`) remove both the cave-mouth soft-lock and the frozen-with-velocity state:

| Probe | Approaches | Unrecovered | Frozen | Still off the line after 20 s |
|---|---:|---:|---:|---:|
| Fresh seeds, both locations | 1,920 | 0 | 0 | 0 |
| My round-4 trap seeds (where the exhaustive search found no escape) | 1,440 | 0 | 0 | 0 |
| With the real ObstacleField | 960 | 0 | 0 | 2 (both recovered later) |

- **The launch is still gone:** 0 of 1,440 approaches had more than 3 s of air, the maximum vertical speed was 14.0 m/s and the maximum height above ground 6.3 m.
- **Legitimate jumps are bit-identical** to round 4: 1,651 of 1,651 cases, the same 2,087 jumps and the same 50 crashes.
- **Hard and long courses are fixed.** On Hard Standard, Alpine's wins against the Fjord's are now 4/6 against 5/6 for the reader, and 5/6 against 4/6 for hazard-blind skilled play. In round 4 the Fjord won 2/6 and 0/6. On Normal Expedition the skilled driver's minimum gap is 37 m (Alpine 43 m); round 4 was 6 m.

**The build still misses 9/10 on four counts:**

1. **The new rescue fires on a player who did nothing wrong.** Its "stranded" branch relocates the player, as a crash, after 4 s of continuously held steer or tuck that makes less than 3 m of progress more than 10 m off the line. A player standing on open snow or at a viewpoint who holds a direction to turn and look around is teleported with "WIPEOUT" and the caption "boxed in against the rock" (defect 1).
2. **On Normal Sprint the Fjord is not measurably harder than Alpine for a good player.** Over 23 paired seeds the reader is +1.1 s with a standard error of 1.7 s, and the Fjord is faster on 10 of 23 seeds (defect 2, F-039).
3. **The new scanned boulders at the sea-cave mouth do not collide.** Visible rocks 1–2 m high stand on skiable snow, and skiers pass straight through them (defect 3).
4. **Three round-4 minors persist:** the jump landing rock is still weakly tied to the gust, Hard Endurance is still steep, and a relocation still counts as a crash.

## 3. Scores (physics/gameplay point of view)

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | 7.5 (low confidence) | Only 09, 12, 12b and 15 were viewed. The windsock (limp in the lull, flying in the gust), the funnelled spindrift and the lee ripples read clearly (12/12b). The gate rib is still two low dark slabs, and 12/12b are high free-camera views, not the player's camera. Reviewer A owns this category. |
| Environmental uniqueness | 8.5 | The Fjord plays measurably differently: 5–8 wind gates per Sprint and about 37–49 per Endurance, gust spells, the knock and brace, jump squalls, spines and gaps, and the cornice. Reading the wind is worth 2.0 s per Normal Sprint and 8.8 s per Normal Standard. |
| Skiing and hazard mechanics | 8 | The Critical is fixed with no regressions (0 unrecovered, 0 launches, jumps bit-identical, cornice 0 stuck). Against that: the rescue's false positives on open snow (defect 1, Major), ghost boulders at every Fjord cave mouth (defect 3, Major), and the landing rock still only weakly tied to the gust (defect 5). |
| Difficulty and fairness | 7.5 | Hard Standard, Normal Endurance and Expedition are now sensible. On Normal Sprint, the default length and difficulty, a good player finds the Fjord no harder than Alpine (defect 2, Major). Hard Endurance is still steep on a small sample, and Relaxed is hard for weak play (defect 4). |
| Cinematics | 7 (very low confidence) | I did not review the cinematic shots. Reviewer C owns this category. |
| Performance and stability | 8 (low confidence) | No soft-lock, no frozen state and no runaway energy. The only steps that gain more than 3 J/kg are takeoffs, at most 14 J/kg (about +0.47 m/s at 30 m/s), as in round 4. Endless streamed 900 s in 12 of 12 headless runs. Not GPU-measured. |
| Accessibility and controls | 7.5 (low confidence) | No secret controls are needed anywhere: the cornice is escaped by skating inland, and a pinned skier is rescued. But holding a direction for more than 4 s while stopped counts as being stuck and crashes the player (defect 1). An idle stop at the cornice edge is still a crash (defect 6). |
| Overall player experience | 8 | The Fjord is a fair, distinctive second location with a real wind decision and no traps left. On the default course a strong player will not feel it harder than Alpine, and a few rules punish innocent behaviour. |

## 4. Defects

### Defect 1. **Major: the pin rescue's "stranded" branch teleports and crashes a player who is just standing and turning on open snow**

- **Code:** `SkierPhysics.ts:1014`. Any held `|steer| > 0.5` or `tuck > 0.5` counts as "pushing". Line 1027 then fires the rescue when the player has pushed for more than 4 s, is more than 10 m from the line and has moved less than 3 m. No wall contact is needed.
- **What happens on rescue:** `relocate()` → `crash(reason, 0.6)` (`:1052`). `GameSession` then plays the crash audio and shake, resets the multiplier, adds a "Major crash" to the results, and shows *"You were boxed in against the rock."*
- **Evidence** (`fp8.test.ts`, seeds B8F1–3, Sprint and Standard): a skier at rest is relocated in these cases.

| Situation | Location | Relocated |
|---|---|---:|
| Holds steer to pivot on the spot for 8 s, open snow under 30° | Fjord | **382/508** |
| Same | Alpine | **351/513** |
| Holds brake and steer, open snow | Fjord | 503/508 |
| Same | Alpine | 513/513 |
| Pivots at a Fjord **viewpoint** (a place the game invites you to stop) | Fjord | **24/26** |
| Idle | Both | 0 (apart from Fjord cornice-band points, defect 6) |
| Steer 3 s, release 0.3 s, repeat | Both | 0 |

- A held direction at 1.9 rad/s is a little over one full turn in 4 s. A gamepad stick resting sideways is enough.
- **Fix:**
  1. Make "stranded" require tuck/skate intent only, not steer, and a facing that is not uphill-of-fall-line pivoting. Or require speed above 0.3 m/s for most of the window.
  2. Lengthen the stranded window to about 8 s. Keep the 4 s window only for the "walled" branch.
  3. Never treat a rescue as a crash: add a `relocate(…, { crash: false })` path that skips the multiplier reset and the "Major crashes" count.
  4. Add a unit test that pivoting, or brake plus steer, for 10 s at every viewpoint and at open-snow points is never relocated.

### Defect 2. **Major: on Normal Sprint, the Fjord is not measurably harder than Alpine for a competent wind-reading player (F-039 confirmed, open)**

- **Evidence:** `bal-sprint.jsonl` and `bal-sprint2.jsonl`, 24 fresh seeds (`B8S01–10`, `B8T01–14`), paired Fjord − Alpine winning times on Normal Sprint.

| Driver | Mean | Standard error | Median | Seeds where the Fjord is faster |
|---|---:|---:|---:|---:|
| Reader | **+1.1 s** | 1.7 s | +2.5 s | **10/23** |
| Hazard-blind skilled | +7.4 s (≈ +4.8 %) | 1.8 s | +8.4 s | 5/24 |
| Intermediate | +6.6 s | 1.8 s | — | 5/24 |

  - On the 14 `B8T` seeds alone the reader is **−0.8 s**: the Fjord is faster.
  - The course-to-course variance (σ ≈ 8 s) swamps the environment's cost for a good player. A player who reads the wind will often post a faster Sprint in the "harder" location.
- **Fix:**
  - Tie the Fjord's run-in terrain to Alpine's for the same seed (environment-off parity was 0.0 s in round 4).
  - Or add a small fixed cost a reader cannot avoid: for example a minimum gust exposure per refuge leg, or slightly slower deep-snow lee lines.
  - Add a pooled ≥ 20-seed assertion: reader Fjord − Alpine ≥ +2 % on Normal Sprint, and the Fjord slower on at least 75 % of seeds.

### Defect 3. **Major: the sea-cave mouth's scanned boulders are view-only, and the skier skis through them**

- **Code:** `seaCave.ts:384–416`. Each mouth gets 9–14 boulders, r 1.1–2.6 m, with half the boulder above the snow. They are recorded only in `userData.props` (`:393`). They are not in the `ObstacleField`, and `World.extraColliders` (`World.ts:426`) returns only the finish's colliders.
- **Evidence** (`boulders8.test.ts`, real `Cave` and `dressSeaCave` on B8C1/B8C2, Sprint and Standard):
  - 40 of 42 boulders stand on skiable ground (under 35°), 22–31 m from the line, between 9 m before and 15 m after the cave (for example B8C1 Sprint cave 0, x-route −23.8, z-cave +6.4, r 1.5, 31°).
  - 27 of 192 cave-side approaches pass through a boulder's body (1,409 physics steps inside rock).
  - Every other rock in the game crashes or deflects the skier. These are the rocks a curious player skis up to.
- **Fix:** register each boulder as a `rock` collider (in the extra colliders of the cave slot, or injected into the `ObstacleField` band). Then re-run `pin8` with the colliders: the watchdog already covers any new pocket.

### Defect 4. **Minor: Hard Endurance is still steep, and weak drivers struggle on Relaxed**

- **Hard Endurance** (B8E01–04, intensity now 0.85 there):

| Driver | Alpine | Fjord |
|---|---:|---:|
| Reader | 3/4 | **1/4** |
| Skilled | 2/4 | 1/4 |

  Pooled with round 4: reader 6/8 against 4/8, skilled 3/8 against 1/8. The samples are small.
- **Hard Standard, intermediate driver:** Alpine 2/6, Fjord 0/6.
- **Relaxed Sprint, `average` bot:** Alpine 4/10, Fjord 1/10. Round 4 was 4/10 against 0/10. Part of this is terrain: in round 4, with the environment off, the Fjord was 2/10.
- **Fix:** a 20-seed pooled check on Hard Endurance. If the reader's win rate is still below 0.8 × Alpine's, use about 0.75 on Hard for courses of 20 km or more.

### Defect 5. **Minor: the jump-squall landing rock is still only weakly tied to the gust (round-4 #4, not fixed)**

- **Evidence:** `probes P=A`, 510 squall-kicker jumps per difficulty on B8A1–6 Standard.

| Difficulty | Landed in the rock: wind | Calm |
|---|---:|---:|
| Normal and Hard | 85 | **54** (10.6 %) |
| Relaxed | 78 | 54 |

- Round 4 was 85 against 78. The improvement comes from the seeds; `JUMP_ROCK_INSET` is still 4 and `fjord/hazards.ts` is unchanged.
- **Fix** (as in round 4): `x = lipX + Δroute + 2.5 + r`, so a straight calm landing clears the rock, and assert calm landings in the rock below 3 %.

### Defect 6. **Minor: a stop at the cornice edge is still a crash (round-4 #6, not fixed)**

- **Evidence:** `cornice.log`. 227 of 234 idle stops in the band are relocated at about 2.9 s through `relocate → crash`, with "WIPEOUT!" (the over-crest variant is visible in shot `15`).
- The same crash accounting now applies to the pin rescue (defect 1).
- **Fix:** no crash and no multiplier reset for stall and pin relocations, plus about 6 s for a stationary skier, or a "you're bogging down" prompt first.

### Defect 7. **Minor: the decision a human can read is still worth little against "always lee" (round-4 #7, not fixed)**

| Normal Sprint (10 seeds) | Behind `read` |
|---|---:|
| `cue` (windsock now) | +1.10 s |
| Always lee | +1.42 s |

- Reading the windsock therefore beats blind safe play by about 0.3 s per Sprint.
- On Standard, cue is +4.7 s and ignore +8.8 s.
- The hazard code is unchanged since round 4.

### Defect 8. **Minor: gaps still have no stake at racing speed (F-015, open and accepted)**

- `fjord/hazards.ts` is unchanged, and the tracker accepts this for the preview. I did not re-run the gap probe.

### Defect 9. **Minor (evidence): the gate decision is still not shown from the player's camera**

- `12`/`12b` are a welcome gust/lull pair, but they are taken from a free camera about 30 m up and behind (`manifest.json`: camera (46.8, −229.3, 851.4)).
- `09_pursuit` shows a gate far ahead from the chase camera at 79 km/h. Even there, which side is the notch is not legible.

## 5. What works

- **The soft-lock is gone, engine-wide.** Every stuck skier is either back by skating or rescued, with a median of 1.2 s into the recovery attempt and a maximum of 12.5 s. The frozen-velocity state never occurs (0 of 4,320).
- **The wall fix is intact:** no launches, cliff hits graded as crashes, and energy bounded.
- **Legitimate jumps are untouched** (1,651 of 1,651 bit-identical to round 4, which was itself within 3 mm of the pre-PR-#6 engine).
- **The cornice:** skating inland escapes 228 of 234; 0 are stuck under any inland policy.
- **The wind is a real choice on every length:**

| Normal | Ignore costs | Wrong choice costs |
|---|---:|---:|
| Sprint | +2.0 s | +3.6 s |
| Standard | +8.8 s | — |
| Endurance | +9.9 s | — |

  - On Relaxed the mechanic stays: Sprint ignore +1.0 s and wrong +2.0 s; Endurance at intensity 0.425 ignore +9.0 s and wrong +13.7 s.
- **The Yeti is not touched.** No Yeti or `CourseConfig` change; intensity scales only the environment (`biome.ts:229`, `environment.ts:102`).
- **The longer Normal ladders are sensible:**

| Normal | Reader | Skilled |
|---|---:|---:|
| Standard | +4.5 % | +9.0 % |
| Endurance | +2.6 % | +5.6 % |
| Expedition | +3.9 % | +7.8 % |

- **Every finite length was completed** by competent drivers on Normal and Relaxed. Endless ran 900 s without fault in 12 of 12 runs, with 1 reader catch at 14.3 km.
- The comment in `biome.ts` is now accurate.

## 6. Status of round-4 defects and tracker items (my own verification)

| Item | Status | My evidence |
|---|---|---|
| r4 #1 / F-021: cave-mouth trap and frozen velocity (Critical) | **Fixed** | 0 unrecovered, 0 frozen in 4,320 approaches, including my round-4 trap seeds. The cost is a new Major: false positives (defect 1). |
| r4 #2 / F-022: Hard and long-course step too steep | **Mostly fixed** | Hard Standard is fixed. Expedition minimum gap 37 m against Alpine's 43 m. Hard Endurance is still steep (defect 4). |
| r4 #3: Relaxed barely softer, weak driver | **Partial** | Relaxed reader Sprint +2.8 % against Normal +2.6 %; Standard +3.3 % against +4.5 %. `average` bot 1/10 against 4/10 (defect 4). |
| r4 #4: landing rock weakly tied to the gust | **Not fixed** | 85 against 54 (defect 5). The code is unchanged. |
| r4 #5 / F-015: gap stake | Not fixed (accepted) | The code is unchanged. |
| r4 #6: cornice stop is a crash | **Not fixed** | Defect 6. |
| r4 #7: thin readable decision | **Not fixed** | Defect 7. |
| r4 #8: stale intensity comment | **Fixed** | `biome.ts:222–228`. |
| r4 #9: no player-camera gate shot | **Partial** | 12/12b added (free camera); defect 9. |
| F-001: wall launch | **Fixed** | 0 of 1,440 with more than 3 s of air; maximum vertical speed 14 m/s. |
| F-002: cornice trap | **Fixed** (re-verified) | 0 stuck. |
| F-006: squall is a time tax, not a decision | **Fixed** | §5. |
| F-018: Relaxed 0.25 | **Fixed** | Relaxed is 0.5 (0.425 on long courses); the mechanic is kept (§5). |
| F-039: Sprint ladder within seed noise | **Confirmed, open** | Defect 2. |
| F-035: no warning for a squall entered mid-gust | Not verified | Reviewer E's area. |
| F-033: production frame times | Not verified | Reviewer D's area. |

## 7. Public-preview gate (completion brief §10), my items

| Gate item | Status | Evidence |
|---|---|---|
| No critical gameplay or physics defects | **Met** | No Critical found. Defects 1–3 are Major. |
| No unrecoverable states | **Met** | 0 unrecovered or frozen in 4,320 cave approaches; 0 stuck at the cornice. |
| All finite lengths completable | **Met** (headless) | Sprint, Standard, Endurance and Expedition were won by the reader and skilled drivers on Normal and Relaxed. The losses were Yeti catches on Hard, a "hard landing" after steering in mid-air during a squall, and one log trip. |
| Endless streams reliably | **Met** (headless physics only) | 12 of 12 runs of 900 s; 17.5–18.9 km each. Not browser-verified. |
| No infinite launch, friction trap or unrecoverable position (completion brief §3) | **Met** | §2. |
| Legitimate jumps, rollers, pops and landings unaffected | **Met** | 1,651 of 1,651 identical. |
| All automated tests pass | **Not verifiable by me** | My 3 unit files are 31/31. `round-8/TESTS.md` was absent when I finished. |

**My gate items are met.** Full approval is **not** met: Skiing and hazard mechanics 8 and Difficulty and fairness 7.5 are below 9.

## Reproduction

Run from `/home/claude/sf-fjord`. The run order is in `scratch/review-b-r8/run_all.sh`, `run_more.sh` and `run_extra.sh`. Tables come from `node scratch/review-b-r8/table.mjs scratch/review-b-r8/out/bal-*.jsonl`.
