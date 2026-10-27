// Saving a workout and the present box dialog.
// Classic script: shares globals with the other files in js/ (load order is in popup.html).

/* ================= Save workout and gift box ================= */
async function saveWorkout() {
  const exercises = draft.exercises
    .map((ex) => {
      const type = ex.type || 'strength';
      const name = ex.name.trim();
      if (type === 'agility') return { name, type, km: round2(Number(ex.km) || 0), minutes: Number(ex.minutes) || 0, sets: [] };
      return { name, type, sets: ex.sets.filter((s) => s.reps !== '' || s.kg !== '').map((s) => ({ reps: Number(s.reps) || 0, kg: Number(s.kg) || 0 })) };
    })
    .filter((ex) => ex.name && (ex.type === 'agility' ? ex.km > 0 : ex.sets.length));

  if (!exercises.length) return toast('Add an exercise with sets, or a distance for agility.');

  workouts.push({ id: Date.now(), date: draft.date || today(), name: draft.name.trim(), character: profile.name, characterId: profile.id, exercises });
  workouts.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  draft = blankDraft();
  draft.exercises.push(newExercise());

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

  await Promise.all([persist(), persistWorkouts(), persistDraft()]);
  refreshExerciseList();

  const lines = [`+${XP_PER_WORKOUT} XP`, ...battle.lines];
  if (levelOf(profile.xp) > levelOf(before.xp)) lines.push(levelOf(profile.xp) >= MAX_LEVEL ? `Level up! MAX LEVEL ${MAX_LEVEL}` : `Level up! You are now LV ${levelOf(profile.xp)}`);
  if (mastered) lines.push(mastered);
  if (accountLevel(account.xp) > accountLevel(before.accountXp)) lines.push(`Account level up! You are now account LV ${accountLevel(account.xp)}`);
  Object.keys(STATS).forEach((k) => {
    const gained = profile.stats[k] - before[k];
    if (gained) lines.push(`+${gained} ${STATS[k]} XP`);
    if (statInfo(profile.stats[k]).level > statInfo(before[k]).level) lines.push(`${STATS[k]} is now LV ${statInfo(profile.stats[k]).level}`);
  });
  showPresent({ title: 'Workout complete!', lootTitle: battle.cleared.length ? 'Boss loot!' : 'You found loot!', lines, item, after: () => renderHud(before.xp) });
}

function showPresent({ title, lootTitle = 'You found loot!', lines, item, returnTab = 'bag', returnLabel = 'Put in bag', after = () => {} }) {
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
      h('button', { class: 'btn', onclick: () => { equipItem(item); close('gear'); } }, 'Equip now')
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
