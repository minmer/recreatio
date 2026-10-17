/**
 * Was die Teile der Kanzlei teilen: das Fenster von zwei Wochen und die Schlüssel der Tage und Vorkommen.
 */

import { type OfficeMass, dayKey } from './mass';

/**
 * Wie weit vorausgeladen wird — zwei Wochen, nicht ein Tag.
 *
 * Wer eintippt, arbeitet weiter voraus als wer liest.
 */
export const WINDOW_DAYS = 14;

export const todayKey = (): string => dayKey(new Date().toISOString());

/** Der Schlüssel eines Vorkommens: dieselbe Messe kann in zwei Kalendern liegen. */
export const keyOf = (mass: OfficeMass): string => `${mass.itemId}-${mass.occurrenceAt}`;
