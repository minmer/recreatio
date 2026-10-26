/**
 * LABOR 2D (v2) — DIE KERNE DES GASES auf der GPU (wie engine/gas.ts,
 * regions.ts): Ableiten der Zellen, Wechsel der Zellart, die Gebiete mit ihrem
 * Druck p0, die Kompressionswärme verschlossener Gebiete, Volumina und
 * Gasflächen. Transport, Geschwindigkeit und Projektion stehen in kgasflow.ts.
 *
 * Beiträge vieler Fäden zu einer Zelle (Wechsel der Zellart, platzende
 * Blasen, Verdampfen) laufen über die atomaren Felder A_DN … A_DH; `gasApply`
 * bucht sie und leitet die Zellen neu ab.
 */

import type { KernelDef } from './kernel';

const WG = 128;
const MAIN = '@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)';

/**
 * T aus H und alles Abgeleitete einer Zelle (wie Gas.deriveCell; cf schreibend). Das Gasvolumen ohne das Körperstück der Zelle,
 * (1 − fs − φ − α) V (fs = 0 ohne freie Körper); die Temperatur eines Feststoffanteils aus seiner Energie mit der Wärmekapazität
 * der Körperteile (capB, sonst die der ganzen Zelle), in einer gemischten Zelle nach F_TSB, in einer festen auch nach F_T.
 */
export const DERIVE = `
fn massOf(c: u32) -> f32 {
  let n = P.n;
  return cf[F_MN * n + c] + cf[F_MO * n + c] + cf[F_MV * n + c] + cf[F_MF * n + c];
}
fn deriveCell(c: u32) {
  let n = P.n;
  let vg = max(1e-3, 1.0 - cf[F_FS * n + c] - cf[F_PHI * n + c] - cf[F_ALPHA * n + c]) * P.vcell;
  cf[F_VGAS * n + c] = vg;
  let mN = cf[F_MN * n + c];
  let mO = cf[F_MO * n + c];
  let mV = cf[F_MV * n + c];
  let mF = cf[F_MF * n + c];
  let m = mN + mO + mV;
  cf[F_NMOL * n + c] = mN / M_N2 + mO / M_O2 + mV / M_H2O;
  if (m + mF <= 1e-30) { cf[F_RHO * n + c] = 0.0; cf[F_CAP * n + c] = 0.0; cf[F_MU * n + c] = 1.8e-5; return; }
  let H = cf[F_HG * n + c];
  var T = 0.0;
  if (mF <= 0.0) {
    T = gasTemperature(mN, mO, mV, H);
  } else {
    T = cf[F_T * n + c];
    if (!(T > 100.0)) { T = P.tamb; }
    for (var it = 0; it < 4; it++) {
      let dT = (H - gasEnthalpy(mN, mO, mV, mF, T)) / gasHeatCapacity(mN, mO, mV, mF, T);
      T += dT;
      if (abs(dT) < 1e-6) { break; }
    }
  }
  if (!(T > 150.0 && T < 3000.0)) { T = clamp(select(P.tamb, T, T == T), 150.0, 3000.0); }
  cf[F_T * n + c] = T;
  cf[F_CAP * n + c] = gasHeatCapacity(mN, mO, mV, mF, T);
  cf[F_RHO * n + c] = m / vg;
  cf[F_MU * n + c] = muMix(mN, mO, mV, T);
}
fn deriveSolid(c: u32) {
  let n = P.n;
  let s = cu[U_SOLID * n + c];
  let capB = cf[F_CAPB * n + c];
  var cs = 0.0;
  if (capB > 0.0) { cs = capB + cf[F_CRUST * n + c] * CP_CRYSTAL; }
  else { cs = solidRho(s) * solidCp(s) * P.vcell + cf[F_CRUST * n + c] * CP_CRYSTAL; }
  let film = cf[F_FILM * n + c];
  let E = cf[F_ES * n + c];
  let solid = s != 0u;
  var T = 0.0;
  if (film <= 0.0) { T = T0 + E / cs; }
  else {
    T = select(cf[F_TSB * n + c], cf[F_T * n + c], solid);
    if (!(T > 100.0)) { T = T0 + E / cs; }
    for (var it = 0; it < 3; it++) { T -= (cs * (T - T0) + film * hL(T) - E) / (cs + film * cpL(T)); }
  }
  cf[F_TSB * n + c] = T;
  if (solid) { cf[F_T * n + c] = T; }
}
`;

/** Druck des Gebiets aus Σ nRT (A) und Σ nRT·y (B) bei V_g: Σ a_c/(p − ρ̄ g y_c) = V_g bis zur zweiten Ordnung in ρ̄ g y/p (Abweichung ≈ 1e-10). */
const STATE_P = `
fn statePressure(A: f32, B: f32, V: f32, rhoBar: f32) -> f32 {
  if (!(A > 0.0)) { return P.pamb; }
  let rg = rhoBar * P.gy;
  if (rg == 0.0) { return A / V; }
  return (A + sqrt(A * A + 4.0 * V * rg * B)) / (2.0 * V);
}
`;

/** Summen je Gebiet: die ersten vier Gebiete über die Arbeitsgruppe, die übrigen direkt (racc gebunden). */
export const REGSUM = `
var<workgroup> rr: array<f32, ${16 * WG}>;
fn regSum(lid: u32, r: u32, v: vec4<f32>, fields: vec4<u32>) {
  for (var k = 0u; k < 16u; k++) { rr[k * WG + lid] = 0.0; }
  if (r < 4u) { for (var k = 0u; k < 4u; k++) { rr[(r * 4u + k) * WG + lid] = v[k]; } }
  else if (r != NONE) { for (var k = 0u; k < 4u; k++) { if (v[k] != 0.0) { addF_racc(r * RACC_STRIDE + fields[k], v[k]); } } }
  workgroupBarrier();
  for (var s = WG / 2u; s > 0u; s >>= 1u) {
    if (lid < s) { for (var k = 0u; k < 16u; k++) { rr[k * WG + lid] += rr[k * WG + lid + s]; } }
    workgroupBarrier();
  }
  if (lid < 16u) {
    let q = lid / 4u;
    let k = lid % 4u;
    let sum = rr[lid * WG];
    if (sum != 0.0 && q < P.nreg) { addF_racc(q * RACC_STRIDE + fields[k], sum); }
  }
}
`;

export const GAS_KERNELS: readonly KernelDef[] = [
  /* -- Beiträge buchen und ableiten ------------------------------------------------------------------ */
  ...([['gasApply', 0], ['gasApplyMid', 1], ['gasEos', 2]] as const).map(([name, mode]): KernelDef => ({
    name, wg: WG,
    bind: 'P:u cf:w cu:r at:w reg:r',
    code: `${DERIVE}
${MAIN} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let k = cu[U_KIND * n + c];
  ${mode === 2 ? '' : `
  let dN = at[A_DN * n + c]; let dO = at[A_DO * n + c]; let dV = at[A_DV * n + c]; let dF = at[A_DF * n + c]; let dH = at[A_DH * n + c];
  if (dN != 0.0 || dO != 0.0 || dV != 0.0 || dF != 0.0 || dH != 0.0) {
    cf[F_MN * n + c] += dN; cf[F_MO * n + c] += dO; cf[F_MV * n + c] = max(0.0, cf[F_MV * n + c] + dV); cf[F_MF * n + c] = max(0.0, cf[F_MF * n + c] + dF); cf[F_HG * n + c] += dH;
    at[A_DN * n + c] = 0.0; at[A_DO * n + c] = 0.0; at[A_DV * n + c] = 0.0; at[A_DF * n + c] = 0.0; at[A_DH * n + c] = 0.0;
  }
  /* Kristalle (M2b): Kruste der festen Zelle (ihre Enthalpie kommt über DES), Salz am Boden der Kiste je Spalte. */
  let dCr = at[A_DCRUST * n + c];
  if (dCr != 0.0) { cf[F_CRUST * n + c] += dCr; at[A_DCRUST * n + c] = 0.0; }
  let dFl = at[A_DFLOOR * n + c]; let dFh = at[A_DFLOORH * n + c];
  if (dFl != 0.0 || dFh != 0.0) { cf[F_FLOOR * n + c] += dFl; cf[F_FLOORH * n + c] += dFh; at[A_DFLOOR * n + c] = 0.0; at[A_DFLOORH * n + c] = 0.0; }
  let dFi = at[A_DFILM * n + c]; let dEs = at[A_DES * n + c];
  if (dFi != 0.0 || dEs != 0.0 || dCr != 0.0) {
    cf[F_FILM * n + c] = max(0.0, cf[F_FILM * n + c] + dFi); cf[F_ES * n + c] += dEs;
    at[A_DFILM * n + c] = 0.0; at[A_DES * n + c] = 0.0;
    if (k == SOLID) { deriveSolid(c); }
  }`}
  if (k == SOLID) { cf[F_VGAS * n + c] = 0.0; cf[F_RHO * n + c] = 0.0; cf[F_VEOS * n + c] = 0.0; ${mode === 2 ? 'cf[F_SRCV * n + c] = 0.0;' : ''} return; }
  ${mode === 2 ? '' : `/* Flüssige Zelle ohne Gas, auch eben geleert (release, Wechsel der Zellart): Mole, Wärmekapazität und Dichte 0, wie Gas.deriveCell
     nach move — sonst zählte heatPrep die alte Wärmekapazität mit, und heatShare liesse Enthalpie in der leeren Zelle. */
  if (k == LIQUID && massOf(c) <= 0.0) {
    cf[F_VGAS * n + c] = 0.0; cf[F_VEOS * n + c] = 0.0; cf[F_NMOL * n + c] = 0.0; cf[F_CAP * n + c] = 0.0; cf[F_RHO * n + c] = 0.0;
    ${mode === 1 ? 'cf[F_VEOSMID * n + c] = 0.0;' : ''}
    return;
  }
  deriveCell(c);`}
  var veos = 0.0;
  if (cf[F_VGAS * n + c] > 0.0) { veos = cf[F_NMOL * n + c] * R_GAS * cf[F_T * n + c] / pAt(c); }
  cf[F_VEOS * n + c] = veos;
  ${mode === 1 ? 'cf[F_VEOSMID * n + c] = veos;' : ''}
  ${mode === 2 ? 'cf[F_SRCV * n + c] = select(0.0, veos - cf[F_VEOSMID * n + c], k == GAS);' : ''}
}`
  })),
  {
    /* Wechsel der Zellart (wie Gas.transitions): wird eine Gaszelle flüssig, geht ihr Gas an die Gasnachbarn; wird eine Zelle Gas, holt sie sich Gas.
       Gas, das in einer flüssigen Zelle bliebe (flüssig geworden ohne Gasnachbarn, oder flüssig geblieben mit Gas), gibt release fort. */
    name: 'transitions', wg: WG,
    bind: 'P:u cf:r cu:r at:a cnt:a',
    code: `fn nbOf(c: u32, k: u32) -> u32 {
  let i = ci(c);
  let j = cj(c);
  if (k == 0u) { return select(NONE, c - 1u, i > 0); }
  if (k == 1u) { return select(NONE, c + 1u, i < i32(P.nx) - 1); }
  if (k == 2u) { return select(NONE, c - P.nx, j > 0); }
  return select(NONE, c + P.nx, j < i32(P.ny) - 1);
}
fn stableGas(nb: u32) -> bool { return nb != NONE && cu[U_KIND * P.n + nb] == GAS && cu[U_KPREV * P.n + nb] == GAS; }
fn vol(nb: u32) -> f32 { let v = cf[F_VGAS * P.n + nb]; return select(P.vcell, v, v > 0.0); }
fn mass(c: u32) -> f32 { let n = P.n; return cf[F_MN * n + c] + cf[F_MO * n + c] + cf[F_MV * n + c] + cf[F_MF * n + c]; }
/* Den Anteil share von a nach b (Arten, Nebel, Enthalpie) als Beiträge. */
fn moveGas(a: u32, b: u32, share: f32) {
  let n = P.n;
  let dN = cf[F_MN * n + a] * share; let dO = cf[F_MO * n + a] * share; let dV = cf[F_MV * n + a] * share;
  let dF = cf[F_MF * n + a] * share; let dH = cf[F_HG * n + a] * share;
  addF_at(A_DN * n + a, -dN); addF_at(A_DO * n + a, -dO); addF_at(A_DV * n + a, -dV); addF_at(A_DF * n + a, -dF); addF_at(A_DH * n + a, -dH);
  addF_at(A_DN * n + b, dN); addF_at(A_DO * n + b, dO); addF_at(A_DV * n + b, dV); addF_at(A_DF * n + b, dF); addF_at(A_DH * n + b, dH);
}
/* Die nächste Gaszelle im Fenster 9 × 9 um c (Ringe 1…4), wie die Breitensuche von Gas.release: von Zelle zu Zelle über ihre
   Seiten (links, rechts, unten, oben wie die CPU), nur durch nicht feste Zellen desselben Gebiets und nur im Fenster; die erste
   Gaszelle ist das Ziel, NONE, wenn keine. Es zählt der Weg, nicht die Lage: dieselbe Nummer allein hiesse nur „irgendwo verbunden“,
   eine Gaszelle hinter einer dünnen Wand wäre sonst nah. Marken (81 Bit) und Warteschlange liegen im Speicher des Fadens. */
fn nearGas(c: u32) -> u32 {
  let n = P.n;
  let r = cu[U_RID * n + c];
  if (r == NONE) { return NONE; }
  /* Fensterzelle w = a + 9 b (a, b = 0…8); c ist w = 40. */
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
    for (var k = 0u; k < 4u; k++) {
      var a = i32(w % 9u);
      var b = i32(w / 9u);
      if (k == 0u) { a -= 1; } else if (k == 1u) { a += 1; } else if (k == 2u) { b -= 1; } else { b += 1; }
      if (a < 0 || b < 0 || a > 8 || b > 8 || !inGrid(i0 + a, j0 + b)) { continue; }
      let v = u32(a + 9 * b);
      let bit = 1u << (v & 31u);
      if ((seen[v >> 5u] & bit) != 0u) { continue; }
      seen[v >> 5u] = seen[v >> 5u] | bit;
      let q = cellOf(i0 + a, j0 + b);
      let kq = cu[U_KIND * n + q];
      if (kq == SOLID || cu[U_RID * n + q] != r) { continue; }
      if (kq == GAS) { return q; }
      queue[tail] = v;
      tail += 1u;
    }
  }
  return NONE;
}
/* Wie Gas.release: das ganze Gas der flüssigen Zelle c zur ersten Gaszelle gerade darüber (durch nicht feste Zellen); versperren ein
   Feststoff oder der Deckel der Kiste den Weg, zur nächsten Gaszelle, die im Fenster um c erreichbar ist (nearGas). Ohne Ziel bleibt
   es (gezählt). Nur atomare Beiträge in at und cnt: gasApply bucht sie in der nächsten Dispatch. */
fn release(c: u32) {
  let m = mass(c);
  if (!(m > 0.0)) { return; }
  var t = NONE;
  var q = c;
  for (var k = 0u; k < P.ny; k++) {
    if (cj(q) + 1 >= i32(P.ny)) { break; }
    q += P.nx;
    let kq = cu[U_KIND * P.n + q];
    if (kq == SOLID) { break; }
    if (kq == GAS) { t = q; break; }
  }
  if (t == NONE) { t = nearGas(c); }
  if (t == NONE) { atomicAdd(&cnt[C_REL_MISS], 1u); return; }
  moveGas(c, t, 1.0);
  addF_cnt(C_REL_MASS, m);
  atomicAdd(&cnt[C_REL_N], 1u);
}
${MAIN} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let was = cu[U_KPREV * n + c];
  let now = cu[U_KIND * n + c];
  if (now == LIQUID && was == LIQUID) { release(c); return; }
  if (was == now || now == SOLID || was == SOLID) { return; }
  var wsum = 0.0;
  for (var k = 0u; k < 4u; k++) { let nb = nbOf(c, k); if (stableGas(nb)) { wsum += vol(nb); } }
  if (wsum <= 0.0) { if (now == LIQUID) { release(c); } return; }
  if (now == LIQUID) {
    for (var k = 0u; k < 4u; k++) { let nb = nbOf(c, k); if (stableGas(nb)) { moveGas(c, nb, vol(nb) / wsum); } }
    return;
  }
  let have = mass(c);
  var want = 0.0;
  for (var k = 0u; k < 4u; k++) { let nb = nbOf(c, k); if (stableGas(nb)) { want += vol(nb) / wsum * cf[F_RHO * n + nb]; } }
  want *= max(1e-3, 1.0 - cf[F_FS * n + c] - cf[F_PHI * n + c] - cf[F_ALPHA * n + c]) * P.vcell;
  if (want <= have) { return; }
  for (var k = 0u; k < 4u; k++) {
    let nb = nbOf(c, k);
    if (!stableGas(nb)) { continue; }
    let mnb = mass(nb);
    if (mnb <= 0.0) { continue; }
    moveGas(nb, c, min(0.25, (want - have) * (vol(nb) / wsum) / mnb));
  }
}`
  },
  /* -- Gebiete: Volumina, Massen, Druck p0 ----------------------------------------------------------- */
  {
    name: 'regCells', wg: WG,
    bind: 'P:u cf:r cu:r racc:a',
    code: `${REGSUM}
${MAIN} {
  let c = gid.x;
  let lid = lid3.x;
  var r = NONE;
  var v = vec4<f32>(0.0);
  if (c < P.n) {
    r = cu[U_RID * P.n + c];
    if (r != NONE) {
      let n = P.n;
      let mN = cf[F_MN * n + c]; let mO = cf[F_MO * n + c]; let mV = cf[F_MV * n + c];
      let nc = mN / M_N2 + mO / M_O2 + mV / M_H2O;
      let a = nc * R_GAS * cf[F_T * n + c];
      v = vec4<f32>(nc, mN + mO + mV, a, a * yOf(c));
    }
  }
  regSum(lid, r, v, vec4<u32>(RA_NSUM, RA_MSUM, RA_A, RA_B));
}`
  },
  {
    name: 'regParts', wg: 128,
    bind: 'P:u cnt:a cu:r parts:r racc:a',
    code: `${REGSUM}
${MAIN} {
  let lid = lid3.x;
  let count = cntWG(lid, C_PSORT);
  let p = gid.x;
  var r = NONE;
  var v = vec4<f32>(0.0);
  if (p < count) {
    let m = parts[p].mass;
    if ((parts[p].flags & 1u) == 0u && m > 0.0) {
      r = cu[U_RID * P.n + cellAt(parts[p].x, parts[p].y)];
      v = vec4<f32>(m / parts[p].rho, 0.0, 0.0, 0.0);
    }
  }
  regSum(lid, r, v, vec4<u32>(RA_VLIQ, RA_VLIQ, RA_VLIQ, RA_VLIQ));
}`
  },
  {
    name: 'regBubs', wg: WG,
    bind: 'P:u cnt:a cu:r bubs:r racc:a',
    code: `${MAIN} {
  let count = cntWG(lid3.x, C_BCOUNT);
  let b = gid.x;
  if (b >= count) { return; }
  let q = bubs[b];
  if (q.alive == 0u) { return; }
  let c = cellAtN(q.x, q.y);
  if (c == NONE) { return; }
  let r = cu[U_RID * P.n + c];
  if (r != NONE) { addF_racc(r * RACC_STRIDE + RA_VBUB, q.V); }
}`
  },
  /* Mit freien Körpern (P.bodies) ist das Fluidvolumen eines Gebiets Σ (1 − fs) V aus bRegVol (in RA_VSUM); ändert ein Körper es in einem
     verschlossenen Gebiet, ist der Sprung von −p0 V_Fluid seine Arbeit (C_BODYWORK, am Anfang des Schritts wie bodies.prepare). */
  ...([['regFinishStart', true], ['regFinish', false]] as const).map(([name, start]): KernelDef => ({
    name, wg: 64,
    bind: 'P:u reg:w racc:a cnt:a',
    code: `${STATE_P}
${MAIN} {
  for (var r = lid3.x; r < P.nreg; r += 64u) {
    let o = r * REG_STRIDE;
    let a = r * RACC_STRIDE;
    let vfOld = reg[o + R_VFLUID];
    let p0Old = reg[o + R_P0];
    var vf = vfOld;
    if (P.bodies != 0u) { vf = max(1e-12, getF_racc(a + RA_VSUM)); reg[o + R_VFLUID] = vf; }
    let vl = getF_racc(a + RA_VLIQ);
    let vb = getF_racc(a + RA_VBUB);
    let vg = max(1e-3 * vf, vf - vl - vb);
    reg[o + R_VLIQ] = vl;
    reg[o + R_VBUB] = vb;
    reg[o + R_VGAS] = vg;
    reg[o + R_NSUM] = getF_racc(a + RA_NSUM);
    reg[o + R_MSUM] = getF_racc(a + RA_MSUM);
    if (reg[o + R_OPEN] != 0.0) {
      reg[o + R_P0] = P.pamb;
      reg[o + R_RHOBAR] = P.rhoamb;
    } else {
      let rb = getF_racc(a + RA_MSUM) / vg;
      reg[o + R_RHOBAR] = rb;
      reg[o + R_P0] = statePressure(getF_racc(a + RA_A), getF_racc(a + RA_B), vg, rb);
    }
    ${start ? 'reg[o + R_P0START] = reg[o + R_P0]; reg[o + R_DP0] = 0.0;' : ''}
    ${start ? 'if (P.bodies != 0u && reg[o + R_OPEN] == 0.0 && r < P.nreg) { addF_cnt(C_BODYWORK, p0Old * vfOld - reg[o + R_P0] * vf); }' : ''}
    for (var k = 0u; k < RACC_STRIDE; k++) { atomicStore(&racc[a + k], 0u); }
  }
}`
  })),
  /* -- Kompressionswärme verschlossener Gebiete (wie Gas.compressionHeating, zwei Durchgänge) --------- */
  {
    name: 'compSums', wg: WG,
    bind: 'P:u cf:r cu:r reg:r racc:a',
    code: `${REGSUM}
${MAIN} {
  let c = gid.x;
  let lid = lid3.x;
  var r = NONE;
  var v = vec4<f32>(0.0);
  if (c < P.n) {
    r = cu[U_RID * P.n + c];
    if (r != NONE && reg[r * REG_STRIDE + R_OPEN] == 0.0) {
      let n = P.n;
      let nc = cf[F_NMOL * n + c];
      let a = nc * R_GAS * cf[F_T * n + c];
      let cap = cf[F_CAP * n + c];
      var acomp = 0.0;
      if (cap > 0.0) { acomp = nc * (a / pAt(c)) / cap; }
      v = vec4<f32>(acomp, a, a * yOf(c), 0.0);
    } else { r = NONE; }
  }
  regSum(lid, r, v, vec4<u32>(RA_ACOMP, RA_A, RA_B, RA_VSUM));
}`
  },
  ...([['compStep0', 0], ['compStep1', 1], ['compStepEnd', 2]] as const).map(([name, iter]): KernelDef => ({
    name, wg: 64,
    bind: 'P:u reg:w racc:a',
    code: `${STATE_P}
${MAIN} {
  for (var r = lid3.x; r < P.nreg; r += 64u) {
    let o = r * REG_STRIDE;
    let a = r * RACC_STRIDE;
    if (reg[o + R_OPEN] == 0.0 && reg[o + R_VGAS] > 0.0) {
      let V = reg[o + R_VGAS];
      let pState = statePressure(getF_racc(a + RA_A), getF_racc(a + RA_B), V, reg[o + R_RHOBAR]);
      reg[o + R_P0] = pState;
      ${iter === 0 ? `let aa = R_GAS / V * getF_racc(a + RA_ACOMP);
      reg[o + R_KCOMP] = 1.0 / max(0.05, 1.0 - aa);
      reg[o + R_TOTAL] = 0.0;` : ''}
      ${iter < 2 ? `var d = (pState - (reg[o + R_P0START] + reg[o + R_TOTAL])) * reg[o + R_KCOMP];
      if (abs(d) <= 1e-7 * pState) { d = 0.0; }
      reg[o + R_DP0] = d;
      reg[o + R_TOTAL] += d;` : `reg[o + R_DP0] = reg[o + R_TOTAL];`}
    }
    for (var k = 0u; k < RACC_STRIDE; k++) { atomicStore(&racc[a + k], 0u); }
  }
}`
  })),
  {
    /* Jede Gaszelle eines verschlossenen Gebiets bekommt V_c Δp0. */
    name: 'compApply', wg: WG,
    bind: 'P:u cf:w cu:r reg:r',
    code: `${DERIVE}
${MAIN} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let r = cu[U_RID * n + c];
  if (r == NONE || cu[U_KIND * n + c] == SOLID) { return; }
  let o = r * REG_STRIDE;
  if (reg[o + R_OPEN] != 0.0) { return; }
  let d = reg[o + R_DP0];
  if (d == 0.0 || !(cf[F_CAP * n + c] > 0.0)) { return; }
  let vc = cf[F_NMOL * n + c] * R_GAS * cf[F_T * n + c] / pAt(c);
  cf[F_HG * n + c] += vc * d;
  deriveCell(c);
}`
  },
  /* -- Volumina nach der Flüssigkeit, Gasflächen ---------------------------------------------------- */
  {
    name: 'gasVolumes', wg: WG,
    bind: 'P:u cf:w cu:r reg:r',
    code: `${MAIN} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let k = cu[U_KIND * n + c];
  if (k == SOLID) { cf[F_VGAS * n + c] = 0.0; cf[F_RHO * n + c] = 0.0; cf[F_VEOS * n + c] = 0.0; return; }
  let m = cf[F_MN * n + c] + cf[F_MO * n + c] + cf[F_MV * n + c];
  if (k == LIQUID && m + cf[F_MF * n + c] <= 0.0) { cf[F_VGAS * n + c] = 0.0; cf[F_VEOS * n + c] = 0.0; return; }
  let vg = max(1e-3, 1.0 - cf[F_FS * n + c] - cf[F_PHI * n + c] - cf[F_ALPHA * n + c]) * P.vcell;
  cf[F_VGAS * n + c] = vg;
  cf[F_RHO * n + c] = m / vg;
  cf[F_VEOS * n + c] = cf[F_NMOL * n + c] * R_GAS * cf[F_T * n + c] / pAt(c);
}`
  },
  {
    name: 'markFaces', wg: WG,
    bind: 'P:u cu:r ff:w fu:w',
    code: `${MAIN} {
  let f = gid.x;
  if (f >= P.nf) { return; }
  let nx = i32(P.nx);
  let ny = i32(P.ny);
  let ok = U_KIND * P.n;
  var ka = NONE;
  var kb = NONE;
  var gas = false;
  var wall = false;
  if (f < P.nu) {
    let i = i32(f % (P.nx + 1u));
    let j = i32(f / (P.nx + 1u));
    if (i > 0) { ka = cu[ok + cellOf(i - 1, j)]; }
    if (i < nx) { kb = cu[ok + cellOf(i, j)]; }
    gas = (ka == GAS && kb == GAS) || (i == 0 && P.openL != 0u && kb == GAS) || (i == nx && P.openR != 0u && ka == GAS);
    wall = (i == 0 && P.openL == 0u) || (i == nx && P.openR == 0u);
  } else {
    let g = f - P.nu;
    let i = i32(g % P.nx);
    let j = i32(g / P.nx);
    if (j > 0) { ka = cu[ok + cellOf(i, j - 1)]; }
    if (j < ny) { kb = cu[ok + cellOf(i, j)]; }
    gas = (ka == GAS && kb == GAS) || (j == 0 && P.openB != 0u && kb == GAS) || (j == ny && P.openT != 0u && ka == GAS);
    wall = (j == 0 && P.openB == 0u) || (j == ny && P.openT == 0u);
  }
  fu[fui(FU_GAS, f)] = select(0u, 1u, gas);
  if (!gas) {
    var u = 0.0;
    if ((ka == LIQUID || kb == LIQUID) && !(ka == SOLID || kb == SOLID || wall)) { u = ff[ffi(FF_UL, f)]; }
    ff[ffi(FF_UG, f)] = u;
  }
}`
  }
];
