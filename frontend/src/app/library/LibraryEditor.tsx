/**
 * EIN EINTRAG DER BIBLIOTHEK, GANZ (0064) — sein Formular aus seiner Art,
 * beim Text das Schreiben mit Quellen, beim Projekt der Plan, daneben die
 * Veröffentlichung und was auf ihn zeigt.
 *
 * <b>Gespeichert wird von selbst</b>, kurz nachdem das Tippen aufhört — ein
 * Kapitel geht nicht verloren, weil jemand vergass, auf „Zapisz" zu drücken.
 * Wer ihn liest, entscheidet der Bereich seiner Bibliothek (2026-10-22) —
 * eine Änderung ist sofort für alle da, die ihn lesen.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { IsbnTools, NumberTools, savePersons } from './BookLookup';
import type { OpenLibrary } from './library';
import { kindOf, outline, str, type EntryData, type LibEntry, shownMarkup } from './libraryKinds';
import type { Entry, LibraryStore } from './libraryStore';
import { QuoteFigure } from './LibraryText';
import { newId } from '../core/ids';
import { viewPath } from '../routes';
import { WorkspaceError } from '../core/session';
import { QuoteIntake } from './QuoteIntake';
import { CommentForm } from './CommentForm';
import { AreaBox } from './LibraryAreaBox';
import { DeleteBox, EntryJson, KeyBox, LatexBox, Relations, TAB_OF } from './LibraryEntryBoxes';
import { FieldList, OutlineEditor, TextForm } from './LibraryTextForm';
import { DeliveriesBox, DeliveryForm } from './DeliveryForm';

type SaveState = 'new' | 'saved' | 'dirty' | 'saving' | 'failed' | 'stale';

/** Heute, als RRRR-MM-DD — der Tag eines neuen Wygłoszenia. */
const today = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

function defaults(kind: string, preset: Record<string, unknown>): EntryData {
  const base: EntryData = kind === 'text' ? { textType: 'sermon', status: 'draft' }
    : kind === 'work' ? { workType: 'book' }
    : kind === 'person' ? { personType: 'person' }
    : kind === 'project' ? { projectType: 'book', status: 'writing' }
    /* 2026-10-21 — ein Wygłoszenie: heute, und der Text, von dem man kommt (`nowy/delivery/texts=<id>`). */
    : kind === 'delivery' ? { date: today() }
    : {};
  const out: EntryData = { ...base, ...preset };
  if (kind === 'delivery' && typeof out.texts === 'string') out.texts = out.texts.split(',').filter(Boolean);
  /* 2026-10-22 — ein Komentarz über das, von dem man kommt (`nowy/comment/o=<id>&p=<punkt>`). */
  if (kind === 'comment') {
    const about = typeof preset.o === 'string' ? preset.o : '';
    const point = typeof preset.p === 'string' ? preset.p : '';
    delete out.o;
    delete out.p;
    if (about !== '') out.subjects = [{ ref: about, ...(point === '' ? {} : { point }) }];
  }
  return out;
}

export function LibraryEditor({ store, library, entryId, kind, preset = {} }: {
  store: LibraryStore;
  library: OpenLibrary;
  entryId: string | null;
  kind: string | null;
  preset?: Record<string, unknown>;
}) {
  const existing = entryId === null ? undefined : store.own(entryId);
  /* 2026-10-22 — ein Eintrag einer anderen lesbaren Bibliothek wird dort bearbeitet. */
  const home = entryId === null || existing !== undefined ? undefined : store.homeOf(entryId);
  if (entryId !== null && home !== undefined) {
    return <p className="wk-note">Ten wpis jest w innej bibliotece. <a href={viewPath('library', home.libraryId, entryId)}>Otwórz go tam</a></p>;
  }
  if (entryId !== null && existing === undefined) {
    return <p className="wk-empty">Tego wpisu nie ma (albo został usunięty). <a href={viewPath('library', library.libraryId)}>Wróć do biblioteki</a></p>;
  }
  return <Editor key={entryId ?? `new-${kind}`} store={store} library={library} existing={existing} kind={existing?.kind ?? kind!} preset={preset} />;
}

function Editor({ store, library, existing, kind, preset }: {
  store: LibraryStore;
  library: OpenLibrary;
  existing: Entry | undefined;
  kind: string;
  preset: Record<string, unknown>;
}) {
  const def = kindOf(kind)!;
  const [id] = useState(() => existing?.id ?? newId());
  /* 2026-10-22 — im Editor stehen Schlüssel (`shownMarkup`); der Speicher schreibt daraus Kennungen (`storedMarkup`). */
  const [data, setData] = useState<EntryData>(() => (existing === undefined ? defaults(kind, preset) : shownMarkup(kind, existing.data, store)));
  const [key, setKey] = useState(existing?.key ?? '');
  const [state, setState] = useState<SaveState>(existing === undefined ? 'new' : 'saved');
  const [failed, setFailed] = useState<string | null>(null);
  const saved = store.get(id);
  const readOnly = !library.writes;

  const set = useCallback((patch: EntryData) => {
    setData((was) => ({ ...was, ...patch }));
    setState((was) => (was === 'new' ? 'new' : 'dirty'));
  }, []);

  const save = useCallback(async (next: EntryData, nextKey: string) => {
    setState('saving');
    setFailed(null);
    try {
      const done = await store.save({ id, kind, ...(nextKey.trim() === '' ? {} : { key: nextKey.trim() }), data: next });
      setKey(done.key ?? '');
      setState((was) => (was === 'saving' ? 'saved' : was));
      return done;
    } catch (e) {
      const stale = e instanceof WorkspaceError && e.verdict === 'stale';
      setState(stale ? 'stale' : 'failed');
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
      return null;
    }
  }, [id, kind, store]);

  /* Von selbst speichern — gut eine Sekunde nach dem letzten Tastendruck. */
  useEffect(() => {
    if (state !== 'dirty' || readOnly) return undefined;
    const timer = window.setTimeout(() => { void save(data, key); }, 1200);
    return () => window.clearTimeout(timer);
  }, [state, data, key, save, readOnly]);

  /* Wer die Seite verlässt, während noch etwas wartet, verliert es nicht. */
  const pending = useRef<{ data: EntryData; key: string } | null>(null);
  pending.current = state === 'dirty' ? { data, key } : null;
  useEffect(() => () => { if (pending.current !== null) void save(pending.current.data, pending.current.key); }, [save]);

  /* Was ein anderer Tab gespeichert hat, kommt herein — solange hier nichts offen ist. */
  useEffect(() => {
    const fresh = store.get(id);
    if (fresh !== undefined && state === 'saved') { setData(shownMarkup(kind, fresh.data, store)); setKey(fresh.key ?? ''); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.revision]);

  const create = async () => {
    const done = await save(data, key);
    if (done !== null) window.location.replace(viewPath('library', library.libraryId, done.id));
  };

  const reloadTheirs = () => {
    const fresh = store.get(id);
    if (fresh !== undefined) { setData(shownMarkup(kind, fresh.data, store)); setKey(fresh.key ?? ''); }
    setState('saved');
    setFailed(null);
  };

  const live: LibEntry = { id, kind, ...(key === '' ? {} : { key }), data };
  const title = def.title(data, store);

  /* Beim Buch: unter der ISBN scannen und aus dem Katalog füllen, unter der eigenen Nummer die nächste freie. */
  const extras: Record<string, ReactNode> = kind !== 'work' ? {} : {
    isbn: (
      <IsbnTools store={store} library={library} entryId={id} data={data} readOnly={readOnly}
        onSet={(isbn) => set({ isbn })}
        onPlan={async (plan) => { await savePersons(store, plan); set(plan.data); }} />
    ),
    libraryNumber: (
      <NumberTools store={store} library={library} entryId={id} value={str(data, 'libraryNumber')} readOnly={readOnly}
        onSet={(libraryNumber) => set({ libraryNumber })} />
    )
  };

  const status = state === 'new' ? 'Nowy — zapisz, żeby powstał.'
    : state === 'saving' ? 'Zapisywanie…'
    : state === 'dirty' ? 'Zmiany…'
    : state === 'failed' ? 'Nie zapisano.'
    : state === 'stale' ? 'Ktoś zmienił ten wpis w międzyczasie.'
    : 'Zapisane.';

  return (
    <div className={`lib-editor lib-editor-${kind}`}>
      <header className="lib-editor-head">
        <a className="wk-link" href={viewPath('library', library.libraryId, TAB_OF[kind] ?? '')}>← {def.plural}</a>
        <span className="lib-editor-kind">{def.label}</span>
        <h1 className="wk-h1 lib-editor-title">{kind === 'quote' ? <q>{title}</q> : title}</h1>
        <p className={`lib-state is-${state}`} role="status">{status}</p>
        {state === 'stale' && (
          <div className="wk-actions">
            <button type="button" className="wk-btn" onClick={reloadTheirs}>Wczytaj nowszą wersję</button>
            <button type="button" className="wk-link-btn" onClick={() => void save(data, key)}>Zachowaj moją (nadpisz)</button>
          </div>
        )}
        {failed !== null && state !== 'stale' && <p className="wk-error">{failed}</p>}
        {readOnly && <p className="wk-note">Tę bibliotekę możesz tylko czytać.</p>}
      </header>

      <div className="lib-editor-grid">
        <div className="lib-editor-main">
          {kind === 'text' ? (
            <TextForm store={store} entry={live} data={data} set={set} readOnly={readOnly} />
          ) : kind === 'delivery' ? (
            <DeliveryForm store={store} library={library} entry={live} data={data} set={set} readOnly={readOnly} />
          ) : kind === 'comment' ? (
            <CommentForm store={store} entry={live} data={data} set={set} readOnly={readOnly} />
          ) : (
            <FieldList store={store} kind={kind} data={data} set={set} readOnly={readOnly} extras={extras} />
          )}
          {kind === 'work' && saved !== undefined && <QuoteIntake store={store} library={library} work={saved} />}
          {kind === 'project' && saved !== undefined && (
            <OutlineEditor store={store} library={library} project={saved} value={outline(data)} readOnly={readOnly} onChange={(next) => set({ outline: next })} />
          )}
          {state === 'new' && !readOnly && (
            <div className="wk-actions"><button type="button" className="wk-btn" onClick={() => void create()}>Zapisz</button></div>
          )}
        </div>

        <aside className="lib-editor-side">
          {def.keyed && (
            <KeyBox store={store} id={id} value={key} readOnly={readOnly} onChange={async (next) => {
              /* 2026-10-22 — vor dem neuen Schlüssel: was den Eintrag noch über den alten nennt, nennt ihn über die Kennung. */
              const pinned = saved?.key !== undefined && next !== saved.key ? await store.pinCitations(id) : null;
              setKey(next);
              setState((was) => (was === 'new' ? 'new' : 'dirty'));
              return pinned;
            }} />
          )}
          {saved !== undefined && <AreaBox store={store} library={library} entry={saved} readOnly={readOnly} />}
          {saved !== undefined && kind === 'text' && <DeliveriesBox store={store} library={library} text={saved} readOnly={readOnly} />}
          {saved !== undefined && <Relations store={store} library={library} entry={saved} />}
          {kind === 'quote' && str(data, 'text') !== '' && <section className="lib-box"><h2 className="lib-box-h">Podgląd</h2><QuoteFigure entry={live} look={store} /></section>}
          {saved !== undefined && (kind === 'text' || kind === 'project') && <LatexBox store={store} entry={live} />}
          {!readOnly || saved !== undefined ? <EntryJson store={store} library={library} entry={saved ?? live} isNew={saved === undefined} /> : null}
          {saved !== undefined && !readOnly && <DeleteBox store={store} library={library} entry={saved} />}
        </aside>
      </div>
    </div>
  );
}
