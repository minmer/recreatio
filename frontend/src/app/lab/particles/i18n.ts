/**
 * PARTIKEL-LABOR — ALLE TEXTE DER OBERFLÄCHE: Polnisch zuerst, Deutsch und
 * Englisch daneben (was fehlt, kommt aus dem Polnischen). Die Engine selbst
 * hat keine Texte; Stoffnamen stehen in der Datenbank (`species.json`).
 */

export type Lang = 'pl' | 'de' | 'en';

const PL = {
  title: 'Laboratorium cząstek',
  loading: 'Uruchamianie silnika…',
  play: 'Start',
  pause: 'Pauza',
  step: 'Jeden krok',
  speed: 'Tempo czasu',
  hud: 'Panel deweloperski',
  tools: 'Narzędzia',
  materials: 'Materiały',
  apparatus: 'Aparatura',
  settings: 'Ustawienia',
  inspect: 'Badanie',
  toolPaint: 'Maluj',
  toolErase: 'Gumka',
  toolPlace: 'Umieść',
  toolWall: 'Ściana',
  toolInspect: 'Badaj',
  matWater: 'Woda',
  matAir: 'Powietrze',
  matGlass: 'Szkło',
  matSteel: 'Stal',
  matChips: 'Kamyczki wrzenne',
  appBeaker: 'Zlewka',
  appHotplate: 'Płyta grzejna',
  brush: 'Pędzel',
  temperature: 'Temperatura malowania',
  quality: 'Jakość (rozdzielczość)',
  qualityLow: 'Niska',
  qualityMedium: 'Średnia',
  qualityHigh: 'Wysoka',
  showAir: 'Pokaż cząstki powietrza',
  restart: 'Od nowa',
  emptyBox: 'Pusta skrzynka',
  hintPaint: 'Przeciągnij po skrzynce, żeby malować wybranym materiałem.',
  hintErase: 'Przeciągnij, żeby usunąć — w puste miejsce wraca powietrze.',
  hintPlace: 'Kliknij, gdzie ma stanąć wybrana aparatura (dół w miejscu kliknięcia).',
  hintWall: 'Przeciągnij od początku do końca ściany.',
  hintInspect: 'Kliknij cząstkę, żeby zobaczyć jej dane.',
  nothingHere: 'Tu nie ma cząstki.',
  phase: 'Faza',
  phaseSolid: 'ciało stałe',
  phaseLiquid: 'ciecz',
  phaseGas: 'gaz',
  fixed: 'nieruchoma (ściana, aparatura)',
  heater: 'element grzejny',
  temp: 'Temperatura',
  mass: 'Masa',
  velocity: 'Prędkość',
  density: 'Gęstość',
  enthalpy: 'Entalpia właściwa',
  neighbours: 'Sąsiedzi',
  composition: 'Skład',
  particles: 'cząstek',
  liquid: 'ciecz',
  gas: 'gaz',
  solidFixed: 'nieruchome',
  stepsPerSecond: 'kroków/s',
  simRate: 'tempo symulacji',
  fps: 'klatek/s',
  renderWorker: 'rysuje wątek roboczy',
  renderMain: 'rysuje strona',
  m0Note: 'Etap M0: szkielet silnika. Cząstki na razie tylko się nie przenikają — prawdziwa ciecz, ciepło i wrzenie przyjdą w kolejnych etapach.'
} as const;

export type TextKey = keyof typeof PL;

const DE: Partial<Record<TextKey, string>> = {
  title: 'Teilchenlabor',
  loading: 'Engine startet…',
  play: 'Start',
  pause: 'Pause',
  step: 'Ein Schritt',
  speed: 'Zeitraffer',
  tools: 'Werkzeuge',
  materials: 'Stoffe',
  apparatus: 'Geräte',
  settings: 'Einstellungen',
  inspect: 'Untersuchen',
  toolPaint: 'Malen',
  toolErase: 'Radieren',
  toolPlace: 'Stellen',
  toolWall: 'Wand',
  toolInspect: 'Untersuchen',
  matWater: 'Wasser',
  matAir: 'Luft',
  matGlass: 'Glas',
  matSteel: 'Stahl',
  matChips: 'Siedesteine',
  appBeaker: 'Becherglas',
  appHotplate: 'Heizplatte'
};

const EN: Partial<Record<TextKey, string>> = {
  title: 'Particle lab',
  loading: 'Starting the engine…',
  play: 'Play',
  pause: 'Pause',
  step: 'One step',
  speed: 'Time speed',
  tools: 'Tools',
  materials: 'Materials',
  apparatus: 'Apparatus',
  settings: 'Settings',
  inspect: 'Inspect',
  toolPaint: 'Paint',
  toolErase: 'Erase',
  toolPlace: 'Place',
  toolWall: 'Wall',
  toolInspect: 'Inspect',
  matWater: 'Water',
  matAir: 'Air',
  matGlass: 'Glass',
  matSteel: 'Steel',
  matChips: 'Boiling chips',
  appBeaker: 'Beaker',
  appHotplate: 'Hot plate'
};

const TABLES: Readonly<Record<Lang, Partial<Record<TextKey, string>>>> = { pl: PL, de: DE, en: EN };

/** Die Sprache der Seite (`<html lang>`), sonst Polnisch. */
export function pageLang(): Lang {
  const l = typeof document === 'undefined' ? 'pl' : document.documentElement.lang.slice(0, 2);
  return l === 'de' || l === 'en' ? l : 'pl';
}

export function t(key: TextKey, lang: Lang = pageLang()): string {
  return TABLES[lang][key] ?? PL[key];
}

/** Eine Zahl auf polnische (deutsche) Art: Komma statt Punkt. */
export function num(x: number, digits = 1, lang: Lang = pageLang()): string {
  const s = x.toFixed(digits);
  return lang === 'en' ? s : s.replace('.', ',');
}
