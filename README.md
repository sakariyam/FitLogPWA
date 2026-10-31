# FitLog

An iPhone-installable web app for logging workouts, with an RPG layer on top. Log strength and agility workouts, earn XP and gold, fight through quests, open present boxes for gear, and watch your progress in charts.

Programs add reusable workout sessions with planned sets/rep ranges or distance targets. Follow Compound Foundations or create your own, start the next session from Home, save partial work, substitute or skip exercises, and follow campaign milestones in Adventure. Targets never count as logged results. See [docs/programs.md](docs/programs.md) for the workflow.

There are two layers. The **account** is the tracker: it owns the workout log, the History and Stats tabs, the weekly goal and an account level. **Characters** are the game: each has a class, XP, Strength and Agility levels, gear, gold and quests, and turns the account's workouts into progress. You can make as many characters as you like and take each one to max level; the account levels up with all of them.

There is no build step, backend, hosted database or runtime dependency. Saves stay on the device in IndexedDB. There is deliberately no service worker, offline cache or backup import/export. Internet access is needed to load the app reliably; clearing site data can erase saves. Different devices do not sync.

## Publish and install

1. Push this folder to a GitHub repository on the `main` branch. A public repository supports free GitHub Pages on GitHub Free.
2. In the repository's **Settings > Pages**, set **Source** to **GitHub Actions**.
3. Run **Deploy FitLog** in the **Actions** tab, or push a change to `main`. The workflow publishes only the app files. No npm install is needed.
4. Open `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/` in Safari on the iPhone.
5. Choose **Share > Add to Home Screen**, with **Open as Web App** enabled if offered, and open the new icon.

Updates are published on pushes to `main`; reopen or reload the app to fetch them. Keep the published hostname and repository URL stable. Saves belong to the browser's origin and are not uploaded to GitHub. All Pages projects on one hostname share an origin; FitLog uses the IndexedDB database named `fitlog`.

The pixel font is optional. Put `PressStart2P-Regular.ttf` in `fonts/` (see `fonts/README.txt`). Without it the popup falls back to Courier.

## Documentation

| Read this                                      | When you want to                                                                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [docs/content-guide.md](docs/content-guide.md) | Add or change enemies, quests, sprites, gear, character portraits, classes, slots, tabs, themes, store items, or tune the numbers |
| [docs/architecture.md](docs/architecture.md)   | Understand how it works: state, storage format, the workout save pipeline, quests, loot, charts, theming                          |

## Project layout

```
index.html           Web entry point and script load order
manifest.webmanifest Home Screen installation metadata
icons/               App and Apple touch icons
popup.css            All styling, including both themes
fonts/               Optional pixel font
js/                  The app, split by feature (table below)
docs/                Developer documentation
.github/workflows/   GitHub Pages deployment
```

### The scripts in `js/`

| File            | What lives there                                                                           |
| --------------- | ------------------------------------------------------------------------------------------ |
| `config.js`     | Game rules and tuning numbers: level cap, XP, gold, rarities, slots, store prices, themes  |
| `art.js`        | All pixel art: enemies, present box, gear icons, headshot, looks                           |
| `classes.js`    | Class content: gear names, quests, chapter title. One entry per class.                     |
| `state.js`      | Shared state variables and small helpers (levels, stat info, gear bonus)                   |
| `programs.js`   | Program presets, target validation, run snapshots, partial-session progress and milestones |
| `program-ui.js` | Program library/builder, campaign view, schedule and logging controls                      |
| `dom.js`        | `h()` element builder, sprite drawing, toast                                               |
| `database.js`   | IndexedDB access and save failure reporting                                                |
| `storage.js`    | Theme, the `persist*()` functions, loading, and migration of older saves                   |
| `characters.js` | HUD, character select, character creation, log out                                         |
| `account.js`    | Account onboarding (step 1), the account card, weekly goal picker                          |
| `tabs.js`       | `TAB_DEFS` and tab switching                                                               |
| `log.js`        | Log tab                                                                                    |
| `loot.js`       | Loot rolling, item looks, equipping                                                        |
| `quests.js`     | Quest tab and the quest progress rules                                                     |
| `workout.js`    | Saving a workout and the present box dialog                                                |
| `history.js`    | History tab                                                                                |
| `stats.js`      | Stats tab and the SVG line chart                                                           |
| `gear.js`       | Gear tab and the headshot                                                                  |
| `bag.js`        | Bag tab                                                                                    |
| `store.js`      | Store tab                                                                                  |
| `settings.js`   | Settings tab                                                                               |
| `app.js`        | `RENDERERS` and start-up. Always loaded last.                                              |

Run the program lifecycle and workout-save regression tests with `node --test tools/programs.test.cjs`.

## How the scripts fit together (read this before adding a file)

The files are **classic scripts, not ES modules**. `index.html` loads them one after another with `<script src>` tags, and they share one global scope:

- A function or `const`/`let` declared at the top level of any file can be used by every file, without import or export.
- **Names must be unique across all files.** Declaring the same top-level name twice is a `SyntaxError` that stops the second file from running, and the popup shows a blank or half-built screen. If the popup is blank, open the inspector first.
- **Load order matters only for code that runs at load time.** Function bodies can call anything, because by the time they run every file has loaded. But top-level statements (such as building an object from another file's constants) need that file to be loaded earlier. Keep `database` before `storage` and `app` last in `index.html`.
- Top-level `const` and `let` do not become properties of `window`. In the console or in tests, use the bare name (`profile`, `workouts`), not `window.profile`.

To add a file, create `js/yourfile.js` and add its `<script>` tag to `index.html` before `app.js`.

## Conventions

- **Build the DOM with `h(tag, props, ...children)`** from `dom.js`. It sets text with `textContent` and never parses HTML, so a character named `<b>` is safe. Do not use `innerHTML` with anything a user typed.
- **No inline scripts or inline event attributes.** Use `onclick` in `h()` props or `addEventListener`. Keep resources bundled with the app.
- **Save after you change anything that should be kept.** The popup can close at any moment, so state that was not saved is lost. Character changes (XP, gear, gold, quests) and account changes: `persist()`. The workout log: `persistWorkouts()`. The workout being typed: `persistDraft()`. Account settings only: `persistAccount()`.
- **Colors come from CSS variables** (`var(--dark)`, `var(--bar-bg)`, ...), never hard-coded, so both themes work. See the token table in `docs/architecture.md`.
- **Sprites are 16x16 and use three tones.** Details in `docs/content-guide.md`.
- Each tab renderer clears its own panel and rebuilds it (`panel.replaceChildren(...)`). Keep renderers cheap, and when a typing handler would lose focus by re-rendering, update the DOM in place (see `exerciseCard` in `log.js`).
- Saved ids are forever: quest ids, class ids, gear `look` ids and slot names are stored in users' data. Add new ones freely, but do not rename or delete existing ones without handling old saves.
