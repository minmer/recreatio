/**
 * LABOR 2D (v2) — BAUSTEINE DES ZEICHNERS (WGSL), die render.ts und
 * renderBodies.ts teilen: die Farbskala, das Uniform der Rechenkerne und die
 * Farben der Werkstoffe und der Salzkruste (wie render/layers.ts).
 */

import { SOLIDS } from '../engine/materials';
import { SOLUTES } from '../engine/solution';
import { hex, VIRIDIS } from '../render/palette';
import { f } from './lib';

export const VIRIDIS_WGSL = `
const VIR = array<vec3<f32>, ${VIRIDIS.length}>(${VIRIDIS.map((c) => `vec3<f32>(${f(c[0] / 255)}, ${f(c[1] / 255)}, ${f(c[2] / 255)})`).join(', ')});
fn viridis(t: f32) -> vec3<f32> {
  let x = clamp(t, 0.0, 1.0) * ${f(VIRIDIS.length - 1)};
  let i = min(u32(floor(x)), ${VIRIDIS.length - 2}u);
  let fr = x - f32(i);
  return mix(VIR[i], VIR[i + 1u], fr);
}
`;

/** Uniform der Rechenkerne des Zeichners. */
export const RO_WGSL = `struct ROpt { overlay: u32, step: u32, nax: u32, nay: u32 }`;

/** Die Farben der Werkstoffe (Nummer + 1 wie U_SOLID) und der Salzkruste. */
export const SOLID_WGSL = `
const SOLID_RGB = array<vec3<f32>, ${SOLIDS.length}>(${SOLIDS.map((s) => { const c = hex(s.color); return `vec3<f32>(${f(c[0] / 255)}, ${f(c[1] / 255)}, ${f(c[2] / 255)})`; }).join(', ')});
const CRYSTAL_RGB = vec3<f32>(${hex(SOLUTES[0]?.color ?? '#f4f3ee').map((x) => f(x / 255)).join(', ')});
`;
