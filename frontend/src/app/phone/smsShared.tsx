/**
 * Was die Ansichten der SMS teilen: das Bild eines Menschen, wie Zeiten dastehen.
 */

import type { CSSProperties } from 'react';

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
