/**
 * LABOR 2D (v2) — EIN BILD ALS PUFFER: was der Zeichner braucht, aus dem
 * Zustand der Engine, ohne die Engine selbst (so geht es auch als
 * übertragbares Abbild zur Seite).
 *
 * - Zelltextur (nx × ny, RGBA, scharf gelesen): Feststoffe in ihrer Farbe
 *   (eine Heizplatte glüht mit ihrer Temperatur), in der Mapa stanów die
 *   Zustände; sonst durchsichtig.
 * - Feldtextur (nx × ny, RGBA mit vormultipliziertem Alpha, linear gelesen —
 *   weiche Übergänge): Nebel weiss mit seiner Dichte und die stetigen
 *   Einblendungen (Temperatur, Druck, Geschwindigkeit, Feuchte, Dampf); ihre
 *   Skala steht in scaleLo/scaleHi (für die Legende).
 * - Flüssigkeit (2nx × 2ny, RGBA): R = Bedeckung aus den Teilchen (B-Spline auf
 *   halben Zellen; der Shader zieht bei ½ eine glatte Oberfläche), G = ihre
 *   Temperatur (für die Einblendung), B = Anteil der zweiten Flüssigkeit (Öl),
 *   A = Massenanteil des gelösten Salzes (Einblendung „Stężenie“, M2b).
 * - Salzkruste (M2b): feste Zellen mit Kruste mischen sich zur Farbe des
 *   Kristalls (nach der Dicke der Kruste), Salz am Boden der Kiste färbt die
 *   unterste Zelle seiner Spalte.
 * - Blasen: Mitte, Radius, Anteil Luft — Kreise in wahrer Grösse.
 * - Körper (seit 2026-10-23): gedrehte Vierecke je innere Zelle (Mitte, halbe
 *   Seiten, Winkel, Farbe) und die Umrisse ihrer Rechtecke als Strecken.
 * - Wahlweise die rohen Teilchen (x, y, Temperatur auf der Skala) und in der
 *   Einblendung „Prędkość“ Pfeile der Geschwindigkeit auf einem groben Raster —
 *   erst die des Gases, dann die des Wassers (jedes mit eigenem Massstab).
 * Wasserdampf selbst bleibt unsichtbar; nur Nebel und Flüssigkeit sind weiss
 * bzw. blau (Prompt v2). Ein Schalter zeigt den Dampf als Feld.
 *
 * Seit B (Backen) entsteht das Bild in zwei Schritten: die Ebenen des
 * Zustands (layers.ts, in der Genauigkeit eines Nachweises) und daraus das
 * Bild der Einblendung — live wie bei der Wiedergabe eines Nachweises.
 */

import type { Engine } from '../engine/engine';
import { T0 } from '../engine/units';
import { allocLayers, composeFrame, layersFit, sampleLayers, SALT_FULL, type Layers, type Overlay } from './layers';
import { T_SCALE } from './palette';

export { OVERLAYS, SALT_FULL, VAPOUR_FULL, type Overlay } from './layers';

export interface FrameBuffers {
  nx: number;
  ny: number;
  cells: Uint8Array;
  field: Uint8Array;
  lx: number;
  ly: number;
  liquid: Uint8Array;
  nb: number;
  /** Je Blase: x, y, r, Luftanteil (0–1). */
  bubbles: Float32Array;
  boxW: number;
  boxH: number;
  overlay: Overlay;
  /** Flüssigkeit einfärben: 0 in ihrer Farbe, 1 nach der Temperatur (Kanal G), 2 nach dem Salzgehalt (Kanal A). */
  tintLiquid: number;
  /** Die Skala der Einblendung (in SI: K, Pa, m/s, 1, kg/m³) — Anfang und Ende der Farbskala. */
  scaleLo: number;
  scaleHi: number;
  /** Rohe Teilchen (wenn gezeigt): je Teilchen x, y, Wert auf der Farbskala (0–1: Temperatur, mit „Stężenie soli“ der Salzanteil); np Teilchen. */
  parts: Float32Array;
  np: number;
  /** Pfeile (Einblendung „Prędkość“): je Strecke x0, y0, x1, y1 — erst nag Strecken des Gases, dann nal des Wassers. */
  arrows: Float32Array;
  nag: number;
  nal: number;
  /** Grösste Geschwindigkeit des Wassers an den Pfeilen (m/s; die des Gases steht in scaleHi). */
  vLiq: number;
  /** Körper: je Viereck x, y, halbe Breite, halbe Höhe, Winkel, R, G, B (0–1); nq Vierecke. Umrisse: je Strecke x0, y0, x1, y1; ne Strecken. */
  quads: Float32Array;
  nq: number;
  edges: Float32Array;
  ne: number;
}

export function allocFrame(nx: number, ny: number, bubbles: number, particles = 0): FrameBuffers {
  return {
    nx, ny,
    cells: new Uint8Array(4 * nx * ny),
    field: new Uint8Array(4 * nx * ny),
    lx: 2 * nx,
    ly: 2 * ny,
    liquid: new Uint8Array(4 * 4 * nx * ny),
    nb: 0,
    bubbles: new Float32Array(4 * Math.max(16, bubbles)),
    boxW: 0, boxH: 0,
    overlay: 'none',
    tintLiquid: 0,
    scaleLo: 0,
    scaleHi: 1,
    parts: new Float32Array(3 * particles),
    np: 0,
    /* Höchstens ein Pfeil je 2 × 2 Zellen, drei Strecken (Schaft, zwei Spitzen) zu vier Zahlen. */
    arrows: new Float32Array(12 * Math.ceil(nx / 2) * Math.ceil(ny / 2)),
    nag: 0,
    nal: 0,
    vLiq: 0,
    quads: new Float32Array(8 * 64),
    nq: 0,
    edges: new Float32Array(16 * 16),
    ne: 0
  };
}

/** Die übertragbaren Puffer eines Bildes (Arbeiter ↔ Seite). */
export function frameTransfer(f: FrameBuffers): ArrayBuffer[] {
  return [f.cells.buffer, f.field.buffer, f.liquid.buffer, f.bubbles.buffer, f.parts.buffer, f.arrows.buffer, f.quads.buffer, f.edges.buffer] as ArrayBuffer[];
}

/** Passt der Puffer noch zu dieser Engine (mit den rohen Teilchen, wenn sie gezeigt werden)? */
export function frameFits(f: FrameBuffers, e: Engine, particles = false): boolean {
  return f.nx === e.grid.nx && f.ny === e.grid.ny && f.bubbles.length >= 4 * e.bubbles.count && (!particles || f.parts.length >= 3 * e.particles.count);
}

/** Passt der Puffer zu diesen Ebenen (Wiedergabe)? */
export function frameFitsLayers(f: FrameBuffers, L: Layers): boolean {
  return f.nx === L.nx && f.ny === L.ny && f.bubbles.length >= 4 * L.nb;
}

let live: Layers = allocLayers(0, 0, 1);

/** Das Bild aus der Engine in die Puffer schreiben (live: Ebenen der Einblendung, dann zusammensetzen). */
export function buildFrame(e: Engine, f: FrameBuffers, overlay: Overlay, particles = false): void {
  if (!layersFit(live, e)) live = allocLayers(e.grid.nx, e.grid.ny, e.grid.dx, Math.max(64, Math.ceil(e.bubbles.count * 1.5)));
  sampleLayers(e, live, overlay);
  composeFrame(live, f, overlay);
  /* Rohe Teilchen: Farbe nach der Temperatur, mit der Einblendung „Stężenie soli“ nach dem Salzanteil (dieselbe Skala wie die Legende). */
  f.np = 0;
  const P = e.particles;
  if (particles && f.parts.length >= 3 * P.count) {
    const salty = overlay === 'salt';
    const tmin = T_SCALE[0];
    const tspan = T_SCALE[1] - T_SCALE[0];
    const pp = f.parts;
    for (let q = 0; q < P.count; q += 1) {
      pp[3 * q] = P.x[q];
      pp[3 * q + 1] = P.y[q];
      pp[3 * q + 2] = salty ? Math.min(1, P.saltFraction(q) / SALT_FULL) : Math.min(1, Math.max(0, (P.T[q] - T0 - tmin) / tspan));
    }
    f.np = P.count;
  }
}

/** Das Bild aus gespeicherten Ebenen (Wiedergabe eines Nachweises): ohne rohe Teilchen. */
export function frameFromLayers(L: Layers, f: FrameBuffers, overlay: Overlay): void {
  composeFrame(L, f, overlay);
  f.np = 0;
}
