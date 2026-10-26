/**
 * LABOR 2D (v2) — KÖRPER AUF DER GPU: ZURÜCK UND DIE KRÄFTE (seit 2026-10-26;
 * Stufe 9 „bodies“, wie bodies.finish bis vor die Bewegung).
 *
 * - Collect (coverCollect.ts): was Wärmeleitung, Tau und Kristalle an den
 *   Körperteilen der Zellen änderten, geht an die inneren Zellen — je innere
 *   Zelle ein Sammeln über die Gitterzellen, die sie überlappt, mit denselben
 *   Flächen wie das Abdecken: Energie nach w C_k/capB; Film und Kruste, die
 *   dazukamen, nach w/Σw; was abnahm, nach dem Beitrag jeder inneren Zelle
 *   (höchstens dieser), der Rest aus dem ganzen Körper, dem die Zelle gehört
 *   (atomare Summen je Körper, ein zweiter Durchgang).
 * - Der Druck in die festen Zellen fortgesetzt, Lage um Lage (bodyForces.extend),
 *   als Ping-Pong zweier Puffer: keine Zelle liest, was im selben Aufruf
 *   geschrieben wird — nur im Band der freien Körper, so viele Lagen, wie ihr
 *   breitestes Rechteck braucht.
 * - Kraft und Drehmoment über die freien Seitenstücke in Stücken von höchstens
 *   ½ Δx (bodyForces.force; eine Arbeitsgruppe je Körper) und die Schätzung der
 *   mitbewegten Masse (bodyForces.addedMass).
 * - Die gemessene mitbewegte Masse eines Körpers aus mehreren Rechtecken
 *   (bodies.probe): rechte Seite −Δx J_k über die Flächen seiner geschlossenen
 *   Zellen zur Flüssigkeit, eine Lösung mit der Matrix der Projektion, Jᵀx.
 * - Die Ablesung je Körper (Lage, Zustand, Masse, mittlere Temperatur, Σ E,
 *   Film, Kruste).
 */

import type { KernelDef } from './kernel';
import { BODY_ACCESS, BODY_FACE, BODY_GEOM, BODY_REC } from './kbodylib';
import { BA, BA_STRIDE } from './bodies';

const WG = 128;
const MAIN = '@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)';
const MAIN64 = '@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)';

const BAT = `const BA_STRIDE: u32 = ${BA_STRIDE}u;
const BA_RESTF: u32 = ${BA.RESTF}u;
const BA_RESTK: u32 = ${BA.RESTK}u;
const BA_FSUM: u32 = ${BA.FSUM}u;
const BA_KSUM: u32 = ${BA.KSUM}u;
const BA_M9: u32 = ${BA.M9}u;`;

/** Fläche der inneren Zelle (p, q) des Rechtecks rq in der Gitterzelle (i, j) — dieselbe Rechnung wie bCover (BODY_CELLS.areaIn). */
const AREA = `
fn areaInC(b: u32, rq: u32, p: u32, q: u32, i: i32, j: i32) -> f32 {
  let org = vec2<f32>(f32(i) * P.dx, f32(j) * P.dx);
  let x0 = rxs(rq, p); let x1 = rxs(rq, p + 1u);
  let y0 = rys(rq, q); let y1 = rys(rq, q + 1u);
  return quadInBox(toWorldRel(b, vec2<f32>(x0, y0), org), toWorldRel(b, vec2<f32>(x1, y0), org), toWorldRel(b, vec2<f32>(x1, y1), org),
    toWorldRel(b, vec2<f32>(x0, y1), org), vec2<f32>(0.0, 0.0), vec2<f32>(P.dx, P.dx));
}
`;

/** Im Band der freien Körper (wach oder schlafend: auch der Schlafende braucht die Kraft, sie weckt ihn): Umgrenzung und vier Zellen Rand. */
const FORCE_BAND = `
fn inForceBand(c: u32) -> bool {
  let x0 = f32(ci(c)) * P.dx;
  let y0 = f32(cj(c)) * P.dx;
  let m = 4.0 * P.dx;
  for (var b = 0u; b < P.nbody; b++) {
    if (!bFree(b)) { continue; }
    if (bv(b, B_BX0) - m > x0 + P.dx || bv(b, B_BX1) + m < x0 || bv(b, B_BY0) - m > y0 + P.dx || bv(b, B_BY1) + m < y0) { continue; }
    return true;
  }
  return false;
}
`;

/** Die Fortsetzung des Drucks: ein Ping-Pong-Schritt von (PE, RE, KN) a nach b (bodyForces.extend, eine Lage). */
function extKernel(name: string, pa: string, ra: string, ka: string, pb: string, rb: string, kb: string): KernelDef {
  return {
    name, wg: WG,
    bind: 'P:u bod:r cf:w',
    code: `${BODY_REC}
${FORCE_BAND}
${MAIN} {
  let c = gid.x;
  if (c >= P.n || !inForceBand(c)) { return; }
  let n = P.n;
  let kn = cf[${ka} * n + c];
  if (kn != 0.0) { cf[${pb} * n + c] = cf[${pa} * n + c]; cf[${rb} * n + c] = cf[${ra} * n + c]; cf[${kb} * n + c] = kn; return; }
  let i = ci(c);
  let j = cj(c);
  let gdx = P.gy * P.dx;
  var s = 0.0;
  var r = 0.0;
  var cnt = 0.0;
  if (i > 0 && cf[${ka} * n + c - 1u] != 0.0) { s += cf[${pa} * n + c - 1u]; r += cf[${ra} * n + c - 1u]; cnt += 1.0; }
  if (i + 1 < i32(P.nx) && cf[${ka} * n + c + 1u] != 0.0) { s += cf[${pa} * n + c + 1u]; r += cf[${ra} * n + c + 1u]; cnt += 1.0; }
  if (j > 0 && cf[${ka} * n + c - P.nx] != 0.0) { s += cf[${pa} * n + c - P.nx] - cf[${ra} * n + c - P.nx] * gdx; r += cf[${ra} * n + c - P.nx]; cnt += 1.0; }
  if (j + 1 < i32(P.ny) && cf[${ka} * n + c + P.nx] != 0.0) { s += cf[${pa} * n + c + P.nx] + cf[${ra} * n + c + P.nx] * gdx; r += cf[${ra} * n + c + P.nx]; cnt += 1.0; }
  if (cnt > 0.0) { cf[${pb} * n + c] = s / cnt; cf[${rb} * n + c] = r / cnt; cf[${kb} * n + c] = 2.0; }
  else { cf[${pb} * n + c] = 0.0; cf[${rb} * n + c] = 0.0; cf[${kb} * n + c] = 0.0; }
}`
  };
}

/** Die Einträge J einer Flüssigkeitszelle für die Flächen, die sie mit den geschlossenen Zellen des Körpers b teilt (bodies.probe). */
const JAC = `
fn jacobian(c: u32, b: u32) -> vec3<f32> {
  let i = ci(c);
  let j = cj(c);
  let bx = bv(b, B_X);
  let by = bv(b, B_Y);
  var J = vec3<f32>(0.0);
  /* Die rechte u-Fläche: die Zelle liegt links von ihr (+); die linke: rechts (−); die obere v-Fläche: darunter (+); die untere: darüber (−). */
  let fr = uF(i + 1, j);
  if (faceBody(fr) == b) { let yf = (f32(j) + 0.5) * P.dx; J += vec3<f32>(1.0, 0.0, -(yf - by)); }
  let fl = uF(i, j);
  if (faceBody(fl) == b) { let yf = (f32(j) + 0.5) * P.dx; J += vec3<f32>(-1.0, 0.0, yf - by); }
  let ft = vF(i, j + 1);
  if (faceBody(ft) == b) { let xf = (f32(i) + 0.5) * P.dx; J += vec3<f32>(0.0, 1.0, xf - bx); }
  let fb = vF(i, j);
  if (faceBody(fb) == b) { let xf = (f32(i) + 0.5) * P.dx; J += vec3<f32>(0.0, -1.0, -(xf - bx)); }
  return J;
}
`;

const PROBE_SEL = 'struct ProbeSel { b: u32, k: u32, p1: u32, p2: u32 }';

export const BODY_COLLECT_KERNELS: readonly KernelDef[] = [
  {
    /* Je Zelle mit Körperteilen: was ihre inneren Zellen an Film und Kruste beitragen (nur bei einer Abnahme gebraucht) und der Rest je Körper. */
    name: 'bCollectPrep', wg: WG,
    bind: 'P:u bod:r bgeo:r bcell:r cf:w cu:r bat:a',
    code: `${BODY_ACCESS}
${BODY_GEOM}
${AREA}
${BAT}
${MAIN} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  if (!(cf[F_WSUM * n + c] > 0.0) || cu[U_PAINT * n + c] != 0u) { return; }
  let df = cf[F_FILM * n + c] - cf[F_FSY * n + c];
  let dk = cf[F_CRUST * n + c] - cf[F_KSY * n + c];
  if (df >= 0.0 && dk >= 0.0) { return; }
  let i = ci(c);
  let j = cj(c);
  let w0 = vec2<f32>(f32(i) * P.dx, f32(j) * P.dx);
  var gF = 0.0;
  var gK = 0.0;
  for (var b = 0u; b < P.nbody; b++) {
    if (bGone(b)) { continue; }
    if (bv(b, B_BX0) > w0.x + P.dx || bv(b, B_BX1) < w0.x || bv(b, B_BY0) > w0.y + P.dx || bv(b, B_BY1) < w0.y) { continue; }
    let l0 = toLocalB(b, w0);
    let l1 = toLocalB(b, w0 + vec2<f32>(P.dx, 0.0));
    let l2 = toLocalB(b, w0 + vec2<f32>(P.dx, P.dx));
    let l3 = toLocalB(b, w0 + vec2<f32>(0.0, P.dx));
    let lmin = min(min(l0, l1), min(l2, l3));
    let lmax = max(max(l0, l1), max(l2, l3));
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
        for (var pp = firstCol(rq, ni, lmin.x); pp < ni; pp++) {
          let xa = rxs(rq, pp);
          if (xa > lmax.x) { break; }
          let A = (rxs(rq, pp + 1u) - xa) * (rys(rq, qq + 1u) - ya);
          let area = areaInC(b, rq, pp, qq, i, j);
          if (area <= 1e-12 * A) { continue; }
          let k = ko + pp + qq * ni;
          gF += area / A * bcell[BC * k + 1u];
          gK += area / A * bcell[BC * k + 2u];
        }
      }
    }
  }
  cf[F_GF * n + c] = gF;
  cf[F_GK * n + c] = gK;
  let own = cu[U_OWNER * n + c];
  if (own == 0u) { return; }
  let o = (own - 1u) * BA_STRIDE;
  if (df < 0.0 && -df > gF) { addF_bat(o + BA_RESTF, -df - gF); }
  if (dk < 0.0 && -dk > gK) { addF_bat(o + BA_RESTK, -dk - gK); }
}`
  },
  {
    /* Je innere Zelle: die Änderungen der Zellen, die sie überlappt (genau wie coverCollect.ts), dann Σ Film und Kruste ihres Körpers. */
    name: 'bCollect', wg: WG,
    bind: 'P:u bod:r bgeo:r bcell:w cf:r cu:r bat:a',
    code: `${BODY_ACCESS}
${BODY_GEOM}
${AREA}
${BAT}
${MAIN} {
  let k = gid.x;
  if (k >= u32(bgeo[GH_NCELL])) { return; }
  let rq = u32(bcell[BC * k + 3u]);
  let b = u32(rv(rq, GR_BODY));
  if (bGone(b)) { return; }
  let n = P.n;
  let ni = u32(rv(rq, GR_NI));
  let loc = k - u32(rv(rq, GR_KO));
  let p = loc % ni;
  let q = loc / ni;
  let x0 = rxs(rq, p); let x1 = rxs(rq, p + 1u);
  let y0 = rys(rq, q); let y1 = rys(rq, q + 1u);
  let A = (x1 - x0) * (y1 - y0);
  let mb = u32(bv(b, B_MAT)) + 1u;
  let Ck = solidRho(mb) * solidCp(mb) * A * P.depth;
  /* Die Gitterzellen der Umgrenzung des Vierecks in der Welt. */
  let w0 = toWorldRel(b, vec2<f32>(x0, y0), vec2<f32>(0.0));
  let w1 = toWorldRel(b, vec2<f32>(x1, y0), vec2<f32>(0.0));
  let w2 = toWorldRel(b, vec2<f32>(x1, y1), vec2<f32>(0.0));
  let w3 = toWorldRel(b, vec2<f32>(x0, y1), vec2<f32>(0.0));
  let lo = min(min(w0, w1), min(w2, w3));
  let hi = max(max(w0, w1), max(w2, w3));
  let i0 = max(0, i32(floor(lo.x * P.invdx)));
  let i1 = min(i32(P.nx) - 1, i32(floor(hi.x * P.invdx)));
  let j0 = max(0, i32(floor(lo.y * P.invdx)));
  let j1 = min(i32(P.ny) - 1, i32(floor(hi.y * P.invdx)));
  let film = bcell[BC * k + 1u];
  let crust = bcell[BC * k + 2u];
  var dE = 0.0;
  var dF = 0.0;
  var dK = 0.0;
  for (var j = j0; j <= j1; j++) {
    for (var i = i0; i <= i1; i++) {
      let c = cellOf(i, j);
      if (cu[U_PAINT * n + c] != 0u) { continue; }
      let area = areaInC(b, rq, p, q, i, j);
      if (area <= 1e-12 * A) { continue; }
      let w = area / A;
      let capB = cf[F_CAPB * n + c];
      let de = cf[F_ES * n + c] - cf[F_ESY * n + c];
      if (de != 0.0 && capB > 0.0) { dE += de * w * Ck / capB; }
      let ws = cf[F_WSUM * n + c];
      let df = cf[F_FILM * n + c] - cf[F_FSY * n + c];
      if (df > 0.0 && ws > 0.0) { dF += df * w / ws; }
      else if (df < 0.0 && cf[F_GF * n + c] > 0.0) { dF -= min(1.0, -df / cf[F_GF * n + c]) * w * film; }
      let dk = cf[F_CRUST * n + c] - cf[F_KSY * n + c];
      if (dk > 0.0 && ws > 0.0) { dK += dk * w / ws; }
      else if (dk < 0.0 && cf[F_GK * n + c] > 0.0) { dK -= min(1.0, -dk / cf[F_GK * n + c]) * w * crust; }
    }
  }
  bcell[BC * k] += dE;
  let f1 = max(0.0, film + dF);
  let k1 = max(0.0, crust + dK);
  bcell[BC * k + 1u] = f1;
  bcell[BC * k + 2u] = k1;
  if (f1 > 0.0) { addF_bat(b * BA_STRIDE + BA_FSUM, f1); }
  if (k1 > 0.0) { addF_bat(b * BA_STRIDE + BA_KSUM, k1); }
}`
  },
  {
    /* Der Rest einer Abnahme aus dem ganzen Körper, nach dem, was jede innere Zelle trägt. */
    name: 'bCollectRest', wg: WG,
    bind: 'P:u bod:r bgeo:r bcell:w bat:a',
    code: `${BODY_ACCESS}
${BAT}
${MAIN} {
  let k = gid.x;
  if (k >= u32(bgeo[GH_NCELL])) { return; }
  let rq = u32(bcell[BC * k + 3u]);
  let b = u32(rv(rq, GR_BODY));
  if (bGone(b)) { return; }
  let o = b * BA_STRIDE;
  let rf = getF_bat(o + BA_RESTF);
  let F = getF_bat(o + BA_FSUM);
  if (rf > 0.0 && F > 0.0) { bcell[BC * k + 1u] *= max(0.0, 1.0 - rf / F); }
  let rk = getF_bat(o + BA_RESTK);
  let K = getF_bat(o + BA_KSUM);
  if (rk > 0.0 && K > 0.0) { bcell[BC * k + 2u] *= max(0.0, 1.0 - rk / K); }
}`
  },
  {
    /* Abgleich: jede Zelle mit Körperteilen merkt sich ihre jetzigen Werte; die Summen je Körper von vorn. */
    name: 'bCollectEnd', wg: WG,
    bind: 'P:u cf:w bat:a',
    code: `${BAT}
${MAIN} {
  let c = gid.x;
  if (c == 0u) {
    for (var b = 0u; b < P.nbody; b++) { for (var f = 0u; f < 4u; f++) { atomicStore(&bat[b * BA_STRIDE + f], 0u); } }
  }
  if (c >= P.n) { return; }
  let n = P.n;
  if (!(cf[F_CAPB * n + c] > 0.0)) { return; }
  cf[F_ESY * n + c] = cf[F_ES * n + c];
  cf[F_FSY * n + c] = cf[F_FILM * n + c];
  cf[F_KSY * n + c] = cf[F_CRUST * n + c];
}`
  },
  {
    /* Der Druck jeder Fluidzelle im Band der freien Körper (Flüssigkeit: mit der Dichte ihrer Teilchen; Gas: p0 vom Anfang des Schritts + p′). */
    name: 'bExtInit', wg: WG,
    bind: 'P:u glob:r bod:r cf:w cu:r parts:r ccount:r cstart:r bsum:r',
    code: `${BODY_REC}
${FORCE_BAND}
${MAIN} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  cf[F_KN1 * n + c] = 0.0;
  if (!inForceBand(c)) { cf[F_KN0 * n + c] = 0.0; return; }
  let k = cu[U_KIND * n + c];
  var pe = 0.0;
  var re = 0.0;
  var kn = 0.0;
  if (k == LIQUID) {
    pe = cf[F_PL * n + c];
    var m = 0.0;
    var v = 0.0;
    let st = cellStart(c);
    let cn = ccount[c];
    for (var q = 0u; q < cn; q++) {
      let pk = st + q;
      if ((parts[pk].flags & 1u) != 0u || !(parts[pk].mass > 0.0)) { continue; }
      m += parts[pk].mass;
      v += parts[pk].mass / parts[pk].rho;
    }
    re = select(glob[G_RHOREF], m / v, v > 0.0);
    kn = 1.0;
  } else if (k == GAS && cu[U_SOLID * n + c] == 0u) {
    /* Der Druck, den die Flüssigkeit an ihrer Oberfläche sah (p0 vom Anfang des Schritts, liqPressure in F_PL), dazu p′. */
    pe = cf[F_PL * n + c] + cf[F_PG * n + c];
    let rho = cf[F_RHO * n + c];
    re = select(P.rhoamb, rho, rho > 0.0);
    kn = 1.0;
  }
  cf[F_PE0 * n + c] = pe;
  cf[F_RE0 * n + c] = re;
  cf[F_KN0 * n + c] = kn;
}`
  },
  extKernel('bExtA', 'F_PE0', 'F_RE0', 'F_KN0', 'F_PE1', 'F_RE1', 'F_KN1'),
  extKernel('bExtB', 'F_PE1', 'F_RE1', 'F_KN1', 'F_PE0', 'F_RE0', 'F_KN0'),
  {
    /* Kraft und Drehmoment des Drucks über die freien Seitenstücke (je Stück ≤ ½ Δx) und die Schätzung der mitbewegten Masse; eine Arbeitsgruppe je Körper. */
    name: 'bForce', wg: 64,
    bind: 'P:u glob:r bod:w bgeo:r cf:r cu:r',
    code: `${BODY_ACCESS}
var<workgroup> rf: array<vec4<f32>, 64>;
var<workgroup> rw: array<vec2<f32>, 64>;
var<workgroup> wfree: u32;
/* Der fortgesetzte Druck an (x, y): bilinear über die bekannten Zellmitten (bodyForces.pressureAt). */
fn pressureAt(x: f32, y: f32) -> f32 {
  let fx = clamp(x * P.invdx - 0.5, 0.0, f32(P.nx) - 1.0001);
  let fy = clamp(y * P.invdx - 0.5, 0.0, f32(P.ny) - 1.0001);
  let i = u32(floor(fx));
  let j = u32(floor(fy));
  let tx = fx - f32(i);
  let ty = fy - f32(j);
  var s = 0.0;
  var ws = 0.0;
  for (var b = 0u; b < 2u; b++) {
    for (var a = 0u; a < 2u; a++) {
      let c = i + a + (j + b) * P.nx;
      if (cf[F_KN0 * P.n + c] == 0.0) { continue; }
      let w = select(tx, 1.0 - tx, a == 0u) * select(ty, 1.0 - ty, b == 0u);
      s += w * cf[F_PE0 * P.n + c];
      ws += w;
    }
  }
  return select(0.0, s / ws, ws > 0.0);
}
/* Der Druck an einem Punkt des Umrisses mit der Aussennormalen nrm: aus den Fluidzellen eine halbe Zelle davor (bodyForces.sideAt). */
fn sideAt(m: vec2<f32>, nrm: vec2<f32>) -> f32 {
  let sp = m + 0.5 * P.dx * nrm;
  let fx = clamp(sp.x * P.invdx - 0.5, 0.0, f32(P.nx) - 1.0001);
  let fy = clamp(sp.y * P.invdx - 0.5, 0.0, f32(P.ny) - 1.0001);
  let i = u32(floor(fx));
  let j = u32(floor(fy));
  let tx = fx - f32(i);
  let ty = fy - f32(j);
  var ls = 0.0; var lw = 0.0; var gs = 0.0; var gw = 0.0;
  for (var b = 0u; b < 2u; b++) {
    for (var a = 0u; a < 2u; a++) {
      let ii = i + a;
      let jj = j + b;
      let c = ii + jj * P.nx;
      if (cf[F_KN0 * P.n + c] != 1.0) { continue; }
      let xc = (f32(ii) + 0.5) * P.dx;
      let yc = (f32(jj) + 0.5) * P.dx;
      if ((xc - m.x) * nrm.x + (yc - m.y) * nrm.y <= 0.0) { continue; }
      let w = select(tx, 1.0 - tx, a == 0u) * select(ty, 1.0 - ty, b == 0u) + 1e-6;
      let v = cf[F_PE0 * P.n + c] + cf[F_RE0 * P.n + c] * P.gy * (yc - m.y);
      if (cu[U_KIND * P.n + c] == LIQUID) { ls += w * v; lw += w; } else { gs += w * v; gw += w; }
    }
  }
  if (lw > 0.0 && gw > 0.0) { return max(ls / lw, gs / gw); }
  if (lw > 0.0) { return ls / lw; }
  if (gw > 0.0) { return gs / gw; }
  return pressureAt(m.x, m.y);
}
${MAIN64} {
  let b = wid3.x;
  let lid = lid3.x;
  if (lid == 0u) { wfree = select(0u, 1u, b < P.nbody && bFree(b)); }
  let fr = workgroupUniformLoad(&wfree);
  if (fr == 0u) { return; }
  let cs = bv(b, B_COS);
  let sn = bv(b, B_SIN);
  let bx = bv(b, B_X);
  let by = bv(b, B_Y);
  var acc = vec4<f32>(0.0);
  var wet = vec2<f32>(0.0);
  let ns = u32(bv(b, B_NSEG));
  let so = u32(bv(b, B_SO));
  let segBase = u32(bgeo[GH_SEGS]);
  for (var e = 0u; e < ns; e++) {
    let sb = segBase + (so + e) * SS;
    let rq = u32(bgeo[sb + GS_RECT]);
    let side = u32(bgeo[sb + GS_SIDE]);
    let t0 = bgeo[sb + GS_T0];
    let t1 = bgeo[sb + GS_T1];
    let bxr = rBox(rq);
    /* Das Stück als Strecke im eigenen Rahmen (Body2D.segment) und seine Aussennormale. */
    var a0 = vec2<f32>(bxr.x, t0); var a1 = vec2<f32>(bxr.x, t1); var nl = vec2<f32>(-1.0, 0.0);
    if (side == 1u) { a0 = vec2<f32>(bxr.z, t0); a1 = vec2<f32>(bxr.z, t1); nl = vec2<f32>(1.0, 0.0); }
    else if (side == 2u) { a0 = vec2<f32>(t0, bxr.y); a1 = vec2<f32>(t1, bxr.y); nl = vec2<f32>(0.0, -1.0); }
    else if (side == 3u) { a0 = vec2<f32>(t0, bxr.w); a1 = vec2<f32>(t1, bxr.w); nl = vec2<f32>(0.0, 1.0); }
    let len = length(a1 - a0);
    let nw = vec2<f32>(cs * nl.x - sn * nl.y, sn * nl.x + cs * nl.y);
    let np = max(1u, u32(ceil(len / (0.5 * P.dx))));
    let A = len / f32(np) * P.depth;
    for (var q = lid; q < np; q += 64u) {
      let t = (f32(q) + 0.5) / f32(np);
      let l = a0 + t * (a1 - a0);
      let r = vec2<f32>(cs * l.x - sn * l.y, sn * l.x + cs * l.y);
      let p = sideAt(vec2<f32>(bx, by) + r, nw) * A;
      acc += vec4<f32>(-p * nw.x, -p * nw.y, -p * (r.x * nw.y - r.y * nw.x), 0.0);
    }
    /* Die Schätzung der mitbewegten Masse: welcher Anteil der Seitenlänge vor Flüssigkeit liegt (Stücke ≤ Δx, eine halbe Zelle davor). */
    let n2 = max(1u, u32(ceil(len / P.dx)));
    for (var q = lid; q < n2; q += 64u) {
      let t = (f32(q) + 0.5) / f32(n2);
      let l = a0 + t * (a1 - a0) + 0.5 * P.dx * nl;
      let wp = vec2<f32>(bx + cs * l.x - sn * l.y, by + sn * l.x + cs * l.y);
      let c = cellAtN(wp.x, wp.y);
      wet += vec2<f32>(select(0.0, len / f32(n2), c != NONE && cu[U_KIND * P.n + c] == LIQUID), len / f32(n2));
    }
  }
  rf[lid] = acc;
  rw[lid] = wet;
  workgroupBarrier();
  for (var s = 32u; s > 0u; s >>= 1u) {
    if (lid < s) { rf[lid] += rf[lid + s]; rw[lid] += rw[lid + s]; }
    workgroupBarrier();
  }
  if (lid == 0u) {
    let o = b * BS;
    bod[o + B_FX] = rf[0].x;
    bod[o + B_FY] = rf[0].y;
    bod[o + B_TQ] = rf[0].z;
    let f = select(0.0, rw[0].x / rw[0].y, rw[0].y > 0.0);
    let rho = glob[G_RHOREF];
    bod[o + B_MA] = 1.5 * rho * f * bv(b, B_HULLA) * P.depth;
    bod[o + B_IA] = rho * f * bv(b, B_HULLJ) * P.depth;
  }
}`
  },
  {
    /* Die rechte Seite einer Lösung der mitbewegten Masse: −Δx J_k über die Flächen der geschlossenen Zellen des Körpers zur Flüssigkeit; x = 0. */
    name: 'bProbeRhs', wg: WG,
    bind: `P:u PB:u<ProbeSel> L:u<Level> bod:r cu:r mgU:r cgv:w`,
    code: `${PROBE_SEL}
${BODY_REC}
${BODY_FACE}
${JAC}
${MAIN} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let s = s0(c);
  var v = 0.0;
  let b = PB.b;
  if (b < P.nbody && bAwake(b) && mgU[L.act + s] != 0u && cu[U_KIND * P.n + c] == LIQUID) {
    let J = jacobian(c, b);
    v = -P.dx * J[PB.k];
  }
  cgv[s] = 0.0;
  cgv[P.n0 + s] = v;
}`
  },
  {
    /* Nach der Lösung: Σ x J_l je Arbeitsgruppe, atomar zur Summe des Körpers (Spalte k der Matrix). */
    name: 'bProbeDot', wg: WG,
    bind: `P:u PB:u<ProbeSel> L:u<Level> bod:r cu:r mgU:r cgv:r bat:a`,
    code: `${PROBE_SEL}
${BODY_REC}
${BODY_FACE}
${JAC}
${BAT}
var<workgroup> rj: array<vec3<f32>, WG>;
${MAIN} {
  let c = gid.x;
  let lid = lid3.x;
  var v = vec3<f32>(0.0);
  let b = PB.b;
  if (c < P.n && b < P.nbody) {
    let s = s0(c);
    if (mgU[L.act + s] != 0u && cu[U_KIND * P.n + c] == LIQUID) { v = cgv[s] * jacobian(c, b); }
  }
  rj[lid] = v;
  workgroupBarrier();
  for (var st = WG / 2u; st > 0u; st >>= 1u) {
    if (lid < st) { rj[lid] += rj[lid + st]; }
    workgroupBarrier();
  }
  if (lid == 0u && b < P.nbody) {
    let o = b * BA_STRIDE + BA_M9 + PB.k;
    if (rj[0].x != 0.0) { addF_bat(o, rj[0].x); }
    if (rj[0].y != 0.0) { addF_bat(o + 3u, rj[0].y); }
    if (rj[0].z != 0.0) { addF_bat(o + 6u, rj[0].z); }
  }
}`
  },
  {
    /* M_a = −Δt Δx D Jᵀ x, symmetrisch gemacht (bodies.probe); die Summen von vorn. */
    name: 'bProbeFin', wg: 64,
    bind: 'P:u glob:r bod:w bat:a',
    code: `${BODY_REC}
${BAT}
@compute @workgroup_size(64) fn main(@builtin(local_invocation_id) lid3: vec3<u32>) {
  for (var b = lid3.x; b < P.nbody; b += 64u) {
    let a = b * BA_STRIDE + BA_M9;
    if (bod[b * BS + B_PROBE] != 0.0 && bAwake(b)) {
      let s = -glob[G_DT] * P.dx * P.depth;
      var m: array<f32, 9>;
      for (var i = 0u; i < 9u; i++) { m[i] = s * getF_bat(a + i); }
      let o = b * BS + B_MA6;
      bod[o] = m[0];
      bod[o + 1u] = 0.5 * (m[1] + m[3]);
      bod[o + 2u] = 0.5 * (m[2] + m[6]);
      bod[o + 3u] = m[4];
      bod[o + 4u] = 0.5 * (m[5] + m[7]);
      bod[o + 5u] = m[8];
      bod[b * BS + B_MAOK] = 1.0;
    }
    for (var i = 0u; i < 9u; i++) { atomicStore(&bat[a + i], 0u); }
  }
}`
  },
  {
    /* Die Ablesung je Körper: Lage, Geschwindigkeit, Zustand, Masse, mittlere Temperatur nach Wärmekapazität, Σ E, Film, Kruste, Kraft. */
    name: 'bMeas', wg: 64,
    bind: 'P:u bod:r bgeo:r bcell:r bread:w',
    code: `${BODY_ACCESS}
var<workgroup> rm: array<vec4<f32>, 64>;
var<workgroup> rk: array<f32, 64>;
fn cellT(E: f32, C: f32, film: f32, crust: f32) -> f32 {
  let cs = C + crust * CP_CRYSTAL;
  if (!(cs > 0.0)) { return 293.15; }
  if (film <= 0.0) { return T0 + E / cs; }
  var T = 293.15;
  for (var it = 0; it < 3; it++) { T -= (cs * (T - T0) + film * hL(T) - E) / (cs + film * cpL(T)); }
  return T;
}
${MAIN64} {
  let b = wid3.x;
  let lid = lid3.x;
  if (b >= P.nbody) { return; }
  let gone = bGone(b);
  let nk = select(u32(bv(b, B_NCELL)), 0u, gone);
  let ko = u32(bv(b, B_KO));
  let mb = u32(bv(b, B_MAT)) + 1u;
  let rcp = solidRho(mb) * solidCp(mb) * P.depth;
  var acc = vec4<f32>(0.0);
  var ck = 0.0;
  for (var k = lid; k < nk; k += 64u) {
    let kk = ko + k;
    let rq = u32(bcell[BC * kk + 3u]);
    let loc = kk - u32(rv(rq, GR_KO));
    let ni = u32(rv(rq, GR_NI));
    let p = loc % ni;
    let q = loc / ni;
    let C = rcp * (rxs(rq, p + 1u) - rxs(rq, p)) * (rys(rq, q + 1u) - rys(rq, q));
    let E = bcell[BC * kk];
    let film = bcell[BC * kk + 1u];
    let crust = bcell[BC * kk + 2u];
    acc += vec4<f32>(C * cellT(E, C, film, crust), E, film, crust);
    ck += C;
  }
  rm[lid] = acc;
  rk[lid] = ck;
  workgroupBarrier();
  for (var s = 32u; s > 0u; s >>= 1u) {
    if (lid < s) { rm[lid] += rm[lid + s]; rk[lid] += rk[lid + s]; }
    workgroupBarrier();
  }
  if (lid == 0u) {
    let o = b * BR;
    bread[o + BRD_X] = bv(b, B_X); bread[o + BRD_Y] = bv(b, B_Y); bread[o + BRD_A] = bv(b, B_A);
    bread[o + BRD_VX] = bv(b, B_VX); bread[o + BRD_VY] = bv(b, B_VY); bread[o + BRD_W] = bv(b, B_W);
    bread[o + BRD_STATE] = select(0.0, 1.0, bv(b, B_PINNED) != 0.0) + select(0.0, 2.0, bv(b, B_ASLEEP) != 0.0) + select(0.0, 4.0, gone);
    bread[o + BRD_M] = bv(b, B_M);
    bread[o + BRD_T] = select(0.0, rm[0].x / rk[0], rk[0] > 0.0);
    bread[o + BRD_E] = rm[0].y; bread[o + BRD_FILM] = rm[0].z; bread[o + BRD_CRUST] = rm[0].w;
    bread[o + BRD_FX] = bv(b, B_FX); bread[o + BRD_FY] = bv(b, B_FY); bread[o + BRD_TQ] = bv(b, B_TQ);
    bread[o + BRD_MAOK] = bv(b, B_MAOK);
  }
}`
  }
];
