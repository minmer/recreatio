/**
 * 2026-10-17 — DAS BILD ZUM ANFASSEN, GERECHNET (`liveModel.ts` sagt, was
 * darin ist; `LiveDrawing.tsx` zeichnet es).
 *
 * <b>Ein Programm je Bild</b>: die Werte, die man einstellt, die Rechnungen
 * daraus, eine Simulation und die Regeln — übersetzt, sobald das Bild gebaut
 * wird, und dann nur noch gerechnet. Ohne Oberfläche, damit dieselbe Rechnung
 * im Browser läuft, in einer Prüfung ohne Browser (`app-sim-check`) und in
 * Cogita, wenn eine Antwort geprüft wird: dort wird mit den Werten des
 * Lernenden neu gerechnet, bis zum Ende — gleich, ob er zugesehen hat.
 *
 * <b>Die Simulation</b> ist ein System gewöhnlicher Differentialgleichungen:
 * jede Grösse hat einen Anfang und eine Änderungsrate (`rate` — die
 * Ableitung). Gerechnet wird mit Runge-Kutta vierter Ordnung in festen
 * Schritten (`dt`), nicht im Takt der Bilder: auf einem langsamen Telefon
 * kommt dasselbe heraus wie auf einem schnellen. Ereignisse (ein Aufprall)
 * und Regeln werden nach jedem Schritt geprüft — auch ein Ball, der nur einen
 * Augenblick durch einen Ring fliegt, trifft.
 *
 * <code>
 *   ready    t = 0, die Grössen folgen den Werten (der Schieber zeigt sofort, wo es losgeht)
 *   running  die Zeit läuft
 *   paused   angehalten (oder, mit `sleep`, eingeschlafen: es geschieht nichts mehr)
 *   ended    `until` ist wahr geworden (oder `max` erreicht, oder ein Ereignis mit `stop`)
 * </code>
 *
 * Ändert man einen Wert, von dem der Anfang abhängt, beginnt es von vorn;
 * einer, der nur die Raten ändert (die Schwerkraft, die Dämpfung), wirkt
 * sofort, ohne Neubeginn.
 *
 * <b>2026-10-18 — mit einer Welt</b> (`liveWorld.ts`): die Grössen ihrer Dinge
 * laufen im selben Runge-Kutta mit; jede Änderung am Bau (anhängen,
 * einstellen, ziehen, wegnehmen) geht durch `mutate` — gemerkt für „Cofnij",
 * gezählt (`edits`), und zurückgenommen, wenn danach eine Regel der Welt
 * (`keep`) nicht mehr gilt.
 */

import { compile, compileText, isExprError, newEnv, toNum, truth, type Env, type Expr } from './expr';
import { BUILTINS, type Action, type ControlSpec, type Live, type Mood, type RuleSpec, type SimSpec, type VarSpec } from './liveModel';
import { World, type WorldShot } from './liveWorld';
import { Workshop } from './liveEdit';

export type Status = 'ready' | 'running' | 'paused' | 'ended';

/** Was unter dem Bild steht — die letzte Meldung einer Regel oder eines Ereignisses. */
export interface Said {
  readonly text: string;
  readonly mood: Mood;
  readonly goal: boolean;
}

/** Ein Fehler in einem Ausdruck — wo, was, und an welcher Stelle des Textes. */
export interface Problem {
  readonly where: string;
  readonly error: string;
  readonly source: string;
  readonly at: number;
}

export interface ProgramOptions {
  /** Werte, die feststehen (in Cogita: der gezogene Zufall, die Antwort des Lernenden) — auch `ding.eigenschaft`. */
  readonly fixed?: Readonly<Record<string, number>>;
  /** Der Zufall für `random` — sonst `Math.random`. */
  readonly random?: () => number;
  /** 2026-10-18 — mit diesem Bau der Welt beginnen (gezeigt, wie er ist: eine Antwort, die man ansieht). */
  readonly world?: WorldShot | null;
  /** …oder ihn durch die Regeln der Welt nachspielen (die Prüfung in Cogita). */
  readonly replay?: WorldShot | null;
}

/** Höchstens so viele Schritte je Bild (danach läuft es langsamer, statt das Telefon anzuhalten) — und je Prüfung. */
const MAX_STEPS_PER_CALL = 6000;
const MAX_STEPS_HEADLESS = 600_000;
/** Eine Prüfung rechnet höchstens so viele Sekunden der Simulation. */
const HEADLESS_SECONDS = 120;
/** Ändert sich keine Grösse um mehr als so viel je Sekunde, ist es ruhig — so lange (s) ruhig, und die Simulation schläft. */
const QUIET_RATE = 2e-3;
const QUIET_FOR = 0.8;

/** Eine Zuweisung: welcher Wert, aus welcher Rechnung. */
export interface Assign {
  readonly name: string;
  readonly expr: Expr;
}

interface Rule {
  readonly spec: RuleSpec;
  readonly when: Expr;
  readonly set: readonly Assign[];
  readonly say: Expr | null;
  armed: boolean;
  fired: boolean;
  /** Seit wann die Bedingung ununterbrochen gilt (für `for`) — `null`: gerade nicht. */
  since: number | null;
}

interface SimEvent {
  readonly when: Expr;
  readonly set: readonly Assign[];
  readonly stop: boolean;
  readonly say: Expr | null;
  readonly mood: Mood;
  armed: boolean;
}

interface Grows {
  readonly name: string;
  readonly init: Expr;
  readonly rate: Expr;
}

type Let = { readonly name: string; readonly expr: Expr };

const ZERO: Expr = { source: '0', run: () => 0, reads: [], constant: true, links: [] };

const clamp = (value: number, min: number, max: number): number => (value < min ? min : value > max ? max : value);

export class Program {
  readonly env: Env = newEnv();
  readonly problems: Problem[] = [];
  readonly vars: readonly VarSpec[];
  readonly controls: readonly ControlSpec[];
  readonly panel: 'below' | 'side';
  readonly sim: SimSpec | null;
  /** 2026-10-18 — die Welt der Dinge (`null`: keine) — und ihre Werkstatt: jede Änderung, die jemand macht, geht dort durch. */
  readonly world: World | null = null;
  readonly workshop: Workshop | null = null;
  status: Status = 'ready';
  /** Ob etwas die Uhr `time` liest — dann läuft das Bild, solange es zu sehen ist. */
  usesTime = false;
  /** Schläft die Simulation (es geschah nichts mehr)? Eine Änderung weckt sie. */
  sleeping = false;

  private readonly varBy: Map<string, VarSpec>;
  private readonly known = new Set<string>(BUILTINS);
  private readonly kindNames: ReadonlySet<string>;
  private readonly lets: Let[] = [];
  /** Die Rechnungen, die die Raten brauchen (in ihrer Reihenfolge) — nur sie laufen in den Zwischenschritten. */
  private simLets: Let[] = [];
  /** Mit einer Welt: die Rechnungen des Bildes, die von der Zeit abhängen — vor denen der Dinge, die sie lesen dürfen. */
  private preLets: Let[] = [];
  private readonly grows: Grows[] = [];
  private readonly events: SimEvent[] = [];
  private readonly until: Expr | null = null;
  private readonly rules: Rule[] = [];
  private readonly keeps: { readonly when: Expr; readonly say: string }[] = [];
  /** Die Werte, von denen der Anfang der Simulation abhängt. */
  private readonly initDeps = new Set<string>();
  private readonly changed = new Set<string>();
  private readonly gos: string[] = [];
  private readonly samplers = new Set<(env: Env) => void>();
  private readonly resetters = new Set<() => void>();
  private saidNow: Said | null = null;
  private reached = false;
  private carry = 0;
  private exploded = false;
  /** Die Uhr der Regeln (`for`): Sekunden der Wirklichkeit — in einer Prüfung die der Simulation. */
  private ruleClock = 0;
  private quietFor = 0;
  private headless = false;
  /** Eine Prüfung ohne Simulation: was „so lange" gelten muss, gilt sofort. */
  private instant = false;
  private y0 = new Float64Array(0);
  private yt = new Float64Array(0);
  private k1 = new Float64Array(0);
  private k2 = new Float64Array(0);
  private k3 = new Float64Array(0);
  private k4 = new Float64Array(0);

  constructor(live: Live | null, options: ProgramOptions = {}) {
    const random = options.random ?? Math.random;
    this.vars = live?.vars ?? [];
    this.controls = live?.controls ?? [];
    this.panel = live?.panel ?? 'below';
    this.varBy = new Map(this.vars.map((v) => [v.name, v]));
    const worldSpec = live?.world ?? null;
    this.kindNames = new Set(worldSpec?.kinds.map((k) => k.name) ?? []);

    for (const name of BUILTINS) this.env[name] = name === 'n' ? 1 : 0;

    /* Die Namen zuerst — dann darf jede Rechnung jede andere sehen (eine spätere mit dem Wert des letzten Bildes). */
    for (const v of this.vars) this.known.add(v.name);
    for (const l of live?.lets ?? []) this.known.add(l.name);
    const sim = live?.sim ?? null;
    const stateNames: string[] = [];
    for (const s of sim?.state ?? []) {
      if (this.known.has(s.name)) { this.report({ where: `sim.state „${s.name}"`, error: 'ta nazwa jest już zmienną albo wartością liczoną', source: s.name, at: 0 }); continue; }
      this.known.add(s.name);
      stateNames.push(s.name);
    }
    const globalNames = new Set(this.known);
    /* Was über Dinge zusammenfasst (`all(belka, abs(mom) < tol)`), nennt ihre Namen — das ganze Bild kennt sie darum auch. */
    for (const k of worldSpec?.kinds ?? []) {
      for (const p of k.props) this.known.add(p.name);
      for (const l of k.lets) this.known.add(l.name);
      for (const s of k.state) this.known.add(s.name);
    }

    for (const v of this.vars) {
      const given = options.fixed?.[v.name];
      const drawn = v.random === null ? v.value : v.random[0] + random() * (v.random[1] - v.random[0]);
      this.env[v.name] = this.fit(v, typeof given === 'number' && Number.isFinite(given) ? given : drawn);
    }
    for (const l of live?.lets ?? []) {
      this.lets.push({ name: l.name, expr: this.compile(l.value, `let „${l.name}"`) ?? ZERO });
      this.env[l.name] = 0;
    }

    if (worldSpec !== null) {
      /* Was im Bild von der Zeit abhängt (durch seine Rechnungen) — die Dinge, die es lesen, dann auch. */
      const dynamic = new Set<string>([...stateNames, 't']);
      for (const l of this.lets) if (l.expr.reads.some((r) => dynamic.has(r))) dynamic.add(l.name);
      this.preLets = this.lets.filter((l) => dynamic.has(l.name) && !l.expr.reads.includes('#world'));
      this.world = new World(worldSpec, this.env, globalNames, (p) => this.report(p), { fixed: options.fixed, random, dynamic });
      if (options.world !== undefined && options.world !== null) this.world.restore(options.world);
    }

    const worldMoves = this.world !== null && worldSpec!.kinds.some((k) => k.state.length > 0);
    this.sim = sim !== null && (stateNames.length > 0 || worldMoves) ? sim : null;
    if (this.sim !== null) {
      for (const s of this.sim.state) {
        if (!stateNames.includes(s.name)) continue;
        this.grows.push({
          name: s.name,
          init: this.compile(s.value, `sim.state „${s.name}".value`) ?? ZERO,
          rate: this.compile(s.rate, `sim.state „${s.name}".rate`) ?? ZERO
        });
        this.env[s.name] = 0;
      }
      this.events = this.sim.events.map((e, i) => ({
        when: this.compile(e.when, `sim.events[${i}].when`) ?? ZERO,
        set: this.assigns(e.set, `sim.events[${i}].set`),
        stop: e.stop,
        say: e.say === '' ? null : this.compileText(e.say, `sim.events[${i}].say`),
        mood: e.mood,
        armed: true
      }));
      this.until = this.sim.until === null ? null : this.compile(this.sim.until, 'sim.until');
      this.simLets = this.letsFor(this.grows.flatMap((g) => g.rate.reads));
      for (const name of this.depsOf(this.grows.flatMap((g) => g.init.reads))) if (this.varBy.has(name)) this.initDeps.add(name);
    }

    this.rules = (live?.rules ?? []).map((spec, i) => ({
      spec,
      when: this.compile(spec.when, `rules[${i}].when`) ?? ZERO,
      set: this.assigns(spec.set, `rules[${i}].set`),
      say: spec.say === '' ? null : this.compileText(spec.say, `rules[${i}].say`),
      armed: true,
      fired: false,
      since: null
    }));
    this.keeps = (worldSpec?.keep ?? []).map((k, i) => ({ when: this.compile(k.when, `world.keep[${i}]`) ?? ZERO, say: k.say }));

    /*
     * WAS DEN VERSUCH AUSMACHT: nicht nur der Anfang, auch was Regeln und
     * Ereignisse prüfen (das Ziel, die Masse beim Stoss). Wer das Ziel nach
     * einem Wurf verschiebt, beginnt einen neuen Versuch — sonst träfe der alte
     * Aufschlag plötzlich. Was nur in den Raten steht (die Schwerkraft), wirkt
     * weiter sofort.
     */
    if (this.sim !== null) {
      const watched = [...this.rules.flatMap((r) => r.when.reads), ...this.events.flatMap((e) => e.when.reads)];
      for (const name of this.depsOf(watched)) if (this.varBy.has(name)) this.initDeps.add(name);
    }

    for (const c of this.controls) {
      if ('var' in c && !this.varBy.has(c.var)) this.report({ where: `controls (${c.type})`, error: `nie ma zmiennej „${c.var}" w "vars"`, source: c.var, at: 0 });
    }
    this.controlValues = this.controls.map((c) => (c.type === 'readout' ? this.compile(c.value, `controls (readout „${c.label}")`) : null));
    this.controlSets = this.controls.map((c) => (c.type === 'button' ? this.assigns(c.set, `controls (button „${c.label}")`) : []));
    this.controlShows = this.controls.map((c, i) => (c.show === null ? null : this.compile(c.show, `controls[${i}].show`)));

    this.restart();
    if (options.replay !== undefined && options.replay !== null && this.world !== null) {
      /* Jedes geänderte Ding ein Zug — eine Antwort mit zu vielen Zügen bricht eine Regel wie `edits <= 2`. */
      this.env.edits = this.world.replay(options.replay);
      this.restart();
    }
    if (this.world !== null) this.workshop = new Workshop(this, this.world);
  }

  /** Je Anzeige der Bedienung ihr Ausdruck, je Knopf seine Zuweisungen, je Element wann es zu sehen ist (Stelle wie in `controls`). */
  readonly controlValues: readonly (Expr | null)[];
  readonly controlSets: readonly (readonly Assign[])[];
  readonly controlShows: readonly (Expr | null)[];

  /** Einen Fehler merken — denselben nur einmal. */
  private report(problem: Problem): void {
    if (!this.problems.some((p) => p.where === problem.where && p.error === problem.error && p.source === problem.source)) this.problems.push(problem);
  }

  /* -- Übersetzen ----------------------------------------------------------------- */

  /**
   * EINEN AUSDRUCK ÜBERSETZEN — mit den Namen dieses Bildes (und `extra`, etwa
   * dem Lauf einer Kurve). Ein Fehler wird gemerkt; gerechnet wird trotzdem,
   * mit 0 für jeden unbekannten Namen, damit ein Tippfehler nicht das ganze
   * Bild leer lässt.
   */
  compile(source: string, where: string, extra: readonly string[] = []): Expr | null {
    const own = extra.length === 0 ? this.known : new Set([...this.known, ...extra]);
    const made = compile(source, { known: (name) => own.has(name), kinds: this.kindNames });
    if (!isExprError(made)) {
      if (made.reads.includes('time')) this.usesTime = true;
      return made;
    }
    this.report({ where, error: made.error, source: made.source, at: made.at });
    const loose = compile(source, { kinds: this.kindNames });
    return isExprError(loose) ? null : loose;
  }

  /** Ein Text mit `{…}` darin. */
  compileText(source: string, where: string): Expr | null {
    const made = compileText(source, { known: (name) => this.known.has(name), kinds: this.kindNames });
    if (!isExprError(made)) {
      if (made.reads.includes('time')) this.usesTime = true;
      return made;
    }
    this.report({ where, error: made.error, source: made.source, at: made.at });
    return null;
  }

  /** 2026-10-18 — ein Ausdruck in einem Ding der Welt (die Teile einer Art): mit den Namen der Dinge. */
  compileThing(source: string, where: string, extra: readonly string[] = [], text = false): Expr | null {
    if (this.world === null) return text ? this.compileText(source, where) : this.compile(source, where, extra);
    const made = text ? this.world.compileText(source, where) : this.world.compile(source, where, extra);
    if (made !== null && made.reads.includes('time')) this.usesTime = true;
    return made;
  }

  private assigns(set: Readonly<Record<string, string>>, where: string, extra: readonly string[] = []): Assign[] {
    const out: Assign[] = [];
    for (const [name, source] of Object.entries(set)) {
      if (!this.varBy.has(name) && !this.grows.some((g) => g.name === name) && !(this.sim?.state.some((s) => s.name === name) ?? false)) {
        this.report({ where, error: `„${name}" nie jest zmienną ani stanem symulacji — nie da się go ustawić`, source: name, at: 0 });
        continue;
      }
      const expr = this.compile(source, `${where} „${name}"`, extra);
      if (expr !== null) out.push({ name, expr });
    }
    return out;
  }

  /** Alle Namen, die diese Namen lesen — durch die Rechnungen hindurch. */
  private depsOf(names: readonly string[]): Set<string> {
    const out = new Set<string>();
    const queue = [...names];
    while (queue.length > 0) {
      const name = queue.pop()!;
      if (out.has(name)) continue;
      out.add(name);
      const l = this.lets.find((one) => one.name === name);
      if (l !== undefined) queue.push(...l.expr.reads);
    }
    return out;
  }

  /** Die Rechnungen, die diese Namen brauchen — in ihrer Reihenfolge. */
  private letsFor(names: readonly string[]): Let[] {
    const deps = this.depsOf(names);
    return this.lets.filter((l) => deps.has(l.name));
  }

  /* -- Werte -------------------------------------------------------------------------- */

  /** Ein Wert in seinen Grenzen, auf seinen Schritt gerastet. */
  private fit(v: VarSpec, value: number): number {
    let out = Number.isFinite(value) ? value : v.value;
    if (v.step !== null) out = (v.min ?? 0) + Math.round((out - (v.min ?? 0)) / v.step) * v.step;
    out = clamp(out, v.min ?? -1e12, v.max ?? 1e12);
    /* Rundungsreste eines Schritts wie 0.1 nicht mitschleppen. */
    return Math.round(out * 1e9) / 1e9;
  }

  /** Eine Zahl eines Namens. */
  value(name: string): number {
    return toNum(this.env[name] ?? 0);
  }

  varOf(name: string): VarSpec | undefined {
    return this.varBy.get(name);
  }

  /**
   * EINEN WERT SETZEN — von einem Schieber, einem Ziehen, einer Regel. Hängt der
   * Anfang der Simulation daran, beginnt sie von vorn (steht sie noch am Anfang:
   * der Anfang folgt). Gibt zurück, ob sich etwas geändert hat.
   */
  set(name: string, value: number): boolean {
    const spec = this.varBy.get(name);
    if (spec !== undefined) {
      const next = this.fit(spec, value);
      if (this.env[name] === next) return false;
      this.env[name] = next;
      this.changed.add(name);
      if (this.initDeps.has(name)) {
        const wasRunning = this.status === 'running';
        if (this.status === 'ready') this.initState();
        else this.restart();
        if (this.sim?.auto === true && wasRunning) this.status = 'running';
      }
      this.evalLets(this.lets);
      this.wake();
      return true;
    }
    if (this.grows.some((g) => g.name === name) || name === 'px' || name === 'py' || name === 'step') {
      if (!Number.isFinite(value) || this.env[name] === value) return false;
      this.env[name] = value;
      this.changed.add(name);
      return true;
    }
    return false;
  }

  /** Was sich seit dem letzten Mal geändert hat — und vergessen. Eine Welt meldet ihre Namen (`#world`: alles an ihr). */
  takeChanged(): Set<string> {
    const out = new Set(this.changed);
    this.changed.clear();
    this.world?.takeChanged(out);
    return out;
  }

  /** Die Werte, die man eingestellt hat — so wird eine Antwort gespeichert. */
  snapshot(): Record<string, number> {
    return Object.fromEntries(this.vars.map((v) => [v.name, this.value(v.name)]));
  }

  /** 2026-10-18 — der Bau der Welt, wie er gerade steht (für eine Antwort, zum Speichern). */
  worldSnapshot(): WorldShot | null {
    return this.world?.snapshot() ?? null;
  }

  /* -- Laufen ----------------------------------------------------------------------- */

  act(action: Action): void {
    switch (action) {
      case 'run':
        if (this.sim === null) return;
        if (this.status === 'ended') this.restart();
        this.status = 'running';
        this.sleeping = false;
        this.quietFor = 0;
        return;
      case 'pause':
        if (this.status === 'running') this.status = 'paused';
        this.sleeping = false;
        return;
      case 'toggle':
        this.act(this.status === 'running' || this.sleeping ? 'pause' : 'run');
        return;
      case 'reset':
        this.restart();
        return;
    }
  }

  /** Eine eingeschlafene Simulation wieder wecken (nach jeder Änderung). */
  wake(): void {
    if (this.sleeping) { this.sleeping = false; this.status = 'running'; }
    this.quietFor = 0;
  }

  /** Läuft etwas, das jedes Bild neu gezeichnet werden muss — auch eine Regel, die auf ihr `for` wartet? */
  busy(clock: boolean): boolean {
    return this.status === 'running' || (clock && this.usesTime) || this.rules.some((r) => r.since !== null && r.armed && r.spec.for > 0);
  }

  /** Die Spur, die ein Teil zieht: wird nach jedem Schritt gerufen (und vergisst bei `reset`). */
  onSample(sample: (env: Env) => void, reset: () => void): () => void {
    this.samplers.add(sample);
    this.resetters.add(reset);
    return () => { this.samplers.delete(sample); this.resetters.delete(reset); };
  }

  /** Von vorn: t = 0, der Anfang aus den Werten, die Regeln wieder scharf, die Spuren leer (der Bau einer Welt bleibt). */
  restart(): void {
    this.status = 'ready';
    this.sleeping = false;
    this.quietFor = 0;
    this.carry = 0;
    this.exploded = false;
    this.env.t = 0;
    this.changed.add('t');
    this.initState();
    for (const e of this.events) e.armed = true;
    for (const r of this.rules) { r.armed = true; r.fired = false; r.since = null; }
    this.reached = false;
    this.saidNow = null;
    if (this.world !== null) this.world.said = null;
    for (const reset of this.resetters) reset();
  }

  private initState(): void {
    for (const g of this.grows) this.env[g.name] = 0;
    this.evalLets(this.lets);
    /* Zuerst alle Anfänge rechnen, dann setzen: ein Anfang darf einen anderen lesen, wie er vor dem Neubeginn war. */
    const starts = this.grows.map((g) => toNum(g.init.run(this.env)));
    this.grows.forEach((g, i) => { this.env[g.name] = Number.isFinite(starts[i]) ? starts[i] : 0; this.changed.add(g.name); });
    this.world?.initAllState();
    this.evalLets(this.lets);
  }

  private evalLets(list: readonly Let[]): void {
    for (const l of list) {
      const v = l.expr.run(this.env);
      if (this.env[l.name] !== v) { this.env[l.name] = v; this.changed.add(l.name); }
    }
  }

  /** Die Uhr des Bildes weiter (nur wenn es zu sehen ist) und die Simulation um `seconds` (Wirklichkeit). */
  advance(seconds: number, clock: boolean): void {
    if (seconds > 0) this.ruleClock += seconds;
    if (clock && this.usesTime && seconds > 0) {
      this.env.time = toNum(this.env.time) + seconds;
      this.changed.add('time');
    }
    if (this.status !== 'running' || this.sim === null || seconds <= 0) return;
    const dt = this.sim.dt;
    this.carry += seconds * this.sim.speed;
    let steps = 0;
    while (this.carry >= dt && this.status === 'running') {
      this.stepOnce(dt);
      this.carry -= dt;
      steps += 1;
      if (steps >= MAX_STEPS_PER_CALL) { this.carry = 0; break; }
    }
    if (steps > 0) {
      this.changed.add('t');
      for (const g of this.grows) this.changed.add(g.name);
      /* Geschieht nichts mehr, schläft sie — das Telefon ruht, bis jemand etwas ändert. */
      if (this.sim.sleep && this.status === 'running' && this.quietFor >= QUIET_FOR) { this.status = 'paused'; this.sleeping = true; }
    }
  }

  /** Wie viele Grössen der Runge-Kutta trägt — die eigenen und die der Dinge (deren Zahl sich mit dem Bau ändert). */
  private sized(): number {
    const n = this.grows.length + (this.world?.slots.length ?? 0);
    if (this.y0.length !== n) {
      this.y0 = new Float64Array(n); this.yt = new Float64Array(n);
      this.k1 = new Float64Array(n); this.k2 = new Float64Array(n); this.k3 = new Float64Array(n); this.k4 = new Float64Array(n);
    }
    return n;
  }

  /** Die Raten an der Stelle `y` zur Zeit `t` — in `out`. */
  private rates(t: number, y: Float64Array, out: Float64Array): void {
    const env = this.env;
    const g = this.grows.length;
    env.t = t;
    for (let j = 0; j < g; j += 1) env[this.grows[j].name] = y[j];
    if (this.world !== null) {
      for (const l of this.preLets) env[l.name] = l.expr.run(env);
      this.world.writeState(y, g);
      this.world.evalLets('stage');
    }
    for (const l of this.simLets) env[l.name] = l.expr.run(env);
    for (let j = 0; j < g; j += 1) out[j] = toNum(this.grows[j].rate.run(env));
    this.world?.rates(out, g);
  }

  private readY(into: Float64Array): void {
    const g = this.grows.length;
    for (let j = 0; j < g; j += 1) into[j] = toNum(this.env[this.grows[j].name]);
    this.world?.readState(into, g);
  }

  private writeY(from: Float64Array): void {
    const g = this.grows.length;
    for (let j = 0; j < g; j += 1) this.env[this.grows[j].name] = from[j];
    this.world?.writeState(from, g);
  }

  /** Ein Schritt Runge-Kutta (vierter Ordnung), dann Ereignisse, Ende, Regeln, Spuren. */
  private stepOnce(dt: number): void {
    const n = this.sized();
    const env = this.env;
    const t = toNum(env.t);
    const { y0, yt, k1, k2, k3, k4 } = this;
    this.readY(y0);
    this.rates(t, y0, k1);
    for (let j = 0; j < n; j += 1) yt[j] = y0[j] + (dt / 2) * k1[j];
    this.rates(t + dt / 2, yt, k2);
    for (let j = 0; j < n; j += 1) yt[j] = y0[j] + (dt / 2) * k2[j];
    this.rates(t + dt / 2, yt, k3);
    for (let j = 0; j < n; j += 1) yt[j] = y0[j] + dt * k3[j];
    this.rates(t + dt, yt, k4);
    let broken = false;
    for (let j = 0; j < n; j += 1) {
      yt[j] = y0[j] + (dt / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]);
      if (!Number.isFinite(yt[j])) broken = true;
    }
    if (broken) {
      this.writeY(y0);
      env.t = t;
      this.status = 'ended';
      if (!this.exploded) {
        this.exploded = true;
        this.report({ where: 'sim', error: 'symulacja dała nieskończoność albo NaN — sprawdź „rate" (dzielenie przez 0?)', source: '', at: 0 });
      }
      return;
    }
    this.writeY(yt);
    env.t = t + dt;
    if (this.headless) this.ruleClock += dt;
    if (this.world !== null) {
      this.world.touchState();
      this.world.evalLets('dynamic');
      this.world.events();
      if (this.world.said !== null) { this.saidNow = { ...this.world.said, goal: false }; this.world.said = null; }
    }
    this.evalLets(this.lets);

    for (const e of this.events) {
      if (!truth(e.when.run(env))) { e.armed = true; continue; }
      if (!e.armed) continue;
      this.apply(e.set);
      if (e.say !== null) this.saidNow = { text: String(e.say.run(env)), mood: e.mood, goal: false };
      if (e.stop) this.status = 'ended';
      /* Hat es seine Bedingung selbst aufgehoben (ein Anschlag), ist es gleich wieder scharf. */
      e.armed = !truth(e.when.run(env));
    }

    /* Ruhig ist, was sich über den ganzen Schritt (mit den Ereignissen) kaum bewegt hat — auch eine Belke, die am Anschlag liegt. */
    this.readY(yt);
    let most = 0;
    for (let j = 0; j < n; j += 1) most = Math.max(most, Math.abs(yt[j] - y0[j]));
    this.quietFor = most / dt < QUIET_RATE ? this.quietFor + dt : 0;

    if (this.until !== null && truth(this.until.run(env))) this.status = 'ended';
    if (toNum(env.t) >= (this.sim?.max ?? Infinity)) this.status = 'ended';

    this.applyRules();
    for (const sample of this.samplers) sample(env);

    if (this.status === 'ended' && this.sim?.loop === true) {
      this.restart();
      this.status = 'running';
    }
  }

  /** Zuweisungen GLEICHZEITIG: erst alle rechnen, dann alle setzen (ein Stoss tauscht Geschwindigkeiten). */
  private apply(set: readonly Assign[]): void {
    if (set.length === 0) return;
    const values = set.map((a) => toNum(a.expr.run(this.env)));
    set.forEach((a, i) => {
      const spec = this.varBy.get(a.name);
      if (spec !== undefined) this.set(a.name, values[i]);
      else if (Number.isFinite(values[i])) { this.env[a.name] = values[i]; this.changed.add(a.name); }
    });
    this.evalLets(this.lets);
  }

  /** Die Regeln: eine, deren Bedingung wahr WIRD (und, mit `for`, so lange wahr BLEIBT), tut, was sie sagt. */
  private applyRules(): void {
    for (const r of this.rules) {
      const now = truth(r.when.run(this.env));
      if (!now) { r.since = null; if (!r.spec.once || !r.fired) r.armed = true; continue; }
      if (!r.armed) continue;
      if (r.spec.for > 0 && !this.instant) {
        if (r.since === null) r.since = this.ruleClock;
        if (this.ruleClock - r.since < r.spec.for - 1e-9) continue;
      }
      r.armed = false;
      r.fired = true;
      this.apply(r.set);
      if (r.spec.goal) this.reached = true;
      if (r.say !== null) this.saidNow = { text: String(r.say.run(this.env)), mood: r.spec.mood, goal: r.spec.goal };
      if (r.spec.go !== null) this.gos.push(r.spec.go);
      if (r.spec.do !== null) this.act(r.spec.do);
    }
  }

  /** Nach einer Eingabe oder einem Bild: Rechnungen (der Dinge, dann des Bildes) und Regeln auf den neuesten Stand. */
  settle(): void {
    this.world?.evalLets('all');
    this.evalLets(this.lets);
    this.applyRules();
  }

  /** Ein Knopf oder ein angetippter Teil: Werte setzen (übersetzt mit `prepare`), tun, weiter. */
  press(set: readonly Assign[], action: Action | null, go: string | null): void {
    this.apply(set);
    if (action !== null) this.act(action);
    if (go !== null) this.gos.push(go);
    this.wake();
    this.settle();
  }

  /** Übersetzte Zuweisungen — für Griffe und Teile, die man antippt (einmal, beim Bauen). */
  prepare(set: Readonly<Record<string, string>>, where: string, extra: readonly string[] = []): Assign[] {
    return this.assigns(set, where, extra);
  }

  /* -- 2026-10-18: für die Werkstatt (`liveEdit.ts`) ------------------------------------------ */

  /** Gibt es Regeln, die immer gelten müssen (`keep`)? */
  get guarded(): boolean {
    return this.keeps.length > 0;
  }

  /** Gilt noch alles, was immer gelten muss? Sonst: was dazu gesagt wird. */
  broken(): string | null {
    for (const k of this.keeps) if (!truth(k.when.run(this.env))) return k.say || 'Tego nie wolno w tym zadaniu.';
    return null;
  }

  /** Ein Wert hat sich geändert (die Werkstatt zählt `edits`). */
  touch(name: string): void {
    this.changed.add(name);
  }

  /** Etwas unter das Bild schreiben (die Werkstatt: „Zapisano"). */
  say(text: string, mood: Mood = 'info'): void {
    this.saidNow = { text, mood, goal: false };
  }

  /* -- Melden ------------------------------------------------------------------------- */

  /** Die letzte Meldung (`null`: keine). */
  said(): Said | null {
    return this.saidNow;
  }

  /** Ist das Ziel erreicht (seit dem letzten Neubeginn)? */
  goalReached(): boolean {
    return this.reached;
  }

  /** Hat das Bild überhaupt ein Ziel? */
  hasGoal(): boolean {
    return this.rules.some((r) => r.spec.goal);
  }

  /** Wohin die Präsentation soll — und vergessen. */
  takeGos(): string[] {
    return this.gos.splice(0, this.gos.length);
  }

  /**
   * OHNE BILD BIS ZUM ENDE — für eine Prüfung (Cogita): von vorn, mit den
   * Werten, die jetzt stehen, laufen lassen, bis `until`, ein Ereignis mit
   * `stop`, `max` (höchstens zwei Minuten der Simulation) es beendet, ein Ziel
   * erreicht ist — oder alles zur Ruhe gekommen ist und keine Regel auf die
   * Zeit wartet. Ohne Simulation: die Regeln einmal. Gibt zurück, ob ein Ziel
   * erreicht wurde — irgendwann unterwegs.
   */
  runToEnd(): boolean {
    this.headless = true;
    this.instant = this.sim === null;
    this.restart();
    this.settle();
    if (this.sim === null || this.reached) return this.reached;
    this.status = 'running';
    const loop = this.sim.loop;
    const limit = Math.min(this.sim.max, HEADLESS_SECONDS);
    const timed = this.rules.some((r) => r.when.reads.includes('t')) || (this.until?.reads.includes('t') ?? false) || this.events.some((e) => e.when.reads.includes('t'));
    const calm = Math.max(QUIET_FOR, ...this.rules.map((r) => r.spec.for)) + 0.5;
    let steps = 0;
    while (this.status === 'running' && steps < MAX_STEPS_HEADLESS && !this.reached) {
      this.stepOnce(this.sim.dt);
      steps += 1;
      /* Eine Schleife hört nie auf: eine Prüfung nimmt einen Durchgang. */
      if (loop && toNum(this.env.t) === 0) break;
      if (toNum(this.env.t) >= limit) break;
      if (!timed && this.quietFor >= calm) break;
    }
    if (this.status === 'running') this.status = 'ended';
    return this.reached;
  }

  /** Wie ein Wert heisst und in welcher Einheit — für die gespeicherte Antwort. */
  describe(values: Readonly<Record<string, number>>): string {
    return this.vars.filter((v) => typeof values[v.name] === 'number')
      .map((v) => `${v.label || v.name} = ${String(Math.round(values[v.name] * 1000) / 1000).replace('.', ',')}${v.unit === '' ? '' : ` ${v.unit}`}`)
      .join('; ');
  }
}

/** Ein Programm aus einer Zeichnung (genauer: ihrem Teil zum Anfassen). */
export const programOf = (live: Live | null, options: ProgramOptions = {}): Program => new Program(live, options);
