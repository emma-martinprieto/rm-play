import { createOptimizedPicture } from '../../scripts/aem.js';
import { getImageSrc, cssUrl } from '../../scripts/utils.js';
import { observeRevealGroup } from '../../scripts/reveal.js';
import { registerLockableCard } from '../../scripts/card-lock.js';

const PREV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>';
const NEXT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>';

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/* ---------- ranking: «Lo más visto» (prototype html:L805-855, scripts 2 + 5) ---------- */

function buildRankCard(row, n) {
  const [imgCell, tagCell, durCell, bodyCell] = [...row.children];
  const card = el('article', 'card');
  const thumb = el('div', 'thumb');
  const art = el('div', 'art');
  const src = getImageSrc(imgCell);
  if (src) art.style.backgroundImage = cssUrl(src);
  const rank = el('span', n > 9 ? 'rank wide' : 'rank', String(n));
  rank.setAttribute('aria-hidden', 'true');
  thumb.append(art, rank);
  const tagText = tagCell ? tagCell.textContent.trim() : '';
  if (tagText) thumb.append(el('span', 'tag', tagText));
  const durText = durCell ? durCell.textContent.trim() : '';
  if (durText) thumb.append(el('span', 'dur', durText));

  const body = el('div', 'card-body');
  if (bodyCell) {
    const h3 = bodyCell.querySelector('h1, h2, h3, h4, h5, h6');
    if (h3) {
      const title = el('h3');
      title.append(el('span', 'sr-only', `${n}. `), ...h3.childNodes);
      h3.replaceWith(title);
    }
    body.append(...bodyCell.children);
  }
  card.append(thumb, body);
  return card;
}

function buildCtaCard(row) {
  const cells = [...row.children];
  const links = cells.map((c) => c.querySelector('a'));
  const promoLink = cells.length > 2 ? links[1] : null;
  const regularLink = cells.length > 2 ? links[2] : links[1];
  const card = el('a', 'card card-cta');
  card.href = (promoLink || regularLink) ? (promoLink || regularLink).getAttribute('href') || '#' : '#';
  const first = cells[0];
  const heading = first.querySelector('h1, h2, h3, h4, h5, h6');
  const eyebrowP = [...first.querySelectorAll('p')].find((p) => p.textContent.trim());
  if (eyebrowP) card.append(el('span', 'eyebrow', eyebrowP.textContent.trim()));
  if (heading) card.append(el('h3', '', heading.textContent.trim()));
  if (promoLink) card.append(el('span', 'go promo-only', promoLink.textContent.trim()));
  if (regularLink) card.append(el('span', promoLink ? 'go no-promo' : 'go', regularLink.textContent.trim()));
  return card;
}

/* Prototype script 2: mouse drag (4 px threshold) + prev/next arrows */
function bindRow(wrap, row, prev, next) {
  let startX = 0;
  let startScroll = 0;
  let pressed = false;
  let moved = false;
  row.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    pressed = true;
    moved = false;
    startX = e.clientX;
    startScroll = row.scrollLeft;
  });
  row.addEventListener('pointermove', (e) => {
    if (!pressed) return;
    const dx = e.clientX - startX;
    if (!moved && Math.abs(dx) > 4) {
      moved = true;
      row.classList.add('is-dragging');
      row.setPointerCapture(e.pointerId);
    }
    if (moved) row.scrollLeft = startScroll - dx;
  });
  function release() {
    if (!pressed) return;
    pressed = false;
    row.classList.remove('is-dragging');
  }
  row.addEventListener('pointerup', release);
  row.addEventListener('pointercancel', release);
  /* Un arrastre no debe contar como clic en la card */
  row.addEventListener('click', (e) => {
    if (moved) {
      e.preventDefault();
      e.stopPropagation();
      moved = false;
    }
  }, true);
  row.addEventListener('dragstart', (e) => { e.preventDefault(); });

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function step() {
    const first = row.firstElementChild;
    return first.getBoundingClientRect().width + parseFloat(getComputedStyle(row).columnGap || 0);
  }
  function update() {
    const max = row.scrollWidth - row.clientWidth;
    prev.disabled = row.scrollLeft <= 4;
    next.disabled = row.scrollLeft >= max - 4;
  }
  prev.addEventListener('click', () => { row.scrollBy({ left: -step(), behavior: reduceMotion ? 'auto' : 'smooth' }); });
  next.addEventListener('click', () => { row.scrollBy({ left: step(), behavior: reduceMotion ? 'auto' : 'smooth' }); });
  row.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
  /* EDS: the section is display:none while blocks decorate, so the initial update()
     measures 0. Re-run it once the row gets its real size (invisible adjustment). */
  if ('ResizeObserver' in window) new ResizeObserver(update).observe(row);
}

function decorateRanking(block) {
  const wrap = el('div', 'cards-wrap');
  const row = el('div', 'cards-row');
  let n = 0;
  [...block.children].forEach((r) => {
    const first = r.firstElementChild;
    if (first && first.querySelector('img, picture')) {
      n += 1;
      row.append(buildRankCard(r, n));
    } else if (first) {
      row.append(buildCtaCard(r));
    }
  });
  const prev = el('button', 'row-arrow prev');
  prev.type = 'button';
  prev.setAttribute('aria-label', 'Ver anteriores');
  prev.innerHTML = PREV;
  const next = el('button', 'row-arrow next');
  next.type = 'button';
  next.setAttribute('aria-label', 'Ver más');
  next.innerHTML = NEXT;
  wrap.append(row, prev, next);
  block.replaceChildren(wrap);

  bindRow(wrap, row, prev, next);
  observeRevealGroup(row);
  row.querySelectorAll(':scope > article.card').forEach(registerLockableCard);
}

/* ---------- advantages: «Y además…» (prototype html:L959-963) ---------- */

const svgCache = {};
async function fetchIcon(name) {
  if (!svgCache[name]) {
    svgCache[name] = fetch(`${window.hlx.codeBasePath}/icons/${name}.svg`)
      .then((r) => (r.ok ? r.text() : ''))
      .catch(() => '');
  }
  return svgCache[name];
}

function iconName(cell) {
  const span = cell.querySelector('span.icon');
  if (span) {
    const cls = [...span.classList].find((c) => c.startsWith('icon-'));
    if (cls) return cls.substring(5);
  }
  const m = /:([a-z0-9-]+):/.exec(cell.textContent.trim());
  return m ? m[1] : '';
}

async function decorateAdvantages(block) {
  const ul = el('ul', 'perks-grid');
  ul.dataset.step = '140';
  ul.dataset.reveal = 'late';
  const jobs = [...block.children].map(async (row) => {
    const cells = [...row.children];
    const iconCell = cells.length > 1 ? cells[0] : null;
    const bodyCell = cells[cells.length - 1];
    const li = el('li', 'perk');
    const icon = el('span', 'perk-icon');
    icon.setAttribute('aria-hidden', 'true');
    li.append(icon);
    const name = iconCell ? iconName(iconCell) : '';
    if (name) {
      const text = await fetchIcon(name);
      const svg = new DOMParser().parseFromString(text, 'image/svg+xml').querySelector('svg');
      if (svg) {
        svg.removeAttribute('xmlns');
        icon.append(document.importNode(svg, true));
      }
    }
    bodyCell.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => h.removeAttribute('id'));
    bodyCell.querySelectorAll('strong').forEach((s) => s.classList.add('perk-num'));
    li.append(...bodyCell.children);
    return li;
  });
  (await Promise.all(jobs)).forEach((li) => ul.append(li));
  block.replaceChildren(ul);
  observeRevealGroup(ul);
}

/* ---------- default: Block Collection cards ---------- */

function decorateDefault(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      if (div.children.length === 1 && div.querySelector('picture')) div.className = 'cards-card-image';
      else div.className = 'cards-card-body';
    });
    ul.append(li);
  });
  ul.querySelectorAll('picture > img').forEach((img) => img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }])));
  block.replaceChildren(ul);
}

export default async function decorate(block) {
  if (block.classList.contains('ranking')) decorateRanking(block);
  else if (block.classList.contains('advantages')) await decorateAdvantages(block);
  else decorateDefault(block);
}
