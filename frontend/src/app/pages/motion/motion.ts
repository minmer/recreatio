/**
 * 0107/0108 — DIE BEWEGUNGEN: ein Wörterbuch dessen, was sich auf einer Seite
 * bewegen kann — als DATEN, nicht als Stilblatt, und aus wenigen Grundwörtern.
 *
 * <b>Die Grundwörter</b> sagen, WAS sich ändert:
 *
 * <code>
 *   move     der Ort — zu einem Punkt, oder einen Weg aus Punkten entlang
 *   size     die Grösse
 *   turn     die Drehung
 *   fade     die Deckkraft
 *   draw     wie viel einer Linie gezeichnet ist
 *   color    die Farbe (Füllung, Schrift)
 *   reveal   wie viel von links her zu sehen ist (eine Blende)
 *   keys     alles zugleich, Bild für Bild: { "at": 0.4, "x": …, "y": …, "scale": …, "rotate": …, "opacity": … }
 * </code>
 *
 * <b>Die Vorlagen</b> (aus dem Altbestand von Cogita, `cogita-intro.css`,
 * `cogita.css`) sind fertige Sätze aus denselben Wörtern: `rise` (der Text
 * steigt nach dem Wechsel auf), `assemble` (die Buchstaben des Zeichens setzen
 * sich), `float` (die Blasen schweben), `breathe`, `glow`, `drift`, `sway`,
 * `wave`, `blink`, `focus`. Jede hat Regler mit den Werten von dort.
 *
 * <b>Eine Bewegung an einem Ding</b> sagt dazu, WANN und WIE OFT:
 *
 * <code>
 *   { "name": "move", "path": [[0, 0], [40, -12]], "duration": 900, "delay": 120, "repeat": "loop", "ease": "inOut" }
 *   { "name": "keys", "keys": [{ "at": 0, "opacity": 0 }, { "at": 0.12, "opacity": 1 }], "duration": 10000, "repeat": "loop" }
 * </code>
 *
 * `repeat`: `once` spielt, wenn das Ding erreicht ist (und wieder, wenn man
 * zurückkommt) — vorher steht es im ersten Bild; `loop` und `alternate` laufen,
 * solange es zu sehen ist. Der WECHSEL von Slajdy und Szenen folgt weiter der
 * Bahn (`slideMotion.ts`, `presentationMotion.ts`); was hier steht, ist ein
 * Auftritt nach der Uhr.
 *
 * <b>Dieselben Wörter überall:</b> an einem Baustein auf einem Slajd oder in
 * einer Szene (`MotionBox.tsx`), an einer Ebene eines Bildes aus Schichten,
 * an einer Schicht der Luft, und an jedem Teil einer Zeichnung („Animacja",
 * `drawing.ts`) — dort ist ein Pixel eine Einheit der Zeichnung.
 *
 * <b>Rein und ohne Oberfläche</b> — die Bilder für die Web Animations API
 * entstehen hier (`keyframesOf`, `timingOf`). Geprüft in `app-motion-check`.
 */

export type MotionKind = 'enter' | 'loop';
export type Repeat = 'once' | 'loop' | 'alternate' | number;

/**
 * EIN WERT IN EINEM BILD einer Vorlage: eine Zahl, oder eine kleine Summe aus
 * Zahlen und Reglern: `'y'`, `'-shift'`, `'x0 + 0.6*x'`, `'1 - 0.7*stretch'`.
 */
export type Amount = number | string;

/** Ein Bild einer Vorlage (mit Reglern). */
export interface MotionFrame {
  readonly at: number;
  readonly opacity?: Amount;
  readonly x?: Amount;
  readonly y?: Amount;
  readonly scale?: Amount;
  readonly scaleY?: Amount;
  readonly rotate?: Amount;
  readonly blur?: Amount;
  readonly draw?: Amount;
}

/**
 * EIN BILD, wie es jede Bewegung am Ende ist: an der Stelle `at` (0–1) — Ort
 * (`x`, `y`, in Pixeln oder Einheiten der Zeichnung), Grösse (`scale`, oder
 * `sx`, `sy`), Drehung (Grad), Deckkraft, Unschärfe (px), wie viel gezeichnet
 * ist (`draw` 0–1), Farbe (`color` Füllung/Schrift, `stroke` Linie), ein
 * Schein (`glow` — ein Schatten: „0 0 8px rgba(…)"), wie viel von links zu
 * sehen ist (`reveal` 0–1), ein Ausschnitt (`clip` — „inset(…)"), und wie es
 * zum nächsten Bild geht (`ease`).
 */
export interface Key {
  readonly at: number;
  readonly x?: number;
  readonly y?: number;
  readonly scale?: number;
  readonly sx?: number;
  readonly sy?: number;
  readonly rotate?: number;
  readonly opacity?: number;
  readonly blur?: number;
  readonly draw?: number;
  readonly color?: string;
  readonly stroke?: string;
  readonly glow?: string;
  readonly reveal?: number;
  readonly clip?: string;
  readonly ease?: string;
}

export interface MotionParam {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
}

/** Ein Wort des Wörterbuchs: ein Grundwort (`verb`) oder eine Vorlage aus dem Altbestand. */
export interface MotionDef {
  readonly name: string;
  readonly verb: boolean;
  /** Ohne `repeat`: einmal (`enter`) oder fortlaufend (`loop`). */
  readonly kind: MotionKind;
  readonly label: string;
  readonly says: string;
  readonly duration: number;
  readonly delay: number;
  readonly easing: string;
  readonly alternate: boolean;
  /** Einheit der Verschiebung: Pixel (Einheiten der Zeichnung), oder Prozent der eigenen Grösse. */
  readonly unit: 'px' | '%';
  readonly params: Readonly<Record<string, MotionParam>>;
  /** Die Bilder einer Vorlage; ein Grundwort baut seine aus `from`, `to`, `path`, `keys`. */
  readonly frames: readonly MotionFrame[];
  readonly legacy: string | null;
}

const param = (label: string, value: number, min: number, max: number): MotionParam => ({ label, value, min, max });

/** Ein Grundwort — seine Bilder entstehen aus dem, was an ihm steht (`keysOf`). */
const verb = (name: string, label: string, says: string, duration: number, easing: string, kind: MotionKind = 'enter', params: Record<string, MotionParam> = {}): MotionDef => ({
  name, verb: true, kind, label, says, duration, delay: 0, easing, alternate: false, unit: 'px', params, frames: [], legacy: null
});

/**
 * DAS WÖRTERBUCH. Erst die Grundwörter, dann die Vorlagen des Altbestands —
 * jede Zahl dort ist die von dort; was dort pro Ding verschieden war (jede
 * Blase, jede Fadenschicht), ist hier ein Regler mit der Vorgabe von dort.
 */
export const MOTIONS: readonly MotionDef[] = [
  verb('move', 'Przesuwa się', 'zmienia miejsce: "to": [x, y] — do punktu (od "from", zwykle [0, 0]), albo "path": [[x, y], …] — drogą przez punkty ("times": kiedy w każdym, 0–1)', 800, 'ease-in-out'),
  verb('size', 'Zmienia wielkość', 'rośnie albo maleje: "from" → "to" (1 — jak jest; liczba albo [szerokość, wysokość])', 600, 'ease-in-out'),
  verb('turn', 'Obraca się', 'obraca się: "from" → "to" w stopniach (360 — pełny obrót)', 1200, 'linear'),
  {
    name: 'fade', verb: true, kind: 'enter', label: 'Rozjaśnia się',
    says: 'zmienia krycie: "from" → "to" (0 — niewidoczny, 1 — cały; zwykle 0 → 1)',
    duration: 600, delay: 0, easing: 'ease', alternate: false, unit: 'px', params: {}, frames: [], legacy: null
  },
  {
    name: 'draw', verb: true, kind: 'enter', label: 'Rysuje się',
    says: 'linia rysuje się od początku do końca: "from" → "to" (0 — nic, 1 — cała; mniej niż 0 — jeszcze chwilę nic, więcej niż 1 (do 10) — gotowa przed końcem ruchu)',
    duration: 1800, delay: 0, easing: 'ease', alternate: false, unit: 'px',
    params: { length: param('Długość kreski (poza rysunkiem)', 1, 0.01, 20000) }, frames: [],
    legacy: 'cogita-intro.css: cogita-shield-draw — 1,8 s (kreska 420 przy obrysie 318: "to": 1.32, przy haczyku 50: "to": 8.45)'
  },
  verb('color', 'Zmienia kolor', 'zmienia kolor wypełnienia (napisu): "from" → "to"', 600, 'ease'),
  verb('reveal', 'Odsłania się', 'odsłania się od lewej: "from" → "to" (0 — nic, 1 — całość)', 800, 'linear'),
  verb('keys', 'Klatki', 'wszystko naraz, klatka po klatce: "keys": [{ "at": 0–1, "x", "y", "scale", "sx", "sy", "rotate", "opacity", "blur", "draw", "color", "stroke", "glow", "reveal", "clip", "ease" }]', 1000, 'ease'),
  {
    name: 'rise', verb: false, kind: 'enter', label: 'Wynurza się',
    says: 'pojawia się, unosząc się o kilka pikseli — tekst slajdu po dotarciu',
    duration: 520, delay: 220, easing: 'ease', alternate: false, unit: 'px',
    params: { y: param('Skąd (px niżej)', 10, -400, 400) },
    frames: [{ at: 0, opacity: 0, y: 'y' }, { at: 1, opacity: 1, y: 0 }],
    legacy: 'cogita-intro.css: cogita-text-delayed — 520 ms po 220 ms (na slajdzie mapy po 1000 ms)'
  },
  {
    name: 'assemble', verb: false, kind: 'enter', label: 'Składa się',
    says: 'warstwa pojawia się, lekko uniesiona i pomniejszona; kolejne z rosnącym opóźnieniem składają znak',
    duration: 620, delay: 0, easing: 'ease', alternate: false, unit: 'px',
    params: { y: param('Skąd (px niżej)', 8, -400, 400), scale: param('Skala na początku', 0.985, 0.2, 3) },
    frames: [{ at: 0, opacity: 0, y: 'y', scale: 'scale' }, { at: 1, opacity: 1, y: 0, scale: 1 }],
    legacy: 'cogita-intro.css: cogita-logo-stagger — 620 ms; litery po 0, 90, 180, 260, 340, 420 ms, „REcreatio” po 520 i 620 ms'
  },
  {
    name: 'focus', verb: false, kind: 'enter', label: 'Wyostrza się',
    says: 'z lekkiego rozmycia i z dołu do ostrości',
    duration: 480, delay: 0, easing: 'ease', alternate: false, unit: 'px',
    params: { y: param('Skąd (px niżej)', 12, -400, 400), blur: param('Rozmycie (px)', 2, 0, 40) },
    frames: [{ at: 0, opacity: 0, y: 'y', blur: 'blur' }, { at: 1, opacity: 1, y: 0, blur: 0 }],
    legacy: 'cogita-intro.css: .cogita-intro-slide — zmiana slajdu: krycie, 12 px, rozmycie 2 px w 480 ms'
  },
  {
    name: 'float', verb: false, kind: 'loop', label: 'Unosi się',
    says: 'kołysze się łagodnie o kilka pikseli i wraca',
    duration: 3800, delay: 0, easing: 'ease-in-out', alternate: false, unit: 'px',
    params: { x: param('W bok (px)', 4, -200, 200), y: param('W pionie (px)', 6, -200, 200) },
    frames: [{ at: 0, x: 0, y: 0 }, { at: 0.5, x: 'x', y: 'y' }, { at: 1, x: 0, y: 0 }],
    legacy: 'cogita-intro.css: cogita-bubble-wave — bańki logo, 3,4–4,8 s, każda o inny wektor'
  },
  {
    name: 'breathe', verb: false, kind: 'loop', label: 'Oddycha',
    says: 'rośnie i jaśnieje, maleje i blednie',
    duration: 2600, delay: 0, easing: 'ease-in-out', alternate: false, unit: 'px',
    params: { low: param('Najmniejsza skala', 0.92, 0.1, 3), high: param('Największa skala', 1.12, 0.1, 3), dim: param('Najmniejsze krycie', 0.55, 0, 1) },
    frames: [{ at: 0, opacity: 'dim', scale: 'low' }, { at: 0.5, opacity: 1, scale: 'high' }, { at: 1, opacity: 'dim', scale: 'low' }],
    legacy: 'cogita-intro.css: round-player-breathe — gracze rundy, 2,6 s'
  },
  {
    name: 'glow', verb: false, kind: 'loop', label: 'Pulsuje blaskiem',
    says: 'poświata rośnie i przygasa',
    duration: 2200, delay: 0, easing: 'ease-in-out', alternate: false, unit: 'px',
    params: { low: param('Najmniejsza skala', 0.95, 0.1, 3), high: param('Największa skala', 1.05, 0.1, 3), dim: param('Najmniejsze krycie', 0.2, 0, 1), bright: param('Największe krycie', 0.5, 0, 1) },
    frames: [{ at: 0, opacity: 'dim', scale: 'low' }, { at: 0.5, opacity: 'bright', scale: 'high' }, { at: 1, opacity: 'dim', scale: 'low' }],
    legacy: 'cogita-intro.css: cogita-shield-glow — 2,2 s'
  },
  {
    name: 'drift', verb: false, kind: 'loop', label: 'Dryfuje',
    says: 'przesuwa się powoli po skosie i rośnie, potem wraca — tło, mgła',
    duration: 18000, delay: 0, easing: 'ease-in-out', alternate: true, unit: '%',
    params: { shift: param('Przesunięcie (%)', 1, -50, 50), from: param('Skala na początku', 1.02, 0.1, 3), to: param('Skala na końcu', 1.08, 0.1, 3) },
    frames: [{ at: 0, x: '-shift', y: '-shift', scale: 'from' }, { at: 1, x: 'shift', y: 'shift', scale: 'to' }],
    legacy: 'cogita.css: cogita-depth — 18 s tam i z powrotem'
  },
  {
    name: 'sway', verb: false, kind: 'loop', label: 'Faluje',
    says: 'bardzo wolno faluje w górę i w dół, rozciągając się w pionie — nici tła',
    duration: 240000, delay: 0, easing: 'ease-in-out', alternate: false, unit: '%',
    params: {
      x: param('W bok (%)', 3, -50, 50), y: param('W pionie (%)', 6, -50, 50), stretch: param('Rozciągnięcie', 0.1, 0, 1),
      x0: param('Spoczynek w bok (%)', 0, -50, 50), y0: param('Spoczynek w pionie (%)', 0, -50, 50)
    },
    frames: [
      { at: 0, x: 'x0', y: 'y0', scaleY: 1 },
      { at: 0.14, x: 'x0 + x', y: 'y0 + y', scaleY: '1 + stretch' },
      { at: 0.29, x: 'x0 - 0.6*x', y: 'y0 + 0.4*y', scaleY: '1 - stretch' },
      { at: 0.46, x: 'x0 + 0.2*x', y: 'y0 - 0.8*y', scaleY: '1 + 0.6*stretch' },
      { at: 0.63, x: 'x0 - 0.9*x', y: 'y0 + 0.7*y', scaleY: '1 - 0.7*stretch' },
      { at: 0.81, x: 'x0 + 0.7*x', y: 'y0 - 0.2*y', scaleY: '1 + 0.4*stretch' },
      { at: 1, x: 'x0', y: 'y0', scaleY: 1 }
    ],
    legacy: 'cogita.css: cogita-mesh-layer — 180–400 s, każda warstwa nici inaczej'
  },
  {
    name: 'wave', verb: false, kind: 'loop', label: 'Fala',
    says: 'przelewa się w bok i w pionie po nieregularnej drodze — pasma fal',
    duration: 10000, delay: 0, easing: 'ease-in-out', alternate: false, unit: '%',
    params: { x: param('W bok (%)', 3, -50, 50), y: param('W pionie (%)', 4, -50, 50), x0: param('Spoczynek w bok (%)', 0, -50, 50), y0: param('Spoczynek w pionie (%)', 0, -50, 50) },
    frames: [
      { at: 0, x: 'x0', y: 'y0' },
      { at: 0.24, x: 'x0 + x', y: 'y0 + y' },
      { at: 0.52, x: 'x0 - 0.8*x', y: 'y0 - 0.9*y' },
      { at: 0.78, x: 'x0 + 1.1*x', y: 'y0 + 1.2*y' },
      { at: 1, x: 'x0', y: 'y0' }
    ],
    legacy: 'cogita.css: cogita-wave-sway — zdefiniowana, ale w starym systemie wyłączona (fale stały)'
  },
  {
    name: 'blink', verb: false, kind: 'loop', label: 'Miga',
    says: 'przygasa i rozbłyska — ostrzeżenie, błąd',
    duration: 1000, delay: 0, easing: 'ease-in-out', alternate: false, unit: 'px',
    params: { dim: param('Najmniejsze krycie', 0.25, 0, 1), bright: param('Największe krycie', 0.9, 0, 1) },
    frames: [{ at: 0, opacity: 'dim' }, { at: 0.5, opacity: 'bright' }, { at: 1, opacity: 'dim' }],
    legacy: 'cogita-intro.css: link-error (1 s) i node-blocked (1,2 s) — brakujące podstawy na mapie wiedzy'
  }
];

const BY_NAME = new Map(MOTIONS.map((one) => [one.name, one]));

/**
 * WIE `draw` EINE LINIE TEILT: ein Strich, zehnmal so lang wie sie, dann eine
 * Lücke, viermal so lang; verschoben um `(10 − draw) · Länge`. So ist `draw`
 * 0–1 der gezeichnete Anteil vom Anfang her, über 1 (bis 10) ist sie schon
 * ganz — sie wird vor dem Ende fertig, wie im Altbestand ein Strich, der länger
 * war als die Linie —, unter 0 (bis −2) ist noch nichts zu sehen.
 */
export const DRAW_DASH = 10;
const DRAW_GAP = 4;

export const motionDef = (name: string): MotionDef | undefined => BY_NAME.get(name);

export const MOTION_NAMES: readonly string[] = MOTIONS.map((one) => one.name);

/* -- Ein Wert aus Zahlen und Reglern ------------------------------------------------ */

/**
 * `'x0 - 0.6*x'` mit den Reglern ausrechnen. Nur Summen von Zahlen, Reglern und
 * Zahl*Regler — mehr braucht kein Bild, und mehr soll hier nicht lesbar sein.
 * Ein unbekannter Regler zählt 0.
 */
export function amount(value: Amount | undefined, params: Readonly<Record<string, number>>): number {
  if (value === undefined) return 0;
  if (typeof value === 'number') return value;
  let sum = 0;
  const terms = value.replace(/\s+/g, '').replace(/-/g, '+-').split('+').filter((t) => t !== '');
  for (const term of terms) {
    const negative = term.startsWith('-');
    const body = negative ? term.slice(1) : term;
    const [a, b] = body.split('*');
    const factor = b === undefined ? (/^[\d.]+$/.test(a) ? Number(a) : params[a] ?? 0) : Number(a) * (params[b] ?? 0);
    sum += (negative ? -1 : 1) * (Number.isFinite(factor) ? factor : 0);
  }
  return sum;
}

/* -- Eine Bewegung, so wie sie an einem Ding hängt ------------------------------------ */

export type Point = readonly [number, number];
/** `from` / `to`: eine Zahl (Grösse, Drehung, Deckkraft …), ein Punkt (`move`, `size` [sx, sy]) oder eine Farbe (`color`). */
export type MotionValue = number | Point | string;

export interface MotionUse {
  readonly name: string;
  readonly duration: number | null;
  readonly delay: number | null;
  readonly repeat: Repeat | null;
  readonly ease: string | null;
  readonly unit: 'px' | '%' | null;
  readonly params: Readonly<Record<string, number>>;
  readonly from: MotionValue | null;
  readonly to: MotionValue | null;
  readonly path: readonly Point[] | null;
  readonly times: readonly number[] | null;
  readonly keys: readonly Key[] | null;
}

/** Höchstens so viele Bewegungen an einem Ding — eine im Auftritt, eine in der Schleife, eine dazu. */
export const MAX_MOTIONS = 3;
const MAX_KEYS = 400;
const MAX_PATH = 400;

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};

const finite = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

const clamp = (value: number, min: number, max: number): number => (value < min ? min : value > max ? max : value);

/**
 * Eine Farbe, wie sie in einer Bewegung (und einer Zeichnung) stehen darf:
 * `#rgb`/`#rrggbb(aa)`, `rgb(a)(…)`, `hsl(a)(…)`, ein Name, `transparent`,
 * `none`, die Namen des Themas (`accent`, `ink`, `ground`, `muted`, `ok`,
 * `danger`) — mit `/35` dahinter: zu 35 % deckend. Sonst nichts. (Ein Name hat
 * ab zwei Buchstaben: `ok` fiel bis 2026-10-17 heraus.)
 */
export function colorValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (text === '' || text.length > 60 || /[;{}<>"'\\]/.test(text)) return null;
  const base = text.replace(/\/\d{1,3}$/, '');
  return /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|[a-z]{2,20})$/i.test(base) ? text : null;
}

/**
 * EINE FARBE ZUM MALEN: die Namen des Themas als seine Variablen (sie gehen mit
 * den Farben der Szene, des Slajds), `ok`/`danger` als gut und schlecht, `/35`
 * als Mischung mit Durchsichtigem.
 */
export function paint(value: string): string {
  const m = /^(.*?)\/(\d{1,3})$/.exec(value.trim());
  const base = (m === null ? value : m[1]).trim();
  const named = ['accent', 'ink', 'ground', 'muted'].includes(base) ? `var(--wk-${base})`
    : base === 'ok' ? 'var(--wk-ok, #3fb468)'
    : base === 'danger' ? 'var(--wk-danger, #e05252)'
    : base === 'warn' ? 'var(--wk-warn, #d99a1e)'
    : base === 'info' ? 'var(--wk-info, #3b82c4)'
    : base;
  return m === null ? named : `color-mix(in srgb, ${named} ${Math.min(100, Number(m[2]))}%, transparent)`;
}

/** Ein Schein: „x y blur color" — Zahlen, Pixel und eine Farbe, sonst nichts. */
export function glowValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = /^(-?\d+(?:\.\d+)?(?:px)?)\s+(-?\d+(?:\.\d+)?(?:px)?)\s+(\d+(?:\.\d+)?(?:px)?)\s+(.+)$/.exec(value.trim());
  if (m === null || colorValue(m[4]) === null) return null;
  const px = (n: string) => (n.endsWith('px') ? n : `${n}px`);
  return `${px(m[1])} ${px(m[2])} ${px(m[3])} ${m[4].trim()}`;
}

/** Ein Ausschnitt: `inset(…)` mit Längen und Prozenten. */
const CLIP = /^inset\(\s*-?[\d.]+(px|%)?(\s+-?[\d.]+(px|%)?){0,3}\s*\)$/;

const EASE_NAMES: Readonly<Record<string, string>> = {
  linear: 'linear', ease: 'ease', in: 'ease-in', out: 'ease-out', inOut: 'ease-in-out',
  'ease-in': 'ease-in', 'ease-out': 'ease-out', 'ease-in-out': 'ease-in-out', step: 'steps(1, end)'
};

/** Wie es von einem Bild zum nächsten geht: ein Name, oder eine eigene Kurve `cubic-bezier(a, b, c, d)`. */
export function easeValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (EASE_NAMES[text] !== undefined) return text;
  return /^cubic-bezier\(\s*-?[\d.]+\s*,\s*-?[\d.]+\s*,\s*-?[\d.]+\s*,\s*-?[\d.]+\s*\)$/.test(text) ? text : null;
}

const cssEase = (value: string): string => EASE_NAMES[value] ?? value;

const pointOf = (value: unknown): Point | null => {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const a = finite(value[0]);
  const b = finite(value[1]);
  return a === null || b === null ? null : [clamp(a, -100000, 100000), clamp(b, -100000, 100000)];
};

const valueOf = (value: unknown): MotionValue | null => {
  const n = finite(value);
  if (n !== null) return clamp(n, -100000, 100000);
  const p = pointOf(value);
  if (p !== null) return p;
  return colorValue(value);
};

/** Ein Bild aus dem Gespeicherten — was nicht passt, fällt weg. */
function readKey(value: unknown): Key | null {
  const one = record(value);
  const at = finite(one.at);
  if (at === null) return null;
  const out: { -readonly [K in keyof Key]: Key[K] } = { at: clamp(at, 0, 1) };
  for (const key of ['x', 'y', 'rotate', 'blur'] as const) {
    const n = finite(one[key]);
    if (n !== null) out[key] = clamp(n, -100000, 100000);
  }
  for (const key of ['scale', 'sx', 'sy'] as const) {
    const n = finite(one[key]);
    if (n !== null) out[key] = clamp(n, -100, 100);
  }
  for (const key of ['opacity', 'reveal'] as const) {
    const n = finite(one[key]);
    if (n !== null) out[key] = clamp(n, 0, 1);
  }
  const draw = finite(one.draw);
  if (draw !== null) out.draw = clamp(draw, -2, DRAW_DASH);
  const color = colorValue(one.color);
  if (color !== null) out.color = color;
  const stroke = colorValue(one.stroke);
  if (stroke !== null) out.stroke = stroke;
  const glow = glowValue(one.glow);
  if (glow !== null) out.glow = glow;
  if (typeof one.clip === 'string' && CLIP.test(one.clip.trim())) out.clip = one.clip.trim();
  const ease = easeValue(one.ease);
  if (ease !== null) out.ease = ease;
  return out;
}

/** Eine Bewegung aus dem Gespeicherten — `null`: keine (oder eine, die es nicht gibt). */
export function readMotionUse(value: unknown): MotionUse | null {
  const one = typeof value === 'string' ? { name: value } : record(value);
  const name = typeof one.name === 'string' ? one.name.trim() : '';
  const def = motionDef(name);
  if (def === undefined) return null;
  const duration = finite(one.duration);
  const delay = finite(one.delay);
  const params: Record<string, number> = {};
  for (const [key, spec] of Object.entries(def.params)) {
    const given = finite(one[key]);
    if (given !== null) params[key] = clamp(given, spec.min, spec.max);
  }
  const repeat = one.repeat === 'once' || one.repeat === 'loop' || one.repeat === 'alternate' ? one.repeat
    : finite(one.repeat) !== null ? Math.round(clamp(finite(one.repeat)!, 1, 1000)) : null;
  const path = Array.isArray(one.path) ? one.path.slice(0, MAX_PATH).map(pointOf).filter((p): p is Point => p !== null) : null;
  const times = Array.isArray(one.times) ? one.times.slice(0, MAX_PATH).map(finite).filter((t): t is number => t !== null).map((t) => clamp(t, 0, 1)) : null;
  const keys = Array.isArray(one.keys) ? one.keys.slice(0, MAX_KEYS).map(readKey).filter((k): k is Key => k !== null).sort((a, b) => a.at - b.at) : null;
  const once = repeat === 'once' || typeof repeat === 'number' || (repeat === null && def.kind === 'enter');
  return {
    name,
    duration: duration === null ? null : Math.round(clamp(duration, 50, 600_000)),
    delay: delay === null ? null : Math.round(clamp(delay, once ? 0 : -600_000, 600_000)),
    repeat,
    ease: easeValue(one.ease),
    unit: one.unit === '%' || one.unit === 'px' ? one.unit : null,
    params,
    from: valueOf(one.from),
    to: valueOf(one.to),
    path: path !== null && path.length >= 2 ? path : null,
    times: times !== null && path !== null && times.length === path.length ? times : null,
    keys: keys !== null && keys.length >= 1 ? keys : null
  };
}

/** Die Bewegungen eines Dings — ein Objekt, ein Name oder eine Liste; Unbekanntes fällt weg. */
export function readMotions(value: unknown): MotionUse[] {
  const list = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  const out: MotionUse[] = [];
  for (const one of list.slice(0, 12)) {
    const use = readMotionUse(one);
    if (use !== null) out.push(use);
    if (out.length === MAX_MOTIONS) break;
  }
  return out;
}

/** Die Namen in einem Dokument, die es nicht gibt — für die Warnungen des Imports. */
export function unknownMotions(value: unknown): string[] {
  const list = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  return list.map((one) => (typeof one === 'string' ? one : record(one).name))
    .filter((name): name is string => typeof name === 'string' && motionDef(name.trim()) === undefined)
    .map((name) => name.trim());
}

/** Eine Bewegung KNAPP, wie sie gespeichert wird und im JSON steht. */
export function motionUseJson(use: MotionUse): Record<string, unknown> {
  return {
    name: use.name,
    ...(use.duration === null ? {} : { duration: use.duration }),
    ...(use.delay === null ? {} : { delay: use.delay }),
    ...(use.repeat === null ? {} : { repeat: use.repeat }),
    ...(use.ease === null ? {} : { ease: use.ease }),
    ...(use.unit === null ? {} : { unit: use.unit }),
    ...use.params,
    ...(use.from === null ? {} : { from: use.from }),
    ...(use.to === null ? {} : { to: use.to }),
    ...(use.path === null ? {} : { path: use.path }),
    ...(use.times === null ? {} : { times: use.times }),
    ...(use.keys === null ? {} : { keys: use.keys })
  };
}

/** Die Bewegungen eines Dings: keine — nichts; eine — das Objekt; mehrere — die Liste. */
export function motionsJson(list: readonly MotionUse[]): unknown {
  if (list.length === 0) return undefined;
  return list.length === 1 ? motionUseJson(list[0]) : list.map(motionUseJson);
}

/** Die Regler einer Bewegung: die gegebenen, sonst die Vorgaben. */
export function paramsOf(use: MotionUse): Record<string, number> {
  const def = motionDef(use.name);
  const out: Record<string, number> = {};
  for (const [key, spec] of Object.entries(def?.params ?? {})) out[key] = use.params[key] ?? spec.value;
  return out;
}

/** Spielt sie einmal (ein Auftritt) — oder läuft sie, solange zu sehen? */
export function isOnce(use: MotionUse): boolean {
  if (use.repeat !== null) return use.repeat === 'once' || typeof use.repeat === 'number';
  return motionDef(use.name)?.kind !== 'loop';
}

/* -- Die Bilder einer Bewegung -------------------------------------------------------------- */

const num = (v: MotionValue | null, fallback: number): number => (typeof v === 'number' ? v : fallback);
const pt = (v: MotionValue | null, fallback: Point): Point => (Array.isArray(v) ? v as Point : typeof v === 'number' ? [v, v] : fallback);
const col = (v: MotionValue | null): string | undefined => (typeof v === 'string' ? v : undefined);

/** Die Bilder einer Bewegung als `Key`: aus einer Vorlage (mit ihren Reglern), einem Grundwort, oder wie gegeben. */
export function keysOf(use: MotionUse): Key[] {
  const def = motionDef(use.name);
  if (def === undefined) return [];
  if (!def.verb) {
    const params = paramsOf(use);
    return def.frames.map((f) => {
      const k: { -readonly [K in keyof Key]: Key[K] } = { at: f.at };
      if (f.x !== undefined) k.x = amount(f.x, params);
      if (f.y !== undefined) k.y = amount(f.y, params);
      if (f.scale !== undefined) k.scale = amount(f.scale, params);
      if (f.scaleY !== undefined) { k.sy = amount(f.scaleY, params); k.sx = 1; }
      if (f.rotate !== undefined) k.rotate = amount(f.rotate, params);
      if (f.opacity !== undefined) k.opacity = amount(f.opacity, params);
      if (f.blur !== undefined) k.blur = amount(f.blur, params);
      if (f.draw !== undefined) k.draw = amount(f.draw, params);
      return k;
    });
  }
  switch (use.name) {
    case 'move': {
      if (use.path !== null) {
        const n = use.path.length;
        return use.path.map((p, i) => ({ at: use.times?.[i] ?? i / (n - 1), x: p[0], y: p[1] }));
      }
      const a = pt(use.from, [0, 0]);
      const b = pt(use.to, [0, 0]);
      return [{ at: 0, x: a[0], y: a[1] }, { at: 1, x: b[0], y: b[1] }];
    }
    case 'size': {
      const a = pt(use.from, [1, 1]);
      const b = pt(use.to, [1.1, 1.1]);
      return [{ at: 0, sx: a[0], sy: a[1] }, { at: 1, sx: b[0], sy: b[1] }];
    }
    case 'turn': return [{ at: 0, rotate: num(use.from, 0) }, { at: 1, rotate: num(use.to, 360) }];
    case 'fade': return [{ at: 0, opacity: clamp(num(use.from, 0), 0, 1) }, { at: 1, opacity: clamp(num(use.to, 1), 0, 1) }];
    case 'draw': return [{ at: 0, draw: num(use.from, 0) }, { at: 1, draw: num(use.to, 1) }];
    case 'reveal': return [{ at: 0, reveal: clamp(num(use.from, 0), 0, 1) }, { at: 1, reveal: clamp(num(use.to, 1), 0, 1) }];
    case 'color': {
      const a = col(use.from);
      const b = col(use.to);
      return a === undefined && b === undefined ? [] : [{ at: 0, ...(a === undefined ? {} : { color: a }) }, { at: 1, ...(b === undefined ? {} : { color: b }) }];
    }
    case 'keys': return use.keys === null ? [] : [...use.keys];
    default: return [];
  }
}

/** Was eine Bewegung berührt: das Aussehen einer Fläche (Farbe, Linie, Zeichnen) — oder Ort, Grösse, Deckkraft. */
export function touchesPaint(use: MotionUse): boolean {
  return keysOf(use).some((k) => k.color !== undefined || k.stroke !== undefined || k.draw !== undefined);
}

export type MotionTarget = 'html' | 'svg';

const round = (value: number, digits = 4): number => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

/**
 * Ein Wert, der in einem Bild fehlt: zwischen den Nachbarn, die ihn haben;
 * nach dem letzten bleibt er; vor dem ersten — `undefined`: wie das Ding von
 * sich aus ist. So steht x in `translate` richtig, wenn ein Bild nur y nennt.
 */
function filled(keys: readonly Key[], pick: (k: Key) => number | undefined): (number | undefined)[] | null {
  const known = keys.map(pick);
  if (known.every((v) => v === undefined)) return null;
  return keys.map((k, i) => {
    if (known[i] !== undefined) return known[i]!;
    let a = i - 1;
    while (a >= 0 && known[a] === undefined) a -= 1;
    let b = i + 1;
    while (b < keys.length && known[b] === undefined) b += 1;
    if (a < 0) return undefined;
    if (b >= keys.length) return known[a]!;
    const t = keys[b].at === keys[a].at ? 0 : (k.at - keys[a].at) / (keys[b].at - keys[a].at);
    return known[a]! + (known[b]! - known[a]!) * t;
  });
}

/** Ein Wort, das in einem Bild fehlt: das letzte davor (Farben und Scheine lassen sich nicht rechnen, nur halten); vor dem ersten keins. */
function held(keys: readonly Key[], pick: (k: Key) => string | undefined): (string | undefined)[] | null {
  const known = keys.map(pick);
  if (known.every((v) => v === undefined)) return null;
  let last: string | undefined;
  return known.map((v) => { if (v !== undefined) last = v; return last; });
}

/**
 * DIE BILDER EINER BEWEGUNG für `element.animate()`: Ort, Drehung und Grösse
 * als eigene Eigenschaften (`translate`, `rotate`, `scale` — sie setzen sich mit
 * dem Platz des Dings zusammen, statt ihn zu ersetzen), dazu Deckkraft, Filter,
 * Strich, Farbe, Ausschnitt. Jedes trägt seinen Übergang zum nächsten (`ease`).
 */
export function keyframesOf(use: MotionUse, target: MotionTarget = 'html'): Keyframe[] {
  const def = motionDef(use.name);
  const keys = keysOf(use);
  if (def === undefined || keys.length === 0) return [];
  const unit = use.unit ?? def.unit;
  const ease = cssEase(use.ease ?? def.easing);
  const length = paramsOf(use).length ?? 1;

  const xs = filled(keys, (k) => k.x);
  const ys = filled(keys, (k) => k.y);
  const sxs = filled(keys, (k) => k.sx ?? k.scale);
  const sys = filled(keys, (k) => k.sy ?? k.scale);
  const turns = filled(keys, (k) => k.rotate);
  const opacities = filled(keys, (k) => k.opacity);
  const blurs = filled(keys, (k) => k.blur);
  const glows = held(keys, (k) => k.glow);
  const colors = held(keys, (k) => k.color);
  const strokes = held(keys, (k) => k.stroke);
  const moved = xs !== null || ys !== null;
  const sized = sxs !== null || sys !== null;
  /*
   * Ein Bild nennt nur, was in ihm steht: dazwischen geht jeder Wert in EINEM
   * Zug vom Bild davor, das ihn nennt, zum nächsten, das ihn nennt (wie in CSS)
   * — sonst hielte ein Punkt auf seinem Weg an jedem Bild, das nur die
   * Deckkraft ändert. Was vor seinem ersten Bild fehlt, kommt von dem Ding
   * selbst (sein Platz, seine Farbe); nach seinem letzten bleibt es stehen —
   * dafür ist das letzte Bild vollständig.
   */
  const last = (i: number): boolean => i === keys.length - 1;
  const has = <T,>(list: readonly (T | undefined)[] | null, i: number): boolean => list !== null && list[i] !== undefined;

  const frames = keys.map((k, i): Keyframe => {
    const out: Keyframe = { offset: round(k.at, 5) };
    if (moved && (k.x !== undefined || k.y !== undefined || (last(i) && (has(xs, i) || has(ys, i))))) out.translate = `${round(xs?.[i] ?? 0)}${unit} ${round(ys?.[i] ?? 0)}${unit}`;
    if (sized && (k.scale !== undefined || k.sx !== undefined || k.sy !== undefined || (last(i) && (has(sxs, i) || has(sys, i))))) out.scale = `${round(sxs?.[i] ?? 1)} ${round(sys?.[i] ?? 1)}`;
    if (has(turns, i) && (k.rotate !== undefined || last(i))) out.rotate = `${round(turns![i]!)}deg`;
    if (has(opacities, i) && (k.opacity !== undefined || last(i))) out.opacity = round(opacities![i]!);
    if ((has(blurs, i) || has(glows, i)) && (k.blur !== undefined || k.glow !== undefined || last(i))) {
      /* Im Filter stehen in jedem Bild dieselben Teile (sonst springt er): was fehlt, ist null. */
      const parts = [
        blurs === null ? '' : `blur(${round(Math.max(0, blurs[i] ?? 0))}px)`,
        glows === null ? '' : `drop-shadow(${glows[i] === undefined ? '0px 0px 0px transparent' : paintGlow(glows[i]!)})`
      ];
      out.filter = parts.filter((p) => p !== '').join(' ');
    }
    if (k.draw !== undefined) out.strokeDashoffset = String(round((DRAW_DASH - k.draw) * length));
    if (has(colors, i) && (k.color !== undefined || last(i))) out[target === 'svg' ? 'fill' : 'color'] = paint(colors![i]!);
    if (has(strokes, i) && (k.stroke !== undefined || last(i))) out.stroke = paint(strokes![i]!);
    if (k.reveal !== undefined) out.clipPath = `inset(0 ${round((1 - k.reveal) * 100, 3)}% 0 0)`;
    if (k.clip !== undefined) out.clipPath = target === 'svg' ? `${k.clip} view-box` : k.clip;
    if (i < keys.length - 1) out.easing = cssEase(k.ease ?? ease);
    return out;
  });
  /* Ein einzelnes Bild ist ein Zustand: von dort bis zum Ende derselbe. */
  return frames.length === 1 ? [frames[0], { ...frames[0], offset: 1 }] : frames;
}

/** Ein Schein mit einer Farbe des Themas. */
function paintGlow(glow: string): string {
  const m = /^(\S+\s+\S+\s+\S+)\s+(.+)$/.exec(glow);
  return m === null ? glow : `${m[1]} ${paint(m[2])}`;
}

/** Wie die Bewegung abläuft — für `element.animate()`. Der Übergang steht in jedem Bild (wie in CSS), hier linear. */
export function timingOf(use: MotionUse): KeyframeAnimationOptions {
  const def = motionDef(use.name);
  if (def === undefined) return { duration: 0 };
  const repeat = use.repeat ?? (def.kind === 'loop' ? (def.alternate ? 'alternate' : 'loop') : 'once');
  return {
    duration: use.duration ?? def.duration,
    delay: use.delay ?? def.delay,
    easing: 'linear',
    iterations: repeat === 'once' ? 1 : typeof repeat === 'number' ? repeat : Infinity,
    direction: repeat === 'alternate' ? 'alternate' : 'normal',
    fill: 'both'
  };
}

/** Was eine Linie braucht, damit `draw` sie zeichnen kann: ihre Länge (in einer Zeichnung: 1 — `pathLength`). */
export function dashOf(use: MotionUse): number | null {
  return keysOf(use).some((k) => k.draw !== undefined) ? paramsOf(use).length ?? 1 : null;
}

/** Der Strich und die Lücke einer Linie der Länge `length` (`stroke-dasharray`) — siehe `DRAW_DASH`. */
export const dashArray = (length: number): string => `${round(DRAW_DASH * length)} ${round(DRAW_GAP * length)}`;

/* -- Die Beschreibung --------------------------------------------------------------------- */

/** Ein Abschnitt der Beschreibung des JSON — aus dem Wörterbuch selbst, damit er nicht hinter ihm zurückbleibt. */
export function motionDescription(): string {
  const line = (def: MotionDef): string => {
    const knobs = Object.entries(def.params).map(([key, p]) => `"${key}" (${p.label.toLowerCase()}, ${p.value})`);
    return `    "${def.name}" — ${def.label}: ${def.says}; ${def.duration} ms${def.delay !== 0 ? `, opóźnienie ${def.delay} ms` : ''}${def.alternate ? ', tam i z powrotem' : ''}`
      + `${knobs.length > 0 ? `; regulacje: ${knobs.join(', ')}` : ''}`;
  };
  return [
    'Ruch ("motion") — przy module na slajdzie i w scenie prezentacji, przy warstwie obrazu z warstw, przy warstwie tła i przy każdym elemencie rysunku ("animation"):',
    '  { "name": "move", "to": [40, -12], "duration": 900, "delay": 120, "repeat": "once", "ease": "inOut" } albo lista do trzech takich (zewnętrzny pierwszy); sam napis "rise" też wystarczy',
    '  "duration", "delay" — w milisekundach; "delay" przy ruchu w pętli może być ujemne (zaczyna w środku cyklu)',
    '  "repeat" — "once" (raz, gdy rzecz zostaje osiągnięta; przy następnym przyjściu od nowa — do tego czasu stoi w pierwszej klatce), "loop" (w kółko, dopóki widać), "alternate" (tam i z powrotem), albo liczba powtórzeń',
    '  "ease" — jak przechodzi z klatki do klatki: "linear", "ease", "in", "out", "inOut", "step" albo "cubic-bezier(a, b, c, d)"',
    '  "unit" — "px" (zwykle; w rysunku — jednostki rysunku) albo "%" (procent własnej wielkości)',
    '  Słowa podstawowe (z nich da się złożyć każdy ruch):',
    ...MOTIONS.filter((d) => d.verb).map(line),
    '  Klatka ("keys"): "at" 0–1 — kiedy; "x", "y" — przesunięcie; "scale" albo "sx", "sy" — wielkość; "rotate" — stopnie; "opacity" 0–1; "blur" — rozmycie w px;',
    '    "draw" — ile linii narysowane (0–1); "color" — kolor wypełnienia albo napisu; "stroke" — kolor linii; "glow" — poświata "x y rozmycie kolor" (np. "0 0 10px rgba(160, 220, 255, 0.75)");',
    '    "reveal" 0–1 — ile widać od lewej; "clip" — wycinek "inset(góra prawa dół lewa)"; "ease" — przejście do następnej klatki. Czego klatka nie podaje, płynie jednym ruchem między klatkami, które to podają; przed pierwszą taką — jak rzecz jest sama z siebie, po ostatniej — zostaje.',
    '  Kolory: "#rrggbb", "rgba(…)", nazwy motywu "accent", "ink", "ground", "muted", "ok", "danger" — z "/35" na końcu: krycie 35 %.',
    '  Gotowe ruchy (ze starego pokazu Cogita) — wejścia:',
    ...MOTIONS.filter((d) => !d.verb && d.kind === 'enter').map(line),
    '  — w pętli:',
    ...MOTIONS.filter((d) => !d.verb && d.kind === 'loop').map(line),
    '  Przy ustawieniu „mniej ruchu” w systemie nic się nie rusza — wszystko stoi tak, jak jest opisane bez ruchu.'
  ].join('\n');
}
