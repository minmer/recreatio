import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import {
  deleteEventPhoto,
  eventPhotoUrl,
  getEventGallery,
  uploadEventPhoto,
  type EventGallery
} from '../../../lib/api';
import { asOptionalText, asRecord, asText, definePart, mapEntries } from './contracts';
import { CheckRow, ListEditor, SelectRow, TextRow } from './editorKit';
import { Fullscreen } from './Fullscreen';
import { photoCount } from './galleryCount';
import { FIT, clampView, zoomAbout, type View } from './galleryZoom';
import { downscaleImage } from './imageDownscale';

type Shot = { url: string; caption: string | null; alt: string };

type GalleryConfig = {
  shots: Shot[];
  /** off — the organizer's pictures only; link — anybody holding an individual link may add. */
  contributions: 'off' | 'link';
  /** What the invitation says above the button. */
  inviteText: string | null;
  /** Shuffle on every visit, so the same five are not always at the front. */
  shuffle: boolean;
};

/**
 * One picture at the front, two behind it on each side.
 *
 * A grid of thumbnails is a contact sheet: it shows that pictures exist. This
 * shows one picture, at a size worth looking at, with the next ones standing
 * behind it — so the slide has something to say at a glance, and the way in is
 * to click whatever catches the eye. Clicking any of the five opens the whole
 * gallery on that very picture.
 *
 * Three things decide the shape of this part:
 *
 *   1. **Participants can be let in, per slide.** Forty people came with a
 *      camera each; the organizer decides in the builder whether their pictures
 *      belong here. Only holders of an individual link may add, and their name
 *      travels with the photograph — an open box on a public page collects
 *      whatever the internet sends and leaves nobody to ask about it.
 *
 *   2. **The browser shrinks a photograph before sending it.** See
 *      imageDownscale.ts: eight megabytes from a phone become a few hundred
 *      kilobytes, the upload finishes on a rural connection, and the EXIF block —
 *      the coordinates of where somebody was standing — does not survive the
 *      re-encode.
 *
 *   3. **The full view is the point.** Opened, a picture takes the whole screen
 *      and behaves the way every other picture viewer does: arrows, swipe,
 *      Escape, a counter, and the neighbours already loading.
 */

type Picture = {
  key: string;
  url: string;
  caption: string | null;
  alt: string;
  /** Who sent it, for a contributed picture. */
  credit: string | null;
  /** Only a contributed picture can be taken down from here. */
  photoId: string | null;
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

export const galleryPart = definePart<GalleryConfig>({
  kind: 'gallery',
  label: 'Galeria',
  description: 'Karuzela zdjęć na pełnym ekranie. Uczestnicy mogą dokładać własne, jeśli na to pozwolisz.',

  defaultConfig: () => ({ shots: [], contributions: 'off', inviteText: null, shuffle: true }),

  example: () => ({
    shots: [{ url: 'https://…/zdjecie.jpg', caption: 'Wyjazd z Krakowa', alt: 'Grupa rowerzystów o świcie' }],
    contributions: 'link',
    inviteText: 'Masz zdjęcia z trasy? Dodaj je tutaj.',
    shuffle: true
  }),

  parse: (raw) => {
    const record = asRecord(raw);
    return {
      shots: mapEntries<Shot>(record.shots, (item) => {
        // Nothing is dropped here — a shot added in the builder starts with no
        // address at all, and a guard would leave the "add" button doing
        // nothing. The renderer skips the ones that still have no picture.
        const caption = asOptionalText(item.caption);
        return { url: asText(item.url).trim(), caption, alt: asText(item.alt, caption ?? '').trim() };
      }),
      contributions: record.contributions === 'link' ? 'link' : 'off',
      inviteText: asOptionalText(record.inviteText),
      shuffle: record.shuffle !== false
    };
  },

  Renderer: ({ config, ctx }) => (
    <Gallery config={config} slug={ctx.siteSlug} partId={ctx.part.id} token={ctx.accessToken} />
  ),

  Editor: ({ config, onChange, ctx }) => <GalleryEditor config={config} onChange={onChange} partId={ctx.part.id} />
});

// ── Renderer ─────────────────────────────────────────────────────────────────

function Gallery({
  config,
  slug,
  partId,
  token
}: {
  config: GalleryConfig;
  slug: string;
  partId: string;
  token: string | null;
}) {
  const [gallery, setGallery] = useState<EventGallery | null>(null);
  /** The picture the viewer opened on, by key — the two orders differ. */
  const [open, setOpen] = useState<string | null>(null);
  const [front, setFront] = useState(0);
  /**
   * How far somebody has walked the ring, and whether they ever opened it.
   *
   * The hint is for the person who takes the carousel for the whole gallery:
   * they step past three or four pictures with the arrows and never think to
   * click one. Saying it straight away would be noise for everybody else —
   * most people click the big picture within seconds — so it waits until the
   * stepping itself shows that it is needed, and never returns once the
   * gallery has been opened.
   */
  const [steps, setSteps] = useState(0);
  const [everOpened, setEverOpened] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 31) || 1);

  const load = useCallback(async () => {
    try {
      setGallery(await getEventGallery(slug, partId, token));
    } catch {
      // The organizer's own pictures are in the config and need no server.
      setGallery(null);
    }
  }, [slug, partId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const pictures = useMemo(() => {
    const own: Picture[] = config.shots
      .filter((shot) => shot.url.length > 0)
      .map((shot, index) => ({
        key: `shot-${index}`,
        url: shot.url,
        caption: shot.caption,
        alt: shot.alt,
        credit: null,
        photoId: null,
        addedAt: '',
        width: 0,
        height: 0
      }));

    const sent: Picture[] = (gallery?.photos ?? []).map((photo) => ({
      key: `photo-${photo.id}`,
      url: eventPhotoUrl(photo.id),
      caption: photo.caption,
      alt: photo.caption ?? `Zdjęcie od: ${photo.uploaderName}`,
      credit: photo.uploaderName,
      photoId: photo.id,
      addedAt: photo.createdUtc,
      width: photo.width,
      height: photo.height
    }));

    // The gallery's order is the order they arrived: the organizer's pictures as
    // they stand in the slide, then everybody else's oldest first. Opened, a
    // gallery should read like a roll of film — going back to a photograph one
    // saw a minute ago must not mean hunting through a reshuffled set.
    return [
      ...own,
      ...sent.sort((left, right) => left.addedAt.localeCompare(right.addedAt))
    ];
  }, [config.shots, gallery]);

  /**
   * The carousel's own order, drawn once per visit. Randomness belongs here and
   * nowhere else: five pictures out of forty should be a different five each
   * time, but the gallery behind them stays put.
   */
  const ring = useMemo(
    () => (config.shuffle ? shuffled(pictures, seed) : pictures),
    [pictures, config.shuffle, seed]
  );

  // The front picture must stay inside the set as pictures arrive or leave.
  useEffect(() => {
    setFront((current) => (ring.length === 0 ? 0 : current % ring.length));
  }, [ring.length]);

  const send = async (files: FileList) => {
    if (token === null) return;

    setError(null);
    const chosen = [...files];

    for (let index = 0; index < chosen.length; index += 1) {
      const file = chosen[index];
      setBusy(`Wysyłam ${index + 1} z ${chosen.length}…`);

      try {
        const shrunk = await downscaleImage(file);
        await uploadEventPhoto(token, partId, shrunk.blob, {
          fileName: shrunk.fileName,
          width: shrunk.width,
          height: shrunk.height
        });
      } catch (uploadError: unknown) {
        setError(uploadError instanceof Error ? uploadError.message : 'Nie udało się wysłać zdjęcia.');
        break;
      }
    }

    setBusy(null);
    await load();
  };

  const remove = async (photoId: string) => {
    if (!window.confirm('Usunąć to zdjęcie z galerii?')) return;
    try {
      await deleteEventPhoto(photoId);
      setOpen(null);
      await load();
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : 'Nie udało się usunąć zdjęcia.');
    }
  };

  const invite =
    gallery?.mayAdd === true ? (
      <div className="ev-gallery-invite">
        <p>{config.inviteText ?? 'Masz swoje zdjęcia? Dodaj je do galerii.'}</p>
        <label className="ev-cta">
          {busy ?? 'Dodaj zdjęcia'}
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            disabled={busy !== null}
            onChange={(event) => {
              if (event.target.files && event.target.files.length > 0) void send(event.target.files);
              event.target.value = '';
            }}
          />
        </label>
        <small>Zdjęcia są automatycznie zmniejszane przed wysłaniem — nie zużyją pakietu danych.</small>
      </div>
    ) : null;

  // The carousel hands back a key; the viewer needs its place in the other order.
  const openAt = open === null ? -1 : pictures.findIndex((picture) => picture.key === open);

  /** Three steps without opening anything: that is the misunderstanding, quietly. */
  const showHint = !everOpened && steps >= 3 && pictures.length > 1;

  if (pictures.length === 0) {
    return (
      <div className="ev-gallery">
        <p className="ev-note">Nie dodano jeszcze zdjęć.</p>
        {invite}
        {error ? <p className="ev-error">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="ev-gallery">
      <Carousel
        pictures={ring}
        front={front}
        hint={showHint}
        onFront={(index) => {
          setFront(index);
          setSteps((current) => current + 1);
        }}
        onOpen={(key) => {
          setEverOpened(true);
          setOpen(key);
        }}
      />

      {invite}
      {error ? <p className="ev-error">{error}</p> : null}

      {openAt >= 0 ? (
        <Viewer
          pictures={pictures}
          start={openAt}
          mayManage={gallery?.mayManage === true}
          onRemove={remove}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * Five pictures: one at the front, two behind on each side.
 *
 * Position is computed as an offset from the front rather than by moving the
 * pictures around, so the ring is one expression and nothing has to be sorted
 * when it turns.
 */
function Carousel({
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

      {/* The carousel shows five at most, so neither the size of what is behind
          it nor the fact that a click opens it is visible. The line keeps its
          space whether or not it is showing, so fading in moves nothing on the
          page — a hint that shoves the slide down as it arrives is exactly the
          kind of help nobody asked for. */}
      <p className="ev-carousel-hint" data-show={hint} aria-hidden={!hint}>
        Kliknij zdjęcie, żeby otworzyć całą galerię — {photoCount(count)}
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

type Gesture = { kind: 'swipe' | 'pan' | 'pinch'; x: number; y: number; view: View; distance: number };

function Viewer({
  pictures,
  start,
  mayManage,
  onRemove,
  onClose
}: {
  pictures: Picture[];
  start: number;
  mayManage: boolean;
  onRemove: (photoId: string) => void;
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

  const count = pictures.length;

  const go = useCallback((next: number) => {
    setAt(((next % count) + count) % count);
    // A new picture arrives fitted: carrying a zoom across would drop somebody
    // into the middle of a photograph they have not seen yet.
    setView(FIT);
  }, [count]);

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
      event.preventDefault();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [at, count, go]);

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

    // A tap rather than a drag: two in quick succession are the zoom.
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      const now = Date.now();
      if (now - lastTapRef.current < DOUBLE_TAP_MS) {
        toggleZoom(pointIn(touch.clientX, touch.clientY));
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
      return;
    }

    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? at + 1 : at - 1);
    else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) onClose();
  };

  return (
    <Fullscreen label="Galeria zdjęć" onClose={onClose}>
      <div className="ev-viewer">
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

        {/* Hidden while zoomed: at that point a sideways drag is panning, and an
            arrow under the finger would change the picture instead. */}
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

        <div className="ev-viewer-foot">
          {picture.caption || picture.credit ? (
            <p className="ev-viewer-caption">
              {picture.caption}
              {picture.credit ? <span>Zdjęcie: {picture.credit}</span> : null}
            </p>
          ) : null}

          <div className="ev-viewer-bar">
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

            {mayManage && picture.photoId !== null ? (
              <button type="button" className="ev-ghost" onClick={() => onRemove(picture.photoId as string)}>
                Usuń zdjęcie
              </button>
            ) : null}
          </div>

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

// ── Editor ───────────────────────────────────────────────────────────────────

function GalleryEditor({
  config,
  onChange,
  partId
}: {
  config: GalleryConfig;
  onChange: (next: GalleryConfig) => void;
  partId: string;
}) {
  return (
    <>
      <SelectRow<GalleryConfig['contributions']>
        label="Kto może dodawać zdjęcia"
        value={config.contributions}
        options={[
          { value: 'off', label: 'Tylko organizator' },
          { value: 'link', label: 'Także uczestnicy z linkiem osobistym' }
        ]}
        onChange={(contributions) => onChange({ ...config, contributions })}
      />

      {config.contributions === 'link' ? (
        <>
          <p className="eve-hint">
            Zdjęcie może dodać tylko osoba, która otworzyła stronę swoim linkiem osobistym — przy każdym zdjęciu
            zapisuje się, od kogo jest. Telefon zmniejsza zdjęcia przed wysłaniem (dłuższy bok do 2048 px), więc
            nie zużywają pakietu danych, a dane EXIF — w tym miejsce zrobienia zdjęcia — nie są przesyłane.
          </p>
          <TextRow
            label="Zaproszenie nad przyciskiem"
            value={config.inviteText ?? ''}
            placeholder="Masz swoje zdjęcia? Dodaj je do galerii."
            onChange={(inviteText) => onChange({ ...config, inviteText: inviteText || null })}
          />
          <p className="eve-hint">
            Zdjęcie nadesłane przez uczestnika usuniesz, otwierając galerię na stronie wydarzenia — przy zdjęciu
            masz wtedy przycisk „Usuń zdjęcie”. Identyfikator tej części: {partId}.
          </p>
        </>
      ) : null}

      <CheckRow
        label="Losowa kolejność przy każdym wejściu"
        checked={config.shuffle}
        onChange={(shuffle) => onChange({ ...config, shuffle })}
      />

      <ListEditor<Shot>
        legend="Zdjęcia organizatora"
        items={config.shots}
        addLabel="Dodaj zdjęcie"
        blank={() => ({ url: '', caption: null, alt: '' })}
        titleOf={(item, index) => item.caption || item.url || `Zdjęcie ${index + 1}`}
        onChange={(shots) => onChange({ ...config, shots })}
        renderItem={(item, update) => (
          <>
            <TextRow label="Adres zdjęcia" value={item.url} onChange={(url) => update({ ...item, url })} />
            <TextRow
              label="Podpis"
              value={item.caption ?? ''}
              onChange={(caption) => update({ ...item, caption: caption || null })}
            />
            <TextRow
              label="Opis alternatywny"
              value={item.alt}
              hint="Dla osób korzystających z czytnika ekranu."
              onChange={(alt) => update({ ...item, alt })}
            />
          </>
        )}
      />

    </>
  );
}
