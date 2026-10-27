// Starts the app. Loaded last, after every other script.
// Classic script: shares globals with the other files in js/ (load order is in popup.html).

const RENDERERS = { log: renderLog, history: renderHistory, stats: renderStats, quest: renderQuest, gear: renderGear, bag: renderBag, store: renderStore, settings: renderSettings };

/* ================= Init ================= */
buildTabs();
load().then(() => {
  if (!account || !account.onboarded) showAccountSetup();
  else if (profile) startApp();
  else showCharacterSelect();
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
}).catch((error) => {
  console.error('FitLog could not start', error);
  const panel = panelEl('onboard');
  panel.hidden = false;
  panel.replaceChildren(
    h('h2', { text: 'Your saved data could not be opened' }),
    h('p', { role: 'alert', text: 'Check that device storage is available and close other FitLog windows, then try again. Your saved data has not been reset.' }),
    h('button', { class: 'btn primary', onclick: () => location.reload() }, 'Try again'));
});
