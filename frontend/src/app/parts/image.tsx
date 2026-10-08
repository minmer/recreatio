/**
 * OBRAZ (0085) — ein Bild: ein Zeichen, ein Foto, eine Grafik.
 *
 * <b>Gebraucht hat ihn die Präsentation</b> (das Zeichen, das auf der
 * Startseite durch den Raum fliegt und am Ende in der Ecke steht), aber er
 * ist ein gewöhnlicher Baustein: auf einer Seite ein Bild mit Unterschrift,
 * auf einem Slajd ebenso. Ein Bild dieser Seite (`page-image:…`, wie die
 * Hintergründe der Slajdy) oder eine Adresse.
 *
 * <b>Mit Verweis</b> wird das ganze Bild anklickbar — ein Zeichen, das zur
 * Seite führt, die es zeigt.
 */

import { ImagePicker } from '../PageFiles';
import { definePart, lines, text, type EditorProps, type RawConfig } from '../part';
import { textLink } from '../presentation';
import { imageUrl } from '../slides';

interface Config {
  readonly url: string;
  readonly alt: string;
  readonly caption: readonly string[];
  readonly link: string | null;
  readonly fit: 'contain' | 'cover';
  readonly at: string;
}

const read = (raw: RawConfig): Config => ({
  url: text(raw, 'url'),
  alt: text(raw, 'alt'),
  caption: lines(raw, 'caption'),
  link: textLink(text(raw, 'link')),
  fit: text(raw, 'fit') === 'cover' ? 'cover' : 'contain',
  at: text(raw, 'at').slice(0, 40) || 'center'
});

function ImageView({ config }: { config: Config }) {
  const img = (
    <img className="wk-image-img" src={imageUrl(config.url)} alt={config.alt} loading="lazy" decoding="async"
      style={{ objectFit: config.fit, objectPosition: config.at }} />
  );
  const outside = config.link !== null && /^https?:/i.test(config.link);
  return (
    <figure className={`wk-image is-${config.fit}`}>
      {config.link === null ? img : (
        <a className="wk-image-link" href={config.link} {...(outside ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{img}</a>
      )}
      {config.caption.length > 0 && (
        <figcaption className="wk-image-caption">
          {config.caption.map((line, i) => <span key={i}>{line}</span>)}
        </figcaption>
      )}
    </figure>
  );
}

/** Ein Bild der Seite wählen oder hochladen — dazu, wie es seinen Platz füllt. */
function ImageEditor({ raw, onSet, ctx, busy }: EditorProps) {
  const config = read(raw);
  return (
    <div className="wk-image-edit">
      {ctx.path !== null && (
        <ImagePicker path={ctx.path} value={raw.url ?? ''} busy={busy} onPick={(url) => onSet({ url })} />
      )}
      <label className="se-inline">
        <span>Wypełnienie</span>
        <select value={config.fit} disabled={busy} onChange={(e) => onSet({ fit: e.target.value })}>
          <option value="contain">Całe — mieści się w miejscu</option>
          <option value="cover">Kadr — wypełnia miejsce, przycina brzegi</option>
        </select>
      </label>
      {config.fit === 'cover' && (
        <label className="se-inline">
          <span>Środek kadru</span>
          <input value={raw.at ?? ''} disabled={busy} placeholder="center, top, 57% 50%" maxLength={40} onChange={(e) => onSet({ at: e.target.value })} />
        </label>
      )}
    </div>
  );
}

export const imagePart = definePart<Config>({
  kind: 'image',
  example: { url: '/Hortus.jpg', alt: 'Ośrodek Hortus Dei nocą, z ogniskiem', caption: 'Hortus Dei — dom w Limanowej', link: '#/rc/osrodek', fit: 'cover', at: '57% 50%' },
  label: 'Obraz',
  use: 'Jedno zdjęcie, logo albo grafika — z podpisem i linkiem.',
  box: { colSpan: 3, rowSpan: 3 },

  fields: [
    { key: 'url', label: 'Obraz', kind: 'line', hint: 'wybierz powyżej albo adres: https://… lub /logo.svg' },
    { key: 'alt', label: 'Co przedstawia (dla czytników ekranu)', kind: 'line' },
    { key: 'caption', label: 'Podpis', kind: 'text', hint: 'może zostać pusty' },
    { key: 'link', label: 'Link po kliknięciu', kind: 'line', hint: 'https://…, #/strona albo pusty' }
  ],
  extra: [
    { key: 'fit', shape: 'line', says: '"contain" — cały obraz mieści się w miejscu (zwykle), "cover" — wypełnia miejsce i przycina brzegi' },
    { key: 'at', shape: 'line', says: 'Przy "cover": gdzie jest środek kadru, np. "center", "top", "57% 50%"' }
  ],

  read,
  hasContent: (c) => c.url !== '',
  missing: (c) => (c.url === '' ? 'Wybierz obraz albo wpisz jego adres.' : null),
  shows: (c) => (c.caption.length > 0 ? 'Obraz z podpisem.' : 'Obraz.'),
  Editor: ImageEditor,
  View: ({ config }) => <ImageView config={config} />
});
