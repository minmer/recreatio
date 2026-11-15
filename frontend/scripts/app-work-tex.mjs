/**
 * 2026-11-15 — DER DRUCK EINES WERKS, WIRKLICH ÜBERSETZT. Die Prüfung `app-work-check.mjs` schreibt jedes Dokument, das
 * sie erzeugt (Buch, Heft, Artikel, Blatt; polnisch, deutsch, englisch; Entwurf und Endfassung), in einen Ordner;
 * hier übersetzt sie pdflatex (zweimal, damit \pageref aufgeht) und lualatex. Jeder Fehler und jeder ungelöste Verweis
 * wird gemeldet.
 *
 *   node scripts/app-work-tex.mjs            braucht pdflatex und lualatex im PATH (MiKTeX, TeX Live)
 *
 * Nicht in `app:check`: dort steht nicht überall ein TeX.
 */
import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const has = (cmd) => spawnSync(cmd, ['--version'], { encoding: 'utf8' }).status === 0;
if (!has('pdflatex') || !has('lualatex')) {
  console.log('Kein pdflatex/lualatex im PATH — übersprungen.');
  process.exit(0);
}

const dir = await mkdtemp(join(tmpdir(), 'work-tex-'));
const made = spawnSync(process.execPath, ['scripts/app-work-check.mjs'], { env: { ...process.env, WORK_TEX_DIR: dir }, encoding: 'utf8' });
if (made.status !== 0) { console.error(made.stdout, made.stderr); process.exit(1); }

const files = (await readdir(dir)).filter((f) => f.endsWith('.tex')).sort();
let failed = 0;
for (const file of files) {
  for (const engine of ['pdflatex', 'lualatex']) {
    const job = `${file.slice(0, -4)}-${engine}`;
    let ok = true;
    for (let run = 1; run <= 2 && ok; run += 1) {
      const r = spawnSync(engine, ['-interaction=nonstopmode', '-halt-on-error', `-jobname=${job}`, file], { cwd: dir, encoding: 'utf8', timeout: 600000 });
      ok = r.status === 0;
    }
    const log = await readFile(join(dir, `${job}.log`), 'utf8').catch(() => '');
    const errors = log.split('\n').filter((l) => l.startsWith('!')).slice(0, 3);
    const undefinedRefs = /There were undefined references|Reference `[^']+' on page \d+ undefined/.test(log);
    const missingChars = (log.match(/Missing character: There is no [^\n]*/g) ?? []).slice(0, 3);
    if (!ok || undefinedRefs || missingChars.length > 0) {
      failed += 1;
      console.log(`FAIL ${file} (${engine})${ok ? '' : ' — error'}${undefinedRefs ? ' — undefined references' : ''}`);
      for (const e of [...errors, ...missingChars]) console.log(`     ${e}`);
    } else {
      console.log(`ok   ${file} (${engine})`);
    }
  }
}
if (failed === 0) await rm(dir, { recursive: true, force: true });
else console.log(`Die Dateien liegen in ${dir}`);
console.log(`${files.length * 2 - failed} von ${files.length * 2} Übersetzungen gelungen.`);
process.exit(failed === 0 ? 0 : 1);
