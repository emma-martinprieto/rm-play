#!/usr/bin/env node
/**
 * Sube documentos de drafts/*.plain.html a Document Authoring (da.live) y
 * dispara el preview en aem.page. PLANTILLA GENERAL — instalada en cada
 * proyecto de projects/<slug>/ vía scripts/da-sync/install.mjs. No editar
 * las copias instaladas directamente; edita esta plantilla y reinstala.
 *
 * Antes de subir el documento:
 *   1. Sube a DA cualquier imagen local referenciada (./images/xxx.jpg,
 *      ../images/xxx.jpg) a la carpeta OCULTA propia de ese documento
 *      (ej. "el-centro/.informacion-del-centro/xxx.jpg", igual que hace
 *      el editor de da.live cuando arrastras/pegas una imagen a mano) y
 *      reescribe su <img src> / <source srcset> / <a href> a la URL
 *      pública de content.da.live — las rutas relativas no son
 *      alcanzables por el preview de EDS y producen <img src="about:error">.
 *   2. Convierte los divs de bloque canónicos a formato TABLA (primera
 *      fila = nombre del bloque) y separa las secciones con <hr>, que es
 *      como DA muestra bloques y saltos de sección en su editor.
 *
 * DA guarda el contenido como HTML fragment por debajo, pero el editor de
 * da.live lo abre como un documento de texto tipo Word — nunca se suben
 * <style>/<link> aquí; el CSS lo sirve el Code Bus del proyecto ya publicado.
 *
 * ORG/REPO de DA: se detectan automáticamente del remoto "origin" de este
 * proyecto (github.com/{org}/{repo}.git). Si el org/repo de da.live es
 * distinto del de GitHub, fíjalos a mano con DA_ORG / DA_REPO en .env.
 *
 * Uso:
 *   node scripts/da-push.mjs                     # sube TODOS los drafts/*.plain.html
 *   node scripts/da-push.mjs drafts/index.plain.html drafts/nav.plain.html
 *                                                 # sube solo los indicados
 *
 * Requiere DA_TOKEN en el entorno o en un .env en la raíz del proyecto.
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse } from 'node-html-parser';
import { toDaAuthoringFormat } from './da-convert.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DRAFTS_DIR = path.join(ROOT, 'drafts');

function loadEnvFile() {
  const envPath = path.join(ROOT, '.env');
  const vars = {};
  if (existsSync(envPath)) {
    const raw = readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) vars[m[1]] = m[2].trim();
    }
  }
  return vars;
}

/** Detecta {org, repo} del remoto "origin" en .git/config (github.com/{org}/{repo}.git) */
function detectOrgRepoFromGit() {
  const gitConfigPath = path.join(ROOT, '.git', 'config');
  if (!existsSync(gitConfigPath)) return {};
  const raw = readFileSync(gitConfigPath, 'utf8');
  const m = raw.match(/url\s*=\s*.*github\.com[/:]([^/]+)\/([^/.\s]+)(?:\.git)?/i);
  if (!m) return {};
  return { org: m[1], repo: m[2] };
}

const envVars = loadEnvFile();
const detected = detectOrgRepoFromGit();

const ORG = process.env.DA_ORG || envVars.DA_ORG || detected.org;
const REPO = process.env.DA_REPO || envVars.DA_REPO || detected.repo;
const BRANCH = process.env.DA_BRANCH || envVars.DA_BRANCH || 'main';

if (!ORG || !REPO) {
  console.error('[da-push] No se pudo determinar ORG/REPO de DA (ni detectado del remoto git, ni en DA_ORG/DA_REPO). Añádelos a .env.');
  process.exit(1);
}

// Carpetas dentro de drafts/ que NO se suben como documentos (artefactos auxiliares).
const EXCLUDED_DIRS = new Set(['da-paste', 'images']);

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

function loadEnvToken() {
  if (process.env.DA_TOKEN) return process.env.DA_TOKEN;
  if (envVars.DA_TOKEN) return envVars.DA_TOKEN;
  return null;
}

async function collectAllDrafts(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      files = files.concat(await collectAllDrafts(path.join(dir, entry.name), base));
    } else if (entry.name.endsWith('.plain.html')) {
      files.push(path.relative(base, path.join(dir, entry.name)));
    }
  }
  return files;
}

/** drafts/el-centro/informacion-del-centro.plain.html -> el-centro/informacion-del-centro.html */
function toDaPath(relDraftPath) {
  return relDraftPath.replace(/\.plain\.html$/, '.html').replace(/\\/g, '/');
}

async function putToDaSource(token, daPath, bytes, mimeType, fileName) {
  const form = new FormData();
  form.append('data', new Blob([bytes], { type: mimeType }), fileName);
  const url = `https://admin.da.live/source/${ORG}/${REPO}/${daPath}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`PUT ${daPath} -> ${res.status} ${await res.text()}`);
  }
  return `https://content.da.live/${ORG}/${REPO}/${daPath}`;
}

/** "el-centro/informacion-del-centro" -> "el-centro/.informacion-del-centro" (carpeta oculta hermana del documento) */
function dotFolderFor(daPathNoExt) {
  const dir = path.posix.dirname(daPathNoExt);
  const base = path.posix.basename(daPathNoExt);
  return dir === '.' ? `.${base}` : `${dir}/.${base}`;
}

/**
 * Sube a DA (a la carpeta oculta del documento, ej. "index/.index/") cualquier
 * imagen local referenciada (img[src], source[srcset], a[href] bajo
 * drafts/images/) y reescribe el html para que apunten a su URL pública en
 * content.da.live. Igual que arrastrar/pegar una imagen a mano en el editor
 * de da.live — no se ve como carpeta separada al navegar por DA.
 */
async function inlineLocalImages(token, html, draftFileDir, daPathNoExt, uploadedCache) {
  const root = parse(html);
  const attrsToCheck = [
    ['img', 'src'],
    ['source', 'srcset'],
    ['a', 'href'],
  ];

  const localRefs = [];
  for (const [tag, attr] of attrsToCheck) {
    for (const el of root.querySelectorAll(tag)) {
      const val = el.getAttribute(attr);
      if (!val || /^https?:\/\//i.test(val) || /^data:/i.test(val)) continue;
      const ext = path.extname(val).toLowerCase();
      if (!MIME_BY_EXT[ext]) continue; // solo tocamos imágenes conocidas
      localRefs.push({ el, attr, val });
    }
  }

  const dotFolder = dotFolderFor(daPathNoExt);
  for (const ref of localRefs) {
    const absPath = path.resolve(draftFileDir, ref.val);
    if (!existsSync(absPath)) {
      console.warn(`[da-push]   ! imagen no encontrada localmente: ${ref.val} (${absPath})`);
      continue;
    }
    const fileName = path.basename(absPath);
    const cacheKey = `${dotFolder}/${fileName}`;
    if (!uploadedCache.has(cacheKey)) {
      const ext = path.extname(fileName).toLowerCase();
      const bytes = await readFile(absPath);
      const daImagePath = `${dotFolder}/${fileName}`;
      const publicUrl = await putToDaSource(token, daImagePath, bytes, MIME_BY_EXT[ext], fileName);
      uploadedCache.set(cacheKey, publicUrl);
      console.log(`[da-push]   ↑ imagen subida: ${fileName}`);
    }
    ref.el.setAttribute(ref.attr, uploadedCache.get(cacheKey));
  }

  return root.toString();
}

async function uploadOne(token, relDraftPath, uploadedImageCache) {
  const daPath = toDaPath(relDraftPath);
  const absPath = path.join(DRAFTS_DIR, relDraftPath);
  const draftFileDir = path.dirname(absPath);
  let html = await readFile(absPath, 'utf8');
  const daPathNoExt = daPath.replace(/\.html$/, '');

  html = await inlineLocalImages(token, html, draftFileDir, daPathNoExt, uploadedImageCache);
  const daHtml = toDaAuthoringFormat(html);

  await putToDaSource(token, daPath, Buffer.from(daHtml, 'utf8'), 'text/html', path.basename(daPath));

  const previewUrl = `https://admin.hlx.page/preview/${ORG}/${REPO}/${BRANCH}/${daPathNoExt}`;
  const previewRes = await fetch(previewUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!previewRes.ok) {
    throw new Error(`preview ${daPathNoExt} -> ${previewRes.status} ${await previewRes.text()}`);
  }

  return `${BRANCH}--${REPO}--${ORG}.aem.page/${daPathNoExt === 'index' ? '' : daPathNoExt}`;
}

export async function pushDrafts(relDraftPaths) {
  const token = loadEnvToken();
  if (!token) {
    console.error('[da-push] DA_TOKEN no encontrado (ni en el entorno ni en .env). Ejecuta la skill da-auth.');
    return { failures: 1, results: [] };
  }

  let targets = relDraftPaths;
  if (!targets || targets.length === 0) {
    targets = await collectAllDrafts(DRAFTS_DIR);
  } else {
    targets = targets
      .map((p) => path.relative(DRAFTS_DIR, path.resolve(ROOT, p)))
      .filter((p) => p.endsWith('.plain.html') && !p.startsWith('..'))
      .filter((p) => !p.split(path.sep).some((seg) => EXCLUDED_DIRS.has(seg)));
  }

  if (targets.length === 0) {
    console.log('[da-push] Nada que subir.');
    return { failures: 0, results: [] };
  }

  const uploadedImageCache = new Map();
  let failures = 0;
  const results = [];
  for (const rel of targets) {
    console.log(`[da-push] Procesando ${rel}...`);
    try {
      const url = await uploadOne(token, rel, uploadedImageCache);
      console.log(`[da-push] OK  ${rel} -> https://${url}`);
      results.push({ rel, url, ok: true });
    } catch (err) {
      failures += 1;
      console.error(`[da-push] FAIL ${rel}: ${err.message}`);
      results.push({ rel, error: err.message, ok: false });
    }
  }

  return { failures, results };
}

// Ejecución directa por CLI (no cuando se importa desde da-watch.mjs)
const isMain = process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (isMain) {
  const { failures } = await pushDrafts(process.argv.slice(2));
  if (failures > 0) process.exitCode = 1;
}
