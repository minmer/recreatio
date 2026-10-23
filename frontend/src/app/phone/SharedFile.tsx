/**
 * EIN PLIK PRZEZ LINK — `#/plik/<geheimnis>` (0117), ohne Konto: wer den Link aus
 * der SMS oder aus einer E-Mail (Thunderbird, 0125) hat, sieht das Zdjęcie in voller
 * Grösse (oder den Film, das PDF) und kann es herunterladen.
 *
 * 2026-10-24 — VON SELBST, UND MIT WORTEN: die Seite holt und öffnet die Datei gleich,
 * gleich wie gross (früher wartete sie über 10 MB auf einen Tipp), und sagt dabei, was
 * geschieht — erst „Pobieranie" mit Balken und MB, dann „Odszyfrowywanie" — und bittet
 * um Geduld. Vorher stand dort nur ein schimmernder Platzhalter ohne sichtbaren Text.
 *
 * Geöffnet wird hier — der Schlüssel steht nur im Link, der Dienst kennt ihn nicht.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { Icon } from '../ui/icons';
import { fetchShare, ShareGone, shareInfo } from './share';
import { openShare, secretOf, shareKeys, shownAs, sizeText, type ShareHead } from './shareSeal';
import './phone.css';

type State =
  | { readonly step: 'info' }
  | { readonly step: 'loading'; readonly size: number; readonly done: number; readonly expiresAt: string }
  | { readonly step: 'opening'; readonly size: number; readonly expiresAt: string }
  | { readonly step: 'ready'; readonly head: ShareHead; readonly url: string; readonly expiresAt: string }
  | { readonly step: 'failed'; readonly message: string };

const until = (at: string) => new Date(at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Erst zeichnen lassen, dann rechnen: sonst stünde „Odszyfrowywanie" erst da, wenn es
 * vorbei ist. Spätestens nach 100 ms geht es trotzdem weiter — in einer Karte im
 * Hintergrund kommt kein Bild, und die Datei soll dort nicht liegen bleiben.
 */
const painted = () => new Promise<void>((resolve) => {
  let done = false;
  const go = () => { if (!done) { done = true; resolve(); } };
  requestAnimationFrame(() => setTimeout(go, 0));
  setTimeout(go, 100);
});

export function SharedFile({ secret: text }: { secret: string }) {
  const secret = useMemo(() => secretOf(text), [text]);
  const [state, setState] = useState<State>({ step: 'info' });
  const made = useRef<string | null>(null);

  /* Die Adresse einer geöffneten Datei gilt, solange die Seite steht. */
  useEffect(() => () => { if (made.current !== null) URL.revokeObjectURL(made.current); }, []);

  /* Gleich beim Öffnen: fragen, ob es den Link noch gibt — dann holen, dann öffnen. */
  useEffect(() => {
    if (secret === null) {
      setState({ step: 'failed', message: 'Ten link jest niepełny — sprawdź, czy skopiowano go w całości.' });
      return undefined;
    }
    let alive = true;
    void (async () => {
      let sealed: Uint8Array;
      let size = 0;
      let expiresAt = '';
      try {
        const { id } = await shareKeys(secret);
        ({ size, expiresAt } = await shareInfo(id));
        if (!alive) return;
        setState({ step: 'loading', size, done: 0, expiresAt });
        /* Je Prozent einmal neu zeichnen, nicht je Stück. */
        let percentShown = 0;
        sealed = await fetchShare(id, (done) => {
          const percent = size > 0 ? Math.floor((100 * done) / size) : 0;
          if (alive && percent !== percentShown) { percentShown = percent; setState({ step: 'loading', size, done, expiresAt }); }
        });
      } catch (e) {
        if (alive) setState({ step: 'failed', message: e instanceof ShareGone ? e.message : 'Nie udało się pobrać pliku.' });
        return;
      }
      if (!alive) return;

      setState({ step: 'opening', size, expiresAt });
      await painted();
      let opened: Awaited<ReturnType<typeof openShare>>;
      try {
        opened = await openShare(secret, sealed);
      } catch {
        if (alive) setState({ step: 'failed', message: 'Ten link jest uszkodzony albo niepełny — pliku nie da się odszyfrować.' });
        return;
      }
      if (!alive) return;
      const shown = shownAs(opened.head.type);
      const url = URL.createObjectURL(new Blob([opened.bytes as BlobPart], { type: shown === null ? 'application/octet-stream' : opened.head.type }));
      if (made.current !== null) URL.revokeObjectURL(made.current);
      made.current = url;
      setState({ step: 'ready', head: opened.head, url, expiresAt });
    })();
    return () => { alive = false; };
  }, [secret]);

  const kind = state.step === 'ready' ? shownAs(state.head.type) : null;
  const busy = state.step === 'info' || state.step === 'loading' || state.step === 'opening';
  return (
    <div className="ph-shared">
      {busy && (
        <section className="ph-shared-busy" aria-live="polite" aria-busy="true">
          <h1 className="ph-shared-name">
            {state.step === 'info' ? 'Otwieranie pliku…' : state.step === 'loading' ? 'Pobieranie zaszyfrowanego pliku…' : 'Odszyfrowywanie pliku…'}
          </h1>
          {state.step === 'loading' && state.size > 0 ? (
            <>
              <progress className="wk-progress ph-shared-bar" value={Math.min(state.done, state.size)} max={state.size} aria-label="Pobieranie pliku" />
              <p className="ph-shared-meta">
                {Math.min(100, Math.floor((100 * state.done) / state.size))}% · {sizeText(state.done)} z {sizeText(state.size)}
                {state.expiresAt !== '' ? ` · link ważny do ${until(state.expiresAt)}` : ''}
              </p>
            </>
          ) : (
            <>
              <div className="ph-shared-wait" role="progressbar" aria-label={state.step === 'opening' ? 'Odszyfrowywanie pliku' : 'Otwieranie pliku'}>
                <span />
              </div>
              {state.step === 'opening' && <p className="ph-shared-meta">{sizeText(state.size)} — to już ostatni krok.</p>}
            </>
          )}
          <p className="ph-shared-patience">
            <Icon name="lock" />
            Prosimy o chwilę cierpliwości: plik jest pobierany i odszyfrowywany tutaj, w Twojej przeglądarce. Przy dużym pliku może to potrwać.
          </p>
        </section>
      )}

      {state.step === 'ready' && (
        <>
          <h1 className="ph-shared-name">{state.head.name}</h1>
          <p className="ph-shared-meta">{sizeText(state.head.size)} · odszyfrowano{state.expiresAt !== '' ? ` · link ważny do ${until(state.expiresAt)}` : ''}</p>
          {kind === 'image' && <img className="ph-shared-media" src={state.url} alt={state.head.name} />}
          {kind === 'video' && <video className="ph-shared-media" src={state.url} controls playsInline preload="metadata" />}
          {kind === 'audio' && <audio src={state.url} controls preload="metadata" />}
          <div className="wk-actions">
            <a className="wk-btn" href={state.url} download={state.head.name}><Icon name="download" />Pobierz</a>
            {kind === 'pdf' && <a className="wk-btn wk-btn-quiet" href={state.url} target="_blank" rel="noopener noreferrer"><Icon name="external" />Otwórz</a>}
          </div>
        </>
      )}

      {state.step === 'failed' && <p className="wk-error">{state.message}</p>}

      <p className="ph-shared-note">
        Plik jest zaszyfrowany. Klucz jest tylko w tym linku — recreatio.pl go nie zna. Kto ma ten link, może otworzyć plik.
      </p>
    </div>
  );
}

export default SharedFile;
