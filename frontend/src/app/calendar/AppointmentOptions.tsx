/**
 * 2026-10-24 — WOHIN DIE TERMINE EINES DOKUMENTS GEHEN: je Eingang ein
 * Kalender, in dem ich schreibe (wie bei einem Formular der Bereich, in den
 * neue Antworten gehen). Vorgewählt ist, was das Dokument vorschlägt — wenn
 * ich dort schreibe —, sonst der einzige Kalender, den ich habe.
 */

import { useEffect, useRef, useState } from 'react';

import { loadCalendars, type CalendarRow } from './calendar';
import type { EntryPoint } from './appointmentsJson';

/** Kalender, in die ich eintrage — nicht archiviert, mit Schreibrecht. */
export const writableCalendars = (rows: readonly CalendarRow[]): readonly CalendarRow[] =>
  rows.filter((c) => c.mayWrite === true && c.archived !== true);

/** Was vorgewählt wird: der Vorschlag des Dokuments, sonst der einzige Kalender. */
export function suggestedCalendar(entry: EntryPoint, writable: readonly CalendarRow[]): string {
  if (entry.suggested !== null && writable.some((c) => c.calendarId === entry.suggested)) return entry.suggested;
  return writable.length === 1 ? writable[0].calendarId : '';
}

export function AppointmentOptions({ entries, chosen, onChoose }: {
  entries: readonly EntryPoint[];
  /** Eingang → Kalender. */
  chosen: Readonly<Record<string, string>>;
  onChoose: (entry: string, calendarId: string) => void;
}) {
  const [calendars, setCalendars] = useState<readonly CalendarRow[] | null>(null);

  useEffect(() => {
    let live = true;
    loadCalendars().then((r) => { if (live) setCalendars(writableCalendars(r.calendars)); }, () => { if (live) setCalendars([]); });
    return () => { live = false; };
  }, []);

  /*
     Vorwahl, sobald die Kalender da sind — je Eingang EINMAL und nur, wo noch
     nichts gewählt ist. Wer danach „— wybierz kalendarz —" nimmt, will die
     Termine dieses Eingangs auslassen; das bleibt so.
  */
  const offered = useRef(new Set<string>());
  useEffect(() => {
    if (calendars === null) return;
    for (const entry of entries) {
      if (offered.current.has(entry.key)) continue;
      offered.current.add(entry.key);
      if ((chosen[entry.key] ?? '') !== '') continue;
      const pick = suggestedCalendar(entry, calendars);
      if (pick !== '') onChoose(entry.key, pick);
    }
  }, [calendars, entries]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="wk-appointment-options" data-appointment-options="">
      {entries.map((entry) => (
        <label key={entry.key} className="wk-field">
          <span>Terminy „{entry.label}” ({entry.count}) trafiają do kalendarza</span>
          <select value={chosen[entry.key] ?? ''} disabled={calendars === null} data-appointment-entry={entry.key}
            onChange={(e) => onChoose(entry.key, e.target.value)}>
            <option value="">{calendars === null ? 'Wczytywanie kalendarzy…' : calendars.length === 0 ? '— nie piszesz w żadnym kalendarzu —' : '— wybierz kalendarz —'}</option>
            {(calendars ?? []).map((c) => (
              <option key={c.calendarId} value={c.calendarId}>{c.areaName} · {c.title}</option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

export default AppointmentOptions;
