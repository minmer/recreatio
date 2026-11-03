/**
 * 2026-10-17 — DIE SPRACHE DER RECHNUNGEN in einem bewegten Bild: kleine
 * Ausdrücke wie `v0*cos(rad(kat))`, `y < 0 && vy < 0` oder
 * `trafione ? 'ok' : 'muted'`.
 *
 * <b>Sicher gelesen, nie ausgeführt.</b> Kein `eval`, kein `Function`: ein
 * kleiner Leser macht aus dem Text einen Baum aus Funktionen, und gerechnet
 * wird nur, was hier steht — Zahlen, Texte in Anführungszeichen, Namen,
 * die Rechenzeichen und die Funktionen der Liste unten. Ein Name, der nicht
 * bekannt ist, ist beim Übersetzen ein Fehler (der Editor sagt wo) und beim
 * Rechnen 0.
 *
 * <b>Einmal übersetzen, oft rechnen.</b> Ein Bild rechnet seine Ausdrücke bis
 * zu sechzigmal in der Sekunde, eine Simulation einige hundert Mal: der Baum
 * wird einmal gebaut, was nur aus Zahlen besteht, gleich ausgerechnet.
 *
 * <code>
 *   Rechnen      + - * / % ^ (Potenz)     -x^2 = -(x²)
 *   Vergleiche   < <= > >= == !=          ergeben 1 oder 0
 *   Logik        && || !  ·  w ? a : b    (wahr ist alles außer 0 und "")
 *   Texte        'tekst' + liczba         fmt(x, 2) — mit Komma, wie im Polnischen
 * </code>
 *
 * 2026-11-03 — DIESELBE SPRACHE FÜR GENERIERTE AUFGABEN (`cogita/generator.ts`, COGITA-WORLD.md): Listen und
 * Datensätze (ein gezogener Eintrag mit seinen Feldern), Funktionen über Listen mit einem Ausdruck je Element
 * (`filter(jony, it.ladung > 0)`, `it` das Element, `i` seine Stelle), Logik (`if`), Rechnen (`gcd`, `lcm`, `log(x, b)`,
 * `sig` …) und Text (`sub`, `sup`, `plain` …). Die Schreibweisen `[1, 2]`, `xs[0]` und `kation.ladung` gibt es nur mit
 * `lists: true` (der Generator) — im bewegten Bild bleiben sie, was sie waren: Fehler. Gezogen wird mit dem Samen der
 * Aufgabe (`shuffle`, `choose`, `pick`); jede Rechnung hat eine Obergrenze an Arbeit (`WORK_LIMIT`).
 *
 * Rein und ohne Oberfläche — geprüft in `app-sim-check` und `app-generator-check`.
 */

import { AGGREGATES, RELATIONS, SETS } from './liveModel';

/**
 * 2026-11-03 — EIN DATENSATZ: ein gezogener Eintrag mit `id`, `label` und seinen Feldern beim Schlüssel — gelesen mit
 * `it.ladung`, nie als Objekt von JavaScript (kein `constructor`, kein Prototyp).
 */
export interface ValRecord {
  readonly $record: true;
  readonly fields: Readonly<Record<string, Val>>;
}
/** 2026-11-03 — eine Liste von Werten (unveränderlich: Funktionen geben neue zurück). */
export type ValList = readonly Val[];
export type Val = number | string | ValList | ValRecord;
export type Env = Record<string, Val>;
type Run = (env: Env) => Val;

export const isList = (v: unknown): v is ValList => Array.isArray(v);
export const isRecord = (v: unknown): v is ValRecord => typeof v === 'object' && v !== null && !Array.isArray(v) && (v as { $record?: unknown }).$record === true;

/** Ein Datensatz aus Feldern — ohne Prototyp, eingefroren. */
export function makeRecord(fields: Readonly<Record<string, Val>>): ValRecord {
  const own = Object.assign(Object.create(null) as Record<string, Val>, fields);
  return Object.freeze({ $record: true as const, fields: Object.freeze(own) });
}

/** Ein Feld eines Datensatzes — fehlt es (oder ist es kein Datensatz), ''. */
export function fieldOf(v: Val, key: string): Val {
  if (!isRecord(v)) return '';
  return Object.prototype.hasOwnProperty.call(v.fields, key) ? v.fields[key]! : '';
}

/** Die Kennung eines Datensatzes (eines Eintrags) — sonst ''. */
export const recordId = (v: Val): string => { const id = fieldOf(v, 'id'); return typeof id === 'string' ? id : ''; };

export interface Expr {
  readonly source: string;
  readonly run: Run;
  /** Die Namen, die er liest — ohne Funktionen und Konstanten. */
  readonly reads: readonly string[];
  /** Ohne Namen: sein Wert ändert sich nie. */
  readonly constant: boolean;
  /**
   * 2026-10-18 — WOHER ER IN EINER WELT LIEST: je Name der Weg dorthin —
   * `total` (das eigene), `children>total` (in jedem Kind), `parent>x`,
   * `@wyjscie>omega` (ein Ding beim Namen). Daraus folgt, in welcher
   * Reihenfolge die Rechnungen aller Dinge laufen (`liveWorld.ts`).
   */
  readonly links: readonly string[];
}

export interface ExprError {
  readonly error: string;
  /** Wo im Text (Zeichen). */
  readonly at: number;
  readonly source: string;
}

export const isExprError = (value: Expr | ExprError): value is ExprError => 'error' in value;

/* -- 2026-10-18: die Welt (`liveWorld.ts`) ------------------------------------------- */

/**
 * WAS EINE WELT IN EINE UMGEBUNG LEGT: Schlüssel mit `$`, die kein Name eines
 * Ausdrucks sein können. Ein Ding hat seine eigene Umgebung (sein Prototyp ist
 * die des ganzen Bildes — was es nicht selbst hat, kommt von dort), mit seinem
 * Elternteil, seinen Kindern, seiner Wurzel und seiner Art; die Umgebung des
 * Bildes trägt das Verzeichnis der Welt.
 */
export interface WorldLinks {
  readonly $parent?: Env;
  readonly $children?: readonly Env[];
  readonly $root?: Env;
  readonly $kind?: string;
  readonly $world?: WorldIndex;
  /** 2026-10-18 — was man an diesem Ding ändern darf, je Eigenschaft 1 oder 0 (`can.pos`). */
  readonly $can?: Readonly<Record<string, number>>;
}

/** Das Verzeichnis einer Welt: alle Dinge (Eltern vor Kindern), die Wurzeln, je Art, je Kennung — und wer gerade zusammenfasst (`outer`). */
export interface WorldIndex {
  readonly all: readonly Env[];
  readonly roots: readonly Env[];
  readonly byKind: ReadonlyMap<string, readonly Env[]>;
  readonly byId: ReadonlyMap<string, Env>;
  readonly outer: Env[];
}

/*
 * Worüber sich zusammenfassen lässt (`SETS`: die Kinder eines Dings, alle
 * darunter, seine Geschwister, die anderen seiner Art, alle Dinge — oder alle
 * einer Art beim Namen), wer ein anderes Ding ist (`RELATIONS`, oder ein Ding
 * beim Namen: `wyjscie.omega`) und wie zusammengefasst wird (`AGGREGATES`)
 * steht in `liveModel.ts` — dort, wo auch die eigenen Namen geprüft werden.
 */

/** Wie übersetzt wird: welche Namen es gibt, welche Arten eine Welt hat. */
export interface CompileOptions {
  readonly known?: (name: string) => boolean;
  readonly kinds?: ReadonlySet<string>;
  /**
   * 2026-11-03 — DIE SCHREIBWEISEN DES GENERATORS: Listen `[1, 2]`, `xs[0]`, Felder eines Datensatzes `kation.ladung`
   * (auch nach einer Funktion: `first(xs).label`). Ohne: wie bisher — `a.b` und `a[0]` sind Fehler.
   */
  readonly lists?: boolean;
}

const links = (env: Env): WorldLinks => env as unknown as WorldLinks;

function setOf(env: Env, set: string): readonly Env[] {
  const l = links(env);
  const world = l.$world;
  switch (set) {
    case 'children': return l.$children ?? [];
    case 'descendants': {
      const out: Env[] = [];
      const walk = (e: Env) => { for (const c of links(e).$children ?? []) { out.push(c); walk(c); } };
      walk(env);
      return out;
    }
    case 'siblings': return (l.$parent === undefined ? world?.roots ?? [] : links(l.$parent).$children ?? []).filter((e) => e !== env);
    case 'others': return (world?.byKind.get(l.$kind ?? '') ?? []).filter((e) => e !== env);
    case 'things': return world?.all ?? [];
    default: return world?.byKind.get(set) ?? [];
  }
}

/** Ein Schritt von einem Ding zum nächsten — `undefined`: dort ist keines. */
function hop(env: Env, step: string): Env | undefined {
  const l = links(env);
  switch (step) {
    case 'parent': return l.$parent;
    case 'root': return l.$root ?? env;
    case 'self': return env;
    case 'outer': { const o = l.$world?.outer; return o === undefined || o.length === 0 ? undefined : o[o.length - 1]; }
    default: return l.$world?.byId.get(step);
  }
}

/** Wie lang ein Ausdruck höchstens ist, und wie tief geschachtelt. 2026-11-03: `items` — Stellen einer Liste im Text. */
export const EXPR_LIMITS = { length: 1200, depth: 60, args: 16, items: 200 } as const;

/**
 * 2026-11-03 — DIE OBERGRENZE DER ARBEIT einer Rechnung mit Listen: so viele Elemente dürfen Funktionen über Listen
 * zusammen anfassen, und so lang darf eine Liste werden. Darüber ist das Ergebnis NaN (`takeOverrun` sagt es).
 */
export const WORK_LIMIT = 200_000;
export const LIST_LIMIT = 2000;
let work = 0;
let overran = false;
class Overrun extends Error {}
const spend = (n = 1): void => {
  work += n;
  if (work > WORK_LIMIT) throw new Overrun();
};
/** Eine Liste, die nicht länger sein darf als `LIST_LIMIT` — sonst gilt die Rechnung als zu gross. */
const capped = <T>(list: T[]): T[] => {
  if (list.length > LIST_LIMIT) throw new Overrun();
  spend(list.length);
  return list;
};
/** War seit der letzten Frage eine Rechnung zu gross? (Und vergiss es.) */
export function takeOverrun(): boolean {
  const was = overran;
  overran = false;
  return was;
}

/* -- Zahlen und Texte ------------------------------------------------------------- */

/** Ein Wert als Zahl: ein Text mit Komma oder Punkt wird gelesen, sonst NaN (auch eine Liste, ein Datensatz). */
export function toNum(v: Val): number {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return NaN;
  const t = v.trim().replace(',', '.').replace('−', '-');
  return t === '' ? NaN : Number(t);
}

/** Wahr ist alles außer 0, NaN und dem leeren Text — 2026-11-03: und der leeren Liste. */
export const truth = (v: Val): boolean => (typeof v === 'number' ? v !== 0 && !Number.isNaN(v) : typeof v === 'string' ? v !== '' : isList(v) ? v.length > 0 : true);

/** Eine Zahl mit `digits` Stellen, mit Komma und echtem Minus — so, wie man sie in Polen schreibt. */
export function fmt(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return Number.isNaN(n) ? '–' : n > 0 ? '∞' : '−∞';
  const d = Math.max(0, Math.min(8, Math.round(digits)));
  const fixed = n.toFixed(d);
  const clean = /^-0(\.0+)?$/.test(fixed) ? fixed.slice(1) : fixed;
  return clean.replace('.', ',').replace('-', '−');
}

/** Eine Zahl in einem Text, ohne gesagte Stellen: höchstens drei, ohne Nullen am Ende. */
export function show(n: number): string {
  if (!Number.isFinite(n)) return fmt(n);
  return fmt(Math.round(n * 1000) / 1000, 3).replace(/0+$/, '').replace(/,$/, '');
}

/**
 * Ein Wert als Text: eine Zahl höchstens mit drei Stellen (`show`), 2026-11-03 eine Liste durch Kommas, ein Datensatz
 * mit seinem `label`.
 */
const text = (v: Val): string => (typeof v === 'string' ? v : typeof v === 'number' ? show(v) : isList(v) ? v.slice(0, 50).map(text).join(', ') : textOfField(fieldOf(v, 'label')) || recordId(v));
const textOfField = (v: Val): string => (typeof v === 'string' ? v : typeof v === 'number' ? show(v) : '');

/** 2026-11-03 — derselbe Text nach aussen (der Generator setzt Werte in Texte). */
export const valueText = (v: Val): string => text(v);

/** 2026-11-03 — eine Zahl mit bis zu zwölf gültigen Stellen, mit Komma, einfachem Minus und ohne Exponent — `str(x)`. */
export function numberWords(n: number): string {
  if (!Number.isFinite(n)) return fmt(n);
  const r = Number(n.toPrecision(12));
  let s = String(r);
  if (/e/i.test(s)) s = r.toFixed(12).replace(/0+$/, '').replace(/\.$/, '');
  /* Mit dem einfachen Minus — so, wie man es tippt (wie die Werte in den Platzhaltern). */
  return s.replace('.', ',');
}

/* -- 2026-11-03: Hoch- und tiefgestellte Zeichen (Formeln wie Al₂(SO₄)₃) ------------------- */

const SUB = '₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎';
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾';
const PLAIN = '0123456789+-=()';
const mapChars = (s: string, from: string, to: string): string => Array.from(s).map((c) => { const i = from.indexOf(c); return i < 0 ? c : to[i]!; }).join('');
/** Ziffern und + − = ( ) tiefgestellt. */
export const subscript = (s: string): string => mapChars(s.replace(/−/g, '-'), PLAIN, SUB);
/** Ziffern und + − = ( ) hochgestellt. */
export const superscript = (s: string): string => mapChars(s.replace(/−/g, '-'), PLAIN, SUP);
/** Hoch- und Tiefgestelltes wieder normal: „Al₂(SO₄)₃" → „Al2(SO4)3", „Al³⁺" → „Al3+". */
export const plainScripts = (s: string): string => mapChars(mapChars(s, SUB, PLAIN), SUP, PLAIN);

/* -- Die Funktionen -------------------------------------------------------------- */

interface Fun {
  readonly min: number;
  readonly max: number;
  readonly run: (...args: number[]) => Val;
  readonly says: string;
}

const fun = (min: number, max: number, run: (...args: number[]) => Val, says: string): Fun => ({ min, max, run, says });

/** Ein Zufall, der zu derselben Zahl immer derselbe ist (0–1) — für Teilchen, die verschieden aussehen sollen. */
function hash01(x: number): number {
  let h = Math.imul(Math.round(x * 1000) | 0, 0x9e3779b1) ^ 0x85ebca6b;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const FUNCTIONS: Readonly<Record<string, Fun>> = {
  sin: fun(1, 1, Math.sin, 'sinus (kąt w radianach — rad(30) zamienia stopnie)'),
  cos: fun(1, 1, Math.cos, 'cosinus (radiany)'),
  tan: fun(1, 1, Math.tan, 'tangens (radiany)'),
  asin: fun(1, 1, Math.asin, 'arcus sinus — wynik w radianach (deg(...) zamienia na stopnie)'),
  acos: fun(1, 1, Math.acos, 'arcus cosinus (radiany)'),
  atan: fun(1, 1, Math.atan, 'arcus tangens (radiany)'),
  atan2: fun(2, 2, (y, x) => Math.atan2(y, x), 'atan2(y, x) — kąt wektora (x, y) w radianach'),
  sinh: fun(1, 1, Math.sinh, 'sinus hiperboliczny'),
  cosh: fun(1, 1, Math.cosh, 'cosinus hiperboliczny'),
  tanh: fun(1, 1, Math.tanh, 'tangens hiperboliczny'),
  sqrt: fun(1, 1, Math.sqrt, 'pierwiastek kwadratowy'),
  cbrt: fun(1, 1, Math.cbrt, 'pierwiastek sześcienny'),
  abs: fun(1, 1, Math.abs, 'wartość bezwzględna'),
  sign: fun(1, 1, Math.sign, 'znak: −1, 0 albo 1'),
  floor: fun(1, 1, Math.floor, 'w dół do całości'),
  ceil: fun(1, 1, Math.ceil, 'w górę do całości'),
  trunc: fun(1, 1, Math.trunc, 'część całkowita'),
  round: fun(1, 2, (x, d = 0) => { const f = 10 ** Math.max(0, Math.min(8, Math.round(d))); return Math.round(x * f) / f; }, 'round(x) albo round(x, cyfry) — zaokrąglenie'),
  min: fun(1, 16, (...a) => Math.min(...a), 'najmniejsza z liczb'),
  max: fun(1, 16, (...a) => Math.max(...a), 'największa z liczb'),
  clamp: fun(3, 3, (x, a, b) => Math.min(Math.max(x, Math.min(a, b)), Math.max(a, b)), 'clamp(x, od, do) — x przycięte do przedziału'),
  lerp: fun(3, 3, (a, b, t) => a + (b - a) * t, 'lerp(a, b, t) — od a do b: t = 0 daje a, t = 1 daje b'),
  exp: fun(1, 1, Math.exp, 'e do potęgi x'),
  ln: fun(1, 1, Math.log, 'logarytm naturalny'),
  log10: fun(1, 1, Math.log10, 'logarytm dziesiętny'),
  log2: fun(1, 1, Math.log2, 'logarytm o podstawie 2'),
  pow: fun(2, 2, (a, b) => a ** b, 'pow(a, b) — to samo co a^b'),
  hypot: fun(1, 16, (...a) => Math.hypot(...a), 'hypot(x, y) — długość wektora'),
  deg: fun(1, 1, (x) => (x * 180) / Math.PI, 'radiany na stopnie'),
  rad: fun(1, 1, (x) => (x * Math.PI) / 180, 'stopnie na radiany'),
  mod: fun(2, 2, (a, b) => (b === 0 ? NaN : ((a % b) + b) % b), 'mod(a, b) — reszta, zawsze od 0 do b (także dla ujemnych)'),
  step: fun(2, 2, (edge, x) => (x >= edge ? 1 : 0), 'step(próg, x) — 0 przed progiem, 1 od progu'),
  smooth: fun(3, 3, (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a || 1))); return t * t * (3 - 2 * t); }, 'smooth(od, do, x) — łagodnie od 0 do 1, gdy x idzie od „od" do „do"'),
  tri: fun(1, 1, (x) => 1 - Math.abs(2 * (x - Math.floor(x)) - 1), 'tri(x) — fala trójkątna 0 → 1 → 0, okres 1 (odbijanie, zygzak)'),
  rand: fun(1, 1, hash01, 'rand(x) — „losowa" liczba 0–1, zawsze ta sama dla tego samego x (np. rand(i) dla każdej kopii)'),
  onstep: fun(2, 2, (x, s) => (s > 0 && Math.abs(x / s - Math.round(x / s)) < 1e-7 ? 1 : 0), 'onstep(x, krok) — 1, gdy x leży na siatce kroku (onstep(2.25, 0.25) → 1): warunek zadań losowych, żeby rozwiązanie dało się ustawić'),
  /* 2026-11-03 — dla zadań generowanych (`cogita/generator.ts`), w rysunkach tak samo. */
  root: fun(2, 2, (x, n) => (n === 0 ? NaN : x < 0 && Math.abs(n % 2) === 1 ? -((-x) ** (1 / n)) : x ** (1 / n)), 'root(x, n) — pierwiastek stopnia n (root(27, 3) → 3; z liczby ujemnej tylko nieparzystego stopnia)'),
  /* Auf 15 Stellen: log(1000) ist 3, nicht 2,9999999999999996 — ein Generator rechnet mit dem Ergebnis weiter. */
  log: fun(1, 2, (x, b = 10) => (b <= 0 || b === 1 ? NaN : Number((b === 10 ? Math.log10(x) : b === 2 ? Math.log2(x) : Math.log(x) / Math.log(b)).toPrecision(15))), 'log(x) — dziesiętny, log(x, b) — o podstawie b: log(8, 2) → 3'),
  sig: fun(2, 2, (x, n) => (Number.isFinite(x) && n >= 1 ? Number(x.toPrecision(Math.min(15, Math.max(1, Math.round(n))))) : NaN), 'sig(x, n) — zaokrąglenie do n cyfr znaczących: sig(0.012345, 2) → 0,012'),
  fact: fun(1, 1, (n) => { if (!Number.isInteger(n) || n < 0 || n > 170) return NaN; let r = 1; for (let k = 2; k <= n; k += 1) r *= k; return r; }, 'fact(n) — silnia n! (n całkowite 0–170)'),
  binom: fun(2, 2, (n, k) => { if (!Number.isInteger(n) || !Number.isInteger(k) || k < 0 || n < 0 || k > n) return k > n ? 0 : NaN; let r = 1; for (let j = 1; j <= Math.min(k, n - k); j += 1) r = (r * (n - Math.min(k, n - k) + j)) / j; return Math.round(r); }, 'binom(n, k) — symbol Newtona: na ile sposobów wybrać k z n'),
  isint: fun(1, 1, (x) => (Number.isFinite(x) && Math.abs(x - Math.round(x)) < 1e-9 ? 1 : 0), 'isint(x) — 1, gdy x jest liczbą całkowitą (warunek: wynik ma być całkowity)'),
  fmt: fun(1, 2, (x, d = 1) => fmt(x, d), 'fmt(x, cyfry) — liczba jako tekst z przecinkiem: fmt(9.81, 1) → "9,8"')
};

/* -- 2026-11-03: Funktionen über Werte — Listen, Texte, Datensätze ------------------------------------- */

/** Der Zufall einer Aufgabe liegt in der Umgebung unter einem Schlüssel, den kein Name erreicht (`withRng`). */
const RNG = '$rng';

/** mulberry32 mit festem Samen — wo keine Aufgabe ihren Zufall gibt (ein bewegtes Bild): immer dieselbe Folge. */
function steadyRng(): () => number {
  let a = 0x9e3779b1 >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rngIn = (env: Env): (() => number) => {
  const own = (env as unknown as Record<string, unknown>)[RNG];
  return typeof own === 'function' ? (own as () => number) : steadyRng();
};

/** Gibt einer Umgebung den Zufall einer Aufgabe — `shuffle`, `choose`, `pick` ziehen damit (gleicher Same, gleiche Aufgabe). */
export function withRng<E extends Env>(env: E, rng: () => number): E {
  Object.defineProperty(env, RNG, { value: rng, enumerable: false, configurable: true });
  return env;
}

/** Als Liste: eine Liste, wie sie ist; nichts ('') leer; jeder andere Wert eine Liste mit ihm allein. */
const asList = (v: Val): ValList => (isList(v) ? v : v === '' ? [] : [v]);

/** Gleich: Texte als Texte, Listen Stelle für Stelle, Datensätze nach der Kennung (auch mit ihr als Text), sonst als Zahlen. */
export function same(x: Val, y: Val): boolean {
  if (typeof x === 'string' && typeof y === 'string') return x === y;
  if (isList(x) || isList(y)) return isList(x) && isList(y) && x.length === y.length && x.every((v, i) => same(v, y[i]!));
  if (isRecord(x) || isRecord(y)) {
    if (isRecord(x) && isRecord(y)) return recordId(x) === recordId(y);
    const other = isRecord(x) ? y : x;
    return typeof other === 'string' && other === recordId(isRecord(x) ? x : y);
  }
  return toNum(x) === toNum(y);
}

/** Vergleich zum Ordnen: Zahlen als Zahlen, Texte (die keine Zahlen sind) nach dem Alphabet, Datensätze nach `label`. */
function order(a: Val, b: Val): number {
  const x = isRecord(a) ? fieldOf(a, 'label') : a;
  const y = isRecord(b) ? fieldOf(b, 'label') : b;
  if (typeof x === 'string' && typeof y === 'string') {
    const nx = toNum(x);
    const ny = toNum(y);
    if (Number.isNaN(nx) || Number.isNaN(ny)) return x.localeCompare(y, 'pl');
    return nx - ny;
  }
  const d = toNum(x) - toNum(y);
  return Number.isNaN(d) ? 0 : d;
}

const numbersIn = (values: readonly Val[]): number[] => values.flatMap((v) => (isList(v) ? v.map(toNum) : [toNum(v)]));

function gcdOf(values: readonly number[]): number {
  let g = 0;
  for (const v of values) {
    if (!Number.isInteger(v)) return NaN;
    let a = Math.abs(g);
    let b = Math.abs(v);
    while (b !== 0) [a, b] = [b, a % b];
    g = a;
  }
  return g;
}

function lcmOf(values: readonly number[]): number {
  let l = 1;
  for (const v of values) {
    if (!Number.isInteger(v)) return NaN;
    if (v === 0) return 0;
    l = Math.abs((l / gcdOf([l, v])) * v);
    if (l > 1e15) return NaN;
  }
  return values.length === 0 ? NaN : l;
}

/** Eine Zahl als Text so, wie man sie liest — `str`, `sub`, `sup`. */
const wordsOf = (v: Val): string => (typeof v === 'number' ? numberWords(v) : text(v));

/** Höchstens `k` verschiedene Elemente, zufällig — ohne die ganze Liste zu mischen, wenn sie gross ist. */
function sampleOf(list: ValList, k: number, rng: () => number): Val[] {
  const n = Math.max(0, Math.min(list.length, Math.floor(k)));
  const idx = list.map((_v, i) => i);
  for (let i = 0; i < n; i += 1) {
    const j = i + Math.floor(rng() * (idx.length - i));
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  spend(n);
  return idx.slice(0, n).map((i) => list[i]!);
}

interface ValueFun {
  readonly min: number;
  readonly max: number;
  readonly run: (args: readonly Val[], env: Env) => Val;
  readonly says: string;
}

const vfun = (min: number, max: number, run: (args: readonly Val[], env: Env) => Val, says: string): ValueFun => ({ min, max, run, says });

/** Die Stelle einer Liste (auch von hinten: −1 die letzte) — ausserhalb ''. Ein Text gibt sein Zeichen. */
export function itemAt(v: Val, at: Val): Val {
  const i = Math.trunc(toNum(at));
  if (!Number.isFinite(i)) return '';
  if (typeof v === 'string') { const chars = Array.from(v); const k = i < 0 ? chars.length + i : i; return chars[k] ?? ''; }
  if (!isList(v)) return '';
  const k = i < 0 ? v.length + i : i;
  return v[k] ?? '';
}

/** Die Funktionen, die Werte bekommen, wie sie sind (Listen, Texte, Datensätze). */
export const VALUE_FUNCTIONS: Readonly<Record<string, ValueFun>> = {
  len: vfun(1, 1, ([x]) => (isList(x!) ? x.length : typeof x === 'string' ? Array.from(x).length : 0), 'len(x) — ile elementów ma lista (albo znaków tekst)'),
  first: vfun(1, 1, ([x]) => asList(x!)[0] ?? '', 'first(lista) — pierwszy element'),
  last: vfun(1, 1, ([x]) => { const l = asList(x!); return l[l.length - 1] ?? ''; }, 'last(lista) — ostatni element'),
  at: vfun(2, 2, ([x, i]) => itemAt(x!, i!), 'at(lista, i) — element na miejscu i, licząc od 0 (−1: ostatni); to samo co lista[i]'),
  take: vfun(2, 2, ([x, k]) => asList(x!).slice(0, Math.max(0, Math.floor(toNum(k!)) || 0)), 'take(lista, k) — pierwsze k elementów'),
  drop: vfun(2, 2, ([x, k]) => asList(x!).slice(Math.max(0, Math.floor(toNum(k!)) || 0)), 'drop(lista, k) — bez pierwszych k elementów'),
  slice: vfun(2, 3, ([x, a, b]) => asList(x!).slice(Math.trunc(toNum(a!)) || 0, b === undefined ? undefined : Math.trunc(toNum(b)) || 0), 'slice(lista, od, do) — kawałek: od włącznie, do wyłącznie (od 0; ujemne liczą od końca)'),
  reverse: vfun(1, 1, ([x]) => asList(x!).slice().reverse(), 'reverse(lista) — w odwrotnej kolejności'),
  sort: vfun(1, 1, ([x]) => { const l = asList(x!); spend(l.length); return l.slice().sort(order); }, 'sort(lista) — rosnąco: liczby według wartości, teksty alfabetycznie, wpisy według nazwy (malejąco: reverse(sort(lista)))'),
  shuffle: vfun(1, 1, ([x], env) => sampleOf(asList(x!), asList(x!).length, rngIn(env)), 'shuffle(lista) — losowo przemieszana (los zadania: ten sam numer zadania, ta sama kolejność)'),
  choose: vfun(2, 2, ([x, k], env) => sampleOf(asList(x!), toNum(k!), rngIn(env)), 'choose(lista, k) — k różnych elementów wybranych losowo (bez powtórzeń)'),
  pick: vfun(1, 1, ([x], env) => sampleOf(asList(x!), 1, rngIn(env))[0] ?? '', 'pick(lista) — jeden element wybrany losowo'),
  contains: vfun(2, 2, ([x, v]) => (typeof x === 'string' && typeof v === 'string' ? (x.includes(v) ? 1 : 0) : asList(x!).some((y) => same(y, v!)) ? 1 : 0), 'contains(lista, x) — 1, gdy x jest na liście (w tekście: gdy tekst zawiera x)'),
  index: vfun(2, 2, ([x, v]) => (typeof x === 'string' && typeof v === 'string' ? x.indexOf(v) : asList(x!).findIndex((y) => same(y, v!))), 'index(lista, x) — miejsce x na liście, od 0 (−1: nie ma)'),
  unique: vfun(1, 1, ([x]) => { const out: Val[] = []; for (const v of asList(x!)) { spend(); if (!out.some((y) => same(y, v))) out.push(v); } return out; }, 'unique(lista) — każdy element raz'),
  range: vfun(2, 3, ([a, b, s]) => {
    const from = toNum(a!);
    const to = toNum(b!);
    const step = s === undefined ? (to >= from ? 1 : -1) : toNum(s);
    if (!Number.isFinite(from) || !Number.isFinite(to) || !Number.isFinite(step) || step === 0 || (to - from) / step < 0) return [];
    const n = Math.floor((to - from) / step + 1e-9) + 1;
    if (n > LIST_LIMIT) throw new Overrun();
    return capped(Array.from({ length: n }, (_v, i) => Number((from + i * step).toPrecision(12))));
  }, 'range(od, do, krok) — liczby od…do WŁĄCZNIE (range(1, 5) → [1, 2, 3, 4, 5]); krok domyślnie 1'),
  join: vfun(1, 2, ([x, sep]) => asList(x!).map(wordsOf).join(sep === undefined ? ', ' : text(sep)), 'join(lista, separator) — elementy w jednym tekście (domyślnie przez przecinek)'),
  concat: vfun(1, 16, (args) => capped(args.flatMap((v) => (isList(v) ? [...v] : [v]))), 'concat(a, b, …) — listy połączone w jedną (pojedyncza wartość dochodzi jako element)'),
  list: vfun(0, 16, (args) => [...args], 'list(a, b, …) — lista z tych wartości (to samo co [a, b, …])'),
  get: vfun(2, 2, ([r, k]) => fieldOf(r!, text(k!)), 'get(wpis, "klucz") — pole wpisu po kluczu (to samo co wpis.klucz)'),
  str: vfun(1, 1, ([x]) => wordsOf(x!), 'str(x) — jako tekst; liczba z przecinkiem, do 12 cyfr znaczących'),
  num: vfun(1, 1, ([x]) => toNum(x!), 'num(tekst) — liczba z tekstu ("3,5" → 3.5)'),
  sub: vfun(1, 1, ([x]) => subscript(wordsOf(x!)), 'sub(x) — cyfry i znaki + − ( ) w indeksie dolnym: "SO" + sub(4) → "SO₄"'),
  sup: vfun(1, 1, ([x]) => superscript(wordsOf(x!)), 'sup(x) — w indeksie górnym: "Al" + sup("3+") → "Al³⁺"'),
  plain: vfun(1, 1, ([x]) => plainScripts(wordsOf(x!)), 'plain(x) — indeksy z powrotem jako zwykłe znaki: "Al₂(SO₄)₃" → "Al2(SO4)3"'),
  upper: vfun(1, 1, ([x]) => wordsOf(x!).toLocaleUpperCase('pl-PL'), 'upper(tekst) — wielkimi literami'),
  lower: vfun(1, 1, ([x]) => wordsOf(x!).toLocaleLowerCase('pl-PL'), 'lower(tekst) — małymi literami'),
  gcd: vfun(1, 16, (args) => gcdOf(numbersIn(args)), 'gcd(a, b, …) — największy wspólny dzielnik liczb całkowitych (także listy)'),
  lcm: vfun(1, 16, (args) => lcmOf(numbersIn(args)), 'lcm(a, b, …) — najmniejsza wspólna wielokrotność (także listy): lcm(3, 2) → 6')
};

/** Ein Element nach dem anderen: der Ausdruck in einer Umgebung mit `it` (dem Element) und `i` (seiner Stelle, ab 0). */
function perItem(env: Env, node: Node, item: Val, i: number): Val {
  spend();
  const child = Object.create(env) as Env;
  child.it = item;
  child.i = i;
  return node.run(child);
}

interface LazyFun {
  readonly min: number;
  readonly max: number;
  /** Ab welchem Argument ein Ausdruck je Element ist (mit `it`, `i`) — `Infinity`: keiner. */
  readonly from: number;
  readonly run: (args: readonly Node[], env: Env) => Val;
  readonly says: string;
}

const lfun = (min: number, max: number, from: number, run: (args: readonly Node[], env: Env) => Val, says: string): LazyFun => ({ min, max, from, run, says });

/** `sum(xs)`, `sum(xs, it.masa)` — die Werte, über die zusammengefasst wird. */
function valuesBy(args: readonly Node[], env: Env): Val[] {
  const list = asList(args[0]!.run(env));
  return args.length < 2 ? [...list] : list.map((item, i) => perItem(env, args[1]!, item, i));
}

/** `min(a, b, c)` wie bisher; `min(xs)` über eine Liste; `min(xs, it.data)` über einen Ausdruck je Element. */
function extreme(args: readonly Node[], env: Env, pick: (a: number, b: number) => number): Val {
  const firstValue = args[0]!.run(env);
  const numbers = isList(firstValue) && args.length === 2
    ? firstValue.map((item, i) => toNum(perItem(env, args[1]!, item, i)))
    : numbersIn([firstValue, ...args.slice(1).map((a) => a.run(env))]);
  return numbers.length === 0 ? NaN : numbers.reduce((a, b) => pick(a, b));
}

/** Das Element mit dem kleinsten (grössten) Wert des Ausdrucks — `minby(wydarzenia, it.data)`. */
function extremeBy(args: readonly Node[], env: Env, sign: 1 | -1): Val {
  const list = asList(args[0]!.run(env));
  let best: Val = '';
  let bestKey: Val | null = null;
  list.forEach((item, i) => {
    const key = perItem(env, args[1]!, item, i);
    if (bestKey === null || sign * order(key, bestKey) < 0) { best = item; bestKey = key; }
  });
  return best;
}

/** Die Funktionen, deren Argumente erst in ihnen gerechnet werden: `if` und die über Listen mit einem Ausdruck je Element. */
export const LAZY_FUNCTIONS: Readonly<Record<string, LazyFun>> = {
  if: lfun(3, 3, Infinity, (a, env) => (truth(a[0]!.run(env)) ? a[1]!.run(env) : a[2]!.run(env)), 'if(warunek, a, b) — a, gdy warunek jest spełniony, inaczej b (to samo co warunek ? a : b)'),
  filter: lfun(2, 2, 1, (a, env) => asList(a[0]!.run(env)).filter((item, i) => truth(perItem(env, a[1]!, item, i))), 'filter(lista, warunek) — te elementy, dla których warunek jest spełniony: filter(jony, it.ladunek > 0)'),
  map: lfun(2, 2, 1, (a, env) => capped(asList(a[0]!.run(env)).map((item, i) => perItem(env, a[1]!, item, i))), 'map(lista, wyrażenie) — wyrażenie dla każdego elementu: map(wydarzenia, it.label)'),
  sortby: lfun(2, 2, 1, (a, env) => {
    const list = asList(a[0]!.run(env));
    const keyed = list.map((item, i) => ({ item, key: perItem(env, a[1]!, item, i), i }));
    spend(keyed.length);
    return keyed.sort((x, y) => order(x.key, y.key) || x.i - y.i).map((x) => x.item);
  }, 'sortby(lista, klucz) — rosnąco według wyrażenia: sortby(wydarzenia, it.data) — od najwcześniejszego'),
  find: lfun(2, 2, 1, (a, env) => { const list = asList(a[0]!.run(env)); for (let i = 0; i < list.length; i += 1) if (truth(perItem(env, a[1]!, list[i]!, i))) return list[i]!; return ''; }, 'find(lista, warunek) — pierwszy element, który spełnia warunek (nie ma: "")'),
  any: lfun(1, 2, 1, (a, env) => (valuesBy(a, env).some(truth) ? 1 : 0), 'any(lista, warunek) — 1, gdy choć jeden element spełnia warunek'),
  all: lfun(1, 2, 1, (a, env) => (valuesBy(a, env).every(truth) ? 1 : 0), 'all(lista, warunek) — 1, gdy każdy element spełnia warunek'),
  count: lfun(1, 2, 1, (a, env) => (a.length < 2 ? asList(a[0]!.run(env)).length : valuesBy(a, env).filter(truth).length), 'count(lista) — ile elementów; count(lista, warunek) — ile spełnia warunek'),
  sum: lfun(1, 2, 1, (a, env) => valuesBy(a, env).reduce<number>((s, v) => s + toNum(v), 0), 'sum(lista) albo sum(lista, wyrażenie) — suma: sum(skladniki, it.masa)'),
  avg: lfun(1, 2, 1, (a, env) => { const v = valuesBy(a, env); return v.length === 0 ? NaN : v.reduce<number>((s, x) => s + toNum(x), 0) / v.length; }, 'avg(lista) albo avg(lista, wyrażenie) — średnia'),
  min: lfun(1, 16, 1, (a, env) => extreme(a, env, Math.min), 'min(a, b, …) — najmniejsza liczba; min(lista); min(lista, wyrażenie)'),
  max: lfun(1, 16, 1, (a, env) => extreme(a, env, Math.max), 'max(a, b, …) — największa liczba; max(lista); max(lista, wyrażenie)'),
  minby: lfun(2, 2, 1, (a, env) => extremeBy(a, env, 1), 'minby(lista, klucz) — element z najmniejszym kluczem: minby(wydarzenia, it.data) — najwcześniejsze'),
  maxby: lfun(2, 2, 1, (a, env) => extremeBy(a, env, -1), 'maxby(lista, klucz) — element z największym kluczem')
};

export const CONSTANTS: Readonly<Record<string, number>> = { pi: Math.PI, tau: 2 * Math.PI, e: Math.E, true: 1, false: 0 };

/* -- Lesen ----------------------------------------------------------------------- */

type Tok =
  | { readonly k: 'num'; readonly v: number; readonly at: number }
  | { readonly k: 'str'; readonly v: string; readonly at: number }
  | { readonly k: 'id'; readonly v: string; readonly at: number }
  | { readonly k: 'op'; readonly v: string; readonly at: number }
  | { readonly k: 'end'; readonly at: number };

const OPS = ['&&', '||', '==', '!=', '<=', '>=', '+', '-', '*', '/', '%', '^', '(', ')', ',', '?', ':', '<', '>', '!'];
/** 2026-11-03 — nur mit `lists`: Listen `[ ]` und das Feld nach einer Klammer `.label`. */
const LIST_OPS = ['[', ']', '.'];

class Fail extends Error {
  constructor(message: string, readonly at: number) { super(message); }
}

function tokens(source: string, lists = false): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i += 1; continue; }
    const number = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(source.slice(i));
    if (number !== null) {
      out.push({ k: 'num', v: Number(number[0]), at: i });
      i += number[0].length;
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      let value = '';
      while (j < source.length && source[j] !== c) {
        if (source[j] === '\\' && j + 1 < source.length) { value += source[j + 1]; j += 2; continue; }
        value += source[j];
        j += 1;
      }
      if (j >= source.length) throw new Fail('niezamknięty tekst — brakuje cudzysłowu', i);
      out.push({ k: 'str', v: value, at: i });
      i = j + 1;
      continue;
    }
    /* 2026-10-18 — ein Name darf über Punkte gehen: `parent.x`, `root.angle`, `wyjscie.omega`. */
    const name = /^[\p{L}_][\p{L}\p{N}_]*(?:\.[\p{L}_][\p{L}\p{N}_]*)*/u.exec(source.slice(i));
    if (name !== null) {
      out.push({ k: 'id', v: name[0], at: i });
      i += name[0].length;
      continue;
    }
    const op = OPS.find((o) => source.startsWith(o, i)) ?? (lists ? LIST_OPS.find((o) => source.startsWith(o, i)) : undefined);
    if (op === undefined) {
      if (c === '=') throw new Fail('pojedyncze „=" — do porównania służy „=="', i);
      if (c === '&' || c === '|') throw new Fail(`„${c}" — w logice „${c}${c}"`, i);
      throw new Fail(`nieznany znak „${c}"`, i);
    }
    out.push({ k: 'op', v: op, at: i });
    i += op.length;
  }
  out.push({ k: 'end', at: source.length });
  return out;
}

/** Ein Knoten des Baums: seine Rechnung — und ob er immer dasselbe ergibt. */
interface Node {
  readonly run: Run;
  readonly constant: boolean;
}

const fixed = (value: Val): Node => ({ run: () => value, constant: true });

/** Aus Kindern, die alle fest sind, wird gleich ein fester Wert. */
function fold(node: Node, kids: readonly Node[]): Node {
  if (!kids.every((k) => k.constant)) return node;
  /* 2026-11-03 — eine feste Rechnung über Listen, die zu gross ist, bleibt eine Rechnung (sie wird NaN, wenn sie läuft). */
  const before = work;
  work = 0;
  try {
    return fixed(node.run(Object.create(null) as Env));
  } catch (e) {
    if (e instanceof Overrun) return node;
    throw e;
  } finally {
    work = before;
  }
}

class Reader {
  private at = 0;
  private depth = 0;
  readonly reads = new Set<string>();
  readonly links = new Set<string>();
  /** In welchen Zusammenfassungen der Leser gerade steht (in `sum(children, …)`: `children`). */
  private readonly path: string[] = [];

  private readonly known: ((name: string) => boolean) | undefined;
  private readonly kinds: ReadonlySet<string>;
  /** 2026-11-03 — die Schreibweisen des Generators (`[ ]`, `.feld`). */
  private readonly lists: boolean;
  /** 2026-11-03 — Namen, die nur in einem Ausdruck je Element gelten (`it`, `i`). */
  private readonly locals: (readonly string[])[] = [];
  /** 2026-11-03 — rechnet er über Listen? Dann hat er eine Obergrenze der Arbeit (`WORK_LIMIT`). */
  loops = false;

  constructor(private readonly list: readonly Tok[], options: CompileOptions) {
    this.known = options.known;
    this.kinds = options.kinds ?? new Set();
    this.lists = options.lists === true;
  }

  private isLocal(name: string): boolean {
    return this.locals.some((frame) => frame.includes(name));
  }

  /** Steht nach `(` eine Menge (`children`, `things`, eine Art) und dann `,` oder `)`? Dann ist es eine Zusammenfassung. */
  private setAhead(): string | null {
    const open = this.list[this.at];
    const name = this.list[this.at + 1];
    const after = this.list[this.at + 2];
    if (open?.k !== 'op' || open.v !== '(' || name?.k !== 'id' || after?.k !== 'op' || (after.v !== ',' && after.v !== ')')) return null;
    return (SETS as readonly string[]).includes(name.v) || this.kinds.has(name.v) ? name.v : null;
  }

  /** `sum(children, total*arm)` — der innere Ausdruck wird in jedem Ding der Menge gerechnet, `outer` ist der, der fragt. */
  private aggregate(fn: string, at: number): Node {
    this.take('(');
    const set = (this.peek() as { v: string }).v;
    this.at += 1;
    let inner: Node | null = null;
    if (this.isOp(',')) {
      this.take(',');
      this.path.push(set);
      try { inner = this.ternary(); } finally { this.path.pop(); }
    }
    this.take(')');
    if (inner === null && fn !== 'count') throw new Fail(`${fn}(${set}, …) potrzebuje wyrażenia po przecinku`, at);
    /* `#world` — liest aus der Welt: ändert sich an ihr etwas, wird neu gerechnet. */
    this.reads.add('#world');
    const each = inner;
    const over = (env: Env, visit: (value: Val) => boolean): void => {
      const members = setOf(env, set);
      const outer = links(env).$world?.outer;
      outer?.push(env);
      try {
        for (const m of members) if (!visit(each === null ? 1 : each.run(m))) return;
      } finally {
        outer?.pop();
      }
    };
    const run: Run = fn === 'sum' ? (env) => { let s = 0; over(env, (v) => { s += toNum(v); return true; }); return s; }
      : fn === 'avg' ? (env) => { let s = 0; let n = 0; over(env, (v) => { s += toNum(v); n += 1; return true; }); return n === 0 ? 0 : s / n; }
      : fn === 'min' ? (env) => { let m = Infinity; over(env, (v) => { m = Math.min(m, toNum(v)); return true; }); return m === Infinity ? 0 : m; }
      : fn === 'max' ? (env) => { let m = -Infinity; over(env, (v) => { m = Math.max(m, toNum(v)); return true; }); return m === -Infinity ? 0 : m; }
      : fn === 'count' ? (env) => { let n = 0; over(env, (v) => { if (truth(v)) n += 1; return true; }); return n; }
      : fn === 'all' ? (env) => { let ok = 1; over(env, (v) => { if (!truth(v)) { ok = 0; return false; } return true; }); return ok; }
      : (env) => { let ok = 0; over(env, (v) => { if (truth(v)) { ok = 1; return false; } return true; }); return ok; };
    return { run, constant: false };
  }

  private peek(): Tok { return this.list[this.at]; }

  private isOp(v: string): boolean {
    const t = this.peek();
    return t.k === 'op' && t.v === v;
  }

  private take(v: string): void {
    const t = this.peek();
    if (t.k !== 'op' || t.v !== v) throw new Fail(`oczekiwano „${v}"`, t.at);
    this.at += 1;
  }

  whole(): Node {
    const node = this.ternary();
    const t = this.peek();
    if (t.k !== 'end') throw new Fail(t.k === 'op' && t.v === ')' ? 'za dużo „)"' : 'tu wyrażenie powinno się kończyć', t.at);
    return node;
  }

  private deeper<T>(work: () => T): T {
    this.depth += 1;
    if (this.depth > EXPR_LIMITS.depth) throw new Fail('wyrażenie jest zbyt głęboko zagnieżdżone', this.peek().at);
    try { return work(); } finally { this.depth -= 1; }
  }

  private ternary(): Node {
    return this.deeper(() => {
      const test = this.or();
      if (!this.isOp('?')) return test;
      this.take('?');
      const yes = this.ternary();
      this.take(':');
      const no = this.ternary();
      const node: Node = { run: (env) => (truth(test.run(env)) ? yes.run(env) : no.run(env)), constant: false };
      return test.constant ? (truth(test.run({})) ? yes : no) : node;
    });
  }

  private or(): Node {
    let left = this.and();
    while (this.isOp('||')) {
      this.take('||');
      const a = left;
      const b = this.and();
      left = fold({ run: (env) => (truth(a.run(env)) || truth(b.run(env)) ? 1 : 0), constant: false }, [a, b]);
    }
    return left;
  }

  private and(): Node {
    let left = this.equality();
    while (this.isOp('&&')) {
      this.take('&&');
      const a = left;
      const b = this.equality();
      left = fold({ run: (env) => (truth(a.run(env)) && truth(b.run(env)) ? 1 : 0), constant: false }, [a, b]);
    }
    return left;
  }

  private equality(): Node {
    let left = this.compare();
    while (this.isOp('==') || this.isOp('!=')) {
      const op = (this.peek() as { v: string }).v;
      this.at += 1;
      const a = left;
      const b = this.compare();
      /* 2026-11-03 — `same`: auch Listen (Stelle für Stelle) und Datensätze (die Kennung). */
      left = fold(op === '==' ? { run: (env) => (same(a.run(env), b.run(env)) ? 1 : 0), constant: false }
        : { run: (env) => (same(a.run(env), b.run(env)) ? 0 : 1), constant: false }, [a, b]);
    }
    return left;
  }

  private compare(): Node {
    let left = this.additive();
    for (;;) {
      const t = this.peek();
      if (t.k !== 'op' || !['<', '<=', '>', '>='].includes(t.v)) return left;
      this.at += 1;
      const a = left;
      const b = this.additive();
      /* 2026-11-03 — zwei Texte, die keine Zahlen sind, nach dem Alphabet („Ala" < „Ola"); sonst wie bisher als Zahlen. */
      const less = (x: Val, y: Val): number => (typeof x === 'string' && typeof y === 'string' && (Number.isNaN(toNum(x)) || Number.isNaN(toNum(y))) ? x.localeCompare(y, 'pl') : toNum(x) - toNum(y));
      const run: Run = t.v === '<' ? (env) => (less(a.run(env), b.run(env)) < 0 ? 1 : 0)
        : t.v === '<=' ? (env) => (less(a.run(env), b.run(env)) <= 0 ? 1 : 0)
        : t.v === '>' ? (env) => (less(a.run(env), b.run(env)) > 0 ? 1 : 0)
        : (env) => (less(a.run(env), b.run(env)) >= 0 ? 1 : 0);
      left = fold({ run, constant: false }, [a, b]);
    }
  }

  private additive(): Node {
    let left = this.multiplicative();
    for (;;) {
      const t = this.peek();
      if (t.k !== 'op' || (t.v !== '+' && t.v !== '-')) return left;
      this.at += 1;
      const a = left;
      const b = this.multiplicative();
      const run: Run = t.v === '+'
        ? (env) => {
          const x = a.run(env);
          const y = b.run(env);
          if (typeof x === 'number' && typeof y === 'number') return x + y;
          /* 2026-11-03 — zwei Listen werden eine. */
          if (isList(x) && isList(y)) return capped([...x, ...y]);
          return typeof x === 'string' || typeof y === 'string' ? text(x) + text(y) : toNum(x) + toNum(y);
        }
        : (env) => toNum(a.run(env)) - toNum(b.run(env));
      left = fold({ run, constant: false }, [a, b]);
    }
  }

  private multiplicative(): Node {
    let left = this.unary();
    for (;;) {
      const t = this.peek();
      if (t.k !== 'op' || (t.v !== '*' && t.v !== '/' && t.v !== '%')) return left;
      this.at += 1;
      const a = left;
      const b = this.unary();
      const run: Run = t.v === '*' ? (env) => toNum(a.run(env)) * toNum(b.run(env))
        : t.v === '/' ? (env) => toNum(a.run(env)) / toNum(b.run(env))
        : (env) => toNum(a.run(env)) % toNum(b.run(env));
      left = fold({ run, constant: false }, [a, b]);
    }
  }

  private unary(): Node {
    return this.deeper(() => {
      const t = this.peek();
      if (t.k === 'op' && (t.v === '-' || t.v === '+' || t.v === '!')) {
        this.at += 1;
        const a = this.unary();
        const run: Run = t.v === '-' ? (env) => -toNum(a.run(env)) : t.v === '+' ? (env) => toNum(a.run(env)) : (env) => (truth(a.run(env)) ? 0 : 1);
        return fold({ run, constant: false }, [a]);
      }
      return this.power();
    });
  }

  private power(): Node {
    const base = this.postfix(this.primary());
    if (!this.isOp('^')) return base;
    this.take('^');
    /* Rechts gebunden, und der Exponent darf ein Vorzeichen haben: 2^-1, 2^3^2 = 2^9. */
    const exponent = this.unary();
    return fold({ run: (env) => toNum(base.run(env)) ** toNum(exponent.run(env)), constant: false }, [base, exponent]);
  }

  /** 2026-11-03 — nach einem Wert: `[i]` (eine Stelle) und `.feld` (ein Feld eines Datensatzes), beliebig oft. */
  private postfix(start: Node): Node {
    let node = start;
    for (;;) {
      if (this.isOp('[')) {
        this.take('[');
        const index = this.ternary();
        this.take(']');
        const base = node;
        node = fold({ run: (env) => itemAt(base.run(env), index.run(env)), constant: false }, [base, index]);
        continue;
      }
      if (this.isOp('.')) {
        const name = this.list[this.at + 1];
        if (name?.k !== 'id') throw new Fail('po kropce oczekiwano nazwy pola', this.peek().at);
        this.at += 2;
        const keys = name.v.split('.');
        const base = node;
        node = fold({ run: (env) => keys.reduce<Val>((v, k) => fieldOf(v, k), base.run(env)), constant: false }, [base]);
        continue;
      }
      return node;
    }
  }

  private primary(): Node {
    const t = this.peek();
    if (t.k === 'num') { this.at += 1; return fixed(t.v); }
    if (t.k === 'str') { this.at += 1; return fixed(t.v); }
    if (t.k === 'op' && t.v === '(') {
      this.take('(');
      const inner = this.ternary();
      this.take(')');
      return inner;
    }
    /* 2026-11-03 — eine Liste: [1, 2, 3], [a, b], [] (nur mit `lists`). */
    if (t.k === 'op' && t.v === '[') {
      this.take('[');
      const items: Node[] = [];
      if (!this.isOp(']')) {
        for (;;) {
          items.push(this.ternary());
          if (items.length > EXPR_LIMITS.items) throw new Fail(`lista w wyrażeniu ma więcej niż ${EXPR_LIMITS.items} elementów`, this.peek().at);
          if (this.isOp(',')) { this.take(','); continue; }
          break;
        }
      }
      this.take(']');
      const list = items;
      return fold({ run: (env) => list.map((n) => n.run(env)), constant: false }, list);
    }
    if (t.k === 'id' && t.v.includes('.')) {
      this.at += 1;
      return this.relation(t.v, t.at);
    }
    if (t.k === 'id') {
      this.at += 1;
      if ((AGGREGATES as readonly string[]).includes(t.v) && this.setAhead() !== null) return this.aggregate(t.v, t.at);
      if (this.isOp('(')) return this.call(t.v, t.at);
      /* 2026-11-03 — `it` und `i` in einem Ausdruck je Element: kein Name von aussen. */
      if (this.isLocal(t.v)) {
        const local = t.v;
        return { run: (env) => env[local] ?? '', constant: false };
      }
      /* Ein eigener Name geht vor: `e` ist in der Physik oft die Sprungzahl, nicht die Eulersche Zahl. */
      const declared = this.known !== undefined && this.known(t.v);
      if (!declared && Object.prototype.hasOwnProperty.call(CONSTANTS, t.v)) return fixed(CONSTANTS[t.v]);
      if (!declared && Object.prototype.hasOwnProperty.call(FUNCTIONS, t.v)) throw new Fail(`„${t.v}" to funkcja — potrzebuje nawiasów: ${t.v}(…)`, t.at);
      if (this.known !== undefined && !declared) throw new Fail(`nieznana nazwa „${t.v}"`, t.at);
      this.reads.add(t.v);
      this.links.add([...this.path, t.v].join('>'));
      const name = t.v;
      return { run: (env) => env[name] ?? 0, constant: false };
    }
    if (t.k === 'end') throw new Fail('wyrażenie urywa się — czegoś brakuje', t.at);
    throw new Fail(`nieoczekiwane „${t.v}"`, t.at);
  }

  /**
   * EIN WERT EINES ANDEREN DINGS: `parent.x`, `root.angle`, `outer.arm`,
   * `parent.parent.y` — oder eines Dings beim Namen (`wyjscie.omega`). Fehlt es
   * (keine Eltern, kein solches Ding), ist es 0.
   */
  private relation(path: string, at: number): Node {
    /*
     * 2026-11-03 — EIN FELD EINES DATENSATZES: `kation.ladung`, `it.data` (ein Element in `filter`, `map` …). Mit `lists`
     * ausserhalb einer Welt, und in einer Welt für `it` (dort ist ein Punkt sonst eine Beziehung zwischen Dingen).
     */
    const head = path.split('.')[0]!;
    if ((this.lists && this.kinds.size === 0) || this.isLocal(head)) return this.fieldPath(path, at);
    const parts = path.split('.');
    const name = parts.pop()!;
    if (this.kinds.size === 0) throw new Fail(`„${path}" — kropka w nazwie działa tylko w świecie („world")`, at);
    /* 2026-10-18 — `can.pos`: darf man diese Eigenschaft dieses Dings ändern? (Die Welt setzt es — keine Rechnung hängt daran.) */
    if (parts.length === 1 && parts[0] === 'can') {
      if (this.known !== undefined && !this.known(name)) throw new Fail(`nieznana nazwa „${name}" (w „${path}")`, at);
      this.reads.add('#world');
      this.reads.add('can');
      return { run: (env) => links(env).$can?.[name] ?? 0, constant: false };
    }
    parts.forEach((p, i) => {
      if (i > 0 && !(RELATIONS as readonly string[]).includes(p)) throw new Fail(`„${path}" — po kropce: parent, root, outer albo self`, at);
    });
    if (this.known !== undefined && !this.known(name)) throw new Fail(`nieznana nazwa „${name}" (w „${path}")`, at);
    /* Der Name selbst auch: hängt `y` des Elternteils von der Zeit ab, dann auch, was es liest. */
    this.reads.add('#world');
    this.reads.add(name);
    const steps = parts.map((p, i) => (i === 0 && !(RELATIONS as readonly string[]).includes(p) ? `@${p}` : p));
    this.links.add([...this.path, ...steps, name].join('>'));
    return {
      run: (env) => {
        let e: Env | undefined = env;
        for (const step of parts) e = e === undefined ? undefined : hop(e, step);
        return e === undefined ? 0 : e[name] ?? 0;
      },
      constant: false
    };
  }

  /** 2026-11-03 — `kation.ladung.wert`: der Name vorn (eigener oder `it`), dann Feld für Feld. */
  private fieldPath(path: string, at: number): Node {
    const [head, ...keys] = path.split('.');
    const name = head!;
    if (!this.isLocal(name)) {
      if (this.known !== undefined && !this.known(name)) throw new Fail(`nieznana nazwa „${name}" (w „${path}")`, at);
      this.reads.add(name);
      this.links.add([...this.path, name].join('>'));
    }
    return { run: (env) => keys.reduce<Val>((v, k) => fieldOf(v, k), env[name] ?? ''), constant: false };
  }

  /** Die Argumente einer Funktion — ab `from` als Ausdruck je Element (mit `it` und `i`). */
  private args(from = Infinity): Node[] {
    this.take('(');
    const args: Node[] = [];
    if (!this.isOp(')')) {
      for (;;) {
        const each = args.length >= from;
        if (each) this.locals.push(['it', 'i']);
        try {
          args.push(this.ternary());
        } finally {
          if (each) this.locals.pop();
        }
        if (args.length > EXPR_LIMITS.args) throw new Fail('za dużo argumentów', this.peek().at);
        if (this.isOp(',')) { this.take(','); continue; }
        break;
      }
    }
    this.take(')');
    return args;
  }

  private arity(name: string, at: number, count: number, min: number, max: number): void {
    if (count < min || count > max) {
      throw new Fail(`${name}(…) przyjmuje ${min === max ? min : `od ${min} do ${max}`} ${max === 1 ? 'argument' : 'argumentów'}, a dostało ${count}`, at);
    }
  }

  private call(name: string, at: number): Node {
    /* 2026-11-03 — `if` und die Funktionen über Listen mit einem Ausdruck je Element; dann die über Werte. */
    const lazy = Object.prototype.hasOwnProperty.call(LAZY_FUNCTIONS, name) ? LAZY_FUNCTIONS[name] : undefined;
    if (lazy !== undefined) {
      const args = this.args(lazy.from);
      this.arity(name, at, args.length, lazy.min, lazy.max);
      if (lazy.from !== Infinity) this.loops = true;
      /* Aus festen Teilen (min(2, 3), if(1, 'a', 'b')) wird gleich ein fester Wert — wie bisher bei min und max. */
      return fold({ run: (env) => lazy.run(args, env), constant: false }, args);
    }
    const value = Object.prototype.hasOwnProperty.call(VALUE_FUNCTIONS, name) ? VALUE_FUNCTIONS[name] : undefined;
    if (value !== undefined) {
      const args = this.args();
      this.arity(name, at, args.length, value.min, value.max);
      this.loops = true;
      /* Gezogen wird mit dem Zufall der Aufgabe: das Ergebnis ist nie fest. */
      const chance = name === 'shuffle' || name === 'choose' || name === 'pick';
      const node: Node = { run: (env) => value.run(args.map((a) => a.run(env)), env), constant: false };
      return chance ? node : fold(node, args);
    }
    const f = Object.prototype.hasOwnProperty.call(FUNCTIONS, name) ? FUNCTIONS[name] : undefined;
    if (f === undefined) throw new Fail(`nieznana funkcja „${name}"`, at);
    const args = this.args();
    this.arity(name, at, args.length, f.min, f.max);
    const run: Run = args.length === 1
      ? (env) => f.run(toNum(args[0].run(env)))
      : args.length === 2
        ? (env) => f.run(toNum(args[0].run(env)), toNum(args[1].run(env)))
        : (env) => f.run(...args.map((a) => toNum(a.run(env))));
    return fold({ run, constant: false }, args);
  }
}

const CACHE = new Map<string, Expr | ExprError>();

/**
 * EINEN AUSDRUCK ÜBERSETZEN. `known` — wenn gesagt, welche Namen es gibt:
 * ein anderer ist ein Fehler. Ohne `known` geht jeder Name (und wird, wenn er
 * fehlt, als 0 gerechnet).
 */
export function compile(source: string, known?: ((name: string) => boolean) | CompileOptions): Expr | ExprError {
  const options: CompileOptions = typeof known === 'function' ? { known } : known ?? {};
  const key = options.known === undefined && options.kinds === undefined ? `${options.lists === true ? 'L' : ''}:${source}` : null;
  if (key !== null) {
    const hit = CACHE.get(key);
    if (hit !== undefined) return hit;
  }
  const result = compileFresh(source, options);
  if (key !== null) {
    if (CACHE.size > 4000) CACHE.clear();
    CACHE.set(key, result);
  }
  return result;
}

function compileFresh(source: string, options: CompileOptions): Expr | ExprError {
  const trimmed = source.trim();
  if (trimmed === '') return { error: 'puste wyrażenie', at: 0, source };
  if (trimmed.length > EXPR_LIMITS.length) return { error: `wyrażenie dłuższe niż ${EXPR_LIMITS.length} znaków`, at: EXPR_LIMITS.length, source };
  try {
    const reader = new Reader(tokens(trimmed, options.lists === true), options);
    const node = reader.whole();
    /* 2026-11-03 — über Listen: mit einer Obergrenze der Arbeit; zu viel — NaN, und `takeOverrun` sagt es. */
    const inner = node.run;
    const run: Run = reader.loops && !node.constant
      ? (env) => {
        work = 0;
        try {
          return inner(env);
        } catch (e) {
          if (e instanceof Overrun) { overran = true; return NaN; }
          throw e;
        }
      }
      : inner;
    return { source: trimmed, run, reads: [...reader.reads], constant: node.constant, links: [...reader.links] };
  } catch (e) {
    if (e instanceof Fail) return { error: e.message, at: e.at, source: trimmed };
    throw e;
  }
}

/** Einmal rechnen — für Prüfungen und Einzelfälle (übersetzt wird aus dem Zwischenspeicher). */
export function evaluate(source: string, env: Readonly<Record<string, Val>> = {}): Val {
  const e = compile(source);
  return isExprError(e) ? NaN : e.run(Object.assign(newEnv(), env));
}

/** Eine leere Umgebung — ohne Prototyp, damit ein Name wie `constructor` nichts aus JavaScript findet. */
export const newEnv = (): Env => Object.create(null) as Env;

/**
 * EIN TEXT MIT RECHNUNGEN DARIN: `Zasięg: {fmt(zasieg, 1)} m`. Was in
 * geschweiften Klammern steht, ist ein Ausdruck; der Rest bleibt, wie er ist.
 */
export function compileText(source: string, known?: ((name: string) => boolean) | CompileOptions): Expr | ExprError {
  const parts: (string | Expr)[] = [];
  const reads = new Set<string>();
  const links = new Set<string>();
  let i = 0;
  while (i < source.length) {
    const open = source.indexOf('{', i);
    if (open < 0) { parts.push(source.slice(i)); break; }
    const close = source.indexOf('}', open + 1);
    if (close < 0) return { error: 'brakuje „}"', at: open, source };
    if (open > i) parts.push(source.slice(i, open));
    const inner = compile(source.slice(open + 1, close), known);
    if (isExprError(inner)) return { error: inner.error, at: open + 1 + inner.at, source };
    for (const r of inner.reads) reads.add(r);
    for (const l of inner.links) links.add(l);
    parts.push(inner);
    i = close + 1;
  }
  const constant = parts.every((p) => typeof p === 'string' || p.constant);
  const run: Run = (env) => parts.map((p) => (typeof p === 'string' ? p : text(p.run(env)))).join('');
  return { source, run: constant ? (() => { const v = run({}); return () => v; })() : run, reads: [...reads], constant, links: [...links] };
}

/* -- Die Beschreibung -------------------------------------------------------------- */

/** Die Sprache der Rechnungen in Worten — für die Beschreibung des JSON und das Polecenie dla AI. */
export function exprDescription(): string {
  return [
    'Wyrażenia (wartości liczone na bieżąco) — tekst, np. "v0*cos(rad(kat))":',
    '  liczby: 3, 0.5, 2e-3 (kropka dziesiętna); teksty w apostrofach: \'ok\'; nazwy: zmienne, wartości liczone, stan symulacji i nazwy wbudowane',
    '  działania: + - * / % (reszta) ^ (potęga; -x^2 to −(x²)); nawiasy ( )',
    '  porównania: < <= > >= == != — dają 1 (tak) albo 0 (nie); logika: && (i), || (lub), ! (nie); warunek: w ? a : b',
    '  tekst + liczba skleja tekst (liczba z przecinkiem, do 3 miejsc); fmt(x, cyfry) — liczba z wybraną liczbą miejsc',
    '  stałe: pi, tau (2·pi), e, true (1), false (0) — własna zmienna o takiej nazwie (np. "e" jako współczynnik odbicia) ma pierwszeństwo',
    '  funkcje:',
    ...Object.entries(FUNCTIONS).map(([name, f]) => `    ${name} — ${f.says}`),
    '  Kąty: sin/cos/tan liczą w radianach — kąt w stopniach zamienia rad(kąt), wynik asin/acos/atan2 zamienia deg(...).',
    '  W świecie ("world"): parent.x, root.x — wartość rodzica, korzenia (parent.parent.x — dziadka); outer.x — rzeczy, która właśnie podsumowuje; nazwa.x — rzeczy o tym "id"',
    '    can — 1, gdy osoba może coś w tej rzeczy zmienić (przeciągnąć, ustawić), 0, gdy jest dana; can.pos — gdy może zmienić właśnie "pos" (np. kolor danego i zmienianego, strzałki ↔)',
    `  podsumowania: ${AGGREGATES.map((a) => `${a}(…)`).join(', ')} — np. sum(children, total*arm), count(children), count(odwaznik, mass > 5), all(belka, abs(mom) < 0.05)`,
    `    zbiory: children (dzieci), descendants (wszystkie niżej), siblings (rodzeństwo), others (inne tego rodzaju), things (wszystkie) albo nazwa rodzaju; wyrażenie po przecinku liczy się w KAŻDEJ rzeczy zbioru (jej nazwy, jej parent), a outer.x sięga do tej, która pyta`,
    `  listy (np. range(1, 10)): ${[...Object.keys(VALUE_FUNCTIONS), ...Object.keys(LAZY_FUNCTIONS)].join(', ')} — opis w zadaniach generowanych Cogity; w filter/map/sortby… "it" to element, "i" jego miejsce`,
    '  Nieznana nazwa to błąd (edytor pokazuje, gdzie); dzielenie przez 0 daje nieskończoność — taki kształt chwilowo się nie rysuje.'
  ].join('\n');
}

/**
 * 2026-11-03 — DIE SPRACHE IN GENERIERTEN AUFGABEN (Cogita: `let`, `require`, `where`, Platzhalter `{…}`, „Oblicz") —
 * dieselbe wie oben, dazu Listen, Datensätze und die Funktionen über sie. Für die Beschreibung des JSON und die
 * Anleitungen der KI.
 */
export function generatorExprDescription(): string {
  const all = { ...VALUE_FUNCTIONS, ...LAZY_FUNCTIONS };
  return [
    'Wyrażenia w zadaniach generowanych — ten sam język co w rysunkach (liczby z kropką, teksty w apostrofach, + - * / % ^, < <= > >= == !=, && || !, w ? a : b), a do tego:',
    '  listy: [1, 2, 3], [a, b]; element: lista[0] (od 0; lista[-1] — ostatni); lista + lista — połączone',
    '  wpis (wylosowany z bazy): wpis.pole (np. kation.ladunek), wpis.id, wpis.label; pole liczbowe z wielkością: wpis.pole_si (w SI), wpis.pole_unit; data: wpis.data (liczba rrrrmmdd, do porównań), wpis.data_text (słowami); odwołanie: wpis.okres.label (jeden krok dalej)',
    '  wyrażenie dla każdego elementu (filter, map, sortby, count, any, all, find, sum, avg, min, max, minby, maxby): "it" — element, "i" — jego miejsce (od 0), np. filter(jony, it.ladunek < 0), map(wydarzenia, it.label)',
    '  teksty porównują się alfabetycznie ("Ala" < "Ola"); == porównuje też listy (element po elemencie) i wpisy (po id)',
    '  losowanie w wyrażeniu (shuffle, choose, pick) używa numeru zadania — ten sam numer daje to samo zadanie',
    '  funkcje liczbowe:',
    ...Object.entries(FUNCTIONS).filter(([name]) => !Object.prototype.hasOwnProperty.call(all, name)).map(([name, f]) => `    ${name} — ${f.says}`),
    '  funkcje list, tekstów i wpisów:',
    ...Object.entries(all).map(([name, f]) => `    ${name} — ${f.says}`),
    `  Granice: lista do ${LIST_LIMIT} elementów, w jednym wyrażeniu do ${WORK_LIMIT} kroków po listach — więcej daje NaN (zadanie się nie losuje).`
  ].join('\n');
}
