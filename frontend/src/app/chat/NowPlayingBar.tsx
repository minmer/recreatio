/**
 * CO GRA (0100) — in der Kopfleiste, auf jeder Seite: das Stück aus einer
 * Rozmowa, das weiterspielt, nachdem man sie verlassen hat. Anhalten, weiter,
 * schliessen; zu Ende gespielt, verschwindet es.
 */

import { clock, stop, toggle, useNowPlaying } from './mediaPlayer';

export function NowPlayingBar() {
  const now = useNowPlaying();
  if (now === null || now.ended) return null;

  return (
    <div className="wk-now" role="group" aria-label="Odtwarzanie" data-now-playing="">
      <button type="button" className="wk-now-btn" onClick={toggle} aria-label={now.playing ? 'Wstrzymaj' : 'Odtwórz'} title={now.playing ? 'Wstrzymaj' : 'Odtwórz'}>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false" fill="currentColor">
          {now.playing ? <path d="M6 4h4v16H6zM14 4h4v16h-4z" /> : <path d="M6 3l14 9-14 9z" />}
        </svg>
      </button>
      <span className="wk-now-title">{now.title}</span>
      <span className="wk-now-time">{clock(now.time)}{now.duration !== null ? ` / ${clock(now.duration)}` : ''}</span>
      <button type="button" className="wk-now-btn" onClick={stop} aria-label="Zamknij odtwarzanie" title="Zamknij">
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default NowPlayingBar;
