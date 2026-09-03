/**
 * Das Anmeldeformular als Schublade, die von der Seite hereinfährt.
 *
 * <b>Warum eine Schublade und keine eigene Seite.</b> Wer auf eine Pfarrseite
 * kommt und dort etwas tun will, das ein Konto braucht, verliert bei einem
 * Seitenwechsel den Ort, an dem er war. Die Schublade legt sich davor, und
 * nach dem Anmelden steht er wieder da, wo er stand. Das ist der Grund, aus
 * dem der Altbestand es so gemacht hat (`components/LoginCard.tsx`), und der
 * Grund gilt weiter.
 *
 * <b>Die volle Seite bleibt trotzdem.</b> `RcSignInPage` zeigt sich, solange
 * die Schlüssel ganz fehlen — dort ist die Anmeldung nicht eine Sache neben
 * anderen, sondern die einzige. Zwei Zustände, zwei Bilder.
 *
 * <b>Zwei Zustände beim Ein- und Ausblenden.</b> `mounted` hält das Element im
 * Baum, `active` schaltet die Bewegung. Ohne diese Trennung fährt nichts
 * heraus: ein Element, das im selben Bild entfernt wird, hat keinen Zustand,
 * von dem aus es sich bewegen könnte. Der Altbestand löst das genauso — und
 * musste es lösen, aus demselben Grund.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { RcSignIn } from './RcSignIn';
import { rcCopy, type RcLang } from './i18n';
import type { RcEntry } from './lib/rcBoot';
import type { RcMe } from './lib/rcAuth';

/** So lange dauert die Bewegung — und so lange bleibt das Element danach stehen. */
const GLIDE_MS = 320;

export function RcSignInDrawer({
  lang, entry, onEntry, onReady, open, onClose
}: {
  lang: RcLang;
  entry: RcEntry<RcMe>;
  onEntry: (entry: RcEntry<RcMe>) => void;
  onReady?: (ready: boolean) => void;
  open: boolean;
  onClose: () => void;
}) {
  const t = rcCopy[lang];

  const [mounted, setMounted] = useState(open);
  const [active, setActive] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (open) {
      // Wohin die Tastatur zurückkehrt, wenn die Schublade wieder zugeht.
      opener.current = document.activeElement;
      setMounted(true);

      // Ein Bild warten, sonst beginnt die Bewegung am Ziel und ist keine.
      const raf = window.requestAnimationFrame(() => setActive(true));
      return () => window.cancelAnimationFrame(raf);
    }

    if (mounted) {
      setActive(false);
      const timer = window.setTimeout(() => setMounted(false), GLIDE_MS);
      return () => window.clearTimeout(timer);
    }
  }, [open, mounted]);

  /* Die Tastatur zuerst: Escape schliesst, und der Blick springt hinein. */
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);

    const first = panel.current?.querySelector<HTMLElement>('input, button');
    first?.focus();

    return () => {
      window.removeEventListener('keydown', onKey);
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, [open, onClose]);

  /*
   * Solange die Schublade offen ist, scrollt die Seite darunter nicht mit.
   * Ohne das wandert der Hintergrund weg, während man tippt — auf einem
   * Telefon der Normalfall, weil die Tastatur die Seite verschiebt.
   */
  useEffect(() => {
    if (!open) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = before; };
  }, [open]);

  const stop = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

  if (!mounted) return null;

  return (
    <div
      className={`rc-drawer-back${active ? ' is-open' : ''}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panel}
        className="rc-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t.auth.heading}
        onClick={stop}
      >
        <header className="rc-drawer-head">
          {/*
            Das Zeichen wechselt mit der Ansicht: die Schublade steht auf dem
            Grund der Werkstatt, und eine dunkle Zeichnung auf dunklem Grund
            ist keine.
          */}
          <picture>
            <source srcSet="/logo_inv.svg" media="(prefers-color-scheme: dark)" />
            <img src="/logo_new.svg" alt={t.shell.title} width="150" height="34" />
          </picture>

          <button
            type="button"
            className="rc-drawer-close"
            aria-label={t.auth.close}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <RcSignIn lang={lang} entry={entry} onEntry={onEntry} onReady={onReady} />
      </div>
    </div>
  );
}

export default RcSignInDrawer;
