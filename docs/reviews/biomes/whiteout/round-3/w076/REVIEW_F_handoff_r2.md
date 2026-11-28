# W-076 focused review, round 2: Reviewer F (Hostile Critic), hand-off fairness, tension and payoff

- **Reviewer:** F, Hostile Critic. **I am a model-based reviewer, not a human playtester.** I watched nothing in real time. What a player "sees" comes from still frames, the manifest, code and headless simulation.
- **Build:** `pass5-whiteout` @ **00bb240**.
  - `git diff 2d3618c 00bb240` changes `handoffBlend.ts`, `FollowCamera.ts`, `GameSession.ts` (landing beat, RUN. delay, inset suppression), `Hud.ts` (Infinity), `obstacles.ts` (`inLeapView`) and `Input.ts`.
  - `e503677..00bb240` touches only `tests/e2e/whiteout.spec.ts`, so the strip's manifest SHA (e503677) is equivalent for `src`.
- **Examined:**
  - all 72 frames in `round-3/handoff/` against `manifest.json` (camera direction, chase time, Yeti position);
  - Reviewer C's r5 report;
  - `balance/round3-cave/README.md` and `skip-handoff/README.md`.
- **My own runs** (`/tmp/w076f/`, about 1 min of CPU in total):
  - **Trajectories:** the r1 trajectory script re-run on 00bb240 (`skilled`/`cautious` autopilot, Normal and Hard).
  - **Wrong steering:** a sensitivity run of steering errors during the look-back window.
  - **Blind window:** a run of the round-3 `informed2NoLee` Whiteout driver (`tests/sim/whiteoutDriver.ts`) on Classic and W3H-01…24, Normal Sprint. In it the driver cannot read drift rows during the first 3.6 s of each chase, the watched look-back window.
- **Repository:** I modified nothing apart from this file.

## Verdict: **FAIL** (narrowly), in my area

- **The payoff now lands.** It reads clearly in Fjord and Whiteout and weakly in Alpine. The r1 "Infinity" HUD is fixed. F1 is resolved apart from residual polish.
- **The fix creates a new asymmetry between watching and skipping, against the watcher.** For about 3.5 s after control returns, the watched path forces the camera to look back. The player is steering a skier seen from the front, cannot see the slope ahead, and gets "RUN." while still looking backwards. Skippers see forward from the first frame.
- **On Whiteout the first drift row arrives inside that window,** and both the strip and my runs show the watcher ploughing it.
- **The developers do not own this.** They call it "presentation only" and describe the swing as lasting "at least 1.2 s" (`skip-handoff/README.md`). W-076's stated goal is that watching and skipping give the same chase. The state is the same, but what the player can see and act on is not.

## Findings

### N1 (Major): the forced look-back takes away the forward view under control and reintroduces a watch/skip difference, measurable on Whiteout

- **Duration.**
  - `lookBackAt` (`handoffBlend.ts`) holds the look-back at 1 until the landing (2.07 s), plus `landHold` 0.35 s, then releases it over 2.3 s.
  - The manifest's camera `dir.z` (downhill is +z) stays below −0.5 (looking backwards) from about 0.6 s to 3.4 s in Alpine and from 0.3 s to 3.6 s in Whiteout. It turns positive at 3.97 s (Alpine) and 4.2 s (Whiteout).
  - In that time the skier covers 282 → 333 m (Alpine) and 282 → 320 m (Whiteout).
- **Whiteout, what a first-time player sees.**
  - **During the look-back** (`whiteout_04` to `_11`), the caption "[…] ski the flagged gaps in the drifts" and "STORM IN 1–3 s" are on screen while the camera faces the cave.
  - **`whiteout_10`** (1.67 s): the skier is buried in a drift mound, with only the helmet visible, at 38 km/h.
  - **`whiteout_11`** (1.93 s): 28 km/h, against 48–51 km/h at the hand-off.
  - **Caveat:** the strip runs with no input (`autopilot(null)`), so this frame sequence shows a plough, not a choice. But a watcher could not have seen the row, and a skipper could.
- **Measured** (my runs, `informed2NoLee` driver, drift reading off for the first 3.6 s of each chase vs on, Normal Sprint):
  - **W3H:** 24/24 wins in both cases, so **0 outcome flips**.
  - **Speed loss:** on 7 of 24 seeds (06, 08, 12, 14, 15, 16, 19) the watcher's minimum speed in the first 4.6 s falls from 11.6–15.6 m/s to 6.9–14.2 m/s. The Yeti gap at 4.6 s is 2–14 m smaller (W3H-15: 61 → 47 m; W3H-16: 70 → 49 m).
  - **W3H-19:** the minimum gap over the whole run falls from 41.5 m to 23.5 m.
  - **Classic:** −3 m (caught either way, W-056).
  - **So:** the cost is real but did not change any outcome on this set.
- **Steering errors.**
  - **The mapping:** steering is relative to the skier (`GameSession.ts:437`, `this.input.steer = gi.steer`; there is no mapping to the camera). In a camera that faces backwards, left and right are therefore close to mirrored on screen.
  - **The test:** I injected one wrong-way steer of 1 s (from 0.8 s to 1.8 s) into the autopilot during the window, as a model of a player correcting the wrong way.
  - **Results, time to capture (s):**

| Location / driver | Seeing | With the wrong-way steer |
|---|---|---|
| Fjord cautious | 31.5 | 7.3–7.6 |
| Whiteout skilled | 21.9 | 6.6–10.5 |
| Alpine cautious | 43 | 12–14 |
| Alpine skilled | survives | survives |

  - Hands-off for the window (`straight`) costs nothing in any location.
  - This is a model of a plausible human error, not a measurement of human play. It shows that the outcome is sensitive to exactly the input the forced view invites.
- **The obstacle clearing does not cover this.** `inLeapView` (`obstacles.ts:276`) clears trees and rocks only. Reviewer C r5 says the clearing leaves "the first 45 m of each chase … free of route hazards". That is not true of Whiteout drift rows, which are environment hazards that `generateBandSteps` does not touch, as `whiteout_10` shows.
- **"RUN." arrives while the camera still looks back.** The title appears at landing + 0.6 s (2.7 s, `GameSession.ts` `yetiLanded`), and the camera releases only at 2.42–4.72 s. So the prompt to act arrives while the player is looking backwards.
- **Fix direction, any one of these:**
  1. End the look-back by the landing + hold (about 2.4 s). Release in about 1 s, and show "RUN." only once the camera faces downhill.
  2. Keep drift rows (and every Whiteout hazard) out of the look-back distance after a cave trigger, as was done for trees, and state that in the balance README.
  3. Own it: add the numbers above to `skip-handoff/README.md` and DEFECTS, correct "at least 1.2 s" to the real 3.5–4.7 s, and get the product owner to accept the trade-off (Reviewer C's C10 already calls it an owner trade-off; nothing in the docs records that decision).

### N2 (Minor): the payoff now lands, with residuals

**Verified:**
- The landing beat (shake 0.5, a 60-particle burst, a footstep) fires on `airborne → false` in `yetiLanded`, on both paths.
- The rear-view inset is off during the look-back (`rearView` returns 0 while `leapPending || cineBlend`).
- **Fjord:** the Yeti is clearly in mid-air (`fjord_08`, about 25 px, right of the cave) and lands on screen (`fjord_12`).
- **Whiteout:** the landing burst is visible (`whiteout_12`).

**Residuals:**
- **(a) Alpine is still weak:** about 12–15 px of white on white at 53–57 m, and no burst I can distinguish in `alpine_12` or `_13` (agrees with C13).
- **(b) "RUN." still sits on the Yeti, now after the landing:** `fjord_15`–`17`, where the Yeti is under the title; `whiteout_15`; `alpine_15`/`_16`. The code comment says so: "it sits mid-frame, where the look-back puts him". This matters less now that the landing has been seen, but for 1.6 s the threat behind is hidden under the instruction to flee.
- **(c) The skip path shows "RUN." 2.07 s into the chase** (at the landing, `runTitleIn = 0`), not on the first frame. That is acceptable, but it was not stated.

### N3 (Major, product decision, unchanged in code): every player's first chase is much easier than the one shipped players got
- **Unchanged in code.** The Yeti rules and the canonical start are unchanged. My re-run on 00bb240 reproduces r1 to within 0.3 s, and the sight-line clearing moved nothing material.
- **Every first chase is watched.** The first viewing is unskippable (`recordsSeenCave`, persisted), so every shipped player's first chase used the watched hand-off.
- **Time to capture** (chase seconds, Classic Sprint), shipped watched → now:

| Location / driver | Normal | Hard |
|---|---|---|
| Alpine cautious | 10.3 → 43.3 | 7.8 → 22.8 |
| Fjord cautious | 6.0 → 31.5 | 5.3 → 20.4 |
| Whiteout skilled | 4.1 → 21.9 | 3.9 → 14.5 |
| Whiteout cautious | 3.3 → 11.9 | 3.2 → 9.6 |

- **Separation on the first controllable frame:** 6–11 m → 40–61 m.
- **For the product owner:** this is a 3–9× easing of the first chase relative to the shipped game. It is defensible, because it is the start the balance work was tuned on. But it is a difficulty change, and it should be accepted as one.
- **Caveat:** N1 makes the watched path somewhat harder again on Whiteout, by an amount that varies from seed to seed.

### N4 (Major, product decision, unchanged in code): no tension for a competent skier on Alpine and Fjord
**Closest approach of the Yeti for the `skilled` driver** (re-measured on 00bb240):

| Location | Relaxed | Normal | Hard |
|---|---|---|---|
| Alpine | 53.6 m | 53.6 m | 53.6 m |
| Fjord | 38.8 m | 38.8 m | 20.4 m (first < 30 m at 87.7 s) |

- **The early trajectory, Alpine Normal:** 61 → 54 m during the leap, then 64 / 78 / 97 m at 3 / 5 / 10 s.
- **What never happens:** the Yeti never comes within lunge range (13 m), and the "— MOVE!" warning (under 25 m) never shows.
- **Whiteout is the reverse:** under 30 m by 10 s (skilled) or 5.6 s (cautious), and caught at 22 s and 12 s (W-056).
- **For the product owner:** decide whether "a clean skier is never threatened on Alpine/Fjord" is the intended feel. If it is not, retarget the leap so a competent skier gets one early close call (about 20–30 m in the first 5 s). No tension metric has been published to support "fair and tense".

### N5 (Minor): documentation and evidence
- **README out of date:** `skip-handoff/README.md` says the swing lasts "over the leap's flight (at least 1.2 s)". The code holds the look-back for about 2.4 s and releases it over 2.3 s (see N1).
- **Frames not committed:** `round-3/handoff/` (the 72 frames) and C's r5 report are untracked in git at 00bb240 (`git status`), so the evidence is not in the commit.
- **DEFECTS still says "CLAIMED".** The W-076 row has no record of the product decisions behind N3, N4 or C10.
- **W-056 is correctly kept OPEN** and is not credited to this change, in the README, DEFECTS and `round3-cave/README.md`. I verified this.

## What would change my verdict
- **To PASS:** N1 is mitigated (fix 1 or 2), or owned (fix 3, with owner sign-off recorded in DEFECTS).
- **Product decisions, outside a code verdict:** N3 and N4 stand as decisions for the product owner. They would not hold my verdict at FAIL once they are recorded as accepted.
- **Not blocking:** N2 and N5 are polish.
