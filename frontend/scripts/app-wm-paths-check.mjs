/**
 * 2026-11-12 (Prompt 25) — WEGE ZU EINER FRAGE (`worldmap/wmPaths.ts`) auf der Bosko-Gestalt und einer erzeugten Welt: Lesen
 * (Formen der Anker, Abschluss höchstens 3 Fragen, "title" = "name"), Stand der Schritte (offen / gesperrt / erledigt), die Spirale
 * (derselbe Ort zweimal, die zweite Runde höher), Stand des Weges (nicht begonnen / unterwegs / erledigt — erst mit Abschluss), der
 * geführte Plan (Bekanntes fällt weg, Erzählungen als Fahrten, Ziel `~path:`), die Länge, die Wegweiser (neben ihrem Anker, mehrere
 * Wege an einer Stelle teilen einen; was nicht auf der Karte ist, bekommt keinen) und die Prüfung (unbekannter Ort, Ablauf, Schritt,
 * Anker, Schleife, unerreichbar, zu viele Fragen). Ein Weg ändert nichts am Stand der Welt.
 *
 *   node scripts/app-wm-paths-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-wm-paths-'));
const entries = {
  graph: 'src/app/cogita/worldmap/wmGraph.ts', lines: 'src/app/cogita/worldmap/wmLines.ts', state: 'src/app/cogita/worldmap/wmState.ts',
  fx: 'src/app/cogita/worldmap/wmFixtures.ts', paths: 'src/app/cogita/worldmap/wmPaths.ts'
};
await build({
  entryPoints: entries, bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' },
  jsx: 'automatic', define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [G, L, S, F, P] = await Promise.all(Object.keys(entries).map(load));
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
const open = ({ levels = {}, progress = {}, settings = { levels: 1, openAt: null } } = {}) =>
  S.stateOf(world, lines, F.fakeLearner({ levels, progress }), { levels: settings.levels, knownShare: 1, openAt: settings.openAt });
const ctxOf = (state, { flowsDone = [], passedChecks = [] } = {}) => ({ state, lines, flowDone: (f) => flowsDone.includes(f), checkPassed: (id) => passedChecks.includes(id) });
const L3 = bosko.input.flows.find((f) => f.id === 'f/L3');
const fromStep = L3.graph.nodes[4].id;

/* Der Weg aus dem Beispiel des Eigentümers: am Gründungsort, die Spirale zurück zu 1854 eine Stufe höher, zwei Abschlussfragen. */
const WHY = P.readPath('p/why', {
  name: 'Dlaczego ksiądz Bosko założył salezjanów?', promise: 'Potem powiesz, dlaczego powstało Zgromadzenie.',
  anchors: ['s1855', 'home', { flow: 'f/L4', step: bosko.fork }, 42],
  steps: [{ place: 's1854', why: 'Tu pada nazwa.' }, { flow: 'f/L3', from: fromStep, why: 'Wątek Zgromadzenia.' }, { place: 's1854', level: 2, why: 'Druga runda: szczegóły.' }],
  check: { questions: ['q/s1854/0', 'q/s1854/1'] }, deeper: 'p/deep'
});
const WHO = P.readPath('p/who', { title: 'Kim był ksiądz Bosko?', anchors: ['home'], steps: [{ place: 'becchi' }, { place: 'sen' }], check: { slide: 's/becchi' } });

/* -- Lesen ---------------------------------------------------------------------------------------------------------------------- */
check('read: the question, the promise, three steps (place, story from a step, the same place one level higher), three anchors (a number is left out), two closing questions, deeper',
  [WHY.title, WHY.steps.map((s) => s.kind), WHY.steps[1].from === fromStep, WHY.steps[2].level, WHY.anchors.map((a) => a.kind), WHY.check, WHY.deeper],
  ['Dlaczego ksiądz Bosko założył salezjanów?', ['place', 'flow', 'place'], true, 2, ['place', 'home', 'track'], { kind: 'questions', questions: ['q/s1854/0', 'q/s1854/1'] }, 'p/deep']);
check('read: "title" is the question when "name" is missing; a closing slide; at most 3 closing questions',
  [WHO.title, WHO.check, P.readPath('x', { check: { questions: ['a', 'b', 'c', 'd'] } }).check.questions.length], ['Kim był ksiądz Bosko?', { kind: 'slide', slide: 's/becchi' }, 3]);

/* -- Stand der Schritte und des Weges --------------------------------------------------------------------------------------------- */
{
  const fresh = ctxOf(open());
  check('a new learner: becchi is open (nothing before it), 1854 is locked (its base is missing); the path is not started',
    [P.stepState(fresh, WHO.steps[0]), P.stepState(fresh, WHY.steps[0]), P.pathStatus(fresh, WHO), P.pathStatus(fresh, WHY)], ['open', 'locked', 'new', 'new']);
  const one = ctxOf(open({ levels: { becchi: 1 } }));
  check('one step done → on the way; the next step (sen) is now open', [P.stepState(one, WHO.steps[0]), P.stepState(one, WHO.steps[1]), P.pathStatus(one, WHO)], ['done', 'open', 'going']);
  const both = ctxOf(open({ levels: { becchi: 1, sen: 1 } }));
  check('all steps done but the closing check not passed: still on the way (the check is next); passed: done',
    [P.stepsDone(both, WHO), P.pathStatus(both, WHO), P.pathStatus(ctxOf(both.state, { passedChecks: ['p/who'] }), WHO)], [true, 'going', 'done']);
  const noCheck = { ...WHO, id: 'p/nc', check: null };
  check('without a closing check a path is done when its steps are done', P.pathStatus(both, noCheck), 'done');
  check('a story step is done when the story is done', [P.stepState(ctxOf(open(), { flowsDone: ['f/L3'] }), WHY.steps[1])], ['done']);
}

/* -- Die Spirale -------------------------------------------------------------------------------------------------------------------- */
{
  const base = ['becchi', 'sen', 'antoni', 'przyj', 'semch', 'swiec', 'konwikt', 'narodz', 'wedr', 'choroba', 'domkos', 'warsz', 'cagrua'];
  const lv = (n) => Object.fromEntries([...base.map((id) => [id, 2]), ['s1854', n]]);
  const two = { levels: 2, openAt: 1 };
  const atOne = ctxOf(open({ levels: lv(1), settings: two }));
  check('spiral: 1854 at level 1 — the first lap is done, the second (level 2) is not', [P.stepState(atOne, WHY.steps[0]), P.stepState(atOne, WHY.steps[2])], ['done', 'open']);
  const plan = P.pathPlan(atOne, WHY);
  check('… the guided plan asks for a run at 1854 for the second lap (and the story before it)', [plan.steps.some((s) => s.kind === 'run' && s.place === 's1854'), plan.steps.some((s) => s.kind === 'travel'), plan.target], [true, true, '~path:p/why']);
  const atTwo = ctxOf(open({ levels: lv(2), settings: two }));
  check('… at level 2 both laps are done', [P.stepState(atTwo, WHY.steps[0]), P.stepState(atTwo, WHY.steps[2])], ['done', 'done']);
}

/* -- Der geführte Plan ------------------------------------------------------------------------------------------------------------- */
{
  const fresh = ctxOf(open());
  const plan = P.pathPlan(fresh, WHO);
  check('guided: a plan with target ~path:<id>; its first step is at becchi; sen comes later', [plan.target, plan.steps[0].place, plan.steps.some((s) => s.place === 'sen')], ['~path:p/who', 'becchi', true]);
  const known = P.pathPlan(ctxOf(open({ levels: { becchi: 1 } })), WHO);
  check('guided: what is already known is left out (becchi conquered → nothing at becchi)', known.steps.some((s) => s.place === 'becchi' && s.kind !== 'travel'), false);
  check('guided: all steps done → nothing left (then the closing check)', P.pathPlan(ctxOf(open({ levels: { becchi: 1, sen: 1 } })), WHO).steps.length, 0);
  const story = P.pathPlan(fresh, { ...WHY, steps: [WHY.steps[1]] });
  const secs = P.flowSections(lines, 'f/L3', fromStep);
  check('guided: a story step travels its sections from "from" on (in order), after the way to its start',
    [secs.length > 0, secs.length < P.flowSections(lines, 'f/L3').length, story.steps.filter((s) => s.kind === 'travel' && secs.includes(s.section)).map((s) => s.section)], [true, true, secs]);
  /* Ein Weg ändert nichts: derselbe Stand mit und ohne ihn. */
  const a = open({ levels: { becchi: 1 } });
  P.pathPlan(ctxOf(a), WHY);
  const b = open({ levels: { becchi: 1 } });
  check('an offer: planning a path changes nothing in the state of the world (heights, levels, open ways)',
    [...a.places].map(([id, ps]) => [id, ps.level, ps.height, ps.passable]), [...b.places].map(([id, ps]) => [id, ps.level, ps.height, ps.passable]));
  const len = P.pathLength(fresh.state, lines, WHY);
  check('length: slides and questions of its stories, cards of its places (a place twice counts once), plus the closing questions',
    [len.slides > 0, len.questions >= 2, len.cards === (world.places.get('s1854')?.cards.length ?? -1)], [true, true, true]);
}

/* -- Wegweiser ------------------------------------------------------------------------------------------------------------------- */
{
  const jn = [...lines.junctions.values()].find((j) => j.line === 'f/L4' && j.step === bosko.fork);
  const scene = {
    home: { x: 0, y: 0, r: 20 }, byId: new Map([['s1855', { id: 's1855', x: 100, y: 50, r: 28 }], ['becchi', { id: 'becchi', x: -50, y: 10, r: 28 }]]),
    junctions: jn === undefined ? [] : [{ id: jn.id, x: 300, y: 300, r: 6 }], lanes: []
  };
  const signs = P.signsOf([WHY, WHO, P.readPath('p/off', { name: 'x', anchors: ['nowhere'], steps: [{ place: 'becchi' }] })], scene, lines);
  const at = (k) => signs.find((s) => s.key === k);
  check('signs: one at home with both paths, one next to 1855 (right of the pillar), one at the fork node; an anchor not on the map gets none',
    [at('home')?.paths, at('p:s1855')?.paths, at('p:s1855').x > 100 && Math.hypot(at('p:s1855').x - 100, at('p:s1855').y - 50) < 60, jn !== undefined && at(`t:f/L4#${bosko.fork}`)?.paths.join(), signs.some((s) => s.key === 'p:nowhere')],
    [['p/why', 'p/who'], ['p/why'], true, 'p/why', false]);
}

/* -- Prüfung -------------------------------------------------------------------------------------------------------------------- */
{
  const flowSteps = (id) => { const f = bosko.input.flows.find((x) => x.id === id); return f === undefined ? undefined : new Set(f.graph.nodes.map((n) => n.id)); };
  const known = new Map([['p/why', WHY], ['p/who', WHO]]);
  const cctx = { entity: (id) => world.entries.has(id) || world.places.has(id) || id.startsWith('q/') || id === 's/becchi', flowSteps, path: (id) => known.get(id), onMap: { place: (id) => world.places.has(id), flow: (id) => lines.lines.has(id) } };
  const keys = (raw) => P.pathProblems(P.readPath('p/t', raw), raw, cctx).map((p) => p.key);
  check('check: a good path has no problems (deeper to an existing path)', P.pathProblems({ ...WHY, deeper: 'p/who' }, {}, cctx).map((p) => p.key), []);
  check('check: unknown place, unknown story, a "from" the story does not have, an anchor that does not exist, a malformed anchor',
    keys({ name: 'x', anchors: ['nope', { flow: 'f/L4', step: 'nope' }, 7], steps: [{ place: 'nope' }, { flow: 'f/none' }, { flow: 'f/L3', from: 'nope' }] }),
    ['qpathPlace', 'qpathFlow', 'qpathFrom', 'qpathAnchor', 'qpathAnchor', 'qpathAnchorShape']);
  check('check: a loop — "deeper" back to itself or over another path; the same step twice in a row',
    [keys({ name: 'x', steps: [{ place: 'becchi' }], deeper: 'p/t' }), P.pathProblems({ ...WHO, deeper: 'p/why' }, {}, { ...cctx, path: (id) => (id === 'p/why' ? { ...WHY, deeper: 'p/who' } : known.get(id)) }).map((p) => p.key), keys({ name: 'x', steps: [{ place: 'becchi' }, { place: 'becchi' }] })],
    [['qpathDeeper'], ['qpathLoop'], ['qpathRepeat']]);
  check('check: a step that cannot be reached (an entry that is not on the world map), too many closing questions, no question, no steps',
    [keys({ name: 'x', steps: [{ place: 'q/becchi/0' }] }), keys({ name: 'x', steps: [{ place: 'becchi' }], check: { questions: ['q/a/0', 'q/a/1', 'q/a/2', 'q/a/3'] } }), keys({})],
    [['qpathUnreachable'], ['qpathCheckMany'], ['qpathNoTitle', 'qpathNoSteps']]);
}

/* -- Eine erzeugte Welt: jeder Ort als Weg — der Plan endet immer, nichts doppelt -------------------------------------------------- */
{
  const input = F.generatedWorld({ places: 60, stories: 5, seed: 7 });
  const w = G.readWorld(input);
  const ln = L.linesOf(w, input.flows);
  const st = S.stateOf(w, ln, F.fakeLearner({}), { levels: 1, knownShare: 1, openAt: null });
  const ctx = { state: st, lines: ln, flowDone: () => false, checkPassed: () => false };
  let bad = 0;
  for (const id of w.order) {
    const plan = P.pathPlan(ctx, P.readPath('g', { name: 'g', steps: [{ place: id }, ...input.flows.slice(0, 1).map((f) => ({ flow: f.id }))] }));
    const keysOf = plan.steps.map((s) => `${s.kind}:${s.section ?? s.place}:${s.level ?? ''}`);
    if (new Set(keysOf).size !== keysOf.length) bad += 1;
  }
  check('generated world: a path to any place plus a story plans without a repeated step', bad, 0);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
