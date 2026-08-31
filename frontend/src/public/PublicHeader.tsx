/**
 * Die eine Kopfleiste.
 *
 * <b>REcreatio trägt seine Unterseiten sichtbar.</b> „Wer sind wir" darf nicht
 * schwerer zu finden sein als „was bieten wir an" — bei einer Einrichtung, die
 * sich vorstellt, wäre das genau verkehrt herum. Auf breiten Fenstern klappt
 * das Untermenü beim Zeigen auf, auf schmalen steht es offen unter dem
 * Hauptpunkt: ein aufklappbares Menü in einem aufgeklappten Menü ist auf einem
 * Telefon eine Falle.
 *
 * <b>Echte Verweise, keine Klickbehandler.</b> Ein `<a href>` lässt sich in
 * einem neuen Tab öffnen, kopieren, vorlesen und verfolgen; ein `onClick` auf
 * einem `<div>` kann nichts davon.
 *
 * <b>Der Eintrittscheck läuft beim Aufschlagen</b> — aber nur, wenn dieser
 * Browser schon einmal angemeldet war oder dieser Tab noch ein Öffnungsstück
 * hält. War er es nie, kostet ein Besuch der öffentlichen Seite keine einzige
 * Anfrage, und gefragt wird erst, wenn jemand den Knopf berührt. Beide Wege
 * stehen in `rcBoot.ts`.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  rcBrowserMemory, rcEnter, rcEntryCheck, rcEntrySettled, type RcEntry
} from '../rc/lib/rcBoot';
import { rcHasUnlockPiece, rcMe, type RcMe } from '../rc/lib/rcAuth';
import {
  PUBLIC_LANG_NAMES, PUBLIC_LANGS, type PublicCopy, type PublicLang
} from './content';
import { PublicAuth } from './PublicAuth';
import { PUBLIC_MENU, menuParentOf, publicHref, type PublicPage } from './publicRoutes';

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
  const parent = menuParentOf(active);

  const check = useCallback(() => {
    void rcEntryCheck(rcMe).then(setEntry);
  }, []);

  useEffect(() => {
    let alive = true;
    const hints = {
      needsIdentity: false,
      signedInBefore: rcBrowserMemory.signedInBefore(),
      hasUnlockPiece: rcHasUnlockPiece()
    };

    if (hints.signedInBefore || hints.hasUnlockPiece) setEntry({ kind: 'checking' });

    void rcEnter(hints, rcMe).then((result) => { if (alive) setEntry(result); });
    return () => { alive = false; };
  }, []);

  // Der Rückfall: wer den Knopf berührt, bevor gefragt wurde, löst die Frage
  // aus. Ein Zeigen genügt — bis der Finger unten ist, ist die Antwort da.
  const askNow = useCallback(() => {
    setEntry((current) => {
      if (current.kind !== 'unasked') return current;
      check();
      return { kind: 'checking' };
    });
  }, [check]);

  return (
    <header className="pub-head">
      <a className="pub-skip" href="#pub-main">{copy.nav.skipToContent}</a>

      <a className="pub-brand" href={publicHref('front')}>
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
        {PUBLIC_MENU.map((entryItem) => (
          <div
            className={`pub-nav-item ${entryItem.children ? 'has-kids' : ''}`}
            key={entryItem.page}
          >
            <a
              href={publicHref(entryItem.page)}
              aria-current={parent === entryItem.page ? 'page' : undefined}
              onClick={() => setMenuOpen(false)}
            >
              {copy.nav[entryItem.page]}
            </a>

            {entryItem.children && (
              <div className="pub-sub">
                {entryItem.children.map((child) => (
                  <a
                    key={child}
                    href={publicHref(child)}
                    aria-current={active === child ? 'page' : undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    {copy.nav[child]}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="pub-head-right">
        <label className="pub-lang">
          <span className="pub-sr">{PUBLIC_LANG_NAMES[lang]}</span>
          <select value={lang} onChange={(event) => onLang(event.target.value as PublicLang)}>
            {PUBLIC_LANGS.map((l) => (
              <option key={l} value={l}>{PUBLIC_LANG_NAMES[l]}</option>
            ))}
          </select>
        </label>

        <PublicAuth
          copy={copy}
          signedIn={entry.kind === 'signed-in'}
          busy={!rcEntrySettled(entry)}
          onAsk={askNow}
          onChanged={check}
        />
      </div>
    </header>
  );
}
