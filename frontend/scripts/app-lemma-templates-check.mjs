/**
 * 2026-11-01 — RECHNEN IN KARTENVORLAGEN (Lemma; COGITA.md §5), nachgemessen.
 *
 * „Oblicz" (`calc`: Ausdrücke in der Sprache der Rysunki, p0…p7 und n0…n7), „Zbierz" (`aggregate`: Summe, Anzahl,
 * kleinste, grösste, Mittel) und „Losowa wartość" (Bereich oder Liste) — an einer kleinen Chemie: wie viele Protonen
 * hat eine Verbindung? Dazu Zahlen-Dystraktoren aus „Oblicz" für „Odpowiedź: jeden wybór", lesbare Fehler, und Felder
 * mit Wzory, die als `$…$` in die Karte gehen (nur, wo wirklich ein Wzór steht). Rein, ohne Browser.
 *
 *   node scripts/app-lemma-templates-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-lemma-templates-'));
const names = ['schema', 'graph', 'cards', 'cardPalette', 'nodeFields'];
await build({
  entryPoints: Object.fromEntries(names.map((n) => [n, `src/app/cogita/${n}.ts`])),
  bundle: true,
  format: 'esm',
  platform: 'node',
  outdir: workspace,
  logLevel: 'error',
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [S, G, Cards, Pal, NF] = await Promise.all(names.map(load));

let failed = 0;
let passed = 0;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const check = (name, got, want) => {
  const ok = typeof want === 'number' && typeof got === 'number' ? near(got, want) : JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};
const truth = (name, ok, detail) => {
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}${detail === undefined ? '' : `\n  ${JSON.stringify(detail)}`}`); }
};

/* ── Eine kleine Chemie ─────────────────────────────────────────────── */

const ELEMENT = S.readKind('k-el', {
  name: 'Pierwiastek', label: '{name}',
  fields: [{ key: 'name', label: 'Nazwa', type: 'line' }, { key: 'symbol', label: 'Symbol', type: 'line' }, { key: 'protons', label: 'Protony', type: 'number' }]
});
const COMPOUND = S.readKind('k-comp', {
  name: 'Związek', label: '{name}',
  fields: [
    { key: 'name', label: 'Nazwa', type: 'line' },
    { key: 'components', label: 'Składniki', type: 'ref', multi: true, to: ['k-el'] },
    { key: 'formula', label: 'Wzór', type: 'markup' }
  ]
});
/* 2026-11-01 — ein Begriff, dessen Name ein Wzór ist (das Etikett geht mit `$…$` in die Karte). */
const TERM = S.readKind('k-term', { name: 'Pojęcie', label: '{term}', fields: [{ key: 'term', label: 'Pojęcie', type: 'markup' }, { key: 'says', label: 'Znaczy', type: 'markup' }] });

const e = (id, kinds, data) => ({ id, kinds, data });
const ENTITIES = [
  e('h', ['k-el'], { name: 'wodór', symbol: 'H', protons: 1 }),
  e('c', ['k-el'], { name: 'węgiel', symbol: 'C', protons: 6 }),
  e('n', ['k-el'], { name: 'azot', symbol: 'N', protons: 7 }),
  e('o', ['k-el'], { name: 'tlen', symbol: 'O', protons: 8 }),
  /* Ein Bestandteil zweimal ist zweimal da (H₂O: H, H, O). */
  e('water', ['k-comp'], { name: 'woda', components: ['h', 'h', 'o'], formula: '$\\mathrm{H_2O}$' }),
  e('co2', ['k-comp'], { name: 'dwutlenek węgla', components: ['c', 'o', 'o'], formula: 'CO2 (bez wzoru)' }),
  e('nh3', ['k-comp'], { name: 'amoniak', components: ['n', 'h', 'h', 'h'], formula: 'Cena 5\\$ za kg' }),
  e('none', ['k-comp'], { name: 'pusty związek' }),
  e('nat', ['k-term'], { term: '$\\mathbb{N}$', says: 'liczby naturalne' }),
  e('plain', ['k-term'], { term: 'zbiór', says: 'kolekcja elementów' })
];
const KINDS = [ELEMENT, COMPOUND, TERM];
const look = S.lookupOf(KINDS, ENTITIES);
const byId = (id) => ENTITIES.find((x) => x.id === id);
const pool = (k) => ENTITIES.filter((x) => x.kinds.includes(k));
const ctx = (id, seed = 's1') => ({ look, entity: byId(id), pool, seed });

const tpl = (id, kinds, nodes, edges) => Cards.readTemplate(id, { name: id, kinds, direction: '', graph: { nodes, edges } });
const n = (id, type, config = {}, y = 0) => ({ id, type, x: 0, y, config });
const l = (id, from, out, to, into) => ({ id, from, out, to, in: into });
const cards = async (t, id, seed) => (await Cards.cardsOf(t, ctx(id, seed))).cards;
const made = async (t, id, seed) => Cards.cardsOf(t, ctx(id, seed));
/** Was ein Knoten bei einem Eintrag gibt — der Graph allein ausgewertet. */
const outputOf = async (t, id, node, port = 'value') => {
  const r = await G.evaluate(t.graph, Pal.TEMPLATE_PALETTE, ctx(id));
  return { items: r.outputs.get(node)?.[port] ?? null, error: r.errors.get(node) ?? null };
};

/* ── Die Palette ────────────────────────────────────────────────────── */

truth('the palette has „Oblicz" and „Zbierz" in the group „Liczby"', Pal.TEMPLATE_PALETTE.kinds.get('calc')?.group === 'Liczby' && Pal.TEMPLATE_PALETTE.kinds.get('aggregate')?.group === 'Liczby');
check('„Oblicz" has as many inputs as set (1–8), all taking many edges', Pal.TEMPLATE_PALETTE.kinds.get('calc').ports({ inputs: 3 }).inputs.map((p) => [p.id, p.many]), [['p0', true], ['p1', true], ['p2', true]]);
check('… at least one, at most eight', [Pal.TEMPLATE_PALETTE.kinds.get('calc').ports({}).inputs.length, Pal.TEMPLATE_PALETTE.kinds.get('calc').ports({ inputs: 40 }).inputs.length], [1, 8]);
check('„Zbierz" takes values and gives one value', (() => { const p = Pal.TEMPLATE_PALETTE.kinds.get('aggregate').ports({}); return [p.inputs.map((x) => x.id), p.outputs.map((x) => x.id)]; })(), [['values'], ['value']]);
check('the editor offers their settings', [NF.configFields('card-template', 'calc').map((f) => f.key), NF.configFields('card-template', 'aggregate').map((f) => f.key), NF.configFields('card-template', 'random').map((f) => f.key)], [['expr', 'inputs', 'decimals'], ['op', 'decimals'], ['min', 'max', 'step', 'list', 'count']]);
truth('their outputs connect to a pattern, „Odpowiedź: liczba" and „Odpowiedź: jeden wybór"', ['pattern', 'answer.number', 'answer.one'].every((to) => {
  const graph = { nodes: [n('c', 'calc', { expr: 'p0' }), n('a', 'aggregate'), n('t', to, { inputs: 1 })], edges: [] };
  const into = Pal.TEMPLATE_PALETTE.kinds.get(to).ports({ inputs: 1 }).inputs[to === 'answer.one' ? 1 : 0].id;
  return ['c', 'a'].every((from) => 'graph' in G.connect(graph, Pal.TEMPLATE_PALETTE, { id: `e-${from}`, from, out: 'value', to: 't', in: into }));
}));

/* ── „Zbierz": die Protonen einer Verbindung ────────────────────────── */

const SUM = tpl('protons', ['k-comp'], [
  n('name', 'field', { key: 'name' }), n('ask', 'pattern', { text: 'Ile protonów ma {0}?', inputs: 1 }), n('prompt', 'prompt'),
  n('comps', 'follow', { path: ['components'] }, 50), n('prot', 'field', { key: 'protons' }, 50), n('sum', 'aggregate', { op: 'sum' }, 50),
  n('num', 'answer.number', {}, 50), n('card', 'card', {}, 100)
], [
  l('1', 'name', 'values', 'ask', 'p0'), l('2', 'ask', 'text', 'prompt', 'parts'),
  l('3', 'comps', 'entities', 'prot', 'of'), l('4', 'prot', 'values', 'sum', 'values'), l('5', 'sum', 'value', 'num', 'expected'),
  l('6', 'prompt', 'prompt', 'card', 'prompt'), l('7', 'num', 'answer', 'card', 'answer')
]);
const water = (await cards(SUM, 'water'))[0];
check('„Ile protonów ma woda?" — the pattern writes the question', water?.prompt.map((p) => p.text), ['Ile protonów ma woda?']);
check('… and the answer sums the protons of H, H, O (one component twice counts twice)', [water?.answer.form, water?.answer.values], ['number', [10]]);
check('carbon dioxide: C, O, O → 22', (await cards(SUM, 'co2'))[0]?.answer.values, [22]);
check('ammonia: N, H, H, H → 10', (await cards(SUM, 'nh3'))[0]?.answer.values, [10]);
const empty = await made(SUM, 'none');
check('a compound without components makes no card — and no problem (like an empty field)', [empty.cards.length, empty.problems.length], [0, 0]);
truth('a template that computes nothing random does not vary', water !== undefined && water.varies === false);

const AGG = (op, extra = {}) => tpl(`agg-${op}`, ['k-comp'], [
  n('comps', 'follow', { path: ['components'] }), n('prot', 'field', { key: 'protons' }), n('a', 'aggregate', { op, ...extra })
], [l('1', 'comps', 'entities', 'prot', 'of'), l('2', 'prot', 'values', 'a', 'values')]);
const aggOf = async (op, id, extra) => (await outputOf(AGG(op, extra), id, 'a')).items?.map((i) => [i.text, i.value]);
check('aggregate count: water has three components', await aggOf('count', 'water'), [['3', 3]]);
check('… count of nothing is 0 (counting is always possible)', await aggOf('count', 'none'), [['0', 0]]);
check('… min and max over C, O, O', [await aggOf('min', 'co2'), await aggOf('max', 'co2')], [[['6', 6]], [['8', 8]]]);
check('… the average with a decimal comma, rounded as set', await aggOf('avg', 'co2', { decimals: 2 }), [['7,33', 7.33]]);
check('… without rounding: no float noise, all the digits that are there', await aggOf('avg', 'co2'), [['7,33333333333', 7.33333333333]]);
check('… sum of nothing gives nothing (so no card)', await aggOf('sum', 'none'), []);
check('… an unknown op is a sum', await aggOf('nope', 'water'), [['10', 10]]);
{
  /* Etiketten sind keine Zahlen: „Zbierz" über die Einträge selbst zählt nur. */
  const t = tpl('labels', ['k-comp'], [n('comps', 'follow', { path: ['components'] }), n('a', 'aggregate', { op: 'sum' }), n('c', 'aggregate', { op: 'count' })],
    [l('1', 'comps', 'entities', 'a', 'values'), l('2', 'comps', 'entities', 'c', 'values')]);
  check('entries (their labels) are no numbers for a sum — but they count', [(await outputOf(t, 'water', 'a')).items, (await outputOf(t, 'water', 'c')).items.map((i) => i.value)], [[], [3]]);
}

/* ── „Oblicz" ────────────────────────────────────────────────────────── */

const CALC = (expr, lists, extra = {}) => tpl('calc', ['k-comp'], [
  ...lists.map((items, i) => n(`in${i}`, 'list', { items }, i * 10)),
  n('c', 'calc', { expr, inputs: Math.max(1, lists.length), ...extra }, 100)
], lists.map((_x, i) => l(`e${i}`, `in${i}`, 'values', 'c', `p${i}`)));
const calcOf = async (expr, lists, extra) => {
  const r = await outputOf(CALC(expr, lists, extra), 'water', 'c');
  return r.error !== null ? { error: r.error } : r.items.map((i) => (i.value === undefined ? [i.text] : [i.text, i.value]));
};
check('calc: mod, round, fmt — one value per line', await calcOf('mod(p0, 3)\nround(p0 / 3, 2)\nfmt(p0, 2)', [['17']]), [['2', 2], ['5,67', 5.67], ['17,00', 17]]);
check('… or per „;", with two inputs', await calcOf('p0 * p1; p1 - p0', [['3'], ['4']]), [['12', 12], ['1', 1]]);
check('… n0 is how many values arrived', await calcOf('n0 * 10 + p0', [['5', '6', '7']]), [['35', 35]]);
check('… a decimal comma in, a decimal comma out, no float noise (0,1 + 0,2)', await calcOf('p0 + p1', [['0,1'], ['0,2']]), [['0,3', 0.3]]);
check('… a negative number keeps a plain minus (so a typed answer reads it)', await calcOf('p0 - 10; fmt(p0 - 10, 1)', [['3']]), [['-7', -7], ['-7,0', -7]]);
check('… rounding as set', await calcOf('p0 / 3', [['10']], { decimals: 1 }), [['3,3', 3.3]]);
check('… a result that is no number (division by zero) drops out, the others stay', await calcOf('p0 / 0; p0 + 1', [['4']]), [['5', 5]]);
truth('… nothing computable is an error the editor shows', ((await calcOf('p0 / 0', [['4']])).error ?? '').includes('Żadne wyrażenie'));
const unknown = await calcOf('q + 1', [['4']]);
truth('… an unknown name is a readable error (with the expression)', (unknown.error ?? '').includes('„q + 1”') && unknown.error.includes('nieznana nazwa'), unknown);
truth('… a broken expression too', ((await calcOf('p0 +* 2', [['4']])).error ?? '').startsWith('„p0 +* 2”'));
truth('… an empty input it reads is said by name', ((await calcOf('p0 + p1', [['4'], []])).error ?? '').includes('Wejście p1 nie dało liczby'));
check('… an empty input it does not read is fine', await calcOf('p0 + 1', [['4'], []]), [['5', 5]]);
truth('… no expression at all is an error', ((await calcOf('', [['4']])).error ?? '').includes('nie ma wyrażenia'));
check('… constants of the language work (pi)', await calcOf('round(pi * p0, 2)', [['2']]), [['6,28', 6.28]]);
{
  /* Eine Zahl aus einem Feld (wie „Pole" sie gibt) ist eine Zahl — ein Eintrag (sein Etikett) nicht. */
  const t = tpl('calc-field', ['k-comp'], [n('comps', 'follow', { path: ['components'] }), n('prot', 'field', { key: 'protons' }), n('c', 'calc', { expr: 'p0 * 2', inputs: 1 }), n('x', 'calc', { expr: 'p0', inputs: 1 }, 50)],
    [l('1', 'comps', 'entities', 'prot', 'of'), l('2', 'prot', 'values', 'c', 'p0'), l('3', 'comps', 'entities', 'x', 'p0')]);
  check('calc reads the first number of a field', (await outputOf(t, 'water', 'c')).items.map((i) => i.value), [2]);
  truth('… an entry as input is no number', ((await outputOf(t, 'water', 'x')).error ?? '').includes('nie dało liczby'));
}

/* ── Zahlen-Dystraktoren: „Oblicz" → „Odpowiedź: jeden wybór" ───────────── */

const CHOICE = tpl('choice', ['k-comp'], [
  n('a', 'list', { items: ['3'] }), n('b', 'list', { items: ['4'] }, 10),
  n('right', 'calc', { expr: 'p0 * p1', inputs: 2 }, 20), n('wrong', 'calc', { expr: 'p0 + 1; p0 - 1; p0 * 2', inputs: 1 }, 30),
  n('ask', 'pattern', { text: 'Ile to jest {0} × {1}?', inputs: 2 }, 40), n('prompt', 'prompt', {}, 50),
  n('one', 'answer.one', {}, 60), n('card', 'card', {}, 70)
], [
  l('1', 'a', 'values', 'right', 'p0'), l('2', 'b', 'values', 'right', 'p1'), l('3', 'right', 'value', 'wrong', 'p0'),
  l('4', 'right', 'value', 'one', 'expected'), l('5', 'wrong', 'value', 'one', 'distractors'),
  l('6', 'a', 'values', 'ask', 'p0'), l('7', 'b', 'values', 'ask', 'p1'), l('8', 'ask', 'text', 'prompt', 'parts'),
  l('9', 'prompt', 'prompt', 'card', 'prompt'), l('10', 'one', 'answer', 'card', 'answer')
]);
const choice = (await cards(CHOICE, 'water'))[0];
check('the choice holds the right answer and ±1, ×2', choice?.answer.options.slice().sort(), ['11', '12', '13', '24']);
check('… and the right one is marked', choice?.answer.options[choice.answer.correct], '12');
check('… the question reads as written', choice?.prompt.map((p) => p.text), ['Ile to jest 3 × 4?']);
{
  /* p0 = 0: „p0 * 2" ist die richtige Antwort selbst — sie steht nur einmal da. */
  const zero = tpl('zero', ['k-comp'], [n('a', 'list', { items: ['0'] }), n('w', 'calc', { expr: 'p0 + 1; p0 * 2', inputs: 1 }, 10), n('one', 'answer.one', {}, 20), n('card', 'card', {}, 30)],
    [l('1', 'a', 'values', 'one', 'expected'), l('2', 'a', 'values', 'w', 'p0'), l('3', 'w', 'value', 'one', 'distractors'), l('4', 'one', 'answer', 'card', 'answer')]);
  check('a distractor equal to the right answer is left out', (await cards(zero, 'water'))[0]?.answer.options.slice().sort(), ['0', '1']);
}

/* ── „Losowa wartość": jedes Mal anders, die Karte „losowa" ────────────────── */

const SQUARE = tpl('square', ['k-comp'], [
  n('r', 'random', { min: 2, max: 9 }), n('sq', 'calc', { expr: 'p0 * p0', inputs: 1 }, 10), n('ask', 'pattern', { text: 'Ile to jest {0}²?', inputs: 1 }, 20),
  n('prompt', 'prompt', {}, 30), n('num', 'answer.number', {}, 40), n('card', 'card', {}, 50)
], [
  l('1', 'r', 'value', 'sq', 'p0'), l('2', 'r', 'value', 'ask', 'p0'), l('3', 'ask', 'text', 'prompt', 'parts'),
  l('4', 'sq', 'value', 'num', 'expected'), l('5', 'prompt', 'prompt', 'card', 'prompt'), l('6', 'num', 'answer', 'card', 'answer')
]);
const seeds = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const squares = [];
for (const seed of seeds) squares.push((await cards(SQUARE, 'water', seed))[0]);
truth('every drawn question asks what it computed', squares.every((c) => { const x = Number(c.prompt[0].text.match(/\d+/)[0]); return c.answer.values[0] === x * x && x >= 2 && x <= 9; }), squares.map((c) => [c.prompt[0].text, c.answer.values]));
truth('a card computed from a random value varies — its history is the template', squares.every((c) => c.varies) && new Set(squares.map((c) => c.fingerprint)).size === 1);
truth('… and the seeds do draw different numbers', new Set(squares.map((c) => c.answer.values[0])).size > 1, squares.map((c) => c.answer.values[0]));
{
  const LISTED = tpl('listed', ['k-comp'], [n('r', 'random', { list: ['3', '5', '7'] }), n('c', 'calc', { expr: 'p0 + 1', inputs: 1 }, 10)], [l('1', 'r', 'value', 'c', 'p0')]);
  const drawn = [];
  for (const seed of seeds) {
    const r = await G.evaluate(LISTED.graph, Pal.TEMPLATE_PALETTE, ctx('water', seed));
    drawn.push([r.outputs.get('r').value[0].value, r.outputs.get('c').value[0].value]);
  }
  truth('random from a list typed in the node: one of them, still a number', drawn.every(([v, w]) => [3, 5, 7].includes(v) && w === v + 1), drawn);
  const both = tpl('both', ['k-comp'], [n('l', 'list', { items: ['x'] }), n('r', 'random', { list: ['y'] }, 10)], [l('1', 'l', 'values', 'r', 'items')]);
  const picks = new Set();
  for (const seed of seeds) picks.add((await G.evaluate(both.graph, Pal.TEMPLATE_PALETTE, ctx('water', seed))).outputs.get('r').value[0].text);
  check('… the list from the left and the typed one count together', [...picks].sort(), ['x', 'y']);
}

/* ── Wzory aus Feldern (2.1): `$…$` nur, wo wirklich ein Wzór steht ──────────── */

const FORMULA = tpl('formula', ['k-comp'], [n('f', 'field', { key: 'formula' }), n('t', 'answer.text', {}, 10), n('card', 'card', {}, 20)],
  [l('1', 'f', 'values', 't', 'expected'), l('2', 't', 'answer', 'card', 'answer')]);
check('a markup field with a formula goes into the card as $…$', (await cards(FORMULA, 'water'))[0]?.answer.accepted, ['$\\mathrm{H_2O}$']);
check('… a field without one stays as it was', (await cards(FORMULA, 'co2'))[0]?.answer.accepted, ['CO2 (bez wzoru)']);
check('… a dollar that is no formula stays a plain dollar (nobody types a backslash)', (await cards(FORMULA, 'nh3'))[0]?.answer.accepted, ['Cena 5$ za kg']);
const SELF = tpl('self', ['k-term'], [n('me', 'entity'), n('says', 'field', { key: 'says' }), n('t', 'answer.text', {}, 10), n('ask', 'pattern', { text: 'Co znaczy {0}?', inputs: 1 }, 20), n('prompt', 'prompt', {}, 30), n('card', 'card', {}, 40)],
  [l('1', 'says', 'values', 't', 'expected'), l('2', 'me', 'entities', 'ask', 'p0'), l('3', 'ask', 'text', 'prompt', 'parts'), l('4', 'prompt', 'prompt', 'card', 'prompt'), l('5', 't', 'answer', 'card', 'answer')]);
check('„Ten wpis": a label that is a formula is asked as $…$', (await cards(SELF, 'nat'))[0]?.prompt.map((p) => p.text), ['Co znaczy $\\mathbb{N}$?']);
check('… a plain label as before', (await cards(SELF, 'plain'))[0]?.prompt.map((p) => p.text), ['Co znaczy zbiór?']);

/* ── Was bleibt, wie es war ───────────────────────────────────────────── */

{
  const TIMES = tpl('times', ['k-comp'], [n('a', 'list', { items: ['6'] }), n('b', 'list', { items: ['7'] }, 10), n('mul', 'math', { op: 'mul' }, 20), n('num', 'answer.number', {}, 30), n('card', 'card', {}, 40)],
    [l('1', 'a', 'values', 'mul', 'a'), l('2', 'b', 'values', 'mul', 'a'), l('3', 'mul', 'value', 'num', 'expected'), l('4', 'num', 'answer', 'card', 'answer')]);
  const c = (await cards(TIMES, 'water'))[0];
  check('a template without the new steps works as before („Działanie")', [c?.answer.values, c?.varies], [[42], false]);
}

await rm(workspace, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
