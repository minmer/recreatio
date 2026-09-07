/**
 * Kreator wydarzeń — pod adresem `#/new/event/recreatio/new`.
 *
 * <b>Dlaczego osobna strona, a nie okienko w katalogu.</b> Robi się tu dwie
 * rzeczy naraz: zakłada nowe wydarzenie i przegląda te, które już są — z ich
 * stanem i rozmiarem. Okienko nad katalogiem pokazywałoby listę dwa razy, w
 * dwóch układach, i za każdym razem trzeba by pytać, która jest prawdziwa.
 *
 * <b>Dlaczego „new" nie może być nazwą wydarzenia.</b> Ten adres coś ROBI.
 * Wydarzenie o nazwie „new" wskazywałoby własnym adresem na formularz, którym
 * się je zakłada — byłoby nieosiągalne, a nikt by nie zobaczył dlaczego. Stąd
 * `RC_RESERVED_SLUGS`, po obu stronach: tutaj ostrzega przy pisaniu, w serwisie
 * odmawia.
 *
 * <b>Import nie połyka po cichu.</b> Nieznany rodzaj części jest wymieniony z
 * nazwy, zanim cokolwiek powstanie. Wydarzenie, któremu brakuje połowy, wygląda
 * na kompletne — a kto je wgrał, szuka błędu u siebie.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { rcAddEvent, rcAddPage, rcAddPart, rcEventCollection, type RcPartKind } from '../lib/rcEvents';
import { rcIsReservedSlug, rcIsSlug } from '../lib/rcSlugs';
import { rcPath } from '../lib/rcRoute';
import type { RcApi } from '../lib/rcApi';
import { rcImportSize, rcReadImport, type RcImportPlan } from './rcEventImport';
import { rcWhen } from './rcCatalogue';

type RcCollectionView = RcApi<'RcEventCollectionViewResponse'>;

export function RcEventCreator({
  collection, unlocked, onSignIn
}: {
  collection: string;
  unlocked: boolean;
  /** Die Anmeldeschublade oeffnen. Ohne sie waere „gesperrt" eine Sackgasse. */
  onSignIn: () => void;
}) {
  const [view, setView] = useState<RcCollectionView | null>(null);
  const [missing, setMissing] = useState(false);

  const refresh = useCallback(async () => {
    try { setView(await rcEventCollection(collection)); }
    catch { setMissing(true); }
  }, [collection]);

  useEffect(() => { void refresh(); }, [refresh]);

  /*
   * GESPERRT IST KEINE SACKGASSE — und auch keine fehlende Seite.
   *
   * Ohne aufgeschlossenes Konto antwortet der Dienst nicht mit dem Katalog,
   * und das sah hier bisher aus wie „diese Seite gibt es nicht". Zwei ganz
   * verschiedene Lagen, dieselbe Meldung: wer sie las, suchte den Fehler in
   * seinem Link statt an seinem Schluessel.
   */
  if (!unlocked) {
    return (
      <Shell>
        <a className="ek-back" href={rcPath('event', collection)}>← Katalog</a>
        <h1 className="ek-h1">Kreator wydarzeń</h1>
        <section className="ek-card">
          <h2 className="ek-h2">Zamknięte</h2>
          <p className="ek-note">
            Zakładanie wydarzeń czyta obszar tej strony, a ten jest zamknięty,
            dopóki nie odblokujesz konta swoim kluczem.
          </p>
          <button type="button" className="ek-go" onClick={onSignIn}>Odblokuj</button>
        </section>
      </Shell>
    );
  }

  if (missing) {
    return <Shell><p className="ek-note">Pod tym adresem nie ma strony wydarzeń.</p></Shell>;
  }

  if (view === null) return <Shell><p className="ek-note">Wczytywanie…</p></Shell>;

  if (!view.mayRead) {
    return (
      <Shell>
        <p className="ek-note">Nie możesz zakładać wydarzeń na tej stronie.</p>
        <a className="ek-back" href={rcPath('event', collection)}>← Katalog</a>
      </Shell>
    );
  }

  const events = view.events ?? [];

  return (
    <Shell>
      <a className="ek-back" href={rcPath('event', collection)}>← Katalog</a>

      <h1 className="ek-h1">Kreator wydarzeń</h1>
      <p className="ek-lead">
        Najpierw powstaje strona publiczna. Potem dokładasz części, które widzi
        tylko ten, kto ma klucz roli prowadzącej to wydarzenie.
      </p>

      <NewEvent
        collectionId={view.collectionId}
        collectionSlug={view.slug}
        taken={events.map((one) => one.slug)}
      />

      <section className="ek-card">
        <h2 className="ek-h2">Wydarzenia ({events.length})</h2>

        {events.length === 0 && (
          <p className="ek-note">Jeszcze żadnego. Zacznij powyżej.</p>
        )}

        <ul className="ek-list">
          {events.map((one) => {
            const when = rcWhen(one);
            return (
              <li key={one.eventId} className="ek-row">
                <a className="ek-row-open" href={rcPath('event', collection, one.slug, 'edit')}>
                  <span className="ek-row-title">{one.title}</span>
                  <code className="ek-row-slug">/{one.slug}</code>

                  <span className={`ek-pill ek-${one.lifecycle}`}>
                    {one.lifecycle === 'published' ? 'Opublikowane'
                      : one.lifecycle === 'archived' ? 'Archiwum' : 'Szkic'}
                  </span>

                  {/*
                    Rozmiar, nie ozdoba: po nim widać, czy wydarzenie jest
                    puste, czy gotowe — bez wchodzenia do środka.
                  */}
                  <span className="ek-row-meta">
                    {one.pages} stron · {one.parts} części · {one.registrations} zgłoszeń
                    {when !== null && <> · {when}</>}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>
    </Shell>
  );
}

// -- Anlegen ------------------------------------------------------------------

function NewEvent({
  collectionId, collectionSlug, taken
}: {
  collectionId: string;
  collectionSlug: string;
  taken: readonly string[];
}) {
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [importing, setImporting] = useState(false);
  const [json, setJson] = useState('');

  const plan = useMemo(() => (json.trim() === '' ? null : rcReadImport(json)), [json]);

  const reserved = rcIsReservedSlug(slug);
  const clash = slug !== '' && taken.includes(slug);
  const shape = slug === '' || rcIsSlug(slug);
  const ready = busy === null && title.trim() !== '' && slug !== '' && shape && !clash && !reserved;

  /** Anlegen und hineingehen. Eine leere Veranstaltung ist kein Ziel. */
  const create = async (built?: RcImportPlan) => {
    setError(null);
    setBusy('Zakładanie…');

    try {
      const made = await rcAddEvent(collectionId, {
        slug,
        title: (built?.title ?? title).trim()
      });

      if (built !== undefined) {
        for (const [index, page] of built.pages.entries()) {
          setBusy(`Strona ${index + 1} z ${built.pages.length}…`);
          const madePage = await rcAddPage(made.eventId, page.slug, page.title);

          for (const part of page.parts) {
            await rcAddPart(madePage.pageId, part.kind as RcPartKind, {
              isPublic: part.isPublic,
              menuLabel: part.menuLabel ?? undefined,
              title: part.title ?? undefined,
              intro: part.intro ?? undefined,
              configJson: part.configJson ?? undefined
            });
          }
        }
      }

      window.location.hash = rcPath('event', collectionSlug, made.slug, 'edit').slice(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się założyć wydarzenia.');
      setBusy(null);
    }
  };

  return (
    <section className="ek-card">
      <h2 className="ek-h2">Nowe wydarzenie</h2>
      <p className="ek-note">Zacznij od pustego wydarzenia albo zaimportuj gotowy JSON.</p>

      <div className="ek-form">
        <label className="ek-field">
          <span>Adres (slug)</span>
          <input type="text" value={slug} maxLength={48} disabled={busy !== null}
            placeholder="rajd-2026"
            onChange={(e) => setSlug(e.target.value.toLowerCase())} />
        </label>

        <label className="ek-field">
          <span>Tytuł</span>
          <input type="text" value={title} maxLength={200} disabled={busy !== null}
            placeholder="Rajd 2026"
            onChange={(e) => setTitle(e.target.value)} />
        </label>
      </div>

      {!shape && <p className="ap-error">Małe litery, cyfry i myślniki — myślnik tylko w środku.</p>}
      {clash && <p className="ap-error">Ten adres jest już zajęty na tej stronie.</p>}

      {/*
        „new" i „edit" coś w adresie ROBIĄ. Wydarzenie o takiej nazwie
        wskazywałoby własnym adresem na formularz albo na edytor — byłoby
        nieosiągalne, a przyczyny nie widać.
      */}
      {reserved && (
        <p className="ap-error">
          „{slug}" w adresie oznacza działanie, nie nazwę. Wybierz inną.
        </p>
      )}

      {error !== null && <p className="ap-error">{error}</p>}

      <div className="ek-actions">
        <button type="button" className="ek-go" disabled={!ready} onClick={() => void create()}>
          {busy ?? 'Utwórz puste wydarzenie'}
        </button>

        <button type="button" className="ek-ghost" disabled={busy !== null}
          onClick={() => setImporting(!importing)}>
          {importing ? 'Bez importu' : 'Importuj z JSON'}
        </button>
      </div>

      {importing && (
        <div className="ek-import">
          <label className="ek-field">
            <span>JSON wydarzenia</span>
            <textarea rows={8} value={json} disabled={busy !== null}
              placeholder={'{ "title": "…", "pages": [ … ] }'}
              onChange={(e) => setJson(e.target.value)} />
          </label>

          {plan !== null && !plan.ok && <p className="ap-error">{plan.error}</p>}

          {plan !== null && plan.ok && (
            <>
              <p className="ek-note">
                {plan.plan.title} — {rcImportSize(plan.plan).pages} stron,{' '}
                {rcImportSize(plan.plan).parts} części.
                {' '}Adres i tak bierzemy z pola powyżej.
              </p>

              {/*
                Co zostanie pominięte, stoi TU — zanim cokolwiek powstanie.
                Wydarzenie, któremu brakuje połowy, wygląda na kompletne.
              */}
              {plan.plan.skipped.length > 0 && (
                <div className="ek-skipped">
                  <p>Tego nie da się wgrać:</p>
                  <ul>{plan.plan.skipped.map((one) => <li key={one}>{one}</li>)}</ul>
                </div>
              )}

              <button
                type="button"
                className="ek-go"
                disabled={!ready}
                onClick={() => void create(plan.plan)}
              >
                {busy ?? 'Wgraj i otwórz edytor'}
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="ek"><div className="ek-inner">{children}</div></div>;
}

export default RcEventCreator;
