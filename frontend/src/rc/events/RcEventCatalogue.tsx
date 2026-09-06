/**
 * Katalog strony wydarzeń — to, co widać pod `#/new/event/recreatio`.
 *
 * <b>Dlaczego ta strona w ogóle istnieje.</b> Wcześniej adres `#/new/event/x`
 * oznaczał JEDNO wydarzenie i nic ponad nim nie było. Kto organizował dwa
 * festyny, zakładał dwa razy wszystko: osobny obszar, osobną rolę
 * administracyjną i — co gorsza — osobną klauzulę RODO, wpisywaną z ręki
 * drugi raz. Teraz na górze stoi strona organizatora, a festyny leżą w niej.
 *
 * <b>Administrator danych stoi tutaj, jawnie.</b> Obowiązuje wszystko, co pod
 * tą stroną zbiera zgłoszenia, więc musi dać się przeczytać ZANIM ktokolwiek
 * cokolwiek wpisze — a więc bez konta i bez klucza. To ta sama granica co przy
 * mszy: `title_public` jawne, `title_sealed` nie.
 *
 * <b>Czego tu nie ma.</b> Edytora. Ten plik tylko czyta; kto ma prawa, wchodzi
 * w edycję osobnym wejściem, tak jak przy parafii.
 */

import { useEffect, useState } from 'react';

import { rcEventCollection } from '../lib/rcEvents';
import type { RcApi } from '../lib/rcApi';
import { rcPath } from '../lib/rcRoute';

type RcCollectionView = RcApi<'RcEventCollectionViewResponse'>;

/** Zakres dat wydarzenia — jedna linijka, po polsku, bez biblioteki. */
function when(startsUtc?: string | null, endsUtc?: string | null): string | null {
  const day = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? null
      : d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const from = startsUtc === null || startsUtc === undefined ? null : day(startsUtc);
  const to = endsUtc === null || endsUtc === undefined ? null : day(endsUtc);

  if (from === null) return null;
  return to === null || to === from ? from : `${from} – ${to}`;
}

export function RcEventCatalogue({ slug, signedIn }: { slug: string; signedIn: boolean }) {
  const [view, setView] = useState<RcCollectionView | null>(null);
  const [missing, setMissing] = useState(false);

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

  if (missing) {
    return (
      <Shell title="Nie znaleziono">
        <p className="evp-muted">
          Pod tym adresem nie ma strony wydarzeń. Sprawdź, czy odnośnik jest w całości.
        </p>
      </Shell>
    );
  }

  if (view === null) return <Shell title=""><p className="evp-muted">Wczytywanie…</p></Shell>;

  const events = view.events ?? [];

  return (
    <Shell title={view.title}>
      <h1 className="evp-title">{view.title}</h1>

      {events.length === 0 && (
        <p className="evp-muted">
          {signedIn
            ? 'Ta strona nie ma jeszcze żadnego wydarzenia. Dodaj je w edytorze.'
            : 'Nie zapowiedziano tu jeszcze niczego.'}
        </p>
      )}

      <ul className="evp-cat">
        {events.map((one) => {
          const date = when(one.startsUtc, one.endsUtc);
          return (
            <li key={one.eventId} className="evp-cat-row">
              <a className="evp-cat-open" href={rcPath('event', view.slug, one.slug)}>
                <span className="evp-cat-title">{one.title}</span>
                <span className="evp-cat-meta">
                  {date !== null && <span>{date}</span>}
                  {/*
                    Szkic widzą tylko swoi — i widzą, ŻE to szkic. Bez tego
                    ktoś rozesłałby odnośnik do strony, której nikt nie otworzy.
                  */}
                  {one.lifecycle !== 'published' && (
                    <span className="evp-cat-draft">{one.lifecycle === 'draft' ? 'szkic' : 'archiwum'}</span>
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
        <section className="evp-rodo">
          <h2 className="evp-rodo-h">Administrator danych</h2>
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
  title, children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="evp">
      <header className="evp-head">
        <span className="evp-brand">
          <span className="evp-mark" aria-hidden="true">◆</span>
          <span className="evp-name">{title === '' ? 'Wydarzenia' : title}</span>
        </span>
      </header>

      <main className="evp-main">{children}</main>

      <footer className="evp-foot">
        <a href="https://recreatio.pl">recreatio.pl</a>
      </footer>
    </div>
  );
}

export default RcEventCatalogue;
