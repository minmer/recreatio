/**
 * Die Kanzlei: Messen anlegen, Intentionen eintippen, den Bogen drucken.
 *
 * <b>Sie hängt am KALENDER, nicht an der Adresse.</b> Eine Messe ist ein
 * Kalendereintrag mit `kind: 'mass'`; welcher Kalender in Frage kommt, sagt
 * `loadCalendars` — und die Liste IST die Berechtigung: dort steht nur, worauf
 * man ein Zertifikat auf den Bereich hat. Wer nichts sieht, darf nichts.
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

import {
  addItem, loadCalendars, REPEAT_LABEL, type CalendarRow, type ItemKind, type RepeatKind
} from './calendar';
import {
  addIntention, CONFESSION, KIND_LABEL, MASS, WEEKDAY_BITS,
  dayKey, dayLabel, firstOnOrAfter, hour, loadOffice, loadPlan, massesOnly, positionInDay,
  updateIntention, type IntentionKind, type OfficeIntention, type OfficeMass
} from './mass';
import { printIntentions, sheetWeek } from './sheet';
import { closeSlot, loadOfficeSlots, openSlot, type OfficeSlot } from './slot';
import { call, WorkspaceError } from './session';

/**
 * Wie weit vorausgeladen wird — zwei Wochen, nicht ein Tag.
 *
 * Wer eintippt, arbeitet weiter voraus als wer liest.
 */
const WINDOW_DAYS = 14;

const todayKey = (): string => dayKey(new Date().toISOString());

/** Der Schlüssel eines Vorkommens: dieselbe Messe kann in zwei Kalendern liegen. */
const keyOf = (mass: OfficeMass): string => `${mass.itemId}-${mass.occurrenceAt}`;

export function MassOffice() {
  const [calendars, setCalendars] = useState<readonly CalendarRow[] | null>(null);
  const [chosen, setChosen] = useState<string>('');
  const [from, setFrom] = useState(todayKey);
  const [masses, setMasses] = useState<readonly OfficeMass[]>([]);
  const [at, setAt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCalendars()
      .then((found) => {
        setCalendars(found.calendars);
        setChosen((current) => (current === '' ? (found.calendars[0]?.calendarId ?? '') : current));
      })
      .catch(() => setCalendars([]));
  }, []);

  const load = useCallback(async () => {
    if (chosen === '') { setMasses([]); return; }

    try {
      const start = new Date(`${from}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + WINDOW_DAYS);

      const found = await loadOffice(chosen, start, end);

      /*
       * Nur Messen. Die Beichte hat keine Intentionen; sie hier zu zeigen wäre
       * eine Einladung, etwas einzutragen, das nirgends vorgelesen wird — und
       * bei Strg+Enter geriete man ungewollt hinein.
       */
      const list = massesOnly(found.masses);
      setMasses(list);
      setAt((current) => Math.min(current, Math.max(0, list.length - 1)));
    } catch (e) {
      setMasses([]);
      setError(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać planu.');
    }
  }, [chosen, from]);

  useEffect(() => { void load(); }, [load]);

  const calendar = (calendars ?? []).find((c) => c.calendarId === chosen);
  const mass = masses[at];

  /*
   * Das Datumsfeld zeigt den Tag der GERADE bearbeiteten Messe, nicht den
   * Anfang des Fensters. Sonst stünde dort noch Sonntag, während man längst den
   * Montag einträgt — und man trüge in dem Glauben ein, es sei noch Sonntag.
   */
  const shownDay = mass === undefined ? from : dayKey(mass.startsAt);

  const goToDay = (wanted: string) => {
    const found = firstOnOrAfter(masses, wanted);
    if (found >= 0) { setAt(found); return; }

    // Ausserhalb des Fensters: neu laden und vorn anfangen.
    setFrom(wanted);
    setAt(0);
  };

  if (calendars === null) return <p className="wk-note">Wczytywanie…</p>;

  /*
   * Kein Kalender heisst hier nicht „leer", sondern „kein Zertyfikat auf żaden
   * obszar". Das ist eine Auskunft über Rechte und keine über Messen — also
   * steht sie so da.
   */
  if (calendars.length === 0) {
    return (
      <p className="wk-note">
        Nie prowadzisz żadnego kalendarza. Kalendarz należy do obszaru — najpierw
        załóż obszar, potem kalendarz w nim.
      </p>
    );
  }

  return (
    <>
      <h3 className="wk-h2">Msze i intencje</h3>

      <div className="wk-mo-top">
        <label className="wk-field">
          <span>Kalendarz</span>
          <select value={chosen} onChange={(e) => { setChosen(e.target.value); setAt(0); }}>
            {calendars.map((c) => (
              <option key={c.calendarId} value={c.calendarId}>
                {c.title} — {c.areaName}
              </option>
            ))}
          </select>
        </label>

        <label className="wk-field">
          <span>Dzień</span>
          <input type="date" value={shownDay} onChange={(e) => goToDay(e.target.value)} />
        </label>

        {masses.length > 0 && (
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
      </div>

      {masses.length === 0 && (
        <p className="wk-note">
          Przez najbliższe dwa tygodnie od tego dnia nie ma żadnej mszy w planie.
          Załóż ją niżej — jeden wpis powtarzający się wystarcza na cały okres.
        </p>
      )}

      {mass !== undefined && (
        <MassEntry
          key={keyOf(mass)}
          mass={mass}
          position={label(masses, at)}
          /* „Weiter" endet am Rand des FENSTERS, nicht des Tages. */
          hasNext={at + 1 < masses.length}
          onNextMass={() => setAt((n) => Math.min(n + 1, masses.length - 1))}
          onChanged={() => void load()}
          onError={setError}
        />
      )}

      {error !== null && <p className="wk-error">{error}</p>}

      <p className="wk-mo-keys">
        <kbd>Enter</kbd> zapisuje i zostaje przy tej mszy ·{' '}
        <kbd>Ctrl</kbd>+<kbd>Enter</kbd> zapisuje i przechodzi do następnej —
        także na następny dzień · <kbd>Esc</kbd> czyści pole
      </p>

      {calendar !== undefined && (
        <>
          <ServiceForm calendar={calendar} onAdded={() => void load()} />

          {/*
            DIE TERMINE STEHEN UNTER DEM ANLEGEN, nicht darüber: wer
            hierherkommt, kommt meistens wegen der Messen. Sie hängen am selben
            Kalender und am selben Fenster — aber an anderer Arbeit, und darum
            in einer eigenen Liste (siehe `Appointments`).
          */}
          <Appointments calendar={calendar} from={shownDay} />

          <PrintSheet calendarId={calendar.calendarId} />
        </>
      )}
    </>
  );
}

/** „2 z 7" — im Tag gezählt, denn so viel bleibt bis zu seinem Ende. */
function label(masses: readonly OfficeMass[], at: number): string {
  const where = positionInDay(masses, at);
  return `${where.at} z ${where.of}`;
}

/* -- Eine Messe mit ihren Intentionen -------------------------------------- */

function MassEntry({ mass, position, hasNext, onNextMass, onChanged, onError }: {
  mass: OfficeMass;
  position: string;
  hasNext: boolean;
  onNextMass: () => void;
  onChanged: () => void;
  onError: (message: string | null) => void;
}) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState<IntentionKind>('single');
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);

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

  const singles = mass.intentions.filter((i) => i.kind === 'single' && i.status !== 'cancelled');

  return (
    <article className="wk-mo-mass">
      <header className="wk-mo-head">
        <strong>{hour(mass.startsAt)}</strong>
        {(mass.title ?? '') !== '' && <span className="wk-mass-title">{mass.title}</span>}
        <span className="wk-row-side">{dayLabel(mass.startsAt)} · {position}</span>
      </header>

      {mass.intentions.length === 0 ? (
        <p className="wk-empty">Bez intencji.</p>
      ) : (
        <ul className="wk-list">
          {mass.intentions.map((one) => (
            <Row key={one.intentionId} intention={one} onChanged={onChanged} onError={onError} />
          ))}
        </ul>
      )}

      {/*
        Zwei einzelne Intentionen heissen zwei Priester. Das ist der Grund, aus
        dem es die Unterscheidung überhaupt gibt — also steht es da.
      */}
      {singles.length > 1 && (
        <p className="wk-mo-need">
          {singles.length} pojedyncze — potrzeba {singles.length} kapłanów.
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
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
        />

        <select
          value={kind}
          disabled={busy}
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
 * Eine Zeile, unmittelbar änderbar.
 *
 * Gespeichert wird beim VERLASSEN des Feldes und nicht bei jedem Anschlag: ein
 * Aufruf je Buchstabe wäre ein Aufruf je Buchstabe.
 */
function Row({ intention, onChanged, onError }: {
  intention: OfficeIntention;
  onChanged: () => void;
  onError: (message: string | null) => void;
}) {
  const [text, setText] = useState(intention.text);
  const [busy, setBusy] = useState(false);
  const cancelled = intention.status === 'cancelled';

  const commit = async () => {
    const value = text.trim();
    if (value === '' || value === intention.text) { setText(intention.text); return; }

    setBusy(true);
    try {
      await updateIntention(intention.intentionId, { text: value });
      onChanged();
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
      setText(intention.text);
    } finally { setBusy(false); }
  };

  const toggle = async () => {
    setBusy(true);
    try {
      await updateIntention(intention.intentionId, {
        status: cancelled ? 'accepted' : 'cancelled'
      });
      onChanged();
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się zmienić.');
    } finally { setBusy(false); }
  };

  return (
    <li className="wk-row wk-mo-int" data-cancelled={cancelled}>
      <input
        type="text"
        value={text}
        maxLength={400}
        disabled={busy || cancelled}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
      />

      <span className="wk-row-side">
        {KIND_LABEL[intention.kind as IntentionKind] ?? intention.kind}
        {' · '}
        <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void toggle()}>
          {cancelled ? 'Przywróć' : 'Wycofaj'}
        </button>
      </span>
    </li>
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
  const [slots, setSlots] = useState<readonly OfficeSlot[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [places, setPlaces] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const start = new Date(`${from}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + WINDOW_DAYS);

      const [plan, open] = await Promise.all([
        loadOffice(calendar.calendarId, start, end, ['appointment']),
        loadOfficeSlots(calendar.calendarId).catch(() => ({ slots: [] as readonly OfficeSlot[] }))
      ]);

      setItems(plan.masses);
      setSlots(open.slots);
      setFailed(null);
    } catch (e) {
      setItems([]);
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać terminów.');
    }
  }, [calendar.calendarId, from]);

  useEffect(() => { void load(); }, [load]);

  const act = async (what: string, todo: () => Promise<unknown>) => {
    setBusy(what);
    setFailed(null);

    try {
      await todo();
      await load();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    } finally {
      setBusy(null);
    }
  };

  if (items.length === 0) {
    return (
      <>
        <h4 className="wk-h2">Terminy</h4>
        {failed !== null && <p className="wk-error">{failed}</p>}
        <p className="wk-empty">
          W tym oknie nie ma żadnego terminu. Załóż go powyżej jako „Termin" —
          potem tutaj otworzysz go na zapisy.
        </p>
      </>
    );
  }

  return (
    <>
      <h4 className="wk-h2">Terminy</h4>

      {failed !== null && <p className="wk-error">{failed}</p>}
      {busy !== null && <p className="wk-hint">{busy}</p>}

      <ul className="wk-list">
        {items.map((one) => {
          /*
            NACH DEM AUGENBLICK, nicht nach der Zeichenfolge. Beide Seiten
            schicken ein `DateTimeOffset`, aber die eine kommt aus der
            Datenbank und die andere wird in der Zeitzone des Kalenders
            gerechnet: `…T10:00:00+01:00` und `…T09:00:00+00:00` sind derselbe
            Augenblick und zwei verschiedene Zeichenfolgen. Verglichen man sie
            als Text, stünde jeder freigegebene Termin hier als „nieotwarty“ —
            und ein zweites Öffnen liefe ins Leere.
          */
          const slot = slots.find(
            (s) => s.itemId === one.itemId
              && new Date(s.occurrenceAt).getTime() === new Date(one.occurrenceAt).getTime());

          const key = `${one.itemId}-${one.occurrenceAt}`;
          const when = new Date(one.startsAt);

          return (
            <li className="wk-row" key={key}>
              <span>
                <strong>
                  {when.toLocaleDateString('pl-PL',
                    { weekday: 'short', day: 'numeric', month: 'long' })}
                  {', '}
                  {when.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                </strong>
                {one.title !== null && <> — {one.title}</>}

                {/*
                  DREI ZUSTÄNDE, und sie sehen verschieden aus: nicht
                  freigegeben, freigegeben mit Platz, voll. Ein „2/4" allein
                  sagte nicht, ob überhaupt jemand buchen darf.
                */}
                {slot === undefined ? (
                  <p className="wk-hint">
                    Nieotwarty — nikt się tu nie zapisze.
                    {' '}
                    <label>
                      Miejsc:{' '}
                      <input
                        type="number" min={1} max={99} style={{ width: '4rem' }}
                        value={places[key] ?? '1'}
                        onChange={(e) => setPlaces({ ...places, [key]: e.target.value })}
                      />
                    </label>
                    {' '}
                    <button
                      type="button" className="wk-link-btn" disabled={busy !== null}
                      onClick={() => void act('Otwieranie…', () => openSlot(
                        one.itemId, one.occurrenceAt,
                        Math.max(1, Number(places[key] ?? '1') || 1)))}
                    >
                      Otwórz na zapisy
                    </button>
                  </p>
                ) : (
                  <p className="wk-hint">
                    <strong>{slot.taken} z {slot.capacity}</strong>
                    {slot.who.length > 0 && <> — {slot.who.join(', ')}</>}
                    {slot.taken === 0 && (
                      <>
                        {' · '}
                        <button
                          type="button" className="wk-link-btn" disabled={busy !== null}
                          onClick={() => void act('Zamykanie…',
                            () => closeSlot(one.itemId, one.occurrenceAt))}
                        >
                          Zamknij zapisy
                        </button>
                      </>
                    )}
                  </p>
                )}

                {/*
                  WER SCHON DRIN SITZT, ENTSCHEIDET MIT. Solange das Fenster
                  läuft, darf er jemanden dazunehmen — durch einen Code oder
                  indem er eine Bitte annimmt. Die Kanzlei soll sehen, dass
                  dieses Fenster offen ist, sonst wundert sie sich, warum ein
                  belegter Termin noch wächst.
                */}
                {slot?.inviteUntil != null && new Date(slot.inviteUntil) > new Date() && (
                  <p className="wk-hint">
                    Do {new Date(slot.inviteUntil).toLocaleString('pl-PL',
                      { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    {' '}zapisany może dobrać kogoś kodem albo przyjąć prośbę.
                  </p>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/* -- Eine Messe anlegen ---------------------------------------------------- */

/** Die Wiederholungen, die für einen Gottesdienst Sinn ergeben. */
const SERVICE_REPEATS: readonly RepeatKind[] = ['none', 'daily', 'weekly', 'monthly'];

function ServiceForm({ calendar, onAdded }: { calendar: CalendarRow; onAdded: () => void }) {
  const [kind, setKind] = useState<ItemKind>(MASS);
  const [date, setDate] = useState(todayKey);
  const [time, setTime] = useState('18:00');
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
  const [roleId, setRoleId] = useState<string | null>(null);

  useEffect(() => {
    call<{ personRoleId: string }>('/workspace/roles')
      .then((graph) => setRoleId(graph.personRoleId))
      .catch(() => setRoleId(null));
  }, []);

  const blocker =
    busy ? null
    : roleId === null ? 'Wczytywanie roli…'
    : date === '' || time === '' ? 'Podaj dzień i godzinę.'
    /*
     * EINE REIHE MUSS EIN ENDE HABEN. Hier gesagt statt als 400 vom Dienst —
     * wer den Knopf grau sieht, soll wissen, was fehlt.
     */
    : repeat !== 'none' && until === '' ? 'Seria musi mieć koniec — podaj ostatni dzień.'
    : null;

  const go = async () => {
    if (roleId === null) return;

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
        titlePublic: title.trim() === '' ? undefined : title.trim(),
        repeat,
        weekdays: repeat === 'weekly' ? weekdays : undefined,
        until: repeat === 'none' ? undefined : until
      });

      setTitle('');
      onAdded();
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
          onChange={(e) => setKind(e.target.value as ItemKind)}
        >
          <option value={MASS}>Msza</option>
          <option value={CONFESSION}>Spowiedź</option>

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
        <span>Nazwa (widoczna w gablocie)</span>
        <input value={title} placeholder="np. Msza św. nowennowa" onChange={(e) => setTitle(e.target.value)} />
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
        czasu. Bez wybranych dni tygodnia obowiązuje dzień pierwszej mszy.
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
