/**
 * Shared decoration helpers for the rm-play blocks.
 * The prototype paints every image as a CSS background, so blocks read the
 * authored <img>/<picture> and apply its best source as an inline background.
 */

function widthOf(url) {
  const m = /[?&]width=(\d+)/.exec(url || '');
  return m ? Number(m[1]) : 0;
}

/**
 * Returns the widest available source of an authored image.
 * @param {Element} el an <img>, a <picture> or a container holding one
 * @returns {string} absolute URL ('' if none)
 */
export function getImageSrc(el) {
  if (!el) return '';
  const img = el.tagName === 'IMG' ? el : el.querySelector('img');
  if (!img) return '';
  const picture = img.closest('picture');
  const candidates = [];
  if (picture) {
    picture.querySelectorAll('source[srcset]').forEach((s) => {
      candidates.push(s.getAttribute('srcset').split(',')[0].trim().split(' ')[0]);
    });
  }
  candidates.push(img.getAttribute('src'));
  let best = candidates[candidates.length - 1];
  candidates.forEach((c) => {
    if (c && widthOf(c) > widthOf(best)) best = c;
  });
  try {
    /* authored src/srcset are relative to the document, not to the image itself */
    return new URL(best, img.baseURI || window.location.href).href;
  } catch (e) {
    return img.src;
  }
}

/** CSS url() value for an image source. */
export function cssUrl(src) {
  return `url("${src}")`;
}

/**
 * Builds a CTA the way the prototype renders it: CTAs without a destination
 * (href "#" or empty) become <button>; real destinations stay <a>.
 * @param {HTMLAnchorElement|null} link authored link
 * @param {string} className classes, e.g. 'btn primary'
 * @param {string} [type] button type attribute (only where the prototype sets it)
 * @returns {HTMLElement}
 */
export function buildCta(link, className, type) {
  const href = link ? (link.getAttribute('href') || '').trim() : '';
  const text = link ? link.textContent.trim() : '';
  let el;
  if (!href || href === '#') {
    el = document.createElement('button');
    if (type) el.type = type;
  } else {
    el = document.createElement('a');
    el.href = href;
  }
  el.className = className;
  el.textContent = text;
  return el;
}

/** Text of the nodes before / after a child element, inside a paragraph. */
export function splitAround(p, child) {
  let before = '';
  let after = '';
  let seen = false;
  p.childNodes.forEach((n) => {
    if (n === child) {
      seen = true;
      return;
    }
    if (seen) after += n.textContent;
    else before += n.textContent;
  });
  return { before, after };
}
