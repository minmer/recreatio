/**
 * Die Bausteine des Messplans, die jede Ansicht teilt — der Blick auf jetzt
 * (`MassGlance`) und das Blättern (`MassBrowser`): ein Tag, eine Messe, ihre
 * Intentionen, die Uhr und das Holen.
 *
 * Eine Messe sieht in jeder Ansicht gleich aus. Stünde sie zweimal da, sähe
 * sie irgendwann zweimal verschieden aus — und wer beim Blättern eine andere
 * Zeile liest als im Blick auf heute, traut keiner von beiden.
 */

import { useEffect, useState } from 'react';

import { keyOf } from './dayMath';
import {
  byDay, CONFESSION, dayKey, fullDayLabel, hour, loadPlan, type PublicMass
} from './mass';
import { isAhead, soon, type MassView } from './massShape';

/* -- Die Uhr ------------------------------------------------------------------ */

/**
 * DIE UHR — alle halbe Minute, und sobald die Karte wieder sichtbar wird.
 * Ohne sie stünde um 18:05 noch „za 5 min" da, und nach Mitternacht der
 * gestrige Tag als „dziś".
 */
export function useNow(): Date {
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

/* -- Das Holen ------------------------------------------------------------------ */

/*
 * EIN ZWISCHENSPEICHER FÜR DIE GANZE SEITE. Acht Messplan-Kacheln auf einer
 * Seite fragen oft dasselbe, und wer beim Blättern eine Woche zurückgeht,
 * soll sie nicht noch einmal laden. Fünf Minuten: Messen ändern sich selten,
 * und wer neu lädt, bekommt ohnehin frisch.
 */
const KEEP_MS = 5 * 60_000;
const kept = new Map<string, { at: number; value: Promise<readonly PublicMass[]> }>();

function fetchPlan(calendar: string, from: Date, to: Date): Promise<readonly PublicMass[]> {
  const key = `${calendar}|${from.toISOString()}|${to.toISOString()}`;
  const hit = kept.get(key);
  if (hit !== undefined && Date.now() - hit.at < KEEP_MS) return hit.value;

  const value = loadPlan(calendar === '' ? undefined : calendar, from, to).then((found) => found.masses);
  kept.set(key, { at: Date.now(), value });
  value.catch(() => kept.delete(key));
  return value;
}

export interface Loaded {
  /** Was angefragt war — der Aufrufer liest daraus, WELCHE Ansicht diese Daten zeichnen. */
  readonly tag: string;
  readonly from: Date;
  readonly to: Date;
  readonly masses: readonly PublicMass[];
}

/**
 * Der Plan für eine Spanne.
 *
 * <b>Das Alte bleibt stehen, bis das Neue da ist</b> — und es trägt sein
 * eigenes `tag`. Wer eine Woche weiterblättert, sieht so nicht für einen
 * Augenblick sieben leere Tage („brak mszy"), sondern die alte Woche, blass,
 * bis die neue kommt.
 */
export function usePlan(calendar: string, from: Date, to: Date, tag: string, enabled = true): {
  loaded: Loaded | null;
  failed: boolean;
  loading: boolean;
} {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const [state, setState] = useState<{ loaded: Loaded | null; failed: boolean }>({ loaded: null, failed: false });

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    const start = new Date(fromMs);
    const end = new Date(toMs);

    fetchPlan(calendar, start, end)
      .then((masses) => { if (alive) setState({ loaded: { tag, from: start, to: end, masses }, failed: false }); })
      .catch(() => { if (alive) setState((was) => ({ loaded: was.loaded, failed: true })); });

    return () => { alive = false; };
  }, [calendar, fromMs, toMs, tag, enabled]);

  const current = state.loaded !== null && state.loaded.tag === tag
    && state.loaded.from.getTime() === fromMs && state.loaded.to.getTime() === toMs;

  return { loaded: state.loaded, failed: state.failed, loading: !current };
}

/* -- Was jede Ansicht wissen muss --------------------------------------------- */

export interface Ctx {
  readonly now: Date;

  /** Die nächste Messe von jetzt an — hervorgehoben, wo sie steht; `null`, wo „jetzt" nicht gilt. */
  readonly next: PublicMass | null;

  /** Im Sammelplan aus mehreren Kalendern gehört das WO dazu. */
  readonly place: boolean;
  readonly shown: MassView;

  /** Was heute schon war, zugeklappt — nur im Blick auf jetzt, nicht beim Blättern. */
  readonly fold: boolean;
}

/**
 * DAS WO nur, wenn es etwas unterscheidet: im Sammelplan aus mehreren
 * Kalendern. Kommt alles aus einem, stünde unter jeder Uhrzeit derselbe Name.
 */
export const placeOf = (calendar: string, masses: readonly PublicMass[]): boolean =>
  calendar === '' && new Set(masses.map((m) => m.calendarId)).size > 1;

export const same = (a: PublicMass, b: PublicMass | null) =>
  b !== null && a.itemId === b.itemId && a.occurrenceAt === b.occurrenceAt;

export const massKey = (m: PublicMass) => `${m.itemId}-${m.occurrenceAt}`;

/** Ein Tag des Plans — auch ein leerer, wenn eine Woche ihn verlangt. */
export interface Day {
  readonly key: string;
  readonly date: Date;
  readonly masses: readonly PublicMass[];
}

/** Die Tage, an denen etwas ist, in der Reihenfolge, in der sie kommen. */
export const daysWith = (services: readonly PublicMass[]): Day[] =>
  byDay(services).map((one) => ({ key: one.day, date: new Date(one.masses[0].startsAt), masses: one.masses }));

/** Jeder Tag einer Spanne, auch die leeren — für die Woche und das Monatsblatt. */
export function everyDay(services: readonly PublicMass[], dates: readonly Date[]): Day[] {
  const found = new Map(daysWith(services).map((one) => [one.key, one]));
  return dates.map((date) => found.get(keyOf(date)) ?? { key: keyOf(date), date, masses: [] });
}

export const onlyMasses = (day: Day): readonly PublicMass[] => day.masses.filter((m) => m.kind !== CONFESSION);

/* -- Uhrzeiten nebeneinander ------------------------------------------------------- */

export function Times({ masses, ctx }: { masses: readonly PublicMass[]; ctx: Ctx }) {
  return (
    <>
      {masses.map((m, i) => (
        <span key={massKey(m)}>
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

/* -- Ein Tag -------------------------------------------------------------------------- */

/**
 * EIN TAG. Im Blick auf jetzt ist, was heute schon war, zugeklappt
 * („Wcześniej: 7:00") — da, aber nicht im Weg; beim Blättern steht alles da,
 * das Vergangene blass. Die nächste Messe ist hervorgehoben und sagt, wann.
 *
 * `onOpen`: die Überschrift führt zu diesem Tag in der Tagesansicht.
 */
export function DayBlock({ ctx, day, onOpen }: { ctx: Ctx; day: Day; onOpen?: (date: Date) => void }) {
  const past = ctx.fold ? day.masses.filter((m) => m.status !== 'cancelled' && new Date(m.endsAt) <= ctx.now) : [];
  const ahead = day.masses.filter((m) => !past.includes(m));
  const today = day.key === dayKey(ctx.now.toISOString());
  const name = fullDayLabel(day.date.toISOString(), ctx.now);

  return (
    <section className={`wk-mass-day${today ? ' is-today' : ''}`}>
      <h3 className="wk-mass-day-name">
        {onOpen === undefined ? name : (
          <button type="button" className="wk-mass-day-open" onClick={() => onOpen(day.date)}>{name}</button>
        )}
      </h3>

      {past.length > 0 && (
        <details className="wk-mass-past">
          <summary>
            Wcześniej: {past.filter((m) => m.kind !== CONFESSION).map((m) => hour(m.startsAt)).join(' · ')
              || past.map((m) => hour(m.startsAt)).join(' · ')}
          </summary>
          {past.map((m) => <Row key={massKey(m)} ctx={ctx} mass={m} />)}
        </details>
      )}

      {day.masses.length === 0 && <p className="wk-mass-none">Brak mszy.</p>}
      {ahead.map((m) => <Row key={massKey(m)} ctx={ctx} mass={m} />)}
    </section>
  );
}

/** Eine Messe (oder Beichte) in einem Tag: Uhrzeit links, alles andere daneben. */
export function Row({ ctx, mass }: { ctx: Ctx; mass: PublicMass }) {
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
export function Intentions({ mass }: { mass: PublicMass }) {
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
