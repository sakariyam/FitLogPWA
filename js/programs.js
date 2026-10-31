const PROGRAM_PRESETS = [{
  id: 'compound-foundations', name: 'Compound Foundations', weeklyTarget: 2, cycles: 4,
  sessions: [
    { id: 'compound-a', name: 'Session A', exercises: [
      { id: 'a-squat', name: 'Squat', type: 'strength', target: { sets: 3, repsMin: 5, repsMax: 8 } },
      { id: 'a-bench', name: 'Bench press', type: 'strength', target: { sets: 3, repsMin: 5, repsMax: 8 } },
      { id: 'a-row', name: 'Barbell row', type: 'strength', target: { sets: 3, repsMin: 6, repsMax: 10 } }
    ] },
    { id: 'compound-b', name: 'Session B', exercises: [
      { id: 'b-deadlift', name: 'Deadlift', type: 'strength', target: { sets: 2, repsMin: 5, repsMax: 8 } },
      { id: 'b-press', name: 'Overhead press', type: 'strength', target: { sets: 3, repsMin: 5, repsMax: 8 } },
      { id: 'b-pullup', name: 'Pull-up', type: 'strength', target: { sets: 3, repsMin: 5, repsMax: 8 } }
    ] }
  ]
}];

const PROGRAM_MILESTONES = [
  { id: 'first-session', label: 'First steps', earned: (run) => run.completions.length >= 1 },
  { id: 'first-cycle', label: 'First cycle', earned: (run) => run.completions.length >= run.program.sessions.length },
  { id: 'four-sessions', label: 'Finding rhythm', earned: (run) => run.completions.length >= 4 },
  { id: 'campaign-complete', label: 'Campaign complete', earned: (run) => !!run.finishedAt }
];

function emptyProgramData() { return { custom: [], runs: [], activeRunId: null }; }
function programLibrary() { return [...PROGRAM_PRESETS, ...programData.custom]; }
function programRun(id = programData.activeRunId) { return programData.runs.find((run) => run.id === id); }
function nextProgramSession(run) { return run.program.sessions[run.completions.length % run.program.sessions.length]; }
function programCycle(run) { return Math.floor(run.completions.length / run.program.sessions.length) + 1; }
function programGoal(run) { return run.program.cycles ? run.program.cycles * run.program.sessions.length : null; }

function programTargetText(exercise) {
  const target = exercise.target;
  return exercise.type === 'agility' ? `${fmtNum(target.km)} km${target.minutes ? ` / ${target.minutes} min` : ''}`
    : `${target.sets} set${target.sets === 1 ? '' : 's'} / ${target.repsMin}${target.repsMax !== target.repsMin ? `-${target.repsMax}` : ''} reps`;
}

function validateProgram(program) {
  if (!program.name.trim()) return 'Enter a program name.';
  if (!Number.isInteger(program.weeklyTarget) || program.weeklyTarget < 1 || program.weeklyTarget > 7) return 'Choose 1 to 7 sessions per week.';
  if (!Number.isInteger(program.cycles) || program.cycles < 0 || program.cycles > 52) return 'Choose 0 to 52 cycles. Zero is repeatable.';
  if (!program.sessions.length) return 'Add at least one session.';
  for (const session of program.sessions) {
    if (!session.name.trim() || !session.exercises.length) return 'Each session needs a name and at least one exercise.';
    for (const exercise of session.exercises) {
      if (!exerciseDefinition(exercise.name)) return 'Choose an exercise from the catalog.';
      const target = exercise.target;
      if (exercise.type === 'agility') {
        if (!Number.isFinite(target.km) || target.km <= 0 || !Number.isFinite(target.minutes) || target.minutes < 0) return 'Distance must be greater than zero; minutes cannot be negative.';
      } else if (!Number.isInteger(target.sets) || target.sets < 1 || target.sets > 20 || !Number.isInteger(target.repsMin) || target.repsMin < 1
        || !Number.isInteger(target.repsMax) || target.repsMax < target.repsMin || target.repsMax > 100) return 'Use 1 to 20 sets and a valid rep range from 1 to 100.';
    }
  }
  return '';
}

function newProgramRun(program) {
  return { id: crypto.randomUUID(), program: structuredClone(program), startedAt: Date.now(), nextDate: today(), completions: [], finishedAt: null };
}

function programEntry(template) {
  return { ...newExercise(), name: template.name, type: template.type, programItemId: template.id,
    target: structuredClone(template.target), skipped: false,
    sets: template.type === 'strength' ? Array.from({ length: template.target.sets }, () => newSet()) : [] };
}

function programSessionDraft(run, sessionIndex = run.completions.length % run.program.sessions.length, practice = false) {
  const session = run.program.sessions[sessionIndex];
  return { ...blankDraft(), name: `${run.program.name} / ${session.name}`,
    exercises: session.exercises.map(programEntry), programSaveMode: 'finish',
    program: { runId: run.id, programId: run.program.id, programName: run.program.name, session: structuredClone(session),
      sessionIndex, occurrence: run.completions.length, attemptId: crypto.randomUUID(), practice } };
}

function programAttemptExercises(context, current = []) {
  return [...workouts.filter((workout) => workout.program?.attemptId === context.attemptId).flatMap((workout) => workout.exercises), ...current];
}

function programItemProgress(exercise, context, current) {
  const entries = programAttemptExercises(context, current).filter((entry) => entry.programItemId === exercise.programItemId);
  const amount = exercise.type === 'agility' ? entries.reduce((total, entry) => total + (Number(entry.km) || 0), 0)
    : entries.reduce((total, entry) => total + entry.sets.filter((set) => Number(set.reps) > 0).length, 0);
  const goal = exercise.type === 'agility' ? exercise.target.km : exercise.target.sets;
  return { amount: round2(amount), goal, done: amount >= goal, skipped: exercise.skipped === true };
}

function programSessionProgress(current) {
  if (!draft.program) return [];
  return draft.exercises.filter((exercise) => exercise.programItemId).map((exercise) => ({
    exercise, ...programItemProgress(exercise, draft.program, current)
  }));
}

function completeProgramSession(context, workoutId) {
  const run = programRun(context.runId);
  if (!run || context.practice || run.finishedAt || programData.activeRunId !== run.id || context.occurrence !== run.completions.length
    || context.sessionIndex !== run.completions.length % run.program.sessions.length
    || run.completions.some((entry) => entry.attemptId === context.attemptId)) return [];
  const before = new Set(PROGRAM_MILESTONES.filter((milestone) => milestone.earned(run)).map((milestone) => milestone.id));
  run.completions.push({ attemptId: context.attemptId, workoutId, date: draft.date || today(), completedAt: Date.now(), sessionIndex: context.sessionIndex });
  run.nextDate = null;
  if (programGoal(run) && run.completions.length >= programGoal(run)) run.finishedAt = Date.now();
  const milestones = PROGRAM_MILESTONES.filter((milestone) => milestone.earned(run) && !before.has(milestone.id));
  return [`${run.program.name}: session complete`, ...milestones.map((milestone) => `Milestone: ${milestone.label}`)];
}

function remainingProgramDraft(saved, exercises) {
  const next = structuredClone(saved);
  next.date = today();
  next.timerElapsedMs = workoutElapsedMs();
  next.startedAt = null;
  next.timerPaused = true;
  next.exercises.forEach((exercise) => {
    if (!exercise.programItemId) { exercise.sets = [newSet()]; exercise.km = ''; exercise.minutes = ''; return; }
    const progress = programItemProgress(exercise, saved.program, exercises);
    exercise.sets = exercise.type === 'strength' ? Array.from({ length: Math.max(0, exercise.target.sets - progress.amount) }, () => newSet()) : [];
    exercise.km = '';
    exercise.minutes = '';
  });
  return next;
}

function previousExerciseResult(name, beforeDate = today()) {
  const entries = workouts.filter((workout) => workout.date <= beforeDate).sort((first, second) => second.date.localeCompare(first.date) || second.id - first.id);
  for (const workout of entries) {
    const exercise = workout.exercises.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
    if (exercise) return { workout, exercise };
  }
  return null;
}