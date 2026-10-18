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
 * <b>In welcher Reihenfolge gerechnet wird</b>, folgt aus dem, was jede
 * Rechnung liest (`liveThings.ts`). Was nur von Eigenschaften abhängt, wird
 * nicht in jedem Schritt der Simulation neu gerechnet, sondern nur, wenn sich
 * etwas geändert hat; in den Zwischenschritten nur, was die Raten brauchen.
 *
 * <b>Jede Änderung geht durch die Regeln der Welt</b>: darf man das hier
 * (Art, Welt, Sperre, `when`), liegt der Wert in seinen Grenzen (die
 * Rechnungen sein dürfen), bleibt Abstand zu den Geschwistern (`apart`), gibt
 * es zu viele Dinge oder zu tiefe Bäume. So prüft dieselbe Welt eine Antwort
 * in Cogita: die Änderungen des Lernenden werden noch einmal durch genau diese
 * Regeln geschickt — eine gesperrte Masse bleibt gesperrt, auch wenn jemand
 * sie in die Antwort schreibt.
 *
 * <b>2026-10-18 — was gegeben ist und was man ändert</b>: jedes Ding weiss es
 * (`can`, je Eigenschaft `can.pos`), damit seine Art es zeigen kann (ein
 * gesperrtes Gewicht grau, ein verschiebbares mit Pfeilen); die Bedienung
 * nennt die Dinge so, wie ihre Art sagt (`brief`: „Ciężarek 2 kg").
 */

import { compile, compileText, isExprError, toNum, truth, type CompileOptions, type Env, type Expr, type Val, type WorldLinks } from './expr';
import { THING_BUILTINS, type Mood, type PropSpec, type WorldSpec } from './liveModel';
import { classify, compileKind, sortLets, type KindRun, type Step, type Thing, type ThingShot, type WorldProblem, type WorldShot } from './liveThings';

const UNDO_DEPTH = 60;

const links = (env: Env): { -readonly [K in keyof WorldLinks]: WorldLinks[K] } => env as unknown as { -readonly [K in keyof WorldLinks]: WorldLinks[K] };

const clamp = (value: number, min: number, max: number): number => (value < min ? min : value > max ? max : value);

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
  /**
   * WAS SICH SEIT DEM LETZTEN BILD GEÄNDERT HAT: die Namen — nur die Teile, die
   * sie lesen, werden neu geschrieben (ein Zahnrad dreht seine Gruppe, die
   * Zähne darin bleiben, wie sie sind) —, oder, nach einem neuen Stand, alles.
   */
  private readonly touched = new Set<string>();
  private everything = true;
  /** Die Namen der Grössen der Simulation aller Arten — nach jedem Schritt geändert. */
  private readonly stateNames: ReadonlySet<string>;
  private readonly undoStack: WorldShot[] = [];
  private readonly redoStack: WorldShot[] = [];
  /** „Ponów", solange eine Änderung noch zurückgenommen werden kann (eine verletzte Regel). */
  private parked: WorldShot[] = [];
  /** Der Anfang dieser Aufgabe — dorthin führt „Od nowa" (eine neue Aufgabe zieht einen neuen). */
  private initial: WorldShot = { things: [] };
  private readonly locks = new Map<string, true | ReadonlySet<string>>();
  /** 2026-10-18 — Eigenschaften der Dinge als Rechnung aus den Werten des Bildes (je Kennung). */
  private readonly exprs = new Map<string, Map<string, Expr>>();
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
    this.stateNames = new Set(spec.kinds.flatMap((k) => k.state.map((x) => x.name)));
    links(global).$world = this.index;

    const compiler = { compile: (source: string, where: string) => this.compile(source, where), compileText: (source: string, where: string) => this.compileText(source, where), report, kindNames: this.kindNames };
    for (const k of spec.kinds) this.kinds.set(k.name, compileKind(k, compiler));
    classify([...this.kinds.values()], options.dynamic ?? new Set());

    /* Eigenschaften als Rechnung (`"m": "=a"`): aus den Werten des Bildes — nicht aus anderen Dingen, die es dann noch nicht gibt. */
    const drawingOnly: CompileOptions = { known: (name) => globalNames.has(name), kinds: this.kindNames };
    for (const t of spec.things) {
      this.locks.set(t.id, t.lock === true ? true : new Set(t.lock));
      for (const [name, source] of Object.entries(t.exprs)) {
        const made = compile(source, drawingOnly);
        if (isExprError(made)) { report({ where: `world.things „${t.id}".${name}`, error: made.error, source: made.source, at: made.at }); continue; }
        const own = this.exprs.get(t.id) ?? new Map<string, Expr>();
        own.set(name, made);
        this.exprs.set(t.id, own);
      }
    }
    this.startWith(options.random ?? Math.random, options.fixed ?? {});
  }

  /**
   * DIE DINGE EINER AUFGABE, wie das Dokument sie sagt: Zahlen, Zufall (auf
   * den Schritt der Eigenschaft gerastet), Rechnungen aus den Werten des
   * Bildes — was feststeht (in Cogita: der Zufall dieses Versuchs), gewinnt.
   * Danach in ihren Grenzen; das ist der Anfang, zu dem „Od nowa" führt, und
   * was vorher geändert wurde, lässt sich nicht mehr zurücknehmen.
   */
  startWith(random: () => number, fixed: Readonly<Record<string, number>> = {}): void {
    const shots: ThingShot[] = this.spec.things.map((t) => {
      const props: Record<string, number> = { ...t.props };
      for (const [name, [a, b]] of Object.entries(t.random)) {
        const step = this.kinds.get(t.kind)?.props.get(name)?.spec.step ?? null;
        let v = a + random() * (b - a);
        if (step !== null) v = Math.round(v / step) * step;
        props[name] = Math.round(v * 1e9) / 1e9;
      }
      for (const [name, e] of this.exprs.get(t.id) ?? []) {
        const v = toNum(e.run(this.global));
        if (Number.isFinite(v)) props[name] = Math.round(v * 1e9) / 1e9;
      }
      for (const [key, v] of Object.entries(fixed)) {
        const dot = key.indexOf('.');
        if (dot > 0 && key.slice(0, dot) === t.id && Number.isFinite(v)) props[key.slice(dot + 1)] = v;
      }
      return { id: t.id, kind: t.kind, parent: t.parent, props };
    });
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.parked = [];
    this.restore({ things: shots });
    for (const th of this.preorder) for (const name of th.kind.props.keys()) this.fit(th, name, toNum(th.env[name]), false);
    this.evalLets('all');
    this.markCan();
    this.initial = this.snapshot();
  }

  /** Was in dieser Aufgabe gezogen oder gerechnet wurde (`ding.eigenschaft`) — so hält Cogita einen Versuch fest. */
  drawn(): Record<string, number> {
    const out: Record<string, number> = {};
    const at = new Map(this.initial.things.map((t) => [t.id, t]));
    for (const t of this.spec.things) {
      for (const name of [...Object.keys(t.random), ...(this.exprs.get(t.id)?.keys() ?? [])]) {
        const v = at.get(t.id)?.props[name];
        if (typeof v === 'number') out[`${t.id}.${name}`] = v;
      }
    }
    return out;
  }

  /** Zieht die Welt selbst etwas, das noch nicht feststeht? */
  drawsRandom(fixed: Readonly<Record<string, number>>): boolean {
    return this.spec.things.some((t) => Object.keys(t.random).some((name) => !(`${t.id}.${name}` in fixed)));
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
    ({ order: this.order, dynOrder: this.dynOrder, stageOrder: this.stageOrder } = sortLets({ preorder: this.preorder, roots: this.roots, byId: this.byId }, this.report));
    const shape = this.preorder.map((t) => `${t.id}:${t.kind.spec.name}:${t.parent?.id ?? ''}`).join('|');
    if (shape !== this.shape) { this.shape = shape; this.version += 1; }
    this.everything = true;
    this.markCan();
  }

  /**
   * WAS MAN AN JEDEM DING ÄNDERN DARF: `can` (irgendetwas — ziehen,
   * einstellen) und je Eigenschaft `can.pos`. Es ändert sich nur mit dem Bau
   * (oder einem `when`) — dann wird alles neu geschrieben.
   */
  private markCan(): void {
    for (const t of this.preorder) {
      const drag = this.canDrag(t);
      const own: Record<string, number> = {};
      let any = drag ? 1 : 0;
      for (const name of t.kind.props.keys()) {
        const v = this.canEdit(t, name) || (drag && t.kind.drag.some((a) => a.name === name) && this.drags(t, name)) ? 1 : 0;
        own[name] = v;
        if (v === 1) any = 1;
      }
      const l = links(t.env);
      const was = l.$can;
      if (t.env.can !== any || was === undefined || Object.keys(own).some((k) => was[k] !== own[k])) {
        t.env.can = any;
        l.$can = own;
        this.everything = true;
      }
    }
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
    this.markCan();
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
    this.everything = true;
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
      if (t.env[l.name] !== v) { t.env[l.name] = v; this.touched.add(l.name); }
    }
  }

  /** Was sich geändert hat, in `into` (`#world`: alles) — und vergessen. */
  takeChanged(into: Set<string>): void {
    if (this.everything) into.add('#world');
    for (const name of this.touched) into.add(name);
    this.touched.clear();
    this.everything = false;
  }

  /** Nach einem Schritt der Simulation: ihre Grössen haben sich geändert. */
  touchState(): void {
    for (const name of this.stateNames) this.touched.add(name);
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
        for (const a of e.set) this.touched.add(a.name);
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
    this.touched.add('selected');
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
    this.touched.add(prop);
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
      else if (Number.isFinite(values[i]) && t.env[a.name] !== values[i]) { t.env[a.name] = values[i]; changed = true; this.touched.add(a.name); }
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
      else if (Number.isFinite(values[i])) { t.env[a.name] = values[i]; changed = true; this.touched.add(a.name); }
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
    this.markCan();
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

  /** 2026-10-18 — wie ein Ding heisst: die Art und, was ihr `brief` sagt („Ciężarek 2 kg") — sonst seine Kennung. */
  title(t: Thing): string {
    const brief = t.kind.brief === null ? '' : String(t.kind.brief.run(t.env)).trim();
    return `${t.kind.spec.label} ${brief === '' ? t.id : brief}`;
  }

  /** Steht dieses Ding ganz fest (nichts daran zu ändern)? */
  fixed(t: Thing): boolean {
    return !truth(t.env.can);
  }

  /** Liesse sich diese Eigenschaft mit der Hand auf diesen Wert bringen — einstellen oder ziehen, in ihren Grenzen? (Eine Lösung muss es.) */
  reachable(t: Thing, prop: string, value: number): boolean {
    const byHand = this.canEdit(t, prop) || (this.canDrag(t) && t.kind.drag.some((a) => a.name === prop) && this.drags(t, prop));
    if (!byHand) return false;
    const { min, max } = this.bounds(t, prop);
    return value >= min - 1e-9 && value <= max + 1e-9;
  }

  /**
   * 2026-10-18 — JEDE EIGENSCHAFT, DIE MAN ÄNDERN DARF, ALS ZEILE — oder `null`:
   * erst ein Ding wählen (eine Werkstatt). Von selbst Zeilen, wenn nichts
   * hinzukommt oder wegfällt und es höchstens sechs sind (ein Rätsel).
   */
  rows(): { readonly t: Thing; readonly props: readonly PropSpec[] }[] | null {
    const rows = this.preorder.map((t) => ({ t, props: this.editable(t) })).filter((r) => r.props.length > 0);
    const allow = this.spec.allow;
    const auto = !allow.add && !allow.remove && !allow.copy && rows.reduce((n, r) => n + r.props.length, 0) <= 6;
    return (this.spec.list ?? auto) ? rows : null;
  }

  /** Ist eine Anzeige des Dings gerade zu sehen (`show`, etwa nicht, solange man vermutet)? */
  readoutShown(t: Thing, i: number): boolean {
    const e = t.kind.readoutShows[i];
    return e === null || e === undefined || truth(e.run(t.env));
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
   * erlaubt ist, bleibt, wie es am Anfang war. Gibt zurück, wie viele Dinge
   * sich geändert haben (weg, neu, anders eingestellt) — so viele Züge zählt
   * die Antwort (`edits`, für Regeln wie „höchstens zwei Züge").
   */
  replay(shot: WorldShot): number {
    let moves = 0;
    const wanted = new Map(shot.things.map((s) => [s.id, s]));
    /* Wegnehmen, was fehlt (von unten nach oben). */
    for (const t of [...this.preorder].reverse()) if (!wanted.has(t.id) && this.byId.has(t.id) && this.remove(t)) moves += 1;
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
        if (made !== null) { alias.set(s.id, made.id); progress = true; moves += 1; }
      }
    }
    /*
     * Eigenschaften: wer sie einstellen oder ziehen darf, bekommt sie — Eltern
     * zuerst, damit Grenzen stimmen; und zweimal: ein Ding darf an eine Stelle,
     * die ein anderes erst räumt (Abstand, `apart` — zwei Gewichte tauschen).
     */
    const changed = new Set<string>();
    for (let pass = 0; pass < 2; pass += 1) {
      for (const s of shot.things) {
        const t = this.byId.get(alias.get(s.id) ?? s.id);
        if (t === undefined) continue;
        for (const [name, value] of Object.entries(s.props)) {
          if (!t.kind.props.has(name) || toNum(t.env[name]) === value) continue;
          const viaDrag = t.kind.drag.some((a) => a.name === name);
          if (this.setProp(t, name, value, 'edit') || (viaDrag && this.setProp(t, name, value, 'drag'))) changed.add(s.id);
        }
      }
    }
    for (const id of changed) if (!alias.has(id)) moves += 1;
    this.initAllState();
    return moves;
  }
}
