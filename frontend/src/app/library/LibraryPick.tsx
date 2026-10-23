/**
 * WÄHLEN AUS DER BIBLIOTHEK (0064).
 *
 * <code>
 *   RefPicker          im Editor: ein Werk, Autoren, Themen — suchen, wählen,
 *                      oder gleich neu anlegen („Utwórz: Ratzinger")
 *   PickLibrary        im Seiteneditor: welche Bibliothek (oder 0110: welche
 *                      Baza wiedzy) ein Baustein zeigt
 *   PickLibraryEntry   im Seiteneditor: welcher Text, welches Projekt, welches
 *                      Thema — wer ihn auf der Seite sieht, sagt der Bereich der
 *                      Bibliothek (2026-10-22); 2026-10-22 (Schritt 8) ebenso bei
 *                      einer Baza wiedzy: aus ihren Einträgen, nicht mehr aus Bündeln
 * </code>
 */

import { useEffect, useId, useMemo, useState } from 'react';

import { containerPath, libraryKindOf, loadLibraries, openedLibraryKind, openLibraries, type LibraryKind, type OpenLibrary } from './library';
import { usePageLibrary } from './libraryOpen';
import { entrySort, kindOf, str } from './libraryKinds';
import type { Entry, LibraryStore } from './libraryStore';
import { entryLine } from './refLabels';
import { useMe, useWho } from '../core/me';
import { viewPath } from '../routes';
import { WorkspaceError, type Who } from '../core/session';
import { Loading } from '../ui/Loading';

/** Das Feld, das beim schnellen Anlegen den getippten Namen bekommt. */
const NAME_FIELD: Record<string, string> = { person: 'name', topic: 'name', work: 'title', project: 'title', text: 'title', quote: 'text' };

export function RefPicker({ store, kinds, value, multiple, busy, onChange, placeholder, only, makeWith, canMake = true }: {
  store: LibraryStore;
  kinds: readonly string[];
  value: readonly string[];
  multiple: boolean;
  busy?: boolean;
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** 2026-10-21 — nur diese zur Wahl (die Werte EINES Aspekts). */
  only?: (entry: Entry) => boolean;
  /** … und was ein neu angelegter dazu bekommt (sein Oberthema: der Aspekt). */
  makeWith?: Readonly<Record<string, unknown>>;
  /** 2026-10-22 — `false`: nur wählen (ein Verweis eines Komentarza kann auf jede Art zeigen). */
  canMake?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [making, setMaking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const list = useId();

  const chosen = value.map((id) => store.get(id)).filter((e): e is NonNullable<typeof e> => e !== undefined);
  const found = useMemo(() => (query.trim() === ''
    ? store.readable().filter((e) => kinds.includes(e.kind)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    : store.search(query, kinds)).filter((e) => !value.includes(e.id) && (only === undefined || only(e))).slice(0, 8),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [query, kinds, value, store, store.revision, only]);

  const pick = (id: string) => {
    onChange(multiple ? [...value, id] : [id]);
    setQuery('');
    setOpen(multiple);
  };

  const make = async () => {
    const kind = kinds[0];
    const name = query.trim();
    if (kind === undefined || name === '') return;
    setMaking(true);
    setFailed(null);
    try {
      const data: Record<string, unknown> = { ...(makeWith ?? {}), [NAME_FIELD[kind] ?? 'title']: name };
      if (kind === 'person') {
        const parts = name.split(/\s+/);
        if (parts.length >= 2 && !/^(św\.|bł\.|ks\.|o\.|s\.)$/i.test(parts[0])) {
          data.surname = parts[parts.length - 1];
          data.givenNames = parts.slice(0, -1).join(' ');
          delete data.name;
        }
      }
      const saved = await store.save({ kind, data });
      pick(saved.id);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się utworzyć.');
    } finally {
      setMaking(false);
    }
  };

  return (
    <div className="lib-picker">
      {chosen.length > 0 && (
        <ul className="lib-picked">
          {chosen.map((entry) => (
            <li key={entry.id} className="lib-chip">
              <a href={containerPath((store.homeOf(entry.id) ?? store).libraryId, entry.id)}>{entryLine(entry, store)}</a>
              <button type="button" className="lib-chip-x" aria-label={`Usuń: ${store.title(entry)}`} disabled={busy}
                onClick={() => onChange(value.filter((id) => id !== entry.id))}>×</button>
            </li>
          ))}
        </ul>
      )}
      {(multiple || chosen.length === 0) && (
        <div className="lib-picker-search">
          <input
            value={query}
            disabled={busy || making}
            placeholder={placeholder ?? `Szukaj: ${kinds.map((k) => kindOf(k)?.label.toLowerCase() ?? k).join(', ')}`}
            role="combobox"
            aria-expanded={open}
            aria-controls={list}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); if (found[0] !== undefined) pick(found[0].id); else void make(); }
              if (e.key === 'Escape') setOpen(false);
            }}
          />
          {open && (found.length > 0 || query.trim() !== '') && (
            <ul className="lib-options" id={list} role="listbox">
              {found.map((entry) => (
                <li key={entry.id}>
                  <button type="button" role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(entry.id)}>
                    <span className="lib-option-kind">{kindOf(entry.kind)?.label}</span> {entryLine(entry, store)}
                  </button>
                </li>
              ))}
              {canMake && query.trim() !== '' && kinds.length > 0 && (
                <li>
                  <button type="button" className="lib-option-new" onMouseDown={(e) => e.preventDefault()} onClick={() => void make()} disabled={making}>
                    + Utwórz {kindOf(kinds[0])?.label.toLowerCase()}: „{query.trim()}”
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </div>
  );
}

/* -- Im Seiteneditor ------------------------------------------------------------------------- */


/** Die Bibliotheken, die ich lesen kann — mit Namen (dafür braucht es die Schlüssel). */
export function useLibraries(given?: Who | null): readonly OpenLibrary[] | null | undefined {
  const who = useWho(given);
  const me = useMe(who);
  const [libraries, setLibraries] = useState<readonly OpenLibrary[] | null | undefined>(undefined);
  useEffect(() => {
    if (me === undefined) return undefined;
    if (me === null) { setLibraries(null); return undefined; }
    let alive = true;
    void loadLibraries().then((r) => openLibraries(me.ring, r.libraries)).then(
      (list) => { if (alive) setLibraries(list); },
      () => { if (alive) setLibraries([]); });
    return () => { alive = false; };
  }, [me]);
  return libraries;
}

/** `kind`: Bibliotheken (Vorgabe), 0110 Bazy wiedzy oder 2026-10-23 Skryptoria — drei Strukturen, drei Listen. */
export function PickLibrary({ value, busy, onPick, kind = 'books' }: { value: string; busy: boolean; onPick: (id: string) => void; kind?: LibraryKind }) {
  const all = useLibraries();
  const knowledge = kind === 'knowledge';
  const words = kind === 'knowledge' ? { loading: 'Wczytywanie baz wiedzy…', id: 'kennung bazy wiedzy', choose: '— wybierz bazę wiedzy —' }
    : kind === 'writing' ? { loading: 'Wczytywanie skryptoriów…', id: 'kennung skryptorium', choose: '— wybierz skryptorium —' }
    : { loading: 'Wczytywanie bibliotek…', id: 'kennung biblioteki', choose: '— wybierz bibliotekę —' };
  if (all === undefined) return <p className="wk-hint">{words.loading}</p>;
  if (all === null) return <input value={value} disabled={busy} placeholder={words.id} onChange={(e) => onPick(e.target.value.trim())} />;
  const libraries = all.filter((one) => libraryKindOf(one) === kind);
  return (
    <>
      <select value={value} disabled={busy} onChange={(e) => onPick(e.target.value)}>
        <option value="">{words.choose}</option>
        {libraries.map((one) => <option key={one.libraryId} value={one.libraryId}>{one.name}{audienceTag(one, knowledge)}</option>)}
        {value !== '' && !libraries.some((one) => one.libraryId === value) && <option value={value}>{all.find((one) => one.libraryId === value)?.name ?? value}</option>}
      </select>
      {libraries.length === 0 && (
        <span className="wk-hint">
          {knowledge ? <>Nie masz jeszcze bazy wiedzy — <a href={viewPath('learn')}>załóż ją w Nauce</a>.</>
            : kind === 'writing' ? <>Nie masz jeszcze skryptorium — <a href={viewPath('scriptorium')}>załóż je</a>.</>
            : <>Nie masz jeszcze biblioteki — <a href={viewPath('library')}>załóż ją</a>.</>}
        </span>
      )}
    </>
  );
}

/** Wer liest, was dieser Baustein zeigt — kurz, hinter dem Namen in der Wahl. */
function audienceTag(one: OpenLibrary, knowledge: boolean): string {
  if (one.areaPublic !== true) return ' — dla członków obszaru';
  if (one.areaRuleAt == null) return knowledge ? ' — obszar publiczny, baza jeszcze nie otwarta' : ' — obszar publiczny, czeka na potwierdzenie';
  return knowledge ? ' — publiczna w całości' : ' — publiczna';
}

interface EntryPickProps {
  library: string;
  kinds: readonly string[];
  value: string;
  busy: boolean;
  optional?: boolean;
  onPick: (id: string) => void;
}

/**
 * 2026-10-22 — in einer Bibliothek wählt man aus ihren Einträgen (der
 * Bereich sagt, wer sie auf der Seite sieht); (Schritt 8) in einer Baza
 * wiedzy ebenso — Powtórki, Przebiegi, Einträge, wie sie die Baza kennt.
 */
export function PickLibraryEntry(props: EntryPickProps) {
  return openedLibraryKind(props.library) === 'knowledge' ? <PickBaseEntry {...props} /> : <PickBooksEntry {...props} />;
}

function PickBooksEntry({ library, kinds, value, busy, optional, onPick }: EntryPickProps) {
  const { store, revision, state } = usePageLibrary(library === '' ? null : library);
  const items = useMemo(() => (store === null ? [] : kinds.flatMap((kind) => store.ofKind(kind))
    .sort((a, b) => (a.kind === 'text' ? -1 : 1) * entrySort(a, store).localeCompare(entrySort(b, store), 'pl'))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [store, revision, kinds.join(',')]);
  if (library === '') return <span className="wk-hint">Najpierw wybierz bibliotekę.</span>;
  if (state === 'loading') return <Loading lines={1} />;
  if (store === null) return <span className="wk-hint">Nie możesz czytać tej biblioteki.</span>;
  const label = (e: Entry) => {
    const date = str(e.data, 'date');
    return `${store.title(e).slice(0, 80)}${date === '' ? '' : ` · ${date}`}`;
  };
  return (
    <select value={value} disabled={busy} onChange={(e) => onPick(e.target.value)}>
      <option value="">{optional === true ? '— wszystkie —' : '— wybierz —'}</option>
      {items.map((e) => <option key={e.id} value={e.id}>{label(e)}</option>)}
      {value !== '' && !items.some((e) => e.id === value) && <option value={value}>{store.get(value) === undefined ? '(w innej bibliotece albo niedostępny)' : label(store.get(value)!)}</option>}
    </select>
  );
}

function PickBaseEntry({ library, kinds, value, busy, optional, onPick }: EntryPickProps) {
  const [items, setItems] = useState<readonly { id: string; label: string }[] | 'closed' | null>(null);
  useEffect(() => {
    if (library === '') { setItems([]); return undefined; }
    let alive = true;
    setItems(null);
    /* Cogita erst hier laden: wer nur Bibliotheken wählt, trägt sie nicht mit. */
    void import('../cogita/pageBase')
      .then(({ openPageBase, baseChoices }) => openPageBase(library).then((lib) => (lib === null ? 'closed' as const : baseChoices(lib, kinds))))
      .then((got) => { if (alive) setItems(got); }, () => { if (alive) setItems('closed'); });
    return () => { alive = false; };
  }, [library, kinds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  if (library === '') return <span className="wk-hint">Najpierw wybierz bazę wiedzy.</span>;
  if (items === null) return <Loading lines={1} />;
  if (items === 'closed') return <span className="wk-hint">Nie możesz czytać tej bazy wiedzy.</span>;
  return (
    <>
      <select value={value} disabled={busy} onChange={(e) => onPick(e.target.value)}>
        <option value="">{optional === true ? '— wszystkie —' : '— wybierz —'}</option>
        {items.map((item) => <option key={item.id} value={item.id}>{item.label.slice(0, 80)}</option>)}
        {value !== '' && !items.some((item) => item.id === value) && <option value={value}>(nie ma go w tej bazie) {value}</option>}
      </select>
      {items.length === 0 && <span className="wk-hint">W tej bazie nie ma jeszcze nic takiego.</span>}
    </>
  );
}
