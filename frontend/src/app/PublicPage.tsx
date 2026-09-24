/**
 * Eine öffentliche Seite — das, was unter `recreatio.pl/<adresse>` steht.
 *
 * <b>Ohne Konto, ohne Schlüssel, ohne Warten auf die Anmeldung.</b> Wer hier
 * ankommt, ist meistens niemand, den die Plattform kennt: ein Besucher, der
 * einen Link bekommen hat. Er bekommt die Seite und kein Formular.
 *
 * <b>Drei Zustände, nicht zwei.</b> „Wird geladen", „hier ist nichts" und „hier
 * steht etwas" sehen verschieden aus. Wer die ersten beiden zusammenwirft,
 * zeigt jedem Besucher für einen Moment eine leere Seite — und wer sie
 * wegklickt, bevor der Text da ist, kommt nicht wieder.
 *
 * <b>Und wer seinen Platz hier hat, sieht ihn auch hier.</b> Der
 * Platzschlüssel liegt im Browser (`seatKeep`), nicht in der Adresse — also
 * gilt er auf der ganzen Adresse und nicht nur auf der einen Seite, über die
 * man hereinkam. Vorher ging alles wieder zu, sobald man eine Seite
 * weiterging, und es sah aus, als hätte man den Link nie geöffnet.
 */

import { useEffect, useState } from 'react';

import { loadPage, toDraft, type PageContent } from './page';
import { PageParts } from './PageParts';
import { SeatContext } from './seatContext';
import { seatFor } from './seatKeep';
import { useSeat } from './seatView';
import { WorkspaceError } from './session';
import { loadSite } from './site';

/**
 * Entweder eine Adresse — oder eine eigene Domain, die eine zeigt.
 *
 * Beides endet bei derselben Antwort; welcher Weg es war, sieht man ihr nicht
 * an, und das ist richtig so.
 */
export function PublicPage({ path, host, local }: { path?: string; host?: string; local?: string }) {
  const [page, setPage] = useState<PageContent | null | undefined>(undefined);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    // Wer schnell zwischen zwei Adressen wechselt, bekommt sonst die Antwort
    // der ersten auf die zweite Seite geschrieben.
    let alive = true;
    setPage(undefined);

    // Unter einer eigenen Domain ist der Pfad LOKAL: was die Wurzel ist, setzt
    // der Dienst davor (`routes.localPath`).
    (host !== undefined ? loadSite(host, local ?? '') : loadPage(path ?? ''))
      .then((found) => { if (alive) setPage(found); })
      .catch((e) => {
        if (!alive) return;
        setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać strony.');
        setPage(null);
      });

    return () => { alive = false; };
  }, [path, host, local]);

  if (page === undefined) return <p className="wk-lede">Wczytywanie…</p>;

  if (page === null) {
    return (
      <>
        <h1 className="wk-h1">Nic tu jeszcze nie ma</h1>
        <p className="wk-lede">{failed}</p>
      </>
    );
  }

  const parts = page.parts.map(toDraft);

  /*
   * Übernommen, aber noch nichts geschrieben. Das ist ein eigener Zustand und
   * kein Fehler: jemand hat die Adresse, und er hat sie noch nicht gefüllt.
   */
  if (page.title === null && parts.length === 0) {
    return (
      <>
        <h1 className="wk-h1">recreatio.pl/{page.path}</h1>
        <p className="wk-lede">Ten adres jest już zajęty, ale nic tu jeszcze nie opublikowano.</p>
      </>
    );
  }

  return (
    <>
      {page.title !== null && <h1 className="wk-h1">{page.title}</h1>}
      {page.lead !== null && <p className="wk-lede wk-page-lead">{page.lead}</p>}

      <WithSeat path={page.path}>
        <PageParts parts={parts} />
      </WithSeat>
    </>
  );
}

/**
 * Hält dieser Browser einen Platz, der auf diese Seite gehört? Dann gilt er.
 *
 * <b>Ohne Platz ändert sich nichts.</b> `SeatContext` steht dann auf `null`,
 * wie bisher, und die persönlichen Bausteine sagen, was hier erscheinen wird.
 *
 * <b>Und es wird nichts geholt, wenn nichts zu holen ist.</b> Wer keinen
 * Platz hält — also fast jeder Besucher — löst keinen einzigen Aufruf aus:
 * welcher Platz zu welcher Seite gehört, steht im Browser neben dem
 * Schlüssel und muss nicht erfragt werden.
 */
function WithSeat({ path, children }: { path: string; children: React.ReactNode }) {
  const token = seatFor(path);

  return token === null
    ? <>{children}</>
    : <Opened token={token}>{children}</Opened>;
}

/*
 * Ein eigenes Bauteil, weil ein Haken nicht bedingt aufgerufen werden darf.
 * Ohne es stünde `useSeat` hinter einem `if`, und React zählt Haken.
 */
function Opened({ token, children }: { token: string; children: React.ReactNode }) {
  const { seat } = useSeat(token, null);

  return <SeatContext.Provider value={seat}>{children}</SeatContext.Provider>;
}

export default PublicPage;
