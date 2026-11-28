# Whiteout Ridge, round 3: Reviewer F (Independent Critic: overall player experience)

- **Role:** Reviewer F. I gate category 8 (overall player experience). My scores in the other categories are low confidence (lc).
- **Nature:** I am a **model reviewer, not a human playtester**. I looked at code, data and still renders. I did not play at frame rate, did not hear the audio, and did not feel controller rumble. Wherever a judgement depends on motion, timing, sound or touch, I say so.
- **Build:** frozen candidate `46ed200`. `git diff 46ed200 HEAD -- src tests` is empty, so later commits only add documents and evidence.
  - The renders record later evidence-only SHAs (`305bf60`, `8bc6fbf`, `f7d4820`).
  - The balance data were taken at `404ed88`. `git diff 404ed88 46ed200 -- src` touches only `cloudSea.ts`, `ridgeRocks.ts`, `scenery.ts` (views) and `styles.css`, so I accept the simulation data for this build.
- **Order of work:** I formed my judgement (sections a–c) before opening `REVIEW_A/B/C/E` for this round. Section (d) was written afterwards. I did not change my scores after reading the other reviews. Where a finding of mine was strengthened by another reviewer's independent measurement, I say so in (d).
- **What I examined:**
  - **Briefs and tracker:** `CANDIDATE.md`, `DEFECTS.md` (W-056 to W-077), `round-2/REVIEW_F_critic.md`, `round-2/CONSOLIDATED.md`, `w076-final/README.md` and my own `w076-final/REVIEW_F_final.md`.
  - **Renders:**
    - `handoff_strip/`: all 14 Whiteout frames, with 3× crops of the inset in `whiteout_09–13`, `alpine_11` and `fjord_11`;
    - `whiteout/`: frames 05, 14, 15, 16, 17, 18 (with a 3× inset crop), 22, 24 and 26, plus every manifest note;
    - `rim_1366/`: the four sprint frames;
    - `rim_1920/classic_sprint_0_clear` (the only frame there).
  - **Balance:** `balance/w077/after_404ed88.jsonl` (all 448 rows, through `tools/tension_summary.py`, plus per-seed gap trajectories for every Whiteout Normal row); `balance/tension/README.md`; `balance/w056/README.md`; and `w056/at_404ed88/classic.jsonl`.
  - **Code:** `src/yeti/presence.ts`; `GameSession.ts` (`yetiLanded`, `rearViewZoom`, `rearView`, `updatePresence`, `updateHud`, the front captions); `Hud.ts` (the Yeti widget and captions); `App.ts` (inset gating and FOV).
  - **Test logs:** `candidate/unit.txt` (489/489), all `candidate/e2e/*.txt`.
- **Not available:** `candidate/perf/` is empty. `rim_1920/` holds one frame.

---

## Verdict: category 8 = **7/10**, FAIL against a target of 9. W-076 focused verdict: **PASS**

Round 3 fixed the three things that made round 2 a 5:
- **The default course can be won.** `CLASSIC-SPR@WHITE` Normal: the reader wins with 44.5 m to spare and the blind driver with 40.7 m (`at_404ed88/classic.jsonl`). Round 2: lost by all 16 policies.
- **The front caption no longer coaches the losing move.** It now reads "ski the flagged gaps in the drifts" (`GameSession.ts:1258`), and drift gaps are the measured winning decision.
- **The storm finally reads as a whiteout in gameplay.**
  - In `05`, `16` and `rim_1366/*_storm`, the horizon has almost dissolved, the light is flat, and the lamps and orange gap flags carry the route.
  - The victory now plays in the storm, and the lantern beat lands (`22`).

The post-cave chase is now fair, and its threat is legible from the HUD and the sound (section b).

Four things keep the location from a 9:
1. Its signature visual moment, the leap, is still a 10–16 px smudge in a small inset (F1).
2. Hard on the default course is a guaranteed loss (F2).
3. The ridge, the location's premise, still does not read from the saddle in clear weather. The first clear-weather view also shows cardboard ranges, a terraced cloud slab, and a white puff over the player's character (F4).
4. The new drop-side roll-down very likely punishes the curiosity it invites (F3, from B's measurement).

## (a) Scores

| # | Category | R2 | R3 | Justification |
|---|---|---|---|---|
| 1 | Visual art direction (lc) | 6 | **6.5** | **Up:** storm frames are flat and white, the horizon is mostly lost (`05`, `16`, `rim_1366/*_storm`), and the station, lantern and Yeti close-ups (`14`, `22`, `24`) are the best images in the location. **Against:** in the clear rim frames, sawtooth ranges (W-004, still OPEN), a stair-stepped slate cloud slab on the left, and a translucent "wave" sheet over the course (`rim_1366/classic_sprint_1_clear`, x 450–760, y 270–420); a white puff hides the skier (`classic_sprint_0_clear`, 1366 and 1920); origami rime (`14`); a flat blue cut-out range (`26`, top right). |
| 2 | Environmental uniqueness (lc) | 6 | **6.5** | Storms, the storm-cave close-ups and the rescue station are Whiteout's own. The drop now shows as a cloud deck beyond the left lip in 2 of the 4 clear sprint frames, but it reads as a lower plain, not a void. It is gone in every storm frame. Trees still dress a "bare ridge" (`15`, handoff frames). |
| 3 | Skiing and hazard mechanics (lc) | 6 | **7** | Drift gaps and the storm line pay, the clip cost is fixed, and warnings come in time (developer data, reproduced by B). The blizzard stance is worth ±0. B's edge crease (F3) is a new risk. |
| 4 | Difficulty and fairness (lc) | 4 | **6.5** | Normal is fixed on the default course and on held-out seeds (reader 24/24 Sprint on both sets; Standard 12/12 and 10/12). But Classic Hard Sprint is lost by every policy (F2). On the default course on Normal, one crash at any point means capture (F6). Hard Standard is 0/12. |
| 5 | Cinematics (lc) | 6 | **7** | The hand-off is continuous, faces the run, and is identical watched or skipped. The victory middle act reads (`22`). The leap is barely visible (F1). The searchlight and flinch beat still doesn't read (`24`: flat light, arms down). |
| 6 | Performance and stability (lc) | 7 | **7** | Unverified: `candidate/perf/` is empty. All 11 browser specs pass. `game.spec` failed once under CPU load and passed when run alone. I carry the round-2 score. |
| 7 | Accessibility and controls (lc) | 7 | **7.5** | Reduce Camera Motion gives a hold and a cut. The landing gets a caption and rumble. The pill contrast is fixed. Against: the leap has no image on Low quality or with the inset off. The distant-call caption is dropped whenever any caption is up. RUN. sits under the inset. |
| **8** | **Overall player experience (owned)** | **5** | **7** | A first Whiteout run on the default settings is now a fair, winnable, atmospheric chase with a good ending. It still has weak images exactly where the location should be strongest: the leap, the ridge, and the clear-weather vista. Hard is closed on the default course, and on Normal a single crash on the default course is fatal. |

## (b) W-076 focused verdict on this build: **PASS**

The owner's question: with the decisions taken (forward camera at control, no automatic look-back, the same camera watched or skipped, the canonical start, tension through presentation rather than rubber-banding), does the post-cave chase feel tense and fair from the player's seat, and is the Yeti threat legible?

### Fair: yes
- **The hand-off frames face the run.** In `whiteout_06`, the letterbox is open and the view looks down the course, with the orange gap flags and wands readable. In `whiteout_07–13` the yaw holds (C measured ≤ 1.2° per 0.27 s).
- **Watched and skipped are the same chase.** `cave_skip.txt` passes 6/6 on a `dist` built from `46ed200`, and B and E independently traced a single code path.
- **The opening is fair on Whiteout.** By W-056 rule 2, the first 320 m of every chase has no blizzard cell reaching it, and drift rows there keep their gap on the line.
- **The start gap is fair.** A clean reader's gap trajectory on the default course (seconds 0–4 of the chase) is 49 → 44 → 67 m (`after_404ed88.jsonl`, `CLASSIC`/sprint/normal/skilled). Over the next 10 s the clean player pulls away to 85 m.
- **No hidden catch-up was added.** Whiteout's `encounterPace` is pinned at 1. The presence cues only read the gap (`presence.ts`); they write nothing to the AI.

### Tense: yes on Whiteout, steeper than Fjord
**The first two seconds stack threat cues** (`whiteout_07–13`):
- **RUN.** appears with its sting.
- **The bar** goes red as the number counts 50 → 40 m.
- **The inset** reads "BEHIND YOU".
- **The landing** brings a thud, rumble, shake, and the caption "[a heavy landing behind you]". Code only: the landing is in no frame, and I could not hear or feel it.

**After that, the chase grades mistakes, measured on the weather reader (median over Classic plus 6 held-out seeds, Normal):**

| Player | Sprint: caught · min gap | Standard: caught · min gap | Fjord Sprint, for reference |
|---|---|---|---|
| clean | 0/7 · 44.5 m | 0/7 · 43.3 m | 0/7 · 45.4 m |
| sloppy (speed scrub) | 2/7 · 20.5 m | 1/7 · 40.1 m | 1/7 · 41.0 m |
| crash at 5 s | 4/7 · 2.8 m | 2/7 · 16.0 m | 3/7 · 3.7 m |
| crash at 20 s | 4/7 · 3.1 m | 2/7 · 30.1 m | 2/7 · 26.2 m |
| poor line | 6/7 | 4/7 | 6/7 |

- This meets the owner's "graded risk": a clean expert escapes; a mistake costs real ground, and recovery is possible in a minority to a half of cases.
- Whiteout Sprint is noticeably less forgiving than Fjord. That suits the third location on Normal, but see F6 for the default course.
- **The clean reader is not left alone.**
  - The Yeti is within the inset's 110 m range for 71 s of a 90 s Sprint chase.
  - On the default course he closes from 85 to 57 m around 20–30 s in, with ▲ CLOSING shown for 21.5 s of that run.
  - "Out of sight" calls are rare on Whiteout (0–4 per chase), because he rarely drops back that far.

### Legible: yes through the HUD and sound; weakly as an image
- **The number, bar, colour states and captions** always tell the player where he is and whether the gap is shrinking.
  - The amber/red split (`Hud.ts:393-394`, red only below 40 m) answers my earlier F7.
- **The Yeti himself, as a figure, is barely there:**
  - In the inset he is clear only while in front of the dark cave mouth (`whiteout_07–09`, chase 0.07–0.6 s).
  - From 0.87 s on he is a pale grey 8–12 px shape against grey rock (`whiteout_11`/`13`, 3× crops).
  - In a storm at 74 m he is a ~5 px white dot (`18`, inset crop). At 117 m (`17`) he is effectively invisible.
  - The storm's eye glow (W-009) is in no frame.
  - On the Whiteout theme, losing him in the white is defensible. Losing the leap is not (F1).

### Why PASS and not FAIL
- Every owner decision is met, and the chase is fair and graded on Whiteout.
- What remains is how the leap looks (F1), a cinematic-quality problem with presentation-only fixes. It is not a problem of fairness or tension.
- **Outside Whiteout, recorded but not part of this verdict:** Alpine Standard's late crash still leaves a 46 m minimum (W-077, tracked), and B's B3-3 (Alpine Hard Standard 0/12 since W-077) needs an owner decision.

## (c) Findings

### F1. Major (categories 5, 7, 8; W-076 presentation): the leap, the chase's signature beat, is still a smudge, the landing is unevidenced, and Low quality shows nothing
**Evidence:**
- **This round's fix** (my `w076-final` F2): the inset narrows to 22° while `leapPending` (`GameSession.ts:394-399`, `App.ts:876-877`). That helps in `whiteout_07–09`, where he is a readable pale figure against the dark mouth.
- **From `whiteout_10`** (0.87 s) to `_13` (1.67 s), he crosses grey rock and ends beside a bright slope, as a 3× crop shows (`/tmp/rf/whiteout_11_inset.png`, `_13_inset.png`). He is about 8–12 px tall in a 288×118 inset at 960×540, low in contrast.
- **The leap is in no main-camera frame.** `whiteout/15_cave_leap.png` ("The leap (15.2 s)") shows the skier and no Yeti.
- **The strip ends while he is still in the air** (`yetiAirborne: true` at 1.67 s), so the landing has no image anywhere on this build.
- **The inset is never drawn on Low quality or with Rear View off** (`App.ts:855`). Those players get the landing sound, rumble and caption, but no image of the leap at all.

**Player impact:** the cinematic sets up a leap and then turns away. On Whiteout, the payoff is a blur in a box at the top of the screen, while RUN., a storm caption and a countdown chip compete for attention (F5). The tension survives through the HUD; the spectacle does not.

**Fix (presentation only; no chase time):**
- While `leapPending`, offset the inset camera sideways to the leap so the arc crosses the box (as C proposes).
- Add a dark rim or outline to the Yeti during the flight.
- On Low quality or with the inset off, force the inset on for the leap only (about 2.5 s), or caption the launch.
- Extend `handoff_strip` to chase t ≈ 3 s, so the touchdown and the 22° → 48° ease-out are evidenced. Add a check that the projected Yeti height in the inset is at least 20 px during the flight.

### F2. Major (categories 4, 8): Hard on the default course cannot be won, and Whiteout Hard Sprint beats even a clean expert most of the time
**Evidence:**
- **Default course.** `CLASSIC-SPR-H@WHITE`: all five policies are caught at 76–83 s of course time, including the reader with 0 crashes, 0 knocks and 0 snowball hits (`at_404ed88/classic.jsonl`).
- **First chase, held-out seeds.** Whiteout Hard Sprint, clean reader: **5/7 caught**, median minimum gap 2.8 m. Fjord: 1/7, minimum 25.7 m. Alpine: 1/7, minimum 34.1 m. The Classic seed is caught at 51.1 s (`after_404ed88.jsonl`).
- **Full courses.** Hard Sprint, reader: 9/24 on both held-out sets (`w056/README.md`). Hard Standard: 0/12.

**Player impact:**
- A player who finished Normal and picks Hard on the course they know loses whatever they do.
- That is the same "no decision can change it" failure that made W-056 Critical, moved one difficulty up.
- Hard should be hard. On Alpine and Fjord, the clean expert's Hard Sprint is a close escape, not a likely loss.

**Fix:** as B3-4. Apply a general, pace-neutral rule: for example, a longer fair opening on Hard, or a headwind relief on the storm line. Gate Classic Hard Sprint on the reader winning, with a gap of at least 5 m. Or record the owner's explicit acceptance of Hard Whiteout being a loss on the default course.

### F3. Major (categories 3, 8; not independently verified, from B3-1): the W-065 roll-down punishes the curiosity it was built to invite
**Evidence:**
- B's edge probe (1,422 cases on old and new terrain) finds crashes for a skier who strays past the drop-side piste edge and steers back rising from 10.8% to 33.8%. Most are "sideways landing" back on the piste.
- B also finds that the balance drivers never come within 5.7 m of that edge, so no measurement in the candidate could see this.
- I did not re-run the probe. I checked that the mechanism B describes (the cross-section holding its rising edge value, then rolling 2 m down) matches the W-065 tracker text.

**Player impact:**
- W-065 exists to make the player notice the drop. A player who drifts toward it to look, or is gusted toward it, now meets an unexpected launch.
- In a chase, a crash is very often a capture (F6). From the player's seat this reads as "the ridge threw me", which is unfair.

**Fix:** as B3-1. Make the edge C¹ (no slope break), and add the regression test (slope break and edge-probe crash count no worse than the old bank).

### F4. Major (categories 1, 2, 7, 8): the clear-weather ridge view is the location's weakest image, and the player's character can vanish in it
**Evidence (default course, gameplay camera):**
- **The puff:** `rim_1366/classic_sprint_0_clear` and `rim_1920/classic_sprint_0_clear`. A large white additive puff covers the skier (1366: x ≈ 570–770, y 400–530), with a pale smear rising from it toward the horizon.
- **The "wave" sheet:** `rim_1366/classic_sprint_1_clear`. A translucent white sheet stands across the course from sky to ground (x 450–760, y 270–420).
- **Sawtooth ranges:** in all clear frames, pale flat ranges with sawtooth tops fill the upper third (W-004, OPEN since the baseline).
- **The cloud deck:** a slate slab with stair-stepped edges (`0_clear`, x 140–660, y 280–340). It reads as a frozen lake.
- **Other places:** `26` (the victory reveal) has a flat blue cut-out shape at the top right (x 990–1366, y 0–70) and the grey snow "pucks" at the hut.

**Player impact:**
- In clear weather the player is fast and the view is wide, so a journalist will screenshot exactly this.
- The ridge, the location's premise, is still inferred rather than seen (A's blind test: 0 of 8 frames recognised immediately).
- A puff that hides the character is also a readability fault: the player cannot see their own stance at the moment the drop is in view.

**Fix:**
- **The puff:** cap its screen coverage and opacity near the camera–skier line, or draw the skier over the spray.
- **The ranges (W-004):** aerial-perspective shading and soft tops.
- **The deck:** a soft depth fade, plus a dark gulf beyond the lip (A F1–F3).
- **The sheet:** remove it in clear weather, or break it up with noise.

### F5. Minor (categories 5, 7, 8): on the default course the chase opens under an arriving storm, and the first three seconds are crowded
**Evidence:**
- **What is on screen.** `whiteout_07–13` (Classic Sprint, Normal), on the first controllable frame:
  - RUN. (top centre, 1.6 s);
  - the "BEHIND YOU" inset directly above it;
  - the "STORM IN 3 s ←" chip counting down;
  - the 82-character caption "[a storm front rolls in — the wind pushes you left; ski the flagged gaps in the drifts]".
- **About 2 s later** the landing caption takes the second caption line (`GameSession.ts:384`, the hard line), and the front arrives at about 3 s.
- **Old pattern, new opening.** This is round 2's N1 pattern (the first chase meets the first front). The W-056 opening rule removes the unfairness, but not the overload.

**Player impact:** on their first Whiteout chase, the player is asked to find a 10 px Yeti, read two captions and a countdown, and make a weather decision, all in the same 3 s. Some of that is good drama. Reading time at speed is beyond what a model can judge.

**Fix:**
- Hold the front caption until RUN. fades (1.6 s), or let no front *build* in the first ~3 s of a chase. That is a time-based extension of W-056's fair opening; it changes no physics.
- Move RUN. below the inset (C R3-C4).

### F6. Minor (categories 4, 8): on the default course, Normal, one crash anywhere in the chase is a capture
**Evidence:** `after_404ed88.jsonl`, `CLASSIC`, Whiteout Sprint Normal, reader base:

| Player | Result |
|---|---|
| crash at 5 s | caught at 23 s (gap at crash 71.8 m) |
| crash at 20 s | caught at 29.7 s (gap at crash 75.4 m) |
| competent (speed scrub) | caught at 71.6 s |
| clean | escapes with 44.5 m |

- On held-out seeds there is room to recover (3/7 recover from each crash), but not on the course a new player plays first.
- The "clean" driver is also a model that reads drift gaps 60 m ahead without error.

**Player impact:** the default first Whiteout run now rewards a clean run, a real improvement on round 2. But it tolerates no crash, so a newcomer's first Whiteout loss will usually trace back to a single error 20 s into the chase.

**Fix (no rubber-banding):**
- Measure a fog-limited reader with reaction noise (a "human-like" driver) on Classic.
- Set a course-design target: on the default course, Normal, a single crash 20 s into the chase is recoverable.
- If it is not, look at what follows the 320 m opening on Classic (for example a second fair stretch), not at the Yeti.

### F7. Minor (QA, evidence): manifest notes still describe frames that aren't there, and the close storm chase has never been captured
**Evidence:**

| Shot | Note claims | Frame shows |
|---|---|---|
| `16` | "the Yeti 18–34 m behind, rear view" | **YETI 117 m** and no inset (C: `run.log` records `gap false`) |
| `15` | "The leap (15.2 s)" | No Yeti: the frame is mid-swing |
| `17` | "the Yeti silhouette" | Nothing resolvable at gameplay scale |
| `24` | "in the searchlight beam, flinching" | No beam, arms hanging |

Further gaps:
- Over three rounds, no frame has shown the Yeti inside 40 m in a storm (round-2 N5 asked for exactly this).
- The `whiteout/` set is still on a custom seed (`SEED-3403625622`), not the default course. The hand-off strip and rim frames are on Classic, which partly answers this.
- `candidate/perf/` is empty, though `CANDIDATE.md` lists it.

**Fix:**
- Fix the harness's close-gap set-up.
- Write each note from its frame.
- Capture a storm chase at about 30 m and the landing on Classic.
- Publish the perf runs or remove the claim.

### F8. Minor (categories 7, 8): presence cues have rough edges
**Evidence:**
- **CLOSING on a clean run.** On the default course, ▲ CLOSING shows for 21.5 s of a clean reader's run that never comes inside 44.5 m. It is amber, so it is not blame, but it is long.
- **Dropped call captions.** The distant-call caption is written only when no caption is on screen (`GameSession.ts:1281`). Whiteout's storm, blizzard and drift captions are frequent, so a deaf or hard-of-hearing player is more likely to miss the call there. The sound still plays.

**Fix:**
- Queue the call caption on the Yeti line rather than dropping it.
- Consider showing CLOSING only when the projected time to catch is short (my earlier F7 suggestion).

### F9. Positive: what is genuinely better (verified)
- **W-056:** the default course is won on Normal. I recounted the `classic.jsonl` rows, and B reproduced them exactly.
- **W-057:** the caption coaches the gaps that win.
- **The storm reads as a storm** from the gameplay camera, and the Hard snowball's beam and ring read clearly through it (`18`).
- **The hand-off is clean, forward-facing and fair.** Watched and skipped are identical.
- **The victory's middle act now plays:** the skier stops at the porch, the rescuers wave, and the lantern is raised (`22`).
- **Candidate integrity:** the candidate is frozen and labelled truthfully. All tests pass, and the one contended failure is published.

## (d) Agreement and disagreement with the other round-3 reviewers

**Reviewer A (art, categories 1 and 2: 6 and 6; W-065 FAIL)**
- **Agree** with W-065 FAIL and with F1–F3 and F6–F8.
  - I independently found the same puff over the skier, the stepped deck, the wave sheet and the sawtooth ranges, before reading A.
  - A's pixel samples showing that the deck shares the piste's value explain why I read it as "a lake".
- **Score difference:** I give 6.5 and 6.5 against A's 6 and 6.
  - A had none of the `whiteout/` renders. The storm, cave close-ups and victory frames I saw are clearly better than round 2.
  - On A's own ground (the rim), I defer: the ridge is not "immediately recognizable".

**Reviewer B (physics, categories 3 and 4: 7 and 7; W-076 PASS)**
- **Agree** with B3-4 (Classic Hard Sprint closed). It is my F2, reached independently from the tension rows. B adds the decisive detail: the reader's mean speed is 15.1 m/s against the Hard Yeti's 17.7.
- **Agree** with B3-1 as a Major, and adopt it as F3 for the player-experience consequence. I could not verify it myself.
- **Agree** with B3-3. It is outside Whiteout but belongs in the owner's decision log.
- **Partial disagreement on category 4:** I give 6.5, not 7.
  - B weighs Normal fairness heavily, and rightly so.
  - I also weigh the default-course Normal experience, where one crash means capture (F6). That is a different question from "is it winnable".
- **Agree** with B3-5: the stance's caption is comfort advice, not a winning move, and the tracker should say so.

**Reviewer C (cinematics, category 5: 7; W-076 PASS, hand-off 9, leap 5.5)**
- **Agree almost entirely.**
  - R3-C1 is my F1, reached from the same crops.
  - R3-C3 is my F5.
  - R3-C4 and R3-C5 match my category-7 deductions.
- **Agree** with C's addendum that `24` still shows no beam and no recoil, and that `16`'s note is false (my F7).
- **I would raise R3-C3 above C's framing** ("attention, not fairness"). For a first-time player it is the first three seconds of the location's chase, and it happens on the default course, not on an unlucky seed.

**Reviewer E (QA and accessibility, category 7: 8; W-076 PASS)**
- **Agree** with E's W-076 PASS and the controls analysis.
- **Agree** with F1: the wrong-side blizzard caption about 9% of the time is the most player-facing open accessibility defect. B3-6 confirms it independently (13% of cell cycles).
- **Score difference:** I give 7.5 against E's 8.
  - E did not have the strip. In it, the leap has no image for Low-quality or inset-off players (C R3-C5), and RUN. crowds the inset.
  - Neither is a Major, but both sit on the beat W-076 is about.
- E's E-observation that "seen" is one flag across locations matters for the player: a player who has seen Alpine's cave can skip Whiteout's different storm-cave cinematic on its first showing. I agree the owner should confirm this.

**Where all five of us converge:** W-076 PASS; no category at 9; the leap's legibility, Hard on the default course, and the ridge's readability are the remaining work. **None of us played the game.** Every judgement of feel here is inferred.

## (e) What I could not verify
- **Motion and timing:** whether the swing is comfortable at 60 fps; whether the inset's ~10 px Yeti is findable by a moving eye; how long the hand-off captions take to read at speed.
- **Audio and haptics:** the RUN. sting, the landing impact layer and rumble, the distant calls, and storm loudness on this build.
- **The landing as an image, and the 22° → 48° inset ease-out:** no frame covers them.
- **B3-1, the edge crease:** I took B's probe results on trust, having checked the mechanism against the tracker text only.
- **Performance:** `candidate/perf/` is empty, and there is no GPU timing (SwiftShader).
- **The cause of the white puff over the skier** (spray, plume or landing burst): seen in two frames of the same shot at two resolutions, not isolated.
- **Human skill:** every balance number comes from model drivers. A human may find lines on Classic Hard Sprint that the reader does not (F2), and will certainly crash more often than the drivers do (F6).
- **Reduce Camera Motion, Reduce Weather Effects and UI 150%** on this build: no captures.

## What would raise category 8 to 9
1. **F1:** the leap readable in the inset (at least 20 px, in contrast, the arc crossing the frame), with an image or caption on Low quality, and the landing captured.
2. **F2:** Classic Hard Sprint won by the reader, or the owner's acceptance recorded.
3. **F3:** the drop-side edge made smooth, with the regression test.
4. **F4:** in the default-course clear frames, no puff over the skier, no wave sheet, shaded ranges, and a deck that reads as cloud over a void.
5. **F5 and F6:**
   - no front builds during the chase's first ~3 s, or RUN. and the front caption are sequenced;
   - a single crash 20 s into the chase is recoverable on the default course on Normal, measured with a fog-limited, noisy driver.
6. **F7:** a storm-chase frame on Classic with the Yeti inside 40 m, notes written from the frames, and the perf data published.
