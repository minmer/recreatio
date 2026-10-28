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
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-cogita-'));
const names = ['schema', 'graph', 'check', 'knowness', 'cards', 'revision', 'cardBasics', 'addForm', 'addFormText', 'addFormBuild', 'addFormEdit', 'presets', 'kindRemoval', 'store', 'kinds', 'selection', 'views', 'viewActions', 'statements', 'oldInBase', 'parts', 'prerequisites', 'questionTypes', 'measures', 'offline', 'learn'];
/* 2026-10-28 — dazu aus `core`: das Anmelden ohne Netz (away), die Rechnung des Anmeldens (session), die Siegel (crypto). */
const cores = ['away', 'session', 'crypto'];
await build({
  entryPoints: Object.fromEntries([...names.map((n) => [n, `src/app/cogita/${n}.ts`]), ...cores.map((n) => [n, `src/app/core/${n}.ts`])]),
  bundle: true,
  format: 'esm',
  platform: 'node',
  outdir: workspace,
  logLevel: 'error',
  /* 2026-10-27 — `learn` (offline checks) reaches the service module, which reads the API origin. */
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
/* `learn` reaches the session module: without a BroadcastChannel it opens nothing that keeps node from ending. */
globalThis.BroadcastChannel = undefined;
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [S, G, C, K, Cards, R, Basics, AF, AT, AB, AE, P, KR, ST, KD, SEL, VW, VA, STM, OLD, PARTS, PR, QTY, ME, OFF, LRN] = await Promise.all(names.map(load));
const [AW, SE, CR] = await Promise.all(cores.map(load));

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
const CHARACTER = kind('k-character', { name: 'Postać', fields: [{ key: 'name', label: 'Imię', type: 'line' }, { key: 'mood', label: 'Nastrój', type: 'choice', options: ['radosny', 'smutny'] }] });
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
check('the markup of a statement reads plainly', S.plainOf('Księgi [[Samuela|@samuel]] to część ![@q] Biblii [@bt, J 3,16].'), 'Księgi Samuela to część Biblii.');

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

const tree = Basics.fragmentTree('Litwo! Ojczyzno moja! ty jesteś jak zdrowie.');
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

/* 2026-10-25 — „Warunek: równe" trifft eine Wahl über ihren Namen UND ihren gespeicherten Wert: ein umbenanntes Etikett hält die Karte nicht an. */
{
  const STEP = kind('k-step', { name: 'Krok', fields: [{ key: 'rola', label: 'Rola', type: 'choice', options: [{ value: 'odpowiedz', label: 'Odpowiedź (teza autora)' }, { value: 'zarzut', label: 'Zarzut' }] }, { key: 'tekst', label: 'Tekst', type: 'line' }] });
  const step = e('st1', ['k-step'], { rola: 'odpowiedz', tekst: 'Pięć dróg' });
  const lookStep = S.lookupOf([STEP], [step]);
  const only = (value) => tpl(`only-${value}`, ['k-step'], '', [
    n('rola', 'field', { key: 'rola' }), n('when', 'when', { test: 'equals', value }), n('ask', 'pattern', { text: '{0}', inputs: 1 }), n('prompt', 'prompt'),
    n('tekst', 'field', { key: 'tekst' }), n('flash', 'answer.flash'), n('card', 'card')
  ], [
    l('1', 'rola', 'values', 'when', 'items'), l('2', 'when', 'items', 'ask', 'p0'), l('3', 'ask', 'text', 'prompt', 'parts'),
    l('4', 'tekst', 'values', 'flash', 'back'), l('5', 'prompt', 'prompt', 'card', 'prompt'), l('6', 'flash', 'answer', 'card', 'answer')
  ]);
  const made = async (value) => (await Cards.cardsOf(only(value), { look: lookStep, entity: step, pool: () => [step], seed: 's' })).cards.length;
  check('a choice condition matches the option by its label and by its stored value, not another option', [await made('Odpowiedź (teza autora)'), await made('odpowiedz'), await made('zarzut')], [1, 1, 0]);
}

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

/* 2026-10-18 — Wörter mehrerer Sprachen in EINEM Eintrag: je Sprache eine Karte, die Richtung vorn. */
{
  const LANG = kind('k-lang2', { name: 'Język', label: '{name}', fields: [{ key: 'name', label: 'Nazwa', type: 'line' }] });
  const WORD = kind('k-word2', { name: 'Słowo', label: '{text}', fields: [{ key: 'text', label: 'Tekst', type: 'line' }, { key: 'lang', label: 'Język', type: 'ref', to: ['k-lang2'] }] });
  const TRANS = kind('k-trans2', { name: 'Tłumaczenie', label: '{words}', fields: [{ key: 'words', label: 'Słowa', type: 'ref', multi: true, to: ['k-word2'] }] });
  const items = [
    e('ln-en', ['k-lang2'], { name: 'angielski' }), e('ln-pl', ['k-lang2'], { name: 'polski' }),
    e('wd-house', ['k-word2'], { text: 'house', lang: 'ln-en' }), e('wd-dom', ['k-word2'], { text: 'dom', lang: 'ln-pl' }), e('wd-apart', ['k-word2'], { text: 'apartament', lang: 'ln-pl' }),
    e('tr-1', ['k-trans2'], { words: ['wd-house', 'wd-dom', 'wd-apart'] }),
    e('tr-2', ['k-trans2'], { words: ['wd-dom', 'wd-apart'] })
  ];
  const look3 = S.lookupOf([LANG, WORD, TRANS], items);
  const ctx3 = (id) => ({ look: look3, entity: items.find((x) => x.id === id), pool: (k) => items.filter((x) => x.kinds.includes(k)), seed: 's3' });
  const shown = (cards) => cards.map((c) => [c.prompt.map((x) => x.text).join(' '), c.answer.accepted]);
  const preset = P.TEMPLATE_PRESETS.find((x) => x.id === 'languages');
  const both = Cards.readTemplate('langs', preset.make('k-trans2', { key: 'words', label: 'Słowa' }, { key: 'lang', label: 'Język' }));
  const made = (await Cards.cardsOf(both, ctx3('tr-1'))).cards;
  check('between languages: a card per language — its words with the direction, the other language as the answer',
    shown(made), [['angielski → polski: house', ['dom', 'apartament']], ['polski → angielski: dom, apartament', ['house']]]);
  check('… two languages, two cards (two Polish words are one language)', new Set(made.map((c) => c.key)).size, 2);
  check('… a translation within one language makes none', (await Cards.cardsOf(both, ctx3('tr-2'))).cards.length, 0);
  const FIXED = tpl('en-pl', ['k-trans2'], 'en→pl', [
    n('words', 'field', { key: 'words' }), n('en', 'filter', { key: 'lang', value: ['Angielski'] }), n('pl', 'filter', { key: 'lang', value: ['polski'] }),
    n('has', 'when', { test: 'filled' }), n('ask', 'pattern', { text: 'angielski → polski: {0}', inputs: 1 }), n('prompt', 'prompt'), n('text', 'answer.text'), n('card', 'card')
  ], [
    l('1', 'words', 'values', 'en', 'items'), l('2', 'words', 'values', 'pl', 'items'), l('3', 'en', 'kept', 'has', 'items'), l('4', 'has', 'items', 'ask', 'p0'),
    l('5', 'ask', 'text', 'prompt', 'parts'), l('6', 'pl', 'kept', 'text', 'expected'), l('7', 'prompt', 'prompt', 'card', 'prompt'), l('8', 'text', 'answer', 'card', 'answer')
  ]);
  check('a fixed direction: the language typed in the filter (any case)', shown((await Cards.cardsOf(FIXED, ctx3('tr-1'))).cards), [['angielski → polski: house', ['dom', 'apartament']]]);
  check('… and with a condition, no card where that language is missing', (await Cards.cardsOf(FIXED, ctx3('tr-2'))).cards.length, 0);
  const OTHERS = tpl('others', ['k-trans2'], '', [
    n('words', 'field', { key: 'words' }), n('one', 'pick', { position: 'first' }), n('not', 'filter'), n('text', 'answer.text'), n('card', 'card')
  ], [
    l('1', 'words', 'values', 'one', 'items'), l('2', 'words', 'values', 'not', 'items'), l('3', 'one', 'chosen', 'not', 'like'),
    l('4', 'not', 'rest', 'text', 'expected'), l('5', 'text', 'answer', 'card', 'answer')
  ]);
  check('a filter without a field compares the entries themselves: all but this one', (await Cards.cardsOf(OTHERS, ctx3('tr-1'))).cards[0].answer.accepted, ['dom', 'apartament']);
  const LOST = tpl('lost', ['k-trans2'], '', [n('words', 'field', { key: 'words' }), n('f', 'filter', { key: 'lang' }), n('text', 'answer.text'), n('card', 'card')],
    [l('1', 'words', 'values', 'f', 'items'), l('2', 'f', 'kept', 'text', 'expected'), l('3', 'text', 'answer', 'card', 'answer')]);
  truth('a filter with nothing to compare says so', (await Cards.cardsOf(LOST, ctx3('tr-1'))).problems.some((x) => x.includes('nie ma z czym porównać')));
}

/* 2026-10-18 — Słówka vom Wort aus und paarweise: welche Sprache, Paare, Übersetzungen ankreuzen, je Sprache übersetzen. */
{
  const LANG = kind('k-lang4', { name: 'Język', label: '{name}', fields: [{ key: 'name', label: 'Nazwa', type: 'line' }] });
  const WORD = kind('k-word4', { name: 'Słowo', label: '{text}', fields: [
    { key: 'text', label: 'Tekst', type: 'line' }, { key: 'lang', label: 'Język', type: 'ref', to: ['k-lang4'] },
    { key: 'topics', label: 'Tematy', type: 'ref', multi: true, to: ['topic'] }] });
  const TRANS = kind('k-trans4', { name: 'Tłumaczenie', label: '{words}', fields: [{ key: 'words', label: 'Słowa', type: 'ref', multi: true, to: ['k-word4'] }] });
  const w = (id, text, lang) => e(id, ['k-word4'], { text, lang });
  const t = (id, ...words) => e(id, ['k-trans4'], { words });
  const items = [
    e('l4-en', ['k-lang4'], { name: 'angielski' }), e('l4-pl', ['k-lang4'], { name: 'polski' }), e('l4-de', ['k-lang4'], { name: 'niemiecki' }), e('l4-fr', ['k-lang4'], { name: 'francuski' }),
    w('w4-hotel-en', 'hotel', 'l4-en'), w('w4-hotel-pl', 'hotel', 'l4-pl'), w('w4-hotel-de', 'Hotel', 'l4-de'),
    w('w4-house', 'house', 'l4-en'), w('w4-dom', 'dom', 'l4-pl'), w('w4-apart', 'apartament', 'l4-pl'), w('w4-haus', 'Haus', 'l4-de'),
    w('w4-car', 'car', 'l4-en'), w('w4-samochod', 'samochód', 'l4-pl'), w('w4-cat', 'cat', 'l4-en'), w('w4-kot', 'kot', 'l4-pl'),
    w('w4-dog', 'dog', 'l4-en'), w('w4-pies', 'pies', 'l4-pl'),
    t('t4-1', 'w4-house', 'w4-dom', 'w4-apart'), t('t4-2', 'w4-dom', 'w4-apart'), t('t4-3', 'w4-car', 'w4-samochod'),
    t('t4-4', 'w4-cat', 'w4-kot'), t('t4-5', 'w4-dog', 'w4-pies'), t('t4-6', 'w4-haus', 'w4-dom'), t('t4-7', 'w4-hotel-en', 'w4-hotel-pl', 'w4-hotel-de')
  ];
  const kinds4 = [LANG, WORD, TRANS];
  const look4 = S.lookupOf(kinds4, items);
  /* Ein Vorrat je Art als EIN Feld, wie in der Bibliothek — daran hängt das Verzeichnis. */
  const byKind = new Map(['k-lang4', 'k-word4', 'k-trans4'].map((k) => [k, items.filter((x) => x.kinds.includes(k))]));
  const ctx4 = (id, seed = 's4') => ({ look: look4, entity: items.find((x) => x.id === id), pool: (k) => byKind.get(k) ?? [], seed });
  const made = async (template, id, seed) => (await Cards.cardsOf(template, ctx4(id, seed))).cards;
  const preset = (id) => P.TEMPLATE_PRESETS.find((x) => x.id === id);
  const build = (presetId, kindId, picked = {}) => {
    const pr = preset(presetId);
    const c = P.presetChoice(kinds4, kindId, pr, picked);
    return { c, template: Cards.readTemplate(presetId, pr.make(kindId, P.presetField(c.field), c.second === undefined ? undefined : P.presetField(c.second), c.back === undefined ? undefined : { back: { kind: c.back.kind, key: c.back.key } })) };
  };
  const chosenOf = (card) => card.answer.correct.map((i) => card.answer.options[i]).sort();

  /* Der Dialog wählt vor, was die Anfänge brauchen. */
  const wordChoice = P.presetChoice(kinds4, 'k-word4', preset('choose-translations'), {});
  check('the dialog preselects: the language (one reference), the text from the label, the translations pointing back',
    [wordChoice.field?.key, wordChoice.second?.key, wordChoice.back && `${wordChoice.back.kind}|${wordChoice.back.key}`, wordChoice.missing], ['lang', 'text', 'k-trans4|words', null]);
  const pairsChoice = P.presetChoice(kinds4, 'k-trans4', preset('pairs'), {});
  check('… for a translation: the words (several), then the language of a word', [pairsChoice.field?.key, pairsChoice.target?.id, pairsChoice.second?.key], ['words', 'k-word4', 'lang']);
  truth('… and says what is missing: nothing points back at a language', P.presetChoice(kinds4, 'k-lang4', preset('translate-word'), {}).missing !== null);

  /* Welche Sprache? */
  const which = build('which-language', 'k-word4').template;
  const hotelCards = [...await made(which, 'w4-hotel-en'), ...await made(which, 'w4-hotel-pl'), ...await made(which, 'w4-hotel-de')];
  check('which language: one card for the three „hotel"s, every language where the spelling exists is right',
    [hotelCards.length, hotelCards[0].prompt[0].text, chosenOf(hotelCards[0]), hotelCards[0].answer.options.length],
    [1, 'Jaki to język: „hotel”? Zaznacz wszystkie, w których istnieje.', ['angielski', 'niemiecki', 'polski'], 4]);
  check('… a word in one language: that one, among all languages', chosenOf((await made(which, 'w4-house'))[0]), ['angielski']);
  truth('… answered with exactly those, right; with one missing, partly', (() => {
    const card = hotelCards[0];
    const full = Cards.checkCard(card, card.answer.correct);
    const part = Cards.checkCard(card, card.answer.correct.slice(1));
    return full.correct && !part.correct && part.correctness > 0;
  })());

  /* Paare verbinden. */
  const pairs = build('pairs', 'k-trans4').template;
  const pcard = (await made(pairs, 't4-1'))[0];
  const pairedWith = (card, left) => { const at = card.answer.left.indexOf(left); const pr = card.answer.pairs.find(([l]) => l === at); return pr === undefined ? null : card.answer.right[pr[1]]; };
  check('pairs: this translation and others in its two languages, left English, right Polish',
    [pcard.prompt[0].text, pairedWith(pcard, 'house'), pairedWith(pcard, 'car'), pcard.answer.left.includes('Haus'), pcard.varies],
    ['Połącz w pary: angielski — polski', 'dom, apartament', 'samochód', false, true]);
  check('… the right pairs are right', Cards.checkCard(pcard, pcard.answer.pairs).correct, true);
  check('… a word facing itself (hotel — hotel) is no pair', pcard.answer.left.includes('hotel'), false);
  check('… a translation within one language makes none', (await made(pairs, 't4-2')).length, 0);
  check('… another seed draws again — the same card', (await made(pairs, 't4-1', 'other'))[0].key, pcard.key);

  /* Übersetzungen ankreuzen. */
  const choose = build('choose-translations', 'k-word4').template;
  const ccard = (await made(choose, 'w4-dom'))[0];
  const wrongOnes = ccard.answer.options.filter((_o, i) => !ccard.answer.correct.includes(i));
  check('choose translations: every translation of „dom" in other languages is right, its synonym is not',
    [ccard.prompt[0].text, chosenOf(ccard), wrongOnes.includes('apartament')], ['Zaznacz tłumaczenia: „dom” (polski)', ['Haus', 'house'], false]);
  truth('… the others are words of the same target languages', wrongOnes.length > 0 && wrongOnes.every((o) => ['hotel', 'Hotel', 'car', 'cat', 'dog'].includes(o)), wrongOnes);
  check('… every translation holding the word explains the answer', ccard.explain.slice().sort(), ['t4-1', 't4-2', 't4-6']);

  /* Je Sprache übersetzen. */
  const translate = build('translate-word', 'k-word4').template;
  check('translate a word: a card per language it has translations in',
    (await made(translate, 'w4-dom')).map((c) => [c.prompt[0].text, c.answer.accepted]),
    [['dom (polski) → angielski', ['house']], ['dom (polski) → niemiecki', ['Haus']]]);
  check('… a word translated into one language: one card', (await made(translate, 'w4-cat')).map((c) => c.answer.accepted), [['kot']]);

  /* „Wpisy rodzaju": nach Feld, getippt, ohne diesen Eintrag, zufällig. */
  const ENT = (config) => tpl('ent', ['k-word4'], '', [n('found', 'entries', config), n('text', 'answer.text'), n('card', 'card')],
    [l('1', 'found', 'entities', 'text', 'expected'), l('2', 'text', 'answer', 'card', 'answer')]);
  check('entries of a kind whose field has a typed value (a language by its name, any case)',
    (await made(ENT({ kind: 'k-word4', key: 'lang', value: ['NIEMIECKI'] }), 'w4-dom'))[0].answer.accepted, ['Hotel', 'Haus']);
  check('… without this entry, and at most N at random', (await made(ENT({ kind: 'k-word4', key: 'lang', value: ['polski'], self: true, count: 2 }), 'w4-dom'))[0].answer.accepted.length, 2);
  truth('… never this entry', (await made(ENT({ kind: 'k-word4', key: 'lang', value: ['polski'], self: true }), 'w4-dom'))[0].answer.accepted.every((x) => x !== 'dom'));

  /* Viele Wörter: das Verzeichnis trägt — nicht jede Karte liest alle. */
  const many = [];
  for (let i = 0; i < 4000; i += 1) many.push(e(`wm-${i}`, ['k-word4'], { text: `w${i % 1500}`, lang: i % 2 === 0 ? 'l4-en' : 'l4-pl' }));
  const bigItems = [...items.filter((x) => x.kinds.includes('k-lang4')), ...many];
  const bigLook = S.lookupOf(kinds4, bigItems);
  const bigPools = new Map([['k-lang4', bigItems.filter((x) => x.kinds.includes('k-lang4'))], ['k-word4', many]]);
  const started = Date.now();
  let bigCards = 0;
  for (const word of many) bigCards += (await Cards.cardsOf(which, { look: bigLook, entity: word, pool: (k) => bigPools.get(k) ?? [], seed: 's' })).cards.length;
  const took = Date.now() - started;
  truth(`4000 words, which language: one card per spelling (1500), in ${took} ms`, bigCards === 1500 && took < 4000, { bigCards, took });
}

/* 2026-10-18 — einen Rodzaj entfernen: was mitgeht, ausgerechnet. */
{
  const LANG = kind('k-lang5', { name: 'Język', label: '{name}', fields: [{ key: 'name', label: 'Nazwa', type: 'line' }] });
  const WORD = kind('k-word5', { name: 'Słowo', label: '{text}', fields: [{ key: 'text', label: 'Tekst', type: 'line' }, { key: 'lang', label: 'Język', type: 'ref', to: ['k-lang5'] }] });
  const TRANS = kind('k-trans5', { name: 'Tłumaczenie', label: '{words}', fields: [{ key: 'words', label: 'Słowa', type: 'ref', multi: true, to: ['k-word5'] }, { key: 'note', label: 'Uwaga', type: 'line' }] });
  const MIX = kind('k-mix5', { name: 'Mieszany', label: '{name}', fields: [{ key: 'name', label: 'Nazwa', type: 'line' }, { key: 'any', label: 'Cokolwiek', type: 'ref', to: ['k-word5', 'k-lang5'] }] });
  const items = [
    e('l5', ['k-lang5'], { name: 'polski' }), e('w5a', ['k-word5'], { text: 'dom', lang: 'l5' }), e('w5b', ['k-word5'], { text: 'kot', lang: 'l5' }),
    e('w5c', ['k-word5', 'k-mix5'], { text: 'pies', name: 'pies' }), e('t5', ['k-trans5'], { words: ['w5a', 'w5b'], note: 'x' }), e('m5', ['k-mix5'], { name: 'm', any: 'w5a' }),
    e('f5', ['k-word5'], { text: 'obcy' })
  ];
  const kinds5 = [LANG, WORD, TRANS, MIX];
  const look5 = S.lookupOf(kinds5, items);
  const plan = KR.planKindRemoval({
    kind: WORD, isBase: false, kinds: kinds5, entities: items, look: look5, isOwn: (id) => id !== 'f5',
    templates: [{ id: 'tp1', data: { name: 'Słówko', kinds: ['k-word5'] } }, { id: 'tp2', data: { name: 'Oba', kinds: ['k-word5', 'k-trans5'] } }],
    forms: [{ id: 'fm1', data: { name: 'Dodawanie', graph: { nodes: [{ id: 'a', type: 'entry', x: 0, y: 0, config: { kind: 'k-word5', fields: {} } }, { id: 'b', type: 'entry', x: 0, y: 0, config: { kind: 'k-trans5', fields: {} } }], edges: [{ id: 'e', from: 'a', out: 'out', to: 'b', in: 'words' }] } } }],
    collections: [{ id: 'c1', data: { name: 'Z', list: ['w5a', 'l5'] } }]
  });
  check('removing a kind: its own entries go, one with another kind stays without it, a foreign one stays',
    [plan.remove, plan.narrow.map((x) => [x.id, x.kinds]), plan.foreign], [['w5a', 'w5b'], [['w5c', ['k-mix5']]], 1]);
  check('… entries pointing at them lose those references', plan.unlink.map((x) => [x.id, x.data.words, x.data.any]).sort(), [['m5', undefined, undefined], ['t5', undefined, undefined]]);
  check('… a field pointing only here goes, one pointing at several stops pointing here',
    plan.kinds.map((k) => [k.id, k.fields.map((f) => (f.type === 'ref' ? `${f.key}>${(f.to ?? []).join('+')}` : f.key))]), [['k-trans5', ['note']], ['k-mix5', ['name', 'any>k-lang5']]]);
  check('… templates only for it go, the others lose it; a form loses its node; a collection its entries',
    [plan.templates.map((t) => [t.id, t.data === null ? null : t.data.kinds]), plan.forms.map((f) => [f.id, f.data.graph.nodes.map((n) => n.id), f.data.graph.edges.length]), plan.collections.map((c) => c.data.list)],
    [[['tp1', null], ['tp2', ['k-trans5']]], [['fm1', ['b'], 0]], [['l5']]]);
  truth('… and the question says all of it', plan.lines.length >= 7 && plan.lines.some((l) => l.includes('2 wpisy tego rodzaju zostaną usunięte')) && plan.lines.some((l) => l.includes('pochodzi z innych baz')), plan.lines);
  truth('a kind from a source cannot be removed here', KR.planKindRemoval({ kind: WORD, isBase: false, kinds: kinds5, entities: items, look: look5, isOwn: () => false, templates: [], forms: [], collections: [] }).blocked !== null);
}

/* 2026-10-20 — ein Schritt, bei jedem Wert der Rodzaj gewählt (Psalm oder Pieśń), in der getippten Reihenfolge. */
{
  const PSALM = kind('k-ps6', { name: 'Psalm', label: 'Ps {numer}', fields: [{ key: 'numer', label: 'Numer', type: 'line' }] });
  const SONG = kind('k-pn6', { name: 'Pieśń', label: '{zrodlo}', fields: [{ key: 'zrodlo', label: 'Miejsce w Piśmie', type: 'line' }] });
  const PLACE = kind('k-mi6', { name: 'Miejsce', label: '{dzien}', fields: [{ key: 'dzien', label: 'Dzień', type: 'line' }, { key: 'psalmy', label: 'Psalmy i pieśni', type: 'ref', multi: true, to: ['k-ps6', 'k-pn6'] }] });
  const items = [e('old63', ['k-ps6'], { numer: '63' })];
  const look6 = S.lookupOf([PSALM, SONG, PLACE], items);
  let c6 = 0;
  const ctx6 = { look: look6, pool: (k) => items.filter((x) => x.kinds.includes(k)), isOwn: () => true, newId: () => `c6-${++c6}` };
  const form6 = AF.readAddForm('f6', { name: 'Brewiarz', graph: {
    nodes: [
      { id: 't', type: 'entry', x: 0, y: 0, config: { kind: 'k-ps6', also: ['k-pn6'], many: true, fields: { numer: { from: 'type' } } } },
      { id: 'm', type: 'entry', x: 260, y: 0, config: { kind: 'k-mi6', fields: { dzien: { from: 'type' } } } }
    ],
    edges: [{ id: 'e', from: 't', out: 'out', to: 'm', in: 'psalmy' }]
  }, order: ['m', 't'] });
  const g6 = AF.groupsOf(form6, look6);
  check('a step with a kind to choose: one input, the kinds to choose, its own first', g6.map((g) => [g.label, g.fields.map((f) => f.key), (g.choices ?? []).map((ch) => `${ch.kind.name}:${ch.field.key}`)]),
    [['Miejsce', ['dzien'], []], ['Psalm', ['numer'], ['Psalm:numer', 'Pieśń:zrodlo']]]);
  const plan6 = AF.planForm(form6, ctx6, [{ m: [{ dzien: 'środa' }], t: [{ numer: '63' }, { numer: 'Dn 3,57-88', _kind: 'k-pn6' }, { numer: '149' }] }], { picks: {}, asks: {} });
  const place6 = plan6.saves.find((x) => x.kinds.includes('k-mi6'));
  const named6 = (id) => { const x = plan6.saves.find((y) => y.id === id); return x === undefined ? (id === 'old63' ? 'Ps 63 (był)' : id) : `${x.kinds[0]}=${Object.values(x.data)[0]}`; };
  check('… each value of its chosen kind, in the typed order; an existing psalm reused',
    [place6?.data.psalmy.map(named6), plan6.rows[0].problems], [['Ps 63 (był)', 'k-pn6=Dn 3,57-88', 'k-ps6=149'], []]);
  const pasted6 = AT.parsePaste('czwartek | 72 / Pieśń: Ap 11,17-18;12,10b-12a', g6, { columns: '|', values: '/', header: false });
  check('… pasted: a prefix with the kind name chooses it', pasted6.rows[0].t, [{ numer: '72' }, { numer: 'Ap 11,17-18;12,10b-12a', _kind: 'k-pn6' }]);
  check('… and in JSON the kinds to choose travel as references', AF.mapFormRefs(form6.graph, (k) => `@${k}`, (x) => x).nodes.find((n) => n.id === 't').config.also, ['@k-pn6']);
  truth('… the description says so', AT.describeForm(form6, look6).some((l) => l.includes('Przy każdej wartości wybiera się rodzaj: Psalm (Numer) albo Pieśń (Miejsce w Piśmie)')), AT.describeForm(form6, look6));
}

/* ── Wiederholung ─────────────────────────────────────────────────────── */

const words = ENTITIES.filter((x) => x.kinds.includes('k-word'));
const vocab = (await Promise.all(words.map((w) => Cards.cardsOf(PL_EN, ctx(w))))).flatMap((m) => m.cards);
const revCtx = (marks = () => []) => ({
  cards: vocab,
  kindsOf: (id) => byId(id)?.kinds ?? [],
  collection: (id) => (id === 'pets' ? new Set(['v2', 'v3']) : undefined),
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
/* 2026-10-22 — „Rodzaj … z …": eine Art aus einer bestimmten Bibliothek (der Stoff der Bibliotheken). */
const fromLib = (await R.planOf(G.readGraph({ nodes: [n('src', 'source.kind', { kind: 'k-word', from: 'lib-b' }), n('s', 'strategy', { mode: 'once' }, 10)], edges: [l('1', 'src', 'cards', 's', 'cards')] }),
  { ...revCtx(), from: (id) => (id === 'v2' ? 'lib-b' : 'lib-a') })).plan;
check('a kind from one library: only the cards of its entries', [...new Set(fromLib.cards.map((c) => c.entity))], ['v2']);
const anyLib = (await R.planOf(G.readGraph({ nodes: [n('src', 'source.kind', { kind: 'k-word' }), n('s', 'strategy', { mode: 'once' }, 10)], edges: [l('1', 'src', 'cards', 's', 'cards')] }),
  { ...revCtx(), from: (id) => (id === 'v2' ? 'lib-b' : 'lib-a') })).plan;
truth('… without "from" the kind comes from everywhere', new Set(anyLib.cards.map((c) => c.entity)).size > 1);
{
  /* Der Stoff einer Bibliothek: ein Szablon auf Cytaty gibt Karten der Zitate einer Quelle, die Liste der Wpisy bleibt die eigene. */
  const fake = (libraryId, entries) => ({ libraryId, areaId: `a-${libraryId}`, revision: 1, all: () => entries, get: (id) => entries.find((e) => e.id === id), own: (id) => entries.find((e) => e.id === id), byKey: (k) => entries.find((e) => e.key === k), ownByKey: (k) => entries.find((e) => e.key === k) });
  const work = { id: 'w-bt', kind: 'work', key: 'bt', data: { title: 'Biblia Tysiąclecia', workType: 'bible' } };
  const q1 = { id: 'q-1', kind: 'quote', key: 'q1', data: { text: 'Bóg jest miłością.', work: ['w-bt'], locator: '1 J 4,8' } };
  const q2 = { id: 'q-2', kind: 'quote', key: 'q2', data: { text: 'Na początku było Słowo.', work: ['w-bt'], locator: 'J 1,1' } };
  const tpl = { id: 't-q', kind: 'template', data: P.TEMPLATE_PRESETS.find((x) => x.id === 'ask').make('quote', { key: 'locator', label: 'Miejsce' }) };
  const lib5 = new ST.CogitaLibrary(fake('base', [tpl]), false);
  lib5.setSources([{ store: fake('lib', [work, q1, q2]), kind: 'books', name: 'Biblioteka' }]);
  check('library kinds with entries are material to learn from (not kinds of the base)', [lib5.materialKinds.some((k) => k.id === 'quote'), lib5.kinds.some((k) => k.id === 'quote')], [true, false]);
  check('… the quotes of the library are material of their kind', lib5.material('quote').map((e) => e.id).sort(), ['q-1', 'q-2']);
  check('… but not entries of the base', lib5.entities().some((e) => e.id === 'q-1'), false);
  const made5 = await lib5.cards('s');
  check('a template over quotes makes cards of library quotes, keyed template:entry', made5.cards.filter((c) => c.entity === 'q-1').map((c) => c.question), ['t-q:q-1']);
  check('… asking for the place of the quote', made5.cards.find((c) => c.entity === 'q-2')?.answer.accepted, ['J 1,1']);
  check('… a revision knows where they come from', lib5.revisionContext(made5.cards, () => [], 0).from('q-1'), 'lib');
}
{
  /*
    2026-10-23 — AUSSAGEN: jeder Rodzaj mit Feld `blocks` — hier der Komentarz
    aus templates/cogita/komentarz.json (keine eingebaute Art mehr). Teza als
    Name, Bausteine lesbar, Karten aus den Szablony der Datei.
  */
  const komentarz = JSON.parse(await readFile('../templates/cogita/komentarz.json', 'utf8'));
  const KOM = kind('k-kom', komentarz.kinds[0]);
  check('the Komentarz template: "O czym" (references with a place, to any kind) and "Treść" (blocks)',
    KOM.fields.map((f) => [f.key, f.type, f.multi, f.locator === true, (f.to ?? []).length]), [['about', 'ref', true, true, 0], ['content', 'blocks', false, false, 0]]);
  const BT = e('bt', ['k-work'], { title: 'Biblia', year: 1965, workType: 'bible' });
  const c1 = e('c1', ['k-kom'], {
    about: [{ value: 'bt', locator: 'Łk 1,35' }, { value: 'bt', locator: 'Dz 1,8' }],
    content: [{ type: 'paragraph', text: 'Duch Święty zstępuje dwa razy. Najpierw na Maryję, potem na Kościół.' },
      { type: 'table', columns: ['Łukasz', 'Dzieje'], rows: [[[{ ref: 'bt', locator: 'Łk 1,35' }], [{ ref: 'bt', locator: 'Dz 1,8' }]], [[{ text: 'Maryja' }], [{ text: 'Apostołowie' }]]] }]
  });
  const look6 = S.lookupOf([...KINDS, KOM], [...ENTITIES, BT, c1]);
  check('a statement is named by its thesis', S.labelOf(c1, look6), 'Duch Święty zstępuje dwa razy.');
  check('its blocks are one value of the blocks type', S.valuesOf(c1, KOM.fields.find((f) => f.key === 'content')).map((v) => v.value.length), [2]);
  check('a kind with a blocks field is a statement kind, others are not', [STM.isStatementKind(KOM), STM.isStatementKind(WORK)], [true, false]);
  check('… the placeholder "@blocks" of a picker becomes the statement kinds of the base', STM.resolveKinds(['k-work', STM.STATEMENT_KINDS], [...KINDS, KOM]), ['k-work', 'k-kom']);
  check('… what it is about: its reference fields, with the place', STM.entityAbout(c1, look6), [{ ref: 'bt', locator: 'Łk 1,35' }, { ref: 'bt', locator: 'Dz 1,8' }]);
  const ctx6 = (entity) => ({ look: look6, entity, pool: () => [], seed: 's' });
  const fileTemplate = (i) => Cards.readTemplate(`t-${i}`, { ...komentarz.templates[i], kinds: ['k-kom'] });
  const thesisCards = (await Cards.cardsOf(fileTemplate(0), ctx6(c1))).cards;
  check('thesis card (the file’s template): the front names what it is about (Bible places)', thesisCards[0]?.prompt.map((p) => p.text).join(' '), 'Co mówi ta wypowiedź o: Łk 1,35; Dz 1,8?');
  check('… the back is the thesis, the statement explains', [thesisCards[0]?.answer.back, thesisCards[0]?.explain], [['Duch Święty zstępuje dwa razy.'], ['c1']]);
  const tableCards = (await Cards.cardsOf(fileTemplate(1), ctx6(c1))).cards;
  check('table card: pairs from two columns', [tableCards[0]?.answer.form, [...tableCards[0]?.answer.left ?? []].sort(), [...tableCards[0]?.answer.right ?? []].sort()], ['match', ['Maryja', 'Łk 1,35'], ['Apostołowie', 'Dz 1,8']]);
  const noAbout = e('c2', ['k-kom'], { content: [{ type: 'paragraph', text: 'Bez przedmiotu.' }] });
  check('… a statement about nothing gives no thesis card', (await Cards.cardsOf(fileTemplate(0), ctx6(noAbout))).cards.length, 0);
  check('the templates in the file are the presets (same nodes, same wires)',
    [0, 1].map((i) => komentarz.templates[i].graph.nodes.map((x) => x.type).join()),
    ['thesis', 'statement-table'].map((id) => P.TEMPLATE_PRESETS.find((x) => x.id === id).make('@komentarz').graph.nodes.map((x) => x.type).join()));
  check('the statement presets are offered for every kind with a blocks field, under any name', [P.TEMPLATE_PRESETS.filter((x) => x.statements === true).map((x) => x.id), P.TEMPLATE_PRESETS.filter((x) => x.kinds !== undefined).length], [['thesis', 'statement-table'], 0]);
  check('the library kinds come from the Library and the Scriptorium (no comment, no topic)', [ST.BOOK_KINDS.has('comment'), ST.BOOK_KINDS.has('quote'), ST.BOOK_KINDS.has('text'), ST.BOOK_KINDS.has('topic')], [false, true, true, false]);
  check('no built-in content kinds: knowledge and comment are gone, the question stays', [KD.isBaseKind('knowledge'), KD.isBaseKind('comment'), KD.isBaseKind('question')], [false, false, true]);
  check('… a saved change of a gone built-in is no kind of its own', KD.kindDefs([{ id: 'o', kind: 'kind', data: { builtin: 'knowledge', name: 'Wiedza', label: '{text}', fields: [] } }]).some((k) => k.name === 'Wiedza'), false);
  const oldOnes = [
    { id: 'x1', kind: 'entity', data: { _kinds: ['knowledge'], text: 'Stare.' } },
    { id: 'x2', kind: 'entity', data: { text: 'Bez rodzaju.' } },
    { id: 'x3', kind: 'kind', data: { builtin: 'knowledge', name: 'Wiedza' } },
    { id: 'x4', kind: 'entity', data: { _kinds: ['k-kom'], content: [] } },
    { id: 'x5', kind: 'entity', data: { _kinds: ['k-elsewhere'] } },
    { id: 'x6', kind: 'kind', data: { builtin: 'question', name: 'Pytanie' } }
  ];
  const known6 = (id) => (id === 'k-kom' ? KOM : undefined);
  check('„Stare wpisy" in a base: knowledge (also without kinds) and changes of gone built-ins — not a kind it merely cannot read now',
    oldOnes.filter((x) => OLD.isOldInBase(x, known6)).map((x) => x.id), ['x1', 'x2', 'x3']);
  check('… named after what they were', oldOnes.slice(0, 3).map(OLD.oldInBaseLabel), ['Wiedza', 'Wiedza', 'Rodzaj (zmiana wbudowanego): Wiedza']);
}
{
  /* 2026-10-23 (Schritt 5) — keine Themen; die Rodzaje tekstów eines Skryptorium sind Rodzaje der Baza (ihre Felder neben den festen). */
  const U = (tail) => `00000000-0000-4000-8000-00000000${tail}`;
  const fake = (libraryId, entries) => ({ libraryId, areaId: `a-${libraryId}`, revision: 1, all: () => entries, get: (id) => entries.find((x) => x.id === id), own: (id) => entries.find((x) => x.id === id), byKey: (k) => entries.find((x) => x.key === k), ownByKey: (k) => entries.find((x) => x.key === k) });
  const TAJ = { id: U('c001'), kind: 'kind', data: { name: 'Tajemnica', label: '{nazwa}', fields: [{ key: 'nazwa', label: 'Nazwa', type: 'line' }] } };
  const zw = { id: U('c002'), kind: 'entity', data: { _kinds: [U('c001')], nazwa: 'Zwiastowanie' } };
  const type = { id: U('d001'), kind: 'texttype', key: 'kazanie-maryjne', data: { name: 'Kazanie maryjne', fields: [{ key: 'tajemnica', label: 'Tajemnica', type: 'ref', to: [U('c001')] }, { key: 'title', label: 'Zajęty klucz', type: 'line' }] } };
  const sermon = { id: U('d002'), kind: 'text', data: { title: 'Niech mi się stanie', textType: U('d001'), tajemnica: U('c002') } };
  const plainText = { id: U('d003'), kind: 'text', data: { title: 'Bez rodzaju' } };
  const oldTopic = { id: U('d004'), kind: 'topic', data: { name: 'Stary temat' } };
  const lib7 = new ST.CogitaLibrary(fake('base', [TAJ, zw]), false);
  lib7.setSources([{ store: fake('scr', [type, sermon, plainText, oldTopic]), kind: 'writing', name: 'Skryptorium' }]);
  const s7 = lib7.entity(U('d002'));
  check('a text carries its text type as a second kind', s7.kinds, ['text', U('d001')]);
  const tajField = S.fieldsOf(s7, lib7.look).find((f) => f.key === 'tajemnica');
  check('… its fields stand next to the fixed ones; a core key of the type stays the text’s', [S.fieldsOf(s7, lib7.look).filter((f) => f.key === 'title').length, tajField?.type, S.fieldText(s7, tajField, lib7.look)], [1, 'ref', 'Zwiastowanie']);
  check('the type is a kind to point at and to learn from — not one to write in the base',
    [lib7.refKinds.some((k) => k.id === U('d001')), lib7.kinds.some((k) => k.id === U('d001')), lib7.materialKinds.some((k) => k.id === U('d001')), lib7.isForeignKind(U('d001'))], [true, false, true, true]);
  check('… its texts are its material; a text without a type is only a text', [lib7.material(U('d001')).map((e) => e.id), lib7.entity(U('d003')).kinds], [[U('d002')], ['text']]);
  check('no topics: no built-in, an old topic entry is no entry of the base at all', [KD.isBaseKind('topic'), lib7.kind('topic'), lib7.entity(U('d004'))], [false, undefined, undefined]);
  check('… an old revision with the source „Temat" says what to do instead',
    G.problemsOf(G.readGraph({ nodes: [n('t', 'source.topic')], edges: [] }), R.REVISION_PALETTE).map((p) => p.text), ['Źródło „Temat” już nie istnieje — tematów nie ma. Wybierz rodzaj, zbiór albo listę.']);
  check('… an old view step „Temat" selects nothing and is named',
    [SEL.readSteps([{ type: 'source.topic', config: { topic: 'x' } }]).map((st) => [st.type, st.config.retired]), VW.readView({ steps: [{ type: 'source.topic', config: {} }], group: { by: 'topic', axis: 'x' } }).retired.length], [[['source.list', 'source.topic']], 2]);
  check('… and an old topic in a base is under „Stare wpisy"', OLD.isOldInBase({ id: 'x', kind: 'entity', data: { _kinds: ['topic'], name: 'A' } }, () => undefined), true);
}
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

/* ══ 2026-10-17 — Formularze dodawania: viele Einträge aus einer Zeile ═══════════════════════════ */

{
  const LANG = kind('k-lang', { name: 'Język', label: '{name}', fields: [{ key: 'name', label: 'Nazwa', type: 'line' }] });
  const TOPIC = kind('k-topic', { name: 'Temat', label: '{name}', fields: [{ key: 'name', label: 'Nazwa', type: 'line' }] });
  const VWORD = kind('k-vword', {
    name: 'Słowo', label: '{text}', tells: 'lang',
    fields: [
      { key: 'text', label: 'Tekst', type: 'line' },
      { key: 'lang', label: 'Język', type: 'ref', to: ['k-lang'] },
      { key: 'topics', label: 'Tematy', type: 'ref', multi: true, to: ['k-topic'] },
      { key: 'level', label: 'Poziom', type: 'number' }
    ]
  });
  const TRANS = kind('k-trans', {
    name: 'Tłumaczenie', label: '{from}',
    fields: [{ key: 'from', label: 'Z', type: 'ref', to: ['k-vword'] }, { key: 'to', label: 'Na', type: 'ref', to: ['k-vword'] }, { key: 'note', label: 'Uwaga', type: 'line' }]
  });
  /* Wie der Nutzer es baute: EIN Feld für mehrere Wörter, jedes in seiner Sprache. */
  const GROUP = kind('k-group', { name: 'Tłumaczenie grupowe', label: '{words}', fields: [{ key: 'words', label: 'Słowa', type: 'ref', multi: true, to: ['k-vword'] }] });
  const people = [
    e('l-en', ['k-lang'], { name: 'angielski' }), e('l-pl', ['k-lang'], { name: 'polski' }), e('l-de', ['k-lang'], { name: 'niemiecki' }),
    e('t-zw', ['k-topic'], { name: 'Zwierzęta' }), e('t-dom', ['k-topic'], { name: 'Dom' }),
    e('w-pies', ['k-vword'], { text: 'pies', lang: 'l-pl', topics: ['t-zw'] })
  ];
  const kinds = [LANG, TOPIC, VWORD, TRANS, GROUP];
  const look = S.lookupOf(kinds, people);
  let n = 0;
  const ctx = (own = () => true) => ({ look, pool: (k) => people.filter((x) => x.kinds.includes(k)), isOwn: own, newId: () => `n${++n}` });
  const ids = (() => { let i = 0; return () => `g${++i}`; })();

  /* Der Anfang aus einem Rodzaj, der VERBINDET: zwei Wörter je Zeile, ihre Sprachen getrennt, die Themen gemeinsam. */
  const made = AB.formFromKind(TRANS, look, ids);
  const form0 = AF.readAddForm('f1', { name: made.name, graph: made.graph });
  const byLabel = (label) => form0.graph.nodes.find((x) => AF.nodeLabel(x, look, form0.graph) === label);
  check('a form from a linking kind: the root, two word rows, a language each, shared topics',
    form0.graph.nodes.map((x) => `${x.type}:${AF.nodeLabel(x, look, form0.graph)}`).sort(),
    ['entry:Tłumaczenie', 'entry:Z', 'entry:Na', 'pick:Język — Na', 'pick:Język — Z', 'pick:Tematy'].sort());
  check('… wired: words into the translation, languages and topics into the words', form0.graph.edges.length, 6);
  check('… a language must be chosen, topics may stay empty', [AF.pickConfig(byLabel('Język — Z').config).optional, AF.pickConfig(byLabel('Tematy').config).optional, AF.pickConfig(byLabel('Tematy').config).many], [false, true, true]);
  check('… the words are typed by the fields of their label', Object.keys(AF.entryConfig(byLabel('Z').config).fields), ['text']);
  check('the generated form has no problems', AT.formProblems(form0, look), []);
  const leaf = AB.formFromKind(VWORD, look, ids);
  check('a form from a typed kind: the kind itself, its references chosen on top', leaf.graph.nodes.map((x) => x.type).sort(), ['entry', 'pick', 'pick']);

  /* Mehrere Wörter in einer Zeile — „car", „automobile" ↔ „samochód". */
  const en = byLabel('Z');
  const pl = byLabel('Na');
  const root = byLabel('Tłumaczenie');
  const form = { ...form0, graph: { nodes: form0.graph.nodes.map((x) => (x.id === en.id ? { ...x, config: { ...x.config, many: true } } : x)), edges: form0.graph.edges } };
  const renamed = { nodes: form0.graph.nodes.map((x) => (x.id === en.id ? { ...x, config: { ...x.config, label: 'angielski' } } : x)), edges: form0.graph.edges };
  check('a language chosen for one row entry is named after it — also after renaming', AF.nodeLabel(byLabel('Język — Z'), look, renamed), 'Język — angielski');
  const top = { picks: { [byLabel('Język — Z').id]: ['l-en'], [byLabel('Język — Na').id]: ['l-pl'], [byLabel('Tematy').id]: ['t-dom'] }, asks: {} };
  const row = (a, b) => ({ [en.id]: a.map((text) => ({ text })), [pl.id]: b.map((text) => ({ text })) });
  const p1 = AF.planForm(form, ctx(), [row(['car', 'automobile'], ['samochód'])], top);
  const fresh = p1.saves.filter((s) => s.isNew);
  const word = (text) => fresh.find((s) => s.data.text === text);
  check('two words on one side, one on the other: three words and a translation for each pair', [fresh.filter((s) => s.kinds[0] === 'k-vword').length, fresh.filter((s) => s.kinds[0] === 'k-trans').length], [3, 2]);
  check('… each word carries its language and the topic chosen on top', [word('car').data.lang, word('samochód').data.lang, word('car').data.topics], ['l-en', 'l-pl', ['t-dom']]);
  check('… the translations point at the pairs', fresh.filter((s) => s.kinds[0] === 'k-trans').map((s) => [s.data.from, s.data.to]),
    [[word('car').id, word('samochód').id], [word('automobile').id, word('samochód').id]]);
  check('… words are saved before the translations', p1.saves.map((s) => s.kinds[0]), ['k-vword', 'k-vword', 'k-vword', 'k-trans', 'k-trans']);

  /* Was schon da ist, wird benutzt — und ergänzt. */
  const p2 = AF.planForm(form, ctx(), [row(['dog'], ['pies'])], top);
  const pies = p2.saves.find((s) => s.id === 'w-pies');
  check('an existing word (same text, same language) is used, the new topic added', [pies?.isNew, pies?.data.topics], [false, ['t-zw', 't-dom']]);
  check('… and the translation points at it', p2.saves.find((s) => s.kinds[0] === 'k-trans').data.to, 'w-pies');
  const p3 = AF.planForm(form, ctx((id) => id !== 'w-pies'), [row(['dog'], ['pies'])], top);
  check('a word from another base is used but not changed', [p3.saves.some((s) => s.id === 'w-pies'), p3.rows[0].made.some((m) => m.id === 'w-pies')], [false, true]);

  /* Dieselbe Liste: „zamek" zweimal ist ein Wort mit zwei Übersetzungen; eine Zeile zweimal macht nichts doppelt. */
  const p4 = AF.planForm(form, ctx(), [row(['castle'], ['zamek']), row(['lock'], ['zamek'])], top);
  check('the same word twice in one list is one word', [p4.saves.filter((s) => s.data.text === 'zamek').length, p4.saves.filter((s) => s.kinds[0] === 'k-trans').length], [1, 2]);
  const p5 = AF.planForm(form, ctx(), [row(['dog'], ['pies']), row(['dog'], ['pies'])], top);
  check('the same row twice: nothing twice (that is why a retry is harmless)', [p5.saves.filter((s) => s.data.text === 'dog').length, p5.saves.filter((s) => s.kinds[0] === 'k-trans').length], [1, 1]);
  const never = { ...form, graph: { nodes: form.graph.nodes.map((x) => (x.id === root.id ? { ...x, config: { ...x.config, reuse: 'never' } } : x)), edges: form.graph.edges } };
  check('… unless the node says „always new"', AF.planForm(never, ctx(), [row(['dog'], ['pies']), row(['dog'], ['pies'])], top).saves.filter((s) => s.kinds[0] === 'k-trans').length, 2);

  /* Was fehlt: kein Polnisch — kein Übersetzen; keine Sprache oben — nichts. */
  const p6 = AF.planForm(form, ctx(), [row(['cat'], [])], top);
  check('a row without the other side makes the word, not the translation', [p6.saves.map((s) => s.data.text ?? s.kinds[0]), p6.rows[0].skipped.map((s) => s.why)], [['cat'], ['brak: Na']]);
  const p7 = AF.planForm(form, ctx(), [row(['cat'], ['kot'])], { picks: {}, asks: {} });
  check('nothing happens without a required choice on top — one sentence names them all', [p7.saves.length, p7.problems], [0, ['Wybierz na początek: Język — Z, Język — Na.']]);
  check('an empty row is empty', AF.planForm(form, ctx(), [row([''], [])], top).rows[0].empty, true);

  /* EIN Feld für mehrere Wörter: zwei Zeilen-Einträge zum Anfang, „kolejny taki" für die nächste Sprache, alles in EINE Übersetzung. */
  const gf = AF.readAddForm('f2', { graph: AB.formFromKind(GROUP, look, ids).graph });
  const gl = (graph) => (x) => AF.nodeLabel(x, look, graph);
  check('a linking kind with ONE field for several words: two word rows, a language each, shared topics',
    gf.graph.nodes.map((x) => `${x.type}:${gl(gf.graph)(x)}`).sort(),
    ['entry:Słowa 1', 'entry:Słowa 2', 'entry:Tłumaczenie grupowe', 'pick:Język — Słowa 1', 'pick:Język — Słowa 2', 'pick:Tematy'].sort());
  const g1 = gf.graph.nodes.find((x) => gl(gf.graph)(x) === 'Słowa 1');
  const g2 = gf.graph.nodes.find((x) => gl(gf.graph)(x) === 'Słowa 2');
  const third = AB.duplicateEntry(gf.graph, g2.id, look, ids);
  const g3graph = third.graph;
  const by3 = (label) => g3graph.nodes.find((x) => gl(g3graph)(x) === label);
  check('„kolejny taki": the next word row with its own language, the shared topics, into the same field',
    [gl(g3graph)(by3('Słowa 3')), g3graph.edges.filter((e) => e.to === third.id).map((e) => gl(g3graph)(g3graph.nodes.find((x) => x.id === e.from))).sort(), g3graph.edges.filter((e) => e.from === third.id).map((e) => e.in)],
    ['Słowa 3', ['Język — Słowa 3', 'Tematy'], ['words']]);
  check('… its language starts empty and must be chosen', (({ value, optional }) => [value, optional])(AF.pickConfig(by3('Język — Słowa 3').config)), [[], false]);
  check('… and stands with the other languages on top, the shared topics after', AF.topOf({ ...gf, graph: g3graph }, look).map((t) => t.label), ['Język — Słowa 1', 'Język — Słowa 2', 'Język — Słowa 3', 'Tematy']);
  check('the next free name', [AB.nextLabel('Word', ['Word']), AB.nextLabel('Word 2', ['Word', 'Word 2']), AB.nextLabel('angielski', ['angielski', 'polski'])], ['Word 2', 'Word 3', 'angielski 2']);
  check('the modules under the canvas: the row entries in row order, the linking one last', AB.designOrder({ graph: g3graph }).entries.map(gl(g3graph)), ['Słowa 1', 'Słowa 2', 'Słowa 3', 'Tłumaczenie grupowe']);
  const gmany = { ...gf, graph: { nodes: g3graph.nodes.map((x) => (x.id === g1.id ? { ...x, config: { ...x.config, many: true } } : x)), edges: g3graph.edges } };
  const gtop = { picks: { [by3('Język — Słowa 1').id]: ['l-en'], [by3('Język — Słowa 2').id]: ['l-pl'], [by3('Język — Słowa 3').id]: ['l-de'] }, asks: {} };
  const gp = AF.planForm(gmany, ctx(), [{ [g1.id]: [{ text: 'car' }, { text: 'automobile' }], [g2.id]: [{ text: 'samochód' }], [third.id]: [{ text: 'Auto' }] }], gtop);
  check('one translation holding all four words in three languages', gp.saves.filter((s) => s.kinds[0] === 'k-group').map((s) => s.data.words.length), [4]);
  const gmiss = AF.planForm(gmany, ctx(), [{ [g1.id]: [{ text: 'cat' }], [g2.id]: [{ text: 'kot' }], [third.id]: [] }], gtop);
  check('… and none while one of its words is missing', [gmiss.saves.filter((s) => s.kinds[0] === 'k-group').length, gmiss.rows[0].skipped.map((s) => s.why)], [0, ['brak: Słowa 3']]);
  const g4 = AB.duplicateEntry(gf.graph, g1.id, look, ids).graph;
  check('copying a row entry shares the topics (a field taking several) and clones only its language',
    [g4.nodes.filter((x) => x.type === 'pick' && AF.nodeLabel(x, look, g4).startsWith('Tematy')).length, g4.nodes.filter((x) => x.type === 'pick').length], [1, 4]);

  /* Die Reihenfolge der Zeile: festgelegt statt wie auf der Leinwand. */
  const ordered = { ...gf, graph: g3graph, order: [third.id, g1.id] };
  check('the row order declared in the form comes first, the rest as on the canvas', AF.groupsOf(ordered, look).map((g) => g.label), ['Słowa 3', 'Słowa 1', 'Słowa 2']);
  check('… and it travels with the form', AF.readAddForm('f9', AF.addFormDoc(ordered)).order, [third.id, g1.id]);

  /* Vorhandenes in dieser Gestalt: Zeilen je Übersetzung, die Wörter in ihren Sprachen, und zurück. */
  const editPeople = [...people,
    e('w-car', ['k-vword'], { text: 'car', lang: 'l-en' }), e('w-samochod', ['k-vword'], { text: 'samochód', lang: 'l-pl' }),
    e('w-dog', ['k-vword'], { text: 'dog', lang: 'l-en' }), e('w-hund', ['k-vword'], { text: 'Hund', lang: 'l-de' }),
    e('gr1', ['k-group'], { words: ['w-car', 'w-samochod'] }), e('gr2', ['k-group'], { words: ['w-dog', 'w-hund'] }),
    e('gr3', ['k-group'], { words: ['w-pies'] })];
  const look2 = S.lookupOf(kinds, editPeople);
  const ctx2 = { look: look2, pool: (k) => editPeople.filter((x) => x.kinds.includes(k)), isOwn: () => true, newId: () => `m${++n}` };
  const eform = { ...gf, graph: g3graph };
  const shape = AE.existingRows(eform, look2, ctx2.pool, gtop);
  const cell = (row, node) => (shape.rows.find((r) => r.key === row)?.cells[node] ?? []).map((v) => v.texts.text);
  check('existing groups as rows, each word in its language column, empty where one is missing',
    [shape.rows.map((r) => r.key), cell('gr1', g1.id), cell('gr1', g2.id), cell('gr1', third.id), cell('gr2', third.id)], [['gr1', 'gr2', 'gr3'], ['car'], ['samochód'], [], ['Hund']]);
  const onlyPl = AE.existingRows(eform, look2, ctx2.pool, { picks: { [by3('Język — Słowa 1').id]: ['l-de'], [by3('Język — Słowa 2').id]: ['l-de'], [by3('Język — Słowa 3').id]: ['l-de'] }, asks: {} });
  check('… the choice on top is the filter: only rows with a word of the chosen languages', onlyPl.rows.map((r) => r.key), ['gr2']);
  const draft = {
    gr1: { cells: { [g1.id]: [{ id: 'w-car', texts: { text: 'cars' } }], [g2.id]: [], [third.id]: [{ texts: { text: 'Auto' } }] } },
    gr2: { cells: shape.rows.find((r) => r.key === 'gr2').cells, dropped: true },
    gr3: { cells: { [g1.id]: [{ texts: { text: 'dog' } }], [g2.id]: [{ id: 'w-pies', texts: { text: 'pies' } }] } }
  };
  const ep = AE.planEdit(eform, ctx2, gtop, shape, draft);
  const saved = (id) => ep.saves.find((s) => s.id === id);
  check('editing: a changed word, a word taken out, a new word made in its language, a row deleted',
    [saved('w-car')?.data.text, saved('gr1')?.data.words.length, saved('gr1')?.data.words.includes('w-samochod'), ep.saves.find((s) => s.isNew && s.data.text === 'Auto')?.data.lang, ep.drops],
    ['cars', 2, false, 'l-de', ['gr2']]);
  check('… a new word that already exists is used, not doubled', [saved('gr3')?.data.words, ep.saves.filter((s) => s.isNew && s.data.text === 'dog').length], [['w-pies', 'w-dog'], 0]);
  const tform = { ...form0, graph: form0.graph };
  const tshape = { rows: [{ key: 't1', root: 't1', cells: { [en.id]: [{ id: 'w-car', texts: { text: 'car' } }], [pl.id]: [] } }], root: root.id };
  const tlook = S.lookupOf(kinds, [...editPeople, e('t1', ['k-trans'], { from: 'w-car', to: 'w-samochod' })]);
  const tp = AE.planEdit(tform, { ...ctx2, look: tlook }, top, tshape, { t1: { cells: { [en.id]: [], [pl.id]: [] } } });
  truth('a field for ONE entry is not left empty', tp.problems.some((p) => p.includes('nie może zostać puste')), tp.problems);
  check('a row takes several words where its field takes several (a group), one where it takes one (a translation)',
    [AE.takesMany(eform, look2, shape.root, g1.id), AE.takesMany(tform, tlook, root.id, en.id), AE.takesMany(tform, tlook, null, en.id)], [true, false, false]);

  /* Getippt → Wert. */
  const field = (type, more = {}) => ({ key: 'x', label: 'X', type, multi: false, uncertain: false, ...more });
  check('typed values: a number with its unit, a date, yes', [AF.typedValue(field('number'), '20,5 cm'), AF.typedValue(field('date'), '1999-05'), AF.typedValue(field('bool'), 'tak')], [{ value: 20.5 }, { value: '1999-05' }, { value: true }]);
  check('typed values: a choice by its label, several values split at ;', [AF.typedValue(field('choice', { options: [{ value: 'n', label: 'rzeczownik' }] }), 'Rzeczownik'), AF.typedValue(field('line', { multi: true }), 'a; b')], [{ value: 'n' }, { value: ['a', 'b'] }]);
  truth('typed values: what does not fit says why', 'error' in AF.typedValue(field('number'), 'abc') && 'error' in AF.typedValue(field('date'), '31.02'));
  const levels = AF.readAddForm('f3', { graph: { nodes: [{ id: 'w', type: 'entry', x: 0, y: 0, config: { kind: 'k-vword', fields: { text: { from: 'type' }, level: { from: 'type' } } } }], edges: [] } });
  const pl3 = AF.planForm(levels, ctx(), [{ w: [{ text: 'kot', level: 'abc' }] }, { w: [{ text: 'mysz', level: '2' }] }], { picks: {}, asks: {} });
  check('a row with a value that does not fit is left out whole; the next one goes', [pl3.rows[0].problems.length, pl3.saves.map((s) => s.data.text), pl3.saves[0].data.level], [1, ['mysz'], 2]);
  const fixed = AF.readAddForm('f4', { graph: { nodes: [{ id: 'w', type: 'entry', x: 0, y: 0, config: { kind: 'k-vword', fields: { text: { from: 'type' }, level: { from: 'ask', value: '1' } } } }], edges: [] } });
  check('a field set on top: its default, or what was chosen', [AF.planForm(fixed, ctx(), [{ w: [{ text: 'a' }] }], { picks: {}, asks: {} }).saves[0].data.level, AF.planForm(fixed, ctx(), [{ w: [{ text: 'a' }] }], { picks: {}, asks: { 'w.level': '3' } }).saves[0].data.level], [1, 3]);

  /* Eine Liste aus einem Arbeitsblatt. */
  const groups = AF.groupsOf(form, look);
  check('the row in canvas order: the words, not the translation', groups.map((g) => g.label), ['Z', 'Na']);
  const pasted = AT.parsePaste('car, automobile\tsamochód\ndog\tpies\n\n', groups, AF.DEFAULT_PASTE);
  check('a pasted list: one row a line, tab columns, several values in a cell where the node takes several',
    [pasted.rows.length, pasted.rows[0][en.id].map((x) => x.text), pasted.rows[0][pl.id].map((x) => x.text), pasted.separator], [2, ['car', 'automobile'], ['samochód'], '\t']);
  check('… the separator is recognised', AT.parsePaste('dog - pies\ncat - kot', groups, AF.DEFAULT_PASTE).separator, ' - ');
  check('… a header line skipped, a wider line kept in the last column', (({ rows, wide }) => [rows.length, rows[0][pl.id][0].text, wide])(AT.parsePaste('EN\tPL\na\tb\tc', groups, { ...AF.DEFAULT_PASTE, header: true })), [1, 'b\tc', 1]);
  check('… and planned like typed rows', AF.planForm(form, ctx(), pasted.rows, top).saves.filter((s) => s.kinds[0] === 'k-trans').length, 3);

  /* Was ein Formular falsch beschreibt, und was es tut — in Worten. */
  const palette = AF.formPalette(look);
  const wrong = G.connect(form.graph, palette, { id: 'x1', from: byLabel('Tematy').id, out: 'out', to: en.id, in: 'lang' });
  truth('a topic does not go into the language field', 'error' in wrong, wrong);
  const said = AT.describeForm(form, look).join('\n');
  truth('the description says what is chosen, typed, paired and which keys do what',
    said.includes('Na początek wybierasz') && said.includes('Po jednym dla każdej pary') && said.includes('Enter — następne pole') && said.includes('Wklejanie listy'), said);
  check('a form reads back as itself', AF.addFormDoc(AF.readAddForm('f1', AF.addFormDoc(form))), AF.addFormDoc(form));
  check('in JSON its kinds and chosen entries are references', AF.mapFormRefs(form.graph, (k) => `@${k}`, (x) => `@${x}`).nodes.find((x) => x.id === en.id).config.kind, '@k-vword');
  check('a form without rows is a problem', AT.formProblems(AF.readAddForm('f5', {}), look), ['Dodaj co najmniej jeden wpis „w każdym wierszu".']);
}

/* ══ 0109 — die Logik, die Abläufe, die Regeln, das Spiel, die Arten, das Weitergeben ══════════ */

/*
 * Dieselbe Rechnung, die die Seiten, die Sitzungen und die Kanzlei benutzen —
 * gebaut mit dem, was diese Module mitziehen (der Dienst, die Schlüssel), aber
 * ohne einen Aufruf: nur gerechnet.
 */
const more = ['logic', 'flow', 'rules', 'game', 'kinds', 'live', 'store', 'sources', 'json', 'pageBase', 'visibility', 'fromEntry'];
const moreOut = join(workspace, 'more');
await build({
  entryPoints: {
    ...Object.fromEntries(more.map((m) => [m, `src/app/cogita/${m}.ts`])), steps: 'src/app/steps/steps.ts', partQuery: 'src/app/pages/partQuery.ts', quantities: 'src/app/core/quantities.ts',
    /* 2026-10-25 (Wywód) — dieselben Instanzen wie store/json oben: die Struktur, die Wejścia, die Widoki, die Rolle einer Aussage. */
    structure: 'src/app/cogita/structure.ts', anchors: 'src/app/cogita/anchors.ts', views2: 'src/app/cogita/views.ts', statement: 'src/app/library/statement.ts', selection2: 'src/app/cogita/selection.ts',
    /* 2026-10-25 — die Durchsicht eines Imports, und die Beschreibung des Imports „Dzieło z tekstem" (Anhang A des Leitfadens). */
    importReview: 'src/app/cogita/importReview.ts', sourceImport: 'src/app/library/sourceImport.ts'
  },
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
const [Lg, Fl, Ru, Ga, Ki, Li, So, Src, Js, PB, Vis, FE, St, PQ, QT, Wy, Anc, VW2, STM2, SEL2, IR, SI] = await Promise.all([...more, 'steps', 'partQuery', 'quantities', 'structure', 'anchors', 'views2', 'statement', 'selection2', 'importReview', 'sourceImport'].map(loadMore));

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
{
  /* 2026-10-22 (Schritt 12) — Erzähler nach Werten; eine Verwendung behält ihre eigenen, sonst die der Vorlage. */
  const tpl = Fl.readFlow('tpl', { name: 'T', narrators: [{ character: 'p1' }], graph: { nodes: [], edges: [] } });
  const find = (id) => (id === 'tpl' ? tpl : undefined);
  const own = Fl.resolveFlow(Fl.readFlow('u1', { template: 'tpl', narrators: [{ character: 'p2', condition: { type: 'value', value: 'v', op: 'ge', than: 1 } }] }), find);
  const inherited = Fl.resolveFlow(Fl.readFlow('u2', { template: 'tpl' }), find);
  check('narrators: a use keeps its own, otherwise the template\'s; the first whose condition holds tells', [
    own.narrators.map((x) => x.character), inherited.narrators.map((x) => x.character),
    Fl.narratorNow(own, facts({ values: { v: 0 } })), Fl.narratorNow(own, facts({ values: { v: 2 } }))?.character
  ], [['p2'], ['p1'], null, 'p2']);
  check('a scene step: "dalej", the question’s outcomes and the buttons are its exits', [
    Fl.exitsOf('scene', {}).map((x) => x.id),
    Fl.exitsOf('scene', { question: true, buttons: [{ exit: 'b0', label: 'Kontakt', target: 'link:k' }] }).map((x) => x.id),
    Fl.STEP_TYPES.includes('scene')
  ], [['next'], ['next', 'right', 'wrong', 'b0'], true]);
  check('a presentation flow: a path, no graph of its own', [Fl.readFlow('pf', { name: 'Droga', look: 'scenes', presentation: '#/parafia/droga' }).presentation, Fl.readFlow('nf', { name: 'x' }).presentation], ['parafia/droga', undefined]);
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

/* -- 2026-10-22 (Schritt 8): wer eine Baza liest, und was ein Eintrag braucht, wenn er umzieht ----------- */

{
  check('a base in a closed area: its members', Vis.audience({ areaPublic: false, areaRuleAt: '2026-10-22' }).startsWith('członkowie jej obszaru'), true);
  truth('a public area, base not opened yet: still members — and where to open it', Vis.audience({ areaPublic: true, areaRuleAt: null }).includes('nie jest jeszcze otwarta') && Vis.audience({ areaPublic: true, areaRuleAt: null }).includes('Kto czyta'));
  truth('a public, opened base: everyone, the WHOLE base said plainly', Vis.audience({ areaPublic: true, areaRuleAt: 'x' }).startsWith('każdy') && Vis.audience({ areaPublic: true, areaRuleAt: 'x' }).includes('pytania razem z odpowiedziami') && Vis.audience({ areaPublic: true, areaRuleAt: 'x' }).includes('szkice'));
  check('public = public area AND opened', [Vis.isPublicBase({ areaPublic: true, areaRuleAt: 'x' }), Vis.isPublicBase({ areaPublic: true, areaRuleAt: null }), Vis.isPublicBase({ areaPublic: false, areaRuleAt: 'x' }), Vis.isPublicBase(undefined)], [true, false, false, false]);
  const U = (n) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
  const [R, T, K, E, X, S] = [1, 2, 3, 4, 5, 6].map(U);
  const entries = new Map([
    [R, { kind: 'revision', data: { name: 'Powtórka', graph: { nodes: [{ config: { template: T, entity: E } }, { config: { missing: X } }] } } }],
    [T, { kind: 'template', data: { kinds: [K], note: `zob. [[x|@${R}]]` } }],
    [K, { kind: 'kind', data: { name: 'Postać' } }],
    [E, { kind: 'entity', data: { _kinds: [K], settings: S } }],
    [S, { kind: 'settings', data: { sources: [] } }]
  ]);
  const vlib = { store: { get: (id) => entries.get(id) } };
  check('what a revision needs from its base: templates, entries, kinds — step by step, no circle, no settings, nothing unknown', Vis.needsOf(vlib, R), [T, E, K]);
  check('… capped', Vis.needsOf(vlib, R, 1), [T]);
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

/* ══ 0110 — eine Baza wiedzy neben Bibliotheken, mit Quellen aus anderen Bereichen ══════════════ */

{
  /* Ein Speicher ohne Schlüssel und ohne Dienst: was die Baza wiedzy von ihm liest und in ihn schreibt. */
  const fake = (libraryId, areaId, entries) => {
    const map = new Map(entries.map((e) => [e.id, e]));
    const store = {
      libraryId, areaId, revision: 1, loaded: true, saved: [],
      all: () => [...map.values()],
      get: (id) => map.get(id),
      own: (id) => map.get(id),
      byKey: (key) => [...map.values()].find((e) => (e.key ?? '').toLowerCase() === key.toLowerCase()),
      ownByKey: (key) => [...map.values()].find((e) => (e.key ?? '').toLowerCase() === key.toLowerCase()),
      save: async (input) => { const entry = { ...input, id: input.id ?? `neu-${store.saved.length}` }; map.set(entry.id, entry); store.saved.push(entry); store.revision += 1; return entry; },
      remove: async (id) => { map.delete(id); store.revision += 1; },
      subscribe: () => () => undefined
    };
    return store;
  };
  const entity = (id, kinds, data) => ({ id, kind: 'entity', data: { _kinds: kinds, ...data } });
  /* 2026-10-23 — „Wiedza" ist fort: der eigene Eintrag ist eine Notatka (eigener Rodzaj), die Änderung einer eingebauten Art trifft das Pytanie. */
  const own = fake('A', 'area-a', [
    { id: 'kA', kind: 'kind', data: { name: 'Notatka', label: '{text}', fields: [{ key: 'text', label: 'Tekst', type: 'markup' }, { key: 'source', label: 'Źródło', type: 'ref', to: ['work'] }] } },
    entity('k1', ['kA'], { text: 'Inwokacja otwiera [[Pana Tadeusza|@mick]].', source: 'w1' }),
    { id: 'r1', kind: 'revision', data: { name: 'Codzienna', graph: { nodes: [], edges: [] } } },
    { id: 'o1', kind: 'kind', data: { builtin: 'question', name: 'Pytanie A', label: '{prompt}', fields: [] } },
    { id: 's1', kind: 'settings', data: { sources: [{ id: 'B', kind: 'knowledge', name: 'Parafia' }, { id: 'L', kind: 'books', name: 'Książki' }, { id: 'B', kind: 'knowledge' }, { kind: 'books' }] } }
  ]);
  const reused = fake('B', 'area-b', [
    { id: 'kB', kind: 'kind', data: { name: 'Postać', label: '{name}', fields: [{ key: 'name', label: 'Imię', type: 'line' }] } },
    { id: 'oB', kind: 'kind', data: { builtin: 'question', name: 'Pytanie B', label: '{prompt}', fields: [] } },
    entity('e2', ['kB'], { name: 'Jacek Soplica' }),
    entity('q2', ['question'], { form: 'text', prompt: 'Kto wygłosił spowiedź?', answers: ['Jacek Soplica'] }),
    { id: 'rB', kind: 'revision', data: { name: 'Postacie', graph: { nodes: [], edges: [] } } },
    { id: 'sB', kind: 'settings', data: { dependencies: [{ parent: 'e2', child: 'k1', kind: 'prerequisite', impact: 0.5 }], sources: [{ id: 'C', kind: 'books', name: 'Słowniki' }, { id: 'A', kind: 'knowledge', name: 'Kurs' }] } }
  ]);
  const books = fake('L', 'area-l', [
    { id: 'w1', kind: 'work', key: 'mick', data: { title: 'Pan Tadeusz' } },
    { id: 'p1', kind: 'person', data: { surname: 'Mickiewicz', givenNames: 'Adam' } }
  ]);
  const lib = new So.CogitaLibrary(own, true);
  check('sources are read from the settings: doubles and nameless entries dropped', lib.settings().sources.map((s) => [s.id, s.kind, s.name]), [['B', 'knowledge', 'Parafia'], ['L', 'books', 'Książki']]);

  const before = lib.revision;
  const opened = await Src.loadSources(lib, async (ref) => ({ B: reused, L: books }[ref.id] ?? null));
  check('loading follows a reused base into its own sources, without a circle; what cannot be read is missing', [opened.loaded.map((s) => s.store.libraryId), opened.missing.map((s) => s.id)], [['B', 'L'], ['C']]);
  lib.setSources(opened.loaded);
  truth('setting the sources changes the revision', lib.revision !== before);

  check('a reused base adds its entries; a library adds none to learn', lib.entities().map((e) => e.id).sort(), ['e2', 'k1', 'q2']);
  check('… but its books are there to point at', [lib.entity('w1')?.kinds, lib.label(lib.entity('w1'))], [['work'], 'Pan Tadeusz']);
  check('books are not content of the base', [lib.ofKind('work').length, lib.ofKind('kB').map((e) => e.id)], [0, ['e2']]);
  check('the kinds to build with leave out the libraries’ kinds; as targets of a reference they are there', [lib.kinds.some((k) => k.id === 'work'), lib.kinds.some((k) => k.id === 'kB'), lib.refKinds.some((k) => k.id === 'work')], [false, true, true]);
  check('the base’s own change of a built-in kind wins over the source’s', lib.kind('question').name, 'Pytanie A');
  check('revisions of a reused base are here too; settings stay its own', [lib.docs('revision').map((e) => e.id).sort(), lib.docs('settings').map((e) => e.id)], [['r1', 'rB'], ['s1']]);
  check('a citation key of a library resolves', lib.resolve('mick'), 'w1');
  check('where things come from', [lib.origin('k1').own, lib.origin('e2').name, lib.origin('w1').kind, lib.isOwn('e2')], [true, 'Parafia', 'books', false]);
  check('the dependencies of a reused base hold here', lib.dependencies().map((d) => `${d.parent}>${d.child}`), ['e2>k1']);
  check('learning search finds no books; a reference search does', [lib.search('Mickiewicz').length, lib.search('Mickiewicz', ['person'], true).map((e) => e.id)], [0, ['p1']]);

  /* 2026-10-22 (Schritt 8) — was ein Seitenbaustein aus der Baza selbst wählen kann (keine „veröffentlichten" mehr). */
  check('a page module picks revisions of the base and of its sources', PB.baseChoices(lib, ['revision']).map((c) => [c.id, c.label]), [['r1', 'Codzienna'], ['rB', 'Postacie']]);
  check('… entries (own and reused), and a library kind from the books it draws on', [PB.baseChoices(lib, ['entity']).map((c) => c.id).sort(), PB.baseChoices(lib, ['work']).map((c) => c.label)], [['e2', 'k1', 'q2'], ['Pan Tadeusz']]);
  check('the page’s own choice of an entry: own entries only, one kind by its name in any case', [PB.entityChoices(lib, '').map((c) => c.id), PB.entityChoices(lib, 'NOTATKA').map((c) => c.id), PB.entityChoices(lib, 'Postać').map((c) => c.id)], [['k1'], ['k1'], []]);
  const cards = (await lib.cards('kb')).cards;
  truth('a reused base’s question becomes a card here', cards.some((c) => c.question === 'q2'), cards.map((c) => c.question));

  let refused = '';
  await lib.saveEntity({ id: 'e2', kinds: ['kB'], data: { name: 'Ks. Robak' } }).catch((e) => { refused = e.message; });
  truth('what comes from a source is changed there, not here', refused.includes('Parafia') && reused.get('e2').data.name === 'Jacek Soplica', refused);
  let removed = '';
  await lib.remove('w1').catch((e) => { removed = e.message; });
  truth('… and a library’s book is not removed from here', removed.includes('Książki') && books.get('w1') !== undefined, removed);
  await lib.saveEntity({ id: 'k1', kinds: ['kA'], data: { text: 'Zmienione.' } });
  check('the base’s own entries are written to its own store', own.saved.map((e) => e.id), ['k1']);

  /* 2026-10-17 — viele auf einmal (Formularze dodawania), und ein Formularz im JSON des Schemas. */
  for (const store of [own, reused]) store.saveMany = async (inputs) => { const saved = []; for (const one of inputs) saved.push(await store.save(one)); return { saved, failed: [] }; };
  const many = await lib.saveMany([{ id: 'm1', kinds: ['kB'], data: { name: 'Telimena' } }, { id: 'k1', kinds: ['kA'], data: { text: 'Znowu zmienione.' } }]);
  check('saving many: a new one under its given id, an own one changed in place', [many.saved, own.get('m1')?.kind, own.get('m1')?.data._kinds, own.get('k1')?.data.text], [2, 'entity', ['kB'], 'Znowu zmienione.']);
  let refusedMany = '';
  await lib.saveMany([{ id: 'e2', kinds: ['kB'], data: { name: 'x' } }]).catch((e) => { refusedMany = e.message; });
  truth('… but nothing that comes from a source', refusedMany.includes('Parafia') && reused.get('e2').data.name === 'Jacek Soplica', refusedMany);
  const formGraph = { nodes: [{ id: 'p', type: 'entry', x: 0, y: 0, config: { kind: 'kB', fields: { name: { from: 'type' } } } }], edges: [] };
  await own.save({ id: 'af1', kind: 'addform', data: { name: 'Postacie', graph: formGraph } });
  await reused.save({ id: 'afB', kind: 'addform', data: { name: 'Z parafii', graph: formGraph } });
  check('forms of a reused base are here too', lib.docs('addform').map((x) => x.id).sort(), ['af1', 'afB']);
  const exported = Js.exportSchema(lib, 'Kurs', [lib.kind('kB')]);
  check('the schema JSON carries the own forms, their kinds as references', exported.forms.map((f) => [f.ref, f.graph.nodes[0].config.kind]), [['@af1', '@kB']]);
  const fresh = fake('F', 'area-f', []);
  const lib2 = new So.CogitaLibrary(fresh, true);
  const planned = Js.planImport(lib2, exported);
  const newKind = planned.kinds.find((k) => k.def.name === 'Postać')?.id;
  check('imported elsewhere, the form points at the new copy of its kind', planned.docs.filter((d) => d.kind === 'addform').map((d) => d.data.graph.nodes[0].config.kind), [newKind]);
  const schemaDoc = {
    format: 'recreatio.cogita.schema', version: 1,
    kinds: [
      { ref: '@slowo', name: 'Słowo', label: '{tekst}', fields: [{ key: 'tekst', type: 'line' }, { key: 'jezyk', type: 'ref', to: ['@jezyk'] }, { key: 'tematy', type: 'ref', multi: true, to: ['topic'] }] },
      { ref: '@jezyk', name: 'Język', label: '{nazwa}', fields: [{ key: 'nazwa', type: 'line' }] }
    ]
  };
  const sp = Js.planImport(lib2, schemaDoc);
  check('a reference field points at a kind further down the same document, and at a built-in one',
    sp.kinds.find((k) => k.def.name === 'Słowo').def.fields.map((f) => f.to ?? null), [null, [sp.kinds.find((k) => k.def.name === 'Język').id], ['topic']]);

  /* 2026-10-19 — ein Formularz als JSON für sich; und der Brewiarz vom Dokument bis zur Karte. */
  const oneForm = Js.exportForms(lib, [{ id: 'af1', data: own.get('af1').data }], 'Postacie');
  check('a form as JSON: the schema format, the form, its kind as a reference (a source kind is not copied)',
    [oneForm.format, oneForm.forms.map((f) => [f.ref, f.graph.nodes[0].config.kind]), oneForm.kinds], ['recreatio.cogita.schema', [['@af1', '@kB']], []]);
  check('a form import needs a form', 'error' in Js.planFormImport(lib2, { format: 'recreatio.cogita.schema', version: 1, kinds: [] }), true);
  const skipped = Js.planFormImport(lib2, { ...oneForm, entities: [{ ref: '@x', kinds: ['question'], data: { prompt: 'x' } }] });
  truth('… and leaves out what does not belong to forms, saying so', skipped.entities.length === 0 && skipped.warnings.some((w) => w.includes('entities')), skipped.warnings);

  const brew = JSON.parse(await readFile('scripts/fixtures/brewiarz.json', 'utf8'));
  const bstore = fake('G', 'area-g', []);
  bstore.saveMany = async (inputs) => { const saved = []; for (const one of inputs) saved.push(await bstore.save(one)); return { saved, failed: [] }; };
  const blib = new So.CogitaLibrary(bstore, true);
  const bplan = Js.planFormImport(blib, brew);
  check('the breviary JSON: two kinds, five templates, two forms', bplan.lines, ['Rodzaje: 2 nowych, 0 do zmiany.', 'Szablon kart: 5 nowych, 0 do zmiany.', 'Formularz dodawania: 2 nowych, 0 do zmiany.']);
  await Js.applyImport(blib, bplan, () => undefined);
  const formNamed = (name) => { const e = blib.docs('addform').find((x) => x.data.name === name); return AF.readAddForm(e.id, e.data); };
  let bn = 0;
  const bctx = () => ({ look: blib.look, pool: (k) => blib.ofKind(k), isOwn: (id) => blib.isOwn(id), newId: () => `brew-${++bn}` });
  const fill = async (form, rows, asks) => {
    const plan = AF.planForm(form, bctx(), rows, { picks: {}, asks });
    if (plan.problems.length > 0 || plan.rows.some((r) => r.problems.length > 0 || r.skipped.length > 0)) throw new Error(JSON.stringify([plan.problems, plan.rows]));
    await blib.saveMany(plan.saves.map((x) => ({ id: x.id, kinds: x.kinds, data: x.data })));
  };
  const vespers = formNamed('Nieszpory — psałterz czterotygodniowy');
  const compline = formNamed('Kompleta — co tydzień');
  const row = (day, a, b, c) => ({ miejsce: [{ dzien: day }], ps1: [{ nazwa: a }], ps2: [{ nazwa: b }], piesn: [{ nazwa: c }] });
  await fill(vespers, [row('niedziela', 'Ps 110', 'Ps 114', 'Ap 19,1-7')], { 'miejsce.tydzien': 'I', 'miejsce.godzina': 'II Nieszpory' });
  await fill(vespers, [row('poniedziałek', 'Ps 11', 'Ps 15', 'Ef 1,3-10')], {});
  await fill(vespers, [row('niedziela', 'Ps 110', 'Ps 115', 'Ap 19,1-7')], { 'miejsce.tydzien': 'II', 'miejsce.godzina': 'II Nieszpory' });
  await fill(compline, [
    { miejsce: [{ dzien: 'sobota' }], psalmy: [{ nazwa: 'Ps 4' }, { nazwa: 'Ps 134' }] },
    { miejsce: [{ dzien: 'niedziela' }], psalmy: [{ nazwa: 'Ps 91' }] }
  ], {});
  const textKind = blib.kinds.find((k) => k.name === 'Psalm lub pieśń').id;
  const placeKind = blib.kinds.find((k) => k.name === 'Miejsce w brewiarzu').id;
  check('filled: each psalm and canticle once (Ps 110 and Ap 19 used twice), five places',
    [blib.ofKind(textKind).length, blib.ofKind(placeKind).length], [10, 5]);
  const placeOf = (label) => blib.ofKind(placeKind).find((e) => blib.label(e) === label);
  check('a place holds its texts in order, the canticle last, with its hour and week',
    (() => { const e = placeOf('Tydzień I niedziela · II Nieszpory'); return e === undefined ? null : [e.data.teksty.map((id) => blib.label(blib.entity(id))), e.data.godzina, e.data.tydzien]; })(),
    [['Ps 110', 'Ps 114', 'Ap 19,1-7'], 'II Nieszpory', 'I']);
  check('a weekday takes the hour set on top (Nieszpory), compline repeats weekly (no week)',
    [blib.ofKind(placeKind).map((e) => blib.label(e)).sort()],
    [['Tydzień I niedziela · II Nieszpory', 'Tydzień I poniedziałek · Nieszpory', 'Tydzień II niedziela · II Nieszpory', 'niedziela · Kompleta', 'sobota · Kompleta']]);
  /* Die Reihenfolge der Zeile bestimmt auch die Reihenfolge im Feld, das mehrere nimmt (Jutrznia: Psalm, Pieśń, Psalm). */
  const reordered = { ...vespers, order: ['miejsce', 'ps1', 'piesn', 'ps2'] };
  const ro = AF.planForm(reordered, bctx(), [row('środa', 'Ps 63', 'Ps 149', 'Dn 3,57-88')], { picks: {}, asks: { 'miejsce.godzina': 'Jutrznia' } });
  const roPlace = ro.saves.find((x) => x.kinds.includes(placeKind));
  const labelOfPlanned = (id) => ro.saves.find((x) => x.id === id)?.data.nazwa;
  check('the declared row order is the order of the texts in the place', roPlace?.data.teksty.map(labelOfPlanned), ['Ps 63', 'Dn 3,57-88', 'Ps 149']);
  const bcards = (await blib.cards('brew')).cards;
  const tpl = (name) => blib.templates().find((t) => t.name === name).id;
  const cardOf = (name, label) => bcards.find((c) => c.template === tpl(name) && blib.label(blib.entity(c.entity)) === label);
  check('cards: the first, the third (the canticle) of a vespers; the second of a compline',
    [cardOf('1. tekst w tym miejscu', 'Tydzień I niedziela · II Nieszpory')?.prompt[0].text, cardOf('1. tekst w tym miejscu', 'Tydzień I niedziela · II Nieszpory')?.answer.accepted,
      cardOf('3. tekst w tym miejscu', 'Tydzień I niedziela · II Nieszpory')?.answer.accepted, cardOf('2. tekst w tym miejscu', 'sobota · Kompleta')?.answer.accepted],
    ['Tydzień I niedziela · II Nieszpory — 1. psalm lub pieśń?', ['Ps 110'], ['Ap 19,1-7'], ['Ps 134']]);
  check('… no second text where there is one, no third in compline', [cardOf('2. tekst w tym miejscu', 'niedziela · Kompleta'), cardOf('3. tekst w tym miejscu', 'sobota · Kompleta')], [undefined, undefined]);
  const when = bcards.find((c) => c.template === tpl('Kiedy jest ten psalm lub pieśń?') && blib.label(blib.entity(c.entity)) === 'Ps 110');
  check('… and back: where Ps 110 is said — both Sundays', when.answer.correct.map((i) => when.answer.options[i]).sort(), ['Tydzień I niedziela · II Nieszpory', 'Tydzień II niedziela · II Nieszpory']);
  const bschema = Js.exportSchema(blib, 'Brewiarz', blib.kinds);
  const whenOut = bschema.templates.find((t) => t.name === 'Kiedy jest ten psalm lub pieśń?').graph.nodes.find((x) => x.id === 'gdzie').config.kind;
  const again = Js.planImport(new So.CogitaLibrary(fake('H', 'area-h', []), true), bschema);
  const placeAgain = again.kinds.find((k) => k.def.name === 'Miejsce w brewiarzu').id;
  check('a kind named inside a template („Wpisy rodzaju") goes out as a reference and comes back as the new copy',
    [whenOut, again.docs.find((d) => d.kind === 'template' && d.data.name === 'Kiedy jest ten psalm lub pieśń?').data.graph.nodes.find((x) => x.id === 'gdzie').config.kind === placeAgain],
    [`@${placeKind}`, true]);
}

/* ══ 2026-10-22 (Schritt 9) — Widoki: eine Auswahl in Schritten, geteilt mit der Powtórka; Gruppen; der Zustand je Baustein ══ */

{
  const U = (n) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
  const [abr, iza, jak, daw, tOs, tObiet, tKrol, q1, ord] = [1, 2, 3, 4, 5, 6, 7, 8, 'e'].map(U);
  const kP = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';
  /* 2026-10-23 (Schritt 5) — die Achse ist ein Rodzaj: Wątek (mit Nummer und Grupa), keine Themen mehr. */
  const kW = 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1';
  const kG = 'd1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1';
  const kL = 'f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1';
  const map = new Map();
  const store = {
    libraryId: 'V', areaId: 'area-v', revision: 1, loaded: true,
    all: () => [...map.values()], get: (id) => map.get(id), own: (id) => map.get(id), byKey: () => undefined, ownByKey: () => undefined,
    save: async (input) => { map.set(input.id, input); store.revision += 1; return input; }, subscribe: () => () => undefined
  };
  const E = (id, kinds, data) => map.set(id, { id, kind: 'entity', data: { _kinds: kinds, ...data } });
  map.set(kP, { id: kP, kind: 'kind', data: { name: 'Postać', label: '{name}', fields: [
    { key: 'name', label: 'Imię', type: 'line' }, { key: 'father', label: 'Ojciec', type: 'ref', to: [kP] },
    { key: 'era', label: 'Epoka', type: 'line' }, { key: 'watki', label: 'Wątki', type: 'ref', multi: true, to: [kW] }] } });
  map.set(kW, { id: kW, kind: 'kind', data: { name: 'Wątek', label: '{name}', fields: [{ key: 'name', label: 'Nazwa', type: 'line' }, { key: 'numer', label: 'Numer', type: 'number' }, { key: 'grupa', label: 'Grupa', type: 'ref', to: [kG] }] } });
  map.set(kG, { id: kG, kind: 'kind', data: { name: 'Grupa wątków', label: '{name}', fields: [{ key: 'name', label: 'Nazwa', type: 'line' }] } });
  map.set(kL, { id: kL, kind: 'kind', data: { name: 'Porządek', label: '{name}', fields: [{ key: 'name', label: 'Nazwa', type: 'line' }, { key: 'watki', label: 'Wątki', type: 'ref', multi: true, to: [kW] }] } });
  E(abr, [kP], { name: 'Abraham', era: 'patriarchowie' });
  E(iza, [kP], { name: 'Izaak', father: abr, era: 'patriarchowie' });
  E(jak, [kP], { name: 'Jakub', father: iza, era: 'patriarchowie', watki: [tObiet] });
  E(daw, [kP], { name: 'Dawid', era: 'królowie', watki: [tKrol] });
  E(tOs, [kG], { name: 'Wątki' });
  E(tObiet, [kW], { name: 'Obietnica', numer: 1, grupa: tOs });
  E(tKrol, [kW], { name: 'Królestwo', numer: 2, grupa: tOs });
  E(ord, [kL], { name: 'Odwrotnie', watki: [tKrol, tObiet] });
  E(q1, ['question'], { form: 'text', prompt: 'Kto był ojcem Jakuba?', answers: ['Izaak'], about: [jak] });
  map.set('c1', { id: 'c1', kind: 'collection', data: { name: 'Pierwsi', list: [abr, iza] } });
  const lib = new ST.CogitaLibrary(store, true);
  const names = (steps, more = {}) => VW.viewList(lib, VW.readView({ steps, ...more })).map((e) => lib.label(e));
  const step = (type, config = {}) => ({ type, config });

  /* 2026-10-24 — Struktura: die Quelle als Wurzeln, jedes „Idź po odwołaniu" eine Ebene, nach Feldern. */
  const shape = (o) => o.roots.map(function walk(n) { return [lib.label(lib.entity(n.id)), ...(n.again ? ['↺'] : []), ...n.groups.map((g) => [g.label, ...g.nodes.map(walk)])]; });
  check('Struktura: Jakub, his father, his father’s father — one readable whole', shape(VW.viewOutline(lib, VW.readView({ mode: 'outline', steps: [step('source.list', { ids: jak }), step('follow', { field: 'father' }), step('follow', { field: 'father' })] }))),
    [['Jakub', ['Ojciec', ['Izaak', ['Ojciec', ['Abraham']]]]]]);
  check('… backwards: who points here, under „← field"', shape(VW.viewOutline(lib, VW.readView({ mode: 'outline', steps: [step('source.list', { ids: abr }), step('follow', { field: 'father', back: true })] }))),
    [['Abraham', ['← Ojciec', ['Izaak']]]]);
  check('… all references of an entry, grouped by field; without a follow step only the roots', [
    shape(VW.viewOutline(lib, VW.readView({ mode: 'outline', steps: [step('source.list', { ids: jak }), step('follow', { field: '' })] }))),
    shape(VW.viewOutline(lib, VW.readView({ mode: 'outline', steps: [step('source.list', { ids: `${abr}\n${iza}` })] })))
  ], [[['Jakub', ['Ojciec', ['Izaak']], ['Wątki', ['Obietnica']]]], [['Abraham'], ['Izaak']]]);
  check('… the mode is kept in the view document', VW.readView(VW.viewJson(VW.readView({ mode: 'outline' }))).mode, 'outline');

  const old = VW.readView({ name: 'Stary', mode: 'tree', kind: kP, rule: { op: 'and', items: [{ field: 'era', cmp: 'eq', value: 'królowie' }] } });
  check('an old view (kind + filter) reads as steps', old.steps.map((x) => x.type), ['source.kind', 'filter.rule']);
  const json = VW.viewJson(old);
  check('… and is written in the new shape only', [Object.keys(json).includes('kind'), Object.keys(json).includes('rule'), VW.readView(json).steps.length], [false, false, 2]);
  check('a view of one kind, by label', names([step('source.kind', { kind: kP })]), ['Abraham', 'Dawid', 'Izaak', 'Jakub']);
  check('no source: everything the base knows', names([]).length, 9);
  check('follow a field forward, twice', [names([step('source.list', { ids: [jak] }), step('follow', { field: 'father' })]), names([step('source.list', { ids: [jak] }), step('follow', { field: 'father' }), step('follow', { field: 'father' })])], [['Izaak'], ['Abraham']]);
  check('follow backwards along one field: the children', names([step('source.list', { ids: [abr] }), step('follow', { field: 'father', back: true })]), ['Izaak']);
  truth('backwards along anything: the question about him', names([step('source.list', { ids: [jak] }), step('follow', { back: true })]).includes('Kto był ojcem Jakuba?'), names([step('source.list', { ids: [jak] }), step('follow', { back: true })]));
  check('a filter with the collections’ rule', names([step('source.kind', { kind: kP }), step('filter.rule', { rule: { op: 'and', items: [{ field: 'era', cmp: 'eq', value: 'królowie' }] } })]), ['Dawid']);
  check('a collection as the source', names([step('source.collection', { collection: 'c1' })]), ['Abraham', 'Izaak']);
  check('the search narrows; the order follows a field, both ways', [names([step('source.kind', { kind: kP })], { query: 'iza' }), names([step('source.kind', { kind: kP })], { sort: { key: 'era', dir: 1 } })[0], names([step('source.kind', { kind: kP })], { sort: { key: 'era', dir: -1 } })[3]], [['Izaak'], 'Dawid', 'Dawid']);
  const view = VW.readView({ steps: [step('source.kind', { kind: kP })] });
  const list = VW.viewList(lib, view);
  check('groups by a field', VW.viewGroups(lib, { ...view, group: { by: 'field', field: 'era' } }, list).map((g) => [g.label, g.ids.length]), [['królowie', 1], ['patriarchowie', 3]]);
  const axis = (more = {}) => ({ by: 'axis', kind: kW, via: [], ...more });
  const grouped = (g, of = list) => VW.viewGroups(lib, { ...view, group: g }, of).map((x) => [x.label, x.ids.map((id) => lib.label(lib.entity(id)))]);
  check('groups by an axis — a kind: its entries are the values, ordered by a number field; the rest last', grouped(axis({ sort: { field: 'numer' } })),
    [['Obietnica', ['Jakub']], ['Królestwo', ['Dawid']], ['bez wartości na tej osi', ['Abraham', 'Izaak']]]);
  check('… ordered as another entry lists them', grouped(axis({ sort: { field: 'watki', list: ord } })).map((x) => x[0]), ['Królestwo', 'Obietnica', 'bez wartości na tej osi']);
  check('… under headings: a reference field of the values', VW.viewGroups(lib, { ...view, group: axis({ sort: { field: 'numer' }, group: 'grupa' }) }, list).map((x) => x.head?.label ?? null), ['Wątki', 'Wątki', null]);
  check('… membership through one chosen field only', grouped(axis({ via: ['father'] })).map((x) => x[0]), ['bez wartości na tej osi']);
  const asked = [lib.entity(q1)];
  check('… or one step further: the question about Jakub belongs to his thread', [grouped(axis({ via: ['watki'] }), asked), grouped(axis({ via: ['watki'], through: 'about' }), asked)],
    [[['bez wartości na tej osi', ['Kto był ojcem Jakuba?']]], [['Obietnica', ['Kto był ojcem Jakuba?']]]]);
  check('the axes: kinds with entries (not questions)', VW.axesOf(lib).map((k) => k.name), ['Postać', 'Wątek', 'Grupa wątków', 'Porządek']);
  check('a grouping by topics (until 2026-10-23) is read as none', SEL.readGrouping({ by: 'topic', axis: tOs }), null);
  check('the quick kind and the first filter are views into the steps', [VW.sourceKind(view), VW.sourceKind(VW.readView({ steps: [step('source.collection', { collection: 'c1' })] })), VW.ruleOf(VW.withRule(view, { op: 'or', items: [] }))?.op, VW.withSourceKind(view, '').steps[0].type],
    [kP, null, 'or', 'source.all']);
  check('columns: the first fields that are not long text', VW.viewColumns(lib, view, list).map((f) => f.key), ['name', 'father', 'era', 'watki']);

  /* Dieselben Schritte als Knoten der Powtórka. */
  const card = (id) => ({ key: `k-${id}`, entity: id, question: id, direction: 'a→b', answer: { form: 'flash' }, explain: [] });
  const cards = [abr, iza, jak, daw].map(card);
  const rctx = lib.revisionContext(cards, () => [], Date.now());
  const followed = (await R.planOf(G.readGraph({ nodes: [n('src', 'source.list', { ids: [jak] }), n('f', 'follow', { field: 'father' }, 5), n('s', 'strategy', { mode: 'once', order: 'given' }, 10)], edges: [l('1', 'src', 'cards', 'f', 'cards'), l('2', 'f', 'cards', 's', 'cards')] }), rctx)).plan;
  check('a revision follows the same step: the cards of the father', followed.cards.map((c) => c.entity), [iza]);
  const ruled = (await R.planOf(G.readGraph({ nodes: [n('src', 'source.all'), n('f', 'filter.rule', { rule: { op: 'and', items: [{ field: 'era', cmp: 'eq', value: 'królowie' }] } }, 5), n('s', 'strategy', { mode: 'once', order: 'given' }, 10)], edges: [l('1', 'src', 'cards', 'f', 'cards'), l('2', 'f', 'cards', 's', 'cards')] }), rctx)).plan;
  check('… and the same filter', ruled.cards.map((c) => c.entity), [daw]);

  /* Der Zustand je Baustein in der Adresse. */
  const a = PQ.scopeOf('0190a0a0-0000-7000-8000-00000000aaa1');
  const b = PQ.scopeOf('0190a0a0-0000-7000-8000-00000000bbb2');
  truth('two modules have two scopes (the random end of their ids)', a !== b && a.length === 6, [a, b]);
  let hash = '#/parafia/postacie?wpis=x';
  hash = PQ.withScope(hash, a, { q: 'Józef', e: 'id1' });
  hash = PQ.withScope(hash, b, { q: 'Dawid' });
  check('each module reads only its own keys; other keys stay', [PQ.readScope(hash, a), PQ.readScope(hash, b), hash.includes('wpis=x')], [{ q: 'Józef', e: 'id1' }, { q: 'Dawid' }, true]);
  check('clearing a key removes only that one', PQ.readScope(PQ.withScope(hash, a, { e: null }), a), { q: 'Józef' });

  /* ══ 2026-10-22 (Schritt 10) — die Macierz, Achsen als Spalten, ein Widok als Powtórka, die Taten ══ */
  const [tType, tAdw, tPost, tZwykly, txt1, txt2, cm1] = [9, 'a', 'b', 'c', 'd', 'e', 'f'].map(U);
  const kO = 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1';
  const bmap = new Map();
  const books = {
    libraryId: 'B', areaId: 'area-b', revision: 1, loaded: true, saved: [],
    all: () => [...bmap.values()], get: (id) => bmap.get(id), byKey: () => undefined,
    save: async (input) => { const entry = { ...input, id: input.id ?? `nowy-${books.saved.length}` }; bmap.set(entry.id, entry); books.saved.push(entry); books.revision += 1; return entry; },
    subscribe: () => () => undefined
  };
  const B = (id, kind, data) => bmap.set(id, { id, kind, data });
  /* 2026-10-23 (Schritt 5) — die Achsen sind Rodzaje der Baza (Wątek, Okres); Kazania zeigen über die Felder ihres Rodzaj tekstu auf sie, ein Komentarz über „O czym". */
  map.set(kO, { id: kO, kind: 'kind', data: { name: 'Okres', label: '{name}', fields: [{ key: 'name', label: 'Nazwa', type: 'line' }, { key: 'numer', label: 'Numer', type: 'number' }] } });
  E(tAdw, [kO], { name: 'Adwent', numer: 1 });
  E(tPost, [kO], { name: 'Wielki Post', numer: 2 });
  E(tZwykly, [kO], { name: 'Okres zwykły', numer: 3 });
  B(tType, 'texttype', { name: 'Kazanie', fields: [{ key: 'watek', label: 'Wątek', type: 'ref', to: [kW] }, { key: 'okres', label: 'Okres', type: 'ref', to: [kO] }] });
  B(txt1, 'text', { title: 'Kazanie o obietnicy', date: '2026-12-01', textType: tType, watek: tObiet, okres: tAdw, plan: [{ id: 'p1', text: 'Wstęp', depth: 0 }] });
  B(txt2, 'text', { title: 'Kazanie o królestwie', date: '2026-03-01', textType: tType, watek: tKrol, okres: tPost });
  /* Eine Aussage ist ein Eintrag der Baza (ein Rodzaj mit Feld blocks), kein Komentarz der Bibliothek. */
  const kS = 'b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1';
  map.set(kS, { id: kS, kind: 'kind', data: { name: 'Komentarz', label: '{content}', fields: [{ key: 'about', label: 'O czym', type: 'ref', multi: true, locator: true }, { key: 'content', label: 'Treść', type: 'blocks' }] } });
  E(cm1, [kS], { content: [{ type: 'paragraph', text: 'Obietnica dojrzewa w czasie.' }], about: [tAdw, tObiet] });
  lib.setSources([{ store: books, kind: 'writing', name: 'Kazania' }]);
  const rowsAxis = { by: 'axis', kind: kW, via: [], sort: { field: 'numer' } };
  const colsAxis = { by: 'axis', kind: kO, via: [], sort: { field: 'numer' } };
  const both = VW.readView({ name: 'Kazania i komentarze', mode: 'matrix', steps: [step('source.kind', { kind: 'text' }), step('source.kind', { kind: kS })], matrix: { rows: rowsAxis, cols: colsAxis } });
  const bothList = VW.viewList(lib, both);
  check('two sources at the start count together: sermons and statements', bothList.map((e) => lib.label(e)).sort(), [lib.label(lib.entity(cm1)), 'Kazanie o królestwie', 'Kazanie o obietnicy'].sort());
  truth('a source after a step starts anew', names([step('source.kind', { kind: kP }), step('filter.rule', { rule: { op: 'and', items: [] } }), step('source.list', { ids: [daw] })]).join() === 'Dawid');
  const mx = VW.viewMatrix(lib, both, bothList);
  check('the matrix shows every value of both axes, also empty ones', [mx.rows.map((g) => g.label), mx.cols.map((g) => g.label)], [['Obietnica', 'Królestwo'], ['Adwent', 'Wielki Post', 'Okres zwykły']]);
  check('a cell holds what belongs to both — a sermon and a statement', mx.cell(tObiet, tAdw).length === 2 && mx.cell(tKrol, tPost).length === 1 && mx.cell(tObiet, tZwykly).length === 0, true);
  check('an axis as a column: the values (of a kind) the entry points at — a sermon through its type field', VW.cellText(lib, lib.entity(txt1), `#axis:${kO}`), 'Adwent');
  check('a sermon carries its text type as a kind, its fields are fields', [lib.entity(txt1).kinds, lib.kinds.some((k) => k.id === tType)], [['text', tType], false]);
  check('the address of a cell', VW.cellKey('r', 'c'), 'r~c');

  const rev = VW.viewToRevision(both);
  check('a view becomes a revision: the same steps as nodes, two sources through „Razem", one strategy', rev.graph.nodes.map((x) => x.type), ['source.kind', 'source.kind', 'union', 'strategy']);
  check('… and back: what a revision selects, as steps', VW.stepsOfRevision(VW.viewToRevision(VW.readView({ steps: [step('source.kind', { kind: kP }), step('follow', { field: 'father' })] })).graph).map((x) => x.type), ['source.kind', 'follow']);
  const planned = (await R.planOf(G.readGraph(VW.viewToRevision(VW.readView({ steps: [step('source.list', { ids: [jak] }), step('follow', { field: 'father' })] })).graph), lib.revisionContext(cards, () => [], Date.now()))).plan;
  check('the revision made from a view asks the cards of its entries', planned.cards.map((c) => c.entity), [iza]);

  const here = VA.contextOf([{ grouping: both.matrix.rows, group: mx.rows[0] }, { grouping: both.matrix.cols, group: mx.cols[1] }]);
  check('a cell’s context: the values of both axes, in words', [here.links.map((x) => x.id), here.words], [[tObiet, tPost], ['Obietnica', 'Wielki Post']]);
  const madeComment = await VA.createHere(lib, VW.readView({ steps: [step('source.kind', { kind: kS })] }), here);
  check('a statement created in a cell is an entry of the base, pointing at both values („O czym")', [madeComment.inLibrary, map.get(madeComment.id)?.data._kinds, map.get(madeComment.id)?.data.about], [false, [kS], [tObiet, tPost]]);
  const sermonHere = await VA.createHere(lib, VW.readView({ steps: [step('source.kind', { kind: tType })] }), here);
  const madeSermon = bmap.get(sermonHere.id);
  check('… a sermon of a text type goes to its scriptorium, with the values in the fields of its type', [sermonHere.inLibrary, sermonHere.libraryId, madeSermon?.kind, madeSermon?.data.textType, madeSermon?.data.watek, madeSermon?.data.okres], [true, 'B', 'text', tType, tObiet, tPost]);
  const field = VA.contextOf([{ grouping: { by: 'field', field: 'era' }, group: { key: 't:krolowie', label: 'królowie', ids: [] } }]);
  const madePerson = await VA.createHere(lib, VW.readView({ steps: [step('source.kind', { kind: kP })] }), field);
  check('an entry of the base created in a group gets the group’s value', [madePerson.inLibrary, map.get(madePerson.id)?.data.era], [false, 'królowie']);
  check('a quote goes into a plan embedded, anything else as a link with its name', [VA.pointFor('quote', 'q', 'x'), VA.pointFor(kS, 'c', 'O [obietnicy] | czasie')], [{ text: '![@q]', kind: 'quote' }, { text: '[[O obietnicy czasie|@c]]', kind: 'thought' }]);
  const added = await VA.addToPlan(lib, txt1, [cm1, daw]);
  const newPlan = bmap.get(txt1).data.plan;
  /* ══ 2026-10-22 (Schritt 11) — ein Verweis mit Stelle, „Z wpisu", die gotowe schematy ══ */
  const [bible, lex, psalmKind, psalm] = ['a1', 'a2', 'a3', 'a4'].map((n) => U(n === 'a1' ? 'aa' : n === 'a2' ? 'bb' : n === 'a3' ? 'cc' : 'dd'));
  B(bible, 'work', { workType: 'bible', title: 'Pismo Święte', siglum: 'BT' });
  B(lex, 'work', { workType: 'book', title: 'Leksykon liturgiczny' });
  map.set(psalmKind, { id: psalmKind, kind: 'kind', data: { name: 'Psalm', label: '{miejsce}', fields: [{ key: 'miejsce', label: 'Miejsce w Piśmie', type: 'ref', to: ['work'], locator: true }, { key: 'haslo', label: 'Hasło', type: 'ref', to: ['work'], locator: true }] } });
  E(psalm, [psalmKind], { miejsce: { value: bible, locator: 'ps 110,1-7' }, haslo: { value: lex, locator: 's. 23' } });
  const psalmEntity = lib.entity(psalm);
  const placeField = lib.kind(psalmKind).fields[0];
  check('a reference with a place keeps its option and its value', [placeField.locator, S.valuesOf(psalmEntity, placeField)[0].locator, KD.kindDoc(lib.kind(psalmKind)).fields[0].locator], [true, 'ps 110,1-7', true]);
  check('… shown as the place in the Bible, read and written alike, with the edition', S.fieldText(psalmEntity, placeField, lib.look), 'Ps 110,1-7 (BT)');
  check('… any other work: the work and the place', S.fieldText(psalmEntity, lib.kind(psalmKind).fields[1], lib.look), 'Leksykon liturgiczny, s. 23');
  check('the label of a psalm is its place', lib.label(psalmEntity), 'Ps 110,1-7 (BT)');
  check('a text points at what it cites and links: source.from finds the statement and the person', (() => {
    const got = VW.viewList(lib, VW.readView({ steps: [step('source.from', { entry: txt1 })] })).map((e) => e.id);
    return [got.includes(cm1), got.includes(daw), got.includes(txt1)];
  })(), [true, true, false]);
  const fromPlan = (await R.planOf(G.readGraph(FE.fromEntryGraph(txt1)), lib.revisionContext(cards, () => [], Date.now()))).plan;
  check('a revision from a sermon: "Z wpisu" → the cards of what it points at', fromPlan.cards.map((c) => c.entity), [daw]);

  /* 2026-10-23 — die gotowe schematy sind Dateien: templates/cogita/*.json (nichts mehr im Frontend). */
  const dict = JSON.parse(await readFile('../templates/cogita/slownik.json', 'utf8'));
  const freshStore = { libraryId: 'D', areaId: 'area-d', revision: 1, loaded: true, all: () => [], get: () => undefined, byKey: () => undefined, save: async (x) => x, subscribe: () => () => undefined };
  const planned11 = Js.planImport(new So.CogitaLibrary(freshStore, true), dict);
  truth('the dictionary start imports: five kinds, four templates, no warning', !('error' in planned11) && planned11.kinds.length === 5 && planned11.docs.filter((d) => d.kind === 'template').length === 4 && planned11.warnings.length === 0, 'error' in planned11 ? planned11.error : planned11.warnings);
  const wordKind = planned11.kinds.find((k) => k.def.name === 'Słowo');
  const langKind = planned11.kinds.find((k) => k.def.name === 'Język');
  check('… a word points at its language (the reference resolved inside the document)', wordKind.def.fields.find((f) => f.key === 'jezyk').to, [langKind.id]);
  const psalter = Js.planImport(new So.CogitaLibrary(freshStore, true), JSON.parse(await readFile('../templates/cogita/psalterz.json', 'utf8')));
  const komentarz = Js.planImport(new So.CogitaLibrary(freshStore, true), JSON.parse(await readFile('../templates/cogita/komentarz.json', 'utf8')));
  truth('the comment template imports: one kind with a blocks field, two templates on it, no warning', !('error' in komentarz) && komentarz.kinds.length === 1 && komentarz.kinds[0].def.fields.some((f) => f.type === 'blocks')
    && komentarz.docs.filter((d) => d.kind === 'template').every((d) => JSON.stringify(d.data.kinds) === JSON.stringify([komentarz.kinds[0].id])) && komentarz.docs.filter((d) => d.kind === 'template').length === 2 && komentarz.warnings.length === 0,
    'error' in komentarz ? komentarz.error : komentarz.warnings);
  truth('the psalter start imports with a place in the Scripture', !('error' in psalter) && psalter.kinds.some((k) => k.def.fields.some((f) => f.key === 'miejsce' && f.locator === true && (f.to ?? []).includes('work'))), 'error' in psalter ? psalter.error : '');

  /* 2026-10-24 — EIN SPOSÓB DODAWANIA, ZWEI RODZAJE: der Komentarz biblijny (templates/cogita/komentarz-biblijny.json). */
  const kbDoc = Js.planImport(new So.CogitaLibrary(freshStore, true), JSON.parse(await readFile('../templates/cogita/komentarz-biblijny.json', 'utf8')));
  truth('the biblical commentary template imports: Komentarz (blocks, for/against) and Komentarz biblijny (a passage with its place, a comment), one adding method, no warning',
    !('error' in kbDoc) && kbDoc.kinds.length === 2 && kbDoc.docs.filter((d) => d.kind === 'addform').length === 1 && kbDoc.warnings.length === 0, 'error' in kbDoc ? kbDoc.error : kbDoc.warnings);
  const kbKinds = kbDoc.kinds.map((k) => k.def);
  const KOM = kbKinds.find((k) => k.name === 'Komentarz');
  const KB = kbKinds.find((k) => k.name === 'Komentarz biblijny');
  const BIBLE = e('bt', ['work'], { workType: 'bible', title: 'Biblia Tysiąclecia' });
  const kbPeople = [BIBLE];
  const kbLook = S.lookupOf([...kbKinds, { id: 'work', name: 'Źródło', label: '{title}', fields: [{ key: 'title', label: 'Tytuł', type: 'line' }] }], kbPeople);
  let kbN = 0;
  const kbCtx = () => ({ look: kbLook, pool: (k) => kbPeople.filter((x) => x.kinds.includes(k)), isOwn: () => true, newId: () => `kb${++kbN}` });
  const kbForm = AF.readAddForm('fkb', kbDoc.docs.find((d) => d.kind === 'addform').data);
  check('… the form types the passage’s place and the comment, and chooses the Bible once', AF.groupsOf(kbForm, kbLook, true).map((g) => [g.label, g.fields.map((f) => f.label)]),
    [['Komentarz biblijny', ['Fragment Pisma — miejsce']], ['Komentarz', ['Treść']]]);
  check('… the editing view of a form shows no place column (it is not a field of the kind)', AF.groupsOf(kbForm, kbLook).map((g) => g.label), ['Komentarz']);
  const kbRow = { kb: [{ '@loc:passage': 'Łk 1,35' }], kom: [{ content: 'Duch Święty zstąpi na Ciebie.\n\nTo zapowiedź Wcielenia.' }] };
  const kbPlan = AF.planForm(kbForm, kbCtx(), [kbRow], { picks: { pismo: ['bt'] }, asks: {} });
  const savedKom = kbPlan.saves.find((x) => x.kinds.includes(KOM.id));
  const savedKb = kbPlan.saves.find((x) => x.kinds.includes(KB.id));
  check('one row makes both entries, connected: the comment as two paragraphs, the commentary pointing at Łk 1,35 and at the comment',
    [kbPlan.problems, kbPlan.saves.length, savedKom?.data.content, savedKb?.data.passage, savedKb?.data.comment === savedKom?.id, Object.keys(savedKb?.data ?? {}).some((k) => k.startsWith('@loc:'))],
    [[], 2, [{ type: 'paragraph', text: 'Duch Święty zstąpi na Ciebie.' }, { type: 'paragraph', text: 'To zapowiedź Wcielenia.' }], { value: 'bt', locator: 'Łk 1,35' }, true, false]);
  check('… saved after the comment (the commentary points at it)', kbPlan.saves.map((x) => x.kinds[0]), [KOM.id, KB.id]);
  kbPeople.push(...kbPlan.saves.map((x) => e(x.id, x.kinds, x.data)));
  const kbAgain = AF.planForm(kbForm, { ...kbCtx(), look: S.lookupOf([...kbKinds, { id: 'work', name: 'Źródło', label: '{title}', fields: [{ key: 'title', label: 'Tytuł', type: 'line' }] }], kbPeople) }, [kbRow], { picks: { pismo: ['bt'] }, asks: {} });
  check('the same row again makes nothing new (the place counts: Łk 1,35 is found again)', kbAgain.saves.filter((x) => x.isNew).length, 0);
  const kbOther = AF.planForm(kbForm, { ...kbCtx(), look: S.lookupOf([...kbKinds, { id: 'work', name: 'Źródło', label: '{title}', fields: [{ key: 'title', label: 'Tytuł', type: 'line' }] }], kbPeople) },
    [{ ...kbRow, kb: [{ '@loc:passage': 'Łk 1,36' }] }], { picks: { pismo: ['bt'] }, asks: {} });
  check('… another verse with the same comment: one new commentary, the comment reused (no duplicate)', [kbOther.saves.filter((x) => x.isNew).map((x) => x.kinds[0]), kbOther.saves.find((x) => x.isNew)?.data.comment === savedKom?.id], [[KB.id], true]);
  check('… and the description says the place is typed in the row', AT.describeForm(kbForm, kbLook).some((line) => line.includes('Fragment Pisma ← „Pismo Święte", z miejscem wpisanym w wierszu')), true);
  check('add to plan: new points at the end, the old ones stay, ids stay unique', [added, newPlan.length, newPlan[0].id, newPlan[1].text, new Set(newPlan.map((x) => x.id)).size], [2, 3, 'p1', `[[${lib.label(lib.entity(cm1)).replace(/[[\]|]/g, ' ').replace(/\s+/g, ' ').trim()}|@${cm1}]]`, 3]);
}

/* -- 2026-10-23 (Schritt 13): Größen und Einheiten ------------------------------------------------------ */

{
  const kinds = new Map(QT.QUANTITY_KINDS.map((k) => [k.id, k]));
  const sameDim = (a, b) => JSON.stringify(kinds.get(a).dim) === JSON.stringify(kinds.get(b).dim);
  truth('every unit measures known kinds of one dimension; every kind has its SI unit (factor 1, no offset)',
    QT.UNITS.every((u) => u.kinds.length > 0 && u.kinds.every((k) => kinds.has(k) && sameDim(k, u.kinds[0])))
    && QT.QUANTITY_KINDS.every((k) => { const si = QT.unitById(k.si); return si !== undefined && si.factor === 1 && (si.offset ?? 0) === 0 && si.kinds.includes(k.id); }));
  check('unit ids are unique', new Set(QT.UNITS.map((u) => u.id)).size, QT.UNITS.length);
  check('writing a unit: N*m, N m, Nm, N·m, N⋅m, the QUDT id', ['N*m', 'N m', 'Nm', 'N·m', 'N⋅m', 'N-M'].map((t) => QT.findUnit(t)?.id), ['N-M', 'N-M', 'N-M', 'N-M', 'N-M', 'N-M']);
  check('case matters where it must: mm, km, KM (horsepower), nm', ['mm', 'km', 'KM', 'nm', 'KG'].map((t) => QT.findUnit(t)?.id ?? null), ['MilliM', 'KiloM', 'HP_Metric', 'NanoM', 'KiloGM']);
  check('exponents: m/s2, m/s^2, cm3, m²', ['m/s2', 'm/s^2', 'cm3', 'm²'].map((t) => QT.findUnit(t)?.id), ['M-PER-SEC2', 'M-PER-SEC2', 'CentiM3', 'M2']);
  check('reading quantities as typed',
    ['12 N·m', '12Nm', '1,5 kN', '−3,2e3 J', '1,5·10³ Pa', '12 000 kg', '20 °C', '45°', '12'].map((t) => { const r = QT.parseQuantity(t); return r === null ? null : [r.value, r.unit?.id ?? null]; }),
    [[12, 'N-M'], [12, 'N-M'], [1.5, 'KiloN'], [-3200, 'J'], [1500, 'PA'], [12000, 'KiloGM'], [20, 'DEG_C'], [45, 'DEG'], [12, null]]);
  check('to SI and back: kN, °C (an offset), km/h', [QT.toSI(1.5, QT.unitById('KiloN')), QT.toSI(20, QT.unitById('DEG_C')), QT.fromSI(293.15, QT.unitById('DEG_C')), QT.toSI(36, QT.unitById('KiloM-PER-HR'))], [1500, 293.15, 20, 10]);
  check('a kind from a unit only when it is unambiguous (N·m: torque or energy)', [QT.guessKind('kg'), QT.guessKind('m/s²'), QT.guessKind('N·m') ?? null, QT.guessKind('szt.') ?? null], ['Mass', 'Acceleration', null, null]);
  check('converting within a kind, never across', [QT.convert(1, QT.unitById('KiloW-HR'), QT.unitById('MegaJ')), QT.convert(1, QT.unitById('KiloGM'), QT.unitById('M'))], [3.6, null]);
  check('written back: 1,5 kN · 20 °C · 45°', [QT.quantityText(1.5, QT.unitById('KiloN')), QT.quantityText(20, QT.unitById('DEG_C')), QT.quantityText(45, QT.unitById('DEG'))], ['1,5 kN', '20 °C', '45°']);
  truth('the description names every kind', QT.QUANTITY_KINDS.every((k) => QT.quantitiesDescription().includes(`${k.id} (`)));
}
{
  /* Der Test des Schritts: ein Drehmoment in N·m ist richtig; dieselbe Zahl als Energie nicht. */
  const torque = Cards.questionCard(e('tq', ['q'], { form: 'number', prompt: 'Jaki moment siły?', answers: ['12'], unit: 'N·m', quantity: 'Torque' }), 's');
  const say = (given) => { const o = Cards.checkCard(torque, given); return [o.correct, o.note ?? null]; };
  check('a torque answer in N·m is accepted — also without a unit, as Nm, in kN·m and mN·m', ['12 N·m', '12', '12 Nm', '0,012 kN·m', '12000 mN·m'].map((g) => say(g)[0]), [true, true, true, true, true]);
  const asEnergy = say('12 J');
  check('the same number entered as an energy is rejected — and the verdict says why', [asEnergy[0], asEnergy[1].includes('energia') && asEnergy[1].includes('moment siły')], [false, true]);
  check('… an unknown unit says so', say('12 xyz'), [false, 'Nie znam jednostki „xyz”.']);
  check('… a wrong number in the right unit is wrong', say('13 N·m')[0], false);
  const legacy = Cards.questionCard(e('tl', ['q'], { form: 'number', prompt: '?', answers: ['12'], unit: 'N·m' }), 's');
  check('without a quantity an ambiguous unit stays as it was: the number counts', [legacy.answer.quantity ?? null, Cards.checkCard(legacy, '12 J').correct], [null, true]);
  const mass = Cards.questionCard(e('tm', ['q'], { form: 'number', prompt: 'Masa?', answers: ['2'], unit: 'kg', tolerance: 0.01 }), 's');
  check('an unambiguous unit gives the quantity: 2000 g is 2 kg, 2 m is not', [mass.answer.quantity, Cards.checkCard(mass, '2000 g').correct, Cards.checkCard(mass, '2 m').correct], ['Mass', true, false]);
  const written = Cards.questionCard(e('tw', ['q'], { form: 'number', prompt: '?', answers: ['0,012 kN·m'], unit: 'N·m', quantity: 'Torque' }), 's');
  check('a right answer written with its unit is read in the question\u2019s unit', [written.answer.values, Cards.checkCard(written, '12').correct], [[12], true]);
  const warm = Cards.questionCard(e('tt', ['q'], { form: 'number', prompt: '?', answers: ['20'], unit: '°C', quantity: 'ThermodynamicTemperature', tolerance: 0.5 }), 's');
  check('a temperature with an offset: 293,4 K and 68 °F are 20 °C (± 0,5), 21 °C is not', ['293,4 K', '68 °F', '21 °C'].map((g) => Cards.checkCard(warm, g).correct), [true, true, false]);
  check('the fingerprint of a number card does not change with its quantity (progress stays)', Cards.questionCard(e('tq', ['q'], { form: 'number', prompt: 'Jaki moment siły?', answers: ['12'], unit: 'N·m' }), 's').fingerprint, torque.fingerprint);
}
{
  /* Zahlenfelder mit Größe: gespeichert wie eingegeben, mit SI; gezeigt wie eingegeben; die Zahl in der Einheit des Feldes. */
  const MOTOR = kind('k-motor', { name: 'Silnik', label: '{name}', fields: [
    { key: 'name', label: 'Nazwa', type: 'line' },
    { key: 'moment', label: 'Moment', type: 'number', unit: 'N·m', quantity: 'Torque', multi: true },
    { key: 'masa', label: 'Masa', type: 'number', unit: 'kg' },
    { key: 'zle', label: 'Zła', type: 'number', unit: 'N·m', quantity: 'Nonsense' }
  ] });
  const [fName, fMoment, fMass, fBad] = MOTOR.fields;
  check('a number field keeps its quantity; an unknown one is dropped; the kind writes it back', [fMoment.quantity, fBad.quantity ?? null, KD.kindDoc(MOTOR).fields[1].quantity], ['Torque', null, 'Torque']);
  check('the kind of a field: named, or from an unambiguous unit', [S.fieldKind(fMoment), S.fieldKind(fMass), S.fieldKind(fBad) ?? null, S.fieldKind(fName) ?? null], ['Torque', 'Mass', null, null]);
  const env = S.quantityEnvelope(fMoment, 1.5, QT.unitById('KiloN-M'));
  check('entered in kN·m: kept as entered, with SI', env, { value: 1.5, unit: 'KiloN-M', si: 1500 });
  check('an energy unit is not taken by a torque field', 'error' in S.quantityEnvelope(fMoment, 12, QT.unitById('J')), true);
  const motor = e('m1', ['k-motor'], { name: 'Silnik A', moment: [env, 12, { value: 20, unit: 'N-M', si: 20 }], masa: { value: 2500, unit: 'GM', si: 2.5 } });
  const lookM = S.lookupOf([MOTOR], [motor]);
  const vals = S.valuesOf(motor, fMoment);
  check('read in the field\u2019s unit, the entered form beside it', vals.map((v) => [v.value, v.entered ?? null, v.si]), [[1500, { value: 1.5, unit: 'KiloN-M' }, 1500], [12, null, 12], [20, { value: 20, unit: 'N-M' }, 20]]);
  check('shown as entered', S.fieldText(motor, fMoment, lookM), '1,5 kN·m, 12 N·m, 20 N·m');
  check('a mass entered in grams: 2,5 kg for the field, "2500 g" on screen', [S.valuesOf(motor, fMass)[0].value, S.fieldText(motor, fMass, lookM)], [2.5, '2500 g']);
  check('typing a row of the add form: 1,5 kN·m, 12, 12 J', [AF.typedValue(fMoment, '1,5 kN·m'), AF.typedValue(fMoment, '12'), 'error' in AF.typedValue(fMoment, '12 J')], [{ value: [{ value: 1.5, unit: 'KiloN-M', si: 1500 }] }, { value: [{ value: 12, unit: 'N-M', si: 12 }] }, true]);
  const rule = (cmp, value) => SEL.ruleMatches(motor, lookM, { op: 'and', items: [{ field: 'masa', cmp, value }] });
  check('a filter in another unit of the same kind: masa > 2 kg, < 3000 g, = 2,5 kg; never in metres', [rule('gt', '2 kg'), rule('lt', '3000 g'), rule('eq', '2,5 kg'), rule('gt', '1 m'), rule('gt', '2')], [true, true, true, false, true]);
}

/* ══ 2026-10-24 — Wiedza und Nauka: zwei Teile, dieselben Bazy, alte Adressen führen weiter ══ */
{
  const T = (tail, prefer) => { const r = PARTS.cogitaTrail(tail, prefer); return [r.part, r.tail.join('/')]; };
  check('Wiedza: three activities first, the rest under „Więcej" (2026-10-25: Wejścia z Biblioteki)', [PARTS.KNOWLEDGE_TABS.map((t) => t[0]), PARTS.KNOWLEDGE_MORE.map((t) => t[0])], [['wpisy', 'dodaj', 'schematy'], ['ustawienia', 'json', 'do-zrobienia', 'propozycje', 'wejscia']]);
  /* 2026-10-27 — dazu die Ścieżka: die Reihenfolge des Lernens (`LearningPath.tsx`). */
  check('Nauka: learning only — no entries, no schema; the path of learning next to „Ucz się”', [PARTS.LEARN_TABS.map((t) => t[0]), PARTS.LEARN_MORE.map((t) => t[0]), PARTS.partOfTab('sciezka')], [['nauka', 'sciezka', 'powtorki', 'przebiegi', 'sesje', 'postepy'], ['karty', 'mapa', 'ustawienia'], 'learn']);
  check('Schematy: three independent categories', PARTS.SCHEMA_PARTS.map((p) => [p.slug, p.label]), [['rodzaje', 'Rodzaje wpisów'], ['dodawanie', 'Sposoby dodawania'], ['wyswietlanie', 'Sposoby wyświetlania']]);
  check('old addresses lead on: schemat, schemat/<kind>, schemat/formularz/<id>, wpisy/dodaj/<id>, wpisy/nowy/<kind>', [
    T(['schemat']), T(['schemat', 'k1']), T(['schemat', 'formularz']), T(['schemat', 'formularz', 'f1']), T(['wpisy', 'dodaj', 'f1']), T(['wpisy', 'nowy', 'k1'])
  ], [['knowledge', 'schematy/rodzaje'], ['knowledge', 'schematy/rodzaje/k1'], ['knowledge', 'schematy/dodawanie'], ['knowledge', 'schematy/dodawanie/f1'], ['knowledge', 'dodaj/f1'], ['knowledge', 'dodaj/nowy/k1']]);
  check('every tab finds its part; entries and views stay; settings stay in the part one is in', [
    T(['wpisy', 'e1']), T(['wpisy', 'widok', 'v1']), T(['karty', 't1']), T(['powtorki', 'r1'], 'knowledge'), T(['sesje', 's1', 'ekran']), T(['ustawienia'], 'learn'), T(['ustawienia']), T([], 'learn')
  ], [['knowledge', 'wpisy/e1'], ['knowledge', 'wpisy/widok/v1'], ['learn', 'karty/t1'], ['learn', 'powtorki/r1'], ['learn', 'sesje/s1/ekran'], ['learn', 'ustawienia'], ['knowledge', 'ustawienia'], ['learn', '']]);
  check('cogitaPath: an old link becomes the new address', [PARTS.cogitaPath('b1', 'wpisy', 'e1'), PARTS.cogitaPath('b1', 'schemat', 'formularz', 'f1'), PARTS.cogitaPath('b1', 'nauka')],
    ['#/workspace/knowledge/b1/wpisy/e1', '#/workspace/knowledge/b1/schematy/dodawanie/f1', '#/workspace/learn/b1/nauka']);
}

/* ══ 2026-10-25 — Wywód: eine Struktur aus eigenen Rodzajen, Wejścia z Biblioteki, ein Import, der sich wiederholen lässt ══ */
{
  const fake = (libraryId, areaId, entries) => {
    const map = new Map(entries.map((x) => [x.id, x]));
    const byKey = (key) => [...map.values()].find((x) => (x.key ?? '').toLowerCase() === key.toLowerCase());
    let n = 0;
    const store = {
      libraryId, areaId, revision: 1, loaded: true,
      all: () => [...map.values()], get: (id) => map.get(id), own: (id) => map.get(id), byKey, ownByKey: byKey,
      save: async (input) => { const entry = { ...input, id: input.id ?? `${libraryId}-neu-${n += 1}`, libraryId, updatedAt: `2026-10-25T10:00:${String(n).padStart(2, '0')}Z` }; map.set(entry.id, entry); store.revision += 1; return entry; },
      saveMany: async (inputs) => { const saved = []; for (const i of inputs) saved.push(await store.save(i)); return { saved, failed: [] }; },
      remove: async (id) => { map.delete(id); store.revision += 1; },
      subscribe: () => () => undefined
    };
    return store;
  };
  const W1 = '01a1c0de-0000-7000-8000-000000000001';
  const W2 = '01a1c0de-0000-7000-8000-000000000002';
  const W3 = '01a1c0de-0000-7000-8000-000000000003';
  const books = fake('L', 'area-l', [
    { id: W1, kind: 'work', key: 'kowalski2020', data: { workType: 'article', title: 'Miłość, która pyta', pages: '45–60' } },
    { id: W2, kind: 'work', key: 'sth', data: { workType: 'book', title: 'Summa theologiae', scheme: 'aquinas' } },
    /* 2026-10-25 — eine Erzählung (Kapitel als Stellen): drei parallele Strukturen in Beispiel 7.3 des Leitfadens. */
    { id: W3, kind: 'work', key: 'zielinska2019', data: { workType: 'book', title: 'Dom pod lipami', scheme: 'outline' } }
  ]);
  const base = fake('B', 'area-b', [{ id: 'sB', kind: 'settings', data: { sources: [{ id: 'L', kind: 'books', name: 'Biblioteka' }] } }]);
  const lib = new So.CogitaLibrary(base, true);
  lib.setSources((await Src.loadSources(lib, async (ref) => ({ L: books }[ref.id] ?? null))).loaded);

  /* Das Schema als Datei — nichts davon im Code. */
  const schema = JSON.parse(await readFile('../templates/cogita/wywod.json', 'utf8'));
  const p1 = Js.planImport(lib, schema);
  check('wywod.json imports: 3 kinds (Krok wywodu, Element stały, Komentarz), 6 views, 3 forms, 4 card templates — without a warning',
    [p1.kinds.filter((k) => k.isNew).map((k) => k.def.name), p1.docs.filter((d) => d.kind === 'view').length, p1.docs.filter((d) => d.kind === 'addform').length, p1.docs.filter((d) => d.kind === 'template').length, p1.warnings], [['Krok wywodu', 'Element stały', 'Komentarz'], 6, 3, 4, []]);
  await Js.applyImport(lib, p1, () => undefined);
  const krok = lib.kinds.find((k) => k.name === 'Krok wywodu');
  check('… the kind declares its structure field and its place in the work', [krok.fields.find((f) => f.key === 'nalezy').structure, krok.fields.find((f) => f.key === 'miejsce').locator, Wy.isStructured({ id: 'x', kinds: [krok.id], data: {} }, lib.look)], ['up', true, true]);
  const p1b = Js.planImport(lib, schema);
  check('… imported again: nothing new — kinds by name, views, forms and the card template by their lasting names', [p1b.kinds.filter((k) => k.isNew).length, p1b.docs.filter((d) => d.isNew).length, p1b.docs.length], [0, 0, 13]);
  check('… the kinds keep their lasting names (wywod/krok, wywod/element, komentarz/rodzaj)', ['Krok wywodu', 'Element stały', 'Komentarz'].map((n) => lib.entry(lib.kinds.find((k) => k.name === n).id)?.data._ref), ['wywod/krok', 'wywod/element', 'komentarz/rodzaj']);

  /* Ein Feld, das nur „parent" heisst, ist keine Verbindung der Struktur — nur die Erklärung zählt. */
  const genealogy = S.readKind('k-gen', { name: 'Osoba', fields: [{ key: 'bio', label: 'Bio', type: 'blocks' }, { key: 'parent', label: 'Rodzic', type: 'ref', role: 'parent' }] });
  check('a field merely named or role-tagged "parent" is not a structure link', Wy.isStructured({ id: 'g', kinds: ['k-gen'], data: { parent: 'h' } }, { kind: () => genealogy }), false);

  /* Die Beispiele des Leitfadens für die KI — genau so, wie sie dort stehen: Artikel, Summa, Roman, Korrektur. */
  const guide = await readFile('../templates/cogita/wywod-AI.md', 'utf8');
  const examples = [...guide.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => JSON.parse(m[1]));
  check('the AI guide carries four JSON examples (article, Summa, novel, correction)', examples.length, 4);
  for (const [i, example] of examples.entries()) {
    const plan = Js.planImport(lib, example);
    truth(`guide example ${i + 1} plans without a warning: kinds and views by lasting name, work by its key`, !('error' in plan) && plan.warnings.length === 0, 'error' in plan ? plan.error : plan.warnings);
    /* Die Korrektur (7.4) wird weiter unten in einer eigenen Baza durchgesehen und angenommen. */
    if (!('error' in plan) && i < 3) await Js.applyImport(lib, plan, () => undefined);
  }
  const step = (ref) => lib.entities().find((x) => lib.entry(x.id)?.data._ref === ref);
  const sth = step('sth/i-2-3/pytanie');
  const art = step('kowalski2020/calosc/pytanie');
  check('steps keep their lasting names; the work resolves from its key in a declared library', [typeof sth?.id, S.valuesOf(sth, krok.fields.find((f) => f.key === 'miejsce'))[0]?.value, S.valuesOf(sth, krok.fields.find((f) => f.key === 'miejsce'))[0]?.locator], ['string', W2, 'I q. 2 a. 3']);
  const again = Js.planImport(lib, examples[1]);
  check('the same document again changes the same entries — nothing doubled', [again.entities.filter((x) => x.isNew).length, again.entities.length, again.docs.filter((d) => d.isNew).length], [0, 9, 0]);

  /* Die Struktur: Geschwister in der Ordnung des Werks (arg. < sed contra < co. < ad), Gleichstand nach „nr". */
  const label = (x) => lib.label(x).split(/[.?]/)[0];
  const order = { tie: 'nr', label: (x) => lib.label(x) };
  const tree = Wy.structureTree(sth.id, lib, order);
  const shapeOf = (node) => [label(lib.entity(node.id)), ...node.children.map(shapeOf)];
  check('the Summa article as a tree: objections with their replies, sed contra, the answer with its ways in order', shapeOf(tree.root),
    ['Czy Bóg istnieje', ['Wydaje się, że Boga nie ma, bo istnieje zło', ['Bóg dopuszcza zło, aby wyprowadzić z niego dobro']], ['Wydaje się, że świat tłumaczy się bez Boga przez naturę i rozum', ['Natura i rozum działają ze względu na cel, który wyznacza Bóg']],
      ['Bóg mówi o sobie: „Jestem, który jestem”'], ['Istnienie Boga można wykazać na pięć dróg', ['Droga pierwsza wychodzi od ruchu: to, co się porusza, jest poruszane przez coś innego'], ['Droga druga wychodzi od przyczyny sprawczej, której łańcuch nie może iść w nieskończoność']]]);
  const textRows = Wy.textOrder(tree.root, lib).map((r) => lib.label(lib.entity(r.node.id)).slice(0, 14));
  check('… in the order of the text: arg. 1, arg. 2, sed contra, co., the ways, ad 1, ad 2', textRows,
    ['Wydaje się, że', 'Wydaje się, że', 'Bóg mówi o sob', 'Istnienie Boga', 'Droga pierwsza', 'Droga druga wy', 'Bóg dopuszcza ', 'Natura i rozum']);
  check('… the pieces of an article and the author’s numbers come from the place', [Wy.pieceOf('I q. 2 a. 3 arg. 1', 'aquinas'), Wy.pieceOf('I q. 2 a. 3 co.', 'aquinas'), Wy.authorNumber('I q. 2 a. 3 ad 2', 'aquinas'), Wy.pieceOf('s. 47', 'pages')], [1, 3, 2, null]);
  check('… places relative to the root: arg. 1, co.; pages stay', [Wy.relativePlace('I q. 2 a. 3 arg. 1', 'I q. 2 a. 3', 'aquinas'), Wy.relativePlace('I q. 2 a. 3 co.', 'I q. 2 a. 3', 'aquinas'), Wy.relativePlace('s. 47', 's. 45–60', 'pages')], ['arg. 1', 'co.', 's. 47']);
  const artRows = Wy.textOrder(Wy.structureTree(art.id, lib, order).root, lib).map((r) => Wy.placeOf(lib.entity(r.node.id), lib)?.locator);
  check('the journal article in the order of the text — by pages', artRows, ['s. 46', 's. 47–49', 's. 48', 's. 51', 's. 52', 's. 58']);

  /* Ohne lesbares Werk: der Układ aus den Stellen selbst — dieselbe Ordnung. */
  const blind = { entity: (id) => (id === W1 || id === W2 ? undefined : lib.entity(id)), look: lib.look, pointing: (id) => lib.pointing(id) };
  check('the scheme is recognised from the places when the work cannot be read', [Wy.recogniseScheme(['I q. 2 a. 3', 'I q. 2 a. 3 arg. 1', 'I q. 2 a. 3 co.']), Wy.recogniseScheme(['s. 46', 's. 47–49']), Wy.recogniseScheme(['rozdz. 1', 'rozdz. 10'])], ['aquinas', 'pages', 'outline']);
  check('… and the Summa article keeps its order for a reader who cannot open the Summa', Wy.textOrder(Wy.structureTree(sth.id, blind, order).root, blind).map((r) => lib.label(lib.entity(r.node.id)).slice(0, 14)), textRows);

  /* Der Widok aus dem Schema: Wurzeln, die Struktur bis zum Ende, die Kommentare an jedem Schritt. */
  const viewDoc = lib.docs('view').find((v) => v.data.name === 'Wywód');
  const view = VW2.readView(viewDoc.data);
  const shape = VW2.viewOutline(lib, view);
  check('the view „Wywód": every start of a structure as a root — the article twice (parallel reconstructions), the Summa, the novel three times', shape.roots.map((r) => [label(lib.entity(r.id)), r.groups.filter((g) => g.structure).flatMap((g) => g.nodes).length]).sort(),
    [['Czy Bóg istnieje', 4], ['Czy trzykrotne pytanie Jezusa w J 21 jest przesłuchaniem Piotra', 2], ['Dlaczego rozmowę nad jeziorem trzeba odczytać na nowo', 2],
      ['Historia trwa od posadzenia lip po decyzję Marty', 5], ['Marta przechodzi od ucieczki przed przeszłością do jej przyjęcia', 2], ['Powieść ma dwie części: powrót Marty i listy dziadka', 2]]);
  const atArg = VW2.viewOutline(lib, VW2.viewFrom(view, step('kowalski2020/calosc/arg1').id));
  check('opened at a step (an anchor in the middle): that step is the root, its sub-argument below', atArg.roots.map((r) => [label(lib.entity(r.id)), r.groups.flatMap((g) => g.nodes).map((x) => label(lib.entity(x.id)))]),
    [['Trzy pytania odpowiadają trzem zaparciom Piotra', ['To samo ognisko w J 18,18 i J 21,9 wiąże obie sceny']]]);
  const selected = (steps) => SEL2.runSteps(lib.selectContext(), steps).ids.length;
  check('the step „Idź po strukturze": all below, one level, upwards', [
    selected([{ type: 'source.list', config: { ids: [sth.id] } }, { type: 'structure', config: { dir: 'down', deep: true } }]),
    selected([{ type: 'source.list', config: { ids: [sth.id] } }, { type: 'structure', config: { dir: 'down', deep: false } }]),
    selected([{ type: 'source.list', config: { ids: [step('sth/i-2-3/ad1').id] } }, { type: 'structure', config: { dir: 'up', deep: true } }])
  ], [8, 4, 2]);

  /* Ein Kommentar an einem Schritt: neben dem Schritt, nie in der Struktur; die Rolle bleibt getrennt. */
  const komentarz = lib.kinds.find((k) => k.name === 'Komentarz');
  const comment = await lib.saveEntity({ kinds: [komentarz.id], data: { about: [{ value: step('sth/i-2-3/droga1').id }], content: [{ type: 'paragraph', text: 'Pierwsza droga zakłada fizykę Arystotelesa.' }] } });
  const premise = await lib.saveEntity({ kinds: [krok.id], data: { rola: 'argument', nalezy: step('kowalski2020/calosc/arg1').id, tresc: [{ type: 'paragraph', text: 'Piotr słyszy w pytaniu aluzję do zaparcia.' }] } });
  const role = (id) => STM2.statementRole(lib.entry(id), lib.markupLook);
  check('the badge: a step with a place reports the source; a premise without one, and a comment, are interpretation', [role(step('sth/i-2-3/ad1').id), role(premise.id), role(comment.id)], ['information', 'interpretation', 'interpretation']);
  const withComments = VW2.viewOutline(lib, VW2.viewFrom(view, sth.id));
  const way = withComments.roots[0].groups.find((g) => g.structure).nodes.find((x) => label(lib.entity(x.id)).startsWith('Istnienie')).groups.find((g) => g.structure).nodes[0];
  check('… the comment hangs beside the first way (← O czym), never as a step', [way.groups.filter((g) => g.structure).length, way.groups.filter((g) => !g.structure).map((g) => [g.label, g.nodes.length])], [0, [['← O czym', 1]]]);
  check('answered: a question with steps below it is answered; the counter-check stays open', [lib.markupLook.answered(sth.id), lib.answeredIds().has(art.id)], [true, true]);

  /* Die Wejścia z Biblioteki: Werk und Stellen → Eintrag und Widok. */
  const anchors = Anc.anchorsOf(lib).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  check('the anchors of the examples: work by key, view by lasting name, entry by lasting name; whole, one part, several parts', anchors.map((a) => [a.name, [W1, W2, W3].includes(a.work), lib.docs('view').some((v) => v.id === a.view), lib.entity(a.entry) !== undefined, a.locator]),
    [['Budowa powieści', true, true, true, ''], ['Chronologia historii', true, true, true, ''], ['Czy Bóg istnieje? (I q. 2 a. 3)', true, true, true, 'I q. 2 a. 3'], ['Jak zmienia się Marta', true, true, true, 'rozdz. 1–2; 5–6'],
      ['Teza i wniosek', true, true, true, 's. 45–46; 58–60'], ['Wstęp: skąd to pytanie', true, true, true, 's. 45–46'], ['Wywód całego artykułu', true, true, true, 's. 45–60']]);
  const whole = anchors.find((a) => a.name === 'Wywód całego artykułu');
  check('… an anchor opens its view at its entry', Anc.anchorPath('B', whole), `#/workspace/knowledge/B/wpisy/widok/${whole.view}/${whole.entry}`);
  check('… problems are named: a place the scheme cannot read', Anc.anchorProblems(lib, { ...whole, locator: 'gdzieś w środku' }).some((p) => p.includes('nie da się odczytać')), true);

  /* Der Export trägt die bleibenden Namen — ein zweiter Import ändert dieselben Einträge. */
  const exported = Js.exportCourse(lib, 'B');
  const back = Js.planImport(lib, exported);
  check('the export names steps and anchors by their lasting names; importing it back creates nothing', [exported.entities.some((x) => x.ref === '@kowalski2020/calosc/pytanie'), exported.anchors.some((x) => x.ref === '@kowalski2020/calosc/wejscie' && x.entry === '@kowalski2020/calosc/pytanie'), back.entities.filter((x) => x.isNew).length, back.docs.filter((d) => d.isNew).length], [true, true, 0, 0]);

  /* Die Vorschau eines Imports: der Baum, bevor etwas gespeichert ist. */
  const fresh = new So.CogitaLibrary(fake('C', 'area-c', [{ id: 'sC', kind: 'settings', data: { sources: [{ id: 'L', kind: 'books', name: 'Biblioteka' }] } }]), true);
  fresh.setSources((await Src.loadSources(fresh, async (ref) => ({ L: books }[ref.id] ?? null))).loaded);
  await Js.applyImport(fresh, Js.planImport(fresh, schema), () => undefined);
  const preview = Js.structurePreview(fresh, Js.planImport(fresh, examples[1]));
  check('the import preview shows the tree with places and the anchor', [preview[0], preview[1], preview[2].trim(), preview.some((l) => l.includes('Wejścia z Biblioteki'))],
    ['Struktura (+ nowe, ~ zmienione):', '+ Czy Bóg istnieje?  [I q. 2 a. 3]', '+   Wydaje się, że Boga nie ma, bo istnieje zło.  [I q. 2 a. 3 arg. 1]'.trim(), true]);

  /* Ein Rodzaj, den es schon gibt, wird ergänzt: komentarz-biblijny.json nach komentarz.json lässt „O czym" stehen. */
  const kb = Js.planImport(fresh, JSON.parse(await readFile('../templates/cogita/komentarz-biblijny.json', 'utf8')));
  const merged = kb.kinds.find((k) => k.def.name === 'Komentarz');
  check('a kind that exists is completed, not replaced: Komentarz keeps „O czym" and gains grounds and objections', [merged.isNew, merged.def.fields.map((f) => f.key)], [false, ['about', 'content', 'grounds', 'objections']]);
  truth('… and says that the missing field stays', kb.warnings.some((w) => w.includes('zostają')), kb.warnings);
  await Js.applyImport(fresh, Js.planImport(fresh, JSON.parse(await readFile('../templates/cogita/komentarz.json', 'utf8'))), () => undefined);
  const twice = Js.planImport(fresh, JSON.parse(await readFile('../templates/cogita/komentarz.json', 'utf8')));
  check('a template file imported twice: its card templates are recognised by name, not doubled', twice.docs.filter((d) => d.isNew).length, 0);

  /* Ein Name im Dokument, der zugleich Schlüssel einer Bibliothek ist: genannt. */
  const shadow = Js.planImport(fresh, { format: 'recreatio.cogita.entities', version: 1, entities: [{ ref: '@kowalski2020', kinds: ['Krok wywodu'], data: { rola: 'pytanie', tresc: [{ type: 'paragraph', text: 'Czy?' }] } }] });
  truth('a document name that is also a library key is named in a warning', shadow.warnings.some((w) => w.includes('kluczem w bibliotece')), shadow.warnings);
  const foreign = Js.planImport(fresh, { format: 'recreatio.cogita.entities', version: 1, entities: [{ ref: '@x', kinds: ['work'], data: { title: 'Kopia' } }] });
  truth('an entry of a Library kind is named: it would be a copy in the base', foreign.warnings.some((w) => w.includes('kopia')), foreign.warnings);

  /* ══ 2026-10-25 — der Import nach der Prüfung: Wiedererkennen, Namensräume, Zusammenführen, Kreise, Export ══ */
  let dn = 0;
  const freshBase = async () => {
    dn += 1;
    const l = new So.CogitaLibrary(fake(`D${dn}`, `area-d${dn}`, [{ id: `sD${dn}`, kind: 'settings', data: { sources: [{ id: 'L', kind: 'books', name: 'Biblioteka' }] } }]), true);
    l.setSources((await Src.loadSources(l, async (ref) => ({ L: books }[ref.id] ?? null))).loaded);
    return l;
  };
  const doImport = async (l, doc) => { const p = Js.planImport(l, doc); if ('error' in p) throw new Error(p.error); await Js.applyImport(l, p, () => undefined); return p; };
  const para = (text) => [{ type: 'paragraph', text }];
  const entitiesDoc = (entities, anchors) => ({ format: 'recreatio.cogita.entities', version: 1, entities, ...(anchors === undefined ? {} : { anchors }) });

  {
    /* Ein älterer Import (die Datei, als ihre Vorlagen noch keine bleibenden Namen trugen): die neue Datei erkennt sie am Namen UND an den Rodzajen. */
    const l = await freshBase();
    const kom = JSON.parse(await readFile('../templates/cogita/komentarz.json', 'utf8'));
    await doImport(l, { ...kom, templates: kom.templates.map(({ ref, ...t }) => t) });
    const p = await doImport(l, kom);
    check('an older import without lasting names: the new file finds its templates by name and kinds, names them, doubles nothing',
      [p.docs.filter((d) => d.isNew).length, l.docs('template').length, l.docs('template').map((t) => t.data._ref).sort()], [0, 2, ['komentarz/t-tabela', 'komentarz/t-teza']]);
    truth('… and says that it replaces them', p.warnings.filter((w) => w.includes('zostanie zastąpiony')).length === 2, p.warnings);
    const again = Js.planImport(l, kom);
    truth('… a third import goes by the lasting names, without the warning', again.docs.every((d) => !d.isNew) && !again.warnings.some((w) => w.includes('zastąpiony')), again.warnings);
    const tpl = (kinds) => ({ format: 'recreatio.cogita.schema', version: 1, templates: [{ name: 'Teza', kinds, graph: { nodes: [], edges: [] } }] });
    await l.saveKind(S.readKind('k-inny', { name: 'Inny', fields: [{ key: 'a', label: 'A', type: 'text' }] }));
    const otherKind = Js.planImport(l, tpl(['Inny']));
    await l.saveDoc('template', { name: 'Teza', kinds: [l.kinds.find((k) => k.name === 'Komentarz').id], graph: { nodes: [], edges: [] } });
    const twoOfThem = Js.planImport(l, tpl(['Komentarz']));
    check('a template of the same name for another kind is another template; of two with the same name none is guessed', [otherKind.docs[0].isNew, twoOfThem.docs[0].isNew], [true, true]);
    const ps = JSON.parse(await readFile('../templates/cogita/psalterz.json', 'utf8'));
    await doImport(l, ps);
    check('psalterz.json twice: its templates and forms come back by their lasting names', Js.planImport(l, ps).docs.filter((d) => d.isNew).length, 0);
  }

  const l2 = await freshBase();
  await doImport(l2, schema);
  const krok2 = l2.kinds.find((k) => k.name === 'Krok wywodu');
  {
    /* Ein Name, zwei Räume: der Wejście „@q" und der Eintrag „@q" bleiben zwei. */
    const ns = Js.planImport(l2, entitiesDoc([{ ref: '@q', kinds: ['Krok wywodu'], data: { rola: 'pytanie', tresc: para('Czy?') } }],
      [{ ref: '@q', name: 'Wejście', work: '@kowalski2020', entry: '@q', view: 'Wywód' }]));
    check('one name, two spaces: the anchor „@q" and the entry „@q" stay two, and the anchor opens the entry', [ns.docs[0].id !== ns.entities[0].id, ns.docs[0].data.entry === ns.entities[0].id, ns.warnings], [true, true, []]);
    await l2.saveEntity({ id: 'e-same', kinds: [krok2.id], data: { rola: 'argument', tresc: para('Racja.') }, marks: { _ref: 'a/b' } });
    await l2.saveDoc('view', { name: 'V', mode: 'table', steps: [], _ref: 'a/b' });
    check('lasting names per sort: an entry and a view may share one', [l2.byImportRef('a/b', 'entity')?.id, l2.byImportRef('a/b', 'view')?.kind, l2.byImportRef('A/B', 'kind')], ['e-same', 'view', undefined]);
    let refused = '';
    try { await l2.saveDoc('view', { name: 'X' }, 'e-same'); } catch (e) { refused = e.message; }
    let refusedKind = '';
    try { await l2.saveKind(S.readKind('e-same', { name: 'Y', fields: [] })); } catch (e) { refusedKind = e.message; }
    check('an existing entry never changes its sort: a view or a kind over an entry is refused', [refused.includes('innego rodzaju'), refusedKind.includes('innego rodzaju'), l2.entity('e-same') !== undefined], [true, true, true]);
  }
  {
    /* Ein Rodzaj mit bleibendem Namen: behält ihn im Editor und wird nach dem Umbenennen daran gefunden. */
    const kdoc = { format: 'recreatio.cogita.schema', version: 1, kinds: [{ ref: '@test/rodzaj', name: 'Rodzaj testowy', fields: [{ key: 'a', label: 'A', type: 'text' }] }] };
    const k1 = await doImport(l2, kdoc);
    const kid = k1.kinds[0].id;
    await l2.saveKind({ ...l2.kind(kid), name: 'Przemianowany' });
    const k2 = Js.planImport(l2, kdoc);
    check('a kind keeps its lasting name through the editor and is found by it after a rename', [l2.entry(kid)?.data._ref, k2.kinds[0].id, k2.kinds[0].isNew], ['test/rodzaj', kid, false]);
    /* Ein Rodzaj, der ergänzt wird: die Reihenfolge des Dokuments, ein bleibendes Feld hinter seinem alten Nachbarn; Etikett und Unterscheidung bleiben. */
    await doImport(l2, { format: 'recreatio.cogita.schema', version: 1, kinds: [{ ref: '@o', name: 'Kolejność', label: '{a} {x}', tells: 'x', fields: [{ key: 'a', label: 'A', type: 'text' }, { key: 'x', label: 'X', type: 'text' }, { key: 'b', label: 'B', type: 'text' }] }] });
    const re = Js.planImport(l2, { format: 'recreatio.cogita.schema', version: 1, kinds: [{ name: 'Kolejność', fields: [{ key: 'b', label: 'B', type: 'text' }, { key: 'a', label: 'A', type: 'text' }] }] });
    check('a kind completed in place: the document’s order, a kept field behind its old neighbour; label and tells stay when not named', [re.kinds[0].def.fields.map((f) => f.key), re.kinds[0].def.label, re.kinds[0].def.tells], [['b', 'a', 'x'], '{a} {x}', 'x']);
  }
  {
    /* „Beantwortet": was eine Frage in einer Struktur unter sich nennt (down), beantwortet sie — und wird dadurch nicht selbst beantwortet. */
    await doImport(l2, { format: 'recreatio.cogita.course', version: 1,
      kinds: [{ ref: '@teza', name: 'Teza z argumentami', label: '{tresc}', fields: [{ key: 'tresc', label: 'Treść', type: 'blocks' }, { key: 'za', label: 'Argumenty', type: 'ref', multi: true, structure: 'down' }] }],
      entities: [
        { ref: '@t/q', kinds: ['@teza'], data: { tresc: para('Czy świat ma początek?'), za: ['@t/c'] } },
        { ref: '@t/c', kinds: ['@teza'], data: { tresc: para('Czy czas ma początek?') } }
      ] });
    const q = l2.byImportRef('t/q', 'entity').id;
    const c = l2.byImportRef('t/c', 'entity').id;
    check('a question that lists another under it (down) is answered; the one listed is not answered by that', [l2.answeredIds().has(q), l2.answeredIds().has(c)], [true, false]);
  }
  {
    /* Zusammengeführt: der Bleibende trägt beide Namen; derselbe Import danach legt nichts an. */
    const mdoc = entitiesDoc([
      { ref: '@m/a', kinds: ['Krok wywodu'], data: { rola: 'argument', tresc: para('Pierwsza racja.') } },
      { ref: '@m/b', kinds: ['Krok wywodu'], data: { rola: 'argument', tresc: para('Ta sama racja inaczej.') } }]);
    await doImport(l2, mdoc);
    const a = l2.byImportRef('m/a', 'entity').id;
    const b = l2.byImportRef('m/b', 'entity').id;
    await l2.merge(a, b);
    const after = Js.planImport(l2, mdoc);
    check('merged entries keep both lasting names: the same document again creates nothing and writes into the kept one',
      [l2.entry(a)?.data._refs, l2.entry(a)?.data._ref, after.entities.length, after.entities[0].id, after.entities.filter((x) => x.isNew).length], [['m/b'], 'm/a', 1, a, 0]);
    truth('… and says that two names are one entry now', after.warnings.some((w) => w.includes('jeden wpis')), after.warnings);
    const reversed = Js.planImport(l2, entitiesDoc([...mdoc.entities].reverse()));
    check('… the kept entry keeps its own text, whatever the order of the rows (the dropped name only fills what is empty)',
      [after.entities[0].data.tresc[0].text, reversed.entities[0].data.tresc[0].text, reversed.entities.length], ['Pierwsza racja.', 'Pierwsza racja.', 1]);
    const onlyOld = Js.planImport(l2, entitiesDoc([mdoc.entities[1]]));
    check('… a document with only the dropped name changes nothing that is filled', [onlyOld.entities[0].id, onlyOld.entities[0].data.tresc[0].text], [a, 'Pierwsza racja.']);
    check('lasting names ignore case', Js.planImport(l2, entitiesDoc([{ ref: '@M/A', kinds: ['Krok wywodu'], data: { rola: 'argument' } }])).entities[0].id, a);
  }
  {
    /* Was nicht aufgeht: in einem Verweisfeld fällt es weg (mit Hinweis); ein Name mit „/" in einem Textfeld ist Text und bleibt — auch wenn es einen Eintrag dieses Namens gibt. */
    const tp = Js.planImport(l2, entitiesDoc([{ ref: '@m/c', kinds: ['Krok wywodu'], data: { rola: 'argument', tresc: para('Racja.'), nalezy: '@nikt/nigdzie', miejsce: { value: '@brak2021', locator: 's. 3' } } }]));
    check('in a reference field a name that leads nowhere is left out and named; a key without „/" points to Więcej → Ustawienia → Źródła',
      [tp.entities[0].data.nalezy, tp.warnings.some((w) => w.includes('@nikt/nigdzie') && w.includes('nie ma wpisu o tej nazwie')), tp.warnings.some((w) => w.includes('@brak2021') && w.includes('Więcej → Ustawienia → Źródła'))], [undefined, true, true]);
    const notes = await doImport(l2, { format: 'recreatio.cogita.course', version: 1,
      kinds: [{ ref: '@test/notatka', name: 'Notatka testowa', fields: [{ key: 'tekst', label: 'Tekst', type: 'line' }, { key: 'o', label: 'O', type: 'ref' }, { key: 'tresc', label: 'Treść', type: 'blocks' }] }],
      entities: [{ ref: '@test/n1', kinds: ['@test/notatka'], data: { tekst: '@m/a', o: '@m/a', tresc: [{ type: 'paragraph', text: '@m/a' }, { type: 'unordered', items: [[{ ref: '@m/a' }]] }] } }] });
    const n1 = notes.entities[0].data;
    const am = l2.byImportRef('m/a', 'entity').id;
    check('a name with „/" is a reference only where the field is one: a line keeps „@m/a", the reference field and a cell reference get the entry',
      [n1.tekst, n1.o, n1.tresc[0].text, n1.tresc[1].items[0][0].ref], ['@m/a', am, '@m/a', am]);
  }
  {
    /* Ein Kreis in der Struktur wird vor dem Speichern genannt — und was unter ihm hängt; ein richtiger Anfang nicht. */
    const cyc = Js.planImport(l2, entitiesDoc([
      { ref: '@k/a', kinds: ['Krok wywodu'], data: { rola: 'argument', nalezy: '@k/b', tresc: para('A leży pod B.') } },
      { ref: '@k/b', kinds: ['Krok wywodu'], data: { rola: 'argument', nalezy: '@k/a', tresc: para('B leży pod A.') } },
      { ref: '@k/c', kinds: ['Krok wywodu'], data: { rola: 'argument', nalezy: '@k/a', tresc: para('C wisi pod kołem.') } },
      { ref: '@k/r', kinds: ['Krok wywodu'], data: { rola: 'pytanie', tresc: para('Czy to drzewo?') } },
      { ref: '@k/s', kinds: ['Krok wywodu'], data: { rola: 'argument', nalezy: '@k/r', tresc: para('S leży pod pytaniem.') } }]));
    const w = cyc.warnings.find((x) => x.includes('w kole')) ?? '';
    check('a circle in the structure is named before saving, with what hangs under it; a tree with a root is not', [w.includes('A leży pod B'), w.includes('B leży pod A'), w.includes('C wisi pod kołem'), w.includes('Czy to drzewo'), w.includes('S leży')], [true, true, true, false, false]);
    const self = Js.planImport(l2, entitiesDoc([{ ref: '@k/sam', kinds: ['Krok wywodu'], data: { rola: 'argument', nalezy: '@k/sam', tresc: para('Leżę pod sobą.') } }]));
    truth('a step that lies under itself is named: a tree would start with it, a view of empty „Należy do" would hide it', self.warnings.some((x) => x.includes('na siebie') && x.includes('Leżę pod sobą')), self.warnings);
  }
  {
    /* Die Wejścia lösen jeden Wert in seinem Raum auf. */
    const an = Js.planImport(l2, entitiesDoc([], [
      { ref: '@x/w1', name: 'Na dzieło', work: '@kowalski2020', entry: '@kowalski2020', view: 'Wywód' },
      { ref: '@x/w2', name: 'Bez źródła', work: '@nieznany1999', view: '@Wywód' }]));
    const wywodView = l2.docs('view').find((v) => v.data.name === 'Wywód').id;
    check('anchors resolve each value in its own space: a library work as the entry is refused, a view by its name with „@", a work outside the sources points to Źródła',
      [an.docs[0].data.entry, an.docs[0].data.view === wywodView, an.docs[1].data.view === wywodView, an.warnings.some((w) => w.includes('to wpis biblioteki')), an.warnings.some((w) => w.includes('@nieznany1999') && w.includes('Ustawienia → Źródła'))],
      [undefined, true, true, true, true]);
  }
  {
    /* Der Export: eigene Rodzaje in den Schritten eines Widok als „@name" — in einer anderen Baza dann deren Rodzaj. */
    const exp = Js.exportCourse(lib, 'B');
    const wv = exp.views.find((v) => v.name === 'Wywód');
    const other = await freshBase();
    const op = Js.planImport(other, exp);
    const ok = op.kinds.find((k) => k.def.name === 'Krok wywodu');
    const ov = op.docs.find((d) => d.kind === 'view' && d.data.name === 'Wywód');
    check('a view goes out with „@name" for its own kinds and comes into another base with that base’s kind', [wv.steps[0].config.kind, ok.isNew, ov.data.steps[0].config.kind === ok.id], ['@wywod/krok', true, true]);
    check('… no bookkeeping in the exported data; the lasting name is the ref', [exp.views.some((v) => '_ref' in v), wv.ref], [false, '@wywod/widok']);
  }
  {
    /* Gruppen, Achsen und Spalten „#axis:" eines Widok gehen mit „@name" hinaus und kommen in einer anderen Baza bei deren Rodzaj an. */
    const src = await freshBase();
    await doImport(src, { format: 'recreatio.cogita.course', version: 1,
      kinds: [{ ref: '@t/taj', name: 'Tajemnica', fields: [{ key: 'nazwa', label: 'Nazwa', type: 'line' }, { key: 'numer', label: 'Numer', type: 'number' }] },
        { ref: '@t/kom', name: 'Komentarz tajemnicy', fields: [{ key: 'tresc', label: 'Treść', type: 'blocks' }, { key: 'taj', label: 'Tajemnica', type: 'ref', to: ['@t/taj'] }] }],
      views: [{ ref: '@t/widok', name: 'Według tajemnic', mode: 'tree', steps: [{ type: 'source.kind', config: { kind: '@t/kom' } }], group: { by: 'axis', kind: '@t/taj', via: ['taj'], sort: { field: 'numer' } }, columns: ['#axis:@t/taj'], positions: {} }] });
    const tajSrc = src.kinds.find((k) => k.name === 'Tajemnica').id;
    const ex = Js.exportCourse(src, 'S').views.find((v) => v.name === 'Według tajemnic');
    const dst = await freshBase();
    const dp = Js.planImport(dst, Js.exportCourse(src, 'S'));
    const tajDst = dp.kinds.find((k) => k.def.name === 'Tajemnica').id;
    const dv = dp.docs.find((d) => d.kind === 'view').data;
    check('a view’s axis group and „#axis:" column go out with the kind’s name and arrive at the other base’s kind',
      [ex.group.kind, ex.columns[0], tajDst !== tajSrc, dv.group.kind === tajDst, dv.columns[0] === `#axis:${tajDst}`, dp.warnings], ['@t/taj', '#axis:@t/taj', true, true, true, []]);
  }
  {
    /* Zwei Durchgänge: was ein Dokument beim Namen nennt, geht vor — eine gleichnamige Kopie davor nimmt das Original nicht. */
    const fb = await freshBase();
    await doImport(fb, schema);
    const formEntry = fb.docs('addform').find((f) => f.data.name.startsWith('Kroki pod krokiem'));
    const exported = Js.exportForms(fb, [formEntry], 'F');
    const original = exported.forms[0];
    const copy = { ...original, ref: '@kopia' };
    const twoPass = Js.planImport(fb, { ...exported, forms: [copy, original] });
    const planned = twoPass.docs.filter((d) => d.kind === 'addform');
    check('a same-named copy BEFORE the original in one document: the original keeps its form, the copy becomes a new one',
      [planned.length, planned.find((d) => !d.isNew)?.id === formEntry.id, planned.filter((d) => d.isNew).length, twoPass.warnings.some((w) => w.includes('zostanie zastąpiony'))], [2, true, 1, false]);
    const kom = JSON.parse(await readFile('../templates/cogita/komentarz.json', 'utf8'));
    await doImport(fb, kom);
    const teza = fb.docs('template').find((t) => t.data._ref === 'komentarz/t-teza');
    const { ref: _r, ...noRef } = kom.templates[0];
    const order = Js.planImport(fb, { ...kom, templates: [noRef, kom.templates[0]] });
    const tz = order.docs.filter((d) => d.kind === 'template' && d.data.name === 'Teza');
    check('a ref-less „Teza" before the named one: the named one keeps the template, the other is new — never two with one lasting name',
      [tz.find((d) => d.data._ref === 'komentarz/t-teza')?.id === teza.id, tz.filter((d) => d.data._ref === 'komentarz/t-teza').length, tz.filter((d) => d.isNew).length], [true, 1, 1]);
  }
  {
    /* Ein Zbiór „@q" neben einem Eintrag „@q": der Schritt „source.collection" meint den Zbiór. */
    const cb = await freshBase();
    await doImport(cb, schema);
    const cp = Js.planImport(cb, { format: 'recreatio.cogita.course', version: 1,
      entities: [{ ref: '@q', kinds: ['Krok wywodu'], data: { rola: 'pytanie', tresc: para('Czy?') } }],
      collections: [{ ref: '@q', name: 'Zbiór Q', list: ['@q'] }],
      views: [{ ref: '@v', name: 'Ze zbioru', mode: 'table', steps: [{ type: 'source.collection', config: { collection: '@q' } }], positions: {} }] });
    const coll = cp.docs.find((d) => d.kind === 'collection');
    const vw = cp.docs.find((d) => d.kind === 'view');
    check('a collection and an entry with one name: the collection step means the collection, the list means the entry',
      [vw.data.steps[0].config.collection === coll.id, coll.data.list[0] === cp.entities[0].id, cp.warnings], [true, true, []]);
  }
  {
    /* Wem ein Name gehört: ein anderes Dokument mit denselben Namen wird genannt, dasselbe Dokument nicht. */
    const ob = await freshBase();
    await doImport(ob, schema);
    const article = examples[0];
    await doImport(ob, article);
    const same = Js.planImport(ob, article);
    const second = Js.planImport(ob, { ...article, name: 'Druga rekonstrukcja tego artykułu' });
    check('a second document using the same names is named in the review; the same document again is not',
      [same.warnings.some((w) => w.includes('ma już wpis z dokumentu')), second.warnings.some((w) => w.includes('ma już wpis z dokumentu') && w.includes(article.name))], [false, true]);
    const st = ob.entities().find((x) => ob.entry(x.id)?.data._ref === 'kowalski2020/calosc/pytanie');
    check('… an entry remembers the document it came from', ob.entry(st.id)?.data._refDoc, article.name);
  }
  {
    /* Ein umbenannter Rodzaj: die Datei findet ihn an seinem bleibenden Namen, legt keinen leeren an und sagt, dass sie ihn umbenennt. */
    const rb = await freshBase();
    await doImport(rb, schema);
    const kr = rb.kinds.find((k) => k.name === 'Krok wywodu');
    await rb.saveKind({ ...kr, name: 'Krok argumentu', label: '{tresc} ({rola})' });
    const again = Js.planImport(rb, schema);
    const back = again.kinds.find((k) => k.id === kr.id);
    check('a renamed kind is found by its lasting name: no new kind; the rename back and the label change are said',
      [again.kinds.filter((k) => k.isNew).length, back?.isNew, again.warnings.some((w) => w.includes('zmienia nazwę')), again.warnings.some((w) => w.includes('wzór etykiety'))], [0, false, true, true]);
    const nameless = Js.planImport(rb, { format: 'recreatio.cogita.schema', version: 1, kinds: [{ ref: `@${kr.id}`, fields: [{ key: 'nr', label: 'Nr', type: 'number' }] }] });
    check('… a kind named only by its id keeps its name', nameless.kinds[0].def.name, 'Krok argumentu');
  }
  /* ══ 2026-10-25 — Teil 2: Elemente, parallele Strukturen einer Erzählung, Karten, Korrektur mit Durchsicht ══ */
  {
    const nameOf = (id) => lib.entry(id)?.data._ref ?? id;
    const last = (id) => nameOf(id).split('/').pop();
    const viewOf = (name) => VW2.readView(lib.docs('view').find((v) => v.data.name === name).data);
    check('a view keeps „order by this field" (outline.by) through JSON', VW2.viewJson(VW2.readView({ mode: 'outline', steps: [], outline: { chip: 'rola', by: 'czas', tie: 'nr' } })).outline, { chip: 'rola', by: 'czas', tie: 'nr' });

    /* Ein Ereignis in drei Strukturen. */
    const powrot = step('zielinska2019/chronologia/powrot');
    check('one event in three structures: its chapter, the chronology and the stage of the character', Wy.parentsOf(powrot.id, lib).map(nameOf).sort(),
      ['zielinska2019/budowa/cz1', 'zielinska2019/chronologia/watek', 'zielinska2019/rozwoj/etap1']);
    const chron = step('zielinska2019/chronologia/watek');
    const kidsIn = (view, root) => VW2.viewOutline(lib, VW2.viewFrom(view, root.id)).roots[0].groups.find((g) => g.structure).nodes.map((n) => last(n.id));
    check('the chronology by the time of the story: the lindens planted after the war come first, though told in chapter 5', kidsIn(viewOf('Wywód — w czasie opowieści'), chron), ['lipy', 'wakacje', 'powrot', 'listy', 'decyzja']);
    check('… the same root by place in the work: chapters 1, 1, 2, 5, 6', kidsIn(viewOf('Wywód'), chron), ['wakacje', 'powrot', 'listy', 'lipy', 'decyzja']);
    check('… the composition by place: the parts, the events in their chapters', [kidsIn(viewOf('Wywód'), step('zielinska2019/budowa/watek')), kidsIn(viewOf('Wywód'), step('zielinska2019/budowa/cz2'))], [['cz1', 'cz2'], ['lipy', 'decyzja']]);

    /* Elemente: ein Begriff über den Werken, die Elemente des Artikels unter „Ogólnie"; die Elemente des Romans. */
    const elShape = VW2.viewOutline(lib, viewOf('Elementy stałe'));
    check('the view „Elementy stałe": concepts above works and elements without one as roots', elShape.roots.map((r) => last(r.id)).sort(), ['dom', 'jozef', 'lipy', 'marta', 'milosc']);
    const milosc = elShape.roots.find((r) => last(r.id) === 'milosc');
    check('… under „Miłość" the elements of the article that refer to it', milosc.groups.filter((g) => !g.structure).map((g) => [g.label, g.nodes.map((n) => last(n.id)).sort()]), [['← Ogólnie', ['agapao', 'phileo']]]);
    check('… a step names the elements it speaks about', (step('kowalski2020/calosc/zarzut').data.elementy ?? []).map(nameOf).sort(), ['kowalski2020/el/agapao', 'kowalski2020/el/phileo']);

    /* Die Karten: streng geprüft, aus demselben Werk. */
    const made = await lib.cards('wywod-karty');
    const tpl = (name) => lib.templates().find((t) => t.name === name).id;
    const cardsOf = (name) => made.cards.filter((c) => c.template === tpl(name));
    const thesis = (id) => STM2.statementOf(lib.entry(id), lib.markupLook)?.thesis ?? '';
    const workOf = (id) => { const v = lib.entity(id).data.miejsce; const one = Array.isArray(v) ? v[0] : v; return typeof one === 'object' && one !== null ? one.value : one; };
    const sameWork = (id) => lib.entities().filter((x) => x.kinds.some((k) => k === krok.id) && workOf(x.id) === workOf(id));
    const fragOf = new Map(lib.entities().filter((x) => typeof x.data.fragment === 'string').map((x) => [x.data.fragment, x.id]));
    const pary = cardsOf('Fragmenty i tezy jednego dzieła — połącz w pary');
    const withFragment = lib.entities().filter((x) => x.kinds.includes(krok.id) && typeof x.data.fragment === 'string');
    check('matching cards: one for every step with a fragment', pary.map((c) => c.entity).sort(), withFragment.map((x) => x.id).sort());
    truth('… each pairs 2–5 fragments of ONE work with their own theses', pary.every((c) => c.answer.form === 'match' && c.answer.left.length >= 2 && c.answer.left.length <= 5
      && c.answer.pairs.every(([l, r]) => { const id = fragOf.get(c.answer.left[l]); return id !== undefined && workOf(id) === workOf(c.entity) && thesis(id) === c.answer.right[r]; })), pary.map((c) => c.answer));
    const teza = cardsOf('Do tego fragmentu — która teza?');
    check('„which thesis belongs to this fragment?": one card for every step with a fragment', teza.length, withFragment.length);
    truth('… the right thesis among up to three theses of OTHER steps of the same work', teza.every((c) => c.answer.form === 'one' && c.answer.options[c.answer.correct] === thesis(c.entity) && c.answer.options.length >= 2 && c.answer.options.length <= 4
      && c.answer.options.every((o) => sameWork(c.entity).some((x) => thesis(x.id) === o))), teza.map((c) => c.answer));
    const dzielo = cardsOf('Z którego dzieła jest ta teza?');
    const works = [W1, W2, W3].map((w) => lib.label(lib.entity(w)));
    truth('„from which work is this thesis?": the right work among the works of the base', dzielo.length > 0 && dzielo.every((c) => c.answer.form === 'one' && c.answer.options[c.answer.correct] === lib.label(lib.entity(workOf(c.entity))) && c.answer.options.every((o) => works.includes(o)) && c.answer.options.length === 3), dzielo.slice(0, 3).map((c) => c.answer));
    const element = cardsOf('Co znaczy w tym dziele…?');
    check('„what does X mean in this work?": cards for the elements of a work, never for a concept above works', element.map((c) => last(c.entity)).sort(), ['agapao', 'dom', 'jozef', 'lipy', 'marta', 'phileo']);
    const agapao = element.find((c) => last(c.entity) === 'agapao');
    check('… the wrong answers are descriptions of other elements of the same work', [...agapao.answer.options].sort(), ['W artykule agapao to miłość, która daje siebie bez warunku.', 'W artykule phileo to miłość przyjaźni, na jaką Piotra stać po zaparciu.']);
    check('… none of the four kinds is a self-assessed card', [...new Set([...pary, ...teza, ...dzielo, ...element].map((c) => c.answer.form))].sort(), ['match', 'one']);

    /* Eine Korrektur der eigenen KI (7.4): nur, was sich ändert; jede Änderung an Bestehendem einzeln annehmen und ändern. */
    const cb = await freshBase();
    await doImport(cb, schema);
    await doImport(cb, examples[0]);
    const corr = Js.planImport(cb, examples[3]);
    const changes = IR.changesOf(cb, corr);
    const arg1 = cb.byImportRef('kowalski2020/calosc/arg1', 'entity');
    const arg11 = cb.byImportRef('kowalski2020/calosc/arg1-1', 'entity');
    const which = (c) => (c.targetId === arg1.id ? 'arg1' : c.targetId === arg11.id ? 'arg1-1' : '?');
    check('a correction names only what changes: one thesis, one removed fragment, and one new comment',
      [changes.filter((c) => !c.isNew).map((c) => `${which(c)}:${c.field}`).sort(), changes.filter((c) => c.isNew).map((c) => c.target)], [['arg1-1:fragment', 'arg1:tresc'], ['entity']]);
    const planned = corr.entities.find((e) => e.id === arg1.id).data;
    check('… the step keeps everything the correction does not name (fields are completed, not replaced)', [planned.fragment, planned.miejsce?.locator, Array.isArray(planned.nalezy) ? planned.nalezy.length : typeof planned.nalezy], ['Trzykrotne pytanie Jezusa odpowiada trzykrotnemu zaparciu się Piotra.', 's. 47–49', 'string']);
    const tresc = changes.find((c) => c.field === 'tresc');
    const frag = changes.find((c) => c.field === 'fragment');
    check('… each change shows before and after; a removal says so', [tresc.beforeText, tresc.afterText, frag.afterText], [
      'Trzy pytania odpowiadają trzem zaparciom Piotra.\nAutor zestawia ognisko z J 18,18 i J 21,9 jako znak tego samego miejsca w pamięci.', 'Każde z trzech pytań Jezusa odpowiada jednemu zaparciu Piotra.', '(pole usunięte)']);
    const d0 = IR.decidedPlan(cb, corr, changes, IR.defaultDecisions(changes));
    check('… by default only the new comment is saved — a change to an existing entry needs the owner’s yes', [d0.plan.entities.length, d0.plan.entities[0].isNew, cb.kind(d0.plan.entities[0].kinds[0])?.name], [1, true, 'Komentarz']);
    check('… the proposal to edit starts from the proposed text', IR.editText(tresc), 'Każde z trzech pytań Jezusa odpowiada jednemu zaparciu Piotra.');
    const yes = { accepted: new Set([...IR.defaultDecisions(changes).accepted, tresc.id, frag.id]), edited: new Map([[tresc.id, 'Trzy pytania Jezusa leczą trzy zaparcia Piotra.\n\nAutor widzi w nich jedną drogę.']]) };
    const d1 = IR.decidedPlan(cb, corr, changes, yes);
    await Js.applyImport(cb, d1.plan, () => undefined);
    const after = cb.entity(arg1.id);
    check('… accepted and edited: the owner’s own text is saved, the fragment is gone, the rest of the step stays',
      [after.data.tresc.map((b) => b.text), 'fragment' in cb.entity(arg11.id).data, after.data.fragment, d1.invalid], [['Trzy pytania Jezusa leczą trzy zaparcia Piotra.', 'Autor widzi w nich jedną drogę.'], false, 'Trzykrotne pytanie Jezusa odpowiada trzykrotnemu zaparciu się Piotra.', []]);
    const bad = IR.decidedPlan(cb, corr, changes, { accepted: new Set([frag.id]), edited: new Map() });
    check('… nothing accepted, nothing saved; an edit that cannot be read is named and left out', [IR.decidedPlan(cb, corr, changes, { accepted: new Set(), edited: new Map() }).plan.lines, bad.invalid,
      IR.editedValue({ ...changes.find((c) => c.edit === 'json') ?? { edit: 'json' } }, '{nie json').error ?? null], [['Nic do zapisania.'], [], 'To nie jest poprawny JSON.']);

    /* Ein Begriff über den Werken gehört jedem Dokument; ein Rodzaj an seinem bleibenden Namen auch nach dem Umbenennen. */
    const other = Js.planImport(cb, { ...examples[0], name: 'Inny dokument o miłości', entities: examples[0].entities.filter((e) => e.ref === '@pojecie/milosc'), anchors: [] });
    truth('a concept above works reached from another document is not named as someone else’s entry', !other.warnings.some((w) => w.includes('ma już wpis z dokumentu')), other.warnings);
    const kr = cb.kinds.find((k) => k.name === 'Krok wywodu');
    await cb.saveKind({ ...kr, name: 'Krok' });
    const byLasting = Js.planImport(cb, entitiesDoc([{ ref: '@test/x', kinds: ['@wywod/krok'], data: { rola: 'opis', tresc: para('Opis.') } }]));
    check('a document names the kind by its lasting name („@wywod/krok"): found after the owner renamed it', [byLasting.entities[0].kinds, byLasting.warnings], [[kr.id], []]);

    /* Anhang A des Leitfadens ist die Beschreibung der App selbst. */
    const G = await import(pathToFileURL(join(process.cwd(), 'scripts/wywod-guide.mjs')).href);
    check('Appendix A of the AI guide is the app’s own description of „Dzieło z tekstem" (node scripts/wywod-guide.mjs)', G.withAppendix(guide, SI.workWithTextDescription()) === guide, true);
    truth('… and the guide tells the AI to stop after step 1 with the sentence for step 2', guide.includes('Tekst jest w Bibliotece. Zrób krok 2') && guide.includes('Do not start step 2 before the user writes this sentence.'));
  }
}

/* ══ 2026-10-25 — Wywód, Gruppe A: Stellen relativ zur Wurzel (Gliederung), ein Vergleicher, die Grenze der Struktura ══ */
{
  check('outline places relative to the root: only what lies deeper; another chapter, the same place, a range, pages stay whole', [
    Wy.relativePlace('rozdz. 3, § 4', 'rozdz. 3', 'outline'), Wy.relativePlace('t. 2, rozdz. 3', 't. 2', 'outline'), Wy.relativePlace('rozdz. 3, ak. 5', 'rozdz. 3', 'outline'),
    Wy.relativePlace('ks. II, rozdz. 4', 'ks. II', 'outline'), Wy.relativePlace('t. 2, cz. 1, rozdz. 3', 't. 2, cz. 1', 'outline'),
    Wy.relativePlace('rozdz. 12', 'rozdz. 1', 'outline'), Wy.relativePlace('rozdz. 12, § 4', 'rozdz. 1', 'outline'), Wy.relativePlace('rozdz. 3', 'rozdz. 3', 'outline'),
    Wy.relativePlace('t. 2, rozdz. 3, § 4', 'rozdz. 3', 'outline'), Wy.relativePlace('t. 1, rozdz. 3', 't. 2', 'outline'),
    Wy.relativePlace('rozdz. 3–4, § 2', 'rozdz. 3', 'outline'), Wy.relativePlace('rozdz. 3, § 4', 'rozdz. 3–4', 'outline'),
    Wy.relativePlace('rozdz. 3, s. 47', 'rozdz. 3', 'pages'), Wy.relativePlace('s. 47', 's. 45–60', 'pages')
  ], ['§ 4', 'rozdz. 3', 'ak. 5', 'rozdz. 4', 'rozdz. 3', 'rozdz. 12', 'rozdz. 12, § 4', 'rozdz. 3', 't. 2, rozdz. 3, § 4', 't. 1, rozdz. 3', 'rozdz. 3–4, § 2', 'rozdz. 3, § 4', 'rozdz. 3, s. 47', 's. 47']);
  check('… Aquinas, the Bible and numbered places as before', [
    Wy.relativePlace('I q. 2 a. 3', 'I q. 2', 'aquinas'), Wy.relativePlace('I q. 20 a. 1', 'I q. 2', 'aquinas'), Wy.relativePlace('I q. 2 a. 3 ad 2', 'I q. 2 a. 3', 'aquinas'),
    Wy.relativePlace('J 1,14', 'J 1', 'bible'), Wy.relativePlace('J 10,11', 'J 1', 'bible'), Wy.relativePlace('J 1,14', 'J 1,1', 'bible'),
    Wy.relativePlace('nr 24 § 1', 'nr 24', 'numbered'), Wy.relativePlace('nr 245', 'nr 24', 'numbered')
  ], ['a. 3', 'I, q. 20, a. 1', 'ad 2', '14', 'J 10,11', 'J 1,14', '§ 1', 'nr 245']);

  /* Ein Vergleicher für Namen und ein Textfeld für Gleichstand: Zahlen als Zahlen, polnische Buchstaben an ihrem Platz. */
  const krok = S.readKind('k-ga', { name: 'Krok', label: '{t}', fields: [{ key: 't', label: 'T', type: 'line' }, { key: 'tag', label: 'Tag', type: 'line' }] });
  const items = new Map([['a', 'Ola 10'], ['b', 'Ola 2'], ['c', 'Łódź'], ['d', 'Lodz'], ['e', 'ala'], ['f', 'Żubr'], ['g', 'zubr']].map(([id, t], i) => [id, { id, kinds: ['k-ga'], data: { t, tag: `nr ${10 - i}` } }]));
  const src = { entity: (id) => items.get(id), look: { kind: (id) => (id === 'k-ga' ? krok : undefined) } };
  const named = (tie) => Wy.orderByPlace([...items.keys()].map((id) => ({ id })), src, { tie, label: (x) => x.data.t }).map((id) => items.get(id).data.t);
  check('siblings without a place: by name (one Polish collator, numbers as numbers), or by a text field for ties', [named(''), named('tag')],
    [['ala', 'Lodz', 'Łódź', 'Ola 2', 'Ola 10', 'zubr', 'Żubr'], ['zubr', 'Żubr', 'ala', 'Lodz', 'Łódź', 'Ola 2', 'Ola 10']]);

  /* Die Grenze: 2000 je Wurzel, 10 000 für alle — die sechste Wurzel bekommt nichts mehr und sagt es (Wywód und klassisch). */
  const teza = S.readKind('k-ga-za', { name: 'Teza', label: '{t}', fields: [{ key: 't', label: 'T', type: 'line' }, { key: 'za', label: 'Argumenty za', type: 'ref', multi: true, structure: 'down' }] });
  const kids = Array.from({ length: 2100 }, (_, i) => ({ id: `ga-k${i}`, kinds: ['k-ga-za'], data: { t: `Argument ${i}` } }));
  const tops = Array.from({ length: 6 }, (_, i) => ({ id: `ga-r${i}`, kinds: ['k-ga-za'], data: { t: `Pytanie ${i + 1}`, za: kids.map((k) => k.id) } }));
  const all = new Map([...kids, ...tops].map((x) => [x.id, x]));
  const look = { kind: (id) => (id === 'k-ga-za' ? teza : undefined) };
  const sel = { entities: () => [...all.values()], material: () => [], entity: (id) => all.get(id), look, collection: () => undefined, pointing: () => new Set() };
  const vlib = { selectContext: () => sel, search: () => [], label: (x) => x.data.t, materialKinds: [], material: () => [], look };
  const source = { type: 'source.list', config: { ids: tops.map((t) => t.id).join('\n') } };
  const wy = VW2.viewOutline(vlib, VW2.readView({ mode: 'outline', steps: [source, { type: 'structure', config: { dir: 'down' } }] }));
  check('the budget: five roots of 2100 steps show 1999 and say 101 more; the sixth gets nothing and says all 2100', wy.roots.map((r) => [r.groups.filter((g) => g.structure).flatMap((g) => g.nodes).length, r.cut ?? null]),
    [[1999, 101], [1999, 101], [1999, 101], [1999, 101], [1999, 101], [0, 2100]]);
  const classic = VW2.viewOutline(vlib, VW2.readView({ mode: 'outline', steps: [source, { type: 'follow', config: { field: 'za' } }] }));
  check('… with „Idź po odwołaniu" (classic roots) the shortfall is the node’s cut too; a group with no room left is not drawn empty', classic.roots.map((r) => [r.groups.map((g) => [g.label, g.nodes.length]), r.cut ?? null]),
    [[[['Argumenty za', 1999]], 101], [[['Argumenty za', 1999]], 101], [[['Argumenty za', 1999]], 101], [[['Argumenty za', 1999]], 101], [[['Argumenty za', 1999]], 101], [[], 2100]]);

  /* „Tylko jeden poziom" mit Kommentaren: abgeschnittene Kommentare sind kein `cut` eines Schritts (das wären Schritte darunter); die Grenze sagt `capped`. */
  const kom = S.readKind('k-ga-kom', { name: 'Kom', label: '{t}', fields: [{ key: 't', label: 'T', type: 'line' }, { key: 'oczym', label: 'O czym', type: 'ref' }] });
  const comments = Array.from({ length: 2500 }, (_, i) => ({ id: `ga-c${i}`, kinds: ['k-ga-kom'], data: { t: `Uwaga ${i}`, oczym: 'ga-a' } }));
  const all2 = new Map([{ id: 'ga-root', kinds: ['k-ga-za'], data: { t: 'Pytanie', za: ['ga-a', 'ga-b'] } }, { id: 'ga-a', kinds: ['k-ga-za'], data: { t: 'Krok A' } }, { id: 'ga-b', kinds: ['k-ga-za'], data: { t: 'Krok B' } }, ...comments].map((x) => [x.id, x]));
  const look2 = { kind: (id) => (id === 'k-ga-za' ? teza : id === 'k-ga-kom' ? kom : undefined) };
  const atA = new Set(comments.map((c) => c.id));
  const sel2 = { entities: () => [...all2.values()], material: () => [], entity: (id) => all2.get(id), look: look2, collection: () => undefined, pointing: (id) => (id === 'ga-a' ? atA : new Set()) };
  const vlib2 = { selectContext: () => sel2, search: () => [], label: (x) => x.data.t, materialKinds: [], material: () => [], look: look2 };
  const oneLevel = VW2.viewOutline(vlib2, VW2.readView({ mode: 'outline', steps: [{ type: 'source.list', config: { ids: 'ga-root' } }, { type: 'structure', config: { dir: 'down', one: true } }, { type: 'follow', config: { field: 'oczym', back: true } }] }));
  const stepA = oneLevel.roots[0].groups.find((g) => g.structure).nodes.find((n) => n.id === 'ga-a');
  check('… one level with 2500 comments on a step: the cut comments are no cut of the step; the view says it is capped', [stepA.cut ?? null, oneLevel.capped], [null, true]);
}

/* ══ 2026-10-25 — Wywód, Gruppe A: die Karte der Struktura als Markup (StructureView über react-dom/server) ══ */
{
  const uiOut = join(workspace, 'structure-ui.js');
  await build({
    stdin: {
      contents: [
        "export { StructureView } from './src/app/cogita/StructureView';",
        "export { CogitaContext } from './src/app/cogita/ui';",
        "export { CogitaLibrary } from './src/app/cogita/store';",
        "export { labelOf } from './src/app/cogita/schema';",
        "export { depthOf, shownSteps, oneDeeper, oneShallower } from './src/app/cogita/outlineLevels';",
        "export { renderToStaticMarkup } from 'react-dom/server';",
        "export { createElement } from 'react';"
      ].join('\n'),
      resolveDir: process.cwd(), loader: 'ts', sourcefile: 'structure-ui.ts'
    },
    bundle: true, format: 'esm', platform: 'node', jsx: 'automatic', outfile: uiOut,
    banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
    define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }), 'process.env.NODE_ENV': '"production"' },
    loader: { '.css': 'empty', '.png': 'empty', '.svg': 'empty', '.jpg': 'empty', '.webp': 'empty', '.woff2': 'empty' },
    logLevel: 'error'
  });
  const UI = await import(pathToFileURL(uiOut).href);
  const K = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const at = (locator) => ({ value: '01a1c0de-0000-7000-8000-0000000000aa', locator });
  const E = (n, data) => ({ id: U(n), kind: 'entity', data: { _kinds: [K], ...data } });
  const entries = [
    { id: K, kind: 'kind', data: { name: 'Krok', label: '{title}', fields: [
      { key: 'title', label: 'Teza', type: 'line' }, { key: 'rola', label: 'Rola', type: 'choice', options: ['zarzut', 'odpowiedź'] },
      { key: 'miejsce', label: 'Miejsce', type: 'ref', to: ['work'], locator: true }, { key: 'nalezy', label: 'Należy do', type: 'ref', to: [K], structure: 'up' }
    ] } },
    E(1, { title: 'Czy Bóg istnieje', miejsce: at('I q. 2 a. 3') }),
    E(2, { title: 'Wydaje się, że Boga nie ma', rola: 'zarzut', miejsce: at('I q. 2 a. 3 arg. 1'), nalezy: U(1) }),
    E(3, { title: 'Istnienie Boga można wykazać', rola: 'odpowiedź', miejsce: at('I q. 2 a. 3 co.'), nalezy: U(1) }),
    E(4, { title: 'Druga teza' }), E(5, { title: 'Trzecia teza' })
  ];
  const map = new Map(entries.map((x) => [x.id, x]));
  const store = { libraryId: 'GA', areaId: 'area-ga', revision: 1, loaded: true, all: () => [...map.values()], get: (id) => map.get(id), own: (id) => map.get(id), byKey: () => undefined, ownByKey: () => undefined, subscribe: () => () => undefined };
  const lib = new UI.CogitaLibrary(store, false);
  const ctx = { lib, name: 'GA', writes: false, me: null, who: null, sources: { missing: [], loading: false }, keyIn: async () => undefined, keyOf: async () => undefined, href: (...t) => `#/x/${t.join('/')}` };
  const draw = (roots, display) => UI.renderToStaticMarkup(UI.createElement(UI.CogitaContext.Provider, { value: ctx }, UI.createElement(UI.StructureView, { roots, display, onOpen: () => undefined })));
  const article = { id: U(1), groups: [{ label: '', structure: true, nodes: [{ id: U(2), groups: [] }, { id: U(3), groups: [] }] }] };
  const text = draw([article], { chip: 'rola', tie: '', order: 'text' });
  const twists = text.match(/class="cg-wy-twist"[^>]*>/g) ?? [];
  const labels = text.match(/class="cg-wy-label"[^>]*>/g) ?? [];
  /* 2026-10-26 — der Pfeil gehört zu den Ebenen des Baumes; in der Reihenfolge des Textes gibt es keine, und das Ganze eines Schritts öffnet sein Name. */
  check('in text order no arrow (there are no levels); the name carries aria-expanded and aria-controls',
    [twists.length, labels.length, labels.every((l) => l.includes('aria-expanded="false"') && /aria-controls="wy-[^"]+"/.test(l))], [0, 2, true]);
  truth('in text order the heading of a piece is read before its first step', /<div class="cg-wy-line"><span class="cg-sr">Zarzuty — Videtur quod<\/span><span class="cg-wy-chip">/.test(text), text.slice(text.indexOf('cg-wy-line'), text.indexOf('cg-wy-line') + 200));
  const flat = (html) => html.replace(/<[^>]+>/g, '');
  const cut = flat(draw([{ id: U(4), groups: [{ label: '', structure: true, nodes: [] }], cut: 2100 }, { id: U(5), groups: [{ label: '', structure: true, nodes: [] }] }], { chip: '', tie: '' }));
  check('a root the budget left without steps says what is missing and how to see it — never „jeszcze bez kroków”; a root without steps still does',
    [cut.includes('▸ 2100 kroków niżej nie pokazano — otwórz wpis, żeby je zobaczyć'), (cut.match(/jeszcze bez kroków/g) ?? []).length], [true, 1]);
  truth('a classic root says its cut too', flat(draw([{ id: U(4), groups: [], cut: 2100 }], { chip: '', tie: '' })).includes('▸ 2100 wpisów niżej nie pokazano'));
  check('roots are keyed by their id (and the owner’s order), not by their place in the list',
    UI.StructureView({ roots: [{ id: U(5), groups: [] }, { id: U(4), groups: [] }], display: { chip: '', tie: '', order: 'tree' }, onOpen: () => undefined }).props.children[0].map((x) => x.key), [`${U(5)}:tree`, `${U(4)}:tree`]);

  /* 2026-10-26 — „Tezy skrócone | Całe tezy": eine Teza (Bausteine) steht gekürzt wie jeder Name in Listen, oder ganz — die Wahl merkt sich der Browser. */
  const K2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const question = 'Czy naprzemienność czasowników agapao i phileo w rozmowie nad jeziorem oznacza dwa różne stopnie miłości ucznia?';
  const thesis = 'Czasowniki nie oznaczają dwóch stopni miłości; ich naprzemienność wskazuje na więź miłości, którą Jezus odnawia po trzykrotnym zaparciu.';
  map.set(K2, { id: K2, kind: 'kind', data: { name: 'Krok z treścią', label: '{tresc}', fields: [
    { key: 'tresc', label: 'Treść', type: 'blocks' }, { key: 'nalezy', label: 'Należy do', type: 'ref', to: [K2], structure: 'up' }
  ] } });
  map.set(U(6), { id: U(6), kind: 'entity', data: { _kinds: [K2], tresc: [{ type: 'paragraph', text: question }] } });
  map.set(U(7), { id: U(7), kind: 'entity', data: { _kinds: [K2], tresc: [{ type: 'paragraph', text: `${thesis} Dalej uzasadnienie.` }], nalezy: U(6) } });
  store.revision = 2;
  const longRoot = [{ id: U(6), groups: [{ label: '', structure: true, nodes: [{ id: U(7), groups: [] }] }] }];
  const lengths = (html) => ({
    title: flat(html.match(/<h3 class="cg-wy-title">.*?<\/h3>/)?.[0] ?? ''),
    step: flat(html.match(/<button[^>]*class="cg-wy-label"[^>]*>[^<]*/)?.[0] ?? ''),
    picked: [...html.matchAll(/aria-pressed="true"[^>]*>([^<]*)</g)].map((m) => m[1])
  });
  const short = lengths(draw(longRoot, { chip: '', tie: '', order: 'tree' }));
  check('theses short by default: cut after 90 characters with „…”, „Tezy skrócone” pressed in the group „Długość tez”',
    [short.title, short.step, short.picked], [`${question.slice(0, 89).trimEnd()}…`, `${thesis.slice(0, 89).trimEnd()}…`, ['Wywód', 'Tezy skrócone']]);
  globalThis.window = { localStorage: { getItem: (k) => (k === 'cg-structure-theses' ? 'whole' : null), setItem: () => undefined } };
  let whole;
  try { whole = lengths(draw(longRoot, { chip: '', tie: '', order: 'tree' })); } finally { delete globalThis.window; }
  check('„Całe tezy” remembered by the browser: the question and every thesis whole (the first sentence, not the paragraph)',
    [whole.title, whole.step, whole.picked], [question, thesis, ['Wywód', 'Całe tezy']]);
  check('… the whole name is the label pattern unclipped (references inside stay short)',
    [UI.labelOf(lib.entity(U(7)), lib.look, 0, true), lib.label(lib.entity(U(7)))], [thesis, `${thesis.slice(0, 89).trimEnd()}…`]);

  /* 2026-10-26 — Ebene um Ebene: zuerst die äusseren Schritte, dann nach innen — Schritt um Schritt oder eine Ebene für alle. */
  map.set(U(8), { id: U(8), kind: 'entity', data: { _kinds: [K2], tresc: [{ type: 'paragraph', text: 'Krok w środku.' }], nalezy: U(7) } });
  map.set(U(9), { id: U(9), kind: 'entity', data: { _kinds: [K2], tresc: [{ type: 'paragraph', text: 'Najgłębszy krok.' }], nalezy: U(8) } });
  map.set(U(10), { id: U(10), kind: 'entity', data: { _kinds: [K2], tresc: [{ type: 'paragraph', text: 'Drugi krok zewnętrzny.' }], nalezy: U(6) } });
  store.revision = 3;
  const node = (n, kids = []) => ({ id: U(n), groups: kids.length === 0 ? [] : [{ label: '', structure: true, nodes: kids }] });
  const deepRoot = node(6, [node(7, [node(8, [node(9)])]), node(10)]);
  const p7 = `${U(6)}/${U(7)}/0`, p8 = `${p7}/${U(8)}/0`;
  const levelsOf = (inner) => UI.shownSteps(deepRoot, inner).map((x) => `${x.depth}:${x.kids}`);
  check('levels: the depth of a tree; at first only the outer steps, each with the number of steps inside it',
    [UI.depthOf(deepRoot), UI.depthOf(node(6, [node(7)])), UI.depthOf(node(6)), levelsOf(new Set())], [3, 1, 0, ['1:1', '1:0']]);
  const d1 = UI.oneDeeper(deepRoot, new Set()), d2 = UI.oneDeeper(deepRoot, d1);
  check('„Rozwiń poziom” opens exactly one level everywhere, until nothing is left closed',
    [[...d1], levelsOf(d1), [...d2].sort(), levelsOf(d2), UI.oneDeeper(deepRoot, d2) === d2], [[p7], ['1:1', '2:1', '1:0'], [p7, p8].sort(), ['1:1', '2:1', '3:0', '1:0'], true]);
  check('… one level even where a deeper step was left open (it stays closed); „Zwiń poziom” closes the deepest level, down to the outer steps',
    [[...UI.oneDeeper(deepRoot, new Set([p8]))], [...UI.oneShallower(deepRoot, d2)], [...UI.oneShallower(deepRoot, d1)], UI.oneShallower(deepRoot, new Set()).size], [[p7], [p7], [], 0]);
  /* Ein Schritt, der schon weiter oben steht („już wyżej"), zählt als Ebene, hat aber nichts in sich. */
  const loop = node(6, [{ id: U(7), groups: [{ label: '', structure: true, nodes: [{ id: U(6), again: true, groups: [] }] }] }]);
  const loopOpen = UI.oneDeeper(loop, new Set());
  check('… a step „już wyżej” is a level with nothing inside: depth 2, opened by „Rozwiń poziom”, closed by „Zwiń poziom”',
    [UI.depthOf(loop), UI.shownSteps(loop, loopOpen).map((x) => `${x.depth}:${x.kids}`), UI.oneShallower(loop, loopOpen).size], [2, ['1:1', '2:0'], 0]);
  const pressedIn = (html) => [...html.matchAll(/aria-pressed="true"[^>]*>([^<]*)</g)].map((m) => m[1]);
  const controlled = (html, button) => html.includes(`id="${/aria-controls="([^"]+)"/.exec(button)?.[1]}"`);
  const allLevels = draw([deepRoot], { chip: '', tie: '', order: 'tree' });
  const folds = allLevels.match(/<button[^>]*data-wy-fold=""[^>]*>/g) ?? [];
  check('all levels (the default): every step shown; „▾ n” before a step with steps inside (aria-expanded, controls its list), an empty place before the others',
    [(allLevels.match(/class="cg-wy-label"/g) ?? []).length, folds.length, folds.every((f) => f.includes('aria-expanded="true"') && f.includes('aria-label="Kroki w środku: 1"') && controlled(allLevels, f)),
      (allLevels.match(/<span class="cg-wy-twist" aria-hidden="true"><\/span>/g) ?? []).length, pressedIn(allLevels), allLevels.includes('Rozwiń wszystko'), allLevels.includes('Rozwiń poziom')],
    [4, 2, true, 2, ['Wywód', 'Tezy skrócone', 'Wszystkie poziomy'], true, false]);
  globalThis.window = { localStorage: { getItem: (k) => (k === 'cg-structure-levels' ? 'step' : null), setItem: () => undefined } };
  let stepwise;
  try { stepwise = draw([deepRoot], { chip: '', tie: '', order: 'tree' }); } finally { delete globalThis.window; }
  const fold = stepwise.match(/<button[^>]*data-wy-fold=""[^>]*>/g) ?? [];
  const levelButtons = [...stepwise.matchAll(/<button type="button" class="wk-link-btn"( disabled="")?>(Rozwiń poziom|Zwiń poziom)<\/button>/g)].map((m) => `${m[2]}${m[1] ? ' (off)' : ''}`);
  check('„Poziom po poziomie” remembered: only the outer steps, „▸ 1” closed (its list not drawn), „Rozwiń poziom”, „Zwiń poziom” off, „poziom 1 z 3”, no „Rozwiń wszystko”',
    [(stepwise.match(/class="cg-wy-label"/g) ?? []).length, fold.length, fold.every((f) => f.includes('aria-expanded="false"') && !controlled(stepwise, f)),
      levelButtons, flat(stepwise).includes('poziom 1 z 3'), stepwise.includes('Rozwiń wszystko'), pressedIn(stepwise)],
    [2, 1, true, ['Rozwiń poziom', 'Zwiń poziom (off)'], true, false, ['Wywód', 'Tezy skrócone', 'Poziom po poziomie']]);
  const textLevels = draw([deepRoot], { chip: '', tie: '', order: 'text' });
  truth('in text order no levels: no group „Poziomy”, every step listed', !textLevels.includes('aria-label="Poziomy"') && (textLevels.match(/class="cg-wy-label"/g) ?? []).length === 4);
}

/* ══ 2026-10-27 — EIN Schema der Frage (Rodzaje pytań), und die Reihenfolge des Lernens (Voraussetzungen) ══ */
{
  const QF = (key) => KD.QUESTION.fields.find((f) => f.key === key);
  /* -- Das Schema der Frage --------------------------------------------------------------------- */
  check('one question kind: its type field lists every type of question, in the table’s order',
    QF('form').options.map((o) => o.value), QTY.QUESTION_TYPES.map((t) => t.form));
  check('… each field belongs to the types that use it („when”) — the shared ones to all',
    [QF('left').when, QF('answers').when.values, QF('options').when.values, QF('value').when.values, QF('prompt').when, QF('about').when, QF('needs').when],
    [{ field: 'form', values: ['match'] }, ['text', 'number', 'date', 'gap'], ['one', 'many'], ['truefalse'], undefined, undefined, undefined]);
  check('… „Najpierw trzeba znać” is a prerequisite field of the question itself', [QF('needs').prerequisite, QF('needs').multi, QF('needs').type], ['up', true, 'ref']);
  check('… the kind describes itself without a problem (every „when” names an existing choice and its values)', S.problemsOf(KD.QUESTION, look), []);
  check('a field is shown only for its types', [S.fieldShown(QF('left'), { form: 'match' }), S.fieldShown(QF('left'), { form: 'one' }), S.fieldShown(QF('left'), {}), S.fieldShown(QF('prompt'), { form: 'one' })], [true, false, false, true]);
  const whenKind = S.readKind('k-w', { name: 'Wydarzenie', fields: [
    { key: 'typ', label: 'Typ', type: 'choice', options: ['bitwa', 'traktat'] },
    { key: 'wojska', label: 'Wojska', type: 'line', when: { field: 'typ', values: ['bitwa', 'bitwa', ''] } },
    { key: 'strony', label: 'Strony', type: 'line', when: { field: 'strony', values: ['x'] } },
    { key: 'zle', label: 'Źle', type: 'line', when: { field: 'typ', values: ['oblężenie'] } },
    { key: 'po', label: 'Po', type: 'ref', prerequisite: 'up' }, { key: 'tekst', label: 'Tekst', type: 'line', prerequisite: 'up' }
  ] });
  check('„when” is read for any own kind: values deduplicated; one pointing at itself is dropped; „prerequisite” only on a reference',
    [whenKind.fields[1].when, whenKind.fields[2].when, whenKind.fields[4].prerequisite, whenKind.fields[5].prerequisite], [{ field: 'typ', values: ['bitwa'] }, undefined, 'up', undefined]);
  check('… a value the choice does not have is a problem of the kind', S.problemsOf(whenKind, look).some((p) => p.includes('„oblężenie"')), true);
  check('… and both survive the kind document (JSON)', (({ fields }) => [fields[1].when, fields[4].prerequisite])(KD.kindDoc(whenKind)), [{ field: 'typ', values: ['bitwa'] }, 'up']);
  check('„prawda” and „fałsz” are yes and no (one row of a true/false form)', [S.readTyped({ key: 'v', type: 'bool' }, 'prawda'), S.readTyped({ key: 'v', type: 'bool' }, 'Fałsz')], [true, false]);

  check('what a question still lacks, in words — per type',
    [QTY.questionProblems({ form: 'one', prompt: 'Ile?', options: ['a', 'b'], correct: [0, 1] }).length, QTY.questionProblems({ form: 'match', prompt: 'P', left: ['a'], right: ['b'] }), QTY.questionProblems({ form: 'truefalse', prompt: 'Z' }), QTY.questionProblems({ form: 'gap', prompt: 'Litwo! [[Ojczyzno]] moja!' })],
    [1, ['Dodaj co najmniej dwie pary.'], ['Wybierz, czy zdanie jest prawdziwe.'], []]);
  check('an empty option in the middle drops out and the right one moves with it', QTY.choicesOf({ options: ['A', '', 'C'], correct: [2] }), { options: ['A', 'C'], correct: [1] });
  check('no right option chosen yet is none — not the first one (an empty value is no 0)', [QTY.choicesOf({ options: ['A', 'B'] }).correct, QTY.choicesOf({ options: ['A', 'B'], correct: '' }).correct, QTY.questionProblems({ form: 'one', prompt: 'P', options: ['A', 'B'] })], [[], [], ['Zaznacz dobrą możliwość.']]);
  check('before saving: empty rows go, a half pair stays, a question without a type is „słowami”',
    (({ form, options, correct, answers, left, right }) => [form, options, correct, answers, left, right])(QTY.tidyQuestion({ options: ['A', ' ', 'C'], correct: [2], answers: ['', 'x'], left: ['1410', '', ''], right: ['Grunwald', 'sam prawy', ''] })),
    ['text', ['A', 'C'], [1], ['x'], ['1410', ''], ['Grunwald', 'sam prawy']]);
  check('a pasted list of pairs: tab, „ – ”, „|”; a hyphen inside a word does not split; a line without a separator is left out',
    QTY.parsePairs('1410 – Bitwa pod Grunwaldem\n1569 | Unia lubelska\nUnia polsko-litewska - 1385\n1791\tKonstytucja 3 maja\nbez pary'),
    [{ left: '1410', right: 'Bitwa pod Grunwaldem' }, { left: '1569', right: 'Unia lubelska' }, { left: 'Unia polsko-litewska', right: '1385' }, { left: '1791', right: 'Konstytucja 3 maja' }]);

  /* -- Paare: eine lange Liste, je Karte nur ein paar ----------------------------------------------- */
  const elements = ['wodór', 'hel', 'lit', 'beryl', 'bor', 'węgiel', 'azot', 'tlen', 'fluor', 'neon', 'sód', 'magnez'];
  const longQ = { id: 'q-z', kinds: ['question'], data: { form: 'match', prompt: 'Połącz pierwiastek z liczbą atomową', left: elements, right: elements.map((_, i) => String(i + 1)), leftLabel: 'Pierwiastek', rightLabel: 'Z', show: 4, about: ['k-z'] } };
  const per = Cards.questionCards(longQ, 's1');
  const pairsShown = (c) => c.answer.pairs.map(([l, r]) => `${c.answer.left[l]}=${c.answer.right[r]}`);
  check('a long list (12 pairs, 4 at once): one card per pair, each showing its own pair and 3 others, all of them right pairs',
    [per.length, new Set(per.map((c) => c.key)).size, per.every((c, i) => c.answer.left.length === 4 && pairsShown(c).includes(`${elements[i]}=${i + 1}`)), per.every((c) => pairsShown(c).every((p) => { const [l, r] = p.split('='); return String(elements.indexOf(l) + 1) === r; }))],
    [12, 12, true, true]);
  check('… keyed by the question and its pair; the headings over the columns; it varies; it tests what the question is about',
    [per[0].question.startsWith('q-z:p'), per[0].answer.heads, per[0].varies, per[0].about, per[0].entity], [true, ['Pierwiastek', 'Z'], true, ['k-z'], 'q-z']);
  const again = Cards.questionCards(longQ, 's2');
  const renamed = Cards.questionCards({ ...longQ, data: { ...longQ.data, right: longQ.data.right.map((r, i) => (i === 11 ? '99' : r)) } }, 's1');
  check('… another attempt draws other companions but keeps the key and the history (fingerprint of its own pair); a changed pair starts its own card anew',
    [again.map((c) => c.key).join() === per.map((c) => c.key).join(), again[0].fingerprint === per[0].fingerprint, again.some((c, i) => pairsShown(c).join() !== pairsShown(per[i]).join()), renamed[0].fingerprint === per[0].fingerprint, renamed[11].fingerprint === per[11].fingerprint],
    [true, true, true, true, false]);
  const whole = Cards.questionCard(longQ, 's1');
  check('the question as ONE card (a flow, a page): 4 pairs drawn per attempt, history kept for the whole list', [whole.answer.left.length, whole.varies, whole.key, Cards.questionCard(longQ, 's9').fingerprint === whole.fingerprint], [4, true, 'q-z', true]);
  const short = Cards.questionCards({ id: 'q-s', kinds: ['question'], data: { form: 'match', prompt: 'P', left: ['a', 'b', 'c'], right: ['1', '2', '3'], show: 6 } }, 's');
  check('a short list (fewer pairs than „Ile par naraz”): one card with all of them', [short.length, short[0].answer.left, short[0].varies], [1, ['a', 'b', 'c'], false]);
  const gapCard = Cards.questionCard({ id: 'q-g', kinds: ['question'], data: { form: 'gap', prompt: 'Litwo! [[Ojczyzno]] moja!' } }, '');
  check('a gap written in the text: „…” is shown, the word is the answer', [gapCard.answer.shown, gapCard.answer.accepted], ['Litwo! … moja!', ['Ojczyzno']]);
  check('a question as a card carries what it is about', Cards.questionCard({ id: 'q-a', kinds: ['question'], data: { form: 'truefalse', prompt: 'Z', value: true, about: ['e1', { value: 'e2' }, 'q-a'] } }, '').about, ['e1', 'e2']);

  /* -- Die Reihenfolge des Lernens: der Graph ---------------------------------------------------------- */
  const CON = S.readKind('k-con', { name: 'Pojęcie', label: '{nazwa}', fields: [
    { key: 'nazwa', label: 'Nazwa', type: 'line' },
    { key: 'wymaga', label: 'Wymaga', type: 'ref', multi: true, to: ['k-con'], prerequisite: 'up' },
    { key: 'dalej', label: 'Prowadzi do', type: 'ref', multi: true, to: ['k-con'], prerequisite: 'down' },
    { key: 'dzial', label: 'Dział', type: 'ref', to: ['k-con'], structure: 'up' }
  ] });
  const con = (id, more = {}) => e(id, ['k-con'], { nazwa: id, ...more });
  const atomic = [con('atom'), con('jadro', { wymaga: ['atom'] }), con('elektron', { wymaga: ['atom'], dalej: ['powloka'] }), con('powloka', { dzial: 'atom' }), con('orbital', { wymaga: ['powloka'] }), con('dzial')];
  const atomLook = S.lookupOf([CON], atomic);
  const fieldDeps = PR.fieldDependencies(atomic, atomLook);
  check('the prerequisite fields give the edges: „Wymaga” (up) and „Prowadzi do” (down); a structure field gives none',
    fieldDeps.map((d) => `${d.parent}>${d.child}`).sort(), ['atom>elektron', 'atom>jadro', 'elektron>powloka', 'powloka>orbital']);
  const graph = PR.prerequisiteGraph([...fieldDeps, { parent: 'orbital', child: 'atom', kind: 'prerequisite', impact: 1 }, { parent: 'jadro', child: 'orbital', kind: 'context', impact: 1 }]);
  check('… levels from the basics: atom 0; jądro, elektron 1; powłoka 2; orbital 3 — the edge closing a circle is out and named; context edges do not order',
    [['atom', 'jadro', 'elektron', 'powloka', 'orbital'].map((id) => graph.level.get(id)), graph.circles.map((d) => `${d.parent}>${d.child}`), graph.level.has('dzial')],
    [[0, 1, 1, 2, 3], ['orbital>atom'], false]);
  check('… all that comes before and after', [[...PR.allNeeds('orbital', graph)].sort(), [...PR.allBuilds('atom', graph)].sort()], [['atom', 'elektron', 'powloka'], ['elektron', 'jadro', 'orbital', 'powloka']]);
  check('… the name of a level', [PR.levelLabel(0), PR.levelLabel(2)], ['Poziom 1 — podstawy', 'Poziom 3']);
  const known = (m) => (id) => m[id] ?? 0;
  check('unmet: what is not known yet; an entry without cards stands for what is before it; a card never waits for what it tests itself',
    [PR.unmetNeeds(['orbital'], known({ powloka: 0 }), graph, 1, () => true), PR.unmetNeeds(['orbital'], known({ elektron: 0.2 }), graph, 1, (id) => id !== 'powloka'),
      PR.unmetNeeds(['orbital'], known({ elektron: 3 }), graph, 1, (id) => id !== 'powloka'), PR.unmetNeeds(['orbital', 'powloka'], known({ elektron: 3 }), graph, 1, () => true)],
    [['powloka'], ['elektron'], [], []]);
  const card = (key, entity, about) => ({ key, question: key, entity, ...(about === undefined ? {} : { about }), requires: [] });
  const deck = [card('c-atom', 'atom'), card('c-jadro', 'jadro'), card('q-orb', 'q-orb', ['orbital']), card('c-el', 'elektron'), card('c-pow', 'powloka')];
  check('„Najpierw podstawy” pulls in the cards of what comes before (a question about orbitals brings powłoka, elektron, atom)',
    PR.withBasics([deck[2]], deck, graph).map((c) => c.key), ['q-orb', 'c-atom', 'c-el', 'c-pow']);
  check('a card stands on the level of what it tests', [PR.cardLevel(deck[2], graph), PR.cardLevel(deck[0], graph)], [3, 0]);
  check('mastery: a wrong last answer is nothing yet, a right one is known — the formula alone gives √10 after both',
    [K.masteryOf([{ at: 0, correctness: 0 }], 0), K.masteryOf([{ at: 0, correctness: 1 }], 0) >= K.KNOWN, K.knownessOf([{ at: 0, correctness: 0 }], 0) >= K.KNOWN], [0, true, true]);

  /* -- Wie gut es sitzt, auf drei Weisen (Nauka → Postępy) ------------------------------------------------------ */
  {
    const DAY = 24 * 3_600_000;
    const now = 30 * DAY;
    const mk = (key, entity) => ({ key, question: key, entity, prompt: [{ text: key }], answer: { form: 'truefalse', value: true }, explain: [], fingerprint: '', varies: false, requires: [] });
    const general = mk('c-atom', 'atom');
    const special = mk('c-orbital', 'orbital');
    const ans = (key, days, correctness, ms) => days.map((d, i) => ({ id: `${key}${i}`, key, question: key, direction: '', fingerprint: '', at: now - d * DAY, correctness, ...(ms === undefined ? {} : { ms }) }));
    const answers = new Map([['c-atom', ans('c-atom', [8], 1, 4000)], ['c-orbital', ans('c-orbital', [9, 2, 0.01], 1, 2000)]]);
    const deps = [{ parent: 'atom', child: 'orbital', kind: 'prerequisite', impact: 0.5 }];
    const at = (model) => ME.cardStats([general, special], [general, special], (c) => answers.get(c.key) ?? [], model, deps, now).map((x) => x.known);
    check('known, three ways: the atom answered right 8 days ago — „ostatnia” yes, „pamięć” no (forgotten since), „z hierarchią” yes (orbitals, built on it, are known now)',
      [at('last'), at('memory'), at('hierarchy')], [[true, true], [false, true], [true, true]]);
    const spaced = (gap) => K.stability([{ at: 0, correctness: 1 }, { at: gap * DAY, correctness: 1 }]);
    check('spacing: right today and again tomorrow holds less long than right today and again in a week', spaced(1) < spaced(7) && spaced(7) / spaced(1) > 5, true);
    const st = ME.cardStats([special], [special], (c) => answers.get(c.key) ?? [], 'memory', deps, now)[0];
    check('a question: answers, right ones, time per answer, and what is left in a week (less than now)', [st.answers, st.right, st.msAvg, st.inWeek < st.now, ME.summarize([st]).msTotal], [3, 3, 2000, true, 6000]);
    check('time in words', [ME.spanText(45_000), ME.spanText(5 * 60_000), ME.spanText(3 * 3_600_000 + 20 * 60_000), ME.holdsText(72)], ['45 s', '5 min', '3 h 20 min', '3 dni']);
  }

  /* -- Die Vorlagen als Dateien: Pytania, Podstawy, das Beispiel des Atoms --------------------------------- */
  const PT = await import(pathToFileURL(join(process.cwd(), 'scripts/pytania-template.mjs')).href);
  const pytaniaText = await readFile('../templates/cogita/pytania.json', 'utf8');
  check('templates/cogita/pytania.json is the app’s own question scheme (node scripts/pytania-template.mjs)', pytaniaText.replace(/\r\n/g, '\n') === PT.textOf(PT.templateOf({ kindDoc: KD.kindDoc, QUESTION: KD.QUESTION })), true);
  const qfake = (libraryId, entries) => {
    const map = new Map(entries.map((x) => [x.id, x]));
    let n = 0;
    const store = {
      libraryId, areaId: `a-${libraryId}`, revision: 1, loaded: true,
      all: () => [...map.values()], get: (id) => map.get(id), own: (id) => map.get(id), byKey: () => undefined, ownByKey: () => undefined,
      save: async (input) => { const entry = { ...input, id: input.id ?? `${libraryId}-${n += 1}`, libraryId, updatedAt: `2026-10-27T10:${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}Z` }; map.set(entry.id, entry); store.revision += 1; return entry; },
      saveMany: async (inputs) => { const saved = []; for (const i of inputs) saved.push(await store.save(i)); return { saved, failed: [] }; },
      remove: async (id) => { map.delete(id); store.revision += 1; },
      subscribe: () => () => undefined
    };
    return store;
  };
  const qlib = new So.CogitaLibrary(qfake('Q', []), true);
  const pq = Js.planImport(qlib, JSON.parse(pytaniaText));
  check('pytania.json imports: the built-in Pytanie (changed, not a new kind), four adding methods, one view — no warning',
    [pq.kinds.map((k) => [k.id, k.isNew]), pq.docs.filter((d) => d.kind === 'addform').length, pq.docs.filter((d) => d.kind === 'view').length, pq.warnings], [[['question', false]], 4, 1, []]);
  await Js.applyImport(qlib, pq, () => undefined);
  const formOf = (name) => AF.readAddForm('f', qlib.docs('addform').find((d) => String(d.data.name).startsWith(name)).data);
  const qctx = { look: qlib.look, pool: (k) => qlib.ofKind(k), isOwn: () => true, newId: (() => { let i = 0; return () => `nq${++i}`; })() };
  const tf = AF.planForm(formOf('Prawda czy fałsz'), qctx, [{ q: [{ prompt: 'Atom jest niepodzielny', value: 'fałsz' }] }, { q: [{ prompt: 'Elektron ma ładunek ujemny', value: 'prawda' }] }], { picks: { o: ['k-z'] }, asks: {} });
  check('… a true/false row: the sentence and „fałsz” — a question of that type', tf.saves.map((x) => [x.data.form, x.data.prompt, x.data.value]), [['truefalse', 'Atom jest niepodzielny', false], ['truefalse', 'Elektron ma ładunek ujemny', true]]);
  const one = AF.planForm(formOf('Jedna z kilku'), qctx, [{ q: [{ prompt: 'Co jest w jądrze?', options: 'protony i neutrony; elektrony; fotony' }] }], { picks: {}, asks: {} });
  const oneCard = Cards.questionCard({ id: 'x', kinds: ['question'], data: one.saves[0].data }, 's');
  check('… „one of several”: the first typed option is the right one (shuffled on the card)', oneCard.answer.options[oneCard.answer.correct], 'protony i neutrony');

  const blib = new So.CogitaLibrary(qfake('P', []), true);
  const pp = Js.planImport(blib, JSON.parse(await readFile('../templates/cogita/podstawy.json', 'utf8')));
  check('podstawy.json imports: Pojęcie with „Wymaga” (a prerequisite field), three card templates, one adding method, the view „Od podstaw” — no warning',
    [pp.kinds.map((k) => k.def.name), pp.kinds[0].def.fields.find((f) => f.key === 'wymaga').prerequisite, pp.docs.filter((d) => d.kind === 'template').length, pp.docs.filter((d) => d.kind === 'addform').length, pp.docs.filter((d) => d.kind === 'view').map((d) => d.data.group), pp.warnings],
    [['Pojęcie'], 'up', 3, 1, [{ by: 'level' }], []]);
  await Js.applyImport(blib, pp, () => undefined);
  const bform = AF.readAddForm('f', blib.docs('addform')[0].data);
  const bctx = { look: blib.look, pool: (k) => blib.ofKind(k), isOwn: () => true, newId: (() => { let i = 0; return () => `np${++i}`; })() };
  const rows = AF.planForm(bform, bctx, [
    { p: [{ nazwa: 'Atom', czym: 'najmniejsza część pierwiastka' }], w: [] },
    { p: [{ nazwa: 'Orbital', czym: 'obszar elektronu' }], w: [{ nazwa: 'Powłoka elektronowa' }, { nazwa: 'Atom' }] }
  ], { picks: {}, asks: {} });
  const byName = (name) => rows.saves.find((x) => x.data.nazwa === name);
  check('… a row without „Wymaga” still makes a basic concept („może zostać puste”); a row with two makes the missing one and reuses Atom',
    [rows.rows.map((r) => r.skipped.length), rows.saves.map((x) => x.data.nazwa).sort(), byName('Orbital').data.wymaga.map((id) => rows.saves.find((x) => x.id === id).data.nazwa)],
    [[0, 0], ['Atom', 'Orbital', 'Powłoka elektronowa'], ['Powłoka elektronowa', 'Atom']]);
  for (const x of rows.saves) await blib.saveEntity({ id: x.id, kinds: x.kinds, data: x.data });
  const bcards = (await blib.cards('s')).cards;
  const tname = (c) => blib.docs('template').find((d) => d.id === c.template)?.data.name;
  check('… its card templates: a concept with a description gets a fiszka, „which concept is it?” and pairs; one without a description gets none',
    [bcards.filter((c) => c.entity === byName('Atom').id).map(tname).sort(), bcards.filter((c) => c.entity === byName('Powłoka elektronowa').id).length, bcards.find((c) => c.entity === byName('Atom').id && c.answer.form === 'match')?.answer.left.length],
    [['Czym jest pojęcie? (fiszka)', 'Jakie to pojęcie? (wpisz nazwę)', 'Pojęcia i ich znaczenie — połącz w pary'], 0, 2]);

  /* Das Beispiel: Atom → Orbitale, als Kurs. */
  const alib = new So.CogitaLibrary(qfake('A', []), true);
  const pa = Js.planImport(alib, JSON.parse(await readFile('../templates/cogita/przyklad-atom.json', 'utf8')));
  check('przyklad-atom.json imports as a course: 11 concepts, 13 questions, a card template, a revision „od podstaw”, the view — no warning',
    [pa.entities.filter((x) => x.kinds.includes('question')).length, pa.entities.length, pa.docs.map((d) => d.kind).sort(), pa.warnings], [13, 24, ['revision', 'template', 'view'], []]);
  await Js.applyImport(alib, pa, () => undefined);
  const idOf = (ref) => alib.entities().find((x) => alib.entry(x.id)?.data._ref === ref)?.id;
  const ag = alib.prerequisites();
  check('… its order: atom first, then jądro and elektron, … konfiguracja and izotop last; a question with „needs” comes after the other',
    [['atom', 'jadro', 'elektron', 'proton', 'powloka', 'liczba-atomowa', 'orbital', 'izotop', 'konfiguracja'].map((x) => ag.level.get(idOf(`atom/${x}`))), ag.level.get(idOf('atom/q-wegiel')) > ag.level.get(idOf('atom/q-kolejnosc')), ag.circles.length],
    [[0, 1, 1, 2, 2, 3, 3, 4, 4], true, 0]);
  check('… the library’s dependencies are the fields (and the settings)', alib.dependencies().length, ag.edges.length);
  const { cards: acards } = await alib.cards('s');
  check('… cards: a fiszka per concept, every question, the long list of elements card by card (12)',
    [acards.filter((c) => c.template !== undefined).length, acards.filter((c) => c.question.startsWith(idOf('atom/q-pierwiastki'))).length, acards.length], [11, 12, 11 + 12 + 12]);
  const grouped = SEL.groupsOf(alib.selectContext(), alib.ofKind(alib.kinds.find((k) => k.name === 'Pojęcie').id).map((x) => x.id), { by: 'level' });
  check('… a view grouped by level: the levels in order, from the basics', grouped.map((g) => `${g.label}:${g.ids.length}`), ['Poziom 1 — podstawy:1', 'Poziom 2:2', 'Poziom 3:3', 'Poziom 4:3', 'Poziom 5:2']);

  /* Eine Powtórka „od podstaw": was zuerst gefragt wird, und was wartet. */
  const rev = alib.docs('revision')[0];
  const marks = new Map();
  const levelOfCard = (c) => PR.cardLevel(c, ag);
  const { plan: aplan } = await R.planOf(G.readGraph(rev.data.graph), alib.revisionContext(acards, (key) => marks.get(key) ?? [], 0));
  let session = R.start({ plan: aplan, all: acards, deps: alib.dependencies(), now: 0, seed: 'od-podstaw', marks: (key) => marks.get(key) ?? [] });
  const opening = R.heldBack(session, 0);
  check('at the start only the basics are asked: the stack holds cards about the atom; the rest waits for it',
    [session.active.map((k) => levelOfCard(acards.find((c) => c.key === k))).every((l) => l === 0), session.active.length > 0, opening.cards, opening.needs.includes(idOf('atom/atom'))],
    [true, true, aplan.cards.length - session.active.length, true]);
  const firstLevels = [];
  const asked = new Set();
  for (let step = 0, at = 1000; session.current !== null && step < 400; step += 1, at += 1000) {
    const current = acards.find((c) => c.key === session.current);
    if (!asked.has(current.key)) { asked.add(current.key); firstLevels.push(levelOfCard(current)); }
    session = R.answer(session, 1, at).session;
  }
  check('answering right, card by card: every card is asked, and new cards come from the basics to the details (levels never go back)',
    [asked.size, aplan.cards.length, firstLevels.every((l, i) => i === 0 || l >= firstLevels[i - 1]), firstLevels[0], firstLevels[firstLevels.length - 1]],
    [aplan.cards.length, acards.length, true, 0, 4]);

  /*
   * 2026-10-27 — DIESELBE POWTÓRKA OHNE NETZ (offline.ts): die Abschrift so, wie RevisionRun sie ablegt (JSON hin und
   * zurück). Vorher fiel die Sperre „Najpierw podstawy" weg, und ohne die schon gegebenen Antworten hielte sie alles zurück.
   */
  const { cards: _keptCards, ...keptConfig } = aplan;
  const copy = JSON.parse(JSON.stringify({ libraryId: 'A', revisionId: rev.id, name: 'Od podstaw', plan: keptConfig, cards: aplan.cards.filter((c) => !OFF.needsFiles(c)), deps: alib.dependencies(), target: { areaId: 'K', intake: 'AQID' }, answers: [], savedAt: 0 }));
  const src = OFF.offlineSource(copy);
  const offline = R.start({ plan: src.plan, all: src.cards, deps: src.deps, now: 0, seed: 'od-podstaw', marks: () => [] });
  check('offline: the kept copy keeps the gate „Najpierw podstawy” — the basics are asked first there too',
    [src.plan.gate, aplan.gate !== null, offline.active.length > 0 && offline.active.every((k) => levelOfCard(acards.find((c) => c.key === k)) === 0)], [aplan.gate, true, true]);
  const basics = aplan.cards.filter((c) => levelOfCard(c) === 0);
  const learner = new LRN.Learner('A', { kind: 'local', id: 'offline' }, null);
  learner.remember(basics.map((c, i) => ({ id: `kept-${i}`, key: c.key, question: c.question, direction: c.direction, fingerprint: c.fingerprint, at: 0, correctness: 1 })));
  const offKnown = R.start({ plan: src.plan, all: src.cards, deps: src.deps, now: 60_000, seed: 'od-podstaw', marks: (key) => learner.marks(key) });
  check('… with the answers the copy brought along, what is already known opens the next level instead of starting over',
    [R.heldBack(offKnown, 60_000).cards < R.heldBack(offline, 0).cards, offKnown.active.some((k) => levelOfCard(acards.find((c) => c.key === k)) === 1)], [true, true]);
  check('… cards whose question shows a file (picture, sound) are not kept: without the network they cannot open',
    [OFF.needsFiles({ prompt: [{ text: 'Która to?', media: { file: 'f', type: 'audio' } }] }), OFF.needsFiles({ prompt: [{ text: 'Czym jest atom?' }] })], [true, false]);
}

/* ══ 2026-10-27 — zwei allgemeine Schemata, je an zwei verschiedenen Fällen: Fakten mit Quellen (fakty.json) und ein Zbiór (zbior.json) ══ */
{
  const sfake = (libraryId, entries) => {
    const map = new Map(entries.map((x) => [x.id, x]));
    let n = 0;
    const byKey = (key) => [...map.values()].find((x) => (x.key ?? '').toLowerCase() === key.toLowerCase());
    const store = {
      libraryId, areaId: `a-${libraryId}`, revision: 1, loaded: true,
      all: () => [...map.values()], get: (id) => map.get(id), own: (id) => map.get(id), byKey, ownByKey: byKey,
      save: async (input) => { const entry = { ...input, id: input.id ?? `${libraryId}-${n += 1}`, libraryId, updatedAt: `2026-10-27T11:00:${String(n % 60).padStart(2, '0')}Z` }; map.set(entry.id, entry); store.revision += 1; return entry; },
      saveMany: async (inputs) => { const saved = []; for (const i of inputs) saved.push(await store.save(i)); return { saved, failed: [] }; },
      remove: async (id) => { map.delete(id); store.revision += 1; },
      subscribe: () => () => undefined
    };
    return store;
  };
  const NOVEL = '01a1c0de-0000-7000-8000-0000000000a1';
  const MISSAL = '01a1c0de-0000-7000-8000-0000000000a2';
  const SPEECH = '01a1c0de-0000-7000-8000-0000000000a3';
  const HYMNAL = '01a1c0de-0000-7000-8000-0000000000a4';
  const HYMNAL2 = '01a1c0de-0000-7000-8000-0000000000a5';
  const books = sfake('LB', [
    { id: NOVEL, kind: 'work', key: 'powiesc2005', data: { workType: 'book', genre: 'powieść biograficzna', title: 'Z Wadowic do Rzymu' } },
    { id: MISSAL, kind: 'work', key: 'mszal1986', data: { workType: 'book', genre: 'mszał', title: 'Mszał rzymski dla diecezji polskich', pageSeries: "xii 12* 1 3'" } },
    { id: SPEECH, kind: 'work', key: 'debata2023', data: { workType: 'recording', title: 'Debata wyborcza (nagranie)' } },
    { id: HYMNAL, kind: 'work', key: 'spiewnik1990', data: { workType: 'book', genre: 'śpiewnik', title: 'Śpiewnik kościelny' } },
    { id: HYMNAL2, kind: 'work', key: 'spiewnik2010', data: { workType: 'book', genre: 'śpiewnik', title: 'Exsultate' } }
  ]);
  const sources = async (lib) => lib.setSources((await Src.loadSources(lib, async (ref) => ({ LB: books }[ref.id] ?? null))).loaded);
  const baseWith = async (id) => {
    const lib = new So.CogitaLibrary(sfake(id, [{ id: `s${id}`, kind: 'settings', data: { sources: [{ id: 'LB', kind: 'books', name: 'Biblioteka' }] } }]), true);
    await sources(lib);
    return lib;
  };
  const tname = (lib) => (c) => lib.docs('template').find((d) => d.id === c.template)?.data.name;
  const rowsOf = (lib, form, rows, picks) => AF.planForm(AF.readAddForm('f', form.data), { look: lib.look, pool: (k) => lib.ofKind(k), isOwn: () => true, newId: (() => { let i = 0; return () => `n${form.id}${++i}`; })() }, rows, { picks, asks: {} });

  /* Der Leitfaden für die KI (templates/cogita/ksiazka-AI.md): allgemein, seine Anhänge sind die der App und die Dateien der Schemata. */
  const KG = await import(pathToFileURL(join(process.cwd(), 'scripts/ksiazka-guide.mjs')).href);
  const kguide = (await readFile('../templates/cogita/ksiazka-AI.md', 'utf8')).replace(/\r\n/g, '\n');
  check('the book guide for an AI carries the app’s own descriptions and the fields of every template (node scripts/ksiazka-guide.mjs)', (await KG.guideWith(kguide, await KG.appDescriptions())) === kguide, true);
  check('… a two-step guide for any book: the layers and their general schemes, the menu of choices, pages as printed in the Library',
    [['## 1. Krok pierwszy', '## 2. Krok drugi', '**A1**', '**B3**', '**B5**', '**C3**', '**D1**', '**E1**', '**F2**', 'pageSeries', '`wywod.json`', '`fakty.json`', '`zbior.json`', '`podstawy.json`', '`pytania.json`'].every((w) => kguide.includes(w)), kguide.includes('jednostki.json')],
    [true, false]);

  /* -- fakty.json: was eine Quelle über die Welt sagt, geprüft — eine Powieść über eine wirkliche Person UND eine aufgezeichnete Debatte -- */
  const flib = await baseWith('F');
  const pf = Js.planImport(flib, JSON.parse(await readFile('../templates/cogita/fakty.json', 'utf8')));
  check('fakty.json imports: Fakt and Okres, four card templates, two adding methods, five views — no warning',
    [pf.kinds.map((k) => k.def.name), pf.docs.filter((d) => d.kind === 'template').length, pf.docs.filter((d) => d.kind === 'addform').length, pf.docs.filter((d) => d.kind === 'view').length, pf.warnings],
    [['Fakt', 'Okres'], 4, 2, 5, []]);
  await Js.applyImport(flib, pf, () => undefined);
  const FAKT = flib.kinds.find((k) => k.name === 'Fakt');
  const OKRES = flib.kinds.find((k) => k.name === 'Okres');
  const fieldOf = (kind, key) => kind.fields.find((f) => f.key === key);
  check('… general: the source is any work with a place (the Library reads the place), the judgement is not about history only, the period has a time span',
    [fieldOf(FAKT, 'tresc').type, fieldOf(FAKT, 'okres').structure, fieldOf(FAKT, 'okres').prerequisite, fieldOf(FAKT, 'zrodlo').to, fieldOf(FAKT, 'zrodlo').locator, fieldOf(FAKT, 'kiedy').uncertain,
      fieldOf(FAKT, 'ocena').options.map((o) => o.value), fieldOf(OKRES, 'czas').type, fieldOf(OKRES, 'czas').rangeOf],
    ['blocks', 'up', 'up', ['work'], true, true, ['potwierdzone', 'prawdopodobne', 'sporne', 'uproszczone', 'nieprawdziwe', 'fikcja', 'nieznane'], 'range', 'date']);
  /* (1) eine Powieść über eine wirkliche Person */
  const okres = await flib.saveEntity({ kinds: [OKRES.id], data: { nazwa: 'Dzieciństwo w Wadowicach', nr: 1, czas: { segments: [{ from: '1920', to: '1938' }] }, opis: 'Rodzina, szkoła, teatr.' } });
  const ktos = await flib.saveEntity({ kinds: [OKRES.id], data: { nazwa: 'Karol Wojtyła' } });
  const f1 = await flib.saveEntity({ kinds: [FAKT.id], data: { tresc: [{ type: 'paragraph', text: 'Karol Wojtyła urodził się w Wadowicach 18 maja 1920 roku.' }], haslo: 'Narodziny Karola Wojtyły', rodzaj: 'zdarzenie', kogo: [ktos.id], kiedy: [{ value: '1920-05-18', state: 'known' }], okres: [okres.id], zrodlo: [{ value: NOVEL, locator: 's. 12' }], ocena: 'potwierdzone' } });
  const f2 = await flib.saveEntity({ kinds: [FAKT.id], data: { tresc: [{ type: 'paragraph', text: 'Mały Karol rozmawiał z ojcem o Mickiewiczu przy kominku.' }], kogo: [ktos.id], okres: [okres.id], wymaga: [f1.id], jak: 'Scena wymyślona dla oddania atmosfery domu.', ocena: 'fikcja' } });
  /* (2) dieselbe Art für eine aufgezeichnete Debatte: die Quelle ist ein Nagranie mit seiner Minute, eine Zahl wird geprüft */
  const f3 = await flib.saveEntity({ kinds: [FAKT.id], data: { tresc: [{ type: 'paragraph', text: 'Bezrobocie spadło w ostatnim roku do 3 procent.' }], haslo: 'Bezrobocie w ostatnim roku', rodzaj: 'liczba', zrodlo: [{ value: SPEECH, locator: '12:30' }], ocena: 'nieprawdziwe', uzasadnienie: 'GUS podaje 5,1%.' } });
  const fcards = (await flib.cards('s')).cards;
  const judged = fcards.find((c) => c.entity === f2.id && c.answer.form === 'one');
  const when1920 = fcards.find((c) => c.entity === f1.id && c.answer.form === 'date');
  check('… cards: from the headword what is known and when (a year), „czy to się zgadza?” among the judgements; a fact without a headword or date asks only what can be asked',
    [fcards.filter((c) => c.entity === f1.id).map(tname(flib)).sort(), when1920?.prompt.map((p) => p.text).join(''), judged?.answer.options[judged.answer.correct], judged?.answer.options.length,
      fcards.filter((c) => c.entity === f2.id).map(tname(flib)), fcards.filter((c) => c.entity === f3.id).map(tname(flib)).sort(), fcards.some((c) => c.entity === okres.id && c.answer.form === 'flash')],
    [['Czy to się zgadza? (wybór oceny)', 'Hasło → co wiadomo (fiszka)', 'Hasło → kiedy (rok)'], 'Kiedy: Narodziny Karola Wojtyły?', 'fikcja — wymyślone (powieść, film, legenda)', 4,
      ['Czy to się zgadza? (wybór oceny)'], ['Czy to się zgadza? (wybór oceny)', 'Hasło → co wiadomo (fiszka)'], true]);
  const fg = flib.prerequisites();
  check('… the order: the period first, the fact in it next, the fact that needs that fact last', [fg.level.get(okres.id), fg.level.get(f1.id), fg.level.get(f2.id)], [0, 1, 2]);
  const fforms = flib.docs('addform');
  const factForm = fforms.find((d) => d.data.name === 'Fakty ze źródła — wiersz po wierszu');
  const periodForm = fforms.find((d) => d.data.name === 'Okresy — wiersz po wierszu');
  const frows = rowsOf(flib, factForm, [{ fakt: [{ tresc: 'Karol przyjął święcenia w Krakowie.', haslo: 'Święcenia kapłańskie', kiedy: '1946-11-01', '@loc:zrodlo': 's. 88', ocena: 'potwierdzone' }] }], { zrodlo: [NOVEL] });
  const srows = rowsOf(flib, factForm, [{ fakt: [{ tresc: 'Inflacja wynosi 2 procent.', '@loc:zrodlo': '41:05', ocena: 'nieprawdziwe' }] }], { zrodlo: [SPEECH] });
  const prows = rowsOf(flib, periodForm, [{ okres: [{ nr: '2', nazwa: 'Okupacja', czas: '1939–1945', opis: 'Praca w kamieniołomie.' }] }], {});
  check('… adding row by row: the source chosen once and its place typed — a page of a book, a minute of a recording; periods with their span',
    [frows.rows[0].problems, frows.saves[0]?.data.zrodlo, frows.saves[0]?.data.ocena, srows.saves[0]?.data.zrodlo, prows.rows[0].problems, prows.saves[0]?.data.czas?.segments?.[0]?.from, prows.saves[0]?.data.czas?.segments?.[0]?.to],
    [[], [{ value: NOVEL, locator: 's. 88' }], 'potwierdzone', [{ value: SPEECH, locator: '41:05' }], [], '1939', '1945']);

  /* -- zbior.json: Positionen zum Erkennen — die Prefacje eines Missale UND die Lieder zweier Śpiewniki -- */
  const zlib = await baseWith('Z');
  const pz = Js.planImport(zlib, JSON.parse(await readFile('../templates/cogita/zbior.json', 'utf8')));
  check('zbior.json imports: Pozycja and Grupa, seven card templates, one adding method, four views — no warning, no list of liturgical kinds',
    [pz.kinds.map((k) => k.def.name), pz.docs.filter((d) => d.kind === 'template').length, pz.docs.filter((d) => d.kind === 'addform').length, pz.docs.filter((d) => d.kind === 'view').length, pz.warnings,
      JSON.stringify(pz.kinds.map((k) => k.def)).includes('kolekta')],
    [['Pozycja', 'Grupa'], 7, 1, 4, [], false]);
  await Js.applyImport(zlib, pz, () => undefined);
  const POZ = zlib.kinds.find((k) => k.name === 'Pozycja');
  const GR = zlib.kinds.find((k) => k.name === 'Grupa');
  check('… general: a place in one or more works (the Library reads it — pages of a series too), a picture or sound to recognise, what it is easily confused with',
    [fieldOf(POZ, 'miejsce').multi, fieldOf(POZ, 'miejsce').locator, fieldOf(POZ, 'obraz').type, fieldOf(POZ, 'podobne').symmetric, fieldOf(POZ, 'grupa').prerequisite],
    [true, true, 'media', true, 'up']);
  /* (1) die Prefacje eines Missale, Seiten mit Stern */
  const adwent = await zlib.saveEntity({ kinds: [GR.id], data: { nazwa: 'Prefacje adwentowe', nr: 1, opis: 'Oczekiwanie na przyjście Pana.' } });
  const pre = (nr, oznaczenie, poczatek, thesis, more = {}) => zlib.saveEntity({ kinds: [POZ.id], data: { nr, oznaczenie, poczatek, tresc: [{ type: 'paragraph', text: thesis }], grupa: adwent.id, miejsce: [{ value: MISSAL, locator: `s. ${nr}*` }], ...more } });
  const p1 = await pre(1, 'Prefacja o Adwencie I', 'On to, przyszedłszy po raz pierwszy', 'Dwa przyjścia Chrystusa.');
  const p2 = await pre(2, 'Prefacja o Adwencie II', 'Jego zapowiadali wszyscy prorocy', 'Oczekiwanie Maryi i Jana.', { podobne: [p1.id], roznica: 'Nie o dwóch przyjściach, lecz o tych, którzy na Niego czekali.' });
  await pre(3, 'Prefacja o Adwencie III', 'Ty postanowiłeś dać nam Zbawiciela', 'Chrystus Pan i Sędzia.');
  /* (2) dieselbe Art für die Lieder zweier Śpiewniki — mit Melodie */
  const maryjne = await zlib.saveEntity({ kinds: [GR.id], data: { nazwa: 'Pieśni maryjne', nr: 2, opis: 'Pieśni do Matki Bożej.' } });
  const song = await zlib.saveEntity({ kinds: [POZ.id], data: { nr: 112, oznaczenie: 'Czarna Madonna', poczatek: 'Jest zakątek na tej ziemi', tresc: [{ type: 'paragraph', text: 'Jasna Góra jako miejsce ucieczki.' }], grupa: maryjne.id,
    miejsce: [{ value: HYMNAL, locator: 's. 112' }, { value: HYMNAL2, locator: 's. 431' }], obraz: { file: 'f-melodia', type: 'audio', name: 'melodia.mp3' } } });
  await zlib.saveEntity({ kinds: [POZ.id], data: { nr: 113, oznaczenie: 'Gwiazdo śliczna', poczatek: 'Gwiazdo śliczna wspaniała', tresc: [{ type: 'paragraph', text: 'Maryja gwiazdą morza.' }], grupa: maryjne.id } });
  await zlib.saveEntity({ kinds: [POZ.id], data: { nr: 114, oznaczenie: 'Matko Najświętsza', poczatek: 'Matko Najświętsza, do Serca Twego', tresc: [{ type: 'paragraph', text: 'Zawierzenie Matce.' }], grupa: maryjne.id } });
  const zcards = (await zlib.cards('s')).cards;
  const which = zcards.find((c) => c.entity === p1.id && c.answer.form === 'one');
  const match = zcards.find((c) => c.entity === p1.id && c.answer.form === 'match');
  const heard = zcards.find((c) => c.entity === song.id && c.prompt.some((p) => p.media !== undefined));
  check('… cards of a preface: what it is about, how it begins, which one begins so (among its group), beginnings ↔ designations of its group; the difference only where it is written',
    [zcards.filter((c) => c.entity === p1.id).length, which?.answer.options[which.answer.correct], which?.answer.options.every((o) => o.startsWith('Prefacja o Adwencie')), match?.answer.left.length,
      zcards.filter((c) => c.entity === p2.id).map(tname(zlib)).includes('Czym się różni od podobnych? (fiszka)'), zcards.some((c) => c.entity === adwent.id)],
    [4, 'Prefacja o Adwencie I', true, 3, true, true]);
  check('… and of a song from two hymnals: the melody as the question, its title among the songs of its group',
    [heard?.prompt.find((p) => p.media)?.media.type, heard?.answer.options[heard.answer.correct], heard?.answer.options.every((o) => ['Czarna Madonna', 'Gwiazdo śliczna', 'Matko Najświętsza'].includes(o)), zcards.filter((c) => c.entity === song.id).length],
    ['audio', 'Czarna Madonna', true, 5]);
  const zg = zlib.prerequisites();
  check('… the group first (what Advent prefaces share), then each preface', [zg.level.get(adwent.id), zg.level.get(p1.id)], [0, 1]);
  check('… places in the Missal ordered by the series its work names (the Library: roman, star, plain, apostrophe)', ['s. 2', 's. 3*', "s. 1'", 's. iv'].sort((a, b) => Wy.comparePlaces(a, b, 'pages', { series: ['i', '#*', '#', "#'"] })), ['s. iv', 's. 3*', 's. 2', "s. 1'"]);
  const zform = zlib.docs('addform')[0];
  const zrows = rowsOf(zlib, zform, [{ pozycja: [{ nr: '4', oznaczenie: 'Prefacja o Adwencie IV', poczatek: 'Czcimy Ciebie', tresc: 'Maryja nową Ewą.', '@loc:miejsce': 's. 4*' }] }], { grupa: [adwent.id], dzielo: [MISSAL] });
  const hrows = rowsOf(zlib, zform, [{ pozycja: [{ nr: '115', oznaczenie: 'Serdeczna Matko', poczatek: 'Serdeczna Matko, opiekunko ludzi', '@loc:miejsce': 's. 115' }] }], { grupa: [maryjne.id], dzielo: [HYMNAL] });
  check('… adding row by row: group and work chosen once; number, designation, beginning, theme and place typed — a preface, a song',
    [zrows.rows[0].problems, zrows.saves[0]?.data.grupa, zrows.saves[0]?.data.miejsce, zrows.saves[0]?.data.nr, hrows.rows[0].problems, hrows.saves[0]?.data.miejsce],
    [[], adwent.id, [{ value: MISSAL, locator: 's. 4*' }], 4, [], [{ value: HYMNAL, locator: 's. 115' }]]);
}

/* ── 2026-10-28 — ANMELDEN OHNE NETZ und die Abschriften je Konto (core/away.ts, cogita/offline.ts) ──────── */
{
  const rnd = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));
  const hex = (b) => Buffer.from(b).toString('hex');
  const refused = (promise) => promise.then(() => 'opened', () => 'refused');
  const deviceKey = rnd(32);
  const accountId = '01a16af6-5a94-718f-b8b5-abdb3ab69100';
  const salt = rnd(16);
  /* Der PasswordKey zu „tajne hasło" mit diesem Salz — dieselbe Rechnung (Argon2id, 64 MiB) wie beim Anmelden. */
  const pk = await SE.unlockAway('probe-away', 'tajne hasło', salt, async (k) => k);
  const master = rnd(32);
  const masterKeySealed = CR.toBase64Url(await CR.seal(pk, CR.aad('kernel', 'account', accountId, CR.Field.AccountMasterKey, 1), master));
  const account = { accountId, loginId: 'probe-away', salt: CR.toBase64Url(salt), masterKeySealed, savedAt: 1 };
  const sealedAccount = await AW.sealAway(deviceKey, account);
  const opened = await AW.openAway(deviceKey, accountId, sealedAccount);
  check('away: what the device keeps for the login without network opens only with this device key and only as this account',
    [opened.loginId, opened.masterKeySealed === masterKeySealed, await refused(AW.openAway(rnd(32), accountId, sealedAccount)), await refused(AW.openAway(deviceKey, '01a16af6-0000-7000-8000-000000000000', sealedAccount))],
    ['probe-away', true, 'refused', 'refused']);
  const proved = await AW.proveAway(opened, 'tajne hasło');
  check('… the password is checked without the service: Argon2id with the kept salt opens the master key — a wrong one does not',
    [hex(proved) === hex(master), await refused(AW.proveAway(opened, 'złe hasło'))], [true, 'refused']);
  check('… the name is written as the service writes it (trimmed, lower case)', AW.loginName('  Probe-Away '), 'probe-away');
  const k1 = await AW.awayKeyFrom(master, accountId);
  const k2 = await AW.awayKeyFrom(master, accountId);
  const k3 = await AW.awayKeyFrom(master, '01a16af6-0000-7000-8000-000000000000');
  check('… the key of the copies follows from the master key: the same each time, another for another account, never the master key itself',
    [hex(k1) === hex(k2), hex(k1) === hex(k3), hex(k1) === hex(master)], [true, false, false]);
  const by = { accountId, key: k1 };
  const copyDoc = { libraryId: 'L', revisionId: 'R', name: 'Od podstaw', plan: {}, cards: [], deps: [], target: null, holder: { roleId: 'p1', wrapPublicKey: 'AQID' }, answers: [], savedAt: 5 };
  const sealedCopy = await OFF.sealCopy(deviceKey, by, copyDoc);
  const back = await OFF.openCopy(deviceKey, by, 'L', 'R', sealedCopy);
  check('… a copy for the time without network needs this device AND the account (its password): neither alone opens it, nor under another revision',
    [back.name, await refused(OFF.openCopy(deviceKey, { accountId, key: rnd(32) }, 'L', 'R', sealedCopy)), await refused(OFF.openCopy(rnd(32), by, 'L', 'R', sealedCopy)), await refused(OFF.openCopy(deviceKey, by, 'L', 'R2', sealedCopy))],
    ['Od podstaw', 'refused', 'refused', 'refused']);
  const holder = OFF.holderOfCopy(back);
  check('… who learns without network: the person from the copy — her public key seals, her private key is not on the device',
    [holder.kind, holder.roleId, Array.from(holder.wrapPublicKey), await refused(holder.wrapPrivate())], ['role', 'p1', [1, 2, 3], 'refused']);
  check('… what was answered without network goes into the copy only for its own cards',
    OFF.answersFor([{ key: 'q1' }], [{ id: 'a', key: 'q1' }, { id: 'b', key: 'q2' }]).map((a) => a.id), ['a']);
  const person = await CR.newWrapPair();
  const intake = await CR.newWrapPair();
  const offlineHolder = OFF.holderOfCopy({ ...back, holder: { roleId: 'p1', wrapPublicKey: CR.toBase64Url(person.publicKey) } });
  const batch = await LRN.sealBatch('L', offlineHolder, { areaId: 'A', intake: intake.publicKey },
    { v: 1, kind: 'answers', answers: [{ id: 'a1', key: 'q1', question: 'q1', direction: '', fingerprint: '', at: 1, correctness: 1 }], snapshots: [] });
  const stored = { batchId: batch.batchId, libraryId: 'L', areaId: 'A', holderRoleId: 'p1', holderSeatId: null, kind: 'answers', sealed: batch.sealed, createdAt: '' };
  const forCourse = await LRN.openForArea(intake.privateKey, { ...stored, key: batch.keyForArea });
  const forPerson = await LRN.openOwn({ ...offlineHolder, wrapPrivate: async () => person.privateKey }, { ...stored, key: batch.keyForHolder });
  check('… an answer given without network is sealed with public keys only — the course opens it with its intake key, the person with hers',
    [forCourse?.answers?.[0]?.id, forPerson?.answers?.[0]?.id], ['a1', 'a1']);
}

await rm(workspace, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
