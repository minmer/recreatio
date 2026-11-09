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

import { redeemCheck } from '../forms/valueCheck';
import { WorkspaceError } from '../core/session';
import { Loading } from '../ui/Loading';
import { useT } from '../core/i18n';

export function Verify({ token }: { token: string | null }) {
  /** `undefined` = läuft noch, `null` = ging nicht. */
  const [done, setDone] = useState<{ at: string; again: boolean } | null | undefined>(undefined);
  const [failed, setFailed] = useState<string | null>(null);
  const t = useT();

  useEffect(() => {
    if (token === null || token.trim() === '') {
      setDone(null);
      setFailed(t('seats.verify.noToken'));
      return;
    }

    let alive = true;

    void redeemCheck(token)
      .then((r) => { if (alive) setDone({ at: r.at, again: r.again }); })
      .catch((e) => {
        if (!alive) return;
        setDone(null);
        setFailed(e instanceof WorkspaceError ? e.message : t('common.failed'));
      });

    return () => { alive = false; };
  }, [token, t]);

  if (done === undefined) return <Loading label={t('seats.checking')} />;

  if (done === null) {
    return (
      <>
        <h1 className="wk-h1">{t('seats.verify.dead')}</h1>
        <p className="wk-lede">{failed}</p>
        <p className="wk-hint">{t('seats.verify.deadHint')}</p>
      </>
    );
  }

  return (
    <>
      <h1 className="wk-h1">{t('seats.verify.done')}</h1>

      <p className="wk-lede">
        {done.again ? t('seats.verify.again') : t('seats.verify.thanks')}
      </p>

      {/*
        WAS HIER NICHT PASSIERT IST — kurz und ausdrücklich. Wer auf einen Link
        aus einer SMS tippt, hat ein Recht darauf zu erfahren, was er damit
        ausgelöst hat; „potwierdzone" allein sagt es nicht.
      */}
      <p className="wk-hint">{t('seats.verify.only')}</p>
    </>
  );
}

export default Verify;
