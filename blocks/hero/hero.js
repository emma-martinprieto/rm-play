import {
  getImageSrc, cssUrl, buildCta, splitAround,
} from '../../scripts/utils.js';
import { observeRevealGroup } from '../../scripts/reveal.js';

/* Row offsets of the prototype mosaic (html:L771-775): capa3, capa10, capa5, capa12, capa6 */
const ROW_OFFSETS = [0, 5, 2, 7, 3];

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function buildMarquee(srcs) {
  const marquee = el('div', 'hero-marquee');
  marquee.setAttribute('aria-hidden', 'true');
  const inner = el('div', 'hero-marquee-inner');
  const n = srcs.length;
  ROW_OFFSETS.forEach((offset) => {
    const row = el('div', 'marquee-row');
    /* each row walks the list from its offset and repeats it twice (seamless -50% loop) */
    for (let k = 0; k < n * 2; k += 1) {
      const tile = el('div', 'hero-tile');
      tile.style.backgroundImage = cssUrl(srcs[(offset + k) % n]);
      row.append(tile);
    }
    inner.append(row);
  });
  marquee.append(inner);
  return marquee;
}

/** Classifies the paragraphs of one offer cell (with or without promo). */
function readOffer(cell) {
  if (!cell) return null;
  const ps = [...cell.querySelectorAll(':scope > p')];
  const priceIdx = ps.findIndex((p) => p.querySelector('strong'));
  const out = {
    badge: null, price: null, year: null, note: null,
  };
  if (priceIdx < 0) return out;
  out.price = ps[priceIdx];
  if (priceIdx > 0) out.badge = ps[priceIdx - 1];
  const rest = ps.slice(priceIdx + 1);
  if (rest.length) out.note = rest.pop();
  if (rest.length) [out.year] = rest;
  return out;
}

function buildYear(p, variant) {
  const year = el('p', `offer-year ${variant}`);
  const s = p.querySelector('s');
  if (s) {
    year.append(el('span', '', splitAround(p, s).before.trim()), el('s', '', s.textContent.trim()));
  } else {
    year.append(el('span', '', p.textContent.trim()));
  }
  return year;
}

/* Prototype script 6: card tilt following the pointer over the whole hero */
function bindTilt(zone, card) {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const MAX = 6; /* grados de inclinación máxima */
  const target = { x: 0, y: 0 };
  const cur = { x: 0, y: 0 };
  let raf = null;
  function frame() {
    cur.x += (target.x - cur.x) * 0.12; /* suavizado: la card «persigue» al puntero */
    cur.y += (target.y - cur.y) * 0.12;
    card.style.setProperty('--ry', `${(cur.x * MAX).toFixed(2)}deg`);
    card.style.setProperty('--rx', `${(-cur.y * MAX).toFixed(2)}deg`);
    card.style.setProperty('--mx', `${((cur.x + 1) * 50).toFixed(1)}%`);
    card.style.setProperty('--my', `${((cur.y + 1) * 50).toFixed(1)}%`);
    const moving = Math.abs(target.x - cur.x) > 0.002 || Math.abs(target.y - cur.y) > 0.002;
    raf = moving ? requestAnimationFrame(frame) : null;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  function clamp(v) { return Math.max(-1, Math.min(1, v)); }
  zone.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    target.x = clamp((e.clientX - (r.left + r.width / 2)) / (r.width * 0.9));
    target.y = clamp((e.clientY - (r.top + r.height / 2)) / (r.height * 0.9));
    kick();
  });
  zone.addEventListener('pointerleave', () => {
    target.x = 0;
    target.y = 0;
    kick();
  });
}

export default function decorate(block) {
  const rows = [...block.children];
  const mosaicRow = rows.find((r) => r.querySelectorAll('img').length > 1);
  const copyRow = rows.find((r) => r.querySelector('h1, h2'));
  const offerRow = rows.find((r) => r !== mosaicRow && r !== copyRow && r.querySelector('strong'));
  const ctaRow = rows.find((r) => r !== mosaicRow && r !== copyRow && r !== offerRow && r.querySelector('a'));

  const srcs = mosaicRow ? [...mosaicRow.querySelectorAll('img')].map((img) => getImageSrc(img)) : [];

  /* copy: h1 + lede */
  const copy = el('div', 'hero-copy');
  if (copyRow) {
    const heading = copyRow.querySelector('h1, h2');
    heading.removeAttribute('id');
    copy.append(heading);
    copyRow.querySelectorAll('p').forEach((p) => {
      p.className = 'lede';
      copy.append(p);
    });
  }

  /* offer card: both prices (promo / no promo), CSS decides which one shows */
  const side = el('div', 'hero-side');
  side.dataset.delay = '280';
  const offer = el('div', 'offer');
  const cells = offerRow ? [...offerRow.children] : [];
  const promo = cells.length > 1 ? readOffer(cells[0]) : null;
  const regular = readOffer(cells.length > 1 ? cells[1] : cells[0]);

  if (promo && promo.badge) offer.append(el('span', 'offer-badge promo-only', promo.badge.textContent.trim()));
  const priceSource = (promo && promo.price) || (regular && regular.price);
  if (priceSource) {
    const strongSrc = priceSource.querySelector('strong');
    const { before, after } = splitAround(priceSource, strongSrc);
    const price = el('p', 'offer-price');
    price.append(el('span', 'offer-solo', before.trim()));
    if (promo && promo.price) price.append(el('strong', 'promo-only', promo.price.querySelector('strong').textContent.trim()));
    if (regular && regular.price) {
      price.append(el('strong', promo ? 'no-promo' : '', regular.price.querySelector('strong').textContent.trim()));
    }
    price.append(el('span', 'offer-unit', after.trim()));
    offer.append(price);
  }
  if (promo && promo.year) offer.append(buildYear(promo.year, 'promo-only'));
  if (regular && regular.year) offer.append(buildYear(regular.year, promo ? 'no-promo' : ''));
  if (ctaRow) offer.append(buildCta(ctaRow.querySelector('a'), 'btn primary'));
  if (promo && promo.note) offer.append(el('p', 'offer-note promo-only', promo.note.textContent.trim()));
  if (regular && regular.note) offer.append(el('p', `offer-note${promo ? ' no-promo' : ''}`, regular.note.textContent.trim()));
  side.append(offer);

  const inner = el('div', 'hero-inner container');
  const grid = el('div', 'hero-grid');
  grid.append(copy, side);
  inner.append(grid);

  block.replaceChildren(...(srcs.length ? [buildMarquee(srcs)] : []), inner);

  observeRevealGroup(copy);
  observeRevealGroup(side);
  bindTilt(block, offer);
}
