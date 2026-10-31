// Stats tab: line graphs. Overview = workouts / weight lifted / distance per week or month. Exercise = progress for one exercise.
// Classic script: shares globals with the other files in js/ (load order is in popup.html).

let statsView = 'overview';
let statsMetric = 'workouts';
let statsPeriod = 'week';
let statsExercise = null;
let statsExMetric = null;
const statsSelectedPeriod = { week: null, month: null };

const OVERVIEW_METRICS = {
  workouts: { label: 'Workouts', title: 'Workouts', unit: '', of: () => 1 },
  lifted: { label: 'Lifted', title: 'Weight lifted', unit: 'kg', of: (w) => w.exercises.reduce((t, e) => t + e.sets.reduce((a, s) => a + s.reps * s.kg, 0), 0) },
  distance: { label: 'Distance', title: 'Distance', unit: 'km', of: (w) => w.exercises.reduce((t, e) => t + (e.km || 0), 0) }
};
const STRENGTH_METRICS = { top: { label: 'Top weight', unit: 'kg', of: (s) => s.top }, volume: { label: 'Volume', unit: 'kg', of: (s) => s.volume } };
const AGILITY_METRICS = { km: { label: 'Distance', unit: 'km', of: (s) => s.km }, minutes: { label: 'Time', unit: 'min', of: (s) => s.minutes } };

/* ---------- dates and series ---------- */
const pad2 = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
function parseIso(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
function mondayOf(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
const bucketStart = (d, period) => (period === 'week' ? mondayOf(d) : new Date(d.getFullYear(), d.getMonth(), 1));

// One point per week (Monday start) or month, oldest first, ending with the current one.
function buildSeries(metric, period, count = CHART_BUCKETS, endKey = null) {
  const now = bucketStart(endKey ? parseIso(endKey) : new Date(), period);
  const buckets = [];
  for (let i = count - 1; i >= 0; i--) {
    const date = period === 'week' ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7 * i) : new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: isoOf(date), date, value: 0 });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  workouts.forEach((w) => { const b = byKey.get(isoOf(bucketStart(parseIso(w.date), period))); if (b) b.value += metric.of(w); });
  return buckets.map((b) => ({
    key: b.key,
    label: b.date.toLocaleDateString(undefined, period === 'week' ? { day: 'numeric', month: 'short' } : { month: 'short' }),
    value: round2(b.value)
  }));
}

function exerciseList() {
  const map = new Map();
  workouts.forEach((w) => w.exercises.forEach((e) => {
    const k = e.name.toLowerCase();
    const cur = map.get(k) || { name: e.name, count: 0 };
    cur.count++;
    map.set(k, cur);
  }));
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

// One session per date for the named exercise, oldest first.
function exerciseSessions(name) {
  const key = name.toLowerCase();
  const byDate = new Map();
  workouts.forEach((w) => w.exercises.forEach((e) => {
    if (e.name.toLowerCase() !== key) return;
    const s = byDate.get(w.date) || { date: w.date, top: 0, volume: 0, km: 0, minutes: 0, agility: false };
    e.sets.forEach((x) => { s.top = Math.max(s.top, x.kg); s.volume += x.reps * x.kg; });
    s.km += e.km || 0;
    s.minutes += e.minutes || 0;
    if (e.type === 'agility') s.agility = true;
    byDate.set(w.date, s);
  }));
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/* ---------- line chart (SVG, no libraries) ---------- */
function niceStep(raw) {
  const exp = 10 ** Math.floor(Math.log10(raw));
  const f = raw / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
}
const shortNum = (n) => (n >= 1000 ? `${Number((n / 1000).toFixed(1))}k` : String(Number(n.toFixed(1))));

// Axis range and tick marks. zero = start at 0 (counts and totals); otherwise zoom in so a slow climb is visible.
function axisFor(vals, { zero, whole, goal }) {
  let hi = Math.max(...vals, goal || 0);
  let lo = zero ? 0 : Math.min(...vals);
  if (!zero) {
    const span = hi - lo || Math.max(hi * 0.2, 1);
    lo = Math.max(0, lo - span * 0.2);
    hi += span * 0.2;
  }
  let step = niceStep((hi - lo || 1) / 3);
  if (whole) step = Math.max(1, Math.ceil(step));
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  if (hi === lo) hi = lo + step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 1000; v += step) ticks.push(round2(v));
  return { lo, hi, ticks };
}

function lineChart(points, { unit = '', goal = null, whole = false, zero = true, label = 'Line chart', selectedKey = null, onSelect = null } = {}) {
  const W = 340, H = 170, L = 40, R = 12, T = 12, B = 26;
  const vals = points.map((p) => p.value);
  const { lo, hi, ticks } = axisFor(vals, { zero, whole, goal });
  const x = (i) => L + (points.length === 1 ? (W - L - R) / 2 : ((W - L - R) * i) / (points.length - 1));
  const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: onSelect ? 'group' : 'img',
    'aria-label': `${label}. Latest value ${shortNum(vals[vals.length - 1])}${unit ? ' ' + unit : ''}.` });

  ticks.forEach((v) => {
    svg.append(svgEl('line', { class: 'grid', x1: L, x2: W - R, y1: y(v), y2: y(v) }));
    svg.append(svgEl('text', { x: L - 5, y: y(v) + 3, 'text-anchor': 'end' }, shortNum(v)));
  });
  if (goal != null) {
    svg.append(svgEl('line', { class: 'goal', x1: L, x2: W - R, y1: y(goal), y2: y(goal) }));
    svg.append(svgEl('text', { x: W - R, y: y(goal) - 3, 'text-anchor': 'end' }, 'goal'));
  }
  const selectedIndex = points.findIndex((point) => point.key === selectedKey);
  if (selectedIndex >= 0) svg.append(svgEl('line', { class: 'chart-selection', x1: x(selectedIndex), x2: x(selectedIndex), y1: T, y2: H - B }));
  svg.append(svgEl('polyline', { class: 'line', points: points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ') }));
  points.forEach((p, i) => svg.append(svgEl('rect', { class: 'dot', x: x(i) - 2, y: y(p.value) - 2, width: 4, height: 4 })));
  if (selectedIndex >= 0) svg.append(svgEl('rect', { class: 'selected-dot', x: x(selectedIndex) - 4, y: y(points[selectedIndex].value) - 4, width: 8, height: 8 }));

  const last = points.length - 1;
  const marks = [[0, 'start']];
  if (last >= 4) marks.push([Math.round(last / 2), 'middle']);
  if (last >= 1) marks.push([last, 'end']);
  marks.forEach(([i, anchor]) => svg.append(svgEl('text', { x: x(i), y: H - 8, 'text-anchor': anchor }, points[i].label)));
  if (onSelect) points.forEach((point, index) => {
    const left = index === 0 ? L - 12 : (x(index - 1) + x(index)) / 2;
    const right = index === points.length - 1 ? W : (x(index) + x(index + 1)) / 2;
    const target = svgEl('rect', { id: `stats-point-${point.key}`, class: 'chart-period-target', x: left, y: T, width: right - left, height: H - T,
      role: 'button', tabindex: point.key === selectedKey ? '0' : '-1', 'aria-pressed': String(point.key === selectedKey),
      'aria-label': `${point.periodLabel || point.label}: ${fmtNum(point.value)}${unit ? ' ' + unit : ''}` });
    target.addEventListener('click', () => onSelect(point.key));
    target.addEventListener('keydown', (event) => {
      let nextIndex = index;
      if (event.key === 'ArrowLeft') nextIndex = Math.max(0, index - 1);
      else if (event.key === 'ArrowRight') nextIndex = Math.min(points.length - 1, index + 1);
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = points.length - 1;
      else if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      onSelect(points[nextIndex].key);
    });
    svg.append(target);
  });
  return svg;
}

/* ---------- tab ---------- */
function segmented(options, current, onPick, cls = '') {
  return h('div', { class: `seg ${cls}`.trim(), role: 'group' }, options.map(([id, label]) =>
    h('button', { type: 'button', class: 'seg-btn', 'aria-pressed': String(id === current), onclick: () => onPick(id) }, label)));
}

function renderStats() {
  const panel = panelEl('stats');
  panel.replaceChildren(segmented([['overview', 'Overview'], ['exercise', 'Exercise']], statsView, (v) => { statsView = v; renderStats(); }, 'stats-seg'));
  if (!workouts.length) {
    panel.append(h('div', { class: 'empty', text: 'No data yet. Log a workout and your progress charts will appear here.' }));
    return;
  }
  if (statsView === 'overview') renderOverview(panel); else renderExerciseStats(panel);
}

// The start page: workouts per week by default. It covers strength and cardio alike and matches the twice-a-week quest rhythm.
function renderOverview(panel) {
  const overview = h('div', { id: 'stats-overview' });
  panel.append(overview);
  renderOverviewContent(overview);
}

function updateStatsOverview(focusId) {
  const main = document.querySelector('main');
  const scrollTop = main.scrollTop;
  renderOverviewContent($('stats-overview'));
  if (focusId) $(focusId)?.focus({ preventScroll: true });
  main.scrollTop = scrollTop;
}

function statsPeriods(period) {
  const current = bucketStart(new Date(), period);
  const earliest = period === 'week' ? new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7 * (CHART_BUCKETS - 1))
    : new Date(current.getFullYear(), current.getMonth() - CHART_BUCKETS + 1, 1);
  workouts.forEach((workout) => { const date = bucketStart(parseIso(workout.date), period); if (date < earliest) earliest.setTime(date.getTime()); });
  const periods = [];
  for (let date = current; date >= earliest; date = period === 'week' ? new Date(date.getFullYear(), date.getMonth(), date.getDate() - 7)
    : new Date(date.getFullYear(), date.getMonth() - 1, 1)) periods.push(isoOf(date));
  return periods;
}

function periodWorkouts(key, period) {
  const start = parseIso(key);
  const next = isoOf(period === 'week' ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)
    : new Date(start.getFullYear(), start.getMonth() + 1, 1));
  return workouts.filter((workout) => workout.date >= key && workout.date < next);
}

function statsPeriodLabel(key, period) {
  if (period === 'month') return parseIso(key).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const start = parseIso(key);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  const format = (date, year) => date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });
  return `${format(start, start.getFullYear() !== end.getFullYear())} - ${format(end, true)}`;
}

function statsArrow(direction) {
  return svgEl('svg', { viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none', stroke: 'currentColor', 'stroke-width': 2,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' },
    svgEl('path', { d: direction === 'previous' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6' }));
}

function renderOverviewContent(panel) {
  const keys = statsPeriods(statsPeriod);
  if (!keys.includes(statsSelectedPeriod[statsPeriod])) statsSelectedPeriod[statsPeriod] = keys[0];
  const selected = statsSelectedPeriod[statsPeriod];
  const index = keys.indexOf(selected);
  const per = statsPeriod === 'week' ? 'week' : 'month';
  const selectPeriod = (key, focusId) => { statsSelectedPeriod[statsPeriod] = key; updateStatsOverview(focusId); };
  const periodSwitch = segmented([['week', 'Weekly'], ['month', 'Monthly']], statsPeriod, (value) => {
    statsPeriod = value; updateStatsOverview(`stats-mode-${value}`);
  }, 'stats-seg');
  [...periodSwitch.children].forEach((button, buttonIndex) => { button.id = `stats-mode-${buttonIndex === 0 ? 'week' : 'month'}`; });
  const picker = h('select', { id: 'stats-period-picker', class: 'select', 'aria-label': `Select ${per}`, hidden: true,
    onchange: (event) => selectPeriod(event.target.value, 'stats-period-label'),
    onkeydown: (event) => { if (event.key === 'Escape') { event.preventDefault(); picker.hidden = true; $('stats-period-label').setAttribute('aria-expanded', 'false'); $('stats-period-label').focus(); } }
  }, keys.map((key) => h('option', { value: key, selected: key === selected }, statsPeriodLabel(key, statsPeriod))));
  const dateButton = h('button', { id: 'stats-period-label', type: 'button', class: 'stats-period-label', 'aria-expanded': 'false',
    'aria-controls': 'stats-period-picker', title: `Choose ${per}`, onclick: () => {
      picker.hidden = !picker.hidden;
      dateButton.setAttribute('aria-expanded', String(!picker.hidden));
      if (!picker.hidden) picker.focus();
    }
  }, statsPeriodLabel(selected, statsPeriod));
  const navigator = h('div', { class: 'stats-period-nav', role: 'group', 'aria-label': `Selected ${per}` },
    h('button', { id: 'stats-period-previous', type: 'button', class: 'icon-btn', 'aria-label': `Previous ${per}`, title: `Previous ${per}`,
      disabled: index === keys.length - 1, onclick: () => selectPeriod(keys[index + 1], index + 1 === keys.length - 1 ? 'stats-period-label' : 'stats-period-previous') }, statsArrow('previous')),
    dateButton,
    h('button', { id: 'stats-period-next', type: 'button', class: 'icon-btn', 'aria-label': `Next ${per}`, title: `Next ${per}`,
      disabled: index === 0, onclick: () => selectPeriod(keys[index - 1], index === 1 ? 'stats-period-label' : 'stats-period-next') }, statsArrow('next')));
  const sessions = periodWorkouts(selected, statsPeriod);
  const exercises = sessions.flatMap((workout) => workout.exercises);
  const sets = exercises.filter((exercise) => exercise.type !== 'agility').flatMap((exercise) => exercise.sets);
  const totals = h('div', { class: 'stats-period-totals', role: 'group', 'aria-label': 'Selected period totals' },
    Object.entries(OVERVIEW_METRICS).map(([id, metric]) => {
      const value = round2(sessions.reduce((total, workout) => total + metric.of(workout), 0));
      return h('button', { id: `stats-total-${id}`, type: 'button', class: 'stats-total', 'aria-pressed': String(statsMetric === id),
        'aria-label': `${metric.label}: ${fmtNum(value)}${metric.unit ? ' ' + metric.unit : ''}`,
        onclick: () => { statsMetric = id; updateStatsOverview(`stats-total-${id}`); } },
        h('span', { class: 'total-val', text: `${shortNum(value)}${metric.unit ? ' ' + metric.unit : ''}` }),
        h('span', { class: 'stats-total-label', text: metric.label }));
    }));
  const details = h('dl', { class: 'stats-period-details', 'aria-label': 'Selected period activity' },
    [['Exercises', exercises.length], ['Sets', sets.length], ['Minutes', exercises.reduce((total, exercise) => total + (exercise.minutes || 0), 0)]]
      .map(([label, value]) => h('div', {}, h('dt', { text: label }), h('dd', { text: fmtNum(value) }))));
  const metric = OVERVIEW_METRICS[statsMetric];
  let series = buildSeries(metric, statsPeriod);
  if (selected < series[0].key) {
    const endIndex = Math.min(Math.max(0, index - 5), Math.max(0, keys.length - CHART_BUCKETS));
    series = buildSeries(metric, statsPeriod, CHART_BUCKETS, keys[endIndex]);
  }
  series = series.map((point) => ({ ...point, periodLabel: statsPeriodLabel(point.key, statsPeriod) }));
  const goal = statsMetric === 'workouts' && statsPeriod === 'week' ? account.weeklyGoal : null;
  const unit = metric.unit ? ` ${metric.unit}` : '';
  const value = series.find((point) => point.key === selected).value;
  const best = Math.max(...series.map((p) => p.value));
  const chart = h('div', { class: 'stats-trend' }, h('h2', { text: `${metric.title} per ${per}` }),
    lineChart(series, { unit: metric.unit, goal, whole: statsMetric === 'workouts', selectedKey: selected,
      label: `${metric.title} per ${per}`, onSelect: (key) => selectPeriod(key, `stats-point-${key}`) }),
    h('p', { class: 'stat-note', text: `Selected ${per}: ${shortNum(value)}${unit}. Best shown: ${shortNum(best)}${unit}.${goal ? ` Goal: ${goal} a week.` : ''}` }));
  const allTime = h('section', { class: 'stats-all-time', 'aria-label': 'All-time totals' }, h('h2', { text: 'All-time' }),
    h('dl', { class: 'stats-all-time-totals' }, Object.values(OVERVIEW_METRICS).map((definition) =>
      h('div', {}, h('dt', { text: definition.label }), h('dd', { text: `${fmtNum(round2(workouts.reduce((total, workout) => total + definition.of(workout), 0)))}${definition.unit ? ' ' + definition.unit : ''}` })))));
  panel.replaceChildren(periodSwitch, navigator, picker, totals, details, chart,
    statsPeriod === 'week' ? h('section', { id: 'weekly-workout-summary', class: 'weekly-workout-summary', 'aria-label': 'Muscles trained' },
      h('h2', { text: 'Muscles trained' }), musclePreview('the selected week', trainedMuscles(exercises), false),
      !sessions.length ? h('p', { class: 'stat-note', text: 'No workouts logged this week.' }) : null) : null, allTime);
}

function renderExerciseStats(panel) {
  const list = exerciseList();
  if (!statsExercise || !list.some((e) => e.name.toLowerCase() === statsExercise.toLowerCase())) { statsExercise = list[0].name; statsExMetric = null; }
  const sessions = exerciseSessions(statsExercise).slice(-CHART_SESSIONS);
  const agility = sessions.some((s) => s.agility);
  const metrics = agility ? AGILITY_METRICS : STRENGTH_METRICS;
  if (!metrics[statsExMetric]) statsExMetric = Object.keys(metrics)[0];
  const metric = metrics[statsExMetric];

  panel.append(h('select', { class: 'select', 'aria-label': 'Exercise', onchange: (e) => { statsExercise = e.target.value; statsExMetric = null; renderStats(); } },
    list.map((e) => h('option', { value: e.name, selected: e.name.toLowerCase() === statsExercise.toLowerCase() }, `${e.name} (${e.count})`))));
  panel.append(segmented(Object.entries(metrics).map(([id, m]) => [id, m.label]), statsExMetric, (v) => { statsExMetric = v; renderStats(); }, 'stats-seg'));

  const points = sessions.map((s) => ({ label: parseIso(s.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), value: round2(metric.of(s)) }));
  const vals = points.map((p) => p.value);
  const bestIdx = vals.indexOf(Math.max(...vals));
  panel.append(h('div', { class: 'card chart-card' },
    h('div', { class: 'slot-name', text: `${statsExercise}: ${metric.label.toLowerCase()} (${metric.unit})` }),
    lineChart(points, { unit: metric.unit, zero: false, label: `${statsExercise} ${metric.label.toLowerCase()}` }),
    h('div', { class: 'stat-note', text: `Latest: ${shortNum(vals[vals.length - 1])} ${metric.unit}. Best: ${shortNum(vals[bestIdx])} ${metric.unit} (${points[bestIdx].label}). Sessions: ${sessions.length}.` })));
}
