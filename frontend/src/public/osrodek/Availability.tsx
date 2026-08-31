/**
 * Die Belegungsinsel (Abschnitt 4.2).
 *
 * <b>Sie zeigt frei und belegt. Sonst nichts.</b> Kein Gruppenname, kein Zweck,
 * kein Kontakt — und zwar nicht, weil die Felder leer gelassen wurden, sondern
 * weil es sie in der Antwort nicht gibt (`RcBusyPeriod`). Ein Feld, das da ist,
 * wird irgendwann gefüllt.
 *
 * <b>Ohne Konto.</b> Eine Gruppe muss den Juli prüfen können, ohne sich
 * anzumelden. Der Aufruf trägt deshalb kein Öffnungsstück.
 *
 * <b>Nicht erreichbar ist nicht belegt.</b> Der Unterschied steht auf der
 * Seite: wer eine Fehlermeldung als „ausgebucht" liest, fragt nicht mehr an.
 */

import { useEffect, useState } from 'react';
import {
  rcFreeBusy, rcMonthDays, rcMonthRange, type RcBusyPeriod
} from '../../rc/lib/rcResource';
import type { PublicCopy } from '../content';

/** Der Slug des Hauses. Ein zweites Haus bekommt seinen eigenen. */
const HOUSE = 'limanowa';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; periods: readonly RcBusyPeriod[] }
  | { kind: 'unreachable' };

export function Availability({ copy }: { copy: PublicCopy }) {
  const t = copy.osrodek.availability;

  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth());
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let alive = true;
    setState({ kind: 'loading' });

    const [from, to] = rcMonthRange(year, month);
    rcFreeBusy(HOUSE, from, to)
      .then((answer) => { if (alive) setState({ kind: 'ready', periods: answer.periods }); })
      .catch(() => { if (alive) setState({ kind: 'unreachable' }); });

    return () => { alive = false; };
  }, [year, month]);

  const periods = state.kind === 'ready' ? state.periods : [];
  const days = rcMonthDays(year, month, periods);

  const step = (by: number) => {
    const next = new Date(Date.UTC(year, month + by, 1));
    setYear(next.getUTCFullYear());
    setMonth(next.getUTCMonth());
  };

  const monthName = new Date(Date.UTC(year, month, 1))
    .toLocaleDateString(document.documentElement.lang || 'pl', {
      month: 'long', year: 'numeric', timeZone: 'UTC'
    });

  const label = (state: string) =>
    state === 'free' ? t.free : state === 'held' ? t.held : t.taken;

  return (
    <section className="pub-sec pub-avail" aria-labelledby="h-avail">
      <h2 className="pub-h2" id="h-avail">{t.title}</h2>
      <p className="pub-p">{t.intro}</p>

      {/* Steht auf der Seite, nicht nur im Code. */}
      <p className="pub-standing">{t.showsNothingElse}</p>

      <div className="pub-avail-bar">
        <button type="button" className="pub-btn-quiet" onClick={() => step(-1)}>
          {'←'}
        </button>
        <strong aria-live="polite">{monthName}</strong>
        <button type="button" className="pub-btn-quiet" onClick={() => step(1)}>
          {'→'}
        </button>
      </div>

      {state.kind === 'loading' && <p className="pub-note">{t.loading}</p>}
      {state.kind === 'unreachable' && <p className="pub-warn">{t.unreachable}</p>}

      {state.kind === 'ready' && (
        <>
          <ol className="pub-grid" aria-label={t.title}>
            {days.map((day) => (
              <li
                key={day.date}
                className="pub-day"
                data-state={day.state}
                data-outside={day.outside}
              >
                <span className="pub-day-n">{Number(day.date.slice(8, 10))}</span>
                <span className="pub-sr">{label(day.state)}</span>
              </li>
            ))}
          </ol>

          <ul className="pub-key">
            <li data-state="free"><span />{t.free}</li>
            <li data-state="held"><span />{t.held}</li>
            <li data-state="confirmed"><span />{t.taken}</li>
          </ul>

          {periods.length === 0 && <p className="pub-note">{t.nothingPlanned}</p>}
        </>
      )}

      <p className="pub-note">{t.noAccountNeeded}</p>
    </section>
  );
}
