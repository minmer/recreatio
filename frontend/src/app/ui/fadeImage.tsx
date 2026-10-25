/**
 * 2026-10-25 — EIN BILD, DAS NOCH LÄDT, STEHT NICHT HALB DA (Wunsch des Nutzers): es
 * bleibt unsichtbar, bis es geladen und entschlüsselt ist, und blendet dann ein. Was
 * schon geladen ist (im Speicher des Browsers oder in diesem Tab einmal gesehen), steht
 * sofort da — ein Wechsel zwischen Slajdy blendet nichts neu ein.
 *
 * Zwei Formen: `useImageReady` für Bilder, die als Hintergrund gemalt werden (die
 * Schichten der Slajdy und Szenen, `deckLayers.tsx`), und `FadeImg` für ein `<img>`.
 * Wie schnell es einblendet, sagt `motion.css` (`.wk-layer-image`, `.wk-fade`); bei
 * „weniger Bewegung" erscheint es ohne Übergang.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ImgHTMLAttributes, type SyntheticEvent } from 'react';

/** Was in diesem Tab schon geladen und entschlüsselt ist. */
const decoded = new Set<string>();

/** Ohne Fenster (Zeichnen am Server, Prüfskripte) gibt es nichts zu warten. */
const noBrowser = (): boolean => typeof Image === 'undefined';

/** Schon da? Ein Bild im Speicher des Browsers ist gleich nach dem Setzen von `src` vollständig. */
function already(src: string): boolean {
  if (src === '' || noBrowser() || decoded.has(src)) return true;
  const probe = new Image();
  probe.src = src;
  if (probe.complete && probe.naturalWidth > 0) {
    decoded.add(src);
    return true;
  }
  return false;
}

/** Ist das Bild unter `src` geladen und entschlüsselt? Ein Fehler zählt auch als fertig — sonst bliebe die Stelle für immer leer. */
export function useImageReady(src: string): boolean {
  const [ready, setReady] = useState(() => already(src));

  useEffect(() => {
    if (already(src)) { setReady(true); return undefined; }
    setReady(false);
    let alive = true;
    const img = new Image();
    const done = () => {
      decoded.add(src);
      if (alive) setReady(true);
    };
    img.decoding = 'async';
    img.onload = () => {
      if (typeof img.decode === 'function') void img.decode().then(done, done);
      else done();
    };
    img.onerror = done;
    img.src = src;
    return () => { alive = false; };
  }, [src]);

  return ready;
}

/** Ein `<img>`, das erst erscheint, wenn es geladen ist — und dann einblendet. */
export function FadeImg({ className, onLoad, onError, ...rest }: ImgHTMLAttributes<HTMLImageElement>) {
  const ref = useRef<HTMLImageElement | null>(null);
  const [shown, setShown] = useState(true);

  /* Vor dem ersten Bild: ist es schon da (im Speicher), bleibt es einfach stehen. */
  useLayoutEffect(() => {
    const el = ref.current;
    setShown(el === null || (el.complete && el.naturalWidth > 0));
  }, [rest.src]);

  const done = (event: SyntheticEvent<HTMLImageElement>, then?: (event: SyntheticEvent<HTMLImageElement>) => void) => {
    setShown(true);
    then?.(event);
  };

  return (
    <img
      {...rest}
      ref={ref}
      className={`wk-fade${shown ? '' : ' is-loading'}${className === undefined ? '' : ` ${className}`}`}
      onLoad={(event) => done(event, onLoad)}
      onError={(event) => done(event, onError)}
    />
  );
}
