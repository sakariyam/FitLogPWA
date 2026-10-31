let programViewId = null;
let programEditor = null;

async function saveProgramData(next) {
  try {
    if (!await appStorage.set({ programData: next })) throw new Error('Program save failed');
    programData = next;
    return true;
  } catch (error) {
    console.error('Programs could not be saved', error);
    toast('Programs could not be saved. Try again.');
    return false;
  }
}

function programDialog(title, content, choices) {
  const modal = $('modal');
  const previous = document.activeElement;
  const close = () => { modal.hidden = true; modal.replaceChildren(); if (previous?.isConnected) previous.focus(); };
  const buttons = choices.map((choice) => h('button', { type: 'button', class: `btn${choice.primary ? ' primary' : ''}`, onclick: () => { close(); choice.action?.(); } }, choice.label));
  buttons.push(h('button', { type: 'button', class: 'btn', onclick: close }, 'Cancel'));
  modal.replaceChildren(h('div', { class: 'dialog program-decision-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': title,
    onkeydown: (event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
      if (event.key === 'Tab') {
        event.preventDefault();
        const index = buttons.indexOf(document.activeElement);
        buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
      }
    }
  }, h('h2', { text: title }), content, buttons));
  modal.hidden = false;
  buttons[0].focus();
}

function openPrograms(id = null) { programViewId = id; showTab('programs'); }

async function followProgram(definition) {
  const apply = async () => {
    const next = structuredClone(programData);
    let run = [...next.runs].reverse().find((entry) => entry.program.id === definition.id && !entry.finishedAt);
    if (!run) { run = newProgramRun(definition); next.runs.push(run); }
    next.activeRunId = run.id;
    if (await saveProgramData(next)) { programViewId = definition.id; renderPrograms(); }
  };
  const active = programRun();
  if (active && !active.finishedAt && active.program.id !== definition.id) {
    programDialog('Switch program?', h('p', { text: `${active.program.name} will be paused. Its progress and your current workout will be kept.` }),
      [{ label: 'Switch program', primary: true, action: apply }]);
  } else await apply();
}

function startProgramSession(run, sessionIndex = run.completions.length % run.program.sessions.length, practice = false) {
  if (!practice && (run.finishedAt || programData.activeRunId !== run.id)) return toast('Follow this program before starting its next session.');
  const current = draft.program;
  if (current && current.runId === run.id && current.sessionIndex === sessionIndex && current.practice === practice
    && (practice || current.occurrence === run.completions.length)) { showTab('log'); return; }
  const start = () => { draft = programSessionDraft(run, sessionIndex, practice); persistDraft(); showTab('log'); };
  if (hasDraftContent(draft) || draft.name.trim()) {
    programDialog('A workout is already in progress', h('p', { text: 'Resume your current workout or replace its draft with this planned session. Saved workouts are not changed.' }),
      [{ label: 'Resume current workout', primary: true, action: () => showTab('log') }, { label: 'Replace draft', action: start }]);
  } else start();
}

function programDraftExercises() {
  return draft.exercises.filter((exercise) => !exercise.skipped).map((exercise) => ({
    ...exercise, km: Number(exercise.km) || 0,
    sets: exercise.sets.filter((set) => Number(set.reps) > 0).map((set) => ({ reps: Number(set.reps), kg: Number(set.kg) || 0 }))
  }));
}

function refreshProgramProgress() {
  const display = $('program-session-progress');
  if (!display || !draft.program) return;
  const progress = programSessionProgress(programDraftExercises());
  const done = progress.filter((entry) => entry.done).length;
  const skipped = progress.filter((entry) => entry.skipped).length;
  display.textContent = `${done} / ${progress.length} exercises logged${skipped ? ` / ${skipped} skipped` : ''}`;
  progress.forEach((entry) => {
    const status = $(`program-item-${entry.exercise.programItemId}`);
    if (status) status.textContent = entry.skipped ? 'Skipped' : `${fmtNum(entry.amount)} / ${fmtNum(entry.goal)} ${entry.exercise.type === 'agility' ? 'km' : 'sets'} logged`;
  });
}

function programLoggingHeader() {
  const context = draft.program;
  if (!context) return h('div', { class: 'program-log-actions' },
    draft.exercises.some((exercise) => exercise.name.trim()) ? h('button', { type: 'button', class: 'home-text-link', onclick: () => editProgram(null, true) }, 'Save as program') : null);
  const run = programRun(context.runId);
  const advancing = run && !run.finishedAt && !context.practice && programData.activeRunId === run.id && context.occurrence === run.completions.length;
  const progress = h('p', { id: 'program-session-progress', class: 'stat-note' });
  const header = h('section', { class: 'program-log-header', 'aria-label': 'Planned session' },
    h('h2', { text: context.programName }), h('p', { text: `${context.session.name}${advancing ? ` / Cycle ${programCycle(run)}` : ' / Practice (no campaign advance)'}` }), progress,
    h('label', { class: 'field' }, 'After saving', h('select', { class: 'select', 'aria-label': 'Program session save action',
      onchange: (event) => { draft.programSaveMode = event.target.value; persistDraft(); } },
      h('option', { value: 'finish', selected: draft.programSaveMode !== 'partial' }, advancing ? 'Finish session and move on' : 'Finish practice'),
      h('option', { value: 'partial', selected: draft.programSaveMode === 'partial' }, 'Save partial and continue later'))),
    h('div', { class: 'program-log-actions' },
      h('button', { type: 'button', class: 'home-text-link', onclick: () => openPrograms(context.programId) }, 'View program'),
      h('button', { type: 'button', class: 'home-text-link', onclick: () => programDialog('Log as a free workout?',
        h('p', { text: 'Entered results and saved workouts will be kept. This draft will no longer advance the program.' }),
        [{ label: 'Use free workout', primary: true, action: () => {
          delete draft.program; delete draft.programSaveMode;
          draft.exercises = draft.exercises.filter((exercise) => !exercise.skipped).map((exercise) => {
            const { programItemId, target, skipped, substitutedFrom, ...entry } = exercise;
            return entry;
          });
          persistDraft(); renderLog();
        } }]) }, 'Free workout')));
  return header;
}

function programExerciseDetails(exercise) {
  if (!exercise.target) return null;
  const previous = previousExerciseResult(exercise.name, draft.date || today());
  let last = 'No previous results';
  if (previous) {
    const entry = previous.exercise;
    last = entry.type === 'agility' ? `Last: ${fmtNum(entry.km || 0)} km${entry.minutes ? ` / ${entry.minutes} min` : ''}`
      : `Last: ${entry.sets.map((set) => `${set.reps} x ${fmtNum(set.kg)} kg`).join(', ')}`;
  }
  return h('div', { class: 'program-exercise-plan' },
    h('p', { class: 'program-target', text: `Target: ${programTargetText(exercise)}` }),
    h('p', { class: 'stat-note', text: last }),
    h('p', { class: 'stat-note', id: `program-item-${exercise.programItemId}` }),
    exercise.substitutedFrom ? h('p', { class: 'stat-note', text: `Instead of ${exercise.substitutedFrom}` }) : null,
    h('div', { class: 'program-exercise-actions' },
      h('button', { type: 'button', class: 'home-text-link', onclick: () => {
        renderExercisePicker('', (definition) => {
          if (definition.type !== exercise.type) {
            exercise.target = definition.type === 'agility' ? { km: 1, minutes: 0 } : { sets: 3, repsMin: 5, repsMax: 8 };
            exercise.sets = definition.type === 'strength' ? Array.from({ length: 3 }, () => newSet()) : [];
            exercise.km = ''; exercise.minutes = '';
          }
          exercise.substitutedFrom = exercise.substitutedFrom || exercise.name;
          exercise.name = definition.name; exercise.type = definition.type;
          persistDraft(); renderLog();
        });
      } }, 'Swap exercise'),
      h('label', { class: 'custom-choice' }, h('input', { type: 'checkbox', checked: exercise.skipped, 'aria-label': `Skip ${exercise.name}`,
        onchange: (event) => { exercise.skipped = event.target.checked; persistDraft(); renderLog(); } }), 'Skip')));
}

function programCampaign(run = programRun(), showActions = true) {
  if (!run) return h('section', { class: 'program-campaign', 'aria-label': 'Program campaign' },
    h('h2', { text: 'Training programs' }),
    h('button', { type: 'button', class: 'btn', onclick: () => openPrograms() }, 'Choose a program'));
  const total = programGoal(run);
  const count = run.completions.length;
  const cycleIndex = run.finishedAt ? Math.max(0, Math.ceil(count / run.program.sessions.length) - 1) : Math.floor(count / run.program.sessions.length);
  const start = isoOf(mondayOf(new Date()));
  const thisWeek = run.completions.filter((entry) => entry.date >= start && entry.date < isoOf(new Date(parseIso(start).getFullYear(), parseIso(start).getMonth(), parseIso(start).getDate() + 7))).length;
  return h('section', { class: 'program-campaign', 'aria-label': 'Program campaign' },
    h('div', { class: 'home-section-heading' }, h('h2', { text: showActions ? run.program.name : 'Campaign progress' }),
      showActions ? h('button', { type: 'button', class: 'home-text-link', onclick: () => openPrograms(run.program.id) }, 'Program details') : null),
    h('p', { class: 'stat-note', text: `${count}${total ? ` / ${total}` : ''} sessions completed / ${Math.floor(count / run.program.sessions.length)} cycles finished` }),
    h('p', { class: 'stat-note', text: `${thisWeek} / ${run.program.weeklyTarget} suggested sessions this week` }),
    h('ol', { class: 'program-path', 'aria-label': `Cycle ${cycleIndex + 1}` }, run.program.sessions.map((session, index) => {
      const position = cycleIndex * run.program.sessions.length + index;
      const done = count > position;
      const current = count === position && !run.finishedAt;
      return h('li', {}, h('button', { type: 'button', class: `program-node${done ? ' done' : ''}${current ? ' current' : ''}`,
        title: `${session.name}: ${done ? 'Completed; practice again' : current ? 'Next session' : 'Practice session'}`,
        onclick: () => startProgramSession(run, index, !current) },
        h('span', { class: 'program-node-number', 'aria-hidden': 'true', text: done ? '\u2713' : index + 1 }),
        h('span', { text: session.name }), h('span', { class: 'stat-note', text: done ? 'Completed' : current ? 'Next' : 'Practice' })));
    })),
    h('div', { class: 'program-badges', 'aria-label': 'Program milestones' }, PROGRAM_MILESTONES.filter((milestone) => milestone.earned(run)).map((milestone) =>
      h('span', { class: 'program-badge', text: milestone.label }))),
    showActions && !run.finishedAt && programData.activeRunId === run.id ? h('button', { type: 'button', class: 'btn primary', onclick: () => startProgramSession(run) }, `Start ${nextProgramSession(run).name}`) : null);
}

function renderPrograms() {
  setWorkoutFocus(false);
  const panel = panelEl('programs');
  const definition = programLibrary().find((entry) => entry.id === programViewId);
  if (definition) { renderProgramDetails(panel, definition); return; }
  panel.replaceChildren(h('div', { class: 'program-library-heading' }, h('h2', { text: 'Programs' }),
    h('button', { type: 'button', class: 'btn small', onclick: () => editProgram() }, '+ Create')),
    ...programLibrary().map((entry) => {
      const run = programRun();
      return h('button', { type: 'button', class: 'home-destination program-library-row', onclick: () => { programViewId = entry.id; renderPrograms(); } },
        h('span', { class: 'home-destination-copy' }, h('strong', { text: entry.name }),
          h('span', { class: 'home-detail', text: `${entry.sessions.length} session${entry.sessions.length === 1 ? '' : 's'} / ${entry.weeklyTarget} per week / ${entry.cycles ? `${entry.cycles} cycles` : 'Repeatable'}` }),
          run?.program.id === entry.id ? h('span', { class: 'home-detail', text: run.finishedAt ? 'Completed' : 'Following' }) : null),
        h('span', { class: 'home-link-arrow', 'aria-hidden': 'true' }, '\u203a'));
    }));
}

function renderProgramDetails(panel, definition) {
  const active = programRun();
  const run = active?.program.id === definition.id ? active : [...programData.runs].reverse().find((entry) => entry.program.id === definition.id);
  const following = active && run?.id === active.id && !run.finishedAt;
  const plan = run && !run.finishedAt ? run.program : definition;
  panel.replaceChildren(h('div', { class: 'program-details' },
    h('button', { type: 'button', class: 'home-text-link', onclick: () => { programViewId = null; renderPrograms(); } }, '\u2190 All programs'),
    h('h2', { class: 'program-title', text: definition.name }),
    h('p', { class: 'stat-note', text: `${definition.weeklyTarget} suggested sessions per week / ${definition.cycles ? `${definition.cycles} cycles` : 'Repeatable'}` }),
    h('button', { type: 'button', class: 'btn primary', onclick: () => following ? startProgramSession(run) : followProgram(definition) },
      following ? `Start ${nextProgramSession(run).name}` : run && !run.finishedAt ? 'Resume program' : 'Follow program'),
    ...plan.sessions.map((session) => h('section', { class: 'program-session-template' }, h('h3', { text: session.name }),
      h('ul', { class: 'program-target-list' }, session.exercises.map((exercise) => h('li', {}, h('span', { text: exercise.name }), h('span', { text: programTargetText(exercise) })))),
      run?.program.sessions.some((saved) => saved.id === session.id) ? h('button', { type: 'button', class: 'home-text-link',
        onclick: () => startProgramSession(run, run.program.sessions.findIndex((saved) => saved.id === session.id), true) }, 'Practice session') : null)),
    h('div', { class: 'program-manage-actions' },
      programData.custom.some((entry) => entry.id === definition.id) ? h('button', { type: 'button', class: 'btn', onclick: () => editProgram(definition) }, 'Edit template')
        : h('button', { type: 'button', class: 'btn', onclick: () => editProgram({ ...structuredClone(definition), id: crypto.randomUUID(), name: `${definition.name} copy` }) }, 'Customize a copy'),
      following ? h('button', { type: 'button', class: 'btn', onclick: async () => {
        const next = structuredClone(programData); next.activeRunId = null;
        if (await saveProgramData(next)) renderPrograms();
      } }, 'Pause program') : null,
      run ? h('button', { type: 'button', class: 'btn', onclick: () => programDialog('Start a new campaign?',
        h('p', { text: 'Previous campaign progress and saved workouts will be kept. The new campaign starts with the latest saved template.' }),
        [{ label: 'Start new campaign', primary: true, action: async () => {
          const next = structuredClone(programData); const fresh = newProgramRun(definition);
          next.runs.push(fresh); next.activeRunId = fresh.id;
          if (await saveProgramData(next)) renderPrograms();
        } }]) }, 'Start new campaign') : null),
    following ? h('label', { class: 'field program-schedule' }, 'Suggested next session', h('input', { type: 'date', value: run.nextDate || '', 'aria-label': 'Suggested next session date',
      onchange: async (event) => {
        const next = structuredClone(programData); next.runs.find((entry) => entry.id === run.id).nextDate = event.target.value || null;
        if (!await saveProgramData(next)) event.target.value = run.nextDate || '';
      } })) : null,
    run ? programCampaign(run, false) : null,
    run?.completions.length ? h('section', { class: 'home-section' }, h('h3', { text: 'Session history' }),
      ...[...run.completions].reverse().slice(0, 12).map((entry) => h('div', { class: 'program-history-row' },
        h('span', { text: run.program.sessions[entry.sessionIndex].name }), h('span', { text: prettyDate(entry.date) })))) : null,
    h('section', { class: 'home-section' }, h('h3', { text: 'Exercise progress' }),
      [...new Set(plan.sessions.flatMap((session) => session.exercises.map((exercise) => exercise.name)))].map((name) =>
        h('button', { type: 'button', class: 'home-destination', disabled: !previousExerciseResult(name),
          title: previousExerciseResult(name) ? `Progress for ${name}` : 'No results logged yet',
          onclick: () => { statsView = 'exercise'; statsExercise = name; statsExMetric = null; showTab('stats'); } }, name)))));
}

function editProgram(definition = null, fromDraft = false) {
  programEditor = definition ? structuredClone(definition) : {
    id: crypto.randomUUID(), name: fromDraft ? draft.name.trim() || 'My workout program' : '', weeklyTarget: 2, cycles: 4,
    sessions: [{ id: crypto.randomUUID(), name: 'Session A', exercises: fromDraft ? draft.exercises.filter((exercise) => exercise.name.trim()).map((exercise) => ({
      id: crypto.randomUUID(), name: exercise.name, type: exercise.type,
      target: exercise.target ? structuredClone(exercise.target) : exercise.type === 'agility' ? { km: Number(exercise.km) || 1, minutes: Number(exercise.minutes) || 0 }
        : { sets: Math.max(1, exercise.sets.length), repsMin: 5, repsMax: 8 }
    })) : [] }]
  };
  if (activePage !== 'programs') showTab('programs');
  renderProgramEditor();
}

function renderProgramEditor() {
  setWorkoutFocus(true, 'Program builder');
  const panel = panelEl('programs');
  const error = h('p', { role: 'alert', class: 'error' });
  const number = (label, value, minimum, maximum, update, step = 1, accessibleLabel = label) => h('label', { class: 'field' }, label,
    h('input', { type: 'number', min: minimum, max: maximum, step, required: true, value, 'aria-label': accessibleLabel,
      oninput: (event) => update(Number(event.target.value)) }));
  const save = h('button', { type: 'submit', class: 'btn primary' }, 'Save program');
  const form = h('form', { class: 'program-editor', onsubmit: async (event) => {
    event.preventDefault();
    if (save.disabled) return;
    error.textContent = validateProgram(programEditor);
    if (error.textContent) { error.scrollIntoView({ block: 'nearest' }); return; }
    if (programLibrary().some((entry) => entry.id !== programEditor.id && entry.name.toLowerCase() === programEditor.name.trim().toLowerCase())) {
      error.textContent = 'A program with this name already exists.'; return;
    }
    const next = structuredClone(programData);
    const definition = structuredClone(programEditor); definition.name = definition.name.trim();
    next.custom = next.custom.filter((entry) => entry.id !== definition.id); next.custom.push(definition);
    save.disabled = true;
    try { if (await saveProgramData(next)) { programViewId = definition.id; programEditor = null; showTab('programs'); } }
    finally { save.disabled = false; }
  } },
  h('label', { class: 'field' }, 'Program name', h('input', { type: 'text', maxlength: 60, required: true, value: programEditor.name, 'aria-label': 'Program name',
    oninput: (event) => { programEditor.name = event.target.value; } })),
  h('div', { class: 'program-editor-settings' },
    number('Sessions per week', programEditor.weeklyTarget, 1, 7, (value) => { programEditor.weeklyTarget = value; }),
    number('Cycles (0 = repeatable)', programEditor.cycles, 0, 52, (value) => { programEditor.cycles = value; })),
  ...programEditor.sessions.map((session, sessionIndex) => h('fieldset', { class: 'program-editor-session' }, h('legend', { text: `Session ${sessionIndex + 1}` }),
    h('label', { class: 'field' }, 'Session name', h('input', { type: 'text', required: true, maxlength: 40, value: session.name, 'aria-label': `Session ${sessionIndex + 1} name`,
      oninput: (event) => { session.name = event.target.value; } })),
    ...session.exercises.map((exercise, exerciseIndex) => {
      const prefix = `Session ${sessionIndex + 1}, exercise ${exerciseIndex + 1}`;
      return h('div', { class: 'program-editor-exercise' },
        h('label', { class: 'field' }, 'Exercise', h('select', { class: 'select', 'aria-label': `${prefix} name`, onchange: (event) => {
          const definition = exerciseDefinition(event.target.value);
          exercise.name = definition.name; exercise.type = definition.type;
          exercise.target = definition.type === 'agility' ? { km: 1, minutes: 0 } : { sets: 3, repsMin: 5, repsMax: 8 };
          renderProgramEditor();
        } }, exerciseCatalog().map((definition) => h('option', { value: definition.name, selected: definition.name === exercise.name }, definition.name)))),
        h('div', { class: 'program-target-fields' }, exercise.type === 'agility' ? [
          number('km', exercise.target.km, 0.1, 1000, (value) => { exercise.target.km = value; }, 0.1, `${prefix} km`),
          number('Minutes', exercise.target.minutes, 0, 10000, (value) => { exercise.target.minutes = value; }, 1, `${prefix} minutes`)
        ] : [
          number('Sets', exercise.target.sets, 1, 20, (value) => { exercise.target.sets = value; }, 1, `${prefix} sets`),
          number('Min reps', exercise.target.repsMin, 1, 100, (value) => { exercise.target.repsMin = value; }, 1, `${prefix} minimum reps`),
          number('Max reps', exercise.target.repsMax, 1, 100, (value) => { exercise.target.repsMax = value; }, 1, `${prefix} maximum reps`)
        ]),
        h('button', { type: 'button', class: 'home-text-link', onclick: () => { session.exercises.splice(exerciseIndex, 1); renderProgramEditor(); } }, 'Remove exercise'));
    }),
    h('button', { type: 'button', class: 'btn', onclick: () => {
      const definition = exerciseCatalog()[0];
      session.exercises.push({ id: crypto.randomUUID(), name: definition.name, type: definition.type, target: { sets: 3, repsMin: 5, repsMax: 8 } });
      renderProgramEditor();
    } }, 'Add exercise'),
    programEditor.sessions.length > 1 ? h('button', { type: 'button', class: 'home-text-link', onclick: () => { programEditor.sessions.splice(sessionIndex, 1); renderProgramEditor(); } }, 'Remove session') : null)),
  h('button', { type: 'button', class: 'btn', onclick: () => { programEditor.sessions.push({ id: crypto.randomUUID(), name: `Session ${programEditor.sessions.length + 1}`, exercises: [] }); renderProgramEditor(); } }, 'Add session'),
  error, save);
  panel.replaceChildren(h('div', { class: 'exercise-picker-head' },
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Back to programs', title: 'Back to programs', onclick: () => showTab('programs') }, '\u2190'),
    h('h2', { text: 'Create or edit program' })), form);
}