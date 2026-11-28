# W-076 final hand-off — Review C (Cinematics & Camera)

**Build reviewed:** `pass5-whiteout` HEAD `e06d6b9`. Since `1d88f0a` the camera-related source has changed only in
`FollowCamera.snap` (B1), `GameSession.finishCave`/`yetiLanded`/`rearViewZoom`, `App.ts` (inset FOV), `Hud.ts`/`styles.css`
(CLOSING colour) and `stormCave.ts` (squall hand-back). `git diff --stat 1d88f0a e06d6b9` on src/camera, src/cinematic, src/game,
src/yeti, src/ui and the cave views.
**Reviewer:** C, Cinematics. **I am a model reviewer, not a human playtester.** I judged motion from 0.27 s stills, the
manifests' camera poses and headless replays of the real camera code at 60 fps. I did not see the game at frame rate and did not
hear any audio. Judgements about feel are marked as such.

## Verdict: **PASS — 7/10** (cinematic hand-off and leap presentation)

| Part | Result |
|---|---|
| The hand-off (owner's decision 1) | **Met.** No snap. The swing lands exactly on the gameplay pose. Watched and skipped paths share that pose. The camera does not look back on its own. Manual look-back works. Reduce Camera Motion gives a hold and then a cut. Score on its own: 9/10. |
| The leap presentation | **Better, but not yet satisfying.** The 22° inset makes the Yeti readable while he is against the dark cave mouth. That is a real gain over `6264e6d`, where he could not be found on Alpine. However, the set-up shot does not set up a leap (C1). In the inset the flight comes almost straight at the camera and loses contrast once he clears the mouth (C2). Players on Low quality, or with the inset off, still see no leap (C6). Score on its own: 5/10. |

Nothing here breaks the owner's decision, so this is a PASS. C1 is the one change I would still make before calling the
leap "satisfying". It is presentation only and costs nothing in time.

---

## What I verified, and how

| Check | How | Result |
|---|---|---|
| Unit tests | `npx vitest run tests/unit/handoff_camera.test.ts` | 17/17 pass (6.8 s) |
| Swing replay at 60 fps, 3 locations × 4 / 16 m/s | `/tmp/revC_final/swing.probe.test.ts`: the real `orbitPose`, `ease.inOut`, `FollowCamera.snap`, the CaveCinematic `leapCam` formula (including its Whiteout lift loop), and the 11vh letterbox with its 0.7 s CSS curve, all projected at 16:9 | Total turn 113–137°. Peak **2.6–3.2° per frame (156–191°/s)**. The end pose equals the follow camera's snap (also asserted by the unit test) |
| Camera per strip frame | Manifests `strip/manifest_alpine.json` (6264e6d), `manifest_fjord.json` (sha 4a26eb3; the README says d3bac73), new `/tmp/strip_e06/manifest.json` (e06d6b9, Whiteout 00–11 and Alpine 00–09 at the time of writing) | Whiteout e06d6b9: per-step turns 38.9 (the cut), 0.1, 4.6, 29.4, 39.5, 29.7, **6.3 across the hand-off**, then 0.1–0.2. The hand-off frame faces −10° yaw, pitched −9°. Alpine and Fjord have the same shape |
| Skier and Yeti position in the frame during the hold and swing | Same probe, plus the skier reconstructed from the reaction shot's line of sight in `alpine_00`/`fjord_00` (the probe agrees to ±0.02 NDC) | See C1 and C3 |
| Inset size of the Yeti during the leap | Probe `inset *`: the real `rearView` placement and `rearViewZoom` FOV; a ballistic flight from `yetiSpawnAfterCinematic`; skier at 13.5 m/s on the route; Yeti 3.0 m tall | 22° at 540p (inset 120 px high): **Alpine 15–17 px, Whiteout 18–22 px, Fjord 21–23 px**. At 1080p (175 px): 22–34 px. The old 48° gives 6–10 px |
| Inset as rendered | 2× crops: `/tmp/revC_final/wo_inset_07_08.png`, `wo_inset_09_11.png`, `alpine_inset_old_vs_new.png` (6264e6d on the left, e06d6b9 on the right) | See C2 |
| A camera orbit held as the cave triggers | `/tmp/revC_final/orbit.probe.test.ts` | See C4 |
| Code read | `CaveCinematic.ts`, `orbit.ts`, `Timeline.ts`, `caveHandoff.ts`, `FollowCamera.ts`, `GameSession.ts` (`gameplayPose` :196, cave branch :292-311, `yetiLanded` :374, `rearViewZoom` :392, `rearView` :400, `finishCave` :775), `App.ts:852-880`, `stormCave.ts:168-232`, `seaCaveCinematic.ts`, `Hud.ts`, `styles.css`, `YetiAI.startChase`, `animation.ts leap()` | — |

**Earlier findings, checked on e06d6b9:**
- **B1, look-back held at the trigger: fixed.** `snap()` now sets `lookBackS = lookBack` (`FollowCamera.ts:84`). `finishCave()` clears `lookBack` first (`GameSession.ts:778`). `gameplayPose()` snaps with `lookBack = 0`. The unit test covers it.
- **B2, the squall hand-back: fixed.** `stormCave.ts` `dispose()` now hands back the squall as it stands at `CAVE_LEAP_AT`, whatever the leave moment. That matters to the camera because the leap is seen through that weather.
- **F2, leap illegible in the inset: partly fixed** (C2). **F3, landing cues:** the code adds an unattenuated impact, rumble and a caption (`GameSession.ts:381-384`); I could not hear them. **F4, swing around an off-screen pivot: not addressed** (C1, C3). **F8, RUN. plus inset over the top-centre: not addressed.** I agree with F that it does not hide the near route.

---

## Findings

### C1 — Major: the leap set-up is a distant, static Yeti, and the skier whose shoulder it is meant to look over is hidden under the letterbox
**Evidence:**
- `CaveCinematic.ts:139-142`: `leapCam` sits 3.6 m behind the skier at 1.35 m height, aimed at a point one third of the way from the Yeti to the skier's head.
- The skier is crouched and looking back (`poseOverride lookBack:1`), so the helmet is lower than the 1.5 m the aim assumes. Projected through the hold's cameras, the head sits at NDC y ≈ −0.85 to −0.95. The letterbox bars (11vh, `styles.css:90`) cover |y| > 0.78.
- The frames confirm it:
  - `alpine_01/02`, `fjord_01/02` and `/tmp/strip_e06/whiteout_01/02` show the cave and the Yeti with no skier.
  - In `alpine_03`/`fjord_03` the capture has already removed the bars (see C7), and the red helmet appears exactly in the bottom-bar band (y ≈ 500–540 of 540). Side by side: `/tmp/revC_final/hold_vs_turn.png`.
- The Yeti in that shot is 65 m (Alpine), 54 m (Whiteout) and 45 m (Fjord) from the camera, at FOV 44. He is **29–30 px tall on Alpine, 35–36 px on Whiteout and 42–43 px on Fjord** at 540p (probe), about 6–8 % of the frame height.
- He is in `stand` for the whole hold (`tl.at(CAVE_GATHER_AT)` → `setYetiMode('stand')`, :210-217). The crouch and launch exist (`animation.ts leap()`, crouch 0–0.22 s, launch 0.22–0.36 s), but they only play after control returns, and only in the inset.

**Player impact:**
- The beat that the owner asked to keep ("the leap set-up") reads as a wide shot of a small figure standing in a doorway for half a second. Nothing telegraphs "he is about to jump".
- The over-the-shoulder composition, which would tie the threat to the player, is lost because the shoulder is under the bar.
- Then the swing starts from a frame with no subject in the foreground (C3).

**Fix (presentation only; the chase state is unchanged, because the AI takes him from the ledge at `finish()` either way):**
1. Frame the skier: raise `leapCam` by about 0.5 m and aim at the skier's *actual* head (`st.skier` head bone, or `P.y + 1.0`). Alternatively, lerp the look point 0.2 rather than 0.34 toward the skier. The helmet and shoulder should sit inside the lower third, above the bar (target NDC y ≈ −0.55).
2. Tighten the hold to FOV 30–34, so the Yeti is about 45–60 px at 540p.
3. Give the hold a gather. At `CAVE_GATHER_AT`, play the leap's crouch (a `gather` mode, or `leap` frozen at `t ≈ 0.2`) with the growl. When control returns, start `leap` at `modeTime ≈ 0.22`, so the crouch is not played twice. Today the crouch plays while he is already airborne: `startChase` sets `airborne = true` and the ballistic motion starts at once (`YetiAI.ts:126-133`).
4. Test it: in `handoff_camera.test.ts`, assert that the skier's head projects inside the *letterboxed* frustum (|y| ≤ 0.78) for the whole hold. The current `< 32°` cone (:110) passes a skier who is under the bar.

### C2 — Minor: in the inset the flight comes nearly head-on, and loses contrast once he clears the mouth
**Evidence:**
- The zoom works. Compare `alpine_07/08` at 6264e6d and at e06d6b9 (`/tmp/revC_final/alpine_inset_old_vs_new.png`): from no Yeti at all, he becomes a clear white figure in the dark mouth.
- `whiteout_07` shows him in the mouth. In `whiteout_08` he is rising across the white cornice (white on white).
- By `whiteout_09–11` and `alpine_09` (0.6–1.13 s) he has cleared the mouth. He is a small, pale shape against grey rock (Whiteout) or pale limestone (Alpine), and hard to pick out even in a 2× crop.
- The leap aims at the piste centre beside the skier (`spawn.ts:15-17`), and the inset camera is 2.4 m off the skier's line (`GameSession.ts:409`). So the flight is mostly *toward* the camera.
- Across 07→11 his screen position changes by only about 10–15 inset pixels. The arc, which is what makes a leap read as a leap, is foreshortened away.
- The inset fades in over 0.3 s (`styles.css:166`), so the crouch and launch (0–0.36 s of `leap`) happen mostly while it is still fading in.

**Player impact:** players can now see that he has left the cave. The jump itself (arc, apex, drop) is hard to read at a glance in a 288 × 120 px box, especially on Alpine and Whiteout. I could not judge the landing in any strip, because every strip ends at 1.13 s and the flight lasts 2.08 s.

**Fix:**
- While `leapPending`, move the inset camera 8–12 m sideways from the leap line (perpendicular to `spawn.leap`, on the skier's side). Aim between the Yeti and his landing point, so the arc crosses the box.
- Light him while he is in the air: the `yetiRim` point light in `App.ts:836` is already on in the chase. Check that it reaches him at 50–60 m, or add a dark outline or rim term on his material during `leapPending`.
- Start the inset at opacity 1 on the hand-off frame (skip the 0.3 s fade for this one appearance).
- Extend the strip to chase t ≈ 2.5 s so the landing and the 1.0–1.8 s zoom-out are captured.

### C3 — Minor (feel judged from stills): for about 0.2 s at the swing's peak speed, neither the Yeti nor the whole skier is in frame
**Evidence (60 fps probe):**
- The Yeti leaves the frame at 15.10 s (Alpine) or 15.15–15.17 s (Fjord, Whiteout).
- The whole skier is in frame only from 15.25–15.37 s. Because of C1, any part of him appears only once the bottom bar has opened (bars at 0.054 → 0.014 NDC over 15.0–15.13 s).
- `ease.inOut` (smoothstep) puts the peak rate at the midpoint, 15.25 s: **191°/s on Alpine, 174°/s on Fjord, 159°/s on Whiteout**, which is 3.2 / 2.9 / 2.65° per 60 fps frame.
- Strip steps: 29–49° per 0.267 s (`alpine_04→05` 49.2°, `whiteout_04→05` 39.5°).
- The movement is continuous, and orbiting around a nearby pivot keeps the parallax low, so this is not a snap. It is, however, the stretch of the hand-off most likely to feel like a whip.

**Fix:**
- Fixing C1 (skier in frame from the start of the hold) gives the swing a foreground anchor all the way through. That is the main fix.
- Optionally, start the swing at 14.5 s (hold 0.3 s, swing 1.3 s) for a peak of about 160°/s on Alpine. This adds no time after control returns.
- Or ease with a longer middle (`inOutCubic` is worse; prefer a sine ease or an S-curve capped at about 150°/s).

### C4 — Minor (edge case): a camera orbit held as the cave triggers survives the 16 s cinematic and skews the swing's target and the first controllable frame
**Evidence:**
- `orbitYaw` is only recentred in `FollowCamera.update` after 1.4 s idle (:124-128). During the cinematic, `update` is never called except through `gameplayPose`'s single 1/60 s snap.
- `gameplayPose` and `finishCave` both keep `orbitYaw`.
- Probe (Alpine, 16 m/s), with the given `orbitYaw` at the trigger:

  | `orbitYaw` | skier position on the hand-off frame | time to recentre |
  |---|---|---|
  | 0.8 | NDC x −0.46 | 1.8 s |
  | 1.6 | NDC x −1.34 (off-screen) | 2.2 s |
  | 2.6 | behind the camera | 2.4 s |

  The view direction stays roughly downhill (dir.z 0.87–0.98), which matches review B's orbit probe. However, the swing lands on a pose that does not frame the skier.
- Any mouse movement (`Input.ts:256`) or right-stick nudge in the 1.4 s before the trigger is enough to cause this.

**Fix:** reset the orbit (`orbitYaw = orbitPitch = 0`, e.g. `FollowCamera.resetTransient()`) in `beginCave()`, or in `gameplayPose()` and `finishCave()`. Add an orbit-held case next to the look-back case in `handoff_camera.test.ts`.

### C5 — Minor (seen on one Whiteout seed): the leap's first two seconds compete with a storm-front warning
**Evidence:**
- `/tmp/strip_e06/whiteout_07–11`. On the first controllable frame the player gets all of these at once:
  - RUN.;
  - the inset with the launch;
  - "STORM IN 3 s ←";
  - a two-clause instruction caption ("a storm front rolls in — the wind pushes you left; ski the flagged gaps in the drifts", `GameSession.ts:1256`).
- About 2.1 s later, `yetiLanded` adds "[a heavy landing behind you]" on the hard caption line (`GameSession.ts:383`).
- The front's clock is physics time, so a front due just after the trigger always lands on the hand-off.

**Player impact:** the leap is the chase's first beat and the storm warning asks for a decision. Both are fighting for the same 2 s. This is cinematics-relevant (attention), not a fairness issue.

**Fix:** extend W-056's "every chase opens on a fair stretch" to "no front *builds* in the first ~3 s of a chase". Alternatively, hold the front's caption until RUN. has faded (1.6 s), keeping the chip.

### C6 — Minor (carried from F2): on Low quality, or with the inset off, the leap has no image at all
**Evidence:** `App.ts:855` (`quality !== 'low'`, `settings.rearView`). The only cues left are RUN., the audio, and the landing caption 2 s later.

**Fix:** for this one beat, show the inset on Low (one extra render for about 2.5 s), or show a short caption at the launch: "[the Yeti leaps from the ledge]".

### C7 — Evidence (no player impact)
- **The strips misrepresent anything driven by CSS transitions.** Frames are minutes apart in wall time, so the letterbox (0.7 s), HUD fades (0.4 s), RUN. (0.6 s) and inset fade (0.3 s) are always complete in the stills.
  - `alpine_03`/`whiteout_03` (14.83 s) show no bars, although the bars should still be about 92 % closed then.
  - `*_07` shows the full HUD on the hand-off frame, but in the game it fades in.
  - I therefore did not count a "HUD pop" against the hand-off, and the letterbox state in C1 and C3 comes from the CSS curve, not from the pixels.
- **The strips end at chase t = 1.13 s.** The landing (flight 2.08 s) and the inset's zoom-out (1.0–1.8 s after the landing) appear in no frame.
- **`handoff_camera.test.ts` models a simpler scene than the game:**
  - it spawns the Yeti at `yetiSpawnAfterCinematic(m, e.anchor)` without `cave.ledge`;
  - it omits `leapCam`'s Whiteout lift loop;
  - its skier-in-frame check ignores the letterbox (C1).

  The ledge and spawn differ by metres, so the angular results transfer. Composition checks do not.
- **Browser evidence:**
  - The only complete e2e run in the folder is `e2e_cave_skip.txt` (dist from `1d88f0a`, 6/6, 2.1 h).
  - `e2e_cave_skip_final.txt` (e10dfcc) is truncated after 2/6 cases started, with no result lines, although review F cites it as 6/6.
  - The e06d6b9 run (`e2e_e06d6b9/`) was still on case 1/6 when I finished.
  - So B1's fix and the inset zoom have unit-level and strip evidence only, not a completed browser run.
- **`manifest_fjord.json` records sha `4a26eb3`**, not `d3bac73` as the README says. Source between the two differs only by docs.

---

## What I could not verify
- **Feel at frame rate:** the swing's comfort (C3) and how fast the inset reads (C2). These need a human at 60 fps.
- **Audio:** the growl at the gather, the RUN. sting, the new landing impact layer and the rumble. I did not hear any of them.
- **The landing:** the touchdown frame, the snow burst in the inset, and the 22°→48° ease-out. No frame captured them.
- **Alpine at e06d6b9 after 0.6 s** (`alpine_10/11` were not yet captured), **Fjord at e06d6b9** (no strip), **Reduce Camera Motion in pixels** (code and e2e at 1d88f0a only), **1080p and ultrawide** (inset sizes computed, not rendered).
- **The e2e on e06d6b9:** still running. I did not launch browsers.

## Scores, justified
- **Hand-off 9/10.** All of these meet the owner's decision, verified in code, the unit test, a 60 fps replay and the frames:
  - exact pose continuity (6.3° across the 0.27 s step, and the follow camera holds afterwards);
  - forward view with the route ahead from the first controllable frame;
  - the same pose watched or skipped;
  - no automatic look-back;
  - look-back, the inset and Reduce Camera Motion kept.

  One point off for the swing's anchor-less peak (C3) and the orbit edge case (C4).
- **Leap presentation 5/10.** The inset zoom and the landing cues are real improvements. The set-up shot does not set up a leap (C1). The flight is readable only while he is against the dark mouth (C2). On Low quality there is no image at all (C6).
- **Overall 7/10, PASS.**
