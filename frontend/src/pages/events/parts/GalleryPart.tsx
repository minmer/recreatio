import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const [open, setOpen] = useState<number | null>(null);
  const [front, setFront] = useState(0);
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
      width: photo.width,
      height: photo.height
    }));

    const all = [...own, ...sent];
    return config.shuffle ? shuffled(all, seed) : all;
  }, [config.shots, config.shuffle, gallery, seed]);

  // The front picture must stay inside the set as pictures arrive or leave.
  useEffect(() => {
    setFront((current) => (pictures.length === 0 ? 0 : current % pictures.length));
  }, [pictures.length]);

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
      <Carousel pictures={pictures} front={front} onFront={setFront} onOpen={setOpen} />

      {invite}
      {error ? <p className="ev-error">{error}</p> : null}

      {open !== null && pictures[open] ? (
        <Viewer
          pictures={pictures}
          start={open}
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
  onFront,
  onOpen
}: {
  pictures: Picture[];
  front: number;
  onFront: (index: number) => void;
  onOpen: (index: number) => void;
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
            onClick={() => (offset === 0 ? onOpen(index) : onFront(index))}
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
    </div>
  );
}

/**
 * The gallery, opened.
 *
 * Everything a picture viewer is expected to do, because anything missing is
 * noticed immediately: arrows and swipe, the keyboard (←, →, Home, End, Escape),
 * a counter, the caption and who sent it, a strip of the rest along the bottom,
 * and the two neighbouring pictures already loading so the next one is there
 * before the finger lands.
 */
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
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);

  const count = pictures.length;
  const go = useCallback((next: number) => setAt(((next % count) + count) % count), [count]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') go(at + 1);
      else if (event.key === 'ArrowLeft') go(at - 1);
      else if (event.key === 'Home') go(0);
      else if (event.key === 'End') go(count - 1);
      else return;
      event.preventDefault();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [at, count, go]);

  // Keep the thumbnail of the picture being looked at inside the strip.
  useEffect(() => {
    const strip = stripRef.current;
    const active = strip?.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [at]);

  const picture = pictures[at];
  if (!picture) return null;

  // The neighbours, fetched but not shown: the browser has them decoded by the
  // time the arrow is pressed.
  const neighbours = [pictures[(at + 1) % count], pictures[(at - 1 + count) % count]];

  return (
    <Fullscreen label="Galeria zdjęć" onClose={onClose}>
      <div
        className="ev-viewer"
        onTouchStart={(event) => {
          const touch = event.touches[0];
          touchRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
        }}
        onTouchEnd={(event) => {
          const from = touchRef.current;
          touchRef.current = null;
          if (from === null) return;

          const touch = event.changedTouches[0];
          if (!touch) return;
          const dx = touch.clientX - from.x;
          const dy = touch.clientY - from.y;

          // Sideways moves through the gallery; a downward pull closes it, the
          // way every photo app on a phone behaves.
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? at + 1 : at - 1);
          else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) onClose();
        }}
      >
        <figure className="ev-viewer-stage">
          <img src={picture.url} alt={picture.alt} />
          {picture.caption || picture.credit ? (
            <figcaption>
              {picture.caption}
              {picture.credit ? <span>Zdjęcie: {picture.credit}</span> : null}
            </figcaption>
          ) : null}
        </figure>

        {count > 1 ? (
          <>
            <button type="button" className="ev-viewer-step is-back" aria-label="Poprzednie" onClick={() => go(at - 1)}>
              ‹
            </button>
            <button type="button" className="ev-viewer-step is-next" aria-label="Następne" onClick={() => go(at + 1)}>
              ›
            </button>
          </>
        ) : null}

        <div className="ev-viewer-bar">
          <span className="ev-viewer-count">
            {at + 1} / {count}
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
