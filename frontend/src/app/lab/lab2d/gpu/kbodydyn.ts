/**
 * LABOR 2D (v2) — KÖRPER AUF DER GPU: DIE BEWEGUNG (seit 2026-10-26; das Ende
 * von bodies.finish mit bodyContacts.ts und lab/physics/physCollide.ts) — in
 * EINER Arbeitsgruppe, ein Faden rechnet der Reihe nach wie die CPU:
 *
 *  1. Ein schlafender freier Körper, den die Flüssigkeit stärker hebt, als er
 *     wiegt (1,02 m g), wacht auf.
 *  2. Jeder wache Körper: (M + M_a)(V_frei − V) = Δt (m g + F) +
 *     M_a (D^{n−1} + P^n − P^{n−1}) — die mitbewegte Masse gemessen (Körper aus
 *     mehreren Rechtecken, bProbe*) oder geschätzt (bForce).
 *  3. Berührungen: jedes Rechteck ein Kasten; Paare wacher Teile mit allen
 *     anderen (die Seiten der Kiste, gemalte Feststoffe, angeheftete und
 *     schlafende Körper sind unendlich schwer), Trennachsen mit geschnittener
 *     Berührfläche, zwei Punkte zugleich gelöst, warm gestartet nach Schlüssel
 *     (Kennungen wie bodyContacts.build), zehn Durchgänge in der Reihenfolge der
 *     Schlüssel, Coulombsche Reibung, Rückprall; erlaubtes Eindringen 0,1 Δx,
 *     spekulativer Spalt Δx.
 *  4. Die Vorhersage des nächsten Randwerts (der Zuwachs, wenn keine Berührung
 *     die Geschwindigkeit änderte), Aufwecken angestossener Schläfer, die neue
 *     Lage, das Entweichen durch eine offene Seite (gebucht wie die CPU), das
 *     Einschlafen nach einer halben Sekunde unter 2 mm/s auf etwas.
 *  5. Der schnellste Punkt eines wachen Körpers für Δt (stepEnd).
 */

import { SOLIDS } from '../engine/materials';
import type { KernelDef } from './kernel';
import { BODY_ACCESS } from './kbodylib';
import { BCON_LIVE, BCON_WT, CW, MAXC, WT_W } from './bodies';
import { f } from './lib';

const fa = (xs: readonly number[]): string => xs.map(f).join(', ');

const CONSTS = `
const SLOP_F: f32 = 0.1;
const SPEC_F: f32 = 1.0;
const BAUMGARTE: f32 = 0.22;
const BOUNCE_FROM: f32 = 0.6;
const MAX_PUSH: f32 = 2.5;
const CLIP_EPS: f32 = 1e-7;
const ITERATIONS: u32 = 10u;
const WAKE_SPEED: f32 = 0.01;
const SLEEP_SPEED: f32 = 0.002;
const SLEEP_TIME: f32 = 0.5;
const BUOYANT: f32 = 1.02;
const BCON_WT: u32 = ${BCON_WT}u;
const WT_W: u32 = ${WT_W}u;
const BCON_LIVE: u32 = ${BCON_LIVE}u;
const CW: u32 = ${CW}u;
const MAXC: u32 = ${MAXC}u;
/* Eine Berührung im Arbeitsspeicher: Kennungen a, b; Teile a, b; Punkte; Normale; Reibung, Rückprall; Block (K und K⁻¹); zwei Punkte zu je 16 Wörtern. */
const CO_IDA: u32 = 0u; const CO_IDB: u32 = 1u; const CO_PA: u32 = 2u; const CO_PB: u32 = 3u; const CO_N: u32 = 4u;
const CO_NX: u32 = 5u; const CO_NY: u32 = 6u; const CO_FR: u32 = 7u; const CO_BO: u32 = 8u; const CO_BLK: u32 = 9u;
const CO_K11: u32 = 10u; const CO_K12: u32 = 11u; const CO_K22: u32 = 12u; const CO_I11: u32 = 13u; const CO_I12: u32 = 14u; const CO_I22: u32 = 15u;
const CO_PT: u32 = 16u;
const PT_X: u32 = 0u; const PT_Y: u32 = 1u; const PT_SEP: u32 = 2u; const PT_ID: u32 = 3u; const PT_JN: u32 = 4u; const PT_JT: u32 = 5u;
const PT_RAX: u32 = 6u; const PT_RAY: u32 = 7u; const PT_RBX: u32 = 8u; const PT_RBY: u32 = 9u; const PT_MN: u32 = 10u; const PT_MT: u32 = 11u;
const PT_BIAS: u32 = 12u; const PT_BOUNCE: u32 = 13u; const PT_FIXED: u32 = 14u; const PT_KICK: u32 = 15u;
const S_FRIC = array<f32, ${SOLIDS.length}>(${fa(SOLIDS.map((s) => s.friction))});
const S_BOUNCE = array<f32, ${SOLIDS.length}>(${fa(SOLIDS.map((s) => s.bounce))});
`;

/** Die Teile der Berührungen: ein festes Teil (Wand, gemalter Feststoff: sein Platz in bgeo) oder das Rechteck r des Körpers b (oberstes Bit gesetzt). */
const PARTS = `
fn isBodyPart(p: u32) -> bool { return (p & 0x80000000u) != 0u; }
fn partBody(p: u32) -> u32 { return (p >> 12u) & 0x7ffffu; }
fn bodyPart(b: u32, r: u32) -> u32 { return 0x80000000u | (b << 12u) | r; }
fn partBase(s: u32) -> u32 { return u32(bgeo[GH_PARTS]) + s * PS; }
fn partId(p: u32) -> u32 {
  if (isBodyPart(p)) { return 100000u + partBody(p) * 1000u + (p & 0xfffu); }
  return u32(bgeo[partBase(p) + GP_ID]);
}
/* Die vier Ecken (gegen den Uhrzeigersinn ab unten links) und Aussennormalen (unten, rechts, oben, links) eines Kastens in der Welt. */
fn corner(bx: vec4<f32>, i: u32) -> vec2<f32> { return vec2<f32>(select(bx.z, bx.x, i == 0u || i == 3u), select(bx.w, bx.y, i < 2u)); }
fn normalL(i: u32) -> vec2<f32> {
  if (i == 0u) { return vec2<f32>(0.0, -1.0); }
  if (i == 1u) { return vec2<f32>(1.0, 0.0); }
  if (i == 2u) { return vec2<f32>(0.0, 1.0); }
  return vec2<f32>(-1.0, 0.0);
}
fn vert(p: u32, i: u32) -> vec2<f32> {
  if (!isBodyPart(p)) { let o = partBase(p); return corner(vec4<f32>(bgeo[o], bgeo[o + 1u], bgeo[o + 2u], bgeo[o + 3u]), i); }
  let b = partBody(p);
  let l = corner(rBox(rectOf(b, p & 0xfffu)), i);
  let c = bv(b, B_COS);
  let s = bv(b, B_SIN);
  return vec2<f32>(bv(b, B_X) + c * l.x - s * l.y, bv(b, B_Y) + s * l.x + c * l.y);
}
fn nrmW(p: u32, i: u32) -> vec2<f32> {
  let n = normalL(i);
  if (!isBodyPart(p)) { return n; }
  let b = partBody(p);
  let c = bv(b, B_COS);
  let s = bv(b, B_SIN);
  return vec2<f32>(c * n.x - s * n.y, s * n.x + c * n.y);
}
fn posOf(p: u32) -> vec2<f32> { if (!isBodyPart(p)) { return vec2<f32>(0.0); } let b = partBody(p); return vec2<f32>(bv(b, B_X), bv(b, B_Y)); }
fn velOf(p: u32) -> vec3<f32> { if (!isBodyPart(p)) { return vec3<f32>(0.0); } let b = partBody(p); return vec3<f32>(bv(b, B_VX), bv(b, B_VY), bv(b, B_W)); }
fn invM(p: u32) -> f32 { if (!isBodyPart(p)) { return 0.0; } let b = partBody(p); return select(0.0, 1.0 / bv(b, B_M), bAwake(b)); }
fn invI(p: u32) -> f32 { if (!isBodyPart(p)) { return 0.0; } let b = partBody(p); return select(0.0, 1.0 / bv(b, B_I), bAwake(b)); }
fn fricOf(p: u32) -> f32 { if (!isBodyPart(p)) { return bgeo[partBase(p) + GP_FRIC]; } return S_FRIC[min(u32(bv(partBody(p), B_MAT)), NSOL - 1u)]; }
fn bounceOf(p: u32) -> f32 { if (!isBodyPart(p)) { return bgeo[partBase(p) + GP_BOUNCE]; } return S_BOUNCE[min(u32(bv(partBody(p), B_MAT)), NSOL - 1u)]; }
fn aabb(p: u32) -> vec4<f32> {
  var lo = vec2<f32>(1e30);
  var hi = vec2<f32>(-1e30);
  for (var i = 0u; i < 4u; i++) { let v = vert(p, i); lo = min(lo, v); hi = max(hi, v); }
  return vec4<f32>(lo, hi);
}
`;

/** Die Berührungen im Speicher bcon (f32 über bitcast). */
const STORE = `
fn gf(i: u32) -> f32 { return bitcast<f32>(bcon[i]); }
fn sf(i: u32, v: f32) { bcon[i] = bitcast<u32>(v); }
fn co(k: u32) -> u32 { return BCON_LIVE + k * CW; }
fn pt(k: u32, i: u32) -> u32 { return co(k) + CO_PT + 16u * i; }
/* Ein Stoss P am Punkt (Hebel ra, rb) auf die Körper der Teile a und b (nur bewegliche ändern sich). */
fn impulse(a: u32, b: u32, P: vec2<f32>, q: u32) {
  let ima = invM(a);
  if (ima > 0.0) {
    let ba = partBody(a) * BS;
    bod[ba + B_VX] -= ima * P.x;
    bod[ba + B_VY] -= ima * P.y;
    bod[ba + B_W] -= invI(a) * (gf(q + PT_RAX) * P.y - gf(q + PT_RAY) * P.x);
  }
  let imb = invM(b);
  if (imb > 0.0) {
    let bb = partBody(b) * BS;
    bod[bb + B_VX] += imb * P.x;
    bod[bb + B_VY] += imb * P.y;
    bod[bb + B_W] += invI(b) * (gf(q + PT_RBX) * P.y - gf(q + PT_RBY) * P.x);
  }
}
/* Die Geschwindigkeit von b relativ zu a am Punkt q. */
fn relVel(a: u32, b: u32, q: u32) -> vec2<f32> {
  let va = velOf(a);
  let vb = velOf(b);
  return vec2<f32>(vb.x - vb.z * gf(q + PT_RBY) - va.x + va.z * gf(q + PT_RAY), vb.y + vb.z * gf(q + PT_RBX) - va.y - va.z * gf(q + PT_RAX));
}
fn targetV(q: u32) -> f32 { let bo = gf(q + PT_BOUNCE); return select(gf(q + PT_BIAS), max(gf(q + PT_BIAS), bo), bo > 0.0); }
`;

/** Erkennen (physCollide.polys): die Kante mit der kleinsten Eindringtiefe, das andere Teil an ihren Seiten abgeschnitten — bis zu zwei Punkte. */
const COLLIDE = `
fn maxSep(A: u32, B: u32) -> vec2<f32> {
  var best = -1e30;
  var edge = 0u;
  for (var i = 0u; i < 4u; i++) {
    let n = nrmW(A, i);
    let v = vert(A, i);
    var mn = 1e30;
    for (var j = 0u; j < 4u; j++) { mn = min(mn, dot(vert(B, j) - v, n)); }
    if (mn > best) { best = mn; edge = i; }
  }
  return vec2<f32>(best, f32(edge));
}
fn setPoint(k: u32, at: vec2<f32>, sep: f32, id: u32) {
  let i = bcon[co(k) + CO_N];
  let q = pt(k, i);
  sf(q + PT_X, at.x); sf(q + PT_Y, at.y); sf(q + PT_SEP, sep); bcon[q + PT_ID] = id;
  bcon[co(k) + CO_N] = i + 1u;
}
fn collide(k: u32, a: u32, b: u32, spec: f32) {
  bcon[co(k) + CO_N] = 0u;
  let A = maxSep(a, b);
  if (A.x > spec) { return; }
  let B = maxSep(b, a);
  if (B.x > spec) { return; }
  var refP = a;
  var inc = b;
  var edge = u32(A.y);
  var flip = false;
  if (B.x > 0.98 * A.x + 0.001) { refP = b; inc = a; edge = u32(B.y); flip = true; }
  let i2 = (edge + 1u) % 4u;
  let v1 = vert(refP, edge);
  let v2 = vert(refP, i2);
  let n = nrmW(refP, edge);
  var mn = 1e30;
  var ie = 0u;
  for (var q = 0u; q < 4u; q++) { let d = dot(nrmW(inc, q), n); if (d < mn) { mn = d; ie = q; } }
  let ie2 = (ie + 1u) % 4u;
  var pa = vert(inc, ie);
  var pb = vert(inc, ie2);
  var ida = ie;
  var idb = ie2;
  var tl = length(v2 - v1);
  if (tl == 0.0) { tl = 1.0; }
  let t = (v2 - v1) / tl;
  let lo = dot(t, v1);
  let hi = dot(t, v2);
  for (var side = 0u; side < 2u; side++) {
    let sx = select(1.0, -1.0, side == 0u);
    let off = select(hi, -lo, side == 0u);
    let da = sx * dot(t, pa) - off;
    let db = sx * dot(t, pb) - off;
    if (da > CLIP_EPS && db > CLIP_EPS) { bcon[co(k) + CO_N] = 0u; return; }
    if (da > CLIP_EPS) { let tt = da / (da - db); pa += (pb - pa) * tt; ida = 200u + edge; }
    else if (db > CLIP_EPS) { let tt = da / (da - db); pb = pa + (pb - pa) * tt; idb = 300u + edge; }
  }
  let base = select(0u, 10000u, flip) + edge * 1000u;
  let sa = dot(pa - v1, n);
  let sb = dot(pb - v1, n);
  sf(co(k) + CO_NX, select(n.x, -n.x, flip));
  sf(co(k) + CO_NY, select(n.y, -n.y, flip));
  if (sa <= spec) { setPoint(k, pa - n * sa / 2.0, sa, base + ida); }
  if (sb <= spec) { setPoint(k, pb - n * sb / 2.0, sb, base + idb); }
}
`;

/** Lösen (physCollide.prestep, warm, solve, solveBlock). */
const SOLVE = `
fn prestep(k: u32, h: f32, slop: f32) {
  let o = co(k);
  let a = bcon[o + CO_PA];
  let b = bcon[o + CO_PB];
  let n = vec2<f32>(gf(o + CO_NX), gf(o + CO_NY));
  let t = vec2<f32>(n.y, -n.x);
  let pa = posOf(a);
  let pb = posOf(b);
  let ima = invM(a); let imb = invM(b); let iia = invI(a); let iib = invI(b);
  let cnt = bcon[o + CO_N];
  for (var i = 0u; i < cnt; i++) {
    let q = pt(k, i);
    let p = vec2<f32>(gf(q + PT_X), gf(q + PT_Y));
    let ra = p - pa;
    let rb = p - pb;
    sf(q + PT_RAX, ra.x); sf(q + PT_RAY, ra.y); sf(q + PT_RBX, rb.x); sf(q + PT_RBY, rb.y);
    let rna = ra.x * n.y - ra.y * n.x;
    let rnb = rb.x * n.y - rb.y * n.x;
    let kn = ima + imb + iia * rna * rna + iib * rnb * rnb;
    sf(q + PT_MN, select(0.0, 1.0 / kn, kn > 0.0));
    let rta = ra.x * t.y - ra.y * t.x;
    let rtb = rb.x * t.y - rb.y * t.x;
    let kt = ima + imb + iia * rta * rta + iib * rtb * rtb;
    sf(q + PT_MT, select(0.0, 1.0 / kt, kt > 0.0));
    let sep = gf(q + PT_SEP);
    sf(q + PT_BIAS, select(min(MAX_PUSH, (BAUMGARTE / h) * max(0.0, -sep - slop)), -sep / h, sep > 0.0));
    let vn = dot(relVel(a, b, q), n);
    var bo = 0.0;
    if (vn < -BOUNCE_FROM && (sep <= slop || sep + vn * h < 0.0)) { bo = -gf(o + CO_BO) * vn; }
    sf(q + PT_BOUNCE, bo);
    if (bcon[q + PT_KICK] != 0u || bo > 0.0) { sf(q + PT_JN, 0.0); sf(q + PT_JT, 0.0); }
    bcon[q + PT_KICK] = 0u;
    sf(q + PT_FIXED, 0.0);
  }
  bcon[o + CO_BLK] = 0u;
  if (cnt == 2u) {
    let q1 = pt(k, 0u);
    let q2 = pt(k, 1u);
    let rn1a = gf(q1 + PT_RAX) * n.y - gf(q1 + PT_RAY) * n.x;
    let rn1b = gf(q1 + PT_RBX) * n.y - gf(q1 + PT_RBY) * n.x;
    let rn2a = gf(q2 + PT_RAX) * n.y - gf(q2 + PT_RAY) * n.x;
    let rn2b = gf(q2 + PT_RBX) * n.y - gf(q2 + PT_RBY) * n.x;
    let m = ima + imb;
    let k11 = m + iia * rn1a * rn1a + iib * rn1b * rn1b;
    let k22 = m + iia * rn2a * rn2a + iib * rn2b * rn2b;
    let k12 = m + iia * rn1a * rn2a + iib * rn1b * rn2b;
    sf(o + CO_K11, k11); sf(o + CO_K12, k12); sf(o + CO_K22, k22);
    let det = k11 * k22 - k12 * k12;
    if (k11 * k11 < 1000.0 * det && det > 0.0) {
      bcon[o + CO_BLK] = 1u;
      sf(o + CO_I11, k22 / det); sf(o + CO_I12, -k12 / det); sf(o + CO_I22, k11 / det);
    }
  }
}
fn warm(k: u32) {
  let o = co(k);
  let a = bcon[o + CO_PA];
  let b = bcon[o + CO_PB];
  let n = vec2<f32>(gf(o + CO_NX), gf(o + CO_NY));
  let t = vec2<f32>(n.y, -n.x);
  let cnt = bcon[o + CO_N];
  for (var i = 0u; i < cnt; i++) { let q = pt(k, i); impulse(a, b, gf(q + PT_JN) * n + gf(q + PT_JT) * t, q); }
}
fn solveBlock(k: u32, a: u32, b: u32, n: vec2<f32>) {
  let o = co(k);
  let q1 = pt(k, 0u);
  let q2 = pt(k, 1u);
  let a1 = gf(q1 + PT_JN);
  let a2 = gf(q2 + PT_JN);
  let k11 = gf(o + CO_K11); let k12 = gf(o + CO_K12); let k22 = gf(o + CO_K22);
  let b1 = dot(relVel(a, b, q1), n) - targetV(q1) - (k11 * a1 + k12 * a2);
  let b2 = dot(relVel(a, b, q2), n) - targetV(q2) - (k12 * a1 + k22 * a2);
  var x1 = -(gf(o + CO_I11) * b1 + gf(o + CO_I12) * b2);
  var x2 = -(gf(o + CO_I12) * b1 + gf(o + CO_I22) * b2);
  var ok = x1 >= 0.0 && x2 >= 0.0;
  if (!ok) { x1 = -b1 / k11; x2 = 0.0; ok = x1 >= 0.0 && k12 * x1 + b2 >= 0.0; }
  if (!ok) { x1 = 0.0; x2 = -b2 / k22; ok = x2 >= 0.0 && k12 * x2 + b1 >= 0.0; }
  if (!ok) { if (b1 >= 0.0 && b2 >= 0.0) { x1 = 0.0; x2 = 0.0; ok = true; } }
  if (!ok) { return; }
  impulse(a, b, (x1 - a1) * n, q1);
  impulse(a, b, (x2 - a2) * n, q2);
  sf(q1 + PT_JN, x1);
  sf(q2 + PT_JN, x2);
}
fn solveC(k: u32, h: f32, slop: f32) {
  let o = co(k);
  let a = bcon[o + CO_PA];
  let b = bcon[o + CO_PB];
  let n = vec2<f32>(gf(o + CO_NX), gf(o + CO_NY));
  let t = vec2<f32>(n.y, -n.x);
  let cnt = bcon[o + CO_N];
  let fr = gf(o + CO_FR);
  for (var i = 0u; i < cnt; i++) {
    let q = pt(k, i);
    let vt = dot(relVel(a, b, q), t);
    let lim = fr * gf(q + PT_JN);
    let jt = clamp(gf(q + PT_JT) - gf(q + PT_MT) * vt, -lim, lim);
    let d = jt - gf(q + PT_JT);
    sf(q + PT_JT, jt);
    impulse(a, b, d * t, q);
  }
  if (bcon[o + CO_BLK] != 0u) { solveBlock(k, a, b, n); return; }
  let bounce = gf(o + CO_BO);
  for (var i = 0u; i < cnt; i++) {
    let q = pt(k, i);
    let vn = dot(relVel(a, b, q), n);
    let sep = gf(q + PT_SEP);
    if (gf(q + PT_BOUNCE) == 0.0 && bounce >= 0.5 && vn < -BOUNCE_FROM && (sep <= slop || sep + vn * h < 0.0)) { sf(q + PT_BOUNCE, -bounce * vn); }
    let jn = max(gf(q + PT_JN) + gf(q + PT_MN) * (-vn + targetV(q)), gf(q + PT_FIXED));
    let d = jn - gf(q + PT_JN);
    sf(q + PT_JN, jn);
    impulse(a, b, d * n, q);
    if (gf(q + PT_BOUNCE) > 0.0) { sf(q + PT_FIXED, jn); sf(q + PT_BOUNCE, -1.0); bcon[q + PT_KICK] = 1u; }
  }
}
`;

/** Ein symmetrisches 3 × 3-System nach x (Cramer; bodies.solve3). */
const SOLVE3 = `
fn solve3(a00: f32, a01: f32, a02: f32, a11: f32, a12: f32, a22: f32, r: vec3<f32>) -> vec3<f32> {
  let c00 = a11 * a22 - a12 * a12;
  let c01 = a02 * a12 - a01 * a22;
  let c02 = a01 * a12 - a02 * a11;
  let det = a00 * c00 + a01 * c01 + a02 * c02;
  let c11 = a00 * a22 - a02 * a02;
  let c12 = a01 * a02 - a00 * a12;
  let c22 = a00 * a11 - a01 * a01;
  return vec3<f32>(c00 * r.x + c01 * r.y + c02 * r.z, c01 * r.x + c11 * r.y + c12 * r.z, c02 * r.x + c12 * r.y + c22 * r.z) / det;
}
`;

export const BODY_DYN_KERNELS: readonly KernelDef[] = [
  {
    name: 'bDyn', wg: 64,
    bind: 'P:u glob:r cnt:a bod:w bgeo:r bcell:r bcon:w<u32>',
    code: `${BODY_ACCESS}
${CONSTS}
${PARTS}
${STORE}
${COLLIDE}
${SOLVE}
${SOLVE3}
fn speedOf(b: u32) -> f32 { return length(vec2<f32>(bv(b, B_VX), bv(b, B_VY))) + abs(bv(b, B_W)) * bv(b, B_RMAX); }
/* Kein Zuwachs und keine Vorhersage aus früheren Schritten (beim Aufwecken und Einschlafen). */
fn forget(b: u32) {
  let o = b * BS;
  for (var d = 0u; d < 3u; d++) { bod[o + B_PREV + d] = 0.0; bod[o + B_PRED + d] = 0.0; bod[o + B_PNOW + d] = 0.0; bod[o + B_POLD + d] = 0.0; }
}
fn wakeB(b: u32) {
  if (!bFree(b) || bv(b, B_ASLEEP) == 0.0) { return; }
  let o = b * BS;
  bod[o + B_ASLEEP] = 0.0;
  bod[o + B_REST] = 0.0;
  bod[o + B_MAOK] = 0.0;
  forget(b);
}
/* Der Warmstart einer Berührung (Kennungen ia, ib) aus der Tabelle des letzten Schritts (nach Schlüssel geordnet); NONE: keiner. */
fn findWarm(ia: u32, ib: u32) -> u32 {
  var lo = 0;
  var hi = i32(min(bcon[0], MAXC)) - 1;
  loop {
    if (lo > hi) { break; }
    let mid = (lo + hi) / 2;
    let o = BCON_WT + u32(mid) * WT_W;
    let ka = bcon[o];
    let kb = bcon[o + 1u];
    if (ka == ia && kb == ib) { return o; }
    if (ka < ia || (ka == ia && kb < ib)) { lo = mid + 1; } else { hi = mid - 1; }
  }
  return NONE;
}
/* Die Berührungen dieses Schritts: Zahl, Schlüssel (Kennungen a, b), Reihenfolge der Lösung. */
var<private> nlive: u32;
var<private> keys: array<vec2<u32>, ${MAXC}>;
var<private> order: array<u32, ${MAXC}>;
/* Ein Paar (a vor b in der Reihenfolge der Teile wie bodyContacts.build): berühren sie sich, eine neue Berührung mit dem Warmstart des letzten Schritts. */
fn tryPair(pa: u32, pb: u32, mine: vec4<f32>, other: u32, spec: f32) {
  let bo = aabb(other);
  if (bo.x > mine.z + spec || bo.z < mine.x - spec || bo.y > mine.w + spec || bo.w < mine.y - spec) { return; }
  if (nlive >= MAXC) { atomicAdd(&cnt[C_CONT_FULL], 1u); return; }
  let k = nlive;
  let o = co(k);
  let ia = partId(pa);
  let ib = partId(pb);
  bcon[o + CO_IDA] = ia; bcon[o + CO_IDB] = ib; bcon[o + CO_PA] = pa; bcon[o + CO_PB] = pb;
  sf(o + CO_FR, sqrt(fricOf(pa) * fricOf(pb)));
  sf(o + CO_BO, max(bounceOf(pa), bounceOf(pb)));
  collide(k, pa, pb, spec);
  let cntP = bcon[o + CO_N];
  if (cntP == 0u) { return; }
  /* Warm starten: dieselben Merkmale behalten ihre Stösse; „schon zurückgeprallt“ hängt am Platz des Punkts. */
  let w = findWarm(ia, ib);
  for (var i = 0u; i < 2u; i++) {
    let q = pt(k, i);
    sf(q + PT_JN, 0.0); sf(q + PT_JT, 0.0);
    bcon[q + PT_KICK] = select(0u, bcon[w + 6u + 4u * i], w != NONE);
  }
  if (w != NONE) {
    let oc = min(2u, bcon[w + 2u]);
    for (var i = 0u; i < cntP; i++) {
      let q = pt(k, i);
      for (var j = 0u; j < oc; j++) {
        if (bcon[w + 3u + 4u * j] == bcon[q + PT_ID]) { bcon[q + PT_JN] = bcon[w + 4u + 4u * j]; bcon[q + PT_JT] = bcon[w + 5u + 4u * j]; break; }
      }
    }
  }
  keys[k] = vec2<u32>(ia, ib);
  nlive = k + 1u;
}
@compute @workgroup_size(64) fn main(@builtin(local_invocation_id) lid3: vec3<u32>) {
  if (lid3.x != 0u) { return; }
  let dt = glob[G_DT];
  let slop = SLOP_F * P.dx;
  let spec = SPEC_F * P.dx;
  /* 1. Hebt die Flüssigkeit einen schlafenden Körper stärker, als er wiegt? Dann wacht er auf. */
  for (var b = 0u; b < P.nbody; b++) {
    if (bFree(b) && bv(b, B_ASLEEP) != 0.0 && bv(b, B_FY) > BUOYANT * bv(b, B_M) * P.gy) { wakeB(b); }
  }
  /* 2. Flüssigkeit und Schwerkraft: (M + M_a) ΔV = Δt (m g + F) + M_a (D^{n−1} + P^n − P^{n−1}). */
  for (var b = 0u; b < P.nbody; b++) {
    if (!bAwake(b)) { continue; }
    let o = b * BS;
    var m6 = array<f32, 6>(bv(b, B_MA), 0.0, 0.0, bv(b, B_MA), 0.0, bv(b, B_IA));
    if (bv(b, B_PROBE) != 0.0 && bv(b, B_MAOK) != 0.0) { for (var d = 0u; d < 6u; d++) { m6[d] = bv(b, B_MA6 + d); } }
    let c0 = bv(b, B_PREV) + bv(b, B_PNOW) - bv(b, B_POLD);
    let c1 = bv(b, B_PREV + 1u) + bv(b, B_PNOW + 1u) - bv(b, B_POLD + 1u);
    let c2 = bv(b, B_PREV + 2u) + bv(b, B_PNOW + 2u) - bv(b, B_POLD + 2u);
    let m = bv(b, B_M);
    let r = vec3<f32>(dt * bv(b, B_FX) + m6[0] * c0 + m6[1] * c1 + m6[2] * c2,
      dt * (bv(b, B_FY) - m * P.gy) + m6[1] * c0 + m6[3] * c1 + m6[4] * c2,
      dt * bv(b, B_TQ) + m6[2] * c0 + m6[4] * c1 + m6[5] * c2);
    let dv = solve3(m + m6[0], m6[1], m6[2], m + m6[3], m6[4], bv(b, B_I) + m6[5], r);
    bod[o + B_VX] += dv.x;
    bod[o + B_VY] += dv.y;
    bod[o + B_W] += dv.z;
    bod[o + B_PREV] = dv.x; bod[o + B_PREV + 1u] = dv.y; bod[o + B_PREV + 2u] = dv.z;
    for (var d = 0u; d < 3u; d++) { bod[o + B_POLD + d] = bod[o + B_PNOW + d]; }
    bod[o + B_VPRE] = bod[o + B_VX]; bod[o + B_VPRE + 1u] = bod[o + B_VY]; bod[o + B_VPRE + 2u] = bod[o + B_W];
  }
  /* 3. Berührungen: Paare (ein waches Teil gegen jedes andere eines anderen Körpers, Umgrenzungen mit dem spekulativen Spalt). */
  for (var b = 0u; b < P.nbody; b++) { bod[b * BS + B_TOUCH] = 0.0; bod[b * BS + B_WAKE] = 0.0; }
  nlive = 0u;
  let nstat = u32(bgeo[GH_NPARTS]);
  for (var A = 0u; A < P.nbody; A++) {
    if (!bAwake(A)) { continue; }
    let nrA = u32(bv(A, B_NR));
    for (var ra = 0u; ra < nrA; ra++) {
      let pA = bodyPart(A, ra);
      let bA = aabb(pA);
      for (var s = 0u; s < nstat; s++) { tryPair(s, pA, bA, s, spec); }
      for (var B = 0u; B < P.nbody; B++) {
        /* Zwei wache Körper: das Paar zählt bei dem mit der kleineren Nummer. */
        if (B == A || bGone(B) || (bAwake(B) && B < A)) { continue; }
        let nrB = u32(bv(B, B_NR));
        for (var rb = 0u; rb < nrB; rb++) {
          let pB = bodyPart(B, rb);
          if (B < A) { tryPair(pB, pA, bA, pB, spec); } else { tryPair(pA, pB, bA, pB, spec); }
        }
      }
    }
  }
  /* Nach Schlüssel geordnet lösen (dieselbe Reihenfolge wie nach einem Schlüsselbild). */
  for (var k = 0u; k < nlive; k++) {
    var at = k;
    loop {
      if (at == 0u) { break; }
      let pk = keys[order[at - 1u]];
      let ck = keys[k];
      if (pk.x < ck.x || (pk.x == ck.x && pk.y < ck.y)) { break; }
      order[at] = order[at - 1u];
      at -= 1u;
    }
    order[at] = k;
  }
  for (var k = 0u; k < nlive; k++) { prestep(order[k], dt, slop); }
  for (var k = 0u; k < nlive; k++) { warm(order[k]); }
  for (var it = 0u; it < ITERATIONS; it++) { for (var k = 0u; k < nlive; k++) { solveC(order[k], dt, slop); } }
  /* Wer berührt wen; wer wird geweckt (ein wacher Körper stösst einen schlafenden schneller als 1 cm/s an). */
  for (var k = 0u; k < nlive; k++) {
    let o = co(order[k]);
    let a = bcon[o + CO_PA];
    let b = bcon[o + CO_PB];
    let ba = select(NONE, partBody(a), isBodyPart(a));
    let bb = select(NONE, partBody(b), isBodyPart(b));
    if (ba != NONE) { bod[ba * BS + B_TOUCH] = 1.0; }
    if (bb != NONE) { bod[bb * BS + B_TOUCH] = 1.0; }
    if (ba != NONE && bb != NONE && (bv(ba, B_ASLEEP) != 0.0) != (bv(bb, B_ASLEEP) != 0.0) && bv(ba, B_PINNED) == 0.0 && bv(bb, B_PINNED) == 0.0) {
      let mover = select(ba, bb, bv(ba, B_ASLEEP) != 0.0);
      let sleeper = select(bb, ba, bv(ba, B_ASLEEP) != 0.0);
      if (speedOf(mover) > WAKE_SPEED) { bod[sleeper * BS + B_WAKE] = 1.0; }
    }
  }
  /* Der Warmstart für den nächsten Schritt (oder ein Schlüsselbild): die Berührungen nach Schlüssel. */
  bcon[0] = nlive;
  for (var k = 0u; k < nlive; k++) {
    let o = co(order[k]);
    let w = BCON_WT + k * WT_W;
    bcon[w] = bcon[o + CO_IDA];
    bcon[w + 1u] = bcon[o + CO_IDB];
    bcon[w + 2u] = bcon[o + CO_N];
    for (var i = 0u; i < 2u; i++) {
      let q = o + CO_PT + 16u * i;
      bcon[w + 3u + 4u * i] = bcon[q + PT_ID];
      bcon[w + 4u + 4u * i] = bcon[q + PT_JN];
      bcon[w + 5u + 4u * i] = bcon[q + PT_JT];
      bcon[w + 6u + 4u * i] = bcon[q + PT_KICK];
    }
  }
  /* 4. Die Vorhersage für die nächste Projektion: der Zuwachs aus Flüssigkeit und Schwerkraft, wenn keine Berührung die Geschwindigkeit änderte. */
  for (var b = 0u; b < P.nbody; b++) {
    if (!bAwake(b)) { continue; }
    let o = b * BS;
    let hit = abs(bv(b, B_VX) - bv(b, B_VPRE)) + abs(bv(b, B_VY) - bv(b, B_VPRE + 1u)) + abs(bv(b, B_W) - bv(b, B_VPRE + 2u)) * bv(b, B_RMAX) > 1e-9;
    for (var d = 0u; d < 3u; d++) { bod[o + B_PRED + d] = select(bod[o + B_PREV + d], 0.0, hit); }
  }
  for (var b = 0u; b < P.nbody; b++) { if (bv(b, B_WAKE) != 0.0) { wakeB(b); } }
  /* 5. Neue Lagen; durch eine offene Seite hinaus; einschlafen; der schnellste Punkt für Δt. */
  var vmax = 0.0;
  for (var b = 0u; b < P.nbody; b++) {
    if (!bAwake(b)) { continue; }
    let o = b * BS;
    bod[o + B_X] += dt * bod[o + B_VX];
    bod[o + B_Y] += dt * bod[o + B_VY];
    bod[o + B_A] += dt * bod[o + B_W];
    let x = bod[o + B_X];
    let y = bod[o + B_Y];
    if (x < 0.0 || y < 0.0 || x > P.boxw || y > P.boxh) {
      /* Entwichen: mit Energie, Film und Kruste gebucht wie Entwichenes; Eis ist Wasser. */
      var E = 0.0;
      var film = 0.0;
      var crust = 0.0;
      let ko = u32(bv(b, B_KO));
      let nk = u32(bv(b, B_NCELL));
      for (var k = 0u; k < nk; k++) { E += bcell[BC * (ko + k)]; film += bcell[BC * (ko + k) + 1u]; crust += bcell[BC * (ko + k) + 2u]; }
      let m = bv(b, B_M);
      let e0 = bv(b, B_E0);
      addF_cnt(C_ESC_ENERGY, E + e0 * m);
      addF_cnt(C_ESC_WATER, film + select(0.0, m, e0 != 0.0));
      addF_cnt(C_ESC_SALT, crust);
      bod[o + B_GONE] = 1.0;
      bod[o + B_AGAIN] = 1.0;
      bod[o + B_VX] = 0.0; bod[o + B_VY] = 0.0; bod[o + B_W] = 0.0;
      continue;
    }
    if (speedOf(b) < SLEEP_SPEED && bv(b, B_TOUCH) != 0.0) { bod[o + B_REST] += dt; } else { bod[o + B_REST] = 0.0; }
    if (bod[o + B_REST] >= SLEEP_TIME) {
      bod[o + B_ASLEEP] = 1.0;
      bod[o + B_REST] = 0.0;
      bod[o + B_VX] = 0.0; bod[o + B_VY] = 0.0; bod[o + B_W] = 0.0;
      bod[o + B_UX] = 0.0; bod[o + B_UY] = 0.0; bod[o + B_UW] = 0.0;
      forget(b);
      bod[o + B_AGAIN] = 1.0;
      continue;
    }
    vmax = max(vmax, speedOf(b));
  }
  if (vmax > 0.0) { maxU_cnt(C_BVMAX, vmax); }
}`
  }
];
