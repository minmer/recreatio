/**
 * LABOR 2D (v2) — SCHMELZEN UND ANFRIEREN AUF DER GPU (seit 2026-10-26; wie
 * bodyMelt.ts, meltSides.ts und meltWater.ts auf der CPU, nur Eis aus EINEM
 * Rechteck — ausgeschnittenes Eis bleibt auf der CPU, Engine.needsCpu).
 *
 * Ein Schritt (Stufe „bodies“, nach collect, vor den Kräften — die Reihenfolge
 * der CPU):
 *
 *  1. mSums (je Zelle im Band schmelzbarer Körper): aus den Teilchen der Zelle
 *     selbst Σ m c_p, Σ m c_p T, Wasser, Salz und Masse der Wasserteilchen (wie
 *     exchange.ts cap, capT, water, salt); die Sammler des Schmelzwassers und
 *     die Ansprüche auf Anfrieren von vorn.
 *  2. mMelt (kbodymelt2.ts; EINE Arbeitsgruppe, die Körper der Reihe nach wie
 *     die CPU): T_f und Zufuhr je Seite, die Überschüsse der inneren Zellen, das
 *     geplante Anfrieren, die Züge (eine Seite schmilzt um δ oder wächst), das
 *     Schmelzwasser an die Wasserteilchen vor der Seite (über die Sammler der
 *     Zellen), gesammelt je Seite oder an den Enden einer aufliegenden Seite
 *     hervorgequollen, die neue Aufteilung der inneren Zellen, ganz geschmolzen
 *     unter 0,25 Δx, der neue Schwerpunkt.
 *  3. mApply (je Teilchen): das Schmelzwasser seiner Zelle nach seiner Masse
 *     dazu, das Anfrieren nach seinem Wasser weg (mit der Enthalpie des Eises,
 *     sein Salz bleibt), ein Teilchen über zwei Nennmassen teilt sich.
 *  4. mSpawn (je Körper und Seite): gesammeltes Schmelzwasser ab einem Viertel
 *     der Nennmasse wird zu Teilchen (je höchstens eine Nennmasse, höchstens vier
 *     je Schritt) — angehängt wie das Kondensat (spawnWater), sortiert im
 *     nächsten Schritt.
 *
 * Der Gefrierpunkt T_f(m) der Lösung vor einer Seite kommt aus einer Tafel, die
 * die CPU baut (solution.freezingPoint, 257 Stützstellen bis zum Eutektikum).
 * Alles in f32; ein Zug, der kleiner ist als die Auflösung einer Grenze in f32,
 * gibt seine Wärme den Randzellen zurück (wie die CPU, wenn nichts schmilzt).
 */

import { FREEZE_MAX, GONE, THICK, THIN } from '../engine/bodyMelt';
import { SPAWN, SPAWN_MAX, SPLIT } from '../engine/meltWater';
import { freezingPoint, M_S, T_EUTECTIC, T_MELT, W_EUTECTIC } from '../engine/solution';
import type { KernelDef } from './kernel';
import { BODY_ACCESS, BODY_GEOM, BODY_REC } from './kbodylib';
import { f } from './lib';

/** bmelt (f32): Kopf (Anfang des Arbeitsspeichers der neuen Aufteilung), dann je Körper MLT_BODY Wörter. */
export const MLT_HEAD = 4;
export const MLT_BODY = 32;
/** Je Körper: je Seite das gesammelte Schmelzwasser (Masse samt Salz, Enthalpie, Salz, Ort und Normale, wo es hervorkommt); Platz für innere Zellen, Spalten- und Zeilengrenzen. */
export const MLT = { PEND: 0, CAPC: 28, CAPX: 29, CAPY: 30 } as const;
export const PEND_W = 7;

/** Die Molalität des Eutektikums (mol/kg) und die Tafel T_f(m) von 0 bis dorthin. */
const TF_N = 256;
const TF_MMAX = W_EUTECTIC / ((1 - W_EUTECTIC) * M_S);
const TF_TAB = Array.from({ length: TF_N + 1 }, (_, i) => (i === TF_N ? T_EUTECTIC : freezingPoint((TF_MMAX * i) / TF_N)));

/** Konstanten und Rechnungen ohne Bindungen. */
export const MELT_CONSTS = `
const THIN_M: f32 = ${f(THIN)};
const THICK_M: f32 = ${f(THICK)};
const GONE_M: f32 = ${f(GONE)};
const FREEZE_M: f32 = ${f(FREEZE_MAX)};
const SPLIT_M: f32 = ${f(SPLIT)};
const SPAWN_M: f32 = ${f(SPAWN)};
const SPAWN_N: u32 = ${SPAWN_MAX}u;
const T_MELT_M: f32 = ${f(T_MELT)};
const M_S_M: f32 = ${f(M_S)};
const MLT_HEAD: u32 = ${MLT_HEAD}u;
const MLT_BODY: u32 = ${MLT_BODY}u;
const MLT_PEND: u32 = ${MLT.PEND}u;
const MLT_CAPC: u32 = ${MLT.CAPC}u;
const MLT_CAPX: u32 = ${MLT.CAPX}u;
const MLT_CAPY: u32 = ${MLT.CAPY}u;
const PEND_W: u32 = ${PEND_W}u;
const TF_N: u32 = ${TF_N}u;
const TF_MMAX: f32 = ${f(TF_MMAX)};
const TF_TAB = array<f32, ${TF_N + 1}>(${TF_TAB.map(f).join(', ')});
/* Der Gefrierpunkt der Flüssigkeit vor einer Seite aus Salz und Wasser ihrer Zellen (meltSides.freezingAt): ohne beides der des reinen Wassers. */
fn tfOf(salt: f32, water: f32) -> f32 {
  if (!(water > 0.0) || !(salt > 0.0)) { return T_MELT_M; }
  let x = salt / (water * M_S_M) / TF_MMAX * f32(TF_N);
  if (x >= f32(TF_N)) { return TF_TAB[TF_N]; }
  let i = u32(floor(x));
  return TF_TAB[i] + (x - f32(i)) * (TF_TAB[i + 1u] - TF_TAB[i]);
}
/* Energie eines Feststoffanteils bei T und seine Temperatur aus der Energie (body.ts solidEnergy, solidTemperature). */
fn solidEnergyM(C: f32, film: f32, crust: f32, T: f32) -> f32 { return (C + crust * CP_CRYSTAL) * (T - T0) + film * hL(T); }
fn cellTM(E: f32, C: f32, film: f32, crust: f32) -> f32 {
  let cs = C + crust * CP_CRYSTAL;
  if (!(cs > 0.0)) { return 293.15; }
  if (film <= 0.0) { return T0 + E / cs; }
  var T = 293.15;
  for (var it = 0; it < 3; it++) { T -= (cs * (T - T0) + film * hL(T) - E) / (cs + film * cpL(T)); }
  return T;
}
fn mo(b: u32) -> u32 { return MLT_HEAD + b * MLT_BODY; }
`;

/** Seiten, Randzellen, Körper an einem Punkt, Strecken durch andere Körper (bod und bgeo gebunden; dazu BODY_ACCESS, BODY_GEOM). */
export const MELT_GEO = `
/* Die Seite s eines Rechtecks im eigenen Rahmen (Body2D.segment): Anfang, Ende, Normale nach aussen, Länge, Punkte je ½ Δx (meltSides.along). */
struct Side { a: vec2<f32>, e: vec2<f32>, n: vec2<f32>, len: f32, np: u32 }
fn sideOf(rq: u32, s: u32) -> Side {
  let bx = rBox(rq);
  var d: Side;
  if (s == 0u) { d.a = bx.xy; d.e = vec2<f32>(bx.x, bx.w); d.n = vec2<f32>(-1.0, 0.0); }
  else if (s == 1u) { d.a = vec2<f32>(bx.z, bx.y); d.e = bx.zw; d.n = vec2<f32>(1.0, 0.0); }
  else if (s == 2u) { d.a = bx.xy; d.e = vec2<f32>(bx.z, bx.y); d.n = vec2<f32>(0.0, -1.0); }
  else { d.a = vec2<f32>(bx.x, bx.w); d.e = bx.zw; d.n = vec2<f32>(0.0, 1.0); }
  d.len = distance(d.a, d.e);
  /* ceil(len / ½Δx) wie die CPU; das Rauschen von f32 (eine Seite von genau 20 halben Zellen als 20,000002) zählt nicht. */
  d.np = max(1u, u32(ceil(d.len / (0.5 * P.dx) - 1e-4)));
  return d;
}
/* Ein Punkt des eigenen Rahmens in der Welt bei der jetzigen Lage. */
fn toWorldB(b: u32, l: vec2<f32>) -> vec2<f32> {
  let c = bv(b, B_COS);
  let s = bv(b, B_SIN);
  return vec2<f32>(bv(b, B_X) + c * l.x - s * l.y, bv(b, B_Y) + s * l.x + c * l.y);
}
fn rotB(b: u32, v: vec2<f32>) -> vec2<f32> {
  let c = bv(b, B_COS);
  let s = bv(b, B_SIN);
  return vec2<f32>(c * v.x - s * v.y, s * v.x + c * v.y);
}
/* Die t-te Randzelle der Seite s (meltSides.edgeCells): innere Zelle, Länge längs der Seite, Volumen. */
struct Edge { k: u32, len: f32, vol: f32 }
fn alongOf(rq: u32, s: u32) -> u32 { return select(u32(rv(rq, GR_NI)), u32(rv(rq, GR_NJ)), s < 2u); }
fn edgeCell(rq: u32, s: u32, t: u32) -> Edge {
  let ni = u32(rv(rq, GR_NI));
  let nj = u32(rv(rq, GR_NJ));
  var p = t;
  var q = t;
  if (s == 0u) { p = 0u; } else if (s == 1u) { p = ni - 1u; }
  if (s == 2u) { q = 0u; } else if (s == 3u) { q = nj - 1u; }
  let w = rxs(rq, p + 1u) - rxs(rq, p);
  let h = rys(rq, q + 1u) - rys(rq, q);
  return Edge(u32(rv(rq, GR_KO)) + p + q * ni, select(w, h, s < 2u), w * h * P.depth);
}
/* Führt die Strecke a→e durch das Innere eines anderen Körpers als me (Bodies.blocks; Ränder zählen nicht)? */
fn blocksB(me: u32, a: vec2<f32>, e: vec2<f32>) -> bool {
  let eps = 1e-6 * P.dx;
  for (var b = 0u; b < P.nbody; b++) {
    if (b == me || bGone(b)) { continue; }
    if (max(a.x, e.x) < bv(b, B_BX0) - P.dx || min(a.x, e.x) > bv(b, B_BX1) + P.dx || max(a.y, e.y) < bv(b, B_BY0) - P.dx || min(a.y, e.y) > bv(b, B_BY1) + P.dx) { continue; }
    let l0 = toLocalB(b, a);
    let l1 = toLocalB(b, e);
    let nr = u32(bv(b, B_NR));
    for (var r = 0u; r < nr; r++) {
      let bx = rBox(rectOf(b, r));
      let x0 = bx.x + eps; let y0 = bx.y + eps; let x1 = bx.z - eps; let y1 = bx.w - eps;
      if (x1 > x0 && y1 > y0 && clipSeg(l0, l1, x0, y0, x1, y1) > 0.0) { return true; }
    }
  }
  return false;
}
/* Liegt der Punkt in einem Körper (Bodies.bodyAt ohne Rand)? Die Umgrenzung vom Anfang des Schritts mit einer Zelle Rand (er wuchs vielleicht). */
fn bodyAtB(w: vec2<f32>) -> bool {
  for (var b = 0u; b < P.nbody; b++) {
    if (bGone(b)) { continue; }
    if (w.x < bv(b, B_BX0) - P.dx || w.x > bv(b, B_BX1) + P.dx || w.y < bv(b, B_BY0) - P.dx || w.y > bv(b, B_BY1) + P.dx) { continue; }
    let l = toLocalB(b, w);
    let nr = u32(bv(b, B_NR));
    for (var r = 0u; r < nr; r++) {
      let bx = rBox(rectOf(b, r));
      if (l.x >= bx.x && l.x <= bx.z && l.y >= bx.y && l.y <= bx.w) { return true; }
    }
  }
  return false;
}
`;

/** Die Zellen vor einer Seite (meltSides.frontGap, fluidFront; dazu cu und cf gebunden). */
export const MELT_FRONT = `
/*
 * Wie weit vor dem Punkt w (Normale nw) „knapp davor“ liegt (meltSides.frontGap): ein Zwanzigstel Δx, es sei denn, dort ist eine Zelle,
 * die dieser Körper selbst schloss, weil er sie fast ganz bedeckt — dann knapp hinter ihr. „Fast ganz“: ab closed (angeheftet 0,99; frei
 * 0,88 — auf der GPU bleibt eine Zelle eines freien Körpers bis unter 0,88 zu, kbodylib.REOPEN_FREE_GPU).
 */
fn frontGapM(own: u32, closed: f32, w: vec2<f32>, nw: vec2<f32>) -> f32 {
  let eps = 0.05 * P.dx;
  let c = cellAtN(w.x + eps * nw.x, w.y + eps * nw.y);
  if (c == NONE || cu[U_SOLID * P.n + c] == 0u || cu[U_OWNER * P.n + c] != own || cf[F_FS * P.n + c] < closed) { return eps; }
  let i = f32(ci(c));
  let j = f32(cj(c));
  var t = 1e30;
  if (nw.x > 1e-9) { t = min(t, ((i + 1.0) * P.dx - w.x) / nw.x); } else if (nw.x < -1e-9) { t = min(t, (i * P.dx - w.x) / nw.x); }
  if (nw.y > 1e-9) { t = min(t, ((j + 1.0) * P.dx - w.y) / nw.y); } else if (nw.y < -1e-9) { t = min(t, (j * P.dx - w.y) / nw.y); }
  return select(eps, max(eps, t + eps), t < 1e29);
}
/* Ein Punkt q der Seite sd: Weltort, Normale, Länge, die Zelle knapp davor (fluid: kein Feststoff), eine Zelle weiter, knapp innen. */
struct FP { w: vec2<f32>, nw: vec2<f32>, fw: vec2<f32>, len: f32, out: u32, far: u32, inn: u32, fluid: bool }
fn frontPoint(b: u32, sd: Side, q: u32, closed: f32) -> FP {
  var p: FP;
  let t = (f32(q) + 0.5) / f32(sd.np);
  p.w = toWorldB(b, sd.a + t * (sd.e - sd.a));
  p.nw = rotB(b, sd.n);
  p.len = sd.len / f32(sd.np);
  let d = frontGapM(b + 1u, closed, p.w, p.nw);
  let o = p.w + d * p.nw;
  p.out = cellAtN(o.x, o.y);
  p.fluid = p.out != NONE && cu[U_SOLID * P.n + p.out] == 0u;
  p.fw = p.w + (P.dx + d) * p.nw;
  p.far = cellAtN(p.fw.x, p.fw.y);
  let e = p.w - 0.05 * P.dx * p.nw;
  p.inn = cellAtN(e.x, e.y);
  return p;
}
/* Die Zelle eine weiter / knapp innen zählt (fluidFront, ohne die Wiederholung gleich daneben): */
fn farOk(b: u32, p: FP) -> bool {
  return p.fluid && p.far != NONE && p.far != p.out && cu[U_SOLID * P.n + p.far] == 0u && !blocksB(b, p.w, p.fw);
}
fn innOk(p: FP) -> bool {
  return p.fluid && p.inn != NONE && p.inn != p.out && cu[U_SOLID * P.n + p.inn] == 0u && cu[U_KIND * P.n + p.inn] == LIQUID;
}
`;

const WG = 128;
const MAIN = '@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)';

/**
 * Ein neues Wasserteilchen (wie kflash.spawnWater): angehängt, im nächsten Schritt sortiert; src: seine Masse ist eine Volumenquelle
 * (neues Schmelzwasser, meltWater.spawn — L.dVp), sonst nicht (die Hälfte eines geteilten Teilchens). false: kein Platz.
 */
const ADD_PARTICLE = `
fn addParticle(x: vec2<f32>, v: vec2<f32>, m: f32, h: f32, salt: f32, src: bool) -> bool {
  let p = atomicAdd(&cnt[C_PCOUNT], 1u);
  if (p >= P.pcap) { atomicSub(&cnt[C_PCOUNT], 1u); atomicAdd(&cnt[C_PFULL], 1u); return false; }
  var q: Particle;
  q.x = x.x; q.y = x.y; q.vx = v.x; q.vy = v.y; q.c00 = 0.0; q.c01 = 0.0; q.c10 = 0.0; q.c11 = 0.0;
  q.mass = m; q.h = h; q.s = max(0.0, salt); q.T = tFromHL(h); q.flags = 0u;
  pDerive(&q);
  q.dvp = select(0.0, m / q.rho, src);
  q.id = atomicAdd(&cnt[C_NEXTID_P], 1u);
  q.bi = i32(floor(x.x * P.invdx - 1.0));
  q.bj = i32(floor(x.y * P.invdx - 1.0));
  for (var k = 0; k < 9; k++) { q.wt[k] = 0.0; }
  q.wt[4] = 1.0;
  parts[p] = q;
  return true;
}
`;

export const BODY_MELT_KERNELS: readonly KernelDef[] = [
  {
    /* Je Zelle: die Sammler von vorn; im Band schmelzbarer Körper die Summen über ihre eigenen Teilchen (exchange.ts). */
    name: 'mSums', wg: WG,
    bind: 'P:u bod:r cf:w at:a parts:r ccount:r cstart:r bsum:r',
    code: `${BODY_REC}
fn inMeltBand(i: i32, j: i32) -> bool {
  let x0 = f32(i) * P.dx;
  let y0 = f32(j) * P.dx;
  let m = 3.0 * P.dx;
  for (var b = 0u; b < P.nbody; b++) {
    if (bv(b, B_MELT) == 0.0 || bGone(b)) { continue; }
    if (bv(b, B_BX0) - m > x0 + P.dx || bv(b, B_BX1) + m < x0 || bv(b, B_BY0) - m > y0 + P.dx || bv(b, B_BY1) + m < y0) { continue; }
    return true;
  }
  return false;
}
${MAIN} {
  let c = gid.x;
  let n = P.n;
  if (c >= n) { return; }
  atomicStore(&at[A_MGM * n + c], 0u);
  atomicStore(&at[A_MGH * n + c], 0u);
  atomicStore(&at[A_MGS * n + c], 0u);
  atomicStore(&at[A_MCLAIM * n + c], 0u);
  atomicStore(&at[A_MSEEN * n + c], 0u);
  cf[F_MFZ * n + c] = 0.0;
  if (!inMeltBand(ci(c), cj(c))) { return; }
  var C = 0.0; var CT = 0.0; var W = 0.0; var S = 0.0; var WM = 0.0;
  let st = cellStart(c);
  let cn = ccount[c];
  for (var k = 0u; k < cn; k++) {
    let pk = st + k;
    let m = parts[pk].mass;
    if ((parts[pk].flags & 1u) != 0u || !(m > 0.0)) { continue; }
    let s = parts[pk].s;
    let T = parts[pk].T;
    let mt = matOf(parts[pk].flags);
    let Cp = m * pCp(mt, T, s, m);
    C += Cp;
    CT += Cp * T;
    if (mt == 0u) { W += m - s; S += s; WM += m; }
  }
  cf[F_MC * n + c] = C;
  cf[F_MCT * n + c] = CT;
  cf[F_MW * n + c] = W;
  cf[F_MS * n + c] = S;
  cf[F_MWM * n + c] = WM;
}`
  },
  {
    /*
     * Je Wasserteilchen: das Schmelzwasser seiner Zelle nach seiner Masse (meltWater.give — dort nach der Masse aller Nehmer einer Seite;
     * jede Zelle bekam ihren Anteil Σ m ihrer Wasserteilchen / Σ m aller), das Anfrieren nach seinem Wasser ohne Salz mit der Enthalpie des
     * Eises (bodyMelt.take — geplant war m_Zelle · w/W); schwerer als zwei Nennmassen: geteilt, die Hälfte ein Viertel Zelle daneben.
     */
    name: 'mApply', wg: WG,
    bind: 'P:u glob:r cnt:a cf:r cu:r at:a bod:r bgeo:r parts:w',
    code: `${BODY_ACCESS}
${BODY_GEOM}
${MELT_CONSTS}
${MELT_GEO}
${ADD_PARTICLE}
${MAIN} {
  let count = cntWG(lid3.x, C_PSORT);
  let p = gid.x;
  if (p >= count) { return; }
  var q = parts[p];
  if ((q.flags & 1u) != 0u || !(q.mass > 0.0) || matOf(q.flags) != 0u) { return; }
  let n = P.n;
  let c = cellAt(q.x, q.y);
  let gm = getF_at(A_MGM * n + c);
  let want = cf[F_MFZ * n + c];
  if (!(gm > 0.0) && !(want > 0.0)) { return; }
  let w0 = q.mass - q.s;
  let m0 = q.mass;
  if (gm > 0.0) {
    let WM = cf[F_MWM * n + c];
    if (WM > 0.0) {
      let share = m0 / WM;
      let before = q.mass / q.rho;
      let H = q.mass * q.h + share * getF_at(A_MGH * n + c);
      q.mass += share * gm;
      let gs = getF_at(A_MGS * n + c);
      if (gs > 0.0) { q.s += share * gs; }
      q.h = H / q.mass;
      pDerive(&q);
      q.dvp += q.mass / q.rho - before;
    }
  }
  if (want > 0.0) {
    let W = cf[F_MW * n + c];
    if (W > 0.0 && w0 > 0.0) {
      let dm = want * w0 / W;
      let before = q.mass / q.rho;
      let H = q.mass * q.h - dm * cf[F_MHI * n + c];
      q.mass -= dm;
      q.h = H / q.mass;
      pDerive(&q);
      q.dvp += q.mass / q.rho - before;
    }
  }
  /* Zu schwer: in zwei gleiche (meltWater.split; das neue nicht in einem Bau oder Körper). */
  let nominal = glob[G_RHOREF] * P.vcell / 4.0;
  if (q.mass > SPLIT_M * nominal) {
    let side = select(-1.0, 1.0, q.id % 2u == 0u);
    var at2 = -1.0;
    for (var k = 0u; k < 2u; k++) {
      let sg = select(-side, side, k == 0u);
      let cx = clamp(q.x + 0.25 * P.dx * sg, 1e-6, P.boxw - 1e-6);
      let c2 = cellAtN(cx, q.y);
      if (c2 != NONE && cu[U_SOLID * n + c2] == 0u && !bodyAtB(vec2<f32>(cx, q.y))) { at2 = cx; break; }
    }
    if (at2 >= 0.0) {
      let half = 0.5 * q.mass;
      let hs = 0.5 * q.s;
      if (addParticle(vec2<f32>(at2, q.y), vec2<f32>(q.vx, q.vy), half, q.h, hs, false)) {
        q.mass = half;
        q.s = hs;
        pDerive(&q);
      }
    }
  }
  parts[p] = q;
}`
  },
  {
    /*
     * Je Körper und Seite: gesammeltes Schmelzwasser wird zu Teilchen (meltWater.spawn) — sobald es ein Viertel der Nennmasse hat (ist der
     * Körper weg, alles), je höchstens eine Nennmasse, höchstens vier je Schritt, längs der Seite versetzt; an einem Ort in Fluid, den kein
     * anderer Körper von der Stelle trennt (Ringe bis drei Zellen), sonst knapp vor dem Umriss.
     */
    name: 'mSpawn', wg: 64,
    bind: 'P:u glob:r cnt:a bod:r bgeo:r bmelt:w cu:r parts:w',
    code: `${BODY_ACCESS}
${BODY_GEOM}
${MELT_CONSTS}
${MELT_GEO}
${ADD_PARTICLE}
fn fluidAtM(w: vec2<f32>) -> bool {
  if (!(w.x > 0.0 && w.y > 0.0 && w.x < P.boxw && w.y < P.boxh)) { return false; }
  let c = cellAtN(w.x, w.y);
  return c != NONE && cu[U_SOLID * P.n + c] == 0u && !bodyAtB(w);
}
struct Spot { ok: bool, p: vec2<f32> }
fn freeSpotM(me: u32, o: vec2<f32>, x: vec2<f32>) -> Spot {
  if (fluidAtM(x) && !blocksB(me, o, x)) { return Spot(true, x); }
  for (var ring = 1; ring <= 3; ring++) {
    for (var j = ring; j >= -ring; j--) {
      for (var i = -ring; i <= ring; i++) {
        if (max(abs(i), abs(j)) != ring) { continue; }
        let p = x + vec2<f32>(f32(i), f32(j)) * P.dx;
        if (fluidAtM(p) && !blocksB(me, o, p)) { return Spot(true, p); }
      }
    }
  }
  return Spot(false, x);
}
fn outlineSpotM(me: u32, x: vec2<f32>) -> Spot {
  var best = Spot(false, x);
  var bd = 1e30;
  let rq = rectOf(me, 0u);
  for (var s = 0u; s < 4u; s++) {
    let sd = sideOf(rq, s);
    for (var q = 0u; q < sd.np; q++) {
      let sl = sd.a + (f32(q) + 0.5) / f32(sd.np) * (sd.e - sd.a);
      let w = toWorldB(me, sl + 0.3 * P.dx * sd.n);
      let d = dot(w - x, w - x);
      if (d < bd && fluidAtM(w) && !blocksB(me, toWorldB(me, sl), w)) { bd = d; best = Spot(true, w); }
    }
  }
  return best;
}
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let b = gid.x / 4u;
  let s = gid.x % 4u;
  if (b >= P.nbody) { return; }
  let o = mo(b) + MLT_PEND + s * PEND_W;
  var pm = bmelt[o];
  if (!(pm > 0.0)) { return; }
  var pH = bmelt[o + 1u];
  var ps = bmelt[o + 2u];
  let px = vec2<f32>(bmelt[o + 3u], bmelt[o + 4u]);
  let pn = vec2<f32>(bmelt[o + 5u], bmelt[o + 6u]);
  let gone = bGone(b);
  let nominal = glob[G_RHOREF] * P.vcell / 4.0;
  let v = select(vec2<f32>(bv(b, B_VX), bv(b, B_VY)), vec2<f32>(0.0), gone);
  for (var k = 0u; k < SPAWN_N; k++) {
    if (!(pm > 0.0) || (pm < SPAWN_M * nominal && !gone)) { break; }
    let t = select(-1.0, 1.0, k % 2u == 0u) * ceil(f32(k) / 2.0) * 0.3 * P.dx;
    let x = px + 0.3 * P.dx * pn + t * vec2<f32>(-pn.y, pn.x);
    var at = freeSpotM(b, px, x);
    if (!at.ok && !gone) { at = outlineSpotM(b, x); }
    if (!at.ok) { break; }
    let take = min(pm, nominal);
    let fr = take / pm;
    if (!addParticle(at.p, v, take, pH / pm, fr * ps, true)) { break; }
    pH -= fr * pH;
    ps -= fr * ps;
    pm -= take;
    if (!(pm > 1e-15)) { pm = 0.0; pH = 0.0; ps = 0.0; }
  }
  bmelt[o] = pm;
  bmelt[o + 1u] = pH;
  bmelt[o + 2u] = ps;
}`
  }
];
