/**
 * LABOR 2D (v2) — KÖRPER AUF DER GPU: INS GITTER (seit 2026-10-26; wie
 * bodies.prepare und bodyCover.rebuild auf der CPU, Stufe „inputs“).
 *
 * Am Anfang jedes Schritts, für jeden Körper, der wach ist (oder eben
 * einschlief, weggetragen wurde, nach dem Hochladen):
 *
 *  1. bPrep: der Randwert U = V + Vorhersage, cos/sin, die Umgrenzung.
 *  2. bPush/bPushB: Teilchen und Blasen auf ihrem Weg im Rahmen des Körpers vor
 *     die Seite zurück, durch die sie kamen (moveOut), ihre Geschwindigkeit in
 *     ihn hinein fällt weg.
 *  3. bCover: je Zelle im Band (die Umgrenzung alt und neu, eine Zelle Rand) der
 *     genaue bedeckte Anteil aller Körper, Wärmekapazität, Energie, Film und
 *     Kruste ihrer Teile, Besitzer, „durchschnitten“, die Bedeckung der linken
 *     und der unteren Fläche.
 *  4. bClose1/bClose2: geschlossen ab CLOSED (0,99; frei 0,9), durchschnitten,
 *     SQUEEZE neben anderem Festem; dann die Regel der Treppe für dünne Wände:
 *     eine ganz bedeckte Fläche zwischen zwei offenen Zellen schliesst die mit
 *     dem grösseren Anteil (gleich: die untere/linke) — erst die u-Flächen, dann
 *     die v-Flächen (wie staircase.ts). Jede Fläche rechnen beide Zellen gleich.
 *  5. bFlip/bApply: eine Zelle, die zugeht, gibt ihr Gas den freien Nachbarn
 *     (sonst der nächsten freien Zelle im Fenster 9 × 9; sonst bleibt es liegen,
 *     gezählt), eine, die aufgeht, wird Flüssigkeit oder holt Gas (je höchstens
 *     ein Viertel) — gasOut/vacate; sie bekommt das Gebiet eines Nachbarn.
 *  6. bStatic: φ_s (B-Spline der Anteile, 1/6, 2/3, 1/6) und der Abstand.
 *
 * Flächen: binär — neben einer geschlossenen Körperzelle zu und mit dem Körper
 * bewegt (bFaceL nach p2g, bFaceG nach markFaces), sonst ganz offen.
 */

import type { KernelDef } from './kernel';
import { BODY_ACCESS, BODY_CELLS, BODY_CONSTS, BODY_FACE, BODY_GEOM, BODY_REC } from './kbodylib';
import { DERIVE, REGSUM } from './kgas';

const WG = 128;
const MAIN = '@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)';
const ONE = '@compute @workgroup_size(WG) fn main(@builtin(local_invocation_id) lid3: vec3<u32>)';

/** Liegt die Zelle (i, j) im Band eines Körpers, der neu ins Gitter muss (Umgrenzung alt und neu, mit dem Rand m)? */
const BAND = `
fn inBandM(i: i32, j: i32, m: f32) -> bool {
  let x0 = f32(i) * P.dx;
  let y0 = f32(j) * P.dx;
  for (var b = 0u; b < P.nbody; b++) {
    if (bv(b, B_BAND) == 0.0) { continue; }
    let bx0 = min(bv(b, B_BX0), bv(b, B_OX0)) - m;
    let by0 = min(bv(b, B_BY0), bv(b, B_OY0)) - m;
    let bx1 = max(bv(b, B_BX1), bv(b, B_OX1)) + m;
    let by1 = max(bv(b, B_BY1), bv(b, B_OY1)) + m;
    if (bx0 > x0 + P.dx || bx1 < x0 || by0 > y0 + P.dx || by1 < y0) { continue; }
    return true;
  }
  return false;
}
`;

/** Zellen und ihre Nachbarn für die Regeln des Schliessens (cf, cu gebunden). */
const CLOSE_LIB = `
fn paintedC(x: u32) -> bool { return cu[U_PAINT * P.n + x] != 0u; }
fn bandC(x: u32) -> bool { return cu[U_BAND * P.n + x] != 0u; }
fn ownerC(x: u32) -> u32 { return cu[U_OWNER * P.n + x]; }
fn fsC(x: u32) -> f32 { return cf[F_FS * P.n + x]; }
/* Die Fläche zwischen zwei Nachbarn ist ganz bedeckt (die linke bzw. untere Fläche der Zelle b). */
fn coveredU(b: u32) -> bool { return cf[F_COVL * P.n + b] >= 1.0 - COVERED_EPS; }
fn coveredV(b: u32) -> bool { return cf[F_COVB * P.n + b] >= 1.0 - COVERED_EPS; }
/* Welche Zelle eine ganz bedeckte Fläche zwischen a und b schliesst: die mit dem grösseren Anteil, gleich die erste — „gleich“ bis auf das
   Rauschen von f32 (zwei halbe Zellen einer Wand quer über zwei Zellen sind 0,4999992 und 0,5000027): sonst entschiede die Rundung. */
fn pickPair(a: u32, b: u32) -> u32 {
  let fa = select(-1.0, fsC(a), ownerC(a) != 0u);
  let fb = select(-1.0, fsC(b), ownerC(b) != 0u);
  if (fa < 0.0 && fb < 0.0) { return NONE; }
  return select(a, b, fb > fa + 1e-4);
}
`;

/** Die Schwellen und SQUEEZE (wie bodyCover.rebuild; die alte Festigkeit der Nachbarn in U_SOLID, die neuen Anteile in F_FS). */
const NOW0 = `
fn besideOther(x: u32) -> bool {
  let own = ownerC(x);
  let i = ci(x);
  let j = cj(x);
  for (var k = 0u; k < 4u; k++) {
    var ii = i;
    var jj = j;
    if (k == 0u) { ii -= 1; } else if (k == 1u) { ii += 1; } else if (k == 2u) { jj -= 1; } else { jj += 1; }
    if (!inGrid(ii, jj)) { if (!sideOpen(k)) { return true; } continue; }
    let nb = cellOf(ii, jj);
    if (paintedC(nb)) { return true; }
    let on = ownerC(nb);
    if (on != 0u && on != own && (cu[U_SOLID * P.n + nb] != 0u || fsC(nb) >= SQUEEZE_B)) { return true; }
  }
  return false;
}
/* Geschlossen nach Schwelle, Schnitt und SQUEEZE; eine gemalte Zelle zählt als zu; ausserhalb des Bands bleibt alles, wie es ist. */
fn now0(x: u32) -> bool {
  if (!bandC(x)) { return cu[U_SOLID * P.n + x] != 0u; }
  if (paintedC(x)) { return true; }
  let own = ownerC(x);
  if (own == 0u) { return false; }
  let fs = fsC(x);
  /* Ein freier Körper: zu ab CLOSED_F, eine schon geschlossene Zelle bleibt es bis unter REOPEN_F (kbodylib.ts). */
  let thrF = select(CLOSED_F, REOPEN_F, cu[U_SOLID * P.n + x] != 0u);
  if (fs >= select(CLOSED_P, thrF, bFree(own - 1u)) || cu[U_SPLIT * P.n + x] != 0u) { return true; }
  return fs >= SQUEEZE_B && besideOther(x);
}
`;

/** Gas zwischen Zellen als atomare Beiträge (wie transitions.moveGas; cf lesend, at atomar). */
const MOVE = `
fn gasMass(c: u32) -> f32 { let n = P.n; return cf[F_MN * n + c] + cf[F_MO * n + c] + cf[F_MV * n + c] + cf[F_MF * n + c]; }
fn gasVol(c: u32) -> f32 { let v = cf[F_VGAS * P.n + c]; return select(P.vcell, v, v > 0.0); }
fn moveGasB(a: u32, b: u32, share: f32) {
  let n = P.n;
  let dN = cf[F_MN * n + a] * share; let dO = cf[F_MO * n + a] * share; let dV = cf[F_MV * n + a] * share;
  let dF = cf[F_MF * n + a] * share; let dH = cf[F_HG * n + a] * share;
  addF_at(A_DN * n + a, -dN); addF_at(A_DO * n + a, -dO); addF_at(A_DV * n + a, -dV); addF_at(A_DF * n + a, -dF); addF_at(A_DH * n + a, -dH);
  addF_at(A_DN * n + b, dN); addF_at(A_DO * n + b, dO); addF_at(A_DV * n + b, dV); addF_at(A_DF * n + b, dF); addF_at(A_DH * n + b, dH);
}
/* Der Nachbar über Seite k (0 links, 1 rechts, 2 unten, 3 oben), wenn kein Körper die Fläche ganz bedeckt (gas.across). */
fn acrossB(c: u32, k: u32) -> u32 {
  let i = ci(c);
  let j = cj(c);
  if (k == 0u) { if (i > 0 && cf[F_COVL * P.n + c] < 1.0 - COVERED_EPS) { return c - 1u; } return NONE; }
  if (k == 1u) { if (i + 1 < i32(P.nx) && cf[F_COVL * P.n + c + 1u] < 1.0 - COVERED_EPS) { return c + 1u; } return NONE; }
  if (k == 2u) { if (j > 0 && cf[F_COVB * P.n + c] < 1.0 - COVERED_EPS) { return c - P.nx; } return NONE; }
  if (j + 1 < i32(P.ny) && cf[F_COVB * P.n + c + P.nx] < 1.0 - COVERED_EPS) { return c + P.nx; }
  return NONE;
}
`;

export const BODY_COVER_KERNELS: readonly KernelDef[] = [
  {
    /* Der Randwert der Projektionen, Lage und Umgrenzung jedes Körpers; wer neu ins Gitter muss (wach, eben eingeschlafen, weg, hochgeladen). */
    name: 'bPrep', wg: 64,
    bind: 'P:u bod:w bgeo:r',
    code: `${BODY_ACCESS}
${ONE} {
  for (var b = lid3.x; b < P.nbody; b += 64u) {
    let o = b * BS;
    let again = bod[o + B_AGAIN] != 0.0;
    bod[o + B_AGAIN] = 0.0;
    if (bod[o + B_GONE] != 0.0) {
      bod[o + B_BAND] = select(0.0, 1.0, again);
      bod[o + B_BX0] = 1e9; bod[o + B_BY0] = 1e9; bod[o + B_BX1] = -1e9; bod[o + B_BY1] = -1e9;
      continue;
    }
    let awake = bod[o + B_PINNED] == 0.0 && bod[o + B_ASLEEP] == 0.0;
    if (awake) {
      /* Der Randwert dieses Schritts: die Geschwindigkeit samt Vorhersage (bodies.prepare). */
      for (var d = 0u; d < 3u; d++) { bod[o + B_PNOW + d] = bod[o + B_PRED + d]; }
      bod[o + B_UX] = bod[o + B_VX] + bod[o + B_PRED];
      bod[o + B_UY] = bod[o + B_VY] + bod[o + B_PRED + 1u];
      bod[o + B_UW] = bod[o + B_W] + bod[o + B_PRED + 2u];
    }
    let c = cos(bod[o + B_A]);
    let s = sin(bod[o + B_A]);
    bod[o + B_COS] = c;
    bod[o + B_SIN] = s;
    var lo = vec2<f32>(1e30, 1e30);
    var hi = vec2<f32>(-1e30, -1e30);
    let x = bod[o + B_X];
    let y = bod[o + B_Y];
    let nr = u32(bod[o + B_NR]);
    for (var r = 0u; r < nr; r++) {
      let bx = rBox(rectOf(b, r));
      for (var q = 0u; q < 4u; q++) {
        let lx = select(bx.z, bx.x, q == 0u || q == 3u);
        let ly = select(bx.w, bx.y, q < 2u);
        let w = vec2<f32>(x + c * lx - s * ly, y + s * lx + c * ly);
        lo = min(lo, w);
        hi = max(hi, w);
      }
    }
    bod[o + B_BX0] = lo.x; bod[o + B_BY0] = lo.y; bod[o + B_BX1] = hi.x; bod[o + B_BY1] = hi.y;
    bod[o + B_BAND] = select(0.0, 1.0, awake || again);
  }
}`
  },
  {
    /* Teilchen aus den Rechtecken der wachen Körper (bodyCover.pushOut): auf ihrem Weg im Rahmen des Körpers von seiner alten Lage zur neuen. */
    name: 'bPush', wg: WG,
    bind: 'P:u cnt:a bod:r bgeo:r parts:w',
    code: `${BODY_ACCESS}
${BODY_GEOM}
${BODY_CELLS}
${MAIN} {
  let count = cntWG(lid3.x, C_PSORT);
  let p = gid.x;
  if (p >= count) { return; }
  var q = parts[p];
  if ((q.flags & 1u) != 0u || !(q.mass > 0.0)) { return; }
  var pos = vec2<f32>(q.x, q.y);
  var vel = vec2<f32>(q.vx, q.vy);
  var moved = false;
  let m = 2.0 * P.dx;
  for (var b = 0u; b < P.nbody; b++) {
    if (!bAwake(b)) { continue; }
    if (pos.x < bv(b, B_BX0) - m || pos.x > bv(b, B_BX1) + m || pos.y < bv(b, B_BY0) - m || pos.y > bv(b, B_BY1) + m) { continue; }
    let o = moveOut(b, pos, pos, vec3<f32>(bv(b, B_RX), bv(b, B_RY), bv(b, B_RA)));
    if (!o.hit) { continue; }
    pos = o.p;
    let vn = dot(vel - bodyV(b, pos), o.n);
    if (vn < 0.0) { vel -= vn * o.n; }
    moved = true;
  }
  if (moved) { q.x = pos.x; q.y = pos.y; q.vx = vel.x; q.vy = vel.y; parts[p] = q; }
}`
  },
  {
    /* Dasselbe für die Blasen (eine hängende löst sich von ihrer Kavität). */
    name: 'bPushB', wg: 64,
    bind: 'P:u cnt:a bod:r bgeo:r bubs:w',
    code: `${BODY_ACCESS}
${BODY_GEOM}
${BODY_CELLS}
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>) {
  let count = min(cntWG(lid3.x, C_BCOUNT), P.bcap);
  let k = gid.x;
  if (k >= count) { return; }
  var B = bubs[k];
  if (B.alive == 0u) { return; }
  var pos = vec2<f32>(B.x, B.y);
  var vel = vec2<f32>(B.vx, B.vy);
  var moved = false;
  let m = 2.0 * P.dx;
  for (var b = 0u; b < P.nbody; b++) {
    if (!bAwake(b)) { continue; }
    if (pos.x < bv(b, B_BX0) - m || pos.x > bv(b, B_BX1) + m || pos.y < bv(b, B_BY0) - m || pos.y > bv(b, B_BY1) + m) { continue; }
    let o = moveOut(b, pos, pos, vec3<f32>(bv(b, B_RX), bv(b, B_RY), bv(b, B_RA)));
    if (!o.hit) { continue; }
    pos = o.p;
    let vn = dot(vel - bodyV(b, pos), o.n);
    if (vn < 0.0) { vel -= vn * o.n; }
    moved = true;
  }
  if (moved) { B.x = pos.x; B.y = pos.y; B.vx = vel.x; B.vy = vel.y; B.site = -1; bubs[k] = B; }
}`
  },
  {
    /* Je Zelle im Band: die Anteile aller Körper (genaues Abschneiden), Besitzer, Schnitt, Bedeckung der linken und der unteren Fläche. */
    name: 'bCover', wg: WG,
    bind: 'P:u bod:r bgeo:r bcell:r cf:w cu:w',
    code: `${BODY_ACCESS}
${BODY_GEOM}
${BODY_CELLS}
${BAND}
${MAIN} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let i = ci(c);
  let j = cj(c);
  if (!inBandM(i, j, P.dx)) { cu[U_BAND * n + c] = 0u; return; }
  cu[U_BAND * n + c] = 1u;
  let dx = P.dx;
  let x0 = f32(i) * dx;
  let y0 = f32(j) * dx;
  cf[F_COVL * n + c] = faceCover(vec2<f32>(x0, y0), vec2<f32>(x0, y0 + dx));
  cf[F_COVB * n + c] = faceCover(vec2<f32>(x0, y0), vec2<f32>(x0 + dx, y0));
  if (cu[U_PAINT * n + c] != 0u) {
    /* Ein fester Bau aus „solid“ nimmt keinen Körper auf (seine Energie, sein Film und seine Kruste bleiben). */
    cf[F_FS * n + c] = 0.0; cf[F_CAPB * n + c] = 0.0; cf[F_WSUM * n + c] = 0.0; cf[F_HW * n + c] = 0.0;
    cu[U_OWNER * n + c] = 0u; cu[U_MATB * n + c] = 0u; cu[U_SPLIT * n + c] = 0u; cu[U_HBODY * n + c] = 0u;
    return;
  }
  let invA = 1.0 / (dx * dx);
  var fs = 0.0; var capB = 0.0; var Es = 0.0; var film = 0.0; var crust = 0.0; var wsum = 0.0;
  var best = 0.0; var owner = 0u; var mat = 0u; var split = 0u; var hw = 0.0; var hbest = 0.0; var hgrp = 0u;
  let w0 = vec2<f32>(x0, y0);
  for (var b = 0u; b < P.nbody; b++) {
    if (bGone(b) || !boxHits(b, i, j, 0.0)) { continue; }
    let l0 = toLocalB(b, w0);
    let l1 = toLocalB(b, w0 + vec2<f32>(dx, 0.0));
    let l2 = toLocalB(b, w0 + vec2<f32>(dx, dx));
    let l3 = toLocalB(b, w0 + vec2<f32>(0.0, dx));
    let lmin = min(min(l0, l1), min(l2, l3));
    let lmax = max(max(l0, l1), max(l2, l3));
    let mb = u32(bv(b, B_MAT)) + 1u;
    let rc = solidRho(mb) * solidCp(mb) * P.depth;
    var acc = 0.0;
    let nr = u32(bv(b, B_NR));
    for (var r = 0u; r < nr; r++) {
      let rq = rectOf(b, r);
      let bx = rBox(rq);
      if (lmin.x > bx.z || lmax.x < bx.x || lmin.y > bx.w || lmax.y < bx.y) { continue; }
      let ni = u32(rv(rq, GR_NI));
      let nj = u32(rv(rq, GR_NJ));
      let ko = u32(rv(rq, GR_KO));
      for (var qq = firstRow(rq, nj, lmin.y); qq < nj; qq++) {
        let ya = rys(rq, qq);
        if (ya > lmax.y) { break; }
        let yb = rys(rq, qq + 1u);
        for (var pp = firstCol(rq, ni, lmin.x); pp < ni; pp++) {
          let xa = rxs(rq, pp);
          if (xa > lmax.x) { break; }
          let A = (rxs(rq, pp + 1u) - xa) * (yb - ya);
          let area = areaIn(b, rq, pp, qq, i, j);
          if (area <= 1e-12 * A) { continue; }
          let k = ko + pp + qq * ni;
          let w = area / A;
          fs += area * invA;
          acc += area * invA;
          capB += w * rc * A;
          Es += w * bcell[BC * k];
          film += w * bcell[BC * k + 1u];
          crust += w * bcell[BC * k + 2u];
          wsum += w;
        }
      }
      if (splitsCellB(b, rq, i, j)) { split = 1u; }
    }
    /* Der Körper mit dem grössten Anteil besitzt die Zelle (bei Gleichstand der erste). */
    if (acc > best) { best = acc; owner = b + 1u; mat = mb; }
    /* Eine Heizplatte: ihr Anteil an der Leistung ihrer Gruppe nach dem Volumen (Heat.bodyHeat): ncell · bedecktes Volumen / Volumen. */
    if (bv(b, B_HEATER) >= 0.0 && acc > hbest) { hbest = acc; hgrp = u32(bv(b, B_HEATER)) + 1u; hw = bv(b, B_NCELL) * acc * P.vcell / max(1e-30, bv(b, B_VOL)); }
  }
  cf[F_FS * n + c] = min(1.0, fs);
  cf[F_CAPB * n + c] = capB;
  cf[F_ES * n + c] = Es;
  cf[F_FILM * n + c] = film;
  cf[F_CRUST * n + c] = crust;
  cf[F_WSUM * n + c] = wsum;
  cf[F_HW * n + c] = hw;
  cf[F_ESY * n + c] = Es;
  cf[F_FSY * n + c] = film;
  cf[F_KSY * n + c] = crust;
  cu[U_OWNER * n + c] = owner;
  cu[U_MATB * n + c] = mat;
  cu[U_SPLIT * n + c] = split;
  cu[U_HBODY * n + c] = hgrp;
}`
  },
  {
    /* Geschlossen nach Schwelle, Schnitt und SQUEEZE, dann die Paare der u-Flächen (eine ganz bedeckte Fläche zwischen zwei offenen Zellen). */
    name: 'bClose1', wg: WG,
    bind: 'P:u bod:r cf:r cu:w',
    code: `${BODY_REC}
${CLOSE_LIB}
${NOW0}
${MAIN} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  if (!bandC(c)) { cu[U_NOW1 * n + c] = select(0u, 1u, cu[U_SOLID * n + c] != 0u); return; }
  var closed = now0(c);
  if (!closed && !paintedC(c)) {
    let i = ci(c);
    if (i > 0 && coveredU(c)) { let a = c - 1u; if (!now0(a) && pickPair(a, c) == c) { closed = true; } }
    if (i + 1 < i32(P.nx) && coveredU(c + 1u)) { let b = c + 1u; if (!now0(b) && pickPair(c, b) == c) { closed = true; } }
  }
  cu[U_NOW1 * n + c] = select(0u, 1u, closed);
}`
  },
  {
    /* Die Paare der v-Flächen nach dem Stand der u-Flächen (wie die Treppe: erst u, dann v). */
    name: 'bClose2', wg: WG,
    bind: 'P:u cf:r cu:w',
    code: `${BODY_CONSTS}
${CLOSE_LIB}
fn closedNow(x: u32) -> bool { return cu[U_NOW1 * P.n + x] != 0u || paintedC(x); }
${MAIN} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  if (!bandC(c)) { cu[U_NOW2 * n + c] = cu[U_NOW1 * n + c]; return; }
  var closed = cu[U_NOW1 * n + c] != 0u;
  if (!closed && !paintedC(c)) {
    let j = cj(c);
    if (j > 0 && coveredV(c)) { let a = c - P.nx; if (!closedNow(a) && pickPair(a, c) == c) { closed = true; } }
    if (j + 1 < i32(P.ny) && coveredV(c + P.nx)) { let b = c + P.nx; if (!closedNow(b) && pickPair(c, b) == c) { closed = true; } }
  }
  cu[U_NOW2 * n + c] = select(0u, 1u, closed);
}`
  },
  {
    /* Zellen, die zugehen, geben ihr Gas ab; Zellen, die aufgehen, werden Flüssigkeit oder holen Gas (bodyCover.gasOut, vacate) — nur Beiträge. */
    name: 'bFlip', wg: WG,
    bind: 'P:u cf:r cu:w at:a cnt:a',
    code: `${BODY_CONSTS}
${MOVE}
fn freeB(x: u32) -> bool { return cu[U_NOW2 * P.n + x] == 0u && cu[U_PAINT * P.n + x] == 0u; }
/* Die nächste freie Zelle im Fenster 9 × 9 um c, über Flächen, die kein Körper ganz bedeckt, durch alles ausser gemaltem Feststoff (Breitensuche). */
fn nearFree(c: u32) -> u32 {
  let i0 = ci(c) - 4;
  let j0 = cj(c) - 4;
  var seen = array<u32, 3>(0u, 1u << 8u, 0u);
  var queue: array<u32, 81>;
  queue[0] = 40u;
  var head = 0u;
  var tail = 1u;
  loop {
    if (head >= tail) { break; }
    let w = queue[head];
    head += 1u;
    let q = cellOf(i0 + i32(w % 9u), j0 + i32(w / 9u));
    for (var k = 0u; k < 4u; k++) {
      let nb = acrossB(q, k);
      if (nb == NONE) { continue; }
      let a = ci(nb) - i0;
      let bb = cj(nb) - j0;
      if (a < 0 || bb < 0 || a > 8 || bb > 8) { continue; }
      let v = u32(a + 9 * bb);
      let bit = 1u << (v & 31u);
      if ((seen[v >> 5u] & bit) != 0u) { continue; }
      seen[v >> 5u] = seen[v >> 5u] | bit;
      if (cu[U_PAINT * P.n + nb] != 0u) { continue; }
      if (freeB(nb)) { return nb; }
      queue[tail] = v;
      tail += 1u;
    }
  }
  return NONE;
}
${MAIN} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  if (cu[U_BAND * n + c] == 0u || cu[U_PAINT * n + c] != 0u) { return; }
  let was = cu[U_SOLID * n + c] != 0u;
  let now = cu[U_NOW2 * n + c] != 0u;
  if (now && !was) {
    if (gasMass(c) <= 0.0 && cf[F_HG * n + c] == 0.0) { return; }
    var wsum = 0.0;
    var cntN = 0u;
    for (var k = 0u; k < 4u; k++) { let nb = acrossB(c, k); if (nb != NONE && freeB(nb)) { wsum += gasVol(nb); cntN += 1u; } }
    if (cntN > 0u) {
      for (var k = 0u; k < 4u; k++) { let nb = acrossB(c, k); if (nb != NONE && freeB(nb)) { moveGasB(c, nb, gasVol(nb) / wsum); } }
      return;
    }
    let t = nearFree(c);
    if (t != NONE) { moveGasB(c, t, 1.0); } else { atomicAdd(&cnt[C_PARKED], 1u); }
    return;
  }
  if (!now && was) {
    var liquidNear = false;
    var wsum = 0.0;
    var rho = 0.0;
    for (var k = 0u; k < 4u; k++) {
      let nb = acrossB(c, k);
      if (nb == NONE) { continue; }
      let kn = cu[U_KIND * n + nb];
      if (kn == LIQUID) { liquidNear = true; }
      if (kn != GAS || cu[U_NOW2 * n + nb] != 0u || gasMass(nb) <= 0.0) { continue; }
      let w = gasVol(nb);
      wsum += w;
      rho += w * cf[F_RHO * n + nb];
    }
    var kind = GAS;
    if (wsum <= 0.0) { kind = select(GAS, LIQUID, liquidNear); }
    else {
      let want = (rho / wsum) * max(1e-3, 1.0 - cf[F_FS * n + c] - cf[F_PHI * n + c] - cf[F_ALPHA * n + c]) * P.vcell;
      for (var k = 0u; k < 4u; k++) {
        let nb = acrossB(c, k);
        if (nb == NONE || cu[U_KIND * n + nb] != GAS || cu[U_NOW2 * n + nb] != 0u) { continue; }
        let mnb = gasMass(nb);
        if (mnb <= 0.0) { continue; }
        moveGasB(nb, c, min(0.25, want * (gasVol(nb) / wsum) / mnb));
      }
    }
    cu[U_KNEW * n + c] = kind;
    /* Das Gebiet eines Nachbarn (zuerst eines, der offen bleibt): Gebiete behalten ihre Nummern. */
    var rid = NONE;
    for (var ps = 0u; ps < 2u && rid == NONE; ps++) {
      for (var k = 0u; k < 4u; k++) {
        let nb = acrossB(c, k);
        if (nb == NONE || (ps == 0u && cu[U_NOW2 * n + nb] != 0u)) { continue; }
        let r = cu[U_RID * n + nb];
        if (r != NONE) { rid = r; break; }
      }
    }
    cu[U_SPLIT * n + c] = rid;
  }
}`
  },
  {
    /* Den neuen Stand schreiben: Feststoff, Art, Gebiet; die Temperatur des Körperteils aus seiner Energie. */
    name: 'bApply', wg: WG,
    bind: 'P:u cf:w cu:w',
    code: `${DERIVE}
${MAIN} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  if (cu[U_BAND * n + c] == 0u || cu[U_PAINT * n + c] != 0u) { return; }
  let was = cu[U_SOLID * n + c] != 0u;
  let now = cu[U_NOW2 * n + c] != 0u;
  if (now) {
    cu[U_SOLID * n + c] = max(1u, cu[U_MATB * n + c]);
    cu[U_KIND * n + c] = SOLID;
    cu[U_RID * n + c] = NONE;
  } else if (was) {
    cu[U_SOLID * n + c] = 0u;
    cu[U_KIND * n + c] = cu[U_KNEW * n + c];
    cu[U_RID * n + c] = cu[U_SPLIT * n + c];
  }
  if (cf[F_CAPB * n + c] > 0.0) { deriveSolid(c); }
}`
  },
  {
    /* φ_s und der Abstand zur Wand neu in den Zellen um das Band (wie grid.updateStatic; die Glättung 1/6, 2/3, 1/6). */
    name: 'bStatic', wg: WG,
    bind: 'P:u bod:r cf:w cu:r',
    code: `${BODY_REC}
${BAND}
fn shareAt(i: i32, j: i32) -> f32 {
  if (i < 0) { return select(1.0, 0.0, P.openL != 0u); }
  if (i >= i32(P.nx)) { return select(1.0, 0.0, P.openR != 0u); }
  if (j < 0) { return select(1.0, 0.0, P.openB != 0u); }
  if (j >= i32(P.ny)) { return select(1.0, 0.0, P.openT != 0u); }
  let c = cellOf(i, j);
  return select(min(1.0, cf[F_FS * P.n + c]), 1.0, cu[U_SOLID * P.n + c] != 0u);
}
${MAIN} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let i = ci(c);
  let j = cj(c);
  if (!inBandM(i, j, 6.0 * P.dx)) { return; }
  let n = P.n;
  let inSolid = cu[U_SOLID * n + c] != 0u;
  let K = array<f32, 3>(1.0 / 6.0, 2.0 / 3.0, 1.0 / 6.0);
  var phis = 1.0;
  if (!inSolid) {
    phis = 0.0;
    for (var b = -1; b <= 1; b++) { for (var a = -1; a <= 1; a++) { phis += K[a + 1] * K[b + 1] * shareAt(i + a, j + b); } }
  }
  cf[F_PHIS * n + c] = phis;
  let dx = P.dx;
  var best = 4.0 * dx;
  let x = (f32(i) + 0.5) * dx;
  let y = (f32(j) + 0.5) * dx;
  if (!inSolid) {
    if (P.openL == 0u) { best = min(best, x); }
    if (P.openR == 0u) { best = min(best, P.boxw - x); }
    if (P.openB == 0u) { best = min(best, y); }
    if (P.openT == 0u) { best = min(best, P.boxh - y); }
  }
  for (var b = -4; b <= 4; b++) {
    let jj = j + b;
    if (jj < 0 || jj >= i32(P.ny)) { continue; }
    for (var a = -4; a <= 4; a++) {
      let ii = i + a;
      if (ii < 0 || ii >= i32(P.nx)) { continue; }
      if ((cu[U_SOLID * n + cellOf(ii, jj)] != 0u) == inSolid) { continue; }
      let ex = max(0.0, abs(f32(a)) - 0.5) * dx;
      let ey = max(0.0, abs(f32(b)) - 0.5) * dx;
      best = min(best, sqrt(ex * ex + ey * ey));
    }
  }
  cf[F_SDF * n + c] = select(best, -best, inSolid);
}`
  },
  {
    /* Nach dem Abdecken: die Umgrenzung gilt als die letzte, wache Körper merken sich ihre Lage (für den Weg der Teilchen im nächsten Schritt). */
    name: 'bPrepEnd', wg: 64,
    bind: 'P:u bod:w',
    code: `${BODY_REC}
${ONE} {
  for (var b = lid3.x; b < P.nbody; b += 64u) {
    let o = b * BS;
    bod[o + B_OX0] = bod[o + B_BX0]; bod[o + B_OY0] = bod[o + B_BY0]; bod[o + B_OX1] = bod[o + B_BX1]; bod[o + B_OY1] = bod[o + B_BY1];
    if (bAwake(b)) { bod[o + B_RX] = bod[o + B_X]; bod[o + B_RY] = bod[o + B_Y]; bod[o + B_RA] = bod[o + B_A]; }
  }
}`
  },
  {
    /* Flüssigkeit: eine Fläche neben einer geschlossenen Körperzelle bewegt sich mit ihm (nach p2g, das sie 0 und bekannt setzte). */
    name: 'bFaceL', wg: WG,
    bind: 'P:u bod:r cu:r ff:w fu:r',
    code: `${BODY_REC}
${BODY_FACE}
fn wallFace(f: u32) -> bool {
  if (f < P.nu) { let i = f % (P.nx + 1u); return (i == 0u && P.openL == 0u) || (i == P.nx && P.openR == 0u); }
  let j = (f - P.nu) / P.nx;
  return (j == 0u && P.openB == 0u) || (j == P.ny && P.openT == 0u);
}
${MAIN} {
  let f = gid.x;
  if (f >= P.nf || fu[fui(FU_KNOWN, f)] != 2u || wallFace(f)) { return; }
  let b = faceBody(f);
  if (b == NONE) { return; }
  ff[ffi(FF_UL, f)] = faceVelB(f, b);
}`
  },
  {
    /* Gas: eine Fläche zwischen einer Körperzelle und Gas (oder einer offenen Seite) bekommt seine Geschwindigkeit (gas.markFaces: usol). */
    name: 'bFaceG', wg: WG,
    bind: 'P:u bod:r cu:r ff:w fu:r',
    code: `${BODY_REC}
${BODY_FACE}
${MAIN} {
  let f = gid.x;
  if (f >= P.nf || fu[fui(FU_GAS, f)] != 0u) { return; }
  let b = faceBody(f);
  if (b == NONE) { return; }
  /* Die andere Seite: an Flüssigkeit bleibt die Fläche für das Gas still (wie die CPU). */
  var a = NONE;
  var c = NONE;
  if (f < P.nu) { let i = f % (P.nx + 1u); let j = f / (P.nx + 1u); if (i > 0u) { a = i - 1u + j * P.nx; } if (i < P.nx) { c = i + j * P.nx; } }
  else { let g = f - P.nu; let i = g % P.nx; let j = g / P.nx; if (j > 0u) { a = i + (j - 1u) * P.nx; } if (j < P.ny) { c = i + j * P.nx; } }
  if ((a != NONE && cu[U_KIND * P.n + a] == LIQUID) || (c != NONE && cu[U_KIND * P.n + c] == LIQUID)) { return; }
  ff[ffi(FF_UG, f)] = faceVelB(f, b);
}`
  },
  {
    /* Das Fluidvolumen je Gebiet ohne die Körperstücke darin, Σ (1 − fs) V (regions.volumes) — vor jedem regFinish. */
    name: 'bRegVol', wg: WG,
    bind: 'P:u cf:r cu:r racc:a',
    code: `${REGSUM}
${MAIN} {
  let c = gid.x;
  let lid = lid3.x;
  var r = NONE;
  var v = vec4<f32>(0.0);
  if (c < P.n) {
    r = cu[U_RID * P.n + c];
    if (r != NONE) { v.x = (1.0 - cf[F_FS * P.n + c]) * P.vcell; }
  }
  regSum(lid, r, v, vec4<u32>(RA_VSUM, RA_VSUM, RA_VSUM, RA_VSUM));
}`
  },
  {
    /* Heizplatten: Zellen und mittlere Temperatur (nach Wärmekapazität ihrer inneren Zellen) zur Summe ihrer Gruppe (Heat.countHeaters). */
    name: 'bHeaters', wg: 256,
    bind: 'P:u bod:r bgeo:r bcell:r hacc:a',
    code: `${BODY_ACCESS}
var<workgroup> rc: array<f32, 256>;
var<workgroup> rt: array<f32, 256>;
fn cellT(E: f32, C: f32, film: f32, crust: f32) -> f32 {
  let cs = C + crust * CP_CRYSTAL;
  if (!(cs > 0.0)) { return 293.15; }
  if (film <= 0.0) { return T0 + E / cs; }
  var T = 293.15;
  for (var it = 0; it < 3; it++) { T -= (cs * (T - T0) + film * hL(T) - E) / (cs + film * cpL(T)); }
  return T;
}
@compute @workgroup_size(256) fn main(@builtin(local_invocation_id) lid3: vec3<u32>) {
  let lid = lid3.x;
  for (var b = 0u; b < P.nbody; b++) {
    if (bGone(b) || bv(b, B_HEATER) < 0.0) { continue; }
    let g = u32(bv(b, B_HEATER));
    if (g >= P.nheat) { continue; }
    let mb = u32(bv(b, B_MAT)) + 1u;
    let rcp = solidRho(mb) * solidCp(mb) * P.depth;
    let ko = u32(bv(b, B_KO));
    let nk = u32(bv(b, B_NCELL));
    var sc = 0.0;
    var st = 0.0;
    for (var k = lid; k < nk; k += 256u) {
      let kk = ko + k;
      let rq = u32(bcell[BC * kk + 3u]);
      let loc = kk - u32(rv(rq, GR_KO));
      let ni = u32(rv(rq, GR_NI));
      let p = loc % ni;
      let q = loc / ni;
      let C = rcp * (rxs(rq, p + 1u) - rxs(rq, p)) * (rys(rq, q + 1u) - rys(rq, q));
      sc += C;
      st += C * cellT(bcell[BC * kk], C, bcell[BC * kk + 1u], bcell[BC * kk + 2u]);
    }
    rc[lid] = sc;
    rt[lid] = st;
    workgroupBarrier();
    for (var s = 128u; s > 0u; s >>= 1u) {
      if (lid < s) { rc[lid] += rc[lid + s]; rt[lid] += rt[lid + s]; }
      workgroupBarrier();
    }
    if (lid == 0u && rc[0] > 0.0) {
      addF_hacc(g * HACC_STRIDE + HA_TSUM, rt[0] / rc[0] * f32(nk));
      atomicAdd(&hacc[g * HACC_STRIDE + HA_CELLS], nk);
    }
    workgroupBarrier();
  }
}`
  }
];
