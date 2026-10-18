/**
 * DIE WELT ZUM ANFASSEN (2026-10-18) — was ohne Browser nachzumessen ist.
 *
 *   1. Ausdrücke in einer Welt: parent.x, root.x, ein Ding beim Namen, outer;
 *      sum/avg/min/max/count/all/any über Kinder, alle darunter, Geschwister,
 *      die anderen, alle Dinge, eine Art; die Reihenfolge der Rechnungen folgt
 *      aus dem, was sie lesen (nicht aus der Liste); ein Kreis wird gemeldet.
 *   2. Die Waage gegen die Physik: unausgeglichen an den Anschlag, ausgeglichen
 *      gerade und gelöst; kleiner Überhang — der Winkel aus tan φ = −M/(h·m);
 *      eine untere Belke wirkt mit ihrer ganzen Masse; Schlafen, wenn nichts
 *      mehr geschieht.
 *   3. Die Regeln der Welt: Grenzen als Rechnungen, Schritt, Abstand, Sperren,
 *      `when`, was erlaubt ist, wie viele Dinge und wie tief, `keep`.
 *   4. Die Werkstatt: Cofnij/Ponów (auch Anhängen, Wegnehmen, Kopieren), ein
 *      Ziehen ist EINE Änderung, ein gezogener Schieber auch.
 *   5. Nachspielen und Cogita: gesperrt bleibt gesperrt, Züge zählen, die Stufen
 *      als Fragen (richtig, falsch, Lösung in Worten, Zufall je Versuch).
 *   6. Die Lektion (fixtures/balance-lab.json) und der Kurs (balance-lab-cogita.json).
 *   8. Zufall mit gleicher Schwierigkeit (`task`): jede gezogene Aufgabe hält ihre
 *      Bedingungen, ist am Anfang nicht gelöst, ihre Lösung erreichbar; Eigenschaften
 *      als Rechnung; ohne passende Aufgabe die Werte des Dokuments; „Nowe zadanie";
 *      Cogita zieht dieselbe Rechnung je Versuch und hält sie fest. Was gegeben ist
 *      und was man ändert: `can`, `can.pos`, die Zeilen der Bedienung, `brief`.
 */

import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-world-'));
const entry = join(workspace, 'entry.tsx');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(entry, `
export * from '${app}pages/motion/expr';
export { readWorld, readLive } from '${app}pages/motion/liveModel';
export { Program } from '${app}pages/motion/liveRun';
export { problemsOf } from '${app}pages/motion/liveLint';
export { readShot } from '${app}pages/motion/liveThings';
export { drawingOf, readDrawing, needsLive } from '${app}pages/motion/drawing';
export { balanceDrawing, BALANCE, GEARS } from '${app}pages/motion/liveWorlds';
export { liveDescription } from '${app}pages/motion/liveText';
export { LiveDrawing, seeded } from '${app}pages/motion/LiveDrawing';
export { questionCard, checkCard } from '${app}cogita/cards';
export { stripCard } from '${app}cogita/live';
export { solutionText, solutionWorld, givenValuesText, readSolution, interactiveSpec, checkInteractive } from '${app}cogita/interactive';
export { planImport, DEFAULT_IMPORT } from '${app}pages/pageJson';
export { readShow } from '${app}pages/presentation/presentation';
export { PagePresentation } from '${app}pages/presentation/PagePresentation';
export { renderToStaticMarkup } from 'react-dom/server';
export { createElement } from 'react';
`);
await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  nodePaths: [join(process.cwd(), 'node_modules')],
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
  outfile: join(workspace, 'entry.mjs'),
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) },
  loader: { '.css': 'empty' },
  logLevel: 'error'
});

globalThis.BroadcastChannel = undefined;
const near = (a, b, eps, label) => assert.ok(Math.abs(a - b) <= eps, `${label}: ${a} vs ${b} (±${eps})`);

try {
  const m = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
  const ok = (label) => console.log(`ok   ${label}`);
  /** Eine Zeichnung mit einer Welt — `world` und, wenn nötig, Werte des Bildes. */
  const worldOf = (world, more = {}) => m.drawingOf({ size: [100, 100], elements: [{ type: 'frame', x: 0, y: 0, w: 100, h: 100, view: [0, 0, 10, 10], children: [{ type: 'world' }] }], world, ...more });
  const env = (p, id) => p.world.get(id).env;

  /* -- 1. Ausdrücke in einer Welt ------------------------------------------------------------------------- */
  {
    /* Absichtlich in der „falschen" Reihenfolge: `sum` vor `total`, `y` (vom Elternteil) vor allem. */
    const d = worldOf({
      kinds: [{
        name: 'node', props: [{ name: 'm', value: 1 }, { name: 'dx', value: 1 }],
        let: [
          { name: 'y', value: 'isroot ? 0 : parent.y - 1' },
          { name: 'x', value: 'isroot ? 0 : parent.x + dx' },
          { name: 'mass', value: 'm + sum(children, mass)' },
          { name: 'heaviest', value: 'max(children, mass)' },
          { name: 'twins', value: 'count(siblings, abs(m - outer.m) < 0.5)' },
          { name: 'share', value: 'mass / root.mass' },
          { name: 'below', value: 'count(descendants)' },
          { name: 'avgm', value: 'avg(things, m)' },
          { name: 'allLight', value: 'all(node, m < 10)' },
          { name: 'anyHeavy', value: 'any(others, m > 4)' },
          { name: 'seen', value: 'c.m' }
        ]
      }],
      things: [
        { id: 'a', kind: 'node', m: 2 },
        { id: 'b', kind: 'node', parent: 'a', m: 3, dx: -1 },
        { id: 'c', kind: 'node', parent: 'a', m: 5, dx: 2 },
        { id: 'd', kind: 'node', parent: 'c', m: 3, dx: 1 }
      ]
    });
    assert.deepEqual(m.problemsOf(d), [], 'a world compiles');
    const p = new m.Program(d.live);
    assert.equal(env(p, 'a').mass, 13, 'mass: everything below, computed leaves first though listed first');
    assert.equal(env(p, 'c').mass, 8);
    assert.equal(env(p, 'a').heaviest, 8, 'max over the children');
    assert.equal(env(p, 'd').y, -2, 'y from the parent (root first)');
    assert.equal(env(p, 'd').x, 3, 'x from the parent chain');
    assert.equal(env(p, 'b').twins, 0, 'siblings with outer: no sibling of b has 3 kg');
    assert.equal(env(p, 'd').twins, 0);
    near(env(p, 'c').share, 8 / 13, 1e-12, 'root.mass');
    assert.equal(env(p, 'a').below, 3, 'count of the descendants');
    assert.equal(env(p, 'b').avgm, 13 / 4, 'avg over all things');
    assert.equal(env(p, 'a').allLight, 1);
    assert.equal(env(p, 'b').anyHeavy, 1, 'any of the others (c has 5 kg)');
    assert.equal(env(p, 'c').anyHeavy, 0, '… but not counting itself');
    assert.equal(env(p, 'a').seen, 5, 'a thing by its id');
    /* Ein Wert des Bildes fasst die Welt zusammen; ein Teil eines Dings liest seine eigenen Namen. */
    const g = new m.Program(worldOf({ kinds: [{ name: 'k', props: [{ name: 'v', value: 2 }] }], things: [{ id: 'k1', kind: 'k' }, { id: 'k2', kind: 'k', v: 5 }] }, { let: [{ name: 'tot', value: 'sum(k, v)' }, { name: 'one', value: 'k2.v' }] }).live);
    g.settle();
    assert.deepEqual([g.value('tot'), g.value('one')], [7, 5], 'the drawing sums the world and reads a thing by id');
    /* Ein Kreis: zwei Rechnungen, die einander brauchen. */
    const loop = new m.Program(worldOf({ kinds: [{ name: 'k', let: [{ name: 'p', value: 'q + 1' }, { name: 'q', value: 'p + 1' }] }], things: [{ id: 'k1', kind: 'k' }] }).live);
    assert.ok(loop.problems.some((x) => x.error.includes('w kółko')), 'a cycle of lets is reported');
    /* Ein Punkt im Namen geht nur in einer Welt. */
    assert.ok(m.isExprError(m.compile('parent.x')), 'parent.x outside a world is an error');
    const links = m.compile('sum(children, total*arm) + parent.x + w2.m', { kinds: new Set(['k']) });
    assert.deepEqual([...links.links].sort(), ['@w2>m', 'children>arm', 'children>total', 'parent>x'], 'an expression knows where in the world it reads');
    ok('expressions in a world: relations, aggregates over every set, order from what is read, cycles reported, links');
  }

  /* -- 2. Die Waage gegen die Physik ------------------------------------------------------------------------- */
  const level = (things, more = {}) => m.drawingOf(m.balanceDrawing({ alt: 'test', things, allow: { add: false, remove: false, copy: false }, ...more }));
  {
    const ex = m.drawingOf(m.BALANCE.drawing);
    assert.deepEqual(m.problemsOf(ex), [], 'the workshop compiles');
    const p = new m.Program(ex.live);
    assert.equal(env(p, 'b1').mom, -2, '4 kg at −1,5 m and 2 kg at +2 m: −2 kg·m');
    assert.equal(env(p, 'b1').total, 6);
    p.act('run');
    for (let i = 0; i < 240 && !p.sleeping; i += 1) { p.advance(1 / 60, true); p.settle(); }
    near(env(p, 'b1').angle, 0.35, 1e-9, 'the heavier left side goes down to the stop');
    assert.equal(p.sleeping, true, 'resting on the stop, the simulation sleeps');
    assert.equal(p.goalReached(), false);
    p.workshop.editProp(env(p, 'w2') && p.world.get('w2'), 'pos', 6);
    assert.equal(p.sleeping, false, 'a change wakes it');
    let frames = 0;
    for (; frames < 900 && !p.goalReached(); frames += 1) { p.advance(1 / 60, true); p.settle(); }
    assert.ok(p.goalReached(), 'balanced: the goal after it stood still for a second');
    near(env(p, 'b1').angle, 0, 0.05, 'level');
    assert.ok(frames < 420, `settles within 7 s (${(frames / 60).toFixed(1)} s)`);
    /* Ein kleiner Überhang: die Belke steht schräg, wo sich Moment und Rückstellung aufheben — tan φ = −M/(h·(m + 1)). */
    const small = level([{ id: 'b1', kind: 'belka', length: 6, pivot: 3 }, { id: 'w1', kind: 'ciezarek', parent: 'b1', m: 4, pos: 2 }, { id: 'w2', kind: 'ciezarek', parent: 'b1', m: 4, pos: 4 }, { id: 'w3', kind: 'ciezarek', parent: 'b1', m: 1, pos: 3.25 }]);
    const q = new m.Program(small.live);
    q.act('run');
    for (let i = 0; i < 1200; i += 1) q.advance(1 / 60, false);
    const mom = env(q, 'b1').mom;
    assert.equal(mom, 0.25, 'a quarter of a kg·m too much on the right');
    near(Math.tan(env(q, 'b1').angle), -mom / (0.2 * (9 + 1)), 1e-3, 'the angle of equilibrium');
    /* Eine untere Belke zieht mit allem, was an ihr hängt. */
    const nested = level([
      { id: 'b1', kind: 'belka', length: 6, pivot: 3 },
      { id: 'w1', kind: 'ciezarek', parent: 'b1', m: 6, pos: 1 },
      { id: 'b2', kind: 'belka', parent: 'b1', length: 3, pivot: 1.5, pos: 6, bm: 2 },
      { id: 'w2', kind: 'ciezarek', parent: 'b2', m: 1, pos: 0 },
      { id: 'w3', kind: 'ciezarek', parent: 'b2', m: 1, pos: 3 }
    ]);
    const n = new m.Program(nested.live);
    assert.equal(env(n, 'b2').total, 4, 'the lower beam: its own mass and what hangs on it');
    assert.equal(env(n, 'b1').mom, 0, '4 kg × 3 m = 6 kg × 2 m');
    assert.equal(n.runToEnd(), true, 'the whole mobile balances');
    ok('the balance: to the stop when one side is heavier, level and solved when balanced, the angle of a small overhang, a beam on a beam, sleeping');
  }

  /* -- 3. Die Regeln der Welt -------------------------------------------------------------------------------- */
  {
    const d = level([
      { id: 'b1', kind: 'belka', length: 6, pivot: 3 },
      { id: 'w1', kind: 'ciezarek', parent: 'b1', m: 4, pos: 1, lock: true },
      { id: 'w2', kind: 'ciezarek', parent: 'b1', m: 2, pos: 5, lock: ['m'] }
    ], { allow: { add: true, remove: false, copy: false, roots: [] } });
    const p = new m.Program(d.live);
    const w = p.world;
    const b1 = w.get('b1');
    const w1 = w.get('w1');
    const w2 = w.get('w2');
    assert.equal(w.setProp(w2, 'pos', 9, 'edit'), true);
    assert.equal(w2.env.pos, 6, 'a bound that is a computation: at most the length of the beam it hangs on');
    w.setProp(w2, 'pos', 4.1, 'edit');
    assert.equal(w2.env.pos, 4, 'snapped to its step');
    w.setProp(w2, 'pos', 1.1, 'edit');
    assert.ok(Math.abs(w2.env.pos - w1.env.pos) >= 0.25 - 1e-9, 'kept apart from its sibling');
    assert.equal(w.canEdit(w2, 'm'), false, 'a locked property');
    assert.equal(w.canDrag(w1), false, 'a locked thing');
    assert.equal(w.canEdit(b1, 'pos'), false, 'when: the place on a beam above does not apply to the top beam');
    assert.deepEqual(w.editable(b1).map((x) => x.name), ['length', 'pivot', 'bm', 'sx']);
    w.setProp(w2, 'pos', 6, 'edit');
    w.setProp(b1, 'length', 4, 'edit');
    assert.equal(w2.env.pos, 4, 'a shorter beam pulls in what hangs on it');
    assert.equal(w.canRemove(w2), false, 'removing is not allowed in this world');
    assert.deepEqual(w.addable(b1), ['ciezarek', 'belka'], 'what may hang on the beam');
    assert.deepEqual(w.addable(null), [], 'no new top beams');
    const deep = level([{ id: 'b1', kind: 'belka' }], { allow: { roots: ['belka'] } });
    const dp = new m.Program(deep.live);
    let parent = dp.world.get('b1');
    for (let i = 0; i < 8 && parent !== null; i += 1) parent = dp.world.add('belka', parent);
    assert.equal(Math.max(...dp.world.ordered().map((t) => t.env.depth)), 5, 'limits.depth: six levels at most');
    ok('the rules of the world: bounds as computations, steps, apart, locks, when, what is allowed, depth');
  }

  /* -- 4. Die Werkstatt ---------------------------------------------------------------------------------------- */
  {
    const p = new m.Program(m.drawingOf(m.BALANCE.drawing).live);
    const shop = p.workshop;
    const w = p.world;
    const b1 = w.get('b1');
    const w2 = w.get('w2');
    assert.equal(shop.gestureStart(), true);
    shop.dragThing(w2, 2.5, 2);
    shop.dragThing(w2, 2.6, 2);
    assert.equal(p.env.edits, 1, 'a drag is one change');
    shop.editProp(w2, 'm', 5);
    shop.editProp(w2, 'm', 6);
    shop.endEdit();
    assert.equal(p.env.edits, 2, 'a slider pulled through is one change');
    const made = shop.addThing('belka', b1);
    shop.addThing('ciezarek', made);
    const twin = shop.copyThing(made);
    assert.equal(w.things.length, 7, 'a beam with a weight, then its copy (two more)');
    assert.ok(twin.children.length === 1, 'the copy brings what hangs on it');
    shop.removeThing(made);
    assert.equal(w.things.length, 5);
    for (let i = 0; i < 6; i += 1) shop.undo();
    assert.deepEqual([w.things.length, w2.env.m, w2.env.pos, p.env.edits], [3, 2, 5, 0], 'undo goes back to the start, step by step');
    for (let i = 0; i < 6; i += 1) shop.redo();
    assert.equal(w.things.length, 5, 'redo repeats');
    shop.undo();
    const keepy = new m.Program(level([{ id: 'b1', kind: 'belka', length: 6, pivot: 3 }, { id: 'w1', kind: 'ciezarek', parent: 'b1', m: 2, pos: 1 }], { keep: [{ when: 'edits <= 1', say: 'Jeden ruch.' }] }).live);
    keepy.workshop.editProp(keepy.world.get('w1'), 'pos', 2);
    keepy.workshop.endEdit();
    assert.equal(keepy.workshop.editProp(keepy.world.get('w1'), 'pos', 4), false, 'keep: a second move is refused');
    assert.equal(keepy.world.get('w1').env.pos, 2, '… and taken back');
    assert.equal(keepy.said().text, 'Jeden ruch.');
    keepy.workshop.undo();
    assert.equal(keepy.workshop.redo(), true, 'a refused change leaves redo as it was');
    ok('the workshop: one change per drag and per slider, add/copy/remove, undo and redo all the way, keep refuses and takes back');
  }

  /* -- 5. Nachspielen und Cogita ---------------------------------------------------------------------------- */
  {
    const d = level([
      { id: 'b1', kind: 'belka', length: 6, pivot: 3, lock: true },
      { id: 'w1', kind: 'ciezarek', parent: 'b1', m: 4, pos: 2, lock: true },
      { id: 'w2', kind: 'ciezarek', parent: 'b1', m: 2, pos: 3.5, lock: ['m', 'drop'] }
    ], { keep: [{ when: 'edits <= 1', say: 'Jeden ruch.' }] });
    const start = new m.Program(d.live).worldSnapshot();
    const answer = (props) => ({ things: start.things.map((t) => ({ ...t, props: { ...t.props, ...(props[t.id] ?? {}) } })) });
    const right = new m.Program(d.live, { replay: answer({ w2: { pos: 5 } }) });
    assert.deepEqual([right.env.edits, right.broken(), right.runToEnd()], [1, null, true], 'the right answer: one move, keeps the rules, balances');
    const cheat = new m.Program(d.live, { replay: answer({ w1: { m: 1 }, w2: { m: 4, pos: 3.5 } }) });
    assert.deepEqual([env(cheat, 'w1').m, env(cheat, 'w2').m], [4, 2], 'locked values stay locked in a replay');
    const extra = new m.Program(d.live, { replay: { things: [...answer({}).things, { id: 'zz', kind: 'ciezarek', parent: 'b1', props: { m: 50, pos: 6 } }] } });
    assert.equal(extra.world.things.length, 3, 'nothing is added where adding is not allowed');
    assert.equal(m.readShot('nonsense'), null);
    assert.equal(m.readShot({ things: [{ id: 'a', kind: 'k', props: { m: 1, x: 'no' } }] }).things[0].props.x, undefined, 'only numbers in a shot');
    /* Zufall je Versuch, auch an Dingen. */
    const random = m.balanceDrawing({ alt: 'r', things: [{ id: 'b1', kind: 'belka', length: 6, pivot: 3, lock: true }, { id: 'w1', kind: 'ciezarek', parent: 'b1', pos: 1, m: { random: [2, 6] }, lock: true }, { id: 'w2', kind: 'ciezarek', parent: 'b1', m: 2, pos: 4, lock: ['m', 'drop'] }], allow: { add: false, remove: false, copy: false } });
    const entity = { id: 'q-r', kinds: ['question'], data: { form: 'interactive', prompt: 'Zrównoważ.', drawing: JSON.stringify(random), solution: 'w2.pos = 3 + 2*w1.m/2' } };
    const card = m.questionCard(entity, 'próba-1');
    assert.ok(card.varies, 'a random mass makes a different question each try');
    const drawn = card.answer.fixed['w1.m'];
    assert.ok(Number.isInteger(drawn) && drawn >= 2 && drawn <= 6, `the mass is drawn per try and snapped to its step (${drawn})`);
    const sol = m.solutionWorld(card.answer);
    assert.equal(sol.things.find((t) => t.id === 'w2').props.pos, 3 + drawn, 'the solution is a computation with the drawn mass');
    assert.equal(m.checkCard(card, { vars: {}, world: sol }).correct, drawn <= 3, 'checked by replay and simulation (on the beam only for small masses)');
    assert.equal(m.checkCard(card, { vars: {}, world: { things: sol.things.map((t) => (t.id === 'w1' ? { ...t, props: { ...t.props, m: 2 } } : t)) } }).correct, m.checkCard(card, { vars: {}, world: sol }).correct, 'the drawn mass cannot be overridden by the answer');
    const mine = new m.Program(m.drawingOf(random).live, { fixed: card.answer.fixed }).worldSnapshot();
    const moved = { things: mine.things.map((t) => (t.id === 'w2' ? { ...t, props: { ...t.props, pos: 5 } } : t)) };
    assert.equal(m.givenValuesText(card.answer, { vars: {}, world: moved }), 'Ciężarek w2 · Miejsce na belce = 5 m', 'the answer in words: what was changed');
    ok('replay and Cogita: locked stays locked, moves are counted, random things per try, solutions as computations, answers in words');
  }

  /* -- 6. Die Lektion und der Kurs ------------------------------------------------------------------------------ */
  {
    const fixture = JSON.parse(await readFile(join(process.cwd(), 'scripts/fixtures/balance-lab.json'), 'utf8'));
    const empty = { path: 'zz-probe/rownowaga', title: '', lead: '', mode: 'page', look: { theme: null, cover: [] }, parts: [], logic: null, menu: null };
    const plan = m.planImport(fixture, empty, { ...m.DEFAULT_IMPORT, replace: true });
    assert.ok(!('error' in plan), JSON.stringify(plan).slice(0, 300));
    assert.deepEqual(plan.warnings, [], 'the lesson imports without a single warning');
    assert.equal(m.readShow(plan.look.show).scenes.length, 12);
    const drawings = plan.parts.filter((x) => x.kind === 'animation');
    assert.equal(drawings.length, 11, 'eleven drawings: a demo, eight levels, the workshop, the gears');
    for (const part of drawings) {
      for (const value of Object.values(part.config)) assert.ok(value.length <= 64000, 'fits the module limit');
      const dd = m.readDrawing(part.config);
      assert.ok(dd.live?.world !== null && dd.live?.world !== undefined, `${part.id}: a world`);
      assert.deepEqual(m.problemsOf(dd), [], `${part.id}: compiles`);
    }
    const html = (() => {
      const said = console.error;
      console.error = (...args) => { if (!String(args[0]).includes('useLayoutEffect does nothing on the server')) said(...args); };
      try { return m.renderToStaticMarkup(m.createElement(m.PagePresentation, { parts: plan.parts, look: plan.look, title: 'Równowaga', mode: 'box' })); } finally { console.error = said; }
    })();
    assert.equal((html.match(/class="pz-scene/g) ?? []).length, 12, 'the server draws twelve scenes');

    const course = JSON.parse(await readFile(join(process.cwd(), 'scripts/fixtures/balance-lab-cogita.json'), 'utf8'));
    assert.equal(course.format, 'recreatio.cogita.course');
    const questions = course.entities.filter((e) => e.kinds.includes('question'));
    assert.equal(questions.length, 8);
    const refs = new Set(course.entities.map((e) => e.ref));
    for (const q of questions) {
      const card = m.questionCard({ id: q.ref.slice(1), kinds: q.kinds, data: q.data }, 's');
      assert.ok(card !== null && card.answer.form === 'interactive', `${q.ref}: a card`);
      assert.equal(m.checkCard(card, { vars: {} }).correct, false, `${q.ref}: untouched is wrong`);
      assert.equal(m.checkCard(card, { vars: {}, world: m.solutionWorld(card.answer) }).correct, true, `${q.ref}: its solution is right`);
      assert.ok(m.solutionText(card.answer).includes(' · '), `${q.ref}: the solution in words`);
      for (const r of q.data.explain) assert.ok(refs.has(r), `${q.ref}: explained by ${r}`);
      const stripped = m.stripCard(card);
      assert.ok(JSON.parse(stripped.answer.drawing).world.things.length > 0 && !JSON.parse(stripped.answer.drawing).rules.some((r) => r.goal), `${q.ref}: participants get the world without the goal`);
    }
    for (const id of course.revisions[0].graph.nodes[0].config.ids) assert.ok(refs.has(id), `the revision lists ${id}`);
    const flow = course.flows[0].graph;
    const nodes = new Set(flow.nodes.map((x) => x.id));
    for (const e of flow.edges) assert.ok(nodes.has(e.from) && nodes.has(e.to), `flow edge ${e.id}`);
    for (const x of flow.nodes) if (typeof x.config.of === 'string') assert.ok(refs.has(x.config.of), `flow step ${x.id} shows ${x.config.of}`);
    ok('fixtures: the lesson (12 scenes, 11 worlds) imports without warning, compiles and renders; the course: 8 questions, wrong untouched, right with their solution, a revision and a flow that point at real entries');
  }

  /* -- 6b. Erst vermuten, dann sehen ------------------------------------------------------------------------------ */
  {
    const things = [
      { id: 'b1', kind: 'belka', length: 6, pivot: 3, lock: true },
      { id: 'w1', kind: 'ciezarek', parent: 'b1', m: 4, pos: 2, lock: true },
      { id: 'w2', kind: 'ciezarek', parent: 'b1', m: 2, pos: 3.5, lock: ['m', 'drop'] }
    ];
    const d = level(things, { predict: true });
    const p = new m.Program(d.live);
    const w2 = p.world.get('w2');
    assert.deepEqual([p.held, p.value('tries')], [true, 0], 'a task to predict starts held');
    assert.ok(p.said().text.startsWith('Najpierw przewiduj'), 'it says what to do');
    const run = (seconds) => { for (let i = 0; i < seconds * 60; i += 1) { p.advance(1 / 60, true); p.settle(); } };
    p.act('run');
    run(2);
    assert.deepEqual([env(p, 'b1').angle, p.status], [0, 'ready'], 'held: the heavier side does not tip, nothing runs by itself');
    p.workshop.editProp(w2, 'pos', 5);
    p.workshop.endEdit();
    run(2);
    assert.deepEqual([p.goalReached(), p.said().text.startsWith('Najpierw')], [false, true], 'held: balanced, yet no goal and no message — nothing gives the answer away');
    p.release();
    assert.deepEqual([p.held, p.value('tries'), p.status], [false, 1, 'running'], '„Sprawdź" lets go');
    run(4);
    assert.ok(p.goalReached() && p.said().text.includes('Przewidziane za pierwszym razem'), 'solved — on the first try');
    p.workshop.gestureStart();
    p.workshop.dragThing(w2, 1.5, 2);
    assert.deepEqual([p.held, env(p, 'b1').angle, p.goalReached()], [true, 0, false], 'a change after the check holds the balance again');
    p.release();
    run(4);
    assert.ok(Math.abs(env(p, 'b1').angle) > 0.34 && p.said().text.startsWith('Przeważa'), 'a wrong guess: it tips, and says why');
    assert.equal(p.value('tries'), 2);
    p.workshop.reset();
    assert.equal(p.held, true, '„Od nowa" holds it again');
    const solved = new m.Program(d.live, { replay: { things: p.world.initialShot().things.map((t) => (t.id === 'w2' ? { ...t, props: { ...t.props, pos: 5 } } : t)) } });
    assert.equal(solved.runToEnd(), true, 'a check (Cogita) lets go by itself');
    /* Ohne `start`: es läuft, und man hält selbst an (die Werkstatt). */
    const shop = new m.Program(m.drawingOf(m.BALANCE.drawing).live);
    assert.equal(shop.held, false, 'the workshop runs freely');
    shop.hold();
    assert.equal(shop.held, true, '„Przewiduj" holds it');
    shop.workshop.editProp(shop.world.get('w2'), 'pos', 6);
    assert.equal(shop.held, true, 'changing while predicting keeps it held');
    shop.release();
    shop.workshop.editProp(shop.world.get('w2'), 'pos', 5);
    shop.workshop.endEdit();
    assert.equal(shop.held, false, 'after the check the workshop runs freely again');
    ok('predict first: held (no motion, no rules, nothing given away), „Sprawdź" lets go, a change holds again, tries, reset, checks let go by themselves');
  }

  /* -- 7. Zahnräder und die Beschreibung --------------------------------------------------------------------------- */
  {
    const gd = m.drawingOf(m.GEARS.drawing);
    assert.deepEqual(m.problemsOf(gd), [], 'the gears compile');
    const p = new m.Program(gd.live);
    near(env(p, 'k2').omega, -2 * env(p, 'k1').omega, 1e-12, 'half the teeth: twice as fast, the other way');
    near(env(p, 'k3').omega, (24 / 36) * env(p, 'k1').omega, 1e-12, 'two meshes: the same way, by the ratio of teeth');
    p.workshop.editProp(p.world.get('k3'), 'teeth', 12);
    near(env(p, 'k3').omega, 2 * env(p, 'k1').omega, 1e-12, 'fewer teeth on the last gear: faster');
    const words = m.liveDescription();
    for (const key of ['"world"', '"kinds"', '"things"', '"apart"', '"keep"', '"camera"', 'sum(children', 'parent.x', 'edits']) assert.ok(words.includes(key), `the description explains ${key}`);
    ok('gears: the same words, another world — ratios and directions; the description explains the world');
  }

  /* -- 8. Zufall mit gleicher Schwierigkeit, und was gegeben ist ------------------------------------------------ */
  {
    /* Ohne Welt: zwei Zahlen, deren Verhältnis auf dem halben Raster liegen soll — und nie gleich. */
    const plain = (task, more = {}) => m.drawingOf({
      size: [100, 60], elements: [{ type: 'rect', x: 0, y: 0, w: 10, h: 10 }],
      vars: [
        { name: 'a', value: 6, min: 1, max: 9, step: 1, random: [1, 9] },
        { name: 'b', value: 3, min: 1, max: 9, step: 1, random: [1, 9] },
        { name: 'k', value: 1, min: 0, max: 1, step: 1 },
        { name: 'solved', value: 0, min: 0, max: 1, step: 1 }
      ],
      let: [{ name: 's', value: 'a/b' }],
      controls: [{ type: 'toggle', var: 'k' }],
      rules: [{ when: 'abs(s - 2) < 1e-9', goal: true, set: { solved: 1 } }],
      task, ...more
    });
    const d = plain({ require: ['onstep(s, 0.5)', 'a != b', 's <= 4'], new: 'Inne liczby' });
    assert.deepEqual(m.problemsOf(d), [], 'a task compiles');
    const seen = new Set();
    for (let i = 0; i < 40; i += 1) {
      const p = new m.Program(d.live, { random: m.seeded(`t${i}`) });
      const a = p.value('a'); const b = p.value('b'); const s0 = a / b;
      assert.ok(Math.abs(s0 * 2 - Math.round(s0 * 2)) < 1e-9 && a !== b && s0 <= 4, `draw ${i}: every require holds (a=${a}, b=${b})`);
      assert.notEqual(s0, 2, `draw ${i}: never solved at the start (the goal rule s = 2 does not hold)`);
      seen.add(`${a}/${b}`);
    }
    assert.ok(seen.size >= 8, `different tasks on different visits (${seen.size} of 40)`);
    const none = new m.Program(plain({ require: ['a > 100'] }).live, { random: m.seeded('x') });
    assert.deepEqual([none.value('a'), none.value('b')], [6, 3], 'no draw fits: the task as the document has it (the values)');
    /* „Nowe zadanie": eine andere — was man selbst schaltet, bleibt; Züge und Prüfungen von vorn. */
    const p = new m.Program(d.live, { random: m.seeded('n') });
    p.set('k', 0);
    p.env.tries = 3;
    const was = JSON.stringify(p.drawn());
    assert.equal(p.redraws(), true, 'a task with chance offers „Nowe zadanie"');
    p.newTask();
    assert.notEqual(JSON.stringify(p.drawn()), was, 'a new task is not the same one again');
    assert.equal(p.value('k'), 0, 'the switch the person set stays');
    assert.equal(p.value('tries'), 0, 'checks count from zero');
    assert.equal(new m.Program(d.live, { fixed: { a: 4, b: 8 } }).redraws(), false, 'fixed (a Cogita attempt): no new task');

    /* Mit einer Welt: das Gewicht rechts aus den gezogenen Zahlen, die Lösung muss auf die Belke passen. */
    const lab = m.balanceDrawing({
      alt: 'test',
      vars: [
        { name: 'a', value: 4, min: 1, max: 9, step: 1, random: [2, 9] },
        { name: 'd', value: 1, min: 0.5, max: 3, step: 0.5, random: [0.5, 3] },
        { name: 'b', value: 2, min: 1, max: 9, step: 1, random: [1, 9] }
      ],
      lets: [{ name: 'sol', value: 'a*d/b' }],
      task: { require: ['onstep(sol, 0.5)', 'a != b', 'abs(sol - 0.5) >= 1'], solve: 'w2.pos = 3 + sol' },
      allow: { add: false, remove: false, copy: false },
      things: [
        { id: 'b1', kind: 'belka', length: 6, pivot: 3, lock: true },
        { id: 'w1', kind: 'ciezarek', parent: 'b1', m: '=a', pos: '=3 - d', lock: true },
        { id: 'w2', kind: 'ciezarek', parent: 'b1', m: '=b', pos: 3.5, lock: ['m', 'drop'] }
      ]
    });
    const ld = m.drawingOf(lab);
    assert.deepEqual(m.problemsOf(ld), [], 'a world task compiles');
    for (let i = 0; i < 25; i += 1) {
      const q = new m.Program(ld.live, { random: m.seeded(`w${i}`) });
      const w1 = env(q, 'w1'); const w2 = env(q, 'w2');
      assert.equal(w1.m, q.value('a'), 'a property as a calculation: w1.m = a');
      assert.equal(w1.pos, 3 - q.value('d'), 'w1.pos = 3 - d');
      const sol = q.solution()['w2.pos'];
      assert.ok(sol <= 6 && sol > 3, `draw ${i}: the solution lies on the beam (${sol})`);
      assert.ok(Math.abs(w1.m * (3 - w1.pos) - w2.m * (sol - 3)) < 1e-9, `draw ${i}: the solution balances (a·d = b·s)`);
      const drawn = q.drawn();
      assert.ok('w1.m' in drawn && 'w2.m' in drawn && 'a' in drawn, 'drawn: the values and the things computed from them');
      const again = new m.Program(ld.live, { fixed: drawn, replay: { things: q.world.initialShot().things.map((t) => (t.id === 'w2' ? { ...t, props: { ...t.props, pos: sol } } : t)) } });
      assert.equal(again.runToEnd(), true, `draw ${i}: with the drawn values held, the solution solves it`);
    }
    /* Cogita: dieselbe Rechnung je Versuch, festgehalten; die Lösung des Bildes, wenn die Frage keine nennt. */
    const spec = m.interactiveSpec({ drawing: JSON.stringify(lab) }, m.seeded('card'));
    assert.ok(spec !== null && typeof spec.fixed.a === 'number' && typeof spec.fixed['w2.m'] === 'number', 'Cogita holds the drawn values of the attempt');
    assert.deepEqual(spec.solution, { 'w2.pos': '3 + sol' }, 'without its own solution the question takes task.solve');
    const target = 3 + spec.fixed.a * spec.fixed.d / spec.fixed.b;
    const start = new m.Program(ld.live, { fixed: spec.fixed }).worldSnapshot();
    const answer = { vars: {}, world: { things: start.things.map((t) => (t.id === 'w2' ? { ...t, props: { ...t.props, pos: target } } : t)) } };
    assert.equal(m.checkInteractive(spec, answer).correct, true, 'the attempt is checked with its own numbers');
    assert.ok(m.solutionText(spec).includes('Ciężarek'), 'the solution in words, with this attempt\'s numbers');

    /* Was gegeben ist und was man ändert. */
    const pq = new m.Program(ld.live, { random: m.seeded('can') });
    assert.deepEqual([env(pq, 'b1').can, env(pq, 'w1').can, env(pq, 'w2').can], [0, 0, 1], 'can: the beam and the left weight are given, the right one can change');
    const marks = m.drawingOf({
      size: [100, 100], elements: [{ type: 'frame', x: 0, y: 0, w: 100, h: 100, view: [0, 0, 10, 10], children: [{ type: 'world' }] }],
      world: {
        kinds: [{
          name: 'box', label: 'Pudło', brief: '{m} kg',
          props: [{ name: 'm', value: 1, min: 1, max: 9, step: 1 }, { name: 'pos', value: 1, min: 0, max: 9, step: 1 }],
          let: [{ name: 'x', value: 'pos' }, { name: 'y', value: 1 }, { name: 'mp', value: 'can.pos' }, { name: 'mm', value: 'can.m' }],
          drag: { pos: 'px' }, can: { edit: ['m'] }
        }],
        things: [{ id: 'p1', kind: 'box', m: 3, lock: true }, { id: 'p2', kind: 'box', m: 2, lock: ['m'] }, { id: 'p3', kind: 'box', m: 5, pos: 4, lock: ['pos'] }],
        allow: { add: false, remove: false, copy: false }
      }
    });
    assert.deepEqual(m.problemsOf(marks), [], 'can.pos compiles in a kind');
    const pm = new m.Program(marks.live);
    assert.deepEqual(['p1', 'p2', 'p3'].map((id) => [env(pm, id).can, env(pm, id).mp, env(pm, id).mm]), [[0, 0, 0], [1, 1, 0], [1, 0, 1]], 'can.pos / can.m per property: dragged, edited, locked');
    assert.deepEqual(pm.world.rows().map((r) => [r.t.id, r.props.map((x) => x.name)]), [['p3', ['m']]], 'a puzzle lists every property that can be edited as a row');
    assert.equal(pm.world.title(pm.world.get('p2')), 'Pudło 2 kg', 'a thing is named by its kind and its brief');
    assert.equal(pm.world.fixed(pm.world.get('p1')), true, 'a thing that is locked is given');
    assert.equal(new m.Program(m.drawingOf(m.BALANCE.drawing).live).world.rows(), null, 'the workshop: select a thing first (no rows)');
    ok('random tasks of comparable difficulty: requires, never solved at the start, reachable solution, calculated properties, fallback, „Nowe zadanie", Cogita per attempt; can / can.pos / rows / brief');
  }

  console.log('\napp-world-check: all passed');
} finally {
  await rm(workspace, { recursive: true, force: true });
}
