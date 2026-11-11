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
  nav: 'src/app/cogita/worldmap/wmNav.ts', panels: 'src/app/cogita/worldmap/WorldPanels.tsx', runs: 'src/app/cogita/worldmap/wmRuns.ts',
  focus: 'src/app/cogita/worldmap/wmFocus.ts', pillars: 'src/app/cogita/worldmap/WorldPillars.tsx'
};
await build({
  entryPoints: entries, bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' },
  jsx: 'automatic', define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [G, L, S, P, F, T, GEO, SC, C, N, PN, R, FO, WP] = await Promise.all(Object.keys(entries).map(load));

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
  /* 2026-11-10 (Eigentümer): gezeichnet nur, wenn ein Ziel gewählt ist, auf dessen Weg das Tor liegt; sonst ein Schloss am Zweig. */
  check('gate: the scene keeps every gate track (drawn when a goal on its way is chosen)', w.scene.links.filter((l) => l.kind === 'gate').map((l) => [l.from, l.to]).sort(), [['K', J.id], ['K', gate.id]].sort());
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

/* -- 2026-11-10 (Eigentümer, Teil 3): Lage der Gabelungen, Richtung, der Blick auf ein Ziel, nur was das Ziel braucht, der geführte Weg -- */
{
  /* Die Lage jeder Gabelung: nah am Ausgang, zwischen ihm und den Zielen der Zweige, nicht auf einem anderen Turm. */
  const placement = [];
  for (const name of ['fork', 'forks', 'gates', 'packaging', 'review', 'rejoin']) {
    const w = open(SH[name]());
    for (const j of w.lines.junctions.values()) {
      if (j.kind !== 'fork') continue;
      const pj = w.g.positions[j.id], po = w.g.positions[j.from];
      const targets = j.out.map((id) => w.g.positions[w.lines.sections.get(id).to]).filter(Boolean);
      const near = Math.min(...targets.map((p) => Math.hypot(p[0] - po[0], p[1] - po[1])));
      const cx = targets.reduce((a, p) => a + p[0], 0) / targets.length, cy = targets.reduce((a, p) => a + p[1], 0) / targets.length;
      const dj = Math.hypot(pj[0] - po[0], pj[1] - po[1]);
      const cos = ((pj[0] - po[0]) * (cx - po[0]) + (pj[1] - po[1]) * (cy - po[1])) / Math.max(1e-9, dj * Math.hypot(cx - po[0], cy - po[1]));
      const clear = Object.keys(w.g.nodes).filter((id) => id !== j.id && id !== j.from && !T.isJunction(id)).every((id) => Math.hypot(w.g.positions[id][0] - pj[0], w.g.positions[id][1] - pj[1]) >= w.g.radii[id] + 6);
      placement.push({ name, close: dj < near, between: cos > Math.cos(Math.PI / 3), clear });
    }
  }
  check('fork position: every fork lies closer to its origin than any branch target, towards the targets, clear of other towers', placement.filter((x) => !x.close || !x.between || !x.clear), []);
  check('fork position: checked on every generated world with forks', placement.length >= 6, true);

  /*
    Die Richtung jeder Spur: sie läuft vom Ausgang zum Ziel. 2026-11-10 — gemessen entlang der Achse Ausgang → Ziel (eine Gabelung
    liegt jetzt dicht am Rand ihres Turms: der erste Punkt am Rand kann der Gabelung näher sein als der Mitte des Turms).
  */
  const w = open(SH.forks());
  const wrong = w.scene.lanes.filter((l) => {
    const p = l.points; const a = [p[0], p[1]], b = [p[p.length - 2], p[p.length - 1]];
    const ax = [l.to[0] - l.from[0], l.to[1] - l.from[1]];
    const along = (x) => (x[0] - l.from[0]) * ax[0] + (x[1] - l.from[1]) * ax[1];
    return !(along(a) < along(b));
  });
  check('direction: every track runs from its origin to its target (the drawn arrow points that way)', wrong.map((l) => l.section), []);

  /* Ein gewähltes Ziel: was erledigt ist, was offen ist, was grau wird. */
  const made = SH.fork();
  const first = open(made).lines;
  const homeA = [...first.sections.values()].find((x) => x.from === T.HOME);
  const wf = open(made, F.fakeLearner({ progress: { 'f/1': { visited: [...homeA.steps] } }, levels: { A: 1 } }));
  const plan = P.plan(wf.state, 'C');
  const focus = FO.routeFocus(plan, wf.state, wf.lines);
  const J = junctionOf(wf, made.choice);
  check('focus: the way to the goal — done (thin, muted) and remaining (prominent) tracks', [[...focus.done].map((id) => wf.lines.sections.get(id).to), [...focus.remaining].map((id) => wf.lines.sections.get(id).to)], [['A'], [J.id, 'C']]);
  check('focus: the missing towers and the goal are shown; the tower already passed too', [[...focus.missing], [...focus.passed]], [['C'], ['A']]);
  check('focus: everything else is grey (the other branch and its tower)', [FO.greyPlace(focus, 'B'), FO.greySection(focus, J.out.find((id) => wf.lines.sections.get(id).to === 'B')), FO.greyPlace(focus, 'C'), FO.greySection(focus, homeA.id)], [true, true, false, false]);
  check('focus: the fork node is on the way', [...focus.nodes], [J.id]);
  const wg = open(SH.gates());
  const fg = FO.routeFocus(P.plan(wg.state, 'Z'), wg.state, wg.lines);
  check('focus: the gates on the way are shown (tracks from required towers to the gate)', [...fg.gates].filter((id) => !id.startsWith('requires:')).sort(), wg.lines.links.map((l) => l.id).sort());

  /* Der Plan enthält nur, was das Ziel braucht. */
  const wa = open(SH.alternative());
  const pa = P.plan(wa.state, 'Z');
  check('plan: only what the goal needs — the way over its prerequisite, not over a tower it does not require', [pa.places, pa.route.some((id) => wa.lines.sections.get(id).from === 'U' || wa.lines.sections.get(id).to === 'U')], [['P', 'Z'], false]);
  const wr = open(SH.rejoin().input);
  const pr = P.plan(wr.state, 'M');
  const branches = pr.route.filter((id) => T.isJunction(wr.lines.sections.get(id).from)).map((id) => wr.lines.sections.get(id).to);
  check('plan: of a fork whose branches meet again, only the branch towards the goal (M needs X)', [pr.places, [...new Set(branches)]], [['A', 'X', 'M'], ['X']]);
  check('plan: missing prerequisites in learning order, also indirect ones', PN.requiredTowers(wr.state, 'M').map((x) => x.id), ['A', 'X']);

  /* Der geführte Weg endet erst am Ziel: nach jedem Teil geht er weiter, bis das Ziel erobert ist. */
  const chain = SH.chain();
  const wc0 = open(chain);
  const secs = [...wc0.lines.sections.values()];
  const visited = [];
  const levels = {};
  let tt = N.followPlan(null, P.plan(wc0.state, 'C'));
  const stops = [];
  for (let guard = 0; guard < 12 && tt.upcoming.length > 0; guard += 1) {
    const step = tt.upcoming[0];
    if (step.kind === 'travel') visited.push(...secs.find((x) => x.id === step.section).steps);
    if (step.kind === 'run') levels[step.place] = 1;
    const wc = open(chain, F.fakeLearner({ progress: { 'f/1': { visited: [...visited] } }, levels }));
    tt = N.followPlan(tt, P.plan(wc.state, 'C'));
    stops.push(`${step.kind}:${step.place}`);
    if (tt.upcoming.length === 0) check('guided flow: it ends exactly when the goal is conquered', wc.state.places.get('C').conquered, true);
  }
  check('guided flow: every part in order, nothing skipped, then the end', [stops, tt.upcoming.length, tt.done.length], [['travel:A', 'run:A', 'travel:B', 'run:B', 'travel:C', 'run:C'], 0, 6]);
}

/* -- 2026-11-10 (Eigentümer, Teil 4): Scheiben, drei Stricharten, Lage der Gabelung, ein gewähltes Ziel, der geführte Weg ------ */

/* §1 Scheiben: jede fehlende Voraussetzung (auch mittelbar) einmal; unten, was zuerst kommt; oben eine unmittelbare. */
{
  const w = open(SH.gates());
  const z = w.scene.byId.get('Z');
  check('discs: one per missing prerequisite, indirect ones too, each once (Z needs B and K, B needs A)', z.discs, ['A', 'K', 'B']);
  check('discs: the bottom disc is what comes first; the top disc is a direct prerequisite', [w.world.places.get('A').needs.length, w.world.places.get('Z').needs.includes(z.discs[z.discs.length - 1])], [0, true]);
  check('discs: a tower with no missing prerequisite stands on none (ready)', [w.scene.byId.get('A').discs, w.scene.byId.get('K').discs], [[], []]);
  const later = open(SH.gates(), F.fakeLearner({ levels: { A: 1 } }));
  check('discs: a conquered tower leaves the discs of every tower that needs it (the towers get lower)', [later.scene.byId.get('Z').discs, later.scene.byId.get('B').discs, later.scene.byId.get('A').discs], [['K', 'B'], [], []]);
  const all = open(SH.gates(), F.fakeLearner({ levels: { A: 1, K: 1, B: 1 } }));
  check('discs: when every prerequisite is conquered, no disc is left — the same rule as the gates (conquered = the levels setting)', [all.scene.byId.get('Z').discs, all.state.sections.get(secOf(all, [...all.lines.junctions.values()].find((j) => j.kind === 'gate').id, 'Z')[0].id).open], [[], true]);
  check('discs: positions stay the same for every learner (only heights change)', JSON.stringify(w.g.positions) === JSON.stringify(later.g.positions), true);
  const d = { id: 'Z', x: 0, base: 100, rx: 20, ry: 10, step: 8, n: 3 };
  check('discs: a click on the side finds its disc (bottom 0, then up), above the stack none', [WP.discAt(d, 0, 106), WP.discAt(d, 0, 98), WP.discAt(d, 5, 92), WP.discAt(d, 0, 80), WP.discAt(d, 30, 106)], [0, 1, 2, -1, -1]);
  const fake = { measureText: (s) => ({ width: s.length * 6 }) };
  check('labels: a long name wraps onto lines (the last one cut with "…")', [WP.wrapText(fake, 'Freier Fall im Vakuum', 70, 3), WP.wrapText(fake, 'Ein sehr langer Name eines Turmes', 60, 2)], [['Freier Fall', 'im Vakuum'], ['Ein sehr', 'langer Na…']]);
}

/* §2 Pfade: keine Farbe je Erzählung; dick = gegangen, dünn = nichts Neues, gestrichelt = Neues (dichter, je weniger neu). */
{
  const made = SH.fork();
  const w0 = open(made);
  const homeA = [...w0.lines.sections.values()].find((s) => s.from === T.HOME);
  const toB = w0.scene.lanes.find((l) => l.toId === 'B');
  check('paths: a path that brings new cards is dashed', [toB.style, toB.fresh, SC.laneStroke(toB, null).dash.length > 0], ['new', 1, true]);
  const walked = open(made, F.fakeLearner({ progress: { 'f/1': { visited: [...homeA.steps] } } }));
  const wa = walked.scene.lanes.find((l) => l.section === homeA.id);
  check('paths: a walked path is thick and solid', [wa.style, SC.laneStroke(wa, null).dash, SC.laneStroke(wa, null).width > SC.laneStroke(toB, null).width], ['walked', [], true]);
  const knowAll = Object.fromEntries(w0.world.places.get('B').cards.map((k) => [k, 2]));
  const wk = open(made, F.fakeLearner({ knowness: knowAll, levels: { A: 1 } }));
  const known = wk.scene.lanes.find((l) => l.toId === 'B');
  const fresh = wk.scene.lanes.find((l) => l.toId === 'C');
  check('paths: walkable but nothing new (its cards are known from elsewhere): thin and solid — thinner than an open path with new cards', [known.style, SC.laneStroke(known, null).dash, fresh.style, SC.laneStroke(known, null).width < SC.laneStroke(fresh, null).width], ['known', [], 'new', true]);
  const part = open(made, F.fakeLearner({ knowness: { [w0.world.places.get('B').cards[0]]: 2 } })).scene.lanes.find((l) => l.toId === 'B');
  const period = (l) => SC.laneStroke(l, null).dash.reduce((a, b) => a + b, 0);
  check('paths: partly known — still dashed, the dashes denser the fewer cards are new', [part.style, Math.round(part.fresh * 100), period(part) < period(toB)], ['new', 67, true]);
  check('paths: no colour per story — the stroke depends only on the state', SC.laneStroke({ ...toB, color: [255, 0, 0] }, null), SC.laneStroke({ ...toB, color: [0, 0, 255] }, null));
  check('paths: not chosen → no dots; chosen → a dot per slide and question (questions another shape)', [SC.laneStroke(toB, null).dots, SC.laneStroke(toB, null, new Set([toB.section])).dots, toB.marks.filter((m) => m === 'question').length], [false, true, 3]);
  check('paths: direction data — every track from its origin to its target', w0.scene.lanes.every((l) => l.points.length >= 4), true);
  const J = junctionOf(w0, made.choice);
  check('paths: the branches of a fork are named by their destination, not by the story', w0.scene.lanes.filter((l) => l.fromId === J.id).map((l) => l.name).sort(), ['Turm B', 'Turm C']);
  const g = open(SH.gates());
  const branchB = g.scene.lanes.find((l) => l.toId === 'B');
  check('paths: a branch with its own condition carries a lock with the required tower; gone once it is conquered', [branchB.requires, open(SH.gates(), F.fakeLearner({ levels: { K: 1 } })).scene.lanes.find((l) => l.toId === 'B').requires], [['K'], []]);
}

/* §3 Gabelungen: zwischen Ausgang und Zielen; der Abstand wächst mit den Folien davor, in den Grenzen 10 %–45 %. */
{
  const share = (made) => {
    const w = open(made);
    const j = [...w.lines.junctions.values()].find((x) => x.kind === 'fork');
    const po = w.g.positions[j.from], pj = w.g.positions[j.id];
    let near = Infinity, rn = 0;
    for (const id of j.out) { const t = w.lines.sections.get(id).to; const p = w.g.positions[t]; const d = Math.hypot(p[0] - po[0], p[1] - po[1]); if (d < near) { near = d; rn = w.g.radii[t]; } }
    const [start, end] = GEO.forkStretch(w.g.radii[j.from], near, rn);
    return (Math.hypot(pj[0] - po[0], pj[1] - po[1]) - start) / (end - start);
  };
  const r = [0, 1, 3, 12].map((n) => Math.round(share(SH.forkAfter(n)) * 100) / 100);
  check('fork position: clamped between 10 % and 45 % of the free way to the nearest target', r.every((x) => x >= 0.095 && x <= 0.455), true);
  check('fork position: no slides before → nearest the origin; more slides before (relative to the branches) → further, up to the clamp', [r[0], r[0] <= r[1] && r[1] < r[2] && r[2] <= r[3], r[3]], [0.1, true, 0.45]);
  check('fork position: the rule itself (slides before ÷ (before + branch length))', [GEO.forkShare(0, 7), GEO.forkShare(3, 7), GEO.forkShare(50, 7), GEO.forkShare(0, 0)], [0.1, 0.3, 0.45, 0.1]);
  const w = open(SH.forkAfter(3));
  const j = [...w.lines.junctions.values()].find((x) => x.kind === 'fork');
  check('fork position: the stretch to the fork is its own track and can be chosen as a route segment', [secOf(w, 'A', j.id).length, w.scene.lanes.some((l) => l.toId === j.id)], [1, true]);
}

/* §4 Ein gewähltes Ziel: der Weg gezeichnet, alles andere grau; Erledigtes dünn, Offenes kräftig, der jetzige Schritt hervor. */
{
  const made = SH.fork();
  const homeA = [...open(made).lines.sections.values()].find((s) => s.from === T.HOME);
  const w = open(made, F.fakeLearner({ progress: { 'f/1': { visited: [...homeA.steps] } }, levels: { A: 1 } }));
  const J = junctionOf(w, made.choice);
  const toB = J.out.find((id) => w.lines.sections.get(id).to === 'B');
  const toC = J.out.find((id) => w.lines.sections.get(id).to === 'C');
  const f = FO.sectionFocus(w.state, w.lines, toB, (target, via) => P.plan(w.state, target, { choices: new Map([[target, via]]) }));
  check('goal by a path: one click on a path shows the way over it to its tower', [[...f.remaining].map((id) => w.lines.sections.get(id).to), f.current === [...f.remaining][0], [...f.missing]], [[J.id, 'B'], true, ['B']]);
  check('goal by a path: everything not on the way is grey (the other branch, its tower)', [FO.greySection(f, toC), FO.greyPlace(f, 'C'), FO.greySection(f, homeA.id), FO.greyPlace(f, 'B')], [true, true, false, false]);
  const lane = (id) => w.scene.lanes.find((l) => l.section === id);
  check('goal: done thin and muted, open prominent (one accent), the current step stands out, the rest grey', [SC.laneStroke(lane(homeA.id), f).tone, SC.laneStroke(lane(f.current), f).tone, SC.laneStroke(lane(toB), f).tone, SC.laneStroke(lane(toC), f).tone], ['done', 'current', 'route', 'grey']);
  check('goal: only the chosen way has dots', [SC.laneStroke(lane(toB), f).dots, SC.laneStroke(lane(homeA.id), f).dots, SC.laneStroke(lane(toC), f).dots], [true, false, false]);
  const c = made.input.cards.filter((x) => x.about[0] === 'A').map((x) => x.key);
  const due = open(made, F.fakeLearner({ levels: { A: 1 }, knowness: Object.fromEntries(c.map((k, i) => [k, i === 0 ? 0.5 : 2])) }));
  check('goal: a conquered tower with cards due for review carries a flag (also far away); others none', [due.scene.byId.get('A').due, due.scene.byId.get('B').due], [true, false]);
  const many = open(made, F.fakeLearner({ levels: { A: 1 }, knowness: Object.fromEntries(c.map((k, i) => [k, i < 2 ? 0.5 : 2])) }));
  check('due flag: its colour says how much — green little, orange more, red a lot (1 of 3 / 2 of 3 cards due)', [SC.dueLevel(0.1), SC.dueLevel(0.3), SC.dueLevel(0.6), SC.dueLevel(due.scene.byId.get('A').dueShare), SC.dueLevel(many.scene.byId.get('A').dueShare)], ['few', 'some', 'many', 'some', 'many']);
}

/* Ein Klick auf eine Gabelung oder einen eroberten Turm: seine Wege und Abhängigkeiten (Bögen) wie im Weg. */
{
  const made = SH.gates();
  const w = open(made, F.fakeLearner({ levels: { A: 1, K: 1, B: 1 } }));
  const J = junctionOf(w, made.choice);
  const fj = FO.nodeFocus(w.state, w.lines, J.id);
  check('a clicked fork shows its ways and the dependency into it (K → fork, as an arc)', [[...fj.remaining].map((id) => w.lines.sections.get(id).to).sort(), [...fj.gates].map((id) => w.lines.links.find((l) => l.id === id)?.from)], [['B', 'C', J.id].sort(), ['K']]);
  const fb = FO.nodeFocus(w.state, w.lines, 'Z');
  check('a clicked tower shows what it needs as arcs in the air (also when conquered)', [...(fb.arcs ?? [])].map(([a]) => a).sort(), ['B', 'K']);
}

/* 2026-11-11 — was genügt, um vom Turm weiterzugehen (openAt), genügt auch den Türmen, die ihn verlangen. */
{
  const made = SH.gates();
  const world = G.readWorld(made.input);
  const lines = L.linesOf(world, made.input.flows);
  const st = (lv) => S.stateOf(world, lines, F.fakeLearner({ levels: lv }), { levels: 3, knownShare: 1, openAt: 2 });
  const half = st({ A: 2 });
  check('passable: A at level 2 of 3 (its paths open from level 2) is not conquered, but passable', [half.places.get('A').conquered, half.places.get('A').passable, st({ A: 1 }).places.get('A').passable], [false, true, false]);
  check('passable: the towers that need A treat it as done — B can be tried, no disc for A, A not listed as missing', [R.runGate(half.ctx, 'B', R.levelOf([], R.defaultRules(3), 3), 3).kind, half.conquestOrder('Z').includes('A'), PN.requiredTowers(half, 'B').map((x) => x.id)], ['ready', false, []]);
  check('passable: the way to B does not send the learner back to finish A (only what the branch itself needs: K)', P.plan(half, 'B').places, ['K', 'B']);
  check('passable: without openAt only the full conquest counts', S.stateOf(world, lines, F.fakeLearner({ levels: { A: 2 } }), { levels: 3, knownShare: 1 }).places.get('A').passable, false);
}

/* 2026-11-11 — ein Weg über eine Verpackung, die nicht gezeichnet ist (Eigentümer: „der Weg fehlt bei einer inneren Gabelung"). */
{
  const made = SH.packaging();
  const learner = F.fakeLearner({ levels: { A: 1 } });
  const w = open(made, learner);
  const pl = P.plan(w.state, 'P');
  const f = FO.routeFocus(pl, w.state, w.lines);
  const lane = w.scene.lanes.find((l) => l.toId === 'P');
  const viaVariant = pl.route.find((id) => w.lines.sections.get(id).to === 'P');
  check('packaging on the way: the drawn track stands for every packaging, so the route lights it whichever one the plan takes', [lane.sections.length, lane.sections.includes(viaVariant), ['route', 'current'].includes(SC.laneStroke(lane, f).tone), SC.laneOn(lane, new Set(pl.route))], [3, true, true, true]);
}

/* §5 Der geführte Weg: zuerst die nötige Wiederholung, nur was das Ziel braucht, er endet erst am Ziel. */
{
  const made = SH.reviewGate();
  const w0 = open(made);
  const seen = (flow) => [...w0.lines.sections.values()].filter((s) => s.line === flow).flatMap((s) => s.steps);
  const homeA = [...w0.lines.sections.values()].find((s) => s.line === 'f/a' && s.from === T.HOME);
  const w = open(made, F.fakeLearner({ levels: { A: 1, K: 1 }, progress: { 'f/k': { visited: seen('f/k') }, 'f/a': { visited: [...homeA.steps] } }, knowness: { 'q/K/0': 0.5 } }));
  const pl = P.plan(w.state, 'B');
  check('overview: the review that the way needs comes first (the branch to B needs a card it has seen, known)', [pl.steps[0]?.kind, pl.steps[0]?.cards], ['review', ['q/K/0']]);
  check('overview: then the way, only towards the goal, ending with its conquest', pl.steps.map((s) => `${s.kind}:${s.place}`).slice(1), ['travel:B', 'travel:B', 'run:B']);
  check('overview: only towers the goal needs', pl.places, ['B']);
  /* Angehalten: derselbe Plan, wenn man weitermacht (der Fortschritt steckt im Stand). */
  const tt = N.followPlan(null, pl);
  check('guided flow: paused and resumed, it continues where it was (same parts left)', N.followPlan(tt, P.plan(w.state, 'B')).upcoming.map(N.stepKey), tt.upcoming.map(N.stepKey));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
