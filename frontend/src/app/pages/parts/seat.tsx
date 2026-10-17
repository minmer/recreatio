/**
 * Die drei Bausteine eines PORTALS (0028) — was nur ein Platz füllen kann.
 *
 * <b>Sie standen vorher in einer Verzweigung INNERHALB einer Verzweigung.</b>
 * Die Zeichnung fragte erst „welche Art", landete bei den dreien gemeinsam,
 * und fragte dort noch einmal „welche der drei" — dazwischen zwei Zustände,
 * die für alle drei gelten. Wer einen vierten hinzufügen wollte, musste beide
 * Verzweigungen finden.
 *
 * <b>Was alle drei teilen, steht einmal hier:</b> ohne Platz sagen sie, was
 * hier erscheinen wird; ohne Schlüssel im Link sagen sie, dass er fehlt. Erst
 * danach beginnt der Unterschied.
 *
 * <b>„Ohne Platz" ist kein Fehler.</b> Dieselben Bausteine liegen im Editor auf
 * einer gewöhnlichen Seite, und dort gibt es keinen geöffneten Platz. Leer zu
 * bleiben sähe aus, als wäre etwas kaputt — also steht dort, wozu der Baustein
 * da ist.
 */

import { useEffect, useState, type ReactNode } from 'react';

import { definePart, picked, text, type RawConfig } from '../part';
import { usePerson } from '../pagePerson';
import { seatName, useSeats, type SeatView } from '../../seats/seatContext';
import { PageSteps } from '../PageLogicView';
import { usePageLogic } from '../pageLogic';
import { SeatChatPeek, useShownSeats } from '../../chat/ChatPeek';
import { plural } from '../../core/plural';
import { ChatStep, chatStepStatus } from '../../steps/ChatStep';
import { useSeatChatRows } from '../../seats/seatUnread';
import { answerPresence, answerTask, stepsFor, type StepState } from '../../steps/steps';
import { takenOf } from '../../steps/taskTaken';
import { EntryDeskPanel, WriteToSeat } from '../../forms/officeLazy';
import { deskChanged, formAreasOf, type DeskRow } from '../../forms/entryDesk';
import { useEntrySubject, useOfficeSubject, type EntrySubject } from '../../forms/entrySubject';
import { Loading } from '../../ui/Loading';
import { later } from '../../ui/later';

/*
 * 2026-10-17 — DIE ANSICHTEN DER PLÄTZE ERST, WENN SIE GEZEIGT WERDEN: Kroki,
 * Rozmowy, Zgłoszenie, Zadania, die Kanzlei, der Editor von „Napisz do nas".
 * Eine Seite ohne diese Bausteine (fast jede öffentliche) lud sie alle mit.
 */
const AskSetup = later(() => import('../../chat/AskSetup').then((m) => m.AskSetup));
const SeatTools = later(() => import('../../seats/SeatBar').then((m) => m.SeatTools), null);
const SeatSteps = later(() => import('../../steps/StepList').then((m) => m.SeatSteps));
const PersonSteps = later(() => import('../../steps/StepList').then((m) => m.PersonSteps));
const SeatAskBody = later(() => import('../../chat/SeatChatView').then((m) => m.SeatAskBody));
const SeatChatBody = later(() => import('../../chat/SeatChatView').then((m) => m.SeatChatBody));
const OwnSubmissions = later(() => import('../../forms/Submission').then((m) => m.OwnSubmissions));
const ReviewSubmissions = later(() => import('../../forms/Submission').then((m) => m.ReviewSubmissions));
const TaskCard = later(() => import('../../steps/TaskCard').then((m) => m.TaskCard), null);
const OfficeSeatChats = later(() => import('../../chat/OfficeSeatChats').then((m) => m.OfficeSeatChats));

/*
 * 0104 — DIE SEITE DES KANDYDATEN, VON DER KANZLEI GEÖFFNET.
 *
 * Kommt ein Koordinator aus der „Lista osób" (`?wpis=…&formularz=…`, oder die
 * Seite wählt selbst „osoba z formularza"), zeigen die Bausteine eines Platzes
 * nicht seinen eigenen (er hat keinen: „…nie otworzyła tu żadnego linku"),
 * sondern den GEWÄHLTEN Menschen — so, wie die Kanzlei ihn liest: seine
 * Antworten und Unterformulare (auch „tylko koordynator", hier zu schreiben),
 * seine Schritte und Aufgaben, die Rozmowa mit ihm. Wer mit seinem Link kommt,
 * sieht weiter sich selbst.
 */
function useOfficeView(): EntrySubject | null {
  return useOfficeSubject(useEntrySubject());
}

type OfficeRender = (row: DeskRow, subject: EntrySubject) => ReactNode;

function OfficeView({ head, subject, children }: { head: ReactNode; subject: EntrySubject; children: OfficeRender | undefined }) {
  /* Warum (noch) nichts dasteht, sagt die Leiste oben; hier nur ein Satz. */
  if (subject.desk === null || subject.ring == null) return <>{head}<p className="wk-card-muted">Dane osoby pojawią się po wyborze u góry strony.</p></>;
  if (subject.chosen === null) return <>{head}<p className="wk-card-muted">Wybierz osobę u góry strony.</p></>;
  return (
    <>
      {head}
      <div className="wk-office-view" data-office-view="">
        {children === undefined
          ? <p className="wk-card-muted">Tę część osoba widzi w swoim linku — tu nie ma nic do pokazania o niej.</p>
          : children(subject.chosen, subject)}
      </div>
    </>
  );
}

/** Die Rozmowa „jeden na jeden" mit dem Gewählten — an einem Bereich, oder jede; ohne eine: anfangen. */
function OfficeChats({ row, subject, areaId }: { row: DeskRow; subject: EntrySubject; areaId: string | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  const desk = subject.desk!;
  return (
    <>
      <OfficeSeatChats key={row.s.registrationId} seatId={row.s.seatId} areaId={areaId} ring={subject.ring!}
        fallback={row.s.seatId === null ? null : (
          <div className="wk-actions">
            <WriteToSeat seatId={row.s.seatId} near={formAreasOf(desk)} areas={desk.areas} ring={subject.ring!} busy={false} onError={setFailed} />
          </div>
        )} />
      {failed !== null && <p className="wk-error">{failed}</p>}
    </>
  );
}

/** „Napisz do nas": die Rozmowa an SEINEM Bereich (der Baustein hat einen eigenen). */
function AskOffice({ moduleId, row, subject }: { moduleId: string; row: DeskRow; subject: EntrySubject }) {
  const [areaId, setAreaId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    import('../../workspace/viewData').then((data) => data.modulesNow()).then((all) => { if (alive) setAreaId(all.find((m) => m.moduleId === moduleId)?.areaId ?? null); })
      .catch(() => { if (alive) setAreaId(null); });
    return () => { alive = false; };
  }, [moduleId]);
  if (areaId === undefined) return <Loading label="Wczytywanie rozmowy…" />;
  return <OfficeChats row={row} subject={subject} areaId={areaId} />;
}

/**
 * Die zwei Zustände, die alle drei kennen — und der Inhalt danach.
 *
 * `empty` ist das, was ohne Platz dasteht: eine Ankündigung, kein Fehler.
 *
 * <b>Mehrere Plätze, mehrere Abschnitte.</b> Wer zwei Links geöffnet hat —
 * zwei Kinder, zwei Anmeldungen —, sieht beide, jeden unter seinem Namen.
 * Einer allein steht ohne Namen da, wie bisher: über dem eigenen Zgłoszenie
 * noch einmal den eigenen Namen zu lesen, sagte nichts.
 */
export function OnSeat({ title, fallback, empty, children, office }: {
  title: string;
  fallback: string;
  empty: string;
  children: (seat: SeatView) => ReactNode;
  /** 0104 — was die Kanzlei hier über den oben gewählten Menschen sieht. */
  office?: OfficeRender;
}) {
  const seats = useSeats();
  const person = usePerson();
  const subject = useOfficeView();
  const head = <h2 className="wk-card-title">{title === '' ? fallback : title}</h2>;

  if (subject !== null) return <OfficeView head={head} subject={subject}>{office}</OfficeView>;

  /*
   * AUF EINER SEITE gilt die EINE Wahl von oben (`PersonPicker`): der
   * Gewählte, und nur er. Hier standen vorher alle geöffneten Plätze
   * untereinander, jeder unter seinem Namen.
   */
  if (person !== null) {
    const chosen = person.chosen;

    if (chosen?.kind === 'seat') {
      return <>{head}{chosen.seat.seatKey === null
        ? <p className="wk-card-muted">Bez klucza z adresu nie da się tego otworzyć.</p>
        : children(chosen.seat)}</>;
    }

    return (
      <>
        {head}
        <p className="wk-card-muted">
          {chosen?.kind === 'role'
            ? `Osoba „${chosen.name}" nie otworzyła tu żadnego linku — to, co wysłała z linku, pokaże się po jego otwarciu.`
            : seats.length > 0 ? 'Wybierz u góry strony, za kogo.' : empty}
        </p>
      </>
    );
  }

  if (seats.length === 0) {
    return <>{head}<p className="wk-card-muted">{empty}</p></>;
  }

  const one = (seat: SeatView) => seat.seatKey === null
    ? <p className="wk-card-muted">Bez klucza z adresu nie da się tego otworzyć.</p>
    : children(seat);

  if (seats.length === 1) return <>{head}{one(seats[0])}</>;

  return (
    <>
      {head}
      {seats.map((seat, at) => (
        <section className="wk-seat-one" key={seat.token}>
          <h3 className="wk-seat-who">{seatName(seat, at)}</h3>
          {one(seat)}
        </section>
      ))}
    </>
  );
}

/* -- Was jemand selbst eingeschickt hat ------------------------------------- */

interface SubmissionConfig {
  readonly title: string;

  /**
   * AUS WELCHEM FORMULAR — Pflicht.
   *
   * Ein Platz kann Einsendungen aus mehreren Formularen tragen. Ein Portal
   * der Firmung soll die Anmeldung zur Firmung zeigen und nicht, was derselbe
   * Mensch sonst noch irgendwo ausgefüllt hat. Ohne Angabe zeigt die Kachel
   * vorerst alles, wie bisher — und der Editor sagt, dass sie unfertig ist.
   */
  readonly form: string | null;

  /** WELCHE Antworten — 'all' (auch später hinzugefügte Fragen) oder die genannten. */
  readonly show: 'all' | ReadonlySet<string> | null;
}

export const seatSubmissionPart = definePart<SubmissionConfig>({
  kind: 'seat-submission',

  /* 0064 — ein ausgefülltes Beispiel, für die Beschreibung des JSON. */
  example: { form: '<id-formularza>', show: '*', title: 'Twoje zgłoszenie' },
  label: 'Zgłoszenie osoby',
  use: 'Pokazuje tej osobie to, co sama wysłała w wybranym formularzu.',
  box: { colSpan: 3, rowSpan: 3 },
  takes: true,

  /*
   * Ob eine Antwort berichtigt werden darf, steht NICHT hier, sondern an der
   * Frage (0044) — und dort prüft es der Dienst. Hier stand vorher „Czy można
   * poprawiać: tak / nie", und das galt nur für den Knopf.
   */
  fields: [
    { key: 'form', label: 'Z którego formularza', kind: 'form' },
    { key: 'show', label: 'Które odpowiedzi widać', kind: 'questions', of: 'form' },
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Twoje zgłoszenie' }
  ],

  read: (raw: RawConfig): SubmissionConfig => ({
    title: text(raw, 'title'),
    form: text(raw, 'form') === '' ? null : text(raw, 'form'),
    show: picked(raw, 'show')
  }),

  hasContent: () => true,
  strip: { title: 'Twoje zgłoszenie', open: 'Pokaż zgłoszenie' },
  shows: (_config, size) => size.height === 'strip'
    ? 'Nagłówek i przycisk — zgłoszenie rozwija się po kliknięciu.'
    : 'Wszystkie wybrane odpowiedzi osoby, z możliwością poprawienia.',

  missing: (config) =>
    config.form === null ? 'Wybierz formularz, z którego pochodzą odpowiedzi.'
    : config.show === null ? 'Wybierz, które odpowiedzi ta osoba zobaczy.'
    : null,

  View: ({ config }) => (
    <OnSeat
      title={config.title}
      fallback="Twoje zgłoszenie"
      empty="Tu pojawi się zgłoszenie osoby, która otworzy swój link."
      office={(row, e) => config.form !== null && config.form !== e.formId
        ? <p className="wk-card-muted">Ten moduł pokazuje inny formularz niż ten, z którego wybrano osobę u góry strony.</p>
        : <EntryDeskPanel desk={e.desk!} row={row} ring={e.ring!} sections={['answers', 'extensions']} />}
    >
      {(seat) => (
        <>
          {/*
            0098 — DIE DURCHSICHT GEHÖRT HIERHER, an die Stelle dieses Bausteins:
            solange die Einsendung nicht bestätigt ist, steht hier „Sprawdź swoje
            dane" mit ALLEN Angaben (bestätigt wird das Ganze). Vorher stand sie
            oben auf jeder Seite, auf die der Link führte.
          */}
          {seat.seatKey !== null && seat.submitted.some((v) => v.confirmedAt === null && (config.form === null || v.formId === config.form))
            ? <ReviewSubmissions seat={seat} who={null} formId={config.form} />
            : (
              <OwnSubmissions
                seat={seat}
                formId={config.form}
                show={config.show === 'all' ? null : config.show}
              />
            )}
          <SeatTools seat={seat} />
        </>
      )}
    </OnSeat>
  )
});

/* -- Was die ganze Gruppe sieht --------------------------------------------- */

interface SharedConfig {
  readonly title: string;
}

export const seatSharedPart = definePart<SharedConfig>({
  kind: 'seat-shared',

  /* 0064 — ein ausgefülltes Beispiel, für die Beschreibung des JSON. */
  example: { title: 'Najbliższe spotkania' },
  label: 'Wspólne terminy',
  use: 'Terminy, które widzi cała grupa — jeśli miejsce niesie jej klucz.',
  box: { colSpan: 3, rowSpan: 3 },

  fields: [{ key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Najbliższe spotkania' }],

  read: (raw: RawConfig): SharedConfig => ({ title: text(raw, 'title') }),
  hasContent: () => true,
  strip: { title: 'Wspólne terminy', open: 'Pokaż terminy' },
  shows: (_config, size) => size.height === 'strip'
    ? 'Nagłówek i przycisk — terminy rozwijają się po kliknięciu.'
    : 'Terminy grupy na najbliższe tygodnie.',

  View: ({ config }) => (
    <OnSeat
      title={config.title}
      fallback="Wspólne terminy"
      empty="Tu pojawią się wspólne terminy, jeśli miejsce niesie klucz grupy."
      office={() => <p className="wk-card-muted">Tu osoba widzi wspólne terminy swojej grupy.</p>}
    >
      {(seat) => seat.shared.length === 0 ? (
        <p className="wk-empty">Nic na najbliższe tygodnie.</p>
      ) : (
        <>
          <ul className="wk-card-lines">
            {seat.shared.map((one, i) => (
              <li key={i}>
                <strong>
                  {new Date(one.when).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}
                </strong>
                {' — '}
                {one.what ?? 'zapieczętowane'}
              </li>
            ))}
          </ul>

          {/* Wer es sonst noch sieht. Das gehört dazu: „wspólne" ohne Namen
              ist eine Behauptung. */}
          <p className="wk-hint">Widzą to wszyscy: {seat.sharedNames.join(', ')}.</p>
        </>
      )}
    </OnSeat>
  )
});

/* -- Was er noch tun muss (0047/0048) ------------------------------------------ */

interface StepsConfig {
  readonly title: string;
}

/**
 * „KROKI OSOBY" — die Liste entsteht auf der KARTE DER SEITE (0048): jeder
 * Knoten „Krok" ist eine Zeile, erledigt, wenn gilt, was an seinem Eingang
 * hängt. Der Baustein selbst hat nichts einzustellen ausser der Überschrift.
 *
 * 0099 — OHNE KROKI AUF DER KARTE die Schritte des Formulars selbst: Daten
 * bestätigen, „Uzupełnij: …" (gleich hier auszufüllen), Znaczniki, Zadania —
 * dieselben, die die Kanzlei bei der Person sieht. Vorher stand hier dann
 * „Nie ma tu nic do zrobienia", während die Kanzlei „do zrobienia" las.
 */
function StepsCard({ title }: { title: string }) {
  const person = usePerson();
  const seats = useSeats();
  const logic = usePageLogic();
  const office = useOfficeView();
  const mapped = logic !== null && logic.logic.nodes.some((node) => node.kind === 'step');
  const head = <h2 className="wk-card-title">{title === '' ? 'Twoje kroki' : title}</h2>;

  /* 0104 — die Kanzlei: die Schritte des oben gewählten Menschen, abzuhaken wie in „Osoby". */
  if (office !== null) {
    return (
      <OfficeView head={head} subject={office}>
        {(row, e) => <EntryDeskPanel desk={e.desk!} row={row} ring={e.ring!} sections={['steps']} />}
      </OfficeView>
    );
  }

  /* Die Wahl oben gilt; ohne Wahl (die Ansicht eines Platzes) der eine offene Platz. */
  const seat = person !== null
    ? (person.chosen?.kind === 'seat' ? person.chosen.seat : null)
    : (seats[0] ?? null);

  if (person !== null ? person.chosen === null : seat === null) {
    return (
      <>
        {head}
        <p className="wk-card-muted">
          {seats.length > 0 ? 'Wybierz u góry strony, za kogo.' : 'Tu pojawi się lista kroków osoby, która otworzy swój link.'}
        </p>
      </>
    );
  }

  return <>{head}{mapped || seat === null ? <PageSteps seat={seat} /> : <SeatSteps seat={seat} formId={null} />}</>;
}

export const seatStepsPart = definePart<StepsConfig>({
  kind: 'seat-steps',

  /* 0064 — ein ausgefülltes Beispiel, für die Beschreibung des JSON. */
  example: { title: 'Twoje kroki' },
  label: 'Kroki osoby',
  use: 'Lista kroków osoby — z mapy logiki strony, a bez kroków na mapie: kroki formularza (potwierdzenie danych, uzupełnienia, znaczniki, zadania).',
  box: { colSpan: 3, rowSpan: 3 },

  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Twoje kroki' }
  ],

  read: (raw: RawConfig): StepsConfig => ({ title: text(raw, 'title') }),

  hasContent: () => true,
  strip: { title: 'Twoje kroki', open: 'Pokaż kroki' },
  shows: (_config, size) => size.height === 'strip'
    ? 'Nagłówek i przycisk — kroki rozwijają się po kliknięciu.'
    : 'Lista kroków osoby, z tym, co już zrobione.',

  View: ({ config }) => <StepsCard title={config.title} />
});

/* -- Seine Aufgaben mit Zeitraum (0098) ------------------------------------------ */

interface TasksConfig {
  readonly title: string;

  /** Aus welchem Formular — `null`: aus allen, die der Mensch eingesandt hat. */
  readonly form: string | null;
}

const PHASE_ORDER: Record<NonNullable<StepState['task']>['phase'], number> = { active: 0, upcoming: 1, reporting: 2, over: 3, hidden: 4 };

/**
 * „ZADANIA" — was in einem Zeitraum zu tun ist: die laufenden und kommenden
 * oben, mit przyjmuję / pomijam / odmawiam und den Tagen; die vergangenen
 * zugeklappt darunter.
 */
function SeatTasks({ seat, formId }: { seat: SeatView; formId: string | null }) {
  const forms = seat.forms.filter((form) => formId === null || form.formId === formId);
  const rows = forms
    .flatMap((form) => stepsFor({
      hasSeat: false, confirmedAt: null, extensions: [], filled: new Map(),
      steps: form.steps.filter((s) => s.kind === 'task'), marks: [], tasks: form.tasks, forPerson: true
    }).filter((s) => s.task !== undefined && s.stepId !== null).map((s) => ({ form, s })))
    .sort((a, b) => PHASE_ORDER[a.s.task!.phase] - PHASE_ORDER[b.s.task!.phase] || a.s.task!.plan.startsOn.localeCompare(b.s.task!.plan.startsOn));

  /*
   * 0102 — „PRZECZYTAJ WIADOMOŚCI" steht auch hier, oben: die Kanzlei legt es
   * als Zadanie für die Kandydaci an, und hier schauen sie nach, was zu tun ist.
   */
  const reads = forms.flatMap((form) => stepsFor({
    hasSeat: false, confirmedAt: null, extensions: [], filled: new Map(),
    steps: form.steps.filter((s) => s.kind === 'chat'), marks: form.marks, forPerson: true
  }).map((s) => ({ form, s })));
  const chatRows = useSeatChatRows(reads.length > 0 ? [seat.token] : []);

  if (rows.length === 0 && reads.length === 0) return <p className="wk-card-muted">Na razie nie ma żadnych zadań.</p>;

  const card = ({ form, s }: (typeof rows)[number]) => (
    <li key={`${form.registrationId}:${s.stepId}`} className="wk-task-item">
      <TaskCard label={s.label} help={s.help} task={s.task!} taken={takenOf(form.taken, s.stepId!)}
        onChange={async (change) => { await answerTask(seat.token, form.registrationId, s.stepId!, change); seat.reload(); }}
        onPresence={async (change) => { await answerPresence(seat.token, form.registrationId, s.stepId!, change); seat.reload(); }} />
    </li>
  );

  const now = rows.filter((r) => r.s.task!.phase !== 'over');
  const past = rows.filter((r) => r.s.task!.phase === 'over');
  const readRows = reads.map(({ form, s }) => (
    <li key={`${form.registrationId}:${s.stepId}`} className="wk-task-item">
      <ChatStep seat={seat} step={{ ...s, status: chatStepStatus(s, chatRows) }} />
    </li>
  ));

  return (
    <div className="wk-tasks" data-seat-tasks="">
      {now.length > 0 || readRows.length > 0
        ? <ul className="wk-task-list">{readRows}{now.map(card)}</ul>
        : <p className="wk-card-muted">Teraz nie ma zadań do zrobienia.</p>}
      {past.length > 0 && (
        <details className="wk-fold">
          <summary>Zakończone ({past.length})</summary>
          <ul className="wk-task-list">{past.map(card)}</ul>
        </details>
      )}
    </div>
  );
}

/**
 * 2026-10-17 — ZUGEKLAPPT, WAS WARTET: der Streifen sagte nur „Twoje zadania ·
 * Pokaż zadania". Jetzt steht daneben, wie viele Zadania auf eine Antwort
 * warten (laufend oder kommend, noch nicht erfüllt) — die Zahl, für die man
 * ihn aufklappt.
 */
function SeatTasksPeek({ formId }: { formId: string | null }) {
  const seat = useShownSeats()[0];
  if (seat === undefined) return null;
  const waiting = seat.forms
    .filter((form) => formId === null || form.formId === formId)
    .flatMap((form) => stepsFor({
      hasSeat: false, confirmedAt: null, extensions: [], filled: new Map(),
      steps: form.steps.filter((one) => one.kind === 'task'), marks: [], tasks: form.tasks, forPerson: true
    }))
    .filter((one) => one.task !== undefined && !one.task.fulfilled && (one.task.phase === 'active' || one.task.phase === 'upcoming'))
    .length;
  if (waiting === 0) return null;
  return <span className="wk-card-peek" data-tasks-waiting={waiting}>{waiting} {plural(waiting, 'zadanie czeka', 'zadania czekają', 'zadań czeka')}</span>;
}

export const seatTasksPart = definePart<TasksConfig>({
  kind: 'seat-tasks',

  /* 0064 — ein ausgefülltes Beispiel, für die Beschreibung des JSON. */
  example: { title: 'Twoje zadania', form: '<id-formularza>' },
  label: 'Zadania osoby',
  use: 'Zadania na pewien czas (np. różaniec w październiku) — osoba odpowiada przy każdym dniu w kalendarzu.',
  box: { colSpan: 3, rowSpan: 3 },

  fields: [
    { key: 'form', label: 'Z którego formularza', kind: 'form', optional: true },
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Twoje zadania' }
  ],

  read: (raw: RawConfig): TasksConfig => ({
    title: text(raw, 'title'),
    form: text(raw, 'form') === '' ? null : text(raw, 'form')
  }),

  hasContent: () => true,
  strip: { title: 'Twoje zadania', open: 'Pokaż zadania' },
  peek: ({ config }) => <SeatTasksPeek formId={config.form} />,
  shows: (_config, size) => size.height === 'strip'
    ? 'Nagłówek, ile zadań czeka, i przycisk — zadania rozwijają się po kliknięciu.'
    : 'Zadania osoby na teraz: decyzja i dni wykonania; zakończone zwinięte poniżej.',

  View: ({ config }) => (
    <OnSeat
      title={config.title}
      fallback="Twoje zadania"
      empty="Tu pojawią się zadania osoby, która otworzy swój link."
      office={(row, e) => {
        const tasks = row.states.filter((s) => s.task !== undefined || s.chat !== undefined);
        return tasks.length === 0
          ? <p className="wk-card-muted">Ta osoba nie ma zadań.</p>
          : <PersonSteps registrationId={row.s.registrationId} states={tasks} onChanged={() => deskChanged(e.formId)} onError={() => undefined} />;
      }}
    >
      {(seat) => <SeatTasks seat={seat} formId={config.form} />}
    </OnSeat>
  )
});

/* -- Die Rozmowa seiner Gruppe (0053) ------------------------------------------ */

interface ChatConfig {
  readonly title: string;
}

/**
 * „ROZMOWA GRUPY" — die Rozmowa des Bereichs, in den der Link führt. Wer
 * dort einen Link hat, liest und schreibt mit; welche Rozmowa, sagt sein
 * Platz, nicht der Baustein.
 */
export const seatChatPart = definePart<ChatConfig>({
  kind: 'seat-chat',

  /* 0064 — ein ausgefülltes Beispiel, für die Beschreibung des JSON. */
  example: { title: 'Rozmowa grupy' },
  label: 'Rozmowa grupy',
  use: 'Rozmowy osoby z linkiem: z prowadzącymi, kanały i rozmowy grup, do których należy.',
  box: { colSpan: 3, rowSpan: 5 },

  fields: [{ key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Rozmowa grupy' }],

  read: (raw: RawConfig): ChatConfig => ({ title: text(raw, 'title') }),
  hasContent: () => true,
  /* Eine Rozmowa im Streifen wäre ein Guckloch — dort ein Knopf; sonst der Verlauf, hoch mit mehr davon. */
  strip: { title: 'Rozmowa grupy', open: 'Otwórz rozmowę' },
  /* 0102 — zugeklappt: wie viel Neues in seinen Rozmowy liegt. */
  peek: () => <SeatChatPeek kind="all" />,
  fullscreen: true,
  shows: (_config, size) => size.height === 'strip'
    ? 'Nagłówek i przycisk — rozmowa rozwija się po kliknięciu.'
    : size.height === 'tall' ? 'Rozmowa z dłuższym widokiem wiadomości.' : 'Rozmowa: ostatnie wiadomości i pole do pisania.',

  View: ({ config }) => (
    <OnSeat
      title={config.title}
      fallback="Rozmowa grupy"
      empty="Tu pojawi się rozmowa grupy — dla osoby, która otworzy swój link."
      office={(row, e) => <OfficeChats row={row} subject={e} areaId={null} />}
    >
      {(seat) => <SeatChatBody seat={seat} />}
    </OnSeat>
  )
});

/* -- Er fängt selbst an (0081) ------------------------------------------------------ */

interface AskConfig {
  readonly title: string;
}

/**
 * „NAPISZ DO NAS" — der Mensch mit dem Link fängt die Rozmowa „jeden na
 * jeden" (`audience.ts`, Zugang `one`) selbst an. WER ANTWORTET und AUS
 * WELCHEN FORMULAREN man schreiben darf, steht nicht in der Tafel, sondern am
 * Baustein: sein Bereich mit den gewählten Rollen und seine Formulare
 * (`AskSetup`, `Chat.Ask.cs`). Die anderen aus dem Formular sehen seine
 * Rozmowa nicht.
 */
export const seatAskPart = definePart<AskConfig>({
  kind: 'seat-ask',

  example: { title: 'Napisz do księdza' },
  extra: [{ key: 'title', shape: 'line', says: 'nagłówek; kto odpowiada i z których formularzy można pisać, ustawia się w module (nie w JSON)' }],
  label: 'Napisz do nas',
  use: 'Osoba z linkiem (z wybranych formularzy) sama zaczyna rozmowę z wybranymi rolami — inni z formularza jej nie widzą.',
  box: { colSpan: 3, rowSpan: 5 },

  fields: [],
  Editor: AskSetup,
  ownArea: true,

  read: (raw: RawConfig): AskConfig => ({ title: text(raw, 'title') }),
  hasContent: () => true,
  strip: { title: 'Napisz do nas', open: 'Otwórz rozmowę' },
  /* 0102 — zugeklappt: was die Prowadzący ihm geschrieben haben und er noch nicht las. */
  peek: () => <SeatChatPeek kind="seat" />,
  fullscreen: true,
  shows: (_config, size) => size.height === 'strip'
    ? 'Nagłówek i przycisk — rozmowa rozwija się po kliknięciu.'
    : 'Przycisk „Napisz do: …", a potem rozmowa tej osoby z wybranymi rolami.',

  View: ({ config, ctx }) => (
    <OnSeat
      title={config.title}
      fallback="Napisz do nas"
      empty="Tu osoba, która otworzy swój link, napisze do wybranych osób — tylko one i ona widzą tę rozmowę."
      office={(row, e) => <AskOffice moduleId={ctx.moduleId} row={row} subject={e} />}
    >
      {(seat) => <SeatAskBody seat={seat} moduleId={ctx.moduleId} />}
    </OnSeat>
  )
});
