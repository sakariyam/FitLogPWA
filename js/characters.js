// HUD, character select, character creation, log out.
// Classic script: shares globals with the other files in js/ (load order is in popup.html).

/* ================= HUD ================= */
function renderHud(animateFrom) {
  const lvl = levelOf(profile.xp);
  $('hud-avatar').replaceChildren(avatarSprite(profile.avatar));
  $('hud-name').textContent = profile.name;
  $('hud-level').textContent = `LV ${lvl}`;
  $('hud-account').textContent = `Acct LV ${accountLevel(account.xp)}`;
  $('xp-text').textContent = lvl >= MAX_LEVEL ? 'MAX LEVEL' : `XP ${profile.xp % XP_PER_LEVEL}/${XP_PER_LEVEL}`;
  $('xp-bar').setAttribute('aria-valuenow', lvl >= MAX_LEVEL ? XP_PER_LEVEL : profile.xp % XP_PER_LEVEL);
  const fill = $('xp-fill');
  if (animateFrom != null) fill.style.width = `${xpPct(animateFrom)}%`;
  requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = `${xpPct(profile.xp)}%`; }));
}

/* ================= Character select and creation ================= */
function hideGameUi() {
  $('hud').hidden = true;
  setTabBars(false);
  TAB_DEFS.forEach((t) => { panelEl(t.id).hidden = true; });
  $('app-title').hidden = false;
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
      h('div', { class: 'slot-icon' }, avatarSprite(c.avatar, 'sprite sm')),
      h('div', { class: 'slot-info' },
        h('div', { class: 'slot-name', text: c.name }),
        h('div', { class: 'slot-label', text: `${(CLASSES[c.classId] || CLASSES[DEFAULT_CLASS]).name}, LV ${levelOf(c.xp || 0)}` })),
      h('button', { class: 'btn small', onclick: () => enterGame(c.id) }, 'Play'))),
    h('button', { class: 'btn primary', onclick: () => showCreate(true) }, 'New character')));
}

function createCharacter(name, classId, avatar) {
  const cls = CLASSES[classId];
  if (!name || !cls || !cls.enabled) return false;
  const id = crypto.randomUUID();
  profile = { id, name, classId, avatar: cls.avatars.includes(avatar) ? avatar : cls.avatars[0], xp: 0, stats: { strength: 0, agility: 0 }, cleared: {}, gold: 0, masteredAt: null };
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
  const avatarBox = h('fieldset', { class: 'avatar-pick' });
  const drawAvatars = (classId) => avatarBox.replaceChildren(h('legend', { class: 'sr-only' }, 'Choose an avatar'),
    ...CLASSES[classId].avatars.map((key, i) => h('label', { class: 'avatar-opt' },
      h('input', { type: 'radio', name: 'avatar', value: key, checked: i === 0, 'aria-label': key }), h('span', {}, avatarSprite(key)))));
  drawAvatars(DEFAULT_CLASS);
  panel.addEventListener('change', (e) => { if (e.target.name === 'class') drawAvatars(e.target.value); });

  const start = () => {
    const name = nameInput.value.trim();
    if (!name) { error.textContent = 'Enter a name to start your adventure.'; nameInput.focus(); return; }
    const cls = panel.querySelector('input[name="class"]:checked');
    const av = panel.querySelector('input[name="avatar"]:checked');
    createCharacter(name, cls ? cls.value : DEFAULT_CLASS, av ? av.value : null);
  };
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') start(); });

  panel.replaceChildren(h('div', { class: 'onboard' },
    first ? h('div', { class: 'stat-note', text: 'Step 2 of 2' }) : null,
    h('h2', { text: first ? 'Create your first character' : 'Create your character' }),
    h('p', { text: first ? 'Your first character turns your workouts into a game. The workouts and stats stay with your account, so you can add more characters whenever you like.' : 'Every logged workout earns XP and a gift box. Pick a name, a class and an avatar.' }),
    h('label', { class: 'field' }, 'Character name', nameInput), error,
    h('div', { class: 'field', style: 'margin-top:8px' }, 'Class'),
    h('div', { class: 'class-list' }, classOpts),
    h('div', { class: 'field' }, 'Avatar'), avatarBox,
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
  $('app-title').hidden = true;
  $('hud').hidden = false;
  setTabBars(true);
  renderHud();
  refreshExerciseList();
  showTab('log');
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
