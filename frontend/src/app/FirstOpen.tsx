/**
 * „POTWIERDŹ, ŻE TO TY" — das erste Öffnen eines Links, der fragt (0046).
 *
 * <b>Wozu.</b> Die Kanzlei schickt Links per SMS, und eine Nummer kann falsch
 * sein. Wer einen fremden Link bekommt, soll davon nichts sehen: der Dienst
 * gibt den Platzschlüssel erst heraus, wenn einmal richtig geantwortet wurde.
 * Danach fragt der Link nie wieder.
 *
 * <b>Der Dienst sieht die Antworten nicht.</b> Der Browser rechnet aus ihnen
 * und dem Schlüssel aus dem Link einen Nachweis (`seatCheck.seatProof`); der
 * Dienst vergleicht dessen Abdruck mit dem, den die Kanzlei beim Ausstellen
 * hinterlegt hat.
 */

import { useEffect, useState } from 'react';

import { loadPublicKey } from './area';
import { fromBase64Url } from './crypto';
import { openLabel } from './form';
import { seatProof, verifySeat, type SeatChallenge } from './seatCheck';
import { recall } from './seatKeep';
import { WorkspaceError } from './session';

/** Was dasteht, wenn die Frage selbst nicht aufgeht — nach der Art der Antwort. */
const FALLBACK: Record<string, string> = {
  phone: 'Numer telefonu ze zgłoszenia',
  email: 'Adres e-mail ze zgłoszenia',
  date: 'Data ze zgłoszenia'
};

export function FirstOpen({ token, challenge, who, onPassed }: {
  token: string;
  challenge: SeatChallenge;

  /** Wessen Link — wenn es mehrere gibt, soll man sehen, wofür man antwortet. */
  who?: string | null;
  onPassed: () => void;
}) {
  const questions = challenge.verify.fields;

  const [labels, setLabels] = useState<ReadonlyMap<string, string | null>>(new Map());
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [left, setLeft] = useState(challenge.verify.attemptsLeft);

  /*
   * DIE FRAGEN LESBAR MACHEN — mit dem offenen Schlüssel des Formulars. Das
   * Formular war öffentlich; sonst hätte niemand es ausfüllen können.
   */
  useEffect(() => {
    let alive = true;

    void (async () => {
      const keys = new Map<string, Uint8Array | null>();
      const out = new Map<string, string | null>();

      for (const q of questions) {
        if (!keys.has(q.labelAreaId)) {
          try {
            keys.set(q.labelAreaId, fromBase64Url((await loadPublicKey(q.labelAreaId)).key));
          } catch {
            keys.set(q.labelAreaId, null);
          }
        }

        const key = keys.get(q.labelAreaId) ?? null;
        out.set(q.fieldId, key === null ? null : await openLabel(q.fieldId, q.labelSealed, key));
      }

      if (alive) setLabels(out);
    })();

    return () => { alive = false; };
  }, [questions]);

  const send = async () => {
    const linkKey = recall(token);

    if (linkKey === null) {
      setFailed('W tej przeglądarce nie ma klucza z linku. Otwórz pełny link, który dostałeś, jeszcze raz.');
      return;
    }

    setBusy(true);
    setFailed(null);

    try {
      const proof = await seatProof(linkKey, challenge.seatId,
        questions.map((q) => ({ fieldId: q.fieldId, kind: q.kind, value: answers[q.fieldId] ?? '' })));

      await verifySeat(token, proof);
      onPassed();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się sprawdzić.');
      setLeft((n) => Math.max(0, n - 1));
    } finally {
      setBusy(false);
    }
  };

  if (left <= 0) {
    return (
      <section className="wk-review">
        <h2 className="wk-h2">Ten link jest zablokowany</h2>
        <p className="wk-card-text">
          Było za dużo nieudanych prób potwierdzenia. Jeśli to Twój link, poproś
          kancelarię o nowy — ten już się nie otworzy.
        </p>
      </section>
    );
  }

  const ready = questions.every((q) => (answers[q.fieldId] ?? '').trim() !== '');

  return (
    <section className="wk-review" aria-labelledby={`check-${challenge.seatId}`}>
      <h2 className="wk-h2" id={`check-${challenge.seatId}`}>
        Potwierdź, że to Ty{who === null || who === undefined ? '' : ` — ${who}`}
      </h2>

      <p className="wk-card-text">
        Ten link otwierasz po raz pierwszy. Żeby nikt przypadkowy — na przykład
        ktoś, do kogo SMS trafił pomyłkowo — nie zobaczył Twoich danych, podaj:
      </p>

      <form className="wk-form" onSubmit={(e) => { e.preventDefault(); if (ready) void send(); }}>
        {questions.map((q) => (
          <label className="wk-field" key={q.fieldId}>
            <span>{labels.get(q.fieldId) ?? FALLBACK[q.kind] ?? 'Odpowiedź ze zgłoszenia'}</span>
            <input
              type={q.kind === 'date' ? 'date' : q.kind === 'phone' ? 'tel' : q.kind === 'email' ? 'email' : 'text'}
              autoComplete="off"
              value={answers[q.fieldId] ?? ''}
              disabled={busy}
              onChange={(e) => setAnswers({ ...answers, [q.fieldId]: e.target.value })}
            />
          </label>
        ))}

        <p className="wk-hint">
          Tak, jak w zgłoszeniu — wielkość liter i polskie znaki nie mają znaczenia.
          Wystarczy raz: potem ten link nie będzie już pytał.
        </p>

        {failed !== null && <p className="wk-error">{failed}</p>}

        <div className="wk-actions">
          <button type="submit" className="wk-btn" disabled={busy || !ready}>
            {busy ? 'Sprawdzanie…' : 'Potwierdź'}
          </button>
          {left < 10 && <span className="wk-hint">Zostało prób: {left}</span>}
        </div>
      </form>
    </section>
  );
}
