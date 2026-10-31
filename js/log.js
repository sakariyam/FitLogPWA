// Log tab: logging a workout.
// Classic script: shares globals with the other files in js/ (load order is in popup.html).

/* ================= Log tab ================= */
function numInput(value, props, onChange) {
  return h('input', { type: 'number', min: 0, inputmode: 'decimal', value, ...props, oninput: (e) => { onChange(e.target.value); renderWorkoutSummary(); } });
}

function renderWorkoutSummary() {
  const summary = $('workout-summary');
  if (!summary) return;
  const exercises = draft.exercises.filter((exercise) => exercise.name.trim() && !exercise.skipped);
  const strength = exercises.filter((exercise) => exercise.type !== 'agility');
  const sets = strength.flatMap((exercise) => exercise.sets.filter((set) => set.reps !== '' || set.kg !== ''));
  const agility = exercises.filter((exercise) => exercise.type === 'agility');
  const muscles = trainedMuscles(exercises);
  const metrics = [
    ['Exercises', exercises.length], ['Sets', sets.length],
    ['Reps', sets.reduce((total, set) => total + (Number(set.reps) || 0), 0)],
    ['Volume (kg)', sets.reduce((total, set) => total + (Number(set.reps) || 0) * (Number(set.kg) || 0), 0)],
    ['Distance (km)', agility.reduce((total, exercise) => total + (Number(exercise.km) || 0), 0)],
    ['Minutes', agility.reduce((total, exercise) => total + (Number(exercise.minutes) || 0), 0)]
  ];
  summary.replaceChildren(h('h2', { text: 'Summary' }), h('dl', { class: 'summary-metrics' },
    metrics.map(([label, value]) => h('div', {}, h('dt', { text: label }), h('dd', { text: fmtNum(value) })))),
    musclePreview('this workout', muscles, false));
  refreshProgramProgress();
}

function musclePreview(name, muscles = exerciseDefinition(name), showGuide = true) {
  if (!muscles) return null;
  const common = {
    shoulders: 'M34 42 Q22 42 21 59 L31 62 L37 49 Z M66 42 Q78 42 79 59 L69 62 L63 49 Z',
    forearms: 'M20 85 L28 88 L21 117 L14 114 Z M80 85 L72 88 L79 117 L86 114 Z',
    calves: 'M34 174 L45 174 L43 201 L37 211 L32 201 Z M55 174 L66 174 L68 201 L63 211 L57 201 Z'
  };
  const front = {
    ...common,
    chest: 'M36 49 L49 51 L49 72 L34 69 L32 59 Z M64 49 L51 51 L51 72 L66 69 L68 59 Z',
    biceps: 'M23 63 L31 65 L28 84 L20 81 Z M77 63 L69 65 L72 84 L80 81 Z',
    core: 'M36 76 L64 76 L61 111 L51 119 L49 119 L39 111 Z',
    quads: 'M32 126 L47 128 L45 169 L33 169 L30 149 Z M68 126 L53 128 L55 169 L67 169 L70 149 Z'
  };
  const back = {
    ...common,
    upperBack: 'M37 45 L50 40 L63 45 L64 62 L50 73 L36 62 Z',
    lats: 'M34 65 L48 76 L45 99 L37 91 Z M66 65 L52 76 L55 99 L63 91 Z',
    lowerBack: 'M45 79 L55 79 L60 113 L40 113 Z',
    triceps: 'M23 63 L31 65 L28 84 L20 81 Z M77 63 L69 65 L72 84 L80 81 Z',
    glutes: 'M35 116 L49 119 L49 137 L32 137 L31 129 Z M65 116 L51 119 L51 137 L68 137 L69 129 Z',
    hamstrings: 'M32 141 L47 141 L45 169 L33 169 Z M68 141 L53 141 L55 169 L67 169 Z'
  };
  const names = (keys) => keys.length ? keys.map((key) => MUSCLE_GROUPS[key]).join(', ') : 'None';
  const diagram = (side, regions) => {
    const svg = svgEl('svg', { viewBox: '0 0 100 228', class: 'muscle-body', 'aria-hidden': 'true', focusable: 'false' },
      svgEl('circle', { cx: 50, cy: 19, r: 13, class: 'muscle-outline' }),
      svgEl('path', { class: 'muscle-outline', d: 'M43 32 L43 38 L29 42 Q20 44 17 61 L10 115 Q9 124 16 125 L22 120 L31 86 L34 108 L28 130 L30 170 L30 205 L33 218 L45 218 L47 174 L50 146 L53 174 L55 218 L67 218 L70 205 L70 170 L72 130 L66 108 L69 86 L78 120 L84 125 Q91 124 90 115 L83 61 Q80 44 71 42 L57 38 L57 32 Z' }),
      ...Object.entries(regions).map(([key, path]) => svgEl('path', {
        d: path, 'data-muscle': key,
        class: `muscle-region${muscles.main.includes(key) ? ' muscle-main' : muscles.supporting.includes(key) ? ' muscle-supporting' : ''}`
      })));
    return h('div', { class: 'muscle-view' }, svg, h('span', { text: side }));
  };
  return h('figure', { class: 'muscle-preview', 'aria-label': `Muscles worked by ${name}` },
    h('div', { class: 'muscle-views' }, diagram('Front', front), diagram('Back', back)),
    h('figcaption', {},
      h('p', { class: 'muscle-key muscle-key-main' }, h('strong', { text: 'Main: ' }), names(muscles.main)),
      muscles.supporting.length ? h('p', { class: 'muscle-key muscle-key-supporting' }, h('strong', { text: 'Supporting: ' }), names(muscles.supporting)) : null,
      showGuide ? h('p', { class: 'muscle-note', text: 'General guide. Muscle emphasis varies with technique and equipment.' }) : null));
}

function showExerciseInfo(name, trigger, type = 'strength') {
  const modal = $('modal');
  const info = exerciseDefinition(name) || { type, muscles: 'Not specified', cue: 'No additional information is available for this exercise.' };
  const close = () => { modal.hidden = true; modal.replaceChildren(); trigger.focus(); };
  const closeButton = h('button', { type: 'button', class: 'btn', onclick: close }, 'Close');
  const content = h('div', { class: 'exercise-dialog-content', role: 'region', 'aria-label': 'Exercise information', tabindex: '0' },
    musclePreview(name), h('p', { class: 'exercise-focus', text: `${STATS[info.type]}: ${info.muscles}` }),
    info.cue ? h('p', { text: info.cue }) : null);
  modal.replaceChildren(h('div', {
    class: 'dialog exercise-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'exercise-info-title',
    onkeydown: (event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
      if (event.key === 'Tab') { event.preventDefault(); (document.activeElement === closeButton ? content : closeButton).focus(); }
    }
  }, h('div', { class: 'exercise-dialog-header' }, h('h2', { id: 'exercise-info-title', text: name })),
  content, h('div', { class: 'exercise-dialog-footer' }, closeButton)));
  modal.hidden = false;
  closeButton.focus();
}

let workoutTimerInterval = null;

function workoutTimerIcon(kind) {
  const shapes = kind === 'pause'
    ? [svgEl('rect', { x: 6, y: 4, width: 4, height: 16, rx: 1 }), svgEl('rect', { x: 14, y: 4, width: 4, height: 16, rx: 1 })]
    : kind === 'play' ? [svgEl('polygon', { points: '6 3 20 12 6 21 6 3' })]
      : [svgEl('path', { d: 'M3 11a9 9 0 1 1 2.64 6.36' }), svgEl('polyline', { points: '3 3 3 11 11 11' })];
  return svgEl('svg', { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor', 'stroke-width': 2,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' }, ...shapes);
}

function toggleWorkoutTimer() {
  if (!draft.exercises.some((exercise) => exercise.name.trim())) return;
  if (draft.timerPaused) {
    draft.timerPaused = false;
    draft.startedAt = Date.now();
  } else {
    draft.timerElapsedMs = workoutElapsedMs();
    draft.startedAt = null;
    draft.timerPaused = true;
  }
  persistDraft();
  renderWorkoutTimer();
}

function resetWorkoutTimer() {
  draft.timerElapsedMs = 0;
  draft.startedAt = null;
  persistDraft();
  renderWorkoutTimer();
}

function renderWorkoutTimer() {
  const timer = $('workout-timer');
  if (!timer) return;
  const seconds = Math.floor(workoutElapsedMs() / 1000);
  timer.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const active = draft.exercises.some((exercise) => exercise.name.trim());
  const toggle = $('workout-timer-toggle');
  const label = draft.timerPaused || !active ? 'Resume workout timer' : 'Pause workout timer';
  if (toggle.getAttribute('aria-label') !== label) {
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    toggle.replaceChildren(workoutTimerIcon(draft.timerPaused || !active ? 'play' : 'pause'));
  }
  toggle.disabled = !active;
  $('workout-timer-reset').disabled = !active;
  if (draft.startedAt && workoutTimerInterval === null) workoutTimerInterval = setInterval(renderWorkoutTimer, 1000);
  else if (!draft.startedAt && workoutTimerInterval !== null) {
    clearInterval(workoutTimerInterval);
    workoutTimerInterval = null;
  }
}

function workoutToolbar() {
  return h('div', { id: 'workout-toolbar', class: 'workout-toolbar', role: 'group', 'aria-label': 'Workout actions', hidden: true },
    h('div', { class: 'workout-timer-controls', role: 'group', 'aria-label': 'Workout timer controls' },
      h('button', { id: 'workout-timer-reset', type: 'button', class: 'icon-btn workout-timer-control', disabled: true,
        'aria-label': 'Reset workout timer', title: 'Reset workout timer', onclick: resetWorkoutTimer }, workoutTimerIcon('reset')),
      h('span', { id: 'workout-timer', class: 'workout-timer', role: 'timer', 'aria-label': 'Workout elapsed time', 'aria-live': 'off' }, '0:00'),
      h('button', { id: 'workout-timer-toggle', type: 'button', class: 'icon-btn workout-timer-control', disabled: true,
        'aria-label': 'Resume workout timer', title: 'Resume workout timer', onclick: toggleWorkoutTimer }, workoutTimerIcon('play'))),
    h('button', { type: 'button', class: 'icon-btn workout-save', 'aria-label': 'Save workout', title: 'Save workout', onclick: saveWorkout },
      h('span', { text: 'Save workout' }),
      svgEl('svg', { viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none', stroke: 'currentColor', 'stroke-width': 2,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' },
      svgEl('path', { d: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z' }),
      svgEl('polyline', { points: '17 21 17 13 7 13 7 21' }),
      svgEl('polyline', { points: '7 3 7 8 15 8 15 3' }))));
}

function renderCustomExerciseForm() {
  setWorkoutFocus(true, 'Create exercise');
  const panel = panelEl('log');
  const nameInput = h('input', { type: 'text', name: 'name', required: true, maxlength: 80, autocomplete: 'off', 'aria-label': 'Exercise name' });
  const error = h('p', { class: 'exercise-form-error', role: 'alert', hidden: true });
  const submit = h('button', { type: 'submit', class: 'btn primary' }, 'Create exercise');
  const form = h('form', { class: 'custom-exercise-form', onsubmit: async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    const data = new FormData(form);
    const name = nameInput.value.trim().replace(/\s+/g, ' ');
    const type = data.get('type');
    const main = data.getAll('muscles');
    const message = !name ? 'Enter an exercise name.'
      : exerciseCatalog().some((exercise) => exercise.name.toLowerCase() === name.toLowerCase()) ? 'An exercise with this name already exists.'
      : !Object.hasOwn(STATS, type) ? 'Choose Strength or Agility.'
      : !main.length ? 'Select at least one targeted muscle group.' : '';
    error.textContent = message;
    error.hidden = !message;
    if (message) return;
    submit.disabled = true;
    try {
      const next = [...customExercises, { name, type, main, supporting: [] }];
      if (!await appStorage.set({ customExercises: next })) throw new Error('Exercise could not be saved');
      customExercises = next;
      renderExercisePicker(name);
      panel.querySelector('.exercise-pick').focus();
    } catch (failure) {
      error.textContent = 'Could not save this exercise. Try again.';
      error.hidden = false;
    } finally {
      submit.disabled = false;
    }
  } },
  h('label', { class: 'field' }, 'Exercise name', nameInput),
  h('fieldset', {}, h('legend', { text: 'Training type' }),
    h('div', { class: 'custom-type-options' }, Object.entries(STATS).map(([key, label]) =>
      h('label', { class: 'custom-choice' }, h('input', { type: 'radio', name: 'type', value: key, checked: key === 'strength' }), label)))),
  h('fieldset', {}, h('legend', { text: 'Targeted muscle groups' }),
    h('div', { class: 'custom-muscle-options' }, Object.entries(MUSCLE_GROUPS).map(([key, label]) =>
      h('label', { class: 'custom-choice' }, h('input', { type: 'checkbox', name: 'muscles', value: key }), label)))),
  error, submit);
  panel.replaceChildren(h('div', { class: 'exercise-picker-head' },
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Back to exercises', title: 'Back to exercises', onclick: () => renderExercisePicker() }, '\u2190'),
    h('h2', { text: 'Create exercise' })), form);
  document.querySelector('main').scrollTop = 0;
  nameInput.focus();
}

function exerciseTypeIcon(type) {
  const paths = type === 'agility' ? ['m13 2-1 8h9L11 22l1-8H3L13 2Z']
    : ['m6.5 6.5 11 11', 'm21 21-1-1', 'm3 3 1 1', 'm18 22 4-4', 'm2 6 4-4', 'm3 10 7-7', 'm14 21 7-7'];
  return svgEl('svg', { class: 'exercise-type-icon', viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none',
    stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' },
    svgEl('title', {}, STATS[type]), ...paths.map((path) => svgEl('path', { d: path })));
}

function renderExercisePicker(query = '', onPick = null) {
  setWorkoutFocus(true, 'Exercises');
  const panel = panelEl('log');
  const list = h('ul', { class: 'exercise-catalog', 'aria-label': 'Exercises' });
  const add = (definition) => {
    if (onPick) { onPick(definition); return; }
    const exercise = newExercise();
    exercise.name = definition.name;
    exercise.type = definition.type;
    draft.exercises.push(exercise);
    persistDraft();
    renderLog();
    const cards = panel.querySelectorAll('.card');
    cards[cards.length - 1].querySelector('input').focus();
  };
  const search = h('input', { type: 'search', value: query, placeholder: 'Search', 'aria-label': 'Search exercises',
    oninput: () => renderResults(), onkeydown: (event) => { if (event.key === 'Escape') back(); } });
  const back = () => { renderLog(); $('add-exercise').focus(); };
  const renderResults = () => {
    const exercises = exerciseCatalog().filter((exercise) => exercise.name.toLowerCase().includes(search.value.trim().toLowerCase()))
      .sort((first, second) => first.name.localeCompare(second.name));
    list.replaceChildren(...exercises.map((exercise) => h('li', { class: 'exercise-catalog-row' },
      h('button', { type: 'button', class: 'exercise-pick', 'aria-label': exercise.name,
        'aria-description': `${STATS[exercise.type]} exercise`, onclick: () => add(exercise) },
        exerciseTypeIcon(exercise.type), h('span', { class: 'exercise-pick-name', text: exercise.name })),
      h('button', { type: 'button', class: 'icon-btn exercise-info', 'aria-label': `Information about ${exercise.name}`, title: `About ${exercise.name}`,
        onclick: (event) => showExerciseInfo(exercise.name, event.currentTarget) }, 'ⓘ'))));
    empty.hidden = exercises.length > 0;
  };
  const empty = h('p', { role: 'status', hidden: true, text: 'No exercises found.' });
  panel.replaceChildren(h('div', { class: 'exercise-picker-head' },
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Back to workout', title: 'Back to workout', onclick: back }, '\u2190'),
    h('h2', { text: 'Add exercise' })),
    h('div', { class: 'exercise-search-row' }, search,
      h('button', { type: 'button', class: 'btn small exercise-create', 'aria-label': 'Create exercise', onclick: renderCustomExerciseForm },
        svgEl('svg', { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', stroke: 'currentColor', 'stroke-width': 2,
          'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' },
          svgEl('path', { d: 'M12 5v14M5 12h14' })),
        h('span', { text: 'Create' }))), list, empty);
  renderResults();
  document.querySelector('main').scrollTop = 0;
  search.focus();
}

function questLine(path) {
  const q = quests[path];
  const quest = q && questById(q.id);
  if (!quest) return null;
  const stage = stagesOf(quest)[q.stage];
  const size = sizeOf(stage, path);
  const text = path === 'agility' ? `${fmtNum(size - q.left)}/${fmtNum(size)} km` : `HP ${fmtNum(q.left)}/${fmtNum(size)}`;
  return h('div', { class: 'banner' }, h('span', { text: stage.name }), h('span', { text }));
}

function renderLog() {
  setWorkoutFocus(false);
  const panel = panelEl('log');
  const exercises = draft.exercises.filter((exercise) => exercise.name.trim() || exercise.km || exercise.minutes || exercise.sets.some((set) => set.reps !== '' || set.kg !== ''));
  if (exercises.length !== draft.exercises.length) { draft.exercises = exercises; persistDraft(); }
  if (syncWorkoutTimer()) persistDraft();
  renderWorkoutTimer();
  panel.replaceChildren();
  panel.append(programLoggingHeader());
  panel.append(h('div', { class: 'meta' },
    h('label', { class: 'field' }, 'Date',
      h('input', { type: 'date', value: draft.date, oninput: (e) => { draft.date = e.target.value; persistDraft(); } })),
    h('label', { class: 'field' }, 'Workout name (optional)',
      h('input', { type: 'text', value: draft.name, placeholder: 'Push day', oninput: (e) => { draft.name = e.target.value; persistDraft(); } }))
  ));
  panel.append(...[questLine('strength'), questLine('agility')].filter(Boolean)); // append(null) would print "null"
  draft.exercises.forEach((ex, i) => panel.append(exerciseCard(ex, i)));
  panel.append(h('button', { id: 'add-exercise', type: 'button', class: 'btn primary exercise-add', onclick: () => renderExercisePicker() },
    svgEl('svg', { viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none', stroke: 'currentColor', 'stroke-width': 2,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' },
      svgEl('path', { d: 'M12 5v14M5 12h14' })),
    h('span', { text: 'Add exercise' })));
  panel.append(h('div', { id: 'workout-summary', class: 'workout-summary', role: 'region', 'aria-label': 'Workout summary' }));
  renderWorkoutSummary();
}

function exerciseCard(ex, i) {
  ex.type = ex.type || 'strength';
  const body = h('div', { class: 'ex-body' });

  const strengthBody = () => {
    const grid = h('div', { class: 'sets' },
      h('span', { class: 'col' }, 'Set'), h('span', { class: 'col' }, 'Reps'), h('span', { class: 'col' }, 'kg'), h('span'));
    ex.sets.forEach((s, j) => {
      grid.append(
        h('span', { class: 'n', text: j + 1 }),
        numInput(s.reps, { step: 1, placeholder: '0', 'aria-label': `Set ${j + 1} reps` }, (v) => { s.reps = v; persistDraft(); }),
        numInput(s.kg, { step: 0.5, placeholder: '0', 'aria-label': `Set ${j + 1} kg` }, (v) => { s.kg = v; persistDraft(); }),
        h('button', { class: 'icon-btn', 'aria-label': `Remove set ${j + 1}`, onclick: () => {
          ex.sets.splice(j, 1);
          if (!ex.sets.length) ex.sets.push(newSet());
          persistDraft(); renderBody();
        } }, '×')
      );
    });
    return [grid, h('button', { type: 'button', class: 'exercise-add-set', onclick: () => { ex.sets.push(newSet(ex.sets[ex.sets.length - 1])); persistDraft(); renderBody(); } },
      svgEl('svg', { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', stroke: 'currentColor', 'stroke-width': 2,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' },
        svgEl('path', { d: 'M12 5v14M5 12h14' })),
      h('span', { text: 'Add set' }))];
  };
  const agilityBody = () => [h('div', { class: 'agi-grid' },
    h('label', { class: 'field' }, 'Distance (km)', numInput(ex.km ?? '', { step: 0.1, placeholder: '5', 'aria-label': 'Distance in km' }, (v) => { ex.km = v; persistDraft(); })),
    h('label', { class: 'field' }, 'Minutes (optional)', numInput(ex.minutes ?? '', { step: 1, placeholder: '30', 'aria-label': 'Minutes' }, (v) => { ex.minutes = v; persistDraft(); })))];
  const renderBody = () => {
    body.replaceChildren(...(ex.skipped ? [h('p', { class: 'stat-note', text: 'Skipped for this session' })] : ex.type === 'agility' ? agilityBody() : strengthBody()));
    renderWorkoutSummary();
  };

  renderBody();
  return h('div', { class: 'card' },
    h('div', { class: 'card-head' },
      h('h3', { class: 'exercise-title', text: ex.name }),
      h('button', { type: 'button', class: 'icon-btn exercise-info', 'aria-label': `Information about ${ex.name}`, title: `About ${ex.name}`,
        onclick: (event) => showExerciseInfo(ex.name, event.currentTarget, ex.type) }, '\u24d8'),
      !ex.programItemId ? h('button', { class: 'icon-btn', 'aria-label': 'Remove exercise', onclick: () => { draft.exercises.splice(i, 1); persistDraft(); renderLog(); } }, '×') : null
    ),
    programExerciseDetails(ex),
    body
  );
}

