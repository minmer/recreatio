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

import { definePart, flag, text, type RawConfig } from '../part';
import { seatName, useSeats, type SeatView } from '../seatContext';
import { Submission } from '../Submission';

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
  const head = <h2 className="wk-card-title">{title === '' ? fallback : title}</h2>;

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
   * <b>Vorgabe JA.</b> Die Angabe gehört dem Menschen; wer sie festnageln will,
   * soll das ausdrücklich tun.
   */
  readonly mayEdit: boolean;
}

export const seatSubmissionPart = definePart<SubmissionConfig>({
  kind: 'seat-submission',
  label: 'Zgłoszenie osoby',
  use: 'Pokazuje tej osobie to, co sama wysłała.',
  box: { colSpan: 3, rowSpan: 3 },
  takes: true,

  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Twoje zgłoszenie' },
    { key: 'editable', label: 'Czy można poprawiać', kind: 'line', hint: 'tak / nie — puste: tak' }
  ],

  read: (raw: RawConfig): SubmissionConfig => ({
    title: text(raw, 'title'),
    mayEdit: flag(raw, 'editable', true)
  }),

  hasContent: () => true,

  View: ({ config }) => (
    <OnSeat
      title={config.title}
      fallback="Twoje zgłoszenie"
      empty="Tu pojawi się zgłoszenie osoby, która otworzy swój link."
    >
      {(seat) => seat.submitted.length === 0 ? (
        <p className="wk-empty">Jeszcze nic nie wysłano z tego miejsca.</p>
      ) : (
        <Submission
          values={seat.submitted}
          open={seat.opened}
          token={seat.token}
          seatKey={seat.seatKey!}
          mayEdit={config.mayEdit}
          onSaved={seat.reload}
        />
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
