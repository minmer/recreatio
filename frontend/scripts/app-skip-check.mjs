/**
 * 2026-11-10 (Eigentümer: „keine leeren Entscheidungsfolien") — EIN SCHRITT, DER SICH ERÜBRIGT (`cogita/flow.ts`, `cogita/logic.ts`):
 *
 *   1. „in den letzten N Tagen beantwortet" (`answered` + `within`): gilt nur mit bekanntem Zeitpunkt, der nicht länger her ist.
 *   2. `skipWhen` an einem Schritt „dalej" (show, opening, line, scene ohne Frage): gilt die Bedingung, geht es gleich weiter.
 *   3. Eine Wahl, von der nur EINE Möglichkeit gilt, nimmt sie selbst; zwei gelten: sie hält an; `"hold": true`: sie hält an.
 *   4. Ketten: übersprungener Schritt → Wahl mit einer Möglichkeit → der Schritt dahinter, in einem Zug.
 *   5. Der Rand: eine Szene mit Frage überspringt nie; ein unbekanntes `skipWhen` (kein gültiger Typ) hält nicht auf.
 *
 *   node scripts/app-skip-check.mjs
 */
import { readLang, useLocale } from './i18n-node.mjs';
(await useLocale('pl')).dicts.de = await readLang('de');
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-skip-'));
await build({
  entryPoints: { logic: 'src/app/cogita/logic.ts', flow: 'src/app/cogita/flow.ts' },
  bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' },
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [L, F] = await Promise.all(['logic', 'flow'].map(load));
await rm(workspace, { recursive: true, force: true });

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};

const NOW = Date.parse('2026-11-10T12:00:00Z');
const DAY = 86_400_000;
const facts = (o = {}) => ({
  values: {}, knowness: (id) => o.knowness?.[id] ?? 0, answered: (id) => o.answered?.[id] ?? null,
  ...(o.answeredAt === undefined ? {} : { answeredAt: (id) => o.answeredAt[id] ?? null }),
  visited: new Set(), now: new Date(NOW)
});

/* -- 1 · „in den letzten N Tagen" ------------------------------------------------------------------------------------------ */
const recent = { type: 'answered', of: 'q', correct: true, within: 7 };
check('1: answered 3 days ago, right → holds', L.holds(recent, facts({ answered: { q: 1 }, answeredAt: { q: NOW - 3 * DAY } })), true);
check('1: answered 10 days ago → does not hold', L.holds(recent, facts({ answered: { q: 1 }, answeredAt: { q: NOW - 10 * DAY } })), false);
check('1: no known time → does not hold', L.holds(recent, facts({ answered: { q: 1 } })), false);
check('1: never answered → does not hold', L.holds(recent, facts({ answeredAt: {} })), false);
check('1: recent but wrong → does not hold', L.holds(recent, facts({ answered: { q: 0 }, answeredAt: { q: NOW - DAY } })), false);
check('1: without "within" the time does not matter', L.holds({ type: 'answered', of: 'q', correct: true }, facts({ answered: { q: 1 }, answeredAt: { q: NOW - 400 * DAY } })), true);
check('1: read keeps within; rubbish dropped', [L.readCondition({ type: 'answered', of: 'q', within: 7 }).within, L.readCondition({ type: 'answered', of: 'q', within: -3 }).within, L.readCondition({ type: 'knowness', of: 'q', within: 7 }).within], [7, undefined, undefined]);
check('1: in words', L.conditionText(recent, (x) => x).includes('7'), true);

/* -- Ein kleiner Ablauf: s → k (skipWhen) → c (Wahl) → a | b -------------------------------------------------------------- */
const node = (id, type, config = {}) => ({ id, type, x: 0, y: 0, config });
const edge = (from, out, to) => ({ id: `${from}-${out}`, from, out, to, in: 'in' });
const flowOf = (k = {}, c = {}) => F.readFlow('f', {
  start: 's',
  graph: {
    nodes: [
      node('s', 'show'),
      node('k', 'show', { skipWhen: recent, ...k }),
      node('c', 'choice', { options: [{ label: 'A', condition: { type: 'knowness', of: 'x', op: 'ge', than: 1 } }, { label: 'B', condition: { type: 'not', items: [{ type: 'knowness', of: 'x', op: 'ge', than: 1 }] } }], ...c }),
      node('a', 'show'), node('b', 'show')
    ],
    edges: [edge('s', 'next', 'k'), edge('k', 'next', 'c'), edge('c', 'o0', 'a'), edge('c', 'o1', 'b')]
  }
});
const ctxOf = (o) => ({ facts: () => facts(o), flows: () => undefined, members: () => [] });
const play = (flow, o) => { const ctx = ctxOf(o); return F.advance(flow, F.startFlow(flow), 'next', ctx).step; };

const knows = { knowness: { x: 1 } };
const knowsNot = { knowness: { x: 0 } };
const fresh = { answered: { q: 1 }, answeredAt: { q: NOW - DAY } };
const old = { answered: { q: 1 }, answeredAt: { q: NOW - 30 * DAY } };

/* -- 2 · skipWhen ------------------------------------------------------------------------------------------------------------ */
check('2: not answered lately → the slide k is shown', play(flowOf(), { ...old, ...knows }), 'k');
check('4: answered lately + knows x → k skipped, the choice takes A by itself → a', play(flowOf(), { ...fresh, ...knows }), 'a');
check('4: answered lately + does not know x → k skipped, only B is valid → b', play(flowOf(), { ...fresh, ...knowsNot }), 'b');

/* -- 3 · die Wahl --------------------------------------------------------------------------------------------------------- */
const twoValid = F.readFlow('f', { start: 's', graph: { nodes: [node('s', 'show'), node('c', 'choice', { options: [{ label: 'A' }, { label: 'B' }] }), node('a', 'show'), node('b', 'show')], edges: [edge('s', 'next', 'c'), edge('c', 'o0', 'a'), edge('c', 'o1', 'b')] } });
check('3: two valid options → the choice stops', play(twoValid, {}), 'c');
const oneOnly = F.readFlow('f', { start: 's', graph: { nodes: [node('s', 'show'), node('c', 'choice', { options: [{ label: 'Dalej' }] }), node('a', 'show')], edges: [edge('s', 'next', 'c'), edge('c', 'o0', 'a')] } });
check('3: a choice with one option goes on by itself', play(oneOnly, {}), 'a');
const held = F.readFlow('f', { start: 's', graph: { nodes: [node('s', 'show'), node('c', 'choice', { hold: true, options: [{ label: 'Dalej' }] }), node('a', 'show')], edges: [edge('s', 'next', 'c'), edge('c', 'o0', 'a')] } });
check('3: "hold": true keeps the choice', play(held, {}), 'c');
/* 2026-11-11 — eine Wahl mit eigener Folie ("of") wird immer gelesen: sie wählt nie selbst, auch mit einer einzigen Möglichkeit. */
const withOf = F.readFlow('f', { start: 's', graph: { nodes: [node('s', 'show'), node('c', 'choice', { of: 'slajd', title: 'Którędy?', options: [{ label: 'Dalej', hint: 'Krótko o drodze.' }] }), node('a', 'show')], edges: [edge('s', 'next', 'c'), edge('c', 'o0', 'a')] } });
check('3: a choice with "of" never chooses by itself (as if "hold": true)', play(withOf, {}), 'c');
check('3: "of" and "hint" are kept as written', [withOf.graph.nodes.find((n) => n.id === 'c').config.of, withOf.graph.nodes.find((n) => n.id === 'c').config.options[0].hint], ['slajd', 'Krótko o drodze.']);
const actions = F.readFlow('f', { start: 's', graph: { nodes: [node('s', 'show'), node('c', 'choice', { options: [{ label: 'Dalej', actions: [{ type: 'set', value: 'punkty', to: 5 }] }] }), node('a', 'show')], edges: [edge('s', 'next', 'c'), edge('c', 'o0', 'a')] } });
check('3: the actions of the taken option still run', (() => { const ctx = ctxOf({}); const st = F.advance(actions, F.startFlow(actions), 'next', ctx); return [st.step, st.values.punkty]; })(), ['a', 5]);
check('3: no option valid → the choice stops (nothing to take)', play(flowOf({}, { options: [{ label: 'A', condition: { type: 'knowness', of: 'zz', op: 'ge', than: 9 } }] }), { ...fresh }), 'c');

/* -- 5 · der Rand --------------------------------------------------------------------------------------------------------- */
const sceneQ = F.readFlow('f', { start: 's', graph: { nodes: [node('s', 'show'), node('k', 'scene', { question: true, skipWhen: recent }), node('a', 'show')], edges: [edge('s', 'next', 'k'), edge('k', 'next', 'a'), edge('k', 'right', 'a'), edge('k', 'wrong', 'a')] } });
check('5: a scene with a question is never skipped', play(sceneQ, fresh), 'k');
const sceneNo = F.readFlow('f', { start: 's', graph: { nodes: [node('s', 'show'), node('k', 'scene', { skipWhen: recent }), node('a', 'show')], edges: [edge('s', 'next', 'k'), edge('k', 'next', 'a')] } });
check('5: a scene without a question is skipped', play(sceneNo, fresh), 'a');
const bad = F.readFlow('f', { start: 's', graph: { nodes: [node('s', 'show'), node('k', 'show', { skipWhen: { type: 'nonsense' } }), node('a', 'show')], edges: [edge('s', 'next', 'k'), edge('k', 'next', 'a')] } });
check('5: an unreadable skipWhen does not skip (a missing condition would hold!)', play(bad, fresh), 'k');
const loop = F.readFlow('f', { start: 's', graph: { nodes: [node('s', 'show'), node('c', 'choice', { options: [{ label: 'x' }] })], edges: [edge('s', 'next', 'c'), edge('c', 'o0', 'c')] } });
check('5: a choice that leads back to itself ends instead of looping for ever', typeof play(loop, {}) !== 'undefined', true);

if (failed > 0) { console.error(`app-skip-check: ${failed} failed, ${passed} passed`); process.exit(1); }
console.log(`app-skip-check: ${passed} checks passed`);
