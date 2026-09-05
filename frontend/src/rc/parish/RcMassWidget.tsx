/**
 * Plan mszy jako kafelek na stronie głównej — w pięciu postaciach.
 *
 * <b>Mniejszy kafelek pokazuje CO INNEGO, nie mniej tego samego.</b> Plan
 * ucięty w połowie kłamie: ktoś przeczyta „7:00, 9:00" i przyjdzie o 9:00, nie
 * wiedząc o 18:00. Pasek samych godzin — bez intencji — mówi prawdę, choć mówi
 * mniej. Która postać przy której wielkości, rozstrzyga `rcMassShape`, osobno i
 * ze sprawdzeniem.
 *
 * <b>Skąd dane.</b> Z publicznego planu, bez konta — tak jak z gabloty. Serwer
 * wydaje tylko wpisy jawne i tylko `title_public`; zapieczętowanego tytułu tą
 * drogą nie da się otworzyć i o to właśnie chodzi.
 *
 * <b>Czego tu nie ma.</b> Kapłana. Kto celebruje, to sprawa grafiku, nie
 * gabloty. Rodzaj intencji stoi — kto ją zamówił, ma prawo wiedzieć, czy
 * czytana jest sama, czy razem z innymi.
 */

import { useEffect, useState } from 'react';

import {
  rcByDay, rcDayLabel, rcHour, rcPublicMasses,
  type RcPublicMass, type RcPublicMasses as Plan
} from './rcMass';
import { rcMassDays, rcMassShape, rcShowsIntentions, type RcMassShape } from './rcMassShape';

export function RcMassWidget({
  slug, colSpan, rowSpan, onlyIntentions, fallback
}: {
  slug: string;
  colSpan: number;
  rowSpan: number;
  /**
   * Ręcznie wpisane godziny na czas, zanim parafia założy msze jako terminy.
   *
   * Stoją NIŻEJ niż terminy, nie obok: dwa źródła tej samej informacji
   * rozjeżdżają się, a przepisane ręcznie jest tym, którego nikt nie poprawia.
   * Póki terminów nie ma, parafia nie traci swojej strony.
   */
  fallback?: readonly string[];
  /**
   * Kafelek „Intencje" pokazuje to samo źródło, ale prowadzi wzrok inaczej:
   * najpierw intencja, godzina drobnym drukiem obok. Ten sam plan, inne
   * pytanie — „co dziś czytają" zamiast „o której jest msza".
   */
  onlyIntentions?: boolean;
}) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [failed, setFailed] = useState(false);

  const shape = rcMassShape(colSpan, rowSpan);
  const days = rcMassDays(shape, rowSpan);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const from = new Date();
        const to = new Date(from);
        to.setDate(to.getDate() + days);

        const found = await rcPublicMasses(slug, from, to);
        if (alive) setPlan(found);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [slug, days]);

  // Dopóki nie wiadomo, nie stoi tam nic — pusty kafelek jest cichszy niż
  // „wczytywanie…", które przy trzech kafelkach naraz miga trzy razy.
  if (plan === null || failed) return <Fallback rows={fallback} />;

  const masses = (plan.masses ?? []).filter((m) => m.status !== 'cancelled');
  if (masses.length === 0) return <Fallback rows={fallback} />;

  if (onlyIntentions === true) return <Intentions masses={masses} shape={shape} />;

  switch (shape) {
    case 'next': return <Next masses={masses} />;
    case 'hours': return <Hours masses={masses} />;
    case 'list': return <Column masses={masses} />;
    case 'today': return <Today masses={masses} />;
    default: return <Days masses={masses} days={days} />;
  }
}

/** Co pokazać, zanim msze staną się terminami. */
function Fallback({ rows }: { rows?: readonly string[] }) {
  if (rows === undefined || rows.length === 0) return null;

  return (
    <ul className="ps-rows">
      {rows.map((row) => {
        // „7:00 — cicha": myślnik dzieli czas od rzeczy. Bez niego cały wiersz
        // jest rzeczą — lepiej niż połknąć wiersz, który ktoś inaczej myślał.
        const [when, what] = row.split('—');
        return (
          <li key={row}>
            <span>{(when ?? row).trim()}</span>
            <em>{(what ?? '').trim()}</em>
          </li>
        );
      })}
    </ul>
  );
}

/* -- Jedna godzina --------------------------------------------------------- */

/**
 * Najbliższa msza i nic więcej.
 *
 * W pasku na dwa pola mieści się jedna godzina. Wybrana jest ta następna, a nie
 * pierwsza z dnia: o 19:00 nikomu nie pomaga, że rano była siódma.
 */
function Next({ masses }: { masses: readonly RcPublicMass[] }) {
  const now = Date.now();
  const next = masses.find((m) => new Date(m.endsUtc).getTime() >= now) ?? masses[0];

  return (
    <p className="ms-next">
      <span className="ms-when">{rcDayLabel(next.startsUtc)}</span>
      <strong className="ms-hour">{rcHour(next.startsUtc)}</strong>
    </p>
  );
}

/* -- Pasek godzin ---------------------------------------------------------- */

/** Wszystkie godziny dnia obok siebie. Bez intencji, ale bez luki. */
function Hours({ masses }: { masses: readonly RcPublicMass[] }) {
  const [first] = rcByDay(masses);
  if (first === undefined) return null;

  return (
    <div className="ms-strip">
      <span className="ms-when">{rcDayLabel(first.masses[0].startsUtc)}</span>
      <ul className="ms-hours">
        {first.masses.map((mass) => (
          <li key={mass.startsUtc}>{rcHour(mass.startsUtc)}</li>
        ))}
      </ul>
    </div>
  );
}

/* -- Słupek ---------------------------------------------------------------- */

/** Wąsko i wysoko: godziny jedna pod drugą, z nazwą, jeśli jakąś nadano. */
function Column({ masses }: { masses: readonly RcPublicMass[] }) {
  const [first] = rcByDay(masses);
  if (first === undefined) return null;

  return (
    <div className="ms-col">
      <span className="ms-when">{rcDayLabel(first.masses[0].startsUtc)}</span>
      <ul className="ms-rows">
        {first.masses.map((mass) => (
          <li key={mass.startsUtc}>
            <strong>{rcHour(mass.startsUtc)}</strong>
            {(mass.title ?? '') !== '' && <span>{mass.title}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -- Jeden dzień z intencjami ---------------------------------------------- */

function Today({ masses }: { masses: readonly RcPublicMass[] }) {
  const [first] = rcByDay(masses);
  if (first === undefined) return null;

  return (
    <div className="ms-day">
      <span className="ms-when">{rcDayLabel(first.masses[0].startsUtc)}</span>
      <ul className="ms-list">
        {first.masses.map((mass) => <Mass key={mass.startsUtc} mass={mass} withIntentions />)}
      </ul>
    </div>
  );
}

/* -- Kilka dni ------------------------------------------------------------- */

function Days({ masses, days }: { masses: readonly RcPublicMass[]; days: number }) {
  const grouped = rcByDay(masses).slice(0, days);

  return (
    <div className="ms-days">
      {grouped.map((group) => (
        <section key={group.day}>
          <h4 className="ms-when">{rcDayLabel(group.masses[0].startsUtc)}</h4>
          <ul className="ms-list">
            {group.masses.map((mass) => (
              <Mass key={mass.startsUtc} mass={mass} withIntentions />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* -- Kafelek intencji ------------------------------------------------------ */

/**
 * To samo źródło, inne pytanie: „co dziś czytają", a nie „o której jest msza".
 *
 * Dlatego intencja stoi z przodu, a godzina drobnym drukiem obok. Msza bez
 * intencji wypada — w kafelku o intencjach byłaby pustą linią.
 */
function Intentions({
  masses, shape
}: {
  masses: readonly RcPublicMass[];
  shape: RcMassShape;
}) {
  const withText = masses.filter((m) => (m.intentions ?? []).length > 0);
  if (withText.length === 0) return null;

  // W paskach nie ma miejsca na treść — tam zostaje sama liczba.
  if (!rcShowsIntentions(shape)) {
    const count = withText.reduce((sum, m) => sum + (m.intentions ?? []).length, 0);
    return (
      <p className="ms-next">
        <span className="ms-when">{rcDayLabel(withText[0].startsUtc)}</span>
        <strong className="ms-hour">
          {count === 1 ? '1 intencja' : `${count} intencji`}
        </strong>
      </p>
    );
  }

  return (
    <ul className="ms-int-list">
      {withText.flatMap((mass) =>
        (mass.intentions ?? []).map((one) => (
          <li key={`${mass.startsUtc}-${one.ordinal}`}>
            <span className="ms-int-text">{one.text}</span>
            <span className="ms-int-when">
              {rcDayLabel(mass.startsUtc)} {rcHour(mass.startsUtc)}
              {one.kind === 'collective' && <em> · zbiorowa</em>}
            </span>
          </li>
        )))}
    </ul>
  );
}

/* -- Jedna msza ------------------------------------------------------------ */

function Mass({ mass, withIntentions }: { mass: RcPublicMass; withIntentions: boolean }) {
  const intentions = mass.intentions ?? [];

  return (
    <li className="ms-mass">
      <div className="ms-mass-head">
        <strong>{rcHour(mass.startsUtc)}</strong>

        {/*
          Koniec stoi obok początku, bo msza zajmuje kościół — a kto planuje po
          niej chrzest albo próbę chóru, potrzebuje wiedzieć, do której.
        */}
        <span className="ms-till">do {rcHour(mass.endsUtc)}</span>

        {(mass.title ?? '') !== '' && <span className="ms-title">{mass.title}</span>}
      </div>

      {withIntentions && intentions.length > 0 && (
        <ul className="ms-ints">
          {intentions.map((one) => (
            <li key={one.ordinal}>
              {one.text}
              {one.kind === 'collective' && <em> · zbiorowa</em>}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default RcMassWidget;
