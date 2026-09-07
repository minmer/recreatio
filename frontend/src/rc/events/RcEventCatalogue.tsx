/**
 * Katalog strony wydarzeń — to, co widać pod `#/new/event/recreatio`.
 *
 * <b>Dlaczego ta strona w ogóle istnieje.</b> Wcześniej adres `#/new/event/x`
 * oznaczał JEDNO wydarzenie i nic ponad nim nie było. Kto organizował dwa
 * festyny, zakładał dwa razy wszystko: osobny obszar, osobną rolę
 * administracyjną i — co gorsza — osobną klauzulę RODO, wpisywaną z ręki
 * drugi raz. Teraz na górze stoi strona organizatora, a festyny leżą w niej.
 *
 * <b>Sito jest tutaj, nie w serwisie.</b> Katalog jednej strony to kilkanaście,
 * może kilkadziesiąt wydarzeń — nie dziesiątki tysięcy. Pytanie serwisu przy
 * każdym naciśnięciu klawisza kosztowałoby żądanie za żądaniem, a reguły
 * doboru byłyby wtedy w dwóch miejscach. Same reguły siedzą w `rcCatalogue.ts`,
 * osobno i sprawdzalnie: katalog, który źle sieje, nie wygląda na zepsuty —
 * pokazuje MNIEJ, a nikt nie zauważa, czego brakuje.
 *
 * <b>Administrator danych stoi tutaj, jawnie.</b> Obowiązuje wszystko, co pod
 * tą stroną zbiera zgłoszenia, więc musi dać się przeczytać ZANIM ktokolwiek
 * cokolwiek wpisze — a więc bez konta i bez klucza. To ta sama granica co przy
 * mszy: `title_public` jawne, `title_sealed` nie.
 *
 * <b>Czego tu nie ma.</b> Edytora. Ten plik tylko czyta; kto ma prawa, wchodzi
 * w edycję osobnym wejściem, tak jak przy parafii.
 */

import { useEffect, useMemo, useState } from 'react';

import { rcAddEvent, rcEventCollection } from '../lib/rcEvents';
import { rcIsSlug } from '../lib/rcSlugs';
import type { RcApi } from '../lib/rcApi';
import { rcPath } from '../lib/rcRoute';
import {
  rcCatalogue, rcCategoriesOf, rcInitials, rcPlacesIn, rcWhen,
  RC_CATALOGUE_ALL, type RcCatalogueQuery
} from './rcCatalogue';

type RcCollectionView = RcApi<'RcEventCollectionViewResponse'>;

/**
 * <b>`signedIn` steht hier NICHT mehr.</b> Es sagte „hat ein Konto"; was hier
 * zaehlt, ist „fuehrt diese Seite" — und das beantwortet `mayRead` aus der
 * Antwort des Dienstes, der es ohnehin schon geprueft hat.
 */
export function RcEventCatalogue({ slug }: { slug: string }) {
  const [view, setView] = useState<RcCollectionView | null>(null);
  const [missing, setMissing] = useState(false);
  const [query, setQuery] = useState<RcCatalogueQuery>(RC_CATALOGUE_ALL);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const found = await rcEventCollection(slug);
        if (alive) setView(found);
      } catch {
        if (alive) setMissing(true);
      }
    })();
    return () => { alive = false; };
  }, [slug]);

  const events = useMemo(() => view?.events ?? [], [view]);
  const categories = useMemo(() => rcCategoriesOf(events), [events]);
  const places = useMemo(() => rcPlacesIn(events), [events]);

  /*
   * „Teraz" bierzemy RAZ, przy każdym przeliczeniu sita — a nie wewnątrz
   * `rcCatalogue`. Funkcja, która sama patrzy na zegar, nie da się sprawdzić,
   * a „nadchodzące" to właśnie ta reguła, przy której błąd zostaje niewidoczny.
   */
  const shown = useMemo(() => rcCatalogue(events, query, Date.now()), [events, query]);

  if (missing) {
    return (
      <Shell title="Nie znaleziono">
        <p className="ec-note">
          Pod tym adresem nie ma strony wydarzeń. Sprawdź, czy odnośnik jest w całości.
        </p>
      </Shell>
    );
  }

  if (view === null) return <Shell title=""><p className="ec-note">Wczytywanie…</p></Shell>;

  const set = <K extends keyof RcCatalogueQuery>(key: K, value: RcCatalogueQuery[K]) =>
    setQuery((old) => ({ ...old, [key]: value }));

  return (
    <Shell
      title={view.title}
      eyebrow={view.slug}
      /*
        Anlegen darf, wer die Seite fuehrt — `mayRead` sagt genau das: der
        Dienst hat schon geprueft, ob dieser Leser dazugehoert. Einen Knopf
        zu zeigen, der zuverlaessig mit einer Absage endet, waere schlechter
        als keiner.
      */
      mayAdd={view.mayRead}
      when={query.when}
      onWhen={(next) => set('when', next)}
      onAdd={() => setAdding(true)}
    >
      <div className="ec-filters">
        <input
          className="ec-search"
          type="search"
          value={query.text}
          placeholder="Szukaj…"
          aria-label="Szukaj"
          onChange={(e) => set('text', e.target.value)}
        />

        {/*
          Listy budują się z DANYCH, nie ze stałej. Nowy rodzaj wydarzenia nie
          wymaga wtedy zmiany w programie — a filtr nigdy nie pokazuje pozycji,
          pod którą nic nie ma.
        */}
        {categories.length > 0 && (
          <select value={query.category} aria-label="Grupa"
            onChange={(e) => set('category', e.target.value)}>
            <option value="">Wszystkie grupy</option>
            {categories.map((one) => <option key={one} value={one}>{one}</option>)}
          </select>
        )}

        {places.length > 0 && (
          <select value={query.place} aria-label="Miejsce"
            onChange={(e) => set('place', e.target.value)}>
            <option value="">Wszystkie miejsca</option>
            {places.map((one) => <option key={one} value={one}>{one}</option>)}
          </select>
        )}

        <select value={query.sort} aria-label="Kolejność"
          onChange={(e) => set('sort', e.target.value as RcCatalogueQuery['sort'])}>
          <option value="soonest">Termin: najbliższe</option>
          <option value="latest">Termin: najpóźniejsze</option>
          <option value="title">Nazwa</option>
        </select>

        {/*
          Derselbe Schalter wie „Poprzednie wydarzenia" im Kopf, nur von der
          anderen Seite. EINE Achse: sonst liesse sich „nur bevorstehend" UND
          „nur vergangen" zugleich setzen, und der Katalog waere leer, ohne
          dass etwas kaputt ist.
        */}
        <button
          type="button"
          className={`ec-toggle${query.when === 'upcoming' ? ' is-on' : ''}`}
          aria-pressed={query.when === 'upcoming'}
          onClick={() => set('when', query.when === 'upcoming' ? 'all' : 'upcoming')}
        >
          Nadchodzące
        </button>

        {/*
          Licznik pokazuje, ILE zostało po sicie. Bez niego nie widać różnicy
          między „nic nie pasuje" a „nic tu nie ma" — a to dwie różne rzeczy.
        */}
        <span className="ec-count" aria-live="polite">{shown.length}</span>
      </div>

      {adding && (
        <NewEvent
          collectionId={view.collectionId}
          collectionSlug={view.slug}
          taken={events.map((one) => one.slug)}
          onClose={() => setAdding(false)}
        />
      )}

      {/*
        Der Rat richtet sich nach dem, was der Leser TUN kann — nicht danach,
        ob er angemeldet ist. Einem angemeldeten Fremden zu sagen, er solle es
        im Herausgeber anlegen, waere ein Hinweis auf eine Tuer, die fuer ihn
        nicht aufgeht.
      */}
      {events.length === 0 && !adding && (
        <p className="ec-note">
          {view.mayRead
            ? 'Ta strona nie ma jeszcze żadnego wydarzenia — dodaj pierwsze przyciskiem u góry.'
            : 'Nie zapowiedziano tu jeszcze niczego.'}
        </p>
      )}

      {events.length > 0 && shown.length === 0 && (
        <p className="ec-note">Nic nie pasuje do tego, czego szukasz.</p>
      )}

      <ul className="ec-grid">
        {shown.map((one) => {
          const when = rcWhen(one);
          const thumb = (one.thumbnailUrl ?? '').trim();

          return (
            <li key={one.eventId} className="ec-card">
              <a className="ec-open" href={rcPath('event', view.slug, one.slug)}>
                {/*
                  Bez zdjęcia — inicjały, nie pusty prostokąt. Kafelek ma mieć
                  zawsze tę samą wysokość, żeby siatka nie skakała w trakcie
                  wczytywania.
                */}
                <span className="ec-thumb">
                  {thumb === ''
                    ? <span className="ec-initials" aria-hidden="true">{rcInitials(one.title)}</span>
                    : <img src={thumb} alt="" loading="lazy" />}
                </span>

                <span className="ec-title">{one.title}</span>
                {when !== null && <span className="ec-when">{when}</span>}
                {(one.summary ?? '') !== '' && <span className="ec-summary">{one.summary}</span>}

                <span className="ec-tags">
                  {(one.category ?? '') !== '' && <span className="ec-tag">{one.category}</span>}
                  {/*
                    Szkic widzą tylko swoi — i widzą, ŻE to szkic. Bez tego ktoś
                    rozesłałby odnośnik do strony, której nikt nie otworzy.
                  */}
                  {one.lifecycle !== 'published' && (
                    <span className="ec-tag ec-draft">
                      {one.lifecycle === 'draft' ? 'szkic' : 'archiwum'}
                    </span>
                  )}
                </span>
              </a>
            </li>
          );
        })}
      </ul>

      {/*
        Klauzula. Jawna i na dole każdej strony katalogu, bo dotyczy wszystkiego,
        co pod nią zbiera zgłoszenia.
      */}
      {(view.organizerName ?? '') !== '' && (
        <section className="ec-rodo">
          <h2 className="ec-rodo-h">Administrator danych</h2>
          <p>
            {view.organizerName}
            {(view.organizerAddress ?? '') !== '' && <>, {view.organizerAddress}</>}
          </p>
          {(view.organizerEmail ?? '') !== '' && (
            <p>
              Sprawy danych — wgląd, sprostowanie, usunięcie:{' '}
              <a href={`mailto:${view.organizerEmail}`}>{view.organizerEmail}</a>
            </p>
          )}
        </section>
      )}
    </Shell>
  );
}

/**
 * Der Rahmen des Katalogs — und der Kopf, der sich mit der Anmeldung aendert.
 *
 * <b>Angemeldet verschwindet „Zaloguj się" und es erscheint, was man TUN
 * kann.</b> Ein Anmeldeknopf fuer jemanden, der angemeldet ist, ist kein
 * Angebot, sondern eine Frage, die schon beantwortet ist — und er nimmt den
 * Platz weg, an dem der Weg zur naechsten Handlung stehen sollte.
 *
 * <b>„Poprzednie wydarzenia" ist kein zweiter Schalter neben „Nadchodzące",
 * sondern dieselbe Achse.</b> Zwei unabhaengige Angaben liessen sich in einen
 * Zustand bringen, den niemand gemeint hat, und der Katalog waere leer, ohne
 * dass etwas kaputt ist.
 */
function Shell({
  title, eyebrow, children, mayAdd = false, when = 'all', onWhen, onAdd
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  mayAdd?: boolean;
  when?: RcCatalogueQuery['when'];
  onWhen?: (when: RcCatalogueQuery['when']) => void;
  onAdd?: () => void;
}) {
  const showingPast = when === 'past';

  return (
    <div className="ec">
      <div className="ec-sheet">
        <header className="ec-head">
          <a className="ec-home" href={rcPath('home')}>Start</a>

          {mayAdd && onWhen !== undefined && (
            <button
              type="button"
              className="ec-home"
              onClick={() => onWhen(showingPast ? 'upcoming' : 'past')}
            >
              {showingPast ? 'Nadchodzące wydarzenia' : 'Poprzednie wydarzenia'}
            </button>
          )}

          <span className="ec-spacer" />

          {mayAdd && onAdd !== undefined ? (
            <button type="button" className="ec-new" onClick={onAdd}>
              + Nowe wydarzenie
            </button>
          ) : (
            <a className="ec-signin" href={rcPath('workshop')}>Zaloguj się</a>
          )}
        </header>

        {eyebrow !== undefined && <p className="ec-eyebrow">{eyebrow}</p>}
        <h1 className="ec-h1">{title === '' ? 'Wydarzenia' : title}</h1>

        {children}
      </div>
    </div>
  );
}

export default RcEventCatalogue;

/**
 * Eine Veranstaltung in diese Seite stellen.
 *
 * <b>Nach dem Verantwortlichen wird NICHT gefragt.</b> Er steht an der Seite
 * und gilt fuer alles darunter; ihn je Fest zu erfragen hiesse, dieselbe
 * Auskunft an zwei Stellen zu fuehren, und irgendwann widersprechen sie sich.
 *
 * <b>Danach geht es sofort in den Herausgeber.</b> Eine gerade angelegte
 * Veranstaltung ist leer — sie im Katalog als graue Kachel stehen zu lassen
 * hiesse, den naechsten Schritt zu verstecken.
 */
function NewEvent({
  collectionId, collectionSlug, taken, onClose
}: {
  collectionId: string;
  collectionSlug: string;
  taken: readonly string[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clash = slug !== '' && taken.includes(slug);
  const shape = slug === '' || rcIsSlug(slug);
  const ready = !busy && title.trim() !== '' && slug !== '' && shape && !clash;

  return (
    <form
      className="ec-new-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ready) return;
        setBusy(true);
        try {
          await rcAddEvent(collectionId, { slug, title: title.trim() });
          window.location.hash = rcPath('event', collectionSlug, slug, 'edit').slice(1);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Nie udało się dodać wydarzenia.');
          setBusy(false);
        }
      }}
    >
      <h2 className="ec-new-h">Nowe wydarzenie</h2>

      <label className="ec-field">
        <span>Nazwa</span>
        <input type="text" value={title} maxLength={200} disabled={busy}
          placeholder="Rowerowa Częstochowa 2026"
          onChange={(e) => setTitle(e.target.value)} />
      </label>

      <label className="ec-field">
        <span>Adres w sieci</span>
        <span className="ec-url">
          <span className="ec-url-fixed">…/{collectionSlug}/</span>
          <input type="text" value={slug} maxLength={48} disabled={busy}
            placeholder="rowerowa26"
            onChange={(e) => setSlug(e.target.value.toLowerCase())} />
        </span>
      </label>

      {!shape && <p className="ap-error">Małe litery, cyfry i myślniki — myślnik tylko w środku.</p>}
      {clash && <p className="ap-error">Ten adres jest już zajęty w tej stronie.</p>}
      {error !== null && <p className="ap-error">{error}</p>}

      <div className="ec-new-actions">
        <button type="submit" className="ec-new" disabled={!ready}>
          {busy ? 'Dodawanie…' : 'Dodaj i otwórz edytor'}
        </button>
        <button type="button" className="ec-signin" disabled={busy} onClick={onClose}>
          Anuluj
        </button>
      </div>
    </form>
  );
}