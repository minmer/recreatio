/**
 * Was die Teile der Terminkachel teilen: wie sie Zeiten und Mengen sagen, ein Handgriff, ein frischer Code.
 */

import type { Rules } from './resource';
import { plural } from '../core/plural';

export type Act = (what: string, todo: () => Promise<unknown>) => Promise<void>;

/** Der Code, der eben entstand — für DIESEN Anspruch, damit er an seiner Karte steht. */
export interface Fresh { readonly claimId: string; readonly code: string; readonly kept: boolean }

/* -- Die Regeln, bevor man klickt ------------------------------------------ */

export const people = (n: number) => `${n} ${plural(n, 'osoba', 'osoby', 'osób')}`;

/* -- Kleinkram ------------------------------------------------------------- */

/** Ein Zeitpunkt, wie man ihn liest: „sob., 26 września, 19:00". */
export function moment(at: string): string {
  const d = new Date(at);
  return `${d.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'long' })}, ${
    d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Wie eine Zeit gelesen wird — ein Tag mit Uhrzeit, oder von einer Nacht zur nächsten. */
export function span(startsAt: string, endsAt: string, rules: Rules): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);

  const date = (d: Date) => d.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'long' });
  const time = (d: Date) => d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

  if (rules.byNight) return `${date(s)} → ${date(e)}`;

  return s.toDateString() === e.toDateString()
    ? `${date(s)}, ${time(s)}–${time(e)}`
    : `${date(s)} ${time(s)} → ${date(e)} ${time(e)}`;
}
