import {
  getImageSrc, cssUrl, buildCta, splitAround,
} from '../../scripts/utils.js';

/*
 * Promo lightbox (prototype html:L1007-1028, script 4b).
 * Rows: crest | eyebrow · h2 + sub · carnet · list · price · CTA · legal note.
 * The <dialog> is moved to <body> (as in the prototype) so the top layer/backdrop behave the same.
 */

const DELAY = 30000; /* 30 s after load, once per session */

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export default function decorate(block) {
  const rows = [...block.children];
  const imgRows = rows.filter((r) => r.querySelector('img'));
  const crestRow = imgRows[0];
  const carnetRow = imgRows[1];
  const titleRow = rows.find((r) => r.querySelector('h1, h2, h3'));
  const listRow = rows.find((r) => r.querySelector('ul, ol'));
  const priceRow = rows.find((r) => r.querySelector('strong'));
  const ctaRow = rows.find((r) => r.querySelector('a'));
  const used = [crestRow, carnetRow, titleRow, listRow, priceRow, ctaRow];
  const noteRow = rows.filter((r) => !used.includes(r) && r.textContent.trim()).pop();

  const dialog = el('dialog', 'promo-modal promo-only');
  dialog.id = 'promoModal';
  dialog.setAttribute('aria-labelledby', 'promoTitle');

  const form = el('form');
  form.method = 'dialog';
  const close = el('button', 'promo-close', '×');
  close.value = 'cerrar';
  close.setAttribute('aria-label', 'Cerrar');
  form.append(close);

  const box = el('div', 'promo-box');

  const top = el('div', 'promo-top');
  if (crestRow) {
    const img = crestRow.querySelector('img');
    const crest = el('span', 'promo-crest');
    crest.setAttribute('role', 'img');
    crest.setAttribute('aria-label', img.alt || '');
    crest.style.backgroundImage = cssUrl(getImageSrc(img));
    top.append(crest);
    const labelCell = [...crestRow.children].find((c) => !c.querySelector('img') && c.textContent.trim());
    if (labelCell) top.append(el('span', 'eyebrow', labelCell.textContent.trim()));
  }
  box.append(top);

  if (titleRow) {
    const h = titleRow.querySelector('h1, h2, h3');
    const h2 = el('h2', '', h.textContent.trim());
    h2.id = 'promoTitle';
    box.append(h2);
    const sub = [...titleRow.querySelectorAll('p')].find((p) => p.textContent.trim());
    if (sub) box.append(el('p', 'sub', sub.textContent.trim()));
  }

  if (carnetRow) {
    const img = carnetRow.querySelector('img');
    const carnet = el('div', 'promo-carnet');
    carnet.setAttribute('role', 'img');
    carnet.setAttribute('aria-label', img.alt || '');
    carnet.style.backgroundImage = cssUrl(getImageSrc(img));
    box.append(carnet);
  }

  if (listRow) {
    const ul = el('ul', 'promo-list');
    listRow.querySelectorAll('li').forEach((item) => {
      const li = el('li');
      /* «✓» is chrome painted by the prototype markup, not authored */
      li.append(el('span', 'ck', '✓'), document.createTextNode(' '), ...item.childNodes);
      ul.append(li);
    });
    box.append(ul);
  }

  if (priceRow) {
    const p = priceRow.querySelector('p') || priceRow;
    const strong = p.querySelector('strong');
    const s = p.querySelector('s');
    const price = el('p', 'promo-price');
    price.append(el('strong', '', strong.textContent.trim()));
    const middle = s ? splitAround(p, s).before : p.textContent;
    const between = middle.replace(strong.textContent, '').trim();
    if (between) price.append(el('span', '', between));
    if (s) price.append(el('s', '', s.textContent.trim()));
    box.append(price);
  }

  if (ctaRow) box.append(buildCta(ctaRow.querySelector('a'), 'btn dark', 'button'));
  if (noteRow) box.append(el('p', 'promo-note', noteRow.textContent.trim()));

  dialog.append(form, box);
  document.body.append(dialog);
  block.replaceChildren();

  /* Prototype script 4b */
  let yaVisto = false;
  try { yaVisto = sessionStorage.getItem('rmPromoVista') === '1'; } catch (e) { /* ignore */ }
  if (!yaVisto && document.body.dataset.promo === 'on' && typeof dialog.showModal === 'function') {
    /* EDS: the prototype starts counting when <body> is parsed; the block decorates later,
       so subtract the elapsed time to keep "30 s after load". */
    setTimeout(() => {
      if (dialog.open) return;
      dialog.showModal();
      try { sessionStorage.setItem('rmPromoVista', '1'); } catch (e) { /* ignore */ }
    }, Math.max(0, DELAY - performance.now()));
  }
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && dialog.open) dialog.close(); });
}
