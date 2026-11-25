# Whiteout Ridge, round 4: Reviewer F (hostile critic: overall player experience)

- **Role:** Reviewer F. I own category 8 (overall player experience). My scores in the other categories are low confidence (lc).
- **Nature:** I am a **model reviewer, not a human playtester**. I looked at still renders, data, simulator runs and source. I did not play at frame rate, hear the audio or feel rumble. Wherever a judgement depends on motion, timing, sound or touch, I say so.
- **Build:** the frozen source is `71c9ceb`. `git diff 71c9ceb 4d08115 -- src` is empty, and so is the same diff against `6ff50f9` and `0787168`, the SHAs the evidence manifests record. The unit and e2e logs carry SHAs whose `src` is identical too.
- **Independence:** I did not open `REVIEW_A/B/C/E` (nor a D report) for round 4.
- **Order of work:**
  1. I looked at the images first, before reading any developer document. That covered all 30 `whiteout/` shots, the four strips (via contact sheets plus 2–4× crops of the inset), `rim_1366/` and the three `a11y_*` sets.
  2. Then I read `CANDIDATE.md`, `OWNER_DECISIONS.md`, `DEFECTS.md`, round-3 `CONSOLIDATED.md` and my own round-3 report.
  3. Then the balance data, `w080/README.md`, the perf JSON, the e2e and unit logs, and `git diff 46ed200 71c9ceb -- src` (App, GameSession, rescueVictory, presence, Hud in full; the rest by stat).

**My own simulator runs.** All outputs are under `/tmp`. No repo file was changed.
- **Tension on the frozen tree.** `tests/sim/tension.measure.test.ts`, Whiteout, Classic + T4H-01…06, Sprint and Standard, Normal and Hard: 196 rows in `/tmp/ftens/all.jsonl`.
- **The same Normal runs on an archive of `46ed200`:** `/tmp/ftens/r3.jsonl`.
- **A stance check.** I made a copy of HEAD in `/tmp/r4` with one extra simulator policy, `readNoStance`: the same reader, blizzards ignored.
  - The ladder ran on Classic + W4H-01…12 for the competent and the expert drivers.
  - The unchanged `informed2NoLee` rows reproduce `candidate/balance/*.jsonl` exactly: 0 mismatches over 78 rows.

---

## Verdict: category 8 = **7.5 / 10**. FAIL against the 9/10 gate. Would I ship it? **Not as a finished location.**

**Round 4 fixed the things that blocked a 7 from rising:**
- Hard is now winnable on every Classic course.
- The first three seconds of the chase are no longer a pile-up.
- On Classic Normal, a single crash is recoverable.
- The leap now has an image on Low, and the landing is in frame.
- The white puff over the skier is gone from the rim frames.

I verified each of these, and several I reproduced (§F4-8).

**Four things keep it well short of 9:**
1. **The difficulty work emptied the default-difficulty chase.** On Normal, a competent weather-reader is never pressed after the second the chase starts. The Whiteout tension instrument that proved "graded risk" in round 3 was not re-run, and the candidate reports this outcome as a success (**F4-1**).
2. **The antagonist is still a figure under ~18 px in a box.** On Low, after the leap, he has no image at all (**F4-2**).
3. **The ending's hero images are still broken.** There is no searchlight beam for the third round running, the lantern is held by a hand-less tube with a ski pole hanging through it, and the skier is missing from the "welcome" shot (**F4-3**).
4. **The location's premise, the ridge, is still not legible in clear weather.** A pale translucent sheet sits at the vanishing point of most clear gameplay frames, and the developer's own blind reader called it a glitch (**F4-4**).

A paying player would get a handsome storm, a charming rescue-hut ending, and a chase that, on Normal, looks dangerous for two seconds and then never again.

## (a) Scores

| # | Category | R3 | R4 | Justification (evidence) |
|---|---|---|---|---|
| 1 | Visual art direction (lc) | 6.5 | **6.5** | **Up:** storm frames are the best in the game (`04`, `05`, `28`, `29`: flat light, the horizon gone, lamps and orange flags carrying the route); the roar close-up has a readable face (`14`); the puff over the skier is gone (`rim_1366/*_clear`). **Down / unchanged:** a translucent vertical sheet at the vanishing point and a sawtooth translucent wall over the crest in most clear frames (`01`, `02`, `03`, `07`, `27`, `rim_1366/classic_sprint_0_clear` x≈520–840 y≈220–420 and x≈830–1366 y≈0–250); the cave brow is a smooth white "sausage" with flat paper shards under it (`12`, `13`, `14`); the cornice is a stepped slab (`08`); the snowcat and sled are boxes (`20`, `21`, `25`); the lantern arm is a tube (`22`). |
| 2 | Environmental uniqueness (lc) | 6.5 | **6.5** | Storms, the storm-cave and the rescue station are Whiteout's own. The cloud sea under the left lip now reads as "high above something" (`01`, `27`, `09`). It reads as a frozen plain or lake, not a ridge drop, and the dev blind reads agree ("most like open water"; 4/10, 5/10). The crest side still looks Alpine: a rocky, tree-dotted slope (`10`). The final reveal (`26`) is a hut on a flat white plain, not a ridge. |
| 3 | Skiing and hazard mechanics (lc) | 7 | **7.5** | Caption, arrow and push now agree in every storm frame (`04` and `05` left/←; `28` and `29` right/→). My stance check: the "stand up out of the tuck" advice never costs an outcome and cuts knocks about 5× on Normal (3 vs 15 Sprint, 14 vs 70 Standard). On Hard, the expert's precise stance is worth +2/13 Sprint wins. W-078 (edge crease) is claimed fixed (481 → 19 crashes); I did not re-run the edge probe. |
| 4 | Difficulty and fairness (lc) | 6.5 | **7** | **Big fix:** every Classic Hard course is won by the expert (Whiteout 20 m / 30 m), reproduced exactly. **But:** Normal Whiteout lost its pressure for the competent reader (F4-1). The Whiteout Hard ladder is inverted: Standard 10/12 is above Sprint 9/12, against the owner's 25–50% < 50–75% (F4-5). Normal and Hard differ by only 3/12 for the expert on Sprint. Fjord: the Classic Hard Sprint margin is 7 m, and the competent skier on Normal Sprint wins 6/12 with Classic lost (outside Whiteout). |
| 5 | Cinematics (lc) | 7 | **7** | **Better:** the opening is decluttered (no storm pill or caption in the first 2.1 s of the strip; RUN. sits below the inset); the landing is in frame (strip frame 15, `yetiAirborne:false` at 2.1 s); the leap has an inset on Low (`strip_low/whiteout_07–15`). **Not fixed:** the leap is still 12–18 px and crosses rock, not sky (F4-2); the set-up shot still shows the skier as a helmet-and-back sliver cut by the letterbox (`strip_high/whiteout_01`, `_02`); the victory beam is missing and the hero beats are broken (F4-3). |
| 6 | Performance and stability (lc) | 7 | **7** | CPU only (SwiftShader): Whiteout `high` p99 9.7 ms, max 23.3 ms, 22 frames over 16 ms and 1,425 over 8 ms in 12 km. Alpine `high`: 4 over 16 ms and 128 over 8 ms. The renderer summary shows 5.46 M triangles against Alpine's 1.82 M (3.0×), and software render time 8.9 s against 4.2 s. If that summary is representative, W-086's "high ≤ 1.5× Alpine" is not met. There is no GPU timing. All 11 browser specs pass, after test-side fixes that are logged. |
| 7 | Accessibility and controls (lc) | 7.5 | **8** | Captions are `aria-live`. There is a vibration toggle. Reduce Camera Motion is read live (code). Reduce Flashes now covers the eye glow. The UI-150% and Reduce Weather captures exist and read (`a11y_ui150/05`, `16`). **Against:** Reduce Weather Effects is unchanged by the developer's own account. On Low there is no image of the Yeti for the whole chase after the leap (`a11y_low/16_storm_chase`: YETI 28 m ▲ CLOSING, no inset). |
| **8** | **Overall player experience (owned)** | **7** | **7.5** | Up for Hard being winnable, a clean opening, a recoverable first crash on the default course, and an image of the leap on every preset. Held below 9 by F4-1 to F4-4. See the verdict above. |

## (b) Findings

### F4-1. Major (categories 4 and 8): the Hard package emptied the Normal chase for a competent weather-reader, and nobody re-measured Whiteout tension
The owner asked for Hard to be fixed through the environment, not the Yeti. The environment changes apply at every difficulty: headwind follows the stance, the 15° slope floor, the crest lee, and drift gaps 14–18 m off the line. On Normal, the result is that a competent player who reads the weather is effectively never chased.

**Evidence: the developer's own like-for-like data.** Same simulator and the same `SLOPPY` driver, "before" against "after" (`w080/data/before_sloppy.jsonl` and `val_sloppy.jsonl`, Whiteout, `informed2NoLee`, Normal, Classic + W4H-01…12):

| Length | Wins before | Wins after | Median min gap before | Median min gap after |
|---|---|---|---|---|
| Sprint | 11/13 | 13/13 | 37.5 m | 41.2 m |
| Standard | 7/13 | 13/13 | 19.9 m | 40.4 m |

**Evidence: my tension run on the frozen tree** (Classic + T4H-01…06, Normal). The skier starts 40–50 m ahead at the hand-off.

| Player | Sprint | Standard |
|---|---|---|
| Competent | caught 0/7; median min gap 41.2 m (the start gap); within 45 m for 1.6 s, the hand-off itself; ▲ CLOSING shown for **0 s** | caught 0/7; min gap 41 m; CLOSING 0 s |
| Clean | min gap 48.2 m; under 45 m for 0 s | min gap 45.3 m; CLOSING 0 s |
| Crash at 5 s | caught 0/7, min 21.2 m | caught 1/7 |
| Poor line | caught 4/7 | caught 2/7 |
| Cautious | caught 7/7 | caught 7/7 |

**Round 3 for comparison.** My `46ed200` run, with the same seeds, gives:
- competent: 2/7 caught (min 20.5 m, CLOSING 13.8 s);
- crash at 5 s: 4/7 caught.

That comparison is confounded by the W-089 simulator fix, so I rest the finding on the like-for-like table above, not on this one.

**The process gap.**
- `w080/data/tension_r4.jsonl` contains Alpine only (588 rows). The Whiteout tension instrument, which round 3 used to sign off "graded risk" for W-076/W-077, was not run on the round-4 rules.
- `CANDIDATE.md` presents the competent reader's 12/12 on Normal as a forgiveness result. The loss of pressure is not mentioned.

**Player impact.** On the default difficulty, a reasonable player who follows the captions sees:
- RUN.;
- a bar that sits amber-to-grey from second 2 to the finish;
- no CLOSING, ever.

The chase *is* the game. On Normal Whiteout it is a two-second scare followed by about 80 s of sightseeing with a number at the top of the screen. The owner's W-077 criteria are still met on paper: a crash costs about 20 m, and poor lines and braking get caught. So this is an experience judgement, not a breach of the ranges. I rate it Major because it removes tension from the most-played configuration of the location, and it slipped through unmeasured.

**Fix direction:**
- Re-run `tension.measure.test.ts` on Whiteout with the round-4 rules and publish it next to round 3's.
- Ask the owner whether a competent reader on Normal should ever see CLOSING.
- If yes, use course-design levers that the constraints allow. For example:
  - a mid-course stretch where the storm line costs time against the crest line;
  - the 320 m fair opening kept, but no long sheltered run after it.
- Do not touch the Yeti, and do not rubber-band.
- If no, record that decision, so that Normal Whiteout is knowingly the "scenic" difficulty.

### F4-2. Major (categories 5, 7 and 8; carried): the antagonist is still a sub-20 px figure in a box, and on Low he disappears after the leap
**Evidence:**
- **In the main view.** The Yeti is never in the main view during play: `inMainView:false` in every gameplay shot of `whiteout/manifest.json`, by the owner's W-076 decision.
- **In the inset, at 1366×768:**
  - in a storm at 28 m (`16`, 4× crop), he is about 15 px tall;
  - at 75 m (`18`), he is a 3–4 px blob.
  - Geometry agrees: a 2.5 m figure at 28 m with a 48° lens in a ~165 px-high inset projects to about 17 px.
- **The leap, despite W-082's claim** ("the arc against the sky"):
  - **Whiteout** (`strip_high/whiteout_09–15`, 2× crops): he crosses dark rock the whole way, about 12–17 px at 960×540;
  - **Alpine** (`alpine_09–15`): a pale figure on pale rock, nearly invisible;
  - **Fjord:** the only one that reads (dark rock, then sky).
- **On Low** (`a11y_low/16_storm_chase`): YETI 28 m ▲ CLOSING with no inset. After the 2–3 s leap beat, `App.ts:872` drops the inset on Low again. Low is opt-in (default `high`, `settings.ts:60`), so that part is minor on its own.

**Player impact:** the series is about being chased by a Yeti. In the evidence, during play he is a number, a bar, a caption ("[heavy footsteps behind you]") and a thumbnail. This was round 1's Critical. It was mitigated to Major by the inset, and it has not moved since.

**Fix direction (presentation only, within W-076):**
- Scale the inset lens with distance so that he projects to at least 40 px whenever he is inside 60 m. A 20° lens at 28 m gives about 42 px.
- Give him a dark rim or outline against the whiteout.
- On Low, keep a cheap inset (a half-resolution render every other frame) or a silhouette marker whenever he is under 40 m.
- Keep the leap arc against sky in every location, or say plainly that it is not.

### F4-3. Major (categories 1, 5 and 8): the victory hero images are still broken, and three fixes claimed in W-083 are not in the frames
The victory is the location's payoff and its most shareable sequence.

| Shot | Note or claim | What the frame shows |
|---|---|---|
| `24_v_yeti_flinch` | "close on the Yeti in the searchlight beam, flinching". W-083: "the beam crosses the frame from the station and lands on him" | **No beam, no light pool and no rim light.** A white Yeti stands in flat fog, mid-stride, mouth open in what reads as a grin. This is the third round in which this beat has no beam. |
| `22_v_lantern` | "the lantern raised… halo + light" | The lantern-raising arm is a **featureless tube with no hand**, and the lantern sits on its end. **The ski pole hangs straight down from the lantern** (the W-083 problem list names "pole in lantern hand"; it is still there). There is no visible halo in this frame. The halo does appear in `25` and `26`. |
| `21_v_welcome` | "…skier arriving" | **No skier in frame.** The doorway is a flat beige rectangle. A sled with a floating yellow plank and two loose poles sit in the foreground. |
| `23_v_yeti_white` | "past the skier and lantern, the Yeti coming in from the white" | **Neither the skier nor the lantern is in frame.** The Yeti is fully lit and unfogged at mid-distance, so he does not "come from the white". |
| `26_v_reveal` | "station, ridge behind, title" | A hut on a flat snow plain under a blue sky. **There is no ridge, and no title is in the capture** (the HUD may be hidden by the harness, so the title is unverified). |

**Fix direction:**
- Put an actual visible beam volume or cone in the searchlight beat, plus a light pool on the snow and a rim light on the fur. Then capture it and judge it by eye.
- Give the skier a hand mesh on the lantern arm, and parent the pole to the other hand or drop it.
- Make the shot notes describe the pixels (see F4-6).

### F4-4. Major (categories 1, 2 and 8; W-065 / W-093 carried, OPEN by the developer's own account): in clear weather the location's premise reads as a glitch and a plain, not a ridge
**Evidence:**
- **The pale sheet.** In `01`, `02`, `03`, `07`, `27` and `rim_1366/classic_sprint_0_clear` and `_1_clear`, a pale, streaked, translucent vertical sheet stands at the vanishing point, exactly where the player looks.
- **The developer's own reading of it.** `dev/art/README.md` identifies it as a blizzard cell's telegraph curtain. It also records that the fresh blind reader took it for "a glitch" / "the most confusing element".
- **The wall over the crest.** A translucent wall with a sawtooth top stands above the crest in the same frames.
- **The drop.** It reads as "a long way above a grey plain". W-065 is OPEN at 4/10 and then 5/10 blind.

**Player impact:**
- In clear weather the player is fastest and the view is widest. This is the frame a reviewer screenshots.
- Under the title "Whiteout Ridge", the clear windows show neither a whiteout nor a legible ridge. They show a wide valley with a fog artefact in the middle.

**Fix direction:**
- Suppress or soften the telegraph curtain while the skier is in a clear window and the cell is beyond about 150 m, or give it a recognisable shape: a low ground-hugging band with streaks, not a tall sheet.
- Fade the sawtooth wall into aerial perspective.
- Show the rim edge from the line: a visible cornice lip or edge band, which W-065 itself lists as still missing.

### F4-5. Minor (category 4): the Whiteout Hard ladder is inverted, and Normal and Hard are close for an expert
**Evidence** (`candidate/balance/expert.jsonl`, held-out):
- The reader wins Hard Standard 10/12 (83%, above the 25–50% range) but Hard Sprint only 9/12. The longer course is the easier one.
- My tension run agrees:

  | Hard | Skilled caught | Median min gap |
  |---|---|---|
  | Sprint | 1/7 | 24 m |
  | Standard | 0/7 | 45 m |

- For the expert, Normal Sprint is 12/12 against Hard 9/12.

**Player impact:** "Standard" is sold as the longer, harder run. On Whiteout Hard it is the safer one.

**Fix direction:** this is an owner call. Either accept it and record it, or look at what the Standard course's later segments give the reader (the crest lee on longer sheltered stretches is the likely cause). I did not test that.

### F4-6. Minor (QA and honesty): the notes still contradict the frames, and one tracker claim contradicts the source
**Notes against frames:**
- The notes for `21`, `23`, `24` and `26` describe content that is not in the frame (F4-3).
- `08` says "the lip curling over the flank"; the frame shows a stepped slab.

W-084's "notes from the images" is therefore not met.

**Representativeness:**
- Every chase-phase shot in `whiteout/` except `16`, `17` and `18` has the Yeti at least 227 m back: 14 shots at 227–276 m, and `19` at 2.6 km.
- My tension run puts a clean Normal player within 110 m for about 56 of 78 s.

So the evidence mostly shows the chase in a state players rarely see. Only `16` and `18` show it as it usually looks.

**Tracker against source:**
- `dev/art/README.md` says "The game's spray is unchanged", and W-065 in `DEFECTS.md` says the same.
- The frozen source changes both the spray and the landing burst, with comments blaming the puff on the game:
  - `src/game/GameSession.ts:636–640`: landing burst `vy`, spread, alpha and life cut;
  - `src/game/GameSession.ts:1111–1112`: spray rate capped `min(intensity, 1.2)·45` instead of `intensity·70`; alpha 0.45 + 0.25 instead of 0.55 + 0.3.

Either the puff was partly the game's, or the change is unexplained. In both cases the statement is wrong.

**W-091:** the frames contradict the claim. `strip_high/whiteout_01` and `_02` still show the skier as a helmet-and-back sliver cut by the bottom letterbox bar.

**Fix direction:** write each note from its frame; correct the spray statement; capture at least three Normal chase frames at typical gaps (40–110 m).

### F4-7. Minor (categories 1 and 5): cave dressing still reads as primitives in the close-ups
**Evidence:**
- **The brow:** in `12`, `13` and `14`, the rime brow is a smooth, uniformly lit white tube, with flat triangular "paper aeroplane" shards hanging beneath it.
- **The rock face:** in `12` it has two horizontal tiling seams (y ≈ 405 and y ≈ 640).

**Status:** W-066 is still marked CLAIMED. This is the setting of the location's two best Yeti close-ups.

**Fix direction:** break up the brow's silhouette with snow-load noise and real icicle cones, and hide the seams.

### F4-8. Positive (verified): what got better
- **Hard is winnable.**
  - **Whiteout Classic Hard:** Sprint won by 20 m and Standard by 30 m. Fjord Hard Standard 36 m, Alpine 53–54 m. I reproduced the Whiteout rows exactly (0 of 78 mismatches).
  - **My tension run:** the skilled driver escapes Classic Hard Sprint (17.3 m) and Hard Standard (52.4 m).
  - This answers my round-3 F2.
- **One crash on Classic Normal is no longer fatal.** Crash at 5 s: escapes with a 21.2 m minimum. Crash at 20 s: escapes with 22.6 m. This answers my round-3 F6.
- **The opening is decluttered.** In the strip, no storm pill or caption appears inside 2.1 s after control (`FRONT_QUIET = 3`, `GameSession.ts:71`). RUN. sits below the inset. This answers my round-3 F5.
- **The leap has an image on Low** (`strip_low/whiteout_07–15`), and the landing is in frame (`whiteout_15`, airborne false at 2.1 s). This partly answers my round-3 F1.
- **The puff over the skier is gone** from `rim_1366/*_clear`.
- **The storm wind is told consistently.** Caption side, HUD arrow and push agree in all four storm frames (W-081).
- **The stance advice is honest.** It never loses an outcome, and it pays on Hard for the precise version.
- **CLOSING is less naggy** (within 60 m only). It shows correctly at 28 m (`16`).
- **Accessibility captures now exist.** UI 150% keeps RUN., the inset and the pills apart (`a11y_ui150/16`).

## (c) What I could not verify
- Motion, timing and comfort at 60 fps; whether a moving eye finds a 15 px Yeti; the reading time of the captions at speed.
- Audio (the RUN. sting, footsteps, landing, distant calls, the storm mix) and rumble.
- GPU frame time. The perf data is CPU-side on SwiftShader.
- W-078's edge-probe result (I did not re-run it) and the browser–simulator parity runs.
- Whether the victory title appears. The captures carry no HUD in the victory frames.
- Human skill. Every balance number comes from model drivers, including mine. A human reads drift flags through fog worse than the reader does, which would put back some of the Normal pressure that F4-1 says is missing. That cuts against F4-1, and only human playtests can settle it.

## (d) What would raise category 8 to 9
1. **F4-1:** the Whiteout tension table re-run on the round-4 rules, and either an owner decision that Normal Whiteout is meant to be pressure-free for a competent reader, or a course-design change that puts back measurable pressure (CLOSING seen, min gap under the start gap) without touching the Yeti.
2. **F4-2:** the Yeti at least 40 px in the inset inside 60 m; a silhouette or inset on Low; the leap readable in Alpine.
3. **F4-3:** a visible searchlight beam, a lantern held by a hand, no pole through it, and every victory note true to its frame.
4. **F4-4:** no telegraph sheet at the vanishing point in clear windows, a visible rim edge, and a blind read that names a ridge.
5. **Human playtests**, even three or four, before any 9 on "player experience". A model cannot award that score on simulations and stills alone. I said the same in round 1.

## Reproduction (my runs)
```
# tension on the frozen tree (src identical to 71c9ceb)
OUT=/tmp/ftens/all.jsonl BIOMES=whiteout SEEDS=CLASSIC,T4H-01,…,T4H-06 LENS=sprint,standard DIFFS=normal,hard \
  npx vitest run --config vitest.sim.config.ts tests/sim/tension.measure.test.ts
# the same, Normal only, on `git archive 46ed200` → /tmp/r3 (OUT=/tmp/ftens/r3.jsonl)
# stance check: copy of HEAD in /tmp/r4 with POLICIES.readNoStance = { lines:'weather', drifts:'gap', blizzard:'ignore' }
OUT=/tmp/ftens/stance_sloppy.jsonl BIOMES=whiteout LENS=sprint,standard DIFFS=normal SEEDS=CLASSIC,W4H:12 \
  POLS_WHITEOUT=informed2NoLee,readNoStance SLOPPY=1 TAG=sloppy npx vitest run --config vitest.sim.config.ts tests/sim/ladder.measure.test.ts
OUT=/tmp/ftens/stance_expert.jsonl … DIFFS=normal,hard POLE=1 FJORD_READ=1 XTUCK=0.3 TAG=expert (same test)
```
