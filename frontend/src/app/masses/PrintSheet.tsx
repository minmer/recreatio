/**
 * „Druk" — der Bogen einer Woche mit den Intentionen.
 */

import { useState } from 'react';

import { useT } from '../core/i18n';
import { WorkspaceError } from '../core/session';
import { loadPlan } from './mass';
import { printIntentions, sheetWeek } from './sheet';

/* -- Der Bogen ------------------------------------------------------------- */

export function PrintSheet({ calendarId }: { calendarId: string }) {
  const t = useT();
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
      if (!printIntentions(found.masses, start, end, t.lang)) {
        setFailed(t('masses.print.blocked'));
      }
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('masses.print.failed'));
    }
  };

  return (
    <section className="wk-form">
      <h4 className="wk-h2">{t('masses.print.title')}</h4>

      <div className="wk-mo-top">
        <label className="wk-field">
          <span>{t('common.from')}</span>
          <input
            type="date" value={week.from}
            onChange={(e) => setWeek({ ...week, from: e.target.value })}
          />
        </label>

        <label className="wk-field">
          <span>{t('common.to')}</span>
          <input
            type="date" value={week.to}
            onChange={(e) => setWeek({ ...week, to: e.target.value })}
          />
        </label>
      </div>

      <p className="wk-hint">
        {t('masses.print.hint')}
      </p>

      {failed !== null && <p className="wk-error">{failed}</p>}

      <div className="wk-actions">
        <button type="button" className="wk-btn" onClick={() => void print()}>
          {t('masses.print.print')}
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
          {t('masses.print.nextWeek')}
        </button>
      </div>
    </section>
  );
}
