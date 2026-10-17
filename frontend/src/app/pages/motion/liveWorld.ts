/**
 * 2026-10-18 — DIE WELT, GERECHNET (`liveModel.ts` sagt, was darin ist; das
 * Programm (`liveRun.ts`) lässt die Zeit laufen; `LiveDrawing.tsx` zeichnet).
 *
 * <b>Jedes Ding hat seine eigene Umgebung</b>: seine Eigenschaften, seine
 * Rechnungen, seine Grössen der Simulation und was es von sich weiss (`isroot`,
 * `depth`, `index`, `selected`, `nchildren`). Ihr Prototyp ist die Umgebung des
 * ganzen Bildes — `g` oder `tol` findet jedes Ding dort. Dazu, unter Schlüsseln
 * mit `$`, die kein Ausdruck nennen kann: sein Elternteil, seine Kinder, seine
 * Wurzel, seine Art (`expr.ts` geht darüber für `parent.x` und `sum(children, …)`).
 *
 * <b>In welcher Reihenfolge gerechnet wird, folgt aus dem, was jede Rechnung
 * liest</b> (`Expr.links`): die ganze Masse einer Belke braucht die ganze Masse
 * jedes Kindes, die Lage eines Gewichts die Lage der Belke, an der es hängt.
 * Nach jeder Änderung des Baus werden die Rechnungen aller Dinge einmal
 * sortiert — danach läuft jede genau einmal, nach allem, was sie braucht.
 * Niemand muss eine Reihenfolge angeben. Was nur von Eigenschaften abhängt,
 * wird nicht in jedem Schritt der Simulation neu gerechnet, sondern nur, wenn
 * sich etwas geändert hat; in den Zwischenschritten nur, was die Raten brauchen.
 *
 * <b>Jede Änderung geht durch die Regeln der Welt</b>: darf man das hier
 * (Art, Welt, Sperre, `when`), liegt der Wert in seinen Grenzen (die
 * Rechnungen sein dürfen), bleibt Abstand zu den Geschwistern (`apart`), gibt
 * es zu viele Dinge oder zu tiefe Bäume. So prüft dieselbe Welt eine Antwort
 * in Cogita: die Änderungen des Lernenden werden noch einmal durch genau diese
 * Regeln geschickt — eine gesperrte Masse bleibt gesperrt, auch wenn jemand
 * sie in die Antwort schreibt.
 */

import { compile, compileText, isExprError, toNum, truth, type CompileOptions, type Env, type Expr, type Val, type WorldLinks } from './expr';
import { RELATIONS, SETS, THING_BUILTINS, type KindSpec, type Mood, type PropSpec, type WorldSpec } from './liveModel';

/** Ein Ding, wie es gespeichert, rückgängig gemacht und als Antwort abgegeben wird. */
export interface ThingShot {
  readonly id: string;
  readonly kind: string;
  readonly parent: string | null;
  readonly props: Readonly<Record<string, number>>;
}

export interface WorldShot {
  readonly things: readonly ThingShot[];
}

/**
 * Ein Bau aus fremden Daten (eine Antwort, ein eingefügter Text) — nur, was
 * wie Dinge aussieht; der Rest fällt weg. Ob die Dinge erlaubt sind, sagt
 * erst die Welt, wenn sie ihn nachspielt.
 */
export function readShot(value: unknown): WorldShot | null {
  const list = Array.isArray(value) ? value : typeof value === 'object' && value !== null ? (value as { things?: unknown }).things : null;
  if (!Array.isArray(list)) return null;
  const things = list.slice(0, 200).flatMap((raw): ThingShot[] => {
    if (typeof raw !== 'object' || raw === null) return [];
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== 'string' || typeof r.kind !== 'string') return [];
    const props: Record<string, number> = {};
    for (const [k, v] of Object.entries(typeof r.props === 'object' && r.props !== null ? r.props as Record<string, unknown> : {}).slice(0, 40)) {
      if (typeof v === 'number' && Number.isFinite(v)) props[k] = v;
    }
    return [{ id: r.id.slice(0, 32), kind: r.kind.slice(0, 32), parent: typeof r.parent === 'string' ? r.parent.slice(0, 32) : null, props }];
  });
  return things.length === 0 ? null : { things };
}

/** Was eine Welt melden kann — wie die Fehler des Programms. */
export interface WorldProblem {
  readonly where: string;
  readonly error: string;
  readonly source: string;
  readonly at: number;
}

interface Assign {
  readonly name: string;
  readonly expr: Expr;
}

interface PropRun {
  readonly spec: PropSpec;
  readonly min: Expr | null;
  readonly max: Expr | null;
  readonly made: Expr | null;
  readonly when: Expr | null;
}

/** Eine Rechnung einer Art: ob sie von der Zeit abhängt, und ob die Raten sie brauchen (dann läuft sie in jedem Zwischenschritt). */
interface LetRun {
  readonly name: string;
  readonly expr: Expr;
  dynamic: boolean;
  stage: boolean;
}

interface KindRun {
  readonly spec: KindSpec;
  readonly props: ReadonlyMap<string, PropRun>;
  readonly lets: readonly LetRun[];
  readonly state: readonly { readonly name: string; readonly init: Expr; readonly rate: Expr }[];
  readonly events: readonly { readonly when: Expr; readonly set: readonly Assign[]; readonly say: Expr | null; readonly mood: Mood }[];
  readonly drag: readonly Assign[];
  readonly tap: readonly Assign[];
  readonly readouts: readonly (Expr | null)[];
}

export interface Thing {
  readonly id: string;
  readonly kind: KindRun;
  parent: Thing | null;
  children: Thing[];
  readonly env: Env;
  lock: true | ReadonlySet<string>;
  /** Je Ereignis der Art: scharf (wartet darauf, wahr zu werden)? */
  armed: boolean[];
}

/** Eine Rechnung eines Dings, an ihrer Stelle in der Reihenfolge. */
interface Step {
  readonly t: Thing;
  readonly l: LetRun;
}

const UNDO_DEPTH = 60;

const SET_STEPS: ReadonlySet<string> = new Set<string>(SETS);
const RELATION_STEPS: ReadonlySet<string> = new Set<string>(RELATIONS);

const links = (env: Env): { -readonly [K in keyof WorldLinks]: WorldLinks[K] } => env as unknown as { -readonly [K in keyof WorldLinks]: WorldLinks[K] };

const clamp = (value: number, min: number, max: number): number => (value < min ? min : value > max ? max : value);

const ZERO: Expr = { source: '0', run: () => 0, reads: [], constant: true, links: [] };

export class World {
  readonly kinds = new Map<string, KindRun>();
  things: Thing[] = [];
  /** Eltern vor Kindern — so wird gezeichnet. */
  private preorder: Thing[] = [];
  private roots: Thing[] = [];
  private readonly byId = new Map<string, Thing>();
  private readonly index: { all: Env[]; roots: Env[]; byKind: Map<string, Env[]>; byId: Map<string, Env>; outer: Env[] } =
    { all: [], roots: [], byKind: new Map(), byId: new Map(), outer: [] };
  /** Die Rechnungen aller Dinge in ihrer Reihenfolge — alle, die von der Zeit abhängen, die die Raten brauchen. */
  private order: Step[] = [];
  private dynOrder: Step[] = [];
  private stageOrder: Step[] = [];
  /** Zählt, wann sich der Bau geändert hat (andere Dinge, andere Eltern) — dann wird neu gezeichnet. */
  version = 0;
  private shape = '';
  selected: string | null = null;
  /** Hat sich seit dem letzten Bild ein Wert geändert? */
  dirty = true;
  private readonly undoStack: WorldShot[] = [];
  private readonly redoStack: WorldShot[] = [];
  /** „Ponów", solange eine Änderung noch zurückgenommen werden kann (eine verletzte Regel). */
  private parked: WorldShot[] = [];
  private readonly initial: WorldShot;
  private readonly locks = new Map<string, true | ReadonlySet<string>>();
  /** Die Grössen der Simulation aller Dinge, der Reihe nach — für Runge-Kutta. */
  slots: { readonly thing: Thing; readonly name: string; readonly rate: Expr }[] = [];
  /** Was ein Ereignis eines Dings gesagt hat (das Programm zeigt es). */
  said: { text: string; mood: Mood } | null = null;
  /** Die Namen, die in einem Ding gelten (für das Übersetzen von Teilen einer Art). */
  readonly thingNames: ReadonlySet<string>;
  /** Die Namen, die ein Ding SELBST hat (alle Arten zusammen) — sie verdecken einen gleichnamigen Wert des Bildes. */
  private readonly ownNames: ReadonlySet<string>;
  readonly kindNames: ReadonlySet<string>;

  constructor(
    readonly spec: WorldSpec,
    private readonly global: Env,
    globalNames: ReadonlySet<string>,
    private readonly report: (problem: WorldProblem) => void,
    options: { readonly fixed?: Readonly<Record<string, number>>; readonly random?: () => number; readonly dynamic?: ReadonlySet<string> } = {}
  ) {
    this.kindNames = new Set(spec.kinds.map((k) => k.name));
    const own = new Set<string>([...THING_BUILTINS, 'px', 'py']);
    for (const k of spec.kinds) {
      for (const p of k.props) own.add(p.name);
      for (const l of k.lets) own.add(l.name);
      for (const s of k.state) own.add(s.name);
    }
    this.ownNames = own;
    this.thingNames = new Set([...globalNames, ...own]);
    links(global).$world = this.index;

    for (const k of spec.kinds) this.kinds.set(k.name, this.compileKind(k));
    this.classify(options.dynamic ?? new Set());

    /* Die Dinge der Welt — mit dem Zufall dieses Versuchs (oder, in Cogita, dem festgehaltenen). */
    const random = options.random ?? Math.random;
    const shots: ThingShot[] = spec.things.map((t) => {
      const props: Record<string, number> = { ...t.props };
      for (const [name, [a, b]] of Object.entries(t.random)) {
        const step = this.kinds.get(t.kind)?.props.get(name)?.spec.step ?? null;
        let v = a + random() * (b - a);
        if (step !== null) v = Math.round(v / step) * step;
        props[name] = Math.round(v * 1e9) / 1e9;
      }
      for (const [key, v] of Object.entries(options.fixed ?? {})) {
        const dot = key.indexOf('.');
        if (dot > 0 && key.slice(0, dot) === t.id && Number.isFinite(v)) props[key.slice(dot + 1)] = v;
      }
      this.locks.set(t.id, t.lock === true ? true : new Set(t.lock));
      return { id: t.id, kind: t.kind, parent: t.parent, props };
    });
    this.restore({ things: shots });
    for (const th of this.preorder) for (const name of th.kind.props.keys()) this.fit(th, name, toNum(th.env[name]), false);
    this.evalLets('all');
    /* Der Anfang, wie er nach den Grenzen dasteht — dorthin führt „Od nowa". */
    this.initial = this.snapshot();
  }

  /** Was der Zufall gezogen hat (`ding.eigenschaft`) — damit derselbe Versuch wiederkommt (Cogita). */
  drawn(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const t of this.spec.things) {
      const shot = this.initial.things.find((s) => s.id === t.id);
      for (const name of Object.keys(t.random)) if (shot !== undefined && typeof shot.props[name] === 'number') out[`${t.id}.${name}`] = shot.props[name];
    }
    return out;
  }

  /* -- Übersetzen ----------------------------------------------------------------- */

  private options(extra: readonly string[] = []): CompileOptions {
    const own = extra.length === 0 ? this.thingNames : new Set([...this.thingNames, ...extra]);
    return { known: (name) => own.has(name), kinds: this.kindNames };
  }

  /** Ein Ausdruck im Ding einer Art — mit allen Namen der Welt; ein Fehler wird gemeldet, gerechnet wird trotzdem. */
  compile(source: string, where: string, extra: readonly string[] = []): Expr | null {
    const made = compile(source, this.options(extra));
    if (!isExprError(made)) return made;
    this.report({ where, error: made.error, source: made.source, at: made.at });
    const loose = compile(source, { kinds: this.kindNames });
    return isExprError(loose) ? null : loose;
  }

  compileText(source: string, where: string): Expr | null {
    const made = compileText(source, this.options());
    if (!isExprError(made)) return made;
    this.report({ where, error: made.error, source: made.source, at: made.at });
    return null;
  }

  private assigns(set: Readonly<Record<string, string>>, kind: KindSpec, where: string): Assign[] {
    const own = new Set([...kind.props.map((p) => p.name), ...kind.state.map((s) => s.name)]);
    const out: Assign[] = [];
    for (const [name, source] of Object.entries(set)) {
      if (!own.has(name)) { this.report({ where, error: `„${name}" nie jest własnością ani stanem rodzaju „${kind.name}"`, source: name, at: 0 }); continue; }
      const expr = this.compile(source, `${where} „${name}"`);
      if (expr !== null) out.push({ name, expr });
    }
    return out;
  }

  private compileKind(k: KindSpec): KindRun {
    const where = `world.kinds „${k.name}"`;
    const props = new Map<string, PropRun>(k.props.map((p) => [p.name, {
      spec: p,
      min: p.min === null ? null : this.compile(p.min, `${where}.props „${p.name}".min`),
      max: p.max === null ? null : this.compile(p.max, `${where}.props „${p.name}".max`),
      made: p.new === null ? null : this.compile(p.new, `${where}.props „${p.name}".new`),
      when: p.when === null ? null : this.compile(p.when, `${where}.props „${p.name}".when`)
    }]));
    for (const name of [...k.edit, ...Object.keys(k.drag ?? {})]) {
      if (!props.has(name) && !k.state.some((s) => s.name === name)) this.report({ where, error: `„${name}" nie jest własnością tego rodzaju`, source: name, at: 0 });
    }
    for (const name of k.add) if (!this.kindNames.has(name)) this.report({ where: `${where}.can.add`, error: `nie ma rodzaju „${name}"`, source: name, at: 0 });
    return {
      spec: k,
      props,
      lets: k.lets.map((l) => ({ name: l.name, expr: this.compile(l.value, `${where}.let „${l.name}"`) ?? ZERO, dynamic: false, stage: false })),
      state: k.state.map((s) => ({ name: s.name, init: this.compile(s.value, `${where}.state „${s.name}".value`) ?? ZERO, rate: this.compile(s.rate, `${where}.state „${s.name}".rate`) ?? ZERO })),
      events: k.events.map((e, i) => ({
        when: this.compile(e.when, `${where}.events[${i}].when`) ?? ZERO,
        set: this.assigns(e.set, k, `${where}.events[${i}].set`),
        say: e.say === '' ? null : this.compileText(e.say, `${where}.events[${i}].say`),
        mood: e.mood
      })),
      drag: k.drag === null ? [] : this.assigns(k.drag, k, `${where}.drag`),
      tap: k.tap === null ? [] : this.assigns(k.tap.set, k, `${where}.tap`),
      readouts: k.readouts.map((r, i) => this.compile(r.value, `${where}.readouts[${i}]`))
    };
  }

  /**
   * WAS VON DER ZEIT ABHÄNGT (einer Grösse der Simulation — eines Dings oder
   * des Bildes —, durch die Rechnungen hindurch) und was davon die Raten
   * brauchen: nur das läuft in den Zwischenschritten von Runge-Kutta.
   */
  private classify(globalDynamic: ReadonlySet<string>): void {
    const dynamic = new Set<string>([...globalDynamic, 't']);
    for (const k of this.kinds.values()) for (const s of k.state) dynamic.add(s.name);
    let grew = true;
    while (grew) {
      grew = false;
      for (const k of this.kinds.values()) {
        for (const l of k.lets) {
          if (!l.dynamic && l.expr.reads.some((r) => dynamic.has(r))) { l.dynamic = true; grew = true; }
          if (l.dynamic && !dynamic.has(l.name)) { dynamic.add(l.name); grew = true; }
        }
      }
    }
    const byName = new Map<string, LetRun[]>();
    for (const k of this.kinds.values()) for (const l of k.lets) byName.set(l.name, [...(byName.get(l.name) ?? []), l]);
    const needed = new Set<string>();
    const queue = [...this.kinds.values()].flatMap((k) => k.state.flatMap((s) => s.rate.reads));
    while (queue.length > 0) {
      const name = queue.pop()!;
      if (needed.has(name)) continue;
      needed.add(name);
      for (const l of byName.get(name) ?? []) queue.push(...l.expr.reads);
    }
    for (const k of this.kinds.values()) for (const l of k.lets) l.stage = l.dynamic && needed.has(l.name);
  }

  /* -- Der Bau ---------------------------------------------------------------------- */

  private newEnvFor(id: string, kind: KindRun): Env {
    const env = Object.create(this.global) as Env;
    for (const name of this.ownNames) env[name] = 0;
    for (const p of kind.spec.props) env[p.name] = p.value;
    env.px = 0;
    env.py = 0;
    const l = links(env);
    l.$kind = kind.spec.name;
    (env as unknown as { $id: string }).$id = id;
    return env;
  }

  /** Eltern, Kinder, Reihenfolgen, das Verzeichnis und was jedes Ding von sich weiss — nach jeder Änderung des Baus. */
  private relink(): void {
    this.roots = this.things.filter((t) => t.parent === null);
    this.preorder = [];
    const walk = (t: Thing, depth: number, root: Thing) => {
      this.preorder.push(t);
      const l = links(t.env);
      l.$parent = t.parent?.env;
      l.$children = t.children.map((c) => c.env);
      l.$root = root.env;
      t.env.isroot = t.parent === null ? 1 : 0;
      t.env.depth = depth;
      t.env.nchildren = t.children.length;
      t.env.selected = t.id === this.selected ? 1 : 0;
      t.children.forEach((c, i) => { c.env.index = i; walk(c, depth + 1, root); });
    };
    this.roots.forEach((r, i) => { r.env.index = i; walk(r, 0, r); });
    this.index.all = this.preorder.map((t) => t.env);
    this.index.roots = this.roots.map((t) => t.env);
    this.index.byKind = new Map();
    for (const t of this.preorder) {
      const list = this.index.byKind.get(t.kind.spec.name) ?? [];
      list.push(t.env);
      this.index.byKind.set(t.kind.spec.name, list);
    }
    this.index.byId = new Map(this.preorder.map((t) => [t.id, t.env]));
    this.slots = this.preorder.flatMap((t) => t.kind.state.map((s) => ({ thing: t, name: s.name, rate: s.rate })));
    this.global.nthings = this.preorder.length;
    this.sortLets();
    const shape = this.preorder.map((t) => `${t.id}:${t.kind.spec.name}:${t.parent?.id ?? ''}`).join('|');
    if (shape !== this.shape) { this.shape = shape; this.version += 1; }
    this.dirty = true;
  }

  /**
   * DIE REIHENFOLGE DER RECHNUNGEN: jede Rechnung jedes Dings nach allem, was
   * sie liest (über `Expr.links`: die eigenen, die der Kinder, des Elternteils,
   * eines Dings beim Namen). Ein Kreis (zwei Rechnungen, die einander
   * brauchen) wird gemeldet und in der Reihenfolge der Liste gerechnet.
   */
  private sortLets(): void {
    const steps: Step[] = [];
    const at = new Map<Thing, Map<string, number>>();
    for (const t of this.preorder) {
      const own = new Map<string, number>();
      for (const l of t.kind.lets) { own.set(l.name, steps.length); steps.push({ t, l }); }
      at.set(t, own);
    }
    const next: number[][] = steps.map(() => []);
    const need = steps.map(() => 0);
    steps.forEach(({ t, l }, i) => {
      for (const link of l.expr.links) {
        const path = link.split('>');
        const name = path.pop()!;
        for (const u of this.walk(t, path)) {
          const j = at.get(u)?.get(name);
          if (j === undefined || j === i) continue;
          next[j].push(i);
          need[i] += 1;
        }
      }
    });
    const order: number[] = [];
    need.forEach((n, i) => { if (n === 0) order.push(i); });
    for (let q = 0; q < order.length; q += 1) {
      for (const k of next[order[q]]) { need[k] -= 1; if (need[k] === 0) order.push(k); }
    }
    if (order.length < steps.length) {
      const done = new Set(order);
      const stuck = steps.find((_, i) => !done.has(i))!;
      this.report({ where: `world.kinds „${stuck.t.kind.spec.name}".let „${stuck.l.name}"`, error: 'wartości liczone zależą od siebie w kółko — liczę je w kolejności z listy', source: stuck.l.name, at: 0 });
      steps.forEach((_, i) => { if (!done.has(i)) order.push(i); });
    }
    this.order = order.map((i) => steps[i]);
    this.dynOrder = this.order.filter((s) => s.l.dynamic);
    this.stageOrder = this.order.filter((s) => s.l.stage);
  }

  /** Die Dinge, die ein Weg (`children>parent`) von einem Ding aus erreicht — `outer` ist, wer die innerste Menge gefragt hat. */
  private walk(t: Thing, path: readonly string[]): readonly Thing[] {
    let set: readonly Thing[] = [t];
    const askers: (readonly Thing[])[] = [];
    for (const step of path) {
      const before = set;
      if (step === 'self') continue;
      if (step === 'parent') set = set.flatMap((x) => (x.parent === null ? [] : [x.parent]));
      else if (step === 'root') set = set.map((x) => { let r = x; while (r.parent !== null) r = r.parent; return r; });
      else if (step === 'outer') set = askers.length === 0 ? [] : askers[askers.length - 1];
      else if (step === 'children') set = set.flatMap((x) => x.children);
      else if (step === 'descendants') set = set.flatMap((x) => this.below(x));
      else if (step === 'siblings') set = set.flatMap((x) => (x.parent?.children ?? this.roots).filter((y) => y !== x));
      else if (step === 'others') set = set.flatMap((x) => this.preorder.filter((y) => y !== x && y.kind === x.kind));
      else if (step === 'things') set = this.preorder;
      else if (step.startsWith('@')) { const u = this.byId.get(step.slice(1)); set = u === undefined ? [] : [u]; }
      else set = this.preorder.filter((x) => x.kind.spec.name === step);
      if (SET_STEPS.has(step) || (!RELATION_STEPS.has(step) && !step.startsWith('@'))) askers.push(before);
      if (set.length > 1) set = [...new Set(set)];
    }
    return set;
  }

  private below(t: Thing): Thing[] {
    const out: Thing[] = [];
    const walk = (x: Thing) => { for (const c of x.children) { out.push(c); walk(c); } };
    walk(t);
    return out;
  }

  /**
   * EINEN STAND HERSTELLEN — den Anfang, einen gespeicherten, einen aus dem
   * Rückgängig-Stapel. Dinge, die es schon gibt, behalten ihre Bewegung (eine
   * Belke schwingt weiter, statt zu springen); neue fangen am Anfang an.
   */
  restore(shot: WorldShot): void {
    const keep = new Map(this.things.map((t) => [t.id, t]));
    const next: Thing[] = [];
    const ids = new Set<string>();
    for (const s of shot.things) {
      const kind = this.kinds.get(s.kind);
      if (kind === undefined || ids.has(s.id) || next.length >= this.spec.limits.things) continue;
      ids.add(s.id);
      const had = keep.get(s.id);
      const thing: Thing = had !== undefined && had.kind === kind ? had : {
        id: s.id, kind, parent: null, children: [], env: this.newEnvFor(s.id, kind), lock: new Set(), armed: kind.events.map(() => true)
      };
      thing.lock = this.locks.get(s.id) ?? new Set();
      for (const p of kind.spec.props) thing.env[p.name] = typeof s.props[p.name] === 'number' && Number.isFinite(s.props[p.name]) ? s.props[p.name] : p.value;
      next.push(thing);
    }
    const byId = new Map(next.map((t) => [t.id, t]));
    for (const t of next) { t.parent = null; t.children = []; }
    for (const s of shot.things) {
      const t = byId.get(s.id);
      const p = s.parent === null ? undefined : byId.get(s.parent);
      if (t === undefined || p === undefined || this.isAncestor(t, p)) continue;
      t.parent = p;
      p.children.push(t);
    }
    this.things = next;
    this.byId.clear();
    for (const t of next) this.byId.set(t.id, t);
    if (this.selected !== null && !this.byId.has(this.selected)) this.selected = null;
    this.relink();
    this.evalLets('all');
    for (const t of next) if (keep.get(t.id) !== t) this.initState(t);
    this.evalLets('all');
  }

  /** Ist `a` ein Vorfahr von `b` (oder dasselbe Ding)? */
  private isAncestor(a: Thing, b: Thing): boolean {
    for (let p: Thing | null = b; p !== null; p = p.parent) if (p === a) return true;
    return false;
  }

  /** Die Grössen der Simulation eines Dings auf ihren Anfang. */
  initState(t: Thing): void {
    const values = t.kind.state.map((s) => toNum(s.init.run(t.env)));
    t.kind.state.forEach((s, i) => { t.env[s.name] = Number.isFinite(values[i]) ? values[i] : 0; });
    t.armed = t.kind.events.map(() => true);
  }

  /** Alle Dinge auf den Anfang ihrer Bewegung (ein Neubeginn der Simulation — der Bau bleibt). */
  initAllState(): void {
    this.evalLets('all');
    for (const t of this.preorder) this.initState(t);
    this.evalLets('all');
    this.dirty = true;
  }

  snapshot(): WorldShot {
    return {
      things: this.preorder.map((t) => ({
        id: t.id, kind: t.kind.spec.name, parent: t.parent?.id ?? null,
        props: Object.fromEntries(t.kind.spec.props.map((p) => [p.name, Math.round(toNum(t.env[p.name]) * 1e6) / 1e6]))
      }))
    };
  }

  /** Den Anfang wiederherstellen („Od nowa" der Werkstatt) — selbst eine Änderung, die man zurücknehmen kann. */
  reset(): void {
    this.remember();
    this.restore(this.initial);
    this.initAllState();
  }

  initialShot(): WorldShot {
    return this.initial;
  }

  /* -- Rechnen ---------------------------------------------------------------------- */

  /**
   * DIE RECHNUNGEN ALLER DINGE, in ihrer Reihenfolge — `all` nach einer
   * Änderung und vor jedem Bild, `dynamic` nach jedem Schritt der Simulation
   * (was von der Zeit abhängt), `stage` in den Zwischenschritten (was davon die
   * Raten brauchen).
   */
  evalLets(which: 'all' | 'dynamic' | 'stage'): void {
    const list = which === 'all' ? this.order : which === 'dynamic' ? this.dynOrder : this.stageOrder;
    for (const { t, l } of list) {
      const v = l.expr.run(t.env);
      if (t.env[l.name] !== v) { t.env[l.name] = v; this.dirty = true; }
    }
  }

  readState(into: Float64Array, offset: number): void {
    this.slots.forEach((s, i) => { into[offset + i] = toNum(s.thing.env[s.name]); });
  }

  writeState(from: Float64Array, offset: number): void {
    this.slots.forEach((s, i) => { s.thing.env[s.name] = from[offset + i]; });
  }

  rates(out: Float64Array, offset: number): void {
    this.slots.forEach((s, i) => { out[offset + i] = toNum(s.rate.run(s.thing.env)); });
  }

  /**
   * Nach einem Schritt: die Ereignisse jedes Dings (wenn ihre Bedingung wahr
   * WIRD). Hebt ein Ereignis seine Bedingung selbst auf (ein Anschlag setzt den
   * Winkel zurück auf die Grenze), ist es gleich wieder scharf.
   */
  events(): void {
    for (const t of this.preorder) {
      t.kind.events.forEach((e, i) => {
        if (!truth(e.when.run(t.env))) { t.armed[i] = true; return; }
        if (!t.armed[i]) return;
        const values = e.set.map((a) => toNum(a.expr.run(t.env)));
        e.set.forEach((a, k) => { if (Number.isFinite(values[k])) t.env[a.name] = values[k]; });
        if (e.say !== null) this.said = { text: String(e.say.run(t.env)), mood: e.mood };
        t.armed[i] = !truth(e.when.run(t.env));
        this.dirty = true;
      });
    }
  }

  /* -- Dürfen ------------------------------------------------------------------------ */

  get(id: string): Thing | undefined {
    return this.byId.get(id);
  }

  ordered(): readonly Thing[] {
    return this.preorder;
  }

  private locked(t: Thing, prop: string): boolean {
    return t.lock === true || t.lock.has(prop);
  }

  /** Gilt die Eigenschaft an diesem Ding (`when`)? */
  applies(t: Thing, prop: string): boolean {
    const when = t.kind.props.get(prop)?.when ?? null;
    return when === null || truth(when.run(t.env));
  }

  /** Darf man diese Eigenschaft am gewählten Ding einstellen? */
  canEdit(t: Thing, prop: string): boolean {
    return this.spec.allow.edit && t.kind.spec.edit.includes(prop) && t.kind.props.has(prop) && !this.locked(t, prop) && this.applies(t, prop);
  }

  /** Was man an diesem Ding einstellen darf — in der Reihenfolge der Art. */
  editable(t: Thing): PropSpec[] {
    return t.kind.spec.props.filter((p) => this.canEdit(t, p.name));
  }

  /** Lässt sich etwas an diesem Ding ziehen? */
  canDrag(t: Thing): boolean {
    return this.spec.allow.drag && t.lock !== true && t.kind.drag.some((a) => this.drags(t, a.name));
  }

  private drags(t: Thing, name: string): boolean {
    return !this.locked(t, name) && (!t.kind.props.has(name) || this.applies(t, name));
  }

  canRemove(t: Thing): boolean {
    if (!this.spec.allow.remove || !t.kind.spec.remove || t.lock === true) return false;
    const walk = (x: Thing): boolean => x.children.every((c) => c.lock !== true && walk(c));
    return walk(t);
  }

  canCopy(t: Thing): boolean {
    return this.spec.allow.copy && t.kind.spec.copy && t.lock !== true && this.size(t) + this.things.length <= this.spec.limits.things
      && (t.parent === null ? this.spec.allow.roots.includes(t.kind.spec.name) : t.parent.children.length < t.parent.kind.spec.children);
  }

  /** Welche Arten man an dieses Ding (oder, `null`, ganz oben) hängen darf. */
  addable(t: Thing | null): string[] {
    if (!this.spec.allow.add || this.things.length >= this.spec.limits.things) return [];
    if (t === null) return [...this.spec.allow.roots];
    if (t.children.length >= t.kind.spec.children || toNum(t.env.depth) + 1 >= this.spec.limits.depth) return [];
    return t.kind.spec.add.filter((k) => this.kinds.has(k));
  }

  private size(t: Thing): number {
    return 1 + t.children.reduce((n, c) => n + this.size(c), 0);
  }

  /* -- Ändern ------------------------------------------------------------------------- */

  /** Vor einer Änderung den Stand merken (einmal je Geste: ein Ziehen ist EINE Änderung). */
  remember(): void {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > UNDO_DEPTH) this.undoStack.shift();
    this.parked = this.redoStack.splice(0);
  }

  /**
   * Die letzte gemerkte Änderung zurücknehmen (eine verletzte Regel) — oder,
   * `restore = false`, nur vergessen (es hat sich nichts geändert). „Ponów"
   * bleibt, wie es vorher war.
   */
  forget(restore = true): void {
    const shot = this.undoStack.pop();
    if (restore && shot !== undefined) this.restore(shot);
    this.redoStack.push(...this.parked);
    this.parked = [];
  }

  canUndo(): boolean { return this.undoStack.length > 0; }
  canRedo(): boolean { return this.redoStack.length > 0; }

  undo(): boolean {
    const shot = this.undoStack.pop();
    if (shot === undefined) return false;
    this.redoStack.push(this.snapshot());
    this.restore(shot);
    return true;
  }

  redo(): boolean {
    const shot = this.redoStack.pop();
    if (shot === undefined) return false;
    this.undoStack.push(this.snapshot());
    this.restore(shot);
    return true;
  }

  select(id: string | null): void {
    const next = id !== null && this.byId.has(id) ? id : null;
    if (next === this.selected) return;
    this.selected = next;
    for (const t of this.things) t.env.selected = t.id === next ? 1 : 0;
    this.dirty = true;
  }

  /** Die Grenzen einer Eigenschaft in diesem Ding — gerechnet (sie dürfen vom Elternteil abhängen). */
  bounds(t: Thing, prop: string): { min: number; max: number; step: number | null } {
    const p = t.kind.props.get(prop);
    const lo = p?.min === null || p?.min === undefined ? -1e9 : toNum(p.min.run(t.env));
    const hi = p?.max === null || p?.max === undefined ? 1e9 : toNum(p.max.run(t.env));
    const min = Number.isFinite(lo) ? lo : -1e9;
    return { min, max: Number.isFinite(hi) ? Math.max(hi, min) : 1e9, step: p?.spec.step ?? null };
  }

  /** Ein Wert in seinen Grenzen, auf seinen Schritt gerastet — und mit Abstand zu den Geschwistern (`apart`). */
  private fit(t: Thing, prop: string, value: number, keepApart: boolean): number | null {
    const p = t.kind.props.get(prop);
    if (p === undefined || !Number.isFinite(value)) return null;
    const { min, max, step } = this.bounds(t, prop);
    const snap = (v: number) => (step === null ? v : Math.round(v / step) * step);
    let v = clamp(snap(value), min, max);
    v = Math.round(v * 1e9) / 1e9;
    if (keepApart && p.spec.apart !== null && this.applies(t, prop)) {
      const gap = p.spec.apart;
      const siblings = (t.parent?.children ?? this.roots)
        .filter((x) => x !== t && x.kind.props.has(prop) && this.applies(x, prop)).map((x) => toNum(x.env[prop]));
      const free = (x: number) => siblings.every((s) => Math.abs(s - x) >= gap - 1e-9);
      if (!free(v)) {
        const unit = step ?? gap / 4;
        let found: number | null = null;
        for (let k = 1; k <= 400 && found === null; k += 1) {
          for (const dir of [1, -1]) {
            const c = Math.round((v + dir * k * unit) * 1e9) / 1e9;
            if (c >= min - 1e-9 && c <= max + 1e-9 && free(c)) { found = c; break; }
          }
        }
        if (found === null) return null;
        v = found;
      }
    }
    t.env[prop] = v;
    return v;
  }

  /**
   * EINE EIGENSCHAFT ÄNDERN — `edit` (am gewählten Ding eingestellt) oder
   * `drag` (gezogen), `rule` (eine Regel, ein Antippen — ohne Rechte). Gibt
   * zurück, ob sich etwas geändert hat.
   */
  setProp(t: Thing, prop: string, value: number, via: 'edit' | 'drag' | 'rule'): boolean {
    if (via === 'edit' && !this.canEdit(t, prop)) return false;
    if (via === 'drag' && (!this.canDrag(t) || !this.drags(t, prop))) return false;
    const was = toNum(t.env[prop]);
    const fitted = this.fit(t, prop, value, true);
    if (fitted === null) { t.env[prop] = was; return false; }
    if (fitted === was) return false;
    this.afterChange();
    return true;
  }

  /** Ziehen: die Rechnungen der Art mit dem Finger (`px`, `py`, in der Welt) — alle zugleich, dann gesetzt. */
  drag(t: Thing, px: number, py: number): boolean {
    t.env.px = px;
    t.env.py = py;
    const values = t.kind.drag.map((a) => toNum(a.expr.run(t.env)));
    let changed = false;
    t.kind.drag.forEach((a, i) => {
      if (!this.drags(t, a.name)) return;
      if (t.kind.props.has(a.name)) { if (this.setProp(t, a.name, values[i], 'drag')) changed = true; }
      else if (Number.isFinite(values[i]) && t.env[a.name] !== values[i]) { t.env[a.name] = values[i]; changed = true; this.dirty = true; }
    });
    return changed;
  }

  /** Antippen: die Zuweisungen der Art. */
  tap(t: Thing): boolean {
    if (t.kind.tap.length === 0 || t.lock === true) return false;
    const values = t.kind.tap.map((a) => toNum(a.expr.run(t.env)));
    let changed = false;
    t.kind.tap.forEach((a, i) => {
      if (t.kind.props.has(a.name)) { if (this.setProp(t, a.name, values[i], 'rule')) changed = true; }
      else if (Number.isFinite(values[i])) { t.env[a.name] = values[i]; changed = true; this.dirty = true; }
    });
    return changed;
  }

  /** Nach jeder Änderung: alle Grenzen neu (sie hängen voneinander ab — eine kürzere Belke rückt ihre Gewichte herein) und die Rechnungen. */
  private afterChange(): void {
    this.evalLets('all');
    for (const t of this.preorder) {
      for (const [name, p] of t.kind.props) {
        if (p.min === null && p.max === null) continue;
        const v = toNum(t.env[name]);
        const { min, max } = this.bounds(t, name);
        if (v < min - 1e-9 || v > max + 1e-9) this.fit(t, name, v, true);
      }
    }
    this.evalLets('all');
    this.dirty = true;
  }

  private freshId(kind: string): string {
    let n = 1;
    while (this.byId.has(`${kind}${n}`)) n += 1;
    return `${kind}${n}`;
  }

  /** Ein neues Ding der Art an dieses (oder ganz oben) — mit den Werten, die `new` sagt. */
  add(kindName: string, parent: Thing | null): Thing | null {
    const kind = this.kinds.get(kindName);
    if (kind === undefined || !this.addable(parent).includes(kindName)) return null;
    const id = this.freshId(kindName);
    const thing: Thing = { id, kind, parent, children: [], env: this.newEnvFor(id, kind), lock: new Set(), armed: kind.events.map(() => true) };
    if (parent !== null) parent.children.push(thing);
    this.things.push(thing);
    this.byId.set(id, thing);
    this.relink();
    for (const [name, p] of kind.props) {
      const start = p.made === null ? p.spec.value : toNum(p.made.run(thing.env));
      this.fit(thing, name, Number.isFinite(start) ? start : p.spec.value, true);
    }
    this.evalLets('all');
    this.initState(thing);
    this.afterChange();
    return thing;
  }

  /** Ein Ding samt allem, was an ihm hängt, wegnehmen. */
  remove(t: Thing): boolean {
    if (!this.canRemove(t)) return false;
    const gone = new Set<Thing>();
    const walk = (x: Thing) => { gone.add(x); x.children.forEach(walk); };
    walk(t);
    if (t.parent !== null) t.parent.children = t.parent.children.filter((c) => c !== t);
    this.things = this.things.filter((x) => !gone.has(x));
    for (const x of gone) this.byId.delete(x.id);
    if (this.selected !== null && !this.byId.has(this.selected)) this.selected = null;
    this.relink();
    this.afterChange();
    return true;
  }

  /** Ein Ding samt allem, was an ihm hängt, verdoppeln — daneben (der Abstand sucht sich seinen Platz). */
  copy(t: Thing): Thing | null {
    if (!this.canCopy(t)) return null;
    const make = (x: Thing, parent: Thing | null): Thing => {
      const id = this.freshId(x.kind.spec.name);
      const y: Thing = { id, kind: x.kind, parent, children: [], env: this.newEnvFor(id, x.kind), lock: new Set(), armed: x.kind.events.map(() => true) };
      for (const p of x.kind.spec.props) y.env[p.name] = x.env[p.name];
      this.things.push(y);
      this.byId.set(id, y);
      if (parent !== null) parent.children.push(y);
      for (const c of x.children) make(c, y);
      return y;
    };
    const twin = make(t, t.parent);
    this.relink();
    for (const name of twin.kind.props.keys()) this.fit(twin, name, toNum(twin.env[name]), true);
    this.evalLets('all');
    const init = (x: Thing) => { this.initState(x); x.children.forEach(init); };
    init(twin);
    this.afterChange();
    return twin;
  }

  /** Ein Wert einer Anzeige des Dings (gerechnet in ihm). */
  readout(t: Thing, i: number): Val {
    const e = t.kind.readouts[i];
    return e === null || e === undefined ? '' : e.run(t.env);
  }

  /**
   * EINE ANTWORT NACHSPIELEN (Cogita): was der Lernende gebaut hat, Schritt für
   * Schritt durch die Regeln dieser Welt — Wegnehmen, Anhängen, Einstellen,
   * Verschieben, jedes nur, wo es erlaubt ist, und in seinen Grenzen. Was nicht
   * erlaubt ist, bleibt, wie es am Anfang war.
   */
  replay(shot: WorldShot): void {
    const wanted = new Map(shot.things.map((s) => [s.id, s]));
    /* Wegnehmen, was fehlt (von unten nach oben). */
    for (const t of [...this.preorder].reverse()) if (!wanted.has(t.id) && this.byId.has(t.id)) this.remove(t);
    /* Anhängen, was neu ist (Eltern zuerst), unter der Kennung, die die Welt vergibt — und merken, welche das ist. */
    const alias = new Map<string, string>();
    let progress = true;
    while (progress) {
      progress = false;
      for (const s of shot.things) {
        if (alias.has(s.id) || (this.byId.has(s.id) && this.byId.get(s.id)!.kind.spec.name === s.kind)) continue;
        const parentId = s.parent === null ? null : alias.get(s.parent) ?? s.parent;
        const parent = parentId === null ? null : this.byId.get(parentId);
        if (parentId !== null && parent === undefined) continue;
        const made = this.add(s.kind, parent ?? null);
        if (made !== null) { alias.set(s.id, made.id); progress = true; }
      }
    }
    /* Eigenschaften: wer sie einstellen oder ziehen darf, bekommt sie — Eltern zuerst, damit Grenzen stimmen. */
    for (const s of shot.things) {
      const t = this.byId.get(alias.get(s.id) ?? s.id);
      if (t === undefined) continue;
      for (const [name, value] of Object.entries(s.props)) {
        if (!t.kind.props.has(name) || toNum(t.env[name]) === value) continue;
        const viaDrag = t.kind.drag.some((a) => a.name === name);
        if (!this.setProp(t, name, value, 'edit') && viaDrag) this.setProp(t, name, value, 'drag');
      }
    }
    this.initAllState();
  }
}
