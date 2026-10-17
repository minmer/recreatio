/**
 * GALERIA — ein Bild vorne, zwei dahinter auf jeder Seite; ein Klick öffnet
 * die ganze Galerie im Vollbild mit Pfeilen, Wischen, Zoom und Leiste
 * (Altbestand: `GalleryPart`, `galleryView.tsx`).
 *
 * <b>Die Bilder gehören der Seite</b> (`PageImage.cs`). Im Editor lassen sich
 * mehrere auf einmal hochladen; der Browser verkleinert sie vorher auf 2048 px
 * an der langen Kante (`imageDownscale.ts`) — acht Megabyte vom Telefon werden
 * ein paar hundert Kilobyte, und die EXIF-Daten, mit dem Ort der Aufnahme,
 * überleben das nicht.
 *
 * Was der Altbestand zusätzlich konnte — Teilnehmer mit Link legen eigene
 * Bilder dazu —, hing an einem Dienst, den es im Neubau (noch) nicht gibt.
 *
 * <b>Je Grösse:</b> im Streifen klappt sie auf; sonst das Karussell.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { asRecord, asText, asOptionalText, CheckRow, defineEventPart, ImageRow, ListEditor, mapEntries, TextRow } from '../event/kit';
import { Carousel, shuffled, Viewer, type Picture } from '../event/galleryView';
import { photoCount } from '../event/galleryCount';
import { downscaleImage } from '../event/imageDownscale';
import { imageRef, uploadPageFile } from '../pageImages';
import { WorkspaceError } from '../session';
import { imageUrl } from '../slides';

type Shot = { url: string; caption: string | null; alt: string };
type GalleryConfig = { shots: Shot[]; shuffle: boolean };

/** Wie lange der Hinweis stehen bleibt, und nach wie vielen Bildern er wiederkommt. */
const HINT_MS = 5000;
const HINT_AGAIN_AFTER = 4;

function Gallery({ config }: { config: GalleryConfig }) {
  const [open, setOpen] = useState<string | null>(null);
  const [front, setFront] = useState(0);
  const [steps, setSteps] = useState(0);
  const [everOpened, setEverOpened] = useState(false);
  const [hint, setHint] = useState(false);
  const due = useRef(3);
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 31) || 1);

  const pictures = useMemo<Picture[]>(() => config.shots.filter((shot) => shot.url.length > 0).map((shot, index) => ({
    key: `shot-${index}`,
    url: imageUrl(shot.url),
    caption: shot.caption,
    alt: shot.alt,
    credit: null,
    photoId: null,
    mine: false,
    addedAt: '',
    width: 0,
    height: 0
  })), [config.shots]);

  /* Die Reihenfolge des Karussells, einmal je Besuch gezogen; die Galerie dahinter bleibt, wie sie ist. */
  const ring = useMemo(() => (config.shuffle ? shuffled(pictures, seed) : pictures), [pictures, config.shuffle, seed]);

  /*
   * Der Hinweis „Kliknij zdjęcie…" kommt erst, wenn jemand drei Bilder weit
   * blättert, ohne eins zu öffnen — und geht nach ein paar Sekunden wieder.
   */
  useEffect(() => {
    if (everOpened || pictures.length < 2 || steps < due.current) return undefined;
    setHint(true);
    const timer = window.setTimeout(() => { setHint(false); due.current = steps + HINT_AGAIN_AFTER; }, HINT_MS);
    return () => window.clearTimeout(timer);
  }, [steps, everOpened, pictures.length]);

  useEffect(() => { setFront((current) => (ring.length === 0 ? 0 : current % ring.length)); }, [ring.length]);

  const openAt = open === null ? -1 : pictures.findIndex((picture) => picture.key === open);

  return (
    <div className="ev-gallery">
      <Carousel
        pictures={ring}
        front={front}
        hint={hint}
        onFront={(index) => { setFront(index); setSteps((n) => n + 1); }}
        onOpen={(key) => { setEverOpened(true); setHint(false); setOpen(key); }}
      />
      {openAt >= 0 && (
        <Viewer pictures={pictures} start={openAt} mayManage={false} onRemove={() => undefined} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

/** Mehrere Bilder auf einmal — verkleinert, an die Seite gelegt, hinten angefügt. */
function BulkUpload({ path, busy, onAdded }: { path: string; busy: boolean; onAdded: (shots: Shot[]) => void }) {
  const [working, setWorking] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const input = useRef<HTMLInputElement | null>(null);

  const send = async (files: File[]) => {
    setFailed(null);
    const added: Shot[] = [];
    for (const [index, file] of files.entries()) {
      setWorking(`Wysyłanie ${index + 1} z ${files.length}…`);
      try {
        const shrunk = await downscaleImage(file);
        const made = await uploadPageFile(path, shrunk.blob, shrunk.fileName, shrunk.blob.type || 'image/jpeg');
        added.push({ url: imageRef(made.id), caption: null, alt: '' });
      } catch (e) {
        setFailed(e instanceof WorkspaceError || e instanceof Error ? e.message : 'Nie udało się wysłać zdjęcia.');
        break;
      }
    }
    setWorking(null);
    if (added.length > 0) onAdded(added);
  };

  return (
    <div className="pe-bulk">
      <button type="button" className="wk-btn" disabled={busy || working !== null} onClick={() => input.current?.click()}>
        {working ?? 'Dodaj zdjęcia z dysku'}
      </button>
      <input ref={input} type="file" accept="image/*" multiple hidden
        onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ''; if (files.length > 0) void send(files); }} />
      <span className="wk-hint">Zdjęcia są zmniejszane przed wysłaniem (dłuższy bok do 2048 px), a dane EXIF — w tym miejsce zrobienia — nie są wysyłane.</span>
      {failed !== null && <span className="wk-error">{failed}</span>}
    </div>
  );
}

export const galleryPart = defineEventPart<GalleryConfig>({
  kind: 'gallery',
  label: 'Galeria',
  use: 'Karuzela zdjęć; kliknięcie otwiera całą galerię na pełnym ekranie, z powiększaniem.',
  box: { colSpan: 6, rowSpan: 5 },
  strip: { title: 'Galeria', open: 'Pokaż zdjęcia' },

  blank: () => ({ shots: [], shuffle: true }),
  example: () => ({ shots: [{ url: 'https://…/zdjecie.jpg', caption: 'Wyjazd z Krakowa', alt: 'Grupa rowerzystów o świcie' }], shuffle: true }),

  /* 0064 — was jeder Schlüssel im JSON bedeutet (die Beschreibung neben dem Import). */
  keys: {
    shots: 'Zdjęcia — lista',
    'shots[].url': 'Adres https://… albo plik strony "page-image:<id>" (wgrywa się w edytorze)',
    'shots[].caption': 'Podpis (albo null)',
    'shots[].alt': 'Opis zdjęcia dla czytników ekranu',
    shuffle: 'true — kolejność losowa przy każdym wejściu, false — jak na liście'
  },

  parse: (raw) => {
    const record = asRecord(raw);
    return {
      /* Nichts fällt beim Lesen weg — ein Bild wird ohne Adresse angelegt. Die Ansicht nimmt nur die mit. */
      shots: mapEntries<Shot>(record.shots, (item) => {
        const caption = asOptionalText(item.caption);
        return { url: asText(item.url).trim(), caption, alt: asText(item.alt, caption ?? '').trim() };
      }),
      shuffle: record.shuffle !== false
    };
  },

  hasContent: (c) => c.shots.some((shot) => shot.url !== ''),

  shows: (c, size) => size.height === 'strip' ? 'Przycisk, który rozwija galerię.'
    : `Karuzela — ${photoCount(c.shots.filter((s) => s.url !== '').length)}; kliknięcie otwiera całą galerię.`,

  Body: ({ config }) => <Gallery config={config} />,

  Edit: ({ config, onChange, ctx, busy }) => (
    <>
      {ctx.path !== null && (
        <BulkUpload path={ctx.path} busy={busy} onAdded={(shots) => onChange({ ...config, shots: [...config.shots, ...shots] })} />
      )}
      <CheckRow label="Losowa kolejność przy każdym wejściu" checked={config.shuffle} onChange={(shuffle) => onChange({ ...config, shuffle })} />
      <ListEditor<Shot>
        legend={`Zdjęcia (${config.shots.length})`}
        items={config.shots}
        addLabel="Dodaj zdjęcie"
        blank={() => ({ url: '', caption: null, alt: '' })}
        titleOf={(item, index) => item.caption || `Zdjęcie ${index + 1}`}
        onChange={(shots) => onChange({ ...config, shots })}
        renderItem={(item, update) => (
          <>
            <ImageRow label="Zdjęcie" value={item.url} ctx={ctx} busy={busy} onChange={(url) => update({ ...item, url })} />
            <TextRow label="Podpis" value={item.caption ?? ''} onChange={(caption) => update({ ...item, caption: caption || null })} />
            <TextRow label="Opis alternatywny" value={item.alt} hint="Dla osób korzystających z czytnika ekranu." onChange={(alt) => update({ ...item, alt })} />
          </>
        )}
      />
    </>
  )
});
