import { toClassName } from '../../scripts/aem.js';
import { getImageSrc, cssUrl } from '../../scripts/utils.js';
import { registerLockableCard } from '../../scripts/card-lock.js';

const PREV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>';
const NEXT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>';

/* Prototype per-image framing (html:L585-586, 607-608). DA renames images on upload,
   so the framing is keyed by card title (EDS adjustment). */
const FRAMING = {
  'Thibaut Courtois': '50% 40%',
  'Dean Huijsen': '48% 30%',
  'Jude Bellingham': '48% 25%',
  Documentales: 'center 8%',
  'Player Cam': 'left center',
};

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function buildTile(cell) {
  const card = el('article', 'card tile');
  const heading = cell.querySelector('h1, h2, h3, h4, h5, h6');
  const title = heading ? heading.textContent.trim() : '';
  const sub = [...cell.querySelectorAll('p')].find((p) => !p.querySelector('img, picture') && p.textContent.trim());
  const cap = el('div', 'tile-cap');
  cap.append(el('h3', '', title));
  if (sub) cap.append(el('p', '', sub.textContent.trim()));
  const src = getImageSrc(cell);
  let thumb;
  if (src) {
    thumb = el('div', 'thumb');
    const art = el('div', 'art');
    art.style.backgroundImage = cssUrl(src);
    if (FRAMING[title]) art.style.backgroundPosition = FRAMING[title];
    thumb.append(art, cap);
  } else {
    /* Sin imagen: solo el fondo oscuro de la card (gradient/card-dark) y el rótulo */
    thumb = el('div', 'thumb');
    thumb.append(cap);
  }
  card.append(thumb);
  return card;
}

/* Prototype script 7: accessible tabs, centred active tab, circular arrows, swipe, reveal */
function bindCategories(sec) {
  const track = sec.querySelector('.cat-track');
  const viewport = sec.querySelector('.cat-viewport');
  const tabs = [...sec.querySelectorAll('.cat-tab')];
  const panels = tabs.map((t) => sec.querySelector(`#${t.getAttribute('aria-controls')}`));
  let current = 0;
  panels.forEach((p) => { [...p.children].forEach((c, i) => c.style.setProperty('--i', i)); });
  function center() {
    const t = tabs[current];
    const x = viewport.clientWidth / 2 - (t.offsetLeft + t.offsetWidth / 2);
    track.style.transform = `translateX(${x}px)`;
  }
  function go(target, focus) {
    const i = (target + tabs.length) % tabs.length;
    if (i === current) {
      if (focus) tabs[i].focus();
      return;
    }
    tabs[current].setAttribute('aria-selected', 'false');
    tabs[current].tabIndex = -1;
    panels[current].hidden = true;
    current = i;
    tabs[i].setAttribute('aria-selected', 'true');
    tabs[i].tabIndex = 0;
    panels[i].hidden = false;
    if (focus) tabs[i].focus({ preventScroll: true });
    center();
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => go(i));
    t.addEventListener('keydown', (e) => {
      const k = {
        ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: tabs.length - 1,
      }[e.key];
      if (k === undefined) return;
      e.preventDefault();
      go(k, true);
    });
  });
  sec.querySelector('.cat-arrow.prev').addEventListener('click', () => go(current - 1));
  sec.querySelector('.cat-arrow.next').addEventListener('click', () => go(current + 1));
  let sx = null;
  let sy = 0;
  const area = sec.querySelector('.cat-panels');
  area.addEventListener('touchstart', (e) => {
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
  }, { passive: true });
  area.addEventListener('touchend', (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    sx = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(current + (dx < 0 ? 1 : -1));
  });
  window.addEventListener('resize', center);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(center);
  center();
  /* EDS: the section is display:none while blocks decorate (viewport width 0),
     so re-centre once the viewport is laid out (invisible adjustment). */
  if ('ResizeObserver' in window) new ResizeObserver(() => center()).observe(viewport);
  if (!('IntersectionObserver' in window)) {
    sec.classList.add('is-in');
    return;
  }
  const io = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      sec.classList.add('is-in');
      io.disconnect();
    }
  }, { threshold: 0.25 });
  io.observe(area);
}

/* El título de la sección acaba en una preposición corta («…descubrir en», «…discover in»):
   si parte en dos líneas, la última palabra (hasta 3 letras) baja con la anterior */
function keepLastWordTogether(heading) {
  if (!heading) return;
  const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
  let last = null;
  while (walker.nextNode()) if (walker.currentNode.textContent.trim()) last = walker.currentNode;
  if (last) last.textContent = last.textContent.replace(/\s+(\S{1,3})(\s*)$/, ' $1$2');
}

/* Última fila con contenido solo en la primera celda (combinada o con el resto vacías):
   mensaje y enlace del candado, autorados una vez para todas las tarjetas */
function readLockRow(block) {
  const row = block.lastElementChild;
  if (!row || block.children.length < 2) return {};
  const [first, ...rest] = [...row.children];
  if (!first || rest.some((c) => c.textContent.trim() || c.querySelector('img'))) return {};
  row.remove();
  const link = first.querySelector('a');
  const p = [...first.querySelectorAll('p')].find((x) => !x.querySelector('a') && x.textContent.trim());
  const text = p ? p.textContent.trim() : '';
  return { text: text || (link ? '' : first.textContent.trim()), link };
}

function decorateCategories(block) {
  const lockContent = readLockRow(block);
  const nav = el('div', 'cat-nav');
  const prev = el('button', 'cat-arrow prev');
  prev.type = 'button';
  prev.setAttribute('aria-label', 'Categoría anterior');
  prev.innerHTML = PREV;
  const next = el('button', 'cat-arrow next');
  next.type = 'button';
  next.setAttribute('aria-label', 'Categoría siguiente');
  next.innerHTML = NEXT;
  const viewport = el('div', 'cat-viewport');
  const track = el('div', 'cat-track');
  track.setAttribute('role', 'tablist');
  track.setAttribute('aria-label', 'Categorías');
  viewport.append(track);
  nav.append(prev, viewport, next);
  const panels = el('div', 'cat-panels');

  [...block.children].forEach((row, i) => {
    const [nameCell, ...cardCells] = [...row.children];
    if (!nameCell) return;
    const name = nameCell.textContent.trim();
    const id = toClassName(name.split(/\s+/)[0]);
    const tab = el('button', 'cat-tab', name);
    tab.type = 'button';
    tab.setAttribute('role', 'tab');
    tab.id = `tab-${id}`;
    tab.setAttribute('aria-controls', `panel-${id}`);
    tab.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    tab.tabIndex = i === 0 ? 0 : -1;
    track.append(tab);
    const grid = el('div', 'cat-grid');
    grid.setAttribute('role', 'tabpanel');
    grid.id = `panel-${id}`;
    grid.setAttribute('aria-labelledby', `tab-${id}`);
    if (i > 0) grid.hidden = true;
    cardCells.filter((c) => c.textContent.trim() || c.querySelector('img'))
      .forEach((c) => grid.append(buildTile(c)));
    panels.append(grid);
  });

  block.replaceChildren(nav, panels);
  keepLastWordTogether(block.closest('.section')?.querySelector('.default-content-wrapper > h2'));
  bindCategories(block);
  panels.querySelectorAll('.cat-grid > article.card').forEach((card) => registerLockableCard(card, lockContent));
}

/* Generic tabs fallback: first cell = tab label, rest = panel */
function decorateDefault(block) {
  const list = el('div', 'tabs-list');
  list.setAttribute('role', 'tablist');
  const rows = [...block.children];
  rows.forEach((row, i) => {
    const [label, ...content] = [...row.children];
    const id = toClassName(label.textContent) || `tab-${i}`;
    const btn = el('button', 'tabs-tab', label.textContent.trim());
    btn.type = 'button';
    btn.id = `tab-${id}`;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-controls', `tabpanel-${id}`);
    btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    list.append(btn);
    row.className = 'tabs-panel';
    row.id = `tabpanel-${id}`;
    row.setAttribute('role', 'tabpanel');
    row.setAttribute('aria-labelledby', btn.id);
    row.setAttribute('aria-hidden', i === 0 ? 'false' : 'true');
    label.remove();
    row.replaceChildren(...content);
    btn.addEventListener('click', () => {
      block.querySelectorAll('[role=tabpanel]').forEach((p) => p.setAttribute('aria-hidden', 'true'));
      list.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', 'false'));
      row.setAttribute('aria-hidden', 'false');
      btn.setAttribute('aria-selected', 'true');
    });
  });
  block.prepend(list);
}

export default function decorate(block) {
  if (block.classList.contains('categories')) decorateCategories(block);
  else decorateDefault(block);
}
