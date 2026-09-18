/**
 * „Ja, das ist meine Nummer" — ein Handgriff, ohne Konto (0030).
 *
 * <b>Warum ein Link und kein Code.</b> Sonst schickt ein Dienst eine SMS mit
 * einer Ziffernfolge und vergleicht, was zurückkommt. Dieser kann das nicht: die
 * Nummer liegt versiegelt unter dem Annahmeschlüssel, und er hat ihn nie
 * gesehen. Also verschickt die KANZLEI den Link — sie liest die Nummer —, und
 * der Dienst hält nur fest, dass jemand ihn geöffnet hat.
 *
 * <b>Das beweist dasselbe.</b> Wer den Link hat, war unter der Nummer
 * erreichbar, an die er ging. Eine Code-SMS zeigt nicht mehr.
 *
 * <b>Es geschieht beim Öffnen</b> und nicht auf Knopfdruck: wer aus einer SMS
 * hierherkommt, hat schon entschieden. Ein „Bestätigen"-Knopf wäre eine zweite
 * Frage nach derselben Sache.
 */

import { useEffect, useState } from 'react';

import { redeemCheck } from './form';
import { WorkspaceError } from './session';

export function Verify({ token }: { token: string | null }) {
  /** `undefined` = läuft noch, `null` = ging nicht. */
  const [done, setDone] = useState<{ at: string; again: boolean } | null | undefined>(undefined);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (token === null || token.trim() === '') {
      setDone(null);
      setFailed('W adresie brakuje części po ukośniku.');
      return;
    }

    let alive = true;

    void redeemCheck(token)
      .then((r) => { if (alive) setDone({ at: r.at, again: r.again }); })
      .catch((e) => {
        if (!alive) return;
        setDone(null);
        setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
      });

    return () => { alive = false; };
  }, [token]);

  if (done === undefined) return <p className="wk-lede">Sprawdzanie…</p>;

  if (done === null) {
    return (
      <>
        <h1 className="wk-h1">Ten link już nie działa</h1>
        <p className="wk-lede">{failed}</p>
        <p className="wk-hint">
          Napisz do kancelarii — wyśle nowy. Nic się nie stało: ten link tylko
          potwierdzał numer i nic poza tym nie otwierał.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="wk-h1">Numer potwierdzony</h1>

      <p className="wk-lede">
        {done.again
          ? 'Ten numer był już potwierdzony — wszystko jest w porządku.'
          : 'Dziękujemy. Kancelaria widzi teraz, że ten numer działa.'}
      </p>

      {/*
        WAS HIER NICHT PASSIERT IST — kurz und ausdrücklich. Wer auf einen Link
        aus einer SMS tippt, hat ein Recht darauf zu erfahren, was er damit
        ausgelöst hat; „potwierdzone" allein sagt es nicht.
      */}
      <p className="wk-hint">
        Ten link potwierdzał wyłącznie numer telefonu. Nie otwiera Twoich
        danych, niczego nie zmienia i po użyciu nie działa dla nikogo innego.
      </p>
    </>
  );
}

export default Verify;
