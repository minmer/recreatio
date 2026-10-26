/**
 * LABOR 2D (v2) — SCHMELZEN AUF DER GPU: DER KERN mMelt (seit 2026-10-26; der
 * Ablauf in kbodymelt.ts). EINE Arbeitsgruppe nimmt die schmelzbaren Körper
 * der Reihe nach wie bodyMelt.step — die Seiten eines Körpers der Reihe nach,
 * je Seite viele Fäden (Punkte längs der Seite, Randzellen, innere Zellen).
 * So bleibt die Reihenfolge der CPU, wo sie zählt: eine Zelle friert an die
 * erste Seite an, die sie fragt; was eine Seite abgibt, sehen die Züge der
 * nächsten; zwei Körper teilen sich keine Teilchen in einem Aufruf.
 *
 * Je Körper (bodyMelt.body; Eis aus einem Rechteck):
 *
 *  1. T_f je Seite aus Salz und Wasser der Zellen vor ihr (meltSides.freezingAt,
 *     mit der Wiederholung gleich daneben ausgelassen wie fluidFront), ob Fluid
 *     davor liegt.
 *  2. Die Zufuhr Σ k (T − T_f)⁺ · Länge (supplyAt); wo Wasser kälter als T_f vor
 *     der Seite liegt, der Anspruch auf die Zelle (die kleinste Seite, dann der
 *     erste Punkt gewinnt — planFreeze: „die erste Seite, die fragt“).
 *  3. Die Überschüsse der inneren Zellen über T_f an die Seiten (excess).
 *  4. Der Nenner Σ s [L + c_p (T_f − T)] je Seite und, wer anfrieren will, was
 *     er bekam (die Zelle gibt m = min(½ W, C (T_f − T_l)/L)).
 *  5. Die Züge: schmelzen um δ = Q/(ρ D Nenner) — die Randzellen verlieren ihre
 *     Scheibe, das Schmelzwasser (Masse, Energie samt Versatz e0 und Q, Salz der
 *     Kruste) geht an die Wasserteilchen vor der Seite, sonst wartet es an der
 *     Seite oder quillt an den Enden einer aufliegenden Seite hervor
 *     (meltWater.give, hold); ohne Nenner die Wärme zurück; anfrieren (die Seite
 *     wächst um die geplante Masse, die Randzellen bekommen Eis bei T_f).
 *  6. Dünner als 0,25 Δx: ganz geschmolzen (weg); zu dünne oder dicke Randreihen:
 *     die inneren Zellen neu (regrid, nach Fläche); der Schwerpunkt neu (derive),
 *     Masse, Trägheit, Seiten; neu ins Gitter im nächsten Schritt (B_AGAIN), ein
 *     schlafender Körper wacht auf, ein gewachsener schiebt Teilchen hinaus.
 *
 * Die Sammler des Schmelzwassers und die Ansprüche liegen in Zellfeldern (at,
 * cf); die Teilchen ändert erst mApply.
 */

import type { KernelDef } from './kernel';
import { BODY_ACCESS, BODY_GEOM } from './kbodylib';
import { MELT_CONSTS, MELT_FRONT, MELT_GEO } from './kbodymelt';

const WG = 128;

/**
 * Speicher der Arbeitsgruppe. wacc (f32-Summen über Vergleichen-und-Tauschen): 0–3 Salz, 4–7 Wasser vor der Seite, 8–11 Zufuhr,
 * 12–15 Überschuss Q, 16–19 Nenner, 20–23 geplantes Anfrieren, 24–26 Energie, Film, Kruste einer Scheibe, 27 Σ m der Nehmer,
 * 28–30 Energie, Film, Kruste eines ganz geschmolzenen Körpers. wv (von Faden 0 geschrieben): 0–3 T_f, 4–7 h_Eis, 8–11 L,
 * 12–15 Schmelztiefe, 16–19 Wärme zurück, 20–21 Scheibe (Dicke, neue Grenze), 22–23 Wachsen, 24–26 Schmelzwasser (Masse, Enthalpie,
 * Salz), 27–28 neue Aufteilung, 29 Seite des letzten Rests, 32 gewachsen.
 */
const SHARED = `
const WGM: u32 = ${WG}u;
const NLIST: u32 = 1024u;
var<workgroup> wacc: array<atomic<u32>, 32>;
var<workgroup> wv: array<f32, 40>;
var<workgroup> wlist: array<u32, NLIST>;
var<workgroup> wcount: atomic<u32>;
var<workgroup> wflag: atomic<u32>;
var<workgroup> wopen: u32;
var<workgroup> wstamp: u32;
var<workgroup> wdec: u32;
fn waddF(i: u32, v: f32) {
  if (v == 0.0) { return; }
  var old = atomicLoad(&wacc[i]);
  loop {
    let r = atomicCompareExchangeWeak(&wacc[i], old, bitcast<u32>(bitcast<f32>(old) + v));
    if (r.exchanged) { break; }
    old = r.old_value;
  }
}
fn wgetF(i: u32) -> f32 { return bitcast<f32>(atomicLoad(&wacc[i])); }
/* Der Wert von Faden 0 für alle (gleichförmig: Verzweigungen mit Barrieren dürfen davon abhängen). */
fn uni(lid: u32, v: u32) -> u32 {
  if (lid == 0u) { wdec = v; }
  let r = workgroupUniformLoad(&wdec);
  workgroupBarrier();
  return r;
}
/* Punkte aller vier Seiten (np je Seite) oder Randzellen (je Seite) der Reihe nach: (Seite, Index); Seite 4: dahinter. */
fn pointAt(np: vec4<u32>, t: u32) -> vec2<u32> {
  var q = t;
  for (var s = 0u; s < 4u; s++) { if (q < np[s]) { return vec2<u32>(s, q); } q -= np[s]; }
  return vec2<u32>(4u, 0u);
}
fn npOf(rq: u32) -> vec4<u32> { return vec4<u32>(sideOf(rq, 0u).np, sideOf(rq, 1u).np, sideOf(rq, 2u).np, sideOf(rq, 3u).np); }
fn sideLen(rq: u32, s: u32) -> f32 { let bx = rBox(rq); return select(bx.z - bx.x, bx.w - bx.y, s < 2u); }
/* Die Grenze, die an der Seite s rückt (Platz in bgeo), und die Dicke der Randreihe dort. */
fn coordAt(rq: u32, s: u32) -> u32 {
  if (s == 0u) { return u32(rv(rq, GR_XO)); }
  if (s == 1u) { return u32(rv(rq, GR_XO)) + u32(rv(rq, GR_NI)); }
  if (s == 2u) { return u32(rv(rq, GR_YO)); }
  return u32(rv(rq, GR_YO)) + u32(rv(rq, GR_NJ));
}
fn rowThick(rq: u32, s: u32) -> f32 {
  let ni = u32(rv(rq, GR_NI));
  let nj = u32(rv(rq, GR_NJ));
  if (s == 0u) { return rxs(rq, 1u) - rxs(rq, 0u); }
  if (s == 1u) { return rxs(rq, ni) - rxs(rq, ni - 1u); }
  if (s == 2u) { return rys(rq, 1u) - rys(rq, 0u); }
  return rys(rq, nj) - rys(rq, nj - 1u);
}
/* Die Grenze der Seite s auf v (und das Rechteck mit ihr). */
fn setCoord(rq: u32, s: u32, v: f32) {
  bgeo[coordAt(rq, s)] = v;
  let r = GEO_RECTS + rq * RS;
  if (s == 0u) { bgeo[r + GR_X0] = v; } else if (s == 1u) { bgeo[r + GR_X1] = v; } else if (s == 2u) { bgeo[r + GR_Y0] = v; } else { bgeo[r + GR_Y1] = v; }
}
`;

/** Anfrieren: was eine Zelle vor der Seite s gibt (planFreeze; 0: nichts) — Wasser kälter als T_f, so viel, wie die frei werdende Wärme auf T_f bringt. */
const FREEZE = `
fn wantOf(c: u32, s: u32) -> f32 {
  let n = P.n;
  let C = cf[F_MC * n + c];
  let W = cf[F_MW * n + c];
  if (!(C > 0.0) || !(W > 0.0)) { return 0.0; }
  let Tl = cf[F_MCT * n + c] / C;
  let tf = wv[s];
  if (Tl >= tf) { return 0.0; }
  return min(FREEZE_M * W, C * (tf - Tl) / max(1.0, wv[8u + s]));
}
/* Wer die Zelle bekommt: die kleinste Seite, dann der erste Punkt (der grösste Schlüssel). */
fn claimKey(s: u32, q: u32) -> u32 { return ((3u - s) << 24u) | (0xFFFFFFu - min(q, 0xFFFFFEu)); }
fn claimTry(c: u32, s: u32, key: u32) {
  if (wantOf(c, s) > 0.0) { atomicMax(&at[A_MCLAIM * P.n + c], key); atomicOr(&wflag, 1u); }
}
fn claimTake(c: u32, s: u32, key: u32) {
  let want = wantOf(c, s);
  if (!(want > 0.0) || atomicLoad(&at[A_MCLAIM * P.n + c]) != key) { return; }
  cf[F_MFZ * P.n + c] = want;
  cf[F_MHI * P.n + c] = wv[4u + s];
  waddF(20u + s, want);
}
`;

/** Schmelzwasser an die Wasserteilchen vor der Seite (meltWater.give, hold). */
const GIVE = `
/* Eine Zelle vor der Seite nimmt Schmelzwasser, wenn sie Flüssigkeit mit Wasserteilchen ist (einmal je Geben). */
fn takerCell(c: u32, stamp: u32) {
  if (c == NONE || cu[U_KIND * P.n + c] != LIQUID) { return; }
  let old = atomicMax(&at[A_MSEEN * P.n + c], stamp);
  if (old >= stamp) { return; }
  let WM = cf[F_MWM * P.n + c];
  if (!(WM > 0.0)) { return; }
  let i = atomicAdd(&wcount, 1u);
  if (i >= NLIST) { return; }
  wlist[i] = c;
  waddF(27u, WM);
}
/* Schmelzwasser ohne Nehmer davor an der Seite a sammeln — vor ihrer Mitte oder, kam es von der aufliegenden Seite src, eine halbe Zelle vor der Ecke zu ihr. */
fn holdM(b: u32, rq: u32, a: u32, m: f32, H: f32, salt: f32, src: u32) {
  let bx = rBox(rq);
  var lx = 0.5 * (bx.x + bx.z);
  var ly = 0.5 * (bx.y + bx.w);
  var nl = vec2<f32>(0.0, 1.0);
  if (a == 0u) { lx = bx.x; nl = vec2<f32>(-1.0, 0.0); } else if (a == 1u) { lx = bx.z; nl = vec2<f32>(1.0, 0.0); }
  else if (a == 2u) { ly = bx.y; nl = vec2<f32>(0.0, -1.0); } else { ly = bx.w; }
  if (src == 2u) { ly = min(bx.w, bx.y + 0.5 * P.dx); } else if (src == 3u) { ly = max(bx.y, bx.w - 0.5 * P.dx); }
  else if (src == 0u) { lx = min(bx.z, bx.x + 0.5 * P.dx); } else if (src == 1u) { lx = max(bx.x, bx.z - 0.5 * P.dx); }
  let o = mo(b) + MLT_PEND + a * PEND_W;
  bmelt[o] += m;
  bmelt[o + 1u] += H;
  bmelt[o + 2u] += salt;
  let w = toWorldB(b, vec2<f32>(lx, ly));
  let nw = rotB(b, nl);
  bmelt[o + 3u] = w.x; bmelt[o + 4u] = w.y; bmelt[o + 5u] = nw.x; bmelt[o + 6u] = nw.y;
}
/*
 * Ein Geben an die Seite a (src 4: die eigene; 0–3: hervorgequollen von dieser aufliegenden Seite): erst die Zellen knapp vor und knapp
 * in der Seite, ohne Nehmer dort auch eine Zelle weiter; nach der Masse der Wasserteilchen in die Sammler der Zellen. Ohne Nehmer: liegt
 * kein Fluid davor (und ist es das eigene Wasser), 1 — es quillt an den Enden hervor; sonst wartet es an der Seite.
 */
fn giveTry(b: u32, rq: u32, a: u32, m: f32, H: f32, salt: f32, src: u32, lid: u32, closed: f32) -> u32 {
  if (lid == 0u) { wstamp += 1u; atomicStore(&wcount, 0u); atomicStore(&wacc[27], 0u); atomicStore(&wflag, 0u); }
  let stamp = uni(lid, wstamp);
  let sd = sideOf(rq, a);
  for (var q = lid; q < sd.np; q += WGM) {
    let p = frontPoint(b, sd, q, closed);
    if (!p.fluid) { continue; }
    atomicOr(&wflag, 1u);
    takerCell(p.out, stamp);
    if (innOk(p)) { takerCell(p.inn, stamp); }
  }
  workgroupBarrier();
  var st = 0u;
  if (lid == 0u) { st = select(2u, 1u, wgetF(27u) > 0.0); }
  st = uni(lid, st);
  if (st == 2u) {
    for (var q = lid; q < sd.np; q += WGM) {
      let p = frontPoint(b, sd, q, closed);
      if (!p.fluid) { continue; }
      takerCell(p.out, stamp);
      if (farOk(b, p)) { takerCell(p.far, stamp); }
      if (innOk(p)) { takerCell(p.inn, stamp); }
    }
    workgroupBarrier();
    var s2 = 4u;
    if (lid == 0u) {
      if (wgetF(27u) > 0.0) { s2 = 1u; } else if (atomicLoad(&wflag) == 0u && src > 3u) { s2 = 3u; }
    }
    st = uni(lid, s2);
  }
  if (st == 1u) {
    let wsum = wgetF(27u);
    let k = min(atomicLoad(&wcount), NLIST);
    for (var i = lid; i < k; i += WGM) {
      let c = wlist[i];
      let fr = cf[F_MWM * P.n + c] / wsum;
      addF_at(A_MGM * P.n + c, fr * m);
      addF_at(A_MGH * P.n + c, fr * H);
      if (salt > 0.0) { addF_at(A_MGS * P.n + c, fr * salt); }
    }
  }
  if (st == 4u && lid == 0u) { holdM(b, rq, a, m, H, salt, src); }
  storageBarrier();
  workgroupBarrier();
  return select(0u, 1u, st == 3u);
}
/* Das Schmelzwasser in wv[24–26] an die Seite s; ohne Fluid davor je zur Hälfte an die beiden Nachbarseiten, an das Ende zu s. */
fn giveTop(b: u32, rq: u32, s: u32, lid: u32, closed: f32) {
  let m = wv[24];
  let H = wv[25];
  let salt = wv[26];
  if (giveTry(b, rq, s, m, H, salt, 4u, lid, closed) == 1u) {
    let a1 = select(0u, 2u, s < 2u);
    giveTry(b, rq, a1, 0.5 * m, 0.5 * H, 0.5 * salt, s, lid, closed);
    giveTry(b, rq, a1 + 1u, 0.5 * m, 0.5 * H, 0.5 * salt, s, lid, closed);
  }
}
/* Die Wärme wv[16 + s] zurück in die Randzellen der Seite s (nach Länge; bodyMelt.giveBack). */
fn giveBackSide(rq: u32, s: u32, lid: u32) {
  let Q = wv[16u + s];
  let len = sideLen(rq, s);
  let along = alongOf(rq, s);
  for (var t = lid; t < along; t += WGM) {
    let e = edgeCell(rq, s, t);
    if (len > 0.0) { bcell[BC * e.k] += Q * e.len / len; } else if (t == 0u) { bcell[BC * u32(rv(rq, GR_KO))] += Q; }
  }
  storageBarrier();
  workgroupBarrier();
}
`;

/** Die Züge und die Ordnung der inneren Zellen. */
const MOVES = `
/* Die Seite s um wv[12 + s] nach innen (höchstens die Randreihe): die Randzellen verlieren ihre Scheibe; das Schmelzwasser davor (bodyMelt.melt). */
fn meltSide(b: u32, rq: u32, s: u32, lid: u32, rho: f32, e0: f32, closed: f32) {
  if (lid == 0u) {
    let dd = min(wv[12u + s], rowThick(rq, s));
    let old = bgeo[coordAt(rq, s)];
    /* In f32 gerundet: die Scheibe ist, was die Grenze wirklich rückt (sonst stimmten Masse des Körpers und Schmelzwasser nicht überein). */
    let nw = old + select(-dd, dd, s == 0u || s == 2u);
    wv[20] = abs(nw - old);
    wv[21] = nw;
    atomicStore(&wacc[24], 0u); atomicStore(&wacc[25], 0u); atomicStore(&wacc[26], 0u);
  }
  workgroupBarrier();
  let dd = wv[20];
  let along = alongOf(rq, s);
  for (var t = lid; t < along; t += WGM) {
    let e = edgeCell(rq, s, t);
    if (!(e.vol > 0.0)) { continue; }
    let fr = e.len * dd * P.depth / e.vol;
    let o = BC * e.k;
    let E = bcell[o];
    let F = bcell[o + 1u];
    let K = bcell[o + 2u];
    waddF(24u, fr * E); waddF(25u, fr * F); waddF(26u, fr * K);
    bcell[o] = E - fr * E; bcell[o + 1u] = F - fr * F; bcell[o + 2u] = K - fr * K;
  }
  storageBarrier();
  workgroupBarrier();
  var ok = 0u;
  if (lid == 0u) {
    let m = rho * sideLen(rq, s) * dd * P.depth;
    setCoord(rq, s, wv[21]);
    let Q = wgetF(12u + s);
    if (m > 0.0) {
      addF_cnt(C_MELTED, m);
      wv[24] = m + wgetF(25u) + wgetF(26u);
      wv[25] = wgetF(24u) + m * e0 + Q;
      wv[26] = wgetF(26u);
      ok = 1u;
    } else { wv[16u + s] = Q + wgetF(24u); }
  }
  ok = uni(lid, ok);
  if (ok == 1u) { giveTop(b, rq, s, lid, closed); } else { giveBackSide(rq, s, lid); }
}
/* Die Seite s wächst um die geplante Masse (aus der jetzigen Länge der Seite); die Randzellen bekommen die Scheibe Eis bei T_f (bodyMelt.grow). */
fn growSide(rq: u32, s: u32, lid: u32, rho: f32, cp: f32) {
  if (lid == 0u) {
    let m = wgetF(20u + s);
    let d = m / (rho * P.depth * sideLen(rq, s));
    let old = bgeo[coordAt(rq, s)];
    let nw = old + select(d, -d, s == 0u || s == 2u);
    wv[22] = abs(nw - old);
    wv[23] = nw;
    wv[32] = 1.0;
    addF_cnt(C_FROZEN, m);
  }
  workgroupBarrier();
  let d = wv[22];
  let tf = wv[s];
  let along = alongOf(rq, s);
  for (var t = lid; t < along; t += WGM) {
    let e = edgeCell(rq, s, t);
    bcell[BC * e.k] += rho * e.len * d * P.depth * cp * (tf - T0);
  }
  storageBarrier();
  workgroupBarrier();
  if (lid == 0u) { setCoord(rq, s, wv[23]); }
  storageBarrier();
  workgroupBarrier();
}
/* Ganz geschmolzen: Masse, Energie samt Versatz, Film und Kruste werden Schmelzwasser an der Seite mit der längsten freien Strecke; der Körper ist weg (bodyMelt.tidy). */
fn goneBody(b: u32, rq: u32, lid: u32, rho: f32, e0: f32, closed: f32) {
  if (lid == 0u) { atomicStore(&wacc[28], 0u); atomicStore(&wacc[29], 0u); atomicStore(&wacc[30], 0u); }
  workgroupBarrier();
  let nk = u32(rv(rq, GR_NI)) * u32(rv(rq, GR_NJ));
  let ko = u32(rv(rq, GR_KO));
  for (var k = lid; k < nk; k += WGM) { let o = BC * (ko + k); waddF(28u, bcell[o]); waddF(29u, bcell[o + 1u]); waddF(30u, bcell[o + 2u]); }
  workgroupBarrier();
  if (lid == 0u) {
    let bx = rBox(rq);
    let w = bx.z - bx.x;
    let h = bx.w - bx.y;
    let m = rho * w * h * P.depth;
    addF_cnt(C_MELTED, m);
    wv[24] = m + wgetF(29u) + wgetF(30u);
    wv[25] = wgetF(28u) + m * e0;
    wv[26] = wgetF(30u);
    wv[29] = select(0.0, 2.0, w > h);
  }
  workgroupBarrier();
  giveTop(b, rq, u32(wv[29]), lid, closed);
  if (lid == 0u) {
    let o = b * BS;
    bod[o + B_GONE] = 1.0; bod[o + B_AGAIN] = 1.0; bod[o + B_NCELL] = 0.0; bod[o + B_M] = 0.0;
    bod[o + B_VX] = 0.0; bod[o + B_VY] = 0.0; bod[o + B_W] = 0.0;
  }
  storageBarrier();
  workgroupBarrier();
}
/* Die inneren Zellen neu (gleich grosse Stücke von etwa Δx; regrid): Energie, Film und Kruste nach Fläche aus den alten (über bmelt). */
fn regridBody(b: u32, rq: u32, lid: u32) {
  let ni = u32(rv(rq, GR_NI));
  let nj = u32(rv(rq, GR_NJ));
  let ko = u32(rv(rq, GR_KO));
  let xo = u32(rv(rq, GR_XO));
  let yo = u32(rv(rq, GR_YO));
  let scr = u32(bmelt[0]);
  let nk = ni * nj;
  let sx = scr + 3u * nk;
  let sy = sx + ni + 1u;
  for (var t = lid; t < nk; t += WGM) {
    let o = BC * (ko + t);
    bmelt[scr + 3u * t] = bcell[o]; bmelt[scr + 3u * t + 1u] = bcell[o + 1u]; bmelt[scr + 3u * t + 2u] = bcell[o + 2u];
  }
  for (var t = lid; t <= ni; t += WGM) { bmelt[sx + t] = bgeo[xo + t]; }
  for (var t = lid; t <= nj; t += WGM) { bmelt[sy + t] = bgeo[yo + t]; }
  storageBarrier();
  workgroupBarrier();
  let ni2 = u32(wv[27]);
  let nj2 = u32(wv[28]);
  let bx = rBox(rq);
  for (var t = lid; t <= ni2; t += WGM) { bgeo[xo + t] = select(bx.x + (bx.z - bx.x) * f32(t) / f32(ni2), bx.z, t == ni2); }
  for (var t = lid; t <= nj2; t += WGM) { bgeo[yo + t] = select(bx.y + (bx.w - bx.y) * f32(t) / f32(nj2), bx.w, t == nj2); }
  if (lid == 0u) {
    bgeo[GEO_RECTS + rq * RS + GR_NI] = f32(ni2);
    bgeo[GEO_RECTS + rq * RS + GR_NJ] = f32(nj2);
    bod[b * BS + B_NCELL] = f32(ni2 * nj2);
  }
  storageBarrier();
  workgroupBarrier();
  for (var k = lid; k < ni2 * nj2; k += WGM) {
    let p = k % ni2;
    let q = k / ni2;
    let ax0 = bgeo[xo + p]; let ax1 = bgeo[xo + p + 1u]; let ay0 = bgeo[yo + q]; let ay1 = bgeo[yo + q + 1u];
    var E = 0.0; var F = 0.0; var K = 0.0;
    for (var oq = 0u; oq < nj; oq++) {
      let oy = min(ay1, bmelt[sy + oq + 1u]) - max(ay0, bmelt[sy + oq]);
      if (oy <= 0.0) { continue; }
      for (var op = 0u; op < ni; op++) {
        let ox = min(ax1, bmelt[sx + op + 1u]) - max(ax0, bmelt[sx + op]);
        if (ox <= 0.0) { continue; }
        let share = ox * oy / ((bmelt[sx + op + 1u] - bmelt[sx + op]) * (bmelt[sy + oq + 1u] - bmelt[sy + oq]));
        let ok = scr + 3u * (op + oq * ni);
        E += share * bmelt[ok]; F += share * bmelt[ok + 1u]; K += share * bmelt[ok + 2u];
      }
    }
    let o = BC * (ko + k);
    bcell[o] = E; bcell[o + 1u] = F; bcell[o + 2u] = K; bcell[o + 3u] = f32(rq);
  }
  storageBarrier();
  workgroupBarrier();
}
/* Der Schwerpunkt (die Mitte des Rechtecks) in den Ursprung des Rahmens, die Lage mit (die Welt bleibt); Masse, Trägheit, Hülle, Seiten (Body2D.derive). */
fn deriveBody(b: u32, rq: u32, lid: u32, rho: f32) {
  let bx = rBox(rq);
  let cx = 0.5 * (bx.x + bx.z);
  let cy = 0.5 * (bx.y + bx.w);
  let ni = u32(rv(rq, GR_NI));
  let nj = u32(rv(rq, GR_NJ));
  let xo = u32(rv(rq, GR_XO));
  let yo = u32(rv(rq, GR_YO));
  storageBarrier();
  workgroupBarrier();
  for (var t = lid; t <= ni; t += WGM) { bgeo[xo + t] -= cx; }
  for (var t = lid; t <= nj; t += WGM) { bgeo[yo + t] -= cy; }
  storageBarrier();
  workgroupBarrier();
  if (lid == 0u) {
    let x0 = bgeo[xo]; let x1 = bgeo[xo + ni]; let y0 = bgeo[yo]; let y1 = bgeo[yo + nj];
    let r = GEO_RECTS + rq * RS;
    bgeo[r + GR_X0] = x0; bgeo[r + GR_Y0] = y0; bgeo[r + GR_X1] = x1; bgeo[r + GR_Y1] = y1;
    let so = u32(bgeo[GH_SEGS]) + u32(bv(b, B_SO)) * SS;
    for (var s = 0u; s < 4u; s++) {
      bgeo[so + s * SS + GS_T0] = select(x0, y0, s < 2u);
      bgeo[so + s * SS + GS_T1] = select(x1, y1, s < 2u);
    }
    let o = b * BS;
    let c = bod[o + B_COS];
    let sn = bod[o + B_SIN];
    let ox = c * cx - sn * cy;
    let oy = sn * cx + c * cy;
    bod[o + B_X] += ox; bod[o + B_Y] += oy; bod[o + B_RX] += ox; bod[o + B_RY] += oy;
    let w = x1 - x0;
    let h = y1 - y0;
    let m = rho * w * h * P.depth;
    bod[o + B_M] = m;
    bod[o + B_I] = m * (w * w + h * h) / 12.0;
    bod[o + B_RMAX] = 0.5 * sqrt(w * w + h * h);
    bod[o + B_HULLA] = w * h;
    bod[o + B_HULLJ] = w * h * (w * w + h * h) / 12.0;
    bod[o + B_VOL] = w * h * P.depth;
    bod[o + B_AGAIN] = 1.0;
    if (wv[32] != 0.0) { bod[o + B_PUSH] = 1.0; }
    /* Er wacht auf (er sinkt oder steigt, wenn er leichter wird — Bodies.reshaped); seine zuletzt gemessene mitbewegte Masse bleibt (kbodydyn.ts wakeB). */
    if (bod[o + B_PINNED] == 0.0 && bod[o + B_ASLEEP] != 0.0) {
      bod[o + B_ASLEEP] = 0.0; bod[o + B_REST] = 0.0;
      for (var d = 0u; d < 3u; d++) { bod[o + B_PREV + d] = 0.0; bod[o + B_PRED + d] = 0.0; bod[o + B_PNOW + d] = 0.0; bod[o + B_POLD + d] = 0.0; }
    }
  }
  storageBarrier();
  workgroupBarrier();
}
`;

const BODY = `
fn meltBody(b: u32, lid: u32) {
  let n = P.n;
  let rq = rectOf(b, 0u);
  let closed = select(CLOSED_P, REOPEN_F, bFree(b));
  let mb = u32(bv(b, B_MAT)) + 1u;
  let rho = solidRho(mb);
  let cp = solidCp(mb);
  let e0 = bv(b, B_E0);
  if (lid < 32u) { atomicStore(&wacc[lid], 0u); }
  if (lid == 0u) { atomicStore(&wflag, 0u); wv[32] = 0.0; }
  workgroupBarrier();
  let np = npOf(rq);
  let ntot = np.x + np.y + np.z + np.w;
  /* 1. T_f je Seite (freezingAt): Salz und Wasser der Zellen davor, die Wiederholung gleich daneben ausgelassen (fluidFront). */
  for (var t = lid; t < ntot; t += WGM) {
    let sq = pointAt(np, t);
    let s = sq.x;
    let sd = sideOf(rq, s);
    let p = frontPoint(b, sd, sq.y, closed);
    if (!p.fluid) { continue; }
    var lastOut = NONE;
    var lastFar = NONE;
    var lastIn = NONE;
    if (sq.y > 0u) {
      let p1 = frontPoint(b, sd, sq.y - 1u, closed);
      lastOut = p1.out;
      if (p1.fluid) { lastFar = p1.far; lastIn = p1.inn; }
      else {
        var k = sq.y - 1u;
        loop {
          if (k == 0u) { break; }
          k -= 1u;
          let pp = frontPoint(b, sd, k, closed);
          if (pp.fluid) { lastFar = pp.far; lastIn = pp.inn; break; }
        }
      }
    }
    atomicOr(&wflag, 1u << s);
    if (p.out != lastOut) { waddF(s, cf[F_MS * n + p.out]); waddF(4u + s, cf[F_MW * n + p.out]); }
    if (p.far != lastFar && farOk(b, p)) { waddF(s, cf[F_MS * n + p.far]); waddF(4u + s, cf[F_MW * n + p.far]); }
    if (p.inn != lastIn && innOk(p)) { waddF(s, cf[F_MS * n + p.inn]); waddF(4u + s, cf[F_MW * n + p.inn]); }
  }
  workgroupBarrier();
  if (lid == 0u) {
    wopen = atomicLoad(&wflag);
    atomicStore(&wflag, 0u);
    for (var s = 0u; s < 4u; s++) {
      let tf = tfOf(wgetF(s), wgetF(4u + s));
      let hIce = cp * (tf - T0) + e0;
      wv[s] = tf;
      wv[4u + s] = hIce;
      wv[8u + s] = hL(tf) - hIce;
    }
  }
  workgroupBarrier();
  /* 2. Zufuhr je Seite (supplyAt): Σ k (T − T_f)⁺ · Länge über die Zellen knapp davor; Ansprüche auf Anfrieren. */
  for (var t = lid; t < ntot; t += WGM) {
    let sq = pointAt(np, t);
    let s = sq.x;
    let p = frontPoint(b, sideOf(rq, s), sq.y, closed);
    let tf = wv[s];
    if (p.out != NONE) {
      let c = p.out;
      let sol = cu[U_SOLID * n + c];
      var T = cf[F_T * n + c];
      var kc = 0.0;
      if (sol != 0u) { kc = solidK(sol); }
      else if (cf[F_MC * n + c] > 0.0) { T = cf[F_MCT * n + c] / cf[F_MC * n + c]; kc = kL(T); }
      else { kc = kMix(cf[F_MN * n + c], cf[F_MO * n + c], cf[F_MV * n + c], T); }
      if (T > tf) { waddF(8u + s, kc * (T - tf) * p.len); }
    }
    if (p.fluid) {
      let key = claimKey(s, sq.y);
      claimTry(p.out, s, key);
      if (farOk(b, p)) { claimTry(p.far, s, key); }
      if (innOk(p)) { claimTry(p.inn, s, key); }
    }
  }
  workgroupBarrier();
  /* 3. Die Überschüsse über T_f (excess): eine Randzelle an ihre Seiten mit Zufuhr (nach deren Anteil), sonst an die nächste offene (ohne offene: die nächste) Seite. */
  let ni = u32(rv(rq, GR_NI));
  let nj = u32(rv(rq, GR_NJ));
  let ko = u32(rv(rq, GR_KO));
  let open = wopen;
  let tfs = vec4<f32>(wv[0], wv[1], wv[2], wv[3]);
  let lowest = min(min(tfs.x, tfs.y), min(tfs.z, tfs.w));
  let sups = vec4<f32>(wgetF(8u), wgetF(9u), wgetF(10u), wgetF(11u));
  let bx = rBox(rq);
  for (var k = lid; k < ni * nj; k += WGM) {
    let p = k % ni;
    let q = k / ni;
    let x0 = rxs(rq, p); let x1 = rxs(rq, p + 1u); let y0 = rys(rq, q); let y1 = rys(rq, q + 1u);
    let C = rho * cp * (x1 - x0) * (y1 - y0) * P.depth;
    let o = BC * (ko + k);
    let E = bcell[o];
    let film = bcell[o + 1u];
    let crust = bcell[o + 2u];
    let T = cellTM(E, C, film, crust);
    if (!(T > lowest)) { continue; }
    var cs = vec2<u32>(0u, 0u);
    var cw = vec2<f32>(0.0, 0.0);
    var nn = 0u;
    var ws = 0.0;
    for (var s = 0u; s < 4u; s++) {
      if (nn >= 2u) { break; }
      var edge = false;
      if (s == 0u) { edge = p == 0u; } else if (s == 1u) { edge = p == ni - 1u; } else if (s == 2u) { edge = q == 0u; } else { edge = q == nj - 1u; }
      if (!edge || !(sups[s] > 0.0)) { continue; }
      cs[nn] = s;
      cw[nn] = sups[s];
      ws += sups[s];
      nn += 1u;
    }
    if (nn > 0u) {
      var Ek = E;
      for (var i = 0u; i < nn; i++) {
        let ex = (cw[i] / ws) * (E - solidEnergyM(C, film, crust, tfs[cs[i]]));
        if (!(ex > 0.0)) { continue; }
        Ek -= ex;
        waddF(12u + cs[i], ex);
      }
      bcell[o] = Ek;
      continue;
    }
    let cx = 0.5 * (x0 + x1);
    let cy = 0.5 * (y0 + y1);
    var best = 0u;
    var dist = 1e30;
    for (var s = 0u; s < 4u; s++) {
      if (open != 0u && (open & (1u << s)) == 0u) { continue; }
      var d = cx - bx.x;
      if (s == 1u) { d = bx.z - cx; } else if (s == 2u) { d = cy - bx.y; } else if (s == 3u) { d = bx.w - cy; }
      if (d < dist) { dist = d; best = s; }
    }
    let tf = tfs[best];
    if (!(T > tf)) { continue; }
    let ex = E - solidEnergyM(C, film, crust, tf);
    if (!(ex > 0.0)) { continue; }
    bcell[o] = E - ex;
    waddF(12u + best, ex);
  }
  storageBarrier();
  workgroupBarrier();
  /* 4. Der Nenner je Seite (die Randzellen nach dem Überschuss); wer eine Zelle zum Anfrieren bekam, nimmt sie. */
  let along = vec4<u32>(nj, nj, ni, ni);
  let etot = 2u * (ni + nj);
  for (var t = lid; t < etot; t += WGM) {
    let st = pointAt(along, t);
    let s = st.x;
    let e = edgeCell(rq, s, st.y);
    let o = BC * e.k;
    let T = cellTM(bcell[o], rho * cp * e.vol, bcell[o + 1u], bcell[o + 2u]);
    let tf = wv[s];
    waddF(16u + s, e.len * (wv[8u + s] + cp * (tf - min(tf, T))));
  }
  var claims = 0u;
  if (lid == 0u) { claims = atomicLoad(&wflag); }
  claims = uni(lid, claims);
  if (claims != 0u) {
    for (var t = lid; t < ntot; t += WGM) {
      let sq = pointAt(np, t);
      let s = sq.x;
      let p = frontPoint(b, sideOf(rq, s), sq.y, closed);
      if (!p.fluid) { continue; }
      let key = claimKey(s, sq.y);
      claimTake(p.out, s, key);
      if (farOk(b, p)) { claimTake(p.far, s, key); }
      if (innOk(p)) { claimTake(p.inn, s, key); }
    }
  }
  workgroupBarrier();
  /* 5. Die Züge je Seite: schmelzen (Q und Nenner), sonst die Wärme zurück; anfrieren (geplant). Bits: 1 ein Zug, 4 + s zurück, 8 + 2 s die Züge der Seite. */
  var dec = 0u;
  if (lid == 0u) {
    for (var s = 0u; s < 4u; s++) {
      let Q = wgetF(12u + s);
      let den = wgetF(16u + s);
      var mv = 0u;
      wv[12u + s] = 0.0;
      wv[16u + s] = 0.0;
      if (Q > 0.0 && den > 0.0) { mv = 1u; wv[12u + s] = Q / (rho * P.depth * den); }
      else if (Q > 0.0) { wv[16u + s] = Q; dec |= 1u << (4u + s); }
      if (wgetF(20u + s) > 0.0) { mv |= 2u; }
      dec |= mv << (8u + 2u * s);
      if (mv != 0u) { dec |= 1u; }
    }
  }
  dec = uni(lid, dec);
  for (var s = 0u; s < 4u; s++) { if (((dec >> (4u + s)) & 1u) != 0u) { giveBackSide(rq, s, lid); } }
  if ((dec & 1u) == 0u) { return; }
  for (var s = 0u; s < 4u; s++) {
    let mv = (dec >> (8u + 2u * s)) & 3u;
    if ((mv & 1u) != 0u) { meltSide(b, rq, s, lid, rho, e0, closed); }
    if ((mv & 2u) != 0u) { growSide(rq, s, lid, rho, cp); }
  }
  /* 6. Ordnung: ganz geschmolzen, neue Aufteilung, neuer Schwerpunkt. */
  var td = 0u;
  if (lid == 0u) {
    let bb = rBox(rq);
    let w = bb.z - bb.x;
    let h = bb.w - bb.y;
    let ni1 = u32(rv(rq, GR_NI));
    let nj1 = u32(rv(rq, GR_NJ));
    if (w < GONE_M * P.dx || h < GONE_M * P.dx) { td = 2u; }
    else {
      var rebuild = false;
      for (var s = 0u; s < 4u; s++) {
        let th = rowThick(rq, s);
        if ((th < THIN_M * P.dx && select(nj1, ni1, s < 2u) > 1u) || th > THICK_M * P.dx) { rebuild = true; }
      }
      if (rebuild) {
        let ni2 = max(1u, u32(floor(w / P.dx + 0.5)));
        let nj2 = max(1u, u32(floor(h / P.dx + 0.5)));
        let o = mo(b);
        if (f32(ni2 * nj2) > bmelt[o + MLT_CAPC] || f32(ni2 + 1u) > bmelt[o + MLT_CAPX] || f32(nj2 + 1u) > bmelt[o + MLT_CAPY]) { atomicAdd(&cnt[C_MELTFULL], 1u); }
        else { td = 1u; wv[27] = f32(ni2); wv[28] = f32(nj2); }
      }
    }
  }
  td = uni(lid, td);
  if (td == 2u) { goneBody(b, rq, lid, rho, e0, closed); return; }
  if (td == 1u) { regridBody(b, rq, lid); }
  deriveBody(b, rq, lid, rho);
}
`;

export const BODY_MELT2_KERNELS: readonly KernelDef[] = [
  {
    name: 'mMelt', wg: WG,
    bind: 'P:u cnt:a bod:w bgeo:w bcell:w bmelt:w cf:w cu:r at:a',
    code: `${BODY_ACCESS}
${BODY_GEOM}
${MELT_CONSTS}
${MELT_GEO}
${MELT_FRONT}
${SHARED}
${FREEZE}
${GIVE}
${MOVES}
${BODY}
@compute @workgroup_size(${WG}) fn main(@builtin(local_invocation_id) lid3: vec3<u32>) {
  let lid = lid3.x;
  if (lid == 0u) { wstamp = 0u; }
  for (var b = 0u; b < P.nbody; b++) {
    var go = 0u;
    if (lid == 0u) { go = select(0u, 1u, bv(b, B_MELT) != 0.0 && !bGone(b)); }
    go = uni(lid, go);
    if (go == 0u) { continue; }
    meltBody(b, lid);
  }
}`
  }
];
