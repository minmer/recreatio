/**
 * „OTWARTO Z LINKU" (0073) — wer über einen Link mit Zugang hereinkam, sieht
 * am Ziel, was er ihm gibt: welche Bereiche, welche Stufe, und dass es in
 * diesem Browser gilt.
 *
 * <b>Dem Konto hinzufügen</b> ist der zweite Schritt, kein Muss: lesen geht
 * schon im Browser; schreiben, und derselbe Zugang auf jedem Gerät, gehen
 * mit dem Konto (`#/dolacz/<T>`, dort wird angemeldet, gewählt, eingelöst).
 */

import { useEffect, useState } from 'react';

import { accessWords, heldLinkKeys, type HeldInfo } from './linkAccess';
import { dismissFresh, forgetLink, freshLink, heldLinks } from './linkKeep';
import { keysFor } from './ringOf';
import { whoIsThere, type Who } from './session';

/** Ein Stempel der Links in diesem Browser — ändert sich, sobald einer dazukommt oder geht (auch in einem anderen Tab). */
export function useHeldLinksStamp(): string {
  const stamp = () => heldLinks().map((h) => h.token).sort().join(',');
  const [now, setNow] = useState(stamp);
  useEffect(() => {
    const changed = () => setNow(stamp());
    window.addEventListener('recreatio:links-changed', changed);
    window.addEventListener('storage', changed);
    return () => {
      window.removeEventListener('recreatio:links-changed', changed);
      window.removeEventListener('storage', changed);
    };
  }, []);
  return now;
}

export const describeLink = (info: NonNullable<HeldInfo['info']>): string =>
  accessWords(info.areas);

export function HeldLinkBar({ who }: { who?: Who }) {
  const [arrived, setArrived] = useState(freshLink);

  /* Auch ein Link, der in einen schon offenen Tab kommt (die Adresse wechselt nur hinter der Raute). */
  useEffect(() => {
    const look = () => { const now = freshLink(); if (now !== null) setArrived((was) => (was?.token === now.token ? was : now)); };
    /* Weiter weg vom Ziel: die Leiste hat gesagt, was sie zu sagen hatte. */
    const moved = () => {
      const now = freshLink();
      if (now === null) return;
      if (now.aim !== null && window.location.hash.replace(/^#\/?/, '') !== now.aim) { dismissFresh(); setArrived(null); return; }
      look();
    };
    window.addEventListener('recreatio:links-changed', look);
    window.addEventListener('hashchange', moved);
    return () => {
      window.removeEventListener('recreatio:links-changed', look);
      window.removeEventListener('hashchange', moved);
    };
  }, []);
  const [held, setHeld] = useState<HeldInfo | null | undefined>(undefined);
  const [owned, setOwned] = useState(false);

  useEffect(() => {
    if (arrived === null) return undefined;
    let alive = true;
    setHeld(undefined);
    setOwned(false);
    void (async () => {
      try {
        const keys = await heldLinkKeys();
        const mine = keys.links.find((l) => l.token === arrived.token) ?? null;
        if (!alive) return;
        setHeld(mine);
        /* Schon im Konto? Dann ist der Knopf überflüssig. */
        const me = who ?? await whoIsThere().catch(() => null);
        if (me !== null && mine?.info != null) {
          const ring = (await keysFor(me).catch(() => null))?.ring ?? null;
          if (alive && ring !== null && ring.has(mine.info.roleId)) setOwned(true);
        }
      } catch {
        if (alive) setHeld(null);
      }
    })();
    return () => { alive = false; };
  }, [arrived, who]);

  if (arrived === null || held === undefined) return null;

  const close = () => { dismissFresh(); setArrived(null); };
  const info = held?.info ?? null;

  return (
    <aside className={`wk-heldlink${info === null ? ' is-dead' : ''}`} role="status" aria-label="Link z dostępem">
      {info === null ? (
        <>
          <p>Ten link z dostępem już nie działa — został wyłączony, wygasł albo był jednorazowy i już go użyto.</p>
          <div className="wk-actions">
            <button type="button" className="wk-link-btn" onClick={() => { forgetLink(arrived.token); close(); }}>Usuń go z tej przeglądarki</button>
          </div>
        </>
      ) : (
        <>
          <p>
            <strong>Otwarto z linku{info.label !== null ? ` „${info.label}”` : ''}</strong> — {describeLink(info)}.
            {owned ? ' Ten dostęp masz też na koncie.' : ' Działa w tej przeglądarce, razem z innymi linkami otwartymi tutaj.'}
          </p>
          {!owned && (
            <div className="wk-actions">
              <a className="wk-btn wk-btn-line" href={`#/dolacz/${arrived.token}`}>Dodaj do konta</a>
              <span className="wk-hint">Na koncie dostęp działa na każdym urządzeniu{info.capability === 'read' ? '' : ' i pozwala pisać'}.</span>
            </div>
          )}
        </>
      )}
      <button type="button" className="wk-heldlink-x" aria-label="Zamknij" onClick={close}>×</button>
    </aside>
  );
}
