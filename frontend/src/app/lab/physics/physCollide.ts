/**
 * 2026-10-18 — BERÜHRUNGEN (Fizyka 2D): wer wen berührt, wo, wie tief — und
 * die Stösse, die sie wieder trennen.
 *
 * <b>Erkennen</b>: Kreis–Kreis, Kreis–Vieleck und Vieleck–Vieleck (Achsen der
 * Kanten, „separating axis"): die Kante mit der kleinsten Eindringtiefe ist
 * die Bezugsfläche, die Kante des anderen Körpers wird an ihren Seiten
 * abgeschnitten — so entstehen bis zu zwei Berührpunkte, und ein Kasten liegt
 * flach auf dem Boden, statt zu wackeln.
 *
 * <b>Lösen</b> mit Impulsen, Punkt für Punkt, in mehreren Durchgängen
 * („sequential impulses"): die Stösse dieses Schritts beginnen mit denen des
 * letzten (dieselben Punkte erkennt ihr Merkmal) — ein Turm steht so ruhig.
 * Reibung (Coulomb: höchstens µ × Normalstoss), Rückprall (ab einer
 * Mindestgeschwindigkeit), und was ineinander steckt, wird sanft
 * auseinandergeschoben (Baumgarte). Liegt eine Kante auf einer Kante (zwei
 * Punkte), werden beide Stösse ZUGLEICH gelöst (Block, wie Box2D) — sonst
 * nähme die zuerst gelöste Ecke mehr, der Kasten kippelte, und ein Turm fiele.
 */

import type { Shape } from './physShapes';

/**
 * Was eine Berührung von einem Körper braucht: Form, Stoff (Reibung, Rückprall),
 * Lage und Ecken in der Welt, Geschwindigkeit, inverse Masse und
 * Trägheitsmoment. Der Körper der Fizyka 2D hat das alles; das Labor 2D
 * (lab2d/engine/bodyContacts.ts) baut daraus die Teile seiner Körper.
 */
export interface Collider {
  readonly shape: Shape;
  readonly material: { readonly friction: number; readonly bounce: number };
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  invM: number;
  invI: number;
  readonly wx: Float64Array;
  readonly wy: Float64Array;
  readonly wnx: Float64Array;
  readonly wny: Float64Array;
}

export const SLOP = 0.004;
/** Bis zu diesem Spalt gilt eine Berührung schon (spekulativ): ein schnell fallender Körper steckt so nie tief im Boden. */
export const SPEC = 0.02;
const CLIP_EPS = 1e-7;
const BAUMGARTE = 0.22;
const BOUNCE_FROM = 0.6;
const MAX_PUSH = 2.5;

export interface ContactPoint {
  x: number;
  y: number;
  sep: number;
  id: number;
  jn: number;
  jt: number;
  rax: number;
  ray: number;
  rbx: number;
  rby: number;
  massN: number;
  massT: number;
  bias: number;
  bounce: number;
  /** Ein Rückprall, der schon gegeben ist: so viel Stoss bleibt mindestens (er wird nicht zurückgenommen). */
  fixed: number;
  /** Dieser Punkt hat in diesem Schritt zurückgeprallt — im nächsten nicht warm wieder anlegen. */
  kicked: boolean;
}

export class Contact {
  nx = 0;
  ny = 0;
  count = 0;
  readonly points: ContactPoint[] = [mkPoint(), mkPoint()];
  friction: number;
  bounce: number;
  /** Wurde die Berührung in diesem Schritt gesehen? (Sonst fällt sie weg.) */
  touched = true;
  /** Zwei Punkte zugleich: die wirksame Massenmatrix K und ihre Umkehrung (`block`: gut genug konditioniert). */
  k11 = 0; k12 = 0; k22 = 0;
  i11 = 0; i12 = 0; i22 = 0;
  block = false;
  /** Die Länge des Schritts (für: berühren sie sich noch in diesem Schritt?). */
  h = 1 / 120;
  /** Erlaubtes Eindringen und spekulativer Spalt (m) — die Fizyka 2D rechnet in Metern, das Labor 2D in Millimetern und setzt sie kleiner. */
  slop = SLOP;
  spec = SPEC;

  constructor(readonly a: Collider, readonly b: Collider) {
    this.friction = Math.sqrt(a.material.friction * b.material.friction);
    this.bounce = Math.max(a.material.bounce, b.material.bounce);
  }
}

function mkPoint(): ContactPoint {
  return { x: 0, y: 0, sep: 0, id: -1, jn: 0, jt: 0, rax: 0, ray: 0, rbx: 0, rby: 0, massN: 0, massT: 0, bias: 0, bounce: 0, fixed: 0, kicked: false };
}

/* -- Erkennen ------------------------------------------------------------------------------- */

/** Die Berührung zweier Körper neu bestimmen — die alten Stösse bleiben bei den Punkten mit demselben Merkmal. */
export function collide(c: Contact): number {
  const a = c.a;
  const b = c.b;
  const oldIds = [c.points[0].id, c.points[1].id];
  const oldJn = [c.points[0].jn, c.points[1].jn];
  const oldJt = [c.points[0].jt, c.points[1].jt];
  const oldCount = c.count;
  c.count = 0;
  if (a.shape.kind === 'circle' && b.shape.kind === 'circle') circles(c, a, b);
  else if (a.shape.kind === 'poly' && b.shape.kind === 'circle') polyCircle(c, a, b, false);
  else if (a.shape.kind === 'circle' && b.shape.kind === 'poly') polyCircle(c, b, a, true);
  else polys(c, a, b);
  /* Warm starten: dieselben Merkmale behalten ihre Stösse. */
  for (let i = 0; i < c.count; i += 1) {
    const p = c.points[i];
    p.jn = 0;
    p.jt = 0;
    for (let k = 0; k < oldCount; k += 1) {
      if (oldIds[k] === p.id) { p.jn = oldJn[k]; p.jt = oldJt[k]; break; }
    }
  }
  return c.count;
}

function setPoint(c: Contact, x: number, y: number, sep: number, id: number): void {
  const p = c.points[c.count];
  p.x = x;
  p.y = y;
  p.sep = sep;
  p.id = id;
  c.count += 1;
}

function circles(c: Contact, a: Collider, b: Collider): void {
  const ra = (a.shape as { r: number }).r;
  const rb = (b.shape as { r: number }).r;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d > ra + rb + c.spec) return;
  const nx = d > 1e-9 ? dx / d : 0;
  const ny = d > 1e-9 ? dy / d : 1;
  c.nx = nx;
  c.ny = ny;
  setPoint(c, a.x + nx * (ra - (ra + rb - d) / 2), a.y + ny * (ra - (ra + rb - d) / 2), d - ra - rb, 0);
}

/** Vieleck P und Kreis C — die Normale zeigt von P zu C (`flip`: der Kreis ist `a`). */
function polyCircle(c: Contact, p: Collider, k: Collider, flip: boolean): void {
  const s = p.shape;
  if (s.kind !== 'poly') return;
  const r = (k.shape as { r: number }).r;
  let best = -Infinity;
  let edge = 0;
  for (let i = 0; i < s.n; i += 1) {
    const d = (k.x - p.wx[i]) * p.wnx[i] + (k.y - p.wy[i]) * p.wny[i];
    if (d > r + c.spec) return;
    if (d > best) { best = d; edge = i; }
  }
  const i2 = (edge + 1) % s.n;
  const x1 = p.wx[edge]; const y1 = p.wy[edge];
  const x2 = p.wx[i2]; const y2 = p.wy[i2];
  let nx: number;
  let ny: number;
  let px: number;
  let py: number;
  let sep: number;
  if (best < 1e-9) {
    /* Die Mitte steckt im Vieleck: hinaus über die nächste Kante. */
    nx = p.wnx[edge]; ny = p.wny[edge];
    sep = best - r;
    px = k.x - nx * r; py = k.y - ny * r;
  } else {
    const u1 = (k.x - x1) * (x2 - x1) + (k.y - y1) * (y2 - y1);
    const u2 = (k.x - x2) * (x1 - x2) + (k.y - y2) * (y1 - y2);
    if (u1 <= 0 || u2 <= 0) {
      /* An einer Ecke. */
      const vx = u1 <= 0 ? x1 : x2;
      const vy = u1 <= 0 ? y1 : y2;
      const dx = k.x - vx;
      const dy = k.y - vy;
      const d = Math.hypot(dx, dy);
      if (d > r + c.spec) return;
      nx = d > 1e-9 ? dx / d : p.wnx[edge];
      ny = d > 1e-9 ? dy / d : p.wny[edge];
      sep = d - r;
      px = vx; py = vy;
    } else {
      nx = p.wnx[edge]; ny = p.wny[edge];
      sep = best - r;
      px = k.x - nx * r; py = k.y - ny * r;
    }
  }
  c.nx = flip ? -nx : nx;
  c.ny = flip ? -ny : ny;
  setPoint(c, px, py, sep, edge);
}

/** Wie weit B höchstens hinter einer Kante von A liegt — die beste (kleinste Eindringtiefe) Kante. */
function maxSeparation(A: Collider, B: Collider): { sep: number; edge: number } {
  const sa = A.shape;
  const sb = B.shape;
  if (sa.kind !== 'poly' || sb.kind !== 'poly') return { sep: Infinity, edge: 0 };
  let best = -Infinity;
  let edge = 0;
  for (let i = 0; i < sa.n; i += 1) {
    const nx = A.wnx[i]; const ny = A.wny[i];
    const vx = A.wx[i]; const vy = A.wy[i];
    let min = Infinity;
    for (let j = 0; j < sb.n; j += 1) {
      const d = (B.wx[j] - vx) * nx + (B.wy[j] - vy) * ny;
      if (d < min) min = d;
    }
    if (min > best) { best = min; edge = i; }
  }
  return { sep: best, edge };
}

function polys(c: Contact, a: Collider, b: Collider): void {
  const A = maxSeparation(a, b);
  if (A.sep > c.spec) return;
  const B = maxSeparation(b, a);
  if (B.sep > c.spec) return;
  let ref = a;
  let inc = b;
  let edge = A.edge;
  let flip = false;
  /* Wie Box2D: B nur dann als Bezug, wenn es deutlich weniger eindringt — sonst wechselte die Wahl von Bild zu Bild, und die Stösse fingen jedes Mal von vorn an. */
  if (B.sep > 0.98 * A.sep + 0.001) { ref = b; inc = a; edge = B.edge; flip = true; }
  const sr = ref.shape;
  const si = inc.shape;
  if (sr.kind !== 'poly' || si.kind !== 'poly') return;
  const i2 = (edge + 1) % sr.n;
  const v1x = ref.wx[edge]; const v1y = ref.wy[edge];
  const v2x = ref.wx[i2]; const v2y = ref.wy[i2];
  const nx = ref.wnx[edge]; const ny = ref.wny[edge];
  /* Die Kante des anderen, die der Bezugsfläche am meisten entgegensieht. */
  let min = Infinity;
  let ie = 0;
  for (let k = 0; k < si.n; k += 1) {
    const d = inc.wnx[k] * nx + inc.wny[k] * ny;
    if (d < min) { min = d; ie = k; }
  }
  const ie2 = (ie + 1) % si.n;
  let ax = inc.wx[ie]; let ay = inc.wy[ie];
  let bx = inc.wx[ie2]; let by = inc.wy[ie2];
  let ida = ie;
  let idb = ie2;
  const tlen = Math.hypot(v2x - v1x, v2y - v1y) || 1;
  const tx = (v2x - v1x) / tlen;
  const ty = (v2y - v1y) / tlen;
  /* An den beiden Seiten der Bezugsfläche abschneiden. */
  const lo = tx * v1x + ty * v1y;
  const hi = tx * v2x + ty * v2y;
  for (const [sx, off] of [[-1, -lo], [1, hi]] as const) {
    const da = sx * (tx * ax + ty * ay) - off;
    const db = sx * (tx * bx + ty * by) - off;
    /* Mit einem Hauch Spielraum: genau an der Kante (zwei gleich breite Kästen) entscheidet sonst das Rauschen der Rechnung — und der Punkt verlöre seinen Stoss aus dem letzten Schritt. */
    if (da > CLIP_EPS && db > CLIP_EPS) return;
    if (da > CLIP_EPS) {
      const t = da / (da - db);
      ax += (bx - ax) * t; ay += (by - ay) * t; ida = 200 + edge;
    } else if (db > CLIP_EPS) {
      const t = da / (da - db);
      bx = ax + (bx - ax) * t; by = ay + (by - ay) * t; idb = 300 + edge;
    }
  }
  const base = (flip ? 10000 : 0) + edge * 1000;
  const sa = (ax - v1x) * nx + (ay - v1y) * ny;
  const sb = (bx - v1x) * nx + (by - v1y) * ny;
  c.nx = flip ? -nx : nx;
  c.ny = flip ? -ny : ny;
  /* Der Punkt mitten zwischen den beiden Körpern. */
  if (sa <= c.spec) setPoint(c, ax - nx * sa / 2, ay - ny * sa / 2, sa, base + ida);
  if (sb <= c.spec) setPoint(c, bx - nx * sb / 2, by - ny * sb / 2, sb, base + idb);
}

/* -- Lösen ---------------------------------------------------------------------------------- */

/**
 * VOR DEN DURCHGÄNGEN: Hebel, wirksame Massen, wie stark geschoben und
 * zurückgeprallt wird — für ALLE Berührungen mit den Geschwindigkeiten vom
 * Anfang des Schritts; erst danach werden die alten Stösse wieder angelegt
 * (`warm`). Sonst sähe der zweite Punkt eines Paars schon den Stoss des ersten.
 */
export function prestep(c: Contact, h: number): void {
  c.h = h;
  const a = c.a;
  const b = c.b;
  const nx = c.nx;
  const ny = c.ny;
  const tx = ny;
  const ty = -nx;
  for (let i = 0; i < c.count; i += 1) {
    const p = c.points[i];
    p.rax = p.x - a.x; p.ray = p.y - a.y;
    p.rbx = p.x - b.x; p.rby = p.y - b.y;
    const rna = p.rax * ny - p.ray * nx;
    const rnb = p.rbx * ny - p.rby * nx;
    const kn = a.invM + b.invM + a.invI * rna * rna + b.invI * rnb * rnb;
    p.massN = kn > 0 ? 1 / kn : 0;
    const rta = p.rax * ty - p.ray * tx;
    const rtb = p.rbx * ty - p.rby * tx;
    const kt = a.invM + b.invM + a.invI * rta * rta + b.invI * rtb * rtb;
    p.massT = kt > 0 ? 1 / kt : 0;
    /*
     * Noch nicht berührt (ein Spalt): sie dürfen sich so schnell nähern, dass
     * der Spalt in diesem Schritt gerade zugeht — sonst klebte ein Kasten
     * schief in der Luft. Berührt: sanft auseinander (Baumgarte).
     */
    p.bias = p.sep > 0 ? -p.sep / h : Math.min(MAX_PUSH, (BAUMGARTE / h) * Math.max(0, -p.sep - c.slop));
    /* Rückprall: aus der Geschwindigkeit, mit der sie aufeinander zukommen. */
    const dvx = b.vx - b.w * p.rby - a.vx + a.w * p.ray;
    const dvy = b.vy + b.w * p.rbx - a.vy - a.w * p.rax;
    const vn = dvx * nx + dvy * ny;
    /* Prallt auf: schon berührt — oder der Spalt geht in diesem Schritt zu (sonst fräße der Spalt den Schwung). */
    p.bounce = vn < -BOUNCE_FROM && (p.sep <= c.slop || p.sep + vn * h < 0) ? -c.bounce * vn : 0;
    /* Ein neuer Aufprall (oder einer im letzten Schritt): ohne den alten Stoss beginnen. */
    if (p.kicked || p.bounce > 0) { p.jn = 0; p.jt = 0; }
    p.kicked = false;
    p.fixed = 0;
  }
  c.block = false;
  if (c.count === 2) {
    const p1 = c.points[0];
    const p2 = c.points[1];
    const rn1a = p1.rax * ny - p1.ray * nx;
    const rn1b = p1.rbx * ny - p1.rby * nx;
    const rn2a = p2.rax * ny - p2.ray * nx;
    const rn2b = p2.rbx * ny - p2.rby * nx;
    const m = a.invM + b.invM;
    c.k11 = m + a.invI * rn1a * rn1a + b.invI * rn1b * rn1b;
    c.k22 = m + a.invI * rn2a * rn2a + b.invI * rn2b * rn2b;
    c.k12 = m + a.invI * rn1a * rn2a + b.invI * rn1b * rn2b;
    const det = c.k11 * c.k22 - c.k12 * c.k12;
    /* Schlecht konditioniert (die Punkte fallen fast zusammen): dann einzeln. */
    if (c.k11 * c.k11 < 1000 * det && det > 0) {
      c.block = true;
      c.i11 = c.k22 / det;
      c.i12 = -c.k12 / det;
      c.i22 = c.k11 / det;
    }
  }
}

/** Die Stösse des letzten Schritts wieder anlegen (nach `prestep` aller Berührungen). */
export function warm(c: Contact): void {
  const tx = c.ny;
  const ty = -c.nx;
  for (let i = 0; i < c.count; i += 1) {
    const p = c.points[i];
    impulse(c.a, c.b, p.jn * c.nx + p.jt * tx, p.jn * c.ny + p.jt * ty, p);
  }
}

/** Ein Durchgang: erst die Reibung (höchstens µ × Normalstoss), dann der Normalstoss (nie ziehend). */
export function solve(c: Contact): void {
  const a = c.a;
  const b = c.b;
  const nx = c.nx;
  const ny = c.ny;
  const tx = ny;
  const ty = -nx;
  /* Erst die Reibung (mit dem Normalstoss des letzten Durchgangs) … */
  for (let i = 0; i < c.count; i += 1) {
    const p = c.points[i];
    const dvx = b.vx - b.w * p.rby - a.vx + a.w * p.ray;
    const dvy = b.vy + b.w * p.rbx - a.vy - a.w * p.rax;
    const vt = dvx * tx + dvy * ty;
    const lim = c.friction * p.jn;
    const jt = Math.max(-lim, Math.min(lim, p.jt - p.massT * vt));
    const dt = jt - p.jt;
    p.jt = jt;
    impulse(a, b, dt * tx, dt * ty, p);
  }
  /* … dann die Normalstösse: zwei Punkte zugleich (Block), sonst einzeln. */
  if (c.block) { solveBlock(c); return; }
  for (let i = 0; i < c.count; i += 1) {
    const p = c.points[i];
    const dvx = b.vx - b.w * p.rby - a.vx + a.w * p.ray;
    const dvy = b.vy + b.w * p.rbx - a.vy - a.w * p.rax;
    const vn = dvx * nx + dvy * ny;
    /*
     * Eine Kette elastischer Körper (Kołyska Newtona): der Stoss kommt erst in
     * diesem Durchgang an — dann prallt auch dieser Kontakt zurück, sonst
     * teilten sich alle Kugeln den Schwung wie ein Klumpen.
     */
    if (p.bounce === 0 && c.bounce >= 0.5 && vn < -BOUNCE_FROM && (p.sep <= c.slop || p.sep + vn * c.h < 0)) p.bounce = -c.bounce * vn;
    const jn = Math.max(p.jn + p.massN * (-vn + target(p)), p.fixed);
    const dj = jn - p.jn;
    p.jn = jn;
    impulse(a, b, dj * nx, dj * ny, p);
    /* Der Rückprall ist gegeben: einmal, nicht in jedem Durchgang neu (sonst stiesse er immer wieder nach). */
    if (p.bounce > 0) { p.fixed = jn; p.bounce = -1; p.kicked = true; }
  }
}

/** Die Geschwindigkeit, auf die ein Punkt kommen soll: Rückprall, Auseinanderschieben, oder (ein Spalt) höchstens so schnell heran. */
const target = (p: ContactPoint): number => (p.bounce > 0 ? Math.max(p.bias, p.bounce) : p.bias);

function impulse(a: Collider, b: Collider, px: number, py: number, p: ContactPoint): void {
  a.vx -= a.invM * px; a.vy -= a.invM * py; a.w -= a.invI * (p.rax * py - p.ray * px);
  b.vx += b.invM * px; b.vy += b.invM * py; b.w += b.invI * (p.rbx * py - p.rby * px);
}

/**
 * ZWEI NORMALSTÖSSE ZUGLEICH (ein lineares Komplementaritätsproblem, Box2D):
 * beide Punkte drücken; nur der erste; nur der zweite; keiner — der erste
 * Fall, der passt (Stösse ≥ 0, und wo keiner wirkt, entfernen sich die Körper).
 */
function solveBlock(c: Contact): void {
  const a = c.a;
  const b = c.b;
  const nx = c.nx;
  const ny = c.ny;
  const p1 = c.points[0];
  const p2 = c.points[1];
  const vn = (p: ContactPoint) => {
    const dvx = b.vx - b.w * p.rby - a.vx + a.w * p.ray;
    const dvy = b.vy + b.w * p.rbx - a.vy - a.w * p.rax;
    return dvx * nx + dvy * ny;
  };
  const a1 = p1.jn;
  const a2 = p2.jn;
  /* b = vn − Ziel − K·a (so ist x = −K⁻¹·b der neue Gesamtstoss). */
  const b1 = vn(p1) - target(p1) - (c.k11 * a1 + c.k12 * a2);
  const b2 = vn(p2) - target(p2) - (c.k12 * a1 + c.k22 * a2);
  const apply = (x1: number, x2: number) => {
    const d1 = x1 - a1;
    const d2 = x2 - a2;
    impulse(a, b, d1 * nx, d1 * ny, p1);
    impulse(a, b, d2 * nx, d2 * ny, p2);
    p1.jn = x1;
    p2.jn = x2;
  };
  let x1 = -(c.i11 * b1 + c.i12 * b2);
  let x2 = -(c.i12 * b1 + c.i22 * b2);
  if (x1 >= 0 && x2 >= 0) { apply(x1, x2); return; }
  x1 = -b1 / c.k11;
  x2 = 0;
  if (x1 >= 0 && c.k12 * x1 + b2 >= 0) { apply(x1, x2); return; }
  x1 = 0;
  x2 = -b2 / c.k22;
  if (x2 >= 0 && c.k12 * x2 + b1 >= 0) { apply(x1, x2); return; }
  if (b1 >= 0 && b2 >= 0) apply(0, 0);
}

/** Die Kraft, mit der die Berührung drückt (N) — für die Anzeige (Waage, Normalkraft). */
export function pushOf(c: Contact, h: number): number {
  let j = 0;
  for (let i = 0; i < c.count; i += 1) j += c.points[i].jn;
  return j / h;
}
