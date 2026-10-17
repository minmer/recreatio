/**
 * „OSTATNIO" — die zuletzt geöffneten Dinge eines Teils, über seiner Liste.
 *
 * Bäume (Bereiche, Seiten, Zasoby) lassen sich nicht nach Benutzung sortieren,
 * ohne dass die Ordnung verloren geht, in der die Dinge ineinander liegen.
 * Also bleibt der Baum, wie er ist, und darüber steht, woran man zuletzt
 * gearbeitet hat — gemerkt versiegelt (`prefs.ts`), auf jedem Gerät derselbe.
 */

import { useEffect } from 'react';

import { touch, useRecent } from './prefs';

export interface RecentItem {
  readonly id: string;
  readonly label: string;
  readonly href: string;
}

export function RecentRow({ scope, items, max = 6 }: { scope: string; items: readonly RecentItem[]; max?: number }) {
  const recent = useRecent(scope);
  const shown = recent.ids
    .map((id) => items.find((one) => one.id === id))
    .filter((one): one is RecentItem => one !== undefined)
    .slice(0, max);

  if (shown.length === 0) return null;

  return (
    <nav className="wk-recent" aria-label="Ostatnio otwierane">
      <span className="wk-recent-label">Ostatnio:</span>
      {shown.map((one) => <a key={one.id} className="wk-recent-chip" href={one.href}>{one.label}</a>)}
    </nav>
  );
}

/** Dieses Ding ist gerade offen — nach vorn damit. */
export function useTouched(scope: string, id: string | null): void {
  useEffect(() => {
    if (id !== null && id !== '') touch(scope, id);
  }, [scope, id]);
}
