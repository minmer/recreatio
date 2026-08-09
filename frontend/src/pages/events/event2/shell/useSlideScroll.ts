import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

/**
 * The scroll engine. Not native scrolling — the track is translated with
 * transform, which is what lets background layers move at their own rate.
 *
 * Geometry, and the reason for it:
 *   slideHeight = max(measured content height, viewport × MIN_VIEWPORT_FACTOR)
 *   travel      = slideHeight − viewport
 * The floor guarantees travel > 0 even on a slide whose content fits one
 * screen, so a tall background always has room to slide.
 *
 * For a layer of speed s:
 *   height = viewport + travel × s
 *   offset = (1 − s) × progress × travel
 * At s = 1 that is height = slideHeight and offset = 0, i.e. content scrolling
 * normally. At s = 0 the layer is pinned to the viewport. Because height and
 * offset come from the same travel, a layer covers the viewport at every
 * progress value and can never gap.
 */

const MIN_VIEWPORT_FACTOR = 1.05;
const TRACK_INTERPOLATION = 0.16;
const JUMP_INTERPOLATION = 0.09;
const WHEEL_CLAMP = 180;

// ── Settling ─────────────────────────────────────────────────────────────────
// When a gesture ends, two forces act on the track at the same time: the
// inertia of the throw, and a magnet pulling the nearest slide boundary out of
// the viewport. Inertia decides where the reader is heading; the magnet makes
// sure they land somewhere legal. Because the magnetic term is proportional to
// the distance remaining, it approaches asymptotically and can never overshoot
// or oscillate — as inertia decays the magnet quietly takes over.
const FLING_FRICTION = 0.94;
const FLING_MIN_VELOCITY = 0.04;
const FLING_MAX_VELOCITY = 3.2;
const VELOCITY_SMOOTHING = 0.72;
/** Share of the remaining distance the magnet closes per frame. */
const MAGNET_GAIN = 0.19;
/** Wheel and keys have no throw of their own — let the burst finish first. */
const SETTLE_IDLE_MS = 85;
/** Nudges the dead-band midpoint toward the way the reader was already going. */
const SNAP_DIRECTION_BIAS = 0.15;
/**
 * How close to a slide's top or bottom counts as "resting on it". From there a
 * nudge onward commits to the neighbouring slide rather than leaving the track
 * parked a few pixels off. Scrolling down from a slide's *top* is exempt — on a
 * long slide that means reading its content, not leaving it.
 */
const COMMIT_FACTOR = 0.06;

const KEY_CONSUMING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'BUTTON', 'A', 'SUMMARY']);

/** True when the focused element needs the key more than the page does. */
function ownsKeyboardInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return KEY_CONSUMING_TAGS.has(target.tagName);
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function normalizeWheelDelta(event: WheelEvent): number {
  let delta = event.deltaY;
  if (event.deltaMode === 1) delta *= 16;
  else if (event.deltaMode === 2) delta *= Math.max(480, window.innerHeight * 0.85);
  return clamp(delta, -WHEEL_CLAMP, WHEEL_CLAMP);
}

export type SlideGeometry = {
  height: number;
  start: number;
  travel: number;
  /** 0 → 1 across the slide's own inner scroll. Drives the parallax layers. */
  progress: number;
  /**
   * 0 → 1 across the whole time the slide is on screen: from its top entering
   * at the bottom of the viewport, to its bottom leaving at the top. Spans the
   * transitions in and out, not just the inner scroll.
   */
  visibleProgress: number;
};

export function useSlideScroll(slideCount: number) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRefs = useRef<Array<HTMLDivElement | null>>([]);
  const rafRef = useRef<number | null>(null);
  const settleRafRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const boundariesRef = useRef<number[]>([]);
  const slidesRef = useRef<Array<{ start: number; innerEnd: number }>>([]);
  const directionRef = useRef<-1 | 0 | 1>(0);
  const positionRef = useRef(0);
  const targetRef = useRef(0);
  const interpolationRef = useRef(TRACK_INTERPOLATION);
  const touchYRef = useRef<number | null>(null);
  const velocityRef = useRef(0);
  const lastTouchAtRef = useRef(0);

  const [viewportHeight, setViewportHeight] = useState(1);
  const [position, setPosition] = useState(0);
  const [contentHeights, setContentHeights] = useState<number[]>(() => new Array(slideCount).fill(0));

  useEffect(() => {
    setContentHeights((previous) => Array.from({ length: slideCount }, (_, index) => previous[index] ?? 0));
    contentRefs.current = contentRefs.current.slice(0, slideCount);
  }, [slideCount]);

  // ── Geometry ──────────────────────────────────────────────────────────────

  const minSlideHeight = Math.max(1, viewportHeight * MIN_VIEWPORT_FACTOR);

  const geometry = useMemo<SlideGeometry[]>(() => {
    const result: SlideGeometry[] = [];
    let start = 0;
    for (let index = 0; index < slideCount; index += 1) {
      const height = Math.max(contentHeights[index] ?? 0, minSlideHeight);
      const travel = Math.max(0, height - viewportHeight);
      const onScreenRange = height + viewportHeight;
      result.push({
        height,
        start,
        travel,
        progress: travel > 0 ? clamp((position - start) / travel, 0, 1) : 0,
        visibleProgress: clamp((position - start + viewportHeight) / onScreenRange, 0, 1)
      });
      start += height;
    }
    return result;
  }, [contentHeights, minSlideHeight, position, slideCount, viewportHeight]);

  const totalHeight = geometry.reduce((sum, slide) => sum + slide.height, 0);
  const maxScroll = Math.max(0, totalHeight - viewportHeight);

  const activeIndex = useMemo(() => {
    const probe = position + viewportHeight * 0.4;
    for (let index = geometry.length - 1; index >= 0; index -= 1) {
      if (probe >= geometry[index].start) return index;
    }
    return 0;
  }, [geometry, position, viewportHeight]);

  // Boundaries between slides. The first slide's start is not one — there is
  // nothing above it to be split from — and the track end is a clamp.
  useEffect(() => {
    boundariesRef.current = geometry.slice(1).map((slide) => slide.start);
    slidesRef.current = geometry.map((slide) => ({
      start: slide.start,
      innerEnd: slide.start + slide.travel
    }));
  }, [geometry]);

  // ── Measurement ───────────────────────────────────────────────────────────

  useLayoutEffect(() => {
    const update = () => setViewportHeight(viewportRef.current?.clientHeight ?? window.innerHeight);
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  useLayoutEffect(() => {
    const measure = () => {
      setContentHeights((previous) => {
        let changed = false;
        const next = Array.from({ length: slideCount }, (_, index) => {
          const height = contentRefs.current[index]?.scrollHeight ?? 0;
          if (Math.abs((previous[index] ?? 0) - height) > 0.5) changed = true;
          return height;
        });
        return changed ? next : previous;
      });
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(measure);
    for (const element of contentRefs.current) {
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [slideCount, viewportHeight]);

  // ── Animation ─────────────────────────────────────────────────────────────

  const animate = useCallback(() => {
    if (rafRef.current !== null) return;

    const tick = () => {
      const current = positionRef.current;
      const delta = targetRef.current - current;

      if (Math.abs(delta) < 0.25) {
        positionRef.current = targetRef.current;
        setPosition(targetRef.current);
        rafRef.current = null;
        return;
      }

      const next = current + delta * interpolationRef.current;
      positionRef.current = next;
      setPosition(next);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const setTarget = useCallback(
    (value: number, interpolation: number = TRACK_INTERPOLATION) => {
      interpolationRef.current = interpolation;
      targetRef.current = clamp(value, 0, maxScroll);
      animate();
    },
    [animate, maxScroll]
  );

  const stopSettle = useCallback(() => {
    if (settleRafRef.current !== null) {
      cancelAnimationFrame(settleRafRef.current);
      settleRafRef.current = null;
    }
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    velocityRef.current = 0;
  }, []);

  /**
   * Where the track must end up so no slide boundary is left hanging inside
   * the viewport, or null when none is. A slide is at least 1.05 viewports
   * tall, so at most one boundary can ever be straddled.
   */
  const resolveMagnet = useCallback(
    (from: number, direction: -1 | 0 | 1): number | null => {
      if (viewportHeight <= 1) return null;

      // 1. A boundary hanging inside the viewport is never a legal rest.
      const straddled = boundariesRef.current.find(
        (boundary) => boundary > from + 0.5 && boundary < from + viewportHeight - 0.5
      );
      if (straddled !== undefined) {
        const advance = straddled; // boundary lifted to the top of the viewport
        const retreat = straddled - viewportHeight; // boundary pushed past the bottom
        const midpoint = retreat + viewportHeight * (0.5 - direction * SNAP_DIRECTION_BIAS);
        return from >= midpoint ? advance : retreat;
      }

      if (direction === 0) return null;

      // 2. Resting on a slide's edge and pushing onward. Without this, a small
      // scroll from a settled slide moved a few pixels and was left there,
      // because the next boundary is a whole viewport away and rule 1 could
      // not see it yet.
      const slides = slidesRef.current;
      const index = slides.findIndex(
        (slide, position) =>
          from >= slide.start - 0.5 &&
          (position === slides.length - 1 || from < slides[position + 1].start)
      );
      if (index === -1) return null;

      const slide = slides[index];
      const commit = viewportHeight * COMMIT_FACTOR;

      // At the bottom, heading down → the next slide's top.
      if (direction > 0 && from >= slide.innerEnd - commit) {
        const next = slides[index + 1];
        if (next) return next.start;
      }

      // At the top, heading up → the previous slide's bottom. Going *down* from
      // a top is left alone: on a long slide that is reading, not leaving.
      if (direction < 0 && from <= slide.start + commit) {
        const previous = slides[index - 1];
        if (previous) return previous.innerEnd;
      }

      return null;
    },
    [viewportHeight]
  );

  /**
   * Runs inertia and magnetism together until both are spent. Drives the
   * target; the interpolation loop above carries the visible track to it, so
   * the motion matches how a live drag already feels.
   */
  const startSettle = useCallback(
    (initialVelocity: number) => {
      stopSettle();

      let velocity = clamp(initialVelocity, -FLING_MAX_VELOCITY, FLING_MAX_VELOCITY);
      // Hold the gesture's direction for the whole settle, so the magnet's own
      // pull can never flip the bias mid-flight.
      const direction = directionRef.current;
      let lastFrameAt = performance.now();

      const step = () => {
        const now = performance.now();
        const frameMs = Math.min(now - lastFrameAt, 48);
        lastFrameAt = now;
        const scale = frameMs / 16.67;

        velocity *= Math.pow(FLING_FRICTION, scale);

        let next = targetRef.current + velocity * frameMs;
        const magnet = resolveMagnet(next, direction);
        if (magnet !== null) {
          next += (magnet - next) * MAGNET_GAIN * scale;
        }

        const clamped = clamp(next, 0, maxScroll);
        if (clamped !== next) velocity = 0;

        targetRef.current = clamped;
        interpolationRef.current = TRACK_INTERPOLATION;
        animate();

        const coasting = Math.abs(velocity) >= FLING_MIN_VELOCITY;
        const pulling = magnet !== null && Math.abs(magnet - clamped) >= 0.5;

        if (!coasting && !pulling) {
          settleRafRef.current = null;
          return;
        }
        settleRafRef.current = requestAnimationFrame(step);
      };

      settleRafRef.current = requestAnimationFrame(step);
    },
    [animate, maxScroll, resolveMagnet, stopSettle]
  );

  /** For inputs with no throw of their own: settle once the burst goes quiet. */
  const scheduleSettle = useCallback(() => {
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null;
      startSettle(0);
    }, SETTLE_IDLE_MS);
  }, [startSettle]);

  const applyDelta = useCallback(
    (delta: number) => {
      if (!Number.isFinite(delta) || delta === 0) return;
      directionRef.current = delta > 0 ? 1 : -1;
      setTarget(targetRef.current + delta);
    },
    [setTarget]
  );

  const scrollToSlide = useCallback(
    (index: number) => {
      // Already landing on a boundary — a settle would only fight it.
      stopSettle();
      setTarget(geometry[index]?.start ?? 0, JUMP_INTERPOLATION);
    },
    [geometry, setTarget, stopSettle]
  );

  const scrollToTop = useCallback(() => {
    stopSettle();
    positionRef.current = 0;
    targetRef.current = 0;
    setPosition(0);
  }, [stopSettle]);

  useEffect(() => {
    if (targetRef.current > maxScroll) setTarget(maxScroll);
  }, [maxScroll, setTarget]);

  // ── Input ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
      const delta = normalizeWheelDelta(event);
      if (Math.abs(delta) < 0.01) return;
      event.preventDefault();
      stopSettle();
      applyDelta(delta);
      scheduleSettle();
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 0) return;
      stopSettle();
      touchYRef.current = event.touches[0].clientY;
      lastTouchAtRef.current = performance.now();
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 0 || touchYRef.current === null) return;
      const nextY = event.touches[0].clientY;
      const delta = touchYRef.current - nextY;
      touchYRef.current = nextY;

      const now = performance.now();
      const elapsed = now - lastTouchAtRef.current;
      lastTouchAtRef.current = now;
      if (elapsed > 0 && elapsed < 100) {
        // Smooth the samples so one jittery frame cannot define the throw.
        velocityRef.current = velocityRef.current * VELOCITY_SMOOTHING + (delta / elapsed) * (1 - VELOCITY_SMOOTHING);
      }

      event.preventDefault();
      applyDelta(delta);
    };

    const onTouchEnd = () => {
      touchYRef.current = null;
      // A drag that ended in a pause has no throw left — settle on magnetism
      // alone rather than on a stale velocity reading.
      const stale = performance.now() - lastTouchAtRef.current > 90;
      startSettle(stale ? 0 : velocityRef.current);
      velocityRef.current = 0;
    };

    viewport.addEventListener('wheel', onWheel, { passive: false });
    viewport.addEventListener('touchstart', onTouchStart, { passive: true });
    viewport.addEventListener('touchmove', onTouchMove, { passive: false });
    viewport.addEventListener('touchend', onTouchEnd, { passive: true });
    viewport.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      stopSettle();
      viewport.removeEventListener('wheel', onWheel);
      viewport.removeEventListener('touchstart', onTouchStart);
      viewport.removeEventListener('touchmove', onTouchMove);
      viewport.removeEventListener('touchend', onTouchEnd);
      viewport.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [applyDelta, scheduleSettle, startSettle, stopSettle]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Typing a space in a form field must reach the field, not scroll.
      if (ownsKeyboardInput(event.target)) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      const page = viewportHeight * 0.82;
      if (event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        stopSettle();
        applyDelta(page);
        scheduleSettle();
      } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        stopSettle();
        applyDelta(-page);
        scheduleSettle();
      } else if (event.key === 'Home') {
        event.preventDefault();
        stopSettle();
        setTarget(0, JUMP_INTERPOLATION);
      } else if (event.key === 'End') {
        event.preventDefault();
        stopSettle();
        setTarget(maxScroll, JUMP_INTERPOLATION);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [applyDelta, maxScroll, scheduleSettle, setTarget, stopSettle, viewportHeight]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (settleRafRef.current !== null) cancelAnimationFrame(settleRafRef.current);
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    },
    []
  );

  return {
    viewportRef,
    contentRefs,
    viewportHeight,
    position,
    geometry,
    activeIndex,
    scrollToSlide,
    scrollToTop
  };
}
