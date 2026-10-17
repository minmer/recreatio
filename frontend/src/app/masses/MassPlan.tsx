/**
 * „Plan" — jedes Vorkommen der zwei Wochen, mit dem, was sich daran ändern lässt; wer feiert.
 */

import { viewPath } from '../routes';
import { CONFESSION, DEVOTION, MASS, type OfficeMass, SERVICE_LABEL, dayKey, dayLabel, hour, intentionsWord, isMass } from './mass';
import { keyOf } from './officeDays';

/* -- Der Plan: jedes Vorkommen, mit dem, was sich daran ändern lässt ------------- */

/**
 * DER PLAN DER ZWEI WOCHEN — Messen, Beichte, Nabożeństwa, Tag für Tag. Jede
 * Zeile sagt, was sie ist (und ob abgesagt oder verlegt), wie viele
 * Intentionen sie trägt und wer feiert; und sie lässt sich ändern, absagen,
 * zurückholen, im Kalender zeigen.
 */
export function Plan({ services, names, onIntentions, onEdit, onToggle }: {
  services: readonly OfficeMass[];
  names: ReadonlyMap<string, string>;
  onIntentions: (one: OfficeMass) => void;
  onEdit: (one: OfficeMass) => void;
  onToggle: (one: OfficeMass) => void;
}) {
  if (services.length === 0) {
    return <p className="wk-empty">W tych dwóch tygodniach nie ma żadnej mszy, spowiedzi ani nabożeństwa. Załóż je w „Nowy wpis".</p>;
  }

  const days = new Map<string, OfficeMass[]>();
  for (const one of services) {
    const key = dayKey(one.startsAt);
    days.set(key, [...(days.get(key) ?? []), one]);
  }

  return (
    <div className="wk-mo-plan">
      {[...days.entries()].map(([key, list]) => (
        <section key={key} className="wk-mo-plan-day">
          <h4 className="wk-mass-day-name">{dayLabel(list[0].startsAt)}</h4>
          <ul className="wk-list">
            {list.map((one) => {
              const live = one.intentions.filter((i) => i.status !== 'cancelled').length;
              const off = one.status === 'cancelled';
              return (
                <li key={keyOf(one)} className={`wk-row wk-mo-plan-row${off ? ' is-cancelled' : ''}`}>
                  <span className="wk-mo-plan-main">
                    <strong>{hour(one.startsAt)}</strong>
                    <span className="wk-tag">{SERVICE_LABEL[one.kind] ?? one.kind}</span>
                    {(one.title ?? '') !== '' && <span>{one.title}</span>}
                    {one.kind === CONFESSION && <span className="wk-row-side">do {hour(one.endsAt)}</span>}
                    {off && <span className="wk-tag wk-tag-warn">{one.skipped === true ? 'odwołana (tylko ten termin)' : 'odwołana'}</span>}
                    {one.moved === true && !off && <span className="wk-tag">przeniesiona</span>}
                    {isMass(one) && <span className="wk-row-side">{live === 0 ? 'bez intencji' : intentionsWord(live)}</span>}
                    <PeopleLine mass={one} names={names} />
                  </span>
                  <span className="wk-appt-actions">
                    {isMass(one) && !off && (
                      <button type="button" className="wk-link-btn" onClick={() => onIntentions(one)}>Intencje</button>
                    )}
                    {!(one.skipped === true) && (
                      <button type="button" className="wk-link-btn" onClick={() => onEdit(one)}>Zmień</button>
                    )}
                    {(one.skipped === true || !off) && (
                      <button type="button" className={one.skipped === true ? 'wk-link-btn' : 'wk-link-btn wk-danger'} onClick={() => onToggle(one)}>
                        {one.skipped === true ? 'Przywróć' : 'Odwołaj'}
                      </button>
                    )}
                    <a className="wk-link-btn" href={viewPath('calendar', dayKey(one.startsAt))}>W kalendarzu</a>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* -- Wer feiert ------------------------------------------------------------------ */

/** Wer feiert, leitet, Beichte hört — mit Namen, wo die Gruppe sie kennt. */
export function PeopleLine({ mass, names }: { mass: OfficeMass; names: ReadonlyMap<string, string> }) {
  const people = mass.people ?? [];
  if (people.length === 0) return null;
  const word = mass.kind === MASS ? 'odprawia' : mass.kind === DEVOTION ? 'prowadzi' : mass.kind === CONFESSION ? 'spowiada' : 'obecni';

  return (
    <span className="wk-row-side wk-mo-people">
      {' · '}{word}: {people.map((p) => names.get(p.roleId) ?? 'osoba').join(', ')}
    </span>
  );
}
