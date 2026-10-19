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
 *
 * <b>2026-10-19 — auf der Bühne</b> (Hortus Dei):
 *
 * <code>
 *   Ausschnitt   der Mittelpunkt kommt vom Platz der Szene (`--pz-crop`), sonst von "at"
 *   Laden        auf einer Bühne sofort (nicht erst, wenn es ins Bild rollt) — bis es da ist,
 *                steht eine ruhige Fläche in den Farben der Szene, dann blendet es weich ein:
 *                kein leerer, kein blitzender Kadr, auch wenn die Datei langsam kommt
 *   Film         "video": ein kurzer Film ohne Ton in Schleife (Feuer, Blätter) — das Bild ist
 *                sein Plakat: es steht, bis der Film läuft, solange er nicht zu sehen ist, bei
 *                „weniger Bewegung" und bei „Daten sparen"; abgespielt wird nur, was zu sehen ist
 * </code>
 */

import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { MediaPicker, ImagePicker } from '../PageFiles';
import { definePart, lines, text, type EditorProps, type RawConfig } from '../part';
import { mediaUrl, textLink } from '../presentation/presentation';
import { imageUrl } from '../slides/slideLook';
import { SlidePhase, usePhase, useReducedMotion } from '../motion/MotionBox';

interface Config {
  readonly url: string;
  readonly alt: string;
  readonly caption: readonly string[];
  readonly link: string | null;
  readonly fit: 'contain' | 'cover';
  readonly at: string;
  /** 2026-10-19 — ein kurzer Film ohne Ton in Schleife; das Bild ist sein Plakat. */
  readonly video: string;
}

const read = (raw: RawConfig): Config => ({
  url: text(raw, 'url'),
  alt: text(raw, 'alt'),
  caption: lines(raw, 'caption'),
  link: textLink(text(raw, 'link')),
  fit: text(raw, 'fit') === 'cover' ? 'cover' : 'contain',
  at: text(raw, 'at').slice(0, 40) || 'center',
  video: mediaUrl(text(raw, 'video')) ?? ''
});

/** „Daten sparen" im Browser (Telefon mit wenig Datenvolumen) — dann kein Film, nur das Plakat. */
function saveData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

function ImageView({ config }: { config: Config }) {
  /* Auf einer Bühne (Präsentation, Slajdy) — dann sofort laden: die nächste Szene soll nicht leer hereinkommen. */
  const onStage = useContext(SlidePhase) !== null;
  const reduced = useReducedMotion();
  const box = useRef<HTMLElement | null>(null);
  const phase = usePhase(box);
  const img = useRef<HTMLImageElement | null>(null);
  const film = useRef<HTMLVideoElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const playing = config.video !== '' && !reduced && !saveData();
  const position = `var(--pz-crop, ${config.at})`;

  /* Ein neues Bild: wieder warten — es sei denn, es liegt schon im Speicher des Browsers (dann kommt kein `load`). */
  useLayoutEffect(() => {
    const el = img.current;
    setLoaded(el !== null && el.complete && el.naturalWidth > 0);
  }, [config.url, playing]);

  /* Der Film läuft nur, solange er zu sehen ist. */
  useEffect(() => {
    const el = film.current;
    if (el === null) return;
    if (phase === 'away') el.pause();
    else void el.play().catch(() => undefined);
  }, [phase, playing, config.video]);

  /* 2026-10-19 — sichtbar erst, wenn es entschlüsselt ist: sonst stünde beim Wechsel einen Augenblick ein leerer Rahmen da. */
  const ready = () => {
    const el = img.current;
    if (el !== null && typeof el.decode === 'function') void el.decode().then(() => setLoaded(true), () => setLoaded(true));
    else setLoaded(true);
  };

  /* Die Szene ist nah (die nächste): das Bild schon jetzt entschlüsseln, nicht erst, wenn sie kommt. */
  useEffect(() => {
    const el = img.current;
    if (el === null || phase === 'away' || typeof el.decode !== 'function') return;
    void el.decode().catch(() => undefined);
  }, [phase, config.url]);
  const style = { objectFit: config.fit, objectPosition: position } as const;
  const media = playing ? (
    /* Ein Film blendet nicht aus, solange er lädt: sein Plakat (das Bild) steht ja schon. */
    <video ref={film} className="wk-image-img" src={imageUrl(config.video)}
      poster={config.url === '' ? undefined : imageUrl(config.url)} muted loop playsInline preload={onStage ? 'auto' : 'metadata'}
      aria-label={config.alt === '' ? undefined : config.alt} onLoadedData={ready} onError={ready} style={style} />
  ) : (
    <img ref={img} className={`wk-image-img${loaded ? '' : ' is-loading'}`} src={imageUrl(config.url)} alt={config.alt}
      loading={onStage ? 'eager' : 'lazy'} decoding="async" onLoad={ready} onError={ready} style={style} />
  );
  const outside = config.link !== null && /^https?:/i.test(config.link);
  return (
    <figure ref={box} className={`wk-image is-${config.fit}${loaded ? '' : ' is-pending'}`}>
      {config.link === null ? media : (
        <a className="wk-image-link" href={config.link} {...(outside ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{media}</a>
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
      {/* 2026-10-19 — ein kurzer Film ohne Ton in Schleife; das Bild oben ist sein Plakat. */}
      <details className="wk-fold" open={config.video !== ''}>
        <summary>Film zamiast zdjęcia — kilka sekund bez dźwięku, w kółko; zdjęcie jest jego plakatem (opcjonalnie)</summary>
        {ctx.path !== null && (
          <MediaPicker path={ctx.path} kind="video" value={raw.video ?? ''} busy={busy} onPick={(video) => onSet({ video })} />
        )}
        <label className="se-inline">
          <span>Adres filmu (MP4, WebM)</span>
          <input value={raw.video ?? ''} disabled={busy} placeholder="page-image:… albo https://…/ognisko.mp4" maxLength={500} onChange={(e) => onSet({ video: e.target.value })} />
        </label>
      </details>
    </div>
  );
}

export const imagePart = definePart<Config>({
  kind: 'image',
  example: {
    url: '/Hortus.jpg', alt: 'Ośrodek Hortus Dei nocą, z ogniskiem', caption: 'Hortus Dei — dom w Limanowej', link: '#/rc/osrodek', fit: 'cover', at: '57% 50%',
    video: 'https://example.org/ognisko.mp4'
  },
  label: 'Obraz',
  use: 'Jedno zdjęcie, logo albo grafika — z podpisem i linkiem; na życzenie krótki film bez dźwięku w miejscu zdjęcia.',
  box: { colSpan: 3, rowSpan: 3 },

  fields: [
    { key: 'url', label: 'Obraz', kind: 'line', hint: 'wybierz powyżej albo adres: https://… lub /logo.svg' },
    { key: 'alt', label: 'Co przedstawia (dla czytników ekranu)', kind: 'line' },
    { key: 'caption', label: 'Podpis', kind: 'text', hint: 'może zostać pusty' },
    { key: 'link', label: 'Link po kliknięciu', kind: 'line', hint: 'https://…, #/strona albo pusty' }
  ],
  extra: [
    { key: 'fit', shape: 'line', says: '"contain" — cały obraz mieści się w miejscu (zwykle), "cover" — wypełnia miejsce i przycina brzegi' },
    { key: 'at', shape: 'line', says: 'Przy "cover": gdzie jest środek kadru, np. "center", "top", "57% 50%". W prezentacji miejsce na scenie może mieć własny "crop" (także w klatkach i na telefonie) — wtedy liczy się on' },
    { key: 'video', shape: 'line', says: 'Krótki film bez dźwięku w kółko zamiast zdjęcia (MP4 albo WebM): plik strony "page-image:<id>" albo "https://…". "url" jest jego plakatem — stoi, dopóki film się nie wczyta, przy „mniej ruchu” i przy oszczędzaniu danych; film gra tylko, gdy go widać' }
  ],

  read,
  hasContent: (c) => c.url !== '' || c.video !== '',
  missing: (c) => (c.url === '' && c.video === '' ? 'Wybierz obraz albo wpisz jego adres.' : null),
  shows: (c) => (c.video !== '' ? 'Film w miejscu zdjęcia.' : c.caption.length > 0 ? 'Obraz z podpisem.' : 'Obraz.'),
  Editor: ImageEditor,
  View: ({ config }) => <ImageView config={config} />
});
