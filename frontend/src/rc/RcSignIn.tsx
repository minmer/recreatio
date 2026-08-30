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
import { rcCopy, rcFormat, type RcLang } from './i18n';
import { RcRequestError } from './lib/rcApi';
import { rcEntryCheck, type RcEntry } from './lib/rcBoot';
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
  const t = rcCopy[lang].auth;
  const tr = rcCopy[lang].route;

  const me = entry.kind === 'signed-in' ? entry.who : null;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);

  /** Nach jeder Handlung neu fragen — und auf demselben Weg wie beim Eintritt. */
  const refresh = useCallback(async () => {
    onEntry({ kind: 'checking' });
    onEntry(await rcEntryCheck(rcMe));
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

        if (mode === 'register') await rcRegister(username, password);
        else await rcUnlock(username, password, navigator.userAgent.slice(0, 128));

        setPassword('');
        await refresh();
      } catch (e) {
        setError(describe(e));
      } finally {
        setPhase('idle');
      }
    },
    [username, password, refresh, t]
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

  // `keysHeld` kommt vom Server, `rcHasUnlockPiece` aus diesem Tab. Beides
  // muss stimmen: der Server kann den Bund halten, während dieser Tab sein
  // Öffnungsstück verloren hat — dann ist nichts zu lesen.
  const ready = me?.signedIn === true && me.keysHeld === true && rcHasUnlockPiece();

  useEffect(() => { onReady?.(ready); }, [ready, onReady]);

  if (me?.signedIn) {

    return (
      <div className="rc-auth">
        <p className="rc-auth-who">{rcFormat(t.signedInAs, { name: me.accountId ?? '' })}</p>
        <p className={ready ? 'rc-auth-ready' : 'rc-auth-locked'}>
          {ready ? t.keysHeld : t.keysMissing}
        </p>
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
        if (canSubmit) void submit('unlock');
      }}
    >
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
          autoComplete="current-password"
          value={password}
          disabled={busy}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      <div className="rc-auth-actions">
        <button type="submit" className="rc-btn" disabled={!canSubmit}>
          {phase === 'deriving' ? t.deriving : phase === 'sending' ? t.working : t.signIn}
        </button>
        <button
          type="button"
          className="rc-btn rc-btn-quiet"
          disabled={!canSubmit}
          onClick={() => void submit('register')}
        >
          {t.createAccount}
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
