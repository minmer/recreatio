/**
 * 2026-11-22 (I11) — DIE PLANUNG EINER STUNDE (`cogita/lesson/lessonPlan.ts`), rein gerechnet auf der Bosko-Gestalt:
 *   1. der Weg vom Anfang zum Ziel ist der geführte Weg („Prowadź mnie tutaj", `wmPlan.ts`) — dieselben Türme, dieselben Pfade;
 *   2. ein Anfang an einem Turm: was darunter liegt, kann die Klasse; ein Anfang mitten in einem Pfad: dieser Pfad ab dem Schritt;
 *   3. auslassen, hinzufügen (nichts doppelt), verschieben, entfernen (nur Hinzugefügtes);
 *   4. Warnungen, wenn etwas vor dem steht, was es braucht (nicht für Ausgelassenes, nicht für das am Anfang Gekonnte);
 *   5. die Teile der Stunde: Pfade als Erzählungen, „Pfad und Turm" als Fragen nacheinander (höchstens 12), Ausgelassenes fehlt;
 *   6. ein Weg zu einer Frage als Teile, mit seinen Abschlussfragen;
 *   7. gespeichert und wieder gelesen (der Plan im `config`; Fragen-Teile; eine gespeicherte Planung ist keine laufende Stunde).
 *
 *   node scripts/app-lesson-plan-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-lesson-plan-'));
const entries = {
  graph: 'src/app/cogita/worldmap/wmGraph.ts', lines: 'src/app/cogita/worldmap/wmLines.ts', state: 'src/app/cogita/worldmap/wmState.ts',
  fx: 'src/app/cogita/worldmap/wmFixtures.ts', paths: 'src/app/cogita/worldmap/wmPaths.ts', wplan: 'src/app/cogita/worldmap/wmPlan.ts',
  lp: 'src/app/cogita/lesson/lessonPlan.ts', lt: 'src/app/cogita/lesson/lessonTally.ts', api: 'src/app/cogita/lesson/lessonApi.ts'
};
await build({
  entryPoints: entries, bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' },
  jsx: 'automatic', define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [G, L, S, F, P, WP, LP, LT, API] = await Promise.all(Object.keys(entries).map(load));
await rm(workspace, { recursive: true, force: true });

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};

const bosko = F.boskoWorld();
const world = G.readWorld(bosko.input);
const lines = L.linesOf(world, bosko.input.flows);
const settings = { levels: 1, knownShare: 1, openAt: null };
const HOME = { kind: 'home' };
const towersOf = (items) => items.filter((i) => i.kind === 'tower').map((i) => i.place);
const flowsOf = (items) => items.filter((i) => i.kind === 'path').map((i) => i.flow);

/* -- 1. Derselbe Weg wie „Prowadź mnie tutaj" ------------------------------------------------------------------------------------ */
{
  const fresh = S.stateOf(world, lines, F.fakeLearner({}), settings);
  const guided = WP.plan(fresh, 'magone');
  const cls = LP.classState(world, lines, settings, new Set());
  const items = LP.routeItems(cls, lines, HOME, 'magone');
  check('route: the towers are those of the guided route, in its order (a class at zero = a new learner)', towersOf(items), guided.places);
  const travelLines = [...new Set(guided.steps.filter((s) => s.kind === 'travel').map((s) => lines.sections.get(s.section).line))];
  check('route: the paths are the stories the guided route travels, each once, in order', flowsOf(items), travelLines);
  check('route: the target is the last tower; nothing is left out or added by default', [towersOf(items).at(-1), items.every((i) => !i.skip && !i.added)], ['magone', true]);
  check('route: a tower the class already has from the start gives an empty plan', LP.routeItems(LP.classState(world, lines, settings, LP.knownFrom(world, lines, { kind: 'place', place: 'magone' })), lines, { kind: 'place', place: 'magone' }, 'magone'), []);
}

/* -- 2. Anfang an einem Turm, Anfang mitten in einem Pfad ------------------------------------------------------------------------ */
{
  const start = { kind: 'place', place: 'narodz' };
  const known = LP.knownFrom(world, lines, start);
  check('start at a tower: the class knows it and everything below it', [known.has('narodz'), known.has('konwikt'), known.has('becchi'), known.has('choroba')], [true, true, true, false]);
  const items = LP.routeItems(LP.classState(world, lines, settings, known), lines, start, 'domkos');
  check('start at a tower: none of what the class knows is planned again', towersOf(items).some((p) => known.has(p)), false);
  check('start at a tower: the way leads on to the target (choroba before domkos)', [towersOf(items).includes('choroba'), towersOf(items).at(-1)], [true, 'domkos']);
  const L3 = bosko.input.flows.find((f) => f.id === 'f/L3');
  const step = L3.graph.nodes[4].id;
  const mid = { kind: 'step', flow: 'f/L3', step };
  const midItems = LP.routeItems(LP.classState(world, lines, settings, LP.knownFrom(world, lines, mid)), lines, mid, 'cagrua');
  check('start mid-path: that path from that step comes first, and only once', [midItems[0].kind, midItems[0].flow, midItems[0].start?.step, flowsOf(midItems).filter((f) => f === 'f/L3').length], ['path', 'f/L3', step, 1]);
}

/* -- 3. Ändern ------------------------------------------------------------------------------------------------------------------- */
const cls0 = LP.classState(world, lines, settings, new Set());
const base = LP.routeItems(cls0, lines, HOME, 'domkos');
{
  const first = base[0].key;
  const skipped = LP.setSkip(base, first, true);
  check('skip: the item stays (to take back), marked as left out', [skipped.length, skipped[0].skip, LP.setSkip(skipped, first, false)[0].skip], [base.length, true, false]);
  const extra = LP.towerItem('savio', true);
  const added = LP.addItems(base, [extra, extra, LP.towerItem(towersOf(base)[0])]);
  check('add: a new item at the end, marked as added; what is already there (or twice in the request) is not added again', [added.length, added.at(-1).key, added.at(-1).added], [base.length + 1, 't:savio', true]);
  const placed = LP.addItems(base, [LP.towerItem('savio')], first);
  check('add after an item: right behind it', placed[1].key, 't:savio');
  const moved = LP.moveItem(added, 't:savio', -2);
  check('move: two places up (and not beyond the edges)', [moved.findIndex((i) => i.key === 't:savio'), LP.moveItem(added, added[0].key, -5)[0].key], [added.length - 3, added[0].key]);
  check('remove: only what was added (the computed route can only be left out)', [LP.removeItem(added, 't:savio').length, LP.removeItem(added, first).length], [base.length, added.length]);
  check('path + tower: per tower, only towers', [LP.setAsk(base, `t:${towersOf(base)[0]}`, true).find((i) => i.kind === 'tower').ask, LP.setAsk(base, first, true)[0].ask ?? null], [true, null]);
}

/* -- 4. Warnungen ---------------------------------------------------------------------------------------------------------------- */
{
  check('warnings: the computed route has none', LP.planWarnings(world, base), []);
  const last = base.at(-1).key;
  const early = LP.moveItem(base, last, -base.length);
  const w = LP.planWarnings(world, early);
  check('warnings: the target moved to the front stands before what it needs (but stays there: no ban)', [w.length > 0, w.every((x) => x.key === last), early[0].key], [true, true, last]);
  const needed = w[0].needs;
  check('warnings: not when what it needs is left out (only live items count) …', LP.planWarnings(world, early.map((i) => (i.kind !== 'path' && i.key !== last && (i.place === needed) ? { ...i, skip: true } : i.kind === 'path' && i.to === needed ? { ...i, skip: true } : i))).some((x) => x.needs === needed), false);
  check('… and not when the class knows it from the start', LP.planWarnings(world, early, new Set([...world.places.keys()])).length, 0);
}

/* -- 5. Die Teile der Stunde ----------------------------------------------------------------------------------------------------- */
{
  const tower = towersOf(base)[0];
  const asked = LP.setAsk(base, `t:${tower}`, true);
  const parts = LP.lessonPartsOf(asked, (p) => world.places.get(p).cards);
  const flowParts = parts.filter(LT.isFlowPart);
  const qParts = parts.filter((p) => !LT.isFlowPart(p));
  check('parts: each path a story (with its start step), each path + tower its questions; path only plays nothing of its own', [flowParts.map((p) => p.flow), qParts.map((p) => p.tower)], [flowsOf(base), [tower]]);
  check('parts: the questions of a tower are its cards, at most 12', [qParts[0].questions.length, qParts[0].questions.every((k) => world.places.get(tower).cards.includes(k))], [Math.min(12, world.places.get(tower).cards.length), true]);
  const big = Array.from({ length: 30 }, (_, i) => `k${i}`);
  check('parts: a large tower is cut to 12 questions', LP.lessonPartsOf([LP.towerItem('x', true)], () => big)[0].questions.length, LP.TOWER_QUESTIONS_MAX);
  check('parts: what is left out is not played', LP.lessonPartsOf(LP.setSkip(asked, base[0].key, true), (p) => world.places.get(p).cards).length, parts.length - 1);
}

/* -- 6. Ein Weg zu einer Frage ---------------------------------------------------------------------------------------------------- */
{
  const WHY = P.readPath('p/why', { name: 'Dlaczego?', steps: [{ place: 's1854' }], check: { questions: ['q/s1854/0'] }, anchors: ['home'] });
  const more = LP.questionPathItems(cls0, lines, WHY, base, ['card-a', 'card-b']);
  check('question path: its guided way as items (added), what the plan already has is not doubled, then its closing questions', [more.every((i) => i.added), more.some((i) => base.some((b) => b.key === i.key)), more.at(-1).kind, more.at(-1).cards], [true, false, 'check', ['card-a', 'card-b']]);
  check('question path: the closing questions become a part of their own', LP.lessonPartsOf([more.at(-1)], () => [])[0].questions, ['card-a', 'card-b']);
}

/* -- 7. Gespeichert und wieder gelesen ---------------------------------------------------------------------------------------- */
{
  const doc = { v: 1, start: { kind: 'place', place: 'narodz' }, target: 'domkos', items: [...LP.setSkip(base, base[0].key, true), LP.towerItem('savio', true, true)] };
  const back = LP.readPlanDoc(JSON.parse(JSON.stringify(doc)));
  check('plan: read back as written (start, target, items with skip, ask, added)', back, doc);
  check('plan: unreadable parts fall away, a missing target is no plan', [LP.readPlanDoc({ target: 'x', items: [{ kind: 'nope' }, 7, { kind: 'tower', place: 'a' }] }).items.length, LP.readPlanDoc({ items: [] })], [1, null]);
  const cfg = LT.readLessonConfig({ title: 'L', parts: [{ flow: 'f/L1' }, { questions: ['a', 'b', 7] , tower: 'x' }, { questions: [] }], plan: doc, showVotes: 'live' });
  check('config: story parts and question parts; an empty question part falls away; the plan travels along unread', [cfg.parts.length, cfg.parts[1].questions, cfg.parts[1].tower, LP.readPlanDoc(cfg.plan)?.target], [2, ['a', 'b'], 'x', 'domkos']);
  const row = (kind, joinCode, joinable, state) => ({ kind, joinCode, joinable, state });
  check('a saved plan is a lesson without code and link that does not run; a running lesson (with code) never counts as a plan',
    [API.isPlanSession(row('lesson', null, false, 'paused')), API.isPlanSession(row('lesson', 'AB12CD', true, 'paused')), API.isPlanSession(row('lesson', null, false, 'running')), API.isPlanSession(row('task', null, false, 'paused'))],
    [true, false, false, false]);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
