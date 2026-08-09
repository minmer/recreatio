import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { MapTrack } from './gpx';

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
 * A slippy OpenStreetMap viewer with no map library behind it.
 *
 * It comes in two modes. Inline it is a preview: it paints the route but takes
 * no gestures at all, so the page scrolls straight past it and a map can never
 * become a scroll trap. Clicking or tapping it opens the full-screen mode,
 * where the map owns every gesture. Escape, the browser back button, or the
 * button in the top right corner close it again.
 *
 * Zoom is continuous rather than stepped: the view holds a fractional zoom and
 * tiles are drawn at 256 × 2^(zoom − tileZoom), so a pinch or a wheel scrubs
 * smoothly and only the tile *source* snaps to whole levels.
 *
 * The whole view — zoom and centre together — is a single piece of state,
 * updated only through functional updates. Holding them apart was what made
 * zoom drift off centre: two events in one frame both read the same stale
 * centre from a ref, and the second one anchored against the wrong origin.
 */

const TILE_SIZE = 256;
const MIN_ZOOM = 2;
const MAX_ZOOM = 18;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP_PX = 32;
const HINT_MS = 2200;
/** How close a click must land to a pin to be read as naming that pin. */
const PIN_HIT_PX = 44;
/** Wheel travel for one whole zoom level. */
const WHEEL_PER_LEVEL = 260;
const STEP_ZOOM_MS = 240;

/** Tokens the full-screen portal has to carry with it, out of `.ev` scope. */
const THEME_TOKENS = ['--ev-accent', '--ev-ink', '--ev-ground', '--ev-muted', '--ev-line', '--ev-line-2'];

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
type View = { zoom: number; center: LatLon };

/** Geographic degrees → absolute pixel coordinates at `zoom` (may be fractional). */
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
  return Math.max(MIN_ZOOM, Math.log2(longest / TILE_SIZE));
}

/**
 * Keeps the view inside the world vertically. Longitude is free because the
 * tile grid wraps, but latitude has ends.
 */
function clampCenter(center: LatLon, zoom: number, size: Size): LatLon {
  const worldPx = TILE_SIZE * Math.pow(2, zoom);
  const projected = project(center.lat, center.lon, zoom);
  const half = size.height / 2;
  const y = worldPx <= size.height ? worldPx / 2 : clampNumber(projected.y, half, worldPx - half);
  return y === projected.y ? center : unproject({ x: projected.x, y }, zoom);
}

/** Top-left of the viewport in world pixels at the view's own zoom. */
function originOf(view: View, size: Size): PixelPoint {
  const centerPx = project(view.center.lat, view.center.lon, view.zoom);
  return { x: centerPx.x - size.width / 2, y: centerPx.y - size.height / 2 };
}

/** What geography sits at a point inside the box. */
function anchorAt(view: View, localX: number, localY: number, size: Size): LatLon {
  const origin = originOf(view, size);
  return unproject({ x: origin.x + localX, y: origin.y + localY }, view.zoom);
}

/** The centre that puts `anchor` back at (localX, localY) at a given zoom. */
function centerForAnchor(anchor: LatLon, localX: number, localY: number, zoom: number, size: Size): LatLon {
  const anchorPx = project(anchor.lat, anchor.lon, zoom);
  return unproject(
    { x: anchorPx.x - localX + size.width / 2, y: anchorPx.y - localY + size.height / 2 },
    zoom
  );
}

function boundsOf(points: MapPoint[], tracks: MapTrack[]) {
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

function centreOf(points: MapPoint[], tracks: MapTrack[]): LatLon {
  const bounds = boundsOf(points, tracks);
  if (!bounds) return { lat: 50.0619, lon: 19.9369 };
  return { lat: (bounds.minLat + bounds.maxLat) / 2, lon: (bounds.minLon + bounds.maxLon) / 2 };
}

/** Zoom at which everything fits, to a fraction rather than a whole level. */
function fitZoom(points: MapPoint[], tracks: MapTrack[], size: Size, fallback: number): number {
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

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

type SurfaceProps = {
  points: MapPoint[];
  tracks: MapTrack[];
  zoom: number;
  showTrack: boolean;
  activeIndex: number | null;
  onActiveChange: (index: number | null) => void;
};

export function OsmMap(props: SurfaceProps) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<CSSProperties>({});

  // Escape, and the browser/Android back button, both close the map. Pushing a
  // history entry is what makes back close the overlay instead of leaving the
  // page the reader was on.
  useEffect(() => {
    if (!open) return;

    window.history.pushState({ evmap: true }, '');
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
      if (window.history.state?.evmap) window.history.back();
    };
  }, [open]);

  /**
   * The overlay is portalled to document.body, outside the `.ev` element that
   * declares the event's palette. Without carrying the tokens across, every
   * `var(--ev-…)` in there resolves to nothing: text falls back to the body
   * colour and the route's stroke is dropped entirely.
   */
  const openFullscreen = useCallback(() => {
    const host = document.querySelector('.ev');
    if (host) {
      const computed = getComputedStyle(host);
      const carried: Record<string, string> = {};
      for (const token of THEME_TOKENS) {
        const value = computed.getPropertyValue(token).trim();
        if (value.length > 0) carried[token] = value;
      }
      setTheme(carried as CSSProperties);
    }
    setOpen(true);
  }, []);

  return (
    <>
      <MapSurface {...props} interactive={false} onOpen={openFullscreen} />
      {open
        ? createPortal(
            <div
              className="ev-map-overlay"
              style={theme}
              role="dialog"
              aria-modal="true"
              aria-label="Mapa na pełnym ekranie"
            >
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
  tracks,
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
  const zoomRafRef = useRef<number | null>(null);

  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [view, setView] = useState<View>(() => ({ zoom: initialZoom, center: centreOf(points, tracks) }));
  const [hint, setHint] = useState<string | null>(null);
  const [failedTiles, setFailedTiles] = useState<Set<string>>(() => new Set());

  const viewRef = useRef(view);
  const sizeRef = useRef(size);
  const pointsRef = useRef(points);
  viewRef.current = view;
  sizeRef.current = size;
  pointsRef.current = points;

  /** Every mutation goes through here, so viewRef can never fall behind. */
  const updateView = useCallback((updater: (current: View, size: Size) => View) => {
    setView((current) => {
      const next = updater(current, sizeRef.current);
      viewRef.current = next;
      return next;
    });
  }, []);

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
      if (zoomRafRef.current !== null) cancelAnimationFrame(zoomRafRef.current);
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
    const bounds = boundsOf(points, tracks);
    return bounds ? `${bounds.minLat},${bounds.minLon},${bounds.maxLat},${bounds.maxLon}` : 'empty';
  }, [points, tracks]);

  const fitToData = useCallback(() => {
    updateView((_, current) => {
      if (current.width <= 0 || current.height <= 0) return viewRef.current;
      const zoom = fitZoom(points, tracks, current, initialZoom);
      return { zoom, center: clampCenter(centreOf(points, tracks), zoom, current) };
    });
  }, [initialZoom, points, tracks, updateView]);

  // Refit on data or size change until the reader takes over, which keeps the
  // view correct through an orientation change or a window resize.
  useEffect(() => {
    if (touchedRef.current) return;
    fitToData();
  }, [dataKey, fitToData, size.height, size.width]);

  // ── Gestures ──────────────────────────────────────────────────────────────

  const localPoint = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const panByPixels = useCallback(
    (dx: number, dy: number) => {
      touchedRef.current = true;
      updateView((current, box) => {
        const origin = originOf(current, box);
        const center = unproject(
          { x: origin.x + box.width / 2 + dx, y: origin.y + box.height / 2 + dy },
          current.zoom
        );
        return { zoom: current.zoom, center: clampCenter(center, current.zoom, box) };
      });
    },
    [updateView]
  );

  /** Zooms by a fractional amount, holding the geography under the point still. */
  const zoomBy = useCallback(
    (delta: number, clientX: number, clientY: number) => {
      const local = localPoint(clientX, clientY);
      touchedRef.current = true;
      updateView((current, box) => {
        if (box.width <= 0) return current;
        const zoom = clampNumber(current.zoom + delta, minZoomFor(box), MAX_ZOOM);
        if (zoom === current.zoom) return current;
        const anchor = anchorAt(current, local.x, local.y, box);
        return { zoom, center: clampCenter(centerForAnchor(anchor, local.x, local.y, zoom, box), zoom, box) };
      });
    },
    [localPoint, updateView]
  );

  /**
   * Same, eased over a moment. Used where the zoom arrives in one jump — the
   * buttons, a double-click — so it reads as movement rather than a cut. The
   * anchor is captured once and re-honoured every frame, so a stepped zoom
   * holds its target exactly as a continuous one does.
   */
  const zoomStep = useCallback(
    (steps: number, clientX: number, clientY: number): LatLon | null => {
      const box = sizeRef.current;
      if (box.width <= 0) return null;

      if (zoomRafRef.current !== null) cancelAnimationFrame(zoomRafRef.current);

      const local = localPoint(clientX, clientY);
      const from = viewRef.current.zoom;
      const anchor = anchorAt(viewRef.current, local.x, local.y, box);
      const to = clampNumber(from + steps, minZoomFor(box), MAX_ZOOM);
      if (to === from) return anchor;

      touchedRef.current = true;
      const startedAt = performance.now();

      const frame = () => {
        const progress = clampNumber((performance.now() - startedAt) / STEP_ZOOM_MS, 0, 1);
        const zoom = from + (to - from) * easeOut(progress);

        updateView((_, current) => ({
          zoom,
          center: clampCenter(centerForAnchor(anchor, local.x, local.y, zoom, current), zoom, current)
        }));

        zoomRafRef.current = progress < 1 ? requestAnimationFrame(frame) : null;
      };

      zoomRafRef.current = requestAnimationFrame(frame);
      return anchor;
    },
    [localPoint, updateView]
  );

  const zoomAtCentre = useCallback(
    (steps: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      zoomStep(steps, rect.left + rect.width / 2, rect.top + rect.height / 2);
    },
    [zoomStep]
  );

  /** Names what sits under a screen position: a pin if one is close, else the spot. */
  const describePlace = useCallback(
    (clientX: number, clientY: number, anchor: LatLon | null): string => {
      const box = sizeRef.current;
      const local = localPoint(clientX, clientY);
      const origin = originOf(viewRef.current, box);

      let nearest: { label: string; distance: number } | null = null;
      for (const point of pointsRef.current) {
        const projected = project(point.lat, point.lon, viewRef.current.zoom);
        const distance = Math.hypot(projected.x - origin.x - local.x, projected.y - origin.y - local.y);
        if (distance <= PIN_HIT_PX && (nearest === null || distance < nearest.distance)) {
          nearest = { label: point.label, distance };
        }
      }
      if (nearest) return nearest.label;

      return anchor ? `${anchor.lat.toFixed(5)}, ${anchor.lon.toFixed(5)}` : '—';
    },
    [localPoint]
  );

  useEffect(() => {
    const element = containerRef.current;
    // The preview takes no gestures at all — that is what keeps the page
    // scrolling freely over it.
    if (!element || !interactive) return;

    let drag: { pointerId: number; lastX: number; lastY: number } | null = null;
    // Touch browsers synthesize a click/dblclick pair after a double-tap.
    let lastTouchAt = 0;

    const cancelZoomAnimation = () => {
      if (zoomRafRef.current !== null) {
        cancelAnimationFrame(zoomRafRef.current);
        zoomRafRef.current = null;
      }
    };

    // ── Mouse ───────────────────────────────────────────────────────────────
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || drag !== null) return;
      cancelZoomAnimation();
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
      if ((event.target as HTMLElement).closest('.ev-map-marker, .ev-map-controls, .ev-map-close')) return;

      event.preventDefault();
      event.stopPropagation();
      const anchor = zoomStep(event.shiftKey ? -1 : 1, event.clientX, event.clientY);
      showHint(
        `${event.shiftKey ? 'Oddalono' : 'Przybliżono'}: ${describePlace(event.clientX, event.clientY, anchor)}`
      );
    };

    // ── Wheel ───────────────────────────────────────────────────────────────
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      cancelZoomAnimation();
      // Continuous: a trackpad scrubs the zoom, a mouse notch moves ~1/4 level.
      zoomBy(clampNumber(-event.deltaY / WHEEL_PER_LEVEL, -1, 1), event.clientX, event.clientY);
    };

    // ── Touch ───────────────────────────────────────────────────────────────
    let panTouch: { x: number; y: number } | null = null;
    let pinch: { distance: number; midX: number; midY: number } | null = null;
    let tapStart: { x: number; y: number; at: number } | null = null;
    let lastTapAt = 0;
    let lastTapX = 0;
    let lastTapY = 0;

    const readPinch = (touches: TouchList) => ({
      distance: Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY
      ),
      midX: (touches[0].clientX + touches[1].clientX) / 2,
      midY: (touches[0].clientY + touches[1].clientY) / 2
    });

    const onTouchStart = (event: TouchEvent) => {
      event.stopPropagation();
      cancelZoomAnimation();
      lastTouchAt = performance.now();

      if (event.touches.length === 1) {
        const touch = event.touches[0];
        tapStart = { x: touch.clientX, y: touch.clientY, at: lastTouchAt };
        panTouch = { x: touch.clientX, y: touch.clientY };
        pinch = null;
      } else if (event.touches.length === 2) {
        tapStart = null;
        panTouch = null;
        pinch = readPinch(event.touches);
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

      if (event.touches.length === 2 && pinch) {
        const next = readPinch(event.touches);
        if (pinch.distance > 0 && next.distance > 0) {
          // Continuous: the zoom follows the finger spread exactly, and the
          // midpoint carries the pan so the gesture can do both at once.
          panByPixels(-(next.midX - pinch.midX), -(next.midY - pinch.midY));
          zoomBy(Math.log2(next.distance / pinch.distance), next.midX, next.midY);
        }
        pinch = next;
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      event.stopPropagation();
      lastTouchAt = performance.now();

      const finished = event.changedTouches[0];
      const start = tapStart;
      panTouch = null;
      pinch = null;
      tapStart = null;

      if (!finished || !start || event.touches.length > 0) return;
      if ((event.target as HTMLElement).closest('.ev-map-marker, .ev-map-controls, .ev-map-close')) return;

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
        const anchor = zoomStep(1, finished.clientX, finished.clientY);
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
  }, [describePlace, interactive, panByPixels, showHint, zoomBy, zoomStep]);

  // ── Painting ──────────────────────────────────────────────────────────────

  const origin = useMemo(() => originOf(view, size), [size, view]);

  /**
   * Tiles come from a whole zoom level and are drawn scaled to the live
   * fractional zoom, which is what lets the zoom move continuously without
   * refetching on every frame.
   *
   * One level only. A coarse fallback layer underneath did cover the gap while
   * tiles loaded, but upscaling it looked worse than the blank it replaced, so
   * the canvas simply shows white until the real tiles arrive.
   */
  const tiles = useMemo(() => {
    if (size.width <= 0 || size.height <= 0) return [];

    const floor = Math.ceil(minZoomFor(size));
    const tileZoom = clampNumber(Math.round(view.zoom), floor, MAX_ZOOM);
    const tilePx = TILE_SIZE * Math.pow(2, view.zoom - tileZoom);
    const count = Math.pow(2, tileZoom);

    const firstX = Math.floor(origin.x / tilePx);
    const lastX = Math.floor((origin.x + size.width) / tilePx);
    const firstY = Math.floor(origin.y / tilePx);
    const lastY = Math.floor((origin.y + size.height) / tilePx);

    const result: Array<{ key: string; url: string; left: number; top: number; size: number }> = [];
    for (let ty = firstY; ty <= lastY; ty += 1) {
      if (ty < 0 || ty >= count) continue;
      for (let tx = firstX; tx <= lastX; tx += 1) {
        // Wrap horizontally so panning past the antimeridian still paints.
        const wrappedX = ((tx % count) + count) % count;
        result.push({
          key: `${tileZoom}-${tx}-${ty}`,
          url: `https://tile.openstreetmap.org/${tileZoom}/${wrappedX}/${ty}.png`,
          left: tx * tilePx - origin.x,
          top: ty * tilePx - origin.y,
          // A hairline overlap hides the seams left by fractional positions.
          size: tilePx + 1
        });
      }
    }
    return result;
  }, [origin, size, view.zoom]);

  const screenPoints = useMemo(
    () =>
      points.map((point) => {
        const projected = project(point.lat, point.lon, view.zoom);
        return { point, x: projected.x - origin.x, y: projected.y - origin.y };
      }),
    [origin, points, view.zoom]
  );

  /**
   * One polyline per GPX track. With no tracks at all, a single line joining
   * the pins stands in, which is what a map with only points used to draw.
   */
  const routeLines = useMemo(() => {
    if (!showTrack) return [];

    const toScreen = (entries: Array<{ x: number; y: number }>) =>
      entries.map((entry) => `${entry.x.toFixed(1)},${entry.y.toFixed(1)}`).join(' ');

    if (tracks.length > 0) {
      return tracks
        .map((entry, index) => ({
          key: `${entry.name}-${index}`,
          color: entry.color ?? trackColor(index),
          points: toScreen(
            entry.points.map(([lat, lon]) => {
              const projected = project(lat, lon, view.zoom);
              return { x: projected.x - origin.x, y: projected.y - origin.y };
            })
          )
        }))
        .filter((entry) => entry.points.length > 0);
    }

    if (screenPoints.length > 1) {
      return [{ key: 'pins', color: trackColor(0), points: toScreen(screenPoints) }];
    }
    return [];
  }, [origin, screenPoints, showTrack, tracks, view.zoom]);

  return (
    <div
      className={`ev-map-canvas ${interactive ? 'is-full' : 'is-preview'}`}
      ref={containerRef}
      role={interactive ? 'application' : undefined}
      aria-label={interactive ? 'Mapa punktów trasy' : undefined}
    >
      <div className="ev-map-tiles">
        {tiles.map((tile) =>
          failedTiles.has(tile.key) ? null : (
            <img
              key={tile.key}
              src={tile.url}
              alt=""
              draggable={false}
              style={{
                left: `${tile.left}px`,
                top: `${tile.top}px`,
                width: `${tile.size}px`,
                height: `${tile.size}px`
              }}
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

      {routeLines.length > 0 ? (
        // No width/height attributes: CSS sizes it, and user space is CSS
        // pixels, so the lines cannot end up scaled or clipped to a stale box.
        <svg className="ev-map-track" aria-hidden="true">
          {/* Closed, the map behind is grey, so the route carries the picture:
              it gets a white casing and a heavier stroke. Open, the map is in
              colour again and the route steps back to a normal line. */}
          {interactive
            ? null
            : routeLines.map((line) => (
                <polyline
                  key={`casing-${line.key}`}
                  points={line.points}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={8}
                  strokeOpacity={0.85}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
          {routeLines.map((line) => (
            <polyline
              key={line.key}
              points={line.points}
              fill="none"
              stroke={line.color}
              strokeWidth={interactive ? 3 : 4.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={interactive ? 0.9 : 1}
            />
          ))}
        </svg>
      ) : null}

      <div className="ev-map-markers">
        {screenPoints.map((entry, index) => (
          <button
            key={index}
            type="button"
            className={`ev-map-marker ${entry.point.isStop ? 'is-stop' : ''} ${
              interactive && activeIndex === index ? 'is-open' : ''
            }`}
            style={{ left: `${entry.x}px`, top: `${entry.y}px` }}
            onClick={() => onActiveChange(activeIndex === index ? null : index)}
            aria-label={entry.point.label}
            tabIndex={interactive ? 0 : -1}
          >
            <span className="ev-map-dot" aria-hidden="true" />
            {interactive && activeIndex === index ? (
              <span className="ev-map-tip">
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
          <div className="ev-map-controls">
            <button type="button" onClick={() => zoomAtCentre(1)} disabled={view.zoom >= MAX_ZOOM} aria-label="Przybliż">
              +
            </button>
            <button
              type="button"
              onClick={() => zoomAtCentre(-1)}
              disabled={view.zoom <= minZoomFor(size) + 0.01}
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

          <button type="button" className="ev-map-close" onClick={onClose} aria-label="Zamknij mapę">
            ✕
          </button>

          {hint ? <p className="ev-map-hint">{hint}</p> : null}
        </>
      ) : (
        // One button covering the preview: any click or tap opens the map, and
        // it is reachable from the keyboard for free.
        <button type="button" className="ev-map-open" onClick={onOpen}>
          <span>Otwórz mapę</span>
        </button>
      )}

      {/* Required by the OpenStreetMap tile usage policy. */}
      <a
        className="ev-map-attribution"
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer noopener"
      >
        © OpenStreetMap contributors
      </a>
    </div>
  );
}
