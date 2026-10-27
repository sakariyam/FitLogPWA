// DOM helpers: h(), sprite drawing, toast.
// Classic script: shares globals with the other files in js/ (load order is in popup.html).

/* ================= DOM helpers ================= */
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = v;
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach((c) => c != null && el.append(c));
  return el;
}
const SVG_NS = 'http://www.w3.org/2000/svg';
const TONE_CLASS = { '#': 'px-1', '+': 'px-2', s: 'ch-skin' };
function svgRect(x, y, cls) {
  const r = document.createElementNS(SVG_NS, 'rect');
  r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', 1); r.setAttribute('height', 1);
  r.setAttribute('class', cls);
  return r;
}
function svgEl(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  kids.flat().forEach((c) => c != null && el.append(c));
  return el;
}
function spriteFrom(rows, cls = 'sprite') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${rows[0].length} ${rows.length}`);
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  rows.forEach((row, y) => [...row].forEach((c, x) => { if (TONE_CLASS[c]) svg.append(svgRect(x, y, TONE_CLASS[c])); }));
  return svg;
}
const avatarSprite = (key, cls) => spriteFrom(AVATARS[key] || AVATARS.salaryman_default, cls);
const panelEl = (name) => document.getElementById('panel-' + name);
const $ = (id) => document.getElementById(id);

let toastTimer;
function toast(msg, ms = 1800) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
