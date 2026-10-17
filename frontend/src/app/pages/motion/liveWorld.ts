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
 * <b>Die Rechnungen einer Art laufen in drei Durchgängen</b>: zuerst von den
 * Blättern zur Wurzel (was aus den Kindern folgt: die ganze Masse, das Moment),
 * dann von der Wurzel zu den Blättern (was vom Elternteil abhängt: wo ein Ding
 * hängt), zuletzt, was über alle Dinge oder eines beim Namen geht. Welche
 * Rechnung wohin gehört, folgt aus dem, was sie liest — niemand muss es sagen.
 * Was nur von Eigenschaften abhängt, wird nicht in jedem Zwischenschritt der
 * Simulation neu gerechnet, sondern nur, wenn sich etwas geändert hat.
 *
 * <b>Jede Änderung geht durch die Regeln der Welt</b>: darf man das hier
 * (Art, Welt, Sperre), liegt der Wert in seinen Grenzen (die Rechnungen sein
 * dürfen), bleibt Abstand zu den Geschwistern (`apart`), gibt es zu viele
 * Dinge oder zu tiefe Bäume. So prüft dieselbe Welt eine Antwort in Cogita:
 * die Änderungen des Lernenden werden noch einmal durch genau diese Regeln
 * geschickt — eine gesperrte Masse bleibt gesperrt, auch wenn jemand sie in
 * die Antwort schreibt.
 */

import { compile, compileText, isExprError, toNum, truth, type CompileOptions, type Env, type Expr, type Val, type WorldLinks } from './expr';
import { THING_BUILTINS, type KindSpec, type Mood, type PropSpec, type WorldSpec } from './liveModel';

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
}

/** Eine Rechnung einer Art: in welchem Durchgang sie läuft, und ob sie von der Zeit abhängt. */
interface LetRun {
  readonly name: string;
  readonly expr: Expr;
  pass: 1 | 2 | 3;
  dynamic: boolean;
}

interface KindRun {
  readonly spec: KindSpec;
  readonly props: ReadonlyMap<string, PropRun>;
  readonly lets: LetRun[];
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

const UNDO_DEPTH = 60;

const links = (env: Env): { -readonly [K in keyof WorldLinks]: WorldLinks[K] } => env as unknown as { -readonly [K in keyof WorldLinks]: WorldLinks[K] };

const clamp = (value: number, min: number, max: number): number => (value < min ? min : value > max ? max : value);

export class World {
  readonly kinds = new Map<string, KindRun>();
  things: Thing[] = [];
  /** Eltern vor Kindern — so wird gezeichnet und von oben nach unten gerechnet. */
  private preorder: Thing[] = [];
  private postorder: Thing[] = [];
  private readonly byId = new Map<string, Thing>();
  private readonly index: { all: Env[]; roots: Env[]; byKind: Map<string, Env[]>; byId: Map<string, Env>; outer: Env[] } =
    { all: [], roots: [], byKind: new Map(), byId: new Map(), outer: [] };
  /** Zählt, wann sich der Bau geändert hat (dann wird neu gezeichnet). */
  version = 0;
  selected: string | null = null;
  /** Hat sich seit dem letzten Bild ein Wert geändert? */
  dirty = true;
  private readonly undoStack: WorldShot[] = [];
  private readonly redoStack: WorldShot[] = [];
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
    options: { readonly fixed?: Readonly<Record<string, number>>; readonly random?: () => number; readonly state?: ReadonlySet<string> } = {}
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
    this.classify(options.state ?? new Set());

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
    this.initial = { things: shots };
    this.restore(this.initial);
    for (const th of this.preorder) for (const name of th.kind.props.keys()) this.fit(th, name, toNum(th.env[name]), false);
    this.evalLets('all');
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
      made: p.new === null ? null : this.compile(p.new, `${where}.props „${p.name}".new`)
    }]));
    for (const name of [...k.edit, ...Object.keys(k.drag ?? {})]) {
      if (!props.has(name) && !k.state.some((s) => s.name === name)) this.report({ where, error: `„${name}" nie jest własnością tego rodzaju`, source: name, at: 0 });
    }
    for (const name of k.add) if (!this.kindNames.has(name)) this.report({ where: `${where}.can.add`, error: `nie ma rodzaju „${name}"`, source: name, at: 0 });
    return {
      spec: k,
      props,
      lets: k.lets.map((l) => ({ name: l.name, expr: this.compile(l.value, `${where}.let „${l.name}"`) ?? ZERO, pass: 1, dynamic: false })),
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
   * WOHIN EINE RECHNUNG GEHÖRT: liest sie, was aus den Kindern folgt, in den
   * ersten Durchgang (Blätter zuerst); liest sie vom Elternteil, in den zweiten
   * (Wurzel zuerst); geht sie über alle Dinge oder eines beim Namen, in den
   * dritten. Was eine eigene Rechnung liest, erbt deren Durchgang. Und ob sie
   * von der Zeit abhängt (einer Grösse der Simulation, auch einer anderen
   * Dinge) — nur solche laufen in den Zwischenschritten.
   */
  private classify(globalState: ReadonlySet<string>): void {
    const dynamic = new Set<string>([...globalState, 't']);
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
    for (const k of this.kinds.values()) {
      const passOf = new Map<string, 1 | 2 | 3>();
      for (const l of k.lets) {
        const r = l.expr.reads;
        let pass: 1 | 2 | 3 = r.includes('#all') || r.includes('#ref') ? 3 : r.includes('#down') ? 2 : 1;
        for (const name of r) {
          const own = passOf.get(name);
          if (own !== undefined && own > pass) pass = own;
        }
        l.pass = pass;
        passOf.set(l.name, pass);
      }
    }
  }

  /* -- Der Bau ---------------------------------------------------------------------- */

  private newEnvFor(id: string, kind: KindRun): Env {
    const env = Object.create(this.global) as Env;
    for (const name of this.ownNames) env[name] = 0;
    for (const p of kind.spec.props) env[p.name] = p.value;
    for (const l of kind.spec.lets) env[l.name] = 0;
    for (const s of kind.spec.state) env[s.name] = 0;
    env.px = 0;
    env.py = 0;
    const l = links(env);
    l.$kind = kind.spec.name;
    (env as unknown as { $id: string }).$id = id;
    return env;
  }

  /** Eltern, Kinder, Reihenfolgen, das Verzeichnis und was jedes Ding von sich weiss — nach jeder Änderung des Baus. */
  private relink(): void {
    const roots = this.things.filter((t) => t.parent === null);
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
    roots.forEach((r, i) => { r.env.index = i; walk(r, 0, r); });
    this.postorder = [...this.preorder].reverse();
    this.index.all = this.preorder.map((t) => t.env);
    this.index.roots = roots.map((t) => t.env);
    this.index.byKind = new Map();
    for (const t of this.preorder) {
      const list = this.index.byKind.get(t.kind.spec.name) ?? [];
      list.push(t.env);
      this.index.byKind.set(t.kind.spec.name, list);
    }
    this.index.byId = new Map(this.preorder.map((t) => [t.id, t.env]));
    this.slots = this.preorder.flatMap((t) => t.kind.state.map((s) => ({ thing: t, name: s.name, rate: s.rate })));
    this.global.nthings = this.preorder.length;
    this.version += 1;
    this.dirty = true;
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
      if (kind === undefined || ids.has(s.id)) continue;
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

  /** Den Anfang wiederherstellen („Od nowa" der Werkstatt). */
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
   * DIE RECHNUNGEN ALLER DINGE — `all` nach einer Änderung und vor jedem Bild,
   * `dynamic` in den Zwischenschritten der Simulation (nur, was von der Zeit
   * abhängt).
   */
  evalLets(which: 'all' | 'dynamic'): void {
    const run = (t: Thing, pass: 1 | 2 | 3) => {
      for (const l of t.kind.lets) {
        if (l.pass !== pass || (which === 'dynamic' && !l.dynamic)) continue;
        const v = l.expr.run(t.env);
        if (t.env[l.name] !== v) { t.env[l.name] = v; this.dirty = true; }
      }
    };
    for (const t of this.postorder) run(t, 1);
    for (const t of this.preorder) run(t, 2);
    for (const t of this.preorder) run(t, 3);
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

  /** Nach einem Schritt: die Ereignisse jedes Dings (wenn ihre Bedingung wahr WIRD). */
  events(): void {
    for (const t of this.preorder) {
      t.kind.events.forEach((e, i) => {
        const now = truth(e.when.run(t.env));
        if (!now) { t.armed[i] = true; return; }
        if (!t.armed[i]) return;
        t.armed[i] = false;
        const values = e.set.map((a) => toNum(a.expr.run(t.env)));
        e.set.forEach((a, k) => { if (Number.isFinite(values[k])) t.env[a.name] = values[k]; });
        if (e.say !== null) this.said = { text: String(e.say.run(t.env)), mood: e.mood };
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

  /** Darf man diese Eigenschaft am gewählten Ding einstellen? */
  canEdit(t: Thing, prop: string): boolean {
    return this.spec.allow.edit && t.kind.spec.edit.includes(prop) && t.kind.props.has(prop) && !this.locked(t, prop);
  }

  /** Was man an diesem Ding einstellen darf — in der Reihenfolge der Art. */
  editable(t: Thing): PropSpec[] {
    return t.kind.spec.props.filter((p) => this.canEdit(t, p.name));
  }

  canDrag(t: Thing): boolean {
    return this.spec.allow.drag && t.lock !== true && t.kind.drag.some((a) => !this.locked(t, a.name));
  }

  canRemove(t: Thing): boolean {
    if (!this.spec.allow.remove || !t.kind.spec.remove || t.lock === true) return false;
    const walk = (x: Thing): boolean => x.children.every((c) => c.lock !== true && walk(c));
    return walk(t);
  }

  canCopy(t: Thing): boolean {
    return this.spec.allow.copy && t.kind.spec.copy && this.size(t) + this.things.length <= this.spec.limits.things;
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
    this.redoStack.length = 0;
  }

  /** Die letzte gemerkte Änderung zurücknehmen, ohne sie wiederholbar zu machen (eine verletzte Regel). */
  forget(): void {
    const shot = this.undoStack.pop();
    if (shot !== undefined) this.restore(shot);
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
    const min = p?.min === null || p?.min === undefined ? -1e9 : toNum(p.min.run(t.env));
    const max = p?.max === null || p?.max === undefined ? 1e9 : toNum(p.max.run(t.env));
    return { min: Number.isFinite(min) ? min : -1e9, max: Number.isFinite(max) ? Math.max(max, Number.isFinite(min) ? min : -1e9) : 1e9, step: p?.spec.step ?? null };
  }

  /** Ein Wert in seinen Grenzen, auf seinen Schritt gerastet — und mit Abstand zu den Geschwistern (`apart`). */
  private fit(t: Thing, prop: string, value: number, keepApart: boolean): number | null {
    const p = t.kind.props.get(prop);
    if (p === undefined || !Number.isFinite(value)) return null;
    const { min, max, step } = this.bounds(t, prop);
    const snap = (v: number) => (step === null ? v : Math.round(v / step) * step);
    let v = clamp(snap(value), min, max);
    v = Math.round(v * 1e9) / 1e9;
    if (keepApart && p.spec.apart !== null) {
      const gap = p.spec.apart;
      const siblings = (t.parent?.children ?? this.things.filter((x) => x.parent === null)).filter((x) => x !== t && x.kind.props.has(prop)).map((x) => toNum(x.env[prop]));
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
   * `drag` (gezogen), `rule` (eine Regel, ein Knopf — ohne Rechte). Gibt
   * zurück, ob sich etwas geändert hat.
   */
  setProp(t: Thing, prop: string, value: number, via: 'edit' | 'drag' | 'rule'): boolean {
    if (via === 'edit' && !this.canEdit(t, prop)) return false;
    if (via === 'drag' && (!this.canDrag(t) || this.locked(t, prop))) return false;
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
      if (this.locked(t, a.name)) return;
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
    for (const t of [...this.postorder]) if (!wanted.has(t.id) && this.byId.has(t.id)) this.remove(t);
    /* Anhängen, was neu ist (Eltern zuerst), unter der Kennung, die die Welt vergibt — und merken, welche das ist. */
    const alias = new Map<string, string>();
    let progress = true;
    while (progress) {
      progress = false;
      for (const s of shot.things) {
        if (this.byId.has(alias.get(s.id) ?? s.id)) continue;
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

const ZERO: Expr = { source: '0', run: () => 0, reads: [], constant: true };
