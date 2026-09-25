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

import { definePart, picked, text, type RawConfig } from '../part';
import { usePerson } from '../pagePerson';
import { SeatTools } from '../SeatBar';
import { seatName, useSeats, type SeatView } from '../seatContext';
import { OwnSubmissions } from '../Submission';

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
          <OwnSubmissions
            values={seat.submitted}
            open={seat.opened}
            token={seat.token}
            seatKey={seat.seatKey}
            formId={config.form}
            show={config.show === 'all' ? null : config.show}
            onSaved={seat.reload}
          />
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
  label: 'Wiadomość dla osoby',
  use: 'To, co kancelaria napisze tylko do niej.',
  box: { colSpan: 3, rowSpan: 2 },

  fields: [{ key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Od kancelarii' }],

  read: (raw: RawConfig): NoteConfig => ({ title: text(raw, 'title') }),
  hasContent: () => true,

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
  label: 'Wspólne terminy',
  use: 'Terminy, które widzi cała grupa — jeśli miejsce niesie jej klucz.',
  box: { colSpan: 3, rowSpan: 3 },

  fields: [{ key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Najbliższe spotkania' }],

  read: (raw: RawConfig): SharedConfig => ({ title: text(raw, 'title') }),
  hasContent: () => true,

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
