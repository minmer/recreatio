/**
 * EIN PLIK PRZEZ LINK — `#/plik/<geheimnis>` (0117), ohne Konto: wer den Link aus
 * der SMS hat, sieht das Zdjęcie in voller Grösse (oder den Film, das PDF) und kann
 * es herunterladen.
 *
 * Erst fragt die Seite, ob es den Link noch gibt und wie gross die Datei ist; bis
 * 10 MB holt sie sie gleich, darüber auf einen Tipp (Daten am Telefon). Geöffnet
 * wird hier — der Schlüssel steht nur im Link, der Dienst kennt ihn nicht.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Icon } from '../ui/icons';
import { Loading } from '../ui/Loading';
import { fetchShare, ShareGone, shareInfo } from './share';
import { openShare, secretOf, shareKeys, shownAs, sizeText, type ShareHead } from './shareSeal';
import './phone.css';

/** Bis hierhin wird gleich geholt; darüber fragt die Seite. */
const AT_ONCE = 10 * 1024 * 1024;

type State =
  | { readonly step: 'info' }
  | { readonly step: 'ask'; readonly size: number; readonly expiresAt: string }
  | { readonly step: 'loading'; readonly size: number; readonly done: number }
  | { readonly step: 'ready'; readonly head: ShareHead; readonly url: string; readonly expiresAt: string }
  | { readonly step: 'failed'; readonly message: string };

const until = (at: string) => new Date(at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });

export function SharedFile({ secret: text }: { secret: string }) {
  const secret = useMemo(() => secretOf(text), [text]);
  const [state, setState] = useState<State>({ step: 'info' });
  const made = useRef<string | null>(null);

  /* Die Adresse einer geöffneten Datei gilt, solange die Seite steht. */
  useEffect(() => () => { if (made.current !== null) URL.revokeObjectURL(made.current); }, []);

  const load = useCallback(async (size: number, expiresAt: string) => {
    if (secret === null) return;
    setState({ step: 'loading', size, done: 0 });
    try {
      const { id } = await shareKeys(secret);
      /* Je Prozent einmal neu zeichnen, nicht je Stück. */
      let percentShown = 0;
      const sealed = await fetchShare(id, (done) => {
        const percent = size > 0 ? Math.floor((100 * done) / size) : 0;
        if (percent !== percentShown) { percentShown = percent; setState({ step: 'loading', size, done }); }
      });
      let opened: Awaited<ReturnType<typeof openShare>>;
      try {
        opened = await openShare(secret, sealed);
      } catch {
        setState({ step: 'failed', message: 'Ten link jest uszkodzony albo niepełny — pliku nie da się otworzyć.' });
        return;
      }
      const shown = shownAs(opened.head.type);
      const url = URL.createObjectURL(new Blob([opened.bytes as BlobPart], { type: shown === null ? 'application/octet-stream' : opened.head.type }));
      if (made.current !== null) URL.revokeObjectURL(made.current);
      made.current = url;
      setState({ step: 'ready', head: opened.head, url, expiresAt });
    } catch (e) {
      setState({ step: 'failed', message: e instanceof ShareGone ? e.message : 'Nie udało się pobrać pliku.' });
    }
  }, [secret]);

  useEffect(() => {
    if (secret === null) {
      setState({ step: 'failed', message: 'Ten link jest niepełny — sprawdź, czy skopiowano go w całości.' });
      return undefined;
    }
    let alive = true;
    void (async () => {
      try {
        const { id } = await shareKeys(secret);
        const info = await shareInfo(id);
        if (!alive) return;
        if (info.size > AT_ONCE) setState({ step: 'ask', size: info.size, expiresAt: info.expiresAt });
        else await load(info.size, info.expiresAt);
      } catch (e) {
        if (alive) setState({ step: 'failed', message: e instanceof ShareGone ? e.message : 'Nie udało się otworzyć linku.' });
      }
    })();
    return () => { alive = false; };
  }, [secret, load]);

  const kind = state.step === 'ready' ? shownAs(state.head.type) : null;
  return (
    <div className="ph-shared">
      {state.step === 'info' && <Loading label="Otwieranie pliku…" />}

      {state.step === 'ask' && (
        <>
          <h1 className="ph-shared-name">Plik przez link</h1>
          <p className="ph-shared-meta">{sizeText(state.size)} · link ważny do {until(state.expiresAt)}</p>
          <div className="wk-actions">
            <button type="button" className="wk-btn" onClick={() => void load(state.size, state.expiresAt)}>
              <Icon name="download" />Pobierz i pokaż ({sizeText(state.size)})
            </button>
          </div>
        </>
      )}

      {state.step === 'loading' && (
        <Loading lines={1} label={state.size > 0 ? `Pobieranie… ${Math.min(100, Math.round((100 * state.done) / state.size))}%` : 'Pobieranie…'} />
      )}

      {state.step === 'ready' && (
        <>
          <h1 className="ph-shared-name">{state.head.name}</h1>
          <p className="ph-shared-meta">{sizeText(state.head.size)}{state.expiresAt !== '' ? ` · link ważny do ${until(state.expiresAt)}` : ''}</p>
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
