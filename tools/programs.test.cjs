const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

function model(extra = []) {
  const context = vm.createContext({ structuredClone, crypto: webcrypto, console });
  for (const file of ['config.js', 'state.js', 'programs.js', ...extra]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context);
  }
  return (source) => vm.runInContext(source, context);
}

test('presets validate and planned inputs never become logged work', () => {
  const run = model();
  assert.equal(run('validateProgram(PROGRAM_PRESETS[0])'), '');
  assert.equal(run(`const campaign = newProgramRun(PROGRAM_PRESETS[0]);
    draft = programSessionDraft(campaign);
    draft.exercises.every(exercise => exercise.sets.length === exercise.target.sets && exercise.sets.every(set => set.reps === '' && set.kg === ''))`), true);
  assert.equal(run('draft.program.session.exercises[0].target.sets'), 3);
  run('draft.exercises[0].target.sets = 9');
  assert.equal(run('campaign.program.sessions[0].exercises[0].target.sets'), 3);
});

test('partial sessions accumulate actual sets once and clear already logged inputs', () => {
  const run = model();
  const result = run(`const campaign = newProgramRun(PROGRAM_PRESETS[0]);
    draft = programSessionDraft(campaign);
    const logged = [{name:'Squat', type:'strength', programItemId:'a-squat', sets:[{reps:5,kg:20}]}];
    const remaining = remainingProgramDraft(draft, logged);
    workouts.push({id:1,date:today(),program:structuredClone(draft.program),exercises:logged});
    draft = remaining;
    const progress = programItemProgress(draft.exercises[0],draft.program,[]);
    JSON.stringify({sets:draft.exercises[0].sets.length,amount:progress.amount,paused:draft.timerPaused,blank:draft.exercises[0].sets.every(set=>set.reps==='')})`);
  assert.deepEqual(JSON.parse(result), { sets: 2, amount: 1, paused: true, blank: true });
});

test('completion is idempotent and practice or stale sessions cannot advance', () => {
  const run = model();
  run(`const campaign=newProgramRun(PROGRAM_PRESETS[0]);programData.runs.push(campaign);programData.activeRunId=campaign.id;draft=programSessionDraft(campaign);`);
  assert.equal(run('completeProgramSession(draft.program,1).length'), 2);
  assert.equal(run('completeProgramSession(draft.program,1).length'), 0);
  assert.equal(run('campaign.completions.length'), 1);
  run('draft=programSessionDraft(campaign,1,true)');
  assert.equal(run('completeProgramSession(draft.program,2).length'), 0);
  run('draft=programSessionDraft(campaign);programData.activeRunId=null');
  assert.equal(run('completeProgramSession(draft.program,3).length'), 0);
});

test('cycle and campaign milestones are earned only once per run', () => {
  const run = model();
  run(`const definition=structuredClone(PROGRAM_PRESETS[0]);definition.cycles=1;
    const campaign=newProgramRun(definition);programData.runs.push(campaign);programData.activeRunId=campaign.id;
    draft=programSessionDraft(campaign);completeProgramSession(draft.program,1);draft=programSessionDraft(campaign);`);
  const lines = JSON.parse(run('JSON.stringify(completeProgramSession(draft.program,2))'));
  assert.ok(lines.includes('Milestone: First cycle'));
  assert.ok(lines.includes('Milestone: Campaign complete'));
  assert.equal(run('campaign.completions.length'), 2);
  assert.equal(run('completeProgramSession(draft.program,2).length'), 0);
  assert.equal(run('!!campaign.finishedAt'), true);
});

test('invalid targets are rejected and older sessions keep their program snapshot', () => {
  const run = model();
  run('const definition=structuredClone(PROGRAM_PRESETS[0]);const campaign=newProgramRun(definition);definition.sessions[0].exercises[0].target.repsMin=0;');
  assert.notEqual(run('validateProgram(definition)'), '');
  assert.equal(run('campaign.program.sessions[0].exercises[0].target.repsMin'), 5);
});

function savingModel() {
  const run = model(['storage.js', 'workout.js']);
  run(`const appStorage={set:async()=>true};
    function toast(){} function renderLog(){} function renderHud(){} function renderWorkoutTimer(){}
    function applyQuests(){return {lines:[],cleared:[]};}
    function rollLoot(){return {id:crypto.randomUUID(),name:'Test loot'};}
    let presentOptions;showPresent=options=>{presentOptions=options;};
    account={...defaultAccount(),onboarded:true};
    profile={id:'test',name:'Test',classId:DEFAULT_CLASS,xp:0,stats:{strength:0,agility:0},gold:0,cleared:{}};
    const campaign=newProgramRun(PROGRAM_PRESETS[0]);programData.runs.push(campaign);programData.activeRunId=campaign.id;
    draft=programSessionDraft(campaign);`);
  return run;
}

test('real save stores only actual sets and rejects rapid double submission', async () => {
  const run = savingModel();
  run(`draft.exercises.forEach(exercise=>exercise.sets.forEach(set=>{set.reps='5';set.kg='20';}));`);
  await run('Promise.all([saveWorkout(),saveWorkout()])');
  assert.equal(run('workouts.length'), 1);
  assert.equal(run('programRun().completions.length'), 1);
  assert.equal(run('profile.xp'), 100);
  assert.equal(run('profile.stats.strength'), 45);
  assert.equal(run('draft.exercises.length'), 0);
});

test('finishing a partial session without new work does not award workout XP twice', async () => {
  const run = savingModel();
  run(`draft.exercises[0].sets[0]={reps:'5',kg:'20'};draft.programSaveMode='partial';`);
  await run('saveWorkout()');
  assert.equal(run('workouts.length'), 1);
  assert.equal(run('programRun().completions.length'), 0);
  assert.equal(run('draft.exercises[0].sets.length'), 2);
  assert.equal(run('draft.exercises[0].sets.every(set=>set.reps==="")'), true);
  run('draft.programSaveMode="finish"');
  await run('saveWorkout({allowIncomplete:true})');
  assert.equal(run('workouts.length'), 1);
  assert.equal(run('programRun().completions.length'), 1);
  assert.equal(run('profile.xp'), 100);
});

test('agility partial saves count only newly logged distance toward program targets', async () => {
  const run = savingModel();
  run(`const definition={id:'run-program',name:'Running plan',weeklyTarget:2,cycles:1,sessions:[{id:'run-day',name:'Run',
    exercises:[{id:'run-item',name:'Running',type:'agility',target:{km:3,minutes:0}}]}]};
    const running=newProgramRun(definition);programData.runs.push(running);programData.activeRunId=running.id;draft=programSessionDraft(running);
    draft.exercises[0].km='1';draft.programSaveMode='partial';`);
  await run('saveWorkout()');
  assert.equal(run('draft.exercises[0].km'), '');
  run(`draft.exercises[0].km='2';draft.programSaveMode='finish';`);
  await run('saveWorkout()');
  assert.equal(run('workouts.reduce((total,workout)=>total+workout.exercises.reduce((distance,exercise)=>distance+(exercise.km||0),0),0)'), 3);
  assert.equal(run('programRun().completions.length'), 1);
  assert.equal(run('!!programRun().finishedAt'), true);
});

test('workout storage failure restores program, draft, history and rewards', async () => {
  const run = savingModel();
  run(`draft.exercises.forEach(exercise=>exercise.sets.forEach(set=>{set.reps='5';set.kg='20';}));
    const attempt=draft.program.attemptId;appStorage.set=async()=>false;`);
  await run('saveWorkout()');
  assert.equal(run('workouts.length'), 0);
  assert.equal(run('programRun().completions.length'), 0);
  assert.equal(run('profile.xp'), 0);
  assert.equal(run('inventory.length'), 0);
  assert.equal(run('draft.program.attemptId===attempt'), true);
  assert.equal(run('draft.exercises[0].sets[0].reps'), '5');
});

test('ordinary free workout saving keeps existing XP and history behavior', async () => {
  const run = savingModel();
  run(`draft={...blankDraft(),name:'Free session',exercises:[{...newExercise(),name:'Squat',sets:[{reps:'5',kg:'20'}]}]};`);
  await run('saveWorkout()');
  assert.equal(run('workouts.length'), 1);
  assert.equal(run('workouts[0].program'), undefined);
  assert.equal(run('workouts[0].exercises[0].sets[0].reps'), 5);
  assert.equal(run('profile.xp'), 100);
  assert.equal(run('profile.stats.strength'), 5);
  assert.equal(run('programRun().completions.length'), 0);
});