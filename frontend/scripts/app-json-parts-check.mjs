/**
 * 2026-10-29 — JSON FÜR JEDEN TEIL: die Prüfungen der Teile (`app-json-<teil>-check.mjs` — Kalender, Zadania,
 * Msze, Rezerwacje, Role, Rozmowy, Kontakty, Lampy, Adresy, Widok, Moje dane, Postępy …) nacheinander, jede in
 * ihrem eigenen Prozess. Ein neuer Teil braucht hier keinen Eintrag: der Name genügt.
 *
 *   node scripts/app-json-parts-check.mjs
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = new URL('.', import.meta.url);
const scripts = readdirSync(here).filter((f) => /^app-json-.+-check\.mjs$/.test(f) && f !== 'app-json-parts-check.mjs').sort();

let failed = 0;
for (const script of scripts) {
  const run = spawnSync(process.execPath, [fileURLToPath(new URL(script, here))], { encoding: 'utf8', env: process.env, maxBuffer: 64 * 1024 * 1024 });
  const last = (run.stdout ?? '').trim().split('\n').pop() ?? '';
  if (run.status === 0) {
    console.log(`ok   ${script} — ${last}`);
  } else {
    failed += 1;
    console.error(`FAIL ${script}\n${run.stdout ?? ''}\n${run.stderr ?? ''}`);
  }
}

console.log(`\n${scripts.length - failed} of ${scripts.length} part checks pass.`);
if (failed > 0) process.exit(1);
