/**
 * 2026-10-18 — EINE AUFGABE ZIEHEN, GLEICH SCHWER (`liveModel.ts`: `task`):
 * jedes Mal andere Zahlen, dieselbe Aufgabe. Gezogen wird, was `random` hat
 * — Werte des Bildes und Eigenschaften der Dinge; Eigenschaften als Rechnung
 * (`"pos": "=3 + s"`) folgen daraus —, so lange, bis
 *
 * <code>
 *   require   jede Bedingung gilt (was die Schwierigkeit gleich hält, sagt die Aufgabe selbst:
 *             dieselben Schritte, Zahlen aus demselben Bereich, die Lösung auf dem Raster)
 *   goal      keine Regel mit "goal" schon am Anfang gilt (nichts ist schon gelöst)
 *   solve     die Lösung mit der Hand erreichbar ist: an etwas, das man ändern darf, in seinen Grenzen
 *   avoid     sie nicht dieselbe ist wie die eben gezeigte („Nowe zadanie")
 * </code>
 *
 * Findet sich in `tries` Zügen keine, gilt die Aufgabe, wie sie im Dokument
 * steht (die `value`s). Dieselbe Rechnung zieht auf einer Seite (bei jedem
 * Besuch, mit jedem „Nowe zadanie") und in Cogita (je Versuch, aus dem Samen
 * der Karte — dort festgehalten, damit die Prüfung dieselben Zahlen sieht).
 * Kein Spiel ist dafür Code: die Waage zieht ihre Stufen so, ein Wurf sein
 * Ziel, ein Zahnrad seine Zähne.
 */

import { toNum, truth, type Env, type Expr } from './expr';
import type { TaskSpec, VarSpec } from './liveModel';
import type { World } from './liveWorld';

/** Ein Zufall aus einem Samen (mulberry32) — dasselbe Bild für denselben Samen. */
export function seeded(seed: string): () => number {
  let a = 2166136261;
  for (let i = 0; i < seed.length; i += 1) a = Math.imul(a ^ seed.charCodeAt(i), 16777619) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Was das Programm einer Aufgabe gibt (`liveRun.ts`). */
export interface TaskHost {
  readonly env: Env;
  readonly vars: readonly VarSpec[];
  readonly world: World | null;
  compile(source: string, where: string): Expr | null;
  report(problem: { readonly where: string; readonly error: string; readonly source: string; readonly at: number }): void;
  /** Ein Wert in seinen Grenzen, auf seinen Schritt gerastet. */
  fit(v: VarSpec, value: number): number;
  /** Die gezogene Aufgabe aufbauen: die Rechnungen des Bildes, die Dinge der Welt, der Anfang der Simulation. */
  begin(random: () => number, fixed: Readonly<Record<string, number>>): void;
  /** Gilt gerade eine Regel mit `goal`? */
  goalNow(): boolean;
}

export class TaskPlan {
  private readonly requires: readonly Expr[];
  private readonly solves: readonly (readonly [string, Expr])[];

  constructor(readonly spec: TaskSpec | null, private readonly host: TaskHost) {
    this.requires = (spec?.require ?? []).map((source, i) => host.compile(source, `task.require[${i}]`)).filter((e): e is Expr => e !== null);
    this.solves = Object.entries(spec?.solve ?? {}).flatMap(([key, source]): (readonly [string, Expr])[] => {
      if (!this.knows(key)) {
        host.report({ where: 'task.solve', error: `„${key}" — nie ma takiej zmiennej ani własności rzeczy (rzecz.własność)`, source: key, at: 0 });
        return [];
      }
      const e = host.compile(source, `task.solve „${key}"`);
      return e === null ? [] : [[key, e]];
    });
  }

  /** Ein Schlüssel der Lösung: ein Wert des Bildes oder eine Eigenschaft eines Dings, das am Anfang dasteht. */
  private knows(key: string): boolean {
    const dot = key.indexOf('.');
    if (dot < 0) return this.host.vars.some((v) => v.name === key);
    const thing = this.host.world?.spec.things.find((t) => t.id === key.slice(0, dot));
    return thing !== undefined && (this.host.world?.kinds.get(thing.kind)?.props.has(key.slice(dot + 1)) ?? false);
  }

  /** Zieht diese Aufgabe überhaupt etwas, das nicht feststeht? */
  free(fixed: Readonly<Record<string, number>>): boolean {
    return this.host.vars.some((v) => v.random !== null && !(v.name in fixed)) || (this.host.world?.drawsRandom(fixed) ?? false);
  }

  /**
   * EINE AUFGABE ZIEHEN — `keep`: Werte, die bleiben, wie sie sind (was die
   * Person selbst eingestellt hat); `avoid`: nicht diese (die eben gezeigte).
   */
  draw(random: () => number, fixed: Readonly<Record<string, number>>, keep: ReadonlySet<string>, avoid: string | null): void {
    const free = this.free(fixed);
    const tries = this.spec === null || !free ? 1 : this.spec.tries;
    for (let n = 0; n < tries; n += 1) {
      this.drawVars(random, fixed, keep, false);
      this.host.begin(random, fixed);
      if (this.spec === null || !free || (this.holds() && this.key() !== avoid)) return;
    }
    /* Keine passte: die Aufgabe, wie sie im Dokument steht (der Zufall der Dinge in der Mitte seines Bereichs). */
    this.drawVars(random, fixed, keep, true);
    this.host.begin(() => 0.5, fixed);
  }

  private drawVars(random: () => number, fixed: Readonly<Record<string, number>>, keep: ReadonlySet<string>, plain: boolean): void {
    const env = this.host.env;
    for (const v of this.host.vars) {
      const given = fixed[v.name];
      if (typeof given === 'number' && Number.isFinite(given)) { env[v.name] = this.host.fit(v, given); continue; }
      if (keep.has(v.name)) continue;
      const drawn = v.random === null || plain ? v.value : v.random[0] + random() * (v.random[1] - v.random[0]);
      env[v.name] = this.host.fit(v, drawn);
    }
  }

  /** Gilt die gezogene Aufgabe? (Bedingungen, nicht schon gelöst, Lösung erreichbar.) */
  holds(): boolean {
    const env = this.host.env;
    if (!this.requires.every((e) => truth(e.run(env)))) return false;
    if (this.host.goalNow()) return false;
    for (const [key, e] of this.solves) {
      const v = toNum(e.run(env));
      if (!Number.isFinite(v)) return false;
      const dot = key.indexOf('.');
      if (dot < 0) {
        const spec = this.host.vars.find((x) => x.name === key);
        if (spec !== undefined && ((spec.min !== null && v < spec.min - 1e-9) || (spec.max !== null && v > spec.max + 1e-9))) return false;
        continue;
      }
      const world = this.host.world;
      const t = world?.get(key.slice(0, dot));
      if (world === null || t === undefined || !world.reachable(t, key.slice(dot + 1), v)) return false;
    }
    return true;
  }

  /** Was gezogen wurde: die Werte mit `random` und die Eigenschaften der Dinge aus Zufall oder Rechnung (`ding.eigenschaft`). */
  drawn(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const v of this.host.vars) if (v.random !== null) out[v.name] = toNum(this.host.env[v.name] ?? 0);
    return { ...out, ...(this.host.world?.drawn() ?? {}) };
  }

  /** Die gezogene Aufgabe als Text — um dieselbe nicht gleich wieder zu zeigen. */
  key(): string {
    return JSON.stringify(this.drawn());
  }

  /** Die Lösung mit den Werten dieser Aufgabe — Wert (oder `ding.eigenschaft`) → Zahl. */
  solution(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [key, e] of this.solves) {
      const v = toNum(e.run(this.host.env));
      if (Number.isFinite(v)) out[key] = v;
    }
    return out;
  }
}
