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
 * Bevor geschrieben wird, prüft das Skript jede Stufe: sie übersetzt ohne
 * Fehler, steht am Anfang NICHT im Gleichgewicht, und ihre Lösung — durch die
 * Regeln der Welt nachgespielt, wie in Cogita — erreicht das Ziel.
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

  /**
   * DIE STUFEN — Dinge, Sperren, Hinweis, und die Lösung als Zuweisungen
   * (`ding.eigenschaft = Wert`), so wie sie auch in Cogita steht.
   */
  const LEVELS = [
    {
      key: 'p1', title: 'Poziom 1 · Prosta równowaga',
      body: ['Po lewej wisi 4 kg, metr od osi. Gdzie powiesić 2 kg, żeby belka stanęła poziomo?', 'Przeciągnij mały ciężarek wzdłuż belki. Zielona belka — równowaga.'],
      prompt: 'Po lewej wisi 4 kg, metr od osi. Przesuń ciężarek 2 kg tak, żeby belka stanęła poziomo.',
      hint: 'Przeciągnij ciężarek 2 kg wzdłuż belki.',
      solved: 'Brawo! 4 kg × 1 m = 2 kg × 2 m — dwa razy lżejszy, dwa razy dalej.',
      things: [beam('b1', { length: 6, pivot: 3 }), weight('w1', 'b1', { m: 4, pos: 2 }), weight('w2', 'b1', { m: 2, pos: 3.5 }, ['m', 'drop'])],
      solution: 'w2.pos = 5', explain: 'moment'
    },
    {
      key: 'p2', title: 'Poziom 2 · Inna masa',
      body: ['Ciężarki są przykręcone — zmienić można tylko masę prawego. Dotknij go i ustaw masę.', 'Lewa strona: 6 kg × 2 m = 12 kg·m.'],
      prompt: 'Ciężarków nie da się przesunąć. Ustaw masę prawego ciężarka tak, żeby belka była w równowadze.',
      hint: 'Dotknij prawego ciężarka i zmień jego masę (−, +, suwak albo liczba).',
      solved: 'Tak: 4 kg × 3 m = 6 kg × 2 m.',
      things: [beam('b1', { length: 6, pivot: 3 }), weight('w1', 'b1', { m: 6, pos: 1 }), weight('w2', 'b1', { m: 2, pos: 6 }, ['pos', 'drop'])],
      solution: 'w2.m = 4', explain: 'rownowaga'
    },
    {
      key: 'p3', title: 'Poziom 3 · Kilka ciężarków',
      body: ['Po lewej dwa ciężarki, po prawej dwa do przesunięcia. Wystarczy, że sumy momentów są równe — sposobów jest kilka.', '> Moment strony = suma momentów jej ciężarków.'],
      prompt: 'Po lewej: 3 kg na 3 m i 2 kg na 1,5 m od osi. Ułóż dwa ciężarki po prawej tak, żeby belka była w równowadze.',
      hint: 'Przeciągnij ciężarki 4 kg i 2 kg po prawej stronie.',
      solved: 'Równowaga: 9 + 3 = 12 kg·m po każdej stronie.',
      things: [
        beam('b1', { length: 8, pivot: 4 }),
        weight('w1', 'b1', { m: 3, pos: 1 }), weight('w2', 'b1', { m: 2, pos: 2.5 }),
        weight('w3', 'b1', { m: 4, pos: 5 }, ['m', 'drop']), weight('w4', 'b1', { m: 2, pos: 6 }, ['m', 'drop'])
      ],
      solution: 'w3.pos = 6.5; w4.pos = 5', explain: 'wiele'
    },
    {
      key: 'p4', title: 'Poziom 4 · Belka na belce',
      body: ['Dolna belka wisi na górnej. Na górną działa cała jej masa — razem z tym, co na niej wisi.', 'Najpierw zrównoważ dolną (masa ciężarka), potem przesuń ją po górnej.'],
      prompt: 'Zrównoważ obie belki: najpierw dolną (masa ciężarka), potem jej miejsce na górnej.',
      hint: 'Dotknij prawego ciężarka na dolnej belce, potem przeciągnij dolną belkę po górnej.',
      solved: 'Dolna: 2 kg × 1,5 m = 2 kg × 1,5 m. Górna: 4 kg × 3 m = 6 kg × 2 m.',
      things: [
        beam('b1', { length: 6, pivot: 3 }),
        weight('w1', 'b1', { m: 6, pos: 1 }),
        beam('b2', { parent: 'b1', length: 3, pivot: 1.5, pos: 4.5, drop: 1 }, ['length', 'pivot', 'bm', 'drop']),
        weight('w2', 'b2', { m: 2, pos: 0 }),
        weight('w3', 'b2', { m: 5, pos: 3 }, ['pos', 'drop'])
      ],
      solution: 'w3.m = 2; b2.pos = 6', explain: 'belka'
    },
    {
      key: 'p5', title: 'Poziom 5 · Mobil',
      body: ['Trzy piętra jak w mobilu nad łóżeczkiem. Zacznij od najniższej belki i idź w górę.', 'Każda belka niesie wszystko, co pod nią wisi.'],
      prompt: 'Mobil na trzy piętra: przesuń zawieszenia dolnych belek tak, żeby wszystkie wisiały poziomo.',
      hint: 'Przeciągaj belki (ich oś) wzdłuż belki, na której wiszą.',
      solved: 'Mobil wisi! Najniższa belka: 2 kg; środkowa: 4 kg × 1 m = 2 kg × 2 m; górna: 6 kg × 2,25 m = 13,5 kg·m.',
      things: [
        beam('b1', { length: 6, pivot: 3 }),
        weight('w1', 'b1', { m: 3, pos: 0 }), weight('w2', 'b1', { m: 3, pos: 1.5 }),
        beam('b2', { parent: 'b1', length: 4, pivot: 2, pos: 4, drop: 1 }, ['length', 'pivot', 'bm', 'drop']),
        weight('w3', 'b2', { m: 4, pos: 1 }),
        beam('b3', { parent: 'b2', length: 2, pivot: 1, pos: 3, drop: 0.8 }, ['length', 'pivot', 'bm', 'drop']),
        weight('w4', 'b3', { m: 1, pos: 0 }), weight('w5', 'b3', { m: 1, pos: 2 })
      ],
      solution: 'b3.pos = 4; b2.pos = 5.25', explain: 'belka'
    },
    {
      key: 'p6', title: 'Poziom 6 · Tylko dwa ruchy',
      body: ['Najpierw policz, potem przesuwaj: masz najwyżej dwa ruchy. Cofnięcie (↶) oddaje ruch.', 'Lewa strona: 5 kg × 3 m + 1 kg × 1 m. Prawa: 2 kg × 2 m + 3 kg × 3 m.'],
      prompt: 'Zrównoważ belkę najwyżej dwoma ruchami.',
      hint: 'Masz dwa ruchy — każde przesunięcie ciężarka to jeden.',
      solved: 'Wystarczył jeden ruch? Brakowało 3 kg·m po prawej.',
      things: [
        beam('b1', { length: 8, pivot: 4 }),
        weight('w1', 'b1', { m: 5, pos: 1 }),
        weight('w2', 'b1', { m: 2, pos: 6 }, ['m', 'drop']), weight('w3', 'b1', { m: 3, pos: 7 }, ['m', 'drop']),
        weight('w4', 'b1', { m: 1, pos: 3 }, ['m', 'drop'])
      ],
      keep: [{ when: 'edits <= 2', say: 'Tylko dwa ruchy! Cofnij (↶), żeby spróbować inaczej.' }],
      controls: [{ type: 'readout', label: 'Ruchy', value: "edits + ' z 2'" }],
      solution: 'w2.pos = 7.5', explain: 'wiele'
    },
    {
      key: 'p7', title: 'Dla zaawansowanych · Belka też waży',
      body: ['Ta belka waży 4 kg, a jej oś nie jest w środku. Ciężar belki działa w jej środku — 1 m na prawo od osi.', 'Gdzie powiesić 2 kg?'],
      prompt: 'Belka waży 4 kg, a oś jest 2 m od lewego końca (belka ma 6 m). Gdzie powiesić ciężarek 2 kg?',
      hint: 'Przeciągnij ciężarek. Pamiętaj o ciężarze samej belki.',
      solved: 'Belka: 4 kg × 1 m po prawej; ciężarek: 2 kg × 2 m po lewej.',
      things: [beam('b1', { length: 6, pivot: 2, bm: 4 }), weight('w1', 'b1', { m: 2, pos: 4 }, ['m', 'drop'])],
      solution: 'w1.pos = 0', explain: 'masa'
    },
    {
      key: 'p8', title: 'Dla zaawansowanych · Przesuń oś',
      body: ['Ciężarków nie ruszysz. Dotknij belki i przesuń jej oś obrotu.', '6 kg na lewym końcu, 3 kg na prawym — oś musi być bliżej cięższego.'],
      prompt: '6 kg wisi na lewym końcu belki, 3 kg na prawym (belka ma 6 m). Gdzie musi być oś?',
      hint: 'Dotknij belki i zmień „Oś obrotu”.',
      solved: 'Oś 2 m od lewego końca: 6 kg × 2 m = 3 kg × 4 m.',
      things: [beam('b1', { length: 6, pivot: 3 }, ['length', 'bm', 'sx']), weight('w1', 'b1', { m: 6, pos: 0 }), weight('w2', 'b1', { m: 3, pos: 6 })],
      solution: 'b1.pivot = 2', explain: 'os'
    }
  ];

  const levelDrawing = (level, inShow) => m.balanceDrawing({
    alt: `${level.title} — waga do zrównoważenia`,
    things: level.things,
    allow: puzzle,
    keep: level.keep,
    hint: level.hint,
    solved: level.solved,
    controls: [...(level.controls ?? []), ...(inShow ? [next] : [])]
  });

  /* -- Jede Stufe prüfen: übersetzt, am Anfang nicht gelöst, mit der Lösung gelöst ------------------------- */
  const assignments = (text) => Object.fromEntries(text.split(';').map((part) => part.split('=').map((x) => x.trim())).map(([k, v]) => [k, Number(v)]));
  for (const level of LEVELS) {
    const d = m.drawingOf(levelDrawing(level, true));
    assert.deepEqual(m.problemsOf(d), [], `${level.key}: compiles`);
    assert.equal(new m.Program(d.live).runToEnd(), false, `${level.key}: not solved at the start`);
    const start = new m.Program(d.live).worldSnapshot();
    const want = assignments(level.solution);
    const shot = { things: start.things.map((t) => ({ ...t, props: { ...t.props, ...Object.fromEntries(Object.entries(want).filter(([k]) => k.startsWith(`${t.id}.`)).map(([k, v]) => [k.slice(t.id.length + 1), v])) } })) };
    const p = new m.Program(d.live, { replay: shot });
    for (const [key, value] of Object.entries(want)) {
      const [id, prop] = key.split('.');
      assert.equal(p.world.get(id).env[prop], value, `${level.key}: the solution ${key} = ${value} is allowed`);
    }
    assert.equal(p.broken(), null, `${level.key}: the solution keeps the rules of the world`);
    assert.equal(p.runToEnd(), true, `${level.key}: the solution balances everything`);
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
  const drawing = (id, scene, config, { y = 8, tallY = 24, w = 56, max = 46 } = {}) => ({
    id,
    kind: 'animation',
    size: { colSpan: 4, rowSpan: 5 },
    show: {
      places: { [scene]: { x: 68, y, w, max, tall: { x: 47, y: tallY, w: 88 } } },
      skin: 'card', origin: 'top', arrive: 'fade', delay: 0.15, span: 0.5
    },
    config: { ...config, max }
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
      'Gdy po obu stronach osi momenty są równe, belka stoi poziomo. Przeciągnij ciężarki i sprawdź.'
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
          /* Das Bild als JSON-Text: so steht es in der Frage (und ein „@…" darin bleibt, was es ist). */
          drawing: JSON.stringify(levelDrawing(l, false)),
          solution: l.solution,
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
  console.log(`checked ${LEVELS.length} levels: compile, unsolved at the start, solved by their solution`);
  console.log(`written ${pageOut}: ${scenes.length} scenes, ${modules.length} modules; drawings up to ${Math.max(...sizes)} chars`);
  console.log(`written ${courseOut}: ${course.entities.length} entries (${LEVELS.length} questions), 1 revision, 1 flow`);
} finally {
  await rm(workspace, { recursive: true, force: true });
}
