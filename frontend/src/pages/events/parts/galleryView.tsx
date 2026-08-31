import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react';
import { Fullscreen } from './Fullscreen';
import { photoCount } from './galleryCount';
import { FIT, clampView, zoomAbout, type View } from './galleryZoom';

/**
 * Looking at a set of pictures: the ring on the slide, and the whole thing full
 * screen.
 *
 * Shared, because two slides show pictures — the gallery and the memes made out
 * of it — and a second carousel would be a second set of gestures to keep in
 * step. Everything here is about pictures in the abstract: where they came from,
 * and what may be done with them, belongs to whichever slide is using it.
 */
export type Picture = {
  key: string;
  url: string;
  caption: string | null;
  alt: string;
  /** Who sent it, for a contributed picture. */
  credit: string | null;
  /** Only a contributed picture can be taken down from here. */
  photoId: string | null;
  /** Sent from this very link: its sender may withdraw it. */
  mine: boolean;
  /** When it arrived, which is the order the opened gallery reads in. */
  addedAt: string;
  width: number;
  height: number;
};

/**
 * A deterministic shuffle for one visit.
 *
 * Fisher–Yates over a seed drawn once per mount: the order must not change
 * between renders — a carousel that re-shuffles while somebody is looking at it
 * moves the picture out from under their finger — but it should differ from one
 * visit to the next, which is the whole point of showing a random five.
 */

export function shuffled<T>(items: readonly T[], seed: number): T[] {
  const copy = [...items];
  let state = seed || 1;

  for (let index = copy.length - 1; index > 0; index -= 1) {
    // xorshift: small, dependency-free, and quite good enough for a carousel.
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const pick = Math.abs(state) % (index + 1);
    [copy[index], copy[pick]] = [copy[pick], copy[index]];
  }

  return copy;
}



/**
 * Five pictures: one at the front, two behind on each side.
 *
 * Position is computed as an offset from the front rather than by moving the
 * pictures around, so the ring is one expression and nothing has to be sorted
 * when it turns.
 */
export function Carousel({
  pictures,
  front,
  hint,
  onFront,
  onOpen
}: {
  pictures: Picture[];
  front: number;
  /** Whether to fade in the line about what a click does. */
  hint: boolean;
  onFront: (index: number) => void;
  onOpen: (key: string) => void;
}) {
  const touchRef = useRef<number | null>(null);
  const count = pictures.length;

  const step = (direction: 1 | -1) => onFront((front + direction + count) % count);

  // Two on each side, or as many as there are. A gallery of three should not
  // show the same picture twice in one ring.
  const reach = Math.min(2, Math.floor((count - 1) / 2));
  const visible: Array<{ picture: Picture; index: number; offset: number }> = [];
  for (let offset = -reach; offset <= reach; offset += 1) {
    const index = (front + offset + count) % count;
    visible.push({ picture: pictures[index], index, offset });
  }

  return (
    <div
      className="ev-carousel"
      onTouchStart={(event) => {
        touchRef.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const from = touchRef.current;
        touchRef.current = null;
        if (from === null) return;
        const travel = (event.changedTouches[0]?.clientX ?? from) - from;
        // A deliberate sideways flick turns the ring; anything smaller was the
        // page being scrolled, and the shell is already handling that.
        if (Math.abs(travel) > 40) step(travel < 0 ? 1 : -1);
      }}
    >
      <button
        type="button"
        className="ev-carousel-step is-back"
        aria-label="Poprzednie zdjęcie"
        onClick={() => step(-1)}
      >
        ‹
      </button>

      <div className="ev-carousel-stage">
        {visible.map(({ picture, index, offset }) => (
          <button
            type="button"
            key={picture.key}
            className="ev-carousel-slot"
            data-offset={offset}
            aria-label={offset === 0 ? `Otwórz: ${picture.alt || 'zdjęcie'}` : 'Pokaż to zdjęcie'}
            // The front picture opens the viewer; the ones behind step forward
            // first, which is what a finger reaching for a half-hidden picture
            // means. One more tap opens it.
            onClick={() => (offset === 0 ? onOpen(picture.key) : onFront(index))}
          >
            <img src={picture.url} alt={picture.alt} loading="lazy" draggable={false} />
          </button>
        ))}

        {/* Over the front picture, not under the carousel: below the slide, on a
            phone, the line can sit past the bottom of the screen — which is the
            one place a hint is no use at all. It takes no layout space and no
            clicks, so the picture underneath still opens on the tap aimed at it. */}
        <p className="ev-carousel-hint" data-show={hint} aria-hidden={!hint}>
          Kliknij zdjęcie, żeby otworzyć całą galerię — {photoCount(count)}
        </p>
      </div>


      <button
        type="button"
        className="ev-carousel-step is-next"
        aria-label="Następne zdjęcie"
        onClick={() => step(1)}
      >
        ›
      </button>

      <p className="ev-carousel-caption">
        {pictures[front]?.caption ?? ''}
        {pictures[front]?.credit ? <span> · {pictures[front]?.credit}</span> : null}
      </p>
    </div>
  );
}

/**
 * The gallery, opened.
 *
 * Everything a picture viewer is expected to do, because anything missing is
 * noticed at once: arrows and swipe, the keyboard, a counter, the caption and
 * who sent it, a strip of the rest along the bottom, both neighbours already
 * loading — and zoom, because half the reason to open a photograph full screen
 * is to look at who is standing in the back row.
 *
 * The zoom is the one every phone gallery has: pinch, double-tap in and out,
 * drag to move around, and the picture snapping back to the middle when it is
 * smaller than the frame. While it is zoomed a sideways drag moves the picture
 * rather than changing it — that is the rule that makes zooming usable at all,
 * and the one people notice when it is missing.
 */
/** Two taps closer together than this are one gesture: the zoom. */
const DOUBLE_TAP_MS = 300;

/** How long the picture is left alone before the furniture fades away. */
const IDLE_MS = 2600;

type Gesture = { kind: 'swipe' | 'pan' | 'pinch'; x: number; y: number; view: View; distance: number };

export function Viewer({
  pictures,
  start,
  mayManage,
  onRemove,
  onClose
}: {
  pictures: Picture[];
  start: number;
  /** The organizer, who answers for the page. */
  mayManage: boolean;
  onRemove: (photoId: string, mine: boolean) => void;
  onClose: () => void;
}) {
  const [at, setAt] = useState(start);
  const [view, setView] = useState<View>(FIT);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const lastTapRef = useRef(0);
  /**
   * What kind of pointer last touched the stage.
   *
   * A phone reports a double-tap twice: once as the two touchend events this
   * component counts itself, and once as the dblclick every mobile browser
   * synthesises afterwards for the sake of old pages. Both ran toggleZoom, so
   * the picture went in and straight back out — on a mouse, where no touch
   * events arrive at all, only one of them ever fired, which is why it behaved.
   */
  const pointerKindRef = useRef<string>('mouse');

  /**
   * The furniture, and when it gets out of the way.
   *
   * Every photograph application does this and it is noticed only in the
   * breach: the counter, the arrows, the caption and the strip fade out a few
   * seconds after the last movement, so what is left on the screen is the
   * picture. Anything at all — a moved mouse, a finger, a key, a new picture —
   * brings them back. On a phone held sideways this is the difference between
   * looking at a photograph and looking at a photograph in a frame of buttons.
   */
  const [chrome, setChrome] = useState(true);
  const idleRef = useRef<number | null>(null);
  const tapRef = useRef<number | null>(null);

  const wake = useCallback(() => {
    setChrome(true);
    if (idleRef.current !== null) window.clearTimeout(idleRef.current);
    idleRef.current = window.setTimeout(() => setChrome(false), IDLE_MS);
  }, []);

  useEffect(() => {
    wake();
    return () => {
      if (idleRef.current !== null) window.clearTimeout(idleRef.current);
      if (tapRef.current !== null) window.clearTimeout(tapRef.current);
    };
  }, [wake]);

  const count = pictures.length;

  const go = useCallback((next: number) => {
    setAt(((next % count) + count) % count);
    wake();
    // A new picture arrives fitted: carrying a zoom across would drop somebody
    // into the middle of a photograph they have not seen yet.
    setView(FIT);
  }, [count, wake]);

  const frame = () => {
    const box = stageRef.current?.getBoundingClientRect();
    return { width: box?.width ?? 0, height: box?.height ?? 0 };
  };

  /** A point on screen, measured from the middle of the frame. */
  const pointIn = (clientX: number, clientY: number) => {
    const box = stageRef.current?.getBoundingClientRect();
    if (!box) return { x: 0, y: 0 };
    return { x: clientX - box.left - box.width / 2, y: clientY - box.top - box.height / 2 };
  };

  const zoomBy = (factor: number, point: { x: number; y: number }) =>
    setView((current) => clampView(zoomAbout(current, current.scale * factor, point), frame()));

  const toggleZoom = (point: { x: number; y: number }) =>
    setView((current) => (current.scale > 1.01 ? FIT : clampView(zoomAbout(current, 2.5, point), frame())));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') go(at + 1);
      else if (event.key === 'ArrowLeft') go(at - 1);
      else if (event.key === 'Home') go(0);
      else if (event.key === 'End') go(count - 1);
      else if (event.key === '+' || event.key === '=') zoomBy(1.4, { x: 0, y: 0 });
      else if (event.key === '-') zoomBy(1 / 1.4, { x: 0, y: 0 });
      else if (event.key === '0') setView(FIT);
      else return;
      wake();
      event.preventDefault();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [at, count, go, wake]);

  useEffect(() => {
    const active = stripRef.current?.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [at]);

  const picture = pictures[at];
  if (!picture) return null;

  const zoomed = view.scale > 1.01;
  const neighbours = [pictures[(at + 1) % count], pictures[(at - 1 + count) % count]];

  const touchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      const first = event.touches[0];
      const second = event.touches[1];
      gestureRef.current = {
        kind: 'pinch',
        x: (first.clientX + second.clientX) / 2,
        y: (first.clientY + second.clientY) / 2,
        view,
        distance: Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY)
      };
      return;
    }

    const touch = event.touches[0];
    if (!touch) return;
    gestureRef.current = { kind: zoomed ? 'pan' : 'swipe', x: touch.clientX, y: touch.clientY, view, distance: 0 };
  };

  const touchMove = (event: TouchEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture) return;

    if (gesture.kind === 'pinch' && event.touches.length === 2) {
      const first = event.touches[0];
      const second = event.touches[1];
      const distance = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
      const scale = gesture.view.scale * (distance / (gesture.distance || distance));
      setView(clampView(zoomAbout(gesture.view, scale, pointIn(gesture.x, gesture.y)), frame()));
      return;
    }

    if (gesture.kind === 'pan') {
      const touch = event.touches[0];
      if (!touch) return;
      setView(
        clampView(
          {
            scale: gesture.view.scale,
            x: gesture.view.x + (touch.clientX - gesture.x),
            y: gesture.view.y + (touch.clientY - gesture.y)
          },
          frame()
        )
      );
    }
  };

  const touchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    if (!gesture || gesture.kind !== 'swipe') return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - gesture.x;
    const dy = touch.clientY - gesture.y;

    // A tap rather than a drag. One shows or hides the furniture, two are the
    // zoom — so the first one waits to see whether a second is coming, or the
    // screen would flicker on every double-tap.
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      const now = Date.now();

      if (now - lastTapRef.current < DOUBLE_TAP_MS) {
        if (tapRef.current !== null) window.clearTimeout(tapRef.current);
        tapRef.current = null;
        lastTapRef.current = 0;
        toggleZoom(pointIn(touch.clientX, touch.clientY));
        wake();
        return;
      }

      lastTapRef.current = now;
      tapRef.current = window.setTimeout(() => {
        tapRef.current = null;
        setChrome((visible) => !visible);
        if (idleRef.current !== null) window.clearTimeout(idleRef.current);
        idleRef.current = window.setTimeout(() => setChrome(false), IDLE_MS);
      }, DOUBLE_TAP_MS);
      return;
    }

    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? at + 1 : at - 1);
    else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) onClose();
    else wake();
  };

  return (
    <Fullscreen label="Galeria zdjęć" onClose={onClose}>
      <div className="ev-viewer" data-chrome={chrome} onPointerMove={wake} onFocusCapture={wake}>
        {/* The picture owns the whole layer, in either orientation: everything
            else floats over it. Giving the caption and the strip rows of their
            own cost a portrait photograph a third of its height and a landscape
            one most of its width — and on a phone turned sideways there is
            nothing left to look at. */}
        <div
          className="ev-viewer-stage"
          ref={stageRef}
          data-zoomed={zoomed}
          onTouchStart={touchStart}
          onTouchMove={touchMove}
          onTouchEnd={touchEnd}
          onDoubleClick={(event) => {
            // Mouse only. The touch path has already counted its own taps.
            if (pointerKindRef.current !== 'mouse') return;
            toggleZoom(pointIn(event.clientX, event.clientY));
          }}
          onWheel={(event) => zoomBy(Math.exp(-event.deltaY / 400), pointIn(event.clientX, event.clientY))}
          onPointerDown={(event) => {
            pointerKindRef.current = event.pointerType;
            // Mouse only: a finger is handled above, and taking both would move
            // the picture twice as far as it was dragged.
            if (event.pointerType !== 'mouse' || !zoomed) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            gestureRef.current = { kind: 'pan', x: event.clientX, y: event.clientY, view, distance: 0 };
          }}
          onPointerMove={(event) => {
            const gesture = gestureRef.current;
            if (event.pointerType !== 'mouse' || gesture?.kind !== 'pan') return;
            setView(
              clampView(
                {
                  scale: gesture.view.scale,
                  x: gesture.view.x + (event.clientX - gesture.x),
                  y: gesture.view.y + (event.clientY - gesture.y)
                },
                frame()
              )
            );
          }}
          onPointerUp={() => {
            if (gestureRef.current?.kind === 'pan') gestureRef.current = null;
          }}
        >
          <img
            src={picture.url}
            alt={picture.alt}
            draggable={false}
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
          />
        </div>

        {/* Half off the edge, and fully out on hover or focus: two thirds of an
            arrow is plenty to aim at, and the third that is missing is picture
            the reader gets to keep. Hidden while zoomed, where a sideways drag
            means panning. */}
        {count > 1 && !zoomed ? (
          <>
            <button type="button" className="ev-viewer-step is-back" aria-label="Poprzednie" onClick={() => go(at - 1)}>
              ‹
            </button>
            <button type="button" className="ev-viewer-step is-next" aria-label="Następne" onClick={() => go(at + 1)}>
              ›
            </button>
          </>
        ) : null}

        <div className="ev-viewer-top">
          <span className="ev-viewer-count">
            {at + 1} / {count}
          </span>

          <span className="ev-viewer-zoom">
            <button type="button" aria-label="Pomniejsz" onClick={() => zoomBy(1 / 1.4, { x: 0, y: 0 })}>
              −
            </button>
            <button type="button" onClick={() => setView(FIT)} disabled={!zoomed}>
              {Math.round(view.scale * 100)}%
            </button>
            <button type="button" aria-label="Powiększ" onClick={() => zoomBy(1.4, { x: 0, y: 0 })}>
              +
            </button>
          </span>

          {picture.photoId !== null && (picture.mine || mayManage) ? (
            <button
              type="button"
              className="ev-ghost"
              onClick={() => onRemove(picture.photoId as string, picture.mine)}
            >
              {picture.mine ? 'Usuń moje zdjęcie' : 'Usuń zdjęcie'}
            </button>
          ) : null}
        </div>

        <div className="ev-viewer-foot">
          {picture.caption || picture.credit ? (
            <p className="ev-viewer-caption">
              {picture.caption}
              {picture.credit ? <span>Zdjęcie: {picture.credit}</span> : null}
            </p>
          ) : null}

          {count > 1 ? (
            <div className="ev-viewer-strip" ref={stripRef}>
              {pictures.map((entry, index) => (
                <button
                  type="button"
                  key={entry.key}
                  data-active={index === at}
                  aria-label={`Zdjęcie ${index + 1}`}
                  onClick={() => go(index)}
                >
                  <img src={entry.url} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="ev-viewer-preload" aria-hidden="true">
          {neighbours.map((entry) => (
            <img key={entry.key} src={entry.url} alt="" />
          ))}
        </div>
      </div>
    </Fullscreen>
  );
}

