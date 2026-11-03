/**
 * 2026-11-03 — DER EINE GENERATOR (Zadania generowane, documentation/COGITA-WORLD.md, Aufgabe 1), nachgemessen:
 * die Sprache der Rysunki mit Listen und Datensätzen (`pages/motion/expr.ts`) — ohne dass sich im bewegten Bild etwas
 * ändert —, das Ziehen (`cogita/generator.ts`: Zahlen, Einträge, abhängige Züge, `require`, Same, keine Karte statt
 * einer kaputten), die Karten (Fragen und Szablon mit „Generator", Werte und Same an der Antwort, Fingerabdruck), die
 * Normalisierung getippter Texte, die Warnungen der Vorschau des Imports — und die vier Beispiele aus
 * `scripts/fixtures/generators.json` (Geschwindigkeit mit Einheiten, Ionen, Gleichungen rückwärts, Daten).
 *
 *   node scripts/app-generator-check.mjs
 */
import { build } from 'esbuild';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-generator-'));
const entries = {
  expr: 'src/app/pages/motion/expr.ts',
  generator: 'src/app/cogita/generator.ts',
  cards: 'src/app/cogita/cards.ts',
  cardBasics: 'src/app/cogita/cardBasics.ts',
  check: 'src/app/cogita/check.ts',
  store: 'src/app/cogita/store.ts',
  json: 'src/app/cogita/json.ts',
  learn: 'src/app/cogita/learn.ts',
  palette: 'src/app/cogita/cardPalette.ts',
  graph: 'src/app/cogita/graph.ts'
};
await build({
  entryPoints: entries,
  bundle: true,
  format: 'esm',
  platform: 'node',
  outdir: workspace,
  logLevel: 'error',
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [E, G, C, B, K, So, Js, L, P, GR] = await Promise.all(Object.keys(entries).map(load));

let failed = 0;
let passed = 0;
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const check = (name, got, want) => {
  const ok = typeof want === 'number' && typeof got === 'number' ? near(got, want) : JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};
const truth = (name, ok, extra) => check(name + (ok || extra === undefined ? '' : `  (${JSON.stringify(extra).slice(0, 300)})`), ok, true);

/* ── Die Sprache: Listen, Datensätze, Funktionen ─────────────────────────────── */

const run = (source, env = {}, options = { lists: true }) => {
  const e = E.compile(source, options);
  if (E.isExprError(e)) return { error: e.error };
  return e.run(Object.assign(E.newEnv(), env));
};
const rec = (fields) => E.makeRecord(fields);
check('a list in the text, an element by its place (from 0; −1 the last)', [run('[1, 2, 3][1]'), run('[1, 2, 3][-1]'), run('[1, 2, 3][7]')], [2, 3, '']);
check('a record: fields by key, missing ones are "" — never a JavaScript member', [run('k.ladunek * 2', { k: rec({ ladunek: 3 }) }), run('k.brak', { k: rec({}) }), run('k.constructor', { k: rec({}) })], [6, '', '']);
check('after a function, a field and a place: first(xs).label, sortby(xs, it.v)[0].label',
  [run('first(xs).label', { xs: [rec({ label: 'A' }), rec({ label: 'B' })] }), run('sortby(xs, it.v)[0].label', { xs: [rec({ label: 'A', v: 2 }), rec({ label: 'B', v: 1 })] })], ['A', 'B']);
truth('without `lists` (the drawings) a.b and a[0] stay errors — nothing changes in the Animation module',
  E.isExprError(E.compile('a.b')) && E.isExprError(E.compile('a[0]')) && E.compile('parent.x').error?.includes('świecie'));
check('list functions: len, take, drop, slice, reverse, sort, unique, range (inclusive), join, concat, contains, index',
  [run('len([4, 5, 6])'), run('take([1, 2, 3], 2)'), run('drop([1, 2, 3], 2)'), run('slice([1, 2, 3, 4], 1, 3)'), run('reverse([1, 2])'), run('sort([3, 1, 2])'), run('sort([\'Ola\', \'Ala\'])'),
    run('unique([1, 1, 2])'), run('range(1, 5)'), run('range(10, 4, -3)'), run('join([1.5, 2], \' | \')'), run('concat([1], 2, [3, 4])'), run('contains([1, 2], 2)'), run('index([\'a\', \'b\'], \'b\')')],
  [3, [1, 2], [3], [2, 3], [2, 1], [1, 2, 3], ['Ala', 'Ola'], [1, 2], [1, 2, 3, 4, 5], [10, 7, 4], '1,5 | 2', [1, 2, 3, 4], 1, 1]);
check('an expression per element: filter, map, count, any, all, find, sum, avg, min, max, minby, maxby (it, i)',
  [run('filter([1, 2, 3, 4], it > 2)'), run('map([1, 2], it * 10 + i)'), run('count([1, 2, 3], it != 2)'), run('any([1, 2], it > 1)'), run('all([1, 2], it > 1)'),
    run('find([1, 2, 3], it > 1)'), run('sum([1, 2, 3])'), run('sum(xs, it.m)', { xs: [rec({ m: 2 }), rec({ m: 5 })] }), run('avg([2, 4])'), run('min([3, 1, 2])'), run('max(xs, it.m)', { xs: [rec({ m: 2 }), rec({ m: 5 })] }),
    run('minby(xs, it.d).label', { xs: [rec({ label: 'B', d: 1525 }), rec({ label: 'A', d: 1410 })] }), run('maxby(xs, it.d).label', { xs: [rec({ label: 'B', d: 1525 }), rec({ label: 'A', d: 1410 })] })],
  [[3, 4], [10, 21], 2, 1, 0, 2, 6, 7, 3, 1, 5, 'A', 'B']);
check('min and max of numbers as before (max(1, 5, 3) = 5), also constant-folded', [run('max(1, 5, 3)'), run('min(4, 2)'), E.compile('max(1, 5, 3)').constant, E.evaluate('max(1, 5, 3)')], [5, 2, true, 5]);
check('math: gcd, lcm (also over a list), root, log with a base, significant figures, factorial, binomial, isint',
  [run('gcd(12, 18)'), run('lcm(3, 2)'), run('lcm([4, 6, 10])'), run('root(27, 3)'), run('root(-8, 3)'), run('log(8, 2)'), run('log(1000)'), run('sig(0.012345, 2)'), run('fact(5)'), run('binom(5, 2)'), run('isint(4 / 2)'), run('isint(5 / 2)')],
  [6, 6, 60, 3, -2, 3, 3, 0.012, 120, 10, 1, 0]);
check('text: str (comma, 12 digits), sub, sup, plain, upper, lower; "+" joins text and lists',
  [run('str(2.5)'), run("'SO' + sub(4)"), run("'Al' + sup('3+')"), run("plain('Al₂(SO₄)₃')"), run("upper('ąb')"), run("lower('ĄB')"), run('[1] + [2]'), run("'x' + [1, 2]")],
  ['2,5', 'SO₄', 'Al³⁺', 'Al2(SO4)3', 'ĄB', 'ąb', [1, 2], 'x1, 2']);
check('logic: if is lazy, texts compare alphabetically, == compares lists and records by id',
  [run("if(1, 'a', 1/0)"), run("'Ala' < 'Ola'"), run('[1, 2] == [1, 2]'), run('a == b', { a: rec({ id: 'x' }), b: rec({ id: 'x' }) }), run('a == b', { a: rec({ id: 'x' }), b: rec({ id: 'y' }) })],
  ['a', 1, 1, 1, 0]);
truth('an unknown name inside an element expression is still an error (it and i are known)', E.isExprError(E.compile('filter(xs, it.x > y)', { known: (n) => n === 'xs', lists: true })) && !E.isExprError(E.compile('filter(xs, it.x > i)', { known: (n) => n === 'xs', lists: true })));
{
  const seeded = (seed) => { const env = E.withRng(E.newEnv(), B.rngOf(seed)); env.xs = [1, 2, 3, 4, 5, 6]; return env; };
  const pickOf = (seed) => E.compile('choose(xs, 3)', { lists: true }).run(seeded(seed));
  truth('choose, shuffle and pick draw with the seed of the task: same seed, same draw; k distinct', JSON.stringify(pickOf('a')) === JSON.stringify(pickOf('a')) && new Set(pickOf('b')).size === 3);
}
{
  const big = run('len(range(1, 3000))');
  const overrun = E.takeOverrun();
  /* Nicht faltbar (hängt an `it`): rund 500 000 Schritte — über der Grenze. */
  const heavy = run('sum(map(range(1, 1000), sum(range(1, it))))');
  check('bounded work: a list over 2000 or too many steps gives NaN, and the generator hears it', [Number.isNaN(big), overrun, Number.isNaN(heavy), E.takeOverrun()], [true, true, true, true]);
}

/* ── Der Generator: Zahlen, Einträge, Bedingungen, Same ──────────────────────── */

const fake = (libraryId, list) => {
  const map = new Map(list.map((x) => [x.id, x]));
  const byKey = (key) => [...map.values()].find((x) => (x.key ?? '').toLowerCase() === key.toLowerCase());
  let n = 0;
  const store = {
    libraryId, areaId: `a-${libraryId}`, revision: 1, loaded: true,
    all: () => [...map.values()], get: (id) => map.get(id), own: (id) => map.get(id), byKey, ownByKey: byKey,
    save: async (input) => { const entry = { ...input, id: input.id ?? `${libraryId}-neu-${n += 1}`, libraryId }; map.set(entry.id, entry); store.revision += 1; return entry; },
    saveAll: async (inputs) => { const saved = []; for (const i of inputs) saved.push(await store.save(i)); return saved; },
    refreshAiNow: async () => null,
    saveMany: async (inputs) => { const saved = []; for (const i of inputs) saved.push(await store.save(i)); return { saved, failed: [] }; },
    remove: async (id) => { map.delete(id); store.revision += 1; },
    subscribe: () => () => undefined
  };
  return store;
};
const importInto = async (doc) => {
  const lib = new So.CogitaLibrary(fake('G', []), true);
  const plan = Js.planImport(lib, doc);
  if ('error' in plan) throw new Error(plan.error);
  await Js.applyImport(lib, plan, () => undefined);
  return { lib, plan };
};
const fixture = JSON.parse(await readFile(join(process.cwd(), 'scripts/fixtures/generators.json'), 'utf8'));
const { lib, plan } = await importInto(fixture);
const world = lib.genWorld();
const byRef = (ref) => lib.byImportRef(ref.replace(/^@/, ''))?.id;
const ion = (ref) => lib.entity(byRef(ref));

check('the fixture imports: two kinds, 22 entries, 7 questions, a template, two revisions — without a generator warning',
  [plan.kinds.length, plan.entities.filter((e) => !e.kinds.includes('question')).length, plan.entities.filter((e) => e.kinds.includes('question')).length, plan.docs.filter((d) => d.kind === 'template').length, plan.docs.filter((d) => d.kind === 'revision').length, plan.warnings.filter((w) => /generator/i.test(w))],
  [2, 22, 7, 1, 2, []]);

const spec = G.readParamsSpec({
  params: [{ name: 'k', entry: { kind: '@gen/jon', where: 'it.ladunek > 0' } }, { name: 'a', entry: { kind: '@gen/jon', where: 'it.ladunek < 0 && it.ladunek > -3' } }, { name: 'x', random: [1, 9] }],
  let: [{ name: 'n', value: 'lcm(k.ladunek, -a.ladunek)' }], require: ['x != 5'], texts: [{ name: 't', value: '{k.symbol}{a.symbol}' }]
});
check('a description: params of every sort in order, let, require, texts (kind as written — resolved when drawn)', [spec.params.map((p) => p.name), spec.params[0].entry.kind, spec.lets.length, spec.require, spec.texts.length], [['k', 'a', 'x'], '@gen/jon', 1, ['x != 5'], 1]);
check('reserved and broken names are left out (it, i, this; spaces)', G.readParamsSpec({ params: [{ name: 'it', random: [1, 2] }, { name: 'this', values: [1] }, { name: 'x y', random: [1, 2] }, { name: 'ok', random: [1, 2] }] }).params.map((p) => p.name), ['ok']);
{
  const one = G.drawInstance(spec, B.rngOf('same'), world);
  const two = G.drawInstance(spec, B.rngOf('same'), world);
  check('the same seed draws the same task (values and entries)', [JSON.stringify(G.storedValues(spec, one.values)) === JSON.stringify(G.storedValues(spec, two.values)), one.picked.join() === two.picked.join(), one.held], [true, true, true]);
  const many = Array.from({ length: 40 }, (_, i) => G.drawInstance(spec, B.rngOf(`d${i}`), world));
  truth('dependent draws: the cation is a cation, the anion fits its condition, never the same entry twice, x never 5',
    many.every((m) => m.held && m.values.k.fields.ladunek > 0 && m.values.a.fields.ladunek < 0 && m.values.a.fields.ladunek > -3 && m.values.x !== 5 && m.picked.length === 2 && m.picked[0] !== m.picked[1]));
  truth('… and the values differ between seeds', new Set(many.map((m) => `${m.values.k.fields.id}|${m.values.a.fields.id}|${m.values.x}`)).size > 10);
  truth('texts get the values of the task (template outputs)', many.every((m) => m.values.t === `${m.values.k.fields.symbol}${m.values.a.fields.symbol}`));
  check('stored with the answer: numbers, entries as @id, short lists', G.storedValues(G.readParamsSpec({ params: [{ name: 'k', entry: { kind: '@gen/jon' } }, { name: 'z', entries: { kind: '@gen/zdarzenie', count: 2 } }], let: [{ name: 'q', value: '2.5' }] }), { k: rec({ id: 'X1' }), z: [rec({ id: 'Y1' }), rec({ id: 'Y2' })], q: 2.5 }),
    { k: '@X1', z: ['@Y1', '@Y2'], q: 2.5 });
}
{
  const impossible = G.drawInstance(G.readParamsSpec({ params: [{ name: 'x', random: [1, 3] }], require: ['x > 10'] }), B.rngOf('i'), world);
  check('a condition that never holds: 60 tries, not held, the reason in words', [impossible.held, impossible.tries, /x > 10/.test(impossible.problem ?? '')], [false, 60, true]);
  const none = G.drawInstance(G.readParamsSpec({ params: [{ name: 'k', entry: { kind: '@gen/jon', where: 'it.ladunek > 9' } }] }), B.rngOf('n'), world);
  check('no entry fits: not held, the parameter named', [none.held, /„k”/.test(none.problem ?? '')], [false, true]);
  const many = G.drawInstance(G.readParamsSpec({ params: [{ name: 'z', entries: { kind: '@gen/zdarzenie', count: 30 } }] }), B.rngOf('m'), world);
  check('more entries asked than there are: not held, with the count', [many.held, /30/.test(many.problem ?? '')], [false, true]);
  const nowhere = G.drawInstance(G.readParamsSpec({ params: [{ name: 'k', entry: { kind: '@gen/jon' } }] }), B.rngOf('w'));
  const unknown = G.drawInstance(G.readParamsSpec({ params: [{ name: 'k', entry: { kind: '@nie/ma' } }] }), B.rngOf('u'), world);
  check('without a base, and with an unknown kind: not held at once (one try), with the reason', [nowhere.held, nowhere.tries, /bazy/.test(nowhere.problem ?? ''), unknown.held, unknown.tries, /rodzaju/.test(unknown.problem ?? '')], [false, 1, true, false, 1, true]);
  check('the editor names broken expressions (let, require, where)', G.specErrors(G.readParamsSpec({ params: [{ name: 'k', entry: { kind: '@gen/jon', where: 'it.x >' } }], let: [{ name: 'r', value: 'mod(k, zz)' }], require: ['r ==='] })).length, 3);
}
{
  const al = G.recordOf(ion('@gen/jon/al'), lib.look);
  const grunwald = G.recordOf(ion('@gen/zd/grunwald'), lib.look);
  check('a record: id, label, kind, number, bool as 1/0, date as yyyymmdd with its words',
    [al.fields.label, al.fields.kind, al.fields.ladunek, al.fields.wieloatomowy, grunwald.fields.data, grunwald.fields.data_text], ['glin', 'Jon', 3, 0, 14100715, '15 lipca 1410']);
}

/* ── Platzhalter in Texten ─────────────────────────────────────────────────── */

check('placeholders: lists with commas, records by their name, LaTeX groups stay (also old texts unchanged)',
  [G.fillParams('{xs} · {k} · {k.symbol}', { xs: [1, 2.5], k: rec({ label: 'glin', symbol: 'Al' }) }), G.fillParams('$\\mathbb{N}$, {a}, {fmt(a/3, 2)}, {b}', { a: 7 })],
  ['1, 2,5 · glin · Al', '$\\mathbb{N}$, 7, 2,33, {b}']);
check('in a formula an argument keeps its braces (\\frac{s}{t}, x^{n}, \\sqrt{d}), elsewhere none; „{ s }” with spaces stays LaTeX',
  G.fillParams('$v = \\frac{s}{t}$, $x^{n}$, $\\sqrt{d}$, ${a}x {z} {b}$, $\\frac{ s }{ t }$', { s: 250, t: 58, n: 12, d: 49, a: 9, z: '-', b: 13 }),
  '$v = \\frac{250}{58}$, $x^{12}$, $\\sqrt{49}$, $9x - 13$, $\\frac{ s }{ t }$');
check('a whole placeholder in a list spreads its list: "options": ["{right}", "{wrong}"]; correct/value/tolerance computed',
  [G.withParams({ options: ['{r}', '{w}'], correct: ['{k}'], value: '{k > 2}', tolerance: '{t}' }, { r: 'A', w: ['B', 'C'], k: 0, t: 0.5 })],
  [{ options: ['A', 'B', 'C'], correct: [0], value: false, tolerance: 0.5 }]);

/* ── Die vier Beispiele ────────────────────────────────────────────────────── */

const card = (ref, seed) => C.questionCards(lib.entity(byRef(ref)), seed, world)[0] ?? null;
const seeds = Array.from({ length: 40 }, (_, i) => `s${i}`);

/* 1. Geschwindigkeit mit Einheiten */
{
  const cards = seeds.map((s) => card('@gen/q/predkosc', s));
  truth('physics: a card for every seed, the answer in m/s with 1 % relative tolerance', cards.every((c) => c !== null && c.answer.form === 'number' && c.answer.unit === 'm/s' && c.answer.relative === true && near(c.answer.tolerance, 0.01)));
  const c = cards[0];
  const s = c.params.s;
  const t = c.params.t;
  const v = s / t;
  const fmt = (x) => String(Math.round(x * 1000) / 1000).replace('.', ',');
  check('… the right speed in m/s is right, km/h equivalent is right, 1,5 % off is wrong, a wrong quantity is rejected',
    [C.checkCard(c, `${fmt(v)} m/s`).correct, C.checkCard(c, `${fmt(v * 3.6)} km/h`).correct, C.checkCard(c, `${fmt(v * 1.015)} m/s`).correct, C.checkCard(c, `${fmt(v)} N`).correct],
    [true, true, false, false]);
  truth('… the values are within their ranges (s: 20–500 step 10, t: 2–60)', cards.every((x) => x.params.s >= 20 && x.params.s <= 500 && x.params.s % 10 === 0 && x.params.t >= 2 && x.params.t <= 60));
  truth('… the explanation shows the values and the result', /m\/s, czyli .* km\/h/.test(c.explanation ?? '') && (c.explanation ?? '').includes(String(s)));
}

/* 2. Ionen: Name → Wzór (Text), Wzór → Name (Wahl) */
{
  const formula = (k, a) => {
    const e = E.compile(fixture.entities.find((x) => x.ref === '@gen/q/nazwa').data.let.find((l) => l.name === 'wzor').value, { known: (n) => n === 'kation' || n === 'anion' || n === 'n' || n === 'ik' || n === 'ia', lists: true });
    const n = Math.abs(k.ladunek * a.ladunek) / (function gcd(x, y) { return y === 0 ? x : gcd(y, x % y); })(k.ladunek, -a.ladunek);
    const env = Object.assign(E.newEnv(), { kation: G.recordOf(ion(k.ref), lib.look), anion: G.recordOf(ion(a.ref), lib.look), n, ik: n / k.ladunek, ia: n / -a.ladunek });
    return e.run(env);
  };
  check('chemistry: Al³⁺ + SO₄²⁻ → Al₂(SO₄)₃, Na⁺ + Cl⁻ → NaCl, NH₄⁺ + SO₄²⁻ → (NH₄)₂SO₄, Ca²⁺ + PO₄³⁻ → Ca₃(PO₄)₂',
    [formula({ ref: '@gen/jon/al', ladunek: 3 }, { ref: '@gen/jon/so4', ladunek: -2 }), formula({ ref: '@gen/jon/na', ladunek: 1 }, { ref: '@gen/jon/cl', ladunek: -1 }),
      formula({ ref: '@gen/jon/nh4', ladunek: 1 }, { ref: '@gen/jon/so4', ladunek: -2 }), formula({ ref: '@gen/jon/ca', ladunek: 2 }, { ref: '@gen/jon/po4', ladunek: -3 })],
    ['Al₂(SO₄)₃', 'NaCl', '(NH₄)₂SO₄', 'Ca₃(PO₄)₂']);
  const texts = seeds.map((s) => card('@gen/q/wzor', s));
  truth('… name → formula: a text card for every seed, the formula with subscripts, typed with plain digits and spaces it is right',
    texts.every((c) => c !== null && c.answer.form === 'text' && C.checkCard(c, E.plainScripts(c.answer.accepted[0]).split('').join(' ')).correct === true), texts.find((c) => c !== null && !C.checkCard(c, E.plainScripts(c.answer.accepted[0])).correct)?.answer);
  truth('… a wrong formula is wrong', texts.every((c) => C.checkCard(c, 'H2O').correct === false));
  truth('… hints show the ions with their charges (Al³⁺, SO₄²⁻)', texts.some((c) => (c.hints ?? [])[0]?.includes('³⁺')) && texts.every((c) => (c.hints ?? []).length === 2));
  const choices = seeds.map((s) => card('@gen/q/nazwa', s));
  truth('… formula → name: a choice of four distinct names, the right one = anion + cation (genitive), the others other combinations',
    choices.every((c) => {
      if (c === null || c.answer.form !== 'one' || c.answer.options.length !== 4 || new Set(c.answer.options).size !== 4) return false;
      const k = lib.entity(c.params.kation.slice(1));
      const a = lib.entity(c.params.anion.slice(1));
      return c.answer.options[c.answer.correct] === `${a.data.nazwa} ${k.data.dopelniacz}` && c.answer.options.every((o) => o.endsWith(` ${k.data.dopelniacz}`));
    }));
}

/* 3. Gleichungen rückwärts, Logarithmus */
{
  const eqs = seeds.map((s) => card('@gen/q/rownanie', s));
  truth('math backwards: the answer is always the drawn integer, and a·x + b = c holds, x ≠ 0, b ≠ 0',
    eqs.every((c) => c !== null && Number.isInteger(c.answer.values[0]) && c.params.a * c.params.x + c.params.b === c.params.c && c.params.x !== 0 && c.params.b !== 0 && c.answer.values[0] === c.params.x));
  truth('… the prompt is a formula with the numbers, the sign written right', eqs.every((c) => /\$\d+x [+-] \d+ = -?\d+\$/.test(c.prompt[0].text)), eqs.map((c) => c.prompt[0].text).slice(0, 3));
  const logs = seeds.map((s) => card('@gen/q/logarytm', s));
  truth('… log_b(b^k): the answer is k, b from the list, b^k as written', logs.every((c) => c !== null && [2, 3, 5, 10].includes(c.params.b) && c.params.b ** c.params.k === c.params.p && c.answer.values[0] === c.params.k && c.prompt[0].text.includes(`\\log_{${c.params.b}} ${c.params.p}`)));
}

/* 4. Daten: welches war früher, vier ordnen */
{
  const dated = (id) => lib.entity(id).data.data;
  const ord = (d) => { const [y, m = '0', dd = '0'] = String(d).split('-'); return Number(y) * 10000 + Number(m) * 100 + Number(dd); };
  const firsts = seeds.map((s) => card('@gen/q/wczesniej', s));
  truth('dates: which came first — two different events, the right option is the earlier one',
    firsts.every((c) => {
      if (c === null) return false;
      const [a, b] = [c.params.a.slice(1), c.params.b.slice(1)];
      const earlier = ord(dated(a)) < ord(dated(b)) ? a : b;
      return a !== b && c.answer.options[c.answer.correct] === lib.label(lib.entity(earlier));
    }));
  const orders = seeds.map((s) => card('@gen/q/kolejnosc', s));
  truth('… order four: four events, the right order is by date (no arithmetic, only comparison)',
    orders.every((c) => {
      if (c === null || c.answer.form !== 'order' || c.answer.items.length !== 4) return false;
      const ids = c.params.zd.map((x) => x.slice(1));
      const want = ids.slice().sort((x, y) => ord(dated(x)) - ord(dated(y))).map((id) => lib.label(lib.entity(id)));
      return JSON.stringify(c.answer.items) === JSON.stringify(want);
    }));
  truth('… answered in the right order it is right, reversed it is wrong', orders.every((c) => C.checkCard(c, c.answer.items).correct && !C.checkCard(c, c.answer.items.slice().reverse()).correct));
}

/* ── Der Szablon mit „Generator" ───────────────────────────────────────────── */

{
  const { cards, problems } = await lib.cards('t1');
  const tpl = lib.templates()[0];
  const own = cards.filter((c) => c.template === tpl.id);
  const cations = lib.entities().filter((e) => e.data.ladunek > 0).length;
  check('template: a card for every cation, none for anions — and no warning for them („only”)', [own.length, cations, problems.get(tpl.id) ?? []], [7, 7, []]);
  truth('… each card: question with the anion, the formula as answer (scripts, spaces), hint and solution from the generator, values and seed',
    own.every((c) => c.answer.form === 'text' && c.answer.rule.scripts === true && c.prompt[0].text.startsWith('Jaki wzór ma ') && (c.hints ?? []).length === 1 && (c.explanation ?? '').includes(' — ') && typeof c.params?.anion === 'string' && c.seed === 't1' && c.varies === true));
  const again = (await lib.cards('t1')).cards.filter((c) => c.template === tpl.id);
  const other = (await lib.cards('t2')).cards.filter((c) => c.template === tpl.id);
  check('… same seed — same cards; another seed — same keys and fingerprints (history continues), other tasks',
    [JSON.stringify(again.map((c) => c.answer)) === JSON.stringify(own.map((c) => c.answer)), JSON.stringify(other.map((c) => [c.key, c.fingerprint])) === JSON.stringify(own.map((c) => [c.key, c.fingerprint])), other.some((c, i) => c.params.anion !== own[i].params.anion)],
    [true, true, true]);
  truth('… in one run every card has its own task (the draw follows the entry too)', new Set(own.map((c) => c.params.anion)).size > 1);
  const card0 = own[0];
  const fresh = await lib.redrawn(card0, 'pokaz-2');
  check('… a new instance for a new show (redrawn): the same card key and fingerprint, its own seed', [fresh.key === card0.key, fresh.fingerprint === card0.fingerprint, fresh.seed], [true, true, 'pokaz-2']);
}

/* ── Fingerabdruck und Geschichte ──────────────────────────────────────────── */

{
  const q = lib.entity(byRef('@gen/q/rownanie'));
  const a = C.questionCards(q, 'x1', world)[0];
  const b = C.questionCards(q, 'x2', world)[0];
  const changed = C.questionCards({ ...q, data: { ...q.data, let: [{ name: 'c', value: 'a * x - b' }] } }, 'x1', world)[0];
  const hinted = C.questionCards({ ...q, data: { ...q.data, hints: ['inna podpowiedź'] } }, 'x1', world)[0];
  check('history: a new draw keeps the fingerprint; changing the generator (let) restarts it; changing a hint does not',
    [a.fingerprint === b.fingerprint, a.fingerprint !== changed.fingerprint, a.fingerprint === hinted.fingerprint, a.key === b.key], [true, true, true, true]);
  check('… the card carries its seed and values, and the same seed gives it again', [a.seed, JSON.stringify(C.questionCards(q, 'x1', world)[0].params) === JSON.stringify(a.params)], ['x1', true]);
  const redrawn = C.redrawCard(a, q, 'x9', world);
  check('… redrawCard: the same card, a new task (with the base)', [redrawn.key === a.key, redrawn.seed], [true, 'x9']);
}

/* ── Keine kaputte Karte ───────────────────────────────────────────────────── */

{
  const broken = { id: 'q-broken', kinds: ['question'], data: { form: 'number', prompt: '{x}', params: [{ name: 'x', random: [1, 3] }], require: ['x > 10'], answers: ['{x}'] } };
  check('a generator that cannot be satisfied makes no card — and says why', [C.questionCards(broken, 's', world).length, /x > 10/.test(C.generatorProblem(broken, 's', world) ?? '')], [0, true]);
  const lib2 = new So.CogitaLibrary(fake('B', [{ id: 'q-broken', kind: 'entity', data: { _kinds: ['question'], ...broken.data } }]), true);
  const made = await lib2.cards('s');
  check('… the base lists the reason with the question („Do zrobienia”, the preview)', [made.cards.length, (made.problems.get('q-broken') ?? []).length], [0, 1]);
}

/* ── Was die Vorschau des Imports sagt ─────────────────────────────────────── */

{
  const doc = {
    format: 'recreatio.cogita.course', version: 1, name: 'zle generatory',
    entities: [
      { ref: '@zle/q1', kinds: ['question'], data: { form: 'number', prompt: '{r}', params: [{ name: 'a', random: [1, 3] }], let: [{ name: 'r', value: 'mod(a, zz)' }], answers: ['{r}'] } },
      { ref: '@zle/q2', kinds: ['question'], data: { form: 'number', prompt: '{a}', params: [{ name: 'a', random: [1, 3] }], require: ['a > 5'], answers: ['{a}'] } },
      { ref: '@zle/q3', kinds: ['question'], data: { form: 'number', prompt: '{a}', params: [{ name: 'a', random: [1, 3] }], answers: ['{a}'] } }
    ]
  };
  const p = Js.planImport(new So.CogitaLibrary(fake('P', []), true), doc);
  const gen = p.warnings.filter((w) => /generator/i.test(w));
  check('the import preview warns about failing generators (a broken let, a condition never met) — not about good ones',
    [gen.length, gen.some((w) => w.includes('zz')), gen.some((w) => w.includes('20 z 20')), gen.some((w) => w.includes('„{a}”') && !w.includes('a > 5'))], [2, true, true, false]);
}

/* ── Export und wieder Import: die bleibenden Namen tragen ────────────────── */

{
  const exported = Js.exportCourse(lib, 'Generatory');
  const q = exported.entities.find((x) => x.ref === '@gen/q/wzor');
  check('export keeps the generator as written (kinds by their lasting names)', q?.data.params?.[0]?.entry?.kind, '@gen/jon');
  const { lib: again } = await importInto(JSON.parse(JSON.stringify(exported)));
  const c = C.questionCards(again.entity(again.byImportRef('gen/q/wzor').id), 's1', again.genWorld())[0];
  truth('… imported into another base, it draws from the entries there', c !== undefined && c.answer.form === 'text' && c.answer.accepted[0].length > 1);
}

/* ── Das Beispiel im Leitfaden für die KI (MCP: example-generators) spielt ──── */

{
  const guide = JSON.parse(await readFile(join(process.cwd(), '../templates/cogita/przyklad-generatory.json'), 'utf8'));
  const { lib: g, plan: gp } = await importInto(guide);
  const gw = g.genWorld();
  const right = (a) => (a.form === 'number' ? `${String(a.values[0]).replace('.', ',')}${a.unit ? ` ${a.unit}` : ''}` : a.form === 'text' ? E.plainScripts(a.accepted[0]) : a.form === 'one' ? a.correct : a.form === 'order' ? a.items : null);
  const questions = g.entities().filter((e) => e.kinds.includes('question'));
  const played = questions.map((q) => seeds.map((s) => C.questionCards(q, s, gw)[0]).filter((c) => c !== undefined && C.checkCard(c, right(c.answer)).correct).length);
  check('templates/cogita/przyklad-generatory.json imports without a warning; each of its questions gives 40 of 40 tasks, each right with its own answer',
    [gp.warnings, questions.length > 0, played.every((n) => n === 40)], [[], true, true]);
}

/* ── Altes bleibt, wie es war ──────────────────────────────────────────────── */

{
  /* Der Zug von früher (2026-11-01): Zahlen der Reihe nach, dann die `let` — derselbe Zufall gibt dieselben Werte. */
  const old = (sp, rng) => {
    for (let t = 0; t < 60; t += 1) {
      const env = {};
      for (const p of sp.params) {
        const [lo, hi] = p.random;
        const step = p.step ?? (Number.isInteger(lo) && Number.isInteger(hi) ? 1 : Math.max(1e-9, (hi - lo) / 100));
        const steps = Math.floor((hi - lo) / step + 1e-9);
        env[p.name] = Number((lo + Math.floor(rng() * (steps + 1)) * step).toPrecision(12));
      }
      for (const l of sp.lets) env[l.name] = E.compile(l.value).run(Object.assign(E.newEnv(), env));
      if (sp.require.every((r) => E.truth(E.compile(r).run(Object.assign(E.newEnv(), env))))) return env;
    }
    return null;
  };
  const sp = G.readParamsSpec({ params: [{ name: 'a', random: [1, 50] }, { name: 'b', random: [1, 50] }], let: [{ name: 'r', value: 'mod(a, b)' }], require: ['a > b'] });
  truth('old numeric params draw exactly the same values as before (same seed, same task)', Array.from({ length: 20 }, (_, i) => `o${i}`).every((s) => {
    const was = old(sp, B.rngOf(s));
    const now = G.drawParams(sp, B.rngOf(s)).values;
    return was !== null && ['a', 'b', 'r'].every((k) => was[k] === now[k]);
  }));
  const calc = P.TEMPLATE_PALETTE.kinds.get('calc');
  const ctx = { look: lib.look, entity: ion('@gen/jon/al'), pool: (k) => lib.ofKind(k), seed: 'c' };
  const items = (vals) => vals.map((v) => ({ text: String(v), value: v }));
  const out = calc.run({ node: { id: 'c1' }, config: { expr: 'p0 + 1; p0 * n0; sum(l0)', inputs: 1 }, inputs: { p0: [items([3, 4])] }, ctx });
  check('„Oblicz” as before (p0, n0) and with the list of its input (l0)', out.value.map((i) => i.value), [4, 6, 7]);
  const random = P.TEMPLATE_PALETTE.kinds.get('random');
  const one = random.run({ node: { id: 'r1' }, config: { min: 1, max: 9 }, inputs: {}, ctx });
  const four = random.run({ node: { id: 'r1' }, config: { list: ['a', 'b', 'c', 'd', 'e'], count: 4 }, inputs: {}, ctx });
  check('„Losowa wartość” gives one as before, with „Ile” k distinct ones', [one.value.length, four.value.length, new Set(four.value.map((i) => i.text)).size], [1, 4, 4]);
}

/* ── Die Antwort trägt Werte und Samen ─────────────────────────────────────── */

{
  const learner = new L.Learner('G', { kind: 'local', id: 'probe' }, null);
  const c = card('@gen/q/kolejnosc', 'seed-7');
  const { answer } = learner.record(c, 1, { params: c.params, seed: c.seed });
  const back = L.absorb(L.EMPTY_PROGRESS, { kind: 'answers', answers: [JSON.parse(JSON.stringify(answer))] }).answers.get(answer.id);
  check('the answer stores the seed and the drawn values (lists of entries as @ids) — and reads them back', [back.seed, Array.isArray(back.params.zd), back.params.zd.length, back.params.zd.every((x) => x.startsWith('@'))], ['seed-7', true, 4, true]);
}

/* ── Getippter Text: Leerzeichen, Indizes ──────────────────────────────────── */

check('text normalisation: subscripts equal plain digits, spaces ignored — only when asked',
  [K.checkText(['Al₂(SO₄)₃'], 'Al2(SO4)3', { ...K.TEXT_RULE, scripts: true }).correct, K.checkText(['Al₂(SO₄)₃'], 'Al 2 ( SO 4 ) 3', { ...K.TEXT_RULE, scripts: true, spaces: true }).correct,
    K.checkText(['Al₂(SO₄)₃'], 'Al2(SO4)3', K.TEXT_RULE).correct, K.checkText(['x²'], 'x2', { ...K.TEXT_RULE, scripts: true }).correct],
  [true, true, false, true]);
check('… the rule reads and keeps them (and only them, when set)', [K.readRule({ spaces: true, scripts: true }).spaces, K.readRule({}).scripts, 'scripts' in K.readRule({})], [true, undefined, false]);

await rm(workspace, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
