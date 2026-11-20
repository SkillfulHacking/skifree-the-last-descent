# W-076 final hand-off — Review F (Hostile Critic)

**Build reviewed:** `pass5-whiteout` HEAD `09322b3`. `git diff f915a77 HEAD -- src tests tools` is empty, so every
measurement at `f915a77` describes HEAD. Since `872ac4d` the camera code has changed only by the review-B snap fix
(`FollowCamera.snap` sets `lookBackS`).
**Reviewer:** model reviewer, not a human playtester. I judged motion from 0.27 s renderer strips and from the
numbers. I did not see the game running at frame rate and did not hear the audio. Where a judgement depends on feel
or sound, the finding says so.

## Verdict: **FAIL** (for closing W-076 as a whole)

| Area | Score | Result |
|---|---|---|
| Hand-off camera (decision 1) | **7/10** | Meets the owner's acceptance test. The leap and landing are now weak beats (F2, F3). |
| Chase tension (decision 3) | **4/10** | Not met on Alpine Normal, which the team admits. Also not met on Whiteout Standard Normal, which the team does not admit (F5). The Whiteout evidence uses the wrong driver (F6). |

Decisions 1 and 2 can be accepted. Decision 3 cannot. As long as decision 3 fails on the default location, W-076 should
not be marked CLAIMED as complete. Split it: close decisions 1 and 2, and keep decision 3 open under W-077 with a
wider scope (see F5).

## What I verified myself
- `npx vitest run tests/unit/handoff_camera.test.ts tests/unit/presence.test.ts tests/unit/cave_handoff.test.ts`:
  32/32 pass.
- Tension rerun on HEAD (`OUT=/tmp/revF/t.jsonl BIOMES=alpine,whiteout DIFFS=normal BEHAVIOURS=skilled,crash`): the
  rows match `at_f915a77.jsonl` exactly.
- My own probe (`/tmp/revF/probe/slope.measure.test.ts`, run headless with the real `simulateCourse`) logs the gap,
  the Yeti's speed and the skier's speed every 5 s for the skilled driver on each location. It is used in F4 and F5.
- `e2e_cave_skip_final.txt` (dist built from `e10dfcc`, src clean): 6/6 passed. I launched no browsers.
- I measured camera yaw, pitch, FOV and the Yeti's bearing per frame from `strip/manifest_*.json`. Note:
  `manifest_fjord.json` also holds `whiteout_00..06`, because the manifest is shared and appended. Whiteout PNGs exist
  only in `/tmp/strip_d3b/whiteout_00..06` (cinematic only). `/tmp/strip_wo/` was empty, so **no Whiteout chase frames
  were available**.

### Camera per frame (from the manifests)
| frame | t | yaw ° | Δyaw per 0.267 s | pitch ° | fov |
|---|---|---|---|---|---|
| alpine_03 | 14.83 | 107.2 | −5.8 | 10.6 | 45.8 |
| alpine_04 | 15.10 | 70.1 | **−37.1** | 8.2 | 50.7 |
| alpine_05 | 15.37 | 20.9 | **−49.2** | 2.3 | 57.5 |
| alpine_06 | 15.63 | −14.8 | −35.7 | −7.0 | 62.8 |
| alpine_07 | chase 0.07 | −21.8 | −7.0 | −10.2 | 64.5 |
| alpine_08..11 | chase 0.33–1.13 | −21.8 … −21.7 | ≤ 0.1 | −10.5 … −12.6 | 65–67 |

Fjord has the same shape: peak 44.9° per 0.267 s, then −1.4° held from fjord_07 on. Whiteout's peak is 39.2°.
There is no discontinuity at the hand-off (7° between the last cinematic frame and the first chase frame). The view
holds still afterwards.

---

## Findings

### F1 — Pass, with evidence: the route is visible on the first controllable frame
**Evidence:**
- `alpine_07` and `fjord_07` show the follow camera behind the skier, pitched −9° to −10°, with the open run, the
  valley and the tree lines in view.
- The yaw is unchanged for the next 1.1 s.
- `whiteout_05`/`06` show the swing landing on the storm view, with the orange route poles readable.
- In code, nothing turns the view round by itself: `GameSession.ts:359` sets `lookBack` only from input, and
  `finishCave` (`:760`) clears it.
- The unit test asserts that the route 30 m ahead is within 25° of the view. The e2e test asserts the same over 2 s on
  three locations, including Reduce Camera Motion.

**Verdict:** the owner's acceptance test is met for Alpine and Fjord, and for Whiteout as far as the cinematic frames
go. It is not shown for a Whiteout chase frame.

### F2 — Major: the leap, the chase's signature beat, is illegible on Alpine and invisible on Low quality
**Evidence:**
- `rearView` (`GameSession.ts:386-403`) aims a 48° camera (`App.ts:849`) at a Yeti 50–56 m away. The Yeti is about
  2.5 m tall, so he is about 8 px high in a 288×120 inset at 960×540.
- Alpine Yeti: white, on a snow-and-limestone background. Enlarged insets of `alpine_07..11` (`/tmp/revF/insets.png`,
  `centre.png`): the Yeti is a faint smudge at the cave mouth in `_07` and **cannot be found in `_08`–`_11`**, which is
  the whole flight.
- Fjord works only because the cave rock is dark: the Yeti is readable in `fjord_07`–`_09`.
- The inset is never drawn on Low quality (`App.ts:855`, `quality !== 'low'`) or when the player has switched it off.
  For those players the leap has no image at all.
- The cinematic itself shows the Yeti standing still for 0.5 s (14.2–14.7) and then turns away before he jumps.

**Player impact:** the setup promises a leap and never pays it off on screen. On Alpine, the first location most players
see, the transition from cinematic to chase loses its payoff. "BEHIND YOU" frames an empty cave.

**Fix (presentation only):**
- While `leapPending`, and for about 1 s after the landing, narrow `rearCam.fov` to about 20–24° so the Yeti is about
  20 px or more high.
- Light him with the existing `yetiRim` light or a dark outline so he reads against snow.
- On Low quality or with the inset off, show a short (1.5 s) "BEHIND YOU" glance in the inset for the leap only, or at
  minimum a directional caption: "[the Yeti leaps from the ledge]".
- Add a strip check: the Yeti's projected height in the inset is at least N px during the flight, on all three
  locations.

### F3 — Major (based on computation; I could not listen): the landing "thud" is a quiet, distant footstep
**Evidence:**
- The flight takes about 2.2 s (`spawn.ts`: vUp 5.5, drop about 12 m on Alpine).
- At touchdown the gap is about 54 m (probe: `t2 gap54`).
- `yetiLanded` (`GameSession.ts:373-379`) plays `playYetiFootstep(p, 1)`. This is the ordinary footstep, through an
  inverse-distance panner with refDistance 10 (`sfx.ts:434`, `graph.ts:262-269`), so its gain is about 10/54 ≈ 0.19
  (−15 dB).
- The camera shake is a fixed 0.5 trauma, which gives 0.25 × shake scale, and 0 with Reduce Camera Motion.
- Mechanically he then stands for 0.6 s (`startDelay`; probe `des0.0` at t = 2 s) and the gap grows to about 78 m by
  t = 5 s.
- So "RUN." plays over the period when the player is safest and the gap is growing.

**Player impact:** the landing is the moment that should say "he's on the slope now". On this evidence it is softer
than a nearby footstep, and Reduce Camera Motion players get only that sound.

**Fix:**
- Give the landing its own non-attenuated layer: a low boom on the dry bus, as `yetiGrowl` already does for
  `distant`.
- Add a pad rumble (the `rumble` hook exists).
- Add a short caption, "[THUD — he's down]".
- If thudding while he stands still feels flat, follow the landing with a roar or growl during the 0.6 s stand.

### F4 — Minor (I judged feel from stills only): the swing peaks near whip-pan speed, around a subject that is off-screen when it starts
**Evidence:**
- The total turn is about 122° in 1.1 s with ease-in-out. Peak strip steps are 37–49° per 0.267 s, about 185°/s
  averaged over that window. The unit cap allows 3.6° per 60 fps frame (216°/s), and the e2e allows 7.2° per 30 fps
  frame.
- The "over the skier's shoulder" hold does not contain the skier: `alpine_01`/`02`, `fjord_01`/`02` and
  `whiteout_01`/`02` show only the cave and the Yeti.
- The skier, who is the orbit pivot, enters at the bottom edge only at 14.83 to 15.10, half cut off (`alpine_03`/`04`,
  `fjord_03`/`04`, `whiteout_03`/`04`).
- The unit test's "skier in frame" check (`handoff_camera.test.ts:110`, angle < 32°) cannot catch this. At FOV 44–51
  the half-vertical FOV is 22–25°, and less inside the letterbox, so 32° allows a fully off-screen skier.

**Player impact:** for about the first 0.3 s the swing turns around nothing visible. That is the part of an orbit
most likely to read as a whip. The orbit is smooth and ends cleanly, so this is not a snap, but it is the least
comfortable moment of the hand-off.

**Fix:**
- Frame the skier in the 14.2–14.7 hold: lower and push `leapCam` so the shoulder sits in the lower third.
- Tighten the test to "skier's head inside the letterboxed frustum" using the shot's actual FOV and aspect.
- Optionally lengthen the swing to about 1.5 s (`CAVE_TURN_AT` 14.3). This adds no time after control returns, and
  decision 2's state is unaffected because the skier is frozen during the cinematic (`z` constant in the manifests).

### F5 — Major: decision 3 fails on Alpine Normal *and* on Whiteout Standard Normal; W-077's scope and the tension README understate it
**Evidence** (`balance/tension/at_f915a77.jsonl`; I reran the Alpine and Whiteout rows):

| Course, Normal | skilled min gap | competent | crash at 5 s | crash at 20 s (min after) | poorRoute | Fjord equivalent |
|---|---|---|---|---|---|---|
| Alpine Sprint | 53.6 (= start) | 50.6 (= start) | 27.5 | 78.4 | 49 (= start) | competent 15, crash 18.2, poorRoute caught |
| Alpine Standard | 53.2 (= start) | 48.9 (= start) | 44.9 | 77.6 | caught at 42 s | |
| **Whiteout Standard** | 50.4 (= start) | **47.2 (= start)** | 25.2 | **75.3** | **43.3 (= start), 0.7 s < 45 m** | competent caught, crash 9.6, poorRoute caught |

- The README says Whiteout "Standard is graded like Fjord". That is false on Normal: a sloppy run, a late crash and a
  wandering line never bring the Yeti closer than the start gap. Whiteout Standard Normal behaves like Alpine.
- On Hard, Alpine still forgives a crash at 20 s (min 53.6) and a crash at 5 s on Standard (34.1 m).
- The mechanism, from my probe: the skilled skier on Alpine runs at 20–28 m/s, while the Yeti's own pace is 16.5 m/s.
  The existing catch-up term (`YetiAI.ts:236`, `pressure`, pre-existing) holds him at a **steady 115–170 m** (probe:
  `t15 gap113` through `t70 gap121` Sprint; up to 170 m Standard). That is past the 110 m limit for the inset and the
  chase music.
- The gentle-ground cap (`slope < 12`) is not the cause: the Yeti spends only 3% of the Alpine chase on such ground.
- A crash 20 s in costs about 50 m out of a 125 m buffer, so it is invisible in outcome terms.

**Is leaving Alpine unchanged defensible?**
- *Procedurally, yes.* The owner asked for presentation first and evidence-led, scoped AI changes, and the team logged
  W-077 instead of tuning in a hurry.
- *As a claim that decision 3 is satisfied, no.* The acceptance sentence "poor decisions and recoverable mistakes
  should create pressure, and the Yeti should not feel like irrelevant scenery" is not met on the default location.
  For about 80% of an Alpine chase the Yeti is out of sight, out of the music range and out of the inset, and he is
  represented by five captioned roars.

**Fix:**
1. Widen W-077 to "Alpine Normal/Hard and Whiteout Standard Normal" and correct the README sentence.
2. Mark W-076's decision 3 as not met, with W-077 as the blocker.
3. For W-077, prefer a *location-constant* lever over a distance-dependent one, so that nothing new behaves like
   rubber-banding:
   - a per-location Yeti base pace scaled to that course's measured clean-skier speed (Alpine's skier is 4–10 m/s
     faster than on Fjord);
   - or course-side: Alpine route gates or hazards where a poor line or a crash costs real speed.
4. Note for the owner: the existing `pressure` term is already a distance-dependent catch-up. W-077 should not make
   it stronger.
5. Acceptance target to measure: on Normal, crash at 5 s / crash at 20 s / poorRoute each reach < 25 m at least once
   without being caught, and the skilled driver keeps ≥ 45 m. Today Fjord Sprint Normal nearly meets this.

### F6 — Major (evidence): the Whiteout tension rows use a driver that does not represent a clean Whiteout skier
**Evidence:**
- On Whiteout Sprint Normal **every** tension driver is caught, including `skilled` (caught at 75.8 s, which I
  reproduced).
- The probe shows why: the autopilot slows to 12–16 m/s against a constant 16.5 m/s Yeti.
- Yet `balance/w056/` shows the weather-blind `whiteoutDriver` winning Classic Sprint Normal with a 40.7 m minimum
  gap, and the reader winning with 44.5 m.
- So the tension table's "skilled" is not a clean skier on Whiteout. It is a driver that ignores the drift-row gaps
  the location is built around.
- The README's "Whiteout: … graded" therefore has no usable Sprint evidence. Mistakes by a competent Whiteout skier
  (crash, late crash, wander, using `whiteoutDriver`) are not measured anywhere.

**Player impact:** we do not know whether Whiteout Sprint rewards clean skiing and punishes mistakes. It could be
binary (decision 3 fails the other way) or fine.

**Fix:** run the tension behaviours on Whiteout on top of `whiteoutDriver` (blind and reader), and replace the Whiteout
rows. This is a test-only change and does not touch Whiteout's balance.

### F7 — Minor: the presence cues are honest, but CLOSING is a terrain indicator, not a mistake indicator
**Evidence:**
- `presence.ts` is presentation only. `git diff 471227d HEAD` touches no AI, spawn, physics or simulate code, and
  `caveHandoff.ts` changed only its beat constants.
- The calls fire only beyond 110 m, every 9–14 s, seeded and deterministic. They are suppressed during the leap and
  never placed over another caption (`GameSession.ts:1252-1262`).
- CLOSING, however, shows on clean runs: Fjord Sprint skilled 11.4 s, Whiteout Standard skilled 3.3 s, Alpine Hard
  competent 13.5 s with the gap never below 50 m.
- My probe shows it is triggered by gentle ground: Fjord at t60–80, slope 11°, where the skier slows to 14–16 m/s.

**Player impact:** a skier doing nothing wrong is told "▲ CLOSING" and the widget turns red (`Hud.ts:392`, `near`
toggled by `closing`). This is truthful about the gap, but players will read it as blame. The calls are meaningful
rather than noise: they are the only sign of the Yeti on Alpine. They are still flavour, not tension, because nothing
the player hears changes what they should do.

**Fix:**
- Keep CLOSING, but only turn the widget red when the projected time-to-catch is short, for example
  gap / closing-rate < 15 s.
- Otherwise show the ▲ in amber.
- On the calls: vary their content with the trend (a nearer, louder call when the gap is shrinking even beyond 110 m),
  so that they carry information.

### F8 — Minor: "RUN." and the inset together cover the top-centre of the forward view for 1.6 s
**Evidence:**
- `alpine_07`–`_11` and `fjord_07`–`_11`: at 960×540 the inset spans x 336–624, y 78–198, and "RUN." spans
  y ≈ 200–262. Together they fill the column just above the horizon in the direction of travel. The near route
  (30–60 m) stays clear below them, so the acceptance test still passes.
- On Whiteout, where the readable distance is shorter in a storm, this area matters more. There is no Whiteout chase
  frame to check it.

**Fix:** move "RUN." below the skier or to the lower third, or fade it within 0.8 s. Capture the missing Whiteout
chase frames (`whiteout_07..11`) before signing off on Whiteout.

### F9 — Checked, no regression or cheat found
- Watched and skipped hand-offs are the same state on the same camera (e2e 6/6 on `e10dfcc`; unit parity 8 leave
  moments × 3 locations).
- The canonical start is unchanged. The extra 1.2 s of cinematic (`CAVE_LEAP_AT` 14.6 → 15.8) happens while the skier
  is frozen (`z` constant through every cinematic frame).
- With Reduce Camera Motion there is no swing (a hold and then a cut), and the follow camera's shake is zeroed
  (`FollowCamera.ts:226`).
- The manual look-back is kept and released (unit test, e2e).
- There are no teleports, invisible boosts or rubber-band additions in this pass. The pre-existing catch-up term is
  flagged in F5.

## Scores, justified
- **Hand-off camera 7/10.** The acceptance test passes cleanly, with no snap and no automatic look-back, and the
  movement is continuous into gameplay. Points off: the leap and landing became a near-invisible, quiet beat on
  Alpine and on Low quality (F2, F3), and the swing turns around an off-screen pivot at near whip-pan speed, with a
  test bound too loose to notice (F4).
- **Chase tension 4/10.** The presence work is honest and harmless, and the deferral is procedurally right. But
  decision 3's core sentence fails on the default location and on Whiteout Standard Normal (F5), and the Whiteout
  evidence cannot support any claim (F6).
