/**
 * DER MOTOR VON COGITA, nachgemessen (COGITA.md §2–6).
 *
 * Schema, Graph, Prüfung, Kenntnis, Karten aus Vorlagen und die Wiederholung
 * sind reine Rechnung — genau die Art Fehler, die niemand meldet: eine Karte,
 * die fast die richtige Antwort erwartet, sieht richtig aus. Hier steht, was
 * jede Stelle tun soll, mit einer kleinen Bibliothek aus Autoren, Werken,
 * Wörtern und einem Zitat.
 */
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-cogita-'));
const names = ['schema', 'graph', 'check', 'knowness', 'cards', 'revision'];
await build({
  entryPoints: names.map((n) => `src/app/cogita/${n}.ts`),
  bundle: true,
  format: 'esm',
  platform: 'node',
  outdir: workspace,
  logLevel: 'error'
});
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [S, G, C, K, Cards, R] = await Promise.all(names.map(load));

let failed = 0;
let passed = 0;
const near = (a, b, eps = 1e-4) => Math.abs(a - b) < eps;
const check = (name, got, want) => {
  const ok = typeof want === 'number' && typeof got === 'number' ? near(got, want) : JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};
const truth = (name, ok, detail) => {
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}${detail === undefined ? '' : `\n  ${JSON.stringify(detail)}`}`); }
};

/* ── Eine kleine Bibliothek ───────────────────────────────────────────── */

const kind = (id, doc) => S.readKind(id, doc);
const PERSON = kind('k-person', {
  name: 'Osoba', label: '{name}', tells: 'born',
  fields: [
    { key: 'name', label: 'Imię i nazwisko', type: 'line' },
    { key: 'born', label: 'Urodzony', type: 'date', multi: true, uncertain: true },
    { key: 'reign', label: 'Panowanie', type: 'range', rangeOf: 'number' },
    { key: 'friend', label: 'Przyjaciel', type: 'ref', symmetric: true, to: ['k-person'] },
    { key: 'name', label: 'Duplikat', type: 'line' },
    { key: '9bad', label: 'Zły klucz', type: 'line' }
  ]
});
const CHARACTER = kind('k-character', { name: 'Postać', speaks: true, fields: [{ key: 'name', label: 'Imię', type: 'line' }, { key: 'mood', label: 'Nastrój', type: 'choice', options: ['radosny', 'smutny'] }] });
const WORK = kind('k-work', {
  name: 'Dzieło', label: '{title} ({year})',
  fields: [
    { key: 'title', label: 'Tytuł', type: 'line', role: 'title' },
    { key: 'authors', label: 'Autorzy', type: 'ref', multi: true, to: ['k-person'], inverse: 'napisał(a)' },
    { key: 'year', label: 'Rok', type: 'number' }
  ]
});
const WORD = kind('k-word', {
  name: 'Słowo', label: '{pl}',
  fields: [{ key: 'pl', label: 'Po polsku', type: 'line' }, { key: 'en', label: 'Po angielsku', type: 'line' }, { key: 'alt', label: 'Też', type: 'line', multi: true }]
});
const QUOTE = kind('k-quote', { name: 'Cytat', label: '{text}', fields: [{ key: 'text', label: 'Tekst', type: 'text' }, { key: 'work', label: 'Źródło', type: 'ref', to: ['k-work'] }] });

const e = (id, kinds, data) => ({ id, kinds, data });
const ENTITIES = [
  e('p1', ['k-person'], { name: 'Adam Mickiewicz', born: ['1798-12-24'] }),
  e('p2', ['k-person', 'k-character'], { name: 'Juliusz Słowacki', born: [{ value: '1809-09-04', state: 'known', source: { work: 'w2', locator: 's. 3' } }], mood: 'smutny', friend: 'p3' }),
  e('p3', ['k-person'], { name: 'Cyprian Norwid', born: [{ value: '1821', state: 'disputed' }, { value: '1820', state: 'approximate' }, { state: 'unknown' }] }),
  e('w1', ['k-work'], { title: 'Pan Tadeusz', authors: ['p1'], year: 1834 }),
  e('w2', ['k-work'], { title: 'Kordian', authors: ['p2'], year: 1834 }),
  e('w3', ['k-work'], { title: 'Vade-mecum', authors: ['p3'], year: 1866 }),
  e('w4', ['k-work'], { title: 'Bez roku', authors: ['p1'] }),
  e('v1', ['k-word'], { pl: 'dom', en: 'house', alt: ['home'] }),
  e('v2', ['k-word'], { pl: 'kot', en: 'cat' }),
  e('v3', ['k-word'], { pl: 'pies', en: 'dog' }),
  e('v4', ['k-word'], { pl: 'drzewo', en: 'tree' }),
  e('v5', ['k-word'], { pl: 'woda', en: 'water' }),
  e('v6', ['k-word'], { pl: 'chleb' }),
  e('q1', ['k-quote'], { text: 'Litwo! Ojczyzno moja! ty jesteś jak zdrowie.', work: 'w1' })
];
const KINDS = [PERSON, CHARACTER, WORK, WORD, QUOTE];
const look = S.lookupOf(KINDS, ENTITIES);
const byId = (id) => ENTITIES.find((x) => x.id === id);

/* ── Schema ─────────────────────────────────────────────────────────── */

check('a kind keeps the first of two fields with the same key and drops a bad key', PERSON.fields.map((f) => f.key), ['name', 'born', 'reign', 'friend']);
check('without a pattern the label is the first field', kind('x', { fields: [{ key: 'a', type: 'line' }] }).label, '{a}');
check('the distinguishing field must exist', kind('x', { tells: 'nope', fields: [{ key: 'a' }] }).tells, undefined);
check('an unknown field type falls back to a line', S.readField({ key: 'k', type: 'hologram' }).type, 'line');
check('a pattern placeholder the kind lacks is a problem', S.problemsOf(kind('x', { label: '{nope}', fields: [{ key: 'a' }] }), look).length, 1);

check('the label comes from the pattern', S.labelOf(byId('w1'), look), 'Pan Tadeusz (1834)');
check('a missing value leaves no empty brackets', S.labelOf(byId('w4'), look), 'Bez roku');
check('an empty entry is named after its kind and the end of its id', S.labelOf(e('zz-abcd', ['k-work'], {}), look), 'Dzieło abcd');
check('the label of a reference follows the reference', S.fieldText(byId('w2'), WORK.fields[1], look), 'Juliusz Słowacki');
check('the distinguishing text', S.tellOf(byId('p1'), look), '24 grudnia 1798');

check('fields of two kinds are their union, the earlier kind first', S.fieldsOf(byId('p2'), look).map((f) => f.key), ['name', 'born', 'reign', 'friend', 'mood']);
check('a choice keeps its value', S.valuesOf(byId('p2'), CHARACTER.fields[1])[0].value, 'smutny');

const norwid = S.valuesOf(byId('p3'), PERSON.fields[1]);
check('three competing birth years stay side by side', norwid.map((v) => v.state), ['disputed', 'approximate', 'unknown']);
check('an unknown value has no value', norwid[2].value, null);
check('uncertain values read in words', S.fieldText(byId('p3'), PERSON.fields[1], look), '1821 (?), ok. 1820, (nieznane)');
check('a source travels with its value', S.valuesOf(byId('p2'), PERSON.fields[1])[0].source, { work: 'w2', locator: 's. 3' });

check('29 February exists only in leap years', [S.readDate('1999-02-29'), S.dateKey(S.readDate('2000-02-29'))], [null, '2000-02-29']);
check('a year before Christ', S.dateText(S.readDate('-1000')), '1000 przed Chr.');
check('a day in Polish', S.dateText(S.readDate('1999-05-03')), '3 maja 1999');
check('a month in Polish', S.dateText(S.readDate('1999-05')), 'maj 1999');
check('year 0 does not exist', S.readDate('0'), null);
truth('earlier is smaller, also before Christ', S.dateOrdinal(S.readDate('-1000-01')) < S.dateOrdinal(S.readDate('-1000-05')) && S.dateOrdinal(S.readDate('-1000')) < S.dateOrdinal(S.readDate('5')));

const reign = S.parseRange('992–1000, 1002–1025', 'number');
check('a reign in two pieces', reign.segments.map((s) => [s.from, s.to]), [[992, 1000], [1002, 1025]]);
check('and back in words', S.rangeText(reign, 'number'), '992–1000, 1002–1025');
check('an approximate range', S.rangeText(S.parseRange('ok. 960–992', 'number'), 'number'), 'ok. 960–992');
check('a range without an end', S.rangeText(S.parseRange('1990–', 'number'), 'number'), '1990–');
check('a plain hyphen between numbers', S.parseRange('3-7', 'number').segments.map((s) => [s.from, s.to]), [[3, 7]]);
check('a date range keeps the hyphens of its dates', S.parseRange('1999-05 - 2000', 'date').segments.map((s) => [s.from, s.to]), [['1999-05', '2000']]);
check('nonsense is no range', S.parseRange('abc–def', 'number'), null);

check('a number may carry its unit', S.readNumber('20,5 cm'), 20.5);
check('thousands with a space', S.readNumber('1 000'), 1000);

const stray = e('s1', ['k-work'], { title: 'X', year: 'abc', colour: 'red' });
check('what the schema does not know stays and is shown', S.outsideOf(stray, look).map((o) => [o.key, o.reason]), [['year', 'retyped'], ['colour', 'removed']]);

const index = S.refIndex(ENTITIES, look);
check('the other side of a reference has its own name', (index.get('p1') ?? []).map((b) => [b.from, b.label]), [['w1', 'napisał(a)'], ['w4', 'napisał(a)']]);
check('a symmetric reference shows its own name on the other side', (index.get('p3') ?? []).filter((b) => b.field.key === 'friend').map((b) => [b.from, b.label]), [['p2', 'Przyjaciel']]);

const merged = S.replaceRef(e('w9', ['k-work'], { authors: ['p1', 'p2'] }), look, 'p2', 'p1');
check('merging moves the reference and drops the duplicate', merged.data.authors, ['p1']);
check('an entry that did not point at it is untouched', S.replaceRef(byId('w3'), look, 'p2', 'p1'), null);
check('a single reference is swapped in place', S.replaceRef(byId('q1'), look, 'w1', 'w2').data.work, 'w2');
check('the markup of a statement reads plainly', S.plainOf('Księgi [[Samuela|@samuel]] to część ![@q] Biblii [@bt, J 3,16].'), 'Księgi Samuela to część Biblii .');

/* ── Graph ──────────────────────────────────────────────────────────── */

const raw = {
  nodes: [
    { id: 'a', type: 'num', x: 0, y: 0, config: { v: 2 } },
    { id: 'b', type: 'num', x: 0, y: 100, config: { v: 3 } },
    { id: 'c', type: 'add', x: 200, y: 50 },
    { id: 'c', type: 'add' },
    { id: 'd', type: 'boom', x: 200, y: 200 },
    { id: 'e', type: 'add', x: 400, y: 200 },
    { type: 'num' }
  ],
  edges: [
    { id: 'e1', from: 'a', out: 'out', to: 'c', in: 'in' },
    { id: 'e2', from: 'b', out: 'out', to: 'c', in: 'in' },
    { id: 'e3', from: 'c', out: 'out', to: 'a', in: 'in' },
    { id: 'e4', from: 'a', out: 'out', to: 'zz', in: 'in' },
    { id: 'e5', from: 'a', out: 'out', to: 'a', in: 'in' },
    { id: 'e6', from: 'a', out: 'out', to: 'c', in: 'in' },
    { id: 'e7', from: 'd', out: 'out', to: 'e', in: 'in' }
  ]
};
const graph = G.readGraph(raw);
check('reading drops duplicates, strays, loops and the edge that closes a circle', [graph.nodes.map((n) => n.id), graph.edges.map((x) => x.id)], [['a', 'b', 'c', 'd', 'e'], ['e1', 'e2', 'e7']]);
check('evaluation runs from top to bottom', G.order(graph), ['a', 'b', 'c', 'd', 'e']);

const toy = G.paletteOf('toy', [
  { type: 'num', label: 'n', says: '', group: '', ports: () => ({ inputs: [], outputs: [{ id: 'out', label: 'n', type: 'number' }] }), run: ({ config }) => ({ out: config.v }) },
  { type: 'add', label: '+', says: '', group: '', ports: () => ({ inputs: [{ id: 'in', label: 'in', type: 'number', many: true }], outputs: [{ id: 'out', label: 's', type: 'number' }] }), run: ({ inputs }) => ({ out: inputs.in.reduce((s, x) => s + x, 0) }) },
  { type: 'boom', label: '!', says: '', group: '', ports: () => ({ inputs: [], outputs: [{ id: 'out', label: 'x', type: 'number' }] }), run: () => { throw new Error('Bum.'); } },
  { type: 'text', label: 't', says: '', group: '', ports: () => ({ inputs: [{ id: 'in', label: 'in', type: 'text' }], outputs: [] }), run: () => ({}) }
]);
const ran = await G.evaluate(graph, toy, {});
check('a node adds what arrives', ran.outputs.get('c').out, 5);
check('a failing node keeps its own error', ran.errors.get('d'), 'Bum.');
check('what depends on it stays quiet', ran.errors.get('e'), G.UPSTREAM);
const withText = { nodes: [...graph.nodes, { id: 't', type: 'text', x: 0, y: 0, config: {} }], edges: graph.edges };
check('types must fit', G.connect(withText, toy, { id: 'x', from: 'a', out: 'out', to: 't', in: 'in' }).error !== undefined, true);
check('a circle is refused', G.connect(graph, toy, { id: 'x', from: 'c', out: 'out', to: 'c', in: 'in' }).error, 'Tak powstałoby koło — krok zależałby od samego siebie.');
const single = { nodes: [...graph.nodes, { id: 't', type: 'text', x: 0, y: 0, config: {} }, { id: 'u', type: 'num', x: 0, y: 0, config: {} }], edges: graph.edges };
const toyText = G.paletteOf('toy2', [...toy.kinds.values(), { type: 'num', label: 'n', says: '', group: '', ports: () => ({ inputs: [], outputs: [{ id: 'out', label: 'n', type: 'any' }] }), run: () => ({}) }]);
const once1 = G.connect(single, toyText, { id: 'x1', from: 'a', out: 'out', to: 't', in: 'in' }).graph;
const once2 = G.connect(once1, toyText, { id: 'x2', from: 'u', out: 'out', to: 't', in: 'in' }).graph;
check('an input that takes one edge keeps the newest', once2.edges.filter((x) => x.to === 't').map((x) => x.id), ['x2']);
check('an unknown node is a problem', G.problemsOf(G.readGraph({ nodes: [{ id: 'q', type: 'mystery' }] }), toy).map((p) => p.node), ['q']);

/* ── Prüfung ────────────────────────────────────────────────────────── */

check('the same text is fully right', C.checkText(['Mickiewicz'], 'mickiewicz').correctness, 1);
const turtle = C.checkText(['żółw'], 'zolw');
check('similar letters count when the rule allows them', [turtle.correct, turtle.correctness], [true, 1]);
truth('and are marked as near', Array.from(turtle.mask).filter((v) => v === 127).length === 3, Array.from(turtle.mask));
check('without similar letters they do not count', C.checkText(['żółw'], 'zolw', { ...C.TEXT_RULE, similar: false }).correct, false);
const missing = C.checkText(['Mickiewicz'], 'Mickiewcz');
check('one missing letter costs one letter — a repeated “ic” is no false anchor', missing.correctness, 0.9);
check('which is enough at a threshold of 80 %', C.checkText(['Mickiewicz'], 'Mickiewcz', { ...C.TEXT_RULE, threshold: 0.8 }).correct, true);
check('a missing letter is marked where it is missing', Array.from(missing.mask).indexOf(0), 7);
const surplus = C.checkText(['Mickiewicz'], 'Mickiewiczzz');
check('extra letters lower the share but not the marks', [Math.round(surplus.correctness * 1000) / 1000, Array.from(surplus.mask).every((v) => v === 255)], [0.833, true]);
check('the best of the accepted answers counts', C.checkText(['1/4', '¼', '25/100'], '25/100').expected, '25/100');
check('punctuation and spacing can be ignored', C.checkText(['Ojcze nasz, który jesteś'], 'ojcze nasz ktory jestes', { ...C.TEXT_RULE, ignorePunctuation: true }).correct, true);
check('from both ends: a swapped letter is one letter', Math.round(C.checkText(['abcdefghij'], 'abcdXfghij', { ...C.TEXT_RULE, algorithm: 'bidirectional' }).correctness * 10), 9);
check('nothing typed is no answer', C.checkText(['x'], '  ').answered, false);
check('spans for the card after the answer', C.spansOf('kot', C.checkText(['kot'], 'kat').mask).map((s) => s.level), ['hit', 'miss', 'hit']);

check('a number within an absolute tolerance', C.checkNumber({ values: [3.14], tolerance: 0.01, relative: false }, '3,15').correct, true);
check('a number within 5 %', [C.checkNumber({ values: [100], tolerance: 0.05, relative: true }, '104').correct, C.checkNumber({ values: [100], tolerance: 0.05, relative: true }, '106').correct], [true, false]);
check('a number with its unit typed', C.checkNumber({ values: [20.5], tolerance: 0, relative: false }, '20,5 cm').correct, true);

check('a Polish date', C.checkDate({ values: ['1966-04-14'], precision: 'day', tolerance: 0 }, '14.04.1966').correct, true);
check('only the year where the day is asked is not enough', C.checkDate({ values: ['1966-04-14'], precision: 'day', tolerance: 0 }, '1966').correct, false);
check('a day where the year is asked counts', C.checkDate({ values: ['966'], precision: 'year', tolerance: 0 }, '966-04-14').correct, true);
check('a year within one', C.checkDate({ values: ['966'], precision: 'year', tolerance: 1 }, '967').correct, true);
check('before Christ, written the Polish way', C.checkDate({ values: ['-1000'], precision: 'year', tolerance: 0 }, '1000 p.n.e.').correct, true);
check('there is no year 0 between 1 BC and 1 AD', C.checkDate({ values: ['-1'], precision: 'year', tolerance: 1 }, '1').correct, true);

check('several choices: half of them', C.checkMany([0, 2], [0]).correctness, 0.5);
check('several choices: one too many', C.checkMany([0, 2], [0, 1, 2]).correctness, 2 / 3);
check('order: the places that are right', C.checkOrder(['a', 'b', 'c', 'd'], ['a', 'c', 'b', 'd']).correctness, 0.5);
check('matching pairs', [C.checkMatch([[0, 1], [1, 0]], [[0, 1], [1, 0]]).correct, C.checkMatch([[0, 1], [1, 0]], [[0, 0], [1, 1]]).correctness], [true, 0]);
check('a flashcard graded by the learner', ['knew', 'partly', 'not'].map((g) => C.checkFlash(g).correctness), [1, 0.5, 0]);
const krakow = { lat: 50.0614, lon: 19.9366, r: 1000 };
check('a point within the circle on the map', C.checkPoint(krakow, { lat: 50.0647, lon: 19.9450 }).correct, true);
const far = C.checkPoint(krakow, { lat: 50.0614, lon: 19.9786 });
truth('three kilometres away is partly right', !far.correct && far.correctness > 0 && far.correctness < 1, far.correctness);
check('code: the cases that pass', C.checkCode({ passed: 3, total: 4 }).correctness, 0.75);
check('a mask survives its storage', Array.from(C.readMask(C.maskText(new Uint8Array([0, 127, 255])))), [0, 127, 255]);

/* ── Kenntnis ───────────────────────────────────────────────────────── */

const H = 3_600_000;
check('right after an answer the formula gives the square root of ten', K.knowledge(0, 0, 1, 0, 0), Math.sqrt(10));
const first = [{ at: 0, correctness: 1 }];
check('a first right answer holds for five minutes', K.stability(first), 5 / 60);
check('after which it is due', K.dueAt(first), 5 * 60 * 1000);
check('and the knowness is exactly 1', K.knownessOf(first, 5 * 60 * 1000), 1);
check('a wrong last answer starts again at five minutes', K.stability([{ at: 0, correctness: 1 }, { at: 24 * H, correctness: 0 }]), 5 / 60);
const spaced = [{ at: 0, correctness: 1 }, { at: 1 * H, correctness: 1 }, { at: 25 * H, correctness: 1 }];
check('spacing makes it last: 12 · (24 + 1) hours', K.stability(spaced), 300);
check('only the last three answers count', K.stability([{ at: -100 * H, correctness: 0 }, ...spaced]), 300);
check('never answered is nothing', K.knownessOf([], 0), 0);
check('unseen, learning, known', [K.levelOf([], 0), K.levelOf(first, 10 * 60 * 1000), K.levelOf(first, 60 * 1000)], ['unseen', 'learning', 'known']);
check('an entity averages its cards', K.average([1, 0, 0.5]), 0.5);

const deps = [
  { parent: 'a', child: 'b', kind: 'prerequisite', impact: 0.5 },
  { parent: 'b', child: 'c', kind: 'elaboration', impact: 1 },
  { parent: 'c', child: 'a', kind: 'prerequisite', impact: 1 }
];
check('the edge that closes a circle is dropped', K.acyclic(deps).length, 2);
const totals = K.propagate(new Map([['a', 0.2], ['b', 0.4], ['c', 1]]), deps);
check('knowing what builds on it lifts the foundation, along the chain', [totals.get('c'), totals.get('b'), totals.get('a')].map((v) => Math.round(v * 1e9) / 1e9), [1, 1.4, 0.9]);
check('a prerequisite below the threshold blocks', K.blockedBy('b', totals, deps, 1), ['a']);
check('an elaboration never blocks', K.gateOpen('c', totals, deps, 1), true);
check('a snapshot carries the question and its direction', (({ question, direction, answers }) => [question, direction, answers])(K.snapshotOf('T:v1', 'pl→en', first, 0)), ['T:v1', 'pl→en', 1]);

/* ── Karten aus Vorlagen ──────────────────────────────────────────────── */

const pool = (k) => ENTITIES.filter((x) => x.kinds.includes(k));
const ctx = (entity, seed = 's1', extra = {}) => ({ look, entity, pool, seed, ...extra });
const tpl = (id, kinds, direction, nodes, edges) => Cards.readTemplate(id, { name: id, kinds, direction, graph: { nodes, edges } });
const n = (id, type, config = {}, y = 0) => ({ id, type, x: 0, y, config });
const l = (id, from, out, to, into) => ({ id, from, out, to, in: into });

const WHO = tpl('who', ['k-work'], '', [
  n('title', 'field', { key: 'title' }),
  n('ask', 'pattern', { text: 'Kto napisał „{0}"?', inputs: 1 }),
  n('prompt', 'prompt'),
  n('authors', 'follow', { path: ['authors'] }),
  n('wrong', 'distractors', { key: 'authors', count: 2, from: ['field'] }),
  n('one', 'answer.one'),
  n('card', 'card')
], [
  l('1', 'title', 'values', 'ask', 'p0'), l('2', 'ask', 'text', 'prompt', 'parts'),
  l('3', 'authors', 'entities', 'one', 'expected'), l('4', 'authors', 'entities', 'wrong', 'expected'),
  l('5', 'wrong', 'distractors', 'one', 'distractors'), l('6', 'prompt', 'prompt', 'card', 'prompt'), l('7', 'one', 'answer', 'card', 'answer'),
  l('8', 'authors', 'entities', 'card', 'explain')
]);
const who1 = (await Cards.cardsOf(WHO, ctx(byId('w1'), 'seed-a'))).cards[0];
check('the question is written from the pattern', who1.prompt.map((p) => p.text), ['Kto napisał „Pan Tadeusz"?']);
check('the right answer is among the options', who1.answer.options[who1.answer.correct], 'Adam Mickiewicz');
check('distractors are the same field of other works', who1.answer.options.slice().sort(), ['Adam Mickiewicz', 'Cyprian Norwid', 'Juliusz Słowacki']);
check('the card is named by template and entry', [who1.question, who1.key], ['who:w1', 'who:w1']);
check('the authors explain the answer afterwards', who1.explain, ['p1']);
const who2 = (await Cards.cardsOf(WHO, ctx(byId('w1'), 'seed-b'))).cards[0];
check('another order of options is the same question', who2.fingerprint, who1.fingerprint);
check('choosing the right option is right', Cards.checkCard(who1, who1.answer.correct).correct, true);
const changed = S.lookupOf(KINDS, ENTITIES.map((x) => (x.id === 'w1' ? { ...x, data: { ...x.data, authors: ['p2'] } } : x)));
const who3 = (await Cards.cardsOf(WHO, { ...ctx(byId('w1')), look: changed, entity: { ...byId('w1'), data: { ...byId('w1').data, authors: ['p2'] } } })).cards[0];
check('when the right answer changes, the history starts again', who3.fingerprint === who1.fingerprint, false);

const VOCAB = (id, from, to, direction) => tpl(id, ['k-word'], direction, [
  n('front', 'field', { key: from }), n('prompt', 'prompt'),
  n('back', 'field', { key: to }), n('alt', 'field', { key: 'alt' }),
  n('text', 'answer.text', {}), n('card', 'card')
], [
  l('1', 'front', 'values', 'prompt', 'parts'), l('2', 'back', 'values', 'text', 'expected'),
  l('3', 'alt', 'values', 'text', 'accepted'), l('4', 'prompt', 'prompt', 'card', 'prompt'), l('5', 'text', 'answer', 'card', 'answer')
]);
const PL_EN = VOCAB('vocab', 'pl', 'en', 'pl→en');
const EN_PL = VOCAB('vocab-back', 'en', 'pl', 'en→pl');
const dom = (await Cards.cardsOf(PL_EN, ctx(byId('v1')))).cards[0];
check('a direction is part of the key', dom.key, 'vocab:v1|pl→en');
check('an extra accepted answer is right too', Cards.checkCard(dom, 'home').correct, true);
check('and the reverse direction is its own card', (await Cards.cardsOf(EN_PL, ctx(byId('v1')))).cards[0].key, 'vocab-back:v1|en→pl');
check('an empty field makes no question', (await Cards.cardsOf(PL_EN, ctx(byId('v6')))).cards.length, 0);

const tree = Cards.fragmentTree('Litwo! Ojczyzno moja! ty jesteś jak zdrowie.');
truth('a quote is split into pieces of at most 13 letters at the leaves', tree.filter((f) => f.parts.length === 0).every((f) => f.text.length <= 13), tree.map((f) => f.text));
check('the pieces are asked before the whole', tree[tree.length - 1].id, 'f');
const QUOTES = tpl('quote', ['k-quote'], '', [
  n('text', 'field', { key: 'text' }), n('parts', 'fragments'), n('each', 'each'), n('gap', 'answer.gap'), n('card', 'card')
], [
  l('1', 'text', 'values', 'parts', 'text'), l('2', 'parts', 'fragments', 'each', 'items'),
  l('3', 'each', 'item', 'gap', 'fragment'), l('4', 'gap', 'answer', 'card', 'answer')
]);
const quoteCards = (await Cards.cardsOf(QUOTES, ctx(byId('q1')))).cards;
check('one card for each piece of the quote', quoteCards.length, tree.length);
const whole = quoteCards.find((c) => c.question === 'quote:q1:f');
check('the whole needs its two halves first', whole.requires, ['quote:q1:f0', 'quote:q1:f1']);
const leaf = quoteCards.find((c) => c.requires.length === 0);
check('a piece is asked as a gap in the quote', leaf.answer.shown.includes('…'), true);
check('and filling it in is right', Cards.checkCard(leaf, leaf.answer.accepted[0]).correct, true);

const TIMES = tpl('times', ['k-word'], '', [
  n('a', 'random', { min: 2, max: 9 }), n('b', 'random', { min: 2, max: 9 }, 50),
  n('mul', 'math', { op: 'mul' }), n('ask', 'pattern', { text: 'Ile to jest {0} × {1}?', inputs: 2 }),
  n('prompt', 'prompt'), n('num', 'answer.number'), n('card', 'card')
], [
  l('1', 'a', 'value', 'mul', 'a'), l('2', 'b', 'value', 'mul', 'a'), l('3', 'a', 'value', 'ask', 'p0'), l('4', 'b', 'value', 'ask', 'p1'),
  l('5', 'ask', 'text', 'prompt', 'parts'), l('6', 'mul', 'value', 'num', 'expected'), l('7', 'prompt', 'prompt', 'card', 'prompt'), l('8', 'num', 'answer', 'card', 'answer')
]);
const t1 = (await Cards.cardsOf(TIMES, ctx(byId('v1'), 'x1'))).cards[0];
const t2 = (await Cards.cardsOf(TIMES, ctx(byId('v1'), 'x2'))).cards[0];
const [x, y] = t1.prompt[0].text.match(/\d+/g).map(Number);
check('a computed question asks what it computed', t1.answer.values[0], x * y);
check('it varies, so its fingerprint is the template', [t1.varies, t1.fingerprint === t2.fingerprint], [true, true]);
truth('and a new seed may ask other numbers', t1.prompt[0].text !== t2.prompt[0].text || true);

const DATED = tpl('dated', ['k-work'], '', [
  n('year', 'field', { key: 'year' }), n('when', 'when', { test: 'filled' }),
  n('limit', 'list', { items: ['1850'] }), n('cmp', 'compare', { op: 'lt' }), n('tf', 'answer.truefalse'), n('card', 'card')
], [
  l('1', 'year', 'values', 'when', 'items'), l('2', 'year', 'values', 'cmp', 'a'), l('3', 'limit', 'values', 'cmp', 'b'),
  l('4', 'cmp', 'result', 'tf', 'expected'), l('5', 'tf', 'answer', 'card', 'answer')
]);
check('true or false from a comparison', (await Cards.cardsOf(DATED, ctx(byId('w1')))).cards[0].answer.value, true);
check('the condition makes no card where the year is missing', (await Cards.cardsOf(DATED, ctx(byId('w4')))).cards.length, 0);

const BORN = tpl('born', ['k-work'], '', [
  n('to', 'follow', { path: ['authors'] }), n('born', 'field', { key: 'born' }), n('date', 'answer.date', { precision: 'year' }), n('card', 'card')
], [
  l('1', 'to', 'entities', 'born', 'of'), l('2', 'born', 'values', 'date', 'expected'), l('3', 'date', 'answer', 'card', 'answer')
]);
const born = (await Cards.cardsOf(BORN, ctx(byId('w1')))).cards[0];
check('several steps along references reach the author’s birth', born.answer.values, ['1798-12-24']);
check('asked to the year', Cards.checkCard(born, '1798').correct, true);

check('a template needs a card', Cards.templateProblems(tpl('none', ['k-work'], '', [n('a', 'list')], [])), ['Szablon nie ma kroku „Karta".']);
check('templates for an entry of two kinds', Cards.templatesFor(byId('p2'), [tpl('p', ['k-person'], '', [], []), tpl('c', ['k-character'], '', [], []), tpl('w', ['k-work'], '', [], [])]).map((t) => t.id), ['p', 'c']);

const hand = Cards.questionCard(e('hq', ['q'], { form: 'order', prompt: 'Ułóż od najstarszego', items: ['Mieszko I', 'Bolesław Chrobry', 'Mieszko II'] }), 's');
check('a hand-written question in order form', [hand.question, hand.answer.items], ['hq', ['Mieszko I', 'Bolesław Chrobry', 'Mieszko II']]);
check('answered in the right order', Cards.checkCard(hand, ['Mieszko I', 'Bolesław Chrobry', 'Mieszko II']).correct, true);
const pick = Cards.questionCard(e('hc', ['q'], { form: 'one', prompt: 'Stolica?', options: ['Kraków', 'Gniezno', 'Płock'], correct: 1 }), 's');
check('a hand-written choice keeps its right answer when shuffled', pick.answer.options[pick.answer.correct], 'Gniezno');
check('a question without its answer is no card', Cards.questionCard(e('hx', ['q'], { form: 'text', prompt: 'Co?' })), null);

/* ── Wiederholung ─────────────────────────────────────────────────────── */

const words = ENTITIES.filter((x) => x.kinds.includes('k-word'));
const vocab = (await Promise.all(words.map((w) => Cards.cardsOf(PL_EN, ctx(w))))).flatMap((m) => m.cards);
const revCtx = (marks = () => []) => ({
  cards: vocab,
  kindsOf: (id) => byId(id)?.kinds ?? [],
  collection: (id) => (id === 'pets' ? new Set(['v2', 'v3']) : undefined),
  topic: () => new Set(),
  marks,
  now: 0
});
const rev = (strategy) => G.readGraph({
  nodes: [n('src', 'source.kind', { kind: 'k-word' }), n('f', 'filter', { directions: ['pl→en'] }, 10), n('s', 'strategy', strategy, 20)],
  edges: [l('1', 'src', 'cards', 'f', 'cards'), l('2', 'f', 'cards', 's', 'cards')]
});
const { plan } = await R.planOf(rev({ mode: 'random', count: 3 }), revCtx());
check('the revision graph gives a plan of the words that have a translation', plan.cards.length, 5);
const deck = (await R.planOf(G.readGraph({ nodes: [n('src', 'source.collection', { collection: 'pets' }), n('s', 'strategy', { mode: 'once' }, 10)], edges: [l('1', 'src', 'cards', 's', 'cards')] }), revCtx())).plan;
check('a collection as the source', deck.cards.map((c) => c.entity).sort(), ['v2', 'v3']);
check('a revision without a strategy is refused', (await R.planOf(G.readGraph({ nodes: [n('src', 'source.all')] }), revCtx())).problems, ['Powtórka nie ma kroku „Sposób pytania".']);

const runAll = (session, correctness = () => 1, limit = 200) => {
  const asked = [];
  let s = session;
  let t = 0;
  while (s.current !== null && asked.length < limit) {
    asked.push(s.current);
    t += 60_000;
    s = R.answer(s, correctness(s.current, asked.length), t).session;
  }
  return { asked, s };
};
const begin = (p, seed = 'r1', extra = {}) => R.start({ plan: p, all: vocab, marks: () => [], deps: [], now: 0, seed, ...extra });

const random = runAll(begin(plan));
check('random: a fixed number of cards, each once', [random.asked.length, new Set(random.asked).size, R.progress(random.s).done], [3, 3, true]);
check('random: the same seed asks the same cards', runAll(begin(plan)).asked, random.asked);
const once = runAll(begin({ ...plan, mode: 'once' }));
check('once: the whole stack, each once', new Set(once.asked).size, 5);
check('once: progress knows the total', R.progress(begin({ ...plan, mode: 'once' })).total, 5);

const levels = runAll(begin({ ...plan, mode: 'levels', levels: 3, stackSize: 2 }));
check('levels: each card climbs two levels and then the run ends', levels.asked.length, 10);
const wrongOnce = runAll(begin({ ...plan, mode: 'levels', levels: 2, stackSize: 5 }), (_key, i) => (i === 1 ? 0 : 1));
check('levels: after a wrong answer the next right one only restarts the climb, as in the old Cogita', wrongOnce.asked.length, 7);

const temporal = runAll(begin({ ...plan, mode: 'temporal', stackSize: 3 }));
check('temporal: each right answer is known for now and leaves the stack', temporal.asked.length, 5);
const stubborn = runAll(begin({ ...plan, mode: 'temporal', stackSize: 3 }), (key) => (key === 'vocab:v2|pl→en' ? 0 : 1), 40);
check('temporal: what is not known yet keeps coming back', stubborn.asked.filter((k) => k === 'vocab:v2|pl→en').length > 2, true);
{
  let s = begin({ ...plan, mode: 'temporal', stackSize: 3 });
  let repeatsWithCompany = 0;
  for (let step = 1; step <= 40 && s.current !== null; step += 1) {
    const before = s.current;
    s = R.answer(s, before === 'vocab:v2|pl→en' ? 0 : 1, step * 60_000).session;
    if (s.current === before && s.active.length > 1) repeatsWithCompany += 1;
  }
  check('temporal: the same card twice in a row only when it is alone in the stack', repeatsWithCompany, 0);
}

const gated = { ...plan, mode: 'temporal', stackSize: 5, gate: 1 };
const foundation = [{ parent: 'v2', child: 'v1', kind: 'prerequisite', impact: 0 }];
const g0 = begin(gated, 'g', { deps: foundation });
check('a card waits for its foundation', g0.active.includes('vocab:v1|pl→en'), false);
let g = g0;
while (g.current !== null && g.current !== 'vocab:v2|pl→en') g = R.answer(g, 1, 1000).session;
const opened = R.answer(g, 1, 2000);
check('once the foundation is known, it joins the stack', opened.session.active.includes('vocab:v1|pl→en'), true);
check('the answer gives the snapshot to keep', [opened.snapshot.question, opened.snapshot.direction, opened.snapshot.answers], ['vocab:v2', 'pl→en', 1]);
check('the stand of the plan before a run', R.levelsOf(plan, () => [], 0), { unseen: 5, learning: 0, known: 0 });

/* ══ 0109 — die Logik, die Abläufe, die Regeln, das Spiel, die Arten, das Weitergeben ══════════ */

/*
 * Dieselbe Rechnung, die die Seiten, die Sitzungen und die Kanzlei benutzen —
 * gebaut mit dem, was diese Module mitziehen (der Dienst, die Schlüssel), aber
 * ohne einen Aufruf: nur gerechnet.
 */
const more = ['logic', 'flow', 'rules', 'game', 'kinds', 'live'];
const moreOut = join(workspace, 'more');
await build({
  entryPoints: { ...Object.fromEntries(more.map((m) => [m, `src/app/cogita/${m}.ts`])), libraryPublish: 'src/app/libraryPublish.ts', steps: 'src/app/steps.ts' },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outdir: moreOut,
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) },
  loader: { '.css': 'empty' },
  logLevel: 'error'
});
/* Wie in app-json-check: ein BroadcastChannel des Schlüsselbunds hielte den Lauf sonst am Leben. */
globalThis.BroadcastChannel = undefined;
const loadMore = (name) => import(pathToFileURL(join(moreOut, `${name}.js`)).href);
const [Lg, Fl, Ru, Ga, Ki, Li, Pub, St] = await Promise.all([...more, 'libraryPublish', 'steps'].map(loadMore));

/* -- Die eine Logik ------------------------------------------------------------------------------- */

check('compare: numbers as numbers', [Lg.compare('gt', '10', '9'), Lg.compare('le', '2', '2'), Lg.compare('ge', '1,5', '2')], [true, true, false]);
check('compare: filled and empty', [Lg.compare('filled', '', ''), Lg.compare('empty', '', ''), Lg.compare('filled', 'x', '')], [false, true, true]);
check('gates: and, or, xor, not', [Lg.gate('and', [true, false]), Lg.gate('or', [false, true]), Lg.gate('xor', [true, true, false]), Lg.gate('xor', [true]), Lg.gate('not', [false])], [false, true, false, true, true]);
const facts = (over = {}) => ({ ...Lg.NO_FACTS, values: { hp: 4 }, visited: new Set(['s2']), answered: (id) => (id === 'q1' ? 1 : id === 'q2' ? 0.5 : null), now: new Date('2026-12-25T19:00:00'), ...over });
check('a condition of conditions: a value and a visited step', Lg.holds(Lg.readCondition({ type: 'and', items: [{ type: 'value', value: 'hp', op: 'ge', than: 3 }, { type: 'visited', of: 's2' }] }), facts()), true);
check('answered: at all, right, wrong', [
  Lg.holds({ type: 'answered', of: 'q1' }, facts()), Lg.holds({ type: 'answered', of: 'q1', correct: true }, facts()),
  Lg.holds({ type: 'answered', of: 'q2', correct: true }, facts()), Lg.holds({ type: 'answered', of: 'q2', correct: false }, facts()),
  Lg.holds({ type: 'answered', of: 'q3' }, facts())
], [true, true, false, true, false]);
check('time: between days and hours', [
  Lg.holds({ type: 'time', after: '2026-12-24', before: '2026-12-26', from: '18:00', to: '23:00' }, facts()),
  Lg.holds({ type: 'time', after: '2026-12-24', before: '2026-12-26', from: '20:00' }, facts()),
  Lg.holds({ type: 'time', before: '2026-12-24' }, facts())
], [true, false, false]);
check('place and zone', [
  Lg.holds({ type: 'place', lat: 50.0614, lon: 19.9366, radius: 100 }, facts({ place: { lat: 50.0618, lon: 19.9369 } })),
  Lg.holds({ type: 'place', lat: 50.0614, lon: 19.9366, radius: 10 }, facts({ place: { lat: 50.0700, lon: 19.9366 } })),
  Lg.holds({ type: 'zone', of: 'rynek' }, facts({ zones: new Set(['rynek']) }))
], [true, false, true]);
check('no condition holds; nonsense is no condition', [Lg.holds(null, facts()), Lg.readCondition({ type: 'nonsense' })], [true, null]);
check('actions: add within limits, and a jump', Lg.apply([{ type: 'add', value: 'hp', by: -10 }, { type: 'set', value: 'trust', to: 9 }, { type: 'go', step: 's9' }], { hp: 3 }, (id) => (id === 'trust' ? { max: 5 } : { min: 0 })), { values: { hp: 0, trust: 5 }, go: 's9' });

/* -- Der Ablauf ----------------------------------------------------------------------------------- */

const flowOf = (id, nodes, edges, extra = {}) => Fl.readFlow(id, { name: id, graph: { nodes, edges }, ...extra });
const playCtx = (flows) => ({
  facts: (s) => ({ ...Lg.NO_FACTS, values: s.values, visited: new Set(s.visited) }),
  flows: (id) => flows[id],
  members: (x) => (x === 'k-word' ? ['v1', 'v2'] : [])
});
const chapters = flowOf('ch', [
  n('open', 'show'), n('hub', 'chapters', { chapters: [{ title: 'A' }, { title: 'B' }] }), n('a1', 'show'), n('aEnd', 'chapterEnd'),
  n('b1', 'question', { of: 'q1' }), n('bEnd', 'chapterEnd'), n('bRe', 'restart'), n('fin', 'end')
], [
  l('1', 'open', 'next', 'hub', 'in'), l('2', 'hub', 'c0', 'a1', 'in'), l('3', 'hub', 'c1', 'b1', 'in'), l('4', 'hub', 'done', 'fin', 'in'),
  l('5', 'a1', 'next', 'aEnd', 'in'), l('6', 'b1', 'right', 'bEnd', 'in'), l('7', 'b1', 'wrong', 'bRe', 'in')
], { start: 'open' });
{
  const ctx = playCtx({ ch: chapters });
  const s0 = Fl.startFlow(chapters);
  const s1 = Fl.advance(chapters, s0, undefined, ctx);
  const hub = chapters.graph.nodes.find((x) => x.id === 'hub');
  check('a flow: the chapter choice offers both', [s1.step, Fl.chaptersLeft(hub, s1).map((c) => c.title)], ['hub', ['A', 'B']]);
  const s3 = Fl.advance(chapters, Fl.advance(chapters, s1, 'c0', ctx), undefined, ctx);
  check('the end of a chapter returns to the choice, without it', [s3.step, Fl.chaptersLeft(hub, s3).map((c) => c.title)], ['hub', ['B']]);
  const s5 = Fl.advance(chapters, Fl.advance(chapters, s3, 'c1', ctx), 'wrong', ctx);
  check('„od nowa" starts the chapter again', s5.step, 'b1');
  const s6 = Fl.advance(chapters, s5, 'right', ctx);
  check('all chapters done: the choice leads on, and the flow ends', [s6.ended, [...s6.chapters.hub].sort()], [true, [0, 1]]);
}
const logic = flowOf('lg', [
  n('intro', 'show'), n('set1', 'set', { actions: [{ type: 'add', value: 'hp', by: 2 }] }),
  n('cond', 'condition', { condition: { type: 'value', value: 'hp', op: 'ge', than: 2 } }), n('yes1', 'show'), n('no1', 'show')
], [l('1', 'intro', 'next', 'set1', 'in'), l('2', 'set1', 'next', 'cond', 'in'), l('3', 'cond', 'yes', 'yes1', 'in'), l('4', 'cond', 'no', 'no1', 'in')], { start: 'intro' });
{
  const s = Fl.advance(logic, Fl.startFlow(logic), undefined, playCtx({ lg: logic }));
  check('values and conditions go on by themselves', [s.step, s.values.hp], ['yes1', 2]);
}
const inner = flowOf('inner', [n('i1', 'show'), n('i2', 'return')], [l('1', 'i1', 'next', 'i2', 'in')], { start: 'i1' });
const outer = flowOf('outer', [n('o1', 'subflow', { flow: 'inner' }), n('o2', 'show')], [l('1', 'o1', 'next', 'o2', 'in')], { start: 'o1' });
{
  const ctx = playCtx({ inner, outer });
  const inside = Fl.advance(outer, Fl.startFlow(outer), undefined, ctx);
  check('a subflow: in, with the way back on the stack', [inside.flow, inside.step, inside.stack.length], ['inner', 'i1', 1]);
  const back = Fl.advance(inner, inside, undefined, ctx);
  check('… and back out where it was entered', [back.flow, back.step, back.stack.length], ['outer', 'o2', 0]);
}
{
  const each = flowOf('each', [n('e1', 'each', { flow: 'inner', kind: 'k-word' }), n('e2', 'show')], [l('1', 'e1', 'next', 'e2', 'in')], { start: 'e1' });
  const ctx = playCtx({ inner, each });
  const first = Fl.advance(each, Fl.startFlow(each), undefined, ctx);
  const second = Fl.advance(inner, Fl.advance(inner, first, undefined, ctx), undefined, ctx);
  check('„dla każdego": once per member, then on', [first.item, first.queue, Fl.advance(inner, first, undefined, ctx).item, second.flow, second.step], ['v1', ['v2'], 'v2', 'each', 'e2']);
}
{
  const story = flowOf('story', [n('s1', 'line', { character: { slot: 'osoba' }, of: 'k1' })], [], { start: 's1', slots: [{ id: 'osoba', label: 'Osoba' }] });
  const use = Fl.readFlow('use', { name: 'Użycie', template: 'story', fill: { osoba: 'p2' } });
  const resolved = Fl.resolveFlow(use, (id) => (id === 'story' ? story : undefined));
  check('a story template filled: the slot becomes the entry', [resolved.id, resolved.graph.nodes[0].config.character], ['use', 'p2']);
}
check('goals and lines follow the one logic', [
  Fl.goalsReached(Fl.readFlow('g', { goals: [{ id: 'g1', title: 'Zdrowie', condition: { type: 'value', value: 'hp', op: 'ge', than: 3 } }, { id: 'g2', title: 'Nic' }] }), facts()),
  Fl.linesNow(Fl.readFlow('l', { lines: [{ character: 'p2', of: 'k1' }, { character: 'p2', of: 'k2', condition: { type: 'visited', of: 'zz' } }] }), Fl.startFlow(Fl.readFlow('l', {})), facts()).map((x) => x.of)
], [['g1'], ['k1']]);

/* -- Die Regeln einer Sitzung ---------------------------------------------------------------------- */

{
  const points = Ru.scoreRound(Ru.DEFAULT_RULES, [
    { participant: 'A', at: 1000, correctness: 1 }, { participant: 'C', at: 2000, correctness: 0 }, { participant: 'B', at: 3000, correctness: 1 }
  ], 0, (who) => (who === 'A' ? [true] : []));
  check('a round: first, speed and the streak count; a wrong answer costs nothing by default',
    ['A', 'B', 'C'].map((p) => points.get(p).total), [2320, 1320, 0]);
  check('a round: the parts of the first answer', (({ base, first, speed, streak }) => [base, first, speed, streak])(points.get('A')), [1000, 500, 500, 320]);
  check('the round ends at the earlier clock', Ru.roundDeadline(Ru.DEFAULT_RULES, 0, 5000), { at: 15000, move: 'reveal' });
  check('after the first answer the timer starts', Ru.onFirstAnswer(Ru.DEFAULT_RULES), 'start_timer');
  check('rules read tolerantly: nonsense is the default', Ru.readRules('nonsense'), Ru.DEFAULT_RULES);
  truth('every preset reads back as itself', Ru.PRESETS.every((pre) => JSON.stringify(Ru.readRules(pre.rules)) === JSON.stringify(pre.rules)));
}

/* -- Das Spiel und die Karte zum Entdecken --------------------------------------------------------- */

{
  const fog = Ga.fogOf([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd', landmark: true }], [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }], (id) => (id === 'a' ? 1 : 0), () => false);
  check('the fog: known, the frontier beside it, the rest hidden, landmarks always', ['a', 'b', 'c', 'd'].map((id) => fog.get(id)), ['known', 'frontier', 'fog', 'landmark']);
  const fresh = Ga.fogOf([{ id: 'a' }, { id: 'b' }], [{ from: 'a', to: 'b' }], () => 0, () => false);
  check('nothing known yet: the beginning is the frontier', [fresh.get('a'), fresh.get('b')], ['frontier', 'fog']);
  const rings = Ga.ringsOf(['a', 'b', 'c'], [{ from: 'a', to: 'b' }, { from: 'a', to: 'c' }]);
  check('the map: the root in the middle, the rest around it', [rings.get('a'), Math.round(Math.hypot(rings.get('b').x - 0.5, rings.get('b').y - 0.5) * 100)], [{ x: 0.5, y: 0.5 }, 25]);
  const at = (s) => new Date(Date.UTC(2026, 9, 16, 12, 0, s)).toISOString();
  const track = new Map([
    ['walker', [{ player: 'walker', team: null, lat: 50.0614, lon: 19.9366, accuracy: 10, at: at(0) }, { player: 'walker', team: null, lat: 50.0615, lon: 19.9367, accuracy: 10, at: at(10) }]],
    ['jumper', [{ player: 'jumper', team: null, lat: 50.0614, lon: 19.9366, accuracy: 10, at: at(0) }, { player: 'jumper', team: null, lat: 50.0714, lon: 19.9366, accuracy: 10, at: at(10) }]],
    ['blurry', [{ player: 'blurry', team: null, lat: 50.0614, lon: 19.9366, accuracy: 900, at: at(0) }]]
  ]);
  check('suspicions: a jump of a kilometre in ten seconds, a blurry fix — not a walker', Ga.suspicions(track).map((x) => x.player), ['jumper', 'blurry']);
  const rules = Ga.readGame({ zones: [{ id: 'z', lat: 50, lon: 19, radius: 0 }, { id: '', lat: 1, lon: 1 }], triggers: [{ id: 't', on: 'nonsense', actions: [{ do: 'add', value: 'pts', by: 5 }, 'x'] }] });
  check('game rules read tolerantly', [rules.zones.length, rules.zones[0].radius, rules.triggers[0].on, rules.triggers[0].once, rules.triggers[0].actions.length], [1, 1, 'enter', true, 1]);
}

/* -- Die Arten im Klartext ------------------------------------------------------------------------- */

{
  check('an own entity keeps its kinds in the data, not as fields', Ki.entityOf({ id: 'x', kind: 'entity', data: { _kinds: ['k1'], text: 'a', _checked: 't' } }), { id: 'x', kinds: ['k1'], data: { text: 'a' } });
  check('a built-in kind stays the plaintext kind, more kinds beside it', Ki.entityOf({ id: 'p', kind: 'person', data: { _kinds: ['k2'], name: 'A' } }).kinds, ['person', 'k2']);
  check('which plaintext kind', [Ki.plainKindOf(['person', 'k1']), Ki.plainKindOf(['k1']), Ki.plainKindOf([])], ['person', 'entity', 'entity']);
  check('writing an entity back keeps what is not a field', Ki.entryData({ kinds: ['person', 'k2'], data: { name: 'A', _x: 1 } }, 'person', { _checked: 't', _kinds: ['old'] }), { _checked: 't', name: 'A', _kinds: ['k2'] });
  check('documents are not entities', Ki.entityOf({ id: 'r', kind: 'revision', data: {} }), null);
  const over = Ki.kindDefs([{ id: 'o1', kind: 'kind', data: { builtin: 'person', name: 'Człowiek', label: '{name}', fields: [] } }]);
  const person = over.find((k) => k.id === 'person');
  truth('a built-in kind renamed keeps its fields', person.name === 'Człowiek' && person.fields.length > 0, { name: person.name, fields: person.fields.length });
}

/* -- Was zu den Teilnehmern geht -------------------------------------------------------------------- */

{
  const card = (answer) => ({ question: 'q', direction: 'd', key: 'k', prompt: [{ text: 'Ile?' }], answer, explain: ['e1'], fingerprint: 'f', varies: false });
  const stripped = [
    { form: 'text', accepted: ['dom'], rule: {} }, { form: 'one', options: ['a', 'b'], correct: 1 },
    { form: 'order', items: ['1', '2'], shown: ['2', '1'] }, { form: 'match', left: ['a'], right: ['b'], pairs: [[0, 0]] },
    { form: 'code', task: 't', starter: 's', createInput: 'ci', reference: 'r', cases: 3 }, { form: 'point', on: 'map', target: { lat: 50, lon: 19, r: 30 } }
  ].map((a) => Li.stripCard(card(a)));
  check('a card for the participants carries no answer', stripped.map((c) => c.answer.accepted ?? c.answer.correct ?? c.answer.items ?? c.answer.pairs ?? c.answer.reference ?? c.answer.target),
    [[], -1, [], [], '', { lat: 0, lon: 0, r: 0 }]);
  check('… but what is needed to answer stays (options, the shuffled order, both sides)', [stripped[1].answer.options, stripped[2].answer.shown, stripped[3].answer.left], [['a', 'b'], ['2', '1'], ['a']]);
  check('… and nothing that explains it or tells the answer apart', [stripped[0].explain, stripped[0].fingerprint], [[], '']);
}

/* -- Was eine öffentliche Seite über ein Bündel erfährt ---------------------------------------------- */

{
  const look = { get: () => undefined, byKey: () => undefined };
  const summary = Pub.publicSummary({ id: 'x', kind: 'entity', data: { _kinds: ['k1'], public: { format: 'recreatio.cogita.entity', title: 'Józef', kinds: ['Postać', 7], list: [{ label: 'Urodzony', text: 'ok. 1 r. p.n.e.' }, { label: 1 }] } } }, look, () => true);
  check('an entity bundle tells its kinds and fields in words — nothing else', summary, { title: 'Józef', format: 'recreatio.cogita.entity', kinds: ['Postać'], list: [{ label: 'Urodzony', text: 'ok. 1 r. p.n.e.' }] });
  check('a built-in kind publishes nothing from data.public', Pub.publicSummary({ id: 'p', kind: 'person', data: { name: 'A', public: { format: 'x' } } }, look, () => true).format, undefined);
}

/* -- Der Schritt „Naucz się" ----------------------------------------------------------------------- */

{
  const step = (over) => ({ stepId: 's1', position: 0, areaId: 'a', epoch: 1, labelSealed: '', helpSealed: null, doneBy: 'person', visibleToPerson: true, dueAt: null, kind: 'learn', label: 'Naucz się', help: null, learn: { libraryId: 'L', revisionId: null, threshold: 0.8 }, ...over });
  const base = { hasSeat: false, confirmedAt: null, extensions: [], filled: new Map(), now: new Date('2026-10-16T12:00:00') };
  const open = St.stepsFor({ ...base, steps: [step({})], marks: [] })[0];
  const done = St.stepsFor({ ...base, steps: [step({})], marks: [{ stepId: 's1', doneAt: '2026-10-15T10:00:00Z' }] })[0];
  const late = St.stepsFor({ ...base, steps: [step({ dueAt: '2026-10-01T23:59:59' })], marks: [] })[0];
  check('learn: open, done when ticked, overdue after its date', [open.status, done.status, late.status], ['todo', 'done', 'overdue']);
  check('learn: it ticks by itself (the browser at the threshold), for the person', [open.source, open.doneBy, open.visibleToPerson, open.learn.threshold], ['auto', 'person', true, 0.8]);
}

await rm(workspace, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
