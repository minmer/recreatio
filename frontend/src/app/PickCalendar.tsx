/**
 * EINEN TERMINARZ WÄHLEN — die Termine einer Gruppe, statt einer Kennung.
 *
 * Der Messplan fragte nach „Kennung kalendarza", und eingetippt hat die
 * niemand. Seit 0054 hat jede Gruppe genau einen Terminarz; gewählt wird also
 * die GRUPPE, mit ihrem Namen. Leer heisst weiterhin: alle offenen zusammen —
 * der Plan eines Dekanats.
 */

import { useEffect, useState } from 'react';

import { loadCalendars, type CalendarRow } from './calendar';

export function PickCalendar({ value, busy, onPick }: {
  value: string;
  busy: boolean;
  onPick: (calendarId: string) => void;
}) {
  const [rows, setRows] = useState<readonly CalendarRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    loadCalendars()
      .then(({ calendars }) => { if (alive) setRows(calendars); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, []);

  if (rows === null) return <p className="wk-hint">Wczytywanie terminarzy…</p>;

  const known = value === '' || rows.some((r) => r.calendarId === value);

  return (
    <>
      <select value={known ? value : ''} disabled={busy} onChange={(e) => onPick(e.target.value)}>
        <option value="">Wszystkie jawne razem (plan zbiorczy)</option>
        {rows.map((r) => (
          <option key={r.calendarId} value={r.calendarId}>
            {r.areaName}{r.title !== r.areaName ? ` (${r.title})` : ''}
          </option>
        ))}
      </select>

      {!known && (
        <span className="wk-blocker">
          Teraz stoi tu „{value}" — to nie jest terminarz żadnej z Twoich grup. Wybierz właściwy.
        </span>
      )}
    </>
  );
}

export default PickCalendar;
