/**
 * The arithmetic behind the full-screen zoom.
 *
 * Separated from the viewer for the same reason the roster's search is: this
 * is the part that can be wrong without looking wrong. A zoom that drifts a
 * little off the cursor, or a picture that can be dragged just off the screen,
 * reads as "the gallery feels odd" and never as a bug worth reporting.
 */
export type View = { scale: number; x: number; y: number };

export const FIT: View = { scale: 1, x: 0, y: 0 };
export const MAX_SCALE = 5;

/** Keeps a zoomed picture from being dragged off the screen entirely. */
export function clampView(view: View, frame: { width: number; height: number }): View {
  if (view.scale <= 1) return FIT;

  const limitX = ((view.scale - 1) * frame.width) / 2;
  const limitY = ((view.scale - 1) * frame.height) / 2;

  return {
    scale: view.scale,
    x: Math.min(limitX, Math.max(-limitX, view.x)),
    y: Math.min(limitY, Math.max(-limitY, view.y))
  };
}

/** Zooming about a point: what is under the fingers stays under the fingers. */
export function zoomAbout(view: View, scale: number, point: { x: number; y: number }): View {
  const next = Math.min(MAX_SCALE, Math.max(1, scale));
  if (next <= 1) return FIT;

  const ratio = next / view.scale;
  return { scale: next, x: point.x - (point.x - view.x) * ratio, y: point.y - (point.y - view.y) * ratio };
}

