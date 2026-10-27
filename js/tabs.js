// Tab definitions and tab switching.
// Classic script: shares globals with the other files in js/ (load order is in popup.html).

const TAB_DEFS = [
  { id: 'log', label: 'Log', bar: 'top' },
  { id: 'history', label: 'History', bar: 'top' },
  { id: 'stats', label: 'Stats', bar: 'top' },
  { id: 'quest', label: 'Quest', bar: 'top' },
  { id: 'gear', label: 'Gear', bar: 'bottom' },
  { id: 'bag', label: 'Bag', bar: 'bottom' },
  { id: 'store', label: 'Store', bar: 'bottom' },
  { id: 'settings', label: 'Settings', bar: 'bottom' }
];

/* ================= Tabs ================= */
function buildTabs() {
  const main = document.querySelector('main');
  TAB_DEFS.forEach((t) => {
    $('tabs-' + t.bar).append(
      h('button', { role: 'tab', id: 'tab-' + t.id, 'data-tab': t.id, 'aria-selected': 'false', onclick: () => showTab(t.id) }, t.label));
    main.append(h('section', { id: 'panel-' + t.id, role: 'tabpanel', 'aria-labelledby': 'tab-' + t.id, hidden: true }));
  });
}
function setTabBars(visible) {
  ['top', 'bottom'].forEach((bar) => { $('tabs-' + bar).hidden = !visible || !TAB_DEFS.some((t) => t.bar === bar); });
}
function showTab(name) {
  if (!profile) return;
  document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === name));
  TAB_DEFS.forEach((t) => { panelEl(t.id).hidden = t.id !== name; });
  RENDERERS[name]();
  document.querySelector('main').scrollTop = 0; // each tab starts at the top
}
