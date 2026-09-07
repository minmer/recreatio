/**
 * Ein Bild aus dem verschluesselten Speicher.
 *
 * <b>Warum das nicht `<img src>` ist.</b> Der Inhalt liegt verschluesselt, und
 * der Dienst liefert ihn IMMER als `octet-stream` mit `Content-Disposition:
 * attachment`. Das ist kein Versehen: ein als Bild angekuendigtes HTML fuehrte
 * sonst im Ursprung dieser Seite aus und koennte alles lesen, was hier steht.
 * Der Preis ist genau diese Datei.
 *
 * Also wird geholt, entschluesselt beim Dienst, als Blob empfangen und daraus
 * eine Objekt-Adresse gemacht.
 *
 * <b>Die Adresse wird wieder freigegeben.</b> Eine Galerie mit zweihundert
 * Fotos, deren Objekt-Adressen niemand zurueckgibt, haelt zweihundert Bilder im
 * Speicher, bis die Karte geschlossen wird — auf einem Telefon reicht das, um
 * sie zu beenden.
 *
 * <b>Ein Fehlschlag blendet die Kachel nicht aus.</b> Wer ein Bild nicht laden
 * kann, soll die Luecke sehen und nicht eine Galerie, die stillschweigend
 * kuerzer ist als die Anzahl, die daneben steht.
 */

import { useEffect, useState } from 'react';

import { rcMediaUrl } from './rcPartsApi';

export function RcMedia({
  mediaId, alt, className, onClick
}: {
  mediaId: string;
  alt: string;
  className?: string;
  onClick?: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let made: string | null = null;

    void (async () => {
      try {
        const objectUrl = await rcMediaUrl(mediaId);

        /*
         * Der Teil kann verschwunden sein, waehrend geladen wurde. Dann ist die
         * Adresse schon niemandes mehr und muss sofort zurueck — sie in den
         * Zustand zu schreiben hiesse, in ein abgeraeumtes Bauteil zu schreiben.
         */
        if (!alive) { URL.revokeObjectURL(objectUrl); return; }

        made = objectUrl;
        setUrl(objectUrl);
      } catch {
        if (alive) setFailed(true);
      }
    })();

    return () => {
      alive = false;
      if (made !== null) URL.revokeObjectURL(made);
    };
  }, [mediaId]);

  if (failed) {
    return (
      <span className={`rcm rcm-failed ${className ?? ''}`.trim()} role="img" aria-label={alt}>
        Nie udało się wczytać
      </span>
    );
  }

  if (url === null) {
    return <span className={`rcm rcm-loading ${className ?? ''}`.trim()} aria-hidden="true" />;
  }

  return <img className={className} src={url} alt={alt} loading="lazy" onClick={onClick} />;
}

export default RcMedia;
