/**
 * GPX reading for the map part. A recorded track can carry tens of thousands of
 * points; storing that verbatim would bloat every page load, so the track is
 * simplified before it is saved and the original file is never kept.
 */

export type TrackPoint = [lat: number, lon: number];

export type GpxContents = {
  track: TrackPoint[];
  waypoints: Array<{ label: string; lat: number; lon: number }>;
};

/** Points kept after simplification. Enough for a country-scale route. */
const DEFAULT_MAX_POINTS = 600;

function isUsable(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -85 &&
    lat <= 85 &&
    lon >= -180 &&
    lon <= 180
  );
}

function round(value: number): number {
  // ~1 m of precision — far beyond what a route drawn at this zoom can show.
  return Math.round(value * 1e5) / 1e5;
}

/** Perpendicular distance from `point` to the segment `start`–`end`. */
function segmentDistance(point: TrackPoint, start: TrackPoint, end: TrackPoint): number {
  const [py, px] = point;
  const [sy, sx] = start;
  const [ey, ex] = end;

  const dx = ex - sx;
  const dy = ey - sy;

  if (dx === 0 && dy === 0) {
    return Math.hypot(px - sx, py - sy);
  }

  const t = ((px - sx) * dx + (py - sy) * dy) / (dx * dx + dy * dy);
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (sx + clamped * dx), py - (sy + clamped * dy));
}

/** Ramer–Douglas–Peucker, iterative so a long track cannot blow the stack. */
function simplifyOnce(points: TrackPoint[], tolerance: number): TrackPoint[] {
  if (points.length < 3) return points;

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    if (last <= first + 1) continue;

    let furthest = -1;
    let furthestDistance = tolerance;

    for (let index = first + 1; index < last; index += 1) {
      const distance = segmentDistance(points[index], points[first], points[last]);
      if (distance > furthestDistance) {
        furthest = index;
        furthestDistance = distance;
      }
    }

    if (furthest === -1) continue;
    keep[furthest] = 1;
    stack.push([first, furthest], [furthest, last]);
  }

  return points.filter((_, index) => keep[index] === 1);
}

/**
 * Simplifies down to at most `maxPoints`, raising the tolerance until it fits.
 * Starting tolerance is in degrees — roughly 1 m at these latitudes.
 */
export function simplifyTrack(points: TrackPoint[], maxPoints = DEFAULT_MAX_POINTS): TrackPoint[] {
  if (points.length <= maxPoints) return points;

  let tolerance = 0.00001;
  let result = points;

  // Each pass roughly quadruples the tolerance; the cap stops a pathological
  // input (every point identical) from looping forever.
  for (let attempt = 0; attempt < 24 && result.length > maxPoints; attempt += 1) {
    result = simplifyOnce(points, tolerance);
    tolerance *= 4;
  }

  if (result.length > maxPoints) {
    // Last resort: keep an even sample across the whole track.
    const stride = Math.ceil(result.length / maxPoints);
    result = result.filter((_, index) => index % stride === 0 || index === result.length - 1);
  }

  return result;
}

/**
 * Reads track points, route points and named waypoints out of a GPX document.
 * Uses the browser's XML parser rather than a regex, so namespaced and
 * oddly-formatted files from different devices all work.
 */
export function parseGpx(text: string): GpxContents {
  const document = new DOMParser().parseFromString(text, 'application/xml');

  if (document.querySelector('parsererror')) {
    throw new Error('Nie udało się odczytać pliku — to nie jest poprawny GPX.');
  }

  const readPoints = (selector: string): TrackPoint[] => {
    const result: TrackPoint[] = [];
    for (const node of Array.from(document.getElementsByTagName(selector))) {
      const lat = Number.parseFloat(node.getAttribute('lat') ?? '');
      const lon = Number.parseFloat(node.getAttribute('lon') ?? '');
      if (isUsable(lat, lon)) result.push([round(lat), round(lon)]);
    }
    return result;
  };

  // A file usually has one or the other; a track wins when both are present.
  const track = readPoints('trkpt');
  const route = track.length > 0 ? track : readPoints('rtept');

  const waypoints: GpxContents['waypoints'] = [];
  for (const node of Array.from(document.getElementsByTagName('wpt'))) {
    const lat = Number.parseFloat(node.getAttribute('lat') ?? '');
    const lon = Number.parseFloat(node.getAttribute('lon') ?? '');
    if (!isUsable(lat, lon)) continue;

    const label = node.getElementsByTagName('name')[0]?.textContent?.trim();
    waypoints.push({ label: label && label.length > 0 ? label : 'Punkt', lat: round(lat), lon: round(lon) });
  }

  if (route.length === 0 && waypoints.length === 0) {
    throw new Error('Plik nie zawiera ani śladu trasy, ani punktów.');
  }

  return { track: simplifyTrack(route), waypoints };
}

/** Total length of a track in kilometres, by the haversine formula. */
export function trackLengthKm(points: TrackPoint[]): number {
  const R = 6371;
  let total = 0;

  for (let index = 1; index < points.length; index += 1) {
    const [lat1, lon1] = points[index - 1];
    const [lat2, lon2] = points[index];
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    total += 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  return total;
}
