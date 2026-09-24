import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import { getImageSrc, cssUrl } from '../../scripts/utils.js';

const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>';

function navPath() {
  const navMeta = getMetadata('nav');
  if (navMeta) return new URL(navMeta, window.location).pathname;
  return window.location.pathname.startsWith('/drafts/') ? '/drafts/nav' : '/nav';
}

/** Reads the authored languages: `<li><a>ES</a> Español</li>` → { code, name, href } */
function readLanguages(list) {
  return [...list.querySelectorAll(':scope > li')].map((li) => {
    const a = li.querySelector('a');
    const code = (a ? a.textContent : li.textContent).trim();
    const name = li.textContent.replace(code, '').trim() || code;
    return { code, name, href: a ? a.getAttribute('href') || '#' : '#' };
  }).filter((l) => l.code);
}

function buildLang(langs) {
  const nav = document.createElement('nav');
  nav.className = 'lang';
  nav.setAttribute('aria-label', 'Idioma');

  const toggle = document.createElement('div');
  toggle.className = 'lang-toggle';
  langs.forEach((l, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'lang-sep';
      sep.setAttribute('aria-hidden', 'true');
      toggle.append(sep);
    }
    const a = document.createElement('a');
    a.href = l.href;
    a.lang = l.code.toLowerCase();
    if (i === 0) a.setAttribute('aria-current', 'true');
    else a.hreflang = l.code.toLowerCase();
    a.textContent = l.code;
    toggle.append(a);
  });

  const select = document.createElement('div');
  select.className = 'lang-select';
  const btn = document.createElement('button');
  btn.className = 'lang-btn';
  btn.type = 'button';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-label', `Idioma: ${langs[0].name}`);
  btn.innerHTML = `<span class="lang-current">${langs[0].code}</span>${CHEVRON}`;
  const menu = document.createElement('ul');
  menu.className = 'lang-menu';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', 'Idioma');
  menu.hidden = true;
  langs.forEach((l, i) => {
    const li = document.createElement('li');
    const o = document.createElement('button');
    o.type = 'button';
    o.setAttribute('role', 'option');
    o.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    o.lang = l.code.toLowerCase();
    o.dataset.lang = l.code.toLowerCase();
    o.dataset.name = l.name;
    o.textContent = l.name;
    const code = document.createElement('span');
    code.className = 'lang-code';
    code.textContent = l.code;
    o.append(code);
    li.append(o);
    menu.append(li);
  });
  select.append(btn, menu);
  nav.append(toggle, select);
  return nav;
}

/* Prototype script 8 — maqueta: sólo marca el idioma elegido, no navega */
function bindLang(nav) {
  const links = nav.querySelectorAll('.lang-toggle a');
  const btn = nav.querySelector('.lang-btn');
  const menu = nav.querySelector('.lang-menu');
  const options = menu ? menu.querySelectorAll('[role="option"]') : [];
  const current = btn ? btn.querySelector('.lang-current') : null;

  function set(l) {
    links.forEach((a) => { a.setAttribute('aria-current', a.lang === l ? 'true' : 'false'); });
    options.forEach((o) => {
      const on = o.dataset.lang === l;
      o.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on && current) {
        current.textContent = l.toUpperCase();
        btn.setAttribute('aria-label', `Idioma: ${o.dataset.name}`);
      }
    });
  }
  function open() {
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    options[0].focus();
  }
  function close(focusBtn) {
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    if (focusBtn) btn.focus();
  }

  links.forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      set(a.lang);
    });
  });

  if (btn && menu) {
    btn.addEventListener('click', () => {
      if (menu.hidden) open();
      else close(false);
    });
    options.forEach((o) => {
      o.addEventListener('click', () => {
        set(o.dataset.lang);
        close(true);
      });
    });
    document.addEventListener('click', (e) => {
      if (!menu.hidden && !e.target.closest('.lang-select')) close(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !menu.hidden) close(true);
    });
  }
}

/**
 * loads and decorates the header (fragment /nav, /drafts/nav in local preview)
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  const fragment = await loadFragment(navPath());
  block.textContent = '';
  if (!fragment) return;

  const brandLink = fragment.querySelector('a:has(img), a:has(picture)') || fragment.querySelector('a');
  const img = fragment.querySelector('img');
  const brand = document.createElement('a');
  brand.className = 'brandmark';
  brand.href = brandLink ? brandLink.getAttribute('href') || '#' : '#';
  brand.setAttribute('aria-label', (img && img.alt) || (brandLink && brandLink.textContent.trim()) || 'Madridistas');
  const src = getImageSrc(img);
  if (src) brand.style.backgroundImage = cssUrl(src);
  block.append(brand);

  const list = fragment.querySelector('ul');
  const langs = list ? readLanguages(list) : [];
  if (langs.length) {
    const nav = buildLang(langs);
    block.append(nav);
    bindLang(nav);
  }
}
