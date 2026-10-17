/**
 * „Druk" — der Bogen einer Woche mit den Intentionen.
 */

import { useState } from 'react';

import { WorkspaceError } from '../core/session';
import { loadPlan } from './mass';
import { printIntentions, sheetWeek } from './sheet';

/* -- Der Bogen ------------------------------------------------------------- */

export function PrintSheet({ calendarId }: { calendarId: string }) {
  const [week, setWeek] = useState(() => sheetWeek(new Date()));
  const [failed, setFailed] = useState<string | null>(null);

  const print = async () => {
    setFailed(null);

    try {
      const start = new Date(`${week.from}T00:00:00`);
      const end = new Date(`${week.to}T23:59:59`);

      /*
       * Frisch geholt und nicht aus dem Fenster genommen: das Blatt geht an die
       * Wand und soll den Stand von jetzt zeigen, nicht den von vorhin. Und aus
       * dem ÖFFENTLICHEN Plan — genau das, was auch vorgelesen wird.
       */
      const found = await loadPlan(calendarId, start, end);
      if (!printIntentions(found.masses, start, end)) {
        setFailed('Nie udało się otworzyć wydruku — przeglądarka mogła zablokować nowe okno.');
      }
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się przygotować wydruku.');
    }
  };

  return (
    <section className="wk-form">
      <h4 className="wk-h2">Wydruk do gabloty</h4>

      <div className="wk-mo-top">
        <label className="wk-field">
          <span>Od</span>
          <input
            type="date" value={week.from}
            onChange={(e) => setWeek({ ...week, from: e.target.value })}
          />
        </label>

        <label className="wk-field">
          <span>Do</span>
          <input
            type="date" value={week.to}
            onChange={(e) => setWeek({ ...week, to: e.target.value })}
          />
        </label>
      </div>

      <p className="wk-hint">
        Arkusz idzie od poniedziałku do niedzieli — tak wisi w gablocie.
        Intencje zbiorowe dostają osobną stronę, z miejscem na dopiski.
      </p>

      {failed !== null && <p className="wk-error">{failed}</p>}

      <div className="wk-actions">
        <button type="button" className="wk-btn" onClick={() => void print()}>
          Drukuj intencje (A4)
        </button>

        <button
          type="button"
          className="wk-link-btn"
          onClick={() => {
            const next = new Date(`${week.from}T00:00:00`);
            next.setDate(next.getDate() + 7);
            setWeek(sheetWeek(next));
          }}
        >
          następny tydzień
        </button>
      </div>
    </section>
  );
}
