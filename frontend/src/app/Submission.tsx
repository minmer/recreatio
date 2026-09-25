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
 * <b>Ob er eine Antwort ändern darf, sagt die FRAGE</b> (0044), nicht die Seite,
 * auf der sie steht — und der Dienst prüft es. Vorher war es ein Schalter am
 * Baustein, den nur der Knopf kannte.
 *
 * <b>Nur geänderte Felder gehen hinaus.</b> Ein unverändertes noch einmal zu
 * versiegeln hiesse, seinen Schlüssel ohne Grund zu wechseln — und es machte
 * jede Berichtigung zu einer Neuschrift des ganzen Bogens.
 */

import { useState } from 'react';

import { fromBase64Url } from './crypto';
import { reviseSubmission, selfCheck, type OwnAnswer } from './form';
import { loadPublicIntake } from './intake';
import { Phones } from './Phones';
import type { SubmittedValue } from './seat';
import { WorkspaceError } from './session';

/**
 * Welche eigenen Einsendungen ein Portal zeigt — und von jeder welche Antworten.
 *
 * <b>Je Einsendung ein Abschnitt.</b> Ein Platz kann mehrere tragen: zwei
 * Formulare, oder dasselbe zweimal. Vorher lief alles in EINE Liste, und eine
 * Berichtigung ging an die erste Einsendung — auch für eine Antwort aus der
 * zweiten.
 *
 * @param formId Nur Einsendungen aus diesem Formular; `null` heisst: aus allen
 *   (die eingebaute Gestalt des Portals, und ein Baustein, der noch keines nennt).
 * @param show Welche Fragen; `null` heisst: alle.
 */
export function OwnSubmissions({ values, open, token, seatKey, formId, show, onSaved }: {
  values: readonly SubmittedValue[];
  open: readonly OwnAnswer[];
  token: string;
  seatKey: Uint8Array | null;
  formId: string | null;
  show: ReadonlySet<string> | null;
  onSaved: () => void;
}) {
  const shown = (v: { formId: string; fieldId: string }) =>
    (formId === null || v.formId === formId) && (show === null || show.has(v.fieldId));

  const mine = values.filter(shown);
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
            values={these}
            open={open.filter((o) => o.registrationId === registrationId && shown(o))}
            token={token}
            seatKey={seatKey}
            onSaved={onSaved}
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
 * EINE Einsendung — was er eingetragen hat, und der Weg, es zu ändern.
 *
 * `values` und `open` gehören zu derselben Einsendung; `OwnSubmissions` teilt
 * sie so auf.
 */
export function Submission({ values, open, token, seatKey, onSaved }: {
  values: readonly SubmittedValue[];
  open: readonly OwnAnswer[];
  token: string;
  seatKey: Uint8Array | null;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

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

  /** Eine Zeile zum Lesen — die Frage, die Antwort, und bei einer Nummer ihr Zustand. */
  const line = (one: OwnAnswer) => {
    const row = rowOf(one.fieldId);

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
          {!editing && row !== undefined && row.kind === 'phone' && (
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
  };

  if (!editing) {
    return (
      <>
        <dl className="wk-card-lines">{open.map(line)}</dl>

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

        {editable.length > 0 && (
          <div className="wk-actions">
            <button type="button" className="wk-btn" onClick={start}>Popraw dane</button>
          </div>
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
              bleibt eine Auswahl, ein längerer Text ein längerer Text. Ein
              blosses Textfeld an dieser Stelle hiesse, dass eine Berichtigung
              andere Regeln hat als die Eingabe — und der Mensch merkte es erst
              hinterher.
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
