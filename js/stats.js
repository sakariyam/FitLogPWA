// Stats tab: line graphs. Overview = workouts / weight lifted / distance per week or month. Exercise = progress for one exercise.
// Classic script: shares globals with the other files in js/ (load order is in popup.html).

let statsView = 'overview';
let statsMetric = 'workouts';
let statsPeriod = 'week';
let statsExercise = null;
let statsExMetric = null;

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
function buildSeries(metric, period, count = CHART_BUCKETS) {
  const now = bucketStart(new Date(), period);
  const buckets = [];
  for (let i = count - 1; i >= 0; i--) {
    const date = period === 'week' ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7 * i) : new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: isoOf(date), date, value: 0 });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  workouts.forEach((w) => { const b = byKey.get(isoOf(bucketStart(parseIso(w.date), period))); if (b) b.value += metric.of(w); });
  return buckets.map((b) => ({
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

function lineChart(points, { unit = '', goal = null, whole = false, zero = true, label = 'Line chart' } = {}) {
  const W = 340, H = 170, L = 40, R = 12, T = 12, B = 26;
  const vals = points.map((p) => p.value);
  const { lo, hi, ticks } = axisFor(vals, { zero, whole, goal });
  const x = (i) => L + (points.length === 1 ? (W - L - R) / 2 : ((W - L - R) * i) / (points.length - 1));
  const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img',
    'aria-label': `${label}. Latest value ${shortNum(vals[vals.length - 1])}${unit ? ' ' + unit : ''}.` });

  ticks.forEach((v) => {
    svg.append(svgEl('line', { class: 'grid', x1: L, x2: W - R, y1: y(v), y2: y(v) }));
    svg.append(svgEl('text', { x: L - 5, y: y(v) + 3, 'text-anchor': 'end' }, shortNum(v)));
  });
  if (goal != null) {
    svg.append(svgEl('line', { class: 'goal', x1: L, x2: W - R, y1: y(goal), y2: y(goal) }));
    svg.append(svgEl('text', { x: W - R, y: y(goal) - 3, 'text-anchor': 'end' }, 'goal'));
  }
  svg.append(svgEl('polyline', { class: 'line', points: points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ') }));
  points.forEach((p, i) => svg.append(svgEl('rect', { class: 'dot', x: x(i) - 2, y: y(p.value) - 2, width: 4, height: 4 })));

  const last = points.length - 1;
  const marks = [[0, 'start']];
  if (last >= 4) marks.push([Math.round(last / 2), 'middle']);
  if (last >= 1) marks.push([last, 'end']);
  marks.forEach(([i, anchor]) => svg.append(svgEl('text', { x: x(i), y: H - 8, 'text-anchor': anchor }, points[i].label)));
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
  panel.append(accountBar());
  const lifted = workouts.reduce((t, w) => t + OVERVIEW_METRICS.lifted.of(w), 0);
  const km = workouts.reduce((t, w) => t + OVERVIEW_METRICS.distance.of(w), 0);
  panel.append(h('div', { class: 'totals' }, [['Workouts', String(workouts.length)], ['Lifted', `${shortNum(lifted)} kg`], ['Distance', `${shortNum(round2(km))} km`]]
    .map(([k, v]) => h('div', { class: 'total' }, h('div', { class: 'total-val', text: v }), h('div', { class: 'slot-label', text: k })))));

  panel.append(segmented(Object.entries(OVERVIEW_METRICS).map(([id, m]) => [id, m.label]), statsMetric, (v) => { statsMetric = v; renderStats(); }, 'stats-seg'));
  panel.append(segmented([['week', 'Weekly'], ['month', 'Monthly']], statsPeriod, (v) => { statsPeriod = v; renderStats(); }, 'stats-seg'));

  const metric = OVERVIEW_METRICS[statsMetric];
  const series = buildSeries(metric, statsPeriod);
  const goal = statsMetric === 'workouts' && statsPeriod === 'week' ? account.weeklyGoal : null;
  const unit = metric.unit ? ` ${metric.unit}` : '';
  const current = series[series.length - 1].value;
  const best = Math.max(...series.map((p) => p.value));
  const per = statsPeriod === 'week' ? 'week' : 'month';
  panel.append(h('div', { class: 'card chart-card' },
    h('div', { class: 'slot-name', text: `${metric.title} per ${per}` }),
    lineChart(series, { unit: metric.unit, goal, whole: statsMetric === 'workouts', label: `${metric.title} per ${per}` }),
    h('div', { class: 'stat-note', text: `This ${per}: ${shortNum(current)}${unit}. Best: ${shortNum(best)}${unit}.${goal ? ` Goal: ${goal} a week.` : ''}` })));
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
