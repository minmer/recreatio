/**
 * 2026-10-27 — DIE VORLAGE `templates/cogita/pytania.json` AUS DER APP: das eine Schema der Frage
 * (der eingebaute Rodzaj „Pytanie" mit seinen Rodzaje pytań und den Feldern je Art, wie
 * `cogita/kinds.ts` QUESTION und `cogita/questionTypes.ts` sie haben), dazu Sposoby dodawania für
 * viele Fragen auf einmal und ein Widok. Der Rodzaj kommt aus dem Code, nicht abgeschrieben;
 * `app-cogita-check` prüft, dass die Datei mit der App übereinstimmt.
 *
 *   node scripts/pytania-template.mjs          schreibt die Datei neu
 *   node scripts/pytania-template.mjs --check  sagt nur, ob sie stimmt (Exit 1, wenn nicht)
 */

import { build } from 'esbuild';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const FILE = '../templates/cogita/pytania.json';

/** Ein Sposób dodawania: oben „O czym" (für alle Zeilen, frei), in jeder Zeile ein Pytanie dieser Art. */
const form = (ref, name, says, fields, columns = '|') => ({
  ref,
  name,
  says,
  graph: {
    nodes: [
      { id: 'o', type: 'pick', x: 0, y: 0, config: { label: 'O czym (dla wszystkich wierszy)', kinds: [], many: true, optional: true, value: [] } },
      { id: 'q', type: 'entry', x: 320, y: 0, config: { kind: 'question', label: 'Pytanie', many: false, reuse: 'same', identity: ['prompt'], fields } }
    ],
    edges: [{ id: 'e1', from: 'o', out: 'out', to: 'q', in: 'about' }]
  },
  keys: { enter: 'next', ctrlEnter: 'more', shiftEnter: 'save' },
  paste: { columns, values: ';', header: false }
});

/** Das Dokument — der Rodzaj aus der App (`kindDoc(QUESTION)`), der Rest hier. */
export function templateOf(app) {
  const kind = app.kindDoc(app.QUESTION);
  return {
    format: 'recreatio.cogita.schema',
    version: 1,
    name: 'Pytania — jeden schemat, wiele rodzajów pytań',
    kinds: [{ ref: '@pytania/pytanie', ...kind }],
    forms: [
      form('@pytania/f-prawda-falsz', 'Prawda czy fałsz — wiele naraz',
        'W każdym wierszu zdanie i „prawda” albo „fałsz”, np. „Atom jest niepodzielny | fałsz”. Na początek można wybrać, o czym są (np. pojęcie) — pytania liczą się wtedy do jego znajomości i czekają na to, co trzeba znać przed nim.',
        { form: { from: 'fixed', value: 'truefalse' }, prompt: { from: 'type' }, value: { from: 'type' } }),
      form('@pytania/f-slowami', 'Pytania z odpowiedzią słowami — wiele naraz',
        'W każdym wierszu pytanie i dobra odpowiedź; kilka dobrych oddziela „;”, np. „Ile protonów ma atom węgla? | 6; sześć”.',
        { form: { from: 'fixed', value: 'text' }, prompt: { from: 'type' }, answers: { from: 'type' } }),
      form('@pytania/f-jedna', 'Jedna z kilku — wiele naraz (pierwsza możliwość jest dobra)',
        'W każdym wierszu pytanie i możliwości oddzielone „;” — PIERWSZA jest dobra (na karcie i tak się mieszają), np. „Co jest w jądrze atomu? | protony i neutrony; elektrony; fotony”.',
        { form: { from: 'fixed', value: 'one' }, prompt: { from: 'type' }, options: { from: 'type' }, correct: { from: 'fixed', value: '0' } }),
      form('@pytania/f-fiszki', 'Fiszki — wiele naraz',
        'W każdym wierszu przód i odwrotna strona, np. „Izotop | atom tego samego pierwiastka o innej liczbie neutronów”.',
        { form: { from: 'fixed', value: 'flash' }, prompt: { from: 'type' }, back: { from: 'type' } })
    ],
    views: [
      {
        ref: '@pytania/w-rodzaj',
        name: 'Pytania według rodzaju',
        mode: 'tree',
        steps: [{ type: 'source.kind', config: { kind: 'question' } }],
        group: { by: 'field', field: 'form' },
        query: '',
        columns: ['prompt', 'form', 'about'],
        positions: {}
      }
    ]
  };
}

export const textOf = (doc) => `${JSON.stringify(doc, null, 2)}\n`;

/** Die App, so weit die Vorlage sie braucht. */
export async function loadApp() {
  const out = await mkdtemp(join(tmpdir(), 'pytania-'));
  try {
    const entry = join(out, 'entry.ts');
    const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
    await writeFile(entry, `export { kindDoc, QUESTION } from '${app}cogita/kinds';\n`);
    await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error', loader: { '.css': 'empty' } });
    return await import(pathToFileURL(join(out, 'entry.js')).href);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const want = textOf(templateOf(await loadApp()));
  const have = await readFile(FILE, 'utf8').catch(() => '');
  const same = have.replace(/\r\n/g, '\n') === want;
  if (process.argv.includes('--check')) {
    console.log(same ? 'pytania.json stimmt.' : 'pytania.json weicht von der App ab — node scripts/pytania-template.mjs');
    process.exit(same ? 0 : 1);
  }
  await writeFile(FILE, want);
  console.log(same ? 'pytania.json war schon aktuell.' : 'pytania.json neu geschrieben.');
}
