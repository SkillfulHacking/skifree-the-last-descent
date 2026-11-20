# W-076 review E, round 2: QA and accessibility (skip, pause, restart, controller, hand-off camera)

- **Reviewer:** E, QA and Accessibility Lead. I am a model-based reviewer, not a human playtester. I played nothing.
- **Build:** `pass5-whiteout` @ **00bb240**. I read `git diff 2d3618c 00bb240` in full.
  - `git diff e503677 00bb240` touches only `tests/e2e/whiteout.spec.ts`. So the browser runs on e503677 apply to the source of 00bb240; I checked this.
- **What I examined:**
  - Code: `Input.ts` (`padUsed`), `GameSession.ts` (`finishCave`, `cineBlend`, `leapPending`, `yetiLanded`, `rearView`, the follow branch), `FollowCamera.ts` (`lookBackOverride`/`lookBackAim`), `camera/handoffBlend.ts`, `Hud.ts`, `RunState.controllable`, `obstacles.ts` (`inLeapView`).
  - Tests: `input.test.ts`, `handoff_blend.test.ts`, `cave_handoff.test.ts`, `cave_skip.spec.ts`, `whiteout_rerun.spec.ts`, `whiteout.spec.ts`.
  - Every log in `/home/claude/w076logs/`.
  - The handoff strip: 72 frames from e503677 with `manifest.json`. I computed the camera yaw for every frame from `cam.dir`, and viewed alpine_09 and whiteout_16.
  - `balance/round3-cave/README.md`, and Reviewer C's r5 as context.
- **What I ran:** in `/tmp/w076r2` (cache in /tmp), I ran the new `input.test.ts` against `Input.ts` from 2d3618c and from 00bb240, and ran `handoff_blend.test.ts`. I started no browser.

## Verdict: FAIL (in my area)

All four findings from my first report are fixed or resolved, and I checked the fixes myself (see below). The hand-off state is still the same whether the cinematic is watched or skipped.

The new hand-off camera brings a new Major defect. After **watching** the cinematic, the player has full control of a skier moving at about 13–15 m/s while the camera looks **backwards** for about 3.5–3.9 s. The player cannot override it, and the cleared sight line covers less ground than the player travels. After **skipping**, the player sees forward from the first frame. Every first-time player has to watch.

The chase state is the same, but what the player can see is not. This is a new watch/skip asymmetry, and it is the reverse of the owner's original complaint: now watching is the disadvantage.

## Earlier findings: status (verified)

- **F1 (controller Start resumes and re-pauses or skips): fixed.**
  - `padUsed` (Input.ts:115, 218, 235, 280, 311) means a Start press read by the menu is not read again by the gameplay in the same poll.
  - The new unit test fails on the 2d3618c `Input` (`expected true to be false`) and passes on 00bb240. I ran it.
  - The ordering in `App.frame` (menu, then gameplay in the same frame) is unchanged, so the unit-level fix covers the path I reported.
  - Remaining minor gap: no e2e test closes the pause menu with Start.
- **F2 (no browser run on the reviewed build): resolved.**
  - `e2e_cave_skip.log` 4/4, `e2e_whiteout_rerun.log` 3/3 and `e2e_game.log` 3/3 are all on e503677. `e2e_whiteout_r2.log` is 3/3 on the 00bb240 test, with the same built source.
  - The strip now covers all three locations out to chase t ≈ 5 s, `errors: []`. Each log starts with its commit.
- **F3 (unit test is a tautology): resolved by an honest description.** The header now calls it a "model-level check" and points to `cave_skip.spec.ts` as the real path. The e2e now adds Fjord and a slow (3 m/s) arrival. Hard and Endless still have no real-path test (Minor).
- **F6 ("YETI Infinity m"): mostly fixed.** Hud.ts:383 no longer writes a non-finite distance. See N3 for what is left.
- **F7 (`whiteout_rerun` frame): changed, but the stated reason is wrong.** See N4.

## New findings

### N1 (Major): On the watched hand-off the player steers blind for about 3.5–3.9 s; after a skip they do not
**Evidence (verified from the strip manifest).** Camera yaw is from `cam.dir`; 0° is straight downhill.

| Location | Look-back starts | Camera within 90° of downhill again | Skier distance covered in that time |
|---|---|---|---|
| Alpine | ~113°, chase t = 0.07 | yaw 75° at t = 3.97 (103° at t = 3.70) | z 283.0 → 336.9 m, about 54 m at 55 km/h |
| Fjord | ~127° | t ≈ 3.97 | similar |
| Whiteout | ~119° | t ≈ 3.93 | similar |

- **What the frames show.** `whiteout_16.png` (t = 3.13): the camera looks back up at the Yeti and the skier faces the lens. "RUN." covers the Yeti. The caption reads "the wind pushes you left; ski the flagged gaps in the drifts", and that hazard is behind the camera. `alpine_09.png` (t = 1.40) is the same view at 55 km/h.
- **The player has control.** The chase is `controllable` (RunState.ts:67), so steering and physics run from the first frame.
- **The player cannot cancel the look-back.** While it is active, `lookBackOverride` replaces the player's look-back (FollowCamera.ts `lookBackS = lookBackOverride ?? …`). Its schedule is fixed: held until the landing + 0.35 s, then released over 2.3 s (`HANDOFF_CAM`). No player input shortens it.
- **On the skip path** `cineBlend` is null, so `finishCave` sets the override to null and the forward follow camera is live from the first frame.
- **The cleared sight line is shorter than the blind distance.** C11's clearing (`inLeapView`, obstacles.ts) is a triangle from the landing point to the route over trigger → trigger + 45 m. At the strip's ~13.5 m/s the skier covers about 54 m before the camera faces forward. At a 22 m/s arrival (the unit tests' fast case) that is about 86 m. A player who steers off the route line leaves the triangle. Drifts and other hazards are not cleared.
- **The balance re-check cannot catch this.** `round3-cave` runs headless simulations with no camera, so "no outcome changes" says nothing about it.

**Player impact.**
- Every first viewing is watched, so every new player starts their first chase unable to see ahead for about 4 s, at speed, while being told to run.
- Players who skip see forward at once, which again makes watching and skipping unequal.
- Accessibility: players with slower reactions or low vision, and controller players who press look-back to "look forward", get no recourse.

**Fix direction:**
- Let any steering, look-back or camera input end or shorten the scripted look-back. Or keep it only while the skier is not yet steering.
- Or release it at the landing, with no 0.35 s hold and a shorter release.
- Or freeze the skier's control until the release, in which case the hand-off state must then match on the skip path too.
- Measure the turn-forward time in the e2e for both paths.

### N2 (Minor): The hand-off camera ignores `reduceCameraMotion`
- The release turns about 158° in about 2.1 s. Alpine: yaw 137° at t = 2.63 to −21° at t = 5.03.
- `handoffBlend.ts` and the GameSession follow branch never read `reduceCameraMotion`. FollowCamera uses it only for FOV and shake.
- The old swing also ignored it, but the new one is longer and larger.
- Fix direction: when reduce-motion is on, cut or shorten the release.

### N3 (Minor): The Yeti widget shows stale text on the hand-off frame
`Hud.update` still un-hides `yetiWrap` when `chase && yetiDistance !== null`. It now skips only the text and bar update (Hud.ts:379-387). On the hand-off frame the widget therefore shows whatever it held last, for example "YETI 3 m — MOVE!" from the previous run or Endless encounter, because the HUD is reused and the label is never reset. This lasts one frame unless the game is paused on that frame. Fix direction: hide the widget while the distance is not finite.

### N4 (Minor): `whiteout_rerun` comment says "the swing complete", but the frame is mid-look-back
The test now captures 2 frames after the landing. The look-back is held until the landing + 0.35 s, so the frame is the full look-back view: Whiteout yaw −154° at the landing (`whiteout_12`), not the gameplay camera. The W-031 check (whole-frame luminance spread) probably still holds, and it passed 3/3, but the comment and the "same camera" calibration in the file header are inaccurate.

### N5 (Minor, verified from code): The override's lifecycle
- **Pause:** `frame` returns before the follow branch. `B.t`, the override and the aim freeze, then resume intact.
- **Restart Run, Retry, Exit:** a new `GameSession` builds a new `FollowCamera` (GameSession.ts:162), so no override carries over.
- **Crash:** the phase stays `chase`. The look-back keeps to its schedule, which is driven by the Yeti's landing, not the skier.
- **Endless retire, results:** the follow branch sees `phase !== 'chase'` and clears `cineBlend`, the override and the aim.
- **Catch:** `beginDefeat` sets `this.defeat`, so the follow branch never runs and `cineBlend`/`lookBackOverride` are **never cleared**. The defeat cinematic owns the camera and the session then ends, so this has no visible effect. It is fragile all the same: clear them in `beginDefeat`.
- **Teleport (debug only):** the look-back continues from the new position, aimed at `yetiAI.pos` (a live reference), with the bias limited to 0.6 rad.
- **No upper limit:** `lookBackAt` returns 1 for as long as `landedAt === null`. If the Yeti never lands in the chase phase, the view stays backwards indefinitely. I found no path where that happens, but a time cap such as 4 s would be cheap insurance.
- None of these cases has a test. `handoff_blend.test.ts` tests the schedule and the turn rate on a bare `FollowCamera`, not `GameSession`.

### N6 (Minor): A remaining pad edge case
`menu()` marks A as used, but gameplay reads `pop` from the held state (`padNow[A]`). Choosing "Resume" with A therefore passes `pop` for that frame, which pops the skier or skips the intro. This predates W-076 and is low impact.

### N7 (Verified, unchanged): the hand-off itself
- `finishCave` → `startCanonicalChase` on both paths.
- The first viewing pauses on Escape or Start (`cavePausable`). Later viewings skip on Escape, Enter or Start, and a skip is not a pause; `cave_skip` asserts this on all four configurations.
- The landing thump, particles and "RUN." now fire at the landing on both paths. The watched path waits an extra 0.6 s for "RUN.", which is presentation only.
- The rear-view inset is suppressed until the landing on both paths.
- `framesLive` is still debug-only.

## What would change my verdict

Fix N1 so that a watching player is never steering without a forward view longer than a skipping player. Then show it: an e2e or strip measurement of the time to a forward-facing camera on the watched and skipped paths, with the result within a few tenths of a second, or an input that cancels the look-back with a test for it. With N1 fixed and the other findings as they stand, I would pass W-076 in my area.

This change does not resolve W-056 (the strip and `round3-cave` agree: `CLASSIC-SPR@WHITE` Normal is still caught).
