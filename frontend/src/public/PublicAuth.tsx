/**
 * Der Anmeldeknopf mit Überlaufmenü — wie im Altbestand.
 *
 * Das Verhalten ist von `ProfileMenu` übernommen, weil es sich bewährt hat und
 * weil es bekannt ist:
 *
 *   - Mit der Maus öffnet das Zeigen, der Klick GEHT (er ist kein Umschalter).
 *   - Mit dem Finger gibt es kein Zeigen; dort schaltet der Klick um. Ohne
 *     diese Unterscheidung ist das Menü auf einem Telefon nicht erreichbar.
 *   - Escape und ein Klick daneben schliessen.
 *
 * Die Brücke zwischen Knopf und Menü ist ein `::after` im Stilblatt: ohne sie
 * verlässt der Zeiger auf dem Weg nach unten kurz beide Flächen, und das Menü
 * klappt genau dann zu, wenn jemand es benutzen will.
 *
 * <b>Was hier NICHT passiert: anmelden.</b> Der Knopf führt in die Plattform,
 * und die Anmeldung geschieht dort. Ein zweites Anmeldeformular auf der
 * öffentlichen Seite wäre ein zweiter Ort, an dem ein Passwort eingetippt wird
 * — und damit eine zweite Stelle, die man fälschen kann.
 */

import { useEffect, useRef, useState } from 'react';
import { rcLock, rcLogout } from '../rc/lib/rcAuth';
import { RC_HASH_BASE } from '../rc/lib/rcRoute';
import type { PublicCopy } from './content';

export function PublicAuth({
  copy,
  signedIn,
  busy,
  onAsk,
  onChanged
}: {
  copy: PublicCopy;
  signedIn: boolean;
  busy: boolean;
  /** Der Rückfall aus `rcBoot`: fragen, sobald jemand den Knopf berührt. */
  onAsk: () => void;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement | null>(null);
  const pointer = useRef<string>('unknown');

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (wrapper.current !== null && !wrapper.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // Abgemeldet gibt es nichts zu überlaufen: ein Knopf, der in die Plattform
  // führt. Ein leeres Menü aufzuklappen wäre eine Verheissung ohne Inhalt.
  if (!signedIn) {
    return (
      <a
        className="pub-auth"
        href={RC_HASH_BASE}
        aria-busy={busy}
        onMouseEnter={onAsk}
        onFocus={onAsk}
      >
        {copy.nav.signIn}
      </a>
    );
  }

  const act = async (what: 'lock' | 'signOut') => {
    setOpen(false);
    try {
      if (what === 'lock') await rcLock();
      else await rcLogout();
    } finally {
      onChanged();
    }
  };

  return (
    <div
      className={`pub-menu ${open ? 'is-open' : ''}`}
      ref={wrapper}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onPointerDown={(event) => { pointer.current = event.pointerType; }}
    >
      <a
        className="pub-auth"
        href={RC_HASH_BASE}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(event) => {
          if (pointer.current === 'touch' || pointer.current === 'pen') {
            event.preventDefault();
            setOpen((current) => !current);
          }
        }}
      >
        {copy.nav.platform}
      </a>

      <div className="pub-menu-drop" role="menu">
        <a href={RC_HASH_BASE} role="menuitem" onClick={() => setOpen(false)}>
          {copy.nav.account}
        </a>
        <button type="button" role="menuitem" onClick={() => void act('lock')}>
          {copy.nav.lock}
        </button>
        <button type="button" role="menuitem" onClick={() => void act('signOut')}>
          {copy.nav.signOut}
        </button>
      </div>
    </div>
  );
}
