import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteEventImage, eventImageUrl, getEventImages, uploadEventImage, type EventImage } from '../../../lib/api';

/**
 * Upload a picture for this event, or pick one already uploaded. Writes the
 * chosen image's address back to the caller, so a URL field stays the single
 * source of truth and an external address still works.
 *
 * Shared by everything in the builder that takes a picture — slide backgrounds
 * and the catalogue thumbnail — so the pictures of one event are one library,
 * uploaded once and reusable wherever they fit.
 */
export function ImagePicker({
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
