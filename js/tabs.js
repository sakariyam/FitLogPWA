// Tab definitions and tab switching.
// Classic script: shares globals with the other files in js/ (load order is in popup.html).

const TAB_DEFS = [
  { id: 'home', label: 'Home' },
  { id: 'log', label: 'Workout' },
  { id: 'programs', label: 'Programs' },
  { id: 'history', label: 'History' },
  { id: 'stats', label: 'Stats' },
  { id: 'quest', label: 'Quests' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'store', label: 'Store' },
  { id: 'settings', label: 'Settings' },
  { id: 'more', label: 'More' }
];
const NAV_GROUPS = [
  { id: 'home', label: 'Home', pages: ['home', 'more', 'settings'] },
  { id: 'progress', label: 'Progress', pages: ['stats', 'history'] },
  { id: 'adventure', label: 'Adventure', pages: ['quest', 'inventory', 'store'] },
  { id: 'workout', label: 'Workout', pages: ['log', 'programs'] }
];
const lastGroupPages = { home: 'home', workout: 'log', progress: 'stats', adventure: 'quest' };
let activePage = 'home';
let navigationVisible = false;

function navigationIcon(name) {
  if (name === 'workout') return exerciseTypeIcon('strength');
  const shapes = name === 'home'
    ? [svgEl('path', { d: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z' })]
    : name === 'progress'
    ? [svgEl('path', { d: 'M3 3v18h18M8 16v-3M13 16V8M18 16v-5' })]
    : name === 'adventure'
      ? [svgEl('circle', { cx: 12, cy: 12, r: 10 }), svgEl('polygon', { points: '16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76' })]
      : [svgEl('circle', { cx: 5, cy: 12, r: 1 }), svgEl('circle', { cx: 12, cy: 12, r: 1 }), svgEl('circle', { cx: 19, cy: 12, r: 1 })];
  return svgEl('svg', { viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none', stroke: 'currentColor', 'stroke-width': 2,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' }, ...shapes);
}

/* ================= Tabs ================= */
function buildTabs() {
  const main = document.querySelector('main');
  $('home-logo').addEventListener('click', () => showTab('home'));
  $('hud').addEventListener('click', () => showTab('inventory'));
  main.before(workoutToolbar());
  main.before(h('nav', { id: 'section-nav', class: 'section-nav', 'aria-label': 'Section pages', hidden: true }));
  NAV_GROUPS.forEach((group) => $('app-nav').append(
    h('button', { type: 'button', 'data-destination': group.id, onclick: () => showTab(group.id === 'home' ? 'home' : group.id === 'workout' ? 'log' : lastGroupPages[group.id]) },
      navigationIcon(group.id), h('span', { text: group.label }))));
  TAB_DEFS.forEach((t) => {
    main.append(h('section', { id: 'panel-' + t.id, role: 'region', 'aria-label': t.label, hidden: true }));
  });
}
function setTabBars(visible) {
  navigationVisible = visible;
  $('app-nav').hidden = !visible;
  if (!visible) { $('workout-toolbar').hidden = true; $('section-nav').hidden = true; }
}

function setWorkoutFocus(focused, title) {
  $('app-nav').hidden = focused || !navigationVisible;
  $('workout-toolbar').hidden = focused || !navigationVisible || activePage !== 'log';
  $('section-nav').hidden = focused || !navigationVisible || !$('section-nav').children.length;
  $('hud').hidden = focused || !navigationVisible;
  const group = NAV_GROUPS.find((destination) => destination.pages.includes(activePage));
  $('app-title').textContent = title || (group.id === 'home' ? TAB_DEFS.find((page) => page.id === activePage).label : group.label);
}
function showTab(name) {
  if (!profile || !TAB_DEFS.some((page) => page.id === name)) return;
  activePage = name;
  const group = NAV_GROUPS.find((destination) => destination.pages.includes(name));
  lastGroupPages[group.id] = name;
  $('app-nav').hidden = !navigationVisible;
  $('app-nav').querySelectorAll('button').forEach((button) => {
    if (button.dataset.destination === group.id) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  TAB_DEFS.forEach((t) => { panelEl(t.id).hidden = t.id !== name; });
  const local = $('section-nav');
  local.replaceChildren();
  if (group.id === 'progress' || group.id === 'adventure' || group.id === 'workout') {
    local.append(...group.pages.map((id) => h('button', { type: 'button', 'aria-current': id === name ? 'page' : null,
      onclick: () => showTab(id) }, TAB_DEFS.find((page) => page.id === id).label)));
  } else if (group.id === 'home' && name !== 'home') {
    local.append(h('button', { type: 'button', onclick: () => showTab(name === 'settings' ? 'more' : 'home') }, name === 'settings' ? '\u2190 More' : '\u2190 Home'));
  }
  local.hidden = !navigationVisible || !local.children.length;
  local.setAttribute('aria-label', `${group.label} pages`);
  setWorkoutFocus(false);
  RENDERERS[name]();
  document.querySelector('main').scrollTop = 0; // each tab starts at the top
}

function renderMore() {
  panelEl('more').replaceChildren(accountCard(), h('div', { class: 'more-menu' },
    h('button', { type: 'button', onclick: () => showTab('settings') }, h('span', { text: 'Settings & account' }), h('span', { 'aria-hidden': 'true' }, '\u203a')),
    h('button', { type: 'button', onclick: logout }, h('span', { text: 'Switch character' }), h('span', { 'aria-hidden': 'true' }, '\u203a'))));
}

function renderHome() {
  if (syncWorkoutTimer()) persistDraft();
  renderWorkoutTimer();
  const hasDraft = hasDraftContent(draft) || !!draft.name.trim();
  const exerciseCount = draft.exercises.filter((exercise) => exercise.name.trim()).length;
  const run = programRun();
  const nextSession = run && !run.finishedAt ? nextProgramSession(run) : null;
  const start = isoOf(mondayOf(new Date()));
  const week = periodWorkouts(start, 'week');
  const goal = account.weeklyGoal || DEFAULT_WEEKLY_GOAL;
  const latest = [...workouts].sort((first, second) => second.date.localeCompare(first.date) || second.id - first.id)[0];
  const activeQuests = Object.entries(quests).flatMap(([path, progress]) => {
    if (!progress) return [];
    const quest = questById(progress.id);
    const stage = quest && stagesOf(quest)[progress.stage];
    return stage ? [{ path, progress, quest, stage }] : [];
  });
  const arrow = () => h('span', { class: 'home-link-arrow', 'aria-hidden': 'true' }, '\u203a');
  const workout = h('section', { class: 'home-workout', 'aria-label': 'Your workout' },
    h('div', { class: 'home-workout-copy' }, h('h2', { text: hasDraft ? 'Workout in progress' : nextSession ? 'Next program session' : 'Your next workout' }),
      h('p', { text: hasDraft ? (draft.name.trim() || `${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'} in your draft`) : nextSession ? `${run.program.name} / ${nextSession.name}` : 'Ready to log' }),
      !hasDraft && nextSession ? h('p', { class: 'stat-note', text: `Cycle ${programCycle(run)}${run.nextDate ? ` / Suggested ${prettyDate(run.nextDate)}` : ''}` }) : null,
      hasDraft && draft.name.trim() ? h('p', { class: 'stat-note', text: `${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'}` }) : null),
    h('button', { type: 'button', class: 'btn primary home-start', onclick: () => !hasDraft && nextSession ? startProgramSession(run) : showTab('log') },
      navigationIcon('workout'), h('span', { text: hasDraft ? 'Resume workout' : nextSession ? `Start ${nextSession.name}` : 'Start workout' })),
    h('div', { class: 'program-log-actions' }, h('button', { type: 'button', class: 'home-text-link', onclick: () => openPrograms() }, 'Programs'),
      !hasDraft && nextSession ? h('button', { type: 'button', class: 'home-text-link', onclick: () => showTab('log') }, 'Free workout') : null));
  const weekly = h('section', { class: 'home-section', 'aria-label': 'This week' },
    h('div', { class: 'home-section-heading' }, h('h2', { text: 'This week' }),
      h('button', { type: 'button', class: 'home-text-link', onclick: () => { statsView = 'overview'; statsPeriod = 'week'; statsSelectedPeriod.week = start; showTab('stats'); } }, 'View progress', arrow())),
    h('div', { class: 'home-goal-heading' }, h('strong', { text: `${week.length} / ${goal}` }), h('span', { text: week.length >= goal ? 'Weekly goal reached' : 'Workouts' })),
    h('div', { class: 'home-goal', role: 'progressbar', 'aria-label': 'Weekly workout goal', 'aria-valuemin': 0, 'aria-valuemax': goal,
      'aria-valuenow': Math.min(week.length, goal), 'aria-valuetext': `${week.length} of ${goal} workouts` },
      Array.from({ length: goal }, (_, index) => h('span', { class: index < week.length ? 'complete' : '', 'aria-hidden': 'true' }))),
    h('div', { class: 'home-week-totals' },
      h('span', { text: `${fmtNum(week.reduce((total, entry) => total + volume(entry), 0))} kg lifted` }),
      h('span', { text: `${fmtNum(week.reduce((total, entry) => total + kmOf(entry), 0))} km` })));
  const recent = h('section', { class: 'home-section', 'aria-label': 'Latest workout' },
    h('h2', { text: 'Latest workout' }),
    latest ? h('button', { type: 'button', class: 'home-destination', onclick: () => showTab('history') },
      h('span', { class: 'home-destination-copy' }, h('strong', { text: latest.name || 'Workout' }),
        h('span', { class: 'home-detail', text: prettyDate(latest.date) }),
        h('span', { class: 'home-detail', text: `${latest.exercises.length} exercise${latest.exercises.length === 1 ? '' : 's'}${kmOf(latest) ? ` / ${fmtNum(kmOf(latest))} km` : ` / ${fmtNum(volume(latest))} kg lifted`}` })), arrow())
      : h('p', { class: 'home-detail', text: 'No workouts logged yet.' }));
  const adventure = h('section', { class: 'home-section', 'aria-label': 'Adventure overview' },
    h('div', { class: 'home-section-heading' }, h('h2', { text: 'Adventure' }),
      h('button', { type: 'button', class: 'home-text-link', onclick: () => showTab('inventory') }, 'Inventory', arrow())),
    activeQuests.length ? activeQuests.map(({ path, progress, quest, stage }) => h('button', {
      type: 'button', class: 'home-destination', onclick: () => { questView = path; showTab('quest'); }
    }, spriteFrom(ENEMY_SPRITES[stage.sprite], 'sprite sm'),
    h('span', { class: 'home-destination-copy' }, h('strong', { text: quest.name }),
      h('span', { class: 'home-detail', text: `${STATS[path]} / ${stage.name}` }),
      h('span', { class: 'home-detail', text: `${fmtNum(progress.left)} ${path === 'agility' ? 'km' : 'HP'} remaining` })), arrow()))
      : h('button', { type: 'button', class: 'home-destination', onclick: () => showTab('quest') }, navigationIcon('adventure'),
        h('span', { class: 'home-destination-copy' }, h('strong', { text: 'Choose a quest' }), h('span', { class: 'home-detail', text: 'No active quests' })), arrow()));
  panelEl('home').replaceChildren(
    h('div', { class: 'home-date', text: new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) }),
    h('h2', { class: 'home-title', text: 'Home' }), workout, weekly, recent, adventure,
    h('button', { type: 'button', class: 'home-destination home-more', onclick: () => showTab('more') }, navigationIcon('more'),
      h('span', { class: 'home-destination-copy' }, h('strong', { text: 'Settings & more' })), arrow()));
}
