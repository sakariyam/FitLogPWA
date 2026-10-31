// Quest tab: strength and agility quests.
// Classic script: shares globals with the other files in js/ (load order is in popup.html).

/* ================= Quests ================= */
const stagesOf = (quest) => [...quest.encounters, quest.boss];
const sizeOf = (stage, path) => (path === 'agility' ? stage.km : stage.hp);
const allQuests = () => Object.values(classOf().quests).flat();
const questById = (id) => allQuests().find((x) => x.id === id);

// Strength: each DIFFERENT exercise deals damage. Agility: logged kilometres.
function strengthDamage(exercises) {
  const names = new Set(exercises.filter((e) => e.type !== 'agility').map((e) => e.name.toLowerCase()));
  return names.size * DAMAGE_PER_ACTIVITY;
}
const agilityKm = (exercises) => round2(exercises.filter((e) => e.type === 'agility').reduce((t, e) => t + (e.km || 0), 0));

// Progress never carries over: one workout finishes at most one encounter per path.
function applyQuest(path, amount) {
  const q = quests[path];
  const quest = questById(q.id);
  const stages = stagesOf(quest);
  const stage = stages[q.stage];
  const size = sizeOf(stage, path);
  const done = round2(Math.min(amount, q.left));
  q.left = round2(q.left - done);
  const lines = [path === 'agility' ? `You covered ${fmtNum(done)} km toward: ${stage.name}.` : `You hit ${stage.name} for ${fmtNum(done)}.`];
  q.last = path === 'agility' ? `${fmtNum(done)} km` : `${fmtNum(done)} damage to ${stage.name}`;
  let cleared = null;
  if (q.left <= 0) {
    const gold = GOLD_PER_ENCOUNTER * quest.req;
    profile.gold += gold;
    lines.push(path === 'agility' ? `${stage.name}: done! +${gold} gold` : `${stage.name} defeated! +${gold} gold`);
    if (q.stage === stages.length - 1) {
      const bonus = GOLD_PER_CLEAR * quest.req;
      cleared = quest;
      profile.cleared[quest.id] = (profile.cleared[quest.id] || 0) + 1;
      profile.gold += bonus;
      addXp(quest.rewardXp);
      lines.push(`Quest cleared: ${quest.name}! +${quest.rewardXp} XP, +${bonus} gold`);
      quests[path] = null;
    } else {
      q.stage++;
      const next = stages[q.stage];
      q.left = sizeOf(next, path);
      const last = q.stage === stages.length - 1;
      lines.push(path === 'agility' ? `Next: ${next.name} (${fmtNum(q.left)} km)` : (last ? `Boss fight: ${next.name} appears!` : `${next.name} appears!`));
    }
  } else {
    lines.push(`${fmtNum(q.left)}/${fmtNum(size)} ${path === 'agility' ? 'km' : 'HP'} left.`);
  }
  return { lines, cleared };
}

function applyQuests(exercises) {
  const lines = [];
  const cleared = [];
  [['strength', strengthDamage(exercises)], ['agility', agilityKm(exercises)]].forEach(([path, amount]) => {
    if (!quests[path] || !questById(quests[path].id) || amount <= 0) return;
    const r = applyQuest(path, amount);
    lines.push(...r.lines);
    if (r.cleared) cleared.push(r.cleared);
  });
  return { lines, cleared };
}

function startQuest(path, quest) {
  quests[path] = { id: quest.id, stage: 0, left: sizeOf(quest.encounters[0], path), last: '', startedAt: Date.now() };
  persist();
  renderQuest();
  toast(`${quest.name} begins. Log a workout to progress!`, 2400);
}

function questCard(path, quest) {
  const have = effStat(path);
  const met = have >= quest.req;
  const n = quest.encounters.length;
  const unit = path === 'agility' ? 'leg' : 'encounter';
  const total = path === 'agility' ? stagesOf(quest).reduce((t, s) => t + s.km, 0) : 0;
  const cleared = profile.cleared[quest.id] || 0;
  return h('div', { class: 'card adv' },
    h('div', { class: 'adv-top' }, h('span', { class: 'adv-name', text: quest.name }), h('span', { class: 'adv-lv', text: `LV ${quest.req}` })),
    h('div', { class: 'adv-enemies' }, stagesOf(quest).map((e) => spriteFrom(ENEMY_SPRITES[e.sprite], 'sprite sm'))),
    h('div', { class: 'slot-label', text: `${n} ${unit}${n === 1 ? '' : 's'} and a ${path === 'agility' ? 'final leg' : 'boss'}${total ? `, ${fmtNum(total)} km in total` : ''}` }),
    h('div', { class: 'chips' }, h('span', { class: met ? 'chip' : 'chip unmet', text: met ? `${STATS[path]} ${quest.req}` : `Needs ${STATS[path]} ${quest.req} (you ${have})` })),
    h('div', { class: 'slot-label', text: `Reward: ${quest.rewardXp} XP, gold and ${RARITIES[quest.minRarity].label}+ gear${cleared ? `. Cleared ${cleared}x` : ''}` }),
    h('button', { class: 'btn small adv-btn', disabled: !met, onclick: () => startQuest(path, quest) }, met ? 'Begin quest' : 'Locked'));
}

function activeQuest(path) {
  const q = quests[path];
  const quest = questById(q.id);
  const stages = stagesOf(quest);
  const stage = stages[q.stage];
  const size = sizeOf(stage, path);
  const isBoss = q.stage === stages.length - 1;
  const agi = path === 'agility';
  const pct = agi ? ((size - q.left) / size) * 100 : (q.left / size) * 100;
  const abandon = h('button', { class: 'btn small danger', onclick: () => {
    if (!abandon.classList.contains('armed')) { abandon.classList.add('armed'); abandon.textContent = 'Confirm abandon'; return; }
    quests[path] = null; persist(); renderQuest(); toast('Quest abandoned');
  } }, 'Abandon quest');
  return [
    h('div', { class: 'card enemy-card' },
      h('div', { class: 'adv-top' }, h('span', { class: 'adv-name', text: quest.name }),
        h('span', { class: 'adv-lv', text: isBoss ? (agi ? 'FINAL LEG' : 'BOSS') : `${agi ? 'Leg' : 'Fight'} ${q.stage + 1}/${stages.length - 1}` })),
      h('div', { class: 'pips', role: 'img', 'aria-label': `Stage ${q.stage + 1} of ${stages.length}` },
        stages.map((e, i) => h('span', { class: 'pip' + (i < q.stage ? ' done' : '') + (i === q.stage ? ' now' : '') }))),
      h('div', { class: 'chest' }, spriteFrom(ENEMY_SPRITES[stage.sprite], 'sprite big')),
      h('div', { class: 'loot-name', text: stage.name }),
      h('div', { class: 'xp-bar small', role: 'progressbar', 'aria-label': agi ? 'Distance covered' : 'Enemy HP', 'aria-valuemin': 0, 'aria-valuemax': size, 'aria-valuenow': agi ? size - q.left : q.left },
        h('div', { class: 'xp-fill', style: `width:${pct}%` })),
      h('div', { class: 'stat-xp', text: agi ? `${fmtNum(size - q.left)}/${fmtNum(size)} km` : `HP ${fmtNum(q.left)}/${fmtNum(size)}` }),
      q.last ? h('div', { class: 'stat-note', text: `Last: ${q.last}` }) : null),
    h('div', { class: 'card' },
      h('div', { class: 'slot-name', text: agi ? 'How to travel' : 'How to fight' }),
      h('div', { class: 'slot-label', text: agi
        ? 'Log distance on an agility exercise (run, ride, swim, walk). Every km logged moves you forward. One workout finishes one leg at most.'
        : `Log a workout to attack. Each different strength exercise deals ${DAMAGE_PER_ACTIVITY} damage. One workout defeats one enemy at most.` })),
    abandon
  ];
}

function renderQuest() {
  const panel = panelEl('quest');
  panel.replaceChildren();
  panel.append(programCampaign());
  const keys = Object.keys(STATS);
  const segBtns = keys.map((k) => h('button', { type: 'button', class: 'seg-btn', 'aria-pressed': String(questView === k),
    onclick: () => { questView = k; renderQuest(); } }, STATS[k] + (quests[k] ? ' *' : '')));
  panel.append(h('div', { class: 'seg quest-seg', role: 'group', 'aria-label': 'Quest path' }, segBtns));

  const path = questView;
  if (quests[path] && questById(quests[path].id)) { panel.append(...activeQuest(path)); return; }
  quests[path] = null;
  const list = classOf().quests[path];
  panel.append(h('div', { class: 'bag-count', text: `${classOf().chapter}. Pick a ${STATS[path].toLowerCase()} quest.` }));
  list.forEach((quest) => panel.append(questCard(path, quest)));
  if (list.some((q) => q.req > MAX_LEVEL)) panel.append(h('div', { class: 'stat-note', text: `Some quests need more than level ${MAX_LEVEL}. Gear bonuses count towards the requirement.` }));
}
