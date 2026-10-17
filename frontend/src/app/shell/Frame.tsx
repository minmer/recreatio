/**
 * DER RAHMEN — drei Arten, eine Seite zu zeigen (2026-10-16).
 *
 * <code>
 *   WorkspaceFrame  (`WorkspaceFrame.tsx`, mit dem Arbeitsplatz nachgeladen) der Arbeitsplatz: links die Seitenleiste (am Telefon unten
 *                   die Leiste), oben eine schmale Kopfleiste mit Suche und
 *                   Glocke, über dem Inhalt der Weg (ab der zweiten Stufe)
 *   PlainFrame      ohne Arbeitsplatz: Anmeldung, ein Link mit Zugang, der Platz
 *                   eines Menschen, eine bestätigte Nummer
 *   PublicFrame     eine öffentliche Seite: ihr eigenes Menü als Kopf, unten eine
 *                   Zeile mit „Zaloguj się" — kein Arbeitsplatz darüber
 * </code>
 *
 * <b>Warum eine Seitenleiste.</b> Bis hierher gab es keinen Ort, der immer da
 * war: man ging über den Weg oben, den Pfeil, die Kacheln, „Na skróty", die
 * Suche oder die Leiste am Telefon — neun Wege, und jeder zeigte andere Teile in
 * anderer Reihenfolge. Jetzt steht links, was es gibt, geordnet danach, was man
 * tut; am Telefon dieselben Orte unten und hinter „Więcej".
 *
 * <b>Die Kopfleiste trägt `data-app-head`</b> — Rozmowy, Prezentacja und Slajdy
 * messen an ihr, wie viel Platz unter ihr bleibt.
 */

import { lazy, Suspense, useState, type ReactNode } from 'react';

import { HeaderSlotContext } from './headerSlot';
import { HeldLinkBar } from './HeldLinkBar';
import { path, tilesPath } from './routes';
import type { Who } from './session';
import { UiHosts } from './ui/dialogs';
import { ViewGuard } from './ViewGuard';

/* Glocke und Konto kommen nur, wenn jemand angemeldet ist — eine öffentliche Seite lädt sie nicht. */
const PlainAccount = lazy(() => import('./WorkspaceFrame'));

/* -- Ohne Arbeitsplatz ------------------------------------------------------------------------- */

export function PlainFrame({ who, onSignOut, wide = false, children }: {
  who?: Who;
  onSignOut?: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={wide ? 'wk-root wk-plain is-wide' : 'wk-root wk-plain'}>
      <header className="wk-plain-top" data-app-head="">
        {/* Ohne Konto führt die Marke zur Seite der Initiative, mit Konto zum Arbeitsplatz. */}
        <a className="wk-brandmark" href={who === undefined ? '#/' : tilesPath()}><b>RE</b>creatio</a>
        {who !== undefined && (
          <Suspense fallback={null}>
            <PlainAccount who={who} onSignOut={onSignOut} />
          </Suspense>
        )}
      </header>
      <main className="wk-main">
        <HeldLinkBar who={who} />
        <ViewGuard>{children}</ViewGuard>
      </main>
      <UiHosts />
    </div>
  );
}

/* -- Eine öffentliche Seite -------------------------------------------------------------------- */

export function PublicFrame({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  return (
    <div className="wk-root wk-public">
      {/* Leer bleibt der Kopf unsichtbar; das Menü der Seite zeichnet sich hinein (`InHeader`). */}
      <header className="wk-public-head" data-app-head="" ref={setSlot} />
      <main className="wk-main">
        <HeaderSlotContext.Provider value={slot}>
          <HeldLinkBar />
          <ViewGuard>{children}</ViewGuard>
        </HeaderSlotContext.Provider>
      </main>
      <footer className="wk-public-foot">
        <a href="#/">REcreatio</a>
        <span aria-hidden="true">·</span>
        <a href={path('workspace')}>Zaloguj się</a>
      </footer>
      <UiHosts />
    </div>
  );
}
