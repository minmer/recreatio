import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TrackPoint } from './gpx';

/**
 * A slippy OpenStreetMap viewer with no map library behind it.
 *
 * It comes in two modes. Inline it is a preview: it paints the route but takes
 * no gestures at all, so the page scrolls straight past it and a map can never
 * become a scroll trap. Clicking or tapping it opens the full-screen mode,
 * where the map owns every gesture — drag or one finger to pan, wheel or pinch
 * to zoom, double-click or double-tap to zoom in on a spot. Escape, the browser
 * back button, or the button in the top right corner close it again.
 *
 * The full-screen surface is rendered through a portal because the slide track
 * is transformed, and a transformed ancestor makes position:fixed resolve
 * against itself rather than the viewport.
 *
 * Gesture listeners are attached natively rather than through React: the page's
 * scroll engine listens on an ancestor, and a native ancestor listener runs
 * during bubbling before React delivers its synthetic event at the root, so a
 * React-level stopPropagation would always be too late.
 */

const TILE_SIZE = 256;
const MIN_ZOOM = 2;
const MAX_ZOOM = 18;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP_PX = 32;
const PINCH_STEP_RATIO = 1.5;
const HINT_MS = 2200;
/** How close a click must land to a pin to be read as naming that pin. */
const PIN_HIT_PX = 44;

export type MapPoint = {
  label: string;
  lat: number;
  lon: number;
  detail: string | null;
  isStop: boolean;
};

type PixelPoint = { x: number; y: number };
type LatLon = { lat: number; lon: number };
type Size = { width: number; height: number };

/** Geographic degrees → absolute pixel coordinates at `zoom`. */
function project(lat: number, lon: number, zoom: number): PixelPoint {
  const scale = TILE_SIZE * Math.pow(2, zoom);
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const sinLat = Math.sin((clampedLat * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale
  };
}

function unproject(point: PixelPoint, zoom: number): LatLon {
  const scale = TILE_SIZE * Math.pow(2, zoom);
  const n = Math.PI - 2 * Math.PI * (point.y / scale);
  return {
    lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))),
    lon: (point.x / scale) * 360 - 180
  };
}

function clampNumber(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Below this the world would be smaller than the box, leaving bare corners. */
function minZoomFor(size: Size): number {
  const longest = Math.max(size.width, size.height);
  if (longest <= 0) return MIN_ZOOM;
  return Math.max(MIN_ZOOM, Math.ceil(Math.log2(longest / TILE_SIZE)));
}

/**
 * Keeps the view inside the world vertically. Longitude is free because the
 * tile grid wraps, but latitude has ends, and without this a drag can leave
 * blank space beyond the north edge.
 */
function clampCenter(center: LatLon, zoom: number, size: Size): LatLon {
  const worldPx = TILE_SIZE * Math.pow(2, zoom);
  const projected = project(center.lat, center.lon, zoom);
  const half = size.height / 2;
  const y = worldPx <= size.height ? worldPx / 2 : clampNumber(projected.y, half, worldPx - half);
  return y === projected.y ? center : unproject({ x: projected.x, y }, zoom);
}

function boundsOf(points: MapPoint[], track: TrackPoint[]) {
  const lats = [...points.map((p) => p.lat), ...track.map(([lat]) => lat)];
  const lons = [...points.map((p) => p.lon), ...track.map(([, lon]) => lon)];
  if (lats.length === 0) return null;
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons)
  };
}

function centreOf(points: MapPoint[], track: TrackPoint[]): LatLon {
  const bounds = boundsOf(points, track);
  if (!bounds) return { lat: 50.0619, lon: 19.9369 };
  return { lat: (bounds.minLat + bounds.maxLat) / 2, lon: (bounds.minLon + bounds.maxLon) / 2 };
}

/** Largest zoom at which everything still fits inside the box. */
function fitZoom(points: MapPoint[], track: TrackPoint[], size: Size, fallback: number): number {
  const bounds = boundsOf(points, track);
  const floor = minZoomFor(size);
  if (!bounds || size.width <= 0 || size.height <= 0) return Math.max(floor, fallback);
  if (bounds.minLat === bounds.maxLat && bounds.minLon === bounds.maxLon) {
    return Math.max(floor, fallback);
  }

  for (let zoom = MAX_ZOOM; zoom >= floor; zoom -= 1) {
    const topLeft = project(bounds.maxLat, bounds.minLon, zoom);
    const bottomRight = project(bounds.minLat, bounds.maxLon, zoom);
    if (bottomRight.x - topLeft.x <= size.width * 0.84 && bottomRight.y - topLeft.y <= size.height * 0.8) {
      return zoom;
    }
  }
  return floor;
}

type SurfaceProps = {
  points: MapPoint[];
  track: TrackPoint[];
  zoom: number;
  showTrack: boolean;
  activeIndex: number | null;
  onActiveChange: (index: number | null) => void;
};

export function OsmMap(props: SurfaceProps) {
  const [open, setOpen] = useState(false);

  // Escape, and the browser/Android back button, both close the map. Pushing a
  // history entry is what makes back close the overlay instead of leaving the
  // page the reader was on.
  useEffect(() => {
    if (!open) return;

    window.history.pushState({ e2map: true }, '');
    const onPopState = () => setOpen(false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('popstate', onPopState);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('keydown', onKeyDown);
      // Closed by the button or Escape rather than by going back: drop the
      // entry we pushed so back does not have to be pressed twice.
      if (window.history.state?.e2map) window.history.back();
    };
  }, [open]);

  return (
    <>
      <MapSurface {...props} interactive={false} onOpen={() => setOpen(true)} />
      {open
        ? createPortal(
            <div className="e2-map-overlay" role="dialog" aria-modal="true" aria-label="Mapa na pełnym ekranie">
              <MapSurface {...props} interactive onClose={() => setOpen(false)} />
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function MapSurface({
  points,
  track,
  zoom: initialZoom,
  showTrack,
  activeIndex,
  onActiveChange,
  interactive,
  onOpen,
  onClose
}: SurfaceProps & {
  interactive: boolean;
  onOpen?: () => void;
  onClose?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const touchedRef = useRef(false);
  const hintTimerRef = useRef<number | null>(null);

  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(initialZoom);
  const [center, setCenter] = useState<LatLon>(() => centreOf(points, track));
  const [hint, setHint] = useState<string | null>(null);
  const [failedTiles, setFailedTiles] = useState<Set<string>>(() => new Set());

  // Native listeners are installed once and read live values through refs.
  const zoomRef = useRef(zoom);
  const centerRef = useRef(center);
  const sizeRef = useRef(size);
  const pointsRef = useRef(points);
  zoomRef.current = zoom;
  centerRef.current = center;
  sizeRef.current = size;
  pointsRef.current = points;

  const showHint = useCallback((message: string) => {
    setHint(message);
    if (hintTimerRef.current !== null) window.clearTimeout(hintTimerRef.current);
    hintTimerRef.current = window.setTimeout(() => {
      hintTimerRef.current = null;
      setHint(null);
    }, HINT_MS);
  }, []);

  useEffect(
    () => () => {
      if (hintTimerRef.current !== null) window.clearTimeout(hintTimerRef.current);
    },
    []
  );

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Identity of the data, so refitting does not depend on array identity — the
  // config is re-parsed on every render and would otherwise churn.
  const dataKey = useMemo(() => {
    const bounds = boundsOf(points, track);
    return bounds ? `${bounds.minLat},${bounds.minLon},${bounds.maxLat},${bounds.maxLon}` : 'empty';
  }, [points, track]);

  const fitToData = useCallback(() => {
    const current = sizeRef.current;
    if (current.width <= 0 || current.height <= 0) return;
    const nextZoom = fitZoom(points, track, current, initialZoom);
    setZoom(nextZoom);
    setCenter(clampCenter(centreOf(points, track), nextZoom, current));
  }, [initialZoom, points, track]);

  // Refit on data or size change until the reader takes over, which keeps the
  // view correct through an orientation change or a window resize.
  useEffect(() => {
    if (touchedRef.current) return;
    fitToData();
  }, [dataKey, fitToData, size.height, size.width]);

  const topLeft = useMemo(() => {
    const centerPx = project(center.lat, center.lon, zoom);
    return { x: centerPx.x - size.width / 2, y: centerPx.y - size.height / 2 };
  }, [center, size.height, size.width, zoom]);

  // ── Gestures ──────────────────────────────────────────────────────────────

  const panByPixels = useCallback((dx: number, dy: number) => {
    touchedRef.current = true;
    const currentZoom = zoomRef.current;
    setCenter((current) => {
      const projected = project(current.lat, current.lon, currentZoom);
      return clampCenter(
        unproject({ x: projected.x + dx, y: projected.y + dy }, currentZoom),
        currentZoom,
        sizeRef.current
      );
    });
  }, []);

  /**
   * Zooms while holding the geography under (clientX, clientY) still, so the
   * thing you aimed at stays where you aimed it. Returns that anchor, so the
   * caller can say what was zoomed on.
   */
  const zoomAround = useCallback((steps: number, clientX: number, clientY: number): LatLon | null => {
    const element = containerRef.current;
    if (!element) return null;

    const currentZoom = zoomRef.current;
    const { width, height } = sizeRef.current;
    const nextZoom = clampNumber(currentZoom + steps, minZoomFor(sizeRef.current), MAX_ZOOM);

    const rect = element.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;

    const centerPx = project(centerRef.current.lat, centerRef.current.lon, currentZoom);
    const anchor = unproject(
      { x: centerPx.x - width / 2 + localX, y: centerPx.y - height / 2 + localY },
      currentZoom
    );

    if (nextZoom === currentZoom) return anchor;

    touchedRef.current = true;
    const anchorPx = project(anchor.lat, anchor.lon, nextZoom);
    const nextCenter = unproject(
      { x: anchorPx.x - localX + width / 2, y: anchorPx.y - localY + height / 2 },
      nextZoom
    );

    setZoom(nextZoom);
    setCenter(clampCenter(nextCenter, nextZoom, sizeRef.current));
    return anchor;
  }, []);

  const zoomAtCentre = useCallback(
    (steps: number) => {
      const element = containerRef.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      zoomAround(steps, rect.left + rect.width / 2, rect.top + rect.height / 2);
    },
    [zoomAround]
  );

  /** Names what sits under a screen position: a pin if one is close, else the spot. */
  const describePlace = useCallback((clientX: number, clientY: number, anchor: LatLon | null): string => {
    const element = containerRef.current;
    if (element) {
      const rect = element.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      const currentZoom = zoomRef.current;
      const centerPx = project(centerRef.current.lat, centerRef.current.lon, currentZoom);
      const origin = {
        x: centerPx.x - sizeRef.current.width / 2,
        y: centerPx.y - sizeRef.current.height / 2
      };

      let nearest: { label: string; distance: number } | null = null;
      for (const point of pointsRef.current) {
        const projected = project(point.lat, point.lon, currentZoom);
        const distance = Math.hypot(projected.x - origin.x - localX, projected.y - origin.y - localY);
        if (distance <= PIN_HIT_PX && (nearest === null || distance < nearest.distance)) {
          nearest = { label: point.label, distance };
        }
      }
      if (nearest) return nearest.label;
    }

    return anchor ? `${anchor.lat.toFixed(5)}, ${anchor.lon.toFixed(5)}` : '—';
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    // The preview takes no gestures at all — that is what keeps the page
    // scrolling freely over it.
    if (!element || !interactive) return;

    let drag: { pointerId: number; lastX: number; lastY: number } | null = null;
    // Touch browsers synthesize a click/dblclick pair after a double-tap.
    let lastTouchAt = 0;

    // ── Mouse ───────────────────────────────────────────────────────────────
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || drag !== null) return;
      drag = { pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY };
      element.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.lastX;
      const dy = event.clientY - drag.lastY;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      panByPixels(-dx, -dy);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag = null;
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    };

    const onDoubleClick = (event: MouseEvent) => {
      // Emulated from a double-tap that has already been handled.
      if (performance.now() - lastTouchAt < 700) return;
      if ((event.target as HTMLElement).closest('.e2-map-marker, .e2-map-controls')) return;

      event.preventDefault();
      event.stopPropagation();
      const anchor = zoomAround(event.shiftKey ? -1 : 1, event.clientX, event.clientY);
      showHint(
        `${event.shiftKey ? 'Oddalono' : 'Przybliżono'}: ${describePlace(event.clientX, event.clientY, anchor)}`
      );
    };

    // ── Wheel ───────────────────────────────────────────────────────────────
    let wheelAccumulator = 0;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();

      // Trackpads emit many small deltas; accumulate so one gesture is one step.
      wheelAccumulator += event.deltaY;
      const steps = Math.trunc(wheelAccumulator / 50);
      if (steps === 0) return;
      wheelAccumulator -= steps * 50;
      zoomAround(-steps, event.clientX, event.clientY);
    };

    // ── Touch ───────────────────────────────────────────────────────────────
    let panTouch: { x: number; y: number } | null = null;
    let pinchDistance = 0;
    let tapStart: { x: number; y: number; at: number } | null = null;
    let lastTapAt = 0;
    let lastTapX = 0;
    let lastTapY = 0;

    const distanceBetween = (touches: TouchList) =>
      Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

    const onTouchStart = (event: TouchEvent) => {
      event.stopPropagation();
      lastTouchAt = performance.now();

      if (event.touches.length === 1) {
        const touch = event.touches[0];
        tapStart = { x: touch.clientX, y: touch.clientY, at: lastTouchAt };
        panTouch = { x: touch.clientX, y: touch.clientY };
        pinchDistance = 0;
      } else if (event.touches.length === 2) {
        tapStart = null;
        panTouch = null;
        pinchDistance = distanceBetween(event.touches);
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      event.stopPropagation();
      event.preventDefault();
      lastTouchAt = performance.now();

      if (event.touches.length === 1 && panTouch) {
        const dx = event.touches[0].clientX - panTouch.x;
        const dy = event.touches[0].clientY - panTouch.y;
        panTouch = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        panByPixels(-dx, -dy);
        return;
      }

      if (event.touches.length === 2 && pinchDistance > 0) {
        const midX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
        const midY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
        const next = distanceBetween(event.touches);
        const ratio = next / pinchDistance;

        // Step a whole zoom level once the fingers have moved far enough, so
        // tiles never have to be drawn at a fractional scale.
        if (ratio > PINCH_STEP_RATIO || ratio < 1 / PINCH_STEP_RATIO) {
          zoomAround(ratio > 1 ? 1 : -1, midX, midY);
          pinchDistance = next;
        }
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      event.stopPropagation();
      lastTouchAt = performance.now();

      const finished = event.changedTouches[0];
      const start = tapStart;
      panTouch = null;
      pinchDistance = 0;
      tapStart = null;

      if (!finished || !start || event.touches.length > 0) return;
      if ((event.target as HTMLElement).closest('.e2-map-marker, .e2-map-controls')) return;

      // A tap is a touch that neither moved nor lingered.
      const moved = Math.hypot(finished.clientX - start.x, finished.clientY - start.y);
      if (moved > DOUBLE_TAP_SLOP_PX || performance.now() - start.at > 400) return;

      const now = performance.now();
      const isDoubleTap =
        now - lastTapAt < DOUBLE_TAP_MS &&
        Math.hypot(finished.clientX - lastTapX, finished.clientY - lastTapY) < DOUBLE_TAP_SLOP_PX;

      if (isDoubleTap) {
        // Suppress the emulated click pair the browser would send next.
        event.preventDefault();
        lastTapAt = 0;
        const anchor = zoomAround(1, finished.clientX, finished.clientY);
        showHint(`Przybliżono: ${describePlace(finished.clientX, finished.clientY, anchor)}`);
        return;
      }

      lastTapAt = now;
      lastTapX = finished.clientX;
      lastTapY = finished.clientY;
    };

    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerup', onPointerUp);
    element.addEventListener('pointercancel', onPointerUp);
    element.addEventListener('dblclick', onDoubleClick);
    element.addEventListener('wheel', onWheel, { passive: false });
    element.addEventListener('touchstart', onTouchStart, { passive: false });
    element.addEventListener('touchmove', onTouchMove, { passive: false });
    element.addEventListener('touchend', onTouchEnd, { passive: false });
    element.addEventListener('touchcancel', onTouchEnd, { passive: false });

    return () => {
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', onPointerUp);
      element.removeEventListener('pointercancel', onPointerUp);
      element.removeEventListener('dblclick', onDoubleClick);
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', onTouchEnd);
      element.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [describePlace, interactive, panByPixels, showHint, zoomAround]);

  // ── Painting ──────────────────────────────────────────────────────────────

  const tiles = useMemo(() => {
    if (size.width <= 0 || size.height <= 0) return [];
    const count = Math.pow(2, zoom);
    const result: Array<{ key: string; url: string; left: number; top: number }> = [];

    for (let ty = Math.floor(topLeft.y / TILE_SIZE); ty <= Math.floor((topLeft.y + size.height) / TILE_SIZE); ty += 1) {
      if (ty < 0 || ty >= count) continue;
      for (let tx = Math.floor(topLeft.x / TILE_SIZE); tx <= Math.floor((topLeft.x + size.width) / TILE_SIZE); tx += 1) {
        // Wrap horizontally so panning past the antimeridian still paints.
        const wrappedX = ((tx % count) + count) % count;
        result.push({
          key: `${zoom}-${tx}-${ty}`,
          url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${ty}.png`,
          left: tx * TILE_SIZE - topLeft.x,
          top: ty * TILE_SIZE - topLeft.y
        });
      }
    }
    return result;
  }, [size.height, size.width, topLeft, zoom]);

  const screenPoints = useMemo(
    () =>
      points.map((point) => {
        const projected = project(point.lat, point.lon, zoom);
        return { point, x: projected.x - topLeft.x, y: projected.y - topLeft.y };
      }),
    [points, topLeft, zoom]
  );

  /** The GPX route if there is one, otherwise a line joining the pins. */
  const routeLine = useMemo(() => {
    if (!showTrack) return '';

    const source =
      track.length > 1
        ? track.map(([lat, lon]) => {
            const projected = project(lat, lon, zoom);
            return { x: projected.x - topLeft.x, y: projected.y - topLeft.y };
          })
        : screenPoints.length > 1
          ? screenPoints.map((entry) => ({ x: entry.x, y: entry.y }))
          : [];

    return source.map((entry) => `${Math.round(entry.x)},${Math.round(entry.y)}`).join(' ');
  }, [screenPoints, showTrack, topLeft, track, zoom]);

  return (
    <div
      className={`e2-map-canvas ${interactive ? 'is-full' : 'is-preview'}`}
      ref={containerRef}
      role={interactive ? 'application' : undefined}
      aria-label={interactive ? 'Mapa punktów trasy' : undefined}
    >
      <div className="e2-map-tiles">
        {tiles.map((tile) =>
          failedTiles.has(tile.key) ? null : (
            <img
              key={tile.key}
              src={tile.url}
              alt=""
              width={TILE_SIZE}
              height={TILE_SIZE}
              loading="lazy"
              draggable={false}
              style={{ left: `${tile.left}px`, top: `${tile.top}px` }}
              onError={() =>
                setFailedTiles((current) => {
                  if (current.has(tile.key)) return current;
                  const next = new Set(current);
                  next.add(tile.key);
                  return next;
                })
              }
            />
          )
        )}
      </div>

      {routeLine.length > 0 ? (
        <svg className="e2-map-track" width={size.width} height={size.height} aria-hidden="true">
          <polyline
            points={routeLine}
            fill="none"
            stroke="var(--e2-accent)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
          />
        </svg>
      ) : null}

      <div className="e2-map-markers">
        {screenPoints.map((entry, index) => (
          <button
            key={index}
            type="button"
            className={`e2-map-marker ${entry.point.isStop ? 'is-stop' : ''} ${
              interactive && activeIndex === index ? 'is-open' : ''
            }`}
            style={{ left: `${entry.x}px`, top: `${entry.y}px` }}
            onClick={() => onActiveChange(activeIndex === index ? null : index)}
            aria-label={entry.point.label}
            tabIndex={interactive ? 0 : -1}
          >
            <span className="e2-map-dot" aria-hidden="true" />
            {interactive && activeIndex === index ? (
              <span className="e2-map-tip">
                <strong>{entry.point.label}</strong>
                {entry.point.detail ? <em>{entry.point.detail}</em> : null}
                <small>
                  {entry.point.lat.toFixed(5)}, {entry.point.lon.toFixed(5)}
                </small>
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {interactive ? (
        <>
          <div className="e2-map-controls">
            <button type="button" onClick={() => zoomAtCentre(1)} disabled={zoom >= MAX_ZOOM} aria-label="Przybliż">
              +
            </button>
            <button
              type="button"
              onClick={() => zoomAtCentre(-1)}
              disabled={zoom <= minZoomFor(size)}
              aria-label="Oddal"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => {
                touchedRef.current = false;
                fitToData();
              }}
              aria-label="Pokaż całą trasę"
              title="Pokaż całą trasę"
            >
              ⤢
            </button>
          </div>

          <button type="button" className="e2-map-close" onClick={onClose} aria-label="Zamknij mapę">
            ✕
          </button>

          {hint ? <p className="e2-map-hint">{hint}</p> : null}
        </>
      ) : (
        // One button covering the preview: any click or tap opens the map, and
        // it is reachable from the keyboard for free.
        <button type="button" className="e2-map-open" onClick={onOpen}>
          <span>Otwórz mapę</span>
        </button>
      )}

      {/* Required by the OpenStreetMap tile usage policy. */}
      <a
        className="e2-map-attribution"
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer noopener"
      >
        © OpenStreetMap contributors
      </a>
    </div>
  );
}
