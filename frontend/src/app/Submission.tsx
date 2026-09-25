/**
 * Die eigene Einsendung — nachlesen, bestätigen und berichtigen.
 *
 * <b>Sie steht in einer eigenen Datei, weil drei Stellen sie zeichnen:</b> das
 * Portal in seiner eingebauten Gestalt, der Baustein `seat-submission`, den
 * eine Kanzlei selbst auf die Seite legt (0028), und die Durchsicht oben auf
 * der Seite nach dem ersten Öffnen (0046). Dreimal dasselbe zu schreiben
 * hiesse, dass eine Fassung die Verbesserung der anderen nicht mitbekommt.
 *
 * <b>Die Angabe gehört dem Menschen.</b> Ihn für einen Tippfehler in die
 * Kanzlei zu schicken hiesse: sie gehört dem Amt. Also steht der Knopf hier,
 * und die Änderung geht denselben Weg wie die erste Einsendung — ein frischer
 * Schlüssel je Wert, einmal für das Amt verpackt und einmal für ihn selbst.
 *
 * <b>Ob er eine Antwort ändern darf, sagt die FRAGE</b> (0044), nicht die Seite,
 * auf der sie steht — und der Dienst prüft es.
 *
 * <b>Bestätigt wird die GANZE Einsendung auf einmal</b> (0046), nicht jede
 * Nummer für sich: der Mensch sieht alles, was er angegeben hat, und sagt
 * einmal „Wszystko się zgadza". Vorher stand neben jeder Nummer „To mój
 * numer" — und wer eine Nummer bestätigt hatte, hatte die Adresse darunter
 * nie angesehen.
 *
 * <b>Wer etwas ändert, bekommt einen neuen Link</b> (0046). Der alte ist
 * vielleicht an eine Nummer gegangen, die gerade berichtigt wurde — wer ihn
 * dort findet, soll damit nicht mehr hineinkommen.
 */

import { useState } from 'react';

import { fromBase64Url } from './crypto';
import { reviseSubmission, type OwnAnswer } from './form';
import { loadPublicIntake } from './intake';
import { Phones } from './Phones';
import { rotateSeat, seatPath, type SubmittedValue } from './seat';
import { confirmSubmission } from './seatCheck';
import type { SeatView } from './seatContext';
import { forget, markReplaced, underOf } from './seatKeep';
import { WorkspaceError } from './session';

/**
 * Welche eigenen Einsendungen ein Portal zeigt — und von jeder welche Antworten.
 *
 * <b>Je Einsendung ein Abschnitt.</b> Ein Platz kann mehrere tragen: zwei
 * Formulare, oder dasselbe zweimal.
 *
 * @param formId Nur Einsendungen aus diesem Formular; `null` heisst: aus allen
 *   (die eingebaute Gestalt des Portals, und ein Baustein, der noch keines nennt).
 * @param show Welche Fragen; `null` heisst: alle.
 */
export function OwnSubmissions({ seat, formId, show }: {
  seat: SeatView;
  formId: string | null;
  show: ReadonlySet<string> | null;
}) {
  const shown = (v: { formId: string; fieldId: string }) =>
    (formId === null || v.formId === formId) && (show === null || show.has(v.fieldId));

  const mine = seat.submitted.filter(shown);
  const registrations = [...new Set(mine.map((v) => v.registrationId))];

  if (registrations.length === 0) {
    return <p className="wk-empty">Jeszcze nic nie wysłano z tego miejsca.</p>;
  }

  return (
    <>
      {registrations.map((registrationId) => {
        const these = mine.filter((v) => v.registrationId === registrationId);
        const block = (
          <Submission
            key={registrationId}
            seat={seat}
            values={these}
            open={seat.opened.filter((o) => o.registrationId === registrationId && shown(o))}
          />
        );

        if (registrations.length === 1) return block;

        return (
          <section className="wk-seat-one" key={registrationId}>
            <h3 className="wk-seat-who">
              Zgłoszenie z {new Date(these[0].submittedAt).toLocaleDateString('pl-PL',
                { day: 'numeric', month: 'long', year: 'numeric' })}
            </h3>
            {block}
          </section>
        );
      })}
    </>
  );
}

/**
 * DURCHSEHEN, BEVOR ES WEITERGEHT (0046) — oben auf der Seite, solange eine
 * Einsendung dieses Platzes noch nicht bestätigt ist.
 *
 * <b>Alle Angaben, nicht die, die der Baustein darunter zeigt.</b> Die Kanzlei
 * kann auf ihrer Seite nur einen Teil zeigen lassen — bestätigt wird aber das
 * Ganze, und vor allem die Kontakte, auf die sie ihre Nachrichten schickt.
 */
export function ReviewSubmissions({ seat, who }: { seat: SeatView; who: string | null }) {
  if (seat.seatKey === null) return null;

  const waiting = [...new Set(seat.submitted
    .filter((v) => v.confirmedAt === null)
    .map((v) => v.registrationId))];

  if (waiting.length === 0) return null;

  return (
    <section className="wk-review" aria-labelledby={`review-${seat.seatId}`}>
      <h2 className="wk-h2" id={`review-${seat.seatId}`}>
        Sprawdź swoje dane{who === null ? '' : ` — ${who}`}
      </h2>
      <p className="wk-card-text">
        Zanim przejdziesz dalej, przejrzyj wszystko, co jest zapisane w zgłoszeniu —
        <strong> zwłaszcza numery telefonów i adresy e-mail</strong>. Na nie kancelaria
        wysyła wiadomości i linki. Jeśli coś się nie zgadza, popraw to od razu.
      </p>

      {waiting.map((registrationId) => (
        <Submission
          key={registrationId}
          seat={seat}
          values={seat.submitted.filter((v) => v.registrationId === registrationId)}
          open={seat.opened.filter((o) => o.registrationId === registrationId)}
          review
        />
      ))}
    </section>
  );
}

/**
 * EINE Einsendung — was er eingetragen hat, und der Weg, es zu ändern.
 *
 * @param review Die Durchsicht nach dem ersten Öffnen: mit „Wszystko się
 *   zgadza". In einem Baustein steht die Bestätigung nicht — dort ist oft nur
 *   ein Teil der Angaben zu sehen, und bestätigt wird das Ganze.
 */
export function Submission({ seat, values, open, review = false }: {
  seat: SeatView;
  values: readonly SubmittedValue[];
  open: readonly OwnAnswer[];
  review?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const { seatKey } = seat;
  const registrationId = values[0]?.registrationId;
  const confirmedAt = values[0]?.confirmedAt ?? null;

  const rowOf = (fieldId: string) => values.find((v) => v.fieldId === fieldId);

  /* Was er selbst ändern darf — die Frage sagt es (0044), und nur mit dem Schlüssel aus dem Link. */
  const editable = seatKey === null ? [] : open.filter((one) => rowOf(one.fieldId)?.selfEdit === true);
  const fixed = open.filter((one) => !editable.includes(one));

  const start = () => {
    const from: Record<string, string> = {};
    for (const one of editable) from[one.fieldId] = one.value ?? '';

    setDraft(from);
    setFailed(null);
    setEditing(true);
  };

  const changed = editable.filter((one) => (draft[one.fieldId] ?? '') !== (one.value ?? ''));

  /**
   * „Wszystko się zgadza" — einmal für die ganze Einsendung.
   *
   * <b>Danach wird neu geladen</b>, statt den Zustand hier zu erraten: was
   * gilt, sagt der Dienst.
   */
  const confirm = async () => {
    if (registrationId === undefined) return;
    setBusy(true);
    setFailed(null);

    try {
      await confirmSubmission(seat.token, registrationId);
      seat.reload();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się potwierdzić.');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (seatKey === null || registrationId === undefined) return;

    setBusy(true);
    setFailed(null);

    try {
      /*
       * Die öffentliche Annahmehälfte holt sich die Seite selbst — sie kennt
       * den Bereich aus der eigenen Einsendung.
       */
      const intake = await loadPublicIntake(values[0].areaId);

      await reviseSubmission(
        seat.token, registrationId,
        changed.map((one) => ({ fieldId: one.fieldId, value: draft[one.fieldId] ?? '' })),
        { intakePublic: fromBase64Url(intake.publicKey), seatKey });

      setEditing(false);

      /*
       * DER NEUE LINK (0046). Gespeichert ist schon — schlägt nur das hier
       * fehl, bleibt der alte Link gültig, und die Änderung steht trotzdem.
       */
      try {
        const under = underOf(seat.token);
        const next = await rotateSeat(seat.token, seat.seatId, seatKey);

        forget(seat.token);
        markReplaced(next.token);

        /* Über die Adresse, wie jeder Link: sie legt den neuen Schlüssel ab und öffnet die Seite neu. */
        window.location.hash = seatPath(next, under);
        return;
      } catch {
        seat.reload();
      }
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  /** Eine Zeile zum Lesen — die Frage, die Antwort, und bei einer Nummer, ob ein SMS-Link sie bestätigt hat. */
  const line = (one: OwnAnswer) => {
    const row = rowOf(one.fieldId);

    return (
      <div key={one.fieldId}>
        <dt className="wk-row-side">{one.label ?? 'zapieczętowane pytanie'}</dt>
        <dd>
          {one.value ?? 'zapieczętowane'}

          {/*
            NUR, WAS EIN GEKLICKTER LINK BELEGT (0030/0031): dass unter DIESER
            Nummer jemand erreichbar war. Ein eigener Knopf je Nummer steht hier
            nicht mehr — bestätigt wird das Ganze.
          */}
          {row !== undefined && row.kind === 'phone' && row.verifiedAt !== null && row.verifiedWay === 'sms' && (
            <span className="wk-chip-ok" title="Otworzyłeś link, który wysłaliśmy na ten numer">
              {' '}✓ potwierdzony SMS-em
            </span>
          )}
        </dd>
      </div>
    );
  };

  if (!editing) {
    return (
      <>
        <dl className="wk-card-lines">{open.map(line)}</dl>

        {failed !== null && <p className="wk-error">{failed}</p>}

        {review && confirmedAt === null && seatKey !== null ? (
          <>
            <div className="wk-actions">
              <button type="button" className="wk-btn" disabled={busy} onClick={() => void confirm()}>
                {busy ? 'Zapisywanie…' : 'Wszystko się zgadza'}
              </button>
              {editable.length > 0 && (
                <button type="button" className="wk-link-btn" disabled={busy} onClick={start}>
                  Popraw dane
                </button>
              )}
            </div>
            {editable.length > 0 && (
              <p className="wk-hint">
                Po poprawce dostaniesz nowy link — obecny przestanie działać. To
                na wypadek, gdyby trafił pod zły numer.
              </p>
            )}
          </>
        ) : (
          <>
            {confirmedAt !== null && !review && (
              <p className="wk-hint">
                ✓ Dane potwierdzone {new Date(confirmedAt).toLocaleDateString('pl-PL',
                  { day: 'numeric', month: 'long', year: 'numeric' })}.
              </p>
            )}

            {editable.length > 0 && (
              <div className="wk-actions">
                <button type="button" className="wk-btn" onClick={start}>Popraw dane</button>
              </div>
            )}
          </>
        )}
      </>
    );
  }

  return (
    <>
      {editable.map((one) => {
        const kind = rowOf(one.fieldId)?.kind;
        const value = draft[one.fieldId] ?? '';
        const set = (next: string) => setDraft({ ...draft, [one.fieldId]: next });

        return (
          <label className="wk-field" key={one.fieldId}>
            <span>{one.label ?? 'zapieczętowane pytanie'}</span>

            {/*
              Wie im Formular: eine Nummer wird zum Plättchen, eine Auswahl
              bleibt eine Auswahl, ein längerer Text ein längerer Text.
            */}
            {kind === 'phone' ? (
              <Phones value={value} disabled={busy} onChange={set} />
            ) : kind === 'choice' && one.options.length > 0 ? (
              <select value={value} disabled={busy} onChange={(e) => set(e.target.value)}>
                <option value="">—</option>
                {/* Was dasteht, bleibt wählbar — auch wenn die Liste es nicht mehr führt. */}
                {value !== '' && !one.options.includes(value) && <option value={value}>{value}</option>}
                {one.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : kind === 'text' ? (
              <textarea rows={4} value={value} disabled={busy} onChange={(e) => set(e.target.value)} />
            ) : (
              <input
                type={kind === 'date' ? 'date' : kind === 'number' ? 'number'
                  : kind === 'email' ? 'email' : 'text'}
                value={value}
                disabled={busy}
                onChange={(e) => set(e.target.value)}
              />
            )}
          </label>
        );
      })}

      {/* Was er nicht selbst ändern darf, steht daneben — und sagt, wer es kann. */}
      {fixed.length > 0 && (
        <>
          <dl className="wk-card-lines">{fixed.map(line)}</dl>
          <p className="wk-hint">Tych odpowiedzi nie poprawisz sam — w razie potrzeby napisz do kancelarii.</p>
        </>
      )}

      {failed !== null && <p className="wk-error">{failed}</p>}

      <p className="wk-hint">
        Zmiany pieczętujemy w tej przeglądarce. Usługa zapisze je, nie mogąc ich
        odczytać. Po zapisaniu dostaniesz <strong>nowy link</strong> — obecny
        przestanie działać.
      </p>

      <div className="wk-actions">
        <button
          type="button" className="wk-btn"
          disabled={busy || changed.length === 0}
          onClick={() => void save()}
        >
          {busy ? 'Zapisywanie…' : `Zapisz${changed.length > 0 ? ` (${changed.length})` : ''}`}
        </button>

        <button
          type="button" className="wk-link-btn" disabled={busy}
          onClick={() => setEditing(false)}
        >
          Anuluj
        </button>
      </div>
    </>
  );
}
