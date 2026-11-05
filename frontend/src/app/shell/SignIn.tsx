/**
 * Die Anmeldung — das Erste, was man auf dem Arbeitsplatz sieht.
 *
 * <b>Sie wird ANGEBOTEN, nicht angekündigt.</b> Wer hier ankommt und nicht
 * angemeldet ist, bekommt das Formular selbst — nicht einen Satz darüber, dass
 * man sich anmelden müsste, und einen Knopf, der es dann zeigt. Der Zwischen-
 * schritt kostet einen Klick und erklärt nichts.
 *
 * <b>Der teure Lauf wird angesagt.</b> Argon2id mit 64 MiB dauert auf einem
 * Telefon spürbar lange. Eine Oberfläche, die währenddessen still steht, sieht
 * kaputt aus — also sagt sie, was gerade passiert und warum es dauert.
 *
 * <b>Beim Anlegen entstehen ZWEI Rollen, und nur eine hat einen Namen.</b>
 *
 * <code>
 *   Konto     — die Rolle, auf die das Konto zeigt (Art `account`, 0040). Sie
 *               ist kein Mensch, sondern der Schlüsselbund, und hält nur
 *               Personen. Der Dienst legt sie an; sie heisst immer „Konto".
 *   &lt;Name&gt;    — der erste MENSCH, vom Konto gehalten. Er ist es, der
 *               Bereiche, Adressen und Ämter übernimmt.
 * </code>
 *
 * Ohne diese Trennung trüge der Schlüsselbund den Namen einer Person — und wer
 * das Konto später jemand anderem übergibt, übergäbe einen fremden Namen mit.
 *
 * <b>Der Name wird HIER gesetzt, nicht am Dienst.</b> Er liegt versiegelt an
 * der Rolle; der Dienst hat dafür keinen Schlüssel und könnte ihn nicht einmal
 * dann schreiben, wenn er wollte.
 */

import { useState } from 'react';
import { initialLang, langChosen, setAppLang, useT } from '../core/i18n';
import { LangPick } from '../ui/LangPick';

import { forgetKeys, keysFor } from '../core/ringOf';
import { createRole } from '../roles/roles';
import { register, signIn, WorkspaceError, type Who } from '../core/session';
import { PasswordInput } from '../ui/PasswordInput';

type Mode = 'in' | 'new';

export function SignIn({ onDone }: { onDone: (who: Who) => void }) {
  const t = useT();
  const [mode, setMode] = useState<Mode>('in');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [nick, setNick] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  /* 2026-10-16 — was fehlt, sagt die Anmeldung erst nach dem ersten Versuch: rot vor dem ersten Buchstaben sah aus wie ein Fehler. */
  const [tried, setTried] = useState(false);

  /*
   * WARUM DER KNOPF GRAU IST — ausgeschrieben.
   *
   * Ein Knopf, der nicht geht und nicht sagt warum, sieht aus wie ein kaputtes
   * Programm. Bei einer Anmeldung ist das besonders teuer: der Mensch davor
   * vermutet dann, sein Konto sei gesperrt.
   */
  const blocker =
    busy !== null ? null
    : loginId.trim() === '' && password === '' ? t('shell.signIn.needBoth')
    : loginId.trim() === '' ? t('shell.signIn.needLogin')
    : password === '' ? t('shell.signIn.needPassword')
    : mode === 'new' && loginId.trim().length < 3 ? t('shell.signIn.loginShort')
    : mode === 'new' && password.length < 8 ? t('shell.signIn.passwordShort')
    : mode === 'new' && nick.trim() === '' ? t('shell.signIn.needName')
    : null;

  /**
   * Was NACH dem Anlegen noch geschieht: der erste Mensch entsteht, unter dem
   * Konto. Das Konto selbst braucht keinen Namen mehr (0040) — es heisst
   * überall „Konto".
   *
   * Getrennt vom Anlegen, weil hier bereits ein gültiges Konto steht. Scheitert
   * dieser Teil, ist man trotzdem angemeldet — die Namen lassen sich unter
   * „Role" nachtragen, ein verworfenes Konto liesse sich nicht nachtragen.
   */
  const firstPerson = async (who: Who, wanted: string): Promise<void> => {
    const { ring, graph } = await keysFor(who);

    if (ring === null) {
      throw new WorkspaceError(t('shell.signIn.noKeys'));
    }

    const root = graph.roles.find((r) => r.isPersonal);
    if (root === undefined) {
      throw new WorkspaceError(t('shell.signIn.noRole'));
    }

    await createRole(ring, root, { kind: 'person', name: wanted });

    // Der Bund kennt den Schlüssel der neuen Rolle sonst nicht.
    forgetKeys();
  };

  const go = async () => {
    // „Liczenie" und nicht „Wczytywanie": es rechnet wirklich, und zwar hier.
    setBusy(mode === 'in' ? t('shell.unlock.busy') : t('shell.signIn.creating'));
    setFailed(null);

    try {
      if (mode === 'in') {
        const who = await signIn(loginId.trim(), password);
        setPassword('');
        onDone(who);
        return;
      }

      const who = await register(loginId.trim(), password);

      // Das Passwort bleibt nicht im Speicher der Ansicht liegen.
      setPassword('');

      /*
       * AB HIER STEHT DAS KONTO. Ein Fehlschlag darunter darf die Anmeldung
       * nicht zurücknehmen — er wird gezeigt, und man ist trotzdem drin.
       */
      setBusy(t('shell.signIn.creatingPerson'));

      try {
        await firstPerson(who, nick.trim());
      } catch (e) {
        setFailed(e instanceof WorkspaceError
          ? t('shell.signIn.personFailedWhy', { why: e.message })
          : t('shell.signIn.personFailed'));
      }

      setNick('');
      onDone(who);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('shell.signIn.failed'));
      setBusy(null);
    }
  };

  return (
    <form
      className="wk-signin"
      onSubmit={(e) => { e.preventDefault(); setTried(true); if (blocker === null) void go(); }}
      noValidate
    >
      <h1 className="wk-h1">{mode === 'in' ? t('common.signIn') : t('shell.signIn.create')}</h1>

      <p className="wk-lede">
        {mode === 'in' ? t('shell.signIn.ledeIn') : t('shell.signIn.ledeNew')}
      </p>

      <label className="wk-field">
        <span>{t('shell.signIn.login')}</span>
        <input
          value={loginId}
          autoComplete="username"
          autoFocus
          onChange={(e) => setLoginId(e.target.value)}
        />
      </label>

      <label className="wk-field">
        <span>{t('shell.signIn.password')}</span>
        <PasswordInput
          value={password}
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          onChange={setPassword}
        />
      </label>

      {/*
        Der Name des ersten MENSCHEN — nicht der des Kontos. Beim Anmelden wird
        er nicht gefragt: dort gibt es ihn längst.
      */}
      {mode === 'new' && (
        <>
          <label className="wk-field">
            <span>{t('shell.signIn.name')}</span>
            <input
              value={nick}
              autoComplete="nickname"
              placeholder={t('shell.signIn.namePlaceholder')}
              onChange={(e) => setNick(e.target.value)}
            />
          </label>

          <p className="wk-hint">{t('shell.signIn.nameHint')}</p>
        </>
      )}

      {/*
        DAS PASSWORT GEHT NICHT HINAUS — und das gehört gesagt, wo es zutrifft.
        Es ist die eine Eigenschaft dieser Anmeldung, die sie von jeder anderen
        unterscheidet, und niemand liest sie in einer Fussnote nach.
      */}
      <p className="wk-hint">{t('shell.signIn.passwordStays')}</p>

      {failed !== null && <p className="wk-error" role="alert">{failed}</p>}
      {tried && blocker !== null && busy === null && failed === null && <p className="wk-error" role="alert">{blocker}</p>}

      {/*
        Anmelden dauert eine Sekunde, Anlegen deutlich länger: am Dienst
        entstehen zwei RSA-4096-Paare für die Kontorolle, und hier im Browser
        noch zwei für die erste Person. Eine Oberfläche, die das verschweigt,
        sieht in genau dieser Zeit kaputt aus — und wer dann neu lädt, steht
        mitten im Anlegen.
      */}
      {busy !== null && mode === 'new' && (
        <p className="wk-hint">{t('shell.signIn.keysTakeTime')}</p>
      )}

      <div className="wk-actions">
        <button type="submit" className="wk-btn wk-signin-go" disabled={busy !== null}>
          {busy ?? (mode === 'in' ? t('shell.signIn.go') : t('shell.signIn.create'))}
        </button>
      </div>

      <p className="wk-swap">
        {mode === 'in' ? (
          <>
            {t('shell.signIn.noAccount')}{' '}
            <button type="button" className="wk-link-btn" onClick={() => { setMode('new'); setFailed(null); setTried(false); }}>
              {t('shell.signIn.createIt')}
            </button>
          </>
        ) : (
          <>
            {t('shell.signIn.haveAccount')}{' '}
            <button type="button" className="wk-link-btn" onClick={() => { setMode('in'); setFailed(null); setTried(false); }}>
              {t('common.signIn')}
            </button>
          </>
        )}
      </p>

      {/* 2026-11-05 — die Sprache vor der Anmeldung; die Wahl lädt die Seite neu. */}
      <p className="wk-swap wk-lang-line">
        <LangPick className="wk-input wk-lang-pick" value={langChosen() ? initialLang() : null} follow={t('shell.lang.browser')} onChange={setAppLang} />
      </p>
    </form>
  );
}

export default SignIn;
