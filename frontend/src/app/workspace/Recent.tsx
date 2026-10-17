/**
 * „OSTATNIO" — die zuletzt geöffneten Dinge eines Teils, über seiner Liste.
 *
 * Bäume (Bereiche, Seiten, Zasoby) lassen sich nicht nach Benutzung sortieren,
 * ohne dass die Ordnung verloren geht, in der die Dinge ineinander liegen.
 * Also bleibt der Baum, wie er ist, und darüber steht, woran man zuletzt
 * gearbeitet hat — gemerkt versiegelt (`prefs.ts`), auf jedem Gerät derselbe.
 */

import { useEffect } from 'react';

import { touch } from '../core/prefs';

/** Dieses Ding ist gerade offen — nach vorn damit. */
export function useTouched(scope: string, id: string | null): void {
  useEffect(() => {
    if (id !== null && id !== '') touch(scope, id);
  }, [scope, id]);
}
