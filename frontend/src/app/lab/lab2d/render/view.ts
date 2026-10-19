/**
 * LABOR 2D (v2) — WAS MAN SIEHT: die Kiste (mit etwas Rand) passend in die
 * Leinwand, ohne Verzerrung. Arbeiter und Seite rechnen es gleich — die Seite
 * braucht es, um Zeiger in Meter umzurechnen.
 */

export interface View { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }

export function fitView(boxW: number, boxH: number, width: number, height: number, pad: number): View {
  const x0 = -pad;
  const y0 = -pad;
  const w = boxW + 2 * pad;
  const h = boxH + 2 * pad;
  const aspect = Math.max(1e-6, width) / Math.max(1e-6, height);
  if (w / h > aspect) {
    const hh = w / aspect;
    return { x0, y0: y0 - (hh - h) / 2, x1: x0 + w, y1: y0 - (hh - h) / 2 + hh };
  }
  const ww = h * aspect;
  return { x0: x0 - (ww - w) / 2, y0, x1: x0 - (ww - w) / 2 + ww, y1: y0 + h };
}

/** Ein Punkt der Leinwand (CSS-Pixel, y nach unten) in Metern. */
export function toWorld(view: View, px: number, py: number, width: number, height: number): [number, number] {
  return [view.x0 + (px / Math.max(1, width)) * (view.x1 - view.x0), view.y1 - (py / Math.max(1, height)) * (view.y1 - view.y0)];
}

/** Meter in CSS-Pixel (für Pfeile und Vorschauen über der Leinwand). */
export function toScreen(view: View, x: number, y: number, width: number, height: number): [number, number] {
  return [((x - view.x0) / (view.x1 - view.x0)) * width, ((view.y1 - y) / (view.y1 - view.y0)) * height];
}
