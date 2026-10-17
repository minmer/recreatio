/**
 * Etwas ÜBER der Seite — ein Dialog (`Modal`) oder ein Baustein im ganzen
 * Fenster (`Fullscreen`).
 *
 * <b>Beide gehen an den Rand des Dokuments</b> (ein Portal in `<body>`), nicht
 * dorthin, wo sie aufgerufen werden: eine Kachel mit eigener Breitenabfrage
 * (`container`) ist für alles Feste in ihr der Rahmen — ein Dialog darin säße
 * in der Kachel statt über der Seite.
 *
 * <b>Zu schliessen auf jede Art, die man erwartet</b>: das ×, die Taste Esc,
 * ein Klick daneben (beim Dialog) — und der Pfeil zurück oben links im
 * Vollbild, wo man ihn auf dem Telefon mit dem Daumen trifft. Solange etwas
 * offen ist, rollt die Seite darunter nicht mit.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

function usePortal(): HTMLElement | null {
  const [host] = useState<HTMLElement | null>(() => {
    if (typeof document === 'undefined') return null;
    const made = document.createElement('div');
    made.className = 'wk-root wk-portal';
    return made;
  });

  useEffect(() => {
    if (host === null) return undefined;
    document.body.appendChild(host);
    return () => { host.remove(); };
  }, [host]);

  return host;
}

/** Esc schliesst, die Seite darunter steht still, und der Fokus kommt zurück, wo er war. */
function useOverlay(onClose: () => void, box: React.RefObject<HTMLElement | null>) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close.current(); } };
    document.addEventListener('keydown', onKey);

    /* Das erste Feld bekommt den Fokus — sonst tippt man ins Leere. */
    const first = box.current?.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea, button:not(.wk-modal-x)');
    first?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, [box]);
}

export function Modal({ title, onClose, children, wide = false }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const host = usePortal();
  const box = useRef<HTMLDivElement | null>(null);
  const id = useId();
  useOverlay(onClose, box);

  if (host === null) return null;

  return createPortal(
    <div className="wk-modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} className={`wk-modal${wide ? ' is-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="wk-modal-head">
          <h2 id={id} className="wk-h2">{title}</h2>
          <button type="button" className="wk-modal-x" aria-label="Zamknij" onClick={onClose}>×</button>
        </div>
        <div className="wk-modal-body">{children}</div>
      </div>
    </div>,
    host
  );
}

/**
 * EIN BAUSTEIN IM GANZEN FENSTER. Die Seite bleibt, wo sie war; zurück geht
 * es mit dem Pfeil, dem × oder Esc.
 */
export function Fullscreen({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const host = usePortal();
  const box = useRef<HTMLDivElement | null>(null);
  const id = useId();
  useOverlay(onClose, box);

  if (host === null) return null;

  return createPortal(
    <div ref={box} className="wk-full" role="dialog" aria-modal="true" aria-labelledby={id}>
      <div className="wk-full-head">
        <button type="button" className="wk-full-back" aria-label="Wróć do strony" onClick={onClose}>‹ Wróć</button>
        <h2 id={id} className="wk-full-title">{title}</h2>
        <button type="button" className="wk-modal-x" aria-label="Zamknij pełny ekran" onClick={onClose}>×</button>
      </div>
      <div className="wk-full-body">{children}</div>
    </div>,
    host
  );
}
