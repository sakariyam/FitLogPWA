// Bag tab.
// Classic script: shares globals with the other files in js/ (load order is in popup.html).

/* ================= Bag tab ================= */
const goldCard = () => h('div', { class: 'card gold' }, h('span', { text: 'Gold' }), h('span', { class: 'gold-amt', text: profile.gold.toLocaleString() }));
const unequippedItems = () => { const ids = new Set(Object.values(equipped)); return inventory.filter((i) => !ids.has(i.id)); };

function renderBag() {
  const panel = panelEl('bag');
  panel.replaceChildren(goldCard());
  const items = unequippedItems();
  if (!items.length) {
    panel.append(h('div', { class: 'empty', text: inventory.length ? 'Your bag is empty. Everything you own is equipped.' : 'Your bag is empty. Save a workout to earn a gift box.' }));
    return;
  }
  panel.append(h('div', { class: 'bag-count', text: `${items.length} item${items.length === 1 ? '' : 's'}` }));
  items.forEach((item) => {
    const current = equipped[item.slot] && itemById(equipped[item.slot]);
    panel.append(h('div', { class: 'card item' },
      h('div', { class: 'slot-icon' }, itemSprite(item, 'sprite sm')),
      h('div', { class: 'slot-info' },
        h('div', { class: 'slot-name', text: item.name }),
        h('div', { class: 'slot-label', text: `${rarityOf(item).label} ${stars(item)}, ${SLOT_LABEL[item.slot]}` }),
        h('div', { class: 'slot-label', text: statText(item) }),
        current ? h('div', { class: 'slot-label', text: `Replaces ${current.name}` }) : null),
      h('button', { class: 'btn small', onclick: () => { equipItem(item); renderBag(); toast(`Equipped ${item.name}`); } }, 'Equip')));
  });
}
