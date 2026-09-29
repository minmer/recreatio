/**
 * DIE GROSSE MESSPLAN-KACHEL — mit allem, was man zum Nachsehen braucht.
 *
 * Wer wissen will, wann am Donnerstag in zwei Wochen Messe ist, oder welche
 * Intention letzten Sonntag gelesen wurde, soll dafür nicht die Seite
 * verlassen müssen. Die grossen Grössen (`massShape.ts`, `browse`) blättern:
 *
 * <code>
 *   step   ‹ Dziś ›  und „Kalendarz" — dieselbe Form ab einem anderen Tag
 *   full   dazu die Ansichten Najbliższe · Dzień · Tydzień (· Miesiąc); ist
 *          die Kachel breit genug, steht das Monatsblatt daneben, mit der
 *          nächsten Messe darunter, statt hinter einem Knopf
 * </code>
 *
 * <b>Der Platz entscheidet, nicht der Bildschirm.</b> Ob die Seitenleiste
 * passt, fragt die Kachel ihre eigene Breite (Container-Abfrage in
 * `app.css`) — dieselbe Kachel ist am Schreibtisch breit und auf dem Tablet
 * schmal, und in beiden Fällen soll sie das Beste daraus machen.
 *
 * <b>Die Uhr gilt weiter.</b> Die nächste Messe ist auch beim Blättern
 * hervorgehoben, wo sie steht, und „Dziś" führt zurück zu jetzt.
 */

import { useState, type CSSProperties } from 'react';

import {
  addDays, firstOfMonth, fromKey, keyOf, longDate, mondayOf, monthTitle, rangeTitle, sameDay, sameMonth,
  startOfDay, WEEK_HEADS
} from './dayMath';
import { dayKey, hour, massesOnly, type PublicMass } from './mass';
import { MODE_WORD, nextOf, rangeOf, stepAnchor, type MassMode, type MassView } from './massShape';
import { Glance, NextBox } from './MassGlance';
import { DayBlock, everyDay, placeOf, Row, usePlan, type Ctx } from './MassParts';
import { MonthPicker } from './MonthPicker';

export function MassBrowser({ shown, calendar, now }: { shown: MassView; calendar: string; now: Date }) {
  const [mode, setMode] = useState<MassMode>(shown.modes[0] ?? 'soon');

  /** Der gewählte Tag — `null`: heute, und in „Najbliższe" wirklich JETZT. */
  const [anchor, setAnchor] = useState<Date | null>(null);
  const [picking, setPicking] = useState(false);

  const full = shown.browse === 'full';
  const today = startOfDay(now);
  const selected = anchor ?? today;
  const { from, to } = rangeOf(mode, anchor, shown, now);

  /* Was angefragt ist, steht im `tag` — gezeichnet wird, was die DATEN sagen (s. `usePlan`). */
  const { loaded, failed, loading } = usePlan(calendar, from, to, `${mode}|${anchor === null ? '' : keyOf(anchor)}`);

  /* Die nächste Messe von JETZT an — für die Seitenleiste, und damit sie beim Blättern hervorgehoben bleibt. */
  const live = usePlan(calendar, today, addDays(today, 3), 'live', full);
  const next = live.loaded === null ? null : nextOf(massesOnly(live.loaded.masses), now);

  /** „Najbliższe" ab heute ist JETZT — dann gilt wieder die Uhr. */
  const settle = (target: MassMode, at: Date | null) => (target === 'soon' && at !== null && sameDay(at, now) ? null : at);

  const pick = (day: Date) => {
    /* Ein Tag aus dem Kalender: in der grossen Kachel dieser Tag; in Woche und Tag bleibt die Ansicht. */
    const target: MassMode = full && (mode === 'soon' || mode === 'month') ? 'day' : mode;
    setMode(target);
    setAnchor(settle(target, startOfDay(day)));
    setPicking(false);
  };

  const open = full ? (day: Date) => { setMode('day'); setAnchor(startOfDay(day)); } : undefined;
  const step = (direction: 1 | -1) => setAnchor(settle(mode, stepAnchor(mode, anchor, shown, now, direction)));

  const label = mode === 'soon'
    ? (anchor === null ? 'Od teraz' : rangeTitle(from, to))
    : mode === 'day' ? `${sameDay(selected, now) ? 'Dziś · ' : ''}${longDate(selected)}`
    : mode === 'week' ? rangeTitle(from, to)
    : monthTitle(selected);

  /* Das Monatsblatt beginnt beim gewählten Monat — und springt mit, wenn die Wahl den Monat wechselt. */
  const picker = (
    <MonthPicker
      key={keyOf(firstOfMonth(selected))}
      value={mode === 'soon' && anchor === null ? null : selected}
      week={mode === 'week'}
      today={today}
      onPick={pick}
    />
  );

  return (
    <div className="wk-mass-app" data-browse={shown.browse}>
      <div className="wk-mass-layout">
        {full && (
          <aside className="wk-mass-side" aria-label="Kalendarz">
            {picker}

            {/*
              Die nächste Messe steht hier nur, wenn man woanders ist — ab jetzt
              ist sie ohnehin rechts hervorgehoben, und doppelt nähme sie der
              Kachel bloss Höhe.
            */}
            {next !== null && (mode !== 'soon' || anchor !== null) && (
              <NextBox
                ctx={{ now, next, place: placeOf(calendar, live.loaded?.masses ?? []), shown, fold: false }}
                next={next}
                label="Najbliższa msza"
              />
            )}
          </aside>
        )}

        <div className="wk-mass-main">
          <div className="wk-mass-bar">
            <div className="wk-mass-nav">
              <button type="button" className="wk-mass-step" aria-label="Wcześniej" onClick={() => step(-1)}>‹</button>
              <button type="button" className="wk-mass-today" aria-pressed={anchor === null} onClick={() => setAnchor(null)}>
                Dziś
              </button>
              <button type="button" className="wk-mass-step" aria-label="Później" onClick={() => step(1)}>›</button>
            </div>

            <p className="wk-mass-range" aria-live="polite">
              {label}
              {loading && !failed && <span className="wk-mass-loading"> · wczytywanie…</span>}
            </p>

            {shown.modes.length > 1 && (
              <div className="wk-seg wk-mass-modes" role="group" aria-label="Widok">
                {shown.modes.map((one) => (
                  <button
                    key={one}
                    type="button"
                    aria-pressed={one === mode}
                    className={one === mode ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'}
                    onClick={() => { setMode(one); setAnchor(settle(one, anchor)); }}
                  >
                    {MODE_WORD[one]}
                  </button>
                ))}
              </div>
            )}

            <button type="button" className="wk-mass-pickbtn" aria-expanded={picking} onClick={() => setPicking(!picking)}>
              <CalendarIcon /> Kalendarz
            </button>
          </div>

          {picking && <div className="wk-mass-pop">{picker}</div>}

          <div className={`wk-mass-body${loading ? ' is-loading' : ''}`}>
            {loaded === null
              ? <p className="wk-card-muted">{failed ? 'Planu nie udało się wczytać.' : 'Wczytywanie…'}</p>
              : <Drawn tag={loaded.tag} from={loaded.from} services={loaded.masses} shown={shown} now={now}
                  next={next} calendar={calendar} onOpen={open} onPickDay={pick} />}
          </div>

          {failed && loaded !== null && <p className="wk-card-muted">Nie udało się wczytać tych dni — widać poprzednie.</p>}
        </div>
      </div>
    </div>
  );
}

/**
 * Was die geholten Daten zeigen — in der Ansicht, für die sie geholt wurden
 * (`tag`), nicht in der, die gerade gewählt ist. Beides ist eine Weile
 * verschieden: zwischen dem Klick und der Antwort.
 */
function Drawn({ tag, from, services, shown, now, next, calendar, onOpen, onPickDay }: {
  tag: string;
  from: Date;
  services: readonly PublicMass[];
  shown: MassView;
  now: Date;
  next: PublicMass | null;
  calendar: string;
  onOpen?: (day: Date) => void;
  onPickDay: (day: Date) => void;
}) {
  const [mode, anchorKey] = tag.split('|') as [MassMode, string];
  const anchor = anchorKey === '' ? null : fromKey(anchorKey);
  const place = placeOf(calendar, services);
  const ctx: Ctx = { now, next, place, shown, fold: false };
  const kept = shown.confessions ? services : massesOnly(services);

  switch (mode) {
    case 'soon':
      return <Glance shown={shown} services={services} now={now} anchor={anchor} place={place} calendarSet={calendar !== ''} onOpen={onOpen} />;
    case 'day':
      return <DayView ctx={ctx} date={from} services={kept} onPick={onPickDay} />;
    case 'week':
      return <WeekView ctx={ctx} from={from} services={kept} onOpen={onOpen} />;
    case 'month':
      return <MonthView ctx={ctx} from={from} services={massesOnly(services)} onOpen={onOpen ?? onPickDay} />;
  }
}

/* -- Ein Tag -------------------------------------------------------------------- */

/**
 * EIN TAG, ganz: jede Messe mit ihren Intentionen, und darüber die Woche als
 * Leiste, um zum Nachbartag zu springen, ohne den Kalender zu öffnen. Breit
 * fliessen die Messen in Spalten (`app.css`) statt in einer langen Liste.
 */
function DayView({ ctx, date, services, onPick }: {
  ctx: Ctx;
  date: Date;
  services: readonly PublicMass[];
  onPick: (day: Date) => void;
}) {
  const monday = mondayOf(date);
  const list = services.filter((m) => dayKey(m.startsAt) === keyOf(date));

  return (
    <>
      <div className="wk-mass-weekstrip" role="group" aria-label="Dni tygodnia">
        {WEEK_HEADS.map((head, i) => {
          const day = addDays(monday, i);
          const cls = ['wk-mass-chip', sameDay(day, date) && 'is-on', sameDay(day, ctx.now) && 'is-today'].filter(Boolean).join(' ');
          return (
            <button key={head} type="button" className={cls} aria-pressed={sameDay(day, date)}
              aria-label={longDate(day)} onClick={() => onPick(day)}>
              <span className="wk-mass-chip-dow">{head}</span>
              <span className="wk-mass-chip-date">{day.getDate()}</span>
            </button>
          );
        })}
      </div>

      {list.length === 0
        ? <p className="wk-mass-none">Brak mszy w tym dniu.</p>
        : <div className="wk-mass-dayview">{list.map((m) => <Row key={`${m.itemId}-${m.occurrenceAt}`} ctx={ctx} mass={m} />)}</div>}
    </>
  );
}

/* -- Eine Woche -------------------------------------------------------------------- */

/**
 * MONTAG BIS SONNTAG, jeder Tag mit seinen Intentionen — auch ein Tag ohne
 * Messe steht da („Brak mszy"): eine Woche mit Lücke sähe aus, als fehlte ein
 * Tag. So viele Spalten, wie lesbar breit sind (`--mass-cols` ist die Obergrenze).
 */
function WeekView({ ctx, from, services, onOpen }: {
  ctx: Ctx;
  from: Date;
  services: readonly PublicMass[];
  onOpen?: (day: Date) => void;
}) {
  const days = everyDay(services, Array.from({ length: 7 }, (_, i) => addDays(from, i)));

  return (
    <div className="wk-mass-cols wk-mass-week" style={{ '--mass-cols': 4 } as CSSProperties}>
      {days.map((one) => <DayBlock key={one.key} ctx={ctx} day={one} onOpen={onOpen} />)}
    </div>
  );
}

/* -- Ein Monat -------------------------------------------------------------------- */

const masses = (n: number) =>
  n === 1 ? '1 msza' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? `${n} msze` : `${n} mszy`;

/**
 * DAS MONATSBLATT: in jedem Tag die Uhrzeiten, ohne Intentionen — für den
 * Überblick; ein Tag darin führt zu diesem Tag. Ist die Kachel schmal, steht
 * statt der Uhrzeiten nur, wie viele Messen es sind (`app.css`).
 */
function MonthView({ ctx, from, services, onOpen }: {
  ctx: Ctx;
  from: Date;
  services: readonly PublicMass[];
  onOpen: (day: Date) => void;
}) {
  const month = firstOfMonth(addDays(from, 6));
  const days = everyDay(services, Array.from({ length: 42 }, (_, i) => addDays(from, i)));

  return (
    <div className="wk-mass-month">
      {WEEK_HEADS.map((head) => <span key={head} className="wk-mass-month-dow" aria-hidden="true">{head}</span>)}

      {days.map((one) => {
        const cls = ['wk-mass-cell',
          !sameMonth(one.date, month) && 'is-out',
          sameDay(one.date, ctx.now) && 'is-today',
          one.masses.length === 0 && 'is-empty']
          .filter(Boolean).join(' ');

        return (
          <button key={one.key} type="button" className={cls}
            aria-label={`${longDate(one.date)}: ${one.masses.length === 0 ? 'brak mszy' : masses(one.masses.length)}`}
            onClick={() => onOpen(one.date)}>
            <span className="wk-mass-cell-date">{one.date.getDate()}</span>
            {one.masses.length > 0 && (
              <>
                <span className="wk-mass-cell-times">
                  {one.masses.map((m) => (
                    <span key={`${m.itemId}-${m.occurrenceAt}`} className={m.status === 'cancelled' ? 'is-cancelled' : undefined}>
                      {hour(m.startsAt)}
                    </span>
                  ))}
                </span>
                <span className="wk-mass-cell-count">{one.masses.length}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Ein kleines Kalenderblatt — kein Emoji: das sähe auf jedem Gerät anders aus. */
function CalendarIcon() {
  return (
    <svg className="wk-mass-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <rect x="1.5" y="2.5" width="13" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 6h13M5 1v3M11 1v3" stroke="currentColor" strokeWidth="1.3" fill="none" />
    </svg>
  );
}

export default MassBrowser;
