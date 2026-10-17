/**
 * EIN KLEINES MONATSBLATT, auf dem man einen Tag wählt.
 *
 * <b>Kein Datumsfeld.</b> `<input type="date">` sieht auf jedem Gerät anders
 * aus, zeigt keine Woche und sagt nicht, welcher Tag heute ist. Wer im
 * Messplan blättert, denkt in Wochen („nächsten Sonntag") — also ein Blatt
 * mit Montag vorn, heute markiert, und der gewählte Tag oder die gewählte
 * Woche hervorgehoben.
 *
 * Jeder Tag ist ein Knopf mit dem ganzen Datum als Beschriftung: ein
 * Vorleseprogramm liest „wtorek, 29 września 2026", nicht „29".
 *
 * <b>Welchen Monat es zeigt, gehört ihm selbst</b> — wer darin blättert, soll
 * nicht zurückspringen, bloss weil die Seite neu zeichnet. Wechselt der
 * GEWÄHLTE Tag in einen anderen Monat, setzt der Aufrufer das Blatt über
 * `key` neu auf.
 */

import { useState } from 'react';

import {
  addMonths, firstOfMonth, keyOf, longDate, mondayOf, monthGrid, monthTitle, sameDay, sameMonth, WEEK_HEADS
} from './dayMath';

export function MonthPicker({ value, week, today, onPick }: {
  /** Der gewählte Tag — oder `null`: keiner. */
  value: Date | null;

  /** Die ganze Woche des gewählten Tags hervorheben (Wochenansicht). */
  week: boolean;
  today: Date;
  onPick: (day: Date) => void;
}) {
  const [month, setMonth] = useState(() => firstOfMonth(value ?? today));
  const monday = value === null ? null : keyOf(mondayOf(value));

  return (
    <div className="wk-cal">
      <div className="wk-cal-head">
        <button type="button" className="wk-cal-step" aria-label="Poprzedni miesiąc" onClick={() => setMonth(addMonths(month, -1))}>‹</button>
        <span className="wk-cal-title" aria-live="polite">{monthTitle(month)}</span>
        <button type="button" className="wk-cal-step" aria-label="Następny miesiąc" onClick={() => setMonth(addMonths(month, 1))}>›</button>
      </div>

      <div className="wk-cal-grid">
        {WEEK_HEADS.map((head) => <span key={head} className="wk-cal-dow" aria-hidden="true">{head}</span>)}

        {monthGrid(month).map((day) => {
          const chosen = value !== null && (week ? keyOf(mondayOf(day)) === monday : sameDay(day, value));
          const cls = ['wk-cal-day',
            !sameMonth(day, month) && 'is-out',
            sameDay(day, today) && 'is-today',
            chosen && 'is-on',
            chosen && week && 'is-week']
            .filter(Boolean).join(' ');

          return (
            <button
              key={keyOf(day)}
              type="button"
              className={cls}
              aria-label={`${longDate(day)}${sameDay(day, today) ? ' (dziś)' : ''}`}
              aria-pressed={chosen}
              onClick={() => onPick(day)}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default MonthPicker;
