/**
 * 2026-11-01 — DIE MAPA POSTĘPÓW (`quilt.ts`, Widok im Modus `quilt`), nachgemessen: die Stufe jedes Eintrags aus der
 * Kenntnis (nowe, uczę się, do powtórki, umiem), die Kacheln in den Gruppen des Widoku (Ideen unter Lektionen unter
 * Kapiteln), die Klasse (wie viele können einen Eintrag), je Frage die Zahlen der Klasse (Erfolg, Versuche,
 * Podpowiedzi, die häufigste falsche Antwort), „Ćwicz to" als Powtórka — und dass ein Widok seinen Modus behält.
 * Ein kleiner Kurs: zwei Kapitel, drei Lektionen, vier Ideen (eine mit Wzór im Namen), Fragen über sie.
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-lemma-quilt-'));
const names = ['quilt', 'views', 'store', 'knowing', 'knowness', 'revision', 'graph', 'measures'];
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
const [QL, VW, ST, KN, K, R, G, ME] = await Promise.all(names.map(load));

let failed = 0;
let passed = 0;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const check = (name, got, want) => {
  const ok = typeof want === 'number' && typeof got === 'number' ? near(got, want) : JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};

/* ── Ein kleiner Kurs ─────────────────────────────────────────────────────── */

const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [kChapter, kLesson, kIdea] = [901, 902, 903].map(U);
const [ch1, ch2, l1, l2, l3, i1, i2, i3, i4, q1, q2, q3, q4, q5] = [1, 2, 11, 12, 13, 21, 22, 23, 24, 31, 32, 33, 34, 35].map(U);
const map = new Map();
const store = {
  libraryId: 'K', areaId: 'area-k', revision: 1, loaded: true,
  all: () => [...map.values()], get: (id) => map.get(id), own: (id) => map.get(id), byKey: () => undefined, ownByKey: () => undefined,
  save: async (input) => { map.set(input.id, input); store.revision += 1; return input; }, subscribe: () => () => undefined
};
const E = (id, kinds, data) => map.set(id, { id, kind: 'entity', data: { _kinds: kinds, ...data } });
map.set(kChapter, { id: kChapter, kind: 'kind', data: { name: 'Rozdział', label: '{name}', fields: [{ key: 'name', label: 'Nazwa', type: 'line' }, { key: 'nr', label: 'Nr', type: 'number' }] } });
map.set(kLesson, { id: kLesson, kind: 'kind', data: { name: 'Lekcja', label: '{name}', fields: [
  { key: 'name', label: 'Nazwa', type: 'line' }, { key: 'nr', label: 'Nr', type: 'number' }, { key: 'rozdzial', label: 'Rozdział', type: 'ref', to: [kChapter] }] } });
map.set(kIdea, { id: kIdea, kind: 'kind', data: { name: 'Idea', label: '{name}', fields: [
  { key: 'name', label: 'Nazwa', type: 'markup' }, { key: 'lekcja', label: 'Lekcja', type: 'ref', to: [kLesson] }] } });
E(ch1, [kChapter], { name: 'I. Mengen', nr: 1 });
E(ch2, [kChapter], { name: 'II. Abbildungen', nr: 2 });
E(l1, [kLesson], { name: 'Lektion 1', nr: 1, rozdzial: ch1 });
E(l2, [kLesson], { name: 'Lektion 2', nr: 2, rozdzial: ch1 });
E(l3, [kLesson], { name: 'Lektion 3', nr: 3, rozdzial: ch2 });
E(i1, [kIdea], { name: 'Potęga zbioru $\\mathcal{P}(A)$', lekcja: l1 });
E(i2, [kIdea], { name: 'Suma zbiorów', lekcja: l1 });
E(i3, [kIdea], { name: 'Iloczyn kartezjański', lekcja: l2 });
E(i4, [kIdea], { name: 'Funkcja', lekcja: l3 });
E(q1, ['question'], { form: 'text', prompt: 'Ile elementów ma $\\mathcal{P}(\\{1,2,3\\})$?', answers: ['8'], about: [i1] });
E(q2, ['question'], { form: 'one', prompt: 'Co to jest $\\mathcal{P}(A)$?', options: ['zbiór podzbiorów', 'para', 'funkcja'], correct: [0], about: [i1] });
E(q3, ['question'], { form: 'text', prompt: 'Czym jest suma?', answers: ['A ∪ B'], about: [i2] });
E(q4, ['question'], { form: 'text', prompt: 'Co to jest A × B?', answers: ['pary'], about: [i3] });
E(q5, ['question'], { form: 'text', prompt: 'Co to funkcja?', answers: ['przyporządkowanie'], about: [i4] });
const lib = new ST.CogitaLibrary(store, true);
const { cards } = await lib.cards('quilt');
const cardOf = (id) => cards.find((c) => c.question === id);

/* ── Der Widok ──────────────────────────────────────────────────────────────── */

const viewDoc = {
  name: 'Mapa kursu', mode: 'quilt',
  steps: [{ type: 'source.kind', config: { kind: kIdea } }],
  group: { by: 'axis', kind: kLesson, via: ['lekcja'], sort: { field: 'nr' }, group: 'rozdzial' }
};
const view = VW.readView(viewDoc);
check('a view keeps the mode „Mapa postępów” (quilt) when read', view.mode, 'quilt');
check('… and when written (export → import keeps it)', VW.readView(VW.viewJson(view)).mode, 'quilt');
check('an unknown mode stays a table, as before', VW.readView({ mode: 'kafelki' }).mode, 'table');
check('the mode has its name', VW.LIST_MODE_LABEL.quilt, 'Mapa postępów');

/* ── Die Stufen ─────────────────────────────────────────────────────────────── */

const MIN = 60_000;
const t0 = Date.UTC(2026, 10, 1, 8, 0, 0);
/* Eine richtige Antwort: wie lange sie hält (der erste Abstand) — und eine Zeit, zu der die Idee „do powtórki" steht. */
const first = K.stateOf([{ at: t0, correctness: 1 }]);
const dueNow = t0 + Math.round(first.interval * 1.5);
const marksA = new Map([
  [cardOf(q1).key, [{ at: dueNow - 2 * MIN, correctness: 1 }]],
  [cardOf(q3).key, [{ at: dueNow - 3 * MIN, correctness: 0 }]],
  [cardOf(q4).key, [{ at: t0, correctness: 1 }]]
]);
const gaugeOf = (marks, now) => KN.gaugeFromMarks(cards, (key) => marks.get(key) ?? [], lib.dependencies(), now);
const gA = gaugeOf(marksA, dueNow);
check('the bands: right just now — umiem; wrong — uczę się; right long enough ago — do powtórki; never — nowe',
  [i1, i2, i3, i4].map((id) => QL.quiltBand(gA, id)), ['known', 'learning', 'due', 'new']);
check('… one of two questions answered is enough: the item knows from its answered cards', QL.tileOf(gA, i1).answered, 1);
check('… a tile knows how many questions test it', [i1, i2, i4].map((id) => QL.tileOf(gA, id).cards), [2, 1, 1]);
check('no answers at all: everything is new', [i1, i2, i3, i4].map((id) => QL.quiltBand(KN.EMPTY_GAUGE, id)), ['new', 'new', 'new', 'new']);
check('each band has its own mark (never colour alone)', QL.QUILT_BANDS.map((b) => QL.QUILT_MARK[b]), ['○', '◔', '◑', '●']);

/* ── Kacheln in Gruppen ────────────────────────────────────────────────────────── */

const list = VW.viewList(lib, view);
const groups = VW.viewGroups(lib, view, list);
const quilt = QL.quiltGroups(list.map((e) => e.id), groups, gA);
check('tiles grouped like the view: lessons in their order, under their chapters',
  quilt.map((g) => [g.head?.label ?? null, g.label, g.tiles.map((t) => lib.label(lib.entity(t.id)))]),
  [['I. Mengen', 'Lektion 1', ['Potęga zbioru P(A)', 'Suma zbiorów']], ['I. Mengen', 'Lektion 2', ['Iloczyn kartezjański']], ['II. Abbildungen', 'Lektion 3', ['Funkcja']]]);
check('without a grouping: one group with every entry', QL.quiltGroups(list.map((e) => e.id), null, gA).map((g) => [g.label, g.tiles.length]), [['', 4]]);
check('the count of each band', QL.bandCounts(QL.distinctTiles(quilt)), { new: 1, learning: 1, due: 1, known: 1 });
const twice = QL.quiltGroups([i1], [{ key: 'a', label: 'A', ids: [i1] }, { key: 'b', label: 'B', ids: [i1, i2] }, { key: 'c', label: 'C', ids: [i2] }], gA);
check('an entry in two groups stands in each; a group without entries of the view is left out; the sum counts it once',
  [twice.map((g) => g.key), QL.distinctTiles(twice).length], [['a', 'b'], 1]);

/* ── Wzory in Namen ───────────────────────────────────────────────────────────── */

check('the label with its formula for TexText; the plain label stays one line without LaTeX',
  [lib.labelTex(lib.entity(i1)), lib.label(lib.entity(i1))], ['Potęga zbioru $\\mathcal{P}(A)$', 'Potęga zbioru P(A)']);
check('a group named by an entry is named with its formulas', VW.groupTitle(lib, { key: i1, label: 'x' }), 'Potęga zbioru $\\mathcal{P}(A)$');
check('… a group named by a text keeps its text', VW.groupTitle(lib, { key: '', label: 'bez wartości' }), 'bez wartości');
check('a cell with formulas, for TexText — and without, for sorting', [VW.cellText(lib, lib.entity(i1), 'name', true), VW.cellText(lib, lib.entity(i1), 'name')], ['Potęga zbioru $\\mathcal{P}(A)$', 'Potęga zbioru P(A)']);

/* ── Die Klasse ─────────────────────────────────────────────────────────────────── */

const marksB = new Map([[cardOf(q1).key, [{ at: dueNow - MIN, correctness: 0 }]], [cardOf(q3).key, [{ at: dueNow - MIN, correctness: 1 }]]]);
const gB = gaugeOf(marksB, dueNow);
const cls = QL.classTiles(list.map((e) => e.id), [gA, gB]);
check('the class: how many know each entry, how many answered',
  [i1, i2, i3, i4].map((id) => { const t = cls.get(id); return [t.known, t.answered, t.learners]; }), [[1, 2, 2], [1, 2, 2], [0, 1, 2], [0, 0, 2]]);
check('… and where each learner stands', cls.get(i1).bands, { new: 0, learning: 1, due: 0, known: 1 });
check('the steps of the class ramp: nobody answered — 0, then quarters of the share', [i1, i3, i4].map((id) => QL.classStep(cls.get(id))), [3, 1, 0]);
check('… every learner knows it — the darkest step', QL.classStep({ answered: 3, share: 1 }), 4);

/* ── Je Frage: wo die Klasse scheitert ─────────────────────────────────────────────── */

const ans = (key, at, correctness, more = {}) => ({ id: `${key}:${at}`, key, question: key, direction: '', fingerprint: '', at, correctness, ...more });
const k1 = cardOf(q1).key;
const k3 = cardOf(q3).key;
const answersA = new Map([[k1, [ans(k1, 1, 0, { given: '6' }), ans(k1, 2, 0, { given: '6 ' }), ans(k1, 3, 0.75, { given: '8', hints: 1 })]], [k3, [ans(k3, 1, 1, { given: 'A ∪ B' })]]]);
const answersB = new Map([[k1, [ans(k1, 5, 0, { given: '9' }), ans(k1, 6, 1, { given: '8' })]]]);
const learners = [{ answers: (c) => answersA.get(c.key) ?? [] }, { answers: (c) => answersB.get(c.key) ?? [] }];
const words = (_card, given) => (given ?? '').trim();
const stats = QL.questionClassStats(cards, learners, words);
const s1 = stats.find((s) => s.card.key === k1);
check('per question: learners, answers, right (a right answer with a hint does not count), success',
  [s1.learners, s1.answers, s1.right, s1.success], [2, 5, 1, 0.2]);
check('… right at the first try, attempts per learner, hints (total and in how many answers)', [s1.firstRight, s1.attempts, s1.hints, s1.hinted], [0, 2.5, 1, 1]);
check('… the most frequent wrong answer, in words (spaces and case do not split it)', s1.wrong, { text: '6', count: 2 });
check('only questions somebody answered', stats.map((s) => s.card.question).sort(), [q1, q3].sort());
check('a right answer pressed down only by hints is not a wrong one', [QL.isWrongAnswer({ correctness: 0.25, hints: 3 }), QL.isWrongAnswer({ correctness: 0.25 }), QL.isWrongAnswer({ correctness: 0.5 })], [false, true, false]);
const sorted = (by, dir) => QL.sortQuestions(stats, by, dir).map((s) => s.card.question);
check('sorted by success: where the class fails first; reversed: the best first', [sorted('success', 1), sorted('success', -1)], [[q1, q3], [q3, q1]]);
check('… by hints and by attempts: the most first', [sorted('hints', 1)[0], sorted('attempts', 1)[0]], [q1, q1]);

/* ── „Ćwicz to" ─────────────────────────────────────────────────────────────── */

const ctx = lib.revisionContext(cards, (key) => marksA.get(key) ?? [], dueNow);
check('the entries of a tile to practise: the entry and every question about it (O czym)', QL.practiseIds(cards, i1).sort(), [i1, q1, q2].sort());
const practise = (await R.planOf(G.readGraph(QL.practiseGraph(QL.practiseIds(cards, i1))), ctx)).plan;
check('„Ćwicz to”: the questions about the entry — not the others', practise.cards.map((c) => c.question).sort(), [q1, q2].sort());
check('… in the order of learning, the next one strictly, and it ends when everything is known', [practise.mode, practise.order, practise.pick, practise.ahead], ['temporal', 'general', 'next', false]);
const known = (await R.planOf(G.readGraph(QL.practiseGraph(QL.practiseIds(cards, i1), false)), ctx)).plan;
check('… an entry already known: the run does not end by itself (there is something to practise)', known.ahead, true);
check('an entry without questions gives no cards', (await R.planOf(G.readGraph(QL.practiseGraph(QL.practiseIds(cards, l1))), ctx)).plan.cards.length, 0);

/* ── Antworten je Karte (für die Karte einer Person) ───────────────────────────── */

const progress = { answers: new Map([['a', ans(k1, 10, 1)], ['b', ans(k1, 5, 0)], ['c', ans(k3, 7, 1, { hints: 2 })]]), snapshots: new Map(), suspended: new Set(), positions: new Map(), values: {} };
const byCard = ME.answerIndex(progress);
check('answers by card, oldest first — the hints travel with them', [byCard(cardOf(q1)).map((a) => a.at), byCard(cardOf(q3)).map((a) => a.hints)], [[5, 10], [2]]);

await rm(workspace, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
