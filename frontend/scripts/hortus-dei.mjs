/**
 * HORTUS DEI — „JEST MIEJSCE NA WASZĄ HISTORIĘ" (2026-10-19): die Erzählung aus
 * dem Konzept (sieben Momente und das Praktische) als Dokument der Seite
 * ("recreatio/page", "mode": "presentation") — für recreatio.pl/hortusdei, im
 * Panel „JSON strony" → Importuj, „Zastąp moduły strony".
 *
 * Es braucht, was die Präsentation dafür bekommen hat: Klatki am Fortschritt
 * der Szene ("frames", "by", "still"), den Punkt des Ausschnitts je Platz
 * ("crop", auch hochkant), Masken ("mask"), Bilder, die mit ihrer Szene gehen
 * und am Ende wiederkommen ("between": "leave"; mit "layer" < 0 hinter den
 * Texten ihrer Szene), Knöpfe zu einem Schritt ("go": "step") und auf jeder
 * Szene ("*"), Zeichnungen, die sich mit dem Fortschritt zeichnen ("motion"
 * mit "by").
 *
 * <b>Die Fotos sind nicht darin.</b> Jedes Bild-Modul heisst nach seiner Datei
 * („Zdjęcie 1000003240.jpg — ognisko"): nach dem Import im Editor hochladen und
 * zuordnen. "at" und "crop" sind Schätzungen, die das Motiv im Bild halten
 * sollen (das Feuer bei 50 % 58 %) — am echten Foto nachstellen. Der Kontakt
 * (Adresse, Telefon, E-Mail) bleibt leer, bis die Gastgeber ihn füllen; leer
 * zeigt die Seite ihn nicht. Film und Klang der Umgebung ("video", "sound")
 * kommen hinzu, wenn es Aufnahmen gibt.
 *
 *   node scripts/hortus-dei.mjs     → scripts/fixtures/hortus-dei.json
 *
 * Geschrieben wird in der Form des Exports (einmal importiert und exportiert):
 * `app-presentation-check.mjs` importiert das Dokument ohne Warnung und bekommt
 * es unverändert zurück.
 */

import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = join(process.cwd(), 'scripts', 'fixtures', 'hortus-dei.json');

/* -- Farben der Szenen: Abend am Feuer, Tag im Garten, Wald, Papier ----------------------------- */
const EVENING = { ground: '#17110c', ink: '#f8f1e5', accent: '#f0a35e', muted: '#c9b8a1' };
const DAY = { ground: '#f4eee1', ink: '#1f2b20', accent: '#b4602a', muted: '#5d6b58' };
const FOREST = { ground: '#1c2a20', ink: '#eef2e6', accent: '#eaa461', muted: '#a9baa1' };
const PAPER = { ground: '#f3e7d0', ink: '#2a2118', accent: '#b4602a', muted: '#7c6a55' };

const ROUND = { shape: 'inset', round: 1.2 };

const scenes = [
  { key: 'ogien', label: 'Zaproszenie', steps: 2, colors: EVENING, hint: 'Przewiń' },
  { key: 'ogrod', label: 'Ogród', steps: 2, change: 'dissolve', colors: DAY },
  { key: 'rytm', label: 'Wasz rytm', steps: 4, change: 'build', colors: DAY, emphasis: false },
  { key: 'las', label: 'Między drzewami', steps: 2, change: 'cover', colors: FOREST },
  { key: 'poczatek', label: 'Początek', steps: 2, change: 'reveal', colors: PAPER },
  { key: 'dom', label: 'Nowy dom', steps: 2, colors: DAY },
  { key: 'powrot', label: 'Wasza historia', steps: 2, change: 'dissolve', colors: EVENING },
  { key: 'praktycznie', label: 'Praktycznie', colors: DAY }
];

/* -- Bausteine ------------------------------------------------------------------------------ */
const photo = (id, file, what, alt, at, show) => ({
  id, name: `Zdjęcie ${file} — ${what}`, kind: 'image', size: { colSpan: 3, rowSpan: 3 },
  show: { skin: 'plain', ...show },
  config: { url: '', alt, fit: 'cover', at }
});
const text = (id, show, config) => ({ id, kind: 'text', size: { colSpan: 3, rowSpan: 2 }, show: { skin: 'plain', ...show }, config });
const drawing = (id, alt, show, config) => ({
  id, kind: 'animation', size: { colSpan: 3, rowSpan: 3 }, show: { skin: 'plain', ...show }, config: { ...(alt === '' ? {} : { alt }), ...config }
});
const r2 = (n) => Math.round(n * 100) / 100;

/* -- 3. Każda grupa ma swój rytm: drei Bilder, jeder Schritt wählt eines ---------------------- */
/* Breit: alle in einer Reihe (y 42); das gewählte wächst, die anderen werden kleiner und leiser. */
const WIDE = {
  boisko: [[19, 27, 40, 1], [21, 33, 50, 1], [17, 22, 32, 0.7], [19, 22, 32, 0.7]],
  'ogrod-foto': [[50, 27, 40, 1], [51, 22, 32, 0.7], [50, 33, 50, 1], [49, 22, 32, 0.7]],
  domek: [[81, 27, 40, 1], [81, 22, 32, 0.7], [83, 22, 32, 0.7], [79, 33, 50, 1]]
};
/* Hoch: zuerst drei Zeilen (Bild, daneben sein Name); dann das gewählte gross oben, die zwei anderen als Zeilen unten. */
const ROW_Y = { boisko: 28, 'ogrod-foto': 48, domek: 68 };
const BIG = { x: 50, y: 31.5, w: 92, h: 29 };
const SLOT = { a: { x: 18, y: 75, w: 30, h: 11 }, b: { x: 18, y: 88.5, w: 30, h: 11 } };
const TALL = {
  boisko: ['row', 'big', 'a', 'a'],
  'ogrod-foto': ['row', 'a', 'big', 'b'],
  domek: ['row', 'b', 'b', 'big']
};
const tallPhoto = (id, state) => (state === 'row' ? { x: 24, y: ROW_Y[id], w: 42, h: 16 } : state === 'big' ? BIG : SLOT[state]);
const tallLabel = (id, state) => (state === 'row' ? { x: 70, y: ROW_Y[id], w: 52 } : state === 'big' ? { x: 50, y: 51, w: 80 } : { x: 64, y: SLOT[state].y, w: 56 });

/* Sein Schritt: der, auf dem es gewählt ist — ein Tippen darauf führt dorthin ("go": "step"). */
const OWN = { boisko: 1, 'ogrod-foto': 2, domek: 3 };
const rytmPhoto = (id) => {
  const [x, w, h] = WIDE[id][0];
  return {
    x, y: 42, w, h, step: OWN[id], mask: ROUND, tall: tallPhoto(id, 'row'),
    frames: [1, 2, 3].map((step) => {
      const [fx, fw, fh, fo] = WIDE[id][step];
      return { step, x: fx, w: fw, h: fh, opacity: fo, tall: tallPhoto(id, TALL[id][step]) };
    })
  };
};
const rytmLabel = (id, own) => ({
  x: WIDE[id][0][0], y: 72, w: 24, tall: tallLabel(id, 'row'),
  frames: [1, 2, 3].map((step) => ({
    step, x: WIDE[id][step][0], opacity: step === own ? 1 : 0.6, scale: step === own ? 1.08 : 1, tall: tallLabel(id, TALL[id][step])
  }))
});
/* Ein kleines Dopowiedzenie je Wahl: nur auf seinem Schritt zu sehen. */
const onlyAt = (step, last) => [
  ...(step > 1 ? [{ step: step - 1, opacity: 0 }] : []),
  { step, opacity: 1 },
  ...(step < last ? [{ step: step + 1, opacity: 0 }] : [])
];

/* -- 7. Wasza grupa: die Bilder des Besuchs um das Feuer, dann gehen sie --------------------- */
const visit = (wide, tall, away) => ({
  ...wide, mask: ROUND, tall,
  frames: [{ at: 0.15 }, { at: 0.6, ...away.wide, opacity: 0, scale: 0.92, tall: away.tall }]
});

const modules = [
  /* 1. Zaproszenie przy ogniu: das Feuer füllt den Schirm, wird zum Rahmen links — und kommt am Ende wieder. */
  photo('ognisko', '1000003240.jpg', 'ognisko (otwarcie i powrót)', 'Wieczorne ognisko w ogrodzie Hortus Dei', '50% 58%', {
    places: {
      ogien: {
        x: 50, y: 50, w: 100, h: 100, crop: '50% 58%',
        frames: [{ at: 0.15 }, { at: 1, x: 30, y: 50, w: 42, h: 70, crop: '52% 60%', mask: ROUND, tall: { x: 50, y: 30, w: 88, h: 36 } }]
      },
      powrot: {
        x: 40, y: 46, w: 30, h: 46, crop: '50% 58%', mask: ROUND, tall: { x: 50, y: 41, w: 62, h: 28 },
        frames: [{ at: 0.15 }, { at: 1, x: 30, y: 50, w: 42, h: 70, crop: '52% 60%', tall: { x: 50, y: 30, w: 88, h: 36 } }]
      }
    },
    layer: -2, between: 'leave'
  }),
  drawing('swiatlo', '', {
    places: { ogien: { x: 50, y: 60, w: 46, tall: { w: 120 }, frames: [{ at: 0.15 }, { at: 0.7, opacity: 0 }] } },
    layer: -1
  }, {
    size: [200, 120],
    elements: [{ type: 'ellipse', x: 100, y: 60, w: 196, h: 116, fill: 'radial(accent/55, transparent 100%)', motion: { name: 'glow', duration: 4200 } }]
  }),
  drawing('iskry', '', {
    places: { ogien: { x: 50, y: 54, w: 16, tall: { w: 38 }, frames: [{ at: 0.15 }, { at: 0.6, opacity: 0 }] } },
    layer: -1
  }, {
    size: [100, 100],
    elements: [0, 1, 2, 3, 4, 5].map((n) => ({
      type: 'circle', x: 30 + n * 8, y: 92 - (n % 3) * 5, r: r2(0.9 + (n % 2) * 0.5), fill: 'accent', glow: '0 0 5px accent/70',
      motion: {
        name: 'keys', duration: 2600 + n * 300, delay: n * 420, repeat: 'loop',
        keys: [{ at: 0, y: 0, opacity: 0 }, { at: 0.15, opacity: 1 }, { at: 1, y: -64, x: n % 2 === 0 ? 5 : -5, opacity: 0 }]
      }
    }))
  }),
  /* Abgedunkelt wird nur, wo Text steht (ein weicher Schein im Grund der Szene). */
  drawing('welon', '', {
    places: { ogien: { x: 50, y: 42, w: 66, tall: { x: 50, y: 42, w: 130 }, frames: [{ at: 0.15 }, { at: 0.8, opacity: 0 }] } },
    layer: -1, arrive: 'none'
  }, {
    size: [240, 120],
    elements: [{ type: 'ellipse', x: 120, y: 60, w: 236, h: 116, fill: 'radial(ground/72, transparent 100%)' }]
  }),
  text('miejsce', {
    places: {
      ogien: {
        x: 50, y: 33, w: 50, tall: { x: 50, y: 35, w: 88 },
        frames: [{ at: 0.15 }, { at: 1, x: 71, y: 31, w: 38, tall: { x: 50, y: 55, w: 88 } }]
      }
    },
    type: 'note', align: 'center', arrive: 'none'
  }, { title: 'HORTUS DEI · LIMANOWA' }),
  text('naglowek', {
    places: {
      ogien: {
        x: 50, y: 46, w: 64, max: 46, scale: 1.3, tall: { x: 50, y: 46, w: 88, scale: 1 },
        frames: [{ at: 0.15 }, { at: 1, x: 71, y: 42, w: 38, max: 30, scale: 1, tall: { x: 50, y: 65, w: 88 } }]
      }
    },
    type: 'display', align: 'center', arrive: 'none'
  }, { title: 'Jest miejsce na Waszą historię.' }),
  text('zaproszenie', {
    places: { ogien: { x: 71, y: 60, w: 36, max: 28, opacity: 0, tall: { x: 50, y: 81, w: 88 }, frames: [{ at: 0.55 }, { at: 1, opacity: 1 }] } },
    type: 'body', align: 'center', arrive: 'none'
  }, { body: 'Zobaczcie, jak może wyglądać Wasz dzień w ogrodzie.' }),
  /* Die kleine feste Navigation: von jeder Szene zum Praktischen; dort ist sie nicht mehr. */
  text('kontakt-pigulka', {
    places: {
      ogien: { x: 89, y: 7, w: 15, tall: { x: 78, y: 4, w: 36 } },
      powrot: { x: 89, y: 7, w: 15, tall: { x: 78, y: 4, w: 36 } }
    },
    skin: 'pill', type: 'note', align: 'center', arrive: 'none', layer: 12, fill: '#f4eee1', ink: '#1f2b20', go: { '*': 'praktycznie' }
  }, { title: 'Kontakt i dojazd' }),

  /* 2. Ogród otwiera przestrzeń -------------------------------------------------------------- */
  photo('ogrod-foto', '1000003288.jpg', 'górny ogród, wspólne siedzenie', 'Górna część ogrodu z miejscem do wspólnego siedzenia', '50% 55%', {
    places: {
      ogrod: {
        x: 50, y: 50, w: 100, h: 100, crop: '50% 55%',
        frames: [{ at: 0.15 }, { at: 1, x: 30, y: 50, w: 42, h: 70, mask: ROUND, tall: { x: 50, y: 30, w: 88, h: 36 } }]
      },
      rytm: { ...rytmPhoto('ogrod-foto'), crop: '50% 60%' },
      powrot: visit({ x: 11, y: 22, w: 16, h: 24 }, { x: 24, y: 13, w: 40, h: 13 }, { wide: { x: 6 }, tall: { x: 18 } })
    },
    between: 'leave', go: { rytm: 'step' }
  }),
  text('ogrod-tekst', {
    places: { ogrod: { x: 72, y: 47, w: 36, max: 30, opacity: 0, tall: { x: 50, y: 69, w: 88 }, frames: [{ at: 0.45 }, { at: 1, opacity: 1 }] } },
    type: 'heading', arrive: 'none'
  }, { title: '55 arów w centrum Limanowej', body: 'Jest gdzie działać wspólnie, rozmawiać w mniejszych grupach i znaleźć chwilę dla siebie.' }),
  drawing('linia', '', {
    places: { ogrod: { x: 55.5, y: 52, w: 2.2, tall: { x: 50, y: 91, w: 1.4 } } },
    arrive: 'none'
  }, {
    size: [10, 200],
    elements: [{ type: 'path', d: 'M5 0 C 1 60, 9 130, 5 200', stroke: 'accent', width: 0.9, fill: 'none', motion: { name: 'draw', by: 'scene' } }]
  }),

  /* 3. Każda grupa ma swój rytm ------------------------------------------------------------- */
  text('rytm-tytul', {
    places: { rytm: { x: 50, y: 11, w: 70, tall: { x: 50, y: 10.5, w: 72 } } },
    type: 'title', align: 'center', arrive: 'rise'
  }, { title: 'Każda grupa ma swój rytm' }),
  photo('boisko', '1000003290.jpg', 'boisko', 'Boisko w ogrodzie', '50% 55%', {
    places: {
      rytm: rytmPhoto('boisko'),
      powrot: visit({ x: 11, y: 66, w: 16, h: 24 }, { x: 24, y: 69, w: 40, h: 13 }, { wide: { x: 6 }, tall: { x: 18 } })
    },
    between: 'leave', arrive: 'zoom', go: { rytm: 'step' }
  }),
  photo('domek', '1000003284.jpg', 'domek', 'Domek i jego otoczenie', '50% 50%', {
    places: {
      rytm: rytmPhoto('domek'),
      powrot: visit({ x: 69, y: 19, w: 16, h: 22 }, { x: 76, y: 13, w: 40, h: 13 }, { wide: { x: 74 }, tall: { x: 82 } })
    },
    between: 'leave', arrive: 'zoom', go: { rytm: 'step' }
  }),
  ...[
    ['etykieta-gra', 'Zagrać razem', 'boisko', 1],
    ['etykieta-rozmowa', 'Usiąść i porozmawiać', 'ogrod-foto', 2],
    ['etykieta-pomysl', 'Znaleźć własny pomysł', 'domek', 3]
  ].map(([id, title, of, step]) => text(id, {
    places: { rytm: { ...rytmLabel(of, step), step } },
    skin: 'pill', type: 'note', align: 'center', arrive: 'rise', go: { rytm: 'step' }
  }, { title })),
  ...[
    ['dopowiedzenie-gra', 'Działające boisko w górnej części ogrodu — na wspólną grę i ruch.', 1],
    ['dopowiedzenie-rozmowa', 'Miejsce do wspólnego siedzenia — na rozmowę całą grupą albo w małych kręgach.', 2],
    ['dopowiedzenie-pomysl', 'Domek i zakątki ogrodu — przestrzeń na Wasz własny plan dnia.', 3]
  ].map(([id, body, step]) => text(id, {
    places: { rytm: { x: 50, y: 86, w: 54, max: 40, opacity: 0, tall: { x: 50, y: 60.5, w: 88 }, frames: onlyAt(step, 3) } },
    type: 'body', align: 'center', arrive: 'none'
  }, { body })),
  text('rytm-wskazowka', {
    places: { rytm: { x: 50, y: 86, w: 50, tall: { x: 50, y: 86, w: 88 }, frames: [{ step: 1, opacity: 0 }] } },
    type: 'note', align: 'center', arrive: 'fade'
  }, { title: 'Dotknij zdjęcia — albo przewijaj dalej' }),

  /* 4. Jest także miejsce na chwilę dla siebie: zwei Ebenen mit verschiedener Geschwindigkeit, ein wachsender Kreis. */
  photo('las-pionowe', '1000003341.jpg', 'zieleń, zdjęcie pionowe', 'Zielona, spokojniejsza część ogrodu', '50% 50%', {
    places: {
      las: {
        x: 27, y: 50, w: 34, h: 88, crop: '50% 40%', mask: ROUND, tall: { x: 50, y: 29, w: 92, h: 46 },
        frames: [{ at: 1, y: 47, crop: '50% 70%', tall: { y: 27 } }]
      }
    },
    arrive: 'none',
    motion: { name: 'keys', by: 'enter', keys: [{ at: 0, clip: 'circle(8% at 50% 62%)' }, { at: 1, clip: 'circle(75% at 50% 50%)' }] }
  }),
  photo('hustawka', '1000003305.jpg', 'huśtawka między drzewami', 'Miejsce odpoczynku wśród drzew, huśtawka', '50% 50%', {
    places: {
      las: { x: 64, y: 33, w: 24, h: 34, scale: 1.04, mask: ROUND, tall: { x: 27, y: 84, w: 44, h: 19 }, frames: [{ at: 1, y: 25, scale: 1, tall: { y: 81 } }] },
      powrot: visit({ x: 40, y: 85, w: 16, h: 20 }, { x: 76, y: 69, w: 40, h: 13 }, { wide: { y: 92 }, tall: { x: 82 } })
    },
    between: 'leave', arrive: 'rise', delay: 0.1
  }),
  photo('sciezka', '1000003297.jpg', 'ścieżka między drzewami', 'Ścieżka i urządzona część terenu między drzewami', '50% 60%', {
    places: { las: { x: 84, y: 70, w: 24, h: 36, scale: 1.04, mask: ROUND, tall: { x: 73, y: 84, w: 44, h: 19 }, frames: [{ at: 1, y: 60, scale: 1, tall: { y: 81 } }] } },
    arrive: 'rise', delay: 0.2
  }),
  text('las-tekst', {
    places: { las: { x: 60, y: 73, w: 22, max: 22, tall: { x: 50, y: 61, w: 88 } } },
    type: 'heading', arrive: 'rise', delay: 0.3
  }, { title: 'Być razem. Mieć też przestrzeń dla siebie.', body: 'W dolnej części ogrodu jest las i strumień — na zabawę, spacer i chwilę ciszy.' }),

  /* 5. Gościnność ma swój początek: der Tisch zeichnet sich beim Kommen, die Stühle beim Weitergehen. */
  drawing('stol', 'Rysunek: stół z krzesłami w lesie — od niego zaczęło się wspólne bycie w ogrodzie', {
    places: { poczatek: { x: 30, y: 52, w: 40, max: 36, tall: { x: 50, y: 28, w: 84 } } },
    arrive: 'fade'
  }, {
    size: [200, 120],
    elements: [
      { type: 'path', d: 'M28 54 L172 54', stroke: 'ink', width: 2.4, cap: 'round', motion: { name: 'keys', by: 'enter', keys: [{ at: 0, draw: 0 }, { at: 0.2, draw: 0 }, { at: 0.85, draw: 1 }] } },
      { type: 'path', d: 'M44 54 L38 102 M156 54 L162 102', stroke: 'ink', width: 2.2, cap: 'round', motion: { name: 'keys', by: 'enter', keys: [{ at: 0, draw: 0 }, { at: 0.4, draw: 0 }, { at: 1, draw: 1 }] } },
      { type: 'path', d: 'M14 34 L14 80 L36 80 M14 80 L14 104 M36 80 L36 104', stroke: 'accent', width: 2, cap: 'round', motion: { name: 'keys', by: 'scene', keys: [{ at: 0, draw: 0 }, { at: 0.7, draw: 1 }] } },
      { type: 'path', d: 'M186 34 L186 80 L164 80 M186 80 L186 104 M164 80 L164 104', stroke: 'accent', width: 2, cap: 'round', motion: { name: 'keys', by: 'scene', keys: [{ at: 0, draw: 0 }, { at: 0.15, draw: 0 }, { at: 0.85, draw: 1 }] } },
      { type: 'path', d: 'M4 110 C 60 106, 140 114, 196 108', stroke: 'muted', width: 1.2, cap: 'round', motion: { name: 'keys', by: 'scene', keys: [{ at: 0, draw: 0 }, { at: 0.4, draw: 0 }, { at: 1, draw: 1 }] } }
    ]
  }),
  text('poczatek-tekst', {
    places: { poczatek: { x: 70, y: 36, w: 36, max: 30, tall: { x: 50, y: 58, w: 88 } } },
    type: 'heading', arrive: 'rise'
  }, {
    title: 'Gościnność ma swój początek',
    body: 'Prace zaczęły się w 2019 roku. Z wysokiej trawy powoli wyłaniał się ogród, a jednym z pierwszych miejsc wspólnego pobytu był stół z krzesłami w lesie.'
  }),
  text('poczatek-wdziecznosc', {
    places: { poczatek: { x: 70, y: 68, w: 36, max: 30, opacity: 0, tall: { x: 50, y: 82, w: 88 }, frames: [{ at: 0.3 }, { at: 1, opacity: 1 }] } },
    type: 'close', arrive: 'none'
  }, { body: 'Rodzina kupiła tę działkę, by stworzyć miejsce, którym można się dzielić —\nwotum wdzięczności Bogu za prowadzenie i dobro otrzymane w życiu i w pracy.' }),

  /* 6. Przestrzeń na dalszy rozwój: die Linie führt zum Bau, der Bau nimmt den Platz; „W budowie" sofort. */
  photo('budowa', '1000003831.jpg', 'budowa domu', 'Budowa nowego domu dla grup', '50% 50%', {
    places: {
      dom: {
        x: 66, y: 50, w: 42, h: 56, mask: ROUND, tall: { x: 50, y: 30, w: 90, h: 34 },
        frames: [{ at: 1, x: 64, w: 56, h: 76, tall: { x: 50, y: 31, w: 96, h: 40 } }]
      }
    }
  }),
  text('w-budowie', {
    places: { dom: { x: 52, y: 27, w: 11, tall: { x: 20, y: 17, w: 28 }, frames: [{ at: 1, x: 43, y: 17, tall: { x: 17, y: 15 } }] } },
    skin: 'pill', type: 'note', align: 'center', layer: 2
  }, { title: 'W budowie' }),
  drawing('droga', '', {
    places: { dom: { x: 22, y: 84, w: 40, tall: { x: 50, y: 55, w: 70 } } },
    arrive: 'none'
  }, {
    size: [400, 80],
    elements: [{ type: 'path', d: 'M0 70 C 110 78, 240 66, 400 8', stroke: 'accent', width: 2, cap: 'round', motion: { name: 'draw', by: 'enter' } }]
  }),
  text('dom-tekst', {
    places: { dom: { x: 20, y: 46, w: 30, max: 26, tall: { x: 50, y: 75, w: 88 } } },
    type: 'heading', arrive: 'rise'
  }, {
    title: 'Przestrzeń na dalszy rozwój',
    body: 'Powstaje dom dla grup do około 50 osób, z kaplicą i zapleczem gastronomicznym — następny rozdział tej samej gościnności.\n> Termin otwarcia nie jest jeszcze znany.'
  }),

  /* 7. Wasza grupa dopisuje dalszy ciąg: der Knopf steht von Anfang an und bewegt sich nicht. */
  text('cta-tekst', {
    places: { powrot: { x: 73, y: 44, w: 36, max: 30, opacity: 0, tall: { x: 50, y: 64, w: 88 }, frames: [{ at: 0.5 }, { at: 1, opacity: 1 }] } },
    type: 'heading', arrive: 'none'
  }, {
    title: 'Opowiedz o swojej grupie',
    body: 'Napisz, kim jesteście, jaki macie pomysł i kiedy chcielibyście przyjechać. Kolejne wspomnienia tego miejsca mogą należeć do Was.'
  }),
  text('cta-przycisk', {
    places: { powrot: { x: 73, y: 66, w: 26, tall: { x: 50, y: 88, w: 76 } } },
    skin: 'pill', type: 'body', align: 'center', layer: 4, fill: 'accent', ink: '#1b120b', go: { powrot: 'praktycznie' }
  }, { title: 'Napisz do gospodarzy' }),

  /* 8. Praktycznie: nur, was bestätigt ist; der Rest ist eine Frage an die Gastgeber. */
  text('praktyczne', {
    places: { praktycznie: { x: 36, y: 50, w: 50, max: 40, tall: { x: 50, y: 42, w: 92 } } },
    skin: 'card', type: 'body', arrive: 'rise'
  }, {
    title: 'Praktycznie',
    body: [
      '## Na miejscu',
      'W górnej części ogrodu działają boisko, domek i miejsce na ognisko; w dolnej jest las ze strumieniem.',
      '## W budowie',
      'Dom dla grup do około 50 osób, z kaplicą i zapleczem gastronomicznym. Termin otwarcia nie jest jeszcze znany.',
      '## Dojazd',
      'Limanowa, około 15 minut spacerem do sanktuarium. Adres — w kontakcie.',
      '## Zapytajcie gospodarzy',
      'O noclegi, toalety, parking, ceny i zasady pobytu grup.'
    ].join('\n')
  }),
  {
    id: 'kontakt', name: 'Kontakt gospodarzy — do uzupełnienia (adres, telefon, e-mail)', kind: 'contact', size: { colSpan: 2, rowSpan: 3 },
    show: { places: { praktycznie: { x: 76, y: 50, w: 30, max: 24, tall: { x: 50, y: 87, w: 92 } } }, arrive: 'rise', delay: 0.15 },
    config: { address: '', phone: '', email: '' }
  }
];

const doc = {
  format: 'recreatio/page',
  version: 1,
  path: 'hortusdei',
  title: 'Hortus Dei — miejsce na Waszą historię',
  lead: null,
  mode: 'presentation',
  theme: {
    mode: 'light', accent: '#b4602a', ink: '#1f2b20', ground: '#f4eee1', muted: '#5d6b58',
    night: { accent: '#efa45c', ink: '#eee8db', ground: '#151a14', muted: '#97a08d' }
  },
  cover: [],
  show: { format: 'screen', fonts: 'spectral', nav: 'dots', scenes },
  modules
};

/* -- In die Form des Exports bringen: so, wie die Seite es selbst schreibt ---------------------- */
const workspace = await mkdtemp(join(tmpdir(), 'hortus-dei-'));
try {
  const entry = join(workspace, 'entry.tsx');
  const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
  await writeFile(entry, `export { planImport, exportPage, DEFAULT_IMPORT } from '${app}pages/pageJson';\n`);
  await build({
    entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', jsx: 'automatic',
    nodePaths: [join(process.cwd(), 'node_modules')],
    banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
    outfile: join(workspace, 'entry.mjs'),
    define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) },
    loader: { '.css': 'empty' }, logLevel: 'error'
  });
  /* Der Kanal zwischen Tabs hielte Node am Leben — hier gibt es keine Tabs. */
  globalThis.BroadcastChannel = undefined;
  const m = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
  const now = { path: 'hortusdei', title: '', lead: '', mode: 'page', look: { theme: null, cover: [] }, parts: [], logic: null, menu: null };
  const plan = m.planImport(doc, now, { ...m.DEFAULT_IMPORT, replace: true });
  if ('error' in plan) throw new Error(plan.error);
  if (plan.warnings.length > 0) { console.log(plan.warnings.join('\n')); process.exitCode = 1; }
  const again = m.exportPage({ ...now, title: plan.title, lead: plan.lead ?? '', mode: plan.mode, look: plan.look, parts: plan.parts, logic: null, menu: null });
  const canonical = {
    ...doc,
    show: again.show,
    modules: doc.modules.map((mod, i) => ({ id: mod.id, ...(mod.name === undefined ? {} : { name: mod.name }), kind: mod.kind, size: mod.size, show: again.modules[i].show, config: again.modules[i].config }))
  };
  await writeFile(out, `${JSON.stringify(canonical, null, 2)}\n`);
  const longest = Math.max(...canonical.modules.map((mod) => JSON.stringify(mod.config).length));
  console.log(`written ${out} — ${scenes.length} scenes, ${modules.length} modules, ${plan.warnings.length} warnings, longest content ${longest} chars`);
} finally {
  await rm(workspace, { recursive: true, force: true });
}
