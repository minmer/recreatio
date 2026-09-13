/**
 * Der Messplan auf einer Seite — der eine Baustein, der seinen Inhalt holt.
 *
 * <b>Er steht auch dann da, wenn sein `config` leer ist.</b> Alles andere
 * blendet die Seite aus, wenn nichts eingetragen wurde (`isEmpty`), und das ist
 * richtig: eine Überschrift ohne Inhalt sieht aus wie ein Fehler. Hier steht im
 * `config` aber nur, WELCHER Kalender und wie er aussehen soll — die Messen
 * selbst kommen erst beim Aufruf. Deshalb sagt der Katalog `live`, und die
 * Seite lässt ihn stehen.
 *
 * <b>Der Baustein nennt einen KALENDER, nicht eine Adresse.</b> Das ist die
 * Antwort auf „welcher Bereich trägt den Messplan": der Kalender gehört einem
 * Bereich, und wer dessen Epochenschlüssel offengelegt hat, dessen Messen
 * hängen im Schaukasten — auf JEDER Seite, die den Kalender nennt, auch einer
 * fremden. Eine Seite bekommt damit den Plan einer anderen, ohne dass irgendwo
 * etwas geteilt werden müsste; geteilt wurde der Schlüssel.
 *
 * <b>Ohne Kalender wird gesammelt.</b> Steht kein Kalender im `config`, zeigt
 * der Baustein alle Messen, die offen liegen, mit der Angabe woher. Das ist
 * kein Notbehelf, sondern der Dekanatsplan.
 *
 * <b>Was gezeigt wird, entscheidet die GRÖSSE</b> und nicht ein Schalter:
 * `massShape` übersetzt Felder in Inhalt. Eine halbierte Liste von Messzeiten
 * wäre kein Ausschnitt, sondern eine Falschauskunft — wer „7:00, 9:00" liest,
 * kommt um 9 Uhr und weiss nichts von 18:00.
 *
 * <b>Ein Fehlschlag schweigt nicht.</b> Der Besucher bekommt eine ruhige Zeile
 * statt einer leeren Kachel: eine Kachel, die nichts sagt, sieht für den, der
 * die Seite führt, genauso aus wie eine, die nichts zu sagen hat.
 */

import { useEffect, useState } from 'react';

import {
  byDay, dayLabel, hour, massesOnly, type PublicMass, loadPlan
} from './mass';
import { massDays, massShape, showsIntentions } from './massShape';

/** Mitternacht des heutigen Tages — der Aushang beginnt nicht „vor einer Stunde". */
function startOfToday(): Date {
  const at = new Date();
  at.setHours(0, 0, 0, 0);
  return at;
}

export function MassCard({ config, colSpan, rowSpan }: {
  config: Record<string, string>;
  colSpan: number;
  rowSpan: number;
}) {
  const shape = massShape(colSpan, rowSpan);

  /*
   * Wie viele Tage: was eingetragen wurde, sonst was in die Grösse passt. Eine
   * Angabe, die nicht hineinpasst, wird nicht überschrieben — wer sieben Tage
   * will, bekommt sieben und eine Kachel, die scrollt, statt stillschweigend
   * drei.
   */
  const wanted = Number.parseInt((config.days ?? '').trim(), 10);
  const days = Number.isFinite(wanted) && wanted > 0
    ? Math.min(wanted, 31)
    : massDays(shape, rowSpan);

  const calendar = (config.calendar ?? '').trim();

  const [plan, setPlan] = useState<readonly PublicMass[] | null | undefined>(undefined);

  useEffect(() => {
    // Wer schnell zwischen zwei Seiten wechselt, bekommt sonst den Plan der
    // ersten auf der zweiten zu sehen.
    let alive = true;
    setPlan(undefined);

    const from = startOfToday();
    const to = new Date(from);
    to.setDate(to.getDate() + days);

    loadPlan(calendar === '' ? undefined : calendar, from, to)
      .then((found) => { if (alive) setPlan(found.masses); })
      .catch(() => { if (alive) setPlan(null); });

    return () => { alive = false; };
  }, [calendar, days]);

  const title = (config.title ?? '').trim();

  if (plan === undefined) {
    return <Frame title={title}><p className="wk-card-text">Wczytywanie…</p></Frame>;
  }

  if (plan === null) {
    return <Frame title={title}><p className="wk-card-muted">Planu nie udało się wczytać.</p></Frame>;
  }

  const masses = massesOnly(plan);

  /*
   * „Keine Messen" heisst bei einem Messplan fast immer eines von zwei Dingen:
   * es ist keine eingetragen, oder der Schlüssel des Bereichs liegt nicht offen.
   * Das zweite sieht wie das erste aus — deshalb steht es dabei, sonst sucht
   * jemand den Fehler bei den Messen statt beim Schlüssel.
   */
  if (masses.length === 0) {
    return (
      <Frame title={title}>
        <p className="wk-card-muted">
          Brak mszy w planie.
          {calendar !== '' && ' Jeśli msze są wpisane, sprawdź, czy epoka obszaru jest opublikowana.'}
        </p>
      </Frame>
    );
  }

  return (
    <Frame title={title}>
      {shape === 'next' && <Next masses={masses} />}
      {shape === 'hours' && <Hours masses={masses} />}
      {shape === 'list' && <List masses={masses} />}
      {(shape === 'today' || shape === 'days') && (
        <Days
          masses={masses}
          days={shape === 'today' ? 1 : days}
          withIntentions={showsIntentions(shape)}
          withPlace={calendar === ''}
        />
      )}
    </Frame>
  );
}

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      {title !== '' && <h2 className="wk-card-title">{title}</h2>}
      {children}
    </>
  );
}

/* -- Die Formen ------------------------------------------------------------ */

/** Die eine nächste Messe. Mehr passt in eine Zeile nicht, und weniger hilft nicht. */
function Next({ masses }: { masses: readonly PublicMass[] }) {
  const next = masses[0];

  return (
    <p className="wk-card-next">
      <span className="wk-card-next-day">{dayLabel(next.startsAt)}</span>
      {' '}
      <strong>{hour(next.startsAt)}</strong>
      {(next.title ?? '') !== '' && <span className="wk-card-muted"> · {next.title}</span>}
    </p>
  );
}

/**
 * Nur die Uhrzeiten des ersten Tages, nebeneinander.
 *
 * Ohne Intentionen, aber ohne Lücke — und genau das ist der Unterschied
 * zwischen einer Kürzung und einem Verschweigen.
 */
function Hours({ masses }: { masses: readonly PublicMass[] }) {
  const first = byDay(masses)[0];

  return (
    <p className="wk-card-hours">
      <span className="wk-card-next-day">{dayLabel(first.masses[0].startsAt)}</span>
      {': '}
      {first.masses.map((m) => hour(m.startsAt)).join(' · ')}
    </p>
  );
}

/** Schmal und hoch: die Uhrzeiten untereinander, mit dem Namen daneben. */
function List({ masses }: { masses: readonly PublicMass[] }) {
  const first = byDay(masses)[0];

  return (
    <>
      <p className="wk-card-next-day">{dayLabel(first.masses[0].startsAt)}</p>
      <ul className="wk-card-lines">
        {first.masses.map((m) => (
          <li key={`${m.itemId}-${m.occurrenceAt}`}>
            <strong>{hour(m.startsAt)}</strong>
            {(m.title ?? '') !== '' && <span className="wk-card-muted"> {m.title}</span>}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Ein Tag oder mehrere, jeder mit seinen Messen — und, wenn Platz ist, Intentionen. */
function Days({ masses, days, withIntentions, withPlace }: {
  masses: readonly PublicMass[];
  days: number;
  withIntentions: boolean;
  withPlace: boolean;
}) {
  return (
    <div className="wk-mass-days">
      {byDay(masses).slice(0, days).map((group) => (
        <section key={group.day} className="wk-mass-day">
          <h3 className="wk-mass-day-name">{dayLabel(group.masses[0].startsAt)}</h3>

          {group.masses.map((mass) => (
            <div className="wk-mass-row" key={`${mass.itemId}-${mass.occurrenceAt}`}>
              <span className="wk-mass-hour">{hour(mass.startsAt)}</span>
              <span className="wk-mass-what">
                {(mass.title ?? '') !== '' && <span className="wk-mass-title">{mass.title}</span>}

                {/*
                  * Im Sammelplan gehört das WO dazu: eine Uhrzeit ohne Ort ist
                  * keine Auskunft, sondern ein Rätsel.
                  */}
                {withPlace && <span className="wk-mass-where">{mass.calendarTitle}</span>}

                {withIntentions && <Intentions mass={mass} />}
              </span>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

/**
 * Die Intentionen einer Messe.
 *
 * <b>Zusammengelegte werden benannt, nicht aufgezählt.</b> Ihre Liste wächst
 * die ganze Woche über; sie hier auszuschreiben schöbe den Rest des Plans aus
 * der Kachel. Dass es sie GIBT, gehört aber hierher: wer eine Intention gibt,
 * hat ein Recht zu wissen, ob sie allein oder mit anderen gelesen wird.
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
        <span className="wk-mass-many">
          {(mass.title ?? '').trim() === '' ? 'Intencje zbiorowe' : mass.title}
        </span>
      )}
    </>
  );
}

export default MassCard;
