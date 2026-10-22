/**
 * EIN KNOPF, DER SENDET (2026-10-21) — kurz gedrückt der ganze Sygnał, wie gespeichert;
 * länger als {@link TAP_MS} gedrückt sendet er, bis man loslässt (höchstens 30 s), wie
 * die Taste eines Pilots. Statt eines Reglers „jak długo nadawać": wie lange, sagt der Finger.
 *
 * Gesendet wird erst beim Loslassen (kurz) oder nach {@link TAP_MS} (gehalten) — wer nur
 * über die Knöpfe hinweg die Seite rollt, sendet nichts (das Rollen bricht den Druck ab).
 * Das Loslassen wird am Fenster gehört: auch wenn der Finger vom Knopf rutscht oder der
 * Knopf inzwischen gesperrt ist (während gesendet wird), endet das Halten sicher.
 * Tastatur: Enter oder Leertaste halten wie einen Finger; ein Klick ohne Zeiger (ein Vorleser)
 * sendet den ganzen Sygnał.
 */

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { LampRadio } from './native';
import { pressHold, releaseHold, TAP_MS, type Hold } from './transmit';

interface Down {
  readonly at: number;
  readonly timer: number;
  readonly via: 'pointer' | 'key';
  hold: Hold | null;
  /** Die Hörer am Fenster wieder abnehmen. */
  readonly detach: () => void;
}

export function SendKey({ className, disabled = false, onSend, children, title }: {
  className: string;
  disabled?: boolean;
  /** `null`: ein kurzer Druck (der ganze Sygnał); sonst der gehaltene Knopf. */
  onSend: (hold: Hold | null) => void;
  children: ReactNode;
  title?: string;
}) {
  const down = useRef<Down | null>(null);
  const [held, setHeld] = useState<number | null>(null);

  /** `send`: losgelassen (kurz → der ganze Sygnał); `false`: abgebrochen (die Seite rollt) — kurz heisst dann nichts. */
  const end = (send: boolean) => {
    const was = down.current;
    if (was === null) return;
    down.current = null;
    was.detach();
    window.clearTimeout(was.timer);
    if (was.hold !== null) {
      releaseHold(LampRadio, was.hold, Date.now() - was.at);
      setHeld(null);
    } else if (send) {
      onSend(null);
    }
  };

  const begin = (via: 'pointer' | 'key', pointerId = -1) => {
    if (disabled || down.current !== null) return;
    const at = Date.now();
    const timer = window.setTimeout(() => {
      const now = down.current;
      if (now === null || now.at !== at) return;
      now.hold = pressHold();
      onSend(now.hold);
      setHeld(0);
    }, TAP_MS);
    let detach: () => void = () => undefined;
    if (via === 'pointer') {
      const up = (e: PointerEvent) => { if (e.pointerId === pointerId) end(true); };
      const cancel = (e: PointerEvent) => { if (e.pointerId === pointerId) end(false); };
      window.addEventListener('pointerup', up, true);
      window.addEventListener('pointercancel', cancel, true);
      detach = () => {
        window.removeEventListener('pointerup', up, true);
        window.removeEventListener('pointercancel', cancel, true);
      };
    }
    down.current = { at, timer, via, hold: null, detach };
  };

  /* Während gehalten wird: die Sekunden auf dem Knopf. */
  const holding = held !== null;
  useEffect(() => {
    if (!holding) return undefined;
    const tick = window.setInterval(() => {
      const now = down.current;
      if (now !== null) setHeld(Date.now() - now.at);
    }, 100);
    return () => window.clearInterval(tick);
  }, [holding]);

  /* Die Seite geht, während der Finger noch liegt: loslassen. */
  useEffect(() => () => {
    const was = down.current;
    if (was === null) return;
    down.current = null;
    was.detach();
    window.clearTimeout(was.timer);
    if (was.hold !== null) releaseHold(LampRadio, was.hold, Date.now() - was.at);
  }, []);

  const keyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (!e.repeat) begin('key');
  };
  const keyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (down.current?.via === 'key') end(true);
  };

  return (
    <button type="button" className={`${className} lp-send${holding ? ' is-held' : ''}`} disabled={disabled && !holding} title={title}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        /* Das Loslassen kommt hier an, auch wenn der Finger (die Maus) vom Knopf gerutscht ist. */
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ohne: das Fenster hört es trotzdem */ }
        begin('pointer', e.pointerId);
      }}
      onKeyDown={keyDown} onKeyUp={keyUp} onBlur={() => { if (down.current?.via === 'key') end(true); }}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        /*
          Finger, Maus und Tasten sind schon behandelt (ihr Klick hat `detail` ≥ 1, der der Tasten fällt weg);
          ein Klick ohne Zeiger (`detail` 0 — ein Vorleser) sendet den ganzen Sygnał.
        */
        if (e.detail === 0 && !disabled && down.current === null) onSend(null);
      }}>
      {children}
      {holding && (
        <span className="lp-send-held" aria-hidden="true">
          {(Math.max(0, held) / 1000).toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s
        </span>
      )}
    </button>
  );
}
