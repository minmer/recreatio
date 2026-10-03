/**
 * DOŁĄCZ — `#/dolacz/<geheimnis>` (0065).
 *
 * <b>Erst sehen, dann entscheiden.</b> Wer den Link öffnet, sieht, wozu er
 * einlädt (Name, Bereiche, Stufe), bevor etwas geschieht. Angemeldet sein
 * muss er erst zum Annehmen — und dann wählt er, ALS WER (eine seiner
 * Personen): der Zugang hängt an einem Menschen, nicht am Konto.
 */

import { useEffect, useState } from 'react';

import { accessWords, linkSecrets, redeemLink, showLink, type LinkInfo } from './linkAccess';
import { loadCalendars } from './calendar';
import { useLinkMe } from './linkMe';
import type { SealedRole } from './keys';
import { forgetKeys, keysFor } from './ringOf';
import { personsOf } from './roles';
import { tilesPath, viewPath } from './routes';
import { WorkspaceError, type Who } from './session';
import { Unlock } from './Unlock';
import type { Ring } from './keys';

/** 0074 — was eine Stufe in einem Bereich heisst, ausführlich. */
const LEVEL_SAYS: Record<string, string> = {
  read: 'czyta (widzi, co jest w obszarze)',
  write: 'pisze (widzi i dopisuje)',
  admin: 'prowadzi (może też wpuszczać innych)'
};

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
        <p className="wk-lede">Masz teraz dostęp: {accessWords(info.areas)}. Działa na każdym urządzeniu, na którym się zalogujesz.</p>
        <div className="wk-actions">
          {info.aim !== null && <a className="wk-btn" href={`#/${info.aim}`}>Przejdź dalej</a>}
          <a className={info.aim !== null ? 'wk-link-btn' : 'wk-btn'} href={viewPath('areas')}>Zobacz obszary</a>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="wk-h1">Zaproszenie{info.label !== null ? `: ${info.label}` : ''}</h1>

      <dl className="wk-facts">
        <div className="wk-fact"><dt>Dostęp</dt><dd><ul className="wk-link-access">{info.areas.length === 0 ? <li>—</li> : info.areas.map((a) => <li key={a.areaId}><strong>{a.name}</strong> — {LEVEL_SAYS[a.capability] ?? a.capability}</li>)}</ul></dd></div>
        <div className="wk-fact"><dt>Ważne do</dt><dd>{new Date(info.expiresAt).toLocaleDateString('pl-PL')}</dd></div>
        {info.once && <div className="wk-fact"><dt>Link</dt><dd>jednorazowy</dd></div>}
        {info.aim !== null && <div className="wk-fact"><dt>Otwiera</dt><dd><a href={`#/${info.aim}`}>recreatio.pl/#/{info.aim}</a></dd></div>}
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

/**
 * Ohne Anmeldung, auf `#/dolacz/<T>`: der Link gilt in diesem Browser schon
 * (`linkKeep`). Diese Seite sagt, WAS er hier gibt und wohin es geht — das
 * Ziel, der Kalender.
 *
 * <b>Kein „dem Konto hinzufügen"</b> (Wunsch 2026-10-03): das wird nur dem
 * angeboten, der angemeldet ist. Vorher stand hier zuerst die Anmeldung, und
 * wer kein Konto hatte, hielt den Link für einen, der ein Konto verlangt. Die
 * Anmeldung bleibt einen Klick entfernt — für den, der schon eines hat; erst
 * danach fragt `JoinLink`, ob der Link ins Konto soll.
 */
export function JoinWithoutAccount({ token, onSignIn }: { token: string | null; onSignIn: () => void }) {
  const [info, setInfo] = useState<LinkInfo | null | undefined>(undefined);
  const me = useLinkMe(true);
  const [calendar, setCalendar] = useState(false);

  useEffect(() => {
    let alive = true;
    if (token === null || token === '') { setInfo(null); return undefined; }
    void linkSecrets(token).then((s) => showLink(s.lookup))
      .then((found) => { if (alive) setInfo(found); }, () => { if (alive) setInfo(null); });
    return () => { alive = false; };
  }, [token]);

  /* Der Kalender — nur, wenn die Bereiche dieses Links einen haben. */
  useEffect(() => {
    if (me == null || info == null) return undefined;
    let alive = true;
    const areas = new Set(info.areas.map((a) => a.areaId));
    loadCalendars()
      .then((got) => got.calendars.some((c) => areas.has(c.areaId) && c.archived !== true), () => false)
      .then((has) => { if (alive) setCalendar(has); });
    return () => { alive = false; };
  }, [me, info]);

  if (info === undefined) return <p className="wk-lede">Sprawdzanie linku…</p>;

  const signIn = (
    <p className="wk-hint">
      Masz konto? <button type="button" className="wk-link-btn" onClick={onSignIn}>Zaloguj się</button>
    </p>
  );

  if (info === null) {
    return (
      <>
        <h1 className="wk-h1">Link z dostępem</h1>
        <p className="wk-error">Takiego linku nie ma — skopiuj go jeszcze raz w całości.</p>
        {signIn}
      </>
    );
  }

  const writes = info.areas.some((a) => a.capability === 'write' || a.capability === 'admin');

  return (
    <>
      <h1 className="wk-h1">Link z dostępem{info.label !== null ? `: ${info.label}` : ''}</h1>

      <dl className="wk-facts">
        <div className="wk-fact"><dt>Dostęp</dt><dd><ul className="wk-link-access">{info.areas.length === 0 ? <li>—</li> : info.areas.map((a) => <li key={a.areaId}><strong>{a.name}</strong> — {LEVEL_SAYS[a.capability] ?? a.capability}</li>)}</ul></dd></div>
        <div className="wk-fact"><dt>Ważny do</dt><dd>{new Date(info.expiresAt).toLocaleDateString('pl-PL')}</dd></div>
      </dl>

      {info.state !== null ? (
        <p className="wk-warn">{STATE_WORD[info.state] ?? 'Ten link już nie działa.'}</p>
      ) : (
        <>
          <p className="wk-lede">
            Działa w tej przeglądarce, bez logowania — na stronach tych obszarów
            {calendar ? <> i w ich kalendarzu{writes ? ', także dopisywanie terminów' : ''}</> : null}.
          </p>
          {(info.aim !== null || calendar) && (
            <div className="wk-actions">
              {info.aim !== null && <a className="wk-btn" href={`#/${info.aim}`}>Otwórz</a>}
              {calendar && <a className={info.aim !== null ? 'wk-btn wk-btn-line' : 'wk-btn'} href={viewPath('calendar')}>Kalendarz</a>}
            </div>
          )}
        </>
      )}

      {signIn}
    </>
  );
}

export default JoinLink;
