/**
 * 2026-10-18 — VERSUCHE FÜR DIE SCHULE (Fizyka 2D): fertige Szenen — dieselben
 * Dokumente, die ein Baustein speichert. Der Editor bietet sie an („Wstaw
 * przykład”), die Piaskownica lädt sie („Doświadczenia”), und
 * `scripts/lab-examples.mjs` schreibt aus ihnen die Beispielseite.
 *
 * Jede Szene: eine Welt, Körper und Verbindungen, Becken, was zu sehen ist,
 * was man darf, manchmal ein Ziel, die Schritte des Versuchs — und, wo es
 * passt, gezogene Werte (jedes Mal ein anderer Winkel, eine andere Länge).
 */

export interface PhysPreset {
  readonly key: string;
  readonly title: string;
  /** Wozu, in einer Zeile. */
  readonly summary: string;
  /** Was die Schüler tun sollen (Absätze). */
  readonly text: readonly string[];
  readonly scene: Readonly<Record<string, unknown>>;
}

/* Ein Klotz auf einer schiefen Ebene (Winkel `kat`, oberes Ende der Fläche bei x0, Höhe hTop): `d` Meter die Fläche hinab, Dicke h. */
const onSlope = (x0: number, len: number, d: number, h: number) => ({
  x: `=${x0} + ${d}*cos(rad(kat)) + ${h / 2 + 0.004}*sin(rad(kat))`,
  y: `=${len}*tan(rad(kat)) - ${d}*sin(rad(kat)) + ${h / 2 + 0.004}*cos(rad(kat))`,
  angle: '=-kat'
});

export const PHYS_PRESETS: readonly PhysPreset[] = [
  {
    key: 'spadek',
    title: 'Spadek swobodny — z powietrzem i bez',
    summary: 'Stalowa kulka, kartka i piłka spadają z tej samej wysokości — co zmienia powietrze?',
    text: [
      'Trzy ciała spadają z wysokości 4 m. Uruchom i obserwuj ślady: które spada najwolniej?',
      'Wyłącz „Powietrze” w ustawieniach świata i powtórz (Od nowa). Bez oporu powietrza wszystkie spadają tak samo — przyspieszenie to g.',
      'Wykres pokazuje wysokość i prędkość kulki: prędkość rośnie równomiernie (v = g·t).'
    ],
    scene: {
      world: { gravity: 9.81, air: 1 },
      bodies: [
        { id: 'kulka', label: 'stalowa kulka', shape: 'circle', r: 0.08, x: 1, y: 4, material: 'steel', trace: true },
        { id: 'kartka', label: 'kartka', shape: 'box', w: 0.5, h: 0.02, x: 2.4, y: 4, material: 'paper', trace: true },
        { id: 'pilka', label: 'piłka plażowa', shape: 'circle', r: 0.25, x: 3.8, y: 4, material: 'foam', trace: true }
      ],
      show: { vectors: ['v'], values: true },
      graph: { body: 'kulka', of: ['h', 'v'] },
      controls: ['air', 'gravity'],
      allow: { add: false, tools: ['ruler'] },
      view: [0, -0.2, 4.8, 4.6],
      steps: [
        { say: 'Puść wszystkie trzy ciała naraz.', do: 'play', wait: 2.5 },
        { say: 'Wyłącz „Powietrze” i zacznij od nowa — porównaj ślady.', wait: 2 }
      ]
    }
  },
  {
    key: 'rownia',
    title: 'Równia pochyła i tarcie',
    summary: 'Klocek drewniany i kostka lodu na równi o losowym kącie: który się zsunie?',
    text: [
      'Kąt równi jest za każdym razem inny. Najpierw przewiduj: czy klocek drewniany się zsunie? A lód?',
      'Klocek zsuwa się, gdy tan α jest większy od współczynnika tarcia (drewno po drewnie: µ ≈ 0,5, czyli α > 27°; lód: µ ≈ 0,1).',
      'Strzałki pokazują prędkość. „Nowe losowanie” zmienia kąt.'
    ],
    scene: {
      world: { gravity: 9.81, air: 0 },
      vars: [{ name: 'kat', from: 15, to: 40, step: 5 }],
      bodies: [
        { id: 'rownia', label: 'równia', shape: 'poly', points: [[0, 0], [4, 0], [0, '=4*tan(rad(kat))']], x: 0.5, y: 0, static: true, material: 'wood', drag: false },
        { id: 'drewno', label: 'drewno', shape: 'box', w: 0.4, h: 0.25, material: 'wood', ...onSlope(0.5, 4, 0.6, 0.25) },
        { id: 'lod', label: 'lód', shape: 'box', w: 0.3, h: 0.25, material: 'ice', ...onSlope(0.5, 4, 1.4, 0.25) }
      ],
      show: { vectors: ['v'], values: true },
      allow: { add: false, tools: ['ruler'] },
      view: [0, -0.3, 6, 3.8],
      steps: [{ say: 'Przewiduj, potem uruchom.', do: 'play', wait: 3 }]
    }
  },
  {
    key: 'wahadlo',
    title: 'Wahadło i zasada zachowania energii',
    summary: 'Wahadło o losowej długości: okres T = 2π√(L/g) i energia, która przelewa się z potencjalnej w kinetyczną.',
    text: [
      'Uruchom i patrz na wykres: energia potencjalna (Ep) zamienia się w kinetyczną (Ek), a suma (E) zostaje.',
      'Zmierz okres: ile sekund trwa jedno pełne wahnięcie? Porównaj z T = 2π√(L/g) — długość zmierzysz linijką.',
      'Złap kulkę i puść z innej wysokości.'
    ],
    scene: {
      world: { gravity: 9.81, air: 0 },
      vars: [{ name: 'L', from: 1, to: 2.5, step: 0.5 }],
      bodies: [{ id: 'kulka', label: 'kulka', shape: 'circle', r: 0.1, x: '=3 + L*sin(rad(35))', y: '=4 - L*cos(rad(35))', material: 'steel' }],
      joints: [{ type: 'rod', a: 'kulka', at: [3, 4] }],
      show: { vectors: ['v'], trace: ['kulka'], values: true },
      graph: { body: 'kulka', of: ['ek', 'ep', 'e'] },
      allow: { add: false, tools: ['ruler'] },
      view: [0.5, 0.8, 5.5, 4.5],
      steps: [{ say: 'Puść kulkę.', do: 'play', wait: 4 }]
    }
  },
  {
    key: 'sprezyna',
    title: 'Drgania na sprężynie',
    summary: 'Ciężarek na sprężynie o losowej sztywności: okres T = 2π√(m/k).',
    text: [
      'Sprężyna ma za każdym razem inną sztywność k. Pociągnij ciężarek w dół i puść.',
      'Wykres wysokości to sinusoida. Okres zależy od masy i sztywności: T = 2π√(m/k) — nie od tego, jak mocno pociągniesz.'
    ],
    scene: {
      world: { gravity: 9.81, air: 0 },
      vars: [{ name: 'k', from: 150, to: 450, step: 50 }],
      bodies: [{ id: 'ciezarek', label: 'ciężarek', shape: 'box', w: 0.2, h: 0.2, x: 3, y: 2.6, material: 'aluminium' }],
      joints: [{ type: 'spring', a: 'ciezarek', on: [0, 0.1], at: [3, 4.2], length: 1.2, k: '=k', damping: 0.4 }],
      show: { values: true },
      graph: { body: 'ciezarek', of: ['h', 'vy'] },
      allow: { add: false, tools: ['ruler'] },
      view: [1.4, 1.2, 4.6, 4.6],
      steps: [{ say: 'Pociągnij ciężarek w dół i puść.', do: 'play', wait: 3 }]
    }
  },
  {
    key: 'zderzenia',
    title: 'Zderzenia na stole powietrznym',
    summary: 'Krążki bez tarcia: pęd przed zderzeniem równa się pędowi po.',
    text: [
      'Stół widziany z góry — bez grawitacji i bez tarcia. Duży krążek (stalowy) uderza w mały.',
      'Popchnij krążki (przeciągnij i puść). Strzałki to prędkości. Suma m·v przed i po zderzeniu jest taka sama.'
    ],
    scene: {
      world: { gravity: 0, air: 0, ground: false },
      bodies: [
        { id: 'duzy', label: 'stalowy krążek', shape: 'circle', r: 0.3, x: 1.2, y: 1.6, vx: 1.6, material: 'steel', bounce: 0.95, friction: 0 },
        { id: 'maly', label: 'aluminiowy krążek', shape: 'circle', r: 0.2, x: 4, y: 1.5, material: 'aluminium', bounce: 0.95, friction: 0 },
        { id: 'trzeci', label: 'gumowy krążek', shape: 'circle', r: 0.25, x: 5.2, y: 2.4, material: 'rubber', bounce: 0.95, friction: 0 },
        { id: 'b1', shape: 'box', w: 7, h: 0.15, x: 3.2, y: -0.05, static: true, material: 'stone', bounce: 1, friction: 0, drag: false },
        { id: 'b2', shape: 'box', w: 7, h: 0.15, x: 3.2, y: 3.35, static: true, material: 'stone', bounce: 1, friction: 0, drag: false },
        { id: 'b3', shape: 'box', w: 0.15, h: 3.55, x: -0.25, y: 1.65, static: true, material: 'stone', bounce: 1, friction: 0, drag: false },
        { id: 'b4', shape: 'box', w: 0.15, h: 3.55, x: 6.65, y: 1.65, static: true, material: 'stone', bounce: 1, friction: 0, drag: false }
      ],
      show: { vectors: ['v'], values: true },
      allow: { add: false, tools: [] },
      view: [-0.5, -0.3, 6.9, 3.6],
      steps: [{ say: 'Uruchom: stalowy krążek uderzy w aluminiowy.', do: 'play', wait: 4 }]
    }
  },
  {
    key: 'kolyska',
    title: 'Kołyska Newtona',
    summary: 'Pięć stalowych kulek na prętach: jedna uderza, jedna odskakuje.',
    text: ['Odciągnij skrajną kulkę i puść. Pęd i energia przechodzą przez wszystkie kulki — odskakuje ta po drugiej stronie.', 'Spróbuj z dwiema kulkami naraz.'],
    scene: {
      world: { gravity: 9.81, air: 0, ground: false },
      bodies: [0, 1, 2, 3, 4].map((i) => ({
        id: `k${i + 1}`, label: `kulka ${i + 1}`, shape: 'circle', r: 0.15,
        x: i === 0 ? 2 + i * 0.302 - 1.4 * Math.sin(0.6) : 2 + i * 0.302,
        y: i === 0 ? 3 - 1.4 * Math.cos(0.6) : 1.6,
        material: 'steel', bounce: 0.98, friction: 0
      })),
      joints: [0, 1, 2, 3, 4].map((i) => ({ type: 'rod', a: `k${i + 1}`, at: [2 + i * 0.302, 3] })),
      show: { values: false },
      allow: { add: false, tools: [] },
      view: [0.6, 1.2, 4.6, 3.3],
      steps: [{ say: 'Puść kulkę.', do: 'play', wait: 4 }]
    }
  },
  {
    key: 'rzut',
    title: 'Rzut do kosza',
    summary: 'Rzuć piłką (przeciągnij i puść) tak, żeby wpadła do kosza — tor to parabola.',
    text: ['Złap piłkę, rozpędź ją ruchem palca i puść. Ślad pokazuje tor lotu — parabolę.', 'Kosz stoi za każdym razem gdzie indziej.'],
    scene: {
      world: { gravity: 9.81, air: 0.2 },
      vars: [{ name: 'd', from: 4.5, to: 7.5, step: 0.5 }],
      bodies: [
        { id: 'pilka', label: 'piłka', shape: 'circle', r: 0.12, x: 0.8, y: 1.2, material: 'ball', trace: true },
        { id: 'stol', shape: 'box', w: 1, h: 1, x: 0.8, y: 0.5, static: true, material: 'wood', drag: false },
        { id: 'kosz-l', shape: 'box', w: 0.05, h: 0.5, x: '=d - 0.35', y: 1.75, static: true, material: 'steel', drag: false },
        { id: 'kosz-p', shape: 'box', w: 0.05, h: 0.5, x: '=d + 0.35', y: 1.75, static: true, material: 'steel', drag: false },
        { id: 'kosz-d', shape: 'box', w: 0.75, h: 0.05, x: '=d', y: 1.52, static: true, material: 'steel', drag: false },
        { id: 'slup', shape: 'box', w: 0.08, h: 1.5, x: '=d', y: 0.75, static: true, material: 'steel', drag: false }
      ],
      goal: { body: 'pilka', area: ['=d - 0.3', 1.55, '=d + 0.3', 2], for: 0.3, say: 'Kosz! Tor piłki to parabola: ruch jednostajny w poziomie i jednostajnie przyspieszony w pionie.' },
      show: { values: false },
      allow: { add: false, tools: ['ruler'] },
      view: [0, -0.2, 8.5, 4.5]
    }
  },
  {
    key: 'atwood',
    title: 'Maszyna Atwooda',
    summary: 'Dwa ciężarki na linie przez bloczek: a = g·(m₁ − m₂)/(m₁ + m₂).',
    text: ['Cięższy ciężarek opada, lżejszy się wznosi — z przyspieszeniem mniejszym niż g.', 'Zmierz czas spadku na metrze (linijka) i porównaj z wzorem.'],
    scene: {
      world: { gravity: 9.81, air: 0 },
      vars: [{ name: 'm2', from: 4, to: 9, step: 1 }],
      bodies: [
        { id: 'm1', label: 'ciężarek 10 kg', shape: 'box', w: 0.25, h: 0.25, x: 2.6, y: 1.6, material: 'steel', density: 1600 },
        { id: 'm2', label: 'ciężarek {m2} kg', shape: 'box', w: 0.25, h: 0.25, x: 3.4, y: 1.6, material: 'aluminium', density: '=m2/0.00625' }
      ],
      joints: [{ type: 'pulley', a: 'm1', b: 'm2', on: [0, 0.125], onB: [0, 0.125], at: [2.6, 3.6], at2: [3.4, 3.6] }],
      show: { vectors: ['v'], values: true },
      graph: { body: 'm1', of: ['h', 'v'] },
      allow: { add: false, tools: ['ruler'] },
      view: [1.4, -0.2, 4.6, 4],
      steps: [{ say: 'Puść ciężarki.', do: 'play', wait: 3 }]
    }
  },
  {
    key: 'dzwignia',
    title: 'Dźwignia — huśtawka',
    summary: 'Zrównoważ huśtawkę: masa × ramię po obu stronach.',
    text: ['Ciężarek 2 kg i 4 kg leżą na huśtawce. Przesuń je tak, żeby huśtawka stanęła poziomo.', 'Warunek równowagi: m₁·r₁ = m₂·r₂ (moment siły).'],
    scene: {
      world: { gravity: 9.81, air: 0 },
      bodies: [
        { id: 'podpora', shape: 'poly', points: [[-0.35, 0], [0.35, 0], [0, 0.6]], x: 3, y: 0, static: true, material: 'stone', drag: false },
        { id: 'deska', label: 'deska', shape: 'box', w: 4, h: 0.08, x: 3, y: 0.65, material: 'wood', density: 300 },
        { id: 'a', label: '2 kg', shape: 'box', w: 0.25, h: 0.25, x: 1.6, y: 0.82, material: 'steel', density: 320 },
        { id: 'b', label: '4 kg', shape: 'box', w: 0.25, h: 0.25, x: 4.2, y: 0.82, material: 'steel', density: 640 }
      ],
      joints: [{ type: 'pin', a: 'deska', at: [3, 0.62] }],
      show: { values: true },
      allow: { add: false, tools: ['ruler'] },
      view: [0.6, -0.3, 5.4, 2.4]
    }
  },
  {
    key: 'plywanie',
    title: 'Pływanie ciał',
    summary: 'Korek, drewno, lód, plastik, aluminium i stal w wodzie — które pływają i jak głęboko się zanurzają?',
    text: [
      'Uruchom: klocki wpadają do wody. Pływa to, co ma mniejszą gęstość niż woda (1000 kg/m³).',
      'Pływające ciało zanurza się tak, że wypiera tyle wody, ile samo waży: zanurzona część = gęstość ciała / gęstość wody (lód: 92 %).',
      'Strzałki: ciężar (Q) i siła wyporu (Fw).'
    ],
    scene: {
      world: { gravity: 9.81, air: 0.3 },
      fluids: [{ id: 'woda', x: 0.5, y: 0, w: 6, h: 1.6, layers: [{ liquid: 'water', height: 1 }] }],
      bodies: [
        { id: 'korek', label: 'korek', shape: 'box', w: 0.4, h: 0.3, x: 1, y: 2.2, material: 'cork' },
        { id: 'drewno', label: 'drewno', shape: 'box', w: 0.4, h: 0.3, x: 2, y: 2.2, material: 'wood' },
        { id: 'lod', label: 'lód', shape: 'box', w: 0.4, h: 0.3, x: 3, y: 2.2, material: 'ice' },
        { id: 'plastik', label: 'plastik', shape: 'box', w: 0.4, h: 0.3, x: 4, y: 2.2, material: 'plastic' },
        { id: 'aluminium', label: 'aluminium', shape: 'box', w: 0.4, h: 0.3, x: 5, y: 2.2, material: 'aluminium' },
        { id: 'stal', label: 'stal', shape: 'box', w: 0.4, h: 0.3, x: 6, y: 2.2, material: 'steel' }
      ],
      show: { vectors: ['g', 'lift'], values: true, pressure: true },
      allow: { add: false, tools: ['probe', 'ruler'] },
      view: [0, -0.3, 7, 2.8],
      steps: [{ say: 'Wrzuć klocki do wody.', do: 'play', wait: 4 }]
    }
  },
  {
    key: 'archimedes',
    title: 'Prawo Archimedesa',
    summary: 'Naczynie z przelewem: woda wyparta przez klocek przelewa się do zlewki, a siłomierz pokazuje mniej.',
    text: [
      'Klocek wisi na sprężynie (siłomierzu). Zanurz go w naczyniu z przelewem (złap i opuść).',
      'Woda, którą klocek wypiera, wypływa do zlewki obok. Siła na sprężynie maleje dokładnie o ciężar tej wody — to siła wyporu.'
    ],
    scene: {
      world: { gravity: 9.81, air: 0 },
      fluids: [
        { id: 'przelew', x: 1, y: 0, w: 1.2, h: 1.6, layers: [{ liquid: 'water', height: 1.18 }], holes: [{ side: 'right', at: 1.2, size: 0.08, open: true }] },
        { id: 'zlewka', x: 2.9, y: 0, w: 0.8, h: 0.9 }
      ],
      bodies: [{ id: 'klocek', label: 'aluminium', shape: 'box', w: 0.3, h: 0.4, x: 1.6, y: 2.3, material: 'aluminium' }],
      joints: [{ type: 'spring', a: 'klocek', on: [0, 0.2], at: [1.6, 3.6], length: 0.9, k: 300, damping: 30 }],
      show: { vectors: ['lift'], values: true },
      allow: { add: false, tools: ['probe', 'ruler'] },
      view: [0.2, -0.2, 4.4, 3.8],
      steps: [{ say: 'Złap klocek i zanurz go w wodzie.', do: 'play', wait: 3 }]
    }
  },
  {
    key: 'cisnienie',
    title: 'Ciśnienie hydrostatyczne',
    summary: 'Wysoki zbiornik z trzema otworami: im głębiej, tym większe ciśnienie i dalszy strumień.',
    text: [
      'Otwórz otwory (kliknij zbiornik, potem „Otwórz”). Strumień z najniższego otworu tryska najdalej.',
      'Ciśnienie rośnie z głębokością: p = p₀ + ρ·g·h. Prędkość wypływu: v = √(2·g·h) (Torricelli). Zmierz ciśnienie sondą.'
    ],
    scene: {
      world: { gravity: 9.81, air: 0 },
      fluids: [{
        id: 'zbiornik', x: 1, y: 1, w: 0.9, h: 2.6, layers: [{ liquid: 'water', height: 2.4 }],
        holes: [{ side: 'right', at: 0.2, size: 0.03, open: false }, { side: 'right', at: 0.9, size: 0.03, open: false }, { side: 'right', at: 1.6, size: 0.03, open: false }]
      }],
      bodies: [{ id: 'stojak', shape: 'box', w: 1.1, h: 0.94, x: 1.45, y: 0.47, static: true, material: 'wood', drag: false }],
      show: { values: true, pressure: true },
      allow: { add: false, tools: ['probe', 'ruler'] },
      view: [0.3, -0.2, 6.5, 4],
      steps: [
        { say: 'Otwórz najniższy otwór.', do: { open: 'zbiornik', hole: 0 }, wait: 1.5 },
        { say: 'Otwórz środkowy.', do: { open: 'zbiornik', hole: 1 }, wait: 1.5 },
        { say: 'Otwórz najwyższy — porównaj strumienie.', do: { open: 'zbiornik', hole: 2 }, wait: 3 }
      ]
    }
  },
  {
    key: 'naczynia',
    title: 'Naczynia połączone',
    summary: 'Trzy naczynia różnej szerokości połączone rurą — woda wyrównuje poziom.',
    text: ['Woda jest tylko w środkowym naczyniu, a rury są otwarte. Uruchom: poziomy się wyrównają, choć naczynia są różnej szerokości.', 'Ciśnienie na dnie zależy tylko od wysokości słupa wody, nie od kształtu naczynia.'],
    scene: {
      world: { gravity: 9.81, air: 0 },
      fluids: [
        { id: 'a', x: 0.5, y: 0.3, w: 0.35, h: 2.2 },
        { id: 'b', x: 1.6, y: 0.3, w: 1.2, h: 2.2, layers: [{ liquid: 'water', height: 1.8 }] },
        { id: 'c', x: 3.5, y: 0.3, w: 0.2, h: 2.2 }
      ],
      pipes: [{ a: 'a', b: 'b', y: 0.36, size: 0.06 }, { a: 'b', b: 'c', y: 0.36, size: 0.06 }],
      bodies: [{ id: 'podstawa', shape: 'box', w: 3.8, h: 0.24, x: 2.15, y: 0.12, static: true, material: 'wood', drag: false }],
      show: { values: true, pressure: true },
      allow: { add: false, tools: ['probe', 'ruler'] },
      view: [0, -0.2, 4.4, 2.8],
      steps: [{ say: 'Uruchom — woda popłynie rurami.', do: 'play', wait: 4 }]
    }
  },
  {
    key: 'u-rurka',
    title: 'Rurka U z olejem i wodą',
    summary: 'Olej jest lżejszy od wody: słup oleju jest wyższy niż woda po drugiej stronie.',
    text: ['W rurce jest woda, a w lewym ramieniu jeszcze olej. Poziomy nie są równe!', 'Na wysokości granicy ciśnienia są równe: ρ_oleju·h_oleju = ρ_wody·h_wody.'],
    scene: {
      world: { gravity: 9.81, air: 0 },
      fluids: [
        { id: 'lewe', x: 1, y: 0.3, w: 0.25, h: 2, layers: [{ liquid: 'water', height: 0.8 }, { liquid: 'oil', height: 0.6 }] },
        { id: 'prawe', x: 2, y: 0.3, w: 0.25, h: 2, layers: [{ liquid: 'water', height: 0.8 }] }
      ],
      pipes: [{ a: 'lewe', b: 'prawe', y: 0.36, size: 0.06 }],
      bodies: [{ id: 'podstawa', shape: 'box', w: 1.6, h: 0.24, x: 1.62, y: 0.12, static: true, material: 'wood', drag: false }],
      show: { values: true, pressure: true },
      allow: { add: false, tools: ['probe', 'ruler'] },
      view: [0.4, -0.2, 2.9, 2.6],
      steps: [{ say: 'Uruchom i poczekaj, aż poziomy się ustalą.', do: 'play', wait: 4 }]
    }
  },
  {
    key: 'jajko',
    title: 'Jajko w wodzie słodkiej i słonej',
    summary: 'Jajko tonie w zwykłej wodzie i pływa w słonej — gęstość cieczy ma znaczenie.',
    text: ['Dwa jajka wpadają do dwóch zbiorników: z wodą kranową i z mocno osoloną.', 'Gęstość jajka (ok. 1035 kg/m³) jest większa od gęstości wody, a mniejsza od gęstości solanki (1100 kg/m³).'],
    scene: {
      world: { gravity: 9.81, air: 0 },
      fluids: [
        { id: 'slodka', x: 0.5, y: 0, w: 1.4, h: 1.4, layers: [{ liquid: 'water', height: 1 }] },
        { id: 'slona', x: 2.6, y: 0, w: 1.4, h: 1.4, layers: [{ liquid: 'saltwater', height: 1 }] }
      ],
      bodies: [
        { id: 'jajko1', label: 'jajko', shape: 'poly', points: [[0, -0.14], [0.08, -0.1], [0.1, 0], [0.08, 0.1], [0, 0.15], [-0.08, 0.1], [-0.1, 0], [-0.08, -0.1]], x: 1.2, y: 1.8, material: 'egg' },
        { id: 'jajko2', label: 'jajko', shape: 'poly', points: [[0, -0.14], [0.08, -0.1], [0.1, 0], [0.08, 0.1], [0, 0.15], [-0.08, 0.1], [-0.1, 0], [-0.08, -0.1]], x: 3.3, y: 1.8, material: 'egg' }
      ],
      show: { vectors: ['g', 'lift'], values: true },
      allow: { add: false, tools: ['probe'] },
      view: [0.1, -0.2, 4.4, 2.3],
      steps: [{ say: 'Wrzuć jajka.', do: 'play', wait: 4 }]
    }
  }
];

/** Eine leere Piaskownica: Boden, etwas Platz, alles erlaubt. */
export const SANDBOX_SCENE: Readonly<Record<string, unknown>> = {
  world: { gravity: 9.81, air: 1 },
  bodies: [
    { id: 'rampa', shape: 'poly', points: [[0, 0], [3, 0], [0, 1.4]], x: 0.3, y: 0, static: true, material: 'stone' },
    { id: 'pilka', shape: 'circle', r: 0.18, x: 0.7, y: 2, material: 'ball' }
  ],
  fluids: [{ id: 'basen', x: 5, y: 0, w: 2.6, h: 1.3, layers: [{ liquid: 'water', height: 0.8 }] }],
  show: { values: true },
  controls: ['air', 'gravity'],
  view: [-0.3, -0.3, 8.5, 4.5]
};
