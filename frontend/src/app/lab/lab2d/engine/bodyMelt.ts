/**
 * LABOR 2D (v2) — SCHMELZEN UND ANFRIEREN (M3b, seit 2026-10-23): ein
 * Eisblock bleibt ein Rechteck; er schmilzt oder wächst, indem eine ganze
 * Seite rückt (die Entscheidung des Projekts: kein Zerfall in Zellen).
 *
 * <b>Schmelzen.</b> Die Wärme kommt wie jede Wärme über das Gitter und den
 * Ausgleich in gemischten Zellen in die inneren Zellen des Körpers
 * (bodyCover.collect). Liegt eine innere Zelle über der Schmelztemperatur T_f
 * der nächsten offenen Seite ihres Rechtecks (vor der Fluid liegt; eine Seite
 * an einer Wand, einem Bau oder einem anderen Körper nur, wenn das Rechteck
 * keine offene hat), wird der Überschuss zu Schmelzwärme dieser Seite: Eis
 * wird nie wärmer als die Grenzfläche, an der es schmilzt (eine Zelle im
 * Inneren gibt ihre Wärme sofort an die Seite — die Leitung dorthin ist dann
 * unendlich schnell, das Ende stimmt). Alle Überschüsse einer Seite zusammen
 * schieben sie um
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
 * Schmelzwasser geht in die Teilchen vor der Seite (sie werden schwerer; ein
 * Teilchen über der doppelten Nennmasse teilt sich); ist dort keine
 * Flüssigkeit, sammelt es sich und wird ein neues Teilchen vor der Seite (oder
 * am nächsten freien Ort), sobald es ein Viertel der Nennmasse erreicht. Wird
 * eine Randreihe dünner als 0,3 Δx, geht sie in der Nachbarreihe auf; ein
 * Rechteck, das dünner als 0,05 Δx wird, schmilzt ganz.
 */

import { latentPerKg, meltsAt, solidEnergy, type Body2D } from './body';
import { regrid, separate, type RectLocal } from './bodyTools';
import { recompose, type Rect4, type Slab } from './geom';
import { hL, SOLIDS, WATER } from './materials';
import { freezingPoint, M_S, NACL } from './solution';
import { LIQUID, T0 } from './units';
import type { Engine } from './engine';

/** Eine Randreihe, die dünner wird als das (Anteil der Zellkante), geht in der Nachbarreihe auf; dicker als THICK teilt sie sich. */
const THIN = 0.3;
const THICK = 1.6;
/** Ein Rechteck, das dünner als das wird (Anteil der Zellkante), schmilzt ganz. */
const GONE = 0.05;
/** Ein Teilchen über dieser Masse (Vielfaches der Nennmasse) teilt sich; neues Schmelzwasser ab diesem Anteil wird ein Teilchen. */
const SPLIT = 2;
const SPAWN = 0.25;
/** Höchstens dieser Anteil des Wassers eines Teilchens friert je Schritt an. */
const FREEZE_MAX = 0.5;
/** Rechtecke, die sich so nah berühren (Anteil der Zellkante), gelten als verbunden — wie in body.ts. */
const JOIN = 1e-6;

/** Schmelzwasser, das noch kein Teilchen ist (je Körper): Masse samt Salz (kg), Enthalpie (J), Salz (kg), Ort und Normale der Seite, an der es entstand. */
export interface Pending { m: number; H: number; s: number; x: number; y: number; nx: number; ny: number }

/** Geplantes Anfrieren an einer Seite: die Teilchen und wie viel Wasser jedes gibt (kg). */
interface Freeze { p: number[]; dm: number[]; total: number }

/** Ein Zug an einer Seite (Rechteck r, Seite s): schmelzen (Tiefe d, Schmelzwärme Q) oder anfrieren (freeze, d die geplante Dicke). */
interface Move { r: number; s: number; d: number; Q: number; Tf: number; hIce: number; freeze: Freeze | null }

export class BodyMelt {
  /** Je Körper das Schmelzwasser, das noch kein Teilchen ist (Index wie bodies.list). */
  pending: Pending[] = [];
  /** Seit dem Start geschmolzen und angefroren (kg) — für die Anzeige und die Prüfungen. */
  melted = 0;
  frozen = 0;
  private readonly sg = new Float64Array(6);
  /* Teilchen je Zelle (einmal je Schritt gebaut, wenn gebraucht): Kopf je Zelle, Nachfolger je Teilchen. */
  private head = new Int32Array(0);
  private next = new Int32Array(0);
  private listed = false;

  constructor(private readonly e: Engine) {}

  /** Wasser (ohne Salz), Enthalpie und Salz des noch nicht verteilten Schmelzwassers (für die Bilanzen). */
  pendingTotals(): { m: number; H: number; s: number } {
    let m = 0;
    let H = 0;
    let s = 0;
    for (const p of this.pending) if (p !== undefined) { m += p.m - p.s; H += p.H; s += p.s; }
    return { m, H, s };
  }

  /** Gibt es einen schmelzbaren Körper oder noch nicht verteiltes Schmelzwasser? */
  any(): boolean {
    return this.e.bodies.list.some((b, q) => (!b.gone && meltsAt(b.mat) > 0) || (this.pending[q]?.m ?? 0) > 0);
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
      const p = this.pending[q];
      if (p !== undefined && p.m > 0) this.spawn(b, p);
    }
    return changed;
  }

  /* -- Ein Körper ----------------------------------------------------------------------------------- */

  /** Schmelzen und Anfrieren an allen freien Seiten eines Körpers; liefert, ob er seine Form änderte. */
  private body(b: Body2D): boolean {
    const rho = SOLIDS[b.mat].rho;
    const cp = SOLIDS[b.mat].cp;
    const e0 = latentPerKg(b.mat);
    /* Die Seiten mit einem freien Stück, ihr T_f und ob Fluid vor ihnen liegt; die Überschüsse jeder inneren Zelle an die nächste offene Seite. */
    const Tf = new Map<number, number>();
    const open = new Set<number>();
    for (let e = 0; e < b.nseg; e += 1) {
      const key = 4 * b.segR[e] + b.segS[e];
      if (!Tf.has(key)) Tf.set(key, this.freezingAt(b, b.segR[e], b.segS[e], open));
    }
    const Q = new Map<number, number>();
    for (let r = 0; r < b.nr; r += 1) this.excess(b, r, Tf, open, Q);
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
      this.edge(b, r, s, (k, len, free) => { if (free > 0) denom += free * len * (L + cp * (tf - Math.min(tf, b.cellT(k)))); });
      const plan = this.planFreeze(b, r, s, tf, L);
      side.set(key, { L, hIce, denom, plan });
      const w = wall.get(key) as number;
      sumQ.set(w, (sumQ.get(w) ?? 0) + (Q.get(key) ?? 0));
      sumD.set(w, (sumD.get(w) ?? 0) + denom);
      sumF.set(w, (sumF.get(w) ?? 0) + (plan?.total ?? 0));
      sumLen.set(w, (sumLen.get(w) ?? 0) + this.freeLength(b, r, s));
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

  /** Die Überschüsse über T_f der inneren Zellen des Rechtecks r, je an die nächste offene Seite (ohne offene: die nächste freie). */
  private excess(b: Body2D, r: number, Tf: Map<number, number>, open: Set<number>, Q: Map<number, number>): void {
    const sides: number[] = [];
    for (let s = 0; s < 4; s += 1) if (open.has(4 * r + s)) sides.push(s);
    if (sides.length === 0) for (let s = 0; s < 4; s += 1) if (Tf.has(4 * r + s)) sides.push(s);
    if (sides.length === 0) return;
    let lowest = Infinity;
    for (const s of sides) lowest = Math.min(lowest, Tf.get(4 * r + s) as number);
    const xs = b.xs[r];
    const ys = b.ys[r];
    const ni = b.ni[r];
    const nj = b.nj[r];
    for (let q = 0; q < nj; q += 1) {
      for (let p = 0; p < ni; p += 1) {
        const k = b.off[r] + p + q * ni;
        const T = b.cellT(k);
        if (!(T > lowest)) continue;
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

  /**
   * Die inneren Randzellen der Seite s des Rechtecks r: je Zelle ihre Länge
   * längs der Seite und der Anteil davon, der frei liegt (nicht in einer Fuge).
   */
  private edge(b: Body2D, r: number, s: number, fn: (k: number, len: number, free: number) => void): void {
    const ni = b.ni[r];
    const nj = b.nj[r];
    const along = s < 2 ? nj : ni;
    for (let t = 0; t < along; t += 1) {
      const p = s === 0 ? 0 : s === 1 ? ni - 1 : t;
      const q = s === 2 ? 0 : s === 3 ? nj - 1 : t;
      const k = b.off[r] + p + q * ni;
      const lo = s < 2 ? b.ys[r][q] : b.xs[r][p];
      const hi = s < 2 ? b.ys[r][q + 1] : b.xs[r][p + 1];
      let free = 0;
      for (let e = 0; e < b.nseg; e += 1) {
        if (b.segR[e] !== r || b.segS[e] !== s) continue;
        free += Math.max(0, Math.min(hi, b.segT1[e]) - Math.max(lo, b.segT0[e]));
      }
      fn(k, hi - lo, hi > lo ? free / (hi - lo) : 0);
    }
  }

  /** Länge der ganzen Seite s des Rechtecks r (m). */
  private sideLength(b: Body2D, r: number, s: number): number {
    const [x0, y0, x1, y1] = b.bounds(r);
    return s < 2 ? y1 - y0 : x1 - x0;
  }

  /** Freie Länge der Seite s des Rechtecks r (m). */
  private freeLength(b: Body2D, r: number, s: number): number {
    let len = 0;
    for (let e = 0; e < b.nseg; e += 1) if (b.segR[e] === r && b.segS[e] === s) len += b.segT1[e] - b.segT0[e];
    return len;
  }

  /** Die Seite von r mit der längsten freien Strecke (sonst oben). */
  private widestFree(b: Body2D, r: number): number {
    let best = 3;
    let len = 0;
    for (let s = 0; s < 4; s += 1) {
      const l = this.freeLength(b, r, s);
      if (l > len) { len = l; best = s; }
    }
    return best;
  }

  /** Der Gefrierpunkt vor der Seite s des Rechtecks r (K): aus dem Salz der Flüssigkeit in den Zellen davor (ohne Flüssigkeit: reines Wasser); liegt Fluid davor, kommt die Seite nach open. */
  private freezingAt(b: Body2D, r: number, s: number, open: Set<number>): number {
    const ex = this.e.exchange;
    let salt = 0;
    let water = 0;
    for (let e = 0; e < b.nseg; e += 1) {
      if (b.segR[e] !== r || b.segS[e] !== s) continue;
      this.samples(b, e, (c) => { salt += ex.salt[c]; water += ex.water[c]; open.add(4 * r + s); });
    }
    if (!(water > 0) || !(salt > 0)) return meltsAt(b.mat);
    return freezingPoint(salt / (water * M_S));
  }

  /**
   * Die Fluidzellen vor einem Seitenstück: knapp aussen und eine Zelle weiter
   * (der dünne Fluidteil einer gemischten Zelle hat oft kein Teilchen); dazu die
   * Zelle knapp innen, wenn sie Flüssigkeit enthält — alles nur, wo aussen
   * Fluid ist (an einer Wand gehört eine gemischte Zelle innen zur
   * Nachbarseite). Jede Zelle einmal je Lauf, mit der Länge, die auf sie fällt.
   */
  private samples(b: Body2D, e: number, fn: (c: number, len: number) => void, far = true): void {
    const g = this.e.grid;
    b.segment(e, this.sg);
    const sg = this.sg;
    const len = Math.hypot(sg[2] - sg[0], sg[3] - sg[1]);
    const n = Math.max(1, Math.ceil(len / (0.5 * g.dx)));
    const cs = Math.cos(b.a);
    const sn = Math.sin(b.a);
    const nwx = cs * sg[4] - sn * sg[5];
    const nwy = sn * sg[4] + cs * sg[5];
    const eps = 0.05 * g.dx;
    let last = -1;
    let lastIn = -1;
    let lastFar = -1;
    for (let q = 0; q < n; q += 1) {
      const t = (q + 0.5) / n;
      const lx = sg[0] + t * (sg[2] - sg[0]);
      const ly = sg[1] + t * (sg[3] - sg[1]);
      const wx = b.x + cs * lx - sn * ly;
      const wy = b.y + sn * lx + cs * ly;
      const out = g.cellAt(wx + eps * nwx, wy + eps * nwy);
      if (out < 0 || g.solid[out] !== 0) { last = out; continue; }
      if (out !== last) fn(out, len / n);
      last = out;
      if (far) {
        const fc = g.cellAt(wx + (g.dx + eps) * nwx, wy + (g.dx + eps) * nwy);
        if (fc >= 0 && fc !== out && fc !== lastFar && g.solid[fc] === 0) fn(fc, len / n);
        lastFar = fc;
      }
      const inn = g.cellAt(wx - eps * nwx, wy - eps * nwy);
      if (inn >= 0 && inn !== out && inn !== lastIn && g.solid[inn] === 0 && g.kind[inn] === LIQUID) fn(inn, len / n);
      lastIn = inn;
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
    for (let e = 0; e < b.nseg; e += 1) if (b.segR[e] === r && b.segS[e] === s) this.samples(b, e, each);
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
    this.edge(b, r, s, (k, len) => {
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
    this.give(b, r, s, m + film + crust, E + m * latentPerKg(b.mat) + Q, crust);
  }

  /** Die Seite s des Rechtecks r wächst um die Masse m (kg) nach aussen — die Dicke aus der jetzigen Länge der Seite; die Randzellen bekommen die Scheibe Eis bei T_f. */
  private grow(b: Body2D, r: number, s: number, m: number, Tf: number): void {
    const rho = SOLIDS[b.mat].rho;
    const cp = SOLIDS[b.mat].cp;
    const len = this.sideLength(b, r, s);
    const d = m / (rho * b.depth * len);
    this.edge(b, r, s, (k, l) => { b.E[k] += rho * l * d * b.depth * cp * (Tf - T0); });
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
    const len = this.sideLength(b, r, s);
    if (!(len > 0)) { b.E[b.off[r]] += Q; return; }
    this.edge(b, r, s, (k, l) => { b.E[k] += (Q * l) / len; });
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
      this.give(b, mv.r, mv.s, m + mF[q] + mK[q], mE[q] + m * e0 + mv.Q, mK[q]);
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

  /* -- Schmelzwasser -------------------------------------------------------------------------------- */

  /**
   * Schmelzwasser (Masse m samt Salz, Enthalpie H) an die Wasserteilchen vor
   * der Seite: nach ihrer Masse dazu (ein Teilchen über SPLIT Nennmassen teilt
   * sich); ohne Teilchen dort sammelt es sich (pending).
   */
  private give(b: Body2D, r: number, s: number, m: number, H: number, salt = 0): void {
    const g = this.e.grid;
    const P = this.e.particles;
    const L = this.e.liquid;
    const takers: number[] = [];
    const seen = new Set<number>();
    let wsum = 0;
    /* Erst die Zellen direkt vor der Seite; nur wenn dort kein Wasserteilchen ist, auch die nächste Lage. */
    for (let pass = 0; pass < 2 && takers.length === 0; pass += 1) {
      for (let e = 0; e < b.nseg; e += 1) {
        if (b.segR[e] !== r || b.segS[e] !== s) continue;
        this.samples(b, e, (c) => {
          if (g.kind[c] !== LIQUID || seen.has(c)) return;
          seen.add(c);
          this.inCell(c, (p) => { if (P.mat[p] === WATER) { takers.push(p); wsum += P.mass[p]; } });
        }, pass === 1);
      }
    }
    if (takers.length === 0 || !(wsum > 0)) {
      this.hold(b, r, s, m, H, salt);
      return;
    }
    const nominal = (L.rhoRef * g.vCell) / 4;
    for (const p of takers) {
      const share = P.mass[p] / wsum;
      const before = P.mass[p] / P.rho[p];
      const Hp = P.mass[p] * P.h[p] + share * H;
      P.mass[p] += share * m;
      if (salt > 0) { P.smass[2 * p] += share * salt; P.spc[2 * p] = NACL; }
      P.h[p] = Hp / P.mass[p];
      P.derive(p);
      L.dVp[p] += P.mass[p] / P.rho[p] - before;
      if (P.mass[p] > SPLIT * nominal) this.split(p);
    }
  }

  /** Ein schweres Teilchen in zwei gleiche teilen (das neue ein Viertel Zelle daneben, nicht in einem Körper oder Bau). */
  private split(p: number): void {
    const P = this.e.particles;
    const L = this.e.liquid;
    const g = this.e.grid;
    const side = P.id[p] % 2 === 0 ? 1 : -1;
    let x = NaN;
    for (const sg of [side, -side]) {
      const cx = Math.min(g.w - 1e-6, Math.max(1e-6, P.x[p] + 0.25 * g.dx * sg));
      const c = g.cellAt(cx, P.y[p]);
      if (c >= 0 && g.solid[c] === 0 && this.e.bodies.bodyAt(cx, P.y[p], 0) === null) { x = cx; break; }
    }
    if (Number.isNaN(x)) return;
    const half = 0.5 * P.mass[p];
    const s = 0.5 * P.smass[2 * p];
    const q = P.add(x, P.y[p], half, P.h[p], P.mat[p], s);
    if (q < 0) return;
    P.mass[p] = half;
    P.smass[2 * p] = s;
    P.derive(p);
    P.vx[q] = P.vx[p];
    P.vy[q] = P.vy[p];
    L.placeParticle(q);
  }

  /** Schmelzwasser ohne Teilchen davor sammeln (je Körper, mit dem Ort der Seite). */
  private hold(b: Body2D, r: number, s: number, m: number, H: number, salt = 0): void {
    const [x0, y0, x1, y1] = b.bounds(r);
    const lx = s === 0 ? x0 : s === 1 ? x1 : 0.5 * (x0 + x1);
    const ly = s === 2 ? y0 : s === 3 ? y1 : 0.5 * (y0 + y1);
    const nlx = s === 0 ? -1 : s === 1 ? 1 : 0;
    const nly = s === 2 ? -1 : s === 3 ? 1 : 0;
    const c = Math.cos(b.a);
    const sn = Math.sin(b.a);
    const p = this.pending[b.index] ?? (this.pending[b.index] = { m: 0, H: 0, s: 0, x: 0, y: 0, nx: 0, ny: 1 });
    p.m += m;
    p.H += H;
    p.s += salt;
    p.x = b.x + c * lx - sn * ly;
    p.y = b.y + sn * lx + c * ly;
    p.nx = c * nlx - sn * nly;
    p.ny = sn * nlx + c * nly;
  }

  /** Gesammeltes Schmelzwasser wird ein Teilchen vor der Seite (oder am nächsten freien Ort), sobald es SPAWN Nennmassen erreicht (ist der Körper weg, sofort). */
  private spawn(b: Body2D, p: Pending): void {
    const g = this.e.grid;
    const P = this.e.particles;
    const L = this.e.liquid;
    const nominal = (L.rhoRef * g.vCell) / 4;
    if (p.m < SPAWN * nominal && !b.gone) return;
    const at = this.freeSpot(p.x + 0.3 * g.dx * p.nx, p.y + 0.3 * g.dx * p.ny);
    if (at === null) return;
    const q = P.add(at[0], at[1], p.m, p.H / p.m, WATER, p.s);
    if (q < 0) return;
    P.vx[q] = b.gone ? 0 : b.vx;
    P.vy[q] = b.gone ? 0 : b.vy;
    L.placeParticle(q);
    L.dVp[q] = p.m / P.rho[q];
    p.m = 0;
    p.H = 0;
    p.s = 0;
  }

  /** Ein Ort in Fluid (in der Kiste, nicht in einem Bau oder Körper) bei (x, y): dort, sonst in Ringen von Zellen bis drei weit, oben zuerst. */
  private freeSpot(x: number, y: number): [number, number] | null {
    const g = this.e.grid;
    const ok = (px: number, py: number): boolean => {
      if (!(px > 0 && py > 0 && px < g.w && py < g.h)) return false;
      const c = g.cellAt(px, py);
      return c >= 0 && g.solid[c] === 0 && this.e.bodies.bodyAt(px, py, 0) === null;
    };
    if (ok(x, y)) return [x, y];
    for (let ring = 1; ring <= 3; ring += 1) {
      for (let j = ring; j >= -ring; j -= 1) {
        for (let i = -ring; i <= ring; i += 1) {
          if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
          if (ok(x + i * g.dx, y + j * g.dx)) return [x + i * g.dx, y + j * g.dx];
        }
      }
    }
    return null;
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
      this.give(b, r, this.widestFree(b, r), m + F + K, E + m * e0, K);
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
