# Whiteout Ridge, round 5: Reviewer F (hostile critic: overall player experience)

- **Role:** Reviewer F. I own category 8 (overall player experience). My scores in the other categories are low confidence (lc).
- **Nature:** I am a **model reviewer, not a human playtester**. I looked at still renders, data, simulator runs and source. I did not play at frame rate, hear the audio or feel rumble. Where a judgement depends on motion, timing, sound or touch, I say so.
- **Build:** frozen source `729e226`. All my experiments ran on `git archive 729e226` in `/tmp/f5z` (node_modules symlinked). Outputs are under `/tmp/f5/`. The only file I wrote in the repository is this report.
- **Independence:** I did not open `REVIEW_A/B/C/D/E` for round 5, nor `round-5/blind/`. I read my own round-4 report and round-4 `CONSOLIDATED.md`.
- **Order of work:**
  1. Images first, before any developer document: all 25 `whiteout/` shots, all 10 `whiteout_victory/` beats, the three hand-off strips (`strip_high` all three locations, `strip_low`, `strip_rcm`) as contact sheets plus full frames, `rim_1366/`, `rim_1920/`, `a11y_low/`, `a11y_ui150/`, `a11y_reduce_weather/`, `a11y_rcm_flash/`, with 2× crops where something looked wrong.
  2. Then `CANDIDATE.md`, `OWNER_DECISIONS.md`, `DEFECTS.md`, `balance/r5/README.md`, `perf/README.md`.
  3. Then `git diff 71c9ceb 729e226 -- src` (balance, App, rescueVictory in full; the rest by stat), `YetiAI.ts`, the candidate balance data, and my own simulator runs.

---

## Verdict: category 8 = **8 / 10**. FAIL against the 9/10 gate. Would I ship this location? **No, not yet.**

This is the best round so far, and the main thing I asked for in round 4 is done: **on Normal, a competent weather-aware player now feels the Yeti, and a clean expert usually escapes.** I reproduced that on fresh seeds of my own (§F5-1). The searchlight beam finally exists, the Yeti is readable in the inset, the inset now shows on Low, and the sheet at the vanishing point is gone.

It is not a 9 because what a player sees most, and the way a typical run ends, still let it down:

1. **The clear-weather frame still looks fake.** A sawtooth "cardboard" storm wall hangs over the crest in every clear gameplay frame. The drop side reads as a rippled grey lake with dark "boats" on the horizon. In other words, the premise of the location still does not read in the view players screenshot (**F5-2**, Major).
2. **The Normal chase bleeds out toward the finish.** For a competent player the lead peaks early, then the Yeti creeps in, and the closest moment is at the hut door. In the developer's own data, 5 of the 9 Sprint losses happen within 65 m of the finish line. Blizzard cells on the line take about 40 m per knock, and once the gap starts shrinking a competent skier never wins it back (**F5-3**, Major).
3. **The payoff and the encounter close-ups are still unfinished.** In the welcome beat the rescuers wave at an empty space (the developer reports this himself). The lantern is held up by a handless tube. The cave brow is still a smooth white sausage with floating paper shards and floating snow lumps (**F5-4**, Major).

A paying player now gets a real chase on Normal, a handsome storm and a cute rescue hut. They also get a "photo finish" against the Yeti that is decided by the last 500 m of terrain more than by their skiing, and a first look at Whiteout Ridge that reads as a lake under a paper backdrop.

### Plain answer to the owner's decision 2
**Met in the numbers, with a shape problem.** On my 13 fresh seeds (Classic plus F5Z-01…12), whole chase to the finish, Whiteout Normal:
- A competent weather reader sees CLOSING in **13/13** runs (median 16 s Sprint, 28 s Standard), and is caught **2/13** Sprint and **6/13** Standard.
- A clean expert escapes **12/13** Sprint and **13/13** Standard.

It is not met on two of the owner's clauses:
- **"Excellent recovery can save the run."** In the competent player's escapes, the gap regained after the closest point is a median **0 m**. The low point is the finish line in 8 of 11 Sprint escapes.
- **The clean expert can lose to placement alone.** F5Z-03 Sprint shows a clean expert caught by two blizzard cells on the line, with no crash.

### Does anything secretly help or hinder the player?
I found nothing that secretly *helps* the player. Three things *hinder* the player and are invisible in play, and the owner should rule on them (**F5-5**):
- **The Whiteout Normal Yeti (×1.06) is now within 1% of the Whiteout Hard Yeti (×1.07).** The menu calls the setting "Yeti: Normal / Hard".
- **The catch-up boost is pre-existing and documented.** It is gap-reactive, but because it was in the original game rather than added this round, I list it as a question, not a defect: past 60 m the Yeti runs up to +9 m/s faster (+7 m/s more past 105 m). That caps any lead at about 100–140 m. The owner's "no Yeti that secretly accelerates in response to performance" reads on it literally.
- **Hard's weather builds ×1.5 past 3 km.** This changes physics more than it changes the view.

---

## (a) Scores

| # | Category | R4 | R5 | Justification (evidence) |
|---|---|---|---|---|
| 1 | Visual art direction (lc) | 6.5 | **7** | **Up:** the vanishing-point sheet is gone (`01`, `02`, `07`, `27`); the searchlight is a visible warm cone with a lamp glare and a pool (`whiteout_victory/24`); the storm frames are still the best in the game (`05`, `28`, `29`). **Down / unchanged:** a sawtooth, hard-edged white wall over the crest in every clear frame (`01`, `02`, `03`, `06`, `07`, `27`, `rim_1366/*_1_clear`, `rim_1920/*`; crop of `01` x 800–1366, y 60–330, shows paper-cut jags and hanging "drips"); a grey, flat-shaded curling slab in `rim_1920/classic_standard_0_clear` (x 750–1000, y 380–540) that reads as a breaking wave; the cornice a stepped slab (`08`); the cave brow a smooth tube with floating triangular shards and floating snow clumps in the sky (`12` top, `13`, `14`); the lantern arm a handless tube (`22`). |
| 2 | Environmental uniqueness (lc) | 6.5 | **7** | The storm, the rescue station and the rim flags and plumes are Whiteout's own. The drop side reads as a glossy grey rippled lake (`02` crop, `09`), with small dark slabs on its horizon that read as boats (`01`, `02` top edge). The crest side still reads as Alpine scree (`10`). The cave opening is the same template as Alpine and Fjord, beat for beat (all three `strip_high` sheets). |
| 3 | Skiing and hazard mechanics (lc) | 7.5 | **7.5** | Caption, arrow and push agree (`04`/`05` ←, `28`/`29` →). A blizzard knock on the line costs 18 → 11.5 m/s at once and about 10 s to recover on the 15° floor (F5Z-03 trace, §F5-3). A crash costs 22 → 4 m/s and about 8 s to reach 13 m/s (F5Z-07). The drift rows in `29` are nearly invisible as shapes: the "flagged gaps" are carried only by the orange signs. |
| 4 | Difficulty and fairness (lc) | 7 | **7.5** | **Decision 2 met in numbers** (§F5-1). **But:** the Normal chase bleeds to the finish line; on-line blizzard pairs decide some runs; one crash from a 100 m lead is a capture 5/13 on Sprint (Alpine 2/13). Hard: the developer reports Sprint 79–83% (at or just above range) and Standard 46% (in range); I did not re-run Hard. |
| 5 | Cinematics (lc) | 7 | **7.5** | **Up:** the set-up shot shows the skier whole and the Yeti on the ledge (`15_cave_setup`); the beam beat reads at last (`24`), and the recoil pose reads as blinded, not snarling (`24c`). **Not fixed:** the welcome beat has no skier (`21`; developer-acknowledged); the lantern hand (`22`); the beam is a hard-edged translucent plane across `24c` (x ≈ 990); the reveal is a hut on a flat plain (`26`). The opening is identical to the other two locations. |
| 6 | Performance and stability (lc) | 7 | **7.5** | Software render 1.10× Alpine (2.10× in round 4). Frames over 16 ms: 17 high, 9 low. Programs compiled in play: 6, against a target of ≤ 2. Cave slice 24.7–31 ms. No GPU timing. |
| 7 | Accessibility and controls (lc) | 8 | **8.5** | **For:** the inset on Low for the whole chase (`a11y_low/16`: Yeti visible at 28 m); RUN. clear at UI 150% (`a11y_ui150`); the Reduce Camera Motion note in the menu. **Against:** I did not test Reduce Weather in motion; the welcome beat fails with Reduce Camera Motion on as well. |
| **8** | **Overall player experience (owned)** | **7.5** | **8** | Up for a real Normal chase, a readable Yeti in the inset on every preset, and a searchlight beat that finally lands. Held below 9 by F5-2, F5-3 and F5-4, with no human playtest yet (F5-7). |

## (b) Findings

### F5-1. Positive (verified): decision 2's headline is met, and the fixes I asked for in round 4 mostly landed
**My run:** `tension.measure.test.ts` on `/tmp/f5z`, patched only to chase to the finish (`CHASE_M=20000`) and to trace skier z and speed plus Yeti speed. Whiteout Normal, Classic + F5Z-01…12, Sprint and Standard, all seven behaviours: 182 rows. Alpine and Fjord ran on the same seeds as references (skilled, competent, late crash): 156 rows.

| Whiteout Normal (13 seeds) | Caught Sprint | Caught Standard | Median min gap S / St | CLOSING seen | Median CLOSING (s) S / St |
|---|---|---|---|---|---|
| Skilled (clean expert) | **1/13** | **0/13** | 46 / 47 m | 2/13, 3/13 | 0 / 0 |
| Competent (weather reader, sloppy turn every 12 s) | **2/13** | **6/13** | 29 / 14 m | **13/13, 13/13** | **16 / 28** |
| Early crash (5 s) | 5/13 | 6/13 | 4 / 3 m | 13/13 | 9 / 9 |
| Late crash (20 s) | 5/13 | 3/13 | 18 / 16 m | 13/13, 12/13 | 8 / 9 |
| Poor route | 13/13 | 13/13 | – | 13/13 | 13 / 13 |
| Cautious | 13/13 | 13/13 | – | 13/13 | 8 / 8 |
| Slow arrival | 0/13 | 0/13 | 26 / 27 m | 7/13, 6/13 | 1 / 0 |

- **Round 4, for comparison** (my F4-1): a competent reader was caught 0/7, CLOSING 0 s, and the min gap was the start gap. So the change is real.
- **The developer's numbers agree:** competent Sprint 15/24 won, median closest gap 18 m.
- **Other round-4 items now fixed** (verified in the frames):
  - The inset Yeti is about 65 px tall at 28 m (`16`, inset y ≈ 125–190), against about 15 px in round 4.
  - The inset shows on Low after the leap (`a11y_low/16`).
  - The set-up shot shows the whole skier and the Yeti on the ledge (`15_cave_setup`).
  - The searchlight cone, glare and pool are visible (`24`).
  - There is no pole in the lantern hand (`22`).
  - There is no sheet at the vanishing point in clear frames.

### F5-2. Major (categories 1, 2 and 8; W-065 and W-093 carried): the clear-weather view still reads as a backdrop and a lake, not a ridge
**Evidence (images):**
- **The storm wall** over the crest is a flat, hard-edged silhouette:
  - It has a regular sawtooth top, and some jags hang downward like drips. See `01`, `02`, `03`, `06`, `07`, `27`, `rim_1366/classic_sprint_1_clear`, `rim_1920/classic_standard_0_clear`. In the 2× crop of `01` (x 800–1366, y 60–330) it is plainly a paper cut-out.
  - `CANDIDATE.md` says the wall was reworked after a blind read called it "a cardboard backdrop" and has **not** been blind-read since. It still reads as one to me.
- **The drop side:**
  - It is a glossy, rippled grey surface (`02` crop, `09`). Pale vertical wisps rise from the rim (the new spindrift plumes). In stills they read as steam columns.
  - Small dark slabs sit on the far edge of the cloud sea (`01` y ≈ 240; `02` top edge; `09`). They read as boats on a lake.
  - The rim flags and plumes do mark an edge now, which is progress. But nothing in the frame says "500 m drop".
- **`rim_1920/classic_standard_0_clear`:** a grey, flat-shaded curling slab in mid-frame (x 750–1000, y 380–540) under a terrain fold that curls like a breaking wave.

**Player impact:**
- The first minute of every run is clear weather.
- These are the frames a player screenshots and a store page shows.
- Under the name "Whiteout Ridge" they show a valley beside a lake, under a paper wall.

**Acceptance criterion:**
- No regular sawtooth or hanging jags on the storm wall at 1366 and 1920, in clear and approaching phases.
- No dark slabs on the cloud-sea horizon.
- A fresh blind read on the candidate SHA names the left side as a drop or ridge edge, not water.
- Reviewer A does not list the wall again.

### F5-3. Major (categories 4 and 8; new): the Normal chase bleeds out toward the finish, and placement decides close runs
**Evidence 1: the closest moment is the finish line, not a mistake.** The data is from my run, on escaped runs only:

| | Low point in the last 1% of the chase | Gap regained after the low point (median) | Final gap (median) |
|---|---|---|---|
| **Whiteout competent, Sprint** | **8/11** | **0 m** | 42 m |
| Whiteout competent, Standard | 5/7 | 0 m | 27 m |
| Whiteout skilled, Sprint | 5/12 | – | 76 m |
| Alpine competent, Sprint | 0/12 (the low point is the hand-off) | 72 m | 93 m |
| Fjord skilled, Sprint | 0/13 | – | 102 m |

**Evidence 2: the losses cluster at the finish.** In the developer's own `candidate/balance/sloppy.jsonl` (competent, Whiteout Normal Sprint, 25 seeds):
- **5 of the 9 losses happen within 24–65 m of the 3,000 m finish:** R5V-14, -18, -19, -21, -23, each after about 150–160 s of chase.
- Alpine (3 losses) and Fjord (8 losses) have none within 370 m of the finish.
- On Standard, R5V-03 is caught 5 m from the finish and R5V-15 135 m from it.

**Evidence 3: why.** From the F5Z-01 trace (competent, Sprint):
- **The finish stretch:** slope falls from 15° to 9° over the last 500 m. The skier there runs 16–18 m/s; the Yeti holds 17.5 m/s (1.06 × 16.5).
- **The bleed:** one slowdown at z ≈ 2,490 (22.6 → 11.8 m/s for 6 s) starts a monotonic bleed, 96 → 4 m, with no way back.
- **The same seed in Alpine:** the skier holds 18–22 m/s and the gap grows.

**Evidence 4: blizzard cells on the line can catch a clean expert.** F5Z-03 Sprint, skilled, no crash, fine trace at 0.5 s:
- The gap is 101 m at z 665.
- Blizzard cell 1 is 4 m off the line at z ≈ 720: 18.2 → 11.5 m/s, about 10 s to reach 16 m/s, gap 94 → 55 m.
- Blizzard cell 2, also on the line, at z ≈ 870: 18.1 → 11.4 m/s, then caught at z 952 (41.6 s).
- The competent and late-crash runs on that seed are caught at the same place.
- The developer's "clean skier never caught" rests on the first 1.5 km only. Over the whole chase it is "usually", which the owner allows, but here the cause is cell placement, not the player.

**Evidence 5: one crash from a big lead is a coin flip.** Crash 20 s into the chase, with the lead at 88–105 m:
- Caught **5/13** on Sprint, each within about 10 s (gap 105 → 6 m in F5Z-07: 22.6 → 4.2 m/s, back to 13 m/s only after 8 s).
- Alpine on the same seeds: 2/13.
- Round 4: 0/9 on the developer's seeds.

**Player impact:**
- On the default difficulty, a typical Whiteout run is a lead built in the first 30 s, then a slow, inevitable shrink.
- The run is decided in sight of the hut.
- I could not judge how that feels at speed. It may read as a thrilling photo finish. But "caught at the door" after 2½ minutes, recurring and terrain-driven, is the most resented outcome in a chase game.
- It also contradicts "excellent recovery can save the run": once the shrink starts, the model player never gains a metre back.
- The tension came largely from making the Yeti's pace about equal to a skier's sustainable cruise on the 15° storm floor. That makes every knock permanent.

**Acceptance criterion:**
- Over the whole chase on 24+ fresh seeds, the competent Normal player's low point is not concentrated at the finish (≤ 1/3 of escapes in the last 5%).
- Losses within 100 m of the finish are no more than in Alpine.
- Competent escapes with a dip show a median regain over 20 m.
- No clean expert is caught by blizzard placement alone (a placement rule like W-056's: no two knock zones on the line within about 300 m on Normal).
- Directions the constraints allow: a steeper or sheltered finish run-in on Whiteout; spacing of on-line cells; a faster post-knock recovery. Not a Yeti change that reacts to the player.

### F5-4. Major (categories 1, 5 and 8; W-083, W-066 and W-091 carried): the payoff and the encounter close-ups still are not finished
**Evidence:**
- **`21_v_welcome`:** two rescuers wave from the porch at nobody. The skier is not in frame. The developer's harness fails on it, and `CANDIDATE.md` reports it as not fixed on this candidate. It fails with Reduce Camera Motion too (`a11y_rcm_flash_run1_strict`).
- **`22_v_lantern`:** the lantern-raising arm is a smooth tube ending in a point, with no hand, and the lantern sits on the tip. This is the hero image of the ending.
- **`24c_v_yeti_recoil`:** the beam's edge is a hard vertical translucent plane across the frame (x ≈ 990).
- **`12`, `13`, `14` (the two best Yeti close-ups):**
  - The cave brow is a uniformly lit white tube, with flat triangular shards hanging in mid-air below it.
  - In `12`, four snow clumps float in the sky above the rock.
  - In `15_cave_setup`, a separate white arc floats left of the mouth.
- **`23`:** the Yeti is dark grey in the fog; in `24` he is white. In motion this may read as fog lighting. In stills it reads as a different creature.

**Player impact:**
- These are the encounter and the ending, the two set pieces the location is remembered by.
- A welcome beat that welcomes no one undoes the payoff the searchlight fix finally delivered.

**Acceptance criterion:**
- The skier in the welcome beat with the harness strict (no `LENIENT`).
- A hand mesh on the lantern arm.
- Shards attached to the brow, and no floating clumps.
- A soft-edged or volumetric beam boundary.
- Reviewer C does not list these again.

### F5-5. Minor (categories 4 and 8; owner question): the setting the player chooses no longer means what it says on Whiteout, and two invisible pressures need a ruling
**Evidence:**
- **The difficulty paces:**
  - `CourseConfig.ts:24–28` sets Normal `yetiSpeed 1`, Hard `1.07`.
  - Whiteout's `difficultyPace: { normal: 1.06, hard: 1 }` (`biome.ts`) makes the Whiteout Normal Yeti 1.06 and the Hard Yeti 1.07.
  - The menu calls the setting **"Yeti"** (`App.ts:429`). On Whiteout, picking "Hard" there makes the Yeti 1% faster; the real difference is a stronger storm the player is not told about.
  - Decision 1 forbids a *global* speed change, and this is not one. It is legal but undisclosed.
- **The catch-up boost** (`YetiAI.ts:241`) is gap-reactive Yeti acceleration:
  - +9 m/s ramping in from 60 to 180 m, and +7 m/s past 105–170 m.
  - It has been there since the baseline (`18c03f1`) and is documented in `DESIGN.md`.
  - It is why a clean lead settles at about 100–140 m (my traces: the Yeti at 19.6–20.3 m/s when the gap is about 100–111 m, against 17.5 m/s inside 60 m).
  - Decision 2's "no Yeti that secretly accelerates in response to performance" reads on it literally. I do not count it as a round-5 defect. The owner should confirm it is exempt.
- **Hard's storm build-up** (×1.5 from 3 to 8 km) scales knock and drag strength. The only visual change is inside cells (`hazardVisibility`). The player is not told the mountain gets meaner.

**Nothing found that secretly helps the player.** I searched for mercy, grace, assist and rubber-band logic. The only "grace" is the snowball first-throw delay. The inset's lighter fog (0.45×) is presentation only.

**Acceptance criterion:**
- The owner rules on the catch-up boost.
- Either the menu label reflects what the difficulty changes per location (for example "Difficulty", or a one-line note), or the owner accepts it as is.
- The decision is recorded in `OWNER_DECISIONS.md` or `DEFECTS.md`.

### F5-6. Minor (QA): the evidence still shows a chase that never happens on Normal
**Evidence:**
- Thirteen of the 25 `whiteout/` shots have the Yeti 224–265 m back (`01`–`11`, `27`–`29`), and `19` has him at 2,609 m.
- My Normal runs never show that state. The largest gap in a whole chase is a median 111 m (competent Sprint) or 125 m (clean Sprint), and a competent player spends a median 98% of a Sprint chase with the Yeti inside 110 m.
- So in most evidence frames the HUD bar is empty and grey, the inset is absent, and RUN.'s threat is gone. That is not what players will see.
- The `08` note still says "the lip curling over the flank". The frame shows a stepped slab.

**Acceptance criterion:** at least three gameplay-camera chase shots at typical Normal gaps (40–110 m), in clear weather and in a storm. Notes written from the frame.

### F5-7. Minor (process): no human playtest, and category 8 cannot reach 9 without one
F5-3 is a feel question that only people can settle: is a recurring finish-line squeeze a thrill or a grievance? So is whether a moving eye reads the drift-gap flags in a storm. Every number in this report comes from model drivers, mine included.

**Acceptance criterion:** at least 3–4 human runs on Whiteout Normal Sprint and Standard, with the gap trace recorded and the players' words about the ending.

## (c) What I could not verify
- Motion and timing at 60 fps: whether the plumes read as spindrift in motion, whether the storm wall's jags are as obvious when it moves, and whether the beam reads in motion.
- Audio (footsteps, growls, wind panning) and rumble.
- GPU frame time.
- Hard: I did not re-run the Hard ladder. I rely on the developer's data for the Hard ranges.
- Browser–simulator parity this round (not re-run by the developer; I did not run it).
- Human skill: a human reads drift flags in fog worse than the reader driver, which would add pressure, and may steer round blizzard cells better, which would remove some.

## (d) What would raise category 8 to 9
1. **F5-2:** a storm wall without the sawtooth or hanging jags, no "boats" on the cloud sea, and a blind read on the candidate that names a drop.
2. **F5-3:** a Normal chase whose close calls come from the player's mistakes, not the last 500 m of terrain or two cells on the line; recovery visible in the gap traces.
3. **F5-4:** the skier in the welcome beat, a hand on the lantern, and the cave brow and its shards attached.
4. **F5-5:** owner rulings recorded.
5. **F5-7:** human playtests.

## Reproduction (my runs; nothing in the repository was changed)
```
mkdir -p /tmp/f5z && git -C /home/claude/sf-wo archive 729e226 | tar -x -C /tmp/f5z && ln -s /home/claude/sf-wo/node_modules /tmp/f5z/node_modules
# /tmp copy only: tests/sim/tension.measure.test.ts maxZ = triggerZ + CHASE_M (default 1500), plus traces of
# skier z/speed, Yeti speed and slope every 2 s, and FINE=1 0.5 s traces with nearby hazards
S=CLASSIC,F5Z-01,…,F5Z-12
OUT=/tmp/f5/out/t_wo_normal.jsonl BIOMES=whiteout SEEDS=$S LENS=sprint,standard DIFFS=normal CHASE_M=20000 \
  npx vitest run --config vitest.sim.config.ts tests/sim/tension.measure.test.ts          # 182 rows
OUT=/tmp/f5/out/t_ref.jsonl BIOMES=alpine,fjord SEEDS=$S LENS=sprint,standard DIFFS=normal \
  BEHAVIOURS=skilled,competent,lateCrash CHASE_M=20000 npx vitest run …                    # 156 rows
FINE=1 … SEEDS=F5Z-03 BEHAVIOURS=skilled                                                    # blizzard-pair capture
… SEEDS=F5Z-07 BEHAVIOURS=lateCrash; … SEEDS=F5Z-01 BEHAVIOURS=competent,skilled BIOMES=whiteout,alpine
# finish-line losses: candidate/balance/sloppy.jsonl, whiteout normal informed2NoLee, outcome≠victory, finishZ − distance
```
