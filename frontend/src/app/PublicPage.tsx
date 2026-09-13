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
 */

import { useEffect, useState } from 'react';

import { loadPage, type PageContent } from './page';
import { WorkspaceError } from './session';

export function PublicPage({ path }: { path: string }) {
  const [page, setPage] = useState<PageContent | null | undefined>(undefined);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    // Wer schnell zwischen zwei Adressen wechselt, bekommt sonst die Antwort
    // der ersten auf die zweite Seite geschrieben.
    let alive = true;
    setPage(undefined);

    loadPage(path)
      .then((found) => { if (alive) setPage(found); })
      .catch((e) => {
        if (!alive) return;
        setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać strony.');
        setPage(null);
      });

    return () => { alive = false; };
  }, [path]);

  if (page === undefined) return <p className="wk-lede">Wczytywanie…</p>;

  if (page === null) {
    return (
      <>
        <h1 className="wk-h1">Nic tu jeszcze nie ma</h1>
        <p className="wk-lede">{failed}</p>
      </>
    );
  }

  /*
   * Übernommen, aber noch nichts geschrieben. Das ist ein eigener Zustand und
   * kein Fehler: jemand hat die Adresse, und er hat sie noch nicht gefüllt.
   */
  if (page.title === null) {
    return (
      <>
        <h1 className="wk-h1">recreatio.pl/{page.path}</h1>
        <p className="wk-lede">Ten adres jest już zajęty, ale nic tu jeszcze nie opublikowano.</p>
      </>
    );
  }

  return (
    <>
      <h1 className="wk-h1">{page.title}</h1>
      {page.lead !== null && <p className="wk-lede wk-page-lead">{page.lead}</p>}
    </>
  );
}

export default PublicPage;
