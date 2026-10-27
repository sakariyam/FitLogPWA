// Game rules and tuning numbers: level caps, XP, gold, rarities, store prices.
// Classic script: shares globals with the other files in js/ (load order is in popup.html).

/* ================= Config ================= */
const MAX_LEVEL = 10;            // Chapter 1 cap for character level and for Strength/Agility. Raise it when adding chapters.
const XP_PER_WORKOUT = 100;
const XP_PER_LEVEL = 1000;       // character level: flat
const MAX_XP = (MAX_LEVEL - 1) * XP_PER_LEVEL;
const STAT_XP_PER_SET = 5;       // Strength XP per logged set
const XP_PER_KM = 20;            // Agility XP per km
const DAMAGE_PER_ACTIVITY = 10;  // strength quests: damage per different exercise in a workout
const GOLD_PER_ENCOUNTER = 10;   // x quest level, per enemy or leg finished
const GOLD_PER_CLEAR = 30;       // x quest level, bonus for clearing a quest
const STATS = { strength: 'Strength', agility: 'Agility' };
const DEFAULT_CLASS = 'salaryman'; // preselected on the create screen; also the fallback when a saved class id is unknown
const ACCOUNT_XP_PER_LEVEL = 1000; // account level: flat, no cap
const ACCOUNT_XP_MASTERED = 1000;  // account XP bonus the first time a character reaches max level
const DEFAULT_WEEKLY_GOAL = 2;     // workouts a week; each account chooses its own, drawn as the goal line on the Stats chart
const MAX_WEEKLY_GOAL = 7;
const CHART_BUCKETS = 12;        // weeks or months shown on the overview chart
const CHART_SESSIONS = 20;       // most recent sessions shown on an exercise chart

// Strength/Agility levels get slower: each level costs 25% more XP than the last.
const STAT_CUM = [0];
for (let L = 1; L < MAX_LEVEL; L++) STAT_CUM.push(STAT_CUM[L - 1] + Math.round(100 * 1.25 ** (L - 1)));
const STAT_MAX_XP = STAT_CUM[MAX_LEVEL - 1];

const THEMES = [{ id: 'gameboy', label: 'Game Boy' }, { id: 'night', label: 'Night' }];
const SLOTS = ['weapon', 'head', 'body', 'neck', 'feet'];
const SLOT_LABEL = { weapon: 'Weapon', head: 'Head', body: 'Body', neck: 'Neck', feet: 'Feet' };

const COMMON = ['Squat', 'Bench press', 'Deadlift', 'Overhead press', 'Barbell row', 'Pull-up', 'Dumbbell curl', 'Lunge', 'Leg press', 'Lat pulldown',
  'Running', 'Cycling', 'Swimming', 'Rowing machine', 'Walking'];
const AGILITY_RE = /\b(run|running|jog|jogging|sprint|sprints|cycling|bike|biking|swim|swimming|rowing|jump rope|skipping|burpees?|hiit|cardio|treadmill|elliptical|stairs?|hike|hiking|walk|walking|box jumps?|jumping jacks?|mountain climbers?)\b/i;

const RARITIES = [
  { key: 'common', label: 'Common', weight: 60, bonus: 1 },
  { key: 'uncommon', label: 'Uncommon', weight: 25, bonus: 2 },
  { key: 'rare', label: 'Rare', weight: 10, bonus: 3 },
  { key: 'epic', label: 'Epic', weight: 4, bonus: 5 },
  { key: 'legendary', label: 'Legendary', weight: 1, bonus: 8 }
];
const SELL_PRICE = [10, 30, 80, 200, 500];   // by rarity index
const STORE_ITEMS = [
  { id: 'box', name: 'Gift Box', price: 0, minRarity: 0, text: 'One piece of gear.' },
  { id: 'fancy', name: 'Fancy Gift Box', price: 0, minRarity: 1, text: 'Uncommon gear or better.' },
  { id: 'deluxe', name: 'Deluxe Gift Box', price: 0, minRarity: 2, text: 'Rare gear or better.' }
];
