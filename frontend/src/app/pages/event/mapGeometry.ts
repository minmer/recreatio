/**
 * Die Rechnung hinter der Karte (Web-Mercator, Kacheln zu 256 px): projizieren, Grenzen, Mitte, passender Zoom.
 */

import type { MapTrack } from './gpx';

export const TILE_SIZE = 256;

const MIN_ZOOM = 2;

export const MAX_ZOOM = 18;

export type MapPoint = {
  label: string;
  lat: number;
  lon: number;
  detail: string | null;
  isStop: boolean;
};

type PixelPoint = { x: number; y: number };

export type LatLon = { lat: number; lon: number };

export type Size = { width: number; height: number };

export type View = { zoom: number; center: LatLon };

/** Geographic degrees → absolute pixel coordinates at `zoom` (may be fractional). */
export function project(lat: number, lon: number, zoom: number): PixelPoint {
  const scale = TILE_SIZE * Math.pow(2, zoom);
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const sinLat = Math.sin((clampedLat * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale
  };
}

export function unproject(point: PixelPoint, zoom: number): LatLon {
  const scale = TILE_SIZE * Math.pow(2, zoom);
  const n = Math.PI - 2 * Math.PI * (point.y / scale);
  return {
    lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))),
    lon: (point.x / scale) * 360 - 180
  };
}

export function clampNumber(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Below this the world would be smaller than the box, leaving bare corners. */
export function minZoomFor(size: Size): number {
  const longest = Math.max(size.width, size.height);
  if (longest <= 0) return MIN_ZOOM;
  return Math.max(MIN_ZOOM, Math.log2(longest / TILE_SIZE));
}

/**
 * Keeps the view inside the world vertically. Longitude is free because the
 * tile grid wraps, but latitude has ends.
 */
export function clampCenter(center: LatLon, zoom: number, size: Size): LatLon {
  const worldPx = TILE_SIZE * Math.pow(2, zoom);
  const projected = project(center.lat, center.lon, zoom);
  const half = size.height / 2;
  const y = worldPx <= size.height ? worldPx / 2 : clampNumber(projected.y, half, worldPx - half);
  return y === projected.y ? center : unproject({ x: projected.x, y }, zoom);
}

/** Top-left of the viewport in world pixels at the view's own zoom. */
export function originOf(view: View, size: Size): PixelPoint {
  const centerPx = project(view.center.lat, view.center.lon, view.zoom);
  return { x: centerPx.x - size.width / 2, y: centerPx.y - size.height / 2 };
}

/** What geography sits at a point inside the box. */
export function anchorAt(view: View, localX: number, localY: number, size: Size): LatLon {
  const origin = originOf(view, size);
  return unproject({ x: origin.x + localX, y: origin.y + localY }, view.zoom);
}

/** The centre that puts `anchor` back at (localX, localY) at a given zoom. */
export function centerForAnchor(anchor: LatLon, localX: number, localY: number, zoom: number, size: Size): LatLon {
  const anchorPx = project(anchor.lat, anchor.lon, zoom);
  return unproject(
    { x: anchorPx.x - localX + size.width / 2, y: anchorPx.y - localY + size.height / 2 },
    zoom
  );
}

export function boundsOf(points: MapPoint[], tracks: MapTrack[]) {
  const all = tracks.flatMap((entry) => entry.points);
  const lats = [...points.map((p) => p.lat), ...all.map(([lat]) => lat)];
  const lons = [...points.map((p) => p.lon), ...all.map(([, lon]) => lon)];
  if (lats.length === 0) return null;
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons)
  };
}

export function centreOf(points: MapPoint[], tracks: MapTrack[]): LatLon {
  const bounds = boundsOf(points, tracks);
  if (!bounds) return { lat: 50.0619, lon: 19.9369 };
  return { lat: (bounds.minLat + bounds.maxLat) / 2, lon: (bounds.minLon + bounds.maxLon) / 2 };
}

/** Zoom at which everything fits, to a fraction rather than a whole level. */
export function fitZoom(points: MapPoint[], tracks: MapTrack[], size: Size, fallback: number): number {
  const bounds = boundsOf(points, tracks);
  const floor = minZoomFor(size);
  if (!bounds || size.width <= 0 || size.height <= 0) return Math.max(floor, fallback);
  if (bounds.minLat === bounds.maxLat && bounds.minLon === bounds.maxLon) {
    return Math.max(floor, fallback);
  }

  // Measure the span once at a reference zoom, then solve for the zoom whose
  // scaling makes it fit — exact, and no loop over levels.
  const reference = 10;
  const topLeft = project(bounds.maxLat, bounds.minLon, reference);
  const bottomRight = project(bounds.minLat, bounds.maxLon, reference);
  const spanX = Math.max(1, bottomRight.x - topLeft.x);
  const spanY = Math.max(1, bottomRight.y - topLeft.y);

  const ratio = Math.min((size.width * 0.86) / spanX, (size.height * 0.82) / spanY);
  return clampNumber(reference + Math.log2(ratio), floor, MAX_ZOOM);
}

export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
