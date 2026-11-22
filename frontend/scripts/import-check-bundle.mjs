/**
 * 2026-11-22 (A1) — DIE PRÜFUNG DER IMPORTE FÜR DEN DIENST (`backend/Api/Library/ImportCheck.js` + `ImportCheck.locales.json`).
 *
 * Das MCP-Werkzeug `check_import` (AiMcp.ImportCheck.cs) prüft ein Dokument, ohne zu schreiben, mit DEMSELBEN Code wie die
 * Vorschau der App: dieses Skript bündelt `src/app/importCheck/server.ts` (das Register aller Importe und ihre Planer) zu
 * einem Skript ohne Module, das Jint im Dienst ausführt. Davor stehen die Stücke, die Jint fehlen (crypto, Intl, …).
 * Die Texte stehen daneben (`ImportCheck.locales.json`): nur die Dateien der Sprachen, die das Bündel nennt.
 *
 *   node scripts/import-check-bundle.mjs          schreibt beide Dateien neu
 *   node scripts/import-check-bundle.mjs --check  sagt nur, ob sie stimmen (Exit 1, wenn nicht)
 *
 * Der Bau des Dienstes ruft es selbst (Api.csproj, Ziel `ImportCheckBundle`), wenn Node und esbuild da sind.
 */

import { build } from 'esbuild';
import { mkdtemp, readFile, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT_JS = join(ROOT, '../backend/Api/Library/ImportCheck.js');
const OUT_LOCALES = join(ROOT, '../backend/Api/Library/ImportCheck.locales.json');
const LOCALES = join(ROOT, 'src/locales');

/* Was Jint (ECMAScript ohne Browser) nicht hat und die Planer brauchen — klein, ohne Anspruch über die Prüfung hinaus. */
const SHIMS = String.raw`
var G = globalThis;
if (typeof G.window === 'undefined') G.window = undefined;
if (typeof G.console === 'undefined') G.console = { log() {}, warn() {}, error() {}, info() {}, debug() {} };
if (typeof G.BroadcastChannel === 'undefined') G.BroadcastChannel = undefined;
if (typeof G.queueMicrotask === 'undefined') G.queueMicrotask = function (fn) { Promise.resolve().then(fn); };
if (typeof G.setTimeout === 'undefined') { G.setTimeout = function (fn) { Promise.resolve().then(fn); return 0; }; G.clearTimeout = function () {}; }
if (typeof G.setInterval === 'undefined') { G.setInterval = function () { return 0; }; G.clearInterval = function () {}; }
if (typeof G.performance === 'undefined') G.performance = { now: function () { return Date.now(); } };
if (typeof G.structuredClone === 'undefined') G.structuredClone = function (v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); };
if (typeof G.crypto === 'undefined') {
  G.crypto = {
    getRandomValues: function (a) { for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); return a; },
    randomUUID: function () { var h = '0123456789abcdef', s = ''; for (var i = 0; i < 36; i++) s += (i === 8 || i === 13 || i === 18 || i === 23) ? '-' : i === 14 ? '4' : h[Math.floor(Math.random() * 16)]; return s; }
  };
}
if (typeof G.TextEncoder === 'undefined') {
  G.TextEncoder = function () {};
  G.TextEncoder.prototype.encode = function (s) { var u = unescape(encodeURIComponent(String(s))), a = new Uint8Array(u.length); for (var i = 0; i < u.length; i++) a[i] = u.charCodeAt(i); return a; };
  G.TextDecoder = function () {};
  G.TextDecoder.prototype.decode = function (a) { var s = ''; a = a || new Uint8Array(0); for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); try { return decodeURIComponent(escape(s)); } catch (e) { return s; } };
}
/* Jint hat Intl, aber seine Mehrzahl kennt nur „one"/„other" (polnisch 5 → „other" statt „many"): die Regeln für en/de/pl immer von hier. */
var PluralRules = function (locale) { this.lang = String(locale || 'en').slice(0, 2); };
PluralRules.prototype.select = function (n) {
  var i = Math.abs(n);
  if (this.lang === 'pl') { if (i === 1) return 'one'; if (i % 1 !== 0) return 'other'; var t = i % 10, h = i % 100; return t >= 2 && t <= 4 && !(h >= 12 && h <= 14) ? 'few' : 'many'; }
  return i === 1 ? 'one' : 'other';
};
PluralRules.prototype.resolvedOptions = function () { return { locale: this.lang }; };
if (typeof G.Intl === 'undefined') {
  var two = function (n) { return (n < 10 ? '0' : '') + n; };
  G.Intl = {
    Collator: function () {},
    NumberFormat: function (locale, opts) { this.opts = opts || {}; },
    DateTimeFormat: function (locale, opts) { this.opts = opts || {}; }
  };
  G.Intl.Collator.prototype.compare = function (a, b) { a = String(a); b = String(b); var x = a.toLowerCase(), y = b.toLowerCase(); return x < y ? -1 : x > y ? 1 : a < b ? -1 : a > b ? 1 : 0; };
  G.Intl.NumberFormat.prototype.format = function (n) { var d = this.opts.maximumFractionDigits; return typeof d === 'number' ? String(Math.round(n * Math.pow(10, d)) / Math.pow(10, d)) : String(n); };
  G.Intl.NumberFormat.prototype.formatToParts = function (n) { return [{ type: 'integer', value: this.format(n) }]; };
  G.Intl.DateTimeFormat.prototype.format = function (d) { d = new Date(d); return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()) + (this.opts.hour !== undefined ? ' ' + two(d.getHours()) + ':' + two(d.getMinutes()) : ''); };
  G.Intl.DateTimeFormat.prototype.formatToParts = function (d) { return [{ type: 'literal', value: this.format(d) }]; };
  G.Intl.DateTimeFormat.prototype.resolvedOptions = function () { return { timeZone: 'Europe/Warsaw', locale: 'pl-PL' }; };
}
G.Intl.PluralRules = PluralRules;
`;

/** Das Bündel und die Texte, die es braucht — als Zeichenketten (geschrieben oder verglichen). */
export async function bundle() {
  const work = await mkdtemp(join(tmpdir(), 'import-check-'));
  try {
    const app = join(ROOT, 'src/app/').replace(/\\/g, '/');
    const entry = join(work, 'entry.ts');
    await writeFile(join(work, 'shims.js'), SHIMS);
    await writeFile(entry, `import './shims.js';\nimport '${app}importCheck/server';\n`);
    const result = await build({
      entryPoints: [entry], bundle: true, format: 'iife', platform: 'browser', target: 'es2020', write: false, logLevel: 'error',
      jsx: 'automatic', minify: true, legalComments: 'none', charset: 'utf8',
      loader: { '.svg': 'empty', '.png': 'empty', '.woff2': 'empty' },
      /* Gestalt braucht die Prüfung nicht: jede .css ist leer — auch eine, die (noch) fehlt. */
      plugins: [{ name: 'no-css', setup(b) { b.onResolve({ filter: /.css$/ }, (a) => ({ path: a.path, namespace: 'no-css' })); b.onLoad({ filter: /.*/, namespace: 'no-css' }, () => ({ contents: '', loader: 'js' })); } }],
      define: { 'import.meta.env': JSON.stringify({ DEV: false, PROD: true, VITE_APP_API: '' }), 'process.env.NODE_ENV': '"production"' }
    });
    const js = `/* 2026-11-22 — erzeugt von frontend/scripts/import-check-bundle.mjs aus src/app/importCheck/server.ts; nicht von Hand ändern. */\n${result.outputFiles[0].text}`;
    /* Die Texte: je Sprache nur die Dateien, deren Namensraum das Bündel nennt ("ns. …"). */
    const locales = {};
    for (const lang of ['en', 'de', 'pl']) {
      const files = {};
      for (const name of (await readdir(join(LOCALES, lang))).filter((f) => f.endsWith('.json')).sort()) {
        const ns = name.slice(0, -'.json'.length);
        if (js.includes(`"${ns}.`) || js.includes(`'${ns}.`) || js.includes(`\`${ns}.`)) files[ns] = JSON.parse(await readFile(join(LOCALES, lang, name), 'utf8'));
      }
      locales[lang] = files;
    }
    return { js, locales: `${JSON.stringify(locales)}\n` };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

const same = async (path, text) => { try { return (await readFile(path, 'utf8')).replace(/\r\n/g, '\n') === text; } catch { return false; } };

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { js, locales } = await bundle();
  if (process.argv.includes('--check')) {
    const ok = (await same(OUT_JS, js)) && (await same(OUT_LOCALES, locales));
    console.log(ok ? 'ImportCheck.js stimmt.' : 'ImportCheck.js weicht von der App ab — node scripts/import-check-bundle.mjs');
    process.exit(ok ? 0 : 1);
  }
  const changed = !(await same(OUT_JS, js)) || !(await same(OUT_LOCALES, locales));
  if (changed) { await writeFile(OUT_JS, js); await writeFile(OUT_LOCALES, locales); }
  /* Unverändert: nur die Zeit — so weiss der Bau des Dienstes (Inputs/Outputs), dass er nicht wieder bündeln muss. */
  else { const now = new Date(); await utimes(OUT_JS, now, now); }
  console.log(`${changed ? 'Neu geschrieben' : 'War schon aktuell'}: ImportCheck.js ${Math.round(js.length / 1024)} kB, Texte ${Math.round(locales.length / 1024)} kB (${Object.keys(JSON.parse(locales).pl).length} Dateien je Sprache)`);
}
