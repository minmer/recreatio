/**
 * Die eine Kopfleiste (Abschnitt 8).
 *
 * Es gab drei — vorne, Veranstaltungen, Pfarrei —, und drei Kopfleisten heisst
 * drei Orte, an denen ein neuer Punkt vergessen wird. Diese ist die vordere,
 * fortgeführt: Marke links, Navigation, Sprache, Anmeldeknopf rechts.
 *
 * <b>Echte Verweise, keine Klickbehandler.</b> Ein `<a href>` lässt sich in
 * einem neuen Tab öffnen, kopieren, vorlesen und von einer Suchmaschine
 * verfolgen; ein `onClick` auf einem `<div>` kann nichts davon. Das ist der
 * Grund, nicht der Stil.
 *
 * <b>Der Anmeldeknopf fragt beim Eintritt, nicht beim Klicken</b> — solange
 * dieser Browser schon einmal angemeldet war. War er es nie, kostet ein Besuch
 * der öffentlichen Seite keine einzige Anfrage an den Dienst, und die Frage
 * wird nachgeholt, sobald jemand den Knopf berührt. Beide Wege stehen in
 * `rcBoot.ts`; hier wird nur entschieden, wann sie laufen.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  rcBrowserMemory, rcEnter, rcEntryCheck, rcEntrySettled, type RcEntry
} from '../rc/lib/rcBoot';
import { rcHasUnlockPiece, rcMe, type RcMe } from '../rc/lib/rcAuth';
import { RC_HASH_BASE } from '../rc/lib/rcRoute';
import {
  PUBLIC_LANG_NAMES, PUBLIC_LANGS, type PublicCopy, type PublicLang
} from './content';
import { PUBLIC_MENU, publicHref, type PublicPage } from './publicRoutes';

export function PublicHeader({
  copy,
  lang,
  onLang,
  active
}: {
  copy: PublicCopy;
  lang: PublicLang;
  onLang: (lang: PublicLang) => void;
  active: PublicPage | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [entry, setEntry] = useState<RcEntry<RcMe>>({ kind: 'unasked' });

  // Eintritt. Die öffentliche Seite braucht keine Kennung, um sich zu zeigen —
  // gefragt wird deshalb nur, wenn dieser Browser schon einmal angemeldet war
  // oder dieser Tab noch ein Öffnungsstück hält.
  useEffect(() => {
    let alive = true;
    const hints = {
      needsIdentity: false,
      signedInBefore: rcBrowserMemory.signedInBefore(),
      hasUnlockPiece: rcHasUnlockPiece()
    };

    if (hints.signedInBefore || hints.hasUnlockPiece) setEntry({ kind: 'checking' });

    void rcEnter(hints, rcMe).then((result) => {
      if (alive) setEntry(result);
    });

    return () => { alive = false; };
  }, []);

  // Der Rückfall: wer den Knopf berührt, bevor gefragt wurde, löst die Frage
  // aus. Ein Zeigen genügt — bis der Finger unten ist, ist die Antwort da.
  const askNow = useCallback(() => {
    setEntry((current) => {
      if (current.kind !== 'unasked') return current;
      void rcEntryCheck(rcMe).then(setEntry);
      return { kind: 'checking' };
    });
  }, []);

  const signedIn = entry.kind === 'signed-in';
  const settled = rcEntrySettled(entry);

  return (
    <header className="pub-head">
      <a className="pub-skip" href="#pub-main">{copy.nav.skipToContent}</a>

      <a className="pub-brand" href={publicHref('manifest')}>
        <img src="/logo_new.svg" alt={copy.meta.siteName} width="150" height="34" />
      </a>

      <button
        type="button"
        className="pub-burger"
        aria-expanded={menuOpen}
        aria-controls="pub-nav"
        onClick={() => setMenuOpen((open) => !open)}
      >
        {copy.nav.menu}
      </button>

      <nav id="pub-nav" className={`pub-nav ${menuOpen ? 'is-open' : ''}`}>
        {PUBLIC_MENU.map((page) => (
          <a
            key={page}
            href={publicHref(page)}
            aria-current={active === page ? 'page' : undefined}
            onClick={() => setMenuOpen(false)}
          >
            {copy.nav[page]}
          </a>
        ))}
      </nav>

      <div className="pub-head-right">
        <label className="pub-lang">
          <span className="pub-sr">{PUBLIC_LANG_NAMES[lang]}</span>
          <select
            value={lang}
            onChange={(event) => onLang(event.target.value as PublicLang)}
          >
            {PUBLIC_LANGS.map((l) => (
              <option key={l} value={l}>{PUBLIC_LANG_NAMES[l]}</option>
            ))}
          </select>
        </label>

        <a
          className="pub-auth"
          href={RC_HASH_BASE}
          data-state={signedIn ? 'in' : 'out'}
          aria-busy={!settled}
          onMouseEnter={askNow}
          onFocus={askNow}
        >
          {signedIn ? copy.nav.platform : copy.nav.signIn}
        </a>
      </div>
    </header>
  );
}
