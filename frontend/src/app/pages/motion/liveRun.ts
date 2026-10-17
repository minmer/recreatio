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
 *   paused   angehalten
 *   ended    `until` ist wahr geworden (oder `max` erreicht, oder ein Ereignis mit `stop`)
 * </code>
 *
 * Ändert man einen Wert, von dem der Anfang abhängt, beginnt es von vorn;
 * einer, der nur die Raten ändert (die Schwerkraft, die Dämpfung), wirkt
 * sofort, ohne Neubeginn.
 */

import type { Drawing, Shape } from './drawing';
import { compile, compileText, isExprError, newEnv, toNum, truth, type Env, type Expr } from './expr';
import { BUILTINS, type Action, type ControlSpec, type Live, type Mood, type Num, type RuleSpec, type SimSpec, type VarSpec } from './liveModel';

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
  /** Werte, die feststehen (in Cogita: der gezogene Zufall, die Antwort des Lernenden). */
  readonly fixed?: Readonly<Record<string, number>>;
  /** Der Zufall für `random` — sonst `Math.random`. */
  readonly random?: () => number;
}

/** Höchstens so viele Schritte je Bild (danach läuft es langsamer, statt das Telefon anzuhalten) — und je Prüfung. */
const MAX_STEPS_PER_CALL = 6000;
const MAX_STEPS_HEADLESS = 600_000;

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

const ZERO: Expr = { source: '0', run: () => 0, reads: [], constant: true };

const clamp = (value: number, min: number, max: number): number => (value < min ? min : value > max ? max : value);

export class Program {
  readonly env: Env = newEnv();
  readonly problems: Problem[] = [];
  readonly vars: readonly VarSpec[];
  readonly controls: readonly ControlSpec[];
  readonly panel: 'below' | 'side';
  readonly sim: SimSpec | null;
  status: Status = 'ready';
  /** Ob etwas die Uhr `time` liest — dann läuft das Bild, solange es zu sehen ist. */
  usesTime = false;

  private readonly varBy: Map<string, VarSpec>;
  private readonly known = new Set<string>(BUILTINS);
  private readonly lets: { readonly name: string; readonly expr: Expr }[] = [];
  /** Die Rechnungen, die die Raten brauchen (in ihrer Reihenfolge) — nur sie laufen in den Zwischenschritten. */
  private simLets: { readonly name: string; readonly expr: Expr }[] = [];
  private readonly grows: Grows[] = [];
  private readonly events: SimEvent[] = [];
  private readonly until: Expr | null = null;
  private readonly rules: Rule[] = [];
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

    for (const v of this.vars) {
      const given = options.fixed?.[v.name];
      const drawn = v.random === null ? v.value : v.random[0] + random() * (v.random[1] - v.random[0]);
      this.env[v.name] = this.fit(v, typeof given === 'number' && Number.isFinite(given) ? given : drawn);
    }
    for (const l of live?.lets ?? []) {
      this.lets.push({ name: l.name, expr: this.compile(l.value, `let „${l.name}"`) ?? ZERO });
      this.env[l.name] = 0;
    }

    this.sim = sim !== null && stateNames.length > 0 ? sim : null;
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
        say: e.say === '' ? null : this.compileSay(e.say, `sim.events[${i}].say`),
        mood: e.mood,
        armed: true
      }));
      this.until = this.sim.until === null ? null : this.compile(this.sim.until, 'sim.until');
      const n = this.grows.length;
      this.y0 = new Float64Array(n); this.yt = new Float64Array(n);
      this.k1 = new Float64Array(n); this.k2 = new Float64Array(n); this.k3 = new Float64Array(n); this.k4 = new Float64Array(n);
      this.simLets = this.letsFor(this.grows.flatMap((g) => g.rate.reads));
      for (const name of this.depsOf(this.grows.flatMap((g) => g.init.reads))) if (this.varBy.has(name)) this.initDeps.add(name);
    }

    this.rules = (live?.rules ?? []).map((spec, i) => ({
      spec,
      when: this.compile(spec.when, `rules[${i}].when`) ?? ZERO,
      set: this.assigns(spec.set, `rules[${i}].set`),
      say: spec.say === '' ? null : this.compileSay(spec.say, `rules[${i}].say`),
      armed: true,
      fired: false
    }));

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

    this.restart();
  }

  /** Je Anzeige der Bedienung ihr Ausdruck, je Knopf seine Zuweisungen (Stelle wie in `controls`). */
  readonly controlValues: readonly (Expr | null)[];
  readonly controlSets: readonly (readonly Assign[])[];

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
    const made = compile(source, (name) => own.has(name));
    if (!isExprError(made)) {
      if (made.reads.includes('time')) this.usesTime = true;
      return made;
    }
    this.report({ where, error: made.error, source: made.source, at: made.at });
    const loose = compile(source);
    return isExprError(loose) ? null : loose;
  }

  /** Ein Text mit `{…}` darin. */
  compileText(source: string, where: string, extra: readonly string[] = []): Expr | null {
    const own = extra.length === 0 ? this.known : new Set([...this.known, ...extra]);
    const made = compileText(source, (name) => own.has(name));
    if (!isExprError(made)) {
      if (made.reads.includes('time')) this.usesTime = true;
      return made;
    }
    this.report({ where, error: made.error, source: made.source, at: made.at });
    return null;
  }

  private compileSay(source: string, where: string): Expr | null {
    return this.compileText(source, where);
  }

  private assigns(set: Readonly<Record<string, string>>, where: string, extra: readonly string[] = []): Assign[] {
    const out: Assign[] = [];
    for (const [name, source] of Object.entries(set)) {
      if (!this.varBy.has(name) && !this.grows.some((g) => g.name === name)) {
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
  private letsFor(names: readonly string[]): { readonly name: string; readonly expr: Expr }[] {
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

  /** Was sich seit dem letzten Mal geändert hat — und vergessen. */
  takeChanged(): Set<string> {
    const out = new Set(this.changed);
    this.changed.clear();
    return out;
  }

  /** Die Werte, die man eingestellt hat — so wird eine Antwort gespeichert. */
  snapshot(): Record<string, number> {
    return Object.fromEntries(this.vars.map((v) => [v.name, this.value(v.name)]));
  }

  /* -- Laufen ----------------------------------------------------------------------- */

  act(action: Action): void {
    switch (action) {
      case 'run':
        if (this.sim === null) return;
        if (this.status === 'ended') this.restart();
        this.status = 'running';
        return;
      case 'pause':
        if (this.status === 'running') this.status = 'paused';
        return;
      case 'toggle':
        this.act(this.status === 'running' ? 'pause' : 'run');
        return;
      case 'reset':
        this.restart();
        return;
    }
  }

  /** Läuft etwas, das jedes Bild neu gezeichnet werden muss? */
  busy(clock: boolean): boolean {
    return this.status === 'running' || (clock && this.usesTime);
  }

  /** Die Spur, die ein Teil zieht: wird nach jedem Schritt gerufen (und vergisst bei `reset`). */
  onSample(sample: (env: Env) => void, reset: () => void): () => void {
    this.samplers.add(sample);
    this.resetters.add(reset);
    return () => { this.samplers.delete(sample); this.resetters.delete(reset); };
  }

  /** Von vorn: t = 0, der Anfang aus den Werten, die Regeln wieder scharf, die Spuren leer. */
  restart(): void {
    this.status = 'ready';
    this.carry = 0;
    this.exploded = false;
    this.env.t = 0;
    this.changed.add('t');
    this.initState();
    for (const e of this.events) e.armed = true;
    for (const r of this.rules) { r.armed = true; r.fired = false; }
    this.reached = false;
    this.saidNow = null;
    for (const reset of this.resetters) reset();
  }

  private initState(): void {
    for (const g of this.grows) this.env[g.name] = 0;
    this.evalLets(this.lets);
    /* Zuerst alle Anfänge rechnen, dann setzen: ein Anfang darf einen anderen lesen, wie er vor dem Neubeginn war. */
    const starts = this.grows.map((g) => toNum(g.init.run(this.env)));
    this.grows.forEach((g, i) => { this.env[g.name] = Number.isFinite(starts[i]) ? starts[i] : 0; this.changed.add(g.name); });
    this.evalLets(this.lets);
  }

  private evalLets(list: readonly { readonly name: string; readonly expr: Expr }[]): void {
    for (const l of list) {
      const v = l.expr.run(this.env);
      if (this.env[l.name] !== v) { this.env[l.name] = v; this.changed.add(l.name); }
    }
  }

  /** Die Uhr des Bildes weiter (nur wenn es zu sehen ist) und die Simulation um `seconds` (Wirklichkeit). */
  advance(seconds: number, clock: boolean): void {
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
    }
  }

  /** Die Raten an der Stelle `y` zur Zeit `t` — in `out`. */
  private rates(t: number, y: Float64Array, out: Float64Array): void {
    const env = this.env;
    env.t = t;
    for (let j = 0; j < this.grows.length; j += 1) env[this.grows[j].name] = y[j];
    for (const l of this.simLets) env[l.name] = l.expr.run(env);
    for (let j = 0; j < this.grows.length; j += 1) out[j] = toNum(this.grows[j].rate.run(env));
  }

  /** Ein Schritt Runge-Kutta (vierter Ordnung), dann Ereignisse, Ende, Regeln, Spuren. */
  private stepOnce(dt: number): void {
    const n = this.grows.length;
    const env = this.env;
    const t = toNum(env.t);
    const { y0, yt, k1, k2, k3, k4 } = this;
    for (let j = 0; j < n; j += 1) y0[j] = toNum(env[this.grows[j].name]);
    this.rates(t, y0, k1);
    for (let j = 0; j < n; j += 1) yt[j] = y0[j] + (dt / 2) * k1[j];
    this.rates(t + dt / 2, yt, k2);
    for (let j = 0; j < n; j += 1) yt[j] = y0[j] + (dt / 2) * k2[j];
    this.rates(t + dt / 2, yt, k3);
    for (let j = 0; j < n; j += 1) yt[j] = y0[j] + dt * k3[j];
    this.rates(t + dt, yt, k4);
    let broken = false;
    for (let j = 0; j < n; j += 1) {
      const v = y0[j] + (dt / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]);
      if (!Number.isFinite(v)) broken = true;
      env[this.grows[j].name] = v;
    }
    env.t = t + dt;
    if (broken) {
      for (let j = 0; j < n; j += 1) env[this.grows[j].name] = y0[j];
      env.t = t;
      this.status = 'ended';
      if (!this.exploded) {
        this.exploded = true;
        this.report({ where: 'sim', error: 'symulacja dała nieskończoność albo NaN — sprawdź „rate" (dzielenie przez 0?)', source: '', at: 0 });
      }
      return;
    }
    this.evalLets(this.lets);

    for (const e of this.events) {
      const now = truth(e.when.run(env));
      if (!now) { e.armed = true; continue; }
      if (!e.armed) continue;
      e.armed = false;
      this.apply(e.set);
      if (e.say !== null) this.saidNow = { text: String(e.say.run(env)), mood: e.mood, goal: false };
      if (e.stop) this.status = 'ended';
    }

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

  /** Die Regeln: eine, deren Bedingung wahr WIRD, tut, was sie sagt. */
  private applyRules(): void {
    for (const r of this.rules) {
      const now = truth(r.when.run(this.env));
      if (!now) { if (!r.spec.once || !r.fired) r.armed = true; continue; }
      if (!r.armed) continue;
      r.armed = false;
      r.fired = true;
      this.apply(r.set);
      if (r.spec.goal) this.reached = true;
      if (r.say !== null) this.saidNow = { text: String(r.say.run(this.env)), mood: r.spec.mood, goal: r.spec.goal };
      if (r.spec.go !== null) this.gos.push(r.spec.go);
      if (r.spec.do !== null) this.act(r.spec.do);
    }
  }

  /** Nach einer Eingabe oder einem Bild: Rechnungen und Regeln auf den neuesten Stand. */
  settle(): void {
    this.evalLets(this.lets);
    this.applyRules();
  }

  /** Ein Knopf oder ein angetippter Teil: Werte setzen (übersetzt mit `prepare`), tun, weiter. */
  press(set: readonly Assign[], action: Action | null, go: string | null): void {
    this.apply(set);
    if (action !== null) this.act(action);
    if (go !== null) this.gos.push(go);
    this.settle();
  }

  /** Übersetzte Zuweisungen — für Griffe und Teile, die man antippt (einmal, beim Bauen). */
  prepare(set: Readonly<Record<string, string>>, where: string, extra: readonly string[] = []): Assign[] {
    return this.assigns(set, where, extra);
  }

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
   * `stop` oder `max` es beendet. Ohne Simulation: die Regeln einmal. Gibt
   * zurück, ob ein Ziel erreicht wurde — irgendwann unterwegs.
   */
  runToEnd(): boolean {
    this.restart();
    this.settle();
    if (this.sim === null) return this.reached;
    this.status = 'running';
    const loop = this.sim.loop;
    let steps = 0;
    while (this.status === 'running' && steps < MAX_STEPS_HEADLESS) {
      this.stepOnce(this.sim.dt);
      steps += 1;
      /* Eine Schleife hört nie auf: eine Prüfung nimmt einen Durchgang. */
      if (loop && toNum(this.env.t) === 0) break;
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

/**
 * WAS IN EINER ZEICHNUNG NICHT STIMMT — ohne sie zu zeichnen: das Programm und
 * jeder Ausdruck an jedem Teil (Werte, `show`, Kurven, Spuren, Punkte, Rahmen,
 * Ziehen, Antippen), übersetzt mit denselben Namen wie beim Zeichnen.
 */
export function problemsOf(drawing: Drawing): Problem[] {
  const program = new Program(drawing.live);
  const num = (n: Num, where: string, extra: readonly string[] = []) => { if (typeof n !== 'number') program.compile(n.expr, where, extra); };
  const walk = (list: readonly Shape[], depth: number, path: string) => {
    if (depth > 8) return;
    list.forEach((s, i) => {
      const where = `${path}[${i}] ${s.type}`;
      for (const [key, source] of Object.entries(s.bind ?? {})) {
        if (key === 'text') program.compileText(source, `${where}.text`);
        else program.compile(source, `${where}.${key}`);
      }
      if (s.show !== null) program.compile(s.show, `${where}.show`);
      if (s.type === 'plot') {
        for (const [key, source] of [['fn', s.fn], ['fx', s.fx], ['fy', s.fy]] as const) if (source !== null) program.compile(source, `${where}.${key}`, [s.var]);
        num(s.from, `${where}.from`);
        num(s.to, `${where}.to`);
      }
      if (s.type === 'trace') for (const [key, source] of [['fx', s.fx], ['fy', s.fy]] as const) if (source !== null) program.compile(source, `${where}.${key}`);
      s.points.forEach(([a, b], k) => { num(a, `${where}.points[${k}]`); num(b, `${where}.points[${k}]`); });
      s.view?.forEach((n, k) => num(n, `${where}.view[${k}]`));
      if (s.drag !== null) {
        program.prepare({ ...(s.drag.x === null ? {} : { [s.drag.x]: 'px' }), ...(s.drag.y === null ? {} : { [s.drag.y]: 'py' }), ...s.drag.set }, `${where}.drag`);
      }
      if (s.tap !== null) program.prepare(s.tap.set, `${where}.tap`);
      walk(s.type === 'use' ? drawing.symbols.get(s.use ?? '') ?? [] : s.children, depth + 1, `${where}.children`);
    });
  };
  walk(drawing.elements, 0, 'elements');
  return [...program.problems];
}
