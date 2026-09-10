import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteEventPhoto,
  deleteOwnEventPhoto,
  eventPhotoUrl,
  getEventGallery,
  uploadEventPhoto,
  type EventGallery
} from '../../../lib/api';
import { asOptionalText, asRecord, asText, definePart, mapEntries } from './contracts';
import { CheckRow, ListEditor, SelectRow, TextRow } from './editorKit';
import { Carousel, Viewer, shuffled, type Picture } from './galleryView';
import { downscaleImage } from './imageDownscale';

/** How long the carousel's hint stays up once it has said its piece. */
const HINT_MS = 5000;

/** How many pictures go by before it is worth saying again. */
const HINT_AGAIN_AFTER = 4;

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
  const [hint, setHint] = useState(false);
  /** The step count at which the hint is due again. */
  const dueRef = useRef(3);
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
        mine: false,
        addedAt: '',
        width: 0,
        height: 0
      }));

    const sent: Picture[] = (gallery?.photos ?? []).map((photo) => ({
      key: `photo-${photo.id}`,
      url: eventPhotoUrl(photo.id),
      caption: photo.caption,
      alt: photo.caption ?? `Zdjęcie od: ${photo.uploaderName}`,
      credit: photo.isMeme ? `${photo.uploaderName} · mem` : photo.uploaderName,
      photoId: photo.id,
      mine: photo.mine,
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

  /**
   * The hint comes and goes.
   *
   * Three steps through the ring without opening anything is somebody who takes
   * the carousel for the whole gallery, so it says so — over the picture, where
   * it cannot fall below the bottom of a phone screen — and then leaves after a
   * few seconds, because a line that stays is furniture rather than help. If
   * they keep stepping without ever opening a picture it returns, a few
   * photographs later. Opening the gallery ends it for good: the point is made.
   */
  useEffect(() => {
    if (everOpened || pictures.length < 2 || steps < dueRef.current) return;

    setHint(true);
    const timer = window.setTimeout(() => {
      setHint(false);
      dueRef.current = steps + HINT_AGAIN_AFTER;
    }, HINT_MS);

    return () => window.clearTimeout(timer);
  }, [steps, everOpened, pictures.length]);


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

  /**
   * Taking a picture out again.
   *
   * The sender's own is theirs to withdraw, through their link — that is the
   * one path that needs no organizer and no e-mail asking for a favour. The
   * organizer's own removal stays beside it: they answer for what stands on
   * their event's page, and a picture only its sender can take down is a
   * problem the first time somebody sends the wrong one.
   */
  const remove = async (photoId: string, mine: boolean) => {
    if (!window.confirm(mine ? 'Usunąć swoje zdjęcie z galerii?' : 'Usunąć to zdjęcie z galerii?')) return;
    try {
      if (mine && token !== null) await deleteOwnEventPhoto(token, photoId);
      else await deleteEventPhoto(photoId);
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
        hint={hint}
        onFront={(index) => {
          setFront(index);
          setSteps((current) => current + 1);
        }}
        onOpen={(key) => {
          setEverOpened(true);
          setHint(false);
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
          onRemove={(photoId, mine) => void remove(photoId, mine)}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
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
