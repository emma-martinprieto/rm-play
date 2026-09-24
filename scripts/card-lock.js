/**
 * Locked cards (prototype script 5), shared by cards (ranking) and tabs (categories).
 * Tapping a card with a .tag — or any .tile, exactly as the prototype code does —
 * locks it in place with a veil + lock + CTA. Only one card locked at a time;
 * click outside / Escape closes it (Escape returns focus to the card).
 */

const LOCK = '<svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>';

let documentBound = false;

function closeAll(except) {
  document.querySelectorAll('.card.is-locked').forEach((c) => {
    if (c === except) return;
    c.classList.remove('is-locked');
    c.querySelector('.card-open').setAttribute('aria-expanded', 'false');
  });
}

function bindDocument() {
  if (documentBound) return;
  documentBound = true;
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.card.is-locked')) closeAll(null);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const c = document.querySelector('.card.is-locked');
    if (!c) return;
    closeAll(null);
    c.querySelector('.card-open').focus();
  });
}

// eslint-disable-next-line import/prefer-default-export
export function registerLockableCard(card) {
  if (!card.querySelector('.tag') && !card.classList.contains('tile')) return;
  bindDocument();
  const title = card.querySelector('h3').textContent.replace(/^\d+\.\s*/, '');
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'card-open';
  open.setAttribute('aria-label', `Ver ${title}`);
  open.setAttribute('aria-expanded', 'false');
  const lock = document.createElement('div');
  lock.className = 'lock';
  lock.innerHTML = `<span class="lock-icon" aria-hidden="true">${LOCK}</span>`
    + '<p>Disponible con Madridista Premium</p>'
    + '<button type="button" class="btn">Hazte Madridista Premium</button>';
  card.querySelector('.thumb').appendChild(lock);
  card.appendChild(open);
  open.addEventListener('click', () => {
    const on = !card.classList.contains('is-locked');
    closeAll(card);
    card.classList.toggle('is-locked', on);
    open.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on) lock.querySelector('.btn').focus({ preventScroll: true });
  });
  lock.addEventListener('click', (e) => {
    if (e.target === lock) closeAll(null);
  });
}
