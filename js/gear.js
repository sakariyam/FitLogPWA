// Character artwork reflects equipped gear.
// Classic script: shares globals with the other files in js/ (load order is in popup.html).

/* ================= Gear tab ================= */
// The headshot is the base face plus the look of each equipped head, body and neck item (drawn in that order, so the head item ends up on top).
function headshotRows(character = profile, items = inventory, gear = equipped) {
  const cls = CLASSES[character.classId] || CLASSES[DEFAULT_CLASS];
  const grid = cls.headshot.map((r) => [...r]);
  ['body', 'neck', 'head'].forEach((slot) => {
    const it = items.find((item) => item.id === gear[slot]);
    const rows = it && cls.looks && cls.looks[slot] && cls.looks[slot][lookOf(it)];
    if (rows) rows.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') grid[y][x] = c === '_' ? '.' : c; }));
  });
  return grid.map((r) => r.join(''));
}
function characterSvg(character = profile, items = inventory, gear = equipped, cssClass = 'character') {
  const svg = spriteFrom(headshotRows(character, items, gear), cssClass);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Your character');
  svg.removeAttribute('aria-hidden');
  return svg;
}

