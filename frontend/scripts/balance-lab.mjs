/**
 * LABORATORIUM RÓWNOWAGI (2026-10-18) — `fixtures/balance-lab.json` und
 * `fixtures/balance-lab-cogita.json`.
 *
 * Ein Spiel aus Belken und Gewichten — und nichts davon ist Code: jede Stufe
 * ist dieselbe Welt (`src/app/pages/motion/liveWorlds.ts`: die Arten „belka"
 * und „ciezarek", ihre Rechnungen, ihr Aussehen) mit anderen Dingen, Sperren
 * und Regeln. Daraus zwei Dokumente:
 *
 *   balance-lab.json         eine Präsentation (Format jeder Seite, "recreatio/page"):
 *                            Einführung, sechs Stufen, zwei für Fortgeschrittene,
 *                            die Werkstatt, Zahnräder (dieselben Wörter, eine andere Welt), Nauka
 *   balance-lab-cogita.json  ein Kurs für Cogita ("recreatio.cogita.course"): Wissen,
 *                            die Stufen als Fragen (Antwort: die gebaute Waage, geprüft durch
 *                            Nachrechnen), eine Wiederholung, ein Ablauf
 *
 * 2026-10-18 — jede Stufe ist eine FAMILIE gleich schwerer Aufgaben: bei jedem
 * Besuch (und mit „Nowe zadanie", und in Cogita je Versuch) andere Zahlen —
 * gezogen, bis die Bedingungen der Stufe gelten (`task` im Bild,
 * `src/app/pages/motion/liveTask.ts`). Bevor geschrieben wird, prüft das
 * Skript jede Familie an vielen Zügen: sie übersetzt ohne Fehler, steht am
 * Anfang NICHT im Gleichgewicht, und ihre Lösung — durch die Regeln der Welt
 * nachgespielt, wie in Cogita — erreicht das Ziel; die Fassung des Dokuments
 * ebenso; und die Familie ist bunt genug.
 *
 *   node scripts/balance-lab.mjs
 */

import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'balance-lab-'));
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
try {
  await build({
    stdin: {
      contents: `
export { balanceDrawing, BALANCE, GEARS } from '${app}pages/motion/liveWorlds';
export { Program } from '${app}pages/motion/liveRun';
export { problemsOf } from '${app}pages/motion/liveLint';
export { drawingOf } from '${app}pages/motion/drawing';
export { seeded } from '${app}pages/motion/liveTask';
`,
      resolveDir: process.cwd(),
      loader: 'ts'
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: join(workspace, 'lab.mjs'),
    logLevel: 'error'
  });
  const m = await import(pathToFileURL(join(workspace, 'lab.mjs')).href);

  /* Gesperrt: die Belke ganz (`true`), ein Gewicht bis auf das, was man ändern soll. */
  const beam = (id, props, lock = true) => ({ id, kind: 'belka', ...props, lock });
  const weight = (id, parent, props, lock = true) => ({ id, kind: 'ciezarek', parent, ...props, lock });
  const puzzle = { add: false, remove: false, copy: false };
  const next = { type: 'button', label: 'Dalej →', go: 'next', show: 'solved' };
  /** Eine gezogene Zahl: Wert im Dokument (die Aufgabe, wenn kein Zug passt), Raster, Bereich des Zufalls. */
  const draw = (name, value, from, to, step = 1, label = '') => ({ name, value, min: from, max: to, step, random: [from, to], ...(label === '' ? {} : { label }) });

  /**
   * DIE STUFEN — jede eine FAMILIE gleich schwerer Aufgaben: dieselbe Welt,
   * gezogene Zahlen (`vars` mit `random`), was daraus folgt (`lets`), wann die
   * Aufgabe gilt (`require`: die Lösung auf dem Raster, weit genug vom Anfang,
   * Zahlen aus demselben Bereich) und die Lösung als Rechnung (`solve` — in
   * Cogita die Lösung). Die Werte im Dokument sind die erste Fassung der Stufe.
   */
  const LEVELS = [
    {
      key: 'p1', title: 'Poziom 1 · Prosta równowaga',
      body: ['Szary ciężarek jest przykręcony. Gdzie powiesić zielony, żeby belka stanęła poziomo?', 'Ustaw zielony tam, gdzie według ciebie będzie równowaga, i kliknij „Sprawdź”. „Nowe zadanie” losuje inne liczby.'],
      prompt: 'Szary ciężarek jest przykręcony. Przesuń zielony tak, żeby belka stanęła poziomo.',
      say: 'Przewiduj: po lewej {w1.m} kg, {abs(w1.arm)} m od osi. Gdzie powiesić {w2.m} kg? Ustaw i kliknij „Sprawdź”.',
      hint: 'Przeciągnij zielony ciężarek wzdłuż belki albo ustaw go suwakiem.',
      solved: 'Brawo! {w1.m} kg × {abs(w1.arm)} m = {w2.m} kg × {w2.arm} m.',
      vars: [draw('a', 4, 2, 9), draw('d', 1, 0.5, 3, 0.5), draw('b', 2, 1, 9), draw('r0', 0.5, 0.5, 3, 0.5)],
      lets: [{ name: 's', value: 'a*d/b' }],
      require: ['a != b', 'onstep(s, 0.5)', 's >= 0.5 && s <= 3', 'abs(s - r0) >= 1'],
      solve: 'w2.pos = 3 + s',
      things: [beam('b1', { length: 6, pivot: 3 }), weight('w1', 'b1', { m: '=a', pos: '=3 - d' }), weight('w2', 'b1', { m: '=b', pos: '=3 + r0' }, ['m', 'drop'])],
      explain: 'moment'
    },
    {
      key: 'p2', title: 'Poziom 2 · Inna masa',
      body: ['Ciężarki są przykręcone — zmienić można tylko masę zielonego.', 'Moment to masa × ramię: policz lewą stronę, a potem dobierz masę.'],
      prompt: 'Ciężarków nie da się przesunąć. Ustaw masę zielonego ciężarka tak, żeby belka była w równowadze.',
      say: 'Przewiduj: po lewej {w1.m} kg, {abs(w1.arm)} m od osi; zielony wisi {w2.arm} m od osi. Jaka musi być jego masa?',
      hint: 'Zmień masę zielonego ciężarka (−, +, suwak albo liczba).',
      solved: 'Tak: {w2.m} kg × {w2.arm} m = {w1.m} kg × {abs(w1.arm)} m.',
      vars: [draw('a', 6, 2, 9), draw('d', 2, 0.5, 3, 0.5), draw('e', 3, 0.5, 3, 0.5), draw('b0', 2, 1, 9)],
      lets: [{ name: 'need', value: 'a*d/e' }],
      require: ['d != e', 'onstep(need, 1)', 'need >= 1 && need <= 12', 'abs(need - b0) >= 2'],
      solve: 'w2.m = need',
      things: [beam('b1', { length: 6, pivot: 3 }), weight('w1', 'b1', { m: '=a', pos: '=3 - d' }), weight('w2', 'b1', { m: '=b0', pos: '=3 + e' }, ['pos', 'drop'])],
      explain: 'rownowaga'
    },
    {
      key: 'p3', title: 'Poziom 3 · Kilka ciężarków',
      body: ['Po lewej dwa szare ciężarki, po prawej dwa zielone do przesunięcia. Wystarczy, że sumy momentów są równe — sposobów jest kilka.', '> Moment strony = suma momentów jej ciężarków.'],
      prompt: 'Po lewej wiszą dwa przykręcone ciężarki. Ułóż dwa zielone po prawej tak, żeby belka była w równowadze.',
      say: 'Przewiduj: po lewej {w1.m} kg ({abs(w1.arm)} m od osi) i {w2.m} kg ({abs(w2.arm)} m). Ułóż oba zielone po prawej.',
      hint: 'Przeciągnij zielone ciężarki po prawej stronie.',
      solved: 'Równowaga: po każdej stronie {mL} kg·m.',
      vars: [
        draw('a1', 3, 1, 6), draw('d1', 3, 2, 4, 0.5), draw('a2', 2, 1, 6), draw('d2', 1.5, 0.5, 2, 0.5),
        draw('c3', 4, 2, 6), draw('c4', 2, 1, 4), draw('s4', 1, 0.5, 3.5, 0.5)
      ],
      lets: [{ name: 'mL', value: 'a1*d1 + a2*d2' }, { name: 's3', value: '(mL - c4*s4)/c3' }],
      require: ['d1 - d2 >= 0.5', 'c3 != c4', 'mL >= 6 && mL <= 24', 'onstep(s3, 0.25)', 's3 >= 0.5 && s3 <= 4', 'abs(s3 - s4) >= 0.5', 'abs(c3 + 2*c4 - mL) >= 2'],
      solve: 'w3.pos = 4 + s3; w4.pos = 4 + s4',
      things: [
        beam('b1', { length: 8, pivot: 4 }),
        weight('w1', 'b1', { m: '=a1', pos: '=4 - d1' }), weight('w2', 'b1', { m: '=a2', pos: '=4 - d2' }),
        weight('w3', 'b1', { m: '=c3', pos: 5 }, ['m', 'drop']), weight('w4', 'b1', { m: '=c4', pos: 6 }, ['m', 'drop'])
      ],
      explain: 'wiele'
    },
    {
      key: 'p4', title: 'Poziom 4 · Belka na belce',
      body: ['Dolna belka wisi na górnej. Na górną działa cała jej masa — razem z tym, co na niej wisi.', 'Najpierw zrównoważ dolną (masa zielonego ciężarka), potem przesuń ją po górnej.'],
      prompt: 'Zrównoważ obie belki: najpierw dolną (masa zielonego ciężarka), potem jej miejsce na górnej.',
      say: 'Przewiduj: najpierw dolna belka (masa zielonego ciężarka), potem jej miejsce na górnej — działa tam cała jej masa.',
      hint: 'Zmień masę zielonego ciężarka, potem przeciągnij dolną belkę po górnej.',
      solved: 'Dolna: {w2.m} kg = {w3.m} kg. Górna: {w1.m} kg × {abs(w1.arm)} m = {w2.m + w3.m} kg × {b2.arm} m.',
      vars: [draw('a', 6, 2, 8), draw('d', 2, 1, 3, 0.5), draw('c', 2, 1, 6), draw('c0', 5, 1, 9), draw('s0', 1.5, 0.5, 2.5, 0.5)],
      lets: [{ name: 's', value: 'a*d/(2*c)' }],
      require: ['onstep(s, 0.25)', 's >= 0.75 && s <= 3', 'abs(s - s0) >= 0.75', 'abs(c0 - c) >= 2'],
      solve: 'w3.m = c; b2.pos = 3 + s',
      things: [
        beam('b1', { length: 6, pivot: 3 }),
        weight('w1', 'b1', { m: '=a', pos: '=3 - d' }),
        beam('b2', { parent: 'b1', length: 3, pivot: 1.5, pos: '=3 + s0', drop: 1.4 }, ['length', 'pivot', 'bm', 'drop']),
        weight('w2', 'b2', { m: '=c', pos: 0 }),
        weight('w3', 'b2', { m: '=c0', pos: 3 }, ['pos', 'drop'])
      ],
      explain: 'belka'
    },
    {
      key: 'p5', title: 'Poziom 5 · Mobil',
      body: ['Trzy piętra jak w mobilu nad łóżeczkiem. Zacznij od najniższej belki i idź w górę.', 'Każda belka niesie wszystko, co pod nią wisi.'],
      prompt: 'Mobil na trzy piętra: przesuń zawieszenia dolnych belek tak, żeby wszystkie wisiały poziomo.',
      say: 'Przewiduj: zacznij od najniższej belki i idź w górę — każda belka niesie wszystko, co pod nią wisi.',
      hint: 'Przeciągaj dolne belki wzdłuż belki, na której wiszą.',
      solved: 'Mobil wisi! Środkowa: {w3.m} kg × 1 m = {w4.m + w5.m} kg × {b3.arm} m; górna: {mb} kg × {b2.arm} m.',
      vars: [draw('a1', 3, 1, 5), draw('a2', 3, 1, 5), draw('c', 4, 2, 8), draw('e', 1, 1, 3)],
      lets: [{ name: 'tb', value: 'c/(2*e)' }, { name: 'mb', value: 'c + 2*e' }, { name: 's', value: '(3*a1 + 1.5*a2)/mb' }],
      require: ['onstep(tb, 0.25)', 'tb >= 0.5 && tb <= 2', 'abs(tb - 1) >= 0.5', 'onstep(s, 0.25)', 's >= 0.75 && s <= 3', 'abs(s - 1) >= 0.75'],
      solve: 'b3.pos = 2 + tb; b2.pos = 3 + s',
      things: [
        beam('b1', { length: 6, pivot: 3 }),
        weight('w1', 'b1', { m: '=a1', pos: 0 }), weight('w2', 'b1', { m: '=a2', pos: 1.5 }),
        beam('b2', { parent: 'b1', length: 4, pivot: 2, pos: 4, drop: 1.6 }, ['length', 'pivot', 'bm', 'drop']),
        weight('w3', 'b2', { m: '=c', pos: 1 }),
        beam('b3', { parent: 'b2', length: 2, pivot: 1, pos: 3, drop: 1.2 }, ['length', 'pivot', 'bm', 'drop']),
        weight('w4', 'b3', { m: '=e', pos: 0 }), weight('w5', 'b3', { m: '=e', pos: 2 })
      ],
      explain: 'belka'
    },
    {
      key: 'p6', title: 'Poziom 6 · Tylko dwa ruchy',
      body: ['Najpierw policz, potem przesuwaj: masz najwyżej dwa ruchy. Cofnięcie (↶) oddaje ruch.', 'Zielone ciężarki można przesuwać — wystarczy dobrze wybrać jeden.'],
      prompt: 'Zrównoważ belkę najwyżej dwoma ruchami.',
      say: 'Przewiduj: masz najwyżej dwa ruchy — najpierw policz momenty po obu stronach.',
      hint: 'Masz dwa ruchy — każde przesunięcie ciężarka to jeden.',
      solved: 'Wystarczył jeden ruch? Brakowało {gap} kg·m po prawej.',
      vars: [
        draw('a', 5, 3, 6), draw('d', 3, 2, 3.5, 0.5), draw('fa', 1, 1, 2), draw('fd', 1, 0.5, 1.5, 0.5),
        draw('b2', 2, 1, 3), draw('b3', 3, 2, 4), draw('r2', 2, 1, 2.5, 0.5), draw('r3', 3, 2.5, 3.5, 0.5)
      ],
      lets: [{ name: 'gap', value: 'a*d + fa*fd - b2*r2 - b3*r3' }, { name: 's2', value: 'r2 + gap/b2' }],
      require: ['d - fd >= 0.5', 'r3 - r2 >= 0.5', 'b2 != b3', 'gap >= 1', 'onstep(s2, 0.25)', 's2 <= 4', 'abs(s2 - r3) >= 0.5'],
      solve: 'w2.pos = 4 + s2',
      things: [
        beam('b1', { length: 8, pivot: 4 }),
        weight('w1', 'b1', { m: '=a', pos: '=4 - d' }),
        weight('w2', 'b1', { m: '=b2', pos: '=4 + r2' }, ['m', 'drop']), weight('w3', 'b1', { m: '=b3', pos: '=4 + r3' }, ['m', 'drop']),
        weight('w4', 'b1', { m: '=fa', pos: '=4 - fd' }, ['m', 'drop'])
      ],
      keep: [{ when: 'edits <= 2', say: 'Tylko dwa ruchy! Cofnij (↶), żeby spróbować inaczej.' }],
      controls: [{ type: 'readout', label: 'Ruchy', value: "edits + ' z 2'" }],
      explain: 'wiele'
    },
    {
      key: 'p7', title: 'Dla zaawansowanych · Belka też waży',
      body: ['Ta belka coś waży, a jej oś nie jest w środku. Ciężar belki działa w jej środku.', 'Gdzie powiesić zielony ciężarek?'],
      prompt: 'Belka waży kilka kilogramów, a oś nie jest w środku. Gdzie powiesić zielony ciężarek?',
      say: 'Przewiduj: belka waży {b1.bm} kg, a jej środek jest {3 - b1.pivot} m na prawo od osi. Gdzie powiesić {w1.m} kg?',
      hint: 'Przeciągnij zielony ciężarek. Pamiętaj o ciężarze samej belki.',
      solved: 'Belka: {b1.bm} kg × {3 - b1.pivot} m po prawej; ciężarek: {w1.m} kg × {abs(w1.arm)} m po lewej.',
      vars: [draw('P', 2, 1, 2.5, 0.5), draw('B', 4, 2, 8), draw('mw', 2, 1, 6)],
      lets: [{ name: 'arm7', value: 'B*(3 - P)/mw' }],
      require: ['B != mw', 'onstep(arm7, 0.25)', 'arm7 >= 0.5 && arm7 <= P'],
      solve: 'w1.pos = P - arm7',
      things: [beam('b1', { length: 6, pivot: '=P', bm: '=B' }), weight('w1', 'b1', { m: '=mw', pos: '=P + 1.5' }, ['m', 'drop'])],
      explain: 'masa'
    },
    {
      key: 'p8', title: 'Dla zaawansowanych · Przesuń oś',
      body: ['Ciężarków nie ruszysz. Przesuń oś obrotu belki — zieloną.', 'Oś musi być bliżej cięższego ciężarka.'],
      prompt: 'Ciężarki wiszą na obu końcach belki (6 m). Gdzie musi być oś?',
      say: 'Przewiduj: {w1.m} kg wisi na lewym końcu, {w2.m} kg na prawym (belka ma 6 m). Gdzie musi być oś?',
      hint: 'Przeciągnij belkę albo zmień „Oś obrotu”.',
      solved: 'Oś {b1.pivot} m od lewego końca: {w1.m} kg × {b1.pivot} m = {w2.m} kg × {6 - b1.pivot} m.',
      vars: [draw('a', 6, 2, 12), draw('b', 3, 1, 12)],
      lets: [{ name: 'P8', value: '6*b/(a + b)' }],
      require: ['a != b', 'onstep(P8, 0.25)', 'abs(P8 - 3) >= 0.75'],
      solve: 'b1.pivot = P8',
      things: [beam('b1', { length: 6, pivot: 3 }, ['length', 'bm', 'sx']), weight('w1', 'b1', { m: '=a', pos: 0 }), weight('w2', 'b1', { m: '=b', pos: 6 })],
      explain: 'os'
    }
  ];

  const levelDrawing = (level, inShow) => m.balanceDrawing({
    alt: `${level.title} — waga do zrównoważenia`,
    things: level.things,
    allow: puzzle,
    keep: level.keep,
    hint: level.hint,
    solved: level.solved,
    vars: level.vars,
    lets: level.lets,
    /* Jedes Mal andere Zahlen, gleich schwer: die Bedingungen der Stufe, ihre Lösung als Rechnung. */
    task: { require: level.require, solve: level.solve, new: 'Nowe zadanie' },
    /* Erst vermuten: die Belken sind festgehalten, bis man „Sprawdź" drückt — dann sieht man, was geschieht. */
    predict: { say: level.say },
    controls: [...(level.controls ?? []), ...(inShow ? [next] : [])]
  });

  /*
   * -- Jede Stufe prüfen — viele Züge je Familie: übersetzt, gezogen (nicht die
   * Fassung des Dokuments, wenn kein Zug passt), am Anfang nicht gelöst, und
   * ihre Lösung — durch die Regeln der Welt nachgespielt, wie in Cogita —
   * erreicht das Ziel. Dazu: die Fassung des Dokuments ist selbst eine gültige
   * Aufgabe, und die Familie ist bunt genug.
   */
  const DRAWS = 40;
  const solveWith = (live, fixed, sol) => {
    const start = new m.Program(live, { fixed }).worldSnapshot();
    const shot = { things: start.things.map((t) => ({ ...t, props: { ...t.props, ...Object.fromEntries(Object.entries(sol).filter(([k]) => k.startsWith(`${t.id}.`)).map(([k, v]) => [k.slice(t.id.length + 1), v])) } })) };
    return new m.Program(live, { fixed, replay: shot });
  };
  for (const level of LEVELS) {
    const d = m.drawingOf(levelDrawing(level, true));
    assert.deepEqual(m.problemsOf(d), [], `${level.key}: compiles`);
    const plain = Object.fromEntries(level.vars.map((v) => [v.name, v.value]));
    const seen = new Set();
    for (const [n, fixed] of [[-1, plain], ...Array.from({ length: DRAWS }, (_, i) => [i, null])]) {
      const p = new m.Program(d.live, fixed === null ? { random: m.seeded(`${level.key}:${n}`) } : { fixed });
      const held = p.drawn();
      const label = `${level.key}${n < 0 ? ' (the document)' : ` draw ${n}`} ${JSON.stringify(held)}`;
      if (n >= 0) seen.add(JSON.stringify(held));
      assert.equal(new m.Program(d.live, { fixed: held }).runToEnd(), false, `${label}: not solved at the start`);
      const sol = p.solution();
      assert.equal(Object.keys(sol).length, level.solve.split(';').length, `${label}: the solution computes`);
      const q = solveWith(d.live, held, sol);
      for (const [key, value] of Object.entries(sol)) {
        const [id, prop] = key.split('.');
        assert.ok(Math.abs(q.world.get(id).env[prop] - value) < 1e-9, `${label}: the solution ${key} = ${value} is reachable (got ${q.world.get(id).env[prop]})`);
      }
      assert.equal(q.broken(), null, `${label}: the solution keeps the rules of the world`);
      assert.equal(q.runToEnd(), true, `${label}: the solution balances everything`);
    }
    assert.ok(seen.size >= Math.min(12, DRAWS / 3), `${level.key}: the family is varied (${seen.size} different tasks in ${DRAWS} draws)`);
    level.variety = seen.size;
  }
  for (const key of ['waga', 'przekladnia']) assert.deepEqual(m.problemsOf(m.drawingOf((key === 'waga' ? m.BALANCE : m.GEARS).drawing)), [], `${key}: compiles`);

  /* -- Die Präsentation ---------------------------------------------------------------------------------- */

  /** Ein Text auf der Bühne: links (breit) oder oben (hochkant). */
  const text = (id, scene, title, body, { y = 30, tallY = 4, type = 'heading', w = 34 } = {}) => ({
    id,
    kind: 'text',
    size: { colSpan: 3, rowSpan: 3 },
    show: {
      places: { [scene]: { x: 22, y, w, max: 30, tall: { x: 47, y: tallY, w: 88 } } },
      skin: 'plain', type, origin: 'top', arrive: 'rise', delay: 0.1, span: 0.6
    },
    config: { title, body }
  });

  /** Ein Bild zum Anfassen: rechts (breit) oder darunter (hochkant). */
  const drawing = (id, scene, config, { y = 8, tallY = 34, w = 56, max = 46 } = {}) => ({
    id,
    kind: 'animation',
    size: { colSpan: 4, rowSpan: 5 },
    show: {
      places: { [scene]: { x: 68, y, w, max, tall: { x: 47, y: tallY, w: 88 } } },
      skin: 'card', origin: 'top', arrive: 'fade', delay: 0.15, span: 0.5
    },
    /* Die Werkstatt neben das Bild (auf dem Telefon darunter): so bleibt das gewählte Ding auf einem Schirm. */
    config: { ...config, max, panel: 'side' }
  });

  const demo = m.balanceDrawing({
    alt: 'Huśtawka z dwoma ciężarkami — przeciągnij je i zmieniaj masy',
    things: [beam('b1', { length: 6, pivot: 3 }), weight('w1', 'b1', { m: 3, pos: 1 }, ['drop']), weight('w2', 'b1', { m: 3, pos: 4 }, ['drop'])],
    allow: puzzle,
    hint: 'Przeciągnij ciężarek albo dotknij go i zmień masę.',
    solved: 'Równowaga: masa × ramię po obu stronach jest taka sama.'
  });

  /* Die Szene geht dem betonten Text nicht nach (follow 0): das Bild bleibt, wo die Hand es sucht. */
  const still = { follow: { wide: 0, tall: 0 } };
  const scenes = [
    { key: 'start', label: 'Start', change: 'fade', hint: 'Przewiń', ...still },
    ...LEVELS.map((l, i) => ({ key: l.key, label: i < 6 ? `Poziom ${i + 1}` : `Ekspert ${i - 5}`, change: 'rise', ...still })),
    { key: 'warsztat', label: 'Warsztat', change: 'rise', ...still },
    { key: 'zebatki', label: 'Zębatki', change: 'rise', ...still },
    { key: 'nauka', label: 'Nauka', change: 'fade', next: 'link:nauka' }
  ];

  const modules = [
    text('start-tytul', 'start', 'Laboratorium równowagi', [
      'Belka obraca się wokół osi. Ciężarek ciągnie ją w dół tym mocniej, im dalej od osi wisi: liczy się masa × ramię — moment siły.',
      'Gdy po obu stronach osi momenty są równe, belka stoi poziomo. Przeciągnij ciężarki i zobacz.',
      'Na kolejnych poziomach najpierw przewidujesz: belki są przytrzymane, dopóki nie klikniesz „Sprawdź”.'
    ], { type: 'display', y: 26, tallY: 4 }),
    drawing('start-waga', 'start', demo),
    ...LEVELS.flatMap((l) => [text(`${l.key}-tekst`, l.key, l.title, l.body), drawing(`${l.key}-waga`, l.key, levelDrawing(l, true))]),
    text('warsztat-tekst', 'warsztat', 'Warsztat', [
      'Wszystko wolno: dowieszaj belki i ciężarki, zmieniaj długości, osie, masy i linki. Zbuduj mobil i zrównoważ go.',
      'Zapisz układ, żeby wrócić do niego później. Cofnij: Ctrl+Z albo ↶.'
    ]),
    drawing('warsztat-waga', 'warsztat', m.BALANCE.drawing),
    text('zebatki-tekst', 'zebatki', 'Ten sam silnik, inny świat', [
      'Koła zębate to te same „rzeczy” co belki — tylko inaczej opisane. Każde koło zazębia się z poprzednim: mniejsze kręci się szybciej i w drugą stronę.',
      'Dotknij koła: zmień liczbę zębów albo dowieś następne.'
    ]),
    drawing('zebatki-kola', 'zebatki', m.GEARS.drawing),
    text('nauka-tekst', 'nauka', 'Sprawdź się w Nauce', [
      'Te same poziomy są pytaniami w bazie wiedzy Cogita: w Nauce → JSON zaimportuj plik balance-lab-cogita.json.',
      'Odpowiedzią jest ułożona waga — sprawdzana symulacją i liczona do powtórek, kursów i postępów.',
      '[Przejdź do Nauki](#/workspace/learn)'
    ], { type: 'heading', y: 30, tallY: 20, w: 50 })
  ];
  /* Der letzte Text steht in der Mitte. */
  modules[modules.length - 1].show.places.nauka.x = 50;

  const page = {
    format: 'recreatio/page',
    version: 1,
    path: 'rownowaga',
    title: 'Laboratorium równowagi',
    lead: null,
    mode: 'presentation',
    theme: {
      mode: 'light', accent: '#2f6f5e', ink: '#14231f', ground: '#f5f7f4', muted: '#5d6b66',
      night: { accent: '#7fd1b5', ink: '#e7efec', ground: '#0e1916', muted: '#8ea39b' }
    },
    cover: [],
    show: {
      format: 'screen',
      fonts: 'plex',
      nav: 'dots',
      scenes,
      links: [{ id: 'nauka', label: 'Nauka (Cogita)', href: '#/workspace/learn' }]
    },
    modules
  };

  /* -- Der Kurs für Cogita --------------------------------------------------------------------------------- */

  const KNOWLEDGE = [
    { ref: '@k-moment', text: 'Moment siły ciężaru względem osi to masa × ramię (odległość od osi): 4 kg wiszące 1 m od osi dają 4 kg·m.' },
    { ref: '@k-rownowaga', text: 'Belka jest w równowadze, gdy suma momentów po lewej stronie osi równa się sumie momentów po prawej.' },
    { ref: '@k-wiele', text: 'Moment jednej strony belki to suma momentów wszystkich ciężarków po tej stronie.' },
    { ref: '@k-belka', text: 'Belka zawieszona na innej belce działa na nią całą swoją masą — razem ze wszystkim, co na niej wisi — w punkcie zawieszenia.' },
    { ref: '@k-masa', text: 'Ciężar samej belki działa w jej środku: gdy oś nie jest w środku, belka ma własny moment (masa belki × odległość środka od osi).' },
    { ref: '@k-os', text: 'Przesunięcie osi bliżej cięższej strony skraca jej ramię i wydłuża ramię lżejszej — tak waży się różne masy jedną belką.' }
  ];
  const explainOf = { moment: '@k-moment', rownowaga: '@k-rownowaga', wiele: '@k-wiele', belka: '@k-belka', masa: '@k-masa', os: '@k-os' };
  const course = {
    format: 'recreatio.cogita.course',
    version: 1,
    name: 'Laboratorium równowagi',
    entities: [
      { ref: '@rownowaga', kinds: ['topic'], data: { name: 'Równowaga dźwigni' } },
      ...KNOWLEDGE.map((k) => ({ ref: k.ref, kinds: ['knowledge'], data: { text: k.text, about: ['@rownowaga'] } })),
      ...LEVELS.map((l) => ({
        ref: `@q-${l.key}`,
        kinds: ['question'],
        data: {
          form: 'interactive',
          prompt: l.prompt,
          /* Das Bild als JSON-Text: so steht es in der Frage (und ein „@…" darin bleibt, was es ist). Die Lösung ist die des Bildes (`task.solve`), mit den Zahlen jedes Versuchs. */
          drawing: JSON.stringify(levelDrawing(l, false)),
          explain: [explainOf[l.explain]],
          about: ['@rownowaga']
        }
      }))
    ],
    revisions: [{
      ref: '@r-poziomy',
      name: 'Waga — wszystkie poziomy po kolei',
      graph: {
        nodes: [
          { id: 'zrodlo', type: 'source.list', x: 0, y: 0, config: { ids: LEVELS.map((l) => `@q-${l.key}`) } },
          { id: 'sposob', type: 'strategy', x: 280, y: 0, config: { mode: 'once', order: 'given' } }
        ],
        edges: [{ id: 'e1', from: 'zrodlo', out: 'cards', to: 'sposob', in: 'cards' }]
      }
    }],
    flows: [{
      ref: '@f-lab',
      name: 'Laboratorium równowagi — od momentu do mobilu',
      look: 'slides',
      start: 'n1',
      graph: {
        nodes: [
          { id: 'n1', type: 'show', x: 0, y: 0, config: { of: '@k-moment', title: 'Moment siły' } },
          { id: 'n2', type: 'question', x: 240, y: 0, config: { of: '@q-p1' } },
          { id: 'n2h', type: 'show', x: 240, y: 160, config: { of: '@k-rownowaga', title: 'Podpowiedź' } },
          { id: 'n3', type: 'show', x: 480, y: 0, config: { of: '@k-wiele', title: 'Kilka ciężarków' } },
          { id: 'n4', type: 'question', x: 720, y: 0, config: { of: '@q-p3' } },
          { id: 'n4h', type: 'show', x: 720, y: 160, config: { of: '@k-wiele', title: 'Podpowiedź' } },
          { id: 'n5', type: 'show', x: 960, y: 0, config: { of: '@k-belka', title: 'Belka na belce' } },
          { id: 'n6', type: 'question', x: 1200, y: 0, config: { of: '@q-p4' } },
          { id: 'n7', type: 'question', x: 1440, y: 0, config: { of: '@q-p5' } },
          { id: 'n7h', type: 'show', x: 1320, y: 160, config: { of: '@k-belka', title: 'Podpowiedź' } },
          { id: 'n8', type: 'end', x: 1680, y: 0, config: {} }
        ],
        edges: [
          { id: 'e1', from: 'n1', out: 'next', to: 'n2', in: 'in' },
          { id: 'e2', from: 'n2', out: 'right', to: 'n3', in: 'in' },
          { id: 'e3', from: 'n2', out: 'wrong', to: 'n2h', in: 'in' },
          { id: 'e4', from: 'n2h', out: 'next', to: 'n2', in: 'in' },
          { id: 'e5', from: 'n3', out: 'next', to: 'n4', in: 'in' },
          { id: 'e6', from: 'n4', out: 'right', to: 'n5', in: 'in' },
          { id: 'e7', from: 'n4', out: 'wrong', to: 'n4h', in: 'in' },
          { id: 'e8', from: 'n4h', out: 'next', to: 'n4', in: 'in' },
          { id: 'e9', from: 'n5', out: 'next', to: 'n6', in: 'in' },
          { id: 'e10', from: 'n6', out: 'right', to: 'n7', in: 'in' },
          { id: 'e11', from: 'n6', out: 'wrong', to: 'n7h', in: 'in' },
          { id: 'e12', from: 'n7h', out: 'next', to: 'n6', in: 'in' },
          { id: 'e13', from: 'n7', out: 'right', to: 'n8', in: 'in' },
          { id: 'e14', from: 'n7', out: 'wrong', to: 'n5', in: 'in' }
        ]
      }
    }]
  };

  const pageOut = join(process.cwd(), 'scripts/fixtures/balance-lab.json');
  const courseOut = join(process.cwd(), 'scripts/fixtures/balance-lab-cogita.json');
  await writeFile(pageOut, `${JSON.stringify(page, null, 1)}\n`, 'utf8');
  await writeFile(courseOut, `${JSON.stringify(course, null, 1)}\n`, 'utf8');
  const sizes = modules.filter((x) => x.kind === 'animation').map((x) => JSON.stringify(x.config).length);
  console.log(`checked ${LEVELS.length} level families × ${DRAWS + 1} tasks: compile, unsolved at the start, solved by their solution (${LEVELS.map((l) => `${l.key}: ${l.variety} different`).join(', ')})`);
  console.log(`written ${pageOut}: ${scenes.length} scenes, ${modules.length} modules; drawings up to ${Math.max(...sizes)} chars`);
  console.log(`written ${courseOut}: ${course.entities.length} entries (${LEVELS.length} questions), 1 revision, 1 flow`);
} finally {
  await rm(workspace, { recursive: true, force: true });
}
