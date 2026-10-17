/**
 * 2026-10-17 — EIN BILD ZUM ANFASSEN: was eine Zeichnung („Animacja",
 * `drawing.ts`) zusätzlich sagen kann, damit man mit ihr etwas TUT — einen
 * Winkel einstellen, einen Ball loswerfen, ein Pendel auslenken, eine Feder
 * dehnen — und sieht, was daraus folgt.
 *
 * <b>Das Vorbild ist Brilliant</b> (brilliant.org): eine Lektion ist eine
 * Folge kleiner Bildschirme, auf jedem ein Bild, mit dem man spielt, bevor
 * es erklärt wird; die Antwort ist oft das Bild selbst („stell den Winkel so
 * ein, dass der Ball trifft"). Hier ist dasselbe ALLGEMEIN gesagt, als Daten —
 * kein fertiges Pendel, sondern Wörter, aus denen jedes Pendel wird:
 *
 * <code>
 *   vars       was man einstellt          [{ "name": "kat", "value": 45, "min": 0, "max": 90, "unit": "°", "label": "Kąt" }]
 *   let        was daraus folgt           [{ "name": "zasieg", "value": "v0^2*sin(rad(2*kat))/g" }]
 *   sim        was sich mit der Zeit tut  { "state": [{ "name": "y", "value": "h0", "rate": "vy" }, …], "events": […], "until": "t > 5" }
 *   controls   womit man es einstellt     Schieber, Schalter, Wahl, Knopf, Anzeige
 *   rules      was geschieht, wenn …      { "when": "trafione", "say": "Trafione!", "mood": "ok", "goal": true, "go": "next" }
 * </code>
 *
 * An den Teilen der Zeichnung dazu: jeder Wert darf ein Ausdruck sein
 * (`"x": "=x0 + v*t"`), ein Teil lässt sich ziehen (`drag`) oder antippen
 * (`tap`), wiederholen (`repeat`, mit `i`), zeigen und verbergen (`show`); neue
 * Teile: Pfeil (Vektor), Linienzug, Kurve einer Funktion (`plot`), Spur
 * (`trace`) und Rahmen (`frame` — Welt-Koordinaten mit y nach oben, Achsen).
 *
 * <b>Hier nur das Lesen</b> (duldsam, wie überall: was nicht passt, fällt
 * weg) — klein genug für jede Seite. Übersetzt und gerechnet wird in
 * `liveRun.ts`, gezeichnet in `LiveDrawing.tsx`; beide kommen erst, wenn eine
 * Seite ein solches Bild zeigt.
 */

/** Ein Name, wie er in einem Ausdruck stehen darf: Buchstaben (auch ą, ę…), Ziffern, Unterstrich — nicht vorn eine Ziffer. */
export const NAME = /^[\p{L}_][\p{L}\p{N}_]*$/u;

/**
 * DIE NAMEN, DIE ES SCHON GIBT: `t` die Zeit der Simulation (s), `time` die
 * Zeit, seit das Bild zu sehen ist, `step` die Stelle in der Szene einer
 * Präsentation (0 am Anfang, 1 nach dem ersten Schritt — dazwischen
 * fliessend), `i` und `n` in einem wiederholten Teil, `u` der Lauf einer Kurve,
 * `px`, `py` der Finger beim Ziehen.
 */
export const BUILTINS = ['t', 'time', 'step', 'i', 'n', 'u', 'px', 'py'] as const;

export const LIVE_LIMITS = {
  vars: 40, lets: 80, state: 24, events: 20, controls: 16, rules: 30, options: 12,
  repeat: 400, samples: 600, trace: 3000, name: 32, label: 80, say: 300
} as const;

export const ACTIONS = ['run', 'pause', 'toggle', 'reset'] as const;
export type Action = (typeof ACTIONS)[number];

export const ACTION_LABEL: Record<Action, string> = { run: 'Start', pause: 'Pauza', toggle: 'Start / pauza', reset: 'Od nowa' };

export const MOODS = ['ok', 'miss', 'info'] as const;
export type Mood = (typeof MOODS)[number];

/** Ein Wert, den man einstellt — ein Schieber, ein Schalter, ein Ziehen. */
export interface VarSpec {
  readonly name: string;
  readonly value: number;
  readonly min: number | null;
  readonly max: number | null;
  /** Wie fein — Schieber und Ziehen rasten darauf (vom Minimum aus gezählt). */
  readonly step: number | null;
  readonly unit: string;
  readonly label: string;
  /** Bei jedem Öffnen ein anderer Wert aus diesem Bereich (in Cogita: je Versuch). */
  readonly random: readonly [number, number] | null;
}

/** Ein Wert, der aus anderen folgt — jedes Bild neu gerechnet, in dieser Reihenfolge. */
export interface LetSpec {
  readonly name: string;
  readonly value: string;
}

/** Eine Grösse der Simulation: wo sie anfängt (`value`) und wie schnell sie sich ändert (`rate` — die Ableitung nach der Zeit). */
export interface StateSpec {
  readonly name: string;
  readonly value: string;
  readonly rate: string;
}

/** Ein Ereignis in der Simulation: wenn `when` wahr WIRD, werden Werte gesetzt (ein Aufprall), oder sie hält an. */
export interface SimEvent {
  readonly when: string;
  readonly set: Readonly<Record<string, string>>;
  readonly stop: boolean;
  readonly say: string;
  readonly mood: Mood;
}

export interface SimSpec {
  readonly state: readonly StateSpec[];
  readonly events: readonly SimEvent[];
  /** Wann sie fertig ist (`t > 10`, `y < 0`). */
  readonly until: string | null;
  /** Der Schritt der Rechnung (s) — klein genug für Genauigkeit, gross genug fürs Telefon. */
  readonly dt: number;
  /** Wie schnell sie läuft (1 — wie die Uhr). */
  readonly speed: number;
  /** Läuft von selbst, sobald das Bild zu sehen ist (sonst: Knopf „Start"). */
  readonly auto: boolean;
  /** Fängt nach dem Ende von vorn an. */
  readonly loop: boolean;
  /** Spätestens nach so vielen Sekunden (der Simulation) ist Schluss. */
  readonly max: number;
}

export interface ChoiceOption {
  readonly value: number;
  readonly label: string;
}

export type ControlSpec =
  | { readonly type: 'slider' | 'number'; readonly var: string; readonly label: string; readonly unit: string; readonly digits: number | null }
  | { readonly type: 'toggle'; readonly var: string; readonly label: string }
  | { readonly type: 'choice'; readonly var: string; readonly label: string; readonly options: readonly ChoiceOption[] }
  | { readonly type: 'button'; readonly label: string; readonly do: Action | null; readonly set: Readonly<Record<string, string>>; readonly go: string | null }
  | { readonly type: 'readout'; readonly label: string; readonly value: string; readonly unit: string; readonly digits: number | null };

export const CONTROL_TYPES = ['slider', 'number', 'toggle', 'choice', 'button', 'readout'] as const;

/** Eine Regel: wenn `when` wahr WIRD — setzen, starten, anhalten, etwas sagen, weiter in der Präsentation. */
export interface RuleSpec {
  readonly when: string;
  readonly set: Readonly<Record<string, string>>;
  readonly do: Action | null;
  /** In einer Präsentation: wohin („next", „back", eine Szene, `link:<id>`). */
  readonly go: string | null;
  /** Was unter dem Bild erscheint — mit `{…}` darf gerechnet werden. */
  readonly say: string;
  readonly mood: Mood;
  /** Das ist das Ziel: erreicht — gelöst (und in Cogita: richtig beantwortet). */
  readonly goal: boolean;
  /** Nur einmal je Durchgang (bis „Od nowa"). */
  readonly once: boolean;
}

export interface Live {
  readonly vars: readonly VarSpec[];
  readonly lets: readonly LetSpec[];
  readonly sim: SimSpec | null;
  readonly controls: readonly ControlSpec[];
  readonly rules: readonly RuleSpec[];
  /** Wo die Bedienung steht: unter dem Bild (immer auf dem Telefon) oder daneben, wo Platz ist. */
  readonly panel: 'below' | 'side';
}

/* -- An einem Teil der Zeichnung ---------------------------------------------------- */

/** Eine Zahl — oder ein Ausdruck (`"=…"` im JSON; hier ohne das `=`). */
export type Num = number | { readonly expr: string };

/** Ziehen: der Finger setzt Werte — `x`/`y`: eine Zahl gleich der Stelle des Fingers; `set`: Rechnungen mit `px`, `py`. */
export interface DragSpec {
  readonly x: string | null;
  readonly y: string | null;
  readonly set: Readonly<Record<string, string>>;
  readonly label: string;
}

/** Antippen: setzen, starten, anhalten, weiter. */
export interface TapSpec {
  readonly set: Readonly<Record<string, string>>;
  readonly do: Action | null;
  readonly go: string | null;
  readonly label: string;
}

/** Die Achsen eines Rahmens. */
export interface Axes {
  readonly x: string;
  readonly y: string;
  readonly grid: boolean;
}

/* -- Duldsame Leser ------------------------------------------------------------------- */

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};

const finite = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

const clamp = (value: number, min: number, max: number): number => (value < min ? min : value > max ? max : value);

const line = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** Ein eigener Name: das Muster, nicht zu lang, keiner der eingebauten. */
export function nameOf(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  return name.length <= LIVE_LIMITS.name && NAME.test(name) && !(BUILTINS as readonly string[]).includes(name) ? name : null;
}

/** Ein Ausdruck: Text (ein `=` vorn darf stehen), eine Zahl, ja/nein. */
export function exprOf(value: unknown): string | null {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/^=\s*/, '');
  return text === '' || text.length > 1200 ? null : text;
}

/** Ein Wert eines Teils, der eine Rechnung ist: `"=v0*t"` — sonst `null` (dann gilt die Zahl). */
export function bindOf(value: unknown): string | null {
  return typeof value === 'string' && value.trim().startsWith('=') ? exprOf(value) : null;
}

/** Eine Zahl oder eine Rechnung (`"=…"`). */
export function numOf(value: unknown, fallback: number): Num {
  const n = finite(value);
  if (n !== null) return n;
  const b = bindOf(value);
  return b === null ? fallback : { expr: b };
}

/** Zuweisungen `{ "vy": "-e*vy" }` — nur eigene Namen. */
export function assignsOf(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(record(value)).slice(0, 24)) {
    const name = nameOf(key);
    const expr = exprOf(raw);
    if (name !== null && expr !== null) out[name] = expr;
  }
  return out;
}

const actionOf = (value: unknown): Action | null => ((ACTIONS as readonly string[]).includes(String(value)) ? value as Action : null);
const moodOf = (value: unknown, fallback: Mood): Mood => ((MOODS as readonly string[]).includes(String(value)) ? value as Mood : fallback);
const goOf = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim().slice(0, 80) : null);

function readVar(value: unknown): VarSpec | null {
  const one = record(value);
  const name = nameOf(one.name);
  if (name === null) return null;
  const min = finite(one.min);
  const max = finite(one.max);
  const lo = min !== null && max !== null ? Math.min(min, max) : min;
  const hi = min !== null && max !== null ? Math.max(min, max) : max;
  const random = Array.isArray(one.random) && one.random.length === 2 && finite(one.random[0]) !== null && finite(one.random[1]) !== null
    ? [Math.min(one.random[0] as number, one.random[1] as number), Math.max(one.random[0] as number, one.random[1] as number)] as const
    : null;
  const step = finite(one.step);
  const start = finite(one.value) ?? lo ?? 0;
  return {
    name,
    value: clamp(start, lo ?? -1e12, hi ?? 1e12),
    min: lo, max: hi,
    step: step !== null && step > 0 ? step : null,
    unit: line(one.unit, 16),
    label: line(one.label, LIVE_LIMITS.label),
    random
  };
}

function readSim(value: unknown): SimSpec | null {
  if (typeof value !== 'object' || value === null) return null;
  const one = record(value);
  const seen = new Set<string>();
  const state: StateSpec[] = [];
  for (const raw of (Array.isArray(one.state) ? one.state : []).slice(0, LIVE_LIMITS.state)) {
    const s = record(raw);
    const name = nameOf(s.name);
    if (name === null || seen.has(name)) continue;
    seen.add(name);
    state.push({ name, value: exprOf(s.value) ?? '0', rate: exprOf(s.rate) ?? '0' });
  }
  if (state.length === 0) return null;
  const events: SimEvent[] = [];
  for (const raw of (Array.isArray(one.events) ? one.events : []).slice(0, LIVE_LIMITS.events)) {
    const e = record(raw);
    const when = exprOf(e.when);
    if (when === null) continue;
    events.push({ when, set: assignsOf(e.set), stop: e.stop === true, say: line(e.say, LIVE_LIMITS.say), mood: moodOf(e.mood, 'info') });
  }
  return {
    state,
    events,
    until: exprOf(one.until),
    dt: clamp(finite(one.dt) ?? 0.002, 0.0002, 0.05),
    speed: clamp(finite(one.speed) ?? 1, 0.05, 50),
    auto: one.auto === true,
    loop: one.loop === true,
    max: clamp(finite(one.max) ?? 600, 0.1, 3600)
  };
}

function readControl(value: unknown): ControlSpec | null {
  const one = record(value);
  const type = String(one.type ?? '');
  const label = line(one.label, LIVE_LIMITS.label);
  const digits = finite(one.digits) === null ? null : Math.round(clamp(finite(one.digits)!, 0, 6));
  switch (type) {
    case 'slider':
    case 'number': {
      const name = nameOf(one.var);
      return name === null ? null : { type, var: name, label, unit: line(one.unit, 16), digits };
    }
    case 'toggle': {
      const name = nameOf(one.var);
      return name === null ? null : { type, var: name, label };
    }
    case 'choice': {
      const name = nameOf(one.var);
      const options = (Array.isArray(one.options) ? one.options : []).slice(0, LIVE_LIMITS.options).flatMap((raw): ChoiceOption[] => {
        const o = record(raw);
        const v = finite(o.value);
        return v === null ? [] : [{ value: v, label: line(o.label, LIVE_LIMITS.label) || String(v) }];
      });
      return name === null || options.length < 2 ? null : { type, var: name, label, options };
    }
    case 'button': {
      const act = actionOf(one.do);
      const set = assignsOf(one.set);
      const go = goOf(one.go);
      return act === null && Object.keys(set).length === 0 && go === null ? null
        : { type, label: label || (act === null ? 'OK' : ACTION_LABEL[act]), do: act, set, go };
    }
    case 'readout': {
      const expr = exprOf(one.value);
      return expr === null ? null : { type, label, value: expr, unit: line(one.unit, 16), digits };
    }
    default:
      return null;
  }
}

function readRule(value: unknown): RuleSpec | null {
  const one = record(value);
  const when = exprOf(one.when);
  if (when === null) return null;
  const goal = one.goal === true;
  return {
    when,
    set: assignsOf(one.set),
    do: actionOf(one.do),
    go: goOf(one.go),
    say: line(one.say, LIVE_LIMITS.say),
    mood: moodOf(one.mood, goal ? 'ok' : 'info'),
    goal,
    once: one.once === true
  };
}

/** Was eine Zeichnung zum Anfassen macht — `null`: nichts davon (eine Zeichnung wie bisher). */
export function readLive(value: { vars?: unknown; let?: unknown; sim?: unknown; controls?: unknown; rules?: unknown; panel?: unknown }): Live | null {
  const names = new Set<string>();
  const vars: VarSpec[] = [];
  for (const raw of (Array.isArray(value.vars) ? value.vars : []).slice(0, LIVE_LIMITS.vars)) {
    const v = readVar(raw);
    if (v !== null && !names.has(v.name)) { names.add(v.name); vars.push(v); }
  }
  const lets: LetSpec[] = [];
  for (const raw of (Array.isArray(value.let) ? value.let : []).slice(0, LIVE_LIMITS.lets)) {
    const one = record(raw);
    const name = nameOf(one.name);
    const expr = exprOf(one.value);
    if (name !== null && expr !== null && !names.has(name)) { names.add(name); lets.push({ name, value: expr }); }
  }
  const sim = readSim(value.sim);
  const controls = (Array.isArray(value.controls) ? value.controls : []).slice(0, LIVE_LIMITS.controls)
    .map(readControl).filter((c): c is ControlSpec => c !== null);
  const rules = (Array.isArray(value.rules) ? value.rules : []).slice(0, LIVE_LIMITS.rules)
    .map(readRule).filter((r): r is RuleSpec => r !== null);
  if (vars.length === 0 && lets.length === 0 && sim === null && controls.length === 0 && rules.length === 0) return null;
  return { vars, lets, sim, controls, rules, panel: value.panel === 'side' ? 'side' : 'below' };
}

export function readDrag(value: unknown): DragSpec | null {
  if (typeof value === 'string') {
    const name = nameOf(value);
    return name === null ? null : { x: name, y: null, set: {}, label: '' };
  }
  if (typeof value !== 'object' || value === null) return null;
  const one = record(value);
  const drag = { x: nameOf(one.x), y: nameOf(one.y), set: assignsOf(one.set), label: line(one.label, LIVE_LIMITS.label) };
  return drag.x === null && drag.y === null && Object.keys(drag.set).length === 0 ? null : drag;
}

export function readTap(value: unknown): TapSpec | null {
  if (typeof value === 'string') {
    const act = actionOf(value);
    return act === null ? null : { set: {}, do: act, go: null, label: '' };
  }
  if (typeof value !== 'object' || value === null) return null;
  const one = record(value);
  const tap = { set: assignsOf(one.set), do: actionOf(one.do), go: goOf(one.go), label: line(one.label, LIVE_LIMITS.label) };
  return Object.keys(tap.set).length === 0 && tap.do === null && tap.go === null ? null : tap;
}

export function readAxes(value: unknown): Axes | null {
  if (value === true) return { x: '', y: '', grid: false };
  if (typeof value !== 'object' || value === null) return null;
  const one = record(value);
  return { x: line(one.x, 40), y: line(one.y, 40), grid: one.grid === true };
}
