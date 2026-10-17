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
 * Rein und ohne Oberfläche — geprüft in `app-sim-check`.
 */

import { AGGREGATES, RELATIONS, SETS } from './liveModel';

export type Val = number | string;
export type Env = Record<string, Val>;
type Run = (env: Env) => Val;

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

/** Wie lang ein Ausdruck höchstens ist, und wie tief geschachtelt. */
export const EXPR_LIMITS = { length: 1200, depth: 60, args: 16 } as const;

/* -- Zahlen und Texte ------------------------------------------------------------- */

/** Ein Wert als Zahl: ein Text mit Komma oder Punkt wird gelesen, sonst NaN. */
export function toNum(v: Val): number {
  if (typeof v === 'number') return v;
  const t = v.trim().replace(',', '.').replace('−', '-');
  return t === '' ? NaN : Number(t);
}

/** Wahr ist alles außer 0, NaN und dem leeren Text. */
export const truth = (v: Val): boolean => (typeof v === 'number' ? v !== 0 && !Number.isNaN(v) : v !== '');

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

const text = (v: Val): string => (typeof v === 'string' ? v : show(v));

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
  fmt: fun(1, 2, (x, d = 1) => fmt(x, d), 'fmt(x, cyfry) — liczba jako tekst z przecinkiem: fmt(9.81, 1) → "9,8"')
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

class Fail extends Error {
  constructor(message: string, readonly at: number) { super(message); }
}

function tokens(source: string): Tok[] {
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
    const op = OPS.find((o) => source.startsWith(o, i));
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
  return kids.every((k) => k.constant) ? fixed(node.run({})) : node;
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

  constructor(private readonly list: readonly Tok[], options: CompileOptions) {
    this.known = options.known;
    this.kinds = options.kinds ?? new Set();
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
      const same = (x: Val, y: Val): boolean => (typeof x === 'string' && typeof y === 'string' ? x === y : toNum(x) === toNum(y));
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
      const run: Run = t.v === '<' ? (env) => (toNum(a.run(env)) < toNum(b.run(env)) ? 1 : 0)
        : t.v === '<=' ? (env) => (toNum(a.run(env)) <= toNum(b.run(env)) ? 1 : 0)
        : t.v === '>' ? (env) => (toNum(a.run(env)) > toNum(b.run(env)) ? 1 : 0)
        : (env) => (toNum(a.run(env)) >= toNum(b.run(env)) ? 1 : 0);
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
          return typeof x === 'number' && typeof y === 'number' ? x + y : typeof x === 'string' || typeof y === 'string' ? text(x) + text(y) : toNum(x) + toNum(y);
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
    const base = this.primary();
    if (!this.isOp('^')) return base;
    this.take('^');
    /* Rechts gebunden, und der Exponent darf ein Vorzeichen haben: 2^-1, 2^3^2 = 2^9. */
    const exponent = this.unary();
    return fold({ run: (env) => toNum(base.run(env)) ** toNum(exponent.run(env)), constant: false }, [base, exponent]);
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
    if (t.k === 'id' && t.v.includes('.')) {
      this.at += 1;
      return this.relation(t.v, t.at);
    }
    if (t.k === 'id') {
      this.at += 1;
      if ((AGGREGATES as readonly string[]).includes(t.v) && this.setAhead() !== null) return this.aggregate(t.v, t.at);
      if (this.isOp('(')) return this.call(t.v, t.at);
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
    const parts = path.split('.');
    const name = parts.pop()!;
    if (this.kinds.size === 0) throw new Fail(`„${path}" — kropka w nazwie działa tylko w świecie („world")`, at);
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

  private call(name: string, at: number): Node {
    const f = Object.prototype.hasOwnProperty.call(FUNCTIONS, name) ? FUNCTIONS[name] : undefined;
    if (f === undefined) throw new Fail(`nieznana funkcja „${name}"`, at);
    this.take('(');
    const args: Node[] = [];
    if (!this.isOp(')')) {
      for (;;) {
        args.push(this.ternary());
        if (args.length > EXPR_LIMITS.args) throw new Fail('za dużo argumentów', this.peek().at);
        if (this.isOp(',')) { this.take(','); continue; }
        break;
      }
    }
    this.take(')');
    if (args.length < f.min || args.length > f.max) {
      throw new Fail(`${name}(…) przyjmuje ${f.min === f.max ? f.min : `od ${f.min} do ${f.max}`} ${f.max === 1 ? 'argument' : 'argumentów'}, a dostało ${args.length}`, at);
    }
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
  const key = options.known === undefined && options.kinds === undefined ? source : null;
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
    const reader = new Reader(tokens(trimmed), options);
    const node = reader.whole();
    return { source: trimmed, run: node.run, reads: [...reader.reads], constant: node.constant, links: [...reader.links] };
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
    `  podsumowania: ${AGGREGATES.map((a) => `${a}(…)`).join(', ')} — np. sum(children, total*arm), count(children), count(odwaznik, mass > 5), all(belka, abs(mom) < 0.05)`,
    `    zbiory: children (dzieci), descendants (wszystkie niżej), siblings (rodzeństwo), others (inne tego rodzaju), things (wszystkie) albo nazwa rodzaju; wyrażenie po przecinku liczy się w KAŻDEJ rzeczy zbioru (jej nazwy, jej parent), a outer.x sięga do tej, która pyta`,
    '  Nieznana nazwa to błąd (edytor pokazuje, gdzie); dzielenie przez 0 daje nieskończoność — taki kształt chwilowo się nie rysuje.'
  ].join('\n');
}
