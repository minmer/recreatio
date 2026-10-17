/**
 * Was die Ansichten der SMS teilen: das Bild eines Menschen, wie Zeiten dastehen, die Suche.
 */

import type { CSSProperties } from 'react';

import { fold } from '../shell/search';
import { initialsOf } from './numbers';

/** Der Farbton eines Menschen — aus seiner Nummer, auf jedem Gerät derselbe. */
export const hueOf = (key: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) % 360;
};

/** Die Farbe als Mass für `.ph-avatar`. */
const hueStyle = (seed: string) => ({ '--ph-h': hueOf(seed) } as CSSProperties);

export function Avatar({ name, seed }: { name: string; seed: string }) {
  return <span className="ph-avatar" aria-hidden="true" style={hueStyle(seed)}>{initialsOf(name)}</span>;
}

const DAY = 86400_000;

/** „14:05" heute, „wt" in dieser Woche, „12 paź" in diesem Jahr, sonst „12.10.2025". */
export function shortWhen(at: number): string {
  const d = new Date(at);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  if (now.getTime() - at < 6 * DAY) return d.toLocaleDateString('pl-PL', { weekday: 'short' });
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
  return d.toLocaleDateString('pl-PL');
}

export const dayLabel = (at: number): string =>
  new Date(at).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: new Date(at).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });

export const timeOf = (at: number): string => new Date(at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

/** Die Höhe der Kopfleiste als Variable: die Suche klebt darunter, ein Gespräch füllt, was darunter bleibt. */
export const barStyle = (top: number): CSSProperties => ({ '--ph-top': `${top}px` } as CSSProperties);

/* -- Suchen: nach Menschen, Nummern oder im Text ------------------------------------------------ */

export type SearchMode = 'osoby' | 'numery' | 'tresc';

export const SEARCH: Record<SearchMode, { readonly label: string; readonly placeholder: string }> = {
  osoby: { label: 'Osoby', placeholder: 'Szukaj osoby…' },
  numery: { label: 'Numery', placeholder: 'Szukaj numeru…' },
  tresc: { label: 'Wiadomości', placeholder: 'Szukaj w treści…' }
};

export const isMode = (value: string): value is SearchMode => value === 'osoby' || value === 'numery' || value === 'tresc';

/** Ein Stück um den Treffer — die Stelle, nicht der Anfang einer langen Nachricht. */
export function around(text: string, query: string): string {
  const at = fold(text).indexOf(fold(query));
  if (at < 0 || text.length <= 120) return text;
  const from = Math.max(0, at - 40);
  return `${from > 0 ? '…' : ''}${text.slice(from, from + 120)}${from + 120 < text.length ? '…' : ''}`;
}

/** Passt ein Gespräch zur Suche nach Menschen oder Nummern? (Die Suche im Text macht jede Ansicht selbst.) */
export function conversationMatches(mode: SearchMode, query: string, title: string, addresses: readonly string[]): boolean {
  const q = query.trim();
  if (q === '' || mode === 'tresc') return true;
  if (mode === 'numery') {
    const digits = q.replace(/\D/g, '');
    /* „mBank", „8080": Absender ohne Rufnummer — dann nach dem Text. */
    return digits === ''
      ? addresses.some((a) => fold(a).includes(fold(q)))
      : addresses.some((a) => a.replace(/\D/g, '').includes(digits));
  }
  return fold(title).includes(fold(q));
}
