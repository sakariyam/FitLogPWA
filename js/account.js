// Account: one per install. It owns the workout log (History, Stats), the weekly goal and the account level.
// Characters are the game layer on top: they earn XP, gear and quests from workouts, but never own the workouts.
// Classic script: shares globals with the other files in js/ (load order is in popup.html).

const masteredCount = () => Object.values(characters).filter((c) => c.masteredAt).length;

// Account summary with an XP bar (character select, Settings).
function accountCard() {
  const lvl = accountLevel(account.xp);
  const into = account.xp % ACCOUNT_XP_PER_LEVEL;
  const n = Object.keys(characters).length;
  return h('div', { class: 'card account-card' },
    h('div', { class: 'acct-top' }, h('span', { class: 'slot-name acct-name', text: account.name || 'Player' }), h('span', { class: 'acct-lv', text: `Account LV ${lvl}` })),
    h('div', { class: 'xp-bar small', role: 'progressbar', 'aria-label': 'Account XP', 'aria-valuemin': 0, 'aria-valuemax': ACCOUNT_XP_PER_LEVEL, 'aria-valuenow': into },
      h('div', { class: 'xp-fill', style: `width:${accountPct(account.xp)}%` })),
    h('div', { class: 'stat-xp', text: `${into}/${ACCOUNT_XP_PER_LEVEL} XP` }),
    h('div', { class: 'stat-note', text: `${workouts.length} workout${workouts.length === 1 ? '' : 's'} logged. ${n} character${n === 1 ? '' : 's'}, ${masteredCount()} at max level.` }));
}

function weeklyGoalSelect(current, onPick) {
  return h('select', { class: 'select', id: 'weekly-goal', 'aria-label': 'Workouts per week', onchange: (e) => onPick(Number(e.target.value)) },
    Array.from({ length: MAX_WEEKLY_GOAL }, (_, i) => i + 1).map((n) => h('option', { value: String(n), selected: n === current }, `${n} workout${n === 1 ? '' : 's'} a week`)));
}

/* ---------- onboarding step 1: the account ---------- */
// Shown on first run, and once after upgrading from the old format (name is prefilled, characters are kept).
function showAccountSetup() {
  hideGameUi();
  const upgrading = Object.keys(characters).length > 0;
  if (!account) account = defaultAccount();
  const panel = panelEl('onboard');
  panel.hidden = false;

  const nameInput = h('input', { type: 'text', maxlength: 24, id: 'account-name', placeholder: 'Your name', value: account.name || '' });
  const error = h('div', { class: 'error', role: 'alert' });
  let goal = account.weeklyGoal;
  const themeBtns = THEMES.map((t) => h('button', { type: 'button', class: 'seg-btn', 'aria-pressed': String(theme === t.id),
    onclick: () => { setTheme(t.id); themeBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(THEMES[i].id === theme))); } }, t.label));

  const next = () => {
    const name = nameInput.value.trim();
    if (!name) { error.textContent = 'Enter your name to continue.'; nameInput.focus(); return; }
    account = { ...account, name, weeklyGoal: goal, onboarded: true };
    persistAccount();
    if (profile) startApp(); else if (upgrading) showCharacterSelect(); else showCreate(false, true);
  };
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') next(); });

  panel.replaceChildren(h('div', { class: 'onboard' },
    upgrading ? null : h('div', { class: 'stat-note', text: 'Step 1 of 2' }),
    h('h2', { text: upgrading ? 'Your account' : 'Welcome to FitLog' }),
    h('p', { text: 'Your account keeps every workout and all your stats, whichever character you play.' }),
    h('p', { text: 'Characters turn your workouts into a game, with XP, gear and quests. Make as many as you like. Your account level grows with every workout, and with each character you take to max level.' }),
    upgrading ? h('p', { text: 'Your characters\' workouts have been combined into one account history.' }) : null,
    h('label', { class: 'field' }, 'Your name', nameInput), error,
    h('label', { class: 'field', style: 'margin-top:8px' }, 'Workout goal', weeklyGoalSelect(goal, (n) => { goal = n; })),
    h('div', { class: 'field', style: 'margin-top:8px' }, 'Theme'),
    h('div', { class: 'seg theme-seg', role: 'group', 'aria-label': 'Theme' }, themeBtns),
    h('button', { class: 'btn primary', onclick: next }, upgrading ? 'Continue' : 'Next: create a character')));
  nameInput.focus();
}
