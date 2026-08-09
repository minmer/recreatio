import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { TrackPoint } from './gpx';

/**
 * A slippy OpenStreetMap viewer with no map library behind it: Web Mercator
 * projection, a grid of raster tiles, and the gestures people expect —
 * drag to pan, double-click or double-tap to zoom in, ctrl+wheel and pinch to
 * zoom either way.
 *
 * Every gesture listener is attached natively rather than through React. The
 * page's own scroll engine listens for wheel and touchmove on an ancestor
 * element, and a native ancestor listener runs during bubbling *before* React
 * delivers its synthetic event at the root — so a React-level stopPropagation
 * would come too late and the page would scroll while the map was being panned.
 */

const TILE_SIZE = 256;
const MIN_ZOOM = 2;
const MAX_ZOOM = 18;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP_PX = 32;
/** Pinch distance ratio that steps the zoom by one level. */
const PINCH_STEP_RATIO = 1.5;

export type MapPoint = {
  label: string;
  lat: number;
  lon: number;
  detail: string | null;
  isStop: boolean;
};

type PixelPoint = { x: number; y: number };
type LatLon = { lat: number; lon: number };

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

/** Largest zoom at which everything still fits inside the container. */
function fitZoom(points: MapPoint[], track: TrackPoint[], width: number, height: number, fallback: number): number {
  const bounds = boundsOf(points, track);
  if (!bounds || width <= 0 || height <= 0) return fallback;
  if (bounds.minLat === bounds.maxLat && bounds.minLon === bounds.maxLon) return fallback;

  for (let zoom = MAX_ZOOM; zoom >= MIN_ZOOM; zoom -= 1) {
    const topLeft = project(bounds.maxLat, bounds.minLon, zoom);
    const bottomRight = project(bounds.minLat, bounds.maxLon, zoom);
    if (bottomRight.x - topLeft.x <= width * 0.82 && bottomRight.y - topLeft.y <= height * 0.78) {
      return zoom;
    }
  }
  return MIN_ZOOM;
}

function centreOf(points: MapPoint[], track: TrackPoint[]): LatLon {
  const bounds = boundsOf(points, track);
  if (!bounds) return { lat: 50.0619, lon: 19.9369 };
  return {
    lat: (bounds.minLat + bounds.maxLat) / 2,
    lon: (bounds.minLon + bounds.maxLon) / 2
  };
}

export function OsmMap({
  points,
  track,
  zoom: initialZoom,
  showTrack,
  activeIndex,
  onActiveChange
}: {
  points: MapPoint[];
  /** GPX-derived route. When present it is drawn instead of joining the points. */
  track: TrackPoint[];
  zoom: number;
  showTrack: boolean;
  activeIndex: number | null;
  onActiveChange: (index: number | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const didFitRef = useRef(false);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(initialZoom);
  const [center, setCenter] = useState<LatLon>(() => centreOf(points, track));

  // Native listeners are installed once and read live values through refs.
  const zoomRef = useRef(zoom);
  const centerRef = useRef(center);
  const sizeRef = useRef(size);
  zoomRef.current = zoom;
  centerRef.current = center;
  sizeRef.current = size;

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

  // Fit once the container has a real size, then leave the view to the reader.
  useEffect(() => {
    if (didFitRef.current || size.width <= 0 || size.height <= 0) return;
    didFitRef.current = true;
    setCenter(centreOf(points, track));
    setZoom(fitZoom(points, track, size.width, size.height, initialZoom));
  }, [initialZoom, points, size.height, size.width, track]);

  const topLeft = useMemo(() => {
    const centerPx = project(center.lat, center.lon, zoom);
    return { x: centerPx.x - size.width / 2, y: centerPx.y - size.height / 2 };
  }, [center, size.height, size.width, zoom]);

  // ── Gestures ──────────────────────────────────────────────────────────────

  const panByPixels = useCallback((dx: number, dy: number) => {
    const currentZoom = zoomRef.current;
    setCenter((current) => {
      const projected = project(current.lat, current.lon, currentZoom);
      return unproject({ x: projected.x + dx, y: projected.y + dy }, currentZoom);
    });
  }, []);

  /**
   * Zooms while holding the geography under (clientX, clientY) still. Zooming
   * about the container centre instead would throw whatever you aimed at off
   * the screen.
   */
  const zoomAround = useCallback((steps: number, clientX: number, clientY: number) => {
    const element = containerRef.current;
    if (!element) return;

    const currentZoom = zoomRef.current;
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom + steps));
    if (nextZoom === currentZoom) return;

    const rect = element.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;

    const { width, height } = sizeRef.current;
    const centerPx = project(centerRef.current.lat, centerRef.current.lon, currentZoom);
    const anchor = unproject(
      { x: centerPx.x - width / 2 + localX, y: centerPx.y - height / 2 + localY },
      currentZoom
    );

    const anchorPx = project(anchor.lat, anchor.lon, nextZoom);
    const nextCenter = unproject(
      { x: anchorPx.x - localX + width / 2, y: anchorPx.y - localY + height / 2 },
      nextZoom
    );

    setZoom(nextZoom);
    setCenter(nextCenter);
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

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    // ── Mouse ───────────────────────────────────────────────────────────────
    let drag: { pointerId: number; lastX: number; lastY: number; moved: boolean } | null = null;
    // Touch browsers synthesize a click/dblclick pair after a double-tap. This
    // marks when a real touch last happened so the mouse path can stand down.
    let lastTouchAt = 0;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || drag !== null) return;
      drag = { pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY, moved: false };
      element.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.lastX;
      const dy = event.clientY - drag.lastY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) drag.moved = true;
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
      // A double-click on a marker is aimed at the marker, not the map.
      if ((event.target as HTMLElement).closest('.e2-map-marker')) return;
      event.preventDefault();
      event.stopPropagation();
      // Shift is the long-standing convention for "double-click out".
      zoomAround(event.shiftKey ? -1 : 1, event.clientX, event.clientY);
    };

    // ── Wheel ───────────────────────────────────────────────────────────────
    let wheelAccumulator = 0;

    const onWheel = (event: WheelEvent) => {
      // Plain wheel belongs to the page. Only a modifier means "zoom the map",
      // which also matches how browsers treat ctrl+wheel as zoom.
      if (!event.ctrlKey && !event.metaKey) return;

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
    let touchLast: { x: number; y: number } | null = null;
    let pinchDistance = 0;
    let lastTapAt = 0;
    let lastTapX = 0;
    let lastTapY = 0;

    const distanceBetween = (touches: TouchList) =>
      Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

    const onTouchStart = (event: TouchEvent) => {
      // Claim the gesture before the page scroller sees it.
      event.stopPropagation();

      if (event.touches.length === 1) {
        touchLast = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        pinchDistance = 0;
      } else if (event.touches.length === 2) {
        touchLast = null;
        pinchDistance = distanceBetween(event.touches);
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      event.stopPropagation();
      event.preventDefault();

      if (event.touches.length === 1 && touchLast) {
        const dx = event.touches[0].clientX - touchLast.x;
        const dy = event.touches[0].clientY - touchLast.y;
        touchLast = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        panByPixels(-dx, -dy);
        return;
      }

      if (event.touches.length === 2 && pinchDistance > 0) {
        const next = distanceBetween(event.touches);
        const ratio = next / pinchDistance;
        // Step a whole zoom level once the fingers have moved far enough, so
        // tiles never have to be drawn at a fractional scale.
        if (ratio > PINCH_STEP_RATIO || ratio < 1 / PINCH_STEP_RATIO) {
          const midX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
          const midY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
          zoomAround(ratio > 1 ? 1 : -1, midX, midY);
          pinchDistance = next;
        }
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      event.stopPropagation();
      lastTouchAt = performance.now();

      const wasSingle = touchLast !== null && event.touches.length === 0;
      const finished = event.changedTouches[0];
      touchLast = null;
      pinchDistance = 0;

      if (!wasSingle || !finished) return;
      if ((event.target as HTMLElement).closest('.e2-map-marker')) return;

      const now = performance.now();
      const isDoubleTap =
        now - lastTapAt < DOUBLE_TAP_MS &&
        Math.hypot(finished.clientX - lastTapX, finished.clientY - lastTapY) < DOUBLE_TAP_SLOP_PX;

      if (isDoubleTap) {
        // Suppress the emulated click pair the browser would send next.
        event.preventDefault();
        lastTapAt = 0;
        zoomAround(1, finished.clientX, finished.clientY);
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
  }, [panByPixels, zoomAround]);

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

    const source: Array<{ x: number; y: number }> =
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
    <div className="e2-map-canvas" ref={containerRef} role="application" aria-label="Mapa punktów trasy">
      <div className="e2-map-tiles">
        {tiles.map((tile) => (
          <img
            key={tile.key}
            src={tile.url}
            alt=""
            width={TILE_SIZE}
            height={TILE_SIZE}
            loading="lazy"
            draggable={false}
            style={{ left: `${tile.left}px`, top: `${tile.top}px` }}
          />
        ))}
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
            className={`e2-map-marker ${entry.point.isStop ? 'is-stop' : ''} ${activeIndex === index ? 'is-open' : ''}`}
            style={{ left: `${entry.x}px`, top: `${entry.y}px` }}
            onClick={() => onActiveChange(activeIndex === index ? null : index)}
            aria-label={entry.point.label}
          >
            <span className="e2-map-dot" aria-hidden="true" />
            {activeIndex === index ? (
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

      <div className="e2-map-zoom">
        <button type="button" onClick={() => zoomAtCentre(1)} disabled={zoom >= MAX_ZOOM} aria-label="Przybliż">
          +
        </button>
        <button type="button" onClick={() => zoomAtCentre(-1)} disabled={zoom <= MIN_ZOOM} aria-label="Oddal">
          −
        </button>
      </div>

      <p className="e2-map-hint" aria-hidden="true">
        Ctrl + kółko myszy, podwójne kliknięcie lub dwa palce — przybliżanie
      </p>

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
