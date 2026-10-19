/**
 * PARTIKEL-LABOR — DIE MOMENTAUFNAHME FÜRS ZEICHNEN: je lebende Partikel ihr
 * Ort (zwischen den letzten beiden Teilschritten gemittelt, `alpha`), ihre
 * Grösse und ihre Farbe nach Stoff und Phase. Schreibt in vorhandene Puffer
 * (keine Allokation) und gibt die Zahl zurück.
 */

import { SPECIES_COUNT, phaseColor, spIndex } from '../engine/species';
import type { Store } from '../engine/store';
import { GAS, LIQUID, type PhaseId } from '../engine/units';

/** RGBA je Stoff × Phase (Stoff·3 + Phase). Luft (N₂, O₂) fast durchsichtig, Dampf halb, Flüssigkeiten fast deckend. */
export const PALETTE: Uint8Array = (() => {
  const out = new Uint8Array(SPECIES_COUNT * 3 * 4);
  const air = new Set([spIndex('N2'), spIndex('O2')]);
  for (let sp = 0; sp < SPECIES_COUNT; sp += 1) {
    for (let ph = 0; ph < 3; ph += 1) {
      const hex = phaseColor(sp, ph as PhaseId).replace('#', '');
      const o = (sp * 3 + ph) * 4;
      out[o] = parseInt(hex.slice(0, 2), 16);
      out[o + 1] = parseInt(hex.slice(2, 4), 16);
      out[o + 2] = parseInt(hex.slice(4, 6), 16);
      out[o + 3] = ph === GAS ? (air.has(sp) ? 46 : 150) : ph === LIQUID ? 232 : 255;
    }
  }
  return out;
})();

const AIR_N2 = spIndex('N2');
const AIR_O2 = spIndex('O2');

/** Gezeichneter Radius in Vielfachen der Gitterweite: fest, flüssig, gasförmig. */
const RADIUS = [0.72, 0.64, 0.5];

export function snapshot(st: Store, s: number, alpha: number, showAir: boolean, pos: Float32Array, size: Float32Array, col: Uint8Array): number {
  let n = 0;
  const top = st.highWater;
  const max = Math.min(size.length, Math.floor(pos.length / 2), Math.floor(col.length / 4));
  for (let i = 0; i < top && n < max; i += 1) {
    if (st.alive[i] === 0) continue;
    const sp = st.dominant(i);
    if (sp < 0) continue;
    const ph = st.phase[i];
    if (!showAir && ph === GAS && (sp === AIR_N2 || sp === AIR_O2)) continue;
    pos[2 * n] = st.ox[i] + (st.x[i] - st.ox[i]) * alpha;
    pos[2 * n + 1] = st.oy[i] + (st.y[i] - st.oy[i]) * alpha;
    size[n] = RADIUS[ph] * s;
    const o = (sp * 3 + ph) * 4;
    col[4 * n] = PALETTE[o];
    col[4 * n + 1] = PALETTE[o + 1];
    col[4 * n + 2] = PALETTE[o + 2];
    col[4 * n + 3] = PALETTE[o + 3];
    n += 1;
  }
  return n;
}

