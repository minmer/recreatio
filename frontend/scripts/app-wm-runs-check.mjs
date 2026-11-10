/**
 * 2026-11-09 — DIE WELTKARTE, TEIL 2: DURCHGÄNGE (spec §7, Entscheidungen 7–9), ohne Datenbank: die Stufe aus rohen
 * Durchgängen mit 0, 1, 3 und 5 Stufen; eine andere Einstellung rechnet die Stufe neu (nichts geht verloren); Wartezeiten
 * zwischen Stufen; die Freigabe als Bedingung (jede Karte erschienen, Voraussetzungen erobert); ein Durchgang Schritt für
 * Schritt (eine falsche Karte am Ende einmal wieder); Einstellungen des Admins und des Lernenden; `reviewable` aus Durchgängen.
 *
 *   node scripts/app-wm-runs-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('en');
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-wm-runs-'));
const entries = {
  runs: 'src/app/cogita/worldmap/wmRuns.ts', graph: 'src/app/cogita/worldmap/wmGraph.ts', lines: 'src/app/cogita/worldmap/wmLines.ts',
  state: 'src/app/cogita/worldmap/wmState.ts', fx: 'src/app/cogita/worldmap/wmFixtures.ts', store: 'src/app/cogita/store.ts',
  review: 'src/app/cogita/worldmap/wmReview.ts', features: 'src/app/cogita/worldmap/wmFeatures.ts', base: 'src/app/cogita/memoryBase.ts'
};
await build({
  entryPoints: entries, bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' },
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [R, G, L, S, F, ST, RV, FE, MB] = await Promise.all(Object.keys(entries).map(load));

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};
const DAY = R.DAY;
const T0 = Date.UTC(2026, 10, 1, 9);
const run = (id, place, startDay, first, after = 0, cards = 20) => ({ id, place, participants: ['me'], startedAt: T0 + startDay * DAY, finishedAt: T0 + startDay * DAY + 600_000, cards, firstTry: first, afterCorrection: after, attempts: cards + (cards - first) });

/* -- Einstellungen --------------------------------------------------------------------------------------------------- */
{
  check('setup: the default for three levels (spec §7.1, no gap between levels)', R.defaultRules(3), [{ pct: 75, attempts: 'any' }, { pct: 85, attempts: 'one' }, { pct: 95, attempts: 'first' }]);
  check('setup: read tolerantly, missing rules from the default; an old gapDays is ignored', R.readLevelsSetup({ levels: 2, rules: [{ pct: 60, gapDays: 3 }], knownShare: 80, pillarWidth: 70 }),
    { levels: 2, rules: [{ pct: 60, attempts: 'any' }, { pct: 85, attempts: 'one' }], knownShare: 0.8, pillarWidth: 0.7, locked: false });
  check('setup: levels are 0–5, pillar width 40–100 %', [R.readLevelsSetup({ levels: 9 }).levels, R.readLevelsSetup({ pillarWidth: 0.1 }).pillarWidth], [5, 0.4]);
  check('setup: the JSON round-trips', R.readLevelsSetup(R.levelsSetupDoc(R.readLevelsSetup({ levels: 3, locked: true }))), R.readLevelsSetup({ levels: 3, locked: true }));
  check('setup: in the base settings (readSettings)', ST.readSettings({ levelsSetup: { levels: 1 } }).levelsSetup?.levels, 1);
  check('setup: existing bases have no levels (decision 8)', [ST.readSettings({}).levelsSetup, R.effectiveWorld(undefined, {}).levels], [undefined, 0]);
  const own = R.withOwnLevels({ punkte: 3, '~world.l3.gap': 2 }, { levels: 3, rules: [{ pct: 70, attempts: 'one' }, { pct: 80, attempts: 'first' }, { pct: 90, attempts: 'first' }] });
  check('learner: own levels as numbers in the values (~world.*), an old gap value removed', [own['~world.levels'], own['~world.l2.attempts'], own['~world.l3.gap'], own.punkte], [3, 2, undefined, 3]);
  check('learner: … read back', R.ownWorld(own).rules?.map((r) => [r.pct, r.attempts]), [[70, 'one'], [80, 'first'], [90, 'first']]);
  check('learner: removing the own levels keeps everything else', R.withOwnLevels(own, null), { punkte: 3 });
  const area = R.readLevelsSetup({ levels: 3, pillarWidth: 0.7 });
  check('effective: own wins over the area', R.effectiveWorld(area, R.ownWorld(R.withOwnLevels({}, { levels: 1, rules: R.defaultRules(1) }))).levels, 1);
  check('effective: a locked area wins over own', R.effectiveWorld({ ...area, locked: true }, R.ownWorld(R.withOwnLevels({}, { levels: 1, rules: R.defaultRules(1) }))).levels, 3);
  check('effective: the pillar width is always the learner\'s choice', R.effectiveWorld({ ...area, locked: true }, R.ownWorld(R.withOwnPillar({}, 0.5))).pillarWidth, 0.5);
  check('effective: … else the area\'s, else full', [R.effectiveWorld(area, {}).pillarWidth, R.effectiveWorld(undefined, {}).pillarWidth], [0.7, 1]);
}

/* -- Die Stufe aus rohen Durchgängen: 0, 1, 3, 5 Stufen -------------------------------------------------------------- */
{
  const runs = [
    run('r1', 'P', 0, 14, 2),    /* 70 % first, 80 % one/any → L1 (75 % any) */
    run('r2', 'P', 0.2, 16, 2),  /* 90 % one, 80 % first → L2 (85 % one) — at once, no gap */
    run('r3', 'P', 1.5, 19, 1)   /* 95 % first → L3 */
  ];
  const at = (levels, rules = R.defaultRules(levels)) => R.levelOf(runs, rules, levels);
  check('0 levels: no level', at(0), { level: 0, reachedAt: [], perfect: false });
  check('1 level: the first good run conquers', [at(1).level, at(1).reachedAt.length], [1, 1]);
  const three = at(3);
  check('3 levels: L1 by r1, L2 by r2 (no gap any more), L3 by r3', [three.level, three.reachedAt.map((x) => Math.round((x - T0) / DAY * 10) / 10)], [3, [0, 0.2, 1.5]]);
  check('5 levels: L4 needs 98 % first — not yet', at(5).level, 3);
  /* 2026-11-09 (Eigentümer) — ein Durchgang hebt um jede Stufe, deren Regel er erfüllt; alles beim ersten Mal richtig: alle auf einmal. */
  const perfect = R.levelOf([run('x', 'P', 0, 20)], R.defaultRules(5), 5);
  check('one run, everything right the first time: every level at once, and "masterly"', [perfect.level, perfect.perfect, R.perfectRun(run('x', 'P', 0, 20))], [5, true, true]);
  check('one run good for two levels: both at once', R.levelOf([run('y', 'P', 0, 17, 2)], R.defaultRules(3), 3).level, 2);
  check('a run that is not all right first time is not masterly', [R.perfectRun(run('z', 'P', 0, 19, 1)), at(3).perfect], [false, false]);
  check('scores: first / one correction / any', [R.runScore(runs[0], 'first'), R.runScore(runs[0], 'one'), R.runScore(runs[0], 'any')], [0.7, 0.8, 0.8]);
  /* Eine andere Einstellung: die Stufe rechnet sich neu — die Durchgänge bleiben. */
  const strict = [{ pct: 85, attempts: 'first' }, { pct: 95, attempts: 'first' }, { pct: 100, attempts: 'first' }];
  check('setting changed: stricter rules → a lower level, recomputed', R.levelOf(runs, strict, 3).level, 2);
  check('setting changed back: the old level returns (nothing lost)', at(3).level, 3);
  check('setting changed: fewer levels → conquered earlier', at(2).level, 2);
  check('levels by place from all runs (Q: one masterly run → all three)', [...R.levelsByPlace([...runs, run('q1', 'Q', 0, 20)], R.defaultRules(3), 3).entries()].map(([p, v]) => [p, v.level]), [['P', 3], ['Q', 3]]);
  check('read: a run record is clamped and junk dropped', [R.readRun({ id: 'a', place: 'p', startedAt: 1, finishedAt: 0, cards: 4, firstTry: 9, afterCorrection: 9, attempts: 5 }), R.readRun({ id: 'a' })],
    [{ id: 'a', place: 'p', participants: [], startedAt: 1, finishedAt: 1, cards: 4, firstTry: 4, afterCorrection: 0, attempts: 5 }, null]);
}

/* -- Die Freigabe und die Stufen auf der Karte (die Bosko-Gestalt) ----------------------------------------------------- */
{
  const bx = F.boskoWorld();
  const world = G.readWorld(bx.input);
  const lines = L.linesOf(world, bx.input.flows);
  const cardsOf = (p) => world.places.get(p).cards;
  const learnedAll = (ps) => Object.fromEntries(ps.flatMap((p) => cardsOf(p).map((k) => [k, 0.5])));
  const rules = R.defaultRules(3);
  const runs = [run('b1', 'becchi', 0, 20, 0, 20), run('s1', 'sen', 3, 14, 2, 20)];
  const levels = R.levelsByPlace(runs, rules, 3);
  const stateFor = (know, now = T0 + 3.1 * DAY) => S.stateOf(world, lines, F.fakeLearner({ knowness: know, now, levels: Object.fromEntries([...levels].map(([p, v]) => [p, v.level])) }), { levels: 3, knownShare: 1 });
  const st = stateFor(learnedAll(['becchi', 'sen', 'kuglarz']));
  check('levels on the map come from the runs', [st.places.get('becchi').level, st.places.get('becchi').conquered, st.places.get('sen').level], [3, true, 1]);
  const gate = (s, p) => R.runGate(s.ctx, p, levels.get(p) ?? R.levelOf([], rules, 3), 3);
  check('run gate: a conquered place has no run', gate(st, 'becchi').kind, 'conquered');
  check('run gate: L2 of sen is ready at once (no gap)', gate(st, 'sen'), { kind: 'ready', level: 2 });
  const kug = gate(st, 'kuglarz');
  check('run gate: every card appeared, but the prerequisite sen is not conquered', [kug.kind, kug.needs], ['locked', ['sen']]);
  const unseen = gate(stateFor(learnedAll(['becchi', 'sen'])), 'kuglarz');
  check('run gate: cards that never appeared lock it too', [unseen.kind, unseen.unseen.length], ['locked', cardsOf('kuglarz').length]);
  check('run gate: no levels, no runs', R.runGate(st.ctx, 'sen', levels.get('sen'), 0).kind, 'none');
  const unlock = R.runUnlock(world, 'kuglarz');
  check('run unlock is a condition of the one language', [unlock.type, unlock.items.map((i) => i.type)], ['and', ['knowness', 'conquered']]);
  /* reviewable aus den Durchgängen. */
  const scope = { world, settings: { levels: 3 }, places: new Map([...world.places.keys()].map((p) => [p, { conquered: (levels.get(p)?.level ?? 0) >= 3 }])) };
  check('reviewable from runs: becchi conquered → its cards; sen not yet', [S.reviewable(cardsOf('becchi')[0], scope), S.reviewable(cardsOf('sen')[0], scope)], [true, false]);
}

/* -- Ein Durchgang Schritt für Schritt (Entscheidung 7) ----------------------------------------------------------------- */
{
  const cards = ['a', 'b', 'c', 'd'];
  let s = R.startRun('run-x', 'P', cards, T0);
  check('session: every card once, in a seeded random order', [s.order.length, [...s.order].sort(), R.startRun('run-x', 'P', cards, T0).order.join() === s.order.join()], [4, cards, true]);
  const answers = { a: [0, 1], b: [1], c: [0, 0, 1], d: [0.5, 1] };
  const seen = [];
  let guard = 0;
  while (!R.runDone(s) && guard < 20) {
    guard += 1;
    const k = R.runCard(s);
    seen.push(k);
    const list = answers[k];
    s = R.runAnswer(s, k, list.shift());
  }
  check('session: wrong cards come back at the end until right (c: twice)', [seen.slice(0, 4).sort(), seen.slice(4, 7).sort(), seen.slice(7), seen.length], [cards, ['a', 'c', 'd'], ['c'], 8]);
  const rec = R.finishRun(s, T0 + 60_000, ['me']);
  check('session: right first time / after one correction / later (§2.3) / attempts', [rec.cards, rec.firstTry, rec.afterCorrection, rec.laterRight, rec.attempts], [4, 1, 2, 1, 8]);
  check('session (§2.3): "any" counts the later right answer, "one" does not', [R.runScore(rec, 'one'), R.runScore(rec, 'any')], [0.75, 1]);
  check('session: partly right is not right', R.runScore(rec, 'one'), 0.75);
  check('session: an answer for another card than asked is ignored', R.runAnswer(R.startRun('y', 'P', ['a', 'b'], T0), 'zz', 1).attempts, 0);
  /* Eine Karte, die nie sitzt, kommt höchstens MAX_ASKS Mal. */
  let never = R.startRun('n', 'P', ['x'], T0);
  for (let i = 0; i < 10 && !R.runDone(never); i += 1) never = R.runAnswer(never, 'x', 0);
  check('session: a card that never sits is asked at most MAX_ASKS times', never.attempts, R.MAX_ASKS);
  /* 2026-11-09/10 (Eigentümer) — es reicht, wenn alle Infos gefragt wurden, nicht jede Kombination. */
  const facts = { p1: R.factsOfCard({ key: 'p1', entity: 'e', template: 't' }), p2: R.factsOfCard({ key: 'p2', entity: 'e', template: 't' }), p3: R.factsOfCard({ key: 'p3', entity: 'e', template: 't' }), q: R.factsOfCard({ key: 'q' }), f1: R.factsOfCard({ key: 'f1', facts: ['e#a'] }), f2: R.factsOfCard({ key: 'f2', facts: ['e#a'], entity: 'e', template: 'u' }) };
  let g = R.startRun('grp', 'P', Object.keys(facts), T0, facts);
  const asked = [];
  for (let i = 0; i < 20 && !R.runDone(g); i += 1) { const k = R.runCard(g); asked.push(k); g = R.runAnswer(g, k, 1); }
  const grec = R.finishRun(g, T0 + 1, ['me']);
  check('same thing: one card of each group is asked (entry + template, or the same facts), the others count with it', [asked.length, grec.cards, grec.firstTry, R.perfectRun(grec)], [3, 6, 6, true]);
  /* Sechs Paare, jede Karte fragt vier davon (alle 15 Kombinationen): sobald jedes Paar einmal sass, ist der Rest erledigt. */
  const pairs = ['a', 'b', 'c', 'd', 'e', 'f'];
  const combos = [];
  for (let i = 0; i < 6; i += 1) for (let j = i + 1; j < 6; j += 1) combos.push(pairs.filter((_, k) => k !== i && k !== j));
  const comboFacts = Object.fromEntries(combos.map((c, i) => [`m${i}`, R.factsOfCard({ key: `m${i}`, facts: c.map((x) => `list#${x}`) })]));
  let m = R.startRun('combo', 'P', Object.keys(comboFacts), T0, comboFacts);
  const askedM = [];
  for (let i = 0; i < 40 && !R.runDone(m); i += 1) { const k = R.runCard(m); askedM.push(k); m = R.runAnswer(m, k, 1); }
  check('combinations: 15 cards of 4 out of 6 pairs — asked only until every pair was in a right card, not all 15', [askedM.length < 15 && askedM.every((k, i) => comboFacts[k].some((f) => !askedM.slice(0, i).flatMap((x) => comboFacts[x]).includes(f))), new Set(askedM.flatMap((k) => comboFacts[k])).size, R.finishRun(m, T0 + 1, ['me']).firstTry], [true, 6, 15]);
  let w = R.startRun('grp', 'P', Object.keys(facts), T0, facts);
  const asked2 = [];
  for (let i = 0; i < 30 && !R.runDone(w); i += 1) { const k = R.runCard(w); asked2.push(k); w = R.runAnswer(w, k, asked2.filter((x) => x === k).length === 1 && k.startsWith('p') ? 0 : 1); }
  check('same thing: a wrong answer does not cover the others — each is asked', ['p1', 'p2', 'p3'].every((k) => asked2.includes(k)), true);
}

/* -- Step 3 · 1: eine ausgesetzte Karte sperrt ihren Ort nie (sie wird nie gefragt) --------------------------------------- */
{
  const bx = F.boskoWorld();
  const world = G.readWorld(bx.input);
  const lines = L.linesOf(world, bx.input.flows);
  const p = [...world.places.values()].find((x) => x.needs.length === 0 && x.cards.length >= 3);
  const [off, ...rest] = p.cards;
  const withOff = (knowness, cards = [off]) => ({ ...F.fakeLearner({ knowness }), suspended: (k) => cards.includes(k) });
  const st = S.stateOf(world, lines, withOff(Object.fromEntries(rest.map((k) => [k, 0.5]))), { levels: 1, knownShare: 1 });
  const ps = st.places.get(p.id);
  check('suspended: every other card appeared — the place counts as appeared, its counts leave the card out', [ps.appeared, ps.total, ps.unseen, (ps.cards ?? p.cards).includes(off)], [true, p.cards.length - 1, 0, false]);
  check('suspended: the run can start — the suspended card neither locks it nor is asked', R.runGate(st.ctx, p.id, { level: 0, reachedAt: [], perfect: false }, 1).kind, 'ready');
  const st0 = S.stateOf(world, lines, withOff(Object.fromEntries(rest.map((k) => [k, 3]))), { levels: 0, knownShare: 1 });
  check('suspended, 0 levels: every other card known — the place is fulfilled and flat', [st0.places.get(p.id).conquered, st0.places.get(p.id).height], [true, 0]);
  const above = [...world.places.values()].find((x) => world.base(x.id).has(p.id));
  const h1 = S.stateOf(world, lines, withOff({}), { levels: 1, knownShare: 1 }).places.get(above.id).height;
  const h0 = S.stateOf(world, lines, F.fakeLearner({}), { levels: 1, knownShare: 1 }).places.get(above.id).height;
  check('suspended: the height of a place built on it leaves the card out', h0 - h1, 1);
  const all = S.stateOf(world, lines, withOff({}, p.cards), { levels: 1, knownShare: 1 }).places.get(p.id);
  check('suspended: a place whose every card is suspended blocks nothing (it counts as conquered)', [all.conquered, all.height, all.dot], [true, 0, null]);
}

/* -- Step 3 · 2: Wiederholungen schliessen nur Orte aus, die eine Weltkarte der Baza zeigt (mit ihren Ortsarten) -------------- */
{
  const docOf = (world) => ({
    format: 'recreatio.cogita.course', version: 1, name: 'Orte und Aspekte',
    kinds: [
      { ref: '@t/temat', name: 'Temat', label: '{name}', fields: [{ key: 'name', label: 'Name', type: 'line' }] },
      { ref: '@t/aspekt', name: 'Aspekt', label: '{name}', fields: [{ key: 'name', label: 'Name', type: 'line' }] }
    ],
    entities: [
      { ref: '@t/a', kinds: ['@t/temat'], data: { name: 'Temat A' } },
      { ref: '@t/x', kinds: ['@t/aspekt'], data: { name: 'Aspekt X' } },
      { ref: '@t/q1', kinds: ['question'], data: { form: 'one', prompt: 'O temacie', options: ['Tak', 'Nie'], correct: [0], about: ['@t/a'] } },
      { ref: '@t/q2', kinds: ['question'], data: { form: 'one', prompt: 'O aspekcie', options: ['Tak', 'Nie'], correct: [0], about: ['@t/x'] } }
    ],
    views: [{ ref: '@t/v', name: 'Mapa', mode: 'landscape', steps: [{ type: 'source.kind', config: { kind: '@t/temat' } }], landscape: world ? { style: 'world' } : {} }]
  });
  const learner = { holder: { kind: 'local' }, progress: { values: { '~world.levels': 1 }, runs: new Map() } };
  const scopeOf = async (world) => {
    const made = await MB.memoryBase(docOf(world));
    if ('error' in made) throw new Error(made.error);
    const cards = (await made.lib.cards()).cards;
    const by = (label) => cards.find((c) => (c.about ?? []).some((id) => made.lib.label(made.lib.entity(id)) === label))?.key;
    return { scope: RV.reviewScopeFor(made.lib, cards, learner), topic: by('Temat A'), aspect: by('Aspekt X') };
  };
  const w = await scopeOf(true);
  check('review scope: a card whose place the world view shows waits for its conquest (1 level, no run)', S.reviewable(w.topic, w.scope), false);
  check('review scope: a card about an entry the world view does not show as a place stays in reviews', S.reviewable(w.aspect, w.scope), true);
  const hex = await scopeOf(false);
  check('review scope: a base without a world view — levels leave every card in reviews', [hex.scope, S.reviewable(hex.topic, hex.scope), S.reviewable(hex.aspect, hex.scope)], [null, true, true]);

  /* -- Step 3 · 3: nach einem Durchgang (oder einer anderen Stufen-Einstellung) zählt der Dienst neu — mit frischem Bereich -- */
  const made = await MB.memoryBase(docOf(true));
  const cards = (await made.lib.cards()).cards;
  const topicCard = cards.find((c) => (c.about ?? []).some((id) => made.lib.label(made.lib.entity(id)) === 'Temat A'));
  const place = topicCard.about[0];
  const reported = [];
  const learnerWith = (runs) => ({ holder: { kind: 'local' }, progress: { values: { '~world.levels': 1 }, runs }, reportDue: async (cs, rename, now, scope) => { reported.push({ count: cs.length, scope }); return { next: null, count: 0 }; } });
  const report = typeof RV.reportDueFor === 'function' ? RV.reportDueFor : async () => undefined;
  await report(made.lib, cards, learnerWith(new Map()));
  const conquering = { id: 'r1', place, participants: ['me'], startedAt: T0, finishedAt: T0 + 60_000, cards: 1, firstTry: 1, afterCorrection: 0, attempts: 1 };
  await report(made.lib, cards, learnerWith(new Map([['r1', conquering]])));
  check('due report: reported with all cards of the base and the scope of now (before the run: the topic card waits)', [reported.length, reported[0]?.count, reported[0] === undefined ? 'none' : S.reviewable(topicCard.key, reported[0].scope)], [2, cards.length, false]);
  check('due report: after the conquering run the same card is a review again (a fresh scope, not a kept one)', reported[1] === undefined ? 'none' : S.reviewable(topicCard.key, reported[1].scope), true);

  /* Step 3 · 9 — der Speicher der Welt hängt an den Karten selbst, nicht an ihrer Zahl. */
  const first = RV.reviewWorldOf(made.lib, cards);
  const swapped = cards.map((c) => (c.key === topicCard.key ? { ...c, key: 'q/swapped' } : c));
  const second = RV.reviewWorldOf(made.lib, swapped);
  check('Step 3 · 9: other cards of the same count → the world is computed again', [first.cardPlaces.has('q/swapped'), second.cardPlaces.has('q/swapped'), second.cardPlaces.has(topicCard.key)], [false, true, false]);
  check('Step 3 · 9: the same cards again → the kept world', RV.reviewWorldOf(made.lib, swapped) === second, true);
}

/* -- PR A: bis der Dienst Durchgänge speichert, gelten 0 Stufen (wmFeatures.ts) ---------------------------------------- */
{
  const kept = new Map();
  globalThis.localStorage = { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => { kept.set(k, String(v)); }, removeItem: (k) => { kept.delete(k); } };
  const area = { ...R.DEFAULT_SETUP, levels: 3, rules: R.defaultRules(3) };
  const lib = { settings: () => ({ levelsSetup: area }) };
  const learner = (kind) => ({ holder: { kind }, progress: { values: {}, runs: new Map() } });
  const role = learner('role');
  const offRole = RV.effectiveWorldFor(lib, role);
  check('probe: no answer yet — an account learner gets 0 levels (serverOld), so no review leaves', [offRole.levels, offRole.rules.length, offRole.serverOld], [0, 0, true]);
  check('probe: a learner without an account keeps the levels (runs stay in the browser)', [RV.effectiveWorldFor(lib, learner('local')).levels, RV.effectiveWorldFor(lib, learner('local')).serverOld], [3, undefined]);
  check('probe: without levels nothing is marked', RV.effectiveWorldFor({ settings: () => ({}) }, role).serverOld, undefined);
  check('probe: the review scope is empty while runs are off (every card reviewable)', RV.reviewScopeFor(lib, [], role), null);
  let heard = 0;
  const stop = FE.onServerRuns(() => { heard += 1; });
  FE.keepServerRuns(true);
  const onRole = RV.effectiveWorldFor(lib, role);
  check('probe: once the server stores runs, the levels apply (and listeners hear it)', [onRole.levels, onRole.serverOld, heard, FE.serverRuns()], [3, undefined, 1, true]);
  FE.keepServerRuns(false);
  check('probe: an older server again — 0 levels', RV.effectiveWorldFor(lib, role).levels, 0);
  stop();
  FE.keepServerRuns(true);
  check('probe: a stopped listener hears nothing', heard, 2);
  delete globalThis.localStorage;
  check('probe: no storage at all (node, private window) — no', [FE.serverRuns(), FE.runsOn({ kind: 'role' }), FE.runsOn({ kind: 'local' }), FE.runsOn(null)], [false, false, true, false]);
}

console.log(`\n${passed} passed, ${failed} failed`);
/* -- 2026-11-10 · wann sich die Pfade eines Turms öffnen (`levelsSetup.openAt`) ---------------------------------------------------- */
{
  const doc = (levels, openAt) => R.levelsSetupDoc(R.readLevelsSetup({ levels, ...(openAt === undefined ? {} : { openAt }) }));
  check('openAt: read and written back — 0 and a level below the last', [doc(3, 0).openAt, doc(3, 2).openAt], [0, 2]);
  check('openAt: the last level or more is the default (no value kept); rubbish too', [doc(3, 3).openAt, doc(3, 9).openAt, doc(3, -1).openAt, doc(3, 'x').openAt, doc(3).openAt], [undefined, undefined, undefined, undefined, undefined]);
  check('openAt: with 0 levels only 0 means something', [doc(0, 0).openAt, doc(0, 1).openAt], [0, undefined]);
  check('openAt: reaches the effective world; a learner cannot change it', [R.effectiveWorld(R.readLevelsSetup({ levels: 3, openAt: 1 }), {}).openAt, R.effectiveWorld(R.readLevelsSetup({ levels: 3, openAt: 1 }), { levels: 2 }).openAt, R.effectiveWorld(undefined, {}).openAt], [1, 1, null]);
}

if (failed > 0) process.exit(1);
