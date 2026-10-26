/**
 * EIN TAG ZUM ANSPRINGEN (2026-10-26) — das Datum über den Nachrichten eines Tages ist ein
 * Knopf: er öffnet den Kalender des Geräts (`<input type="date">`, auf dem Telefon der
 * Kalender von Android), und der Verlauf geht zum gewählten Tag — lädt dafür, wenn nötig,
 * Früheres nach. Für die Rozmowy (`ChatLog`) und die SMS (`SmsLog`).
 *
 * Das Feld liegt unsichtbar über dem Datum: ein Tipp darauf ist der Tipp ins Feld, so öffnet
 * auch eine ältere WebView ohne `showPicker()` ihren Kalender.
 */

import type { ReactNode } from 'react';

/** `2026-10-26` → Mitternacht dieses Tages (Ortszeit), ms — `null`, wenn es kein Tag ist. */
export function dayStart(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m === null) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
}

/** ms → `2026-10-26` (Ortszeit). */
export function dayValue(ms: number): string {
  const d = new Date(ms);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

/** Wie oft beim Anspringen Früheres nachgeladen wird, bis der Tag da ist. */
export const SEEK_PAGES = 40;

/** Das Datum eines Tages als Knopf — `onPick` bekommt den Beginn des gewählten Tages. */
export function DayChip({ at, children, onPick }: { at: number; children: ReactNode; onPick: (start: number) => void }) {
  return (
    <label className="ch-day-pick" title="Przejdź do innego dnia">
      <span>{children}</span>
      <input type="date" className="ch-day-input" aria-label="Przejdź do dnia" value={dayValue(at)} max={dayValue(Date.now())}
        onClick={(e) => {
          const input = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
          if (typeof input.showPicker !== 'function') return;
          e.preventDefault();
          try { input.showPicker(); } catch { /* der Kalender ist schon offen */ }
        }}
        onChange={(e) => {
          const start = dayStart(e.currentTarget.value);
          if (start !== null) onPick(start);
        }} />
    </label>
  );
}

/** Kurz aufleuchten lassen, wohin gesprungen wurde (wie beim Sprung zu einem Zitat). */
export function flashRow(row: HTMLElement): void {
  row.classList.remove('is-flash');
  void row.offsetWidth;
  row.classList.add('is-flash');
  window.setTimeout(() => row.classList.remove('is-flash'), 1700);
}
