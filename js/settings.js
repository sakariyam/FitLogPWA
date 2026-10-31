// Settings tab: theme, log out, delete character.
// Classic script: shares globals with the other files in js/ (load order is in popup.html).

/* ================= Settings tab ================= */
function renderSettings() {
  const panel = panelEl('settings');
  const del = h('button', { class: 'btn danger', onclick: () => {
    if (!del.classList.contains('armed')) { del.classList.add('armed'); del.textContent = 'Confirm: delete forever'; return; }
    deleteCharacter();
  } }, 'Delete this character');
  const nameInput = h('input', { type: 'text', maxlength: 24, value: account.name, 'aria-label': 'Account name', onchange: (e) => {
    const v = e.target.value.trim();
    if (!v) { e.target.value = account.name; return toast('Your name cannot be empty.'); }
    account.name = v; persistAccount();
    const label = panel.querySelector('.acct-name'); if (label) label.textContent = v;
    toast('Name saved');
  } });
  panel.replaceChildren(
    accountCard(),
    h('div', { class: 'card' },
      h('div', { class: 'slot-name', text: 'Account settings' }),
      h('label', { class: 'field', style: 'margin-top:8px' }, 'Your name', nameInput),
      h('label', { class: 'field', style: 'margin-top:8px' }, 'Workout goal', weeklyGoalSelect(account.weeklyGoal, (n) => { account.weeklyGoal = n; persistAccount(); toast('Goal saved'); }))),
    h('div', { class: 'card char-row' },
      h('div', { class: 'slot-icon' }, characterSvg(profile, inventory, equipped, 'sprite sm')),
      h('div', { class: 'slot-info' },
        h('div', { class: 'slot-label', text: 'Playing as' }),
        h('div', { class: 'slot-name', text: profile.name }),
        h('div', { class: 'slot-label', text: `${classOf().name}, LV ${levelOf(profile.xp)}` }))),
    h('div', { class: 'card' },
      h('div', { class: 'slot-name', text: 'Theme' }),
      h('div', { class: 'seg theme-seg', role: 'group', 'aria-label': 'Theme' }, THEMES.map((t) => h('button', { type: 'button', class: 'seg-btn', 'aria-pressed': String(theme === t.id),
        onclick: () => { setTheme(t.id); renderSettings(); } }, t.label)))),
    h('button', { class: 'btn primary', onclick: logout }, 'Log out / switch character'),
    del,
    h('div', { class: 'stat-note', text: 'Workouts and stats belong to your account. Each character keeps its own XP, gear, gold and quests.' }));
}
