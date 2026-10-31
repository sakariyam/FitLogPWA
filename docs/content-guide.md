# Content guide

Step-by-step recipes for adding things to FitLog. Every recipe here was applied to a scratch copy of the project and tested in a browser, so the snippets work as written.

After any change to `art.js`, `classes.js` or `config.js`:

```
node tools/check-data.js          # catches wrong sizes, missing sprites, duplicate ids, unwired tabs
open tools/sprite-preview.html    # look at the art in the game's own CSS, both themes
```

Then reload the extension (`chrome://extensions`, reload icon) and try it.

Contents: [Pixel art](#pixel-art) · [Add an enemy](#add-an-enemy-sprite) · [Add a quest](#add-a-quest) · [Add a gear piece](#add-a-gear-piece) · [Character portraits](#character-portraits) · [Add a class](#add-a-class) · [Add a gear slot](#add-a-gear-slot) · [Add a store item](#add-a-store-item) · [Add a tab](#add-a-tab) · [Add a theme](#add-a-theme) · [Tune the numbers](#tune-the-numbers) · [Add a chapter](#add-a-chapter-or-raise-the-level-cap)

---

## Pixel art

All sprites are **16x16**, written as an array of 16 strings of 16 characters.

| Character | Meaning                                        | Where it is allowed     |
| --------- | ---------------------------------------------- | ----------------------- |
| `.`       | Transparent (the background shows through)     | everywhere              |
| `#`       | Dark: outlines and the darkest fill (`--dark`) | everywhere              |
| `+`       | Mid-dark fill (`--deep`)                       | everywhere              |
| `s`       | Skin (`--skin`)                                | the class headshot only |
| `_`       | Erase the base pixel                           | look layers only        |

Only three tones exist (dark, mid-dark, background) because the Game Boy palette has no more shades that stay visible on both the page and panel backgrounds. Get depth from shapes, outlines and dithering, not from extra colors. Colors come from the theme, so the same sprite works in every theme.

**Mirroring.** Most things are symmetrical. Draw the left 8 columns, then expand with this helper (paste it into the browser console or `node`):

```js
const mirror = (half) => half.map((r) => r + [...r].reverse().join(""));
mirror(["........", ".....###", "...##+++" /* ...16 half rows... */]);
```

**Sizes on screen.** Sprites are drawn as SVG and scaled by CSS in whole-number steps so pixels stay crisp:

| CSS class    | Size       | Scale  | Used for                                            |
| ------------ | ---------- | ------ | --------------------------------------------------- |
| `sprite`     | 48 px      | 3x     | General pixel sprites                               |
| `sprite sm`  | 32 px      | 2x     | Gear icons, character selection, quest enemy rows   |
| `sprite big` | 96 px      | 6x     | Enemy on the quest screen, present box, loot reveal |
| `character`  | responsive | varies | Equipped character preview in Inventory             |

Draw so the subject fills most of the 16x16 box; empty margins make small icons look tiny.

---

## Add an enemy sprite

Enemies and travel legs share one table, `ENEMY_SPRITES` in `js/art.js`. Add an entry. The key is the name quests use.

```js
const ENEMY_SPRITES = {
  mushroom: [
    "................",
    "................",
    ".....######.....",
    "...##++++++##...",
    "..#++.++++.++#..",
    ".#++++++++++++#.",
    ".#+.++.++.++.+#.",
    ".#++++++++++++#.",
    ".##############.",
    "....#++++++#....",
    "....#+#++#+#....",
    "....#++++++#....",
    "....#++++++#....",
    "....########....",
    "................",
    "................",
  ],
  // ...existing sprites...
};
```

Run `node tools/check-data.js`. A wrong row length or a character outside `.#+` is reported with the sprite name and row number.

Then use it in a quest (next section). Sprites are not tied to a class: any class can use any entry.

---

## Add a quest

Quests live in the class data in `js/classes.js`, under `quests.strength` and `quests.agility`. The two paths use the same shape but different units:

- **Strength quest**: enemies with **hp**, built with `E(name, sprite, hp)`. A workout deals 10 damage per _different_ strength exercise.
- **Agility quest**: legs with **km**, built with `L(name, sprite, km)`. Every kilometre logged on an agility exercise counts.

```js
// in CLASSES.salaryman.quests.strength
{ id: 's7', name: 'Garden Party', req: 2, rewardXp: 200, minRarity: 1,
  encounters: [E('Angry Mushroom', 'mushroom', 30)],
  boss: E('Giant Mushroom', 'mushroom', 45) },

// in CLASSES.salaryman.quests.agility
{ id: 'a7', name: 'Coffee Run', req: 2, rewardXp: 200, minRarity: 1,
  encounters: [L('To the cafe', 'office', 3)],
  boss: L('Back before the meeting', 'clock', 4) },
```

| Field        | Meaning                                                                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`         | Unique across **every** quest of every class and path. Stored in saves: never rename or reuse one.                                                       |
| `name`       | Shown on the quest card and the active quest screen                                                                                                      |
| `req`        | Strength level (strength path) or Agility level (agility path) needed to begin. Gear bonuses count. A `req` above `MAX_LEVEL` can only be met with gear. |
| `rewardXp`   | Character XP for clearing the quest                                                                                                                      |
| `minRarity`  | Index into `RARITIES` (0 common ... 4 legendary): the clear's present box is at least this rare                                                          |
| `encounters` | One or more stages fought before the boss, in order                                                                                                      |
| `boss`       | The final stage                                                                                                                                          |

Rules the game applies (so you can balance around them):

- **One workout finishes at most one stage per path.** Surplus damage or distance is discarded, not carried over. A quest with 1 encounter plus a boss therefore takes at least 2 workouts. That is the pacing lever: _number of stages = minimum workouts_.
- Progress inside a stage is kept between workouts, so a stage can take several small workouts.
- **Gold**: `10 x req` for every finished stage and `30 x req` more for clearing the quest (`GOLD_PER_ENCOUNTER`, `GOLD_PER_CLEAR`).
- Existing convention: levels 1 to 4 use one encounter and a boss, level 5 and up use three. Keep quests in each list in ascending `req` order, because the UI lists them in array order.
- A strength stage needs an `hp` greater than 0 and an agility stage needs `km` greater than 0. Reasonable values: 30 to 80 hp (3 to 8 different exercises), 3 to 15 km.

A new character at level 1 sees a `req: 2` quest as locked ("Needs Strength 2 (you 1)"). That is expected.

Removing or renaming a quest id cancels any run in progress for that quest (the quest tab quietly drops it) and loses its "cleared" count.

---

## Add a gear piece

A gear _piece_ is one named kind of item in a slot, such as "Fedora" in the head slot. Loot is built as `Material Piece of Suffix`, for example "Tailored Fedora of Grit". A piece needs up to three things, all keyed by the same **look id**:

1. an entry in the class's `gear.pieces[slot]` list (`js/classes.js`)
2. an icon in `itemSprites[slot][look]` (`js/art.js`, the `SALARYMAN_ITEMS` object): the 16x16 picture shown in the bag, store and loot dialog
3. a look layer in `looks[slot][look]` (`js/art.js`, `SALARYMAN_LOOKS`) **only if the slot is drawn on the headshot** (head, body, neck)

Example: headphones in the head slot.

```js
// js/classes.js, CLASSES.salaryman.gear.pieces
head: [{ name: 'Fedora', look: 'fedora' }, { name: 'Glasses', look: 'glasses' },
       { name: 'Headphones', look: 'headphones' }],
```

```js
// js/art.js
const SALARYMAN_ITEMS = {
  head: {
    headphones: [
      "................",
      "................",
      ".....######.....",
      "...##......##...",
      "..#..........#..",
      "..#..........#..",
      ".####......####.",
      ".#++#......#++#.",
      ".#++#......#++#.",
      ".#++#......#++#.",
      ".####......####.",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    // ...fedora, glasses...
  },
  // ...other slots...
};

const SALARYMAN_LOOKS = {
  head: {
    headphones: [
      ".....######.....",
      "...##......##...",
      "..#..........#..",
      "..#..........#..",
      ".##..........##.",
      ".#+#........#+#.",
      ".#+#........#+#.",
      ".#+#........#+#.",
      ".###........###.",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    // ...fedora, glasses...
  },
  // ...
};
```

How a look layer works: it is a 16x16 overlay drawn on top of the class's base headshot. `.` keeps whatever is underneath, `#` and `+` and `s` paint, `_` erases the pixel underneath (use it when a hat has to hide hair). Layers are drawn in the order body, neck, head, so a head item sits on top. To see the result, open `tools/sprite-preview.html`: it shows the base headshot, each look on its own, and the first look of every slot together.

What the game does with it:

- New loot stores its `look` id on the item, so renaming a piece later does not change items players already own.
- Items from older saves have no `look`; they are matched by name (longest piece name first) and fall back to the first look of the slot. That is only a safety net: do not rely on it.
- Slots **weapon** and **feet** have no look layers, so they only need the piece and the icon. If you later give a slot look layers, `check-data` requires a layer for every piece in that slot.
- Material names (`gear.materials`) are one per rarity, in order. `gear.suffix.strength` and `gear.suffix.agility` are appended when an item leans towards that stat.
- Bonus points are fixed by rarity (`RARITIES[i].bonus`) and split between Strength and Agility at random, leaning 70% towards whichever stat the workout trained most.

---

## Character portraits

Every character portrait uses the class's base `headshot` with equipped head, body and neck `looks` layered on top. There is no separate portrait picker. Edit the class's headshot or gear overlays in `js/art.js` to change its appearance everywhere: header, Inventory, Settings and character selection.

`characterSvg(character, items, gear, cssClass)` in `js/gear.js` accepts an explicit character and its saved inventory/equipment when drawing character-selection cards. With no arguments it draws the active character. Re-render Inventory after equipment changes to update both the large preview and header portrait.

---

## Add a class

Classes are entries in `CLASSES` (`js/classes.js`). `punk`, `athlete` and `hippie` already exist as disabled placeholders (`enabled: false`, shown as "Coming soon"). To make one playable, fill in the fields below and set `enabled: true`.

```js
punk: {
  name: 'Punk',
  blurb: 'One line shown on the create screen.',
  enabled: true,
  gear: {
    materials: ['Rusty', 'Studded', 'Patched', 'Custom', 'Legendary'],   // one per rarity, common to legendary
    pieces: {                        // every slot in SLOTS needs at least one piece
      weapon: [{ name: 'Guitar', look: 'guitar' }],
      head:   [{ name: 'Mohawk', look: 'mohawk' }],
      body:   [{ name: 'Leather Jacket', look: 'jacket' }],
      neck:   [{ name: 'Chain', look: 'chain' }],
      feet:   [{ name: 'Boots', look: 'boots' }]
    },
    suffix: { strength: ' of Noise', agility: ' of Speed' }
  },
  itemSprites: PUNK_ITEMS,           // { slot: { look: 16x16 icon } }   defined in art.js
  headshot: PUNK_HEADSHOT,           // 16x16 base face and torso (with 's' skin pixels)
  looks: PUNK_LOOKS,                 // { slot: { look: overlay } } for the slots drawn on the headshot
  chapter: 'Chapter 1: Noise Complaint',
  quests: { strength: [ /* ... */ ], agility: [ /* ... */ ] }
}
```

Put the art in `art.js` as separate constants (`PUNK_ITEMS`, `PUNK_HEADSHOT`, `PUNK_LOOKS`), the way the Salaryman's are, and reference them from the class. Quest ids must be unique across classes, so prefix them (`p-s1`, `p-a1`).

Everything else follows automatically: the create screen lists the class, loot uses the class's gear names, character portraits use its base and equipped looks, and the Quest tab shows only its quests (`classOf()` is the active-character lookup).

Two shortcuts while developing: a class may point at another class's art constants (`itemSprites: SALARYMAN_ITEMS`) until its own art exists, and `DEFAULT_CLASS` in `config.js` is the class preselected on the create screen and the fallback for unknown saved class ids. It must be an enabled class.

---

## Add a gear slot

A slot is a place on the character (weapon, head, body, neck, feet). Adding one touches data only:

1. `js/config.js`: add the id to `SLOTS` and a label to `SLOT_LABEL`. The order in `SLOTS` is the order shown in Inventory's equipped-slot strip. Update the strip's grid layout when adding slots and check it on narrow phones.
2. For **every enabled class** in `js/classes.js`: add `gear.pieces.<slot>` with at least one piece, and `itemSprites.<slot>.<look>` icons in `art.js`.
3. Only if the slot should be drawn on the headshot: add `looks.<slot>` layers, and add the slot to the draw-order list in `headshotRows()` in `js/gear.js` (currently `['body', 'neck', 'head']`; later entries draw on top).

```js
// config.js
const SLOTS = ['weapon', 'head', 'body', 'neck', 'hands', 'feet'];
const SLOT_LABEL = { weapon: 'Weapon', head: 'Head', body: 'Body', neck: 'Neck', hands: 'Hands', feet: 'Feet' };

// classes.js, in gear.pieces
hands: [{ name: 'Wristwatch', look: 'watch' }],

// art.js, in SALARYMAN_ITEMS
hands: { watch: [ /* 16 rows */ ] },
```

Existing characters keep working: a missing slot loads as empty. New loot can roll the new slot immediately (slots are picked uniformly).

---

## Add a store item

`STORE_ITEMS` in `js/config.js` lists the gift boxes. Add an entry:

```js
{ id: 'mega', name: 'Mega Gift Box', price: 1500, minRarity: 3, text: 'Epic gear or better.' }
```

`minRarity` is the same index into `RARITIES` as for quests. Every box produces one random piece of gear (`rollLoot`). A store item that does something else (a consumable, a cosmetic) needs new code: `buyBox()` and `renderStore()` in `js/store.js`. Selling prices per rarity are `SELL_PRICE`.

---

## Add a page

The app has four bottom destinations: **Home**, **Progress**, **Adventure**, and **Workout**, with the primary Workout button at the right. Home is the signed-in start page and offers Start/Resume workout, weekly goal progress, the latest workout and adventure shortcuts. Put related pages inside one of these groups instead of adding another global button. Progress and Adventure show local page switches; Adventure includes Store, while Settings & more is reached from Home for account management and character switching. Keep local labels short and check them at 320px with the real pixel font loaded.

1. Create `js/notes.js` with a render function that fills its own panel:

   ```js
   function renderNotes() {
     const panel = panelEl("notes"); // the panel already exists
     panel.replaceChildren(
       h(
         "div",
         { class: "card" },
         h("div", { class: "slot-name", text: "Notes" }),
         h("div", {
           class: "slot-label",
           text: `${account.name} has logged ${workouts.length} workouts.`,
         }),
       ),
     );
   }
   ```

2. Add the page to `TAB_DEFS` in `js/tabs.js`: `{ id: 'notes', label: 'Notes' }`. Also add its ID to the appropriate `NAV_GROUPS` entry's `pages` array. For secondary Home pages, add a menu action in `renderMore()` or a Home shortcut.
3. Register the renderer in `js/app.js`: `RENDERERS = { ..., notes: renderNotes }`
4. Load the file in `index.html`, **before** `js/app.js`: `<script src="js/notes.js"></script>`

The empty panel (`#panel-notes`) is created from `TAB_DEFS`; its containing destination is selected from `NAV_GROUPS`. The renderer runs every time the page is opened. After you change saved state, call the matching save function: `persist()` for character and account state, `persistWorkouts()` for the workout log, `persistDraft()` for the draft. The workout log and weekly goal are **account** data (`workouts`, `account`); XP, gold and gear are **character** data (`profile`, `inventory`, ...). If you need state that lives only while the app is open, declare it with `let` at the top of your file (see `statsView` in `stats.js`).

Exercise selection and creation are focused nested screens inside Workout: they call `setWorkoutFocus(true, title)` to hide global navigation and timer/save controls. Their Back actions return to the parent screen, and `renderLog()` restores normal navigation without resetting the draft or timer.

---

## Add a theme

1. Add it to `THEMES` in `js/config.js`: `{ id: 'sepia', label: 'Sepia' }`. The Settings tab builds its buttons from this list.
2. Add a block to `popup.css` that redefines the color tokens (all of them, see the table in `docs/architecture.md`):

   ```css
   [data-theme="sepia"] {
     --dark: #3b2a1a;
     --deep: #7a5c3e;
     --mid: #d9c3a0;
     --light: #e8d8b9;
     --muted: #5c4630;
     --bar-bg: #3b2a1a;
     --bar-fg: #e8d8b9;
     --bar-dim: #c4a97f;
     --bar-edge: #3b2a1a;
     --skin: #d9c3a0;
     --scrim: rgba(59, 42, 26, 0.9);
   }
   ```

   For a dark theme also set `color-scheme: dark;` so date pickers and scrollbars match.

Roles to keep in mind: `--light` is the page background, `--mid` is panels, `--dark` is text and borders and sprite outlines. A dark theme swaps them (see `[data-theme="night"]`). The header, bottom tab bar, gold card, toast and banners use the separate `--bar-*` tokens so they can stay dark in a light theme.

The choice is saved as `theme` in storage and applies to every character.

---

## Tune the numbers

Everything below is in `js/config.js`.

| Constant                                 | Default              | Effect                                                                                                                                      |
| ---------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `MAX_LEVEL`                              | 10                   | Level cap for the character **and** for Strength and Agility                                                                                |
| `XP_PER_WORKOUT`                         | 100                  | Character XP for every saved workout                                                                                                        |
| `XP_PER_LEVEL`                           | 1000                 | Character XP per level (flat)                                                                                                               |
| `STAT_XP_PER_SET`                        | 5                    | Strength XP per logged set                                                                                                                  |
| `XP_PER_KM`                              | 20                   | Agility XP per km                                                                                                                           |
| stat curve                               | 100 x 1.25^(n-1)     | XP for Strength/Agility level n to n+1. Edit the `STAT_CUM` loop to change the shape.                                                       |
| `DAMAGE_PER_ACTIVITY`                    | 10                   | Strength quest damage per different exercise in a workout                                                                                   |
| `GOLD_PER_ENCOUNTER`                     | 10                   | Gold per finished stage, times the quest's `req`                                                                                            |
| `GOLD_PER_CLEAR`                         | 30                   | Gold for clearing a quest, times its `req`                                                                                                  |
| `RARITIES`                               | see file             | Drop weight and stat bonus per rarity                                                                                                       |
| `SELL_PRICE`                             | 10, 30, 80, 200, 500 | Sell value by rarity                                                                                                                        |
| `STORE_ITEMS`                            | 80 / 250 / 700       | Gift box prices and minimum rarity                                                                                                          |
| `DEFAULT_WEEKLY_GOAL`, `MAX_WEEKLY_GOAL` | 2, 7                 | Default weekly goal for new accounts (each account picks its own, drawn as the goal line on the Stats chart) and the highest choice offered |
| `ACCOUNT_XP_PER_LEVEL`                   | 1000                 | Account XP per account level (flat, no cap)                                                                                                 |
| `ACCOUNT_XP_MASTERED`                    | 1000                 | One-off account XP when a character first reaches max level                                                                                 |
| `CHART_BUCKETS`, `CHART_SESSIONS`        | 12, 20               | How many weeks/months and sessions the charts show                                                                                          |
| `COMMON`, `EXERCISE_TYPES`               |                      | Preset exercises in the picker and their fixed Strength or Agility type                                                                     |
| `MUSCLE_GROUPS`, `EXERCISE_MUSCLES`      |                      | Muscle-group labels and preset main/supporting groups used by the exercise preview                                                          |

Players can create exercises from the exercise picker with a unique name, a Strength or Agility type, and at least one targeted muscle group. These definitions are stored as account-level `customExercises` and appear beside presets in search. Their selected groups are shown as main muscles in the information preview. Workout cards use the chosen definition's type without offering a per-card override; existing drafts and repeated workouts retain their saved type.

Existing saves are not rewritten when you change a number: stored XP stays, and levels are recomputed from it.

---

## Add a chapter or raise the level cap

Chapter 1 ends at level 10, and every quest asks for at most level 11 (one point of gear above the cap). To add more:

1. Raise `MAX_LEVEL` in `config.js`. Level thresholds, XP caps, stat curve and bars all follow from it. Characters already at the old cap simply have room to grow again.
2. Add quests with higher `req` values to the class's quest lists (ascending order). Check the pacing with the table above: at the default rates Strength level 10 needs 2,579 stat XP.
3. The Quest tab shows one `chapter` string per class. For several chapters you would turn `chapter` and `quests` into a per-chapter structure and add a chapter picker in `renderQuest()` (`js/quests.js`); that is not built yet.
