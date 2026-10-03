/**
 * Die Kanzlei: Messen, Beichte und Nabożeństwa planen und ändern, Intentionen
 * eintippen und pflegen, den Bogen drucken.
 *
 * <b>Sie hängt am KALENDER, nicht an der Adresse.</b> Eine Messe ist ein
 * Kalendereintrag mit `kind: 'mass'`; welcher Kalender in Frage kommt, sagt
 * `loadCalendars` — und die Liste IST die Berechtigung: dort steht nur, worauf
 * man ein Zertifikat auf den Bereich hat. Wer nichts sieht, darf nichts.
 *
 * <b>0079 — alles lässt sich ändern.</b> Vorher liess sich hier eine Messe
 * anlegen und nie wieder anfassen (der Kalender verwies hierher, und hier gab
 * es kein Ändern), und an einer Intention nur der Text. Jetzt:
 *
 * <code>
 *   Plan        jedes Vorkommen: ändern (der Termin-Dialog des Kalenders — mit
 *               „ten i następne"), absagen, zurückholen, im Kalender zeigen
 *   Intencje    Text, Art, Stand (odprawiona), Reihenfolge, wer sie liest,
 *               Geber und Gabe (versiegelt), an eine andere Messe verlegen, löschen
 * </code>
 *
 * Die Intentionen gehen mit, wenn eine Messe sich ändert — der Dienst ordnet
 * sie dem Tag zu und sagt es, wenn einer die Messe fehlen würde.
 *
 * <b>Warum ein eigener Eingabemodus.</b> Intentionen kommen in Reihen: die
 * Kanzlei hat einen Zettel mit zwanzig und tippt sie hintereinander ab. Bei
 * einem Formular, bei dem man nach jeder zur Maus greifen muss, sind zwanzig
 * Intentionen zwanzig Griffe — und dann macht es niemand im System, sondern
 * weiter auf dem Zettel.
 *
 * <b>Deshalb führt die Tastatur:</b>
 *
 * <code>
 *   Enter        — speichern und weiter bei DERSELBEN Messe
 *   Strg+Enter   — speichern und zur NÄCHSTEN Messe — nach der letzten des
 *                  Tages zur ersten des nächsten
 *   Escape       — das Getippte verwerfen
 * </code>
 *
 * <b>Deshalb werden zwei Wochen geladen und nicht ein Tag.</b> Ein Stapel
 * Zettel endet nicht mit dem Tag. An der Tagesgrenze stehenzubleiben sähe aus,
 * als wäre der Plan zu Ende — und hiesse: greif zur Maus.
 *
 * <b>Gespeichert wird sofort, nicht „am Schluss".</b> Ein Formular, das zwanzig
 * Intentionen sammelt und zusammen schickt, verliert alle, wenn bei der
 * achtzehnten die Verbindung abreisst.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { kindWord, loadAgenda, openAgenda, restoreOne } from './agenda';
import {
  addItem, loadCalendars, REPEAT_LABEL, setPeople, type CalendarRow, type Duty, type ItemKind, type RepeatKind
} from './calendar';
import { NO_BOOKINGS, sameInstant } from './calendarBookings';
import { buildEvents, type CalEvent } from './calendarModel';
import { areaKeys, newestKey } from './chat';
import { aad, Field, fromBase64Url, openText, sealText, toBase64Url } from './crypto';
import { EventDialog } from './EventDialog';
import {
  addIntention, CONFESSION, DEVOTION, DEVOTION_NAMES, deleteIntention, INTENTION_STATUS_LABEL, intentionsWord,
  isMass, KIND_LABEL, MASS, SERVICE_LABEL, WEEKDAY_BITS,
  dayKey, dayLabel, firstOnOrAfter, hour, loadOffice, loadPlan, positionInDay,
  updateIntention, type IntentionKind, type OfficeIntention, type OfficeMass
} from './mass';
import { createCalendar, loadCalendars as loadAllCalendars, setOccurrence } from './calendar';
import { loadAreas, type AreaRow } from './area';
import { useMe, type Me } from './me';
import { useAreaPeople, type Candidate } from './PeoplePicker';
import { printIntentions, sheetWeek } from './sheet';
import {
  loadClaims, loadResources, officeAdd, officeClose, officeRemove, updateResource,
  type OfficeClaim, type ResourceRow
} from './resource';
import { loadSeats } from './seat';
import { loadRoles, selfOf } from './roles';
import { viewPath } from './routes';
import { WorkspaceError, type Who } from './session';
import { AreaOptions } from './AreaOptions';
import { useRecent } from './prefs';

/**
 * Wie weit vorausgeladen wird — zwei Wochen, nicht ein Tag.
 *
 * Wer eintippt, arbeitet weiter voraus als wer liest.
 */
const WINDOW_DAYS = 14;

const todayKey = (): string => dayKey(new Date().toISOString());

/** Der Schlüssel eines Vorkommens: dieselbe Messe kann in zwei Kalendern liegen. */
const keyOf = (mass: OfficeMass): string => `${mass.itemId}-${mass.occurrenceAt}`;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

type OfficeTab = 'intentions' | 'plan' | 'new' | 'terms' | 'print';

/* Welcher Reiter zuletzt offen war — solange die Seite lebt. */
let lastTab: OfficeTab = 'intentions';

/**
 * @param trail 0079 — `#/workspace/masses/<kalendarz>/<dzień>/<msza>`: gleich
 *   an dieser Messe aufschlagen (aus dem Kalender: „Otwórz w Msze i intencje").
 */
export function MassOffice({ who, trail = [], heading = false }: {
  who: Who;
  trail?: readonly string[];
  /** Mit eigener Überschrift — im Editor einer Seite; im Arbeitsplatz steht sie schon oben. */
  heading?: boolean;
}) {
  const me = useMe(who);
  const wanted = { calendar: trail[0] ?? '', day: DAY.test(trail[1] ?? '') ? trail[1]! : '', item: trail[2] ?? '' };

  /*
   * 0054 — WELCHER TERMINARZ ZULETZT: nach dem Neuladen steht der, an dem man
   * gerade arbeitete, und nicht der alphabetisch erste. Gemerkt versiegelt.
   */
  const recent = useRecent('masses.calendar');
  const [calendars, setCalendars] = useState<readonly CalendarRow[] | null>(null);

  /* Für das Anlegen: ein Kalender gehört in einen Bereich, und welche das sein
     können, weiss nur diese Liste. */
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  const [chosen, setChosen] = useState<string>('');
  const [from, setFrom] = useState(() => wanted.day !== '' ? wanted.day : todayKey());
  const [services, setServices] = useState<readonly OfficeMass[]>([]);
  const [at, setAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [tab, pickTab] = useState<OfficeTab>(() => (wanted.item !== '' ? 'intentions' : lastTab));
  const setTab = (next: OfficeTab) => { lastTab = next; pickTab(next); };

  /* Der Termin-Dialog des Kalenders, wenn eine Messe geändert wird. */
  const [editing, setEditing] = useState<CalEvent | null>(null);
  const [allCalendars, setAllCalendars] = useState<readonly CalendarRow[]>([]);

  /* Einmal zur Messe aus der Adresse gesprungen — danach bewegt man sich selbst. */
  const jumped = useRef(false);

  useEffect(() => {
    loadCalendars()
      .then((found) => {
        setAllCalendars(found.calendars);
        setCalendars(found.calendars.filter((c) => c.archived !== true));
      })
      .catch(() => setCalendars([]));

    loadAreas().then((found) => setAreas(found.areas)).catch(() => setAreas([]));
  }, []);

  /*
   * Nur MESSEN führt die Eingabe — die Beichte und das Nabożeństwo haben keine
   * Intentionen, und eine abgesagte Messe nimmt keine an. Bei Strg+Enter geriete
   * man sonst ungewollt hinein.
   */
  const masses = services.filter((m) => isMass(m) && m.status !== 'cancelled');

  const load = useCallback(async () => {
    if (chosen === '') { setServices([]); return; }

    try {
      const start = new Date(`${from}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + WINDOW_DAYS);

      const found = await loadOffice(chosen, start, end);
      setServices(found.masses);
      const list = found.masses.filter((m) => isMass(m) && m.status !== 'cancelled');

      /* Aus dem Kalender gekommen: genau diese Messe. */
      if (!jumped.current && wanted.item !== '') {
        jumped.current = true;
        const found2 = list.findIndex((m) => m.itemId === wanted.item && dayKey(m.startsAt) === wanted.day);
        if (found2 >= 0) { setAt(found2); return; }
      }
      setAt((current) => Math.min(current, Math.max(0, list.length - 1)));
    } catch (e) {
      setServices([]);
      setError(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać planu.');
    }
  }, [chosen, from]);

  useEffect(() => { void load(); }, [load]);

  /*
   * Eine Handlung, die danach neu lädt — dieselbe Form wie anderswo. Ohne sie
   * stünde ein neuer Kalender erst beim nächsten Aufruf in der Auswahl.
   */
  const act = async (what: string, todo: () => Promise<unknown>) => {
    setError(null);
    setDone(null);

    try {
      await todo();
      const found = await loadAllCalendars();
      setAllCalendars(found.calendars);
      setCalendars(found.calendars.filter((c) => c.archived !== true));
      await load();
    } catch (e) {
      setError(e instanceof WorkspaceError ? e.message : `Nie udało się: ${what}`);
    }
  };

  useEffect(() => {
    if (chosen !== '' || calendars === null || calendars.length === 0 || !recent.ready) return;
    const fromAddress = calendars.find((c) => c.calendarId === wanted.calendar);
    const last = recent.last(calendars, (c) => c.calendarId);
    setChosen((fromAddress ?? last ?? calendars[0]).calendarId);
  }, [calendars, chosen, recent]);

  /**
   * DIESE MESSE ÄNDERN — im Termin-Dialog des Kalenders, mit allem, was er
   * kann (Zeit, Wiederholung, „ten i następne", wer feiert, absagen). Er
   * braucht den Eintrag, wie der Kalender ihn kennt: aus der Agenda, geöffnet.
   */
  const edit = async (one: OfficeMass) => {
    setError(null);
    if (me == null) {
      setError('Bez kluczy w tej karcie nie da się zmieniać wpisów — zaloguj się ponownie.');
      return;
    }

    try {
      const start = new Date(one.startsAt);
      const agenda = await loadAgenda(new Date(start.getTime() - 60_000), new Date(start.getTime() + 60_000));
      const opened = await openAgenda(me.ring, agenda.occurrences, areas);
      const event = buildEvents(opened, [], NO_BOOKINGS)
        .find((e) => e.item?.occurrence.itemId === one.itemId && sameInstant(e.item.occurrence.occurrenceAt, one.occurrenceAt));

      if (event === undefined) {
        setError('Tego wpisu nie ma w Twoim kalendarzu — nie możesz go zmieniać.');
        return;
      }
      setEditing(event);
    } catch (e) {
      setError(e instanceof WorkspaceError ? e.message : 'Nie udało się otworzyć wpisu.');
    }
  };

  /** Ein Vorkommen absagen — oder zurückholen. */
  const toggleOne = (one: OfficeMass) => {
    const when = `${dayLabel(one.startsAt)} ${hour(one.startsAt)}`;

    if (one.skipped === true) {
      void act('Przywracanie…', async () => {
        await restoreOne(one.itemId, one.occurrenceAt);
        setDone(`Przywrócono: ${SERVICE_LABEL[one.kind] ?? 'wpis'} ${when}.`);
      });
      return;
    }

    if (!window.confirm(`Odwołać tylko ten termin: ${SERVICE_LABEL[one.kind] ?? 'wpis'} ${when}? Seria zostaje.`)) return;
    void act('Odwoływanie…', async () => {
      await setOccurrence(one.itemId, one.occurrenceAt, { cancelled: true });
      setDone(`Odwołano: ${SERVICE_LABEL[one.kind] ?? 'wpis'} ${when}. Można to cofnąć — „Przywróć".`);
    });
  };

  const calendar = (calendars ?? []).find((c) => c.calendarId === chosen);
  const mass = masses[at];

  /*
   * WER IN DER GRUPPE IST — einmal je Kalender: für „kto odprawia" an jeder
   * Zeile des Plans und für die Auswahl an jeder Intention. Ohne Schlüssel in
   * diesem Tab bleibt es bei „osoba" und ohne Auswahl.
   */
  const candidates = usePeople(me ?? null, calendar?.areaId ?? null);
  const names = new Map<string, string>([...(me?.names ?? new Map<string, string>()), ...(candidates ?? []).map((c): [string, string] => [c.roleId, c.name])]);

  /*
   * Das Datumsfeld zeigt den Tag der GERADE bearbeiteten Messe, nicht den
   * Anfang des Fensters. Sonst stünde dort noch Sonntag, während man längst den
   * Montag einträgt — und man trüge in dem Glauben ein, es sei noch Sonntag.
   */
  const shownDay = tab === 'intentions' && mass !== undefined ? dayKey(mass.startsAt) : from;

  const goToDay = (day: string) => {
    if (day === '') return;
    if (tab === 'intentions') {
      const found = firstOnOrAfter(masses, day);
      if (found >= 0) { setAt(found); return; }
    }

    // Ausserhalb des Fensters (oder im Plan): neu laden und vorn anfangen.
    setFrom(day);
    setAt(0);
  };

  /* Aus dem Plan zu einer Messe: die Eingabe ihrer Intentionen. */
  const toIntentions = (one: OfficeMass) => {
    const index = masses.findIndex((m) => keyOf(m) === keyOf(one));
    if (index >= 0) { setAt(index); setTab('intentions'); }
  };

  if (calendars === null) return <p className="wk-note">Wczytywanie…</p>;

  /*
   * Kein Kalender heisst hier nicht „leer", sondern „kein Zertyfikat auf żaden
   * obszar". Das ist eine Auskunft über Rechte und keine über Messen — also
   * steht sie so da.
   */
  if (calendars.length === 0) {
    return (
      <>
        <p className="wk-note">
          Nie masz jeszcze żadnego terminarza. Terminarz to terminy jednej grupy
          (obszaru) — wybierz grupę, a powstanie sam.
        </p>
        <NewCalendar areas={areas} busy={false} onAct={act} />
      </>
    );
  }

  return (
    <>
      {heading && <h3 className="wk-h2">Msze, nabożeństwa i intencje</h3>}

      <div className="wk-mo-top">
        <label className="wk-field">
          <span>Terminarz grupy</span>
          <select value={chosen} onChange={(e) => { setChosen(e.target.value); recent.touch(e.target.value); setAt(0); }}>
            {recent.order(calendars, (c) => c.calendarId).map((c) => (
              <option key={c.calendarId} value={c.calendarId}>
                {c.areaName}{c.title !== c.areaName ? ` (${c.title})` : ''}
              </option>
            ))}
          </select>
        </label>

        <NewCalendar areas={areas} busy={false} onAct={act} />

        <label className="wk-field">
          <span>Dzień</span>
          <input type="date" value={shownDay} onChange={(e) => goToDay(e.target.value)} />
        </label>

        {tab === 'intentions' && masses.length > 0 && (
          <label className="wk-field">
            <span>Msza</span>
            {/* Alle Messen des Fensters, nicht nur die des Tages — Strg+Enter
                geht ohnehin darüber hinaus, und eine Liste, die dazu nicht
                passt, führt in die Irre. */}
            <select value={at} onChange={(e) => setAt(Number(e.target.value))}>
              {masses.map((m, index) => (
                <option key={keyOf(m)} value={index}>
                  {dayLabel(m.startsAt)} {hour(m.startsAt)}
                  {(m.title ?? '') === '' ? '' : ` — ${m.title}`}
                </option>
              ))}
            </select>
          </label>
        )}

        <a className="wk-link-btn" href={viewPath('calendar', shownDay)}>Ten dzień w kalendarzu</a>
      </div>

      <div className="wk-tabs" role="tablist">
        {([
          ['intentions', 'Intencje'], ['plan', 'Plan i zmiany'], ['new', 'Nowy wpis'], ['terms', 'Terminy do zapisów'], ['print', 'Wydruk']
        ] as const).map(([value, text]) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? 'wk-tab wk-tab-on' : 'wk-tab'}
            onClick={() => setTab(value)}>{text}</button>
        ))}
      </div>

      {error !== null && <p className="wk-error">{error}</p>}
      {done !== null && <p className="wk-done">{done}</p>}

      {tab === 'intentions' && (
        <>
          {masses.length === 0 && (
            <p className="wk-note">
              Przez najbliższe dwa tygodnie od tego dnia nie ma żadnej mszy w planie.
              Załóż ją w „Nowy wpis" — jeden wpis powtarzający się wystarcza na cały okres.
            </p>
          )}

          {mass !== undefined && (
            <MassEntry
              key={keyOf(mass)}
              me={me ?? null}
              mass={mass}
              masses={masses}
              candidates={candidates}
              names={names}
              position={label(masses, at)}
              /* „Weiter" endet am Rand des FENSTERS, nicht des Tages. */
              hasNext={at + 1 < masses.length}
              onNextMass={() => setAt((n) => Math.min(n + 1, masses.length - 1))}
              onEdit={() => void edit(mass)}
              onChanged={() => void load()}
              onError={setError}
            />
          )}

          <p className="wk-mo-keys">
            <kbd>Enter</kbd> zapisuje i zostaje przy tej mszy ·{' '}
            <kbd>Ctrl</kbd>+<kbd>Enter</kbd> zapisuje i przechodzi do następnej —
            także na następny dzień · <kbd>Esc</kbd> czyści pole
          </p>
        </>
      )}

      {tab === 'plan' && (
        <Plan
          services={services}
          names={names}
          onIntentions={toIntentions}
          onEdit={(one) => void edit(one)}
          onToggle={toggleOne}
        />
      )}

      {tab === 'new' && calendar !== undefined && (
        <ServiceForm calendar={calendar} onAdded={(what) => { setDone(what); void load(); }} />
      )}

      {/*
        DIE TERMINE STEHEN IN EINEM EIGENEN REITER: eine Messe trägt Intentionen,
        ein Termin trägt Menschen. Derselbe Kalender, dasselbe Fenster — andere
        Arbeit (siehe `Appointments`).
      */}
      {tab === 'terms' && calendar !== undefined && <Appointments calendar={calendar} from={shownDay} />}

      {tab === 'print' && calendar !== undefined && <PrintSheet calendarId={calendar.calendarId} />}

      {editing !== null && me != null && (
        <EventDialog
          me={me} areas={areas} calendars={allCalendars}
          target={{ at: 'event', event: editing }}
          onClose={() => setEditing(null)}
          onSaved={() => { setDone('Zapisano zmiany.'); void load(); }}
        />
      )}
    </>
  );
}

/** „2 z 7" — im Tag gezählt, denn so viel bleibt bis zu seinem Ende. */
function label(masses: readonly OfficeMass[], at: number): string {
  const where = positionInDay(masses, at);
  return `${where.at} z ${where.of}`;
}

/* -- Der Plan: jedes Vorkommen, mit dem, was sich daran ändern lässt ------------- */

/**
 * DER PLAN DER ZWEI WOCHEN — Messen, Beichte, Nabożeństwa, Tag für Tag. Jede
 * Zeile sagt, was sie ist (und ob abgesagt oder verlegt), wie viele
 * Intentionen sie trägt und wer feiert; und sie lässt sich ändern, absagen,
 * zurückholen, im Kalender zeigen.
 */
function Plan({ services, names, onIntentions, onEdit, onToggle }: {
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
function PeopleLine({ mass, names }: { mass: OfficeMass; names: ReadonlyMap<string, string> }) {
  const people = mass.people ?? [];
  if (people.length === 0) return null;
  const word = mass.kind === MASS ? 'odprawia' : mass.kind === DEVOTION ? 'prowadzi' : mass.kind === CONFESSION ? 'spowiada' : 'obecni';

  return (
    <span className="wk-row-side wk-mo-people">
      {' · '}{word}: {people.map((p) => names.get(p.roleId) ?? 'osoba').join(', ')}
    </span>
  );
}

/**
 * Die Menschen eines Bereichs — nur mit Schlüsselbund; sonst `null` (dann
 * keine Auswahl). `useAreaPeople` braucht einen Bund; ohne ihn fragt es nicht.
 */
function usePeople(me: Me | null, areaId: string | null): readonly Candidate[] | null {
  const people = useAreaPeople(me ?? (NO_ME as Me), me === null ? null : areaId);
  return me === null ? null : people;
}

/* Für den Fall ohne Bund: `useAreaPeople` liest ihn dann nie (ohne Bereich fragt es nicht). */
const NO_ME = null as unknown;

/* -- Eine Messe mit ihren Intentionen -------------------------------------- */

function MassEntry({ me, mass, masses, candidates: people, names, position, hasNext, onNextMass, onEdit, onChanged, onError }: {
  me: Me | null;
  mass: OfficeMass;
  /** Alle Messen des Fensters — wohin eine Intention verlegt werden kann. */
  masses: readonly OfficeMass[];
  /** Die Menschen der Gruppe — `null` ohne Schlüssel. */
  candidates: readonly Candidate[] | null;
  names: ReadonlyMap<string, string>;
  position: string;
  hasNext: boolean;
  onNextMass: () => void;
  onEdit: () => void;
  onChanged: () => void;
  onError: (message: string | null) => void;
}) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState<IntentionKind>('single');
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  /* Wer eine Intention lesen kann: die Menschen des Bereichs — die, die schon feiern, zuerst. */
  const celebrants = (mass.people ?? []).filter((p) => p.duty === 'celebrant').map((p) => p.roleId);
  const candidates = people === null ? null : [
    ...people.filter((p) => celebrants.includes(p.roleId)),
    ...people.filter((p) => !celebrants.includes(p.roleId))
  ];

  /*
   * Beim Wechsel der Messe steht der Kursor sofort im Feld. Ohne das müsste
   * nach jedem Strg+Enter doch wieder zur Maus gegriffen werden — und damit
   * wäre der ganze Modus umsonst.
   */
  useEffect(() => { field.current?.focus(); }, [mass.occurrenceAt]);

  const save = async (thenNext: boolean) => {
    const value = text.trim();

    if (value === '') {
      // Leer und Strg+Enter heisst: diese Messe hat nichts, weiter.
      if (thenNext && hasNext) onNextMass();
      return;
    }

    setBusy(true);
    onError(null);

    try {
      /*
       * `occurrenceAt` und NICHT `startsAt`: die Adresse einer Intention ist der
       * URSPRÜNGLICHE Beginn des Vorkommens. Bei einer verlegten Messe sind das
       * zwei verschiedene Zeitpunkte — und die Intention hinge dann an einer
       * Adresse, nach der der Plan nie wieder fragt.
       */
      await addIntention(mass.itemId, mass.occurrenceAt, { text: value, kind });
      setText('');
      onChanged();

      if (thenNext && hasNext) onNextMass();
      else field.current?.focus();
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać intencji.');
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setText(''); return; }
    if (e.key !== 'Enter') return;

    /*
     * Verhindern, BEVOR gespeichert wird: sonst schickt der Browser das
     * umgebende Formular ab und die Seite lädt neu — mitten in einer Reihe von
     * zwanzig Intentionen.
     */
    e.preventDefault();
    void save(e.ctrlKey || e.metaKey);
  };

  /* Nach der Messe: alle angenommenen als gelesen — ein Griff statt zwanzig. */
  const past = new Date(mass.endsAt).getTime() <= Date.now();
  const open = mass.intentions.filter((i) => i.status === 'accepted');
  const markAll = async () => {
    setBusy(true);
    onError(null);
    try {
      for (const one of open) await updateIntention(one.intentionId, { status: 'celebrated' });
      onChanged();
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się oznaczyć.');
    } finally {
      setBusy(false);
    }
  };

  /* Die Reihenfolge des Vorlesens: mit dem Nachbarn tauschen. */
  const ordered = [...mass.intentions].sort((a, b) => a.ordinal - b.ordinal);
  const swap = async (index: number, by: -1 | 1) => {
    const a = ordered[index];
    const b = ordered[index + by];
    if (a === undefined || b === undefined) return;
    setBusy(true);
    try {
      /* Gleiche Stellen (alte Einträge) bekommen erst eigene. */
      const ordA = a.ordinal === b.ordinal ? index : a.ordinal;
      const ordB = a.ordinal === b.ordinal ? index + by : b.ordinal;
      await updateIntention(a.intentionId, { ordinal: ordB });
      await updateIntention(b.intentionId, { ordinal: ordA });
      onChanged();
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się zmienić kolejności.');
    } finally {
      setBusy(false);
    }
  };

  const singles = mass.intentions.filter((i) => i.kind === 'single' && i.status !== 'cancelled');

  return (
    <article className="wk-mo-mass">
      <header className="wk-mo-head">
        <strong>{hour(mass.startsAt)}</strong>
        {(mass.title ?? '') !== '' && <span className="wk-mass-title">{mass.title}</span>}
        {mass.moved === true && <span className="wk-tag">przeniesiona</span>}
        <span className="wk-row-side">{dayLabel(mass.startsAt)} · {position}</span>
        <PeopleLine mass={mass} names={names} />
        <span className="wk-mo-head-actions">
          <button type="button" className="wk-link-btn" onClick={onEdit}>Zmień mszę</button>
          {past && open.length > 0 && (
            <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void markAll()}>
              Oznacz jako odprawione ({open.length})
            </button>
          )}
        </span>
      </header>

      {ordered.length === 0 ? (
        <p className="wk-empty">Bez intencji.</p>
      ) : (
        <ul className="wk-list">
          {ordered.map((one, index) => (
            <Row
              key={one.intentionId}
              me={me}
              mass={mass}
              intention={one}
              masses={masses}
              candidates={candidates}
              first={index === 0}
              last={index === ordered.length - 1}
              onUp={() => void swap(index, -1)}
              onDown={() => void swap(index, 1)}
              onChanged={onChanged}
              onError={onError}
            />
          ))}
        </ul>
      )}

      {/*
        Zwei einzelne Intentionen heissen zwei Priester. Das ist der Grund, aus
        dem es die Unterscheidung überhaupt gibt — also steht es da, und mit
        ihr, wie viele schon eingeteilt sind.
      */}
      {singles.length > 1 && (
        <p className="wk-mo-need">
          {singles.length} pojedyncze — potrzeba {singles.length} kapłanów
          {celebrants.length > 0 && ` (odprawia: ${celebrants.length})`}.
        </p>
      )}

      <div className="wk-mo-entry">
        <input
          ref={field}
          type="text"
          value={text}
          maxLength={400}
          disabled={busy}
          placeholder="Za śp. Jana Kowalskiego"
          aria-label="Nowa intencja"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
        />

        <select
          value={kind}
          disabled={busy}
          aria-label="Rodzaj nowej intencji"
          onChange={(e) => setKind(e.target.value as IntentionKind)}
        >
          <option value="single">{KIND_LABEL.single}</option>
          <option value="collective">{KIND_LABEL.collective}</option>
        </select>
      </div>
    </article>
  );
}

/**
 * Eine Intention — unmittelbar änderbar.
 *
 * Der Text wird beim VERLASSEN des Feldes gespeichert und nicht bei jedem
 * Anschlag: ein Aufruf je Buchstabe wäre ein Aufruf je Buchstabe. Alles andere
 * (Art, Stand, wer sie liest) sofort beim Wählen.
 */
function Row({ me, mass, intention, masses, candidates, first, last, onUp, onDown, onChanged, onError }: {
  me: Me | null;
  mass: OfficeMass;
  intention: OfficeIntention;
  masses: readonly OfficeMass[];
  candidates: readonly Candidate[] | null;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onChanged: () => void;
  onError: (message: string | null) => void;
}) {
  const [text, setText] = useState(intention.text);
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const cancelled = intention.status === 'cancelled';

  useEffect(() => { setText(intention.text); }, [intention.text]);

  const change = async (body: Parameters<typeof updateIntention>[1], failed = 'Nie udało się zapisać.') => {
    setBusy(true);
    onError(null);
    try {
      await updateIntention(intention.intentionId, body);
      onChanged();
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : failed);
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    const value = text.trim();
    if (value === '' || value === intention.text) { setText(intention.text); return; }
    await change({ text: value });
  };

  /*
   * WER SIE LIEST — und, wenn er an dieser Messe noch nicht steht, steht er
   * jetzt dort (Kto odprawia, nur dieser Termin). Sonst sähe der Priester die
   * Intention, aber die Messe nicht in seinem Kalender.
   */
  const pickCelebrant = async (roleId: string) => {
    setBusy(true);
    onError(null);
    try {
      await updateIntention(intention.intentionId, { celebrantRoleId: roleId });
      const present = mass.people ?? [];
      if (roleId !== '' && !present.some((p) => p.roleId === roleId)) {
        await setPeople(mass.itemId, [
          ...present.map((p) => ({ roleId: p.roleId, duty: p.duty as Duty })),
          { roleId, duty: 'celebrant' as Duty }
        ], mass.occurrenceAt);
      }
      onChanged();
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się przypisać.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Usunąć intencję „${intention.text}"? Tego nie da się cofnąć.`)) return;
    setBusy(true);
    try {
      await deleteIntention(intention.intentionId);
      onChanged();
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się usunąć.');
    } finally {
      setBusy(false);
    }
  };

  const others = masses.filter((m) => keyOf(m) !== keyOf(mass));

  return (
    <li className="wk-row wk-mo-int" data-cancelled={cancelled} data-status={intention.status}>
      <span className="wk-mo-order">
        <button type="button" className="wk-icon-btn" aria-label="Wyżej" title="Wyżej" disabled={busy || first} onClick={onUp}>↑</button>
        <button type="button" className="wk-icon-btn" aria-label="Niżej" title="Niżej" disabled={busy || last} onClick={onDown}>↓</button>
      </span>

      <input
        type="text"
        value={text}
        maxLength={400}
        disabled={busy || cancelled}
        aria-label="Treść intencji"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
      />

      <span className="wk-mo-int-controls">
        <select value={intention.kind} disabled={busy} aria-label="Rodzaj" onChange={(e) => void change({ kind: e.target.value as IntentionKind })}>
          <option value="single">{KIND_LABEL.single}</option>
          <option value="collective">{KIND_LABEL.collective}</option>
        </select>

        <select value={intention.status} disabled={busy} aria-label="Stan" onChange={(e) => void change({ status: e.target.value })}>
          {(['accepted', 'celebrated', 'cancelled'] as const).map((s) => <option key={s} value={s}>{INTENTION_STATUS_LABEL[s]}</option>)}
        </select>

        {candidates !== null && (
          <select value={intention.celebrantRoleId ?? ''} disabled={busy} aria-label="Kto odprawia tę intencję"
            onChange={(e) => void pickCelebrant(e.target.value)}>
            <option value="">— kto odprawia —</option>
            {candidates.map((c) => <option key={c.roleId} value={c.roleId}>{c.name}</option>)}
          </select>
        )}

        <button type="button" className="wk-link-btn" aria-expanded={more} onClick={() => setMore((m) => !m)}>
          {more ? 'Mniej' : 'Więcej'}
        </button>
      </span>

      {more && (
        <div className="wk-mo-int-more">
          <Sealed me={me} mass={mass} intention={intention} busy={busy} onChanged={onChanged} onError={onError} />

          {others.length > 0 && (
            <label className="wk-field">
              <span>Przenieś na inną mszę</span>
              <select value="" disabled={busy} onChange={(e) => {
                const target = others.find((m) => keyOf(m) === e.target.value);
                if (target !== undefined) void change({ itemId: target.itemId, occurrenceAt: target.occurrenceAt }, 'Nie udało się przenieść.');
              }}>
                <option value="">— wybierz mszę —</option>
                {others.map((m) => (
                  <option key={keyOf(m)} value={keyOf(m)}>
                    {dayLabel(m.startsAt)} {hour(m.startsAt)}{(m.title ?? '') === '' ? '' : ` — ${m.title}`}
                  </option>
                ))}
              </select>
              <span className="wk-hint">Inny termin poza tymi dwoma tygodniami: wybierz wyżej inny dzień.</span>
            </label>
          )}

          {intention.status !== 'celebrated' && (
            <button type="button" className="wk-link-btn wk-danger" disabled={busy} onClick={() => void remove()}>Usuń intencję</button>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * KTO ZAMÓWIŁ I OFIARA — versiegelt, unter dem Schlüssel des Bereichs des
 * Kalenders. Sie hängen an keinem Zettel an der Tür; der Dienst legt sie ab,
 * ohne sie zu lesen (`app.mass_intention_field`).
 */
function Sealed({ me, mass, intention, busy: outerBusy, onChanged, onError }: {
  me: Me | null;
  mass: OfficeMass;
  intention: OfficeIntention;
  busy: boolean;
  onChanged: () => void;
  onError: (message: string | null) => void;
}) {
  const [giver, setGiver] = useState<string | null>(null);
  const [offering, setOffering] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const aadOf = (field: 'giver' | 'offering') =>
    aad('mass', 'intention', intention.intentionId, field === 'giver' ? Field.MassIntentionGiver : Field.MassIntentionOffering, 1);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const opened: Record<string, string> = {};
      if (me !== null) {
        for (const f of intention.fields) {
          try {
            const key = (await areaKeys(me.ring, f.areaId)).get(f.epoch);
            if (key !== undefined) opened[f.field] = await openText(key, aadOf(f.field as 'giver' | 'offering'), fromBase64Url(f.sealed));
          } catch { /* nicht für mich */ }
        }
      }
      if (!alive) return;
      setGiver(opened.giver ?? '');
      setOffering(opened.offering ?? '');
    })();
    return () => { alive = false; };
  }, [me, intention.intentionId, intention.fields]);

  if (me === null || mass.areaId == null) {
    return <p className="wk-hint">Ofiarodawca i ofiara są zaszyfrowane — bez kluczy w tej karcie ich nie widać.</p>;
  }
  if (giver === null || offering === null) return <p className="wk-hint">Odczytywanie…</p>;

  const save = async () => {
    setBusy(true);
    onError(null);
    setSaved(false);
    try {
      const newest = newestKey(await areaKeys(me.ring, mass.areaId!, true));
      if (newest === null) throw new WorkspaceError('Nie masz klucza tego obszaru — nie da się zapisać.');
      const seal = async (field: 'giver' | 'offering', value: string) => ({
        field, areaId: mass.areaId!, epoch: newest.epoch,
        sealed: toBase64Url(await sealText(newest.key, aadOf(field), value))
      });
      await updateIntention(intention.intentionId, {
        fields: [await seal('giver', giver.trim()), await seal('offering', offering.trim())]
      });
      setSaved(true);
      onChanged();
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wk-mo-sealed">
      <label className="wk-field">
        <span>Kto zamówił</span>
        <input value={giver} maxLength={200} disabled={busy || outerBusy} placeholder="np. rodzina Kowalskich, tel. …" onChange={(e) => { setGiver(e.target.value); setSaved(false); }} />
      </label>
      <label className="wk-field">
        <span>Ofiara</span>
        <input value={offering} maxLength={100} disabled={busy || outerBusy} placeholder="np. 50 zł" onChange={(e) => { setOffering(e.target.value); setSaved(false); }} />
      </label>
      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-quiet" disabled={busy || outerBusy} onClick={() => void save()}>Zapisz</button>
        {saved && <span className="wk-row-side">Zapisano.</span>}
        <span className="wk-hint">Zaszyfrowane — w gablocie i na wydruku ich nie ma.</span>
      </div>
    </div>
  );
}

/* -- Termine, die man sich nehmen kann ------------------------------------- */

/**
 * Die Termine eines Kalenders — und wer sich auf sie gesetzt hat.
 *
 * <b>Warum sie nicht bei den Messen stehen.</b> Eine Messe traegt Intentionen,
 * ein Termin traegt Menschen. Das sind zwei verschiedene Vorgaenge mit
 * verschiedenen Handgriffen, und sie in eine Liste zu zwingen hiesse, an jeder
 * Zeile erst zu pruefen, was sie eigentlich ist. Darum eine eigene Liste —
 * derselbe Kalender, dasselbe Fenster, andere Arbeit.
 *
 * <b>Freigegeben wird je VORKOMMEN.</b> „Samstags 10:00" ist eine Reihe;
 * angeboten wird der 14. November. Ein Eintrag ohne Freigabe steht hier
 * trotzdem — sonst muesste man raten, welche Termine es ueberhaupt gibt.
 */
function Appointments({ calendar, from }: { calendar: CalendarRow; from: string }) {
  const [items, setItems] = useState<readonly OfficeMass[]>([]);
  const [resource, setResource] = useState<ResourceRow | null | undefined>(undefined);
  const [claims, setClaims] = useState<readonly OfficeClaim[]>([]);
  const [failed, setFailed] = useState<string | null>(null);

  /** Welche Termine geschlossen sind (0049) — „Termin|Beginn" → wer. */
  const [closed, setClosed] = useState<ReadonlyMap<string, 'office' | 'host'>>(new Map());

  /** Welcher Termin gerade entfernt wird — „Klucz Termin|Beginn". */
  const [removing, setRemoving] = useState<string | null>(null);
  const [removed, setRemoved] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const start = new Date(`${from}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + WINDOW_DAYS);

      const [plan, all] = await Promise.all([
        loadOffice(calendar.calendarId, start, end, ['appointment']),
        loadResources().catch(() => ({ resources: [] as readonly ResourceRow[] }))
      ]);

      const mine = all.resources.find((r) => r.calendarId === calendar.calendarId) ?? null;

      setItems(plan.masses);
      setResource(mine);
      const office = mine === null ? null : await loadClaims(mine.resourceId).catch(() => null);
      setClaims(office?.claims ?? []);
      setClosed(new Map((office?.closed ?? []).map((one) => [termKey(one.itemId, one.occurrenceAt), one.closedBy])));
      setFailed(null);
    } catch (e) {
      setItems([]);
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać terminów.');
    }
  }, [calendar.calendarId, from]);

  useEffect(() => { void load(); }, [load]);

  /**
   * EINEN TERMIN ENTFERNEN — dieses eine Vorkommen.
   *
   * <b>Abgesagt, nicht gelöscht.</b> Der Termin fällt aus der Reihe (eine
   * Ausnahme am Kalendereintrag): bei einem einmaligen ist er damit fort, bei
   * einer Reihe fällt nur dieser Tag. Wer darauf sass, wird ausgetragen — das
   * sagt die Frage vorher, mit Namen.
   */
  const remove = async (one: OfficeMass, names: readonly string[]) => {
    const when = stamp(one.startsAt);
    const ask = names.length === 0
      ? `Usunąć termin ${when}?`
      : `Usunąć termin ${when}? Zapisane osoby (${names.join(', ')}) zostaną z niego wypisane.`;
    if (!window.confirm(ask)) return;

    const key = `${one.itemId}|${one.occurrenceAt}`;
    setRemoving(key);
    setFailed(null);
    setRemoved(null);

    try {
      await setOccurrence(one.itemId, one.occurrenceAt, { cancelled: true });
      setRemoved(`Usunięto termin ${when}${names.length > 0 ? ` — wypisano: ${names.join(', ')}` : ''}.`);
      await load();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się usunąć terminu.');
    } finally {
      setRemoving(null);
    }
  };

  /* -- 0049: dopisać, wypisać, zamknąć -------------------------------------------- */

  const [adding, setAdding] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const officeAct = async (what: string, todo: () => Promise<string | null>) => {
    setWorking(what);
    setFailed(null);
    setRemoved(null);

    try {
      const said = await todo();
      if (said !== null) setRemoved(said);
      await load();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    } finally {
      setWorking(null);
    }
  };

  /** Jemanden eintragen — mit Link (ein Platz) oder nur mit Namen; auch über die Plätze hinaus. */
  const seat = (one: OfficeMass, who: { seatId?: string; name?: string }) => {
    if (resource == null) return;
    void officeAct('Dopisywanie…', async () => {
      const done = await officeAdd(resource.resourceId, { itemId: one.itemId, occurrenceAt: one.occurrenceAt }, who);
      setAdding(null);
      return `Dopisano: ${done.name ?? 'osobę'} — ${stamp(one.startsAt)}${done.over ? ` (ponad limit: ${done.taken} z ${done.capacity})` : ''}.`;
    });
  };

  /** Jemanden austragen. */
  const unseat = (c: OfficeClaim) => {
    if (!window.confirm(`Wypisać z terminu: ${nameOf(c)}?${c.hosting ? ' To gospodarz — wolne miejsca otworzą się dla wszystkich.' : ''}`)) return;
    void officeAct('Wypisywanie…', async () => {
      await officeRemove(c.claimId);
      return `Wypisano: ${nameOf(c)}.`;
    });
  };

  /** Schliessen — auch mit freien Plätzen — oder wieder öffnen. */
  const closeTerm = (one: OfficeMass, close: boolean) => {
    if (resource == null) return;
    void officeAct(close ? 'Zamykanie…' : 'Otwieranie…', async () => {
      await officeClose(resource.resourceId, { itemId: one.itemId, occurrenceAt: one.occurrenceAt }, close);
      return close ? `Zamknięto termin ${stamp(one.startsAt)} — nikt więcej się nie zapisze.` : `Termin ${stamp(one.startsAt)} znów przyjmuje zapisy.`;
    });
  };

  /* Wer auf welchem Termin sitzt — je Vorkommen, am ursprünglichen Beginn. */
  const on = (one: OfficeMass) => claims.filter((c) => c.itemId === one.itemId
    && c.occurrenceAt !== null && new Date(c.occurrenceAt).getTime() === new Date(one.occurrenceAt).getTime()
    && (c.status === 'confirmed' || c.status === 'pending'));

  return (
    <>
      <h4 className="wk-h2">Terminy</h4>

      {failed !== null && <p className="wk-error">{failed}</p>}
      {removed !== null && <p className="wk-done">{removed}</p>}
      {working !== null && <p className="wk-hint" role="status">{working}</p>}

      {/*
        WER SICH WORAUF GESETZT HAT, steht bei den Rezerwacje (0039) — und jetzt
        auch hier, je Termin (0045): wer, wer davon Gastgeber ist, und bis wann
        er allein einlädt. Die Regeln des Zasób stehen darüber und lassen sich
        hier ändern — genau dort, wo man sieht, was sie bewirken.
      */}
      {resource === undefined ? null : resource === null ? (
        <p className="wk-hint">
          Ten kalendarz nie należy do żadnego zasobu — jego terminów nikt nie wybierze.
          Załóż zasób w <a className="wk-link" href={viewPath('bookings', 'new')}>Rezerwacjach</a>.
        </p>
      ) : (
        <SlotRules row={resource} onSaved={(row) => setResource(row)} />
      )}

      {items.length === 0 ? (
        <p className="wk-empty">W tym oknie nie ma żadnego terminu. Załóż go powyżej jako „Termin".</p>
      ) : (
        <ul className="wk-list">
          {items.map((one) => {
            const when = new Date(one.startsAt);
            const here = on(one);
            const host = here.find((c) => c.hosting);
            const counted = here.filter((c) => c.status === 'confirmed' || c.awaits === 'office').length;
            const closedBy = closed.get(termKey(one.itemId, one.occurrenceAt)) ?? null;

            return (
              <li className="wk-row wk-appt" key={`${one.itemId}:${one.occurrenceAt}`}>
                <span>
                  <strong>
                    {when.toLocaleDateString('pl-PL',
                      { weekday: 'short', day: 'numeric', month: 'long' })}
                    {', '}
                    {when.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                  </strong>
                  {one.title !== null && <> — {one.title}</>}

                  {resource != null && (
                    <span className="wk-row-side">
                      {' · '}{counted} z {resource.capacity}
                      {counted > resource.capacity && ' · ponad limit'}
                    </span>
                  )}

                  {closedBy !== null && (
                    <span className="wk-tag"> zamknięty{closedBy === 'office' ? ' przez kancelarię' : ' przez gospodarza'}</span>
                  )}

                  {/*
                    WER SIEDZI NA TERMINIE — a przy każdym ×, żeby go wypisać
                    (0049). Kancelaria może wypisać każdego, także gospodarza:
                    wtedy wolne miejsca należą do wszystkich.
                  */}
                  {here.length > 0 && (
                    <span className="wk-slot-people">
                      {here.map((c) => (
                        <span className={c.hosting ? 'wk-tag wk-tag-open' : 'wk-tag'} key={c.claimId}>
                          {nameOf(c)}
                          {c.hosting && (c.hostPending === true ? ' · pierwszy, decyduje' : ' · gospodarz')}
                          {c.byOffice === true && (c.withLink === true ? ' · dopisany' : ' · dopisany, bez linku')}
                          {c.status === 'pending' && (c.awaits === 'host' ? ' · prosi gospodarza' : ' · czeka')}
                          <button
                            type="button" className="wk-chip-x" disabled={working !== null}
                            aria-label={`Wypisz: ${nameOf(c)}`} title="Wypisz z terminu"
                            onClick={() => unseat(c)}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </span>
                  )}

                  {adding === termKey(one.itemId, one.occurrenceAt) && resource != null && (
                    <AddPerson
                      full={counted >= resource.capacity}
                      busy={working !== null}
                      onAdd={(who) => seat(one, who)}
                      onCancel={() => setAdding(null)}
                    />
                  )}

                  {host !== undefined && host.inviteUntil !== null && (
                    <span className="wk-hint wk-slot-host">
                      {host.hostPending === true
                        ? `${nameOf(host)} wybrał(a) ten termin jako pierwszy i do ${stamp(host.inviteUntil)} decyduje, czy zaprosi znajomych. Jeśli nie odpowie, termin otworzy się dla wszystkich.`
                        : new Date(host.inviteUntil).getTime() > Date.now()
                        ? `Gospodarz (${nameOf(host)}) sam dobiera osoby do ${stamp(host.inviteUntil)} — potem, jeśli będzie ich mniej niż ${resource?.minPersons ?? 2}, wolne miejsca otworzą się dla wszystkich. Kod zna tylko on.`
                        : counted >= (resource?.minPersons ?? 2)
                          ? `Czas gospodarza minął ${stamp(host.inviteUntil)} — grupa jest skompletowana, termin zostaje dla niej.`
                          : `Czas gospodarza minął ${stamp(host.inviteUntil)} — wolne miejsca są dla wszystkich.`}
                    </span>
                  )}
                </span>

                {resource != null && (
                  <span className="wk-appt-actions">
                    <button
                      type="button" className="wk-link-btn" disabled={working !== null}
                      onClick={() => setAdding(adding === termKey(one.itemId, one.occurrenceAt) ? null : termKey(one.itemId, one.occurrenceAt))}
                    >
                      Dopisz osobę
                    </button>
                    <button
                      type="button" className="wk-link-btn" disabled={working !== null}
                      title={closedBy === null ? 'Nikt więcej się nie zapisze — także gdy są wolne miejsca' : 'Termin znów przyjmuje zapisy'}
                      onClick={() => closeTerm(one, closedBy === null)}
                    >
                      {closedBy === null ? 'Zamknij' : 'Otwórz'}
                    </button>
                  </span>
                )}

                <button
                  type="button"
                  className="wk-link-btn wk-danger"
                  disabled={removing !== null}
                  title={here.length > 0 ? 'Zapisane osoby zostaną wypisane' : 'Termin zniknie z listy do wyboru'}
                  onClick={() => void remove(one, here.map((c) => c.name ?? 'bez nazwy'))}
                >
                  {removing === `${one.itemId}|${one.occurrenceAt}` ? 'Usuwanie…' : 'Usuń'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/**
 * WER DA SITZT — der Name, sonst wenigstens, wann er sich angemeldet hat.
 *
 * Ein Platz ohne Namen (eine frühe Anmeldung, deren Namensfragen es so nicht
 * mehr gibt) stand bisher als „bez nazwy" da, und die Kanzlei konnte ihn
 * nirgends wiederfinden. Mit der Zeit der Anmeldung findet sie ihn unter
 * „Osoby".
 */
const nameOf = (c: OfficeClaim): string =>
  c.name ?? (c.registeredAt != null ? `bez nazwy (zgłoszenie z ${stamp(c.registeredAt)})` : 'bez nazwy');

/** Die Kennung eines Termins — Eintrag und ursprünglicher Beginn, am Zeitpunkt verglichen. */
const termKey = (itemId: string, occurrenceAt: string) => `${itemId}|${new Date(occurrenceAt).getTime()}`;

interface Pickable { readonly seatId: string; readonly name: string }

/**
 * Alle Menschen mit Link, die diese Kanzlei sieht — für „Dopisz osobę". Eine
 * Minute lang gemerkt: wer mehrere Termine hintereinander füllt, wartet nicht
 * jedes Mal auf alle Bereiche.
 */
let pickable: { at: number; seats: Promise<readonly Pickable[]> } | null = null;

function loadPickable(): Promise<readonly Pickable[]> {
  if (pickable !== null && Date.now() - pickable.at < 60_000) return pickable.seats;

  const seats = (async () => {
    const out = new Map<string, Pickable>();
    for (const area of (await loadAreas()).areas) {
      try {
        for (const one of (await loadSeats(area.areaId)).seats) {
          if (one.revokedAt !== null || one.status !== 'active' || (one.recipientName ?? '').trim() === '') continue;
          out.set(one.seatId, { seatId: one.seatId, name: one.recipientName!.trim() });
        }
      } catch {
        // Diesen Bereich lese ich nicht.
      }
    }
    return [...out.values()].sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  })();

  pickable = { at: Date.now(), seats };
  seats.catch(() => { pickable = null; });
  return seats;
}

/**
 * „DOPISZ OSOBĘ" (0049) — ktoś z linkiem (widzi wtedy termin u siebie) albo
 * samo imię i nazwisko, dla kogoś bez linku. Także ponad limit miejsc.
 */
function AddPerson({ full, busy, onAdd, onCancel }: {
  full: boolean;
  busy: boolean;
  onAdd: (who: { seatId?: string; name?: string }) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const [all, setAll] = useState<readonly Pickable[] | null>(null);

  useEffect(() => {
    let alive = true;
    void loadPickable().then((found) => { if (alive) setAll(found); }).catch(() => { if (alive) setAll([]); });
    return () => { alive = false; };
  }, []);

  const wanted = text.trim().toLocaleLowerCase('pl');
  const hits = all === null || wanted === '' ? [] : all.filter((one) => one.name.toLocaleLowerCase('pl').includes(wanted)).slice(0, 8);

  return (
    <span className="wk-appt-add">
      {full && <span className="wk-hint">Termin jest pełny — dopiszesz ponad limit.</span>}
      <span className="wk-inline">
        <input
          value={text} autoFocus placeholder="Szukaj osoby albo wpisz imię i nazwisko"
          aria-label="Kogo dopisać" onChange={(e) => setText(e.target.value)}
        />
        <button type="button" className="wk-link-btn" onClick={onCancel}>Anuluj</button>
      </span>

      {all === null && <span className="wk-hint">Wczytywanie osób…</span>}

      {hits.length > 0 && (
        <span className="wk-appt-hits">
          {hits.map((one) => (
            <button key={one.seatId} type="button" className="wk-appt-hit" disabled={busy}
              onClick={() => onAdd({ seatId: one.seatId })}>
              + {one.name}
            </button>
          ))}
        </span>
      )}

      {wanted !== '' && (
        <button type="button" className="wk-link-btn" disabled={busy} onClick={() => onAdd({ name: text.trim() })}>
          Dopisz „{text.trim()}" bez linku
        </button>
      )}
    </span>
  );
}

/** Ein Zeitpunkt, kurz: „26 września, 19:00". */
const stamp = (at: string) => {
  const d = new Date(at);
  return `${d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}, ${
    d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`;
};

/**
 * DIE REGELN DER TERMINE (0045) — hier, wo man sie wirken sieht.
 *
 * <code>
 *   osób na termin         wie viele auf EINEN Termin passen      (capacity)
 *   terminów na osobę      wie viele Termine EINER halten darf    (per_person, 0 = frei)
 *   godzin gospodarza      so lange lädt der Erste allein ein      (invite_hours, 0 = nie)
 * </code>
 *
 * Dieselben Zahlen wie in „Rezerwacje › Zasady"; dort steht das Ganze, hier
 * das, was man beim Planen der Termine braucht.
 */
function SlotRules({ row, onSaved }: { row: ResourceRow; onSaved: (row: ResourceRow) => void }) {
  const [capacity, setCapacity] = useState(String(row.capacity));
  const [perPerson, setPerPerson] = useState(String(row.perPerson));
  const [hours, setHours] = useState(String(row.inviteHours));
  const [minimum, setMinimum] = useState(String(row.minPersons));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setCapacity(String(row.capacity));
    setPerPerson(String(row.perPerson));
    setHours(String(row.inviteHours));
    setMinimum(String(row.minPersons));
  }, [row.resourceId, row.capacity, row.perPerson, row.inviteHours, row.minPersons]);

  const changed = capacity !== String(row.capacity) || perPerson !== String(row.perPerson)
    || hours !== String(row.inviteHours) || minimum !== String(row.minPersons);

  const save = async () => {
    setBusy(true);
    setFailed(null);
    setDone(false);

    try {
      onSaved(await updateResource(row.resourceId, {
        capacity: Number(capacity), perPerson: Number(perPerson), inviteHours: Number(hours),
        minPersons: Number(minimum)
      }));
      setDone(true);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="wk-slot-rules" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <p className="wk-hint">
        Każdy termin tutaj można wybrać — to zasób{' '}
        <a className="wk-link" href={viewPath('bookings', row.resourceId)}>{row.name}</a>.
      </p>

      <div className="wk-actions">
        <label className="wk-field wk-field-num">
          <span>Osób na termin</span>
          <input type="number" min={1} value={capacity} disabled={busy} onChange={(e) => setCapacity(e.target.value)} />
        </label>
        <label className="wk-field wk-field-num">
          <span>Terminów na osobę</span>
          <input type="number" min={0} value={perPerson} disabled={busy} onChange={(e) => setPerPerson(e.target.value)} />
        </label>
        <label className="wk-field wk-field-num">
          <span>Godzin gospodarza</span>
          <input type="number" min={0} value={hours} disabled={busy} onChange={(e) => setHours(e.target.value)} />
        </label>
        <label className="wk-field wk-field-num">
          <span>Minimum osób</span>
          <input type="number" min={1} value={minimum} disabled={busy} onChange={(e) => setMinimum(e.target.value)} />
        </label>
        {changed && <button type="submit" className="wk-btn" disabled={busy}>{busy ? 'Zapisywanie…' : 'Zapisz'}</button>}
        {done && !changed && <span className="wk-row-side">Zapisano.</span>}
      </div>

      <p className="wk-hint">
        {Number(perPerson) === 0 ? 'Jedna osoba może wziąć dowolnie wiele terminów.'
          : `Jedna osoba może mieć naraz ${perPerson} — potem może już tylko zamienić.`}
        {' '}
        {Number(hours) === 0 ? 'Bez gospodarza: każdy zapisuje się sam.'
          : `Pierwszy zapisany na termin przez ${hours} h sam dobiera pozostałych — swoim kodem albo zgodą na prośbę.`}
        {' '}
        {Number(hours) > 0 && `Po tym czasie termin z co najmniej ${minimum} osobami zostaje dla grupy (gospodarz może go też sam zamknąć); z mniejszą liczbą wolne miejsca otwierają się dla wszystkich.`}
      </p>

      {failed !== null && <p className="wk-error">{failed}</p>}
    </form>
  );
}

/* -- Einen Kalender anlegen ------------------------------------------------ */

/**
 * Ein neuer Kalender — HIER, bei den Kalendern.
 *
 * <b>Er stand einmal beim Bereich</b>, weil ein Kalender einen Bereich
 * BRAUCHT: der Bereich entscheidet, wer ihn sieht. Das ist ein Grund, beide zu
 * verbinden, und keiner, das Formular dort zu führen — wer einen Kalender
 * anlegen will, sucht ihn bei den Kalendern.
 *
 * <b>Der Bereich wird deshalb hier gewählt.</b> Es ist die einzige Angabe, die
 * sich nicht erraten lässt: an ihr hängt, wer den Plan später lesen darf.
 */
function NewCalendar({ areas, busy, onAct }: {
  areas: readonly AreaRow[];
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [areaId, setAreaId] = useState('');

  /* Anlegen darf, wer den Bereich führt oder beschreibt. */
  const mine = areas.filter((a) => a.myLevel === 'admin' || a.myLevel === 'write');

  if (!open) {
    return (
      <div className="wk-actions">
        <button
          type="button" className="wk-link-btn" disabled={busy}
          onClick={() => { setOpen(true); setAreaId(mine[0]?.areaId ?? ''); }}
        >
          Terminarz innej grupy
        </button>
      </div>
    );
  }

  if (mine.length === 0) {
    return (
      <p className="wk-note">
        Terminarz należy do grupy (obszaru) — a Ty w żadnej nie piszesz. Załóż ją
        w zakładce „Obszary", potem wróć tutaj.
        {' '}
        <button type="button" className="wk-link-btn" onClick={() => setOpen(false)}>
          Zamknij
        </button>
      </p>
    );
  }

  return (
    <form
      className="wk-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (areaId === '') return;

        /*
         * 0054 — EIN TERMINARZ JE GRUPPE. Er heisst wie sie; hat sie schon
         * einen, ist es dieser (der Dienst gibt ihn zurück, statt einen
         * zweiten anzulegen).
         */
        const name = areas.find((a) => a.areaId === areaId)?.name ?? 'Terminy';
        void onAct('Otwieranie terminarza…',
          () => createCalendar({ areaId, title: name, timeZone: 'Europe/Warsaw' }))
          .then(() => setOpen(false));
      }}
    >
      <h4 className="wk-h2">Terminarz innej grupy</h4>

      <label className="wk-field">
        <span>Grupa (obszar)</span>
        <select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          <AreaOptions areas={areas} only={mine} />
        </select>
      </label>

      <p className="wk-hint">
        Grupa decyduje, kto zobaczy ten plan. Jeśli ma być w gablocie, wybierz
        taką, która jest jawna — albo otwórz ją potem. Terminarz każdej grupy
        jest jeden i powstaje sam; godziny liczą się w czasie polskim.
      </p>

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy || areaId === ''}>
          Otwórz terminarz
        </button>
        <button type="button" className="wk-link-btn" onClick={() => setOpen(false)}>
          Anuluj
        </button>
      </div>
    </form>
  );
}

/* -- Eine Messe anlegen ---------------------------------------------------- */

/** Die Wiederholungen, die für einen Gottesdienst Sinn ergeben. */
const SERVICE_REPEATS: readonly RepeatKind[] = ['none', 'daily', 'weekly', 'monthly'];

/** Wie lange, wenn niemand es sagt — die Beichte bis zur Messe, das Nabożeństwo eine halbe Stunde. */
const MINUTES: Record<string, number> = { mass: 45, confession: 60, devotion: 30, appointment: 60 };

function ServiceForm({ calendar, onAdded }: { calendar: CalendarRow; onAdded: (what: string) => void }) {
  const [kind, setKind] = useState<ItemKind>(MASS);
  const [date, setDate] = useState(todayKey);
  const [time, setTime] = useState('18:00');
  /* 0079 — wie lange. Bei der Beichte steht es im Aushang („do 18:45"). */
  const [minutes, setMinutes] = useState(String(calendar.durationMinutes ?? MINUTES.mass));
  const pickKind = (next: ItemKind) => { setKind(next); setMinutes(String(MINUTES[next] ?? 60)); };
  const [title, setTitle] = useState('');
  const [repeat, setRepeat] = useState<RepeatKind>('none');
  const [weekdays, setWeekdays] = useState(0);
  const [until, setUntil] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /*
   * Die eigene Rolle. Ein Eintrag gehört einer Rolle, nicht einem Konto: wer
   * ihn angelegt hat, bleibt lesbar, auch wenn das Konto später einer anderen
   * Person gehört.
   */
  const [roleId, setRoleId] = useState<string | null | undefined>(undefined);

  /* Die eigene PERSON, nicht das Konto: dem Konto gehört nichts (0040). */
  useEffect(() => {
    loadRoles()
      .then((graph) => setRoleId(selfOf(graph)?.id ?? null))
      .catch(() => setRoleId(null));
  }, []);

  const blocker =
    busy ? null
    : roleId === undefined ? 'Wczytywanie roli…'
    : roleId === null ? 'Konto nie prowadzi jeszcze żadnej osoby — załóż ją w Rolach.'
    : date === '' || time === '' ? 'Podaj dzień i godzinę.'
    /*
     * EINE REIHE MUSS EIN ENDE HABEN. Hier gesagt statt als 400 vom Dienst —
     * wer den Knopf grau sieht, soll wissen, was fehlt.
     */
    : repeat !== 'none' && until === '' ? 'Seria musi mieć koniec — podaj ostatni dzień.'
    : null;

  const go = async () => {
    if (roleId == null) return;

    setBusy(true);
    setFailed(null);

    try {
      await addItem(calendar.calendarId, {
        ownerRoleId: roleId,

        /*
         * Der Bereich des KALENDERS entscheidet über das Dasein des Eintrags.
         * Sichtbar wird er dadurch, dass dessen Epochenschlüssel offenliegt —
         * nicht durch einen Schalter „öffentlich". Ein anderer Bereich wäre
         * möglich, aber er gehört nicht in ein Formular, das jemand im
         * Vorbeigehen ausfüllt.
         */
        visibilityAreaId: calendar.areaId,

        kind, date, time,
        minutes: Math.min(24 * 60, Math.max(5, Number(minutes) || MINUTES[kind] || 45)),
        titlePublic: title.trim() === '' ? undefined : title.trim(),
        repeat,
        weekdays: repeat === 'weekly' ? weekdays : undefined,
        until: repeat === 'none' ? undefined : until
      });

      setTitle('');
      onAdded(`Założono: ${kindWord(kind).toLowerCase()} ${date} ${time}${repeat === 'none' ? '' : `, ${REPEAT_LABEL[repeat]} do ${until}`}.`);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się założyć.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="wk-form"
      onSubmit={(e) => { e.preventDefault(); if (blocker === null) void go(); }}
    >
      <h4 className="wk-h2">Załóż wpis</h4>

      <label className="wk-field">
        <span>Co</span>
        <select
          value={kind}
          onChange={(e) => pickKind(e.target.value as ItemKind)}
        >
          <option value={MASS}>Msza</option>
          <option value={CONFESSION}>Spowiedź</option>
          <option value={DEVOTION}>Nabożeństwo (różaniec, droga krzyżowa…)</option>

          {/*
            DER TERMIN — das, wofür die Firmlinge herkommen.

            Er stand hier nicht, und damit gab es im ganzen Haus keinen Weg,
            einen anzulegen: der Dienst kannte `appointment` von Anfang an
            (`ck_item_kind`), das Buchen war gebaut (0029), das Modul für die
            Seite auch — nur die eine Auswahlliste bot es nicht an. Eine
            Möglichkeit, die nirgends angeboten wird, gibt es nicht.
          */}
          <option value="appointment">Termin (do zapisów)</option>
        </select>
      </label>

      {/*
        WAS ALS NÄCHSTES ZU TUN IST. Ein angelegter Termin nimmt noch niemanden
        auf — freigegeben wird je Vorkommen, weiter unten. Ohne diesen Satz
        legt jemand einen Termin an, sieht ihn im Plan stehen und wartet auf
        Anmeldungen, die nicht kommen können.
      */}
      {kind === 'appointment' && (
        <p className="wk-hint">
          Sam termin jeszcze nikogo nie przyjmuje — otwórz go na zapisy niżej,
          w „Terminy", podając liczbę miejsc.
        </p>
      )}

      <label className="wk-field">
        <span>Dzień</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      <label className="wk-field">
        <span>Godzina</span>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </label>

      <label className="wk-field">
        <span>Czas trwania (min)</span>
        <input type="number" min={5} max={1440} step={5} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        {kind === CONFESSION && <span className="wk-hint">W gablocie: „Spowiedź do …" — koniec liczy się z czasu trwania.</span>}
      </label>

      <label className="wk-field">
        <span>Nazwa (widoczna w gablocie)</span>
        <input value={title} list={kind === DEVOTION ? 'wk-mo-devotions' : undefined}
          placeholder={kind === DEVOTION ? 'np. Różaniec' : kind === CONFESSION ? 'puste: „Spowiedź"' : 'np. Msza św. nowennowa'} onChange={(e) => setTitle(e.target.value)} />
        {kind === DEVOTION && <datalist id="wk-mo-devotions">{DEVOTION_NAMES.map((n) => <option key={n} value={n} />)}</datalist>}
      </label>

      <label className="wk-field">
        <span>Powtórzenie</span>
        <select value={repeat} onChange={(e) => setRepeat(e.target.value as RepeatKind)}>
          {SERVICE_REPEATS.map((one) => (
            <option key={one} value={one}>{REPEAT_LABEL[one]}</option>
          ))}
        </select>
      </label>

      {repeat === 'weekly' && (
        <div className="wk-mo-days">
          {WEEKDAY_BITS.map((day) => (
            <label key={day.bit} className="wk-mo-day">
              <input
                type="checkbox"
                checked={(weekdays & day.bit) !== 0}
                onChange={() => setWeekdays((mask) => mask ^ day.bit)}
              />
              {day.label}
            </label>
          ))}
        </div>
      )}

      {repeat !== 'none' && (
        <label className="wk-field">
          <span>Do dnia</span>
          <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
        </label>
      )}

      <p className="wk-hint">
        Godzina jest lokalna — 18:00 to osiemnasta w kościele, także po zmianie
        czasu. Bez wybranych dni tygodnia obowiązuje dzień pierwszego terminu.
        Zmienisz wszystko później w „Plan i zmiany" albo w kalendarzu.
      </p>

      <p className="wk-hint">
        Wpis trafia do obszaru <strong>{calendar.areaName}</strong>. W gablocie
        pokaże się dopiero wtedy, gdy epoka tego obszaru jest opublikowana —
        jawność to klucz, nie przełącznik.
      </p>

      {failed !== null && <p className="wk-error">{failed}</p>}

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={blocker !== null || busy}>
          {busy ? 'Zakładanie…' : 'Załóż'}
        </button>
        {blocker !== null && !busy && <span className="wk-blocker">{blocker}</span>}
      </div>
    </form>
  );
}

/* -- Der Bogen ------------------------------------------------------------- */

function PrintSheet({ calendarId }: { calendarId: string }) {
  const [week, setWeek] = useState(() => sheetWeek(new Date()));
  const [failed, setFailed] = useState<string | null>(null);

  const print = async () => {
    setFailed(null);

    try {
      const start = new Date(`${week.from}T00:00:00`);
      const end = new Date(`${week.to}T23:59:59`);

      /*
       * Frisch geholt und nicht aus dem Fenster genommen: das Blatt geht an die
       * Wand und soll den Stand von jetzt zeigen, nicht den von vorhin. Und aus
       * dem ÖFFENTLICHEN Plan — genau das, was auch vorgelesen wird.
       */
      const found = await loadPlan(calendarId, start, end);
      if (!printIntentions(found.masses, start, end)) {
        setFailed('Nie udało się otworzyć wydruku — przeglądarka mogła zablokować nowe okno.');
      }
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się przygotować wydruku.');
    }
  };

  return (
    <section className="wk-form">
      <h4 className="wk-h2">Wydruk do gabloty</h4>

      <div className="wk-mo-top">
        <label className="wk-field">
          <span>Od</span>
          <input
            type="date" value={week.from}
            onChange={(e) => setWeek({ ...week, from: e.target.value })}
          />
        </label>

        <label className="wk-field">
          <span>Do</span>
          <input
            type="date" value={week.to}
            onChange={(e) => setWeek({ ...week, to: e.target.value })}
          />
        </label>
      </div>

      <p className="wk-hint">
        Arkusz idzie od poniedziałku do niedzieli — tak wisi w gablocie.
        Intencje zbiorowe dostają osobną stronę, z miejscem na dopiski.
      </p>

      {failed !== null && <p className="wk-error">{failed}</p>}

      <div className="wk-actions">
        <button type="button" className="wk-btn" onClick={() => void print()}>
          Drukuj intencje (A4)
        </button>

        <button
          type="button"
          className="wk-link-btn"
          onClick={() => {
            const next = new Date(`${week.from}T00:00:00`);
            next.setDate(next.getDate() + 7);
            setWeek(sheetWeek(next));
          }}
        >
          następny tydzień
        </button>
      </div>
    </section>
  );
}

export default MassOffice;
