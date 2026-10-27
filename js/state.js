// Shared game state and small helpers (levels, stats, gear bonus).
// Classic script: shares globals with the other files in js/ (load order is in popup.html).

/* ================= State ================= */
let characters = {};
let activeId = null;
let account = null;     // name, weeklyGoal, xp, onboarded, createdAt. One per install, shared by every character.
let profile = null;     // the active CHARACTER: id, name, classId, avatar, xp, stats, cleared, gold, masteredAt
let workouts = [];      // ACCOUNT-level workout log (every character logs into the same history)
let inventory = [];
let equipped = emptyGear();
let quests = emptyQuests();
let draft = blankDraft();   // account-level too: the workout being typed survives switching characters
let questView = 'strength';
let theme = 'gameboy';

function emptyGear() { return Object.fromEntries(SLOTS.map((s) => [s, null])); }
function emptyQuests() { return { strength: null, agility: null }; }
function today() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
function blankDraft() { return { date: today(), name: '', exercises: [] }; }
const newSet = (prev) => ({ reps: prev ? prev.reps : '', kg: prev ? prev.kg : '' });
const newExercise = () => ({ name: '', type: 'strength', typeSet: false, km: '', minutes: '', sets: [newSet()] });

const classOf = () => CLASSES[profile.classId] || CLASSES[DEFAULT_CLASS];
const levelOf = (xp) => Math.min(MAX_LEVEL, Math.floor(xp / XP_PER_LEVEL) + 1);
const xpPct = (xp) => (levelOf(xp) >= MAX_LEVEL ? 100 : (xp % XP_PER_LEVEL) / 10);
function statInfo(xp) {
  let level = 1;
  while (level < MAX_LEVEL && xp >= STAT_CUM[level]) level++;
  if (level >= MAX_LEVEL) return { level, into: 1, need: 1, max: true };
  return { level, into: xp - STAT_CUM[level - 1], need: STAT_CUM[level] - STAT_CUM[level - 1], max: false };
}
// Character XP is capped at MAX_XP, but the account always receives the full amount.
const addXp = (n) => { profile.xp = Math.min(MAX_XP, profile.xp + n); account.xp += n; };
function defaultAccount() { return { name: '', weeklyGoal: DEFAULT_WEEKLY_GOAL, xp: 0, onboarded: false, createdAt: Date.now() }; }
const accountLevel = (xp) => Math.floor(xp / ACCOUNT_XP_PER_LEVEL) + 1;
const accountPct = (xp) => ((xp % ACCOUNT_XP_PER_LEVEL) / ACCOUNT_XP_PER_LEVEL) * 100;
const itemById = (id) => inventory.find((i) => i.id === id);
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const round2 = (n) => Math.round(n * 100) / 100;
const fmtNum = (n) => Number(round2(n).toFixed(2)).toLocaleString();

function gearBonus() {
  const total = { strength: 0, agility: 0 };
  Object.values(equipped).forEach((id) => {
    const it = id && itemById(id);
    if (it) { total.strength += it.stats.strength; total.agility += it.stats.agility; }
  });
  return total;
}
const effStat = (k) => statInfo(profile.stats[k]).level + gearBonus()[k];

function guessType(name) {
  const n = name.trim().toLowerCase();
  for (const w of workouts) for (const e of w.exercises) if (e.name.toLowerCase() === n && e.type) return e.type;
  return AGILITY_RE.test(n) ? 'agility' : 'strength';
}
