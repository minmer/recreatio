/**
 * DOŁĄCZ — `#/dolacz/<geheimnis>` (0065).
 *
 * <b>Erst sehen, dann entscheiden.</b> Wer den Link öffnet, sieht, wozu er
 * einlädt (Name, Bereiche, Stufe), bevor etwas geschieht. Angemeldet sein
 * muss er erst zum Annehmen — und dann wählt er, ALS WER (eine seiner
 * Personen): der Zugang hängt an einem Menschen, nicht am Konto.
 */

import { useEffect, useState } from 'react';

import { LEVEL_WORD, linkSecrets, redeemLink, showLink, type LinkInfo } from './linkAccess';
import type { SealedRole } from './keys';
import { forgetKeys, keysFor } from './ringOf';
import { personsOf } from './roles';
import { tilesPath, viewPath } from './routes';
import { WorkspaceError, type Who } from './session';
import { Unlock } from './Unlock';
import type { Ring } from './keys';

const STATE_WORD: Record<string, string> = {
  revoked: 'Ten link został wyłączony przez osobę, która go utworzyła.',
  expired: 'Ten link wygasł.',
  used: 'Ten link był jednorazowy i ktoś już przez niego dołączył.'
};

export function JoinLink({ token, who }: { token: string | null; who: Who }) {
  const [info, setInfo] = useState<LinkInfo | null | undefined>(undefined);
  const [failed, setFailed] = useState<string | null>(null);
  const [ring, setRing] = useState<Ring | null>(null);
  const [persons, setPersons] = useState<readonly SealedRole[]>([]);
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        if (token === null || token === '') throw new WorkspaceError('W tym linku brakuje zaproszenia.');
        const { lookup } = await linkSecrets(token);
        const found = await showLink(lookup);
        if (alive) setInfo(found);
      } catch (e) {
        if (alive) { setInfo(null); setFailed(e instanceof WorkspaceError ? e.message : 'Takiego zaproszenia nie ma.'); }
      }

      try {
        const keys = await keysFor(who);
        if (!alive) return;
        setRing(keys.ring);
        const own = personsOf(keys.graph);
        setPersons(own);
        if (keys.ring !== null) setNames(await keys.ring.names());
      } catch {
        // Ohne Schlüssel fragt die Ansicht nach dem Passwort.
      }
    })();
    return () => { alive = false; };
  }, [token, who, tick]);

  if (info === undefined) return <p className="wk-lede">Sprawdzanie zaproszenia…</p>;

  if (info === null) {
    return (
      <>
        <h1 className="wk-h1">Zaproszenie</h1>
        <p className="wk-error">{failed}</p>
        <p><a className="wk-link" href={tilesPath()}>Przejdź do warsztatu</a></p>
      </>
    );
  }

  const person = persons.find((p) => p.id === pick) ?? persons[0] ?? null;

  if (done) {
    return (
      <>
        <h1 className="wk-h1">Dołączono</h1>
        <p className="wk-lede">Masz teraz dostęp: {info.areas.map((a) => a.name).join(', ')}.</p>
        <p><a className="wk-btn" href={viewPath('areas')}>Zobacz obszary</a></p>
      </>
    );
  }

  return (
    <>
      <h1 className="wk-h1">Zaproszenie{info.label !== null ? `: ${info.label}` : ''}</h1>

      <dl className="wk-facts">
        <div className="wk-fact"><dt>Dostęp</dt><dd>{LEVEL_WORD[info.capability ?? 'read'] ?? info.capability}</dd></div>
        <div className="wk-fact"><dt>Obszary</dt><dd>{info.areas.map((a) => a.name).join(' · ') || '—'}</dd></div>
        <div className="wk-fact"><dt>Ważne do</dt><dd>{new Date(info.expiresAt).toLocaleDateString('pl-PL')}</dd></div>
        {info.once && <div className="wk-fact"><dt>Link</dt><dd>jednorazowy</dd></div>}
      </dl>

      {info.state !== null ? (
        <p className="wk-warn">{STATE_WORD[info.state] ?? 'Ten link już nie działa.'}</p>
      ) : ring === null ? (
        <Unlock who={who} why="Żeby dołączyć, podaj hasło — klucze otwierają się tylko u Ciebie." onDone={() => { forgetKeys(); setTick((t) => t + 1); }} />
      ) : person === null ? (
        <p className="wk-blocker">Konto nie prowadzi jeszcze żadnej osoby — załóż ją w Rolach, potem wróć do tego linku.</p>
      ) : (
        <form className="wk-form" onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setFailed(null);
          void redeemLink(ring, person, token!, info)
            .then(() => { forgetKeys(); setDone(true); })
            .catch((err) => setFailed(err instanceof WorkspaceError ? err.message : 'Nie udało się dołączyć.'))
            .finally(() => setBusy(false));
        }}>
          {persons.length > 1 && (
            <label className="wk-field">
              <span>Dołączam jako</span>
              <select value={person.id} onChange={(e) => setPick(e.target.value)}>
                {persons.map((p) => <option key={p.id} value={p.id}>{names.get(p.id) ?? p.id.slice(0, 8)}</option>)}
              </select>
            </label>
          )}
          {failed !== null && <p className="wk-error">{failed}</p>}
          <div className="wk-actions">
            <button type="submit" className="wk-btn" disabled={busy}>{busy ? 'Dołączanie…' : 'Dołącz'}</button>
            <a className="wk-link-btn" href={tilesPath()}>Nie teraz</a>
          </div>
        </form>
      )}
    </>
  );
}

export default JoinLink;
