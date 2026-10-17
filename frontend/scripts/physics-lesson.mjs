/**
 * EINE LEKTION PHYSIK ZUM ANFASSEN (2026-10-17) — `fixtures/physics-lesson.json`.
 *
 * Eine Präsentation im Format jeder Seite ("recreatio/page", mode
 * "presentation"): je Szene ein Text und ein Bild zum Anfassen aus
 * `src/app/pages/motion/liveExamples.ts` — Wurf, Pendel, Feder, schiefe Ebene,
 * Stoss, Brechung, Wellen, Umlaufbahn, und zum Anfang ein springender Ball.
 * Nichts darin ist Code: lauter allgemeine Wörter (vars, let, sim, controls,
 * rules, frame, plot, trace, arrow …), importierbar über das JSON-Fach jeder
 * Präsentation. Am Ende führt „dalej" in die Nauka (Cogita), wo dieselben
 * Bilder Fragen sein können.
 *
 *   node scripts/physics-lesson.mjs      schreibt scripts/fixtures/physics-lesson.json
 */

import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'physics-lesson-'));
try {
  await build({
    entryPoints: [join(process.cwd(), 'src/app/pages/motion/liveExamples.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: join(workspace, 'examples.mjs'),
    logLevel: 'error'
  });
  const { LIVE_EXAMPLES } = await import(pathToFileURL(join(workspace, 'examples.mjs')).href);
  const example = (key) => {
    const one = LIVE_EXAMPLES.find((x) => x.key === key);
    if (one === undefined) throw new Error(`no example ${key}`);
    return one.drawing;
  };

  /** Ein Text auf der Bühne: links (breit) oder oben (hochkant). */
  const text = (id, scene, title, body, { step = null, y = 34, tallY = 4, type = 'heading', w = 34 } = {}) => ({
    id,
    kind: 'text',
    size: { colSpan: 3, rowSpan: 3 },
    show: {
      places: { [scene]: { x: 24, y, w, max: 30, ...(step === null ? {} : { step }), tall: { x: 47, y: tallY, w: 88 } } },
      skin: 'plain', type, origin: 'top', arrive: 'rise', delay: 0.1, span: 0.6
    },
    config: { title, body }
  });

  /** Ein Bild zum Anfassen: rechts (breit) oder darunter (hochkant). */
  /* Hochkant 88 % breit, etwas links der Mitte: rechts stehen die Punkte der Szenen. */
  const drawing = (id, scene, key, { y = 10, tallY = 20, w = 52, max = 44 } = {}) => ({
    id,
    kind: 'animation',
    size: { colSpan: 4, rowSpan: 5 },
    show: {
      places: { [scene]: { x: 69, y, w, max, tall: { x: 47, y: tallY, w: 88 } } },
      skin: 'card', origin: 'top', arrive: 'fade', delay: 0.15, span: 0.5
    },
    config: { ...example(key), max }
  });

  /* Die Szene geht dem betonten Text nicht nach (follow 0): das Bild bleibt, wo die Hand es sucht. */
  const still = { follow: { wide: 0, tall: 0 } };
  const scenes = [
    { key: 'start', label: 'Start', change: 'fade', hint: 'Przewiń' },
    { key: 'rzut', label: 'Rzut', steps: 2, change: 'rise', ...still },
    { key: 'wahadlo', label: 'Wahadło', change: 'rise', ...still },
    { key: 'sprezyna', label: 'Sprężyna', change: 'rise', ...still },
    { key: 'rownia', label: 'Równia', change: 'rise', ...still },
    { key: 'zderzenie', label: 'Zderzenie', change: 'rise', ...still },
    { key: 'zalamanie', label: 'Światło', change: 'rise', ...still },
    { key: 'fale', label: 'Fale', steps: 2, change: 'rise', ...still },
    { key: 'orbita', label: 'Orbita', change: 'rise', ...still },
    { key: 'dalej', label: 'Dalej', change: 'fade', next: 'link:nauka' }
  ];

  const modules = [
    text('start-tytul', 'start', 'Fizyka, którą możesz dotknąć', [
      'Każdy rysunek tutaj liczy prawdziwe równania ruchu — na Twoim telefonie, bez wideo.',
      'Przeciągaj, przesuwaj suwaki, puszczaj. Najpierw zobacz, potem nazwij.'
    ], { type: 'display', y: 30, tallY: 6 }),
    drawing('start-pilka', 'start', 'pilka', { y: 22, tallY: 40 }),

    text('rzut-1', 'rzut', 'Rzut ukośny', [
      'Ustaw kąt i prędkość — albo przeciągnij grot strzałki. Trafisz w chorągiewkę?',
      'Cel możesz przesunąć palcem.'
    ], { step: 0, y: 26 }),
    text('rzut-2', 'rzut', 'Dlaczego 45°?', [
      'Zasięg = v² · sin 2α / g. Sinus jest największy dla 2α = 90°, więc najdalej leci się pod kątem 45°.',
      '> Kąty 30° i 60° dają ten sam zasięg — sprawdź.'
    ], { step: 1, y: 58, tallY: 72 }),
    drawing('rzut-rysunek', 'rzut', 'rzut'),

    text('wahadlo-tekst', 'wahadlo', 'Wahadło', [
      'Odciągnij ciężarek i puść. Zmień długość, potem planetę.',
      'Okres T = 2π√(L/g) nie zależy od tego, jak mocno wychylisz (dla małych kątów) — ani od masy.'
    ]),
    drawing('wahadlo-rysunek', 'wahadlo', 'wahadlo'),

    text('sprezyna-tekst', 'sprezyna', 'Drgania na sprężynie', [
      'Odciągnij klocek. Sztywniejsza sprężyna — szybsze drgania; większa masa — wolniejsze.',
      'Słupki pokazują, jak energia przelewa się między ruchem (Ek) a sprężyną (Ep). Tłumienie ją zabiera.'
    ]),
    drawing('sprezyna-rysunek', 'sprezyna', 'sprezyna'),

    text('rownia-tekst', 'rownia', 'Równia pochyła', [
      'Klocek ruszy dopiero wtedy, gdy tg α > μ. Znajdź ten kąt dla μ = 0,3.',
      'Strzałki: ciężar mg, nacisk N i tarcie T.'
    ]),
    drawing('rownia-rysunek', 'rownia', 'rownia'),

    text('zderzenie-tekst', 'zderzenie', 'Zderzenie', [
      'Pęd m·v przed zderzeniem i po nim jest ten sam — zawsze.',
      'Energia ruchu zostaje tylko przy zderzeniu sprężystym (e = 1). Zobacz, co się dzieje przy e = 0.'
    ]),
    drawing('zderzenie-rysunek', 'zderzenie', 'zderzenie'),

    text('zalamanie-tekst', 'zalamanie', 'Załamanie światła', [
      'Przeciągnij źródło po łuku. n₁ · sin α₁ = n₂ · sin α₂.',
      'Z wody do powietrza, pod dużym kątem, światło w ogóle nie wychodzi — to całkowite wewnętrzne odbicie.'
    ]),
    drawing('zalamanie-rysunek', 'zalamanie', 'zalamanie'),

    text('fale-1', 'fale', 'Dwie fale', [
      'Dwie fale biegną obok siebie. Zmień długość drugiej i przesunięcie fazy.'
    ], { step: 0, y: 28 }),
    text('fale-2', 'fale', 'Ich suma', [
      'Gdzie grzbiety się spotykają, fala rośnie; gdzie grzbiet trafia na dolinę — znika. Podobne długości dają dudnienia.'
    ], { step: 1, y: 52, tallY: 72 }),
    drawing('fale-rysunek', 'fale', 'fale'),

    text('orbita-tekst', 'orbita', 'Orbita', [
      'Przeciągnij grot prędkości startowej.',
      'Za wolno — spada. Dokładnie tyle, ile trzeba — koło. Szybciej — elipsa. Ponad √2 razy szybciej — ucieka na zawsze.'
    ]),
    drawing('orbita-rysunek', 'orbita', 'orbita'),

    text('dalej-tekst', 'dalej', 'Sprawdź się', [
      'Te same rysunki mogą być pytaniami w bazie wiedzy Cogita: w pytaniu wybierz „Forma odpowiedzi: Rysunek do poruszania” i wklej ich JSON.',
      'Wtedy trafienie w cel to dobra odpowiedź — liczy się do powtórek, kursów i postępów.',
      '[Przejdź do Nauki](#/workspace/learn)'
    ], { type: 'heading', y: 30, tallY: 20, w: 50 })
  ];
  /* Der letzte Text steht in der Mitte. */
  modules[modules.length - 1].show.places.dalej.x = 50;

  const page = {
    format: 'recreatio/page',
    version: 1,
    path: 'fizyka',
    title: 'Fizyka, którą możesz dotknąć',
    lead: null,
    mode: 'presentation',
    theme: {
      mode: 'light', accent: '#1f6f8b', ink: '#13212b', ground: '#f6f8f7', muted: '#5b6b74',
      night: { accent: '#7cc4dd', ink: '#e8eef1', ground: '#0f1a21', muted: '#8fa3ad' }
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

  const out = join(process.cwd(), 'scripts/fixtures/physics-lesson.json');
  await writeFile(out, `${JSON.stringify(page, null, 1)}\n`, 'utf8');
  const sizes = modules.filter((m) => m.kind === 'animation').map((m) => JSON.stringify(m.config).length);
  console.log(`written ${out}: ${scenes.length} scenes, ${modules.length} modules; drawings ${sizes.join(', ')} chars (largest ${Math.max(...sizes)})`);
} finally {
  await rm(workspace, { recursive: true, force: true });
}
