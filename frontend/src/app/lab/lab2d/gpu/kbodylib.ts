/**
 * LABOR 2D (v2) — KÖRPER AUF DER GPU: DIE GEMEINSAME BIBLIOTHEK (seit
 * 2026-10-26). In einer Szene mit freien Körpern rechnen auf dem
 * beschleunigten Weg ALLE Körper mit genauen Anteilen (das Modell „R1c“,
 * MILESTONES.md „Bodies and ice on the GPU“): ihre Rechtecke und inneren
 * Zellen liegen in drei Puffern, und die Kerne (kbodycover.ts,
 * kbodycollect.ts, kbodydyn.ts) rechnen damit, was bodyCover.ts, coverCollect.ts,
 * bodyForces.ts, bodyContacts.ts und bodies.ts auf der CPU tun.
 *
 * - `bod` (f32, BS Wörter je Körper): Lage, Geschwindigkeit, der Randwert U der
 *   Projektionen, Masse, Zustand, Zuwachs und Vorhersage (bodies.ts), die
 *   mitbewegte Masse, die Umgrenzung jetzt und beim letzten Abdecken, Kräfte.
 * - `bgeo` (f32, fest bis zum nächsten Hochladen): Kopf (GH_*), die Rechtecke
 *   (RS Wörter: lokale Grenzen, Zellen je Richtung, Anfänge der Spalten- und
 *   Zeilengrenzen und der inneren Zellen, Körper), die Grenzen selbst, die
 *   freien Seitenstücke (SS Wörter) und die festen Teile der Berührungen.
 * - `bcell` (f32, 4 je innere Zelle): Energie, Film, Kruste und das Rechteck.
 *
 * Die Geometrie ist die der CPU (geom.ts), in f32: ein Viereck einer inneren
 * Zelle gegen eine Gitterzelle (Sutherland–Hodgman) relativ zur Ecke der Zelle
 * gerechnet (so bleiben die Flächen auf etwa 1e-6 genau), Liang–Barsky für
 * Strecken, der Test „durchschneidet die Zelle“ über die Bögen des Rands.
 */

/** bod: je Körper BS f32 (Plätze). */
export const BB = {
  X: 0, Y: 1, A: 2, VX: 3, VY: 4, W: 5, UX: 6, UY: 7, UW: 8,
  M: 9, I: 10, RMAX: 11, HULLA: 12, HULLJ: 13,
  PINNED: 14, ASLEEP: 15, GONE: 16, REST: 17,
  RX: 18, RY: 19, RA: 20,
  PREV: 21, PRED: 24, PNOW: 27, POLD: 30, VPRE: 33,
  MA6: 36, MAOK: 42, MA: 43, IA: 44,
  MAT: 45, HEATER: 46, NR: 47, RO: 48, NCELL: 49, KO: 50, NSEG: 51, SO: 52,
  BX0: 53, BY0: 54, BX1: 55, BY1: 56, OX0: 57, OY0: 58, OX1: 59, OY1: 60,
  FX: 61, FY: 62, TQ: 63, TOUCH: 64, BAND: 65, AGAIN: 66, COS: 67, SIN: 68, PROBE: 69, KEY: 70, VOL: 71, E0: 72,
  MA9: 73, HIT: 82, WAKE: 83
} as const;
export const BS = 88;

/** bgeo: Kopf (die Anfänge der Teile, Wörter), dann die Rechtecke ab GEO_RECTS. */
export const GH = { SEGS: 0, PARTS: 1, NPARTS: 2, NRECT: 3, NCELL: 4, NBODY: 5 } as const;
export const GEO_RECTS = 8;
/** Ein Rechteck: lokale Grenzen, Spalten und Zeilen, Anfang der Spalten- und der Zeilengrenzen in bgeo, erste innere Zelle, Körper. */
export const GR = { X0: 0, Y0: 1, X1: 2, Y1: 3, NI: 4, NJ: 5, XO: 6, YO: 7, KO: 8, BODY: 9 } as const;
export const RS = 12;
/** Ein freies Seitenstück: Rechteck (Nummer), Seite (0 links, 1 rechts, 2 unten, 3 oben), Lage t0…t1 längs der Seite, Körper. */
export const GS = { RECT: 0, SIDE: 1, T0: 2, T1: 3, BODY: 4 } as const;
export const SS = 8;
/** Ein festes Teil der Berührungen (Wand der Kiste, gemalter Feststoff): Rechteck in der Welt, Kennung, Reibung, Rückprall. */
export const GP = { X0: 0, Y0: 1, X1: 2, Y1: 3, ID: 4, FRIC: 5, BOUNCE: 6 } as const;
export const PS = 8;
/** bcell: je innere Zelle Energie (J), Film, Kruste (kg) und ihr Rechteck. */
export const BC = 4;
/** bread: je Körper die Ablesung (Lage, Geschwindigkeit, Zustand, Masse, mittlere Temperatur, Σ E, Film, Kruste, Kraft). */
export const BRD = { X: 0, Y: 1, A: 2, VX: 3, VY: 4, W: 5, STATE: 6, M: 7, T: 8, E: 9, FILM: 10, CRUST: 11, FX: 12, FY: 13, TQ: 14, MAOK: 15 } as const;
export const BR = 16;

/** Ab diesem bedeckten Anteil schliesst eine Zelle (wie bodyCover.ts: CLOSED, CLOSED_FREE, SQUEEZE). */
export const CLOSED_GPU = 0.99;
export const CLOSED_FREE_GPU = 0.9;
/**
 * Eine schon geschlossene Zelle eines freien Körpers öffnet erst unter diesem Anteil wieder (nur die GPU: ihre Flächen sind binär —
 * eine offene Zelle hat ganz offene Flächen, wo die CPU deren offenen Teil nimmt; ein Klotz, der um 0,05° schaukelt, schob die
 * Zellen seiner Seite mit fs 0,895–0,92 jeden zweiten Schritt auf und zu, und jedes Mal stiess das Wasser an der Wasserlinie.)
 */
export const REOPEN_FREE_GPU = 0.88;
export const SQUEEZE_GPU = 0.5;
/** Eine Fläche gilt als ganz bedeckt (f32: die CPU nimmt 1 − 1e-9, das ist in f32 genau 1). */
export const COVERED = 1e-5;

const wgslConsts = (prefix: string, o: Readonly<Record<string, number>>): string =>
  Object.entries(o).map(([k, v]) => `const ${prefix}${k}: u32 = ${v}u;`).join('\n');

/** Die Plätze als WGSL-Konstanten (B_X, GR_NI, …). */
export const BODY_CONSTS = [
  wgslConsts('B_', BB), wgslConsts('GH_', GH), wgslConsts('GR_', GR), wgslConsts('GS_', GS), wgslConsts('GP_', GP), wgslConsts('BRD_', BRD),
  `const BS: u32 = ${BS}u;`, `const GEO_RECTS: u32 = ${GEO_RECTS}u;`, `const RS: u32 = ${RS}u;`, `const SS: u32 = ${SS}u;`, `const PS: u32 = ${PS}u;`,
  `const BC: u32 = ${BC}u;`, `const BR: u32 = ${BR}u;`,
  `const CLOSED_P: f32 = ${CLOSED_GPU};`, `const CLOSED_F: f32 = ${CLOSED_FREE_GPU};`, `const REOPEN_F: f32 = ${REOPEN_FREE_GPU};`, `const SQUEEZE_B: f32 = ${SQUEEZE_GPU};`,
  `const COVERED_EPS: f32 = ${COVERED};`
].join('\n');

/** Zugriff auf einen Körper (nur bod gebunden — WGSL verlangt, dass jeder Name auch in unbenutzten Funktionen gebunden ist). */
export const BODY_REC = `${BODY_CONSTS}
fn bv(b: u32, f: u32) -> f32 { return bod[b * BS + f]; }
fn bFree(b: u32) -> bool { return bv(b, B_PINNED) == 0.0 && bv(b, B_GONE) == 0.0; }
fn bAwake(b: u32) -> bool { return bFree(b) && bv(b, B_ASLEEP) == 0.0; }
fn bGone(b: u32) -> bool { return bv(b, B_GONE) != 0.0; }
/* Welt → eigener Rahmen des Körpers bei seiner jetzigen Lage (cos, sin aus bPrep). */
fn toLocalB(b: u32, w: vec2<f32>) -> vec2<f32> {
  let d = w - vec2<f32>(bv(b, B_X), bv(b, B_Y));
  let c = bv(b, B_COS);
  let s = bv(b, B_SIN);
  return vec2<f32>(c * d.x + s * d.y, -s * d.x + c * d.y);
}
/* Eigener Rahmen → Welt relativ zum Punkt org (für genaue Flächen in f32). */
fn toWorldRel(b: u32, l: vec2<f32>, org: vec2<f32>) -> vec2<f32> {
  let c = bv(b, B_COS);
  let s = bv(b, B_SIN);
  return (vec2<f32>(bv(b, B_X), bv(b, B_Y)) - org) + vec2<f32>(c * l.x - s * l.y, s * l.x + c * l.y);
}
/* Die Geschwindigkeit, mit der die Projektionen den Körper sehen (U = V + Vorhersage, bodies.ts), an einem Punkt der Welt. */
fn bodyU(b: u32, p: vec2<f32>) -> vec2<f32> {
  let w = bv(b, B_UW);
  return vec2<f32>(bv(b, B_UX) - w * (p.y - bv(b, B_Y)), bv(b, B_UY) + w * (p.x - bv(b, B_X)));
}
/* Seine wirkliche Geschwindigkeit an einem Punkt. */
fn bodyV(b: u32, p: vec2<f32>) -> vec2<f32> {
  let w = bv(b, B_W);
  return vec2<f32>(bv(b, B_VX) - w * (p.y - bv(b, B_Y)), bv(b, B_VY) + w * (p.x - bv(b, B_X)));
}
`;

/** Zugriff auf einen Körper und seine Rechtecke (bod und bgeo gebunden). */
export const BODY_ACCESS = `${BODY_REC}
fn rectOf(b: u32, r: u32) -> u32 { return u32(bv(b, B_RO)) + r; }
fn rv(q: u32, f: u32) -> f32 { return bgeo[GEO_RECTS + q * RS + f]; }
fn rBox(q: u32) -> vec4<f32> { return vec4<f32>(rv(q, GR_X0), rv(q, GR_Y0), rv(q, GR_X1), rv(q, GR_Y1)); }
fn rxs(q: u32, p: u32) -> f32 { return bgeo[u32(rv(q, GR_XO)) + p]; }
fn rys(q: u32, p: u32) -> f32 { return bgeo[u32(rv(q, GR_YO)) + p]; }
/* Die erste Spalte (Zeile) des Rechtecks q, deren rechte (obere) Grenze nicht links (unter) v liegt — binäre Suche über die Grenzen. */
fn firstCol(q: u32, n: u32, v: f32) -> u32 {
  var lo = 0u;
  var hi = n;
  loop { if (lo >= hi) { break; } let mid = (lo + hi) / 2u; if (rxs(q, mid + 1u) < v) { lo = mid + 1u; } else { hi = mid; } }
  return lo;
}
fn firstRow(q: u32, n: u32, v: f32) -> u32 {
  var lo = 0u;
  var hi = n;
  loop { if (lo >= hi) { break; } let mid = (lo + hi) / 2u; if (rys(q, mid + 1u) < v) { lo = mid + 1u; } else { hi = mid; } }
  return lo;
}
`;

/** Die Geometrie (wie geom.ts) — keine Bindungen. */
export const BODY_GEOM = `
/* Fläche des Vierecks q0…q3 (gegen den Uhrzeigersinn) im Kasten [c0, c1] — Sutherland–Hodgman wie geom.quadInBox. */
fn quadInBox(q0: vec2<f32>, q1: vec2<f32>, q2: vec2<f32>, q3: vec2<f32>, c0: vec2<f32>, c1: vec2<f32>) -> f32 {
  var p: array<vec2<f32>, 12>;
  var t: array<vec2<f32>, 12>;
  p[0] = q0; p[1] = q1; p[2] = q2; p[3] = q3;
  var n = 4u;
  for (var plane = 0u; plane < 4u; plane++) {
    let axis = plane / 2u;
    let s = select(-1.0, 1.0, (plane % 2u) == 1u);
    var v = c0.x;
    if (plane == 1u) { v = c1.x; } else if (plane == 2u) { v = c0.y; } else if (plane == 3u) { v = c1.y; }
    var m = 0u;
    for (var i = 0u; i < n; i++) {
      let jn = select(i + 1u, 0u, i + 1u == n);
      let pi = p[i];
      let pj = p[jn];
      let ci = s * (select(pi.x, pi.y, axis == 1u) - v);
      let cj = s * (select(pj.x, pj.y, axis == 1u) - v);
      if (ci <= 0.0) { t[m] = pi; m++; }
      if ((ci < 0.0 && cj > 0.0) || (ci > 0.0 && cj < 0.0)) { let tt = ci / (ci - cj); t[m] = pi + tt * (pj - pi); m++; }
    }
    n = m;
    for (var k = 0u; k < n; k++) { p[k] = t[k]; }
    if (n == 0u) { return 0.0; }
  }
  if (n < 3u) { return 0.0; }
  var a = 0.0;
  for (var i = 0u; i < n; i++) { let jn = select(i + 1u, 0u, i + 1u == n); a += p[i].x * p[jn].y - p[jn].x * p[i].y; }
  return abs(0.5 * a);
}
/* Liang–Barsky: der Teil [t0, t1] der Strecke p→q im Kasten (in lb), Länge t1 − t0 (Anteil). */
var<private> lb: vec2<f32>;
fn lbEdge(pp: f32, qq: f32) -> bool {
  if (pp == 0.0) { return qq >= 0.0; }
  let r = qq / pp;
  if (pp < 0.0) { if (r > lb.y) { return false; } if (r > lb.x) { lb.x = r; } }
  else { if (r < lb.x) { return false; } if (r < lb.y) { lb.y = r; } }
  return true;
}
fn clipSeg(p: vec2<f32>, q: vec2<f32>, x0: f32, y0: f32, x1: f32, y1: f32) -> f32 {
  let d = q - p;
  lb = vec2<f32>(0.0, 1.0);
  if (!lbEdge(-d.x, p.x - x0) || !lbEdge(d.x, x1 - p.x) || !lbEdge(-d.y, p.y - y0) || !lbEdge(d.y, y1 - p.y)) { lb = vec2<f32>(1.0, 0.0); return 0.0; }
  return max(0.0, lb.y - lb.x);
}
/* Die Seite mit dem kleinsten Abstand (0 links, 1 rechts, 2 unten, 3 oben), wie bodyCover.nearestSide. */
fn nearestSide(d0: f32, d1: f32, d2: f32, d3: f32) -> u32 {
  var s = 0u;
  var d = d0;
  if (d1 < d) { s = 1u; d = d1; }
  if (d2 < d) { s = 2u; d = d2; }
  if (d3 < d) { s = 3u; }
  return s;
}
`;

/** Was ein Körper mit Gitterzellen und Punkten tut (bod, bgeo gebunden; dazu BODY_ACCESS und BODY_GEOM). */
export const BODY_CELLS = `
/* Fläche der inneren Zelle (p, q) des Rechtecks q in der Gitterzelle (i, j) (m², relativ zur Ecke der Zelle gerechnet). */
fn areaIn(b: u32, rq: u32, p: u32, q: u32, i: i32, j: i32) -> f32 {
  let org = vec2<f32>(f32(i) * P.dx, f32(j) * P.dx);
  let x0 = rxs(rq, p); let x1 = rxs(rq, p + 1u);
  let y0 = rys(rq, q); let y1 = rys(rq, q + 1u);
  return quadInBox(toWorldRel(b, vec2<f32>(x0, y0), org), toWorldRel(b, vec2<f32>(x1, y0), org), toWorldRel(b, vec2<f32>(x1, y1), org),
    toWorldRel(b, vec2<f32>(x0, y1), org), vec2<f32>(0.0, 0.0), vec2<f32>(P.dx, P.dx));
}
/* Liegt die Gitterzelle (i, j) in der Umgrenzung des Körpers (bei seiner jetzigen Lage)? */
fn boxHits(b: u32, i: i32, j: i32, m: f32) -> bool {
  let x0 = f32(i) * P.dx;
  let y0 = f32(j) * P.dx;
  return !(bv(b, B_BX0) > x0 + P.dx + m || bv(b, B_BX1) < x0 - m || bv(b, B_BY0) > y0 + P.dx + m || bv(b, B_BY1) < y0 - m);
}
/* Durchschneidet das Rechteck q des Körpers die Gitterzelle (i, j) in getrennte Teile (wie geom.splitsCell)? */
fn splitsCellB(b: u32, rq: u32, i: i32, j: i32) -> bool {
  let bx = rBox(rq);
  let c0 = vec2<f32>(f32(i) * P.dx, f32(j) * P.dx);
  let c1 = c0 + vec2<f32>(P.dx, P.dx);
  var arcs: array<f32, 8>;
  var n = 0u;
  for (var e = 0u; e < 4u; e++) {
    var s0 = vec2<f32>(c0.x, c0.y); var e0 = vec2<f32>(c1.x, c0.y);
    if (e == 1u) { s0 = vec2<f32>(c1.x, c0.y); e0 = vec2<f32>(c1.x, c1.y); }
    else if (e == 2u) { s0 = vec2<f32>(c1.x, c1.y); e0 = vec2<f32>(c0.x, c1.y); }
    else if (e == 3u) { s0 = vec2<f32>(c0.x, c1.y); e0 = vec2<f32>(c0.x, c0.y); }
    if (clipSeg(toLocalB(b, s0), toLocalB(b, e0), bx.x, bx.y, bx.z, bx.w) <= 0.0) { continue; }
    arcs[2u * n] = f32(e) + lb.x;
    arcs[2u * n + 1u] = f32(e) + lb.y;
    n++;
  }
  if (n < 2u) { return false; }
  var count = n;
  for (var k = 0u; k < n; k++) {
    let jn = select(k + 1u, 0u, k + 1u == n);
    let en = arcs[2u * k + 1u];
    let st = arcs[2u * jn] + select(0.0, 4.0, jn == 0u);
    if (abs(st - en) <= 1e-6) { count--; }
  }
  return count >= 2u;
}
/* Wie viel der Strecke a→e (eine Seitenfläche) die Rechtecke aller Körper bedecken (Anteil, summiert wie BodyCover.face). */
fn faceCover(a: vec2<f32>, e: vec2<f32>) -> f32 {
  var cover = 0.0;
  for (var b = 0u; b < P.nbody; b++) {
    if (bGone(b)) { continue; }
    if (bv(b, B_BX0) > max(a.x, e.x) || bv(b, B_BX1) < min(a.x, e.x) || bv(b, B_BY0) > max(a.y, e.y) || bv(b, B_BY1) < min(a.y, e.y)) { continue; }
    let l0 = toLocalB(b, a);
    let l1 = toLocalB(b, e);
    let nr = u32(bv(b, B_NR));
    for (var r = 0u; r < nr; r++) {
      let bx = rBox(rectOf(b, r));
      cover += clipSeg(l0, l1, bx.x, bx.y, bx.z, bx.w);
    }
  }
  return cover;
}

/* -- Punkte aus den Rechtecken hinaus (bodyCover.moveOut) ------------------------------------------- */
struct Out { hit: bool, p: vec2<f32>, n: vec2<f32> }
/*
 * Liegt w jetzt in einem Rechteck des Körpers (mit dem Rand 0,02 Δx) oder kreuzt der Weg von dort, wo o unter der Lage
 * (x0, y0, a0) im Rahmen lag, eines? Dann an den Eintrittspunkt (knapp davor); war er schon vorher drin, zur nächsten Seite.
 */
fn moveOut(b: u32, w: vec2<f32>, o: vec2<f32>, pose0: vec3<f32>) -> Out {
  var res: Out;
  res.hit = false;
  let l1 = toLocalB(b, w);
  let c0 = cos(pose0.z);
  let s0 = sin(pose0.z);
  let d0 = o - pose0.xy;
  let l0 = vec2<f32>(c0 * d0.x + s0 * d0.y, -s0 * d0.x + c0 * d0.y);
  let m = 0.02 * P.dx;
  var bestT = 1e30;
  var side = 4u;
  var qx = l1;
  let nr = u32(bv(b, B_NR));
  for (var r = 0u; r < nr; r++) {
    let bx = rBox(rectOf(b, r));
    let ex0 = bx.x - m; let ey0 = bx.y - m; let ex1 = bx.z + m; let ey1 = bx.w + m;
    let in1 = l1.x > ex0 && l1.x < ex1 && l1.y > ey0 && l1.y < ey1;
    if (clipSeg(l0, l1, ex0, ey0, ex1, ey1) <= 0.0 && !in1) { continue; }
    let in0 = l0.x > ex0 && l0.x < ex1 && l0.y > ey0 && l0.y < ey1;
    if (!in0) {
      let t = lb.x;
      if (t < bestT) {
        bestT = t;
        let h = l0 + t * (l1 - l0);
        let s = nearestSide(abs(h.x - ex0), abs(h.x - ex1), abs(h.y - ey0), abs(h.y - ey1));
        side = s;
        qx = vec2<f32>(select(select(h.x, ex1, s == 1u), ex0, s == 0u), select(select(h.y, ey1, s == 3u), ey0, s == 2u));
      }
    } else if (in1 && bestT > 1e29) {
      let s = nearestSide(l1.x - ex0, ex1 - l1.x, l1.y - ey0, ey1 - l1.y);
      side = s;
      qx = vec2<f32>(select(select(l1.x, ex1, s == 1u), ex0, s == 0u), select(select(l1.y, ey1, s == 3u), ey0, s == 2u));
      bestT = 2.0;
    }
  }
  if (side > 3u) { return res; }
  let tiny = 1e-4 * P.dx;
  let nl = vec2<f32>(select(select(0.0, 1.0, side == 1u), -1.0, side == 0u), select(select(0.0, 1.0, side == 3u), -1.0, side == 2u));
  let lq = qx + nl * tiny;
  let c = bv(b, B_COS);
  let s = bv(b, B_SIN);
  let wx = bv(b, B_X) + c * lq.x - s * lq.y;
  let wy = bv(b, B_Y) + s * lq.x + c * lq.y;
  res.hit = true;
  res.p = vec2<f32>(clamp(wx, tiny, P.boxw - tiny), clamp(wy, tiny, P.boxh - tiny));
  res.n = vec2<f32>(c * nl.x - s * nl.y, s * nl.x + c * nl.y);
  return res;
}
/* Der Weg eines Teilchens von a nach w bei stehenden Körpern (BodyCover.hit, drei Durchgänge): Ort, Normale, Geschwindigkeit des Körpers. */
struct Hit { hit: bool, p: vec2<f32>, n: vec2<f32>, v: vec2<f32> }
fn hitAll(a: vec2<f32>, w: vec2<f32>) -> Hit {
  var h: Hit;
  h.hit = false;
  var p = w;
  let m = 2.0 * P.dx;
  for (var ps = 0u; ps < 3u; ps++) {
    var any = false;
    for (var b = 0u; b < P.nbody; b++) {
      if (bGone(b)) { continue; }
      if (max(p.x, a.x) < bv(b, B_BX0) - m || min(p.x, a.x) > bv(b, B_BX1) + m || max(p.y, a.y) < bv(b, B_BY0) - m || min(p.y, a.y) > bv(b, B_BY1) + m) { continue; }
      let o = moveOut(b, p, a, vec3<f32>(bv(b, B_X), bv(b, B_Y), bv(b, B_A)));
      if (!o.hit) { continue; }
      p = o.p;
      h.hit = true;
      h.p = p;
      h.n = o.n;
      h.v = bodyV(b, p);
      any = true;
    }
    if (!any) { break; }
  }
  return h;
}
`;

/**
 * Ein Teilchen auf seinem Weg von a nach w an den Körpern (liquidMove.ts): lag es in einem Körper, zurück vor die Seite; seine
 * Geschwindigkeit in den Körper hinein (relativ zu ihm) fällt weg — ein fliegender Tropfen nimmt die des Körpers an.
 */
export const BODY_PARTICLE = `
struct PHit { p: vec2<f32>, v: vec2<f32>, hit: bool }
fn bodyHitP(a: vec2<f32>, w: vec2<f32>, v: vec2<f32>, fly: bool) -> PHit {
  var r = PHit(w, v, false);
  let h = hitAll(a, w);
  if (!h.hit) { return r; }
  r.hit = true;
  r.p = h.p;
  if (fly) { r.v = h.v; return r; }
  let vn = dot(v - h.v, h.n);
  if (vn < 0.0) { r.v = v - vn * h.n; }
  return r;
}
`;

/** Die Geschwindigkeit einer Fläche neben einer geschlossenen Körperzelle (bodyCover.closedFace): sein Randwert U an ihrer Mitte (cu, bod gebunden). */
export const BODY_FACE = `
/* Fläche f (u: i + j (nx + 1), v: nu + …): die Körperzelle daneben, wenn genau eine ihrer Zellen fest ist und sie einem Körper gehört; sonst NONE. */
fn faceBody(f: u32) -> u32 {
  let n = P.n;
  var a = NONE;
  var c = NONE;
  if (f < P.nu) {
    let i = f % (P.nx + 1u);
    let j = f / (P.nx + 1u);
    if (i > 0u) { a = i - 1u + j * P.nx; }
    if (i < P.nx) { c = i + j * P.nx; }
  } else {
    let g = f - P.nu;
    let i = g % P.nx;
    let j = g / P.nx;
    if (j > 0u) { a = i + (j - 1u) * P.nx; }
    if (j < P.ny) { c = i + j * P.nx; }
  }
  let sa = a != NONE && cu[U_SOLID * n + a] != 0u;
  let sc = c != NONE && cu[U_SOLID * n + c] != 0u;
  if (sa == sc) { return NONE; }
  let own = cu[U_OWNER * n + select(c, a, sa)];
  if (own == 0u) { return NONE; }
  return own - 1u;
}
/* Ihre Normalgeschwindigkeit mit dem Körper b (u: x-Komponente an (iΔx, (j + ½)Δx), v: y-Komponente an ((i + ½)Δx, jΔx)). */
fn faceVelB(f: u32, b: u32) -> f32 {
  if (f < P.nu) {
    let i = f % (P.nx + 1u);
    let j = f / (P.nx + 1u);
    return bodyU(b, vec2<f32>(f32(i) * P.dx, (f32(j) + 0.5) * P.dx)).x;
  }
  let g = f - P.nu;
  let i = g % P.nx;
  let j = g / P.nx;
  return bodyU(b, vec2<f32>((f32(i) + 0.5) * P.dx, f32(j) * P.dx)).y;
}
`;
