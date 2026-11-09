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

import { areaReader } from '../areas/areaRead';
import { openLabel } from '../forms/form';
import { seatProof, verifySeat, type SeatChallenge } from './seatCheck';
import { recall } from './seatKeep';
import { WorkspaceError } from '../core/session';
import { hasKey, useT } from '../core/i18n';

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
  const t = useT();
  /* Was dasteht, wenn die Frage selbst nicht aufgeht — nach der Art der Antwort. */
  const fallback = (kind: string) => (hasKey(`seats.first.fallback.${kind}`) ? t(`seats.first.fallback.${kind}`) : t('seats.first.fallbackAny'));

  /*
   * DIE FRAGEN LESBAR MACHEN — mit dem Schlüssel des Formulars: offengelegt,
   * oder auf einem der Wege, die dieser Browser sonst hat (`areaReader`).
   */
  useEffect(() => {
    let alive = true;

    void (async () => {
      const reader = areaReader();
      const out = new Map<string, string | null>();

      for (const q of questions) {
        const key = await reader.key(q.labelAreaId, q.labelEpoch);
        out.set(q.fieldId, key === undefined ? null : await openLabel(q.fieldId, q.labelSealed, key));
      }

      if (alive) setLabels(out);
    })();

    return () => { alive = false; };
  }, [questions]);

  const send = async () => {
    const linkKey = recall(token);

    if (linkKey === null) {
      setFailed(t('seats.first.noKey'));
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
      setFailed(e instanceof WorkspaceError ? e.message : t('seats.first.checkFailed'));
      setLeft((n) => Math.max(0, n - 1));
    } finally {
      setBusy(false);
    }
  };

  if (left <= 0) {
    return (
      <section className="wk-review">
        <h2 className="wk-h2">{t('seats.first.blocked')}</h2>
        <p className="wk-card-text">{t('seats.first.blockedText')}</p>
      </section>
    );
  }

  const ready = questions.every((q) => (answers[q.fieldId] ?? '').trim() !== '');

  return (
    <section className="wk-review" aria-labelledby={`check-${challenge.seatId}`}>
      <h2 className="wk-h2" id={`check-${challenge.seatId}`}>
        {who === null || who === undefined ? t('seats.first.title') : t('seats.first.titleWho', { who })}
      </h2>

      <p className="wk-card-text">{t('seats.first.lead')}</p>

      <form className="wk-form" onSubmit={(e) => { e.preventDefault(); if (ready) void send(); }}>
        {questions.map((q) => (
          <label className="wk-field" key={q.fieldId}>
            <span>{labels.get(q.fieldId) ?? fallback(q.kind)}</span>
            <input
              type={q.kind === 'date' ? 'date' : q.kind === 'phone' ? 'tel' : q.kind === 'email' ? 'email' : 'text'}
              autoComplete="off"
              value={answers[q.fieldId] ?? ''}
              disabled={busy}
              onChange={(e) => setAnswers({ ...answers, [q.fieldId]: e.target.value })}
            />
          </label>
        ))}

        <p className="wk-hint">{t('seats.first.hint')}</p>

        {failed !== null && <p className="wk-error">{failed}</p>}

        <div className="wk-actions">
          <button type="submit" className="wk-btn" disabled={busy || !ready}>
            {busy ? t('seats.checking') : t('seats.first.confirm')}
          </button>
          {left < 10 && <span className="wk-hint">{t('seats.first.left', { count: left })}</span>}
        </div>
      </form>
    </section>
  );
}
