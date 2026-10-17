/**
 * Zwei kleine Helfer der Karte (2026-10-17 aus `OsmMap.tsx` hierher): der
 * Baustein „Mapa" braucht sie beim Lesen und Bearbeiten,
 * die Karte selbst kommt erst, wenn sie gezeigt wird.
 */

/**
 * Colours for tracks that do not name their own. Distinguishable from each
 * other and from the pins, and readable on a light map. The first entry defers
 * to the event's accent so a single track still matches its theme.
 */
const TRACK_PALETTE = ['var(--ev-accent, #4c7dd6)', '#c8553d', '#2e8b57', '#8a56c4', '#c9962c', '#1f7f92'];

export function trackColor(index: number): string {
  return TRACK_PALETTE[index % TRACK_PALETTE.length];
}

/**
 * Google's documented Maps URL: the coordinates alone, so the pin lands exactly
 * where the point is instead of wherever a search for its name would guess.
 * Opening it hands the reader navigation, which this map deliberately does not
 * try to provide.
 */
export function googleMapsHref(point: { lat: number; lon: number }): string {
  return `https://www.google.com/maps/search/?api=1&query=${point.lat.toFixed(6)},${point.lon.toFixed(6)}`;
}
