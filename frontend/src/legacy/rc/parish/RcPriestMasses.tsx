/**
 * Widok kapłana: co mam odprawić.
 *
 * <b>To inne pytanie niż kancelarii.</b> Kancelaria pyta „co jest w czwartek" —
 * całe dni, wszystkie msze, kto co złożył. Kapłan pyta „co odprawiam" i pyta o
 * to rano, często na telefonie. Ten sam materiał, inne pierwsze zdanie: data i
 * godzina z przodu, intencja obok, ofiarodawca nigdzie.
 *
 * <b>Ofiarodawcy tu nie ma i nie ma go przez pomyłkę.</b> Kapłan czyta
 * intencję, nie księgowość. Kto ile złożył, jest sprawą kancelarii — a rzecz,
 * której się nie pokazuje, nie może zostać pokazana komuś przez ramię.
 *
 * <b>Zbiorowa jest oznaczona.</b> To nie ozdoba: przy zbiorowej jeden kapłan
 * czyta kilka intencji razem, przy pojedynczych każdy ma swoją. Kapłan, który
 * tego nie widzi, nie wie, czy ktoś jeszcze jest potrzebny.
 */

import { useEffect, useState } from 'react';

import {
  rcByDay, rcDayLabel, rcHour, rcPublicMasses,
  type RcPublicMass
} from './rcMass';

export function RcPriestMasses({ slug, days = 7 }: { slug: string; days?: number }) {
  const [masses, setMasses] = useState<readonly RcPublicMass[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const from = new Date();
        const to = new Date(from);
        to.setDate(to.getDate() + days);

        const found = await rcPublicMasses(slug, from, to);
        if (!alive) return;
        setMasses((found.masses ?? []).filter((m) => m.status !== 'cancelled'));
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [slug, days]);

  if (failed) return <p className="ps-muted">Nie udało się wczytać planu.</p>;
  if (masses === null) return <p className="ps-muted">Wczytywanie…</p>;
  if (masses.length === 0) return <p className="ps-muted">W najbliższych dniach nie ma mszy w planie.</p>;

  return (
    <div className="pr-plan">
      {rcByDay(masses).map((group) => (
        <section key={group.day} className="pr-day">
          <h3 className="pr-when">{rcDayLabel(group.masses[0].startsUtc)}</h3>

          <ul className="pr-list">
            {group.masses.map((mass) => {
              const intentions = mass.intentions ?? [];
              const collective = intentions.filter((i) => i.kind === 'collective');
              const singles = intentions.filter((i) => i.kind === 'single');

              return (
                <li key={mass.startsUtc} className="pr-mass">
                  <div className="pr-time">
                    <strong>{rcHour(mass.startsUtc)}</strong>
                    <span className="ms-till">do {rcHour(mass.endsUtc)}</span>
                  </div>

                  <div className="pr-what">
                    {(mass.title ?? '') !== '' && <p className="ms-title">{mass.title}</p>}

                    {intentions.length === 0 && (
                      <p className="ps-muted">Bez intencji.</p>
                    )}

                    {/*
                      Pojedyncze — każda ze swoim kapłanem. Kiedy jest ich
                      więcej niż jedna, stoi to wprost: inaczej kapłan
                      dowiaduje się w zakrystii, że miał być drugi.
                    */}
                    {singles.length > 0 && (
                      <>
                        <ul className="pr-ints">
                          {singles.map((one) => <li key={one.ordinal}>{one.text}</li>)}
                        </ul>
                        {singles.length > 1 && (
                          <p className="pr-need">
                            {singles.length} pojedyncze — tylu kapłanów, każdy ze swoją.
                          </p>
                        )}
                      </>
                    )}

                    {collective.length > 0 && (
                      <>
                        <p className="pr-kind">Zbiorowa — czytane razem:</p>
                        <ul className="pr-ints">
                          {collective.map((one) => <li key={one.ordinal}>{one.text}</li>)}
                        </ul>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default RcPriestMasses;
