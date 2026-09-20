/**
 * Die eigene Einsendung — nachlesen und berichtigen.
 *
 * <b>Sie steht in einer eigenen Datei, weil zwei Stellen sie zeichnen:</b> das
 * Portal in seiner eingebauten Gestalt und der Baustein `seat-submission`, den
 * eine Kanzlei selbst auf die Portalvorlage legt (0028). Zweimal dasselbe zu
 * schreiben hiesse, dass die eine Fassung eine Verbesserung der anderen nicht
 * mitbekommt — und die Berichtigung ist genau die Stelle, an der das teuer wäre.
 *
 * <b>Die Angabe gehört dem Menschen.</b> Ihn für einen Tippfehler in die
 * Kanzlei zu schicken hiesse: sie gehört dem Amt. Also steht der Knopf hier,
 * und die Änderung geht denselben Weg wie die erste Einsendung — ein frischer
 * Schlüssel je Wert, einmal für das Amt verpackt und einmal für ihn selbst.
 *
 * <b>Nur geänderte Felder gehen hinaus.</b> Ein unverändertes noch einmal zu
 * versiegeln hiesse, seinen Schlüssel ohne Grund zu wechseln — und es machte
 * jede Berichtigung zu einer Neuschrift des ganzen Bogens.
 */

import { useState } from 'react';

import { fromBase64Url } from './crypto';
import { reviseSubmission, selfCheck } from './form';
import { loadPublicIntake } from './intake';
import { Phones } from './Phones';
import type { SubmittedValue } from './seat';
import { WorkspaceError } from './session';

/**
 * Was er eingetragen hat — und der Weg, es zu ändern.
 *
 * <b>Die Angabe gehört ihm.</b> Ihn für einen Tippfehler in die Kanzlei zu
 * schicken hiesse: sie gehört dem Amt. Also steht der Knopf hier, und die
 * Änderung geht denselben Weg wie die erste Einsendung — ein frischer Schlüssel
 * je Wert, einmal für das Amt verpackt und einmal für ihn selbst.
 *
 * <b>Nur geänderte Felder gehen hinaus.</b> Ein unverändertes noch einmal zu
 * versiegeln hiesse, seinen Schlüssel ohne Grund zu wechseln — und es machte
 * jede Berichtigung zu einer Neuschrift des ganzen Bogens.
 */
export function Submission({ values, open, token, seatKey, mayEdit = true, onSaved }: {
  values: readonly SubmittedValue[];
  open: readonly { fieldId: string; label: string | null; value: string | null }[];
  token: string;
  seatKey: Uint8Array | null;

  /** Die Kanzlei kann das Berichtigen abstellen — die Vorgabe ist JA. */
  mayEdit?: boolean;

  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const start = () => {
    const from: Record<string, string> = {};
    for (const one of open) from[one.fieldId] = one.value ?? '';

    setDraft(from);
    setFailed(null);
    setEditing(true);
  };

  const changed = open.filter((one) => (draft[one.fieldId] ?? '') !== (one.value ?? ''));

  /**
   * „To mój numer" (0031).
   *
   * <b>Es schickt nichts und ändert nichts an der Angabe.</b> Festgehalten
   * wird nur, dass der Mensch sie bestätigt hat — an der STELLE, nicht am
   * Menschen: ein Bogen kann zwei Nummern tragen, und die eine zu bestätigen
   * sagt nichts über die andere.
   *
   * <b>Danach wird neu geladen</b>, statt den Zustand hier zu erraten: was
   * herauskommt, entscheidet der Dienst — er kann melden, dass es die
   * Bestätigung schon gab, und zwar auf dem stärkeren Weg.
   */
  const confirm = async (fieldId: string) => {
    setBusy(true);
    setFailed(null);

    try {
      await selfCheck(token, values[0].registrationId, fieldId);
      onSaved();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się potwierdzić.');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (seatKey === null) return;

    setBusy(true);
    setFailed(null);

    try {
      /*
       * Die öffentliche Annahmehälfte holt sich die Seite selbst — sie kennt
       * den Bereich aus der eigenen Einsendung. Das Formular, auf dem das
       * einmal stand, muss sie dafür nicht kennen.
       */
      const areaId = values[0].areaId;
      const intake = await loadPublicIntake(areaId);

      await reviseSubmission(
        token, values[0].registrationId,
        changed.map((one) => ({ fieldId: one.fieldId, value: draft[one.fieldId] ?? '' })),
        { intakePublic: fromBase64Url(intake.publicKey), seatKey });

      setEditing(false);
      onSaved();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <>
        <dl className="wk-card-lines">
          {open.map((one) => {
            const row = values.find((v) => v.fieldId === one.fieldId);

            return (
              <div key={one.fieldId}>
                <dt className="wk-row-side">{one.label ?? 'zapieczętowane pytanie'}</dt>
                <dd>
                  {one.value ?? 'zapieczętowane'}

                  {/*
                    NEBEN DER NUMMER, nicht in einem eigenen Abschnitt weiter
                    unten. „Ist meine Nummer bestätigt?" ist eine Frage ÜBER
                    DIESE ZEILE, und eine Antwort drei Zeilen tiefer zwingt
                    jeden, sie sich selbst zuzuordnen — bei zwei Nummern
                    (Mutter, Vater) geht das schon nicht mehr auf.
                  */}
                  {row !== undefined && row.kind === 'phone' && (
                    row.verifiedAt !== null ? (
                      <span className="wk-chip-ok" title={
                        row.verifiedWay === 'sms'
                          ? 'Otworzyłeś link, który tu wysłaliśmy'
                          : 'Potwierdziłeś tu, że numer jest aktualny'}>
                        {' '}✓ potwierdzony
                      </span>
                    ) : seatKey !== null && (
                      <>
                        {' '}
                        <button
                          type="button" className="wk-link-btn" disabled={busy}
                          onClick={() => void confirm(one.fieldId)}
                        >
                          To mój numer
                        </button>
                      </>
                    )
                  )}
                </dd>
              </div>
            );
          })}
        </dl>

        {failed !== null && <p className="wk-error">{failed}</p>}

        {/*
          WAS DAS HÄKCHEN HEISST — einmal, unter der Liste. Ein „potwierdzony"
          ohne Erklärung liest sich wie eine Prüfung, die jemand anders
          bestanden hat.
        */}
        {values.some((v) => v.kind === 'phone' && v.verifiedAt === null) && seatKey !== null && (
          <p className="wk-hint">
            Potwierdzenie mówi kancelarii, że numer jest aktualny — nic poza tym
            nie zmienia i niczego nie wysyła.
          </p>
        )}

        {seatKey !== null && mayEdit && (
          <div className="wk-actions">
            <button type="button" className="wk-btn" onClick={start}>Popraw dane</button>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {open.map((one) => {
        const kind = values.find((v) => v.fieldId === one.fieldId)?.kind;

        return (
          <label className="wk-field" key={one.fieldId}>
            <span>{one.label ?? 'zapieczętowane pytanie'}</span>

            {/*
              Eine Nummer wird hier wie im Formular behandelt: Plättchen, und
              das `+48` schreibt die Maschine. Ein blosses Textfeld an dieser
              Stelle hiesse, dass eine Berichtigung andere Regeln hat als die
              Eingabe — und der Mensch merkte es erst hinterher.
            */}
            {kind === 'phone' ? (
              <Phones
                value={draft[one.fieldId] ?? ''}
                disabled={busy}
                onChange={(next) => setDraft({ ...draft, [one.fieldId]: next })}
              />
            ) : (
              <input
                type={kind === 'date' ? 'date' : kind === 'number' ? 'number'
                  : kind === 'email' ? 'email' : 'text'}
                value={draft[one.fieldId] ?? ''}
                disabled={busy}
                onChange={(e) => setDraft({ ...draft, [one.fieldId]: e.target.value })}
              />
            )}
          </label>
        );
      })}

      {failed !== null && <p className="wk-error">{failed}</p>}

      <p className="wk-hint">
        Zmiany pieczętujemy w tej przeglądarce. Usługa zapisze je, nie mogąc ich
        odczytać — otworzy je ta sama kancelaria co poprzednio.
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
