// Loot rolling, item looks and equipping.
// Classic script: shares globals with the other files in js/ (load order is in popup.html).

/* ================= Loot ================= */
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function rollLoot(bias, minRarity = 0) {
  const total = RARITIES.reduce((t, r, i) => t + (i >= minRarity ? r.weight : 0), 0);
  let roll = Math.random() * total;
  let ri = minRarity;
  for (let i = minRarity; i < RARITIES.length; i++) { roll -= RARITIES[i].weight; if (roll < 0) { ri = i; break; } }
  const rarity = RARITIES[ri];
  const gear = classOf().gear;
  const slot = pick(SLOTS);
  const stats = { strength: 0, agility: 0 };
  for (let n = 0; n < rarity.bonus; n++) stats[Math.random() < 0.7 ? bias : (bias === 'agility' ? 'strength' : 'agility')]++;
  const suffix = stats.strength > stats.agility ? gear.suffix.strength : stats.agility > stats.strength ? gear.suffix.agility : '';
  const piece = pick(gear.pieces[slot]);
  return { id: crypto.randomUUID(), slot, look: piece.look, rarity: rarity.key, name: `${gear.materials[ri]} ${piece.name}${suffix}`, stats };
}
const rarityIndex = (item) => Math.max(0, RARITIES.findIndex((r) => r.key === item.rarity));
const rarityOf = (item) => RARITIES[rarityIndex(item)];
const stars = (item) => '★'.repeat(rarityIndex(item) + 1) + '☆'.repeat(RARITIES.length - 1 - rarityIndex(item));
const statText = (item) => Object.keys(STATS).filter((k) => item.stats[k]).map((k) => `+${item.stats[k]} ${STATS[k]}`).join(', ');
// Which look an item has. Older items without one are matched by name, falling back to the slot's first look.
function lookOf(item) {
  if (item.look) return item.look;
  const pieces = [...(classOf().gear.pieces[item.slot] || [])].sort((a, b) => b.name.length - a.name.length);
  const hit = pieces.find((p) => item.name.includes(p.name));
  return hit ? hit.look : Object.keys(classOf().itemSprites[item.slot])[0];
}
const itemSprite = (item, cls) => {
  const icons = classOf().itemSprites[item.slot];
  return spriteFrom(icons[lookOf(item)] || Object.values(icons)[0], cls);
};
function equipItem(item) { equipped[item.slot] = item.id; persist(); }
