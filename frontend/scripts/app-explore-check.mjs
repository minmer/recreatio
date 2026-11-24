/**
 * 2026-11-24 — DER PRZEGLĄD (`src/app/cogita/explore/exploreModel.ts`), ohne Browser:
 *   1. der Strom einer Welt: Türme in der Reihenfolge der Welt, je Pfad die Schritte in der Reihenfolge der Erzählung (jeder Zweig
 *      einmal), Nachhilfe danach und als Hilfe markiert, dann was ohne Pfad am Turm hängt;
 *   2. Auswahl (Turm, Pfad, alle Folien, alle Fragen) und Filter (Folien / Fragen / nur mit Problemen);
 *   3. die Teilwelt einer Klasse beschneidet den Strom wie die Karte;
 *   4. das Polecenie für die KI nennt die bleibenden Namen, die Uwagi, die Befunde und den Weg über MCP.
 *
 *   node scripts/app-explore-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const workspace = await mkdtemp(join(tmpdir(), 'app-explore-'));
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(join(workspace, 'entry.ts'), `
export { memoryBase } from '${app}cogita/memoryBase';
export { buildExplore, streamOf, flatItems, aiPrompt } from '${app}cogita/explore/exploreModel';
`);
await build({
  entryPoints: [join(workspace, 'entry.ts')], bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', jsx: 'automatic',
  plugins: [{ name: 'no-css', setup(b) { b.onResolve({ filter: /\.css$/ }, (a) => ({ path: a.path, namespace: 'no-css' })); b.onLoad({ filter: /.*/, namespace: 'no-css' }, () => ({ contents: '', loader: 'js' })); } }],
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const m = await import(pathToFileURL(join(workspace, 'entry.js')).href);

let passed = 0;
let failed = 0;
const check = (name, got, want) => {
  try { assert.deepEqual(got, want); passed += 1; console.log(`ok   ${name}`); } catch { failed += 1; console.log(`FAIL ${name}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`); }
};

const slide = (ref, title, tower) => ({ ref, kinds: ['@x/slajd'], data: { tytul: title, tekst: [{ type: 'paragraph', text: `Tekst: ${title}.` }], wyjasnia: tower } });
const q = (ref, prompt, about, extra = {}) => ({ ref, kinds: ['question'], data: { form: 'one', prompt, options: ['Tak', 'Nie', 'Może', 'Nigdy'], correct: [0], about: [about], feedback: ['a', 'b', 'c', 'd'], tags: ['', 'b1', 'b2', 'b3'], ...extra } });
const edges = (list) => list.map(([from, out, to], i) => ({ id: `e${i}`, from, out, to, in: 'in' }));
const world = {
  format: 'recreatio.cogita.course', version: 1, name: 'Przegląd — test',
  kinds: [
    { ref: '@x/temat', name: 'Temat nauki', label: '{nazwa}', fields: [{ key: 'nazwa', label: 'Nazwa', type: 'line' }, { key: 'wymaga', label: 'Wymaga', type: 'ref', to: ['@x/temat'], multi: true, prerequisite: 'up' }] },
    { ref: '@x/slajd', name: 'Slajd', label: '{tytul}', fields: [{ key: 'tytul', label: 'Tytuł', type: 'line' }, { key: 'tekst', label: 'Tekst', type: 'blocks' }, { key: 'wyjasnia', label: 'Wyjaśnia', type: 'ref', to: ['@x/temat'] }] },
    { ref: '@x/jednostka', name: 'Jednostka', label: '{nazwa}', fields: [{ key: 'nazwa', label: 'Nazwa', type: 'line' }, { key: 'wymaga', label: 'Wymaga', type: 'ref', to: ['@x/temat'], multi: true, prerequisite: 'up' }] }
  ],
  entities: [
    { ref: '@x/t1', kinds: ['@x/temat'], data: { nazwa: 'Gniew' } },
    { ref: '@x/t2', kinds: ['@x/temat'], data: { nazwa: 'Pojedynek', wymaga: ['@x/t1'] } },
    { ref: '@x/u1', kinds: ['@x/jednostka'], data: { nazwa: 'Jednostka 1' } },
    { ref: '@x/u2', kinds: ['@x/jednostka'], data: { nazwa: 'Jednostka 2', wymaga: ['@x/t1'] } },
    slide('@x/s1', 'Kłótnia', '@x/t1'), slide('@x/s2', 'Droga A', '@x/t1'), slide('@x/s3', 'Droga B', '@x/t1'), slide('@x/sh', 'Pomoc', '@x/t1'),
    slide('@x/s4', 'Pościg', '@x/t2'), slide('@x/sl', 'Luźny slajd', '@x/t2'),
    q('@x/q1', 'Kto się kłóci?', '@x/t1'), q('@x/q2', 'Kto ginie?', '@x/t2'), q('@x/ql', 'Luźne pytanie?', '@x/t2', { feedback: [] })
  ],
  flows: [
    {
      ref: '@x/f1', name: 'Pierwsza droga', look: 'reading', unit: '@x/u1', start: 'a',
      graph: {
        nodes: [
          { id: 'a', type: 'show', config: { of: '@x/s1' } },
          { id: 'b', type: 'question', config: { of: '@x/q1' } },
          { id: 'h', type: 'show', config: { of: '@x/sh', remedial: true } },
          { id: 'c', type: 'choice', config: { options: [{ label: 'A' }, { label: 'B' }] } },
          { id: 'd', type: 'show', config: { of: '@x/s2' } },
          { id: 'f', type: 'show', config: { of: '@x/s3' } },
          { id: 'z', type: 'end', config: {} }
        ],
        edges: edges([['a', 'next', 'b'], ['b', 'right', 'c'], ['b', 'wrong', 'h'], ['h', 'next', 'c'], ['c', 'o0', 'd'], ['c', 'o1', 'f'], ['d', 'next', 'z'], ['f', 'next', 'z']])
      }
    },
    {
      ref: '@x/f2', name: 'Druga droga', look: 'reading', unit: '@x/u2', start: 'a',
      graph: {
        nodes: [{ id: 'a', type: 'show', config: { of: '@x/s4' } }, { id: 'b', type: 'question', config: { of: '@x/q2' } }, { id: 'z', type: 'end', config: {} }],
        edges: edges([['a', 'next', 'b'], ['b', 'right', 'z'], ['b', 'wrong', 'z']])
      }
    }
  ],
  views: [{ ref: '@x/mapa', name: 'Mapa', mode: 'landscape', steps: [{ type: 'source.kind', config: { kind: '@x/temat' } }], landscape: { style: 'world' } }]
};

try {
  const made = await m.memoryBase(world, { libraryId: 'ex-1', areaId: 'ex-a' });
  assert.ok(!('error' in made), made.error);
  const lib = made.writer;
  const { cards } = await lib.cards();
  const id = (ref) => lib.byImportRef(ref.replace(/^@/, ''), 'entity').id;
  const flowId = (ref) => lib.byImportRef(ref.replace(/^@/, ''), 'doc')?.id ?? lib.docs('flow').find((d) => d.data._ref === ref.replace(/^@/, ''))?.id;
  const model = m.buildExplore(lib, cards);
  const name = (itemId) => model.label(itemId);
  const all = m.streamOf(model, { kind: 'all' });

  check('1. towers in world order (basics first), each with its path', [model.order.map(name), [...model.towers.values()].map((t) => t.paths.map((p) => p.name))], [['Gniew', 'Pojedynek'], [['Pierwsza droga'], ['Druga droga']]]);
  const p1 = all.find((s) => s.flow === flowId('@x/f1'));
  check('1. path order = the story: slide, question, both branches once, help last (marked help)', p1.items.map((i) => [name(i.id), i.help]), [['Kłótnia', false], ['Kto się kłóci?', false], ['Droga A', false], ['Droga B', false], ['Pomoc', true]]);
  check('1. what hangs at a tower without a path comes after its paths: slides first, then questions', all.find((s) => s.kind === 'loose')?.items.map((i) => name(i.id)), ['Luźny slajd', 'Luźne pytanie?']);
  check('1. section order: tower 1 path, tower 2 path, tower 2 loose', all.map((s) => [s.kind, s.tower === null ? null : name(s.tower)]), [['path', 'Gniew'], ['path', 'Pojedynek'], ['loose', 'Pojedynek']]);

  check('2. one tower', m.flatItems(m.streamOf(model, { kind: 'tower', id: id('@x/t2') })).map((i) => name(i.id)), ['Pościg', 'Kto ginie?', 'Luźny slajd', 'Luźne pytanie?']);
  check('2. one path', m.flatItems(m.streamOf(model, { kind: 'path', flow: flowId('@x/f2') })).map((i) => name(i.id)), ['Pościg', 'Kto ginie?']);
  check('2. all slides: each once, in stream order', m.flatItems(m.streamOf(model, { kind: 'slides' })).map((i) => name(i.id)), ['Kłótnia', 'Droga A', 'Droga B', 'Pomoc', 'Pościg', 'Luźny slajd']);
  check('2. all questions', m.flatItems(m.streamOf(model, { kind: 'questions' })).map((i) => name(i.id)), ['Kto się kłóci?', 'Kto ginie?', 'Luźne pytanie?']);
  check('2. filter: only slides / only questions', [m.flatItems(m.streamOf(model, { kind: 'all' }, 'slides')).length, m.flatItems(m.streamOf(model, { kind: 'all' }, 'questions')).length], [6, 3]);
  const problem = new Set([id('@x/ql'), id('@x/s2')]);
  check('2. filter: only with problems — empty sections fall away', m.streamOf(model, { kind: 'all' }, 'both', (i) => problem.has(i.id)).map((s) => s.items.map((i) => name(i.id))), [['Droga A'], ['Luźne pytanie?']]);
  check('2. counts of the model', [model.slides.size, model.questions.size], [6, 3]);

  const sub = m.buildExplore(lib, cards, { tags: [], places: [id('@x/t1')], withBase: true });
  check('3. the sub-world of a class: only its towers, their paths and items', [sub.order.map((x) => sub.label(x)), m.flatItems(m.streamOf(sub, { kind: 'all' })).map((i) => sub.label(i.id))], [['Gniew'], ['Kłótnia', 'Kto się kłóci?', 'Droga A', 'Droga B', 'Pomoc']]);

  const text = m.aiPrompt({ base: 'Iliada', handle: 'iliada', note: 'Za długie slajdy.', items: [
    { ref: model.ref(id('@x/s2')), kind: 'slide', label: 'Droga A', where: 'Gniew', notes: ['wrong: literówka'], findings: ['Slajd ma 150 słów.'] }
  ] });
  check('4. the prompt: base, handle, note, the lasting name, note and finding lines, the MCP way', [
    text.includes('„Iliada”'), text.includes('handle: iliada'), text.includes('Za długie slajdy.'), text.includes('@x/s2'), text.includes('literówka'), text.includes('150 słów'), /get_feedback/.test(text) && /check_import/.test(text)
  ], [true, true, true, true, true, true, true]);
} finally {
  await rm(workspace, { recursive: true, force: true });
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
