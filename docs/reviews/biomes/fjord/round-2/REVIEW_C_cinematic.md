# Fjord Coast — Round 2 — Reviewer C: Cinematic & Animation Director

- **Reviewer:** C, Cinematic & Animation Director
- **Nature of review:** model-based reviewer (same model family as the developers; not external)
- **Build:** `aec1812` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`)
- **Date:** 2026-11-10
- **Evidence used:**
  - Every round-2 PNG at 1920×1080: `01`–`11i`, including the nine victory beats `11d`, `11e`, `11f`, `11g`, `11`, `11b`, `11h`, `11i`, `11c`.
  - `res-1366/` (`01`, `02`, `10`). No `res-2560/` existed when I finished.
  - Round-1 PNGs and the Alpine baseline (`07`, `08`, `11*`) for comparison.
  - Source I read: `src/cinematic/CaveCinematic.ts`, `src/world/biomes/fjord/views/{harbourVictory,harbour,seaCave,seaCaveCinematic}.ts`, `src/yeti/SnowballView.ts`, `src/game/GameSession.ts` (snowball captions), `tests/unit/fjord_art.test.ts`.
  - `npx vitest run tests/unit/fjord_art.test.ts tests/unit/snowballs.test.ts`: 13/13 passed.
  - My own measurements, under `scratch/review-c-r2/`:
    - `reveal.test.ts` projects the start, the finish and the route into the 11c camera;
    - cropped and enlarged views of the rear-view inset (`inset_*`), the cave hull (`07_hull.png`) and the 08b orb (`08b_ball.png`);
    - pixel-mean measurements of the cave rock in 07.
  - I read `REMEDIATION_art.md` as a list of claims, and checked each one against the stills and the code.

## 2. Verdict — **FAIL** (Cinematics 7/10 against the 9/10 target)

This is a real improvement on round 1, and most of it is in the victory sequence:

- The après shot is now well staged: plank deck, bathers inside the tub, bonfire in the mid-ground, sauna (`11b`).
- The trophy has a presenter and a reverse angle on the skier.
- The Yeti gag is staged at the stockfish rack.
- The mountain reveal (`11i`, `11c`) now gives the elevation-contrast image the brief asks for, with a legible subtitle.
- The sky artefact is gone.

The sequence is still not at 9/10. The main problems:

- **Cave encounter.** It is the shared Alpine choreography and camera with a garnish layer (gulls, a spray plume, icicle shards). None of these Fjord beats appears in any evidence still. The cave rock is mid-grey-brown, not the claimed "near-black basalt". The mouth is the Alpine mouth.
- **Comic beats.** The fish gag is filmed from behind the Yeti, so the bite and gag only read through the caption (`11f`). The cannonball's payoff frame is a flat white annulus on the water (`11h`). No still shows the plunge itself, and in code the "tuck" is a non-uniform squash of a standing figure.
- **Where the beats are staged.** Five of the nine victory beats (`11d`, `11e`, `11f`, `11g`, `11`) are framed against snow slopes and murk. Without the houses, nothing in those frames says "harbour".
- **The reveal.** It does not land its stated payoff. The run's start is an anonymous point at mid-frame (10 m of height there is 3 px tall), and terrain rises out of frame above it. The title lands while the camera still has about 21% of its move to go, and the final frame holds only 0.5 s.

## 3. Scores

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | **7** | Wide and establishing shots are strong (`01`, `02`, `04`, `10`, `11i`), and the harbour and après sets are much better. Cave props are still primitive: identical flat-shaded hexagonal "bollards" in two neat banks, and a hull that reads as a beige puddle (`07`). Harbour-level victory backgrounds are a grey murk with scattered white rocks (`11d`, `11g`). |
| Environmental uniqueness | **7.5** | The finish, the reveal and the start dressing are clearly not Alpine. The cave still has the Alpine mouth silhouette on a snow slope with no sea in any of its frames (`07`, `08b` against the Alpine `07`). |
| Skiing and hazard mechanics | **7** (low confidence) | Judged from stills only. The windsock (`04`) and the landing column (`09b`, `09c`) read well. |
| Difficulty and fairness | **7** (low confidence) | The orange glint and trail now make the throw readable in the rear-view inset. The text cue still fires only on the first throw. |
| Cinematics | **7** | Up from 5.5: a real Fjord beat sheet, a good après shot, and a better reveal and title. Against that: the cave encounter is shared choreography plus garnish (none of it evidenced); the gag is shot from behind; the plunge payoff is weak and the plunge itself is unevidenced; the presentation pose does not grip the trophy; and the reveal's payoff and timing still fall short of 9/10. |
| Performance and stability | **7** (low confidence) | The manifest reports no errors. I did not profile. Victory dressing, particles and the gull rig were not measured. |
| Accessibility and controls | **7** (low confidence) | The subtitle scrim fixes round-1 legibility (`11c`). Captions cover the gulls and the gag. The snowball caption is still throw-1-only (`GameSession.ts:618`). |
| Overall player experience | **7** | The descent to the sea is memorable, and the closing reveal now pays it off. The encounter in the middle and the comedy beats are still flat. |

## 4. Defects

Severities: Critical blocks shipping; Major is clearly visible or clearly wrong for a 9/10 target; Minor is polish.

1. **Major — The cave encounter is still the shared Alpine encounter, and its Fjord additions are unevidenced.**
   - **Evidence:**
     - `08b_yeti_cinematic.png` is nearly the same frame as round-1 `08b`: same camera, same mouth outline, same staging. The rock has only been retinted.
     - The mouth silhouette in `07` matches `alpine-baseline/07_yeti_cave.png`.
     - The Fjord hook (`seaCaveCinematic.ts:127–147`) only re-frames two shots (fov 46→52, 44→49) and adds gulls at 2.45 s, a spray emit at 11.05 s and icicle particles at 11.25 s. No still is taken between 2.4 and 3.8 s or at 11–12.3 s, so none of these beats has any evidence.
     - The cave rock measures RGB ≈ (86–108, 80–103, 71–93) in `07`, a mid warm grey with lozenge blotches. That is not the claimed near-black basalt.
     - There is no water or sea in any cave frame. The remediation notes admit this as R4.
   - **Fix:**
     - Capture `08c` at about 2.9 s (gull scatter) and `08d` at about 11.3 s (spray plume).
     - Take the Yeti's own action into the hook. For example, it shoves the hull aside, or wades out of the frozen tide pool and cracks the ice.
     - Darken the cave albedo to match the claim, and break the Alpine mouth outline with a basalt-column lintel.
     - Move Fjord caves to the sea side (R4), so the sea is behind the cave in `07` and `08b`.

2. **Major — The fish-rack gag is filmed from behind the Yeti, so the joke only reads through the caption.**
   - **Evidence:**
     - In `11f_victory_gag.png` we see the back of the Yeti's head and its shoulder. The face is in profile, turned away, and the cod is a beige tube at hip height.
     - In `11e` the Yeti is also seen from behind-right.
     - Cause: the Yeti faces the rack centre (`harbourVictory.ts:296–299`), which is +z of the stop point (`harbour.ts:551`, rack at `W(-46,10)`, stop at `W(-46.6,1.6)`). Both cameras sit at −z of it: `this.yetiStop + (4.6, 2, −4.4)` (`harbourVictory.ts:106`) and `rack + (8.5, 2.5, −15.5)` (`:99`).
   - **Fix:**
     - Put the 2b camera downhill of the Yeti, past the rack's far end (for example `yetiStop + (3, 1.8, +5)` looking back at the face), so the bite, the gag face and the fling play toward the lens.
     - Raise the fish to mouth height in the `eat` beat.
     - Add a still at about 6.0 s (the bite) and one at about 6.6 s (the gag face).

3. **Major — The cannonball payoff is a flat decal, and the plunge itself has no evidence and stiff motion.**
   - **Evidence:**
     - `11h_victory_splash.png` at 14.53 s shows no bather, only a faint vertical haze and a hard, flat, opaque white annulus. It reads like a helipad marking. That ring is `RingGeometry(0.7, 1.0)` scaled to about 2.5 m at 0.75 opacity (`harbour.ts:655`, `:821–824`).
     - No still exists between 12.93 s (bather standing, `11b`) and 14.53 s (after the splash).
     - From code:
       - the run-up is 0.275 s over about 1 m (`harbour.ts:790–800`, `edge = home.lerp(to, 0.18)`), with no run cycle, so it is a slide with a bob;
       - the "tuck" is a non-uniform scale of the standing guest (y × 0.58, xz × 1.15) plus a rotation of about 75° (`:808–810`);
       - the splash is 60 small soft particles.
     - The whole après beat lasts 3.6 s, of which the deck shot is 1.9 s (`HARBOUR_BEATS`).
   - **Fix:**
     - Give the bather a real tuck pose (knees up, arms hugging), a 0.6–0.8 s run-up across the deck, and a hang at the apex.
     - Replace the ring with a crown or sheet splash (a few upward cards plus droplets) and a soft, alpha-feathered foam disc.
     - Extend the après beat by about 1.5 s.
     - Capture stills mid-air (about 13.7 s) and at impact (about 14.3 s).

4. **Major — The on-quay victory beats don't read as a harbour; the sea is absent from five of the nine stills.**
   - **Evidence:**
     - `11d`: the skier on a snowfield. The setts are only a faint grid at the right. The background is a murky grey slope with scattered white rocks.
     - `11e` and `11f`: the rack on an empty snow hillside.
     - `11g`: a snowfield and village houses, with the same murky upper band.
     - `11`: the inland spiky range behind the skier.
     - Only `11b`, `11h`, `11i` and `11c` show water.
     - "Onto the quay … painted houses sliding past" (`harbourVictory.ts:4–5`) is not what `11d` shows.
   - **Fix:**
     - Turn the quay track and the presentation so they face seaward: the boats, the warehouses and the lighthouse should be the backdrop. The `ots`/reverse geometry can bias the presenter placement so that the sea stays behind one of the two angles.
     - Shorten `quayZ` (R5) so the water is in the background of the stop.
     - Stage the gag at one of the village racks near the water rather than the one at the snow line.

5. **Major — The reveal's payoff (the summit you started from) is not legible, and the title lands mid-move.**
   - **Evidence:**
     - My projection of the 11c camera (`scratch/review-c-r2/reveal.test.ts`, camera from `manifest.json`) puts the start at pixel (940, 520), mid-frame, where 10 m of height is 3 px.
     - Terrain continues upward above the frame (it reaches about 4.3 km at z −3000). The eye therefore follows the chute out of the top of the frame, and nothing marks the start.
     - The near wall still fills about 50% of `11c`.
     - The title fires at 20.8 s while the inOutCubic move runs to 23.9 s, so about 21% of the move is still to go. The final frame then holds 0.5 s before results (`harbourVictory.ts:29`, `:166–176`). Round 1 asked for 1–1.5 s.
     - `fjord_art.test.ts:81–87` is named "the title lands after it settles" but actually asserts `title < revealEnd`.
   - **Fix:**
     - Mark the start: the start mast's pennant or a lit beacon, a brief glint or a flare at the start gate during the move.
     - Frame so that the start sits on a visible skyline or shoulder (choose the end pose by ray-testing for the first ridge above the start).
     - Move the title to ≥ 23.9 s, or end the move earlier, and hold ≥ 1.2 s.
     - Rename or fix the test.

6. **Minor — The presentation pose doesn't hold the trophy.**
   - **Evidence:**
     - In `11g`, the harbourmaster's mitts are at his ears (the `armsUp` cheer pose, `harbour.ts:712`). The 1.2 m lighthouse is lerped to his right hand (`harbourVictory.ts:253`) and appears to balance on his head; his right mitt is outside the base.
     - His legs are cut by the letterbox.
     - The over-the-shoulder shot shows only the back of the skier's helmet.
     - In `11`, after the toss, he still has his hands at his head, and his face reads as a blank white mask (beard plus grey hair, side-on).
     - "Yellow oilskins" are a yellow puffer parka and beanie, with no sou'wester.
   - **Fix:** Add a dedicated two-hand "present" pose with the hands on the plinth and a follow-through after the toss. Give him a sou'wester or an oilskin silhouette. Frame the over-the-shoulder shot about 0.3 m wider so the skier's shoulder and arm are in.

7. **Minor — The cave props are primitive, and the hull does not read.**
   - **Evidence:**
     - `07` (enlarged in `scratch/review-c-r2/07_hull.png`): the "overturned clinker hull" is a smooth beige-blue lozenge with two sticks. It shows no plank bands, no keel and no strake colour.
     - The columns are identical flat-shaded prisms in two symmetrical banks, like car-park bollards.
     - Icicles hang from bare face well away from any lip (`07`, around x 1140–1300).
   - **Fix:**
     - Model the hull silhouette with a keel line and strakes, and make it larger.
     - Vary column heights, tilts and break-offs so they read as a causeway rather than a fence.
     - Seat the icicles on the brow line.

8. **Minor — The snowball fix is partial.**
   - **Evidence:**
     - Fixed: the orange glint and comet trail are clearly visible in the inset (`inset_round-2_09b/09c`, about 8×20 px against the round-1 ball at 1–2 px).
     - Not fixed:
       - the `[the Yeti hurls a snowball…]` caption is still `throws === 1` only (`GameSession.ts:618`);
       - there is no pulse on the inset border during the wind-up;
       - the ball is not visible in the main view in either still.
   - **Fix:** Add a short repeating caption or glyph on each throw, such as `[snowball!]` throttled to one every 4 s, and pulse the inset frame during the 0.42 s wind-up.

9. **Minor — Smaller staging blemishes.**
   - `11`: the skier's skis touch the bottom letterbox bar (round-1 #8 residual).
   - `11b`: the water near the pier is smeared streaks, and there is a pale blue box under the sauna deck.
   - `11h`: the ladder rungs float off the rail.
   - `08b`: a soft grey orb hangs beside the Yeti's head (probably a lingering sea-smoke particle).
   - `11d`: the skier's tracks form closed concentric circles, as if doing donuts (low confidence that this is the autopilot path).

### Things I could not verify

- The motion of the gull scatter, the spray plume and the icicle shatter (no stills).
- The Yeti's grab, bite and fling timing.
- The arc of the fish prop.
- The trophy toss arc.
- The plunge run-up, airborne motion and splash particles.
- The start of the reveal inside the mist bank (no still at 15.6–17 s).
- Camera smoothness and handheld noise.
- Audio sync.
- The reveal on Standard, Long or Endless lengths (only Sprint was captured).
- Frame rate with the added dressing.
- Captures at 2560×1440.

## 5. What works

- **Après (`11b`):** a planked pier, bathers properly inside the tub, the bonfire in the mid-ground, a smoking sauna, and the village and finish arch behind. It is a clear geographic establishing shot.
- **Reveal (`11i`, `11c`):** the colourful harbour as a tiny strip under a colossal wall. The islands now read as rocky land, and the subtitle is legible over the sky.
- **Trophy (`11`):** the reverse angle shows the skier's celebration with the Yeti small at the rack behind. That is good continuity and gives a reason to cut.
- **Cave emergence (`08`):** the column no longer blocks the frame, the Yeti's hands and feet are planted on the tide-pool ice, and a unit test now guards the camera sightlines.
- **Establishing shots (`01`, `02`, `04`, `10`):** the sky rectangle is gone (`06`), and the harbour reads from above.
- **Snowball glint:** it solves the readability problem in the rear-view inset without cluttering the main view.

## 6. Round-1 defects (my own verification)

| # | Round-1 defect | Status | Basis |
|---|---|---|---|
| 1 | Cave encounter not biome-specific | **Partially fixed** | A hook with gulls, spray and icicles exists in code but has no evidence. The mesh and choreography are shared. The rock is mid-tone, not basalt. |
| 2 | Basalt blocks the emergence shot | **Fixed** | `08` is clear. The sightline test passes. |
| 3 | Victory reuses the Alpine beat sheet | **Largely fixed** | New beats and title. The Yeti still runs an approach, react, `disgust`, `turnAway` skeleton, and the trophy flight is still `TrophyHandoff`. |
| 4 | Après mis-staged | **Fixed** (minor residue) | `11b` |
| 5 | Reveal undermined | **Partially fixed** | It aims at the start and the subtitle is legible. The start is illegible, the title lands mid-move, and the hold is 0.5 s (defect 5). |
| 6 | Peach rectangle in the sky | **Fixed** | `06` |
| 7 | Gag not at the racks | **Fixed**, with a new issue | The rack is in frame, but the gag is filmed from behind (defect 2). |
| 8 | Trophy filmed from behind; skis cut | **Mostly fixed** | Over-the-shoulder plus reverse angle. The skis still touch the bar in `11`. |
| 9 | Throw unreadable in the rear view | **Partially fixed** | The glint and trail work. The caption is still once-only and there is no inset pulse. |
| 10 | Blotchy plaza ground | **Fixed** | Setts in `10b` |
| 11 | Repetitive houses and floes | **Fixed** for houses; **improved** for islands | `10b`, `11b`; `02`, `04` |
| 12 | Hoard mismatch | **Partially fixed** | The boat is replaced, but the hull does not read (defect 7). |
| 13 | No coastal weather in cinematics | **Partially fixed** | Mist at the waterline in `11i`. The mist-bank start of the reveal is unevidenced, and the cave spray is unevidenced. |

## 7. Brief compliance checklist (Fjord bullets relevant to Reviewer C)

| Requirement | Status | Evidence |
|---|---|---|
| Biome-appropriate cave and Yeti encounter (§2) | **partial** | Defect 1 |
| Evidence of the actual cave and victory (§8 C) | **partial** | The victory has nine stills. The cave stills miss every Fjord-specific beat. |
| Memorable victory cinematic (§2) | **partial** | The reveal and après land; the gag and plunge do not (defects 2, 3). |
| Exploit the elevation difference; pull back from the ocean to reveal the mountain | **partial** | `11i`/`11c` are strong, but the start or summit is not legible (defect 5). |
| Coastal-themed trophy presentation | **done** with polish needed | Lighthouse trophy, harbourmaster, reverse angle (defect 6) |
| Playful après-ski celebration | **partial** | Staging is done (`11b`); the plunge payoff is weak (defect 3). |
| Harbour, boardwalk, colourful buildings, fishing boats, distant ships | **done** | `10`, `10b`, `11b`, `11i` (a freighter is on the horizon in `10`) |
| Do not reuse the Alpine resort | **done** | The set and beat sheet are new. |
| Clear skies and excellent visibility | **done** | `01`–`04`, `11c` |
| Occasional sea mist near the water | **partial** | `11i` waterline mist; nothing in the cave frames. |
| Dramatic views across the fjord | **done** | `01`, `06`, `11i`, `11c` |
| Hard-mode throw readable in ordinary chase (§10) | **partial** | Readable in the inset; text cue only on the first throw (defect 8). |
