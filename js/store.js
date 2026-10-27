// Store tab: buy gift boxes, sell gear.
// Classic script: shares globals with the other files in js/ (load order is in popup.html).

/* ================= Store tab ================= */
function buyBox(entry) {
  if (profile.gold < entry.price) return toast('Not enough gold.');
  profile.gold -= entry.price;
  const item = rollLoot(Math.random() < 0.5 ? 'strength' : 'agility', entry.minRarity);
  inventory.unshift(item);
  persist();
  showPresent({ title: entry.name, lines: [`-${entry.price} gold`], item, returnTab: 'store', returnLabel: 'Back to store' });
}

function renderStore() {
  const panel = panelEl('store');
  panel.replaceChildren(goldCard());
  panel.append(h('div', { class: 'bag-count', text: 'Gift boxes' }));
  STORE_ITEMS.forEach((entry) => panel.append(h('div', { class: 'card item' },
    h('div', { class: 'slot-icon' }, spriteFrom(PRESENT_CLOSED, 'sprite sm')),
    h('div', { class: 'slot-info' }, h('div', { class: 'slot-name', text: entry.name }), h('div', { class: 'slot-label', text: entry.text })),
    h('button', { class: 'btn small', disabled: profile.gold < entry.price, onclick: () => buyBox(entry) }, `${entry.price} gold`))));

  const items = unequippedItems();
  panel.append(h('div', { class: 'bag-count', text: 'Sell gear from your bag' }));
  if (!items.length) panel.append(h('div', { class: 'empty', text: 'Nothing to sell.' }));
  items.forEach((item) => {
    const price = SELL_PRICE[rarityIndex(item)];
    const sell = h('button', { class: 'btn small danger', onclick: () => {
      if (!sell.classList.contains('armed')) { sell.classList.add('armed'); sell.textContent = 'Confirm'; return; }
      inventory = inventory.filter((i) => i.id !== item.id);
      profile.gold += price;
      persist(); renderStore(); toast(`Sold ${item.name} for ${price} gold`);
    } }, `Sell ${price}`);
    panel.append(h('div', { class: 'card item' },
      h('div', { class: 'slot-icon' }, itemSprite(item, 'sprite sm')),
      h('div', { class: 'slot-info' }, h('div', { class: 'slot-name', text: item.name }), h('div', { class: 'slot-label', text: `${rarityOf(item).label}, ${statText(item)}` })),
      sell));
  });
}
