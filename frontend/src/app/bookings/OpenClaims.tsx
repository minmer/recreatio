/**
 * Offene Anfragen: meine, und die, um die man mich bittet.
 */

import { useState } from 'react';

import { type Busy, type Holder, type MyClaim, type Rules, minutesToTime, nightsToSpan, releaseClaim, takeSpan } from './resource';
import { type Act, span } from './slotText';

/* -- Wer fragt, wählt die Zeit: was er hält -------------------------------- */

const STATUS_WORD: Record<MyClaim['status'], string> = {
  pending: 'czeka na odpowiedź',
  confirmed: 'potwierdzone',
  declined: 'odrzucone',
  released: 'oddane'
};

export function OpenMine({ claims, rules, holder, busy, onAct }: {
  claims: readonly MyClaim[];
  rules: Rules;
  holder: Holder;
  busy: boolean;
  onAct: Act;
}) {
  if (claims.length === 0) return null;

  return (
    <section className="wk-panel">
      <h3 className="wk-h2">Twoje rezerwacje</h3>

      <ul className="wk-people">
        {claims.map((c) => (
          <li className="wk-person" key={c.claimId}>
            <span className="wk-person-who"><strong>{span(c.startsAt, c.endsAt, rules)}</strong></span>
            <span className="wk-person-can">
              <span className={c.status === 'confirmed' ? 'wk-tag wk-tag-open' : 'wk-tag'}>
                {STATUS_WORD[c.status]}{c.awaits === 'office' && ' kancelarii'}
              </span>
            </span>
            {(c.status === 'pending' || c.status === 'confirmed') && (
              <button type="button" className="wk-link-btn" disabled={busy}
                onClick={() => void onAct('Oddawanie…', () => releaseClaim(c.claimId, holder))}>
                {c.status === 'pending' ? 'Wycofaj' : 'Oddaj'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* -- Wer fragt, wählt die Zeit ---------------------------------------------- */

/**
 * Eine eigene Zeit erfragen — nach Nächten oder nach Stunden.
 *
 * <b>Was belegt ist, steht darüber</b>, ohne Namen: wer fragt, soll nicht
 * raten und dann eine Absage bekommen. Die Prüfung macht trotzdem der Dienst —
 * diese Liste ist eine Hilfe, keine Zusage.
 */
export function OpenAsk({ busyTimes, rules, holder, atLimit, busy, onAct }: {
  busyTimes: readonly Busy[];
  rules: Rules;
  holder: Holder | null;
  atLimit: boolean;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [day, setDay] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const span_ = (): { starts: Date; ends: Date } | null => {
    if (rules.byNight) {
      if (from === '' || to === '' || to <= from) return null;
      return nightsToSpan(from, to, rules);
    }

    if (day === '' || start === '' || end === '' || end <= start) return null;
    return { starts: new Date(`${day}T${start}:00`), ends: new Date(`${day}T${end}:00`) };
  };

  const chosen = span_();

  return (
    <>
      <h3 className="wk-h2">Zajęte</h3>

      {busyTimes.length === 0 ? (
        <p className="wk-empty">Nic nie jest zajęte w najbliższym czasie.</p>
      ) : (
        <ul className="wk-card-lines">
          {busyTimes.map((b, i) => (
            <li key={i}>
              {span(b.startsAt, b.endsAt, rules)}
              {b.tentative && <span className="wk-row-side"> · wstępnie</span>}
              {b.whole && <span className="wk-row-side"> · całość zajęta</span>}
            </li>
          ))}
        </ul>
      )}

      {holder !== null && !atLimit && (
        <div className="wk-form">
          <h3 className="wk-h2">Zapytaj o termin</h3>

          {rules.byNight ? (
            <>
              <label className="wk-field">
                <span>Przyjazd (od {minutesToTime(rules.checkInMin)})</span>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="wk-field">
                <span>Wyjazd (do {minutesToTime(rules.checkOutMin)})</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
            </>
          ) : (
            <>
              <label className="wk-field">
                <span>Dzień</span>
                <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
              </label>
              <div className="wk-actions">
                <label className="wk-field"><span>Od</span>
                  <input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></label>
                <label className="wk-field"><span>Do</span>
                  <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
              </div>
            </>
          )}

          {(rules.bufferBefore > 0 || rules.bufferAfter > 0) && (
            <p className="wk-hint">
              Między grupami jest czas na przygotowanie — {rules.bufferBefore + rules.bufferAfter} min.
            </p>
          )}

          <div className="wk-actions">
            <button
              type="button" className="wk-btn" disabled={busy || chosen === null}
              onClick={() => chosen !== null && void onAct('Wysyłanie…',
                () => takeSpan(rules, chosen.starts, chosen.ends, holder))}
            >
              {rules.approval === 'office' ? 'Zapytaj' : 'Rezerwuję'}
            </button>

            {rules.approval === 'office' && (
              <span className="wk-row-side">Kancelaria odpowie — zobaczysz to tutaj.</span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
