/**
 * 2026-11-05 — DIE PRÜFUNG DER SPRACHEN (documentation/LOCALIZATION.md).
 *
 *  1. `src/locales/en|de|pl` haben dieselben Dateien und in jeder Datei dieselben Schlüssel.
 *  2. Eine Mehrzahl ({ one, other } / pl: { one, few, many, other }) hat die Formen ihrer Sprache.
 *  3. Platzhalter `{name}` und Auszeichnungen `<b>…</b>` sind in allen Sprachen dieselben.
 *  4. Jeder Schlüssel, den der Code nennt (`t('…')`, `tIn(lang, '…')`, `tOr('…')`, `hasKey('…')`), steht in
 *     `en`; ein Schlüssel mit `${…}` braucht seinen festen Anfang als Gruppe.
 *  5. DIE SPERRKLINKE: Text, der noch im Code steht (Literale mit ąćęłńóśźż/äöüß, Text in JSX, UI-Attribute
 *     und -Felder mit Wörtern, toast/ask/WorkspaceError mit Text), wird je Datei gezählt. Die Zahl darf
 *     sinken, nie steigen; eine neue Datei beginnt bei 0. Ausgenommen: eine Zeile mit `i18n-ignore`, eine
 *     Datei mit `i18n-ignore-file` (Daten, keine Oberfläche — z. B. polnische Regeln für PESEL).
 *
 *   node scripts/app-i18n-check.mjs            prüfen
 *   node scripts/app-i18n-check.mjs --update   die gesunkenen Zahlen als neue Grenze festhalten
 *   node scripts/app-i18n-check.mjs --list <pfad-teil>   die gezählten Stellen einer Datei zeigen
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const LOCALES = join(SRC, 'locales');
const BASELINE = join(ROOT, 'scripts', 'i18n-baseline.json');
const LANGS = ['en', 'de', 'pl'];
const FORMS = { en: ['one', 'other'], de: ['one', 'other'], pl: ['one', 'few', 'many', 'other'] };
const PLURAL_KEYS = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);

const args = process.argv.slice(2);
const update = args.includes('--update');
const listAt = args.includes('--list') ? args[args.indexOf('--list') + 1] : null;

const errors = [];
const fail = (msg) => errors.push(msg);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path));
    else out.push(path);
  }
  return out;
}

/* -- 1–3: die Dateien der Sprachen ------------------------------------------ */

const isPlural = (v) => v !== null && typeof v === 'object' && Object.keys(v).length > 0 && Object.keys(v).every((k) => PLURAL_KEYS.has(k)) && 'other' in v;

/** Schlüssel → Wert (Text oder Mehrzahl), flach. */
function flatten(obj, prefix, out, file, lang) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix === '' ? k : `${prefix}.${k}`;
    if (k.includes('.')) fail(`${lang}/${file}.json: key "${key}" contains a dot`);
    if (typeof v === 'string' || isPlural(v)) out.set(key, v);
    else if (v !== null && typeof v === 'object') flatten(v, key, out, file, lang);
    else fail(`${lang}/${file}.json: "${key}" is neither text nor a group`);
  }
  return out;
}

const texts = (v) => (typeof v === 'string' ? [v] : Object.values(v));
const marks = (v) => {
  const set = new Set();
  for (const s of texts(v)) {
    for (const m of s.matchAll(/\{(\w+)\}/g)) set.add(`{${m[1]}}`);
    for (const m of s.matchAll(/<(\w+)>/g)) set.add(`<${m[1]}>`);
  }
  return [...set].sort().join(' ');
};

const dicts = {};
const fileSets = {};
for (const lang of LANGS) {
  dicts[lang] = {};
  const names = (await readdir(join(LOCALES, lang))).filter((f) => f.endsWith('.json'));
  fileSets[lang] = new Set(names.map((n) => n.slice(0, -5)));
  for (const name of names) {
    const file = name.slice(0, -5);
    if (!/^[a-z][A-Za-z0-9]*$/.test(file)) fail(`${lang}/${name}: file names are camelCase words (they are the first part of every key)`);
    let data;
    try { data = JSON.parse(await readFile(join(LOCALES, lang, name), 'utf8')); } catch (e) { fail(`${lang}/${name}: not valid JSON (${e.message})`); continue; }
    dicts[lang][file] = flatten(data, '', new Map(), file, lang);
  }
}

for (const lang of LANGS) {
  for (const f of fileSets.en) if (!fileSets[lang].has(f)) fail(`${lang}/${f}.json is missing`);
  for (const f of fileSets[lang]) if (!fileSets.en.has(f)) fail(`${lang}/${f}.json has no English original (en/${f}.json)`);
}

let keyCount = 0;
for (const file of fileSets.en) {
  const en = dicts.en[file];
  if (en === undefined) continue;
  keyCount += en.size;
  for (const lang of LANGS) {
    const d = dicts[lang][file];
    if (d === undefined) continue;
    for (const [key, v] of d) {
      const where = `${lang}/${file}.json "${key}"`;
      if (!en.has(key)) { fail(`${where}: not in en`); continue; }
      const e = en.get(key);
      if (isPlural(e) !== isPlural(v)) { fail(`${where}: plural in one language, plain text in another`); continue; }
      if (isPlural(v)) for (const form of FORMS[lang]) if (typeof v[form] !== 'string') fail(`${where}: plural form "${form}" missing`);
      if (marks(e) !== marks(v)) fail(`${where}: placeholders/tags differ from en (${marks(e) || '—'} vs ${marks(v) || '—'})`);
      if (texts(v).some((s) => s.trim() === '')) fail(`${where}: empty text`);
    }
    if (lang !== 'en') for (const key of en.keys()) if (!d.has(key)) fail(`${lang}/${file}.json: "${key}" missing (en has it)`);
  }
}

/* -- 4: die Schlüssel im Code ------------------------------------------------ */

const codeFiles = (await walk(SRC)).filter((f) => /\.(tsx?|mjs)$/.test(f) && !f.includes(`${sep}legacy${sep}`) && !f.includes(`${sep}locales${sep}`));
const code = await Promise.all(codeFiles.map(async (f) => [f, await readFile(f, 'utf8')]));

const hasEnKey = (key) => {
  const dot = key.indexOf('.');
  if (dot < 0) return false;
  return dicts.en[key.slice(0, dot)]?.has(key.slice(dot + 1)) ?? false;
};
const hasEnGroup = (prefix) => {
  const dot = prefix.indexOf('.');
  if (dot < 0) return fileSets.en.has(prefix);
  const d = dicts.en[prefix.slice(0, dot)];
  if (d === undefined) return false;
  const rest = prefix.slice(dot + 1);
  for (const k of d.keys()) if (k.startsWith(rest)) return true;
  return false;
};

const used = new Set();
const KEY_CALL = /(?<![\w$.])(?:t|tIn\([^,()]+,|tOr|hasKey|tFor\([^()]*\))\(\s*(['"`])([a-z][A-Za-z0-9]*\.[^'"`\n]*?)\1/g;
const KEY_CALL2 = /(?<![\w$])(?:tIn)\(\s*[^,()]+,\s*(['"`])([a-z][A-Za-z0-9]*\.[^'"`\n]*?)\1/g;
for (const [file, text] of code) {
  const rel = relative(SRC, file);
  for (const re of [KEY_CALL, KEY_CALL2]) {
    for (const m of text.matchAll(re)) {
      const key = m[2];
      const dyn = key.indexOf('${');
      if (dyn >= 0) {
        const prefix = key.slice(0, dyn).replace(/\.$/, '');
        if (prefix !== '' && !hasEnGroup(prefix)) fail(`${rel}: key group "${prefix}" (from \`${key}\`) not in en`);
        used.add(`${prefix}.*`);
      } else {
        used.add(key);
        if (!hasEnKey(key)) fail(`${rel}: key "${key}" not in en`);
      }
    }
  }
}

/* -- 5: die Sperrklinke ------------------------------------------------------ */

const strip = (text) => {
  const raw = text.split('\n');
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
    .split('\n').map((line, i) => (/i18n-ignore/.test(raw[i] ?? '') ? '' : line)).join('\n');
};

const DIACRITIC = /(['"`])((?:\\.|(?!\1)[^\\\n])*?[ąćęłńóśźżĄĆĘŁŃÓŚŹŻäöüßÄÖÜ](?:\\.|(?!\1)[^\\\n])*?)\1/g;
const JSX_TEXT = /(?<![=\-])>\s*([^<>{}=;()&|]*?[A-Za-zÀ-ž]{2,}[^<>{}=;()&|]*?)\s*(?=<\/?[A-Za-z]|\{)/g;
const UI_ATTR = /\b(?:title|placeholder|aria-label|alt|label)=(["'])[^"'{}]*[A-Za-zÀ-ž]{2,}[^"'{}]*\1/g;
const UI_FIELD = /\b(?:label|title|placeholder|hint|caption|message|empty|note|ariaLabel|text)\s*:\s*(['"`])(?=[^'"`]*\s)[^'"`]*[A-Za-zÀ-ž]{2,}[^'"`]*\1/g;
const UI_CALL = /\b(?:toast|ask|askText|alert|WorkspaceError|setError|setFailed)\(\s*(['"`])[^'"`]*[A-Za-zÀ-ž]{2,}[^'"`]*\1/g;

function hits(file, text) {
  if (/i18n-ignore-file/.test(text)) return [];
  const s = strip(text);
  const out = [];
  const add = (re, kind) => { for (const m of s.matchAll(re)) out.push({ kind, at: s.slice(0, m.index).split('\n').length, what: m[0].trim().slice(0, 80) }); };
  add(DIACRITIC, 'literal');
  if (file.endsWith('.tsx')) { add(JSX_TEXT, 'jsx'); add(UI_ATTR, 'attr'); }
  add(UI_FIELD, 'field');
  add(UI_CALL, 'call');
  /* Ein Literal mit Umlaut, das auch als Feld/Aufruf zählt, nur einmal. */
  const seen = new Set();
  return out.filter((h) => { const k = `${h.at}:${h.what.slice(-30)}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

const counts = {};
let total = 0;
for (const [file, text] of code) {
  if (!file.startsWith(join(SRC, 'app')) && !/[\\/]src[\\/][a-z]+\.tsx?$/.test(file)) continue;
  const rel = relative(SRC, file).split(sep).join('/');
  const h = hits(file, text);
  if (listAt !== null && rel.includes(listAt)) for (const one of h) console.log(`${rel}:${one.at}  [${one.kind}]  ${one.what}`);
  if (h.length > 0) { counts[rel] = h.length; total += h.length; }
}
if (listAt !== null) process.exit(0);

let baseline = {};
try { baseline = JSON.parse(await readFile(BASELINE, 'utf8')).files ?? {}; } catch { /* erste Zählung */ }
const grew = [];
for (const [rel, n] of Object.entries(counts)) {
  const was = baseline[rel] ?? 0;
  if (n > was) grew.push(`${rel}: ${was} → ${n}`);
}

if (update) {
  const next = {};
  for (const [rel, n] of Object.entries(counts)) next[rel] = Math.min(n, baseline[rel] ?? n);
  if (Object.keys(baseline).length === 0) Object.assign(next, counts);
  await writeFile(BASELINE, `${JSON.stringify({ note: 'Hard-coded UI text per file (scripts/app-i18n-check.mjs). May only go down.', total: Object.values(next).reduce((a, b) => a + b, 0), files: Object.fromEntries(Object.entries(next).sort()) }, null, 2)}\n`);
  console.log(`baseline written: ${Object.values(next).reduce((a, b) => a + b, 0)} places in ${Object.keys(next).length} files`);
}

for (const e of errors) console.error(`FAIL ${e}`);
if (!update) for (const g of grew) console.error(`FAIL hard-coded text grew — ${g} (move it to src/locales, see documentation/LOCALIZATION.md; list: node scripts/app-i18n-check.mjs --list <file>)`);
console.log(`${fileSets.en.size} files, ${keyCount} keys × ${LANGS.length} languages; ${used.size} keys named in code; hard-coded text left: ${total}`);
if (errors.length > 0 || (!update && grew.length > 0)) process.exit(1);
