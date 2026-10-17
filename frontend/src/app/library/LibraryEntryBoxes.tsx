/**
 * Die Kästen unter einem Eintrag: Schlüssel, Veröffentlichen, Beziehungen, LaTeX, JSON, Löschen.
 */

import { useEffect, useState } from 'react';

import { saveBlob } from '../core/platform';
import { useRemembered } from '../core/prefs';
import { WorkspaceError } from '../core/session';
import { viewPath } from '../routes';
import { JsonPanel, type JsonPreview } from '../ui/JsonPanel';
import type { OpenLibrary } from './library';
import { exportLibrary, libraryDescription, planLibraryImport } from './libraryJson';
import { type LibEntry, isKey, kindOf, str } from './libraryKinds';
import { latexFileName, missingKeys, projectToLatex, textToLatex } from './libraryLatex';
import { citedKeys } from './libraryMarkup';
import { entryLine } from './LibraryPick';
import { neededBy } from './libraryPublish';
import type { Entry, LibraryStore } from './libraryStore';

export const TAB_OF: Record<string, string> = { text: 'teksty', project: 'projekty', quote: 'cytaty', work: 'zrodla', person: 'osoby', topic: 'tematy' };

/* -- Der Schlüssel ------------------------------------------------------------------------------ */

export function KeyBox({ store, id, value, readOnly, onChange }: { store: LibraryStore; id: string; value: string; readOnly: boolean; onChange: (next: string) => void }) {
  const taken = value !== '' && store.keyTaken(value, id);
  const wrong = value !== '' && !isKey(value);
  return (
    <section className="lib-box">
      <h2 className="lib-box-h">Klucz cytowania</h2>
      <input value={value} disabled={readOnly} placeholder="zostanie zaproponowany" onChange={(e) => onChange(e.target.value.replace(/\s+/g, ''))} aria-label="Klucz cytowania" />
      {value !== '' && !taken && !wrong && <p className="wk-hint">W tekście: <code>[@{value}]</code> albo <code>[@{value}, s. 12]</code></p>}
      {taken && <p className="wk-warn">Ten klucz ma już inny wpis — zostanie uzupełniony literą.</p>}
      {wrong && <p className="wk-warn">Tylko litery, cyfry i znaki . _ : -</p>}
    </section>
  );
}

/* -- Veröffentlichung ----------------------------------------------------------------------------- */

export function PublishBox({ store, entry, readOnly }: { store: LibraryStore; entry: Entry; readOnly: boolean }) {
  const [current, setCurrent] = useState<boolean | null>(null);
  const [asking, setAsking] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (entry.publishedAs === null) { setCurrent(null); return undefined; }
    let alive = true;
    const timer = window.setTimeout(() => { void store.publicIsCurrent(entry.id).then((ok) => { if (alive) setCurrent(ok); }); }, 600);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [store, entry.id, entry.publishedAs, entry.version, store.revision]);

  const run = async (todo: () => Promise<void>) => {
    setBusy(true);
    setFailed(null);
    try { await todo(); setAsking(null); } catch (e) { setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.'); } finally { setBusy(false); }
  };

  const publish = () => {
    const next = store.planFor({ add: [entry.id] });
    if (next.alsoNew.length > 0 && asking === null) { setAsking([...next.alsoNew]); return; }
    void run(() => store.apply(next));
  };

  const users = entry.publishedAs !== null ? neededBy(entry.id, store.all(), store).map((id) => store.get(id)).filter((e): e is Entry => e !== undefined) : [];

  return (
    <section className="lib-box">
      <h2 className="lib-box-h">Publikacja</h2>
      {entry.publishedAs === null && <p>Prywatny — widzą go tylko osoby z kluczem biblioteki.</p>}
      {entry.publishedAs === 'explicit' && <p><span className="lib-badge is-public">publiczny</span></p>}
      {entry.publishedAs === 'implicit' && (
        <p><span className="lib-badge is-implicit">publiczny jako źródło</span> — przywołuje go: {users.slice(0, 4).map((u) => store.title(u)).join(', ') || 'opublikowany wpis'}.</p>
      )}
      {current === false && <p className="wk-warn">Zmiany nie są jeszcze opublikowane.</p>}

      {asking !== null && (
        <div className="lib-ask">
          <p>Razem z nim staną się publiczne (bez prywatnych notatek):</p>
          <ul>{asking.slice(0, 12).map((id) => <li key={id}>{kindOf(store.get(id)?.kind ?? '')?.label}: {store.title(store.get(id)!)}</li>)}</ul>
          {asking.length > 12 && <p className="wk-hint">i {asking.length - 12} więcej</p>}
        </div>
      )}

      {!readOnly && (
        <div className="wk-actions">
          {entry.publishedAs !== 'explicit' && (
            <button type="button" className="wk-btn" disabled={busy} onClick={publish}>
              {busy ? 'Publikowanie…' : asking !== null ? 'Opublikuj razem z nimi' : entry.publishedAs === 'implicit' ? 'Opublikuj też samodzielnie' : 'Opublikuj'}
            </button>
          )}
          {entry.publishedAs !== null && current === false && (
            <button type="button" className="wk-btn" disabled={busy} onClick={() => void run(() => store.apply(store.planFor({ refresh: [entry.id] })))}>Zaktualizuj publikację</button>
          )}
          {entry.publishedAs === 'explicit' && (
            <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void run(() => store.unpublish([entry.id]))}>Wycofaj publikację</button>
          )}
          {asking !== null && <button type="button" className="wk-link-btn" onClick={() => setAsking(null)}>Anuluj</button>}
        </div>
      )}
      {entry.publishedAs === 'explicit' && entry.kind === 'text' && <p className="wk-hint">Na stronie pokaże go moduł „Tekst z biblioteki” albo „Archiwum tekstów”.</p>}
      {entry.publishedAs === 'explicit' && entry.kind === 'quote' && <p className="wk-hint">Widoczny w module „Zbiór cytatów”.</p>}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}

/* -- Was auf ihn zeigt --------------------------------------------------------------------------- */

export function Relations({ store, library, entry }: { store: LibraryStore; library: OpenLibrary; entry: Entry }) {
  const back = store.backlinks(entry.id);
  const quotes = back.filter((e) => e.kind === 'quote');
  const texts = back.filter((e) => e.kind === 'text');
  const works = back.filter((e) => e.kind === 'work');
  const projects = back.filter((e) => e.kind === 'project');
  const other = back.filter((e) => !['quote', 'text', 'work', 'project'].includes(e.kind));
  const link = (e: Entry) => <a href={viewPath('library', library.libraryId, e.id)}>{e.kind === 'quote' ? `„${store.title(e)}”` : entryLine(e, store)}</a>;

  const cited = entry.kind === 'text' ? citedKeys(str(entry.data, 'body'), str(entry.data, 'further')).map((k) => store.byKey(k)).filter((e): e is Entry => e !== undefined) : [];

  if (back.length === 0 && cited.length === 0 && entry.kind !== 'work') return null;

  return (
    <section className="lib-box">
      <h2 className="lib-box-h">Powiązania</h2>
      {entry.kind === 'work' && (
        <>
          <p className="lib-box-sub">Cytaty z tego źródła: {quotes.length} <span className="wk-hint">— lista i dodawanie pod polami</span></p>
          {library.writes && <a className="wk-link-btn" href={viewPath('library', library.libraryId, 'nowy', 'quote', `work=${entry.id}`)}>+ Cytat (pełny formularz)</a>}
        </>
      )}
      {entry.kind !== 'work' && quotes.length > 0 && <><p className="lib-box-sub">Cytaty</p><ul className="lib-rel">{quotes.map((q) => <li key={q.id}>{link(q)}</li>)}</ul></>}
      {works.length > 0 && <><p className="lib-box-sub">Źródła</p><ul className="lib-rel">{works.map((w) => <li key={w.id}>{link(w)}</li>)}</ul></>}
      {texts.length > 0 && <><p className="lib-box-sub">Przywołują go teksty</p><ul className="lib-rel">{texts.map((t) => <li key={t.id}>{link(t)}</li>)}</ul></>}
      {projects.length > 0 && <><p className="lib-box-sub">W projekcie</p><ul className="lib-rel">{projects.map((o) => <li key={o.id}>{link(o)}</li>)}</ul></>}
      {other.length > 0 && <><p className="lib-box-sub">Inne</p><ul className="lib-rel">{other.map((o) => <li key={o.id}>{link(o)}</li>)}</ul></>}
      {cited.length > 0 && <><p className="lib-box-sub">Ten tekst przywołuje</p><ul className="lib-rel">{cited.map((c) => <li key={c.id}>{link(c)}</li>)}</ul></>}
    </section>
  );
}

/* -- LaTeX (Druck) ------------------------------------------------------------------------------- */

/**
 * DRUCKEN HEISST LaTeX. Ein Text (oder ein ganzes Projekt als Buch) als
 * `.tex`: Fussnoten mit den Quellen, Zitate mit Herkunft, Źródła am Ende —
 * dasselbe, was die Seite zeigt, für `pdflatex` (`libraryLatex.ts`).
 */
export function LatexBox({ store, entry }: { store: LibraryStore; entry: LibEntry }) {
  const [shown, setShown] = useState(false);
  const [author, setAuthor] = useRemembered('library.latex.author', '');
  const missing = entry.kind === 'text' ? missingKeys(entry, store) : [];
  const source = () => (entry.kind === 'project'
    ? projectToLatex(entry, store, { author })
    : textToLatex(entry, store, { author }));

  return (
    <section className="lib-box">
      <h2 className="lib-box-h">LaTeX</h2>
      <p className="wk-hint">{entry.kind === 'project' ? 'Cały projekt jako książka: części, rozdziały, przypisy, źródła na końcu.' : 'Tekst do druku: przypisy ze źródłami, cytaty, źródła na końcu.'}</p>
      <label className="wk-field">
        <span>Autor (na stronie tytułowej)</span>
        <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="np. ks. Jan Kowalski" />
      </label>
      {missing.length > 0 && <p className="wk-warn">Brakuje w bibliotece: {missing.map((k) => `@${k}`).join(', ')} — w przypisie stanie „[brak źródła]".</p>}
      <div className="wk-actions">
        <button type="button" className="wk-btn" onClick={() => void saveBlob(new Blob([source()], { type: 'application/x-tex' }), latexFileName(entry))}>Pobierz .tex</button>
        <button type="button" className="wk-link-btn" onClick={() => setShown((was) => !was)}>{shown ? 'Ukryj podgląd' : 'Podgląd'}</button>
        <button type="button" className="wk-link-btn" onClick={() => void navigator.clipboard?.writeText(source())}>Kopiuj</button>
      </div>
      {shown && <pre className="lib-latex">{source()}</pre>}
    </section>
  );
}

/* -- JSON und Löschen ------------------------------------------------------------------------------ */

/**
 * Ein NEUER Wpis nimmt das Dokument auf sich: der eine Eintrag seiner Art
 * darin, der noch keine bekannte Kennung hat, wird zu diesem — wer ein Buch
 * als JSON (von einer KI, aus einem anderen Programm) einfügt, ist danach auf
 * seiner Seite. Personen und Themen daneben entstehen wie beim Import der
 * Bibliothek.
 */
function intoThis(doc: unknown, id: string, kind: string, store: LibraryStore): unknown {
  const root = typeof doc === 'object' && doc !== null && !Array.isArray(doc) ? doc as Record<string, unknown> : null;
  const list: unknown[] | null = Array.isArray(doc) ? doc : Array.isArray(root?.entries) ? root!.entries as unknown[] : root !== null && typeof root.kind === 'string' ? [root] : null;
  if (list === null) return doc;
  const known = (one: Record<string, unknown>) => (typeof one.id === 'string' && store.get(one.id) !== undefined)
    || (typeof one.key === 'string' && store.byKey(one.key.replace(/^@/, ''))?.kind === kind);
  const mine = list.filter((one): one is Record<string, unknown> => typeof one === 'object' && one !== null && (one as Record<string, unknown>).kind === kind && !known(one as Record<string, unknown>));
  if (mine.length !== 1) return doc;
  const next = list.map((one) => (one === mine[0] ? { ...mine[0], id } : one));
  return Array.isArray(doc) ? next : root!.entries !== undefined ? { ...root, entries: next } : next[0];
}

export function EntryJson({ store, library, entry, isNew }: { store: LibraryStore; library: OpenLibrary; entry: LibEntry; isNew: boolean }) {
  const label = kindOf(entry.kind)?.label.toLowerCase() ?? 'wpis';
  const shaped = (doc: unknown) => (isNew ? intoThis(doc, entry.id, entry.kind, store) : doc);
  const preview = (doc: unknown): JsonPreview | { error: string } => {
    const planned = planLibraryImport(shaped(doc), store);
    return 'error' in planned ? planned : { lines: planned.lines, warnings: planned.warnings };
  };
  return (
    <JsonPanel
      summary={isNew ? 'Import z JSON' : 'Import / eksport JSON'}
      lead={isNew
        ? <>Wklej opis ({label}) jako JSON — np. przygotowany przez AI. Powstanie ten wpis (i osoby, tematy, które w nim są).</>
        : <>Ten wpis jako JSON — do poprawienia ręcznie albo przez AI. Import zmienia go w miejscu (pola, których nie podasz, zostają).</>}
      fileName={`wpis-${entry.key ?? entry.id.slice(0, 8)}.json`}
      exportDoc={() => exportLibrary(library.name, [entry])}
      description={libraryDescription}
      preview={preview}
      importLabel="Importuj i zapisz"
      onImport={async (doc) => {
        const planned = planLibraryImport(shaped(doc), store);
        if ('error' in planned) throw new WorkspaceError(planned.error);
        for (const draft of planned.drafts) await store.save({ id: draft.id, kind: draft.kind, ...(draft.key === undefined ? {} : { key: draft.key }), data: draft.data });
        if (isNew && planned.drafts.some((d) => d.id === entry.id)) window.location.replace(viewPath('library', library.libraryId, entry.id));
        return { lines: planned.lines, warnings: planned.warnings };
      }}
    />
  );
}

export function DeleteBox({ store, library, entry }: { store: LibraryStore; library: OpenLibrary; entry: Entry }) {
  const [sure, setSure] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const back = store.backlinks(entry.id);
  return (
    <section className="lib-box">
      {!sure ? (
        <button type="button" className="wk-link-btn lib-danger-link" onClick={() => setSure(true)}>Usuń ten wpis…</button>
      ) : (
        <>
          <p>Usunąć „{store.title(entry)}”?{back.length > 0 ? ` Odwołuje się do niego ${back.length} wpisów — te odwołania zostaną puste.` : ''}{entry.publishedAs !== null ? ' Zniknie też z publikacji.' : ''}</p>
          <div className="wk-actions">
            <button type="button" className="wk-btn lib-btn-danger" onClick={() => void store.remove(entry.id).then(
              () => { window.location.hash = viewPath('library', library.libraryId, TAB_OF[entry.kind] ?? ''); },
              (e: unknown) => setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się usunąć.'))}>Usuń</button>
            <button type="button" className="wk-link-btn" onClick={() => setSure(false)}>Anuluj</button>
          </div>
          {failed !== null && <p className="wk-error">{failed}</p>}
        </>
      )}
    </section>
  );
}
