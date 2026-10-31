// Theme and saving/loading characters in IndexedDB.
// Classic script: shares globals with the other files in js/ (load order is in popup.html).

/* ================= Theme (shared by all characters) ================= */
function applyTheme(id) {
  theme = THEMES.some((t) => t.id === id) ? id : 'gameboy';
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelector('meta[name="theme-color"]').content = theme === 'night' ? '#0b0e20' : '#0f380f';
}
function setTheme(id) {
  applyTheme(id);
  appStorage.set({ theme });
}

/* ================= Storage ================= */
const SCHEMA = 2; // 1: workouts and the draft lived inside each character. 2: they belong to the account.

// Saves the active character and the account (account XP changes whenever a character earns XP).
function persist() {
  if (!profile) return Promise.resolve();
  characters[profile.id] = { ...profile, inventory, equipped, quests };
  return appStorage.set({ characters, activeId, schema: SCHEMA, ...(account ? { account } : {}) });
}
const persistAccount = () => appStorage.set({ account, schema: SCHEMA });
const persistWorkouts = () => appStorage.set({ workouts });
const persistDraft = () => { syncWorkoutTimer(); return appStorage.set({ draft }); };

function loadCharacter(id) {
  const { inventory: inv, equipped: eq, quests: q, ...p } = characters[id];
  profile = { ...p, id, stats: { strength: 0, agility: 0, ...(p.stats || {}) }, cleared: p.cleared || {}, gold: p.gold || 0, masteredAt: p.masteredAt || null };
  inventory = inv || [];
  equipped = { ...emptyGear(), ...(eq || {}) };
  quests = { ...emptyQuests(), ...(q || {}) };
}

/* ---------- migration: bring any older save up to SCHEMA 2 (pure: never touches storage) ---------- */
const hasDraftContent = (d) => !!(d && Array.isArray(d.exercises) && d.exercises.some((e) => (e.name || '').trim()));

// Version 0: one unnamed character stored as top-level keys. Gear and old quests are dropped (they no longer fit the setting).
function fromV0(r) {
  const id = crypto.randomUUID();
  const st = r.profile.stats || {};
  const character = {
    id, name: r.profile.name, classId: DEFAULT_CLASS,
    xp: Math.min(MAX_XP, r.profile.xp || 0),
    stats: { strength: Math.min(STAT_MAX_XP, st.strength || 0), agility: Math.min(STAT_MAX_XP, st.agility || 0) },
    cleared: {}, gold: 0, workouts: r.workouts || [], inventory: [], equipped: emptyGear(), quests: emptyQuests(), draft: r.draft || null
  };
  return { ...r, characters: { [id]: character }, activeId: id };
}

// Version 1: every character carried its own workouts and draft. Merge them into one account history.
function fromV1(r) {
  const seen = new Map();
  const chars = {};
  const active = r.characters[r.activeId] || Object.values(r.characters)[0];
  let draft = hasDraftContent(active && active.draft) ? active.draft : null;
  let xpSum = 0;
  let mastered = 0;
  Object.entries(r.characters).forEach(([id, c]) => {
    const { workouts: ws, draft: d, ...rest } = c;
    (ws || []).forEach((w) => { if (!seen.has(w.id)) seen.set(w.id, { ...w, characterId: w.characterId || id, character: w.character || rest.name }); });
    if (!draft && hasDraftContent(d)) draft = d;
    xpSum += rest.xp || 0;
    if ((rest.xp || 0) >= MAX_XP && !rest.masteredAt) { rest.masteredAt = Date.now(); mastered++; }
    chars[id] = rest;
  });
  const workouts = [...seen.values()].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const account = { ...defaultAccount(), name: (active && active.name) || 'Player', xp: xpSum + mastered * ACCOUNT_XP_MASTERED }; // onboarded stays false: the player confirms it once
  return { ...r, characters: chars, workouts, draft: draft || blankDraft(), account, schema: SCHEMA };
}

function migrateStore(r) {
  if (r.schema === SCHEMA) return r;
  if (!r.characters && !r.profile) return r; // fresh install: nothing to convert
  return fromV1(!r.characters && r.profile ? fromV0(r) : r);
}

async function load() {
  const raw = await appStorage.get();
  const r = migrateStore(raw);
  if (r !== raw) {
    const saved = await appStorage.set({ account: r.account, characters: r.characters, workouts: r.workouts, draft: r.draft, activeId: r.activeId || null, schema: SCHEMA });
    if (!saved) throw new Error('Could not upgrade saved data.');
    await appStorage.remove(['profile', 'inventory', 'equipped', 'adventure']);
  }
  applyTheme(r.theme);
  account = r.account ? { ...defaultAccount(), ...r.account } : null;
  characters = r.characters || {};
  Object.values(characters).forEach((character) => { delete character.avatar; });
  workouts = r.workouts || [];
  customExercises = Array.isArray(r.customExercises) ? r.customExercises : [];
  programData = r.programData ? { ...emptyProgramData(), ...r.programData } : emptyProgramData();
  draft = r.draft || blankDraft();
  activeId = r.activeId || null;
  if (activeId && characters[activeId]) loadCharacter(activeId); else activeId = null;
}
