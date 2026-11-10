/**
 * 2026-11-10 — DIE WELTKARTE AUF WELTEN VERSCHIEDENER GESTALT (Eigentümer: „implementiere die allgemeinen Regeln, nicht mein
 * Beispiel — prüfe auf erzeugten Welten: eine Kette, eine Gabelung, mehrere Gabelungen hintereinander, ein Tor mit einem oder
 * mehreren verlangten Türmen, ein Abstecher, ganz ohne Gabelung"). Geprüft wird auf den Daten der Karte (`linesOf`, `plan`,
 * `sceneOf`), nicht auf Bildpunkten. Die Welten baut `scripts/wmShapes.mjs`.
 *
 *   node scripts/app-wm-shapes-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('en');
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { shapes } from './wmShapes.mjs';

const workspace = await mkdtemp(join(tmpdir(), 'app-wm-shapes-'));
const entries = {
  graph: 'src/app/cogita/worldmap/wmGraph.ts', lines: 'src/app/cogita/worldmap/wmLines.ts', state: 'src/app/cogita/worldmap/wmState.ts',
  plan: 'src/app/cogita/worldmap/wmPlan.ts', fx: 'src/app/cogita/worldmap/wmFixtures.ts', types: 'src/app/cogita/worldmap/wmTypes.ts',
  geo: 'src/app/cogita/worldmap/wmGeometry.ts', scene: 'src/app/cogita/worldmap/wmScene.ts', colors: 'src/app/cogita/worldmap/wmColors.ts',
  nav: 'src/app/cogita/worldmap/wmNav.ts', panels: 'src/app/cogita/worldmap/WorldPanels.tsx', runs: 'src/app/cogita/worldmap/wmRuns.ts'
};
await build({
  entryPoints: entries, bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' },
  jsx: 'automatic', define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [G, L, S, P, F, T, GEO, SC, C, N, PN, R] = await Promise.all(Object.keys(entries).map(load));

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};
const SH = shapes(F);

/** Eine Welt lesen, ihre Linien, einen Stand (ein Lernender), die Gestalt und die Szene. */
function open(made, learner = F.fakeLearner({}), levels = 1) {
  const input = made.input ?? made;
  const world = G.readWorld(input);
  const lines = L.linesOf(world, input.flows);
  const state = S.stateOf(world, lines, learner, { levels, knownShare: 1 });
  const g = GEO.geometryOf(GEO.geometryInputOf(world, lines));
  const scene = SC.sceneOf(world, lines, state, g, { placeColour: () => [0.5, 0.5, 0.5], lineColour: C.lineColours(lines, 'light'), fallback: [0.5, 0.5, 0.5] });
  return { input, world, lines, state, g, scene, made };
}
const secOf = (w, from, to) => [...w.lines.sections.values()].filter((s) => s.from === from && s.to === to);
const junctionOf = (w, step) => [...w.lines.junctions.values()].find((j) => j.step === step);
/** Der Weg ist zusammenhängend: jede Spur beginnt oder endet an einem schon erreichten Knoten (am Anfang das Haus). */
const gaps = (lines, route) => {
  const reached = new Set([T.HOME]);
  let n = 0;
  for (const id of route) { const s = lines.sections.get(id); if (reached.has(s.from) || reached.has(s.to)) { reached.add(s.from); reached.add(s.to); } else n += 1; }
  return n;
};
/** Jede Spur der Szene trägt je Folie und je Frage einen Punkt (Fragen anders). */
const dotsMatch = (w) => w.scene.lanes.every((l) => {
  const s = w.lines.sections.get(l.section);
  return l.marks.length === s.steps.length && l.marks.filter((m) => m === 'question').length === s.questions.length;
});

/* -- Eine Kette, ganz ohne Gabelung ------------------------------------------------------------------------------------------ */
{
  const w = open(SH.chain());
  check('chain: one track per leg — Home → A → B → C', [...w.lines.sections.values()].map((s) => [s.from, s.to]), [[T.HOME, 'A'], ['A', 'B'], ['B', 'C']]);
  check('chain: no fork nodes', w.lines.junctions.size, 0);
  check('chain: a slide between towers lies on the track between them (A → B: 1 path slide + B)', secOf(w, 'A', 'B')[0].slides, 4);
  check('chain: every slide and question is a dot on its track (questions marked as such)', dotsMatch(w), true);
  const pl = P.plan(w.state, 'C');
  check('chain: "take me there" goes along the chain, conquering each tower', pl.steps.map((s) => `${s.kind}:${s.place}`), ['travel:A', 'run:A', 'travel:B', 'run:B', 'travel:C', 'run:C']);
  check('chain: the route is continuous', gaps(w.lines, pl.route), 0);
}

/* -- Ganz ohne Gabelung: zwei Erzählungen, die zweite beginnt am Ende der ersten -------------------------------------------- */
{
  const w = open(SH.plain());
  check('plain: no forks, two tracks (the second starts at the tower its unit requires)', [w.lines.junctions.size, [...w.lines.sections.values()].map((s) => [s.from, s.to])], [0, [[T.HOME, 'A'], ['A', 'B']]]);
  check('plain: every slide and question is a dot', dotsMatch(w), true);
}

/* -- Eine Gabelung ------------------------------------------------------------------------------------------------------------- */
{
  const made = SH.fork();
  const w = open(made);
  const J = junctionOf(w, made.choice);
  check('fork: the choice is a node of its own, not a tower', [J?.kind, w.world.places.has(J?.id), J?.from], ['fork', false, 'A']);
  check('fork: the path slides before it lie on the track from the tower to the node', [secOf(w, 'A', J.id).map((s) => s.slides), J.before.slides], [[2], 2]);
  check('fork: one track from the node to each branch\'s tower', J.out.map((id) => w.lines.sections.get(id).to).sort(), ['B', 'C']);
  check('fork: every branch is a track with its dots', dotsMatch(w) && w.scene.lanes.filter((l) => l.fromId === J.id).every((l) => l.marks.length > 0), true);
  check('fork: the scene has the node with its ways and the slides before it', w.scene.junctions.map((j) => [j.kind, j.ways.length, j.before.slides]), [['fork', 2, 2]]);
  check('fork: the node describes itself ("2 slides, then fork: 2 ways")', PN.junctionText(J.id, { t: (k, p) => `${k}:${p?.count ?? ''}`, state: w.state }), 'cogitaWorld.map.junctionBefore:2 cogitaWorld.map.junctionWays:2');
  const pl = P.plan(w.state, 'C');
  check('fork: the route passes the fork node (tower → node → branch), no jumps', [pl.route.map((id) => [w.lines.sections.get(id).from, w.lines.sections.get(id).to]), gaps(w.lines, pl.route)], [[[T.HOME, 'A'], ['A', J.id], [J.id, 'C']], 0]);
  /* Gefahrene Spuren bleiben im Weg (billiger), sind aber keine Teile mehr. */
  const first = w.lines.sections.get(pl.route[0]);
  const w2 = open(made, F.fakeLearner({ progress: { 'f/1': { visited: [...first.steps] } } }));
  const pl2 = P.plan(w2.state, 'C');
  check('fork: a travelled track stays in the route but is no part to do', [pl2.route.includes(first.id), pl2.steps.some((s) => s.kind === 'travel' && s.section === first.id)], [true, false]);
}

/* -- Mehrere Gabelungen hintereinander ------------------------------------------------------------------------------------------ */
{
  const made = SH.forks();
  const w = open(made);
  const J1 = junctionOf(w, made.ids.first);
  const J2 = junctionOf(w, made.ids.second);
  check('forks: two fork nodes, the second after B', [J1?.from, J2?.from], ['A', 'B']);
  check('forks: each node has its own ways', [J1.out.map((id) => w.lines.sections.get(id).to).sort(), J2.out.map((id) => w.lines.sections.get(id).to).sort()], [['B', 'C'], ['D', 'E']]);
  const pl = P.plan(w.state, 'E');
  check('forks: the route to E passes both nodes in order, continuous', [pl.route.map((id) => w.lines.sections.get(id).to), gaps(w.lines, pl.route)], [['A', J1.id, 'B', J2.id, 'E'], 0]);
  check('forks: towers are conquered in the order of the way', pl.places, ['A', 'B', 'E']);
}

/* -- Tore: an einem Zweig (ein verlangter Turm), an einer Linie (zwei verlangte Türme) ------------------------------------- */
{
  const made = SH.gates();
  const w = open(made);
  const J = junctionOf(w, made.choice);
  const toB = J.out.map((id) => w.lines.sections.get(id)).find((s) => s.to === 'B');
  check('gate on a branch: the branch to B needs K (its option condition)', toB.ticket.map((p) => [p.source, p.condition.of]), [['option', 'K']]);
  check('gate on a branch: a track runs from K to the fork', w.lines.links.filter((l) => l.section === toB.id).map((l) => [l.from, l.to]), [['K', J.id]]);
  const gate = [...w.lines.junctions.values()].find((j) => j.kind === 'gate');
  check('gate with two required towers: a gate node; the way comes from one, a track from the other', [gate?.from, w.lines.links.filter((l) => l.to === gate?.id).map((l) => l.from)], ['B', ['K']]);
  check('gate: the line\'s ticket stands on the way into the gate', secOf(w, 'B', gate.id)[0].ticket.map((p) => p.condition.of), ['B', 'K']);
  check('gate: the scene draws every gate track', w.scene.links.filter((l) => l.kind === 'gate').map((l) => [l.from, l.to]).sort(), [['K', J.id], ['K', gate.id]].sort());
  check('gate: locked until the required towers are conquered', w.state.sections.get(secOf(w, gate.id, 'Z')[0].id).open, false);
  /* Z verlangt B und K (auch mittelbar A): der Turm erklärt sich selbst. */
  check('locked tower: lists every missing tower, also indirect ones, with open / locked', PN.requiredTowers(w.state, 'Z').map((x) => [x.id, x.state]), [['A', 'open'], ['K', 'open'], ['B', 'locked']]);
  const pl = P.plan(w.state, 'Z');
  check('gate: the plan conquers what the gates need first, in the order of the prerequisites', pl.places, ['A', 'K', 'B', 'Z']);
  check('gate: the whole chain is one continuous route', gaps(w.lines, pl.route), 0);
  /* Ein eroberter Turm fällt weg. */
  const conquered = open(made, F.fakeLearner({ levels: { A: 1, K: 1 } }));
  check('gate: towers already conquered are skipped', P.plan(conquered.state, 'Z').places, ['B', 'Z']);
}

/* -- Voraussetzungen über verschiedene Erzählungen (kein Weg führt direkt zum Ziel) ---------------------------------------- */
{
  const w = open(SH.prerequisites());
  const pl = P.plan(w.state, 'Z');
  check('prerequisites: the route goes to the first missing tower, then the next, then the goal — each along its own story', [pl.places, pl.steps.map((s) => `${s.kind}:${s.place}`)], [['R1', 'R2', 'Z'], ['travel:R1', 'run:R1', 'travel:R2', 'run:R2', 'travel:Z', 'run:Z']]);
  check('prerequisites: continuous, no jumps', gaps(w.lines, pl.route), 0);
  check('prerequisites: a locked tower draws a track from each missing required tower (here: none needed — the stories already lead there)', w.scene.links.filter((l) => l.kind === 'requires').length, 0);
}

/* -- Eine Voraussetzung ohne Weg: als Spur zu ihrem Turm, solange er gesperrt ist ------------------------------------------- */
{
  const w = open(SH.requirement());
  check('requirement: a locked tower draws a track from its missing required tower to itself', w.scene.links.filter((l) => l.kind === 'requires').map((l) => [l.from, l.to, l.met]), [['A', 'M', false]]);
  check('requirement: the tower panel lists it as open', PN.requiredTowers(w.state, 'M').map((x) => [x.id, x.state]), [['A', 'open']]);
  const done = open(SH.requirement(), F.fakeLearner({ levels: { A: 1 } }));
  check('requirement: once conquered, the tower is unlocked and the track goes away', done.scene.links.filter((l) => l.kind === 'requires').length, 0);
  const pl = P.plan(w.state, 'M');
  check('requirement: the plan goes to A first, then to M (no direct connection needed)', [pl.places, gaps(w.lines, pl.route)], [['A', 'M'], 0]);
}

/* -- Ein Abstecher ------------------------------------------------------------------------------------------------------------ */
{
  const made = SH.detour();
  const w = open(made);
  check('detour: a loop at exactly the calling step (after A\'s 3 slides and 3 questions)', w.lines.loops.map((l) => [l.target, w.lines.sections.get(l.section).to, l.at]).sort(), [['f/x', 'A', 6], ['f/y', 'A', 6]]);
  check('detour with its own unit: keeps its own track (from the tower its unit requires)', [w.lines.lines.get('f/y').deepening, secOf(w, 'A', 'Y').length], [false, 1]);
  check('detour without a unit: a deepening entered at its caller', [w.lines.lines.get('f/x').deepening, secOf(w, 'A', 'X').length], [true, 1]);
  check('detour: the scene draws the loops with the steps of the called story', w.scene.loops.map((l) => [l.target, l.marks.length]).sort(), [['f/x', 4], ['f/y', 4]]);
}

/* -- Verpackungen: dieselben Karten in drei Erklärweisen --------------------------------------------------------------------- */
{
  const made = SH.packaging();
  const w = open(made);
  const J = junctionOf(w, made.ids.fork);
  const styles = J.out.map((id) => w.lines.sections.get(id)).filter((s) => s.to === 'P');
  check('packaging: no fork node for the styles — three tracks of the same way, marked as variants', [junctionOf(w, made.ids.packaging), styles.map((s) => s.variant?.index)], [undefined, [0, 1, 2]]);
  check('packaging: each style has its own slides and the shared questions', styles.map((s) => [s.slides, s.questions.length]), [[2, 3], [3, 3], [4, 3]]);
  const lane = w.scene.lanes.filter((l) => l.toId === 'P');
  check('packaging: the map draws one track and the other styles as a small loop', [lane.length, lane[0]?.variants?.more], [1, 2]);
  check('packaging: the fork node counts the way to P once', w.scene.junctions.map((j) => j.ways.map((x) => x.to).sort()), [['P', 'Q']]);
}

/* -- Ein Przegląd: was danach kommt, wird gezeichnet --------------------------------------------------------------------------- */
{
  const w = open(SH.review());
  const J = [...w.lines.junctions.values()][0];
  check('review: the slide and the fork after a review are drawn (not dropped)', [J?.from, J?.before.slides, J?.out.length], ['A', 1, 2]);
}

/* -- Direkt lernen nur, was keine Erzählung erreicht ---------------------------------------------------------------------------- */
{
  const made = SH.chain();
  /* Eine Karte über C ohne Folie und ohne Frage in einer Erzählung. */
  made.entries.push({ id: 'q/C/plain', kinds: ['question'], label: 'C ohne Folie', refs: [{ field: 'about', to: 'C' }] });
  made.cards.push({ key: 'q/C/plain', question: 'q/C/plain', about: ['C'] });
  const w = open(made, F.fakeLearner({}), 0);
  const pl = P.plan(w.state, 'C');
  const learn = pl.steps.filter((s) => s.kind === 'learn');
  check('learn directly: only for cards no story can reach', learn.map((s) => s.cards), [['q/C/plain']]);
  check('learn directly: never instead of an existing story (C is travelled first)', pl.steps.findIndex((s) => s.kind === 'travel' && s.place === 'C') < pl.steps.findIndex((s) => s.kind === 'learn'), true);
}

/* -- Erobern ohne vorher alle Karten gesehen zu haben ------------------------------------------------------------------------- */
{
  const w = open(SH.chain(), F.fakeLearner({}), 3);
  const gate = R.runGate(w.state.ctx, 'A', R.levelOf([], R.defaultRules(3), 3), 3);
  check('conquest: a tower whose cards were never asked can be tried at once', gate, { kind: 'ready', level: 1 });
  const pl = P.plan(w.state, 'A');
  const run = pl.steps.find((s) => s.kind === 'run');
  check('conquest: the tower step says how many cards and what to repeat first', [run.cards, run.prepare.length], [3, 3]);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
