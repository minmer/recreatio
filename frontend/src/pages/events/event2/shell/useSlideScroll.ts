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
 * ── How the track is allowed to move ─────────────────────────────────────────
 * The track lives in segments. A slide's inner range, start → innerEnd, is one
 * segment and scrolls freely: that is reading. Between one slide's innerEnd and
 * the next slide's start lies a gap a whole viewport wide, where the screen
 * would show the tail of one slide and the head of the next; that gap is never
 * entered, it is crossed in a single move.
 *
 * Every input is clamped to the current segment, so no gesture — however hard
 * the flick — can cross more than one edge. On reaching an edge the track holds
 * there for BOUNDARY_HOLD_MS and ignores further input, so a continuous scroll
 * pauses at the end of each slide instead of running through several.
 *
 * Because the track can never come to rest inside the gap, there is nothing for
 * a magnet to correct; clamping replaced it.
 */

const MIN_VIEWPORT_FACTOR = 1.05;
const TRACK_INTERPOLATION = 0.16;
const JUMP_INTERPOLATION = 0.09;
const WHEEL_CLAMP = 180;

/** Pause on reaching a slide edge, during which input is ignored. */
const BOUNDARY_HOLD_MS = 200;
/**
 * Crossing between slides is a timed, eased move rather than the exponential
 * chase used for free scrolling. An exponential starts at its fastest and
 * decays, which on a jump of a whole viewport reads as a snap; a fixed
 * duration with ease-in-out makes every transition the same deliberate length.
 */
const SLIDE_TRANSITION_MS = 560;

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
/**
 * Inner travel below this is not worth stopping in — a slide whose content
 * fits the screen has nothing to read on the way past, so its inner range is
 * treated as a single point rather than a segment to scroll through.
 */
const SHALLOW_TRAVEL_FACTOR = 0.15;

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
  /** 0 → 1 across the slide's own inner scroll. */
  progress: number;
  /**
   * 0 → 1 across the whole time the slide is on screen: from its top entering
   * at the bottom of the viewport, to its bottom leaving at the top. Spans the
   * transitions in and out, not just the inner scroll.
   */
  visibleProgress: number;
};

type Slide = { start: number; innerEnd: number; shallow: boolean };

export function useSlideScroll(slideCount: number) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRefs = useRef<Array<HTMLDivElement | null>>([]);
  const rafRef = useRef<number | null>(null);
  const settleRafRef = useRef<number | null>(null);
  const slidesRef = useRef<Slide[]>([]);
  const gateUntilRef = useRef(0);
  const tweenRef = useRef<{ from: number; to: number; start: number; duration: number } | null>(null);
  /** Set once a touch drag has moved the track off a slide; cleared on the next touch. */
  const gestureSpentRef = useRef(false);
  const positionRef = useRef(0);
  const targetRef = useRef(0);
  const interpolationRef = useRef(TRACK_INTERPOLATION);
  const touchYRef = useRef<number | null>(null);
  const velocityRef = useRef(0);
  const lastTouchAtRef = useRef(0);
  const maxScrollRef = useRef(0);

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
      result.push({
        height,
        start,
        travel,
        progress: travel > 0 ? clamp((position - start) / travel, 0, 1) : 0,
        visibleProgress: clamp((position - start + viewportHeight) / (height + viewportHeight), 0, 1)
      });
      start += height;
    }
    return result;
  }, [contentHeights, minSlideHeight, position, slideCount, viewportHeight]);

  const totalHeight = geometry.reduce((sum, slide) => sum + slide.height, 0);
  const maxScroll = Math.max(0, totalHeight - viewportHeight);
  maxScrollRef.current = maxScroll;

  const activeIndex = useMemo(() => {
    const probe = position + viewportHeight * 0.4;
    for (let index = geometry.length - 1; index >= 0; index -= 1) {
      if (probe >= geometry[index].start) return index;
    }
    return 0;
  }, [geometry, position, viewportHeight]);

  useEffect(() => {
    const shallowBelow = viewportHeight * SHALLOW_TRAVEL_FACTOR;
    slidesRef.current = geometry.map((slide) => ({
      start: slide.start,
      innerEnd: slide.start + slide.travel,
      shallow: slide.travel < shallowBelow
    }));
  }, [geometry, viewportHeight]);

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
      const tween = tweenRef.current;

      if (tween) {
        const progress = clamp((performance.now() - tween.start) / tween.duration, 0, 1);
        const next = tween.from + (tween.to - tween.from) * easeInOut(progress);
        positionRef.current = next;
        setPosition(next);

        if (progress >= 1) {
          tweenRef.current = null;
          rafRef.current = null;
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

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

  /** Exponential chase — responsive, used while a finger or wheel is driving. */
  const setTarget = useCallback(
    (value: number, interpolation: number = TRACK_INTERPOLATION) => {
      tweenRef.current = null;
      interpolationRef.current = interpolation;
      targetRef.current = clamp(value, 0, maxScrollRef.current);
      animate();
    },
    [animate]
  );

  /** Timed ease — used for the move between one slide and the next. */
  const tweenTo = useCallback(
    (value: number, duration: number = SLIDE_TRANSITION_MS) => {
      const to = clamp(value, 0, maxScrollRef.current);
      targetRef.current = to;
      tweenRef.current = { from: positionRef.current, to, start: performance.now(), duration };
      animate();
    },
    [animate]
  );

  const stopSettle = useCallback(() => {
    if (settleRafRef.current !== null) {
      cancelAnimationFrame(settleRafRef.current);
      settleRafRef.current = null;
    }
    velocityRef.current = 0;
  }, []);

  const hold = useCallback(() => {
    gateUntilRef.current = performance.now() + BOUNDARY_HOLD_MS;
    stopSettle();
  }, [stopSettle]);

  /**
   * Moves the track by `delta`, never past the end of the segment it is in.
   * Returns true when the move landed on an edge, which is the caller's cue
   * that the track has come to a stop.
   */
  const advance = useCallback(
    (delta: number): boolean => {
      const slides = slidesRef.current;
      if (slides.length === 0) {
        setTarget(targetRef.current + delta);
        return false;
      }

      const from = targetRef.current;
      const forward = delta > 0;

      // Which slide's inner range are we in? The gap between two slides is not
      // a place to be, so a position inside one resolves straight to its edge.
      let index = slides.findIndex((slide) => from <= slide.innerEnd + 0.5);
      if (index === -1) index = slides.length - 1;
      const slide = slides[index];

      if (from < slide.start - 0.5) {
        // In the gap above this slide: leave it in one move.
        const previous = slides[index - 1];
        setTarget(forward ? slide.start : (previous?.innerEnd ?? 0), JUMP_INTERPOLATION);
        return true;
      }

      // A slide with nothing to scroll through is one point, not a segment.
      const atStart = slide.shallow || from <= slide.start + 0.5;
      const atEnd = slide.shallow || from >= slide.innerEnd - 0.5;

      if (forward && atEnd) {
        const next = slides[index + 1];
        setTarget(next ? next.start : maxScrollRef.current, JUMP_INTERPOLATION);
        return true;
      }
      if (!forward && atStart) {
        const previous = slides[index - 1];
        setTarget(previous ? previous.innerEnd : 0, JUMP_INTERPOLATION);
        return true;
      }

      // Free movement inside the slide, stopping at whichever end it reaches.
      const to = clamp(from + delta, slide.start, slide.innerEnd);
      setTarget(to);
      return to <= slide.start + 0.5 || to >= slide.innerEnd - 0.5;
    },
    [setTarget]
  );

  const applyDelta = useCallback(
    (delta: number): boolean => {
      if (!Number.isFinite(delta) || delta === 0) return false;
      // Still holding at an edge: swallow the input rather than queue it, so a
      // continuous scroll resumes from rest instead of lurching onward.
      if (performance.now() < gateUntilRef.current) return false;

      const stopped = advance(delta);
      if (stopped) hold();
      return stopped;
    },
    [advance, hold]
  );

  /** Carries the throw on after a finger lifts, under the same clamping. */
  const startSettle = useCallback(
    (initialVelocity: number) => {
      stopSettle();

      let velocity = clamp(initialVelocity, -FLING_MAX_VELOCITY, FLING_MAX_VELOCITY);
      if (Math.abs(velocity) < FLING_MIN_VELOCITY) return;

      let lastFrameAt = performance.now();

      const step = () => {
        const now = performance.now();
        const frameMs = Math.min(now - lastFrameAt, 48);
        lastFrameAt = now;

        velocity *= Math.pow(FLING_FRICTION, frameMs / 16.67);
        if (Math.abs(velocity) < FLING_MIN_VELOCITY) {
          settleRafRef.current = null;
          return;
        }

        // An edge ends the coast: one gesture, one slide.
        if (applyDelta(velocity * frameMs)) {
          settleRafRef.current = null;
          return;
        }

        settleRafRef.current = requestAnimationFrame(step);
      };

      settleRafRef.current = requestAnimationFrame(step);
    },
    [applyDelta, stopSettle]
  );

  const scrollToSlide = useCallback(
    (index: number) => {
      stopSettle();
      gateUntilRef.current = 0;
      setTarget(slidesRef.current[index]?.start ?? 0, JUMP_INTERPOLATION);
    },
    [setTarget, stopSettle]
  );

  const scrollToTop = useCallback(() => {
    stopSettle();
    gateUntilRef.current = 0;
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
      // A drag that ended in a pause has no throw left.
      const stale = performance.now() - lastTouchAtRef.current > 90;
      if (!stale) startSettle(velocityRef.current);
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
  }, [applyDelta, startSettle, stopSettle]);

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
      } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        stopSettle();
        applyDelta(-page);
      } else if (event.key === 'Home') {
        event.preventDefault();
        stopSettle();
        gateUntilRef.current = 0;
        setTarget(0, JUMP_INTERPOLATION);
      } else if (event.key === 'End') {
        event.preventDefault();
        stopSettle();
        gateUntilRef.current = 0;
        setTarget(maxScroll, JUMP_INTERPOLATION);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [applyDelta, maxScroll, setTarget, stopSettle, viewportHeight]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (settleRafRef