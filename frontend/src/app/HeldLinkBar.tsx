/**
 * „OTWARTO Z LINKU" (0073) — wer über einen Link mit Zugang hereinkam, sieht
 * am Ziel, was er ihm gibt: welche Bereiche, welche Stufe, und dass es in
 * diesem Browser gilt.
 *
 * <b>Dem Konto hinzufügen</b> ist der zweite Schritt, kein Muss: ohne Konto
 * gilt der Link in diesem Browser — zum Lesen, und wo er „pisze" sagt, zum
 * Eintragen im Kalender (`linkMe.ts`). Mit dem Konto gilt er auf jedem Gerät
 * und im ganzen Arbeitsplatz (`#/dolacz/<T>`, dort wird gewählt, eingelöst).
 *
 * <b>Angeboten wird das nur dem, der angemeldet ist</b> (Wunsch 2026-10-03).
 * Wer ohne Konto kommt, hat den Link meist aus einer Nachricht und will die
 * Seite sehen — ein „Dodaj do konta" schickte ihn zu einer Anmeldung, um die
 * er nicht gebeten hat. Ihm sagt die Leiste nur, was der Link hier gibt.
 *
 * <b>Wer angemeldet ist, handelt als sein Konto</b> — und ein Link, den es
 * nicht hat, zählt im Arbeitsplatz nicht. Das war ein stiller Verlust: der
 * Link lag im Browser, die Leiste war nach dem ersten Bild fort, und im
 * Kalender stand nichts. Deshalb steht er dort jetzt da, bis er im Konto ist
 * oder weggelegt wird (`Unjoined`).
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

/* -- Angemeldet: Links in diesem Browser, die das Konto nicht hat ----------------------- */

const LATER = 'recreatio:links:later';

function laterTokens(): ReadonlySet<string> {
  try { return new Set((window.sessionStorage.getItem(LATER) ?? '').split(',').filter((one) => one !== '')); } catch { return new Set(); }
}

/**
 * „Nie teraz" gilt, solange der Tab offen ist — eine Bequemlichkeit, kein
 * Zustand: der Link bleibt im Browser, und unter Obszary → Linki dostępu steht
 * er weiter ("Linki otwarte w tej przeglądarce").
 */
function Unjoined({ who }: { who: Who }) {
  const stamp = useHeldLinksStamp();
  const [missing, setMissing] = useState<readonly HeldInfo[]>([]);
  const [later, setLater] = useState(laterTokens);
  const [tick, setTick] = useState(0);

  /* Nach „Dołącz" hält das Konto ihn — beim nächsten Schritt durch den Arbeitsplatz wird neu nachgesehen. */
  useEffect(() => {
    const moved = () => setTick((n) => n + 1);
    window.addEventListener('hashchange', moved);
    return () => window.removeEventListener('hashchange', moved);
  }, []);

  useEffect(() => {
    if (stamp === '') { setMissing([]); return undefined; }
    let alive = true;
    void (async () => {
      try {
        /* Ohne Bund lässt sich nicht sagen, was das Konto hält — dann lieber nichts behaupten. */
        const ring = (await keysFor(who)).ring;
        if (ring === null) { if (alive) setMissing([]); return; }
        const keys = await heldLinkKeys();
        if (alive) setMissing(keys.links.filter((one) => one.info !== null && !ring.has(one.info.roleId)));
      } catch {
        if (alive) setMissing([]);
      }
    })();
    return () => { alive = false; };
  }, [stamp, who, tick]);

  const shown = missing.filter((one) => !later.has(one.token));
  if (shown.length === 0) return null;

  const notNow = (token: string) => {
    const next = new Set([...later, token]);
    try { window.sessionStorage.setItem(LATER, [...next].join(',')); } catch { /* dann nur für dieses Bild */ }
    setLater(next);
  };

  return (
    <>
      {shown.map((one) => (
        <aside key={one.token} className="wk-heldlink" role="status" aria-label="Link z dostępem, którego nie ma na koncie">
          <p>
            <strong>W tej przeglądarce jest link z dostępem{one.info!.label !== null ? ` „${one.info!.label}”` : ''}</strong> — {describeLink(one.info!)}.
            {' '}Twoje konto go nie ma, a w warsztacie działa tylko to, co ma konto.
          </p>
          <div className="wk-actions">
            <a className="wk-btn wk-btn-line" href={`#/dolacz/${one.token}`}>Dodaj do konta</a>
            <button type="button" className="wk-link-btn" onClick={() => notNow(one.token)}>Nie teraz</button>
          </div>
          <button type="button" className="wk-heldlink-x" aria-label="Zamknij" onClick={() => notNow(one.token)}>×</button>
        </aside>
      ))}
    </>
  );
}

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
  /*
   * Was der Link gibt, ob jemand angemeldet ist, und ob dessen Konto ihn schon
   * hält — ALLES, bevor die Leiste steht. Kam die Anmeldung erst danach, stand
   * einen Augenblick lang der falsche Satz da (oder der Knopf bei einem
   * Besucher, der nie gefragt war).
   */
  const [seen, setSeen] = useState<{ held: HeldInfo | null; signedIn: boolean; owned: boolean } | undefined>(undefined);

  useEffect(() => {
    if (arrived === null) return undefined;
    let alive = true;
    setSeen(undefined);
    void (async () => {
      let held: HeldInfo | null = null;
      try {
        held = (await heldLinkKeys()).links.find((l) => l.token === arrived.token) ?? null;
      } catch {
        held = null;
      }

      const me = who ?? await whoIsThere().catch(() => null);

      /* Schon im Konto? Dann ist der Knopf überflüssig. */
      let owned = false;
      if (me !== null && held?.info != null) {
        const ring = (await keysFor(me).catch(() => null))?.ring ?? null;
        owned = ring !== null && ring.has(held.info.roleId);
      }

      if (alive) setSeen({ held, signedIn: me !== null, owned });
    })();
    return () => { alive = false; };
  }, [arrived, who]);

  /* Kein frischer Link: im Arbeitsplatz die, die das Konto noch nicht hat. */
  if (arrived === null) return who === undefined ? null : <Unjoined who={who} />;
  if (seen === undefined) return null;

  const close = () => { dismissFresh(); setArrived(null); };
  const info = seen.held?.info ?? null;
  const { signedIn, owned } = seen;
  const writes = info !== null && info.areas.some((a) => a.capability === 'write' || a.capability === 'admin');

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
            {owned ? ' Ten dostęp masz też na koncie.'
              : signedIn ? ' Działa w tej przeglądarce, razem z innymi linkami otwartymi tutaj.'
                : ` Działa w tej przeglądarce, bez logowania${writes ? ' — w kalendarzu także dopisywanie' : ''}.`}
          </p>
          {/* Dem Konto hinzufügen — nur wer angemeldet ist, bekommt es angeboten. */}
          {signedIn && !owned && (
            <div className="wk-actions">
              <a className="wk-btn wk-btn-line" href={`#/dolacz/${arrived.token}`}>Dodaj do konta</a>
              <span className="wk-hint">
                Jesteś zalogowany — w warsztacie i przy dopisywaniu działa to, co ma konto. Na koncie dostęp działa też na każdym urządzeniu.
              </span>
            </div>
          )}
        </>
      )}
      <button type="button" className="wk-heldlink-x" aria-label="Zamknij" onClick={close}>×</button>
    </aside>
  );
}
