import { useEffect, useState } from 'react';
import { asOptionalText, asRecord, asText, definePart, mapEntries } from './contracts';
import { ListEditor, TextRow } from './editorKit';

type Shot = { url: string; caption: string | null; alt: string };

type GalleryConfig = { shots: Shot[] };

function Lightbox({ shot, onClose }: { shot: Shot; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="ev-lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <figure onClick={(event) => event.stopPropagation()}>
        <img src={shot.url} alt={shot.alt} />
        {shot.caption ? <figcaption>{shot.caption}</figcaption> : null}
      </figure>
      <button type="button" className="ev-lightbox-close" onClick={onClose} aria-label="Zamknij">
        ×
      </button>
    </div>
  );
}

/** Photos from past editions, or of the route. */
export const galleryPart = definePart<GalleryConfig>({
  kind: 'gallery',
  label: 'Galeria',
  description: 'Siatka zdjęć z podpisami i powiększeniem.',

  defaultConfig: () => ({ shots: [] }),

  example: () => ({
    shots: [{ url: 'https://…/zdjecie.jpg', caption: 'Wyjazd z Krakowa', alt: 'Grupa rowerzystów o świcie' }]
  }),

  parse: (raw) => ({
    shots: mapEntries<Shot>(asRecord(raw).shots, (item) => {
      const url = asText(item.url).trim();
      const caption = asOptionalText(item.caption);
      const alt = asText(item.alt, caption ?? '').trim();
      // A shot added in the builder starts with no address at all. Dropping it
      // here left the "add" button doing nothing; the renderer skips the ones
      // that still have no picture.
      if (url.length === 0 && caption === null && alt.length === 0) return null;
      return { url, caption, alt };
    })
  }),

  Renderer: ({ config }) => {
    const [open, setOpen] = useState<number | null>(null);
    // Nothing to show for an entry whose picture has not been named yet.
    const shots = config.shots.filter((shot) => shot.url.length > 0);

    if (shots.length === 0) {
      return <p className="ev-note">Nie dodano jeszcze zdjęć.</p>;
    }

    return (
      <div className="ev-gallery">
        <div className="ev-gallery-grid">
          {shots.map((shot, index) => (
            <button type="button" key={index} onClick={() => setOpen(index)}>
              <img src={shot.url} alt={shot.alt} loading="lazy" />
              {shot.caption ? <span>{shot.caption}</span> : null}
            </button>
          ))}
        </div>
        {open !== null && shots[open] ? (
          <Lightbox shot={shots[open]} onClose={() => setOpen(null)} />
        ) : null}
      </div>
    );
  },

  Editor: ({ config, onChange }) => (
    <ListEditor<Shot>
      legend="Zdjęcia"
      items={config.shots}
      addLabel="Dodaj zdjęcie"
      blank={() => ({ url: '', caption: null, alt: '' })}
      titleOf={(item, index) => item.caption || item.url || `Zdjęcie ${index + 1}`}
      onChange={(shots) => onChange({ shots })}
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
  )
});
