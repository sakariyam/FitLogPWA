// Saving a workout and the present box dialog.
// Classic script: shares globals with the other files in js/ (load order is in popup.html).

/* ================= Save workout and gift box ================= */
let savingWorkout = false;

async function saveWorkout(options = {}) {
  if (savingWorkout) return;
  const exercises = draft.exercises
    .filter((exercise) => !exercise.skipped)
    .map((ex) => {
      const type = ex.type || 'strength';
      const name = ex.name.trim();
      const planned = ex.programItemId ? { programItemId: ex.programItemId, target: structuredClone(ex.target), ...(ex.substitutedFrom ? { substitutedFrom: ex.substitutedFrom } : {}) } : {};
      if (type === 'agility') return { name, type, km: round2(Number(ex.km) || 0), minutes: Number(ex.minutes) || 0, sets: [], ...planned };
      return { name, type, sets: ex.sets.filter((s) => ex.programItemId ? Number(s.reps) > 0 : s.reps !== '' || s.kg !== '').map((s) => ({ reps: Number(s.reps) || 0, kg: Number(s.kg) || 0 })), ...planned };
    })
    .filter((ex) => ex.name && (ex.type === 'agility' ? ex.km > 0 : ex.sets.length));

  const context = draft.program;
  const partial = !!context && draft.programSaveMode === 'partial';
  const savedEarlier = context && workouts.filter((workout) => workout.program?.attemptId === context.attemptId);
  if (!exercises.length && (!context || partial || !savedEarlier.length)) return toast('Add an exercise with sets, or a distance for agility.');
  if (context && !partial && !options.allowIncomplete) {
    const pending = programSessionProgress(exercises).filter((entry) => !entry.done && !entry.skipped);
    if (pending.length) {
      programDialog('Finish an incomplete session?',
        h('p', { text: `${pending.length} exercise${pending.length === 1 ? ' has' : 's have'} fewer logged sets or distance than planned. You can save the work so far and continue later, or finish this session deliberately.` }),
        [{ label: 'Save partial and continue later', primary: true, action: () => { draft.programSaveMode = 'partial'; saveWorkout(); } },
          { label: 'Finish session anyway', action: () => saveWorkout({ allowIncomplete: true }) }]);
      return;
    }
  }
  savingWorkout = true;
  const snapshot = structuredClone({ workouts, draft, programData, profile, account, inventory, equipped, quests, characters });
  const rollback = () => {
    ({ workouts, draft, programData, profile, account, inventory, equipped, quests, characters } = snapshot);
    renderLog(); renderHud(); toast('Workout could not be saved. Your draft is still available.');
  };
  try {
  if (!exercises.length) {
    const lines = completeProgramSession(context, savedEarlier[0].id);
    savedEarlier[0].program.finished = true;
    draft = blankDraft();
    if (!await appStorage.set({ programData, workouts, draft })) { rollback(); return; }
    renderLog(); toast(lines.length ? 'Program session complete' : 'Practice finished');
    return;
  }
  const nextDraft = partial ? remainingProgramDraft(draft, exercises) : blankDraft();
  const workout = { id: Date.now(), date: draft.date || today(), name: draft.name.trim(), character: profile.name, characterId: profile.id, exercises,
    ...(context ? { program: { ...structuredClone(context), finished: !partial }, skipped: draft.exercises.filter((exercise) => exercise.skipped).map((exercise) => exercise.programItemId) } : {}) };
  const programLines = context && !partial ? completeProgramSession(context, workout.id) : [];
  workouts.push(workout);
  workouts.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  draft = nextDraft;
  renderWorkoutTimer();

  const gains = { strength: 0, agility: 0 };
  exercises.forEach((e) => {
    if (e.type === 'agility') gains.agility += Math.round(e.km * XP_PER_KM);
    else gains.strength += e.sets.length * STAT_XP_PER_SET;
  });
  const before = { xp: profile.xp, accountXp: account.xp, strength: profile.stats.strength, agility: profile.stats.agility };

  const battle = applyQuests(exercises);
  addXp(XP_PER_WORKOUT);
  let mastered = null;
  if (levelOf(profile.xp) >= MAX_LEVEL && !profile.masteredAt) { // first time at max level: a one-off account bonus
    profile.masteredAt = Date.now();
    account.xp += ACCOUNT_XP_MASTERED;
    mastered = `${profile.name} reached max level! +${ACCOUNT_XP_MASTERED} account XP`;
  }
  Object.keys(STATS).forEach((k) => { profile.stats[k] = Math.min(STAT_MAX_XP, profile.stats[k] + gains[k]); });

  const minRarity = battle.cleared.reduce((m, q) => Math.max(m, q.minRarity), 0);
  const item = rollLoot(gains.agility > gains.strength ? 'agility' : 'strength', minRarity);
  inventory.unshift(item); // added right away, so the loot is safe even if the popup closes

  characters[profile.id] = { ...profile, inventory, equipped, quests };
  if (!await appStorage.set({ characters, activeId, schema: SCHEMA, account, workouts, draft, programData })) { rollback(); return; }

  const lines = [`+${XP_PER_WORKOUT} XP`, ...battle.lines, ...programLines];
  if (levelOf(profile.xp) > levelOf(before.xp)) lines.push(levelOf(profile.xp) >= MAX_LEVEL ? `Level up! MAX LEVEL ${MAX_LEVEL}` : `Level up! You are now LV ${levelOf(profile.xp)}`);
  if (mastered) lines.push(mastered);
  if (accountLevel(account.xp) > accountLevel(before.accountXp)) lines.push(`Account level up! You are now account LV ${accountLevel(account.xp)}`);
  Object.keys(STATS).forEach((k) => {
    const gained = profile.stats[k] - before[k];
    if (gained) lines.push(`+${gained} ${STATS[k]} XP`);
    if (statInfo(profile.stats[k]).level > statInfo(before[k]).level) lines.push(`${STATS[k]} is now LV ${statInfo(profile.stats[k]).level}`);
  });
  showPresent({ title: partial ? 'Workout progress saved' : 'Workout complete!', lootTitle: battle.cleared.length ? 'Boss loot!' : 'You found loot!', lines, item,
    ...(partial ? { returnTab: 'log', returnLabel: 'Continue session' } : {}), after: () => renderHud(before.xp) });
  } catch (error) {
    console.error('Workout could not be saved', error);
    rollback();
  } finally { savingWorkout = false; }
}

function showPresent({ title, lootTitle = 'You found loot!', lines, item, returnTab = 'inventory', returnLabel = 'View inventory', after = () => {} }) {
  const modal = $('modal');
  const close = (tab) => { modal.hidden = true; modal.replaceChildren(); showTab(tab); after(); };
  const dialog = (label, ...kids) => h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': label }, kids);

  const stageTwo = () => {
    const keep = h('button', { class: 'btn primary', onclick: () => close(returnTab) }, returnLabel);
    modal.replaceChildren(dialog('Loot found',
      h('h2', { text: lootTitle }),
      h('div', { class: 'chest' }, itemSprite(item, 'sprite big')),
      h('div', { class: 'loot-name', text: item.name }),
      h('div', { class: 'loot-meta', text: `${rarityOf(item).label} ${stars(item)}` }),
      h('div', { class: 'loot-meta', text: `${SLOT_LABEL[item.slot]}: ${statText(item)}` }),
      keep,
      h('button', { class: 'btn', onclick: () => { equipItem(item); close('inventory'); } }, 'Equip now')
    ));
    keep.focus();
  };

  const box = spriteFrom(PRESENT_CLOSED, 'sprite big');
  const open = h('button', { class: 'btn primary', onclick: () => {
    open.disabled = true;
    box.classList.add('shake');
    const wait = reduceMotion() ? 0 : 500;
    setTimeout(() => { box.replaceWith(spriteFrom(PRESENT_OPEN, 'sprite big')); setTimeout(stageTwo, wait); }, wait);
  } }, 'Open present');

  modal.replaceChildren(dialog(title,
    h('h2', { text: title }),
    lines.length ? h('ul', { class: 'gains' }, lines.map((l) => h('li', { text: l }))) : null,
    h('div', { class: 'chest' }, box),
    open));
  modal.hidden = false;
  open.focus();
}
