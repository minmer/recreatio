import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  deleteEventPhoto,
  deleteOwnEventPhoto,
  eventPhotoUrl,
  getEventAdminSite,
  getEventGallery,
  uploadEventPhoto,
  type EventGallery
} from '../../../lib/api';
import { asOptionalText, asRecord, asText, definePart } from './contracts';
import { Fullscreen } from './Fullscreen';
import { CheckRow, SelectRow, TextRow } from './editorKit';
import { Carousel, Viewer, type Picture } from './galleryView';
import {
  BAR_SHARE,
  cropInPixels,
  fitCaption,
  memeLayout,
  type CropBox
} from './memeCanvas';

/**
 * Making a meme out of the event's own photographs.
 *
 * The gallery already fills up with pictures the participants took; this is what
 * they do with them afterwards. A picture is chosen from that gallery, a part of
 * it is framed, a line is typed, and the result is one image — the photograph on
 * top, a black band underneath, white words in it — which is saved back and
 * shown on this slide.
 *
 * Three decisions carry it:
 *
 *   1. **It borrows the gallery's pictures rather than its own.** The slide is
 *      pointed at a gallery in the builder, so the pictures people already sent
 *      are the raw material and nobody uploads anything twice.
 *
 *   2. **The finished meme is a picture like any other**, stored the same way
 *      contributed photographs are, attached to this slide and to the link it
 *      came from. That is what makes it show up here, be openable full screen,
 *      and be withdrawable by whoever made it.
 *
 *   3. **The band takes its share of a taller image, never of the photograph.**
 *      A caption is added under the picture, not over it: the crop the reader
 *      framed is exactly what they get, and the words sit below in their own
 *      fifth of the height. See memeCanvas.ts for the arithmetic.
 */

type MemeConfig = {
  /** The gallery slide whose pictures may be used. Empty — this slide's own. */
  sourcePartId: string;
  inviteText: string | null;
  /** The band's share of the finished picture. */
  barShare: number;
  /** Finished memes also appear in that gallery. Off: a meme stays on its own slide. */
  shareToGallery: boolean;
};

export const memePart = definePart<MemeConfig>({
  kind: 'meme',
  label: 'Memy',
  description: 'Uczestnicy robią memy ze zdjęć z galerii: kadr, podpis na czarnym pasku, gotowe.',

  defaultConfig: () => ({ sourcePartId: '', inviteText: null, barShare: BAR_SHARE, shareToGallery: false }),

  example: () => ({
    sourcePartId: '00000000-0000-0000-0000-000000000000',
    inviteText: 'Zrób mem ze zdjęć z trasy!',
    barShare: BAR_SHARE,
    shareToGallery: false
  }),

  parse: (raw) => {
    const record = asRecord(raw);
    const share = Number(record.barShare);
    return {
      sourcePartId: asText(record.sourcePartId).trim(),
      inviteText: asOptionalText(record.inviteText),
      // A band beyond these bounds is either invisible or the whole picture.
      barShare: Number.isFinite(share) && share >= 0.12 && share <= 0.4 ? share : BAR_SHARE,
      shareToGallery: record.shareToGallery === true
    };
  },

  Renderer: ({ config, ctx }) => (
    <Memes config={config} slug={ctx.siteSlug} partId={ctx.part.id} token={ctx.accessToken} />
  ),

  Editor: ({ config, onChange, ctx }) => <MemeEditor config={config} onChange={onChange} siteId={ctx.siteId} />
});

// ── Renderer ─────────────────────────────────────────────────────────────────

function Memes({
  config,
  slug,
  partId,
  token
}: {
  config: MemeConfig;
  slug: string;
  partId: string;
  token: string | null;
}) {
  const [made, setMade] = useState<EventGallery | null>(null);
  const [source, setSource] = useState<EventGallery | null>(null);
  const [making, setMaking] = useState(false);
  const [front, setFront] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sourceId = config.sourcePartId.length > 0 ? config.sourcePartId : partId;

  const load = useCallback(async () => {
    try {
      setMade(await getEventGallery(slug, partId, token));
    } catch {
      setMade(null);
    }

    if (sourceId === partId) return;
    try {
      setSource(await getEventGallery(slug, sourceId, token));
    } catch {
      // A gallery that was deleted or renumbered: the slide still shows what it
      // has, and says why nothing new can be made.
      setSource(null);
    }
  }, [slug, partId, sourceId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const pictures = useMemo(() => {
    const pool = sourceId === partId ? made?.photos ?? [] : source?.photos ?? [];
    // Photographs only. A meme of a meme is a picture of a black band.
    return pool.filter((photo) => !photo.isMeme);
  }, [sourceId, partId, made, source]);

  const memes: Picture[] = useMemo(
    () =>
      (made?.photos ?? []).map((meme) => ({
        key: `meme-${meme.id}`,
        url: eventPhotoUrl(meme.id),
        caption: meme.caption,
        alt: meme.caption ?? `Mem od: ${meme.uploaderName}`,
        credit: meme.uploaderName,
        photoId: meme.id,
        mine: meme.mine,
        addedAt: meme.createdUtc,
        width: meme.width,
        height: meme.height
      })),
    [made]
  );

  const mayMake = made?.mayAdd === true && token !== null && pictures.length > 0;

  const remove = async (photoId: string, mine: boolean) => {
    if (!window.confirm(mine ? 'Usunąć swój mem?' : 'Usunąć ten mem?')) return;
    try {
      if (mine && token !== null) await deleteOwnEventPhoto(token, photoId);
      else await deleteEventPhoto(photoId);
      setOpen(null);
      await load();
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : 'Nie udało się usunąć mema.');
    }
  };

  const openAt = open === null ? -1 : memes.findIndex((meme) => meme.key === open);

  return (
    <div className="ev-memes">
      {memes.length === 0 ? (
        <p className="ev-note">Nikt jeszcze nie zrobił mema. Możesz być pierwszy.</p>
      ) : (
        <Carousel
          pictures={memes}
          front={front}
          hint={false}
          onFront={setFront}
          onOpen={setOpen}
        />
      )}

      <div className="ev-gallery-invite">
        <p>{config.inviteText ?? 'Zrób własny mem ze zdjęć z galerii.'}</p>

        {mayMake ? (
          <button type="button" className="ev-cta" onClick={() => setMaking(true)}>
            Zrób mem
          </button>
        ) : (
          <small>
            {token === null
              ? 'Memy robi się ze swojego linku osobistego.'
              : pictures.length === 0
                ? 'W galerii nie ma jeszcze zdjęć, z których można zrobić mem.'
                : 'Ta część nie przyjmuje teraz nowych memów.'}
          </small>
        )}
      </div>

      {error ? <p className="ev-error">{error}</p> : null}

      {openAt >= 0 ? (
        <Viewer
          pictures={memes}
          start={openAt}
          mayManage={made?.mayManage === true}
          onRemove={(photoId, mine) => void remove(photoId, mine)}
          onClose={() => setOpen(null)}
        />
      ) : null}

      {making && token !== null ? (
        <MemeMaker
          pictures={pictures.map((photo) => ({ id: photo.id, label: photo.caption ?? photo.uploaderName }))}
          barShare={config.barShare}
          onClose={() => setMaking(false)}
          onSave={async (blob, size, caption) => {
            try {
              await uploadEventPhoto(token, partId, blob, {
                fileName: 'mem.jpg',
                width: size.width,
                height: size.height,
                caption
              });
              setMaking(false);
              await load();
            } catch (saveError: unknown) {
              setError(saveError instanceof Error ? saveError.message : 'Nie udało się zapisać mema.');
              setMaking(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}

// ── Making one ───────────────────────────────────────────────────────────────

type Step = 'pick' | 'frame';

/** Where a press landed relative to the crop, which decides what the drag means. */
type Grip = 'nw' | 'ne' | 'sw' | 'se';

/** A press this close to a corner, in fractions of the frame, takes hold of it. */
const GRIP_REACH = 0.07;

/** Anything smaller than this was a tap, not a selection. */
const MIN_CROP = 0.05;

type Drag =
  | { mode: 'draw'; anchorX: number; anchorY: number }
  | { mode: 'move'; x: number; y: number; origin: CropBox }
  | { mode: 'resize'; grip: Grip; origin: CropBox };

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** A box from two corners, in either order — a drag may go up and to the left. */
function boxBetween(ax: number, ay: number, bx: number, by: number): CropBox {
  return {
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    width: Math.abs(bx - ax),
    height: Math.abs(by - ay)
  };
}

/** Which corner a press has taken hold of, if any. */
function gripAt(crop: CropBox, x: number, y: number): Grip | null {
  const near = (a: number, b: number) => Math.abs(a - b) < GRIP_REACH;
  const right = crop.x + crop.width;
  const bottom = crop.y + crop.height;

  if (near(x, crop.x) && near(y, crop.y)) return 'nw';
  if (near(x, right) && near(y, crop.y)) return 'ne';
  if (near(x, crop.x) && near(y, bottom)) return 'sw';
  if (near(x, right) && near(y, bottom)) return 'se';
  return null;
}

/** Dragging one corner: the opposite one stays where it is. */
function resized(origin: CropBox, grip: Grip, x: number, y: number): CropBox {
  const left = origin.x;
  const top = origin.y;
  const right = origin.x + origin.width;
  const bottom = origin.y + origin.height;

  if (grip === 'nw') return boxBetween(right, bottom, x, y);
  if (grip === 'ne') return boxBetween(left, bottom, x, y);
  if (grip === 'sw') return boxBetween(right, top, x, y);
  return boxBetween(left, top, x, y);
}

/**
 * Three things in order: which picture, which part of it, what it says.
 *
 * Full screen, because framing a photograph inside a slide that is itself
 * scrolling is a fight nobody wins on a phone.
 *
 * The whole picture is used until somebody says otherwise. Asking for a frame
 * first and drawing it afterwards is the wrong way round: most memes want the
 * whole photograph, and a crop box that appears unbidden has to be understood
 * and dismissed before anything else can happen. So: a button arms it, the next
 * drag draws it from where the finger went down to where it came up, and after
 * that it can be pushed around and pulled by its corners.
 */
function MemeMaker({
  pictures,
  barShare,
  onSave,
  onClose
}: {
  pictures: Array<{ id: string; label: string }>;
  barShare: number;
  onSave: (blob: Blob, size: { width: number; height: number }, caption: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>('pick');
  const [chosen, setChosen] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  /** null — the whole picture, which is where everybody starts. */
  const [crop, setCrop] = useState<CropBox | null>(null);
  /** Armed by the button: the next drag draws the frame. */
  const [arming, setArming] = useState(false);
  const [busy, setBusy] = useState(false);

  const imageRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<Drag | null>(null);

  /**
   * Where a pointer is, as a fraction of the picture as drawn.
   *
   * Measured against the image element rather than its box: the picture is
   * letterboxed inside the frame, and a fraction of the frame would put the crop
   * somewhere else entirely on anything that is not exactly the frame's shape.
   */
  const pointFraction = (event: ReactPointerEvent) => {
    const box = imageRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return { x: 0, y: 0 };
    return { x: clamp01((event.clientX - box.left) / box.width), y: clamp01((event.clientY - box.top) / box.height) };
  };

  const onPointerDown = (event: ReactPointerEvent) => {
    if (step !== 'frame') return;
    const point = pointFraction(event);

    // Taking hold of a corner, or of the frame itself.
    if (crop !== null && !arming) {
      const grip = gripAt(crop, point.x, point.y);
      if (grip !== null) {
        dragRef.current = { mode: 'resize', grip, origin: crop };
      } else if (
        point.x >= crop.x && point.x <= crop.x + crop.width &&
        point.y >= crop.y && point.y <= crop.y + crop.height
      ) {
        dragRef.current = { mode: 'move', x: point.x, y: point.y, origin: crop };
      } else {
        // A press outside the frame starts a new one, which is what pressing
        // outside a selection means everywhere else.
        dragRef.current = { mode: 'draw', anchorX: point.x, anchorY: point.y };
        setCrop({ x: point.x, y: point.y, width: 0, height: 0 });
      }
    } else {
      dragRef.current = { mode: 'draw', anchorX: point.x, anchorY: point.y };
      setCrop({ x: point.x, y: point.y, width: 0, height: 0 });
    }

    // Captured on the frame, which is also where the moves are handled: a
    // capture on a child would send the rest of the gesture somewhere else.
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onPointerMove = (event: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    const point = pointFraction(event);

    if (drag.mode === 'draw') {
      setCrop(boxBetween(drag.anchorX, drag.anchorY, point.x, point.y));
      return;
    }

    if (drag.mode === 'resize') {
      setCrop(resized(drag.origin, drag.grip, point.x, point.y));
      return;
    }

    setCrop({
      ...drag.origin,
      x: Math.max(0, Math.min(1 - drag.origin.width, drag.origin.x + (point.x - drag.x))),
      y: Math.max(0, Math.min(1 - drag.origin.height, drag.origin.y + (point.y - drag.y)))
    });
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;

    setArming(false);
    // A drag too small to be a frame was a tap: back to the whole picture,
    // rather than a sliver of it nobody meant to choose.
    setCrop((current) =>
      current === null || current.width < MIN_CROP || current.height < MIN_CROP ? null : current
    );
  };

  /** Draws the meme at full size and hands back the bytes. */
  const render = async (): Promise<{ blob: Blob; width: number; height: number } | null> => {
    const image = imageRef.current;
    if (!image) return null;

    const box = cropInPixels(crop ?? { x: 0, y: 0, width: 1, height: 1 }, image.naturalWidth, image.naturalHeight);
    const layout = memeLayout(box.width, box.height, barShare);

    const canvas = document.createElement('canvas');
    canvas.width = layout.width;
    canvas.height = layout.height;

    const context = canvas.getContext('2d');
    if (context === null) return null;

    context.drawImage(image, box.x, box.y, box.width, box.height, 0, 0, layout.width, layout.imageHeight);

    context.fillStyle = '#000';
    context.fillRect(0, layout.imageHeight, layout.width, layout.barHeight);

    const words = caption.trim();
    if (words.length > 0) {
      const font = (size: number) => `700 ${size}px 'Source Sans 3', system-ui, sans-serif`;
      const fit = fitCaption(words, layout, (text, size) => {
        context.font = font(size);
        return context.measureText(text).width;
      });

      context.font = font(fit.fontSize);
      context.fillStyle = '#fff';
      context.textAlign = 'center';
      context.textBaseline = 'middle';

      const block = fit.lines.length * fit.lineHeight;
      const top = layout.imageHeight + (layout.barHeight - block) / 2 + fit.lineHeight / 2;
      fit.lines.forEach((line, index) => {
        context.fillText(line, layout.width / 2, top + index * fit.lineHeight);
      });
    }

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    return blob === null ? null : { blob, width: layout.width, height: layout.height };
  };

  const save = async () => {
    setBusy(true);
    const drawn = await render();
    if (drawn === null) {
      setBusy(false);
      return;
    }
    await onSave(drawn.blob, { width: drawn.width, height: drawn.height }, caption.trim());
    setBusy(false);
  };

  return (
    <Fullscreen label="Zrób mem" onClose={onClose}>
      <div className="ev-meme-maker">
        {step === 'pick' ? (
          <>
            <h3>Wybierz zdjęcie</h3>
            <div className="ev-meme-picks">
              {pictures.map((picture) => (
                <button
                  key={picture.id}
                  type="button"
                  onClick={() => {
                    setChosen(picture.id);
                    setCrop(null);
                    setArming(false);
                    setStep('frame');
                  }}
                >
                  <img src={eventPhotoUrl(picture.id)} alt={picture.label} loading="lazy" />
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div
              className="ev-meme-frame"
              ref={frameRef}
              data-arming={arming}
              data-cropping={crop !== null}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {chosen ? (
                <img ref={imageRef} src={eventPhotoUrl(chosen)} alt="" crossOrigin="anonymous" draggable={false} />
              ) : null}

              {crop !== null ? (
                <div
                  className="ev-meme-crop"
                  style={{
                    left: `${crop.x * 100}%`,
                    top: `${crop.y * 100}%`,
                    width: `${crop.width * 100}%`,
                    height: `${crop.height * 100}%`
                  }}
                >
                  {/* Drawn, not listened to: the frame handles every press
                      itself and works out which corner was taken, so a handle
                      can never swallow the gesture meant for the box. */}
                  <span className="ev-meme-grip is-nw" />
                  <span className="ev-meme-grip is-ne" />
                  <span className="ev-meme-grip is-sw" />
                  <span className="ev-meme-grip is-se" />
                </div>
              ) : null}

              {arming && crop === null ? (
                <p className="ev-meme-arming">Przeciągnij po zdjęciu, żeby zaznaczyć fragment</p>
              ) : null}
            </div>

            <div className="ev-meme-actions">
              {crop === null ? (
                <button type="button" className={arming ? 'ev-cta' : 'ev-ghost'} onClick={() => setArming(true)}>
                  {arming ? 'Przeciągnij po zdjęciu…' : 'Zaznacz fragment'}
                </button>
              ) : (
                <button type="button" className="ev-ghost" onClick={() => { setCrop(null); setArming(false); }}>
                  Cały obrazek
                </button>
              )}
              <span className="ev-meme-state">{crop === null ? 'Używasz całego zdjęcia' : 'Używasz zaznaczonego fragmentu'}</span>
            </div>

            <p className="ev-meme-strip">{caption.trim() || 'Tu pojawi się Twój podpis'}</p>

            <input
              className="ev-roster-sms-text"
              value={caption}
              maxLength={140}
              placeholder="Podpis pod zdjęciem"
              aria-label="Podpis mema"
              onChange={(event) => setCaption(event.target.value)}
            />

            <div className="ev-meme-actions">
              <button type="button" className="ev-ghost" onClick={() => setStep('pick')}>
                Inne zdjęcie
              </button>
              <button type="button" className="ev-cta" disabled={busy} onClick={() => void save()}>
                {busy ? 'Zapisuję…' : 'Zapisz mem'}
              </button>
            </div>
          </>
        )}
      </div>
    </Fullscreen>
  );
}

// ── Editor ───────────────────────────────────────────────────────────────────

function MemeEditor({
  config,
  onChange,
  siteId
}: {
  config: MemeConfig;
  onChange: (next: MemeConfig) => void;
  siteId: string;
}) {
  const [galleries, setGalleries] = useState<Array<{ value: string; label: string }>>([]);

  useEffect(() => {
    let active = true;
    getEventAdminSite(siteId)
      .then((site) => {
        if (!active) return;
        setGalleries(
          site.pages.flatMap((page) =>
            page.parts
              .filter((part) => part.kind === 'gallery')
              .map((part) => ({ value: part.id, label: `${page.menuLabel} · ${part.menuLabel}` }))
          )
        );
      })
      .catch(() => {
        if (active) setGalleries([]);
      });
    return () => {
      active = false;
    };
  }, [siteId]);

  return (
    <>
      <p className="eve-hint">
        Uczestnik wybiera zdjęcie z galerii, kadruje je i dopisuje podpis. Gotowy mem zapisuje się przy tej
        części — tak samo jak zdjęcie w galerii — więc widać go tutaj, a autor może go usunąć.
      </p>

      <SelectRow
        label="Zdjęcia z galerii"
        value={config.sourcePartId}
        options={[{ value: '', label: '— memy zrobione tutaj —' }, ...galleries]}
        onChange={(sourcePartId) => onChange({ ...config, sourcePartId })}
      />
      {galleries.length === 0 ? (
        <p className="eve-hint">W tym wydarzeniu nie ma jeszcze części „Galeria”.</p>
      ) : null}

      <TextRow
        label="Zaproszenie nad przyciskiem"
        value={config.inviteText ?? ''}
        placeholder="Zrób własny mem ze zdjęć z galerii."
        onChange={(inviteText) => onChange({ ...config, inviteText: inviteText || null })}
      />

      <CheckRow
        label="Gotowe memy pokazuj też w galerii"
        checked={config.shareToGallery}
        onChange={(shareToGallery) => onChange({ ...config, shareToGallery })}
      />
      <p className="eve-hint">
        Domyślnie memy zostają na tej części — galeria pokazuje zdjęcia z wydarzenia, a nie ich podpisane
        wersje. Włącz, jeśli mają trafiać także do galerii, z której powstały.
      </p>

      <SelectRow
        label="Wysokość czarnego paska"
        value={String(config.barShare)}
        options={[
          { value: '0.18', label: 'Niski — mniej więcej 1/5 obrazka' },
          { value: String(BAR_SHARE), label: 'Zwykły — mniej więcej 1/4 obrazka' },
          { value: '0.28', label: 'Wysoki — na dłuższe podpisy' }
        ]}
        onChange={(barShare) => onChange({ ...config, barShare: Number(barShare) })}
      />
    </>
  );
}
