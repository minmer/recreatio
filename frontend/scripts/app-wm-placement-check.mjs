/**
 * 2026-11-12 — DIE EINSTUFUNG („Sprawdź, ile już umiesz", Schritt "explore", `worldmap/wmPlacement.ts`) auf erzeugten Welten:
 * Front mit Zweigen und Zusammenflüssen; Folge, Fehler, verbrannter Turm; der Schritt zurück und das Nachprüfen nach unten;
 * Rücknahme und ihre Wirkung auf Nachfolger; Gekonntes zählt als richtig; Gutschrift gegenüber Kenntnis der Karten; die
 * Zielstufe mit Stufe 1 und 2 (ohne openAt); einmal, Anhalten und Weitermachen; der Anstoss an einer Wahl; Ścieżka und
 * Weltkarte zeigen den Knoten als einen Schritt.
 *
 *   node scripts/app-wm-placement-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-wm-placement-'));
const entries = {
  graph: 'src/app/cogita/worldmap/wmGraph.ts', lines: 'src/app/cogita/worldmap/wmLines.ts', state: 'src/app/cogita/worldmap/wmState.ts',
  fx: 'src/app/cogita/worldmap/wmFixtures.ts', pl: 'src/app/cogita/worldmap/wmPlacement.ts', runs: 'src/app/cogita/worldmap/wmRuns.ts',
  flow: 'src/app/cogita/flow.ts', story: 'src/app/cogita/storyPath.ts'
};
await build({
  entryPoints: entries, bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' },
  jsx: 'automatic', define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [G, L, S, F, PL, R, FL, SP] = await Promise.all(Object.keys(entries).map(load));
await rm(workspace, { recursive: true, force: true });

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};

/* -- Eine Welt aus Türmen (je n Karten), nur mit Voraussetzungen --------------------------------------------------------------------- */
function towers(spec, flows = []) {
  const ents = [];
  const cards = [];
  for (const [id, needs, n = 4] of spec) {
    ents.push({ id, kinds: ['turm'], label: `Turm ${id}`, refs: needs.map((to) => ({ field: 'wymaga', to, prerequisite: 'up', structure: 'up' })) });
    for (let i = 0; i < n; i += 1) {
      ents.push({ id: `q/${id}/${i}`, kinds: ['question'], label: `Frage ${id} ${i + 1}`, refs: [{ field: 'about', to: id }] });
      cards.push({ key: `q/${id}/${i}`, question: `q/${id}/${i}`, about: [id] });
    }
  }
  return { entries: ents, cards, flows };
}
/* A → B, C → D (Zusammenfluss) → E;  A → B → X (Kette über B) */
const WORLD = towers([['A', []], ['B', ['A']], ['C', ['A']], ['D', ['B', 'C']], ['E', ['D']], ['X', ['B']]]);

function open(input, { placed = {}, levels = {}, knowness = {}, setting = { levels: 1, openAt: null } } = {}) {
  const world = G.readWorld(input);
  const lines = L.linesOf(world, input.flows);
  const learner = { ...F.fakeLearner({ levels, knowness }), placed: (p) => placed[p] ?? 0 };
  const state = S.stateOf(world, lines, learner, { levels: setting.levels, knownShare: 1, openAt: setting.openAt });
  return { world, lines, state };
}
const cfg = PL.readExplore({ scope: ['A', 'B', 'C', 'D', 'E', 'X'] });
const ctxOf = (w, rules = R.defaultRules(2), seed = 1) => {
  let x = seed;
  const random = () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; };
  return { world: w.world, state: w.state, scope: PL.scopeTowers(w.world, w.lines, cfg), cardsOf: (p) => w.world.places.get(p)?.cards ?? [], lastAnswered: () => 0, rules, random };
};
const sorted = (a) => [...a].sort();

/* -- Die Front: Zweige und Zusammenflüsse --------------------------------------------------------------------------------------------- */
{
  check('config: defaults (streak 3, errors 2, recheck 2, once, push, both modes, adaptive) and clamping to 1–10', [cfg.streak, cfg.errors, cfg.recheck, cfg.once, cfg.push, cfg.modes, cfg.default, PL.readExplore({ streak: 40, errors: 0 }).streak, PL.readExplore({ streak: 40, errors: 0 }).errors], [3, 2, 2, true, true, ['adaptive', 'target'], 'adaptive', 10, 1]);
  const w0 = open(WORLD);
  check('front: at the start only what has no open prerequisite (A)', PL.frontOf(ctxOf(w0), PL.newAdaptive()), ['A']);
  const w1 = open(WORLD, { placed: { A: 1 } });
  check('front: A credited → both branches (B and C)', sorted(PL.frontOf(ctxOf(w1), PL.newAdaptive())), ['B', 'C']);
  const w2 = open(WORLD, { placed: { A: 1, B: 1 } });
  check('front: B credited → C and X, but not D (the join needs C too)', sorted(PL.frontOf(ctxOf(w2), PL.newAdaptive())), ['C', 'X']);
  const w3 = open(WORLD, { placed: { A: 1, B: 1, C: 1 } });
  check('front: B and C credited → the join D enters', sorted(PL.frontOf(ctxOf(w3), PL.newAdaptive())), ['D', 'X']);
  const real = open(WORLD, { levels: { A: 1 } });
  check('front: a tower conquered by real answers is never asked, it only opens the way', [PL.frontOf(ctxOf(real), PL.newAdaptive()).includes('A'), sorted(PL.frontOf(ctxOf(real), PL.newAdaptive()))], [false, ['B', 'C']]);
  check('scope: downTo takes the whole base of a tower and the tower itself', sorted(PL.scopeTowers(w0.world, w0.lines, { scope: [], downTo: 'D' })), ['A', 'B', 'C', 'D']);
}

/* -- Folge, Fehler, verbrannter Turm --------------------------------------------------------------------------------------------------- */
{
  const w = open(WORLD);
  const ctx = ctxOf(w);
  let run = PL.newAdaptive();
  const ask = { place: 'A', card: 'q/A/0', recheck: false };
  let out = PL.answer(ctx, run, ask, true, cfg); run = out.run;
  out = PL.answer(ctx, run, ask, true, cfg); run = out.run;
  check('streak: two right are not enough (streak 3)', [out.credit ?? null, run.streak.A], [null, 2]);
  out = PL.answer(ctx, run, ask, true, cfg); run = out.run;
  check('streak: the third right credits the tower (this run)', [out.credit, run.credited], ['A', ['A']]);
  let r2 = PL.newAdaptive();
  r2 = PL.answer(ctx, r2, ask, true, cfg).run;
  r2 = PL.answer(ctx, r2, ask, false, cfg).run;
  check('a wrong answer breaks the streak (counts again from zero)', [r2.streak.A, r2.wrong.A, r2.burned], [0, 1, []]);
  r2 = PL.answer(ctx, r2, ask, false, cfg).run;
  check('errors: the second wrong answer burns the tower for this run', r2.burned, ['A']);
  const wb = open(WORLD, { placed: { A: 1 } });
  const burnedB = { ...PL.newAdaptive(), burned: ['B'] };
  check('a burned tower is not asked again and its successors do not enter the front', sorted(PL.frontOf(ctxOf(wb), burnedB)), ['C']);
}

/* -- Der Schritt zurück und das Nachprüfen nach unten ---------------------------------------------------------------------------------- */
{
  /* A und B in diesem Lauf gutgeschrieben; X (über B) verbrennt. */
  const w = open(WORLD, { placed: { A: 1, B: 1 } });
  const ctx = ctxOf(w);
  let run = { ...PL.newAdaptive(), credited: ['A', 'B'] };
  const x = { place: 'X', card: 'q/X/0', recheck: false };
  run = PL.answer(ctx, run, x, false, cfg).run;
  run = PL.answer(ctx, run, x, false, cfg).run;
  check('a burned tower makes the run step back: its prerequisite credited in this run (B) is rechecked', [run.burned, run.recheck], [['X'], ['B']]);
  const next = PL.nextAsk(ctx, run);
  check('… the next question comes from the recheck, not from the front', [next.ask.place, next.ask.recheck], ['B', true]);
  let ok = PL.answer(ctx, run, next.ask, true, cfg).run;
  ok = PL.answer(ctx, ok, { ...next.ask }, true, cfg).run;
  check('recheck: two right in a row confirm B (the run goes on in the other branches)', [ok.recheck, ok.credited], [[], ['A', 'B']]);
  const fail = PL.answer(ctx, run, next.ask, false, cfg);
  check('recheck: one wrong answer withdraws B and rechecks its own prerequisite credited in this run (A)', [fail.withdraw, fail.run.credited, fail.run.recheck, fail.run.burned.includes('B')], ['B', ['A'], ['A'], true]);
  const fall = PL.answer(ctx, fail.run, { place: 'A', card: 'q/A/1', recheck: true }, false, cfg);
  check('… and so on downwards: A fails too, nothing is left to recheck', [fall.withdraw, fall.run.credited, fall.run.recheck], ['A', [], []]);
  /* Was vor dem Lauf durch echte Antworten erobert war, wird nie nachgeprüft. */
  const wr = open(WORLD, { levels: { A: 1 }, placed: { B: 1 } });
  let rr = { ...PL.newAdaptive(), credited: ['B'] };
  rr = PL.answer(ctxOf(wr), rr, x, false, cfg).run;
  rr = PL.answer(ctxOf(wr), rr, x, false, cfg).run;
  const failB = PL.answer(ctxOf(wr), rr, { place: 'B', card: 'q/B/0', recheck: true }, false, cfg);
  check('a tower conquered before the run by real answers (A) is never rechecked or withdrawn', [failB.withdraw, failB.run.recheck], ['B', []]);
}

/* -- Rücknahme und ihre Wirkung auf Nachfolger (aus dem Graphen) ----------------------------------------------------------------------- */
{
  const both = open(WORLD, { placed: { A: 1, B: 1, X: 1 } });
  check('credits: A, B and X credited — all placed, X passable', [both.state.places.get('A').placed > 0, both.state.places.get('B').placed > 0, both.state.places.get('X').passable], [true, true, true]);
  const withdrawn = open(WORLD, { placed: { A: 0, B: 1, X: 1 } });
  check('withdrawal of A: B and X lose their credit (they need their prerequisites passable) — no own cascade', [withdrawn.state.places.get('B').placed, withdrawn.state.places.get('X').placed, withdrawn.state.places.get('X').passable], [0, 0, false]);
}

/* -- Gekonntes zählt als richtig; Gutschrift gegenüber Kenntnis --------------------------------------------------------------------------- */
{
  const known = Object.fromEntries(Array.from({ length: 4 }, (_, i) => [`q/A/${i}`, 2]));
  const w = open(WORLD, { knowness: known, setting: { levels: 2, openAt: 1 } });
  const ctx = ctxOf(w);
  check('known cards count as right (the player would skip them): a tower can be credited without a single question', PL.isKnownSkip(w.state, 'q/A/0'), true);
  let run = PL.newAdaptive();
  let credit = null;
  for (let i = 0; i < 3; i += 1) { const out = PL.answer(ctx, run, { place: 'A', card: `q/A/${i}`, recheck: false }, PL.isKnownSkip(w.state, `q/A/${i}`), cfg); run = out.run; credit = out.credit ?? credit; }
  check('… three known cards → A credited', credit, 'A');
  const p = open(WORLD, { placed: { A: 1 }, setting: { levels: 3, openAt: 2 } });
  check('credit gives the level needed to go on (openAt 2 of 3 levels): level 2, passable, not conquered; card knowness unchanged', [p.state.places.get('A').level, p.state.places.get('A').passable, p.state.places.get('A').conquered, p.state.band('q/A/0')], [2, true, false, 'unseen']);
  const none = open(WORLD, { placed: { A: 1 }, setting: { levels: 0, openAt: null } });
  check('without levels a credit means "conquered (placed)"', [none.state.places.get('A').conquered, none.state.places.get('A').placed > 0], [true, true]);
  check('credit level: openAt (at least 1); without openAt all levels; without levels 0', [S.creditLevel({ levels: 3, openAt: 2 }), S.creditLevel({ levels: 3, openAt: 0 }), S.creditLevel({ levels: 3, openAt: null }), S.creditLevel({ levels: 0, openAt: null })], [2, 1, 3, 0]);
}

/* -- Zielstufe: Stufe 1 und 2, ohne openAt ----------------------------------------------------------------------------------------------- */
{
  const setting = { levels: 2, openAt: 1 };
  const w = open(WORLD, { levels: { A: 1 }, setting });
  check('target 2: A (level 1) is asked; B is not, although openAt would open it (A has not reached 2)', PL.frontOf(ctxOf(w), PL.newTarget(2)), ['A']);
  check('target 1: A has reached it; B and C (needing A ≥ 1) are in the front', sorted(PL.frontOf(ctxOf(w), PL.newTarget(1))), ['B', 'C']);
  const rules = [{ pct: 75, attempts: 'any' }, { pct: 100, attempts: 'first' }];
  const ctx = ctxOf(w, rules);
  let run = PL.newTarget(2);
  const first = PL.nextAsk(ctx, run);
  run = first.run;
  const out = PL.answer(ctx, run, first.ask, false, cfg);
  check('target 2 (100 %, first try): one wrong answer decides it — not reached, A not conquered, its successors stay out', [out.decided?.reached, out.run.failed, PL.frontOf(ctx, out.run)], [false, ['A'], []]);
  let r2 = PL.newTarget(2);
  let decided = null;
  for (let i = 0; i < 4 && decided === null; i += 1) { const nx = PL.nextAsk(ctx, r2); r2 = nx.run; const o = PL.answer(ctx, r2, nx.ask, true, cfg); r2 = o.run; decided = o.decided ?? null; }
  check('target 2: all right → reached; the run record meets the rule (ordinary conquest, nothing placed)', [decided?.reached, R.runScore(R.finishRun(decided.session, 1, []), 'first')], [true, 1]);
  const s = R.startRun('t', 'A', ['a', 'b', 'c', 'd'], 0);
  const s1 = R.runAnswer(R.runAnswer(R.runAnswer(s, R.runCard(s), 1), R.runCard(R.runAnswer(s, R.runCard(s), 1)), 1), R.runCard(R.runAnswer(R.runAnswer(s, R.runCard(s), 1), R.runCard(R.runAnswer(s, R.runCard(s), 1)), 1)), 1);
  check('decide: 3 of 4 right at 75 % is reached early (the last card is not needed)', PL.decide(s1, { pct: 75, attempts: 'any' }), 'reached');
}

/* -- Einmal, Anhalten und Weitermachen ------------------------------------------------------------------------------------------------- */
{
  const run = { ...PL.newAdaptive(), credited: ['A', 'B'], burned: ['X'], recheck: ['B'], streak: { C: 2 }, wrong: { C: 1 }, recheckStreak: 1 };
  check('stop and continue: the run is kept in the position of its own flow and comes back unchanged', PL.unpackRun(PL.packRun(run)), run);
  const t = { ...PL.newTarget(2), reached: ['A'], failed: ['C'] };
  check('… also in the target mode (the open tower is asked again)', PL.unpackRun(PL.packRun(t)), t);
  check('the scope key is the same for the same scope in several stories', PL.scopeKey({ scope: ['B', 'A'], downTo: null }), PL.scopeKey({ scope: ['A', 'B'], downTo: null }));
}

/* -- Der Anstoss an einer Wahl; die Ścieżka und die Weltkarte ---------------------------------------------------------------------------- */
{
  const node = (id, type, config = {}) => ({ id, type, config, x: 0, y: 0 });
  const edge = (from, out, to) => ({ id: `${from}-${out}`, from, out, to, in: 'in' });
  const sub = FL.readFlow('sub', { start: 'e', graph: { nodes: [node('e', 'explore', { scope: ['A'] }), node('z', 'end')], edges: [edge('e', 'done', 'z')] } });
  const main = FL.readFlow('main', {
    start: 'c',
    graph: {
      nodes: [node('c', 'choice', { options: [{ label: 'Prosto' }, { label: 'Ze sprawdzeniem' }, { label: 'Abstecher' }] }), node('a', 'show'), node('ex', 'explore', { scope: ['B'] }), node('d', 'detour', { flow: 'sub' }), node('b', 'show'), node('z', 'end')],
      edges: [edge('c', 'o0', 'a'), edge('c', 'o1', 'ex'), edge('c', 'o2', 'd'), edge('ex', 'done', 'b'), edge('d', 'done', 'b'), edge('a', 'next', 'z'), edge('b', 'next', 'z')]
    }
  });
  const flowOf = (id) => (id === 'sub' ? sub : undefined);
  check('push: (a) an explore step on the branch, (b) a detour whose story starts with one; none on a plain branch', ['o0', 'o1', 'o2'].map((x) => PL.exploreOnBranch(main, 'c', x, flowOf)?.scope ?? null), [null, ['B'], ['A']]);
  check('push: "push": false is never recommended', PL.exploreOnBranch(FL.readFlow('m2', { start: 'c', graph: { nodes: [node('c', 'choice', { options: [{ label: 'x' }] }), node('ex', 'explore', { scope: ['A'], push: false })], edges: [edge('c', 'o0', 'ex')] } }), 'c', 'o0', flowOf), null);
  const SPm = SP.storyPath(sub, SP.stepWorkOf(() => []), (id) => id);
  check('path view: the explore node is one step (one part)', SPm.parts.filter((p) => p.steps.includes('e')).length, 1);
  check('the flow model: one exit "done"', FL.exitsOf('explore', {}).map((p) => p.id), ['done']);
}

if (failed > 0) { console.error(`app-wm-placement-check: ${failed} failed, ${passed} passed`); process.exit(1); }
console.log(`app-wm-placement-check: ${passed} checks passed`);
