# Progression: gameplay events, achievements and cosmetics

This document covers the foundation for achievements and future cosmetic customisation. It includes:

- the gameplay event schema and bus;
- the achievement model and evaluator;
- local persistence and save migration;
- the persist policy that keeps test runs from awarding anything;
- the cosmetic item model and its proof of concept;
- the planned Locker / Character Customisation screen;
- the progression philosophy.

| Piece | Code |
|---|---|
| Event schema + bus | `src/game/events.ts` |
| Events derived from physics (jumps, drifts, pizza, milestones, crashes) | `src/game/telemetry.ts` |
| Events from run flow (start, finish, Yeti, refuges, snowballs) | `src/game/GameSession.ts` (search `events.emit`) |
| Achievement definitions, statistics reducer, evaluator, view model | `src/progression/achievements.ts` |
| Versioned save + migrations | `src/progression/save.ts` |
| Tracker (subscribes to a run, applies the persist policy) | `src/progression/tracker.ts` |
| Cosmetic items, ownership, loadout | `src/progression/cosmetics.ts` |
| Achievements screen, unlock toast, icons | `src/ui/achievementsView.ts`, `src/ui/icons.ts`, `src/ui/progression.css` |
| Wiring, Achievements + Locker screens | `src/game/App.ts` (`initProgress`, `trackSession`, `achievementsScreen`, `lockerScreen`) |
| Tests | `tests/unit/events.test.ts`, `tests/unit/achievements.test.ts`, `tests/unit/cosmetics.test.ts`, `tests/e2e/progression.spec.ts` |

## 1. Gameplay events

`GameSession` owns one `EventBus` per run (`session.events`). The bus is typed and synchronous, and it uses no framework. It has these properties:

- **Synchronous and ordered.** An event emitted inside a listener is queued and delivered after the current event, so every listener sees events in the same order.
- **Fault-isolated.** A listener that throws is logged. Gameplay and the other listeners carry on.
- **Plain data.** Events contain no three.js objects. Distances are in metres, times in seconds and speeds in m/s.

Events come only from **validated gameplay state**: physics results, `RunState` phase transitions and Yeti AI outcomes. They never come from the HUD or the cinematics.

| Event | Fields | Emitted when |
|---|---|---|
| `RunStarted` | `courseId, mode, length, biome, difficulty, date` (the run context) | first simulated physics step (the player has control) |
| `BiomeVisited` | `biome` | right after `RunStarted` |
| `RunFinished` | context + `outcome` (`victory`/`caught`/`retired`), `distance, time, refuges, crashes, score` | the outcome becomes final: finish crossed, caught, or Endless retire. An abandoned run (restart/exit) has no `RunFinished`. |
| `DistanceReached` | `meters` (1000, 2000 …) | each whole kilometre down the course |
| `JumpLanded` | `airtime, distance` (horizontal, takeoff→landing), `clean, landed` (`false` = crashed on landing) | landing of any jump with airtime > 0.12 s |
| `DriftCompleted` | `duration, distance, surface` (dominant), `surfaces` (seconds per surface), `controlled` (`false` = ended in a crash) | a drift ≥ 0.25 s ends |
| `PizzaBraking` | `distance` | every 25 m of controlled pizza, plus the remainder at run end. "Controlled" means grounded, not crashed, not drifting, brake ≥ 0.5 and speed > 2 m/s. |
| `ObstacleHit` | `kind` (tree/rock/log impact kind), `intensity` | each physics impact |
| `Crashed` | `reason` | each wipe-out |
| `SnowballThrown` | – | the Yeti releases a snowball (Hard) |
| `SnowballDodged` | `distance` | a ball lands and the skier is outside its marked zone (> 4 m) |
| `SnowballHit` | `direct, distance` | direct hit (< 2.2 m) or glancing near miss (< 4 m) |
| `YetiEncountered` | `encounter, difficulty` | the cave cinematic ends and the chase begins |
| `YetiEscaped` | `encounter, via` (`refuge`/`finish`), `chaseTime, closestGap` (nearest the Yeti got in that chase, m) | a refuge is reached, or the finish is crossed |
| `RefugeReached` | `index` | a refuge (checkpoint) is reached |
| `ScenicLocationDiscovered` | `biome, id` | the skier reaches a viewpoint on a coast's rim (Fjord Coast: `lookout-<n>`), once per run per id |
| `HazardSurvived` | `biome, kind` | an environment `hazard-passed` without a hit (Fjord: `sea-gust`; `scoured-rock` only if the skier kept off it) |

The schema is a discriminated union (`GameEvent`). Adding a field is backward compatible. Renaming or removing a field is not, because achievement criteria read the fields.

### Emitting events from biome code

Biome hazards and scenery must not import the progression code. They report through the session, which stamps the current biome id:

```ts
session.reportHazardSurvived('vent-zone');   // → { type: 'HazardSurvived', biome: <course biome>, kind: 'vent-zone' }
session.reportScenicDiscovered('lookout-1'); // → { type: 'ScenicLocationDiscovered', biome: <course biome>, id: 'lookout-1' }
session.emitEvent(e);                         // any other GameEvent
```

Follow the same pattern as the snowballs:

1. A hazard module steps in the fixed physics step and pushes its own small events (for example `{ type: 'cleared', kind }`) into an array.
2. `GameSession` drains that array and calls `reportHazardSurvived`.
3. Report **"survived"** only from validated state: the skier passed the hazard's far edge (by course z) and has not crashed since entering it. Never report it from a visual effect.
4. Report **"discovered"** once per run per id, when the skier comes within the viewpoint's trigger radius.
5. Ids and kinds are stable strings (lower-case, `-` separated). The achievements listen for:

| Biome id | Event | Achievement |
|---|---|---|
| `fjord` | `ScenicLocationDiscovered` (any id) | Scenic Route |
| `whiteout` | `RunFinished` (victory, Normal or Hard) | Whiteout Survivor (needs nothing extra) |
| `frozen` | `DriftCompleted` (`surfaces.ice` ≥ 3 s) | Ice Dancer. Needs the Frozen surface to report `ice` from `Mountain.surfaceAt`. |
| `volcanic` | `HazardSurvived` with `kind: 'vent-zone'` | Steam Runner |

If a biome ships under a different id, change `BIOME_IDS` in `src/progression/achievements.ts`. The achievement ids stay the same.

## 2. Achievements

### Model

```ts
interface AchievementDef {
  id: string;              // stable forever: the save key
  name: string; description: string;
  category: 'journey' | 'skill' | 'yeti' | 'exploration' | 'daily';
  icon: string;            // icon id (src/ui/icons.ts)
  hidden?: boolean;        // shown as ??? until earned
  biome?: string;          // associated location
  reward?: string;         // cosmetic item id granted on unlock
  requires?: string;       // content not in the game yet (shown on the locked card)
  progress?: { target: number; value: (stats) => number; unit?: string };
  unlock: (event, { stats, run, now }) => boolean;   // pure
}
```

### Evaluation

The evaluator is `evaluateEvent(stats, earned, event, { run, now })` in `achievements.ts`. For each event it does three things:

1. It folds the event into the persistent **statistics** (`accumulateStats`). Statistics are generic `counters: Record<string, number>` and `sets: Record<string, string[]>`.
2. It asks every unearned definition whether this event unlocks it.
3. It records `earned[id] = { earnedAt: now }`.

The function is pure apart from mutating the state passed in. The clock is injected, so tests are deterministic. A definition that throws is treated as "not unlocked".

`reconcileProgress()` handles progress achievements added in an update. It earns them at load if the stored statistics already meet the goal.

### The achievements

| Id | Name | Exact criterion | Status |
|---|---|---|---|
| `first-descent` | First Descent | `RunFinished` with `outcome: 'victory'` (finish crossed) on any course. Endless has no finish. | works |
| `not-today-yeti` | Not Today, Yeti | any `YetiEscaped` (a refuge reached, or the finish crossed, during a chase). Reward: **Glacier Blue** jacket. | works |
| `pizza-party` | Pizza Party | `counters.pizzaMeters` ≥ 1,000. The counter is cumulative across runs. It counts controlled pizza only (grounded, upright, not drifting, brake ≥ 0.5, speed > 2 m/s), measured along the ground track. Progress bar. Reward: **Pesto Green** jacket. | works |
| `airborne` | Airborne | `JumpLanded` with `landed` and `airtime ≥ 1.6 s`. 1.6 s is the physics' own BIG AIR threshold (`SkierPhysics.land`). On a skilled line, simply rolling over the kickers gives at most 1.42–1.57 s (classic course and three generated 10 km seeds). Tucking into a kicker and popping off the lip gives 2.2–2.4 s. The unit test checks both cases on the classic course. | works |
| `long-haul` | Long Haul | `RunFinished` victory with `length: 'expedition'` (50 km) | works |
| `daily-ritual` | Daily Ritual | Reach the resort on the Daily Mountain on **3 different dates**. Each win must be the Daily of the UTC day it was played on: the event's `date` equals the UTC date when `RunFinished` is evaluated. Replaying a past day doesn't count. Any length, any difficulty. Stored as `sets.dailyDays`. Progress bar. | works |
| `dodgeball` | Dodgeball | `counters.snowballsDodged` ≥ 10. A dodge is a snowball that lands with the skier outside its 4 m zone (Hard only). Progress bar. | works |
| `close-shave` | Close Shave (hidden) | `YetiEscaped` with `closestGap < 6 m`. The catch distance is 2.7 m. | works |
| `scenic-route` | Scenic Route | `ScenicLocationDiscovered` with `biome: 'fjord'` | works (Fjord Coast viewpoints) |
| `whiteout-survivor` | Whiteout Survivor | `RunFinished` victory with `biome: 'whiteout'` and difficulty `normal` or `hard` | needs the Whiteout Ridge biome |
| `ice-dancer` | Ice Dancer | `DriftCompleted` with `controlled`, `surfaces.ice ≥ 3 s`, in a run whose `biome` is `frozen` | needs the Frozen Frontier |
| `steam-runner` | Steam Runner | `HazardSurvived` with `biome: 'volcanic'`, `kind: 'vent-zone'` | needs the Volcanic Expanse |

Scenic Route works since Fjord Coast shipped. The other three location achievements are defined and visible now, with a dashed card reading "Needs the … location (coming soon)". Alpine never emits their events, so they cannot be earned there; `tests/unit/achievements.test.ts` checks this. They unlock without any further change once a biome emits its events.

### Achievements screen

The screen is reached from **Main menu → Achievements**. The main-menu row shows `earned / total`. The screen has:

- a summary line;
- a 3-column card grid (2 columns below 980 px wide). Each card shows the icon, name, description and category, plus one of: earned date, progress bar, "needs location" note, or reward;
- hidden achievements shown as **???** until earned;
- **Locker** and **Back** buttons.

It is an ordinary menu screen, so keyboard (arrows, Enter, Esc), gamepad (D-pad, A, B) and mouse work as in every other menu. At 1366×768 and larger, everything fits without any scrolling. Below that, the grid alone scrolls inside the fixed panel. The e2e test measures 1366×768, 1920×1080 and 1280×720.

An unlock during play shows a toast at the bottom left, styled like the HUD, with a queue. If the achievement has a reward, the toast names it. Toasts from test runs read "Test run: not saved".

## 3. Persistence

The save lives under localStorage key `skifree-tld.progress`. It is separate from settings (`skifree-tld.settings.v1`) and records (`skifree-tld.records.v2`).

```jsonc
{
  "version": 2,
  "achievements": { "first-descent": { "earnedAt": 1762689600000 } },
  "stats": {
    "counters": { "pizzaMeters": 412.5, "wins": 3, "snowballsDodged": 4, "hazard:volcanic:vent-zone": 1 },
    "sets": { "dailyDays": ["2026-11-08"], "biomesVisited": ["alpine"] }
  },
  "cosmetics": {
    "owned": { "jacket.glacier-blue": { "at": 1762689600000, "source": "achievement:not-today-yeti" } },
    "equipped": { "jacket": "jacket.glacier-blue" }
  }
}
```

- **Versioning.** `PROGRESS_VERSION = 2`. `MIGRATIONS[v]` turns version `v` into `v + 1`, and load runs them stepwise.
  - v1 had achievements and stats only.
  - **v1 → v2** adds `cosmetics` and grants the rewards of achievements already earned (source `migration:<id>`).
  - After migration the data is sanitised. Every field is type-checked and repaired; counters must be finite and ≥ 0, and sets are de-duplicated string arrays.
- **New achievements need no format change.** A save is just earned ids plus generic stats. A new definition starts unearned, or is reconciled from existing stats.
- **Unknown ids are preserved.** Earned ids, owned item ids and top-level keys this build doesn't know are kept and written back unchanged. They come from a removed definition or a newer build. Unknown ids are never shown.
- **Newer save version.** The save is loaded best-effort and **read-only**: this build never writes it back, so a downgrade cannot destroy progress.
- **Corrupt data.** Unparseable JSON or a missing or invalid version is copied to `skifree-tld.progress.corrupt`, and the player starts fresh.
- **Earned timestamps.** These are the wall-clock milliseconds when the evaluator ran.

### Persist policy: test runs never award anything

`ProgressTracker.attach(bus, persist)` evaluates a run on a **working copy** of the save. It commits the copy (writes it) at each unlock, at `RunFinished`, and when the run ends or is abandoned, but only if `persist()` is true at that moment.

- The App passes `persist = () => !debugHarness && !session.debugUsed`. `debugHarness` is true when the page was opened with `?debug`; the automated e2e suites use that harness.
- `session.debugUsed` is set by every debug control: teleport, fast-forward (`advance`), frame stepping (`frames`), autopilot, forced chase or cave skip, and Yeti placement.
- **Taint is sticky.** Once `persist()` returns false during a run, nothing from that run is ever committed.
- Unlocks in a test run are still reported (toast "Test run: not saved"), so harness runs can observe them.
- **Headless simulations** (`src/game/simulate.ts`) never construct a session, bus or tracker and never touch storage. A unit test runs one with a spy `localStorage` and checks this.
- **Player choices are not awards.** Equipping a cosmetic is written immediately (`tracker.updateSaved`), including under `?debug`, so the Locker can be tested end to end. It cannot grant ownership.
- Tests cover every case: normal run commits, debug run writes nothing, mid-run taint, no store, read-only save, simulation, and the browser end to end.

## 4. Cosmetics

### Model

```ts
interface CosmeticDef {
  id: string;                 // "<category>.<name>", stable forever
  category: 'jacket' | 'pants' | 'helmet' | 'goggles' | 'gloves' | 'skis' | 'outfit' | 'model' | 'yeti' | 'victory-pose';
  name: string; description: string;
  rig: 'skier-v1' | 'yeti-v1';  // which character rig it fits
  unlock: { kind: 'default' } | { kind: 'achievement'; achievement: string };
  look: { color?: number };    // visual parameters only; interpreted by the category's applier
  covers?: CosmeticCategory[]; // e.g. an outfit covers jacket + pants
}
```

- **Ownership and equipped are separate.** `owned` (id → when and why) is set only by grants. `equipped` (category → id) is the player's choice. `equip()` refuses unknown, unowned or rig-incompatible items.
- **The resolved loadout never breaks.** `resolveLoadout()` returns, per supported category, the equipped item if it is known, owned and fits the rig, and otherwise the category's default. This holds for hand-edited saves, removed items and items from a newer build.
- **Rig compatibility.** Every item names the rig it was made for. A future second character model (a new rig tag) only lists its own items. An equipped item for another rig falls back to the default instead of producing a broken mix.
- **No gameplay effect.** `look` holds only visual parameters. Nothing in physics, the Yeti or scoring reads cosmetics, and a unit test checks that `look` has only visual keys. There is no store, currency or monetisation.

### Proof of concept

There are three jackets: **Summit Red** (default), **Glacier Blue** (reward for *Not Today, Yeti*) and **Pesto Green** (reward for *Pizza Party*).

- `SkierModel.setJacketColor()` recolours the jacket, its sheen, the goggle strap and the contrasting stripe in place, with no shader recompile. The same colour is passed to the model's constructor when a world is built.
- **Main menu → Achievements → Locker** has a *Jacket* selector that cycles through owned jackets only. Locked jackets are listed with the achievement that unlocks them. The menu skier in the background changes colour immediately.

## 5. Future Locker / Character Customisation screen

This section is a plan; none of it is built yet. The current Locker is deliberately minimal: one selector. The full screen would be designed like this:

- **Layout.** A left column of category tabs: Character, Outfit, Jacket, Pants, Helmet, Goggles, Gloves, Skis, Victory pose, Yeti. A centre item grid shows owned items first; locked items appear greyed with their unlock condition, and hidden-achievement rewards show as ???. On the right is a **live 3D preview**: the skier on a turntable in the menu scene, with buttons to preview the tuck, drift and victory poses.
- **Preview without commitment.** Browsing applies items to the preview only. Confirm writes `equipped`. Back discards the change.
- **Coherence rules.**
  - An `outfit` sets `covers` and disables the categories it replaces while worn.
  - Colourways follow a curated palette, and the stripe colour is derived automatically, as `setJacketColor` already does.
  - A "Randomise owned" button picks only from compatible combinations.
- **Rig switching.** Choosing a different character model (a new `rig`) filters every category to that rig. The App rebuilds the model at the next world build. Per-rig loadouts can be stored as `equipped["<rig>/<category>"]` without a format change.
- **Victory poses** are `victory-pose` items that pick a clip for `VictoryCinematic`. **Yeti cosmetics** use the `yeti-v1` rig (fur tint, scarf) and are applied to `YetiModel`.
- **Input.** The screen uses the same `MenuSystem` navigation: up/down within a column, left/right between columns, A to confirm, B to go back, mouse hover and click. Layout target: no scrolling at 1366×768.
- **Persistence.** No new format is needed: `cosmetics.owned` and `cosmetics.equipped` already hold everything. New item kinds are new definitions only.

## 6. Progression philosophy

- **Reward mastery and exploration, not grinding.**
  - Most achievements are single moments of skill or discovery: a big air, a close escape, a viewpoint, a full Expedition.
  - Cumulative ones are small. 1,000 m of pizza takes a few runs. Ten snowball dodges take one or two Hard chases.
  - Daily Ritual asks for 3 days, not 30.
- **Basic customisation comes quickly.** Both alternate jackets come from achievements a new player earns in their first sessions. Nothing requires hundreds of runs.
- **Locations are never locked.** Every biome is selectable from the start. Biome achievements reward doing something in a location, not reaching it.
- **Future rewards are themed and earned by play.** Each biome could award an apparel set for mastering it (for example, finishing on Hard, or its hazard achievement). Daily streak milestones could award ski designs. Hidden scenic locations could award goggles or victory poses. These would be added as achievements with a `reward`, with no format change.
- **Test runs never count.** Automated and assisted runs earn nothing persistent, so the numbers in a player's save always mean something.
