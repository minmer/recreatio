/**
 * Strona wydarzenia — publiczna, złożona z części.
 *
 * <b>Cała oprawa i cała logika przewijania są przeniesione ze starego modułu
 * wydarzeń</b>, bo tam są dobrze zrobione. Ten plik jest już tylko tłumaczem:
 * pobiera wydarzenie z rc, przekłada je na kształty, których oczekuje `EventShell`
 * (`shellTypes.ts`), i podaje adresy.
 *
 * Trzy rzeczy stamtąd zostają nietknięte, bo o nie właśnie chodziło:
 *
 * <b>1. Część ma adres.</b> `#/new/event/recreatio/kal26/3` otwiera trzecią
 * część. Menu i strzałki są PRAWDZIWYMI odnośnikami, nie przyciskami — dzięki
 * temu środkowy przycisk myszy otwiera je w nowej karcie, da się je wysłać
 * komuś i da się z nich wrócić „wstecz". Adres podąża za czytanym miejscem
 * (`replaceState`), więc skopiowany link wskazuje to, co widać.
 *
 * <b>2. Części są kolejnymi ekranami na jednej taśmie</b>, przesuwanej
 * transformacją — nie osobnymi stronami. Stąd cały `useSlideScroll`: pomiar
 * wysokości, przyciąganie do slajdu, klawiatura, dotyk.
 *
 * <b>3. Wygląd niesie samo wydarzenie</b> — tło i barwy idą z warstw części, a
 * nie z arkusza platformy. Rajd rowerowy nie ma wyglądać jak rekolekcje.
 *
 * <b>Czego tu jeszcze nie ma.</b> Strona w adresie. Wydarzenie o kilku stronach
 * przełącza je przyciskiem, a nie odnośnikiem: `#/new/event/c/e/3` znaczy dziś
 * „trzecia część", a slug strony bywa samą liczbą („2026") — więc dołożenie
 * członu na stronę uczyniłoby stary adres dwuznacznym. Zmiana wymaga decyzji o
 * kształcie adresu, nie kolejnej sztuczki przy odczycie.
 *
 * <b>Czego tu nie ma z założenia.</b> Edytora. Ten plik tylko czyta — kto ma
 * prawa, wchodzi w edycję osobnym wejściem, tak jak przy parafii.
 */

import { useEffect, useMemo, useState } from 'react';

import { rcEvent, type RcEventView } from '../lib/rcEvents';
import { rcReadClaim, rcWriteClaim } from './shell/rcClaim';
import { rcPath } from '../lib/rcRoute';
import { EventShell } from './shell/EventShell';
import { rcShellPage, rcShellPages, rcShellSite } from './shell/shellTypes';
import type { RcPartView } from './rcEventLayers';

export function RcEventSite({
  collection, slug, at, signedIn
}: {
  /**
   * Strona wydarzeń, w której to wydarzenie leży.
   *
   * Nazwa wydarzenia jest jednoznaczna TYLKO w obrębie swojej strony — dwie
   * parafie mogą mieć „festyn-2026". Bez tego członu odpowiedź trafiłaby w
   * cudze zgłoszenia.
   */
  collection: string;
  slug: string;
  /**
   * Która część — Z ADRESU, nie ze stanu.
   *
   * Stan w pamięci nie ma adresu: nie otworzysz go w nowej karcie, nie
   * zapiszesz w zakładkach, nie wyślesz nikomu i nie wrócisz do niego
   * „wstecz". Ta sama zasada rządzi podstronami parafii.
   */
  at: number | null;
  signedIn: boolean;
}) {
  const home = rcPath('event', collection);

  const [event, setEvent] = useState<RcEventView | null>(null);
  const [missing, setMissing] = useState(false);
  const [openPage, setOpenPage] = useState<string | null>(null);

  /*
   * Der Beleg der Anmeldung. Er gilt fuer die Dauer der Karte und steht
   * NICHT in der Adresse — dort landete er im Verlauf des Browsers, im
   * Verweis der naechsten Seite und im Protokoll jedes Zwischenservers.
   */
  const [claim, setClaim] = useState<string | null>(() => rcReadClaim(collection, slug));

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const found = await rcEvent(collection, slug);
        if (alive) setEvent(found);
      } catch {
        if (alive) setMissing(true);
      }
    })();
    return () => { alive = false; };
  }, [collection, slug]);

  /*
   * Widoczne strony w swojej kolejności. Niewidoczne stoją w odpowiedzi, bo
   * potrzebuje ich edytor; w przełączniku byłyby drzwiami, które nie otwierają.
   */
  const pages = useMemo(
    () => [...(event?.pages ?? [])]
      .filter((p) => p.isVisible !== false)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.pageId.localeCompare(b.pageId)),
    [event]
  );

  if (missing) {
    return (
      <Shell title="Nie znaleziono" home={home}>
        <p className="evp-muted">
          Pod tym adresem nie ma wydarzenia. Sprawdź, czy odnośnik jest w całości.
        </p>
      </Shell>
    );
  }

  if (event === null) return <Shell title="" home={home}><p className="evp-muted">Wczytywanie…</p></Shell>;

  if (pages.length === 0) {
    return (
      <Shell title={event.title ?? ''} home={home}>
        <p className="evp-muted">
          {signedIn
            ? 'To wydarzenie nie ma jeszcze żadnej strony. Dodaj ją w edytorze.'
            : 'To wydarzenie nie ma jeszcze treści.'}
        </p>
      </Shell>
    );
  }

  const page = pages.find((p) => p.slug === openPage) ?? pages[0];

  /*
   * Niewidoczna część znika, tak jak niewidoczna strona. Numer w adresie liczy
   * się PO tym odsianiu — inaczej ukrycie jednej części przesunęłoby każdy
   * odnośnik pod nią, a to widać dopiero wtedy, gdy ktoś w niego kliknie.
   */
  const visible: RcPartView[] = [...(page.parts ?? [])]
    .filter((part) => part.isVisible !== false)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.partId.localeCompare(b.partId));

  if (visible.length === 0) {
    return (
      <Shell title={event.title ?? ''} home={home}>
        <p className="evp-muted">
          {signedIn
            ? 'Ta strona nie ma jeszcze żadnej części. Dodaj je w edytorze.'
            : 'Ta strona nie ma jeszcze treści.'}
        </p>
      </Shell>
    );
  }

  return (
    <EventShell
      site={rcShellSite(event)}
      page={{ ...rcShellPage(page), parts: visible }}
      mayRead={event.mayRead}
      claim={claim}
      intakePublicKey={event.intakePublicKey ?? null}
      onClaim={(next) => { rcWriteClaim(collection, slug, next); setClaim(next); }}
      availablePages={rcShellPages(event)}
      onSelectPage={(pageSlug) => setOpenPage(pageSlug)}
      initialPartIndex={at}
      partHref={(n) => `${rcPath('event', collection, slug)}/${n}`}
      /*
        Der Weg in den Herausgeber steht auf der Seite selbst — dort, wo man
        merkt, dass etwas fehlt. Ihn nur in der Werkstatt zu haben hiesse: erst
        den Fehler sehen, dann ihn woanders suchen.
      */
      adminEditHref={event.mayRead ? rcPath('event', collection, slug, 'edit') : null}
    />
  );
}

/*
  Oprawa dla stanów, w których nie ma czego pokazać — brak wydarzenia,
  wczytywanie, pusta strona. Pełne wydarzenie nosi `EventShell`.

  `home` to adres KATALOGU tej strony wydarzeń, a nie gołego `#/new/event`, pod
  którym nie ma nic. Odnośnik prowadzący donikąd jest gorszy niż jego brak:
  wygląda na wyjście.
*/
function Shell({
  title, children, home
}: {
  title: string;
  children: React.ReactNode;
  home: string;
}) {
  return (
    <div className="evp">
      <header className="evp-head">
        <a className="evp-brand" href={home}>
          <span className="evp-mark" aria-hidden="true">◆</span>
          <span className="evp-name">{title === '' ? 'Wydarzenie' : title}</span>
        </a>
      </header>

      <main className="evp-main">{children}</main>

      <footer className="evp-foot">
        <a href={home}>Wszystkie wydarzenia</a>
        <a href="https://recreatio.pl">recreatio.pl</a>
      </footer>
    </div>
  );
}

export default RcEventSite;
