/**
 * 0085 — WIE HELL DIE BÜHNE GERADE IST, für die Bausteine darauf: eine Farbe
 * `hell|dunkel` (ein Kształt, ein Feld) nimmt die Hälfte, die zur Präsentation
 * passt — nicht die des Geräts, wenn die Präsentation hell bleibt, obwohl das
 * Gerät dunkel ist. `null`: nicht auf einer Bühne, dann das Gerät.
 */

import { createContext } from 'react';

export const ShowDark = createContext<boolean | null>(null);

/**
 * 2026-10-17 — DIE SZENE, IN DER EIN BILD ZUM ANFASSEN STEHT (`LiveDrawing`):
 * wo die Bahn in ihr gerade ist (`step` — 0 an ihrem Anfang, 1 beim zweiten
 * Schritt, dazwischen fliessend; der Wechsel herein liegt zwischen −1 und 0),
 * Bescheid, wenn sich das ändert, und ein Weg weiter („next", „back", eine
 * Szene, `link:<id>`, `end`) — wenn ein Bild sagt, dass es gelöst ist.
 * `null`: nicht in einer Präsentation.
 */
export interface ShowClockValue {
  readonly step: () => number;
  readonly subscribe: (listener: () => void) => () => void;
  readonly go: (target: string) => void;
  /**
   * 2026-10-19 — wie weit die Szene ist, je 0–1: ihr Inneres (`scene`), ihr
   * Kommen (`enter`), ihr Gehen (`leave`) — für Bewegungen, die dem
   * Fortschritt folgen statt der Uhr (`motion` mit `by`).
   */
  readonly progress?: (by: 'scene' | 'enter' | 'leave') => number;
}

export const ShowClock = createContext<ShowClockValue | null>(null);
