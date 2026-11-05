/**
 * 2026-11-05 (Prompt 23, C) — SELBSTTEST ÜBER DIE FRAGEN, ohne Oberfläche nachgemessen (`cogita/revision.ts`, `selfCheck.ts`,
 * `knowing.ts` rel "core", `flowFacts.ts`, `levelMap.ts` nestAsRegions, `selfCheckWords.ts`):
 *
 *   1. "mode": "once": jede Karte genau einmal, eine falsche kommt nicht wieder, der Lauf endet nach so vielen Antworten.
 *   2. "pick": "sample", "perTopic": n — je Thema höchstens n Karten, derselbe Same dieselbe Probe; unbekannte Werte: Vorgabe.
 *   3. Der Schritt "sample" in einem Graphen; „Uzupełnij luki“ = alle Karten der Lücken und eine Stichprobe der übrigen.
 *   4. Kernfragen: je Thema die markierten, ohne Markierung die erste Frage; jede einmal; Lücke = beantwortet und nicht gewusst.
 *   5. Bedingung "rel": "core" (each any, band unknown) für eine Karte: hält, solange die Kernfrage ihres Themas nicht sitzt.
 *   6. Die Übersicht je Thema: eine nicht ganz richtige Karte macht eine Lücke, die Lücken zuerst.
 *   7. Eine Erzählung, deren Fragen alle gekonnt sind, ist bestanden; ohne Fragen nicht.
 *   8. Der verschachtelte Krajobraz: ein einzelnes Thema neben Knoten heisst wie es selbst.
 *   9. Die Worte in drei Sprachen.
 *
 *   node scripts/app-selfcheck-check.mjs
 */
import { readLang, useLocale } from './i18n-node.mjs';
/* Polnisch für die Vergleiche — Deutsch dazu: eine Baza kann deutsch sprechen. */
(await useLocale('pl')).dicts.de = await readLang('de');
import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-selfcheck-'));
const entry = join(workspace, 'entry.ts');
const app = fileURLToPath(new URL('../src/app/', import.meta.url)).replace(/\\/g, '/');
await writeFile(entry, `
export { readPlan, start, answer, progress, sampleByTopic, coreIndex, REVISION_PALETTE } from '${app}cogita/revision';
export { coreCardsByTopic, selfCheckCards, gapTopics, fillCards, topicVerdicts } from '${app}cogita/selfCheck';
export { gauge, relSourceOf, cardRelated, factsOf } from '${app}cogita/knowing';
export { holds, readCondition } from '${app}cogita/logic';
export { step } from '${app}cogita/knowness';
export { storyStage, flowQuestionsKnown, cardOfQuestion } from '${app}cogita/flowFacts';
export { nestAsRegions } from '${app}cogita/levelMap';
export { selfCheckWords } from '${app}cogita/selfCheckWords';
`);
await build({
  entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: join(workspace, 'entry.mjs'),
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }, loader: { '.css': 'empty' }, logLevel: 'error'
});
const M = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
await rm(workspace, { recursive: true, force: true });

let failures = 0;
let passes = 0;
const check = (name, ok, detail = '') => {
  if (ok) { passes += 1; return; }
  failures += 1;
  console.error(`FAIL ${name}${detail === '' ? '' : ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
};

/** Eine Frage-Karte: `q` die Frage, `t` ihr Thema, `core` markiert. */
const card = (q, t, core = false) => ({ question: q, direction: '', key: `${q}:`, entity: q, prompt: [], answer: { form: 'text', answers: ['x'] }, explain: [`slide-${q}`, t], fingerprint: q, varies: false, requires: [], about: [t], ...(core ? { core: true } : {}) });
const NOW = Date.parse('2026-11-05T10:00:00Z');
const runAll = (plan, all, grade) => {
  let s = M.start({ plan, all, marks: () => [], deps: [], now: NOW, seed: 'x' });
  const asked = [];
  for (let i = 0; i < 200 && s.current !== null; i += 1) { asked.push(s.current); s = M.answer(s, grade(s.current), NOW + i * 1000).session; }
  return asked;
};

/* 1. once */
{
  const cards = [card('a', 'T1', true), card('b', 'T1'), card('c', 'T2', true), card('d', 'T2')];
  const asked = runAll(M.readPlan(cards, { mode: 'once', order: 'given', pick: 'next' }), cards, () => 0);
  check('1: jede Karte genau einmal (auch falsch)', asked.length === 4 && new Set(asked).size === 4, asked);
  const p = M.progress(M.start({ plan: M.readPlan(cards, { mode: 'once' }), all: cards, marks: () => [], deps: [], now: NOW, seed: 'x' }));
  check('1: feste Folge mit Gesamtzahl', p.total === 4, p);
}

/* 2. sample */
{
  const cards = [];
  for (let t = 0; t < 5; t += 1) for (let k = 0; k < 4; k += 1) cards.push(card(`q${t}-${k}`, `T${t}`));
  const plan = M.readPlan(cards, { mode: 'once', pick: 'sample', perTopic: 2 });
  check('2: pick sample gelesen', plan.pick === 'sample' && plan.perTopic === 2, plan);
  check('2: perTopic Vorgabe 2', M.readPlan(cards, { pick: 'sample' }).perTopic === 2);
  check('2: unbekannter pick — Vorgabe weighted', M.readPlan(cards, { pick: 'zufall' }).pick === 'weighted');
  const asked = runAll(plan, cards, () => 1);
  const per = new Map();
  for (const k of asked) { const t = cards.find((c) => c.key === k).about[0]; per.set(t, (per.get(t) ?? 0) + 1); }
  check('2: je Thema genau 2 gefragt', asked.length === 10 && [...per.values()].every((n) => n === 2), [...per]);
  const s1 = M.sampleByTopic(cards, 2, 'A').map((c) => c.key).join();
  check('2: derselbe Same, dieselbe Probe', s1 === M.sampleByTopic(cards, 2, 'A').map((c) => c.key).join());
  check('2: ein anderer Same, eine andere Probe', ['B', 'C', 'D', 'E'].some((x) => M.sampleByTopic(cards, 2, x).map((c) => c.key).join() !== s1));
}

/* 3. Schritt sample */
{
  const kind = M.REVISION_PALETTE.kinds?.get?.('sample') ?? (Array.isArray(M.REVISION_PALETTE.kinds) ? M.REVISION_PALETTE.kinds.find((k) => k.type === 'sample') : Object.values(M.REVISION_PALETTE).flat?.().find?.((k) => k?.type === 'sample'));
  check('3: Schritt "sample" in der Palette', kind !== undefined && kind !== null, Object.keys(M.REVISION_PALETTE));
  if (kind) {
    const cards = [];
    for (let t = 0; t < 3; t += 1) for (let k = 0; k < 5; k += 1) cards.push(card(`s${t}-${k}`, `S${t}`));
    const out = kind.run({ config: { perTopic: 1 }, inputs: { cards: [{ cards, when: new Map() }] }, ctx: { now: NOW, cards } });
    const res = out.cards ?? out;
    check('3: je Thema eine Karte', res.cards.length === 3, res.cards.length);
  }
}

/* 4. + 6. Kernfragen, Lücken, Übersicht */
{
  const cards = [card('k1', 'A', true), card('a2', 'A'), card('b1', 'B'), card('b2', 'B'), card('k3', 'C', true), card('c2', 'C')];
  const by = M.coreCardsByTopic(cards);
  check('4: markierte Kernfrage', by.get('A').map((c) => c.question).join() === 'k1');
  check('4: ohne Markierung die erste Frage', by.get('B').map((c) => c.question).join() === 'b1');
  check('4: jede Kernkarte einmal', M.selfCheckCards(cards).map((c) => c.question).join() === 'k1,k3,b1', M.selfCheckCards(cards).map((c) => c.question));
  check('4: nur im Gebiet', M.selfCheckCards(cards, new Set(['C'])).map((c) => c.question).join() === 'k3');
  const states = new Map([['k1:', M.step(null, { at: NOW - 60_000, correctness: 0 })], ['k3:', M.step(null, { at: NOW - 60_000, correctness: 1 })]]);
  const g = M.gapTopics(cards, (k) => states.get(k) ?? null, NOW);
  check('4: Lücke: beantwortet und nicht gewusst', [...g.gaps].join() === 'A', [...g.gaps]);
  check('4: geprüft: beide beantworteten, B nie', [...g.checked].sort().join() === 'A,C', [...g.checked]);
  const fill = M.fillCards(cards, g.gaps, g.checked, 'seed');
  check('4: Uzupełnij — alle Karten der Lücke und eine Probe aus C (nicht ihre Kernkarte)', fill.map((c) => c.question).join() === 'k1,a2,c2', fill.map((c) => c.question));
  check('4: ohne Lücken nichts', M.fillCards(cards, new Set(), g.checked, 's').length === 0);
  const v = M.topicVerdicts(cards, ['k1:', 'b1:', 'k3:'], new Set(['k1:']));
  check('6: je Thema, die Lücke zuerst', v.map((x) => `${x.topic}:${x.gap ? 'luka' : 'umiesz'}`).join() === 'A:luka,B:umiesz,C:umiesz', v);
  check('6: die Folie der Lücke', v[0].explain === 'slide-k1');
}

/* 5. rel core */
{
  const cards = [card('k1', 'A', true), card('a2', 'A')];
  const mk = (states) => M.gauge(cards, (k) => states.get(k) ?? null, [], NOW);
  const cond = M.readCondition({ type: 'knowness', rel: 'core', each: 'any', band: 'unknown' });
  check('5: Bedingung gelesen', cond !== null && cond.rel === 'core', cond);
  const at = (states) => { const g = mk(states); const src = M.relSourceOf(g, { entity: () => undefined, look: { kind: () => undefined, entity: () => undefined } }); return M.holds(cond, M.factsOf(g, (rel) => M.cardRelated(src, cards[1], rel))); };
  check('5: nie gefragt — unbekannt, hält', at(new Map()) === true);
  check('5: Kernfrage falsch — hält', at(new Map([['k1:', M.step(null, { at: NOW - 60_000, correctness: 0 })]])) === true);
  check('5: Kernfrage richtig — hält nicht', at(new Map([['k1:', M.step(null, { at: NOW - 60_000, correctness: 1 })]])) === false);
  check('5: coreIndex', (M.coreIndex(cards).get('A') ?? []).join() === 'k1');
}

/* 7. Erzählung bestanden */
{
  const cards = [card('f1', 'A'), card('f2', 'A')];
  const flow = { graph: { nodes: [{ id: 's1', type: 'show', config: {} }, { id: 'q1', type: 'question', config: { of: 'f1' } }, { id: 'q2', type: 'question', config: { of: 'f2' } }] } };
  const cardOf = M.cardOfQuestion(cards);
  check('7: alle gekonnt — ja', M.flowQuestionsKnown(flow, cardOf, () => true) === true);
  check('7: eine nicht — nein', M.flowQuestionsKnown(flow, cardOf, (k) => k === 'f1:') === false);
  check('7: ohne Fragen — nein', M.flowQuestionsKnown({ graph: { nodes: [{ id: 's', type: 'show', config: {} }] } }, cardOf, () => true) === false);
  check('7: storyStage passed', M.storyStage({ goals: [{ id: 'przeglad' }] }, undefined, true) === 'passed' && M.storyStage({ goals: [] }, undefined, false) === 'new');
}

/* 8. Verschachtelt */
{
  const ids = ['solo', 'x1', 'x2', 'y1', 'top1'];
  const tg = { graph: { ids, labels: ['Etap 3 w skrócie — temat', 'X1', 'X2', 'Y1', 'Ksiądz Bosko w zarysie'], needs: ids.map(() => []), rank: ids.map((_, i) => i), names: ids.map(() => []) }, node: Int32Array.from(ids.map((_, i) => i)), topicOf: Int32Array.from(ids.map((_, i) => i)) };
  const nodes = new Map([['E', { id: 'E', label: 'Etap', parent: null }], ['E3', { id: 'E3', label: 'Etap 3 w skrócie', parent: 'E' }], ['EX', { id: 'EX', label: 'Etap X', parent: 'E' }]]);
  const nest = { nodes, home: new Map([['solo', 'E3'], ['x1', 'EX'], ['x2', 'EX'], ['y1', 'E']]), children: new Map([[null, ['E']], ['E', ['E3', 'EX']]]) };
  const tree = M.nestAsRegions(nest, tg, (n) => `Inne: ${n}`, 'Cała mapa');
  check('8: ein Knoten mit einem Thema bleibt ein Gebiet', tree.regions.get('E3')?.topics.length === 1);
  check('8: ein einzelnes Thema neben Unterknoten heisst wie es selbst', tree.regions.get('E::rest')?.name === 'Y1', tree.regions.get('E::rest')?.name);
  check('8: ein einzelnes Thema oben heisst wie es selbst', tree.regions.get('::top')?.name === 'Ksiądz Bosko w zarysie', tree.regions.get('::top')?.name);
}

/* 9. Worte */
{
  for (const lang of ['pl', 'de', 'en']) {
    const S = M.selfCheckWords(lang);
    for (const [k, v] of Object.entries(S)) {
      const text = typeof v === 'function' ? v(2, 3) : v;
      check(`9: ${lang}.${k}`, typeof text === 'string' && text.trim() !== '' && !text.includes('undefined'), text);
    }
  }
}

if (failures > 0) { console.error(`app-selfcheck-check: ${failures} failed, ${passes} passed`); process.exit(1); }
console.log(`app-selfcheck-check: ${passes} checks passed`);
