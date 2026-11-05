/**
 * Offene Anfragen: meine, und die, um die man mich bittet.
 */

import { useState } from 'react';

import { useT } from '../core/i18n';

import { type Busy, type Holder, type MyClaim, type Rules, minutesToTime, nightsToSpan, releaseClaim, takeSpan } from './resource';
import { type Act, span } from './slotText';

/* -- Wer fragt, wählt die Zeit: was er hält -------------------------------- */

const STATUS_WORD: Record<MyClaim['status'], string> = {
  pending: 'bookings.open.status.pending',
  confirmed: 'bookings.open.status.confirmed',
  declined: 'bookings.open.status.declined',
  released: 'bookings.open.status.released'
};

export function OpenMine({ claims, rules, holder, busy, onAct }: {
  claims: readonly MyClaim[];
  rules: Rules;
  holder: Holder;
  busy: boolean;
  onAct: Act;
}) {
  const t = useT();
  if (claims.length === 0) return null;

  return (
    <section className="wk-panel">
      <h3 className="wk-h2">{t('bookings.open.mine')}</h3>

      <ul className="wk-people">
        {claims.map((c) => (
          <li className="wk-person" key={c.claimId}>
            <span className="wk-person-who"><strong>{span(c.startsAt, c.endsAt, rules, t.lang)}</strong></span>
            <span className="wk-person-can">
              <span className={c.status === 'confirmed' ? 'wk-tag wk-tag-open' : 'wk-tag'}>
                {c.awaits === 'office' ? t('bookings.open.byOffice', { word: t(STATUS_WORD[c.status]) }) : t(STATUS_WORD[c.status])}
              </span>
            </span>
            {(c.status === 'pending' || c.status === 'confirmed') && (
              <button type="button" className="wk-link-btn" disabled={busy}
                onClick={() => void onAct(t('bookings.open.releasing'), () => releaseClaim(c.claimId, holder))}>
                {c.status === 'pending' ? t('bookings.open.withdraw') : t('bookings.open.release')}
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
  const t = useT();
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
      <h3 className="wk-h2">{t('bookings.open.busy')}</h3>

      {busyTimes.length === 0 ? (
        <p className="wk-empty">{t('bookings.open.nothingBusy')}</p>
      ) : (
        <ul className="wk-card-lines">
          {busyTimes.map((b, i) => (
            <li key={i}>
              {span(b.startsAt, b.endsAt, rules, t.lang)}
              {b.tentative && <span className="wk-row-side"> · {t('bookings.open.tentative')}</span>}
              {b.whole && <span className="wk-row-side"> · {t('bookings.open.whole')}</span>}
            </li>
          ))}
        </ul>
      )}

      {holder !== null && !atLimit && (
        <div className="wk-form">
          <h3 className="wk-h2">{t('bookings.open.askTitle')}</h3>

          {rules.byNight ? (
            <>
              <label className="wk-field">
                <span>{t('bookings.open.arrival', { time: minutesToTime(rules.checkInMin) })}</span>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="wk-field">
                <span>{t('bookings.open.departure', { time: minutesToTime(rules.checkOutMin) })}</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
            </>
          ) : (
            <>
              <label className="wk-field">
                <span>{t('bookings.open.day')}</span>
                <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
              </label>
              <div className="wk-actions">
                <label className="wk-field"><span>{t('common.from')}</span>
                  <input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></label>
                <label className="wk-field"><span>{t('common.to')}</span>
                  <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
              </div>
            </>
          )}

          {(rules.bufferBefore > 0 || rules.bufferAfter > 0) && (
            <p className="wk-hint">
              {t('bookings.open.buffer', { minutes: rules.bufferBefore + rules.bufferAfter })}
            </p>
          )}

          <div className="wk-actions">
            <button
              type="button" className="wk-btn" disabled={busy || chosen === null}
              onClick={() => chosen !== null && void onAct(t('bookings.open.sending'),
                () => takeSpan(rules, chosen.starts, chosen.ends, holder))}
            >
              {rules.approval === 'office' ? t('bookings.open.ask') : t('bookings.open.book')}
            </button>

            {rules.approval === 'office' && (
              <span className="wk-row-side">{t('bookings.open.officeAnswers')}</span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
