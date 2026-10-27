// Gear tab: headshot, stats and equipped items.
// Classic script: shares globals with the other files in js/ (load order is in popup.html).

/* ================= Gear tab ================= */
// The headshot is the base face plus the look of each equipped head, body and neck item (drawn in that order, so the head item ends up on top).
function headshotRows() {
  const cls = classOf();
  const grid = cls.headshot.map((r) => [...r]);
  ['body', 'neck', 'head'].forEach((slot) => {
    const it = equipped[slot] && itemById(equipped[slot]);
    const rows = it && cls.looks && cls.looks[slot] && cls.looks[slot][lookOf(it)];
    if (rows) rows.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') grid[y][x] = c === '_' ? '.' : c; }));
  });
  return grid.map((r) => r.join(''));
}
function characterSvg() {
  const svg = spriteFrom(headshotRows(), 'character');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Your character');
  svg.removeAttribute('aria-hidden');
  return svg;
}

function renderGear() {
  const panel = panelEl('gear');
  panel.replaceChildren();
  const bonus = gearBonus();

  const statRows = Object.keys(STATS).map((k) => {
    const info = statInfo(profile.stats[k]);
    return h('div', { class: 'stat' },
      h('div', { class: 'stat-top' }, h('span', { text: STATS[k] }), h('span', { text: `LV ${info.level}${bonus[k] ? ` (+${bonus[k]})` : ''}` })),
      h('div', { class: 'xp-bar small' }, h('div', { class: 'xp-fill', style: `width:${(info.into / info.need) * 100}%` })),
      h('div', { class: 'stat-xp', text: info.max ? 'MAX LEVEL' : `${info.into}/${info.need} XP` }));
  });

  panel.append(
    h('div', { class: 'card gear-top' }, h('div', { class: 'stage' }, characterSvg()), h('div', { class: 'stats' }, statRows,
      h('div', { class: 'stat-note', text: 'Brackets show bonus from gear.' }))),
    h('div', { class: 'card' }, SLOTS.map((slot) => {
      const it = equipped[slot] && itemById(equipped[slot]);
      return h('div', { class: 'slot-row' },
        h('div', { class: 'slot-icon' }, it ? itemSprite(it, 'sprite sm') : null),
        h('div', { class: 'slot-info' },
          h('div', { class: 'slot-label', text: SLOT_LABEL[slot] }),
          h('div', { class: it ? 'slot-name' : 'slot-name empty-slot', text: it ? it.name : 'Empty' }),
          it ? h('div', { class: 'slot-label', text: statText(it) }) : null),
        it ? h('button', { class: 'btn small', onclick: () => { equipped[slot] = null; persist(); renderGear(); } }, 'Unequip') : null);
    }))
  );
}
