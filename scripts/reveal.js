/**
 * Global scroll-reveal system (prototype script 4c).
 * One normal IntersectionObserver and one "late" observer, shared by every block.
 * Each child of a group gets --d = (data-delay || 0) + min(i, 5) * (data-step || 80) ms.
 */

let io;
let ioLate;

function reveal(entries, obs) {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-in');
    obs.unobserve(entry.target);
  });
}

// eslint-disable-next-line import/prefer-default-export
export function observeRevealGroup(group) {
  if (!group) return;
  [...group.children].forEach((child, i) => {
    const step = parseInt(group.dataset.step || 80, 10);
    child.style.setProperty('--d', `${parseInt(group.dataset.delay || 0, 10) + Math.min(i, 5) * step}ms`);
  });
  if (!('IntersectionObserver' in window)) {
    group.classList.add('is-in');
    return;
  }
  if (!io) {
    io = new IntersectionObserver(reveal, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });
    /* «late»: espera a que el bloque esté bien dentro de la pantalla */
    ioLate = new IntersectionObserver(reveal, { threshold: 0.5, rootMargin: '0px 0px -20% 0px' });
  }
  (group.dataset.reveal === 'late' ? ioLate : io).observe(group);
}
