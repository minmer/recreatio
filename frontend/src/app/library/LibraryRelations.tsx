/**
 * 2026-10-22 — WER AUF DIESEN EINTRAG ZEIGT (Schritt 4) — über alle offenen
 * Bibliotheken, Skryptoria und Bazy wiedzy (`refIndex.ts`): Zitate, Werke,
 * Texte (mit dem Punkt des Plans), Wygłoszenia, Projekte, Einträge der Bazy
 * wiedzy (auch Komentarze — seit 2026-10-23 eine eigene Art dort), ihre
 * Powtórki, Przebiegi, Widoki, Zbiory und Szablony — und auf Wunsch die
 * Seiten, die dieses Konto führt (`pageUses.ts`). Verweise laufen in eine
 * Richtung (Skryptorium → Bibliothek und Nauka, Nauka → Bibliothek); hier
 * sieht man sie alle, rückwärts.
 *
 * Ein Werk der Schrift bekommt dazu „Fragment Pisma": eine Stelle eintippen
 * („Dz 1:14", „Acts 1,14") und sehen, was auf sie zeigt — in jeder Ausgabe.
 *
 * Gezeigt wird nur, was dieser Leser ohnehin lesen kann: das Verzeichnis
 * entsteht im Browser aus den geöffneten Speichern.
 */

import { useMemo, useState } from 'react';

import { pagePath, pageSteps, viewPath } from '../routes';
import { formatBible, parseBible, type BibleSpan } from './bible';
import { openedLibraryNames, type OpenLibrary } from './library';
import { kindOf, markupsOf, refTarget, str } from './libraryKinds';
import { citedKeys } from './libraryMarkup';
import { loadedStores, type Entry, type LibraryStore } from './libraryStore';
import { pagesUsing, type PageUse } from './pageUses';
import { hitHref, hitTitle, isBooksStore, whereText } from './refLabels';
import { passageHits, referenceIndex, type Hit } from './refIndex';

const isBooks = isBooksStore;

interface Row { readonly entry: Entry; readonly store: LibraryStore; readonly places: string[] }

/** Ein Zeigender einmal, mit allen Stellen, an denen er zeigt. */
function rowsOf(hits: readonly Hit<LibraryStore>[]): Row[] {
  const rows = new Map<string, Row>();
  for (const hit of hits) {
    const row = rows.get(hit.from.id) ?? { entry: hit.from, store: hit.store, places: [] };
    const place = whereText(hit);
    if (place !== '' && !row.places.includes(place)) row.places.push(place);
    rows.set(hit.from.id, row);
  }
  return [...rows.values()];
}

/** 2026-10-25 — so viele Zeilen je Gruppe zuerst; ein ganzer Wywód (die Summa: Tausende Schritte) bleibt sonst eine endlose Liste. */
const FIRST_ROWS = 8;

function RowList({ rows }: { rows: readonly Row[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, FIRST_ROWS);
  return (
    <>
      <ul className="lib-rel">
        {shown.map((row) => (
          <li key={row.entry.id}>
            <a href={hitHref(row.entry, row.store)}>{hitTitle(row.entry, row.store)}</a>
            {row.places.length > 0 && <span className="lib-rel-where"> — {row.places.join('; ')}</span>}
          </li>
        ))}
      </ul>
      {rows.length > FIRST_ROWS && <button type="button" className="wk-link-btn" onClick={() => setAll(!all)}>{all ? 'Pokaż mniej' : `Pokaż wszystkie (${rows.length})`}</button>}
    </>
  );
}

/* -- Wie weit gesucht wurde --------------------------------------------------------------------- */

/**
 * Gesucht wird in dem, was dieser Tab offen hat; auf Knopfdruck in allem, was
 * dieses Konto lesen darf (jede Bibliothek und jede Baza wiedzy).
 */
function Reach({ store }: { store: LibraryStore }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const stores = loadedStores();
  const bases = stores.filter((s) => !isBooks(s)).length;
  return (
    <p className="lib-rel-where">
      Przeszukano {stores.length - bases} bibliotek i {bases} baz wiedzy otwartych w tej karcie.{' '}
      {state !== 'done' && (
        <button type="button" className="wk-link-btn" disabled={state === 'busy'}
          onClick={() => { setState('busy'); void store.openEverything().finally(() => setState('done')); }}>
          {state === 'busy' ? 'Otwieranie…' : 'Szukaj we wszystkich, które możesz czytać'}
        </button>
      )}
    </p>
  );
}

/* -- Die Seiten ------------------------------------------------------------------------------------ */

function UsedOnPages({ store, entry }: { store: LibraryStore; entry: Entry }) {
  const [pages, setPages] = useState<readonly PageUse[] | 'busy' | 'failed' | null>(null);
  const list = typeof pages === 'object' && pages !== null ? pages : null;
  const look = () => { setPages('busy'); void pagesUsing(new Set([entry.id]), (t) => refTarget(store, t)?.id).then(setPages, () => setPages('failed')); };
  return (
    <>
      <p className="lib-box-sub">Na stronach, które prowadzisz</p>
      {pages === null && <button type="button" className="wk-link-btn" onClick={look}>Sprawdź strony</button>}
      {pages === 'busy' && <p className="lib-rel-where">Sprawdzanie stron…</p>}
      {pages === 'failed' && <p className="wk-error">Nie udało się sprawdzić stron.</p>}
      {list !== null && list.length === 0 && <p className="lib-rel-where">Żadna z Twoich stron go nie pokazuje.</p>}
      {list !== null && list.length > 0 && (
        <ul className="lib-rel">
          {list.map((page) => (
            <li key={page.path}>
              <a href={pagePath(page.path)}>{page.title}</a>
              <span className="lib-rel-where"> — {page.parts.map((p) => p.label).join(', ')} · <a href={viewPath('pages', ...pageSteps(page.path))}>edytuj</a></span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* -- Powiązania ------------------------------------------------------------------------------------ */

const KIND_ORDER = ['quote', 'text', 'delivery', 'project', 'work', 'person'];

export function Relations({ store, library, entry }: { store: LibraryStore; library: OpenLibrary; entry: Entry }) {
  const index = referenceIndex(loadedStores(), isBooks);
  /* 2026-10-25 (Wywód) — ein Wejście z Biblioteki steht als Knopf im Kasten „W Wiedzy", nicht noch einmal hier. */
  const hits = index.to(entry.id).filter((h) => h.from.id !== entry.id && h.from.kind !== 'anchor');
  const fromBooks = hits.filter((h) => isBooks(h.store));
  const fromBases = hits.filter((h) => !isBooks(h.store));
  const quotes = fromBooks.filter((h) => h.from.kind === 'quote');
  const byKind = KIND_ORDER.map((kind) => ({ kind, rows: rowsOf(fromBooks.filter((h) => h.from.kind === kind)) }))
    .filter((g) => g.rows.length > 0 && !(entry.kind === 'work' && g.kind === 'quote'));
  const others = rowsOf(fromBooks.filter((h) => !KIND_ORDER.includes(h.from.kind)));
  const bases = [...new Set(fromBases.map((h) => h.store))].map((s) => ({ store: s, rows: rowsOf(fromBases.filter((h) => h.store === s)) }));
  const names = openedLibraryNames();
  const cited = entry.kind === 'text' || entry.kind === 'delivery'
    ? citedKeys(...markupsOf(entry)).map((k) => refTarget(store, k) as Entry | undefined).filter((e): e is Entry => e !== undefined) : [];

  return (
    <section className="lib-box">
      <h2 className="lib-box-h">Powiązania</h2>
      {entry.kind === 'work' && (
        <>
          <p className="lib-box-sub">Cytaty z tego źródła: {new Set(quotes.map((q) => q.from.id)).size} <span className="lib-rel-where">— lista i dodawanie pod polami</span></p>
          {library.writes && <a className="wk-link-btn" href={viewPath('library', library.libraryId, 'nowy', 'quote', `work=${entry.id}`)}>+ Cytat (pełny formularz)</a>}
        </>
      )}
      {byKind.map((g) => (
        <div key={g.kind}>
          <p className="lib-box-sub">{g.kind === 'text' ? 'Przywołują go teksty' : kindOf(g.kind)?.plural ?? g.kind}</p>
          <RowList rows={g.rows} />
        </div>
      ))}
      {others.length > 0 && <><p className="lib-box-sub">Inne</p><RowList rows={others} /></>}
      {bases.map((b) => (
        <div key={b.store.libraryId}>
          <p className="lib-box-sub">W bazie wiedzy „{names.get(b.store.libraryId) ?? 'Baza wiedzy'}”</p>
          <RowList rows={b.rows} />
        </div>
      ))}
      {cited.length > 0 && <><p className="lib-box-sub">Ten tekst przywołuje</p><RowList rows={cited.map((c) => ({ entry: c, store, places: [] }))} /></>}
      <UsedOnPages store={store} entry={entry} />
      <Reach store={store} />
    </section>
  );
}

/* -- Fragment Pisma -------------------------------------------------------------------------------- */

/**
 * EINE STELLE DER SCHRIFT SUCHEN — an einem Werk mit `workType: bible`:
 * „Dz 1:14" findet Zitate, Komentarze, Punkte eines Plans, Texte und Einträge
 * der Bazy wiedzy, die auf eine Stelle zeigen, die sich mit ihr überschneidet
 * („Dz 1,12-14" auch) — in jeder Ausgabe der Schrift, nicht nur in dieser.
 */
export function PassageBox({ store, work }: { store: LibraryStore; work: Entry }) {
  const [query, setQuery] = useState('');
  const spans = useMemo(() => parseBible(query), [query]);
  return (
    <section className="lib-box">
      <h2 className="lib-box-h">Fragment Pisma</h2>
      <input value={query} aria-label="Fragment Pisma" placeholder="np. Dz 1,14 · Acts 1:14 · J 3,16-18"
        onChange={(e) => setQuery(e.target.value)} />
      {query.trim() !== '' && spans.length === 0 && <p className="wk-warn">Nie rozpoznaję tej księgi albo miejsca (np. „Łk 1,26-38”, „Ps 23”, „1 Kor 13,4-7”).</p>}
      <PassageList store={store} spans={spans} work={work} />
    </section>
  );
}

/**
 * Was auf eine Stelle zeigt, als Liste — unter „Fragment Pisma" und in der
 * Suche der Bibliothek, wenn das Gesuchte eine Stelle ist („Psalm 23").
 * `work`: die Ausgabe, in der man steht — andere tragen ihr Siglum.
 */
export function PassageList({ store, spans, work }: { store: LibraryStore; spans: readonly BibleSpan[]; work?: Entry }) {
  const found = passageHits(referenceIndex(loadedStores(), isBooks), spans);
  const rows = new Map<string, { entry: Entry; store: LibraryStore; places: string[] }>();
  for (const one of found) {
    const row = rows.get(one.hit.from.id) ?? { entry: one.hit.from, store: one.hit.store, places: [] };
    const siglum = one.work.id === work?.id ? '' : ` (${str(one.work.data, 'siglum') || one.hit.store.title(one.work)})`;
    const place = [whereText(one.hit), siglum].join('');
    if (!row.places.includes(place)) row.places.push(place);
    rows.set(one.hit.from.id, row);
  }
  if (spans.length === 0) return null;
  return (
    <>
      <p className="lib-box-sub">{formatBible(spans)} — {rows.size === 0 ? 'nic tu nie wskazuje' : `${rows.size} ${rows.size === 1 ? 'wpis' : 'wpisów'}`}</p>
      {rows.size > 0 && (
        <ul className="lib-rel">
          {[...rows.values()].map((row) => (
            <li key={row.entry.id}>
              <span className="lib-rel-kind">{isBooks(row.store) ? kindOf(row.entry.kind)?.label ?? row.entry.kind : 'Baza wiedzy'}</span>{' '}
              <a href={hitHref(row.entry, row.store)}>{hitTitle(row.entry, row.store)}</a>
              <span className="lib-rel-where"> — {row.places.join('; ')}</span>
            </li>
          ))}
        </ul>
      )}
      <Reach store={store} />
    </>
  );
}
