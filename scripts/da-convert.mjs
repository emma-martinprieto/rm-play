/**
 * Convierte el HTML "canónico" (divs, salida ya renderizada de EDS, tal
 * como vive en drafts/*.plain.html) al formato de AUTORÍA de DA:
 *   - cada bloque -> <table> con la primera fila = nombre del bloque
 *   - cada sección de nivel superior separada por <hr>
 *   - contenido por defecto (p, h1-6, ul, ol, picture...) se deja igual
 *
 * PLANTILLA GENERAL — no editar las copias instaladas en cada proyecto
 * directamente; edita esta y reinstala con scripts/da-sync/install.mjs.
 *
 * Ver aem-edge-delivery-services:da-content, references/html-content.md §3.
 */
import { parse } from 'node-html-parser';

/** "section-metadata" -> "Section Metadata", "hero" -> "Hero" (inverso de toBlockCSSClassNames) */
function humanizeBlockName(kebabName) {
  return kebabName
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function blockHeaderText(el) {
  const classes = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean);
  if (classes.length === 0) return null;
  const [name, ...variants] = classes;
  const header = humanizeBlockName(name);
  return variants.length ? `${header} (${variants.join(', ')})` : header;
}

/** true si `el` es un div de bloque: un <div> con class= en la forma canónica */
function isBlockDiv(el) {
  return el.tagName === 'DIV' && !!(el.getAttribute('class') || '').trim();
}

function blockDivToTable(blockEl) {
  const header = blockHeaderText(blockEl);
  const rowDivs = blockEl.childNodes.filter((n) => n.tagName === 'DIV');

  // Bloque de una sola celda escrito "plano" (sin divs de fila/celda anidados,
  // ej. <div class="embed"><p><a>...</a></p></div>) -> todo el contenido es la
  // única celda, en vez de generar una tabla vacía.
  if (rowDivs.length === 0) {
    return `<table>\n<tr><td>${header}</td></tr>\n<tr><td>${blockEl.innerHTML.trim()}</td></tr>\n</table>`;
  }

  const rows = rowDivs.map((rowDiv) => rowDiv.childNodes.filter((n) => n.tagName === 'DIV'));
  const maxCols = rows.reduce((max, cells) => Math.max(max, cells.length), 1);
  const colspanAttr = maxCols > 1 ? ` colspan="${maxCols}"` : '';

  const bodyRows = rows
    .map((cells) => {
      const tds = cells.map((cell) => `<td>${cell.innerHTML.trim()}</td>`).join('');
      return `<tr>${tds}</tr>`;
    })
    .join('\n');

  return `<table>\n<tr><td${colspanAttr}>${header}</td></tr>\n${bodyRows}\n</table>`;
}

/**
 * @param {string} html fragmento body de drafts/*.plain.html (secciones = divs de nivel superior)
 * @returns {string} fragmento listo para PUT a admin.da.live (tablas + <hr> entre secciones)
 */
export function toDaAuthoringFormat(html) {
  const root = parse(html, { comment: false });
  const sections = root.childNodes.filter((n) => n.tagName === 'DIV');

  const rendered = sections.map((section) => {
    const parts = section.childNodes
      .filter((n) => n.nodeType === 1) // elementos, no texto/espacios
      .map((child) => (isBlockDiv(child) ? blockDivToTable(child) : child.outerHTML.trim()));
    return parts.join('\n\n');
  });

  return rendered.join('\n\n<hr>\n\n');
}
