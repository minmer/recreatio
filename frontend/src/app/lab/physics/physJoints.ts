/**
 * 2026-10-18 — VERBINDUNGEN (Fizyka 2D): was Körper zusammenhält.
 *
 * <code>
 *   pin      ein Gelenk: zwei Punkte bleiben aufeinander (eine Achse, ein Nagel in der Wand) — mit Motor: ein Rad, das sich dreht
 *   rod      eine Stange: der Abstand bleibt gleich (Wahadło auf pręcie)
 *   rope     ein Seil: höchstens so lang (es zieht, schiebt nie — durchhängend, wenn es locker ist)
 *   spring   eine Feder: Hooke (F = k·Δl) mit Dämpfung — als Kraft, damit sie schwingt, wie eine Feder schwingt
 *   pulley   ein Seil über zwei Rollen: was die eine Seite gewinnt, verliert die andere (maszyna Atwooda)
 *   mouse    der Finger: zieht weich an dem Punkt, an dem man das Ding gefasst hat
 * </code>
 *
 * Gelöst werden sie mit Impulsen im selben Durchgang wie die Berührungen
 * (`physCollide.ts`); ein Körper ohne Partner hängt an der Welt (`ground`).
 */

import type { Body } from './physBody';

const BETA = 0.2;

export type JointKind = 'pin' | 'rod' | 'rope' | 'spring' | 'pulley' | 'mouse';

/** Was alle Verbindungen gemeinsam haben — und was zum Zeichnen gebraucht wird. */
export abstract class Joint {
  abstract readonly kind: JointKind;
  /** Die Ankerpunkte in der Welt (nach `prestep`) — fürs Zeichnen. */
  pax = 0;
  pay = 0;
  pbx = 0;
  pby = 0;
  /** Die Kraft im Seil, in der Stange, in der Feder (N) — für die Anzeige. */
  tension = 0;

  constructor(readonly id: string, readonly a: Body, readonly b: Body, readonly la: readonly [number, number], readonly lb: readonly [number, number]) {}

  /** Federn: Kräfte vor dem Schritt. */
  force(): void { /* nur Federn */ }
  abstract prestep(h: number): void;
  abstract solve(): void;

  protected anchors(): { rax: number; ray: number; rbx: number; rby: number } {
    const ca = Math.cos(this.a.a); const sa = Math.sin(this.a.a);
    const cb = Math.cos(this.b.a); const sb = Math.sin(this.b.a);
    const rax = ca * this.la[0] - sa * this.la[1];
    const ray = sa * this.la[0] + ca * this.la[1];
    const rbx = cb * this.lb[0] - sb * this.lb[1];
    const rby = sb * this.lb[0] + cb * this.lb[1];
    this.pax = this.a.x + rax; this.pay = this.a.y + ray;
    this.pbx = this.b.x + rbx; this.pby = this.b.y + rby;
    return { rax, ray, rbx, rby };
  }
}

/** Einen Impuls (px, py) am Hebel r: auf B positiv, auf A negativ. */
function push(a: Body, b: Body, px: number, py: number, rax: number, ray: number, rbx: number, rby: number): void {
  a.vx -= a.invM * px; a.vy -= a.invM * py; a.w -= a.invI * (rax * py - ray * px);
  b.vx += b.invM * px; b.vy += b.invM * py; b.w += b.invI * (rbx * py - rby * px);
}

/* -- Gelenk (mit Motor) ---------------------------------------------------------------------- */

export class PinJoint extends Joint {
  readonly kind = 'pin';
  private jx = 0;
  private jy = 0;
  private jm = 0;
  private m11 = 0; private m12 = 0; private m22 = 0;
  private rax = 0; private ray = 0; private rbx = 0; private rby = 0;
  private bx = 0; private by = 0;
  private h = 1 / 120;

  constructor(id: string, a: Body, b: Body, la: readonly [number, number], lb: readonly [number, number],
    /** Motor: Ziel-Winkelgeschwindigkeit (rad/s) und das grösste Drehmoment (N·m) — `torque` 0: kein Motor. */
    public speed = 0, public torque = 0) {
    super(id, a, b, la, lb);
  }

  prestep(h: number): void {
    this.h = h;
    const { rax, ray, rbx, rby } = this.anchors();
    this.rax = rax; this.ray = ray; this.rbx = rbx; this.rby = rby;
    const a = this.a; const b = this.b;
    const k11 = a.invM + b.invM + a.invI * ray * ray + b.invI * rby * rby;
    const k12 = -a.invI * rax * ray - b.invI * rbx * rby;
    const k22 = a.invM + b.invM + a.invI * rax * rax + b.invI * rbx * rbx;
    const det = k11 * k22 - k12 * k12;
    const inv = det !== 0 ? 1 / det : 0;
    this.m11 = k22 * inv; this.m12 = -k12 * inv; this.m22 = k11 * inv;
    this.bx = (BETA / h) * (this.pbx - this.pax);
    this.by = (BETA / h) * (this.pby - this.pay);
    push(a, b, this.jx, this.jy, rax, ray, rbx, rby);
    a.w -= a.invI * this.jm; b.w += b.invI * this.jm;
  }

  solve(): void {
    const a = this.a; const b = this.b;
    if (this.torque > 0) {
      const k = a.invI + b.invI;
      if (k > 0) {
        const cdot = b.w - a.w - this.speed;
        const lim = this.torque * this.h;
        const old = this.jm;
        this.jm = Math.max(-lim, Math.min(lim, this.jm - cdot / k));
        const d = this.jm - old;
        a.w -= a.invI * d; b.w += b.invI * d;
      }
    }
    const cx = b.vx - b.w * this.rby - a.vx + a.w * this.ray + this.bx;
    const cy = b.vy + b.w * this.rbx - a.vy - a.w * this.rax + this.by;
    const px = -(this.m11 * cx + this.m12 * cy);
    const py = -(this.m12 * cx + this.m22 * cy);
    this.jx += px; this.jy += py;
    push(a, b, px, py, this.rax, this.ray, this.rbx, this.rby);
    this.tension = Math.hypot(this.jx, this.jy) / this.h;
  }
}

/* -- Stange und Seil ------------------------------------------------------------------------- */

export class RodJoint extends Joint {
  kind: 'rod' | 'rope' = 'rod';
  private j = 0;
  private mass = 0;
  private ux = 0; private uy = 0;
  private rax = 0; private ray = 0; private rbx = 0; private rby = 0;
  private bias = 0;
  private active = true;
  private h = 1 / 120;

  constructor(id: string, a: Body, b: Body, la: readonly [number, number], lb: readonly [number, number], public length: number, rope: boolean) {
    super(id, a, b, la, lb);
    if (rope) this.kind = 'rope';
  }

  /** Wie weit die Anker gerade auseinander sind. */
  span(): number {
    return Math.hypot(this.pbx - this.pax, this.pby - this.pay);
  }

  prestep(h: number): void {
    this.h = h;
    const { rax, ray, rbx, rby } = this.anchors();
    this.rax = rax; this.ray = ray; this.rbx = rbx; this.rby = rby;
    const dx = this.pbx - this.pax;
    const dy = this.pby - this.pay;
    const len = Math.hypot(dx, dy);
    const c = len - this.length;
    this.active = this.kind === 'rod' || c > -1e-4;
    if (!this.active || len < 1e-9) { this.j = 0; this.mass = 0; this.tension = 0; return; }
    this.ux = dx / len; this.uy = dy / len;
    const a = this.a; const b = this.b;
    const rna = rax * this.uy - ray * this.ux;
    const rnb = rbx * this.uy - rby * this.ux;
    const k = a.invM + b.invM + a.invI * rna * rna + b.invI * rnb * rnb;
    this.mass = k > 0 ? 1 / k : 0;
    this.bias = (BETA / h) * c;
    push(a, b, this.j * this.ux, this.j * this.uy, rax, ray, rbx, rby);
  }

  solve(): void {
    if (!this.active || this.mass === 0) return;
    const a = this.a; const b = this.b;
    const vx = b.vx - b.w * this.rby - a.vx + a.w * this.ray;
    const vy = b.vy + b.w * this.rbx - a.vy - a.w * this.rax;
    const cdot = vx * this.ux + vy * this.uy;
    let d = -this.mass * (cdot + this.bias);
    if (this.kind === 'rope') {
      const old = this.j;
      this.j = Math.min(0, this.j + d);
      d = this.j - old;
    } else {
      this.j += d;
    }
    push(a, b, d * this.ux, d * this.uy, this.rax, this.ray, this.rbx, this.rby);
    this.tension = -this.j / this.h;
  }
}

/* -- Feder ----------------------------------------------------------------------------------- */

export class SpringJoint extends Joint {
  readonly kind = 'spring';

  constructor(id: string, a: Body, b: Body, la: readonly [number, number], lb: readonly [number, number],
    public length: number, public k: number, public damping: number) {
    super(id, a, b, la, lb);
  }

  /** Hooke und Dämpfung — als Kraft an beiden Ankern (mit dem Drehmoment, das sie dort haben). */
  force(): void {
    const { rax, ray, rbx, rby } = this.anchors();
    const dx = this.pbx - this.pax;
    const dy = this.pby - this.pay;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) return;
    const ux = dx / len;
    const uy = dy / len;
    const a = this.a; const b = this.b;
    const vx = b.vx - b.w * rby - a.vx + a.w * ray;
    const vy = b.vy + b.w * rbx - a.vy - a.w * rax;
    const f = this.k * (len - this.length) + this.damping * (vx * ux + vy * uy);
    this.tension = this.k * (len - this.length);
    if (!a.fixed) a.force(f * ux, f * uy, this.pax, this.pay);
    if (!b.fixed) b.force(-f * ux, -f * uy, this.pbx, this.pby);
  }

  prestep(): void { this.anchors(); }
  solve(): void { /* eine Kraft, kein Impuls */ }
}

/* -- Rolle ----------------------------------------------------------------------------------- */

export class PulleyJoint extends Joint {
  readonly kind = 'pulley';
  private j = 0;
  private mass = 0;
  private uax = 0; private uay = 0; private ubx = 0; private uby = 0;
  private rax = 0; private ray = 0; private rbx = 0; private rby = 0;
  private bias = 0;
  private active = true;
  private h = 1 / 120;
  /** Die Rollen (Welt): über sie läuft das Seil zu A und zu B. */
  constructor(id: string, a: Body, b: Body, la: readonly [number, number], lb: readonly [number, number],
    readonly gax: number, readonly gay: number, readonly gbx: number, readonly gby: number, public total: number) {
    super(id, a, b, la, lb);
  }

  prestep(h: number): void {
    this.h = h;
    const { rax, ray, rbx, rby } = this.anchors();
    this.rax = rax; this.ray = ray; this.rbx = rbx; this.rby = rby;
    const lax = this.pax - this.gax; const lay = this.pay - this.gay;
    const lbx = this.pbx - this.gbx; const lby = this.pby - this.gby;
    const la = Math.hypot(lax, lay) || 1e-9;
    const lb = Math.hypot(lbx, lby) || 1e-9;
    this.uax = lax / la; this.uay = lay / la;
    this.ubx = lbx / lb; this.uby = lby / lb;
    const a = this.a; const b = this.b;
    const ra = rax * this.uay - ray * this.uax;
    const rb = rbx * this.uby - rby * this.ubx;
    const k = a.invM + a.invI * ra * ra + b.invM + b.invI * rb * rb;
    this.mass = k > 0 ? 1 / k : 0;
    const c = this.total - la - lb;
    this.bias = c < 0 ? -(BETA / h) * c : 0;
    /* Locker (das Seil hängt durch): es zieht nicht. */
    this.active = c <= 1e-4;
    if (!this.active) { this.j = 0; this.tension = 0; return; }
    this.apply(this.j);
  }

  private apply(j: number): void {
    const a = this.a; const b = this.b;
    const pax = -j * this.uax; const pay = -j * this.uay;
    const pbx = -j * this.ubx; const pby = -j * this.uby;
    a.vx += a.invM * pax; a.vy += a.invM * pay; a.w += a.invI * (this.rax * pay - this.ray * pax);
    b.vx += b.invM * pbx; b.vy += b.invM * pby; b.w += b.invI * (this.rbx * pby - this.rby * pbx);
  }

  solve(): void {
    const a = this.a; const b = this.b;
    const vax = a.vx - a.w * this.ray; const vay = a.vy + a.w * this.rax;
    const vbx = b.vx - b.w * this.rby; const vby = b.vy + b.w * this.rbx;
    const cdot = -(vax * this.uax + vay * this.uay) - (vbx * this.ubx + vby * this.uby);
    if (!this.active) return;
    const old = this.j;
    this.j = Math.max(0, this.j + this.mass * (-cdot + this.bias));
    this.apply(this.j - old);
    this.tension = this.j / this.h;
  }
}

/* -- Der Finger ------------------------------------------------------------------------------- */

/** Zieht den gefassten Punkt weich zum Finger (eine gedämpfte Feder mit Höchstkraft) — so bleibt der Rest der Welt ruhig. */
export class MouseJoint extends Joint {
  readonly kind = 'mouse';
  tx = 0;
  ty = 0;
  private jx = 0;
  private jy = 0;
  private m11 = 0; private m12 = 0; private m22 = 0;
  private gamma = 0;
  private cx = 0;
  private cy = 0;
  private rax = 0; private ray = 0;
  private maxJ = 0;

  constructor(a: Body, ground: Body, la: readonly [number, number], tx: number, ty: number, private readonly g: number) {
    super('mouse', a, ground, la, [0, 0]);
    this.tx = tx;
    this.ty = ty;
  }

  prestep(h: number): void {
    const a = this.a;
    const { rax, ray } = this.anchors();
    this.rax = rax; this.ray = ray;
    const omega = 2 * Math.PI * 4;
    const zeta = 0.8;
    const m = a.m;
    const d = 2 * m * zeta * omega;
    const k = m * omega * omega;
    this.gamma = 1 / (h * (d + h * k));
    const beta = h * k * this.gamma;
    const k11 = a.invM + a.invI * ray * ray + this.gamma;
    const k12 = -a.invI * rax * ray;
    const k22 = a.invM + a.invI * rax * rax + this.gamma;
    const det = k11 * k22 - k12 * k12;
    const inv = det !== 0 ? 1 / det : 0;
    this.m11 = k22 * inv; this.m12 = -k12 * inv; this.m22 = k11 * inv;
    this.cx = (this.pax - this.tx) * beta;
    this.cy = (this.pay - this.ty) * beta;
    this.maxJ = 60 * m * Math.max(this.g, 9.81) * h;
    this.jx *= 0.8; this.jy *= 0.8;
    a.vx += a.invM * this.jx; a.vy += a.invM * this.jy; a.w += a.invI * (rax * this.jy - ray * this.jx);
    this.pbx = this.tx; this.pby = this.ty;
  }

  solve(): void {
    const a = this.a;
    const vx = a.vx - a.w * this.ray + this.cx + this.gamma * this.jx;
    const vy = a.vy + a.w * this.rax + this.cy + this.gamma * this.jy;
    let px = -(this.m11 * vx + this.m12 * vy);
    let py = -(this.m12 * vx + this.m22 * vy);
    const ox = this.jx; const oy = this.jy;
    this.jx += px; this.jy += py;
    const len = Math.hypot(this.jx, this.jy);
    if (len > this.maxJ) { this.jx *= this.maxJ / len; this.jy *= this.maxJ / len; }
    px = this.jx - ox; py = this.jy - oy;
    a.vx += a.invM * px; a.vy += a.invM * py; a.w += a.invI * (this.rax * py - this.ray * px);
  }
}
