/**
 * 2026-11-03 (G) — ERZÄHLUNGEN, DIE IN COGITA ZÄHLEN, nachgemessen: die Bedingung „Przebieg" der einen Logik (lesen,
 * prüfen, in Worten), was über Erzählungen bekannt ist (eigene Stelle, eine Präsentation über ihren Pfad, „ukończony"
 * bleibt, Ziele vereint), Kapitel, die gemerkt und zurückgeholt werden, Karten aus Antworten auf Seiten (zählen für ihre
 * Einträge, machen nichts fragbar), worauf ein Baustein antwortet (echte Frage der Baza, eigene mit „about", Ziel eines
 * Labors), die Ścieżka einer Präsentation (Szenen mit „about" und Fragen, die Einheit ist kein Schritt, eine Gabel aus
 * Knöpfen), die Einheit eines Ablaufs (`unit`) — und dass eine zu Ende erzählte Einheit im Krajobraz im Tal liegt.
 *
 *   node scripts/app-story-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-story-'));
const entries = {
  logic: 'src/app/cogita/logic.ts', facts: 'src/app/cogita/flowFacts.ts', learn: 'src/app/cogita/learn.ts', knowing: 'src/app/cogita/knowing.ts',
  card: 'src/app/pages/presentation/storyCard.ts', show: 'src/app/pages/presentation/presentationPath.ts', flow: 'src/app/cogita/flow.ts',
  data: 'src/app/cogita/landscapeData.ts', presentation: 'src/app/pages/presentation/presentation.ts', next: 'src/app/cogita/storyNext.ts', running: 'src/app/cogita/runningStory.ts'
};
await build({
  entryPoints: entries, bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' },
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [LG, FF, LN, KN, SC, PP, FL, LD, PR] = await Promise.all(Object.keys(entries).map(load));

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};
const facts = (flows) => ({ values: {}, knowness: () => 0, answered: () => null, visited: new Set(), now: new Date(0), flow: (id) => flows[id] });

/* -- Die Bedingung „Przebieg" ------------------------------------------------------------------------------------ */
check('flow condition reads ("flow", "state"; "of" works too; "done" by default)', [
  LG.readCondition({ type: 'flow', flow: 'F', state: 'done' }), LG.readCondition({ type: 'flow', of: 'F' }), LG.readCondition({ type: 'flow', flow: 'F', state: 'goal', goal: 'g1' }), LG.readCondition({ type: 'flow', flow: 'F', state: 'started', goal: 'x' })
], [{ type: 'flow', flow: 'F', state: 'done' }, { type: 'flow', flow: 'F', state: 'done' }, { type: 'flow', flow: 'F', state: 'goal', goal: 'g1' }, { type: 'flow', flow: 'F', state: 'started' }]);
const F = { F: { started: true, done: false, goals: ['g1'] }, G: { started: true, done: true, goals: [] } };
check('flow condition holds: started / done / a goal / any goal / unknown flow', [
  LG.holds(LG.readCondition({ type: 'flow', flow: 'F', state: 'started' }), facts(F)), LG.holds(LG.readCondition({ type: 'flow', flow: 'F', state: 'done' }), facts(F)),
  LG.holds(LG.readCondition({ type: 'flow', flow: 'G', state: 'done' }), facts(F)), LG.holds(LG.readCondition({ type: 'flow', flow: 'F', state: 'goal', goal: 'g1' }), facts(F)),
  LG.holds(LG.readCondition({ type: 'flow', flow: 'G', state: 'goal' }), facts(F)), LG.holds(LG.readCondition({ type: 'flow', flow: 'X', state: 'started' }), facts(F))
], [true, false, true, true, false, false]);
check('flow condition in words', LG.conditionText(LG.readCondition({ type: 'flow', flow: 'F', state: 'done' }), () => 'Deszcz'), 'przebieg „Deszcz" ukończony');
check('flow condition listed for the editor', [LG.CONDITION_TYPES.includes('flow'), LG.CONDITION_LABEL.flow], [true, 'Przebieg']);
check('inside "and" / "not"', LG.holds(LG.readCondition({ type: 'and', items: [{ type: 'flow', flow: 'G' }, { type: 'not', items: [{ type: 'flow', flow: 'F' }] }] }), facts(F)), true);

/* -- Was über Erzählungen bekannt ist --------------------------------------------------------------------------- */
const positions = new Map([
  ['flowA', { flow: 'flowA', step: 's3', visited: ['s1', 's3'], at: 10, done: true, goals: ['a'] }],
  ['page:p1', { flow: 'page:p1', step: 'koniec', visited: ['start', 'koniec'], at: 20, done: true, path: '#/C/Abcd1234' }],
  ['page:p2', { flow: 'page:p2', step: 'start', visited: ['start'], at: 30, path: 'c/other' }]
]);
const known = FF.flowFactsOf(positions, [{ id: 'flowA' }, { id: 'flowB', presentation: 'c/abcd1234' }, { id: 'flowC', presentation: 'c/other' }, { id: 'flowD' }]);
check('flow facts: own position (done, goals); a presentation found by its path (any case, "#/"); started only; never started', [known.get('flowA'), known.get('flowB'), known.get('flowC'), known.has('flowD')], [
  { started: true, done: true, goals: ['a'] }, { started: true, done: true, goals: [] }, { started: true, done: false, goals: [] }, false
]);
check('goals once reached stay reached', FF.mergeGoals(['a'], ['b', 'a']), ['a', 'b']);
check('chapters kept and brought back ("<hub>:<index>")', [FF.chaptersKept({ hub: [0, 2], other: [1] }), FF.withChapters({ chapters: {} }, ['hub:0', 'hub:2', 'other:1', 'bad', ':3']).chapters], [['hub:0', 'hub:2', 'other:1'], { hub: [0, 2], other: [1] }]);
check('flow facts on the gauge reach the conditions (factsOf)', LG.holds(LG.readCondition({ type: 'flow', flow: 'flowA' }), KN.factsOf(KN.withFlows(KN.EMPTY_GAUGE, known), () => [])), true);

/* -- Karten aus Antworten auf Seiten ------------------------------------------------------------------------------ */
const ans = (id, key, about, correctness = 1, at = Date.now()) => ({ id, key, question: key, direction: '', fingerprint: 'f', at, correctness, ...(about === undefined ? {} : { about }) });
const progress = { answers: new Map([['a1', ans('a1', 'mod1', ['T1'])], ['a2', ans('a2', 'base-card', ['T2'])], ['a3', ans('a3', 'mod2', undefined)]]) };
const page = LN.answeredCards(progress, new Set(['base-card']));
check('page cards: only answers with "about" whose card the base does not have', page.map((c) => [c.key, c.about, c.template]), [['mod1', ['T1'], '~page']]);
const marks = (key) => [...progress.answers.values()].filter((a) => a.key === key).map((a) => ({ at: a.at, correctness: a.correctness }));
const g = KN.gaugeFromMarks(page, marks, [], Date.now());
check('page cards count for their entries but make nothing askable', [KN.itemKnowness(g, 'T1') > 0, g.askable.has('T1'), g.testing.has('T1')], [true, false, true]);

/* -- Worauf ein Baustein antwortet ---------------------------------------------------------------------------------- */
const own = { question: 'mod', direction: '', key: 'mod', prompt: [{ text: 'P' }], answer: { form: 'flash', back: [] }, explain: [], fingerprint: 'x', varies: false, requires: [] };
const real = { ...own, question: 'Q1', key: 'Q1', about: ['T9'] };
const story = { card: (ref) => (ref === '@kurs/q1' || ref === 'Q1' ? real : null), resolve: (ref) => ({ '@kurs/t1': 'T1', T2: 'T2' })[ref] ?? null };
check('a module naming a real question answers on that question’s card', SC.storyCard(story, own, '@kurs/q1', [])?.key, 'Q1');
check('an unknown question falls back to the own card, which counts for "about" (resolved, unknown names dropped)', SC.storyCard(story, own, '@kurs/nic', ['@kurs/t1', 'T2', '@kurs/x'])?.about, ['T1', 'T2']);
check('outside a story (or without its base) the own card, unchanged', [SC.storyCard(null, own, '@kurs/q1', ['T1'])?.key, SC.storyCard(null, own, '', ['T1'])?.about], ['mod', undefined]);
check('a goal has its own card (lab, drawing)', [SC.goalCard('lab7', 'Kosz').key, SC.goalCard('lab7', 'Kosz').answer.form], ['lab7|goal', 'flash']);
check('"about" lines (lines or commas)', SC.aboutOf('@a/1\n @a/2 , @a/3'), ['@a/1', '@a/2', '@a/3']);

/* -- Die Ścieżka einer Präsentation ---------------------------------------------------------------------------------- */
const show = PR.readShow({ scenes: [{ key: 'start' }, { key: 'intro', about: ['@t/start'] }, { key: 'fork' }, { key: 'a' }, { key: 'b' }, { key: 'meet', about: ['@t/meet', '@unit'] }] });
check('a scene keeps what it is about', [show.scenes[1].about, PR.sceneJson(show.scenes[1]).about], [['@t/start'], ['@t/start']]);
const part = (id, kind, config, places) => ({ id, kind, config, layout: { show: { places } } });
const parts = [
  part('qa', 'question', { question: '@q/a' }, { a: { x: 50, y: 50, w: 50 } }),
  part('qb', 'question', { prompt: 'B?', about: '@t/b\n@unit' }, { b: { x: 50, y: 50, w: 50 } }),
  part('txt', 'text', { title: 'x', about: '@t/ignored' }, { fork: { x: 50, y: 50, w: 50 } })
];
const ids = { '@t/start': 'start', '@q/a': 'qA', '@t/a': 'ta', '@t/b': 'tb', '@t/meet': 'meet', '@unit': 'U' };
const refs = { resolve: (r) => ids[r] ?? null, aboutOf: (id) => (id === 'qA' ? ['ta', 'U'] : []), label: (id) => id, needsOf: (id) => ({ ta: ['start'], tb: ['start'], meet: ['ta', 'tb'] })[id] ?? [] };
check('scene entries: the scene’s own "about", a real question (what it is about), an own question’s "about" — the unit is no step', Object.fromEntries(PP.sceneEntries(parts, refs, show, new Set(['U']))), { intro: ['start'], meet: ['meet'], a: ['ta'], b: ['tb'] });
/* Das Storyboard als Graph: start → intro → fork; fork mit zwei Knöpfen zu a und b; beide zum Treffpunkt. */
const node = (id, type, config = {}) => ({ id, type, x: 0, y: 0, config });
const edge = (from, out, to) => ({ id: `${from}>${out}`, from, out, to, in: 'in' });
const storyFlow = { start: 's:start', graph: { nodes: ['start', 'intro', 'fork', 'a', 'b', 'meet'].map((k) => node(`s:${k}`, 'scene')).concat([node('end', 'end')]), edges: [
  edge('s:start', 'next', 's:intro'), edge('s:intro', 'next', 's:fork'), edge('s:fork', 'b0', 's:a'), edge('s:fork', 'b1', 's:b'), edge('s:a', 'right', 's:meet'), edge('s:b', 'right', 's:meet'), edge('s:a', 'wrong', 's:a'), edge('s:meet', 'next', 'end')
] } };
const told = PP.presentationPath(storyFlow, show, parts, refs, 'page:p', '@unit');
const pos = Object.fromEntries(told.model.nodes.map((n) => [n.id, [n.level, n.x]]));
/* 2026-11-04 — die Teile: die Szenen zum Lesen, die Wahl auf der Szene (zwei Knöpfe), zwei Szenen mit Fragen nebeneinander, der Treffpunkt, das Ende. */
const kindsP = told.sp.parts.map((p) => p.kind);
const at = (step) => pos[told.model.nodes[told.sp.partOfStep.get(step)].id];
check('the presentation’s path: reading scenes, a choice on the scene (two buttons), two question scenes side by side, the meeting point centred above, one end', [kindsP, told.sp.parts[2].fork.branches.length, at('s:a'), at('s:b'), at('s:meet')], [['start', 'read', 'fork', 'learn', 'learn', 'read', 'end'], 2, [3, -0.5], [3, 0.5], [4, 0]]);
check('a tap finds the scene of an entry', [told.sceneOf('tb'), told.sceneOf('meet'), told.sceneOf('nothing')], [4, 5, -1]);

/* -- Die Einheit eines Ablaufs, und im Krajobraz das Tal ------------------------------------------------------------- */
check('a flow names the unit it is', FL.readFlow('f', { name: 'Deszcz', look: 'scenes', presentation: 'c/abc', unit: 'U' }).unit, 'U');
const input = { ids: ['U', 'T'] };
const state = LD.landscapeState(input, KN.EMPTY_GAUGE, new Set(['U']));
check('a unit whose story is done lies in the valley (knowness 1); the rest as before', [state.knowness[0], state.knowness[1]], [1, 0]);

/* -- 2026-11-03 (Prompt 5): erst der bestandene Przegląd senkt; der Knopf einer Erzählung; die Ziele einer Seite -- */
{
  const withGoals = FL.readFlow('fx', { name: 'Deszcz', unit: 'U', review: 'p0', goals: [{ id: 'przeglad', title: 'Przegląd', condition: { type: 'value', value: 'deszcz.przeglad', op: 'ge', than: 3 } }] });
  const without = FL.readFlow('fy', { name: 'Bez celów', unit: 'V' });
  check('a flow marks where its review starts ("review")', [withGoals.review, without.review], ['p0', undefined]);
  check('story stages: new / started / done with a goal missing ("review") / done and every goal ("passed")', [
    FF.storyStage(withGoals, undefined), FF.storyStage(withGoals, { started: true, done: false, goals: [] }),
    FF.storyStage(withGoals, { started: true, done: true, goals: [] }), FF.storyStage(withGoals, { started: true, done: true, goals: ['przeglad'] })
  ], ['new', 'started', 'review', 'passed']);
  check('flows without goals as before: done = passed (the unit sinks)', [FF.storyStage(without, { started: true, done: true, goals: [] }), FF.storyStage(without, { started: true, done: false, goals: [] })], ['passed', 'started']);
  check('reached goals while not yet at the end: still "started"', FF.storyStage(withGoals, { started: true, done: false, goals: ['przeglad'] }), 'started');
  check('the story button by stage', [FF.STORY_BUTTON.new, FF.STORY_BUTTON.started, FF.STORY_BUTTON.review, FF.STORY_BUTTON.passed], ['Zacznij opowieść', 'Kontynuuj opowieść', 'Powtórz przegląd', 'Otwórz opowieść']);
  check('"Powtórz przegląd" goes to "review", else to the start (a presentation: its first scene, empty)', [
    FF.reviewStart(withGoals), FF.reviewStart(FL.readFlow('fz', { name: 'G', graph: { nodes: [{ id: 'a', type: 'show', config: {} }], edges: [] }, start: 'a' })), FF.reviewStart(FL.readFlow('fp', { name: 'P', presentation: 'c/abc' }))
  ], ['p0', 'a', '']);
  const lib = { docs: () => [
    { id: 'f1', data: { name: 'Story', unit: 'U' } }, { id: 'f2', data: { name: 'Story with cards', unit: 'W' } }, { id: 'f3', data: { name: 'No unit' } },
    { id: 'f4', data: { name: 'Page story', presentation: '#/C/Abc', goals: [{ id: 'przeglad', condition: { type: 'value', value: 'opowiesc.przeglad', op: 'ge', than: 3 } }] } }
  ] };
  check('story units: a unit a flow points at and that has no cards of its own (one with cards is no story unit)', [...FF.storyUnitsOf(lib, (id) => id === 'W').keys()], ['U']);
  const fx = (n) => ({ values: { 'opowiesc.przeglad': n }, knowness: () => 0, answered: () => null, visited: new Set(), now: new Date(0) });
  check('a page story: the goals of the base flow that points at it, from the page\'s values (path in any case)', [FF.pageGoals(lib, 'c/abc', fx(2)), FF.pageGoals(lib, 'c/abc', fx(3)), FF.pageGoals(lib, 'c/other', fx(3)), FF.pageGoals(lib, null, fx(3))], [[], ['przeglad'], [], []]);
  const input = { ids: ['U', 'T'] };
  const lowered = new Set([...FF.storyUnitsOf(lib, () => false).entries()].filter(([, f]) => FF.storyStage(f, { started: true, done: true, goals: [] }) === 'passed').map(([u]) => u));
  check('a story without goals that is done still lowers its unit', LD.landscapeState(input, KN.EMPTY_GAUGE, lowered).knowness[0], 1);
}

/* -- 2026-11-04 (Prompt 11): was nach dem Ende einer Erzählung kommt (`storyNext.ts`) -------------------------------- */
{
  const NX = await load('next');
  /* U: die Erzählung, die eben zu Ende ging. Danach: N1 (eine Erzählung), N3 und N4 (Themen), durch T (ohne Karten) N2. */
  const builds = { U: ['T', 'N1', 'N3', 'N4'], T: ['N2'], X: ['N3'], W1: ['V', 'Q'], t1: ['M'] };
  const needs = { T: ['U'], N1: ['U'], N3: ['U', 'X'], N4: ['U'], N2: ['T'], V: ['W1'], Q: ['W1'], M: ['t1'] };
  const locks = { N3: { missing: ['X'], due: [] }, N1: { missing: [], due: ['Z'] } };
  const input = (over = {}) => ({
    unit: 'U', taught: ['s1', 's2'], needs: (id) => needs[id] ?? [], builds: (id) => builds[id] ?? [],
    story: (id) => ['U', 'N1', 'V'].includes(id), topic: (id) => ['N2', 'N3', 'N4', 'X', 'Q', 'M'].includes(id),
    learned: (id) => ['U', 'N4'].includes(id), lock: (id) => locks[id] ?? { missing: [], due: [] }, ...over
  });
  const got = NX.storyNext(input());
  check('after „Koniec": the successors in the learning order (through entries without cards), the ready ones first, learned ones left out', got.next.map((s) => [s.id, s.kind, s.ready]), [['N2', 'topic', true], ['N1', 'story', false], ['N3', 'topic', false]]);
  check('… a successor not possible yet says why, by name: what is missing, what to review first', got.next.filter((s) => !s.ready).map((s) => [s.id, s.missing, s.due]), [['N1', [], ['Z']], ['N3', ['X'], []]]);
  check('… with a ready successor there is no detour to the map', got.nearest, null);
  const none = NX.storyNext(input({ unit: 'V', taught: [] }));
  check('a story without successors: the nearest learnable field of the map (fewest steps in the learning graph)', [none.next.length, none.nearest?.id, none.nearest?.ready], [0, 'Q', true]);
  const blocked = NX.storyNext(input({ lock: (id) => (id === 'X' ? { missing: [], due: [] } : { missing: ['X'], due: [] }) }));
  check('… none possible yet: the nearest field that is possible now (here X, which they all need first)', [blocked.next.every((s) => !s.ready), blocked.nearest?.id], [true, 'X']);
  const shut = NX.storyNext(input({ lock: () => ({ missing: ['Y0'], due: [] }) }));
  check('… and when nothing on the map is possible: no field (the host shows „Wróć do mapy")', [shut.next.every((s) => !s.ready), shut.nearest], [true, null]);
  const viaTaught = NX.storyNext(input({ unit: 'Z0', taught: ['t1'] }));
  check('a unit with nothing after it: what builds on what the story teaches and leads out of it', viaTaught.next.map((s) => s.id), ['M']);
  check('never from links the story sets itself: a story with no unit and nothing taught has no successor', NX.storyNext(input({ unit: null, taught: [] })).next.length, 0);
}

/* -- 2026-11-04 (Prompt 13): die Stelle einer Erzählung überlebt Neuladen, „od początku“, ein neues Einspielen ------ */
{
  const M = LN.mergePosition;
  const done = { flow: 'f', step: 'end', visited: ['a', 'b', 'end'], at: 10, done: true, goals: ['g1'], chapters: ['c:0'] };
  const again = { flow: 'f', step: 'a', visited: ['a'], at: 20 };
  const m = M(done, again);
  check('A: a newer place (\"od początku\") keeps \"ukończony\", goals and finished roads', [m.step, m.done, m.goals, m.chapters], ['a', true, ['g1'], ['c:0']]);
  check('A: … in either order of arrival', JSON.stringify(M(again, done)), JSON.stringify(m));
  check('A: only an explicit reset removes them', M(done, { ...again, at: 30, reset: true }).done, undefined);
  const after = LN.absorb(LN.absorb(LN.EMPTY_PROGRESS ?? { answers: new Map(), snapshots: new Map(), suspended: new Set(), positions: new Map(), values: {} }, { kind: 'position', positions: [done] }), { kind: 'position', positions: [again] });
  check('A: absorbing batches merges the same way', after.positions.get('f').done, true);
  const byRef = new Map([['old-id', { ...done, ref: 'p/krag' }]]);
  check('A: a story imported again under a new id finds its place by its lasting ref', LN.positionFor(byRef, { id: 'new-id', ref: 'p/krag' })?.done, true);
  const flow = FL.readFlow('f', { name: 'F', start: 'n1', graph: { nodes: [{ id: 'n1', type: 'show', config: {} }, { id: 'n2', type: 'show', config: {} }, { id: 'n3', type: 'end', config: {} }], edges: [{ id: 'e1', from: 'n1', out: 'next', to: 'n2' }, { id: 'e2', from: 'n2', out: 'next', to: 'n3' }] } });
  const ctx = { facts: () => facts({}), flows: () => undefined, members: () => [] };
  const RS = await import(pathToFileURL(join(workspace, 'running.js')).href);
  const r1 = RS.startRun(flow, { at: 'n2', visited: ['n1', 'n2'] }, ctx);
  check('A: resuming restores the step and the visited steps', [r1.state.step, r1.state.visited], ['n2', ['n1', 'n2']]);
  const r2 = RS.startRun(flow, { at: 'gone', visited: ['n1', 'gone'] }, ctx);
  check('A: a stored step that no longer exists resumes at the first step not yet visited', [r2.state.step, r2.state.visited], ['n2', ['n1', 'n2']]);
}

await rm(workspace, { recursive: true, force: true });
console.log(`\n${passed} checks pass${failed > 0 ? `, ${failed} FAIL` : ''}.`);
if (failed > 0) process.exit(1);
