/**
 * 2026-11-01 — WAS COGITA FÜR KURSE NACH LEMMA BRAUCHT, nachgemessen (COGITA.md §5 „Lessons in the style of Lemma").
 *
 * Wzory in Etiketten und Karten, Podpowiedzi, das Wyjaśnienie und ein Satz je Möglichkeit, Bauen aus Kacheln, mehrere
 * Lücken (auch zum Wählen), Fragen mit Parametern, Beispiele einer Frage in Code — reine Rechnung, ohne Browser.
 * Alte Fragen müssen sich verhalten wie vorher: dieselben Karten, dieselben Fingerabdrücke.
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-lemma-'));
const cogita = ['schema', 'cards', 'check', 'cardBasics', 'questionTypes', 'questionParams', 'learn', 'kinds'];
const others = { libraryMarkup: 'src/app/library/libraryMarkup.ts', tex: 'src/app/core/tex.ts' };
await build({
  entryPoints: Object.fromEntries([...cogita.map((n) => [n, `src/app/cogita/${n}.ts`]), ...Object.entries(others)]),
  bundle: true,
  format: 'esm',
  platform: 'node',
  outdir: workspace,
  logLevel: 'error',
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [S, Cards, C, B, QT, QP, L, K] = await Promise.all(cogita.map(load));
const [LM, TX] = await Promise.all(Object.keys(others).map(load));

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); } else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};
const truth = (name, ok, detail) => {
  if (ok) { passed += 1; console.log(`ok   ${name}`); } else { failed += 1; console.error(`FAIL ${name}${detail === undefined ? '' : `\n  ${JSON.stringify(detail)}`}`); }
};
const q = (id, data) => ({ id, kinds: ['question'], data });

/* ── 2.1 Wzory: Text ohne Zeichen, Etiketten ─────────────────────────────────────────────────────────── */

check('plainText keeps a formula as $…$ (keep) and linearizes it by default',
  [LM.plainText('Wie viele Elemente hat $\\mathcal{P}(\\{1,2,3\\})$?', true, 'keep'), LM.plainText('Ist $x^2 \\ge 0$?')],
  ['Wie viele Elemente hat $\\mathcal{P}(\\{1,2,3\\})$?', 'Ist x² ≥ 0?']);
check('inline mode makes display formulas inline; a dollar in text is escaped', LM.plainText('Kosztuje 5\\$. Wzór: $$\\int_0^1 x\\,dx$$', true, 'inline'), 'Kosztuje 5\\$. Wzór: $\\int_0^1 x\\,dx$');
check('plainOf with tex keeps math, without it nothing changes', [S.plainOf('**Satz** $a\\in A$', 'inline'), S.plainOf('**Satz** dla wszystkich')], ['Satz $a\\in A$', 'Satz dla wszystkich']);
const IDEA = S.readKind('k-idea', { name: 'Idee', label: '{title} ({no})', fields: [{ key: 'title', label: 'Titel', type: 'markup' }, { key: 'no', label: 'Nr', type: 'line' }, { key: 'range', label: 'Bereich', type: 'markup' }] });
const ideaLook = { kind: (id) => (id === 'k-idea' ? IDEA : K.baseKind(id)), entity: () => undefined };
const idea = { id: 'i1', kinds: ['k-idea'], data: { title: 'Die Potenzmenge $\\mathcal{P}(M)$', no: '2.7' } };
check('a label keeps its formula with tex, and is a plain line without', [S.labelOf(idea, ideaLook, 0, false, true), S.labelOf(idea, ideaLook)], ['Die Potenzmenge $\\mathcal{P}(M)$ (2.7)', 'Die Potenzmenge P(M) (2.7)']);
const minus = { id: 'i2', kinds: ['k-idea'], data: { title: 'Intervall $x \\in [0, -1]$ - leer', no: '' } };
check('tidying a label never touches a formula (the minus stays)', S.labelOf(minus, ideaLook, 0, false, true), 'Intervall $x \\in [0, -1]$ - leer');

/* ── Die eingebaute Pytanie kennt die neuen Felder ─────────────────────────────────────────────────── */

const fieldOf = (key) => K.QUESTION.fields.find((f) => f.key === key);
check('the question kind lists the new keys with their types',
  ['hints', 'explanation', 'feedback', 'extra', 'preview', 'alternatives', 'join', 'choices', 'tests', 'params', 'let', 'require'].map((k) => `${k}:${fieldOf(k)?.type}`),
  ['hints:list', 'explanation:markup', 'feedback:list', 'extra:list', 'preview:choice', 'alternatives:json', 'join:json', 'choices:json', 'tests:json', 'params:json', 'let:json', 'require:list']);
check('the form „build” is a question type with its fields', QT.questionType('build').fields, ['items', 'extra', 'alternatives', 'preview', 'join']);
const qLook = { kind: (id) => K.baseKind(id), entity: () => undefined };
check('a json field is one value, never „outside the schema”', [S.valuesOf(q('j', { alternatives: [['a', 'b'], ['c']] }), fieldOf('alternatives')).length, S.outsideOf(q('j', { form: 'build', alternatives: [['a'], ['b']], join: ' ', params: [] }), qLook).length], [1, 0]);

/* ── Alte Fragen: dieselbe Karte, derselbe Fingerabdruck ──────────────────────────────────────────── */

const oldOne = q('q-old', { form: 'one', prompt: 'Co jest w jądrze atomu?', options: ['Elektrony', 'Protony i neutrony', 'Tylko neutrony'], correct: [1] });
const oldCard = Cards.questionCard(oldOne, 's1');
check('an old choice question: plain prompt, no hints/explanation/feedback/params', [oldCard.prompt, oldCard.hints, oldCard.explanation, oldCard.feedback, oldCard.params, oldCard.varies],
  [[{ text: 'Co jest w jądrze atomu?' }], undefined, undefined, undefined, undefined, false]);
check('its fingerprint is the one of its expected answer, as before', oldCard.fingerprint, B.hashOf(B.stable({ f: 'one', c: 'Protony i neutrony' })));
const oldGaps = q('q-gaps', { form: 'gap', prompt: 'Litwo! [[Ojczyzno]] moja! ty jesteś jak [[zdrowie]].' });
const gapCard = Cards.questionCard(oldGaps, 's');
check('several gaps without choices: the fingerprint is the old one (history stays)', gapCard.fingerprint,
  B.hashOf(B.stable({ f: 'gap', a: ['ojczyzno zdrowie'], s: S.plainOf('Litwo! … moja! ty jesteś jak ….') })));
check('…but each gap is now its own field', [gapCard.answer.gaps.map((g) => g.accepted[0]), gapCard.answer.pieces], [['Ojczyzno', 'zdrowie'], ['Litwo! ', ' moja! ty jesteś jak ', '.']]);
check('a single gap stays one field as before', Cards.questionCard(q('q-g1', { form: 'gap', prompt: 'Litwo! [[Ojczyzno]] moja!' }), 's').answer.gaps, undefined);

/* ── 2.1 Wzory in Karten; getippt wird nie LaTeX ──────────────────────────────────────────────────── */

const potenz = q('q-p', { form: 'one', prompt: 'Wie viele Elemente hat $\\mathcal{P}(\\{1,2,3\\})$?', options: ['$3$', '$6$', '$8$', '$9$'], correct: [2] });
const pc = Cards.questionCard(potenz, 'x');
check('a prompt with a formula keeps it ($…$) for KaTeX', pc.prompt[0].text, 'Wie viele Elemente hat $\\mathcal{P}(\\{1,2,3\\})$?');
check('options keep their formulas and the right one is $8$', pc.answer.options[pc.answer.correct], '$8$');
check('a typed answer never needs LaTeX: x², x^2 and $x^2$ all count', ['x²', 'x^2', '$x^2$', 'x3'].map((g) => Cards.checkCard({ ...pc, answer: { form: 'text', accepted: ['$x^2$'], rule: C.TEXT_RULE } }, g).correct), [true, true, true, false]);

const typed = Cards.checkCard({ ...pc, answer: { form: 'text', accepted: ['$x^2$'], rule: C.TEXT_RULE } }, 'x^2');
check('…and the verdict shows the answer as written (with its formula), compared with the line without LaTeX', [typed.expected, typed.shown], ['x^2', '$x^2$']);

/* ── 2.2 Podpowiedzi, 2.3 Wyjaśnienie und ein Satz je Möglichkeit ─────────────────────────────────── */

const fb = q('q-fb', { form: 'one', prompt: 'Wie viele Elemente hat $\\mathcal{P}(\\{1,2,3\\})$?', options: ['$3$', '', '$6$', '$8$'], correct: [3],
  feedback: ['Nur die Einermengen.', 'leer', '', 'Ja: $2^3 = 8$.'], hints: ['Zähle die Teilmengen.', '', 'Jedes Element ist drin oder nicht.'], explanation: 'Eine Menge mit $n$ Elementen hat $2^n$ Teilmengen [@skript, s. 12].' });
const fc = Cards.questionCard(fb, 'seed-a');
check('hints: non-empty, in order', fc.hints, ['Zähle die Teilmengen.', 'Jedes Element ist drin oder nicht.']);
check('the explanation travels with the card', fc.explanation, 'Eine Menge mit $n$ Elementen hat $2^n$ Teilmengen [@skript, s. 12].');
check('feedback follows its option through the shuffle (the empty option drops with its sentence)',
  fc.answer.options.map((o, i) => [o, fc.feedback[i]]).sort(), [['$3$', 'Nur die Einermengen.'], ['$6$', ''], ['$8$', 'Ja: $2^3 = 8$.']].sort());
check('tidying keeps feedback aligned with the remaining options', QT.tidyQuestion({ form: 'one', options: ['A', '', 'C'], correct: [2], feedback: ['a', 'x', 'c'] }), { form: 'one', options: ['A', 'C'], correct: [1], feedback: ['a', 'c'] });
const right = Cards.checkCard(fc, fc.answer.correct);
check('one hint caps a right answer at 0.75, two at 0.5 — it stays right, and says how many', [C.withHints(right, 1), C.withHints(right, 2).correctness, C.withHints(right, 0)],
  [{ correct: true, correctness: 0.75, answered: true, hints: 1 }, 0.5, right]);
check('a hint never raises a partial answer', C.withHints({ correct: false, correctness: 0.4, answered: true }, 1).correctness, 0.4);

/* ── 2.4 Bauen aus Kacheln ─────────────────────────────────────────────────────────────────────────── */

const neg = q('q-neg', { form: 'build', prompt: 'Bilden Sie die Negation von $\\forall a\\in A: P(a)$.', items: ['$\\exists a\\in A$', '$:$', '$\\neg P(a)$'], extra: ['$\\forall a\\in A$', '$P(a)$'], preview: 'math', join: ' ' });
const bc = Cards.questionCard(neg, 's');
check('a build card carries tiles, extras, preview and join', [bc.answer.form, bc.answer.items.length, bc.answer.extra.length, bc.answer.preview, bc.answer.join, bc.answer.alternatives], ['build', 3, 2, 'math', ' ', []]);
check('the right sequence is right', Cards.checkCard(bc, ['$\\exists a\\in A$', '$:$', '$\\neg P(a)$']).correct, true);
const half = Cards.checkCard(bc, ['$\\exists a\\in A$', '$:$', '$P(a)$']);
check('a wrong last tile: partial (2 of 3 from the start), marks per position', [half.correct, Math.round(half.correctness * 100) / 100, half.marks], [false, 0.67, [true, true, false]]);
const swapped = Cards.checkCard(bc, ['$:$', '$\\exists a\\in A$', '$\\neg P(a)$']);
truth('partial credit is at least as generous as ordering (a swap is not zero)', swapped.correctness >= C.checkOrder(bc.answer.items, ['$:$', '$\\exists a\\in A$', '$\\neg P(a)$']).correctness && swapped.correctness > 0, swapped);
const alt = Cards.questionCard(q('q-eq', { form: 'build', prompt: 'Gleichung', items: ['$A$', '$=$', '$B$'], alternatives: [['$B$', '$=$', '$A$']] }), 's');
check('another accepted sequence (alternatives) is right too, and an alternative may come as text lines', [Cards.checkCard(alt, ['$B$', '$=$', '$A$']).correct, Cards.readAlternatives('a | b\nc')], [true, [['a', 'b'], ['c']]]);
check('the closest right sequence is the solution shown', Cards.checkCard(alt, ['$B$', '$=$', '$B$']).solution, ['$B$', '$=$', '$A$']);
check('nothing built is no answer', Cards.checkCard(bc, []).answered, false);
check('build is in the problems list when tiles are missing', QT.questionProblems({ form: 'build', prompt: 'x', items: [] }), ['Dodaj kafelki dobrej odpowiedzi, w dobrej kolejności.']);
check('an order question with preview keeps its old fingerprint', [Cards.questionCard(q('q-o', { form: 'order', prompt: 'p', items: ['a', 'b', 'c'], extra: ['x'], preview: 'math' }), 's').fingerprint, Cards.questionCard(q('q-o', { form: 'order', prompt: 'p', items: ['a', 'b', 'c'] }), 's').fingerprint].reduce((a, b) => a === b), true);

/* ── 2.5 Lücken zum Wählen ─────────────────────────────────────────────────────────────────────────── */

const proof = q('q-proof', { form: 'gap', prompt: 'Nach [[Satz 2.1]] ist $f$ stetig, also folgt mit [[Lemma 3.4]] die Behauptung; es gilt $x = [[2]]$-fach … und [[endlich]].', choices: [['Satz 3.1', 'Lemma 2.1'], ['Satz 2.1'], [], []] });
const pr = Cards.questionCard(proof, 's');
check('gaps with choices: a list per gap, typed where none', pr.answer.gaps.map((g) => g.choices ?? null), [['Satz 3.1', 'Lemma 2.1'], ['Satz 2.1'], null, null]);
const gapsRight = Cards.checkCard(pr, ['Satz 2.1', 'Lemma 3.4', '2', 'endlich']);
const gapsHalf = Cards.checkCard(pr, ['Satz 2.1', 'Satz 2.1', '2', 'Endlich']);
check('several gaps score separately (share of right gaps)', [gapsRight.correct, gapsRight.correctness, gapsHalf.correct, gapsHalf.correctness, gapsHalf.marks], [true, 1, false, 0.75, [true, false, true, true]]);
check('choices change the fingerprint (and only then)', pr.fingerprint === Cards.questionCard(q('q-proof', { ...proof.data, choices: undefined }), 's').fingerprint, false);
check('more choice lists than gaps is named', QT.questionProblems({ form: 'gap', prompt: 'a [[b]] c', choices: [['x'], ['y']] }).length, 1);

/* ── 2.7 Parameter ─────────────────────────────────────────────────────────────────────────────────── */

const rest = q('q-rest', { form: 'number', prompt: 'Bestimmen Sie $r$ mit $0\\le r<{n}$ und ${a} = q\\cdot {n} + r$.', params: [{ name: 'a', random: [20, 99] }, { name: 'n', random: [3, 9] }], let: [{ name: 'r', value: 'mod(a, n)' }], answers: ['{r}'] });
const draws = ['s1', 's2', 's3', 's4', 's5'].map((s) => Cards.questionCard(rest, s));
truth('every draw: a and n in range, r = a mod n, the answer is r', draws.every((c) => {
  const { a, n, r } = c.params;
  return a >= 20 && a <= 99 && n >= 3 && n <= 9 && r === a % n && Cards.checkCard(c, String(r)).correct && !Cards.checkCard(c, String(r + 1)).correct;
}), draws.map((c) => c.params));
truth('the prompt carries the numbers, inside the formula too', draws.every((c) => c.prompt[0].text === `Bestimmen Sie $r$ mit $0\\le r<${c.params.n}$ und $${c.params.a} = q\\cdot ${c.params.n} + r$.`), draws[0].prompt);
check('one card key and fingerprint for every draw — the history stays', [new Set(draws.map((c) => c.key)).size, new Set(draws.map((c) => c.fingerprint)).size, draws[0].varies], [1, 1, true]);
truth('draws differ between seeds', new Set(draws.map((c) => JSON.stringify(c.params))).size > 1);
const redrawn = Cards.redrawCard(draws[0], rest, 'other');
check('a redraw keeps key and fingerprint', [redrawn.key === draws[0].key, redrawn.fingerprint === draws[0].fingerprint], [true, true]);
const spec = QP.readParamsSpec({ params: '[{"name": "a", "random": [1, 50]}, {"name": "b", "random": [1, 50]}]', require: ['a > b', 'mod(a, b) == 0'] });
truth('require holds after redrawing (JSON text accepted)', [0, 1, 2, 3, 4].every((i) => { const v = QP.drawParams(spec, B.rngOf(`r${i}`)).values; return v.a > v.b && v.a % v.b === 0; }));
check('LaTeX groups are not placeholders; only names of params are', QP.fillParams('$\\mathbb{N}$, $x^{2}$, $\\{a\\}$, $\\frac{ a }{2}$, {a}, {fmt(a/3, 2)}, {b}', { a: 7 }), '$\\mathbb{N}$, $x^{2}$, $\\{a\\}$, $\\frac{ a }{2}$, 7, 2,33, {b}');
check('a decimal is written with a comma, in a formula as {,}; minus is plain', [QP.numberText(3.5), QP.numberText(-0.25, true), QP.fillParams('$x={x}$', { x: -1.5 })], ['3,5', '-0{,}25', '$x=-1{,}5$']);
check('values from a list, and params in options, hints and feedback', (() => {
  const c = Cards.questionCard(q('q-f', { form: 'one', prompt: 'Ableitung von $\\{f}(x)$?', params: [{ name: 'f', values: ['sin'] }, { name: 'k', random: [2, 2] }], options: ['$\\cos(x)$', '$-\\sin(x)$'], correct: [0], hints: ['Denke an {k}π.'], feedback: ['ja', 'nein {k}'] }), 's');
  return [c.params, c.hints, c.feedback.slice().sort()];
})(), [{ f: 'sin', k: 2 }, ['Denke an 2π.'], ['ja', 'nein 2']]);
check('a broken let or require is named for the editor', QP.paramsProblems(QP.readParamsSpec({ params: [{ name: 'a', random: [1, 3] }], let: [{ name: 'r', value: 'mod(a, zz)' }], require: ['a >'] })).length, 2);

/* ── 2.6 Beispiele einer Frage in Code ─────────────────────────────────────────────────────────────── */

check('code examples come as a list or as JSON text', [Cards.readCodeTests([{ input: [3, 1], output: [1, 3], note: 'rosnąco' }]), Cards.readCodeTests('[{"input": 2, "output": 4}]'), Cards.readCodeTests('nope')],
  [[{ input: [3, 1], output: [1, 3], note: 'rosnąco' }], [{ input: 2, output: 4 }], []]);
const code = Cards.questionCard(q('q-code', { form: 'code', prompt: 'Sortuj', tests: [{ input: [2, 1], output: [1, 2] }] }), 's');
check('a code question with only examples is complete and keeps them', [code.answer.tests.length, QT.questionProblems({ form: 'code', prompt: 'x', tests: [{ input: 1, output: 1 }] })], [1, []]);
check('an old code question keeps its fingerprint (no tests key)', Cards.questionCard(q('q-c', { form: 'code', prompt: 'p', reference: 'def reference(x): return x', createInput: 'def create_input(s): return s' }), 's').fingerprint,
  B.hashOf(B.stable({ f: 'code', r: 'def reference(x): return x', c: 'def create_input(s): return s', n: 5 })));

/* ── Die Antwort trägt Podpowiedzi und gezogene Werte ──────────────────────────────────────────────── */

const absorbed = L.absorb(L.EMPTY_PROGRESS, { kind: 'answers', answers: [{ id: 'a1', key: 'q-rest', question: 'q-rest', direction: '', fingerprint: 'f', at: 1, correctness: 0.75, hints: 1, params: { a: 37, n: 5, r: 2, bad: Number.NaN, 'no-name': 1 } }] });
check('a stored answer keeps hints and the drawn params (only finite numbers and short texts)', [absorbed.answers.get('a1').hints, absorbed.answers.get('a1').params], [1, { a: 37, n: 5, r: 2 }]);

/* ── Export → Import: jeder neue Schlüssel bleibt ──────────────────────────────────────────────────── */

{
  const outMore = join(workspace, 'more');
  await build({
    entryPoints: { store: 'src/app/cogita/store.ts', json: 'src/app/cogita/json.ts' },
    bundle: true, format: 'esm', platform: 'node', outdir: outMore, logLevel: 'error', loader: { '.css': 'empty' },
    define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
  });
  const [So, Js] = await Promise.all(['store', 'json'].map((n) => import(pathToFileURL(join(outMore, `${n}.js`)).href)));
  const fake = (libraryId, entries) => {
    const map = new Map(entries.map((x) => [x.id, x]));
    const byKey = (key) => [...map.values()].find((x) => (x.key ?? '').toLowerCase() === key.toLowerCase());
    let n = 0;
    const store = {
      libraryId, areaId: `a-${libraryId}`, revision: 1, loaded: true,
      all: () => [...map.values()], get: (id) => map.get(id), own: (id) => map.get(id), byKey, ownByKey: byKey,
      save: async (input) => { const entry = { ...input, id: input.id ?? `${libraryId}-neu-${n += 1}`, libraryId }; map.set(entry.id, entry); store.revision += 1; return entry; },
      saveAll: async (inputs) => { const saved = []; for (const i of inputs) saved.push(await store.save(i)); return saved; },
      refreshAiNow: async () => null,
      saveMany: async (inputs) => { const saved = []; for (const i of inputs) saved.push(await store.save(i)); return { saved, failed: [] }; },
      remove: async (id) => { map.delete(id); store.revision += 1; },
      subscribe: () => () => undefined
    };
    return store;
  };
  const data = {
    form: 'build', prompt: 'Bilden Sie die Negation von $\\forall a\\in A: P(a)$.', items: ['$\\exists a\\in A$', '$:$', '$\\neg P(a)$'], extra: ['$P(a)$'], alternatives: [['$\\neg\\forall a\\in A$', '$:$', '$P(a)$']],
    preview: 'math', join: ' ', hints: ['Tausche den Quantor.'], explanation: 'Die Negation tauscht $\\forall$ gegen $\\exists$ [@skript, s. 12].', feedback: ['', 'x'], choices: [['a'], []],
    tests: [{ input: [2, 1], output: [1, 2], note: 'n' }], params: [{ name: 'a', random: [2, 9] }], let: [{ name: 'b', value: 'a*2' }], require: ['a > 2']
  };
  const graph = { nodes: [{ id: 's', type: 'source.all', x: 0, y: 0, config: {} }, { id: 'p', type: 'strategy', x: 200, y: 0, config: { mode: 'temporal', endWhenDone: true, pick: 'next', order: 'general' } }], edges: [{ id: 'e', from: 's', out: 'cards', to: 'p', in: 'cards' }] };
  const lib = new So.CogitaLibrary(fake('K', [
    { id: 'q-all', kind: 'entity', data: { _kinds: ['question'], _ref: 'kurs/q-all', ...data } },
    { id: 'r-1', kind: 'revision', data: { _ref: 'kurs/l1', name: 'Lektion 1', next: 'r-2', graph } },
    { id: 'r-2', kind: 'revision', data: { _ref: 'kurs/l2', name: 'Lektion 2', graph } }
  ]), true);
  const exported = Js.exportCourse(lib, 'Kurs');
  const qOut = exported.entities.find((x) => x.ref === '@kurs/q-all');
  check('export: the question carries every new key unchanged', qOut?.data, data);
  check('export: the lesson names its next lesson by its lasting name', exported.revisions.find((r) => r.ref === '@kurs/l1')?.next, '@kurs/l2');
  const fresh = new So.CogitaLibrary(fake('F', []), true);
  const plan = Js.planImport(fresh, JSON.parse(JSON.stringify(exported)));
  const qIn = plan.entities.find((x) => x.ref === 'kurs/q-all' || x.data?.prompt === data.prompt);
  const { _ref: _r, ...qData } = qIn?.data ?? {};
  check('import into another base: the question’s data are the same', qData, data);
  const l1 = plan.docs.find((d) => d.data?.name === 'Lektion 1');
  const l2 = plan.docs.find((d) => d.data?.name === 'Lektion 2');
  check('import: „next” points at the new id of the next lesson', [typeof l1?.data?.next, l1?.data?.next === l2?.id], ['string', true]);
}

/* ── pytania.json ist die App ──────────────────────────────────────────────────────────────────────── */

const PT = await import(pathToFileURL(join(process.cwd(), 'scripts/pytania-template.mjs')).href);
const want = PT.textOf(PT.templateOf(await PT.loadApp()));
check('templates/cogita/pytania.json is generated from the question kind (node scripts/pytania-template.mjs)', (await readFile(PT.FILE, 'utf8')).replace(/\r\n/g, '\n') === want, true);

await rm(workspace, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
