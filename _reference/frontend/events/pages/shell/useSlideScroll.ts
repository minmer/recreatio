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
 * ── How a slide is left ──────────────────────────────────────────────────────
 * A slide's inner range, start → innerEnd, scrolls freely: that is reading.
 * Arriving at either end stops there, and a throw's inertia stops with it — no
 * amount of speed built up while reading will carry on into the next slide.
 *
 * Leaving is a separate, deliberate act. Once the track is already resting on
 * an edge, further scrolling stretches past it with rising resistance, up to a
 * peek of PEEK_MAX_FACTOR of a viewport, uncovering the top of the next slide
 * while the finger is still down so you can look before committing.
 *
 * That pull is held against the edge and accumulates across separate scrolls,
 * which is what lets a few notches of a mouse wheel add up to one departure.
 * A small pull springs back; a pull past PEEK_COMMIT_RATIO of the maximum, or
 * a flick faster than FLICK_COMMIT_VELOCITY made from the edge itself, carries
 * through. Since the peek is capped, one gesture can never reach past the
 * neighbouring slide.
 */

/** A slide is never shorter than the screen; content decides anything more. */
const MIN_VIEWPORT_FACTOR = 1;
const TRACK_INTERPOLATION = 0.24;
const WHEEL_CLAMP = 180;
/** Reading inside a slide covers ground faster than one notch of the wheel. */
const WHEEL_GAIN = 1.6;

/** How far past a slide's edge the track may be pulled, as a share of viewport. */
const PEEK_MAX_FACTOR = 0.3;
/** Share of that maximum which, once reached, commits instead of springing back. */
const PEEK_COMMIT_RATIO = 0.42;
/** A throw at least this fast (px/ms) commits regardless of how far it pulled. */
const FLICK_COMMIT_VELOCITY = 0.5;

/** Spring back to the slide you were on. */
const BOUNCE_MS = 300;
/** Carry through to the next slide. */
const SLIDE_TRANSITION_MS = 520;
/**
 * Wheel and keys have no release event. A pull that has already passed the
 * commit threshold goes at once; this is only the fallback for one that stopped
 * short and has to be sprung back.
 */
const RESOLVE_IDLE_MS = 120;
/** Breathing room after a committed move, so one burst cannot chain. */
const BOUNDARY_HOLD_MS = 90;
/**
 * How long a pull against an edge is remembered after it springs back. A mouse
 * wheel arrives as separate notches, so without this each one would peek, bounce
 * and throw its pull away, and no amount of scrolling would ever leave the
 * slide. Within this window successive scrolls the same way keep adding up.
 */
const PULL_MEMORY_MS = 1200;

/**
 * Inner travel below this is not worth scrolling through — a slide whose
 * content fits the screen has nothing to read on the way past, so its inner
 * range is treated as a single point.
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

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Rubber band: the first pixels of pull come through nearly whole, later ones
 * barely at all, approaching `max` without ever quite reaching it. That rising
 * resistance is what makes the edge feel like a physical stop you are stretching.
 */
function damp(raw: number, max: number): number {
  if (raw <= 0 || max <= 0) return 0;
  return (max * raw) / (raw + max);
}

function normalizeWheelDelta(event: WheelEvent): number {
  let delta = event.deltaY;
  if (event.deltaMode === 1) delta *= 16;
  else if (event.deltaMode === 2) delta *= Math.max(480, window.innerHeight * 0.85);
  return clamp(delta, -WHEEL_CLAMP, WHEEL_CLAMP) * WHEEL_GAIN;
}

export type SlideGeometry = {
  height: number;
  start: number;
  travel: number;
  /** 0 → 1 across the slide's own inner scroll. */
  progress: number;
  /**
   * 0 → 1 across the whole time the slide is on screen: from its top entering
   * at the bottom of the viewport, to its bottom leaving at the top.
   */
  visibleProgress: number;
};

type Slide = { start: number; innerEnd: number; shallow: boolean };
/** A pull past a slide edge that has not yet been resolved. */
type Peek = { index: number; direction: 1 | -1; raw: number };

export function useSlideScroll(slideCount: number) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRefs = useRef<Array<HTMLDivElement | null>>([]);
  const rafRef = useRef<number | null>(null);
  const settleRafRef = useRef<number | null>(null);
  const resolveTimerRef = useRef<number | null>(null);
  const tweenRef = useRef<{ from: number; to: number; start: number; duration: number } | null>(null);
  const slidesRef = useRef<Slide[]>([]);
  const peekRef = useRef<Peek | null>(null);
  /** Pull accumulated against one edge, surviving the springs back between scrolls. */
  const pullRef = useRef<{ index: number; direction: 1 | -1; raw: number; at: number } | null>(null);
  const gateUntilRef = useRef(0);
  const positionRef = useRef(0);
  const targetRef = useRef(0);
  const interpolationRef = useRef(TRACK_INTERPOLATION);
  const touchYRef = useRef<number | null>(null);
  const velocityRef = useRef(0);
  const lastTouchAtRef = useRef(0);
  const maxScrollRef = useRef(0);
  const viewportRefValue = useRef(1);

  const [viewportHeight, setViewportHeight] = useState(1);
  const [position, setPosition] = useState(0);
  const [contentHeights, setContentHeights] = useState<number[]>(() => new Array(slideCount).fill(0));

  viewportRefValue.current = viewportHeight;

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

  /** Timed ease — the spring back, and the move between slides. */
  const tweenTo = useCallback(
    (value: number, duration: number) => {
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
  }, []);

  const cancelResolveTimer = useCallback(() => {
    if (resolveTimerRef.current !== null) {
      window.clearTimeout(resolveTimerRef.current);
      resolveTimerRef.current = null;
    }
  }, []);

  // ── Peek and commit ───────────────────────────────────────────────────────

  /**
   * Applies `delta`, following past a slide edge with resistance rather than
   * stopping there. Only ever moves within the current slide plus its peek, so
   * one gesture cannot reach the slide after next.
   */
  /** Adds to the pull held against one edge, starting over if it went stale. */
  const rememberPull = useCallback((index: number, direction: 1 | -1, added: number): number => {
    const now = performance.now();
    const held = pullRef.current;
    const continues =
      held !== null && held.index === index && held.direction === direction && now - held.at <= PULL_MEMORY_MS;

    const raw = Math.max(0, (continues ? held.raw : 0) + added);
    pullRef.current = { index, direction, raw, at: now };
    return raw;
  }, []);

  const advance = useCallback(
    /**
     * `coasting` marks the call as a touch throw carrying on after release
     * rather than a hand actually driving. Momentum built up while reading is
     * not an intention to leave, so a coast never contributes to the pull.
     */
    (delta: number, coasting = false): 'moved' | 'edge' | 'peek' => {
      const slides = slidesRef.current;
      if (slides.length === 0) {
        setTarget(targetRef.current + delta);
        return 'moved';
      }

      const maxPeek = viewportRefValue.current * PEEK_MAX_FACTOR;
      const active = peekRef.current;

      // Already stretched: feed the pull, and let it be wound back to zero.
      if (active) {
        const slide = slides[active.index];
        if (!slide) {
          peekRef.current = null;
          return 'moved';
        }
        const edge = active.direction > 0 ? slide.innerEnd : slide.start;
        const raw = rememberPull(active.index, active.direction, delta * active.direction);
        active.raw = raw;

        if (raw <= 0) {
          // Wound all the way back — the reader changed their mind, so the
          // accumulation starts again from nothing.
          peekRef.current = null;
          pullRef.current = null;
          setTarget(edge);
          return 'moved';
        }
        setTarget(edge + active.direction * damp(raw, maxPeek));
        return 'peek';
      }

      const from = targetRef.current;
      let index = slides.findIndex((slide) => from <= slide.innerEnd + 0.5);
      if (index === -1) index = slides.length - 1;
      const slide = slides[index];

      const lowerBound = slide.shallow ? slide.start : Math.min(slide.start, slide.innerEnd);
      const upperBound = slide.shallow ? slide.start : slide.innerEnd;
      const to = from + delta;

      // Peeking is only offered where there is something to peek at, and only
      // once the track is already resting on the edge. Arriving at the edge
      // stops there instead — which is what keeps a throw made while reading
      // from spilling over into the next slide.
      if (to > upperBound && slides[index + 1]) {
        if (from < upperBound - 0.5) {
          setTarget(upperBound);
          // The part of the scroll that went past the edge is not thrown away:
          // it opens the pull. Discarding it meant that during a fast scroll —
          // where the track needs several frames to settle onto the edge — every
          // notch arriving in the meantime counted for nothing, and the page sat
          // still while the wheel kept turning.
          if (!coasting) rememberPull(index, 1, to - upperBound);
          return 'edge';
        }
        const raw = rememberPull(index, 1, delta);
        peekRef.current = { index, direction: 1, raw };
        setTarget(upperBound + damp(raw, maxPeek));
        return 'peek';
      }
      if (to < lowerBound && slides[index - 1]) {
        if (from > lowerBound + 0.5) {
          setTarget(lowerBound);
          if (!coasting) rememberPull(index, -1, lowerBound - to);
          return 'edge';
        }
        const raw = rememberPull(index, -1, -delta);
        peekRef.current = { index, direction: -1, raw };
        setTarget(lowerBound - damp(raw, maxPeek));
        return 'peek';
      }

      // Back inside the slide: any pull held against an edge is spent.
      pullRef.current = null;
      setTarget(clamp(to, lowerBound, upperBound));
      return 'moved';
    },
    [rememberPull, setTarget]
  );

  /**
   * Decides what an unresolved peek meant. `velocity` is the speed at release,
   * positive downwards — a hard flick commits even from a shallow pull.
   */
  const resolvePeek = useCallback(
    (velocity: number): boolean => {
      const peek = peekRef.current;
      if (!peek) return false;
      peekRef.current = null;

      const slides = slidesRef.current;
      const slide = slides[peek.index];
      if (!slide) return false;

      const maxPeek = viewportRefValue.current * PEEK_MAX_FACTOR;
      const edge = peek.direction > 0 ? slide.innerEnd : slide.start;
      const pulledFar = damp(peek.raw, maxPeek) >= maxPeek * PEEK_COMMIT_RATIO;
      const flicked = velocity * peek.direction >= FLICK_COMMIT_VELOCITY;

      const destination =
        peek.direction > 0 ? slides[peek.index + 1]?.start : slides[peek.index - 1]?.innerEnd;

      if ((pulledFar || flicked) && destination !== undefined) {
        pullRef.current = null; // spent — the next slide starts from zero
        tweenTo(destination, SLIDE_TRANSITION_MS);
        gateUntilRef.current = performance.now() + SLIDE_TRANSITION_MS + BOUNDARY_HOLD_MS;
        return true;
      }

      // Springs back, but takes no gate: a scroll arriving mid-bounce has to be
      // able to interrupt it and keep building on the pull already held, or the
      // notches of a mouse wheel would cancel each other out forever.
      tweenTo(edge, BOUNCE_MS);
      pullRef.current = { index: peek.index, direction: peek.direction, raw: peek.raw, at: performance.now() };
      return false;
    },
    [tweenTo]
  );

  const applyDelta = useCallback(
    (delta: number) => {
      if (!Number.isFinite(delta) || delta === 0) return;
      // Mid-commit or mid-bounce: swallow input rather than queue it.
      if (performance.now() < gateUntilRef.current) return;
      advance(delta);
    },
    [advance]
  );

  /** True once the pull held against the edge is already enough to leave. */
  const peekWouldCommit = useCallback((): boolean => {
    const peek = peekRef.current;
    if (!peek) return false;
    const maxPeek = viewportRefValue.current * PEEK_MAX_FACTOR;
    return damp(peek.raw, maxPeek) >= maxPeek * PEEK_COMMIT_RATIO;
  }, []);

  /**
   * What a wheel or a key does after moving the track.
   *
   * A finger reports its release, so a touch peek can wait for it — that is what
   * makes looking at the next slide and pulling back possible. A wheel never
   * releases, so it used to wait for the burst to go quiet instead, and the
   * timer restarted on every notch. Scrolling continuously therefore never
   * resolved anything: the track stalled against the edge for as long as you
   * kept scrolling, and only moved on once you stopped. Once the pull is past
   * the threshold the answer is already known, so take it now and leave the
   * idle timer for the case it was meant for — a pull that stopped short.
   */
  const resolveDriven = useCallback(() => {
    if (peekWouldCommit()) {
      cancelResolveTimer();
      resolvePeek(0);
      return;
    }
    cancelResolveTimer();
    resolveTimerRef.current = window.setTimeout(() => {
      resolveTimerRef.current = null;
      resolvePeek(0);
    }, RESOLVE_IDLE_MS);
  }, [cancelResolveTimer, peekWouldCommit, resolvePeek]);

  /**
   * Carries a throw on after the finger lifts, but only within the slide. The
   * coast ends the moment it meets an edge: momentum built up while reading is
   * not an intention to leave, so it stops there rather than spilling over.
   */
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

        const outcome = advance(velocity * frameMs, true);
        if (outcome !== 'moved') {
          settleRafRef.current = null;
          // A coast that ran onto an edge it was already resting on opens a
          // peek that nothing would ever resolve — the finger is long gone and
          // there is no idle timer on the touch path. Spring it back now.
          if (outcome === 'peek') resolvePeek(0);
          return;
        }

        settleRafRef.current = requestAnimationFrame(step);
      };

      settleRafRef.current = requestAnimationFrame(step);
    },
    [advance, resolvePeek, stopSettle]
  );

  const scrollToSlide = useCallback(
    (index: number) => {
      stopSettle();
      cancelResolveTimer();
      peekRef.current = null;
      pullRef.current = null;
      gateUntilRef.current = performance.now() + SLIDE_TRANSITION_MS;
      tweenTo(slidesRef.current[index]?.start ?? 0, SLIDE_TRANSITION_MS);
    },
    [cancelResolveTimer, stopSettle, tweenTo]
  );

  const scrollToTop = useCallback(() => {
    stopSettle();
    cancelResolveTimer();
    peekRef.current = null;
    pullRef.current = null;
    tweenRef.current = null;
    gateUntilRef.current = 0;
    positionRef.current = 0;
    targetRef.current = 0;
    setPosition(0);
  }, [cancelResolveTimer, stopSettle]);

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
      resolveDriven();
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 0) return;
      stopSettle();
      cancelResolveTimer();
      touchYRef.current = event.touches[0].clientY;
      lastTouchAtRef.current = performance.now();
      velocityRef.current = 0;
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
      const velocity = stale ? 0 : velocityRef.current;
      velocityRef.current = 0;

      // A peek held open when the finger lifted is a deliberate attempt to
      // leave, and its speed counts. Anything else is just reading, and only
      // coasts within the slide.
      if (peekRef.current) resolvePeek(velocity);
      else startSettle(velocity);
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
  }, [applyDelta, cancelResolveTimer, resolvePeek, resolveDriven, startSettle, stopSettle]);

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
        resolveDriven();
      } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        stopSettle();
        applyDelta(-page);
        resolveDriven();
      } else if (event.key === 'Home') {
        event.preventDefault();
        stopSettle();
        cancelResolveTimer();
        peekRef.current = null;
        pullRef.current = null;
        gateUntilRef.current = performance.now() + SLIDE_TRANSITION_MS;
        tweenTo(0, SLIDE_TRANSITION_MS);
      } else if (event.key === 'End') {
        event.preventDefault();
        stopSettle();
        cancelResolveTimer();
        peekRef.current = null;
        pullRef.current = null;
        gateUntilRef.current = performance.now() + SLIDE_TRANSITION_MS;
        tweenTo(maxScroll, SLIDE_TRANSITION_MS);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [applyDelta, cancelResolveTimer, maxScroll, resolveDriven, stopSettle, tweenTo, viewportHeight]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (settleRafRef.current !== null) cancelAnimationFrame(settleRafRef.current);
      if (resolveTimerRef.current !== null) window.clearTimeout(resolveTimerRef.current);
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
