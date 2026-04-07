import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LanguageSelect } from '../../../components/LanguageSelect';
import { AuthAction } from '../../../components/AuthAction';
import type { EventDefinition, SharedEventPageProps } from '../eventTypes';
import '../../../styles/event-single-page-template.css';

export type EventTemplateSlideAction = {
  label: string;
  href?: string;
  targetSlideId?: string;
  onClick?: () => void;
  variant?: 'primary' | 'ghost';
};

export type EventTemplateSlideLayer = {
  id: string;
  content: ReactNode;
  className?: string;
  interactive?: boolean;
  minHeightPx?: number;
};

export type EventTemplateSlide = {
  id: string;
  menuLabel: string;
  title: string;
  kicker?: string;
  description?: string;
  body?: ReactNode;
  actions?: EventTemplateSlideAction[];
  layers?: EventTemplateSlideLayer[];
  heightMode?: 'screen' | 'content';
  tone?: 'tone-1' | 'tone-2' | 'tone-3' | 'tone-4' | 'tone-5';
};

const SNAP_IDLE_MS = 110;
const SNAP_DIRECTIONAL_THRESHOLD = 0.22;
const SCROLL_SENSITIVITY = 1.16;
const INPUT_SESSION_GAP_MS = 180;
const INTERNAL_TRACK_INTERPOLATION = 0.2;
const SLIDE_TRANSITION_INTERPOLATION = 0.08;
const WHEEL_SLIDE_JUMP_THRESHOLD = 88;
const TOUCH_SLIDE_JUMP_THRESHOLD = 44;
const SNAP_INPUT_LOCK_MS = 220;
const MIDDLE_SNAP_THRESHOLD_MS = 140;
const MIDDLE_SCROLL_DEADZONE_PX = 10;
const MIDDLE_SCROLL_GAIN = 0.082;
const MIDDLE_SCROLL_MAX_DELTA = 34;

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function nearest(values: number[], target: number): number {
  if (values.length === 0) return target;
  let winner = values[0];
  let best = Math.abs(values[0] - target);
  for (let index = 1; index < values.length; index += 1) {
    const delta = Math.abs(values[index] - target);
    if (delta < best) {
      best = delta;
      winner = values[index];
    }
  }
  return winner;
}

function normalizeWheelDelta(event: WheelEvent): number {
  let delta = event.deltaY;
  if (event.deltaMode === 1) {
    delta *= 16;
  } else if (event.deltaMode === 2) {
    delta *= Math.max(480, window.innerHeight * 0.85);
  }
  return clamp(delta, -180, 180);
}

export function EventSinglePageTemplate({
  copy,
  language,
  onLanguageChange,
  onAuthAction,
  authLabel,
  showProfileMenu,
  onProfileNavigate,
  onToggleSecureMode,
  onLogout,
  secureMode,
  onNavigate,
  event,
  slides
}: SharedEventPageProps & {
  event: EventDefinition;
  slides: EventTemplateSlide[];
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const layerRefs = useRef<Array<Array<HTMLDivElement | null>>>([]);
  const touchYRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const snapTimerRef = useRef<number | null>(null);
  const lastInputDirectionRef = useRef<-1 | 0 | 1>(0);
  const lastInputAtRef = useRef(0);
  const inputLockUntilRef = useRef(0);
  const burstTransitionUsedRef = useRef(false);
  const burstTransitionDirectionRef = useRef<-1 | 0 | 1>(0);
  const burstAccumulatedDeltaRef = useRef(0);
  const boundaryGateRef = useRef<{ slideIndex: number; direction: -1 | 1 } | null>(null);
  const middleScrollActiveRef = useRef(false);
  const middleScrollAnchorYRef = useRef(0);
  const middleScrollPointerYRef = useRef(0);
  const middleScrollRafRef = useRef<number | null>(null);
  const middleSnapDelayRef = useRef<number | null>(null);
  const interpolationRef = useRef(INTERNAL_TRACK_INTERPOLATION);
  const positionRef = useRef(0);
  const targetRef = useRef(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [middleScrollActive, setMiddleScrollActive] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(1);
  const [position, setPosition] = useState(0);
  const [slideHeights, setSlideHeights] = useState<number[]>(() => slides.map(() => 1));
  const [layerHeights, setLayerHeights] = useState<number[][]>(() => slides.map(() => [1]));

  const slideStarts = useMemo(() => {
    const starts: number[] = [];
    let total = 0;
    for (const height of slideHeights) {
      starts.push(total);
      total += height;
    }
    return starts;
  }, [slideHeights]);

  const totalHeight = useMemo(() => slideHeights.reduce((sum, value) => sum + value, 0), [slideHeights]);
  const maxScroll = Math.max(0, totalHeight - viewportHeight);
  const slideIndexById = useMemo(() => {
    const map = new Map<string, number>();
    slides.forEach((slide, index) => map.set(slide.id, index));
    return map;
  }, [slides]);

  const snapPoints = useMemo(() => {
    const points = new Set<number>();
    for (let index = 0; index < slideHeights.length; index += 1) {
      const start = slideStarts[index] ?? 0;
      points.add(start);
      const withinSlide = Math.max(0, slideHeights[index] - viewportHeight);
      if (withinSlide > 0) {
        points.add(start + withinSlide);
      }
    }
    points.add(maxScroll);
    return Array.from(points).sort((left, right) => left - right);
  }, [maxScroll, slideHeights, slideStarts, viewportHeight]);

  const resolveSnapTarget = useCallback((current: number, direction: -1 | 0 | 1): number => {
    if (snapPoints.length === 0) {
      return current;
    }
    if (direction === 0) {
      return nearest(snapPoints, current);
    }

    let lower = snapPoints[0];
    let upper = snapPoints[snapPoints.length - 1];
    for (let index = 0; index < snapPoints.length; index += 1) {
      const point = snapPoints[index];
      if (point <= current) {
        lower = point;
      }
      if (point >= current) {
        upper = point;
        break;
      }
    }

    if (upper === lower) {
      return upper;
    }

    const progress = clamp((current - lower) / (upper - lower), 0, 1);
    if (direction > 0) {
      return progress >= SNAP_DIRECTIONAL_THRESHOLD ? upper : lower;
    }
    return progress <= 1 - SNAP_DIRECTIONAL_THRESHOLD ? lower : upper;
  }, [snapPoints]);

  const getSlideIndexForPosition = useCallback((value: number): number => {
    const center = value + viewportHeight * 0.5;
    for (let index = 0; index < slideHeights.length; index += 1) {
      const start = slideStarts[index] ?? 0;
      const end = start + slideHeights[index];
      if (center >= start && center < end) {
        return index;
      }
    }
    return Math.max(0, slideHeights.length - 1);
  }, [slideHeights, slideStarts, viewportHeight]);

  const activeSlideIndex = useMemo(
    () => getSlideIndexForPosition(position),
    [getSlideIndexForPosition, position]
  );

  const stopAnimation = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const animateToTarget = useCallback(() => {
    if (rafRef.current !== null) {
      return;
    }
    const tick = () => {
      const current = positionRef.current;
      const target = targetRef.current;
      const delta = target - current;

      if (Math.abs(delta) < 0.25) {
        positionRef.current = target;
        setPosition(target);
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

  const setTarget = useCallback((value: number, interpolation: number = INTERNAL_TRACK_INTERPOLATION) => {
    interpolationRef.current = interpolation;
    targetRef.current = clamp(value, 0, maxScroll);
    animateToTarget();
  }, [animateToTarget, maxScroll]);

  const lockInputAfterSnap = useCallback(() => {
    inputLockUntilRef.current = performance.now() + SNAP_INPUT_LOCK_MS;
  }, []);

  const snapToNearest = useCallback(() => {
    const snap = resolveSnapTarget(targetRef.current, lastInputDirectionRef.current);
    setTarget(snap, SLIDE_TRANSITION_INTERPOLATION);
    lockInputAfterSnap();
    lastInputDirectionRef.current = 0;
  }, [lockInputAfterSnap, resolveSnapTarget, setTarget]);

  const scheduleSnap = useCallback(() => {
    if (snapTimerRef.current !== null) {
      window.clearTimeout(snapTimerRef.current);
    }
    snapTimerRef.current = window.setTimeout(() => {
      snapTimerRef.current = null;
      snapToNearest();
    }, SNAP_IDLE_MS);
  }, [snapToNearest]);

  const stopMiddleScroll = useCallback((withSnap: boolean) => {
    if (!middleScrollActiveRef.current) {
      return;
    }
    middleScrollActiveRef.current = false;
    setMiddleScrollActive(false);
    if (middleScrollRafRef.current !== null) {
      cancelAnimationFrame(middleScrollRafRef.current);
      middleScrollRafRef.current = null;
    }
    if (withSnap) {
      if (middleSnapDelayRef.current !== null) {
        window.clearTimeout(middleSnapDelayRef.current);
      }
      middleSnapDelayRef.current = window.setTimeout(() => {
        middleSnapDelayRef.current = null;
        snapToNearest();
      }, MIDDLE_SNAP_THRESHOLD_MS);
    }
  }, [snapToNearest]);

  const applyDelta = useCallback((delta: number, inputType: 'wheel' | 'touch' = 'wheel') => {
    if (!Number.isFinite(delta) || delta === 0) {
      return;
    }
    if (middleSnapDelayRef.current !== null) {
      window.clearTimeout(middleSnapDelayRef.current);
      middleSnapDelayRef.current = null;
    }
    const now = performance.now();
    if (now < inputLockUntilRef.current) {
      return;
    }
    if (snapTimerRef.current !== null) {
      window.clearTimeout(snapTimerRef.current);
      snapTimerRef.current = null;
    }

    const isNewBurst = now - lastInputAtRef.current > INPUT_SESSION_GAP_MS;
    if (isNewBurst) {
      burstTransitionUsedRef.current = false;
      burstTransitionDirectionRef.current = 0;
      burstAccumulatedDeltaRef.current = 0;
    }
    lastInputAtRef.current = now;
    const direction: -1 | 1 = delta > 0 ? 1 : -1;
    if (
      !isNewBurst
      && burstTransitionUsedRef.current
      && burstTransitionDirectionRef.current !== 0
      && direction !== burstTransitionDirectionRef.current
    ) {
      // Allow immediate "return" in the same gesture burst when user reverses direction.
      burstTransitionUsedRef.current = false;
      burstTransitionDirectionRef.current = 0;
      burstAccumulatedDeltaRef.current = 0;
      boundaryGateRef.current = null;
    }
    const animatedFromIndex = getSlideIndexForPosition(positionRef.current);
    const animatedToIndex = getSlideIndexForPosition(targetRef.current);
    const isCrossSlideAnimationActive =
      rafRef.current !== null && animatedFromIndex !== animatedToIndex;
    if (
      inputType !== 'touch'
      &&
      !isNewBurst
      && isCrossSlideAnimationActive
      && burstTransitionDirectionRef.current !== 0
      && direction === burstTransitionDirectionRef.current
    ) {
      // Ignore same-direction momentum while snapping between slides.
      // This keeps touchpad bursts from perturbing active snap motion.
      lastInputDirectionRef.current = direction;
      return;
    }

    const scaled = delta * SCROLL_SENSITIVITY;
    const internalInterpolation = inputType === 'touch' ? 0.34 : INTERNAL_TRACK_INTERPOLATION;
    burstAccumulatedDeltaRef.current += scaled;
    const slideJumpThreshold = inputType === 'touch'
      ? TOUCH_SLIDE_JUMP_THRESHOLD
      : WHEEL_SLIDE_JUMP_THRESHOLD;
    const boundaryNeedsNewBurst = inputType !== 'touch';
    const current = inputType === 'touch' ? positionRef.current : targetRef.current;
    const slideIndex = getSlideIndexForPosition(current);
    const slideStart = slideStarts[slideIndex] ?? 0;
    const slideHeight = slideHeights[slideIndex] ?? viewportHeight;
    const slideInnerEnd = slideStart + Math.max(0, slideHeight - viewportHeight);
    const hasInnerScroll = slideInnerEnd > slideStart + 0.5;

    if (hasInnerScroll && direction > 0) {
      if (current < slideInnerEnd - 0.5) {
        const next = Math.min(slideInnerEnd, current + Math.max(0, scaled));
        setTarget(next, internalInterpolation);
        if (next >= slideInnerEnd - 0.5) {
          boundaryGateRef.current = { slideIndex, direction };
        } else {
          boundaryGateRef.current = null;
        }
        lastInputDirectionRef.current = direction;
        return;
      }

      const gate = boundaryGateRef.current;
      if (!gate || gate.slideIndex !== slideIndex || gate.direction !== direction) {
        boundaryGateRef.current = { slideIndex, direction };
        setTarget(slideInnerEnd, internalInterpolation);
        lastInputDirectionRef.current = direction;
        return;
      }
      const canCrossSlideFromBoundary = boundaryNeedsNewBurst
        ? isNewBurst && !burstTransitionUsedRef.current
        : Math.abs(burstAccumulatedDeltaRef.current) >= slideJumpThreshold && !burstTransitionUsedRef.current;
      if (!canCrossSlideFromBoundary) {
        setTarget(slideInnerEnd, internalInterpolation);
        lastInputDirectionRef.current = direction;
        return;
      }

      burstTransitionUsedRef.current = true;
      burstTransitionDirectionRef.current = direction;
      burstAccumulatedDeltaRef.current = 0;
      boundaryGateRef.current = null;
      lastInputDirectionRef.current = direction;
      const nextIndex = Math.min(slideIndex + 1, slides.length - 1);
      const nextStart = slideStarts[nextIndex] ?? 0;
      const point = nextIndex === slides.length - 1 ? maxScroll : nextStart;
      setTarget(point, SLIDE_TRANSITION_INTERPOLATION);
      lockInputAfterSnap();
      return;
    }

    if (hasInnerScroll && direction < 0) {
      if (current > slideStart + 0.5) {
        const next = Math.max(slideStart, current + Math.min(0, scaled));
        setTarget(next, internalInterpolation);
        if (next <= slideStart + 0.5) {
          boundaryGateRef.current = { slideIndex, direction };
        } else {
          boundaryGateRef.current = null;
        }
        lastInputDirectionRef.current = direction;
        return;
      }

      const gate = boundaryGateRef.current;
      if (!gate || gate.slideIndex !== slideIndex || gate.direction !== direction) {
        boundaryGateRef.current = { slideIndex, direction };
        setTarget(slideStart, internalInterpolation);
        lastInputDirectionRef.current = direction;
        return;
      }
      const canCrossSlideFromBoundary = boundaryNeedsNewBurst
        ? isNewBurst && !burstTransitionUsedRef.current
        : Math.abs(burstAccumulatedDeltaRef.current) >= slideJumpThreshold && !burstTransitionUsedRef.current;
      if (!canCrossSlideFromBoundary) {
        setTarget(slideStart, internalInterpolation);
        lastInputDirectionRef.current = direction;
        return;
      }

      burstTransitionUsedRef.current = true;
      burstTransitionDirectionRef.current = direction;
      burstAccumulatedDeltaRef.current = 0;
      boundaryGateRef.current = null;
      lastInputDirectionRef.current = direction;
      const previousIndex = Math.max(slideIndex - 1, 0);
      const previousStart = slideStarts[previousIndex] ?? 0;
      const previousHeight = slideHeights[previousIndex] ?? viewportHeight;
      const previousInnerEnd = previousStart + Math.max(0, previousHeight - viewportHeight);
      setTarget(previousInnerEnd, SLIDE_TRANSITION_INTERPOLATION);
      lockInputAfterSnap();
      return;
    }

    if (burstTransitionUsedRef.current && !isNewBurst) {
      lastInputDirectionRef.current = direction;
      return;
    }
    if (Math.abs(burstAccumulatedDeltaRef.current) < slideJumpThreshold) {
      lastInputDirectionRef.current = direction;
      return;
    }

    burstTransitionUsedRef.current = true;
    burstTransitionDirectionRef.current = direction;
    burstAccumulatedDeltaRef.current = 0;
    boundaryGateRef.current = null;
    lastInputDirectionRef.current = direction;
    const nextIndex = clamp(slideIndex + direction, 0, slides.length - 1);
    if (direction < 0 && nextIndex < slideIndex) {
      const previousStart = slideStarts[nextIndex] ?? 0;
      const previousHeight = slideHeights[nextIndex] ?? viewportHeight;
      const previousInnerEnd = previousStart + Math.max(0, previousHeight - viewportHeight);
      setTarget(previousInnerEnd, SLIDE_TRANSITION_INTERPOLATION);
    } else {
      const nextStart = slideStarts[nextIndex] ?? 0;
      const point = direction > 0 && nextIndex === slides.length - 1
        ? maxScroll
        : nextStart;
      setTarget(point, SLIDE_TRANSITION_INTERPOLATION);
    }
    lockInputAfterSnap();
  }, [
    getSlideIndexForPosition,
    lockInputAfterSnap,
    maxScroll,
    setTarget,
    slideHeights,
    slideStarts,
    slides.length,
    viewportHeight
  ]);

  const jumpToSlide = useCallback((index: number) => {
    const point = slideStarts[index] ?? 0;
    lastInputDirectionRef.current = 0;
    lastInputAtRef.current = 0;
    burstTransitionUsedRef.current = false;
    burstTransitionDirectionRef.current = 0;
    burstAccumulatedDeltaRef.current = 0;
    boundaryGateRef.current = null;
    setTarget(point, SLIDE_TRANSITION_INTERPOLATION);
    lockInputAfterSnap();
    scheduleSnap();
    setMenuOpen(false);
  }, [lockInputAfterSnap, scheduleSnap, setTarget, slideStarts]);

  const renderDefaultLayerContent = useCallback((slide: EventTemplateSlide) => (
    <div className="event-template-slide-inner">
      {slide.kicker ? <p className="event-template-kicker">{slide.kicker}</p> : null}
      <h1 className="event-template-title">{slide.title}</h1>
      {slide.description ? <p className="event-template-description">{slide.description}</p> : null}
      {slide.body ? <div className="event-template-body">{slide.body}</div> : null}
      {slide.actions?.length ? (
        <div className="event-template-actions">
          {slide.actions.map((action) => {
            if (action.href) {
              return (
                <a
                  key={`${slide.id}-${action.label}`}
                  className={`cta ${action.variant === 'ghost' ? 'ghost' : ''}`}
                  href={action.href}
                >
                  {action.label}
                </a>
              );
            }
            if (action.targetSlideId) {
              return (
                <button
                  key={`${slide.id}-${action.label}`}
                  type="button"
                  className={`cta ${action.variant === 'ghost' ? 'ghost' : ''}`}
                  onClick={() => {
                    const nextIndex = slideIndexById.get(action.targetSlideId ?? '');
                    if (typeof nextIndex === 'number') {
                      jumpToSlide(nextIndex);
                    }
                  }}
                >
                  {action.label}
                </button>
              );
            }
            return (
              <button
                key={`${slide.id}-${action.label}`}
                type="button"
                className={`cta ${action.variant === 'ghost' ? 'ghost' : ''}`}
                onClick={action.onClick}
              >
                {action.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  ), [jumpToSlide, slideIndexById]);

  const resolveSlideLayers = useCallback((slide: EventTemplateSlide): EventTemplateSlideLayer[] => {
    if (slide.layers?.length) {
      return slide.layers;
    }
    return [
      {
        id: `${slide.id}-content`,
        content: renderDefaultLayerContent(slide),
        className: 'event-template-slide-content-layer',
        interactive: true
      }
    ];
  }, [renderDefaultLayerContent]);

  useLayoutEffect(() => {
    const measure = () => {
      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }
      const nextViewportHeight = Math.max(1, viewport.clientHeight);
      setViewportHeight(nextViewportHeight);

      layerRefs.current.length = slides.length;

      const nextResolvedLayers = slides.map((slide) => resolveSlideLayers(slide));

      const nextLayerHeights = slides.map((_, slideIndex) => {
        const resolvedLayers = nextResolvedLayers[slideIndex];
        if (!layerRefs.current[slideIndex]) {
          layerRefs.current[slideIndex] = [];
        }
        layerRefs.current[slideIndex].length = resolvedLayers.length;
        return resolvedLayers.map((layer, layerIndex) => {
          const node = layerRefs.current[slideIndex][layerIndex];
          const measuredHeight = node?.scrollHeight ?? nextViewportHeight;
          return Math.max(1, layer.minHeightPx ?? 0, measuredHeight);
        });
      });

      const nextSlideHeights = slides.map((slide, index) => {
        if (slide.heightMode !== 'content') {
          return nextViewportHeight;
        }

        const layersForSlide = nextLayerHeights[index] ?? [nextViewportHeight];
        const tallestLayer = layersForSlide.reduce(
          (winner, height) => Math.max(winner, height),
          nextViewportHeight
        );
        return Math.max(nextViewportHeight, tallestLayer);
      });

      setLayerHeights((previous) => {
        const isSame =
          previous.length === nextLayerHeights.length
          && previous.every((previousLayerHeights, slideIndex) => {
            const nextForSlide = nextLayerHeights[slideIndex] ?? [];
            return previousLayerHeights.length === nextForSlide.length
              && previousLayerHeights.every(
                (value, layerIndex) => Math.abs(value - nextForSlide[layerIndex]) < 0.5
              );
          });
        return isSame ? previous : nextLayerHeights;
      });

      setSlideHeights((previous) => {
        if (
          previous.length === nextSlideHeights.length
          && previous.every((value, index) => Math.abs(value - nextSlideHeights[index]) < 0.5)
        ) {
          return previous;
        }
        return nextSlideHeights;
      });
    };

    measure();
    const frame = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
    };
  }, [resolveSlideLayers, slides]);

  useEffect(() => {
    const clamped = clamp(positionRef.current, 0, maxScroll);
    if (Math.abs(clamped - positionRef.current) < 0.25 && Math.abs(targetRef.current - clamped) < 0.25) {
      return;
    }
    positionRef.current = clamped;
    targetRef.current = clamp(targetRef.current, 0, maxScroll);
    setPosition(clamped);
    animateToTarget();
  }, [animateToTarget, maxScroll]);

  useEffect(() => {
    const onWheelCapture = (event: WheelEvent) => {
      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Node) || !viewport.contains(target)) {
        return;
      }
      if (event.ctrlKey) {
        return;
      }
      const normalizedDelta = normalizeWheelDelta(event);
      if (Math.abs(normalizedDelta) < 0.01) {
        return;
      }
      event.preventDefault();
      applyDelta(normalizedDelta);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 0) {
        return;
      }
      touchYRef.current = event.touches[0].clientY;
      lastInputAtRef.current = 0;
      burstTransitionUsedRef.current = false;
      burstTransitionDirectionRef.current = 0;
      burstAccumulatedDeltaRef.current = 0;
      boundaryGateRef.current = null;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 0 || touchYRef.current === null) {
        return;
      }
      const nextY = event.touches[0].clientY;
      const delta = touchYRef.current - nextY;
      touchYRef.current = nextY;
      event.preventDefault();
      applyDelta(delta, 'touch');
    };

    const onTouchEnd = () => {
      touchYRef.current = null;
      scheduleSnap();
    };

    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    window.addEventListener('wheel', onWheelCapture, { passive: false, capture: true });
    viewport.addEventListener('touchstart', onTouchStart, { passive: true });
    viewport.addEventListener('touchmove', onTouchMove, { passive: false });
    viewport.addEventListener('touchend', onTouchEnd, { passive: true });
    viewport.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('wheel', onWheelCapture, { capture: true });
      viewport.removeEventListener('touchstart', onTouchStart);
      viewport.removeEventListener('touchmove', onTouchMove);
      viewport.removeEventListener('touchend', onTouchEnd);
      viewport.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [applyDelta, scheduleSnap]);

  useEffect(() => {
    const tickMiddleScroll = () => {
      if (!middleScrollActiveRef.current) {
        middleScrollRafRef.current = null;
        return;
      }
      const offset = middleScrollPointerYRef.current - middleScrollAnchorYRef.current;
      const absOffset = Math.abs(offset);
      if (absOffset > MIDDLE_SCROLL_DEADZONE_PX) {
        const signedMagnitude = offset > 0 ? absOffset - MIDDLE_SCROLL_DEADZONE_PX : -(absOffset - MIDDLE_SCROLL_DEADZONE_PX);
        const delta = clamp(signedMagnitude * MIDDLE_SCROLL_GAIN, -MIDDLE_SCROLL_MAX_DELTA, MIDDLE_SCROLL_MAX_DELTA);
        if (Math.abs(delta) > 0.01) {
          applyDelta(delta, 'wheel');
        }
      }
      middleScrollRafRef.current = requestAnimationFrame(tickMiddleScroll);
    };

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 1) {
        return;
      }
      if (middleScrollActiveRef.current) {
        event.preventDefault();
        stopMiddleScroll(true);
        return;
      }
      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Node) || !viewport.contains(target)) {
        return;
      }
      const targetElement = target instanceof Element ? target : null;
      const blockingInteractive = targetElement?.closest(
        'a,button,input,textarea,select,label,[role="button"],[contenteditable="true"]'
      );
      if (blockingInteractive) {
        return;
      }
      event.preventDefault();
      middleScrollActiveRef.current = true;
      middleScrollAnchorYRef.current = event.clientY;
      middleScrollPointerYRef.current = event.clientY;
      setMiddleScrollActive(true);
      if (middleSnapDelayRef.current !== null) {
        window.clearTimeout(middleSnapDelayRef.current);
        middleSnapDelayRef.current = null;
      }

      lastInputAtRef.current = 0;
      burstTransitionUsedRef.current = false;
      burstTransitionDirectionRef.current = 0;
      burstAccumulatedDeltaRef.current = 0;
      boundaryGateRef.current = null;
      lastInputDirectionRef.current = 0;

      if (middleScrollRafRef.current === null) {
        middleScrollRafRef.current = requestAnimationFrame(tickMiddleScroll);
      }
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!middleScrollActiveRef.current) {
        return;
      }
      middleScrollPointerYRef.current = event.clientY;
    };

    const onMouseUp = (event: MouseEvent) => {
      if (event.button !== 1) {
        return;
      }
      stopMiddleScroll(true);
    };

    const onWindowBlur = () => {
      stopMiddleScroll(true);
    };

    window.addEventListener('mousedown', onMouseDown, { passive: false });
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseup', onMouseUp, { passive: true });
    window.addEventListener('blur', onWindowBlur);

    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('blur', onWindowBlur);
      if (middleScrollRafRef.current !== null) {
        cancelAnimationFrame(middleScrollRafRef.current);
        middleScrollRafRef.current = null;
      }
      if (middleSnapDelayRef.current !== null) {
        window.clearTimeout(middleSnapDelayRef.current);
        middleSnapDelayRef.current = null;
      }
      middleScrollActiveRef.current = false;
      setMiddleScrollActive(false);
    };
  }, [applyDelta, stopMiddleScroll]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
      if (event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        applyDelta(viewportHeight * 0.72);
      }
      if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        applyDelta(-viewportHeight * 0.72);
      }
      if (event.key === 'Home') {
        event.preventDefault();
        setTarget(0);
        scheduleSnap();
      }
      if (event.key === 'End') {
        event.preventDefault();
        setTarget(maxScroll);
        scheduleSnap();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [applyDelta, maxScroll, scheduleSnap, setTarget, viewportHeight]);

  useEffect(() => () => {
    stopAnimation();
    if (middleScrollRafRef.current !== null) {
      cancelAnimationFrame(middleScrollRafRef.current);
      middleScrollRafRef.current = null;
    }
    if (middleSnapDelayRef.current !== null) {
      window.clearTimeout(middleSnapDelayRef.current);
      middleSnapDelayRef.current = null;
    }
    if (snapTimerRef.current !== null) {
      window.clearTimeout(snapTimerRef.current);
    }
  }, [stopAnimation]);

  return (
    <div className="event-template" data-slide={activeSlideIndex + 1}>
      <header className="event-template-header">
        <a className="event-template-brand" href="/#/event">
          <img src="/logo_new.svg" alt="REcreatio" />
        </a>

        <button
          type="button"
          className="event-template-menu-toggle"
          onClick={() => setMenuOpen((current) => !current)}
          aria-expanded={menuOpen}
          aria-label="Menu"
        >
          Menu
        </button>

        <nav className={`event-template-nav ${menuOpen ? 'open' : ''}`}>
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              className={activeSlideIndex === index ? 'active' : ''}
              onClick={() => jumpToSlide(index)}
            >
              {slide.menuLabel}
            </button>
          ))}
        </nav>

        <div className="event-template-tools">
          <LanguageSelect value={language} onChange={onLanguageChange} />
          <AuthAction
            copy={copy}
            label={authLabel}
            isAuthenticated={showProfileMenu}
            secureMode={secureMode}
            onLogin={onAuthAction}
            onProfileNavigate={onProfileNavigate}
            onToggleSecureMode={onToggleSecureMode}
            onLogout={onLogout}
            variant="ghost"
          />
        </div>
      </header>

      <main
        ref={viewportRef}
        className={`event-template-viewport ${middleScrollActive ? 'middle-scroll-active' : ''}`}
        aria-label={event.title}
      >
        <div
          className="event-template-track"
          style={{ transform: `translate3d(0, ${-position}px, 0)` }}
        >
          {slides.map((slide, index) => (
            (() => {
              const isActive = activeSlideIndex === index;
              const slideStart = slideStarts[index] ?? 0;
              const slideHeight = slideHeights[index] ?? viewportHeight;
              const slideRange = Math.max(0, slideHeight - viewportHeight);
              const slideProgress = slideRange > 0
                ? clamp((position - slideStart) / slideRange, 0, 1)
                : 0;
              const resolvedLayers = resolveSlideLayers(slide);

              return (
                <section
                  key={slide.id}
                  id={slide.id}
                  className={`event-template-slide ${slide.tone ?? 'tone-1'} ${isActive ? 'is-active' : ''}`}
                  style={{ height: `${slideHeight}px` }}
                >
                  <div className="event-template-slide-layers">
                    {resolvedLayers.map((layer, layerIndex) => {
                      const layerHeight = layerHeights[index]?.[layerIndex] ?? viewportHeight;
                      const layerRange = Math.max(0, layerHeight - viewportHeight);
                      const layerOffset = -slideProgress * layerRange;
                      const className = [
                        'event-template-slide-layer',
                        layer.className ?? '',
                        isActive ? 'is-active' : ''
                      ]
                        .filter(Boolean)
                        .join(' ');

                      return (
                        <div
                          key={`${slide.id}-${layer.id}`}
                          className={`event-template-slide-layer-frame ${layer.interactive ? 'interactive' : ''}`}
                          style={{ zIndex: layerIndex + 1 }}
                        >
                          <div
                            ref={(node) => {
                              if (!layerRefs.current[index]) {
                                layerRefs.current[index] = [];
                              }
                              layerRefs.current[index][layerIndex] = node;
                            }}
                            className={className}
                            style={{
                              transform: `translate3d(0, ${layerOffset}px, 0)`,
                              minHeight: layer.minHeightPx ? `${layer.minHeightPx}px` : undefined
                            }}
                          >
                            {layer.content}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })()
          ))}
        </div>
      </main>

      <aside className="event-template-dots" aria-hidden="true">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            className={activeSlideIndex === index ? 'active' : ''}
            onClick={() => jumpToSlide(index)}
            aria-label={slide.title}
          />
        ))}
      </aside>

      <footer className="portal-footer cogita-footer event-template-footer">
        <a className="portal-brand portal-footer-brand" href="/#/">
          <img src="/logo_inv.svg" alt="Recreatio" />
        </a>
        <span>{copy.footer.headline}</span>
        <a className="ghost events-footer-home" href="/#/section-1" onClick={() => onNavigate('home')}>
          {copy.nav.home}
        </a>
      </footer>
    </div>
  );
}
