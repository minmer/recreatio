/**
 * Der Messplan auf einer Seite — der eine Baustein, der seinen Inhalt holt.
 *
 * <b>Er steht auch dann da, wenn sein `config` leer ist.</b> Im `config` steht
 * nur, WELCHER Kalender und wie viele Tage — die Messen selbst kommen erst
 * beim Aufruf. Deshalb hat er immer etwas zu zeigen (`hasContent`).
 *
 * <b>Der Baustein nennt einen KALENDER, nicht eine Adresse.</b> Das ist die
 * Antwort auf „welcher Bereich trägt den Messplan": der Kalender gehört einem
 * Bereich, und wer dessen Epochenschlüssel offengelegt hat, dessen Messen
 * hängen im Schaukasten — auf JEDER Seite, die den Kalender nennt, auch einer
 * fremden.
 *
 * <b>Ohne Kalender wird gesammelt.</b> Steht kein Kalender im `config`, zeigt
 * der Baustein alle Messen, die offen liegen, mit der Angabe woher. Das ist
 * kein Notbehelf, sondern der Dekanatsplan.
 *
 * <b>Was gezeigt wird, entscheidet die GRÖSSE</b> (`massShape.ts`) — zwölf
 * Grössen, zwölf Antworten — und die UHR: die Ansicht beginnt bei der
 * nächsten Messe, die noch nicht vorbei ist, und rückt von selbst weiter.
 *
 * <b>Ein Fehlschlag schweigt nicht.</b> Der Besucher bekommt eine ruhige Zeile
 * statt einer leeren Kachel: eine Kachel, die nichts sagt, sieht für den, der
 * die Seite führt, genauso aus wie eine, die nichts zu sagen hat.
 */

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

import {
  byDay, CONFESSION, dayKey, fullDayLabel, hour, loadPlan, massesOnly, shortDayLabel, type PublicMass
} from './mass';
import { daysToLoad, isAhead, massView, nextOf, soon, type MassView } from './massShape';
import type { PartSize } from './part';

/** Mitternacht des heutigen Tages — der Aushang beginnt nicht „vor einer Stunde". */
function startOfToday(now: Date): Date {
  const at = new Date(now);
  at.setHours(0, 0, 0, 0);
  return at;
}

/**
 * DIE UHR — alle halbe Minute, und sobald die Karte wieder sichtbar wird.
 * Ohne sie stünde um 18:05 noch „za 5 min" da, und nach Mitternacht der
 * gestrige Tag als „dziś".
 */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = window.setInterval(tick, 30_000);
    const onShow = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onShow);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onShow); };
  }, []);

  return now;
}

interface Day {
  readonly day: string;
  readonly masses: readonly PublicMass[];
}

export function MassCard({ title, calendar, days: wanted, size }: {
  title: string;
  calendar: string;

  /**
   * Wie viele Tage — oder `null`, wenn niemand es gesagt hat.
   *
   * <b>`null` ist nicht 7.</b> Ohne Angabe richtet sich die Zahl nach dem,
   * was in die Kachel passt; eine Vorgabe daraus zu machen hiesse, jede
   * flache Kachel mit sieben Tagen zu füllen, die sie nicht zeigen kann.
   */
  days: number | null;

  size: PartSize;
}) {
  const shown = massView(size, wanted);
  const load = daysToLoad(shown);
  const now = useNow();
  const today = dayKey(now.toISOString());

  const [plan, setPlan] = useState<readonly PublicMass[] | null | undefined>(undefined);

  useEffect(() => {
    // Wer schnell zwischen zwei Seiten wechselt, bekommt sonst den Plan der
    // ersten auf der zweiten zu sehen.
    let alive = true;

    const from = startOfToday(new Date());
    const to = new Date(from);
    to.setDate(to.getDate() + load);

    loadPlan(calendar === '' ? undefined : calendar, from, to)
      .then((found) => { if (alive) setPlan(found.masses); })
      .catch(() => { if (alive) setPlan(null); });

    return () => { alive = false; };

    // `today`: nach Mitternacht beginnt der Plan einen Tag später.
  }, [calendar, load, today]);

  if (plan === undefined) {
    return <Frame title={title}><p className="wk-card-muted">Wczytywanie…</p></Frame>;
  }

  if (plan === null) {
    return <Frame title={title}><p className="wk-card-muted">Planu nie udało się wczytać.</p></Frame>;
  }

  const masses = massesOnly(plan);
  const next = nextOf(masses, now);

  /*
   * „Keine Messen" heisst bei einem Messplan fast immer eines von zwei Dingen:
   * es ist keine eingetragen, oder der Schlüssel des Bereichs liegt nicht offen.
   * Das zweite sieht wie das erste aus — deshalb steht es dabei, sonst sucht
   * jemand den Fehler bei den Messen statt beim Schlüssel.
   */
  if (next === null) {
    return (
      <Frame title={title}>
        <p className="wk-card-muted">
          {masses.length === 0 ? 'Brak mszy w planie.' : 'W najbliższych dniach nie ma już mszy.'}
          {masses.length === 0 && calendar !== '' && ' Jeśli msze są wpisane, sprawdź, czy epoka obszaru jest opublikowana.'}
        </p>
      </Frame>
    );
  }

  /*
   * DIE TAGE, ab dem Tag der nächsten Messe — mit der Beichte darin, wo sie
   * dazugehört. Ein Tag ohne Messe (nur Beichte) ist kein Tag des Messplans.
   */
  const services = shown.confessions ? plan : masses;
  const days: Day[] = byDay(services)
    .filter((one) => one.day >= dayKey(next.startsAt) && one.masses.some((m) => m.kind !== CONFESSION));

  /*
   * DAS WO nur, wenn es etwas unterscheidet: im Sammelplan aus mehreren
   * Kalendern. Kommt alles aus einem, stünde unter jeder Uhrzeit derselbe Name.
   */
  const place = calendar === '' && new Set(masses.map((m) => m.calendarId)).size > 1;
  const ctx: Ctx = { now, next, place, shown };

  return (
    <Frame title={title}>
      {shown.form === 'next' && <Next ctx={ctx} />}
      {shown.form === 'hours' && <HoursStrip ctx={ctx} days={days.slice(0, shown.days)} />}
      {shown.form === 'ticker' && <Ticker ctx={ctx} masses={masses} />}
      {shown.form === 'spotlight' && <Spotlight ctx={ctx} days={days.slice(0, shown.days)} />}
      {shown.form === 'day' && <OneDay ctx={ctx} days={days.slice(0, 2)} />}
      {shown.form === 'stack' && <Several ctx={ctx} days={days.slice(0, shown.days)} columns={1} />}
      {shown.form === 'columns' && <Several ctx={ctx} days={days.slice(0, shown.days)} columns={shown.columns} />}
    </Frame>
  );
}

/** Was jede Form wissen muss. */
interface Ctx {
  readonly now: Date;
  readonly next: PublicMass;

  /** Im Sammelplan gehört das WO dazu: eine Uhrzeit ohne Ort ist keine Auskunft, sondern ein Rätsel. */
  readonly place: boolean;
  readonly shown: MassView;
}

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      {title !== '' && <h2 className="wk-card-title">{title}</h2>}
      {children}
    </>
  );
}

const same = (a: PublicMass, b: PublicMass) => a.itemId === b.itemId && a.occurrenceAt === b.occurrenceAt;
const keyOf = (m: PublicMass) => `${m.itemId}-${m.occurrenceAt}`;

/* -- Streifen ---------------------------------------------------------------- */

/** Die eine nächste Messe, und wann. Mehr passt in eine schmale Zeile nicht, und weniger hilft nicht. */
function Next({ ctx }: { ctx: Ctx }) {
  const { next, now, place } = ctx;
  const when = soon(next, now);

  return (
    <p className="wk-mass-next">
      <span className="wk-mass-dayname">{shortDayLabel(next.startsAt, now)}</span>
      <strong className="wk-mass-big">{hour(next.startsAt)}</strong>
      {when !== null && <span className="wk-mass-soon">{when}</span>}
      {place && <span className="wk-mass-where">{next.calendarTitle}</span>}
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
        <p className="wk-mass-hours" key={one.day}>
          <span className="wk-mass-dayname">{shortDayLabel(one.masses[0].startsAt, ctx.now)}</span>
          {' '}
          <Times masses={one.masses} ctx={ctx} />
        </p>
      ))}
    </div>
  );
}

function Times({ masses, ctx }: { masses: readonly PublicMass[]; ctx: Ctx }) {
  return (
    <>
      {masses.map((m, i) => (
        <span key={keyOf(m)}>
          {i > 0 && <span className="wk-mass-sep"> · </span>}
          <span className={`wk-mass-t${timeClass(m, ctx)}`} title={m.title ?? undefined}>{hour(m.startsAt)}</span>
        </span>
      ))}
    </>
  );
}

const timeClass = (m: PublicMass, ctx: Ctx) =>
  m.status === 'cancelled' ? ' is-cancelled'
  : same(m, ctx.next) ? ' is-next'
  : !isAhead(m, ctx.now) ? ' is-past'
  : '';

/**
 * Über die ganze Breite: die nächste Messe MIT ihrer Intention — nach ihr
 * fragt, wer eine gegeben hat —, und dahinter, was danach kommt.
 */
function Ticker({ ctx, masses }: { ctx: Ctx; masses: readonly PublicMass[] }) {
  const { next, now, place } = ctx;
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
        {place && <span className="wk-mass-where">{next.calendarTitle}</span>}
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

/**
 * Schmal: die nächste Messe hervorgehoben, mit ihren Intentionen; darunter
 * die Uhrzeiten, die danach kommen — der Rest ihres Tages und die nächsten
 * Tage, je eine Zeile.
 */
function Spotlight({ ctx, days }: { ctx: Ctx; days: readonly Day[] }) {
  const { next, now, place } = ctx;
  const when = soon(next, now);
  const rest = days.map((one, i) => ({
    day: one.day,
    masses: i === 0 ? one.masses.filter((m) => new Date(m.startsAt) > new Date(next.startsAt)) : one.masses
  })).filter((one) => one.masses.length > 0);

  return (
    <>
      <div className="wk-mass-feature">
        <p className="wk-mass-next">
          <span className="wk-mass-dayname">{shortDayLabel(next.startsAt, now)}</span>
          <strong className="wk-mass-big">{hour(next.startsAt)}</strong>
          {when !== null && <span className="wk-mass-soon">{when}</span>}
        </p>
        {(next.title ?? '') !== '' && <span className="wk-mass-title">{next.title}</span>}
        {place && <span className="wk-mass-where">{next.calendarTitle}</span>}
        <Intentions mass={next} />
      </div>

      {rest.length > 0 && (
        <div className="wk-mass-then">
          <p className="wk-mass-label">Potem</p>
          <ul className="wk-mass-then-list">
            {rest.map((one) => (
              <li key={one.day}>
                <span className="wk-mass-dayname">{shortDayLabel(one.masses[0].startsAt, now)}</span>
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
function OneDay({ ctx, days }: { ctx: Ctx; days: readonly Day[] }) {
  const [first, second] = days;

  return (
    <>
      <DayBlock ctx={ctx} day={first} />
      {second !== undefined && (
        <p className="wk-mass-after">
          <span className="wk-mass-dayname">{shortDayLabel(second.masses[0].startsAt, ctx.now)}</span>
          {' '}
          <Times masses={second.masses.filter((m) => m.kind !== CONFESSION)} ctx={ctx} />
        </p>
      )}
    </>
  );
}

/** Mehrere Tage — untereinander (`columns` 1) oder nebeneinander. */
function Several({ ctx, days, columns }: { ctx: Ctx; days: readonly Day[]; columns: number }) {
  return (
    <div
      className={columns > 1 ? 'wk-mass-cols' : 'wk-mass-days'}
      style={columns > 1 ? { '--mass-cols': columns } as CSSProperties : undefined}
    >
      {days.map((one) => <DayBlock key={one.day} ctx={ctx} day={one} />)}
    </div>
  );
}

/**
 * EIN TAG. Was heute schon war, ist zugeklappt („Wcześniej: 7:00") — da, aber
 * nicht im Weg; die nächste Messe ist hervorgehoben und sagt, wann.
 */
function DayBlock({ ctx, day }: { ctx: Ctx; day: Day }) {
  const past = day.masses.filter((m) => m.status !== 'cancelled' && new Date(m.endsAt) <= ctx.now);
  const ahead = day.masses.filter((m) => !past.includes(m));

  return (
    <section className="wk-mass-day">
      <h3 className="wk-mass-day-name">{fullDayLabel(day.masses[0].startsAt, ctx.now)}</h3>

      {past.length > 0 && (
        <details className="wk-mass-past">
          <summary>
            Wcześniej: {past.filter((m) => m.kind !== CONFESSION).map((m) => hour(m.startsAt)).join(' · ')
              || past.map((m) => hour(m.startsAt)).join(' · ')}
          </summary>
          {past.map((m) => <Row key={keyOf(m)} ctx={ctx} mass={m} />)}
        </details>
      )}

      {ahead.map((m) => <Row key={keyOf(m)} ctx={ctx} mass={m} />)}
    </section>
  );
}

/** Eine Messe (oder Beichte) in einem Tag: Uhrzeit links, alles andere daneben. */
function Row({ ctx, mass }: { ctx: Ctx; mass: PublicMass }) {
  const confession = mass.kind === CONFESSION;
  const cancelled = mass.status === 'cancelled';
  const isNext = same(mass, ctx.next);
  const when = isNext ? soon(mass, ctx.now) : null;
  const past = !cancelled && !isAhead(mass, ctx.now);

  const cls = ['wk-mass-row',
    confession && 'is-confession', cancelled && 'is-cancelled', isNext && 'is-next', past && 'is-past']
    .filter(Boolean).join(' ');

  return (
    <div className={cls}>
      <span className="wk-mass-hour">{hour(mass.startsAt)}</span>
      <span className="wk-mass-what">
        {confession ? (
          <span className="wk-mass-title">Spowiedź do {hour(mass.endsAt)}</span>
        ) : (
          <>
            {((mass.title ?? '') !== '' || when !== null || cancelled) && (
              <span className="wk-mass-head">
                {(mass.title ?? '') !== '' && <span className="wk-mass-title">{mass.title}</span>}
                {when !== null && <span className="wk-mass-soon">{when}</span>}
                {cancelled && <span className="wk-mass-off">odwołana</span>}
              </span>
            )}
            {ctx.place && <span className="wk-mass-where">{mass.calendarTitle}</span>}
            {!cancelled && ctx.shown.intentions === 'all' && <Intentions mass={mass} />}
          </>
        )}
      </span>
    </div>
  );
}

/**
 * Die Intentionen einer Messe.
 *
 * <b>Zusammengelegte werden gezählt und aufklappbar, nicht ausgeschrieben.</b>
 * Ihre Liste wächst die ganze Woche über; sie hier auszuschreiben schöbe den
 * Rest des Plans aus der Kachel. Dass es sie GIBT — und welche —, gehört aber
 * hierher: wer eine Intention gibt, hat ein Recht zu wissen, ob sie allein
 * oder mit anderen gelesen wird, und ob seine dabei ist.
 */
function Intentions({ mass }: { mass: PublicMass }) {
  const ones = mass.intentions.filter((i) => i.kind !== 'collective');
  const many = mass.intentions.filter((i) => i.kind === 'collective');

  if (ones.length === 0 && many.length === 0) return null;

  return (
    <>
      {ones.length === 1 && <span className="wk-mass-int">{ones[0].text}</span>}

      {ones.length > 1 && (
        <ol className="wk-mass-ints">
          {ones.map((i) => <li key={i.ordinal}>{i.text}</li>)}
        </ol>
      )}

      {many.length > 0 && (
        <details className="wk-mass-many">
          <summary>Intencje zbiorowe ({many.length})</summary>
          <ol className="wk-mass-ints">
            {many.map((i) => <li key={i.ordinal}>{i.text}</li>)}
          </ol>
        </details>
      )}
    </>
  );
}

export default MassCard;
