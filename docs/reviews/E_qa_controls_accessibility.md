# Review E — QA, Controls & Accessibility

> Internal multi-agent review — separate agent instance of the same model family; not an external/independent human approval.

## What was inspected
`src/input/Input.ts`, `src/ui/Menu.ts`, `src/ui/Hud.ts`, `src/ui/styles.css`, `src/game/App.ts`, `src/game/GameSession.ts`, `src/game/RunState.ts`, `src/core/settings.ts`, `src/camera/FollowCamera.ts`, `src/yeti/YetiAI.ts`, `src/audio/AudioEngine.ts` / `AudioCore.ts` / `graph.ts` (pause path only), `tests/unit/*.test.ts`, `tests/e2e/game.spec.ts`, `README.md`. I did not run Playwright or start a server.

## Evidence observed (experiments)
Baseline `npx vitest run`: 4 files, 80/80 tests pass. I wrote throwaway experiments in `tests/unit/_qa_e.test.ts` and deleted them afterwards.

| # | Experiment | Result |
|---|---|---|
| E1a | Stored settings `{deadzone:"abc", steerSensitivity:null, masterVolume:"loud"}` | All three load without checks. Steering output is **0** for both pad and keyboard (`steer * null`) |
| E1b | Stored `bindings.left = null` | `keydown` throws `Cannot read properties of null (reading 'includes')`. `gameplay()` throws `not iterable` on every frame, so the App shows its fatal overlay after 60 frames |
| E1c | Stored `renderScale: 0` | Accepted, which gives `setPixelRatio(0)` |
| E2 | Pad with `mapping: ''` (non-standard), triggers resting at −1 on axes 2/5 | camX = **−2.2 rad over 1 s with no input** (camera spins). The active device flipped **13 times** in 60 frames when keys were pressed too, so prompts flicker |
| E3 | Small stick drift (0.09, 0.03) with dead zone at the 0.02 minimum | Steer 0.029, or 0.046 at 1.6× sensitivity: the skier creeps sideways |
| E4 | Remapped *Steer left* to `ArrowRight` the way `controlsScreen` does it | left=`[ArrowRight,ArrowLeft]`, right=`[KeyD,ArrowRight]`. Pressing → gives steer **0.000** (the two actions cancel). Nothing warns about the conflict |
| E5a/b | Stopped skier 80 m / 50 m **uphill of** the Yeti | The Yeti never turns back. It runs on to 356 m / 329 m away and never catches the skier |
| E5c | Stopped skier 40 m ahead | Caught at 4.3 s (correct) |
| E5d | Stopped skier 45 m off-route in trees | Caught at 14.8 s (navigation works, but slowly) |

## Critical defects
1. **Restart Run from the pause menu leaves the game muted for the whole run.** `pause()` calls `audio.setPaused(true)` (App.ts:248). The *Restart Run* item calls `startRun(true)` (App.ts:263), and `startRun` (App.ts:218-241) never calls `setPaused(false)`. `AudioMix.setPaused` ramps music, ambience and the music send to 0 (graph.ts:480-486). Only *Resume* (App.ts:253) and `toMenu` (App.ts:200) undo it. The e2e test never presses Restart from pause.
2. **Gamepad soft-lock on the key-remap rows.** Pressing A on a *bind* row sets `listening = true` (Menu.ts:227), and while it is set `update()` returns early (Menu.ts:239). Only a physical key press can clear it (Input.ts:130-135, App.ts:356). A controller-only player who opens Controls (from the main menu or the pause menu) and presses A on a row is stuck. The row has no timeout, B does not cancel it, and a mouse click does not cancel it either.
3. **Persisted settings are not type-validated** (settings.ts:76-79). Only `quality` is checked. A null binding gives a hard crash (E1b), a null sensitivity silently disables steering (E1a), and `renderScale: 0` gives a zero-size canvas (E1c). "Tolerate corrupt data" is tested only for malformed JSON (game.test.ts:98).

## Major weaknesses
4. **Non-standard gamepad mappings are not handled** (Input.ts:216-218, 249-256). The code never checks `pad.mapping`. Pads exposed as non-standard (common for DualShock 4 on Firefox/Linux and for generic pads) report their triggers on axes at −1 when released. The right-stick read then spins the camera constantly, and `poll()` treats the pad as active on every frame, which flips the HUD glyphs against the keyboard (E2). Triggers are only read from `buttons[6/7]`.
5. **Remapping has no conflict detection and only replaces the primary key** (App.ts:357-361). Duplicate keys cancel each other out (E4). Rebinding *Pause* drops `Escape` from it, but the Controls help text still says "Esc pause" (hard-coded HTML at App.ts:389-396). The secondary arrow bindings cannot be changed or cleared. Controller buttons cannot be remapped at all, because the glyphs and mapping are hard-coded (Input.ts:253-262, 339-363).
6. **The Yeti abandons a skier who ends up uphill of it** (YetiAI.ts:129-137). Once the gap behind it is more than about 45 m, the target blend is dominated by `aheadZ = pos.z + 15..45`, so the Yeti runs on down the route (E5a/b). After an overshoot (for example, a skier airborne over a lunge, where `canCatch` fails on `dy`, YetiAI.ts:213), the pursuit can be lost for good. Nothing handles a skier who is "behind the Yeti".
7. **Pause rules during the cave cinematic contradict each other.** `App.pause()` explicitly allows the cave cinematic (App.ts:245), and blur pauses it. But `GameSession.frame` ignores `pausePressed` in any cinematic (GameSession.ts:183), and the first viewing cannot be skipped (GameSession.ts:197). So Esc or Start does nothing during the first cave reveal.
8. **Accidental skips.** `skipPressed` includes pad **A (pop)** and **B (look back)** (Input.ts:262). A player who is mashing pop when the cave triggers on a repeat viewing skips the cinematic without meaning to. The intro also ends on A, B, Start, Enter or Esc.
9. **A controller-only player gets no sound and no on-screen hint.** Audio is unlocked only on `pointerdown` or `keydown` (App.ts:89-91). `startRun()`'s unlock call (App.ts:219) runs from rAF, which is not a user gesture. The README documents this, but the UI never tells the player.
10. **Menu navigation does not auto-repeat for the D-pad or held arrow keys.** D-pad presses are edge-only (Input.ts:286-289) and held keys are filtered by `!e.repeat` (Input.ts:138). Moving the dead-zone slider from 0.02 to 0.40 takes 38 separate presses. Only the stick repeats (Input.ts:301-309).
11. **Accessibility coverage is thin.** There is no text-size option. Menu and HUD text uses 10-12 px sizes (styles.css:56, 63-64, 71, 73). The CSS never checks `prefers-reduced-motion`. *Reduce camera motion* still widens the FOV from 62° to 68° with speed (FollowCamera.ts:211) and keeps 30% shake (FollowCamera.ts:223, GameSession.ts:258). Cinematic camera moves and the 180° look-back swing are not reduced. *Reduce flashes* covers only the danger pulse and the cave eyes (Hud.ts:188, CaveCinematic.ts:103).

## Minor issues
- Prompt keys are not tied to the device: `'recover'` and `'drift-wait'` (GameSession.ts:578, 592) keep the old glyph after a device switch. The menu footer always shows "Enter/A" and "Esc/B" (Menu.ts:138), not the PlayStation ✕/○.
- Turning *Tutorial prompts* off during the learn phase leaves the current prompt on screen (GameSession.ts:582-583).
- *Reset settings to defaults* restores `renderScale` without calling `applyPixelRatio()` (App.ts:335-341). The render-scale slider does not update the particle pixel ratio (App.ts:324 vs 115).
- Losing focus during the intro or the defeat/victory cinematics does not pause (App.ts:245), so the results can arrive while the player is away.
- `recoverLatch` is set during cinematics and carries into the next fixed step (GameSession.ts:279).
- The results screen has no input grace period, so a mashed A or Space triggers Retry at once (App.ts:289-297).
- The dead-zone minimum of 0.02 is too low to absorb typical stick drift (App.ts:401, E3).
- The debug harness ships in production and is gated only by `?debug` (App.ts:138). It allows teleporting and autopilot, which makes cheating trivial.
- There are small per-frame allocations (FollowCamera.ts:179, App.ts:463, GameSession.ts:562), and the pad tester rewrites `innerHTML` on every frame (App.ts:384-385).

I found no growth that accumulates per run. Listeners are installed once, timers are cleared in `dispose`, and tracks, particles and footprints are cleared for each session. Outcomes cannot happen twice: `resultsSent` and the RunState guards are sound.

## Recommended corrections (file:line)
1. App.ts:218-241: call `this.audio.setPaused(false)` (and `session.paused=false`) in `startRun`.
2. Menu.ts:239 / App.ts:355: let pad B or Start, or a 5 s timeout, cancel listening, and clear `input.listenNextKey`.
3. settings.ts:76-79: validate each field by type and range, require `bindings[a]` to be a string array, and clamp `renderScale` to [0.5, 1].
4. Input.ts:216-256: for pads whose `mapping !== 'standard'`, either use a known non-standard map or ignore axes beyond 1 and remap the triggers. Base device switching on movement relative to a calibrated rest pose.
5. App.ts:357-361: detect conflicts (swap or warn), allow editing every slot, generate the help text from the bindings, and add a controller remap.
6. YetiAI.ts:133-137: when `gap < 0`, target the skier directly (turn around) at any distance.
7. GameSession.ts:183: allow pause in `caveCinematic` to match App.ts:245.
8. Input.ts:262: limit skip to Start/Options, or require a hold.
9. App.ts:89: show a "Press any key / click for sound" hint while `!audio.ready`.
10. Input.ts:286 / 138: add hold-repeat for the D-pad and arrow keys.
11. styles.css and Settings: add a UI scale option and a `prefers-reduced-motion` default, and make *Reduce motion* cover FOV, cinematic shake and the look-back swing.

## Scores
- **Controller/keyboard controls: 6/10.** The basics are good: radial dead zone, analog triggers, hot-plug, device glyphs and stick menu repeat. But there is a gamepad soft-lock, non-standard pads are unusable, remapping is unsafe and controller buttons cannot be remapped.
- **Performance and stability (QA view): 7/10.** The core state machine is solid and nothing accumulates per run. The pause→restart audio mute, the crash on corrupt settings and the Yeti losing the skier are real holes.

**Pass/fail vs 9/10: FAIL on both.**

## Unverified evidence
- I did not run Playwright or test in a browser. The audio mute (#1) and the soft-lock (#2) are confirmed by tracing the code, not by observing them.
- I tested non-standard pad behaviour with synthetic pads only. Real axis layouts vary by browser and OS.
- That gamepad input does not count as a user activation for `AudioContext.resume` follows the HTML spec and the README. I did not measure it here.
- I measured contrast and font legibility by reading the CSS, not with a contrast tool. `--ink-dim` at 0.72 alpha on glass over bright snow may fall below 4.5:1.
- I did not check heap or DOM stability across repeated runs in a browser.
