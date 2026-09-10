/**
 * 3.9 / 21.8 — Die Anmeldung, wie sie sich anfühlt.
 *
 * Drei Dinge sind hier Absicht und keine Kosmetik:
 *
 *   1. Während Argon2id läuft, steht dort, WARUM es dauert. Eine Sekunde ohne
 *      Rückmeldung liest sich als Fehler; eine Sekunde mit Begründung liest
 *      sich als Sorgfalt. Es ist dieselbe Sekunde.
 *
 *   2. „Sperren" und „Abmelden" stehen nebeneinander und heißen verschieden,
 *      weil sie verschieden sind (3.9). Sperren nimmt den Schlüssel, die
 *      Sitzung bleibt. Abmelden widerruft die Sitzung.
 *
 *   3. Fehler werden über `code` übersetzt, nie über den Text des Servers
 *      (15.7). Der Servertext ist für das Protokoll, nicht für den Menschen.
 */

import { useCallback, useEffect, useState } from 'react';
import { RcPersonPicker, usePersons, useActivePerson } from './RcPersonPicker';
import { rcCopy, rcFormat, type RcLang } from './i18n';
import { RcRequestError } from './lib/rcApi';
import { rcEntryCheck, rcBrowserMemory, type RcEntry } from './lib/rcBoot';
import {
  rcHasUnlockPiece,
  rcLock,
  rcLogout,
  rcMe,
  rcRegister,
  rcUnlock,
  type RcMe as RcMeState
} from './lib/rcAuth';

type Phase = 'idle' | 'deriving' | 'sending';

export interface RcSignInProps {
  readonly lang: RcLang;
  /**
   * Wer hier ist — kommt vom Eintritt und nicht mehr von hier.
   *
   * Diese Auskunft wurde einmal in diesem Bauteil geholt, beim Einhängen.
   * Solange das Formular immer auf der Seite stand, fiel das nicht auf: die
   * Frage wurde bei jedem Aufruf gestellt, weil das Formular bei jedem Aufruf
   * da war. Sobald es hinter einen Knopf wandert, verschwände die Frage mit
   * ihm — und die Kopfleiste wüsste nicht mehr, wen sie vor sich hat. Deshalb
   * steht sie jetzt im Eintritt (`rcBoot.ts`).
   */
  readonly entry: RcEntry<RcMeState>;
  readonly onEntry: (entry: RcEntry<RcMeState>) => void;
  readonly onReady?: (ready: boolean) => void;
}

export function RcSignIn({ lang, entry, onEntry, onReady }: RcSignInProps) {
  /*
   * Die Personen des Kontos. Sie kosten eine Abfrage und lohnen sie nur, wenn
   * jemand angemeldet ist — bei mehr als einer entscheidet die Wahl, wessen
   * Anmeldung eine Pfarrseite spaeter zeigt.
   */
  const signedInNow = entry.kind === 'signed-in' && entry.who?.signedIn === true;
  const persons = usePersons(signedInNow);
  const active = useActivePerson(
    (entry.kind === 'signed-in' ? entry.who?.accountId : null) ?? '', persons);

  const t = rcCopy[lang].auth;
  const tr = rcCopy[lang].route;

  const me = entry.kind === 'signed-in' ? entry.who : null;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  /*
   * ZWEI WEGE, EIN FORMULAR.
   *
   * Vorher lagen Anmelden und Anlegen als gleichwertige Knoepfe nebeneinander,
   * und Anlegen fragte nichts weiter. Genau deshalb hatte die Person, die dabei
   * entsteht, nie einen Namen: es gab keine Stelle, an der jemand danach
   * gefragt haette. Der Server nahm den Anmeldenamen und niemand erfuhr davon.
   *
   * `signUp` macht aus dem zweiten Knopf einen Umschalter. Das ist ein Klick
   * mehr fuer etwas, das man einmal im Leben tut — und dafuer traegt die Person
   * von Anfang an den Namen, unter dem sie danach ueberall auftaucht.
   */
  const [signUp, setSignUp] = useState(false);
  const [personName, setPersonName] = useState('');

  /*
   * ANGEMELDET BLEIBEN.
   *
   * Vorgabe `false`, und das ist eine Entscheidung: was hier gespeichert
   * wird, öffnet das Konto ohne Passwort, solange der Keks gilt. Auf einem
   * geteilten Rechner ist das nicht, was jemand will, der nur kurz etwas
   * nachsehen wollte. Wer es braucht, hakt es an — der Text daneben sagt,
   * was es tut.
   */
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);

  /** Nach jeder Handlung neu fragen — und auf demselben Weg wie beim Eintritt. */
  const refresh = useCallback(async () => {
    onEntry({ kind: 'checking' });
    onEntry(await rcEntryCheck(rcMe, rcBrowserMemory, rcHasUnlockPiece, rcLogout));
  }, [onEntry]);

  /**
   * Der Rückfall aus `rcBoot.ts`: wurde beim Eintritt nicht gefragt, wird es
   * hier nachgeholt — sobald jemand das Formular anfasst, ohne dass er dafür
   * ein zweites Mal drücken muss.
   */
  const wake = useCallback(() => {
    if (entry.kind === 'unasked') void refresh();
  }, [entry.kind, refresh]);

  const describe = (e: unknown): string => {
    if (e instanceof RcRequestError) return t.errors[e.code] ?? t.unknownError;
    return t.unknownError;
  };

  const submit = useCallback(
    async (mode: 'unlock' | 'register') => {
      setError(null);
      setPhase('deriving');
      try {
        // Ein Zwischenbild, bevor der Hauptstrang für eine Sekunde blockiert.
        // Ohne dieses Warten malt der Browser den Zustand „deriving" nie.
        await new Promise((resolve) => setTimeout(resolve, 0));

        if (mode === 'register') await rcRegister(username, password, personName, keepSignedIn);
        else await rcUnlock(username, password, navigator.userAgent.slice(0, 128), keepSignedIn);

        setPassword('');
        await refresh();
      } catch (e) {
        setError(describe(e));
      } finally {
        setPhase('idle');
      }
    },
    [username, password, personName, keepSignedIn, refresh, t]
  );

  const act = useCallback(
    async (what: 'lock' | 'logout') => {
      setPhase('sending');
      try {
        if (what === 'lock') await rcLock();
        else await rcLogout();
        await refresh();
      } catch (e) {
        setError(describe(e));
      } finally {
        setPhase('idle');
      }
    },
    [refresh, t]
  );

  /*
   * WAS WIRKLICH GEBRAUCHT WIRD, IST DAS ÖFFNUNGSSTÜCK — NICHT `keysHeld`.
   *
   * Hier stand `me.keysHeld === true && rcHasUnlockPiece()`, und das hat
   * Menschen ausgesperrt, die alles hatten, was nötig war. `keysHeld` sagt,
   * ob der SERVER den Schlüsselbund noch zwischengespeichert hält. Er läuft
   * nach kurzer Zeit ab — und danach stand hier „gesperrt", obwohl nichts
   * gesperrt war.
   *
   * `RcMasterKey.OpenAsync` braucht den Zwischenspeicher nämlich gar nicht:
   * fehlt er, baut der Server den Wurzelschlüssel aus dem Öffnungsstück und
   * dem versiegelten Schlüssel in der Datenbank neu auf. Das ist derselbe Weg,
   * den der sichere Modus immer geht. Es kostet Zeit und sonst nichts.
   *
   * `keysHeld` ist eine Auskunft über einen Zwischenspeicher und keine
   * Bedingung. Was zählt: bin ich angemeldet, und habe ich das Öffnungsstück.
   */
  /*
   * Zwei Wege zum Öffnungsstück, und der Browser sieht nur einen.
   *
   * `rcHasUnlockPiece()` liest den `sessionStorage` — der stirbt mit dem Tab.
   * Wer „angemeldet bleiben" gewählt hat, trägt es stattdessen in einem
   * `HttpOnly`-Keks, und den kann kein Skript sehen. Deshalb sagt der Server
   * mit `canOpen`, ob dieser Anfrage eines beilag — egal auf welchem Weg.
   */
  const ready = me?.signedIn === true && (rcHasUnlockPiece() || me.canOpen === true);

  useEffect(() => { onReady?.(ready); }, [ready, onReady]);

  if (me?.signedIn) {

    return (
      <div className="rc-auth">
        {/*
          Hier stand die KONTOKENNUNG — „Zalogowano jako 01a0640a-0379-73af…".
          Das ist keine Auskunft, sondern eine Zumutung: es beantwortet die
          Frage „wer bin ich hier" mit einer Zahl, die niemand wiedererkennt.

          Der Anmeldename kommt aus der Sitzung und steht immer zur Verfuegung.
          Der Anzeigename der Person liegt versiegelt an ihrer Rolle und ist
          ohne Schluesselbund NICHT lesbar — deshalb steht hier der
          Anmeldename und nicht der Anzeigename: er ist der, den es in beiden
          Zustaenden wirklich gibt.
        */}
        <p className="rc-auth-who">
          {rcFormat(t.signedInAs, { name: me.username ?? me.accountId ?? '' })}
        </p>
        <p className={ready ? 'rc-auth-ready' : 'rc-auth-locked'}>
          {ready ? t.keysHeld : t.keysMissing}
        </p>

        {/*
          WER MAN GERADE IST — dort, wo auch „Abmelden" steht.

          Nur bei mehr als einer Person; sonst ist es keine Wahl. Ohne
          Schluesselbund erscheint sie ebenfalls nicht: die Namen liegen
          versiegelt an den Rollen, und eine Liste aus Kennungen waere keine
          Hilfe, sondern eine Zumutung.
        */}
        {ready && (
          <RcPersonPicker
            accountId={me.accountId ?? ''}
            persons={persons}
            active={active}
          />
        )}
        <div className="rc-auth-actions">
          <button
            type="button"
            className="rc-btn rc-btn-quiet"
            disabled={phase !== 'idle' || !ready}
            onClick={() => void act('lock')}
          >
            {t.lock}
          </button>
          <button
            type="button"
            className="rc-btn rc-btn-quiet"
            disabled={phase !== 'idle'}
            onClick={() => void act('logout')}
          >
            {t.signOut}
          </button>
        </div>
        {error !== null && <p className="rc-auth-error">{error}</p>}
      </div>
    );
  }

  const busy = phase !== 'idle' || entry.kind === 'checking';
  const canSubmit = username.trim().length >= 3 && password.length > 0 && !busy;

  return (
    <form
      className="rc-auth"
      // Der Rückfall hängt am ERSTEN Anfassen und nicht am Absenden: bis das
      // Passwort getippt ist, ist die Antwort längst da, und wer bereits
      // angemeldet war, sieht es, bevor er seinen Namen eingibt.
      onFocusCapture={wake}
      onPointerDown={wake}
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) void submit(signUp ? 'register' : 'unlock');
      }}
    >
      {signUp && (
        <label className="rc-field">
          <span>{t.personName}</span>
          <input
            type="text"
            autoComplete="name"
            value={personName}
            disabled={busy}
            onChange={(e) => setPersonName(e.target.value)}
          />
          <small className="rc-note">{t.personNameWhy}</small>
        </label>
      )}

      <label className="rc-field">
        <span>{t.username}</span>
        <input
          type="text"
          autoComplete="username"
          value={username}
          disabled={busy}
          onChange={(e) => setUsername(e.target.value)}
        />
      </label>

      <label className="rc-field">
        <span>{t.password}</span>
        <input
          type="password"
          autoComplete={signUp ? 'new-password' : 'current-password'}
          value={password}
          disabled={busy}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      <label className="rc-check">
        <input
          type="checkbox"
          checked={keepSignedIn}
          disabled={busy}
          onChange={(e) => setKeepSignedIn(e.target.checked)}
        />
        <span>
          {t.keepSignedIn}
          <small className="rc-note">{t.keepSignedInWhy}</small>
        </span>
      </label>

      <div className="rc-auth-actions">
        <button type="submit" className="rc-btn" disabled={!canSubmit}>
          {phase === 'deriving'
            ? t.deriving
            : phase === 'sending'
              ? t.working
              : signUp ? t.createAccount : t.signIn}
        </button>
        <button
          type="button"
          className="rc-btn rc-btn-quiet"
          disabled={busy}
          onClick={() => { setSignUp(!signUp); setError(null); }}
        >
          {signUp ? t.haveAccount : t.createAccount}
        </button>
      </div>

      {phase === 'deriving' && <p className="rc-note">{t.derivingWhy}</p>}
      {phase === 'idle' && entry.kind !== 'checking' && <p className="rc-note">{t.signUpHint}</p>}
      {entry.kind === 'checking' && <p className="rc-note">{tr.checking}</p>}

      {/* Ein stummer Dienst ist kein Anmeldefehler und wird auch nicht als
          einer angezeigt — hier steht, was wirklich los ist. */}
      {entry.kind === 'unreachable' && <p className="rc-note">{tr.unreachable}</p>}
      {error !== null && <p className="rc-auth-error">{error}</p>}
    </form>
  );
}

export default RcSignIn;
