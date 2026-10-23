/**
 * LABOR 2D (v2) — DIE KÖRPER DER SZENE (M3a, SANDBOX.md §6): jedes Ding ist
 * ein Ganzes (body.ts) — angeheftet (bewegt sich nie, unendlich schwer) oder
 * frei. Ein freier Körper beginnt schlafend: er steht als feste Zellen im
 * Gitter und kostet nichts, bis ihn etwas weckt — ein Stoss eines bewegten
 * Körpers, ein Werkzeug, die Flüssigkeit, die ihn stärker hebt, als er wiegt,
 * oder fehlender Halt am Anfang. Wach durchläuft er jeden Schritt:
 *
 *  1. (Anfang des Schritts, prepare) ins Gitter an seiner Lage: Zellen,
 *     Energien, bewegte Wände; Teilchen und Blasen hinaus (bodyRaster.ts);
 *     φ_s, Abstandsfeld, Gebiete und Kavitäten neu, wo sich etwas änderte.
 *  2. Flüssigkeit, Gas, Blasen, Grenzfläche, Wärme sehen ihn als bewegte Wand.
 *  3. (Ende des Schritts, finish) die Änderungen seiner Zellen an die Voxel;
 *     der Druck beider Projektionen über seinen Umriss (bodyForces.ts),
 *     Schwerkraft, die mitbewegte Masse; die Berührungen (bodyContacts.ts);
 *     dann die neue Lage. Ruht er eine halbe Sekunde auf etwas, schläft er ein.
 *
 * Partitionierte Kopplung: die Projektionen sehen die Geschwindigkeit V^n,
 * ihr Druck gibt die Kraft F^n. Darin steckt −M_a (V^n − V^{n−1})/Δt — die
 * Flüssigkeit, die der Körper eben anders bewegt. Der Körper rechnet darum mit
 * der geschätzten mitbewegten Masse M̃_a:
 *   (M + M̃_a)(V_frei − V^n) = Δt (m g + F^n) + M̃_a D^{n−1},
 * D = V_frei − V der Zuwachs aus Flüssigkeit und Schwerkraft im letzten
 * Schritt — so ist auch Holz in Wasser stabil (die mitbewegte Masse ist
 * grösser als die eigene), und im Gleichgewicht gilt genau F = −m g. Die Stösse
 * der Berührungen (mit der eigenen Masse) zählen nicht zu D: was die
 * Flüssigkeit tut, wenn ein Körper aufschlägt (das Wasser einer Zlewka schlägt
 * nach), kommt im nächsten Schritt als Kraft und drückt ihn auf den Boden —
 * mit D aus dem ganzen Geschwindigkeitssprung gäbe eine zu grosse Schätzung
 * M̃_a ihm statt dessen einen Stoss zurück in die Luft.
 */

import { Body2D, SHAPE_DISC, SHAPE_VOXELS } from './body';
import { BodyContacts } from './bodyContacts';
import { BodyForces, type ForceWorld } from './bodyForces';
import { BodyRaster, type RasterWorld } from './bodyRaster';
import type { BubbleModel } from './bubbleModel';
import type { GridSolver } from './solver';
import { LIQUID } from './units';
import type { Flows } from './budget';
import type { EditLedger } from './edits';

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

export interface BodiesWorld extends RasterWorld, ForceWorld {
  readonly bubbleModel: BubbleModel;
  readonly flows: Flows;
  readonly ledger: EditLedger;
}

export class Bodies {
  readonly list: Body2D[] = [];
  readonly raster: BodyRaster;
  readonly forces: BodyForces;
  readonly contacts: BodyContacts;
  /** Zähler der Änderungen an Körpern und Bau — die Teile der Berührungen werden dann neu gebaut. */
  version = 0;
  /** Zuwachs der Geschwindigkeit aus Flüssigkeit und Schwerkraft im letzten Schritt, je Körper (vx, vy, ω) — für die mitbewegte Masse. */
  prev = new Float64Array(0);
  /** Wie viele Körper in diesem Schritt wach sind (zu Beginn gezählt). */
  awakeNow = 0;
  private readonly hitOut = new Float64Array(4);

  constructor(private readonly e: BodiesWorld) {
    this.raster = new BodyRaster(e);
    this.forces = new BodyForces(() => e);
    this.contacts = new BodyContacts(() => e.grid);
  }

  get anyFree(): boolean { return this.list.some((b) => b.free); }
  get anyAwake(): boolean { return this.list.some((b) => b.awake); }

  /** Die Teile der Berührungen neu (nach einer Änderung des Baus oder der Körper). */
  changed(): void {
    this.version += 1;
    this.contacts.invalidate();
  }

  /* -- Entstehen ---------------------------------------------------------------------------------- */

  /**
   * Ein Körper aus Zellen, die ein Handgriff eben fest gemacht hat: ein Voxel
   * je Zelle, ungedreht, die Zellen gehören ihm (Gewichte 1 : 1). `key`: der
   * Handgriff (Index in den Schritten der Szene).
   */
  adopt(cells: readonly number[], key: number, pinned: boolean, disc = 0): Body2D | null {
    if (cells.length === 0) return null;
    const g = this.e.grid;
    const b = Body2D.fromCells(this.list.length, key, g, cells);
    if (disc > 0) { b.shape = SHAPE_DISC; b.radius = disc; b.derive(); }
    b.pinned = pinned;
    b.asleep = true;
    const n = cells.length;
    b.nc = n;
    b.cells = Int32Array.from(cells);
    b.E0 = new Float64Array(n);
    b.F0 = new Float64Array(n);
    b.K0 = new Float64Array(n);
    b.wv = new Int32Array(n);
    b.wc = new Int32Array(n);
    b.ww = new Float64Array(n);
    b.nw = n;
    for (let k = 0; k < n; k += 1) {
      const c = cells[k];
      b.E0[k] = g.Es[c];
      b.F0[k] = g.film[c];
      b.K0[k] = g.crust[c];
      b.wv[k] = k;
      b.wc[k] = k;
      b.ww[k] = 1;
      g.owner[c] = b.index + 1;
    }
    this.list.push(b);
    this.growPrev();
    this.changed();
    return b;
  }

  /** Einen eben entstandenen Körper um (px, py) drehen (θ, rad): neu ins Gitter, Teilchen hinaus. */
  turn(b: Body2D, px: number, py: number, theta: number): void {
    if (theta === 0) return;
    this.raster.collect(b);
    this.raster.release(b);
    const x0 = b.x;
    const y0 = b.y;
    const a0 = b.a;
    b.rotateAbout(px, py, theta);
    this.raster.rasterise(b);
    this.raster.pushOut(b, x0, y0, a0);
    this.changed();
  }

  /* -- Der Schritt -------------------------------------------------------------------------------- */

  /** Anfang des Schritts: die wachen Körper ins Gitter (liefert die Zahl der Zellen, die fest ↔ frei wechselten). */
  prepare(): number {
    const e = this.e;
    const g = e.grid;
    let flips = 0;
    let moved = false;
    let i0 = g.nx;
    let j0 = g.ny;
    let i1 = -1;
    let j1 = -1;
    this.awakeNow = 0;
    for (const b of this.list) {
      if (!b.awake) continue;
      moved = true;
      this.awakeNow += 1;
      const r = b.rmax + g.dx;
      for (const [x, y] of [[b.rx, b.ry], [b.x, b.y]]) {
        i0 = Math.min(i0, Math.floor((x - r) / g.dx));
        i1 = Math.max(i1, Math.floor((x + r) / g.dx));
        j0 = Math.min(j0, Math.floor((y - r) / g.dx));
        j1 = Math.max(j1, Math.floor((y + r) / g.dx));
      }
      const x0 = b.rx;
      const y0 = b.ry;
      const a0 = b.ra;
      flips += this.raster.rasterise(b);
      this.raster.pushOut(b, x0, y0, a0);
    }
    if (moved) e.liquid.weightsDirty = true;
    if (flips > 0) {
      /* Wie nach einem Werkzeug, aber nur, wo sich etwas bewegte (das Abstandsfeld sucht vier Zellen weit). */
      g.updateStatic(i0 - 5, j0 - 5, i1 + 5, j1 + 5);
      e.regions.label();
      for (let k = 0; k < e.regions.count; k += 1) if (e.regions.open[k] !== 0) e.regions.p0[k] = e.pRef;
      e.bubbleModel.rebuildSites();
    }
    return flips;
  }

  /** Ende des Schritts: Voxel, Kräfte, Berührungen, neue Lagen, Schlaf. */
  finish(dt: number): void {
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
      this.raster.collect(b);
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

  /**
   * Für den Weg der Teilchen (liquidMove.ts): liegt (x, y) nach dem Weg von
   * (x0, y0) in einem wachen Körper, zurück vor die Seite (1; out: Ort,
   * Normale, Geschwindigkeit des Körpers dort); 2: in einer seiner Zellen, aber
   * nicht in ihm; 0: kein wacher Körper hier.
   */
  hitPoint(x0: number, y0: number, x: number, y: number, out: Float64Array): number {
    if (this.awakeNow === 0) return 0;
    const g = this.e.grid;
    const h = this.hitOut;
    let near = 0;
    for (const b of this.list) {
      if (!b.awake) continue;
      const r = b.rmax + g.dx;
      if (Math.abs(x - b.x) > r || Math.abs(y - b.y) > r) continue;
      if (this.raster.collidePoint(b, x0, y0, x, y, h)) {
        out[0] = h[0];
        out[1] = h[1];
        out[2] = h[2];
        out[3] = h[3];
        out[4] = b.vx - b.w * (h[1] - b.y);
        out[5] = b.vy + b.w * (h[0] - b.x);
        return 1;
      }
      const c = g.cellAt(x, y);
      if (c >= 0 && g.owner[c] === b.index + 1) near = 2;
    }
    return near;
  }

  private readonly dv = new Float64Array(3);
  private readonly probeS: number[] = [];
  private readonly probeJ: number[] = [];

  /**
   * Die mitbewegte Masse jedes wachen Körpers, wie die Projektion sie sieht:
   * eine Geschwindigkeit e_k des Körpers (x, y, Drehung) ändert die Divergenz
   * der Flüssigkeitszellen an seinen Flächen um j_k; die Antwort des Drucks ist
   * p_k = A⁻¹(−Δx j_k) mit der Matrix A der eben gelösten Projektion (drei
   * weitere Lösungen), und M_a = Δt Δx² D Jᵀ A⁻¹ J. Mit dieser Masse hebt der
   * Rückgabeterm der Kopplung genau auf, was die Flüssigkeit im nächsten Schritt
   * zurückstösst — eine zu kleine Schätzung liesse einen schwimmenden Klotz
   * explodieren, eine zu grosse schaukelte ihn auf.
   */
  probe(S: GridSolver, i0: number, j0: number, dt: number): void {
    const g = this.e.grid;
    const { nx, dx, depth } = g;
    for (const b of this.list) {
      if (!b.awake) continue;
      const id = b.index + 1;
      /* Die Flächen zwischen einer Zelle des Körpers und einer Flüssigkeitszelle: Index im Löser, j (x, y, Drehung) aus Sicht der Flüssigkeitszelle. */
      const ss = this.probeS;
      const jj = this.probeJ;
      ss.length = 0;
      jj.length = 0;
      for (let q = 0; q < b.nc; q += 1) {
        const c = b.cells[q];
        if (g.owner[c] !== id) continue;
        const i = c % nx;
        const j = (c - i) / nx;
        for (let d = 0; d < 4; d += 1) {
          const ii = i + (d === 0 ? -1 : d === 1 ? 1 : 0);
          const jy = j + (d === 2 ? -1 : d === 3 ? 1 : 0);
          if (ii < 0 || jy < 0 || ii >= nx || jy >= g.ny) continue;
          const nb = ii + jy * nx;
          if (g.kind[nb] !== LIQUID) continue;
          const xf = (i + 0.5 + (d === 0 ? -0.5 : d === 1 ? 0.5 : 0)) * dx;
          const yf = (j + 0.5 + (d === 2 ? -0.5 : d === 3 ? 0.5 : 0)) * dx;
          ss.push(S.at(ii - i0, jy - j0));
          /* Aus Sicht von nb: Körper rechts (d = 0) j = (1, 0, −(y_f − y)), links (−1, 0, y_f − y), oben (0, 1, x_f − x), unten (0, −1, −(x_f − x)). */
          if (d === 0) jj.push(1, 0, -(yf - b.y));
          else if (d === 1) jj.push(-1, 0, yf - b.y);
          else if (d === 2) jj.push(0, 1, xf - b.x);
          else jj.push(0, -1, -(xf - b.x));
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

  /** Aufwecken: was seine Zellen seit dem Einschlafen bekamen, an die Voxel; ab dem nächsten Schritt bewegt er sich. */
  wake(b: Body2D): void {
    if (!b.free || !b.asleep) return;
    this.raster.collect(b);
    b.asleep = false;
    b.rest = 0;
    b.maOk = false;
    const o = 3 * b.index;
    this.prev[o] = 0;
    this.prev[o + 1] = 0;
    this.prev[o + 2] = 0;
  }

  /** Einschlafen: stillstehen; die Zellen bleiben, wo er zuletzt geschrieben wurde, und sind nun sein Zustand. */
  private sleep(b: Body2D): void {
    b.asleep = true;
    b.rest = 0;
    b.vx = 0;
    b.vy = 0;
    b.w = 0;
    b.ux = 0;
    b.uy = 0;
    b.uw = 0;
    this.raster.stopFaces(b);
  }

  /** Ein Körper hat die Kiste durch eine offene Seite verlassen: mit Energie, Film und Kruste gebucht wie Entwichenes. */
  private escape(b: Body2D): void {
    const f = this.e.flows;
    this.raster.collect(b);
    for (let k = 0; k < b.nv; k += 1) {
      f.escapedEnergy += b.E[k];
      f.escapedWater += b.film[k];
      f.escapedSalt += b.crust[k];
    }
    this.raster.release(b);
    b.keepVoxels(() => false);
    b.gone = true;
    this.changed();
    /* Seine Zellen sind frei: feste Daten, Gebiete und Kavitäten neu (wie nach einem Werkzeug). */
    const e = this.e;
    e.grid.updateStatic();
    e.regions.label();
    for (let k = 0; k < e.regions.count; k += 1) if (e.regions.open[k] !== 0) e.regions.p0[k] = e.pRef;
    e.bubbleModel.rebuildSites();
    e.liquid.weightsDirty = true;
  }

  /** Alle freien Körper wecken (nach einem Werkzeug: vielleicht fehlt ihnen jetzt der Halt). */
  wakeFree(): void {
    for (const b of this.list) this.wake(b);
  }

  /**
   * Nach dem Aufbau wachen die freien Körper kurz auf: wer fest steht, schläft
   * nach einer halben Sekunde wieder ein; wer keinen Halt hat oder über eine
   * Kante ragt, fällt (angeheftete Körper — Zlewki und Platten der meisten
   * Aufbauten — kosten nichts).
   */
  settleStart(): void {
    for (const b of this.list) if (b.free) this.wake(b);
  }

  /* -- Werkzeuge ---------------------------------------------------------------------------------- */

  /** Der Körper unter einem Punkt der Welt — genau getroffen, sonst bis eine Zelle daneben (ein Finger trifft eine dünne Wand nicht genau); null: keiner. */
  bodyAt(x: number, y: number): Body2D | null {
    const l = new Float64Array(2);
    const d = this.e.grid.dx;
    for (const r of [0, 1]) {
      for (let k = this.list.length - 1; k >= 0; k -= 1) {
        const b = this.list[k];
        if (b.gone) continue;
        for (let oy = -r; oy <= r; oy += 1) {
          for (let ox = -r; ox <= r; ox += 1) {
            if (r === 1 && ox === 0 && oy === 0) continue;
            Body2D.toLocal(b.x, b.y, b.a, x + ox * d, y + oy * d, l);
            if (b.voxelAtLocal(l[0], l[1]) >= 0) return b;
          }
        }
      }
    }
    return null;
  }

  /** Anheften oder lösen (Werkzeug „Przypnij“): ein gelöster Körper wacht auf, ein angehefteter steht sofort still. */
  pin(b: Body2D, pinned: boolean): void {
    if (b.pinned === pinned) return;
    if (pinned) {
      if (b.awake) { this.raster.collect(b); this.sleep(b); }
      b.pinned = true;
    } else {
      b.pinned = false;
      b.asleep = true;
      this.wake(b);
    }
  }

  /**
   * Die Voxel in einer Fläche entfernen (Radieren, ein neuer Bau darüber):
   * gebucht wie ein Eingriff; was übrig bleibt und nicht mehr zusammenhängt,
   * wird zu eigenen Körpern. Die Zellen der Fläche bleiben danach frei.
   */
  carve(inside: (x: number, y: number) => boolean): void {
    const e = this.e;
    const g = e.grid;
    const wp = new Float64Array(2);
    const avoid = (c: number): boolean => inside((c % g.nx + 0.5) * g.dx, (Math.floor(c / g.nx) + 0.5) * g.dx);
    const count = this.list.length;
    for (let q = 0; q < count; q += 1) {
      const b = this.list[q];
      if (b.gone) continue;
      const cut = new Uint8Array(b.nv);
      let any = false;
      for (let k = 0; k < b.nv; k += 1) {
        Body2D.toWorld(b.x, b.y, b.a, (b.vi[k] + 0.5) * b.dx - b.cx, (b.vj[k] + 0.5) * b.dx - b.cy, wp);
        if (inside(wp[0], wp[1])) { cut[k] = 1; any = true; }
      }
      let ownsInside = false;
      for (let k = 0; k < b.nc; k += 1) if (g.owner[b.cells[k]] === b.index + 1 && avoid(b.cells[k])) ownsInside = true;
      if (!any && !ownsInside) continue;
      this.raster.collect(b);
      this.raster.release(b);
      for (let k = 0; k < b.nv; k += 1) {
        if (cut[k] === 0) continue;
        e.ledger.energy -= b.E[k];
        e.ledger.water -= b.film[k];
        e.ledger.salt -= b.crust[k];
      }
      b.keepVoxels((k) => cut[k] === 0);
      if (b.gone) continue;
      /* Zerfällt der Rest, werden die weiteren Stücke eigene Körper mit derselben Lage und Bewegung. */
      const comp = new Int32Array(b.nv);
      const pieces = b.components(comp);
      for (let p = 1; p < pieces; p += 1) {
        const piece = new Body2D(this.list.length, b.key, b.dx, b.depth);
        const idx: number[] = [];
        for (let k = 0; k < b.nv; k += 1) if (comp[k] === p) idx.push(k);
        piece.setVoxels(idx.length,
          Int32Array.from(idx, (k) => b.vi[k]), Int32Array.from(idx, (k) => b.vj[k]), Uint8Array.from(idx, (k) => b.mat[k]),
          Float64Array.from(idx, (k) => b.E[k]), Int16Array.from(idx, (k) => b.heater[k]),
          Float64Array.from(idx, (k) => b.film[k]), Float64Array.from(idx, (k) => b.crust[k]));
        /* Der eigene Rahmen ist derselbe: dieselbe Abbildung Rahmen → Welt, nur um den eigenen Schwerpunkt. */
        const c = Math.cos(b.a);
        const s = Math.sin(b.a);
        piece.a = b.a;
        piece.x = b.x + c * (piece.cx - b.cx) - s * (piece.cy - b.cy);
        piece.y = b.y + s * (piece.cx - b.cx) + c * (piece.cy - b.cy);
        piece.pinned = b.pinned;
        piece.asleep = b.asleep;
        piece.vx = b.vx;
        piece.vy = b.vy;
        piece.w = b.w;
        this.list.push(piece);
        this.growPrev();
        this.raster.rasterise(piece, avoid);
      }
      if (pieces > 1) b.keepVoxels((k) => comp[k] === 0);
      this.raster.rasterise(b, avoid);
    }
    this.changed();
  }

  /**
   * Werkzeug „Przesuń“, erster Teil: jeder Körper, der eine Zelle in der
   * Fläche hat, wird als Ganzes aus dem Gitter gehoben (liefert sie).
   */
  lift(inCell: (c: number) => boolean): Body2D[] {
    const g = this.e.grid;
    const out: Body2D[] = [];
    for (const b of this.list) {
      if (b.gone) continue;
      let hit = false;
      for (let k = 0; k < b.nc && !hit; k += 1) if (g.owner[b.cells[k]] === b.index + 1 && inCell(b.cells[k])) hit = true;
      if (!hit) continue;
      this.raster.collect(b);
      this.raster.release(b);
      out.push(b);
    }
    return out;
  }

  /** Zweiter Teil: um (di, dj) Zellen versetzt wieder hinein (die Teilchen hat der Aufrufer mit verschoben); was in seine Wände geriet, hinaus. */
  place(lifted: readonly Body2D[], di: number, dj: number): void {
    const g = this.e.grid;
    for (const b of lifted) {
      b.x += di * g.dx;
      b.y += dj * g.dx;
      this.raster.rasterise(b);
      this.raster.pushOut(b, b.x, b.y, b.a);
    }
    if (lifted.length > 0) this.changed();
  }

  private growPrev(): void {
    if (this.prev.length >= 3 * this.list.length) return;
    const p = new Float64Array(3 * this.list.length + 24);
    p.set(this.prev);
    this.prev = p;
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

export { SHAPE_DISC, SHAPE_VOXELS };
