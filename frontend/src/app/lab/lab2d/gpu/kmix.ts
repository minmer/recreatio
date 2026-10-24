/**
 * LABOR 2D (v2) — MEHRERE FLÜSSIGKEITEN AUF DER GPU (M2a, wie engine/liquidMix.ts): die Zähigkeit als implizite
 * Schritte je Fläche (Jacobi: das System ist stark diagonal dominant, ρ_ref Δx²/Δt ≫ η), danach die Kräfte, und die
 * Drift unaufgelöster Tröpfchen (die vorherrschende Flüssigkeit der Zelle aus ihren eigenen Teilchen). Alles läuft nur,
 * wenn eine andere Flüssigkeit als Wasser in der Szene ist (P.mixed).
 */

import type { KernelDef } from './kernel';

const WG = 128;
const MAIN = '@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)';

export const DROP_DRIFT = `
/* Endgeschwindigkeit eines Tropfens der Flüssigkeit md in der Flüssigkeit hc (Schiller–Naumann mit Hadamard–Rybczynski, wie DropletDrift). */
fn dropDrift(q: Particle, dt: f32) -> f32 {
  let c = cellAt(q.x, q.y);
  let hc = min(u32(cf[F_DHOST * P.n + c]), NLIQ - 1u);
  let md = matOf(q.flags);
  if (md == hc || !(P.gy > 0.0)) { return 0.0; }
  let T = q.T;
  var rc = rhoLM(hc, T);
  /* In Sole: die Dichte des Wassers der Zelle (Masse durch Volumen seiner Teilchen; 0 in einer Zelle ohne Salz). */
  if (hc == 0u && cf[F_RHOW * P.n + c] > 0.0) { rc = cf[F_RHOW * P.n + c]; }
  let rd = q.rho;
  let muc = muLM(hc, T);
  let mud = muLM(md, T);
  let V = q.mass / rd;
  let d = pow(6.0 * V / PI, 1.0 / 3.0);
  let dr = abs(rc - rd);
  if (!(dr > 0.0)) { return 0.0; }
  let K = (2.0 * muc + 3.0 * mud) / (3.0 * muc + 3.0 * mud);
  var U = dr * P.gy * d * d / (18.0 * muc * K);
  for (var it = 0; it < 8; it++) {
    let Re = max(1e-9, rc * U * d / muc);
    let CD = 24.0 / Re * K * (1.0 + 0.15 * pow(Re, 0.687));
    U = sqrt(4.0 * dr * P.gy * d / (3.0 * rc * CD));
  }
  return select(-1.0, 1.0, rd < rc) * min(0.25 * P.dx, U * dt);
}
`;

export const MIX_KERNELS: readonly KernelDef[] = [
  ...(['viscJacA', 'viscJacB'] as const).map((name): KernelDef => {
    const [src, dst] = name === 'viscJacA' ? ['FF_UL', 'FF_VT'] : ['FF_VT', 'FF_UL'];
    return {
      /*
       * Zähigkeit (M2a, wie liquidMix.solveViscosity), ein Jacobi-Schritt je Aufruf: ρ_ref Δx²/Δt (u* − u0) = Σ η_f (u_nb − u*);
       * η_f das harmonische Mittel der Flächen, an Wänden und Feststoffen haftet die Flüssigkeit (quer zur Wand im halben
       * Abstand: 2η), zu leeren Flächen und an der freien Oberfläche keine Spannung. Stark diagonal dominant (ρ Δx²/Δt ≫ η):
       * eine feste Zahl Schritte genügt.
       */
      name, wg: WG,
      bind: 'P:u glob:r ff:w fu:r',
      code: `fn hm(a: f32, b: f32) -> f32 { return select(0.0, 2.0 * a * b / (a + b), a + b > 0.0); }
${MAIN} {
  let f = gid.x;
  if (f >= P.nf) { return; }
  if (fu[fui(FU_KNOWN, f)] != 1u) { ff[ffi(${dst}, f)] = ff[ffi(${src}, f)]; return; }
  let nx = i32(P.nx);
  let ny = i32(P.ny);
  let dH = glob[G_RHOREF] * P.dx * P.dx / glob[G_DT];
  let e = ff[ffi(FF_ETA, f)];
  var diag = dH;
  var rhs = dH * ff[ffi(FF_U0, f)];
  let isU = f < P.nu;
  var i: i32;
  var j: i32;
  if (isU) { i = i32(f % (P.nx + 1u)); j = i32(f / (P.nx + 1u)); } else { let g = f - P.nu; i = i32(g % P.nx); j = i32(g / P.nx); }
  /* Nachbarn längs (a: dieselbe Komponente in ihrer Richtung) und quer (b). */
  for (var k = 0; k < 4; k++) {
    var ni = i;
    var nj = j;
    if (k == 0) { ni = i - 1; } else if (k == 1) { ni = i + 1; } else if (k == 2) { nj = j - 1; } else { nj = j + 1; }
    let along = (isU && k < 2) || (!isU && k >= 2);
    var inside: bool;
    var g: u32;
    if (isU) { inside = ni >= 0 && ni <= nx && nj >= 0 && nj < ny; } else { inside = ni >= 0 && ni < nx && nj >= 0 && nj <= ny; }
    if (!inside) {
      /* Kistenrand quer zur Komponente: an einer Wand haftet sie (2η); längs gibt es keinen Rand (die Randflächen selbst sind bekannt). */
      var open = false;
      if (k == 0) { open = P.openL != 0u; } else if (k == 1) { open = P.openR != 0u; } else if (k == 2) { open = P.openB != 0u; } else { open = P.openT != 0u; }
      if (!along && !open) { diag += 2.0 * e; }
      continue;
    }
    if (isU) { g = uF(ni, nj); } else { g = vF(ni, nj); }
    let kn = fu[fui(FU_KNOWN, g)];
    if (kn == 1u) { let a = hm(e, ff[ffi(FF_ETA, g)]); diag += a; rhs += a * ff[ffi(${src}, g)]; }
    else if (kn == 2u) { diag += select(2.0 * e, e, along); }
  }
  ff[ffi(${dst}, f)] = rhs / diag;
}`
    };
  }),
  {
    /* Nach dem zähen Schritt die Kräfte (Schwerkraft mit der Dichte jeder Flüssigkeit, die Gegenkräfte der Blasen). */
    name: 'viscForce', wg: WG,
    bind: 'P:u ff:w fu:r',
    code: `${MAIN} {
  let f = gid.x;
  if (f >= P.nf || fu[fui(FU_KNOWN, f)] == 2u) { return; }
  ff[ffi(FF_UL, f)] += ff[ffi(FF_VF, f)];
}`
  },
  {
    /* Die Flüssigkeit mit der meisten Masse unter den Teilchen der Zelle selbst (sortiert) — für die Drift der Tröpfchen (wie DropletDrift). */
    name: 'cellHost', wg: WG,
    bind: 'P:u cf:w parts:r ccount:r cstart:r bsum:r',
    code: `${MAIN} {
  let c = gid.x;
  if (c >= P.n) { return; }
  var mm: array<f32, NLIQ>;
  var mw = 0.0;
  var vw = 0.0;
  var salty = false;
  let st = cellStart(c);
  let cn = ccount[c];
  for (var k = 0u; k < cn; k++) {
    let q = parts[st + k];
    if ((q.flags & 1u) != 0u || !(q.mass > 0.0)) { continue; }
    mm[min(matOf(q.flags), NLIQ - 1u)] += q.mass;
    if (matOf(q.flags) == 0u) { mw += q.mass; vw += q.mass / q.rho; if (q.s > 0.0) { salty = true; } }
  }
  var host = 0u;
  for (var l = 1u; l < NLIQ; l++) { if (mm[l] > mm[host]) { host = l; } }
  cf[F_DHOST * P.n + c] = f32(host);
  cf[F_RHOW * P.n + c] = select(0.0, mw / vw, salty && vw > 0.0);
}`
  }
];
