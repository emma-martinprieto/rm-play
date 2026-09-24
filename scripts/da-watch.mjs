#!/usr/bin/env node
/**
 * Vigila drafts/**\/*.plain.html y sube automáticamente a da.live en cuanto
 * detecta un guardado. PLANTILLA GENERAL — no editar las copias instaladas
 * en cada proyecto directamente; edita esta y reinstala.
 *
 * drafts/ está (intencionadamente) en .gitignore en cada proyecto — por eso
 * la sincronización se dispara por cambios en disco, no por git commit.
 *
 * Uso:
 *   node scripts/da-watch.mjs
 *
 * Ctrl+C para parar. Requiere DA_TOKEN en .env (ver scripts/da-push.mjs).
 */
import { watch } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pushDrafts } from './da-push.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DRAFTS_DIR = path.join(ROOT, 'drafts');

const DEBOUNCE_MS = 800;
const pending = new Set();
let timer = null;

function schedule(relPath) {
  if (!relPath.endsWith('.plain.html')) return;
  pending.add(relPath);
  clearTimeout(timer);
  timer = setTimeout(flush, DEBOUNCE_MS);
}

async function flush() {
  const files = [...pending];
  pending.clear();
  if (files.length === 0) return;
  console.log(`\n[da-watch] Cambios detectados, subiendo ${files.length} archivo(s)...`);
  await pushDrafts(files.map((f) => path.join(DRAFTS_DIR, f)));
}

function main() {
  if (!existsSync(DRAFTS_DIR)) {
    console.error(`[da-watch] No existe ${DRAFTS_DIR}`);
    process.exit(1);
  }
  console.log(`[da-watch] Vigilando ${DRAFTS_DIR} — Ctrl+C para parar.`);
  watch(DRAFTS_DIR, { recursive: true }, (_eventType, filename) => {
    if (!filename) return;
    const norm = filename.split(path.sep).join('/');
    if (norm.startsWith('da-paste/') || norm.startsWith('images/') || norm.includes('/da-paste/') || norm.includes('/images/')) return;
    schedule(filename);
  });
}

main();
