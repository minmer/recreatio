/**
 * 2026-10-25 (Wywód) — Anhang A des Leitfadens für die KI (`templates/cogita/wywod-AI.md`) aus der App:
 * die Beschreibung des Imports „Dzieło z tekstem" (`workWithTextDescription()` in `library/sourceImport.ts`),
 * wörtlich zwischen den Marken `<!-- app:work-with-text:start -->` und `<!-- app:work-with-text:end -->`.
 * `app-cogita-check` prüft, dass der Anhang mit der App übereinstimmt.
 *
 *   node scripts/wywod-guide.mjs          schreibt den Anhang neu
 *   node scripts/wywod-guide.mjs --check  sagt nur, ob er stimmt (Exit 1, wenn nicht)
 */

import { build } from 'esbuild';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const GUIDE = '../templates/cogita/wywod-AI.md';
export const START = '<!-- app:work-with-text:start -->';
export const END = '<!-- app:work-with-text:end -->';

/** Der Anhang, wie er zwischen den Marken stehen muss. */
export const appendixOf = (description) => `${START}\n\`\`\`text\n${description.trimEnd()}\n\`\`\`\n${END}`;

/** Der Leitfaden mit dem Anhang aus dieser Beschreibung. */
export function withAppendix(guide, description) {
  const a = guide.indexOf(START);
  const b = guide.indexOf(END);
  if (a < 0 || b < a) throw new Error('wywod-AI.md: Marken des Anhangs A fehlen');
  return `${guide.slice(0, a)}${appendixOf(description)}${guide.slice(b + END.length)}`;
}

async function description() {
  const out = await mkdtemp(join(tmpdir(), 'wywod-guide-'));
  try {
    await build({
      entryPoints: { sourceImport: 'src/app/library/sourceImport.ts' }, bundle: true, format: 'esm', platform: 'node', outdir: out,
      define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }, loader: { '.css': 'empty' }, logLevel: 'error'
    });
    globalThis.BroadcastChannel = undefined;
    const mod = await import(pathToFileURL(join(out, 'sourceImport.js')).href);
    return mod.workWithTextDescription();
  } finally {
    await rm(out, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const guide = await readFile(GUIDE, 'utf8');
  const next = withAppendix(guide, await description());
  if (process.argv.includes('--check')) {
    console.log(next === guide ? 'Anhang A stimmt.' : 'Anhang A weicht von der App ab — node scripts/wywod-guide.mjs');
    process.exit(next === guide ? 0 : 1);
  }
  await writeFile(GUIDE, next);
  console.log(next === guide ? 'Anhang A war schon aktuell.' : 'Anhang A neu geschrieben.');
}
