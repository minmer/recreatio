/**
 * DIE SPERRKLINKE DER GESTALT (2026-10-17).
 *
 * Die Oberfläche hat jetzt Bausteine (`src/app/ui/`) und Masse (`--wk-text-*`,
 * `--wk-space-*`, `--wk-radius-*`, `--wk-z-*`). Was daneben noch von Hand
 * steht — eine Schriftgrösse in px, ein Rund in px, ein z-index als Zahl, ein
 * `confirm()` des Browsers, ein „Wczytywanie…" als Absatz —, wird hier
 * gezählt. Die Zahl darf sinken, nie steigen: so wird es mit jeder Änderung
 * ein wenig ordentlicher, ohne dass alles auf einmal umgebaut sein muss.
 *
 *   node scripts/app-style-check.mjs            prüfen (scheitert, wenn eine Zahl steigt)
 *   node scripts/app-style-check.mjs --update   die gesunkenen Zahlen als neue Grenze festhalten
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const APP = join(ROOT, 'src', 'app');
const BASELINE = join(ROOT, 'scripts', 'style-baseline.json');

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path));
    else out.push(path);
  }
  return out;
}

const files = await walk(APP);
const css = await Promise.all(files.filter((f) => f.endsWith('.css')).map(async (f) => [f, await readFile(f, 'utf8')]));
const code = await Promise.all(files.filter((f) => /\.tsx?$/.test(f)).map(async (f) => [f, await readFile(f, 'utf8')]));

/* Kommentare zählen nicht mit: dort steht oft, wie es früher war. */
const stripCss = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '');
const stripCode = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const count = (sources, strip, re) => {
  let n = 0;
  const where = new Map();
  for (const [file, text] of sources) {
    const hits = strip(text).match(re)?.length ?? 0;
    if (hits > 0) { n += hits; where.set(relative(APP, file), hits); }
  }
  return { n, where };
};

const COUNTS = {
  /* Eine Schriftgrösse als blanke Zahl statt `var(--wk-text-*)` (clamp/cq in Präsentationen zählen nicht: sie wachsen mit der Bühne). */
  'css: font-size in px/rem/em': count(css, stripCss, /font-size:\s*[\d.]+(?:px|rem|em)\s*[;}]/g),
  /* Ein Rund von Hand (0 und die Pille 999px zählen nicht). */
  'css: border-radius in px/rem': count(css, stripCss, /border-radius:\s*(?!0[;\s}])(?!999px)[\d.]+(?:px|rem)\s*[;}]/g),
  /* Ein z-index als Zahl ab 10 statt `var(--wk-z-*)`. */
  'css: z-index ≥ 10 as a number': count(css, stripCss, /z-index:\s*\d{2,}\s*[;}]/g),
  /* Ein Umbruch in px (die Masse sind rem: 40rem, 64rem). */
  'css: @media in px': count(css, stripCss, /@media[^{]*\d+px/g),
  /* Das Fenster des Browsers statt `ask`/`askText` (ui/dialogs). */
  'code: window.confirm()': count(code, stripCode, /\bwindow\.confirm\(/g),
  /* Ein „Wczytywanie…" als Text statt `<Loading>` (ui/Loading). */
  'code: loading text outside <Loading>': count(code, stripCode, /(?<!label=")(?<!label: ')(?<!label=\{')\b(?:Wczytywanie|Ładowanie)…/g),
  /* Die Umschaltung einfach/erweitert (0094) ist fort und kommt nicht zurück. */
  'code: DisplaySwitch / useDisplay': count(code, stripCode, /\b(?:DisplaySwitch|useDisplay)\b/g),
  /* Graue Erklärzeilen: eine Zeile nur dort, wo ein Fehler wahrscheinlich ist. */
  'code: wk-hint': count(code, stripCode, /\bwk-hint\b/g),
  /* Gestalt im Code statt in einer Klasse. */
  'code: inline style={{…}}': count(code, stripCode, /\bstyle=\{\{/g)
};

let baseline = {};
try { baseline = JSON.parse(await readFile(BASELINE, 'utf8')); } catch { baseline = {}; }

const update = process.argv.includes('--update');
let failed = 0;
let lower = 0;
const next = {};
for (const [name, { n, where }] of Object.entries(COUNTS)) {
  const limit = baseline[name];
  next[name] = limit === undefined || update ? n : Math.min(n, limit);
  if (limit === undefined) {
    console.log(`new  ${name}: ${n}`);
  } else if (n > limit) {
    failed += 1;
    const top = [...where.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([f, k]) => `${f} ${k}`).join(', ');
    console.error(`FAIL ${name}: ${n} (limit ${limit}) — the count may only fall. Most in: ${top}`);
  } else if (n < limit) {
    lower += 1;
    console.log(`ok   ${name}: ${n} (was ${limit})`);
  } else {
    console.log(`ok   ${name}: ${n}`);
  }
}

if (update || Object.keys(baseline).length === 0 || Object.keys(COUNTS).some((name) => baseline[name] === undefined)) {
  await writeFile(BASELINE, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  console.log(`baseline written: ${relative(ROOT, BASELINE)}`);
} else if (lower > 0) {
  console.log(`${lower} count(s) fell — lock them in with: node scripts/app-style-check.mjs --update`);
}

if (failed > 0) {
  console.error(`${failed} style count(s) went up.`);
  process.exit(1);
}
console.log('style counts hold.');
