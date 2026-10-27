// Log tab: logging a workout.
// Classic script: shares globals with the other files in js/ (load order is in popup.html).

/* ================= Log tab ================= */
function numInput(value, props, onChange) {
  return h('input', { type: 'number', min: 0, inputmode: 'decimal', value, ...props, oninput: (e) => onChange(e.target.value) });
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
  const panel = panelEl('log');
  panel.replaceChildren();
  panel.append(h('div', { class: 'meta' },
    h('label', { class: 'field' }, 'Date',
      h('input', { type: 'date', value: draft.date, oninput: (e) => { draft.date = e.target.value; persistDraft(); } })),
    h('label', { class: 'field' }, 'Workout name (optional)',
      h('input', { type: 'text', value: draft.name, placeholder: 'Push day', oninput: (e) => { draft.name = e.target.value; persistDraft(); } }))
  ));
  panel.append(...[questLine('strength'), questLine('agility')].filter(Boolean)); // append(null) would print "null"
  draft.exercises.forEach((ex, i) => panel.append(exerciseCard(ex, i)));
  panel.append(
    h('button', { class: 'btn', onclick: () => { draft.exercises.push(newExercise()); persistDraft(); renderLog(); } }, 'Add exercise'),
    h('button', { class: 'btn primary', onclick: saveWorkout }, 'Save workout')
  );
}

function exerciseCard(ex, i) {
  ex.type = ex.type || 'strength';
  const keys = Object.keys(STATS);
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
    return [grid, h('button', { class: 'link-btn', onclick: () => { ex.sets.push(newSet(ex.sets[ex.sets.length - 1])); persistDraft(); renderBody(); } }, 'Add set')];
  };
  const agilityBody = () => [h('div', { class: 'agi-grid' },
    h('label', { class: 'field' }, 'Distance (km)', numInput(ex.km ?? '', { step: 0.1, placeholder: '5', 'aria-label': 'Distance in km' }, (v) => { ex.km = v; persistDraft(); })),
    h('label', { class: 'field' }, 'Minutes (optional)', numInput(ex.minutes ?? '', { step: 1, placeholder: '30', 'aria-label': 'Minutes' }, (v) => { ex.minutes = v; persistDraft(); })))];
  const renderBody = () => body.replaceChildren(...(ex.type === 'agility' ? agilityBody() : strengthBody()));

  const segBtns = keys.map((k) => h('button', { type: 'button', class: 'seg-btn', 'aria-pressed': String(ex.type === k),
    onclick: () => { ex.type = k; ex.typeSet = true; persistDraft(); paint(); } }, STATS[k]));
  const paint = () => { segBtns.forEach((b, n) => b.setAttribute('aria-pressed', String(keys[n] === ex.type))); renderBody(); };

  renderBody();
  return h('div', { class: 'card' },
    h('div', { class: 'card-head' },
      h('input', { type: 'text', list: 'exercise-list', value: ex.name, placeholder: 'Exercise name', 'aria-label': 'Exercise name',
        oninput: (e) => {
          ex.name = e.target.value;
          if (!ex.typeSet) { const t = guessType(ex.name); if (t !== ex.type) { ex.type = t; paint(); } }
          persistDraft();
        } }),
      h('button', { class: 'icon-btn', 'aria-label': 'Remove exercise', onclick: () => { draft.exercises.splice(i, 1); persistDraft(); renderLog(); } }, '×')
    ),
    h('div', { class: 'type-row' }, h('span', { class: 'col', text: 'Trains' }), h('div', { class: 'seg', role: 'group', 'aria-label': 'Stat trained' }, segBtns)),
    body
  );
}

function refreshExerciseList() {
  const names = new Set(COMMON);
  workouts.forEach((w) => w.exercises.forEach((e) => names.add(e.name)));
  $('exercise-list').replaceChildren(...[...names].sort().map((n) => h('option', { value: n })));
}
