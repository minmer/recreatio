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
import { useT } from '../core/i18n';

import { forgetKeys } from '../core/ringOf';
import { keepsKey, unlock, WorkspaceError, type Who } from '../core/session';
import { PasswordInput } from '../ui/PasswordInput';

export function Unlock({ who, onDone, why }: {
  who: Who;
  onDone: () => void;
  /** Wozu die Schlüssel hier gebraucht werden — der Grund steht am Formular. */
  why: string;
}) {
  const t = useT();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const go = async () => {
    setBusy(true);
    setFailed(null);

    try {
      await unlock(who, password);
      setPassword('');

      // Der Bund wurde ohne Schlüssel gebaut und ist jetzt überholt.
      forgetKeys();
      onDone();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('shell.unlock.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="wk-note" onSubmit={(e) => { e.preventDefault(); if (!busy) void go(); }}>
      {/*
        Der Satz muss zur EINSTELLUNG passen. „Bleibt nur in dieser Karte" wäre
        bei eingeschalteter Verwahrung schlicht falsch — und zwar an der einen
        Stelle, an der ein Mensch sich auf die Auskunft verlässt.
      */}
      <p className="wk-hint">
        {why}{' '}
        {keepsKey(who)
          ? t('shell.unlock.kept')
          : t('shell.unlock.memory')}
      </p>

      <div className="wk-actions">
        <PasswordInput value={password} autoComplete="current-password" placeholder={t('shell.signIn.password')} onChange={setPassword} />
        <button type="submit" className="wk-btn" disabled={busy || password === ''}>
          {busy ? t('shell.unlock.busy') : t('shell.unlock.go')}
        </button>
      </div>

      {failed !== null && <p className="wk-error">{failed}</p>}
    </form>
  );
}

export default Unlock;
