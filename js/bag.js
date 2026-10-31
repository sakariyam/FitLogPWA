// Inventory: equipped slots and owned items.
// Classic script: shares globals with the other files in js/ (load order is in popup.html).

/* ================= Inventory ================= */
const goldCard = () => h('div', { class: 'card gold' }, h('span', { text: 'Gold' }), h('span', { class: 'gold-amt', text: profile.gold.toLocaleString() }));
const unequippedItems = () => { const ids = new Set(Object.values(equipped)); return inventory.filter((i) => !ids.has(i.id)); };

let inventoryFilter = 'all';

function renderInventory() {
  renderHud();
  const panel = panelEl('inventory');
  const slots = h('div', { class: 'equipped-slots', role: 'group', 'aria-label': 'Equipped slots' }, SLOTS.map((slot) => {
    const item = itemById(equipped[slot]);
    return h('button', { type: 'button', class: 'equipped-slot', 'aria-pressed': String(inventoryFilter === slot),
      'aria-label': `${SLOT_LABEL[slot]}: ${item ? item.name : 'Empty'}`, title: item ? `${SLOT_LABEL[slot]}: ${item.name}` : `${SLOT_LABEL[slot]}: Empty`,
      onclick: () => { inventoryFilter = inventoryFilter === slot ? 'all' : slot; renderInventory(); } },
      h('span', { class: 'equipped-slot-art', 'aria-hidden': 'true' }, item ? itemSprite(item, 'sprite sm') : '+'),
      h('span', { text: SLOT_LABEL[slot] }));
  }));
  const filter = h('select', { class: 'select', 'aria-label': 'Filter inventory by slot', onchange: (event) => {
    inventoryFilter = event.target.value; renderInventory();
  } }, h('option', { value: 'all', selected: inventoryFilter === 'all' }, 'All slots'),
  SLOTS.map((slot) => h('option', { value: slot, selected: inventoryFilter === slot }, SLOT_LABEL[slot])));
  const items = inventory.filter((item) => inventoryFilter === 'all' || item.slot === inventoryFilter);
  panel.replaceChildren(characterEquipmentOverview(), h('h2', { class: 'inventory-heading', text: 'Equipped' }), slots,
    h('div', { class: 'inventory-list-head' }, h('h2', { class: 'inventory-heading', text: 'Items' }), filter),
    h('div', { class: 'bag-count', text: `${items.length} item${items.length === 1 ? '' : 's'}` }));
  if (!items.length) panel.append(h('div', { class: 'empty', text: inventory.length ? 'No items in this slot.' : 'No items yet. Save a workout to earn a gift box.' }));
  items.forEach((item) => {
    const isEquipped = equipped[item.slot] === item.id;
    const current = itemById(equipped[item.slot]);
    const actions = h('div', { class: 'inventory-item-actions' }, h('button', { type: 'button', class: 'btn small',
      'aria-label': `${isEquipped ? 'Unequip' : 'Equip'} ${item.name}`, onclick: () => {
        if (isEquipped) { equipped[item.slot] = null; persist(); } else equipItem(item);
        renderInventory(); toast(`${isEquipped ? 'Unequipped' : 'Equipped'} ${item.name}`);
      } }, isEquipped ? 'Unequip' : 'Equip'));
    if (!isEquipped) {
      const price = SELL_PRICE[rarityIndex(item)];
      const sell = h('button', { type: 'button', class: 'btn small', 'aria-label': `Sell ${item.name} for ${price} gold`, onclick: () => {
        if (!sell.classList.contains('armed')) { sell.classList.add('armed'); sell.textContent = 'Confirm sale'; return; }
        if (Object.values(equipped).includes(item.id)) return;
        inventory = inventory.filter((owned) => owned.id !== item.id);
        profile.gold += price; persist(); renderInventory(); toast(`Sold ${item.name} for ${price} gold`);
      } }, `Sell ${price}`);
      actions.append(sell);
    }
    panel.append(h('div', { class: 'card item inventory-item' },
      h('div', { class: 'slot-icon' }, itemSprite(item, 'sprite sm')),
      h('div', { class: 'slot-info' }, h('div', { class: 'slot-name', text: item.name }),
        h('div', { class: 'slot-label', text: `${rarityOf(item).label} ${stars(item)}, ${SLOT_LABEL[item.slot]}` }),
        h('div', { class: 'slot-label', text: statText(item) }),
        isEquipped ? h('span', { class: 'inventory-equipped', text: 'Equipped' })
          : current ? h('div', { class: 'slot-label', text: `Replaces ${current.name}` }) : null), actions));
  });
}
