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
 *
 * <b>2026-10-29 — „Więcej" → „Import i eksport (JSON)"</b> (`MassesJsonPanel`):
 * ein Monat der Księga intencji auf einmal, mit Plan vor dem Speichern.
 */

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { loadAgenda, openAgenda, restoreOne } from '../calendar/agenda';
import { loadCalendars, type CalendarRow } from '../calendar/calendar';
import { NO_BOOKINGS, sameInstant } from '../calendar/calendarBookings';
import { buildEvents, type CalEvent } from '../calendar/calendarModel';
import { EventDialog } from '../calendar/EventDialog';
import { isMass, SERVICE_LABEL, dayKey, dayLabel, firstOnOrAfter, hour, loadOffice, positionInDay, type OfficeMass } from './mass';
import { loadCalendars as loadAllCalendars, setOccurrence } from '../calendar/calendar';
import { loadAreas, type AreaRow } from '../areas/area';
import { rich, useT, type T } from '../core/i18n';
import { useMe, type Me } from '../core/me';
import { useAreaPeople, type Candidate } from '../calendar/PeoplePicker';
import { viewPath } from '../routes';
import { WorkspaceError, type Who } from '../core/session';
import { useRecent } from '../core/prefs';
import { askText } from '../ui/dialogs';
import { Loading } from '../ui/Loading';
import { MenuButton } from '../ui/Menu';
import { Modal } from '../ui/Modal';
import { WINDOW_DAYS, keyOf, todayKey } from './officeDays';
import { NewCalendar, ServiceForm } from './ServiceForm';
import { MassEntry } from './IntentionEntry';
import { Plan } from './MassPlan';
import { Appointments } from './MassTerms';
import { PrintSheet } from './PrintSheet';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

type OfficeTab = 'intentions' | 'plan' | 'new' | 'terms' | 'print';

/* Welcher Reiter zuletzt offen war — solange die Seite lebt. */
let lastTab: OfficeTab = 'intentions';

/* 2026-10-29 — das JSON erst, wenn jemand es öffnet: die Kanzlei lädt sonst Beschreibung und Planer bei jedem Besuch mit. */
const MassesJsonPanel = lazy(() => import('./MassesJsonPanel'));

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
  const t = useT();
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
  /* 2026-10-29 — „Import i eksport (JSON)" offen. */
  const [json, setJson] = useState(false);
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
      setError(e instanceof WorkspaceError ? e.message : t('masses.office.loadFailed'));
    }
  }, [chosen, from]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setError(e instanceof WorkspaceError ? e.message : t('masses.office.failedWhat', { what }));
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
      setError(t('masses.office.noKeys'));
      return;
    }

    try {
      const start = new Date(one.startsAt);
      const agenda = await loadAgenda(new Date(start.getTime() - 60_000), new Date(start.getTime() + 60_000));
      const opened = await openAgenda(me.ring, agenda.occurrences, areas);
      const event = buildEvents(opened, [], NO_BOOKINGS)
        .find((e) => e.item?.occurrence.itemId === one.itemId && sameInstant(e.item.occurrence.occurrenceAt, one.occurrenceAt));

      if (event === undefined) {
        setError(t('masses.office.notYours'));
        return;
      }
      setEditing(event);
    } catch (e) {
      setError(e instanceof WorkspaceError ? e.message : t('masses.office.openFailed'));
    }
  };

  /** Ein Vorkommen absagen — oder zurückholen. */
  const toggleOne = async (one: OfficeMass) => {
    const when = `${dayLabel(one.startsAt, new Date(), t.lang)} ${hour(one.startsAt)}`;
    const what = SERVICE_LABEL[one.kind] ?? t('masses.office.entry');

    if (one.skipped === true) {
      void act(t('masses.office.restoring'), async () => {
        await restoreOne(one.itemId, one.occurrenceAt);
        setDone(t('masses.office.restored', { what, when }));
      });
      return;
    }

    if (!(await askText(t('masses.office.cancelAsk', { what, when })))) return;
    void act(t('masses.office.cancelling'), async () => {
      await setOccurrence(one.itemId, one.occurrenceAt, { cancelled: true });
      setDone(t('masses.office.cancelled', { what, when }));
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

  if (calendars === null) return <Loading label={t('common.loading')} />;

  /*
   * Kein Kalender heisst hier nicht „leer", sondern „kein Zertyfikat auf żaden
   * obszar". Das ist eine Auskunft über Rechte und keine über Messen — also
   * steht sie so da.
   */
  if (calendars.length === 0) {
    return (
      <>
        <p className="wk-note">
          {t('masses.office.noCalendar')}
        </p>
        <NewCalendar areas={areas} busy={false} onAct={act} />
      </>
    );
  }

  return (
    <>
      {heading && <h3 className="wk-h2">{t('masses.office.title')}</h3>}

      <div className="wk-mo-top">
        <label className="wk-field">
          <span>{t('masses.office.calendar')}</span>
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
          <span>{t('masses.office.day')}</span>
          <input type="date" value={shownDay} onChange={(e) => goToDay(e.target.value)} />
        </label>

        {tab === 'intentions' && masses.length > 0 && (
          <label className="wk-field">
            <span>{t('masses.service.mass')}</span>
            {/* Alle Messen des Fensters, nicht nur die des Tages — Strg+Enter
                geht ohnehin darüber hinaus, und eine Liste, die dazu nicht
                passt, führt in die Irre. */}
            <select value={at} onChange={(e) => setAt(Number(e.target.value))}>
              {masses.map((m, index) => (
                <option key={keyOf(m)} value={index}>
                  {dayLabel(m.startsAt, new Date(), t.lang)} {hour(m.startsAt)}
                  {(m.title ?? '') === '' ? '' : ` — ${m.title}`}
                </option>
              ))}
            </select>
          </label>
        )}

        <a className="wk-link-btn" href={viewPath('calendar', shownDay)}>{t('masses.office.dayInCalendar')}</a>

        <MenuButton label={t('masses.office.moreLabel')} text={t('common.more')} items={[
          { label: t('masses.office.json'), icon: 'braces', onSelect: () => setJson(true) }
        ]} />
      </div>

      <div className="wk-tabs" role="tablist">
        {([
          ['intentions', 'masses.office.tab.intentions'], ['plan', 'masses.office.tab.plan'], ['new', 'masses.office.tab.new'], ['terms', 'masses.office.tab.terms'], ['print', 'masses.office.tab.print']
        ] as const).map(([value, text]) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? 'wk-tab wk-tab-on' : 'wk-tab'}
            onClick={() => setTab(value)}>{t(text)}</button>
        ))}
      </div>

      {error !== null && <p className="wk-error">{error}</p>}
      {done !== null && <p className="wk-done">{done}</p>}

      {tab === 'intentions' && (
        <>
          {masses.length === 0 && (
            <p className="wk-note">
              {t('masses.office.noMasses')}
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
              position={label(masses, at, t)}
              /* „Weiter" endet am Rand des FENSTERS, nicht des Tages. */
              hasNext={at + 1 < masses.length}
              onNextMass={() => setAt((n) => Math.min(n + 1, masses.length - 1))}
              onEdit={() => void edit(mass)}
              onChanged={() => void load()}
              onError={setError}
            />
          )}

          <p className="wk-mo-keys">
            {rich(t('masses.office.keys'), { k: (s) => <kbd>{s}</kbd> })}
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
          onSaved={() => { setDone(t('masses.office.saved')); void load(); }}
        />
      )}

      {json && (
        <Modal title={t('masses.office.jsonTitle')} wide onClose={() => setJson(false)}>
          <Suspense fallback={<Loading />}>
            <MassesJsonPanel
              me={me ?? null} calendars={calendars} areas={areas} chosen={chosen} day={shownDay}
              onChanged={() => void load()}
            />
          </Suspense>
        </Modal>
      )}
    </>
  );
}

/** „2 z 7" — im Tag gezählt, denn so viel bleibt bis zu seinem Ende. */
function label(masses: readonly OfficeMass[], at: number, t: T): string {
  const where = positionInDay(masses, at);
  return t('masses.office.position', { at: where.at, of: where.of });
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

export default MassOffice;
