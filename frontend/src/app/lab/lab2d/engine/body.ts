/**
 * LABOR 2D (v2) — EIN KÖRPER (M3a; seit 2026-10-23 aus Rechtecken, nicht aus
 * Zellen): ein Ding als Ganzes — eine Zlewka, eine Heizplatte, ein Holzklotz,
 * ein Eiswürfel. Er besteht aus Rechtecken in seinem eigenen Rahmen, genau in
 * Metern (nicht auf das Gitter gerundet); eine Zlewka aus drei (Boden und zwei
 * Wände, die auf ihm stehen; mit Deckel vier), alles andere aus einem. Ein
 * Körper ist aus einem Stoff.
 *
 * Innen ist ein Rechteck fest und bleibt ein Rechteck: es ändert sich nur, wenn
 * es schmilzt oder Eis anfriert, und dann rückt eine ganze Seite (bodyMelt.ts).
 * Für die Wärme hat jedes Rechteck eigene innere Zellen — etwa so gross wie die
 * des Gitters, aber genau in das Rechteck gelegt (Spalten- und Zeilengrenzen xs,
 * ys; eine schmelzende Seite macht ihre Randreihe dünner) — mit Energie (J,
 * fühlbar, samt Wasserfilm und Salzkruste), Film und Kruste (kg). Wie sie mit
 * den Zellen des Gitters verbunden sind, steht in bodyCover.ts.
 *
 * Der eigene Rahmen hat seinen Ursprung im Schwerpunkt; in der Welt liegt ein
 * Punkt L des Rahmens bei (x, y) + R(a)·L. Ändert sich die Masse (Schmelzen,
 * Radieren), rückt der Schwerpunkt; die Lage wird so nachgeführt, dass nichts
 * springt. Alles hier sind Zahlen und typisierte Felder: ein Schlüsselbild
 * (clip/snapshot.ts) nimmt einen Körper so auf, wie er ist.
 */

import { hull, type Pt } from '../../physics/physShapes';
import { cpL, hL, SOLIDS } from './materials';
import { CP_CRYSTAL, H_MELT, T_MELT } from './solution';
import { T0 } from './units';

/** Rechtecke, die sich so nah berühren (Anteil der Zellkante), gelten als verbunden (eine Fuge, keine freie Seite). */
const JOIN = 1e-6;

/** Ein Rechteck in Weltkoordinaten (ungedreht): x0, y0, x1, y1. */
export type RectWorld = readonly [number, number, number, number];

/** Schmilzt der Werkstoff (Eis zu Wasser)? Seine Schmelztemperatur (K), sonst NaN. */
export function meltsAt(mat: number): number {
  return SOLIDS[mat]?.id === 'ice' ? T_MELT : NaN;
}

/**
 * Versatz der Energie eines schmelzenden Stoffs je kg (J/kg): die inneren
 * Zellen führen nur die fühlbare Energie c_p (T − 0 °C); damit Eis bei T_m zu
 * Wasser bei T_m genau die Schmelzenthalpie braucht, zählt die Bilanz je kg
 * Eis e0 = h_l(T_m) − c_p,Eis (T_m − 0 °C) − Δh_Schmelz dazu (IAPWS R10-06).
 */
export function latentPerKg(mat: number): number {
  if (!(meltsAt(mat) > 0)) return 0;
  return hL(T_MELT) - SOLIDS[mat].cp * (T_MELT - T0) - H_MELT;
}

/** Energie eines Feststoffanteils bei T (die Umkehrung von solidTemperature). */
export function solidEnergy(C: number, film: number, crust: number, T: number): number {
  return (C + crust * CP_CRYSTAL) * (T - T0) + film * hL(T);
}

/** Temperatur eines Feststoffanteils aus seiner Energie E: (C + m_Kruste c_Kristall)(T − T0) + m_Film h_l(T) = E. */
export function solidTemperature(E: number, C: number, film: number, crust: number, guess: number): number {
  const cs = C + crust * CP_CRYSTAL;
  if (!(cs > 0)) return guess;
  if (film <= 0) return T0 + E / cs;
  let T = guess > 100 ? guess : T0 + E / cs;
  for (let it = 0; it < 3; it += 1) T -= (cs * (T - T0) + film * hL(T) - E) / (cs + film * cpL(T));
  return T;
}

export class Body2D {
  /** Werkstoff (Index in SOLIDS), Heizgruppe (−1: keine). */
  mat = 0;
  heater = -1;
  /** Rechtecke: Grenzen der Spalten (ni + 1 Werte) und Zeilen (nj + 1) im eigenen Rahmen (m, relativ zum Schwerpunkt). */
  nr = 0;
  xs: Float64Array[] = [];
  ys: Float64Array[] = [];
  /** Innere Zellen: Rechteck r hat ni[r] × nj[r] Zellen ab off[r] (Zelle p + q·ni). */
  ni: Int32Array = new Int32Array(0);
  nj: Int32Array = new Int32Array(0);
  off: Int32Array = new Int32Array(0);
  ncell = 0;
  /** Je innere Zelle: Energie (J, fühlbar: samt Film mit h_l(T) und Kruste), Wasserfilm und Salzkruste (kg). */
  E: Float64Array = new Float64Array(0);
  film: Float64Array = new Float64Array(0);
  crust: Float64Array = new Float64Array(0);
  /** Lage in der Welt: Schwerpunkt und Winkel (rad, gegen den Uhrzeigersinn); Geschwindigkeit. */
  x = 0;
  y = 0;
  a = 0;
  vx = 0;
  vy = 0;
  w = 0;
  /** Die Geschwindigkeit, mit der die Flüssigkeit den Körper in diesem Schritt sah (Randwert der Projektionen). */
  ux = 0;
  uy = 0;
  uw = 0;
  /** Masse (kg) und Trägheitsmoment um den Schwerpunkt (kg·m²). */
  m = 0;
  I = 0;
  /** Mitbewegte Masse und Trägheit der Flüssigkeit (Schätzung für den ersten Schritt nach dem Aufwachen, bodyForces.ts). */
  ma = 0;
  Ia = 0;
  /** Die mitbewegte Masse, wie die Projektion sie sieht (bodies.ts): symmetrische 3 × 3-Matrix (x, y, Drehung) als m00, m01, m02, m11, m12, m22; gilt, wenn maOk. */
  ma6: Float64Array = new Float64Array(6);
  maOk = false;
  /** Angeheftet (unendlich schwer, bewegt sich nie), schlafend (bewegt sich nicht, bis ihn etwas weckt), nicht mehr da. */
  pinned = true;
  asleep = true;
  gone = false;
  /** Wie lange er schon ruht (s) — ab einer halben Sekunde schläft er ein. */
  rest = 0;
  /** Lage beim letzten Abdecken des Gitters (bodyCover.ts): für das Hinausschieben der Teilchen auf ihrem Weg. */
  rx = 0;
  ry = 0;
  ra = 0;
  /** Weiteste Ecke vom Schwerpunkt (m); konvexe Hülle: Fläche (m²) und Flächenträgheitsmoment (m⁴) — für die mitbewegte Masse. */
  rmax = 0;
  hullA = 0;
  hullJ = 0;
  /** Freie Seitenstücke (nicht in einer Fuge): Rechteck, Seite (0 links, 1 rechts, 2 unten, 3 oben), Lage längs der Seite von t0 bis t1 (im eigenen Rahmen). */
  nseg = 0;
  segR: Int32Array = new Int32Array(0);
  segS: Uint8Array = new Uint8Array(0);
  segT0: Float64Array = new Float64Array(0);
  segT1: Float64Array = new Float64Array(0);
  /** Gewichte innere Zelle → Gitterzelle (bodyCover.ts): Anteil der Fläche der inneren Zelle k in der Gitterzelle c. */
  nw = 0;
  wk: Int32Array = new Int32Array(0);
  wc: Int32Array = new Int32Array(0);
  ww: Float64Array = new Float64Array(0);

  constructor(readonly index: number, public key: number, readonly dx: number, readonly depth: number) {}

  get free(): boolean { return !this.pinned && !this.gone; }
  get awake(): boolean { return !this.pinned && !this.asleep && !this.gone; }

  /* -- Entstehen ---------------------------------------------------------------------------------- */

  /**
   * Ein Körper aus Rechtecken der Welt (ungedreht, sie dürfen sich nur an
   * Seiten berühren), Werkstoff s, Temperatur T (K), Heizgruppe; die inneren
   * Zellen etwa Δx gross. Lage ungedreht (der Aufrufer dreht ihn danach).
   */
  static fromRects(index: number, key: number, dx: number, depth: number, mat: number, rects: readonly RectWorld[], T: number, heater = -1): Body2D {
    const b = new Body2D(index, key, dx, depth);
    b.mat = mat;
    b.heater = heater;
    const xs: Float64Array[] = [];
    const ys: Float64Array[] = [];
    for (const [x0, y0, x1, y1] of rects) {
      if (!(x1 > x0) || !(y1 > y0)) continue;
      xs.push(Body2D.splits(x0, x1, dx));
      ys.push(Body2D.splits(y0, y1, dx));
    }
    b.setRects(xs, ys);
    const s = SOLIDS[mat];
    for (let k = 0; k < b.ncell; k += 1) b.E[k] = s.rho * s.cp * b.cellVolume(k) * (T - T0);
    /* Der Rahmen lag beim Anlegen im Ursprung der Welt: derive() rückt ihn in den Schwerpunkt und die Lage mit. */
    b.derive();
    b.rx = b.x;
    b.ry = b.y;
    b.ra = 0;
    return b;
  }

  /** Grenzen von a bis b in gleich grosse Stücke von etwa d (wenigstens eins). */
  static splits(a: number, b: number, d: number): Float64Array {
    const n = Math.max(1, Math.round((b - a) / d));
    const out = new Float64Array(n + 1);
    for (let k = 0; k <= n; k += 1) out[k] = a + ((b - a) * k) / n;
    out[n] = b;
    return out;
  }

  /** Die Rechtecke setzen (die Felder werden übernommen); Energie, Film und Kruste neu und leer. */
  setRects(xs: Float64Array[], ys: Float64Array[]): void {
    this.nr = xs.length;
    this.xs = xs;
    this.ys = ys;
    this.ni = new Int32Array(this.nr);
    this.nj = new Int32Array(this.nr);
    this.off = new Int32Array(this.nr);
    let n = 0;
    for (let r = 0; r < this.nr; r += 1) {
      this.ni[r] = xs[r].length - 1;
      this.nj[r] = ys[r].length - 1;
      this.off[r] = n;
      n += this.ni[r] * this.nj[r];
    }
    this.ncell = n;
    this.E = new Float64Array(n);
    this.film = new Float64Array(n);
    this.crust = new Float64Array(n);
  }

  /** Alle Grenzen um (dx, dy) verschieben: der Ursprung des Rahmens rückt um (dx, dy) — die Lage in der Welt nicht. */
  private shiftFrame(dx: number, dy: number): void {
    for (let r = 0; r < this.nr; r += 1) {
      const xs = this.xs[r];
      const ys = this.ys[r];
      for (let k = 0; k < xs.length; k += 1) xs[k] -= dx;
      for (let k = 0; k < ys.length; k += 1) ys[k] -= dy;
    }
  }

  /* -- Zellen ------------------------------------------------------------------------------------- */

  /** Das Rechteck der inneren Zelle k (Index des Rechtecks; p, q in out[0], out[1]). */
  rectOf(k: number, out?: Int32Array): number {
    let r = this.nr - 1;
    while (r > 0 && this.off[r] > k) r -= 1;
    if (out !== undefined) {
      const local = k - this.off[r];
      out[0] = local % this.ni[r];
      out[1] = (local - out[0]) / this.ni[r];
    }
    return r;
  }

  private readonly pq = new Int32Array(2);

  /** Grenzen der inneren Zelle k im eigenen Rahmen: x0, y0, x1, y1 (in out). */
  cellBox(k: number, out: Float64Array): void {
    const r = this.rectOf(k, this.pq);
    const p = this.pq[0];
    const q = this.pq[1];
    out[0] = this.xs[r][p];
    out[1] = this.ys[r][q];
    out[2] = this.xs[r][p + 1];
    out[3] = this.ys[r][q + 1];
  }

  /** Volumen der inneren Zelle k (m³). */
  cellVolume(k: number): number {
    const r = this.rectOf(k, this.pq);
    const p = this.pq[0];
    const q = this.pq[1];
    return (this.xs[r][p + 1] - this.xs[r][p]) * (this.ys[r][q + 1] - this.ys[r][q]) * this.depth;
  }

  /** Wärmekapazität des Stoffs der inneren Zelle k ohne Film und Kruste (J/K). */
  cellCap(k: number): number {
    const s = SOLIDS[this.mat];
    return s.rho * s.cp * this.cellVolume(k);
  }

  /** Temperatur der inneren Zelle k (K). */
  cellT(k: number): number {
    return solidTemperature(this.E[k], this.cellCap(k), this.film[k], this.crust[k], 293.15);
  }

  /** Die innere Zelle an einem Punkt des eigenen Rahmens (−1: keine). */
  cellAtLocal(lx: number, ly: number): number {
    for (let r = 0; r < this.nr; r += 1) {
      const xs = this.xs[r];
      const ys = this.ys[r];
      const ni = this.ni[r];
      const nj = this.nj[r];
      if (lx < xs[0] || lx > xs[ni] || ly < ys[0] || ly > ys[nj]) continue;
      let p = 0;
      while (p < ni - 1 && lx > xs[p + 1]) p += 1;
      let q = 0;
      while (q < nj - 1 && ly > ys[q + 1]) q += 1;
      return this.off[r] + p + q * ni;
    }
    return -1;
  }

  /** Liegt ein Punkt des eigenen Rahmens in einem der Rechtecke (mit dem Rand m nach aussen)? */
  insideLocal(lx: number, ly: number, m = 0): boolean {
    for (let r = 0; r < this.nr; r += 1) {
      const xs = this.xs[r];
      const ys = this.ys[r];
      if (lx >= xs[0] - m && lx <= xs[xs.length - 1] + m && ly >= ys[0] - m && ly <= ys[ys.length - 1] + m) return true;
    }
    return false;
  }

  /** Gesamtenergie (J): die inneren Zellen (fühlbar) und der Versatz eines schmelzenden Stoffs (latentOffset). */
  energy(): number {
    let E = 0;
    for (let k = 0; k < this.ncell; k += 1) E += this.E[k];
    return E + this.latentOffset();
  }

  /** Der Versatz eines schmelzenden Stoffs (J): Masse · e0 (latentPerKg); 0 sonst. */
  latentOffset(): number {
    const e0 = latentPerKg(this.mat);
    return e0 !== 0 ? e0 * this.m : 0;
  }

  /** Wasserfilm und Salzkruste aller inneren Zellen (kg). */
  filmMass(): number { let s = 0; for (let k = 0; k < this.ncell; k += 1) s += this.film[k]; return s; }
  crustMass(): number { let s = 0; for (let k = 0; k < this.ncell; k += 1) s += this.crust[k]; return s; }

  /** Mittlere Temperatur (K, nach Wärmekapazität). */
  meanT(): number {
    let C = 0;
    let CT = 0;
    for (let k = 0; k < this.ncell; k += 1) { const c = this.cellCap(k); C += c; CT += c * this.cellT(k); }
    return C > 0 ? CT / C : 0;
  }

  /* -- Abgeleitetes ------------------------------------------------------------------------------- */

  /** Masse, Schwerpunkt, Trägheit, Hülle, freie Seiten; liegt der Schwerpunkt nicht im Ursprung des Rahmens, rückt der Rahmen hinein (die Welt bleibt). */
  derive(): void {
    if (this.nr === 0 || this.ncell === 0) { this.m = 0; this.I = 0; this.rmax = 0; this.nseg = 0; this.gone = true; return; }
    const rho = SOLIDS[this.mat].rho;
    const cx = this.moment(0);
    const cy = this.moment(1);
    if (cx !== 0 || cy !== 0) {
      this.shiftFrame(cx, cy);
      const c = Math.cos(this.a);
      const s = Math.sin(this.a);
      const ox = c * cx - s * cy;
      const oy = s * cx + c * cy;
      this.x += ox;
      this.y += oy;
      this.rx += ox;
      this.ry += oy;
    }
    let m = 0;
    let I = 0;
    let rmax = 0;
    const pts: Pt[] = [];
    for (let r = 0; r < this.nr; r += 1) {
      const [x0, y0, x1, y1] = this.bounds(r);
      const w = x1 - x0;
      const h = y1 - y0;
      const mr = rho * w * h * this.depth;
      const mx = 0.5 * (x0 + x1);
      const my = 0.5 * (y0 + y1);
      m += mr;
      I += mr * ((w * w + h * h) / 12 + mx * mx + my * my);
      for (const [px, py] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) {
        pts.push([px, py]);
        rmax = Math.max(rmax, Math.hypot(px, py));
      }
    }
    this.m = m;
    this.I = I;
    this.rmax = rmax;
    const H = hull(pts);
    let area = 0;
    let J = 0;
    for (let i = 0; i < H.length; i += 1) {
      const [x1, y1] = H[i];
      const [x2, y2] = H[(i + 1) % H.length];
      const cr = x1 * y2 - x2 * y1;
      area += cr / 2;
      J += (cr * (x1 * x1 + x1 * x2 + x2 * x2 + y1 * y1 + y1 * y2 + y2 * y2)) / 12;
    }
    this.hullA = Math.abs(area);
    this.hullJ = Math.abs(J);
    this.segments();
  }

  /** Flächenschwerpunkt der Rechtecke im jetzigen Rahmen, x (axis 0) oder y (m). */
  private moment(axis: number): number {
    let A = 0;
    let M = 0;
    for (let r = 0; r < this.nr; r += 1) {
      const [x0, y0, x1, y1] = this.bounds(r);
      const a = (x1 - x0) * (y1 - y0);
      A += a;
      M += a * (axis === 0 ? 0.5 * (x0 + x1) : 0.5 * (y0 + y1));
    }
    return A > 0 ? M / A : 0;
  }

  /** Die freien Seitenstücke: jede Seite jedes Rechtecks ohne die Stücke, an denen ein anderes Rechteck desselben Körpers anliegt. */
  private segments(): void {
    const R: number[] = [];
    const S: number[] = [];
    const T0s: number[] = [];
    const T1s: number[] = [];
    const tol = JOIN * this.dx;
    for (let r = 0; r < this.nr; r += 1) {
      const [x0, y0, x1, y1] = this.bounds(r);
      for (let s = 0; s < 4; s += 1) {
        /* Die Seite: fest in einer Koordinate (at), längs der anderen von lo bis hi. */
        const vertical = s < 2;
        const at = s === 0 ? x0 : s === 1 ? x1 : s === 2 ? y0 : y1;
        let parts: [number, number][] = [vertical ? [y0, y1] : [x0, x1]];
        for (let o = 0; o < this.nr && parts.length > 0; o += 1) {
          if (o === r) continue;
          const [ox0, oy0, ox1, oy1] = this.bounds(o);
          /* Liegt das andere Rechteck mit seiner Gegenseite an dieser Seite an? */
          const touch = s === 0 ? Math.abs(ox1 - at) <= tol : s === 1 ? Math.abs(ox0 - at) <= tol : s === 2 ? Math.abs(oy1 - at) <= tol : Math.abs(oy0 - at) <= tol;
          if (!touch) continue;
          const clo = vertical ? oy0 : ox0;
          const chi = vertical ? oy1 : ox1;
          const next: [number, number][] = [];
          for (const [a, b] of parts) {
            if (chi <= a || clo >= b) { next.push([a, b]); continue; }
            if (clo > a) next.push([a, clo]);
            if (chi < b) next.push([chi, b]);
          }
          parts = next;
        }
        for (const [a, b] of parts) {
          if (b - a <= tol) continue;
          R.push(r);
          S.push(s);
          T0s.push(a);
          T1s.push(b);
        }
      }
    }
    this.nseg = R.length;
    this.segR = Int32Array.from(R);
    this.segS = Uint8Array.from(S);
    this.segT0 = Float64Array.from(T0s);
    this.segT1 = Float64Array.from(T1s);
  }

  /** Aussenmasse des Rechtecks r im eigenen Rahmen: x0, y0, x1, y1. */
  bounds(r: number): [number, number, number, number] {
    return [this.xs[r][0], this.ys[r][0], this.xs[r][this.ni[r]], this.ys[r][this.nj[r]]];
  }

  /** Ein Seitenstück als Strecke im eigenen Rahmen: Anfang (ax, ay), Ende (bx, by), Aussennormale (nx, ny) — in out[0..5]. */
  segment(e: number, out: Float64Array): void {
    const [x0, y0, x1, y1] = this.bounds(this.segR[e]);
    const s = this.segS[e];
    const t0 = this.segT0[e];
    const t1 = this.segT1[e];
    if (s === 0) { out[0] = x0; out[1] = t0; out[2] = x0; out[3] = t1; out[4] = -1; out[5] = 0; }
    else if (s === 1) { out[0] = x1; out[1] = t0; out[2] = x1; out[3] = t1; out[4] = 1; out[5] = 0; }
    else if (s === 2) { out[0] = t0; out[1] = y0; out[2] = t1; out[3] = y0; out[4] = 0; out[5] = -1; }
    else { out[0] = t0; out[1] = y1; out[2] = t1; out[3] = y1; out[4] = 0; out[5] = 1; }
  }

  /* -- Lage --------------------------------------------------------------------------------------- */

  /** Welt → eigener Rahmen (relativ zum Schwerpunkt), bei der Lage (x, y, a). */
  static toLocal(x: number, y: number, a: number, wx: number, wy: number, out: Float64Array): void {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const dx = wx - x;
    const dy = wy - y;
    out[0] = c * dx + s * dy;
    out[1] = -s * dx + c * dy;
  }

  /** Eigener Rahmen (relativ zum Schwerpunkt) → Welt, bei der Lage (x, y, a). */
  static toWorld(x: number, y: number, a: number, lx: number, ly: number, out: Float64Array): void {
    const c = Math.cos(a);
    const s = Math.sin(a);
    out[0] = x + c * lx - s * ly;
    out[1] = y + s * lx + c * ly;
  }

  /** Um einen Punkt der Welt drehen (Winkel θ, rad) — für Körper, die schräg entstehen. */
  rotateAbout(px: number, py: number, theta: number): void {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const dx = this.x - px;
    const dy = this.y - py;
    this.x = px + c * dx - s * dy;
    this.y = py + s * dx + c * dy;
    this.a += theta;
  }

  /** Höchste Geschwindigkeit eines Punkts des Körpers (m/s). */
  speed(): number {
    return Math.hypot(this.vx, this.vy) + Math.abs(this.w) * this.rmax;
  }

  /** Bewegungsenergie (J). */
  kinetic(): number {
    return 0.5 * this.m * (this.vx * this.vx + this.vy * this.vy) + 0.5 * this.I * this.w * this.w;
  }

  /** Umgrenzung in der Welt (x0, y0, x1, y1) bei der Lage (x, y, a) — über die Ecken der Rechtecke. */
  worldBox(x: number, y: number, a: number, out: Float64Array): void {
    const c = Math.cos(a);
    const s = Math.sin(a);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let r = 0; r < this.nr; r += 1) {
      const [bx0, by0, bx1, by1] = this.bounds(r);
      for (let q = 0; q < 4; q += 1) {
        const lx = q === 0 || q === 3 ? bx0 : bx1;
        const ly = q < 2 ? by0 : by1;
        const wx = x + c * lx - s * ly;
        const wy = y + s * lx + c * ly;
        if (wx < x0) x0 = wx;
        if (wx > x1) x1 = wx;
        if (wy < y0) y0 = wy;
        if (wy > y1) y1 = wy;
      }
    }
    out[0] = x0;
    out[1] = y0;
    out[2] = x1;
    out[3] = y1;
  }
}
