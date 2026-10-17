/**
 * 0085 — WIE HELL DIE BÜHNE GERADE IST, für die Bausteine darauf: eine Farbe
 * `hell|dunkel` (ein Kształt, ein Feld) nimmt die Hälfte, die zur Präsentation
 * passt — nicht die des Geräts, wenn die Präsentation hell bleibt, obwohl das
 * Gerät dunkel ist. `null`: nicht auf einer Bühne, dann das Gerät.
 */

import { createContext } from 'react';

export const ShowDark = createContext<boolean | null>(null);
