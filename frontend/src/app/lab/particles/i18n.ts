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
  qualityVeryHigh: 'Bardzo wysoka (zalecana)',
  qualityHigh: 'Wysoka',
  qualityMedium: 'Średnia (słabszy komputer)',
  slow: 'Komputer nie nadąża: symulacja biegnie w tempie {x}× czasu rzeczywistego.',
  slowLower: 'Obniż jakość',
  slowLowest: 'To już najniższa jakość. Czas w symulacji płynie wolniej, ale wyniki są te same.',
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
  m1Note: 'Etap M1a: mechanika — ciecz i gaz, ścianki, napięcie powierzchniowe, wypór. Ciepło i wrzenie przyjdą w kolejnych etapach.',
  airNote: 'Powietrze z dala od wszystkiego liczy się bez cząstek: spokojne, o temperaturze pokoju (tło skrzynki). Cząstki powietrza są tylko w pobliżu cieczy i aparatury.',
  fullPower: 'Wszystkie rdzenie',
  fullPowerTitle: 'Otwórz laboratorium w nowej karcie — liczy na wszystkich rdzeniach procesora',
  fullPowerSlow: 'W nowej karcie laboratorium liczy na wszystkich rdzeniach:',
  threads: 'wątki',
  airParticles: 'powietrze',
  ambientAir: 'Powietrze otoczenia (bez cząstek)',
  pressure: 'Ciśnienie'
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
  appHotplate: 'Heizplatte',
  quality: 'Qualität (Auflösung)',
  qualityVeryHigh: 'Sehr hoch (empfohlen)',
  qualityHigh: 'Hoch',
  qualityMedium: 'Mittel (schwächerer Rechner)',
  slow: 'Der Rechner kommt nicht nach: die Simulation läuft mit {x}× Echtzeit.',
  slowLower: 'Qualität senken',
  slowLowest: 'Das ist schon die niedrigste Stufe. Die Zeit läuft langsamer, die Ergebnisse bleiben dieselben.',
  m1Note: 'Stufe M1a: Mechanik — Flüssigkeit und Gas, Wände, Oberflächenspannung, Auftrieb. Wärme und Sieden folgen.',
  airNote: 'Luft fern von allem wird ohne Teilchen gerechnet: ruhig, mit Raumtemperatur (der Hintergrund der Kiste). Luftteilchen gibt es nur nahe Flüssigkeit und Geräten.',
  fullPower: 'Alle Kerne',
  fullPowerTitle: 'Das Labor in einem neuen Tab öffnen — es rechnet auf allen Prozessorkernen',
  fullPowerSlow: 'In einem neuen Tab rechnet das Labor auf allen Kernen:',
  threads: 'Threads',
  airParticles: 'Luft',
  ambientAir: 'Umgebungsluft (ohne Teilchen)',
  pressure: 'Druck'
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
  appHotplate: 'Hot plate',
  quality: 'Quality (resolution)',
  qualityVeryHigh: 'Very high (recommended)',
  qualityHigh: 'High',
  qualityMedium: 'Medium (slower computer)',
  slow: 'This computer cannot keep up: the simulation runs at {x}× real time.',
  slowLower: 'Lower the quality',
  slowLowest: 'This is already the lowest level. Time runs slower, but the results stay the same.',
  m1Note: 'Stage M1a: mechanics — liquid and gas, walls, surface tension, buoyancy. Heat and boiling come next.',
  airNote: 'Air far from everything is computed without particles: still, at room temperature (the background of the box). Air particles exist only near liquids and apparatus.',
  fullPower: 'All cores',
  fullPowerTitle: 'Open the lab in a new tab — it computes on every processor core',
  fullPowerSlow: 'In a new tab the lab computes on every core:',
  threads: 'threads',
  airParticles: 'air',
  ambientAir: 'Ambient air (no particles)',
  pressure: 'Pressure'
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
