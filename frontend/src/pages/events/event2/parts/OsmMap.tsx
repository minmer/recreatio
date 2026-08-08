import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

/**
 * A slippy OpenStreetMap viewer with no map library behind it: Web Mercator
 * projection, a grid of raster tiles, drag-to-pan and zoom buttons.
 */

const TILE_SIZE = 256;
const MIN_ZOOM = 2;
const MAX_ZOOM = 18;

export type MapPoint = {
  label: string;
  lat: number;
  lon: number;
  detail: string | null;
  isStop: boolean;
};

type PixelPoint = { x: number; y: number };

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

function unproject(point: PixelPoint, zoom: number): { lat: number; lon: number } {
  const scale = TILE_SIZE * Math.pow(2, zoom);
  const lon = (point.x / scale) * 360 - 180;
  const n = Math.PI - 2 * Math.PI * (point.y / scale);
  return {
    lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))),
    lon
  };
}

function centroid(points: MapPoint[]): { lat: number; lon: number } {
  if (points.length === 0) return { lat: 50.0619, lon: 19.9369 };
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  return {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lon: (Math.min(...lons) + Math.max(...lons)) / 2
  };
}

/** Largest zoom at which every point still fits inside the container. */
function fitZoom(points: MapPoint[], width: number, height: number, fallback: number): number {
  if (points.length < 2 || width <= 0 || height <= 0) return fallback;

  for (let zoom = MAX_ZOOM; zoom >= MIN_ZOOM; zoom -= 1) {
    const projected = points.map((p) => project(p.lat, p.lon, zoom));
    const spanX = Math.max(...projected.map((c) => c.x)) - Math.min(...projected.map((c) => c.x));
    const spanY = Math.max(...projected.map((c) => c.y)) - Math.min(...projected.map((c) => c.y));
    if (spanX <= width * 0.82 && spanY <= height * 0.72) return zoom;
  }
  return MIN_ZOOM;
}

export function OsmMap({
  points,
  zoom: initialZoom,
  showTrack,
  activeIndex,
  onActiveChange
}: {
  points: MapPoint[];
  zoom: number;
  showTrack: boolean;
  activeIndex: number | null;
  onActiveChange: (index: number | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; lastX: number; lastY: number; moved: boolean } | null>(null);
  const didFitRef = useRef(false);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(initialZoom);
  const [center, setCenter] = useState(() => centroid(points));

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
    setCenter(centroid(points));
    setZoom(fitZoom(points, size.width, size.height, initialZoom));
  }, [initialZoom, points, size.height, size.width]);

  const topLeft = useMemo(() => {
    const centerPx = project(center.lat, center.lon, zoom);
    return { x: centerPx.x - size.width / 2, y: centerPx.y - size.height / 2 };
  }, [center, size.height, size.width, zoom]);

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

  const panBy = useCallback(
    (dx: number, dy: number) => {
      setCenter((current) => {
        const projected = project(current.lat, current.lon, zoom);
        return unproject({ x: projected.x + dx, y: projected.y + dy }, zoom);
      });
    },
    [zoom]
  );

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current !== null) return;
    dragRef.current = { pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.lastX;
    const dy = event.clientY - drag.lastY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) drag.moved = true;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    panBy(-dx, -dy);
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  // The page scroller preventDefaults touchmove on an ancestor. Stopping
  // propagation here keeps a map pan from also scrolling the page.
  const swallowTouch = (event: React.TouchEvent<HTMLDivElement>) => event.stopPropagation();

  return (
    <div
      className="e2-map-canvas"
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onTouchStart={swallowTouch}
      onTouchMove={swallowTouch}
      role="application"
      aria-label="Mapa punktów trasy"
    >
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

      {showTrack && screenPoints.length > 1 ? (
        <svg className="e2-map-track" width={size.width} height={size.height} aria-hidden="true">
          <polyline
            points={screenPoints.map((entry) => `${entry.x},${entry.y}`).join(' ')}
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
            onClick={() => {
              // A click that ended a drag should not also open a tooltip.
              if (dragRef.current?.moved) return;
              onActiveChange(activeIndex === index ? null : index);
            }}
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
        <button
          type="button"
          onClick={() => setZoom((current) => Math.min(MAX_ZOOM, current + 1))}
          disabled={zoom >= MAX_ZOOM}
          aria-label="Przybliż"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setZoom((current) => Math.max(MIN_ZOOM, current - 1))}
          disabled={zoom <= MIN_ZOOM}
          aria-label="Oddal"
        >
          −
        </button>
      </div>

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
