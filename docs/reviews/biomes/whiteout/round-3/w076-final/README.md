# W-076 — final hand-off (owner's decisions 1–3)

## Decision 1 — the camera faces the run when control returns
**Implementation:** `872ac4d`; unchanged since. Later commits change only the Whiteout terrain, hazard
placement and presence cues.

The cinematic's last beats (`src/cinematic/caveHandoff.ts`, `CaveCinematic.ts`):

| Time (s) | Beat |
|---|---|
| 13.7–14.2 | the skier looks back over their shoulder (unchanged) |
| 14.2 (a cut) | the Yeti takes his place on the ledge, standing, facing the piste; a growl — **CAVE_GATHER_AT** |
| 14.2–14.7 | over the skier's shoulder, the Yeti on the ledge (the leap set-up) |
| 14.7–15.8 | **the swing:** the camera orbits round the skier (`cinematic/orbit.ts`), from the Yeti to the follow camera's own forward pose. The skier turns to face the run and the letterbox opens (0.7 s). Total turn 113–137°, at most 3.2° per 60 fps frame (unit test, 3 locations × 2 arrival speeds × Normal/Hard). |
| 15.8 — **CAVE_LEAP_AT** | the cinematic ends and control returns, on exactly the pose a skip gives (`GameSession.gameplayPose` = the snap `finishCave` does). He leaps behind the player (the chase AI). On the same frame: **RUN.** and its sting. On touchdown: thud, shake and snow burst. |

- **Reduce Camera Motion:** no swing. A hold on the Yeti, then one cut to the forward view at 15.25 s.
- **After control returns, the camera never looks back on its own.** The 3.5 s automatic look-back
  (`camera/handoffBlend.ts`, `FollowCamera.lookBackOverride/lookBackAim`) is removed.
- **Kept:** the player's own look-back (C / pad B) and the rear-view inset. The inset is no longer held
  back during the leap, so the leap and the landing show in it.
- **The watched and skipped paths use the same gameplay camera** from the first controllable frame on.
  Only the presentation before it differs.

## Decision 2 — the canonical start is kept
Unchanged since `471227d`: the Yeti on the ledge, his leap beginning on the first controllable frame, the
standard start delay and slow-start rules. The parity tests are kept (`tests/unit/cave_handoff.test.ts`,
`tests/e2e/cave_skip.spec.ts`).

## Decision 3 — tension
See `../../balance/tension/README.md`. In summary:
- **Presence cues (presentation only; `src/yeti/presence.ts`):**
  - out of sight (beyond 110 m), a distant call from behind every 9–14 s, captioned;
  - a ▲ CLOSING warning on the Yeti widget while the gap shrinks by more than 1.5 m/s within 90 m.
- **No change** to the AI, its speed, its start, the Hard modifiers or the slow-start rules.
- **Alpine:** mistakes still create no pressure on Normal. Logged as W-077 with the evidence. It is not
  changed in this pass.

## Evidence
| What | Where | Commit |
|---|---|---|
| Unit: the swing (continuity, ≤ 3.6°/frame, skier in frame, above the snow, never through the skier, ends exactly on the gameplay pose; that pose looks down the route) | `tests/unit/handoff_camera.test.ts` | `872ac4d`+ |
| Unit: watch/skip parity (8 leave moments, 3 locations, slow/fast, retry, Endless) | `tests/unit/cave_handoff.test.ts` | unchanged |
| Unit: presence cues | `tests/unit/presence.test.ts` | `1d88f0a` |
| Browser: watched vs Escape at 1 s, pad Start at 9 s, Escape mid-swing, pad Start 0.1 s before control. First-time Escape pauses. Same chase state and same camera (≤ 0.05 m, ≤ 2°) on the hand-off frame and 2 s later. The swing ≤ 7.2° per 1/30 s frame, with no jump at the hand-off. The first controllable frame and the next 2 s look downhill. Held C turns the view round and lets it go. Cases: Alpine, Fjord and Whiteout on Normal; Alpine slow arrival; Whiteout Hard; Fjord Hard with Reduce Camera Motion. | `e2e_cave_skip.txt` | `dist` built from `1d88f0a` |
| Renderer strip: 13.9 s → about 1.5 s into the chase, every 0.27 s, three locations | `strip/` (manifest records the commit) | see manifest |
