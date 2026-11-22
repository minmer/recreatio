/**
 * 2026-11-22 (A1) — `check_import` IN DER VORSCHAU-MCP: dasselbe Bündel wie das MCP-Werkzeug des Dienstes
 * (`backend/Api/Library/ImportCheck.js`, erzeugt von `scripts/import-check-bundle.mjs` aus `src/app/importCheck/`), hier in
 * einem nackten JavaScript-Kontext von Node — ohne Browser, ohne Dienst. Gegen einen leeren Stand (eine Baza wiedzy: eine
 * leere); die Prüfung gegen eine bestehende Baza macht `check_import` des Recreatio-MCP.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';

let loaded = null;

async function context(repo) {
  if (loaded !== null) return loaded;
  const dir = resolve(repo, 'backend/Api/Library');
  const js = await readFile(resolve(dir, 'ImportCheck.js'), 'utf8');
  const locales = JSON.parse(await readFile(resolve(dir, 'ImportCheck.locales.json'), 'utf8'));
  const ctx = vm.createContext({});
  vm.runInContext(js, ctx);
  loaded = { ctx, locales };
  return loaded;
}

/** Das Ergebnis (`ImportCheck`, src/app/importCheck/check.ts) und ein Text für den Assistenten. */
export async function checkImportText(repo, { format, doc, lang = 'pl' }) {
  const { ctx, locales } = await context(repo);
  const language = ['pl', 'en', 'de'].includes(lang) ? lang : 'pl';
  const dicts = JSON.stringify({ [language]: locales[language], en: locales.en });
  const r = JSON.parse(await ctx.recreatioImportCheck(JSON.stringify({ format, lang: language, document: doc }), dicts));
  const errors = r.groups.filter((g) => g.level === 'error');
  const warnings = r.groups.filter((g) => g.level === 'warning');
  const count = (list) => list.reduce((n, g) => n + g.count, 0);
  const group = (g) => `- ${g.text}${g.count > 1 ? ` (×${g.count})` : ''}${g.examples.length > 1 ? `\n${g.examples.slice(0, 12).map((x) => `    · ${x}`).join('\n')}` : ''}`;
  const lines = [
    `${r.ok ? 'OK — the import would go through' : `BLOCKED — ${count(errors)} error(s) stop the import`}; format ${r.format}. Nothing was written.`,
    ...(r.note === undefined ? [] : [`Note: ${r.note}`]),
    '', '# Changes', ...(r.changes.length === 0 ? ['(none)'] : r.changes.slice(0, 200)), ...(r.changes.length > 200 ? [`… and ${r.changes.length - 200} more`] : []),
    ...(r.removals.length === 0 ? [] : ['', `# Removals (${r.removals.length})`, ...r.removals.slice(0, 200)]),
    '', `# Errors (${count(errors)})`, ...(errors.length === 0 ? ['(none)'] : errors.map(group)),
    '', `# Warnings (${count(warnings)})`, ...(warnings.length === 0 ? ['(none)'] : warnings.map(group))
  ];
  return { result: r, text: lines.join('\n') };
}
