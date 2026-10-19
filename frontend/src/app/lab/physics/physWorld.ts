/**
 * 2026-10-18 — DIE WELT DER FIZYKA 2D: Körper, Verbindungen, Becken mit
 * Flüssigkeit, Rohre und Tropfen — und ein Schritt der Zeit.
 *
 * <b>Ein Schritt</b> (h = 1/120 s, so viele je Bild, wie die Zeit verlangt):
 * Kräfte (Schwerkraft, Luftwiderstand, Federn, Auftrieb und Widerstand in
 * Flüssigkeiten) → Geschwindigkeiten → Berührungen finden (sortiert nach x,
 * dann genau) → Stösse der Berührungen und Verbindungen in zehn Durchgängen
 * → Lagen → Flüssigkeiten (Löcher, Rohre, Tropfen, Wellen).
 *
 * <b>Ruhe</b>: bewegt sich eine Sekunde lang nichts merklich (und fliesst
 * nichts), steht die Welt — das Telefon ruht, bis jemand etwas anfasst.
 */

import { Body } from './physBody';
import { collide, Contact, prestep, solve, warm } from './physCollide';
import { MouseJoint, type Joint } from './physJoints';
import { buoyancy, flows, levels, moveDrops, pipeFlow, restless, waves, type Basin, type Drop, type Pipe } from './physFluid';

export const STEP = 1 / 120;
const ITERATIONS = 10;
const MAX_DROPS = 900;
const AIR = 1.2;
/** Die Umgrenzungen werden so viel grösser genommen: eine Berührung wird gefunden, bevor sie geschieht (spekulativ, siehe SPEC). */
const MARGIN = 0.03;

export class World {
  readonly bodies: Body[] = [];
  readonly joints: Joint[] = [];
  readonly basins: Basin[] = [];
  readonly pipes: Pipe[] = [];
  readonly drops: Drop[] = [];
  /** Der Anker der Welt: was an nichts hängt, hängt an ihm (er stösst mit nichts zusammen). */
  readonly ground: Body;
  readonly contacts = new Map<string, Contact>();
  /** Paare, die nicht zusammenstossen (verbundene Körper). */
  private readonly apart = new Set<string>();
  private readonly index = new Map<Body, number>();
  private sorted: Body[] = [];
  mouse: MouseJoint | null = null;
  time = 0;
  /** Wie lange schon nichts geschieht (s) — ab einer Sekunde ruht die Welt. */
  quiet = 0;
  private carry = 0;

  constructor(public g: number, public air: number, readonly depth: number, groundBody: Body) {
    this.ground = groundBody;
  }

  add(b: Body): Body {
    b.update();
    this.index.set(b, this.bodies.length);
    this.bodies.push(b);
    this.wake();
    return b;
  }

  remove(b: Body): void {
    const i = this.bodies.indexOf(b);
    if (i < 0) return;
    this.bodies.splice(i, 1);
    this.index.clear();
    this.bodies.forEach((x, k) => this.index.set(x, k));
    for (const key of [...this.contacts.keys()]) {
      const c = this.contacts.get(key)!;
      if (c.a === b || c.b === b) this.contacts.delete(key);
    }
    for (let k = this.joints.length - 1; k >= 0; k -= 1) if (this.joints[k].a === b || this.joints[k].b === b) this.unjoin(this.joints[k]);
    if (this.mouse?.a === b) this.mouse = null;
    this.wake();
  }

  join(j: Joint): Joint {
    this.joints.push(j);
    this.apart.add(pairKey(j.a, j.b));
    this.wake();
    return j;
  }

  unjoin(j: Joint): void {
    const i = this.joints.indexOf(j);
    if (i >= 0) this.joints.splice(i, 1);
    this.apart.delete(pairKey(j.a, j.b));
    this.wake();
  }

  wake(): void {
    this.quiet = 0;
  }

  get calm(): boolean {
    return this.quiet >= 1 && this.mouse === null;
  }

  /** Die Zeit weiter: `dt` Sekunden (Wirklichkeit) × `speed` — gibt zurück, ob noch etwas geschieht. */
  frame(dt: number, speed: number): boolean {
    if (this.calm) return false;
    this.carry += dt * speed;
    let steps = 0;
    while (this.carry >= STEP && steps < 10) {
      this.step(STEP);
      this.carry -= STEP;
      steps += 1;
    }
    if (steps >= 10) this.carry = 0;
    return !this.calm;
  }

  /** Ein Schritt (h Sekunden). */
  step(h: number): void {
    const g = this.g;
    for (const b of this.bodies) { b.fx = 0; b.fy = 0; b.tq = 0; b.wet = 0; b.lift = 0; }
    for (const j of this.joints) j.force();
    for (const basin of this.basins) { levels(basin, this.bodies); buoyancy(basin, this.bodies, g); }
    /* Luftwiderstand: ½·ρ·c·A·v² gegen die Bewegung (A: was der Körper der Luft entgegenhält). */
    if (this.air > 0) {
      for (const b of this.bodies) {
        if (b.fixed || b.wet > 0) continue;
        const v = Math.hypot(b.vx, b.vy);
        if (v < 1e-4) continue;
        const span = b.shape.kind === 'circle' ? 2 * b.shape.r : Math.min(b.maxX - b.minX, b.maxY - b.minY) * 0.5 + Math.max(b.maxX - b.minX, b.maxY - b.minY) * 0.5;
        const k = 0.5 * AIR * this.air * (b.shape.kind === 'circle' ? 0.47 : 0.9) * span * b.depth * v;
        b.fx -= k * b.vx;
        b.fy -= k * b.vy;
        b.tq -= 0.02 * AIR * this.air * span ** 4 * b.depth * b.w;
      }
    }
    for (const b of this.bodies) {
      if (b.fixed) continue;
      b.vx += h * b.fx * b.invM;
      b.vy += h * (b.fy * b.invM - g);
      b.w += h * b.tq * b.invI;
    }
    this.findContacts();
    for (const c of this.contacts.values()) prestep(c, h);
    for (const c of this.contacts.values()) warm(c);
    for (const j of this.joints) j.prestep(h);
    this.mouse?.prestep(h);
    for (let k = 0; k < ITERATIONS; k += 1) {
      for (const j of this.joints) j.solve();
      this.mouse?.solve();
      for (const c of this.contacts.values()) solve(c);
    }
    let most = 0;
    for (const b of this.bodies) {
      if (b.fixed) continue;
      b.x += h * b.vx;
      b.y += h * b.vy;
      b.a += h * b.w;
      b.update();
      const r = b.shape.kind === 'circle' ? b.shape.r : b.shape.radius;
      most = Math.max(most, Math.hypot(b.vx, b.vy) + Math.abs(b.w) * r);
    }
    const solids = this.bodies.filter((b) => b.fixed);
    for (const basin of this.basins) flows(basin, g, h, this.drops, MAX_DROPS);
    for (const p of this.pipes) pipeFlow(p, g, h);
    moveDrops(this.drops, this.basins, solids, g, h, -50);
    for (const basin of this.basins) waves(basin, this.bodies, h);
    this.time += h;
    this.quiet = most < 0.025 && !restless(this.basins, this.pipes, this.drops) ? this.quiet + h : 0;
  }

  /** Wer wen berührt: nach x sortiert, dann die Umgrenzungen, dann genau. */
  private findContacts(): void {
    for (const c of this.contacts.values()) c.touched = false;
    const list = this.sorted.length === this.bodies.length && this.sorted.every((b) => this.index.has(b)) ? this.sorted : [...this.bodies];
    /* Fast sortiert: Einfügen ist schnell. */
    for (let i = 1; i < list.length; i += 1) {
      const b = list[i];
      let j = i - 1;
      while (j >= 0 && list[j].minX > b.minX) { list[j + 1] = list[j]; j -= 1; }
      list[j + 1] = b;
    }
    this.sorted = list;
    for (let i = 0; i < list.length; i += 1) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j += 1) {
        const b = list[j];
        if (b.minX > a.maxX + MARGIN) break;
        if (a.fixed && b.fixed) continue;
        if (b.minY > a.maxY + MARGIN || b.maxY < a.minY - MARGIN) continue;
        const [p, q] = (this.index.get(a) ?? 0) < (this.index.get(b) ?? 0) ? [a, b] : [b, a];
        const key = `${p.id}|${q.id}`;
        if (this.apart.has(pairKey(p, q))) continue;
        let c = this.contacts.get(key);
        if (c === undefined) c = new Contact(p, q);
        if (collide(c) > 0) {
          c.touched = true;
          this.contacts.set(key, c);
        }
      }
    }
    for (const [key, c] of this.contacts) if (!c.touched) this.contacts.delete(key);
  }

  /** Der Körper unter einem Punkt (der oberste, bewegliche zuerst) — mit Spielraum für den Finger. */
  bodyAt(x: number, y: number, slop: number): Body | null {
    let fixed: Body | null = null;
    for (let i = this.bodies.length - 1; i >= 0; i -= 1) {
      const b = this.bodies[i];
      if (x < b.minX - slop || x > b.maxX + slop || y < b.minY - slop || y > b.maxY + slop) continue;
      if (!b.contains(x, y, slop)) continue;
      if (!b.fixed) return b;
      fixed ??= b;
    }
    return fixed;
  }

  /** Den Finger an einen Körper hängen (er zieht ihn weich mit) — und wieder lösen. */
  grab(b: Body, x: number, y: number): void {
    const local = b.toLocal(x, y);
    this.mouse = new MouseJoint(b, this.ground, local, x, y, this.g);
    this.wake();
  }

  drag(x: number, y: number): void {
    if (this.mouse === null) return;
    this.mouse.tx = x;
    this.mouse.ty = y;
    this.wake();
  }

  release(): void {
    this.mouse = null;
    this.wake();
  }

  /** Wie weit die Welt reicht (zum Einpassen der Kamera). */
  bounds(): [number, number, number, number] {
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    for (const b of this.bodies) {
      if (b.maxX - b.minX > 200) continue;
      x0 = Math.min(x0, b.minX); y0 = Math.min(y0, b.minY); x1 = Math.max(x1, b.maxX); y1 = Math.max(y1, b.maxY);
    }
    for (const j of this.joints) { x0 = Math.min(x0, j.pbx); x1 = Math.max(x1, j.pbx); y1 = Math.max(y1, j.pby); }
    return Number.isFinite(x0) ? [x0, y0, x1, y1] : [-5, 0, 5, 5];
  }
}

const pairKey = (a: Body, b: Body): string => (a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`);
