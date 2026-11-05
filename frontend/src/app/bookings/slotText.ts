/**
 * Was die Teile der Terminkachel teilen: wie sie Zeiten und Mengen sagen, ein Handgriff, ein frischer Code.
 */

import type { Rules } from './resource';
import { appLang, fmtDate, tIn, type Lang } from '../core/i18n';

export type Act = (what: string, todo: () => Promise<unknown>) => Promise<void>;

/** Der Code, der eben entstand — für DIESEN Anspruch, damit er an seiner Karte steht. */
export interface Fresh { readonly claimId: string; readonly code: string; readonly kept: boolean }

/* -- Die Regeln, bevor man klickt ------------------------------------------ */

export const people = (n: number, lang: Lang = appLang()) => tIn(lang, 'bookings.people', { count: n });

/* -- Kleinkram ------------------------------------------------------------- */

/** Ein Zeitpunkt, wie man ihn liest: „sob., 26 września, 19:00". */
export function moment(at: string, lang: Lang = appLang()): string {
  const d = new Date(at);
  return `${fmtDate(d, { weekday: 'short', day: 'numeric', month: 'long' }, lang)}, ${fmtDate(d, { hour: '2-digit', minute: '2-digit' }, lang)}`;
}

/** Wie eine Zeit gelesen wird — ein Tag mit Uhrzeit, oder von einer Nacht zur nächsten. */
export function span(startsAt: string, endsAt: string, rules: Rules, lang: Lang = appLang()): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);

  const date = (d: Date) => fmtDate(d, { weekday: 'short', day: 'numeric', month: 'long' }, lang);
  const time = (d: Date) => fmtDate(d, { hour: '2-digit', minute: '2-digit' }, lang);

  if (rules.byNight) return `${date(s)} → ${date(e)}`;

  return s.toDateString() === e.toDateString()
    ? `${date(s)}, ${time(s)}–${time(e)}`
    : `${date(s)} ${time(s)} → ${date(e)} ${time(e)}`;
}
