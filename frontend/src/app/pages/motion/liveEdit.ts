/**
 * 2026-10-18 — DIE WERKSTATT EINER WELT: jede Änderung am Bau, die jemand
 * macht (anhängen, einstellen, ziehen, antippen, wegnehmen, kopieren), geht
 * hier durch — gemerkt für „Cofnij", gezählt (`edits`, auch in Ausdrücken zu
 * lesen: „höchstens drei Züge") und zurückgenommen, wenn danach eine Regel der
 * Welt (`keep`) nicht mehr gilt. Die Welt selbst (`liveWorld.ts`) prüft, ob
 * etwas überhaupt erlaubt ist und in seinen Grenzen liegt; das Programm
 * (`liveRun.ts`) rechnet danach weiter.
 *
 * Ein Ziehen ist EINE Änderung (gemerkt beim ersten Schritt), ein Schieber,
 * der gezogen wird, auch (dieselbe Eigenschaft kurz hintereinander). In einer
 * Aufgabe zum Vermuten (`predict`) hält jede Änderung nach einer Prüfung das
 * Bild wieder an: man ändert seine Vermutung und prüft sie von neuem.
 */

import { toNum } from './expr';
import type { Program } from './liveRun';
import type { World } from './liveWorld';
import type { Thing, WorldShot } from './liveThings';

/** Dieselbe Eigenschaft innerhalb dieser Zeit (ms) wieder eingestellt: dieselbe Änderung. */
const COALESCE_MS = 1500;

export class Workshop {
  /** Welche Eigenschaft zuletzt eingestellt wurde, und wann. */
  private editing: { key: string; at: number } | null = null;

  constructor(private readonly program: Program, readonly world: World) {}

  private count(by: number): void {
    const env = this.program.env;
    env.edits = Math.max(0, toNum(env.edits) + by);
    this.program.touch('edits');
  }

  /**
   * EINE ÄNDERUNG AM BAU — gemerkt, gezählt, und zurückgenommen, wenn danach
   * eine Regel der Welt nicht mehr gilt. Gibt zurück, ob sie geblieben ist.
   */
  mutate(change: (world: World) => boolean): boolean {
    const w = this.world;
    this.editing = null;
    this.program.touchedByUser();
    w.remember();
    this.count(1);
    if (!change(w)) { w.forget(false); this.count(-1); return false; }
    this.program.settle();
    const bad = this.program.broken();
    if (bad !== null) {
      w.forget();
      this.count(-1);
      this.program.settle();
      this.program.say(bad, 'miss');
      return false;
    }
    this.program.wake();
    return true;
  }

  /** Eine Änderung innerhalb einer schon gemerkten (ein Schritt des Ziehens): gilt danach eine Regel nicht, bleibt alles, wie es war. */
  private within(change: (world: World) => boolean): boolean {
    const w = this.world;
    const shot = this.program.guarded ? w.snapshot() : null;
    if (!change(w)) return false;
    this.program.settle();
    const bad = shot === null ? null : this.program.broken();
    if (bad !== null && shot !== null) {
      w.restore(shot);
      this.program.settle();
      this.program.say(bad, 'miss');
      return false;
    }
    this.program.wake();
    return true;
  }

  /** Ein Ziehen beginnt: EINE Änderung (gemerkt und gezählt) — oder keine, wenn das Budget (`keep`) erschöpft ist. */
  gestureStart(): boolean {
    const w = this.world;
    this.editing = null;
    this.program.touchedByUser();
    w.remember();
    this.count(1);
    const bad = this.program.broken();
    if (bad !== null) {
      w.forget(false);
      this.count(-1);
      this.program.say(bad, 'miss');
      return false;
    }
    return true;
  }

  /** Ein Schritt des Ziehens — der Finger in der Welt. */
  dragThing(t: Thing, px: number, py: number): boolean {
    return this.within((w) => w.drag(t, px, py));
  }

  /** Eine Eigenschaft des gewählten Dings einstellen — dieselbe kurz hintereinander ist EINE Änderung (ein Schieber). */
  editProp(t: Thing, prop: string, value: number): boolean {
    const key = `${t.id}.${prop}`;
    const now = Date.now();
    if (this.editing !== null && this.editing.key === key && now - this.editing.at < COALESCE_MS) {
      this.editing.at = now;
      return this.within((w) => w.setProp(t, prop, value, 'edit'));
    }
    const done = this.mutate((w) => w.setProp(t, prop, value, 'edit'));
    this.editing = done ? { key, at: now } : null;
    return done;
  }

  /** Die Einstellung ist fertig (der Schieber losgelassen): die nächste ist eine neue Änderung. */
  endEdit(): void {
    this.editing = null;
  }

  /** Antippen eines Dings: was seine Art dann tut (Werte setzen, starten, weiter). */
  tapThing(t: Thing): boolean {
    const tap = t.kind.spec.tap;
    if (tap === null) return false;
    const done = t.kind.tap.length > 0 && this.mutate((w) => w.tap(t));
    this.program.press([], tap.do, tap.go);
    return done;
  }

  /** Ein neues Ding anhängen (oder ganz oben aufstellen) — es ist danach gewählt. */
  addThing(kind: string, parent: Thing | null): Thing | null {
    let made: Thing | null = null;
    this.mutate((w) => { made = w.add(kind, parent); return made !== null; });
    if (made !== null) this.world.select((made as Thing).id);
    return made;
  }

  removeThing(t: Thing): boolean {
    return this.mutate((w) => w.remove(t));
  }

  copyThing(t: Thing): Thing | null {
    let made: Thing | null = null;
    this.mutate((w) => { made = w.copy(t); return made !== null; });
    if (made !== null) this.world.select((made as Thing).id);
    return made;
  }

  select(id: string | null): void {
    this.world.select(id);
    this.editing = null;
  }

  /** Zurück und wieder vor — ohne Prüfung (der Stand war schon einmal erlaubt), `edits` mitgezählt. */
  undo(): boolean {
    this.editing = null;
    this.program.touchedByUser();
    if (!this.world.undo()) return false;
    this.count(-1);
    this.program.wake();
    this.program.settle();
    return true;
  }

  redo(): boolean {
    this.editing = null;
    this.program.touchedByUser();
    if (!this.world.redo()) return false;
    this.count(1);
    this.program.wake();
    this.program.settle();
    return true;
  }

  /** Die Welt wie am Anfang („Od nowa") — und die Simulation von vorn. */
  reset(): void {
    this.editing = null;
    this.world.reset();
    this.program.env.edits = 0;
    this.program.touch('edits');
    this.program.restart();
    /* Eine Aufgabe zum Vermuten beginnt wieder angehalten. */
    if (this.program.predict?.start === true) this.program.hold();
    else if (this.program.sim?.auto === true) this.program.act('run');
    this.program.settle();
  }

  /** 2026-10-18 — „Nowe zadanie": eine andere Aufgabe derselben Art (das Programm zieht sie) — wie „Od nowa", doch ohne Rückweg. */
  newTask(): boolean {
    this.editing = null;
    return this.program.newTask();
  }

  /** Den Bau aus einem Gespeicherten — ohne Prüfung (die Werkstatt), als eine Änderung. */
  load(shot: WorldShot): void {
    this.editing = null;
    this.program.touchedByUser();
    this.world.remember();
    this.world.restore(shot);
    this.world.initAllState();
    this.program.wake();
    if (this.program.sim?.auto === true && this.program.status === 'ready') this.program.act('run');
    this.program.settle();
  }
}
