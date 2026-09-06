/**
 * Strona wydarzenia — publiczna, złożona z części.
 *
 * <b>Wzorowana na starym module wydarzeń, bo tamten jest dobrze zrobiony.</b>
 * Trzy rzeczy stamtąd są tu przeniesione świadomie:
 *
 * <b>1. Część ma adres.</b> `#/new/event/recreatio/kal26/3` otwiera trzecią
 * część wydarzenia "kal26" ze strony "recreatio".
 * Menu i strzałki są PRAWDZIWYMI odnośnikami, nie przyciskami — dzięki temu
 * środkowy przycisk myszy otwiera je w nowej karcie, da się je wysłać komuś i
 * da się z nich wrócić „wstecz". Cztery odruchy, które przy przyciskach idą w
 * próżnię.
 *
 * <b>2. Części są kolejnymi ekranami, nie akapitami.</b> Wydarzenie czyta się
 * na telefonie, w drodze: tytuł, potem najważniejsze liczby, potem plan. Jedna
 * długa strona zmusza do przewijania w poszukiwaniu tego, po co się przyszło.
 *
 * <b>3. Wygląd niesie samo wydarzenie</b> — tło i barwy idą z jego warstw, a
 * nie z arkusza platformy. Rajd rowerowy nie ma wyglądać jak rekolekcje.
 *
 * <b>Czego tu nie ma.</b> Edytora. Ten plik tylko czyta — kto ma prawa, wchodzi
 * w edycję osobnym wejściem, tak jak przy parafii.
 */

import { useEffect, useState } from 'react';

import { rcEvent, type RcEventView } from '../lib/rcEvents';
import { rcPath } from '../lib/rcRoute';
import { RcEventPart } from './RcEventPart';
import { rcLayerStyle, rcPartsOf, type RcPartView } from './rcEventLayers';

export function RcEventSite({
  collection, slug, at, signedIn
}: {
  /**
   * Strona wydarzeń, w której to wydarzenie leży.
   *
   * Nazwa wydarzenia jest jednoznaczna TYLKO w obrębie swojej strony — dwie
   * parafie mogą mieć "festyn-2026". Bez tego członu odpowiedź trafiłaby
   * w cudze zgłoszenia.
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

  if (missing) {
    return (
      <Shell title="Nie znaleziono" home={home}>
        <p className="ev-muted">
          Pod tym adresem nie ma wydarzenia. Sprawdź, czy odnośnik jest w całości.
        </p>
      </Shell>
    );
  }

  if (event === null) return <Shell title="" home={home}><p className="ev-muted">Wczytywanie…</p></Shell>;

  const parts = rcPartsOf(event);

  if (parts.length === 0) {
    return (
      <Shell title={event.title ?? ''} home={home}>
        <p className="ev-muted">
          {signedIn
            ? 'To wydarzenie nie ma jeszcze żadnej części. Dodaj je w edytorze.'
            : 'To wydarzenie nie ma jeszcze treści.'}
        </p>
      </Shell>
    );
  }

  /*
   * Adres spoza zakresu nie jest błędem — bywa, że część usunięto, a odnośnik
   * został w czyjejś wiadomości. Wtedy pierwsza część, a nie pusty ekran.
   */
  const index = at === null || at < 0 || at >= parts.length ? 0 : at;
  const part = parts[index];

  const href = (n: number) => `${rcPath('event', collection, slug)}/${n}`;

  return (
    <Shell title={event.title ?? ''} style={rcLayerStyle(part)} home={home}>
      {/*
        Menu części — odnośniki, nie przyciski. Etykieta bierze się z części
        („menuLabel"), bo tytuł bywa długi, a w menu ma się zmieścić.
      */}
      <nav className="ev-menu" aria-label="Części">
        {parts.map((one, n) => (
          <a
            key={one.partId}
            className={`ev-tab${n === index ? ' is-active' : ''}`}
            href={href(n)}
            aria-current={n === index ? 'page' : undefined}
          >
            {(one.menuLabel ?? '').trim() === ''
              ? (one.title ?? '').trim() || `Część ${n + 1}`
              : one.menuLabel}
          </a>
        ))}
      </nav>

      <RcEventPart part={part} />

      {/*
        Dalej i wstecz — też odnośnikami. Kto czyta w drodze, przechodzi
        kciukiem, a nie przez menu.
      */}
      <nav className="ev-steps">
        {index > 0 && <a className="ev-step" href={href(index - 1)}>← wstecz</a>}
        {index + 1 < parts.length && (
          <a className="ev-step ev-step-next" href={href(index + 1)}>dalej →</a>
        )}
      </nav>
    </Shell>
  );
}

/** Oprawa: nagłówek wydarzenia i stopka. Nie wie nic o żadnej części. */
/*
  `home` to adres KATALOGU tej strony wydarzeń, a nie gołego `#/new/event`,
  pod którym nie ma nic. Odnośnik prowadzący donikąd jest gorszy niż jego brak:
  wygląda na wyjście.
*/
function Shell({
  title, children, style, home
}: {
  title: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  home: string;
}) {
  return (
    <div className="ev" style={style}>
      <header className="ev-head">
        <a className="ev-brand" href={home}>
          <span className="ev-mark" aria-hidden="true">◆</span>
          <span className="ev-name">{title === '' ? 'Wydarzenie' : title}</span>
        </a>
      </header>

      <main className="ev-main">{children}</main>

      <footer className="ev-foot">
        <a href={home}>Wszystkie wydarzenia</a>
        <a href="https://recreatio.pl">recreatio.pl</a>
      </footer>
    </div>
  );
}

export type { RcPartView };
export default RcEventSite;
