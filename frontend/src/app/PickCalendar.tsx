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

/**
 * MEHRERE KALENDER WÄHLEN (0058) — für den Baustein „Kalendarz": welche
 * Termine er zeigt. Gespeichert als Kennungen mit Komma.
 */
export function PickCalendars({ value, busy, onPick }: {
  value: string;
  busy: boolean;
  onPick: (calendarIds: string) => void;
}) {
  const [rows, setRows] = useState<readonly CalendarRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    loadCalendars()
      .then(({ calendars }) => { if (alive) setRows(calendars.filter((c) => c.archived !== true)); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, []);

  if (rows === null) return <p className="wk-hint">Wczytywanie kalendarzy…</p>;

  const chosen = value.split(',').map((one) => one.trim()).filter((one) => one !== '');
  const toggle = (id: string) => onPick((chosen.includes(id) ? chosen.filter((one) => one !== id) : [...chosen, id]).join(','));

  if (rows.length === 0) return <p className="wk-hint">Nie masz jeszcze żadnego kalendarza grupy.</p>;

  return (
    <div className="wk-pick-cals">
      {rows.map((r) => (
        <label key={r.calendarId} className="wk-check">
          <input type="checkbox" checked={chosen.includes(r.calendarId)} disabled={busy} onChange={() => toggle(r.calendarId)} />
          <span>{r.title}{r.title !== r.areaName ? <span className="wk-hint"> · {r.areaName}</span> : null}</span>
        </label>
      ))}
      {chosen.some((id) => !rows.some((r) => r.calendarId === id)) && (
        <span className="wk-blocker">Jeden z wybranych kalendarzy nie jest już dostępny — zaznacz właściwe.</span>
      )}
      <span className="wk-hint">
        Na stronie każdy zobaczy terminy, które może widzieć. W pełnym ekranie osoby prowadzące kalendarz mogą też dodawać i zmieniać terminy.
      </span>
    </div>
  );
}
