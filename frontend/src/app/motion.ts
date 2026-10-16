/**
 * 0107 — DIE BEWEGUNGEN: ein Wörterbuch dessen, was sich auf einer Seite
 * bewegen kann — als DATEN, nicht als Stilblatt.
 *
 * <b>Herkunft: der Altbestand von Cogita</b> (`legacy/styles/cogita-intro.css`,
 * `cogita.css`). Was dort als `@keyframes` an einzelnen Klassen hing — der Text,
 * der nach dem Wechsel aufsteigt, die Buchstaben des Zeichens, die sich
 * nacheinander setzen, die Blasen, die schweben, die Tarcza, die sich zeichnet,
 * der Dunst, der dahinter treibt —, steht hier einmal, mit Namen, und lässt sich
 * an jeden Baustein, jede Schicht und jede Ebene eines Bildes hängen:
 *
 * <code>
 *   "motion": { "name": "rise", "delay": 220 }
 *   "motion": [{ "name": "assemble", "delay": 90 }, { "name": "float", "x": 4, "y": 6 }]
 * </code>
 *
 * <b>Zwei Arten.</b> `enter` spielt einmal, wenn der Slajd erreicht ist (und
 * wieder, wenn man ihn verlassen hat und zurückkommt); vorher steht das Ding in
 * seinem ersten Bild — der Text ist also nicht schon da und verschwindet dann.
 * `loop` läuft, solange es zu sehen ist. Beides nach der Uhr: der WECHSEL der
 * Slajdy folgt weiter der Bahn (`slideMotion.ts`); was danach geschieht, ist
 * ein kleiner Auftritt, kein Ziehen.
 *
 * <b>Ein Bild je Augenblick.</b> `frames` sagt für Stellen 0–1, wie das Ding
 * dort aussieht: Deckkraft, Verschiebung, Grösse, Drehung, Unschärfe, wie viel
 * einer Linie schon gezeichnet ist. Die Werte dürfen die Regler der Bewegung
 * nennen (`'x0 - 0.6*x'`) — so ist die Welle der Fäden dieselbe Rechnung wie
 * im Altbestand, nur mit eigenen Ausschlägen je Schicht.
 *
 * <b>Rein und ohne Oberfläche</b> — die Bilder für die Web Animations API
 * entstehen hier (`keyframesOf`, `timingOf`), abgespielt werden sie in
 * `MotionBox.tsx`. Geprüft in `app-slides-check`.
 *
 * Die Choreographien der Bilder (Karten, Runde, Wykres, Mapa) sind keine
 * einzelnen Bewegungen, sondern Abläufe vieler Teile — sie stehen als Szenen in
 * `parts/animation.tsx` (`SCENES`), ihre Zeitpläne als Keyframes in `app.css`.
 */

export type MotionKind = 'enter' | 'loop';

/**
 * EIN WERT IN EINEM BILD: eine Zahl, oder eine kleine Summe aus Zahlen und
 * Reglern: `'y'`, `'-shift'`, `'x0 + 0.6*x'`, `'1 - 0.7*stretch'`.
 */
export type Amount = number | string;

/** Wie das Ding an der Stelle `at` (0–1) der Bewegung aussieht. */
export interface MotionFrame {
  readonly at: number;
  readonly opacity?: Amount;
  /** Verschiebung — in der Einheit der Bewegung (`unit`). */
  readonly x?: Amount;
  readonly y?: Amount;
  readonly scale?: Amount;
  readonly scaleY?: Amount;
  /** Grad. */
  readonly rotate?: Amount;
  /** Unschärfe in Pixeln. */
  readonly blur?: Amount;
  /** Wie viel einer Linie noch NICHT gezeichnet ist (`stroke-dashoffset`, in Einheiten der Zeichnung). */
  readonly dash?: Amount;
}

export interface MotionParam {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
}

export interface MotionDef {
  readonly name: string;
  readonly kind: MotionKind;
  /** Name im Editor. */
  readonly label: string;
  /** Was sie tut, in einem Satz — für die Beschreibung des JSON. */
  readonly says: string;
  /** Dauer eines Durchgangs (ms). */
  readonly duration: number;
  /** Wie lange sie wartet (ms) — bei `loop` darf es weniger als 0 sein: dann beginnt sie mitten im Durchgang. */
  readonly delay: number;
  readonly easing: string;
  /** Eine Schleife, die hin und zurück läuft. */
  readonly alternate: boolean;
  /** Einheit der Verschiebung: Pixel, oder Prozent der eigenen Grösse. */
  readonly unit: 'px' | '%';
  readonly params: Readonly<Record<string, MotionParam>>;
  readonly frames: readonly MotionFrame[];
  /** Woher sie stammt — Datei und Keyframes im Altbestand. */
  readonly legacy: string | null;
}

const param = (label: string, value: number, min: number, max: number): MotionParam => ({ label, value, min, max });

/**
 * DAS WÖRTERBUCH. Reihenfolge: erst was einmal auftritt, dann was läuft.
 * Jede Zahl ist die des Altbestands; was dort pro Ding verschieden war (jede
 * Blase, jede Fadenschicht), ist hier ein Regler mit der Vorgabe von dort.
 */
export const MOTIONS: readonly MotionDef[] = [
  {
    name: 'rise', kind: 'enter', label: 'Wynurza się',
    says: 'pojawia się, unosząc się o kilka pikseli — tekst slajdu po dotarciu',
    duration: 520, delay: 220, easing: 'ease', alternate: false, unit: 'px',
    params: { y: param('Skąd (px niżej)', 10, -400, 400) },
    frames: [{ at: 0, opacity: 0, y: 'y' }, { at: 1, opacity: 1, y: 0 }],
    legacy: 'cogita-intro.css: cogita-text-delayed — 520 ms po 220 ms (na slajdzie mapy po 1000 ms)'
  },
  {
    name: 'assemble', kind: 'enter', label: 'Składa się',
    says: 'warstwa pojawia się, lekko uniesiona i pomniejszona; kolejne z rosnącym opóźnieniem składają znak',
    duration: 620, delay: 0, easing: 'ease', alternate: false, unit: 'px',
    params: { y: param('Skąd (px niżej)', 8, -400, 400), scale: param('Skala na początku', 0.985, 0.2, 3) },
    frames: [{ at: 0, opacity: 0, y: 'y', scale: 'scale' }, { at: 1, opacity: 1, y: 0, scale: 1 }],
    legacy: 'cogita-intro.css: cogita-logo-stagger — 620 ms; litery po 0, 90, 180, 260, 340, 420 ms, „REcreatio” po 520 i 620 ms'
  },
  {
    name: 'focus', kind: 'enter', label: 'Wyostrza się',
    says: 'z lekkiego rozmycia i z dołu do ostrości',
    duration: 480, delay: 0, easing: 'ease', alternate: false, unit: 'px',
    params: { y: param('Skąd (px niżej)', 12, -400, 400), blur: param('Rozmycie (px)', 2, 0, 40) },
    frames: [{ at: 0, opacity: 0, y: 'y', blur: 'blur' }, { at: 1, opacity: 1, y: 0, blur: 0 }],
    legacy: 'cogita-intro.css: .cogita-intro-slide — zmiana slajdu: krycie, 12 px, rozmycie 2 px w 480 ms'
  },
  {
    name: 'fade', kind: 'enter', label: 'Rozjaśnia się',
    says: 'pojawia się z przezroczystości',
    duration: 600, delay: 0, easing: 'ease', alternate: false, unit: 'px',
    params: {},
    frames: [{ at: 0, opacity: 0 }, { at: 1, opacity: 1 }],
    legacy: null
  },
  {
    name: 'draw', kind: 'enter', label: 'Rysuje się',
    says: 'linie rysunku (SVG) kreślą się od początku do końca',
    duration: 1800, delay: 0, easing: 'ease', alternate: false, unit: 'px',
    params: { length: param('Długość kreski (jednostki rysunku)', 420, 1, 20000) },
    frames: [{ at: 0, dash: 'length' }, { at: 1, dash: 0 }],
    legacy: 'cogita-intro.css: cogita-shield-draw — 1,8 s, stroke-dasharray 420'
  },
  {
    name: 'float', kind: 'loop', label: 'Unosi się',
    says: 'kołysze się łagodnie o kilka pikseli i wraca',
    duration: 3800, delay: 0, easing: 'ease-in-out', alternate: false, unit: 'px',
    params: { x: param('W bok (px)', 4, -200, 200), y: param('W pionie (px)', 6, -200, 200) },
    frames: [{ at: 0, x: 0, y: 0 }, { at: 0.5, x: 'x', y: 'y' }, { at: 1, x: 0, y: 0 }],
    legacy: 'cogita-intro.css: cogita-bubble-wave — bańki logo, 3,4–4,8 s, każda o inny wektor'
  },
  {
    name: 'breathe', kind: 'loop', label: 'Oddycha',
    says: 'rośnie i jaśnieje, maleje i blednie',
    duration: 2600, delay: 0, easing: 'ease-in-out', alternate: false, unit: 'px',
    params: { low: param('Najmniejsza skala', 0.92, 0.1, 3), high: param('Największa skala', 1.12, 0.1, 3), dim: param('Najmniejsze krycie', 0.55, 0, 1) },
    frames: [{ at: 0, opacity: 'dim', scale: 'low' }, { at: 0.5, opacity: 1, scale: 'high' }, { at: 1, opacity: 'dim', scale: 'low' }],
    legacy: 'cogita-intro.css: round-player-breathe — gracze rundy, 2,6 s'
  },
  {
    name: 'glow', kind: 'loop', label: 'Pulsuje blaskiem',
    says: 'poświata rośnie i przygasa',
    duration: 2200, delay: 0, easing: 'ease-in-out', alternate: false, unit: 'px',
    params: { low: param('Najmniejsza skala', 0.95, 0.1, 3), high: param('Największa skala', 1.05, 0.1, 3), dim: param('Najmniejsze krycie', 0.2, 0, 1), bright: param('Największe krycie', 0.5, 0, 1) },
    frames: [{ at: 0, opacity: 'dim', scale: 'low' }, { at: 0.5, opacity: 'bright', scale: 'high' }, { at: 1, opacity: 'dim', scale: 'low' }],
    legacy: 'cogita-intro.css: cogita-shield-glow — 2,2 s'
  },
  {
    name: 'drift', kind: 'loop', label: 'Dryfuje',
    says: 'przesuwa się powoli po skosie i rośnie, potem wraca — tło, mgła',
    duration: 18000, delay: 0, easing: 'ease-in-out', alternate: true, unit: '%',
    params: { shift: param('Przesunięcie (%)', 1, -50, 50), from: param('Skala na początku', 1.02, 0.1, 3), to: param('Skala na końcu', 1.08, 0.1, 3) },
    frames: [{ at: 0, x: '-shift', y: '-shift', scale: 'from' }, { at: 1, x: 'shift', y: 'shift', scale: 'to' }],
    legacy: 'cogita.css: cogita-depth — 18 s tam i z powrotem'
  },
  {
    name: 'sway', kind: 'loop', label: 'Faluje',
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
    name: 'wave', kind: 'loop', label: 'Fala',
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
    name: 'blink', kind: 'loop', label: 'Miga',
    says: 'przygasa i rozbłyska — ostrzeżenie, błąd',
    duration: 1000, delay: 0, easing: 'ease-in-out', alternate: false, unit: 'px',
    params: { dim: param('Najmniejsze krycie', 0.25, 0, 1), bright: param('Największe krycie', 0.9, 0, 1) },
    frames: [{ at: 0, opacity: 'dim' }, { at: 0.5, opacity: 'bright' }, { at: 1, opacity: 'dim' }],
    legacy: 'cogita-intro.css: link-error (1 s) i node-blocked (1,2 s) — brakujące podstawy na mapie wiedzy'
  }
];

const BY_NAME = new Map(MOTIONS.map((one) => [one.name, one]));

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

/** Was im JSON steht: welche Bewegung, wie lange, wann — und die Regler, die anders sind als die Vorgabe. */
export interface MotionUse {
  readonly name: string;
  readonly duration: number | null;
  readonly delay: number | null;
  readonly params: Readonly<Record<string, number>>;
}

/** Höchstens so viele Bewegungen an einem Ding — eine im Auftritt, eine in der Schleife, eine dazu. */
export const MAX_MOTIONS = 3;

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};

const finite = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

const clamp = (value: number, min: number, max: number): number => (value < min ? min : value > max ? max : value);

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
  return {
    name,
    duration: duration === null ? null : Math.round(clamp(duration, 50, 600_000)),
    delay: delay === null ? null : Math.round(clamp(delay, def.kind === 'loop' ? -600_000 : 0, 60_000)),
    params
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
    ...use.params
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

/* -- Für die Web Animations API ---------------------------------------------------------- */

type Prop = 'opacity' | 'x' | 'y' | 'scale' | 'scaleY' | 'rotate' | 'blur' | 'dash';

const NEUTRAL: Record<Prop, number> = { opacity: 1, x: 0, y: 0, scale: 1, scaleY: 1, rotate: 0, blur: 0, dash: 0 };

const round = (value: number, digits = 4): number => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

/** Welche Eigenschaften die Bilder einer Bewegung berühren. */
export function propsOf(def: MotionDef): Prop[] {
  const used = new Set<Prop>();
  for (const frame of def.frames) {
    for (const key of Object.keys(frame) as (keyof MotionFrame)[]) if (key !== 'at') used.add(key as Prop);
  }
  return (Object.keys(NEUTRAL) as Prop[]).filter((p) => used.has(p));
}

/**
 * DIE BILDER EINER BEWEGUNG für `element.animate()` — jedes mit allen
 * Eigenschaften, die irgendein Bild berührt (was eines nicht nennt, steht neutral).
 */
export function keyframesOf(use: MotionUse): Keyframe[] {
  const def = motionDef(use.name);
  if (def === undefined) return [];
  const params = paramsOf(use);
  const props = propsOf(def);
  const moves = props.some((p) => p === 'x' || p === 'y' || p === 'scale' || p === 'scaleY' || p === 'rotate');

  return def.frames.map((frame) => {
    const v = (p: Prop): number => (frame[p] === undefined ? NEUTRAL[p] : amount(frame[p], params));
    const out: Keyframe = { offset: round(clamp(frame.at, 0, 1)) };
    if (props.includes('opacity')) out.opacity = round(clamp(v('opacity'), 0, 1));
    if (moves) {
      const parts: string[] = [];
      if (props.includes('x') || props.includes('y')) parts.push(`translate(${round(v('x'))}${def.unit}, ${round(v('y'))}${def.unit})`);
      if (props.includes('rotate')) parts.push(`rotate(${round(v('rotate'))}deg)`);
      if (props.includes('scale')) parts.push(`scale(${round(v('scale'))})`);
      if (props.includes('scaleY')) parts.push(`scaleY(${round(v('scaleY'))})`);
      out.transform = parts.join(' ');
    }
    if (props.includes('blur')) out.filter = `blur(${round(Math.max(0, v('blur')))}px)`;
    if (props.includes('dash')) out.strokeDashoffset = String(round(v('dash')));
    return out;
  });
}

/** Wie die Bewegung abläuft — für `element.animate()`. */
export function timingOf(use: MotionUse): KeyframeAnimationOptions {
  const def = motionDef(use.name);
  if (def === undefined) return { duration: 0 };
  return {
    duration: use.duration ?? def.duration,
    delay: use.delay ?? def.delay,
    easing: def.easing,
    iterations: def.kind === 'loop' ? Infinity : 1,
    direction: def.alternate ? 'alternate' : 'normal',
    fill: def.kind === 'enter' ? 'both' : 'none'
  };
}

/** Was eine Zeichnung braucht, damit `draw` sie kreisen kann: die Strichlänge, an der sie sich teilt. */
export function dashOf(use: MotionUse): number | null {
  return use.name === 'draw' ? paramsOf(use).length : null;
}

/* -- Die Beschreibung --------------------------------------------------------------------- */

/** Ein Abschnitt der Beschreibung des JSON — aus dem Wörterbuch selbst, damit er nicht hinter ihm zurückbleibt. */
export function motionDescription(): string {
  const line = (def: MotionDef): string => {
    const knobs = Object.entries(def.params).map(([key, p]) => `"${key}" (${p.label.toLowerCase()}, ${p.value})`);
    return `    "${def.name}" — ${def.label}: ${def.says}; ${def.duration} ms${def.delay !== 0 ? `, opóźnienie ${def.delay} ms` : ''}${def.alternate ? ', tam i z powrotem' : ''}`
      + `${knobs.length > 0 ? `; regulacje: ${knobs.join(', ')}` : ''}`;
  };
  return [
    'Ruch ("motion") — przy module na slajdzie, przy warstwie obrazu z warstw i przy warstwie tła:',
    '  { "name": "rise", "delay": 220, "duration": 520, …regulacje } albo lista do trzech takich (zewnętrzny pierwszy); sam napis "rise" też wystarczy',
    '  "delay", "duration" — w milisekundach; pominięte — jak w słowniku. Przy ruchu w pętli "delay" może być ujemne: zaczyna w środku cyklu',
    '  Wejście (raz, gdy slajd zostaje osiągnięty; wraca przy następnym przyjściu — do tego czasu stoi w pierwszym kadrze):',
    ...MOTIONS.filter((d) => d.kind === 'enter').map(line),
    '  W pętli (dopóki widać):',
    ...MOTIONS.filter((d) => d.kind === 'loop').map(line),
    '  Przy ustawieniu „mniej ruchu” w systemie nic się nie rusza — wszystko stoi w końcowym kadrze.'
  ].join('\n');
}
