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
 * <b>Beim Anlegen entstehen ZWEI Rollen, und sie heissen verschieden.</b>
 *
 * <code>
 *   Account   — die Rolle, auf die das Konto zeigt. Generisch benannt, weil
 *               sie kein Mensch ist: sie ist der Schlüsselbund selbst.
 *   &lt;Name&gt;    — der erste MENSCH, von „Account" gehalten.
 * </code>
 *
 * Ohne diese Trennung trüge der Schlüsselbund den Namen einer Person — und wer
 * das Konto später jemand anderem übergibt, übergäbe einen fremden Namen mit.
 *
 * <b>Beide Namen werden HIER gesetzt, nicht am Dienst.</b> Ein Name liegt
 * versiegelt an der Rolle; der Dienst hat dafür keinen Schlüssel und könnte ihn
 * nicht einmal dann schreiben, wenn er wollte.
 */

import { useState } from 'react';

import { forgetKeys, keysFor } from './ringOf';
import { createRole, renameRole } from './roles';
import { register, signIn, WorkspaceError, type Who } from './session';

/**
 * Der Name der Kontorolle — generisch, absichtlich.
 *
 * Sie ist kein Mensch und kein Amt: sie ist das, woran alles andere hängt. Ein
 * persönlicher Name an dieser Stelle wäre eine Behauptung darüber, wem das
 * Konto gehört, und die stimmt spätestens bei der ersten Übergabe nicht mehr.
 */
const ACCOUNT_ROLE_NAME = 'Account';

type Mode = 'in' | 'new';

export function SignIn({ onDone }: { onDone: (who: Who) => void }) {
  const [mode, setMode] = useState<Mode>('in');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [nick, setNick] = useState('');
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
    : mode === 'new' && password.length < 8 ? 'Hasło: co najmniej 8 znaków.'
    : mode === 'new' && nick.trim() === '' ? 'Podaj imię pierwszej osoby.'
    : null;

  /**
   * Was NACH dem Anlegen noch geschieht: die Kontorolle bekommt ihren
   * generischen Namen, und der erste Mensch entsteht.
   *
   * Getrennt vom Anlegen, weil hier bereits ein gültiges Konto steht. Scheitert
   * dieser Teil, ist man trotzdem angemeldet — die Namen lassen sich unter
   * „Role" nachtragen, ein verworfenes Konto liesse sich nicht nachtragen.
   */
  const nameTheRoles = async (who: Who, wanted: string): Promise<void> => {
    const { ring, graph } = await keysFor(who);

    if (ring === null) {
      throw new WorkspaceError('Klucze nie są dostępne w tej karcie.');
    }

    const root = graph.roles.find((r) => r.isPersonal);
    if (root === undefined) {
      throw new WorkspaceError('Konto nie ma jeszcze roli.');
    }

    await renameRole(ring, root.id, ACCOUNT_ROLE_NAME);
    await createRole(ring, root, { kind: 'person', name: wanted });

    // Der Bund kennt den Schlüssel der neuen Rolle sonst nicht.
    forgetKeys();
  };

  const go = async () => {
    // „Liczenie" und nicht „Wczytywanie": es rechnet wirklich, und zwar hier.
    setBusy(mode === 'in' ? 'Liczenie klucza…' : 'Zakładanie konta i kluczy…');
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
      setBusy('Nazywanie roli i zakładanie pierwszej osoby…');

      try {
        await nameTheRoles(who, nick.trim());
      } catch (e) {
        setFailed(e instanceof WorkspaceError
          ? `Konto powstało, ale nie udało się nazwać ról: ${e.message}`
          : 'Konto powstało, ale nie udało się nazwać ról. Dokończ to w zakładce „Role".');
      }

      setNick('');
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
        Der Name des ersten MENSCHEN — nicht der des Kontos. Beim Anmelden wird
        er nicht gefragt: dort gibt es ihn längst.
      */}
      {mode === 'new' && (
        <>
          <label className="wk-field">
            <span>Twoje imię</span>
            <input
              value={nick}
              autoComplete="nickname"
              placeholder="np. Michał"
              onChange={(e) => setNick(e.target.value)}
            />
          </label>

          <p className="wk-hint">
            Konto i człowiek to dwie różne rzeczy. Konto dostaje nazwę
            <code> Account</code> — jest pękiem kluczy, nie osobą. Pod nim
            powstaje pierwsza <strong>osoba</strong> o podanym imieniu; to ona
            później coś prowadzi, należy do grup i pełni funkcje.
          </p>

          <p className="wk-hint">
            Imię jest zapieczętowane Twoim kluczem — usługa go nie zna i nie
            może poznać. Zmienisz je kiedy zechcesz, także wstecz.
          </p>
        </>
      )}

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

      {/*
        Anmelden dauert eine Sekunde, Anlegen deutlich länger: am Dienst
        entstehen zwei RSA-4096-Paare für die Kontorolle, und hier im Browser
        noch zwei für die erste Person. Eine Oberfläche, die das verschweigt,
        sieht in genau dieser Zeit kaputt aus — und wer dann neu lädt, steht
        mitten im Anlegen.
      */}
      {busy !== null && mode === 'new' && (
        <p className="wk-hint">
          Powstają klucze — najpierw konta, potem pierwszej osoby. To potrwa
          kilkanaście sekund. Nie odświeżaj strony.
        </p>
      )}

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
