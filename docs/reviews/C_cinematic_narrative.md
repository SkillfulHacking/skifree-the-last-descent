# Review C — Cinematic & Narrative Direction

> Internal multi-agent review — separate agent instance of the same model family; not an external/independent human approval.

## What was inspected
- Code: `src/cinematic/CaveCinematic.ts`, `EndCinematics.ts`, `Timeline.ts`; `src/game/GameSession.ts` (intro, foreshadow, skip, transitions, victory autopilot); `src/game/RunState.ts`; `src/yeti/spawn.ts`; `src/audio/AudioCore.ts`, `sfx.ts`, `logic.ts`; `src/camera/FollowCamera.ts` (chaseFrame/avoid); `src/world/Cave.ts` (StoryProps); `src/ui/Hud.ts`.
- Stills: `cave_c01…c12`, `cave_d1…d5`, `end_v01…v09`, `02_gameplay_sign`, `cave_chase_close`, `end_chase_close_avoid`.

## Evidence observed
- The foreshadow chain is real and ordered: footprints z905, snapped tree 912, distant growl 960, sign 1010, growl + branch snap 1120, second trail 1185, snapped trees 1178/1240, near growl 1250. The eerie duck ramps over 1150→1340 (wind ×0.25, music ×0.35). The trigger is at 1372, so the cave (1350) is already 22 m behind the skier.
- Cave audio sync is good. The rumble and snow slide fire at 2.45, 0.05 s after the beat-2 cut. The growl at 4.9 comes just before the eyes at 5.4. A rock knock lands at the hand grip (6.6). The roar fires at 11.05, 50 ms after the wide cut, and runs 2.7 s, past the close-up, ending at about 13.75. The gasp at 13.7 lands on the reaction cut.
- The gameplay→cinematic blend is soft: beat 1 starts from the live camera pose and runs a bezier with inOutCubic easing over 2.4 s. The cinematic→gameplay return ends on `followPose()` and then snaps the follow camera, so it is matched.
- The roar close-up (c09) is the strongest frame: low angle, fangs, eye glow, roar breath vapour.
- The victory crane (v08) ends on the empty valley with the tiny Yeti walking off beside its footprints. Thematically this is a good final image.

## Critical defects
1. **The reveal is spent too early (beat 5).** `handShot(4.2, 36)` at `CaveCinematic.ts:48-52` frames the full torso, the face and the glowing eye at 7.2 s (c05). The rock lip is not in frame. The audience sees the monster in a lit medium shot, and then the "emergence" (c06/c07) shows a smaller Yeti than we just saw. The escalation runs backwards.
2. **The emergence and roar-wide shots make the Yeti small.** In c06, c07 and c08 the Yeti is about 12–18 % of frame height and half-hidden behind a snow berm, while the rock overhang fills the frame. Beat 6–7 is "low angle", but the camera at `at(M,8.5,0.6,3.6)` (`:54`) sits below the berm crest, not under the Yeti. A fix reportedly landed after capture; it is not visible in the stills.
3. **Skip is a hard cut that fires every remaining sound at once.** `tl.flush()` (`Timeline.ts`, called at `GameSession.ts:199-201`) runs every event: roar, rumble, snow slide, rock impact, gasp, `shake(0.9)` and `shakeTrees`. Then `finishCave` adds the RUN sting and the chase music (`:417-419`). The shake trauma goes into the follow camera, so gameplay starts shaking. There is no fade.
4. **The chase starts off-screen.** `finish()` (`:173-184`) teleports the Yeti about 1.6 m and starts the leap after the camera has returned to the follow pose, which looks downhill while the cave is behind it. `RUN.` (c12) appears with no Yeti on screen ("YETI 60 m"). The moment that launches the whole second act is never shown.

## Major weaknesses
- **Cave staging.** c03 and c04 show a through-tunnel with bright daylight snow at the back. A white Yeti in front of white backlit snow is a silhouette inverted against intent: "a huge shadow in the darkness" reads as a small white blob at about 12 m. The ambient scale of 0.15 (`:155-157`) cannot darken an emissive-looking exit.
- **Dead frame in beat 11.** The bezier `via` pose `P+(3,3.5,2)` looking at `P+(0,1.2,4)` (`:72`) gives a near-top-down shot of the skier against blank snow (c11).
- **The reaction shot has no geography.** The camera at `P + downhill·3.6` (`:36,70`) looks back at the skier, and neither the cave nor the Yeti is in frame (c10). There is no eyeline match.
- **The skier is frozen mid-run for 16.4 s** (`simulating=false`) and then resumes at 54 km/h. This is a convention, but it is not motivated.
- **Chase tension depends on the HUD.** The `avoid` logic (`FollowCamera.ts:130-143`) keeps the Yeti out of the lens. Every chase still (17–22 m, "MOVE!") shows no Yeti.
- **Victory comedy beat is unreadable.** The Yeti is about 30 px tall even at fov 22 (v03, v04). His state machine (`EndCinematics.ts:185-219`) is time-decoupled from the camera: disgust plays at about 6.3–8.3 s, and `leave` starts at about 8.3 s, right after the cut at 8.2.
- **"Hockey stop" is a spin.** `steer: 1` held for the whole stopping window (`GameSession.ts:340-345`) draws full circles in the snow (v02, v05).
- **Defeat "chomp" is not framed.** The skier dangles 1.55 m below the hand at the bottom edge (d3), and then simply disappears at 2.55 (`:55-62`). "LUNCH IS SERVED" sits over the Yeti's face (d5). Results at 6.0 leave only 1.4 s of title.
- **Welcome beat is lost.** `welcome=1` at 11.0 (`:172`), and the crane starts at 11.6. The guests are on screen for about 0.6 s. The crane looks uphill, so the resort and guests are never in the hero shot.

## Minor issues
- Victory has no letterbox, unlike the intro, cave and defeat.
- The victory title persists behind the results panel (v09 shows it twice). The results at 16.0 cut the crane 1.5 s early.
- The foreshadow sign is 9 m off the line, so at about 18 m/s it can be on screen for under a second. Foreshadowing is audio-only for long stretches, and there is no visual glimpse of the Yeti.
- No captions for the growls or roar (deaf or muted players lose half the foreshadowing). Cinematics cannot be paused (`isCinematic` blocks pause). The 16 s victory cannot be skipped on retries.
- The `RUN.` title (2.2 s) is not cleared if the defeat starts inside that window (d1).
- The eye glow reads on one eye only (c05, c09).
- The light returns at 7.9 s over about 1.2 s, mid-shot, in front of the camera.

## Recommended corrections
1. **Beat 5, true insert** (`CaveCinematic.ts:48-52`): `handShot(1.6, 28)`. Put the camera below and outside the lip: `hand + O·1.6 + (0,-0.5,-0.9)`, looking at `hand - (0,0.2,0)`. Keep the head out of frame. Add `playImpact('rock-light')` at the finger curl and a falling-snow emit at 6.9.
2. **Beats 3–4:** put a black occluder or back wall behind `cave.inside`, or move `yetiInside` against the rock. Keep the camera at `at(M, 9, 2.4, 0.6)` with fov 34 and show only the eyes and a rim-lit edge. Cap the eye intensity until 5.4.
3. **Beats 6–8:** emergence camera at `at(M, 4.5, 0.25, 1.8)`, looking at `M+(-0.5, 3.4, 0)`, fov 50, with `y` set above `heightAt` plus 0.25 so the berm cannot occlude. Roar wide at `at(M, 7, 0.4, 3)` with fov 44 (Yeti about 60 % of frame height). Add a 0.35 s music dropout at 10.65 (setMusicMode('none') and restore 'tension' at 11.05) so the roar hits from silence.
4. **Reaction and leap:** move the reaction camera to `P + downhill·3 + (+2.5 toward the cave side, 1.4, 0)` so the cave mouth sits soft in the back third. Then add **beat 10b (14.6–15.6)**: run `yetiAI.startChase` inside the timeline and shoot the leap from `P+(2,1.2,-3)` looking at the Yeti's root. Replace the `via` at `:72` with `P+(0,3,-5)`. Show "RUN." only once the Yeti is on screen.
5. **Skip** (`GameSession.ts:199-201`): add a `skipping` flag that makes the audio, shake and tree events no-ops (or tag events and add `flush({silent:true})`). Add a 0.25 s fade to black, then call `finish()`. Clear trauma with `follow.consumeTrauma(1e3)`.
6. **Victory Yeti** (`EndCinematics.ts:126-139,185-219`): drive the beats from the timeline: `tl.at(4.6)` stop, `tl.at(5.4)` disgust plus growl, `tl.at(7.4)` turn away. Insert a **cut at 5.2–7.6** to `yetiStop + toSkier·7 + (0,1.6,0)`, looking at the Yeti's head, fov 35, so his disgust is readable. Return to the two-shot for the departure until 8.6.
7. **Hockey stop** (`GameSession.ts:342`): `steer: stopping ? sign(err)·1 until |heading−travel| > 1.2 rad, then 0`, with brake 1, for one decisive 90° slide plus a spray burst and `playLanding`.
8. **Welcome and crane:** move `welcome` to 9.4 and start the crane at 12.4. Have the crane end at `sk()+(-20,30,-40)` looking at `sk()+(0,10,600)`, i.e. downhill over the lodge and guests. Push `onResults` to 18.0 and clear the title on results. Add the letterbox at victory `t=0`.
9. **Defeat** (`EndCinematics.ts:29-38`): look at the midpoint between hand and head from 1.1–2.6 so the hand-to-mouth arc is framed. At 2.55 add a ski/helmet spit-out (particle plus a prop toss) at 3.0, before the burp. Show the title at 4.6 as a lower-third or offset the camera so the Yeti is left of centre. Results at 7.0.
10. **Accessibility:** add an optional caption line (`[distant growl]`, `[ROAR]`). Allow pause in the cave cinematic, and allow skip on victory after a first win.

## Scores
| Area | Score |
|---|---|
| Yeti cinematic | **6/10** |
| Complete player experience (narrative/pacing) | **6/10** |

**Verdict: FAIL** against the 9/10 bar. The audio timing and structure are close to professional, but the visual escalation inverts (beat 5), the key action (the leap) is off-screen, and both comedic payoffs (the disgust, the chomp) are too small or unframed to land.

## Unverified evidence
- The post-capture fixes are reviewed from code only: the light drop (consistent with c03 and c04), the closer emergence framing (the code values still look too far), chase camera avoidance (end_chase_close_avoid shows the Yeti fully out of shot), and the trophy reframe (the v06 still predates it; the podium-to-hand arc is not shown).
- Not verifiable from stills: motion quality, easing feel, handheld drift, and whether the Yeti 'emerge', 'roar' and 'disgust' animations peak on the cuts.
- Not verifiable without audio: the audio mix, the limiter behaviour on skip (the growl limiter may drop duplicates), and the audibility of positional growls.
- d1 shows the gameplay HUD and the camera inside the Yeti's fur at defeat 0.5 s. This may be a capture artefact (one frame before the timeline applied).
