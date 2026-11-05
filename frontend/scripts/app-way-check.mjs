/**
 * 2026-11-05 (Weg) — DER WEG ZU EINEM THEMA IN SCHRITTEN, ohne Leinwand nachgemessen (`cogita/worldWay.ts`):
 *
 *   1. Zwei Anfänge, einer wartet: braucht ein Thema zwei, kommen ihre Punkte im selben Schritt an (der frühere wartet).
 *   2. Eine Raute: der Punkt teilt sich und trifft sich wieder (beide Sprünge in denselben Schritt).
 *   3. Über Gekonntes hinweg: was vor einem gekonnten Thema fehlt, fehlt trotzdem; ein gekonntes Fundament wird nie Weg.
 *   4. Ein Kreis ist ein Schritt (zwischen seinen Themen springt nichts).
 *   5. Kein Weg: gekonnt, jetzt lernbar, ausserhalb der Karte.
 *   6. Für jeden Weg: jeder Sprung geht vorwärts, alle Sprünge zu einem Thema landen zur selben Zeit, das Ziel zuletzt, jedes
 *      Thema ausser den Anfängen bekommt einen Punkt; der Schritt ist die längste Kette (= die Stufe der Säule − 1).
 *   7. Der Takt: je Schritt 280–600 ms, alle Schritte höchstens etwa 5 s (sehr viele: 280 ms je Schritt); „ograniczone"
 *      ohne Sprünge, „wyłączone" ohne Zeit; Warten nur zwischen Ankunft und letztem Sprung.
 *   8. 5 000 Themen (zufälliger Graph, viel Gekonntes): der Weg zu jedem der 40 tiefsten Themen in wenigen Millisekunden.
 *   9. Die Worte des Weges in drei Sprachen.
 *
 *   node scripts/app-way-check.mjs
 */
import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-way-'));
const entry = join(workspace, 'entry.ts');
const app = fileURLToPath(new URL('../src/app/', import.meta.url)).replace(/\\/g, '/');
await writeFile(entry, `
export * from '${app}cogita/worldWay';
export { landscapeWords } from '${app}cogita/landscapeWords';
`);
await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: join(workspace, 'entry.mjs'),
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) },
  loader: { '.css': 'empty' },
  logLevel: 'error'
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

/** Ein Graph aus Namen: `needs` je Name (was es braucht), `known` gekonnt. */
function graph(spec, known = []) {
  const names = Object.keys(spec);
  for (const list of Object.values(spec)) for (const x of list) if (!names.includes(x)) names.push(x);
  const at = new Map(names.map((x, i) => [x, i]));
  const needs = names.map((x) => (spec[x] ?? []).map((y) => at.get(y)));
  const opens = names.map(() => []);
  needs.forEach((list, u) => { for (const p of list) opens[p].push(u); });
  const k = new Set(known.map((x) => at.get(x)));
  return { names, at, needs, opens, open: (t) => !k.has(t) };
}
const planOf = (g, target) => M.wayPlan({ target: g.at.get(target), needs: g.needs, opens: g.opens, open: g.open });
const beatOf = (g, plan, name) => { const i = plan.tiles.indexOf(g.at.get(name)); return i < 0 ? -1 : plan.tileBeat[i]; };
const hopsOf = (g, plan) => plan.hops.map((h) => `${g.names[h.from]}>${g.names[h.to]}@${h.beat}`).sort();

/** Was für jeden Weg gelten muss. */
function invariants(label, g, plan) {
  const name = (t) => g?.names?.[t] ?? t;
  const beat = new Map(plan.tiles.map((t, i) => [t, plan.tileBeat[i]]));
  const back = plan.hops.filter((h) => !(beat.get(h.to) === h.beat && beat.get(h.from) < h.beat));
  check(`${label}: jeder Sprung vorwärts`, back.length === 0, back.slice(0, 3));
  const into = new Map();
  for (const h of plan.hops) { const list = into.get(h.to) ?? []; list.push(h); into.set(h.to, list); }
  const times = M.wayTimes(plan.beats, 'full');
  const apart = [...into].filter(([, list]) => new Set(list.map((h) => h.beat)).size !== 1 || new Set(list.map((h) => M.landsAt(times, h))).size !== 1);
  check(`${label}: alle Punkte zu einem Thema landen zugleich`, apart.length === 0, apart.slice(0, 2).map(([t]) => name(t)));
  check(`${label}: das Ziel zuletzt`, Math.max(...plan.tileBeat) === plan.beats && beat.get(plan.target) === plan.beats);
  const joins = new Set(plan.joins);
  const dark = [...beat].filter(([t, b]) => b > 0 && t !== plan.target && !into.has(t) && !joins.has(t));
  check(`${label}: jedes Thema nach dem Anfang bekommt einen Punkt (Sprung oder mit seinem Kreis)`, dark.length === 0, dark.slice(0, 3).map(([t]) => name(t)));
  const loose = [...joins].filter((t) => into.has(t) || !plan.hops.some((h) => beat.get(h.to) === beat.get(t)));
  check(`${label}: ein Thema ohne eigenen Sprung liegt in einem Kreis, zu dem einer führt`, loose.length === 0, loose.slice(0, 3).map(name));
  /* Kein Punkt bleibt liegen: von jedem Thema ausser dem Ziel (und seinem Kreis) springt einer weiter. */
  const from = new Set(plan.hops.map((h) => h.from));
  const stuck = [...beat].filter(([t, b]) => b < plan.beats && !from.has(t));
  check(`${label}: von jedem Thema vor dem Ziel springt ein Punkt weiter`, stuck.length === 0, stuck.slice(0, 3).map(([t]) => name(t)));
  check(`${label}: das Ziel bekommt einen Punkt`, into.has(plan.target));
  check(`${label}: je Schritt etwas`, plan.byBeat.every((list) => list.length > 0), plan.byBeat.map((x) => x.length));
}

/* 1. Zwei Anfänge, einer wartet: T braucht C und B, C braucht A; A, B jetzt lernbar. */
{
  const g = graph({ T: ['C', 'B'], C: ['A'], A: [], B: [] });
  const plan = planOf(g, 'T');
  check('1: ein Weg', plan !== null);
  if (plan !== null) {
    check('1: zwei Schritte', plan.beats === 2, plan.beats);
    check('1: Schritte A0 B0 C1 T2', [beatOf(g, plan, 'A'), beatOf(g, plan, 'B'), beatOf(g, plan, 'C'), beatOf(g, plan, 'T')].join() === '0,0,1,2');
    check('1: Sprünge', hopsOf(g, plan).join() === ['A>C@1', 'B>T@2', 'C>T@2'].join(), hopsOf(g, plan));
    const w = M.wayWaits(plan);
    check('1: B wartet im Schritt 1 (hüpft auf der Stelle)', w.waiting[1].map((t) => g.names[t]).join() === 'B', w.waiting[1]);
    check('1: im Schritt 2 wartet niemand', w.waiting[2].length === 0);
    check('1: zwei Punkte kommen bei T an', w.arriving.get(g.at.get('T')) === 2);
    invariants('1', g, plan);
  }
}

/* 2. Eine Raute: S → X, S → Y, X und Y → T. */
{
  const g = graph({ T: ['X', 'Y'], X: ['S'], Y: ['S'], S: [] });
  const plan = planOf(g, 'T');
  check('2: ein Weg mit zwei Schritten', plan !== null && plan.beats === 2);
  if (plan !== null) {
    check('2: der Punkt teilt sich (S>X, S>Y im Schritt 1) und trifft sich (X>T, Y>T im Schritt 2)', hopsOf(g, plan).join() === ['S>X@1', 'S>Y@1', 'X>T@2', 'Y>T@2'].join(), hopsOf(g, plan));
    invariants('2', g, plan);
  }
}

/* 3. Über Gekonntes hinweg: A (offen) → K (gekonnt) → T; F1, F2 gekonntes Fundament unter allem. */
{
  const g = graph({ T: ['K', 'F2'], K: ['A', 'F1'], A: ['F1'], F1: ['F2'], F2: [] }, ['K', 'F1', 'F2']);
  const plan = planOf(g, 'T');
  check('3: ein Weg', plan !== null && plan.beats === 1, plan?.beats);
  if (plan !== null) {
    check('3: A springt über das gekonnte K direkt zu T', hopsOf(g, plan).join() === 'A>T@1', hopsOf(g, plan));
    check('3: Gekonntes ist nie Weg', !plan.tiles.some((t) => ['K', 'F1', 'F2'].includes(g.names[t])));
    invariants('3', g, plan);
  }
}

/* 4. Ein Kreis: X ↔ Y, T braucht X; Z braucht Y, T braucht Z. */
{
  const g = graph({ T: ['X', 'Z'], X: ['Y'], Y: ['X'], Z: ['Y'] });
  const plan = planOf(g, 'T');
  check('4: ein Weg', plan !== null);
  if (plan !== null) {
    check('4: X und Y ein Schritt', beatOf(g, plan, 'X') === beatOf(g, plan, 'Y') && beatOf(g, plan, 'X') === 0);
    check('4: zwischen X und Y springt nichts', !plan.hops.some((h) => [g.names[h.from], g.names[h.to]].sort().join() === 'X,Y'), hopsOf(g, plan));
    check('4: Z im Schritt 1, T im Schritt 2', beatOf(g, plan, 'Z') === 1 && plan.beats === 2);
    check('4: von beiden Themen des Kreises springt ein Punkt (keiner bleibt liegen)', hopsOf(g, plan).join() === ['X>T@2', 'X>Z@1', 'Y>T@2', 'Y>Z@1', 'Z>T@2'].join(), hopsOf(g, plan));
  }
  /* Ein Kreis weiter oben: P → {C1, C2}, nur C1 braucht P; T braucht C2. */
  const g5 = graph({ T: ['C2'], C1: ['P', 'C2'], C2: ['C1'], P: [] });
  const plan5 = planOf(g5, 'T');
  check('4b: ein Weg', plan5 !== null);
  if (plan5 !== null) {
    check('4b: C1 und C2 ein Schritt (1)', beatOf(g5, plan5, 'C1') === 1 && beatOf(g5, plan5, 'C2') === 1, plan5.tileBeat);
    check('4b: C2 erscheint mit C1 (ohne eigenen Sprung)', plan5.joins.map((t) => g5.names[t]).join() === 'C2', plan5.joins);
    check('4b: von C1 und C2 zu T', hopsOf(g5, plan5).join() === ['C1>T@2', 'C2>T@2', 'P>C1@1'].join(), hopsOf(g5, plan5));
    invariants('4b', g5, plan5);
    invariants('4', g, plan);
  }
}

/* 5. Kein Weg. */
{
  const g = graph({ T: ['A'], A: [], R: [] }, ['T']);
  check('5: gekonnt — kein Weg', planOf(g, 'T') === null);
  check('5: jetzt lernbar — kein Weg', planOf(g, 'R') === null);
  check('5: ausserhalb — kein Weg', M.wayPlan({ target: 99, needs: g.needs, opens: g.opens, open: g.open }) === null);
  const g2 = graph({ T: ['A'], A: [] }, ['A']);
  check('5: alles davor gekonnt — kein Weg', planOf(g2, 'T') === null);
}

/* 7. Der Takt. */
{
  for (const beats of [1, 2, 4, 10, 20, 60]) {
    const t = M.wayTimes(beats, 'full');
    check(`7: Schritt 280–600 ms (${beats})`, t.beat >= 280 && t.beat <= 600, t.beat);
    check(`7: alle Schritte höchstens etwa 5 s (${beats})`, beats * t.beat <= Math.max(4900, beats * 280 + 1), beats * t.beat);
    check(`7: Sprung kürzer als der Schritt (${beats})`, t.jump > 0 && t.jump < t.beat);
    check(`7: das Ende nach allen Schritten (${beats})`, t.end === t.pop + beats * t.beat + t.arrive + t.fade);
    check(`7: Schritt zur Zeit (${beats})`, M.beatAt(t, beats, 0) === 0 && M.beatAt(t, beats, t.pop + 1) === 1 && M.beatAt(t, beats, t.pop + beats * t.beat + 1) === beats + 1);
  }
  const r = M.wayTimes(4, 'reduced');
  check('7: „ograniczone" ohne Sprünge', r.jump === 0 && r.end > 0);
  const off = M.wayTimes(4, 'off');
  check('7: „wyłączone" ohne Zeit', off.end === 0);
  const few = M.wayTimes(3, 'full');
  check('7: drei Schritte unter 3,5 s', few.end <= 3500, few.end);
}

/* 6 + 8. Zufällige Graphen: die Regeln für jeden Weg; 5 000 Themen schnell. */
{
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const N = 5000;
  const needs = Array.from({ length: N }, () => []);
  for (let v = 1; v < N; v += 1) {
    const k = 1 + Math.floor(rnd() * 3);
    for (let j = 0; j < k; j += 1) { const p = Math.max(0, v - 1 - Math.floor(rnd() * Math.min(v, 60))); if (!needs[v].includes(p) && p !== v) needs[v].push(p); }
  }
  /* Ein paar Kreise. */
  for (let i = 0; i < 12; i += 1) { const a = 100 + Math.floor(rnd() * (N - 200)); const b = a + 1 + Math.floor(rnd() * 5); if (!needs[a].includes(b)) needs[a].push(b); }
  const opens = needs.map(() => []);
  needs.forEach((list, u) => { for (const p of list) opens[p].push(u); });
  /* Gekonnt: die ersten 60 %, ausser ein paar Löchern. */
  const known = new Uint8Array(N);
  for (let v = 0; v < N * 0.6; v += 1) known[v] = rnd() < 0.97 ? 1 : 0;
  const open = (t) => known[t] === 0;
  /* Die Stufe wie die Säulen (die längste Kette des Offenen davor, über Gekonntes hinweg). */
  const deepest = [];
  for (let v = N - 1; v >= 0 && deepest.length < 40; v -= 7) if (open(v)) deepest.push(v);
  let worst = 0;
  let checked = 0;
  for (const target of deepest) {
    const t0 = performance.now();
    const plan = M.wayPlan({ target, needs, opens, open });
    worst = Math.max(worst, performance.now() - t0);
    if (plan === null) continue;
    checked += 1;
    invariants(`8 (${target})`, null, plan);
    const w = M.wayWaits(plan);
    const at = new Map(plan.tiles.map((t, i) => [t, plan.tileBeat[i]]));
    let wrong = 0;
    for (let k = 1; k <= plan.beats; k += 1) for (const t of w.waiting[k]) if (!(at.get(t) < k && k < (w.last.get(t) ?? -1))) wrong += 1;
    check(`6 (${target}): gewartet wird nur zwischen Ankunft und letztem Sprung`, wrong === 0, wrong);
  }
  check('8: Wege geprüft', checked >= 30, checked);
  check('8: je Weg unter 60 ms (5 000 Themen)', worst < 60, worst.toFixed(1));
}

/* 9. Die Worte. */
{
  for (const lang of ['pl', 'de', 'en']) {
    const T = M.landscapeWords(lang);
    for (const key of ['wayStep', 'wayShow', 'wayInfo', 'waySkip', 'wayStart', 'legendWay', 'wayLabel']) {
      const v = T[key];
      const text = typeof v === 'function' ? v(2, 5) : v;
      check(`9: ${lang}.${key}`, typeof text === 'string' && text.trim() !== '' && !text.includes('undefined'), text);
    }
  }
  check('9: polnische Mehrzahl', M.landscapeWords('pl').wayShow(5).includes('kroków') && M.landscapeWords('pl').wayShow(3).includes('kroki') && M.landscapeWords('pl').wayShow(1).includes('krok'));
}

if (failures > 0) { console.error(`app-way-check: ${failures} failed, ${passes} passed`); process.exit(1); }
console.log(`app-way-check: ${passes} checks passed`);
