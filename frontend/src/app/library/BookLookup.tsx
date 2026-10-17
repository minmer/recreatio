/**
 * ZUM BUCH ÜBER SEINEN CODE — scannen, finden, sonst aus dem Katalog anlegen.
 *
 * <b>In der Bibliothek</b> (`ScanBook`, neben der Suche): der Code auf dem
 * Rücken (ISBN) oder auf dem eigenen Etikett (Numer w bibliotece) führt zum
 * Buch. Ist es noch nicht da, schlägt der Katalog vor, was über es bekannt
 * ist (`libraryCatalog.ts`), und ein Druck legt es an — samt Autoren und
 * Übersetzern, die es noch nicht gab.
 *
 * <b>Im Werk</b> (`IsbnTools`, `NumberTools`): die ISBN einscannen, leere
 * Felder aus dem Katalog füllen, die nächste freie eigene Nummer vergeben.
 * Was jemand eingetragen hat, überschreibt der Katalog nie.
 */

import { useEffect, useState } from 'react';

import { isbn13, isbnDisplay, isbnProblem, isbnsIn } from './isbn';
import type { OpenLibrary } from './library';
import {
  bookLine, lookupIsbn, nextLibraryNumber, peopleLine, planBook, sameNumber, SOURCE_NAME, type BookPlan, type CatalogBook
} from './libraryCatalog';
import { slug, str, type EntryData } from './libraryKinds';
import type { Entry, LibraryStore } from './libraryStore';
import { viewPath } from './routes';
import { Scanner } from './Scanner';
import { WorkspaceError } from './session';

const fold = (text: string): string => slug(text).replace(/-/g, ' ').trim();

/** Werke mit dieser ISBN. */
export const worksByIsbn = (store: LibraryStore, isbn: string): Entry[] =>
  store.ofKind('work').filter((w) => isbnsIn(str(w.data, 'isbn')).includes(isbn));

/** Die Personen eines Plans anlegen — vor dem Werk, das auf sie zeigt. */
export async function savePersons(store: LibraryStore, plan: BookPlan): Promise<void> {
  for (const person of plan.persons) await store.save({ id: person.id, kind: 'person', data: person.data });
}

/* -- In der Bibliothek: scannen ------------------------------------------------------------- */

type Found =
  | { readonly kind: 'isbn'; readonly isbn: string; readonly works: readonly Entry[] }
  | { readonly kind: 'number'; readonly code: string; readonly works: readonly Entry[] }
  | { readonly kind: 'nothing'; readonly code: string };

export function ScanBook({ store, library, onSearch }: { store: LibraryStore; library: OpenLibrary; onSearch: (text: string) => void }) {
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<Found | null>(null);
  const [catalog, setCatalog] = useState(false);

  const go = (entry: Entry) => { window.location.hash = viewPath('library', library.libraryId, entry.id); };

  const take = (code: string) => {
    setScanning(false);
    setCatalog(false);
    const isbn = isbn13(code);
    if (isbn !== null) {
      const works = worksByIsbn(store, isbn);
      if (works.length === 1) { go(works[0]!); return; }
      setFound({ kind: 'isbn', isbn, works });
      return;
    }
    const works = store.ofKind('work').filter((w) => fold(str(w.data, 'libraryNumber')) === fold(code) && fold(code) !== '');
    if (works.length === 1) { go(works[0]!); return; }
    if (works.length > 1) { setFound({ kind: 'number', code, works }); return; }
    setFound({ kind: 'nothing', code });
  };

  return (
    <>
      <button type="button" className="wk-btn wk-btn-line lib-scan-btn" onClick={() => setScanning(true)} title="Zeskanuj ISBN z okładki albo własny numer z etykiety">
        <span aria-hidden="true" className="lib-scan-icon" />Skanuj kod
      </button>
      {scanning && (
        <Scanner
          title="Skanuj książkę"
          lead="Kod kreskowy z tyłu okładki (ISBN) albo etykieta z numerem w bibliotece — trzymaj go poziomo w ramce."
          onCode={take}
          onClose={() => setScanning(false)}
        />
      )}
      {found !== null && (
        <div className="lib-found" role="status">
          {found.kind === 'isbn' && found.works.length === 0 && (
            <>
              <p>Książki z ISBN <strong>{isbnDisplay(found.isbn)}</strong> nie ma jeszcze w tej bibliotece.</p>
              {library.writes && !catalog && (
                <div className="wk-actions">
                  <button type="button" className="wk-btn" onClick={() => setCatalog(true)}>Znajdź w katalogach i dodaj</button>
                  <a className="wk-link-btn" href={viewPath('library', library.libraryId, 'nowy', 'work', `isbn=${found.isbn}`)}>Dodaj ręcznie</a>
                </div>
              )}
              {catalog && (
                <CatalogPick
                  isbn={found.isbn}
                  people={store.ofKind('person')}
                  applyLabel="Dodaj do biblioteki"
                  onCancel={() => setCatalog(false)}
                  onApply={async (plan) => {
                    await savePersons(store, plan);
                    const saved = await store.save({ kind: 'work', data: plan.data });
                    go(saved);
                  }}
                  manual={viewPath('library', library.libraryId, 'nowy', 'work', `isbn=${found.isbn}`)}
                />
              )}
            </>
          )}
          {found.kind !== 'nothing' && found.works.length > 1 && (
            <>
              <p>{found.kind === 'isbn' ? `ISBN ${isbnDisplay(found.isbn)}` : `Numer „${found.code}”`} mają {found.works.length} wpisy:</p>
              <ul className="lib-rel">
                {found.works.map((w) => <li key={w.id}><a href={viewPath('library', library.libraryId, w.id)}>{store.title(w)}</a> <span className="lib-row-meta">{str(w.data, 'year')}</span></li>)}
              </ul>
            </>
          )}
          {found.kind === 'nothing' && (
            <>
              <p>Nic nie ma pod kodem <strong>{found.code}</strong> — to nie ISBN ani numer w bibliotece.</p>
              <div className="wk-actions"><button type="button" className="wk-link-btn" onClick={() => { onSearch(found.code); setFound(null); }}>Szukaj tego tekstu</button></div>
            </>
          )}
          <button type="button" className="wk-link-btn lib-found-x" onClick={() => { setFound(null); setCatalog(false); }}>Zamknij</button>
        </div>
      )}
    </>
  );
}

/* -- Der Katalog: welche Beschreibung? ------------------------------------------------------- */

/**
 * Die Beschreibungen zu einer ISBN — eine wählen, sehen, was sie füllt, und
 * übernehmen. `existing`: die Daten des Werks, das gefüllt wird (dann nur
 * die leeren Felder).
 */
export function CatalogPick({ isbn, people, existing, applyLabel, onApply, onCancel, manual }: {
  isbn: string;
  people: readonly Entry[];
  existing?: EntryData;
  applyLabel: string;
  onApply: (plan: BookPlan, book: CatalogBook) => Promise<void>;
  onCancel: () => void;
  /** Wohin, wenn kein Katalog das Buch kennt. */
  manual?: string;
}) {
  const [books, setBooks] = useState<readonly CatalogBook[] | null>(null);
  const [chosen, setChosen] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setBooks(null);
    setFailed(null);
    lookupIsbn(isbn).then((found) => {
      if (!alive) return;
      setBooks(found);
      /* Hat das Werk schon ein Jahr, ist wohl die Ausgabe dieses Jahres gemeint. */
      const year = existing === undefined ? '' : str(existing, 'year');
      const same = year === '' ? -1 : found.findIndex((b) => b.year === year);
      setChosen(Math.max(0, same));
    }, (e: unknown) => { if (alive) setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapytać katalogów.'); });
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isbn]);

  const book = books?.[chosen];
  const plan = book === undefined ? null : planBook(book, people, existing);

  const apply = async () => {
    if (plan === null || book === undefined) return;
    setBusy(true);
    setFailed(null);
    try {
      await onApply(plan, book);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lib-catalog" aria-live="polite">
      {books === null && failed === null && <p className="wk-hint">Szukanie w katalogach (Biblioteka Narodowa, e-ISBN, Open Library)…</p>}
      {books !== null && books.length === 0 && (
        <p>Żaden katalog nie zna ISBN {isbnDisplay(isbn)}.{manual !== undefined && <> <a href={manual}>Dodaj ręcznie</a>.</>}</p>
      )}
      {books !== null && books.length > 0 && (
        <>
          <p className="wk-hint">{books.length === 1 ? 'Znaleziony opis:' : `Znalezione opisy (${books.length}) — wybierz wydanie, które masz w ręku:`}</p>
          <ul className="lib-catalog-list">
            {books.map((b, i) => (
              <li key={b.ref}>
                <label className={i === chosen ? 'is-on' : ''}>
                  <input type="radio" name={`catalog-${isbn}`} checked={i === chosen} onChange={() => setChosen(i)} />
                  <span className="lib-catalog-book">
                    <strong>{b.title}{b.subtitle === undefined ? '' : `. ${b.subtitle}`}</strong>
                    {peopleLine(b) !== '' && <span>{peopleLine(b)}</span>}
                    <span className="lib-row-meta">{bookLine(b)}</span>
                    <span className="lib-row-meta">{SOURCE_NAME[b.source]}{b.exact ? '' : ' · ISBN podany jako inne wydanie'}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {plan !== null && (
            <div className="lib-catalog-plan">
              {plan.filled.length === 0
                ? <p>Wszystkie pola, które zna katalog, są już wypełnione.</p>
                : <p>{existing === undefined ? 'Powstanie książka z polami' : 'Uzupełni puste pola'}: {plan.filled.join(', ')}.</p>}
              {plan.persons.length > 0 && <p className="wk-hint">Nowe osoby: {plan.persons.map((p) => str(p.data, 'name') || `${str(p.data, 'givenNames')} ${str(p.data, 'surname')}`.trim()).join(', ')}.</p>}
            </div>
          )}
        </>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
      <div className="wk-actions">
        {plan !== null && plan.filled.length > 0 && <button type="button" className="wk-btn" disabled={busy} onClick={() => void apply()}>{busy ? 'Zapisywanie…' : applyLabel}</button>}
        <button type="button" className="wk-link-btn" onClick={onCancel}>Anuluj</button>
      </div>
    </div>
  );
}

/* -- Im Werk: ISBN und eigene Nummer ------------------------------------------------------------ */

/** Unter dem Feld ISBN: Prüfziffer, schon vorhanden?, scannen, aus dem Katalog füllen. */
export function IsbnTools({ store, library, entryId, data, readOnly, onSet, onPlan }: {
  store: LibraryStore;
  library: OpenLibrary;
  entryId: string;
  data: EntryData;
  readOnly: boolean;
  onSet: (isbn: string) => void;
  /** Ein Plan aus dem Katalog — das Werk übernimmt ihn in sein Formular (gespeichert wird wie beim Tippen). */
  onPlan: (plan: BookPlan) => Promise<void>;
}) {
  const [scanning, setScanning] = useState(false);
  const [catalog, setCatalog] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const value = str(data, 'isbn');
  const problem = isbnProblem(value);
  const first = isbnsIn(value)[0];
  const twins = first === undefined ? [] : worksByIsbn(store, first).filter((w) => w.id !== entryId);

  return (
    <div className="lib-field-tools">
      {problem !== null && <p className="wk-warn">{problem}</p>}
      {twins.length > 0 && (
        <p className="wk-warn">Ten ISBN ma już: {twins.map((w, i) => <span key={w.id}>{i > 0 && ', '}<a href={viewPath('library', library.libraryId, w.id)}>{store.title(w)}</a></span>)}.</p>
      )}
      {!readOnly && (
        <div className="wk-actions">
          <button type="button" className="wk-link-btn" onClick={() => setScanning(true)}>Skanuj ISBN</button>
          {first !== undefined && !catalog && <button type="button" className="wk-link-btn" onClick={() => { setCatalog(true); setSaid(null); }}>Uzupełnij z katalogu</button>}
        </div>
      )}
      {said !== null && <p className="wk-done" role="status">{said}</p>}
      {scanning && (
        <Scanner
          title="Skanuj ISBN"
          lead="Kod kreskowy z tyłu okładki — trzymaj go poziomo w ramce."
          onClose={() => setScanning(false)}
          onCode={(code) => {
            setScanning(false);
            const isbn = isbn13(code);
            if (isbn === null) { setSaid(`To nie jest ISBN: ${code}`); return; }
            const now = isbnsIn(value);
            if (now.includes(isbn)) { setSaid('Ten ISBN już tu jest.'); return; }
            onSet(value.trim() === '' || now.length === 0 ? isbnDisplay(isbn) : `${value.trim()}, ${isbnDisplay(isbn)}`);
            setSaid(`Wpisano ISBN ${isbnDisplay(isbn)}.`);
          }}
        />
      )}
      {catalog && first !== undefined && (
        <CatalogPick
          isbn={first}
          people={store.ofKind('person')}
          existing={data}
          applyLabel="Uzupełnij puste pola"
          onCancel={() => setCatalog(false)}
          onApply={async (plan) => {
            await onPlan(plan);
            setCatalog(false);
            setSaid(`Uzupełniono: ${plan.filled.join(', ')}.`);
          }}
        />
      )}
    </div>
  );
}

/** Unter dem Feld „Numer w bibliotece": die nächste freie Nummer, doppelte Nummern, ein Etikett scannen. */
export function NumberTools({ store, library, entryId, value, readOnly, onSet }: {
  store: LibraryStore;
  library: OpenLibrary;
  entryId: string;
  value: string;
  readOnly: boolean;
  onSet: (number: string) => void;
}) {
  const [scanning, setScanning] = useState(false);
  const works = store.ofKind('work');
  const twins = sameNumber(works, value, entryId);
  const next = nextLibraryNumber(works.filter((w) => w.id !== entryId));
  return (
    <div className="lib-field-tools">
      {twins.length > 0 && (
        <p className="wk-warn">Ten numer ma już: {twins.map((w, i) => <span key={w.id}>{i > 0 && ', '}<a href={viewPath('library', library.libraryId, w.id)}>{store.title(w)}</a></span>)}.</p>
      )}
      {!readOnly && (
        <div className="wk-actions">
          {value.trim() === '' && <button type="button" className="wk-link-btn" onClick={() => onSet(next)}>Nadaj kolejny: {next}</button>}
          <button type="button" className="wk-link-btn" onClick={() => setScanning(true)}>Skanuj etykietę</button>
        </div>
      )}
      {scanning && (
        <Scanner
          title="Skanuj etykietę"
          lead="Kod z etykiety z numerem tej książki w bibliotece."
          onClose={() => setScanning(false)}
          onCode={(code) => { setScanning(false); onSet(code); }}
        />
      )}
    </div>
  );
}
