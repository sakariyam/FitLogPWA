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
const EXERCISE_TYPES = {
  'Squat': 'strength', 'Bench press': 'strength', 'Deadlift': 'strength', 'Overhead press': 'strength',
  'Barbell row': 'strength', 'Pull-up': 'strength', 'Dumbbell curl': 'strength', 'Lunge': 'strength',
  'Leg press': 'strength', 'Lat pulldown': 'strength', 'Running': 'agility', 'Cycling': 'agility',
  'Swimming': 'agility', 'Rowing machine': 'agility', 'Walking': 'agility'
};
const MUSCLE_GROUPS = {
  chest: 'Chest', shoulders: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
  core: 'Core', upperBack: 'Upper back', lats: 'Lats', lowerBack: 'Lower back', glutes: 'Glutes',
  quads: 'Quadriceps', hamstrings: 'Hamstrings', calves: 'Calves'
};
const EXERCISE_INFO = {
  'Squat': { muscles: 'Quadriceps, glutes and core', cue: 'Keep your feet planted and your torso braced. Bend at the hips and knees, then stand back up with control.' },
  'Bench press': { muscles: 'Chest, triceps and shoulders', cue: 'Lie on a bench with feet planted. Lower the bar toward your chest with control, then press up. Use safeties or a spotter.' },
  'Deadlift': { muscles: 'Glutes, hamstrings and back', cue: 'Brace your torso and hinge at the hips. Keep the weight close as you stand, then lower it with control.' },
  'Overhead press': { muscles: 'Shoulders and triceps', cue: 'Brace your core and press the weight overhead without leaning back. Lower it to shoulder height with control.' },
  'Barbell row': { muscles: 'Upper back, lats and biceps', cue: 'Hinge at the hips with a braced torso. Pull the bar toward your lower ribs without swinging, then lower slowly.' },
  'Pull-up': { muscles: 'Lats, upper back and biceps', cue: 'Start from a controlled hang. Pull your body toward the bar without swinging, then lower with control. Use assistance if needed.' },
  'Dumbbell curl': { muscles: 'Biceps and forearms', cue: 'Keep your elbows near your sides. Curl the dumbbells without swinging your torso, then lower slowly.' },
  'Lunge': { muscles: 'Quadriceps, glutes and hamstrings', cue: 'Step into a stable split stance. Bend both knees with control, keeping your front knee aligned with your foot, then return.' },
  'Leg press': { muscles: 'Quadriceps and glutes', cue: 'Keep your back against the pad. Lower the platform only as far as you can without rounding your lower back, then press away without locking your knees.' },
  'Lat pulldown': { muscles: 'Lats, upper back and biceps', cue: 'Sit tall and pull the bar toward your upper chest. Keep your torso steady and let the bar rise with control.' },
  'Running': { muscles: 'Cardiovascular endurance and legs', cue: 'Run at a sustainable pace with relaxed shoulders and comfortable strides. Increase distance gradually.' },
  'Cycling': { muscles: 'Cardiovascular endurance, quadriceps and glutes', cue: 'Adjust the saddle for a slight knee bend at the bottom of the pedal stroke. Pedal smoothly at a manageable resistance.' },
  'Swimming': { muscles: 'Cardiovascular endurance and full body', cue: 'Use a stroke you are comfortable with and breathe regularly. Swim in a supervised area and rest as needed.' },
  'Rowing machine': { muscles: 'Cardiovascular endurance, legs and back', cue: 'Drive with your legs, lean back slightly, then pull the handle toward your lower ribs. Return arms first, then torso, then knees.' },
  'Walking': { muscles: 'Cardiovascular endurance and legs', cue: 'Walk at a comfortable or brisk pace with an upright posture and relaxed arms. Choose a distance suited to your current fitness.' }
};
const EXERCISE_MUSCLES = {
  'Squat': { main: ['quads', 'glutes'], supporting: ['core', 'hamstrings'] },
  'Bench press': { main: ['chest'], supporting: ['triceps', 'shoulders'] },
  'Deadlift': { main: ['glutes', 'hamstrings'], supporting: ['lowerBack', 'upperBack', 'core', 'forearms'] },
  'Overhead press': { main: ['shoulders'], supporting: ['triceps', 'core'] },
  'Barbell row': { main: ['upperBack', 'lats'], supporting: ['biceps', 'lowerBack', 'forearms'] },
  'Pull-up': { main: ['lats'], supporting: ['upperBack', 'biceps', 'forearms', 'core'] },
  'Dumbbell curl': { main: ['biceps'], supporting: ['forearms'] },
  'Lunge': { main: ['quads', 'glutes'], supporting: ['hamstrings', 'calves', 'core'] },
  'Leg press': { main: ['quads', 'glutes'], supporting: ['hamstrings', 'calves'] },
  'Lat pulldown': { main: ['lats'], supporting: ['upperBack', 'biceps'] },
  'Running': { main: ['quads', 'glutes', 'calves'], supporting: ['hamstrings', 'core'] },
  'Cycling': { main: ['quads', 'glutes'], supporting: ['hamstrings', 'calves'] },
  'Swimming': { main: ['lats', 'shoulders'], supporting: ['chest', 'triceps', 'core', 'quads', 'glutes'] },
  'Rowing machine': { main: ['quads', 'glutes', 'lats'], supporting: ['hamstrings', 'upperBack', 'biceps', 'core'] },
  'Walking': { main: ['quads', 'glutes', 'calves'], supporting: ['hamstrings', 'core'] }
};

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
