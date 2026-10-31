// History tab.
// Classic script: shares globals with the other files in js/ (load order is in popup.html).

/* ================= History tab ================= */
const volume = (w) => w.exercises.reduce((t, e) => t + e.sets.reduce((a, s) => a + s.reps * s.kg, 0), 0);
const kmOf = (w) => round2(w.exercises.reduce((t, e) => t + (e.km || 0), 0));
const minutesOf = (w) => w.exercises.reduce((t, e) => t + (e.minutes || 0), 0);
const fmt = (n) => Number(n.toFixed(1)).toLocaleString();
const prettyDate = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

function renderHistory() {
  const panel = panelEl('history');
  panel.replaceChildren();
  if (!workouts.length) {
    panel.append(h('div', { class: 'empty', text: 'No workouts yet. Switch to Log to record your first one.' }));
    return;
  }
  workouts.forEach((w) => {
    const sets = w.exercises.reduce((t, e) => t + e.sets.length, 0);
    const km = kmOf(w), mins = minutesOf(w);
    const del = h('button', { class: 'btn small danger', onclick: () => {
      if (!del.classList.contains('armed')) { del.classList.add('armed'); del.textContent = 'Confirm delete'; return; }
      workouts = workouts.filter((x) => x.id !== w.id);
      persistWorkouts(); renderHistory(); toast('Workout deleted');
    } }, 'Delete');

    panel.append(h('details', { class: 'workout' },
      h('summary', {},
        h('span', { class: 'w-date', text: (w.name ? w.name + ', ' : '') + prettyDate(w.date) }),
        h('span', { class: 'w-sub' },
          h('span', { text: `${w.exercises.length} exercise${w.exercises.length === 1 ? '' : 's'}` }),
          sets ? h('span', { text: `${sets} sets` }) : null,
          km ? h('span', { text: `${fmtNum(km)} km` }) : null,
          !km && mins ? h('span', { text: `${fmt(mins)} min` }) : null,
          volume(w) ? h('span', { text: `${fmt(volume(w))} kg total` }) : null,
          w.character ? h('span', { text: w.character }) : null,
          w.program ? h('span', { text: `${w.program.programName}: ${w.program.practice ? 'Practice' : w.program.finished ? 'Session finished' : 'Partial session'}` }) : null)
      ),
      h('div', { class: 'w-body' },
        w.exercises.map((e) => h('div', { class: 'w-ex' },
          h('h3', {}, e.name, h('span', { class: 'w-type', text: STATS[e.type] || STATS.strength })),
          e.km || e.minutes
            ? h('div', { class: 'w-set' }, h('span', { text: e.km ? 'Distance' : 'Duration' }),
                h('span', {}, e.km ? [h('b', { text: fmtNum(e.km) }), ' km'] : null, e.km && e.minutes ? ', ' : null, e.minutes ? [h('b', { text: e.minutes }), ' min'] : null))
            : e.sets.map((s, j) => h('div', { class: 'w-set' },
                h('span', { text: `Set ${j + 1}` }),
                h('span', {}, h('b', { text: s.reps }), ' reps at ', h('b', { text: s.kg }), ' kg'))))),
        h('div', { class: 'w-actions' },
          h('button', { class: 'btn small', onclick: () => repeatWorkout(w) }, 'Repeat workout'),
          del)
      )
    ));
  });
}

function repeatWorkout(w) {
  draft = {
    date: today(),
    name: w.name,
    exercises: w.exercises.map((e) => ({
      name: e.name, type: e.type || 'strength', km: e.km ?? '', minutes: e.minutes ?? '',
      sets: e.sets.length ? e.sets.map((s) => ({ reps: s.reps, kg: s.kg })) : [newSet()]
    }))
  };
  persistDraft(); showTab('log');
  toast('Copied into a new workout');
}
