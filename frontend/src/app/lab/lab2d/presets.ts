/**
 * LABOR 2D (v2) — FERTIGE ANFANGSAUFBAUTEN (Szenen als Daten, keine Skripte):
 * was wo steht und wie warm es ist. Was dann geschieht, rechnet die Engine.
 * Der erste Aufbau ist die Szene des Meilensteins 1: eine Zlewka mit Wasser
 * auf der Heizplatte (die Benchmark-Szene, documentation/lab2d/MILESTONES.md).
 */

import type { LabPreset } from '../LabEditor';

const BASE = {
  format: 'recreatio/lab2d',
  version: 1,
  seed: 1,
  box: { w: 0.2, h: 0.15, depth: 0.01 },
  ambient: { p: 101.325, T: 20, rh: 0.5, g: 9.81 },
  sides: { left: 'wall', right: 'wall', bottom: 'wall', top: 'open' },
  quality: 'high'
} as const;

/** Eine leere Kiste voll Luft (Piaskownica). */
export const SANDBOX_LAB2D: Readonly<Record<string, unknown>> = { ...BASE, ops: [] };

const plate = (power: number, T = 20) => ({ op: 'hotplate', id: 'plyta', x: 0.1, y: 0, w: 0.12, h: 0.008, material: 'steel', mode: 'power', power, target: 150, on: true, T });
const beaker = (T = 20, lid = false) => ({ op: 'beaker', id: 'zlewka', x: 0.1, y: 0.008, w: 0.07, h: 0.08, wall: 0.002, material: 'glass', T, ...(lid ? { lid: true } : {}) });
const water = (T: number) => ({ op: 'fill', region: { rect: [0.067, 0.010, 0.133, 0.06] }, composition: { H2O: 1 }, phase: 'liquid', T });
/** Eine Schicht einer Flüssigkeit in der Zlewka, von y0 bis y1 (M2a: jede Flüssigkeit der Datenbank). */
const layer = (composition: Record<string, number>, T: number, y0: number, y1: number) => ({ op: 'fill', region: { rect: [0.067, y0, 0.133, y1] }, composition, phase: 'liquid', T });
const chips = (T: number) => [
  { op: 'solid', region: { rect: [0.082, 0.010, 0.086, 0.012] }, material: 'ceramic', T },
  { op: 'solid', region: { rect: [0.112, 0.010, 0.116, 0.012] }, material: 'ceramic', T }
];

export const BOILING_SCENE: Readonly<Record<string, unknown>> = { ...BASE, ops: [plate(40), beaker(), water(20), ...chips(20)] };

export const LAB2D_PRESETS: readonly LabPreset[] = [
  {
    key: 'zlewka-na-plycie',
    title: 'Zlewka z wodą na płycie grzejnej',
    summary: 'scena wrzenia: woda (20 °C) w szklanej zlewce z kamyczkami wrzennymi na stalowej płycie grzejnej',
    text: [
      'W zlewce jest woda o temperaturze pokojowej, pod nią płyta grzejna o mocy 40 W. Obserwuj, jak najpierw nagrzewa się płyta, potem szkło, potem woda.',
      'Przy dnie pojawią się pęcherze. Dopóki woda jest chłodna, znikają, zanim dopłyną do powierzchni. Wykres „Temperatura wody” pokaże plateau przy temperaturze wrzenia.'
    ],
    scene: BOILING_SCENE
  },
  {
    key: 'wrzenie',
    title: 'Wrzenie z kamyczkami',
    summary: 'woda tuż przed wrzeniem (98 °C) na gorącej płycie — od razu widać wrzenie pęcherzykowe',
    text: [
      'Woda ma 98 °C, płyta jest gorąca. Kamyczki wrzenne mają wiele wgłębień, w których rodzą się pęcherze — woda wrze spokojnie, bez przegrzania.',
      'Zbadaj pęcherz narzędziem „Badaj”: wypór jest setki razy większy od jego ciężaru.'
    ],
    scene: { ...BASE, ops: [plate(40, 140), beaker(105), water(98), ...chips(98)] }
  },
  {
    key: 'szybkowar',
    title: 'Szybkowar — zamknięta skrzynka',
    summary: 'ta sama zlewka, ale skrzynka jest zamknięta: ciśnienie rośnie, a woda wrze w wyższej temperaturze',
    text: [
      'Skrzynka jest szczelnie zamknięta. Gdy woda paruje, para nie ma ujścia — ciśnienie rośnie i temperatura wrzenia też.',
      'Porównaj temperaturę wrzenia w inspektorze z otwartą skrzynką.'
    ],
    scene: { ...BASE, sides: { left: 'wall', right: 'wall', bottom: 'wall', top: 'wall' }, ops: [plate(40, 120), beaker(100), water(97), ...chips(97)] }
  },
  {
    key: 'woda-pod-olejem',
    title: 'Woda pod olejem',
    summary: 'gorąca woda (97 °C) pod warstwą oleju na gorącej płycie — pęcherze pary przebijają się przez olej',
    text: [
      'Olej jest lżejszy od wody i nie miesza się z nią, więc pływa na wierzchu. Pod nim woda zaczyna wrzeć.',
      'Pęcherze pary rodzą się tylko w wodzie i przechodzą przez olej — sam olej nie paruje (aż do temperatury dymienia, ok. 200 °C).'
    ],
    scene: { ...BASE, ops: [plate(40, 140), beaker(105), layer({ H2O: 1 }, 97, 0.010, 0.040), layer({ 'oil-rapeseed': 1 }, 97, 0.040, 0.060), ...chips(97)] }
  },
  {
    key: 'olej-i-woda',
    title: 'Olej i woda się rozdzielają',
    summary: 'woda i olej wymieszane pół na pół — grawitacja je rozdziela: olej wypływa na górę',
    text: [
      'W zlewce jest drobna mieszanina wody i oleju. Olej jest lżejszy (920 kg/m³), więc jego kropelki wypływają do góry, a woda opada.',
      'Olej płynie też dużo „gęściej”: w 20 °C jego lepkość jest prawie sto razy większa niż wody — dlatego rozdzielanie trwa.'
    ],
    scene: { ...BASE, ops: [beaker(), layer({ H2O: 0.5, 'oil-rapeseed': 0.5 }, 20, 0.010, 0.060)] }
  },
  {
    key: 'solanka-wrze-pozniej',
    title: 'Solanka wrze później',
    summary: 'dwie zlewki na dwóch płytach: po lewej woda, po prawej solanka (15 % soli) — solanka wrze w wyższej temperaturze',
    text: [
      'Po lewej czysta woda, po prawej solanka z 15 % soli; obie mają 97 °C i stoją na takich samych płytach.',
      'Woda zaczyna wrzeć przy 100 °C, solanka dopiero przy ok. 103 °C. Zbadaj obie narzędziem „Badaj”: inspektor pokazuje, w jakiej temperaturze wrze ciecz w danym miejscu.',
      'Sól nie paruje: gdy woda ucieka jako para, solanka robi się coraz bardziej słona (nakładka „Stężenie soli”).'
    ],
    scene: {
      ...BASE,
      ops: [
        { op: 'hotplate', id: 'plyta-lewa', x: 0.05, y: 0, w: 0.08, h: 0.008, material: 'steel', mode: 'power', power: 30, target: 150, on: true, T: 140 },
        { op: 'hotplate', id: 'plyta-prawa', x: 0.15, y: 0, w: 0.08, h: 0.008, material: 'steel', mode: 'power', power: 30, target: 150, on: true, T: 140 },
        { op: 'beaker', id: 'zlewka-lewa', x: 0.05, y: 0.008, w: 0.06, h: 0.07, wall: 0.002, material: 'glass', T: 105 },
        { op: 'beaker', id: 'zlewka-prawa', x: 0.15, y: 0.008, w: 0.06, h: 0.07, wall: 0.002, material: 'glass', T: 105 },
        { op: 'fill', region: { rect: [0.022, 0.010, 0.078, 0.05] }, composition: { H2O: 1 }, phase: 'liquid', T: 97 },
        { op: 'fill', region: { rect: [0.122, 0.010, 0.178, 0.05] }, composition: { H2O: 0.85, NaCl: 0.15 }, phase: 'liquid', T: 97 },
        { op: 'solid', region: { rect: [0.036, 0.010, 0.040, 0.012] }, material: 'ceramic', T: 97 },
        { op: 'solid', region: { rect: [0.136, 0.010, 0.140, 0.012] }, material: 'ceramic', T: 97 }
      ]
    }
  },
  {
    key: 'odparowanie-solanki',
    title: 'Odparowanie solanki',
    summary: 'cienka warstwa prawie nasyconej solanki (25 %) na płycie o 250 °C — woda wyparowuje, na dnie zostaje biały osad soli',
    text: [
      'W zlewce jest cienka warstwa solanki z 25 % soli — prawie tyle, ile woda może rozpuścić. Termostat trzyma płytę w 250 °C.',
      'Woda wrze i paruje, sól zostaje. Gdy roztwór jest nasycony, nadmiar soli krystalizuje i osiada na dnie jako biały osad — aż cała woda zniknie.',
      'W panelu deweloperskim bilans „NaCl” pokazuje, że żadna sól nie ginie: cała trafia do osadu.'
    ],
    scene: { ...BASE, ops: [{ ...plate(150, 180), mode: 'thermostat', target: 250 }, beaker(115), layer({ H2O: 0.75, NaCl: 0.25 }, 105, 0.010, 0.015)] }
  },
  {
    key: 'mgla',
    title: 'Mgła nad gorącą wodą',
    summary: 'gorąca woda (90 °C) w chłodnym, wilgotnym pokoju — nad zlewką tworzy się mgła',
    text: [
      'Woda w zlewce jest gorąca, pokój chłodny. Para wodna jest niewidoczna — biała mgła powstaje dopiero tam, gdzie wilgotne powietrze się ochładza.',
      'Włącz nakładkę „Para wodna”, żeby zobaczyć niewidoczną parę obok widocznej mgły.'
    ],
    scene: { ...BASE, ambient: { p: 101.325, T: 10, rh: 0.8, g: 9.81 }, ops: [plate(15, 90), beaker(90), water(90)] }
  },
  {
    key: 'wysoka-gora',
    title: 'Wrzenie w górach',
    summary: 'ta sama zlewka przy ciśnieniu 70 kPa (ok. 3000 m n.p.m.) — woda wrze już w ok. 90 °C',
    text: [
      'Wysoko w górach ciśnienie powietrza jest niższe: tutaj 70 kPa zamiast 101 kPa. Woda wrze wtedy w niższej temperaturze — ok. 90 °C.',
      'Zbadaj wodę narzędziem „Badaj”: inspektor pokazuje temperaturę wrzenia w danym miejscu. Porównaj z „Wrzeniem z kamyczkami”.'
    ],
    scene: { ...BASE, ambient: { p: 70, T: 15, rh: 0.4, g: 9.81 }, ops: [plate(40, 130), beaker(95), water(88), ...chips(88)] }
  },
  {
    key: 'konwekcja',
    title: 'Konwekcja nad grzałką',
    summary: 'mała grzałka w zimnej wodzie — ciepła woda unosi się, chłodna opada i powstaje wir',
    text: [
      'W zimnej wodzie, przy dnie po lewej, leży mała grzałka (6 W). Ogrzana woda jest lżejsza i unosi się nad nią, chłodniejsza opada po drugiej stronie — powstaje wir.',
      'Włącz nakładkę „Temperatura”, a potem „Prędkość” (białe strzałki pokazują, jak płynie woda).'
    ],
    scene: { ...BASE, ops: [beaker(20), water(20), { op: 'hotplate', id: 'grzalka', x: 0.08, y: 0.012, w: 0.012, h: 0.004, material: 'steel', mode: 'power', power: 6, target: 150, on: true, T: 20 }] }
  },
  {
    key: 'solanka-pod-woda',
    title: 'Solanka pod słodką wodą',
    summary: 'warstwa solanki (20 %) pod słodką wodą, płyta grzeje od dołu — warstwy się nie mieszają',
    text: [
      'Na dnie zlewki leży solanka z 20 % soli, nad nią słodka woda. Płyta grzeje od dołu: solanka krąży i się nagrzewa, ale zostaje na dnie — nawet ciepła jest cięższa od wody nad nią.',
      'Nakładka „Stężenie soli” pokazuje, że granica zostaje ostra (sól przechodzi przez nią tylko dyfuzją, milimetry na godzinę). Nakładka „Temperatura” pokazuje, że ciepło przechodzi przez granicę dużo szybciej.'
    ],
    scene: { ...BASE, ops: [plate(15), beaker(), layer({ H2O: 0.8, NaCl: 0.2 }, 20, 0.010, 0.030), layer({ H2O: 1 }, 20, 0.030, 0.060)] }
  },
  {
    key: 'co-plywa',
    title: 'Co pływa?',
    summary: 'klocek drewna, kostka lodu i kamień wpadają do zimnej wody — drewno pływa, lód prawie cały zanurzony, kamień tonie',
    text: [
      'Nad wodą wiszą trzy ciała: klocek sosnowy, kostka lodu i kamień (granit). Puść czas — spadną do wody.',
      'Drewno (510 kg/m³) zanurza się do połowy, lód (917 kg/m³) prawie cały, a kamień (2630 kg/m³) idzie na dno. Pływające ciało wypiera tyle wody, ile samo waży — zbadaj je narzędziem „Badaj”.',
      'Woda ma 2 °C, więc lód topi się powoli: zostaje prostokątem, który z czasem robi się mniejszy. Kliknij przedmiot narzędziem „Wybierz”: w panelu „Przedmiot” zaznacz „Przypięty”, a zostanie tam, gdzie wisi.'
    ],
    scene: {
      ...BASE,
      ambient: { p: 101.325, T: 15, rh: 0.5, g: 9.81 },
      ops: [
        { op: 'fill', region: { rect: [0, 0, 0.2, 0.07] }, composition: { H2O: 1 }, phase: 'liquid', T: 2 },
        { op: 'body', id: 'drewno', region: { rect: [0.025, 0.085, 0.065, 0.105] }, material: 'wood', T: 15 },
        { op: 'body', id: 'lod', region: { rect: [0.09, 0.085, 0.11, 0.105] }, material: 'ice', T: -2 },
        { op: 'body', id: 'kamien', region: { rect: [0.14, 0.085, 0.16, 0.1] }, material: 'stone', T: 15 }
      ]
    }
  },
  {
    key: 'lod-w-wodzie',
    title: 'Lód w ciepłej wodzie',
    summary: 'kostka lodu (−10 °C) pływa w wodzie o temperaturze 40 °C i topi się — zostaje prostokątem, a w jej miejscu pojawia się woda',
    text: [
      'Kostka lodu (3 cm, −10 °C) pływa w wodzie o temperaturze 40 °C — prawie cała pod wodą. Topi się od wszystkich stron naraz: zostaje prostokątem, który robi się coraz mniejszy, a w jej miejscu pojawia się woda.',
      'Nakładka „Temperatura” pokazuje zimną wodę z topniejącego lodu: spływa w dół, bo zimna woda jest cięższa od ciepłej. Bilans energii zostaje zamknięty — ciepło wody idzie na stopienie lodu: 334 J na każdy gram.'
    ],
    scene: {
      ...BASE,
      ops: [
        { op: 'fill', region: { rect: [0, 0, 0.2, 0.07] }, composition: { H2O: 1 }, phase: 'liquid', T: 40 },
        { op: 'body', id: 'kostka', region: { rect: [0.085, 0.0425, 0.115, 0.0725] }, material: 'ice', T: -10 }
      ]
    }
  },
  {
    key: 'lod-z-sola',
    title: 'Lód z solą — mieszanina chłodząca',
    summary: 'trzy kostki lodu pływają w mocnej solance (23 %) — lód topi się poniżej 0 °C i ochładza solankę daleko pod zero',
    text: [
      'W solance z 23 % soli pływają trzy kostki lodu. Sól obniża temperaturę topnienia lodu: w takiej solance lód topi się jeszcze przy −20 °C i zabiera jej ciepło, więc solanka ochładza się daleko poniżej 0 °C. To mieszanina chłodząca — dawniej robiono w niej lody.',
      'Woda z topniejącego lodu rozcieńcza solankę, a słabsza solanka zamarza w wyższej temperaturze: mieszanina zatrzymuje się na temperaturze zamarzania swojej solanki i nigdy nie zejdzie poniżej eutektyku (−21,2 °C). Narzędzie „Badaj” pokazuje temperaturę zamarzania solanki w danym miejscu.'
    ],
    scene: {
      ...BASE,
      box: { w: 0.1, h: 0.08, depth: 0.01 },
      ops: [
        { op: 'fill', region: { rect: [0, 0, 0.1, 0.04] }, composition: { H2O: 0.77, NaCl: 0.23 }, phase: 'liquid', T: 0 },
        { op: 'body', id: 'kostka-1', region: { rect: [0.012, 0.024, 0.032, 0.044] }, material: 'ice', T: -5 },
        { op: 'body', id: 'kostka-2', region: { rect: [0.04, 0.024, 0.06, 0.044] }, material: 'ice', T: -5 },
        { op: 'body', id: 'kostka-3', region: { rect: [0.068, 0.024, 0.088, 0.044] }, material: 'ice', T: -5 }
      ]
    }
  },
  {
    key: 'przewrocona-zlewka',
    title: 'Przewrócona zlewka',
    summary: 'zlewka z wodą stoi na krawędzi kamiennego stopnia, za daleko — przewraca się, a woda się wylewa',
    text: [
      'Zlewka z wodą (swobodna, nie przypięta) stoi na krawędzi stopnia tak, że jej środek ciężkości jest już poza krawędzią. Puść czas — zlewka obróci się wokół krawędzi i spadnie, a woda się wyleje.',
      'Narzędziem „Wybierz” kliknij zlewkę: w panelu „Przedmiot” zaznacz „Przypięty”, a zlewka zostanie w miejscu. Przeciągnij ją bliżej ściany stopnia i odznacz „Przypięty” — jeśli jej środek ciężkości jest nad stopniem, zostanie.'
    ],
    scene: {
      ...BASE,
      box: { w: 0.24, h: 0.15, depth: 0.01 },
      ops: [
        { op: 'solid', region: { rect: [0, 0, 0.1, 0.03] }, material: 'stone', T: 20 },
        { op: 'beaker', id: 'zlewka', x: 0.11, y: 0.03, w: 0.07, h: 0.08, wall: 0.002, material: 'glass', T: 20, pinned: false },
        { op: 'fill', region: { rect: [0.077, 0.032, 0.143, 0.07] }, composition: { H2O: 1 }, phase: 'liquid', T: 20 }
      ]
    }
  },
  {
    key: 'pusta-skrzynka',
    title: 'Pusta skrzynka',
    summary: 'skrzynka pełna powietrza — maluj wodę, rysuj ścianki, dodawaj przedmioty: kostki lodu, klocki, zlewki, płyty grzejne',
    text: ['Skrzynka jest pełna powietrza. Maluj wodę, rysuj ścianki i dodawaj przedmioty (kostkę lodu, klocek drewna, kamień, zlewkę, płytę grzejną) — swobodne spadają, pływają albo toną, lód się topi. Kliknij przedmiot narzędziem „Wybierz”, by zmienić jego ustawienia, np. „Przypięty” — wtedy nie spada.'],
    scene: SANDBOX_LAB2D
  }
];
