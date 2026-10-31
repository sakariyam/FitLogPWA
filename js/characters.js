// HUD, character select, character creation, log out.
// Classic script: shares globals with the other files in js/ (load order is in popup.html).

/* ================= HUD ================= */
function renderHud(animateFrom) {
  const lvl = levelOf(profile.xp);
  $('hud-portrait').replaceChildren(characterSvg());
  $('hud-name').textContent = profile.name;
  $('hud-level').textContent = `LV ${lvl}`;
  $('hud').setAttribute('aria-label', `View character: ${profile.name}, level ${lvl}`);
  $('hud').title = `${profile.name}, LV ${lvl}, ${lvl >= MAX_LEVEL ? 'MAX LEVEL' : `${profile.xp % XP_PER_LEVEL}/${XP_PER_LEVEL} XP`}`;
  $('xp-bar').setAttribute('aria-valuenow', lvl >= MAX_LEVEL ? XP_PER_LEVEL : profile.xp % XP_PER_LEVEL);
  const fill = $('xp-fill');
  if (animateFrom != null) fill.style.width = `${xpPct(animateFrom)}%`;
  requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = `${xpPct(profile.xp)}%`; }));
}

function characterEquipmentOverview() {
  const level = levelOf(profile.xp);
  const bonus = gearBonus();
  return h('div', { class: 'character-equipment' },
    h('div', { class: 'character-equipment-heading' },
      h('div', { class: 'character-identity' }, h('h2', { text: profile.name }),
        h('p', { text: `${classOf().name}, LV ${level}${level >= MAX_LEVEL ? ' (MAX)' : ''}` }))),
    h('div', { class: 'character-equipment-body' },
      h('div', { class: 'character-equipment-preview' }, characterSvg()),
      h('div', { class: 'character-compact-stats' }, Object.entries(STATS).map(([key, label]) => {
        const info = statInfo(profile.stats[key]);
        const experience = info.max ? 'MAX LEVEL' : `${info.into}/${info.need} XP`;
        return h('div', { class: 'character-compact-stat', title: `${label}: ${experience}${bonus[key] ? `, +${bonus[key]} from gear` : ''}` },
          h('div', { class: 'character-stat-line' }, h('span', { text: label }),
            h('span', { text: `${info.level}${bonus[key] ? ` +${bonus[key]}` : ''}` })),
          h('div', { class: 'xp-bar small', role: 'progressbar', 'aria-label': `${label} experience`, 'aria-valuemin': 0,
            'aria-valuemax': info.need, 'aria-valuenow': info.max ? info.need : info.into, 'aria-valuetext': `Level ${info.level}, ${experience}${bonus[key] ? `, +${bonus[key]} from gear` : ''}` },
            h('div', { class: 'xp-fill', style: `width:${info.max ? 100 : (info.into / info.need) * 100}%` })));
      }))),
    h('div', { class: 'character-equipment-meta' }, h('span', { text: `Gold ${fmtNum(profile.gold)}` }),
      h('span', { text: `Account LV ${accountLevel(account.xp)}` })));
}

/* ================= Character select and creation ================= */
function hideGameUi() {
  $('hud').hidden = true;
  setTabBars(false);
  TAB_DEFS.forEach((t) => { panelEl(t.id).hidden = true; });
  $('app-title').hidden = false;
  $('app-title').textContent = 'FitLog';
  $('modal').hidden = true;
}

function showCharacterSelect() {
  if (!Object.keys(characters).length) return showCreate(false);
  hideGameUi();
  const panel = panelEl('onboard');
  panel.hidden = false;
  panel.replaceChildren(h('div', { class: 'onboard' },
    accountCard(),
    h('h2', { text: 'Choose your character' }),
    Object.values(characters).map((c) => h('div', { class: 'card char-row' },
      h('div', { class: 'slot-icon' }, characterSvg(c, c.inventory || [], c.equipped || emptyGear(), 'sprite sm')),
      h('div', { class: 'slot-info' },
        h('div', { class: 'slot-name', text: c.name }),
        h('div', { class: 'slot-label', text: `${(CLASSES[c.classId] || CLASSES[DEFAULT_CLASS]).name}, LV ${levelOf(c.xp || 0)}` })),
      h('button', { class: 'btn small', onclick: () => enterGame(c.id) }, 'Play'))),
    h('button', { class: 'btn primary', onclick: () => showCreate(true) }, 'New character')));
}

function createCharacter(name, classId) {
  const cls = CLASSES[classId];
  if (!name || !cls || !cls.enabled) return false;
  const id = crypto.randomUUID();
  profile = { id, name, classId, xp: 0, stats: { strength: 0, agility: 0 }, cleared: {}, gold: 0, masteredAt: null };
  inventory = []; equipped = emptyGear(); quests = emptyQuests(); // workouts and the draft belong to the account, not the character
  activeId = id;
  persist();
  startApp();
  return true;
}

function showCreate(canCancel, first = false) {
  hideGameUi();
  const panel = panelEl('onboard');
  panel.hidden = false;
  const nameInput = h('input', { type: 'text', maxlength: 20, placeholder: 'Your hero name', id: 'hero-name' });
  const error = h('div', { class: 'error', role: 'alert' });
  const classOpts = Object.entries(CLASSES).map(([id, c]) => h('label', { class: 'class-opt' },
    h('input', { type: 'radio', name: 'class', value: id, checked: id === DEFAULT_CLASS, disabled: !c.enabled, 'aria-label': c.name }),
    h('span', { class: 'box' }, h('span', { class: 'class-name', text: c.name }), h('span', { class: 'class-blurb', text: c.enabled ? c.blurb : 'Coming soon' }))));

  const start = () => {
    const name = nameInput.value.trim();
    if (!name) { error.textContent = 'Enter a name to start your adventure.'; nameInput.focus(); return; }
    const cls = panel.querySelector('input[name="class"]:checked');
    createCharacter(name, cls ? cls.value : DEFAULT_CLASS);
  };
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') start(); });

  panel.replaceChildren(h('div', { class: 'onboard' },
    first ? h('div', { class: 'stat-note', text: 'Step 2 of 2' }) : null,
    h('h2', { text: first ? 'Create your first character' : 'Create your character' }),
    h('p', { text: first ? 'Your first character turns your workouts into a game. The workouts and stats stay with your account, so you can add more characters whenever you like.' : 'Every logged workout earns XP and a gift box. Pick a name and a class.' }),
    h('label', { class: 'field' }, 'Character name', nameInput), error,
    h('div', { class: 'field', style: 'margin-top:8px' }, 'Class'),
    h('div', { class: 'class-list' }, classOpts),
    h('button', { class: 'btn primary', onclick: start }, 'Start training'),
    canCancel ? h('button', { class: 'btn', onclick: showCharacterSelect }, 'Back') : null));
  nameInput.focus();
}

function enterGame(id) {
  activeId = id;
  loadCharacter(id);
  persist();
  startApp();
}

function startApp() {
  panelEl('onboard').hidden = true;
  $('app-title').hidden = false;
  $('hud').hidden = false;
  setTabBars(true);
  renderHud();
  showTab('home');
}

function logout() {
  persist();
  profile = null;
  activeId = null;
  appStorage.set({ activeId: null });
  showCharacterSelect();
}

function deleteCharacter() {
  delete characters[profile.id];
  profile = null;
  activeId = null;
  appStorage.set({ characters, activeId: null });
  showCharacterSelect();
}
