/**
 * 2026-11-09 — DIE WELTKARTE, TEIL 1: DAS MODELL (documentation/world-map, spec §13), ohne Datenbank, auf allen Testwelten
 * (`cogita/worldmap/wmFixtures.ts`): Welt lesen und reinigen, Linien mit Zweigen, Umsteigeorten und Abstechern, Fahrkarten aus
 * (a) „Wymaga", (b) einer Möglichkeit, (c) einem Tor, die Registratur der Bedingungen (geschlossen bei Unbekanntem), Höhe,
 * Reihenfolge, Dijkstra und der Plan — mit 0, 1, 3 und 5 Stufen.
 *
 *   node scripts/app-wm-model-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('en');
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-wm-model-'));
const entries = {
  graph: 'src/app/cogita/worldmap/wmGraph.ts', lines: 'src/app/cogita/worldmap/wmLines.ts', cond: 'src/app/cogita/worldmap/wmConditions.ts',
  state: 'src/app/cogita/worldmap/wmState.ts', plan: 'src/app/cogita/worldmap/wmPlan.ts', fx: 'src/app/cogita/worldmap/wmFixtures.ts', types: 'src/app/cogita/worldmap/wmTypes.ts',
  schema: 'src/app/cogita/schema.ts', kinds: 'src/app/cogita/kinds.ts'
};
await build({
  entryPoints: entries, bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' },
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [G, L, C, S, P, F, T, SC, K] = await Promise.all(Object.keys(entries).map(load));

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};
const HOME = T.HOME;
const DAY = P.DAY;

/* -- Das Schema: "part" wird gelesen und geschrieben ------------------------------------------------------------------------- */
{
  const f = SC.readField({ key: 'czesc', label: 'Część', type: 'ref', part: 'up' });
  check('schema: "part": "up" is read on a ref field', f?.part, 'up');
  check('schema: … and ignored on other types', SC.readField({ key: 'x', type: 'line', part: 'up' })?.part, undefined);
  const both = SC.readField({ key: 'mix', type: 'ref', part: 'up', prerequisite: 'up' });
  check('schema: a field with both keeps both (the world map reports it)', [both?.part, both?.prerequisite], ['up', 'up']);
  const doc = K.kindDoc({ id: 'k1', name: 'Temat', label: '{name}', fields: [f] });
  check('schema: the kind JSON keeps "part"', doc.fields[0].part, 'up');
}

/* -- 1. Die Bosko-Gestalt ------------------------------------------------------------------------------------------------------ */
const bx = F.boskoWorld();
const world = G.readWorld(bx.input);
const lines = L.linesOf(world, bx.input.flows);
const sec = (id) => lines.sections.get(id);
const lineSecs = (line) => lines.lines.get(line).sections.map(sec);
{
  check('bosko: 50 places (37 topics, 3 parts of the block, 10 threads)', world.places.size, 50);
  check('bosko: one block with three parts, only from "part": "up"', [...world.blocks.values()].map((b) => [b.id, b.parts, b.own]), [['s1859', ['s1859a', 's1859b', 's1859c'], false]]);
  check('bosko: the parts know their block', ['s1859a', 's1859b', 's1859c'].map((p) => world.places.get(p).block), ['s1859', 's1859', 's1859']);
  check('bosko: requiring the block means requiring all its parts', ['s1859a', 's1859b', 's1859c', 'w_sny'].every((p) => world.places.get('wysn').needs.includes(p)), true);
  check('bosko: no cycles', world.groups.length, 0);
  check('bosko: slides and story parts are not places', [world.places.has('s/sen'), world.places.has('u/L1'), world.places.has('q/sen/0')], [false, false, false]);
  check('bosko: place kinds are derived from "about" (slides drop out)', [...world.placeKinds], ['temat']);
  check('bosko: the base is the transitive closure', [...world.base('kuglarz')].sort(), ['becchi', 'sen']);

  check('bosko: six lines — four stories and two deepenings', [...lines.lines.values()].map((l) => [l.id, l.deepening]),
    [['f/L1', false], ['f/L2', false], ['f/L3', false], ['f/L4', false], ['f/sny', true], ['f/misje', true]]);
  check('R3: a unit without prerequisites starts at Home', lines.lines.get('f/L1').start, HOME);
  check('R3: a unit that requires its own first place starts there (mid-world)', [lines.lines.get('f/L3').start, lines.lines.get('f/L4').start], ['narodz', 'domkos']);
  check('R3: the first section carries the unit\'s Wymaga', sec('f/L4:0').ticket.map((t) => [t.source, t.condition.type, t.condition.of ?? t.condition.flow]), [['unit', 'knowness', 'domkos'], ['unit', 'story', 'f/L2']]);
  check('R2: a borrowed question creates no stop', lines.lines.get('f/L1').stops.includes('w_sny'), false);
  check('R2: … but introduces its card on that section', sec('f/L1:1').introduces.includes('q/w_sny/0'), true);
  check('R2: stops come from shown places, in order', lines.lines.get('f/L1').stops.slice(0, 5), ['becchi', 'sen', 'kuglarz', 'przyj', 'semch']);
  const l2 = lineSecs('f/L2');
  check('review block: no stops after the review start', lines.lines.get('f/L2').stops, ['becchi', 'antoni', 'przyj', 'semch', 'comollo', 'swiec', 'choroba', 'domkos', 'savio']);
  check('review block: re-asked cards are introduced once', ['q/antoni/0', 'q/antoni/1', 'q/comollo/0'].map((k) => l2.filter((s) => s.introduces.includes(k)).length), [1, 1, 1]);
  check('review block: the review steps belong to no section', l2.some((s) => s.steps.includes('review0')), false);

  /* Drei Zweige an einem Umsteigeort. */
  const domkos = lines.stations.get('domkos');
  const fork = domkos.forks.find((f) => f.step === bx.fork);
  check('branches: the station domkos offers the 3-way choice of L4', fork?.branches.length, 3);
  const firsts = fork.branches.map((b) => lines.lines.get('f/L4').branches.find((x) => x.id === b).sections.map(sec)[0]);
  check('branches: each branch starts at the station', firsts.map((s) => [s.from, s.to]), [['domkos', 'warsz'], ['domkos', 'cagrua'], ['domkos', 'savio']]);
  check('branches: the player opens a branch at the choice with its exit', firsts.map((s) => s.start), [{ step: bx.fork, exit: 'o0' }, { step: bx.fork, exit: 'o1' }, { step: bx.fork, exit: 'o2' }]);
  check('(b) the option condition is the ticket of its branch', firsts.map((s) => s.ticket.map((t) => [t.source, t.condition.of])), [[], [['option', 'comollo']], []]);
  check('branches: they meet at magone, which becomes a station', [lines.stations.has('magone'), lineSecs('f/L4').filter((s) => s.to === 'magone').map((s) => s.from).sort()], [true, ['cagrua', 'savio', 'warsz']]);
  check('branches: after the meeting the trunk continues once', lineSecs('f/L4').filter((s) => s.from === 'magone').map((s) => [s.branch, s.to]), [['f/L4', 's1859c']]);
  check('(c) a gate (one exit leaves the line) is the ticket of the next section', sec('f/L1:18').ticket.map((t) => [t.source, t.condition.type, t.condition.of]), [['gate', 'knowness', 'w_sny']]);
  check('(c) the review loop\'s value conditions are no gates', [...lines.sections.values()].some((s) => s.ticket.some((t) => t.condition.type === 'value')), false);

  /* Abstecher: beginnt und endet am rufenden Ort, je Rufer (Korrektur 3). */
  const sny = lineSecs('f/sny');
  check('R4: a deepening has one entry per calling place', sny.filter((s) => s.kind === 'entry').map((s) => [s.from, s.to, s.callers]), [['becchi', 'w_sny', ['f/L2']], ['sen', 'w_sny', ['f/L1']]]);
  check('R4: … is drawn once inside', sny.filter((s) => s.kind === 'main').map((s) => [s.from, s.to]), [['w_sny', 'w_bosko']]);
  check('R4: … and returns to every caller', sny.filter((s) => s.kind === 'return').map((s) => [s.from, s.to]), [['w_bosko', 'becchi'], ['w_bosko', 'sen']]);
  check('R4: entering from the caller\'s own story needs no "story passed"', sny.filter((s) => s.kind === 'entry').map((s) => s.ticket.map((t) => t.condition.type)), [['story'], []]);
  check('R4: calling places are stations', ['becchi', 'sen', 'isc'].map((p) => lines.stations.has(p)), [true, true, true]);
  check('lines: who calls a deepening, how often', [...lines.lines.get('f/sny').calledBy.entries()].sort(), [['f/L1', 1], ['f/L2', 1]]);

  const introduced = new Set(lines.introducedBy.keys());
  const touched = new Set([...lines.sections.values()].flatMap((s) => [s.from, s.to]));
  const unexplained = world.order.filter((p) => touched.has(p) && world.places.get(p).cards.some((k) => !introduced.has(k)))
    .filter((p) => !lines.issues.some((i) => i.code === 'cardsWithoutSlide' && i.ids[0] === p));
  check('cards without a slide are listed for authors', unexplained, []);
}

/* -- Stufen 0, 1, 3, 5: Eroberung, Höhe, Sättigung, Wiederholungen ------------------------------------------------------------ */
{
  const cardsOf = (p) => world.places.get(p).cards;
  const know = {};
  for (const k of cardsOf('becchi')) know[k] = 3;
  cardsOf('sen').forEach((k, i) => { know[k] = i % 2 === 0 ? 3 : 0.5; });
  const learner = F.fakeLearner({ knowness: know, levels: { becchi: 3, sen: 1 } });
  const at = (levels) => S.stateOf(world, lines, learner, { levels, knownShare: 1 });
  const n = (p) => cardsOf(p).length;
  const s0 = at(0); const s1 = at(1); const s3 = at(3); const s5 = at(5);
  check('levels 0: conquered = cards known (share 1)', ['becchi', 'sen', 'kuglarz'].map((p) => s0.places.get(p).conquered), [true, false, false]);
  check('levels 0: an unfulfilled place misses only its unknown cards', s0.places.get('sen').missing, Math.floor(n('sen') / 2));
  check('levels 1: one run conquers', ['becchi', 'sen', 'kuglarz'].map((p) => s1.places.get(p).conquered), [true, true, false]);
  check('levels 3: the last level conquers', ['becchi', 'sen'].map((p) => s3.places.get(p).conquered), [true, false]);
  check('levels 5: level 3 is not enough', s5.places.get('becchi').conquered, false);
  check('levels ≥ 1: an unconquered place counts all its cards', [s3.places.get('sen').missing, s5.places.get('becchi').missing], [n('sen'), n('becchi')]);
  check('height = Σ missing over the place and its base', s3.places.get('kuglarz').height, n('kuglarz') + n('sen'));
  check('height with 0 levels', s0.places.get('kuglarz').height, n('kuglarz') + Math.floor(n('sen') / 2));
  check('pillar height: 6 + 3.6·√h, capped at 110, flat when conquered', [S.pillarHeight(0, false), Math.round(S.pillarHeight(100, false)), S.pillarHeight(5000, false), S.pillarHeight(30, true)], [6, 42, 110, 0]);
  check('saturation: full after the first level, partly seen, never seen', ['becchi', 'sen', 'kuglarz'].map((p) => s3.places.get(p).saturation), ['full', 'full', 'never']);
  check('saturation with 0 levels: full only when fulfilled', ['becchi', 'sen'].map((p) => s0.places.get(p).saturation), ['full', 'partly']);
  check('the knowledge dot shows only on conquered places', ['becchi', 'sen'].map((p) => s3.places.get(p).dot), ['green', null]);
  const fading = S.stateOf(world, lines, F.fakeLearner({ knowness: { ...know, [cardsOf('becchi')[0]]: 0.5 }, levels: { becchi: 3 } }), { levels: 3, knownShare: 1 });
  check('… and turns orange when a card is due', fading.places.get('becchi').dot, 'orange');
  check('levels change → recomputed, nothing stored', [at(1).places.get('sen').conquered, at(3).places.get('sen').conquered, at(1).places.get('sen').conquered], [true, false, true]);
  const senCard = cardsOf('sen')[0];
  check('reviewable: with 0 levels every card', S.reviewable(senCard, s0), true);
  check('reviewable: with levels only cards of conquered places', [S.reviewable(cardsOf('becchi')[0], s3), S.reviewable(senCard, s3)], [true, false]);
  check('reviewable: a card of no place stays reviewable', S.reviewable('q/elsewhere', s3), true);
  check('reviewable: without a world state nothing changes', S.reviewable(senCard, null), true);
}

/* -- Fahrkarten, Quellen, „direkt lernen", Dijkstra ----------------------------------------------------------------------------- */
{
  const fresh = S.stateOf(world, lines, F.fakeLearner({}), { levels: 0, knownShare: 1 });
  const gateSec = fresh.sections.get('f/L1:18');
  check('ticket: a knowledge gate is locked for a new learner', [gateSec.ticket.met, gateSec.ticket.symbol, gateSec.ticket.missing.new.length], [false, 'knowledge', world.places.get('w_sny').cards.length]);
  const src = fresh.sources(world.places.get('w_sny').cards[1]);
  check('sources: the sections that introduce a card, cheapest first', src.map((s) => s.section), ['f/sny:0@sen', 'f/sny:0@becchi']);
  check('sources: a card that no line asks has none (learn directly)', fresh.sources(world.places.get('w_sny').cards.at(-1)).length, 0);
  const learned = {};
  for (const k of world.places.get('w_sny').cards) learned[k] = 0.5;
  const after = S.stateOf(world, lines, F.fakeLearner({ knowness: learned }), { levels: 0, knownShare: 1 });
  check('learn directly → the lock is gone', after.sections.get('f/L1:18').ticket.met, true);
  const reviewOnly = S.stateOf(world, lines, F.fakeLearner({ knowness: learned }), { levels: 0, knownShare: 1 }).sections.get('f/L4:2');
  check('review only: a ticket with unseen cards is not review-only', [reviewOnly.ticket.met, reviewOnly.ticket.reviewOnly], [false, false]);
  const due = {};
  for (const k of world.places.get('comollo').cards) due[k] = 0.5;
  const ro = S.stateOf(world, lines, F.fakeLearner({ knowness: due }), { levels: 0, knownShare: 1 }).sections.get('f/L4:2').ticket;
  check('review only: nothing new, only reviews', [ro.met, ro.reviewOnly, ro.symbol, ro.missing.new.length, ro.missing.review.length], [false, true, 'review', 0, world.places.get('comollo').cards.length]);
  const story = fresh.sections.get('f/L4:0').ticket;
  check('a unit as requirement: "that story passed" with the story lock', [story.met, story.parts.map((p) => p.view.symbol)], [false, ['knowledge', 'story']]);
  const passed = {};
  for (const k of world.places.get('domkos').cards) passed[k] = 3;
  const okStory = S.stateOf(world, lines, F.fakeLearner({ knowness: passed, progress: { 'f/L2': { visited: [], done: true } } }), { levels: 0, knownShare: 1 }).sections.get('f/L4:0').ticket;
  check('… met once the story is done and the place known', okStory.met, true);

  const route = fresh.routeTo('sen');
  check('Dijkstra: the cheapest route from Home', route, ['f/L1:0', 'f/L1:1']);
  check('Dijkstra: the route summary', fresh.summary(route), { sections: 2, fresh: 0, review: 0, slides: 2 });
  const toWysn = fresh.routeTo('wysn');
  const gate = fresh.summary(toWysn);
  check('Dijkstra: a locked section costs its missing cards, shown in the summary', [toWysn.at(-1), gate.fresh > 0], ['f/L1:18', true]);
  /* Step 3 · 4 — nicht mehr „monoton entlang des Zweiges": befahren ist, was selbst befahren wurde. */
  const ridden = S.stateOf(world, lines, F.fakeLearner({ progress: { 'f/L1': { visited: [...lines.sections.get('f/L1:1').steps] } } }), { levels: 0, knownShare: 1 });
  check('travelled: from "visited" — the section whose steps were visited, not the ones before it', ['f/L1:0', 'f/L1:1', 'f/L1:2', 'f/L1:3'].map((s) => ridden.sections.get(s).travelled), [false, true, false, false]);
  check('travelled: … and a travelled section is 0.5 cheaper', ridden.sections.get('f/L1:1').cost, fresh.sections.get('f/L1:1').cost - 0.5);
  const done = S.stateOf(world, lines, F.fakeLearner({ progress: { 'f/L4': { visited: [...lines.sections.get('f/L4:7').steps], done: true } } }), { levels: 0, knownShare: 1 });
  check('travelled: a finished story — its visited trunk section, not its branches', [done.sections.get('f/L4:7').travelled, done.sections.get('f/L4:1').travelled], [true, false]);
  const doneOnly = S.stateOf(world, lines, F.fakeLearner({ progress: { 'f/L4': { visited: [], done: true } } }), { levels: 0, knownShare: 1 });
  check('travelled: "done" alone travels nothing (no step of the section was visited)', doneOnly.sections.get('f/L4:7').travelled, false);
  /* Step 3 · 4 — befahren ist nur, was selbst befahren wurde (sein letzter Schritt oder jede seiner Fragen). */
  const trunkOf = (ls, line) => ls.lines.get(line).branches.find((x) => x.parent === null).sections.map((id) => ls.sections.get(id)).filter((s) => s.kind !== 'return');
  const [t0, t1, t2] = trunkOf(lines, 'f/L1');
  const tv = (learner) => { const st = S.stateOf(world, lines, learner, { levels: 0, knownShare: 1 }); return [t0, t1, t2].map((s) => st.sections.get(s.id).travelled); };
  check('Step 3 · 4: boarding at B and riding B→C travels only B→C (not Home→A, not A→B)', tv(F.fakeLearner({ progress: { 'f/L1': { visited: [...t2.steps] } } })), [false, false, true]);
  check('Step 3 · 4: "done" counts only for sections whose steps were visited', tv(F.fakeLearner({ progress: { 'f/L1': { visited: [...t2.steps], done: true } } })), [false, false, true]);
  const qb = new F.FlowBuilder('Q');
  const [pa, pb] = world.order.slice(0, 2);
  qb.show(`s/${pa}`); qb.ask(world.places.get(pa).cards[0]);
  qb.show(`s/${pb}`); qb.ask(world.places.get(pb).cards[0]); qb.ask(world.places.get(pb).cards[1]); qb.show(`s/${pb}`);
  qb.end();
  const qf = qb.flow('f/q', { name: 'Pytania', unit: 'u/L1' });
  const ql = L.linesOf(world, [qf]);
  const toB = [...ql.sections.values()].find((s) => s.to === pb && s.kind !== 'return');
  const asksB = toB.steps.filter((id) => qf.graph.nodes.find((n) => n.id === id)?.type === 'question');
  const qst = S.stateOf(world, ql, F.fakeLearner({ progress: { 'f/q': { visited: asksB } } }), { levels: 0, knownShare: 1 });
  check('Step 3 · 4: every question of a section asked (its last slide not yet shown) — travelled', [asksB.length, toB.steps.at(-1) !== asksB.at(-1), qst.sections.get(toB.id).travelled], [2, true, true]);
  const one = S.stateOf(world, ql, F.fakeLearner({ progress: { 'f/q': { visited: [toB.steps[0]] } } }), { levels: 0, knownShare: 1 });
  check('Step 3 · 4: one step of a section is not the section', one.sections.get(toB.id).travelled, false);
  check('conquest order: the unconquered base, base first', fresh.conquestOrder('kuglarz'), ['becchi', 'sen', 'kuglarz']);
}

/* -- Registratur: geschlossen bei Unbekanntem, asynchrones Vorbereiten ------------------------------------------------------------ */
{
  check('read: an unknown type stays as "unknown" (not dropped)', C.readTicketCondition({ type: 'qr', code: 'x' }).type, 'unknown');
  check('read: … also deep inside a gate', C.readTicketCondition({ type: 'and', items: [{ type: 'knowness', of: 'a' }, { type: 'geo', r: 1 }] }).items.map((i) => i.type), ['knowness', 'unknown']);
  const fresh = S.stateOf(world, lines, F.fakeLearner({}), { levels: 0, knownShare: 1 });
  const unk = C.evaluateCondition(C.readTicketCondition({ type: 'qr' }), fresh.ctx);
  check('evaluate: unknown = not met, unknown type, impassable', [unk.met, unk.unknown, C.costOf(C.readTicketCondition({ type: 'qr' }), fresh.ctx)], [false, true, Infinity]);
  check('evaluate: or with an unknown and a met part is met', C.evaluateCondition(C.readTicketCondition({ type: 'or', items: [{ type: 'qr' }, { type: 'time' }] }), fresh.ctx).met, true);
  check('describe: unknown types have their own lock', C.describeCondition(C.readTicketCondition({ type: 'qr' }), fresh.ctx).symbol, 'unknown');
  /* Ein künftiger Typ — angemeldet, mit asynchronem prepare. */
  C.register({
    type: 'group', symbol: 'value',
    prepare: async (c) => c.size <= 3,
    evaluate: (c, ctx) => ({ met: ctx.prepared?.get(C.conditionKey(c)) === true }),
    cost: (_c, _ctx, r) => (r.met ? 0 : 5),
    describe: () => ({ symbol: 'value', key: 'cogitaWorld.condition.value', action: 'none' })
  });
  const group = C.readTicketCondition({ type: 'group', size: 3 });
  check('registry: a registered future type is read as itself', group.type, 'group');
  check('registry: not prepared yet = pending, not met', C.evaluateCondition(group, fresh.ctx), { met: false, progress: 0, pending: true });
  const prepared = await C.prepareConditions([group], fresh.ctx);
  check('registry: after prepare it is evaluated synchronously', C.evaluateCondition(group, { ...fresh.ctx, prepared }).met, true);
  C.unregister('group');
  check('registry: unregistered again → unknown', C.readTicketCondition({ type: 'group' }).type, 'unknown');
  check('registry: built-in types cannot be removed', (C.unregister('knowness'), C.knownType('knowness')), true);
}

/* -- Der Plan: drei fehlende Voraussetzungen, Wartezeiten, Abzweigungen ------------------------------------------------------- */
{
  const missing = ['domkos', 'warsz', 'savio', 'magone'];
  const know = {};
  const levels = {};
  for (const p of world.order) if (!missing.includes(p)) { for (const k of world.places.get(p).cards) know[k] = 3; levels[p] = 3; }
  const learner = F.fakeLearner({ knowness: know, levels });
  const st = S.stateOf(world, lines, learner, { levels: 3, knownShare: 1 });
  check('plan: the target magone has 3 unconquered prerequisites', st.conquestOrder('magone'), ['domkos', 'savio', 'warsz', 'magone']);
  const pl = P.plan(st, 'magone', { gaps: [0, 1, 1] });
  check('plan: places in topological order', pl.places, ['domkos', 'savio', 'warsz', 'magone']);
  const kinds = (p) => pl.steps.filter((s) => s.place === p).map((s) => s.kind);
  check('plan: each place is introduced before its runs', missing.map((p) => kinds(p).indexOf('travel') < kinds(p).indexOf('run')), [true, true, true, true]);
  check('plan: three runs per place with three levels', missing.map((p) => pl.steps.filter((s) => s.kind === 'run' && s.place === p).map((s) => s.level)), [[1, 2, 3], [1, 2, 3], [1, 2, 3], [1, 2, 3]]);
  const firstWait = pl.steps.find((s) => s.kind === 'wait');
  check('plan: a level that waits for its gap shows "from <date>"', [firstWait?.place, firstWait?.level, firstWait?.from - learner.now], ['domkos', 2, DAY]);
  const idx = (pred) => pl.steps.findIndex(pred);
  check('plan: meanwhile it continues with the next place that is not waiting', idx((s) => s.kind === 'travel' && s.place === 'savio') < idx((s) => s.kind === 'run' && s.place === 'domkos' && s.level === 2), true);
  check('plan: runs of a place wait until its prerequisites are conquered', idx((s) => s.kind === 'run' && s.place === 'savio') > idx((s) => s.kind === 'run' && s.place === 'domkos' && s.level === 3), true);
  check('plan: cards to go', pl.cards, missing.reduce((sum, p) => sum + world.places.get(p).cards.length, 0));
  const travelWarsz = pl.steps.find((s) => s.kind === 'travel' && s.place === 'warsz');
  check('plan: the cheapest section introduces the cards', travelWarsz.section, 'f/L1:14');
  /* 2026-11-09 (Teil 5) — zwei Linien bringen je andere Karten eines Ortes: fährt der Plan beide, ist die zweite eine Ergänzung. */
  check('plan: a section the plan travels anyway for the same place is no branch option', [pl.steps.filter((s) => s.kind === 'travel' && s.place === 'warsz').map((s) => s.section), travelWarsz.alternatives.map((a) => a.section)], [['f/L1:14', 'f/L4:1'], []]);
  const travelMagone = pl.steps.find((s) => s.kind === 'travel' && s.place === 'magone');
  check('plan: other branches to the same knowledge are branch options', [travelMagone.section, travelMagone.alternatives.map((a) => a.section)], ['f/L4:4', ['f/L4:5', 'f/L4:6']]);
  const chosen = P.plan(st, 'magone', { gaps: [0, 1, 1], choices: new Map([['magone', 'f/L4:6']]) });
  check('plan: choosing an option recomputes from there', chosen.steps.filter((s) => s.kind === 'travel' && s.place === 'magone').map((s) => s.section)[0], 'f/L4:6');
  const zero = P.plan(S.stateOf(world, lines, learner, { levels: 0, knownShare: 1 }), 'magone');
  check('plan with 0 levels: no runs, learn until known', [zero.steps.some((s) => s.kind === 'run'), zero.steps.filter((s) => s.kind === 'know').map((s) => s.place)], [false, ['domkos', 'savio', 'warsz', 'magone']]);
  const one = P.plan(S.stateOf(world, lines, learner, { levels: 1, knownShare: 1 }), 'magone');
  check('plan with 1 level: one run each, no waiting', [one.steps.filter((s) => s.kind === 'run').length, one.steps.some((s) => s.kind === 'wait')], [4, false]);
  const five = P.plan(S.stateOf(world, lines, F.fakeLearner({ knowness: know, levels: Object.fromEntries(Object.keys(levels).map((p) => [p, 5])) }), { levels: 5, knownShare: 1 }), 'magone', { gaps: [0, 1, 1, 2, 3] });
  check('plan with 5 levels: five runs each, the gaps add up', [five.steps.filter((s) => s.kind === 'run' && s.place === 'magone').length, five.steps.filter((s) => s.kind === 'wait' && s.place === 'domkos').map((s) => s.from - learner.now)], [5, [DAY, 2 * DAY, 4 * DAY, 7 * DAY]]);
  const noSlide = P.plan(S.stateOf(world, lines, F.fakeLearner({}), { levels: 0, knownShare: 1 }), 'w_kapl');
  check('plan: cards that no section introduces are learned directly', noSlide.steps.filter((s) => s.place === 'w_kapl').map((s) => s.kind), ['learn', 'know']);
  const win = P.timetableWindow([1, 2, 3, 4, 5], [6, 7, 8, 9, 10, 11, 12]);
  check('timetable: 2 done above, the current one, 4 upcoming', [win.done, win.current, win.next, win.hiddenAbove, win.hiddenBelow], [[4, 5], 6, [7, 8, 9, 10], 3, 2]);
}

/* -- 400 besuchte Schritte: verliert die Kappung Abschnitte? (Korrektur 2) ------------------------------------------------------ */
{
  /* Das Bosko-Gerüst in seiner grössten Form (12 Folien, 36 Fragen, 9 Abstecher): S+2 + 2N + 4N+1 + N+1 + 1 + D + 1 Schritte. */
  const S_ = 12, N_ = 36, D_ = 9;
  const nodes = (S_ + 2) + 2 * N_ + (4 * N_ + 1) + (N_ + 1) + 1 + D_ + 1;
  check('cap: the largest Bosko-shaped flow has fewer steps than the cap (each step is kept once)', nodes < 400, true);
  /*
    Eine sehr lange Linie: nur die letzten 400 Schritte sind gemerkt. Step 3 · 4 — befahren ist nur, was selbst befahren wurde:
    ein Abschnitt, dessen Schritte alle aus „besucht" fielen, gilt nicht mehr als befahren. Kein echter Ablauf ist so lang (der
    grösste in Bosko-Gestalt bleibt unter 400, oben); wäre einer es, käme die kleine Menge „sections" (Korrektur 2).
  */
  const b = new F.FlowBuilder('LONG');
  const places = world.order.slice(0, 45);
  for (const p of places) { b.show(`s/${p}`); for (const k of world.places.get(p).cards.slice(0, 9)) b.ask(k); }
  b.end();
  const long = b.flow('f/long', { name: 'Długa', unit: 'u/L1' });
  const lw = L.linesOf(world, [long]);
  const all = long.graph.nodes.map((n) => n.id);
  const kept = all.slice(-400);
  const st = S.stateOf(world, lw, F.fakeLearner({ progress: { 'f/long': { visited: kept } } }), { levels: 0, knownShare: 1 });
  check('cap: a 450-step flow keeps only its last 400 steps…', [all.length > 400, kept.includes(all[0])], [true, false]);
  const secs = [...lw.sections.values()].filter((s) => s.kind !== 'return');
  const fellOut = secs.filter((s) => s.steps.every((x) => !kept.includes(x)));
  const stayed = secs.filter((s) => s.steps.includes(all[all.length - 2]));
  check('cap: … a section whose steps all fell out of the kept steps is no longer travelled; the last one is', [fellOut.length > 0, fellOut.every((s) => !st.sections.get(s.id).travelled), stayed.every((s) => st.sections.get(s.id).travelled)], [true, true, true]);
}

/* -- 2./3. Erzeugte Welten: 1 000 Orte / 40 Erzählungen, 5 000 Orte ------------------------------------------------------------ */
for (const [n, m, budget] of [[1000, 40, 2500], [5000, 150, 8000]]) {
  const t0 = performance.now();
  const input = F.generatedWorld({ places: n, stories: m, seed: 11 });
  const w = G.readWorld(input);
  const ls = L.linesOf(w, input.flows);
  const st = S.stateOf(w, ls, F.fakeLearner({}), { levels: 3, knownShare: 1 });
  for (const p of w.order.slice(0, 50)) st.routeTo(p);
  const ms = performance.now() - t0;
  check(`generated ${n}: all places read`, w.places.size, n);
  check(`generated ${n}: every story is a line with sections`, [...ls.lines.values()].filter((l) => !l.deepening).length >= m && [...ls.lines.values()].every((l) => l.sections.length > 0), true);
  check(`generated ${n}: sections join places (or Home)`, [...ls.sections.values()].every((s) => (s.from === HOME || w.places.has(s.from)) && w.places.has(s.to)), true);
  check(`generated ${n}: stations with 3-way forks exist`, [...ls.stations.values()].some((s) => s.forks.some((f) => f.branches.length >= 2)), true);
  check(`generated ${n}: model within ${budget} ms (took ${Math.round(ms)})`, ms < budget, true);
}

/* -- 4. Die kaputte Welt: jeder Fall aus §11 und den Korrekturen ----------------------------------------------------------------- */
{
  const input = F.brokenWorld();
  const w = G.readWorld(input);
  const ls = L.linesOf(w, input.flows);
  const codes = new Set([...w.issues, ...ls.issues].map((i) => i.code));
  const want = ['cycle', 'dangling', 'partAndPrerequisite', 'flowNoPlaces', 'unknownCondition', 'unreachableSteps', 'flowStartsLate', 'membersNotDetoured', 'requiresSiblingPrerequisite', 'placesWithoutLine', 'cardsWithoutSlide', 'lineStartsMid', 'unitMissing'];
  check('broken: every case is in the author list', want.filter((c) => !codes.has(c)), []);
  check('broken: a cycle becomes one group', w.groups, [['X', 'Y', 'Z']]);
  check('broken: a cycle group shares its base', [...w.base('X')].sort(), ['Y', 'Z']);
  check('broken: a field with part and prerequisite counts as prerequisite only', [w.places.get('P').block, w.places.get('P').needs], [undefined, ['A']]);
  check('broken: dangling references are ignored', w.places.get('D').needs, []);
  check('broken: a flow without places is not drawn', [ls.lines.has('f/empty'), ls.lines.has('f/ghostunit')], [false, false]);
  check('broken: the place without a line stands free', [...ls.sections.values()].some((s) => s.to === 'lonely' || s.from === 'lonely'), false);
  const st = S.stateOf(w, ls, F.fakeLearner({}), { levels: 0, knownShare: 1 });
  const qr = st.sections.get('f/mid:1');
  check('broken: an unknown condition type locks (fails closed)', [qr.ticket.met, qr.ticket.unknown, qr.ticket.symbol, qr.cost], [false, true, 'unknown', Infinity]);
  check('broken: … even inside "and"', st.sections.get('f/mid:3').ticket.unknown, true);
  const later = st.sections.get('f/mid:0');
  check('broken: a section requiring cards introduced only later shows their source', [later.ticket.missing.new.includes('q/C/0'), st.sources('q/C/0').map((s) => s.section)], [true, ['f/mid:3', 'f/mid:4']]);
  check('broken: the line starting mid-world starts at its required place', ls.lines.get('f/mid').start, 'C');
  check('broken: the unit requiring the stage\'s prerequisite instead of the stage', [...w.issues, ...ls.issues].filter((i) => i.code === 'requiresSiblingPrerequisite').map((i) => i.ids), [['u/deep', 'u/stage']]);
  check('broken: members of a unit its story never detours to', [...w.issues, ...ls.issues].filter((i) => i.code === 'membersNotDetoured').map((i) => i.ids), [['u/stage', 'u/member']]);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
