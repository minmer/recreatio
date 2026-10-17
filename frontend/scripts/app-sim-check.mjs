/**
 * DAS BILD ZUM ANFASSEN (2026-10-17) — was ohne Browser nachzumessen ist.
 *
 *   1. Die Sprache der Rechnungen: Vorrang, Potenz, Vergleiche, Logik, Texte,
 *      Funktionen, Fehler mit Stelle, eigene Namen vor Konstanten, nichts aus
 *      JavaScript (kein Prototyp, kein eval).
 *   2. Die Simulation gegen die Physik: Wurfweite (geschlossene Formel), Periode
 *      eines Pendels, Energie einer Feder (Runge-Kutta hält sie), ein Aufprall
 *      als Ereignis, ein Stoss mit gleichzeitiger Zuweisung, Neubeginn, wenn ein
 *      Wert des Anfangs sich ändert, Ziel und Regeln, feste Werte (Cogita).
 *   3. Die Zeichnung: lesen (Ausdrücke an Teilen, Texte mit {…}, Punkte,
 *      Rahmen, Wiederholung, Grenzen), `needsLive`, und dass eine Zeichnung
 *      ohne all das dieselbe bleibt.
 */

import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-sim-'));
const entry = join(workspace, 'entry.tsx');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(entry, `
export * from '${app}pages/motion/expr';
export * from '${app}pages/motion/liveModel';
export { colorValue } from '${app}pages/motion/motion';
export { Program } from '${app}pages/motion/liveRun';
export { readDrawing, drawingOf, needsLive, shapeCount, isLiveShape } from '${app}pages/motion/drawing';
export { problemsOf } from '${app}pages/motion/liveRun';
export { LIVE_EXAMPLES } from '${app}pages/motion/liveExamples';
export { liveDescription, livePrompt } from '${app}pages/motion/liveText';
export { LiveDrawing } from '${app}pages/motion/LiveDrawing';
export { questionCard, checkCard } from '${app}cogita/cards';
export { stripCard } from '${app}cogita/live';
export { describeValues, solutionText, solutionValues, givenValuesText, interactiveSpec, checkInteractive, readSolution } from '${app}cogita/interactive';
export { QUESTION } from '${app}cogita/kinds';
export { ANSWER_FORMS } from '${app}cogita/check';
export { partOf } from '${app}pages/parts/registry';
export { planImport, DEFAULT_IMPORT } from '${app}pages/pageJson';
export { pageDescription } from '${app}pages/pageJsonText';
export { readShow, readPiece } from '${app}pages/presentation/presentation';
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
  const ev = (src, env = {}) => m.evaluate(src, env);

  /* -- 1. Die Sprache ---------------------------------------------------------------------------- */
  {
    assert.equal(ev('1 + 2 * 3'), 7);
    assert.equal(ev('(1 + 2) * 3'), 9);
    assert.equal(ev('-2^2'), -4, 'power binds tighter than unary minus');
    assert.equal(ev('2^3^2'), 512, 'power is right-associative');
    assert.equal(ev('2^-1'), 0.5);
    assert.equal(ev('7 % 3'), 1);
    assert.equal(ev('mod(-1, 3)'), 2, 'mod is never negative');
    assert.equal(ev('3 < 4'), 1);
    assert.equal(ev('3 >= 4'), 0);
    assert.equal(ev('1 == 1 && 2 != 3'), 1);
    assert.equal(ev('0 || 0'), 0);
    assert.equal(ev('!0'), 1);
    assert.equal(ev('x > 2 ? 10 : 20', { x: 3 }), 10);
    assert.equal(ev('x > 2 ? 10 : x > 0 ? 15 : 20', { x: 1 }), 15, 'nested ternary');
    assert.equal(ev("'v = ' + 2.5 + ' m/s'"), 'v = 2,5 m/s', 'text + number uses a comma');
    assert.equal(ev('fmt(9.81, 1)'), '9,8');
    assert.equal(ev('fmt(-0.001, 2)'), '0,00', 'no negative zero');
    assert.equal(ev('fmt(-3, 0)'), '−3', 'a real minus sign');
    assert.equal(ev("hit ? 'ok' : 'muted'", { hit: 1 }), 'ok');
    near(ev('sin(rad(30))'), 0.5, 1e-12, 'degrees to radians');
    near(ev('deg(atan2(1, 1))'), 45, 1e-12, 'atan2 to degrees');
    assert.equal(ev('clamp(12, 0, 10)'), 10);
    assert.equal(ev('lerp(0, 10, 0.25)'), 2.5);
    assert.equal(ev('round(3.14159, 2)'), 3.14);
    assert.equal(ev('max(1, 5, 3)'), 5);
    assert.equal(ev('hypot(3, 4)'), 5);
    assert.equal(ev('step(2, 3)'), 1);
    near(ev('smooth(0, 1, 0.5)'), 0.5, 1e-12, 'smoothstep midpoint');
    assert.equal(ev('tri(0.25)'), 0.5);
    assert.equal(ev('rand(3)'), ev('rand(3)'), 'rand is repeatable');
    assert.ok(ev('rand(3)') >= 0 && ev('rand(3)') < 1);
    assert.equal(ev('pi'), Math.PI);
    assert.equal(ev('2e-3 * 1000'), 2);
    assert.equal(ev('.5 + .5'), 1);
    ok('arithmetic, precedence, power, comparisons, logic, ternary, texts with a comma, functions, constants');

    const known = (names) => (name) => names.includes(name);
    const bad = m.compile('v0 * cos(kat', known(['v0', 'kat']));
    assert.ok(m.isExprError(bad) && bad.error.includes(')'), 'missing parenthesis');
    const unknown = m.compile('v0 * cos(kąt)', known(['v0']));
    assert.ok(m.isExprError(unknown) && unknown.error.includes('kąt') && unknown.at === 9, 'unknown name with its position');
    assert.ok(m.isExprError(m.compile('a = b')) && m.compile('a = b').error.includes('=='), 'a single = explains ==');
    assert.ok(m.isExprError(m.compile('foo(1)')), 'unknown function');
    assert.ok(m.isExprError(m.compile('sin(1, 2)')), 'wrong argument count');
    assert.ok(m.isExprError(m.compile('sin')), 'a function without parentheses');
    assert.ok(m.isExprError(m.compile('(' .repeat(80) + '1' + ')'.repeat(80))), 'depth limit');
    assert.ok(m.isExprError(m.compile('1'.repeat(1300))), 'length limit');
    const shadow = m.compile('e * 2', known(['e']));
    assert.equal(shadow.run(Object.assign(m.newEnv(), { e: 0.5 })), 1, 'an own name e beats Euler');
    assert.equal(ev('e'), Math.E, 'e is Euler without an own name');
    assert.deepEqual([...m.compile('a + b * sin(c) + pi').reads].sort(), ['a', 'b', 'c'], 'reads: names, not functions or constants');
    assert.equal(m.compile('2 * 3 + 1').constant, true, 'constant folding');
    assert.equal(ev('constructor'), 0, 'no prototype lookup');
    assert.equal(ev('toString'), 0, 'no prototype lookup (toString)');
    assert.ok(m.isExprError(m.compile('alert`1`')), 'no template strings');
    assert.ok(m.isExprError(m.compile('a.b')), 'no member access');
    assert.ok(m.isExprError(m.compile('a[0]')), 'no indexing');
    const text = m.compileText('Zasięg: {fmt(r, 1)} m', known(['r']));
    assert.equal(text.run(Object.assign(m.newEnv(), { r: 12.345 })), 'Zasięg: 12,3 m');
    assert.equal(m.compileText('stały tekst').constant, true);
    assert.ok(m.isExprError(m.compileText('a {b')), 'unclosed brace');
    ok('errors with their position, own names before constants, reads, folding, nothing from JavaScript, texts with {…}');
  }

  /* -- 2. Die Simulation gegen die Physik ----------------------------------------------------------- */
  const live = (value) => m.readLive(value);
  {
    /* Wurf: Weite v²·sin(2α)/g bis y wieder 0 ist. */
    const projectile = live({
      vars: [{ name: 'kat', value: 45, min: 0, max: 90, step: 1, unit: '°' }, { name: 'v0', value: 10, min: 1, max: 30 }, { name: 'g', value: 9.81 }],
      let: [{ name: 'zasieg', value: 'v0^2*sin(rad(2*kat))/g' }],
      sim: {
        state: [
          { name: 'x', value: 0, rate: 'vx' }, { name: 'y', value: 0, rate: 'vy' },
          { name: 'vx', value: 'v0*cos(rad(kat))', rate: 0 }, { name: 'vy', value: 'v0*sin(rad(kat))', rate: '-g' }
        ],
        until: 't > 0.05 && y <= 0', dt: 0.001
      },
      rules: [{ when: 'abs(x - zasieg) < 0.2 && y <= 0 && t > 0', say: 'Trafione!', goal: true }]
    });
    const p = new m.Program(projectile);
    assert.deepEqual(p.problems, [], 'no problems');
    assert.equal(p.status, 'ready');
    near(p.value('vx'), 10 * Math.cos(Math.PI / 4), 1e-9, 'state starts from the values');
    const reached = p.runToEnd();
    near(p.value('x'), 100 / 9.81, 0.03, 'range of a projectile (45°, 10 m/s)');
    assert.equal(reached, true, 'the goal is reached on the way');
    assert.equal(p.status, 'ended');
    assert.equal(p.said()?.text, 'Trafione!');
    /* Ein Wert des Anfangs ändert sich: von vorn, der Anfang folgt. */
    p.set('kat', 30.4);
    assert.equal(p.value('kat'), 30, 'snapped to the step');
    assert.equal(p.status, 'ready', 'a value of the start restarts');
    near(p.value('vy'), 10 * Math.sin(Math.PI / 6), 1e-9, 'the start follows the value');
    assert.equal(p.goalReached(), false, 'the goal is forgotten on restart');
    p.set('kat', 200);
    assert.equal(p.value('kat'), 90, 'clamped to max');
    ok('projectile: range within 3 cm of v²·sin(2α)/g, goal on the way, snap, clamp, restart on a value of the start');

    /* Pendel: kleine Auslenkung — Periode 2π√(L/g). */
    const pendulum = live({
      vars: [{ name: 'L', value: 2 }, { name: 'g', value: 9.81 }, { name: 'th0', value: 3 }],
      sim: { state: [{ name: 'th', value: 'rad(th0)', rate: 'om' }, { name: 'om', value: 0, rate: '-g/L*sin(th)' }], dt: 0.002 },
      rules: [{ when: 'om > 0', say: 'połowa' }]
    });
    const q = new m.Program(pendulum);
    q.act('run');
    /* Von +θ₀ (om = 0) schwingt es erst zurück (om < 0), dann wieder her (om > 0): wird om danach wieder 0, ist eine ganze Periode um. */
    let period = null;
    let prev = 0;
    for (let i = 0; i < 20000 && period === null; i += 1) {
      q.advance(0.002, false);
      const om = q.value('om');
      if (prev > 0 && om <= 0) period = q.value('t');
      prev = om;
    }
    near(period, 2 * Math.PI * Math.sqrt(2 / 9.81), 0.01, 'period of a pendulum (small swing)');
    ok('pendulum: period within 10 ms of 2π√(L/g)');

    /* Feder ohne Dämpfung: Energie bleibt (RK4). */
    const spring = live({
      vars: [{ name: 'k', value: 20 }, { name: 'masa', value: 0.5 }, { name: 'x0', value: 0.3 }],
      let: [{ name: 'E', value: '0.5*masa*v^2 + 0.5*k*x^2' }],
      sim: { state: [{ name: 'x', value: 'x0', rate: 'v' }, { name: 'v', value: 0, rate: '-k/masa*x' }], dt: 0.002 }
    });
    const s = new m.Program(spring);
    const e0 = s.value('E');
    s.act('run');
    for (let i = 0; i < 500; i += 1) s.advance(1 / 60, false);
    near(s.value('E'), e0, e0 * 1e-6, 'energy of a spring after 8 s');
    near(s.value('t'), 500 / 60, 0.003, 'fixed steps follow the clock');
    ok('spring: energy kept to 1e-6 over 8 s, the clock is followed in fixed steps');

    /* Aufprall als Ereignis. */
    const bounce = live({
      vars: [{ name: 'h0', value: 2 }, { name: 'e', value: 0.8 }],
      sim: {
        state: [{ name: 'y', value: 'h0', rate: 'vy' }, { name: 'vy', value: 0, rate: '-9.81' }],
        events: [{ when: 'y < 0 && vy < 0', set: { y: '-y', vy: '-e*vy' }, say: 'odbicie' }],
        until: 't > 3'
      }
    });
    const b = new m.Program(bounce);
    b.runToEnd();
    assert.ok(b.value('y') >= -0.01, 'stays above the ground');
    let peak = 0;
    const b2 = new m.Program(bounce);
    b2.act('run');
    let bounced = false;
    for (let i = 0; i < 3000; i += 1) {
      b2.advance(0.001, false);
      if (b2.value('vy') > 0) bounced = true;
      if (bounced && b2.value('vy') <= 0) { peak = Math.max(peak, b2.value('y')); break; }
    }
    near(peak, 2 * 0.64, 0.02, 'the next height is e²·h');
    assert.equal(b2.said()?.text, 'odbicie');
    ok('bounce: an event reflects the speed, the next height is e²·h, the ball stays above the ground');

    /* Stoss: gleichzeitige Zuweisung (sonst wäre v2 aus dem neuen v1 gerechnet). */
    const collide = live({
      vars: [{ name: 'm1', value: 1 }, { name: 'm2', value: 1 }],
      sim: {
        state: [
          { name: 'x1', value: 0, rate: 'v1' }, { name: 'v1', value: 2, rate: 0 },
          { name: 'x2', value: 1, rate: 'v2' }, { name: 'v2', value: 0, rate: 0 }
        ],
        events: [{ when: 'x2 - x1 < 0.1', set: { v1: '((m1 - m2)*v1 + 2*m2*v2)/(m1 + m2)', v2: '((m2 - m1)*v2 + 2*m1*v1)/(m1 + m2)' } }],
        until: 't > 1'
      }
    });
    const c = new m.Program(collide);
    c.runToEnd();
    near(c.value('v1'), 0, 1e-9, 'equal masses swap speeds (v1)');
    near(c.value('v2'), 2, 1e-9, 'equal masses swap speeds (v2)');
    ok('collision: assignments are simultaneous — equal masses swap their speeds');

    /* Feste Werte (Cogita) und Zufall mit Samen. */
    const randomVar = live({ vars: [{ name: 'cel', value: 5, min: 2, max: 18, step: 0.5, random: [4, 16] }] });
    const r1 = new m.Program(randomVar, { random: () => 0.5 });
    assert.equal(r1.value('cel'), 10, 'random drawn from the range, snapped');
    const r2 = new m.Program(randomVar, { fixed: { cel: 7.2 } });
    assert.equal(r2.value('cel'), 7, 'fixed values win (snapped)');
    assert.deepEqual(r2.snapshot(), { cel: 7 }, 'snapshot: the values that were set');
    ok('random values from a seed, fixed values (Cogita), snapshot');

    /* Regeln: einmal je Durchgang, setzen, sagen mit {…}, weiter in der Präsentation. */
    const rules = live({
      vars: [{ name: 'a', value: 0, min: 0, max: 10 }, { name: 'b', value: 0 }],
      rules: [
        { when: 'a >= 5', set: { b: 'b + 1' }, say: 'a = {a}', go: 'next' },
        { when: 'a >= 8', say: 'raz', once: true, mood: 'miss' }
      ]
    });
    const pr = new m.Program(rules);
    pr.set('a', 6); pr.settle();
    assert.equal(pr.value('b'), 1, 'a rule sets');
    assert.equal(pr.said()?.text, 'a = 6', 'a rule says with {…}');
    assert.deepEqual(pr.takeGos(), ['next'], 'a rule goes on');
    pr.set('a', 7); pr.settle();
    assert.equal(pr.value('b'), 1, 'fires when it BECOMES true, not while it is');
    pr.set('a', 1); pr.settle(); pr.set('a', 6); pr.settle();
    assert.equal(pr.value('b'), 2, 're-armed after being false');
    pr.set('a', 9); pr.settle();
    assert.equal(pr.said()?.mood, 'miss');
    pr.set('a', 1); pr.settle(); pr.set('a', 9); pr.settle();
    assert.equal(pr.said()?.text, 'a = 9', 'once: not again in the same run');
    ok('rules: fire on the rising edge, set, say with {…}, go on, once per run');

    /* Probleme: unbekannte Namen, Steuerung ohne Wert, Zuweisung an eine Rechnung — und es rechnet trotzdem. */
    const broken = live({
      vars: [{ name: 'a', value: 2 }],
      let: [{ name: 'b', value: 'a * zzz' }],
      controls: [{ type: 'slider', var: 'nope' }],
      rules: [{ when: 'a > 1', set: { b: 3 } }]
    });
    const pb = new m.Program(broken);
    assert.ok(pb.problems.some((x) => x.error.includes('zzz')), 'unknown name reported');
    assert.ok(pb.problems.some((x) => x.error.includes('nope')), 'control without a value reported');
    assert.ok(pb.problems.some((x) => x.where.startsWith('rules[0].set')), 'assigning to a computed value reported');
    assert.equal(pb.value('b'), 0, 'the unknown name counts 0 — the rest still works');
    ok('problems: reported with where and what, and the drawing still computes');

    /* NaN hält die Simulation an, statt das Bild zu leeren. */
    const nan = new m.Program(live({ sim: { state: [{ name: 'x', value: 1, rate: '1/(x - x)' }] } }));
    nan.act('run');
    nan.advance(0.1, false);
    assert.equal(nan.status, 'ended');
    assert.equal(nan.value('x'), 1, 'state kept before the explosion');
    assert.ok(nan.problems.some((x) => x.where === 'sim'));
    ok('a simulation that explodes stops and keeps its last good state');

    /* Ein Wert, der nur die Raten ändert, wirkt ohne Neubeginn. */
    const g = new m.Program(live({
      vars: [{ name: 'g', value: 9.81 }, { name: 'h', value: 10 }],
      sim: { state: [{ name: 'y', value: 'h', rate: 'vy' }, { name: 'vy', value: 0, rate: '-g' }] }
    }));
    g.act('run');
    g.advance(0.5, false);
    const before = g.value('t');
    g.set('g', 1.62);
    assert.equal(g.status, 'running', 'gravity changes live');
    assert.equal(g.value('t'), before, 'no restart');
    g.set('h', 5);
    assert.equal(g.status, 'ready', 'a value of the start restarts');
    ok('a value of the rates acts at once; a value of the start restarts');
  }

  /* -- 3. Die Zeichnung --------------------------------------------------------------------------------- */
  {
    const d = m.drawingOf({
      size: [400, 300],
      vars: [{ name: 'kat', value: 30 }],
      elements: [
        { type: 'circle', x: '=100 + kat', y: 50, r: 6, fill: "=kat > 40 ? 'ok' : 'accent'" },
        { type: 'text', x: 10, y: 10, text: 'kąt: {fmt(kat, 0)}°' },
        { type: 'text', x: 10, y: 30, text: '=kat * 2' },
        { type: 'poly', points: [[0, 0], ['=kat', 10]], closed: true },
        { type: 'frame', x: 20, y: 20, w: 300, h: 200, view: [0, 0, '=kat', 10], axes: { x: 'x [m]', grid: true }, clip: true, children: [{ type: 'arrow', x: 0, y: 0, x2: 5, y2: 5 }] },
        { type: 'plot', fn: 'u^2', from: 0, to: 2, samples: 900 },
        { type: 'circle', x: '=i*10', y: 5, r: 2, repeat: 50 },
        { type: 'rect', x: 0, y: 0, w: 10, h: 10, drag: { x: 'kat', label: 'Kąt' }, show: 'kat > 0' }
      ]
    });
    const [circle, text, textExpr, poly, frame, plot, dots, rect] = d.elements;
    assert.deepEqual(circle.bind, { x: '100 + kat', fill: "kat > 40 ? 'ok' : 'accent'" }, 'expressions on a part');
    assert.equal(text.bind.text, 'kąt: {fmt(kat, 0)}°', 'a text with {…} computes');
    assert.equal(textExpr.bind.text, '{kat * 2}', 'a text "=…" becomes {…}');
    assert.deepEqual(poly.points, [[0, 0], [{ expr: 'kat' }, 10]], 'points: numbers or expressions');
    assert.deepEqual(frame.view, [0, 0, { expr: 'kat' }, 10], 'a frame and its view');
    assert.deepEqual(frame.axes, { x: 'x [m]', y: '', grid: true });
    assert.equal(frame.children[0].type, 'arrow');
    assert.equal(plot.samples, 600, 'samples limited');
    assert.equal(dots.repeat, 50);
    assert.deepEqual(rect.drag, { x: 'kat', y: null, set: {}, label: 'Kąt' });
    assert.equal(rect.show, 'kat > 0');
    assert.equal(m.needsLive(d), true);
    assert.equal(m.shapeCount(d), 58, 'a repeated part counts as often as it stands');
    const plain = m.drawingOf({ size: [10, 10], elements: [{ type: 'circle', x: 1, y: 1, r: 1 }] });
    assert.equal(m.needsLive(plain), false, 'a plain drawing stays a plain drawing');
    assert.equal(plain.live, null);
    const textOnly = m.drawingOf({ size: [10, 10], elements: [{ type: 'text', x: 1, y: 1, text: 'tylko tekst' }] });
    assert.equal(m.needsLive(textOnly), false, 'a text without {…} is plain');
    const stored = m.readDrawing({
      size: '[100, 100]', elements: '[{"type":"circle","x":"=a","y":1,"r":2}]', vars: '{"name":"a","value":3}',
      sim: '{"state":[{"name":"s","value":0,"rate":1}]}', controls: '[{"type":"slider","var":"a"}]', panel: 'side'
    });
    assert.equal(stored.live.vars[0].name, 'a', 'a single var without brackets is a list of one');
    assert.equal(stored.live.sim.state[0].rate, '1', 'numbers are expressions too');
    assert.equal(stored.live.panel, 'side');
    const names = m.readLive({ vars: [{ name: 't' }, { name: '1a' }, { name: 'ok_1' }, { name: 'ok_1' }, { name: 'kąt' }] });
    assert.deepEqual(names.vars.map((v) => v.name), ['ok_1', 'kąt'], 'built-in names, bad names and doubles are dropped');
    const okColour = m.drawingOf({ size: [10, 10], elements: [{ type: 'rect', x: 0, y: 0, w: 1, h: 1, fill: 'ok', stroke: 'ok/70' }] }).elements[0];
    assert.deepEqual([okColour.fill, okColour.stroke], ['ok', 'ok/70'], 'the theme name ok (two letters) is a colour');
    ok('drawing: expressions, texts with {…}, points, frames, repeat, drag, show; needsLive; a plain drawing stays plain');
  }

  /** Der Server kennt keine Layout-Effekte — diese eine Warnung ist hier kein Fehler. */
  const quietly = (render) => {
    const said = console.error;
    console.error = (...args) => { if (!String(args[0]).includes('useLayoutEffect does nothing on the server')) said(...args); };
    try { return render(); } finally { console.error = said; }
  };

  /* -- 4. Die Beispiele und das Bild selbst ------------------------------------------------------------- */
  {
    assert.ok(m.LIVE_EXAMPLES.length >= 8, 'eight or more physics examples');
    for (const ex of m.LIVE_EXAMPLES) {
      const d = m.drawingOf(ex.drawing);
      assert.ok(m.needsLive(d), `${ex.key}: needs the live drawing`);
      assert.deepEqual(m.problemsOf(d), [], `${ex.key}: every expression compiles with the names of the drawing`);
      assert.ok(m.shapeCount(d) <= 300, `${ex.key}: light (${m.shapeCount(d)} parts)`);
      assert.ok(JSON.stringify(ex.drawing).length < 8000, `${ex.key}: small as data`);
      if (d.live?.sim !== null && d.live?.sim !== undefined && !d.live.sim.loop) {
        const p = new m.Program(d.live, { random: () => 0.5 });
        p.runToEnd();
        assert.equal(p.status, 'ended', `${ex.key}: the simulation ends`);
      }
      const html = quietly(() => m.renderToStaticMarkup(m.createElement(m.LiveDrawing, { drawing: d, identity: ex.key })));
      assert.ok(html.includes('class="lv-stage"') && html.includes('data-k="0"'), `${ex.key}: drawn as a skeleton the loop writes into`);
      if ((d.live?.controls.length ?? 0) > 0) assert.ok(html.includes('class="lv-controls"'), `${ex.key}: controls under the drawing`);
      if (JSON.stringify(ex.drawing).includes('"drag"')) assert.ok(html.includes('data-pz-hold') && html.includes('class="lv-hit"'), `${ex.key}: handles with a 44 px ring that the presentation leaves alone`);
      const still = quietly(() => m.renderToStaticMarkup(m.createElement(m.LiveDrawing, { drawing: d, identity: `${ex.key}-still`, still: true })));
      assert.ok(!still.includes('lv-controls') && !still.includes('data-drag'), `${ex.key}: still — no controls, no handles`);
    }

    /* Der Wurf: aus der Mitte des Zufalls (cel = 12), mit 45° und 11 m/s (Weite 12,3 m) — getroffen; mit 10 m/s (10,2 m) nicht. */
    const rzut = m.drawingOf(m.LIVE_EXAMPLES.find((x) => x.key === 'rzut').drawing);
    const hit = new m.Program(rzut.live, { random: () => 0.5, fixed: { kat: 45, v0: 11 } });
    assert.equal(hit.value('cel'), 12);
    assert.equal(hit.runToEnd(), true, 'projectile: 45° and 11 m/s hit the flag at 12 m');
    assert.ok(hit.said().text.startsWith('Trafione'));
    const miss = new m.Program(rzut.live, { random: () => 0.5, fixed: { kat: 45, v0: 10 } });
    assert.equal(miss.runToEnd(), false);
    assert.ok(miss.said().text.startsWith('Za krótko'), 'a miss explains itself');

    /* Die Brechung: Snellius und das Totalreflexion-Fenster. */
    const zal = m.drawingOf(m.LIVE_EXAMPLES.find((x) => x.key === 'zalamanie').drawing);
    const glass = new m.Program(zal.live, { fixed: { a1: 30, n1: 1, n2: 1.5 } });
    near(glass.value('a2'), 19.47, 0.01, 'air → glass at 30°: 19.47°');
    const tir = new m.Program(zal.live, { fixed: { a1: 50, n1: 1.5, n2: 1 } });
    assert.equal(tir.value('odbicie'), 1, 'glass → air at 50°: total internal reflection');
    tir.settle();
    assert.ok(tir.said().text.includes('Całkowite'));

    /* Die Umlaufbahn: v = 1 — ein Kreis (der Abstand bleibt 1). */
    const orb = m.drawingOf(m.LIVE_EXAMPLES.find((x) => x.key === 'orbita').drawing);
    const circle = new m.Program(orb.live, { fixed: { vs: 1, kier: 90 } });
    circle.act('run');
    let rMin = 9, rMax = 0;
    for (let i = 0; i < 400; i += 1) { circle.advance(1 / 60, false); rMin = Math.min(rMin, circle.value('r')); rMax = Math.max(rMax, circle.value('r')); }
    near(rMin, 1, 0.001, 'orbit: the circle keeps its radius (min)');
    near(rMax, 1, 0.001, 'orbit: the circle keeps its radius (max)');
    const escape = new m.Program(orb.live, { fixed: { vs: 1.5, kier: 90 } });
    escape.runToEnd();
    assert.ok(escape.value('r') > 4.4 && escape.value('E') > 0, 'orbit: 1.5 × circular speed escapes');

    const part = m.partOf('animation');
    const example = m.readDrawing(part.json.fromJson(part.json.example));
    assert.deepEqual(m.problemsOf(example), [], 'the example of the part compiles');
    assert.ok(m.needsLive(example) && example.live.rules.some((r) => r.goal), 'the example of the part is interactive, with a goal');
    const words = m.liveDescription();
    for (const key of ['"vars"', '"let"', '"sim"', '"controls"', '"rules"', '"drag"', '"frame"', '"trace"', 'Runge-Kutta', 'step', 'fmt(x, cyfry)']) assert.ok(words.includes(key), `the description explains ${key}`);
    assert.ok(m.pageDescription().includes('## Rysunek do poruszania'), 'the page description has the section');
    assert.ok(m.livePrompt({ a: 1 }).includes('Zwróć JEDEN obiekt JSON'), 'a prompt to copy for the AI');
    ok(`${m.LIVE_EXAMPLES.length} physics examples: compile, light, end, drawn (handles, controls, still); projectile, refraction and orbit agree with physics; the part and the description`);
  }

  /* -- 5. Cogita: eine Frage, die man mit den Händen beantwortet ------------------------------------------ */
  {
    assert.ok(m.ANSWER_FORMS.includes('interactive'), 'a new answer form');
    assert.ok(m.QUESTION.fields.some((f) => f.key === 'drawing') && m.QUESTION.fields.some((f) => f.key === 'goal') && m.QUESTION.fields.some((f) => f.key === 'solution'), 'the question kind has its fields');
    const rzut = m.LIVE_EXAMPLES.find((x) => x.key === 'rzut').drawing;
    const entity = { id: 'q-rzut', kinds: ['question'], data: { form: 'interactive', prompt: 'Traf w chorągiewkę.', drawing: JSON.stringify(rzut), solution: 'kat = 45; v0 = sqrt(cel*g)' } };
    const card = m.questionCard(entity, 'próba-1');
    assert.ok(card !== null && card.answer.form === 'interactive', 'a card from the question');
    assert.equal(card.varies, true, 'random target: a different question each time');
    assert.ok(card.answer.fixed.cel >= 6 && card.answer.fixed.cel <= 18, 'the drawn target is in its range');
    const again = m.questionCard(entity, 'próba-2');
    assert.equal(again.fingerprint, card.fingerprint, 'the history of the card survives a new target');
    assert.deepEqual(m.questionCard(entity, 'próba-1').answer.fixed, card.answer.fixed, 'the same seed, the same target');

    /* Die richtige Antwort finden wir durch Rechnen: v² · sin(2α) / g = cel bei 45°. */
    const cel = card.answer.fixed.cel;
    const v0 = Math.round(Math.sqrt(cel * 9.81) * 2) / 2;
    const reach = (v) => (v * v) / 9.81;
    const good = Math.abs(reach(v0) - cel) <= 0.6 ? v0 : null;
    if (good !== null) {
      const right = m.checkCard(card, { vars: { kat: 45, v0: good } });
      assert.deepEqual([right.correct, right.correctness, right.answered], [true, 1, true], `the right values hit (cel ${cel}, v0 ${good})`);
    }
    const wrong = m.checkCard(card, { vars: { kat: 10, v0: 4 } });
    assert.deepEqual([wrong.correct, wrong.correctness], [false, 0], 'wrong values miss');
    const solved = m.solutionValues(card.answer);
    assert.ok(Math.abs(solved.v0 - Math.sqrt(cel * 9.81)) < 1e-9 && solved.kat === 45, 'the solution is a computation with the drawn target');
    assert.equal(wrong.expected, `Kąt = 45°; Prędkość = ${m.fmt(Math.sqrt(cel * 9.81), 1)} m/s`, 'the solution in words, with names and units');
    assert.equal(m.checkCard(card, { vars: solved }).correct, true, 'the solution, as it would be set on the sliders, is right');
    assert.equal(m.givenValuesText(card.answer, { vars: { kat: 30, v0: 9.5, cel: 3, g: 9.81 } }), 'Kąt = 30°; Prędkość = 9,5 m/s', 'the answer in words: only what the learner could set');
    assert.deepEqual(m.readSolution('kat = 45; v0 = 11,5; w = max(a, b)'), { kat: '45', v0: '11.5', w: 'max(a, b)' }, 'a solution: a decimal comma in a number, argument commas left alone');
    const cheat = m.checkCard(card, { vars: { kat: 45, v0: 10, cel: reach(10) } });
    assert.equal(cheat.correct, Math.abs(reach(10) - cel) <= 0.6, 'the drawn target cannot be overridden by the answer');
    assert.equal(m.checkCard(card, 'nonsense').answered, false, 'no values, no answer');

    /* Ein eigenes Ziel in der Frage, ohne Regel im Bild. */
    const own = m.questionCard({ id: 'q2', kinds: ['question'], data: { form: 'interactive', drawing: { size: [10, 10], vars: [{ name: 'a', value: 1, min: 0, max: 10 }], elements: [{ type: 'circle', x: '=a', y: 5, r: 1 }] }, goal: 'a >= 7' } }, 's');
    assert.equal(m.checkCard(own, { vars: { a: 8 } }).correct, true, 'the question goal: met');
    assert.equal(m.checkCard(own, { vars: { a: 3 } }).correct, false, 'the question goal: not met');
    assert.equal(own.varies, false);
    const free = m.questionCard({ id: 'q3', kinds: ['question'], data: { form: 'interactive', drawing: { size: [10, 10], elements: [{ type: 'circle', x: 1, y: 1, r: 1, drag: 'a' }], vars: [{ name: 'a', value: 1 }] } } }, 's');
    assert.equal(m.checkCard(free, { vars: { a: 2 } }).correct, true, 'without any goal: practice — every answer counts');
    assert.equal(m.questionCard({ id: 'q4', kinds: ['question'], data: { form: 'interactive', drawing: 'nie JSON' } }, 's'), null, 'no drawing, no card');

    /* Für die Teilnehmer einer Sitzung: kein Ziel, keine Lösung, keine Regel mit "goal". */
    const stripped = m.stripCard(card);
    assert.equal(stripped.answer.goal, null);
    assert.equal(stripped.answer.solution, null);
    assert.ok(!JSON.parse(stripped.answer.drawing).rules.some((r) => r.goal === true), 'the goal rule does not travel to participants');
    assert.ok(JSON.parse(stripped.answer.drawing).rules.length >= 2, 'the hints (rules without goal) stay');
    assert.equal(m.describeValues(JSON.stringify(rzut), { kat: 30, v0: 9.5 }), 'Kąt = 30°; Prędkość = 9,5 m/s');
    ok('Cogita: interactive questions — a card with a drawn target per try, checked by simulating the given values to the end, its own goal, practice without one, stripped for participants');
  }

  /* -- 6. Die Lektion (fixtures/physics-lesson.json) ---------------------------------------------------- */
  {
    const fixture = JSON.parse(await readFile(join(process.cwd(), 'scripts/fixtures/physics-lesson.json'), 'utf8'));
    const empty = { path: 'zz-probe/fizyka', title: '', lead: '', mode: 'page', look: { theme: null, cover: [] }, parts: [], logic: null, menu: null };
    const plan = m.planImport(fixture, empty, { ...m.DEFAULT_IMPORT, replace: true });
    assert.ok(!('error' in plan), JSON.stringify(plan).slice(0, 300));
    assert.deepEqual(plan.warnings, [], 'the lesson imports without a single warning');
    assert.equal(plan.mode, 'presentation');
    const show = m.readShow(plan.look.show);
    assert.equal(show.scenes.length, 10);
    const drawings = plan.parts.filter((p) => p.kind === 'animation');
    assert.equal(drawings.length, 9, 'nine drawings to touch');
    for (const part of drawings) {
      for (const value of Object.values(part.config)) assert.ok(value.length <= 64000, 'fits the module limit');
      const d = m.readDrawing(part.config);
      assert.ok(m.needsLive(d), `${part.id}: live`);
      assert.deepEqual(m.problemsOf(d), [], `${part.id}: compiles`);
      assert.ok(Object.keys(m.readPiece(part.layout).places).length === 1, `${part.id}: stands on its scene`);
    }
    const html = quietly(() => m.renderToStaticMarkup(m.createElement(m.PagePresentation, { parts: plan.parts, look: plan.look, title: 'Fizyka', mode: 'box' })));
    assert.equal((html.match(/class="pz-scene/g) ?? []).length, 10, 'the server draws ten scenes');
    ok('fixtures/physics-lesson.json: a presentation of 10 scenes with 9 drawings to touch; imports without warning, fits, compiles, renders');
  }

  console.log('\napp-sim-check: all passed');
} finally {
  await rm(workspace, { recursive: true, force: true });
}
