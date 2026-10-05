const COLAS = {
  '.hero': 'wl-rmplay-header',
  '.cards.ranking.poster': 'wl-rmplay-carrousel',
  'body > .sticky': 'wl-rmplay-sticky',
};

const DEFAULT_CAMPAIGN_ID = '970c1933-6906-4d2f-a676-81206a945813';
const EXTRA_PARAMS = ['ajo_action', 'ajo_journey', 'correlationId'];
const SSO_HOST = 'signin.realmadrid.com';
const INSERT_BEFORE = '&behalfClientId=';

const landing = new URLSearchParams(window.location.search);
const SELECTOR = Object.keys(COLAS).map((s) => `${s} a[href]`).join(', ');

function setParam(href, name, value, beforeMarker) {
  const pair = `${name}=${encodeURIComponent(value)}`;
  const re = new RegExp(`([?&])${name}=[^&]*`);
  if (re.test(href)) return href.replace(re, `$1${pair}`);
  const at = beforeMarker ? href.indexOf(beforeMarker) : -1;
  if (at >= 0) return `${href.slice(0, at)}&${pair}${href.slice(at)}`;
  return `${href}${href.includes('?') ? '&' : '?'}${pair}`;
}

function isSso(href) {
  try {
    return new URL(href, window.location.href).hostname === SSO_HOST;
  } catch (e) {
    return false;
  }
}

function tag(a) {
  const href = a.getAttribute('href');
  if (!href || !isSso(href)) return;
  const key = Object.keys(COLAS).find((s) => a.closest(s));
  if (!key) return;
  const cola = COLAS[key];
  const incoming = landing.get('campaignChannel');
  const id = landing.get('campaignId') || DEFAULT_CAMPAIGN_ID;
  let next = setParam(href, 'campaignId', id, INSERT_BEFORE);
  next = setParam(next, 'campaignChannel', incoming ? `${incoming}-${cola}` : cola, INSERT_BEFORE);
  EXTRA_PARAMS.forEach((name) => {
    const value = landing.get(name);
    if (value) next = setParam(next, name, value);
  });
  if (next !== href) a.setAttribute('href', next);
}

function scan(root) {
  if (root.matches?.(SELECTOR)) tag(root);
  root.querySelectorAll?.(SELECTOR).forEach(tag);
}

scan(document);
new MutationObserver((records) => {
  records.forEach((r) => {
    if (r.type === 'attributes') scan(r.target);
    else r.addedNodes.forEach((n) => { if (n.nodeType === 1) scan(n); });
  });
}).observe(document.documentElement, {
  childList: true, subtree: true, attributes: true, attributeFilter: ['href'],
});
