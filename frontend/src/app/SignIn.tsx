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
 */

import { useState } from 'react';

import { register, signIn, WorkspaceError, type Who } from './session';

type Mode = 'in' | 'new';

export function SignIn({ onDone }: { onDone: (who: Who) => void }) {
  const [mode, setMode] = useState<Mode>('in');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  /*
   * WARUM DER KNOPF GRAU IST — ausgeschrieben.
   *
   * Ein Knopf, der nicht geht und nicht sagt warum, sieht aus wie ein kaputtes
   * Programm. Bei einer Anmeldung ist das besonders teuer: der Mensch davor
   * vermutet dann, sein Konto sei gesperrt.
   */
  const blocker =
    busy !== null ? null
    : loginId.trim() === '' && password === '' ? 'Wpisz nazwę konta i hasło.'
    : loginId.trim() === '' ? 'Wpisz nazwę konta.'
    : password === '' ? 'Wpisz hasło.'
    : mode === 'new' && loginId.trim().length < 3 ? 'Nazwa konta: co najmniej 3 znaki.'
    : mode === 'new' && password.length < 10 ? 'Hasło: co najmniej 10 znaków.'
    : null;

  const go = async () => {
    // „Liczenie" und nicht „Wczytywanie": es rechnet wirklich, und zwar hier.
    setBusy(mode === 'in' ? 'Liczenie klucza…' : 'Zakładanie konta…');
    setFailed(null);

    try {
      const who = mode === 'in'
        ? await signIn(loginId.trim(), password)
        : await register(loginId.trim(), password);

      // Das Passwort bleibt nicht im Speicher der Ansicht liegen.
      setPassword('');
      onDone(who);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zalogować.');
      setBusy(null);
    }
  };

  return (
    <form
      className="wk-signin"
      onSubmit={(e) => { e.preventDefault(); if (blocker === null) void go(); }}
    >
      <h1 className="wk-h1">{mode === 'in' ? 'Zaloguj się' : 'Załóż konto'}</h1>

      <p className="wk-lede">
        Warsztat jest tym, do czego masz klucze — bez zalogowania nie ma tu
        czego pokazać.
      </p>

      <label className="wk-field">
        <span>Nazwa konta</span>
        <input
          value={loginId}
          autoComplete="username"
          autoFocus
          onChange={(e) => setLoginId(e.target.value)}
        />
      </label>

      <label className="wk-field">
        <span>Hasło</span>
        <input
          type="password"
          value={password}
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      {/*
        DAS PASSWORT GEHT NICHT HINAUS — und das gehört gesagt, wo es zutrifft.
        Es ist die eine Eigenschaft dieser Anmeldung, die sie von jeder anderen
        unterscheidet, und niemand liest sie in einer Fussnote nach.
      */}
      <p className="wk-hint">
        Hasło nie opuszcza tego urządzenia. Liczy się z niego klucz i tylko on
        idzie do usługi — dlatego chwilę to trwa.
      </p>

      {failed !== null && <p className="wk-error">{failed}</p>}

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={blocker !== null || busy !== null}>
          {busy ?? (mode === 'in' ? 'Zaloguj' : 'Załóż konto')}
        </button>

        {blocker !== null && busy === null && <span className="wk-blocker">{blocker}</span>}
      </div>

      <p className="wk-swap">
        {mode === 'in' ? (
          <>
            Nie masz jeszcze konta na nowej platformie?{' '}
            <button type="button" className="wk-link-btn" onClick={() => { setMode('new'); setFailed(null); }}>
              Załóż je
            </button>
          </>
        ) : (
          <>
            Masz już konto?{' '}
            <button type="button" className="wk-link-btn" onClick={() => { setMode('in'); setFailed(null); }}>
              Zaloguj się
            </button>
          </>
        )}
      </p>
    </form>
  );
}

export default SignIn;
