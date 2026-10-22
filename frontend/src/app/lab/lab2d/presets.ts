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

const plate = (power: number, T = 20) => ({ op: 'hotplate', x: 0.1, y: 0, w: 0.12, h: 0.008, material: 'steel', mode: 'power', power, target: 150, on: true, T });
const beaker = (T = 20, lid = false) => ({ op: 'beaker', x: 0.1, y: 0.008, w: 0.07, h: 0.08, wall: 0.002, material: 'glass', T, ...(lid ? { lid: true } : {}) });
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
        { op: 'hotplate', x: 0.05, y: 0, w: 0.08, h: 0.008, material: 'steel', mode: 'power', power: 30, target: 150, on: true, T: 140 },
        { op: 'hotplate', x: 0.15, y: 0, w: 0.08, h: 0.008, material: 'steel', mode: 'power', power: 30, target: 150, on: true, T: 140 },
        { op: 'beaker', x: 0.05, y: 0.008, w: 0.06, h: 0.07, wall: 0.002, material: 'glass', T: 105 },
        { op: 'beaker', x: 0.15, y: 0.008, w: 0.06, h: 0.07, wall: 0.002, material: 'glass', T: 105 },
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
    scene: { ...BASE, ops: [beaker(20), water(20), { op: 'hotplate', x: 0.08, y: 0.012, w: 0.012, h: 0.004, material: 'steel', mode: 'power', power: 6, target: 150, on: true, T: 20 }] }
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
    key: 'pusta-skrzynka',
    title: 'Pusta skrzynka',
    summary: 'skrzynka pełna powietrza — maluj wodę, stawiaj ścianki, zlewki i płyty grzejne',
    text: ['Skrzynka jest pełna powietrza. Maluj wodę, rysuj ścianki, stawiaj zlewki i płyty grzejne.'],
    scene: SANDBOX_LAB2D
  }
];
