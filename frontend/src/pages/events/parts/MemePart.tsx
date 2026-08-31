import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  eventPhotoUrl,
  getEventAdminSite,
  getEventGallery,
  uploadEventPhoto,
  type EventGallery
} from '../../../lib/api';
import { asOptionalText, asRecord, asText, definePart } from './contracts';
import { Fullscreen } from './Fullscreen';
import { SelectRow, TextRow } from './editorKit';
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
};

export const memePart = definePart<MemeConfig>({
  kind: 'meme',
  label: 'Memy',
  description: 'Uczestnicy robią memy ze zdjęć z galerii: kadr, podpis na czarnym pasku, gotowe.',

  defaultConfig: () => ({ sourcePartId: '', inviteText: null, barShare: BAR_SHARE }),

  example: () => ({
    sourcePartId: '00000000-0000-0000-0000-000000000000',
    inviteText: 'Zrób mem ze zdjęć z trasy!',
    barShare: BAR_SHARE
  }),

  parse: (raw) => {
    const record = asRecord(raw);
    const share = Number(record.barShare);
    return {
      sourcePartId: asText(record.sourcePartId).trim(),
      inviteText: asOptionalText(record.inviteText),
      // A band beyond these bounds is either invisible or the whole picture.
      barShare: Number.isFinite(share) && share >= 0.12 && share <= 0.4 ? share : BAR_SHARE
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

  const pictures = useMemo(
    () => (sourceId === partId ? made?.photos ?? [] : source?.photos ?? []),
    [sourceId, partId, made, source]
  );

  const memes = made?.photos ?? [];
  const mayMake = made?.mayAdd === true && token !== null && pictures.length > 0;

  return (
    <div className="ev-memes">
      {memes.length === 0 ? (
        <p className="ev-note">Nikt jeszcze nie zrobił mema. Możesz być pierwszy.</p>
      ) : (
        <div className="ev-meme-grid">
          {memes.map((meme) => (
            <figure key={meme.id}>
              <img src={eventPhotoUrl(meme.id)} alt={meme.caption ?? 'Mem'} loading="lazy" />
              <figcaption>{meme.uploaderName}</figcaption>
            </figure>
          ))}
        </div>
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

/**
 * Three things in order: which picture, which part of it, what it says.
 *
 * Full screen, because framing a photograph inside a slide that is itself
 * scrolling is a fight nobody wins on a phone.
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
  const [crop, setCrop] = useState<CropBox>({ x: 0.05, y: 0.05, width: 0.9, height: 0.9 });
  const [busy, setBusy] = useState(false);

  const imageRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ mode: 'move' | 'size'; x: number; y: number; crop: CropBox } | null>(null);

  const pointerFraction = (event: ReactPointerEvent) => {
    const box = frameRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return { x: 0, y: 0 };
    return { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height };
  };

  const startDrag = (mode: 'move' | 'size') => (event: ReactPointerEvent) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerFraction(event);
    dragRef.current = { mode, x: point.x, y: point.y, crop };
  };

  const onDrag = (event: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    const point = pointerFraction(event);
    const dx = point.x - drag.x;
    const dy = point.y - drag.y;

    if (drag.mode === 'move') {
      setCrop({
        ...drag.crop,
        x: Math.max(0, Math.min(1 - drag.crop.width, drag.crop.x + dx)),
        y: Math.max(0, Math.min(1 - drag.crop.height, drag.crop.y + dy))
      });
      return;
    }

    setCrop({
      ...drag.crop,
      width: Math.max(0.15, Math.min(1 - drag.crop.x, drag.crop.width + dx)),
      height: Math.max(0.15, Math.min(1 - drag.crop.y, drag.crop.height + dy))
    });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  /** Draws the meme at full size and hands back the bytes. */
  const render = async (): Promise<{ blob: Blob; width: number; height: number } | null> => {
    const image = imageRef.current;
    if (!image) return null;

    const box = cropInPixels(crop, image.naturalWidth, image.naturalHeight);
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
            {/* The frame and the words on one screen: the caption changes what
                the crop should be at least as often as the other way round. */}
            <div className="ev-meme-frame" ref={frameRef} onPointerMove={onDrag} onPointerUp={endDrag}>
              {chosen ? (
                <img ref={imageRef} src={eventPhotoUrl(chosen)} alt="" crossOrigin="anonymous" draggable={false} />
              ) : null}

              <div
                className="ev-meme-crop"
                style={{
                  left: `${crop.x * 100}%`,
                  top: `${crop.y * 100}%`,
                  width: `${crop.width * 100}%`,
                  height: `${crop.height * 100}%`
                }}
                onPointerDown={startDrag('move')}
              >
                <span className="ev-meme-grip" onPointerDown={startDrag('size')} />
              </div>
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
