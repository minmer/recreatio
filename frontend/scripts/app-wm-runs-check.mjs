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
  state: 'src/app/cogita/worldmap/wmState.ts', fx: 'src/app/cogita/worldmap/wmFixtures.ts', store: 'src/app/cogita/store.ts'
};
await build({
  entryPoints: entries, bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' },
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [R, G, L, S, F, ST] = await Promise.all(Object.keys(entries).map(load));

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
  check('setup: the default for three levels (spec §7.1)', R.defaultRules(3), [{ pct: 75, attempts: 'any', gapDays: 0 }, { pct: 85, attempts: 'one', gapDays: 1 }, { pct: 95, attempts: 'first', gapDays: 1 }]);
  check('setup: read tolerantly, missing rules from the default', R.readLevelsSetup({ levels: 2, rules: [{ pct: 60 }], knownShare: 80, pillarWidth: 70 }),
    { levels: 2, rules: [{ pct: 60, attempts: 'any', gapDays: 0 }, { pct: 85, attempts: 'one', gapDays: 1 }], knownShare: 0.8, pillarWidth: 0.7, locked: false });
  check('setup: levels are 0–5, pillar width 40–100 %', [R.readLevelsSetup({ levels: 9 }).levels, R.readLevelsSetup({ pillarWidth: 0.1 }).pillarWidth], [5, 0.4]);
  check('setup: the JSON round-trips', R.readLevelsSetup(R.levelsSetupDoc(R.readLevelsSetup({ levels: 3, locked: true }))), R.readLevelsSetup({ levels: 3, locked: true }));
  check('setup: in the base settings (readSettings)', ST.readSettings({ levelsSetup: { levels: 1 } }).levelsSetup?.levels, 1);
  check('setup: existing bases have no levels (decision 8)', [ST.readSettings({}).levelsSetup, R.effectiveWorld(undefined, {}).levels], [undefined, 0]);
  const own = R.withOwnLevels({ punkte: 3 }, { levels: 3, rules: [{ pct: 70, attempts: 'one', gapDays: 0 }, { pct: 80, attempts: 'first', gapDays: 2 }, { pct: 90, attempts: 'first', gapDays: 3 }] });
  check('learner: own levels as numbers in the values (~world.*)', [own['~world.levels'], own['~world.l2.attempts'], own['~world.l3.gap'], own.punkte], [3, 2, 3, 3]);
  check('learner: … read back', R.ownWorld(own).rules?.map((r) => [r.pct, r.attempts, r.gapDays]), [[70, 'one', 0], [80, 'first', 2], [90, 'first', 3]]);
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
    run('r2', 'P', 0.2, 18, 1),  /* 95 % one — but L2 needs one day after L1 */
    run('r3', 'P', 1.5, 16, 2),  /* 90 % one → L2 (85 % one, 1 day) */
    run('r4', 'P', 2.0, 19, 1),  /* 95 % first, but only half a day after L2 → too early */
    run('r5', 'P', 2.6, 19, 1)   /* 95 % first, 1.1 days after L2 → L3 */
  ];
  const at = (levels, rules = R.defaultRules(levels)) => R.levelOf(runs, rules, levels);
  check('0 levels: no level, no next', at(0), { level: 0, reachedAt: [], nextAt: null });
  check('1 level: the first good run conquers', [at(1).level, at(1).reachedAt.length, at(1).nextAt], [1, 1, null]);
  const three = at(3);
  check('3 levels: L1 by r1, L2 by r3 (r2 too early), L3 by r5 (r4 too early)', [three.level, three.reachedAt.map((x) => Math.round((x - T0) / DAY * 10) / 10)], [3, [0, 1.5, 2.6]]);
  check('5 levels: L4 needs 3 days after L3 — not yet', [at(5).level, Math.round((at(5).nextAt - T0) / DAY * 10) / 10], [3, 5.6]);
  check('a run raises at most one level', R.levelOf([run('x', 'P', 0, 20)], R.defaultRules(3), 3).level, 1);
  check('scores: first / one correction / any', [R.runScore(runs[0], 'first'), R.runScore(runs[0], 'one'), R.runScore(runs[0], 'any')], [0.7, 0.8, 0.8]);
  /* Eine andere Einstellung: die Stufe rechnet sich neu — die Durchgänge bleiben. */
  const strict = [{ pct: 85, attempts: 'first', gapDays: 0 }, { pct: 95, attempts: 'first', gapDays: 1 }, { pct: 100, attempts: 'first', gapDays: 1 }];
  check('setting changed: stricter rules → a lower level, recomputed', R.levelOf(runs, strict, 3).level, 2);
  check('setting changed back: the old level returns (nothing lost)', at(3).level, 3);
  check('setting changed: fewer levels → conquered earlier', at(2).level, 2);
  check('levels by place from all runs', [...R.levelsByPlace([...runs, run('q1', 'Q', 0, 20)], R.defaultRules(3), 3).entries()].map(([p, v]) => [p, v.level]), [['P', 3], ['Q', 1]]);
  const waiting = R.levelOf(runs.slice(0, 1), R.defaultRules(3), 3);
  check('waiting gap: after L1 the next counts from one day later', [waiting.level, waiting.nextAt - waiting.reachedAt[0]], [1, DAY]);
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
  const runs = [run('b1', 'becchi', 0, 20, 0, 20), run('b2', 'becchi', 1.2, 20, 0, 20), run('b3', 'becchi', 2.4, 20, 0, 20), run('s1', 'sen', 3, 18, 2, 20)];
  const levels = R.levelsByPlace(runs, rules, 3);
  const stateFor = (know, now = T0 + 3.1 * DAY) => S.stateOf(world, lines, F.fakeLearner({ knowness: know, now, levels: Object.fromEntries([...levels].map(([p, v]) => [p, v.level])) }), { levels: 3, knownShare: 1 });
  const st = stateFor(learnedAll(['becchi', 'sen', 'kuglarz']));
  check('levels on the map come from the runs', [st.places.get('becchi').level, st.places.get('becchi').conquered, st.places.get('sen').level], [3, true, 1]);
  const gate = (s, p, now = T0 + 3.1 * DAY) => R.runGate(s.ctx, p, levels.get(p) ?? R.levelOf([], rules, 3), 3, now);
  check('run gate: a conquered place has no run', gate(st, 'becchi').kind, 'conquered');
  check('run gate: L2 of sen waits one day after L1', [gate(st, 'sen').kind, Math.round((gate(st, 'sen').from - T0) / DAY * 100) / 100], ['wait', 4.01]);
  check('run gate: … and opens after the gap', gate(st, 'sen', T0 + 4.2 * DAY), { kind: 'ready', level: 2 });
  const kug = gate(st, 'kuglarz');
  check('run gate: every card appeared, but the prerequisite sen is not conquered', [kug.kind, kug.needs], ['locked', ['sen']]);
  const unseen = gate(stateFor(learnedAll(['becchi', 'sen'])), 'kuglarz');
  check('run gate: cards that never appeared lock it too', [unseen.kind, unseen.unseen.length], ['locked', cardsOf('kuglarz').length]);
  check('run gate: no levels, no runs', R.runGate(st.ctx, 'sen', levels.get('sen'), 0, T0).kind, 'none');
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
  const answers = { a: [0, 1], b: [1], c: [0, 0], d: [0.5, 1] };
  const seen = [];
  let guard = 0;
  while (!R.runDone(s) && guard < 20) {
    guard += 1;
    const k = R.runCard(s);
    seen.push(k);
    const list = answers[k];
    s = R.runAnswer(s, k, list.shift());
  }
  check('session: wrong cards come back once, at the end', [seen.slice(0, 4).sort(), seen.slice(4).sort(), seen.length], [cards, ['a', 'c', 'd'], 7]);
  const rec = R.finishRun(s, T0 + 60_000, ['me']);
  check('session: right first time / after one correction / attempts', [rec.cards, rec.firstTry, rec.afterCorrection, rec.attempts], [4, 1, 2, 7]);
  check('session: partly right is not right', R.runScore(rec, 'one'), 0.75);
  check('session: an answer for another card than asked is ignored', R.runAnswer(R.startRun('y', 'P', ['a', 'b'], T0), 'zz', 1).attempts, 0);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
