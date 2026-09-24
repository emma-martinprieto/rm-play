import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

function footerPath() {
  const footerMeta = getMetadata('footer');
  if (footerMeta) return new URL(footerMeta, window.location).pathname;
  return window.location.pathname.startsWith('/drafts/') ? '/drafts/footer' : '/footer';
}

function externalLink(a, className) {
  const link = document.createElement('a');
  if (className) link.className = className;
  link.href = a.getAttribute('href');
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = a.textContent.trim();
  return link;
}

/**
 * loads and decorates the footer (fragment /footer, /drafts/footer in local preview)
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const fragment = await loadFragment(footerPath());
  block.textContent = '';
  if (!fragment) return;

  const inner = document.createElement('div');
  inner.className = 'container footer-inner';

  const list = fragment.querySelector('ul');
  const paragraphs = [...fragment.querySelectorAll('p')];
  const sponsorsP = paragraphs.find((p) => p.querySelector('a'));
  const copyP = paragraphs.filter((p) => !p.querySelector('a')).pop();

  if (sponsorsP) inner.append(externalLink(sponsorsP.querySelector('a'), 'footer-sponsors'));
  if (list) {
    const ul = document.createElement('ul');
    ul.className = 'footer-links';
    list.querySelectorAll(':scope > li').forEach((li) => {
      const a = li.querySelector('a');
      if (!a) return;
      const item = document.createElement('li');
      item.append(externalLink(a));
      ul.append(item);
    });
    inner.append(ul);
  }
  if (copyP) {
    const copy = document.createElement('p');
    copy.className = 'footer-copy';
    copy.textContent = copyP.textContent.trim();
    inner.append(copy);
  }
  block.append(inner);
}
