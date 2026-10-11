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

import type { ReactNode } from 'react';

import { AskSetup } from '../AskSetup';
import { definePart, picked, text, type RawConfig } from '../part';
import { usePerson } from '../pagePerson';
import { SeatTools } from '../SeatBar';
import { seatName, useSeats, type SeatView } from '../seatContext';
import { PageSteps } from '../PageLogicView';
import { usePageLogic } from '../pageLogic';
import { SeatSteps } from '../StepList';
import { SeatAskBody, SeatChatBody } from '../SeatChatView';
import { answerTask, stepsFor, type StepState } from '../steps';
import { OwnSubmissions, ReviewSubmissions } from '../Submission';
import { TaskCard } from '../TaskCard';

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
function OnSeat({ title, fallback, empty, children }: {
  title: string;
  fallback: string;
  empty: string;
  children: (seat: SeatView) => ReactNode;
}) {
  const seats = useSeats();
  const person = usePerson();
  const head = <h2 className="wk-card-title">{title === '' ? fallback : title}</h2>;

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

/* -- Was die Kanzlei ihm geschrieben hat ------------------------------------ */

interface NoteConfig {
  readonly title: string;
}

export const seatNotePart = definePart<NoteConfig>({
  kind: 'seat-note',

  /* 0064 — ein ausgefülltes Beispiel, für die Beschreibung des JSON. */
  example: { title: 'Od kancelarii' },
  label: 'Wiadomość dla osoby',
  use: 'To, co kancelaria napisze tylko do niej.',
  box: { colSpan: 3, rowSpan: 2 },

  fields: [{ key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Od kancelarii' }],

  read: (raw: RawConfig): NoteConfig => ({ title: text(raw, 'title') }),
  hasContent: () => true,
  shows: (_config, size) => size.height === 'strip' ? 'Wiadomość w jednym wierszu, obok nagłówka.' : 'Wiadomość od kancelarii.',

  View: ({ config }) => (
    <OnSeat
      title={config.title}
      fallback="Od kancelarii"
      empty="Tu pojawi się wiadomość, którą kancelaria napisze tej osobie."
    >
      {(seat) => seat.note === null
        ? <p className="wk-empty">Nic tu jeszcze nie napisano.</p>
        : <p className="wk-card-text" style={{ whiteSpace: 'pre-wrap' }}>{seat.note}</p>}
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
  const mapped = logic !== null && logic.logic.nodes.some((node) => node.kind === 'step');
  const head = <h2 className="wk-card-title">{title === '' ? 'Twoje kroki' : title}</h2>;

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
  const rows = seat.forms
    .filter((form) => formId === null || form.formId === formId)
    .flatMap((form) => stepsFor({
      hasSeat: false, confirmedAt: null, extensions: [], filled: new Map(),
      steps: form.steps.filter((s) => s.kind === 'task'), marks: [], tasks: form.tasks, forPerson: true
    }).filter((s) => s.task !== undefined && s.stepId !== null).map((s) => ({ form, s })))
    .sort((a, b) => PHASE_ORDER[a.s.task!.phase] - PHASE_ORDER[b.s.task!.phase] || a.s.task!.plan.startsOn.localeCompare(b.s.task!.plan.startsOn));

  if (rows.length === 0) return <p className="wk-card-muted">Na razie nie ma żadnych zadań.</p>;

  const card = ({ form, s }: (typeof rows)[number]) => (
    <li key={`${form.registrationId}:${s.stepId}`} className="wk-task-item">
      <TaskCard label={s.label} help={s.help} task={s.task!}
        onChange={async (change) => { await answerTask(seat.token, form.registrationId, s.stepId!, change); seat.reload(); }} />
    </li>
  );

  const now = rows.filter((r) => r.s.task!.phase !== 'over');
  const past = rows.filter((r) => r.s.task!.phase === 'over');

  return (
    <div className="wk-tasks" data-seat-tasks="">
      {now.length > 0 ? <ul className="wk-task-list">{now.map(card)}</ul> : <p className="wk-card-muted">Teraz nie ma zadań do zrobienia.</p>}
      {past.length > 0 && (
        <details className="wk-fold">
          <summary>Zakończone ({past.length})</summary>
          <ul className="wk-task-list">{past.map(card)}</ul>
        </details>
      )}
    </div>
  );
}

export const seatTasksPart = definePart<TasksConfig>({
  kind: 'seat-tasks',

  /* 0064 — ein ausgefülltes Beispiel, für die Beschreibung des JSON. */
  example: { title: 'Twoje zadania', form: '<id-formularza>' },
  label: 'Zadania osoby',
  use: 'Zadania na pewien czas (np. różaniec w październiku) — osoba je przyjmuje, pomija albo odmawia i zaznacza dni.',
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
  shows: (_config, size) => size.height === 'strip'
    ? 'Nagłówek i przycisk — zadania rozwijają się po kliknięciu.'
    : 'Zadania osoby na teraz: decyzja i dni wykonania; zakończone zwinięte poniżej.',

  View: ({ config }) => (
    <OnSeat
      title={config.title}
      fallback="Twoje zadania"
      empty="Tu pojawią się zadania osoby, która otworzy swój link."
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
  fullscreen: true,
  shows: (_config, size) => size.height === 'strip'
    ? 'Nagłówek i przycisk — rozmowa rozwija się po kliknięciu.'
    : size.height === 'tall' ? 'Rozmowa z dłuższym widokiem wiadomości.' : 'Rozmowa: ostatnie wiadomości i pole do pisania.',

  View: ({ config }) => (
    <OnSeat
      title={config.title}
      fallback="Rozmowa grupy"
      empty="Tu pojawi się rozmowa grupy — dla osoby, która otworzy swój link."
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
  fullscreen: true,
  shows: (_config, size) => size.height === 'strip'
    ? 'Nagłówek i przycisk — rozmowa rozwija się po kliknięciu.'
    : 'Przycisk „Napisz do: …", a potem rozmowa tej osoby z wybranymi rolami.',

  View: ({ config, ctx }) => (
    <OnSeat
      title={config.title}
      fallback="Napisz do nas"
      empty="Tu osoba, która otworzy swój link, napisze do wybranych osób — tylko one i ona widzą tę rozmowę."
    >
      {(seat) => <SeatAskBody seat={seat} moduleId={ctx.moduleId} />}
    </OnSeat>
  )
});
