import {
  getImageSrc, cssUrl, buildCta, splitAround,
} from '../../scripts/utils.js';

/*
 * Final banner (prototype html:L992-1005). No animation on purpose (spec §3.6).
 * Rows: background image | eyebrow + h2 | offer (promo | no promo) | CTA
 */

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function readOffer(cell) {
  const ps = cell ? [...cell.querySelectorAll(':scope > p')] : [];
  const idx = ps.findIndex((p) => p.querySelector('strong'));
  if (idx < 0) return null;
  return {
    promo: idx > 0 ? ps[idx - 1] : null,
    price: ps[idx],
    month: ps[idx + 1] || null,
  };
}

export default function decorate(block) {
  const rows = [...block.children];
  const bgRow = rows.find((r) => r.querySelector('img') && !r.querySelector('h1, h2, h3'));
  const copyRow = rows.find((r) => r.querySelector('h1, h2, h3'));
  const offerRow = rows.find((r) => r.querySelector('strong'));
  const ctaRow = rows.find((r) => r !== offerRow && r !== copyRow && r.querySelector('a'));

  const banner = el('div', 'banner');
  const src = getImageSrc(bgRow);
  if (src) banner.style.backgroundImage = cssUrl(src);

  const copy = el('div', 'banner-copy');
  if (copyRow) {
    const heading = copyRow.querySelector('h1, h2, h3');
    const eyebrow = [...copyRow.querySelectorAll('p')].find((p) => p.textContent.trim());
    if (eyebrow) copy.append(el('span', 'eyebrow', eyebrow.textContent.trim()));
    copy.append(el('h2', '', heading.textContent.trim()));
  }

  const offerEl = el('div', 'banner-offer');
  const cells = offerRow ? [...offerRow.children] : [];
  const promo = cells.length > 1 ? readOffer(cells[0]) : null;
  const regular = readOffer(cells.length > 1 ? cells[1] : cells[0]);
  if (promo && promo.promo) offerEl.append(el('p', 'banner-promo promo-only', promo.promo.textContent.trim()));
  const priceSrc = (promo && promo.price) || (regular && regular.price);
  if (priceSrc) {
    const price = el('p', 'banner-price');
    if (promo && promo.price) price.append(el('strong', 'promo-only', promo.price.querySelector('strong').textContent.trim()));
    if (regular && regular.price) {
      price.append(el('strong', promo ? 'no-promo' : '', regular.price.querySelector('strong').textContent.trim()));
    }
    /* the span keeps the text after <strong> with its leading space: " / año" */
    price.append(el('span', '', splitAround(priceSrc, priceSrc.querySelector('strong')).after));
    offerEl.append(price);
  }
  if (promo && promo.month) offerEl.append(el('p', 'banner-month promo-only', promo.month.textContent.trim()));
  if (regular && regular.month) offerEl.append(el('p', `banner-month${promo ? ' no-promo' : ''}`, regular.month.textContent.trim()));
  if (ctaRow) offerEl.append(buildCta(ctaRow.querySelector('a'), 'btn'));

  banner.append(copy, offerEl);
  block.replaceChildren(banner);
}
