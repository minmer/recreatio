/**
 * 2026-10-27 — DIE ANHÄNGE DES LEITFADENS `templates/cogita/ksiazka-AI.md` AUS DER APP:
 *   A  „Dzieło z tekstem" — `workWithTextDescription()` (`library/sourceImport.ts`)
 *   B  Cogita als JSON — `courseDescription()` (`cogita/json.ts`)
 *   C  die Rodzaje der fertigen Schemata — aus den Dateien `templates/cogita/*.json` selbst
 * je zwischen ihren Marken. `app-cogita-check` prüft, dass der Leitfaden mit der App übereinstimmt.
 *
 *   node scripts/ksiazka-guide.mjs          schreibt die Anhänge neu
 *   node scripts/ksiazka-guide.mjs --check  sagt nur, ob sie stimmen (Exit 1, wenn nicht)
 */

import { build } from 'esbuild';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const GUIDE = '../templates/cogita/ksiazka-AI.md';
export const TEMPLATE_FILES = ['wywod.json', 'fakty.json', 'jednostki.json', 'podstawy.json', 'pytania.json'];

const mark = (name) => [`<!-- app:${name}:start -->`, `<!-- app:${name}:end -->`];

/** Zwischen die Marken eines Anhangs: der Text als Block. */
export function withAppendix(guide, name, text) {
  const [start, end] = mark(name);
  const a = guide.indexOf(start);
  const b = guide.indexOf(end);
  if (a < 0 || b < a) throw new Error(`ksiazka-AI.md: Marken des Anhangs „${name}" fehlen`);
  return `${guide.slice(0, a)}${start}\n\`\`\`text\n${text.trimEnd()}\n\`\`\`\n${end}${guide.slice(b + end.length)}`;
}

/** Die Rodzaje der fertigen Schemata in Worten — Schlüssel, Name, Typ, was das Feld bedeutet. */
export function kindsOfTemplates(files) {
  const out = [];
  for (const [file, doc] of files) {
    out.push(`## templates/cogita/${file} — ${doc.name}`);
    for (const kind of doc.kinds ?? []) {
      out.push(`### "${kind.ref}"${kind.builtin === undefined ? '' : ` (wbudowany "${kind.builtin}")`} — ${kind.name}${kind.label === undefined ? '' : `, etykieta ${kind.label}`}`);
      for (const f of kind.fields ?? []) {
        const flags = [
          f.type, f.multi ? 'kilka' : '', f.uncertain ? 'niepewne' : '', f.locator ? 'z miejscem' : '',
          f.to?.length ? `→ ${f.to.join(', ')}` : '', f.structure ? `struktura ${f.structure}` : '', f.prerequisite ? `kolejność nauki ${f.prerequisite}` : '',
          f.when ? `tylko gdy ${f.when.field}: ${f.when.values.join(', ')}` : '',
          f.options ? `do wyboru: ${f.options.map((o) => `"${o.value}"`).join(', ')}` : ''
        ].filter((x) => x !== '').join('; ');
        out.push(`- "${f.key}" — ${f.label} (${flags})${f.says === undefined ? '' : `: ${f.says}`}`);
      }
    }
    const names = (list) => (list ?? []).map((x) => `„${x.name}”`).join(', ');
    if ((doc.templates ?? []).length > 0) out.push(`Szablony kart: ${names(doc.templates)}.`);
    if ((doc.forms ?? []).length > 0) out.push(`Sposoby dodawania: ${names(doc.forms)}.`);
    if ((doc.views ?? []).length > 0) out.push(`Widoki: ${names(doc.views)}.`);
    out.push('');
  }
  return out.join('\n');
}

/** Die App, so weit die Anhänge sie brauchen. */
export async function appDescriptions() {
  const out = await mkdtemp(join(tmpdir(), 'ksiazka-guide-'));
  try {
    const entry = join(out, 'entry.ts');
    const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
    await writeFile(entry, `export { workWithTextDescription } from '${app}library/sourceImport';\nexport { courseDescription } from '${app}cogita/json';\n`);
    await build({
      entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error', loader: { '.css': 'empty' },
      define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
    });
    globalThis.BroadcastChannel = undefined;
    const mod = await import(pathToFileURL(join(out, 'entry.js')).href);
    return { workWithText: mod.workWithTextDescription(), course: mod.courseDescription() };
  } finally {
    await rm(out, { recursive: true, force: true });
  }
}

/** Der Leitfaden mit allen drei Anhängen. */
export async function guideWith(guide, app) {
  const files = await Promise.all(TEMPLATE_FILES.map(async (file) => [file, JSON.parse(await readFile(`../templates/cogita/${file}`, 'utf8'))]));
  let next = withAppendix(guide, 'work-with-text', app.workWithText);
  next = withAppendix(next, 'cogita-json', app.course);
  return withAppendix(next, 'template-kinds', kindsOfTemplates(files));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const guide = (await readFile(GUIDE, 'utf8')).replace(/\r\n/g, '\n');
  const next = await guideWith(guide, await appDescriptions());
  if (process.argv.includes('--check')) {
    console.log(next === guide ? 'Anhänge stimmen.' : 'Anhänge weichen von der App ab — node scripts/ksiazka-guide.mjs');
    process.exit(next === guide ? 0 : 1);
  }
  await writeFile(GUIDE, next);
  console.log(next === guide ? 'Anhänge waren schon aktuell.' : 'Anhänge neu geschrieben.');
}
