import { createOptimizedPicture } from '../../scripts/aem.js';
import { getImageSrc, cssUrl, buildCta } from '../../scripts/utils.js';
import { observeRevealGroup } from '../../scripts/reveal.js';
import { registerLockableCard, LOCK } from '../../scripts/card-lock.js';

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

function buildArrows() {
  const prev = el('button', 'row-arrow prev');
  prev.type = 'button';
  prev.setAttribute('aria-label', 'Ver anteriores');
  prev.innerHTML = PREV;
  const next = el('button', 'row-arrow next');
  next.type = 'button';
  next.setAttribute('aria-label', 'Ver más');
  next.innerHTML = NEXT;
  return [prev, next];
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
  const [prev, next] = buildArrows();
  wrap.append(row, prev, next);
  block.replaceChildren(wrap);

  bindRow(wrap, row, prev, next);
  observeRevealGroup(row);
  row.querySelectorAll(':scope > article.card').forEach(registerLockableCard);
}

/* ---------- ranking poster: Poster Card · Top 10 (Cambio 01, maqueta MAD03-06 «v4») ---------- */

let posterBlocks = 0;
let posterDocumentBound = false;

/* Same URL scheme as createOptimizedPicture (webply + original format fallback, optimize=medium),
   but by pixel density: the poster is 256 px wide at every breakpoint */
function buildPosterPicture(cell) {
  const src = getImageSrc(cell);
  if (!src) return null;
  const { origin, pathname } = new URL(src);
  const ext = pathname.split('.').pop();
  const url = (w, format) => `${origin}${pathname}?width=${w}&format=${format}&optimize=medium`;
  const set = (format) => `${url(256, format)} 1x, ${url(512, format)} 2x`;
  const picture = el('picture');
  const source = el('source');
  source.type = 'image/webp';
  source.srcset = set('webply');
  const img = el('img');
  img.loading = 'lazy';
  img.alt = '';
  img.width = 256;
  img.height = 384;
  img.src = url(256, ext);
  img.srcset = set(ext);
  picture.append(source, img);
  return picture;
}

/* Cifra en SVG: el clipPath recorta el desenfoque a la forma del número y la máscara deja
   solo la mitad exterior del trazo de 4 px (sin rayas internas en Safari) */
function buildPosterRank(n, uid) {
  const rank = el('span', n > 9 ? 'pc-rank wide' : 'pc-rank', String(n));
  rank.setAttribute('aria-hidden', 'true');
  const clip = `${uid}-clip`;
  const mask = `${uid}-mask`;
  const t = '<text x="0" y=".865em"';
  rank.insertAdjacentHTML('beforeend', `<i class="pc-rank-glass" style="clip-path:url(#${clip})"></i>`
    + `<svg class="pc-rank-svg"><clipPath id="${clip}">${t}>${n}</text></clipPath>`
    + `<mask id="${mask}" maskUnits="userSpaceOnUse" x="-40" y="-40" width="240" height="200">`
    + `<rect x="-40" y="-40" width="240" height="200" fill="#fff"/>${t} fill="#000">${n}</text></mask>`
    + `${t} class="rk-fill">${n}</text>${t} class="rk-line" mask="url(#${mask})">${n}</text></svg>`);
  return rank;
}

function buildPosterCard(row, n, uid) {
  const [imgCell, availCell, metaCell, bodyCell] = [...row.children];
  const heading = bodyCell ? bodyCell.querySelector('h1, h2, h3, h4, h5, h6') : null;
  const title = heading ? heading.textContent.trim() : '';
  const card = el('article', 'pcard-top');

  const open = el('button', 'pc-open');
  open.type = 'button';
  open.setAttribute('aria-expanded', 'false');
  open.setAttribute('aria-label', title ? `${n}. ${title}` : String(n));

  const flip = el('div', 'pc-flip');
  const front = el('div', 'pc-face pc-front');
  const back = el('div', 'pc-face pc-back');
  back.setAttribute('aria-hidden', 'true');
  back.inert = true;
  const picture = buildPosterPicture(imgCell);
  if (picture) {
    front.append(picture);
    back.append(picture.cloneNode(true));
  }

  const veil = el('div', 'pc-veil');
  const what = el('div', 'pc-what');
  if (title) what.append(el('h3', '', title));
  const metaText = metaCell ? metaCell.textContent.trim() : '';
  if (metaText) what.append(el('p', '', metaText));
  veil.append(what);

  const act = el('div', 'pc-act');
  const availText = availCell ? availCell.textContent.trim() : '';
  if (availText) {
    const avail = el('p', 'pc-avail');
    const icon = el('span', 'lock-icon');
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = LOCK;
    avail.append(icon, availText);
    act.append(avail);
  }
  /* Solo el enlace autorado: el párrafo de descripción y las clases button-* de EDS no se pintan */
  const link = bodyCell ? bodyCell.querySelector('a[href]') : null;
  if (link) act.append(buildCta(link, 'btn', 'button'));
  if (act.children.length) veil.append(act);
  back.append(veil);

  flip.append(front, back);
  card.append(open, buildPosterRank(n, uid), flip);
  return card;
}

/* Card final a tamaño póster: solo el enlace normal, nunca el de la promo.
   Vale con la celda de la promo (3 celdas) y sin ella (2 celdas). */
function buildPosterCtaCard(row) {
  const card = buildCtaCard(row);
  const cells = [...row.children];
  const regularCell = cells.length > 2 ? cells[2] : cells[1];
  const regular = regularCell ? regularCell.querySelector('a') : null;
  card.href = regular ? regular.getAttribute('href') || '#' : '#';
  card.querySelectorAll('.promo-only').forEach((s) => s.remove());
  card.querySelectorAll('.no-promo').forEach((s) => s.classList.remove('no-promo'));
  return card;
}

function setPosterFlipped(card, on) {
  card.classList.toggle('is-flipped', on);
  card.querySelector('.pc-open').setAttribute('aria-expanded', on ? 'true' : 'false');
  const back = card.querySelector('.pc-back');
  back.setAttribute('aria-hidden', on ? 'false' : 'true');
  back.inert = !on;
}

function closePosters(except) {
  document.querySelectorAll('.pcard-top.is-flipped').forEach((c) => {
    if (c !== except) setPosterFlipped(c, false);
  });
}

/* Gira con clic / tap / Enter / Espacio, nunca con hover ni solo con el foco.
   Una sola girada a la vez. */
function bindPosterCard(card) {
  const open = card.querySelector('.pc-open');
  const back = card.querySelector('.pc-back');
  open.addEventListener('click', (e) => {
    const on = !card.classList.contains('is-flipped');
    closePosters(card);
    setPosterFlipped(card, on);
    const btn = back.querySelector('.btn');
    /* teclado (detail 0): el foco pasa al botón del reverso; sin botón se queda en el de la card */
    if (on && e.detail === 0 && btn) btn.focus({ preventScroll: true });
  });
  back.addEventListener('click', (e) => {
    if (!e.target.closest('.btn')) setPosterFlipped(card, false);
  });
  card.addEventListener('focusout', (e) => {
    if (!card.contains(e.relatedTarget)) setPosterFlipped(card, false);
  });
}

function bindPosterDocument() {
  if (posterDocumentBound) return;
  posterDocumentBound = true;
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.pcard-top')) closePosters(null);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const c = document.querySelector('.pcard-top.is-flipped');
    if (!c) return;
    setPosterFlipped(c, false);
    c.querySelector('.pc-open').focus();
  });
}

function decoratePoster(block) {
  posterBlocks += 1;
  const wrap = el('div', 'cards-wrap');
  const row = el('div', 'cards-row');
  row.dataset.step = '90';
  /* «late» pide ver la mitad de la fila (~490 px) dentro del 80 % superior del viewport:
     por debajo de 400 px de alto no se cumpliría nunca, así que ahí se usa el disparo normal */
  if (window.innerHeight >= 400) row.dataset.reveal = 'late';
  let n = 0;
  [...block.children].forEach((r) => {
    const first = r.firstElementChild;
    if (first && first.querySelector('img, picture')) {
      n += 1;
      row.append(buildPosterCard(r, n, `pc${posterBlocks}-${n}`));
    } else if (first) {
      row.append(buildPosterCtaCard(r));
    }
  });
  const [prev, next] = buildArrows();
  wrap.append(row, prev, next);
  block.replaceChildren(wrap);

  bindRow(wrap, row, prev, next);
  observeRevealGroup(row);
  bindPosterDocument();
  row.querySelectorAll(':scope > .pcard-top').forEach(bindPosterCard);
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
  if (block.classList.contains('ranking') && block.classList.contains('poster')) decoratePoster(block);
  else if (block.classList.contains('ranking')) decorateRanking(block);
  else if (block.classList.contains('advantages')) await decorateAdvantages(block);
  else decorateDefault(block);
}
