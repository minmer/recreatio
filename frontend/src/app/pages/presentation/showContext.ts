/**
 * 0085 — WIE HELL DIE BÜHNE GERADE IST, für die Bausteine darauf: eine Farbe
 * `hell|dunkel` (ein Kształt, ein Feld) nimmt die Hälfte, die zur Präsentation
 * passt — nicht die des Geräts, wenn die Präsentation hell bleibt, obwohl das
 * Gerät dunkel ist. `null`: nicht auf einer Bühne, dann das Gerät.
 */

import { createContext } from 'react';

import type { Card } from '../../cogita/cardBasics';
import type { Facts } from '../../cogita/logic';
import type { Gate } from './story';

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

/**
 * 2026-10-21 — WELCHER BAUSTEIN ICH BIN (seine Kennung auf der Bühne): eine
 * Frage sagt damit nach der Antwort, wessen Ausgang gilt
 * (`go('answer:<baustein>:right')`).
 */
export const ShowPieceKey = createContext<string | null>(null);

/**
 * 2026-10-21 — WIE OFT DER ZUSCHAUER AN DIESER STELLE DES WEGES ANKAM (0: noch
 * nie). Eine Frage beginnt mit jeder Ankunft neu — wer nach einer falschen
 * Antwort zurückgeführt wird, findet sie leer.
 */
export const ShowArrival = createContext<number>(0);

/**
 * 2026-10-21 — DER PRZEBIEG IM LAUF (`story.ts`, `storyRun.tsx`): was über den
 * Lernenden bekannt ist und wohin es geht — im Browser (ein Beispiel) oder in
 * Cogita (verbunden, angemeldet oder als Platz). `null`: eine Präsentation ohne
 * Przebieg, oder der Editor.
 */
export interface StoryRun {
  /** `browser`: nichts verlässt ihn; `cogita`: es geht versiegelt in den Bereich der Bazy wiedzy. */
  readonly mode: 'browser' | 'cogita';
  /** Steigt bei jeder Änderung (eine Antwort, ein Wert) — dann wird der Weg ab hier neu berechnet. */
  readonly version: number;
  readonly facts: () => Facts;
  readonly record: (card: Card, correctness: number, given?: string) => void;
  /** Die `set`-Tore, durch die der Lernende gerade ging: ihre Werte gelten jetzt. */
  readonly apply: (gates: readonly Gate[]) => void;
  /** Hier ist er (gemerkt — er kommt wieder an diese Stelle zurück). */
  readonly visit: (sceneKey: string) => void;
  /** Wo er zuletzt war — `null`: zum ersten Mal hier. */
  readonly last: () => string | null;
}

export const StoryContext = createContext<StoryRun | null>(null);
