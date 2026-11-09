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

import { fmtDate, useT } from '../core/i18n';
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

const until = (at: string) => fmtDate(new Date(at), { day: 'numeric', month: 'long', year: 'numeric' });

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
  const t = useT();
  const secret = useMemo(() => secretOf(text), [text]);
  const [state, setState] = useState<State>({ step: 'info' });
  const made = useRef<string | null>(null);

  /* Die Adresse einer geöffneten Datei gilt, solange die Seite steht. */
  useEffect(() => () => { if (made.current !== null) URL.revokeObjectURL(made.current); }, []);

  /* Gleich beim Öffnen: fragen, ob es den Link noch gibt — dann holen, dann öffnen. */
  useEffect(() => {
    if (secret === null) {
      setState({ step: 'failed', message: t('phoneShare.file.incomplete') });
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
        if (alive) setState({ step: 'failed', message: e instanceof ShareGone ? e.message : t('phoneShare.file.downloadFailed') });
        return;
      }
      if (!alive) return;

      setState({ step: 'opening', size, expiresAt });
      await painted();
      let opened: Awaited<ReturnType<typeof openShare>>;
      try {
        opened = await openShare(secret, sealed);
      } catch {
        if (alive) setState({ step: 'failed', message: t('phoneShare.file.broken') });
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
            {state.step === 'info' ? t('phoneShare.file.opening') : state.step === 'loading' ? t('phoneShare.file.downloading') : t('phoneShare.file.decrypting')}
          </h1>
          {state.step === 'loading' && state.size > 0 ? (
            <>
              <progress className="wk-progress ph-shared-bar" value={Math.min(state.done, state.size)} max={state.size} aria-label={t('phoneShare.file.downloadBar')} />
              <p className="ph-shared-meta">
                {t('phoneShare.file.progress', { percent: Math.min(100, Math.floor((100 * state.done) / state.size)), done: sizeText(state.done), size: sizeText(state.size) })}
                {state.expiresAt !== '' ? ` · ${t('phoneShare.file.validUntil', { date: until(state.expiresAt) })}` : ''}
              </p>
            </>
          ) : (
            <>
              <div className="ph-shared-wait" role="progressbar" aria-label={state.step === 'opening' ? t('phoneShare.file.decryptingBar') : t('phoneShare.file.openingBar')}>
                <span />
              </div>
              {state.step === 'opening' && <p className="ph-shared-meta">{t('phoneShare.file.lastStep', { size: sizeText(state.size) })}</p>}
            </>
          )}
          <p className="ph-shared-patience">
            <Icon name="lock" />
            {t('phoneShare.file.patience')}
          </p>
        </section>
      )}

      {state.step === 'ready' && (
        <>
          <h1 className="ph-shared-name">{state.head.name}</h1>
          <p className="ph-shared-meta">{sizeText(state.head.size)} · {t('phoneShare.file.decrypted')}{state.expiresAt !== '' ? ` · ${t('phoneShare.file.validUntil', { date: until(state.expiresAt) })}` : ''}</p>
          {kind === 'image' && <img className="ph-shared-media" src={state.url} alt={state.head.name} />}
          {kind === 'video' && <video className="ph-shared-media" src={state.url} controls playsInline preload="metadata" />}
          {kind === 'audio' && <audio src={state.url} controls preload="metadata" />}
          <div className="wk-actions">
            <a className="wk-btn" href={state.url} download={state.head.name}><Icon name="download" />{t('common.download')}</a>
            {kind === 'pdf' && <a className="wk-btn wk-btn-quiet" href={state.url} target="_blank" rel="noopener noreferrer"><Icon name="external" />{t('common.open')}</a>}
          </div>
        </>
      )}

      {state.step === 'failed' && <p className="wk-error">{state.message}</p>}

      <p className="ph-shared-note">
        {t('phoneShare.file.note')}
      </p>
    </div>
  );
}

export default SharedFile;
