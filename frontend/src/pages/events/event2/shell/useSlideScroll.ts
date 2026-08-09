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

// Magnetic settle. Once input stops, the track eases onto a slide boundary —
// but only one that lies AHEAD in the direction the reader was already moving,
// and only from within a reach measured against the viewport rather than the
// slide's own travel. Two consequences, both deliberate:
//   · a short slide completes its transition as soon as you nudge it;
//   · part-way down a long slide the next boundary is far, so nothing fires,
//     and a settle can never drag the reader back against their own scroll.
// The tiny backward tolerance only cleans up an overshoot of a few pixels.
const SNAP_IDLE_MS = 130;
const SNAP_INTERPOLATION = 0.12;
const SNAP_FORWARD_REACH = 0.34;
const SNAP_BACKWARD_REACH = 0.06;
const WHEEL_CLAMP = 180;
const FLING_FRICTION = 0.94;
const FLING_MIN_VELOCITY = 0.04;
const FLING_MAX_VELOCITY = 3.2;
const VELOCITY_SMOOTHING = 0.72;

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
  progress: number;
};

export function useSlideScroll(slideCount: number) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRefs = useRef<Array<HTMLDivElement | null>>([]);
  const rafRef = useRef<number | null>(null);
  const flingRafRef = useRef<number | null>(null);
  const snapTimerRef = useRef<number | null>(null);
  const snapPointsRef = useRef<number[]>([]);
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
    setContentHeights((previous) =>
      Array.from({ length: slideCount }, (_, index) => previous[index] ?? 0)
    );
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
      result.push({
        height,
        start,
        travel,
        progress: travel > 0 ? clamp((position - start) / travel, 0, 1) : 0
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

  // Slide starts, plus the very bottom so the last slide can settle on its end.
  useEffect(() => {
    const points = geometry.map((slide) => slide.start);
    if (maxScroll > 0) points.push(maxScroll);
    snapPointsRef.current = points;
  }, [geometry, maxScroll]);

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

  const cancelSnap = useCallback(() => {
    if (snapTimerRef.current !== null) {
      window.clearTimeout(snapTimerRef.current);
      snapTimerRef.current = null;
    }
  }, []);

  /** Eases onto the nearest boundary, but only from close range. */
  const scheduleSnap = useCallback(() => {
    cancelSnap();
    snapTimerRef.current = window.setTimeout(() => {
      snapTimerRef.current = null;

      const points = snapPointsRef.current;
      if (points.length === 0 || viewportHeight <= 1) return;

      const from = targetRef.current;
      const direction = directionRef.current;
      const forwardReach = viewportHeight * SNAP_FORWARD_REACH;
      const backwardReach = viewportHeight * SNAP_BACKWARD_REACH;

      let best: number | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const point of points) {
        const offset = point - from;
        const distance = Math.abs(offset);
        if (distance < 1) return; // already settled on a boundary

        // Ahead means "further along the way the reader was going".
        const isAhead = direction === 0 ? false : Math.sign(offset) === direction;
        const reach = isAhead ? forwardReach : backwardReach;
        if (distance > reach) continue;

        if (distance < bestDistance) {
          best = point;
          bestDistance = distance;
        }
      }

      if (best === null) return;

      interpolationRef.current = SNAP_INTERPOLATION;
      targetRef.current = clamp(best, 0, maxScroll);
      animate();
    }, SNAP_IDLE_MS);
  }, [animate, cancelSnap, maxScroll, viewportHeight]);

  const applyDelta = useCallback(
    (delta: number) => {
      if (!Number.isFinite(delta) || delta === 0) return;
      directionRef.current = delta > 0 ? 1 : -1;
      setTarget(targetRef.current + delta);
    },
    [setTarget]
  );

  const stopFling = useCallback(() => {
    if (flingRafRef.current !== null) {
      cancelAnimationFrame(flingRafRef.current);
      flingRafRef.current = null;
    }
    velocityRef.current = 0;
  }, []);

  const scrollToSlide = useCallback(
    (index: number) => {
      stopFling();
      // Already landing on a boundary — a settle pass would only fight it.
      cancelSnap();
      setTarget(geometry[index]?.start ?? 0, JUMP_INTERPOLATION);
    },
    [cancelSnap, geometry, setTarget, stopFling]
  );

  const scrollToTop = useCallback(() => {
    stopFling();
    cancelSnap();
    positionRef.current = 0;
    targetRef.current = 0;
    setPosition(0);
  }, [cancelSnap, stopFling]);

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
      stopFling();
      cancelSnap();
      applyDelta(delta);
      scheduleSnap();
    };

    const startFling = () => {
      let velocity = clamp(velocityRef.current, -FLING_MAX_VELOCITY, FLING_MAX_VELOCITY);
      velocityRef.current = 0;
      if (Math.abs(velocity) < FLING_MIN_VELOCITY) return;

      let lastFrameAt = performance.now();
      const step = () => {
        const now = performance.now();
        const frameMs = Math.min(now - lastFrameAt, 48);
        lastFrameAt = now;

        velocity *= Math.pow(FLING_FRICTION, frameMs / 16.67);
        const delta = velocity * frameMs;
        if (Math.abs(velocity) < FLING_MIN_VELOCITY || Math.abs(delta) < 0.1) {
          flingRafRef.current = null;
          // The coast has run out — let it settle onto a boundary.
          scheduleSnap();
          return;
        }

        const before = targetRef.current;
        applyDelta(delta);
        if (Math.abs(targetRef.current - before) < 0.05) {
          // Clamped at an end — nothing left to coast into.
          flingRafRef.current = null;
          return;
        }

        flingRafRef.current = requestAnimationFrame(step);
      };

      flingRafRef.current = requestAnimationFrame(step);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 0) return;
      stopFling();
      cancelSnap();
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
      // A drag that ended in a pause should not throw — settle straight away.
      if (performance.now() - lastTouchAtRef.current > 90) {
        velocityRef.current = 0;
        scheduleSnap();
        return;
      }
      startFling();
      // A flick too weak to coast still deserves a settle.
      if (flingRafRef.current === null) scheduleSnap();
    };

    viewport.addEventListener('wheel', onWheel, { passive: false });
    viewport.addEventListener('touchstart', onTouchStart, { passive: true });
    viewport.addEventListener('touchmove', onTouchMove, { passive: false });
    viewport.addEventListener('touchend', onTouchEnd, { passive: true });
    viewport.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      stopFling();
      viewport.removeEventListener('wheel', onWheel);
      viewport.removeEventListener('touchstart', onTouchStart);
      viewport.removeEventListener('touchmove', onTouchMove);
      viewport.removeEventListener('touchend', onTouchEnd);
      viewport.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [applyDelta, cancelSnap, scheduleSnap, stopFling]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Typing a space in a form field must reach the field, not scroll.
      if (ownsKeyboardInput(event.target)) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      const page = viewportHeight * 0.82;
      if (event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        cancelSnap();
        applyDelta(page);
        scheduleSnap();
      } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        cancelSnap();
        applyDelta(-page);
        scheduleSnap();
      } else if (event.key === 'Home') {
        event.preventDefault();
        setTarget(0, JUMP_INTERPOLATION);
      } else if (event.key === 'End') {
        event.preventDefault();
        setTarget(maxScroll, JUMP_INTERPOLATION);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [applyDelta, cancelSnap, maxScroll, scheduleSnap, setTarget, viewportHeight]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (flingRafRef.current !== null) cancelAnimationFrame(flingRafRef.current);
      if (snapTimerRef.current !== null) window.clearTimeout(snapTimerRef.current);
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
