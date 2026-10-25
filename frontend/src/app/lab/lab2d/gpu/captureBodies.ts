/**
 * LABOR 2D (v2) — DIE KÖRPER IN DER AUFNAHME AUF DER GPU (B, Backen mit der
 * Grafikkarte; seit 2026-10-25). Der beschleunigte Weg rechnet nur angeheftete
 * Körper (freie, Eis und Körner backt die CPU, needsCpu): sie liegen das ganze
 * Backen über still. Darum steht hier, einmal aus der CPU-Engine am Anfang,
 * alles Feste, was die Kerne der Aufnahme (captureKernels.ts) von ihnen
 * brauchen:
 *
 * - die Treppenzellen (GpuState): dort schreibt bkCells die Art ohne Werkstoff
 *   und ohne Glühen — die Körper zeichnen ihre Vierecke (wie sampleLayers, wo
 *   die CPU die Zellen eines Körpers auslässt);
 * - die Texel, deren Mitte in einem Körper liegt (die Fortsetzung der
 *   Flüssigkeit darunter, render/layers.ts extendUnderBodies);
 * - die Lage der Vierecke und Rechtecke (aus dem ersten Bild, sampleLayers) und
 *   je Viereck seine Treppenzellen mit den Gewichten der Bedeckung (b.wk, wc,
 *   ww): T_k(0), Kruste_k(0) und T_c(0), Kruste_c(0) als Bezug (an jedem
 *   Schlüsselbild neu, wie collect dort weiterrechnet) — bkQuads rechnet daraus
 *   Temperatur, Glühen und Kruste jedes Bildes (der lineare Teil von
 *   coverCollect.ts; ein Mittel nach der Fläche traf nur 275 von 353
 *   Vierecken, um bis zu 4 K daneben).
 *
 * Bewegen sich Körper einmal auf der GPU (C4), ersetzt ein Kern je Schritt die
 * feste Lage und die festen Masken — die Schnittstelle (BodyStatics, fillQuads)
 * bleibt.
 */

import { Body2D } from '../engine/body';
import type { Engine } from '../engine/engine';
import { QUAD, RECT, type Layers } from '../render/layers';
import type { Stair } from './staircase';

export interface BodyStatics {
  /** Je Zelle 1: Treppenzelle eines Körpers (auf der GPU fest). */
  readonly cellMask: Uint32Array;
  /** Je Texel (2nx × 2ny) 1: seine Mitte liegt in einem Körper. */
  readonly texMask: Uint32Array;
  readonly texInBody: number;
  readonly nq: number;
  readonly nr: number;
  /** Die Vierecke (QUAD Werte je Viereck; 6 und 7 schreibt jedes Bild neu) und die Rechtecke, wie sampleLayers sie schreibt. */
  readonly quadGeo: Uint16Array;
  readonly rects: Uint16Array;
  /** Je Viereck der Anfang seiner Einträge in qc/qw/qx (nq + 1 Werte). */
  readonly qs: Uint32Array;
  /** Je Eintrag: Gitterzelle, Gewicht w (Anteil an ihrer Wärmekapazität), w/Σw der Zelle (Zuwachs an Kruste). */
  readonly qc: Uint32Array;
  readonly qw: Float32Array;
  readonly qx: Float32Array;
  /** Je Viereck T_k(0), Kruste_k(0), seine kleinere Seite (m); T_c(0) aller Zellen, dann Kruste_c(0) aller Zellen. */
  readonly q0: Float32Array;
  readonly c0: Float32Array;
  /** Je Viereck sein Körper (Index in e.bodies.list) und seine innere Zelle — für den neuen Bezug an jedem Schlüsselbild (rebaseQuads). */
  readonly quadBody: Int32Array;
  readonly quadCell: Int32Array;
}

const nonEmpty = <T extends Float32Array | Uint32Array>(a: T, make: (n: number) => T, n = 1): T => (a.length > 0 ? a : make(n));

/** Das Feste der Körper zu Beginn des Backens; L0: das erste Bild (sampleLayers der CPU-Engine), stair: die Treppe beim Hochladen. */
export function bodyStatics(e: Engine, stair: Stair, L0: Layers): BodyStatics {
  const g = e.grid;
  const n = g.n;
  const cellMask = new Uint32Array(n);
  for (let c = 0; c < n; c += 1) cellMask[c] = stair.body[c];
  /* Texel, deren Mitte in einem Körper liegt (wie extendUnderBodies). */
  const lx = 2 * g.nx;
  const ly = 2 * g.ny;
  const h = g.dx / 2;
  const texMask = new Uint32Array(lx * ly);
  const local = new Float64Array(2);
  const wbox = new Float64Array(4);
  let texInBody = 0;
  for (const b of e.bodies.list) {
    if (b.gone) continue;
    b.worldBox(b.x, b.y, b.a, wbox);
    const i0 = Math.max(0, Math.floor(wbox[0] / h));
    const i1 = Math.min(lx - 1, Math.floor(wbox[2] / h));
    const j0 = Math.max(0, Math.floor(wbox[1] / h));
    const j1 = Math.min(ly - 1, Math.floor(wbox[3] / h));
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        Body2D.toLocal(b.x, b.y, b.a, (i + 0.5) * h, (j + 0.5) * h, local);
        if (b.insideLocal(local[0], local[1], 0) && texMask[i + j * lx] === 0) { texMask[i + j * lx] = 1; texInBody += 1; }
      }
    }
  }
  /* Die Vierecke in der Reihenfolge von sampleBodies, je Viereck die Einträge seiner Bedeckung. */
  const nq = L0.nq;
  const nr = L0.nr;
  const quadGeo = L0.quads.slice(0, QUAD * nq);
  const rects = L0.rects.slice(0, RECT * nr);
  const qs: number[] = [0];
  const qc: number[] = [];
  const qw: number[] = [];
  const qx: number[] = [];
  const q0: number[] = [];
  const quadBody: number[] = [];
  const quadCell: number[] = [];
  const wsum = new Float64Array(n);
  for (const b of e.bodies.list) { if (b.gone) continue; for (let i = 0; i < b.nw; i += 1) wsum[b.wc[i]] += b.ww[i]; }
  for (const [bi, b] of e.bodies.list.entries()) {
    if (b.gone) continue;
    const byCell = new Map<number, [number, number][]>();
    for (let i = 0; i < b.nw; i += 1) {
      const k = b.wk[i];
      let l = byCell.get(k);
      if (l === undefined) { l = []; byCell.set(k, l); }
      l.push([b.wc[i], b.ww[i]]);
    }
    for (let k = 0; k < b.nr; k += 1) {
      const xs = b.xs[k];
      const ys = b.ys[k];
      for (let jj = 0; jj < b.nj[k]; jj += 1) {
        for (let ii = 0; ii < b.ni[k]; ii += 1) {
          const cell = b.off[k] + ii + jj * b.ni[k];
          for (const [c, w] of byCell.get(cell) ?? []) { qc.push(c); qw.push(w); qx.push(wsum[c] > 0 ? w / wsum[c] : 0); }
          qs.push(qc.length);
          q0.push(b.cellT(cell), b.crust[cell], Math.max(1e-6, Math.min(xs[ii + 1] - xs[ii], ys[jj + 1] - ys[jj])));
          quadBody.push(bi);
          quadCell.push(cell);
        }
      }
    }
  }
  if (qs.length - 1 !== nq) throw new Error(`capture: ${qs.length - 1} quads from the bodies, ${nq} in the frame`);
  const c0 = new Float32Array(2 * n);
  for (let c = 0; c < n; c += 1) { c0[c] = stair.T[c]; c0[n + c] = g.crust[c]; }
  return {
    cellMask, texMask, texInBody, nq, nr, quadGeo, rects, qs: Uint32Array.from(qs),
    qc: nonEmpty(Uint32Array.from(qc), (k) => new Uint32Array(k)), qw: nonEmpty(Float32Array.from(qw), (k) => new Float32Array(k)),
    qx: nonEmpty(Float32Array.from(qx), (k) => new Float32Array(k)), q0: nonEmpty(Float32Array.from(q0), (k) => new Float32Array(k), 3), c0,
    quadBody: Int32Array.from(quadBody), quadCell: Int32Array.from(quadCell)
  };
}

/**
 * Der neue Bezug der Vierecke an einem Schlüsselbild (nach GpuState.download): T_k und Kruste_k, wie collect sie eben in
 * der CPU-Engine hinterliess. collect rechnet bei jedem Zurückholen von dort weiter, nicht vom Anfang des Backens — mit
 * Film und Kruste ist das nicht ganz linear (Solanka: ein Viereck lag nach zwei Schlüsselbildern eine Stufe daneben).
 * Die Treppenzellen bekommen ihren Bezug auf der GPU (capture.ts rebase).
 */
export function rebaseQuads(e: Engine, st: BodyStatics): void {
  const list = e.bodies.list;
  for (let k = 0; k < st.nq; k += 1) {
    const b = list[st.quadBody[k]];
    const cell = st.quadCell[k];
    st.q0[3 * k] = b.cellT(cell);
    st.q0[3 * k + 1] = b.crust[cell];
  }
}

/** Die Vierecke eines Bildes: die feste Lage, dazu je Viereck Glühen | Kruste << 8 und Temperatur aus dem Wort der GPU. */
export function fillQuads(st: BodyStatics, words: Uint32Array, out: Uint16Array): void {
  for (let k = 0; k < st.nq; k += 1) {
    const o = QUAD * k;
    for (let z = 0; z < 6; z += 1) out[o + z] = st.quadGeo[o + z];
    out[o + 6] = words[k] & 0xffff;
    out[o + 7] = words[k] >>> 16;
  }
}
