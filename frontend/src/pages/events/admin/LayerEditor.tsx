import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteEventImage, eventImageUrl, getEventImages, uploadEventImage, type EventImage } from '../../../lib/api';
import { defaultLayersJson, parseLayers, type Layer, type ThemeMode } from '../shell/layers';
import { LinesRow, ListEditor, NumberRow, SelectRow, TextRow } from '../parts/editorKit';

const KIND_OPTIONS: Array<{ value: Layer['kind']; label: string }> = [
  { value: 'gradient', label: 'Gradient' },
  { value: 'image', label: 'Obraz' },
  { value: 'bigtext', label: 'Duży napis' }
];

const BLEND_OPTIONS = [
  { value: 'normal' as const, label: 'Zwykłe' },
  { value: 'multiply' as const, label: 'Mnożenie' },
  { value: 'screen' as const, label: 'Rozjaśnianie' },
  { value: 'overlay' as const, label: 'Nakładka' },
  { value: 'soft-light' as const, label: 'Miękkie światło' }
];

function blankLayer(kind: Layer['kind'], mode: ThemeMode): Layer {
  if (kind === 'image') {
    return { kind: 'image', speed: 0.34, url: '', opacity: 0.45, blend: 'normal', position: 'center' };
  }
  if (kind === 'bigtext') {
    return { kind: 'bigtext', speed: 0.95, lines: ['NAPIS'], opacity: 0.09, color: null };
  }
  // A dark gradient under a light event would undo the mode at the first part.
  return mode === 'light'
    ? { kind: 'gradient', speed: 0.12, angle: 168, from: '#fbfcfe', via: null, to: '#dfe7f2' }
    : { kind: 'gradient', speed: 0.12, angle: 168, from: '#12203a', via: null, to: '#060a12' };
}

/** Edits the background stack behind one part. */
export function LayerEditor({
  siteId,
  mode,
  layersJson,
  menuLabel,
  onChange
}: {
  siteId: string;
  mode: ThemeMode;
  layersJson: string | null;
  menuLabel: string;
  onChange: (json: string) => void;
}) {
  const layers = parseLayers(layersJson, mode);

  const write = (next: Layer[]) => onChange(JSON.stringify(next, null, 2));

  return (
    <>
      <ListEditor<Layer>
        legend="Warstwy tła (od tyłu do przodu)"
        items={layers}
        addLabel="Dodaj warstwę"
        blank={() => blankLayer('gradient', mode)}
        titleOf={(layer) => KIND_OPTIONS.find((entry) => entry.value === layer.kind)?.label ?? layer.kind}
        onChange={write}
        renderItem={(layer, update) => (
          <>
            <SelectRow<Layer['kind']>
              label="Rodzaj"
              value={layer.kind}
              options={KIND_OPTIONS}
              onChange={(kind) => update({ ...blankLayer(kind, mode), speed: layer.speed })}
            />
            <NumberRow
              label={layer.kind === 'bigtext' ? 'Długość przejazdu (0–1)' : 'Tempo (0–1)'}
              step={0.01}
              value={layer.speed}
              hint={
                layer.kind === 'bigtext'
                  ? 'Napis wędruje z dołu do góry ekranu. 1 = pełna wysokość ekranu.'
                  : '0 = warstwa stoi w miejscu, 1 = przesuwa się razem z treścią.'
              }
              onChange={(speed) => update({ ...layer, speed: Math.max(0, Math.min(1, speed)) })}
            />

            {layer.kind === 'gradient' ? (
              <>
                <NumberRow label="Kąt" value={layer.angle} onChange={(angle) => update({ ...layer, angle })} />
                <TextRow label="Kolor początkowy" value={layer.from} onChange={(from) => update({ ...layer, from })} />
                <TextRow
                  label="Kolor pośredni"
                  value={layer.via ?? ''}
                  onChange={(via) => update({ ...layer, via: via || null })}
                />
                <TextRow label="Kolor końcowy" value={layer.to} onChange={(to) => update({ ...layer, to })} />
              </>
            ) : null}

            {layer.kind === 'image' ? (
              <>
                <ImagePicker
                  siteId={siteId}
                  value={layer.url}
                  onPick={(url) => update({ ...layer, url })}
                />
                <TextRow
                  label="Adres obrazu"
                  value={layer.url}
                  hint="Wypełnia się po wgraniu pliku. Można też wkleić adres z zewnątrz."
                  onChange={(url) => update({ ...layer, url })}
                />
                <NumberRow
                  label="Krycie (0–1)"
                  step={0.05}
                  value={layer.opacity}
                  onChange={(opacity) => update({ ...layer, opacity: Math.max(0, Math.min(1, opacity)) })}
                />
                <SelectRow
                  label="Tryb mieszania"
                  value={layer.blend}
                  options={BLEND_OPTIONS}
                  onChange={(blend) => update({ ...layer, blend })}
                />
                <TextRow
                  label="Pozycja"
                  value={layer.position}
                  hint="Np. center, top, 50% 30%."
                  onChange={(position) => update({ ...layer, position })}
                />
              </>
            ) : null}

            {layer.kind === 'bigtext' ? (
              <>
                <LinesRow
                  label="Linie napisu"
                  rows={3}
                  hint="Maksymalnie trzy linie."
                  values={layer.lines}
                  onChange={(lines) => update({ ...layer, lines })}
                />
                <NumberRow
                  label="Krycie (0–1)"
                  step={0.01}
                  value={layer.opacity}
                  onChange={(opacity) => update({ ...layer, opacity: Math.max(0, Math.min(1, opacity)) })}
                />
                <TextRow
                  label="Kolor"
                  value={layer.color ?? ''}
                  hint="Puste = kolor tekstu motywu."
                  onChange={(color) => update({ ...layer, color: color || null })}
                />
              </>
            ) : null}
          </>
        )}
      />
      <button type="button" className="eve-add" onClick={() => onChange(defaultLayersJson(menuLabel, mode))}>
        Przywróć domyślne warstwy
      </button>
    </>
  );
}

/**
 * Upload a picture for this event, or pick one already uploaded. Writes the
 * chosen image's address back into the layer, so the URL field stays the single
 * source of truth and an external address still works.
 */
function ImagePicker({
  siteId,
  value,
  onPick
}: {
  siteId: string;
  value: string;
  onPick: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [images, setImages] = useState<EventImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setImages(await getEventImages(siteId));
    } catch {
      // The list is a convenience; typing an address still works without it.
      setImages([]);
    }
  }, [siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const uploaded = await uploadEventImage(siteId, file);
      onPick(eventImageUrl(uploaded.id));
      await load();
    } catch (uploadError: unknown) {
      setError(uploadError instanceof Error ? uploadError.message : 'Nie udało się wgrać obrazu.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async (image: EventImage) => {
    if (!window.confirm(`Usunąć „${image.fileName}” z wydarzenia? Części, które go używają, przestaną go pokazywać.`)) {
      return;
    }
    try {
      await deleteEventImage(image.id);
      await load();
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : 'Nie udało się usunąć obrazu.');
    }
  };

  return (
    <div className="eva-images">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <p className="eve-hint">{busy ? 'Wgrywanie…' : 'JPG, PNG, WEBP, GIF lub AVIF, do 6 MB.'}</p>

      {images.length > 0 ? (
        <div className="eva-image-grid">
          {images.map((image) => {
            const url = eventImageUrl(image.id);
            return (
              <div key={image.id} className={`eva-image ${url === value ? 'is-picked' : ''}`}>
                <button type="button" onClick={() => onPick(url)} title={image.fileName}>
                  <img src={url} alt={image.fileName} loading="lazy" />
                </button>
                <button type="button" className="eva-image-remove" onClick={() => void remove(image)} aria-label="Usuń">
                  ×
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {error ? <p className="eve-error">{error}</p> : null}
    </div>
  );
}
