/**
 * Die Schlüssel zurückholen, ohne sich neu anzumelden.
 *
 * <b>Angemeldet bleibt man.</b> Es geht allein um den PasswordKey, der nur im
 * Speicher dieses Tabs liegt (`session.ts`) und beim Neuladen verschwindet.
 * Ohne ihn sind Rollennamen verschlossen und Zertifikate nicht zu
 * unterschreiben — beides ist ein Zustand, kein Fehler, und wird auch so
 * gesagt.
 */

import { useState } from 'react';

import { forgetKeys } from './ringOf';
import { unlock, WorkspaceError, type Who } from './session';

export function Unlock({ who, onDone, why }: {
  who: Who;
  onDone: () => void;
  /** Wozu die Schlüssel hier gebraucht werden — der Grund steht am Formular. */
  why: string;
}) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const go = async () => {
    setBusy(true);
    setFailed(null);

    try {
      await unlock(who.loginId, password);
      setPassword('');

      // Der Bund wurde ohne Schlüssel gebaut und ist jetzt überholt.
      forgetKeys();
      onDone();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się otworzyć kluczy.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="wk-note" onSubmit={(e) => { e.preventDefault(); if (!busy) void go(); }}>
      <p className="wk-hint">
        {why} Klucz liczy się z hasła i zostaje tylko w tej karcie — po
        odświeżeniu strony trzeba go policzyć jeszcze raz.
      </p>

      <div className="wk-actions">
        <input
          type="password"
          value={password}
          autoComplete="current-password"
          placeholder="Hasło"
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" className="wk-btn" disabled={busy || password === ''}>
          {busy ? 'Liczenie klucza…' : 'Otwórz klucze'}
        </button>
      </div>

      {failed !== null && <p className="wk-error">{failed}</p>}
    </form>
  );
}

export default Unlock;
