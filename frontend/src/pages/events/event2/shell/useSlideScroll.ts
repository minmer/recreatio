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

  const applyDelta = useCallback(
    (delta: number) => {
      if (!Number.isFinite(delta) || delta === 0) return;
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
      setTarget(geometry[index]?.start ?? 0, JUMP_INTERPOLATION);
    },
    [geometry, setTarget, stopFling]
  );

  const scrollToTop = useCallback(() => {
    stopFling();
    positionRef.current = 0;
    targetRef.current = 0;
    setPosition(0);
  }, [stopFling]);

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
      applyDelta(delta);
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
      // A drag that ended in a pause should not throw.
      if (performance.now() - lastTouchAtRef.current > 90) {
        velocityRef.current = 0;
        return;
      }
      startFling();
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
  }, [applyDelta, stopFling]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Typing a space in a form field must reach the field, not scroll.
      if (ownsKeyboardInput(event.target)) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      const page = viewportHeight * 0.82;
      if (event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        applyDelta(page);
      } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        applyDelta(-page);
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
  }, [applyDelta, maxScroll, setTarget, viewportHeight]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (flingRafRef.current !== null) cancelAnimationFrame(flingRafRef.current);
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
