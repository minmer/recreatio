/**
 * DER BLICK — die Form, die eine Grösse zeigt (`massShape.ts`), ab JETZT oder
 * ab einem gewählten Tag.
 *
 * Ab jetzt: die nächste Messe, die noch nicht vorbei ist, bestimmt den ersten
 * Tag; was heute schon war, ist zugeklappt. Ab einem gewählten Tag (die
 * grossen Kacheln blättern, `MassBrowser`): die Tage von dort an, ganz — dort
 * gibt es kein „jetzt", das man hervorheben könnte.
 */

import type { CSSProperties } from 'react';

import { keyOf } from './dayMath';
import { byDay, CONFESSION, dayKey, hour, massesOnly, shortDayLabel, type PublicMass } from './mass';
import { isAhead, nextOf, soon, type MassView } from './massShape';
import {
  daysWith, DayBlock, Intentions, onlyMasses, same, Times, type Ctx, type Day
} from './MassParts';

export function Glance({ shown, services, now, anchor, place, calendarSet, onOpen }: {
  shown: MassView;

  /** Was geholt wurde — Messen und Beichten. */
  services: readonly PublicMass[];
  now: Date;

  /** `null`: ab jetzt. Sonst ab diesem Tag, ohne Zuklappen. */
  anchor: Date | null;
  place: boolean;

  /** Nennt die Kachel einen Kalender? Dann gehört zu „keine Messen" der Hinweis auf den Schlüssel. */
  calendarSet: boolean;

  /** Eine Tagesüberschrift führt zur Tagesansicht — wo es eine gibt. */
  onOpen?: (date: Date) => void;
}) {
  const masses = massesOnly(services);
  const next = anchor === null ? nextOf(masses, now) : null;

  /*
   * „Keine Messen" heisst bei einem Messplan fast immer eines von zwei Dingen:
   * es ist keine eingetragen, oder der Schlüssel des Bereichs liegt nicht offen.
   * Das zweite sieht wie das erste aus — deshalb steht es dabei, sonst sucht
   * jemand den Fehler bei den Messen statt beim Schlüssel.
   */
  if (anchor === null && next === null) {
    return (
      <p className="wk-card-muted">
        {masses.length === 0 ? 'Brak mszy w planie.' : 'W najbliższych dniach nie ma już mszy.'}
        {masses.length === 0 && calendarSet && ' Jeśli msze są wpisane, sprawdź, czy epoka obszaru jest opublikowana.'}
      </p>
    );
  }

  /*
   * DIE TAGE, ab dem Tag der nächsten Messe (oder dem gewählten) — mit der
   * Beichte darin, wo sie dazugehört. Ein Tag ohne Messe (nur Beichte) ist
   * kein Tag des Messplans.
   */
  const start = next !== null ? dayKey(next.startsAt) : keyOf(anchor ?? now);
  const days: Day[] = daysWith(shown.confessions ? services : masses)
    .filter((one) => one.key >= start && one.masses.some((m) => m.kind !== CONFESSION));

  if (days.length === 0) return <p className="wk-card-muted">Brak mszy w tych dniach.</p>;

  const ctx: Ctx = { now, next, place, shown, fold: anchor === null };

  return (
    <>
      {shown.form === 'next' && next !== null && <Next ctx={ctx} next={next} />}
      {shown.form === 'hours' && <HoursStrip ctx={ctx} days={days.slice(0, shown.days)} />}
      {shown.form === 'ticker' && next !== null && <Ticker ctx={ctx} next={next} masses={masses} />}
      {shown.form === 'spotlight' && next !== null && <Spotlight ctx={ctx} next={next} days={days.slice(0, shown.days)} />}
      {shown.form === 'day' && <OneDay ctx={ctx} days={days.slice(0, 2)} onOpen={onOpen} />}
      {shown.form === 'stack' && <Several ctx={ctx} days={days.slice(0, shown.days)} columns={1} onOpen={onOpen} />}
      {shown.form === 'columns' && <Several ctx={ctx} days={days.slice(0, shown.days)} columns={shown.columns} onOpen={onOpen} />}
    </>
  );
}

/* -- Streifen ---------------------------------------------------------------- */

/** Die eine nächste Messe, und wann. Mehr passt in eine schmale Zeile nicht, und weniger hilft nicht. */
function Next({ ctx, next }: { ctx: Ctx; next: PublicMass }) {
  const when = soon(next, ctx.now);

  return (
    <p className="wk-mass-next">
      <span className="wk-mass-dayname">{shortDayLabel(next.startsAt, ctx.now)}</span>
      <strong className="wk-mass-big">{hour(next.startsAt)}</strong>
      {when !== null && <span className="wk-mass-soon">{when}</span>}
      {ctx.place && <span className="wk-mass-where">{next.calendarTitle}</span>}
    </p>
  );
}

/**
 * Die Uhrzeiten eines Tages (breiter: zweier) nebeneinander. Die vergangenen
 * stehen blass da und nicht gar nicht — sonst hiesse „7:00 · 18:00" am Abend
 * „18:00", und morgen früh sucht jemand die Messe um sieben.
 */
function HoursStrip({ ctx, days }: { ctx: Ctx; days: readonly Day[] }) {
  return (
    <div className="wk-mass-strip">
      {days.map((one) => (
        <p className="wk-mass-hours" key={one.key}>
          <span className="wk-mass-dayname">{shortDayLabel(one.date.toISOString(), ctx.now)}</span>
          {' '}
          <Times masses={onlyMasses(one)} ctx={ctx} />
        </p>
      ))}
    </div>
  );
}

/**
 * Über die ganze Breite: die nächste Messe MIT ihrer Intention — nach ihr
 * fragt, wer eine gegeben hat —, und dahinter, was danach kommt.
 */
function Ticker({ ctx, next, masses }: { ctx: Ctx; next: PublicMass; masses: readonly PublicMass[] }) {
  const { now } = ctx;
  const when = soon(next, now);
  const after = masses.filter((m) => isAhead(m, now) && !same(m, next)).slice(0, 4);
  const ones = next.intentions.filter((i) => i.kind !== 'collective');
  const many = next.intentions.length - ones.length;

  return (
    <div className="wk-mass-ticker">
      <p className="wk-mass-next">
        <span className="wk-mass-label">Najbliższa</span>
        <span className="wk-mass-dayname">{shortDayLabel(next.startsAt, now)}</span>
        <strong className="wk-mass-big">{hour(next.startsAt)}</strong>
        {when !== null && <span className="wk-mass-soon">{when}</span>}
        {ctx.place && <span className="wk-mass-where">{next.calendarTitle}</span>}
        {(ones.length > 0 || many > 0) && (
          <span className="wk-mass-int">
            {ones.map((i) => i.text).join('; ')}
            {many > 0 && `${ones.length > 0 ? ' · ' : ''}intencje zbiorowe (${many})`}
          </span>
        )}
      </p>

      {/* Je Tag einmal genannt: „jutro 7:00 · 18:00", nicht „jutro 7:00 · jutro 18:00". */}
      {after.length > 0 && (
        <p className="wk-mass-then-line">
          <span className="wk-mass-label">Potem</span>
          {byDay(after).map((one) => (
            <span key={one.day} className="wk-mass-then-day">
              {one.day !== dayKey(next.startsAt) && (
                <span className="wk-mass-dayname">{shortDayLabel(one.masses[0].startsAt, now)} </span>
              )}
              {one.masses.map((m) => hour(m.startsAt)).join(' · ')}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

/* -- Blöcke ------------------------------------------------------------------- */

/** Die nächste Messe, hervorgehoben, mit ihren Intentionen — hier und in der Seitenleiste des Kalenders. */
export function NextBox({ ctx, next, label }: { ctx: Ctx; next: PublicMass; label?: string }) {
  const when = soon(next, ctx.now);

  return (
    <div className="wk-mass-feature">
      {label !== undefined && <p className="wk-mass-label">{label}</p>}
      <p className="wk-mass-next">
        <span className="wk-mass-dayname">{shortDayLabel(next.startsAt, ctx.now)}</span>
        <strong className="wk-mass-big">{hour(next.startsAt)}</strong>
        {when !== null && <span className="wk-mass-soon">{when}</span>}
      </p>
      {(next.title ?? '') !== '' && <span className="wk-mass-title">{next.title}</span>}
      {ctx.place && <span className="wk-mass-where">{next.calendarTitle}</span>}
      <Intentions mass={next} />
    </div>
  );
}

/**
 * Schmal: die nächste Messe hervorgehoben, mit ihren Intentionen; darunter
 * die Uhrzeiten, die danach kommen — der Rest ihres Tages und die nächsten
 * Tage, je eine Zeile.
 */
function Spotlight({ ctx, next, days }: { ctx: Ctx; next: PublicMass; days: readonly Day[] }) {
  const rest = days.map((one, i) => ({
    ...one,
    masses: onlyMasses(one).filter((m) => i > 0 || new Date(m.startsAt) > new Date(next.startsAt))
  })).filter((one) => one.masses.length > 0);

  return (
    <>
      <NextBox ctx={ctx} next={next} />

      {rest.length > 0 && (
        <div className="wk-mass-then">
          <p className="wk-mass-label">Potem</p>
          <ul className="wk-mass-then-list">
            {rest.map((one) => (
              <li key={one.key}>
                <span className="wk-mass-dayname">{shortDayLabel(one.date.toISOString(), ctx.now)}</span>
                <span><Times masses={one.masses} ctx={ctx} /></span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/** Ein ganzer Tag, Messe für Messe; der folgende in einer Zeile darunter. */
function OneDay({ ctx, days, onOpen }: { ctx: Ctx; days: readonly Day[]; onOpen?: (date: Date) => void }) {
  const [first, second] = days;

  return (
    <>
      <DayBlock ctx={ctx} day={first} onOpen={onOpen} />
      {second !== undefined && (
        <p className="wk-mass-after">
          <span className="wk-mass-dayname">{shortDayLabel(second.date.toISOString(), ctx.now)}</span>
          {' '}
          <Times masses={onlyMasses(second)} ctx={ctx} />
        </p>
      )}
    </>
  );
}

/** Mehrere Tage — untereinander (`columns` 1) oder nebeneinander. */
function Several({ ctx, days, columns, onOpen }: {
  ctx: Ctx;
  days: readonly Day[];
  columns: number;
  onOpen?: (date: Date) => void;
}) {
  return (
    <div
      className={columns > 1 ? 'wk-mass-cols' : 'wk-mass-days'}
      style={columns > 1 ? { '--mass-cols': columns } as CSSProperties : undefined}
    >
      {days.map((one) => <DayBlock key={one.key} ctx={ctx} day={one} onOpen={onOpen} />)}
    </div>
  );
}

