# Training Programs

## Start a program

Open Workout > Programs, or Programs on Home. Compound Foundations alternates:

- Session A: Squat, Bench press, Barbell row.
- Session B: Deadlift, Overhead press, Pull-up.

The preset suggests two sessions per week and four cycles. Targets are editable in a custom copy; choose weights appropriate to your own training. Following a program does not change your account's weekly workout goal.

Choose Follow program, then start the next session from Home or the program details. Starting a session fills exercise names and the planned number of set rows, but reps, weights, distance and minutes stay blank. Targets and previous results appear above the inputs. Nothing contributes to history, charts, XP or quests until actual results are saved.

## Create and edit

Create a program with a name, suggested weekly frequency, cycle count, and one or more named sessions. Select preset or custom exercises from the catalog. Strength targets have a set count and rep range; Agility targets have distance and optional minutes. A cycle count of zero makes the program repeatable.

Save as program on a free workout opens the builder with its exercises. It creates targets, not a copy of completed results. Presets can be customized as copies.

An active campaign keeps its original template snapshot. Editing the saved template does not alter an in-progress session. Start new campaign uses the latest template and keeps older run history. The builder's unsaved edits are not part of the persisted library until Save program succeeds.

## Log flexibly

- Swap exercise substitutes a catalog exercise for this session without changing the saved template. Switching between Strength and Agility gives the substitute an appropriate default target.
- Skip leaves a planned exercise visible but excludes its inputs from the saved workout. It does not erase the program.
- Free workout detaches the current draft from the program after confirmation, keeping entered values and previously saved work. The campaign does not advance, and its next session remains available.
- Save partial and continue later records the actual work so far without advancing the campaign. The remaining draft is paused; previously saved inputs are cleared so they are not saved again. Per-exercise counters include earlier saved portions. For distance sessions, enter only the additional distance, not the cumulative target.
- Finish session and move on advances only after a save. If any non-skipped target is incomplete, a confirmation offers partial saving or deliberately finishing anyway.
- Finishing a previously saved partial session without entering more results does not add another workout or another workout reward.

Starting another session never silently replaces a workout draft. You can resume it, replace it explicitly, or cancel. History > Repeat workout produces a free workout and does not advance a campaign. Practice session also logs normally but never advances the program's next-session pointer.

## Campaign and progress

Adventure shows the active program's cycle nodes and next session, alongside the existing Strength/Agility quests. Actual saved exercises continue to progress those quests as usual. Completed program sessions, not planned numbers or volume, advance the campaign.

Milestones are badges: First steps, First cycle, Finding rhythm (four completed sessions), and Campaign complete. They do not award extra gold or XP for bigger weights, more distance, or rapid repeat saves. A completed occurrence cannot advance the same run twice.

Program details show completed cycles, suggested weekly-session progress, recent session history and links into exercise progress charts. Exercises without results have no progress chart yet.

Pause program keeps its history. Resume program continues the unfinished run. Suggested next session is an optional date you can change or clear; missing or moving it causes no loss of progress and there is no daily streak penalty. Programs and runs belong to the account and remain when switching characters.

## Storage and tests

Definitions and campaign runs live in the optional `programData` IndexedDB key. Existing saves load an empty program library plus the built-in preset. Each run stores its program snapshot; each planned draft stores a unique attempt ID and session occurrence. Saved workout portions retain that attempt ID and the original planned item IDs.

Workout saving writes character/account rewards, history, draft and program progress together. A failed write restores the previous in-memory state and keeps the draft available. Program-definition saves publish their new in-memory state only after storage succeeds.

Run `node --test tools/programs.test.cjs` to check targets, snapshot isolation, partial accounting, duplicate completion, real save behavior and storage rollback.
