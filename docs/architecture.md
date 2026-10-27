# Architecture

How FitLog works inside. For step-by-step recipes see [content-guide.md](content-guide.md).

## Start-up

```
popup.html loads js/*.js in order, app.js last
  app.js: buildTabs()               creates every tab button and an empty panel from TAB_DEFS
          load()                    reads chrome.storage.local, migrates older saves, loads account, workouts, draft and the active character
            no account, or not onboarded -> showAccountSetup()     onboarding step 1: name, weekly goal, theme
                 then: no characters -> showCreate(false, true)   onboarding step 2: first character
                       characters, one active -> startApp()
                       characters, none active -> showCharacterSelect()
            has active character          -> startApp()            HUD + tab bars + Log tab
            otherwise                     -> showCharacterSelect() (or the create screen if there are no characters)
```

The popup is a fresh page every time it opens, so every start reads storage again. Nothing is kept in memory between openings.

## State

FitLog has two layers, and each piece of state belongs to exactly one of them:

| Layer | Owns | Why |
|---|---|---|
| **Account** (one per install) | the workout log, the workout being typed, the weekly goal, account XP and level, the theme | The workouts are the real data. Stats and History should cover everything you ever logged, whichever character was active. |
| **Character** (many) | class, avatar, XP and level, Strength/Agility levels, gold, gear, quests, cleared quests | The game layer. It reacts to workouts but never owns them. |

The state lives in top-level variables in `state.js`:

| Variable | Layer | Holds |
|---|---|---|
| `account` | account | `name, weeklyGoal, xp, onboarded, createdAt` |
| `workouts` | account | The workout log, newest date first |
| `draft` | account | The workout being typed on the Log tab (survives switching characters) |
| `characters` | both | Every character, keyed by id (the whole save) |
| `activeId` | | Id of the character being played, or `null` on the select screen |
| `profile` | character | The active character: `id, name, classId, avatar, xp, stats, cleared, gold, masteredAt` |
| `inventory`, `equipped`, `quests` | character | The active character's gear and quest runs |
| `questView`, `theme`, `statsView`, ... | UI | Not saved per character (`theme` is saved globally) |

Rule of thumb: if you are adding something a player would still want after deleting a character, it belongs to the account.

**Saving.** Change the variables, then call the matching function from `storage.js`:

| Function | Writes | Use after changing |
|---|---|---|
| `persist()` | the active character, plus the account | XP, gold, gear, quests |
| `persistAccount()` | the account | name, weekly goal |
| `persistWorkouts()` | the workout log | deleting or adding workouts |
| `persistDraft()` | the draft | typing on the Log tab (called on every keystroke, so it is kept small on purpose) |

## Storage format

Everything is in `chrome.storage.local` (quota about 10 MB; add the `unlimitedStorage` permission if histories ever get that large).

```jsonc
{
  "schema": 2,
  "account": { "name": "Sam", "weeklyGoal": 3, "xp": 1200, "onboarded": true, "createdAt": 1792944000000 },
  "workouts": [ /* the account's workout log, newest first */ ],
  "draft": { "date": "2026-10-25", "name": "", "exercises": [ /* as typed */ ] },
  "characters": { "<uuid>": { /* character, below */ } },
  "activeId": "<uuid>" | null,
  "theme": "gameboy"            // only present once the player picked one
}
```

A workout (account level). `character` and `characterId` record who was playing; they are display-only, and older workouts may lack them:

```jsonc
{
  "id": 1792944395094, "date": "2026-10-25", "name": "",
  "character": "Tanaka", "characterId": "<uuid>",
  "exercises": [
    { "name": "Squat",   "type": "strength", "sets": [{ "reps": 5, "kg": 80 }] },
    { "name": "Running", "type": "agility",  "km": 2.5, "minutes": 0, "sets": [] }
  ]
}
```

A character. It holds no workouts and no draft:

```jsonc
{
  "id": "<uuid>", "name": "Tanaka", "classId": "salaryman", "avatar": "salaryman_default",
  "xp": 100,                                  // character XP, capped at MAX_XP
  "stats": { "strength": 5, "agility": 50 },  // stat XP, capped at STAT_MAX_XP (levels are derived)
  "cleared": { "s1": 1 },                     // quest id -> times cleared
  "gold": 0,
  "masteredAt": null,                         // timestamp of first reaching max level (the account bonus was paid then)
  "inventory": [{
    "id": "<uuid>", "slot": "feet", "look": "loafers", "rarity": "uncommon",
    "name": "Office Loafers", "stats": { "strength": 1, "agility": 1 }
  }],
  "equipped": { "weapon": null, "head": null, "body": null, "neck": null, "feet": null },
  "quests": {
    "strength": { "id": "s1", "stage": 0, "left": 20, "last": "10 damage to Stray Dog", "startedAt": 1792944394730 },
    "agility":  { "id": "a1", "stage": 0, "left": 2.5, "last": "2.5 km", "startedAt": 1792944394878 }
  }
}
```

Notes:

- **Levels are never stored.** They are computed from XP (`levelOf`, `statInfo`, `accountLevel`), so changing a curve or a cap re-levels everyone without a migration.
- `left` in a quest run is the remaining hp (strength) or remaining km (agility) of the current stage. `stage` indexes `[...encounters, boss]`.
- A strength exercise has `sets`; an agility exercise has `km` and `minutes` and an empty `sets`. Older workouts may be missing `km`.
- Items store their `look` id. Items from before looks existed lack it and are resolved by name in `lookOf()` (`loot.js`).
- `loadCharacter()` fills in missing character fields with defaults, and `load()` does the same for the account. When you add a field, give it a default there.

### Migration

`migrateStore(raw)` in `storage.js` is a pure function that brings any older save up to the current `SCHEMA`. `load()` writes the result back and removes the legacy keys. It never touches a save that already has `schema: 2`.

| Schema | Shape | What the migration does |
|---|---|---|
| 0 | One unnamed character as top-level keys (`profile`, `workouts`, `draft`, ...) | Becomes a character in the salaryman class; old gear and quest runs are dropped (`fromV0`) |
| 1 | `characters` only; each character carried its own `workouts` and `draft` | `fromV1`: workouts of all characters are merged into one log (deduplicated by id, newest first, tagged with the character's name); the active character's draft becomes the account draft; an account is created (name from the active character, default goal, XP = the characters' XP plus the mastery bonus for any character already at max level) with `onboarded: false`, so the player sees the account screen once |
| 2 | `schema`, `account`, `workouts`, `draft`, `characters`, `activeId`, `theme` | Current |

To change the format again: bump `SCHEMA`, add a `fromV2()` step, chain it in `migrateStore()`, and add a test that seeds the old shape (see `tests/e2e-account.js` if you have the tests folder).

## Rendering

There is no framework. Each tab has a `render<Name>()` function that clears its panel and rebuilds it with `h()`:

```js
panel.replaceChildren(h('div', { class: 'card' }, h('div', { text: 'Hello' })));
```

`h(tag, props, ...children)` (in `dom.js`): props starting with `on` become event listeners, `text` sets `textContent`, `false`/`null` props are skipped, other props become attributes, and children can be nested arrays or `null`. There is no HTML parsing anywhere, which is what makes user-entered names safe.

`showTab(name)` shows the panel, calls `RENDERERS[name]()` and scrolls to the top. Re-render after state changes with the same function (`renderBag()` after equipping, and so on).

The exception is the Log tab: re-rendering while someone types would drop focus, so `exerciseCard()` swaps only its own body (`renderBody()`), and typing handlers just write to `draft` and call `persist()`.

### Sprites

`spriteFrom(rows, cssClass)` in `dom.js` turns 16 strings into an SVG with one `<rect>` per pixel. Characters map to CSS classes (`TONE_CLASS`): `#` is `.px-1` (`--dark`), `+` is `.px-2` (`--deep`), `s` is `.ch-skin` (`--skin`). Because fills are CSS variables, themes recolor sprites for free. `shape-rendering: crispEdges` plus whole-number sizes keep pixels sharp.

The Gear tab headshot is `headshotRows()` in `gear.js`: copy the class's base headshot, then paint the look layer of each equipped body, neck and head item over it.

### Theming

All colors are CSS custom properties on `:root`, overridden by `[data-theme="..."]` blocks in `popup.css`. `applyTheme()` sets `data-theme` on `<html>`.

| Token | Role | Game Boy | Night |
|---|---|---|---|
| `--light` | Page background | `#9bbc0f` | `#070914` |
| `--mid` | Panels, inputs | `#8bac0f` | `#11152b` |
| `--deep` | Shadows, `+` sprite fill, grid lines | `#306230` | `#7f88b0` |
| `--dark` | Text, borders, `#` sprite outline | `#0f380f` | `#e6eaff` |
| `--muted` | Secondary text | `#245024` | `#9aa3cc` |
| `--bar-bg` / `--bar-fg` | Header, bottom bar, gold card, toast, banners | dark / light | `#0b0e20` / `#e6eaff` |
| `--bar-dim` / `--bar-edge` | Dimmed text and outline on those bars | `#8bac0f` / dark | `#8d96c0` / `#6b739a` |
| `--skin` | Skin pixels (`s`) | `#8bac0f` | `#7f88b0` |
| `--scrim` | Dim layer behind the present dialog | translucent dark green | translucent near-black |

## Progression

- **Character level** = `min(MAX_LEVEL, floor(xp / 1000) + 1)`. Level 10 is reached at 9,000 XP, and character XP stops growing there (`addXp`).
- **Account level** = `floor(account.xp / ACCOUNT_XP_PER_LEVEL) + 1`, with no cap. Account XP comes from two places:
  1. every call to `addXp()` (workouts and quest rewards) adds the **full** amount to the account, even when the character is already at its cap, so a maxed character still moves the account forward;
  2. a one-off `ACCOUNT_XP_MASTERED` bonus the first time a character reaches max level (`masteredAt` records it, so it is paid once per character).

  Deleting a character does not remove the account XP it earned.
- **Strength / Agility level** comes from cumulative thresholds `STAT_CUM`, built from a cost of `round(100 x 1.25^(level-1))` per level, which gets steeper by design:

  | Level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
  |---|---|---|---|---|---|---|---|---|---|---|
  | Stat XP needed | 0 | 100 | 225 | 381 | 576 | 820 | 1,125 | 1,506 | 1,983 | 2,579 |

  Strength XP is 5 per logged set. Agility XP is 20 per km.
- **Effective stat** = level + gear bonus (`effStat`). This is what quest requirements are compared against. The bonus is the sum of `stats` over equipped items (`gearBonus`). That is the whole point of gear: levels stop at the cap, requirements can go above it.

## Saving a workout

`saveWorkout()` in `workout.js`, in order:

1. Turn the draft into clean exercises. A strength exercise needs a name and at least one set with a number in it. An agility exercise needs a name and `km > 0`. Everything else is dropped; if nothing is left, show a toast and stop.
2. Add the workout to the account's `workouts` (newest date first), tagged with the active character's name and id, and reset the draft.
3. Work out stat XP gains: sets x `STAT_XP_PER_SET` for strength, `round(km x XP_PER_KM)` for agility. Snapshot character XP, account XP and stats as `before` (used to detect level-ups).
4. `applyQuests()`: for each path that has an active quest, apply this workout's progress (below). A quest clear adds its `rewardXp` through `addXp()`.
5. `addXp(XP_PER_WORKOUT)`: character XP (capped) and account XP (uncapped). Add the stat gains, each clamped at its cap. If the character has just reached max level for the first time, set `masteredAt` and add `ACCOUNT_XP_MASTERED` to the account.
6. `rollLoot()` one item. The stat bias is whichever of strength/agility gained more XP. The minimum rarity is the highest `minRarity` of any quest cleared by this workout. The item goes into `inventory` immediately, so closing the popup never loses it.
7. Save with `Promise.all([persist(), persistWorkouts(), persistDraft()])`, refresh the exercise-name suggestions, then `showPresent()` with the summary lines (XP, quest results, character level-up, mastery bonus, account level-up, stat gains).

## Quests

State machine for one path, `applyQuest(path, amount)` in `quests.js`:

```
amount = strength: 10 x (number of DIFFERENT strength exercise names in the workout)
         agility:  sum of km over the workout's agility exercises
done      = min(amount, left)          // no carry-over to the next stage
left     -= done
if left == 0:
    gold += 10 x req                   // GOLD_PER_ENCOUNTER x quest.req
    if this was the boss/final leg:  cleared -> +rewardXp, +30 x req gold, cleared count + 1, run removed
    else:                            stage += 1, left = size of the next stage
```

Both paths can be active at once, and each reacts only to its own kind of exercise. A mixed workout moves both. `renderQuest()` drops a run whose quest id no longer exists in the class data.

## Loot

`rollLoot(bias, minRarity)` in `loot.js`:

1. Pick a rarity by weight among rarities at or above `minRarity` (`RARITIES[i].weight`).
2. Pick a slot uniformly from `SLOTS`, then a piece uniformly from the class's `gear.pieces[slot]`.
3. Give it `RARITIES[i].bonus` stat points. Each point goes to the `bias` stat with 70% probability, otherwise to the other stat.
4. Name it `"<material[rarity]> <piece><suffix>"`, where the suffix comes from whichever stat has more points (none on a tie).

Gift boxes in the store use the same function with a random bias.

## Stats tab

`stats.js` works only from the account's `workouts` (so it always covers every character) and `account.weeklyGoal`; it needs no extra storage.

- `buildSeries(metric, period)` buckets workouts into the last 12 weeks (Monday start) or months and sums a metric per bucket. Metrics are workouts, kg lifted (reps x kg) and distance.
- `exerciseList()` and `exerciseSessions(name)` group a single exercise by date: top weight, volume, km, minutes.
- `lineChart(points, options)` draws an SVG (no library) with grid lines, a polyline, square markers and optional goal line. `axisFor()` picks the range and tick marks: counts and totals start at zero, exercise charts zoom to the data so slow progress is visible.

## Files you will touch most

| To change... | Edit |
|---|---|
| Numbers, caps, prices, rarities | `config.js` |
| Sprites | `art.js` (preview with `tools/sprite-preview.html`) |
| Quests, gear names, class content | `classes.js` |
| How progress is applied to quests | `quests.js` (`applyQuest`) |
| What a workout awards | `workout.js` (`saveWorkout`) |
| Account onboarding, account card, weekly goal | `account.js`, `settings.js` |
| Save format and migrations | `storage.js` (`SCHEMA`, `migrateStore`) |
| Loot generation | `loot.js` (`rollLoot`) |
| Tabs and their order | `tabs.js`, `app.js`, `popup.html` |
| Colors and layout | `popup.css` |

## Pitfalls

- **A duplicated top-level name breaks the popup.** Two files declaring the same function or constant is a `SyntaxError` for the second file. Check the inspector console first when something is blank.
- **MV3 content security policy.** No inline `<script>`, no `onclick="..."` attributes, no `eval`, no remote fonts, images or scripts.
- **Changing saved ids.** Quest, class, avatar, look and slot ids live in users' saves. Add freely; do not rename or delete without a migration in `loadCharacter()`.
- **`minRarity` is an index**, not a rarity key.
- **Account vs character.** Workouts, the draft and the weekly goal live on the account. Do not store them on a character, and do not make a feature depend on the active character's data if it should cover the whole account.
- **Stale tests.** `e2e-game.js` expects exactly three disabled classes on the create screen; enabling a placeholder class will (correctly) fail it. Update the test with the change.
- **Not covered by the tests:** the real `chrome.storage` API, the manifest, and the pixel font. Load the extension unpacked and click through it after structural changes.

## Ideas that fit the current design

- Several chapters per class (turn `chapter`/`quests` into a list and add a picker in `renderQuest`).
- Gear that does something besides stat bonuses (extra gold, extra XP): read it where `saveWorkout` awards them.
- Time-based charts (true date spacing) in `lineChart`.
- Weekly quest deadlines: `startedAt` is already stored on every quest run.
- Export and import of the whole account as JSON (the whole save is plain JSON).
- Logging workouts without a character (a pure tracker mode): the account already owns the log, only the tabs are gated on having an active character.
