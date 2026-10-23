/**
 * LABOR 2D (v2) — DIE KÖRPER DER SZENE (M3a; seit 2026-10-23 aus Rechtecken):
 * jedes Ding ist ein Ganzes (body.ts) — angeheftet (bewegt sich nie,
 * unendlich schwer) oder frei. Ein freier Körper beginnt schlafend: er bewegt
 * sich nicht und kostet nur seine Wärme, bis ihn etwas weckt — ein Stoss eines
 * bewegten Körpers, ein Werkzeug, die Flüssigkeit, die ihn stärker hebt, als
 * er wiegt, oder fehlender Halt am Anfang. Wach durchläuft er jeden Schritt:
 *
 *  1. (Anfang des Schritts, prepare) seine Rechtecke an der neuen Lage ins
 *     Gitter: Anteile der Zellen und Flächen, Körperteile, bewegte Flächen;
 *     Teilchen und Blasen hinaus (bodyCover.ts).
 *  2. Flüssigkeit, Gas, Blasen, Grenzfläche, Wärme sehen ihn mit Anteilen.
 *  3. (Ende des Schritts, finish) die Änderungen der Körperteile an die
 *     inneren Zellen (jeder Körper, auch angeheftete); der Druck beider
 *     Projektionen über seine Seiten (bodyForces.ts), Schwerkraft, die
 *     mitbewegte Masse; die Berührungen (bodyContacts.ts); dann die neue Lage.
 *     Ruht er eine halbe Sekunde auf etwas, schläft er ein.
 *
 * Partitionierte Kopplung: die Projektionen sehen die Geschwindigkeit V^n,
 * ihr Druck gibt die Kraft F^n. Darin steckt −M_a (V^n − V^{n−1})/Δt — die
 * Flüssigkeit, die der Körper eben anders bewegt. Der Körper rechnet darum mit
 * der gemessenen mitbewegten Masse M_a (probe):
 *   (M + M_a)(V_frei − V^n) = Δt (m g + F^n) + M_a D^{n−1},
 * D = V_frei − V der Zuwachs aus Flüssigkeit und Schwerkraft im letzten
 * Schritt — so ist auch Holz in Wasser stabil, und im Gleichgewicht gilt genau
 * F = −m g. Die Stösse der Berührungen (mit der eigenen Masse) zählen nicht zu
 * D: was die Flüssigkeit tut, wenn ein Körper aufschlägt, kommt im nächsten
 * Schritt als Kraft.
 */

import { Body2D, meltsAt, type RectWorld } from './body';
import { BodyContacts } from './bodyContacts';
import { BodyCover, type CoverWorld } from './bodyCover';
import { BodyForces, type ForceWorld } from './bodyForces';
import type { BubbleModel } from './bubbleModel';
import type { Flows } from './budget';
import type { EditLedger } from './edits';
import type { Liquid } from './liquid';
import type { Regions } from './regions';
import type { GridSolver } from './solver';
import { LIQUID, SOLID } from './units';

/** Erlaubtes Eindringen und spekulativer Spalt der Berührungen (in Zellkanten). */
const SLOP = 0.1;
const SPEC = 1;
/** Ein Körper schläft ein, wenn kein Punkt schneller als das ist (m/s) — eine halbe Sekunde lang und auf etwas stehend. */
const SLEEP_SPEED = 0.002;
const SLEEP_TIME = 0.5;
/** Ein schlafender Körper wacht auf, wenn die Flüssigkeit ihn um mehr als das Gewicht hebt (Faktor). */
const BUOYANT = 1.02;
/** Höchstens so weit (in Zellkanten) bewegt sich ein Punkt eines Körpers in einem Schritt. */
const CFL = 0.5;

export interface BodiesWorld extends CoverWorld, ForceWorld {
  readonly bubbleModel: BubbleModel;
  readonly flows: Flows;
  readonly ledger: EditLedger;
  readonly regions: Regions;
  readonly liquid: Liquid;
}

export class Bodies {
  readonly list: Body2D[] = [];
  readonly cover: BodyCover;
  readonly forces: BodyForces;
  readonly contacts: BodyContacts;
  /** Zähler der Änderungen an Körpern und Bau — die Teile der Berührungen werden dann neu gebaut. */
  version = 0;
  /** Zuwachs der Geschwindigkeit aus Flüssigkeit und Schwerkraft im letzten Schritt, je Körper (vx, vy, ω) — für die mitbewegte Masse. */
  prev = new Float64Array(0);
  /** Wie viele Körper in diesem Schritt wach sind (zu Beginn gezählt). */
  awakeNow = 0;
  /** Hat ein Körper seine Form geändert (neu, gedreht, beschnitten)? Dann werden die Kavitäten neu ausgelegt. */
  shapes = false;
  /** Schmolz oder wuchs ein Körper, ohne dass sich seine Seiten anders gliedern? Dann wandern nur die Kavitäten aller Körper mit (auch angehefteter). */
  private resized = false;
  /** Nach dem Abgleich der Körperteile, vor den Kräften (die Engine setzt hier das Schmelzen ein, bodyMelt.ts). */
  afterCollect: (() => void) | null = null;

  constructor(private readonly e: BodiesWorld) {
    this.cover = new BodyCover(e);
    this.forces = new BodyForces(() => e);
    this.contacts = new BodyContacts(() => e.grid);
  }

  get anyFree(): boolean { return this.list.some((b) => b.free); }
  get anyAwake(): boolean { return this.list.some((b) => b.awake); }
  get any(): boolean { return this.list.some((b) => !b.gone); }

  /** Die Teile der Berührungen neu (nach einer Änderung des Baus oder der Körper). */
  changed(): void {
    this.version += 1;
    this.shapes = true;
    this.contacts.invalidate();
  }

  /**
   * Ein Körper änderte beim Schmelzen oder Anfrieren seine Rechtecke
   * (bodyMelt.ts): die Teile der Berührungen an Ort und Stelle, er wacht auf
   * (er sinkt oder steigt, wenn er leichter wird); die Kavitäten werden nur neu
   * ausgelegt, wenn sich seine freien Seiten anders gliedern (sonst lösten sich
   * bei jedem Schritt alle hängenden Blasen der Szene).
   */
  reshaped(b: Body2D, topology: boolean): void {
    if (topology) this.changed();
    else { this.contacts.reshape(b); this.resized = true; }
    this.wake(b);
  }

  /* -- Entstehen ---------------------------------------------------------------------------------- */

  /** Ein Körper aus Rechtecken der Welt (ungedreht), Werkstoff, Temperatur (K); `key`: der Handgriff (Index in den Schritten der Szene). */
  adopt(rects: readonly RectWorld[], mat: number, T: number, key: number, pinned: boolean, heater = -1): Body2D | null {
    const g = this.e.grid;
    const b = Body2D.fromRects(this.list.length, key, g.dx, g.depth, mat, rects, T, heater);
    if (b.gone) return null;
    b.pinned = pinned;
    b.asleep = true;
    this.list.push(b);
    this.grow();
    this.cover.weigh(b);
    this.cover.addCells(b);
    this.changed();
    return b;
  }

  /** Einen eben entstandenen Körper um (px, py) drehen (θ, rad): neu ins Gitter. */
  turn(b: Body2D, px: number, py: number, theta: number): void {
    if (theta === 0) return;
    this.cover.addCells(b);
    b.rotateAbout(px, py, theta);
    b.rx = b.x;
    b.ry = b.y;
    b.ra = b.a;
    this.cover.weigh(b);
    this.cover.addCells(b);
    this.changed();
  }

  /**
   * Ausstehende Zellen neu bauen (nach Handgriffen, beim Aufbau, nach einer
   * Bewegung): Körperteile, fest oder frei, Flächen; dann φ_s, Abstandsfeld,
   * Gebiete und Kavitäten, wo sich etwas änderte. Liefert, ob Zellen fest ↔
   * frei wechselten.
   */
  sync(): number {
    const e = this.e;
    const g = e.grid;
    if (!this.cover.pending) return 0;
    const box = this.cover.pendingBox();
    const flips = this.cover.rebuild(this.list);
    g.updateStatic(box[0] - 5, box[1] - 5, box[2] + 5, box[3] + 5);
    if (flips > 0 || this.cover.topologyChanged) {
      e.regions.label();
      for (let k = 0; k < e.regions.count; k += 1) if (e.regions.open[k] !== 0) e.regions.p0[k] = e.pRef;
      this.cover.topologyChanged = false;
    }
    /* Kavitäten: neu ausgelegt, wenn Zellen fest oder frei wurden oder ein Körper seine Form änderte; sonst wandern die der wachen Körper mit. */
    if (flips > 0 || this.shapes) { e.bubbleModel.rebuildSites(); this.shapes = false; }
    else e.bubbleModel.refreshBodySites(!this.resized);
    this.resized = false;
    e.liquid.weightsDirty = true;
    return flips;
  }

  /** Nach einer Änderung des festen Baus (er nimmt keinen Körper auf): alle Körper neu gewichtet, alle Zellen neu. */
  reweigh(): void {
    if (!this.any) return;
    for (const b of this.list) if (!b.gone) this.cover.weigh(b);
    this.cover.addAll();
    this.sync();
  }

  /* -- Der Schritt -------------------------------------------------------------------------------- */

  /** Anfang des Schritts: die wachen Körper an ihrer neuen Lage ins Gitter, Teilchen hinaus. Liefert, ob sich etwas bewegte. */
  prepare(): boolean {
    let moved = false;
    this.awakeNow = 0;
    for (const b of this.list) {
      if (!b.awake) continue;
      this.awakeNow += 1;
      moved = true;
      /* Die Zellen der alten Lage und der neuen. */
      this.cover.addCells(b);
      this.cover.weigh(b);
      this.cover.addCells(b);
    }
    if (!moved && !this.cover.pending) return false;
    this.sync();
    for (const b of this.list) {
      if (!b.awake) continue;
      this.cover.pushOut(b, b.rx, b.ry, b.ra);
      b.rx = b.x;
      b.ry = b.y;
      b.ra = b.a;
      b.ux = b.vx;
      b.uy = b.vy;
      b.uw = b.w;
    }
    return true;
  }

  /** Ende des Schritts: Körperteile an die inneren Zellen; Kräfte, Berührungen, neue Lagen, Schlaf. */
  finish(dt: number): void {
    this.cover.collect(this.list);
    if (this.afterCollect !== null) this.afterCollect();
    if (!this.anyFree) return;
    const e = this.e;
    const g = e.grid;
    this.forces.extend();
    /* Hebt die Flüssigkeit einen schlafenden Körper stärker, als er wiegt? Dann wacht er auf (ein Holzklotz am Grund). */
    for (const b of this.list) {
      if (!b.free || !b.asleep) continue;
      const F = this.forces.force(b);
      if (F[1] > BUOYANT * b.m * e.gy) this.wake(b);
    }
    const prev = this.prev;
    for (const b of this.list) {
      if (!b.awake) continue;
      const F = this.forces.force(b);
      const o = 3 * b.index;
      /* Mitbewegte Masse: wie die Projektion sie eben sah; frisch aufgewacht (noch nicht gemessen) die Schätzung. */
      const m6 = b.ma6;
      if (!b.maOk) {
        this.forces.addedMass(b);
        m6.fill(0);
        m6[0] = b.ma;
        m6[3] = b.ma;
        m6[5] = b.Ia;
      }
      const r0 = dt * F[0] + m6[0] * prev[o] + m6[1] * prev[o + 1] + m6[2] * prev[o + 2];
      const r1 = dt * (F[1] - b.m * e.gy) + m6[1] * prev[o] + m6[3] * prev[o + 1] + m6[4] * prev[o + 2];
      const r2 = dt * F[2] + m6[2] * prev[o] + m6[4] * prev[o + 1] + m6[5] * prev[o + 2];
      solve3(b.m + m6[0], m6[1], m6[2], b.m + m6[3], m6[4], b.I + m6[5], r0, r1, r2, this.dv);
      b.vx += this.dv[0];
      b.vy += this.dv[1];
      b.w += this.dv[2];
      prev[o] = this.dv[0];
      prev[o + 1] = this.dv[1];
      prev[o + 2] = this.dv[2];
    }
    this.contacts.step(dt, this.list, this.version, SLOP * g.dx, SPEC * g.dx);
    for (const k of this.contacts.toWake) this.wake(this.list[k]);
    for (const b of this.list) {
      if (!b.awake) continue;
      b.x += dt * b.vx;
      b.y += dt * b.vy;
      b.a += dt * b.w;
      if (b.x < 0 || b.y < 0 || b.x > g.w || b.y > g.h) { this.escape(b); continue; }
      b.rest = b.speed() < SLEEP_SPEED && this.contacts.touches(b) ? b.rest + dt : 0;
      if (b.rest >= SLEEP_TIME) this.sleep(b);
    }
  }

  /** Für den Weg der Teilchen (liquidMove.ts): geriet (x, y) auf dem Weg von (x0, y0) in einen Körper, zurück vor die Seite (1; out: Ort, Normale, Geschwindigkeit des Körpers dort), sonst 0. */
  hitPoint(x0: number, y0: number, x: number, y: number, out: Float64Array): number {
    return this.cover.hit(this.list, x0, y0, x, y, out);
  }

  private readonly dv = new Float64Array(3);
  private readonly probeS: number[] = [];
  private readonly probeJ: number[] = [];

  /**
   * Die mitbewegte Masse jedes wachen Körpers, wie die Projektion sie sieht:
   * eine Geschwindigkeit e_k des Körpers (x, y, Drehung) ändert die Divergenz
   * der Flüssigkeitszellen über den bedeckten Teil (1 − α) ihrer Flächen um
   * j_k; die Antwort des Drucks ist p_k = A⁻¹(−Δx j_k) mit der Matrix A der eben
   * gelösten Projektion (drei weitere Lösungen), und M_a = Δt Δx² D Jᵀ A⁻¹ J.
   */
  probe(S: GridSolver, i0: number, j0: number, dt: number): void {
    const g = this.e.grid;
    const { nx, ny, dx, depth } = g;
    const fown = this.cover.faceOwner;
    for (const b of this.list) {
      if (!b.awake) continue;
      const id = b.index + 1;
      const ss = this.probeS;
      const jj = this.probeJ;
      ss.length = 0;
      jj.length = 0;
      const box = this.cover.boxOf(b);
      const fi0 = Math.max(0, Math.floor(box[0] / dx) - 1);
      const fi1 = Math.min(nx, Math.floor(box[2] / dx) + 2);
      const fj0 = Math.max(0, Math.floor(box[1] / dx) - 1);
      const fj1 = Math.min(ny, Math.floor(box[3] / dx) + 2);
      /* u-Flächen: Zelle links (i − 1) und rechts (i); für die Flüssigkeitszelle links ist die Fläche ihre rechte (+), für die rechte ihre linke (−). */
      for (let j = fj0; j < Math.min(ny, fj1); j += 1) {
        for (let i = fi0; i <= fi1; i += 1) {
          const f = i + j * (nx + 1);
          if (fown[f] !== id) continue;
          const yf = (j + 0.5) * dx;
          const L = i > 0 ? i - 1 + j * nx : -1;
          const R = i < nx ? i + j * nx : -1;
          const solidSide = (L >= 0 && g.kind[L] === SOLID) || (R >= 0 && g.kind[R] === SOLID);
          const cov = solidSide ? 1 : 1 - g.au[f];
          if (cov <= 0) continue;
          if (L >= 0 && g.kind[L] === LIQUID) { ss.push(S.at(i - 1 - i0, j - j0)); jj.push(cov, 0, -cov * (yf - b.y)); }
          if (R >= 0 && g.kind[R] === LIQUID) { ss.push(S.at(i - i0, j - j0)); jj.push(-cov, 0, cov * (yf - b.y)); }
        }
      }
      for (let j = fj0; j <= fj1; j += 1) {
        for (let i = fi0; i < Math.min(nx, fi1); i += 1) {
          const f = i + j * nx;
          if (fown[g.nu + f] !== id) continue;
          const xf = (i + 0.5) * dx;
          const B = j > 0 ? i + (j - 1) * nx : -1;
          const T = j < ny ? i + j * nx : -1;
          const solidSide = (B >= 0 && g.kind[B] === SOLID) || (T >= 0 && g.kind[T] === SOLID);
          const cov = solidSide ? 1 : 1 - g.av[f];
          if (cov <= 0) continue;
          if (B >= 0 && g.kind[B] === LIQUID) { ss.push(S.at(i - i0, j - 1 - j0)); jj.push(0, cov, cov * (xf - b.x)); }
          if (T >= 0 && g.kind[T] === LIQUID) { ss.push(S.at(i - i0, j - j0)); jj.push(0, -cov, -cov * (xf - b.x)); }
        }
      }
      if (ss.length === 0) { b.ma6.fill(0); b.maOk = true; continue; }
      const sys = S.system;
      const m = this.m9;
      for (let k = 0; k < 3; k += 1) {
        sys.b.fill(0);
        sys.x.fill(0);
        for (let r = 0; r < ss.length; r += 1) sys.b[ss[r]] -= dx * jj[3 * r + k];
        S.solve(1e-4, 40, true);
        for (let l = 0; l < 3; l += 1) {
          let s = 0;
          for (let r = 0; r < ss.length; r += 1) s += sys.x[ss[r]] * jj[3 * r + l];
          m[3 * l + k] = -dt * dx * depth * s;
        }
      }
      const m6 = b.ma6;
      m6[0] = m[0];
      m6[1] = 0.5 * (m[1] + m[3]);
      m6[2] = 0.5 * (m[2] + m[6]);
      m6[3] = m[4];
      m6[4] = 0.5 * (m[5] + m[7]);
      m6[5] = m[8];
      b.maOk = true;
    }
  }

  private readonly m9 = new Float64Array(9);

  /** Der längste Schritt, in dem kein Punkt eines wachen Körpers mehr als eine halbe Zelle zurücklegt (s). */
  dtLimit(): number {
    let dt = Infinity;
    for (const b of this.list) {
      if (!b.awake) continue;
      const v = b.speed();
      if (v > 0) dt = Math.min(dt, (CFL * b.dx) / v);
    }
    return dt;
  }

  /** Aufwecken: ab dem nächsten Schritt bewegt er sich. */
  wake(b: Body2D): void {
    if (!b.free || !b.asleep) return;
    b.asleep = false;
    b.rest = 0;
    b.maOk = false;
    const o = 3 * b.index;
    this.prev[o] = 0;
    this.prev[o + 1] = 0;
    this.prev[o + 2] = 0;
  }

  /** Einschlafen: stillstehen; seine Flächen stehen still (die Zellen bleiben, wie sie sind). */
  private sleep(b: Body2D): void {
    b.asleep = true;
    b.rest = 0;
    b.vx = 0;
    b.vy = 0;
    b.w = 0;
    b.ux = 0;
    b.uy = 0;
    b.uw = 0;
    this.cover.addCells(b);
    this.cover.weigh(b);
    this.cover.addCells(b);
  }

  /** Ein Körper hat die Kiste durch eine offene Seite verlassen: mit Energie, Film und Kruste gebucht wie Entwichenes. */
  private escape(b: Body2D): void {
    const f = this.e.flows;
    f.escapedEnergy += b.energy();
    /* Eis ist Wasser. */
    f.escapedWater += b.filmMass() + (meltsAt(b.mat) > 0 ? b.m : 0);
    f.escapedSalt += b.crustMass();
    this.cover.release(b);
    b.gone = true;
    b.ncell = 0;
    this.changed();
    this.sync();
  }

  /** Alle freien Körper wecken (nach einem Werkzeug: vielleicht fehlt ihnen jetzt der Halt). */
  wakeFree(): void {
    for (const b of this.list) this.wake(b);
  }

  /** Nach dem Aufbau wachen die freien Körper kurz auf: wer fest steht, schläft nach einer halben Sekunde wieder ein; wer keinen Halt hat, fällt. */
  settleStart(): void {
    for (const b of this.list) if (b.free) this.wake(b);
  }

  /* -- Werkzeuge ---------------------------------------------------------------------------------- */

  /** Der Körper unter einem Punkt der Welt — genau getroffen, sonst bis `slop` daneben (Standard: eine Zelle — ein Finger trifft eine dünne Wand nicht genau); null: keiner. */
  bodyAt(x: number, y: number, slop = this.e.grid.dx): Body2D | null {
    const l = this.at;
    for (let pass = 0; pass < (slop > 0 ? 2 : 1); pass += 1) {
      const m = pass === 0 ? 0 : slop;
      for (let k = this.list.length - 1; k >= 0; k -= 1) {
        const b = this.list[k];
        if (b.gone) continue;
        Body2D.toLocal(b.x, b.y, b.a, x, y, l);
        if (b.insideLocal(l[0], l[1], m)) return b;
      }
    }
    return null;
  }

  private readonly at = new Float64Array(2);

  /** Anheften oder lösen (Werkzeug „Przypnij“): ein gelöster Körper wacht auf, ein angehefteter steht sofort still. */
  pin(b: Body2D, pinned: boolean): void {
    if (b.pinned === pinned) return;
    if (pinned) {
      if (b.awake) this.sleep(b);
      b.pinned = true;
    } else {
      b.pinned = false;
      b.asleep = true;
      this.wake(b);
    }
  }

  /** Feld je Körper auf die Zahl der Körper bringen. */
  grow(): void {
    if (this.prev.length < 3 * this.list.length) {
      const p = new Float64Array(3 * this.list.length + 24);
      p.set(this.prev);
      this.prev = p;
    }
  }
}

/** Ein symmetrisches 3 × 3-System (a00, a01, a02, a11, a12, a22) · x = (r0, r1, r2) nach x (Cramer; die Matrix ist positiv definit). */
function solve3(a00: number, a01: number, a02: number, a11: number, a12: number, a22: number, r0: number, r1: number, r2: number, out: Float64Array): void {
  const c00 = a11 * a22 - a12 * a12;
  const c01 = a02 * a12 - a01 * a22;
  const c02 = a01 * a12 - a02 * a11;
  const det = a00 * c00 + a01 * c01 + a02 * c02;
  const c11 = a00 * a22 - a02 * a02;
  const c12 = a01 * a02 - a00 * a12;
  const c22 = a00 * a11 - a01 * a01;
  out[0] = (c00 * r0 + c01 * r1 + c02 * r2) / det;
  out[1] = (c01 * r0 + c11 * r1 + c12 * r2) / det;
  out[2] = (c02 * r0 + c12 * r1 + c22 * r2) / det;
}
