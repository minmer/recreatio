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

import { rcEventCollection } from '../lib/rcEvents';
import type { RcApi } from '../lib/rcApi';
import { rcPath } from '../lib/rcRoute';
import {
  rcCatalogue, rcCategoriesOf, rcInitials, rcPlacesIn, rcWhen,
  RC_CATALOGUE_ALL, type RcCatalogueQuery
} from './rcCatalogue';

type RcCollectionView = RcApi<'RcEventCollectionViewResponse'>;

export function RcEventCatalogue({ slug, signedIn }: { slug: string; signedIn: boolean }) {
  const [view, setView] = useState<RcCollectionView | null>(null);
  const [missing, setMissing] = useState(false);
  const [query, setQuery] = useState<RcCatalogueQuery>(RC_CATALOGUE_ALL);

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
    <Shell title={view.title} eyebrow={view.slug}>
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

        <button
          type="button"
          className={`ec-toggle${query.upcomingOnly ? ' is-on' : ''}`}
          aria-pressed={query.upcomingOnly}
          onClick={() => set('upcomingOnly', !query.upcomingOnly)}
        >
          Nadchodzące
        </button>

        {/*
          Licznik pokazuje, ILE zostało po sicie. Bez niego nie widać różnicy
          między „nic nie pasuje" a „nic tu nie ma" — a to dwie różne rzeczy.
        */}
        <span className="ec-count" aria-live="polite">{shown.length}</span>
      </div>

      {events.length === 0 && (
        <p className="ec-note">
          {signedIn
            ? 'Ta strona nie ma jeszcze żadnego wydarzenia. Dodaj je w edytorze.'
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

function Shell({
  title, eyebrow, children
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ec">
      <div className="ec-sheet">
        <header className="ec-head">
          <a className="ec-home" href={rcPath('home')}>Start</a>
          <span className="ec-spacer" />
          <a className="ec-signin" href={rcPath('workshop')}>Zaloguj się</a>
        </header>

        {eyebrow !== undefined && <p className="ec-eyebrow">{eyebrow}</p>}
        <h1 className="ec-h1">{title === '' ? 'Wydarzenia' : title}</h1>

        {children}
      </div>
    </div>
  );
}

export default RcEventCatalogue;
