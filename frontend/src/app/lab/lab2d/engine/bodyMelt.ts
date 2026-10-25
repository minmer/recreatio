/**
 * LABOR 2D (v2) — SCHMELZEN UND ANFRIEREN (M3b, seit 2026-10-23): ein
 * Eisblock bleibt ein Rechteck; er schmilzt oder wächst, indem eine ganze
 * Seite rückt (die Entscheidung des Projekts: kein Zerfall in Zellen).
 *
 * <b>Schmelzen.</b> Die Wärme kommt wie jede Wärme über das Gitter und den
 * Ausgleich in gemischten Zellen in die inneren Zellen des Körpers
 * (bodyCover.collect). Liegt eine innere Zelle über der Schmelztemperatur T_f,
 * wird der Überschuss zu Schmelzwärme der Seite, durch die die Wärme kommt:
 * eine Randzelle gibt ihn ihren anliegenden Seiten, vor denen etwas Wärmeres
 * liegt (Wasser, Luft oder ein warmer Feststoff — eine Heizplatte, die Wand
 * einer Zlewka), nach deren Zufuhr k (T − T_f) (meltSides.supplyAt); eine
 * Zelle ohne solche Seite und eine im Inneren der nächsten offenen Seite (vor
 * der Fluid liegt; ohne offene der nächsten freien). Eine oder mehrere Seiten
 * schmelzen so zugleich, jede als Ganzes; Eis wird nie wärmer als die
 * Grenzfläche, an der es schmilzt (eine Zelle im Inneren gibt ihre Wärme
 * sofort an die Seite — die Leitung dorthin ist dann unendlich schnell, das
 * Ende stimmt). Alle Überschüsse einer Seite zusammen schieben sie um
 *
 *   δ = Q / (ρ_Eis D Σ_k s_k [L(T_f) + c_p,Eis (T_f − T_k)])
 *
 * nach innen (s_k die freie Länge der Randzelle k längs der Seite; der Term
 * mit T_k wärmt eine kältere Scheibe zuerst auf T_f). L(T_f) = h_l(T_f) −
 * h_Eis(T_f) mit h_Eis = c_p,Eis (T − 0 °C) + e0 (body.ts, IAPWS R10-06). Das
 * Schmelzwasser bekommt die Energie der Scheibe, ihren Versatz e0 und Q — bei
 * gleichmässiger Scheibe genau h_l(T_f) je kg: Energie und Masse schliessen.
 *
 * <b>T_f</b> ist der Gefrierpunkt der Flüssigkeit vor der Seite (solution.ts:
 * Pitzer, unter 0 °C Spencer–Møller–Weare): reines Wasser 0,0025 °C, Sole
 * tiefer, bis zum Eutektikum; ohne Flüssigkeit davor der des reinen Wassers.
 *
 * <b>Anfrieren.</b> Ist das Wasser vor einer Seite kälter als sein T_f (Eis,
 * das kälter ist, kühlt es über die Grenzfläche), friert so viel davon an, bis
 * die frei werdende Wärme es auf T_f bringt: m = C_l (T_f − T_l)/L, gesammelt
 * je Seite, höchstens die Hälfte des Wassers eines Teilchens je Schritt; die
 * Seite rückt um m/(ρ_Eis ℓ D) nach aussen. Das Wasser verlässt die Teilchen
 * mit der Enthalpie des Eises (sie behalten die Schmelzwärme und werden
 * wärmer); ihr Salz bleibt im Wasser — gefrierende Sole wird salziger, genau.
 * Geplant wird vor dem Rücken, genommen danach: genau die Masse, um die der
 * Körper wuchs.
 *
 * <b>Mehrere Rechtecke</b> (ein ausradiertes Stück, eine Zlewka aus Eis): eine
 * Seite, die zum Teil an einem anderen Rechteck liegt, rückt nur, wo sie frei
 * ist — die Scheiben werden abgezogen oder angesetzt und der Körper neu in
 * waagrechte Streifen zerlegt (geom.recompose); zerfällt er, wird jedes Stück
 * ein eigener Körper. Seiten verschiedener Rechtecke, die auf einer Geraden
 * aneinanderstossen, sind eine Wand und rücken gleich weit (sonst entstünden
 * Stufen und Splitter); an einer freien Ecke folgt eine Wachsscheibe dem Zug
 * der Nachbarseite, in einer inneren Ecke reicht eine Schmelzscheibe so weit,
 * wie die andere Wand zurückweicht. Ein einzelnes Rechteck rückt seine Seiten direkt: seine
 * inneren Zellen bleiben, nur die Randreihe wird dünner oder dicker.
 *
 * Schmelzwasser geht in die Teilchen vor der Seite (meltWater.ts); liegt die
 * Seite auf etwas (auf der Heizplatte), quillt es an ihren Enden hervor; der
 * Block sinkt nach. Wird
 * eine Randreihe dünner als 0,3 Δx, geht sie in der Nachbarreihe auf; ein
 * Rechteck, das dünner als 0,05 Δx wird, schmilzt ganz.
 */

import { latentPerKg, meltsAt, solidEnergy, type Body2D } from './body';
import { regrid, separate, type RectLocal } from './bodyTools';
import { recompose, type Rect4, type Slab } from './geom';
import { hL, SOLIDS, WATER } from './materials';
import { edgeCells, fluidFront, freeLength, freeOn, freezingAt, sideLength, supplyAt, widestFree } from './meltSides';
import { MeltWater } from './meltWater';
import { T0 } from './units';
import type { Engine } from './engine';

/** Eine Randreihe, die dünner wird als das (Anteil der Zellkante), geht in der Nachbarreihe auf; dicker als THICK teilt sie sich. */
const THIN = 0.3;
const THICK = 1.6;
/**
 * Ein Rechteck, das dünner als das wird (Anteil der Zellkante), schmilzt ganz — dünner kann das Gitter es nicht
 * tragen: ein Splitter von 0,1 mm auf der Heizplatte (bis 2026-10-24 GONE 0,05) wog fast nichts, und jeder Druckstoss
 * des siedenden Wassers schleuderte ihn aus der Kiste.
 */
const GONE = 0.25;
/** Höchstens dieser Anteil des Wassers eines Teilchens friert je Schritt an. */
const FREEZE_MAX = 0.5;
/** Rechtecke, die sich so nah berühren (Anteil der Zellkante), gelten als verbunden — wie in body.ts. */
const JOIN = 1e-6;

/** Geplantes Anfrieren an einer Seite: die Teilchen und wie viel Wasser jedes gibt (kg). */
interface Freeze { p: number[]; dm: number[]; total: number }

/** Ein Zug an einer Seite (Rechteck r, Seite s): schmelzen (Tiefe d, Schmelzwärme Q) oder anfrieren (freeze, d die geplante Dicke). */
interface Move { r: number; s: number; d: number; Q: number; Tf: number; hIce: number; freeze: Freeze | null }

export class BodyMelt {
  /** Wohin das Schmelzwasser geht (und was davon noch kein Teilchen ist). */
  readonly water: MeltWater;
  /** Seit dem Start geschmolzen und angefroren (kg) — für die Anzeige und die Prüfungen. */
  melted = 0;
  frozen = 0;
  /* Teilchen je Zelle (einmal je Schritt gebaut, wenn gebraucht): Kopf je Zelle, Nachfolger je Teilchen. */
  private head = new Int32Array(0);
  private next = new Int32Array(0);
  private listed = false;

  constructor(private readonly e: Engine) {
    this.water = new MeltWater(e, (c, fn) => this.inCell(c, fn));
  }

  /** Wasser (ohne Salz), Enthalpie und Salz des noch nicht verteilten Schmelzwassers (für die Bilanzen). */
  pendingTotals(): { m: number; H: number; s: number } {
    return this.water.totals();
  }

  /** Gibt es einen schmelzbaren Körper oder noch nicht verteiltes Schmelzwasser? */
  any(): boolean {
    return this.e.bodies.list.some((b, q) => (!b.gone && meltsAt(b.mat) > 0) || this.water.any(q));
  }

  /** Ein Schritt (nach collect, vor den Kräften): schmelzen und anfrieren; liefert, ob ein Körper seine Form änderte. */
  step(): boolean {
    this.listed = false;
    let changed = false;
    const list = this.e.bodies.list;
    const count = list.length;
    for (let q = 0; q < count; q += 1) {
      const b = list[q];
      if (!b.gone && meltsAt(b.mat) > 0 && this.body(b)) changed = true;
      this.water.spawnAll(b);
    }
    return changed;
  }

  /* -- Ein Körper ----------------------------------------------------------------------------------- */

  /** Schmelzen und Anfrieren an allen freien Seiten eines Körpers; liefert, ob er seine Form änderte. */
  private body(b: Body2D): boolean {
    const rho = SOLIDS[b.mat].rho;
    const cp = SOLIDS[b.mat].cp;
    const e0 = latentPerKg(b.mat);
    /* Die Seiten mit einem freien Stück: ihr T_f, ob Fluid vor ihnen liegt und wie viel Wärme dort ansteht; die Überschüsse der inneren Zellen an die Seiten, durch die sie kommen. */
    const Tf = new Map<number, number>();
    const open = new Set<number>();
    const supply = new Map<number, number>();
    for (let e = 0; e < b.nseg; e += 1) {
      const key = 4 * b.segR[e] + b.segS[e];
      if (Tf.has(key)) continue;
      const tf = freezingAt(this.e, b, b.segR[e], b.segS[e], open);
      Tf.set(key, tf);
      supply.set(key, supplyAt(this.e, b, b.segR[e], b.segS[e], tf));
    }
    const Q = new Map<number, number>();
    for (let r = 0; r < b.nr; r += 1) this.excess(b, r, Tf, open, supply, Q);
    /* Je Wand (Seiten auf einer Geraden, die aneinanderstossen): Schmelzwärme, Nenner und geplantes Anfrieren zusammen — eine Tiefe für alle ihre Seiten. */
    const wall = this.walls(b, [...Tf.keys()]);
    const side = new Map<number, { L: number; hIce: number; denom: number; plan: Freeze | null }>();
    const sumQ = new Map<number, number>();
    const sumD = new Map<number, number>();
    const sumF = new Map<number, number>();
    const sumLen = new Map<number, number>();
    for (const [key, tf] of Tf) {
      const r = key >> 2;
      const s = key & 3;
      const hIce = cp * (tf - T0) + e0;
      const L = hL(tf) - hIce;
      let denom = 0;
      edgeCells(b, r, s, (k, len, free) => { if (free > 0) denom += free * len * (L + cp * (tf - Math.min(tf, b.cellT(k)))); });
      const plan = this.planFreeze(b, r, s, tf, L);
      side.set(key, { L, hIce, denom, plan });
      const w = wall.get(key) as number;
      sumQ.set(w, (sumQ.get(w) ?? 0) + (Q.get(key) ?? 0));
      sumD.set(w, (sumD.get(w) ?? 0) + denom);
      sumF.set(w, (sumF.get(w) ?? 0) + (plan?.total ?? 0));
      sumLen.set(w, (sumLen.get(w) ?? 0) + freeLength(b, r, s));
    }
    const moves: Move[] = [];
    for (const [key, tf] of Tf) {
      const r = key >> 2;
      const s = key & 3;
      const w = wall.get(key) as number;
      const info = side.get(key) as { L: number; hIce: number; denom: number; plan: Freeze | null };
      const q = Q.get(key) ?? 0;
      const qw = sumQ.get(w) ?? 0;
      const dw = sumD.get(w) ?? 0;
      if (qw > 0 && dw > 0) moves.push({ r, s, d: qw / (rho * b.depth * dw), Q: q, Tf: tf, hIce: info.hIce, freeze: null });
      else if (q > 0) this.giveBack(b, r, s, q);
      const fw = sumF.get(w) ?? 0;
      if (fw > 0) moves.push({ r, s, d: fw / (rho * b.depth * (sumLen.get(w) as number)), Q: 0, Tf: tf, hIce: info.hIce, freeze: info.plan ?? { p: [], dm: [], total: 0 } });
    }
    if (moves.length === 0) return false;
    const before = topology(b);
    const bodies = this.e.bodies;
    bodies.cover.release(b);
    if (b.nr === 1) this.moveSides(b, moves);
    else this.slabs(b, moves);
    this.tidy(b);
    if (b.gone || b.nr === 0) {
      b.gone = true;
      b.ncell = 0;
      bodies.changed();
      return true;
    }
    /* Zerfällt ein Körper aus mehreren Rechtecken, wird jedes weitere Stück ein eigener Körper. */
    let parts = 0;
    if (b.nr > 1) {
      const rects: RectLocal[] = [];
      for (let r = 0; r < b.nr; r += 1) rects.push(b.bounds(r));
      parts = separate(bodies, b, rects, false).length;
    }
    b.derive();
    bodies.cover.weigh(b);
    bodies.cover.addCells(b);
    /* Wuchs er, liegen Teilchen und Blasen vielleicht im neuen Eis: vor die nächste Seite (ein angehefteter Körper schiebt sonst nie). */
    if (moves.some((mv) => mv.freeze !== null)) bodies.cover.pushOut(b, b.x, b.y, b.a);
    bodies.reshaped(b, parts > 0 || topology(b) !== before);
    return true;
  }

  /**
   * Die Überschüsse über T_f der inneren Zellen des Rechtecks r an die Seiten, durch die die Wärme kommt: eine Randzelle
   * an ihre anliegenden freien Seiten mit Zufuhr (supply), nach deren Anteil — so schmelzen eine oder mehrere Seiten,
   * auch eine, die auf einer warmen Platte liegt; ohne solche Seite (und im Inneren) an die nächste offene Seite (ohne
   * offene: die nächste freie).
   */
  private excess(b: Body2D, r: number, Tf: Map<number, number>, open: Set<number>, supply: Map<number, number>, Q: Map<number, number>): void {
    const sides: number[] = [];
    for (let s = 0; s < 4; s += 1) if (open.has(4 * r + s)) sides.push(s);
    if (sides.length === 0) for (let s = 0; s < 4; s += 1) if (Tf.has(4 * r + s)) sides.push(s);
    let lowest = Infinity;
    for (let s = 0; s < 4; s += 1) lowest = Math.min(lowest, Tf.get(4 * r + s) ?? Infinity);
    if (lowest === Infinity) return;
    const xs = b.xs[r];
    const ys = b.ys[r];
    const ni = b.ni[r];
    const nj = b.nj[r];
    const cs = [0, 0];
    const cw = [0, 0];
    for (let q = 0; q < nj; q += 1) {
      for (let p = 0; p < ni; p += 1) {
        const k = b.off[r] + p + q * ni;
        const T = b.cellT(k);
        if (!(T > lowest)) continue;
        /* Die anliegenden freien Seiten, vor denen Wärmeres liegt (höchstens zwei: an einer Ecke). */
        let n = 0;
        let wsum = 0;
        for (let s = 0; s < 4 && n < 2; s += 1) {
          if (!(s === 0 ? p === 0 : s === 1 ? p === ni - 1 : s === 2 ? q === 0 : q === nj - 1)) continue;
          const w = supply.get(4 * r + s) ?? 0;
          if (!(w > 0) || !(freeOn(b, r, s, s < 2 ? ys[q] : xs[p], s < 2 ? ys[q + 1] : xs[p + 1]) > 0)) continue;
          cs[n] = s;
          cw[n] = w;
          wsum += w;
          n += 1;
        }
        if (n > 0) {
          const E = b.E[k];
          for (let i = 0; i < n; i += 1) {
            const key = 4 * r + cs[i];
            const ex = (cw[i] / wsum) * (E - solidEnergy(b.cellCap(k), b.film[k], b.crust[k], Tf.get(key) as number));
            if (!(ex > 0)) continue;
            b.E[k] -= ex;
            Q.set(key, (Q.get(key) ?? 0) + ex);
          }
          continue;
        }
        if (sides.length === 0) continue;
        const cx = 0.5 * (xs[p] + xs[p + 1]);
        const cy = 0.5 * (ys[q] + ys[q + 1]);
        let best = sides[0];
        let dist = Infinity;
        for (const s of sides) {
          const d = s === 0 ? cx - xs[0] : s === 1 ? xs[ni] - cx : s === 2 ? cy - ys[0] : ys[nj] - cy;
          if (d < dist) { dist = d; best = s; }
        }
        const key = 4 * r + best;
        const tf = Tf.get(key) as number;
        if (!(T > tf)) continue;
        const ex = b.E[k] - solidEnergy(b.cellCap(k), b.film[k], b.crust[k], tf);
        if (!(ex > 0)) continue;
        b.E[k] -= ex;
        Q.set(key, (Q.get(key) ?? 0) + ex);
      }
    }
  }

  /* -- Teilchen je Zelle ---------------------------------------------------------------------------- */

  /** Die Teilchen der Zelle c (wie sie zu Beginn des Schmelzens lagen; neu entstandene fehlen). */
  private inCell(c: number, fn: (p: number) => void): void {
    if (!this.listed) this.buildLists();
    for (let p = this.head[c]; p >= 0; p = this.next[p]) fn(p);
  }

  private buildLists(): void {
    const g = this.e.grid;
    const P = this.e.particles;
    if (this.head.length !== g.n) this.head = new Int32Array(g.n);
    this.head.fill(-1);
    if (this.next.length < P.count) this.next = new Int32Array(Math.max(P.cap, P.count));
    for (let p = 0; p < P.count; p += 1) {
      const c = g.cellAt(P.x[p], P.y[p]);
      if (c < 0) continue;
      this.next[p] = this.head[c];
      this.head[c] = p;
    }
    this.listed = true;
  }

  /* -- Anfrieren ------------------------------------------------------------------------------------ */

  /**
   * Wieviel Wasser vor der Seite anfriert (geplant, noch nicht genommen): je
   * Zelle mit Wasser unter T_f so viel, dass die frei werdende Wärme es auf T_f
   * bringt, nach dem Wasser der Teilchen verteilt. Eine Zelle gibt je Schritt
   * nur einmal (an die erste Seite, die sie fragt).
   */
  private planFreeze(b: Body2D, r: number, s: number, Tf: number, L: number): Freeze | null {
    const ex = this.e.exchange;
    const P = this.e.particles;
    const plan: Freeze = { p: [], dm: [], total: 0 };
    const each = (c: number): void => {
      if (!(ex.cap[c] > 0) || !(ex.water[c] > 0)) return;
      const Tl = ex.capT[c] / ex.cap[c];
      if (Tl >= Tf) return;
      const want = Math.min(FREEZE_MAX * ex.water[c], (ex.cap[c] * (Tf - Tl)) / Math.max(1, L));
      if (!(want > 0)) return;
      let planned = 0;
      this.inCell(c, (p) => {
        if (P.mat[p] !== WATER) return;
        const w = P.mass[p] - P.smass[2 * p];
        const dm = Math.min(FREEZE_MAX * w, (want * w) / ex.water[c]);
        if (!(dm > 0)) return;
        plan.p.push(p);
        plan.dm.push(dm);
        planned += dm;
      });
      ex.water[c] -= planned;
      ex.cap[c] = 0;
      plan.total += planned;
    };
    for (let e = 0; e < b.nseg; e += 1) if (b.segR[e] === r && b.segS[e] === s) fluidFront(this.e, b, e, each);
    return plan.total > 0 ? plan : null;
  }

  /** Das geplante Wasser nehmen, mal scale (die Masse, um die der Körper wirklich wuchs): mit der Enthalpie des Eises, das Salz bleibt. */
  private take(f: Freeze, scale: number, hIce: number): void {
    const P = this.e.particles;
    const Lq = this.e.liquid;
    let taken = 0;
    for (let q = 0; q < f.p.length; q += 1) {
      const p = f.p[q];
      const dm = f.dm[q] * scale;
      if (!(dm > 0)) continue;
      const before = P.mass[p] / P.rho[p];
      const H = P.mass[p] * P.h[p] - dm * hIce;
      P.mass[p] -= dm;
      P.h[p] = H / P.mass[p];
      P.derive(p);
      Lq.dVp[p] += P.mass[p] / P.rho[p] - before;
      taken += dm;
    }
    this.frozen += taken;
  }

  /* -- Ein einzelnes Rechteck: die Seiten rücken ------------------------------------------------------ */

  private moveSides(b: Body2D, moves: readonly Move[]): void {
    for (const mv of moves) {
      if (mv.freeze === null) { this.melt(b, mv.r, mv.s, mv.d, mv.Q); continue; }
      const m = mv.freeze.total;
      this.take(mv.freeze, 1, mv.hIce);
      this.grow(b, mv.r, mv.s, m, mv.Tf);
    }
  }

  /**
   * Die Seite s des Rechtecks r um d nach innen: die Randzellen verlieren ihre
   * Scheibe (Energie, Film und Kruste nach ihrem Anteil); das Schmelzwasser
   * (die Masse der Scheibe samt Film, ihre Kruste gelöst) hat deren Energie,
   * den Versatz e0 der geschmolzenen Masse und die Schmelzwärme Q.
   */
  private melt(b: Body2D, r: number, s: number, d: number, Q: number): void {
    const rho = SOLIDS[b.mat].rho;
    const dd = Math.min(d, this.rowThickness(b, r, s));
    let m = 0;
    let E = 0;
    let film = 0;
    let crust = 0;
    edgeCells(b, r, s, (k, len) => {
      const V = b.cellVolume(k);
      if (!(V > 0)) return;
      const f = (len * dd * b.depth) / V;
      E += f * b.E[k];
      film += f * b.film[k];
      crust += f * b.crust[k];
      b.E[k] -= f * b.E[k];
      b.film[k] -= f * b.film[k];
      b.crust[k] -= f * b.crust[k];
      m += rho * len * dd * b.depth;
    });
    this.moveSide(b, r, s, -dd);
    if (!(m > 0)) { this.giveBack(b, r, s, Q + E); return; }
    this.melted += m;
    this.water.give(b, r, s, m + film + crust, E + m * latentPerKg(b.mat) + Q, crust);
  }

  /** Die Seite s des Rechtecks r wächst um die Masse m (kg) nach aussen — die Dicke aus der jetzigen Länge der Seite; die Randzellen bekommen die Scheibe Eis bei T_f. */
  private grow(b: Body2D, r: number, s: number, m: number, Tf: number): void {
    const rho = SOLIDS[b.mat].rho;
    const cp = SOLIDS[b.mat].cp;
    const len = sideLength(b, r, s);
    const d = m / (rho * b.depth * len);
    edgeCells(b, r, s, (k, l) => { b.E[k] += rho * l * d * b.depth * cp * (Tf - T0); });
    this.moveSide(b, r, s, d);
  }

  /** Dicke der Randreihe an Seite s (m). */
  private rowThickness(b: Body2D, r: number, s: number): number {
    const xs = b.xs[r];
    const ys = b.ys[r];
    if (s === 0) return xs[1] - xs[0];
    if (s === 1) return xs[b.ni[r]] - xs[b.ni[r] - 1];
    if (s === 2) return ys[1] - ys[0];
    return ys[b.nj[r]] - ys[b.nj[r] - 1];
  }

  /** Die Grenze der Seite s um d verschieben (positiv nach aussen). */
  private moveSide(b: Body2D, r: number, s: number, d: number): void {
    if (s === 0) b.xs[r][0] -= d;
    else if (s === 1) b.xs[r][b.ni[r]] += d;
    else if (s === 2) b.ys[r][0] -= d;
    else b.ys[r][b.nj[r]] += d;
  }

  /** Wärme Q zurück in die Randzellen der Seite (nach Länge). */
  private giveBack(b: Body2D, r: number, s: number, Q: number): void {
    const len = sideLength(b, r, s);
    if (!(len > 0)) { b.E[b.off[r]] += Q; return; }
    edgeCells(b, r, s, (k, l) => { b.E[k] += (Q * l) / len; });
  }

  /* -- Mehrere Rechtecke: Scheiben und neue Streifen ------------------------------------------------- */

  /**
   * Die Züge als Scheiben an den freien Stücken der Seiten, der Körper neu
   * zusammengesetzt: das Genommene (Energie, Film, Kruste aus den alten Zellen
   * nach Fläche) wird Schmelzwasser seiner Seite, das Angesetzte Eis bei T_f;
   * die Teilchen geben genau die Masse, um die der Körper wuchs.
   */
  private slabs(b: Body2D, moves: readonly Move[]): void {
    const rho = SOLIDS[b.mat].rho;
    const cp = SOLIDS[b.mat].cp;
    const e0 = latentPerKg(b.mat);
    const D = b.depth;
    const n = moves.length;
    const walls = this.walls(b, moves.map((mv) => 4 * mv.r + mv.s));
    const wallOf = moves.map((mv) => walls.get(4 * mv.r + mv.s) as number);
    /* Schmelztiefe je Seite (für die inneren Ecken). */
    const meltDepth = new Map<number, number>();
    for (const mv of moves) if (mv.freeze === null) meltDepth.set(4 * mv.r + mv.s, mv.d);
    const old: Rect4[] = [];
    for (let r = 0; r < b.nr; r += 1) old.push(b.bounds(r));
    /* Je Seite die Summe der Züge nach aussen (positiv: wächst) — für die Ecken der Wachsscheiben. */
    const net = new Map<number, number>();
    for (const mv of moves) net.set(4 * mv.r + mv.s, (net.get(4 * mv.r + mv.s) ?? 0) + (mv.freeze !== null ? mv.d : -mv.d));
    const melts: Slab[] = [];
    const grows: Slab[] = [];
    for (let q = 0; q < n; q += 1) {
      const mv = moves[q];
      const rc = old[mv.r];
      for (let e = 0; e < b.nseg; e += 1) {
        if (b.segR[e] !== mv.r || b.segS[e] !== mv.s) continue;
        if (mv.freeze === null) {
          const t0 = b.segT0[e] - this.inner(b, e, false, meltDepth);
          const t1 = b.segT1[e] + this.inner(b, e, true, meltDepth);
          melts.push(slab(mv.s, rc, t0, t1, Math.min(mv.d, mv.s < 2 ? rc[2] - rc[0] : rc[3] - rc[1]), true, q));
        } else {
          const t0 = b.segT0[e] - this.corner(b, mv.r, mv.s, false, b.segT0[e], net);
          const t1 = b.segT1[e] + this.corner(b, mv.r, mv.s, true, b.segT1[e], net);
          if (t1 > t0) grows.push(slab(mv.s, rc, t0, t1, mv.d, false, q));
        }
      }
    }
    const res = recompose(old, melts, grows);
    const tk = res.taken;
    /* Geschmolzene Fläche je Zug; ein Zug ohne Fläche gibt seine Wärme der Seite zurück (bevor die Energie der Scheiben gezählt wird). */
    const mA = new Float64Array(n);
    for (let t = 0; t < tk.length; t += 5) mA[tk[t + 4]] += (tk[t + 2] - tk[t]) * (tk[t + 3] - tk[t + 1]);
    for (let q = 0; q < n; q += 1) if (moves[q].freeze === null && !(mA[q] > 0)) this.giveBack(b, moves[q].r, moves[q].s, moves[q].Q);
    const mE = new Float64Array(n);
    const mF = new Float64Array(n);
    const mK = new Float64Array(n);
    for (let t = 0; t < tk.length; t += 5) {
      const q = tk[t + 4];
      this.overlap(b, tk[t], tk[t + 1], tk[t + 2], tk[t + 3], (k, share) => { mE[q] += share * b.E[k]; mF[q] += share * b.film[k]; mK[q] += share * b.crust[k]; });
    }
    for (let q = 0; q < n; q += 1) {
      const mv = moves[q];
      if (mv.freeze !== null || !(mA[q] > 0)) continue;
      const m = rho * D * mA[q];
      this.melted += m;
      this.water.give(b, mv.r, mv.s, m + mF[q] + mK[q], mE[q] + m * e0 + mv.Q, mK[q]);
    }
    regrid(b, res.rects);
    const ad = res.added;
    const gA = new Float64Array(n);
    for (let t = 0; t < ad.length; t += 5) {
      const q = ad[t + 4];
      const tf = moves[q].Tf;
      gA[q] += (ad[t + 2] - ad[t]) * (ad[t + 3] - ad[t + 1]);
      this.overlap(b, ad[t], ad[t + 1], ad[t + 2], ad[t + 3], (k, _share, area) => { b.E[k] += rho * D * area * cp * (tf - T0); });
    }
    /* Je Wand: was sie wirklich wuchs, nehmen ihre Seiten nach ihrem Plan (eine Seite ohne eigenes Wasser gibt nichts). */
    const wantW = new Map<number, number>();
    const planW = new Map<number, number>();
    for (let q = 0; q < n; q += 1) {
      const f = moves[q].freeze;
      if (f === null) continue;
      const w = wallOf[q];
      wantW.set(w, (wantW.get(w) ?? 0) + rho * D * gA[q]);
      planW.set(w, (planW.get(w) ?? 0) + f.total);
    }
    for (let q = 0; q < n; q += 1) {
      const f = moves[q].freeze;
      if (f === null || !(f.total > 0)) continue;
      const w = wallOf[q];
      this.take(f, (wantW.get(w) as number) / (planW.get(w) as number), moves[q].hIce);
    }
  }

  /**
   * Die Wände eines Körpers: Seiten (Schlüssel 4 r + s) gleicher Richtung auf
   * derselben Geraden, deren freie Stücke aneinanderstossen, gehören zu einer
   * Wand (eine Nummer je Wand: der kleinste Schlüssel).
   */
  private walls(b: Body2D, keys: readonly number[]): Map<number, number> {
    const root = new Map<number, number>();
    for (const k of keys) root.set(k, k);
    const find = (k: number): number => { let x = k; while (root.get(x) !== x) x = root.get(x) as number; return x; };
    if (b.nr > 1) {
      const tol = JOIN * b.dx;
      const line = (e: number): number => {
        const r = b.segR[e];
        const s = b.segS[e];
        return s === 0 ? b.xs[r][0] : s === 1 ? b.xs[r][b.ni[r]] : s === 2 ? b.ys[r][0] : b.ys[r][b.nj[r]];
      };
      for (let e = 0; e < b.nseg; e += 1) {
        for (let f = e + 1; f < b.nseg; f += 1) {
          if (b.segS[e] !== b.segS[f] || Math.abs(line(e) - line(f)) > tol) continue;
          if (Math.abs(b.segT1[e] - b.segT0[f]) > tol && Math.abs(b.segT1[f] - b.segT0[e]) > tol) continue;
          const ke = 4 * b.segR[e] + b.segS[e];
          const kf = 4 * b.segR[f] + b.segS[f];
          if (!root.has(ke) || !root.has(kf)) continue;
          const a = find(ke);
          const c = find(kf);
          if (a !== c) root.set(Math.max(a, c), Math.min(a, c));
        }
      }
    }
    const out = new Map<number, number>();
    for (const k of keys) out.set(k, find(k));
    return out;
  }

  /**
   * Am Ende eines freien Stücks e, das in einer inneren Ecke liegt (dort
   * beginnt ein anderes freies Stück quer dazu, das in Richtung der Normalen
   * von e liegt — der Boden einer Kerbe neben ihrer Wand): so weit, wie jene
   * Seite schmilzt, reicht die Schmelzscheibe über das Ende hinaus; sonst
   * bliebe in der Ecke ein Grat stehen.
   */
  private inner(b: Body2D, e: number, upper: boolean, meltDepth: Map<number, number>): number {
    const tol = JOIN * b.dx;
    const r = b.segR[e];
    const s = b.segS[e];
    const t = upper ? b.segT1[e] : b.segT0[e];
    const c = s === 0 ? b.xs[r][0] : s === 1 ? b.xs[r][b.ni[r]] : s === 2 ? b.ys[r][0] : b.ys[r][b.nj[r]];
    const px = s < 2 ? c : t;
    const py = s < 2 ? t : c;
    const nx = s === 0 ? -1 : s === 1 ? 1 : 0;
    const ny = s === 2 ? -1 : s === 3 ? 1 : 0;
    for (let f = 0; f < b.nseg; f += 1) {
      const sf = b.segS[f];
      if ((sf < 2) === (s < 2)) continue;
      const d = meltDepth.get(4 * b.segR[f] + sf);
      if (d === undefined) continue;
      const rf = b.segR[f];
      const cf = sf === 0 ? b.xs[rf][0] : sf === 1 ? b.xs[rf][b.ni[rf]] : sf === 2 ? b.ys[rf][0] : b.ys[rf][b.nj[rf]];
      for (const [ta, tb] of [[b.segT0[f], b.segT1[f]], [b.segT1[f], b.segT0[f]]]) {
        const ax = sf < 2 ? cf : ta;
        const ay = sf < 2 ? ta : cf;
        if (Math.abs(ax - px) > tol || Math.abs(ay - py) > tol) continue;
        const bx = sf < 2 ? cf : tb;
        const by = sf < 2 ? tb : cf;
        if ((bx - px) * nx + (by - py) * ny > tol) return d;
      }
    }
    return 0;
  }

  /**
   * Am Ende t einer Wachsscheibe: liegt dort eine Ecke des Rechtecks, an der
   * auch die anliegende Seite frei ist, folgt das Ende deren Zug (wächst sie,
   * länger; schmilzt sie, kürzer) — sonst bliebe eine Kerbe oder ein Grat.
   */
  private corner(b: Body2D, r: number, s: number, upper: boolean, t: number, net: Map<number, number>): number {
    const [x0, y0, x1, y1] = b.bounds(r);
    const tol = JOIN * b.dx;
    const end = s < 2 ? (upper ? y1 : y0) : (upper ? x1 : x0);
    if (Math.abs(t - end) > tol) return 0;
    const adj = s < 2 ? (upper ? 3 : 2) : (upper ? 1 : 0);
    const at = s === 0 ? x0 : s === 1 ? x1 : s === 2 ? y0 : y1;
    for (let e = 0; e < b.nseg; e += 1) {
      if (b.segR[e] === r && b.segS[e] === adj && b.segT0[e] <= at + tol && b.segT1[e] >= at - tol) return net.get(4 * r + adj) ?? 0;
    }
    return 0;
  }

  /** Die inneren Zellen, die das Rechteck [x0, x1] × [y0, y1] (eigener Rahmen) schneiden: Zelle, Anteil an ihrer Fläche, Fläche des Schnitts. */
  private overlap(b: Body2D, x0: number, y0: number, x1: number, y1: number, fn: (k: number, share: number, area: number) => void): void {
    for (let r = 0; r < b.nr; r += 1) {
      const xs = b.xs[r];
      const ys = b.ys[r];
      const ni = b.ni[r];
      const nj = b.nj[r];
      if (xs[0] >= x1 || xs[ni] <= x0 || ys[0] >= y1 || ys[nj] <= y0) continue;
      for (let q = 0; q < nj; q += 1) {
        const oy = Math.min(y1, ys[q + 1]) - Math.max(y0, ys[q]);
        if (oy <= 0) continue;
        for (let p = 0; p < ni; p += 1) {
          const ox = Math.min(x1, xs[p + 1]) - Math.max(x0, xs[p]);
          if (ox <= 0) continue;
          fn(b.off[r] + p + q * ni, (ox * oy) / ((xs[p + 1] - xs[p]) * (ys[q + 1] - ys[q])), ox * oy);
        }
      }
    }
  }

  /* -- Ordnung der inneren Zellen ------------------------------------------------------------------- */

  /** Dünne Randreihen in die Nachbarreihe, dicke teilen; dünne Rechtecke schmelzen ganz (mit Film und Kruste). */
  private tidy(b: Body2D): void {
    const dx = b.dx;
    let rebuild = false;
    for (let r = 0; r < b.nr; r += 1) {
      const [x0, y0, x1, y1] = b.bounds(r);
      if (x1 - x0 < GONE * dx || y1 - y0 < GONE * dx) { rebuild = true; continue; }
      for (let s = 0; s < 4; s += 1) {
        const t = this.rowThickness(b, r, s);
        const n = s < 2 ? b.ni[r] : b.nj[r];
        if ((t < THIN * dx && n > 1) || t > THICK * dx) rebuild = true;
      }
    }
    if (!rebuild) return;
    const rho = SOLIDS[b.mat].rho;
    const e0 = latentPerKg(b.mat);
    const rects: RectLocal[] = [];
    for (let r = 0; r < b.nr; r += 1) {
      const [x0, y0, x1, y1] = b.bounds(r);
      if (x1 - x0 >= GONE * dx && y1 - y0 >= GONE * dx) { rects.push([x0, y0, x1, y1]); continue; }
      /* Ganz geschmolzen: Masse, Energie samt Versatz, Film und Kruste werden Schmelzwasser an seiner freiesten Seite. */
      const m = rho * (x1 - x0) * (y1 - y0) * b.depth;
      let E = 0;
      let F = 0;
      let K = 0;
      for (let k = b.off[r]; k < b.off[r] + b.ni[r] * b.nj[r]; k += 1) { E += b.E[k]; F += b.film[k]; K += b.crust[k]; }
      this.melted += m;
      this.water.give(b, r, widestFree(b, r), m + F + K, E + m * e0, K);
    }
    regrid(b, rects);
    if (b.nr === 0 || b.ncell === 0) {
      b.gone = true;
      b.ncell = 0;
    }
  }
}

/** Eine Scheibe an der Seite s des Rechtecks rc längs [t0, t1], Dicke d — innen (schmelzen) oder aussen (wachsen). */
function slab(s: number, rc: Rect4, t0: number, t1: number, d: number, inward: boolean, move: number): Slab {
  const [x0, y0, x1, y1] = rc;
  if (s === 0) return inward ? { x0, y0: t0, x1: x0 + d, y1: t1, move } : { x0: x0 - d, y0: t0, x1: x0, y1: t1, move };
  if (s === 1) return inward ? { x0: x1 - d, y0: t0, x1, y1: t1, move } : { x0: x1, y0: t0, x1: x1 + d, y1: t1, move };
  if (s === 2) return inward ? { x0: t0, y0, x1: t1, y1: y0 + d, move } : { x0: t0, y0: y0 - d, x1: t1, y1: y0, move };
  return inward ? { x0: t0, y0: y1 - d, x1: t1, y1, move } : { x0: t0, y0: y1, x1: t1, y1: y1 + d, move };
}

/** Wie sich die freien Seiten eines Körpers gliedern (Zahl der Rechtecke und Seitenstücke, je Stück Rechteck und Seite) — als Zahl. */
function topology(b: Body2D): number {
  let h = b.nr * 7919 + b.nseg;
  for (let e = 0; e < b.nseg; e += 1) h = (Math.imul(h, 31) + 4 * b.segR[e] + b.segS[e]) | 0;
  return h;
}
