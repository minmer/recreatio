/**
 * 2026-11-06 — EIN SECHSECK, ZWEI WEGE INNEN, EIN GEMEINSAMER GIPFEL (`cogita/mountain.ts`), ohne Datenbank: ein Ablauf mit
 * `unit`, eine Wahl („choice") zwischen zwei Abschnitten (`subflow`, enden mit „Powrót"), gemeinsame Fragen, ein gemeinsamer
 * Przegląd und ein Ende. Jeder Weg allein erreicht denselben Gipfel; ungültige Formen werden beim Namen gewarnt.
 * 2026-11-10 — Gabelungen (7.): eine Wahl, deren Zweige sich nie wieder treffen (eigene Türme, eigene Enden) — ihre Fragen zählen
 * für ihren Zweig, ein Zweig genügt, ein Przegląd am Ende eines Zweiges ist richtig; eine Wahl, die sich wieder trifft, wie bisher.
 * Ziele (8.): ein Ziel nur in einem Zweig zählt nur für ihn (der letzte Lauf sagt, welcher); „Powtórz przegląd" im eigenen Zweig.
 *
 *   node scripts/app-mountain-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('en');
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-mountain-'));
const entries = {
  flow: 'src/app/cogita/flow.ts', running: 'src/app/cogita/runningStory.ts', mountain: 'src/app/cogita/mountain.ts',
  facts: 'src/app/cogita/flowFacts.ts', review: 'src/app/cogita/reviewRound.ts', check: 'src/app/cogita/flowCheck.ts', path: 'src/app/cogita/storyPath.ts'
};
await build({
  entryPoints: entries, bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' },
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [FL, RS, MT, FF, RV, FC, SP] = await Promise.all(Object.keys(entries).map(load));

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};

/* -- Die Bausteine ----------------------------------------------------------------------------------------------------- */
const node = (id, type, config = {}) => ({ id, type, x: 0, y: 0, config });
let edgeNo = 0;
const edge = (from, out, to) => ({ id: `e${(edgeNo += 1)}`, from, out, to, in: 'in' });
const flowOf = (id, data) => FL.readFlow(id, { start: data.graph.nodes[0].id, ...data });
const asked = (id, to) => [edge(id, 'right', to), edge(id, 'wrong', to)];

/*
  Das Sechseck „Prawa Newtona" (unit U): Wstęp → Wybór (Krótko | Opowieść) → Abschnitt → Punkt kontrolny (Q1, Q2) → Przegląd → Koniec.
  Die Fragen: Q1 über T1 (erklärt von F1 oder N1), Q2 über T2 (erklärt von F2 oder N3).
*/
const spine = (seg1 = 'F', seg2 = 'N', extra = {}) => flowOf('M', {
  name: 'Prawa Newtona', unit: 'U', ...extra,
  graph: {
    nodes: [
      node('intro', 'show', { of: 'U' }),
      node('wybor', 'choice', { options: [{ label: 'Krótko i rzeczowo' }, { label: 'Opowieść Halleya' }] }),
      node('segF', 'subflow', { flow: seg1 }), node('segN', 'subflow', { flow: seg2 }),
      node('q1', 'question', { of: 'Q1' }), node('q2', 'question', { of: 'Q2' }),
      node('przeglad', 'review', { of: 'story', threshold: 1 }), node('koniec', 'end')
    ],
    edges: [
      edge('intro', 'next', 'wybor'), edge('wybor', 'o0', 'segF'), edge('wybor', 'o1', 'segN'),
      edge('segF', 'next', 'q1'), edge('segN', 'next', 'q1'), ...asked('q1', 'q2'), ...asked('q2', 'przeglad'),
      edge('przeglad', 'passed', 'koniec'), edge('przeglad', 'notyet', 'koniec')
    ]
  }
});
const segment = (id, name, slides, last = 'return', more = {}) => flowOf(id, {
  name, ...more,
  graph: {
    nodes: [...slides.map((s, i) => node(`${id}${i}`, 'show', { of: s })), node(`${id}-out`, last)],
    edges: slides.map((_, i) => edge(`${id}${i}`, 'next', i + 1 < slides.length ? `${id}${i + 1}` : `${id}-out`))
  }
});
const F = segment('F', 'Krótko i rzeczowo', ['F1', 'F2']);
const N = segment('N', 'Opowieść Halleya', ['N1', 'N2', 'N3']);
const QUESTIONS = { Q1: { about: ['T1'], explain: ['F1', 'N1'] }, Q2: { about: ['T2'], explain: ['F2', 'N3'] } };
const names = { U: 'Prawa Newtona', Q1: 'Pierwsza zasada', Q2: 'Druga zasada', T1: 'Bezwładność', T2: 'Siła' };
const ctxFor = (flows, questions = QUESTIONS) => ({
  flow: (ref) => flows[ref.replace(/^@/, '')], entity: (ref) => (ref === '' ? null : ref.replace(/^@/, '')),
  question: (id) => questions[id] ?? null, label: (id) => names[id] ?? id
});
const M = spine();
const ALL = { M, F, N };
const flows = (id) => (FLOWS?.cur ?? ALL)[id];
const playCtx = (values = {}) => ({
  facts: (s) => ({ values: { ...values, ...s.values }, knowness: () => 0, answered: () => null, visited: new Set(s.visited), now: new Date(0), flow: () => undefined }),
  flows, members: () => []
});

const FLOWS = { cur: ALL };
/** Den Lauf vom Anfang bis zum Ende spielen: an der Wahl `pick`, jede Frage richtig, den Przegląd bestanden. */
function play(pick) {
  const ctx = playCtx();
  let run = RS.startRun(M, {}, ctx);
  const trail = [];
  const finished = [];
  for (let guard = 0; guard < 60 && !run.state.ended; guard += 1) {
    const f = flows(run.state.flow);
    const n = f.graph.nodes.find((x) => x.id === run.state.step);
    trail.push(`${run.state.flow}:${run.state.step}`);
    const exit = n.type === 'choice' ? pick : n.type === 'question' ? 'right' : n.type === 'review' ? 'passed' : 'next';
    const step = RS.stepRun(run, flows, exit, ctx);
    finished.push(...step.finished.map((x) => x.flow));
    run = step.run;
  }
  return { run, trail, finished };
}

/* -- 1. Beide Wege erreichen denselben Gipfel ------------------------------------------------------------------------ */
const viaF = play('o0');
const viaN = play('o1');
check('route „Krótko": through its own segment, back at the shared checkpoint, review, end', viaF.trail,
  ['M:intro', 'M:wybor', 'M:segF', 'F:F0', 'F:F1', 'M:q1', 'M:q2', 'M:przeglad']);
check('route „Opowieść": through the other segment, the same shared part', viaN.trail,
  ['M:intro', 'M:wybor', 'M:segN', 'N:N0', 'N:N1', 'N:N2', 'M:q1', 'M:q2', 'M:przeglad']);
check('both end in the parent flow, nothing left on the stack', [viaF.run.state.ended, viaF.run.state.flow, viaF.run.state.stack.length, viaN.run.state.ended, viaN.run.state.flow, viaN.run.state.stack.length],
  [true, 'M', 0, true, 'M', 0]);
check('each route finishes only its own segment (the other is not needed)', [viaF.finished, viaN.finished], [['F'], ['N']]);
check('the parent visits the same shared steps on both routes', ['q1', 'q2', 'przeglad', 'koniec'].map((s) => [viaF.run.state.visited.includes(s), viaN.run.state.visited.includes(s)]),
  [[true, true], [true, true], [true, true], [true, true]]);
/* Der Gipfel: das Ziel des Przeglądu (sein Wert) und „zu Ende". */
const goalsOf = (r) => FL.goalsReached(M, { values: r.run.state.values, knowness: () => 0, answered: () => null, visited: new Set(r.run.state.visited), now: new Date(0), flow: () => undefined });
const factsF = { started: true, done: true, goals: goalsOf(viaF) };
const factsN = { started: true, done: true, goals: goalsOf(viaN) };
check('the shared review is the one goal of the hexagon', M.goals.map((g) => g.id), ['przeglad']);
check('both routes reach it: stage „passed" and completed', [FF.storyStage(M, factsF), FF.storyCompleted(M, factsF), FF.storyStage(M, factsN), FF.storyCompleted(M, factsN)],
  ['passed', true, 'passed', true]);

/* -- 2. Gekonnt ≠ zu Ende gegangen (rückwärts verträglich) ------------------------------------------------------------- */
check('all questions known, never walked: still „passed" (the tile sinks, as before) — but not completed', [FF.storyStage(M, undefined, true), FF.storyCompleted(M, undefined)], ['passed', false]);
check('walked to the end without the review: „review", not completed', [FF.storyStage(M, { started: true, done: true, goals: [] }), FF.storyCompleted(M, { started: true, done: true, goals: [] })], ['review', false]);
check('a story without goals: done = completed (as before)', [FF.storyStage({ goals: [] }, { started: true, done: true, goals: [] }), FF.storyCompleted({ goals: [] }, { started: true, done: true, goals: [] })], ['passed', true]);

/* -- 3. Pflichtfragen: dieselben auf jedem Weg ------------------------------------------------------------------------- */
const cardOf = (id) => ({ key: `${id}:`, question: id, about: QUESTIONS[id]?.about ?? [] });
check('mandatory questions of the hexagon: the shared checkpoint', [...MT.mandatoryQuestionSteps(M)], ['q1', 'q2']);
check('the review asks the same cards whatever the route', RV.reviewCards(M, { of: 'story' }, cardOf, flows).map((c) => c.question), ['Q1', 'Q2']);
/* Eine Frage nur auf einem Weg: sie zählt weder für „alles gekonnt" noch für den Przegląd. */
const branchQ = flowOf('B', {
  name: 'Z pytaniem na drodze', unit: 'U',
  graph: {
    nodes: [node('w', 'choice', { options: ['A', 'B'] }), node('qa', 'question', { of: 'QA' }), node('sb', 'show', { of: 'N1' }), node('q1', 'question', { of: 'Q1' }), node('r', 'review', { of: 'story' }), node('e', 'end')],
    edges: [edge('w', 'o0', 'qa'), ...asked('qa', 'q1'), edge('w', 'o1', 'sb'), edge('sb', 'next', 'q1'), ...asked('q1', 'r'), edge('r', 'passed', 'e'), edge('r', 'notyet', 'e')]
  }
});
check('a question on one route only is not mandatory', [...MT.mandatoryQuestionSteps(branchQ)], ['q1']);
check('… „all known" ignores it (the shared one known is enough)', FF.flowQuestionsKnown(branchQ, (id) => ({ key: id }), (k) => k === 'Q1'), true);
check('… the review does not ask it', RV.reviewCards(branchQ, { of: 'story' }, (id) => ({ key: id, question: id }), () => undefined).map((c) => c.question), ['Q1']);
/* Rückwärts verträglich: ohne Wahl zählen alle Fragen, auch hinter einer Antwort-Gabel. */
const plain = flowOf('P', {
  name: 'Bez wyboru',
  graph: {
    nodes: [node('a', 'question', { of: 'QA' }), node('b', 'question', { of: 'QB' }), node('e', 'end')],
    edges: [edge('a', 'right', 'e'), edge('a', 'wrong', 'b'), ...asked('b', 'e')]
  }
});
check('without a choice: every question counts (unchanged)', [[...MT.mandatoryQuestionSteps(plain)], FF.flowQuestionsKnown(plain, (id) => ({ key: id }), (k) => k === 'QA')], [['a', 'b'], false]);
check('selfcheck shape still works (graph without edges or start)', FF.flowQuestionsKnown({ graph: { nodes: [{ id: 'q', type: 'question', config: { of: 'X' } }] } }, (id) => ({ key: id }), () => true), true);

/* -- 4. Die gültige Form: keine Warnung ------------------------------------------------------------------------------- */
check('the valid hexagon: no mountain warning', MT.mountainProblems(M, ctxFor(ALL)).map((p) => p.text), []);
check('… and the path checks of each flow are clean', [FC.flowProblems(M).map((p) => p.text), FC.flowProblems(F).map((p) => p.text), FC.flowProblems(N).map((p) => p.text)], [[], [], []]);
check('two routes, each named by its choice', MT.routesOf(M).routes.map((r) => r.picks), [{ wybor: 'o0' }, { wybor: 'o1' }]);
check('a flow without unit is no hexagon (no mountain warnings)', MT.mountainProblems({ ...M, unit: undefined }, ctxFor(ALL)), []);

/* -- 5. Ungültige Formen ----------------------------------------------------------------------------------------------- */
const texts = (flow, all, q) => MT.mountainProblems(flow, ctxFor(all, q)).map((p) => p.text);
const has = (list, part) => list.some((x) => x.includes(part));
const withUnit = { M, F: segment('F', 'Krótko i rzeczowo', ['F1', 'F2'], 'return', { unit: 'F1' }), N };
check('a segment with its own unit: warned by name', has(texts(M, withUnit), '“Krótko i rzeczowo” has its own “unit”'), true);
const withEnd = { M, F, N: segment('N', 'Opowieść Halleya', ['N1', 'N2', 'N3'], 'end') };
check('a segment ending with „End": warned (use Return)', has(texts(M, withEnd), '“Opowieść Halleya” contains “End”'), true);
FLOWS.cur = withEnd;
const endRun = play('o1');
FLOWS.cur = ALL;
check('… measured: the player still returns from it to the checkpoint (End inside a called flow acts like Return here)', [endRun.run.state.ended, endRun.run.state.flow, endRun.trail.slice(-3)], [true, 'M', ['M:q1', 'M:q2', 'M:przeglad']]);
const missing = { M: spine('F', 'Brak'), F, N };
check('a segment that does not exist: warned', has(texts(missing.M, missing), 'The segment “Brak” does not exist'), true);
check('a question on one route only: warned', has(texts(branchQ, { B: branchQ }, { Q1: { about: ['N1'], explain: [] }, QA: { about: ['T1'], explain: [] } }), 'lies on only some paths'), true);
const segQ = { M, F: flowOf('F', { name: 'Krótko i rzeczowo', graph: { nodes: [node('f0', 'show', { of: 'F1' }), node('f1', 'show', { of: 'F2' }), node('fq', 'question', { of: 'Q1' }), node('fr', 'return')], edges: [edge('f0', 'next', 'f1'), edge('f1', 'next', 'fq'), ...asked('fq', 'fr')] } }), N };
check('a question inside a segment: practice only, warned', has(texts(M, segQ), 'asks 1 question'), true);
const noQ = flowOf('E', {
  name: 'Bez sprawdzenia', unit: 'U',
  graph: { nodes: [node('w', 'choice', { options: ['A', 'B'] }), node('a', 'subflow', { flow: 'F' }), node('b', 'subflow', { flow: 'N' }), node('r', 'review', { of: 'story' }), node('e', 'end')],
    edges: [edge('w', 'o0', 'a'), edge('w', 'o1', 'b'), edge('a', 'next', 'r'), edge('b', 'next', 'r'), edge('r', 'passed', 'e'), edge('r', 'notyet', 'e')] }
});
check('a review without required questions: warned', has(texts(noQ, { E: noQ, F, N }), 'This review has no required questions'), true);
const reviewOnBranch = flowOf('R', {
  name: 'Przegląd na drodze', unit: 'U',
  graph: { nodes: [node('w', 'choice', { options: ['A', 'B'] }), node('a', 'subflow', { flow: 'F' }), node('r', 'review', { of: 'story' }), node('b', 'subflow', { flow: 'N' }), node('q', 'question', { of: 'Q1' }), node('e', 'end')],
    edges: [edge('w', 'o0', 'a'), edge('a', 'next', 'r'), edge('r', 'passed', 'q'), edge('r', 'notyet', 'q'), edge('w', 'o1', 'b'), edge('b', 'next', 'q'), ...asked('q', 'e')] }
});
check('a review on one route only: warned', has(texts(reviewOnBranch, { R: reviewOnBranch, F, N }), 'This review lies on only some paths'), true);
const thinN = { M, F, N: segment('N', 'Opowieść Halleya', ['N1', 'N2']) };
check('coverage: the story route does not prepare „Druga zasada" — warned by route and question', texts(M, thinN).filter((x) => x.includes('does not prepare')),
  ['The path “Opowieść Halleya” does not prepare the question “Druga zasada”: it shows neither its topic nor one of its explaining slides.']);
check('coverage counts the topic itself too (about), not only explaining slides', texts(M, thinN, { ...QUESTIONS, Q2: { about: ['N2'], explain: ['F2'] } }).filter((x) => x.includes('does not prepare')), []);
check('a question without about/explain: cannot be checked, said once', texts(M, ALL, { Q1: QUESTIONS.Q1, Q2: { about: [], explain: [] } }).filter((x) => x.includes('cannot be checked')).length, 1);
check('a required question that does not exist: warned', has(texts(M, ALL, { Q1: QUESTIONS.Q1 }), 'does not prepare') || has(MT.mountainProblems(M, { ...ctxFor(ALL), entity: (r) => (r === 'Q2' ? null : r) }).map((p) => p.text), 'The question “Q2” does not exist'), true);
const deadEnd = flowOf('D', {
  name: 'Ślepa droga', unit: 'U',
  graph: { nodes: [node('w', 'choice', { options: ['A', 'B'] }), node('a', 'subflow', { flow: 'F' }), node('b', 'show', { of: 'N1' }), node('q', 'question', { of: 'Q1' }), node('e', 'end')],
    edges: [edge('w', 'o0', 'a'), edge('w', 'o1', 'b'), edge('a', 'next', 'q'), ...asked('q', 'e')] }
});
check('a route that never reaches an end: warned by name (and the path check names the dead end)', [has(texts(deadEnd, { D: deadEnd, F, N }), 'The path “B” never reaches an end'), FC.flowProblems(deadEnd).some((p) => p.step === 'b')], [true, true]);
const unwired = flowOf('W', {
  name: 'Niepodłączona możliwość', unit: 'U',
  graph: { nodes: [node('w', 'choice', { options: ['A', 'B'] }), node('a', 'subflow', { flow: 'F' }), node('b', 'subflow', { flow: 'N' }), node('q', 'question', { of: 'Q1' }), node('e', 'end')],
    edges: [edge('w', 'o0', 'a'), edge('a', 'next', 'q'), edge('b', 'next', 'q'), ...asked('q', 'e')] }
});
check('an unreachable branch (option not wired): the path check names the unreachable segment', FC.flowProblems(unwired).some((p) => p.step === 'b'), true);

/* -- 6. Zählen: ein Abschnitt ist ein Teil der Ścieżka, die Fragen des Gipfels sind die des Ablaufs ---------------------- */
const sp = SP.storyPath(M, SP.stepWorkOf((n) => (typeof n.config.of === 'string' ? [n.config.of] : [])), (id) => names[id] ?? id);
check('the path of the hexagon: one fork with two branches that meet again', sp.parts.filter((p) => p.fork !== undefined).map((p) => p.fork.branches.length), [2]);
const before = SP.storyMarks(sp, { visited: ['intro'], step: 'wybor' });
const during = SP.storyMarks(sp, { visited: ['intro', 'wybor', 'segF', 'q1'], step: 'q2' });
const atEnd = SP.storyMarks(sp, { visited: ['intro', 'wybor', 'segF', 'q1', 'q2', 'przeglad', 'koniec'], step: 'koniec', ended: true });
check('progress: before the choice both roads count; once one is taken the other no longer counts — the same total as at the end',
  [before.total - during.total, during.total === atEnd.total, atEnd.done === atEnd.total], [1, true, true]);

/* -- 7. Gabelungen (2026-11-10): Zweige zu eigenen Türmen, jeder mit eigenem Ende --------------------------------------- */
/*
  „Dwie wieże" (unit U): Ścieżka → Wybór (hold) → Wieża A (Folie, QA1, QA2, Przegląd, Koniec A) | Wieża B (Folie, QB1, Koniec B).
  Die Möglichkeiten treffen sich nie wieder — eine Gabelung: jeder Zweig hat eigene Pflichtfragen, einer genügt.
*/
const FORK_Q = { Q0: { about: ['U'], explain: [] }, QA1: { about: ['TA'], explain: ['FA', 'FA2'] }, QA2: { about: ['TA'], explain: ['FA'] }, QB1: { about: ['TB'], explain: ['FB'] }, QK: { about: ['FA'], explain: [] } };
const towers = ({ shared = false, loop = false, reviewB = false } = {}) => flowOf('G', {
  name: 'Dwie wieże', unit: 'U',
  graph: {
    nodes: [
      node('path', 'show', { of: 'U' }), ...(shared ? [node('q0', 'question', { of: 'Q0' })] : []),
      node('fork', 'choice', { hold: true, options: [{ label: 'Wieża A' }, { label: 'Wieża B' }] }),
      node('a1', 'show', { of: 'FA' }), node('qa1', 'question', { of: 'QA1' }), node('qa2', 'question', { of: 'QA2' }),
      node('ra', 'review', { of: 'story', threshold: 1 }), ...(loop ? [node('again', 'choice', { options: ['Spróbuj jeszcze raz', 'Zakończ'] })] : []), node('ea', 'end'),
      node('b1', 'show', { of: 'FB' }), node('qb1', 'question', { of: 'QB1' }), ...(reviewB ? [node('rb', 'review', { of: 'story', threshold: 1 })] : []), node('eb', 'end')
    ],
    edges: [
      ...(shared ? [edge('path', 'next', 'q0'), ...asked('q0', 'fork')] : [edge('path', 'next', 'fork')]),
      edge('fork', 'o0', 'a1'), edge('fork', 'o1', 'b1'),
      edge('a1', 'next', 'qa1'), ...asked('qa1', 'qa2'), ...asked('qa2', 'ra'), edge('ra', 'passed', 'ea'),
      ...(loop ? [edge('ra', 'notyet', 'again'), edge('again', 'o0', 'path'), edge('again', 'o1', 'ea')] : [edge('ra', 'notyet', 'ea')]),
      edge('b1', 'next', 'qb1'), ...(reviewB ? [...asked('qb1', 'rb'), edge('rb', 'passed', 'eb'), edge('rb', 'notyet', 'eb')] : asked('qb1', 'eb'))
    ]
  }
});
const G = towers();
const keyCard = (id) => ({ key: id, question: id });
const branchesOf = (f) => MT.forkRoutes(f).map((r) => [r.picks, [...r.mandatory]]);
check('a choice whose options never meet again is a fork', [...MT.forkChoices(G)], ['fork']);
check('… choices whose options meet again are none (the hexagon, a question on one route)', [[...MT.forkChoices(M)], [...MT.forkChoices(branchQ)]], [[], []]);
check('without a fork: exactly one branch, its required questions as before', [branchesOf(M), branchesOf(plain)], [[[{}, ['q1', 'q2']]], [[{}, ['a', 'b']]]]);
check('each branch has its own required questions', branchesOf(G), [[{ fork: 'o0' }, ['qa1', 'qa2']], [{ fork: 'o1' }, ['qb1']]]);
check('… the required questions of the story: those of every branch', [...MT.mandatoryQuestionSteps(G)], ['qa1', 'qa2', 'qb1']);
check('the fork (own ends, a review at the end of one branch): no branchQuestion, reviewBranch or noAssessment — no warning at all', texts(G, { G }, FORK_Q), []);
check('„all known": one branch is enough — A known, B not', FF.flowQuestionsKnown(G, keyCard, (k) => k === 'QA1' || k === 'QA2'), true);
check('… B alone is enough too', FF.flowQuestionsKnown(G, keyCard, (k) => k === 'QB1'), true);
check('… half of A and nothing of B is not', FF.flowQuestionsKnown(G, keyCard, (k) => k === 'QA1'), false);
check('the review at the end of branch A asks only A’s questions', RV.reviewCards(G, { of: 'story' }, keyCard, () => undefined, 'ra').map((c) => c.question), ['QA1', 'QA2']);
const GS = towers({ shared: true });
check('a shared question before the fork belongs to every branch', branchesOf(GS).map(([, m]) => m), [['q0', 'qa1', 'qa2'], ['q0', 'qb1']]);
check('… the review in branch A asks the shared one and A’s, not B’s', RV.reviewCards(GS, { of: 'story' }, keyCard, () => undefined, 'ra').map((c) => c.question), ['Q0', 'QA1', 'QA2']);
check('… without the step of the review (as before): only what every branch shares', RV.reviewCards(GS, { of: 'story' }, keyCard, () => undefined).map((c) => c.question), ['Q0']);
check('… „all known" needs the shared one too', [FF.flowQuestionsKnown(GS, keyCard, (k) => k === 'QB1'), FF.flowQuestionsKnown(GS, keyCard, (k) => k === 'QB1' || k === 'Q0')], [false, true]);
check('… no mountain warning', texts(GS, { G: GS }, FORK_Q), []);
const GL = towers({ loop: true });
check('„Spróbuj jeszcze raz" back to the path does not join the branches: still the one fork, the retry choice is none', [...MT.forkChoices(GL)], ['fork']);
check('… the same branches, no mountain warning', [branchesOf(GL), texts(GL, { G: GL }, FORK_Q)], [[[{ fork: 'o0' }, ['qa1', 'qa2']], [{ fork: 'o1' }, ['qb1']]], []]);
const GE = flowOf('GE', {
  name: 'Wieża bez pytań', unit: 'U',
  graph: {
    nodes: [node('path', 'show', { of: 'U' }), node('fork', 'choice', { hold: true, options: ['Wieża A', 'Wieża B'] }), node('a1', 'show', { of: 'FA' }), node('qa1', 'question', { of: 'QA1' }), node('ea', 'end'), node('b1', 'show', { of: 'FB' }), node('eb', 'end')],
    edges: [edge('path', 'next', 'fork'), edge('fork', 'o0', 'a1'), edge('fork', 'o1', 'b1'), edge('a1', 'next', 'qa1'), ...asked('qa1', 'ea'), edge('b1', 'next', 'eb')]
  }
});
check('a branch without a question or a review on every path: warned by its name, only it', texts(GE, { GE }, FORK_Q),
  ['The branch “Wieża B” has no assessment: no question and no review lies on every path through it.']);
/*
  Opakowania w gałęzi A: Dzieci | Szkoła | Dorośli — dieselben Karten, die Wege treffen sich vor der gemeinsamen Frage: eine Wahl wie
  bisher, keine Gabelung. Ungültig (`bad`): eine Frage nur bei „Dzieci", ein Przegląd nur bei „Szkoła", „Dorośli" bereitet QA1 nicht vor.
*/
const packing = (bad = false) => flowOf('H', {
  name: 'Wieże z opakowaniami', unit: 'U',
  graph: {
    nodes: [
      node('path', 'show', { of: 'U' }), node('fork', 'choice', { hold: true, options: ['Wieża A', 'Wieża B'] }),
      node('pack', 'choice', { options: ['Dzieci', 'Szkoła', 'Dorośli'] }),
      node('kids', 'show', { of: 'FA' }), node('school', 'show', { of: 'FA' }), node('adults', 'show', { of: bad ? 'X' : 'FA2' }),
      ...(bad ? [node('qk', 'question', { of: 'QK' }), node('rs', 'review', { of: 'story' })] : []),
      node('qa1', 'question', { of: 'QA1' }), node('ra', 'review', { of: 'story' }), node('ea', 'end'),
      node('b1', 'show', { of: 'FB' }), node('qb1', 'question', { of: 'QB1' }), node('eb', 'end')
    ],
    edges: [
      edge('path', 'next', 'fork'), edge('fork', 'o0', 'pack'), edge('fork', 'o1', 'b1'),
      edge('pack', 'o0', 'kids'), edge('pack', 'o1', 'school'), edge('pack', 'o2', 'adults'),
      ...(bad ? [edge('kids', 'next', 'qk'), ...asked('qk', 'qa1'), edge('school', 'next', 'rs'), edge('rs', 'passed', 'qa1'), edge('rs', 'notyet', 'qa1')] : [edge('kids', 'next', 'qa1'), edge('school', 'next', 'qa1')]),
      edge('adults', 'next', 'qa1'), ...asked('qa1', 'ra'), edge('ra', 'passed', 'ea'), edge('ra', 'notyet', 'ea'),
      edge('b1', 'next', 'qb1'), ...asked('qb1', 'eb')
    ]
  }
});
const H = packing();
check('a packaging choice inside a branch (its options meet again) is no fork', [...MT.forkChoices(H)], ['fork']);
check('… the branch’s required questions are those after the packagings meet', branchesOf(H), [[{ fork: 'o0' }, ['qa1']], [{ fork: 'o1' }, ['qb1']]]);
check('… every packaging is still a route of its own', MT.routesOf(H).routes.map((r) => r.picks), [{ fork: 'o0', pack: 'o0' }, { fork: 'o0', pack: 'o1' }, { fork: 'o0', pack: 'o2' }, { fork: 'o1' }]);
check('… the valid form: no mountain warning', texts(H, { H }, FORK_Q), []);
const HB = packing(true);
const hb = MT.mountainProblems(HB, ctxFor({ H: HB }, FORK_Q));
check('… a question on one packaging only: warned as before', hb.filter((p) => p.text.includes('lies on only some paths') && p.text.includes('“QK”')).map((p) => p.step), ['qk']);
check('… a review on one packaging only: warned as before — the one at the end of the branch is not', hb.filter((p) => p.text.includes('This review lies on only some paths')).map((p) => p.step), ['rs']);
check('… coverage per packaging route; branch B is not checked for A’s question', hb.filter((p) => p.text.includes('does not prepare')).map((p) => p.text),
  ['The path “Wieża A → Dorośli” does not prepare the question “QA1”: it shows neither its topic nor one of its explaining slides.']);
check('… nothing else', hb.length, 3);
/* Zwei Möglichkeiten zum selben Schritt zählen je einmal: eine dritte, die an ihm vorbeiführt, macht ihn nicht zur Pflicht. */
const twice = flowOf('T', {
  name: 'Dwie możliwości do jednego kroku',
  graph: {
    nodes: [node('w', 'choice', { options: ['A', 'B', 'C'] }), node('x', 'show', { of: 'F1' }), node('y', 'show', { of: 'F2' }), node('q', 'question', { of: 'Q1' }), node('z', 'question', { of: 'Q2' }), node('e', 'end')],
    edges: [edge('w', 'o0', 'x'), edge('w', 'o1', 'x'), edge('w', 'o2', 'y'), edge('x', 'next', 'q'), ...asked('q', 'z'), edge('y', 'next', 'z'), ...asked('z', 'e')]
  }
});
check('two options to the same step, a third past it: the step is not on every route (each edge counted once), no fork', [[...MT.mandatoryQuestionSteps(twice)], [...MT.forkChoices(twice)]], [['z'], []]);

/* -- 8. Ziele mit Gabelungen (2026-11-10): ein Ziel nur in einem Zweig zählt nur für ihn; „Powtórz przegląd" im eigenen Zweig -- */
/* In G liegt der Przegląd (sein Ziel „przeglad") nur in Turm A. Der letzte Lauf (`visited`) sagt, welchen Zweig der Lernende zu Ende ging. */
const runB = ['path', 'fork', 'b1', 'qb1', 'eb'];
const runA = ['path', 'fork', 'a1', 'qa1', 'qa2', 'ra', 'ea'];
const doneWith = (visited, goals = []) => ({ started: true, done: true, goals, visited });
check('the review’s goal lies at the review steps writing its value', [G.goals.map((g) => g.id), [...MT.goalSteps(G, G.goals[0])]], [['przeglad'], ['ra']]);
check('branch B walked to its end: passed and completed — the review of tower A does not hold it back', [FF.storyStage(G, doneWith(runB)), FF.storyCompleted(G, doneWith(runB))], ['passed', true]);
check('branch A walked to its end without its review passed: „review", not completed; with it: passed',
  [FF.storyStage(G, doneWith(runA)), FF.storyCompleted(G, doneWith(runA)), FF.storyStage(G, doneWith(runA, ['przeglad']))], ['review', false, 'passed']);
check('… the branch is not known (no run, or no end in the last run — „od początku"): every goal, as before',
  [FF.storyStage(G, { started: true, done: true, goals: [] }), FF.storyStage(G, doneWith(['path'])), FF.storyStage(G, doneWith(['path'], ['przeglad']))], ['review', 'review', 'passed']);
check('… without a fork nothing changes (the hexagon: its shared review is every route’s goal)', [FF.storyStage(M, doneWith(['intro', 'wybor', 'segF', 'q1', 'q2', 'przeglad', 'koniec'])), FF.storyStage(M, doneWith(['intro', 'koniec'], ['przeglad']))], ['review', 'passed']);
const G2 = towers({ reviewB: true });
const runB2 = ['path', 'fork', 'b1', 'qb1', 'rb', 'eb'];
check('a review at the end of each branch: one goal (the same value) for both — failing B’s is „review", passing it is passed',
  [[...MT.goalSteps(G2, G2.goals[0])], FF.storyStage(G2, doneWith(runB2)), FF.storyStage(G2, doneWith(runB2, ['przeglad']))], [['ra', 'rb'], 'review', 'passed']);
check('„Powtórz przegląd" goes to the review of the learner’s own branch (without the run: the flow’s review, as before)',
  [FF.reviewStart(G2, runB2), FF.reviewStart(G2, runA), FF.reviewStart(G2), G2.review], ['rb', 'ra', 'ra', 'ra']);
check('… each review asks its own branch’s questions; no mountain warning', [RV.reviewCards(G2, { of: 'story' }, keyCard, () => undefined, 'rb').map((c) => c.question), texts(G2, { G: G2 }, FORK_Q)], [['QB1'], []]);
const posB = new Map([['G', { flow: 'G', step: 'eb', visited: runB, at: 5, done: true }]]);
check('the facts of a story with forks carry its last run; any other story’s facts stay as they were',
  [FF.flowFactsOf(posB, [{ id: 'G', forked: true }]).get('G'), FF.flowFactsOf(posB, [{ id: 'G' }]).get('G')], [doneWith(runB), { started: true, done: true, goals: [] }]);
check('… a base marks its stories with forks', FF.flowRefsOf({ docs: () => [{ id: 'G', data: { graph: G.graph, start: 'path' } }, { id: 'M', data: { graph: M.graph, start: 'intro' } }, { id: 'P', data: { name: 'Bez grafu' } }] }).map((r) => [r.id, r.forked === true]),
  [['G', true], ['M', false], ['P', false]]);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
