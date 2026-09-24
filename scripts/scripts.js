import {
  loadHeader,
  loadFooter,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
  buildBlock,
  getMetadata,
  readBlockConfig,
  toClassName,
} from './aem.js';
import { getImageSrc, cssUrl } from './utils.js';

if (window.trustedTypes && window.trustedTypes.createPolicy) {
  const innerTT = window.trustedTypes.createPolicy('tt-inner', {
    createHTML: (s) => s, // avoid stack overflow
  });

  window.trustedTypes.createPolicy('default', {
    createHTML: (input, type, sink) => {
      let processedInput = input;
      if (/srcdoc\s*=/i.test(processedInput)) {
        const doc = new DOMParser().parseFromString(innerTT.createHTML(processedInput), 'text/html');
        doc.querySelectorAll('iframe[srcdoc]').forEach((el) => el.removeAttribute('srcdoc'));
        processedInput = doc.body.innerHTML;
      }
      if (sink.includes('createContextualFragment') || sink.includes('Document write')) {
        const doc = new DOMParser().parseFromString(innerTT.createHTML(processedInput), 'text/html');
        doc.querySelectorAll('script').forEach((el) => el.remove());
        processedInput = doc.body.innerHTML;
      }
      return processedInput;
    },
    createScriptURL: (input) => input,
    createScript: (input) => input,
  });
}

/*
 * Fonts: the prototype ships no font files. The declared stack
 * ("RM Neue","Inter",-apple-system,…) is used as-is, so no fonts.css is loaded.
 */

/**
 * Local-preview fallback: the aem.live pipeline turns the page `metadata` table
 * into <meta> tags, but `aem up --html-folder` serves it as a block. Emulate the
 * pipeline (only when the table is still in the DOM) and drop the table.
 * @param {Element} main The main element
 */
function applyInlineMetadata(main) {
  main.querySelectorAll(':scope > div > .metadata').forEach((block) => {
    const config = readBlockConfig(block);
    Object.entries(config).forEach(([key, value]) => {
      const val = Array.isArray(value) ? value.join(', ') : value;
      if (key === 'title') {
        document.title = val;
        return;
      }
      if (!document.head.querySelector(`meta[name="${key}"]`)) {
        const meta = document.createElement('meta');
        meta.name = key;
        meta.content = val;
        document.head.append(meta);
      }
    });
    const parent = block.parentElement;
    block.remove();
    if (!parent.children.length) parent.remove();
  });
}

/**
 * Applies section-metadata (Style → classes, Background → inline background
 * image, other keys → data attributes). The stripped aem.js does not do it.
 * @param {Element} main The main element
 */
function decorateSectionMetadata(main) {
  main.querySelectorAll(':scope > .section > div > .section-metadata').forEach((sm) => {
    const section = sm.closest('.section');
    [...sm.children].forEach((row) => {
      const [keyCell, valueCell] = row.children;
      if (!keyCell || !valueCell) return;
      const key = toClassName(keyCell.textContent);
      if (key === 'style') {
        valueCell.textContent.split(',').map((s) => toClassName(s.trim())).filter(Boolean)
          .forEach((c) => section.classList.add(c));
      } else if (key === 'background') {
        const src = getImageSrc(valueCell);
        if (src) {
          section.dataset.background = src;
          section.style.backgroundImage = cssUrl(src);
        }
      } else {
        section.dataset[key.replace(/-([a-z])/g, (g) => g[1].toUpperCase())] = valueCell.textContent.trim();
      }
    });
    const wrapper = sm.parentElement;
    sm.remove();
    if (!wrapper.children.length) wrapper.remove();
  });
  /* In production aem.live already applies section-metadata server-side:
     the table is gone and the section arrives with data-background. The
     query (?width=750…) is dropped to keep the original image, as locally. */
  main.querySelectorAll(':scope > .section[data-background]').forEach((section) => {
    if (!section.style.backgroundImage) {
      section.style.backgroundImage = cssUrl(section.dataset.background.split('?')[0]);
    }
  });
}

/**
 * DA stores the authored strikethrough <s> as <del>; restore <s> so the
 * blocks and the CSS ported from the prototype keep matching it.
 * @param {Element} main The main element
 */
function restoreStrikethrough(main) {
  main.querySelectorAll('del').forEach((del) => {
    const s = document.createElement('s');
    s.append(...del.childNodes);
    del.replaceWith(s);
  });
}

/**
 * Turns `/widgets/...` links into widget blocks.
 * @param {Element} main The container element
 */
function buildWidgetAutoBlocks(main) {
  const widgetLinks = [...main.querySelectorAll('a[href*="/widgets/"]')];
  widgetLinks.forEach((link) => {
    if (link.closest('.widget')) return;
    const newLink = link.cloneNode(true);
    const widgetBlock = buildBlock('widget', { elems: [newLink] });
    const p = link.closest('p');
    if (
      p
      && p.querySelectorAll('a').length === 1
      && p.querySelector('a') === link
      && p.textContent.trim() === link.textContent.trim()
    ) {
      p.replaceWith(widgetBlock);
    } else {
      link.replaceWith(widgetBlock);
    }
  });
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    // auto load `*/fragments/*` references
    const fragments = [...main.querySelectorAll('a[href*="/fragments/"]')].filter((f) => !f.closest('.fragment'));
    if (fragments.length > 0) {
      // eslint-disable-next-line import/no-cycle
      import('../blocks/fragment/fragment.js').then(({ loadFragment }) => {
        fragments.forEach(async (fragment) => {
          try {
            const { pathname } = new URL(fragment.href);
            const frag = await loadFragment(pathname);
            fragment.parentElement.replaceWith(...frag.children);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Fragment loading failed', error);
          }
        });
      });
    }
    buildWidgetAutoBlocks(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates formatted links to style them as buttons.
 * @param {HTMLElement} main The main container element
 */
function decorateButtons(main) {
  main.querySelectorAll('p a[href]').forEach((a) => {
    a.title = a.title || a.textContent;
    const p = a.closest('p');
    const text = a.textContent.trim();

    // quick structural checks
    if (a.querySelector('img') || p.textContent.trim() !== text) return;

    // skip URL display links
    try {
      if (new URL(a.href).href === new URL(text, window.location).href) return;
    } catch { /* continue */ }

    // require authored formatting for buttonization
    const strong = a.closest('strong');
    const em = a.closest('em');
    if (!strong && !em) return;

    p.className = 'button-wrapper';
    a.className = 'button';
    if (strong && em) { // high-impact call-to-action
      a.classList.add('accent');
      const outer = strong.contains(em) ? strong : em;
      outer.replaceWith(a);
    } else if (strong) {
      a.classList.add('primary');
      strong.replaceWith(a);
    } else {
      a.classList.add('secondary');
      em.replaceWith(a);
    }
  });
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  restoreStrikethrough(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateSectionMetadata(main);
  decorateBlocks(main);
  decorateButtons(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'es';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) applyInlineMetadata(main);
  /* Promo switch: prototype body[data-promo="on"], driven here by the `Promo` metadata */
  if (getMetadata('promo') === 'on') document.body.dataset.promo = 'on';
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  loadHeader(doc.querySelector('body > header'));

  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadFooter(doc.querySelector('body > footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  import('./consent-check.js');
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
