# Development response to review round 1

These reports were written by separate agent instances of the same model family. They are internal
reviews, not independent human approval. For each one, this file lists what changed and what was
deliberately left alone.

## B — Gameplay & Physics (6 / 6 / 5, FAIL)

| Finding | Response |
|---|---|
| Skier could be pinned against a trunk (critical) | Fixed. Light contacts now remove only the inward velocity component and add a 0.6 m/s push away from the trunk. The per-step 0.94 damping became exp(−1.5·dt). Impact events fire only for a new contact or when vn > 1.5. Getting up points the skier ±60° away from any solid obstacle within 2.5 m, and from resort colliders. New unit test: never pinned, over 10 angles of approach. |
| Drift worse than carving | Retuned: gripDrift 3.8, driftEfficiency 0.68, driftDecel 0.4, turn boost 2.2. A test checks that drift changes the travel direction faster than carving (measured about 65% more after 0.7 s) at about 72% of the speed. |
| Pizza can't stop on steep pitches | brakeBase 3.8 and brakeSpeed 0.12. A test checks that you stop on 20° within 12 s. |
| Camera trailed ~2v/ω at speed | Fixed. The spring now acts on the camera's offset from the skier, which is kept as persistent spring state. |
| Terrain bumps cost no speed | Compressions now cost up to 8% of speed (scaled by the inward velocity) and load landImpact and wobble. |
| Keyboard steering ramp slow | Attack rate 6→9, reversal 14→22, steer smoothing 14→22. |
| Chase tension sags mid-run; flat finale unfair | catchUpGap 90→60, boost 9, plus +5 when more than 150 m behind. The speed cap rises to 27 (+4 when far behind), and is limited to 13 + 0.5·slope below 12°. The final section was steepened. The skilled bot's maximum gap fell from about 290 m to about 208 m. |
| Bots recovered instantly | The autopilot now presses recover only after 1.4 s. Added regression simulations: a crash at 20 s, crashes at 30 s and 60 s, and a crash at 40 s for the intermediate bot all still win. |

## D — Technical & Performance (6 / 7, FAIL)

| Finding | Response |
|---|---|
| Shadow map leaked on each world rebuild | `sun.dispose()` is now called in `Environment.dispose`. |
| No LOD hysteresis | Chunks only switch to a coarser LOD once 24 m past the boundary. A job for a LOD that is no longer wanted is replaced. |
| Yeti fur shells have no LOD | Shells only render within 140 m. The High preset is lighter (12 shells, coarser sculpt). |
| Incomplete shader warm-up | All vegetation and the Yeti are made visible during `renderer.compile`, followed by one full render that includes the shadow pass. |
| Guests animate during the menu | The resort only updates when the camera is within 900 m of it. |
| Per-frame/per-step allocations | Collision sets are double-buffered; `syncVisuals` and `updateAudio` reuse scratch vectors and matrices; the tutorial prompt is re-rendered only when the device changes. |
| Footprints and timers survived across runs | `Footprints.clear()` runs at session start, and tree-shake timers are cleared on dispose. |
| Repeated loop errors spammed silently | The first three errors are logged; after 60 a fatal overlay asks the user to reload. |
| Pixel ratio not reapplied after a quality change; previews shipped in the build | Both fixed. Preview pages are only bundled when `PREVIEWS=1`. |
| Resort point lights always on | **Not changed.** Toggling them would recompile every material and cause a visible hitch. The cost is documented in KNOWN_ISSUES. |
| 60 FPS target unmeasured | **Still unmeasured:** there is no GPU in this environment. Documented. |

## A — Visual Art Direction (5 / 6.5 / 6.5, FAIL)

| Finding | Response |
|---|---|
| The Yeti is never on screen in the chase | Added a rear-view "BEHIND YOU" window when the Yeti is within 75 m. It shows the skier in the foreground with the Yeti behind and reuses the frame's shadow map; it can be turned off in Settings. A hold-to-look-back control was added (C, or B/○). The camera swings to the side and lifts when the Yeti is very close, and the Yeti carries a cold rim light. |
| Flat grey lighting | Sun raised to 4.2 with a warmer colour; hemisphere light 0.25 with a deeper sky colour; environment light 0.3; exposure 0.78. Faces turned away from the sun get a blue shift. |
| Snow doesn't respond to light | Albedo raised to about 0.93; micro-relief amplitude raised to 0.055; sparse sun-aligned ice glints that fade with distance (emissive, no bloom). |
| Single symmetric V trench | Each side of the valley now has its own setback (±25%) and steepness (0.75–1.25×), and treeless avalanche chutes run down the walls. |
| Grey, streaky rock | Rock is projected onto vertical planes on steep faces. The exposure threshold is 0.42 ± 0.12, so rock shows in patches, with a warmer colour, cracks, and snow lodged on ledges. |
| Boulders floating; claw marks look like UI bars | Boulders are sunk 35–55% of their radius into the cliff; the claw marks are thinner, uneven and more transparent. |
| Yeti face edge and triangle count | **Partially addressed:** the triangle count is lower (High ≈ 0.7 M). The hard edge at the face is still there (see KNOWN_ISSUES). |
| Mixed art styles (stylised guests and skier vs a semi-realistic Yeti) | **Not changed:** this is a known limitation of building everything procedurally. |

## C — Cinematic & Narrative (6 / 6, FAIL)

| Finding | Response |
|---|---|
| Beat 5 showed the whole Yeti | It is now a true hand insert at 1.6–1.9 m, fov 28–30, with the head out of frame. |
| The cave reads as a bright tunnel | Ambient and sky light drop by 85% during beats 3–5. The notch was extended behind a larger double-sided black back wall, and the dark floor raised above the terrain. The lurk point moved to 8.5 m inside. |
| Emergence and roar shots too wide | Emergence camera at `at(M,5.2→4.5, 0.6, 2.2→1.8)`, fov 52→50. Roar-wide camera at `at(M,7.5→7, 0.6, 3.2→3)`, fov 46→44. |
| No silence before the roar | The music drops out at 10.65 s; tension music returns on the reaction cut. |
| The leap happens off-screen | A new beat 10b (14.6–15.8 s) films the leap past the skier's shoulder, with a landing burst and shake. The reaction camera moved toward the cave side, and the chase starts where the Yeti lands. |
| Skip fired every event at once | `Timeline.skip()` marks the events fired without running them. Skipping also clears camera trauma and sets tension music. |
| The victory joke was too small | The Yeti's beats are driven by the timeline (stop at 4.6 s, disgust and growl at 5.6 s, turn away at 7.4 s), with a dedicated 5.0–7.6 s close shot. |
| The hockey stop was a spin | It is now a single 90° edge-set with a spray burst. |
| Victory pacing | Letterbox from t = 0; the welcome at 9.4 s; the crane from 12.4 s, rising over the hot tub and lodge to the whole mountain; results at 18 s. |
| Defeat framing; title over the face | The camera now tracks the midpoint between hand and head; the title sits in the lower third; results at 7 s. |
| Captions for growls and roar; pausing the end cinematics | **Not done:** listed in KNOWN_ISSUES. |

## E — QA, Controls & Accessibility (6 / 7, FAIL)

| Finding | Response |
|---|---|
| Restart from pause left the next run muted | `startRun` now calls `audio.setPaused(false)`. |
| Remap rows trapped controller users | B or A cancels the remap, and it times out after 6 s. |
| Corrupt settings could crash the game | `sanitize()` clamps and repairs every field and the key bindings. |
| Non-standard gamepad spun the camera | Axes beyond the left stick are ignored unless the mapping is `standard`. |
| Remapping produced duplicate keys and could lose Escape | A newly bound key is removed from other actions, and Escape is always kept on pause. |
| The Yeti gave up on a skier uphill of it | It now turns around and heads straight for the skier. |
| Contradictory pause rules in the cave cinematic | Esc or Start pauses during the first viewing (when it can't be skipped), and skips on later viewings. |
| Accidental skips with A/B | Only Start, Esc or Enter skip. |
| No menu auto-repeat | Held arrow keys now repeat, and the left stick auto-repeats. D-pad buttons still step one item per press (KNOWN_ISSUES). |
| No sound for gamepad-only players | An on-screen hint appears while audio is still locked. |
| Text size | New "Interface text size" slider (85–150%). |
| Reduce motion still changed FOV and shook the camera | It now gives a constant FOV and no shake. CSS honours `prefers-reduced-motion`. |
| Prompts kept stale glyphs after a device change | Prompt keys now include the device. |
| Reset defaults didn't reapply render scale | Fixed. |
| Controller buttons can't be remapped | **Not done:** listed in KNOWN_ISSUES. |
