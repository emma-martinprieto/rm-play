import { buildCta, splitAround } from '../../scripts/utils.js';

/*
 * Sticky CTA bar (prototype html:L1030-1037, script 3).
 * Rows: price (promo | no promo) · CTA (long link text + short label).
 * The bar is moved to <body> so position:fixed/z-index work as in the prototype.
 */

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function readCell(cell) {
  const ps = cell ? [...cell.querySelectorAll(':scope > p')] : [];
  const idx = ps.findIndex((p) => p.querySelector('strong'));
  if (idx < 0) return null;
  return { main: ps[idx], sub: ps[idx + 1] || null, off: ps[idx + 2] || null };
}

export default function decorate(block) {
  const rows = [...block.children];
  const priceRow = rows.find((r) => r.querySelector('strong'));
  const ctaRow = rows.find((r) => r !== priceRow && r.querySelector('a'));

  const bar = el('div', 'sticky');
  const priceWrap = el('div', 'sticky-price');
  const cells = priceRow ? [...priceRow.children] : [];
  const promo = cells.length > 1 ? readCell(cells[0]) : null;
  const regular = readCell(cells.length > 1 ? cells[1] : cells[0]);

  const mainSrc = (promo && promo.main) || (regular && regular.main);
  if (mainSrc) {
    const { before, after } = splitAround(mainSrc, mainSrc.querySelector('strong'));
    const main = el('p', 'sp-main');
    main.append(el('span', 'sp-solo', before.trim()));
    if (promo) main.append(el('strong', 'promo-only', promo.main.querySelector('strong').textContent.trim()));
    if (regular) main.append(el('strong', promo ? 'no-promo' : '', regular.main.querySelector('strong').textContent.trim()));
    main.append(el('span', 'sp-per', after.trim()));
    if (promo && promo.off) main.append(el('span', 'sp-off promo-only', promo.off.textContent.trim()));
    priceWrap.append(main);
  }
  if (promo && promo.sub) {
    const sub = el('p', 'sp-sub promo-only');
    sub.append(...promo.sub.childNodes);
    priceWrap.append(sub);
  }
  if (regular && regular.sub) {
    const sub = el('p', `sp-sub${promo ? ' no-promo' : ''}`);
    sub.append(...regular.sub.childNodes);
    priceWrap.append(sub);
  }
  bar.append(priceWrap);

  if (ctaRow) {
    const link = ctaRow.querySelector('a');
    const shortP = [...ctaRow.querySelectorAll('p')].find((p) => !p.querySelector('a') && p.textContent.trim());
    const btn = buildCta(link, 'btn primary');
    const long = el('span', 'label-long', link.textContent.trim());
    const short = el('span', 'label-short', shortP ? shortP.textContent.trim() : link.textContent.trim());
    btn.replaceChildren(long, short);
    bar.append(btn);
  }

  document.body.append(bar);
  block.replaceChildren();

  /* Prototype script 3: threshold computed once (not on resize) */
  const threshold = Math.min(window.innerHeight * 0.6, 420);
  function onScroll() {
    if (window.scrollY > threshold) bar.classList.add('is-visible');
    else bar.classList.remove('is-visible');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
