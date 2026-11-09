/**
 * 2026-11-09 — DIE WELTKARTE, TEIL 5: WAS DIE FELDER TUN (spec §6.1, §7.3, §8; Entscheidungen 7, 14, 15) — ohne Browser, auf
 * der Testwelt in Bosko-Gestalt (`wmFixtures.ts`):
 * <code>
 *   Fahrkarte   die Quellen jeder neuen Karte (eine Linie oder „bez slajdu"); direkt gelernt → das Schloss ist fort
 *   Umsteigeort drei Zweige, jeder mit Wahl und Ausgang; der Spieler steht nach `jumpTo {step, exit}` im gewählten Zweig
 *   Navigation  der Fahrplan (erledigt nur durch Lernen, nie durch eine Abzweigung), das Fenster, die Zeichen auf der Karte,
 *               die Sitzung (sessionStorage)
 *   Autoren     alles aus Welt, Linien, Gestalt (kein Gleis: rot) und Farbgebieten — das Schlimmste zuerst; jede Art hat Text
 * </code>
 * Die Klickpfade im Browser: `scripts/wm-click-paths.mjs`.
 *
 *   node scripts/app-wm-interaction-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('en');
import { build } from 'esbuild';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-wm-interaction-'));
const entries = {
  types: 'src/app/cogita/worldmap/wmTypes.ts', graph: 'src/app/cogita/worldmap/wmGraph.ts', lines: 'src/app/cogita/worldmap/wmLines.ts',
  state: 'src/app/cogita/worldmap/wmState.ts', plan: 'src/app/cogita/worldmap/wmPlan.ts', nav: 'src/app/cogita/worldmap/wmNav.ts',
  authors: 'src/app/cogita/worldmap/wmAuthors.ts', fx: 'src/app/cogita/worldmap/wmFixtures.ts', running: 'src/app/cogita/runningStory.ts'
};
await build({ entryPoints: entries, bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' }, define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) } });
globalThis.BroadcastChannel = undefined;
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [T, G, L, S, P, N, A, F, RS] = await Promise.all(Object.keys(entries).map(load));

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};

const bx = F.boskoWorld();
const world = G.readWorld(bx.input);
const lines = L.linesOf(world, bx.input.flows);
const known = (places) => Object.fromEntries(places.flatMap((p) => world.places.get(p).cards.map((k) => [k, 3])));

/* -- Klickpfad 1 als Modell: Abschnitt mit Schloss → Quellen → direkt lernen → Schloss fort ---------------------------------- */
{
  const st = S.stateOf(world, lines, F.fakeLearner({}), { levels: 0, knownShare: 1 });
  const s = st.sections.get('f/L4:2');
  check('ticket: the branch "Do studentów" needs „Comollo" (the condition of its option)', [s.ticket.met, s.ticket.symbol, s.ticket.parts.map((p) => [p.part.source, p.part.condition.type, p.part.condition.of])], [false, 'knowledge', [['option', 'knowness', 'comollo']]]);
  check('ticket: its missing cards are the cards of „Comollo"', s.ticket.missing.new.slice().sort(), world.places.get('comollo').cards.slice().sort());
  const groups = {};
  for (const k of s.ticket.missing.new) { const src = st.sources(k).find((x) => x.section !== 'f/L4:2'); const key = src?.section ?? 'direct'; groups[key] = (groups[key] ?? 0) + 1; }
  check('sources: 10 cards from a line (open now), 3 with no slide — learn directly', [groups, st.sections.get('f/L2:4').ticket.met], [{ 'f/L2:4': 10, direct: 3 }, true]);
  const after = S.stateOf(world, lines, F.fakeLearner({ knowness: Object.fromEntries(s.ticket.missing.new.map((k) => [k, 3])) }), { levels: 0, knownShare: 1 });
  check('learn directly: the lock is gone (ticket met, a finite step on the way)', [after.sections.get('f/L4:2').ticket.met, Number.isFinite(after.sections.get('f/L4:2').cost)], [true, true]);
}

/* -- Klickpfad 2 als Modell: Umsteigeort mit 3 Zweigen → einen wählen ----------------------------------------------------- */
{
  const station = lines.stations.get('domkos');
  check('station: one story splits here into 3 branches', station.forks.map((f) => [f.line, f.step, f.branches.length]), [['f/L4', 'ch2', 3]]);
  check('station: each branch leaves from here with its choice and exit', ['f/L4:1', 'f/L4:2', 'f/L4:3'].map((id) => [station.out.includes(id), lines.sections.get(id).start]), [[true, { step: 'ch2', exit: 'o0' }], [true, { step: 'ch2', exit: 'o1' }], [true, { step: 'ch2', exit: 'o2' }]]);
  const flows = new Map(bx.input.flows.map((f) => [f.id, f]));
  const flow = flows.get('f/L4');
  const facts = { values: {}, knowness: () => 0, answered: () => null, visited: new Set(), now: new Date(0), flow: () => undefined };
  const ctx = { facts: () => facts, flows: (id) => flows.get(id), members: () => [] };
  /* Wie FlowPlayer `jumpTo {step, exit}`: an die Wahl, dann ihr Ausgang. */
  const start = RS.startRun(flow, {}, ctx);
  const atChoice = { root: flow.id, outer: [], state: RS.enterAt(flow, { ...start.state, stack: [], chapter: null, visited: [] }, 'ch2', ctx) };
  check('player: entering at the choice waits there', atChoice.state.step, 'ch2');
  const chosen = ['o0', 'o1', 'o2'].map((exit) => RS.stepRun(atChoice, (id) => flows.get(id), exit, ctx).run.state.step);
  check('player: with the exit it stands in the chosen branch (its first slide)', chosen, ['sh3', 'sh7', 'sh11']);
  check('player: a step inside an embedded story opens at the story step of the line', [L.outerStep('sub>inner>x'), L.outerStep('ch2')], ['sub', 'ch2']);
}

/* -- Klickpfad 3 als Modell: Navigation, eine Abzweigung, der Fahrplan ------------------------------------------------------ */
{
  const missing = ['domkos', 'warsz', 'savio', 'magone'];
  const learner = F.fakeLearner({ knowness: known(world.order.filter((p) => !missing.includes(p))) });
  const st = S.stateOf(world, lines, learner, { levels: 0, knownShare: 1 });
  check('navigation: the target has 3 missing prerequisites', st.conquestOrder('magone').filter((p) => p !== 'magone'), ['domkos', 'savio', 'warsz']);
  const plan0 = P.plan(st, 'magone');
  const tt0 = N.followPlan(null, plan0);
  check('timetable: a new plan has nothing done, every step upcoming', [tt0.done.length, tt0.upcoming.length, tt0.target], [0, plan0.steps.length, 'magone']);
  const turnAt = tt0.upcoming.findIndex((s) => s.kind === 'travel' && s.alternatives.length > 0);
  const turn = tt0.upcoming[turnAt];
  check('timetable: a branch option on the way (another branch to the same knowledge)', [turn.place, turn.section, turn.alternatives.map((a) => a.section)], ['magone', 'f/L4:4', ['f/L4:5', 'f/L4:6']]);
  const plan1 = P.plan(st, 'magone', { choices: new Map([['magone', 'f/L4:6']]) });
  const tt1 = N.followPlan(tt0, plan1, true);
  check('timetable: choosing recomputes from that stop — the stop is the chosen branch, nothing marked done', [tt1.done.length, N.stepKey(tt1.upcoming[turnAt]), tt1.upcoming.slice(0, turnAt).map(N.stepKey)], [0, 'travel:f/L4:6', tt0.upcoming.slice(0, turnAt).map(N.stepKey)]);
  /* Der Lernende fährt den ersten Abschnitt: seine Karten sind eingeführt → der Schritt ist erledigt. */
  const first = tt1.upcoming[0];
  check('timetable: the first step is a travel', first.kind, 'travel');
  const st2 = S.stateOf(world, lines, F.fakeLearner({ knowness: { ...known(world.order.filter((p) => !missing.includes(p))), ...Object.fromEntries(first.cards.map((k) => [k, 0.5])) } }), { levels: 0, knownShare: 1 });
  const tt2 = N.followPlan(tt1, P.plan(st2, 'magone', { choices: new Map([['magone', 'f/L4:6']]) }));
  check('timetable: after learning, the travelled step counts as done', [tt2.done.map(N.stepKey), tt2.upcoming.some((s) => N.stepKey(s) === N.stepKey(first))], [[N.stepKey(first)], false]);
  check('timetable: a new target starts afresh', N.followPlan(tt2, P.plan(st2, 'savio')).done.length, 0);
  const w = P.timetableWindow(['d1', 'd2', 'd3'], ['c', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6']);
  check('window: 2 done above, the current one, 4 below, the rest by scrolling', [w.done, w.current, w.next, w.hiddenAbove, w.hiddenBelow], [['d2', 'd3'], 'c', ['n1', 'n2', 'n3', 'n4'], 1, 2]);
  const marks = N.navMarks(tt1, lines);
  const travels = tt1.upcoming.map((s, i) => [s, i]).filter(([s]) => s.kind === 'travel');
  check('map: the next steps glow, later ones are faint', [marks.next, marks.later], [travels.filter(([, i]) => i < N.WINDOW_NEXT).map(([s]) => s.section), travels.filter(([, i]) => i >= N.WINDOW_NEXT).map(([s]) => s.section)]);
  check('map: the pennant stands where the current step begins, the flag at the target', [marks.start, marks.target], [N.stepPlace(tt1.upcoming[0], lines), 'magone']);
  check('map: a fork where one can turn', marks.forks.includes(lines.sections.get(tt1.upcoming[turnAt].section).from), true);
  /* Die Sitzung: ein Neuladen behält Ziel und Abzweigungen, nichts geht ins Konto. */
  const store = new Map();
  globalThis.window = { sessionStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) } };
  N.keepNav('lib:view', { target: 'magone', choices: new Map([['magone', 'f/L4:6']]) });
  const back = N.keptNav('lib:view');
  check('session: target and choices survive a reload', [back.target, [...back.choices]], ['magone', [['magone', 'f/L4:6']]]);
  N.keepNav('lib:view', null);
  check('session: "End navigation" clears it', N.keptNav('lib:view'), null);
  delete globalThis.window;
}

/* -- Step 3 · 7, nach der Entscheidung vom 2026-11-09 (kein Abstand): der Fahrplan hat nie einen wartenden Schritt ------------- */
{
  const missing = ['warsz', 'savio', 'magone'];
  const others = world.order.filter((p) => !missing.includes(p));
  /* savio: Stufe 1 eben erreicht — früher wartete Stufe 2 einen Tag; jetzt ist der Durchgang gleich dran. */
  const learner = F.fakeLearner({ knowness: known([...others, 'savio']), levels: { ...Object.fromEntries(others.map((p) => [p, 3])), savio: 1 } });
  const pl = P.plan(S.stateOf(world, lines, learner, { levels: 3, knownShare: 1 }), 'magone');
  const tt = N.followPlan(null, pl);
  check('Step 3 · 7: the current step can be done now — the run of savio (level 2, up to 3), nothing waits', [tt.upcoming[0].kind, tt.upcoming[0].place, tt.upcoming[0].level, tt.upcoming[0].upTo, tt.upcoming.some((s) => s.kind === 'wait')], ['run', 'savio', 2, 3, false]);
  check('Step 3 · 7: the pennant stands at the current step', N.navMarks(tt, lines).start, 'savio');
}

/* -- Die Liste für Autoren ---------------------------------------------------------------------------------------------------- */
{
  const broken = F.brokenWorld();
  const bw = G.readWorld(broken);
  const bl = L.linesOf(bw, broken.flows);
  const ids = ['x', 'y', 'z', 'q'];
  const tree = {
    regions: new Map([
      ['r:x', { key: 'r:x', named: 'central', central: 1, name: 'Wokół: Y' }],
      ['r:z', { key: 'r:z', named: 'central', central: 2, name: 'Wokół: Z' }],
      ['r:q', { key: 'r:q', named: 'owner', central: 0, name: 'Nazwa autora' }]
    ])
  };
  check('authors: a colour area named after another topic than its centre', A.mislabelledRegions(tree, ids), [{ code: 'mislabelledRegion', level: 'info', ids: ['x', 'y'], data: { name: 'Wokół: Y' } }]);
  const list = A.authorIssues(bw, bl, { noRoute: [['a', 'b']] }, tree, ids);
  const rank = { error: 0, warning: 1, info: 2 };
  check('authors: a track without route is red and first', [list[0].code, list[0].level], ['noRoute', 'error']);
  check('authors: sorted by level', list.every((x, i) => i === 0 || rank[list[i - 1].level] <= rank[x.level]), true);
  const codes = new Set(list.map((x) => x.code));
  check('authors: the broken world shows every case of §11', ['cycle', 'dangling', 'flowNoPlaces', 'unknownCondition', 'placesWithoutLine', 'noRoute'].map((c) => codes.has(c)), [true, true, true, true, true, true]);
  check('authors: the additions of decision 7', ['membersNotDetoured', 'requiresSiblingPrerequisite', 'flowStartsLate', 'mislabelledRegion'].map((c) => codes.has(c)), [true, true, true, true]);
  check('authors: Bosko-shape fixture without a track error', A.authorIssues(world, lines, { noRoute: [] }, null, world.order).filter((x) => x.level === 'error').length, 0);
}

/* -- Jede Art hat ihre Worte (die Schlüssel stehen im Code nur als Muster) ------------------------------------------------------ */
{
  for (const lang of ['en', 'de', 'pl']) {
    const words = JSON.parse(await readFile(`src/locales/${lang}/cogitaWorld.json`, 'utf8'));
    check(`${lang}: a text for every issue code and level`, [T.ISSUE_CODES.filter((c) => words.issue?.[c] === undefined), ['error', 'warning', 'info'].filter((l) => words.issue?.level?.[l] === undefined)], [[], []]);
    check(`${lang}: the knowledge dot has words for all three states`, ['green', 'yellow', 'orange'].filter((d) => words.panel?.dot?.[d] === undefined), []);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
